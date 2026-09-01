/* ==========================================================================
   case-study-nav.js — the chapter rail's active-section tracking.

   A <case-study-nav> highlights the chapter you are reading and scrolls that
   link into view in the rail. Clicks are intercepted so the jump is smooth and
   the hash still lands in history.

   LIFECYCLE — custom elements mostly take care of themselves here. Inserting
   the swapped-in DOM upgrades the new element and runs connectedCallback;
   removing the old one runs disconnectedCallback, which is where the window
   listeners and the pending frame are dropped. So initCaseStudyNav() only has
   to make sure the definition exists, and there is nothing for site.js to tear
   down. It is a cheap no-op on pages without the element.
   ========================================================================== */

class CaseStudyNav extends HTMLElement {
  connectedCallback() {
    /* Moving the element within a document re-runs this. Binding a second time
       would leave a duplicate scroll listener behind on the next disconnect. */
    if (this.bound) return;

    this.links = [...this.querySelectorAll('a[href^="#"]')];
    this.targets = this.links
      .map((link) => document.querySelector(link.getAttribute("href")))
      .filter(Boolean);

    if (!this.links.length || !this.targets.length) return;

    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.handleClick = this.handleClick.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.addEventListener("click", this.handleClick);
    window.addEventListener("scroll", this.handleScroll, { passive: true });
    window.addEventListener("resize", this.handleScroll, { passive: true });
    this.bound = true;
    this.handleScroll();
  }

  disconnectedCallback() {
    if (!this.bound) return;

    this.removeEventListener("click", this.handleClick);
    window.removeEventListener("scroll", this.handleScroll);
    window.removeEventListener("resize", this.handleScroll);
    cancelAnimationFrame(this.frame);
    /* Cleared so a re-insertion binds again rather than sitting inert. */
    this.bound = false;
    this.activeLink = null;
  }

  handleClick(event) {
    const link = event.target.closest('a[href^="#"]');
    if (!link || !this.contains(link)) return;

    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({
      behavior: this.reduceMotion.matches ? "auto" : "smooth",
      block: "start",
    });
    history.pushState(null, "", link.getAttribute("href"));
  }

  handleScroll() {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const threshold = this.getBoundingClientRect().height + 32;
      let activeIndex = 0;

      this.targets.forEach((target, index) => {
        if (target.getBoundingClientRect().top <= threshold) activeIndex = index;
      });

      this.links.forEach((link, index) => {
        if (index === activeIndex) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      });

      const activeLink = this.links[activeIndex];
      if (activeLink !== this.activeLink) {
        this.activeLink = activeLink;
        activeLink.scrollIntoView({
          behavior: this.reduceMotion.matches ? "auto" : "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    });
  }
}

export function initCaseStudyNav() {
  /* Defining a name twice throws, and this runs again on every navigation. */
  if (!customElements.get("case-study-nav")) {
    customElements.define("case-study-nav", CaseStudyNav);
  }
}
