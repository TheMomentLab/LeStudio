import { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronUp, Play, Pause, Loader2, CheckCircle2, Camera } from "lucide-react";
import { cn } from "../components/ui/utils";
import { apiGet, apiPost } from "../services/apiClient";
import { useLeStudioStore, getLeStudioState } from "../store";
import {
  extractPreflightReason,
  parseBackendError,
  toBackendTeleopPayload,
  type PreflightResult,
} from "../services/contracts";
import {
  notifyError,
  notifyProcessStarted,
  notifyProcessStopRequested,
  notifyProcessEndedWithError,
} from "../services/notifications";
import {
  PageHeader, StatusBadge, WireSelect,
  FieldRow, ProcessButtons, ModeToggle, StickyControlBar, SubTabs,
  WireBox, BlockerCard, RefreshButton, EmptyState,
} from "../components/wireframe";
import { buildPortOptionsFromPaths, type PortOption } from "../services/portLabels";
import { toVideoName, useCameraFeeds } from "../hooks/useCameraFeeds";



type TeleopPhase = "idle" | "loading" | "running";

type ActionResponse = {
  ok: boolean;
  error?: string;
};

type DepsStatusResponse = {
  teleop_antijitter_plugin?: boolean;
};

type DevicesResponse = {
  cameras: Array<{ device: string; path: string; kernels: string; symlink: string; model: string }>;
  arms: Array<{ device: string; path: string; symlink?: string | null }>;
};

type CalibFile = { id: string; guessed_type: string };

type TeleopDebugMeta = {
  antijitter_alpha?: number;
  antijitter_deadband?: number;
  antijitter_enabled?: boolean;
  antijitter_max_step?: number | null;
  debug_enabled?: boolean;
  debug_supported?: boolean;
  debug_interval_s?: number;
  invert_joints?: string[];
  reason?: string;
  schema_version?: number;
};

type TeleopDebugSnapshot = {
  schema_version: number;
  emitted_at_ms: number;
  joint_count_total: number;
  joint_count_emitted: number;
  truncated: boolean;
  loop_index: number;
  uptime_s: number;
  active_loop_ms: number;
  leader_raw_pos: Record<string, number>;
  follower_current_pos: Record<string, number>;
  teleop_action_pos: Record<string, number>;
  follower_goal_pos: Record<string, number>;
  goal_minus_current_pos: Record<string, number>;
  max_abs_goal_error: number;
  rms_goal_error: number;
  worst_joint: string;
};

type TeleopLogLine = {
  id: string;
  text: string;
  kind: string;
  ts: number;
  replace?: string;
};

const TELEOP_DEBUG_PREFIX = "[LESTUDIO_TELEOP_DEBUG] ";
const TELEOP_DEBUG_META_PREFIX = "[LESTUDIO_TELEOP_DEBUG_META] ";
const TELEOP_LOOP_METRIC_RE = /Teleop loop time:\s*([0-9.]+)ms\s*\(([0-9.]+)\s*Hz\)/i;
const EMPTY_TELEOP_LOGS: TeleopLogLine[] = [];

function asConfigRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function getConfigBoolean(config: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = config[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return fallback;
}

function getConfigNumber(config: Record<string, unknown>, key: string, fallback: number): number {
  const value = config[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function getOptionalNumberInput(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value;
  return "";
}

function parsePrefixedJson<T>(text: string, prefix: string): T | null {
  if (!text.startsWith(prefix)) return null;
  try {
    return JSON.parse(text.slice(prefix.length)) as T;
  } catch {
    return null;
  }
}

function formatJointName(key: string): string {
  return key.replace(/\.pos$/, "").replace(/_/g, " ");
}

function formatDebugNumber(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toFixed(2);
}

function asNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value).filter((entry): entry is [string, number] => {
    const [key, item] = entry;
    return typeof key === "string" && typeof item === "number" && Number.isFinite(item);
  });
  return Object.fromEntries(entries);
}

const LOADING_STEPS = [
  { label: "Opening camera...", pattern: /OpenCVCamera.*connected\./i },
  { label: "Connecting arm...", pattern: /(?:SO\w*(?:Leader|Follower)|(?:Leader|Follower))\s+connected\./i },
  { label: "Calibrating arm...", pattern: /Running calibration of/i, waitPattern: /press ENTER/i },
  { label: "Starting teleop loop...", pattern: /Teleop loop time:/i },
];

export function Teleop() {
  const config = useLeStudioStore((s) => s.config);
  const updateConfig = useLeStudioStore((s) => s.updateConfig);
  const teleopLogLines = useLeStudioStore((s) => s.logLines["teleop"]);
  const wsReady = useLeStudioStore((s) => s.wsReady);
  const [mode, setMode] = useState("Single Arm");
  const teleopRunningOnBackend = useLeStudioStore((s) => !!s.procStatus.teleop);
  const teleopReconnected = useLeStudioStore((s) => !!s.procReconnected.teleop);
  const [phase, setPhase] = useState<TeleopPhase>(() => teleopRunningOnBackend ? "running" : "idle");
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingWaitingInput, setLoadingWaitingInput] = useState(false);
  const [pausedFeeds, setPausedFeeds] = useState<Record<string, boolean>>({});
  const [speed, setSpeed] = useState("1.0x");
  const [advStreamOpen, setAdvStreamOpen] = useState(false);
  const [teleopTab, setTeleopTab] = useState("motor");
  const [startAccepted, setStartAccepted] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const lastErrorAtRef = useRef(0);
  const prevRunningRef = useRef(false);
  const [camerasMapped, setCamerasMapped] = useState<{ role: string; path: string }[]>([]);
  const [armPortOptions, setArmPortOptions] = useState<PortOption[]>([]);
  const [followerIdOptions, setFollowerIdOptions] = useState<string[]>([]);
  const [leaderIdOptions, setLeaderIdOptions] = useState<string[]>([]);
  const [bimanualIdOptions, setBimanualIdOptions] = useState<string[]>([]);
  const [selectedFollowerPort, setSelectedFollowerPort] = useState("");
  const [selectedLeaderPort, setSelectedLeaderPort] = useState("");
  const [selectedFollowerId, setSelectedFollowerId] = useState("");
  const [selectedLeaderId, setSelectedLeaderId] = useState("");
  const [selectedBimanualId, setSelectedBimanualId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [antiJitterAvailable, setAntiJitterAvailable] = useState(true);
  const running = phase === "running";
  const configRecord = useMemo(() => asConfigRecord(config), [config]);
  const antiJitterEnabled = getConfigBoolean(configRecord, "teleop_antijitter_enabled", false);
  const antiJitterAlpha = getConfigNumber(configRecord, "teleop_antijitter_alpha", 0.35);
  const antiJitterDeadband = getConfigNumber(configRecord, "teleop_antijitter_deadband", 0.75);
  const antiJitterMaxStep = getOptionalNumberInput(configRecord, "teleop_antijitter_max_step");
  const debugEnabled = getConfigBoolean(configRecord, "teleop_debug_enabled", false);
  const invertShoulderLift = getConfigBoolean(configRecord, "teleop_invert_shoulder_lift", false);
  const invertWristRoll = getConfigBoolean(configRecord, "teleop_invert_wrist_roll", false);
  const teleopLogs = teleopLogLines ?? EMPTY_TELEOP_LOGS;
  const effectiveConfig = useMemo(() => ({
    ...config,
    follower_port: selectedFollowerPort || configRecord.follower_port,
    leader_port: selectedLeaderPort || configRecord.leader_port,
    robot_id: selectedFollowerId || configRecord.robot_id,
    teleop_id: selectedLeaderId || configRecord.teleop_id,
  }), [config, configRecord.follower_port, configRecord.leader_port, configRecord.robot_id, configRecord.teleop_id, selectedFollowerId, selectedFollowerPort, selectedLeaderId, selectedLeaderPort]);
  const feedTargets = useMemo(
    () => camerasMapped.map((cam) => ({ id: cam.role, videoName: toVideoName(cam.path) })),
    [camerasMapped],
  );
  const previewFeedsActive = phase === "idle" && teleopTab === "camera";
  const cameraFrames = useCameraFeeds(feedTargets, previewFeedsActive || running, 30, pausedFeeds);
  const debugMeta = useMemo(() => {
    let latest: TeleopDebugMeta | null = null;
    for (const line of teleopLogs) {
      const parsed = parsePrefixedJson<TeleopDebugMeta>(line.text, TELEOP_DEBUG_META_PREFIX);
      if (parsed) latest = parsed;
    }
    return latest;
  }, [teleopLogs]);
  const debugSnapshot = useMemo(() => {
    let latest: TeleopDebugSnapshot | null = null;
    for (const line of teleopLogs) {
      const parsed = parsePrefixedJson<TeleopDebugSnapshot>(line.text, TELEOP_DEBUG_PREFIX);
      if (!parsed) continue;
      latest = {
        ...parsed,
        leader_raw_pos: asNumberRecord(parsed.leader_raw_pos),
        follower_current_pos: asNumberRecord(parsed.follower_current_pos),
        teleop_action_pos: asNumberRecord(parsed.teleop_action_pos),
        follower_goal_pos: asNumberRecord(parsed.follower_goal_pos),
        goal_minus_current_pos: asNumberRecord(parsed.goal_minus_current_pos),
      };
    }
    return latest;
  }, [teleopLogs]);
  const loopMetrics = useMemo(() => {
    for (let index = teleopLogs.length - 1; index >= 0; index -= 1) {
      const match = teleopLogs[index].text.match(TELEOP_LOOP_METRIC_RE);
      if (!match) continue;
      return {
        loopMs: Number(match[1]),
        hz: Number(match[2]),
      };
    }
    return null;
  }, [teleopLogs]);
  const debugJointRows = useMemo(() => {
    if (!debugSnapshot) return [];
    const keys = new Set<string>([
      ...Object.keys(debugSnapshot.leader_raw_pos ?? {}),
      ...Object.keys(debugSnapshot.follower_current_pos ?? {}),
      ...Object.keys(debugSnapshot.teleop_action_pos ?? {}),
      ...Object.keys(debugSnapshot.follower_goal_pos ?? {}),
      ...Object.keys(debugSnapshot.goal_minus_current_pos ?? {}),
    ]);
    return Array.from(keys)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => ({
        key,
        leader: debugSnapshot.leader_raw_pos[key],
        current: debugSnapshot.follower_current_pos[key],
        mapped: debugSnapshot.teleop_action_pos[key],
        goal: debugSnapshot.follower_goal_pos[key],
        error: debugSnapshot.goal_minus_current_pos[key],
      }));
  }, [debugSnapshot]);
  const debugAgeMs = debugSnapshot ? Math.max(0, Date.now() - debugSnapshot.emitted_at_ms) : null;
  const debugTelemetryPanel = (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Teleop Debug Telemetry</span>
        <span className="text-xs font-mono text-zinc-400">
          {debugEnabled
            ? (debugMeta?.debug_interval_s ? `sample ${debugMeta.debug_interval_s}s` : "waiting for process telemetry")
            : "disabled"}
        </span>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wide text-zinc-400">Runtime</div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 flex flex-col gap-1">
              <span>WS: {wsReady ? "connected" : "disconnected"}</span>
              <span>Loop Hz: {loopMetrics ? formatDebugNumber(loopMetrics.hz) : "-"}</span>
              <span>Loop ms: {debugSnapshot ? formatDebugNumber(debugSnapshot.active_loop_ms) : loopMetrics ? formatDebugNumber(loopMetrics.loopMs) : "-"}</span>
              <span>Loop #: {debugSnapshot?.loop_index ?? "-"}</span>
              <span>Uptime: {debugSnapshot ? formatDebugNumber(debugSnapshot.uptime_s) : "-"}s</span>
              <span>Sample age: {debugAgeMs !== null ? `${debugAgeMs}ms` : "-"}</span>
            </div>
          </div>

          <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wide text-zinc-400">Device Mapping</div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 flex flex-col gap-1 font-mono">
              <span>Follower: {selectedFollowerPort || "-"}</span>
              <span>Leader: {selectedLeaderPort || "-"}</span>
              <span>Robot ID: {selectedFollowerId || "-"}</span>
              <span>Teleop ID: {selectedLeaderId || "-"}</span>
              <span>Cams: {camerasMapped.length}</span>
            </div>
          </div>

          <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wide text-zinc-400">Mapping Controls</div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 flex flex-col gap-1">
              <span>Invert shoulder: {invertShoulderLift ? "on" : "off"}</span>
              <span>Invert wrist: {invertWristRoll ? "on" : "off"}</span>
              <span>Anti-jitter: {(debugMeta?.antijitter_enabled ?? antiJitterEnabled) ? "on" : "off"}</span>
              <span>Alpha: {formatDebugNumber(debugMeta?.antijitter_alpha ?? antiJitterAlpha)}</span>
              <span>Deadband: {formatDebugNumber(debugMeta?.antijitter_deadband ?? antiJitterDeadband)}</span>
            </div>
          </div>

          <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wide text-zinc-400">Signals</div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 flex flex-col gap-1">
              <span>Log lines: {teleopLogs.length}</span>
              <span>Supported: {debugMeta?.debug_supported === false ? "no" : "yes"}</span>
              <span>Leader joints: {debugSnapshot ? Object.keys(debugSnapshot.leader_raw_pos).length : 0}</span>
              <span>Current joints: {debugSnapshot ? Object.keys(debugSnapshot.follower_current_pos).length : 0}</span>
              <span>Goal joints: {debugSnapshot ? Object.keys(debugSnapshot.follower_goal_pos).length : 0}</span>
              <span>Invert joints: {debugMeta?.invert_joints?.join(", ") || "none"}</span>
            </div>
          </div>
        </div>

        {debugEnabled && debugSnapshot ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 p-3">
                <div className="text-xs uppercase tracking-wide text-zinc-400">Joint Coverage</div>
                <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 flex flex-col gap-1">
                  <span>Total joints: {debugSnapshot.joint_count_total}</span>
                  <span>Shown joints: {debugSnapshot.joint_count_emitted}</span>
                  <span>Truncated: {debugSnapshot.truncated ? "yes" : "no"}</span>
                  <span>Schema: v{debugSnapshot.schema_version}</span>
                </div>
              </div>

              <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 p-3">
                <div className="text-xs uppercase tracking-wide text-zinc-400">Goal Error</div>
                <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 flex flex-col gap-1">
                  <span>Max abs: {formatDebugNumber(debugSnapshot.max_abs_goal_error)}</span>
                  <span>RMS: {formatDebugNumber(debugSnapshot.rms_goal_error)}</span>
                  <span>Worst joint: {debugSnapshot.worst_joint ? formatJointName(debugSnapshot.worst_joint) : "-"}</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full text-sm font-mono">
                <thead className="bg-zinc-50 dark:bg-zinc-800/30 text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Joint</th>
                    <th className="px-3 py-2 text-right">Leader Raw</th>
                    <th className="px-3 py-2 text-right">Current</th>
                    <th className="px-3 py-2 text-right">Mapped</th>
                    <th className="px-3 py-2 text-right">Goal</th>
                    <th className="px-3 py-2 text-right">Goal-Current</th>
                  </tr>
                </thead>
                <tbody>
                  {debugJointRows.map((row) => (
                    <tr key={row.key} className="border-t border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
                      <td className="px-3 py-2 whitespace-nowrap">{formatJointName(row.key)}</td>
                      <td className="px-3 py-2 text-right">{formatDebugNumber(row.leader)}</td>
                      <td className="px-3 py-2 text-right">{formatDebugNumber(row.current)}</td>
                      <td className="px-3 py-2 text-right">{formatDebugNumber(row.mapped)}</td>
                      <td className="px-3 py-2 text-right">{formatDebugNumber(row.goal)}</td>
                      <td className="px-3 py-2 text-right">{formatDebugNumber(row.error)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-200 p-3 overflow-x-auto">
              <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Latest Raw Snapshot</div>
              <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(debugSnapshot, null, 2)}</pre>
            </div>
          </>
        ) : (
          <div className="rounded border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
            {!debugEnabled
              ? "Verbose debug overlay is currently off. Turn it on above to keep last snapshot data visible here and stream live Teleop telemetry."
              : debugMeta?.debug_supported === false
              ? `Debug overlay is enabled, but this teleop runtime reported that structured snapshots are unsupported (${debugMeta.reason ?? "unknown reason"}).`
              : running
                ? "Debug overlay is enabled, but Teleop has not emitted a snapshot yet. Start Teleop and move the leader slightly to populate runtime data."
                : "Debug overlay is enabled. Start Teleop to stream live leader/current/goal telemetry here."}
          </div>
        )}
      </div>
    </div>
  );

  const toggleFeed = (role: string) =>
    setPausedFeeds((prev) => ({ ...prev, [role]: !prev[role] }));

  const persistConfigPatch = (patch: Record<string, unknown>) => {
    updateConfig(patch);
    void apiPost<Record<string, unknown>>("/api/config", patch).catch(() => undefined);
  };

  const handleFollowerPortChange = (value: string) => {
    setSelectedFollowerPort(value);
    persistConfigPatch({ follower_port: value });
  };

  const handleLeaderPortChange = (value: string) => {
    setSelectedLeaderPort(value);
    persistConfigPatch({ leader_port: value });
  };

  const handleFollowerIdChange = (value: string) => {
    setSelectedFollowerId(value);
    persistConfigPatch({ robot_id: value });
  };

  const handleLeaderIdChange = (value: string) => {
    setSelectedLeaderId(value);
    persistConfigPatch({ teleop_id: value });
  };

  useEffect(() => {
    let cancelled = false;
    void apiGet<DepsStatusResponse>("/api/deps/status")
      .then((result) => {
        if (cancelled) return;
        setAntiJitterAvailable(result.teleop_antijitter_plugin !== false);
      })
      .catch(() => {
        if (cancelled) return;
        setAntiJitterAvailable(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleStart = async () => {
    if (actionPending) return;
    setActionPending(true);
    setFlowError(null);
    setStartAccepted(false);
    setPhase("loading");
    setLoadingStep(0);
    loadingStepRef.current = 0;
      loadingStartIdxRef.current = teleopLogs.length;
    try {
      const payload = toBackendTeleopPayload({
        modeLabel: mode,
        speedLabel: speed,
        cameras: camerasMapped,
        config: antiJitterAvailable
          ? effectiveConfig
          : { ...effectiveConfig, teleop_antijitter_enabled: false },
      });

      const preflight = await apiPost<PreflightResult>("/api/preflight", payload);
      if (!preflight.ok) {
        setPhase("idle");
        const reason = extractPreflightReason(preflight);
        setFlowError(reason);
        notifyError(reason);
        return;
      }

      const started = await apiPost<ActionResponse>("/api/teleop/start", payload);
      if (!started.ok) {
        setPhase("idle");
        const reason = started.error ?? "failed to start teleop";
        setFlowError(reason);
        notifyError(reason);
        return;
      }

      setStartAccepted(true);
      notifyProcessStarted("teleop");
    } catch (error) {
      setPhase("idle");
      const reason = parseBackendError(error, "failed to start teleop");
      setFlowError(reason);
      notifyError(reason);
    } finally {
      setActionPending(false);
    }
  };

  const handleStop = async () => {
    if (actionPending) return;
    setActionPending(true);
    setFlowError(null);
    const stopped = await apiPost<ActionResponse>("/api/process/teleop/stop");
    if (!stopped.ok) {
      const reason = stopped.error ?? "failed to stop teleop";
      setFlowError(reason);
      notifyError(reason);
    } else {
      notifyProcessStopRequested("teleop");
    }
    setPhase("idle");
    setLoadingStep(0);
    setPausedFeeds({});
    setStartAccepted(false);
    setActionPending(false);
  };

  // Sync phase with backend process status
  // — restores "running" when navigating back to page while process is active
  // — resets to "idle" when backend process ends (e.g. crashed while on another page)
  useEffect(() => {
    if (phase === "idle" && teleopRunningOnBackend) {
      // Skip past existing logs so old end-markers don't trigger idle
      const logs = getLeStudioState().logLines["teleop"] ?? [];
      loadingStartIdxRef.current = logs.length;
      setPhase("running");
    } else if (phase !== "idle" && !teleopRunningOnBackend) {
      setPhase("idle");
      setStartAccepted(false);
      setActionPending(false);
    }
  }, [teleopRunningOnBackend]);

  // Real log-based loading sequence
  const loadingStartIdxRef = useRef(0);
  const loadingStepRef = useRef(0);

  useEffect(() => {
    if (phase !== "loading" || !startAccepted) return;

    const logs = teleopLogs;
    const logsToScan = logs.slice(loadingStartIdxRef.current);
    let step = loadingStepRef.current;
    let waiting = false;
    for (const line of logsToScan) {
      if (step >= LOADING_STEPS.length) break;
      // Check current step and all later steps — skip ahead if a later one matches first
      for (let s = step; s < LOADING_STEPS.length; s++) {
        if (LOADING_STEPS[s].pattern.test(line.text)) {
          step = s + 1;
          waiting = false;
          break;
        }
      }
      // Detect "press ENTER" wait state on the current active step
      const activeStep = LOADING_STEPS[step - 1];
      if (activeStep?.waitPattern?.test(line.text)) {
        waiting = true;
      }
    }

    setLoadingWaitingInput(waiting);
    if (step !== loadingStepRef.current) {
      loadingStepRef.current = step;
      setLoadingStep(step);
      if (step >= LOADING_STEPS.length) {
        setPhase("running");
      }
    }
  }, [phase, startAccepted, teleopLogs]);

  // Timeout fallback: if stuck on loading for 20s total, force running
  // (disabled while waiting for user calibration input)
  useEffect(() => {
    if (phase !== "loading" || !startAccepted || loadingWaitingInput) return;
    const timer = setTimeout(() => {
      loadingStepRef.current = LOADING_STEPS.length;
      setLoadingStep(LOADING_STEPS.length);
      setPhase("running");
    }, 20_000);
    return () => clearTimeout(timer);
  }, [phase, startAccepted, loadingWaitingInput]);

  // Watch for process end — detect "[teleop process ended]" in logs
  useEffect(() => {
    if (phase === "idle") return;
    const logs = teleopLogs;
    const endMarker = logs.find(
      (l, i) => i >= loadingStartIdxRef.current && /\[teleop process ended\]/i.test(l.text),
    );
    if (endMarker) {
      setPhase("idle");
      setStartAccepted(false);
      setActionPending(false);
    }
  }, [phase, teleopLogs]);

  useEffect(() => {
    const run = async () => {
      const devResult = await apiGet<DevicesResponse>("/api/devices");
      const mapped = (devResult.cameras ?? [])
        .filter((cam) => cam.symlink)
        .map((cam) => ({ role: cam.symlink, path: `/dev/${cam.symlink}` }));
      setCamerasMapped(mapped);

      const rawPorts = Array.from(
        new Set(
          (devResult.arms ?? [])
            .map((arm) => (arm.symlink ? `/dev/${arm.symlink}` : arm.path))
            .filter((value): value is string => Boolean(value))
        )
      );
      const portOpts = buildPortOptionsFromPaths(rawPorts);
      setArmPortOptions(portOpts);
      const defaultFollower = rawPorts.find((p) => /follower/i.test(p)) ?? rawPorts[0] ?? "";
      const defaultLeader = rawPorts.find((p) => /leader/i.test(p)) ?? rawPorts[1] ?? rawPorts[0] ?? "";
      setSelectedFollowerPort((prev) => (prev && rawPorts.includes(prev) ? prev : defaultFollower));
      setSelectedLeaderPort((prev) => (prev && rawPorts.includes(prev) ? prev : defaultLeader));

      const calibResult = await apiGet<{ files?: CalibFile[] }>("/api/calibrate/list");
      const files = calibResult.files ?? [];
      const followers = Array.from(new Set(files.filter((f) => f.guessed_type.includes("follower")).map((f) => f.id)));
      const leaders = Array.from(new Set(files.filter((f) => f.guessed_type.includes("leader")).map((f) => f.id)));
      const bimanual = Array.from(new Set(files.filter((f) => f.guessed_type.startsWith("bi_")).map((f) => f.id)));
      setFollowerIdOptions(followers);
      setLeaderIdOptions(leaders);
      setBimanualIdOptions(bimanual);
      setSelectedFollowerId((prev) => (prev && followers.includes(prev) ? prev : followers[0] ?? ""));
      setSelectedLeaderId((prev) => (prev && leaders.includes(prev) ? prev : leaders[0] ?? ""));
      setSelectedBimanualId((prev) => (prev && bimanual.includes(prev) ? prev : bimanual[0] ?? ""));

    };
    void run();
  }, [refreshKey]);

  useEffect(() => {
    if (!flowError) return;
    lastErrorAtRef.current = Date.now();
  }, [flowError]);

  useEffect(() => {
    if (!flowError) return;
    setFlowError(null);
  }, [selectedFollowerPort, selectedLeaderPort, selectedFollowerId, selectedLeaderId]);

  useEffect(() => {
    const wasRunning = prevRunningRef.current;
    if (wasRunning && !running) {
      const abnormal = Date.now() - lastErrorAtRef.current < 120000;
      if (abnormal) {
        notifyProcessEndedWithError("teleop", undefined, { toast: false });
      }
    }
    prevRunningRef.current = running;
  }, [running]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col gap-4 max-w-[1600px] mx-auto w-full">
          {/* Header */}
          <PageHeader
            title="Teleop"
            subtitle="Real-time teleoperation + multi-camera feed"
            action={
              <div className="flex items-center gap-3">
                {phase === "idle" && (
                  <ModeToggle options={["Single Arm", "Bi-Arm"]} value={mode} onChange={setMode} />
                )}
                <RefreshButton onClick={() => setRefreshKey(k => k + 1)} />
              </div>
            }
          />

          {flowError && <BlockerCard title="Execution Blocked" severity="error" reasons={[flowError]} />}

          {/* ─── IDLE: Sub-tabs for settings ─── */}
          {phase === "idle" && (
            <div className="flex flex-col gap-4">
              <SubTabs
                tabs={[
                  { key: "motor", label: "Motor Setting" },
                  { key: "camera", label: "Camera Setting" },
                ]}
                activeKey={teleopTab}
                onChange={setTeleopTab}
                className="mx-auto"
              />

              {/* Motor Setting Tab */}
              {teleopTab === "motor" && (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Motor Configuration</span>
                  </div>
                  <div className="px-4 py-4 flex flex-col gap-3">
                  <p className="text-sm text-zinc-400">Select robot type and control method.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                    <FieldRow label="Robot Type">
                      <WireSelect value="so101_follower" options={["so101_follower", "so100_follower", "aloha"]} />
                    </FieldRow>
                    <FieldRow label="Teleop Type">
                      <WireSelect value="so101_leader" options={["so101_leader", "so100_leader", "keyboard"]} />
                    </FieldRow>
                  </div>

                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex flex-col gap-2">
                    <p className="text-sm text-zinc-400">Select device port to connect.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                    {mode === "Single Arm" ? (
                      <>
                        <FieldRow label="Follower Port">
                          <WireSelect
                            placeholder={armPortOptions.length === 0 ? "No ports detected" : undefined}
                            value={selectedFollowerPort}
                            options={armPortOptions}
                            onChange={handleFollowerPortChange}
                          />
                        </FieldRow>
                        <FieldRow label="Leader Port">
                          <WireSelect
                            placeholder={armPortOptions.length === 0 ? "No ports detected" : undefined}
                            value={selectedLeaderPort}
                            options={armPortOptions}
                            onChange={handleLeaderPortChange}
                          />
                        </FieldRow>
                      </>
                    ) : (
                      <>
                        {["Left Follower", "Right Follower", "Left Leader", "Right Leader"].map((label) => (
                          <FieldRow key={label} label={label}>
                            <WireSelect
                              placeholder={armPortOptions.length === 0 ? "No ports detected" : `${label} Port`}
                              options={armPortOptions}
                            />
                          </FieldRow>
                        ))}
                      </>
                    )}
                    </div>
                  </div>

                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex flex-col gap-2">
                    <p className="text-sm text-zinc-400">Select calibration profile.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                    {mode === "Single Arm" ? (
                      <>
                        <FieldRow label="Follower ID">
                          <WireSelect
                            placeholder={followerIdOptions.length === 0 ? "No calibration files" : undefined}
                            value={selectedFollowerId}
                            options={followerIdOptions}
                            onChange={handleFollowerIdChange}
                          />
                        </FieldRow>
                        <FieldRow label="Leader ID">
                          <WireSelect
                            placeholder={leaderIdOptions.length === 0 ? "No calibration files" : undefined}
                            value={selectedLeaderId}
                            options={leaderIdOptions}
                            onChange={handleLeaderIdChange}
                          />
                        </FieldRow>
                      </>
                    ) : (
                      <FieldRow label="Robot ID">
                        <WireSelect
                          placeholder={bimanualIdOptions.length === 0 ? "No calibration files" : undefined}
                          value={selectedBimanualId}
                          options={bimanualIdOptions}
                          onChange={setSelectedBimanualId}
                        />
                      </FieldRow>
                    )}
                    </div>
                  </div>

                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex flex-col gap-2">
                    <p className="text-sm text-zinc-400">Verbose runtime telemetry overlays the latest leader/current/goal joint values while Teleop is running.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                      <FieldRow label="Verbose Debug Overlay">
                        <WireSelect
                          value={debugEnabled ? "On" : "Off"}
                          options={["Off", "On"]}
                          onChange={(value) => {
                            persistConfigPatch({ teleop_debug_enabled: value === "On" });
                          }}
                        />
                      </FieldRow>
                    </div>
                  </div>

                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex flex-col gap-2">
                    <p className="text-sm text-zinc-400">Optional joint-direction overrides applied only in Teleop action mapping.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                      <FieldRow label="Invert Shoulder Lift">
                        <WireSelect
                          value={invertShoulderLift ? "On" : "Off"}
                          options={["Off", "On"]}
                          onChange={(value) => {
                            persistConfigPatch({ teleop_invert_shoulder_lift: value === "On" });
                          }}
                        />
                      </FieldRow>
                      <FieldRow label="Invert Wrist Roll">
                        <WireSelect
                          value={invertWristRoll ? "On" : "Off"}
                          options={["Off", "On"]}
                          onChange={(value) => {
                            persistConfigPatch({ teleop_invert_wrist_roll: value === "On" });
                          }}
                        />
                      </FieldRow>
                    </div>
                  </div>

                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex flex-col gap-2">
                    <p className="text-sm text-zinc-400">
                      {antiJitterAvailable
                        ? "Optional filtering inserted between leader reads and follower commands."
                        : "Anti-jitter plugin is unavailable, so these controls are disabled."}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                      <FieldRow label="Anti-Jitter">
                        <WireSelect
                          value={antiJitterAvailable && antiJitterEnabled ? "On" : "Off"}
                          options={["Off", "On"]}
                          onChange={(value) => {
                            if (!antiJitterAvailable) return;
                            persistConfigPatch({ teleop_antijitter_enabled: value === "On" });
                          }}
                        />
                      </FieldRow>
                      <FieldRow label="EMA Alpha">
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step="0.05"
                          value={antiJitterAlpha}
                          disabled={!antiJitterAvailable}
                          onChange={(event) => {
                            if (!antiJitterAvailable) return;
                            const next = Number(event.target.value);
                            if (Number.isFinite(next)) {
                              persistConfigPatch({ teleop_antijitter_alpha: next });
                            }
                          }}
                          className="w-full h-9 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200 text-sm outline-none hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 transition-all"
                        />
                      </FieldRow>
                      <FieldRow label="Deadband (deg)">
                        <input
                          type="number"
                          min={0}
                          step="0.05"
                          value={antiJitterDeadband}
                          disabled={!antiJitterAvailable}
                          onChange={(event) => {
                            if (!antiJitterAvailable) return;
                            const next = Number(event.target.value);
                            if (Number.isFinite(next)) {
                              persistConfigPatch({ teleop_antijitter_deadband: next });
                            }
                          }}
                          className="w-full h-9 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200 text-sm outline-none hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 transition-all"
                        />
                      </FieldRow>
                      <FieldRow label="Max Step (opt)">
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          value={antiJitterMaxStep}
                          disabled={!antiJitterAvailable}
                          placeholder="Disabled"
                          onChange={(event) => {
                            if (!antiJitterAvailable) return;
                            const raw = event.target.value;
                            if (!raw.trim()) {
                              persistConfigPatch({ teleop_antijitter_max_step: "" });
                              return;
                            }
                            const next = Number(raw);
                            if (Number.isFinite(next)) {
                              persistConfigPatch({ teleop_antijitter_max_step: next });
                            }
                          }}
                          className="w-full h-9 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200 text-sm outline-none placeholder:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 transition-all"
                        />
                      </FieldRow>
                    </div>
                  </div>
                </div>
                </div>
              )}

              {teleopTab === "motor" && debugTelemetryPanel}

              {/* Camera Setting Tab — settings above, preview below */}
              {teleopTab === "camera" && (
                <div className="flex flex-col gap-4">
                  {/* Camera settings — full width */}
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800">
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Camera feed settings</span>
                    </div>
                    <div className="px-4 py-4 flex flex-col gap-3">
                      {camerasMapped.length === 0 ? (
                        <EmptyState
                          icon={<Camera size={28} />}
                          message={
                            <>
                              No camera mappings. First connect cameras in the{" "}
                              <a href="/camera-setup" className="underline hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Camera Setup</a> tab.
                            </>
                          }
                          messageClassName="max-w-none"
                        />
                      ) : camerasMapped.map((cam) => (
                        <div key={cam.role} className="flex items-center gap-2 px-2 py-1.5 rounded border border-zinc-100 dark:border-zinc-800/50">
                          <span className="size-1.5 rounded-full bg-emerald-400 flex-none" />
                          <span className="text-sm text-zinc-600 dark:text-zinc-300 font-mono">{cam.role}</span>
                          <span className="text-sm text-zinc-400 ml-auto font-mono truncate">{cam.path}</span>
                        </div>
                      ))}

                      {/* Advanced stream settings */}
                      <button
                        onClick={() => setAdvStreamOpen(!advStreamOpen)}
                        className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-600 cursor-pointer"
                      >
                        Advanced stream settings
                        {advStreamOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>

                      {advStreamOpen && (
                        <div className="flex flex-col gap-2 pl-2 border-l-2 border-zinc-100 dark:border-zinc-800">
                          <FieldRow label="Codec">
                            <WireSelect value="MJPG" options={["MJPG", "YUYV"]} />
                          </FieldRow>
                          <FieldRow label="Resolution">
                            <WireSelect value="640×480" options={["1280×720", "800×600", "640×480", "320×240"]} />
                          </FieldRow>
                          <FieldRow label="FPS">
                            <WireSelect value="30" options={["15", "30", "60"]} />
                          </FieldRow>
                          <FieldRow label="JPEG Quality">
                            <input type="range" min={30} max={95} defaultValue={75} className="w-full h-1.5 accent-zinc-500 cursor-pointer" />
                          </FieldRow>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Camera feed previews — compact thumbnails */}
                  <div className={cn(
                    "grid gap-2",
                    camerasMapped.length === 1
                      ? "grid-cols-1"
                      : camerasMapped.length === 2
                        ? "grid-cols-2"
                        : camerasMapped.length === 3
                          ? "grid-cols-3"
                          : "grid-cols-4",
                  )}>
                    {camerasMapped.map((cam) => {
                      const frameSrc = cameraFrames[cam.role];
                      return (
                        <div key={cam.role} className="relative rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                          <div className="aspect-video bg-zinc-200 dark:bg-zinc-900">
                            {frameSrc ? (
                              <img src={frameSrc} alt={`${cam.role} preview`} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <span className="text-sm text-zinc-600">Waiting...</span>
                              </div>
                            )}
                          </div>
                          <div className="px-2 py-1.5 bg-zinc-50 dark:bg-zinc-900">
                            <div className="text-sm text-zinc-600 dark:text-zinc-300">{cam.role}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── LOADING: Step-by-step feedback ─── */}
          {phase === "loading" && (
            <div className="flex-1 flex flex-col items-center justify-center py-16 gap-6">
              <Loader2 size={32} className="text-zinc-400 animate-spin" />
              <div className="flex flex-col gap-2">
                {LOADING_STEPS.map((step, i) => {
                  const isActive = i === loadingStep - 1;
                  const isWaiting = isActive && loadingWaitingInput && !!step.waitPattern;
                  return (
                    <div key={step.label} className="flex items-center gap-2.5">
                      {i < loadingStep ? (
                        isWaiting ? (
                          <div className="size-3.5 rounded-full bg-amber-500 flex-none animate-pulse" />
                        ) : (
                          <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 flex-none" />
                        )
                      ) : i === loadingStep ? (
                        <Loader2 size={14} className="text-zinc-400 animate-spin flex-none" />
                      ) : (
                        <div className="size-3.5 rounded-full border border-zinc-600 flex-none" />
                      )}
                      <span className={cn("text-sm",
                        isWaiting ? "text-amber-600 dark:text-amber-400 font-medium" :
                        i < loadingStep ? "text-zinc-400" :
                        i === loadingStep ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-600"
                      )}>
                        {isWaiting ? "Waiting for calibration — press ENTER in console ↓" : step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── RUNNING: Camera feed focus ─── */}
          {phase === "running" && teleopReconnected && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/5 text-sm text-blue-600 dark:text-blue-400">
              <span className="flex-none">⚡</span>
              <span>Reconnected — This teleop session was recovered from a previous server session. You can still stop the process.</span>
            </div>
          )}
          {phase === "running" && (
            <div className="flex flex-col gap-4">
              {/* Camera feeds — full width */}
              <div className={[
                "grid gap-3",
                camerasMapped.length === 1
                  ? "grid-cols-1"
                  : camerasMapped.length === 2
                    ? "grid-cols-2"
                    : camerasMapped.length === 3
                      ? "grid-cols-3"
                      : "grid-cols-4",
              ].join(" ")}>
                {camerasMapped.map((cam) => {
                  const frameSrc = cameraFrames[cam.role];
                  return (
                    <div key={cam.role} className="relative rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                      <div className="aspect-video bg-zinc-200 dark:bg-zinc-900 relative">
                        {!pausedFeeds[cam.role] ? (
                          frameSrc ? (
                            <img src={frameSrc} alt={`${cam.role} stream`} className="absolute inset-0 h-full w-full object-cover" />
                          ) : (
                            <WireBox
                              className="absolute inset-0 border-0 rounded-none"
                              label={`MJPEG stream — ${cam.role}`}
                            />
                          )
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
                            <span className="text-sm flex items-center gap-1"><Pause size={10} className="fill-current" /> Paused</span>
                          </div>
                        )}

                        {/* Overlays */}
                        <div className="absolute top-2 left-2">
                          <span className="px-1.5 py-0.5 rounded bg-red-500/80 text-white text-sm font-mono">LIVE</span>
                        </div>
                        <button
                          onClick={() => toggleFeed(cam.role)}
                          className="absolute top-2 right-2 p-1.5 rounded bg-black/50 text-white cursor-pointer hover:bg-black/70 transition-colors"
                        >
                          {pausedFeeds[cam.role]
                            ? <Play size={10} className="fill-current" />
                            : <Pause size={10} className="fill-current" />}
                        </button>
                      </div>
                      <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-900">
                        <div className="text-sm text-zinc-600 dark:text-zinc-300">{cam.role}</div>
                        <div className="text-sm text-zinc-400 font-mono">{cam.path}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Session info */}
              <div className="flex items-center gap-2 px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                <span className="text-sm text-zinc-500">
                  {mode} · {speed} · {antiJitterAvailable
                    ? (antiJitterEnabled ? `anti-jitter a=${antiJitterAlpha} d=${antiJitterDeadband}` : "anti-jitter off")
                    : "anti-jitter unavailable"} · {debugEnabled ? "debug on" : "debug off"} · {camerasMapped.length} cams
                </span>
              </div>

              {debugTelemetryPanel}
            </div>
          )}
        </div>
      </div>

      {/* Sticky control bar */}
      <StickyControlBar>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <StatusBadge
              status={running ? "running" : phase === "loading" ? "loading" : "ready"}
              label={running ? "TELEOP ACTIVE" : phase === "loading" ? "STARTING..." : "READY"}
              pulse={running}
            />
            <span className="text-sm text-zinc-400">
              {running
                ? `${mode} · ${speed}`
                : phase === "loading"
                  ? "Starting teleop…"
                  : "Teleop ready"}
            </span>
          </div>

          {(phase === "idle" || phase === "running") && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400 whitespace-nowrap">Speed:</span>
              <WireSelect
                value={speed}
                options={["0.1x", "0.25x", "0.5x", "0.75x", "1.0x"]}
                onChange={setSpeed}
                className="h-7 py-0"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <ProcessButtons
            running={phase !== "idle"}
            onStart={() => { void handleStart(); }}
            onStop={() => { void handleStop(); }}
            startLabel={<><Play size={13} className="fill-current" /> Start Teleop</>}
            disabled={actionPending}
            compact
            buttonClassName="py-1"
          />
        </div>
      </StickyControlBar>
    </div>
  );
}
