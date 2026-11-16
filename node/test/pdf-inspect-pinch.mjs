#!/usr/bin/env node
// Pinch-zoom on the workbench's page stage.
//
//   node node/test/pdf-inspect-pinch.mjs
//
// `pages/pdf-inspect.html` fits a page to the width on a phone, which draws a
// US Letter page at about 0.58 and leaves its text unreadable. The stage keeps
// `touch-none` because a one-finger drag there is a selection, and that also
// switches off the browser's own pinch. So the page tells the gestures apart
// by pointer count: one finger selects, two pinch. During a pinch the stage is
// scaled by a CSS transform; on lift the page is drawn again at the new scale.
//
// Claims, all driven by real touch input through the DevTools protocol:
//   1. one finger still selects, and leaves the scale alone
//   2. during a spread, the canvas and the overlay scale together
//   3. on lift the page re-renders at the pinched scale, and the zoom select
//      shows that scale rather than going blank
//   4. the page point under the fingers stays under them
//   5. the overlay's text boxes sit on the ink at the new scale
//   6. the finger left behind after a pinch does not start a selection
//   7. a zoomed page's left edge can be scrolled to
//   8. a pinch in clamps at the page's floor
//
// Exits nonzero on any failure. Not part of `npm test` (needs a browser).

import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { resolveCdn, typeFor } from '../render/cdn.mjs';
import { repoRoot as root } from '../repo-root.mjs';
import { launch as launchChromium } from '../render/chromium.mjs';

const REPO = 'mehrlander/web-tools';
const FIXTURE = 'docs/fixtures/inspect-pinch.pdf';   // never on disk; intercepted below

const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); failures.push(name); }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// One Letter page with a few lines of text, so a selection has something to
// pick and the ink check has glyphs to find.
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const pg = doc.addPage([612, 792]);
pg.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(1, 1, 1) });
for (let i = 0; i < 6; i++) {
  pg.drawText(`Line ${i + 1} amount ${(i + 1) * 1000}`, { x: 72, y: 700 - i * 40, size: 18, font, color: rgb(0, 0, 0) });
}
const BYTES = Buffer.from(await doc.save());

const vendored = {
  '/vendor/pdf.min.js': path.join(root, 'node_modules/pdfjs-dist/build/pdf.min.js'),
  '/vendor/pdf.worker.min.js': path.join(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.js'),
};
const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  if (vendored[rel]) {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    return res.end(readFileSync(vendored[rel]));
  }
  try {
    const body = await readFile(path.join(root, rel.replace(/^\/+/, '')));
    res.writeHead(200, { 'content-type': typeFor(rel) });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const kitSource = (await readFile(path.join(root, 'lib/kits/pdf.js'), 'utf8'))
  .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/pdfjs-dist@[\d.]+\/build\/pdf\.min\.js/, `${origin}/vendor/pdf.min.js`)
  .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/pdfjs-dist@[\d.]+\/build\/pdf\.worker\.min\.js/, `${origin}/vendor/pdf.worker.min.js`);
const contentsJson = (buf) => JSON.stringify({
  content: buf.toString('base64'), encoding: 'base64',
  size: buf.length, sha: 'x'.repeat(40), html_url: 'https://example.invalid',
});

const browser = await launchChromium({ args: ['--no-sandbox', '--ignore-certificate-errors'] });
// A phone: fit-to-width is the case the task was filed from.
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await page.route('**/*', route => {
  const url = route.request().url();
  if (url.startsWith(origin)) return route.continue();
  const api = `https://api.github.com/repos/${REPO}/contents/`;
  const want = decodeURIComponent(url.split('?')[0]);
  if (want.startsWith(api + FIXTURE)) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: contentsJson(BYTES) });
  }
  if (url.startsWith(api + 'lib/kits/pdf.js')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: contentsJson(Buffer.from(kitSource)) });
  }
  const r = resolveCdn(url, root, null);
  if (r.kind === 'continue') return route.continue();
  if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
  return route.fulfill({ status: 200, contentType: r.contentType, body: r.body });
});
page.on('pageerror', e => { console.log(`  [pageerror] ${e.message}`); failures.push('pageerror'); });

