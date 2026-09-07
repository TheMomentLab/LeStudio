import { useSyncExternalStore } from "react";

/**
 * Recharts renders colors as SVG attributes, which cannot resolve `var(--token)`.
 * This hook reads the design tokens off the document and re-reads them whenever
 * the theme flips, so charts stay on the same color system as the rest of the UI
 * instead of hardcoding hex values.
 *
 * It watches the `class` attribute rather than subscribing to ThemeContext:
 * ThemeProvider sets the class in a layout effect, so the class is the signal
 * that the computed values have actually changed.
 */
const CHART_TOKENS = [
  "chart-grid",
  "chart-axis",
  "chart-series-1",
  "chart-series-2",
  "ok-solid",
  "warn-solid",
  "danger-solid",
  "fg-muted",
] as const;

export type ChartTokenName = (typeof CHART_TOKENS)[number];
export type ChartTokens = Record<ChartTokenName, string>;

// Matches the light-theme values in styles/theme.css. Used in non-DOM
// environments (unit tests) so charts never render with empty strings.
const FALLBACK: ChartTokens = {
  "chart-grid": "#e4e4e7",
  "chart-axis": "#71717a",
  "chart-series-1": "#3f3f46",
  "chart-series-2": "#2563eb",
  "ok-solid": "#10b981",
  "warn-solid": "#f59e0b",
  "danger-solid": "#ef4444",
  "fg-muted": "#71717a",
};

function readTokens(): ChartTokens {
  if (typeof document === "undefined") {
    return FALLBACK;
  }
  const styles = getComputedStyle(document.documentElement);
  const out = {} as ChartTokens;
  for (const name of CHART_TOKENS) {
    out[name] = styles.getPropertyValue(`--${name}`).trim() || FALLBACK[name];
  }
  return out;
}

function subscribeToThemeClass(onChange: () => void): () => void {
  if (typeof MutationObserver === "undefined") {
    return () => {};
  }
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getThemeClass(): string {
  return typeof document === "undefined" ? "" : document.documentElement.className;
}

// useSyncExternalStore requires a referentially stable snapshot, so the resolved
// tokens are cached and only recomputed when the theme class actually changes.
let cachedClass: string | null = null;
let cachedTokens: ChartTokens = FALLBACK;

function getTokensSnapshot(): ChartTokens {
  const themeClass = getThemeClass();
  if (themeClass !== cachedClass) {
    cachedClass = themeClass;
    cachedTokens = readTokens();
  }
  return cachedTokens;
}

export function useChartTokens(): ChartTokens {
  return useSyncExternalStore(subscribeToThemeClass, getTokensSnapshot, () => FALLBACK);
}
