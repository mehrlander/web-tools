// The Sessions pane's Table lens: the grain control, what each grain counts,
// and the columns the reader can reach.
//
// The lens exists because the pane had no sort at all: three chip rows over 344
// session records and 434 branch rows, which is a query problem rather than a
// scrolling one. What it adds that no chip row can is a GRAIN: sessions,
// branches, or one row per session-and-branch pair. The pair grain is the
// reading the other two cannot give and the one that misreports if it is not
// labelled, since a filtered pair count read as a session count is wrong by
// however many repos the sessions touched.
//
// TABULATOR DRAWS IT, so the sorting, the per-column filters and the row
// virtualisation are the library's and are not re-tested here. What is tested
// is the half that is this repo's: the fold from cache rows to flat table rows,
// which grain each column set belongs to, the column store, and the counting.
// A browser is out of reach in this suite (node --test over jsdom, no layout),
// so mountTable is deliberately not exercised.
//
// SCOPE IS THE ONLY CHIP THE TABLE OBEYS. Repo and state moved into columns
// when the lens moved to Tabulator, and their chip rows are hidden under it, so
// a grain reading them anyway would be a filter with no control on screen.

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
  // The address half, as app/index.html implements it: the shell holds the
  // lens and the grain because the URL is the shell's to own.
  sessionLens: '',
  sessionGrain: '',
  goSessionLens(lens, grain){
    if (lens !== undefined) this.sessionLens = lens || '';
    if (grain !== undefined) this.sessionGrain = grain || '';
  },
};

