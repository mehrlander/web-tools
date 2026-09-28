#!/usr/bin/env node
// showing-selection-probe.mjs — can a toss select versions independently: the
// rendered page from one repo and ref, the Web Tools library from another, and
// a page's data from a third? And what actually RAN, not only what was asked?
//
//   node tools/test/showing-selection-probe.mjs [--only X1,X3p]
//
// Experiment E8 of docs/showing-consolidation.md.
//
// DISTINGUISHABLE CONTENT. The render harness answers every ref from the
// working tree, so the bytes of two refs are identical here. This probe makes
// them distinguishable: every JavaScript file it serves is stamped with the
// repo, ref and path its URL asked for, and the stamp records itself on
// window.__ran when the file executes. A file served by GitHub Pages is stamped
// `deployed`. So the report says which version of each file each document
// executed, which is the question a preview has to answer, rather than which
// version it requested. Data files are not stamped; for them the evidence is
// the ref in the request.
//
// THE `p` CASES were an in-flight prototype of the renderer's ?lib= until
// 2026-09-28, when it shipped in pages/toss-render.html; they now run the
// shipped renderer like every other case, and keep their ids so the plan's
// tables still point at them.
//
// Not part of `npm test` (needs a browser). Prints a report.

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

// ── the cases ─────────────────────────────────────────────────────────────────
// `q` is the renderer's own query; `addr` the #gh= address (or `hash` for a
// route); `proto` serves the patched renderer.
const X = (id, what, o) => ({ id, what, ...o });
const CASES = [
  X('X1', 'home project page at a branch, nothing else said',
    { addr: `mehrlander/home@page-br:projects/budget-drs/submittal/submittal.html` }),
  X('X2', 'the same, Web Tools picked by the page\'s own ?lib= (shipped)',
    { addr: `mehrlander/home@page-br:projects/budget-drs/submittal/submittal.html?lib=lib-br` }),
  X('X2p', 'the same, Web Tools picked by the renderer\'s ?lib= (prototype)',
    { proto: true, q: '?lib=lib-br', addr: `mehrlander/home@page-br:projects/budget-drs/submittal/submittal.html` }),
  X('X3', 'shortcut-tools page at a branch, data picked by its own ?data= (shipped)',
    { addr: `mehrlander/shortcut-tools@page-br:pages/library.html?data=data-br` }),
  X('X3p', 'the same under the prototype, no ?lib=',
    { proto: true, addr: `mehrlander/shortcut-tools@page-br:pages/library.html?data=data-br` }),
  X('X4', 'home page booting the dist/web-tools.js pre-build (surfacer), at a branch',
    { addr: `mehrlander/home@page-br:projects/surfacer/app/surfacer.html` }),
  X('X4p', 'the same under the prototype',
    { proto: true, addr: `mehrlander/home@page-br:projects/surfacer/app/surfacer.html` }),
  X('X5', 'the web-tools app at main, one app view at a branch (appRef, shipped)',
    { addr: `${WT}@main:app/index.html?view=app&appRepo=${WT}&appPath=pages/diff-tool.html&appRef=view-br` }),
  X('X5b', 'the web-tools app tossed at a branch, a view that names no ref',
    { addr: `${WT}@app-br:app/index.html?view=app&appRepo=${WT}&appPath=pages/diff-tool.html` }),
  X('X5c', 'the web-tools app tossed at a branch, a home view that names no ref',
    { q: '?lib=lib-br', addr: `${WT}@app-br:app/index.html?view=app&appRepo=mehrlander/home&appPath=projects/budget-drs/submittal/submittal.html` }),
  X('X6p', 'the web-tools app\'s page at main, its code (dist/app.js) from a branch (prototype)',
    { proto: true, q: '?lib=lib-br', addr: `${WT}@main:app/index.html` }),
  X('X7', 'home doc-audit viewer, which reads `use` as the Web Tools ref, at a branch',
    { addr: `mehrlander/home@page-br:projects/doc-audit/viewer/index.html` }),
  X('X7p', 'the same under the prototype',
    { proto: true, addr: `mehrlander/home@page-br:projects/doc-audit/viewer/index.html` }),
  X('X10', 'the budget-drs app (home) at a branch, submittal view open',
    { wait: 25000, addr: `mehrlander/home@page-br:projects/budget-drs/app/view/app.html?view=submittal` }),
  X('X10b', 'the same app at main, asking for the view at a branch (no selector exists)',
    { wait: 25000, addr: `mehrlander/home@main:projects/budget-drs/app/view/app.html?view=submittal&viewRef=page-br` }),
  X('X8p', 'data route: content at one ref, the viewer page from another (prototype)',
    { proto: true, q: '?lib=lib-br', hash: `data=${WT}@data-br:docs/subjects.csv` }),
  X('X9p', 'a web-tools page at one ref, its library from another (prototype)',
    { proto: true, q: '?lib=lib-br', addr: `${WT}@page-br:pages/diff-tool.html` }),
];

