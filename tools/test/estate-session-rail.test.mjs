// alpineComponents/estate.js — the Activity list's per-session RAIL.
//
// The session card has drawn a rail for a while: one tick an exchange, placed
// by when it happened across that session's own span. This is the same reading
// with one variable changed. The span belongs to the LIST rather than to the
// row, so every rail shares a scale and two sessions can be compared, which is
// the one thing the card's rail cannot do.
//
// What is worth holding here is arithmetic and one refusal:
//   - the span is the scope chip's own window, ending now, so the rail and the
//     chip cannot disagree about what the reader is looking at;
//   - a beat outside that window is DROPPED, never clamped, because a clamped
//     tick stacks a long session's first day on the left edge and draws a burst
//     that never happened;
//   - the session's own extent is a segment on the shared hairline, so a row
//     that began before the window runs off the left edge instead of pretending
//     it started there.
//
// The second half of the file is the STRIP above the list: the same turns from
// every listed row folded onto one lane, which is what makes the top of the
// pane readable without scrolling it. It keeps the rows' span and the rows'
// drop rule, so a mark sits directly above the row marks it is made of, and it
// bins, so its node count is bounded by the strip's own resolution rather than
// by the store. A mark also knows whose turns it is, which is the fact the tap
// that jumps to a session is built on.
//
// No network and no pixels: the geometry is numbers, and `railNow` is pinned so
// "now" is a fixture rather than the clock. The strip's tests pin it to the
// live clock instead, for the reason stated where they start.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

class FakeGH {
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
window.GH = FakeGH;
window.gh = { load: async () => {} };
window.__shell = {
  REGISTRY_REPO: 'me/registry', DEFAULT_REPO: 'me/tools', quickLinks: [],
  hasToken: () => true, _authState: 'auth', view: 'sessions',
  refreshConfigCache() {}, refreshActivity() {}, refreshSessions() {},
  anchorMenu: () => ({}),
};

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/closing-state.js',
  'lib/kits/repo-sessions-cache.js',
  'lib/kits/surface.js',
  'lib/kits/branch-status.js',
  'lib/kits/prompt-link.js',
  'lib/alpineComponents/estate.js',
]);

const data = Alpine.$data(window.document.getElementById('es'));

// Noon UTC on a fixed day, so every window below is a round number of hours
// back from a stated instant and nothing here depends on when it is run.
const NOW = Date.parse('2026-09-13T12:00:00Z');
const HOUR = 3600e3;
const at = (hoursAgo) => new Date(NOW - hoursAgo * HOUR).toISOString();

// A row the way the cache leaves it: two ends and the minute offsets of its
// user turns. See repo-sessions-cache.js, beatsOf.
const row = (startedHoursAgo, endedHoursAgo, beats) => ({
  id: 'r' + startedHoursAgo,
  started: at(startedHoursAgo),
  ended: at(endedHoursAgo),
  ...(beats ? { beats } : {}),
});

// Everything read back through Alpine's $data is a reactive proxy: structurally
// equal to a literal and never reference-equal, so a bare deepEqual against []
// fails on the prototype. estate-session-scope.test.mjs keeps the same helper
// for the same reason.
const plain = (v) => JSON.parse(JSON.stringify(v));

// `left:X%;width:Y%` back to numbers, so an assertion can be about geometry
// rather than about string formatting.
function seg(style) {
  const m = /left:([-\d.]+)%;width:([-\d.]+)%/.exec(style || '');
  return m ? { left: +m[1], width: +m[2] } : null;
}
const near = (got, want, why, tol = 0.01) =>
  assert.ok(Math.abs(got - want) < tol, `${why}: got ${got}, want ${want}`);

function scope(key) {
  data.sessionScope = key;
  data.railNow = NOW;
}

test('the span is the scope chip own window, ending now', () => {
  for (const [key, days] of [['day', 1], ['week', 7], ['month', 30]]) {
    scope(key);
    const sp = data.sessionRailSpan;
    near(sp.ms / 864e5, days, `${key} spans ${days} day(s)`);
    assert.equal(sp.b, NOW, 'every span ends at now, so the rails stack');
  }
});

