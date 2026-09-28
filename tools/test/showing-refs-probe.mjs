#!/usr/bin/env node
// showing-refs-probe.mjs: one selection model, "show this file, and read each
// repository at this ref", prototyped and measured.
//
//   node tools/test/showing-refs-probe.mjs [--only R1,R3] [--unpatched]
//
// Experiment E11 of docs/showing-consolidation.md. The link carries a map,
// repeatable `refs=owner/repo@ref` on the renderer's query, beside the address
// that names the target. The renderer stamps the map into the page as
// window.__refs, and two places read it: the GH client (a constructor that is
// given no ref, and a contents read that names none) and the app, which
// forwards the map on every view address it mints. Everything else is unchanged.
//
// THE PROTOTYPE IS IN FLIGHT. Nothing committed carries it: the patches below
// are applied to the served bytes by the route handler, so `--unpatched` runs
// the same cases against the shipped code for the before/after.
//
// Every JavaScript file served is stamped with the repo, ref and path its URL
// named, and records itself on window.__ran when it executes (the method of
// showing-selection-probe.mjs); a data read is recorded from its request. The
// harness answers every ref from the working tree, so the refs below need not
// exist. Not part of `npm test` (needs a browser).

import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? new Set(argv[argv.indexOf('--only') + 1].split(',')) : null;
const unpatched = argv.includes('--unpatched');
const WT = 'mehrlander/web-tools', REG = 'mehrlander/web-tools-private', HOME = 'mehrlander/home';

// ── the prototype, as patches of served bytes ────────────────────────────────
// Each patch names its anchor; a missing anchor is a hard stop, so the probe
// cannot silently measure the shipped code while claiming the prototype.
const P = [];
const patch = (file, from, to) => P.push({ file, from, to });

// 1. The renderer: read the map, let it choose the target repo's dependencies
//    and the Web Tools ref, and stamp it into the page.
patch(/pages\/toss-render\.html$/, `  const queryParams = new URLSearchParams(location.search);`,
`  const queryParams = new URLSearchParams(location.search);
  // E11 prototype: the selection map. refs=owner/repo@ref, repeatable; lib= is
  // the web-tools entry spelled short. An outer document's map (this renderer
  // run by the top-mode launcher) is inherited, and this query wins over it.
  const SELECTED = (() => {
    const E = Object.assign({}, window.__refs || {});
    for (const v of queryParams.getAll('refs')) { const m = v.match(/^([^/@]+\\/[^/@]+)@(.+)$/); if (m) E[m[1]] = m[2]; }
    if (queryParams.get('lib')) E['mehrlander/web-tools'] = queryParams.get('lib');
    return E;
  })();`);
patch(/pages\/toss-render\.html$/, `    let [, owner, name, ref, path] = m;`,
`    let [, owner, name, ref, path] = m;
    // An address that names no ref reads its target where the map puts its repo.
    if (!ref && SELECTED[owner + '/' + name]) ref = SELECTED[owner + '/' + name];`);
patch(/pages\/toss-render\.html$/, `    const baked = await inlineRelativeDeps(text, { owner, name, ref, path });`,
`    // The target file is read at the address's ref; everything else the page
    // reads from its own repo follows the map when the map names that repo.
    const depRef = SELECTED[owner + '/' + name] || ref;
    const baked = await inlineRelativeDeps(text, { owner, name, ref: depRef, path });`);
patch(/pages\/toss-render\.html$/, `    const libAsked = queryParams.get('lib') || window.__lib || new URLSearchParams(pageQuery).get('lib') || '';
    const lib = libRef(owner + '/' + name, ref, libAsked);
    showTrusted(addressHtml(baked, { owner, name, ref, path, pageQuery, lib, libAsked }),`,
`    const libAsked = SELECTED['mehrlander/web-tools'] || window.__lib || new URLSearchParams(pageQuery).get('lib') || '';
    const lib = libRef(owner + '/' + name, depRef, libAsked);
    showTrusted(addressHtml(baked, { owner, name, ref: depRef, path, pageQuery, lib, libAsked }),`);
