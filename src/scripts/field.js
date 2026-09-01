/* ==========================================================================
   field.js — smoke, rendered as blocks.

   The metric-bar geometry is the pixel. Each block's brightness samples a
   domain-warped fBm field, so the grid reads as drifting smoke rather than a
   static pattern. A three-node spring chain trails the pointer, displacing and
   swirling the sample coordinates, so moving through pushes the smoke aside
   and leaves a wake that settles back. Blocks near the pointer also take a
   direct energy hit that decays on a per-block stagger.

   LIFECYCLE — the part the single-page prototype did not need.
   Under <ClientRouter /> this module is evaluated once but the DOM is swapped
   on every navigation. start() must therefore be idempotent and stop() must
   cancel the RAF loop and drop every window listener. Without that teardown
   each navigation leaves another render loop running against a detached
   canvas, and the page degrades until it stutters.
   ========================================================================== */

const BW = 20;
const BH = 5;
const GX = 8;
const GY = 11; // same geometry as the metric bar
const CELLW = BW + GX;
const CELLH = BH + GY;
const NOISE_F = 0.02; // noise frequency, in block units

/* ---------------------------------------------------------- value noise */
function hash(x, y) {
  let n = (x | 0) * 374761393 + (y | 0) * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function vnoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, y) {
  let v = 0;
  let amp = 0.5;
  let fx = x;
  let fy = y;
  for (let i = 0; i < 4; i++) {
    v += amp * vnoise(fx, fy);
    fx *= 2.03;
    fy *= 2.03;
    amp *= 0.5;
  }
  return v;
}

function lerp(a, b, k) {
  return a + (b - a) * k;
}

/* --------------------------------------------------------- the instance */
let running = null;

