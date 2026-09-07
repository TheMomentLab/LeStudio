import { useState, useEffect, useCallback } from "react";
import { cn } from "../components/ui/utils";
import { Camera, Bot, Cpu, Eraser, AlertCircle, AlertTriangle, CheckCircle2, Link as LinkIcon, History, Shield } from "lucide-react";
import {
  Card, PageHeader, ResourceBar, EmptyState, RefreshButton,
} from "../components/wireframe";
import { symToDisplayLabel } from "../services/portLabels";
import { apiGet, apiPost } from "../services/apiClient";
import {
  fromBackendHistory,
  fromBackendResources,
  type HistoryCategory,
  type UiHistoryEntry,
  type UiResourcesData,
} from "../services/contracts";
import { useHfAuth } from "../hf-auth-context";

// ─── Types ────────────────────────────────────────────────────────────────────
type CameraDevice = { device: string; symlink: string | null; path: string; kernels?: string; model?: string };
type ArmDevice = { device: string; symlink: string | null; path: string; serial?: string };

type GpuStatusResponse = { exists: boolean; utilization: number; memory_used: number; memory_total: number; memory_percent: number; };

type RuleItem = { kernel?: string; symlink?: string; mode?: string; exists?: boolean; };

// "Cameras (2 of 3 mapped)" — the count a user can actually use, not just what is plugged in.
function deviceCountLabel(noun: string, devices: Array<{ symlink: string | null }>) {
  if (devices.length === 0) return `${noun} (0)`;
  const mapped = devices.filter((d) => d.symlink).length;
  return mapped === devices.length ? `${noun} (${devices.length})` : `${noun} (${mapped} of ${devices.length} mapped)`;
}

function UnmappedChip() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded border border-line-control bg-surface-sunken text-xs text-fg-muted flex-none">
      unmapped
    </span>
  );
}
type RulesCurrentResponse = {
  camera_rules?: RuleItem[];
  arm_rules?: RuleItem[];
};

