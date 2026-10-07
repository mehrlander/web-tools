// The gate on each crawl, and the promise the State view used to print over it.
//
// This file replaces state-view-throttles.test.mjs, which held a different
// invariant for a different design. There were three intervals, one per cache,
// owned by the shell that enforced them, and the State view printed each one on
// its row as "auto every 30m". That test existed because the view kept its own
// copy of each number and the copy was the half that aged.
//
// Both sides of that are gone. The view prints no interval, because there is no
// schedule of the source to name: the intervals were floors with a promise
// written on them. (A timer does exist since 2026-10-05, the freshness rule in
// shell-freshness.test.mjs, and it is about the reading on screen.) Each crawl now gates itself per unit of
// work on whether its source moved, which is evidence rather than a guess, and
// what remains of the clock is one shared debounce nothing renders.
//
// The gates are read out of source rather than executed, for the same reason
// activity-watermark-gate.test.mjs reads its own: they live in the shell's
// inline script and need a live GitHub to run. What can be held here is the
// SHAPE, and the shape is where the bugs are. Every clause below is a way a gate
// could be wrong that would look right on screen, and the worst of them fail by
// serving stale data rather than by throwing.
//
// No network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { makeShell } from './shell.mjs';

const shellSrc = readFileSync(path.join(repoRoot, 'app', 'index.html'), 'utf8');
const viewSrc = readFileSync(path.join(repoRoot, 'lib', 'alpineComponents', 'state-view.js'), 'utf8');

// ── The clock is a debounce now, not a policy ──────────────────────────────

test('one floor, shared, and no per-cache interval left to drift', () => {
  // Three constants became one. The old names are asserted absent rather than
  // merely unused: a reintroduced CONFIG_CACHE_INTERVAL_MS would gate a crawl
  // on the clock again with nothing else in the suite to notice.
  assert.doesNotMatch(shellSrc, /_CACHE_INTERVAL_MS/,
    'a per-cache interval is back; the gate belongs inside the crawl');
  assert.match(shellSrc, /^ {2}CRAWL_FLOOR_MS: 60 \* 1000,$/m);
});

test('every crawl reads the floor, and nothing else reads a clock', () => {
  const floors = shellSrc.match(/Date\.now\(\) - last < this\.CRAWL_FLOOR_MS/g) || [];
  assert.equal(floors.length, 3, 'configs, activity and sessions each debounce');
});

test('the view names no schedule, since naming one is what went wrong', () => {
  // "auto every 30m" read as a promise the shell never made. The whole row of
  // machinery behind it goes with the words: the view held a fallback copy of
  // each interval and resolved the live one off the shell by name.
  // The rendered string, not the word: the comment recording why this went is
  // the kind of prose the repo keeps, and a test that forbade naming a retired
  // feature would forbid explaining it.
  assert.doesNotMatch(viewSrc, /'auto every '/);
  assert.doesNotMatch(viewSrc, /throttleKey|throttleMs|throttleOf/);
});

// ── The config gate: a repo that cannot have moved is not read ─────────────

const cfgGate = shellSrc.slice(shellSrc.indexOf('const cquiet = (repo) =>'),
                               shellSrc.indexOf('const cskipped = []'));

test('the config gate reads pushed_at off the enumeration it already makes', () => {
  // One listing, two jobs. Paying a second call to learn what the first one
  // returned is what would make per-repo gating not worth having.
  assert.match(shellSrc, /pushedAt = new Map\(all\.map\(r => \[r\.full_name, r\.pushed_at \|\| ''\]\)\)/);
});

test('a forced config pass is never quiet, or Refresh means nothing', () => {
  assert.match(cfgGate, /if \(force\) return false;/);
});

test('nothing to carry forward is never quiet', () => {
  // A skip serves the stored entry through buildCache's `carry`. A repo with
  // no stored entry has nothing to serve, however unmoved it is.
  assert.match(cfgGate, /if \(!cachedRepos\.has\(repo\)\) return false;/);
});

test('an unreadable pushed_at is never quiet', () => {
  // The fallback enumeration (this.estateRepos, when the listing throws) fills
  // no pushed_at at all, so a crawl that lost the listing must read every repo
  // rather than trust an empty map. Gating on a guess is worse than the calls
  // it saves.
  assert.match(cfgGate, /if \(!pushed\) return false;/);
  assert.match(cfgGate, /return cmarks\[repo\] === pushed;/);
});

test('a mark is stamped only for a repo this pass actually read', () => {
  // Stamping one for a repo whose read threw would make the failure permanent:
  // the next pass would call it quiet and carry forward an entry nothing
  // refreshed. The stamp sits after the fetch, beside it in `fetched`.
  const body = shellSrc.slice(shellSrc.indexOf('const cskipped = []'),
                              shellSrc.indexOf('const moved = window.RepoConfigCache.changedRepos'));
  assert.match(body, /fetched\[repo\] = entry;\r?\n\s*\/\/[\s\S]{0,400}?if \(pushedAt\.get\(repo\)\) cmarks\[repo\] = pushedAt\.get\(repo\);/);
});

