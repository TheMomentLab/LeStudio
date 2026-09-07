import type { LossTooltipEntry } from "../types";

export function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: LossTooltipEntry[];
  label?: number | string;
}) {
  if (!active || !payload?.length) return null;
  const loss = payload[0]?.value;
  if (typeof loss !== "number") return null;

  return (
    <div className="px-3 py-2 rounded border border-line-strong bg-surface text-sm font-mono shadow-xl">
      <div className="text-fg-muted mb-1">Step {label?.toLocaleString()}</div>
      <div className="text-fg-heading">loss: {loss.toFixed(5)}</div>
    </div>
  );
}
