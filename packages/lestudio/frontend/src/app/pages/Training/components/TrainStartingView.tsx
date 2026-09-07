import { CheckCircle2, Loader2 } from "lucide-react";

import { cn } from "../../../components/ui/utils";
import { LOCAL_DATASETS, STARTING_STEPS } from "../types";

interface TrainStartingViewProps {
  startingStep: number;
  policyType: string;
  datasetSource: "local" | "hf";
  customSteps: number;
  availableDatasets: string[];
}

export function TrainStartingView({
  startingStep,
  policyType,
  datasetSource,
  customSteps,
  availableDatasets,
}: TrainStartingViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16 gap-6">
      <Loader2 size={32} className="text-fg-muted animate-spin" />
      <div className="flex flex-col gap-2">
        {STARTING_STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2.5">
            {i < startingStep ? (
              <CheckCircle2 size={14} className="text-ok flex-none" />
            ) : i === startingStep ? (
              <Loader2 size={14} className="text-fg-muted animate-spin flex-none" />
            ) : (
              <div className="size-3.5 rounded-full border border-line-strong flex-none" />
            )}
            <span className={cn("text-sm",
              i < startingStep ? "text-fg-muted" :
              i === startingStep ? "text-fg-heading" : "text-fg-disabled"
            )}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-sm text-fg-muted">
        {policyType} · {datasetSource === "local" ? (availableDatasets[0] ?? LOCAL_DATASETS[0]) : "HF dataset"} · {customSteps.toLocaleString()} steps
      </p>
    </div>
  );
}
