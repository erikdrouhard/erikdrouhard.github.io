class CaseStudyNav extends HTMLElement {
  connectedCallback() {
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
    this.handleScroll();
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.handleClick);
    window.removeEventListener("scroll", this.handleScroll);
    window.removeEventListener("resize", this.handleScroll);
    cancelAnimationFrame(this.frame);
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

if (!customElements.get("case-study-nav")) {
  customElements.define("case-study-nav", CaseStudyNav);
}
