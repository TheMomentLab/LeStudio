#!/usr/bin/env node
/**
 * Design-system ratchet.
 *
 * The page components still hold raw palette utilities that predate the token
 * layer. Migrating them all at once is not worth the churn, but the count must
 * never go back up — so this script measures the debt and fails when it grows.
 *
 *   npm run design:audit          check against design-baseline.json
 *   npm run design:audit -- --update   accept the current numbers as the new floor
 *   npm run design:audit -- --report   list the worst offenders
 *
 * Anything already at zero here is enforced by ESLint instead (see
 * eslint-rules/design-system.mjs) — a ratchet is only for debt with a backlog.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src", "app");
const BASELINE_PATH = join(ROOT, "design-baseline.json");

const TAILWIND_FAMILIES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOR_PREFIX =
  "bg|text|border|ring|divide|fill|stroke|outline|shadow|from|via|to|accent|caret|decoration|placeholder";

// Boundaries are word-ish rather than whitespace: this regex runs over raw
// source, where a class sits between quotes (`"bg-zinc-900 ..."`), so anchoring
// on \s would silently miss the first and last utility of every string.
const RAW_PALETTE = new RegExp(
  `(?<![\\w-])((?:[a-z-]+:)*)(?:${COLOR_PREFIX})-(?:${TAILWIND_FAMILIES})-\\d{1,3}(?:/\\d{1,3})?(?![\\w-])`,
  "g",
);
const CLASSNAME_STRING = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;
const HEX_LITERAL = /["'`]#[0-9a-fA-F]{6}\b/g;

// The one sanctioned place for literal colors: the non-DOM fallback that mirrors
// the light-theme token values. Everything else must read a token.
const HEX_ALLOWLIST = new Set(["src/app/hooks/useChartTokens.ts"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

function measure() {
  const perFile = {};
  const totals = { rawPaletteUtilities: 0, classNamesMissingDark: 0, hexLiterals: 0 };

  for (const file of walk(SRC)) {
    const rel = relative(ROOT, file);
    const source = readFileSync(file, "utf8");
    const counts = { rawPaletteUtilities: 0, classNamesMissingDark: 0, hexLiterals: 0 };

    counts.rawPaletteUtilities = [...source.matchAll(RAW_PALETTE)].length;
    counts.hexLiterals = HEX_ALLOWLIST.has(rel) ? 0 : [...source.matchAll(HEX_LITERAL)].length;

    // A className that paints a light-mode palette color but never names a dark
    // variant renders at whatever contrast that shade happens to have on the
    // other theme. Tokens make this category impossible.
    for (const match of source.matchAll(CLASSNAME_STRING)) {
      const classes = match[1] ?? match[2] ?? "";
      const hits = [...classes.matchAll(RAW_PALETTE)];
      if (hits.length === 0) continue;
      const hasLightOnly = hits.some((h) => !h[1].includes("dark:"));
      const hasDark = /(?:^|\s)dark:/.test(classes);
      if (hasLightOnly && !hasDark) counts.classNamesMissingDark += 1;
    }

    if (Object.values(counts).some((n) => n > 0)) perFile[rel] = counts;
    for (const key of Object.keys(totals)) totals[key] += counts[key];
  }

  return { totals, perFile };
}

const args = process.argv.slice(2);
const { totals, perFile } = measure();

if (args.includes("--update")) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ totals }, null, 2)}\n`);
  console.log("design-baseline.json updated:");
  for (const [k, v] of Object.entries(totals)) console.log(`  ${k}: ${v}`);
  process.exit(0);
}

if (args.includes("--report")) {
  const worst = Object.entries(perFile)
    .sort((a, b) => b[1].rawPaletteUtilities - a[1].rawPaletteUtilities)
    .slice(0, 20);
  console.log("Raw palette utilities by file (top 20):\n");
  for (const [file, c] of worst) {
    console.log(`  ${String(c.rawPaletteUtilities).padStart(4)}  ${file}` +
      (c.classNamesMissingDark ? `  (${c.classNamesMissingDark} without a dark: variant)` : ""));
  }
  console.log("");
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")).totals;
} catch {
  console.error(
    `No baseline at ${relative(ROOT, BASELINE_PATH)}. Run: npm run design:audit -- --update`,
  );
  process.exit(1);
}

let failed = false;
console.log("Design system debt (lower is better):\n");
for (const [key, current] of Object.entries(totals)) {
  const allowed = baseline[key] ?? 0;
  const delta = current - allowed;
  const mark = delta > 0 ? "FAIL" : delta < 0 ? " OK ↓" : " OK  ";
  console.log(
    `  ${mark}  ${key.padEnd(24)} ${String(current).padStart(5)}  (baseline ${allowed}${delta ? `, ${delta > 0 ? "+" : ""}${delta}` : ""})`,
  );
  if (delta > 0) failed = true;
}

if (failed) {
  console.error(
    "\nThis change adds raw palette utilities. Use a design token from src/styles/theme.css" +
      "\n(see DESIGN_GUIDE.md §2 for the mapping table). If the increase is genuinely" +
      "\nunavoidable, run `npm run design:audit -- --update` and say why in the PR.",
  );
  process.exit(1);
}

const improved = Object.entries(totals).filter(([k, v]) => v < (baseline[k] ?? 0));
if (improved.length > 0) {
  console.log(
    "\nDebt went down — lock it in with: npm run design:audit -- --update",
  );
}
