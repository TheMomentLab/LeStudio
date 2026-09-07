import React from "react";
import { Link } from "react-router";
import { Play, Square, AlertTriangle, RefreshCw, CheckCircle, AlertCircle, Circle, Loader2 } from "lucide-react";
import { buttonStyles } from "../ui/button";
import { cn } from "../ui/utils";

// ─── Status Badge ─────────────────────────────────────────────────────────────
type StatusType = "running" | "ready" | "loading" | "warning" | "error" | "idle" | "blocked";
export function StatusBadge({
  status,
  label,
  pulse,
}: {
  status: StatusType;
  label?: string;
  pulse?: boolean;
}) {
  const colorMap: Record<StatusType, string> = {
    running: "text-ok",
    ready: "text-ok",
    loading: "text-info",
    warning: "text-warn",
    error: "text-danger",
    idle: "text-fg-muted",
    blocked: "text-warn",
  };
  const iconMap: Record<StatusType, React.ReactNode> = {
    running: <span className="relative flex size-3.5 items-center justify-center"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok-solid opacity-40" /><span className="relative inline-flex size-2 rounded-full bg-ok-solid" /></span>,
    ready: <CheckCircle size={14} />,
    loading: <Loader2 size={14} className="animate-spin" />,
    warning: <AlertTriangle size={14} />,
    error: <AlertCircle size={14} />,
    idle: <Circle size={14} />,
    blocked: <AlertTriangle size={14} />,
  };
  return (
    <span
      className={cn("inline-flex items-center", colorMap[status], pulse && "animate-pulse")}
      title={label ?? status.toUpperCase()}
    >
      {iconMap[status]}
    </span>
  );
}

// ─── Wire Box (gray placeholder) ──────────────────────────────────────────────
export function WireBox({
  className,
  label,
  children,
  aspectRatio,
}: {
  className?: string;
  label?: string;
  children?: React.ReactNode;
  aspectRatio?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded border border-dashed",
        "border-line-strong bg-surface-sunken",
        "text-fg-muted text-sm font-mono select-none",
        className
      )}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {label && <span className="px-2 text-center">{label}</span>}
      {children}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({
  step,
  title,
  titleSub,
  action,
  className,
  bodyClassName,
  titleClassName,
  icon,
  children,
  badge,
}: {
  step?: string | number;
  /** Small leading icon (13px lucide) shown before the title. */
  icon?: React.ReactNode;
  title?: string;
  titleSub?: string;
  action?: React.ReactNode;
  className?: string;
  /** e.g. `font-mono` when the title is a path / repo id. */
  titleClassName?: string;
  /** Overrides the default `p-4` body, e.g. `p-0` for flush lists/charts. */
  bodyClassName?: string;
  children?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface",
        "flex flex-col",
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between px-4 py-3 bg-surface-muted border-b border-line">
          <div className="flex items-center gap-2">
            {step !== undefined && (
              <span className="flex-none size-5 rounded bg-surface-raised text-fg-muted text-sm flex items-center justify-center font-mono">
                {step}
              </span>
            )}
            <div className="flex items-center gap-2">
              {icon && <span className="text-fg-muted flex-none [&>svg]:block">{icon}</span>}
              {title?.includes("—") ? (
                <>
                  <span className="text-sm font-medium text-fg-body">
                    {title.split("—")[0].trim()}
                  </span>
                  <span className="text-sm text-fg-muted">
                    {title.split("—")[1].trim()}
                  </span>
                </>
              ) : (
                <span className={cn("text-sm font-medium text-fg-body", titleClassName)}>{title}</span>
              )}
              {badge}
            </div>
            {titleSub && (
              <span className="text-sm text-fg-muted">{titleSub}</span>
            )}
          </div>
          {action && <div className="ml-4 flex-none">{action}</div>}
        </div>
      )}
      {/* `grow` (not `flex-1`): flex-basis stays auto, so a fixed body height like `h-56` is honoured. */}
      {!!children && <div className={cn("p-4 grow", bodyClassName)}>{children}</div>}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
