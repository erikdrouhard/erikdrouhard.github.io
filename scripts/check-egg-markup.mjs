#!/usr/bin/env node
/**
 * Structural checks for the /about/ Easter-egg markup and CSS.
 *
 * These assert the things a build cannot prove about the pocket, the Play
 * button, and the sheet: that the page is exactly as tall as it was before the
 * egg existed, that the button is real and clipped out of sight, that the sheet
 * is genuinely display:none while hidden, and that a reduced-motion visitor
 * gets the button handed to them without a gesture.
 *
 * No game logic is exercised here — that belongs to the acceptance suite.
 *
 * Serves a built site, so run a build first. Both the port and the output
 * directory are overridable so this can run beside another preview server:
 *
 *   EGG_PORT=4323 EGG_OUTDIR=.dist-markup node scripts/check-egg-markup.mjs
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = Number(process.env.EGG_PORT || 4321);
const OUTDIR = process.env.EGG_OUTDIR || "dist";
const BASE = `http://127.0.0.1:${PORT}`;

/* The egg adds a pocket exactly as tall as the shell's bottom padding, which
   it zeroes, so the page it sits on must be the same height with the feature
   as without it. These numbers are how that is held.

   They are a baseline, not a constant. The first set (1233 / 1377 / 1800) was
   recorded before any egg file was touched; the set below was re-recorded
   after the design-system migration, which re-sourced the type scale and the
   spacing scale from tokens.css and so moved every page's height on purpose.
   Re-baselining is correct when a change to type or spacing is the *reason*
   the number moved — and only then. A height that moves while type and
   spacing hold still is the egg growing a pocket, which is the thing this
   check exists to catch. Do not re-record to make a red build green. */
const SCROLL_HEIGHTS = [
  { width: 1200, height: 900, expected: 1202 },
  { width: 810, height: 900, expected: 1269 },
  { width: 390, height: 800, expected: 1604 },
];

const server = spawn(
  "npx",
  ["astro", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--outDir", OUTDIR],
  { stdio: "ignore" },
);
const stopServer = () => server.kill();
process.on("exit", stopServer);

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try {
      await fetch(BASE + "/");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("astro preview never came up on " + BASE);
}
await waitForServer();

const results = [];
const ok = (name, pass, detail = "") => results.push({ name, pass, detail });

const browser = await chromium.launch();

/* --- 1. the page is exactly as tall as it was before the egg --- */
{
  const measured = [];
  let allMatch = true;
  for (const { width, height, expected } of SCROLL_HEIGHTS) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/about/", { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const got = await page.evaluate(() => document.documentElement.scrollHeight);
    measured.push(`${width}px: ${got} (want ${expected})`);
    if (got !== expected) allMatch = false;
    await ctx.close();
  }
  ok("the About page height is unchanged at all three widths", allMatch, measured.join(", "));
}

const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE + "/about/", { waitUntil: "networkidle" });

/* --- 2. the body class is scoped to /about/ --- */
{
  const onAbout = await page.evaluate(() => document.body.classList.contains("about-page"));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const onHome = await page.evaluate(() => document.body.classList.contains("about-page"));
  ok(
    "body.about-page is on /about/ and not on /",
    onAbout && !onHome,
    `about: ${onAbout}, home: ${onHome}`,
  );

  /* --- 3. the gesture is claimed only on /about/ --- */
  const homeOverscroll = await page.evaluate(
    () => getComputedStyle(document.documentElement).overscrollBehaviorY,
  );
  await page.goto(BASE + "/about/", { waitUntil: "networkidle" });
  const aboutOverscroll = await page.evaluate(
    () => getComputedStyle(document.documentElement).overscrollBehaviorY,
  );
  ok(
    "overscroll-behavior-y is none on /about/ and auto on /",
    aboutOverscroll === "none" && homeOverscroll === "auto",
    `about: ${aboutOverscroll}, home: ${homeOverscroll}`,
  );
}

/* --- 4. the Play button is real, enabled, and clipped below the fold --- */
{
  const play = page.locator(".egg-play");
  const shape = await play.evaluate((el) => ({
    tag: el.tagName,
    type: el.getAttribute("type"),
    name: el.textContent.trim(),
    disabled: el.disabled,
  }));
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  const box = await play.boundingBox();
  const viewportH = page.viewportSize().height;
  ok(
    "the Play button is an enabled <button> named Play, clipped below the viewport",
    shape.tag === "BUTTON" &&
      shape.type === "button" &&
      shape.name === "Play" &&
      shape.disabled === false &&
      box !== null &&
      box.y >= viewportH - 0.5,
    `${shape.tag}[type=${shape.type}] "${shape.name}" disabled=${shape.disabled}, top ${box && Math.round(box.y)} vs viewport ${viewportH}`,
  );
}

/* --- 5. the sheet is genuinely display:none, and holds the close + canvas --- */
{
  const sheet = await page.evaluate(() => {
    const s = document.querySelector(".egg-sheet");
    if (!s) return null;
    const close = s.querySelector(".egg-close");
    const canvas = s.querySelector(".egg-canvas");
    return {
      display: getComputedStyle(s).display,
      hidden: s.hasAttribute("hidden"),
      label: s.getAttribute("aria-label"),
      closeTag: close && close.tagName,
      closeName: close && close.textContent.trim(),
      canvasTag: canvas && canvas.tagName,
      canvasLabel: canvas && canvas.getAttribute("aria-label"),
    };
  });
  ok(
    "the hidden sheet computes to display:none and contains the close button and canvas",
    sheet !== null &&
      sheet.hidden === true &&
      sheet.display === "none" &&
      sheet.label === "Block breaker" &&
      sheet.closeTag === "BUTTON" &&
      sheet.closeName === "Close" &&
      sheet.canvasTag === "CANVAS" &&
      /paddle/i.test(sheet.canvasLabel || ""),
    sheet ? `display:${sheet.display}, canvas aria-label ${JSON.stringify(sheet.canvasLabel)}` : "no .egg-sheet",
  );
}

/* --- 6 and 7. reduced motion hands the button over without a gesture --- */
{
  const rmCtx = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    reducedMotion: "reduce",
  });
  const rm = await rmCtx.newPage();
  await rm.goto(BASE + "/about/", { waitUntil: "networkidle" });
  await rm.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await rm.waitForTimeout(200);

  const box = await rm.locator(".egg-play").boundingBox();
  const viewportH = rm.viewportSize().height;
  const inView = box !== null && box.y >= 0 && box.y + box.height <= viewportH;

  /* Focus the footer's last link, then Tab: the pocket sits after the footer,
     so one press must land on the button. */
  await rm.evaluate(() => {
    const links = document.querySelectorAll(".site-footer a");
    links[links.length - 1].focus();
  });
  await rm.keyboard.press("Tab");
  const focus = await rm.evaluate(() => {
    const el = document.activeElement;
    return { cls: el.className, outline: getComputedStyle(el).outlineStyle };
  });

  ok(
    "under reduced motion the button is in view and one Tab past the footer",
    inView && /\begg-play\b/.test(focus.cls),
    `box ${box && `${Math.round(box.y)}–${Math.round(box.y + box.height)}`} of ${viewportH}, focus "${focus.cls}"`,
  );
  ok(
    "the focused Play button draws a focus ring",
    /\begg-play\b/.test(focus.cls) && focus.outline !== "none",
    `outline-style: ${focus.outline}`,
  );
  await rmCtx.close();
}

await browser.close();
stopServer();

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  — " + r.detail : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
