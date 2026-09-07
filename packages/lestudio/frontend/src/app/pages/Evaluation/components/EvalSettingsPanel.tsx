import type { Dispatch, SetStateAction } from "react";
import { ChevronDown, ChevronUp, Video } from "lucide-react";
import { Card, SubTabs, inputClassName, selectClassName } from "../../../components/wireframe";
import { ArmPairSelector } from "../../../components/wireframe/ArmPairSelector";
import type {
  CheckpointItem,
  EnvTypeItem,
} from "../../../hooks/useEvalCheckpoint";
import type {
  ArmSelection,
  MappedArmLists,
  PreferredArmTypes,
  ResolvedArmConfig,
} from "../../../services/armSets";
import type { CalibrationListFile } from "../../../services/calibrationProfiles";
import type { EvalCalibrationProfile } from "../types";

export interface EvalSettingsPanelProps {
  policySource: "local" | "hf";
  setPolicySource: Dispatch<SetStateAction<"local" | "hf">>;
  policyPath: string;
  checkpoints: CheckpointItem[];
  onCheckpointChange: (path: string) => void;
  updateConfig: (partial: Record<string, unknown>) => void;
  deviceLabel: string;
  setDeviceLabel: Dispatch<SetStateAction<string>>;
  numEpisodes: number;
  setNumEpisodes: Dispatch<SetStateAction<number>>;
  datasetRepo: string;
  setDatasetRepo: Dispatch<SetStateAction<string>>;
  envType: string;
  envTypes: EnvTypeItem[];
  envTypeFromCheckpoint: string | null;
  envTypeMissing: boolean;
  envTaskFromCheckpoint: string | null;
  envTaskMissing: boolean;
  task: string;
  advOpen: boolean;
  setAdvOpen: Dispatch<SetStateAction<boolean>>;
  datasetOverride: string;
  setDatasetOverride: Dispatch<SetStateAction<string>>;
  isRealRobot: boolean;
  imageKeysFromCheckpoint: string[];
  cameraConfigOpen: boolean;
  setCameraConfigOpen: Dispatch<SetStateAction<boolean>>;
  cameraMapping: Record<string, string>;
  setCameraMapping: Dispatch<SetStateAction<Record<string, string>>>;
  mappedCamEntries: [string, string][];
  calibrationProfiles: EvalCalibrationProfile[];
  onCalibrationIdChange: (configKey: string, value: string) => void;
  armLists: MappedArmLists;
  armSelection: ArmSelection;
  preferredTypes: PreferredArmTypes;
  onArmSelectionChange: (selection: ArmSelection) => void;
  onArmConfigResolved: (config: ResolvedArmConfig) => void;
  evalCalibFiles: CalibrationListFile[];
  robotMode: "single" | "bi";
  computeDeviceOptions: Array<string | { value: string; label: string; disabled?: boolean }>;
}

