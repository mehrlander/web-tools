import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, loadKit, repoRoot } from './bootstrap.mjs';

const source = readFileSync(path.join(repoRoot, 'lib/alpineComponents/estate.js'), 'utf8');
const DAY = 864e5;
const iso = age => new Date(Date.now() - age * DAY).toISOString();
const row = (id, age, title, extra = {}) => ({ id, title, day: iso(age).slice(0, 10),
  started: iso(age), ended: iso(age), repos: [{ name: 'tools', branch: 'main' }],
  branches: [], state: 'ready', beats: [0], ...extra });
const ids = rows => rows.map(r => r.id);
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const result = (ids, extra = {}) => ({ hits: ids.map(id => ({ id })), indexed: true, missing: [], ...extra });

function estate(search = async () => result(['aaaa1111', 'cccc3333', 'dddd4444'])) {
  const { window } = makeWindow();
  let factory;
  const searches = [], stamps = [];
  const Alpine = { data(_name, fn) { factory = fn; }, raw: x => x, initTree() {} };
  window.Alpine = Alpine;
  window.TOKEN = 'fixture-token';
  window.gh = { load: async () => {} };
  window.__shell = { REGISTRY_REPO: 'me/store', sessionTopicSpec: '', sessionSetSpec: '',
    goSearch: seed => searches.push(seed), setSessionSearch: seed => stamps.push(seed) };
  window.EstateSearch = { sessions: search };
  window.SessionIndex = {};
  for (const kit of ['closing-state', 'repo-sessions-cache', 'branch-status']) loadKit(kit, { window });
  new Function('window', 'document', 'Alpine', 'gh', 'location', source)(
    window, window.document, Alpine, window.gh, window.location);
  window.document.dispatchEvent(new window.Event('alpine:init'));
  const data = factory();
  data.sessionRows_ = [row('aaaa1111', .1, 'One'), row('bbbb2222', .2, 'Cobalt metadata'),
    row('eeee5555', .3, 'Cobalt unreadable'), row('cccc3333', 3, 'Three'),
    row('dddd4444', 9, 'Nine'), row('ffff6666', .4, 'Unrelated')];
  data.activity = {};
  data.sessionDiscussion = true;
  data.activityQuery = 'cobalt';
  return { data, window, searches, stamps };
}

test('Discussion unions indexed and row matches within the explicit time window', async () => {
  const { data } = estate();
  assert.equal(data.sessionSearchPending, true);
  assert.equal(data.sessionQueryCount, 'Searching…');
  await data.refreshSessionDiscussion();
  assert.equal(data.sessionSearchPending, false);
  assert.deepEqual(ids(data.sessionDeckRows), ['aaaa1111', 'bbbb2222', 'eeee5555']);
  data.sessionScope = 'week';
  assert.deepEqual(ids(data.sessionDeckRows), ['aaaa1111', 'bbbb2222', 'eeee5555', 'cccc3333']);
  data.sessionScope = 'all';
  assert.equal(data.sessionDeckRows.length, 5);
  assert.equal(data.sessionQueryCount, '5 of 6');
  data.openSessionGrep();
  assert.deepEqual(ids(data.sessionDeckRows), ['bbbb2222', 'eeee5555']);
});

test('Discussion keeps repo, state, topic and ordered set filters strict in list, table and deck', async () => {
  const { data, window } = estate();
  data.sessionRows_ = data.sessionRows_.map(r => ({ ...r,
    topics: r.id === 'aaaa1111' ? ['routing'] : [],
    state: r.id === 'aaaa1111' ? 'ready' : 'merged' }));
  await data.refreshSessionDiscussion();
  data.sessionRepoFilter = 'absent';
  assert.equal(data.activeSessionRepo, 'absent');
  assert.equal(data.sessionRepos.find(r => r.repo === 'absent').count, 0);
  assert.equal(data.sessionNodes.length, 0);
  assert.equal(data.grainRows.length, 0);
  data.sessionRepoFilter = 'tools';
  data.sessionStateFilter = 'ready';
  assert.deepEqual(ids(data.sessionDeckRows), ['aaaa1111']);
  assert.deepEqual(ids(data.grainRows), ['aaaa1111']);
  data.sessionStateFilter = 'closed';
  assert.equal(data.activeSessionState, 'closed');
  assert.equal(data.sessionStates.find(r => r.key === 'closed').count, 0);
  assert.equal(data.grainRows.length, 0);
  data.sessionStateFilter = '';
  window.__shell.sessionTopicSpec = 'routing';
  assert.deepEqual(ids(data.sessionDeckRows), ['aaaa1111']);
  window.__shell.sessionTopicSpec = '';
  window.__shell.sessionSetSpec = 'eeee5555,aaaa1111,ffff6666';
  data.sessionScope = 'set';
  assert.deepEqual(ids(data.sessionDeckRows), ['eeee5555', 'aaaa1111']);
  assert.deepEqual(ids(data.grainRows), ['eeee5555', 'aaaa1111']);
  assert.deepEqual(data.sessionInspectionIds(), ['eeee5555', 'aaaa1111', 'ffff6666']);
});

