// tools/test/anchors.test.mjs
// scripts/annotate/anchors.py: the annotations that point into a document,
// checked against it, driven against two throwaway checkouts side by side, as
// the estate's are: a document repo holding a standoff, and a notes store whose
// notes quote passages of that document.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const ANCHORS = path.join(repoRoot, 'scripts', 'annotate', 'anchors.py');
const ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8' });

const tmp = mkdtempSync(path.join(tmpdir(), 'anchors-'));
const repo = (name, files) => {
  const d = path.join(tmp, name);
  mkdirSync(d);
  git(d, 'init', '-q', '-b', 'main');
  git(d, 'remote', 'add', 'origin', `https://github.com/o/${name}.git`);
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(d, p)), { recursive: true });
    writeFileSync(path.join(d, p), text);
  }
  git(d, 'add', '.');
  git(d, 'commit', '-qm', 'init');
  return d;
};

// Four sentences, one said twice, so a quote of it needs its context.
const S = ['Close the lid, because the contents spoil.', 'Check it twice.', 'An aside that will go.', 'Check it twice.'];
const DOC = S.join('\n\n') + '\n';
const spans = [];
for (let i = 0, at = 0; i < S.length; at += S[i].length + 2, i++) spans.push([at, at + S[i].length]);
const standoff = {
  kind: 'standoff/1', self: { repo: 'o/doc', path: 'runs/x/standoff.json' },
  target: { path: 'doc.md', sha256: createHash('sha256').update(DOC).digest('hex') },
  units: spans.map(([start, end], i) => ({ uid: 'u-' + i, start, end, kind: 'sent' })),
};
const doc = repo('doc', { 'doc.md': DOC, 'other.md': 'A line nobody edits.\n', 'runs/x/standoff.json': JSON.stringify(standoff) });

const note = (id, about, exact, prefix = '', suffix = '') =>
  ({ id, at: '2026-10-06T00:00:00Z', author: 'me', about, text: 'a note', anchor: { exact, prefix, suffix } });
const NOTES = [
  note('n1', 'o/doc:doc.md', S[0]),
  note('n2', 'o/doc:doc.md', S[1], 'contents spoil.\n\n', '\n\nAn aside'),
  note('n3', 'o/doc:other.md', 'A line nobody edits.'),
  note('n4', 'o/absent:x.md', 'Anything.'),
  note('n6', 'o/doc:gone.md', 'Never there.'),
  { id: 'n5', at: '2026-10-06T00:00:00Z', author: 'me', about: 'o/doc:doc.md', text: 'about the whole file, no quote' },
];
repo('store', { '.web-tools.json': '{"notes": "notes"}\n', 'notes/notes.jsonl': NOTES.map((n) => JSON.stringify(n)).join('\n') + '\n' });

const run = (...args) => spawnSync('python3', [ANCHORS, ...args], { cwd: doc, env: ENV, encoding: 'utf8' });
const rows = (...args) => {
  const r = run('--json', ...args);
  assert.equal(r.status, 0, r.stderr);
  return Object.fromEntries(r.stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .map((x) => [x.kind === 'note' ? x.what.split(' ')[1] : 'standoff', x]));
};

test('every quote and the standoff are checked against the document as it stands', () => {
  const r = rows();
  assert.equal(r.n1.verdict, 'ok');
  assert.match(r.n1.detail, /found once, line 1/);
  assert.equal(r.n2.verdict, 'ok');
  assert.match(r.n2.detail, /found 2 times; its context picks line 3/, 'a repeated quote is placed by its context');
  assert.equal(r.n3.verdict, 'ok');
  assert.equal(r.n4.verdict, 'unverifiable', 'a repo not checked out is not called broken');
  assert.match(r.n4.detail, /o\/absent is not checked out/);
  assert.equal(r.n6.verdict, 'broken');
  assert.match(r.n6.detail, /the file is gone/);
  assert.equal(r.standoff.verdict, 'ok', 'the target still hashes to the pinned sha256');
  assert.equal('n5' in r, false, 'a note with no quote points at no passage');
  assert.equal(run().status, 0, 'a report, not a gate');
  assert.equal(run('--strict').status, 1, 'unless asked to be one');
});

test('an edit to the document shows which annotations no longer line up', () => {
  writeFileSync(path.join(doc, 'doc.md'), DOC.replace('because', 'since').replace(S[2] + '\n\n', ''));
  const r = rows();
  assert.equal(r.n1.verdict, 'changed', 'the quoted words were edited');
  assert.match(r.n1.detail, /edited; the closest passage is line 1, \d+% alike/);
  assert.equal(r.n2.verdict, 'ok', 'an edit elsewhere leaves a quote alone');
  assert.equal(r.standoff.verdict, 'changed');
  assert.match(r.standoff.detail, /its target changed since it was annotated/);
});

test('at commit, only what the commit changes is checked, against the staged text, and only trouble is printed', () => {
  assert.equal(run('--staged').stdout, '', 'nothing staged, nothing to say');
  git(doc, 'add', 'doc.md');
  const r = rows('--staged');
  assert.deepEqual(Object.keys(r).sort(), ['n1', 'standoff'], 'not the ok quote, not other files, not other repos');
  assert.match(r.standoff.detail, /3 of 4 units are found again, 1 would need annotating again \(scripts\/annotate\/reanchor\.py\)/,
    'the standoff is re-anchored from HEAD to the staged text');
  const plain = run('--staged');
  assert.equal(plain.status, 0, 'the hook warns and never blocks');
  assert.match(plain.stdout, /2 annotation\(s\) point into what this commit changes/);
  git(doc, 'commit', '-qm', 'edit');
});

test('a file renamed in the commit leaves its quotes pointing at nothing, and says where it went', () => {
  git(doc, 'mv', 'other.md', 'moved.md');
  const r = rows('--staged');
  assert.equal(r.n3.verdict, 'broken');
  assert.match(r.n3.detail, /renamed to moved\.md/);
  git(doc, 'commit', '-qm', 'move');
});
