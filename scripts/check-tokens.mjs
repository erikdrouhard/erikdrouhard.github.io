#!/usr/bin/env node
/**
 * Fails on anything the design system does not allow.
 *
 * `DESIGN-SYSTEM.md` says every visual value on the site comes from a variable
 * in `src/styles/tokens.css`, and that no other file writes a literal font,
 * size, weight, line-height, letter-spacing, colour, radius, or spacing value.
 * This script is what makes that true rather than aspirational. It reads
 * source only — no browser, no build — so it runs in well under a second and
 * can sit in front of the CI build.
 *
 *   node scripts/check-tokens.mjs            # check, never writes
 *   node scripts/check-tokens.mjs --write    # regenerate the seed file
 *   node scripts/check-tokens.mjs --root DIR --seed FILE
 *
 * ── the seed file ────────────────────────────────────────────────────────
 * `scripts/token-violations.txt` lists the violations that already existed
 * when the check was written, so the check could be switched on before the
 * migration finished. It is tab-separated and one group per line:
 *
 *     <path>\t<rule>\t<count>\t<offending text>
 *
 * The key is (path, rule, text) and not the line number, so moving a rule
 * down a file does not invalidate its entry. `count` is how many times that
 * exact violation appears in that file.
 *
 * The check fails when:
 *   - a violation is found that the seed does not list, or is found more
 *     times than the seed allows — new drift;
 *   - the seed lists a violation that is no longer there, or lists it more
 *     times than it now occurs — a stale entry, which forces the seed to be
 *     trimmed as the migration removes violations.
 *
 * So the file can only shrink. It must be empty at the end of the migration.
 * With no seed file present at all the check still runs and still fails on
 * the first violation it finds.
 *
 * ── what is scanned ──────────────────────────────────────────────────────
 * Under `src/`: .css, .astro, .mdx, .js, .ts, .html. An .astro file is split —
 * its <style> blocks get the CSS rules, the rest gets the markup rules.
 * Under `public/`: nothing is parsed. The directory is for assets, so any
 * .css/.js/.jsx/.html there is itself the violation. Anything beneath a
 * `.archive/` segment is retired and skipped everywhere.
 *
 * `src/styles/tokens.css` is exempt from every value ban. It is the one file
 * allowed to write literals; that is its job.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

// ---------------------------------------------------------------- constants

/** The eight type roles. Markup may carry no other `type-` class. */
export const TYPE_ROLES = [
  "type-display",
  "type-section",
  "type-title",
  "type-support",
  "type-label",
  "type-body",
  "type-body-small",
  "type-meta",
];

/** The only custom properties a script may read out of computed style. */
export const JS_TOKENS = [
  "--duration",
  "--duration-slow",
  "--field-rgb",
  "--field-gain",
];

/** The two media literals that match `--bp-mobile: 810px`. */
const BREAKPOINTS = ["(max-width:809.98px)", "(min-width:810px)"];

const TOKENS_FILE = "src/styles/tokens.css";

const SCAN_EXT = new Set([".css", ".astro", ".mdx", ".js", ".ts", ".html"]);
const PUBLIC_CODE_EXT = new Set([".css", ".js", ".jsx", ".html"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".astro", ".archive"]);

/* Type properties. Rule 1 of the page names font, size, weight, line-height
   and letter-spacing; the `font` shorthand carries four of the five at once. */
const TYPE_PROPS = /^(font|font-family|font-size|font-weight|line-height|letter-spacing)$/;

/* Spacing and size properties. Rule 1 names spacing and rule 3 says the
   `--space-*` scale is the only one; the width tokens cover the rest. */
const SPACE_PROPS =
  /^(margin|margin-top|margin-right|margin-bottom|margin-left|margin-block|margin-block-start|margin-block-end|margin-inline|margin-inline-start|margin-inline-end|padding|padding-top|padding-right|padding-bottom|padding-left|padding-block|padding-block-start|padding-block-end|padding-inline|padding-inline-start|padding-inline-end|gap|row-gap|column-gap|inset|top|right|bottom|left|width|min-width|max-width|height|min-height|max-height)$/;

const COLOR_PROPS =
  /(^|-)color$|^background|^border|^outline|^fill$|^stroke$|^caret-color$|^text-decoration-color$|^accent-color$/;