test('a turn lands where its clock puts it across the span', () => {
  scope('day');
  // Started 12 hours ago, so its 0th minute is the middle of a 24-hour rail.
  const ticks = data.sessionRailTicks(row(12, 2, [0, 180, 360]));
  near(ticks[0], 50, 'the opening turn sits at the halfway mark');
  near(ticks[1], 62.5, 'three hours later is an eighth further on');
  near(ticks[2], 75, 'six hours later is a quarter further on');
});

test('a turn outside the window is dropped, never clamped to the edge', () => {
  scope('day');
  // A 40-hour session whose first two turns are 16 and 15 hours before the
  // rail begins, and whose last two are 23 and 22 hours ago. No beat sits on
  // the boundary: one at exactly 24 hours ago draws at 0% quite correctly, and
  // a fixture that cannot tell that from a clamp is testing nothing.
  const r = row(40, 1, [0, 60, 1020, 1080]);
  const ticks = plain(data.sessionRailTicks(r));
  assert.equal(ticks.length, 2, 'only the two turns inside the last 24 hours');
  assert.ok(ticks.every((p) => p > 0 && p <= 100), 'and both inside the box');
  // The refusal, stated as the thing it prevents: clamping would put the two
  // dropped turns at 0% and draw a cluster at the left edge that is not a
  // cluster and did not happen then.
  assert.ok(!ticks.includes(0), 'nothing piled on the origin');
  near(ticks[0], (1 / 24) * 100, 'the first kept turn is 23 hours back');
  // It is not silent either, and the saying moved from the rail to the MARK.
  // The ordinal is the turn's place in the SESSION, so the first drawn mark
  // reads "Turn 3 of 4" and states the clipping by being an ordinal.
  const first = data.railTurnNote(r, data.railTurns(r)[0]);
  assert.match(first.when, /^Turn 3 of 4 /, 'the third turn of the session, not the first drawn');
  // And the clipping is a parenthetical, not a sentence. "33 of them fell
  // before this window and are not drawn" was the whole body on a clipped row:
  // it spent the note on the one thing the reader had not asked about.
  assert.match(first.note, /\(earlier turns out of range\)$/);
});

test('a session that began before the window runs off the left edge', () => {
  scope('day');
  const long = seg(data.sessionRailSeg(row(40, 6, [0])));
  assert.equal(long.left, 0, 'the segment starts at the edge, not at its start');
  near(long.width, 75, 'and ends where the session did, 6 hours before now');
  const inside = seg(data.sessionRailSeg(row(12, 6, [0])));
  near(inside.left, 50, 'a session inside the window keeps its own start');
  near(inside.width, 25, 'and its own extent');
});

test('a session too short to draw still draws, because the width says where', () => {
  scope('month');
  // Six minutes on a 30-day rail is 0.014% of the width: a real row, and one
  // that rounds to nothing without a floor.
  const tiny = seg(data.sessionRailSeg(row(2, 1.9, [0])));
  assert.ok(tiny.width >= 0.2, `a floor keeps it visible: ${tiny.width}`);
  assert.ok(tiny.width < 1, 'and the floor is a floor, not a minimum bar');
});

test('a row summarised before version 22 says so instead of drawing an empty rail', () => {
  scope('week');
  const old = row(20, 4);                       // no `beats`
  assert.deepEqual(plain(data.sessionRailTicks(old)), [], 'nothing to place');
  // The segment is still true, so it is still drawn; the dash is what says the
  // detail is missing rather than absent.
  assert.match(data.sessionRailSeg(old), /repeating-linear-gradient/);
  // The one case the RAIL still carries a note of its own: there are no marks
  // to ask about, so there is nothing for a per-mark note to answer.
  assert.match(data.railStaleNote(old), /version 22/);
  assert.match(data.railStaleNote(old), /Refresh/);
  // And a healed row of the same shape is drawn solid.
  assert.ok(!/repeating-linear-gradient/.test(data.sessionRailSeg(row(20, 4, [0, 30]))));
});

test('the day lane tiles the span exactly, with no gap and no overlap', () => {
  for (const key of ['day', 'week', 'month']) {
    scope(key);
    const lane = data.sessionRailDays;
    assert.ok(lane.length >= 2, `${key} shows at least one day boundary`);
    near(lane[0].a, 0, `${key} lane starts at the span start`);
    near(lane[lane.length - 1].b, 100, `${key} lane ends at now`);
    for (let i = 1; i < lane.length; i++)
      near(lane[i].a, lane[i - 1].b, `${key} capsule ${i} abuts the one before it`);
  }
});

