#!/usr/bin/env node
/**
 * Ticket 04 — the overscroll gesture, the three springs, and the takeover.
 *
 * Temporary: ticket 06 folds whatever survives here into check-acceptance.mjs
 * and deletes this file.
 *
 * Everything below is runtime-only. A build can prove that egg-gesture.js
 * parses; it cannot prove that a wheel notch at the bottom of /about/ pulls a
 * button out of a clipped pocket, overshoots, and settles — or that the loop
 * driving it parks itself when nothing is moving, which is the difference
 * between an Easter egg and a permanent 60 Hz tax on the About page.
 *
 * Serves a build, like check-acceptance.mjs does, so run
 *   npx astro build --outDir .dist-gesture
 *   EGG_PORT=4327 EGG_OUTDIR=.dist-gesture node scripts/check-egg-gesture.mjs
 * The two env overrides exist because Erik's dev server owns 4321 and dist/.
 *
 * Two departures from the recipe the ticket sketched, both accepted:
 *
 * - The overshoot and re-arm gestures are eight wheel events back to back, not
 *   four with 30ms gaps. EVENT_CAP holds one event's contribution to 40, which
 *   is what stops a single mouse notch from skipping the tension phase, and
 *   pull drains 10% a frame; four events cannot reach the threshold of 110, and
 *   Playwright's own round trip already spaces them ~25ms apart. Sampling
 *   starts before the burst, because release fires part way through it and the
 *   peak is behind us by the last event.
 * - PEEK_MAX is read from the pocket rather than assumed to be the wireframe's
 *   92, so these assertions hold at both breakpoints. See the decision note at
 *   the top of src/scripts/egg-gesture.js.
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = Number(process.env.EGG_PORT || 4321);
const OUTDIR = process.env.EGG_OUTDIR || "dist";
const BASE = "http://127.0.0.1:" + PORT;

const server = spawn(
  "npx",
  [
    "astro",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(PORT),
    "--outDir",
    OUTDIR,
  ],
  { stdio: "ignore" },
);
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
const ok = (name, pass, detail = "") => results.push({ name, pass, detail });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });

// Same rAF counter as the acceptance suite: one render loop is ~1 call/frame,
// so a leaked or unparked loop shows up as a multiple of the home baseline.
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

/* The button's inline transform in px, positive = out of the pocket. The
   gesture writes translate(-50%, -Npx); the computed matrix is the only place
   that reports what actually landed on screen. */
const btnOut = () =>
  page.evaluate(() => {
    const el = document.querySelector(".egg-play");
    return -new DOMMatrix(getComputedStyle(el).transform).m42;
  });

/* The sheet's translateY as a percentage of its own height, which is the unit
   the spring works in. 100 = fully offscreen, 0 = fully up. */
const sheetPct = () =>
  page.evaluate(() => {
    const el = document.querySelector(".egg-sheet");
    if (el.hidden) return 100;
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return (m.m42 / el.offsetHeight) * 100;
  });

const shellScale = () =>
  page.evaluate(() => {
    const el = document.querySelector(".shell");
    return new DOMMatrix(getComputedStyle(el).transform).a;
  });

const scrimOpacity = () =>
  page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector(".egg-scrim")).opacity),
  );

async function toBottom() {
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await page.waitForTimeout(250);
}

/* Sampling in-page rather than round-tripping over CDP: an overshoot that
   lasts six frames is invisible to a poll whose floor is a few tens of ms.
   Started BEFORE the gesture, because the release fires part-way through the
   burst and the peak is already behind us by the time the last event lands. */
