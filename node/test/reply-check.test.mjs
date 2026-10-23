// skills/hooks/reply-check.py: the Stop hook that sends a reply back once.
// Both checks are code, so both directions are asserted: a ⚖️ closing line
// without its "Recommended:" clause goes back and one with it passes; a page
// committed since the owner's last message needs a render link. The limits
// are asserted too: a second stop in one turn passes, and any failure passes.
// The render-link check runs against a real git checkout one level below the
// working directory.
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const HOOK = path.join(repoRoot, 'skills/hooks/reply-check.py');
const HOOKS_JSON = JSON.parse(readFileSync(path.join(repoRoot, 'skills/hooks/hooks.json'), 'utf8'));

const tmp = mkdtempSync(path.join(os.tmpdir(), 'reply-check-'));
const transcript = path.join(tmp, 'transcript.jsonl');
writeFileSync(transcript, [
  { type: 'user', origin: { kind: 'human' }, timestamp: '2026-10-20T11:00:00.000Z', message: { content: 'earlier' } },
  { type: 'user', origin: { kind: 'human' }, timestamp: '2026-10-20T12:00:00.000Z', message: { content: 'the last message' } },
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

function run(hook) {
  const stdout = execFileSync('python3', [HOOK], {
    input: typeof hook === 'string' ? hook : JSON.stringify({ transcript_path: transcript, cwd: work, ...hook }),
    encoding: 'utf8',
  }).trim();
  return stdout ? JSON.parse(stdout) : null;
}
const body = 'The branch is ready.\n\n';

test('a ⚖️ closing line without its "Recommended:" clause goes back, naming the clause', () => {
  for (const line of ['⚖️ **Choice needed:** merge now or wait for review.',
                      '⚖ **Choice needed:** merge now or wait for review.',
                      '🆚 **Choice needed:** merge now or wait for review.']) {
    const d = run({ last_assistant_message: body + line });
    assert.equal(d.decision, 'block', line);
    assert.match(d.reason, /Recommended: <answer>, because <reason>/);
    assert.match(d.reason, /close on 🪧 Direction needed instead/, 'an unassessed call is offered the way out');
    assert.match(d.reason, /do not repeat the rest of the reply/);
  }
});

test('the clause passes in the shapes a reply writes it, bold included', () => {
  for (const line of ['⚖️ **Choice needed:** merge now or wait. Recommended: merge now, because CI passed.',
                      '⚖️ **Choice needed:** merge now or wait. **Recommended:** merge now, because CI passed.',
                      '⚖️ **Choice needed:** merge now or wait. recommended: merge now.']) {
    assert.equal(run({ last_assistant_message: body + line }), null, line);
  }
});

test('only the closing line is read: other markers, and a clause elsewhere in the reply, are not it', () => {
  assert.equal(run({ last_assistant_message: body + '🪧 **Direction needed:** whether the merge should wait is open.' }), null,
               'naming an open question asks for no recommendation');
  assert.equal(run({ last_assistant_message: body + '🟡 **Pending:** your yes or no on the merge.' }), null);
  assert.equal(run({ last_assistant_message: body + '🟢 **Ready to continue:** merging next.' }), null);
  const elsewhere = 'Recommended: merge now, because CI passed.\n\n⚖️ **Choice needed:** merge now or wait.';
  assert.equal(run({ last_assistant_message: elsewhere }).decision, 'block');
});

test('the limits: a second stop in one turn passes, and so does input it cannot read', () => {
  assert.equal(run({ last_assistant_message: body + '⚖️ **Choice needed:** merge or wait.', stop_hook_active: true }), null);
  assert.equal(run('not json'), null);
  assert.equal(run({ last_assistant_message: '' }), null);
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

test('a link given after the newest page commit counts, so a wake\'s one-line reply passes', () => {
  // The owner's message at 12:00 and the page commit at 12:10 come from the
  // tests above. A wake's entry is not the owner's, so the window stays open.
  const woken = path.join(tmp, 'woken.jsonl');
  writeFileSync(woken, readFileSync(transcript, 'utf8') + [
    { type: 'assistant', timestamp: '2026-10-20T12:15:00.000Z',
      message: { content: [{ type: 'text', text: '🥏 [new.html](x)\n\n✴️ **Needs you:** try it.' }] } },
    { type: 'user', origin: { kind: 'task-notification' }, timestamp: '2026-10-20T12:20:00.000Z',
      message: { content: '<task-notification>' } },
  ].map(r => JSON.stringify(r)).join('\n') + '\n');
  const wake = 'CI passed on the PR.';
  assert.equal(run({ transcript_path: woken, last_assistant_message: wake }), null);
  writeFileSync(path.join(site, 'new.html'), '<p>fixed on the wake');
  git(['add', '.']); git(['commit', '-q', '-m', 'a fix on the wake'], '2026-10-20T12:25:00Z');
  assert.equal(run({ transcript_path: woken, last_assistant_message: wake }).decision, 'block',
               'a page committed after the link owes a new one');
});

test('it is registered once, at Stop, through the plugin root', () => {
  const hooks = (HOOKS_JSON.hooks.Stop || []).flatMap(e => e.hooks).filter(h => (h.command || '').includes('reply-check.py'));
  assert.equal(hooks.length, 1);
  assert.equal(hooks[0].type, 'command');
  assert.match(hooks[0].command, /^python3 "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/reply-check\.py"$/);
});
