// skills/hooks/context-size-hint.py: the UserPromptSubmit notice that the
// session's context has grown large. Driven as a subprocess over a scratch
// transcript whose assistant entries carry usage in the harness's shape, with
// TMPDIR pointed at a scratch folder so each test keeps its own band marks.
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const HOOK = path.join(repoRoot, 'skills/hooks/context-size-hint.py');
const HOOKS_JSON = JSON.parse(
  readFileSync(path.join(repoRoot, 'skills/hooks/hooks.json'), 'utf8'));

// One model response, split across the three input counters the hook adds up.
const reply = (tokens, sidechain = false) => JSON.stringify({
  type: 'assistant', isSidechain: sidechain,
  message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }],
    usage: { input_tokens: 2, cache_creation_input_tokens: 1000,
      cache_read_input_tokens: tokens - 1002, output_tokens: 50 } },
});
const prompt = JSON.stringify({ type: 'user', message: { role: 'user', content: 'go on' } });

function scratch() {
  const dir = mkdtempSync(path.join(tmpdir(), 'context-size-hint-'));
  const transcript = path.join(dir, 'session.jsonl');
  const run = (entries, env = {}, session = 'sess-1') => {
    writeFileSync(transcript, entries.join('\n') + '\n');
    return execFileSync('python3', [HOOK], {
      input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', transcript_path: transcript, session_id: session }),
      env: { ...process.env, TMPDIR: dir, CONTEXT_HINT_TOKENS: '', CONTEXT_HINT_STEP: '', ...env },
      encoding: 'utf8',
    }).trim();
  };
  return { dir, transcript, run, done: () => rmSync(dir, { recursive: true, force: true }) };
}
const context = (out) => {
  const d = JSON.parse(out).hookSpecificOutput;
  assert.equal(d.hookEventName, 'UserPromptSubmit');
  return d.additionalContext;
};

test('below the threshold it says nothing', () => {
  const s = scratch();
  try {
    assert.equal(s.run([prompt, reply(399_000)]), '');
  } finally { s.done(); }
});

test('the first crossing speaks once, with the size rounded to the thousand', () => {
  const s = scratch();
  try {
    const msg = context(s.run([prompt, reply(411_600)]));
    assert.equal(msg, "This session's context is now about 412,000 tokens. Say so in one line of "
      + 'this reply, and that typing /compact would shrink it. Do not compact or change anything yourself.');
    assert.equal(s.run([prompt, reply(411_600), prompt, reply(590_000)]), '', 'same band again is silent');
    assert.match(context(s.run([prompt, reply(600_400)])), /about 600,000 tokens/, 'the next band speaks');
    assert.equal(s.run([prompt, reply(700_000)]), '');
  } finally { s.done(); }
});

test('falling below the threshold resets it, so the next crossing speaks again', () => {
  const s = scratch();
  try {
    assert.match(context(s.run([reply(650_000)])), /about 650,000/);
    assert.equal(s.run([reply(650_000), reply(80_000)]), '', 'after a compaction');
    assert.match(context(s.run([reply(420_000)])), /about 420,000/);
  } finally { s.done(); }
});

test('the last main-conversation response counts, not a subagent\'s larger one', () => {
  const s = scratch();
  try {
    assert.equal(s.run([reply(300_000), reply(900_000, true)]), '');
    assert.match(context(s.run([reply(450_000), reply(900_000, true), prompt])), /about 450,000/);
  } finally { s.done(); }
});

test('each session keeps its own bands', () => {
  const s = scratch();
  try {
    assert.notEqual(s.run([reply(450_000)], {}, 'sess-a'), '');
    assert.notEqual(s.run([reply(450_000)], {}, 'sess-b'), '');
  } finally { s.done(); }
});

test('CONTEXT_HINT_TOKENS and CONTEXT_HINT_STEP are honored', () => {
  const s = scratch();
  try {
    const env = { CONTEXT_HINT_TOKENS: '100000', CONTEXT_HINT_STEP: '50000' };
    assert.equal(s.run([reply(99_000)], env), '');
    assert.match(context(s.run([reply(120_000)], env)), /about 120,000/);
    assert.equal(s.run([reply(149_000)], env), '');
    assert.match(context(s.run([reply(151_000)], env)), /about 151,000/);
  } finally { s.done(); }
});

test('it reads only the tail of a long transcript', () => {
  const s = scratch();
  try {
    const filler = JSON.stringify({ type: 'user', message: { role: 'user', content: 'x'.repeat(10_000) } });
    assert.match(context(s.run([reply(900_000), ...Array(100).fill(filler), reply(450_000)])),
      /about 450,000/);
    assert.equal(s.run([reply(900_000), ...Array(100).fill(filler)], {}, 'sess-2'), '',
      'a response a megabyte back is out of reach, and silence is the answer');
  } finally { s.done(); }
});

test('anything it was not aimed at passes silently, and it never fails a turn', () => {
  const s = scratch();
  try {
    assert.equal(s.run(['not json', prompt]), '', 'no usage entry');
    assert.equal(s.run([reply(500_000).slice(0, 80)]), '', 'a cut line');
    for (const input of ['not json', '{}', '[1]',
      JSON.stringify({ transcript_path: path.join(s.dir, 'missing.jsonl'), session_id: 'x' }),
      JSON.stringify({ transcript_path: s.transcript })]) {
      assert.equal(execFileSync('python3', [HOOK], { input, env: { ...process.env, TMPDIR: s.dir },
        encoding: 'utf8' }).trim(), '', `silent on ${input.slice(0, 40)}`);
    }
  } finally { s.done(); }
});

test('it is registered once, on UserPromptSubmit, through the plugin root', () => {
  const entries = (HOOKS_JSON.hooks.UserPromptSubmit || [])
    .filter(e => e.hooks.some(h => h.command.includes('context-size-hint.py')));
  assert.equal(entries.length, 1);
  assert.match(entries[0].hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}/);
});