/* Enough of the CSS named colours to catch what a stylesheet actually types.
   `transparent` and `currentColor` are allowed by the spec. */
const NAMED_COLORS = new Set([
  "white", "black", "red", "green", "blue", "yellow", "orange", "purple",
  "gray", "grey", "silver", "navy", "teal", "aqua", "cyan", "magenta", "lime",
  "maroon", "olive", "fuchsia", "pink", "brown", "beige", "ivory", "gold",
  "coral", "salmon", "khaki", "indigo", "violet", "turquoise", "tan", "azure",
  "lavender", "crimson", "darkgreen", "lightgray", "lightgrey", "whitesmoke",
]);

const GENERIC_FAMILIES =
  /\b(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-monospace|ui-serif|ui-sans-serif|-apple-system|BlinkMacSystemFont)\b/i;

const WEIGHT_KEYWORDS = /\b(bold|bolder|lighter|oblique|small-caps)\b/i;

/* Keywords that are a value, not a literal, and are allowed anywhere. */
const NEUTRAL = /^(inherit|initial|unset|revert|revert-layer|normal|auto|none|currentcolor|transparent|0)$/i;

const UNIT_NUMBER = /(?<![\w.#-])(-?\d*\.?\d+)(px|rem|em|ch|ex|pt|pc|in|cm|mm|vw|vh|vmin|vmax|%)/g;
const BARE_NUMBER = /(?<![\w.#-])(-?\d*\.?\d+)(?![\w.%-])/g;

// ------------------------------------------------------------------- source

/** Blank out comment bodies but keep every newline, so line numbers hold. */
function stripComments(source, kind) {
  let out = source.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, " "),
  );
  if (kind === "js") {
    out = out
      .split("\n")
      .map((line) => {
        const i = line.indexOf("//");
        if (i < 0) return line;
        const before = line.slice(0, i);
        // a URL, or a `//` inside a string, is not a comment
        if (before.endsWith(":")) return line;
        const quotes = (before.match(/["'`]/g) || []).length;
        if (quotes % 2 === 1) return line;
        return before;
      })
      .join("\n");
  }
  if (kind === "markup") {
    out = out.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
  }
  return out;
}

/** Remove every `var(--x)` / `var(--x, fallback)`, nesting included. */
function stripVars(value) {
  let out = value;
  for (;;) {
    const i = out.indexOf("var(");
    if (i < 0) return out;
    let depth = 0;
    let j = i + 3;
    for (; j < out.length; j++) {
      if (out[j] === "(") depth++;
      else if (out[j] === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (j >= out.length) return out.slice(0, i);
    out = out.slice(0, i) + " " + out.slice(j + 1);
  }
}

/** `!important`, trailing punctuation, and repeated whitespace are noise. */
function normalizeValue(value) {
  return value.replace(/!important/gi, " ").replace(/\s+/g, " ").trim();
}

/** Byte offsets of the start of each line. */
function lineStarts(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

/** Text of the innermost `{ … }` block containing an offset. */
function innerBlockText(source, offset) {
  const stack = [];
  let best = null;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "{") stack.push(i);
    else if (source[i] === "}") {
      const start = stack.pop();
      if (start !== undefined && start <= offset && offset <= i) {
        if (!best || start > best[0]) best = [start, i];
      }
    }
  }
  return best ? source.slice(best[0], best[1]) : "";
}

// -------------------------------------------------------------------- rules

/** Split a CSS-ish line into `{ prop, value }` declarations. */
function declarations(line) {
  const out = [];
  for (const chunk of line.split(";")) {
    const m = chunk.match(/(?:^|[{\s])([-a-zA-Z]+)\s*:\s*([^;{}]*)$/);
    if (!m) continue;
    const prop = m[1].toLowerCase();
    if (prop.startsWith("--")) continue;
    out.push({ prop, value: normalizeValue(m[2]) });
  }
  return out;
}

function hasUnitLiteral(text) {
  UNIT_NUMBER.lastIndex = 0;
  let m;
  while ((m = UNIT_NUMBER.exec(text))) {
    const n = parseFloat(m[1]);
    if (n === 0) continue;
    if (m[2] === "%" && n === 100) continue;
    return true;
  }
  return false;
}

function hasBareNumber(text) {
  BARE_NUMBER.lastIndex = 0;
  let m;
  while ((m = BARE_NUMBER.exec(text))) {
    if (parseFloat(m[1]) !== 0) return true;
  }
  return false;
}

/** The CSS bans, run over one line of stylesheet. */
function cssRules(line, push, ctx) {
  const decls = declarations(line);

  for (const { prop, value } of decls) {
    const bare = stripVars(value);

    // rule 1 — type
    if (TYPE_PROPS.test(prop)) {
      const rest = normalizeValue(bare).replace(/,/g, " ").trim();
      const meaningful = rest
        .split(/\s+/)
        .filter((t) => t && !NEUTRAL.test(t));
      if (
        meaningful.length &&
        (/["']/.test(rest) ||
          GENERIC_FAMILIES.test(rest) ||
          WEIGHT_KEYWORDS.test(rest) ||
          hasUnitLiteral(rest) ||
          hasBareNumber(rest))
      ) {
        push("font", `${prop}: ${value}`);
      }
    }

    // rule 3 — spacing and the three widths
    if (SPACE_PROPS.test(prop) && hasUnitLiteral(bare)) {
      push("spacing", `${prop}: ${value}`);
    }

    // colour
    if (COLOR_PROPS.test(prop)) {
      for (const t of normalizeValue(bare).replace(/[,()]/g, " ").split(/\s+/)) {
        if (NAMED_COLORS.has(t.toLowerCase())) {
          push("color", `${prop}: ${value}`);
          break;
        }
      }
    }

    // radius — 50% on a circle is geometry, everything else is styling
    if (/^border(-[a-z]+)*-radius$/.test(prop) || prop === "border-radius") {
      const rest = normalizeValue(bare);
      const bad = rest
        .split(/[\s/]+/)
        .filter(Boolean)
        .some((t) => !/^(50%|0|0px|inherit|initial|unset)$/i.test(t));
      if (bad) push("radius", `${prop}: ${value}`);
    }

    // motion — two duration tokens, one easing
    if (/^(transition|animation)(-duration|-timing-function|-delay)?$/.test(prop)) {
      const rest = normalizeValue(bare).replace(/\bease-out\b/gi, " ");
      if (/(?<![\w.-])\d*\.?\d+m?s\b/.test(rest) || /\b(ease|ease-in|ease-in-out|linear|cubic-bezier|steps)\b/i.test(rest)) {
        push("motion", `${prop}: ${value}`);
      }
    }

    // z-index — three named layers, or a local 1 inside an isolated stack
    if (prop === "z-index") {
      const rest = normalizeValue(bare);
      if (/^-?\d+$/.test(rest)) {
        const n = Number(rest);
        const isolated = /isolation\s*:\s*isolate/.test(
          innerBlockText(ctx.source, ctx.offset + Math.max(0, line.indexOf("z-index"))),
        );
        if (n < 0 || !(n === 1 && isolated)) {
          push("z-index", `${prop}: ${value}`);
        }
      }
    }
  }

  // shadows — no token exists, so nothing can be typed
  if (/\b(box-shadow|text-shadow)\s*:/.test(line) || /\bdrop-shadow\s*\(/.test(line)) {
    push("shadow", line.trim());
  }

  // @font-face lives in tokens.css only
  if (/@font-face\b/.test(line)) push("font-face", line.trim());

  // one breakpoint
  const media = line.match(/@media([^{]*)/);
  if (media && /\b(width|height)\b/.test(media[1])) {
    const groups = media[1].match(/\([^()]*\)/g) || [];
    const bad = groups
      .filter((g) => /\b(width|height)\b/.test(g))
      .some((g) => !BREAKPOINTS.includes(g.replace(/\s+/g, "")));
    if (bad || groups.length === 0) push("media", `@media${media[1].trimEnd()}`);
  }
}

/**
 * Colour literals, wherever they appear.
 *
 * `kind` is "css", "js", or "markup". In a script a colour function is a
 * violation only when its arguments hold a numeric literal. A canvas fill has
 * to be assembled as a string — there is no `var()` to write — so the field
 * reads `--field-rgb` and wraps it: `"rgb(" + rgb + ")"`. Every channel still
 * comes from tokens.css, which is the thing the ban exists to protect. The
 * moment a number appears between the parentheses the palette has forked, and
 * it is a violation again. CSS is held to the literal ban, because there a
 * token can be written directly.
 */
function colorRule(line, push, kind) {
  for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const len = m[0].length - 1;
    if (![3, 4, 6, 8].includes(len)) continue;
    // an id selector is not a colour; a value always follows : = ( " ' or ,
    if (!/[:=("',]/.test(line.slice(0, m.index))) continue;
    push("color", m[0]);
    return;
  }
  const fn = line.match(
    /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/,
  );
  if (!fn) return;
  if (/\boklch\s*\(\s*from\b/.test(line)) return;
  if (kind === "js") {
    // the arguments are whatever sits between this `(` and the next `)`
    const open = fn.index + fn[0].length;
    const close = line.indexOf(")", open);
    const args = close === -1 ? line.slice(open) : line.slice(open, close);
    if (!/\d/.test(args)) return;
  }
  push("color", fn[0].trim());
}

/** Only four custom properties may cross into JS. */
function jsTokenRule(line, push) {
  for (const m of line.matchAll(/getPropertyValue\(\s*["'`](--[\w-]+)["'`]/g)) {
    if (!JS_TOKENS.includes(m[1])) push("js-token", m[0]);
  }
}

/** Markup carries one of the eight roles and no other `type-` class. */
function typeClassRule(line, push) {
  for (const m of line.matchAll(/class(?:Name)?=["']([^"']*)["']/g)) {
    for (const token of m[1].split(/\s+/).filter(Boolean)) {
      if (token.startsWith("type-") && !TYPE_ROLES.includes(token)) {
        push("type-class", token);
      }
    }
  }
}

// ------------------------------------------------------------------- walking

function walk(dir, base, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, base, out);
    } else if (entry.isFile()) {
      out.push(relative(base, full).split(sep).join("/"));
    }
  }
  return out;
}

function styleRanges(source) {
  const ranges = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const starts = lineStarts(source);
  const lineOf = (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  let m;
  while ((m = re.exec(source))) {
    const open = m.index + m[0].indexOf(">") + 1;
    ranges.push([lineOf(open), lineOf(open + m[1].length)]);
  }
  return ranges;
}

/**
 * Scan a repository root and return every violation, sorted.
 * Each entry is `{ file, line, rule, text }`.
 */
export function scanTree(root) {
  const violations = [];

  // public/ — assets only. The presence of code there is the violation.
  for (const rel of walk(join(root, "public"), root, [])) {
    const ext = rel.slice(rel.lastIndexOf("."));
    if (PUBLIC_CODE_EXT.has(ext)) {
      violations.push({ file: rel, line: 1, rule: "public-code", text: rel });
    }
  }

  for (const rel of walk(join(root, "src"), root, [])) {
    const ext = rel.slice(rel.lastIndexOf("."));
    if (!SCAN_EXT.has(ext)) continue;
    const raw = readFileSync(join(root, rel), "utf8");
    const exempt = rel === TOKENS_FILE;

    // Crimson Text is banned by name, comments included, so it runs on the
    // raw text before anything is stripped.
    raw.split("\n").forEach((line, i) => {
      if (/crimson/i.test(line)) {
        violations.push({
          file: rel,
          line: i + 1,
          rule: "crimson",
          text: line.trim(),
        });
      }
    });

    const kind =
      ext === ".css" ? "css" : ext === ".js" || ext === ".ts" ? "js" : "markup";
    const source = stripComments(raw, kind === "css" ? "css" : kind);
    const lines = source.split("\n");
    const starts = lineStarts(source);
    const inStyle = ext === ".astro" ? styleRanges(source) : [];

    lines.forEach((line, i) => {
      const lineNo = i + 1;
      const push = (rule, text) =>
        violations.push({ file: rel, line: lineNo, rule, text: text.trim() });

      const isCss =
        kind === "css" ||
        inStyle.some(([a, b]) => lineNo >= a && lineNo <= b);

      if (isCss && !exempt) {
        cssRules(line, push, { source, offset: starts[i] });
      }
      if (!exempt) colorRule(line, push, isCss ? "css" : kind);
      if (kind !== "css") {
        jsTokenRule(line, push);
        typeClassRule(line, push);
      }
    });
  }

  violations.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.rule.localeCompare(b.rule) ||
      a.text.localeCompare(b.text),
  );
  return violations;
}

// ---------------------------------------------------------------- seed file

const key = (v) => `${v.file}\t${v.rule}\t${v.text}`;

function group(violations) {
  const counts = new Map();
  for (const v of violations) counts.set(key(v), (counts.get(key(v)) || 0) + 1);
  return counts;
}

/** Render violations in the seed format. */
export function serializeSeed(violations) {
  const counts = group(violations);
  const lines = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, n]) => {
      const [file, rule, text] = k.split("\t");
      return `${file}\t${rule}\t${n}\t${text}`;
    });
  return (
    "# path\\trule\\tcount\\ttext — see scripts/check-tokens.mjs.\n" +
    "# This file only ever shrinks. Regenerate with: node scripts/check-tokens.mjs --write\n" +
    lines.join("\n") +
    (lines.length ? "\n" : "")
  );
}

/**
 * Parse a seed. Pass the text directly, or a path to read it from.
 * A missing file is an empty seed, so the check still fails on new drift.
 */
export function readSeed(text, path) {
  let body = text;
  if (typeof body !== "string") {
    if (!path || !existsSync(path)) return [];
    body = readFileSync(path, "utf8");
  }
  const out = [];
  for (const line of body.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [file, rule, count, ...rest] = line.split("\t");
    out.push({ file, rule, count: Number(count), text: rest.join("\t") });
  }
  return out;
}

/** Compare a scan against a seed. New drift and stale entries both fail. */
export function compareToSeed(violations, seed) {
  const found = group(violations);
  const allowed = new Map(
    seed.map((s) => [`${s.file}\t${s.rule}\t${s.text}`, s.count]),
  );

  const unlisted = [];
  for (const [k, n] of found) {
    const cap = allowed.get(k) || 0;
    if (n > cap) {
      const [file, rule, text] = k.split("\t");
      const example = violations.find((v) => key(v) === k);
      unlisted.push({
        file,
        rule,
        text,
        line: example.line,
        extra: n - cap,
      });
    }
  }

  const stale = [];
  for (const [k, n] of allowed) {
    const now = found.get(k) || 0;
    if (now < n) {
      const [file, rule, text] = k.split("\t");
      stale.push({ file, rule, text, gone: n - now });
    }
  }

  const ok = unlisted.length === 0 && stale.length === 0;
  return {
    ok,
    unlisted,
    stale,
    summary: ok
      ? `all ${violations.length} violations are seeded`
      : `${unlisted.length} unlisted, ${stale.length} stale`,
  };
}

// --------------------------------------------------------------------- main

function main() {
  const argv = process.argv.slice(2);
  const arg = (name, fallback) =>
    argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback;

  const root = arg("--root", new URL("../", import.meta.url).pathname);
  const seedPath = arg("--seed", join(root, "scripts/token-violations.txt"));
  const violations = scanTree(root);

  if (argv.includes("--write")) {
    writeFileSync(seedPath, serializeSeed(violations));
    console.log(
      `wrote ${violations.length} violations to ${relative(root, seedPath)}`,
    );
    return 0;
  }

  const result = compareToSeed(violations, readSeed(null, seedPath));
  if (result.ok) {
    const byRule = new Map();
    for (const v of violations)
      byRule.set(v.rule, (byRule.get(v.rule) || 0) + 1);
    console.log(
      `check-tokens: PASS — ${violations.length} seeded violations remain` +
        (violations.length
          ? ` (${[...byRule]
              .sort()
              .map(([r, n]) => `${r} ${n}`)
              .join(", ")})`
          : ""),
    );
    return 0;
  }

  for (const v of result.unlisted) {
    console.error(
      `${v.file}:${v.line}  ${v.rule}  ${v.text}` +
        (v.extra > 1 ? `  (${v.extra} unlisted occurrences)` : ""),
    );
  }
  for (const v of result.stale) {
    console.error(
      `STALE  ${v.file}  ${v.rule}  ${v.text}  — fixed, remove it from the seed`,
    );
  }
  console.error(
    `\ncheck-tokens: FAIL — ${result.unlisted.length} new violation(s), ` +
      `${result.stale.length} stale seed entr(y|ies).\n` +
      `Fix the source, then run: node scripts/check-tokens.mjs --write`,
  );
  return 1;
}

if (process.argv[1] && process.argv[1].endsWith("check-tokens.mjs")) {
  process.exit(main());
}
