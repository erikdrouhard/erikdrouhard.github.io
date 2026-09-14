#!/usr/bin/env node
/** Mobile behavior gate using Chromium's real touch input pipeline. No synthetic
 * PointerEvents: browser pan arbitration, pointercancel, and trusted taps matter.
 * Run: node scripts/check-card-stack-touch.mjs [--url http://127.0.0.1:4321]
 * Use --match <scenario-name> to run a targeted subset at all three widths.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const widths = [320, 360, 390];
const matchIndex = process.argv.indexOf('--match');
const scenarioFilter = matchIndex === -1 ? null : process.argv[matchIndex + 1];
if (matchIndex !== -1 && !scenarioFilter) throw Error('--match needs a scenario name');
const reportDir = mkdtempSync(join(tmpdir(), 'portfolio-card-touch-'));
const report = { startedAt: new Date().toISOString(), widths, checks: [] };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let server, browser, base, serverOutput = '';

async function origin() {
  const args = process.argv.slice(2);
  const index = args.indexOf('--url');
  if (index !== -1) {
    assert(args[index + 1], '--url requires an origin');
    return new URL(args[index + 1]).origin;
  }
  const socket = createServer();
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolve);
  });
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const address = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [join(root, 'node_modules/astro/astro.js'), 'dev', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => { serverOutput += data; });
  server.stderr.on('data', data => { serverOutput += data; });
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw Error(serverOutput);
    try {
      const response = await fetch(address, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return address;
    } catch { /* Startup is not ready yet. */ }
    await delay(250);
  }
  throw Error(`Astro did not become ready. ${serverOutput}`);
}

async function ready(page) {
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { response = await page.goto(base + '/', { waitUntil: 'networkidle' }); break; }
    catch (error) {
      if (!error.message.includes('ERR_CONNECTION_REFUSED') || attempt === 2) throw error;
      await delay(300);
    }
  }
  assert(response?.ok(), `Homepage HTTP ${response?.status()}`);
  await page.locator('body.stack-ready').waitFor();
  await page.evaluate(() => {
    window.__touchTrace = [];
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture']) {
      document.addEventListener(type, event => window.__touchTrace.push({
        type, trusted: event.isTrusted, pointerType: event.pointerType,
        x: event.clientX, y: event.clientY, time: event.timeStamp, target: event.target.tagName,
      }), { capture: true });
    }
    return document.fonts.ready;
  });
}

async function selected(page) {
  return Number(await page.locator('#preview').getAttribute('data-case-index'));
}

async function settled(page, index) {
  await page.waitForFunction(expected => {
    const card = document.querySelector('#preview');
    return Number(card?.dataset.caseIndex) === expected &&
      getComputedStyle(card).visibility === 'visible' &&
      !document.querySelector('.motion-layer, [data-dragging], [data-color-dragging]');
  }, index, { timeout: 3500 });
  assert.equal(await page.locator('[data-case-pick][aria-pressed="true"]').count(), 1);
  assert.equal(await page.locator('[data-case-pick][aria-pressed="true"]').getAttribute('data-case-pick'), String(index));
}

async function cardPoint(page) {
  await page.locator('#preview').scrollIntoViewIfNeeded();
  // Make scrolling immediate, independent of CSS smooth scrolling, and leave
  // room below the finger for both horizontal and vertical gestures.
  await page.evaluate(() => {
    const rect = document.querySelector('#preview').getBoundingClientRect();
    window.scrollBy({ top: rect.top - 100, behavior: 'instant' });
  });
  const box = await page.locator('#preview').boundingBox();
  assert(box && box.width > 180, 'Card must be usable on the narrow viewport');
  return { x: box.x + box.width / 2, y: Math.max(100, box.y + 110) };
}

