import { CheckCircle2, Loader2 } from "lucide-react";

import { cn } from "../../../components/ui/utils";

type TeleopLoadingViewProps = {
  loadingStep: number;
  loadingWaitingInput: boolean;
  steps: Array<{ label: string; waitPattern?: RegExp }>;
};

export function TeleopLoadingView({
  loadingStep,
  loadingWaitingInput,
  steps,
}: TeleopLoadingViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16 gap-6">
      <Loader2 size={32} className="text-zinc-400 animate-spin" />
      <div className="flex flex-col gap-2">
        {steps.map((step, index) => {
          const isActive = index === loadingStep - 1;
          const isWaiting = isActive && loadingWaitingInput && !!step.waitPattern;
          return (
            <div key={step.label} className="flex items-center gap-2.5">
              {index < loadingStep ? (
                isWaiting ? (
                  <div className="size-3.5 rounded-full bg-amber-500 flex-none animate-pulse" />
                ) : (
                  <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 flex-none" />
                )
              ) : index === loadingStep ? (
                <Loader2 size={14} className="text-zinc-400 animate-spin flex-none" />
              ) : (
                <div className="size-3.5 rounded-full border border-zinc-600 flex-none" />
              )}
              <span
                className={cn(
                  "text-sm",
                  isWaiting
                    ? "text-amber-600 dark:text-amber-400 font-medium"
                    : index < loadingStep
                      ? "text-zinc-400"
                      : index === loadingStep
                        ? "text-zinc-800 dark:text-zinc-200"
                        : "text-zinc-600",
                )}
              >
                {isWaiting ? "Waiting for calibration - press ENTER in console ↓" : step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
