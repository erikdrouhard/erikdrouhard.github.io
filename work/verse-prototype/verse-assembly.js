/* ==========================================================================
   PROTOTYPE — Verse assembly journey
   --------------------------------------------------------------------------
   Throwaway reaction prototype. Not production, not published, branch-only.

   It answers one question: should the visitor's choices be PRODUCT
   REQUIREMENTS rather than visual preferences?

   Five requirement dimensions feed one derivation step. That derivation is
   the whole argument: requirements in, system layers out.

       requirements  ->  Verse Tokens
                     ->  Core Components
                     ->  Layout Components
                     ->  Mix Page

   Every specimen here is a reconstruction built for this prototype. None of
   it is a production screenshot.
   ========================================================================== */

const REQUIREMENTS = [
  {
    key: "task",
    label: "Primary task",
    question: "What is the author actually doing?",
    options: [
      { id: "create", label: "Create", hint: "Authoring something and committing it." },
      { id: "inspect", label: "Inspect", hint: "Reading state without changing it." },
      { id: "confirm", label: "Confirm", hint: "Approving something hard to undo." },
    ],
  },
  {
    key: "context",
    label: "Interaction context",
    question: "Where does it have to live?",
    options: [
      { id: "inline", label: "Inline", hint: "In the canvas, beside the thing it edits." },
      { id: "panel", label: "Panel", hint: "Docked beside a persistent selection." },
      { id: "overlay", label: "Overlay", hint: "Above the canvas, taking focus." },
    ],
  },
  {
    key: "density",
    label: "Information density",
    question: "How much is on screen at once?",
    options: [
      { id: "focused", label: "Focused", hint: "One or two related decisions." },
      { id: "dense", label: "Data-dense", hint: "A full property set, scanned quickly." },
    ],
  },
  {
    key: "state",
    label: "State",
    question: "What state is the author in?",
    options: [
      { id: "default", label: "Default", hint: "Nothing pending, nothing wrong." },
      { id: "error", label: "Validation error", hint: "Input the system cannot accept." },
      { id: "loading", label: "Loading", hint: "Waiting on the platform." },
      { id: "disabled", label: "Disabled", hint: "Action unavailable right now." },
    ],
  },
  {
    key: "input",
    label: "Input method",
    question: "Who is driving?",
    options: [
      { id: "pointer", label: "Pointer", hint: "Mouse or trackpad." },
      { id: "keyboard", label: "Keyboard", hint: "Tab, Enter, Escape, shortcuts." },
      { id: "touch", label: "Touch", hint: "Finger targets, no hover." },
    ],
  },
];

const LAYERS = [
  { id: "tokens", name: "Verse Tokens", ordinal: "01", blurb: "Values, not decisions." },
  { id: "core", name: "Core Components", ordinal: "02", blurb: "Behavior and accessible states." },
  { id: "layout", name: "Layout Components", ordinal: "03", blurb: "HStack and VStack composition." },
  { id: "page", name: "Mix Page", ordinal: "04", blurb: "The finished product surface." },
];

/* Reconstructed token set. Names follow the Verse/Bolt convention; values are
   representative, taken from the i3 2022 deck's own specimens. */
const TOKEN_VALUES = {
  "color.brand.primary": "#0078b8",
  "color.brand.primary.hover": "#0089d1",
  "color.feedback.error": "#c62828",
  "color.feedback.warning": "#b26a00",
  "color.surface.raised": "#ffffff",
  "color.surface.subtle": "#f3f5f7",
  "color.text.default": "#1b1f24",
  "color.text.muted": "#5b6570",
  "color.border.default": "#d5dbe1",
  "focus.ring": "2px solid #0078b8",
  "radius.default": "6px",
  "space.4": "4px",
  "space.10": "10px",
  "space.16": "16px",
  "size.control.default": "32px",
  "size.control.touch": "44px",
  "text.body": "400 14px/1.4",
  "text.label": "600 13px/1.4",
};

const FIELDS_FOCUSED = [
  { name: "title", label: "Title", control: "input", placeholder: "My awesome title…", value: "Confirm payment amount" },
  { name: "description", label: "Description", control: "textbox", placeholder: "Description goes here…", value: "Read the balance back before collecting payment." },
];