const Alpine = await startAlpine(window, [
  // First in the app's own boot chain, and the formatters below reach it for
  // every value they place into markup: window.esc is the repo's one escape.
  'lib/vanilla-bundle.js',
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
// Named so a test that swaps in its own can restore it afterwards.
const ACTIVITY = {
  'me/web-tools': {
    defaultBranch: 'main', openPRs: [], branchPRs: [],
    scan: { branches: [
      { name: 'claude/deck-swipe', sha: 'abc1234', group: 'landed', date: iso(0.5),
        subject: 'teach the deck to swipe', aheadBy: 3, firstDate: iso(4),
        nUnique: 5, nLanded: 5, nMissing: 0, nDiffers: 0, sessions: [] },
    ] },
  },
};
data.activity = ACTIVITY;
const ENTRIES = [];
data.entries = ENTRIES;
data._activityRev = 1;
data.sessionScope = 'all';

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

test('the session grain folds one flat row per record, scope-filtered only', () => {
  data.sessionGrain = 'session';
  data.sessionScope = 'all';
  assert.equal(data.grainRows.length, 2);
  const first = data.grainRows.find(r => r.id === 'aaa11111');
  // Flat and scalar: Tabulator sorts, filters and formats one object per row,
  // so the join to a space-joined string happens here rather than per column.
  assert.equal(first.repos, 'web-tools home');
  assert.equal(first.lines, 174);
  assert.equal(first.state, 'merged');
  assert.ok(first._row, 'the original rides through for the deck the row opens');

  // The repo chip is hidden under this lens, so setting it must not narrow.
  data.sessionRepoFilter = 'web-tools';
  assert.equal(data.grainRows.length, 2, 'a hidden chip is not a filter');
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
  assert.equal(unreached._branch, null);
});

test('the count names its unit, because a pair count read as a session count is wrong', () => {
  data.sessionGrain = 'session';
  assert.equal(data.tableCount, '2 sessions');
  data.sessionGrain = 'edge';
  assert.equal(data.tableCount, '3 pairs');
  // Every unit's plural is declared, because unit + 's' shipped "149 branchs".
  data.sessionGrain = 'branch';
  assert.equal(data.tableCount, '1 branch');
  assert.match(data.GRAINS.map(g => g.units).join(' '), /branches/);
  data.sessionGrain = 'session';
});

test('every column carries a filter, which is the reason this lens is a library', () => {
  for (const g of ['session', 'branch', 'edge']) {
    data.sessionGrain = g;
    for (const c of data.tableColumns)
      assert.ok(c.headerFilter, g + ': ' + c.field + ' has no header filter');
  }
  data.sessionGrain = 'session';
  // A count filters as a THRESHOLD: "failures over ten" is the question, and an
  // exact match would answer a different one.
  const failed = data.tableColumns.find(c => c.field === 'failures');
  assert.equal(failed.headerFilter, 'number');
  assert.equal(failed.headerFilterFunc, '>=');
  // A closed domain gets a select rather than free text.
  assert.equal(data.tableColumns.find(c => c.field === 'state').headerFilter, 'list');
});

test('a width set beside the shared number preset survives it', () => {
  data.sessionGrain = 'session';
  // The preset carries its own width, so spreading it AFTER an explicit one
  // silently replaced it and a column rendered at the preset's 92 instead. The
  // widths are smaller now that the bars are gone, so what this holds is the
  // ORDER: an explicit width must outlive the spread, whatever it is.
  // No literal: the figure moved twice already (92, then 84, then 72 as the
  // columns tightened for a phone), and each move broke this line while the
  // invariant it names held throughout.
  const mins = data.tableColumns.find(c => c.field === 'mins');
  assert.ok(mins.width, 'Ran sets its own width');
  assert.notEqual(mins.width, data.NUM_FILTER.width, 'the preset width did not win');
  // A column that wants the preset's width simply omits its own.
  assert.equal(data.tableColumns.find(c => c.field === 'calls').width, data.NUM_FILTER.width);
});

test('a duration reads at one unit, the way a file size does', () => {
  // The unit carries the order of magnitude, which is what retired the bar: a
  // logarithmic bar drew the median and the ninetieth percentile at nearly the
  // same length, and "52m" against "25d" separates them at a glance.
  assert.equal(data.durUnit(0), '0m');
  assert.equal(data.durUnit(13), '13m');
  assert.equal(data.durUnit(59), '59m');
  assert.equal(data.durUnit(60), '1.0h');
  // The real median across the store, 527 minutes.
  assert.equal(data.durUnit(527), '8.8h');
  // A decimal stops meaning anything once the number is big, so it goes.
  assert.equal(data.durUnit(660), '11h');
  assert.equal(data.durUnit(1439), '24h');
  assert.equal(data.durUnit(1440), '1.0d');
  assert.equal(data.durUnit(3744), '2.6d');
  // The longest span on file, a session left open for twenty-five days.
  assert.equal(data.durUnit(35826), '25d');
});

test('a count reads at a glance and still sorts on the number', () => {
  assert.equal(data.shortNum(0), '0');
  assert.equal(data.shortNum(999), '999');
  assert.equal(data.shortNum(1979), '2.0k');
  assert.equal(data.shortNum(44158362), '44M');
});

test('a column set survives a trip through another grain', () => {
  data.tableCols_ = null;
  data.sessionGrain = 'session';
  data.toggleCol('files');
  assert.ok(data.tableCols.includes('files'), 'files is off by default, so a toggle turns it on');
  data.sessionGrain = 'branch';
  data.sessionGrain = 'session';
  assert.ok(data.tableCols.includes('files'), 'remembered per grain, not reseeded');
});

test('the lens and the grain are addressable, and their defaults stay out of the address', () => {
  // The render link for this pane opened it on the List lens twice while the
  // table was the thing under review, so the reply had to end "now tap Table".
  // Setting the lens must move the shell's copy, which is what the URL is
  // stamped from; setting only the component's own leaves it unlinkable while
  // looking, from inside the pane, as though it worked.
  const shell = window.__shell;
  data.setLens('table');
  assert.equal(data.sessionLens, 'table');
  assert.equal(shell.sessionLens, 'table');
  data.setGrain('edge');
  assert.equal(data.sessionGrain, 'edge');
  assert.equal(shell.sessionGrain, 'edge');
  // A grain change must not disturb the lens, and the reverse.
  assert.equal(shell.sessionLens, 'table');
  data.setLens('list');
  assert.equal(shell.sessionGrain, 'edge');
  data.setLens('table');
  data.setGrain('session');
});

// ── The two ends of the late-rows fault ─────────────────────────────────────
// The pane opened reading `0 of 40 sessions` under the empty-state line while
// the scope chips beside it counted 40, and filled only when the reader
// switched grain and switched back. The mount effect tracks the lens, the grain
// and the scope; mountTable runs inside $nextTick, so nothing it reads is a
// dependency and the rows are not one. In the app the address supplies the lens
// at boot and the caches land a fetch later, so the first mount is regularly
// against an empty list. Two things have to hold, and they fail independently.
test('rows landing after the mount reach a built table, and not by rebuilding it', () => {
  data.sessionGrain = 'session';
  data.sessionScope = 'all';
  const fed = [];
  // Tabulator itself is out of reach here (no layout in jsdom), and the half
  // under test is not Tabulator's: it is which call this repo makes. replaceData
  // keeps the sort, the header filters and the scroll position; setData and a
  // rebuild do not, so a crawl finishing mid-read would throw the reader back to
  // the top of an unfiltered table.
  data.tabulator = {
    replaceData(rows){ fed.push(rows); return Promise.resolve(); },
    setData(){ throw new Error('setData discards the reader\'s filters'); },
    getDataCount(){ return fed.at(-1)?.length ?? 0; },
  };
  // Shut while a table builds, which a grain change makes it. Feeding the
  // outgoing table the incoming grain's rows paints a frame of blank cells
  // against columns those rows have no fields for.
  data._tableGrain = '';
  data.syncTableData();
  assert.equal(fed.length, 0, 'a shut gate feeds nothing');
  data._tableGrain = 'session';
  data.syncTableData();
  assert.equal(fed.length, 1, 'an open gate feeds');
  assert.equal(fed[0].length, data.grainRows.length,
    'the rows the component holds now, not the ones the table was built with');
  data.tabulator = null;
  data._tableGrain = '';
});

test('the table host carries the data effect, which is what lets the mount effect stay narrow', () => {
  // The other end, and the one nothing else would notice. Deleting this
  // attribute leaves every assertion above passing and the pane empty on
  // arrival, because syncTableData would then have no caller.
  const host = window.document.querySelector('[x-ref="tableHost"]');
  assert.ok(host, 'the host is in the template');
  assert.equal(host.getAttribute('x-effect'), 'syncTableData()');
});

// ── The mobile pass: what a phone reads, and what it costs ─────────────────
test('the session id leaves the opening set and the name column carries it', () => {
  data.sessionGrain = 'session';
  const id = data.tableColumns.find(c => c.field === 'id');
  assert.equal(id.dflt, false, '118px to identify a row you identify by tapping it');
  assert.ok(id, 'still in the menu, which is also the only way back to filtering by id');
  // 9 of 344 records have neither a title nor a branch to derive one from, so
  // labelOf returns empty and those rows would otherwise show nothing at all
  // in either of the two columns that say which session this is.
  const name = data.tableColumns.find(c => c.field === 'title');
  const cell = (title, rowId) => name.formatter({
    getValue: () => title, getRow: () => ({ getData: () => ({ id: rowId }) }) });
  assert.match(cell('deck-swipe', 'aaa11111'), /deck-swipe/);
  assert.ok(!cell('deck-swipe', 'aaa11111').includes('aaa11111'), 'a named row shows its name only');
  assert.match(cell('', 'aaa11111'), /aaa11111/, 'a nameless row falls back to its id');
  assert.match(cell('', 'aaa11111'), /font-mono/, 'drawn as an identifier, not as a name');
});

test('a repo is a glyph it declares, and the tap that names it is not a navigation', () => {
  // Measured against the cache before this was built: 709 of 713 repo-mentions
  // across 344 records resolve to a declared icon. The column is only compact
  // because the mark is the repo's own.
  data.entries = [{ repo: 'me/web-tools', icon: 'ph-toolbox' },
                  { repo: 'me/home', icon: 'ph-house' }];
  assert.equal(data.repoIcon('me/home'), 'ph-house', 'the full name the estate holds');
  assert.equal(data.repoIcon('home'), 'ph-house', 'and the short name a table row holds');
  assert.equal(data.repoIcon('nowhere'), 'ph-bookmark-simple', 'a repo declaring none');

  const cell = data.repoIconCell('web-tools home');
  assert.match(cell, /ph-toolbox/);
  assert.match(cell, /ph-house/);
  // Every glyph carries the name, because an icon column on a phone is only
  // honest if the name is one tap away: note.js opens on pointerdown, and
  // mountTable's rowClick skips a tap landing on [data-note] for this reason.
  // The note carries the state too, so this matches the identity half only:
  // what must hold is that every glyph names its repo on tap.
  assert.match(cell, /data-note="web-tools —/);
  assert.match(cell, /data-note="home —/);
  assert.equal(data.repoIconCell(''), '<span class="text-base-content/30">–</span>');
});

test('past four repos the overflow is counted, not clipped', () => {
  // The 95th percentile is 4 repos and the maximum is 7. Sizing for 7 spends
  // 60px of every row on 3% of them; clipping silently would make the cell lie
  // about what a session touched.
  const cell = data.repoIconCell('a b c d e f');
  assert.equal((cell.match(/<i /g) || []).length, 4, 'four glyphs drawn');
  assert.match(cell, />\+2</, 'and the rest counted');
  assert.match(cell, /data-note="e, f"/, 'the counter names who it stands for');
  assert.ok(!data.repoIconCell('a b c d').includes('+'), 'exactly four needs no counter');
});

test('duration magnitude is quantized to five bands, and the bands are the distribution\'s', () => {
  // A continuous bar was removed from this column once already: 74% of 344
  // records fall in the single decade from one hour to one day, so a linear
  // bar drew that 74% as a hairline and a logarithmic one drew the median
  // (527m) and the ninetieth percentile (2532m) at nearly the same length.
  // SEPARATING THOSE TWO IS THE REASON THE BAR IS BACK, so it is the thing
  // asserted rather than any particular edge: on durUnit's own boundaries they
  // came out adjacent, and the 12h edge is what moved them apart.
  assert.ok(data.durBand(2532) - data.durBand(527) >= 2,
    'the median and the ninetieth percentile are at least two steps apart');
  // Every edge lands in the band above it, and nothing falls off either end.
  const top = data.DUR_BANDS.length + 1;
  assert.equal(data.durBand(0), 1);
  assert.equal(data.durBand(59), 1);
  assert.equal(data.durBand(60), 2);
  assert.equal(data.durBand(data.DUR_BANDS.at(-1)), top);
  assert.equal(data.durBand(35826), top, 'the longest record in the cache still draws a full bar');
  // The bands are durUnit's own boundaries, so the bar and the unit can never
  // disagree about which end of the column a row belongs at: nothing reading
  // minutes may outrank something reading days.
  const mBand = Math.max(...[0, 30, 59].map(v => data.durBand(v)));
  const dBand = Math.min(...[1440, 4320, 35826].map(v => data.durBand(v)));
  assert.ok(mBand < dBand, 'a row in minutes never outranks a row in days');
  // The fill is behind the number, not instead of it: the bar compares, the
  // number states.
  const cell = data.durCell(527);
  assert.match(cell, /8\.8h/, 'the exact reading survives');
  assert.match(cell, /width:50%/, 'band 3 of 6');
  assert.match(data.durCell(35826), /width:100%/, 'the top band fills');
  assert.ok(!cell.includes('bg-primary'), 'neutral, since the accent means "control" everywhere else here');
});

test('a repo glyph takes its state from branchState, and absence is never a confident answer', () => {
  data.sessionGrain = 'session';
  data.entries = [{ repo: 'me/web-tools', icon: 'ph-toolbox' }];
  // THE PR INDEX IS CAPPED OR IT IS NOT, and that is the whole distinction the
  // colour rests on. prReach '' means every PR the repo has is in hand, so an
  // unmatched head is a real "no pull request ever". A non-empty prReach is a
  // horizon: newer than it, absence still answers; older, it cannot.
  data.activity = { 'me/web-tools': { defaultBranch: 'main', prReach: '',
    openPRs: [{ head: 'claude/live', draft: false }],
    branchPRs: [{ head: 'claude/done', state: 'merged' },
                { head: 'claude/gone', state: 'closed' }] } };
  const st = (b, at) => data.repoEntryState('web-tools', b, at || '2026-09-01T00:00:00Z');
  assert.equal(st('claude/done'), 'merged');
  assert.equal(st('claude/gone'), 'closed');
  assert.equal(st('claude/live'), 'ready');
  assert.equal(st('claude/never'), 'nopr', 'uncapped index: absence is an answer');
  // Work committed to the default branch has landed by definition and will
  // never have a PR, which branchState alone would read as `nopr`.
  assert.equal(st('main'), 'onmain');

  data.activity['me/web-tools'].prReach = '2026-08-20T00:00:00Z';
  assert.equal(st('claude/never', '2026-09-01T00:00:00Z'), 'nopr', 'newer than the horizon');
  assert.equal(st('claude/never', '2026-08-01T00:00:00Z'), 'unknown', 'older than it, and it says so');
  assert.equal(data.repoEntryState('not-crawled', 'claude/x', '2026-09-01T00:00:00Z'), 'unknown');
  assert.equal(st(''), 'unknown', 'a repo entry with no branch claims nothing');
  // Put the shared fixture back: the branch-grain tests below read data.activity
  // and data.entries, and a test that leaves its own scratch behind fails the
  // next one for a reason that has nothing to do with either.
  data.entries = ENTRIES; data.activity = ACTIVITY; data._activityRev++;
});

test('every glyph state paints, and the two recessive ones stay apart', () => {
  // /45 and /25 shipped here first and compiled to NOTHING: daisyUI's theme
  // opacities run 10..90 by tens, so both fell back to full strength and the
  // two states meant to recede came out the darkest in the column, identical
  // to each other. A class list looks right when this is broken; only the
  // ramp catches it.
  const RAMP = new Set([10,20,30,40,50,60,70,80,90]);
  for (const [state, cls] of Object.entries(data.REPO_STATE_CLASS)) {
    const m = /\/(\d+)$/.exec(cls);
    if (m) assert.ok(RAMP.has(+m[1]), state + ' uses ' + cls + ', which is off the shipped ramp');
    assert.ok(data.REPO_STATE_NOTE[state], state + ' says what it means on tap');
  }
  assert.notEqual(data.REPO_STATE_CLASS.nopr, data.REPO_STATE_CLASS.unknown,
    'the index looked and found nothing is not the same claim as it cannot see that far');
  assert.equal(data.REPO_STATE_CLASS.merged, data.REPO_STATE_CLASS.onmain,
    'both are landed work, and the column is about what landed');
});

test('Last reads m/dd, and typing what you see still filters', () => {
  data.sessionGrain = 'session';
  assert.equal(data.shortDate('2026-09-08T14:03:00Z'), '9/08');
  assert.equal(data.shortDate('2026-12-01'), '12/01');
  assert.equal(data.shortDate(''), '');
  assert.equal(data.shortDate('not a date'), '');
  // SLICED, NOT PARSED. new Date('2026-09-08') is UTC midnight, which formats
  // as the 7th anywhere west of Greenwich, so a reader in Seattle would have
  // seen every session end a day early.
  assert.equal(data.shortDate('2026-01-01'), '1/01', 'no timezone in the path at all');

  // The field holds the full ISO string and the screen shows only m/dd, so a
  // plain substring filter would silently fail on the one form now visible.
  const f = data.tableColumns.find(c => c.field === 'at').headerFilterFunc;
  assert.equal(f('9/08', '2026-09-08T14:03:00Z'), true, 'what the reader sees');
  assert.equal(f('2026-09', '2026-09-08T14:03:00Z'), true, 'and what the data holds');
  assert.equal(f('9/07', '2026-09-08T14:03:00Z'), false);
  assert.equal(f('', '2026-09-08T14:03:00Z'), true, 'an empty filter narrows nothing');
});

test('Repos is the second column in every grain that has one', () => {
  // What a row IS gets read left to right, and which repos a session touched
  // narrows it faster than its title: four glyphs against a sentence.
  for (const grain of ['session', 'edge']) {
    data.sessionGrain = grain;
    const on = data.tableColumns.filter(c => c.dflt).map(c => c.field);
    assert.equal(on[0], 'state', grain + ': state leads');
    assert.equal(on[1], grain === 'session' ? 'repos' : 'repo', grain + ': repos second');
    assert.ok(on.indexOf('title') > 1, grain + ': the name follows them');
  }
  data.sessionGrain = 'branch';
  assert.equal(data.tableColumns.filter(c => c.dflt)[0].field, 'repo',
    'the branch grain has no state column, so repo leads it');
  data.sessionGrain = 'session';
});

test('the last column cannot be turned off', () => {
  data.tableCols_ = null;
  data.sessionGrain = 'session';
  for (const f of [...data.tableCols]) data.toggleCol(f);
  assert.equal(data.tableCols.length, 1, 'a table with no columns has no way back');
});

test('the branch grain answers the scope off the branch\'s own clock, and Failed is not a window it can answer', () => {
  data.sessionGrain = 'branch';
  data.sessionScope = 'day';
  assert.equal(data.grainRows.length, 1, 'the branch committed yesterday');
  data.sessionScope = 'failed';
  assert.equal(data.grainRows.length, 1, 'shown rather than emptied under a scope about sessions');
  data.sessionScope = 'all';
});
