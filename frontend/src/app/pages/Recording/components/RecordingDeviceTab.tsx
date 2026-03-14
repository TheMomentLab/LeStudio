import { ArmPairSelector } from "../../../components/wireframe/ArmPairSelector";
import { FieldRow, WireSelect, WireToggle } from "../../../components/wireframe";
import type { ArmSelection, MappedArmLists, ResolvedArmConfig } from "../../../services/armSets";
import type { CalibrationListFile } from "../../../services/calibrationProfiles";
import type { PortOption } from "../../../services/portLabels";

type RecordingDeviceTabProps = {
  mode: string;
  advancedEnabled: boolean;
  setAdvancedEnabled: (value: boolean) => void;
  armLists: MappedArmLists;
  calibFiles: CalibrationListFile[];
  armSelection: ArmSelection;
  onSelectionChange: (selection: ArmSelection) => void;
  onArmSetConfigResolved: (resolved: ResolvedArmConfig) => void;
  robotType: string;
  teleopType: string;
  armPortOptions: PortOption[];
  followerIdOptions: string[];
  leaderIdOptions: string[];
  biFollowerIdOptions: string[];
  biLeaderIdOptions: string[];
  selectedBiFollowerId: string;
  selectedBiLeaderId: string;
  selectedFollowerPort: string;
  selectedLeaderPort: string;
  selectedLeftFollowerPort: string;
  selectedRightFollowerPort: string;
  selectedLeftLeaderPort: string;
  selectedRightLeaderPort: string;
  selectedFollowerId: string;
  selectedLeaderId: string;
  setRobotType: (value: string) => void;
  setTeleopType: (value: string) => void;
  setSelectedFollowerPort: (value: string) => void;
  setSelectedLeaderPort: (value: string) => void;
  setSelectedLeftFollowerPort: (value: string) => void;
  setSelectedRightFollowerPort: (value: string) => void;
  setSelectedLeftLeaderPort: (value: string) => void;
  setSelectedRightLeaderPort: (value: string) => void;
  setSelectedFollowerId: (value: string) => void;
  setSelectedLeaderId: (value: string) => void;
  setBiCalibrationId: (kind: "robot" | "teleop", value: string) => void;
};

const RECORD_ROBOT_TYPE_OPTIONS = [
  "so101_follower",
  "so100_follower",
];

const RECORD_CONTROLLER_TYPE_OPTIONS = [
  "so101_leader",
  "so100_leader",
  { value: "keyboard", label: "keyboard (not supported in recording flow yet)", disabled: true },
];

const RECORD_BI_ROBOT_TYPE_OPTIONS = ["bi_so_follower"];
const RECORD_BI_CONTROLLER_TYPE_OPTIONS = ["bi_so_leader"];

function pickSelectableValue(value: string, options: string[]): string {
  return options.includes(value) ? value : "";
}

