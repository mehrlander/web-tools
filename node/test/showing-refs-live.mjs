#!/usr/bin/env node
// showing-refs-live.mjs — the selection (docs/loader.md, "The selection")
// against live GitHub, before merge.
//
//   node node/test/showing-refs-live.mjs --sha <pushed web-tools commit> \
//     --st <shortcut-tools commit> --old <older web-tools commit> --data <older web-tools-private commit>
//
// Experiment E12 of docs/showing-consolidation.md. The deployed renderer is
// main's and reads no selection, so this serves THIS checkout's renderer, which
// must be byte-identical to the pushed commit named by --sha, from a loopback
// origin, and sends every other request to GitHub itself: Pages for entry.js,
// raw and the contents API for everything else, through the sandbox's proxy.
// Main's entry.js and gh-api.js read no selection either, so every case asks
// for Web Tools at --sha, which makes entry.js blob-import this branch's
// gh-api.js from raw; a case that selected nothing would measure main's.
//
// The evidence is each request's repository, ref and status, and, where a
// page exposes it, what the page consumed. Nothing is stamped: the bytes are
// GitHub's. Not part of `npm test` (needs a browser and the network).

import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const arg = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : '');
const SHA = arg('--sha'), ST = arg('--st'), OLD = arg('--old'), DATA = arg('--data');
const only = argv.includes('--only') ? new Set(arg('--only').split(',')) : null;
if (!SHA || !ST || !OLD || !DATA) { console.error('--sha, --st, --old and --data are required'); process.exit(2); }
const WT = 'mehrlander/web-tools', REG = 'mehrlander/web-tools-private';
const refs = (...xs) => xs.map(x => 'refs=' + x).join('&');

const CASES = [
  ['LV1', 'a web-tools CSV at an older commit, its viewer at the branch',
    refs(`${WT}@${SHA}`), `data=${WT}@${OLD}:docs/showing-mechanisms.csv`],
  ['LV2', 'the same CSV addressed with no ref, its version from the selection',
    refs(`${WT}@${SHA}`, `${WT}@${OLD}:docs/showing-mechanisms.csv`), `data=${WT}:docs/showing-mechanisms.csv`],
  ['LV3', 'one library file from an older commit, the rest at the branch',
    refs(`${WT}@${SHA}`, `${WT}@${OLD}:lib/alpineComponents/viewer.js`), `data=${WT}:docs/showing-mechanisms.csv`],
  ['LV4', 'shortcut-tools page at its branch, private data at an older commit, Web Tools at the branch',
    refs(`${WT}@${SHA}`, `${REG}@${DATA}`), `gh=mehrlander/shortcut-tools@${ST}:pages/library.html`, true],
  ['LV5', 'the same page with the private-data entry removed',
    refs(`${WT}@${SHA}`), `gh=mehrlander/shortcut-tools@${ST}:pages/library.html`, true],
];

// The renderer is served by interception at a stand-in https origin; every
// other request continues to GitHub through the proxy. (A loopback server was
// tried first: Chromium sent its page load to the proxy, which answered 405.)
const HOST = 'https://render.invalid';
const RENDERER = await readFile(path.join(root, 'pages/toss-render.html'), 'utf8');
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
// HTTP/2 through the proxy died with ERR_TOO_MANY_RETRIES on most requests
// (2026-09-29); HTTP/1.1 completes.
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-http2'], ...(proxy ? { proxy: { server: proxy } } : {}) });

function where(u) {
  let x; try { x = new URL(u); } catch { return null; }
  if (x.host === 'mehrlander.github.io') return { repo: x.pathname.split('/')[1], ref: 'Pages (main)', path: x.pathname.split('/').slice(2).join('/') };
  if (x.host === 'raw.githubusercontent.com') { const [, , repo, ref, ...rest] = x.pathname.split('/'); return { repo, ref, path: rest.join('/') }; }
  const m = x.host === 'api.github.com' && x.pathname.match(/^\/repos\/[^/]+\/([^/]+)\/contents\/(.*)$/);
  return m ? { repo: m[1], ref: x.searchParams.get('ref') || '(default)', path: decodeURIComponent(m[2]) } : null;
}
const short = r => /^[0-9a-f]{40}$/.test(r) ? r.slice(0, 7) : r;

for (const [id, what, q, hash, library] of CASES) {
  if (only && !only.has(id)) continue;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const seen = [];
    let failed = 0;
    page.on('response', r => { const w = where(r.url()); if (w) seen.push({ ...w, status: r.status() }); });
    page.on('requestfailed', r => { if (where(r.url())) failed++; });
    await page.route(HOST + '/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: RENDERER }));
    const url = `${HOST}/pages/toss-render.html?${q}#${hash}`;
    page.on('pageerror', e => console.log('    pageerror ' + e.message.slice(0, 120)));
    try { await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(library ? 50000 : 40000); } catch (e) { console.log('    goto: ' + e.message.slice(0, 160)); }
    // A case is retried only when the framed page never booted; a request the
    // proxy dropped and the library's own retry recovered is reported, not
    // treated as a failed case.
    const booted = await Promise.all(page.frames().map(f => f.evaluate(() => !!(window.gh && window.__refs)).catch(() => false)));
    if (!booted.some(Boolean) && attempt < 3) { await ctx.close(); continue; }
    console.log(`\n${id}  ${what}${attempt > 1 ? `  (attempt ${attempt})` : ''}\n    ?${q.replace(new RegExp(SHA, 'g'), 'SHA')}#${hash.replace(new RegExp(ST, 'g'), 'ST')}`);
    const groups = {};
    for (const s of seen) {
      const k = `${s.repo}@${short(s.ref)}`;
      (groups[k] = groups[k] || []).push(`${s.path}${s.status === 200 ? '' : ' ' + s.status}`);
    }
    for (const [k, v] of Object.entries(groups)) console.log(`    ${k} ×${v.length}: ${v.filter(p => !/^lib\/(kits|alpineComponents|gh-)/.test(p) || /viewer\.js/.test(p)).slice(0, 4).join(', ')}`);
    for (const f of page.frames()) {
      const s = await f.evaluate(() => ({ gh: window.gh && window.gh.ref, refs: window.__refs || null, ref: window.__ref || null })).catch(() => null);
      if (s && s.refs && Object.keys(s.refs).length) console.log(`    frame gh.ref=${short(s.gh || '')} __ref=${short(s.ref || '')} __refs=${JSON.stringify(s.refs).replace(new RegExp(SHA, 'g'), 'SHA')}`);
      if (library) {
        const got = await f.evaluate(() => {
          const el = [...document.querySelectorAll('[x-data]')].find(e => /library/.test(e.getAttribute('x-data')));
          if (!el || !window.Alpine) return null;
          const d = Alpine.$data(el);
          return { generated: d.meta && (d.meta.generated || d.meta.generatedAt) || null, rows: (d.rows || []).length, dataRef: d.DATA_REF };
        }).catch(() => null);
        if (got) console.log('    library consumed: ' + JSON.stringify(got));
      }
    }
    if (failed) console.log(`    ${failed} request(s) failed in transit (ERR_TOO_MANY_RETRIES through the proxy); a retried one appears above with its status`);
    await ctx.close();
    break;
  }
}
await browser.close();
