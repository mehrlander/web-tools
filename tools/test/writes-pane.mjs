#!/usr/bin/env node
// The Writes pane, in a real browser, against a real activity cache.
//
//   node tools/test/writes-pane.mjs
//
// tools/test/write-kinds.test.mjs holds the classifier in isolation. What it
// cannot reach is the wiring, which is where a pane fails silently: a pill whose
// arm is missing renders, recognizes its key, and does nothing (the State pill,
// 2026-08-23). So this drives the app the way a reader does, from the pill, and
// asserts the pane arrived, classified, filtered, and stated its window.
//
// The cache is stubbed rather than fetched: the pane's own reading must be the
// thing under test, not the registry's current contents.
//
// Exits nonzero on any failure. Not part of `npm test` (needs a browser).

import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGE = 'app/index.html';

const CACHE = {
  'me/one': { recentCommits: [
    { sha: 'a1'.repeat(20), msg: 'Update activity cache (state/activity.json)', date: '2026-09-08T10:00:00Z', author: 'mehrlander' },
    { sha: 'a2'.repeat(20), msg: 'Jot "the lightbulb" via Web Tools',           date: '2026-09-08T09:00:00Z', author: 'mehrlander' },
    { sha: 'a3'.repeat(20), msg: 'sessions: 2026-09-07-abcd1234',               date: '2026-09-07T09:00:00Z', author: 'Claude' },
  ] },
  'me/two': { recentCommits: [
    { sha: 'b1'.repeat(20), msg: 'Merge pull request #12 from me/topic', date: '2026-09-06T09:00:00Z', author: 'mehrlander' },
    { sha: 'b2'.repeat(20), msg: 'page report: peek.html',              date: '2026-09-05T09:00:00Z', author: 'mehrlander' },
  ] },
};

const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || PAGE;
  try {
    const body = await readFile(path.join(root, rel));
    res.writeHead(200, { 'Content-Type': typeFor(rel) });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route('**/*', (route) => {
  const url = route.request().url();
  if (url.includes('api.github.com')) return route.abort();
  if (url.startsWith(base)) return route.continue();
  const r = resolveCdn(url, root);
  if (r.kind === 'continue') return route.continue();
  if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
  return route.fulfill({ status: 200, contentType: r.contentType, body: r.body });
});

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };

const page = await ctx.newPage();
await page.goto(`${base}/${PAGE}?view=sessions`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[x-data*="estate"]', { timeout: 20000 });

// The pane reads `activity` and `authed`; both are plain reactive fields on the
// component, so the stub is an assignment. `authed` must be SET rather than
// redefined: a getter installed over the proxy is invisible to Alpine, so
// x-show keeps the whole pane hidden and every locator below times out on
// something that is rendered and correct.
await page.evaluate((cache) => {
  const d = window.Alpine.$data(document.querySelector('[x-data*="estate"]'));
  d.activity = cache;
  d._loaded.activity = true;
  d.authed = true;
}, CACHE);

check(await page.evaluate(() => !!window.WriteKinds), 'the classifier kit is on the boot chain');

// From the pill, the way a reader arrives. A pill with no arm renders and does
// nothing, which is the failure this reaches and a unit test does not.
await page.getByRole('tab', { name: 'Writes' }).click();
await page.waitForFunction(() => window.__shell?.view === 'writes', null, { timeout: 10000 }).catch(() => {});
check(await page.evaluate(() => window.__shell?.view === 'writes'), 'the pill arms: tapping it routes the shell');
check(page.url().includes('view=writes'), 'and stamps the URL, so the pane has an address: ' + page.url().split('?')[1]);

const d = await page.evaluateHandle(() => window.Alpine.$data(document.querySelector('[x-data*="estate"]')));
const tally = await d.evaluate(o => o.writeKindsWithCount.map(k => [k.key, k.count]));
check(JSON.stringify(tally) === JSON.stringify([['crawl',1],['tap',1],['device',1],['session',1],['merge',1],['ci',0],['authored',0]]),
      'every kind is counted, zeros kept, in KINDS order: ' + JSON.stringify(tally));

check(await d.evaluate(o => o.writeRows.length) === 5, 'both repos fold into one stream');
const first = await d.evaluate(o => o.writeRows[0]);
check(first.msg.startsWith('Update activity cache'), 'newest first across repos');
check(first.short === 'one', 'each row carries the repo it came from');

check(await d.evaluate(o => o.writeWindow) === '2026-09-05 … 2026-09-08',
      'the window the rows actually cover is stated, not assumed');

// The filter, from the count chip rather than from state, since the chip IS the
// control and a chip that does not filter is the same silent failure as a pill
// that does not route. Scoped to the pane: `getByRole` searches the whole page,
// and the app has other buttons whose names contain these words. The name is a
// STRING rather than a regex on purpose: Playwright normalizes whitespace when
// matching by string and does not when matching by regex, and these chips are
// multi-line markup, so /^Tap/ never matches a name that begins with a newline.
const pane = page.locator('[data-pane="writes"]');
await pane.getByRole('button', { name: 'Tap' }).click();
check(await d.evaluate(o => o.writeKind) === 'tap', 'a count chip filters');
check(await d.evaluate(o => o.writeList.length) === 1, 'and the list follows it');
check(await d.evaluate(o => o.writeList[0].kind.state) === true, 'a tap is application state, which is what the accent marks');

const visible = await pane.locator('[x-text="w.msg"]').allTextContents();
check(visible.length === 1 && visible[0].includes('Jot "the lightbulb"'), 'the rendered list is the filtered one: ' + JSON.stringify(visible));

await pane.getByRole('button', { name: 'All' }).click();
check(await d.evaluate(o => o.writeList.length) === 5, 'All clears the filter');

check(await d.evaluate(o => o.writeKindsWithCount.filter(k => !k.sure).map(k => k.key).join()) === 'device',
      'exactly one kind is marked a guess');

await browser.close();
server.close();
console.log(fails.length ? '\n' + fails.length + ' failed' : '\nall passed');
process.exit(fails.length ? 1 : 0);
