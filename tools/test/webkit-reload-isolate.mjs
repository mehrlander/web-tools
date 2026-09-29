#!/usr/bin/env node
// webkit-reload-isolate.mjs — which part of top mode kills WebKit's page on a
// reload at a Back entry.
//
//   node tools/test/webkit-reload-isolate.mjs --sha <web-tools commit> [--engine webkit|chromium]
//
// Found by the first runner runs of top-mode-live.mjs (2026-09-29): through
// the deployed launcher, WebKit passed a page write, a reload and Back, then
// the reload at the Back entry closed the page ("Target page, context or
// browser has been closed"), which is how Playwright reports a dead web
// process. Chromium passed the same sequence. Each variant below removes one
// ingredient, so the ones that survive name what the death needs. A variant
// reports `died` from the page's crash or close event, `survived` when a
// fresh document booted after the last reload, `stalled` otherwise.

import { chromium, webkit } from 'playwright';

const argv = process.argv.slice(2);
const arg = (k, d = '') => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const SHA = arg('--sha'), ENGINE = arg('--engine', 'webkit');
if (!/^[0-9a-f]{40}$/.test(SHA)) { console.error('--sha <40-hex web-tools commit> is required'); process.exit(2); }

const PAGES = 'https://mehrlander.github.io/web-tools/';
const LAUNCH = (page, q = 'view=map') => `${PAGES}pages/scratch/toss-top-probe.html?gh=mehrlander/web-tools@${SHA}:${page}&${q}`;
const VARIANTS = [
  // Controls first: if a page with none of our code dies on a reload, the
  // variants below say nothing about top mode (2026-09-29: V0 to V5 all died,
  // including the plain deployed app with no launcher and a reload with no
  // history write, which is the pattern of an environment fault).
  { id: 'C1', what: 'control: example.com, two reloads', url: 'https://example.com/', seq: ['reload', 'reload'] },
  { id: 'C2', what: 'control: the deployed app, page.reload() instead of location.reload()', url: `${PAGES}app/index.html?view=map`, seq: ['preload', 'preload'] },
  { id: 'C3', what: 'control: the deployed app, a fresh navigation instead of a reload', url: `${PAGES}app/index.html?view=map`, seq: ['goto', 'goto'] },
  { id: 'V0', what: 'the failing sequence: launcher, write, reload, Back, reload', url: LAUNCH('app/index.html'), seq: ['write', 'reload', 'back', 'reload'] },
  { id: 'V1', what: 'no launcher: the deployed app page itself, same sequence', url: `${PAGES}app/index.html?view=map`, seq: ['write', 'reload', 'back', 'reload'] },
  { id: 'V2', what: 'launcher, no page write: reload, reload', url: LAUNCH('app/index.html'), seq: ['reload', 'reload'] },
  { id: 'V3', what: 'launcher, write, Back, reload (no reload before Back)', url: LAUNCH('app/index.html'), seq: ['write', 'back', 'reload'] },
  { id: 'V4', what: 'launcher with a small page instead of the app, same sequence', url: LAUNCH('pages/diff-tool.html', 'x=1'), seq: ['write', 'reload', 'back', 'reload'] },
  { id: 'V5', what: 'launcher, write, reload, Back, then a navigation to the same URL instead of a reload', url: LAUNCH('app/index.html'), seq: ['write', 'reload', 'back', 'goto'] },
];

const token = process.env.GH_TOKEN || '';
const browser = await (ENGINE === 'chromium' ? chromium : webkit).launch();
const out = [];
for (const v of VARIANTS) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (token) await ctx.addInitScript(t => { try { localStorage.setItem('ghToken', t); } catch {} }, token);
  const page = await ctx.newPage();
  let dead = '';
  page.on('crash', () => { dead = dead || 'crash'; });
  page.on('close', () => { dead = dead || 'close'; });
  const trail = [];
  const up = () => page.waitForFunction(() => !window.__old && !!document.body && document.readyState !== 'loading', null, { timeout: 45000 });
  let result = 'survived';
  try {
    await page.goto(v.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    for (const s of v.seq) {
      if (s === 'write') await page.evaluate(() => history.pushState(null, '', '?view=tools'));
      else if (s === 'back') { await page.goBack().catch(() => {}); await page.waitForTimeout(1500); }
      else if (s === 'reload') { await page.evaluate(() => { window.__old = 1; location.reload(); }).catch(() => {}); await up(); await page.waitForTimeout(2500); }
      else if (s === 'preload') { await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }); await page.waitForTimeout(2500); }
      else if (s === 'goto') { const u = page.url(); await page.goto(u, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500); }
      trail.push(s + (dead ? ' (' + dead + ')' : ''));
      if (dead) break;
    }
  } catch (e) {
    result = dead ? 'died' : 'stalled';
    trail.push('error: ' + e.message.split('\n')[0].slice(0, 120));
  }
  if (dead) result = 'died';
  console.log(`${v.id}  ${result.padEnd(8)} ${v.what}\n    ${trail.join(' > ')}`);
  out.push({ id: v.id, result, what: v.what, trail });
  await ctx.close().catch(() => {});
}
await browser.close();
console.log('RESULT ' + JSON.stringify({ engine: ENGINE, sha: SHA, variants: out }));
