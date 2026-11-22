// .githooks/pre-commit: a rule that writes under docs/ runs before rule
// docs-reach, which stamps every docs/ file's word count into docs/docs.csv
// (node/README.md, "The refresh model"). Rule themes-graph ran after it, and the
// only later restamp runs on a change to docs/docs.csv, so a
// commit whose only change was markdown outside skills/, lib/, pages/ and docs/
// rewrote docs/themes.csv and left its count stale until CI said so (snag
// themes-graph-runs-after-the-word-stamp, seen three times).
//
// The real hook and its rules run here in a scratch repository, with npm and
// python3 stubbed: npm logs each script it is asked to run, and its
// themes-graph adds a row to docs/themes.csv as the real generator would. What
// is asserted is the order the hook ran them in.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, chmodSync, rmSync, appendFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });

test('a markdown-only commit that moves docs/themes.csv restamps docs/docs.csv after it', () => {
  const box = mkdtempSync(path.join(tmpdir(), 'hook-order-'));
  try {
    const root = path.join(box, 'repo');
    for (const f of ['.githooks/pre-commit', 'docs/commit-rules.csv', 'node/build/commit-rules.mjs',
      'node/build/registries-load.mjs', 'node/build/kit-shim.mjs', 'node/repo-root.mjs', 'lib/kits/csv.js']) {
      mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
      copyFileSync(path.join(repoRoot, f), path.join(root, f));
    }
    mkdirSync(path.join(root, 'notes'));
    writeFileSync(path.join(root, 'docs/themes.csv'), 'a,b,weight\n');
    writeFileSync(path.join(root, 'docs/docs.csv'), 'path,words\ndocs/themes.csv,1\n');
    writeFileSync(path.join(root, 'notes/n.md'), '# A note\n');
    git(root, 'init', '-q');
    git(root, 'add', '.');
    git(root, '-c', 'user.name=Hook test', '-c', 'user.email=hook@example.test', '-c', 'commit.gpgsign=false',
      '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture');

    // The change: one markdown file outside every folder docs-reach watches.
    appendFileSync(path.join(root, 'notes/n.md'), 'A second line.\n');
    git(root, 'add', 'notes/n.md');

    const bin = path.join(box, 'bin');
    const log = path.join(box, 'ran.log');
    mkdirSync(bin);
    writeFileSync(path.join(bin, 'npm'), [
      '#!/bin/sh',
      `echo "$2" >> '${log}'`,
      'if [ "$2" = themes-graph ]; then echo "notes/n.md,docs/x.md,2" >> docs/themes.csv; fi',
      'exit 0', ''].join('\n'));
    writeFileSync(path.join(bin, 'python3'), '#!/bin/sh\nexit 0\n');
    chmodSync(path.join(bin, 'npm'), 0o755);
    chmodSync(path.join(bin, 'python3'), 0o755);
    const env = { ...process.env };
    const pathKey = Object.keys(env).find(k => k.toLowerCase() === 'path') || 'PATH';
    env[pathKey] = bin + path.delimiter + env[pathKey];

    const r = spawnSync('bash', ['.githooks/pre-commit'], { cwd: root, env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr || r.error?.message);
    const ran = readFileSync(log, 'utf8').split('\n').filter(Boolean);
    const themes = ran.indexOf('themes-graph');
    assert.ok(themes >= 0, 'the markdown change ran the theme graph: ' + ran.join(', '));
    assert.ok(ran.lastIndexOf('docs-reach') > themes,
      'and the word stamp ran after it rewrote docs/themes.csv: ' + ran.join(', '));
    assert.match(git(root, 'diff', '--cached', '--name-only'), /docs\/themes\.csv/, 'the new graph is staged');
  } finally { rmSync(box, { recursive: true, force: true }); }
});
