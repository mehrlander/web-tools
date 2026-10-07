#!/usr/bin/env node
// toss-top-probe.mjs — experiment E6, headless half: what a page gains and
// loses when the renderer replaces itself with it (pages/scratch/toss-top-probe.html)
// instead of framing it (pages/toss-render.html).
//
//   node node/test/toss-top-probe.mjs
//
// Each case renders the same address both ways and reads, from the document
// the page actually runs in: whether it is the top-level document, the tab
// title, the lib ref it booted, whether its own FAB mounted and what that FAB
// believes, and, for the app, whether a view switch survives a reload.
// Chromium only; the Safari half is on the device. Not part of `npm test`.

import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
  try { res.writeHead(200, { 'content-type': typeFor(rel) }); res.end(await readFile(path.join(root, rel))); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--no-sandbox'] });

async function open(url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.route('**/*', route => {
    const req = route.request(), url = req.url();
    if (url.startsWith(origin)) return route.continue();
    const r = resolveCdn(url, root, null, req.headers());
    if (r.kind === 'continue') return route.abort();
    if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
    return route.fulfill({ status: r.status || 200, contentType: r.contentType, body: r.body });
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 140)));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  return { ctx, page, errors };
}

// Read the document the SUBJECT runs in: the page itself in top mode, the
// deepest frame in a toss.
async function read(page) {
  const frames = page.frames();
  const f = frames[frames.length - 1];
  const inner = await f.evaluate(() => {
    const el = document.querySelector('[x-data^="fab"]');
    let fab = null;
    try { if (el && window.Alpine) { const d = Alpine.$data(el); fab = { previewRef: d.previewRef || null, ignoredUse: d.ignoredUse || null, loaderRef: d.loaderRef }; } } catch {}
    return { top: window.top === window, title: document.title.slice(0, 50), gh: window.gh ? window.gh.ref : null,
             fabHere: !!el, fab, url: location.href.replace(/^https?:\/\/[^/]+/, '').slice(0, 110) };
  }).catch(e => ({ error: e.message }));
  return { tabTitle: await page.title(), frames: frames.length, inner };
}

const CASES = [
  ['diff-tool at a ref', 'mehrlander/web-tools@probe-ref:pages/diff-tool.html'],
  ['the app at a ref, map view', 'mehrlander/web-tools@probe-ref:app/index.html?view=map'],
  ['a cross-repo page (shortcut-tools library)', 'mehrlander/shortcut-tools@probe-ref:pages/library.html'],
];

for (const [what, addr] of CASES) {
  console.log(`\n${what}\n  ${addr}`);
  for (const [mode, url] of [['toss', `${origin}/pages/toss-render.html#gh=${addr}`],
                             ['top ', `${origin}/pages/scratch/toss-top-probe.html?gh=${addr}`]]) {
    const { ctx, page, errors } = await open(url);
    const r = await read(page);
    console.log(`  ${mode}  frames=${r.frames} tab="${r.tabTitle}" top=${r.inner.top} lib=${r.inner.gh} ownFab=${r.inner.fabHere}` +
                (r.inner.fab ? ` fab{previewRef:${r.inner.fab.previewRef} ignoredUse:${r.inner.fab.ignoredUse} loaderRef:${r.inner.fab.loaderRef}}` : ''));
    if (mode === 'top ' && addr.includes('app/index.html')) {
      // What the app does on a view switch, then a reload.
      const f = page.frames().at(-1);
      await f.evaluate(() => history.replaceState(null, '', '?view=pages#x=1'));
      const after = await page.evaluate(() => location.pathname + location.search + location.hash);
      console.log(`        after replaceState('?view=pages#x=1'): ${after.slice(0, 140)}`);
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(7000);
      const re = await read(page);
      console.log(`        after reload: lib=${re.inner.gh} url=${re.inner.url}`);
    }
    if (errors.length) console.log('        errors: ' + errors.slice(0, 2).join(' | '));
    await ctx.close();
  }
}
await browser.close(); server.close();