patch(/pages\/toss-render\.html$/, `    if (libAsked) prelude += '<script>window.__lib=' + JSON.stringify(libAsked) + ';<\\/script>';`,
`    if (libAsked) prelude += '<script>window.__lib=' + JSON.stringify(libAsked) + ';<\\/script>';
    if (Object.keys(SELECTED).length) prelude += '<script>window.__refs=' + JSON.stringify(SELECTED) + ';<\\/script>';`);
patch(/pages\/toss-render\.html$/, `    const viewerRef = queryParams.get('lib') || window.__lib || r.ref;`,
`    const viewerRef = SELECTED['mehrlander/web-tools'] || window.__lib || r.ref;`);

// 2. The GH client, in lib/gh-api.js and in each pre-build that carries it: a
//    client given no ref, and a contents read naming none, take the map's entry
//    for their repo. An explicit ref, 'main' included, is left alone: that is
//    how the registry reads stay pinned.
const GH_FILES = /(lib\/gh-api\.js|dist\/app\.js|dist\/web-tools\.js)$/;
patch(GH_FILES, `    this.ref = conf.ref || 'main';`,
`    this.ref = conf.ref || ((typeof window !== 'undefined' && window.__refs) || {})[conf.repo] || 'main';`);
patch(GH_FILES, `    const url = path.startsWith('http')`, `    let url = path.startsWith('http')`);
patch(GH_FILES, `    const method = String(opts.method || 'GET').toUpperCase();`,
`    try {
      const R = typeof window !== 'undefined' && window.__refs;
      const m = R && url.match(/^https:\\/\\/api\\.github\\.com\\/repos\\/([^/]+\\/[^/?]+)\\/contents\\/[^?]*(\\?.*)?$/);
      if (m && R[m[1]] && !/[?&]ref=/.test(m[2] || '')) url += (m[2] ? '&' : '?') + 'ref=' + encodeURIComponent(R[m[1]]);
    } catch (e) {}
    const method = String(opts.method || 'GET').toUpperCase();`);

// 3. The app: forward the map on every view address. The web-tools entry keeps
//    riding as ?lib=, which already yields to a view's own lib.
patch(/app\/index\.html$/, `    return '../pages/toss-render.html' + (lib ? '?lib=' + encodeURIComponent(lib) : '') +`,
`    const fwd = Object.entries(ctx.refs || {}).filter(([r]) => r !== 'mehrlander/web-tools')
      .map(([r, x]) => 'refs=' + r + '@' + encodeURIComponent(x));
    if (lib) fwd.unshift('lib=' + encodeURIComponent(lib));
    return '../pages/toss-render.html' + (fwd.length ? '?' + fwd.join('&') : '') +`);
patch(/app\/index\.html$/, `    return this.appViewAddress(this.appView, { hub: this.DEFAULT_REPO, appRef, appLib });`,
`    return this.appViewAddress(this.appView, { hub: this.DEFAULT_REPO, appRef, appLib, refs: window.__refs || {} });`);
// The top-mode gap S5 found: the launcher stamps __ref but not __fabHosted, so
// the app took itself for deployed and addressed hub views at main.
patch(/app\/index\.html$/, `      const tossed = window.__fabHosted === true;`,
`      const tossed = window.__fabHosted === true || !!window.__tossTop;`);

// 4. The top-mode launcher: the same map, from the same query keys.
patch(/pages\/scratch\/toss-top-probe\.html$/, `    const asked = own.get('lib') || '';`,
`    const E = {};
    for (const v of own.getAll('refs')) { const x = v.match(/^([^/@]+\\/[^/@]+)@(.+)$/); if (x) E[x[1]] = x[2]; }
    if (own.get('lib')) E[HUB] = own.get('lib');
    const asked = E[HUB] || '';`);
