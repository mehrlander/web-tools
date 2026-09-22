// .claude/skills/hooks/invoke-sessions.sh — the SessionStart directive that
// fires when a session should be recorded and its store is not checked out.
//
// The failure this guards was measured on 2026-09-21: a task-spawned session
// began in an empty working directory, attached one repo, and ran for hours
// with the recorder installed and firing and finding nothing, because nothing
// had put the store beside the project root. Both halves are asserted, as for
// invoke-default: silence when a runnable store IS present or when nothing
// declared that the session should be recorded, and speech when a pointer
// exists and the store does not.
//
// Driven as a subprocess with a built tree: the hook's contract is exactly
// (CLAUDE_PROJECT_DIR and SESSIONS_STORE_REPO in, stdout out, always exit 0).
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { repoRoot } from './bootstrap.mjs';

const HOOK = path.join(repoRoot, '.claude/skills/hooks/invoke-sessions.sh');

// Fixtures go INSIDE one temp root, never beside it: the hook scans the
// project root's siblings on purpose.
const tmp = mkdtempSync(path.join(os.tmpdir(), 'invoke-sessions-'));
const build = (name, repos) => {
  const root = path.join(tmp, name);
  for (const [repo, files] of Object.entries(repos)) {
    for (const [rel, body] of Object.entries(files)) {
      const full = path.join(root, repo, rel);
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, body);
    }
  }
  return root;
};
const run = (root, env = {}) => execFileSync('bash', [HOOK], {
  env: { ...process.env, SESSIONS_STORE_REPO: '', ...env, CLAUDE_PROJECT_DIR: root },
  encoding: 'utf8', input: '',
}).trim();

const POINTER = { '.web-tools.json': '{"sessionsStore":"owner/store"}' };
// A store is "checked out" only when it declares the dir AND carries the
// runner, the same test session-record.sh applies before delegating.
const STORE = { '.web-tools.json': '{"sessions":"sessions"}', 'sessions/tools/on-stop.sh': '#!/bin/bash\n' };

test('a pointer with no store checked out gets the directive', () => {
  const root = build('pointer-only', { home: POINTER });
  const out = run(root);
  assert.match(out, /^Invoke \/portable:sessions now/, 'the directive leads, so it survives a truncated preview');
  assert.match(out, /so this session is recorded/, 'says what invoking gets');
  assert.match(out, /owner\/store/, 'and names the one fact the action needs');
});

test('a runnable store beside the pointer silences it', () => {
  const root = build('store-present', { home: POINTER, 'web-tools-private': STORE });
  assert.equal(run(root), '', 'the Stop hook will find that store; nothing to fetch');
});

test('a store declared without its runner does not count as checked out', () => {
  const root = build('store-no-runner', {
    home: POINTER, 'web-tools-private': { '.web-tools.json': '{"sessions":"sessions"}' },
  });
  assert.notEqual(run(root), '', 'session-record.sh would decline this store too, so the directive still applies');
});

test('no pointer anywhere means the session was never meant to be recorded', () => {
  const root = build('no-pointer', { home: { '.web-tools.json': '{"conventions":"optout"}', 'CLAUDE.md': '# x\n' } });
  assert.equal(run(root), '', 'not every session participates, and nothing declared this one should');
});

// The shape a task-spawned session actually starts in: no checkout at all, so
// no manifest can speak. The environment variable is the only voice it has.
test('SESSIONS_STORE_REPO speaks for a session with no checkout at all', () => {
  const empty = path.join(tmp, 'does-not-exist');
  assert.equal(run(empty), '', 'a missing root with no env var says nothing');
  assert.match(run(empty, { SESSIONS_STORE_REPO: 'owner/store' }), /owner\/store/,
    'with the env var set, the directive fires with nothing on disk');
});

test('the env var wins over a manifest, and a store still silences both', () => {
  const root = build('env-wins', { home: { '.web-tools.json': '{"sessionsStore":"owner/manifest"}' } });
  assert.match(run(root, { SESSIONS_STORE_REPO: 'owner/env' }), /owner\/env/);
  const quiet = build('env-store', { home: POINTER, 'web-tools-private': STORE });
  assert.equal(run(quiet, { SESSIONS_STORE_REPO: 'owner/env' }), '', 'a checked-out store is the end of the question');
});

test('the search is root, children and siblings, like the Stop hook', () => {
  // Root IS a checkout; the pointer sits on a sibling.
  const root = build('sibling', { home: { 'CLAUDE.md': '# home\n' }, other: POINTER });
  assert.notEqual(run(path.join(root, 'home')), '', 'a sibling manifest is read');
  // Root above the checkouts; the store is a child.
  const above = build('above', { home: POINTER, 'web-tools-private': STORE });
  assert.equal(run(above), '', 'a child store is found');
});

test('a malformed manifest and a non-string pointer fail soft', () => {
  const bad = build('bad-json', { home: { '.web-tools.json': '{not json' } });
  assert.equal(run(bad), '', 'unparseable is not a pointer');
  const wrong = build('wrong-type', { home: { '.web-tools.json': '{"sessionsStore":42}' } });
  assert.equal(run(wrong), '', 'a pointer is an owner/repo string or nothing');
});

test('the plugin registers it as its OWN SessionStart entry, not inside the dispatcher', () => {
  const hooks = JSON.parse(readFileSync(path.join(repoRoot, '.claude/skills/hooks/hooks.json'), 'utf8'));
  const entries = hooks.hooks.SessionStart;
  const commands = entries.map(e => e.hooks.map(h => h.command).join(' '));
  const mine = commands.filter(c => c.includes('invoke-sessions.sh'));
  assert.equal(mine.length, 1, 'registered exactly once');
  assert.equal(commands.filter(c => c.includes('session-dispatch.sh') && c.includes('invoke-sessions.sh')).length,
    0, 'it does not share an entry with the dispatcher, so it does not share a budget');
  assert.match(mine[0], /\$\{CLAUDE_PLUGIN_ROOT\}/, 'addressed through the plugin root, like its siblings');
  for (const e of entries) assert.equal(e.matcher, 'startup|resume', 'every entry fires on the same two events');
});

test('the directive fits the preview a truncated hook payload leaves', () => {
  const root = build('size', { home: POINTER });
  assert.ok(Buffer.byteLength(run(root)) < 500, 'one instruction and its reason');
});

process.on('exit', () => rmSync(tmp, { recursive: true, force: true }));
