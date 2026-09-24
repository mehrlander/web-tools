// alpineComponents/estate.js — the Activity query, one box above the pane
// pills, as each pane applies it.
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
//   - the Chats box narrows the LOADED months and does not reach for shards;
//   - since 2026-09-24 the box is ONE, shared by Sessions, Branches, Writes and
//     Chats: it narrows inside the lit scope and never moves it, each pill
//     counts its pane's matches, and Branches and Writes match on their own
//     fields.
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
  data.activityQuery = '';
  data.sessionRows_ = ROWS;
  data.activity = {};
  data.sessionScope = 'all';
  data.branchScope = 'active';
  data.sessionRepoFilter = '';
  data.sessionStateFilter = '';
}

test('the box narrows the row set, over the fields the cache row carries', () => {
  seedSessions();
  assert.equal(data.queriedSessions.length, 3);
  // The title.
  data.activityQuery = 'session search';
  assert.deepEqual([...data.queriedSessions.map(r => r.id)], ['aaaaaaaa', 'cccccccc']);
  // The opening ask.
  data.activityQuery = 'allotment schedule';
  assert.deepEqual([...data.queriedSessions.map(r => r.id)], ['bbbbbbbb']);
  // A file the session opened, which is on the row and is not something the
  // session said.
  data.activityQuery = 'estate-search.js';
  assert.deepEqual([...data.queriedSessions.map(r => r.id)], ['aaaaaaaa']);
  // A repo it stood in.
  data.activityQuery = 'home';
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
  data.activityQuery = 'session search';
  assert.equal(count('day'), 1);
  assert.equal(count('week'), 1);
  assert.equal(count('all'), 2, 'the second pass is 40 days old and still findable');
});

test('one query narrows both row lenses, which is why the table lost its own box', () => {
  seedSessions();
  data.activityQuery = 'session search';
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
  data.activityQuery = 'wsl-fetch';
  assert.deepEqual([...data.sessionNodes.map(n => n.key)], [stub.key]);
  // And it is not matched by a word that appears nowhere on it.
  data.activityQuery = 'allotment';
  assert.equal(data.sessionNodes.some(n => n.kind === 'stub'), false);
});

test('an attached file is on the row as a count and a name, not as a path', () => {
  seedSessions();
  const UP = '/root/.claude/uploads/dddd4444-1111-2222-3333-444455556666/';
  const C = window.RepoSessionsCache;
  const row = C.summarize({
    short: 'dddd4444', day: '2026-09-10',
    opening_ask: `@"${UP}22288270-COREPAM_Decision_Package.docx" `
               + `@"${UP}eb36c7f0-IT_Fiscal_Workbook__CORE_PAM.xlsx" `
               + 'Please review the attached documents with the submittal view.',
  }, 'sha');
  data.sessionRows_ = [{ ...ROWS[0], ...row, started: iso(0), ended: iso(0) }];

  // The label is what the tooltip carries, since the names are the whole of
  // what is worth knowing and the row has no card for them.
  assert.equal(data.attachLabel(data.sessionRows_[0]),
    '2 files were attached to the opening ask: '
    + 'COREPAM_Decision_Package.docx, IT_Fiscal_Workbook__CORE_PAM.xlsx');
  assert.equal(data.attachLabel({}), '', 'no attachments, no tooltip');
  assert.match(data.attachLabel({ attachments: ['one.docx'] }), /^One file was/);

  // And the ask the row draws is the question, which is the point of the lift.
  assert.match(data.sessionAsk(data.sessionRows_[0]), /^Please review the attached documents/);

  // The box finds it by filename and by the question; the UUID is gone.
  data.activityQuery = 'COREPAM_Decision_Package';
  assert.deepEqual([...data.queriedSessions.map(r => r.id)], ['dddd4444']);
  data.activityQuery = 'submittal view';
  assert.deepEqual([...data.queriedSessions.map(r => r.id)], ['dddd4444']);
  data.activityQuery = '444455556666';
  assert.equal(data.queriedSessions.length, 0);
});

test('the count says what the query left and what it searched', () => {
  seedSessions();
  // Blank with no query: a count against no filter is furniture.
  assert.equal(data.sessionQueryCount, '');
  data.activityQuery = 'session search';
  // The denominator is the WHOLE store, not the open scope, which is the half
  // of the question the chip row alone did not answer.
  data.sessionScope = 'day';
  assert.equal(data.sessionQueryCount, '2 of 3');
  data.sessionScope = 'all';
  assert.equal(data.sessionQueryCount, '2 of 3');
  data.activityQuery = '   ';
  assert.equal(data.sessionQueryCount, '');
});

