/* ==========================================================================
   egg-gesture.js — the pull-from-the-pocket gesture and the sheet springs.

   One rAF loop and three springs, ported from overscroll-unlock-wireframe.jsx.
   No animation library: the same stepSpring() the smoke field runs.

   Three stages, and the middle one is the whole point:

     TENSION   at the bottom of the page, wheel and touch deltas the document
               can no longer spend accumulate into `pull`, which drains ~10%
               a frame. The button follows an exponential resistance curve, so
               it comes out fast and then fights back. Stop early and it goes
               back into hiding.
     RELEASE   past THRESHOLD, direct manipulation hands off to a spring with
               an initial velocity kick. It overshoots and settles. If it ever
               reads as a slide rather than a pop, the effect has failed.
     TAKEOVER  a slower spring lifts the sheet while .shell scales back and the
               scrim dims. Slower on purpose: heavier things move slower.

   The loop parks itself whenever nothing is moving, so an idle About page
   costs no frames beyond the smoke field.

   --- PEEK_MAX is read from the DOM, not hard-coded (decision, ticket 04) ----
   The wireframe's PEEK_MAX is 92, but the pocket that clips the button is
   exactly as tall as the shell padding it replaced: 88px, and 64px below the
   720px breakpoint. Travelling 92 would push the button 4px above the pocket,
   where `overflow: hidden` cuts its top edge off, and 28px above it on a
   phone. So PEEK_MAX is the pocket's clientHeight, re-read on resize. The
   alternative was changing the CSS, which this ticket does not own and which
   would still have needed a second value for the narrow breakpoint.

   The same number is written under prefers-reduced-motion, where theme.css
   places the button at -92px: one frame of inline transform corrects it at
   both breakpoints rather than fighting it.

   --- constants -------------------------------------------------------------
   Every value below is the wireframe's, except EVENT_CAP. A scroll-wheel
   mouse delivers 100+ per notch, so without a per-event cap one notch clears
   the 110 threshold and the tension stage never happens; a trackpad's finer
   deltas are untouched by it.
   ========================================================================== */

const THRESHOLD = 110; // pull units needed to break it loose
const PULL_CAP = 260; // ceiling on accumulated tension
const EVENT_CAP = 40; // ceiling on ONE event's contribution
const WHEEL_GAIN = 0.6;
const TOUCH_GAIN = 2.2;
const PULL_DECAY = 0.9; // per frame
const RESIST = 90; // the exponential's shoulder, in pull units
const TENSION_STIFF = 0.34;
const TENSION_DAMP = 0.62;
const RELEASE_KICK = 18; // the velocity that makes it pop
const RELEASE_STIFF = 0.22;
const RELEASE_DAMP = 0.72;
const SHEET_STIFF = 0.14;
const SHEET_DAMP = 0.8;
const SHELL_SCALE = 0.04; // the page behind settles to 0.96
const SCRIM_MAX = 0.55;

// A line-mode wheel event reports lines, not pixels. Roughly one text line.
const LINE_HEIGHT = 16;

function stepSpring(s, target, stiffness, damping) {
  s.v = (s.v + (target - s.x) * stiffness) * damping;
  s.x += s.v;
  return s;
}

const settled = (s, target, eps) =>
  Math.abs(s.v) < eps && Math.abs(target - s.x) < eps;

let els = null;
let pocket = null;
let scrim = null;
let peekMax = 88;
let reduce = false;

let pull = 0;
let btn = { x: 0, v: 0 };
let sheet = { x: 0, v: 0 };
let released = false;
let playing = false;
let touchY = null;
let raf = 0;
let onSettled = null;

let onWheel = null;
let onTouchStart = null;
let onTouchMove = null;
let onTouchEnd = null;
let onResize = null;

const atBottom = () =>
  window.scrollY + window.innerHeight >=
  document.documentElement.scrollHeight - 2;

function addPull(delta) {
  if (playing || delta <= 0) return;
  pull = Math.min(pull + Math.min(delta, EVENT_CAP), PULL_CAP);
  if (!released && pull > THRESHOLD) {
    released = true;
    btn.v = RELEASE_KICK;
  }
  start();
}

/* Writes every frame's four values. Kept in one place so the settled state can
   clear all four inline styles at once: a .shell left with an identity
   transform is still a composited layer, and the next page would inherit it
   through a view transition. */
function draw() {
  const out = Math.round(btn.x * 100) / 100;
  els.play.style.transform = `translate(-50%, ${-out}px)`;

  if (!playing && sheet.x <= 0) {
    els.sheet.style.transform = "";
    els.shell.style.transform = "";
    if (scrim) scrim.style.opacity = "";
    return;
  }
  const t = sheet.x / 100;
  els.sheet.style.transform = `translateY(${100 - sheet.x}%)`;
  els.shell.style.transform = `scale(${1 - t * SHELL_SCALE})`;
  if (scrim) scrim.style.opacity = String(t * SCRIM_MAX);
}

