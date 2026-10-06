// tools/test/notes.test.mjs
// The notes skill's writer (skills/notes/note.py), driven against a
// throwaway store: a bare origin and a clone parked on another branch, which is
// how a session's checkout of the store usually sits.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const NOTE = path.join(repoRoot, 'skills', 'notes', 'note.py');
const ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };

const tmp = mkdtempSync(path.join(tmpdir(), 'notes-'));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8' });
git(tmp, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
git(tmp, 'clone', '-q', 'origin.git', 'store');
const store = path.join(tmp, 'store');
writeFileSync(path.join(store, '.web-tools.json'), '{"notes": "notes"}\n');
git(store, 'add', '.');
git(store, 'commit', '-qm', 'init');
git(store, 'push', '-q', 'origin', 'main');
git(store, 'checkout', '-qb', 'claude/elsewhere');

const run = (...args) => spawnSync('python3', [NOTE, '--store', path.join(store, 'notes'), ...args],
  { env: ENV, encoding: 'utf8' });
const onMain = () => git(store, 'show', 'origin/main:notes/notes.jsonl')
  .trim().split('\n').map((l) => JSON.parse(l));

test('add writes one line to main, whatever branch the checkout is on', () => {
  const r = run('add', 'mehrlander/web-tools#803', 'Merged cleanly.', '--author', 'claude/x');
  assert.equal(r.status, 0, r.stderr);
  const [n] = onMain();
  assert.equal(n.id, r.stdout.trim());
  assert.deepEqual(Object.keys(n), ['id', 'at', 'author', 'about', 'text']);
  assert.equal(n.about, 'mehrlander/web-tools#803');
  assert.equal(git(store, 'branch', '--show-current').trim(), 'claude/elsewhere');
  assert.equal(existsSync(path.join(store, 'notes')), false, 'the working tree is left alone');
});

test('a reply is a note about a note, and show nests it under its parent', () => {
  const parent = onMain()[0].id;
  const r = run('reply', parent, 'Correction: CI had not run.', '--author', 'mehrlander');
  assert.equal(r.status, 0, r.stderr);
  const reply = onMain().at(-1);
  assert.equal(reply.about, `note:${parent}`);
  const shown = run('show', 'mehrlander/web-tools#803').stdout.split('\n');
  const at = shown.findIndex((l) => l.startsWith(reply.id) || l.trim().startsWith(reply.id));
  assert.ok(at > 0 && shown[at].startsWith('  '), 'the reply is indented under the note it answers');
});

test('every locator form the skill documents is accepted', () => {
  for (const about of ['owner/repo', 'owner/repo@claude/b', 'owner/repo:docs/X.md',
    'owner/repo:docs/SNAGS.md#a-slug', 'owner/repo@main:lib/x.js']) {
    assert.equal(run('add', about, 'ok', '--author', 'claude/x').status, 0, about);
  }
});

test('what is not a locator, an empty note, and a reply to nothing are refused', () => {
  assert.notEqual(run('add', 'not a locator', 'x', '--author', 'a').status, 0);
  assert.notEqual(run('add', 'owner/repo', '   ', '--author', 'a').status, 0);
  assert.notEqual(run('reply', 'nzzzz', 'x', '--author', 'a').status, 0);
});

test('the store is found by the declaration on main, whatever branch the checkout is on', () => {
  const root = path.join(tmp, 'project');
  git(tmp, 'clone', '-q', 'origin.git', 'project/store');
  git(path.join(root, 'store'), 'checkout', '-q', '--orphan', 'claude/old');
  git(path.join(root, 'store'), 'rm', '-rqf', '.');
  const r = spawnSync('python3', [NOTE, 'show', 'mehrlander/web-tools#803'],
    { env: { ...ENV, CLAUDE_PROJECT_DIR: root }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Merged cleanly\./);
});

test('the skill is registered with the plugin and the portable index', () => {
  assert.ok(readFileSync(path.join(repoRoot, 'skills', 'notes', 'SKILL.md'), 'utf8')
    .startsWith('---\nname: notes\n'));
  const market = JSON.parse(readFileSync(path.join(repoRoot, '.claude-plugin', 'marketplace.json'), 'utf8'));
  assert.ok(market.plugins.find((p) => p.name === 'portable').skills.includes('./notes'));
  const row = parseCsv(readFileSync(path.join(repoRoot, 'docs', 'portable.csv'), 'utf8'))
    .find((p) => p.path === 'skills/notes/SKILL.md');
  assert.equal(row?.command, '/portable:notes');
});

test('a note may take a stance, and a stance off the list is refused', () => {
  const about = 'mehrlander/web-tools-private:user-calls/aaaa1111-x.json';
  const r = run('add', about, 'Still holds.', '--author', 'gemini', '--stance', 'agrees');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(onMain().at(-1).stance, 'agrees');
  assert.notEqual(run('add', about, 'x', '--author', 'gemini', '--stance', 'shrugs').status, 0);
});
