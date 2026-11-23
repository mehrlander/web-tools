// findings.py check on a shallow clone: the clone's oldest commit seems to
// touch every file, so a file subject there is unread, and check names the
// clone, rather than reading every file as changed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const T = mkdtempSync(path.join(tmpdir(), 'findings-shallow-'));
const GIT = { GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'push.negotiate', GIT_CONFIG_VALUE_0: 'false',
              GIT_CONFIG_KEY_1: 'commit.gpgsign', GIT_CONFIG_VALUE_1: 'false',
              GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const env = { ...process.env, ...GIT };
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', env }).trim();
const repo = (name, files) => {
  const bare = path.join(T, name + '.git'), work = path.join(T, name);
  git('init', '-q', '--bare', '-b', 'main', bare);
  git('init', '-q', '-b', 'main', work);
  for (const [f, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(work, f)), { recursive: true });
    writeFileSync(path.join(work, f), text);
  }
  git('-C', work, 'add', '-A'); git('-C', work, 'commit', '-qm', 'seed');
  git('-C', work, 'remote', 'add', 'origin', bare); git('-C', work, 'push', '-q', 'origin', 'main');
  return { work, bare };
};

test('a file subject in a shallow clone is unread, and check says so', () => {
  const store = repo('store', { '.web-tools.json': '{"notes":"notes"}\n', 'notes/.keep': '',
    'state/activity.json': '{"repos":{}}', 'state/sessions.json': '{"rows":[]}' });
  const ev = repo('evidence', { 'a.md': 'one\n' });
  const py = (checkout, ...a) => execFileSync('python3', [path.join(repoRoot, 'skills/tend/findings.py'),
    '--store', path.join(store.work, 'notes'), '--author', 'claude/test', ...a],
    { encoding: 'utf8', env: { ...env, FINDINGS_CHECKOUTS: JSON.stringify({ 'acme/evidence': checkout }) }, cwd: store.work });
  const f = path.join(T, 'f.json');
  writeFileSync(f, JSON.stringify({ kind: 'unreached', title: 'A doc lacks two facts', subjects: ['acme/evidence@main:a.md'],
    why: 'w', next: 'Add them.' }));
  py(ev.work, 'add', f);
  // Whole seconds: commit in a later second than the assessment.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1100);
  writeFileSync(path.join(ev.work, 'a.md'), 'two\n');
  git('-C', ev.work, 'commit', '-qam', 'second'); git('-C', ev.work, 'push', '-q', 'origin', 'main');
  const shallow = path.join(T, 'shallow');
  git('clone', '-q', '--depth', '1', 'file://' + ev.bare, shallow);
  assert.equal(git('-C', shallow, 'rev-parse', '--is-shallow-repository'), 'true');

  const [thin] = JSON.parse(py(shallow, 'check', '--json'));
  assert.deepEqual([thin.moved, thin.unread], [[], ['acme/evidence@main:a.md']]);
  assert.match(py(shallow, 'check'), /unread: file subjects in shallow clones of acme\/evidence; run git fetch --unshallow/);
  // The control: a full clone reads the commit.
  const [full] = JSON.parse(py(ev.work, 'check', '--json'));
  assert.deepEqual([full.moved.map(m => m.subject), full.unread], [['acme/evidence@main:a.md'], []]);
});
