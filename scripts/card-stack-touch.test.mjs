import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/scripts/prototype-card-stack.js', import.meta.url), 'utf8');

// Exercise the actual pointer listeners and controllable animation completion.
// Native scrolling/pinch and hit testing are covered separately in the browser.
function harness() {
 const jobs = [], frames = new Map();
 let frameId = 0;
 class Node {
  constructor(tag = 'div') {
   this.tag = tag; this.listeners = new Map(); this.dataset = {}; this.attributes = {};
   this.style = { setProperty() {} }; this.children = []; this.captures = new Set();
   this.classList = { contains: () => true, add() {} }; this.isConnected = true;
  }
  addEventListener(type, fn) { const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); }
  emit(type, e) { this.listeners.get(type)?.forEach(fn => fn(e)); }
  closest(selector) { return selector.split(',').includes(this.tag) ? this : null; }
  contains() { return false; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; if(name === 'data-dragging') delete this.dataset.dragging; }
  toggleAttribute() {}
  append(node) { this.children.push(node); }
  remove() { this.isConnected = false; }
  focus() {}
  getBoundingClientRect() { return { width: 340, height: 340, left: 0, right: 340 }; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
  animate() { let finish; const finished = new Promise(resolve => { finish = resolve; }); jobs.push(finish); return { finished, cancel: finish }; }
 }
 const paths = ['verse-design-system', 'microsoft', 'mix-dialog', 'dragon-drive'];
 const cards = paths.map(path => Object.assign(new Node(), { innerHTML: path, querySelector: () => ({ href: path }) }));
 const picks = paths.map((name, i) => Object.assign(new Node('button'), { dataset: { name, casePick: String(i) } }));
 const elements = new Map(['.deck', '.stack-sizer', '.stack-tabs', '.stack-help', 'preview', 'stack-count', 'stack-status'].map(id => [id, new Node()]));
 elements.set('[data-shortcuts-toggle]', Object.assign(new Node('input'), { checked: true }));
 const deck = elements.get('.deck'), preview = elements.get('preview'), body = new Node('body');
 const document = Object.assign(new Node(), {
  body, documentElement: new Node('html'), activeElement: body,
  querySelector: selector => elements.get(selector),
  querySelectorAll: selector => selector === '.stack-sizer .deck-card' ? cards : selector === '[data-case-pick]' ? picks : [],
  getElementById: id => elements.get(id), createElement: tag => new Node(tag),
 });
 const window = new Node(), media = new Map();
 vm.runInNewContext(source, {
  document, window, Element: Node, AbortController,
  matchMedia: query => { const node = Object.assign(new Node(), { matches: false }); media.set(query, node); return node; },
  getComputedStyle: node => ({ transform: node.style.transform || 'none', opacity: node.style.opacity ?? '1', zIndex: '5', transformOrigin: 'center',
   getPropertyValue: name => name === '--stack-swap-duration' ? '480ms' : 'ease' }),
  requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame: id => frames.delete(id),
 });
 document.emit('astro:page-load');
 function flushFrames() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); }
 return {
  deck, preview, Node, picks, document,
  pointer(type, x, y, time, overrides = {}) {
   const e = { clientX: x, clientY: y, timeStamp: time, pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0,
    target: deck, cancelable: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...overrides };
   if(type === 'pointerdown') { window.emit(type, e); deck.emit(type, e); }
   else window.emit(type, e);
   flushFrames(); return e;
  },
  async finish() { jobs.splice(0).forEach(fn => fn()); for(let i = 0; i < 5; i++) await Promise.resolve(); flushFrames(); },
  cancel(kind) { window.emit(kind, {}); },
  loseCapture(target, pointerId = 1) { deck.emit('lostpointercapture', { target, pointerId }); },
  reduced() { const node = media.get('(prefers-reduced-motion: reduce)'); node.matches = true; node.emit('change', {}); },
  click(detail = 1) { const e = { detail, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} }; deck.emit('click', e); return e; },
 };
}

test('a short quick touch flick commits in either direction, unlike a slow short drag', async () => {
 for(const direction of [-1, 1]) {
  const h = harness();
  h.pointer('pointerdown', 150, 100, 0);
  h.pointer('pointermove', 150 + direction * 45, 100, 40);
  h.pointer('pointerup', 150 + direction * 45, 100, 60);
  await h.finish(); assert.equal(h.preview.dataset.caseIndex, 1);
 }
 const h = harness();
 h.pointer('pointerdown', 150, 100, 0); h.pointer('pointermove', 195, 100, 250); h.pointer('pointerup', 195, 100, 500);
 await h.finish(); assert.equal(h.preview.dataset.caseIndex, 0);
});

test('holding a fast drag before release discards stale velocity', async () => {
 const h = harness();
 h.pointer('pointerdown', 150, 100, 0); h.pointer('pointermove', 195, 100, 40); h.pointer('pointerup', 195, 100, 300);
 await h.finish(); assert.equal(h.preview.dataset.caseIndex, 0);
});

