// ONE STATEMENT OF WHERE THE REPO IS: node/repo-root.mjs. It was written for
// the merge driver and re-exported by bootstrap.mjs, and on 2026-10-20 108
// scripts and tests still computed the same path for themselves from their own
// depth, `path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')`.
// None had drifted, which is the case for this test rather than against it: a
// copy that counts its own '..' segments is right until the file moves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const COPY = /^\s*const \w+ = path\.resolve\((?:path\.dirname\(fileURLToPath\(import\.meta\.url\)\)|import\.meta\.dirname), ((?:'[^']*'(?:, )?)+)\);/;

test('only node/repo-root.mjs computes the repo root from its own location', () => {
  const files = execFileSync('git', ['ls-files', 'node/*.mjs', 'node/*.js', 'node/**/*.mjs', 'node/**/*.js'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').filter((f) => f && f !== 'node/repo-root.mjs');
  const offenders = [];
  for (const f of new Set(files)) {
    readFileSync(path.join(repoRoot, f), 'utf8').split('\n').forEach((line, i) => {
      const m = line.match(COPY);
      if (!m) return;
      const segs = [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
      if (path.resolve(repoRoot, path.dirname(f), ...segs) === repoRoot) offenders.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, [], "these compute the repo root themselves; import { repoRoot } from node/repo-root.mjs instead");
});
