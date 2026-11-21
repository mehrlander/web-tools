// skills/hooks/acronym-hint.py: the UserPromptSubmit hook that adds a coined
// acronym's entry to the session's context when the prompt names it in
// capitals. Driven as a subprocess over a scratch plugin root holding a copy of
// docs/acronyms.md.
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const HOOK = path.join(repoRoot, 'skills/hooks/acronym-hint.py');
const HOOKS_JSON = JSON.parse(
  readFileSync(path.join(repoRoot, 'skills/hooks/hooks.json'), 'utf8'));

const DOC = '# Acronyms\n\nOpening.\n\n## SPUR\n\nShort ask.\n\n## TOUR\n\nFull ask.\n\nSecond paragraph.\n';

function root(doc = DOC) {
  const dir = mkdtempSync(path.join(tmpdir(), 'acronym-hint-'));
  mkdirSync(path.join(dir, 'default'));
  if (doc !== null) writeFileSync(path.join(dir, 'default', 'acronyms.md'), doc);
  return dir;
}

const run = (dir, input) => execFileSync('python3', [HOOK], {
  input: typeof input === 'string' ? input : JSON.stringify(input),
  env: { ...process.env, CLAUDE_PLUGIN_ROOT: dir }, encoding: 'utf8',
}).trim();

const context = (out) => {
  const d = JSON.parse(out).hookSpecificOutput;
  assert.equal(d.hookEventName, 'UserPromptSubmit');
  return d.additionalContext;
};

test('a capitalized name adds its whole entry, and only its own', () => {
  const dir = root();
  try {
    const msg = context(run(dir, { prompt: 'Give me a TOUR of this.' }));
    assert.match(msg, /TOUR: Full ask\.\n\nSecond paragraph\./);
    assert.doesNotMatch(msg, /Short ask/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('two names add two entries', () => {
  const dir = root();
  try {
    const msg = context(run(dir, { prompt: 'A SPUR now, a TOUR later.' }));
    assert.match(msg, /SPUR: Short ask\./);
    assert.match(msg, /TOUR: Full ask\./);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('lowercase, a longer word, and no copy all stay silent', () => {
  const dir = root();
  try {
    for (const prompt of ['take a tour', 'TOURS and SPURRED', 'Tour', 'see MYTOUR now', 'a DETOUR', 'UNSPUR', '']) {
      assert.equal(run(dir, { prompt }), '', `silent on ${JSON.stringify(prompt)}`);
    }
    assert.equal(run(dir, 'not json'), '', 'silent on an unparseable payload');
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const bare = root(null);
  try {
    assert.equal(run(bare, { prompt: 'a TOUR' }), '', 'silent with no copy of the doc');
  } finally { rmSync(bare, { recursive: true, force: true }); }
});

test('the real doc yields an entry for each acronym it heads', () => {
  const msg = context(run(path.join(repoRoot, 'skills'), { prompt: 'SPUR TOUR CDE' }));
  for (const n of ['SPUR', 'TOUR', 'CDE']) assert.match(msg, new RegExp(`${n}: `));
});

test('it is registered once, on UserPromptSubmit, through the plugin root', () => {
  const entries = (HOOKS_JSON.hooks.UserPromptSubmit || [])
    .filter(e => e.hooks.some(h => h.command.includes('acronym-hint.py')));
  assert.equal(entries.length, 1);
  assert.match(entries[0].hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}/);
});
