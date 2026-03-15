import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { apiGet, apiPost } from "../services/apiClient";
import { MotorMappingGate } from "../components/MotorMappingGate";
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
  PageHeader, ModeToggle, SubTabs,
  BlockerCard, RefreshButton,
} from "../components/wireframe";
import {
  buildMappedArmLists,
  defaultArmSelection,
  resolveArmConfig,
  type MappedArmLists,
  type ArmSelection,
  type ResolvedArmConfig,
} from "../services/armSets";
import { toVideoName, useCameraFeeds } from "../hooks/useCameraFeeds";
import {
  type CalibFile,
  type MappedCamera,
  type TeleopDebugJointRow,
  type TeleopDebugMeta,
  type TeleopDebugSnapshot,
  type TeleopPhase,
} from "./Teleop/shared";
import { TeleopLoadingView } from "./Teleop/components/TeleopLoadingView";
import { TeleopMotorSettingsPanel } from "./Teleop/components/TeleopMotorSettingsPanel";
import { TeleopCameraSettingsPanel } from "./Teleop/components/TeleopCameraSettingsPanel";
import { TeleopDebugTelemetryPanel } from "./Teleop/components/TeleopDebugTelemetryPanel";
import { TeleopRunningView } from "./Teleop/components/TeleopRunningView";
import { TeleopControlBar } from "./Teleop/components/TeleopControlBar";

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
  const [motorTuningOpen, setMotorTuningOpen] = useState(false);
  const [teleopTab, setTeleopTab] = useState("motor");
  const [startAccepted, setStartAccepted] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const lastErrorAtRef = useRef(0);
  const prevRunningRef = useRef(false);
  const [camerasMapped, setCamerasMapped] = useState<MappedCamera[]>([]);
  const [enabledCameras, setEnabledCameras] = useState<Set<string>>(new Set());
  const [calibFiles, setCalibFiles] = useState<CalibFile[]>([]);
  const [armLists, setArmLists] = useState<MappedArmLists>({ followers: [], leaders: [] });
  const [armSelection, setArmSelection] = useState<ArmSelection>({ follower: "", leader: "" });
  const [selectedFollowerPort, setSelectedFollowerPort] = useState("");
  const [selectedLeaderPort, setSelectedLeaderPort] = useState("");
  const [selectedLeftFollowerPort, setSelectedLeftFollowerPort] = useState("");
  const [selectedRightFollowerPort, setSelectedRightFollowerPort] = useState("");
  const [selectedLeftLeaderPort, setSelectedLeftLeaderPort] = useState("");
  const [selectedRightLeaderPort, setSelectedRightLeaderPort] = useState("");
  const [selectedFollowerId, setSelectedFollowerId] = useState("");
  const [selectedLeaderId, setSelectedLeaderId] = useState("");
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
    left_follower_port: selectedLeftFollowerPort || configRecord.left_follower_port,
    right_follower_port: selectedRightFollowerPort || configRecord.right_follower_port,
    left_leader_port: selectedLeftLeaderPort || configRecord.left_leader_port,
    right_leader_port: selectedRightLeaderPort || configRecord.right_leader_port,
    robot_id: selectedFollowerId || configRecord.robot_id,
    teleop_id: selectedLeaderId || configRecord.teleop_id,
    left_robot_id: configRecord.left_robot_id,
    right_robot_id: configRecord.right_robot_id,
    left_teleop_id: configRecord.left_teleop_id,
    right_teleop_id: configRecord.right_teleop_id,
  }), [config, configRecord.follower_port, configRecord.leader_port, configRecord.left_follower_port, configRecord.right_follower_port, configRecord.left_leader_port, configRecord.right_leader_port, configRecord.robot_id, configRecord.teleop_id, configRecord.left_robot_id, configRecord.right_robot_id, configRecord.left_teleop_id, configRecord.right_teleop_id, selectedFollowerId, selectedFollowerPort, selectedLeaderId, selectedLeaderPort, selectedLeftFollowerPort, selectedRightFollowerPort, selectedLeftLeaderPort, selectedRightLeaderPort]);
  const selectedCameras = useMemo(
    () => camerasMapped.filter((cam: MappedCamera) => enabledCameras.has(cam.role)),
    [camerasMapped, enabledCameras],
  );
  const feedTargets = useMemo(
    () => selectedCameras.map((cam: MappedCamera) => ({ id: cam.role, videoName: toVideoName(cam.path) })),
    [selectedCameras],
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
      .map((key): TeleopDebugJointRow => ({
        key,
        leader: debugSnapshot.leader_raw_pos[key],
        current: debugSnapshot.follower_current_pos[key],
        mapped: debugSnapshot.teleop_action_pos[key],
        goal: debugSnapshot.follower_goal_pos[key],
        error: debugSnapshot.goal_minus_current_pos[key],
      }));
  }, [debugSnapshot]);
  const debugAgeMs = debugSnapshot ? Math.max(0, Date.now() - debugSnapshot.emitted_at_ms) : null;
  const toggleFeed = (role: string) =>
    setPausedFeeds((prev) => ({ ...prev, [role]: !prev[role] }));

  const toggleCamera = (role: string) => {
    setEnabledCameras((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const persistConfigPatch = useCallback((patch: Record<string, unknown>) => {
    updateConfig(patch);
    void apiPost<Record<string, unknown>>("/api/config", patch).catch(() => undefined);
  }, [updateConfig]);

  const handleArmSetConfigResolved = useCallback((resolved: ResolvedArmConfig) => {
    setSelectedFollowerPort(resolved.followerPort);
    setSelectedLeaderPort(resolved.leaderPort);
    setSelectedLeftFollowerPort(resolved.leftFollowerPort);
    setSelectedRightFollowerPort(resolved.rightFollowerPort);
    setSelectedLeftLeaderPort(resolved.leftLeaderPort);
    setSelectedRightLeaderPort(resolved.rightLeaderPort);
    setSelectedFollowerId(resolved.followerId);
    setSelectedLeaderId(resolved.leaderId);
    persistConfigPatch({
      robot_type: resolved.robotType,
      teleop_type: resolved.teleopType,
      follower_port: resolved.followerPort,
      leader_port: resolved.leaderPort,
      robot_id: resolved.followerId,
      teleop_id: resolved.leaderId,
      left_follower_port: resolved.leftFollowerPort,
      right_follower_port: resolved.rightFollowerPort,
      left_leader_port: resolved.leftLeaderPort,
      right_leader_port: resolved.rightLeaderPort,
      left_robot_id: resolved.leftRobotId,
      right_robot_id: resolved.rightRobotId,
      left_teleop_id: resolved.leftTeleopId,
      right_teleop_id: resolved.rightTeleopId,
    });
  }, [persistConfigPatch]);

  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

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
        cameras: selectedCameras,
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
  }, [phase, teleopRunningOnBackend]);

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
      setEnabledCameras(new Set(mapped.map((cam) => cam.role)));

      const rawPorts = Array.from(
        new Set(
          (devResult.arms ?? [])
            .map((arm) => (arm.symlink ? `/dev/${arm.symlink}` : arm.path))
            .filter((value): value is string => Boolean(value))
        )
      );
      const defaultFollower = rawPorts.find((p) => /follower/i.test(p)) ?? rawPorts[0] ?? "";
      const defaultLeader = rawPorts.find((p) => /leader/i.test(p)) ?? rawPorts[1] ?? rawPorts[0] ?? "";
      const defaultLeftFollower = rawPorts.find((p) => /follower.*(?:1|left)/i.test(p)) ?? defaultFollower;
      const defaultRightFollower = rawPorts.find((p) => /follower.*(?:2|right)/i.test(p)) ?? rawPorts[1] ?? defaultFollower;
      const defaultLeftLeader = rawPorts.find((p) => /leader.*(?:1|left)/i.test(p)) ?? defaultLeader;
      const defaultRightLeader = rawPorts.find((p) => /leader.*(?:2|right)/i.test(p)) ?? rawPorts[1] ?? defaultLeader;
      setSelectedFollowerPort((prev) => (prev && rawPorts.includes(prev) ? prev : defaultFollower));
      setSelectedLeaderPort((prev) => (prev && rawPorts.includes(prev) ? prev : defaultLeader));
      setSelectedLeftFollowerPort((prev) => (prev && rawPorts.includes(prev) ? prev : defaultLeftFollower));
      setSelectedRightFollowerPort((prev) => (prev && rawPorts.includes(prev) ? prev : defaultRightFollower));
      setSelectedLeftLeaderPort((prev) => (prev && rawPorts.includes(prev) ? prev : defaultLeftLeader));
      setSelectedRightLeaderPort((prev) => (prev && rawPorts.includes(prev) ? prev : defaultRightLeader));

      const calibResult = await apiGet<{ files?: CalibFile[] }>("/api/calibrate/list");
      const files = calibResult.files ?? [];
      setCalibFiles(files);

      const lists = buildMappedArmLists(devResult.arms ?? [], files);
      setArmLists(lists);
      const currentMode = modeRef.current as "Single Arm" | "Bi-Arm";
      const sel = defaultArmSelection(lists, currentMode);
      setArmSelection(sel);
      const resolved = resolveArmConfig(currentMode, sel, lists, files);
      handleArmSetConfigResolved(resolved);

    };
    void run();
  }, [refreshKey, handleArmSetConfigResolved]);

  useEffect(() => {
    if (armLists.followers.length === 0 && armLists.leaders.length === 0) return;
    const sel = defaultArmSelection(armLists, mode as "Single Arm" | "Bi-Arm");
    setArmSelection(sel);
    const resolved = resolveArmConfig(mode as "Single Arm" | "Bi-Arm", sel, armLists, calibFiles);
    handleArmSetConfigResolved(resolved);
  }, [mode, armLists, calibFiles, handleArmSetConfigResolved]);

  useEffect(() => {
    if (!flowError) return;
    lastErrorAtRef.current = Date.now();
  }, [flowError]);

  const flowResetKey = useMemo(
    () => JSON.stringify([
      selectedFollowerPort,
      selectedLeaderPort,
      selectedLeftFollowerPort,
      selectedRightFollowerPort,
      selectedLeftLeaderPort,
      selectedRightLeaderPort,
      selectedFollowerId,
      selectedLeaderId,
      configRecord.left_robot_id,
      configRecord.right_robot_id,
      configRecord.left_teleop_id,
      configRecord.right_teleop_id,
    ]),
    [
      selectedFollowerPort,
      selectedLeaderPort,
      selectedLeftFollowerPort,
      selectedRightFollowerPort,
      selectedLeftLeaderPort,
      selectedRightLeaderPort,
      selectedFollowerId,
      selectedLeaderId,
      configRecord.left_robot_id,
      configRecord.right_robot_id,
      configRecord.left_teleop_id,
      configRecord.right_teleop_id,
    ],
  );
  const flowResetKeyRef = useRef(flowResetKey);

  useEffect(() => {
    if (!flowError) {
      flowResetKeyRef.current = flowResetKey;
      return;
    }
    if (flowResetKeyRef.current !== flowResetKey) {
      flowResetKeyRef.current = flowResetKey;
      setFlowError(null);
    }
  }, [flowError, flowResetKey]);

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
      <MotorMappingGate>
      <div className="flex-1 overflow-y-auto">
        <section aria-label="Teleoperation" className="p-6 flex flex-col gap-4 max-w-[1600px] mx-auto w-full">
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
                <TeleopMotorSettingsPanel
                  mode={mode as "Single Arm" | "Bi-Arm"}
                  armLists={armLists}
                  calibFiles={calibFiles}
                  armSelection={armSelection}
                  onArmSelectionChange={setArmSelection}
                  onArmConfigResolved={handleArmSetConfigResolved}
                  phase={phase}
                  debugEnabled={debugEnabled}
                  onPersistConfigPatch={persistConfigPatch}
                  motorTuningOpen={motorTuningOpen}
                  onToggleMotorTuning={() => setMotorTuningOpen(!motorTuningOpen)}
                  invertShoulderLift={invertShoulderLift}
                  invertWristRoll={invertWristRoll}
                  antiJitterAvailable={antiJitterAvailable}
                  antiJitterEnabled={antiJitterEnabled}
                  antiJitterAlpha={antiJitterAlpha}
                  antiJitterDeadband={antiJitterDeadband}
                  antiJitterMaxStep={antiJitterMaxStep}
                />
              )}


              {/* Camera Setting Tab — settings above, preview below */}
              {teleopTab === "camera" && (
                <TeleopCameraSettingsPanel
                  camerasMapped={camerasMapped}
                  enabledCameras={enabledCameras}
                  onToggleCamera={toggleCamera}
                  advStreamOpen={advStreamOpen}
                  onToggleAdvancedStream={() => setAdvStreamOpen(!advStreamOpen)}
                  selectedCameras={selectedCameras}
                  cameraFrames={cameraFrames}
                />
              )}
            </div>
          )}

          {/* ─── LOADING: Step-by-step feedback ─── */}
          {phase === "loading" && (
            <TeleopLoadingView
              loadingStep={loadingStep}
              loadingWaitingInput={loadingWaitingInput}
              steps={LOADING_STEPS}
            />
          )}

          {/* ─── RUNNING: Camera feed focus ─── */}
          {phase === "running" && (
            <TeleopRunningView
              teleopReconnected={teleopReconnected}
              selectedCameras={selectedCameras}
              cameraFrames={cameraFrames}
              pausedFeeds={pausedFeeds}
              onToggleFeed={toggleFeed}
              mode={mode}
              speed={speed}
              antiJitterAvailable={antiJitterAvailable}
              antiJitterEnabled={antiJitterEnabled}
              antiJitterAlpha={antiJitterAlpha}
              antiJitterDeadband={antiJitterDeadband}
              debugEnabled={debugEnabled}
              camerasMappedCount={camerasMapped.length}
              debugTelemetry={(
                <TeleopDebugTelemetryPanel
                  debugEnabled={debugEnabled}
                  debugMeta={debugMeta}
                  debugSnapshot={debugSnapshot}
                  debugJointRows={debugJointRows}
                  debugAgeMs={debugAgeMs}
                  wsReady={wsReady}
                  loopMetrics={loopMetrics}
                  selectedFollowerPort={selectedFollowerPort}
                  selectedLeaderPort={selectedLeaderPort}
                  selectedFollowerId={selectedFollowerId}
                  selectedLeaderId={selectedLeaderId}
                  selectedCamerasCount={selectedCameras.length}
                  camerasMappedCount={camerasMapped.length}
                  invertShoulderLift={invertShoulderLift}
                  invertWristRoll={invertWristRoll}
                  antiJitterEnabled={antiJitterEnabled}
                  antiJitterAlpha={antiJitterAlpha}
                  antiJitterDeadband={antiJitterDeadband}
                  teleopLogsCount={teleopLogs.length}
                  running={running}
                />
              )}
            />
          )}
        </section>
      </div>

      <TeleopControlBar
        running={running}
        phase={phase}
        mode={mode}
        speed={speed}
        onSpeedChange={setSpeed}
        onStart={() => { void handleStart(); }}
        onStop={() => { void handleStop(); }}
        actionPending={actionPending}
        hasMappedArms={armLists.followers.length > 0 || armLists.leaders.length > 0}
      />
      </MotorMappingGate>
    </div>
  );
}
