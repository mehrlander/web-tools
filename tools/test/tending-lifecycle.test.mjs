// One finding's life through the real command line (findings.py, note.py)
// against scratch repos, with the browser's fold (lib/kits/findings.js)
// agreeing with the command line's at every step.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot, makeWindow, startAlpine } from './bootstrap.mjs';

const T = mkdtempSync(path.join(tmpdir(), 'tending-life-'));
// The same git everywhere: a machine's global push.negotiate makes a local push
// print a protocol error, and commit signing needs a key a test does not have.
const GIT = { GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'push.negotiate', GIT_CONFIG_VALUE_0: 'false',
              GIT_CONFIG_KEY_1: 'commit.gpgsign', GIT_CONFIG_VALUE_1: 'false',
              GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const sh = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', env: { ...process.env, ...GIT } }).trim();
const repo = (name, files) => {
  const bare = path.join(T, name + '.git'), work = path.join(T, name);
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare], { env: { ...process.env, ...GIT } });
  execFileSync('git', ['init', '-q', '-b', 'main', work], { env: { ...process.env, ...GIT } });
  for (const [f, text] of Object.entries(files)) { mkdirSync(path.dirname(path.join(work, f)), { recursive: true }); writeFileSync(path.join(work, f), text); }
  sh(work, 'add', '-A'); sh(work, 'commit', '-qm', 'seed'); sh(work, 'remote', 'add', 'origin', bare); sh(work, 'push', '-q', 'origin', 'main');
  return work;
};
const activity = { repos: { 'acme/evidence': {
  prReach: '2026-01-01T00:00:00Z',
  openPRs: [{ number: 7, head: 'claude/x', updatedAt: '2026-09-01T00:00:00Z', body: '', draft: true }],
  branchPRs: [],
  scan: { branches: [{ name: 'claude/x', date: '2099-01-01T00:00:00Z', group: 'active' }] },
} } };
const sessions = { rows: [{ id: 'abcd1234', day: '2026-09-29', state: 'done', repos: [{ name: 'evidence', branch: 'claude/x', lines: 5 }] }] };
const store = repo('store', { '.web-tools.json': '{"notes":"notes"}\n', 'notes/.keep': '',
  'state/activity.json': JSON.stringify(activity), 'state/sessions.json': JSON.stringify(sessions) });
const evidence = repo('evidence', { 'docs/a.md': 'first\n' });
const env = { ...process.env, ...GIT, FINDINGS_CHECKOUTS: JSON.stringify({ 'acme/evidence': evidence }) };
const py = (...a) => execFileSync('python3', [path.join(repoRoot, 'skills/tend/findings.py'), '--store', path.join(store, 'notes'), '--author', 'claude/tend', ...a], { encoding: 'utf8', env, cwd: store });
const note = (...a) => execFileSync('python3', [path.join(repoRoot, 'skills/notes/note.py'), '--store', path.join(store, 'notes'), ...a], { encoding: 'utf8', env, cwd: store });
const jfile = (obj) => { const f = path.join(T, 'u' + Math.random().toString(36).slice(2) + '.json'); writeFileSync(f, JSON.stringify(obj)); return f; };
const edit = (text, msg) => { writeFileSync(path.join(evidence, 'docs/a.md'), text); sh(evidence, 'commit', '-qam', msg); sh(evidence, 'push', '-q', 'origin', 'main'); };
const blob = () => sh(evidence, 'rev-parse', 'origin/main:docs/a.md');

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
await startAlpine(window, ['lib/alpine-bundle.js', 'lib/kits/notes.js', 'lib/kits/findings.js']);
const storeNotes = () => sh(store, 'show', 'origin/main:notes/notes.jsonl').split('\n').filter(Boolean).map(l => JSON.parse(l));
const both = (id) => {
  const cli = JSON.parse(py('list', '--all', '--json')).find(f => f.id === id);
  const kit = window.Findings.fold(storeNotes()).find(f => f.id === id);
  assert.equal(kit.status, cli.status, 'kit and CLI disagree on status');
  assert.equal(kit.outstanding, cli.outstanding, 'kit and CLI disagree on outstanding work');
  return cli;
};
const check = (id, ...flags) => JSON.parse(py('check', '--json', ...flags)).find(f => f.id === id);

let id;
const viewWrites = (n) => execFileSync('python3', ['-c', `
import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(repoRoot, 'skills/notes'))})
import note
note.append(${JSON.stringify(store)}, 'notes', json.loads(sys.argv[1]))`, JSON.stringify(n)], { env });
const refused = (u) => {
  try { py('update', id, jfile(u)); } catch (e) { return String(e.stderr || e.message); }
  assert.fail('the update was written');
};
const witness = () => window.Findings.fold(storeNotes()).find(f => f.id === id).witnesses[0];

test('found: open, with work outstanding, every witness holding', () => {
  id = py('add', jfile({
    kind: 'unreached', title: 'A report never reached main',
    subjects: ['acme/evidence@claude/x', 'acme/evidence#7'],
    why: 'Two facts in it are missing from docs/a.md.', next: 'Fold the two facts into docs/a.md.',
    choice: 'Retire the report branch afterwards? I recommend yes.',
    witnesses: [{ ref: 'acme/evidence@main:docs/a.md', sha: blob(), why: 'the doc it was compared against' },
                { ref: 'acme/evidence#7', state: 'open', updated: '2026-09-01T00:00:00Z' }],
  })).split(' ')[0];
  const f = both(id);
  assert.equal(f.status, 'open');
  assert.equal(f.outstanding, true);
  assert.deepEqual(check(id).moved, []);
});

