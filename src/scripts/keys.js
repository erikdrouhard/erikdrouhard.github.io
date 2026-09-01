/* ==========================================================================
   keys.js — single-character shortcuts.

   Any <kbd data-key="X"> inside an <a> or <button> makes that control
   reachable by pressing X. Targets are resolved on each keypress against
   what is actually on screen, so a shortcut can never fire a control from a
   page that is no longer mounted.
   ========================================================================== */

function visibleTargets() {
  const map = {};
  document.querySelectorAll("[data-key]").forEach((el) => {
    const host = el.closest("a, button");
    if (!host) return;
    if (host.offsetParent === null) return; // display:none / detached
    // The egg sheet sets inert on .shell. Without this the About page's B
    // would still navigate home from underneath an open sheet, because inert
    // hides a control from tab and click but not from a document keydown.
    if (host.closest("[inert]")) return;
    map[el.dataset.key.toLowerCase()] = host;
  });
  return map;
}

/* The keycap flash is given 160ms before the navigation takes the frame. If
   anything else navigates inside that window, the anchor we captured is
   detached by the swap — and .click() on a detached anchor still follows its
   href in Chrome, which is a full page reload straight past ClientRouter. Two
   keypresses inside the window would queue two navigations. So the pending
   click is cancellable, and a swap cancels it. */
let pending = 0;

export function cancelPendingKey() {
  clearTimeout(pending);
  pending = 0;
}

function onKeydown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  const t = event.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  if (event.key.length !== 1) return;

  const link = visibleTargets()[event.key.toLowerCase()];
  if (!link) return;
  event.preventDefault();

  // flash the keycap so the shortcut is visibly acknowledged
  link.querySelectorAll("kbd").forEach((k) => {
    k.classList.add("hot");
    setTimeout(() => k.classList.remove("hot"), 380);
  });

  link.focus();
  if (link.tagName === "BUTTON") {
    link.click();
    return;
  }
  cancelPendingKey();
  pending = setTimeout(() => {
    pending = 0;
    if (link.isConnected) link.click();
  }, 160);
}

/* document survives ClientRouter swaps, so this binds once for the session. */
let bound = false;

export function initKeys() {
  if (bound) return;
  document.addEventListener("keydown", onKeydown, true);
  bound = true;
}
