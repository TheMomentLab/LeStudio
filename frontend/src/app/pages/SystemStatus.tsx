import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Camera, Bot, ChevronDown, ChevronUp, Trash2, AlertCircle, History } from "lucide-react";
import {
  PageHeader, StatusBadge, ResourceBar, EmptyState, RefreshButton,
} from "../components/wireframe";
import { apiGet, apiPost } from "../services/apiClient";
import {
  fromBackendHistory,
  fromBackendResources,
  type UiHistoryEntry,
  type UiResourcesData,
} from "../services/contracts";

// ─── Types ────────────────────────────────────────────────────────────────────
type CameraDevice = { device: string; symlink: string | null; path: string; kernels?: string; model?: string };
type ArmDevice = { device: string; symlink: string | null; path: string; serial?: string };

type GpuStatusResponse = { exists: boolean; utilization: number; memory_used: number; memory_total: number; memory_percent: number; };

export function SystemStatus() {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [arms, setArms] = useState<ArmDevice[]>([]);
  const [resources, setResources] = useState<UiResourcesData | null>(null);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [historyItems, setHistoryItems] = useState<UiHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [gpuStatus, setGpuStatus] = useState<GpuStatusResponse | null>(null);


  const refreshStatus = () => {
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
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const linkedCams = cameras.filter((c) => c.symlink != null).length;
  const linkedArms = arms.filter((a) => a.symlink != null).length;

  const handleClearHistory = () => {
    apiPost("/api/history/clear").then(() => setHistoryItems([]));
  };

  const handleRefresh = () => {
    refreshStatus();
  };


  return (
    <div className="flex flex-col h-full">
      {/* Top nav bar */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm text-zinc-400">
        <div aria-hidden="true" />
        <div className="flex items-center gap-2">
          <span className="text-zinc-700 dark:text-zinc-200 font-medium">System Status</span>
          <span className="text-zinc-300 dark:text-zinc-600">›</span>
          <Link to="/camera-setup" className="hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">Camera Setup</Link>
          <span className="text-zinc-300 dark:text-zinc-600">›</span>
          <Link to="/motor-setup" className="hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">Motor Setup</Link>
        </div>
        <Link to="/camera-setup" className="justify-self-end inline-flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
          Camera Setup →
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 max-w-[1600px] mx-auto w-full">
          <PageHeader
            title="System Status"
            subtitle="Hardware and system readiness dashboard"
            action={<RefreshButton onClick={handleRefresh} />}
          />

          {/* Cameras + Arms — 2-column list */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cameras */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card overflow-hidden">
              <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-sm text-zinc-500">Cameras ({cameras.length})</span>
                <span className="flex items-center gap-1 text-sm">
                  <span className="text-zinc-400">{linkedCams} / {cameras.length} linked</span>
                </span>
              </div>
              {cameras.length === 0 ? (
                <div className="p-3 flex flex-col gap-3 flex-1 justify-start">
                  <EmptyState
                    icon={<Camera size={28} />}
                    message="No cameras connected."
                    messageClassName="max-w-none whitespace-nowrap"
                  />
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {cameras.map((cam) => (
                    <div key={cam.device} className="flex items-center gap-2 sm:gap-3 px-3 py-1.5 sm:py-2">
                      <div className="size-7 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hidden sm:flex">
                        <Camera size={14} className="text-zinc-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{cam.symlink ?? cam.device}</div>
                        <div className="text-sm text-zinc-400 truncate">{cam.path}{cam.model ? ` · ${cam.model}` : ""}</div>
                      </div>
                      <StatusBadge status={cam.symlink ? "ready" : "warning"} label={cam.symlink ? "linked" : "no link"} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Arms */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card overflow-hidden">
              <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-sm text-zinc-500">Arms ({arms.length})</span>
                <span className="flex items-center gap-1 text-sm">
                  <span className="text-zinc-400">{linkedArms} / {arms.length} linked</span>
                </span>
              </div>
              {arms.length === 0 ? (
                <div className="p-3 flex flex-col gap-3 flex-1 justify-start">
                  <EmptyState
                    icon={<Bot size={28} />}
                    message="No arms connected."
                    messageClassName="max-w-none whitespace-nowrap"
                  />
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {arms.map((arm) => (
                    <div key={arm.device} className="flex items-center gap-2 sm:gap-3 px-3 py-1.5 sm:py-2">
                      <div className="size-7 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center hidden sm:flex">
                        <Bot size={14} className="text-zinc-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{arm.symlink ?? arm.device}</div>
                        <div className="text-sm text-zinc-400 truncate">{arm.path}{arm.serial ? ` · S/N: ${arm.serial}` : ""}</div>
                      </div>
                      <StatusBadge status={arm.symlink ? "ready" : "warning"} label={arm.symlink ? "linked" : "no link"} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* System Resources + Session History — 2-column */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* System Resources */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card overflow-hidden flex flex-col">
              <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800 flex items-center">
                <span className="text-sm text-zinc-500">System Resources</span>
              </div>
              <div className="p-3 flex flex-col gap-3 flex-1 justify-start">
                {resourcesLoading ? (
                  <div className="text-sm text-zinc-400 py-2">Loading...</div>
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
                      <span className="text-sm text-zinc-400 w-24 flex-none">LeRobot Cache</span>
                      <div className="flex-1" />
                      <span className="text-sm text-zinc-400 w-20 text-right flex-none">{resources.cache_size} GB</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Session History */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-card overflow-hidden flex flex-col">
              <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <button
                  onClick={() => setHistoryOpen(!historyOpen)}
                  className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-400 transition-colors cursor-pointer"
                >
                  {historyOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  Session History ({historyItems.length})
                </button>
                {historyItems.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="flex items-center gap-1 text-sm text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 size={11} /> Clear
                  </button>
                )}
              </div>
              {historyOpen && (
                historyItems.length > 0 ? (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50 overflow-y-auto max-h-[200px]">
                    {historyItems.map((h, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2">
                        <div className="size-2 rounded-full bg-zinc-300 dark:bg-zinc-600 flex-none" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-zinc-700 dark:text-zinc-300">{h.type}</span>
                            <span className="text-sm text-zinc-400">{h.ts}</span>
                          </div>
                          <div className="text-sm text-zinc-400">{h.meta}</div>
                        </div>
                      </div>
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
