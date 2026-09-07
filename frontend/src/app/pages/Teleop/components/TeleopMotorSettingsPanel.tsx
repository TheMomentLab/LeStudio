import { ChevronDown, ChevronUp } from "lucide-react";

import { ArmPairSelector } from "../../../components/wireframe/ArmPairSelector";
import { Card, FieldRow, WireSelect, WireToggle, inputClassName } from "../../../components/wireframe";
import type {
  ArmSelection,
  MappedArmLists,
  PreferredArmTypes,
  ResolvedArmConfig,
} from "../../../services/armSets";
import type { CalibFile, TeleopPhase } from "../shared";

type TeleopMotorSettingsPanelProps = {
  mode: "Single Arm" | "Bi-Arm";
  armLists: MappedArmLists;
  calibFiles: CalibFile[];
  armSelection: ArmSelection;
  preferredTypes: PreferredArmTypes;
  onArmSelectionChange: (selection: ArmSelection) => void;
  onArmConfigResolved: (resolved: ResolvedArmConfig) => void;
  phase: TeleopPhase;
  debugEnabled: boolean;
  onPersistConfigPatch: (patch: Record<string, unknown>) => void;
  motorTuningOpen: boolean;
  onToggleMotorTuning: () => void;
  invertShoulderLift: boolean;
  invertWristRoll: boolean;
  antiJitterAvailable: boolean;
  antiJitterEnabled: boolean;
  antiJitterAlpha: number;
  antiJitterDeadband: number;
  antiJitterMaxStep: string;
};

export function TeleopMotorSettingsPanel({
  mode,
  armLists,
  calibFiles,
  armSelection,
  preferredTypes,
  onArmSelectionChange,
  onArmConfigResolved,
  phase,
  debugEnabled,
  onPersistConfigPatch,
  motorTuningOpen,
  onToggleMotorTuning,
  invertShoulderLift,
  invertWristRoll,
  antiJitterAvailable,
  antiJitterEnabled,
  antiJitterAlpha,
  antiJitterDeadband,
  antiJitterMaxStep,
}: TeleopMotorSettingsPanelProps) {
  return (
    <Card
      title="Motor Configuration"
      bodyClassName="flex flex-col gap-3"
      action={(
      <WireToggle
        label="Debug"
        checked={debugEnabled}
        onChange={(value) => onPersistConfigPatch({ teleop_debug_enabled: value })}
      />
      )}
    >
      <ArmPairSelector
        mode={mode}
        armLists={armLists}
        calibFiles={calibFiles}
        selection={armSelection}
        preferredTypes={preferredTypes}
        onSelectionChange={onArmSelectionChange}
        onConfigResolved={onArmConfigResolved}
        disabled={phase !== "idle"}
      />

      <button
        onClick={onToggleMotorTuning}
        className="flex items-center gap-1 text-sm text-fg-muted hover:text-fg-body cursor-pointer"
        aria-expanded={motorTuningOpen}
        aria-label="Toggle motor tuning"
      >
        Motor tuning
        {motorTuningOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>

      {motorTuningOpen && (
        <div className="flex flex-col gap-3 pl-2 border-l-2 border-line-subtle">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <FieldRow label="Invert Shoulder Lift">
              <WireSelect
                value={invertShoulderLift ? "On" : "Off"}
                options={["Off", "On"]}
                onChange={(value) => {
                  onPersistConfigPatch({ teleop_invert_shoulder_lift: value === "On" });
                }}
              />
            </FieldRow>
            <FieldRow label="Invert Wrist Roll">
              <WireSelect
                value={invertWristRoll ? "On" : "Off"}
                options={["Off", "On"]}
                onChange={(value) => {
                  onPersistConfigPatch({ teleop_invert_wrist_roll: value === "On" });
                }}
              />
            </FieldRow>
            <FieldRow label="Anti-Jitter">
              <WireSelect
                value={antiJitterAvailable && antiJitterEnabled ? "On" : "Off"}
                options={["Off", "On"]}
                onChange={(value) => {
                  if (!antiJitterAvailable) return;
                  onPersistConfigPatch({ teleop_antijitter_enabled: value === "On" });
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
                aria-label="Anti-jitter EMA alpha"
                onChange={(event) => {
                  if (!antiJitterAvailable) return;
                  const next = Number(event.target.value);
                  if (Number.isFinite(next)) {
                    onPersistConfigPatch({ teleop_antijitter_alpha: next });
                  }
                }}
                className={inputClassName}
              />
            </FieldRow>
            <FieldRow label="Deadband (deg)">
              <input
                type="number"
                min={0}
                step="0.05"
                value={antiJitterDeadband}
                disabled={!antiJitterAvailable}
                aria-label="Anti-jitter deadband"
                onChange={(event) => {
                  if (!antiJitterAvailable) return;
                  const next = Number(event.target.value);
                  if (Number.isFinite(next)) {
                    onPersistConfigPatch({ teleop_antijitter_deadband: next });
                  }
                }}
                className={inputClassName}
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
                aria-label="Anti-jitter max step"
                onChange={(event) => {
                  if (!antiJitterAvailable) return;
                  const raw = event.target.value;
                  if (!raw.trim()) {
                    onPersistConfigPatch({ teleop_antijitter_max_step: "" });
                    return;
                  }
                  const next = Number(raw);
                  if (Number.isFinite(next)) {
                    onPersistConfigPatch({ teleop_antijitter_max_step: next });
                  }
                }}
                className={inputClassName}
              />
            </FieldRow>
          </div>
        </div>
      )}
    </Card>
  );
}
