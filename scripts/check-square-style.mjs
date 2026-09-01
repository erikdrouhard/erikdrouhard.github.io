#!/usr/bin/env node
/**
 * Proves the case studies wear the site's button and nothing else.
 *
 * The homepage's `.btn` / `.btn.primary` is the reference: this script reads
 * its computed style at each width and theme, then asserts every case-study
 * button computes the same values. Computed style rather than a screenshot,
 * because the failure this guards against is a page quietly re-declaring a
 * radius, a face, or a font — which a diff of pixels reports as "something
 * moved" and a diff of properties reports as the property that moved.
 *
 * It also asserts the pill is gone from the DOM, and that every selector a
 * page manifest lists computes to `border-radius: 0px` on all four corners.
 *
 * Serves dist/ through `astro preview`, so run `npm run build` first — or set
 * SQUARE_BASE to an already-running server (a wave-2 dev server, say) and
 * nothing is spawned:
 *
 *   SQUARE_BASE=http://127.0.0.1:4399 node scripts/check-square-style.mjs --page microsoft
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import manifests from "./square-style/manifest.mjs";

const WIDTHS = [1200, 810, 390];
const THEMES = ["light", "dark"];

/* The properties that decide whether two buttons are the same button. Radii
   and border first because those are what the square-corner sweep changes;
   the type properties because a case page's serif body used to leak into the
   button through inheritance. */
const PROPS = [
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "borderTopWidth",
  "borderTopColor",
  "backgroundColor",
  "color",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "fontSize",
  "fontFamily",
  "fontWeight",
  "lineHeight",
];

const CORNERS = [
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
];

const PRIMARY = ".btn.primary";
const SECONDARY = ".btn:not(.primary)";

// --- arguments -------------------------------------------------------------
const argv = process.argv.slice(2);
const pageArg = argv.includes("--page")
  ? argv[argv.indexOf("--page") + 1]
  : null;
const pages = pageArg
  ? manifests.filter((m) => m.slug === pageArg)
  : manifests;
if (pageArg && pages.length === 0) {
  console.error(
    `unknown --page ${pageArg}; known: ${manifests.map((m) => m.slug).join(", ")}`,
  );
  process.exit(1);
}

// --- server ----------------------------------------------------------------
/* SQUARE_BASE points the run at a server someone else is already running.
   Wave 2 needs that: four concurrent `astro build`s would share one dist/. */
const EXTERNAL = process.env.SQUARE_BASE || null;
const PORT = Number(process.env.ACCEPTANCE_PORT || 4321);
const BASE = EXTERNAL || "http://127.0.0.1:" + PORT;

let server = null;
if (!EXTERNAL) {
  server = spawn(
    "npx",
    ["astro", "preview", "--host", "127.0.0.1", "--port", String(PORT)],
    { stdio: "ignore" },
  );
}
const stopServer = () => server && server.kill();
process.on("exit", stopServer);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(BASE + "/");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("no server answering on " + BASE);
}
await waitForServer();

// --- harness ---------------------------------------------------------------
const results = [];
const ok = (name, pass, detail = "") => results.push({ name, pass, detail });

const browser = await chromium.launch();

/* Read every listed property off every element matching a selector. Runs in
   the page so getComputedStyle resolves the cascade the browser actually
   applied, custom properties and media queries included. */
async function readStyles(page, selector, props) {
  return page.$$eval(
    selector,
    (els, props) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        const out = {};
        for (const p of props) out[p] = cs[p];
        return out;
      }),
    props,
  );
}

/* `.btn` transitions border-color and background over 150ms, so a computed
   style read straight after the theme flips returns a colour part-way between
   the two palettes — and two pages sampled a few milliseconds apart disagree
   about a button that is in fact identical. Killing transitions first makes
   every read the settled value. */
const NO_TRANSITIONS = `*, *::before, *::after {
  transition: none !important;
  animation: none !important;
}`;

async function setTheme(page, theme) {
  await page.addStyleTag({ content: NO_TRANSITIONS });
  await page.evaluate(
    (t) => document.documentElement.setAttribute("data-theme", t),
    theme,
  );
  // one frame, so the recalculated cascade is what the next read sees
  await page.waitForTimeout(60);
}

for (const width of WIDTHS) {
  for (const theme of THEMES) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    // --- reference: the homepage's own closing-card pair -------------------
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await setTheme(page, theme);
    const refPrimary = (
      await readStyles(page, ".close-actions " + PRIMARY, PROPS)
    )[0];
    const refSecondary = (
      await readStyles(page, ".close-actions " + SECONDARY, PROPS)
    )[0];
    if (!refPrimary || !refSecondary) {
      ok(
        `homepage reference button found @${width}/${theme}`,
        false,
        "the closing card's .btn pair did not render",
      );
      await ctx.close();
      continue;
    }

    for (const m of pages) {
      const at = `${m.slug} @${width}/${theme}`;
      await page.goto(BASE + m.path, { waitUntil: "networkidle" });
      await setTheme(page, theme);

      // 1. the pill is gone from the DOM, not merely unstyled
      const pillCount = await page.evaluate(
        () =>
          document.querySelectorAll(".pill, .pill-primary, .pill-secondary")
            .length,
      );
      ok(`no pill markup — ${at}`, pillCount === 0, `${pillCount} found`);

      // 2. the page renders exactly the buttons the manifest declares
      const primaries = await readStyles(page, PRIMARY, PROPS);
      const secondaries = await readStyles(page, SECONDARY, PROPS);
      ok(
        `button counts — ${at}`,
        primaries.length === m.buttons.primary &&
          secondaries.length === m.buttons.secondary,
        `primary ${primaries.length}/${m.buttons.primary}, ` +
          `secondary ${secondaries.length}/${m.buttons.secondary}`,
      );

      // 3. every button is the homepage button, property for property
      for (const [label, found, ref, selector] of [
        ["primary", primaries, refPrimary, PRIMARY],
        ["secondary", secondaries, refSecondary, SECONDARY],
      ]) {
        let diff = null;
        found.forEach((got, i) => {
          if (diff) return;
          for (const p of PROPS) {
            if (got[p] !== ref[p]) {
              diff = `${selector} #${i} ${p}: ${got[p]} ≠ homepage ${ref[p]}`;
              return;
            }
          }
        });
        ok(
          `${label} matches homepage — ${at}`,
          found.length > 0 && diff === null,
          diff || (found.length === 0 ? "no button matched " + selector : ""),
        );
      }

      // 4. every selector the page claims to have squared really is square
      for (const selector of m.square) {
        const boxes = await readStyles(page, selector, CORNERS);
        const bad = boxes.findIndex((b) =>
          CORNERS.some((c) => b[c] !== "0px"),
        );
        ok(
          `square: ${selector} — ${at}`,
          boxes.length > 0 && bad === -1,
          boxes.length === 0
            ? "matched no element"
            : bad === -1
              ? ""
              : `#${bad} has ${CORNERS.map((c) => boxes[bad][c]).join("/")}`,
        );
      }
    }

    ok(
      `no console errors @${width}/${theme}`,
      errors.length === 0,
      errors.slice(0, 3).join(" | "),
    );
    await ctx.close();
  }
}

await browser.close();
stopServer();

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(
    `${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  — " + r.detail : ""}`,
  );
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