test('a deliberate long slow drag commits, including final pointerup movement', async () => {
 const h = harness();
 h.pointer('pointerdown', 100, 100, 0); h.pointer('pointermove', 130, 100, 200); h.pointer('pointerup', 220, 100, 600);
 await h.finish(); assert.equal(h.preview.dataset.caseIndex, 1);
});

test('vertical intent never captures or prevents the scroll pointer', async () => {
 const h = harness();
 h.pointer('pointerdown', 150, 100, 0); assert.equal(h.deck.captures.size, 0);
 const move = h.pointer('pointermove', 154, 160, 50);
 assert.equal(move.defaultPrevented, false); assert.equal(h.deck.captures.size, 0);
 h.pointer('pointerup', 154, 160, 80); await h.finish(); assert.equal(h.preview.dataset.caseIndex, 0);
});

test('a second finger, pointercancel, blur, and resize cancel without leaving the deck stuck', async () => {
 for(const reason of ['second-finger', 'pointercancel', 'blur', 'resize']) {
  const h = harness();
  h.pointer('pointerdown', 100, 100, 0); h.pointer('pointermove', 240, 100, 100);
  if(reason === 'second-finger') {
   h.pointer('pointerdown', 230, 140, 110, { pointerId: 2, isPrimary: false });
   h.pointer('pointerup', 230, 140, 120, { pointerId: 2, isPrimary: false });
   h.pointer('pointerup', 240, 100, 130);
  } else if(reason === 'pointercancel') h.pointer('pointercancel', 240, 100, 110);
  else h.cancel(reason);
  await h.finish(); assert.equal(h.preview.dataset.caseIndex, 0, reason); assert.equal(h.deck.captures.size, 0, reason);
  h.pointer('pointerdown', 100, 100, 400); h.pointer('pointermove', 145, 100, 440); h.pointer('pointerup', 145, 100, 450);
  await h.finish(); assert.equal(h.preview.dataset.caseIndex, 1, reason);
 }
});

test('a second flick interrupts the first settling animation and reaches the next card', async () => {
 const h = harness();
 h.pointer('pointerdown', 100, 100, 0); h.pointer('pointermove', 145, 100, 40); h.pointer('pointerup', 145, 100, 50);
 h.pointer('pointerdown', 100, 100, 80); h.pointer('pointermove', 145, 100, 120); h.pointer('pointerup', 145, 100, 130);
 await h.finish(); assert.equal(h.preview.dataset.caseIndex, 2); assert.equal(h.deck.captures.size, 0);
});

test('CTA taps remain native, while a CTA swipe suppresses its compatibility click', async () => {
 const h = harness(), target = new h.Node('a');
 h.pointer('pointerdown', 100, 100, 0, { target }); h.pointer('pointerup', 100, 100, 60, { target });
 assert.equal(h.click().defaultPrevented, false);
 h.pointer('pointerdown', 100, 100, 100, { target }); h.pointer('pointermove', 145, 100, 140, { target }); h.pointer('pointerup', 145, 100, 150, { target });
 assert.equal(h.click().defaultPrevented, true); await h.finish();
 assert.equal(h.click(0).defaultPrevented, false);
});

test('reduced motion cancels an in-progress gesture and retains native selection', async () => {
 const h = harness();
 h.pointer('pointerdown', 100, 100, 0); h.pointer('pointermove', 145, 100, 40); h.reduced();
 await h.finish(); assert.equal(h.preview.dataset.caseIndex, 0); assert.equal(h.deck.captures.size, 0);
 h.picks[1].emit('click', {}); assert.equal(h.preview.dataset.caseIndex, 1);
});


test('bubbling implicit touch-capture transfer does not cancel the active drag', async () => {
 const h = harness();
 h.pointer('pointerdown', 100, 100, 0); h.pointer('pointermove', 145, 100, 40);
 h.loseCapture(new h.Node('h2'));
 h.pointer('pointerup', 145, 100, 60); await h.finish();
 assert.equal(h.preview.dataset.caseIndex, 1);
});

test('losing the deck capture itself cancels the active drag', async () => {
 const h = harness();
 h.pointer('pointerdown', 100, 100, 0); h.pointer('pointermove', 245, 100, 40);
 h.deck.captures.delete(1); h.loseCapture(h.deck); await h.finish();
 assert.equal(h.preview.dataset.caseIndex, 0);
});


test('a canceled touch does not swallow the next native mouse click on the CTA', async () => {
 const h = harness(), target = new h.Node('a');
 h.pointer('pointerdown', 100, 100, 0); h.pointer('pointermove', 145, 100, 40);
 h.pointer('pointercancel', 145, 100, 60); await h.finish();
 h.pointer('pointerdown', 100, 100, 400, { target, pointerType: 'mouse' });
 h.pointer('pointerup', 100, 100, 450, { target, pointerType: 'mouse' });
 assert.equal(h.click().defaultPrevented, false);
});