test('a mark counts the turns the rail drew, not the counter beside it', () => {
  // `exchanges` is the recorder's and the two can disagree: one record on file
  // stores 16 prompts under an `exchanges` of 8. The rail draws the beats, so
  // its notes count the beats.
  scope('day');
  const r = { ...row(6, 1, [0, 10, 20]), exchanges: 99 };
  const turns = data.railTurns(r);
  assert.equal(turns.length, 3, 'three beats, three marks');
  assert.match(data.railTurnNote(r, turns[2]).when, /^Turn 3 of 3 /);
});

test('a rail with every turn inside the window says nothing about clipping', () => {
  scope('day');
  const r = row(6, 1, [0, 10, 20]);
  const n = data.railTurnNote(r, data.railTurns(r)[0]);
  assert.match(n.when, /^Turn 1 of 3 · /, 'the lead orients: which turn, and when');
  assert.doesNotMatch(n.note, /out of range/, 'nothing clipped, nothing said about clipping');
  // And the rail itself carries no note at all, so hovering it answers with the
  // mark under the pointer rather than with a summary of the row.
  assert.equal(data.railStaleNote(r), '', 'nothing on the rail to fire');
});

test('a drawn turn knows its place in the session, not in what survived the window', () => {
  scope('day');
  // Six turns, the first four before the window opens. What the rail draws is
  // two marks; what they are is turns five and six.
  const r = row(40, 1, [0, 60, 120, 180, 1020, 1080]);
  const turns = plain(data.railTurns(r));
  assert.deepEqual(turns.map((t) => t.i), [4, 5], 'the indices are the session\'s own');
  assert.match(data.railTurnNote(r, turns[0]).when, /^Turn 5 of 6 /);
  assert.match(data.railTurnNote(r, turns[1]).when, /^Turn 6 of 6 /);
});

// ── THE LANE'S SUMMED STRIP ───────────────────────────────────────────────
//
// The rails above are per row. The strip above the list is every listed row's
// turns folded onto one lane, and three things about that fold are worth
// holding: it takes the ROWS' span and the rows' drop rule, so a mark sits
// directly above the row marks it is made of; it BINS, so the node count is
// bounded by the strip's resolution rather than by the store; and a mark knows
// whose turns it is, which is what makes the tap that jumps to them possible.

// The strip reads `sessionNodes`, and the scope filter behind that reads the
// REAL clock (withinSessionWindow), not `railNow`. The fixture above is pinned
// to a fixed instant, so by the time the suite runs every one of its rows is
// days old and falls out of Day before the strip ever sees it. So the strip's
// tests take their anchor from the clock ONCE and pin `railNow` to the same
// value: the filter and the span then agree, and the arithmetic stays exact
// because both sides read the constant rather than the clock twice.
const LIVE = Date.now();
const liveAt = (hoursAgo) => new Date(LIVE - hoursAgo * HOUR).toISOString();
const liveRow = (startedHoursAgo, endedHoursAgo, beats) => ({
  id: 'r' + startedHoursAgo,
  started: liveAt(startedHoursAgo),
  ended: liveAt(endedHoursAgo),
  ...(beats ? { beats } : {}),
});

// The pane reads rows off `sessionRows_`, the same field the render scenario
// seeds. A row with no branch under it still becomes a node, which is all the
// strip needs. Every narrowing is cleared, so what the strip sums is the whole
// fixture and a failure is never a filter.
function listRows(key, rows) {
  data.activityQuery = '';
  data.sessionScope = key;
  data.railNow = LIVE;
  data.sessionRows_ = rows;
  data.sessionRepoFilter = '';
  data.sessionStateFilter = '';
}

test('the strip sums every listed row, at the rows own placement', () => {
  // Two sessions, each opening 12 hours ago: their first turns are both the
  // halfway mark on a 24-hour span, so they must land in ONE bin.
  listRows('day', [liveRow(12, 2, [0, 360]), { ...liveRow(12, 2, [0]), id: 'other' }]);
  const strip = plain(data.sessionRailAll);
  const mid = strip.find((m) => Math.abs(m.p - 50) < 0.5);
  assert.ok(mid, 'the two openings share a column at the middle of the span');
  assert.equal(mid.n, 2, 'and that column counts both of them, once each');
  assert.equal(strip.length, 2, 'two columns: the shared opening and the later turn');
  assert.equal(strip.reduce((a, m) => a + m.n, 0), 3, 'and all three turns are in them');
  // The second mark is the 6-hour-later turn, at the same x its row rail puts it.
  const late = strip.find((m) => m.p > 60);
  near(late.p, data.sessionRailTicks(liveRow(12, 2, [0, 360]))[1],
    'the strip and the row agree on x', 0.5);
});

