/* ==========================================================================
   site.js — the lifecycle wrapper.

   With <ClientRouter /> a module's top level runs exactly once, but the DOM is
   replaced on every navigation. So nothing here initializes at import time:
   every module is (re)started on astro:page-load — which fires on the first
   load AND on each client navigation — and torn down on astro:before-swap.

   The field is the one that must be torn down rather than merely re-run. It
   owns a requestAnimationFrame loop and window listeners; skipping the
   teardown leaks one loop per navigation until the page stutters.
   ========================================================================== */
import { initField, stopField } from "./field.js";
import { initKeys } from "./keys.js";
import { initCards } from "./cards.js";
import { initTheme } from "./theme.js";
import { initStagger, stopStagger } from "./stagger.js";

document.addEventListener("astro:page-load", () => {
  initTheme();
  initKeys();
  initCards();
  initField();
  initStagger();
});

document.addEventListener("astro:before-swap", () => {
  stopStagger();
  // The canvas carries transition:persist, so initField() will usually adopt
  // the surviving loop rather than build a new one. Stopping here anyway would
  // restart the drift on every navigation, so the field is left running and
  // initField() decides — it stops the old loop itself whenever the canvas or
  // the field mode actually changed.
});

/* A hard navigation away (or a bfcache eviction) still has to release the
   loop, otherwise a restored page can end up with two. */
window.addEventListener("pagehide", stopField);
