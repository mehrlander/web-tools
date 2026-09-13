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
// No network and no pixels: the geometry is numbers, and `railNow` is pinned so
// "now" is a fixture rather than the clock.

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
  // It is not silent either. The note on the rail counts what it could not draw.
  assert.match(data.sessionRailNote(r), /2 of them fell before this window/);
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
  assert.match(data.sessionRailNote(old), /version 22/);
  assert.match(data.sessionRailNote(old), /Refresh/);
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

test('the note counts the turns it drew, not the counter beside it', () => {
  // `exchanges` is the recorder's and the two can disagree: one record on file
  // stores 16 prompts under an `exchanges` of 8. The rail draws the beats, so
  // its note counts the beats.
  scope('day');
  const r = { ...row(6, 1, [0, 10, 20]), exchanges: 99 };
  assert.match(data.sessionRailNote(r), /^3 user turns/);
});
