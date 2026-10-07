#!/usr/bin/env node
// The viewer's slides render for a PowerPoint deck, end to end in a browser.
//
//   node tools/test/viewer-pptx.mjs [--pptx path/to/deck.pptx] [--shot out.png] [--width px]
//
// The node suite holds the classifier and the pins. What it cannot hold is
// that a .pptx handed to the viewer OPENS on the slides render and that the
// painter draws every slide, its text and its native charts. Four claims:
//
//   1. a .pptx opens in the slides mode over the host's blanket defaultMode
//   2. every slide in the file is drawn as the pane scrolls to it, and the
//      header line counts them
//   3. the slides' text reaches the page as text, not as a picture of it
//   4. a native chart is drawn as a chart, and the pane does not scroll sideways
//
// The painter and Carlito are pinned jsDelivr URLs, which the CDN shim answers
// from node_modules. Neither is a devDependency: the painter declares an
// optional peer on pdf.js 5 or 6 and this repo pins 3, so installing it into
// package.json breaks `npm install`. Install both for the run instead:
//
//   npm i --no-save --legacy-peer-deps @aiden0z/pptx-renderer@1.3.0 @fontsource/carlito@5.3.0
//
// With no --pptx it reads mehrlander/home's committed June deck from a sibling
// checkout, which carries both native charts. Not part of `npm test`.

import http from 'node:http';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const shot = opt('--shot');
const width = Number(opt('--width') || 1000);
const deck = opt('--pptx') || path.join(root, '..', 'home', 'projects/budget-drs/submittal/deck/friday-director-deck.pptx');

if (!existsSync(path.join(root, 'node_modules/@aiden0z/pptx-renderer'))) {
  console.log('The painter is not installed. Run:\n  npm i --no-save --legacy-peer-deps @aiden0z/pptx-renderer@1.3.0 @fontsource/carlito@5.3.0');
  process.exit(2);
}
if (!existsSync(deck)) { console.log('No deck at ' + deck + '; pass --pptx.'); process.exit(2); }

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
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ args: ['--no-sandbox', '--ignore-certificate-errors'] });
const page = await browser.newPage({ viewport: { width, height: 1300 } });
await page.route('**/*', route => {
  const url = route.request().url();
  if (url.startsWith(origin)) return route.continue();
  const r = resolveCdn(url, root, null);
  if (r.kind === 'continue') return route.continue();
  if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
  return route.fulfill({ status: 200, contentType: r.contentType, body: r.body });
});
page.on('pageerror', e => console.log(`  [pageerror] ${e.message}`));

try {
  const name = path.basename(deck);
  const b64 = (await readFile(deck)).toString('base64');
  const env = {
    kind: 'data-view/1',
    items: [{ name, content: 'data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,' + b64 }],
  };
  console.log(`a deck carried as a data URI (${name}):`);
  await page.goto(`${origin}/pages/data-view.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(async (payload) => {
    const bytes = new TextEncoder().encode(payload);
    const gz = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = new Uint8Array(await new Response(gz).arrayBuffer());
    let str = ''; for (const b of buf) str += String.fromCharCode(b);
    location.hash = 'gz=' + btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    location.reload();
  }, JSON.stringify(env));
  // Until the deck is drawn or the pane says why not; a page still loading
  // has no pane at all, and that is not an answer.
  await page.waitForFunction(() => {
    const root = document.querySelector('[data-slides="root"]');
    if (!root) return false;
    const msg = root.querySelector('[data-slides="msg"]');
    return [...document.querySelectorAll('*')].some(e => e.__deck) || (msg && !msg.textContent.includes('Opening'));
  }, null, { timeout: 40000 }).catch(() => {});
  // Windowed mounting draws what is near the viewport; scroll the pane
  // through so every slide mounts before it is counted.
  // Windowed mounting draws what is near the viewport and lets go of what
  // scrolled away, so the pane is walked top to bottom and every slide that
  // mounted along the way is counted.
  const seen = await page.evaluate(async () => {
    const pane = document.querySelector('[data-slides="stage"] > div');
    const viewer = [...document.querySelectorAll('*')].find(e => e.__deck)?.__deck?.viewer;
    const got = new Set();
    if (!pane || !viewer) return 0;
    for (let y = 0; y <= pane.scrollHeight; y += pane.clientHeight / 2) {
      pane.scrollTop = y; await new Promise(r => setTimeout(r, 200));
      for (const i of viewer.getMountedSlides()) got.add(i);
    }
    pane.scrollTop = 0; await new Promise(r => setTimeout(r, 300));
    return got.size;
  });

  const s = await page.evaluate(() => {
    const host = document.getElementById('dv-viewer');
    const v = host && Alpine.$data(host);
    const root = document.querySelector('[data-slides="root"]');
    // Published on the viewer's own root, as __doc is.
    const d = [...document.querySelectorAll('*')].find(e => e.__deck)?.__deck;
    const pane = root?.querySelector('[data-slides="stage"] > div');
    return {
      mode: v?.mode || null,
      stats: v?.stats || '',
      msg: root?.querySelector('[data-slides="msg"]')?.textContent.trim() || '(gone)',
      slides: d?.slides || 0,
      text: (pane?.innerText || '').replace(/\s+/g, ' ').trim(),
      charts: pane?.querySelectorAll('canvas, svg').length || 0,
      scrollWidth: pane?.scrollWidth, clientWidth: pane?.clientWidth,
    };
  });

  ok('the slides mode is what opened', s.mode === 'slides', JSON.stringify({ mode: s.mode }));
  ok('the loading line got out of the way', s.msg === '(gone)', s.msg);
  ok('the deck has slides and every one of them drew', s.slides > 0 && seen === s.slides, `${seen} of ${s.slides}`);
  ok('the header line counts the slides', new RegExp(`^${s.slides} slides?\\s·\\s\\d+\\.\\d KB$`).test(s.stats), s.stats);
  ok('the slide text reached the page as text', s.text.length > 200, String(s.text.length));
  if (/friday-director-deck/.test(deck)) {
    ok('the June deck\'s titles are there', s.text.includes('The administrative fee') && s.text.includes('Are we over-serving?'), s.text.slice(0, 200));
    ok('its native charts drew', s.charts >= 2, String(s.charts));
  }
  ok('the pane does not scroll sideways', (s.scrollWidth || 0) <= (s.clientWidth || 0) + 1,
     `scrollWidth ${s.scrollWidth} clientWidth ${s.clientWidth}`);

  if (shot) {
    const el = await page.$('[data-slides="root"]');
    await (el || page).screenshot({ path: shot });
    console.log('  shot  ' + shot);
  }
} finally {
  await browser.close();
  server.close();
}
if (failures.length) { console.log(`\n${failures.length} failed`); process.exit(1); }
console.log('\nall passed');
