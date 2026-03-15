import { ChevronDown, ChevronUp } from "lucide-react";

import { ArmPairSelector } from "../../../components/wireframe/ArmPairSelector";
import { FieldRow, WireSelect, WireToggle } from "../../../components/wireframe";
import type {
  ArmSelection,
  MappedArmLists,
  ResolvedArmConfig,
} from "../../../services/armSets";
import type { CalibFile, TeleopPhase } from "../shared";

type TeleopMotorSettingsPanelProps = {
  mode: "Single Arm" | "Bi-Arm";
  armLists: MappedArmLists;
  calibFiles: CalibFile[];
  armSelection: ArmSelection;
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
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Motor Configuration</span>
        <div className="flex items-center gap-2">
          <WireToggle
            label="Debug"
            checked={debugEnabled}
            onChange={(value) => onPersistConfigPatch({ teleop_debug_enabled: value })}
          />
        </div>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        <ArmPairSelector
          mode={mode}
          armLists={armLists}
          calibFiles={calibFiles}
          selection={armSelection}
          onSelectionChange={onArmSelectionChange}
          onConfigResolved={onArmConfigResolved}
          disabled={phase !== "idle"}
        />

        <button
          onClick={onToggleMotorTuning}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-600 cursor-pointer"
          aria-expanded={motorTuningOpen}
          aria-label="Toggle motor tuning"
        >
          Motor tuning
          {motorTuningOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>

        {motorTuningOpen && (
          <div className="flex flex-col gap-3 pl-2 border-l-2 border-zinc-100 dark:border-zinc-800">
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
                  className="w-full h-9 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200 text-sm outline-none hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 transition-all"
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
                  className="w-full h-9 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200 text-sm outline-none hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 transition-all"
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
                  className="w-full h-9 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200 text-sm outline-none placeholder:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 transition-all"
                />
              </FieldRow>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