export function RecordingDeviceTab({
  mode,
  advancedEnabled,
  setAdvancedEnabled,
  armLists,
  calibFiles,
  armSelection,
  onSelectionChange,
  onArmSetConfigResolved,
  robotType,
  teleopType,
  armPortOptions,
  followerIdOptions,
  leaderIdOptions,
  biFollowerIdOptions,
  biLeaderIdOptions,
  selectedBiFollowerId,
  selectedBiLeaderId,
  selectedFollowerPort,
  selectedLeaderPort,
  selectedLeftFollowerPort,
  selectedRightFollowerPort,
  selectedLeftLeaderPort,
  selectedRightLeaderPort,
  selectedFollowerId,
  selectedLeaderId,
  setRobotType,
  setTeleopType,
  setSelectedFollowerPort,
  setSelectedLeaderPort,
  setSelectedLeftFollowerPort,
  setSelectedRightFollowerPort,
  setSelectedLeftLeaderPort,
  setSelectedRightLeaderPort,
  setSelectedFollowerId,
  setSelectedLeaderId,
  setBiCalibrationId,
}: RecordingDeviceTabProps) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Device Configuration</span>
        <WireToggle label="Advanced" checked={advancedEnabled} onChange={setAdvancedEnabled} />
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        <ArmPairSelector
          mode={mode as "Single Arm" | "Bi-Arm"}
          armLists={armLists}
          calibFiles={calibFiles}
          selection={armSelection}
          onSelectionChange={onSelectionChange}
          onConfigResolved={onArmSetConfigResolved}
        />

        {advancedEnabled && (
          <>
            <p className="text-sm text-zinc-400">Select robot type and control method.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              <FieldRow label="Robot Type">
                <WireSelect
                  value={mode === "Single Arm" ? robotType : "bi_so_follower"}
                  options={mode === "Single Arm" ? RECORD_ROBOT_TYPE_OPTIONS : RECORD_BI_ROBOT_TYPE_OPTIONS}
                  onChange={mode === "Single Arm" ? setRobotType : undefined}
                  disabled={mode !== "Single Arm"}
                />
              </FieldRow>
              <FieldRow label="Teleop Type">
                <WireSelect
                  value={mode === "Single Arm" ? teleopType : "bi_so_leader"}
                  options={mode === "Single Arm" ? RECORD_CONTROLLER_TYPE_OPTIONS : RECORD_BI_CONTROLLER_TYPE_OPTIONS}
                  onChange={mode === "Single Arm" ? setTeleopType : undefined}
                  disabled={mode !== "Single Arm"}
                />
              </FieldRow>
            </div>
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex flex-col gap-2">
              <p className="text-sm text-zinc-400">Select device ports to connect.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {mode === "Single Arm" ? (
                  <>
                    <FieldRow label="Follower Port">
                      <WireSelect
                        placeholder={armPortOptions.length === 0 ? "No ports detected" : undefined}
                        value={selectedFollowerPort}
                        options={armPortOptions}
                        onChange={setSelectedFollowerPort}
                      />
                    </FieldRow>
                    <FieldRow label="Leader Port">
                      <WireSelect
                        placeholder={armPortOptions.length === 0 ? "No ports detected" : undefined}
                        value={selectedLeaderPort}
                        options={armPortOptions}
                        onChange={setSelectedLeaderPort}
                      />
                    </FieldRow>
                  </>
                ) : (
                  <>
                    <FieldRow label="Left Follower">
                      <WireSelect
                        placeholder={armPortOptions.length === 0 ? "No ports detected" : "Left Follower Port"}
                        value={selectedLeftFollowerPort}
                        options={armPortOptions}
                        onChange={setSelectedLeftFollowerPort}
                      />
                    </FieldRow>
                    <FieldRow label="Right Follower">
                      <WireSelect
                        placeholder={armPortOptions.length === 0 ? "No ports detected" : "Right Follower Port"}
                        value={selectedRightFollowerPort}
                        options={armPortOptions}
                        onChange={setSelectedRightFollowerPort}
                      />
                    </FieldRow>
                    <FieldRow label="Left Leader">
                      <WireSelect
                        placeholder={armPortOptions.length === 0 ? "No ports detected" : "Left Leader Port"}
                        value={selectedLeftLeaderPort}
                        options={armPortOptions}
                        onChange={setSelectedLeftLeaderPort}
                      />
                    </FieldRow>
                    <FieldRow label="Right Leader">
                      <WireSelect
                        placeholder={armPortOptions.length === 0 ? "No ports detected" : "Right Leader Port"}
                        value={selectedRightLeaderPort}
                        options={armPortOptions}
                        onChange={setSelectedRightLeaderPort}
                      />
                    </FieldRow>
                  </>
                )}
              </div>
            </div>
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex flex-col gap-2">
              <p className="text-sm text-zinc-400">Select calibration profile.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {mode === "Single Arm" ? (
                  <>
                    <FieldRow label="Follower ID">
                      <WireSelect
                        placeholder={followerIdOptions.length === 0 ? "No calibration files" : undefined}
                        value={selectedFollowerId}
                        options={followerIdOptions}
                        onChange={setSelectedFollowerId}
                      />
                    </FieldRow>
                    <FieldRow label="Leader ID">
                      <WireSelect
                        placeholder={leaderIdOptions.length === 0 ? "No calibration files" : undefined}
                        value={selectedLeaderId}
                        options={leaderIdOptions}
                        onChange={setSelectedLeaderId}
                      />
                    </FieldRow>
                  </>
                ) : (
                  <>
                    <FieldRow label="Follower Shared Profile">
                      <WireSelect
                        placeholder={biFollowerIdOptions.length === 0 ? "No bi-arm follower profiles" : "- Select shared follower profile -"}
                        value={pickSelectableValue(selectedBiFollowerId, biFollowerIdOptions)}
                        options={biFollowerIdOptions}
                        onChange={(value) => setBiCalibrationId("robot", value)}
                      />
                    </FieldRow>
                    <FieldRow label="Leader Shared Profile">
                      <WireSelect
                        placeholder={biLeaderIdOptions.length === 0 ? "No bi-arm leader profiles" : "- Select shared leader profile -"}
                        value={pickSelectableValue(selectedBiLeaderId, biLeaderIdOptions)}
                        options={biLeaderIdOptions}
                        onChange={(value) => setBiCalibrationId("teleop", value)}
                      />
                    </FieldRow>
                  </>
                )}
              </div>
              {mode !== "Single Arm" && (
                <p className="text-xs text-zinc-400">
                  Shared profiles automatically use the matching left/right calibration files.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
