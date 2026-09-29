#!/usr/bin/env node
// showing-version-map.mjs — which version every document in a showing link
// actually asks for, file by file.
//
//   node tools/test/showing-version-map.mjs [--json out.json] [--only C1,C8]
//
// Experiment E5 of docs/showing-consolidation.md. A preview is only faithful if
// each document in it (the host, the framed page, anything nested) fetches its
// own code and content at the ref the link meant. That cannot be read off the
// screen, because every version renders something plausible. It can be read off
// the network: raw.githubusercontent and the contents API put the ref in the
// URL, and GitHub Pages is always the deployed default branch. So this renders
// each case headlessly and attributes every own-code request to the frame that
// made it, by depth.
//
// FIDELITY. The harness (tools/render/cdn.mjs) answers every ref from the
// working tree, so a ref that would 404 on GitHub renders here anyway. That is
// deliberate for this probe: the question is which ref each request ASKED for,
// and the answer is in the URL whatever came back. Refs are slash-free for the
// same reason (the harness strips a raw ref by one segment when it cannot know
// it). The one fixture page is fulfilled at the contents API, the way
// tools/test/toss-width.mjs fulfills its own.
//
// Not part of `npm test` (needs a browser). Prints a report; exits nonzero only
// if a case failed to render at all, since a wrong version is the finding, not
// a failure of the probe.

import http from 'node:http';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const jsonOut = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null;
const only = argv.includes('--only') ? new Set(argv[argv.indexOf('--only') + 1].split(',')) : null;

const REF = 'probe-ref';   // the ref every case addresses; anything else in a URL came from somewhere else
const WT = 'mehrlander/web-tools';

// A page that reaches its own siblings every way a page can: a stylesheet link
// and a script src (both inlined by toss-render), a runtime fetch (rerouted by
// its fetch shim), and four the toss handles neither way: an <img>, a CSS
// url(), a dynamic import() and an <iframe src>. Relative, all of them.
const REL_PATH = 'pages/__probe-rel.html';
const REL_HTML = `<!doctype html><html><head><title>rel probe</title>
<link rel="stylesheet" href="__rel.css">
<style>body{background:url('__rel-bg.png')}</style>
</head><body>
<img src="__rel.png" alt="">
<iframe src="__rel-frame.html"></iframe>
<script src="__rel-script.js"></script>
<script type="module">
  try { await import('./__rel-mod.js'); } catch (e) {}
  try { await fetch('./__rel.json'); } catch (e) {}
</script>
</body></html>`;

const CASES = [
  { id: 'C1', expect: { 1: REF }, what: 'web-tools page on the entry.js chain, at a ref',
    addr: `${WT}@${REF}:pages/diff-tool.html` },
  { id: 'C2', expect: { 1: 'main' }, what: 'web-tools page with no @ref',
    addr: `${WT}:pages/diff-tool.html` },
  { id: 'C3', expect: { 1: REF }, what: 'pre-build page (own ?use= blob boot of a dist bundle), at a ref',
    addr: `${WT}@${REF}:pages/inquiry.html` },
  { id: 'C4', expect: { 1: REF }, what: 'the whole app at a ref (dist/app.js)',
    addr: `${WT}@${REF}:app/index.html` },
  { id: 'C5', expect: { 1: REF, 3: REF }, what: 'the app at a ref, framing a promoted page (app view)',
    addr: `${WT}@${REF}:app/index.html?view=app&appRepo=${WT}&appPath=pages/diff-tool.html` },
  { id: 'C6', expect: { 1: 'main' }, what: 'data route: content at a ref, viewer by route',
    hash: `data=${WT}@${REF}:docs/subjects.csv` },
  { id: 'C7', expect: { 1: REF, 2: REF }, what: 'nested toss: the renderer at a ref, framing a page at the ref',
    addr: `${WT}@${REF}:pages/toss-render.html#gh=${WT}@${REF}:pages/diff-tool.html` },
  { id: 'C8', expect: { 1: 'main' }, what: 'cross-repo page that pins its import (home, budget-drs submittal)',
    addr: `mehrlander/home@${REF}:projects/budget-drs/submittal/submittal.html` },
  { id: 'C9', expect: { 1: 'main' }, what: 'cross-repo page with a plain entry.js import (shortcut-tools library)',
    addr: `mehrlander/shortcut-tools@${REF}:pages/library.html` },
  { id: 'C10', expect: { 1: REF }, what: 'page whose own query carries ref= (repo-atlas)',
    addr: `${WT}@${REF}:pages/repo-atlas.html?repo=${WT}&ref=feature` },
  { id: 'C11', expect: {}, what: 'relative assets of every kind, at a ref',
    addr: `${WT}@${REF}:${REL_PATH}` },
  { id: 'C12', expect: { 1: REF }, what: 'the ref switcher\'s link shape: ?use= on the shell and @ref on the page',
    query: `?use=${REF}`, addr: `${WT}@${REF}:pages/diff-tool.html` },
];