async function gesture(page, cdp, { dx = 0, dy = 0, steps = 4, interval = 12, hold = 0, cancel = false, fromLink = false, secondFinger = false, startAt = null } = {}) {
  let start = startAt ?? await cardPoint(page);
  if (fromLink) {
    const link = page.locator('#preview .stack-read');
    await link.scrollIntoViewIfNeeded();
    const rect = await link.boundingBox();
    start = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const point = (x, y) => ({ x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 });
  // Device sample timestamps describe the gesture, independently of CDP's
  // host/renderer round-trip latency (which otherwise turns a flick into a drag).
  let timestamp = Date.now() / 1000;
  const send = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints, timestamp });
  await send('touchStart', [point(start.x, start.y)]);
  for (let step = 1; step <= steps; step++) {
    await delay(interval);
    timestamp += interval / 1000;
    await send('touchMove', [point(start.x + dx * step / steps, start.y + dy * step / steps)]);
  }
  if (secondFinger) {
    timestamp += .001;
    await send('touchStart', [point(start.x + dx, start.y + dy), { ...point(start.x + dx - 30, start.y + dy + 40), id: 2 }]);
    await delay(30);
  }
  if (hold) await delay(hold);
  timestamp += (hold + 1) / 1000;
  await send(cancel ? 'touchCancel' : 'touchEnd', []);
  return { start, scrollBefore, trace: await page.evaluate(() => window.__touchTrace) };
}

async function tapPick(page, index) {
  const button = page.locator(`[data-case-pick="${index}"]`);
  await button.scrollIntoViewIfNeeded();
  await button.tap();
  await settled(page, index);
}

async function checkNavigation(page, cdp) {
  const data = await page.locator('.stack-tabs').evaluate(nav => {
    const navStyle = getComputedStyle(nav);
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      localScroll: ['auto', 'scroll'].includes(navStyle.overflowX),
      navWidth: nav.clientWidth,
      navScrollWidth: nav.scrollWidth,
      buttons: [...nav.querySelectorAll('button')].map(button => {
        const style = getComputedStyle(button), rect = button.getBoundingClientRect();
        // Check each word's actual text rectangles; a natural break between
        // “Dragon” and “Drive” is different from splitting “Microsoft”.
        const words = [];
        const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          for (const match of node.textContent.matchAll(/\S+/g)) {
            const range = document.createRange();
            range.setStart(node, match.index);
            range.setEnd(node, match.index + match[0].length);
            words.push({ text: match[0], rects: [...range.getClientRects()].map(r => ({ x: r.x, right: r.right, y: r.y })) });
          }
        }
        return { name: button.dataset.name, fontSize: style.fontSize, width: rect.width, height: rect.height,
          left: rect.left, right: rect.right, words };
      }),
    };
  });
  assert(data.documentWidth <= data.viewport + 1, `Document overflows horizontally: ${JSON.stringify(data)}`);
  assert(data.navScrollWidth <= data.navWidth + 1 || data.localScroll, 'Overflowing nav must scroll locally');
  assert.equal(data.buttons.length, 4);
  for (const button of data.buttons) {
    assert.equal(button.fontSize, '12px', `${button.name} label role`);
    assert(button.width >= 44 && button.height >= 44, `${button.name} needs a 44px touch target`);
    for (const word of button.words) {
      assert(new Set(word.rects.map(r => Math.round(r.y))).size <= 1, `${button.name} splits the word “${word.text}”`);
      assert(word.rects.every(r => r.x >= button.left - 1 && r.right <= button.right + 1), `${word.text} escapes its button`);
    }
  }
  if (data.navScrollWidth > data.navWidth + 1) {
    const nav = page.locator('.stack-tabs');
    await nav.scrollIntoViewIfNeeded();
    const rect = await nav.boundingBox();
    await gesture(page, cdp, { dx: -100, steps: 8, interval: 20, startAt: { x: rect.x + rect.width - 20, y: rect.y + rect.height / 2 } });
    await page.waitForFunction(() => document.querySelector('.stack-tabs').scrollLeft > 10);
    assert.equal(await page.evaluate(() => window.scrollX), 0, 'Nav swipe must not pan the page horizontally');
    data.nativeScrollLeft = await nav.evaluate(element => element.scrollLeft);
  }
  // Every case is reachable by a real tap, including items in a scrolling rail.
  for (let index = 1; index < 4; index++) await tapPick(page, index);
  await tapPick(page, 0);
  return data;
}

