const CARD_SELECTOR = [
  "[data-magnetic-card]",
  ".mix-hero-visual",
  ".prototype-loop",
  ".drive-hero-visual",
].join(",");

const MAGNETIC_X_RANGE = 7;
const MAGNETIC_Y_RANGE = 5;
const MAGNETIC_Z = "18px";
const MAGNETIC_ROTATE_X = 3.25;
const MAGNETIC_ROTATE_Y = 4.25;
const MAGNETIC_SCALE = "1.012";
const MAGNETIC_SHADOW_X = 11;
const MAGNETIC_SHADOW_Y_BASE = 14;
const MAGNETIC_SHADOW_Y_RANGE = 5;

import {
  hasFinePointer,
  subscribeToPointerCapability,
} from "./pointer-hover.js";

const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

class MagneticCard {
  constructor(card) {
    this.card = card;
    this.frame = 0;
    this.active = false;
    this.handlePointerEnter = this.handlePointerEnter.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleWindowPointerMove = this.handleWindowPointerMove.bind(this);
    this.handlePreferenceChange = this.handlePreferenceChange.bind(this);

    this.stage = document.createElement("div");
    this.stage.className = "case-study-magnetic-stage";
    card.before(this.stage);
    this.stage.append(card);
    card.classList.add("case-study-magnetic-card");

    subscribeToPointerCapability(this.handlePreferenceChange);
    reduceMotionQuery.addEventListener("change", this.handlePreferenceChange);
    this.handlePreferenceChange();
  }

  get enabled() {
    return hasFinePointer() && !reduceMotionQuery.matches;
  }

  handlePreferenceChange() {
    if (this.enabled && !this.active) {
      this.stage.addEventListener("pointerenter", this.handlePointerEnter);
      this.stage.addEventListener("pointermove", this.handlePointerMove);
      this.stage.addEventListener("pointerleave", this.handlePointerLeave);
      this.active = true;
      return;
    }

    if (!this.enabled && this.active) {
      this.stage.removeEventListener("pointerenter", this.handlePointerEnter);
      this.stage.removeEventListener("pointermove", this.handlePointerMove);
      this.stage.removeEventListener("pointerleave", this.handlePointerLeave);
      window.removeEventListener("pointermove", this.handleWindowPointerMove);
      this.stage.classList.remove("is-magnetized");
      this.active = false;
      this.reset();
    }
  }

  handlePointerEnter() {
    this.stage.classList.add("is-magnetized");
    window.addEventListener("pointermove", this.handleWindowPointerMove, {
      passive: true,
    });
  }

  handlePointerMove(event) {
    this.handlePointerEnter();
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const bounds = this.stage.getBoundingClientRect();
      const x = Math.max(
        -1,
        Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2),
      );
      const y = Math.max(
        -1,
        Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2),
      );

      this.card.style.setProperty(
        "--magnetic-x",
        `${(x * MAGNETIC_X_RANGE).toFixed(2)}px`,
      );
      this.card.style.setProperty(
        "--magnetic-y",
        `${(y * MAGNETIC_Y_RANGE).toFixed(2)}px`,
      );
      this.card.style.setProperty("--magnetic-z", MAGNETIC_Z);
      this.card.style.setProperty(
        "--magnetic-rotate-x",
        `${(-y * MAGNETIC_ROTATE_X).toFixed(2)}deg`,
      );
      this.card.style.setProperty(
        "--magnetic-rotate-y",
        `${(x * MAGNETIC_ROTATE_Y).toFixed(2)}deg`,
      );
      this.card.style.setProperty("--magnetic-scale", MAGNETIC_SCALE);
      this.stage.style.setProperty(
        "--magnetic-shadow-x",
        `${(-x * MAGNETIC_SHADOW_X).toFixed(2)}px`,
      );
      this.stage.style.setProperty(
        "--magnetic-shadow-y",
        `${(MAGNETIC_SHADOW_Y_BASE - y * MAGNETIC_SHADOW_Y_RANGE).toFixed(2)}px`,
      );
    });
  }

  handlePointerLeave() {
    this.stage.classList.remove("is-magnetized");
    window.removeEventListener("pointermove", this.handleWindowPointerMove);
    this.reset();
  }

  handleWindowPointerMove(event) {
    const bounds = this.stage.getBoundingClientRect();
    const outside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;

    if (outside) this.handlePointerLeave();
  }

  reset() {
    cancelAnimationFrame(this.frame);
    this.card.style.removeProperty("--magnetic-x");
    this.card.style.removeProperty("--magnetic-y");
    this.card.style.removeProperty("--magnetic-z");
    this.card.style.removeProperty("--magnetic-rotate-x");
    this.card.style.removeProperty("--magnetic-rotate-y");
    this.card.style.removeProperty("--magnetic-scale");
    this.stage.style.removeProperty("--magnetic-shadow-x");
    this.stage.style.removeProperty("--magnetic-shadow-y");
  }
}

function initializeMagneticCards() {
  document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
    if (card.closest(".case-study-magnetic-stage")) return;
    new MagneticCard(card);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeMagneticCards, {
    once: true,
  });
} else {
  initializeMagneticCards();
}
