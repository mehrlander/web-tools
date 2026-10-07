#!/usr/bin/env node
// Real Activity -> Search -> embedded reader, using shipping bundles and a
// wholly synthetic private-registry fixture. No external reads or writes.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { repoRoot } from '../repo-root.mjs';
import { resolveCdn, typeFor, blobSha } from '../render/cdn.mjs';

const STORE = 'mehrlander/web-tools-private';
const NOW = Date.now(), DAY = 864e5;
const kit = {};
for (const name of ['closing-state.js', 'repo-sessions-cache.js', 'session-index.js'])
  new Function('window', readFileSync(path.join(repoRoot, 'lib/kits', name), 'utf8'))(kit);

function record(id, title, body, age = 0, minute = 0) {
  const start = NOW - age * DAY - 6 * 36e5 - minute * 6e4;
  const at = offset => new Date(start + offset * 6e4).toISOString();
  return { schema: 4, short: id, session_id: id + '-fixture', day: at(0).slice(0, 10),
    started: at(0), ended: at(8), opening_ask: title, exchanges: 2,
    files: {}, files_total: 0, repos: [], calls: [], calls_total: 0, tools: {}, tokens: {},
    prompts: [{ at: at(0), text: title }, { at: at(4), text: body }],
    replies: [{ at: at(2), text: 'The initial setup is ready.' },
      { at: at(6), text: 'Source answer for ' + id + ': ' + body }],
  };
}

const scoped = [
  record('a0000001', 'Today conversation', 'The cobalt discussion is in the second exchange.'),
  record('a0000002', 'Metadata fixture', 'This prose has no matching colour.', 0, 1),
  record('a0000003', 'Earlier this week', 'The cobalt discussion belongs to the week.', 3),
  record('a0000004', 'Earlier this month', 'The cobalt discussion belongs to the month.', 9),
  record('a0000005', 'Unicode fixture', 'Coordinate 東京 and C++ with regex[a] literally. <img src=x onerror=window.fixtureInjected=1>', 0, 2),
  record('a0000006', 'Unreadable fixture', 'Unavailable record body.', 0, 3),
];
const notification = record('a0000007', 'Captured notification fixture', 'Ghostterm came from a peer notification.', 0, 4);
notification.prompts[1].origin = 'peer';
notification.replies[1].text = 'The reader excludes the peer notification from captured user discussion.';
scoped.push(notification);
const bulk = Array.from({ length: 67 }, (_, i) => record(
  'b' + i.toString(16).padStart(7, '0'), 'Result ' + String(i + 1).padStart(2, '0'),
  'Manymatch source number ' + (i + 1) + '.', 0, i));

function fixture(records, { metadata = false, fail = [], hold = [] } = {}) {
  const rows = records.map(r => kit.RepoSessionsCache.summarize(r, r.short));
  // The deployed monthly index is ASCII-only. Metadata supplies this global
  // candidate; the original reader then proves Unicode and punctuation match
  // as literal source text, without claiming the index stores those terms.
  const unicode = rows.find(r => r.id === 'a0000005');
  if (unicode) unicode.title = 'Unicode 東京 regex[a]';
  if (metadata) {
    rows.find(r => r.id === 'a0000002').title = 'Cobalt metadata only';
    rows.find(r => r.id === 'a0000006').title = 'Cobalt unreadable record';
  }
  const months = [...new Set(records.map(r => r.day.slice(0, 7)))];
  const files = {
    'state/sessions.json': JSON.stringify({ generatedAt: new Date(NOW).toISOString(), rows }),
    'state/configs.json': JSON.stringify({ generatedAt: new Date(NOW).toISOString(), repos: {} }),
    'state/activity.json': JSON.stringify({ generatedAt: new Date(NOW).toISOString(), repos: {} }),
    '.web-tools.json': JSON.stringify({ estate: false }),
    'notes/notes.jsonl': '',
    ...Object.fromEntries(records.map(r => [kit.RepoSessionsCache.pathOf({ id: r.short, day: r.day }), JSON.stringify(r)])),
    ...Object.fromEntries(months.map(month => [
      kit.SessionIndex.shardPath(month), JSON.stringify(kit.SessionIndex.buildShard(Object.fromEntries(
        records.filter(r => r.day.startsWith(month)).map(r => [r.short, kit.SessionIndex.tokens(kit.SessionIndex.docText(r))])))),
    ])),
  };
  const failed = new Set(fail), gates = new Map();
  for (const id of hold) {
    let release, complete, begin;
    const promise = new Promise(resolve => { release = resolve; });
    const done = new Promise(resolve => { complete = resolve; });
    const started = new Promise(resolve => { begin = resolve; });
    gates.set(id, { promise, release, done, complete, started, begin });
  }
  return { records, rows, files, failed, gates, reads: [], writes: [] };
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://fixture').pathname;
  const target = path.resolve(repoRoot, '.' + decodeURIComponent(pathname));
  if (!target.startsWith(repoRoot + path.sep) || !existsSync(target)) {
    res.writeHead(404); return res.end('Not found');
  }
  res.writeHead(200, { 'content-type': typeFor(target) }); res.end(readFileSync(target));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser, debugPage, checks = 0;
const errors = [], fixtures = [];
const check = (name, value) => { assert.ok(value, name); checks++; console.log('ok   ' + name); };
const routeUrl = params => origin + '/app/index.html?' + new URLSearchParams(params);
const selected = page => page.locator('[data-session-result][aria-selected="true"]').getAttribute('data-session-result');
const resultIds = page => page.locator('[data-session-result]').evaluateAll(els => els.map(el => el.getAttribute('data-session-result')));
const params = page => new URL(page.url()).searchParams;
async function within(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timed out: ' + label)), 45000);
    })]);
  } finally { clearTimeout(timer); }
}

