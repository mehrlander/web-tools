// The watermark gate: the activity crawl skipping a repo that cannot have moved.
//
// The crawl used to pay for every estate repo on every pass. Measured
// 2026-08-21 off its own call log, a run over ten repos spent 231 calls, and
// only 168 of those were the branch scan the existing pushed_at gate already
// rations. The other ~62 were four calls per repo fired unconditionally, so a
// completely quiet estate still cost them. This gate closes that.
//
// The gate is read out of source rather than executed, because `_crawlActivity`
// lives in the shell's inline script and needs a live GitHub to run. What can
// be held here is the SHAPE, and the shape is where the bugs are: every clause
// below is a way the gate could be wrong that would look right, and the worst
// of them fails silently by serving stale data rather than by throwing.
//
// The watermark reader itself (gh.prWatermark) is exercised for real, since it
// is an ordinary kit function.
//
// No network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const shellSrc = readFileSync(path.join(repoRoot, 'app', 'index.html'), 'utf8');
const gateSrc = shellSrc.slice(shellSrc.indexOf('const quiet = (repo) =>'),
                               shellSrc.indexOf('const SCAN_SKEW_MS'));

test('the gate requires BOTH halves, which is the clause most easily dropped', () => {
  // pushed_at cannot see a PR opening, merging or closing, and this cache
  // stores exactly that in openPRs, branchPRs and prReach. A gate on pushes
  // alone would freeze every branch row's PR verdict until something pushed,
  // and nothing on screen would look wrong.
  assert.match(gateSrc, /pushed !== m\.pushedAt/, 'the push half');
  assert.match(gateSrc, /prAt\[repo\] === m\.prAt/, 'the pull-request half');
});

test('a forced pass is never quiet, or the Refresh button means nothing', () => {
  assert.match(gateSrc, /if \(force\) return false;/);
  // And force has to actually arrive: the crawl took only `deep` before.
  assert.match(shellSrc, /_crawlActivity\(deep, force\)/, 'force is passed');
  assert.match(shellSrc, /async _crawlActivity\(deep, force = false\)/, 'force is received');
});

test('nothing to carry forward is never quiet', () => {
  // A repo with no stored entry has nothing to serve from the cache, however
  // unmoved its watermarks are.
  assert.match(gateSrc, /if \(!prev\?\.repos\?\.\[repo\]\) return false;/);
  assert.match(gateSrc, /if \(!m\) return false;/, 'no recorded mark');
});

test('a reading that failed is never quiet', () => {
  // The distinction between null and '' carries this: a repo with no pull
  // requests reads '' and is quiet, a repo whose read threw records null and
  // is crawled. Gating on a guess is worse than the calls it saves.
  assert.match(gateSrc, /if \(prAt\[repo\] == null\) return false;/);
  assert.match(gateSrc, /if \(!pushed \|\| pushed !== m\.pushedAt\) return false;/);
  assert.match(shellSrc, /catch \{ prAt\[repo\] = null; \}/, 'a failed watermark records null');
});

test('a failed crawl records no watermark, or the failure becomes permanent', () => {
  // Stamping a mark for a repo whose crawl threw would make the next pass call
  // it quiet and carry forward the entry the failed pass never refreshed. The
  // stamp therefore sits inside the success path, after the await.
  const loop = shellSrc.slice(shellSrc.indexOf('const crawlOne = async () => {'),
                              shellSrc.indexOf('await Promise.all(Array.from({ length: Math.min(this.ACTIVITY_REPO_POOL'));
  const stamp = loop.indexOf('nextMarks[repo] = { pushedAt: pushed');
  const caught = loop.indexOf('catch(e){ failed.push(repo);');
  assert.ok(stamp > 0 && caught > 0, 'both the stamp and the catch are present');
  assert.ok(stamp < caught, 'the stamp is inside the try, before the catch');
});

test('a skipped repo keeps its stored entry rather than losing it', () => {
  // buildCache already had to answer "what about a repo I did not fetch", for
  // failures; the skip takes the same path. `members` is the carry scope.
  assert.match(shellSrc, /A\.buildCache\(prev, fetched, nowISO, A\.COMMIT_CAP, members\)/);
  assert.match(shellSrc, /skipped\.push\(repo\);/);
  assert.match(shellSrc, /nextMarks\[repo\] = marks\[repo\];/, 'a skip carries its mark forward');
});

test('the progress bar still counts a skipped repo', () => {
  // The denominator is every member, so a pass that skips eight of ten must
  // still finish its bar rather than stalling at two.
  const loop = shellSrc.slice(shellSrc.indexOf('if (quiet(repo)) {'));
  assert.match(loop.slice(0, 400), /done: \+\+done, total: members\.length/);
});

// ── The reader, run for real ──────────────────────────────────────────────
// gh-api is an ES module and gh-fetch extends its prototype, so it is imported
// and the extension applied by hand, the same way branches-dated-sessions does.

const { default: GH } = await import('../../lib/gh-api.js');
const fetchSrc = readFileSync(path.join(repoRoot, 'lib/gh-fetch.js'), 'utf8');
new Function('window', fetchSrc)({ GH });

