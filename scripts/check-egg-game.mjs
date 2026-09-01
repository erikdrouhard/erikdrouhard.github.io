#!/usr/bin/env node
/**
 * The eight runtime checks for the block breaker's canvas mount (issue 05).
 *
 * Everything here is a claim about pixels and listeners that only exists once
 * the sheet is open in a real browser: that the backing store matches the CSS
 * box times DPR, that the ball does not move until it is asked to, that the
 * keyboard alone can steer, lose and restart, that a theme toggle re-pigments
 * the next frame, that a hidden tab freezes the ball, and that closing the
 * sheet leaves no window listener behind.
 *
 * Serves a build, so build first. Same harness shape as check-acceptance.mjs:
 *
 *   npx astro build --outDir .dist-game
 *   EGG_PORT=4328 EGG_OUTDIR=.dist-game node scripts/check-egg-game.mjs
 *
 * EGG_PORT/EGG_OUTDIR exist so a run can dodge a dev server already sitting on
 * 4321 — otherwise `astro preview` fails to bind, the fetch below succeeds
 * against that other server, and the suite silently checks the wrong build.
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
/* reducedMotion: "reduce" is what makes Play visible without performing the
   overscroll gesture — the CSS parks the button in view in that mode. */
const ctx = await browser.newContext({
  viewport: { width: 1200, height: 900 },
  reducedMotion: "reduce",
});

/* Tally window listeners by type. Installed before any page script runs, so
   every add/remove the site makes passes through it. Check 8 reads the keydown
   balance across an open/close cycle. */
await ctx.addInitScript(() => {
  window.__win = {};
  const add = window.addEventListener.bind(window);
  const remove = window.removeEventListener.bind(window);
  window.addEventListener = (type, ...rest) => {
    window.__win[type] = (window.__win[type] || 0) + 1;
    return add(type, ...rest);
  };
  window.removeEventListener = (type, ...rest) => {
    window.__win[type] = (window.__win[type] || 0) - 1;
    return remove(type, ...rest);
  };

  /* Pixel probes. The game's coordinates are CSS pixels under a DPR
     transform, so every helper takes CSS px and scales on the way in. The
     brick geometry is recomputed here from the wireframe's constants rather
     than read out of the module, so a geometry change fails the check instead
     of following it. */
  window.__probe = {
    canvas: () => document.querySelector(".egg-canvas"),
    dpr: () => Math.min(window.devicePixelRatio || 1, 2),
    box() {
      const c = this.canvas();
      return { w: c.clientWidth, h: c.clientHeight };
    },
    data(x, y, w, h) {
      const d = this.dpr();
      return this.canvas()
        .getContext("2d")
        .getImageData(
          Math.round(x * d),
          Math.round(y * d),
          Math.max(1, Math.round(w * d)),
          Math.max(1, Math.round(h * d)),
        );
    },
    /* Sum of the whole backing store. Two identical sums a frame apart mean
       nothing moved; a moving ball changes it every frame. */
    checksum() {
      const c = this.canvas();
      const px = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) {
        sum += px[i] + px[i + 1] * 3 + px[i + 2] * 7 + px[i + 3] * 11;
      }
      return sum;
    },
    firstBrickCenter() {
      const w = this.box().w;
      const cols = Math.floor((w - 40) / 28);
      const offX = (w - (cols * 28 - 8)) / 2;
      return { x: offX + 10, y: 70 + 2.5 };
    },
    /* "rgba(r,g,b,a)" at one CSS point. Transparent means the page shows
       through, which is what a miss on a brick looks like. */
    pixel(x, y) {
      const p = this.data(x, y, 1, 1).data;
      return `rgba(${p[0]},${p[1]},${p[2]},${p[3]})`;
    },
    brickPixel() {
      const c = this.firstBrickCenter();
      return this.pixel(c.x, c.y);
    },
    /* Mean x of the drawn paddle, in CSS px. Sampled three px below the
       paddle's top edge, a row where nothing else is ever drawn. */
    paddleX() {
      const box = this.box();
      const row = this.data(0, box.h - 40 + 3, box.w, 1);
      const px = row.data;
      let sum = 0;
      let n = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] > 0) {
          sum += i / 4;
          n++;
        }
      }
      return n ? sum / n / this.dpr() : null;
    },
  };
});

const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

const READY = "Score 0 · Lives 3 · Move or press Space to launch";
const status = () => page.textContent(".egg-status");
const probe = (fn, ...args) =>
  page.evaluate(
    ([name, rest]) => window.__probe[name](...rest),
    [fn, args],
  );

await page.goto(BASE + "/about/", { waitUntil: "networkidle" });
await page.waitForTimeout(300);

const keydownBefore = await page.evaluate(() => window.__win.keydown || 0);

/* --- 1. mount: backing store, status line, a painted brick ------------- */
await page.click(".egg-play");
await page.waitForTimeout(300);