async function openPage(f, viewport, address) {
  fixtures.push(f);
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    window.__fixtureHistory = [];
    for (const name of ['pushState', 'replaceState']) {
      const original = history[name].bind(history);
      history[name] = function (...args) {
        const result = original(...args);
        window.__fixtureHistory.push({ action: name, url: location.search, length: history.length });
        return result;
      };
    }
    addEventListener('popstate', () => window.__fixtureHistory.push({ action: 'pop', url: location.search, length: history.length }));
    localStorage.setItem('ghToken', 'synthetic-browser-fixture');
    // These timestamps suppress the periodic writer, but seed no cached data:
    // both the session rows and the discussion index start completely cold.
    for (const key of ['wt:configCacheCheckedAt', 'wt:activityCacheCheckedAt', 'wt:sessionsCacheCheckedAt'])
      localStorage.setItem(key, String(Date.now() + 3600000));
  });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== 'GET') {
      f.writes.push(request.method() + ' ' + url.pathname);
      return route.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"fixture is read-only"}' });
    }
    if (url.origin === origin) return route.continue();
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (url.hostname === 'api.github.com') {
      if (url.pathname === '/user') return json({ login: 'fixture-reader' });
      if (url.pathname === '/user/repos') return json([]);
      const prefix = '/repos/' + STORE;
      if (url.pathname === prefix) return json({ full_name: STORE, default_branch: 'main', private: true });
      if (url.pathname.startsWith(prefix + '/contents/')) {
        const name = decodeURIComponent(url.pathname.slice((prefix + '/contents/').length));
        f.reads.push(name);
        const id = name.match(/-([a-f0-9]{8})\.json$/)?.[1];
        const gate = f.gates.get(id) || f.gates.get(name);
        if (gate) { gate.begin(); await gate.promise; }
        if (id && f.failed.has(id)) return json({ message: 'Synthetic record unavailable' }, 503);
        if (Object.hasOwn(f.files, name)) {
          const bytes = Buffer.from(f.files[name]);
          if (/vnd\.github\.raw/.test(request.headers().accept || '')) await route.fulfill({ status: 200, body: bytes });
          else await json({ encoding: 'base64', content: bytes.toString('base64'), sha: blobSha(bytes), size: bytes.length });
          gate?.complete();
          return;
        }
        return json({ message: 'Not found' }, 404);
      }
      if (url.pathname.startsWith(prefix + '/git/trees/')) return json({ truncated: false,
        tree: Object.keys(f.files).map(p => ({ type: 'blob', path: p, sha: blobSha(Buffer.from(f.files[p])) })) });
      return json({ message: 'Not found' }, 404);
    }
    const resolved = resolveCdn(url.href, repoRoot);
    if (resolved.kind === 'fulfill') return route.fulfill({ status: 200, contentType: resolved.contentType, body: resolved.body });
    return route.abort();
  });
  const page = await context.newPage();
  debugPage = page;
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(address);
  return { page, context };
}

async function readyResults(page, count) {
  await page.waitForFunction(n => document.querySelectorAll('[data-session-result]').length === n, count, { timeout: 45000 });
  await page.locator('[data-session-reader]').waitFor({ state: 'visible' });
}

