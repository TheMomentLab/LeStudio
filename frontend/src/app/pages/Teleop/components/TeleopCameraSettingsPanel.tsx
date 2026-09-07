import { ChevronDown, ChevronUp, Camera } from "lucide-react";

import { Card, EmptyState, FieldRow, WireSelect } from "../../../components/wireframe";
import { cn } from "../../../components/ui/utils";
import type { MappedCamera } from "../shared";

type TeleopCameraSettingsPanelProps = {
  camerasMapped: MappedCamera[];
  enabledCameras: Set<string>;
  onToggleCamera: (role: string) => void;
  advStreamOpen: boolean;
  onToggleAdvancedStream: () => void;
  selectedCameras: MappedCamera[];
  cameraFrames: Record<string, string>;
};

export function TeleopCameraSettingsPanel({
  camerasMapped,
  enabledCameras,
  onToggleCamera,
  advStreamOpen,
  onToggleAdvancedStream,
  selectedCameras,
  cameraFrames,
}: TeleopCameraSettingsPanelProps) {
  return (
    <div className="flex flex-col gap-4">
            <Card title="Camera feed settings" bodyClassName="flex flex-col gap-3">
        {camerasMapped.length === 0 ? (
          <EmptyState
            icon={<Camera size={28} />}
            message={
              <>
                No camera mappings. First connect cameras in the{" "}
                <a href="/camera-setup" className="underline hover:text-fg-body transition-colors">Camera Setup</a> tab.
              </>
            }
            messageClassName="max-w-none"
          />
        ) : camerasMapped.map((cam) => (
          <label key={cam.role} className="flex items-center gap-2 px-2 py-1.5 rounded border border-line-subtle cursor-pointer">
            <input
              type="checkbox"
              checked={enabledCameras.has(cam.role)}
              onChange={() => onToggleCamera(cam.role)}
              aria-label={`Toggle ${cam.role} camera`}
              className="accent-ok-solid"
            />
            <span className="text-sm text-fg-body font-mono">{cam.role}</span>
            <span className="text-sm text-fg-muted ml-auto font-mono truncate">{cam.path}</span>
          </label>
        ))}

        <button
          onClick={onToggleAdvancedStream}
          className="flex items-center gap-1 text-sm text-fg-muted hover:text-fg-body cursor-pointer"
          aria-expanded={advStreamOpen}
          aria-label="Toggle advanced stream settings"
        >
          Advanced stream settings
          {advStreamOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>

        {advStreamOpen && (
          <div className="flex flex-col gap-2 pl-2 border-l-2 border-line-subtle">
            <FieldRow label="Codec">
              <WireSelect value="MJPG" options={["MJPG", "YUYV"]} disabled />
            </FieldRow>
            <FieldRow label="Resolution">
              <WireSelect value="640×480" options={["1280×720", "800×600", "640×480", "320×240"]} disabled />
            </FieldRow>
            <FieldRow label="FPS">
              <WireSelect value="30" options={["15", "30", "60"]} disabled />
            </FieldRow>
            <FieldRow label="JPEG Quality">
              <input type="range" min={30} max={95} defaultValue={75} className="w-full h-1.5 accent-fg-muted cursor-pointer" disabled aria-label="JPEG quality" />
            </FieldRow>
            <p className="text-xs text-fg-muted">Camera stream settings are managed from Camera Setup.</p>
          </div>
        )}
      </Card>

      <div
        className={cn(
          "grid gap-2",
          selectedCameras.length <= 2
            ? "grid-cols-2"
            : selectedCameras.length === 3
              ? "grid-cols-3"
              : "grid-cols-4",
        )}
      >
        {selectedCameras.map((cam) => {
          const frameSrc = cameraFrames[cam.role];
          return (
            <div key={cam.role} className="relative rounded-lg overflow-hidden border border-line">
              <div className="aspect-video bg-surface-sunken">
                {frameSrc ? (
                  <img src={frameSrc} alt={`${cam.role} preview`} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <EmptyState compact icon={<Camera size={20} />} message="Waiting for frames…" />
                  </div>
                )}
              </div>
              <div className="px-2 py-1.5 bg-surface-muted">
                <div className="text-sm text-fg-body">{cam.role}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
