#!/usr/bin/env node
// showing-refs-probe.mjs — the selection (docs/loader.md, "The selection"),
// measured on the committed code: a link names what to show, and for any
// repository its code reads, the ref to read it at.
//
//   node tools/test/showing-refs-probe.mjs [--only R1,R3]
//
// Experiment E11 of docs/showing-consolidation.md. Until 2026-09-29 this probe
// applied the selection as patches of the bytes it served; the selection is in
// the code now, so it serves the working tree as it is.
//
// DISTINGUISHABLE CONTENT. The harness answers every ref it has no checkout for
// from the working tree, so the bytes of two such refs are identical. The probe
// makes them distinguishable: every JavaScript file it serves records
// `repo@ref:path`, from the URL that asked for it, on window.__ran when it
// executes, and a JSON object gains `__servedFrom`, which a page's own state
// then carries. So the report says which version each document EXECUTED and
// CONSUMED, not only which it requested. A CSV or HTML read is recorded from
// its request. A file served by GitHub Pages is stamped `deployed`.
//
// Two caveats the refs below are chosen around. A ref the local checkout HAS
// (main) is served from git, so the app is addressed at `app-head`, a ref no
// checkout has, to serve this branch's app; and the nested views the app opens
// go to the deployed renderer, which the harness serves from this working tree,
// so they measure the renderer as it will be once merged, not as it is live.
// Not part of `npm test` (needs a browser).

import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? new Set(argv[argv.indexOf('--only') + 1].split(',')) : null;
const WT = 'mehrlander/web-tools', REG = 'mehrlander/web-tools-private', HOME = 'mehrlander/home';