async function readyRecord(page, id, error = false) {
  await page.waitForFunction(({ id, error }) => [...document.querySelectorAll('[data-session-reader] [x-data^="sessionBrief("]')]
    .some(el => { const d = Alpine.$data(el); return d.shortId === id && (error ? !!d.err : !!d.record); }),
  { id, error }, { timeout: 45000 });
}

async function briefText(page, id) {
  return page.locator('[data-session-reader] [x-data^="sessionBrief("]').evaluateAll((els, id) =>
    els.find(el => Alpine.$data(el).shortId === id)?.textContent || '', id);
}
async function briefFor(page, id) {
  const els = page.locator('[data-session-reader] [x-data^="sessionBrief("]');
  for (let i = 0; i < await els.count(); i++) {
    const el = els.nth(i);
    if (await el.evaluate(el => Alpine.$data(el).shortId) === id) return el;
  }
  throw new Error('No mounted reader for ' + id);
}
async function openExpandedSource(page) {
  await page.waitForFunction(() => {
    const h = window.swipeDeck.top();
    const el = h?.deck.track.children[h.deck.active()]?.querySelector('[x-data^="sessionBrief("]');
    return el && !!Alpine.$data(el).record;
  });
  await page.evaluate(() => {
    const h = window.swipeDeck.top();
    h.deck.track.children[h.deck.active()].querySelector('[x-data^="sessionBrief("]').setAttribute('data-browser-active-brief', '');
  });
  await page.locator('[data-browser-active-brief]').getByRole('button', { name: 'Open session', exact: true }).click();
  await page.waitForFunction(() => window.swipeDeck.stack.length === 2);
}

async function activityScenario(viewport) {
  const f = fixture(scoped, { metadata: true, fail: ['a0000006'] });
  const { page, context } = await openPage(f, viewport, routeUrl({ view: 'sessions' }));
  const estate = page.locator('[x-data="estate()"]');
  await page.getByRole('searchbox', { name: 'Search activity' }).fill('cobalt');
  await page.getByRole('button', { name: /Discussion$/ }).click();
  await page.waitForFunction(() => {
    const el = document.querySelector('[x-data="estate()"]');
    return el && Alpine.$data(el).sessionNodes.length === 3;
  }, null, { timeout: 45000 });
  check('cold Activity discussion stays in Day', params(page).get('view') === 'sessions' && !params(page).has('ascope'));
  check('discussion selection is announced', await page.getByRole('button', { name: /Discussion$/ }).getAttribute('aria-pressed') === 'true');
  check('cold discussion fetched its index', f.reads.some(p => p.startsWith('state/sessions-index/')));
  check('Activity matches without reading full records', !f.reads.some(p => p.startsWith('sessions/')));
  const ids = () => estate.evaluate(el => Alpine.$data(el).sessionNodes.map(n => n.id));
  assert.deepEqual(new Set(await ids()), new Set(['a0000001', 'a0000002', 'a0000006'])); checks++;
  await estate.getByRole('button', { name: /Week\s/ }).click();
  await page.waitForFunction(() => new URLSearchParams(location.search).get('ascope') === 'week');
  assert.deepEqual(new Set(await ids()), new Set(['a0000001', 'a0000002', 'a0000003', 'a0000006'])); checks++;
  check('Week remains strict while discussion includes older matches', !(await ids()).includes('a0000004'));
  check('Activity ' + viewport.width + ' has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1);
  if (process.env.SHOTS) {
    mkdirSync(process.env.SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.SHOTS, 'activity-discussion-' + viewport.width + '.png') });
  }
  await page.getByRole('button', { name: /Inspect matches$/ }).click();
  await readyResults(page, 4);
  check('Inspect keeps the query and scoped result set', params(page).get('sq') === 'cobalt' && params(page).get('smode') === 'sessions');
  assert.deepEqual(new Set(await resultIds(page)), new Set(['a0000001', 'a0000002', 'a0000003', 'a0000006'])); checks++;
  check('opening results stays embedded', await page.evaluate(() => !window.swipeDeck?.stack.length));
  await page.locator('[data-session-result="a0000002"]').click();
  await readyRecord(page, 'a0000002');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-session-reader] [x-data^="sessionBrief("]')]
    .some(el => { const d = Alpine.$data(el); return d.shortId === 'a0000002' && d.findQuery === 'cobalt' && !d.findResult.hits.length; }));
  const metadata = await briefText(page, 'a0000002');
  check('metadata-only result explains the absence of prose matches', /metadata|session details|no captured|no matching/i.test(metadata));
  await page.reload();
  await readyResults(page, 4);
  await readyRecord(page, 'a0000002');
  check('reloading preserves the selected session and Activity result scope', await selected(page) === 'a0000002' && params(page).get('sq') === 'cobalt');
  await page.locator('[data-session-result="a0000001"]').click();
  await readyRecord(page, 'a0000001');
  await (await briefFor(page, 'a0000001')).getByRole('button', { name: 'Open session', exact: true }).click();
  await page.waitForFunction(() => window.swipeDeck.stack.length === 1);
  check('Open session starts at the matching original exchange', await page.evaluate(() => window.swipeDeck.top().deck.active()) === 1);
  await page.goBack();
  await page.waitForFunction(() => window.swipeDeck.stack.length === 0);
  check('source Back returns to the same embedded result', await selected(page) === 'a0000001');
  await page.locator('[data-session-result="a0000006"]').click();
  await readyRecord(page, 'a0000006', true);
  check('an unreadable selected record keeps its identity', await selected(page) === 'a0000006' && params(page).get('sitem') === 'a0000006');
  check('record failure is visible', /unavailable|could not|failed|503/i.test(await briefText(page, 'a0000006')));
  await page.goBack();
  await page.waitForFunction(() => new URLSearchParams(location.search).get('view') === 'sessions');
  check('Back restores Activity query, discussion and Week', params(page).get('aq') === 'cobalt' && params(page).get('discussion') === '1' && params(page).get('ascope') === 'week');
  await context.close();
}

