// node/build/tools-index.mjs, the builder of docs/harness.csv: the two parts
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
  assert.deepEqual(env, ['.claude/environment-setup.sh']);
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

test('callers are what runs a file, never a mention of it', async () => {
  const { deriveTools } = await import('../build/tools-index.mjs');
  const rows = deriveTools(repoRoot);
  const callers = p => rows.get(p).callers.split(';').filter(Boolean);
  assert.deepEqual(callers('skills/hooks/commit-consent.py'), ['.githooks/commit-msg'], 'found through the hooks\' plugin_script');
  assert.ok(callers('node/build/build-app.mjs').includes('.githooks/pre-commit'), 'npm run build:app in the commit hook');
  assert.ok(callers('node/checkout-setup.mjs').includes('.claude/hooks/session-start.sh'), 'npm run setup in a session script');
  assert.ok(callers('python/scheduled-tasks.py').includes('.github/workflows/scheduled-tasks.yml'), 'python3 <path> in a workflow');
  assert.ok(callers('node/render/cdn.mjs').includes('node/test/'), 'an import from the suite');
  assert.ok(callers('python/mcp-link-safe.py').some(c => c.endsWith('.md')), 'a document that gives the command');
  assert.ok(callers('python/look-link.py').includes('python/showing.py'), 'a module loaded by path through importlib');
  assert.deepEqual(callers('node/check-branch-status.mjs'), [], 'named in a comment and in prose, run by nothing');
  assert.equal(rows.get('node/check-branch-status.mjs').invocation, 'argv', 'a comment naming a command-line tool does not make it imported');
});