test('the exhaustive pass is a named hop, carrying the query as typed', () => {
  seedSessions();
  SEARCHES.length = 0;
  data.activityQuery = '  merge guide  ';
  data.openSessionGrep();
  // Field by field: the object crosses the vm boundary, so it is structurally
  // equal to a literal here and never reference-equal to one.
  assert.equal(SEARCHES.length, 1);
  assert.equal(SEARCHES[0].q, 'merge guide', 'trimmed, so a stray space is not searched');
  assert.equal(SEARCHES[0].mode, 'sessions');
  // An empty box hands off nothing rather than opening the whole store.
  data.activityQuery = '   ';
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
  data.chatProvider = ''; data.chatTag = ''; data.chatHandOnly = false; data.activityQuery = '';
}

test('the chats box matches title, tags and summary, and composes with the chips', () => {
  seedChats();
  assert.equal(data.visibleChatRows.length, 2);
  data.activityQuery = 'base64url';
  assert.deepEqual([...data.visibleChatRows.map(r => r.provider)], ['claude']);
  data.activityQuery = 'allotment';
  assert.deepEqual([...data.visibleChatRows.map(r => r.provider)], ['gemini']);
  data.activityQuery = 'wa-budget';
  assert.deepEqual([...data.visibleChatRows.map(r => r.provider)], ['gemini']);
  // The query narrows what the chips leave, rather than replacing them.
  data.activityQuery = 'allotment';
  data.chatHandOnly = true;
  assert.equal(data.visibleChatRows.length, 0);
});

test('the provider chips recount under the query, as the session chips do', () => {
  seedChats();
  const count = (key) => (data.chatProviders.find(p => p.key === key) || {}).count;
  assert.equal(data.queriedChatRows.length, 2);
  assert.equal(count('claude'), 1);
  assert.equal(count('gemini'), 1);
  data.activityQuery = 'allotment';
  assert.equal(data.queriedChatRows.length, 1);
  // Which provider holds the thing is the answer a chip row owes a query.
  assert.equal(count('claude'), undefined, 'a provider with nothing left drops its chip');
  assert.equal(count('gemini'), 1);
  assert.equal(data.chatHandCount, 0, 'and the hand chip counts what the query left too');
});

test('a query counts as a filter, so the clear control appears for it', () => {
  seedChats();
  assert.equal(data.chatFiltered, false);
  data.activityQuery = 'gzip';
  assert.equal(data.chatFiltered, true);
  // But "clear filters" clears the chips only: the query is every pane's.
  assert.equal(data.chatChipFiltered, false);
  data.activityQuery = '   ';
  assert.equal(data.chatFiltered, false, 'whitespace is not a filter');
});

test('the archive-wide search is a named hop to the Chats lane', () => {
  seedChats();
  SEARCHES.length = 0;
  data.activityQuery = 'gzip';
  data.openChatSearch();
  assert.equal(SEARCHES.length, 1);
  assert.equal(SEARCHES[0].q, 'gzip');
  assert.equal(SEARCHES[0].mode, 'chats');
});

// ── One query across the Activity view ──────────────────────────────────────

test('a query narrows inside the lit scope and never moves it', () => {
  seedSessions();
  data.sessionScope = 'day';
  data.activityQuery = 'session search';
  assert.equal(data.sessionScope, 'day');
  assert.equal(data.branchScope, 'active');
  assert.deepEqual([...data.sessionNodes.map(n => n.id)], ['aaaaaaaa']);
  // The chips say where the rest are, which is the reader's cue to widen.
  const count = (key) => data.sessionScopes.find(s => s.key === key).count;
  assert.equal(count('all'), 2);
  data.activityQuery = '';
  assert.equal(data.sessionScope, 'day');
});

const BRANCHES = { 'me/web-tools': { defaultBranch: 'main',
  openPRs: [{ number: 812, head: 'claude/laughing-planck-ipsl5h', title: 'One Activity query', updatedAt: iso(0) }],
  scan: { branches: [
    { name: 'claude/laughing-planck-ipsl5h', group: 'active', date: iso(0), subject: 'estate: shared box' },
    { name: 'claude/old-thing-aa11bb', group: 'landed', date: iso(60), subject: 'docs: a landed change' },
  ] } } };

test('the Branches pane matches name, subject and PR, and its chips recount', () => {
  seedSessions();
  data.activity = BRANCHES;
  const count = (key) => data.branchScopes.find(s => s.key === key).count;
  assert.equal(data.queriedBranchRows.length, 2);
  data.activityQuery = 'laughing-planck';
  assert.deepEqual([...data.openBranches.map(r => r.name)], ['claude/laughing-planck-ipsl5h']);
  assert.equal(count('landed'), 0);
  data.activityQuery = '#812';
  assert.equal(data.queriedBranchRows.length, 1, 'the PR number');
  data.activityQuery = 'activity query';
  assert.equal(data.queriedBranchRows.length, 1, 'the PR title, AND across terms');
  data.activityQuery = 'landed change';
  assert.equal(count('landed'), 1, 'the tip subject, at any age');
});

test('the Writes pane matches the commit line, repo and kind', () => {
  seedSessions();
  window.WriteKinds = { classify: (c) => ({ key: /^docs/.test(c.msg) ? 'docs' : 'dev', label: /^docs/.test(c.msg) ? 'Docs' : 'Dev' }),
                        tally: (rows) => rows.reduce((t, r) => (t[r.kind.key] = (t[r.kind.key] || 0) + 1, t), {}),
                        KINDS: [{ key: 'dev' }, { key: 'docs' }] };
  data.activity = { 'me/web-tools': { recentCommits: [
    { sha: 'abc1234', msg: 'estate: one Activity query\n\nBody', date: iso(0) },
    { sha: 'def5678', msg: 'docs: refresh the map', date: iso(1) },
  ] } };
  data.writeKind = '';
  assert.equal(data.queriedWriteRows.length, 2);
  data.activityQuery = 'activity query';
  assert.deepEqual([...data.writeList.map(r => r.sha)], ['abc1234']);
  data.activityQuery = 'docs';
  assert.deepEqual([...data.writeList.map(r => r.sha)], ['def5678']);
  assert.equal(data.writeKindsWithCount.find(k => k.key === 'dev').count, undefined,
    'the kind chips recount under the query');
  data.activityQuery = 'def5678';
  assert.equal(data.queriedWriteRows.length, 1, 'the SHA');
  delete window.WriteKinds;
});

test('each pill counts its own pane, and no query means no counts', () => {
  seedSessions();
  seedChats();
  data.activity = BRANCHES;
  assert.equal(data.activityCounts, null);
  data.activityQuery = 'allotment';
  const c = data.activityCounts;
  assert.equal(c.sessions, 1);
  assert.equal(c.branches, 0);
  assert.equal(c.chats, 1);
  data.activityQuery = 'laughing-planck';
  assert.equal(data.activityCounts.branches, 1);
  assert.equal(data.activityCounts.sessions, 0);
});

test('the long lists draw a page at a time, and a new question starts at the top', async () => {
  seedSessions();
  const many = Array.from({ length: 130 }, (_, i) => row('p' + String(i).padStart(7, '0'), { age: 0, title: 'Paged row ' + i }));
  data.sessionRows_ = many;
  assert.equal(data.sessionNodes.length, 130);
  assert.equal(data.sessionNodesShown.length, data.LIST_PAGE);
  data.sessionShowN += data.LIST_PAGE;
  assert.equal(data.sessionNodesShown.length, 120);
  data.activityQuery = 'paged row';
  await new Promise(r => setTimeout(r, 0));
  assert.equal(data.sessionShowN, data.LIST_PAGE, 'the query reset the page');
  assert.equal(data.sessionNodes.length, 130, 'counts and rails still read the whole list');
  data.activityQuery = '';
  await new Promise(r => setTimeout(r, 0));
});

test('the memoised lists still move when their inputs do', () => {
  seedSessions();
  const a = data.sessionNodes;
  assert.equal(data.sessionNodes, a, 'a second read is the same array');
  data.activityQuery = 'allotment';
  assert.deepEqual([...data.sessionNodes.map(n => n.id)], ['bbbbbbbb']);
  data.activityQuery = '';
  data.sessionRows_ = [...ROWS.slice(0, 1)];
  assert.equal(data.sessionTree.nodes.length, 1, 'new rows rebuild the tree');
  assert.deepEqual([...data.sessionNodes.map(n => n.id)], ['aaaaaaaa']);
});