const refs = (...xs) => xs.map(x => 'refs=' + x).join('&');
const CSV = 'projects/budget-drs/data/design/domains.csv';
const APP = `${WT}@app-head:app/index.html`;
const C = (id, what, o) => ({ id, what, ...o });
const CASES = [
  C('R1', 'a home CSV at one branch, the web-tools viewer at another',
    { q: refs(`${WT}@viewer-br`), hash: `data=${HOME}@csv-br:${CSV}` }),
  C('R1b', 'the same CSV addressed without a ref, its version from the selection',
    { q: refs(`${WT}@viewer-br`, `${HOME}@csv-br`), hash: `data=${HOME}:${CSV}` }),
  C('R1c', 'the same CSV, every override removed',
    { hash: `data=${HOME}:${CSV}` }),
  C('R2', 'shortcut-tools page, private data and Web Tools, each from the selection',
    { q: refs(`${REG}@data-br`, `${WT}@lib-br`), addr: `mehrlander/shortcut-tools@page-br:pages/library.html`, readLibrary: true }),
  C('R2d', "the same, the page's own ?data= against the selection",
    { q: refs(`${REG}@data-br`, `${WT}@lib-br`), addr: `mehrlander/shortcut-tools@page-br:pages/library.html?data=own-br`, readLibrary: true }),
  C('R4', 'a web-tools page at a branch, the selection putting its dependencies at main',
    { q: refs(`${WT}@main`), addr: `${WT}@page-br:pages/diff-tool.html` }),
  C('R5', 'the app, one hub view at its own branch, the selection naming private data and home',
    { wait: 16000, q: refs(`${REG}@data-br`, `${HOME}@home-br`),
      addr: `${APP}?view=app&appRepo=${WT}&appPath=pages/entities.html&appRef=view-br` }),
  C('R6', 'the app, a home view that names no ref, home from the selection',
    { wait: 20000, q: refs(`${HOME}@home-br`),
      addr: `${APP}?view=app&appRepo=${HOME}&appPath=projects/budget-drs/submittal/submittal.html` }),
  C('R8', 'the budget-drs app at one branch framing its submittal tenant, one tenant file at another',
    { wait: 25000, q: refs(`${HOME}@tenant-br:projects/budget-drs/submittal/link-rewrite.js`),
      addr: `${HOME}@app-br:projects/budget-drs/app/view/app.html?view=submittal` }),
  C('R9', 'one changed component over an unchanged app: the app at main, map.js at a branch',
    { wait: 16000, q: refs(`${WT}@comp-br:lib/alpineComponents/map.js`), addr: `${APP}?view=map` }),
  C('R9b', 'the same app without the entry: map.js from the build',
    { wait: 16000, addr: `${APP}?view=map` }),
  C('R10', 'a routed viewer at a path entry, everything else at main',
    { q: refs(`${WT}@viewer-file-br:pages/data-view.html`), hash: `data=${HOME}:${CSV}` }),
  C('R12', 'one gh.load file from another ref, the rest of the library at the viewer\'s',
    { q: refs(`${WT}@viewer-br`, `${WT}@file-br:lib/alpineComponents/viewer.js`), hash: `data=${HOME}:${CSV}` }),
  C('R7', 'top mode: the app with the selection, navigated by the app, then reloaded',
    { top: true, wait: 12000, q: `lib=main&${refs(`${REG}@data-br`, `${HOME}@home-br`)}&view=map`, addr: APP }),
  // The renderer's own top mode (?top): the same prelude, inliner, fetch shim
  // and selection as a frame, with the page as the tab's document.
  C('T1', 'renderer top mode: the app with the selection, navigated by the app, reloaded, Back',
    { topRender: true, wait: 14000, q: `lib=main&${refs(`${REG}@data-br`, `${HOME}@home-br`)}&view=map`, addr: APP }),
  C('T2', 'renderer top mode: a private home page whose relative scripts only the inliner can reach, one at another ref',
    { topRender: true, wait: 20000, q: refs(`${HOME}@tenant-br:projects/budget-drs/submittal/link-rewrite.js`),
      addr: `${HOME}@page-br:projects/budget-drs/submittal/submittal.html` }),
  C('T3', 'renderer top mode: a routed viewer, the CSV at one ref and the viewer at another',
    { topRender: true, wait: 12000, q: refs(`${WT}@viewer-br`), hash: `data=${HOME}@csv-br:${CSV}` }),
  C('T4', 'renderer top mode: the budget-drs app, its relative fetch and its framed tenant, one tenant file at another ref',
    { topRender: true, wait: 25000, q: `${refs(`${HOME}@tenant-br:projects/budget-drs/submittal/link-rewrite.js`)}&view=submittal`,
      addr: `${HOME}@app-br:projects/budget-drs/app/view/app.html` }),
  // A page that writes its query WITHOUT the selection (the app carries its
  // whole query forward, which is why T1 and R7 never saw this): two
  // repositories, a file entry and a folder entry, then a reload, Back, and a
  // reload at the entry Back reached. Review finding, 2026-09-29.
  C('T5', 'renderer top mode: a bare page write, then reload and Back, keeps the whole selection',
    { topRender: true, bareWrite: true, wait: 12000,
      q: `lib=main&${refs(`${HOME}@home-br`, `${REG}@data-br`, `${HOME}@tenant-br:projects/budget-drs/submittal/link-rewrite.js`, `${WT}@comp-br:lib/alpineComponents/`)}&view=map`,
      addr: APP }),
  C('R7b', 'the launcher: the same bare write, reload and Back',
    { top: true, bareWrite: true, wait: 12000,
      q: `lib=main&${refs(`${HOME}@home-br`, `${REG}@data-br`, `${HOME}@tenant-br:projects/budget-drs/submittal/link-rewrite.js`, `${WT}@comp-br:lib/alpineComponents/`)}&view=map`,
      addr: APP }),
  C('R11', 'framed: the renderer reloaded keeps its selection',
    { reload: true, q: refs(`${HOME}@csv-br`, `${WT}@viewer-br`), hash: `data=${HOME}:${CSV}` }),
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
function served(o, r) {
  if (r.kind !== 'fulfill' || !o) return r.body;
  if (!/json|javascript|text/.test(r.contentType || '')) return r.body;
  const body = Buffer.isBuffer(r.body) ? r.body.toString('utf8') : String(r.body);
  const js = /\.m?js$/.test(o.path), json = /\.json$/.test(o.path);
  const stampJson = (src) => {
    try {
      const inner = JSON.parse(src);
      if (!inner || typeof inner !== 'object' || Array.isArray(inner)) return src;
      if (inner.meta && typeof inner.meta === 'object') inner.meta.__servedFrom = tag(o); else inner.__servedFrom = tag(o);
      return JSON.stringify(inner);
    } catch { return src; }
  };
  if (/json/.test(r.contentType || '') && /^\s*\{/.test(body)) {
    try {
      const d = JSON.parse(body);
      if (d && typeof d.content === 'string') {
        let src = Buffer.from(d.content, 'base64').toString('utf8');
        if (js) src += mark(o); else if (json) src = stampJson(src);
        return JSON.stringify({ ...d, content: Buffer.from(src).toString('base64') });
      }
    } catch {}
  }
  if (js) return body + mark(o);
  if (json) return stampJson(body);
  return body;
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

async function report(page, asked, c) {
  const depthOf = f => { let d = 0; for (let p = f && f.parentFrame(); p; p = p.parentFrame()) d++; return d; };
  for (const f of page.frames()) {
    const d = depthOf(f);
    const s = await f.evaluate(() => ({
      gh: window.gh ? window.gh.ref : null, lib: window.__lib || null, ref: window.__ref || null,
      refs: window.__refs || null, implied: window.__refsImplied || null, ran: window.__ran || [],
      nested: [...document.querySelectorAll('iframe')].map(i => (i.getAttribute('src') || '')).filter(s => /toss-render/.test(s)).map(s => s.slice(0, 220)),
    })).catch(() => null);
    if (!s || (!s.gh && !s.ran.length && !s.refs)) continue;
    const g = {};
    for (const t of s.ran) { const k = t.slice(0, t.indexOf(':')); (g[k] = g[k] || []).push(t.slice(t.indexOf(':') + 1)); }
    const ran = Object.entries(g).map(([k, v]) => `${k} ×${v.length}${v.length <= 2 ? ' (' + v.join(', ') + ')' : ''}`).join('; ');
    console.log(`    d${d} gh.ref=${s.gh} __lib=${s.lib} __ref=${s.ref}`);
    if (s.refs) console.log(`       __refs=${JSON.stringify(s.refs)} __refsImplied=${JSON.stringify(s.implied)}`);
    console.log(`       ran: ${ran || '(nothing stamped)'}`);
    for (const n of s.nested) console.log(`       frames a renderer at: ${n}`);
  }
  if (c.id === 'R8') {
    for (const f of page.frames()) {
      const t = await f.evaluate(() => ({ href: location.href.slice(0, 40), title: document.title,
        errs: [...document.querySelectorAll('[data-inline-error]')].map(e => e.getAttribute('data-inline-error')).slice(0, 2),
        scripts: document.scripts.length, linkRewrite: typeof window.__linkRewrite })).catch(() => null);
      if (t && /^blob:/.test(t.href)) console.log('    tenant: ' + JSON.stringify(t));
    }
  }
  if (c.readLibrary) {
    for (const f of page.frames()) {
      const got = await f.evaluate(() => {
        const el = [...document.querySelectorAll('[x-data]')].find(e => /library/.test(e.getAttribute('x-data')));
        if (!el || !window.Alpine) return null;
        const d = Alpine.$data(el);
        return { consumed: d.meta && d.meta.__servedFrom || null, rows: (d.rows || []).length, dataRef: d.DATA_REF, deviceRef: d.DEVICE_REF };
      }).catch(() => null);
      if (got) console.log('    library state: ' + JSON.stringify(got));
    }
  }
  const data = {};
  for (const a of asked) {
    if (/\.m?js$/.test(a.path) || (a.depth < 1 && !/\.(html|csv)$/.test(a.path))) continue;
    const k = `d${a.depth} ${a.repo}@${a.ref}`;
    (data[k] = data[k] || new Set()).add(a.path);
  }
  for (const [k, v] of Object.entries(data)) console.log(`       read ${k}: ${[...v].slice(0, 3).join(', ')}${v.size > 3 ? ` … (+${v.size - 3})` : ''}`);
  // Every file a path entry names, wherever it was requested from: the evidence
  // for an entry is the ref its file was asked at, whether or not it executed
  // somewhere stamps can see (an inlined script does not pass through here).
  const named = new URLSearchParams(c.q || '').getAll('refs').map(v => (v.match(/^[^@]+@[^:]+:(.+)$/) || [])[1]).filter(Boolean);
  for (const p of named) {
    const hits = asked.filter(a => a.path === p || (p.endsWith('/') && a.path.startsWith(p)));
    console.log(`       entry ${p}: requested at ${[...new Set(hits.map(a => `d${a.depth} ${a.repo}@${a.ref}`))].join(', ') || 'never'}`);
  }
  if (c.id === 'R9b') {
    const comp = asked.filter(a => /alpineComponents\/map\.js$/.test(a.path));
    console.log(`       map.js requested: ${comp.map(a => a.repo + '@' + a.ref).join(', ') || 'never (served from the build)'}`);
  }
}

for (const c of CASES) {
  if (only && !only.has(c.id)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  let asked = [];
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
    return route.fulfill({ status: r.status || 200, contentType: r.contentType, body: served(o, r) });
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 140)));
  const url = c.top ? `${base}/pages/scratch/toss-top-probe.html?gh=${c.addr}&${c.q}`
    : c.topRender ? (c.hash ? `${base}/pages/toss-render.html?top&${c.q}&${c.hash}` : `${base}/pages/toss-render.html?top&gh=${c.addr}&${c.q}`)
    : `${base}/pages/toss-render.html${c.q ? '?' + c.q : ''}#${c.hash || 'gh=' + c.addr}`;
  try { await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(c.wait || 9000); }
  catch (e) { errors.push('goto: ' + e.message); }
  console.log(`\n${c.id}  ${c.what}\n    ${url.replace(base, '')}`);
  await report(page, asked, c);

  if (c.reload) {
    asked = [];
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(c.wait || 9000);
    console.log(`    after reload: ${page.url().replace(base, '')}`);
    await report(page, asked, c);
  }
  if (c.topRender) {
    const top = await page.evaluate(() => ({ frames: document.querySelectorAll('iframe').length, title: document.title,
      topFlag: !!window.__tossTop, fabHosted: !!window.__fabHosted, gh: window.gh && window.gh.ref,
      fabs: document.querySelectorAll('[x-data^="fab"]').length, sees: [...new URLSearchParams(location.search).keys()].join(',') })).catch(e => ({ error: e.message }));
    console.log('    top document: ' + JSON.stringify(top));
  }
  if (c.top || (c.topRender && c.id === 'T1')) {
    const state = async (label) => {
      const d = await page.evaluate(() => {
        const sh = window.__shell, out = { refs: window.__refs || null, lib: window.__lib || null, view: sh && sh.view };
        if (sh) {
          const keep = sh.appView;
          sh.appView = { key: 'p1', repo: 'mehrlander/web-tools', path: 'pages/entities.html' }; out.hub = sh.appViewUrl;
          sh.appView = { key: 'p2', repo: 'mehrlander/home', path: 'projects/budget-drs/submittal/submittal.html' }; out.home = sh.appViewUrl;
          sh.appView = keep;
        }
        return out;
      }).catch(e => ({ error: e.message.slice(0, 80) }));
      console.log(`    ${label}: ${page.url().replace(base, '').slice(0, 190)}`);
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
    await page.goBack().catch(() => {}); await page.waitForTimeout(1500);
    console.log(`    back: ${page.url().replace(base, '').slice(0, 190)}`);
  }
  if (c.bareWrite) {
    // Checked, not only printed: the tab's URL must carry every entry the link
    // did, and the page must read all of them back as window.__refs.
    const want = new URLSearchParams(c.q).getAll('refs').sort();
    const wantKeys = want.length + 1;  // the entries, and lib=main as the web-tools entry
    let bad = 0;
    const check = async (label) => {
      const got = new URL(page.url()).searchParams.getAll('refs').sort();
      const n = await page.evaluate(() => Object.keys(window.__refs || {}).length).catch(() => -1);
      const view = new URL(page.url()).searchParams.get('view');
      const ok = JSON.stringify(got) === JSON.stringify(want) && (n === wantKeys || n === -1 && label.startsWith('after the'));
      if (!ok) bad++;
      console.log(`    ${ok ? 'ok  ' : 'LOST'} ${label}: view=${view} refs in URL ${got.length}/${want.length}, __refs keys ${n}/${wantKeys}`);
    };
    await check('loaded');
    await page.evaluate(() => history.pushState(null, '', '?view=tools'));
    await check('after the page writes ?view=tools');
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(c.wait);
    await check('after reload');
    await page.goBack().catch(() => {}); await page.waitForTimeout(1500);
    await check('after Back');
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(c.wait);
    await check('after reload at the Back entry');
    console.log(`    ${bad ? 'FAIL: ' + bad + ' step(s) lost part of the selection' : 'PASS: the whole selection survived every step'}`);
  }
  if (errors.length) console.log('    errors: ' + [...new Set(errors)].slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close(); server.close();
