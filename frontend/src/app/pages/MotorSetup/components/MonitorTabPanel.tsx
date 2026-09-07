import type { ComponentType } from "react";
import { AlertTriangle, Zap } from "lucide-react";
import { Card, EmptyState, WireSelect, WireToggle } from "../../../components/wireframe";
import type { ArmDevice, MotorData } from "../types";

interface MonitorCardProps {
  motor: MotorData;
  freewheel: boolean;
  onMove: (id: number, target: number) => void;
  onClearCollision: (id: number) => void;
  onTargetChange: (id: number, target: number) => void;
}

interface MonitorTabPanelProps {
  freewheel: boolean;
  monConnected: boolean;
  monConnecting: boolean;
  monPort: string;
  arms: ArmDevice[];
  portOptions: { value: string; label: string }[];
  setupRunning: boolean;
  monMotors: MotorData[];
  monError: string;
  MotorCardComponent: ComponentType<MonitorCardProps>;
  onHandleFreewheelToggle: () => void;
  onSetMonPort: (port: string) => void;
  onHandleMoveMotor: (id: number, target: number) => void;
  onHandleClearCollision: (id: number) => void;
  onHandleTargetChange: (id: number, target: number) => void;
}

export function MonitorTabPanel({
  freewheel,
  monConnected,
  monConnecting,
  monPort,
  arms,
  portOptions,
  setupRunning,
  monMotors,
  monError,
  MotorCardComponent,
  onHandleFreewheelToggle,
  onSetMonPort,
  onHandleMoveMotor,
  onHandleClearCollision,
  onHandleTargetChange,
}: MonitorTabPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/30">
          <WireToggle label="Freewheel" checked={freewheel} onChange={onHandleFreewheelToggle} />
          <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 flex-none" />
          <span className="text-sm text-zinc-500 flex-none">Port</span>
          <div className="flex-1 min-w-0">
            <WireSelect
              value={monPort}
              options={arms.length > 0 ? portOptions : [monPort]}
              onChange={(v) => { if (!monConnected) onSetMonPort(v); }}
            />
          </div>
        </div>

      </div>

      {monError && (
        <div className="px-3 py-2 rounded border border-red-500/30 bg-red-500/5 text-sm text-red-400">
          <AlertTriangle size={14} className="inline mr-1 shrink-0" />{monError}
        </div>
      )}

      {monConnected && freewheel && (
        <div className="px-3 py-2 rounded border border-amber-500/30 bg-amber-500/5 text-sm text-amber-400">
          <span className="block flex items-center gap-1"><AlertTriangle size={14} className="shrink-0" />Freewheel enabled</span>
          <span className="text-sm text-amber-400/60 block mt-0.5">Motor lock released. Move button disabled.</span>
        </div>
      )}

      {monConnected && monMotors.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {monMotors.map((m) => (
            <MotorCardComponent
              key={m.id}
              motor={m}
              freewheel={freewheel}
              onMove={onHandleMoveMotor}
              onClearCollision={onHandleClearCollision}
              onTargetChange={onHandleTargetChange}
            />
          ))}
        </div>
      )}

      {!monConnected && !monConnecting && (
        <Card title="Real-time Motor Status">
          <EmptyState
            icon={<Zap size={28} />}
            message={setupRunning
              ? "Motor Setup is running. Stop it first."
              : "Connect to port to see motor status (100ms polling)"}
          />
        </Card>
      )}
    </div>
  );
}
