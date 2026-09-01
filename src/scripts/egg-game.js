/* ==========================================================================
   egg-game.js — the canvas side of the block breaker.

   Filled by ticket 05, over the pure simulation in breakout.js. It exists now
   so egg.js can own the sheet lifecycle and nothing else: mountGame() takes
   the canvas and the aria-live status line and hands back the three calls the
   sheet needs. Every one of them is a no-op until ticket 05 lands.
   ========================================================================== */

// eslint-disable-next-line no-unused-vars
export function mountGame(_canvas, _statusEl) {
  return {
    pause() {},
    resume() {},
    destroy() {},
  };
}