async function readerScenario(viewport, label, records = bulk) {
  const began = performance.now();
  const f = fixture(records), count = records.length;
  const last = records.at(-1).short;
  const { page, context } = await openPage(f, viewport, routeUrl({ view: 'search', smode: 'sessions', sq: 'manymatch', sitem: last }));
  await readyResults(page, count);
  if (viewport.width === 320) await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await readyRecord(page, last);
  await page.waitForFunction(id => document.querySelector('[data-session-result="' + id + '"]')?.textContent.includes('2 occurrences'), last);
  check(label + ' cold selected id survives the first 60 results', await selected(page) === last && params(page).get('sitem') === last);
  check(label + ' full results are in one list', new Set(await resultIds(page)).size === count
    && await page.locator('[data-session-results]').getAttribute('data-total') === String(count));
  check(label + ' the selected list row shows measured occurrence counts', /2 occurrences.*1 exchange/.test(await page.locator('[data-session-result="' + last + '"]').textContent()));
  const initialReads = f.reads.filter(p => p.startsWith('sessions/')).length;
  const mounted = await page.locator('[data-session-reader] [x-data^="sessionBrief("]').count();
  check(label + ' embedded reader uses bounded record reads and mounts', initialReads <= 3 && mounted <= 3);
  console.log('info ' + label + ' cold ' + count + ' results: ' + Math.round(performance.now() - began)
    + ' ms; ' + initialReads + ' records requested; ' + mounted + ' readers mounted');
  await page.getByRole('button', { name: 'Previous session result', exact: true }).click();
  await page.waitForFunction(id => new URLSearchParams(location.search).get('sitem') === id, records.at(-2).short);
  check(label + ' previous synchronizes list and address', await selected(page) === records.at(-2).short);
  await page.getByRole('button', { name: 'Next session result', exact: true }).click();
  await page.waitForFunction(id => new URLSearchParams(location.search).get('sitem') === id, last);
  await page.locator('[data-session-reader] .sd-track').evaluate((el, at) => el.scrollTo({ left: at * el.clientWidth, behavior: 'instant' }), count - 2);
  await page.waitForFunction(id => new URLSearchParams(location.search).get('sitem') === id, records.at(-2).short);
  check(label + ' inline swipe scrolling synchronizes the selected list row', await selected(page) === records.at(-2).short);
  await page.getByRole('button', { name: 'Next session result', exact: true }).click();
  await page.waitForFunction(id => new URLSearchParams(location.search).get('sitem') === id, last);
  await page.getByRole('button', { name: 'Expand session results', exact: true }).click();
  await page.waitForFunction(() => window.swipeDeck.stack.length === 1);
  const deckState = await page.evaluate(() => ({ count: window.swipeDeck.top().deck.count, active: window.swipeDeck.top().deck.active() }));
  check(label + ' fullscreen opens the current result over the complete set', deckState.count === count && deckState.active === count - 1);
  await page.evaluate(() => window.swipeDeck.top().deck.go(0));
  await page.waitForFunction(id => new URLSearchParams(location.search).get('sitem') === id, records[0].short);
  await openExpandedSource(page);
  check(label + ' expanded source opens the matching exchange as a child', await page.evaluate(() => window.swipeDeck.top().deck.active()) === 1);
  await page.goBack();
  await page.waitForFunction(() => window.swipeDeck.stack.length === 1);
  check(label + ' source Back retains the expanded results parent', await selected(page) === records[0].short);
  await page.goBack();
  await page.waitForFunction(() => window.swipeDeck.stack.length === 0);
  check(label + ' closing fullscreen retains its selection', await selected(page) === records[0].short);
  await page.locator('[data-session-result="' + last + '"]').click();
  await page.waitForFunction(id => new URLSearchParams(location.search).get('sitem') === id, last);
  check(label + ' row tap repositions embedded reading', await selected(page) === last);
  const historyLength = await page.evaluate(() => history.length);
  await page.getByRole('button', { name: 'Previous session result', exact: true }).click();
  await page.waitForFunction(id => new URLSearchParams(location.search).get('sitem') === id, records.at(-2).short);
  check(label + ' result changes replace rather than flood history', await page.evaluate(() => history.length) === historyLength);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(label + ' has no horizontal overflow', overflow <= 1);
  if (process.env.SHOTS) {
    mkdirSync(process.env.SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.SHOTS, 'activity-session-search-' + label + '.png') });
  }
  await context.close();
}

