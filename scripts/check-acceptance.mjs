#!/usr/bin/env node
/**
 * The pre-merge acceptance checklist, executable.
 *
 * These are the behaviors that only exist at runtime and that a build cannot
 * prove: that the smoke field does not accumulate a render loop per navigation,
 * that data-field and the chosen theme survive a ClientRouter swap, that a
 * keyboard shortcut cannot fire a control from a page you already left, and
 * that every destination is still reachable with JavaScript off.
 *
 * Serves dist/, so run `npm run build` first — or use `npm run check:all`.
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:4321";

const server = spawn("npx", ["astro", "preview", "--host", "127.0.0.1"], {
  stdio: "ignore",
});
const stopServer = () => server.kill();
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
  throw new Error("astro preview never came up on " + BASE);
}
await waitForServer();

const results = [];
const ok = (name, pass, detail = "") =>
  results.push({ name, pass, detail });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });

// Count requestAnimationFrame callbacks. One render loop == ~1 call per frame.
// If navigations leak loops, the rate multiplies.
await ctx.addInitScript(() => {
  window.__raf = 0;
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => {
    window.__raf++;
    return orig(cb);
  };
});

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

async function rafRate(ms = 1000) {
  await page.evaluate(() => (window.__raf = 0));
  await page.waitForTimeout(ms);
  return page.evaluate(() => window.__raf);
}

await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const baseline = await rafRate();
ok("field runs on the home page", baseline > 20, `${baseline} rAF/s`);

// --- navigate home -> work -> case -> back, five times ---
for (let i = 0; i < 5; i++) {
  await page.click('a.back, a[href="/work/"]').catch(() => {});
  await page.goto(BASE + "/work/", { waitUntil: "networkidle" });
  await page.click('.grid a.card >> nth=2');
  await page.waitForURL("**/work/**");
  await page.waitForTimeout(250);
  await page.goBack();
  await page.waitForTimeout(250);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
}
await page.waitForTimeout(500);
const after = await rafRate();
// one loop == baseline. Two loops == ~2x. Allow 40% slack for scheduling noise.
ok(
  "exactly one RAF loop after 5 round trips",
  after < baseline * 1.4,
  `baseline ${baseline}/s -> after ${after}/s`,
);

// --- quiet mode honored on case pages ---
await page.goto(BASE + "/work/mix-dialog/", { waitUntil: "networkidle" });
ok(
  'case page body carries data-field="quiet"',
  (await page.getAttribute("body", "data-field")) === "quiet",
);

// --- client navigation updates data-field ---
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.click('.grid a.card >> nth=0');
await page.waitForURL("**/work/verse-design-system/**");
await page.waitForTimeout(400);
ok(
  "data-field becomes quiet after a CLIENT navigation",
  (await page.getAttribute("body", "data-field")) === "quiet",
);

// --- theme persists across a client navigation ---
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.click(".theme-toggle");
await page.waitForTimeout(200);
const afterToggle = await page.getAttribute("html", "data-theme");
await page.click('a[href="/work/"]');
await page.waitForURL("**/work/**");
await page.waitForTimeout(400);
const afterNav = await page.getAttribute("html", "data-theme");
ok(
  "theme survives a client navigation",
  afterToggle === "light" && afterNav === "light",
  `toggled -> ${afterToggle}, after nav -> ${afterNav}`,
);

// --- no flash: saved light theme is applied before first paint ---
const p2 = await ctx.newPage();
await p2.goto(BASE + "/about/", { waitUntil: "commit" });
const early = await p2.evaluate(() =>
  document.documentElement.getAttribute("data-theme"),
);
ok("saved theme is on <html> before the body renders", early === "light", `got ${early}`);
await p2.close();

// --- keyboard shortcut ---
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.keyboard.press("d");
await page.waitForTimeout(900);
ok(
  'pressing D on the home page opens Mix.dialog',
  page.url().includes("/work/mix-dialog/"),
  page.url(),
);

// --- a shortcut from another page must not fire here ---
await page.waitForTimeout(300);
const before = page.url();
await page.keyboard.press("h"); // H is a home-page card key; not on a case page
await page.waitForTimeout(700);
ok(
  "a home-page shortcut does not fire from a case page",
  page.url() === before,
  `${before} -> ${page.url()}`,
);

// --- Enter activates the card-shaped closing block ---
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.focus(".close-card");
await page.keyboard.press("Enter");
await page.waitForTimeout(900);
ok("Enter activates the closing card", page.url().includes("/about/"), page.url());

// --- stagger leaves nothing stuck invisible ---
await page.goto(BASE + "/work/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const hidden = await page.$$eval("main.view .grid > *", (els) =>
  els.filter((e) => parseFloat(getComputedStyle(e).opacity) < 0.99).length,
);
ok("every work card is fully visible after the stagger", hidden === 0, `${hidden} still faded`);

// --- the field must sit outside the root view transition ---
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(300);
const vtName = await page.evaluate(
  () => getComputedStyle(document.getElementById("field")).viewTransitionName,
);
ok(
  "the persisted field has its own view-transition-name",
  vtName && vtName !== "none",
  `got ${vtName} — without one the root transition lifts and fades the canvas`,
);

// --- card hover transition survives the stagger ---
await page.goto(BASE + "/work/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const stuck = await page.evaluate(() => {
  const v = document.querySelector("main.view");
  return v.className.includes("is-entered") || v.className.includes("is-entering");
});
ok("stagger classes are cleaned up, so card hover stays animated", !stuck);

// --- reduced motion: static field, no loop ---
const rmCtx = await browser.newContext({ reducedMotion: "reduce" });
await rmCtx.addInitScript(() => {
  window.__raf = 0;
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => {
    window.__raf++;
    return orig(cb);
  };
});
const rm = await rmCtx.newPage();
await rm.goto(BASE + "/", { waitUntil: "networkidle" });
await rm.waitForTimeout(300);
await rm.evaluate(() => (window.__raf = 0));
await rm.waitForTimeout(1000);
const rmRate = await rm.evaluate(() => window.__raf);
ok("reduced motion renders one static frame, no loop", rmRate < 5, `${rmRate} rAF/s`);
await rmCtx.close();

// --- JS disabled: every destination still reachable ---
const noJs = await browser.newContext({ javaScriptEnabled: false });
const nj = await noJs.newPage();
await nj.goto(BASE + "/", { waitUntil: "domcontentloaded" });
const links = await nj.$$eval("a[href]", (as) =>
  as.map((a) => a.getAttribute("href")),
);
for (const want of ["/work/", "/about/", "/work/mix-dialog/"]) {
  ok(`without JS, the home page links to ${want}`, links.includes(want));
}
await noJs.close();

ok("no console errors or page exceptions", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
stopServer();

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  — " + r.detail : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
