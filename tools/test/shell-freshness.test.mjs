// The freshness rule behind every age pill (app/index.html, "Freshness").
//
// While a pill on screen reads a cache, its reading is at most CHECK_MS old, or
// a check of that cache is running, or the last check failed and the pill says
// so. This file holds the shell's half: WHEN a check runs, what it does with
// each answer a crawl can give, and what it records for the pill. The crawls
// are stubbed; what is under test is the decision to call them and what
// follows.
//
// It replaces shell-revisit.test.mjs, which held the list of events this rule
// retired: a return after five minutes hidden, a bfcache restore, an arrival.
// The list had a gap, a tab left open and visible fires none of them, and on
// 2026-10-05 a Sessions pill read "as of 23h" over records that had been
// landing all night.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShell } from './shell.mjs';

const MIN = 60 * 1000;
const CHECK = 5 * MIN;

// A shell whose crawls answer on cue. `stamp` stands in for this browser's
// localStorage stamp, which the real crawls write when they look; a stamp
// inside the window is what makes a check count as a confirmation.
function stubbed({ view = 'sessions', answers = {}, stamp = () => Date.now() } = {}) {
  const h = makeShell();
  const calls = [];
  h.shell.view = view;
  h.shell.hasToken = () => true;
  h.shell.syncUrl = () => {};
  h.shell.checkStamp = stamp;
  h.shell.refreshConfigCache = async () => { calls.push('configs'); return answers.configs ?? { committed: false }; };
  h.shell.refreshActivityCache = async () => { calls.push('activity'); return answers.activity ?? { doc: { repos: {} }, sha: 'a1' }; };
  h.shell.refreshSessionsCache = async () => { calls.push('sessions'); return answers.sessions ?? { doc: { rows: [] }, sha: 's1' }; };
  h.shell.confirmCache = async (key) => { calls.push('confirm:' + key); };
  return { ...h, calls };
}
const drain = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r)); };
const named = (h, type) => h.events.filter(e => e.type === type);
const crawls = (h) => h.calls.filter(c => !c.startsWith('confirm')).sort();
// Push every reading past the window rather than waiting it out.
const age = (h, by = CHECK + 1000) => {
  const t = Date.now() - by;
  for (const k of Object.keys(h.shell.cacheCheck))
    h.shell.cacheCheck = { ...h.shell.cacheCheck, [k]: { ...h.shell.cacheCheck[k], at: t, tried: t } };
};

// ── When a check runs ───────────────────────────────────────────────────────

test('a cache this tab has never checked is due, on every view whose pills read it', async () => {
  for (const [view, want] of [['sessions', ['activity', 'sessions']],
                              ['branches', ['activity']],
                              ['activity', ['activity']],
                              ['repos',    ['configs']],
                              ['state',    ['activity', 'configs', 'sessions']],
                              ['chats',    []]]) {
    const h = stubbed({ view });
    h.shell.ensureFresh();
    await drain();
    assert.deepEqual(crawls(h), want, view);
  }
});

test('a reading inside the window costs nothing; one past it is checked', async () => {
  const h = stubbed();
  h.shell.ensureFresh(); await drain();
  assert.deepEqual(crawls(h), ['activity', 'sessions']);
  h.calls.length = 0;
  h.shell.ensureFresh(); await drain();
  assert.deepEqual(h.calls, [], 'a second consult inside five minutes');
  age(h);
  h.shell.ensureFresh(); await drain();
  assert.deepEqual(crawls(h), ['activity', 'sessions'], 'and past it, both again');
});

// The gap the rule closes. A visible tab fires no event, so only a timer can
// notice that what it shows has aged.
test('the timer is set for the moment the OLDER reading turns five minutes old, and checks when it fires', async () => {
  const h = stubbed();
  const armed = [];
  const real = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => { armed.push({ fn, ms }); return real(() => {}, 0); };
  try {
    const now = Date.now();
    h.shell.cacheCheck = { ...h.shell.cacheCheck,
      sessions: { at: now - 2 * MIN, tried: now - 2 * MIN, failed: '' },
      activity: { at: now - 4 * MIN, tried: now - 4 * MIN, failed: '' } };
    h.shell.ensureFresh();
  } finally { globalThis.setTimeout = real; }
  await drain();
  assert.deepEqual(h.calls, [], 'nothing was due yet');
  const { fn, ms } = armed.at(-1);
  assert.ok(Math.abs(ms - MIN) < 2000, `armed for about a minute, got ${ms}ms`);
  age(h);
  fn();
  await drain();
  assert.deepEqual(crawls(h), ['activity', 'sessions']);
});

test('a hidden tab checks nothing; its return consults the rule, and a flick costs nothing', async () => {
  const h = stubbed();
  h.shell.wireRevisit();
  h.doc.hidden = true;
  h.shell.ensureFresh(); await drain();
  assert.deepEqual(h.calls, [], 'hidden');
  h.doc.hidden = false;
  h.fire('document', 'visibilitychange'); await drain();
  assert.deepEqual(crawls(h), ['activity', 'sessions'], 'the return');
  h.calls.length = 0;
  h.doc.hidden = true;  h.fire('document', 'visibilitychange');
  h.doc.hidden = false; h.fire('document', 'visibilitychange');
  await drain();
  assert.deepEqual(h.calls, [], 'a flick inside the window');
});

// `persisted` means the page came back with no boot at all, so nothing else
// would consult the rule for it.
test('a bfcache restore consults the rule', async () => {
  const h = stubbed();
  h.shell.wireRevisit();
  h.fire('window', 'pageshow', { persisted: true });
  await drain();
  assert.deepEqual(crawls(h), ['activity', 'sessions']);
});

