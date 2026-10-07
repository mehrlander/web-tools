#!/usr/bin/env node
// top-mode-live.mjs — top mode against live GitHub, in WebKit or Chromium,
// with no person in the loop.
//
//   node tools/test/top-mode-live.mjs --sha <web-tools commit> [--engine webkit|chromium]
//
// Written to run as an errand on a GitHub-hosted runner (the `workflow-run`
// method in docs/run-methods.csv, .github/workflows/errand-browser.yml), where
// egress is open and GH_TOKEN, the job's own read-only token, is put where the
// pages look for one. It answers what the iPhone checks of 2026-09-29 asked a
// person to do by hand, minus what only a phone can say (whether iOS kills
// the page's process):
//
// - The page a link names runs as the tab's own document at --sha, through the
//   deployed launcher and through this checkout's renderer (?top).
// - A page write that carries no selection, a reload, Back, and a reload at
//   the Back entry keep every selection entry in the URL and in window.__refs.
// - Opening the FAB drawer builds its whole template without a console
//   warning (an unparseable binding reached a phone that way on 2026-09-29).
//
// WebKit is Safari's engine, not Safari on iOS: history, document.write and
// module loading are the engine's; the web process's memory limits are the
// device's. Output is a line per step and a final `RESULT {json}` line, which
// is what a session reads back from the job log. Exit code 1 when any step
// lost part of the selection or the drawer logged a warning.

import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { resolveCdn } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d = '') => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const SHA = arg('--sha');
const ENGINE = arg('--engine', 'webkit');
// --local answers GitHub from the sibling checkouts (tools/render/cdn.mjs), to
// check this script itself where live GitHub is out of reach.
const LOCAL = argv.includes('--local');
if (!/^[0-9a-f]{40}$/.test(SHA)) { console.error('--sha <40-hex web-tools commit> is required'); process.exit(2); }

const PAGES = 'https://mehrlander.github.io/web-tools/';
const HOST = 'https://render.invalid';   // this checkout's renderer, served by interception
const ADDR = `mehrlander/web-tools@${SHA}:app/index.html`;
const SEL = ['mehrlander/home@main', 'mehrlander/web-tools-private@main',
  'mehrlander/home@main:projects/budget-drs/submittal/link-rewrite.js',
  `mehrlander/web-tools@${SHA}:lib/alpineComponents/`];
const query = SEL.map(v => 'refs=' + v).join('&') + '&view=map';
const CASES = [
  { id: 'launcher', url: `${PAGES}pages/scratch/toss-top-probe.html?gh=${ADDR}&${query}` },
  { id: 'renderer-top', url: `${HOST}/pages/toss-render.html?top&gh=${ADDR}&${query}` },
];

// --root names the checkout under test (the workflow checks the branch out
// beside this script); its renderer is the one served. A renderer without
// top mode (main, before #825) cannot run the renderer case, which is then
// reported as skipped rather than failed.
const UNDER = path.resolve(arg('--root', root));
const RENDERER = await readFile(path.join(UNDER, 'pages/toss-render.html'), 'utf8');
if (!/queryParams\.has\('top'\)/.test(RENDERER)) {
  CASES.splice(CASES.findIndex(c => c.id === 'renderer-top'), 1);
  console.log('renderer-top skipped: the renderer under test has no ?top');
}
const token = process.env.GH_TOKEN || '';
// In a sandbox behind a proxy (not on a runner), go through it; Chromium's
// HTTP/2 through that proxy drops requests (docs/environment/capabilities.md).
const proxy = !LOCAL && (process.env.HTTPS_PROXY || process.env.https_proxy);
const browser = await (ENGINE === 'chromium' ? chromium : webkit).launch({
  ...(proxy ? { proxy: { server: proxy } } : {}),
  ...(ENGINE === 'chromium' ? { args: ['--disable-http2'] } : {}),
});
const summary = { engine: ENGINE, version: browser.version(), sha: SHA, cases: [] };
let failed = 0;

