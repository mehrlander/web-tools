#!/usr/bin/env node
// Real app navigation, with the shipping search/index/reader and synthetic
// GitHub responses. No private data or network access. Browser-only by design.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { repoRoot } from '../repo-root.mjs';
import { resolveCdn, typeFor, blobSha } from '../render/cdn.mjs';

const store = 'mehrlander/web-tools-private';
const day = new Date().toISOString().slice(0, 10), month = day.slice(0, 7);
const at = minute => day + 'T12:' + String(minute).padStart(2, '0') + ':00Z';
const record = (id, label) => ({ schema: 4, short: id, session_id: id + '-fixture', day,
  started: at(0), ended: at(20), opening_ask: label, exchanges: 3,
  files: {}, files_total: 0, repos: [], calls: [], calls_total: 0, tools: {}, tokens: {},
  prompts: [{ at: at(0), text: label }, { at: at(5), text: 'Investigate the cache needle.' },
    { at: at(10), text: 'Check the retry boundary.' }],
  replies: [{ at: at(2), text: 'The initial setup is ready.' },
    { at: at(7), text: 'The cache needle is in the second exchange.' },
    { at: at(12), text: 'The retry boundary is in the third exchange.' }],
});
const records = [record('aaa11111', 'First browser fixture'), record('bbb22222', 'Second browser fixture')];
const kit = {};
for (const file of ['closing-state.js', 'repo-sessions-cache.js', 'session-index.js']) {
  new Function('window', readFileSync(path.join(repoRoot, 'lib/kits', file), 'utf8'))(kit);
}
const rows = records.map(r => kit.RepoSessionsCache.summarize(r, r.short));
const files = {
  'state/sessions.json': JSON.stringify({ generatedAt: at(20), rows }),
  ['state/sessions-index/' + month + '.json']: JSON.stringify(kit.SessionIndex.buildShard(
    Object.fromEntries(records.map(r => [r.short, kit.SessionIndex.tokens(kit.SessionIndex.docText(r))])))),
  'state/configs.json': JSON.stringify({ generatedAt: at(20), repos: {} }),
  'state/activity.json': JSON.stringify({ generatedAt: at(20), repos: {} }),
  '.web-tools.json': JSON.stringify({ estate: false }),
  'notes/notes.jsonl': '',
  ...Object.fromEntries(records.map(r => [kit.RepoSessionsCache.pathOf({ id: r.short, day }), JSON.stringify(r)])),
};
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
let browser, debugPage;
const errors = [], writes = [];
const check = (name, condition) => { assert.ok(condition, name); console.log('ok   ' + name); };
try {
  const launchErrors = [];
  for (const option of [{}, { channel: 'chrome' }, { channel: 'msedge' }]) {
    try { browser = await chromium.launch({ headless: true, ...option }); break; }
    catch (e) { launchErrors.push(e.message); }
  }
  assert.ok(browser, 'Could not launch a browser: ' + launchErrors.join('\n'));
  for (const [label, width, height] of [['desktop', 1400, 900], ['phone', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(() => {
      localStorage.setItem('ghToken', 'synthetic-browser-fixture');
      for (const key of ['wt:configCacheCheckedAt', 'wt:activityCacheCheckedAt', 'wt:sessionsCacheCheckedAt'])
        localStorage.setItem(key, String(Date.now() + 3600000));
    });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') {
        writes.push(request.method() + ' ' + url.pathname);
        return route.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"fixture is read-only"}' });
      }
      if (url.origin === origin) return route.continue();
      const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
      if (url.hostname === 'api.github.com') {
        if (url.pathname === '/user') return json({ login: 'fixture-reader' });
        if (url.pathname === '/user/repos') return json([]);
        const prefix = '/repos/' + store;
        if (url.pathname === prefix) return json({ full_name: store, default_branch: 'main', private: true });
        if (url.pathname.startsWith(prefix + '/contents/')) {
          const name = decodeURIComponent(url.pathname.slice((prefix + '/contents/').length));
          if (Object.hasOwn(files, name)) {
            const bytes = Buffer.from(files[name]);
            if (/vnd\.github\.raw/.test(request.headers().accept || ''))
              return route.fulfill({ status: 200, body: bytes });
            return json({ encoding: 'base64', content: bytes.toString('base64'), sha: blobSha(bytes), size: bytes.length });
          }
          return json({ message: 'Not found' }, 404);
        }
        if (url.pathname.startsWith(prefix + '/git/trees/'))
          return json({ truncated: false, tree: Object.keys(files).map(p => ({ type: 'blob', path: p, sha: blobSha(Buffer.from(files[p])) })) });
        if (url.pathname.startsWith(prefix + '/')) return json({ message: 'Not found' }, 404);
      }
      const resolved = resolveCdn(url.href, repoRoot);
      if (resolved.kind === 'fulfill') return route.fulfill({ status: 200, contentType: resolved.contentType, body: resolved.body });
      if (url.hostname === 'api.github.com') return json({ message: 'Not found' }, 404);
      return route.abort();
    });
    const page = await context.newPage();
    debugPage = page;
    page.on('pageerror', error => errors.push(label + ': ' + error.message));
    // Search now has its own coordinated inline reader (covered by
    // activity-session-search-browser). This harness exercises the full
    // Activity session reader's independent per-record find/history contract.
    await page.goto(origin + '/app/index.html?view=sessions&session=aaa11111&find=needle');
    const activeBrief = (i = 0) => page.locator('[x-data^="sessionBrief(window."]').filter({ visible: true }).nth(i);
    await page.waitForFunction(() => [...document.querySelectorAll('[x-data^="sessionBrief(window."]')]
      .some(el => Alpine.$data(el).record && Alpine.$data(el).findQuery === 'needle'));
    check(label + ' Activity carries the requested query into the reader', new URL(page.url()).searchParams.get('find') === 'needle');
    await activeBrief().getByRole('searchbox', { name: 'Find in conversation' }).fill('retry');
    await page.waitForFunction(() => new URLSearchParams(location.search).get('find') === 'retry');
    const length = await page.evaluate(() => history.length);
    await activeBrief().getByRole('searchbox', { name: 'Find in conversation' }).fill('cache');
    await page.waitForFunction(() => new URLSearchParams(location.search).get('find') === 'cache');
    check(label + ' changing query replaces history', await page.evaluate(() => history.length) === length);
    await activeBrief().getByRole('button', { name: 'Read exchange 2', exact: true }).click();
    await page.waitForFunction(() => window.swipeDeck.stack.length === 2);
    check(label + ' result opens its exact exchange', await page.evaluate(() => window.swipeDeck.stack.at(-1).deck.active()) === 1);
    await page.goBack();
    await page.waitForFunction(() => window.swipeDeck.stack.length === 1);
    check(label + ' Back returns to query results', await activeBrief().getByRole('searchbox', { name: 'Find in conversation' }).inputValue() === 'cache');
    await page.goBack();
    await page.waitForFunction(() => window.swipeDeck.stack.length === 0);
    check(label + ' Back returns to the Activity result list', new URL(page.url()).searchParams.get('view') === 'sessions');
    await page.goForward();
    await page.waitForFunction(() => window.swipeDeck.stack.length === 1);
    check(label + ' Forward restores the reader query', await activeBrief().getByRole('searchbox', { name: 'Find in conversation' }).inputValue() === 'cache');
    await page.evaluate(() => window.swipeDeck.stack[0].deck.go(1));
    await page.waitForFunction(() => new URLSearchParams(location.search).get('session') === 'bbb22222');
    check(label + ' a neighbouring session has no inherited query', !new URL(page.url()).searchParams.has('find'));
    await activeBrief(1).getByRole('searchbox', { name: 'Find in conversation' }).fill('retry');
    await page.waitForFunction(() => new URLSearchParams(location.search).get('find') === 'retry');
    await page.evaluate(() => window.swipeDeck.stack[0].deck.go(0));
    await page.waitForFunction(() => new URLSearchParams(location.search).get('find') === 'cache');
    check(label + ' returning restores that session query', await activeBrief().getByRole('searchbox', { name: 'Find in conversation' }).inputValue() === 'cache');
    await page.evaluate(() => window.swipeDeck.stack[0].deck.go(1));
    await page.waitForFunction(() => new URLSearchParams(location.search).get('find') === 'retry');
    check(label + ' the second session retains its independent query', await activeBrief(1).getByRole('searchbox', { name: 'Find in conversation' }).inputValue() === 'retry');
    await page.evaluate(() => window.swipeDeck.stack[0].deck.go(0));
    await page.waitForFunction(() => new URLSearchParams(location.search).get('find') === 'cache');
    if (process.env.SHOTS) {
      mkdirSync(process.env.SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(process.env.SHOTS, 'session-search-' + label + '.png') });
    }
    await page.goto(origin + '/app/index.html?view=sessions&session=aaa11111&find=retry');
    await page.waitForFunction(() => [...document.querySelectorAll('[x-data^="sessionBrief(window."]')]
      .some(el => Alpine.$data(el).record && Alpine.$data(el).findQuery === 'retry'));
    check(label + ' cold deep link opens the requested query', await activeBrief().getByRole('button', { name: 'Read exchange 3', exact: true }).isVisible());
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(label + ' has no horizontal overflow', overflow <= 1);
    await context.close();
  }
  assert.deepEqual(writes, [], 'the browser test made no writes');
  assert.deepEqual(errors, [], 'the browser emitted no runtime errors');
  console.log('CHECK OK session-search-browser');
} catch (error) {
  if (debugPage && !debugPage.isClosed()) console.error(await debugPage.evaluate(() => ({
    url: location.href, text: document.body.innerText.slice(-3000),
    sessions: [...document.querySelectorAll('[x-data^="sessionBrief"]')].map(el => {
      const d = Alpine.$data(el); return { id: d.shortId, query: d.findQuery, error: d.err, loaded: !!d.record };
    }),
  })));
  console.error(errors);
  throw error;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