async function staleRecordScenario() {
  const f = fixture(bulk.slice(0, 3), { hold: [bulk[0].short] });
  const { page, context } = await openPage(f, { width: 1280, height: 900 },
    routeUrl({ view: 'search', smode: 'sessions', sq: 'manymatch', sitem: bulk[0].short }));
  await readyResults(page, 3);
  await within(f.gates.get(bulk[0].short).started, 'the held first record request');
  await page.locator('[data-session-result="' + bulk[2].short + '"]').click();
  await readyRecord(page, bulk[2].short);
  f.gates.get(bulk[0].short).release();
  await within(f.gates.get(bulk[0].short).done, 'the old record completion');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  check('late record completion cannot replace the selected result', await selected(page) === bulk[2].short && params(page).get('sitem') === bulk[2].short);
  await context.close();
}

async function staleQueryScenario() {
  const shards = [...new Set(scoped.map(r => kit.SessionIndex.shardPath(r.day.slice(0, 7))))];
  const f = fixture(scoped, { metadata: true, hold: shards });
  const { page, context } = await openPage(f, { width: 1280, height: 900 },
    routeUrl({ view: 'sessions', aq: 'cobalt', discussion: '1' }));
  await within(Promise.race([...f.gates.values()].map(gate => gate.started)), 'the held discussion index request');
  await page.getByRole('searchbox', { name: 'Search activity' }).fill('東京');
  await page.waitForFunction(() => new URLSearchParams(location.search).get('aq') === '東京');
  for (const gate of f.gates.values()) gate.release();
  await within(Promise.all([...f.gates.values()].map(gate => gate.done)), 'the superseded index reads to finish');
  await page.waitForFunction(() => {
    const d = Alpine.$data(document.querySelector('[x-data="estate()"]'));
    return !d.sessionSearchPending && d.discussionQuery === '東京'
      && d.sessionNodes.length === 1 && d.sessionNodes[0].id === 'a0000005';
  }, null, { timeout: 45000 });
  check('a stale cold-index request cannot republish the old Activity query', params(page).get('aq') === '東京');
  check('cold query replacement does not read every record', !f.reads.some(p => p.startsWith('sessions/')));
  await context.close();
}

