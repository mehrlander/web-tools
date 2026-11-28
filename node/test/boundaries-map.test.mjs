// boundaries-map.test.mjs — the Alignment program's text-boundaries map
// (programs/alignment/current/boundaries.csv) agrees with what it measures:
// each row's project from its path, its program from .web-tools.json, and
// every entity id from the map's list. Paths in a repository not checked out
// beside this one are skipped.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../programs/alignment/current/boundaries-map.mjs', import.meta.url));

test('boundaries.csv matches its measured columns and names only known claimants', () => {
  const r = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
