/**
 * Source-only assertions about the token check. No browser and no build: a
 * fixture tree goes in, a list of violations comes out, and each ban is
 * proved on its own with one violating line and nothing else around it.
 *
 * Expected values come from `.scratch/design-system-remediation/spec.md` and
 * `DESIGN-SYSTEM.md`, not from re-running the checker.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import {
  scanTree,
  readSeed,
  compareToSeed,
  serializeSeed,
} from "./check-tokens.mjs";

const repoRoot = new URL("../", import.meta.url).pathname;

/* Build a throwaway tree and hand its path to the checker. Files are written
   with their real extensions because the checker picks its rules from them. */
function tree(files) {
  const dir = mkdtempSync(join(tmpdir(), "check-tokens-"));
  for (const [rel, body] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  }
  return dir;
}

/* One violation per ban, asserted as `file:line rule`. Anything else the
   scan reports is a false positive and fails the test. */
function only(dir, expected) {
  const found = scanTree(dir).map((v) => `${v.file}:${v.line} ${v.rule}`);
  assert.deepEqual(found.sort(), expected.slice().sort());
}

const CLEAN_CSS = `.a {\n  font: var(--type-body);\n  color: var(--text);\n  padding: var(--space-2);\n}\n`;

test("1. a clean tree reports nothing", () => {
  const dir = tree({
    "src/styles/a.css": CLEAN_CSS,
    "src/pages/a.astro": `<p class="type-body">hi</p>\n<style>\n${CLEAN_CSS}</style>\n`,
    "src/scripts/a.js": `const d = getComputedStyle(document.documentElement).getPropertyValue("--duration");\n`,
    "public/assets/a.woff2": "x",
    "public/.archive/styles.css": "body { color: #fff; }\n",
  });
  only(dir, []);
  rmSync(dir, { recursive: true });
});

test("2. type literals outside tokens.css are violations", () => {
  const dir = tree({
    "src/styles/a.css": [
      ".a { font-size: 18px; }", // 1
      ".b { font-weight: 700; }", // 2
      ".c { line-height: 1.4; }", // 3
      ".d { letter-spacing: 0.08em; }", // 4
      '.e { font-family: "Newsreader", serif; }', // 5
      ".f { font: 300 36px/1.1 serif; }", // 6
      ".g { font: var(--type-display); }", // 7 — fine
      ".h { letter-spacing: var(--track-caps); }", // 8 — fine
      ".i { line-height: inherit; letter-spacing: normal; }", // 9 — fine
      ".j { font-size: calc(var(--x) + 2px); }", // 10 — bare px in calc
      "",
    ].join("\n"),
  });
  only(dir, [
    "src/styles/a.css:1 font",
    "src/styles/a.css:2 font",
    "src/styles/a.css:3 font",
    "src/styles/a.css:4 font",
    "src/styles/a.css:5 font",
    "src/styles/a.css:6 font",
    "src/styles/a.css:10 font",
  ]);
  rmSync(dir, { recursive: true });
});

test("3. tokens.css itself is exempt from the value bans", () => {
  const dir = tree({
    "src/styles/tokens.css":
      ":root {\n  --display-1: 300 36px/1.1 var(--font-primary);\n  --page: #f4f6f0;\n  --space-1: 12px;\n}\n",
  });
  only(dir, []);
  rmSync(dir, { recursive: true });
});

test("4. colour literals are violations", () => {
  const dir = tree({
    "src/styles/a.css": [
      ".a { color: #fff; }", // 1
      ".b { background: rgba(0, 0, 0, 0.4); }", // 2
      ".c { border-color: hsl(120 50% 50%); }", // 3
      ".d { color: white; }", // 4
      ".e { color: var(--text); }", // 5 — fine
      ".f { background: transparent; border-color: currentColor; }", // 6 — fine
      "#field { inset: 0; }", // 7 — an id selector, not a hex colour
      "",
    ].join("\n"),
    "src/scripts/a.js": 'ctx.fillStyle = "#0b0";\n',
  });
  only(dir, [
    "src/styles/a.css:1 color",
    "src/styles/a.css:2 color",
    "src/styles/a.css:3 color",
    "src/styles/a.css:4 color",
    "src/scripts/a.js:1 color",
  ]);
  rmSync(dir, { recursive: true });
});