const size = await page.evaluate(() => {
  const c = window.__probe.canvas();
  const box = window.__probe.box();
  const d = window.__probe.dpr();
  return {
    width: c.width,
    height: c.height,
    expectedW: Math.round(box.w * d),
    expectedH: Math.round(box.h * d),
    cssW: box.w,
    dpr: d,
  };
});
const readyText = await status();
const brickAtMount = await probe("brickPixel");
ok(
  "canvas is sized to its CSS box x DPR, status is ready, a brick is painted",
  size.width === size.expectedW &&
    size.height === size.expectedH &&
    size.width > 0 &&
    readyText === READY &&
    !brickAtMount.endsWith(",0)"),
  `${size.width}x${size.height} (want ${size.expectedW}x${size.expectedH}, css ${Math.round(size.cssW)} @${size.dpr}x), status "${readyText}", brick ${brickAtMount}`,
);

/* --- 2. no launch on load ---------------------------------------------- */
const still1 = await probe("checksum");
await page.waitForTimeout(500);
const still2 = await probe("checksum");
ok(
  "the ball does not launch on its own",
  still1 === still2 && (await status()) === READY,
  `checksum ${still1} -> ${still2}`,
);

/* --- 3. keyboard steering ---------------------------------------------- */
async function hold(key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(80);
}
const p0 = await probe("paddleX");
await hold("ArrowRight", 300);
const p1 = await probe("paddleX");
await hold("d", 300);
const p2 = await probe("paddleX");
await hold("a", 300);
const p3 = await probe("paddleX");
ok(
  "ArrowRight and D move the paddle right, A moves it left",
  p1 > p0 + 20 && p2 > p1 + 20 && p3 < p2 - 20,
  `x: ${p0?.toFixed(1)} -> ${p1?.toFixed(1)} -> ${p2?.toFixed(1)} -> ${p3?.toFixed(1)}`,
);

/* --- 4. Space launches -------------------------------------------------- */
await page.keyboard.press("Space");
await page.waitForTimeout(200);
const playing = await status();
ok(
  "Space launches the ball and the status drops the hint",
  /^Score \d+ · Lives \d+$/.test(playing),
  `status "${playing}"`,
);

/* --- 6. theme re-pigment (mid-game, so it runs before the loss) --------- */
const brickBefore = await probe("brickPixel");
/* .shell is inert while the sheet is open and the sheet covers the footer, so
   a real click cannot reach the toggle. Dispatching the same bubbling click
   exercises theme.js's delegated handler, which is what re-pigments. */
await page.evaluate(() => {
  document
    .querySelector(".theme-toggle")
    .dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await page.waitForTimeout(120);
const brickAfter = await probe("brickPixel");
ok(
  "toggling the theme re-pigments the bricks",
  brickBefore !== brickAfter && !brickAfter.endsWith(",0)"),
  `${brickBefore} -> ${brickAfter}`,
);
await page.evaluate(() => {
  document
    .querySelector(".theme-toggle")
    .dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
await page.waitForTimeout(120);

/* --- 7. visibility pause ------------------------------------------------ */
await page.evaluate(() => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => window.__hidden === true,
  });
  window.__hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
});
await page.waitForTimeout(120);
const pausedText = await status();
const frozen1 = await probe("checksum");
await page.waitForTimeout(300);
const frozen2 = await probe("checksum");
await page.evaluate(() => {
  window.__hidden = false;
  document.dispatchEvent(new Event("visibilitychange"));
});
await page.waitForTimeout(300);
const movedAfterResume = (await probe("checksum")) !== frozen2;
ok(
  "a hidden tab pauses the game and showing it again resumes",
  pausedText === "Paused" && frozen1 === frozen2 && movedAfterResume,
  `status "${pausedText}", frozen ${frozen1 === frozen2}, resumed ${movedAfterResume}`,
);

/* --- 5. loss and restart, keyboard only --------------------------------- */
await page.keyboard.down("ArrowLeft");
/* Budgeted at 45 s rather than the 30 s the issue guessed. Losing three lives
   against a paddle pinned to the wall is ball flight time, and on an 830 px
   board it measures ~25 s — close enough to 30 that a slow machine would make
   this the flakiest check in the file for no added coverage. The detail line
   prints the real figure, so a regression in flight time is still visible. */
let lostText = "";
const lossStart = Date.now();
for (let i = 0; i < 225; i++) {
  const s = await status();
  if (s.startsWith("Missed")) {
    lostText = s;
    break;
  }
  /* The paddle is pinned to the wall, so a fresh life needs an explicit
     launch: moving left again is not movement. */
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
}
await page.keyboard.up("ArrowLeft");
await page.waitForTimeout(100);
await page.keyboard.press("Space");
await page.waitForTimeout(200);
const afterRestart = await status();
ok(
  "the keyboard alone can lose every life and restart to a fresh board",
  /^Missed · Score \d+ · Space to play again$/.test(lostText) &&
    afterRestart === READY,
  `lost "${lostText}" after ${((Date.now() - lossStart) / 1000).toFixed(1)}s, restart "${afterRestart}"`,
);

/* --- 8. destroy leaves no window listener ------------------------------- */
await page.click(".egg-close");
await page.waitForTimeout(300);
const keydownAfter = await page.evaluate(() => window.__win.keydown || 0);
const statusCleared = (await status()) === "";
ok(
  "closing the sheet removes every window keydown listener the game added",
  keydownAfter === keydownBefore && statusCleared,
  `keydown tally ${keydownBefore} -> ${keydownAfter}, status cleared ${statusCleared}`,
);

ok(
  "no console errors or page exceptions",
  errors.length === 0,
  errors.slice(0, 3).join(" | "),
);

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
