// python/probes.py: the probe registries a repository keeps beside the probe
// folders it declares in `.web-tools.json` `research` (contract: docs/probes.md).
// Fixture repositories only; the consumers check their own registries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const script = path.join(repoRoot, 'python/probes.py');
const run = (root, ...args) => spawnSync('python3', [script, '--root', root, ...args],
  { cwd: repoRoot, encoding: 'utf8' });
const HEAD = 'probe,date,title,path,question,summary,standing,bundle';

function fixture(t, rows) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'probes-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(path.join(root, '.web-tools.json'), JSON.stringify({ research: [
    { path: 'probes/README.md', label: 'Probes', kind: 'probe' },
    { path: 'one/README.md', label: 'A single probe', kind: 'probe' },
    { path: 'out/README.md', label: 'Gathered', kind: 'exploration' },
  ] }) + '\n');
  put(root, 'probes/README.md', '# Probes\n');
  put(root, 'probes/2026-01-02-tie.md', '# Tie\n');
  put(root, 'probes/2026-01-05-model/FINDINGS.md', '# Model\n');
  if (rows) put(root, 'probes/probes.csv', [HEAD, ...rows].join('\n') + '\n');
  return root;
}
function put(root, rel, text) {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}
const GOOD = [
  '2026-01-02-tie,2026-01-02,Tie,2026-01-02-tie.md,Does it tie?,Yes.,worked,',
  '2026-01-05-model,2026-01-05,Model,2026-01-05-model/FINDINGS.md,"Does the model hold, row by row?",Mostly.,mixed,source/b',
  'no-write-up,2026-01-07,No write-up,,Is a row enough?,It is.,,',
];

test('a registry that names every dated probe passes, and extra columns ride along', t => {
  const r = run(fixture(t, GOOD));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /probes\/ ok, 3 probes/);
  assert.match(r.stdout, /1 declared probe README\(s\) with no probes\.csv beside them/);
});

test('each broken rule is named with its row', t => {
  const r = run(fixture(t, [
    '2026-01-02-tie,2026-01-03,Tie,2026-01-02-tie.md,Does it tie?,Yes.,won,',
    '2026-01-02-tie,2026-01-02,,missing.md,Again?,No.,,',
    'Bad_Id,2026-1-5,Bad,,Q?,A.,,',
  ]));
  assert.equal(r.status, 1);
  for (const want of [
    /probes\.csv:2: probe 2026-01-02-tie is dated 2026-01-02, not 2026-01-03/,
    /probes\.csv:2: path 2026-01-02-tie\.md is dated 2026-01-02, not 2026-01-03/,
    /probes\.csv:2: standing won is not one of failed, mixed, open, worked/,
    /probes\.csv:3: 2026-01-02-tie is listed twice/,
    /probes\.csv:3: title is empty/,
    /probes\.csv:3: path missing\.md names nothing in the folder/,
    /probes\.csv:4: Bad_Id is not lowercase letters, digits and hyphens/,
    /probes\.csv:4: date 2026-1-5 is not YYYY-MM-DD/,
    /2026-01-05-model is a dated probe that no row's path names/,
  ]) assert.match(r.stdout, want);
});

test('a missing required column stops the rows being read', t => {
  const root = fixture(t);
  put(root, 'probes/probes.csv', 'probe,date,title,path,question\n');
  const r = run(root);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /probes\.csv has no summary column/);
});

test('a declared folder without a registry is counted, not failed', t => {
  const r = run(fixture(t));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /2 declared probe README\(s\) with no probes\.csv beside them/);
});

test('--new writes the required header and refuses to overwrite', t => {
  const root = fixture(t);
  assert.equal(run(root, '--new', 'fresh').status, 0);
  assert.equal(readFileSync(path.join(root, 'fresh/probes.csv'), 'utf8'), 'probe,date,title,question,summary\n');
  assert.equal(run(root, '--new', 'fresh').status, 1);
});