const calls = [];
const reader = (rows) => ({ async req(p) { calls.push(p); return rows; } });

test('prWatermark reads one row of the list branchPulls already reads', async () => {
  calls.length = 0;
  const w = await GH.prototype.prWatermark.call(
    reader([{ updated_at: '2026-08-21T23:00:00Z', number: 7 }]));
  assert.deepEqual({ ...w }, { updatedAt: '2026-08-21T23:00:00Z', number: 7 });
  // Same endpoint and same sort as branchPulls, which is what makes it a probe
  // of that index rather than a second source that could disagree with it.
  assert.equal(calls[0], 'pulls?state=all&sort=updated&direction=desc&per_page=1');
});

test('a repo with no pull requests reads empty, not broken', async () => {
  const w = await GH.prototype.prWatermark.call(reader([]));
  // '' compares equal to itself next pass, so an empty repo is quiet rather
  // than permanently unreadable. null is reserved for a read that FAILED.
  assert.equal(w.updatedAt, '');
  assert.notEqual(w.updatedAt, null);
});

test('a null response is empty too, not a crash', async () => {
  const w = await GH.prototype.prWatermark.call(reader(null));
  assert.equal(w.updatedAt, '');
  assert.equal(w.number, 0);
});

// ── The deep-scan return boundary, run for real ───────────────────────────
// A successful scan carries BranchStatus.scanOlder's rows and coverage out of
// crawlRepoActivity. Execute the inline shell method itself so a block-scope
// regression fails exactly as it does in the browser crawl.

const crawlStart = shellSrc.indexOf('  async crawlRepoActivity(');
const crawlEnd = shellSrc.indexOf('  // ── The app-route join', crawlStart);
assert.ok(crawlStart >= 0 && crawlEnd > crawlStart, 'crawlRepoActivity source is present');
const crawlMethodSrc = shellSrc.slice(crawlStart, crawlEnd).trim();
const { crawlRepoActivity } = new Function(`return ({${crawlMethodSrc}})`)();

class ActivityGH {
  async commits(){ return [{ sha: 'main-sha', date: '2026-09-11T17:00:00Z' }]; }
  async pulls(){ return []; }
  async branchPulls(){ return { rows: [], reach: '' }; }
  async branchesDatedSessions(){
    return {
      branches: [
        { name: 'main', date: '2026-09-11T17:00:00Z', sha: 'main-sha', subject: 'main' },
        { name: 'codex/fresh-work', date: '2026-09-11T16:00:00Z', sha: 'topic-sha', subject: 'work' },
      ],
      sessions: {}, ordered: true, capped: false,
    };
  }
}

const activityShell = () => ({
  crawlRepoActivity,
  ACTIVITY_RECENT_COMMITS: 40,
  ACTIVITY_PR_REACH: 100,
  ACTIVITY_SCAN_CAP: 30,
  ACTIVITY_SCAN_KEEP: 200,
  ACTIVITY_ERROR_RETRY: 7,
});

const crawl = async (B) => activityShell().crawlRepoActivity(
  'mehrlander/web-tools',
  { default_branch: 'main', pushed_at: '2026-09-11T17:32:58Z' },
  Date.parse('2026-09-11T18:00:00Z'), {}, B, null, true, null,
);

test('a successful deep activity scan returns its rows and coverage', async () => {
  const oldWindow = globalThis.window;
  globalThis.window = { GH: ActivityGH, RepoChecks: null };
  try {
    const out = await crawl({
      RECENT_DAYS: 14,
      daysAgo: () => 30,
      async scanOlder(){
        return {
          truncated: true, pending: 3, beyondHorizon: 4,
          rows: [{ name: 'codex/fresh-work', date: '2026-09-11T16:00:00Z', sha: 'topic-sha', group: 'stranded' }],
        };
      },
    });

    assert.equal(out.partial, undefined, 'the completed scan is not reported partial');
    assert.equal(out.scan.pending, 3);
    assert.equal(out.scan.beyondHorizon, 4);
    assert.equal(out.scan.truncated, true);
    assert.equal(out.scan.listOrdered, true);
    assert.equal(out.scan.listCapped, false);
    assert.deepEqual(out.scan.branches.map(b => b.name), ['codex/fresh-work']);
  } finally {
    globalThis.window = oldWindow;
  }
});

test('a rejected deep scan stays partial instead of publishing an empty scan', async () => {
  const oldWindow = globalThis.window;
  const oldWarn = console.warn;
  globalThis.window = { GH: ActivityGH, RepoChecks: null };
  console.warn = () => {};
  try {
    const out = await crawl({
      RECENT_DAYS: 14,
      daysAgo: () => 30,
      async scanOlder(){ throw new Error('compare unavailable'); },
    });

    assert.equal(out.partial, true);
    assert.equal(out.scan, undefined, 'mergeRepo will retain the prior scan');
  } finally {
    console.warn = oldWarn;
    globalThis.window = oldWindow;
  }
});