test('a turn the rows drop is dropped here too, so the two lanes agree', () => {
  // The same 40-hour row the per-row test uses: two of its four turns fall
  // before the window. A strip that clamped them would draw a burst at the
  // left edge that no rail below it shows.
  listRows('day', [liveRow(40, 1, [0, 60, 1020, 1080])]);
  const strip = plain(data.sessionRailAll);
  assert.equal(strip.reduce((a, m) => a + m.n, 0), 2, 'only what the rails drew');
  assert.ok(strip.every((m) => m.p > 0), 'and nothing piled on the origin');
});

test('a row with no turn times contributes nothing, and the note says so', () => {
  listRows('week', [liveRow(20, 4), liveRow(10, 2, [0, 30])]);
  assert.equal(plain(data.sessionRailAll).reduce((a, m) => a + m.n, 0), 2,
    'the version-22 row adds no marks');
  assert.match(data.sessionRailAllNote, /1 row predates turn times/);
  // And the note stays inside the note kit's six-line box. At 34ch a line that
  // is about 200 characters; the first draft ran to 260 and the kit clipped it
  // and said so in the console, which is the failure this guards.
  assert.ok(data.sessionRailAllNote.length < 200,
    `the strip note fits a note rather than a card: ${data.sessionRailAllNote.length} chars`);
});

test('the strip is bounded by its own resolution, not by the store', () => {
  // Six sessions of 200 turns each, every turn a distinct minute: 1,200 turns
  // that a mark-per-turn strip would draw as 1,200 nodes.
  const beats = Array.from({ length: 200 }, (_, i) => i * 3);
  listRows('month', Array.from({ length: 6 },
    (_, i) => ({ ...liveRow(24 * (i + 1), 1, beats), id: 's' + i })));
  const strip = plain(data.sessionRailAll);
  assert.ok(strip.length <= 1000, `at most one mark a column: ${strip.length}`);
  assert.equal(strip.reduce((a, m) => a + m.n, 0), 1200, 'and every turn is still counted');
  // Every column is distinct and in order, which is what lets x-for key on it.
  assert.deepEqual([...new Set(strip.map((m) => m.k))].length, strip.length, 'no column twice');
  assert.deepEqual(strip.map((m) => m.k), [...strip.map((m) => m.k)].sort((a, b) => a - b),
    'and they run left to right');
});

test('a mark names the session it is mostly made of, and points the tap there', () => {
  // One column, three turns from A and one from B: the loud one is the tap's
  // destination, and it is the one named first in the note.
  //
  // All four in the SAME MINUTE, which the fixture has to say now that a column
  // is a thousandth of the span: at 240 columns a Day column was six minutes
  // and [0, 1, 2] was one column, at 1,000 it is 86 seconds and those are two.
  // The fixture asserting a shared column has to build one.
  listRows('day', [
    { ...liveRow(12, 2, [0, 0, 0]), id: 'loud' },
    { ...liveRow(12, 2, [0]), id: 'quiet' },
  ]);
  const mid = plain(data.sessionRailAll).find((m) => Math.abs(m.p - 50) < 0.5);
  assert.equal(mid.key, 'r:loud', 'the tap goes where most of the mark came from');
  assert.match(mid.note, /loud/, 'and the note names it');
  assert.match(mid.note, /quiet/, 'without hiding the other session in the column');
  assert.match(mid.note, /4 user turns/, 'the count is the column, not one row');
});

test('the keyboard walks the same marks the pointer resolves to', () => {
  listRows('day', [liveRow(12, 2, [0, 180, 360])]);
  const strip = plain(data.sessionRailAll);
  assert.equal(strip.length, 3, 'three turns far enough apart to be three columns');
  data.railHover = null;
  data.railStep(1);
  assert.equal(data.railHover.k, strip[0].k, 'the first step lands on the leftmost mark');
  data.railStep(1);
  assert.equal(data.railHover.k, strip[1].k, 'and the next steps one column right');
  data.railStep(-1);
  assert.equal(data.railHover.k, strip[0].k, 'and back');
  data.railStep(-1);
  assert.equal(data.railHover.k, strip[0].k, 'the ends hold rather than wrapping');
});

