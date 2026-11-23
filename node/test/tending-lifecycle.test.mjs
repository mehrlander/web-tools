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
  scan: { branches: [{ name: 'claude/x', date: '2026-09-01T00:00:00Z', group: 'active' }] },
} } };
const SID = 'mehrlander/web-tools-private:sessions/2026/09/2026-09-29-abcd1234.json';
const sessions = { rows: [{ id: 'abcd1234', day: '2026-09-29', state: 'done', repos: [{ name: 'evidence', branch: 'claude/x', lines: 5 }] }] };
const store = repo('store', { '.web-tools.json': '{"notes":"notes"}\n', 'notes/.keep': '',
  'state/activity.json': JSON.stringify(activity), 'state/sessions.json': JSON.stringify(sessions) });
const evidence = repo('evidence', { 'docs/a.md': 'first\n' });
const env = { ...process.env, ...GIT, FINDINGS_CHECKOUTS: JSON.stringify({ 'acme/evidence': evidence }) };
const py = (...a) => execFileSync('python3', [path.join(repoRoot, 'skills/tend/findings.py'), '--store', path.join(store, 'notes'), '--author', 'claude/tend', ...a], { encoding: 'utf8', env, cwd: store });
const note = (...a) => execFileSync('python3', [path.join(repoRoot, 'skills/notes/note.py'), '--store', path.join(store, 'notes'), ...a], { encoding: 'utf8', env, cwd: store });
const jfile = (obj) => { const f = path.join(T, 'u' + Math.random().toString(36).slice(2) + '.json'); writeFileSync(f, JSON.stringify(obj)); return f; };
// Times are whole seconds, and a commit in the second a finding was assessed
// is not after it: wait out the second before committing.
const tick = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
const edit = (text, msg) => { tick(); writeFileSync(path.join(evidence, 'docs/a.md'), text); sh(evidence, 'commit', '-qam', msg); sh(evidence, 'push', '-q', 'origin', 'main'); };
const commitState = (file, data, msg) => {
  sh(store, 'pull', '-q', '--rebase', 'origin', 'main');
  writeFileSync(path.join(store, 'state', file), JSON.stringify(data));
  sh(store, 'commit', '-qam', msg); sh(store, 'push', '-q', 'origin', 'main');
};
const setActivity = (change, msg) => { change(activity.repos['acme/evidence']); commitState('activity.json', activity, msg); };

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
await startAlpine(window, ['lib/alpine-bundle.js', 'lib/kits/notes.js', 'lib/kits/findings.js']);
const storeNotes = () => sh(store, 'show', 'origin/main:notes/notes.jsonl').split('\n').filter(Boolean).map(l => JSON.parse(l));
const both = (id) => {
  const cli = JSON.parse(py('list', '--all', '--json')).find(f => f.id === id);
  const kit = window.Findings.fold(storeNotes()).find(f => f.id === id);
  assert.equal(kit.status, cli.status, 'kit and CLI disagree on status');
  assert.equal(kit.outstanding, cli.outstanding, 'kit and CLI disagree on outstanding work');
  assert.equal(kit.assessedAt, cli.assessedAt, 'kit and CLI disagree on the last assessment');
  return cli;
};
const check = (id) => JSON.parse(py('check', '--json')).find(f => f.id === id);
const moved = (id) => check(id).moved.map(m => m.subject);
const candidate = () => JSON.parse(py('candidates', '--json')).find(x => x.subjects.includes('acme/evidence@claude/x'));

let id;
const viewWrites = (n) => execFileSync('python3', ['-c', `
import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(repoRoot, 'skills/notes'))})
import note
note.append(${JSON.stringify(store)}, 'notes', json.loads(sys.argv[1]))`, JSON.stringify(n)], { env });
const refused = (u) => {
  try { py('update', id, jfile(u)); } catch (e) { return String(e.stderr || e.message); }
  assert.fail('the update was written');
};
const DOC = 'acme/evidence@main:docs/a.md';

test('found: open, with work outstanding, and nothing it names changed since', () => {
  id = py('add', jfile({
    kind: 'unreached', title: 'A report never reached main',
    subjects: ['acme/evidence@claude/x', 'acme/evidence#7', DOC],
    why: 'Two facts in it are missing from docs/a.md.', next: 'Fold the two facts into docs/a.md.',
  })).split(' ')[0];
  const f = both(id);
  assert.equal(f.status, 'open');
  assert.equal(f.outstanding, true);
  assert.deepEqual(check(id).moved, []);
  assert.equal(candidate().covered, id);
  assert.equal(candidate().moved, '');
});

test('a comment changes nothing', () => {
  note('reply', id, 'Looks right to me', '--author', 'mehrlander');
  const f = both(id);
  assert.equal(f.status, 'open');
  assert.equal(f.comments, 1);
});

