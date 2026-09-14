import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Evaluate the actual module with only ESM export syntax
// adapted for the VM. All drawing, input, and lifecycle code remains intact.
const source = readFileSync(new URL("../src/scripts/field.js", import.meta.url), "utf8")
  .replaceAll("export function ", "function ");

function events() {
  const listeners = new Map();
  return {
    addEventListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    emit(name, event = {}) { for (const fn of [...(listeners.get(name) || [])]) fn(event); },
    count(name) { return listeners.get(name)?.size || 0; },
  };
}

function harness(mode = "full", reduced = false) {
  const window = Object.assign(events(), {
    innerWidth: 140, innerHeight: 96, devicePixelRatio: 1,
    matchMedia: () => ({ matches: reduced }),
  });
  const trace = { frames: [], colorReads: 0 };
  const context = {
    setTransform() {},
    clearRect() { trace.frames.push([]); },
    fillRect(...rect) { trace.frames.at(-1).push([...rect, this.globalAlpha, this.fillStyle]); },
  };
  const canvas = { style: {}, getContext: () => context };
  let currentCanvas = canvas;
  const document = Object.assign(events(), {
    documentElement: {}, body: {
      dataset: { field: mode },
      classList: new Set(),
      hasAttribute(name) { return name === "data-case-color-prototype" && this.dataset.caseColorPrototype !== undefined; },
    },
    getElementById: () => currentCanvas,
  });
  document.body.classList.contains = document.body.classList.has.bind(document.body.classList);
  let primary = "rgb(11, 77, 33)";
  const pending = new Map();
  let sequence = 0;
  const sandbox = vm.createContext({
    window, document,
    // Deterministic stagger lets paired traces isolate pointer effects.
    Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
    getComputedStyle(node) {
      if (node === canvas) { trace.colorReads++; return { color: primary }; }
      assert.equal(node, document.documentElement);
      return { getPropertyValue(name) {
        assert.equal(name, "--field-gain", "palette must come from resolved canvas color");
        return "1";
      } };
    },
    requestAnimationFrame(fn) { pending.set(++sequence, fn); return sequence; },
    cancelAnimationFrame(id) { pending.delete(id); },
  });
  vm.runInContext(source + "\nglobalThis.api = {initField,stopField,pauseField,resumeField};", sandbox);
  return {
    ...sandbox.api, window, document, canvas, pending, trace,
    setPrimary(value) { primary = value; },
    removeCanvas() { currentCanvas = null; },
    frame() {
      const callbacks = [...pending.values()]; pending.clear();
      for (const fn of callbacks) fn();
    },
  };
}

test("full mode has one loop and pointer input changes the drawn field", () => {
  const active = harness(); const idle = harness();
  for (const h of [active, idle]) {
    h.initField();
    assert.equal(h.pending.size, 1);
    assert.equal(h.window.count("pointermove"), 1);
    h.frame();
  }
  active.window.emit("pointermove", { clientX: 40, clientY: 40 });
  active.frame(); idle.frame();
  assert.notDeepEqual(active.trace.frames.at(-1), idle.trace.frames.at(-1));
  assert.equal(active.pending.size, 1);
  active.pauseField(); active.pauseField();
  assert.equal(active.pending.size, 0);
  active.initField();
  assert.equal(active.pending.size, 0, "reinit cannot unpause the existing instance");
  active.resumeField(); active.resumeField();
  assert.equal(active.pending.size, 1);
  active.stopField(); idle.stopField();
});

test("off mode paints resolved primary once, refreshes theme, and never loops", () => {
  const h = harness("off"); h.initField();
  assert.equal(h.trace.frames.length, 1);
  assert.equal(h.pending.size, 0);
  assert.equal(h.window.count("pointermove"), 0);
  assert.ok(h.trace.frames[0].every((block) => block.at(-1) === "rgb(11, 77, 33)"));
  h.setPrimary("oklch(0.7 0.15 150)");
  h.document.emit("themechange");
  assert.ok(h.trace.frames.at(-1).every((block) => block.at(-1) === "oklch(0.7 0.15 150)"));
  h.pauseField(); h.initField(); h.resumeField();
  assert.equal(h.pending.size, 0);
  assert.equal(h.document.getElementById("field"), h.canvas);
  h.stopField();
  assert.equal(h.document.count("themechange"), 0);
  assert.equal(h.window.count("resize"), 0);
});

test("homepage particles follow the active card's primary without a theme change", () => {
  const h = harness();
  h.document.body.classList.add("stack-prototype");
  h.initField();
  h.setPrimary("oklch(0.7 0.15 150)");
  h.frame();
  const frame = h.trace.frames.at(-1);
  assert.ok(frame.length > 0);
  assert.ok(frame.every((block) => block.at(-1) === "oklch(0.7 0.15 150)"));
  assert.equal(h.pending.size, 1);
  h.stopField();
});

test("reinitialization and full/off navigation retain only one instance", () => {
  const h = harness();
  for (let i = 0; i < 5; i++) {
    h.document.body.dataset.field = "full";
    h.initField(); h.initField();
    assert.equal(h.pending.size, 1);
    assert.equal(h.window.count("pointermove"), 1);
    assert.equal(h.window.count("resize"), 1);
    assert.equal(h.document.count("themechange"), 1);
    h.document.body.dataset.field = "off"; h.initField();
    assert.equal(h.pending.size, 0);
    assert.equal(h.window.count("pointermove"), 0);
    assert.equal(h.window.count("pointerleave"), 0);
    assert.equal(h.window.count("resize"), 1);
    assert.equal(h.document.count("themechange"), 1);
  }
  h.removeCanvas(); h.initField();
  assert.equal(h.pending.size, 0);
  assert.equal(h.window.count("resize"), 0);
  assert.equal(h.document.count("themechange"), 0);
});

test("reduced motion makes full mode static without pointer listeners", () => {
  const h = harness("full", true); h.initField();
  assert.equal(h.trace.frames.length, 1);
  assert.equal(h.pending.size, 0);
  assert.equal(h.window.count("pointermove"), 0);
  h.window.emit("resize");
  assert.equal(h.trace.frames.length, 2);
  h.pauseField(); h.resumeField();
  assert.equal(h.pending.size, 0);
  h.stopField();
  assert.equal(h.window.count("resize"), 0);
  assert.equal(h.document.count("themechange"), 0);
});
