// This repo's own prose field names are ones the vocabulary states.
//
// text-fields-registry.test.mjs holds the vocabulary's shape; this holds the
// repo to it. The two fail differently and both matter: one catches a
// vocabulary that has stopped being coherent, this catches a data file that has
// grown a name nobody has accounted for.
//
// Only the UNCLAIMED class is gated, which is the same posture dead-links.py
// takes with its internal class. An alias passes: the vocabulary states what
// the old name means, so a file using it conforms by declaration, and gating
// on aliases would turn every existing file red with a rename across the
// estate as the only route back to green. That is the cost `instead_of` exists
// to avoid.
//
// A failure here is not automatically a mistake. Sometimes a file really has
// found a kind the set lacks, which is how `payload` was added: a tracker
// assessment's `prompt` column holds a session instruction, so the row exists to
// carry the text rather than to describe something else it holds, and no
// existing name meant that. The fix is then a thirteenth name and a moved count
// in the registry test, not an alias to something it is not.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';


test('every prose field name in this repo is one the vocabulary accounts for', () => {
  let out = '';
  let failed = false;
  try {
    out = execFileSync('python3',
      [path.join(repoRoot, 'python', 'text-carriers.py'), repoRoot, '--check'],
      { encoding: 'utf8', cwd: repoRoot });
  } catch (e) {
    failed = true;
    out = (e.stdout || '') + (e.stderr || '');
  }
  assert.ok(!failed,
    'text-carriers.py --check failed. Either a data file grew a field name nothing ' +
    'accounts for (see: python3 python/text-carriers.py . --offvocab), or an ' +
    'authored data file is named nowhere in the repo. Tail of the run:\n' +
    out.split('\n').slice(-8).join('\n'));
});

// The gate itself: a temp git repo holding a copy of the vocabulary, a CSV with
// one prose column, and a README that names both CSVs (so neither is undeclared).
const checkFixture = (column) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'text-carriers-'));
  try {
    fs.mkdirSync(path.join(dir, 'docs'));
    fs.copyFileSync(path.join(repoRoot, 'docs', 'text-fields.csv'), path.join(dir, 'docs', 'text-fields.csv'));
    const sentence = 'This sentence is long enough to count as prose for the scan';
    fs.writeFileSync(path.join(dir, 'items.csv'),
      `id,${column}\n` + [1, 2, 3].map(i => `${i},${sentence} number ${'x'.repeat(i).replace(/x/g, 'ly')}`).join('\n') + '\n');
    fs.writeFileSync(path.join(dir, 'README.md'), 'The rows live in items.csv, over docs/text-fields.csv.\n');
    const git = (...a) => execFileSync('git', ['-C', dir, ...a], { stdio: 'ignore' });
    git('init', '-q'); git('add', '-A');
    return spawnSync('python3',
      [path.join(repoRoot, 'python', 'text-carriers.py'), dir, '--check'], { encoding: 'utf8' });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};

test('--check fails on a prose column the vocabulary does not account for', () => {
  const r = checkFixture('zzqwidget');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /prose field name\(s\) the vocabulary does not account for/);
});

test('--check passes a prose column that is an alias the vocabulary maps', () => {
  const r = checkFixture('blurb');
  assert.equal(r.status, 0, r.stdout);
});
