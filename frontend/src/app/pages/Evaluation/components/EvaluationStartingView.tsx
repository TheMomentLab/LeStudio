import { CheckCircle2, Loader2 } from "lucide-react";

import { cn } from "../../../components/ui/utils";

type EvaluationStartingViewProps = {
  steps: Array<{ label: string }>;
  startingStep: number;
  envLabel: string;
  numEpisodes: number;
  policyPath: string;
};

export function EvaluationStartingView({
  steps,
  startingStep,
  envLabel,
  numEpisodes,
  policyPath,
}: EvaluationStartingViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16 gap-6">
      <Loader2 size={32} className="text-fg-muted animate-spin" />
      <div className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-2.5">
            {index < startingStep ? (
              <CheckCircle2 size={14} className="text-ok flex-none" />
            ) : index === startingStep ? (
              <Loader2 size={14} className="text-fg-muted animate-spin flex-none" />
            ) : (
              <div className="size-3.5 rounded-full border border-line-strong flex-none" />
            )}
            <span
              className={cn(
                "text-sm",
                index < startingStep
                  ? "text-fg-muted"
                  : index === startingStep
                    ? "text-fg-heading"
                    : "text-fg-disabled",
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-sm text-fg-muted">
        {envLabel} · {numEpisodes} episodes · {policyPath.split("/").pop() || policyPath}
      </p>
    </div>
  );
}
