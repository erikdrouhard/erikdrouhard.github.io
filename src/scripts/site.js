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
import { initKeys, cancelPendingKey } from "./keys.js";
import { initCards } from "./cards.js";
import { initTheme, restoreTheme } from "./theme.js";
import { initStagger, stopStagger } from "./stagger.js";
import { initPointerHover } from "./pointer-hover.js";
import { initPressState, stopPressState } from "./press-state.js";
import { initCaseStudyNav } from "./case-study-nav.js";

/* The egg is a lazy chunk gated on the pathname, so no other route downloads
   it. The resolved module is kept here rather than re-imported at teardown:
   before-swap and pagehide are synchronous moments, and awaiting an import
   there would run the teardown after the page it was cleaning up is gone. */
let egg = null;

function stopEgg() {
  if (egg) egg.stopEgg();
}

document.addEventListener("astro:page-load", () => {
  /* First, and every navigation: the pointer class lives on <html>, which the
     router re-stamps from the server-rendered document on every swap. */
  initPointerHover();
  initPressState();
  /* No-ops on a page without a <case-study-nav>, so no page-type check. */
  initCaseStudyNav();
  initTheme();
  initKeys();
  initCards();
  initField();
  initStagger();

  if (location.pathname === "/about/") {
    import("./egg.js").then((m) => {
      egg = m;
      m.initEgg();
    });
  }
});

/* after-swap runs before the new page paints, so the theme is put back on
   <html> without a flash of the wrong palette. astro:page-load would be too
   late — it fires after paint. */
document.addEventListener("astro:after-swap", restoreTheme);

document.addEventListener("astro:before-swap", () => {
  stopStagger();
  stopPressState();
  cancelPendingKey();
  // Leaving About with the sheet open must put inert, the shell transform and
  // the field back, or the next page arrives scaled and frozen.
  stopEgg();
  // The canvas carries transition:persist, so initField() will usually adopt
  // the surviving loop rather than build a new one. Stopping here anyway would
  // restart the drift on every navigation, so the field is left running and
  // initField() decides — it stops the old loop itself whenever the canvas or
  // the field mode actually changed.
});

/* bfcache. Going back to a page restored from the back/forward cache does not
   re-fire astro:page-load, so the field has to be released on the way out and
   rebuilt on the way in — otherwise a restored page shows a frozen canvas. */
window.addEventListener("pagehide", () => {
  stopEgg();
  stopField();
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) initField();
});
