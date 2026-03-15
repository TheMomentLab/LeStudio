import { AlertTriangle, RotateCcw } from "lucide-react";

import { buttonStyles } from "../../../components/ui/button";

type TrainOomBannerProps = {
  visible: boolean;
  onRetry: () => void;
  message?: string;
  retryLabel?: string;
};

export function TrainOomBanner({
  visible,
  onRetry,
  message = "VRAM insufficient for current config. Try reducing Training Steps or switching device to CPU/MPS.",
  retryLabel = "Retry",
}: TrainOomBannerProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3.5 flex items-start gap-2.5">
      <AlertTriangle size={14} className="text-red-600 dark:text-red-400 flex-none mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">GPU Out of Memory (OOM)</p>
        <p className="text-sm text-zinc-400">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className={buttonStyles({
          variant: "secondary",
          tone: "danger",
          className: "h-auto px-3 py-1.5 gap-1",
        })}
      >
        <RotateCcw size={12} /> {retryLabel}
      </button>
    </div>
  );
}
