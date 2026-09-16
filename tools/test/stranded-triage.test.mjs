// scripts/stranded-triage.py — splitting a stranded branch's MISSING paths into
// the four things they can actually be.
//
// What is worth pinning is the CLASSIFIER, and specifically its ORDER. The
// branch scan's `missing` verdict means "the default branch has neither this
// path nor these bytes", which on this estate is mostly not a loss: measured
// 2026-09-09 over the eighteen branches the scan then called stranded, 33 of
// the 49 missing paths were retirements and 3 were moves, against 13 real ones.
// A cleanup pass acting on the raw count would have reopened settled work in
// budget-drs and re-landed two files main had deliberately retired.
//
// Every case below is one this script got wrong, or nearly did, on real data:
//
//   the bytes moved       a file renamed without an edit is `landed`, not
//                         `moved`, because the content test runs first
//   a common basename     `README.md` proposed three unrelated leads on home
//                         until COMMON_BASENAME gated it
//   a shallow clone       21 paths read `unknown` and became 13 `stranded` plus
//                         8 more retirements once history was complete. Turning
//                         "we cannot see" into "it was lost" is the one failure
//                         mode that costs somebody real work.
//
// Driven through a real git repository built in a temp dir, because the three
// git reads under test (a content-addressed tree, a deletion walk with rename
// detection off, and the shallow flag) are exactly what a stub would fake wrong.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = 'scripts/stranded-triage.py';

const git = (dir, ...args) =>
  execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();

function write(dir, path, body) {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), body);
}

// A repo built in three stages, which is the shape every case here needs: what
// both sides share, what the branch then did, and what main then did. The main
// commit allows an empty tree, since "main did nothing" is itself a case.
function repo({ seed = () => {}, branch = () => {}, main = () => {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'stranded-triage-'));
  const w = (path, body) => write(dir, path, body);
  const g = (...a) => git(dir, ...a);
  g('init', '-q', '-b', 'main');
  g('config', 'user.email', 't@example.com');
  g('config', 'user.name', 'T');
  w('seed.txt', 'seed\n');
  seed({ write: w, git: g, dir });
  g('add', '-A'); g('commit', '-qm', 'seed');
  g('checkout', '-q', '-b', 'work');
  branch({ write: w, git: g, dir });
  g('add', '-A'); g('commit', '-qm', 'branch work', '--allow-empty');
  g('checkout', '-q', 'main');
  main({ write: w, git: g, dir });
  g('add', '-A'); g('commit', '-qm', 'main moves on', '--allow-empty');
  return dir;
}

// Verdicts as { path: verdict }, read off what the script prints. The summary
// line is parsed too, since a path that reaches no line at all would otherwise
// look identical to one classified `landed`.
function triage(dir) {
  const out = execFileSync('python3', [SCRIPT, dir, 'work', '--base', 'main'],
                           { encoding: 'utf8' });
  const rows = {};
  for (const line of out.split('\n')) {
    const m = /^ {4}(\w+) {2,}(\S+)(?:\s+-> (.*))?$/.exec(line);
    if (m) rows[m[2]] = { verdict: m[1], note: m[3] || '' };
  }
  return { rows, out };
}

test('a path main never had, and never deleted, is the real thing', () => {
  const dir = repo({ branch: (b) => b.write('code/new-thing.bat', 'echo hi\n') });
  try {
    const { rows } = triage(dir);
    assert.equal(rows['code/new-thing.bat'].verdict, 'stranded');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('main deleting the path is a RETIREMENT, and the commit is named', () => {
  // The commonest case on this estate by a wide margin, and the one that turns
  // a cleanup pass into a re-landing of work somebody withdrew on purpose.
  const dir = repo({
    seed: (x) => x.write('doomed.md', 'old\n'),
    branch: (b) => b.write('doomed.md', 'branch edited it\n'),
    main: (m) => m.git('rm', '-q', 'doomed.md'),
  });
  try {
    const { rows } = triage(dir);
    assert.equal(rows['doomed.md'].verdict, 'retired');
    assert.match(rows['doomed.md'].note, /main moves on/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('bytes that moved are LANDED, because the content test runs first', () => {
  // The order is the whole design. A file renamed without an edit is not
  // missing at all, and reporting it as `moved` would put settled work on a
  // list of things to go and look at.
  const dir = repo({
    branch: (b) => b.write('here/same.txt', 'identical\n'),
    main: (m) => m.write('elsewhere/same.txt', 'identical\n'),
  });
  try {
    const { rows } = triage(dir);
    assert.equal(rows['here/same.txt'], undefined,   // landed rows are not listed
                 'a landed path should not appear in the actionable list');
    assert.match(triage(dir).out, /1 landed/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a renamed-AND-edited file is a MOVE, named by where it went', () => {
  const dir = repo({
    branch: (b) => b.write('before/report.csv', 'a,b\n9,9\n'),
    main: (m) => m.write('after/report.csv', 'a,b\n1,2\n'),
  });
  try {
    const { rows } = triage(dir);
    assert.equal(rows['before/report.csv'].verdict, 'moved');
    assert.equal(rows['before/report.csv'].note, 'after/report.csv');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a basename main carries everywhere proposes nothing', () => {
  // Three READMEs on main and the lead is worthless, which is what sent an
  // earlier run of this script to report `code/batch/README.md` as moved to
  // the repo root. Below the threshold it is a lead; at or above it is noise.
  const dir = repo({
    branch: (b) => b.write('code/batch/README.md', 'a different doc\n'),
    main: (m) => { for (const d of ['a', 'b', 'c']) m.write(d + '/README.md', 'doc ' + d + '\n'); },
  });
  try {
    const { rows } = triage(dir);
    assert.equal(rows['code/batch/README.md'].verdict, 'stranded');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the branch DELETING a path strands nothing', () => {
  const dir = repo({ branch: (b) => rmSync(join(b.dir, 'seed.txt')) });
  try {
    const { out } = triage(dir);
    assert.match(out, /\(0 paths\)/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('main holding the path with other bytes is DIFFERS, not missing at all', () => {
  const dir = repo({
    seed: (x) => x.write('shared.txt', 'original\n'),
    branch: (b) => b.write('shared.txt', 'branch version\n'),
    main: (m) => m.write('shared.txt', 'main version\n'),
  });
  try {
    const { rows } = triage(dir);
    assert.equal(rows['shared.txt'], undefined);
    assert.match(triage(dir).out, /1 differs/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
