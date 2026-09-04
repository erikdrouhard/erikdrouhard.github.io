/* ==========================================================================
   theme.js — toggle + persist.

   First application already happened in the inline <head> script, before the
   first stylesheet, so there is no flash. This module only handles the click
   and keeps the toggle's label and aria-pressed honest.

   Dark is the default for every first visit. prefers-color-scheme is
   deliberately ignored: the design is authored dark-first.
   ========================================================================== */
const KEY = "ed-theme";

function saved() {
  try {
    return localStorage.getItem(KEY);
  } catch (e) {
    return null;
  }
}

function persist(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch (e) {
    /* private mode / blocked storage: the toggle still works, it just forgets */
  }
}

/* The browser-chrome colour is the page ground, so it is read back off the
   rendered body rather than written here: the design system keeps every colour
   in tokens.css, and a literal in this file would be a second source for one
   of them. The tag is created on demand because there is nothing sensible to
   put in it server-side, where no stylesheet has resolved yet. */
function paintBrowserChrome() {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", getComputedStyle(document.body).backgroundColor);
}

export function apply(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  if (document.body) paintBrowserChrome();

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
/* ClientRouter's swapRootAttributes() replaces every attribute on <html> with
   the incoming document's, and the incoming document is server-rendered without
   data-theme — the inline <head> script only runs on a full page load. So a
   client navigation strips the attribute, and reading it back would report
   "dark" to a reader who chose light. Storage is the source of truth here, not
   the DOM. */
export function restoreTheme() {
  apply(saved() || "dark");
}

let bound = false;

export function initTheme() {
  if (!bound) {
    document.addEventListener("click", onClick);
    bound = true;
  }
  // Also re-syncs the freshly-swapped footer toggle's label and aria-pressed.
  restoreTheme();
}
