import type { MotorData } from "../types";
import { cn } from "../../../components/ui/utils";
import { inputClassName } from "../../../components/wireframe";
import { LOAD_WARN, LOAD_DANGER, CURRENT_WARN, CURRENT_DANGER } from "../constants";

export function MotorCard({
  motor,
  freewheel,
  onMove,
  onClearCollision,
  onTargetChange,
}: {
  motor: MotorData;
  freewheel: boolean;
  onMove: (id: number, target: number) => void;
  onClearCollision: (id: number) => void;
  onTargetChange: (id: number, target: number) => void;
}) {
  const loadColor =
    motor.load === null ? "text-fg-muted" :
    motor.load >= LOAD_DANGER ? "text-danger" :
    motor.load >= LOAD_WARN ? "text-warn" :
    "text-fg-muted";

  const currentColor =
    motor.current === null ? "text-fg-muted" :
    motor.current >= CURRENT_DANGER ? "text-danger" :
    motor.current >= CURRENT_WARN ? "text-warn" :
    "text-fg-muted";

  return (
    <div className={cn("rounded-lg border bg-surface p-3 flex flex-col gap-2", motor.collision ? "border-danger-line" : "border-line")}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-fg-muted">Motor #{motor.id}</span>
        {motor.collision && (
          <span className="px-1.5 py-0.5 rounded bg-danger-bg border border-danger-line text-danger text-sm">
            Collision
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-sm text-fg-muted mb-0.5">POS</div>
          <div className="text-sm font-mono text-fg-body">
            {motor.pos !== null ? motor.pos : <span className="text-danger">err</span>}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-fg-muted mb-0.5">LOAD</div>
          <div className={`text-sm font-mono ${loadColor}`}>
            {motor.load !== null ? motor.load : "—"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-fg-muted mb-0.5">CURR</div>
          <div className={`text-sm font-mono ${currentColor}`}>
            {motor.current !== null ? `${motor.current}mA` : "—"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 mt-1">
        <button
          onClick={() => onTargetChange(motor.id, Math.max(0, motor.target - 10))}
          className="size-7 flex items-center justify-center rounded border border-line-control text-fg-muted hover:bg-surface-hover cursor-pointer text-sm"
          aria-label={`Decrease motor ${motor.id} target`}
        >
          ▼
        </button>
        <input
          type="number"
          value={motor.target}
          onChange={(e) => onTargetChange(motor.id, Math.max(0, Math.min(4095, Number(e.target.value))))}
          min={0}
          max={4095}
          aria-label={`Motor ${motor.id} target position`}
          className={cn(inputClassName, "flex-1 h-7 px-1.5 py-0 text-center font-mono rounded")}
        />
        <button
          onClick={() => onTargetChange(motor.id, Math.min(4095, motor.target + 10))}
          className="size-7 flex items-center justify-center rounded border border-line-control text-fg-muted hover:bg-surface-hover cursor-pointer text-sm"
          aria-label={`Increase motor ${motor.id} target`}
        >
          ▲
        </button>
        <button
          onClick={() => onMove(motor.id, motor.target)}
          disabled={freewheel || motor.collision}
          className="px-2 h-7 rounded border border-line-control text-sm text-fg-muted hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          aria-label={`Move motor ${motor.id} to target`}
        >
          Move
        </button>
      </div>

      {motor.collision && (
        <button
          onClick={() => onClearCollision(motor.id)}
          className="text-sm text-danger hover:text-danger/80 underline cursor-pointer"
        >
          Clear Collision
        </button>
      )}
    </div>
  );
}