test('opening Repos, Branches or Sessions consults the rule for that pane', async () => {
  for (const [go, want] of [['goRepos', ['configs']], ['goBranches', ['activity']],
                            ['goSessions', ['activity', 'sessions']]]) {
    const h = stubbed({ view: 'landing' });
    h.shell[go]();
    await drain();
    assert.deepEqual(crawls(h), want, go);
  }
});

test('a signed-out shell checks nothing', async () => {
  const h = stubbed({ view: 'state' });
  h.shell.hasToken = () => false;
  h.shell.ensureFresh();
  await drain();
  assert.deepEqual(h.calls, []);
});

// ── What each answer leads to ───────────────────────────────────────────────

// A pass that committed nothing still hands its document over, and that changed
// on purpose: its stamp says when the store was checked, and its sha says which
// copy of main it matches. Going quiet on it left a tab showing an older copy
// that the hourly Action, or a sibling tab, had already replaced.
test('a crawl that hands back a document announces it with main\'s sha, committed or not', async () => {
  const h = stubbed();
  h.shell.ensureFresh(); await drain();
  const s = named(h, 'web-tools:sessions-refreshed');
  const a = named(h, 'web-tools:activity-refreshed');
  assert.equal(s.length, 1); assert.equal(s[0].detail.sha, 's1');
  assert.equal(a.length, 1); assert.equal(a[0].detail.sha, 'a1');
  assert.ok(!h.calls.some(c => c.startsWith('confirm')), 'a document in hand needs no confirm');
});

test('a crawl that declines confirms by sha, and a gate that looked counts as checked', async () => {
  const h = stubbed({ answers: { sessions: { skipped: true, reason: 'no session record has changed since the last crawl' } } });
  h.shell.ensureFresh(); await drain();
  assert.ok(h.calls.includes('confirm:sessions'));
  assert.equal(named(h, 'web-tools:sessions-refreshed').length, 0);
  assert.equal(h.shell.cacheCheck.sessions.failed, '');
  assert.ok(Date.now() - h.shell.cacheCheck.sessions.at < MIN);
});

test('a config crawl that commits tells the cards to re-read; one that does not confirms', async () => {
  const h = stubbed({ view: 'repos', answers: { configs: { committed: true, changed: 1 } } });
  h.shell.ensureFresh(); await drain();
  assert.equal(named(h, 'web-tools:configs-refreshed').length, 1);
  assert.ok(!h.calls.includes('confirm:configs'));
  const q = stubbed({ view: 'repos' });
  q.shell.ensureFresh(); await drain();
  assert.equal(named(q, 'web-tools:configs-refreshed').length, 0);
  assert.ok(q.calls.includes('confirm:configs'));
});

// A crawl that declined for want of input looked at nothing, so its own stamp
// stays old and the pill must not claim a check.
test('a crawl that declined without looking is reported as the reason it gave', async () => {
  const h = stubbed({ view: 'branches',
                      answers: { activity: { skipped: true, reason: 'no estate members in the config cache yet' } },
                      stamp: () => Date.now() - 2 * CHECK });
  h.shell.ensureFresh(); await drain();
  assert.equal(h.shell.cacheCheck.activity.failed, 'no estate members in the config cache yet');
  assert.equal(h.shell.cacheCheck.activity.at, 0);
});

test('a crawl that throws is recorded, keeps the last good reading, and stops saying it is checking', async () => {
  const h = stubbed();
  h.shell.ensureFresh(); await drain();
  age(h);
  const good = h.shell.cacheCheck.sessions.at;
  let release;
  h.shell.refreshSessionsCache = () => new Promise((_, rej) => { release = () => rej(new Error('GitHub Error 409')); });
  h.shell.ensureFresh(); await drain();
  assert.equal(h.shell.crawlChecking.sessions, true, 'checking while it runs');
  release(); await drain();
  assert.equal(h.shell.crawlChecking.sessions, false);
  assert.match(h.shell.cacheCheck.sessions.failed, /409/);
  assert.equal(h.shell.cacheCheck.sessions.at, good, 'the copy on screen is still the one checked then');
  // And it is not retried in a loop: the attempt itself starts a new window.
  h.calls.length = 0;
  h.shell.ensureFresh(); await drain();
  assert.ok(!h.calls.includes('sessions'));
});

// The manual press and the rule write the same record, or the pill would say
// "checked 6m" straight after a Refresh.
test('a Refresh press records its outcome for the pill too', async () => {
  const h = stubbed();
  h.shell.openCrawl = h.shell.closeCrawl = () => {};
  await h.shell.refreshSessions();
  assert.ok(Date.now() - h.shell.cacheCheck.sessions.at < MIN);
  assert.equal(h.shell.cacheCheck.sessions.failed, '');
});

// The confirm itself: one FRESH listing of the directory, whose answer names
// main's blob sha for the file. FRESH because a cached listing would confirm
// the copy it was cached beside.
test('confirmCache lists state/ fresh and announces main\'s sha for the file', async () => {
  const h = makeShell();
  const seen = [];
  h.win.GH = class {
    static FRESH = { cache: 'no-store' };
    async req(path, opts) {
      seen.push({ path, opts });
      return [{ path: 'state/activity.json', sha: 'a9' }, { path: 'state/sessions.json', sha: 's9' }];
    }
  };
  await h.shell.confirmCache('sessions');
  assert.equal(seen[0].path, 'contents/state?ref=main');
  assert.equal(seen[0].opts.cache, 'no-store');
  const e = named(h, 'web-tools:cache-confirm');
  assert.deepEqual(e[0].detail, { key: 'sessions', path: 'state/sessions.json', sha: 's9' });
});