async function startSampling(ms) {
  await page.evaluate((duration) => {
    window.__samples = [];
    const el = document.querySelector(".egg-play");
    const t0 = performance.now();
    const tick = () => {
      window.__samples.push(-new DOMMatrix(getComputedStyle(el).transform).m42);
      if (performance.now() - t0 < duration) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, ms);
}

async function readSamples() {
  return page.evaluate(() => window.__samples);
}

/* A burst of overscroll, as a trackpad delivers it.
   Eight events, not the four the ticket first sketched: EVENT_CAP holds one
   event's contribution to 40 (which is what stops a single mouse notch from
   skipping the tension phase), pull drains 10% a frame, and Playwright's own
   round trip spaces these ~25ms apart. Four can never reach the threshold of
   110; eight crosses it on the sixth, which is the tension stage doing its job
   rather than the test being generous. */
async function pullBurst(n = 8) {
  for (let i = 0; i < n; i++) await page.mouse.wheel(0, 120);
}

async function openAbout() {
  await page.goto(BASE + "/about/", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
}

// --- the baseline: the smoke field alone, one loop -------------------------
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const baseline = await rafRate();
ok("home page baseline: one render loop", baseline > 20, `${baseline} rAF/s`);

await openAbout();

/* PEEK_MAX is the pocket's height, read from the DOM rather than hard-coded:
   the pocket is 88px wide-screen and 64px under 720px, because it has to equal
   the shell padding it replaced. See the decision note in egg-gesture.js. */
const peekMax = await page.evaluate(
  () => document.querySelector(".egg-pocket").clientHeight,
);
ok("the pocket has a height to travel", peekMax > 0, `PEEK_MAX ${peekMax}px`);

// --- 1. normal scrolling is never swallowed -------------------------------
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
const scrollSamples = [];
for (let i = 0; i < 10; i++) {
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(50);
  scrollSamples.push(
    await page.evaluate(() => ({
      y: Math.round(window.scrollY),
      bottom:
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2,
      out: -new DOMMatrix(
        getComputedStyle(document.querySelector(".egg-play")).transform,
      ).m42,
    })),
  );
}
/* Two things at once. scrollY never goes backwards, so the wheel was not
   swallowed on the way down; and every sample taken before the page reached
   its end shows the button still in the pocket, so tension only accumulates
   at the bottom. */
const ys = scrollSamples.map((s) => s.y);
let monotonic = true;
for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i - 1]) monotonic = false;
const movedEarly = scrollSamples.some((s) => !s.bottom && s.out > 0.5);
ok(
  "normal scrolling still scrolls, and the button stays in the pocket",
  monotonic && ys[ys.length - 1] > ys[0] && !movedEarly,
  `scrollY ${ys[0]} -> ${ys[ys.length - 1]}, reached bottom ${scrollSamples.some((s) => s.bottom)}, button before bottom ${scrollSamples.filter((s) => !s.bottom).map((s) => s.out.toFixed(1)).join("/")}`,
);

// --- 2. overshoot: past the threshold it pops, overshoots, settles ---------
await openAbout();
await toBottom();
await startSampling(1200);
await pullBurst();
await page.waitForTimeout(1100);
const samples = await readSamples();
const peak = Math.max(...samples);
const final = samples[samples.length - 1];
/* The overshoot is the whole effect. A button that merely slid out would land
   on PEEK_MAX and never pass it, so the 6px floor is what separates "popped
   free" from "was revealed". */
ok(
  "overshoot: the button pops past its rest position and settles back onto it",
  peak >= peekMax + 6 && Math.abs(final - peekMax) <= 2,
  `peak ${peak.toFixed(1)}px vs PEEK_MAX ${peekMax}px, final ${final.toFixed(1)}px`,
);

// --- 3. retract: a single notch is not enough -----------------------------
await openAbout();
await toBottom();
await page.mouse.wheel(0, 60);
await page.waitForTimeout(900);
const retracted = await btnOut();
ok(
  "one notch is below the threshold, so the button retracts",
  Math.abs(retracted) <= 1,
  `${retracted.toFixed(2)}px out`,
);

// --- 4. takeover ----------------------------------------------------------
await openAbout();
await toBottom();
await pullBurst();
await page.waitForTimeout(700);
await page.click(".egg-play");
await page.waitForTimeout(1200);
const openPct = await sheetPct();
const openScale = await shellScale();
const openScrim = await scrimOpacity();
const openInert = await page.evaluate(
  () => document.querySelector(".shell").hasAttribute("inert"),
);
const focused = await page.evaluate(
  () => document.activeElement && document.activeElement.className,
);
ok(
  "takeover: the sheet is up, the shell is scaled back, dimmed and inert",
  Math.abs(openPct) <= 1 &&
    Math.abs(openScale - 0.96) <= 0.005 &&
    Math.abs(openScrim - 0.55) <= 0.02 &&
    openInert,
  `sheet ${openPct.toFixed(2)}%, scale ${openScale.toFixed(3)}, scrim ${openScrim.toFixed(3)}, inert ${openInert}`,
);
ok(
  "opening the sheet moves focus to Close",
  String(focused).includes("egg-close"),
  `activeElement .${focused}`,
);

/* The field is paused while the sheet is open, and two loops legitimately run
   in its place: this one and the game's. That measures ~2.3x the home
   baseline. A field that had not paused would make three loops and ~3x, so the
   bound sits between them rather than at either end. */
const openRate = await rafRate();
ok(
  "with the sheet open the field is paused and only the egg's loops run",
  openRate < baseline * 2.65,
  `home baseline ${baseline}/s -> sheet open ${openRate}/s`,
);

// --- 5. escape ------------------------------------------------------------
await page.keyboard.press("Escape");
await page.waitForTimeout(1400);
const closedHidden = await page.evaluate(
  () => document.querySelector(".egg-sheet").hidden,
);
const closedInert = await page.evaluate(
  () => document.querySelector(".shell").hasAttribute("inert"),
);
const closedShell = await page.evaluate(
  () => getComputedStyle(document.querySelector(".shell")).transform,
);
const closedRate = await rafRate();
ok(
  "escape puts the sheet away and leaves the page exactly as it was",
  closedHidden &&
    !closedInert &&
    (closedShell === "none" || closedShell === "matrix(1, 0, 0, 1, 0, 0)") &&
    closedRate < baseline * 1.4,
  `hidden ${closedHidden}, inert ${closedInert}, shell "${closedShell}", ${closedRate} rAF/s vs baseline ${baseline}`,
);

// --- 6. re-arm: the egg can be found again, no reload ----------------------
const rearmed = await btnOut();
await toBottom();
await startSampling(1200);
await pullBurst();
await page.waitForTimeout(1100);
const samples2 = await readSamples();
const peak2 = Math.max(...samples2);
const final2 = samples2[samples2.length - 1];
ok(
  "re-arm: the button retracted on close and pulls out again without a reload",
  Math.abs(rearmed) <= 1 && peak2 >= peekMax + 6 && Math.abs(final2 - peekMax) <= 2,
  `retracted to ${rearmed.toFixed(2)}px, then peak ${peak2.toFixed(1)}px, final ${final2.toFixed(1)}px`,
);

// --- 7. Back mid-open -----------------------------------------------------
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.click('nav a[href="/about/"]');
await page.waitForURL("**/about/**");
await page.waitForTimeout(400);
await toBottom();
await pullBurst();
await page.waitForTimeout(700);
await page.click(".egg-play");
await page.waitForTimeout(200);
await page.goBack();
await page.waitForURL(BASE + "/");
await page.waitForTimeout(600);
const backInert = await page.evaluate(
  () => document.querySelector(".shell").hasAttribute("inert"),
);
const backShell = await page.evaluate(
  () => document.querySelector(".shell").getAttribute("style") || "",
);
const backRate = await rafRate();
ok(
  "Back mid-open hands the next page a clean, unscaled, live shell",
  !backInert &&
    !backShell.includes("transform") &&
    backRate > 20 &&
    backRate < baseline * 1.4,
  `inert ${backInert}, style "${backShell}", ${backRate} rAF/s vs baseline ${baseline}`,
);

// --- 8. idle cost ---------------------------------------------------------
await openAbout();
await page.waitForTimeout(600);
const idleRate = await rafRate();
ok(
  "an idle About page costs no frames beyond the field",
  idleRate < baseline * 1.4,
  `home baseline ${baseline}/s -> idle About ${idleRate}/s`,
);

/* --- reduced motion: the button is simply handed over ---------------------
   A discovery mechanic built on a gesture is inaccessible by nature, so there
   is no gesture here — the button starts out and the loop never runs. theme.css
   places it at -92px, which overhangs an 88px pocket and a 64px one badly; the
   single frame the gesture writes at init corrects it at both breakpoints. */
const rmCtx = await browser.newContext({
  viewport: { width: 1200, height: 900 },
  reducedMotion: "reduce",
});
await rmCtx.addInitScript(() => {
  window.__raf = 0;
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => {
    window.__raf++;
    return orig(cb);
  };
});
const rm = await rmCtx.newPage();
await rm.goto(BASE + "/about/", { waitUntil: "networkidle" });
await rm.waitForTimeout(500);
const rmOut = await rm.evaluate(
  () => -new DOMMatrix(getComputedStyle(document.querySelector(".egg-play")).transform).m42,
);
const rmPocket = await rm.evaluate(
  () => document.querySelector(".egg-pocket").getBoundingClientRect().top,
);
const rmTop = await rm.evaluate(
  () => document.querySelector(".egg-play").getBoundingClientRect().top,
);
await rm.evaluate(() => (window.__raf = 0));
await rm.waitForTimeout(1000);
const rmRate = await rm.evaluate(() => window.__raf);
ok(
  "reduced motion: the button is out, flush with the pocket, and costs no frames",
  Math.abs(rmOut - peekMax) <= 0.5 && rmTop >= rmPocket - 0.5 && rmRate < 5,
  `${rmOut}px out of ${peekMax}px, top edge ${(rmTop - rmPocket).toFixed(1)}px inside the pocket, ${rmRate} rAF/s`,
);
await rmCtx.close();

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