patch(/pages\/scratch\/toss-top-probe\.html$/, `        (asked ? \`window.__lib=\${JSON.stringify(asked)};\` : '') +`,
`        (asked ? \`window.__lib=\${JSON.stringify(asked)};\` : '') +
        (Object.keys(E).length ? \`window.__refs=\${JSON.stringify(E)};\` : '') +`);

// 5. Page-side adoption, one line each, applied only in the cases that name it:
//    the page's own ?data= stays first, the map second, main last.
const PAGE = {
  library: [/pages\/library\.html$/, `      DATA_REF: new URLSearchParams(location.search).get('data') || 'main',`,
    `      DATA_REF: new URLSearchParams(location.search).get('data') || (window.__refs || {})['mehrlander/web-tools-private'] || 'main',`],
  entities: [/pages\/entities\.html$/, `      DATA_REF: new URLSearchParams(location.search).get('data')`,
    `      DATA_REF: new URLSearchParams(location.search).get('data') || (window.__refs || {})['mehrlander/web-tools-private']`],
};

function applyPatches(url, body, extra) {
  if (unpatched) return body;
  let s = body, touched = false;
  for (const p of [...P, ...extra.map(k => ({ file: PAGE[k][0], from: PAGE[k][1], to: PAGE[k][2] }))]) {
    if (!p.file.test(url)) continue;
    if (!s.includes(p.from)) throw new Error(`anchor missing in ${url}: ${p.from.slice(0, 70)}`);
    s = s.replace(p.from, p.to); touched = true;
  }
  return touched ? s : body;
}

// ── the cases ────────────────────────────────────────────────────────────────
const refs = (...xs) => xs.map(x => 'refs=' + x).join('&');
const CSV = 'projects/budget-drs/data/design/domains.csv';
const C = (id, what, o) => ({ id, what, pages: [], ...o });
// The app cases address the app at `app-head`, a ref no checkout has, so the
// harness answers it from this working tree: the app as this branch has it. At
// `main` the harness would serve main's app, which predates view addressing.
const CASES = [
  C('R1', 'a home CSV at one branch, the web-tools viewer at another',
    { q: refs(`${WT}@viewer-br`), hash: `data=${HOME}@csv-br:${CSV}` }),
  C('R1b', 'the same CSV addressed without a ref, its version from the map',
    { q: refs(`${WT}@viewer-br`, `${HOME}@csv-br`), hash: `data=${HOME}:${CSV}` }),
  C('R1c', 'the same CSV, every override removed',
    { hash: `data=${HOME}:${CSV}` }),
  C('R2', 'shortcut-tools page, private data and Web Tools, each from the map',
    { q: refs(`${REG}@data-br`, `${WT}@lib-br`), addr: `mehrlander/shortcut-tools@page-br:pages/library.html`, readLibrary: true }),
  C('R2p', 'the same, the page adopting the map in one line',
    { q: refs(`${REG}@data-br`, `${WT}@lib-br`), addr: `mehrlander/shortcut-tools@page-br:pages/library.html`, readLibrary: true, pages: ['library'] }),
  C('R2d', 'the same, the page\'s own ?data= against the map',
    { q: refs(`${REG}@data-br`, `${WT}@lib-br`), addr: `mehrlander/shortcut-tools@page-br:pages/library.html?data=own-br`, readLibrary: true, pages: ['library'] }),
  C('R4', 'a web-tools page at a branch, the map selecting main for its dependencies',
    { q: refs(`${WT}@main`), addr: `${WT}@page-br:pages/diff-tool.html` }),
  C('R5', 'the web-tools app (this branch), one hub view at a branch, the map naming private data and home',
    { wait: 14000, q: refs(`${REG}@data-br`, `${HOME}@home-br`),
      addr: `${WT}@app-head:app/index.html?view=app&appRepo=${WT}&appPath=pages/entities.html&appRef=view-br` }),
  C('R5p', 'the same, the view page adopting the map in one line',
    { wait: 14000, q: refs(`${REG}@data-br`, `${HOME}@home-br`), pages: ['entities'],
      addr: `${WT}@app-head:app/index.html?view=app&appRepo=${WT}&appPath=pages/entities.html&appRef=view-br` }),
  C('R6', 'the web-tools app (this branch), a home view that names no ref, home from the map',
    { wait: 20000, q: refs(`${HOME}@home-br`),
      addr: `${WT}@app-head:app/index.html?view=app&appRepo=${HOME}&appPath=projects/budget-drs/submittal/submittal.html` }),
  C('R7', 'top mode: the app with the map, navigated by the app, then reloaded',
    { top: true, wait: 12000, q: `lib=main&${refs(`${REG}@data-br`, `${HOME}@home-br`)}&view=map`,
      addr: `${WT}@app-head:app/index.html` }),
];

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
function served(o, r, url, extra) {
  if (r.kind !== 'fulfill') return r.body;
  const isText = /json|javascript|html|text/.test(r.contentType || '');
  if (!isText) return r.body;
  let body = Buffer.isBuffer(r.body) ? r.body.toString('utf8') : String(r.body);
  const js = o && /\.m?js$/.test(o.path);
  if (/json/.test(r.contentType || '')) {
    try {
      const d = JSON.parse(body);
      if (d && typeof d.content === 'string') {
        let src = Buffer.from(d.content, 'base64').toString('utf8');
        src = applyPatches(o ? o.path : url, src, extra);
        if (js) src += mark(o);
        return JSON.stringify({ ...d, content: Buffer.from(src).toString('base64') });
      }
    } catch {}
  }
  body = applyPatches(o ? o.path : url, body, extra);
  return js ? body + mark(o) : body;
}

