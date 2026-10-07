// findings.py check on a shallow clone: a pinned commit the clone never
// fetched reads as unverifiable, naming the clone, rather than as broken.
// On 2026-10-06 a session's shallow checkouts turned six witnesses on two
// settled findings into "the ref or commit is gone" (docs/SNAGS.md
// shallow-clone-reads-as-gone).
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

test('a commit a shallow clone never fetched is unverifiable, not gone', () => {
  const store = repo('store', { '.web-tools.json': '{"notes":"notes"}\n', 'notes/.keep': '',
    'state/activity.json': '{"repos":{}}', 'state/sessions.json': '{"rows":[]}' });
  const ev = repo('evidence', { 'a.md': 'one\n' });
  const first = git('-C', ev.work, 'rev-parse', 'HEAD');
  writeFileSync(path.join(ev.work, 'a.md'), 'two\n');
  git('-C', ev.work, 'commit', '-qam', 'second'); git('-C', ev.work, 'push', '-q', 'origin', 'main');
  const shallow = path.join(T, 'shallow');
  git('clone', '-q', '--depth', '1', 'file://' + ev.bare, shallow);
  assert.equal(git('-C', shallow, 'rev-parse', '--is-shallow-repository'), 'true');

  const py = (checkout, ...a) => execFileSync('python3', [path.join(repoRoot, 'skills/tend/findings.py'),
    '--store', path.join(store.work, 'notes'), '--author', 'claude/test', ...a],
    { encoding: 'utf8', env: { ...env, FINDINGS_CHECKOUTS: JSON.stringify({ 'acme/evidence': checkout }) }, cwd: store.work });
  const f = path.join(T, 'f.json');
  writeFileSync(f, JSON.stringify({ kind: 'superseded', title: 'Landed', subjects: ['acme/evidence'], why: 'It landed.',
    evidence: ['first commit is on main'], witnesses: [{ ref: 'acme/evidence@main', contains: first, why: 'the landing' }] }));
  py(shallow, 'add', f);

  const verdict = (checkout) => JSON.parse(py(checkout, 'check', '--json'))[0].verdicts[0];
  const thin = verdict(shallow);
  assert.equal(thin.verdict, 'unverifiable');
  assert.match(thin.detail, /shallow clone/);
  // The control: a full clone sees the same commit and holds.
  assert.equal(verdict(ev.work).verdict, 'ok');
});
