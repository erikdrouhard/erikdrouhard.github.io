const actionCopy = {
  message: [
    "I found your account.",
    "Let me connect you with a specialist.",
    "We can keep going from here.",
  ],
  variable: [
    "$attempts = attempts + 1",
    "$journey = \"account support\"",
    "$paymentAmount = balance",
  ],
  event: [
    "account.lookup.completed",
    "payment.form.opened",
    "handoff.requested",
  ],
};

const actionNames = {
  message: "Message",
  variable: "Set variable",
  event: "Send event",
};

class ConditionStackDemo extends HTMLElement {
  connectedCallback() {
    this.counter = 0;
    this.addCounts = { message: 0, variable: 0, event: 0, block: 0 };
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.handleClick = this.handleClick.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleDragStart = this.handleDragStart.bind(this);
    this.handleDragOver = this.handleDragOver.bind(this);
    this.handleDrop = this.handleDrop.bind(this);
    this.handleDragEnd = this.handleDragEnd.bind(this);
    this.addEventListener("click", this.handleClick);
    this.addEventListener("keydown", this.handleKeydown);
    this.addEventListener("dragstart", this.handleDragStart);
    this.addEventListener("dragover", this.handleDragOver);
    this.addEventListener("drop", this.handleDrop);
    this.addEventListener("dragend", this.handleDragEnd);
    this.reset();
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.handleClick);
    this.removeEventListener("keydown", this.handleKeydown);
    this.removeEventListener("dragstart", this.handleDragStart);
    this.removeEventListener("dragover", this.handleDragOver);
    this.removeEventListener("drop", this.handleDrop);
    this.removeEventListener("dragend", this.handleDragEnd);
  }

  id(prefix) {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  action(type, value) {
    return { id: this.id("action"), kind: "action", type, value };
  }

  branch(type, condition, items = []) {
    return { id: this.id("branch"), type, condition, items };
  }

  block(condition, options = {}) {
    const block = {
      id: this.id("block"),
      kind: "block",
      label: options.label || "Nested condition",
      branches: [
        this.branch("if", condition, options.ifItems || []),
        this.branch("else", "", options.elseItems || []),
      ],
    };
    return block;
  }

  reset() {
    this.counter = 0;
    const channelBlock = this.block("channel equals voice", {
      label: "Channel response",
      ifItems: [this.action("message", "Say your payment amount.")],
      elseItems: [this.action("event", "payment.form.opened")],
    });

    const balanceBlock = this.block("balance is greater than 0", {
      label: "Payment options",
      ifItems: [
        this.action("variable", "$paymentAmount = balance"),
        channelBlock,
      ],
      elseItems: [this.action("message", "Your balance is already clear.")],
    });
    balanceBlock.branches.splice(
      1,
      0,
      this.branch("elseif", "paymentPlan exists", [
        this.action("event", "payment.plan.resumed"),
      ]),
    );

    this.root = this.block("accountType equals premium", {
      label: "Account routing",
      ifItems: [
        this.action("message", "Welcome back. What would you like to do?"),
        balanceBlock,
      ],
      elseItems: [this.action("event", "handoff.requested")],
    });
    this.root.branches.splice(
      1,
      0,
      this.branch("elseif", "accountType equals guest", [
        this.action("variable", "$journey = \"signup\""),
      ]),
    );

    this.movingId = null;
    this.enteringId = null;
    this.status = "Demo reset.";
    this.render();
  }

  render(focusId = null) {
    this.innerHTML = `
      <section class="condition-demo" aria-labelledby="condition-demo-title">
        <header class="condition-demo__topbar">
          <div class="condition-demo__title">
            <strong id="condition-demo-title">Account support dialog</strong>
            <span>Representative interaction model · not production UI</span>
          </div>
          <div class="condition-demo__toolbar">
            ${this.movingId ? '<button class="condition-demo__cancel" type="button" data-command="cancel-move">Cancel move</button>' : ""}
            <button class="condition-demo__reset" type="button" data-command="reset">Reset</button>
          </div>
        </header>
        <div class="condition-demo__canvas">
          <p class="condition-demo__hint">Add actions or nested conditions from any branch. Drag an action or a whole nested block—or choose Move for a touch and keyboard-friendly path.</p>
          ${this.renderBlock(this.root, true)}
        </div>
        <ul class="condition-demo__legend" aria-label="Action types">
          <li><i class="is-message">M</i> Message</li>
          <li><i class="is-variable">V</i> Variable assignment</li>
          <li><i class="is-event">E</i> Event</li>
          <li>Else-if branches reorder only within their condition block</li>
        </ul>
        <p class="cs-live" aria-live="polite">${this.status || ""}</p>
      </section>`;

    if (focusId) {
      requestAnimationFrame(() => {
        const target = this.querySelector(`[data-focus-id="${focusId}"]`);
        if (!target) return;
        target.focus({ preventScroll: true });
        target.scrollIntoView({
          behavior: this.reduceMotion.matches ? "auto" : "smooth",
          block: "nearest",
        });
      });
    }
  }

  renderBlock(block, isRoot = false) {
    const entering = this.enteringId === block.id ? " is-entering" : "";
    const moving = this.movingId === block.id ? " cs-moving" : "";
    const dragHandle = isRoot
      ? '<span class="cs-drag-handle"><span class="cs-grip" aria-hidden="true">••<br>••</span><span>Root condition</span></span>'
      : `<span class="cs-drag-handle" draggable="true" data-drag-kind="block" data-drag-id="${block.id}" title="Drag the whole condition block"><span class="cs-grip" aria-hidden="true">••<br>••</span><span>Condition block</span></span>`;

    return `
      <section class="cs-block${isRoot ? "" : " is-nested"}${entering}${moving}" data-focus-id="${block.id}" data-item-id="${block.id}" tabindex="-1">
        <header class="cs-block__header">
          <div class="cs-block__identity">${dragHandle}<strong>${block.label}</strong></div>
          <div class="cs-block__actions">
            ${isRoot ? "" : this.renderItemTools(block.id, "whole condition block")}
            <button class="cs-add-elseif" type="button" data-command="add-elseif" data-block-id="${block.id}">+ Else if</button>
          </div>
        </header>
        <div class="cs-branches">
          ${block.branches.map((branch) => this.renderBranch(branch, block)).join("")}
        </div>
      </section>`;
  }

  renderBranch(branch, block) {
    const isElseIf = branch.type === "elseif";
    const entering = this.enteringId === branch.id ? " is-entering" : "";
    const label = branch.type === "elseif" ? "Else if" : branch.type;
    const branchIndex = block.branches.indexOf(branch);
    const elseIfs = block.branches.filter((item) => item.type === "elseif");
    const elseIfIndex = elseIfs.indexOf(branch);
    const branchHandle = isElseIf
      ? `<span class="cs-drag-handle" draggable="true" data-drag-kind="branch" data-drag-id="${branch.id}" data-block-id="${block.id}" title="Reorder this else-if within its block"><span class="cs-grip" aria-hidden="true">••<br>••</span></span>`
      : "";

    return `
      <article class="cs-branch${entering}" data-focus-id="${branch.id}" data-branch-id="${branch.id}" tabindex="-1">
        <header class="cs-branch__header">
          <div class="cs-branch__condition">
            ${branchHandle}
            <span class="cs-branch__label">${label}</span>
            ${branch.type === "else" ? "" : `<code class="cs-expression">${branch.condition}</code>`}
          </div>
          ${isElseIf ? `<div class="cs-branch__tools">
            <button class="cs-tool cs-reorder" type="button" data-command="reorder-branch" data-branch-id="${branch.id}" data-direction="up" aria-label="Move else-if up" ${elseIfIndex === 0 ? "disabled" : ""}>↑</button>
            <button class="cs-tool cs-reorder" type="button" data-command="reorder-branch" data-branch-id="${branch.id}" data-direction="down" aria-label="Move else-if down" ${elseIfIndex === elseIfs.length - 1 ? "disabled" : ""}>↓</button>
          </div>` : ""}
        </header>
        <div class="cs-branch__body" data-branch-id="${branch.id}" data-block-id="${block.id}" data-branch-index="${branchIndex}">
          <div class="cs-items">
            ${branch.items.map((item) => item.kind === "block" ? this.renderBlock(item) : this.renderAction(item)).join("")}
          </div>
          <div class="cs-branch__footer">
            ${this.movingId
              ? `<button class="cs-move-here" type="button" data-command="move-here" data-branch-id="${branch.id}">Move here</button>`
              : `<button class="cs-add-trigger" type="button" data-command="toggle-add" data-branch-id="${branch.id}" aria-expanded="false">+ Add action</button>
                <div class="cs-add-menu" data-add-menu="${branch.id}" hidden>
                  <button type="button" data-command="add-item" data-kind="message" data-branch-id="${branch.id}"><span class="cs-action__icon is-message">M</span>Message</button>
                  <button type="button" data-command="add-item" data-kind="variable" data-branch-id="${branch.id}"><span class="cs-action__icon is-variable">V</span>Variable assignment</button>
                  <button type="button" data-command="add-item" data-kind="event" data-branch-id="${branch.id}"><span class="cs-action__icon is-event">E</span>Event</button>
                  <button type="button" data-command="add-item" data-kind="block" data-branch-id="${branch.id}"><span class="cs-action__icon is-variable">↳</span>Nested condition block</button>
                </div>`}
          </div>
        </div>
      </article>`;
  }

  renderAction(action) {
    const entering = this.enteringId === action.id ? " is-entering" : "";
    const moving = this.movingId === action.id ? " cs-moving" : "";
    const letter = action.type === "message" ? "M" : action.type === "variable" ? "V" : "E";
    return `
      <div class="cs-action is-${action.type}${entering}${moving}" data-focus-id="${action.id}" data-item-id="${action.id}" tabindex="-1">
        <div class="cs-action__content">
          <span class="cs-drag-handle" draggable="true" data-drag-kind="action" data-drag-id="${action.id}" title="Drag this action"><span class="cs-grip" aria-hidden="true">••<br>••</span></span>
          <span class="cs-action__icon" aria-hidden="true">${letter}</span>
          <span class="cs-action__copy"><span>${actionNames[action.type]}</span><code>${action.value}</code></span>
        </div>
        ${this.renderItemTools(action.id, actionNames[action.type].toLowerCase())}
      </div>`;
  }

  renderItemTools(id, label) {
    const location = this.findItem(id);
    const index = location?.index ?? 0;
    const length = location?.branch.items.length ?? 1;
    return `<div class="cs-item__tools">
      <button class="cs-tool cs-reorder" type="button" data-command="reorder-item" data-item-id="${id}" data-direction="up" aria-label="Move ${label} up" ${index === 0 ? "disabled" : ""}>↑</button>
      <button class="cs-tool cs-reorder" type="button" data-command="reorder-item" data-item-id="${id}" data-direction="down" aria-label="Move ${label} down" ${index === length - 1 ? "disabled" : ""}>↓</button>
      <button class="cs-tool" type="button" data-command="start-move" data-item-id="${id}" aria-label="Move ${label} to another branch">Move</button>
    </div>`;
  }

  handleClick(event) {
    const button = event.target.closest("button[data-command]");
    if (!button || !this.contains(button)) {
      this.closeMenus();
      return;
    }

    const command = button.dataset.command;
    if (command === "toggle-add") {
      const wasOpen = button.getAttribute("aria-expanded") === "true";
      this.closeMenus();
      button.setAttribute("aria-expanded", String(!wasOpen));
      this.querySelector(`[data-add-menu="${button.dataset.branchId}"]`).hidden = wasOpen;
      return;
    }

    this.closeMenus();
    if (command === "reset") return this.reset();
    if (command === "cancel-move") {
      this.movingId = null;
      this.status = "Move cancelled.";
      return this.render();
    }
    if (command === "add-item") return this.addItem(button.dataset.branchId, button.dataset.kind);
    if (command === "add-elseif") return this.addElseIf(button.dataset.blockId);
    if (command === "start-move") {
      this.movingId = button.dataset.itemId;
      this.status = "Choose the branch where this item should move.";
      return this.render();
    }
    if (command === "move-here") return this.moveItem(this.movingId, button.dataset.branchId, true);
    if (command === "reorder-item") return this.reorderItem(button.dataset.itemId, button.dataset.direction);
    if (command === "reorder-branch") return this.reorderBranch(button.dataset.branchId, button.dataset.direction);
  }

  handleKeydown(event) {
    if (event.key !== "Escape") return;
    const openButton = this.querySelector('[data-command="toggle-add"][aria-expanded="true"]');
    if (openButton) {
      this.closeMenus();
      openButton.focus();
    } else if (this.movingId) {
      this.movingId = null;
      this.status = "Move cancelled.";
      this.render();
    }
  }

  closeMenus() {
    this.querySelectorAll('[data-command="toggle-add"]').forEach((button) => button.setAttribute("aria-expanded", "false"));
    this.querySelectorAll("[data-add-menu]").forEach((menu) => { menu.hidden = true; });
  }

  addItem(branchId, kind) {
    const branch = this.findBranch(branchId);
    if (!branch) return;
    let item;

    if (kind === "block") {
      const conditions = ["channel equals voice", "retryCount is less than 2", "customerTier equals gold"];
      item = this.block(conditions[this.addCounts.block % conditions.length], {
        label: "Nested condition",
        ifItems: [this.action("message", "Continue this branch.")],
        elseItems: [this.action("event", "fallback.started")],
      });
    } else {
      const copy = actionCopy[kind];
      item = this.action(kind, copy[this.addCounts[kind] % copy.length]);
    }

    this.addCounts[kind] += 1;
    branch.items.push(item);
    this.enteringId = item.id;
    this.status = kind === "block" ? "Nested condition block added." : `${actionNames[kind]} added.`;
    this.render(item.id);
    this.clearEntering();
  }

  addElseIf(blockId) {
    const block = this.findBlock(blockId);
    if (!block) return;
    const branch = this.branch("elseif", "retryCount is less than 2", [
      this.action("message", "Let’s try that once more."),
    ]);
    block.branches.splice(block.branches.length - 1, 0, branch);
    this.enteringId = branch.id;
    this.status = "Else-if branch added. It stays part of this condition block.";
    this.render(branch.id);
    this.clearEntering();
  }

  clearEntering() {
    window.setTimeout(() => { this.enteringId = null; }, 260);
  }

  reorderItem(itemId, direction) {
    const location = this.findItem(itemId);
    if (!location) return;
    const nextIndex = location.index + (direction === "up" ? -1 : 1);
    if (nextIndex < 0 || nextIndex >= location.branch.items.length) return;
    const [item] = location.branch.items.splice(location.index, 1);
    location.branch.items.splice(nextIndex, 0, item);
    this.status = `${item.kind === "block" ? "Condition block" : actionNames[item.type]} reordered.`;
    this.render(itemId);
  }

  reorderBranch(branchId, direction) {
    const location = this.findBranchLocation(branchId);
    if (!location || location.branch.type !== "elseif") return;
    const elseIfs = location.block.branches.filter((branch) => branch.type === "elseif");
    const current = elseIfs.findIndex((branch) => branch.id === branchId);
    const target = current + (direction === "up" ? -1 : 1);
    if (target < 0 || target >= elseIfs.length) return;
    this.reorderElseIf(branchId, elseIfs[target].id);
  }

  reorderElseIf(sourceId, targetId) {
    const source = this.findBranchLocation(sourceId);
    const target = this.findBranchLocation(targetId);
    if (!source || !target || source.block.id !== target.block.id) return;
    if (source.branch.type !== "elseif" || target.branch.type !== "elseif") return;
    const branches = source.block.branches;
    const from = branches.findIndex((branch) => branch.id === sourceId);
    const to = branches.findIndex((branch) => branch.id === targetId);
    const [branch] = branches.splice(from, 1);
    branches.splice(to, 0, branch);
    this.status = "Else-if reordered within its condition block.";
    this.render(branch.id);
  }

  moveItem(itemId, branchId, focus = false) {
    const source = this.findItem(itemId);
    const target = this.findBranch(branchId);
    if (!source || !target || source.branch.id === target.id) {
      this.movingId = null;
      this.status = "That item is already in this branch.";
      return this.render(focus ? itemId : null);
    }
    if (source.item.kind === "block" && this.blockContainsBranch(source.item, branchId)) {
      this.status = "A condition block cannot move inside itself.";
      return this.render(source.item.id);
    }

    source.branch.items.splice(source.index, 1);
    target.items.push(source.item);
    this.movingId = null;
    this.status = source.item.kind === "block" ? "Whole condition block moved." : `${actionNames[source.item.type]} moved.`;
    this.render(focus ? itemId : null);
  }

  handleDragStart(event) {
    const handle = event.target.closest("[data-drag-kind]");
    if (!handle) return;
    this.dragData = {
      kind: handle.dataset.dragKind,
      id: handle.dataset.dragId,
      blockId: handle.dataset.blockId,
    };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", this.dragData.id);
    requestAnimationFrame(() => handle.closest(".cs-action, .cs-block, .cs-branch")?.classList.add("cs-dragging"));
  }

  handleDragOver(event) {
    if (!this.dragData) return;
    const branchTarget = event.target.closest(".cs-branch__body");
    const elseIfTarget = event.target.closest(".cs-branch[data-branch-id]");

    if (this.dragData.kind === "branch" && elseIfTarget) {
      const target = this.findBranchLocation(elseIfTarget.dataset.branchId);
      if (target?.branch.type === "elseif" && target.block.id === this.dragData.blockId) {
        event.preventDefault();
        this.clearDropTargets();
        elseIfTarget.classList.add("is-drop-target");
      }
      return;
    }

    if (branchTarget && (this.dragData.kind === "action" || this.dragData.kind === "block")) {
      const source = this.findItem(this.dragData.id);
      if (source?.item.kind === "block" && this.blockContainsBranch(source.item, branchTarget.dataset.branchId)) return;
      event.preventDefault();
      this.clearDropTargets();
      branchTarget.classList.add("is-drop-target");
    }
  }

  handleDrop(event) {
    if (!this.dragData) return;
    event.preventDefault();
    const branchTarget = event.target.closest(".cs-branch__body");
    const elseIfTarget = event.target.closest(".cs-branch[data-branch-id]");
    const drag = this.dragData;
    this.dragData = null;
    this.clearDropTargets();

    if (drag.kind === "branch" && elseIfTarget) {
      this.reorderElseIf(drag.id, elseIfTarget.dataset.branchId);
    } else if (branchTarget) {
      this.moveItem(drag.id, branchTarget.dataset.branchId);
    }
  }

  handleDragEnd() {
    this.dragData = null;
    this.clearDropTargets();
    this.querySelectorAll(".cs-dragging").forEach((item) => item.classList.remove("cs-dragging"));
  }

  clearDropTargets() {
    this.querySelectorAll(".is-drop-target").forEach((item) => item.classList.remove("is-drop-target"));
  }

  findBlock(blockId, block = this.root) {
    if (block.id === blockId) return block;
    for (const branch of block.branches) {
      for (const item of branch.items) {
        if (item.kind === "block") {
          const match = this.findBlock(blockId, item);
          if (match) return match;
        }
      }
    }
    return null;
  }

  findBranch(branchId) {
    return this.findBranchLocation(branchId)?.branch || null;
  }

  findBranchLocation(branchId, block = this.root) {
    for (const branch of block.branches) {
      if (branch.id === branchId) return { branch, block };
      for (const item of branch.items) {
        if (item.kind === "block") {
          const match = this.findBranchLocation(branchId, item);
          if (match) return match;
        }
      }
    }
    return null;
  }

  findItem(itemId, block = this.root) {
    for (const branch of block.branches) {
      const index = branch.items.findIndex((item) => item.id === itemId);
      if (index >= 0) return { item: branch.items[index], branch, block, index };
      for (const item of branch.items) {
        if (item.kind === "block") {
          const match = this.findItem(itemId, item);
          if (match) return match;
        }
      }
    }
    return null;
  }

  blockContainsBranch(block, branchId) {
    return Boolean(this.findBranchLocation(branchId, block));
  }
}

if (!customElements.get("condition-stack-demo")) {
  customElements.define("condition-stack-demo", ConditionStackDemo);
}