function tick() {
  raf = 0;

  pull *= PULL_DECAY;
  if (pull < 0.4) pull = 0;
  // it never broke loose and the tension is gone: let it fall back quietly
  if (!released && pull === 0) btn.v *= 0.9;

  const resisted = peekMax * (1 - Math.exp(-pull / RESIST));
  const btnTarget = released ? peekMax : resisted;
  stepSpring(
    btn,
    btnTarget,
    released ? RELEASE_STIFF : TENSION_STIFF,
    released ? RELEASE_DAMP : TENSION_DAMP,
  );

  const sheetTarget = playing ? 100 : 0;
  stepSpring(sheet, sheetTarget, SHEET_STIFF, SHEET_DAMP);

  if (reduce) {
    btn.x = btnTarget;
    btn.v = 0;
    sheet.x = sheetTarget;
    sheet.v = 0;
  }

  let btnDone = settled(btn, btnTarget, 0.05);
  const sheetDone = settled(sheet, sheetTarget, 0.05);
  if (btnDone) {
    btn.x = btnTarget;
    btn.v = 0;
  }
  if (sheetDone) {
    sheet.x = sheetTarget;
    sheet.v = 0;
  }

  draw();

  /* The sheet has finished going away. Re-arm the egg and hand egg.js back the
     one state change it had to defer — re-adding `hidden`, which would have
     made the sheet vanish instead of descend. */
  if (sheetDone && !playing && onSettled) {
    const done = onSettled;
    onSettled = null;
    released = false;
    pull = 0;
    btnDone = false; // the button now has somewhere new to be
    done();
  }

  if (pull > 0 || !btnDone || !sheetDone || playing) start();
}

function start() {
  if (els && !raf) raf = requestAnimationFrame(tick);
}

function measure() {
  if (pocket && pocket.clientHeight > 0) peekMax = pocket.clientHeight;
}

export function initGesture(elements, _api) {
  stopGesture();
  if (!elements || !elements.play || !elements.sheet || !elements.shell) return;

  els = elements;
  pocket = els.play.closest(".egg-pocket") || els.play.parentElement;
  scrim = document.querySelector(".egg-scrim");
  measure();

  reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  pull = 0;
  btn = { x: 0, v: 0 };
  sheet = { x: 0, v: 0 };
  released = false;
  playing = false;
  touchY = null;
  onSettled = null;

  /* A discovery mechanic built on a gesture is inaccessible by nature, so
     reduced motion hands the button over: it starts out and already released,
     and the loop never has to run to keep it there. */
  if (reduce) {
    released = true;
    btn.x = peekMax;
  }
  draw();

  onWheel = (event) => {
    if (playing) {
      event.preventDefault();
      return;
    }
    if (event.deltaY <= 0 || !atBottom()) return;
    const px = event.deltaMode === 1 ? event.deltaY * LINE_HEIGHT : event.deltaY;
    addPull(px * WHEEL_GAIN);
    event.preventDefault(); // claim the overscroll
  };

  onTouchStart = (event) => {
    touchY = event.touches[0] ? event.touches[0].clientY : null;
  };

  onTouchMove = (event) => {
    if (playing) {
      event.preventDefault();
      return;
    }
    if (touchY == null || !event.touches[0]) return;
    const dy = touchY - event.touches[0].clientY;
    touchY = event.touches[0].clientY;
    if (dy <= 0 || !atBottom()) return;
    addPull(dy * TOUCH_GAIN);
    event.preventDefault();
  };

  onTouchEnd = () => {
    touchY = null;
  };

  /* The pocket's height changes at the 720px breakpoint, and so does how far
     the button has to travel. Re-target rather than leave it stranded. */
  onResize = () => {
    const before = peekMax;
    measure();
    if (peekMax !== before) {
      if (reduce) btn.x = peekMax;
      start();
    }
  };

  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd);
  window.addEventListener("resize", onResize);
}

/* egg.js calls this from openSheet() and closeSheet(). The sheet's `hidden`
   flag has to come off before the spring can lift it and can only go back on
   once it has descended, so closing passes a callback for that last step. */
export function setSheetOpen(next, onDone) {
  playing = !!next;
  onSettled = next ? null : onDone || null;
  if (playing) pull = 0;
  start();
}

export function stopGesture() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;

  /* A teardown mid-animation still owes egg.js its deferred close, or Back
     from an open sheet leaves the next page a visible sheet. */
  if (onSettled) {
    const done = onSettled;
    onSettled = null;
    done();
  }

  if (els) {
    els.play.style.transform = "";
    els.sheet.style.transform = "";
    els.shell.style.transform = "";
    if (scrim) scrim.style.opacity = "";
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("resize", onResize);
  }

  els = null;
  pocket = null;
  scrim = null;
  pull = 0;
  btn = { x: 0, v: 0 };
  sheet = { x: 0, v: 0 };
  released = false;
  playing = false;
  touchY = null;
  onWheel = null;
  onTouchStart = null;
  onTouchMove = null;
  onTouchEnd = null;
  onResize = null;
}
