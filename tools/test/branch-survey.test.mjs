// branch-survey.js — the pure survey math ported from home's
// tools/branch-survey.sh. Run the IIFE against a window stub, then exercise
// each CLI semantic: tree-set extraction, the per-path landed order (same
// path/same bytes, moved blob, branch deletion, churn vs missing), and the
// active/landed/stranded classification with its calibrated thresholds.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const src = readFileSync(path.join(repoRoot, 'lib/branch-survey.js'), 'utf8');
const window = {};
new Function('window', src)(window);
const B = window.BranchSurvey;

const tree = (entries) => B.treeSets(entries);

test('treeSets keeps blobs only, keyed both ways', () => {
  const t = tree([
    { path: 'a.txt', type: 'blob', sha: 's1' },
    { path: 'dir', type: 'tree', sha: 's2' },
    { path: 'dir/b.txt', type: 'blob', sha: 's3' },
  ]);
  assert.deepEqual([...t.blobs].sort(), ['s1', 's3']);
  assert.equal(t.paths.get('dir/b.txt'), 's3');
  assert.equal(t.paths.has('dir'), false);
});

test('landedSignal: identical bytes at the same path land', () => {
  const main = tree([{ path: 'a', type: 'blob', sha: 'x' }]);
  const tip = tree([{ path: 'a', type: 'blob', sha: 'x' }]);
  const s = B.landedSignal(['a'], tip, main);
  assert.deepEqual(s, { nUnique: 1, nLanded: 1, nMissing: 0, missingPaths: [] });
});

test('landedSignal: a moved blob lands (bytes anywhere on main)', () => {
  const main = tree([{ path: 'new/home', type: 'blob', sha: 'x' }]);
  const tip = tree([{ path: 'old/place', type: 'blob', sha: 'x' }]);
  const s = B.landedSignal(['old/place'], tip, main);
  assert.equal(s.nLanded, 1);
  assert.equal(s.nMissing, 0);
});

test('landedSignal: a path deleted at the branch tip counts landed', () => {
  const main = tree([{ path: 'kept', type: 'blob', sha: 'x' }]);
  const tip = tree([]);
  const s = B.landedSignal(['kept'], tip, main);
  assert.equal(s.nLanded, 1);
});

test('landedSignal: churn (path on main, bytes differ) is unlanded but not missing', () => {
  const main = tree([{ path: 'a', type: 'blob', sha: 'mainv' }]);
  const tip = tree([{ path: 'a', type: 'blob', sha: 'tipv' }]);
  const s = B.landedSignal(['a'], tip, main);
  assert.deepEqual(s, { nUnique: 1, nLanded: 0, nMissing: 0, missingPaths: [] });
});

test('landedSignal: path and bytes both absent from main is missing', () => {
  const main = tree([]);
  const tip = tree([{ path: 'only/here', type: 'blob', sha: 'z' }]);
  const s = B.landedSignal(['only/here'], tip, main);
  assert.deepEqual(s.missingPaths, ['only/here']);
  assert.equal(s.nMissing, 1);
});

test('landedSignal dedupes the unique-path list', () => {
  const main = tree([{ path: 'a', type: 'blob', sha: 'x' }]);
  const tip = tree([{ path: 'a', type: 'blob', sha: 'x' }]);
  const s = B.landedSignal(['a', 'a', 'a'], tip, main);
  assert.equal(s.nUnique, 1);
});

test('classify: fresh work is active regardless of signal', () => {
  assert.equal(B.classify({ daysAgo: 3, nUnique: 5, nLanded: 0, nMissing: 5 }), 'active');
  assert.equal(B.classify({ daysAgo: 14, nUnique: 5, nLanded: 0, nMissing: 5 }), 'active');
  assert.equal(B.classify({ daysAgo: 15, nUnique: 5, nLanded: 0, nMissing: 5 }), 'stranded');
});

test('classify: the squash-merge shadow (no unique paths) lands', () => {
  assert.equal(B.classify({ daysAgo: 60, nUnique: 0, nLanded: 0, nMissing: 0 }), 'landed');
});

test('classify: nothing missing lands even below the ratio', () => {
  assert.equal(B.classify({ daysAgo: 60, nUnique: 10, nLanded: 2, nMissing: 0 }), 'landed');
});

test('classify: the 80% ratio boundary, inclusive', () => {
  assert.equal(B.classify({ daysAgo: 60, nUnique: 10, nLanded: 8, nMissing: 2 }), 'landed');
  assert.equal(B.classify({ daysAgo: 60, nUnique: 10, nLanded: 7, nMissing: 3 }), 'stranded');
});

test('classify honors option overrides', () => {
  assert.equal(B.classify({ daysAgo: 20, nUnique: 5, nLanded: 0, nMissing: 5 }, { recentDays: 21 }), 'active');
  assert.equal(B.classify({ daysAgo: 60, nUnique: 10, nLanded: 5, nMissing: 5 }, { landedPct: 50 }), 'landed');
});

test('daysAgo floors to whole days', () => {
  const now = Date.parse('2026-07-17T12:00:00Z');
  assert.equal(B.daysAgo('2026-07-17T00:00:00Z', now), 0);
  assert.equal(B.daysAgo('2026-07-10T11:00:00Z', now), 7);
});