// ── THE LINK BETWEEN THE TWO LANES ────────────────────────────────────────
//
// Hovering either lane lights one COLUMN in both. That rests on a single
// claim: a tick a row draws and the strip mark above it are in the same
// column, always. It holds by construction, since the strip sums these rows
// under this window with this drop rule, but "by construction" is exactly the
// kind of claim that stops being true when one side grows a second copy of
// railBin. These tests are that guard.

test('a row tick and the strip mark above it are the same column', () => {
  const rows = [liveRow(12, 2, [0, 47, 181, 362]), { ...liveRow(9, 1, [0, 33]), id: 'b' }];
  listRows('day', rows);
  const columns = new Set(plain(data.sessionRailAll).map((m) => m.k));
  for (const r of rows)
    for (const p of plain(data.sessionRailTicks(r)))
      assert.ok(columns.has(data.railBin(p)),
        `the tick at ${p}% has a mark in column ${data.railBin(p)}`);
});

test('a column is one function, so neither lane can round differently', () => {
  scope('week');
  // The ends, where an off-by-one in either direction would show first.
  assert.equal(data.railBin(0), 0, 'the left edge is the first column');
  assert.equal(data.railBin(100), 999, 'and now is the last, not one past it');
  assert.equal(data.railBin(-1), 0, 'a percent below the span clamps in');
  assert.equal(data.railBin(101), 999, 'and one above it clamps in too');
  // Two turns inside one column resolve alike, which is what makes them one
  // mark. A COLUMN IS A THOUSANDTH of the lane, which is about 1.2px on a
  // desktop: that number is the whole reason the highlight is not confusing.
  // At 240 columns a column was five pixels, so two turns 42 minutes apart on
  // Week drew as two plainly separate marks and then lit together, which reads
  // as a glitch rather than as a fact about the fold.
  assert.equal(data.railBin(50), data.railBin(50.09), 'a column is 1/1000 wide');
  assert.notEqual(data.railBin(50), data.railBin(50.1), 'and no wider than that');
  assert.notEqual(data.railBin(50), data.railBin(50.4),
    'two turns five pixels apart are two columns, which 240 could not say');
});

// A pointer event over a REAL rail element, cursor and all, because the handler
// reaches into it: it finds [data-rail-cursor] and writes this turn's note onto
// it. A plain object stood in until the cursor existed and then only proved
// that the geometry was right. The box is stubbed 100 wide from 0, so clientX
// IS the percent, since jsdom lays nothing out and a real box would be zero
// wide and make the handler bail.
function overRail(pct) {
  const el = window.document.createElement('div');
  el.innerHTML = '<span data-rail-cursor></span>';
  el.getBoundingClientRect = () => ({ left: 0, width: 100 });
  return { clientX: pct, currentTarget: el };
}
const cursorOf = (ev) => ev.currentTarget.querySelector('[data-rail-cursor]');

test('hovering a row rail lights the column and names the turn under the pointer', () => {
  listRows('day', [liveRow(12, 2, [0, 360])]);
  const row = liveRow(12, 2, [0, 360]);
  const ticks = plain(data.sessionRailTicks(row));
  const turns = plain(data.railTurns(row));
  data.railHover = null;

  let ev = overRail(ticks[1]);
  data.rowRailTrack(ev, row);
  assert.equal(data.railHover.k, data.railBin(ticks[1]),
    'the hover settles on the column the nearest tick is in');
  // And the note is about THAT TURN, parked at it, which is the whole point of
  // the cursor: a note anchored to the rail would open over the middle of it.
  assert.equal(cursorOf(ev).getAttribute('data-note-title'), 'Turn 2 of 2 · ' + data.railWhen(turns[1].at));
  assert.equal(cursorOf(ev).style.left, ticks[1] + '%', 'and sits on the mark it describes');
  // The body is the turn's own opening where the row carries one. These rows
  // are two ends and a beat list with no transcript behind them, which is the
  // lean shape the cache stores, so the note says so rather than inventing a
  // line. railTurnHead's own tests cover the join that finds the text.
  assert.match(cursorOf(ev).getAttribute('data-note'), /^No text for this turn/);

  // Nearest, not exact: a pointer between two ticks takes the closer one, and
  // the note follows it rather than staying on the last one named.
  ev = overRail((ticks[0] + ticks[1]) / 2 - 1);
  data.rowRailTrack(ev, row);
  assert.equal(data.railHover.k, data.railBin(ticks[0]), 'just left of the midpoint takes the left tick');
  assert.equal(cursorOf(ev).getAttribute('data-note-title'), 'Turn 1 of 2 · ' + data.railWhen(turns[0].at));

  // And the strip's own handler lands on the same column from the same x.
  data.railHover = null;
  data.railTrack(overRail(ticks[1]));
  assert.equal(data.railHover.k, data.railBin(ticks[1]), 'both lanes resolve one x alike');
});