async function literalScenario() {
  const f = fixture(scoped);
  const { page, context } = await openPage(f, { width: 390, height: 844 },
    routeUrl({ view: 'search', smode: 'sessions', sq: '東京', sitem: 'a0000005' }));
  await readyResults(page, 1);
  await readyRecord(page, 'a0000005');
  check('Unicode query reaches its original prose', /東京/.test(await briefText(page, 'a0000005')) && params(page).get('sq') === '東京');
  const search = page.locator('[x-data="searchView()"]');
  await search.locator('[data-find-box]').fill('regex[a]');
  await search.locator('form').evaluate(form => form.requestSubmit());
  await readyResults(page, 1);
  await page.waitForFunction(() => new URLSearchParams(location.search).get('sq') === 'regex[a]');
  check('query metacharacters stay literal', (await resultIds(page))[0] === 'a0000005');
  check('captured HTML cannot inject an element', await page.evaluate(() => !window.fixtureInjected && !document.querySelector('[data-session-reader] img[src="x"]')));
  await search.locator('[data-find-box]').fill('ghostterm');
  await search.locator('form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => new URLSearchParams(location.search).get('sq') === 'ghostterm');
  await readyResults(page, 1);
  await readyRecord(page, 'a0000007');
  await page.waitForFunction(() => document.querySelector('[data-session-result="a0000007"]')?.textContent.includes('No matching discussion'));
  check('an index-only notification hit is not mislabeled as metadata', /No matching discussion/.test(await page.locator('[data-session-result="a0000007"]').textContent()));
  await context.close();
}

async function queryHistoryScenario() {
  const f = fixture(scoped, { metadata: true });
  const { page, context } = await openPage(f, { width: 1280, height: 900 },
    routeUrl({ view: 'search', smode: 'sessions', sq: 'cobalt', sitem: 'a0000001' }));
  await readyResults(page, 5);
  const search = page.locator('[x-data="searchView()"]');
  await search.locator('[data-find-box]').fill('regex[a]');
  await search.locator('form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => new URLSearchParams(location.search).get('sq') === 'regex[a]');
  await readyResults(page, 1);
  await page.goBack();
  await page.waitForFunction(() => new URLSearchParams(location.search).get('sq') === 'cobalt');
  await readyResults(page, 5);
  check('Back restores the previous executed query and selected result', await selected(page) === 'a0000001');
  await page.goForward();
  await page.waitForFunction(() => new URLSearchParams(location.search).get('sq') === 'regex[a]');
  await readyResults(page, 1);
  check('Forward restores the next executed query and its reader', await selected(page) === 'a0000005');
  await context.close();
}

try {
  const launchErrors = [];
  for (const option of [{}, { channel: 'chrome' }, { channel: 'msedge' }]) {
    try { browser = await chromium.launch({ headless: true, ...option }); break; }
    catch (error) { launchErrors.push(error.message); }
  }
  assert.ok(browser, 'Chromium, Chrome or Edge must launch:\n' + launchErrors.join('\n'));
  const part = process.env.ACTIVITY_SEARCH_PART;
  if (part !== 'search') {
    await activityScenario({ width: 1280, height: 900 });
    await activityScenario({ width: 390, height: 844 });
  }
  if (part !== 'activity') {
    await readerScenario({ width: 1280, height: 900 }, 'desktop');
    await readerScenario({ width: 390, height: 844 }, 'phone');
    await readerScenario({ width: 320, height: 760 }, 'narrow');
    await staleRecordScenario();
    await literalScenario();
    await queryHistoryScenario();
    const scale = Number(process.env.ACTIVITY_SEARCH_SCALE);
    if (Number.isInteger(scale) && scale > 67) await readerScenario({ width: 1280, height: 900 }, 'scale-' + scale,
      Array.from({ length: scale }, (_, i) => record('c' + i.toString(16).padStart(7, '0'),
        'Scale result ' + String(i + 1), 'Manymatch source number ' + (i + 1) + '.', 0, i)));
  }
  if (part !== 'search') await staleQueryScenario();
  assert.deepEqual(fixtures.flatMap(f => f.writes), [], 'the browser made no writes');
  assert.deepEqual(errors, [], 'the browser emitted no runtime errors');
  console.log('CHECK OK activity-session-search-browser (' + checks + ' checks)');
} catch (error) {
  if (debugPage && !debugPage.isClosed()) console.error(await debugPage.evaluate(() => ({
    url: location.href, text: document.body.innerText.slice(-4500),
    results: [...document.querySelectorAll('[data-session-result]')].map(el => [el.dataset.sessionResult, el.getAttribute('aria-selected')]),
    readers: [...document.querySelectorAll('[data-session-reader] [x-data^="sessionBrief("]')].map(el => {
      const d = Alpine.$data(el); return { id: d.shortId, query: d.findQuery, loaded: !!d.record, err: d.err, hits: d.findResult?.hits.length };
    }),
    readerHtml: document.querySelector('[data-session-reader]')?.outerHTML.slice(-3500),
    history: window.__fixtureHistory,
  })));
  console.error(errors);
  throw error;
} finally {
  for (const f of fixtures) for (const gate of f.gates.values()) gate.release();
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
