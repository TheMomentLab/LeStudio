import { HardDrive, Cloud } from "lucide-react";
import { Card, SubTabs, WireInput, WireToggle, inputClassName } from "../../../components/wireframe";
import { useLeStudioStore } from "../../../store";
import { cn } from "../../../components/ui/utils";

type RecordingPlanTabProps = {
  totalEps: number;
  recordRepoId: string;
  recordTask: string;
  resumeEnabled: boolean;
  hfAuth: string;
  availableDatasets: string[];
  datasetStorageMode: "local" | "hf";
  localDatasetRoot: string;
  setTotalEps: (value: number) => void;
  setRecordRepoId: (value: string) => void;
  setRecordTask: (value: string) => void;
  setResumeEnabled: (value: boolean) => void;
  setDatasetStorageMode: (value: "local" | "hf") => void;
  setLocalDatasetRoot: (value: string) => void;
};

export function RecordingPlanTab({
  totalEps,
  recordRepoId,
  recordTask,
  resumeEnabled,
  hfAuth,
  availableDatasets,
  datasetStorageMode,
  localDatasetRoot,
  setTotalEps,
  setRecordRepoId,
  setRecordTask,
  setResumeEnabled,
  setDatasetStorageMode,
  setLocalDatasetRoot,
}: RecordingPlanTabProps) {
  const hfUsername = useLeStudioStore((s) => s.hfUsername);
  const isLocal = datasetStorageMode === "local";
  const prefix = !isLocal && hfUsername ? `${hfUsername}/` : "";

  // Strip prefix for display; keep full repo id in state
  const datasetName = prefix && recordRepoId.startsWith(prefix)
    ? recordRepoId.slice(prefix.length)
    : recordRepoId;

  const handleNameChange = (val: string) => {
    if (isLocal) {
      // Local mode: repo_id is just a name (no prefix needed)
      setRecordRepoId(val);
    } else {
      // HF mode: if user types a full "user/name" keep it; otherwise prepend prefix
      if (val.includes("/")) {
        setRecordRepoId(val);
      } else {
        setRecordRepoId(prefix + val);
      }
    }
  };

  // Suggestion list: show only dataset-name part (strip matching prefix)
  const suggestions = availableDatasets.map((id) =>
    prefix && id.startsWith(prefix) ? id.slice(prefix.length) : id,
  );


  return (
        <Card title="Episode Settings" bodyClassName="flex flex-col gap-3">
      {/* Storage mode toggle */}
      <div>
        <div className="text-sm text-fg-muted mb-1.5">Dataset Storage</div>
        <SubTabs
          size="sm"
          tabs={[
            { key: "local", icon: <HardDrive size={13} />, label: "Local" },
            { key: "hf", icon: <Cloud size={13} />, label: "HF Hub" },
          ]}
          activeKey={isLocal ? "local" : "hf"}
          onChange={(k) => setDatasetStorageMode(k === "hf" ? "hf" : "local")}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-fg-muted mb-1.5">Number of Episodes</div>
          <input
            type="number"
            value={totalEps}
            onChange={(e) => setTotalEps(Math.max(1, Number(e.target.value) || 1))}
            aria-label="Number of episodes"
            className={inputClassName}
          />
        </div>
        <div>
          <div className="text-sm text-fg-muted mb-1.5">
            {isLocal ? "Dataset Name" : "Dataset Repo ID"}
          </div>
          <div className="flex items-stretch">
            {!isLocal && prefix && (
              <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-line-control bg-surface-sunken text-fg-muted text-sm select-none whitespace-nowrap">
                {prefix}
              </span>
            )}
            <input
              list="dataset-repo-options"
              value={datasetName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="my-dataset"
              aria-label={isLocal ? "Dataset name" : "Dataset repository ID"}
              className={cn(inputClassName, "flex-1 min-w-0", !isLocal && prefix && "rounded-l-none")}
            />
            <datalist id="dataset-repo-options">
              {suggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        </div>
      </div>

      {/* Local root path — only shown in local mode */}
      {isLocal && (
        <div>
          <div className="text-sm text-fg-muted mb-1.5">Local Root Path</div>
          <input
            value={localDatasetRoot}
            onChange={(e) => setLocalDatasetRoot(e.target.value)}
            placeholder="~/.cache/huggingface/lerobot"
            aria-label="Local dataset root path"
            className={inputClassName}
          />
          <div className="text-xs text-fg-muted mt-1">
            Dataset will be saved to: <span className="font-mono">{localDatasetRoot || "~/.cache/huggingface/lerobot"}/{recordRepoId.includes("/") ? recordRepoId : `local/${recordRepoId || "my-dataset"}`}</span>
          </div>
        </div>
      )}

      <div>
        <div className="text-sm text-fg-muted mb-1.5">Task Description</div>
        <WireInput value={recordTask} onChange={setRecordTask} placeholder="Pick the red cube and place it..." />
      </div>
      <div className="pt-1">
        <WireToggle label="Resume — continue recording to existing dataset" checked={resumeEnabled} onChange={setResumeEnabled} />
        {!isLocal && hfAuth !== "ready" && (
          <div className="mt-2 text-sm text-warn flex items-center gap-1">
            HF login required to push to Hub
          </div>
        )}
      </div>
    </Card>
  );
}
