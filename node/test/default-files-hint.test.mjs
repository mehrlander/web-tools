// skills/hooks/default-files-hint.py: the UserPromptSubmit notice that the
// default skill files changed since the session last read them. Driven as a
// subprocess over a scratch plugin cache: two copies of default/ side by side,
// a transcript whose harness entries name the copy the session loaded, and the
// plugin root pointing at the copy the plugin carries now.
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const HOOK = path.join(repoRoot, 'skills/hooks/default-files-hint.py');
const HOOKS_JSON = JSON.parse(
  readFileSync(path.join(repoRoot, 'skills/hooks/hooks.json'), 'utf8'));

const OLD = 'aaaaaaaaaaa1';
const NEW = 'bbbbbbbbbbb2';

function cache({ conversation = 'rules v2', craft = 'craft v1', drop = false } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'default-files-hint-'));
  const portable = path.join(dir, 'cache/web-tools/portable');
  const copy = (sha, conv, crafts) => {
    const d = path.join(portable, sha, 'default');
    mkdirSync(d, { recursive: true });
    writeFileSync(path.join(d, 'SKILL.md'), '# The default session context\n');
    writeFileSync(path.join(d, 'CONVERSATION.md'), `# Conversation\n${conv}\n`);
    writeFileSync(path.join(d, 'QUALIFIED-WRITING.md'), '# Qualified writing\n');
    mkdirSync(path.join(portable, sha, 'doc-craft'), { recursive: true });
    writeFileSync(path.join(portable, sha, 'doc-craft', 'SKILL.md'), `# Doc Craft\n${crafts}\n`);
  };
  if (!drop) copy(OLD, 'rules v1', 'craft v1');
  copy(NEW, conversation, craft);
  return { dir, portable, root: path.join(portable, NEW) };
}

// One transcript line per entry, in the harness's shape: a skill load is an
// isMeta user message whose text opens with the base directory.
const load = (portable, sha) => JSON.stringify({
  type: 'user', isMeta: true,
  message: { role: 'user', content: [{ type: 'text',
    text: `Base directory for this skill: ${portable}/${sha}/default\n\n# The default session context` }] },
});
const toolOutput = (portable, sha) => JSON.stringify({
  type: 'user', toolUseResult: {},
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1',
    content: `head: Base directory for this skill: ${portable}/${sha}/default` }] },
});

function run(c, entries, root = c.root) {
  const transcript = path.join(c.dir, 'session.jsonl');
  writeFileSync(transcript, entries.join('\n') + '\n');
  return execFileSync('python3', [HOOK], {
    input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', transcript_path: transcript }),
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: root }, encoding: 'utf8',
  }).trim();
}
const context = (out) => {
  const d = JSON.parse(out).hookSpecificOutput;
  assert.equal(d.hookEventName, 'UserPromptSubmit');
  return d.additionalContext;
};

test('a session that read an older copy is told the commit, the files and what to do', () => {
  const c = cache();
  try {
    const msg = context(run(c, [load(c.portable, OLD)]));
    assert.match(msg, /at commit aaaaaaa\b/, 'names the commit the session read');
    assert.match(msg, /now carries bbbbbbb\b/, 'names the commit the plugin carries');
    assert.match(msg, /CONVERSATION\.md changed/, 'names only the file that differs');
    assert.doesNotMatch(msg, /QUALIFIED-WRITING|SKILL\.md/);
    assert.match(msg, /Invoke \/portable:default and review them before your next response/);
  } finally { rmSync(c.dir, { recursive: true, force: true }); }
});

test('doc-craft, read from beside the folder, counts as a default file', () => {
  const c = cache({ conversation: 'rules v1', craft: 'craft v2' });
  try {
    const msg = context(run(c, [load(c.portable, OLD)]));
    assert.match(msg, /doc-craft\/SKILL\.md changed/, 'names doc-craft alone');
    assert.doesNotMatch(msg, /CONVERSATION|QUALIFIED-WRITING/);
  } finally { rmSync(c.dir, { recursive: true, force: true }); }
});

test('it clears itself: a later load of the current copy silences it', () => {
  const c = cache();
  try {
    assert.equal(run(c, [load(c.portable, OLD), load(c.portable, NEW)]), '');
  } finally { rmSync(c.dir, { recursive: true, force: true }); }
});

test('a plugin that moved without touching the default skill files says nothing', () => {
  const c = cache({ conversation: 'rules v1' });
  try {
    assert.equal(run(c, [load(c.portable, OLD)]), '');
  } finally { rmSync(c.dir, { recursive: true, force: true }); }
});

test('only the harness\'s own loads count, not the same phrase in tool output', () => {
  const c = cache();
  try {
    assert.equal(run(c, [load(c.portable, NEW), toolOutput(c.portable, OLD)]), '',
      'a record printed in tool output is not the session\'s own load');
  } finally { rmSync(c.dir, { recursive: true, force: true }); }
});

test('when the copy read is gone from disk, it says the files may have changed', () => {
  const c = cache({ drop: true });
  try {
    const msg = context(run(c, [load(c.portable, OLD)]));
    assert.match(msg, /no longer on disk, so they may have changed/);
    assert.match(msg, /Invoke \/portable:default/);
  } finally { rmSync(c.dir, { recursive: true, force: true }); }
});

test('anything it was not aimed at passes silently, and it never fails a turn', () => {
  const c = cache();
  try {
    assert.equal(run(c, []), '', 'no load of the default skill in the transcript');
    assert.equal(run(c, ['not json', load(c.portable, OLD)], path.join(c.dir, 'nowhere')), '',
      'a plugin root with no default/ folder');
    for (const input of ['not json', '{}', JSON.stringify({ transcript_path: path.join(c.dir, 'missing.jsonl') })]) {
      assert.equal(execFileSync('python3', [HOOK], { input, env: { ...process.env, CLAUDE_PLUGIN_ROOT: c.root },
        encoding: 'utf8' }).trim(), '', `silent on ${input.slice(0, 40)}`);
    }
  } finally { rmSync(c.dir, { recursive: true, force: true }); }
});

test('it is registered once, on UserPromptSubmit, through the plugin root', () => {
  const entries = (HOOKS_JSON.hooks.UserPromptSubmit || [])
    .filter(e => e.hooks.some(h => h.command.includes('default-files-hint.py')));
  assert.equal(entries.length, 1);
  assert.match(entries[0].hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}/);
});