test('branch joins and recordless stubs remain findable when discussion is included', async () => {
  const { data } = estate(async () => result([]));
  data.activity = { 'me/other': { defaultBranch: 'main', scan: { branches: [
    { name: 'claude/cobalt-work', group: 'active', date: iso(.1),
      sessions: ['https://claude.ai/code/session_ZZZZZZZZZZZZ'] },
  ] } } };
  await data.refreshSessionDiscussion();
  assert.equal(data.sessionNodes.some(n => n.kind === 'stub'), true);
  data.sessionRepoFilter = 'other';
  assert.equal(data.sessionNodes.length, 1);
  assert.equal(data.sessionNodes[0].kind, 'stub');
  assert.equal(data.sessionDeckRows.length, 0);
  data.inspectSessionMatches();
});

test('late results cannot restore an old query, disabled mode or old credential', async () => {
  const calls = [];
  const { data, window } = estate(() => { const d = deferred(); calls.push(d); return d.promise; });
  const first = data.refreshSessionDiscussion();
  data.activityQuery = 'new word';
  const second = data.refreshSessionDiscussion();
  calls[0].resolve(result(['aaaa1111']));
  await first;
  assert.equal(data.discussionBusy, true);
  assert.deepEqual(data.discussionHits, []);
  calls[1].resolve(result(['cccc3333']));
  await second;
  assert.equal(data.discussionQuery, 'new word');
  assert.deepEqual(data.discussionHits, ['cccc3333']);
  const third = data.refreshSessionDiscussion(true);
  data.sessionDiscussion = false;
  await data.refreshSessionDiscussion();
  calls[2].resolve(result(['aaaa1111']));
  await third;
  assert.deepEqual(data.discussionHits, []);
  data.sessionDiscussion = true;
  const fourth = data.refreshSessionDiscussion();
  window.TOKEN = 'replacement-token';
  const fifth = data.refreshSessionDiscussion();
  calls[3].resolve(result(['aaaa1111']));
  await fourth;
  assert.equal(data.discussionBusy, true);
  calls[4].resolve(result(['eeee5555']));
  await fifth;
  assert.deepEqual(data.discussionHits, ['eeee5555']);
});

test('missing shards and failures leave metadata available with a concise incomplete status', async () => {
  const { data, window } = estate(async () => result(['aaaa1111'], { missing: ['2026/09'] }));
  await data.refreshSessionDiscussion();
  assert.equal(data.discussionError, '1 unindexed month.');
  assert.equal(data.sessionDeckRows.length, 3);
  window.EstateSearch.sessions = async () => { throw new Error('Unavailable'); };
  await data.refreshSessionDiscussion(true);
  assert.equal(data.sessionSearchPending, false);
  assert.match(data.discussionError, /Session details only/);
  assert.deepEqual(ids(data.sessionDeckRows), ['bbbb2222', 'eeee5555']);
});

