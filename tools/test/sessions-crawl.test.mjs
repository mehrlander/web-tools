// The sessions crawl as a kit: lib/kits/sessions-crawl.js, the pass the app
// used to hold inline and now shares with the headless runner
// (scripts/sessions-crawl.mjs), so the hourly Action can refresh
// state/sessions.json and the phone's state/session-menu.json without a browser.
//
// Held here, each a way the pair could look right and be wrong:
//
//   * ONE crawler. CI and the page run the same fold, so a test that only
//     exercised the kit would pass while a copy of it sat in the shell.
//   * ONE budget. The shell's two constants and the kit's defaults are the same
//     numbers, or CI reads a different slice of records than the app does.
//   * COMPLETE means complete. The app marks the store unchanged only after a
//     complete pass, so a capped pass has to say it was not one.
//   * PAST THE CAP is remembered. A record the fold reads and does not keep
//     used to read as new on every pass; with 125 of them against 120 reads a
//     pass (2026-10-05) no pass was ever complete and each read 120 records.
//
// No network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const read = (...p) => readFileSync(path.join(repoRoot, ...p), 'utf8');
const shellSrc = read('app', 'index.html');
const runnerSrc = read('scripts', 'sessions-crawl.mjs');
const workflowSrc = read('.github', 'workflows', 'activity-cache.yml');

const win = {};
for (const f of ['lib/kits/csv.js', 'lib/kits/closing-state.js', 'lib/kits/repo-sessions-cache.js',
                 'lib/kits/session-index.js', 'lib/kits/crawl-runs.js', 'lib/kits/sessions-crawl.js'])
  new Function('window', read(f))(win);
const { RepoSessionsCache: S, SessionIndex: X, CrawlRuns, SessionsCrawl: C } = win;

// ── One crawler, one budget ────────────────────────────────────────────────

