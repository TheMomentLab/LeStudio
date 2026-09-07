import { cn } from "../../../components/ui/utils";
import type { RewardTooltipEntry } from "../types";

export function RewardTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: RewardTooltipEntry[];
}) {
  const ep = payload?.[0]?.payload;
  if (!active || !ep) return null;
  return (
    <div className="px-3 py-2 rounded border border-line-strong bg-surface text-sm shadow-xl">
      <div className="text-fg-muted mb-1">Episode {ep.ep}</div>
      <div className={ep.success ? "text-ok" : "text-danger"}>
        Reward: {ep.reward.toFixed(3)}
      </div>
      <div className="text-fg-muted">Frames: {ep.frames}</div>
      <div className={cn("mt-0.5", ep.success ? "text-ok" : "text-fg-muted")}>
        {ep.success ? "✓ Success" : "✗ Failed"}
      </div>
    </div>
  );
}