// `expect` is the lib ref each framed document (by depth) SHOULD boot under
// the proposed contract: the content's ref for a web-tools subject, main for
// another repo's page or a viewer, unless ?lib= says otherwise. The host (d0)
// is main by design and is not scored. C5's d3 is the page an app view frames,
// which a reader of the app at a branch means to see at that branch too.

// ── classify a request URL by where the ref lives in it ──────────────────────
function classify(url) {
  let u; try { u = new URL(url); } catch { return null; }
  if (u.host === 'mehrlander.github.io') {
    const [, repo, ...rest] = u.pathname.split('/');
    const pin = u.searchParams.get('ref');
    return { via: 'pages', repo, ref: 'deployed' + (pin ? ` (?ref=${pin})` : ''), path: rest.join('/') };
  }
  if (u.host === 'raw.githubusercontent.com') {
    const [, owner, repo, ref, ...rest] = u.pathname.split('/');
    return { via: 'raw', repo: `${repo}`, ref, path: rest.join('/') };
  }
  if (u.host === 'api.github.com') {
    const m = u.pathname.match(/^\/repos\/[^/]+\/([^/]+)\/(contents|git\/blobs|git\/trees|commits)(?:\/(.*))?$/);
    if (!m) return null;
    return { via: 'api ' + m[2], repo: m[1], ref: u.searchParams.get('ref') || (m[2] === 'contents' ? '(default)' : ''),
             path: decodeURIComponent(m[3] || '') };
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
  try { res.writeHead(200, { 'content-type': typeFor(rel) }); res.end(await readFile(path.join(root, rel))); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const report = [];
let hardFail = 0;

for (const c of CASES) {
  if (only && !only.has(c.id)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const reqs = [];
  const depthOf = (f) => { let d = 0; for (let p = f && f.parentFrame(); p; p = p.parentFrame()) d++; return d; };

  await page.route('**/*', route => {
    const req = route.request(), url = req.url();
    let f = null; try { f = req.frame(); } catch {}
    const k = classify(url);
    if (k) reqs.push({ depth: f ? depthOf(f) : -1, ...k });
    if (url.includes(`/contents/${REL_PATH}`)) {
      return route.fulfill({ status: 200, contentType: 'application/vnd.github.raw+json', body: REL_HTML });
    }
    if (url.startsWith(origin)) return route.continue();
    const r = resolveCdn(url, root, null, req.headers());
    if (r.kind === 'continue') return route.abort();
    if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
    return route.fulfill({ status: r.status || 200, contentType: r.contentType, body: r.body });
  });

  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 160)));
  const url = `${origin}/pages/toss-render.html${c.query || ''}#${c.hash || 'gh=' + c.addr}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(7000);
  } catch (e) { errors.push('goto: ' + e.message); }

  // What each document believes about itself once it settles.
  const frames = [];
  for (const f of page.frames()) {
    const state = await f.evaluate(() => {
      const fab = (() => {
        try {
          const el = document.querySelector('[x-data^="fab"]');
          if (!el || !window.Alpine) return null;
          const d = Alpine.$data(el);
          return { mounted: !!d, viaToss: !!d.viaToss, previewRef: d.previewRef || null,
                   ignoredUse: d.ignoredUse || null, loaderRef: d.loaderRef || null, offRef: !!d.offRef };
        } catch { return null; }
      })();
      return {
        gh: window.gh ? { repo: window.gh.repo, ref: window.gh.ref } : null,
        bundleRef: window.__bundleRef || null, ref: window.__ref || null, lib: window.__lib || null,
        fabHosted: !!window.__fabHosted, subject: window.__tossSubject || null,
        fab, title: document.title.slice(0, 60),
      };
    }).catch(() => null);
    frames.push({ depth: depthOf(f), url: f.url().slice(0, 90), state });
  }
  if (!frames.some(f => f.depth >= 1)) hardFail++;

  // Collapse to one row per (depth, via, repo, ref), keeping the files.
  const rows = new Map();
  for (const r of reqs) {
    const key = [r.depth, r.via, r.repo, r.ref].join('|');
    if (!rows.has(key)) rows.set(key, { depth: r.depth, via: r.via, repo: r.repo, ref: r.ref, files: new Set() });
    rows.get(key).files.add(r.path);
  }
  const out = { ...c, url, errors, frames,
                requests: [...rows.values()].map(r => ({ ...r, files: [...r.files] }))
                  .sort((a, b) => a.depth - b.depth || a.via.localeCompare(b.via)) };
  // The verdict: the evidence a reliable check would read, applied. One, the
  // lib ref each document actually booted against the ref it should have.
  // Two, any file a framed document took from the DEPLOYED site other than the
  // boot itself, which is main whatever the address said.
  const verdict = [];
  for (const [d, want] of Object.entries(c.expect || {})) {
    const doc = frames.find(f => f.depth === +d && f.state && f.state.gh);
    const got = doc ? doc.state.gh.ref : null;
    verdict.push(got === want ? `ok    d${d} lib ${got}` : `WRONG d${d} lib ${got}, meant ${want}`);
  }
  const BOOT = new Set(['lib/entry.js', 'lib/gh-api.js', 'pages/toss-render.html']);
  for (const r of out.requests) {
    if (r.depth < 1 || r.via !== 'pages') continue;
    const leaked = r.files.filter(f => !BOOT.has(f));
    if (leaked.length) verdict.push(`DEPLOYED d${r.depth} ${leaked.join(', ')}`);
  }
  // Three, per-file blob shas, which gh-boot records for every load. Whether
  // they exist here is the question; matching them to a tree is the check.
  const shas = [];
  for (const f of page.frames()) {
    const n = await f.evaluate(() => Object.values(window.__ghFiles || {})
      .filter(x => /^[0-9a-f]{40}$/.test(x.sha) || /^build:/.test(x.sha)).length).catch(() => 0);
    if (n) shas.push(`d${depthOf(f)}:${n}`);
  }
  out.verdict = verdict; out.shaEvidence = shas;
  report.push(out);

  console.log(`\n${c.id}  ${c.what}\n    ${c.query || ''}#${c.hash || 'gh=' + c.addr}`);
  for (const f of frames) {
    const s = f.state || {};
    const fab = s.fab ? ` fab{viaToss:${s.fab.viaToss} previewRef:${s.fab.previewRef} ignoredUse:${s.fab.ignoredUse} loaderRef:${s.fab.loaderRef}}` : '';
    console.log(`    doc d${f.depth}: gh=${s.gh ? s.gh.repo + '@' + s.gh.ref : '-'} __ref=${s.ref} __lib=${s.lib}${fab}  ${f.url}`);
  }
  for (const r of out.requests) {
    const files = r.files.length > 4 ? r.files.slice(0, 4).join(', ') + ` … (+${r.files.length - 4})` : r.files.join(', ');
    console.log(`      d${r.depth} ${r.via.padEnd(15)} ${r.repo}@${r.ref}  ${files}`);
  }
  for (const v of verdict) console.log('    ' + v);
  if (shas.length) console.log('    files carrying a blob sha: ' + shas.join(' '));
  if (errors.length) console.log('    errors: ' + errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
server.close();
if (jsonOut) await writeFile(jsonOut, JSON.stringify(report, null, 2));
process.exit(hardFail ? 1 : 0);
