// scripts/derived-csv-merge.mjs: the merge driver that stops two branches
// conflicting on a number neither of them wrote.
//
// Driven as git drives it, by spawning the real script over three temp files
// and reading the exit code, because the exit code IS the contract: 0 means
// resolved and git takes the file, anything else means git reports an ordinary
// conflict. Every case this file cannot fully understand has to land on the
// second, so most of what is asserted below is the refusals.
//
// The cases use the REAL `docs` registry rather than a fixture one, so the
// declaration the driver trusts is the one the repo actually ships: in
// docs/properties.csv, `words` and `reach` are computed and `subject`,
// `status`, `maintenance` and `formerly` are recorded. If that ever flips, this
// file should fail, because the driver's safety is exactly that declaration.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv, writeCsv } from '../build/registries-load.mjs';

const DRIVER = path.join(repoRoot, 'scripts/derived-csv-merge.mjs');
const HEAD = 'path,subject,status,reach,words,maintenance,formerly';

const csv = (...rows) => [HEAD, ...rows].join('\n') + '\n';
const row = (p, subject = 's', words = '100', maintenance = 'm') =>
  `${p},${subject},living,app,${words},${maintenance},`;

// Run the driver over three sides, as git would, and hand back what it decided.
function merge(base, ours, theirs, file = 'docs/docs.csv') {
  const dir = mkdtempSync(path.join(tmpdir(), 'dcm-'));
  try {
    const w = (n, t) => { const f = path.join(dir, n); writeFileSync(f, t); return f; };
    const oursPath = w('ours', ours);
    const r = spawnSync(process.execPath, [DRIVER, w('base', base), oursPath, w('theirs', theirs), file],
      { cwd: repoRoot, encoding: 'utf8' });
    return { code: r.status, out: readFileSync(oursPath, 'utf8'), err: r.stderr };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const cellOf = (out, key, col) => {
  const cols = out.split('\n')[0].split(',');
  const line = out.split('\n').find(l => l.startsWith(key + ','));
  return line ? line.split(',')[cols.indexOf(col)] : undefined;
};

test('a computed cell differing on all three sides resolves instead of conflicting', () => {
  // This is the exact shape that cost two silent CI runs: each branch restamped
  // the same word count against its own tree, so base, ours and theirs all
  // differ on a line no human touched.
  const r = merge(csv(row('docs/a.md', 's', '47241')),
                  csv(row('docs/a.md', 's', '47300')),
                  csv(row('docs/a.md', 's', '47551')));
  assert.equal(r.code, 0, r.err);
  assert.equal(cellOf(r.out, 'docs/a.md', 'words'), '47300', 'ours stands until the deriver restamps it');
});

test('an authored cell changed on both sides differently is refused, not picked', () => {
  const r = merge(csv(row('docs/a.md', 'the original')),
                  csv(row('docs/a.md', 'what we say')),
                  csv(row('docs/a.md', 'what they say')));
  assert.equal(r.code, 1, 'a person wrote both of those sentences and no rule here can choose');
  assert.match(r.err, /authored cell/);
});

test('an authored cell changed on one side only takes that side', () => {
  const edited = merge(csv(row('docs/a.md', 'before')),
                       csv(row('docs/a.md', 'after')),
                       csv(row('docs/a.md', 'before')));
  assert.equal(edited.code, 0, edited.err);
  assert.equal(cellOf(edited.out, 'docs/a.md', 'subject'), 'after');

  const theirs = merge(csv(row('docs/a.md', 'before')),
                       csv(row('docs/a.md', 'before')),
                       csv(row('docs/a.md', 'theirs now')));
  assert.equal(theirs.code, 0, theirs.err);
  assert.equal(cellOf(theirs.out, 'docs/a.md', 'subject'), 'theirs now',
    'the other side wins just as readily; there is no home-side preference');
});

test('rows added on both sides are unioned, which is the half a take-ours would lose', () => {
  const r = merge(csv(row('docs/a.md')),
                  csv(row('docs/a.md'), row('docs/ours.md', 'ours only')),
                  csv(row('docs/a.md'), row('docs/theirs.md', 'theirs only')));
  assert.equal(r.code, 0, r.err);
  assert.equal(cellOf(r.out, 'docs/ours.md', 'subject'), 'ours only');
  assert.equal(cellOf(r.out, 'docs/theirs.md', 'subject'), 'theirs only',
    'SNAGS merge-drops-authored-csv-cells is exactly this row going missing');
});

test('a row deleted on one side and untouched on the other stays deleted', () => {
  const r = merge(csv(row('docs/a.md'), row('docs/gone.md')),
                  csv(row('docs/a.md')),
                  csv(row('docs/a.md'), row('docs/gone.md')));
  assert.equal(r.code, 0, r.err);
  assert.equal(cellOf(r.out, 'docs/gone.md', 'subject'), undefined);
});

test('a row deleted on one side and edited on the other is refused', () => {
  const r = merge(csv(row('docs/a.md'), row('docs/x.md', 'was')),
                  csv(row('docs/a.md')),
                  csv(row('docs/a.md'), row('docs/x.md', 'now edited')));
  assert.equal(r.code, 1);
});

test('a header disagreement is refused, since a schema is a decision', () => {
  const r = merge(csv(row('docs/a.md')), csv(row('docs/a.md')),
                  'path,subject,status,reach,words,maintenance,formerly,extra\n');
  assert.equal(r.code, 1);
  assert.match(r.err, /header/);
});

test('a duplicate key is refused, since the row merge would rest on nothing', () => {
  const dupe = csv(row('docs/a.md'), row('docs/a.md', 'again'));
  const r = merge(csv(row('docs/a.md')), dupe, csv(row('docs/a.md')));
  assert.equal(r.code, 1);
  assert.match(r.err, /unique/);
});

test('a path that is not a declared registry is refused', () => {
  const r = merge(csv(row('docs/a.md')), csv(row('docs/a.md')), csv(row('docs/a.md')), 'docs/not-a-registry.csv');
  assert.equal(r.code, 1);
  assert.match(r.err, /not a registry/);
});

test('every attributed path is a registry the driver can actually resolve', () => {
  // .gitattributes naming a file the driver refuses would be worse than not
  // naming it: the refusal is silent in a merge, and the conflict comes back
  // looking like the driver was never there.
  const attrs = readFileSync(path.join(repoRoot, '.gitattributes'), 'utf8')
    .split('\n').filter(l => l.includes('merge=derived-csv'))
    .map(l => l.split(/\s+/)[0]);
  assert.ok(attrs.length >= 10, 'the attribute file still names the registries');

  const reg = Object.fromEntries(readFileSync(path.join(repoRoot, 'docs/registries.csv'), 'utf8')
    .split('\n').slice(1).filter(Boolean).map(l => [l.split(',')[1], l.split(',')[2]]));
  for (const p of attrs) {
    assert.ok(reg[p], `${p} carries the attribute but is not in docs/registries.csv`);
    assert.ok(reg[p].trim(), `${p} is a registry with no declared key, so the driver would refuse it`);
  }
});

test('the driver writes each attributed file exactly as its deriver does', () => {
  // The driver rewrites the whole file when it resolves one, so its writer has
  // to agree with the generators' byte for byte. If it did not, every resolved
  // merge would land a whole-file reformat in the diff and then fight the next
  // restamp. Both sides already use writeCsv from registries-load, and this is
  // what holds them there.
  const attrs = readFileSync(path.join(repoRoot, '.gitattributes'), 'utf8')
    .split('\n').filter(l => l.includes('merge=derived-csv')).map(l => l.split(/\s+/)[0]);

  for (const f of attrs) {
    const orig = readFileSync(path.join(repoRoot, f), 'utf8');
    const cols = orig.split(/\r?\n/)[0].split(',').map(c => c.replace(/^"|"$/g, ''));
    assert.equal(writeCsv(parseCsv(orig), cols), orig, `${f} would be reformatted by a resolved merge`);
  }
});
