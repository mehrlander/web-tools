// skills/hooks/acronym-hint.py: the UserPromptSubmit hook that adds a coined
// acronym's entry to the session's context when the prompt names it in
// capitals. Driven as a subprocess over a scratch session root holding a
// web-tools-private checkout with an Acronyms list.
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

const LIST = { title: 'Acronyms', items: [
  { id: 'a', text: 'SPUR', note: 'Short ask.' },
  { id: 'b', text: 'TOUR', note: 'Full ask.\n\nSecond paragraph.' },
  { id: 'c', text: 'not an acronym', note: 'Ignored.' },
  { id: 'd', text: 'PAF', note: 'Working name.', kind: 'draft' },
] };

// A session root with web-tools-private/lists/acronyms.json and a sibling
// checkout to run from; list null leaves the private checkout out.
function root(list = LIST) {
  const dir = mkdtempSync(path.join(tmpdir(), 'acronym-hint-'));
  mkdirSync(path.join(dir, 'web-tools', 'docs'), { recursive: true });
  if (list !== null) {
    mkdirSync(path.join(dir, 'web-tools-private', 'lists'), { recursive: true });
    writeFileSync(path.join(dir, 'web-tools-private', 'lists', 'acronyms.json'), JSON.stringify(list));
  }
  return dir;
}

// The payload's cwd is the sibling checkout's docs/ folder, so the hook has to
// climb to the session root to find the list.
const run = (dir, input) => execFileSync('python3', [HOOK], {
  input: typeof input === 'string' ? input
    : JSON.stringify({ cwd: path.join(dir, 'web-tools', 'docs'), ...input }),
  encoding: 'utf8',
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
    assert.doesNotMatch(msg, /Short ask|Ignored/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a draft acronym\'s entry says it is a draft', () => {
  const dir = root();
  try {
    assert.match(context(run(dir, { prompt: 'a PAF here' })), /PAF: \(draft\) Working name\./);
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

test('lowercase, a longer word, and no list all stay silent', () => {
  const dir = root();
  try {
    for (const prompt of ['take a tour', 'TOURS and SPURRED', 'Tour', 'see MYTOUR now', 'a DETOUR', 'UNSPUR', '']) {
      assert.equal(run(dir, { prompt }), '', `silent on ${JSON.stringify(prompt)}`);
    }
    assert.equal(run(dir, 'not json'), '', 'silent on an unparseable payload');
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const bare = root(null);
  try {
    assert.equal(run(bare, { prompt: 'a TOUR' }), '', 'silent with no web-tools-private checkout');
  } finally { rmSync(bare, { recursive: true, force: true }); }
});

test('a cwd inside the private checkout finds its own list', () => {
  const dir = root();
  try {
    const msg = context(run(dir, { prompt: 'a SPUR', cwd: path.join(dir, 'web-tools-private', 'lists') }));
    assert.match(msg, /SPUR: Short ask\./);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('it is registered once, on UserPromptSubmit, through the plugin root', () => {
  const entries = (HOOKS_JSON.hooks.UserPromptSubmit || [])
    .filter(e => e.hooks.some(h => h.command.includes('acronym-hint.py')));
  assert.equal(entries.length, 1);
  assert.match(entries[0].hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}/);
});
