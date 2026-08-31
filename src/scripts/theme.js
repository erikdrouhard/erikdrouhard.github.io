/* ==========================================================================
   theme.js — toggle + persist.

   First application already happened in the inline <head> script, before the
   first stylesheet, so there is no flash. This module only handles the click
   and keeps the toggle's label and aria-pressed honest.

   Dark is the default for every first visit. prefers-color-scheme is
   deliberately ignored: the design is authored dark-first.
   ========================================================================== */
const KEY = "ed-theme";

function persist(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch (e) {
    /* private mode / blocked storage: the toggle still works, it just forgets */
  }
}

export function apply(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f4f6f0" : "#070d09");

  document.querySelectorAll(".theme-toggle").forEach((button) => {
    button.setAttribute("aria-pressed", String(theme === "light"));
    const label = button.querySelector(".theme-label");
    if (label) label.textContent = theme === "light" ? "Light" : "Dark";
  });

  document.dispatchEvent(new Event("themechange"));
}

function onClick(event) {
  const button = event.target.closest(".theme-toggle");
  if (!button) return;
  const next =
    document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
  apply(next);
  persist(next);
}

/* The click handler lives on <document>, which survives a ClientRouter swap,
   so it is bound once. Only the label sync has to re-run per page. */
let bound = false;

export function initTheme() {
  if (!bound) {
    document.addEventListener("click", onClick);
    bound = true;
  }
  // <html data-theme> persists across swaps; the freshly-swapped footer toggle
  // does not, so re-sync its label and pressed state.
  apply(document.documentElement.getAttribute("data-theme") || "dark");
}
