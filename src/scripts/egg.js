/* ==========================================================================
   egg.js — the About-page Easter egg, lifecycle only.

   A thin composer. The gesture and springs live in egg-gesture.js, the game
   in egg-game.js, and the smoke field is paused rather than stopped so the
   drift is continuous across an open sheet. What stays here is the pair of
   state changes — openSheet() and closeSheet() — that every other piece has
   to agree on: the sheet's hidden flag, .shell's inert flag, the field, the
   game instance, and focus.

   Ticket 04 replaces the instant show/hide inside those two functions with
   springs. Keeping every state change in exactly these two places is what
   lets it do that without touching anything else.

   This module is a lazy chunk, imported by site.js only when the pathname is
   /about/, so no other route pays for it.
   ========================================================================== */
import { pauseField, resumeField } from "./field.js";
import { initGesture, stopGesture, setSheetOpen } from "./egg-gesture.js";
import { mountGame } from "./egg-game.js";

let els = null;
let game = null;
let open = false;
let onPlay = null;
let onClose = null;
let onKeydown = null;

function openSheet() {
  if (!els || open) return;
  open = true;
  // `hidden` carries display:none, so nothing inside the sheet is focusable
  // and nothing is animatable until it comes off. It goes first; the spring
  // in egg-gesture.js carries the sheet up from there.
  els.sheet.hidden = false;
  // inert does two jobs at once: it keeps Tab inside the sheet with no
  // focus-trap code, and it is what the keys.js guard reads to stop B and C
  // from firing the page's shortcuts through the sheet.
  els.shell.inert = true;
  pauseField();
  game = mountGame(els.canvas, els.status);
  els.close.focus();
  setSheetOpen(true);
}

function closeSheet() {
  if (!els || !open) return;
  open = false;
  if (game) {
    game.destroy();
    game = null;
  }
  // inert comes off before the focus call: focusing inside an inert subtree
  // silently does nothing.
  els.shell.inert = false;
  // Resumed now rather than on settle, so the smoke is already drifting behind
  // the sheet as it descends and the page does not come back to a still frame.
  resumeField();
  els.play.focus();
  // Everything above is instant; only re-hiding the sheet has to wait for the
  // spring, since `hidden` would make it vanish rather than descend.
  setSheetOpen(false, finishClose);
}

/* Runs when the sheet spring has settled at the bottom — or synchronously from
   stopGesture(), if the page is torn down mid-descent. */
function finishClose() {
  if (els) els.sheet.hidden = true;
}

export function initEgg() {
  // astro:page-load fires on every client navigation, and About can be
  // re-entered, so start from a clean slate rather than double-binding.
  stopEgg();

  const play = document.querySelector(".egg-play");
  const sheet = document.querySelector(".egg-sheet");
  const close = document.querySelector(".egg-close");
  const canvas = document.querySelector(".egg-canvas");
  const status = document.querySelector(".egg-status");
  const shell = document.querySelector(".shell");
  if (!play || !sheet || !close || !canvas || !status || !shell) return;

  els = { play, sheet, close, canvas, status, shell };

  onPlay = () => openSheet();
  onClose = () => closeSheet();
  onKeydown = (event) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeSheet();
    }
  };

  play.addEventListener("click", onPlay);
  close.addEventListener("click", onClose);
  document.addEventListener("keydown", onKeydown);

  initGesture(els, { openSheet, closeSheet });
}

/* Safe to call when initEgg() never ran, which is the common case: site.js
   calls it on every before-swap and on pagehide without checking the route
   it is leaving. Closing an open sheet here is what keeps a Back press from
   handing the next page an inert shell and a frozen field. */
export function stopEgg() {
  if (els) {
    if (open) closeSheet();
    els.play.removeEventListener("click", onPlay);
    els.close.removeEventListener("click", onClose);
  }
  if (onKeydown) document.removeEventListener("keydown", onKeydown);
  stopGesture();
  els = null;
  game = null;
  open = false;
  onPlay = null;
  onClose = null;
  onKeydown = null;
}
