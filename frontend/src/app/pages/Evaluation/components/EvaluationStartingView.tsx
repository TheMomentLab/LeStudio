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
      <Loader2 size={32} className="text-zinc-400 animate-spin" />
      <div className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-2.5">
            {index < startingStep ? (
              <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 flex-none" />
            ) : index === startingStep ? (
              <Loader2 size={14} className="text-zinc-400 animate-spin flex-none" />
            ) : (
              <div className="size-3.5 rounded-full border border-zinc-600 flex-none" />
            )}
            <span
              className={cn(
                "text-sm",
                index < startingStep
                  ? "text-zinc-400"
                  : index === startingStep
                    ? "text-zinc-800 dark:text-zinc-200"
                    : "text-zinc-500 dark:text-zinc-600",
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <p className="text-sm text-zinc-500">
        {envLabel} · {numEpisodes} episodes · {policyPath.split("/").pop() || policyPath}
      </p>
    </div>
  );
}