// ── The sessions gate: the listing is the evidence ─────────────────────────

// The gate is the shell's; the fold behind it is lib/kits/sessions-crawl.js,
// shared with the headless runner since 2026-10-05.
const sesGate = shellSrc.slice(shellSrc.indexOf('const fingerprint = listing.map'),
                               shellSrc.indexOf("// The fold is the kit's (lib/kits/sessions-crawl.js)"));
const sesKit = readFileSync(path.join(repoRoot, 'lib', 'kits', 'sessions-crawl.js'), 'utf8');

test('the fingerprint covers path AND sha, or a rewrite reads as quiet', () => {
  // A record edited in place keeps its path and changes its blob sha. Paths
  // alone would gate that out and the cache would hold the old body forever.
  assert.match(sesGate, /listing\.map\(e => e\.path \+ ':' \+ e\.sha\)/);
});

test('the gate sits ABOVE the cache read, which is its whole value', () => {
  // Reading state/sessions.json to discover nothing moved costs 371 KB on every
  // arrival, which is the expense the fifteen-minute clock was buying off.
  // The cache is read inside the kit's fold, so the gate has to return before
  // the shell calls it.
  assert.ok(sesGate.length > 0, 'the gate is found');
  assert.ok(shellSrc.indexOf('const fingerprint = listing.map')
          < shellSrc.indexOf('return await C.fold({'),
    'the fingerprint must be compared before the fold reads the cache');
  assert.match(sesKit, /const base = await readFold\(S\.CACHE_PATH\);/);
});

test('a forced sessions pass never gates', () => {
  assert.match(sesGate, /if \(!force && smarks\.listing === fingerprint\)/);
  assert.match(shellSrc, /this\._sessionsCrawl = this\._crawlSessions\(force\)/, 'force is passed');
  assert.match(shellSrc, /async _crawlSessions\(force = false\)/, 'force is received');
});

test('a gated pass still stamps `checked`, because it did check', () => {
  // The floor above is a debounce; this is the reading it debounces. Leaving it
  // unstamped would make "checked" mean "last committed", which is exactly the
  // conflation the State view's two ages exist to keep apart.
  assert.match(sesGate, /localStorage\.setItem\(this\._sessionsCheckKey/);
});

test('an incomplete fold leaves the store looking moved, which it is', () => {
  // THE CLAUSE THIS GATE IS WRONG WITHOUT. `stale` can exceed SESSIONS_MAX_FETCH
  // and a record whose blob read threw is not in `fetched` either; both stay
  // stale for the next pass. Stamping the fingerprint anyway would tell that
  // pass the store had not moved, and those records would never be read again:
  // the cache would sit permanently short with every reading on screen saying
  // it was current.
  // The kit decides what complete means; the shell marks only on it.
  assert.match(sesKit, /const complete = !deferred && Object\.keys\(fetched\)\.length === take\.length;/);
  assert.match(shellSrc, /onBuilt: \(\{ complete \}\) => \{[\s\S]{0,200}?if \(complete\) this\._setMarks\(this\._sessionsMarkKey/);
});

// ── Arrival ────────────────────────────────────────────────────────────────

// Executed rather than read since 2026-10-05: goState routes through the
// shell's checkCache, the path the freshness rule uses, so the harness can
// stage each crawl's answer and watch what the arrival does with it.
function stateShell() {
  const h = makeShell();
  h.shell.hasToken = () => true;
  h.shell.syncUrl = () => {};
  h.shell.checkStamp = () => Date.now();
  const calls = [];
  h.shell.refreshConfigCache = async (force) => { calls.push(['configs', force]); return { committed: false }; };
  h.shell.refreshActivityCache = async (force, o) => { calls.push(['activity', force, o?.deep]); return { doc: { repos: {} }, sha: 'a1' }; };
  h.shell.refreshSessionsCache = async (force) => { calls.push(['sessions', force]); return { doc: { rows: [] }, sha: 's1' }; };
  h.shell.confirmCache = async () => {};
  return { ...h, calls };
}
const drain = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r)); };

test('opening State runs all three crawls', async () => {
  // It used to run none, on the argument that a view whose subject is age must
  // not answer its own question before you read it. That held while a crawl
  // cost a full pass; with the gates inside, a look that finds nothing costs
  // about one call each, and the view someone opens BECAUSE they suspect a lag
  // should not be the one view that declines to fix it. Unlike the freshness
  // rule, it checks all three whatever their age: arriving here is asking.
  const h = stateShell();
  h.shell.goState('sessions');
  await drain();
  assert.deepEqual(h.calls.map(c => c[0]).sort(), ['activity', 'configs', 'sessions']);
});

test('the arrival passes are unforced, or the gates would never fire', async () => {
  // A forced pass skips every gate by design. Arriving with force would make
  // every visit a full estate crawl, which is the cost the gates exist to
  // avoid and the reason arriving is affordable at all. The activity pass also
  // leaves out its content scan here.
  const h = stateShell();
  h.shell.goState();
  await drain();
  for (const c of h.calls) assert.equal(c[1], false, c[0] + ' must be unforced');
  assert.equal(h.calls.find(c => c[0] === 'activity')[2], false, 'no scan on arrival');
});

