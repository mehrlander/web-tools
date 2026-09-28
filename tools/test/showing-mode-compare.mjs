#!/usr/bin/env node
// showing-mode-compare.mjs — two ways to close the gap between a toss and a
// direct ?use= link, measured side by side on the same scenarios.
//
//   node tools/test/showing-mode-compare.mjs [--only S1,S3]
//
// Experiment E10 of docs/showing-consolidation.md. A toss frames its page, so
// the page's own FAB, the tab, the address bar and history belong to the
// renderer, whose code is main's. Two candidate fixes:
//
//   A  RENDERER VERSION. Keep the frame, and let the link choose the version
//      of the renderer's own library (its FAB and drawer): `?ui=<ref>`, loaded
//      by the native gh-api.js import with the ref set, NOT the blob import
//      that the iPhone record implicates. Prototyped as an in-flight patch of
//      the renderer's FAB boot below; nothing committed carries it.
//   B  TOP MODE. The renderer replaces itself with the page
//      (pages/scratch/toss-top-probe.html), which then runs as the top-level
//      document with its own FAB, title and history.
//
// F is today's renderer, unchanged, as the baseline.
//
// Every JavaScript file served is stamped with the repo, ref and path its URL
// named (the method of showing-selection-probe.mjs), so "the FAB is at ref X"
// means fab.js executed from X in the document whose FAB is on screen.
// Chromium only, through the local harness; the phone half is on the device.
// Not part of `npm test`.

import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? new Set(argv[argv.indexOf('--only') + 1].split(',')) : null;
const WT = 'mehrlander/web-tools';

// ── approach A, as an in-flight patch of the renderer's FAB boot ─────────────
const FAB_BOOT = "await import('https://mehrlander.github.io/web-tools/lib/entry.js');\n    await gh.load('alpineComponents/fab.js');";
const FAB_BOOT_A = `{
      const ui = new URLSearchParams(location.search).get('ui');
      if (ui) {
        window.__ghBlobBoot = { repo: 'mehrlander/web-tools', ref: ui };
        await import('https://mehrlander.github.io/web-tools/lib/gh-api.js');
      } else {
        await import('https://mehrlander.github.io/web-tools/lib/entry.js');
      }
    }
    await gh.load('alpineComponents/fab.js');`;
const shipped = await readFile(path.join(root, 'pages/toss-render.html'), 'utf8');
if (!shipped.includes(FAB_BOOT)) { console.error("the renderer's FAB boot no longer matches; update FAB_BOOT"); process.exit(2); }
const patchedA = shipped.replace(FAB_BOOT, FAB_BOOT_A);

// ── scenarios: one address, one page query, in each mode ─────────────────────
const S = [
  { id: 'S1', what: 'a web-tools page at a branch', addr: `${WT}@page-br:pages/diff-tool.html`, q: '' },
  { id: 'S2', what: 'the same page with Web Tools at main', addr: `${WT}@page-br:pages/diff-tool.html`, q: 'lib=main' },
  { id: 'S3', what: 'the app at a branch, map view, then a view switch and a reload', addr: `${WT}@page-br:app/index.html`, q: 'view=map', history: true },
  { id: 'S4', what: 'three repositories: shortcut-tools page, private data, Web Tools', addr: `mehrlander/shortcut-tools@page-br:pages/library.html`, q: 'data=data-br&lib=lib-br' },
];
// The URL each mode is opened at. F and A carry lib on the renderer's query;
// B carries everything as real query parameters beside gh.
const url = (base, mode, s) => {
  const lib = new URLSearchParams(s.q).get('lib');
  const pageQ = new URLSearchParams(s.q); pageQ.delete('lib');
  const pq = pageQ.toString();
  if (mode === 'B') return `${base}/pages/scratch/toss-top-probe.html?gh=${s.addr}${s.q ? '&' + s.q : ''}`;
  const host = [lib ? 'lib=' + lib : '', mode === 'A' ? 'ui=' + (lib || s.addr.split('@')[1].split(':')[0]) : ''].filter(Boolean).join('&');
  return `${base}/pages/toss-render.html${host ? '?' + host : ''}#gh=${s.addr}${pq ? '?' + pq : ''}`;
};

// ── stamping ─────────────────────────────────────────────────────────────────
function origin(u) {
  let x; try { x = new URL(u); } catch { return null; }
  if (x.host === 'mehrlander.github.io') { const [, repo, ...rest] = x.pathname.split('/'); return { repo, ref: 'deployed', path: rest.join('/') }; }
  if (x.host === 'raw.githubusercontent.com') { const [, , repo, ref, ...rest] = x.pathname.split('/'); return { repo, ref, path: rest.join('/') }; }
  const m = x.host === 'api.github.com' && x.pathname.match(/^\/repos\/[^/]+\/([^/]+)\/contents\/(.*)$/);
  return m ? { repo: m[1], ref: x.searchParams.get('ref') || '(default)', path: decodeURIComponent(m[2]) } : null;
}
const tag = o => `${o.repo}@${o.ref}:${o.path}`;
const mark = o => `\n;(window.__ran=window.__ran||[]).push(${JSON.stringify(tag(o))});\n`;
function stamped(o, r) {
  if (!o || !/\.m?js$/.test(o.path) || r.kind !== 'fulfill') return r.body;
  const body = Buffer.isBuffer(r.body) ? r.body.toString('utf8') : String(r.body);
  if (/json/.test(r.contentType || '')) {
    try { const d = JSON.parse(body); if (typeof d.content === 'string') return JSON.stringify({ ...d, content: Buffer.from(Buffer.from(d.content, 'base64').toString('utf8') + mark(o)).toString('base64') }); } catch {}
    return body;
  }
  return body + mark(o);
}

