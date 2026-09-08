// The Sessions pane's Table lens: the grain control, the filters it inherits,
// and the one figure that can mislead.
//
// The lens exists because the pane had no sort at all: three chip rows over 344
// session records and 434 branch rows, which is a query problem rather than a
// scrolling one. What it adds that no chip row can is a GRAIN: sessions,
// branches, or one row per session-and-branch pair. The pair grain is the
// reading the other two cannot give and the one that misreports if it is not
// labelled, since a filtered pair count read as a session count is wrong by
// however many repos the sessions touched.
//
// So the assertions here are mostly about the joins between the controls: that
// the chips above the lens still narrow it, that switching grain does not throw
// away a column set, and that the count names the unit it counted.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const REGISTRY = 'me/registry';

class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  ago() { return 'recently'; }
  async repos() { return []; }
  async ls() { return []; }
  async get() { throw Object.assign(new Error('404'), { status: 404 }); }
  async req() { return {}; }
  async pulls() { return []; }
}

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="es" x-data="estate()"></div>
  </body></html>`,
});
window.TOKEN = 'tkn';
window.GH = FakeGH;
window.__shell = {
  REGISTRY_REPO: REGISTRY,
  DEFAULT_REPO: 'me/tools',
  quickLinks: [],
  hasToken: () => true,
  _authState: 'auth',
  refreshConfigCache() {},
  refreshActivity() {},
};

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/surface.js',
  // The list pane renders these fixture rows too, and it reaches BranchStatus
  // for each row's lifespan. Without it the mount logs an expression error that
  // has nothing to do with the lens under test.
  'lib/kits/branch-status.js',
  'lib/kits/closing-state.js',
  'lib/alpineComponents/estate.js',
]);

const data = Alpine.$data(window.document.getElementById('es'));

// Two sessions, one of them across two repos, so the pair grain is genuinely
// wider than the session grain and the count has something to get wrong.
const NOW = Date.now();
const iso = (daysAgo) => new Date(NOW - daysAgo * 864e5).toISOString();

const SESSIONS = [
  { id: 'aaa11111', day: iso(1).slice(0, 10), started: iso(1), ended: iso(1),
    mins: 42, state: 'merged', ask: 'teach the deck to swipe', calls: 90, failures: 0,
    filesTotal: 12, exchanges: 8,
    repos: [{ name: 'web-tools', branch: 'claude/deck-swipe', lines: 154 },
            { name: 'home', branch: 'claude/deck-swipe', lines: 20 }],
    branches: ['claude/deck-swipe'] },
  { id: 'bbb22222', day: iso(2).slice(0, 10), started: iso(2), ended: iso(2),
    mins: 9, state: 'clean', ask: 'read the pdf lattice', calls: 12, failures: 3,
    filesTotal: 2, exchanges: 2,
    repos: [{ name: 'home', branch: 'claude/pdf-lattice', lines: 8 }],
    branches: ['claude/pdf-lattice'] },
];

// The branch side, keyed the way buildBranchRows keys it. Only one of the three
// pairs above has a branch row, which is the case the edge grain has to keep
// rather than drop: a record is evidence the work happened, and a crawl that
// has not reached the branch is not evidence that it did not.
data.sessionRows_ = SESSIONS;
data.activity = {
  'me/web-tools': {
    defaultBranch: 'main', openPRs: [], branchPRs: [],
    scan: { branches: [
      { name: 'claude/deck-swipe', sha: 'abc1234', group: 'landed', date: iso(0.5),
        subject: 'teach the deck to swipe', aheadBy: 3, firstDate: iso(4),
        nUnique: 5, nLanded: 5, nMissing: 0, nDiffers: 0, sessions: [] },
    ] },
  },
};
data._activityRev = 1;
data.sessionScope = 'all';

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

test('the session grain is the list\'s own filtered set, so the chips keep meaning what they mean', () => {
  data.sessionGrain = 'session';
  assert.equal(data.grainRows.length, 2);
  data.sessionRepoFilter = 'web-tools';
  assert.equal(data.grainRows.length, 1);
  assert.equal(data.grainRows[0].id, 'aaa11111');
  data.sessionRepoFilter = '';
});

test('the pair grain fans a session out per repo-branch, and keeps a pair whose branch the crawl never reached', () => {
  data.sessionGrain = 'edge';
  const rows = data.grainRows;
  assert.equal(rows.length, 3, 'two repos on one session plus one on the other');
  const landed = rows.find(r => r.repo === 'web-tools');
  assert.equal(landed.group, 'landed', 'joined to the branch row where there is one');
  const unreached = rows.find(r => r.branch === 'claude/pdf-lattice');
  assert.equal(unreached.group, '', 'kept, with nothing claimed about it');
  assert.equal(unreached.branchRow, null);
});

test('the count names its unit, because a pair count read as a session count is wrong', () => {
  data.sessionGrain = 'session';
  data.tableQuery = '';
  assert.equal(data.tableCount, '2 sessions');
  data.sessionGrain = 'edge';
  assert.equal(data.tableCount, '3 pairs');
  data.tableQuery = 'pdf';
  assert.equal(data.tableCount, '1 of 3 pairs');
  data.tableQuery = '';
  // Every unit's plural is declared, because unit + 's' shipped "149 branchs".
  data.sessionGrain = 'branch';
  assert.equal(data.tableCount, '1 branch');
  assert.match(data.GRAINS.map(g => g.units).join(' '), /branches/);
  data.sessionGrain = 'session';
});

test('the repo chip narrows every grain, not only the one it was built for', () => {
  data.sessionRepoFilter = 'home';
  data.sessionGrain = 'edge';
  assert.equal(data.grainRows.length, 2, 'both sessions touched home');
  data.sessionGrain = 'session';
  assert.equal(data.grainRows.length, 2);
  data.sessionRepoFilter = '';
});

test('the query runs over the shown columns only, so a hit is always visible', () => {
  data.sessionGrain = 'session';
  data.tableCols_ = null;
  // `ask` is off by default, so its text does not match until it is turned on.
  data.tableQuery = 'lattice';
  assert.equal(data.tableRows.length, 0);
  data.toggleCol('ask');
  assert.equal(data.tableRows.length, 1);
  assert.equal(data.tableRows[0].id, 'bbb22222');
  data.tableQuery = '';
});

test('a column set survives a trip through another grain', () => {
  data.tableCols_ = null;
  data.sessionGrain = 'session';
  data.toggleCol('calls');
  assert.ok(data.tableCols.includes('calls'));
  data.sessionGrain = 'branch';
  data.sessionGrain = 'session';
  assert.ok(data.tableCols.includes('calls'), 'remembered per grain, not reseeded');
});

test('the last column cannot be turned off', () => {
  data.tableCols_ = null;
  data.sessionGrain = 'session';
  for (const c of [...data.tableCols]) data.toggleCol(c);
  assert.equal(data.tableCols.length, 1, 'a table with no columns has no way back');
});

test('sorting opens a number on its big end and a name on A, and reverses on a second tap', () => {
  data.tableCols_ = null;
  data.sessionGrain = 'session';
  const mins = data.tableColumns.find(c => c.key === 'mins');
  data.sortBy(mins);
  assert.equal(data.tableSort.dir, -1);
  assert.equal(data.tableRows[0].mins, 42);
  data.sortBy(mins);
  assert.equal(data.tableRows[0].mins, 9);

  const id = data.tableColumns.find(c => c.key === 'id');
  data.sortBy(id);
  assert.equal(data.tableSort.dir, 1);
  assert.equal(data.tableRows[0].id, 'aaa11111');
});

test('the branch grain answers the scope off the branch\'s own clock, and Failed is not a window it can answer', () => {
  data.sessionGrain = 'branch';
  data.sessionScope = 'day';
  assert.equal(data.grainRows.length, 1, 'the branch committed yesterday');
  data.sessionScope = 'failed';
  assert.equal(data.grainRows.length, 1, 'shown rather than emptied under a scope about sessions');
  data.sessionScope = 'all';
});
