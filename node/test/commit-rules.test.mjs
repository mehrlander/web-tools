// docs/commit-rules.csv against the tree: each rule's command names a script
// that exists and each output is a file that exists, so a rename fails here
// rather than as a warning at someone's next commit. The npm groups are held to
// the kinds they run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { readRules, KINDS } from '../build/commit-rules.mjs';

const rules = readRules(repoRoot);
const scripts = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).scripts;

test('rules run in their order column, and only a check has no outputs', () => {
  assert.deepEqual(rules.map(r => r.order), rules.map((_, i) => String(i + 1)));
  for (const r of rules) {
    assert.ok(KINDS.includes(r.kind), `${r.rule}: kind ${r.kind}`);
    assert.equal(r.outputs.length === 0, r.kind === 'check', `${r.rule}: a check writes nothing, and every other rule writes something`);
  }
});

test('every command and every output resolves in the tree', () => {
  for (const r of rules) {
    const npm = r.command.match(/^npm run ([\w:.-]+)/);
    if (npm) assert.ok(scripts[npm[1]], `${r.rule}: no npm script ${npm[1]}`);
    else {
      const file = r.command.match(/^(?:node|python3) (\S+)/);
      assert.ok(file && existsSync(path.join(repoRoot, file[1])), `${r.rule}: '${r.command}' runs no file in the tree`);
    }
    for (const o of r.outputs) assert.ok(existsSync(path.join(repoRoot, o)), `${r.rule}: no output at ${o}`);
  }
});

test('npm run build, generate, package and check each run one kind, and artifacts:refresh runs them all', () => {
  for (const kind of KINDS) assert.equal(scripts[kind], `node node/build/commit-rules.mjs --all --kind ${kind}`);
  assert.equal(scripts['artifacts:refresh'], 'node node/build/commit-rules.mjs --all');
});
