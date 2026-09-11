#!/usr/bin/env node
// Stage's two-pane desktop layout uses the house splitter and collapses back to
// one column when its own container is narrow.
//
//   node tools/test/stage-split-drag.mjs
//
// Container queries and real pointer hit-testing are the behavior here, so the
// logic-level stage test cannot establish it. This check drives the built app,
// moves the seam, verifies persistence, then narrows the viewport and verifies
// that the divider leaves the single-column phone layout.

import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
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

const browser = await chromium.launch({ args: ['--no-sandbox', '--ignore-certificate-errors'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => localStorage.removeItem('stageAsidePct'));
await page.route('**/*', route => {
  const url = route.request().url();
  if (url.startsWith(origin)) return route.continue();
  const r = resolveCdn(url, root, null);
  if (r.kind === 'continue') return route.continue();
  if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
  return route.fulfill({ status: 200, contentType: r.contentType, body: r.body });
});

const geometry = () => page.evaluate(() => {
  const frame = document.querySelector('[x-ref="splitFrame"]');
  const seam = document.querySelector('[x-ref="splitHandle"]');
  const aside = document.querySelector('[x-ref="splitAside"]');
  const out = frame?.firstElementChild;
  const box = el => {
    const r = el?.getBoundingClientRect();
    return r && { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  };
  return {
    frame: box(frame), seam: box(seam), aside: box(aside), out: box(out),
    seamDisplay: seam && getComputedStyle(seam).display,
    stored: Number(localStorage.getItem('stageAsidePct')) || 0,
    value: Number(seam?.getAttribute('aria-valuenow')) || 0,
  };
});

try {
  await page.goto(`${origin}/app/index.html?view=stage`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[x-ref="splitHandle"].dk-split', { timeout: 30000 });
  await page.waitForTimeout(500);

  const before = await geometry();
  ok('the wide Stage renders two panes and a splitter', before.seamDisplay === 'flex'
     && before.out.right < before.aside.left, `display ${before.seamDisplay}`);
  ok('the splitter sits between Out and Staged', before.out.right < before.seam.left
     && before.seam.right < before.aside.left,
     `out ${before.out.right}, seam ${before.seam.left}-${before.seam.right}, aside ${before.aside.left}`);

  const seam = await page.$('[x-ref="splitHandle"]');
  const box = await seam.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(140, box.height / 2));
  await page.mouse.down();
  await page.mouse.move(box.x - 150, box.y + Math.min(140, box.height / 2), { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(150);

  const after = await geometry();
  ok('dragging left gives the staged-items pane more room', after.aside.width > before.aside.width + 120,
     `aside ${before.aside.width} -> ${after.aside.width}`);
  ok('the Stage records the released allocation', after.stored > 0 && Math.abs(after.stored - after.value) <= 1,
     `stored ${after.stored}, aria ${after.value}`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  const narrow = await geometry();
  ok('the splitter leaves the narrow single-column layout', narrow.seamDisplay === 'none',
     `display ${narrow.seamDisplay}`);
  ok('Staged follows Out in that single column', narrow.aside.top >= narrow.out.bottom,
     `Out bottom ${narrow.out.bottom}, Staged top ${narrow.aside.top}`);
} finally {
  await browser.close();
  server.close();
}

console.log(failures.length ? `\n${failures.length} failure(s)` : '\nall passed');
process.exit(failures.length ? 1 : 0);