test('a row with no turn times has no tick to hover, and nothing is invented', () => {
  listRows('week', [liveRow(20, 4)]);
  const ev = overRail(50);
  data.railHover = null;
  data.rowRailTrack(ev, liveRow(20, 4));
  assert.equal(data.railHover, null, 'no ticks, no column, no hover');
  assert.equal(cursorOf(ev).getAttribute('data-note'), null, 'and no note is written');
});

// ── THE TWO THINGS THAT MADE THE HOVER FEEL BROKEN ────────────────────────
//
// Both were measured on this pane with 9,200 ticks in the DOM, and both are
// here because the fix is invisible in the markup and a later reader would
// undo it reasonably.

test('the strip is memoised, since a getter recomputes on every read', () => {
  listRows('month', Array.from({ length: 40 },
    (_, i) => ({ ...liveRow(i * 6 + 1, i * 6, [0, 20, 40, 60]), id: 'm' + i })));
  const a = data.sessionRailAll;
  const b = data.sessionRailAll;
  // Alpine getters are not cached, so an unmemoised fold ran per read: 44ms on
  // a 300-session Month, and the pointer handlers read it on every pointermove.
  assert.equal(a, b, 'a second read is the same array, not a second fold');
  // And the cache is keyed, not permanent: a narrowing has to be seen.
  data.activityQuery = 'nothing matches this';
  assert.notEqual(data.sessionRailAll, a, 'a filter change refolds');
  data.activityQuery = '';
});

test('the hot column is an attribute on the few marks, not a stylesheet edit', () => {
  listRows('day', [liveRow(12, 2, [0, 360])]);
  const marks = plain(data.sessionRailAll);
  const doc = window.document;
  // Stand in for what both lanes render: an element per column, stamped the
  // way the markup stamps it.
  const host = doc.createElement('div');
  host.innerHTML = marks.map((m) => `<i data-tick="${m.k}"></i>`).join('');
  doc.body.appendChild(host);
  // Scoped to the host, because the component renders its OWN marks into this
  // same document and railHot quite correctly marks those too; an unscoped read
  // would be counting both copies and calling the duplicate a bug.
  const hot = () => [...host.querySelectorAll('[data-tick][data-hot]')].map((e) => +e.dataset.tick);

  data.railAt(marks[0], false);
  assert.deepEqual(hot(), [marks[0].k], 'only the hovered column is marked');
  data.railAt(marks[1], false);
  assert.deepEqual(hot(), [marks[1].k], 'moving on unmarks the one before it');
  data.railTrack(null);
  assert.deepEqual(hot(), [], 'and leaving the lane clears it');

  // The rule is written once and never rewritten, which is the point: editing a
  // stylesheet invalidates style across the document and the browser re-matches
  // the new selector against every candidate. Measured at 1,608ms a hover with
  // 9,200 ticks on the page, against 2.53ms for the attribute.
  const sheet = doc.getElementById('wt-rail-hot');
  assert.ok(sheet, 'one style element');
  const before = sheet.textContent;
  data.railAt(marks[0], false);
  assert.equal(sheet.textContent, before, 'and its text does not move with the pointer');
  assert.match(before, /\[data-tick\]\[data-hot\]/, 'two selectors, so it outranks the utility class');
  host.remove();
});

