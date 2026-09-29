// browser-checks-parse.test.mjs — every browser-driven check under tools/test
// at least parses.
//
// The suite skips those checks by design (they are named without `.test.`, so
// `node --test` never runs them, and CI needs no browser). The cost is that
// nothing reads them between manual runs: on 2026-09-28 a one-line label edit
// left an apostrophe inside a single-quoted string in
// showing-selection-probe.mjs, and the broken file was committed and pushed
// with the suite green. A syntax check needs no browser, so it runs here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const dir = path.join(repoRoot, 'tools', 'test');
const checks = readdirSync(dir).filter(f => f.endsWith('.mjs') && !f.includes('.test.'));

test('the browser checks are found', () => {
  assert.ok(checks.length >= 20, `only ${checks.length} browser checks found; the scan went blind`);
});

test('every browser check parses', () => {
  const broken = checks.filter(f => spawnSync(process.execPath, ['--check', path.join(dir, f)]).status !== 0);
  assert.deepEqual(broken, [], 'these browser checks do not parse');
});