export function EvalSettingsPanel({
  policySource,
  setPolicySource,
  policyPath,
  checkpoints,
  onCheckpointChange,
  updateConfig,
  deviceLabel,
  setDeviceLabel,
  numEpisodes,
  setNumEpisodes,
  datasetRepo,
  setDatasetRepo,
  envType,
  envTypes,
  envTypeFromCheckpoint,
  envTypeMissing,
  envTaskFromCheckpoint,
  envTaskMissing,
  task,
  advOpen,
  setAdvOpen,
  datasetOverride,
  setDatasetOverride,
  isRealRobot,
  imageKeysFromCheckpoint,
  cameraConfigOpen,
  setCameraConfigOpen,
  cameraMapping,
  setCameraMapping,
  mappedCamEntries,
  calibrationProfiles,
  onCalibrationIdChange,
  armLists,
  armSelection,
  preferredTypes,
  onArmSelectionChange,
  onArmConfigResolved,
  evalCalibFiles,
  robotMode,
  computeDeviceOptions,
}: EvalSettingsPanelProps) {
  void calibrationProfiles;
  void onCalibrationIdChange;

  return (
    <div className="flex flex-col gap-4">
      <Card title="Evaluation Settings" bodyClassName="flex flex-col gap-4">
        <div>
          <div className="text-sm text-fg-muted mb-1.5">Policy Source</div>
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <SubTabs
              size="sm"
              className="flex-none"
              tabs={[
                { key: "local", label: "Local" },
                { key: "hf", label: "HF" },
              ]}
              activeKey={policySource}
              onChange={(k) => setPolicySource(k as "local" | "hf")}
            />
            <div className="flex-1 min-w-0">
              {policySource === "local" ? (
                checkpoints.length === 0 ? (
                  <div className="text-sm text-warn">
                    No checkpoints found. Train a model first.
                  </div>
                ) : (
                  <select
                    value={policyPath}
                    onChange={(e) => onCheckpointChange(e.target.value)}
                    aria-label="Local checkpoint"
                    className={selectClassName}
                  >
                    {checkpoints.map((cp) => (
                      <option key={cp.path} value={cp.path}>
                        {cp.display ??
                          (cp.step
                            ? `${cp.name} (step ${cp.step.toLocaleString()})`
                            : cp.name)}
                      </option>
                    ))}
                  </select>
                )
              ) : (
                <input
                  type="text"
                  value={policyPath}
                  placeholder="e.g. lerobot/act_pusht_diffusion"
                  onChange={(e) =>
                    updateConfig({ eval_policy_path: e.target.value })
                  }
                  aria-label="Hugging Face policy path"
                  className={inputClassName}
                />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-fg-muted mb-1.5">Device</div>
            <select
              value={deviceLabel}
              onChange={(e) => setDeviceLabel(e.target.value)}
              aria-label="Evaluation device"
              className={selectClassName}
            >
              {computeDeviceOptions.map((option) => {
                const value = typeof option === "string" ? option : option.value;
                const label = typeof option === "string" ? option : option.label;
                const disabled = typeof option === "string" ? false : Boolean(option.disabled);
                return <option key={value} value={value} disabled={disabled}>{label}</option>;
              })}
            </select>
          </div>
          <div>
            <div className="text-sm text-fg-muted mb-1.5">Number of Episodes</div>
            <input
              type="number"
              value={numEpisodes}
              onChange={(e) => setNumEpisodes(Number(e.target.value))}
              min={1}
              max={100}
              aria-label="Number of episodes"
              className={inputClassName}
            />
          </div>
          <div>
            <div className="text-sm text-fg-muted mb-1.5">Dataset Repo ID</div>
            <input
              type="text"
              value={datasetRepo}
              onChange={(e) => setDatasetRepo(e.target.value)}
              aria-label="Dataset repository ID"
              className={inputClassName}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-fg-muted mb-1.5">
              Env Type
              {envTypeFromCheckpoint && (
                <span className="text-xs text-ok ml-1.5">
                  from checkpoint
                </span>
              )}
              {envTypeMissing && (
                <span className="text-xs text-fg-muted ml-1.5">(required)</span>
              )}
            </div>
            <select
              value={envType}
              onChange={(e) => updateConfig({ eval_env_type: e.target.value })}
              aria-label="Environment type"
              className={selectClassName}
            >
              <option value="">- Select env type -</option>
              {envTypes.map((et) => (
                <option key={et.type} value={et.type} disabled={!et.installed}>
                  {et.label}
                  {et.installed ? "" : " (not installed)"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-sm text-fg-muted mb-1.5">
              Task
              {envTaskFromCheckpoint && (
                <span className="text-xs text-ok ml-1.5">
                  from checkpoint
                </span>
              )}
              {envTaskMissing && (
                <span className="text-xs text-fg-muted ml-1.5">(required)</span>
              )}
            </div>
            <input
              type="text"
              value={task}
              placeholder="e.g. Pick up the block"
              onChange={(e) => updateConfig({ eval_task: e.target.value })}
              aria-label="Evaluation task"
              className={inputClassName}
            />
          </div>
        </div>

        <button
          onClick={() => setAdvOpen(!advOpen)}
          className="flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg-body transition-colors cursor-pointer w-fit"
          aria-expanded={advOpen}
          aria-label="Toggle advanced evaluation settings"
        >
          {advOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          Advanced Settings
        </button>
        {advOpen && (
          <div className="pl-3 border-l-2 border-line-subtle">
            <div className="text-sm text-fg-muted mb-1.5">
              Dataset Override <span className="text-fg-body">(optional)</span>
            </div>
            <input
              type="text"
              value={datasetOverride}
              onChange={(e) => setDatasetOverride(e.target.value)}
              placeholder="Override with different dataset repo"
              aria-label="Dataset override"
              className={inputClassName}
            />
          </div>
        )}

        {isRealRobot && (
          <div className="border-t border-line-subtle pt-3 flex flex-col gap-3">
            <div className="text-sm font-medium text-fg-body">Robot Configuration</div>
            <ArmPairSelector
              mode={robotMode === "bi" ? "Bi-Arm" : "Single Arm"}
              armLists={armLists}
              calibFiles={evalCalibFiles}
              selection={armSelection}
              preferredTypes={preferredTypes}
              onSelectionChange={onArmSelectionChange}
              onConfigResolved={onArmConfigResolved}
            />
          </div>
        )}

        {isRealRobot && imageKeysFromCheckpoint.length > 0 && (
          <div className="border-t border-line-subtle pt-3 flex flex-col gap-2">
            <button
              type="button"
              className="flex w-full items-center justify-between cursor-pointer bg-transparent p-0 text-left"
              onClick={() => setCameraConfigOpen(!cameraConfigOpen)}
              aria-expanded={cameraConfigOpen}
              aria-label="Toggle camera mapping"
            >
              <div className="flex items-center gap-2">
                <Video
                  size={12}
                  className="text-ok"
                />
                <span className="text-sm font-medium text-fg-body">
                  Camera Mapping
                </span>
                <span className="text-xs text-fg-muted">
                  {Object.values(cameraMapping).filter(Boolean).length}/
                  {imageKeysFromCheckpoint.length} mapped
                </span>
              </div>
              {cameraConfigOpen ? (
                <ChevronUp size={10} className="text-fg-muted" />
              ) : (
                <ChevronDown size={10} className="text-fg-muted" />
              )}
            </button>
            {cameraConfigOpen && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-fg-muted">
                  Map policy image keys to actual cameras.
                </p>
                {mappedCamEntries.length === 0 && (
                  <p className="text-sm text-warn">
                    No mapped cameras. Set up cameras in Device Setup first.
                  </p>
                )}
                {imageKeysFromCheckpoint.map((key) => (
                  <div key={key} className="flex flex-col gap-1">
                    <code className="text-xs font-mono text-fg-muted bg-surface-sunken px-1.5 py-0.5 rounded self-start max-w-full truncate">
                      {key}
                    </code>
                    <select
                      value={cameraMapping[key] || ""}
                      onChange={(e) =>
                        setCameraMapping((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      aria-label={`Camera mapping for ${key}`}
                      className={selectClassName}
                    >
                      <option value="">- Select -</option>
                      {mappedCamEntries.map(([sym, path]) => (
                        <option key={sym} value={sym}>
                          {sym} ({path})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {Object.values(cameraMapping).some((v) => !v) && (
                  <p className="text-sm text-warn">
                    ⚠ Unmapped cameras detected. Evaluation may fail.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
