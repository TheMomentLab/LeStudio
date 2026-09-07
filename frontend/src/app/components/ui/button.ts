import { cn } from "./utils";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonTone = "brand" | "neutral" | "success" | "warning" | "danger";
export type ButtonSize = "sm" | "md";

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  className?: string;
};

const BASE_STYLES = [
  "inline-flex items-center justify-center gap-2 rounded-lg",
  "text-sm font-medium whitespace-nowrap",
  "transition-colors duration-150",
  "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring-alpha",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
].join(" ");

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-8 px-3",
  md: "h-10 px-5",
};

// Filled faces keep the same color in both themes — a Start button should not
// change hue when the theme flips. Neutral is the exception: it inverts, which
// is what `fg` / `fg-inverted` already express.
const VARIANT_STYLES: Record<ButtonVariant, Record<ButtonTone, string>> = {
  primary: {
    brand: "bg-info-solid-strong text-on-solid shadow-sm hover:bg-info-solid-hover",
    neutral: "bg-fg text-fg-inverted shadow-sm hover:bg-fg/90",
    success: "bg-ok-solid-strong text-on-solid shadow-sm hover:bg-ok-solid-hover",
    warning: "bg-warn-solid-strong text-on-warn-solid shadow-sm hover:bg-warn-solid-hover",
    danger: "bg-danger-solid-strong text-on-solid shadow-sm hover:bg-danger-solid-hover",
  },
  secondary: {
    brand: "border border-info-line bg-info-bg text-info hover:bg-info-bg/60",
    neutral: "border border-line-control bg-surface-muted text-fg-body hover:bg-surface-hover",
    success: "border border-ok-line bg-ok-bg text-ok hover:bg-ok-bg/60",
    warning: "border border-warn-line bg-warn-bg text-warn hover:bg-warn-bg/60",
    danger: "border border-danger-line bg-danger-bg text-danger hover:bg-danger-bg/60",
  },
  ghost: {
    brand: "text-info hover:bg-info-bg",
    neutral: "text-fg-muted hover:bg-surface-hover hover:text-fg-body",
    success: "text-ok hover:bg-ok-bg",
    warning: "text-warn hover:bg-warn-bg",
    danger: "text-danger hover:bg-danger-bg",
  },
};

export function buttonStyles({
  variant = "secondary",
  tone = "neutral",
  size = "md",
  className,
}: ButtonStyleOptions = {}): string {
  return cn(BASE_STYLES, SIZE_STYLES[size], VARIANT_STYLES[variant][tone], className);
}
