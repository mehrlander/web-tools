// alpineComponents/estate.js — the text box on the Sessions pane and the one on
// the Chats pane.
//
// The two panes browse two venues by facet (scope, repo and closing state on
// one; provider, tag and hand-layer on the other) and neither had a way to
// type a word until 2026-09-10. Both boxes are the CHEAP pass over what is
// already in hand, and each has an exhaustive counterpart one hop away, so what
// is worth holding here is the reach and the recount:
//
//   - the query is the OUTERMOST filter, so the chip counts under it say how
//     many WOULD be left, which is what makes "Day 0, Week 4" a usable answer;
//   - one query narrows both row lenses, since the Table lens carried a box of
//     its own that matched only the visible columns;
//   - a stub session (named by a branch's commit trailer, carrying no record)
//     stays findable by that branch name rather than dropping out entirely;
//   - the Chats box narrows the LOADED months and does not reach for shards.
//
// Driven over a stub GH, like the sibling estate tests; no network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

class StubGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  ago() { return 'just now'; }
  async repos() { return []; }
  async ls() { return []; }
  async get() { throw Object.assign(new Error('404'), { status: 404 }); }
  async req() { return { default_branch: 'main' }; }
  async save() { return {}; }
}

const { window } = makeWindow({
  html: `<!doctype html><html><body><div id="es" x-data="estate()"></div></body></html>`,
});
window.TOKEN = 'tkn';
window.GH = StubGH;
window.gh = { load: async () => {} };
// The two hand-offs the boxes make. Recorded rather than executed: what is
// under test is that each names the right lane, not what the Files view then
// does with it.
const SEARCHES = [];
window.__shell = {
  REGISTRY_REPO: 'me/registry', DEFAULT_REPO: 'me/tools', CHATS_REPO: 'me/chats',
  quickLinks: [], hasToken: () => true, _authState: 'auth',
  goSearch: (opts) => SEARCHES.push(opts),
};

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/closing-state.js',
  'lib/kits/repo-sessions-cache.js',
  'lib/kits/chat-archive.js',
  'lib/kits/branch-status.js',
  'lib/kits/surface.js',
  'lib/alpineComponents/estate.js',
]);
const data = Alpine.$data(window.document.getElementById('es'));

const DAY = 864e5;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();

// A cache row in the shape the sessions fold writes. `started`/`ended` drive
// the time scopes, so every fixture states its own age.
const row = (id, extra = {}) => ({
  id, day: iso(extra.age ?? 0).slice(0, 10),
  started: iso(extra.age ?? 0), ended: iso(extra.age ?? 0),
  mins: 10, exchanges: 1, calls: 1, failures: 0, tools: [], files: [],
  repos: [], branches: [], attached: [], ...extra,
});

const ROWS = [
  row('aaaaaaaa', {
    title: 'Session search for the estate',
    ask: 'Add a text box to the Sessions pane.',
    repos: [{ name: 'web-tools', branch: 'claude/session-search-1a2b3c', lines: 40 }],
    branches: ['claude/session-search-1a2b3c'],
    files: [['web-tools/lib/kits/estate-search.js', 9]],
  }),
  row('bbbbbbbb', {
    age: 9,                               // outside Day and Week, inside Month
    title: 'Allotment packet by fund',
    ask: 'Walk the allotment schedule.',
    repos: [{ name: 'home', branch: 'claude/allotment-4d5e6f', lines: 12 }],
    branches: ['claude/allotment-4d5e6f'],
  }),
  row('cccccccc', {
    age: 40,                              // outside every time scope
    title: 'Session search, second pass',
    ask: 'Wire the same query into the table.',
    repos: [{ name: 'web-tools', branch: 'claude/session-search-7g8h9i', lines: 5 }],
    branches: ['claude/session-search-7g8h9i'],
  }),
];

function seedSessions() {
  data.sessionRows_ = ROWS;
  data.activity = {};
  data.sessionScope = 'all';
  data.sessionRepoFilter = '';
  data.sessionStateFilter = '';
  data.sessionQuery = '';
}

test('the box narrows the row set, over the fields the cache row carries', () => {
  seedSessions();
  assert.equal(data.queriedSessions.length, 3);
  // The title.
  data.sessionQuery = 'session search';
  assert.deepEqual([...data.queriedSessions.map(r => r.id)], ['aaaaaaaa', 'cccccccc']);
  // The opening ask.
  data.sessionQuery = 'allotment schedule';
  assert.deepEqual([...data.queriedSessions.map(r => r.id)], ['bbbbbbbb']);
  // A file the session opened, which is on the row and is not something the
  // session said.
  data.sessionQuery = 'estate-search.js';
  assert.deepEqual([...data.queriedSessions.map(r => r.id)], ['aaaaaaaa']);
  // A repo it stood in.
  data.sessionQuery = 'home';
  assert.deepEqual([...data.queriedSessions.map(r => r.id)], ['bbbbbbbb']);
});

test('the scope chips recount UNDER the query, so an empty scope says widen', () => {
  seedSessions();
  const count = (key) => data.sessionScopes.find(s => s.key === key).count;
  assert.equal(count('day'), 1);
  assert.equal(count('month'), 2);
  assert.equal(count('all'), 3);
  // Both "session search" rows are outside Week; one is inside Month's window
  // only by being today's. The chips are what tell the reader that.
  data.sessionQuery = 'session search';
  assert.equal(count('day'), 1);
  assert.equal(count('week'), 1);
  assert.equal(count('all'), 2, 'the second pass is 40 days old and still findable');
});