test('the shell delegates to the kit instead of holding its own copy', () => {
  assert.match(shellSrc, /await gh\.load\('kits\/sessions-crawl\.js'\)/);
  assert.match(shellSrc, /const listing = await C\.listRecords\(reg, S\);/);
  assert.match(shellSrc, /return await C\.fold\(\{/);
  assert.match(shellSrc, /window\.SessionsCrawl\.readTitles\(/);
  // Lines from inside the moved body. Present in the shell means the lift was
  // undone or duplicated back in.
  assert.doesNotMatch(shellSrc, /const take = stale\.slice\(0, this\.SESSIONS_MAX_FETCH\)/);
  assert.doesNotMatch(shellSrc, /'Update sessions cache \(state\/sessions\.json\)'/);
});

test('the runner calls the kit, and the hourly Action runs the runner', () => {
  assert.match(runnerSrc, /C\.listRecords\(reg, S\)/);
  assert.match(runnerSrc, /await C\.fold\(\{/);
  assert.match(runnerSrc, /via: 'ci'/);
  assert.match(workflowSrc, /npm run sessions-refresh/);
  assert.match(workflowSrc, /github\.event_name == 'schedule'/);
});

test('the kit budget matches the constants the shell passes', () => {
  const constant = (name) => {
    const m = shellSrc.match(new RegExp(`^  ${name}: (\\d+),`, 'm'));
    assert.ok(m, `${name} is declared in the shell`);
    return +m[1];
  };
  assert.deepEqual(C.BUDGET, { maxFetch: constant('SESSIONS_MAX_FETCH'), pool: constant('SESSIONS_FETCH_POOL') });
});

// ── An in-memory registry ──────────────────────────────────────────────────

const hex8 = (n) => n.toString(16).padStart(8, '0');
function record(n, over = {}) {
  const t = new Date(Date.UTC(2026, 6, 1) + n * 3600e3);
  const day = t.toISOString().slice(0, 10);
  return {
    schema: 3, session_id: hex8(n) + '-x', short: hex8(n),
    agent_session: 'https://claude.ai/code/session_01T' + hex8(n),
    day, started: t.toISOString(), ended: new Date(+t + 1800e3).toISOString(),
    repos: [{ name: 'web-tools', branch: 'claude/r-' + n, lines: 1 }],
    opening_ask: 'ask ' + n, exchanges: 1, assistant_messages: 1,
    tools: {}, tokens: {}, files_total: 0, files: {}, calls_total: 0, failures: 0, transcript_bytes: 1,
    ...over,
  };
}
const recordPath = (r) => `sessions/${r.day.slice(0, 4)}/${r.day.slice(5, 7)}/${r.day}-${r.short}.json`;

function store(records) {
  const blobs = new Map(), tree = [];
  let shaN = 0;
  const put = (r) => {
    const sha = 'b' + (++shaN);
    blobs.set(sha, JSON.stringify(r));
    const p = recordPath(r);
    const at = tree.findIndex(e => e.path === p);
    if (at >= 0) tree[at].sha = sha; else tree.push({ path: p, type: 'blob', sha });
  };
  records.forEach(put);
  const files = {}, writes = [], reads = [];
  const reg = {
    req: async (p) => {
      if (p.startsWith('git/blobs/')) { reads.push(p); return { content: Buffer.from(blobs.get(p.slice(10))).toString('base64') }; }
      return { tree: tree.map(e => ({ ...e })) };
    },
    decode: (b64) => Buffer.from(b64, 'base64').toString('utf8'),
  };
  let w = 0;
  const pass = async (opts = {}) => {
    reads.length = 0; writes.length = 0;
    const order = [];
    const listing = await C.listRecords(reg, S);
    const r = await C.fold({
      reg, S, listing,
      readFold: async (p) => files[p] || null,
      saveFold: async (p, doc, message) => {
        order.push('save'); writes.push(p);
        files[p] = { doc: JSON.parse(JSON.stringify(doc)), sha: 'w' + (++w) };
        return { content: { sha: files[p].sha } };
      },
      readTitles: async () => null, loadIndex: async () => X, runs: CrawlRuns, warn: () => {},
      onBuilt: (b) => order.push('built:' + b.complete),
      ...opts,
    });
    return { ...r, reads: reads.length, writes: [...writes], order };
  };
  return { put, pass, files, tree };
}

// ── The fold ───────────────────────────────────────────────────────────────

test('a first pass folds every record and writes the cache, the phone menu and the index', async () => {
  const s = store(Array.from({ length: 30 }, (_, i) => record(i)));
  const r = await s.pass();
  assert.equal(r.reads, 30);
  assert.equal(r.complete, true);
  assert.equal(r.committed, true);
  assert.equal(r.doc.rows.length, 30);
  assert.ok(r.writes.includes(S.CACHE_PATH));
  assert.ok(r.writes.includes(S.MENU_PATH));
  assert.ok(r.writes.some(p => p.startsWith('state/sessions-index/')));
  assert.equal(r.sha, s.files[S.CACHE_PATH].sha, 'the sha handed back is the commit\'s');
});

test('a pass over an unmoved store reads nothing and writes nothing', async () => {
  const s = store(Array.from({ length: 30 }, (_, i) => record(i)));
  await s.pass();
  const r = await s.pass();
  assert.equal(r.reads, 0);
  assert.equal(r.committed, false);
  assert.deepEqual(r.writes, []);
  assert.equal(r.sha, s.files[S.CACHE_PATH].sha, 'and the sha is main\'s copy, which it matches');
});

test('a capped pass says it was not complete, before anything is written', async () => {
  const s = store(Array.from({ length: 30 }, (_, i) => record(i)));
  const r = await s.pass({ maxFetch: 10 });
  assert.equal(r.reads, 10);
  assert.equal(r.deferred, 20);
  assert.equal(r.complete, false);
  assert.equal(r.order[0], 'built:false', 'onBuilt comes first, so a failed save cannot skip it');
});

test('records past the row cap are read once, not on every pass', async () => {
  const s = store(Array.from({ length: S.ROW_CAP + 10 }, (_, i) => record(i)));
  const first = await s.pass({ maxFetch: 1000 });
  assert.equal(first.doc.rows.length, S.ROW_CAP);
  assert.equal(Object.keys(first.doc.capped).length, 10);
  const second = await s.pass({ maxFetch: 1000 });
  assert.equal(second.reads, 0, 'the overflow is known by sha');
  assert.equal(second.complete, true);
  // The oldest record is past the cap; a new sha brings it back for one read.
  s.put(record(0, { opening_ask: 'edited' }));
  const third = await s.pass({ maxFetch: 1000 });
  assert.equal(third.reads, 1);
});

// A cache with room left must read its capped records to fill it, so the list
// is dropped rather than carried, and the next pass reads them.
test('a cache that loses rows refills from the records past the cap', async () => {
  const s = store(Array.from({ length: S.ROW_CAP + 10 }, (_, i) => record(i)));
  await s.pass({ maxFetch: 1000 });
  s.tree.splice(s.tree.length - 20, 20);   // the twenty newest records leave the store
  const shrunk = await s.pass({ maxFetch: 1000 });
  assert.equal(shrunk.doc.rows.length, S.ROW_CAP - 20);
  assert.equal(shrunk.doc.capped, undefined);
  const refill = await s.pass({ maxFetch: 1000 });
  assert.equal(refill.reads, 10);
  assert.equal(refill.doc.rows.length, S.ROW_CAP - 10, 'every record left in the store has a row');
});

test('a titles read that fails returns null, so the fold carries the titles it has', async () => {
  const gh = { req: async () => { throw new Error('404'); } };
  assert.equal(await C.readTitles(gh, S, () => {}), null);
});
