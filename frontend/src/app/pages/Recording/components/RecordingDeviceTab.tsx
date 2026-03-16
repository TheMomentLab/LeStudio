import { ArmPairSelector } from "../../../components/wireframe/ArmPairSelector";
import type { ArmSelection, MappedArmLists, PreferredArmTypes, ResolvedArmConfig } from "../../../services/armSets";
import type { CalibrationListFile } from "../../../services/calibrationProfiles";

type RecordingDeviceTabProps = {
  mode: string;
  armLists: MappedArmLists;
  calibFiles: CalibrationListFile[];
  armSelection: ArmSelection;
  preferredTypes: PreferredArmTypes;
  onSelectionChange: (selection: ArmSelection) => void;
  onArmSetConfigResolved: (resolved: ResolvedArmConfig) => void;
};

export function RecordingDeviceTab({
  mode,
  armLists,
  calibFiles,
  armSelection,
  preferredTypes,
  onSelectionChange,
  onArmSetConfigResolved,
}: RecordingDeviceTabProps) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Device Configuration</span>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        <ArmPairSelector
          mode={mode as "Single Arm" | "Bi-Arm"}
          armLists={armLists}
          calibFiles={calibFiles}
          selection={armSelection}
          preferredTypes={preferredTypes}
          onSelectionChange={onSelectionChange}
          onConfigResolved={onArmSetConfigResolved}
        />
      </div>
    </div>
  );
}