// ── run ──────────────────────────────────────────────────────────────────────
let extraForServer = [];
const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
  try {
    let body = await readFile(path.join(root, rel));
    if (/\.(html|js)$/.test(rel)) body = applyPatches(rel, body.toString('utf8'), extraForServer);
    res.writeHead(200, { 'content-type': typeFor(rel) }); res.end(body);
  } catch (e) { res.writeHead(e.message.startsWith('anchor') ? 500 : 404); res.end(e.message); if (e.message.startsWith('anchor')) console.error(e.message); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--no-sandbox'] });
console.log(unpatched ? 'UNPATCHED: the shipped code, no map support' : 'PATCHED: the E11 prototype');

for (const c of CASES) {
  if (only && !only.has(c.id)) continue;
  extraForServer = c.pages;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const asked = [];
  const depthOf = f => { let d = 0; for (let p = f && f.parentFrame(); p; p = p.parentFrame()) d++; return d; };
  await page.route('**/*', async route => {
    const req = route.request(), url = req.url();
    if (url.startsWith(base)) return route.continue();
    const o = origin(url);
    let f = null; try { f = req.frame(); } catch {}
    if (o) asked.push({ depth: f ? depthOf(f) : -1, ...o });
    const r = resolveCdn(url, root, null, req.headers());
    if (r.kind === 'continue') return route.abort();
    if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
    let body;
    try { body = served(o, r, url, c.pages); } catch (e) { console.error('    ' + e.message); return route.abort(); }
    return route.fulfill({ status: r.status || 200, contentType: r.contentType, body });
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 140)));
  const url = c.top ? `${base}/pages/scratch/toss-top-probe.html?gh=${c.addr}&${c.q}`
    : `${base}/pages/toss-render.html${c.q ? '?' + c.q : ''}#${c.hash || 'gh=' + c.addr}`;
  try { await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(c.wait || 9000); }
  catch (e) { errors.push('goto: ' + e.message); }

  console.log(`\n${c.id}  ${c.what}${c.pages.length ? '  [page patch: ' + c.pages.join(',') + ']' : ''}\n    ${c.q ? '?' + c.q : ''}#${c.hash || 'gh=' + c.addr}`);
  for (const f of page.frames()) {
    const d = depthOf(f);
    const s = await f.evaluate(() => ({
      gh: window.gh ? window.gh.ref : null, lib: window.__lib || null, ref: window.__ref || null,
      refs: window.__refs || null, ran: window.__ran || [], href: location.href.slice(0, 60),
      nested: [...document.querySelectorAll('iframe')].map(i => (i.getAttribute('src') || '').slice(0, 200)).filter(s => /toss-render/.test(s)),
    })).catch(() => null);
    if (!s) continue;
    const g = {};
    for (const t of s.ran) { const k = t.slice(0, t.indexOf(':')); (g[k] = g[k] || []).push(t.slice(t.indexOf(':') + 1)); }
    const ran = Object.entries(g).map(([k, v]) => `${k} ×${v.length}`).join('; ');
    console.log(`    d${d} gh.ref=${s.gh} __lib=${s.lib} __ref=${s.ref} __refs=${s.refs ? JSON.stringify(s.refs) : null}`);
    console.log(`       ran: ${ran || '(nothing stamped)'}`);
    for (const n of s.nested) console.log(`       frames a renderer at: ${n}`);
  }
  if (c.top) {
    // The app runs as the top document: navigate the way the app does, reload,
    // and ask it for a hub view's address and a home view's.
    const state = async (label) => {
      const d = await page.evaluate(() => {
        const sh = window.__shell, out = { refs: window.__refs || null, lib: window.__lib || null, view: sh && sh.view };
        if (sh) {
          sh.appView = { key: 'p1', repo: 'mehrlander/web-tools', path: 'pages/entities.html' }; out.hub = sh.appViewUrl;
          sh.appView = { key: 'p2', repo: 'mehrlander/home', path: 'projects/budget-drs/submittal/submittal.html' }; out.home = sh.appViewUrl;
          sh.appView = null;
        }
        return out;
      }).catch(e => ({ error: e.message.slice(0, 80) }));
      console.log(`    ${label}: ${page.url().replace(base, '').slice(0, 170)}`);
      console.log(`       __refs=${JSON.stringify(d.refs)} __lib=${d.lib} view=${d.view}${d.error ? ' ' + d.error : ''}`);
      console.log(`       hub view  -> ${d.hub}`);
      console.log(`       home view -> ${d.home}`);
    };
    await state('loaded');
    await page.evaluate(() => window.__shell.goTools()).catch(() => {});
    await page.waitForTimeout(600);
    await state('after the app navigates');
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(c.wait);
    await state('after reload');
  }
  if (c.readLibrary) {
    for (const f of page.frames()) {
      const got = await f.evaluate(() => {
        const el = [...document.querySelectorAll('[x-data]')].find(e => /library/.test(e.getAttribute('x-data')));
        if (!el || !window.Alpine) return null;
        const d = Alpine.$data(el);
        return { rows: (d.rows || []).length, dataRef: d.DATA_REF, deviceRef: d.DEVICE_REF };
      }).catch(() => null);
      if (got) console.log('    library state: ' + JSON.stringify(got));
    }
  }
  // Every non-code read, by frame depth and repo@ref: what the documents
  // actually asked for, which is the evidence for data.
  const data = {};
  for (const a of asked) {
    if (/\.m?js$/.test(a.path) || (a.depth < 1 && !/\.html$/.test(a.path))) continue;
    const k = `d${a.depth} ${a.repo}@${a.ref}`;
    (data[k] = data[k] || new Set()).add(a.path);
  }
  for (const [k, v] of Object.entries(data)) console.log(`       read ${k}: ${[...v].slice(0, 3).join(', ')}${v.size > 3 ? ` … (+${v.size - 3})` : ''}`);
  if (errors.length) console.log('    errors: ' + errors.slice(0, 2).join(' | '));
  await ctx.close();
}
await browser.close(); server.close();
