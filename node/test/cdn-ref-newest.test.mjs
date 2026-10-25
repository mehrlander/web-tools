// node/render/cdn.mjs reads a ref where it is newest. A session never moves
// the checkout's local `main`, so a render reading `main` from it showed a
// manifest days old (2026-10-24, the surfacing program's icon).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveCdn, REPO } from '../render/cdn.mjs';

// A repo whose `main` and `origin/main` hold different copies of a.txt.
function repo(localIsBehind) {
  const root = mkdtempSync(path.join(tmpdir(), 'cdn-ref-'));
  const git = (...a) => spawnSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  writeFileSync(path.join(root, 'a.txt'), 'old\n'); git('add', 'a.txt'); git('commit', '-qm', 'old');
  const old = git('rev-parse', 'HEAD').stdout.trim();
  writeFileSync(path.join(root, 'a.txt'), 'new\n'); git('commit', '-qam', 'new');
  const fresh = git('rev-parse', 'HEAD').stdout.trim();
  git('update-ref', 'refs/remotes/origin/main', localIsBehind ? fresh : old);
  git('update-ref', 'refs/heads/main', localIsBehind ? old : fresh);
  return root;
}
const read = (root) => {
  const r = resolveCdn(`https://api.github.com/repos/${REPO}/contents/a.txt?ref=main`, root, null, {});
  return Buffer.from(JSON.parse(r.body).content, 'base64').toString();
};

test('a local main behind origin/main reads origin\'s copy', () => {
  assert.equal(read(repo(true)), 'new\n');
});

test('a local ref ahead of origin, with work not yet pushed, reads the local copy', () => {
  assert.equal(read(repo(false)), 'new\n');
});