// ── stamping ──────────────────────────────────────────────────────────────────
function origin(url) {
  let u; try { u = new URL(url); } catch { return null; }
  if (u.host === 'mehrlander.github.io') {
    const [, repo, ...rest] = u.pathname.split('/');
    return { repo, ref: 'deployed', path: rest.join('/') };
  }
  if (u.host === 'raw.githubusercontent.com') {
    const [, , repo, ref, ...rest] = u.pathname.split('/');
    return { repo, ref, path: rest.join('/') };
  }
  const m = u.host === 'api.github.com' && u.pathname.match(/^\/repos\/[^/]+\/([^/]+)\/contents\/(.*)$/);
  if (m) return { repo: m[1], ref: u.searchParams.get('ref') || '(default)', path: decodeURIComponent(m[2]) };
  return null;
}
const isJs = p => /\.(m?js)$/.test(p);
const stamp = (o) => `\n;(window.__ran=window.__ran||[]).push(${JSON.stringify(`${o.repo}@${o.ref}:${o.path}`)});\n`;

function stamped(o, r) {
  if (!o || !isJs(o.path) || r.kind !== 'fulfill') return r.body;
  const body = Buffer.isBuffer(r.body) ? r.body.toString('utf8') : String(r.body);
  if (/json/.test(r.contentType || '')) {
    try {
      const d = JSON.parse(body);
      if (d && typeof d.content === 'string') {
        const src = Buffer.from(d.content, 'base64').toString('utf8') + stamp(o);
        return JSON.stringify({ ...d, content: Buffer.from(src).toString('base64') });
      }
    } catch {}
    return body;
  }
  return body + stamp(o);
}

// ── run ───────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
  try {
    const body = await readFile(path.join(root, rel));
    res.writeHead(200, { 'content-type': typeFor(rel) }); res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--no-sandbox'] });

for (const c of CASES) {
  if (only && !only.has(c.id)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const asked = [];
  const depthOf = (f) => { let d = 0; for (let p = f && f.parentFrame(); p; p = p.parentFrame()) d++; return d; };

  await page.route('**/*', async route => {
    const req = route.request(), url = req.url();
    if (url.startsWith(base)) return route.continue();
    const o = origin(url);
    let f = null; try { f = req.frame(); } catch {}
    if (o) asked.push({ depth: f ? depthOf(f) : -1, ...o });
    const r = resolveCdn(url, root, null, req.headers());
    if (r.kind === 'continue') return route.abort();
    if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
    return route.fulfill({ status: r.status || 200, contentType: r.contentType, body: stamped(o, r) });
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 140)));
  const url = `${base}/pages/toss-render.html${c.q || ''}#${c.hash || 'gh=' + c.addr}`;
  try { await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(c.wait || 8000); }
  catch (e) { errors.push('goto: ' + e.message); }

  console.log(`\n${c.id}  ${c.what}\n    ${c.q || ''}#${c.hash || 'gh=' + c.addr}`);
  for (const f of page.frames()) {
    const d = depthOf(f);
    const s = await f.evaluate(() => ({
      gh: window.gh ? window.gh.ref : null, lib: window.__lib || null, ref: window.__ref || null,
      webToolsRef: window.__webToolsRef || null, ran: window.__ran || [],
    })).catch(() => null);
    if (!s) continue;
    // Group what executed by repo@ref, keeping a count and two examples.
    const g = {};
    for (const t of s.ran) { const k = t.slice(0, t.indexOf(':')); (g[k] = g[k] || []).push(t.slice(t.indexOf(':') + 1)); }
    const ran = Object.entries(g).map(([k, v]) => `${k} ×${v.length} (${v.slice(0, 2).join(', ')}${v.length > 2 ? ', …' : ''})`).join('; ');
    console.log(`    d${d} gh.ref=${s.gh} __lib=${s.lib} __ref=${s.ref}${s.webToolsRef ? ' __webToolsRef=' + s.webToolsRef : ''}`);
    console.log(`       ran: ${ran || '(nothing stamped)'}`);
  }
  // What the host's FAB says about each layer: the ref it was asked for, the
  // Web Tools version it booted, and whether that is the wrong one.
  const marks = await page.evaluate(() => {
    try {
      const el = document.querySelector('[x-data^="fab"]');
      const d = el && window.Alpine && Alpine.$data(el);
      if (!d || !d.readLayers) return null;
      return d.readLayers().map(L => (L.sealed ? 'sealed' : `${L.role}:${L.ref}` +
        (L.lib ? ` ran ${L.lib.got}${d.layerLibWrong(L) ? ' WRONG, should run ' + L.lib.want : ''}` : '')));
    } catch (e) { return ['error ' + e.message]; }
  });
  if (marks) console.log('    FAB layers: ' + marks.join(' | '));
  // Data: non-JS reads of repos other than web-tools's own code, by depth.
  const data = {};
  for (const a of asked) {
    if (a.depth < 1 || isJs(a.path) || /\.html$/.test(a.path)) continue;
    const k = `d${a.depth} ${a.repo}@${a.ref}`;
    (data[k] = data[k] || new Set()).add(a.path);
  }
  for (const [k, v] of Object.entries(data)) console.log(`       data ${k}: ${[...v].slice(0, 3).join(', ')}${v.size > 3 ? ` … (+${v.size - 3})` : ''}`);
  if (errors.length) console.log('    errors: ' + errors.slice(0, 2).join(' | '));
  await ctx.close();
}
await browser.close(); server.close();
