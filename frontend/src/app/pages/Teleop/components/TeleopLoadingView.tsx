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
      <Loader2 size={32} className="text-fg-muted animate-spin" />
      <div className="flex flex-col gap-2">
        {steps.map((step, index) => {
          const isActive = index === loadingStep - 1;
          const isWaiting = isActive && loadingWaitingInput && !!step.waitPattern;
          return (
            <div key={step.label} className="flex items-center gap-2.5">
              {index < loadingStep ? (
                isWaiting ? (
                  <div className="size-3.5 rounded-full bg-warn-solid flex-none animate-pulse" />
                ) : (
                  <CheckCircle2 size={14} className="text-ok flex-none" />
                )
              ) : index === loadingStep ? (
                <Loader2 size={14} className="text-fg-muted animate-spin flex-none" />
              ) : (
                <div className="size-3.5 rounded-full border border-line-strong flex-none" />
              )}
              <span
                className={cn(
                  "text-sm",
                  isWaiting
                    ? "text-warn font-medium"
                    : index < loadingStep
                      ? "text-fg-muted"
                      : index === loadingStep
                        ? "text-fg-heading"
                        : "text-fg-body",
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