export function SystemStatus() {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [arms, setArms] = useState<ArmDevice[]>([]);
  const [resources, setResources] = useState<UiResourcesData | null>(null);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [historyItems, setHistoryItems] = useState<UiHistoryEntry[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<Set<number>>(new Set());
  const [gpuStatus, setGpuStatus] = useState<GpuStatusResponse | null>(null);
  const [udevRules, setUdevRules] = useState<RuleItem[]>([]);
  const { hfAuth } = useHfAuth();

  const refreshStatus = useCallback(() => {
    apiGet<{ cameras: CameraDevice[]; arms: ArmDevice[] }>("/api/devices").then((res) => {
      setCameras(res.cameras ?? []);
      setArms(res.arms ?? []);
    });
    setResourcesLoading(true);
    apiGet<unknown>("/api/system/resources")
      .then((res) => setResources(fromBackendResources(res)))
      .catch(() => setResources(null))
      .finally(() => setResourcesLoading(false));
    apiGet<unknown>("/api/history").then((res) => setHistoryItems(fromBackendHistory(res)));
    apiGet<GpuStatusResponse>("/api/gpu/status").then((res) => { if (res.exists) setGpuStatus(res); }).catch(() => {});
    // udev rules
    apiGet<RulesCurrentResponse>("/api/udev/rules")
      .catch(() => apiGet<RulesCurrentResponse>("/api/rules/current"))
      .then((res) => {
        const cameraRules = Array.isArray(res.camera_rules) ? res.camera_rules : [];
        const armRules = Array.isArray(res.arm_rules) ? res.arm_rules : [];
        setUdevRules([...cameraRules, ...armRules]);
      })
      .catch(() => {});

  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshStatus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshStatus]);


  const handleClearHistory = () => {
    apiPost("/api/history/clear").then(() => setHistoryItems([]));
  };

  const handleRefresh = () => {
    refreshStatus();
  };


  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <section aria-label="System status dashboard" className="p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 max-w-[1600px] mx-auto w-full">
          <PageHeader
            title="Status"
            subtitle="Hardware and system readiness dashboard"
            action={<RefreshButton onClick={handleRefresh} />}
          />

          {/* Prerequisites — HF token + udev rules */}
          <Card title="Prerequisites" icon={<Shield size={13} />} className="overflow-hidden" bodyClassName="p-0">
            <div className="divide-y divide-line-subtle border-b border-line-subtle">
              {/* HF Token */}
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-fg-body">Hugging Face Token</div>
                  <div className="text-xs text-fg-muted">
                    {hfAuth === "ready" ? "Authenticated — push/pull enabled" : "Required for dataset upload and model download"}
                  </div>
                </div>
                {hfAuth === "ready"
                  ? <CheckCircle2 size={18} className="text-ok flex-none" />
                  : <AlertTriangle size={16} className="text-warn flex-none" />
                }
              </div>
              {/* udev Rules */}
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-fg-body">Device Mapping</div>
                  <div className="text-xs text-fg-muted">
                    {udevRules.length > 0
                      ? `${udevRules.length} device${udevRules.length !== 1 ? "s" : ""} mapped — stable symlinks active`
                      : "No devices mapped yet — configure in Motor Setup or Camera Setup"
                    }
                  </div>
                </div>
                {udevRules.length > 0
                  ? <CheckCircle2 size={18} className="text-ok flex-none" />
                  : <AlertTriangle size={16} className="text-warn flex-none" />
                }
              </div>
            </div>
          </Card>

          {/* Cameras + Arms — 2-column list */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cameras */}
            <Card title={deviceCountLabel("Cameras", cameras)} icon={<Camera size={13} />} className="overflow-hidden" bodyClassName="p-0">
              {cameras.length === 0 ? (
                <div className="p-3 flex flex-col gap-3 flex-1 justify-start">
                  <EmptyState
                    icon={<Camera size={28} />}
                    message="No cameras connected."
                    messageClassName="max-w-none whitespace-nowrap"
                  />
                </div>
              ) : (
                <div className="divide-y divide-line-subtle border-b border-line-subtle">
                  {[...cameras].sort((a, b) => (b.symlink ? 1 : 0) - (a.symlink ? 1 : 0)).map((cam) => (
                    <div key={cam.device} className="flex items-center gap-2 sm:gap-3 px-3 py-1.5 sm:py-2">
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm truncate", cam.symlink ? "text-fg-body" : "text-fg-disabled")}>{cam.symlink ?? cam.device}</div>
                        <div className={cn("text-sm truncate", cam.symlink ? "text-fg-muted" : "text-fg-disabled")}>{cam.path}{cam.model ? ` · ${cam.model}` : ""}</div>
                      </div>
                      {cam.symlink ? <LinkIcon size={16} className="text-fg-muted flex-none" /> : <UnmappedChip />}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Arms */}
            <Card title={deviceCountLabel("Arms", arms)} icon={<Bot size={13} />} className="overflow-hidden" bodyClassName="p-0">
              {arms.length === 0 ? (
                <div className="p-3 flex flex-col gap-3 flex-1 justify-start">
                  <EmptyState
                    icon={<Bot size={28} />}
                    message="No arms connected."
                    messageClassName="max-w-none whitespace-nowrap"
                  />
                </div>
              ) : (
                <div className="divide-y divide-line-subtle border-b border-line-subtle">
                  {[...arms].sort((a, b) => (b.symlink ? 1 : 0) - (a.symlink ? 1 : 0)).map((arm) => (
                    <div key={arm.device} className="flex items-center gap-2 sm:gap-3 px-3 py-1.5 sm:py-2">
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm truncate", arm.symlink ? "text-fg-body" : "text-fg-disabled")}>{arm.symlink ? symToDisplayLabel(arm.symlink) : arm.device}</div>
                        <div className={cn("text-sm truncate", arm.symlink ? "text-fg-muted" : "text-fg-disabled")}>{arm.path}{arm.serial ? ` · S/N: ${arm.serial}` : ""}</div>
                      </div>
                      {arm.symlink ? <LinkIcon size={16} className="text-fg-muted flex-none" /> : <UnmappedChip />}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* System Resources + Session History — 2-column */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* System Resources */}
            <Card title="System Resources" icon={<Cpu size={13} />} className="overflow-hidden" bodyClassName="p-3 flex flex-col gap-3 justify-start">
                {resourcesLoading ? (
                  <div className="text-sm text-fg-muted py-2">Loading...</div>
                ) : resources === null ? (
                  <EmptyState
                    icon={<AlertCircle size={28} />}
                    message="Unable to fetch resource information."
                    messageClassName="max-w-none whitespace-nowrap"
                  />
                ) : (
                  <>
                    <ResourceBar label="CPU" value={resources.cpu_percent} max={100} />
                    <ResourceBar label="RAM" value={resources.ram_used} max={resources.ram_total ?? 32} unit="GB" />
                    <ResourceBar label="Disk (home)" value={resources.disk_used} max={resources.disk_total ?? 512} unit="GB" />
                    {gpuStatus && (
                      <>
                        <ResourceBar label="GPU" value={gpuStatus.utilization} max={100} />
                        <ResourceBar label="VRAM" value={Math.round(gpuStatus.memory_used / 1024 * 10) / 10} max={Math.round(gpuStatus.memory_total / 1024 * 10) / 10} unit="GB" />
                      </>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-fg-muted w-24 flex-none">LeRobot Cache</span>
                      <div className="flex-1" />
                      <span className="text-sm text-fg-muted w-20 text-right flex-none">{resources.cache_size} GB</span>
                    </div>
                  </>
                )}
            </Card>

            {/* Session History */}
            <Card
              title={`Session History (${historyItems.length})`}
              icon={<History size={13} />}
              className="overflow-hidden"
              bodyClassName="p-0"
              action={historyItems.length > 0 ? (
                <button
                  onClick={handleClearHistory}
                  className="text-fg-muted hover:text-danger transition-colors cursor-pointer"
                  aria-label="Clear session history"
                >
                  <Eraser size={11} />
                </button>
              ) : undefined}
            >
              {historyItems.length > 0 ? (
                  <div className="divide-y divide-line-subtle border-b border-line-subtle overflow-y-auto max-h-[200px]">
                    {historyItems.map((h, i) => (
                      <HistoryRow
                        key={i}
                        entry={h}
                        expanded={expandedHistory.has(i)}
                        onToggle={() => {
                          setExpandedHistory((prev) => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i); else next.add(i);
                            return next;
                          });
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="p-3">
                    <EmptyState
                      icon={<History size={28} />}
                      message="No history."
                      messageClassName="max-w-none whitespace-nowrap"
                    />
                  </div>
                )
              }
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── History Row ─────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<HistoryCategory, string> = {
  eval: "bg-category-1",
  train: "bg-category-2",
  teleop: "bg-category-3",
  record: "bg-category-4",
  motor: "bg-category-5",
  other: "bg-category-5",
};

const CATEGORY_LABELS: Record<HistoryCategory, string> = {
  eval: "Eval",
  train: "Train",
  teleop: "Teleop",
  record: "Record",
  motor: "Motor",
  other: "Event",
};

function formatTimeShort(ts: string): string {
  const match = ts.match(/T?(\d{2}:\d{2})/);
  return match ? match[1] : ts;
}

function HistoryRow({ entry, expanded, onToggle }: {
  entry: UiHistoryEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isEnd = entry.type.endsWith("_end");
  const hasDetail = entry.meta && entry.meta !== "{}" && entry.meta !== "\"{}\"";

  return (
    <button
      type="button"
      onClick={hasDetail ? onToggle : undefined}
      className={[
        "flex items-start gap-2.5 px-3 py-1.5 w-full text-left transition-colors",
        hasDetail ? "cursor-pointer hover:bg-surface-hover" : "cursor-default",
      ].join(" ")}
    >
      {/* Category dot */}
      <div className={`size-2 rounded-full mt-1.5 flex-none ${CATEGORY_COLORS[entry.category]}`} />

      <div className="flex-1 min-w-0">
        {/* Summary line */}
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-medium text-fg-muted flex-none">
            {CATEGORY_LABELS[entry.category]}
          </span>
          {isEnd ? (
            <span className="text-fg-muted">finished</span>
          ) : (
            <span className="text-fg-body truncate">{entry.summary}</span>
          )}
          <span className="ml-auto text-xs text-fg-body flex-none tabular-nums">{formatTimeShort(entry.ts)}</span>
        </div>

        {/* Expanded detail */}
        {expanded && hasDetail && (
          <div className="mt-1 text-xs text-fg-muted font-mono break-all whitespace-pre-wrap leading-relaxed">
            {entry.meta}
          </div>
        )}
      </div>
    </button>
  );
}
