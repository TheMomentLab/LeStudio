/**
 * Local ESLint rules that enforce the LeStudio design system.
 *
 * These read className strings (string literals and template literals, including
 * the ones passed to `cn(...)`) and flag utilities that bypass the token layer
 * defined in `src/styles/theme.css`.
 *
 * See DESIGN_GUIDE.md. Zero dependencies on purpose — the rules are small and
 * the alternative (eslint-plugin-tailwindcss) does not yet resolve a Tailwind v4
 * CSS-first config.
 */

// Palette families the design system recognises. Everything the token layer is
// built from lives here; anything else is a one-off that will not survive a
// theme change.
const KNOWN_FAMILIES = new Set(["zinc", "emerald", "amber", "red", "blue", "violet"]);

// Every Tailwind palette family. Used to tell a real color utility apart from
// utilities that merely look like one (`border-l-2`, `border-r-0`, `gap-x-2`).
const TAILWIND_FAMILIES = new Set([
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan",
  "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
]);

// Color-bearing utility prefixes. `outline` and `shadow` are included because
// they take color values too.
const COLOR_PREFIX = "(?:bg|text|border|ring|divide|fill|stroke|outline|shadow|from|via|to|accent|caret|decoration|placeholder)";

// e.g. `dark:hover:bg-zinc-800/50` → variants=`dark:hover:`, prefix=`bg`, family=`zinc`
const COLOR_UTILITY = new RegExp(
  `(?:^|\\s)((?:[a-z-]+:)*)(${COLOR_PREFIX})-([a-z]+)-(\\d{1,3})(/\\d{1,3})?(?=$|\\s)`,
  "g",
);

const ARBITRARY_TEXT_SIZE = /(?:^|\s)(?:[a-z-]+:)*text-\[\d+(?:\.\d+)?(?:px|rem|em)\](?=$|\s)/g;

const ARBITRARY_COLOR = /(?:^|\s)(?:[a-z-]+:)*(?:bg|text|border|ring|fill|stroke)-\[(?:#|rgb|hsl|oklch)[^\]]*\](?=$|\s)/g;

/**
 * Collect every string that plausibly ends up in a `class`/`className`.
 * Covers: className="...", className={`...`}, className={cn("...", cond && "...")},
 * and bare string constants assigned to *ClassName / *Styles identifiers.
 */
function collectClassStrings(node, out) {
  if (!node) return;
  switch (node.type) {
    case "Literal":
      if (typeof node.value === "string") out.push([node.value, node]);
      break;
    case "TemplateLiteral":
      for (const q of node.quasis) out.push([q.value.cooked ?? "", q]);
      for (const e of node.expressions) collectClassStrings(e, out);
      break;
    case "JSXExpressionContainer":
      collectClassStrings(node.expression, out);
      break;
    case "CallExpression":
      for (const a of node.arguments) collectClassStrings(a, out);
      break;
    case "ConditionalExpression":
      collectClassStrings(node.consequent, out);
      collectClassStrings(node.alternate, out);
      break;
    case "LogicalExpression":
      collectClassStrings(node.left, out);
      collectClassStrings(node.right, out);
      break;
    case "ArrayExpression":
      for (const el of node.elements) collectClassStrings(el, out);
      break;
    case "ObjectExpression":
      for (const p of node.properties) if (p.value) collectClassStrings(p.value, out);
      break;
    default:
      break;
  }
}

/** Build a visitor that runs `check(text, node)` over every className string. */
function classNameVisitor(check) {
  return {
    JSXAttribute(node) {
      const name = node.name?.name;
      if (name !== "className" && name !== "class") return;
      const found = [];
      collectClassStrings(node.value, found);
      for (const [text, n] of found) check(text, n);
    },
    // Class strings held in constants, e.g. SIZE_STYLES / VARIANT_STYLES maps.
    VariableDeclarator(node) {
      const id = node.id?.name;
      if (!id || !/(ClassName|Styles|_STYLES|_CLASSES|Classes)$/i.test(id)) return;
      const found = [];
      collectClassStrings(node.init, found);
      for (const [text, n] of found) check(text, n);
    },
  };
}

const noArbitraryTextSize = {
  meta: {
    type: "problem",
    docs: { description: "Use the named text steps (text-3xs … text-xl) instead of an arbitrary pixel size." },
    schema: [],
    messages: {
      arbitrary:
        "Arbitrary text size `{{cls}}` — use a named step (text-3xs 10px, text-2xs 11px, text-xs, text-sm, text-base, text-lg, text-xl). Add a step to theme.css if none fits.",
    },
  },
  create(context) {
    return classNameVisitor((text, node) => {
      for (const m of text.matchAll(ARBITRARY_TEXT_SIZE)) {
        context.report({ node, messageId: "arbitrary", data: { cls: m[0].trim() } });
      }
    });
  },
};

const noArbitraryColor = {
  meta: {
    type: "problem",
    docs: { description: "Colors must come from the token layer, not an inline hex/rgb value." },
    schema: [],
    messages: {
      arbitrary:
        "Hardcoded color `{{cls}}` — use a design token (see src/styles/theme.css). Charts read tokens via useChartTokens().",
    },
  },
  create(context) {
    return classNameVisitor((text, node) => {
      for (const m of text.matchAll(ARBITRARY_COLOR)) {
        context.report({ node, messageId: "arbitrary", data: { cls: m[0].trim() } });
      }
    });
  },
};

const noUnapprovedPalette = {
  meta: {
    type: "problem",
    docs: { description: "Only the palette families the design system defines may be referenced." },
    schema: [],
    messages: {
      unapproved:
        "`{{cls}}` uses the `{{family}}` palette, which the design system does not define. Use a token, or add `{{family}}` to theme.css and to KNOWN_FAMILIES if it is genuinely needed.",
    },
  },
  create(context) {
    return classNameVisitor((text, node) => {
      for (const m of text.matchAll(COLOR_UTILITY)) {
        const family = m[3];
        // Not a palette family at all (`border-l-2`) — nothing to enforce.
        if (!TAILWIND_FAMILIES.has(family)) continue;
        if (KNOWN_FAMILIES.has(family)) continue;
        context.report({
          node,
          messageId: "unapproved",
          data: { cls: m[0].trim(), family },
        });
      }
    });
  },
};

const preferDesignToken = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Use semantic tokens (bg-surface, text-fg-muted, border-line, text-ok …) instead of raw palette shades, so a theme change is a token change.",
    },
    schema: [],
    messages: {
      raw: "`{{cls}}` is a raw palette shade. Use a design token instead — see DESIGN_GUIDE.md §2 for the mapping table.",
    },
  },
  create(context) {
    return classNameVisitor((text, node) => {
      for (const m of text.matchAll(COLOR_UTILITY)) {
        // Skip non-color utilities that share the shape (`border-l-2`).
        if (!TAILWIND_FAMILIES.has(m[3])) continue;
        context.report({ node, messageId: "raw", data: { cls: m[0].trim() } });
      }
    });
  },
};

export default {
  rules: {
    "no-arbitrary-text-size": noArbitraryTextSize,
    "no-arbitrary-color": noArbitraryColor,
    "no-unapproved-palette": noUnapprovedPalette,
    "prefer-design-token": preferDesignToken,
  },
};