const cdp = await ctx.newCDPSession(page);
// The protocol takes the whole set of fingers down after each step and works
// out which one moved, landed or lifted, so every finger keeps its id and a
// lift is a touchMove without it. Points are [x, y] or [x, y, id].
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {
  type, touchPoints: pts.map(([x, y, id], i) => ({ x, y, id: id ?? i })),
});
const frame = () => page.waitForTimeout(40);
// Two fingers from a spread of d0 to d1 about (cx, cy), drifting the midpoint
// by (dx, dy) on the way, then lifted one at a time.
const pinch = async (cx, cy, d0, d1, { dx = 0, dy = 0, steps = 8, hold = false } = {}) => {
  const at = (t) => {
    const d = d0 + (d1 - d0) * t, x = cx + dx * t, y = cy + dy * t;
    return [[x - d / 2, y], [x + d / 2, y]];
  };
  await touch('touchStart', [at(0)[0]]); await frame();
  await touch('touchStart', at(0)); await frame();
  for (let i = 1; i <= steps; i++) { await touch('touchMove', at(i / steps)); await frame(); }
  const mid = await state();
  const end = at(1);
  await touch('touchMove', [end[0]]); await frame();
  if (!hold) { await touch('touchEnd', []); await frame(); }
  return { mid, end };
};

const state = () => page.evaluate(() => {
  const d = window.Alpine.$data(document.querySelector('[x-data]'));
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('page');
  const ov = document.getElementById('ov');
  const host = document.getElementById('scroll');
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; };
  const sel = document.querySelector('select[x-model="scaleMode"]');
  return {
    scale: d.scale, scaleMode: d.scaleMode, sel: d.sel.length, W: d.W, H: d.H,
    transform: stage.style.transform, canvas: box(canvas), ov: box(ov), host: box(host),
    canvasW: canvas.width, viewBox: ov.getAttribute('viewBox'),
    selectValue: sel?.value, selectText: sel?.selectedOptions[0]?.textContent || '',
    scrollLeft: host.scrollLeft, scrollTop: host.scrollTop,
  };
});

// Where the glyph ink of the first text item lies on the canvas, against the
// box the overlay drew for it, both in canvas pixels.
const inkCheck = () => page.evaluate(() => {
  const c = document.getElementById('page');
  const it = S.projected.find(p => p.str.trim());
  const pad = 6;
  const x0 = Math.max(0, Math.floor(it.left - pad)), y0 = Math.max(0, Math.floor(it.top - pad));
  const w = Math.ceil(it.w + 2 * pad), h = Math.ceil(it.h + 2 * pad);
  const px = c.getContext('2d').getImageData(x0, y0, w, h).data;
  let l = Infinity, t = Infinity, r = -1, b = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (px[i] < 128 && px[i + 1] < 128 && px[i + 2] < 128) {
      l = Math.min(l, x0 + x); r = Math.max(r, x0 + x); t = Math.min(t, y0 + y); b = Math.max(b, y0 + y);
    }
  }
  return { box: { l: it.left, t: it.top, r: it.left + it.w, b: it.top + it.h }, ink: { l, t, r, b } };
});