async function run(context, width, name, test) {
  if (scenarioFilter && !name.includes(scenarioFilter)) return;
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const result = { width, name, passed: false };
  try {
    await ready(page);
    result.evidence = await test(page, cdp);
    if (name === 'navigation') {
      await page.locator('.stack-tabs').scrollIntoViewIfNeeded();
      result.screenshot = join(reportDir, `${width}-${name}.png`);
      await page.screenshot({ path: result.screenshot });
    }
    result.passed = true;
    console.log(`PASS ${width}px ${name}`);
  } catch (error) {
    result.error = error.message;
    result.trace = await page.evaluate(() => window.__touchTrace).catch(() => []);
    result.screenshot = join(reportDir, `${width}-${name}.png`);
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {});
    console.error(`FAIL ${width}px ${name}: ${error.message}`);
  } finally {
    report.checks.push(result);
    writeFileSync(join(reportDir, 'results.json'), JSON.stringify(report, null, 2));
    await page.close();
  }
}

try {
  base = await origin();
  report.base = base;
  browser = await chromium.launch();
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await run(context, width, 'navigation', checkNavigation);
    for (const direction of [-1, 1]) {
      const side = direction < 0 ? 'left' : 'right';
      await run(context, width, `slow-drag-${side}`, async (page, cdp) => {
        const initial = await selected(page);
        const evidence = await gesture(page, cdp, { dx: direction * 120, steps: 10, interval: 60 });
        assert(evidence.trace.some(e => e.type === 'pointermove' && e.trusted && e.pointerType === 'touch'), 'Missing trusted browser touch movement');
        await settled(page, (initial + 1) % 4);
        return evidence;
      });
      await run(context, width, `quick-flick-${side}`, async (page, cdp) => {
        const initial = await selected(page);
        const evidence = await gesture(page, cdp, { dx: direction * 45, steps: 3, interval: 12 });
        const samples = evidence.trace.filter(e => ['pointerdown', 'pointerup'].includes(e.type));
        assert.equal(samples.length, 2, 'Flick must have a trusted down/up pair');
        assert(samples[1].time - samples[0].time <= 70, 'Input fixture did not generate a quick flick');
        await settled(page, (initial + 1) % 4);
        return evidence;
      });
    }
    await run(context, width, 'consecutive-flicks', async (page, cdp) => {
      const initial = await selected(page);
      const first = await gesture(page, cdp, { dx: -45, steps: 3, interval: 12 });
      assert(await page.locator('.motion-layer').count() > 0, 'Second gesture must begin during the first transition');
      // Keep the finger over the deck while #preview is hidden during settling.
      const second = await gesture(page, cdp, { dx: 45, steps: 3, interval: 12, startAt: first.start });
      await settled(page, (initial + 2) % 4);
      return { first, second };
    });
    await run(context, width, 'paused-short-drag', async (page, cdp) => {
      const initial = await selected(page);
      const evidence = await gesture(page, cdp, { dx: 45, steps: 3, interval: 12, hold: 250 });
      // Let any erroneous release commit finish before asserting no switch.
      await delay(500);
      await settled(page, initial);
      await tapPick(page, (initial + 1) % 4);
      return evidence;
    });
    await run(context, width, 'vertical-native-scroll', async (page, cdp) => {
      const initial = await selected(page);
      const evidence = await gesture(page, cdp, { dy: -100, steps: 8, interval: 25 });
      await delay(500);
      await settled(page, initial);
      const scrollAfter = await page.evaluate(() => window.scrollY);
      assert(scrollAfter > evidence.scrollBefore + 25, `Vertical touch must scroll: ${evidence.scrollBefore} → ${scrollAfter}`);
      assert(evidence.trace.some(e => e.type === 'pointercancel' && e.trusted), 'Browser must take over the native vertical pan');
      await tapPick(page, (initial + 1) % 4);
      return { ...evidence, scrollAfter };
    });
    await run(context, width, 'touch-cancel-recovery', async (page, cdp) => {
      const initial = await selected(page);
      const evidence = await gesture(page, cdp, { dx: 100, steps: 6, interval: 20, cancel: true });
      await delay(500);
      await settled(page, initial);
      assert(evidence.trace.some(e => e.type === 'pointercancel' && e.trusted), 'Missing real touch cancellation');
      await tapPick(page, (initial + 1) % 4);
      return evidence;
    });
    await run(context, width, 'case-link-drag-no-navigation', async (page, cdp) => {
      const initial = await selected(page);
      const evidence = await gesture(page, cdp, { dx: 100, steps: 8, interval: 25, fromLink: true });
      await delay(500);
      assert.equal(new URL(page.url()).pathname, '/', 'Dragging the CTA must not activate its link');
      await settled(page, (initial + 1) % 4);
      return evidence;
    });
    await run(context, width, 'second-finger-cancels', async (page, cdp) => {
      const initial = await selected(page);
      const evidence = await gesture(page, cdp, { dx: 80, steps: 6, interval: 20, secondFinger: true });
      await delay(500);
      await settled(page, initial);
      await tapPick(page, (initial + 1) % 4);
      return evidence;
    });
    await run(context, width, 'cancel-then-mouse-link', async (page, cdp) => {
      const initial = await selected(page);
      const evidence = await gesture(page, cdp, { dx: 100, steps: 6, interval: 20, cancel: true });
      await delay(500);
      await settled(page, initial);
      const link = page.locator('#preview .stack-read');
      const href = await link.getAttribute('href');
      await link.scrollIntoViewIfNeeded();
      const rect = await link.boundingBox();
      // A hybrid device may switch from touch to trackpad/mouse immediately.
      await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await page.waitForURL(new URL(href, base).href);
      return { ...evidence, destination: page.url() };
    });
    await run(context, width, 'case-link-tap', async page => {
      const link = page.locator('#preview .stack-read');
      await link.scrollIntoViewIfNeeded();
      const rect = await link.boundingBox();
      assert(rect.width >= 44 && rect.height >= 44, 'Case link needs a 44px tap target');
      const href = await link.getAttribute('href');
      await link.tap();
      await page.waitForURL(new URL(href, base).href);
      return { destination: page.url(), target: rect };
    });
    await context.close();
    const reduced = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await run(reduced, width, 'reduced-motion-taps', async page => {
      await tapPick(page, 2);
      const animationCount = await page.locator('.deck').evaluate(deck => deck.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length);
      assert.equal(animationCount, 0, 'Reduced-motion selection must not animate cards');
      const link = page.locator('#preview .stack-read');
      const href = await link.getAttribute('href');
      await link.tap();
      await page.waitForURL(new URL(href, base).href);
      return { destination: page.url(), animationCount };
    });
    await reduced.close();
  }
  assert(report.checks.length > 0, 'No scenarios matched the requested filter');
  const failures = report.checks.filter(check => !check.passed).length;
  console.log(`\nCard touch: ${failures ? 'FAIL' : 'PASS'} — ${report.checks.length} scenarios; ${failures} failures.`);
  process.exitCode = failures ? 1 : 0;
} catch (error) {
  report.harnessError = error.message;
  console.error('Touch harness failed:', error.message);
  process.exitCode = 2;
} finally {
  writeFileSync(join(reportDir, 'results.json'), JSON.stringify(report, null, 2));
  console.log(`Evidence: ${join(reportDir, 'results.json')}`);
  await browser?.close();
  server?.kill();
}
