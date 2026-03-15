import { Play } from "lucide-react";

import {
  ProcessButtons,
  StatusBadge,
  StickyControlBar,
  WireSelect,
} from "../../../components/wireframe";
import type { TeleopPhase } from "../shared";

type TeleopControlBarProps = {
  running: boolean;
  phase: TeleopPhase;
  mode: string;
  speed: string;
  onSpeedChange: (value: string) => void;
  onStart: () => void;
  onStop: () => void;
  actionPending: boolean;
  hasMappedArms: boolean;
};

export function TeleopControlBar({
  running,
  phase,
  mode,
  speed,
  onSpeedChange,
  onStart,
  onStop,
  actionPending,
  hasMappedArms,
}: TeleopControlBarProps) {
  return (
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
              onChange={onSpeedChange}
              className="h-7 py-0"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <ProcessButtons
          running={phase !== "idle"}
          onStart={onStart}
          onStop={onStop}
          startLabel={<><Play size={13} className="fill-current" /> Start Teleop</>}
          disabled={actionPending || !hasMappedArms}
          compact
          buttonClassName="py-1"
        />
      </div>
    </StickyControlBar>
  );
}
