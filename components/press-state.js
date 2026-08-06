/**
 * Marks the control currently under a press with `.is-pressed`.
 *
 * `:active` alone is not enough. iOS and iPadOS withhold it from touch unless
 * the page happens to carry a touch listener, so a finger press on an iPad
 * shows no feedback at all, and what :active does on a drag away from the
 * control varies by engine. Pointer events answer the same question the same
 * way for a mouse, a trackpad cursor, and a finger.
 *
 * The CSS keeps `:active` alongside `.is-pressed`, so a press still reads on
 * a pointer-driven device if this never loads.
 */

const PRESSABLE_SELECTOR = ".core-ai-page .button";
const PRESSED_CLASS = "is-pressed";

let pressed = null;

function release() {
  if (!pressed) return;
  pressed.classList.remove(PRESSED_CLASS);
  pressed = null;
}

function handlePointerDown(event) {
  /* Secondary buttons and the extra contacts of a multi-touch are not presses. */
  if (!event.isPrimary) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;

  const target = event.target.closest?.(PRESSABLE_SELECTOR);
  if (!target) return;

  release();
  pressed = target;
  target.classList.add(PRESSED_CLASS);
}

function handlePointerMove(event) {
  if (!pressed) return;

  /* A touch pointer keeps targeting the element it started on, so compare
     against the box rather than trusting event.target. */
  const bounds = pressed.getBoundingClientRect();
  const outside =
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom;

  if (outside) release();
}

const listenerOptions = { passive: true };
document.addEventListener("pointerdown", handlePointerDown, listenerOptions);
document.addEventListener("pointermove", handlePointerMove, listenerOptions);
document.addEventListener("pointerup", release, listenerOptions);
/* Fires when a touch turns into a scroll, which should let the button back up. */
document.addEventListener("pointercancel", release, listenerOptions);
/* A press that ends with the page losing focus never sees a pointerup. */
window.addEventListener("blur", release);