// ── run ──────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
  try { res.writeHead(200, { 'content-type': typeFor(rel) }); res.end(await readFile(path.join(root, rel))); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--no-sandbox'] });

// What the page document knows about itself, and whose FAB is on screen.
async function read(page) {
  const docs = [];
  for (const f of page.frames()) {
    const d = await f.evaluate(() => {
      const el = document.querySelector('[x-data^="fab"]');
      let fabOn = false;
      try { fabOn = !!(el && el.children.length && getComputedStyle(el.firstElementChild || el).display !== 'none'); } catch (e) {}
      const q = new URLSearchParams(location.search);
      return {
        top: window.top === window, gh: window.gh ? window.gh.ref : null, hosted: !!window.__fabHosted,
        fabOn, fabRan: (window.__ran || []).filter(t => /alpineComponents\/fab\.js$/.test(t)),
        pageSeesGh: q.get('gh'), pageQuery: q.toString().slice(0, 80), view: q.get('view'),
        isPage: !/toss-render\.html|toss-top-probe\.html/.test(location.pathname) || !!window.__tossTop,
      };
    }).catch(() => null);
    if (d) docs.push(d);
  }
  const pageDoc = docs.filter(d => d.isPage && d.gh).at(-1) || docs.at(-1);
  const fabDoc = docs.find(d => d.fabOn && !d.hosted);
  return { tab: (await page.title()).slice(0, 48), url: page.url().replace(base, '').slice(0, 150), pageDoc, fabDoc };
}

for (const s of S) {
  if (only && !only.has(s.id)) continue;
  console.log(`\n${s.id}  ${s.what}`);
  for (const mode of ['F', 'A', 'B']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.route('**/*', route => {
      const req = route.request(), u = req.url();
      if (u.startsWith(base)) {
        if (mode === 'A' && u.split(/[?#]/)[0].endsWith('/pages/toss-render.html') && req.frame() === page.mainFrame())
          return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: patchedA });
        return route.continue();
      }
      const o = origin(u);
      const r = resolveCdn(u, root, null, req.headers());
      if (r.kind === 'continue') return route.abort();
      if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
      return route.fulfill({ status: r.status || 200, contentType: r.contentType, body: stamped(o, r) });
    });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message.slice(0, 100)));
    await page.goto(url(base, mode, s), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    const r = await read(page);
    const fab = r.fabDoc ? `${r.fabDoc.top ? 'top' : 'framed'} FAB ran ${r.fabDoc.fabRan.map(t => t.split(':')[0]).join(',') || '(from a build)'}` : 'no FAB on screen';
    console.log(`  ${mode}  tab="${r.tab}"  page ${r.pageDoc && r.pageDoc.top ? 'top-level' : 'framed'}, lib ${r.pageDoc && r.pageDoc.gh}; ${fab}`);
    if (r.pageDoc && (r.pageDoc.pageSeesGh || mode === 'B')) console.log(`     page sees gh=${r.pageDoc.pageSeesGh}; its query: "${r.pageDoc.pageQuery}"`);
    if (s.history) {
      // A view switch, the way the app writes it, from inside the page.
      const f = page.frames().filter(x => x !== page.mainFrame()).at(-1) || page.mainFrame();
      const pf = mode === 'B' ? page.mainFrame() : (page.frames().find(x => x.url().startsWith('blob:')) || f);
      await pf.evaluate(() => history.pushState(null, '', '?view=pages#x=1')).catch(e => console.log('     pushState threw: ' + e.message.slice(0, 80)));
      const after = page.url().replace(base, '');
      await page.goBack().catch(() => {}); await page.waitForTimeout(500);
      const back = page.url().replace(base, '');
      await page.goForward().catch(() => {}); await page.waitForTimeout(500);
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(8000);
      const re = await read(page);
      console.log(`     after pushState: ${after.slice(0, 120)}`);
      console.log(`     back: ${back.slice(0, 120)}`);
      console.log(`     after reload: page lib ${re.pageDoc && re.pageDoc.gh}, page sees view=${re.pageDoc && re.pageDoc.view}`);
    }
    if (errors.length) console.log('     errors: ' + errors.slice(0, 2).join(' | '));
    await ctx.close();
  }
}
await browser.close(); server.close();