const FIELDS_DENSE = [
  ...FIELDS_FOCUSED,
  { name: "channel", label: "Channel", control: "select", value: "Voice + Digital" },
  { name: "retries", label: "Retry limit", control: "input", value: "2", invalid: true },
  { name: "timeout", label: "No-input timeout", control: "input", value: "7000 ms" },
  { name: "locale", label: "Locale", control: "select", value: "en-US" },
];

/* --------------------------------------------------------------------------
   The derivation. This is the hypothesis under test, expressed as code:
   requirements are read, and each layer is assembled from them with a stated
   reason. Nothing here is a style preference.
   -------------------------------------------------------------------------- */
function derive(state) {
  const tokens = new Map();
  const core = new Map();
  const trace = [];

  const addToken = (name, because) => {
    if (!tokens.has(name)) tokens.set(name, { name, value: TOKEN_VALUES[name], because });
  };
  const addCore = (name, note, because) => {
    if (!core.has(name)) core.set(name, { name, note, because });
  };
  const say = (dimension, line) => trace.push({ dimension, line });

  /* -- Always-on foundation ---------------------------------------------- */
  ["color.surface.raised", "color.text.default", "color.border.default", "radius.default", "text.body", "text.label"].forEach(
    (t) => addToken(t, "Every Verse surface resolves through the same base values."),
  );
  addCore("Text", "Typographic primitive", "Every layer needs labelled content.");

  /* -- Primary task ------------------------------------------------------- */
  const verbs = { create: ["Save", "Cancel"], inspect: ["Close", null], confirm: ["Delete node", "Cancel"] };
  const [primaryVerb, secondaryVerb] = verbs[state.task];
  let primaryVariant = "Button.Primary";

  if (state.task === "create") {
    addToken("color.brand.primary", "A committing action needs the brand's primary emphasis.");
    addToken("color.brand.primary.hover", "Primary emphasis carries its own interaction states.");
    addCore("Button.Primary", "Commits the edit", "The task ends in a write.");
    addCore("Button.Secondary", "Abandons the edit", "A write needs a reversible way out.");
    addCore("Input", "Single-line value", "The author is supplying values.");
    addCore("Textbox", "Multi-line value", "The author is supplying values.");
    say("task", "Create ends in a write, so Core supplies Button.Primary with Button.Secondary beside it, and Tokens pull in color.brand.primary.");
  }

  if (state.task === "inspect") {
    addToken("color.surface.subtle", "Read-only values sit on a quieter surface than editable ones.");
    addToken("color.text.muted", "Values the author cannot change are de-emphasised, not hidden.");
    addCore("Button.Secondary", "Dismisses the surface", "Nothing is committed, so nothing needs primary emphasis.");
    say("task", "Inspect commits nothing, so Verse withholds Button.Primary entirely and renders values as Text on color.surface.subtle. There is no primary action to give emphasis to.");
    primaryVariant = "Button.Secondary";
  }

  if (state.task === "confirm") {
    addToken("color.feedback.error", "A destructive confirmation is coloured by consequence, not by brand.");
    addCore("Button.Danger", "Performs the destructive act", "The action is hard to undo.");
    addCore("Button.Secondary", "The safe way out", "Destructive flows must have an obvious retreat.");
    say("task", "Confirm is hard to undo, so the committing control becomes Button.Danger on color.feedback.error — the emphasis reports consequence rather than brand.");
    primaryVariant = "Button.Danger";
  }

  /* -- Interaction context ------------------------------------------------ */
  const context = state.context;
  if (context === "inline") {
    addCore("HStack", "Row composition", "An inline row sits along one axis.");
    say("context", "Inline keeps the canvas live underneath, so the composition is a single HStack in the node toolbar. No container chrome, no dismissal, no focus trap.");
  }
  if (context === "panel") {
    addCore("VStack", "Column composition", "A property set reads top to bottom.");
    addCore("HStack", "Action row", "Actions align on one axis at the foot of the panel.");
    addCore("Label", "Binds text to control", "Docked property editing is form work.");
    say("context", "Panel is persistent and tied to the current selection, so Verse composes a VStack of labelled fields with an HStack action row pinned at the foot.");
  }
  if (context === "overlay") {
    addToken("color.surface.raised", "An overlay must separate from the canvas behind it.");
    addCore("Popover", "Dismissible layered surface", "The surface floats above the canvas.");
    addCore("VStack", "Column composition", "Overlay content still reads top to bottom.");
    addCore("HStack", "Action row", "Overlay actions sit on one axis.");
    addCore("Label", "Binds text to control", "Overlay fields are still form work.");
    say("context", "Overlay takes focus from the canvas, so Verse wraps the composition in Popover — which brings a focus trap, Escape-to-dismiss, and a return-focus contract that HStack and VStack do not have.");
  }

  /* -- Information density ------------------------------------------------ */
  let fields = state.density === "dense" ? FIELDS_DENSE : FIELDS_FOCUSED;
  let overflow = 0;
  const gapToken = state.density === "dense" ? "space.4" : "space.16";
  addToken(gapToken, state.density === "dense"
    ? "Dense property sets tighten the rhythm so a full set is scannable."
    : "A focused surface can afford generous separation.");
  addToken("space.10", "The gap between a label and its own control never changes with density.");

  if (state.density === "dense") {
    addCore("Select", "Constrained choice", "Dense property sets include enumerated values.");
    say("density", "Data-dense holds six related properties, so the stack gap drops to space.4. The label-to-control gap stays at space.10 — density compresses between rows, never inside one.");
  } else {
    say("density", "Focused holds two decisions, so the stack gap opens to space.16.");
  }

  if (context === "inline") {
    /* An inline row physically cannot hold a property set. Verse does not
       silently reflow — it overflows, and says so. */
    overflow = Math.max(0, fields.length - 2);
    fields = fields.slice(0, 2);
    if (overflow) {
      addCore("Popover", "Overflow surface", "Properties that do not fit the row still need a home.");
      say("conflict", `Inline plus data-dense is a genuine conflict: ${overflow} properties do not fit a canvas row. Verse resolves it by keeping two inline and moving the rest behind a Popover, rather than quietly widening the toolbar.`);
    }
  }

  if (state.task === "inspect") {
    fields = fields.map((f) => ({ ...f, control: "readonly" }));
  }

  /* -- State -------------------------------------------------------------- */
  if (state.state === "error") {
    addToken("color.feedback.error", "A validation failure must be reported in colour and in text.");
    addCore("Text", "Carries the error message", "Colour alone cannot carry the failure.");
    say("state", "Validation error marks the offending control with aria-invalid, binds a Text message through aria-describedby, and leaves the primary action enabled so the author can retry. Colour never carries the failure alone.");
  }
  if (state.state === "loading") {
    addCore("Spinner", "Pending indicator", "The author must know the platform is working.");
    say("state", "Loading is a Button state, not a separate component — the control keeps its footprint, sets aria-busy, and announces politely. Swapping in a different element here would move focus and lose the author's place.");
  }
  if (state.state === "disabled") {
    addToken("color.text.muted", "A disabled control must still meet contrast for its label.");
    say("state", "Disabled is where most systems fail accessibility. Verse keeps the control focusable and describes why it is unavailable, rather than removing it from the tab order and leaving the author with no explanation.");
  }
  if (state.state === "default") {
    say("state", "Default is the baseline the other three are measured against — same footprint, same tab order, same target size.");
  }

  /* -- Input method ------------------------------------------------------- */
  const controlToken = state.input === "touch" ? "size.control.touch" : "size.control.default";
  addToken(controlToken, state.input === "touch"
    ? "Touch raises every target to 44px — the same component, a different token."
    : "Pointer and keyboard share the 32px control height.");
  addToken("focus.ring", "The focus ring is a token so it can never be styled away per-component.");

  if (state.input === "pointer") say("input", "Pointer keeps controls at size.control.default and enables hover affordances, which are treated as an enhancement — nothing is only discoverable by hovering.");
  if (state.input === "keyboard") say("input", "Keyboard makes focus.ring permanently visible, exposes Escape and Enter as documented commands, and requires the composition's DOM order to match its visual order.");
  if (state.input === "touch") say("input", "Touch swaps size.control.default for size.control.touch — 44px targets from the same Core Component. Hover affordances drop out entirely, so nothing depends on them.");

  /* -- Layout shape ------------------------------------------------------- */
  const layout = { context, fields, overflow, gapToken, primaryVerb, secondaryVerb, primaryVariant };

  return {
    tokens: [...tokens.values()],
    core: [...core.values()],
    layout,
    trace,
    outcome: { inline: "Inline toolbar composition", panel: "Properties panel", overlay: "Overlay workflow" }[context],
  };
}