// ── A kick that lands has to say so ────────────────────────────────────────
// The half this change shipped without, and the way it failed is the reason it
// needs a test rather than a careful reader. The crawls ran, gated correctly,
// and stamped their `checked` keys. The view had read those stamps once at
// mount and had no reason to read them again, so every row sat there reporting
// an age from before the crawl: on a phone, "checked 1d ago" over a crawl that
// had finished a second earlier. Nothing threw, nothing logged, and the only
// symptom was a number that looked plausible.

test('goState announces each kick as it lands, and once when all settle', async () => {
  const h = stateShell();
  h.shell.goState();
  await drain();
  const checked = h.events.filter(e => e.type === 'web-tools:cache-checked');
  // Per kick, so a row updates as its own crawl lands rather than at the pace
  // of the slowest of the three.
  assert.equal(checked.filter(e => !e.detail.settled).length, 3);
  // And once at the end: a crawl that committed also moved `written`, which no
  // localStorage read can see.
  assert.equal(checked.filter(e => e.detail.settled).length, 1);
  assert.equal(checked.at(-1).detail.settled, true, 'the settled pass comes last');
});

test('goState announces the activity and sessions documents it was handed', async () => {
  const h = stateShell();
  h.shell.goState();
  await drain();
  assert.equal(h.events.filter(e => e.type === 'web-tools:activity-refreshed').length, 1);
  assert.equal(h.events.filter(e => e.type === 'web-tools:sessions-refreshed').length, 1);
});

test('the view listens for it, and cleans the listener up', () => {
  assert.match(viewSrc, /document\.addEventListener\('web-tools:cache-checked', this\._checked\)/);
  assert.match(viewSrc, /document\.removeEventListener\('web-tools:cache-checked', this\._checked\)/);
  // The cheap pass reads localStorage only. Calling load() on every kick would
  // put three five-call reads on every visit to the view.
  assert.match(viewSrc, /if \(e\.detail\?\.settled\) \{ this\.load\(\); return; \}/);
  assert.match(viewSrc, /checkedAgo: this\.checkedAgo\(r\.checkedKey\)/);
});

test('the manual events are still separate, since they mean something else', () => {
  // `*-refreshed` says a crawl the USER forced has finished and the panes it
  // feeds should re-read. Folding the arrival kicks into it would put a full
  // estate reload behind every visit to this view.
  for (const ev of ['configs-refreshed', 'activity-refreshed', 'sessions-refreshed'])
    assert.ok(viewSrc.includes(ev), `${ev} should still be listened for`);
});

// ── Saying it is checking, while it checks ─────────────────────────────────
// The row went from "1d ago" to "22m ago" with nothing in between, so the one
// stretch where the view had something live to report was the stretch it said
// nothing at all.

test('the arrival flag is separate from the buttons, and has to be', async () => {
  // The `*Refreshing` flags bracket a run whose progress slot is opened and
  // closed, and closeCrawl writes that run's call log, which is a COMMIT.
  // Borrowing them for the arrival kicks would put a commit on every visit to
  // this view. That is the whole reason for a second flag rather than reuse.
  assert.match(shellSrc, /^ {2}crawlChecking: \{ configs: false, activity: false, sessions: false \},$/m);
  const h = stateShell();
  h.shell.openCrawl = () => assert.fail('an arrival check must not open a progress slot');
  let during = null;
  h.shell.refreshSessionsCache = async () => {
    during = { checking: h.shell.crawlChecking.sessions, button: h.shell.sessionsRefreshing };
    return { doc: { rows: [] }, sha: 's1' };
  };
  h.shell.goState();
  await drain();
  assert.deepEqual(during, { checking: true, button: false });
});

test('a crawl that threw still stops saying it is checking', async () => {
  // A failed crawl has still stopped running, and a row left spinning forever
  // over one is a worse reading than the stale age it replaced, because it
  // claims work is happening. Nor may it strand the settled announcement.
  const h = stateShell();
  h.shell.refreshSessionsCache = async () => { throw new Error('GitHub Error 409'); };
  h.shell.goState();
  await drain();
  assert.equal(h.shell.crawlChecking.sessions, false);
  assert.match(h.shell.cacheCheck.sessions.failed, /409/);
  assert.equal(h.events.filter(e => e.type === 'web-tools:cache-checked' && e.detail.settled).length, 1);
});

test('the row reads the flag, which is what subscribes it', () => {
  // window.__shell is the shell's own Alpine data, so reading a property of it
  // inside a component expression registers the dependency and the row
  // re-renders when the flag moves. Same mechanism as busy().
  assert.match(viewSrc, /checking\(r\) \{ return !!window\.__shell\?\.crawlChecking\?\.\[r\.key\]; \}/);
  assert.match(viewSrc, /<template x-if="checking\(r\)">/);
  assert.match(viewSrc, /<template x-if="!checking\(r\)">/);
});
