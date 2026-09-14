import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/scripts/prototype-card-stack.js', import.meta.url), 'utf8');

// Exercise the actual event listeners. Animation promises deliberately remain
// pending, so navigation cannot accidentally rely on the visual swap finishing.
function harness({ reduced = false } = {}) {
  class Node {
    constructor(tag = 'div') {
      this.tag = tag;
      this.listeners = new Map();
      this.dataset = {};
      this.style = { setProperty() {} };
      this.classList = { contains: () => true, add() {} };
      this.isConnected = true;
      this.isContentEditable = false;
    }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    }
    emit(type, event) { this.listeners.get(type)?.forEach(listener => listener(event)); }
    closest(selector) { return selector.split(',').includes(this.tag) ? this : null; }
    contains() { return false; }
    setAttribute() {}
    removeAttribute() {}
    toggleAttribute() {}
    append() {}
    remove() { this.isConnected = false; }
    focus() {}
    animate() { return { finished: new Promise(() => {}), cancel() {} }; }
  }
  const paths = ['verse-design-system', 'microsoft', 'mix-dialog', 'dragon-drive'];
  const cards = paths.map(path => {
    const node = new Node();
    node.innerHTML = path;
    node.querySelector = () => ({ href: `https://portfolio.test/work/${path}/` });
    return node;
  });
  const picks = paths.map((name, i) => Object.assign(new Node('button'), { dataset: { name, casePick: String(i) } }));
  const toggle = Object.assign(new Node('input'), { checked: true });
  const elements = new Map([
    ['.deck', new Node()], ['.stack-sizer', new Node()], ['.stack-tabs', new Node()],
    ['.stack-help', new Node()], ['[data-shortcuts-toggle]', toggle],
    ['preview', new Node('article')], ['stack-count', new Node()], ['stack-status', new Node()],
  ]);
  const body = new Node('body');
  const document = Object.assign(new Node(), {
    body, documentElement: new Node('html'), activeElement: body,
    querySelector: selector => elements.get(selector),
    querySelectorAll: selector => selector === '.stack-sizer .deck-card' ? cards : selector === '[data-case-pick]' ? picks : [],
    getElementById: id => elements.get(id),
    createElement: tag => new Node(tag),
  });
  const navigations = [];
  const window = Object.assign(new Node(), { location: { assign: href => navigations.push(href) } });
  vm.runInNewContext(source, {
    document, window, Element: Node, AbortController,
    matchMedia: query => Object.assign(new Node(), { matches: query.includes('reduced-motion') ? reduced : false }),
    getComputedStyle: () => ({ transform: 'none', opacity: '1', zIndex: '5', transformOrigin: 'center',
      getPropertyValue: name => name === '--stack-swap-duration' ? '480ms' : 'ease' }),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  });
  document.emit('astro:page-load');
  return {
    navigations, toggle, Node, picks,
    key(key, overrides = {}) {
      const event = { key, target: body, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, ...overrides };
      window.emit('keydown', event);
      return event;
    },
    clickPick(index) { picks[index].emit('click', {}); },
  };
}

test('2 then Enter opens Microsoft without waiting for its animation', () => {
  const h = harness();
  h.key('2');
  assert.equal(h.key('Enter').defaultPrevented, true);
  assert.deepEqual(h.navigations, ['https://portfolio.test/work/microsoft/']);
});

test('Enter follows the most recent interrupted selection and selector click', () => {
  const h = harness();
  h.key('2'); h.key('3'); h.key('4'); h.key('Enter');
  h.clickPick(2); h.key('Enter');
  assert.deepEqual(h.navigations, [
    'https://portfolio.test/work/dragon-drive/',
    'https://portfolio.test/work/mix-dialog/',
  ]);
});

test('Enter opens the active card initially and in reduced motion', () => {
  const h = harness({ reduced: true });
  h.key('Enter'); h.key('2'); h.key('Enter');
  assert.deepEqual(h.navigations, [
    'https://portfolio.test/work/verse-design-system/',
    'https://portfolio.test/work/microsoft/',
  ]);
});

test('native controls, editable text, and disabled shortcuts retain Enter', () => {
  const h = harness();
  for (const tag of ['a', 'button', 'summary', 'input', 'textarea', 'select', '[role="textbox"]', '[role="button"]', '[role="link"]']) {
    assert.equal(h.key('Enter', { target: new h.Node(tag) }).defaultPrevented, false, tag);
  }
  const editable = Object.assign(new h.Node(), { isContentEditable: true });
  assert.equal(h.key('Enter', { target: editable }).defaultPrevented, false);
  h.toggle.checked = false;
  assert.equal(h.key('Enter').defaultPrevented, false);
  assert.deepEqual(h.navigations, []);
});

test('modified, repeating, composing, and already handled Enter do not navigate', () => {
  const h = harness();
  for (const flag of ['metaKey', 'ctrlKey', 'altKey', 'shiftKey', 'repeat', 'isComposing', 'defaultPrevented']) {
    h.key('Enter', { [flag]: true });
  }
  assert.deepEqual(h.navigations, []);
});
