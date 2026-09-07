import { Play, Square, Trash2, Zap } from "lucide-react";

import { buttonStyles } from "../../../components/ui/button";
import { StatusBadge, StickyControlBar } from "../../../components/wireframe";

// Every page that runs a hardware/ML process puts its status + primary action in
// the bottom StickyControlBar (Teleop, Record, Train, Eval). Motor Setup now does
// the same for its three process tabs. The Setup wizard keeps its per-step
// buttons because it is a guided sequence, not a single start/stop.
//
// Tone rule (DESIGN_GUIDE §5.2): a button that *starts a process* is
// primary/success; everything else primary/neutral or secondary.

type MotorSetupControlBarProps = {
  tab: string;
  // mapping
  armCount: number;
  hasAnyMapping: boolean;
  hasMappedArms: boolean;
  autoApplying: boolean;
  onClearAllMappings: () => void;
  onOpenIdentify: () => void;
  // monitor
  monConnected: boolean;
  monConnecting: boolean;
  monPort: string;
  monPortLabel: string;
  monMotorCount: number;
  setupRunning: boolean;
  onMonConnect: () => void;
  onMonDisconnect: () => void;
  onEmergencyStop: () => void;
  // calibration
  calibrateRunning: boolean;
  calibStartDisabled: boolean;
  onCalibrationStart: () => void;
  onCalibrationStop: () => void;
};

export function MotorSetupControlBar(props: MotorSetupControlBarProps) {
  const { tab } = props;
  if (tab === "mapping") return <MappingBar {...props} />;
  if (tab === "monitor") return <MonitorBar {...props} />;
  if (tab === "calibration") return <CalibrationBar {...props} />;
  return null;
}

function MappingBar({
  armCount,
  hasAnyMapping,
  hasMappedArms,
  autoApplying,
  onClearAllMappings,
  onOpenIdentify,
}: MotorSetupControlBarProps) {
  if (armCount === 0) return null;
  const status = autoApplying ? "loading" : hasMappedArms ? "ready" : "idle";
  const text = autoApplying
    ? "Applying mapping…"
    : hasMappedArms
      ? "Arms mapped"
      : "Assign follower / leader roles to continue";
  return (
    <StickyControlBar>
      <div className="flex items-center gap-2 min-w-0">
        <StatusBadge status={status} />
        <span className="text-sm text-fg-muted truncate">{text}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClearAllMappings}
          disabled={!hasAnyMapping || autoApplying}
          className={buttonStyles({ variant: "secondary", tone: "neutral", size: "sm", className: "whitespace-nowrap" })}
        >
          <Trash2 size={12} className="inline mr-1.5" />
          Clear All
        </button>
        <button
          type="button"
          onClick={onOpenIdentify}
          className={buttonStyles({ variant: "primary", tone: "success", size: "sm", className: "whitespace-nowrap" })}
        >
          <Zap size={12} className="inline mr-1.5" />
          Identify Arm
        </button>
      </div>
    </StickyControlBar>
  );
}

function MonitorBar({
  monConnected,
  monConnecting,
  monPort,
  monPortLabel,
  monMotorCount,
  setupRunning,
  onMonConnect,
  onMonDisconnect,
  onEmergencyStop,
}: MotorSetupControlBarProps) {
  const status = monConnected ? "running" : monConnecting ? "loading" : setupRunning ? "blocked" : "idle";
  const text = monConnected
    ? `${monPortLabel} · ${monMotorCount} motors · polling 100ms`
    : monConnecting
      ? "Connecting…"
      : setupRunning
        ? "Motor Setup is running — stop it first"
        : monPort
          ? `Not connected · ${monPortLabel}`
          : "Select a port to monitor";
  return (
    <StickyControlBar>
      <div className="flex items-center gap-2 min-w-0">
        <StatusBadge status={status} pulse={monConnected} />
        <span className="text-sm text-fg-muted truncate">{text}</span>
      </div>
      <div className="flex items-center gap-2">
        {monConnected ? (
          <>
            <button
              type="button"
              onClick={onEmergencyStop}
              className={buttonStyles({ variant: "primary", tone: "danger", size: "sm", className: "whitespace-nowrap" })}
            >
              E-Stop
            </button>
            <button
              type="button"
              onClick={onMonDisconnect}
              className={buttonStyles({ variant: "secondary", tone: "neutral", size: "sm", className: "whitespace-nowrap" })}
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onMonConnect}
            disabled={monConnecting || !monPort || setupRunning}
            className={buttonStyles({ variant: "primary", tone: "success", size: "sm", className: "whitespace-nowrap" })}
          >
            <Zap size={12} className="inline mr-1.5" />
            {monConnecting ? "Connecting…" : "Connect"}
          </button>
        )}
      </div>
    </StickyControlBar>
  );
}

function CalibrationBar({
  armCount,
  calibrateRunning,
  calibStartDisabled,
  onCalibrationStart,
  onCalibrationStop,
}: MotorSetupControlBarProps) {
  if (armCount === 0) return null;
  const text = calibrateRunning
    ? "Calibration running — follow the steps above"
    : calibStartDisabled
      ? "Resolve the warnings above to start"
      : "Calibration ready";
  return (
    <StickyControlBar>
      <div className="flex items-center gap-2 min-w-0">
        <StatusBadge status={calibrateRunning ? "running" : calibStartDisabled ? "blocked" : "ready"} pulse={calibrateRunning} />
        <span className="text-sm text-fg-muted truncate">{text}</span>
      </div>
      <div className="flex items-center gap-2">
        {calibrateRunning ? (
          <button
            type="button"
            onClick={onCalibrationStop}
            className={buttonStyles({ variant: "secondary", tone: "danger", size: "sm", className: "whitespace-nowrap gap-1.5" })}
          >
            <Square size={11} className="fill-current" /> Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={onCalibrationStart}
            disabled={calibStartDisabled}
            className={buttonStyles({ variant: "primary", tone: "success", size: "sm", className: "whitespace-nowrap gap-1.5" })}
          >
            <Play size={13} className="fill-current" /> Start Calibration
          </button>
        )}
      </div>
    </StickyControlBar>
  );
}