test('a file the finding names is committed to, check names it, and a confirmation clears it', () => {
  edit('first\nsecond\n', 'docs: add a second line');
  assert.deepEqual(moved(id), [DOC]);
  py('update', id, jfile({ text: 'The second line is unrelated; the finding stands.', finding: {} }));
  assert.deepEqual(check(id).moved, []);
  assert.equal(both(id).next, 'Fold the two facts into docs/a.md.');
});

test('a step done is progress: settling with an inherited next is refused, and the update is a reassessment', () => {
  assert.match(refused({ text: 'Folded the facts in.', finding: { status: 'settled', did: 'Folded the two facts in' } }),
    /settled with work outstanding \(next: 'Fold the two facts/);
  py('update', id, jfile({ text: 'Folded the facts in; the branch remains.',
    finding: { did: 'Folded the two facts into docs/a.md', next: 'Retire the report branch.' } }));
  const f = both(id);
  assert.equal(f.status, 'open', 'the step that remains keeps it open');
  assert.equal(f.outstanding, true);
  assert.deepEqual(check(id).moved, [], 'the commit came before this assessment');
});

test('a finding never asks: the decision goes to the owner in the reply', () => {
  assert.match(refused({ text: 'One question.', finding: { choice: 'Retire the branch?' } }), /put the decision to the owner in the reply/);
  py('update', id, jfile({ text: 'Retiring the branch needs the owner\'s word.',
    finding: { kind: 'answer', subjects: ['acme/evidence@claude/x', 'acme/evidence#7', DOC, 'acme/store:user-calls/abcd1234-retire-x.json'] } }));
  assert.equal(both(id).status, 'open');
});

test('settled once nothing remains, and check reads open findings only', () => {
  py('update', id, jfile({ text: 'Retired the branch.', finding: { status: 'settled', did: 'Retired the report branch', next: '' } }));
  const f = both(id);
  assert.equal(f.status, 'settled');
  assert.equal(f.outstanding, false);
  assert.equal(check(id), undefined);
  assert.match(refused({ text: 'One more thing.', finding: { next: 'Link it from the index.' } }),
    /settled with work outstanding.*status: "open"/s);
});

test('a settled finding comes back through candidates when the branch it names is pushed', () => {
  edit('first\nrewritten\n', 'docs: rewrite the second line');
  assert.equal(candidate().moved, '', 'a change to a file alone raises no candidate');
  setActivity(e => { e.scan.branches[0].date = '2099-01-01T00:00:00Z'; }, 'the branch moved');
  assert.equal(candidate().covered, id);
  assert.ok(candidate().moved, 'a covered branch that moved is due again');
});

test('attention renewed, then the owner resolves it in the shape the view writes', () => {
  py('update', id, jfile({ text: 'The branch moved; the facts need placing again.',
    finding: { status: 'open', next: 'Re-place the two facts in the rewritten doc.' } }));
  let f = both(id);
  assert.equal(f.status, 'open');
  assert.equal(f.outstanding, true);
  viewWrites(window.Findings.resolution(id, 'Placed them myself', 'mehrlander'));
  f = both(id);
  assert.equal(f.status, 'resolved');
  assert.equal(f.outstanding, false);
});

test('a pull request the finding names, updated after the assessment, is named by check', () => {
  const pr = py('add', jfile({
    kind: 'unreached', title: 'A pull request nobody moves', subjects: ['acme/evidence#7'], why: 'w', next: 'Ask the owner.',
  })).split(' ')[0];
  assert.deepEqual(check(pr).moved, []);
  setActivity(e => { e.openPRs[0].updatedAt = '2099-01-01T00:00:00Z'; }, 'the pull request moved');
  assert.deepEqual(moved(pr), ['acme/evidence#7']);
  // A pull request the crawl cache does not hold raises nothing.
  const gone = py('add', jfile({ kind: 'unreached', title: 'An old pull request', subjects: ['acme/evidence#99'], why: 'w', next: 'n' })).split(' ')[0];
  assert.deepEqual(check(gone).moved, []);
});

test('a finding that shares only the session record covers no candidate', () => {
  // The same session left a second branch that no finding names.
  setActivity(e => { e.scan.branches.push({ name: 'claude/y', date: '2026-09-02T00:00:00Z', group: 'active' }); }, 'a second branch');
  sessions.rows[0].repos.push({ name: 'evidence', branch: 'claude/y', lines: 3 });
  commitState('sessions.json', sessions, 'the session record names it');
  py('add', jfile({ kind: 'unreached', title: 'The session left work', subjects: [SID], why: 'w', next: 'n' }));
  const y = JSON.parse(py('candidates', '--json')).find(x => x.subjects.includes('acme/evidence@claude/y'));
  assert.ok(y.subjects.includes(SID));
  assert.equal(y.covered, '');
});