test('freshness confirmation refreshes discussion only when the session cache changes', async () => {
  let searches = 0, resets = 0;
  const { data, window } = estate(async () => result([++searches === 1 ? 'aaaa1111' : 'cccc3333']));
  window.GH = { FRESH: { cache: 'no-store' } };
  window.EstateSearch.reset = () => resets++;
  data.hasToken = () => true;
  data.$nextTick = () => {};
  data._loaded.sessions = true;
  data.cacheSha_.sessions = 's1';
  const rows = data.sessionRows_;
  let servedSha = 's2';
  const reads = [];
  data.regGH = () => ({ async get(path, opts) {
    reads.push({ path, opts });
    if (path !== 'state/sessions.json') throw new Error('404');
    return { text: JSON.stringify({ rows }), sha: servedSha };
  } });
  await data.refreshSessionDiscussion();
  await data.confirmCache({ key: 'sessions', sha: 's1' });
  assert.equal(reads.length, 0);
  assert.equal(resets, 0);
  assert.equal(searches, 1);
  await data.confirmCache({ key: 'sessions', sha: 's2' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads[0].opts, window.GH.FRESH);
  assert.equal(data.cacheSha_.sessions, 's2');
  assert.equal(resets, 1);
  assert.equal(searches, 2);
  assert.deepEqual(data.discussionHits, ['cccc3333']);
  const retainedRows = data.sessionRows_;
  await data.reloadSessions({ rows }, 's2');
  assert.equal(data.sessionRows_, retainedRows);
  assert.equal(resets, 1, 'an unchanged handed document keeps the shared index');
  await data.confirmCache({ key: 'sessions', sha: 's3' });
  assert.equal(resets, 1, 'a lagging read that still yields the shown copy does not discard its index');
  await data.reloadSessions({ rows }, 's4');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(resets, 2, 'a changed handed document refreshes discussion too');
  assert.equal(searches, 3);
});

test('Inspect snapshots scope before the query, including empty scopes and local-only matches', async () => {
  const { data, searches } = estate();
  data.inspectSessionMatches();
  assert.equal(searches.length, 0, 'incomplete results cannot be frozen');
  await data.refreshSessionDiscussion();
  data.inspectSessionMatches();
  assert.deepEqual(searches[0].sessionIds, ['aaaa1111', 'bbbb2222', 'eeee5555', 'ffff6666']);
  assert.deepEqual(ids(searches[0].sessionRows), ['aaaa1111', 'bbbb2222', 'eeee5555']);
  assert.deepEqual(searches[0].sessionExtraIds, ['bbbb2222', 'eeee5555']);
  assert.deepEqual(searches[0].sessionScope, { scope: 'day', repo: '', state: '', topic: '', set: '' });
  data.sessionRepoFilter = 'absent';
  data.inspectSessionMatches();
  assert.deepEqual(searches[1].sessionIds, []);
  assert.deepEqual(searches[1].sessionExtraIds, []);
});

test('route seed restores filters and stamps their normalized state', () => {
  const { data, stamps } = estate();
  data.applySessionSearchSeed({ q: '  cobalt  ', discussion: true, scope: 'week', repo: 'tools', state: 'all' });
  data.stampSessionSearch();
  assert.deepEqual(stamps[0], { q: 'cobalt', discussion: true, scope: 'week', repo: 'tools', state: '' });
  data.applySessionSearchSeed({ q: '', discussion: false, scope: 'invalid' });
  assert.equal(data.sessionScope, 'day');
  assert.equal(data.sessionDiscussion, false);
});

test('the aggregate rail follows asynchronous membership and Discussion toggling', async () => {
  const d = deferred();
  const { data } = estate(() => d.promise);
  data.railNow = Date.now();
  const run = data.refreshSessionDiscussion();
  const before = data.sessionRailAll.reduce((n, bin) => n + bin.n, 0);
  assert.equal(before, 2);
  d.resolve(result(['aaaa1111']));
  await run;
  assert.equal(data.sessionRailAll.reduce((n, bin) => n + bin.n, 0), 3);
  data.openSessionGrep();
  assert.equal(data.sessionRailAll.reduce((n, bin) => n + bin.n, 0), 2);
});

test('Activity seeds the discussion query into every reader card without changing direct links', async () => {
  const { data } = estate();
  await data.refreshSessionDiscussion();
  data.mountSessionDeck = () => {};
  const rows = data.sessionDeckRows;
  data.openSessionDetail(rows[0]);
  assert.equal(data.sessionDeck.compact, true);
  assert.deepEqual(data.sessionDeck.finds, Object.fromEntries(rows.map(r => [r.id, 'cobalt'])));
  data._openCard = { find: 'specific phrase' };
  data.openSessionDetail(rows[0]);
  assert.equal(data.sessionDeck.compact, true, 'a cold/Forward find restores the compact reading');
  assert.equal(data.sessionDeck.finds[rows[0].id], 'specific phrase');
  assert.equal(data.sessionDeck.finds[rows[1].id], 'cobalt', 'other cards retain the Activity question');
  data._openCard = { find: 'specific phrase', start: 0 };
  data.openSessionDetail(rows[0]);
  assert.equal(data.sessionDeck.compact, false);
  assert.deepEqual(data.sessionDeck.finds, { [rows[0].id]: 'specific phrase' });
});