// ── THE HEAD UNDER A MARK, and the join that finds it ─────────────────────
//
// The text is the row's own: replyTurns is the transcript the exchange card
// reads, and its user entries are what a mark quotes. Nothing new is fetched
// or stored for it. What IS new is the join from a beat to one of those
// entries, and the reason it is a clock join rather than an index one:
// fullTurns drops the first prompt and collapses a RUN of attachments into one
// entry, while beats counts every prompt. So the nth user entry is not the nth
// beat on any session where somebody dropped two screenshots into one message,
// which across the store is 142 sessions.

// A row the cache would leave with a transcript: two ends, beats, and the
// headed turns. `ts` is UTC HH:MM:SS, which is what priorTurns keeps, and the
// beats are the matching minute offsets.
function spoken(beats, turns, ask) {
  const t0 = Date.parse(at(12));                 // started 12 hours ago
  const clock = (m) => new Date(t0 + m * 60000).toISOString().slice(11, 19);
  return {
    id: 'spoken', started: at(12), ended: at(2), beats,
    ask: ask || '', askAt: ask ? clock(beats[0]) : '',
    turns: turns.map(([k, md, m]) => [k, md, clock(m)]),
  };
}

test('a mark quotes the turn it sits on', () => {
  scope('day');
  const r = spoken([0, 30, 90], [['u', 'Second question', 30],
                                 ['a', 'An answer nobody asked for', 60],
                                 ['u', 'Third question', 90]], 'Opening ask');
  const turns = data.railTurns(r);
  assert.equal(data.railTurnNote(r, turns[0]).note, 'Opening ask', 'the ask is turn one');
  assert.equal(data.railTurnNote(r, turns[1]).note, 'Second question');
  assert.equal(data.railTurnNote(r, turns[2]).note, 'Third question',
    'and the assistant turn between them is not a mark and not quoted');
});

test('an attachment run does not shift what the later marks quote', () => {
  scope('day');
  // Three screenshots in one message: three beats, ONE entry in the row's
  // turns. An index join would hand the last mark the image placeholder and
  // every mark after it the turn before. The clock join holds.
  const r = spoken([0, 30, 31, 32, 90],
                   [['u', '[3 images]', 30], ['u', 'Third question', 90]], 'Opening ask');
  const turns = data.railTurns(r);
  assert.equal(turns.length, 5, 'five prompts, five marks');
  assert.equal(data.railTurnNote(r, turns[0]).note, 'Opening ask');
  assert.equal(data.railTurnNote(r, turns[4]).note, 'Third question',
    'the last mark still quotes the last turn, four entries out of step');
});

test('an ambiguous minute declines rather than guessing', () => {
  scope('day');
  // Two turns in the same minute: nothing on the row can say which mark is
  // which, and a confident line of the wrong turn is worse than none.
  const r = spoken([0, 30, 30], [['u', 'One thing', 30], ['u', 'And another', 30]], 'Opening ask');
  const turns = data.railTurns(r);
  assert.match(data.railTurnNote(r, turns[1]).note, /^No text for this turn/);
  // The first mark is still unambiguous, so it still speaks.
  assert.equal(data.railTurnNote(r, turns[0]).note, 'Opening ask');
});

test('a quoted turn is flattened and cut to fit a note', () => {
  scope('day');
  const md = '* [2025-27 Biennial Budget Instructions](https://ofm.wa.gov/x)\n'
           + '* [Budget Development Manual](https://ofm.wa.gov/y)\n\n'
           + 'Read these and tell me which ones the submittal needs to cite.';
  const r = spoken([0], [], md);
  const got = data.railTurnNote(r, data.railTurns(r)[0]).note;
  assert.doesNotMatch(got, /https:|\]\(|^\*/, 'no markup survives into a note that cannot render it');
  assert.match(got, /2025-27 Biennial Budget Instructions · Budget Development Manual/,
    'a list keeps its boundaries as the separator the bullets were');
  // The note kit caps a note at six lines and warns when one overflows. The
  // cache heads a user turn at 240, which is a card's budget; this is cut again.
  assert.ok(got.length <= 160, `cut to a note's width: ${got.length}`);
});

test('a row with no transcript says so rather than inventing a line', () => {
  scope('day');
  const r = row(12, 2, [0, 60]);                  // beats, no turns, no ask
  assert.match(data.railTurnNote(r, data.railTurns(r)[0]).note, /^No text for this turn/);
});
