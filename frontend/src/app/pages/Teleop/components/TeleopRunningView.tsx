import type { ReactNode } from "react";
import { Pause, Play } from "lucide-react";

import { WireBox } from "../../../components/wireframe";
import type { MappedCamera } from "../shared";

type TeleopRunningViewProps = {
  teleopReconnected: boolean;
  selectedCameras: MappedCamera[];
  cameraFrames: Record<string, string>;
  pausedFeeds: Record<string, boolean>;
  onToggleFeed: (role: string) => void;
  mode: string;
  speed: string;
  antiJitterAvailable: boolean;
  antiJitterEnabled: boolean;
  antiJitterAlpha: number;
  antiJitterDeadband: number;
  debugEnabled: boolean;
  camerasMappedCount: number;
  debugTelemetry: ReactNode;
};

export function TeleopRunningView({
  teleopReconnected,
  selectedCameras,
  cameraFrames,
  pausedFeeds,
  onToggleFeed,
  mode,
  speed,
  antiJitterAvailable,
  antiJitterEnabled,
  antiJitterAlpha,
  antiJitterDeadband,
  debugEnabled,
  camerasMappedCount,
  debugTelemetry,
}: TeleopRunningViewProps) {
  return (
    <>
      {teleopReconnected && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/5 text-sm text-blue-600 dark:text-blue-400">
          <span className="flex-none">⚡</span>
          <span>Reconnected - This teleop session was recovered from a previous server session. You can still stop the process.</span>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div
          className={[
            "grid gap-3",
            selectedCameras.length <= 2
              ? "grid-cols-2"
              : selectedCameras.length === 3
                ? "grid-cols-3"
                : "grid-cols-4",
          ].join(" ")}
        >
          {selectedCameras.map((cam) => {
            const frameSrc = cameraFrames[cam.role];
            return (
              <div key={cam.role} className="relative rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <div className="aspect-video bg-zinc-200 dark:bg-zinc-900 relative">
                  {!pausedFeeds[cam.role] ? (
                    frameSrc ? (
                      <img src={frameSrc} alt={`${cam.role} stream`} className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <WireBox className="absolute inset-0 border-0 rounded-none" label={`MJPEG stream - ${cam.role}`} />
                    )
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
                      <span className="text-sm flex items-center gap-1"><Pause size={10} className="fill-current" /> Paused</span>
                    </div>
                  )}

                  <div className="absolute top-2 left-2">
                    <span className="px-1.5 py-0.5 rounded bg-red-500/80 text-white text-sm font-mono">LIVE</span>
                  </div>
                  <button
                    onClick={() => onToggleFeed(cam.role)}
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

        <div className="flex items-center gap-2 px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <span className="text-sm text-zinc-500">
            {mode} · {speed} · {antiJitterAvailable
              ? (antiJitterEnabled ? `anti-jitter a=${antiJitterAlpha} d=${antiJitterDeadband}` : "anti-jitter off")
              : "anti-jitter unavailable"} · {debugEnabled ? "debug on" : "debug off"} · Cams: {selectedCameras.length}/{camerasMappedCount}
          </span>
        </div>

        {debugTelemetry}
      </div>
    </>
  );
}