for (const c of CASES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  // The pages read a GitHub token from localStorage on their own origin; the
  // job's token keeps the app under the API rate limit. It is read-only and
  // expires with the job.
  if (token) await ctx.addInitScript(t => { try { localStorage.setItem('ghToken', t); } catch {} }, token);
  const page = await ctx.newPage();
  await page.route(HOST + '/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: RENDERER }));
  if (LOCAL) await page.route(u => !String(u).startsWith(HOST), async route => {
    const req = route.request();
    const r = resolveCdn(req.url(), root, null, req.headers());
    if (r.kind === 'continue') return route.abort();
    if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
    return route.fulfill({ status: r.status || 200, contentType: r.contentType, body: r.body });
  });
  const notes = [];
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') notes.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', e => notes.push('pageerror: ' + e.message.slice(0, 200)));

  const booted = () => page.waitForFunction(() => !!(window.gh && window.Alpine && document.querySelector('[x-data^="fab"]')),
    null, { timeout: 60000 }).then(() => true, () => false);
  const steps = [];
  const check = async (label) => {
    const url = new URL(page.url());
    const got = url.searchParams.getAll('refs').sort();
    const keys = await page.evaluate(() => Object.keys(window.__refs || {}).length).catch(() => -1);
    const ok = JSON.stringify(got) === JSON.stringify([...SEL].sort()) && keys === SEL.length;
    steps.push({ label, ok, refs: got.length, keys, view: url.searchParams.get('view') });
    console.log(`  ${ok ? 'ok  ' : 'LOST'} ${label}: refs in URL ${got.length}/${SEL.length}, __refs keys ${keys}/${SEL.length}`);
    return ok;
  };

  console.log(`\n${c.id}  (${ENGINE})`);
  try { await page.goto(c.url, { waitUntil: 'domcontentloaded' }); }
  catch (e) { notes.push('goto: ' + e.message.split('\n')[0].slice(0, 160)); }
  const up = await booted();
  const ran = await page.evaluate(() => ({ gh: window.gh && window.gh.ref, top: !!window.__tossTop, title: document.title })).catch(() => ({}));
  console.log(`  booted: ${up} gh.ref=${ran.gh} title=${JSON.stringify(ran.title)}`);
  await check('loaded');

  // The drawer: open it as a tap does, and let Alpine build the template.
  const before = notes.length;
  const opened = await page.evaluate(async () => {
    const el = document.querySelector('[x-data^="fab"]');
    const d = el && window.Alpine && Alpine.$data(el);
    if (!d) return false;
    if (typeof d.toggle === 'function') await d.toggle(); else d.open = true;
    await new Promise(r => setTimeout(r, 2500));
    return !!(d.open || d.opened);
  }).catch(() => false);
  const drawerNotes = notes.slice(before).filter(n => /Alpine|Expression/.test(n));
  console.log(`  drawer opened: ${opened}; drawer warnings: ${drawerNotes.length}`);
  drawerNotes.forEach(n => console.log('    ' + n));

  // A reload as a person makes one: location.reload() in the page, then wait
  // for a fresh document (the marker set on the old one is gone) that has
  // booted. Playwright's page.reload() waits for a navigation event, and in
  // WebKit, after Back to an entry the page pushed, that wait timed out on the
  // first runner run (2026-09-29) while the question was whether the page came
  // back at all. A step that fails is recorded, not thrown, so one engine's
  // stall does not hide the steps after it.
  // IN WEBKIT, RELOADS ARE NOT MEASURED HERE. On the runner, WebKit's page
  // dies when our pages load a second time: on any reload, main's plain app
  // included, and on a navigation that follows Back, while example.com reloads
  // cleanly and two fresh navigations survive (webkit-reload-isolate.mjs,
  // controls C1 to C3 and the 2026-09-29 runs). That is below our code, and
  // what it says about iPhone Safari is the device's to answer, through a
  // device-link errand. So WebKit records those steps as not measured, and
  // the verdict rests on what it can measure: the load, the drawer, the
  // page's history write and Back. Chromium reloads for real.
  const unmeasured = ENGINE === 'webkit';
  const reload = async (label) => {
    if (unmeasured) {
      steps.push({ label, ok: null, skipped: 'not measured: WebKit on the runner dies loading our pages a second time' });
      console.log(`  --   ${label}: not measured in WebKit on the runner (see webkit-reload-isolate.mjs)`);
      return;
    }
    try {
      await page.evaluate(() => { window.__probeOld = 1; location.reload(); }).catch(() => {});
      await page.waitForFunction(() => !window.__probeOld && !!(window.gh && window.Alpine), null, { timeout: 60000 });
      await check(label);
    } catch (e) {
      steps.push({ label, ok: false, error: e.message.split('\n')[0].slice(0, 160) });
      console.log(`  LOST ${label}: the page did not come back (${e.message.split('\n')[0].slice(0, 100)})`);
    }
  };
  await page.evaluate(() => history.pushState(null, '', '?view=tools'));
  await check('after the page writes ?view=tools');
  await reload('after reload');
  await page.goBack().catch(() => {}); await page.waitForTimeout(1500);
  await check('after Back');
  await reload('after reload at the Back entry');

  const lost = steps.filter(s => s.ok === false).length;
  const pass = up && opened && !lost && !drawerNotes.length;
  if (!pass) failed++;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}${notes.length ? `; ${notes.length} console warning(s) or error(s) in all` : ''}`);
  summary.cases.push({ id: c.id, pass, booted: up, gh: ran.gh || null, drawer: opened, drawerWarnings: drawerNotes, steps, notes: [...new Set(notes)].slice(0, 12) });
  await ctx.close();
}
await browser.close();
console.log('RESULT ' + JSON.stringify(summary));
process.exit(failed ? 1 : 0);
