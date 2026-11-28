#!/usr/bin/env node
// Linked Swiper's drag-splitter in a real browser, at phone width by touch and
// at desktop width by mouse, on kits/demos/linked-swiper.html (the open form,
// owner 2026-11-25). The jsdom tests in linked-swiper.test.mjs pin the
// arithmetic with every box stubbed; this checks what they cannot: that a
// finger on the row drag-splitter moves the list's foot and not the page (up,
// since the demo's eight rows already fit at the default height), that
// the height survives a reload, and that the column one still drags side by
// side.
//
// Touch goes through CDP's Input.dispatchTouchEvent, since Playwright's
// touchscreen only taps; Chromium turns those touches into the pointer events
// the kit listens for, with pointerType 'touch'.
//
//   npm run test:list-split

import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { resolveCdn, typeFor } from '../render/cdn.mjs';
import { repoRoot as root } from '../repo-root.mjs';
import { launch as launchChromium } from '../render/chromium.mjs';

const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); failures.push(name); }
};

const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
  try {
    const body = await readFile(path.join(root, rel));
    res.writeHead(200, { 'content-type': typeFor(rel) });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = `${origin}/lib/kits/demos/linked-swiper.html`;

const browser = await launchChromium({ args: ['--no-sandbox', '--ignore-certificate-errors'] });
const route = page => page.route('**/*', r => {
  const u = r.request().url();
  if (u.startsWith(origin)) return r.continue();
  const c = resolveCdn(u, root, null);
  if (c.kind === 'continue') return r.continue();
  if (c.kind === 'empty') return r.fulfill({ status: 200, contentType: c.contentType, body: '' });
  return r.fulfill({ status: 200, contentType: c.contentType, body: c.body });
});
const ready = page => page.waitForSelector('[data-ls="drag-splitter"].drag-splitter', { timeout: 30000 });
const read = page => page.evaluate(() => {
  const el = document.querySelector('[data-ls="drag-splitter"]');
  const list = document.getElementById('list'), card = document.getElementById('card');
  const box = e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
  return {
    axis: el.getAttribute('aria-orientation'), split: box(el), list: box(list), card: box(card),
    framed: /\brounded-lg\b/.test(list.className) || /\brounded-lg\b/.test(card.className),
    kept: localStorage.getItem('linked-swiper-demo:h'), keptW: localStorage.getItem('linked-swiper-demo'),
    scrollY: window.scrollY, display: getComputedStyle(el).display,
  };
});

try {
  // ── Phone width, by touch ─────────────────────────────────────────────────
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await phone.newPage();
  await route(page);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('linked-swiper-demo:h'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.waitForTimeout(400);

  const before = await read(page);
  ok('stacked, the drag-splitter is a row one', before.axis === 'horizontal', `aria-orientation ${before.axis}`);
  ok('and shown', before.display !== 'none', `display ${before.display}`);
  ok('the form is open: neither the list nor the detail is a box', !before.framed);
  ok('it sits between the list and the detail', before.split.top >= before.list.bottom - 1 && before.split.bottom <= before.card.top + 1,
     `list foot ${before.list.bottom}, drag-splitter ${before.split.top}-${before.split.bottom}, detail top ${before.card.top}`);

  const cdp = await phone.newCDPSession(page);
  const x = before.split.left + before.split.width / 2, y0 = before.split.top + before.split.height / 2;
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', y0);
  for (let i = 1; i <= 10; i++) await touch('touchMove', y0 - i * 9);
  await touch('touchEnd');
  await page.waitForTimeout(200);

  const after = await read(page);
  ok('a 90px touch drag up makes the list shorter', after.list.height < before.list.height - 40,
     `list ${Math.round(before.list.height)} -> ${Math.round(after.list.height)}`);
  ok('the detail takes what the list gave up', after.card.top < before.card.top - 40,
     `detail top ${Math.round(before.card.top)} -> ${Math.round(after.card.top)}`);
  ok('the page itself does not scroll under the finger', after.scrollY === 0, `scrollY ${after.scrollY}`);
  ok('the height is kept on release', Math.abs(Number(after.kept) - after.list.height) <= 1,
     `kept ${after.kept}, list ${after.list.height}`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.waitForTimeout(400);
  const reloaded = await read(page);
  ok('a reload opens on the kept height', Math.abs(reloaded.list.height - after.list.height) <= 1,
     `${Math.round(after.list.height)} before, ${Math.round(reloaded.list.height)} after`);

  await page.dispatchEvent('[data-ls="drag-splitter"]', 'dblclick');
  await page.waitForTimeout(150);
  const reset = await read(page);
  ok('a double-click goes back to the default height and forgets the kept one',
     reset.kept === null && Math.abs(reset.list.height - before.list.height) <= 1,
     `kept ${reset.kept}, list ${Math.round(reset.list.height)} vs ${Math.round(before.list.height)}`);
  await phone.close();

  // ── Desktop width, by mouse ───────────────────────────────────────────────
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dp = await desk.newPage();
  await route(dp);
  await dp.goto(url, { waitUntil: 'domcontentloaded' });
  await dp.evaluate(() => localStorage.removeItem('linked-swiper-demo'));
  await dp.reload({ waitUntil: 'domcontentloaded' });
  await ready(dp);
  await dp.waitForTimeout(400);
  const wide = await read(dp);
  ok('side by side, the drag-splitter is a column one', wide.axis === 'vertical', `aria-orientation ${wide.axis}`);
  ok('between the list and the detail', wide.split.left >= wide.list.right - 1 && wide.split.right <= wide.card.left + 1);
  const cx = wide.split.left + wide.split.width / 2, cy = wide.split.top + 120;
  await dp.mouse.move(cx, cy);
  await dp.mouse.down();
  await dp.mouse.move(cx + 120, cy, { steps: 10 });
  await dp.mouse.up();
  await dp.waitForTimeout(150);
  const wider = await read(dp);
  ok('a drag right widens the list', wider.list.width > wide.list.width + 80,
     `list ${Math.round(wide.list.width)} -> ${Math.round(wider.list.width)}`);
  ok('and keeps its width', Math.abs(Number(wider.keptW) - wider.list.width) <= 1, `kept ${wider.keptW}`);
  await desk.close();
} finally {
  await browser.close();
  server.close();
}

console.log(failures.length ? `\n${failures.length} failed` : '\nall passed');
process.exit(failures.length ? 1 : 0);
