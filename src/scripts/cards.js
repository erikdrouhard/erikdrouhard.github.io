/* ==========================================================================
   cards.js — card-shaped links and metric bars.

   [data-href] turns a non-anchor block (the closing card) into a click target
   without nesting interactive elements inside a real <a>. Keyboard activation
   is handled here too, because a div with role="link" gets no free Enter.
   ========================================================================== */

import { navigate } from "astro:transitions/client";

/* navigate() rather than location.href: assigning to location bypasses
   ClientRouter entirely, so the card would hard-load and lose the transition
   every other link on the page gets. */
function activate(card) {
  navigate(card.dataset.href);
}

function onClick(event) {
  const card = event.target.closest("[data-href]");
  if (!card) return;
  if (event.target.closest("a, button")) return; // let real controls win
  activate(card);
}

function onKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const el = document.activeElement;
  if (!el || !el.matches || !el.matches("[data-href]")) return;
  event.preventDefault();
  activate(el);
}

/* The metric bar is 30 segments; `lit` of them carry the accent. It renders
   only where a real number was supplied, so an absent bar is the correct
   result for a study with no measured outcome. */
function renderMetrics() {
  document.querySelectorAll(".metric .bar[data-value]").forEach((bar) => {
    if (bar.children.length) return;
    const pct = parseInt(bar.dataset.value, 10) || 0;
    const total = 30;
    const lit = Math.round((pct / 100) * total);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < total; i++) {
      const seg = document.createElement("span");
      if (i < lit) seg.className = "on";
      frag.appendChild(seg);
    }
    bar.appendChild(frag);
  });
}

let bound = false;

export function initCards() {
  if (!bound) {
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown);
    bound = true;
  }
  renderMetrics();
}