export function SectionHeader({
  step,
  title,
  subtitle,
  badge,
  action,
}: {
  step?: string | number;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-start gap-2">
        {step !== undefined && (
          <span className="mt-0.5 flex-none size-5 rounded bg-surface-raised text-fg-muted text-sm flex items-center justify-center font-mono">
            {step}
          </span>
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-fg">{title}</span>
            {badge}
          </div>
          {subtitle && (
            <p className="text-sm text-fg-muted mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

// ─── Blocker Card ─────────────────────────────────────────────────────────────
export function BlockerCard({
  reasons,
  title = "Cannot Start",
  severity = "warning",
}: {
  reasons: (string | { text: string; to?: string })[];
  title?: string;
  severity?: "warning" | "error";
}) {
  const textReasons = reasons
    .map((r) => (typeof r === "string" ? r : r.text))
    .filter((text) => text && !text.includes("→"));
  const linkReasons = reasons.filter(
    (r): r is { text: string; to?: string } => typeof r !== "string" && Boolean(r.to)
  );

  const tone =
    severity === "error"
      ? {
          shell: "border-danger-line bg-danger-bg",
          text: "text-danger",
          action: "border-danger-line text-danger bg-danger-bg hover:bg-danger-bg",
        }
      : {
          shell: "border-warn-line bg-warn-bg",
          text: "text-warn",
          action: "border-warn-line text-warn bg-warn-bg hover:bg-warn-bg",
        };

  const message = textReasons.length > 0 ? textReasons.join(" · ") : title;

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border", tone.shell)}>
      <AlertTriangle size={13} className={cn("flex-none", tone.text)} />
      <span className={cn("text-sm flex-1", tone.text)}>
        {message}
      </span>
      {linkReasons.length > 0 && (
        <div className="ml-auto flex items-center gap-2">
          {linkReasons.map((r, i) => (
            <Link
              key={`${r.text}-${i}`}
              to={r.to!}
              className={cn(
                "px-2 py-1 rounded border text-sm transition-colors cursor-pointer whitespace-nowrap",
                tone.action
              )}
            >
              {r.text} →
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Process Buttons ──────────────────────────────────────────────────────────
export function ProcessButtons({
  running,
  onStart,
  onStop,
  startLabel,
  disabled,
  fullWidth = true,
  compact = false,
  className,
  buttonClassName,
}: {
  running: boolean;
  onStart?: () => void;
  onStop?: () => void;
  startLabel?: React.ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  compact?: boolean;
  className?: string;
  buttonClassName?: string;
}) {
  const sizeClassName = compact ? "h-auto px-4 py-2 gap-1.5" : "h-auto px-5 py-2.5 gap-1.5";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {!running ? (
        <button
          type="button"
          onClick={onStart}
          disabled={disabled}
          aria-label={typeof startLabel === "string" ? startLabel : "Start process"}
          className={cn(
            buttonStyles({
              variant: "primary",
              tone: "success",
              className: cn(
                sizeClassName,
                "disabled:border-line disabled:bg-surface-sunken disabled:text-fg-disabled",
              ),
            }),
            fullWidth && "w-full",
            buttonClassName
          )}
        >
          {startLabel ?? <><Play size={13} className="fill-current" /> Start</>}
        </button>
      ) : (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop process"
          className={cn(
            buttonStyles({
              variant: "primary",
              tone: "danger",
              className: sizeClassName,
            }),
            fullWidth && "w-full",
            buttonClassName
          )}
        >
          <Square size={11} className="fill-current" /> Stop
        </button>
      )}
    </div>
  );
}

// ─── Field Row ────────────────────────────────────────────────────────────────
export function FieldRow({
  label,
  align = "center",
  children,
}: {
  label: string;
  align?: "center" | "start";
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex gap-3 min-h-9", align === "start" ? "items-start" : "items-center")}>
      <span className={cn("text-sm font-medium text-fg-body whitespace-nowrap flex-none w-[160px]", align === "start" && "pt-2")}>{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ─── Form control classes ─────────────────────────────────────────────────────
// Native <input>/<select> that cannot go through WireInput/WireSelect (number
// inputs, extra attributes) should use these so they look identical.
export const inputClassName =
  "w-full h-9 px-3 py-2 rounded-lg border border-line-control bg-surface-input text-fg-heading text-sm outline-none placeholder:text-fg-muted hover:border-line-strong focus:border-focus-ring focus:ring-2 focus:ring-focus-ring-alpha transition-all disabled:opacity-50 disabled:cursor-not-allowed";
export const selectClassName =
  "w-full h-9 px-3 py-2 rounded-lg border border-line-control bg-surface-input text-fg-heading text-sm outline-none cursor-pointer hover:border-line-strong focus:border-focus-ring focus:ring-2 focus:ring-focus-ring-alpha transition-all disabled:opacity-50 disabled:cursor-not-allowed";

// ─── WireSelect ───────────────────────────────────────────────────────────────
type WireSelectOption = string | { value: string; label: string; disabled?: boolean };

export function WireSelect({ placeholder, value, options, onChange, disabled, className }: { placeholder?: string; value?: string; options?: WireSelectOption[]; onChange?: (v: string) => void; disabled?: boolean; className?: string }) {
  return (
    <select
      aria-label={placeholder ?? "Select option"}
      value={value ?? ""}
      onChange={onChange ? (e) => onChange(e.target.value) : () => {}}
      disabled={disabled}
      className={cn("w-full h-9 px-3 py-2 rounded-lg border border-line-control bg-surface-input text-fg-heading text-sm outline-none cursor-pointer hover:border-line-strong focus:border-focus-ring focus:ring-2 focus:ring-focus-ring-alpha transition-all", disabled && "opacity-50 cursor-not-allowed", className)}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options?.map((o) => {
        const val = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        const optionDisabled = typeof o === "string" ? false : Boolean(o.disabled);
        return <option key={val} value={val} disabled={optionDisabled}>{label}</option>;
      })}
    </select>
  );
}

// ─── WireInput ────────────────────────────────────────────────────────────────
export function WireInput({ placeholder, value, onChange, disabled }: { placeholder?: string; value?: string; onChange?: (v: string) => void; disabled?: boolean }) {
  const readOnly = !onChange;
  return (
    <input
      type="text"
      aria-label={placeholder ?? "Input value"}
      value={value ?? ""}
      readOnly={readOnly}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      disabled={disabled}
      className={cn("w-full h-9 px-3 py-2 rounded-lg border border-line-control bg-surface-input text-fg-heading text-sm outline-none placeholder:text-fg-muted hover:border-line-strong focus:border-focus-ring focus:ring-2 focus:ring-focus-ring-alpha transition-all", disabled && "opacity-50 cursor-not-allowed", readOnly && !disabled && "bg-surface-sunken text-fg-muted cursor-default border-transparent")}
    />
  );
}

// ─── Resource Bar ─────────────────────────────────────────────────────────────
export function ResourceBar({
  label,
  value,
  max,
  unit,
}: {
  label: string;
  value: number;
  max: number;
  unit?: string;
}) {
  const pct = Math.round((value / max) * 100);
  const color =
    pct >= 90 ? "bg-danger-solid" : pct >= 70 ? "bg-warn-solid" : "bg-ok-solid";
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-fg-muted w-24 flex-none truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-raised overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-fg-muted w-28 text-right flex-none whitespace-nowrap">
        {unit ? `${value} / ${max} ${unit}` : `${pct}%`}
      </span>
    </div>
  );
}

// ─── Page Header ──────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-bold text-fg tracking-tight">{title}</h1>
        </div>
        {subtitle && <p className="text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}


// ─── Sticky Control Bar ───────────────────────────────────────────────────────
export function StickyControlBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 mt-auto border-t border-line bg-surface-chrome/95 backdrop-blur px-6 h-12 flex items-center justify-between gap-4">
      {children}
    </div>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
export function WireToggle({
  label,
  checked,
  onChange,
}: {
  label?: string;
  checked?: boolean;
  onChange?: (v: boolean) => void;
}) {
  const controlled = checked !== undefined;
  const [internal, setInternal] = React.useState(checked ?? false);
  const on = controlled ? checked : internal;
  const toggle = () => { const next = !on; if (!controlled) setInternal(next); onChange?.(next); };
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-label={label ?? "Toggle"}
        aria-checked={on}
        className={cn(
          "w-8 h-4 rounded-full relative transition-colors",
          on ? "bg-ok-solid" : "bg-surface-raised"
        )}
        onClick={toggle}
      >
        <div
          className={cn(
            "absolute top-0.5 size-3 rounded-full bg-white transition-transform",
            on ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </button>
      {label && <span className="text-sm font-medium text-fg-body select-none">{label}</span>}
    </label>
  );
}

// ─── Mode Toggle ──────────────────────────────────────────────────────────────
// One segmented-control look for the whole app. `md` is the page-level tab /
// mode switch; `sm` sits inside forms next to h-9 inputs (Local/HF, presets).
export type PillSize = "sm" | "md";

const PILL_TRACK = "inline-flex gap-1 bg-surface-sunken rounded-lg w-fit";
const PILL_TRACK_PAD: Record<PillSize, string> = { md: "p-1", sm: "p-0.5" };
const PILL_BUTTON: Record<PillSize, string> = {
  md: "px-3.5 py-1.5 rounded-md text-sm",
  sm: "px-3 py-1 rounded-md text-sm",
};

function pillButtonClass(active: boolean, size: PillSize) {
  return cn(
    "flex items-center gap-1.5 font-medium transition-all cursor-pointer",
    PILL_BUTTON[size],
    active ? "bg-surface-elevated text-fg shadow-sm" : "text-fg-muted hover:text-fg-body",
  );
}

export function ModeToggle({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: string[];
  value: string;
  onChange?: (v: string) => void;
  size?: PillSize;
}) {
  return (
    <div className={cn(PILL_TRACK, PILL_TRACK_PAD[size])}>
      {options.map((o) => (
        <button
          type="button"
          key={o}
          aria-pressed={value === o}
          aria-label={`${o} mode`}
          onClick={() => { onChange?.(o); }}
          className={pillButtonClass(value === o, size)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// ─── Sub Tabs ────────────────────────────────────────────────────────────────
export type SubTabItem = {
  key: string;
  label: string;
  icon?: React.ReactNode;
};

export function SubTabs({
  tabs,
  activeKey,
  onChange,
  className,
  size = "md",
}: {
  tabs: readonly SubTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
  size?: PillSize;
}) {
  return (
    <div className={cn(PILL_TRACK, PILL_TRACK_PAD[size], className)}>
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.key}
          aria-pressed={activeKey === tab.key}
          onClick={() => onChange(tab.key)}
          className={pillButtonClass(activeKey === tab.key, size)}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  message,
  action,
  messageClassName,
  compact,
}: {
  icon?: React.ReactNode;
  message: React.ReactNode;
  action?: React.ReactNode;
  messageClassName?: string;
  /** Tight variant for fixed-size regions (preview boxes, short lists). */
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-4 gap-1.5" : "py-8 gap-3")}>
      {icon && <div className={cn("opacity-30", compact ? "text-xl" : "text-3xl")}>{icon}</div>}
      <p className={cn("text-sm text-fg-muted max-w-xs", messageClassName)}>{message}</p>
      {action}
    </div>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────
// Uppercase eyebrow that divides groups *inside* a card. Field labels stay in
// sentence case (see DESIGN_GUIDE §5.4) — this is not for them.
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-xs font-medium uppercase tracking-wide text-fg-muted", className)}>
      {children}
    </div>
  );
}


// ─── Refresh Button ────────────────────────────────────────────────────────────
export function RefreshButton({
  onClick,
  title = "Refresh",
}: {
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="p-1.5 rounded-md text-fg-muted hover:text-fg-body hover:bg-surface-hover transition-all cursor-pointer"
    >
      <RefreshCw size={15} />
    </button>
  );
}

// ─── Stepper Nav ──────────────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  { path: "/", label: "Status" },
  { path: "/motor-setup", label: "Motor Setup" },
  { path: "/camera-setup", label: "Camera Setup" },
  { path: "/teleop", label: "Teleop" },
  { path: "/record", label: "Record" },
  { path: "/dataset", label: "Dataset" },
  { path: "/train", label: "Train" },
  { path: "/eval", label: "Eval" },
] as const;

export function StepperNav({ currentPath }: { currentPath: string }) {
  const idx = PIPELINE_STEPS.findIndex((s) => s.path === currentPath);
  const prev = idx > 0 ? PIPELINE_STEPS[idx - 1] : null;
  const next = idx < PIPELINE_STEPS.length - 1 ? PIPELINE_STEPS[idx + 1] : null;

  const progress = 5 + (idx / (PIPELINE_STEPS.length - 1)) * 95;

  return (
    <div className="sticky top-0 z-10 border-b border-line bg-surface-chrome/95 backdrop-blur">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-2 text-sm text-fg-muted">
        {prev ? (
          <Link to={prev.path} className="inline-flex items-center gap-1 hover:text-fg-heading transition-colors">
            ← {prev.label}
          </Link>
        ) : <div aria-hidden="true" />}

        <div className="flex items-center gap-1.5">
          {PIPELINE_STEPS.map((step, i) => {
            const isCurrent = i === idx;
            const isNeighbor = i === idx - 1 || i === idx + 1;
            return (
              <React.Fragment key={step.path}>
                {isNeighbor && i === idx - 1 && (
                  <Link to={step.path} className="text-fg-muted hover:text-fg-body transition-colors">{step.label}</Link>
                )}
                {isNeighbor && i === idx - 1 && <span className="text-fg-disabled">›</span>}
                {isCurrent && (
                  <span className="text-fg-heading font-medium">{step.label}</span>
                )}
                {isNeighbor && i === idx + 1 && <span className="text-fg-disabled">›</span>}
                {isNeighbor && i === idx + 1 && (
                  <Link to={step.path} className="text-fg-muted hover:text-fg-body transition-colors">{step.label}</Link>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {next ? (
          <Link to={next.path} className="justify-self-end inline-flex items-center gap-1 hover:text-fg-heading transition-colors">
            {next.label} →
          </Link>
        ) : <div aria-hidden="true" />}
      </div>

      {/* 2px green progress bar */}
      <div className="h-0.5 w-full bg-line">
        <div
          className="h-full bg-ok-solid transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