/* -------------------------------------------------------------------------- */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

class VerseAssembly extends HTMLElement {
  connectedCallback() {
    this.state = { task: "create", context: "panel", density: "focused", state: "default", input: "pointer" };
    this.layer = "page";
    this.lastChanged = null;
    this.openOverflow = false;
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.onClick = this.onClick.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
    this.addEventListener("click", this.onClick);
    this.addEventListener("keydown", this.onKeydown);
    this.render();
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.onClick);
    this.removeEventListener("keydown", this.onKeydown);
  }

  onClick(event) {
    const button = event.target.closest("button[data-command]");
    if (!button || !this.contains(button)) return;
    const { command } = button.dataset;

    if (command === "set-requirement") {
      const { key, value } = button.dataset;
      if (this.state[key] === value) return;
      this.state[key] = value;
      this.lastChanged = key;
      this.openOverflow = false;
      this.render({ focus: `req-${key}-${value}` });
    }
    if (command === "set-layer") {
      this.layer = button.dataset.layer;
      this.render({ focus: `layer-${this.layer}` });
    }
    if (command === "toggle-overflow") {
      this.openOverflow = !this.openOverflow;
      this.render({ focus: "overflow-trigger" });
    }
    if (command === "reset") {
      this.state = { task: "create", context: "panel", density: "focused", state: "default", input: "pointer" };
      this.lastChanged = null;
      this.openOverflow = false;
      this.render({ focus: "reset" });
    }
  }

  onKeydown(event) {
    if (event.key === "Escape" && this.openOverflow) {
      this.openOverflow = false;
      this.render({ focus: "overflow-trigger" });
      return;
    }
    /* Requirement groups are radio groups: arrows move and select. */
    const chip = event.target.closest('[data-command="set-requirement"]');
    if (!chip) return;
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const group = REQUIREMENTS.find((r) => r.key === chip.dataset.key);
    const index = group.options.findIndex((o) => o.id === chip.dataset.value);
    const next = group.options[(index + keys[event.key] + group.options.length) % group.options.length];
    this.state[group.key] = next.id;
    this.lastChanged = group.key;
    this.openOverflow = false;
    this.render({ focus: `req-${group.key}-${next.id}` });
  }

  render({ focus = null } = {}) {
    const d = derive(this.state);
    this.derived = d;

    this.innerHTML = `
      <section class="va" aria-label="Verse assembly prototype">
        <header class="va__bar">
          <p class="va__flag">PROTOTYPE · RECONSTRUCTION · NOT PRODUCTION UI</p>
          <button class="va__reset" type="button" data-command="reset" data-focus-id="reset">Reset requirements</button>
        </header>

        <div class="va__body">
          ${this.renderRail(d)}
          ${this.renderStage(d)}
          ${this.renderControls(d)}
        </div>

        ${this.renderTrace(d)}
      </section>`;

    if (focus) {
      requestAnimationFrame(() => {
        const target = this.querySelector(`[data-focus-id="${focus}"]`);
        if (target) target.focus({ preventScroll: true });
      });
    }
  }

  /* -- The narrative rail: the four authentic Verse layers ----------------- */
  renderRail(d) {
    const counts = {
      tokens: `${d.tokens.length} active`,
      core: `${d.core.length} in play`,
      layout: d.layout.context === "overlay" ? "Popover · VStack · HStack" : d.layout.context === "panel" ? "VStack · HStack" : "HStack",
      page: d.outcome,
    };

    return `
      <nav class="va__rail" aria-label="System layers">
        <p class="va__rail-title">The system underneath</p>
        <ol class="va__ladder">
          ${LAYERS.map((layer) => `
            <li>
              <button
                class="va-rung va-rung--${layer.id}${this.layer === layer.id ? " is-current" : ""}"
                type="button"
                data-command="set-layer"
                data-layer="${layer.id}"
                data-focus-id="layer-${layer.id}"
                aria-current="${this.layer === layer.id ? "true" : "false"}"
              >
                <span class="va-rung__ordinal">${layer.ordinal}</span>
                <span class="va-rung__name">${layer.name}</span>
                <span class="va-rung__count">${esc(counts[layer.id])}</span>
                <span class="va-rung__blurb">${layer.blurb}</span>
              </button>
            </li>`).join("")}
        </ol>
        <p class="va__rail-note">Each layer is assembled from the requirements on the right. Nothing here is a theme.</p>
      </nav>`;
  }

  /* -- The large live preview, focused on one layer ------------------------ */
  renderStage(d) {
    const views = {
      tokens: () => this.renderTokens(d),
      core: () => this.renderCore(d),
      layout: () => this.renderLayout(d),
      page: () => this.renderPage(d),
    };
    const layer = LAYERS.find((l) => l.id === this.layer);

    return `
      <div class="va__stage va__stage--${this.layer}">
        <header class="va__stage-head">
          <p class="va__stage-label">${layer.ordinal} · ${layer.name.toUpperCase()}</p>
          <p class="va__stage-outcome">${esc(d.outcome)}</p>
        </header>
        <div class="va__stage-body">${views[this.layer]()}</div>
      </div>`;
  }

  renderTokens(d) {
    return `
      <p class="va__stage-intro">The values feeding the specimen right now. A requirement adds or removes tokens; it never edits one.</p>
      <ul class="va-tokens">
        ${d.tokens.map((t) => `
          <li class="va-token">
            <span class="va-token__swatch" style="${t.value?.startsWith("#") ? `background:${t.value}` : ""}" aria-hidden="true">${t.value?.startsWith("#") ? "" : "◇"}</span>
            <code class="va-token__name">${esc(t.name)}</code>
            <code class="va-token__value">${esc(t.value ?? "—")}</code>
            <span class="va-token__why">${esc(t.because)}</span>
          </li>`).join("")}
      </ul>`;
  }

  renderCore(d) {
    const variants = d.core.filter((c) => c.name.startsWith("Button.")).map((c) => c.name);
    const states = ["default", "hover", "focus", "disabled", "loading"];
    const activeState = this.state.state === "error" ? "default" : this.state.state;

    return `
      <p class="va__stage-intro">Core Components carry behavior and accessible states. The ringed cell is the one the current requirements selected.</p>
      ${variants.length ? `
        <div class="va-matrix" role="group" aria-label="Button variants and states">
          <div class="va-matrix__row va-matrix__row--head">
            <span></span>${states.map((s) => `<span class="va-matrix__head">${s}</span>`).join("")}
          </div>
          ${variants.map((variant) => `
            <div class="va-matrix__row">
              <code class="va-matrix__label">&lt;${esc(variant)} /&gt;</code>
              ${states.map((s) => `
                <span class="va-matrix__cell${variant === d.layout.primaryVariant && s === activeState ? " is-selected" : ""}">
                  ${this.button({ variant, state: s, label: variant === d.layout.primaryVariant ? d.layout.primaryVerb : d.layout.secondaryVerb || "Cancel", inert: true })}
                </span>`).join("")}
            </div>`).join("")}
        </div>` : ""}

      <ul class="va-core-list">
        ${d.core.map((c) => `
          <li>
            <code>&lt;${esc(c.name)} /&gt;</code>
            <span class="va-core-list__note">${esc(c.note)}</span>
            <span class="va-core-list__why">${esc(c.because)}</span>
          </li>`).join("")}
      </ul>`;
  }

  renderLayout(d) {
    return `
      <p class="va__stage-intro">Layout Components compose the Core Components. The dashed boundaries are the real stacks — this is the same composition the Mix page renders.</p>
      <div class="va-layout-split">
        <div class="va-layout-annotated">${this.composition(d, { annotate: true })}</div>
        <pre class="va-jsx" aria-label="Composition source"><code>${this.jsx(d)}</code></pre>
      </div>`;
  }

  renderPage(d) {
    const { context } = d.layout;
    return `
      <p class="va__stage-intro">The assembled composition placed in a representative Mix.dialog page. Reconstructed for this prototype.</p>
      <div class="va-mix va-mix--${context}" data-input="${this.state.input}">
        <div class="va-mix__chrome">
          <span class="va-mix__dot" aria-hidden="true"></span>
          <span class="va-mix__crumb">Payments IVR / Collect balance / <strong>Confirm amount</strong></span>
        </div>
        <div class="va-mix__frame">
          <aside class="va-mix__tree" aria-hidden="true">
            <span>Dialog</span><span>Greeting</span><span>Account lookup</span>
            <span class="is-active">Confirm amount</span><span>Collect payment</span><span>Handoff</span>
          </aside>
          <div class="va-mix__canvas">
            <div class="va-mix__toolbar">
              ${context === "inline" ? `<div class="va-mix__slot va-mix__slot--inline">${this.composition(d)}</div>` : `<span class="va-mix__toolbar-ghost" aria-hidden="true">Node actions</span>`}
            </div>
            <div class="va-mix__node" aria-hidden="${context === "overlay" ? "true" : "false"}">
              <p class="va-mix__node-title">Confirm amount</p>
              <p class="va-mix__node-line">if <em>balance &gt; 0</em> → say “Your balance is $[balance].”</p>
              <p class="va-mix__node-line">else → say “Your balance is already clear.”</p>
            </div>
            ${context === "overlay" ? `<div class="va-mix__scrim"><div class="va-mix__slot va-mix__slot--overlay">${this.composition(d)}</div></div>` : ""}
          </div>
          ${context === "panel" ? `<div class="va-mix__panel"><div class="va-mix__slot va-mix__slot--panel">${this.composition(d)}</div></div>` : `<aside class="va-mix__panel va-mix__panel--ghost" aria-hidden="true"><span>Properties</span></aside>`}
        </div>
      </div>`;
  }

  /* -- One composition, rendered identically in Layout and Mix Page -------- */
  composition(d, { annotate = false } = {}) {
    const { context, fields, overflow, gapToken, primaryVerb, secondaryVerb, primaryVariant } = d.layout;
    const gap = TOKEN_VALUES[gapToken];
    const wrap = (kind, label, inner, extra = "") =>
      annotate
        ? `<div class="va-stack va-stack--${kind}" ${extra}><span class="va-stack__tag">&lt;${label} /&gt;</span>${inner}</div>`
        : `<div class="va-stack va-stack--${kind}" ${extra}>${inner}</div>`;

    const actions = `
      ${secondaryVerb ? this.button({ variant: "Button.Secondary", state: this.buttonState("secondary"), label: secondaryVerb }) : ""}
      ${this.button({ variant: primaryVariant, state: this.buttonState("primary"), label: primaryVerb })}`;

    if (context === "inline") {
      const inlineFields = fields.map((f) => this.field(f, { compact: true })).join("");
      const overflowUi = overflow
        ? `<div class="va-overflow">
             <button class="va-btn va-btn--secondary" type="button" data-command="toggle-overflow" data-focus-id="overflow-trigger" aria-expanded="${this.openOverflow}">+${overflow} more</button>
             ${this.openOverflow ? `<div class="va-popover va-popover--overflow" role="dialog" aria-label="More properties">${(this.state.density === "dense" ? FIELDS_DENSE.slice(2) : []).map((f) => this.field(this.state.task === "inspect" ? { ...f, control: "readonly" } : f)).join("")}</div>` : ""}
           </div>`
        : "";
      return wrap("h", "HStack", `${inlineFields}${overflowUi}${actions}`, `style="gap:${gap}"`);
    }

    const body = `
      ${fields.map((f) => this.field(f)).join("")}
      ${wrap("h", 'HStack gap="space-between"', actions, `style="gap:${TOKEN_VALUES["space.10"]};justify-content:space-between"`)}`;

    const stack = wrap("v", "VStack", body, `style="gap:${gap}"`);
    if (context !== "overlay") return stack;

    return `
      <div class="va-popover${annotate ? " is-annotated" : ""}" role="dialog" aria-label="${esc(primaryVerb)}">
        ${annotate ? '<span class="va-stack__tag va-stack__tag--popover">&lt;Popover /&gt;</span>' : ""}
        <header class="va-popover__head">
          <strong>${esc(this.state.task === "confirm" ? "Delete this node?" : "Confirm amount")}</strong>
          <span class="va-popover__close" aria-hidden="true">✕</span>
        </header>
        <div class="va-popover__body">${stack}</div>
      </div>`;
  }

  buttonState(role) {
    const s = this.state.state;
    if (s === "loading") return role === "primary" ? "loading" : "disabled";
    if (s === "disabled") return role === "primary" ? "disabled" : "default";
    return "default";
  }

  button({ variant, state, label, inert = false }) {
    const kind = variant.split(".")[1].toLowerCase();
    const touch = this.state.input === "touch";
    const classes = [
      "va-btn",
      `va-btn--${kind}`,
      `is-${state}`,
      touch ? "is-touch" : "",
      this.state.input === "keyboard" ? "is-keyboard" : "",
    ].filter(Boolean).join(" ");

    const busy = state === "loading";
    /* aria-disabled rather than the `disabled` attribute. A disabled button is
       removed from the tab order and its description is never announced, which
       is exactly the failure the Disabled requirement is meant to demonstrate
       Verse avoiding. The control stays focusable and carries its reason. */
    const off = state === "disabled";
    return `
      <button
        class="${classes}"
        type="button"
        ${inert ? 'tabindex="-1" aria-hidden="true"' : ""}
        ${off ? 'aria-disabled="true"' : ""}
        ${busy ? 'aria-busy="true"' : ""}
        ${off && !inert ? 'aria-describedby="va-disabled-reason"' : ""}
      >${busy ? '<span class="va-spinner" aria-hidden="true"></span>' : ""}<span>${esc(label)}</span></button>`;
  }

  field(f, { compact = false } = {}) {
    const invalid = this.state.state === "error" && f.invalid;
    const disabled = this.state.state === "loading";
    const id = `va-field-${f.name}`;
    const gap = TOKEN_VALUES["space.10"];

    const control = {
      readonly: `<span class="va-readonly">${esc(f.value)}</span>`,
      select: `<span class="va-input va-input--select${disabled ? " is-disabled" : ""}">${esc(f.value)}<span aria-hidden="true">⌄</span></span>`,
      textbox: `<textarea class="va-input va-input--textbox" id="${id}" rows="2" placeholder="${esc(f.placeholder || "")}" ${disabled ? "disabled" : ""}>${esc(f.value)}</textarea>`,
      input: `<input class="va-input${invalid ? " is-invalid" : ""}" id="${id}" value="${esc(f.value)}" placeholder="${esc(f.placeholder || "")}" ${disabled ? "disabled" : ""} ${invalid ? `aria-invalid="true" aria-describedby="${id}-error"` : ""} />`,
    }[f.control];

    /* Only `input` and `textbox` render a real form control, so only those get
       a `for` binding. Readonly values and the simulated Select are static
       markup — pointing a label at an id that does not exist is worse than
       having no label association at all. */
    const bindable = f.control === "input" || f.control === "textbox";
    const tag = bindable ? "label" : "div";
    const attrs = bindable ? ` for="${id}"` : "";

    return `
      <${tag} class="va-field${compact ? " va-field--compact" : ""}"${attrs} style="gap:${gap}">
        <span class="va-field__label">${esc(f.label)}</span>
        ${control}
        ${invalid ? `<span class="va-field__error" id="${id}-error">Retry limit must be between 0 and 5.</span>` : ""}
      </${tag}>`;
  }

  jsx(d) {
    const { context, fields, gapToken, primaryVerb, secondaryVerb, primaryVariant, overflow } = d.layout;
    const gap = TOKEN_VALUES[gapToken].replace("px", "");
    const stateProps = {
      default: "",
      error: "",
      loading: ' state="loading"',
      disabled: " disabled",
    }[this.state.state];

    const fieldSource = fields.map((f) => {
      if (f.control === "readonly") return `  <Text tone="muted">${f.label}: ${f.value}</Text>`;
      const tag = { input: "Input", textbox: "Textbox", select: "Select" }[f.control];
      const invalid = this.state.state === "error" && f.invalid ? " invalid" : "";
      return [
        "  <Label>",
        `    <VStack gap={10}>`,
        `      <Text>${f.label}</Text>`,
        `      <${tag} placeholder="${f.placeholder || f.value}"${invalid} />`,
        "    </VStack>",
        "  </Label>",
      ].join("\n");
    }).join("\n");

    const actionSource = [
      '  <HStack gap="space-between">',
      secondaryVerb ? `    <Button.Secondary>${secondaryVerb}</Button.Secondary>` : null,
      `    <${primaryVariant}${stateProps}>${primaryVerb}</${primaryVariant}>`,
      "  </HStack>",
    ].filter(Boolean).join("\n");

    if (context === "inline") {
      const inline = [
        `<HStack gap={${gap}}>`,
        ...fields.map((f) => `  <${f.control === "readonly" ? "Text" : "Input"} />`),
        overflow ? `  <Popover>{/* ${overflow} more properties */}</Popover>` : null,
        secondaryVerb ? `  <Button.Secondary>${secondaryVerb}</Button.Secondary>` : null,
        `  <${primaryVariant}${stateProps}>${primaryVerb}</${primaryVariant}>`,
        "</HStack>",
      ].filter(Boolean).join("\n");
      return esc(inline);
    }

    const stack = [`<VStack gap={${gap}}>`, fieldSource, actionSource, "</VStack>"].join("\n");
    if (context === "panel") return esc(stack);

    return esc([
      `<Popover title="${this.state.task === "confirm" ? "Delete this node?" : "Confirm amount"}" theme="dark">`,
      stack.split("\n").map((l) => "  " + l).join("\n"),
      "</Popover>",
    ].join("\n"));
  }

  /* -- Causality: why the last change moved the system --------------------- */
  renderControls(d) {
    return `
      <div class="va__controls">
        <p class="va__controls-title">Product requirements</p>
        <p class="va__controls-note">Not preferences. Each one is something a real Mix feature had to satisfy.</p>
        ${REQUIREMENTS.map((group) => `
          <fieldset class="va-group${this.lastChanged === group.key ? " is-changed" : ""}">
            <legend class="va-group__legend">${group.label}</legend>
            <p class="va-group__question">${group.question}</p>
            <div class="va-group__options" role="radiogroup" aria-label="${group.label}">
              ${group.options.map((option) => {
                const selected = this.state[group.key] === option.id;
                return `
                  <button
                    class="va-chip${selected ? " is-selected" : ""}"
                    type="button"
                    role="radio"
                    aria-checked="${selected}"
                    tabindex="${selected ? "0" : "-1"}"
                    data-command="set-requirement"
                    data-key="${group.key}"
                    data-value="${option.id}"
                    data-focus-id="req-${group.key}-${option.id}"
                  >
                    <span class="va-chip__label">${option.label}</span>
                    <span class="va-chip__hint">${option.hint}</span>
                  </button>`;
              }).join("")}
            </div>
          </fieldset>`).join("")}
      </div>`;
  }

  renderTrace(d) {
    const changed = d.trace.filter((t) => t.dimension === this.lastChanged);
    const conflict = d.trace.filter((t) => t.dimension === "conflict");
    const rest = d.trace.filter((t) => t.dimension !== this.lastChanged && t.dimension !== "conflict");
    const dimensionName = (k) => REQUIREMENTS.find((r) => r.key === k)?.label ?? k;

    return `
      <div class="va__trace">
        <p class="va__trace-title">Why the system moved</p>
        <p class="va__trace-live" aria-live="polite">${changed.length ? esc(changed[0].line) : "Change a requirement to see what it costs the system."}</p>
        ${conflict.length ? `<p class="va__trace-conflict"><strong>Requirement conflict.</strong> ${esc(conflict[0].line)}</p>` : ""}
        ${this.state.state === "disabled" || this.state.state === "loading"
          ? `<p class="va__trace-aside" id="va-disabled-reason">${this.state.state === "loading"
              ? "The platform is still working. These controls re-enable when it responds."
              : "Nothing has changed yet, so there is nothing to save."}</p>`
          : ""}
        <ul class="va__trace-list">
          ${[...changed, ...rest].map((t) => `
            <li class="${changed.includes(t) ? "is-changed" : ""}">
              <span class="va__trace-dim">${esc(dimensionName(t.dimension))}</span>
              <span>${esc(t.line)}</span>
            </li>`).join("")}
        </ul>
      </div>`;
  }
}

if (!customElements.get("verse-assembly")) {
  customElements.define("verse-assembly", VerseAssembly);
}
