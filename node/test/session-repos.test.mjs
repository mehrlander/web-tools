// alpineComponents/session-repos.js, the Sessions pane's Repos tab: the
// session rows folded per repo, and where each companion sits in a repo's
// orbit. An owner-qualified name and a bare one are one repo; a repo's
// companions count the sessions it shares with each other repo, with that
// repo's own total beside them; a companion sits nearer the hub the larger
// the share of the hub's sessions it was in, and the nearest and largest
// leads from twelve o'clock. A repo's sessions per day are counted over the
// span of every session's days.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow();
window.Alpine = { data: () => {} };
window.esc = (s) => String(s);
new window.Function(readFileSync(path.join(repoRoot, 'lib/alpineComponents/session-repos.js'), 'utf8'))();
// Results come from the jsdom realm; copied out so deepEqual compares values.
const own = (x) => JSON.parse(JSON.stringify(x));
const { model, orbit, span, ALL } = window.SessionRepos;

const row = (id, day, repos) => ({ id, day, repos: repos.map(([name, branch]) => ({ name, branch })) });
const ROWS = [
  row('a1', '2026-11-01', [['home', 'claude/x'], ['web-tools', 'claude/x'], ['mehrlander/web-tools', 'claude/y']]),
  row('b1', '2026-11-03', [['mehrlander/home', 'main'], ['home', null]]),
  row('c1', '2026-11-02', [['web-tools', 'claude/z'], ['home', 'claude/z']]),
  row('d1', '2026-11-04', []),
  row('e1', '2026-11-05', [['fun', 'claude/f']]),
];

test('an owner-qualified name and a bare one are one repo', () => {
  const m = model(ROWS);
  assert.deepEqual(own(m.repos.map(e => [e.name, e.sessions])), [['home', 3], ['web-tools', 2], ['fun', 1]]);
  assert.equal(m.all.sessions, 4, 'a session naming no repo is not counted');
});

test('branches count only work off the default branch, and alone counts sessions in one repo', () => {
  const m = model(ROWS);
  const home = m.repos.find(e => e.name === 'home');
  assert.equal(m.repos.find(e => e.name === 'web-tools').branches, 3);
  assert.equal(home.branches, 2);
  assert.equal(home.alone, 1, 'b1 worked in home only, on its default branch');
  assert.equal(m.all.branches, 6);
  assert.equal(home.first, '2026-11-01');
  assert.equal(home.last, '2026-11-03');
});

test('companions count the sessions shared, beside their own total', () => {
  const m = model(ROWS);
  assert.deepEqual(own(m.repos.find(e => e.name === 'home').with), [{ name: 'web-tools', n: 2, own: 2 }]);
  assert.deepEqual(own(m.all.with.map(w => [w.name, w.n])), [['home', 3], ['web-tools', 2], ['fun', 1]]);
  assert.equal(ALL, '*');
});

test('a companion in more of the hub sessions sits nearer, and the nearest leads', () => {
  const hub = { sessions: 10, with: [{ name: 'a', n: 9, own: 9 }, { name: 'b', n: 5, own: 20 }, { name: 'c', n: 1, own: 1 }] };
  const pts = own(orbit(hub));
  const dist = pts.map(p => Math.hypot(p.x, p.y));
  assert.ok(dist[0] < dist[1] && dist[1] < dist[2], 'distance grows as the share falls');
  assert.ok(pts[0].size > pts[1].size && pts[1].size > pts[2].size, 'size grows with sessions shared');
  assert.ok(Math.atan2(pts[0].y, pts[0].x) < 0 && pts[0].x > 0, 'the first sits just clockwise of twelve');
});

test('sessions are counted per day, and the span holds every day between', () => {
  const m = model(ROWS);
  assert.deepEqual(own(m.repos.find(e => e.name === 'home').days), { '2026-11-01': 1, '2026-11-02': 1, '2026-11-03': 1 });
  assert.equal(m.all.days['2026-11-05'], 1);
  assert.deepEqual(own(span('2026-10-30', '2026-11-02')), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  assert.deepEqual(own(span('', '2026-11-02')), []);
});
