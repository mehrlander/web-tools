// A category map's answer agrees with its own coding.
//
// The answer is what pages/cat-map.html draws as a poster, so a placement on it
// is a claim a reader will act on: that docs.csv is a plain registry, that the
// activity cache is a cache. skills/cat-map/answer-check.py holds every example
// to the cell or word it sits under, using the coded instances of the run the
// answer names as its basis. Without it a poster can drift from its evidence,
// which the first draft did twice: trackers.md shown as a plain registry though
// its own coding made it a cache, and notes shown as a plain stream though the
// Lists view lists it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const dir = path.join(repoRoot, 'research', 'category-mapping');
const maps = readdirSync(dir).filter(f => f.endsWith('.json'))
  .map(f => path.join(dir, f))
  .filter(p => { try { return JSON.parse(readFileSync(p, 'utf8')).format === 'catmap/1'; } catch { return false; } });

test('there are category maps to check', () => {
  assert.ok(maps.length >= 2, `found ${maps.length}`);
});

for (const p of maps) {
  test(`${path.basename(p)}: every placement in the answer follows from the coding`, () => {
    let out = '', failed = false;
    try {
      out = execFileSync('python3', [path.join(repoRoot, 'skills', 'cat-map', 'answer-check.py'), p], { encoding: 'utf8', cwd: repoRoot });
    } catch (e) {
      failed = true;
      out = (e.stdout || '') + (e.stderr || '');
    }
    assert.ok(!failed, out);
  });
}
