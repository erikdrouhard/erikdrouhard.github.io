/* ==========================================================================
   pointer-hover.js

   Tracks whether the pointer *currently in use* can hover, and mirrors that on
   <html> as `.is-coarse-pointer`.

   The interaction media features describe the primary pointer the device was
   built around, not the one driving the page right now. iPadOS keeps answering
   `(hover: none)` and `(pointer: coarse)` while a trackpad or mouse moves a
   cursor around, so hover styling gated on the media query alone is invisible
   to every iPad cursor user (WebKit bug 209292). The same gap shows up in
   reverse on touchscreen laptops, which claim a fine pointer and then keep
   hover states stuck to whatever was last tapped.

   So the media query only seeds the initial answer; live pointer events correct
   it from there. A mouse turns hover styling on, a touch turns it back off
   before the tap can leave a hover state behind.

   LIFECYCLE — the listeners live on <window>, which survives a ClientRouter
   swap, so they are bound exactly once. What does not survive is the class:
   swapRootAttributes() replaces every attribute on <html> with the incoming
   server-rendered document's, which has no `class` at all. So the class has to
   be re-stamped on every page-load, and initPointerHover() does that each call.
   Miss it and case.css's `html:not(.is-coarse-pointer)` hover rules come back
   on after the first navigation on a touch device.
   ========================================================================== */

const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const COARSE_POINTER_CLASS = "is-coarse-pointer";

/* A tap emits compatibility mouse events right after its pointer events. Ignore
   mousemove for a moment after a touch so those do not read as a real cursor. */
const TOUCH_SETTLE_MS = 700;

const root = document.documentElement;
const finePointerQuery = window.matchMedia(FINE_POINTER_QUERY);
const subscribers = new Set();

let finePointer = finePointerQuery.matches;
let lastTouchAt = -TOUCH_SETTLE_MS;

function reflect() {
  root.classList.toggle(COARSE_POINTER_CLASS, !finePointer);
}

function setFinePointer(next) {
  if (next === finePointer) return;
  finePointer = next;
  reflect();
  subscribers.forEach((subscriber) => subscriber(finePointer));
}

function handlePointerEvent(event) {
  if (event.pointerType === "mouse") {
    setFinePointer(true);
    return;
  }

  /* Touch, and pen too: an Apple Pencil tap can leave the same stuck hover a
     finger does, and only newer iPads hover with one at all. */
  lastTouchAt = event.timeStamp;
  setFinePointer(false);
}

function handleMouseMove(event) {
  if (event.timeStamp - lastTouchAt < TOUCH_SETTLE_MS) return;
  setFinePointer(true);
}

function handleQueryChange(event) {
  setFinePointer(event.matches);
}

let bound = false;

export function initPointerHover() {
  if (!bound) {
    finePointerQuery.addEventListener("change", handleQueryChange);

    const listenerOptions = { capture: true, passive: true };
    window.addEventListener("pointerover", handlePointerEvent, listenerOptions);
    window.addEventListener("pointermove", handlePointerEvent, listenerOptions);
    window.addEventListener("pointerdown", handlePointerEvent, listenerOptions);
    window.addEventListener("mousemove", handleMouseMove, listenerOptions);
    bound = true;
  }

  /* Always, not just on the first call — see the lifecycle note above. */
  reflect();
}

/** Whether the pointer in use right now can hover. */
export function hasFinePointer() {
  return finePointer;
}

/**
 * Runs `subscriber` whenever that answer changes. Returns an unsubscribe
 * function.
 */
export function subscribeToPointerCapability(subscriber) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}
