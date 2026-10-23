// kits/doc-growth.js: the arithmetic behind the Map's Growth tab and the
// full-page chart. What breaks without these: a file a commit hook writes, or a
// log, ranked as a document someone tends; a file that no longer exists ranked
// by its last size; focused edits summed past the sample in view; and a ranking
// that orders by count when density was asked for.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const win = {};
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/doc-growth.js'), 'utf8'))(win);
const G = win.DocGrowth;

// Three samples. `f` is focused edits per sample, `e` all edits.
const file = (p, w, f, extra = {}) => ({
  p, g: 0, w, r: w, e: f.map(x => x + 1), f, n: [0, 0, 0], born: 0,
  edits: f.reduce((a, b) => a + b + 1, 0), focused: f.reduce((a, b) => a + b, 0), ...extra,
});
const data = {
  days: 7, focus: 5, frames: ['2026-10-01', '2026-10-08', '2026-10-15'], groups: ['docs'],
  files: [
    file('docs/short.md', [200, 300, 300], [2, 3, 3]),           // 8 focused, 300 words
    file('docs/long.md', [3000, 4000, 4000], [5, 5, 10]),        // 20 focused, 4000 words
    file('docs/README.md', [500, 500, 500], [9, 9, 9], { gen: 1 }),
    file('chron/2026/10/note.md', [100, 100, 100], [9, 9, 9]),
    file('docs/gone.md', [800, 800, null], [5, 5, 0]),
    file('docs/rare.md', [400, 400, 400], [1, 1, 1]),            // 3 focused
  ],
};

test('rank leaves out hook-written files, logs, files gone at the last sample and files under the minimum', () => {
  const rows = G.rank(data, { min: 5 });
  assert.deepEqual(rows.map(r => r.p), ['docs/short.md', 'docs/long.md']);
});

test('rank orders by focused edits per thousand words unless asked for the count', () => {
  const dens = G.rank(data, { min: 5 });
  assert.equal(dens[0].p, 'docs/short.md');
  assert.ok(Math.abs(dens[0].d - 1000 * 8 / 300) < 1e-9);
  assert.deepEqual(G.rank(data, { min: 5, by: 'count' }).map(r => r.p), ['docs/long.md', 'docs/short.md']);
});

test('care sums focused edits only through the sample in view', () => {
  const f = data.files[1];
  assert.equal(G.care(f, 0), 5);
  assert.equal(G.care(f, 1), 10);
  assert.equal(G.care(f, 2), 20);
  assert.equal(G.care({ p: 'x.md' }, 2), 0);
});

test('the Care measure draws only what the ranking could hold', () => {
  const shown = G.shown(data, { y: 'care', min: 5 }).map(f => f.p);
  assert.ok(!shown.includes('docs/README.md') && !shown.includes('chron/2026/10/note.md'));
  assert.ok(shown.includes('docs/short.md'));
  assert.equal(G.shown(data, { y: 'churn', min: 5 }).length, data.files.filter(f => f.edits >= 5).length);
});

test('a payload without focused edits says so, and older payloads still chart', () => {
  assert.equal(G.hasCare(data), true);
  const old = { ...data, files: data.files.map(({ f, ...rest }) => rest) };
  assert.equal(G.hasCare(old), false);
  assert.deepEqual(G.rank(old, { min: 1 }), []);
  assert.ok(G.bounds(old).churn >= 4);
});
