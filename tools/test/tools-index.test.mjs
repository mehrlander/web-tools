// tools/build/tools-index.mjs, the builder of docs/harness.csv: the two parts
// of it that a drift check cannot see. The derived-artifacts gate proves the
// registry matches what the builder writes; it cannot prove the builder writes
// the right route for the setup script, or that a moved file keeps its role,
// since a registry that lost both would still match its own builder.

import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTools, carryMovedRoles } from '../build/tools-index.mjs';
import { repoRoot } from './bootstrap.mjs';

test('the environment setup script, and nothing else, routes as env:build', () => {
  const derived = deriveTools(repoRoot);
  const env = [...derived].filter(([, d]) => d.invocation === 'env:build').map(([p]) => p);
  assert.deepEqual(env, ['scripts/environment-setup.sh']);
});

test('a role follows a move when exactly one dropped and one added path share a basename', () => {
  const byPath = new Map([
    ['.claude/skills/hooks/guard.sh', { role: 'refuses the thing' }],
    ['skills/hooks/guard.sh', { role: '' }],
  ]);
  const carried = carryMovedRoles(byPath, ['skills/hooks/guard.sh'], ['.claude/skills/hooks/guard.sh']);
  assert.deepEqual(carried, ['.claude/skills/hooks/guard.sh -> skills/hooks/guard.sh']);
  assert.equal(byPath.get('skills/hooks/guard.sh').role, 'refuses the thing');
});

test('a role is not guessed when either side of a move is ambiguous', () => {
  const byPath = new Map([
    ['old/run.sh', { role: 'the old one' }],
    ['a/run.sh', { role: '' }],
    ['b/run.sh', { role: '' }],
    ['old/blank.sh', { role: '' }],
    ['new/blank.sh', { role: '' }],
  ]);
  const carried = carryMovedRoles(byPath,
    ['a/run.sh', 'b/run.sh', 'new/blank.sh'], ['old/run.sh', 'old/blank.sh']);
  assert.deepEqual(carried, []);
  assert.equal(byPath.get('a/run.sh').role, '');
  assert.equal(byPath.get('b/run.sh').role, '');
});