test('one query narrows both row lenses, which is why the table lost its own box', () => {
  seedSessions();
  data.sessionQuery = 'session search';
  data.sessionGrain = 'session';
  assert.deepEqual([...data.grainRows.map(r => r.id)], ['aaaaaaaa', 'cccccccc']);
  assert.deepEqual([...data.sessionNodes.map(n => n.id)], ['aaaaaaaa', 'cccccccc']);
  // The removed box is not merely hidden: nothing calls it any more.
  assert.equal(typeof data.applyTableQuery, 'undefined');
  assert.equal(typeof data.tableQuery, 'undefined');
});

test('a stub session stays findable by the branch name, which is all it has', () => {
  seedSessions();
  // A branch whose commit trailer names a session with no record in the cache.
  // The tree gives it a stub node; a filter that only read rows would drop it.
  data.activity = { 'acme/widget': { defaultBranch: 'main', scan: { branches: [
    { name: 'claude/wsl-fetch-cron-9j8h7g', group: 'active', date: iso(1),
      sessions: ['https://claude.ai/code/session_ZZZZZZZZZZZZ'] },
  ] } } };
  const stub = data.sessionTree.nodes.find(n => n.kind === 'stub');
  assert.ok(stub, 'the fixture should produce a stub');
  data.sessionQuery = 'wsl-fetch';
  assert.deepEqual([...data.sessionNodes.map(n => n.key)], [stub.key]);
  // And it is not matched by a word that appears nowhere on it.
  data.sessionQuery = 'allotment';
  assert.equal(data.sessionNodes.some(n => n.kind === 'stub'), false);
});

test('the exhaustive pass is a named hop, carrying the query as typed', () => {
  seedSessions();
  SEARCHES.length = 0;
  data.sessionQuery = '  merge guide  ';
  data.openSessionGrep();
  // Field by field: the object crosses the vm boundary, so it is structurally
  // equal to a literal here and never reference-equal to one.
  assert.equal(SEARCHES.length, 1);
  assert.equal(SEARCHES[0].q, 'merge guide', 'trimmed, so a stray space is not searched');
  assert.equal(SEARCHES[0].mode, 'sessions');
  // An empty box hands off nothing rather than opening the whole store.
  data.sessionQuery = '   ';
  data.openSessionGrep();
  assert.equal(SEARCHES.length, 1);
});

// ── The Chats pane ──────────────────────────────────────────────────────────

const CHAT_ROWS = [
  { url: 'https://claude.ai/chat/1', date: '2026-07-02', month: '2026-07', provider: 'claude',
    hand: true, title: 'Packing a bookmarklet with gzip',
    summary: 'A base64url envelope so the payload rides in the fragment.',
    tags: ['bookmarklets', 'compression'], open: 'https://claude.ai/chat/1' },
  { url: 'gemini-session/341', date: '2026-07-01', month: '2026-07', provider: 'gemini',
    hand: false, title: 'Allotment schedule walkthrough',
    summary: 'Worked through the allotment packet by fund.',
    tags: ['wa-budget'], open: '' },
];

function seedChats() {
  data.chatLoadedMonths = ['2026-07'];
  data.chatRowsByMonth = { '2026-07': CHAT_ROWS };
  data.chatProvider = ''; data.chatTag = ''; data.chatHandOnly = false; data.chatQuery = '';
}

test('the chats box matches title, tags and summary, and composes with the chips', () => {
  seedChats();
  assert.equal(data.visibleChatRows.length, 2);
  data.chatQuery = 'base64url';
  assert.deepEqual([...data.visibleChatRows.map(r => r.provider)], ['claude']);
  data.chatQuery = 'allotment';
  assert.deepEqual([...data.visibleChatRows.map(r => r.provider)], ['gemini']);
  data.chatQuery = 'wa-budget';
  assert.deepEqual([...data.visibleChatRows.map(r => r.provider)], ['gemini']);
  // The query narrows what the chips leave, rather than replacing them.
  data.chatQuery = 'allotment';
  data.chatHandOnly = true;
  assert.equal(data.visibleChatRows.length, 0);
});

test('the provider chips recount under the query, as the session chips do', () => {
  seedChats();
  const count = (key) => (data.chatProviders.find(p => p.key === key) || {}).count;
  assert.equal(data.queriedChatRows.length, 2);
  assert.equal(count('claude'), 1);
  assert.equal(count('gemini'), 1);
  data.chatQuery = 'allotment';
  assert.equal(data.queriedChatRows.length, 1);
  // Which provider holds the thing is the answer a chip row owes a query.
  assert.equal(count('claude'), undefined, 'a provider with nothing left drops its chip');
  assert.equal(count('gemini'), 1);
  assert.equal(data.chatHandCount, 0, 'and the hand chip counts what the query left too');
});

test('a query counts as a filter, so the clear control appears for it', () => {
  seedChats();
  assert.equal(data.chatFiltered, false);
  data.chatQuery = 'gzip';
  assert.equal(data.chatFiltered, true);
  data.chatQuery = '   ';
  assert.equal(data.chatFiltered, false, 'whitespace is not a filter');
});

test('the archive-wide search is a named hop to the Chats lane', () => {
  seedChats();
  SEARCHES.length = 0;
  data.chatQuery = 'gzip';
  data.openChatSearch();
  assert.equal(SEARCHES.length, 1);
  assert.equal(SEARCHES[0].q, 'gzip');
  assert.equal(SEARCHES[0].mode, 'chats');
});
