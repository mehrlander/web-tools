#!/usr/bin/env node
// showing-live-probe.mjs — the three-repository selection against GitHub itself,
// not the local harness.
//
//   node tools/test/showing-live-probe.mjs --sha <web-tools commit> \
//     [--page <shortcut-tools ref>] [--data <web-tools-private ref>]
//
// Experiment E9 of docs/showing-consolidation.md. The harness answers every ref
// from the working tree, so it can say which version a document asked for but
// not what GitHub serves for it. This drives the deployed renderer on GitHub
// Pages, which fetches real refs from the real API, through the sandbox's
// network proxy (HTTPS_PROXY). The proxy authenticates API reads, which is the
// only reason web-tools-private is reachable here; a reader's browser reaches it
// on the reader's own token.
//
// The deployed renderer is main's, so the branch's renderer is reached the way
// the showing rules say a renderer change is: nested, as the subject of the
// deployed one, with the real subject as its trailing fragment.
//
// DISTINGUISHABLE DATA. The page is shortcut-tools' library, which reads
// shortcuts/library.json from web-tools-private at its own ?data=<ref>. Pick a
// data ref whose library.json differs from main's (the default below has 606
// rows against main's 698 on 2026-09-28), and the page's own state says which
// version it consumed. The library ref is read off each document's loader and
// off the requests it made, with their HTTP status.
//
// Not part of `npm test`: it needs the network and a pushed commit.

import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const SHA = arg('--sha');
const PAGE_REF = arg('--page', 'claude/doc-simplification-followups-n6ft2r');
const DATA_REF = arg('--data', 'claude/budget-drs-benefits-view-bdwaix');
if (!SHA) { console.error('--sha <web-tools commit> is required'); process.exit(2); }

const R = 'https://mehrlander.github.io/web-tools/pages/toss-render.html';
const PAGE = `mehrlander/shortcut-tools@${PAGE_REF}:pages/library.html?data=${DATA_REF}`;
const CASES = [
  ['L1', 'the deployed renderer, as shipped on main', `${R}#gh=${PAGE}`],
  ['L2', "this branch's renderer, ?lib= the branch commit", `${R}#gh=mehrlander/web-tools@${SHA}:pages/toss-render.html?lib=${SHA}#gh=${PAGE}`],
  ['L3', "this branch's renderer, no ?lib=", `${R}#gh=mehrlander/web-tools@${SHA}:pages/toss-render.html#gh=${PAGE}`],
];

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch({ args: ['--no-sandbox'], ...(proxy ? { proxy: { server: proxy } } : {}) });

// The sandbox's proxy drops requests now and then ("Failed to fetch"), which is
// the network and not the page, so a case is retried whole, in a fresh context,
// until a document reports library rows or the renderer reports a real answer.
async function runCase(id, what, url) {
  const out = { done: false, text: `\n${id}  ${what}` };
  const log = (l) => { out.text += '\n' + l; };

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const seen = [];
  page.on('pageerror', e => seen.push('pageerror ' + e.message.slice(0, 120)));
  page.on('response', r => {
    const u = r.url();
    const m = u.match(/raw\.githubusercontent\.com\/mehrlander\/web-tools\/(.+)\/lib\/gh-api\.js/)
      || u.match(/api\.github\.com\/repos\/mehrlander\/(web-tools-private)\/contents\/(shortcuts\/[^?]+)\?ref=([^&]+)/);
    if (m) seen.push(`${r.status()} ${m[1] === 'web-tools-private' ? 'private ' + decodeURIComponent(m[3]) + ' ' + m[2] : 'gh-api.js@' + decodeURIComponent(m[1])}`);
  });
  // The sandbox's proxy drops a navigation now and then; a retry is the network,
  // not the page, so three tries before giving up.
  let ok = false;
  for (let i = 0; i < 3 && !ok; i++) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); ok = true; }
    catch (e) { if (i === 2) log(`   goto failed: ${e.message.split('\n')[0].slice(0, 160)}`); }
  }
  // Poll until a library frame has rows, or 60s pass.
  for (let t = 0; ok && t < 60; t += 3) {
    await page.waitForTimeout(3000);
    let rows = 0;
    for (const f of page.frames()) rows += await f.evaluate(() => {
      const el = [...document.querySelectorAll('[x-data]')].find(e => /library/.test(e.getAttribute('x-data') || ''));
      try { return el && window.Alpine ? (Alpine.$data(el).rows || []).length : 0; } catch (e) { return 0; }
    }).catch(() => 0);
    if (rows) break;
  }
  for (const f of page.frames()) {
    const msg = await f.evaluate(() => (document.getElementById('empty-msg') || {}).textContent || '').catch(() => '');
    if (msg.trim()) log(`   renderer says: ${msg.trim().slice(0, 200)}`);
  }
  for (const f of page.frames()) {
    const s = await f.evaluate(() => {
      const el = [...document.querySelectorAll('[x-data]')].find(e => /library/.test(e.getAttribute('x-data') || ''));
      let lib = null;
      try { if (el && window.Alpine) { const d = Alpine.$data(el); lib = { rows: (d.rows || []).length, shortcuts: d.meta && d.meta.shortcuts, dataRef: d.DATA_REF }; } } catch (e) {}
      return { url: location.href.slice(0, 70), gh: window.gh ? window.gh.ref : null, lib };
    }).catch(() => null);
    if (s && s.lib && s.lib.rows) out.done = true;
    if (s && (s.gh || s.lib || /blob:/.test(s.url))) log(`   ${s.url}\n      gh.ref=${s.gh}${s.lib ? ` library rows=${s.lib.rows} meta.shortcuts=${s.lib.shortcuts} DATA_REF=${s.lib.dataRef}` : ''}`);
  }
  for (const l of [...new Set(seen)]) log('      ' + l);
  // A renderer that answers "not found" or a boot that 404s is an answer, not
  // the network, so it ends the retries too.
  if (seen.some(l => /^404 /.test(l))) out.done = true;
  await ctx.close();

  return out;
}
for (const [id, what, url] of CASES) {
  let out = null;
  for (let i = 0; i < 4; i++) {
    out = await runCase(id, what, url);
    if (out.done) break;
    console.log(`${id}: attempt ${i + 1} incomplete (network), retrying`);
  }
  console.log(out.text);
}
await browser.close();