test("5. shadows are violations", () => {
  const dir = tree({
    "src/styles/a.css":
      ".a { box-shadow: 0 0 0 1px var(--line); }\n.b { text-shadow: 0 1px 0 var(--line); }\n.c { filter: drop-shadow(0 1px 0 var(--line)); }\n",
  });
  only(dir, [
    "src/styles/a.css:1 shadow",
    "src/styles/a.css:2 shadow",
    "src/styles/a.css:3 shadow",
  ]);
  rmSync(dir, { recursive: true });
});

test("6. border-radius other than 50% or 0 is a violation", () => {
  const dir = tree({
    "src/styles/a.css":
      ".a { border-radius: 4px; }\n.b { border-radius: 50%; }\n.c { border-radius: 0; }\n.d { border-radius: 999px; }\n",
  });
  only(dir, ["src/styles/a.css:1 radius", "src/styles/a.css:4 radius"]);
  rmSync(dir, { recursive: true });
});

test("7. only the two breakpoint literals are allowed in @media", () => {
  const dir = tree({
    "src/styles/a.css": [
      "@media (max-width: 809.98px) { .a { color: var(--text); } }", // 1 — fine
      "@media (min-width: 810px) { .a { color: var(--text); } }", // 2 — fine
      "@media (max-width: 720px) { .a { color: var(--text); } }", // 3
      "@media (min-width: 810px) and (max-height: 1000px) { .a { color: var(--text); } }", // 4
      "@media (prefers-reduced-motion: reduce) { .a { color: var(--text); } }", // 5 — fine
      "@media (hover: hover) and (pointer: fine) { .a { color: var(--text); } }", // 6 — fine
      "",
    ].join("\n"),
  });
  only(dir, ["src/styles/a.css:3 media", "src/styles/a.css:4 media"]);
  rmSync(dir, { recursive: true });
});

test("8. only ease-out and the duration tokens may time motion", () => {
  const dir = tree({
    "src/styles/a.css": [
      ".a { transition: color var(--duration) ease-out; }", // 1 — fine
      ".b { transition: color 150ms ease-out; }", // 2
      ".c { transition: color var(--duration) ease-in-out; }", // 3
      ".d { animation: pop 0.3s cubic-bezier(0.2, 0, 0, 1); }", // 4
      ".e { animation: pop var(--duration-slow) ease-out both; }", // 5 — fine
      ".f { transition-timing-function: linear; }", // 6
      "",
    ].join("\n"),
  });
  only(dir, [
    "src/styles/a.css:2 motion",
    "src/styles/a.css:3 motion",
    "src/styles/a.css:4 motion",
    "src/styles/a.css:6 motion",
  ]);
  rmSync(dir, { recursive: true });
});

test("9. numeric z-index is a violation unless it is 1 in an isolated rule", () => {
  const dir = tree({
    "src/styles/a.css": [
      ".a { z-index: var(--layer-sticky); }", // 1 — fine
      ".b { isolation: isolate; z-index: 1; }", // 2 — fine
      ".c { z-index: 1; }", // 3 — no isolation in the rule
      ".d { z-index: -1; }", // 4
      ".e { z-index: 40; }", // 5
      ".f { z-index: auto; }", // 6 — fine
      "",
    ].join("\n"),
  });
  only(dir, [
    "src/styles/a.css:3 z-index",
    "src/styles/a.css:4 z-index",
    "src/styles/a.css:5 z-index",
  ]);
  rmSync(dir, { recursive: true });
});

test("10. scripts may read only the four allowed tokens", () => {
  const dir = tree({
    "src/scripts/a.js": [
      'cs.getPropertyValue("--duration");', // 1 — fine
      "cs.getPropertyValue('--duration-slow');", // 2 — fine
      'cs.getPropertyValue("--field-rgb");', // 3 — fine
      'cs.getPropertyValue("--field-gain");', // 4 — fine
      'cs.getPropertyValue("--accent");', // 5
      "",
    ].join("\n"),
  });
  only(dir, ["src/scripts/a.js:5 js-token"]);
  rmSync(dir, { recursive: true });
});

test("11. code under public/ outside .archive/ is a violation", () => {
  const dir = tree({
    "public/styles.css": "body { color: var(--text); }\n",
    "public/components/a.js": "export default 1;\n",
    "public/components/a.jsx": "export default 1;\n",
    "public/experiments/index.html": "<p>hi</p>\n",
    "public/.archive/styles.css": "body { color: #fff; }\n",
    "public/assets/logo.svg": "<svg/>\n",
  });
  only(dir, [
    "public/components/a.js:1 public-code",
    "public/components/a.jsx:1 public-code",
    "public/experiments/index.html:1 public-code",
    "public/styles.css:1 public-code",
  ]);
  rmSync(dir, { recursive: true });
});

