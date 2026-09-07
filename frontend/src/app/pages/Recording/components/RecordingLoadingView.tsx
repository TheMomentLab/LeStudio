import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "../../../components/ui/utils";

type RecordingLoadingViewProps = {
  loadingStep: number;
  steps: { label: string }[];
};

export function RecordingLoadingView({ loadingStep, steps }: RecordingLoadingViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16 gap-6">
      <Loader2 size={32} className="text-fg-muted animate-spin" />
      <div className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-2.5">
            {i < loadingStep ? (
              <CheckCircle2 size={14} className="text-ok flex-none" />
            ) : i === loadingStep ? (
              <Loader2 size={14} className="text-fg-muted animate-spin flex-none" />
            ) : (
              <div className="size-3.5 rounded-full border border-line-strong flex-none" />
            )}
            <span className={cn("text-sm",
              i < loadingStep ? "text-fg-muted" :
              i === loadingStep ? "text-fg-heading" : "text-fg-body"
            )}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
