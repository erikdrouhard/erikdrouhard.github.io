/* ==========================================================================
   egg-game.js — the canvas side of the block breaker.

   Everything impure that breakout.js refuses to do: the backing store and its
   DPR transform, the listeners, the palette read out of CSS, the rAF loop,
   and the aria-live sentence. The simulation stays a pure function of state
   and input; this file is the only place that knows a browser exists.

   mountGame(canvas, statusEl) -> { pause(), resume(), destroy() }

   One instance at a time, one rAF, and destroy() must leave the page exactly
   as it found it — egg.js mounts on every open and destroys on every close,
   so a listener left behind here becomes a leak per open.
   ========================================================================== */
import { createGame, step, render } from "./breakout.js";

/* A stall longer than this is a tab that was throttled or a slow paint, not
   time the ball should travel through. */
const MAX_DT = 0.05;

export function mountGame(canvas, statusEl) {
  const ctx = canvas.getContext("2d");

  let state = null;
  let raf = 0;
  let last = 0;
  let paused = false;
  let alive = true;

  /* Held keys are level-triggered; launch and restart are edge-triggered and
     consumed by the next frame. Level-triggering them instead would make a
     held Space restart and relaunch in the same breath, so the ready state
     would never be readable. */
  const keys = { left: false, right: false };
  let pointerX = null;
  let launch = false;
  let restart = false;

  /* render() is handed every colour it uses, and every one of them is read
     back off the canvas element rather than out of a custom property: the
     design system lets a script read four tokens and none of them is a colour.
     theme.css parks the three the game needs on ordinary colour properties
     that have no other effect on a <canvas> — `color` is a live brick,
     `caret-color` a spent one, and `accent-color` the paddle and the ball. */
  const palette = { brick: "", track: "", paddle: "" };
  function readPalette() {
    const cs = getComputedStyle(canvas);
    palette.brick = cs.color;
    palette.track = cs.caretColor;
    palette.paddle = cs.accentColor;
    if (state) draw();
  }

  /* ------------------------------------------------------------ sizing */

  /* clientWidth, not getBoundingClientRect: the sheet around this canvas may
     be mid-transform when we measure, and a rect under a scale would size the
     backing store to the animation rather than to the layout. */
  let builtW = 0;
  let builtH = 0;

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    builtW = w;
    builtH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the column count is a function of width, so a resize is a new board
    state = createGame(w, h);
    draw();
  }

  /* The sheet is display:none until Play is clicked, so the CSS box can still
     be 0 on the frame we mount. A ResizeObserver is what catches the real box
     whenever it arrives — first layout, sheet animation, or an orientation
     change — without polling. */
  const observer =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          const w = canvas.clientWidth;
          const h = canvas.clientHeight;
          if (w < 1 || h < 1) return;
          if (w === builtW && h === builtH) return;
          size();
          setStatus();
        })
      : null;

  /* ------------------------------------------------------------- status */

  function setStatus() {
    if (!alive || !state) return;
    const s = state.score;
    if (paused) {
      statusEl.textContent = "Paused";
      return;
    }
    if (state.phase === "won") {
      statusEl.textContent = `Cleared · Score ${s} · Space to play again`;
    } else if (state.phase === "lost") {
      statusEl.textContent = `Missed · Score ${s} · Space to play again`;
    } else if (state.phase === "ready") {
      statusEl.textContent = `Score ${s} · Lives ${state.lives} · Move or press Space to launch`;
    } else {
      statusEl.textContent = `Score ${s} · Lives ${state.lives}`;
    }
  }

  /* -------------------------------------------------------------- loop */

  function draw() {
    render(ctx, state, palette);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!state) return;
    const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 0;
    last = now;
    /* step() runs whole 1/60 s sub-steps, so a short frame can run none. The
       edge-triggered flags survive such a frame; dropping them there would
       silently swallow a Space press. */
    const consumed = state.acc + dt >= 1 / 60 - 1e-9;
    step(state, buildInput(), dt);
    if (consumed) {
      launch = false;
      restart = false;
    }
    draw();
    setStatus();
  }

  function buildInput() {
    return {
      paddleX: pointerX,
      left: keys.left,
      right: keys.right,
      launch,
      restart,
    };
  }

  function start() {
    if (raf || paused || !alive) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ------------------------------------------------------------- input */

  const ended = () => state && (state.phase === "lost" || state.phase === "won");

  function fire() {
    if (ended()) restart = true;
    else launch = true;
  }

  function onPointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointerX = event.clientX - rect.left;
    if (event.type === "pointerdown") fire();
  }

  function onKeyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    if (key === "ArrowLeft" || key === "a" || key === "A") {
      // a lingering pointer position would outrank the keys forever
      pointerX = null;
      keys.left = true;
      event.preventDefault();
    } else if (key === "ArrowRight" || key === "d" || key === "D") {
      pointerX = null;
      keys.right = true;
      event.preventDefault();
    } else if (key === " " || key === "Spacebar") {
      /* Two jobs at once: stop the page scrolling, and stop Space from
         activating whichever button egg.js focused when the sheet opened.
         A button's Space activation fires on keyup only if the keydown's
         default was not prevented. */
      event.preventDefault();
      fire();
    } else if (key === "Enter") {
      // Enter must still activate Close, so leave it alone on real controls
      const t = event.target;
      if (t && t.closest && t.closest("button, a, input, textarea, select")) return;
      fire();
    }
  }

  function onKeyUp(event) {
    const key = event.key;
    if (key === "ArrowLeft" || key === "a" || key === "A") keys.left = false;
    else if (key === "ArrowRight" || key === "d" || key === "D")
      keys.right = false;
  }

  /* A resize that did not change the box — an on-screen keyboard, a mobile
     URL bar — must not throw the board away mid-rally. */
  function onResize() {
    if (canvas.clientWidth === builtW && canvas.clientHeight === builtH) return;
    size();
    setStatus();
  }

  function onVisibility() {
    if (document.hidden) pause();
    else resume();
  }

  /* -------------------------------------------------------------- wire */

  size();
  readPalette();
  setStatus();
  if (observer) observer.observe(canvas);

  canvas.addEventListener("pointermove", onPointer);
  canvas.addEventListener("pointerdown", onPointer);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("themechange", readPalette);

  start();

  function pause() {
    if (!alive || paused) return;
    paused = true;
    stop();
    setStatus();
  }

  function resume() {
    if (!alive || !paused) return;
    paused = false;
    setStatus();
    start();
  }

  function destroy() {
    if (!alive) return;
    alive = false;
    stop();
    if (observer) observer.disconnect();
    canvas.removeEventListener("pointermove", onPointer);
    canvas.removeEventListener("pointerdown", onPointer);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("themechange", readPalette);
    statusEl.textContent = "";
    state = null;
  }

  return { pause, resume, destroy };
}