test("12. only the eight type roles may appear in markup", () => {
  const dir = tree({
    "src/pages/a.astro": [
      '<h1 class="type-display">a</h1>', // 1 — fine
      '<h2 class="type-section">a</h2>', // 2 — fine
      '<h3 class="type-title">a</h3>', // 3 — fine
      '<p class="type-support">a</p>', // 4 — fine
      '<p class="type-label">a</p>', // 5 — fine
      '<p class="type-body">a</p>', // 6 — fine
      '<p class="type-body-small">a</p>', // 7 — fine
      '<p class="type-meta">a</p>', // 8 — fine
      '<p class="type-quote">a</p>', // 9
      '<p class="type-body type-caps">a</p>', // 10
      "",
    ].join("\n"),
  });
  only(dir, ["src/pages/a.astro:9 type-class", "src/pages/a.astro:10 type-class"]);
  rmSync(dir, { recursive: true });
});

test("13. @font-face outside tokens.css and any mention of Crimson Text", () => {
  const dir = tree({
    "src/styles/a.css": [
      "@font-face {", // 1
      '  font-family: "Crimson Text";', // 2 — crimson, and a font literal
      '  src: url("/assets/crimson-text-regular.woff2") format("woff2");', // 3 — crimson
      "}",
      "",
    ].join("\n"),
    "src/styles/tokens.css": "@font-face { font-family: x; }\n",
  });
  const found = scanTree(dir).map((v) => `${v.file}:${v.line} ${v.rule}`);
  assert.ok(found.includes("src/styles/a.css:1 font-face"));
  assert.ok(found.includes("src/styles/a.css:2 crimson"));
  assert.ok(found.includes("src/styles/a.css:3 crimson"));
  assert.ok(
    !found.some((f) => f.startsWith("src/styles/tokens.css")),
    "tokens.css may declare @font-face",
  );
  rmSync(dir, { recursive: true });
});

test("14. spacing and size literals are violations", () => {
  const dir = tree({
    "src/styles/a.css": [
      ".a { padding: 28px; }", // 1
      ".b { margin: 0 auto; }", // 2 — fine
      ".c { gap: var(--space-2); }", // 3 — fine
      ".d { max-width: 940px; }", // 4
      ".e { width: 100%; height: auto; }", // 5 — fine
      ".f { inset: 0; }", // 6 — fine
      ".g { padding: calc(var(--space-2) + 4px); }", // 7
      ".h { max-width: calc(var(--shell) - var(--gutter)); }", // 8 — fine
      ".i { min-height: 100vh; }", // 9
      "",
    ].join("\n"),
  });
  only(dir, [
    "src/styles/a.css:1 spacing",
    "src/styles/a.css:4 spacing",
    "src/styles/a.css:7 spacing",
    "src/styles/a.css:9 spacing",
  ]);
  rmSync(dir, { recursive: true });
});

test("15. an unlisted violation fails and a listed one passes", () => {
  const dir = tree({ "src/styles/a.css": ".a { color: #fff; }\n" });
  const found = scanTree(dir);

  const bare = compareToSeed(found, []);
  assert.equal(bare.ok, false);
  assert.equal(bare.unlisted.length, 1);

  const seeded = compareToSeed(found, readSeed(serializeSeed(found)));
  assert.equal(seeded.ok, true, seeded.summary);
  rmSync(dir, { recursive: true });
});

test("16. a stale seed entry fails", () => {
  const dir = tree({ "src/styles/a.css": ".a { color: var(--text); }\n" });
  const seed = readSeed(
    serializeSeed([
      { file: "src/styles/a.css", line: 1, rule: "color", text: "#fff" },
    ]),
  );
  const result = compareToSeed(scanTree(dir), seed);
  assert.equal(result.ok, false);
  assert.equal(result.stale.length, 1);
  rmSync(dir, { recursive: true });
});

test("17. the real src/ and public/ pass against the seeded file", () => {
  const found = scanTree(repoRoot);
  const seed = readSeed(null, join(repoRoot, "scripts/token-violations.txt"));
  const result = compareToSeed(found, seed);
  assert.equal(result.ok, true, result.summary);
});