test('a comment changes nothing', () => {
  note('reply', id, 'Looks right to me', '--author', 'mehrlander');
  const f = both(id);
  assert.equal(f.status, 'open');
  assert.equal(f.comments, 1);
});

test('evidence outside the subjects changes, and check names it', () => {
  edit('first\nsecond\n', 'docs: add a second line');
  const c = check(id);
  assert.equal(c.moved.length, 1);
  assert.equal(c.moved[0].ref, 'acme/evidence@main:docs/a.md');
  assert.match(c.moved[0].detail, /docs: add a second line/);
});

test('a step done is progress: settling with an inherited next or choice is refused', () => {
  assert.match(refused({ text: 'Folded the facts in.', finding: { status: 'settled', did: 'Folded the two facts in' } }),
    /settled with work outstanding \(next: .*choice: /);
  assert.match(refused({ text: 'Folded the facts in.', finding: { status: 'settled', did: 'Folded the two facts in', next: '' } }),
    /outstanding \(choice: 'Retire the report branch/);
  py('update', id, jfile({ text: 'Folded the facts in; the branch question remains.',
    finding: { did: 'Folded the two facts into docs/a.md', next: '',
               witnesses: [{ ref: 'acme/evidence@main:docs/a.md', sha: blob() }] } }));
  const f = both(id);
  assert.equal(f.status, 'open', 'the inherited choice keeps it open');
  assert.equal(f.outstanding, true);
});

test('settled once nothing remains; the refreshed witness holds', () => {
  py('update', id, jfile({ text: 'Retired the branch.', finding: { status: 'settled', did: 'Retired the report branch', choice: '' } }));
  const f = both(id);
  assert.equal(f.status, 'settled');
  assert.equal(f.outstanding, false);
  assert.deepEqual(check(id).moved, []);
  assert.match(refused({ text: 'One more thing.', finding: { next: 'Link it from the index.' } }),
    /settled with work outstanding.*status: "open"/s);
});

test('a later change makes the settled finding due, by check and by candidates', () => {
  edit('first\nrewritten\n', 'docs: rewrite the second line');
  const c = check(id);
  assert.equal(c.status, 'settled');
  assert.equal(c.moved.length, 1, 'check reads settled findings by default');
  assert.equal(check(id, '--open'), undefined, '--open leaves settled findings out');
  // The branch this finding names moved after it was assessed (the cache dates
  // it 2099), so candidate selection must not treat it as covered.
  const cand = JSON.parse(py('candidates', '--json')).find(x => x.subjects.includes('acme/evidence@claude/x'));
  assert.equal(cand.covered, id);
  assert.ok(cand.moved, 'a covered subject that moved is due again');
});

test('Handled acknowledges the reviewed change, and only a later change brings it back', () => {
  const seen = { sha: blob() };
  assert.equal(window.Findings.compare(witness(), seen).verdict, 'changed');
  viewWrites(window.Findings.resolution(id, 'Read the rewrite; still fine', 'mehrlander', [window.Findings.ackOf(witness(), seen)]));
  assert.equal(both(id).status, 'resolved');
  assert.deepEqual(check(id).moved, [], 'the command line honours the acknowledgment');
  assert.equal(window.Findings.compare(witness(), seen).verdict, 'ok', 'and so does the view');
  edit('first\nrewritten again\n', 'docs: rewrite it again');
  assert.equal(check(id).moved.length, 1, 'a change after Handled surfaces');
  assert.equal(window.Findings.compare(witness(), { sha: blob() }).verdict, 'changed');
});

test('attention renewed, then the owner resolves it in the shape the view writes', () => {
  py('update', id, jfile({ text: 'The doc was rewritten; the facts need placing again.',
    finding: { status: 'open', next: 'Re-place the two facts in the rewritten doc.', witnesses: [{ ref: 'acme/evidence@main:docs/a.md', sha: blob() }] } }));
  let f = both(id);
  assert.equal(f.status, 'open');
  assert.equal(f.outstanding, true);
  viewWrites(window.Findings.resolution(id, 'Placed them myself', 'mehrlander'));
  f = both(id);
  assert.equal(f.status, 'resolved');
  assert.equal(f.outstanding, false);
});

test('a pull request the crawl cache lacks reads unverifiable on the command line', () => {
  const other = py('add', jfile({
    kind: 'superseded', title: 'An old pull request landed', subjects: ['acme/evidence#99'], why: 'w', evidence: ['merged'],
    witnesses: [{ ref: 'acme/evidence#99', state: 'merged' }, { ref: 'acme/evidence#7', state: 'open', updated: '2026-09-01T00:00:00Z' }],
  })).split(' ')[0];
  const v = check(other).verdicts;
  assert.deepEqual(v.map(x => [x.ref, x.verdict]), [['acme/evidence#99', 'unverifiable'], ['acme/evidence#7', 'ok']]);
  assert.match(v[0].detail, /not in the crawl cache/);
});
