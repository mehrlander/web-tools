// The activity crawl as a kit: lib/kits/activity-crawl.js, the per-repo pass the
// show-repo shell used to hold inline and now shares with the headless runner
// (scripts/activity-crawl.mjs), so a merge to main can refresh state/activity.json
// without a browser.
//
// Three things are worth holding here, and each is a way the pair could look
// right and be wrong:
//
//   * ONE crawler. The point of the extraction is that CI and the page run the
//     same code, so a test that only exercised the kit would pass while a copy
//     of it sat in the shell.
//   * ONE budget. The shell documents the five caps beside its constants and
//     passes them in; the kit defaults to the same numbers for the runner. Two
//     copies of five numbers drift silently, and the drift shows up as CI
//     scanning a different slice of branches than the app does.
//   * A FAILED READ CARRIES, never blanks. mergeRepo takes any array as a
//     snapshot, so a GraphQL failure that returned an empty PR index used to
//     replace a repo's whole index with nothing, and every branch row went back
//     to "no PR" over a cache that knew better.
//
// No network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const shellSrc = readFileSync(path.join(repoRoot, 'app', 'index.html'), 'utf8');
const runnerSrc = readFileSync(path.join(repoRoot, 'scripts', 'activity-crawl.mjs'), 'utf8');

const win = {};
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/activity-crawl.js'), 'utf8'))(win);
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/repo-activity-cache.js'), 'utf8'))(win);
const { ActivityCrawl: C, RepoActivityCache: A } = win;

// ── One crawler ────────────────────────────────────────────────────────────

test('the shell delegates to the kit instead of holding its own copy', () => {
  assert.match(shellSrc, /window\.ActivityCrawl\.crawlRepo\(repo, meta, now, \{/);
  // A line from deep inside the moved body. Present in the shell means the
  // extraction was undone or duplicated back in.
  assert.doesNotMatch(shellSrc, /const branchSessions = branchWalk\?\.sessions/);
  // The scan gate and the batched check reader moved with it, for the same
  // reason: both have a second caller now.
  assert.match(shellSrc, /window\.ActivityCrawl\.needsScan\(/);
  assert.match(shellSrc, /_checkReader\(gh, ref\)\{ return window\.ActivityCrawl\.checkReader\(gh, ref\); \}/);
});

test('the runner calls the kit, and preflights the GraphQL it needs', () => {
  assert.match(runnerSrc, /C\.crawlRepo\(repo, meta, now, \{/);
  // The preflight is the whole reason this runner is safe to point at the real
  // cache: two of the crawl's reads are GraphQL, and a caller without it writes
  // a wrong entry rather than failing. A Claude Code session is that caller.
  assert.match(runnerSrc, /api\.github\.com\/graphql/);
  assert.match(runnerSrc, /process\.exit\(1\)/);
});

// ── One budget ─────────────────────────────────────────────────────────────

test('the kit defaults match the constants the shell documents and passes', () => {
  const constant = (name) => {
    const m = shellSrc.match(new RegExp(`^  ${name}: (\\d+),`, 'm'));
    assert.ok(m, `${name} is declared in the shell`);
    return +m[1];
  };
  assert.deepEqual(C.CAPS, {
    recentCommits: constant('ACTIVITY_RECENT_COMMITS'),
    prReach: constant('ACTIVITY_PR_REACH'),
    scanCap: constant('ACTIVITY_SCAN_CAP'),
    scanKeep: constant('ACTIVITY_SCAN_KEEP'),
    errorRetry: constant('ACTIVITY_ERROR_RETRY'),
  });
});

// ── The scan gate, now shared ──────────────────────────────────────────────

test('a stamp with no rows behind it is not a scan', () => {
  // The 2026-08-17 shape: a failed pass left scannedAt current and branches
  // empty, and "not pushed since the last scan" then skipped the repo forever.
  assert.equal(C.needsScan({ scan: { scannedAt: '2026-09-19T12:00:00Z', branches: [] } },
                           '2026-09-19T11:00:00Z'), true);
  assert.equal(C.needsScan(null, '2026-09-19T11:00:00Z'), true);
});

test('a repo pushed since its last scan scans, and a quiet one carries', () => {
  const scanned = { scan: { scannedAt: '2026-09-19T12:00:00Z', branches: [{ name: 'x' }] } };
  assert.equal(C.needsScan(scanned, '2026-09-19T13:00:00Z'), true, 'pushed after the scan');
  assert.equal(C.needsScan(scanned, '2026-09-19T11:00:00Z'), false, 'quiet since the scan');
  // Anything unmeasurable scans rather than guessing.
  assert.equal(C.needsScan(scanned, ''), true);
});

// ── A failed read carries ──────────────────────────────────────────────────

const GOOD_ROWS = [{ head: 'claude/a', number: 7, state: 'merged' }];

class CrawlGH {
  constructor(opts = {}){ this.opts = opts; }
  async commits(){ return [{ sha: 'main-sha', date: '2026-09-19T12:00:00Z' }]; }
  async pulls(){ return []; }
  async branchPulls(){
    if (this.opts.prIndexFails) throw new Error('GraphQL 403');
    return { rows: GOOD_ROWS, reach: '2026-08-01T00:00:00Z' };
  }
  async branchesDatedSessions(){
    return { branches: [{ name: 'main', date: '2026-09-19T12:00:00Z', sha: 'main-sha', subject: 'm' }],
             sessions: {}, ordered: true, capped: false };
  }
}

const B_STUB = {
  RECENT_DAYS: 14,
  daysAgo: () => 1,
  async scanOlder(){ return { truncated: false, rows: [], pending: 0, beyondHorizon: 0 }; },
};

const crawl = (opts) => C.crawlRepo(
  'mehrlander/web-tools',
  { default_branch: 'main', pushed_at: '2026-09-19T12:30:00Z' },
  Date.parse('2026-09-19T13:00:00Z'),
  { makeGH: () => new CrawlGH(opts), B: B_STUB, checks: null, cfg: null, deep: true, prev: null },
);

test('a read PR index is published whole', async () => {
  const out = await crawl({});
  assert.deepEqual(out.branchPRs, GOOD_ROWS);
  assert.equal(out.prReach, '2026-08-01T00:00:00Z');
});

test('a FAILED PR index is omitted, so the fold keeps the stored one', async () => {
  const out = await crawl({ prIndexFails: true });
  assert.equal('branchPRs' in out, false, 'omitted, not empty');
  assert.equal('prReach' in out, false);

  // What the omission buys, through the fold that reads it: an entry that knew
  // about a merged PR still knows after a pass whose index read failed.
  const prev = { branchPRs: GOOD_ROWS, prReach: '2026-08-01T00:00:00Z', counts: {}, recentCommits: [] };
  const merged = A.mergeRepo(prev, out, '2026-09-19T13:00:00Z');
  assert.deepEqual(merged.branchPRs, GOOD_ROWS);
  assert.equal(merged.prReach, '2026-08-01T00:00:00Z');
});
