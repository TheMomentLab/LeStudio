import { ChevronDown, ChevronUp } from "lucide-react";

import { Card, FieldRow, ModeToggle, WireSelect, inputClassName } from "../../../components/wireframe";
import { cn } from "../../../components/ui/utils";
import { POLICY_TYPES, PRESETS, type PresetKey } from "../types";

interface TrainSettingsPanelProps {
  policyType: string;
  setPolicyType: (value: string) => void;
  datasetSource: "local" | "hf";
  setDatasetSource: (value: "local" | "hf") => void;
  hfAuth: string;
  selectedLocalDataset: string;
  setSelectedLocalDataset: (value: string) => void;
  availableDatasets: string[];
  hfDatasets: string[];
  hfDatasetRepoId: string;
  setHfDatasetRepoId: (value: string) => void;
  device: string;
  setDevice: (value: string) => void;
  preset: PresetKey;
  customSteps: number;
  setCustomSteps: (value: number) => void;
  setPreset: (value: PresetKey) => void;
  handlePreset: (key: PresetKey) => void;
  advOpen: boolean;
  setAdvOpen: (value: boolean) => void;
  lrValue: string;
  setLrValue: (value: string) => void;
  batchSize: number;
  setBatchSize: (value: number) => void;
  modelOutputRepo: string;
  setModelOutputRepo: (value: string) => void;
  computeDeviceOptions: Array<string | { value: string; label: string; disabled?: boolean }>;
}

export function TrainSettingsPanel({
  policyType,
  setPolicyType,
  datasetSource,
  setDatasetSource,
  hfAuth,
  selectedLocalDataset,
  setSelectedLocalDataset,
  availableDatasets,
  hfDatasets,
  hfDatasetRepoId,
  setHfDatasetRepoId,
  device,
  setDevice,
  preset,
  customSteps,
  setCustomSteps,
  setPreset,
  handlePreset,
  advOpen,
  setAdvOpen,
  lrValue,
  setLrValue,
  batchSize,
  setBatchSize,
  modelOutputRepo,
  setModelOutputRepo,
  computeDeviceOptions,
}: TrainSettingsPanelProps) {
  return (
    <Card title="Training Config" bodyClassName="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-4 md:gap-0 md:items-start">
        <div className="md:pr-4">
          <div className="text-sm text-fg-muted mb-1.5">Policy Type</div>
          <WireSelect
            value={policyType}
            options={POLICY_TYPES}
            onChange={setPolicyType}
          />
        </div>

        <div className="hidden md:block bg-line" />

        <div className="md:pl-4">
          <div className="text-sm text-fg-muted mb-1.5">Dataset</div>
          <div className="flex items-center gap-1.5">
            <ModeToggle
              size="sm"
              options={["Local", "HF"]}
              value={datasetSource === "local" ? "Local" : "HF"}
              onChange={(v) => {
                if (v === "HF" && hfAuth !== "ready") return;
                setDatasetSource(v === "Local" ? "local" : "hf");
              }}
            />
            <div className="flex-1 min-w-0">
              {datasetSource === "local" ? (
                availableDatasets.length > 0 ? (
                  <WireSelect
                    value={selectedLocalDataset}
                    options={availableDatasets}
                    onChange={setSelectedLocalDataset}
                  />
                ) : (
                  <input
                    value={selectedLocalDataset}
                    onChange={(e) => setSelectedLocalDataset(e.target.value)}
                    placeholder="username/dataset-name"
                    aria-label="Local dataset repository ID"
                    className={inputClassName}
                  />
                )
              ) : hfDatasets.length > 0 ? (
                <WireSelect
                  value={hfDatasetRepoId}
                  options={hfDatasets}
                  onChange={setHfDatasetRepoId}
                />
              ) : (
                <input
                  value={hfDatasetRepoId}
                  onChange={(e) => setHfDatasetRepoId(e.target.value)}
                  placeholder="username/dataset-name"
                  aria-label="Hugging Face dataset repository ID"
                  className={inputClassName}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-4 md:gap-0 pt-4 border-t border-line-subtle md:items-start">
        <div className="md:pr-4">
          <div className="text-sm text-fg-muted mb-1.5">Compute Device</div>
          <WireSelect
            value={device}
            options={computeDeviceOptions}
            onChange={setDevice}
          />
          {device === "MPS (Apple Silicon)" && (
            <p className="text-sm text-warn mt-1">⚠ Colab automatically uses CUDA.</p>
          )}
        </div>

        <div className="hidden md:block bg-line" />

        <div className="md:pl-4">
          <div className="text-sm text-fg-muted mb-1.5">Training Steps</div>
          <div className="flex items-center gap-2">
            <ModeToggle
              size="sm"
              options={Object.values(PRESETS).map((p) => `${p.label} (${p.tag})`)}
              value={`${PRESETS[preset].label} (${PRESETS[preset].tag})`}
              onChange={(v) => {
                const key = (Object.entries(PRESETS) as [PresetKey, typeof PRESETS[PresetKey]][]).find(([, p]) => `${p.label} (${p.tag})` === v)?.[0];
                if (key) handlePreset(key);
              }}
            />
            <input
              type="number"
              value={customSteps}
              onChange={(e) => { setCustomSteps(Number(e.target.value)); setPreset("standard"); }}
              aria-label="Training steps"
              className={cn(inputClassName, "w-24 font-mono")}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-line-subtle pt-3">
        <button
          onClick={() => setAdvOpen(!advOpen)}
          className="flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg-body transition-colors cursor-pointer w-fit"
          aria-expanded={advOpen}
          aria-label="Toggle advanced training overrides"
        >
          {advOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          Advanced Overrides
        </button>
        {advOpen && (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] md:gap-0 gap-3 mt-3">
            <div className="md:pr-4 flex flex-col gap-3">
              <FieldRow label="Learning Rate">
                <input
                  type="text"
                  value={lrValue}
                  onChange={(e) => setLrValue(e.target.value)}
                  aria-label="Learning rate"
                  className={cn(inputClassName, "font-mono")}
                />
              </FieldRow>
              <FieldRow label="Batch Size">
                <input
                  type="number"
                  min={1}
                  value={batchSize || ""}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  placeholder="default (8)"
                  aria-label="Batch size"
                  className={cn(inputClassName, "font-mono")}
                />
              </FieldRow>
            </div>
            <div className="hidden md:block bg-line" />
            <div className="md:pl-4">
              <FieldRow label="Output Repo">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={modelOutputRepo}
                    onChange={(e) => setModelOutputRepo(e.target.value)}
                    placeholder="username/model-name (optional)"
                    disabled={hfAuth !== "ready"}
                    aria-label="Output model repository"
                    className={cn(
                      inputClassName,
                      hfAuth !== "ready" && "border-warn-line bg-warn-bg text-fg-muted",
                    )}
                  />
                  {hfAuth !== "ready" && (
                    <span className="text-sm text-warn whitespace-nowrap">🔒 HF</span>
                  )}
                </div>
              </FieldRow>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