try {
  await page.goto(`${origin}/pages/pdf-inspect.html#gh=${REPO}@main:${FIXTURE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.Alpine && document.getElementById('page')?.width > 0 && typeof S !== 'undefined' && S.projected.length,
                             null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const s0 = await state();
  console.log(`fit to width on a phone: scale ${s0.scale.toFixed(2)}`);

  console.log('one finger selects:');
  const c = s0.canvas;
  await touch('touchStart', [[c.l + 10, c.t + 10]]); await frame();
  await touch('touchMove', [[c.l + c.w * 0.8, c.t + c.h * 0.4]]); await frame();
  await touch('touchEnd', []); await frame();
  let s = await state();
  ok('a one-finger drag selects text', s.sel > 0, JSON.stringify({ sel: s.sel }));
  ok('and leaves the scale alone', s.scale === s0.scale && s.scaleMode === 'fit', `${s.scale} ${s.scaleMode}`);
  // A selection on a phone opens the controls panel over the page; close it,
  // as a reader would, before the next gesture.
  const reset = () => page.evaluate(() => {
    const d = window.Alpine.$data(document.querySelector('[x-data]'));
    d.clearSel(); d.panel = false;
  }).then(() => page.waitForTimeout(400));
  await reset();

  console.log('two fingers pinch:');
  // Anchored mid-page, where the scroller has room on every side to keep the
  // point still. Near an edge the scroll clamps and the point falls short,
  // which is the edge doing its job rather than the anchor failing.
  const cx = c.l + c.w * 0.45, cy = c.t + c.h * 0.5;
  const before = { ux: (cx - c.l) / s0.scale, uy: (cy - c.t) / s0.scale };
  const { mid, end } = await pinch(cx, cy, 80, 200, { dx: 10, dy: 20 });
  ok('during the spread the stage carries a scale transform', /scale\((1\.[0-9]|2)/.test(mid.transform), mid.transform);
  ok('and the overlay scales with the canvas', near(mid.ov.l, mid.canvas.l, 1) && near(mid.ov.w, mid.canvas.w, 1) && near(mid.ov.h, mid.canvas.h, 1),
     JSON.stringify({ ov: mid.ov, canvas: mid.canvas }));
  await page.waitForTimeout(400);
  s = await state();
  const want = Math.round(s0.scale * 2.5 * 100) / 100;
  ok('on lift the page re-renders at the pinched scale', near(s.scale, want, 0.02) && s.canvasW === Math.ceil(s.W),
     JSON.stringify({ scale: s.scale, want, canvasW: s.canvasW, W: s.W }));
  ok('with the transform dropped', !s.transform, s.transform);
  ok('the overlay is the canvas size', s.viewBox === `0 0 ${s.W} ${s.H}`, s.viewBox);
  ok('the zoom select shows the pinched scale', s.selectValue === s.scaleMode && /pinched/.test(s.selectText),
     JSON.stringify({ v: s.selectValue, m: s.scaleMode, t: s.selectText }));
  const mx = (end[0][0] + end[1][0]) / 2, my = (end[0][1] + end[1][1]) / 2;
  const now = { x: s.canvas.l + before.ux * s.scale, y: s.canvas.t + before.uy * s.scale };
  ok('the point under the fingers stays under them', near(now.x, mx, 3) && near(now.y, my, 3),
     JSON.stringify({ now, mid: { x: mx, y: my } }));
  const ink = await inkCheck();
  ok('the overlay box sits on the ink', ink.ink.r > 0 &&
     ink.ink.l >= ink.box.l - 2 && ink.ink.r <= ink.box.r + 2 && ink.ink.t >= ink.box.t - 2 && ink.ink.b <= ink.box.b + 2,
     JSON.stringify(ink));

  console.log('the finger left behind:');
  await reset();
  const p2 = await pinch(cx, cy, 120, 140, { hold: true });
  const [lx, ly] = p2.end[0];
  await touch('touchMove', [[lx + 120, ly + 160]]); await frame();
  await touch('touchEnd', []); await frame();
  s = await state();
  ok('does not start a selection', s.sel === 0, JSON.stringify({ sel: s.sel }));

  console.log('panning a zoomed page:');
  await page.evaluate(() => { const h = document.getElementById('scroll'); h.scrollLeft = 0; h.scrollTop = 0; });
  s = await state();
  ok('its left edge can be scrolled to', s.canvas.l >= s.host.l - 1, JSON.stringify({ canvas: s.canvas.l, host: s.host.l }));

  console.log('pinching in:');
  const z = await state();
  await pinch(z.host.l + 195, z.host.t + 300, 300, 20, { steps: 12 });
  await page.waitForTimeout(400);
  s = await state();
  ok('clamps at the floor', near(s.scale, 0.4, 0.001), String(s.scale));
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.log(`\n${failures.length} failure(s): ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nall checks passed');
