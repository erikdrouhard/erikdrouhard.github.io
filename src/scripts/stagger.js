/* ==========================================================================
   stagger.js — page-entry stagger.

   Mined from the prototype's view-transition module. The trail and hash
   routing are gone: real URLs made them obsolete, and history.back() is a
   better "back" than a hand-maintained view stack.

   What survives is the release: the incoming page's children start low and
   transparent, then are let go one at a time so a grid fills in from the top
   rather than appearing all at once.
   ========================================================================== */

const STAGGER = 70; // ms between siblings

let cleanup = 0;

function itemsFor(view) {
  // grid children get their own delays; everything else follows document order
  if (!view.querySelector(".grid")) return Array.from(view.children);
  return [
    ...Array.from(view.querySelectorAll(".work-head")),
    ...Array.from(view.querySelectorAll(".grid > *")),
  ];
}

export function initStagger() {
  clearTimeout(cleanup);

  const view = document.querySelector("main.view");
  if (!view) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const items = itemsFor(view);
  if (!items.length) return;

  view.classList.remove("is-entered");
  view.classList.add("is-entering");
  items.forEach((el, i) => {
    el.style.transitionDelay = i * STAGGER + "ms";
  });

  // two frames: one for the browser to commit the start state, one to release
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      view.classList.remove("is-entering");
      view.classList.add("is-entered");
    });
  });

  // once the longest delay has played out, drop the classes and the inline
  // delays so nothing lingers to interfere with hover transitions
  const total = 620 + items.length * STAGGER;
  cleanup = setTimeout(() => {
    view.classList.remove("is-entered");
    items.forEach((el) => {
      el.style.transitionDelay = "";
    });
  }, total);
}

export function stopStagger() {
  clearTimeout(cleanup);
}
