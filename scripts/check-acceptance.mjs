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
 *
 * /work/ was retired: the index page and the MDX-driven [...slug] route are in
 * .archive/, the four studies are hand-written pages, and the home-page grid is
 * the only listing. So the round trips below hop home -> study -> home, and
 * /work/ is asserted to 404 rather than to render.
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";

/* 4321 is the default and what CI uses. The override exists so a run can be
   pointed at a free port when a dev server is already squatting on 4321 —
   otherwise `astro preview` fails to bind, the fetch below succeeds against
   the other server, and the whole suite silently checks the wrong build. */
const PORT = Number(process.env.ACCEPTANCE_PORT || 4321);
const BASE = "http://127.0.0.1:" + PORT;

const server = spawn(
  "npx",
  ["astro", "preview", "--host", "127.0.0.1", "--port", String(PORT)],
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

/* --- navigate home -> case -> back, five times ---
   Case pages run field="off", so each hop asks initField() to tear the loop
   down and build it again. That is exactly the path that leaked a loop per
   navigation before, and the mode change makes it a harder test than the old
   full -> quiet hop, not an easier one. */
for (let i = 0; i < 5; i++) {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  await page.click('.grid a.card >> nth=2');
  await page.waitForURL("**/work/mix-dialog/**");
  await page.waitForTimeout(250);
  await page.goBack();
  await page.waitForTimeout(250);
}
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const after = await rafRate();
// one loop == baseline. Two loops == ~2x. Allow 40% slack for scheduling noise.
ok(
  "exactly one RAF loop after 5 round trips",
  after < baseline * 1.4,
  `baseline ${baseline}/s -> after ${after}/s`,
);

/* --- field is off on case pages ---
   Each ported study paints its own opaque page background, so the smoke would
   be invisible under it and the loop would burn frames for nothing. */
await page.goto(BASE + "/work/mix-dialog/", { waitUntil: "networkidle" });
ok(
  'case page body carries data-field="off"',
  (await page.getAttribute("body", "data-field")) === "off",
);

// a case page must not run a render loop at all
await page.waitForTimeout(300);
const caseRate = await rafRate();
ok("no rAF loop on a case page", caseRate < 5, `${caseRate} rAF/s`);

// --- client navigation updates data-field ---
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.click('.grid a.card >> nth=0');
await page.waitForURL("**/work/verse-design-system/**");
await page.waitForTimeout(400);
ok(
  'data-field becomes "off" after a CLIENT navigation',
  (await page.getAttribute("body", "data-field")) === "off",
);

// --- theme persists across a client navigation ---
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.click(".theme-toggle");
await page.waitForTimeout(200);
const afterToggle = await page.getAttribute("html", "data-theme");
await page.click('.grid a.card >> nth=0');
await page.waitForURL("**/work/verse-design-system/**");
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
await page.goto(BASE + "/", { waitUntil: "networkidle" });
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
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const stuck = await page.evaluate(() => {
  const v = document.querySelector("main.view");
  return v.className.includes("is-entered") || v.className.includes("is-entering");
});
ok("stagger classes are cleaned up, so card hover stays animated", !stuck);

// --- the work index is gone, and stays gone ---
/* Fetched rather than navigated to: a 404 render would add noise to the
   console-error assertion at the end without proving anything more. */
const workIndex = await page.request.get(BASE + "/work/");
ok("/work/ 404s — the index was retired", workIndex.status() === 404, `status ${workIndex.status()}`);

await page.goto(BASE + "/", { waitUntil: "networkidle" });
const navHrefs = await page.$$eval(".site-nav a[href]", (as) =>
  as.map((a) => a.getAttribute("href")),
);
ok(
  "the header has no Work link",
  !navHrefs.some((h) => h === "/work/" || h === "/work"),
  navHrefs.join(" "),
);

/* --- each study renders its own hand-written page ---
   The body class is the hook every ported stylesheet is scoped to, so if a
   study ever fell back to a shared template this is what would notice. */
const STUDY_BODY_CLASS = {
  "verse-design-system": "mix-page--verse",
  microsoft: "core-ai-page",
  "mix-dialog": "mix-page",
  "dragon-drive": "drive-page",
};
for (const [slug, cls] of Object.entries(STUDY_BODY_CLASS)) {
  await page.goto(BASE + `/work/${slug}/`, { waitUntil: "domcontentloaded" });
  const bodyClass = (await page.getAttribute("body", "class")) || "";
  ok(
    `/work/${slug}/ renders its own page (.${cls})`,
    bodyClass.split(/\s+/).includes(cls),
    `body class "${bodyClass}"`,
  );

  /* The live site ranked the sticky chapter rail under .site-header with
     --layer-sticky-nav / --layer-header. BaseLayout's <Nav> is not that header
     and carries no z-index, so the two are ordered by geometry now: the nav
     scrolls away, the rail sticks to the top of an empty viewport. Asserted
     rather than reasoned about, because if <Nav> ever becomes sticky this is
     the first thing that breaks and nothing else would notice. */
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.waitForTimeout(200);
  const rail = await page.evaluate(() => {
    const nav = document.querySelector(".site-nav");
    const bar = document.querySelector("case-study-nav");
    if (!nav || !bar) return { missing: !nav ? "nav" : "rail" };
    const n = nav.getBoundingClientRect();
    const r = bar.getBoundingClientRect();
    return {
      stuck: Math.round(r.top) === 0,
      overlap: !(n.bottom <= r.top || r.bottom <= n.top),
      navPosition: getComputedStyle(nav).position,
    };
  });
  ok(
    `${slug}: the sticky chapter rail never collides with the site nav`,
    rail.stuck && !rail.overlap,
    `nav position ${rail.navPosition}, rail stuck ${rail.stuck}, overlap ${rail.overlap}`,
  );
}

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
/* /work/ is not in this list on purpose — the index is retired. Every study
   is now reached from the home grid, so every study has to be linked there. */
for (const want of [
  "/about/",
  "/work/verse-design-system/",
  "/work/microsoft/",
  "/work/mix-dialog/",
  "/work/dragon-drive/",
]) {
  ok(`without JS, the home page links to ${want}`, links.includes(want));
}
await noJs.close();

/* --- the Mix.dialog condition-stack demo across client navigations ---
   The demo is 22KB of stateful custom element written for a page that loads
   once. It is the piece of this site most likely to break under ClientRouter,
   and a build cannot prove any of it.

   What these assertions do NOT catch, established by experiment rather than
   assumed: listener double-binding. ClientRouter replaces the element wholesale
   on every navigation rather than re-inserting the same node, so each visit
   gets a freshly constructed element and listeners cannot accumulate. Moving
   the handler binds back into connectedCallback, and removing the teardown from
   disconnectedCallback, were both tried against this suite — it stayed green
   for both, because neither is reachable through a swap. The teardown in the
   source is still correct defensive practice; it is just not what is guarded
   here.

   What they do catch, verified by mutation: a demo that stops responding after
   a navigation. Deleting the click listener turns every delta to 0 and fails
   the first assertion.

   Deltas are compared across visits rather than to a literal. One add-elseif
   click legitimately adds nine branch nodes; asserting 9 would bake in a false
   failure the moment the demo's template changes. */
async function demoState() {
  await page.waitForSelector("condition-stack-demo [data-command]");
  const invite = page.locator('[data-command="try-demo"]');
  if (await invite.count()) {
    await invite.first().click();
    await page.waitForTimeout(300);
  }
  const branches = () =>
    page.evaluate(
      () =>
        document
          .querySelector("condition-stack-demo")
          .querySelectorAll("[data-branch-id]").length,
    );
  const before = await branches();
  const add = page.locator('[data-command="add-elseif"]').first();
  await add.scrollIntoViewIfNeeded();
  await add.click();
  await page.waitForTimeout(300);
  return { before, delta: (await branches()) - before };
}

await page.goto(BASE + "/work/mix-dialog/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
const demoVisits = [await demoState()];
const demoRates = [await rafRate()];

/* Client-side round trips only — a full page load would rebuild everything and
   prove nothing about teardown. */
for (let i = 0; i < 3; i++) {
  await page.click("a.mark");
  await page.waitForURL(BASE + "/");
  await page.waitForTimeout(300);
  await page.click('.grid a.card[href="/work/mix-dialog/"]');
  await page.waitForURL("**/work/mix-dialog/**");
  await page.waitForTimeout(500);
  demoVisits.push(await demoState());
  demoRates.push(await rafRate());
}

const spa = await page.evaluate(
  () => performance.getEntriesByType("navigation").length === 1,
);
ok("the demo round trips were client-side, not full loads", spa);

const deltas = demoVisits.map((v) => v.delta);
ok(
  "the demo still responds to a click after a client navigation",
  new Set(deltas).size === 1 && deltas[0] > 0,
  `branches added per click, each visit: [${deltas.join(", ")}]`,
);

const baselines = demoVisits.map((v) => v.before);
ok(
  "the demo resets to a cold state on re-entry",
  new Set(baselines).size === 1,
  `starting branch count, each visit: [${baselines.join(", ")}]`,
);

/* The demo animates, so this is not zero — it just must not grow. A leaked
   frame loop per navigation would climb with every round trip. */
ok(
  "the demo does not accumulate a render loop per navigation",
  demoRates[demoRates.length - 1] < demoRates[0] * 1.4 + 10,
  `rAF/s after interaction, each visit: [${demoRates.join(", ")}]`,
);

/* --- about easter egg (ticket 02) ---------------------------------------
   The lifecycle seams only. The markup lands in ticket 03 and the gesture,
   springs and game in 04/05, so where a check needs the button it injects a
   minimal .egg-* DOM with page.evaluate. Ticket 06 replaces that injection
   with the real markup and deletes the helper below.

   The plan names /experiments/ as a third "not About" route; it does not
   exist on this branch, so the second case study stands in for it. */

// 1. the lazy chunk is requested on /about/ and on no other route.
const eggUrls = [];
const onEggRequest = (r) => {
  if (r.url().includes("egg")) eggUrls.push(new URL(r.url()).pathname);
};
page.on("request", onEggRequest);

for (const route of ["/", "/work/mix-dialog/", "/work/dragon-drive/"]) {
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
}
const eggElsewhere = eggUrls.length;
await page.goto(BASE + "/about/", { waitUntil: "networkidle" });
await page.waitForTimeout(300);
const eggOnAbout = eggUrls.length - eggElsewhere;
page.off("request", onEggRequest);
ok(
  "the egg chunk is requested on /about/ and on no other route",
  eggElsewhere === 0 && eggOnAbout > 0,
  `off About: [${eggUrls.slice(0, eggElsewhere).join(", ")}] — on About: ${eggOnAbout}`,
);

// 2. about -> home -> about five times, client-side, no leaked loop.
for (let i = 0; i < 5; i++) {
  await page.click(".back");
  await page.waitForURL(BASE + "/");
  await page.waitForTimeout(250);
  await page.click('nav a[href="/about/"]');
  await page.waitForURL("**/about/**");
  await page.waitForTimeout(250);
}
await page.waitForTimeout(400);
const aboutRate = await rafRate();
ok(
  "one RAF loop on /about/ after 5 round trips",
  aboutRate < baseline * 1.4,
  `home baseline ${baseline}/s -> About ${aboutRate}/s`,
);

/* Inject the sheet the About markup will carry. .egg-play lives inside the
   shell (it is the pocket button); the sheet lives outside it, because the
   shell goes inert while the sheet is open. */
async function injectEggDom() {
  await page.evaluate(() => {
    document.querySelectorAll(".egg-play, .egg-sheet").forEach((n) => n.remove());
    // Both are pinned to the viewport, as the real pocket button and the real
    // sheet will be. Left in normal flow they land past the end of a long page
    // and the click times out scrolling after them.
    const play = document.createElement("button");
    play.className = "egg-play";
    play.type = "button";
    play.textContent = "Play";
    play.style.cssText = "position:fixed;right:8px;top:8px;z-index:9998";
    document.querySelector(".shell").append(play);

    const sheet = document.createElement("div");
    sheet.className = "egg-sheet";
    sheet.hidden = true;
    sheet.style.cssText =
      "position:fixed;inset:10% 20%;z-index:9999;background:#111;padding:16px";
    sheet.innerHTML =
      '<button class="egg-close" type="button">Close</button>' +
      '<p class="egg-status" aria-live="polite"></p>' +
      '<canvas class="egg-canvas" width="320" height="200"></canvas>';
    document.body.append(sheet);

    // site.js re-runs every module on this event, which is how initEgg()
    // gets a second chance now that the markup it queries exists.
    document.dispatchEvent(new Event("astro:page-load"));
  });
  await page.waitForTimeout(300);
}

// 3. opening the sheet pauses the field; closing resumes the same instance.
await injectEggDom();
await page.evaluate(() => (document.getElementById("field").dataset.probe = "1"));
await page.click(".egg-play");
await page.waitForTimeout(200);
const pausedRate = await rafRate();
await page.click(".egg-close");
await page.waitForTimeout(200);
const resumedRate = await rafRate();
// dataset survives only on the very same node; a rebuilt field would be a new
// canvas from the DOM, and initField() adopting the paused one is the point.
const sameCanvas = await page.evaluate(
  () => document.getElementById("field").dataset.probe === "1",
);
ok(
  "pauseField() stops the loop and resumeField() restarts the same instance",
  pausedRate < 5 && resumedRate > 20 && sameCanvas,
  `paused ${pausedRate}/s, resumed ${resumedRate}/s, same canvas: ${sameCanvas}`,
);

// 4. the [inert] shell swallows the page's single-key shortcuts.
await page.click(".egg-play");
await page.waitForTimeout(150);
await page.keyboard.press("b");
await page.waitForTimeout(500);
const heldOnAbout = new URL(page.url()).pathname === "/about/";
await page.click(".egg-close");
await page.waitForTimeout(200);
await page.keyboard.press("b");
await page.waitForTimeout(700);
const wentHome = new URL(page.url()).pathname === "/";
ok(
  "B is dead while .shell is inert and live again once the sheet closes",
  heldOnAbout && wentHome,
  `inert: stayed on About ${heldOnAbout}; not inert: reached home ${wentHome}`,
);

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
