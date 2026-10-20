// skills/hooks/reply-check.py: the Stop hook that sends a reply back once.
// Every limit the 2026-10-20 prompt hook left to Haiku is asserted here as code:
// a second stop in one turn passes, a one-line reply passes, a quote not in the
// reply passes, and any failure passes. Haiku is a stand-in `claude` on PATH
// that prints a canned answer, so the suite stays offline; the render-link check
// runs against a real git checkout one level below the working directory.
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, chmodSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const HOOK = path.join(repoRoot, 'skills/hooks/reply-check.py');
const HOOKS_JSON = JSON.parse(readFileSync(path.join(repoRoot, 'skills/hooks/hooks.json'), 'utf8'));

const tmp = mkdtempSync(path.join(os.tmpdir(), 'reply-check-'));
const bin = path.join(tmp, 'bin');
mkdirSync(bin);
const called = path.join(tmp, 'called');
writeFileSync(path.join(bin, 'claude'), `#!/bin/sh\ncat >/dev/null\ntouch "${called}"\nprintf '%s' "$FAKE_OUT"\n`);
chmodSync(path.join(bin, 'claude'), 0o755);

const PROMPT_AT = '2026-10-20T12:00:00.000Z';
const transcript = path.join(tmp, 'transcript.jsonl');
writeFileSync(transcript, [
  { type: 'user', origin: { kind: 'human' }, timestamp: '2026-10-20T11:00:00.000Z', message: { content: 'earlier' } },
  { type: 'user', origin: { kind: 'human' }, timestamp: PROMPT_AT, message: { content: 'the last message' } },
  { type: 'user', isMeta: true, timestamp: '2026-10-20T12:05:00.000Z', message: { content: 'Stop hook feedback' } },
  { type: 'user', timestamp: '2026-10-20T12:06:00.000Z', message: { content: [{ type: 'tool_result', content: 'ok' }] } },
].map(r => JSON.stringify(r)).join('\n') + '\n');

const work = path.join(tmp, 'work');
const site = path.join(work, 'site');
mkdirSync(site, { recursive: true });
const git = (args, date) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args],
  { cwd: site, env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
git(['init', '-q', '-b', 'main']);
writeFileSync(path.join(site, 'old.html'), '<p>before');
git(['add', '.']); git(['commit', '-q', '-m', 'before the message'], '2026-10-20T11:30:00Z');

const ASK = 'Should I merge it now or wait for the review?';
const waiting = (extra = '') => `The branch is ready.\n${extra}\n${ASK}\n\n🟡 **Pending:** your call on the merge.`;
const answer = (o) => JSON.stringify({ structured_output: o });

function run(hook, { out = answer({ asks_decision: true, quote: ASK }), env = {} } = {}) {
  try { execFileSync('rm', ['-f', called]); } catch {}
  const stdout = execFileSync('python3', [HOOK], {
    input: typeof hook === 'string' ? hook : JSON.stringify({ transcript_path: transcript, cwd: work, ...hook }),
    encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_OUT: out, ...env },
  }).trim();
  return stdout ? JSON.parse(stdout) : null;
}

test('a decision put to the owner with no recommendation goes back, quoting the sentence', () => {
  const d = run({ last_assistant_message: waiting() });
  assert.equal(d.decision, 'block');
  assert.ok(d.reason.includes(`"${ASK}"`), 'the quote is the sentence Haiku found');
  assert.match(d.reason, /one sentence/);
  assert.match(d.reason, /do not repeat the rest of the reply/);
});

test('a reply that recommends passes without asking Haiku', () => {
  assert.equal(run({ last_assistant_message: waiting('I recommend merging now.') }), null);
  assert.ok(!existsSync(called), 'no Haiku call when the word is present');
});

test('only a closing state that waits on the owner reaches Haiku', () => {
  assert.equal(run({ last_assistant_message: `${ASK}\n\n🟢 **Ready to continue:** merging next.` }), null);
  assert.ok(!existsSync(called));
  assert.equal(run({ last_assistant_message: `${ASK}\n\n🆚 **Choice needed:** merge or wait.` }).decision, 'block');
});

test('the limits are code: a second stop, a one-line reply, the inner run', () => {
  assert.equal(run({ last_assistant_message: waiting(), stop_hook_active: true }), null);
  assert.equal(run({ last_assistant_message: '🟡 **Pending:** your call on the merge.' }), null);
  assert.equal(run({ last_assistant_message: waiting() }, { env: { REPLY_CHECK_INNER: '1' } }), null);
});

test('Haiku is not taken at its word: a quote missing from the reply, a no, or noise all pass', () => {
  assert.equal(run({ last_assistant_message: waiting() }, { out: answer({ asks_decision: true, quote: 'Shall we ship?' }) }), null);
  assert.equal(run({ last_assistant_message: waiting() }, { out: answer({ asks_decision: false, quote: '' }) }), null);
  assert.equal(run({ last_assistant_message: waiting() }, { out: 'not json' }), null);
  assert.equal(run('not json'), null);
});

test('a page committed since the owner\'s last message needs a render link', () => {
  writeFileSync(path.join(site, 'new.html'), '<p>after');
  git(['add', '.']); git(['commit', '-q', '-m', 'after the message'], '2026-10-20T12:10:00Z');
  const reply = 'Changed the page.\n\n🟢 **Ready to continue:** next is the test.';
  const d = run({ last_assistant_message: reply });
  assert.equal(d.decision, 'block');
  assert.match(d.reason, /site\/new\.html/);
  assert.doesNotMatch(d.reason, /old\.html/, 'a commit before the message is not this turn\'s');
  assert.equal(run({ last_assistant_message: reply.replace('Changed', '🥏 [new](x) Changed') }), null);
  assert.equal(run({ last_assistant_message: 'Changed it.\nNo render link: the page needs a token.\n\n🟢 **Ready to continue:** x' }), null);
});

test('it is registered once, at Stop, through the plugin root', () => {
  const hooks = (HOOKS_JSON.hooks.Stop || []).flatMap(e => e.hooks).filter(h => (h.command || '').includes('reply-check.py'));
  assert.equal(hooks.length, 1);
  assert.equal(hooks[0].type, 'command');
  assert.match(hooks[0].command, /^python3 "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/reply-check\.py"$/);
});
