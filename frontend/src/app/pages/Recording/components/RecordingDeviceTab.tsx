import { Card } from "../../../components/wireframe";
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
        <Card title="Device Configuration" bodyClassName="flex flex-col gap-3">
      <ArmPairSelector
        mode={mode as "Single Arm" | "Bi-Arm"}
        armLists={armLists}
        calibFiles={calibFiles}
        selection={armSelection}
        preferredTypes={preferredTypes}
        onSelectionChange={onSelectionChange}
        onConfigResolved={onArmSetConfigResolved}
      />
    </Card>
  );
}
