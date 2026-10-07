// skills/tend/branches.py: the tend skill's branch classes, one fixture branch
// for each, through the real command line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const T = mkdtempSync(path.join(tmpdir(), 'tend-branches-'));
const GIT = { GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'push.negotiate', GIT_CONFIG_VALUE_0: 'false',
              GIT_CONFIG_KEY_1: 'commit.gpgsign', GIT_CONFIG_VALUE_1: 'false',
              GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const env = { ...process.env, ...GIT };
const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', env }).trim();
const write = (dir, f, text) => { mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); writeFileSync(path.join(dir, f), text); };
const repo = (name, files) => {
  const bare = path.join(T, name + '.git'), work = path.join(T, name);
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare], { env });
  execFileSync('git', ['init', '-q', '-b', 'main', work], { env });
  for (const [f, text] of Object.entries(files)) write(work, f, text);
  git(work, 'add', '-A'); git(work, 'commit', '-qm', 'seed');
  git(work, 'remote', 'add', 'origin', bare); git(work, 'push', '-q', 'origin', 'main');
  return work;
};
const commit = (work, files, msg) => { for (const [f, t] of Object.entries(files)) write(work, f, t); git(work, 'add', '-A'); git(work, 'commit', '-qm', msg); };
const branch = (work, name, files) => {
  git(work, 'checkout', '-q', '-b', name, 'main'); commit(work, files, name);
  git(work, 'push', '-q', 'origin', name); git(work, 'checkout', '-q', 'main');
};

test('each branch lands in the class the skill table names', () => {
  const store = repo('store', { '.web-tools.json': '{"notes":"notes"}\n', 'notes/.keep': '',
    'state/activity.json': JSON.stringify({ repos: { 'acme/ev': { openPRs: [{ number: 3, head: 'claude/open' }] } } }),
    'state/sessions.json': '{"rows":[]}' });
  const ev = repo('ev', { 'a.md': 'one\n' });
  git(ev, 'branch', 'claude/ancestor'); git(ev, 'push', '-q', 'origin', 'claude/ancestor');
  branch(ev, 'claude/novel', { 'b.md': 'only here\n' });
  branch(ev, 'claude/open', { 'o.md': 'under review\n' });
  branch(ev, 'claude/picked', { 'c.md': 'picked\n' });
  branch(ev, 'claude/echoed', { 'a.md': 'one\nx\n' });
  // main takes c.md as the branch wrote it, and a.md past the branch's version.
  commit(ev, { 'c.md': 'picked\n', 'a.md': 'one\nx\ny\n' }, 'main moves'); git(ev, 'push', '-q', 'origin', 'main');
  git(ev, 'fetch', '-q', 'origin');

  const out = JSON.parse(execFileSync('python3', [path.join(repoRoot, 'skills/tend/branches.py'),
    '--store', path.join(store, 'notes'), '--json'],
    { encoding: 'utf8', env: { ...env, FINDINGS_CHECKOUTS: JSON.stringify({ 'acme/ev': ev }) }, cwd: store }));
  const cls = Object.fromEntries(out.map(r => [r.branch, r.class]));
  assert.deepEqual(cls, { 'claude/ancestor': 'ancestor', 'claude/novel': 'novel', 'claude/open': 'open',
    'claude/picked': 'content-settled', 'claude/echoed': 'residue-free' });
  const novel = out.find(r => r.branch === 'claude/novel');
  assert.equal(novel.residue, 1);
  assert.deepEqual(novel.paths, ['b.md']);
});
