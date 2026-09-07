export function GpuBar({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = Math.round((value / max) * 100);
  const color = pct >= 90 ? "bg-danger-solid" : pct >= 70 ? "bg-warn-solid" : "bg-fg-muted";
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-fg-muted w-20 flex-none">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-surface-raised overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-mono text-fg-muted w-24 text-right flex-none">
        {value} / {max} {unit} <span className="text-fg-muted">({pct}%)</span>
      </span>
    </div>
  );
}