function create(canvas, mode) {
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let cols = 0;
  let rows = 0;
  let energy = null;
  let stagger = null;
  let px = -9999;
  let py = -9999;
  let lastX = -9999;
  let lastY = -9999;
  let speed = 0;
  let t = 0;
  let raf = 0;
  let paused = false;

  const chain = [
    { x: -9999, y: -9999, vx: 0, vy: 0, k: 0.3, damp: 0.7, w: 1.0 },
    { x: -9999, y: -9999, vx: 0, vy: 0, k: 0.18, damp: 0.74, w: 0.66 },
    { x: -9999, y: -9999, vx: 0, vy: 0, k: 0.11, damp: 0.78, w: 0.38 },
  ];

  // "quiet" reading pages keep the pointer distortion but drop the ambient
  // gain to 40%, so the field is present without competing with body text.
  const DIM = mode === "quiet" ? 0.4 : 1;
  const SMOKE_MAX = 0.3 * DIM; // ceiling for the ambient smoke
  const IDLE = 0.02 * DIM; // floor, so the grid never disappears entirely

  // pigment comes from CSS, so the field follows the active theme
  const FIELD = { rgb: "126,231,162", gain: 1 };
  function readTokens() {
    const cs = getComputedStyle(document.documentElement);
    FIELD.rgb = (cs.getPropertyValue("--field-rgb") || "126,231,162").trim();
    FIELD.gain = parseFloat(cs.getPropertyValue("--field-gain")) || 1;
  }

  function build() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / CELLW) + 1;
    rows = Math.ceil(h / CELLH) + 1;
    const n = cols * rows;
    energy = new Float32Array(n);
    stagger = new Float32Array(n);
    for (let i = 0; i < n; i++) stagger[i] = 0.8 + Math.random() * 0.15;
  }

  function onPointerMove(e) {
    if (lastX > -9000) {
      speed = speed * 0.8 + Math.hypot(e.clientX - lastX, e.clientY - lastY) * 0.2;
    }
    lastX = e.clientX;
    lastY = e.clientY;
    px = e.clientX;
    py = e.clientY;
    if (chain[0].x < -9000) {
      for (let i = 0; i < chain.length; i++) {
        chain[i].x = e.clientX;
        chain[i].y = e.clientY;
      }
    }
  }

  function onPointerLeave() {
    px = -9999;
    py = -9999;
    lastX = -9999;
  }

  function onResize() {
    build();
    if (reduce) render();
  }

  function render() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    speed *= 0.92;
    const sp = Math.min(speed, 48) / 48; // 0 still, 1 fast

    if (px > -9000) {
      for (let i = 0; i < chain.length; i++) {
        const n = chain[i];
        const tx = i === 0 ? px : chain[i - 1].x;
        const ty = i === 0 ? py : chain[i - 1].y;
        n.vx = (n.vx + (tx - n.x) * n.k) * n.damp;
        n.vy = (n.vy + (ty - n.y) * n.k) * n.damp;
        n.x += n.vx;
        n.y += n.vy;
      }
    }

    // spring nodes expressed in block-grid units
    const nodes = [];
    for (let q = 0; q < chain.length; q++) {
      if (chain[q].x < -9000) continue;
      nodes.push({
        cx: chain[q].x / CELLW,
        cy: chain[q].y / CELLH,
        vx: chain[q].vx / CELLW,
        vy: chain[q].vy / CELLH,
        w: chain[q].w,
      });
    }

    const RAD = 7.0 + sp * 5.0; // wake radius, in blocks
    const rad2 = RAD * RAD;
    const PUSH = 2.6 + sp * 4.2;
    const SWIRL = 1.6 + sp * 3.0;

    // direct pointer energy, decaying per block
    for (let e0 = 0; e0 < energy.length; e0++) energy[e0] *= stagger[e0];

    if (px > -9000) {
      const eRad = lerp(78, 176, sp);
      const falloff = lerp(3.1, 1.35, sp);
      const peakInj = lerp(1.0, 0.62, sp);
      for (let q2 = 0; q2 < chain.length; q2++) {
        const nd = chain[q2];
        if (nd.x < -9000) continue;
        const c0 = Math.max(0, Math.floor((nd.x - eRad) / CELLW));
        const c1 = Math.min(cols - 1, Math.ceil((nd.x + eRad) / CELLW));
        const r0 = Math.max(0, Math.floor((nd.y - eRad) / CELLH));
        const r1 = Math.min(rows - 1, Math.ceil((nd.y + eRad) / CELLH));
        for (let r = r0; r <= r1; r++) {
          for (let c = c0; c <= c1; c++) {
            const ddx = c * CELLW + BW / 2 - nd.x;
            const ddy = r * CELLH + BH / 2 - nd.y;
            const dd = Math.hypot(ddx, ddy);
            if (dd > eRad) continue;
            const inj = Math.pow(1 - dd / eRad, falloff) * nd.w * peakInj;
            const ei = r * cols + c;
            if (inj > energy[ei]) energy[ei] = inj;
          }
        }
      }
    }

    const peakAlpha = lerp(0.62, 0.32, sp) * DIM;
    const drift = t * 0.006;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let sx = x;
        let sy = y;

        // pointer pushes and swirls the sample coordinates
        for (let k = 0; k < nodes.length; k++) {
          const nn = nodes[k];
          const dx = x - nn.cx;
          const dy = y - nn.cy;
          const d2 = dx * dx + dy * dy;
          if (d2 > rad2) continue;
          const infl = Math.exp(-d2 / (rad2 * 0.42)) * nn.w;
          const d = Math.sqrt(d2) + 0.001;
          sx += (dx / d) * infl * PUSH - (dy / d) * infl * SWIRL * 0.35 - nn.vx * infl * 0.5;
          sy += (dy / d) * infl * PUSH + (dx / d) * infl * SWIRL * 0.35 - nn.vy * infl * 0.5;
        }

        const fx = sx * NOISE_F;
        const fy = sy * NOISE_F * 1.9; // blocks are wide, so squash vertically

        // domain warp, which is what makes it fold and wisp
        const wx = fbm(fx + 1.7, fy + 9.2 + drift * 2.0);
        const wy = fbm(fx + 5.3 - drift * 1.5, fy + 2.8);
        const v = fbm(fx + wx * 2.4, fy + wy * 2.4 + drift);

        let smoke = (v - 0.42) / 0.34;
        if (smoke < 0) smoke = 0;
        else if (smoke > 1) smoke = 1;
        smoke = smoke * smoke * (1 - (y / rows) * 0.45);

        let a = IDLE + smoke * SMOKE_MAX + energy[y * cols + x] * peakAlpha;
        if (a < 0.014) continue;
        if (a > 0.92) a = 0.92;

        ctx.fillStyle = "rgba(" + FIELD.rgb + "," + (a * FIELD.gain).toFixed(3) + ")";
        ctx.fillRect(x * CELLW, y * CELLH, BW, BH);
      }
    }
  }

  function loop() {
    t += 1;
    render();
    raf = requestAnimationFrame(loop);
  }

  readTokens();
  document.addEventListener("themechange", readTokens);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("resize", onResize);

  build();
  // reduced motion and data-field="off" both get one static frame, no loop
  if (reduce || mode === "off") render();
  else raf = requestAnimationFrame(loop);

  return {
    canvas,
    mode,
    get paused() {
      return paused;
    },
    /* The egg sheet covers the field, so the loop is suspended rather than
       torn down: t, the spring chain and the per-block stagger all survive, and
       the drift picks up where it left off instead of restarting. */
    pause() {
      if (paused) return;
      paused = true;
      cancelAnimationFrame(raf);
      raf = 0;
    },
    resume() {
      if (!paused) return;
      paused = false;
      // reduced motion and mode "off" never had a loop to resume; they get a
      // fresh static frame in case the theme changed while the sheet was up.
      if (reduce || mode === "off") render();
      else raf = requestAnimationFrame(loop);
    },
    stop() {
      paused = false;
      cancelAnimationFrame(raf);
      raf = 0;
      document.removeEventListener("themechange", readTokens);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", onResize);
    },
  };
}

export function pauseField() {
  if (running) running.pause();
}

export function resumeField() {
  if (running) running.resume();
}

export function stopField() {
  if (!running) return;
  running.stop();
  running = null;
}

export function initField() {
  const canvas = document.getElementById("field");
  if (!canvas) {
    stopField();
    return;
  }
  // data-field is read fresh every page-load: home and the work index run
  // "full", case studies run "quiet".
  const mode = document.body.dataset.field || "full";

  // Same canvas element and same mode means the swap did not touch us; leaving
  // the existing loop alone keeps the drift continuous across a navigation.
  // A paused instance counts as alive: re-initializing one would rebuild the
  // field under an open sheet and leave resumeField() with nothing to resume.
  if (running && running.canvas === canvas && running.mode === mode) return;

  stopField();
  running = create(canvas, mode);
}
