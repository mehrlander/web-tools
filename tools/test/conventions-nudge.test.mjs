// .claude/skills/hooks/conventions-nudge.sh — the SessionStart directive that
// fires when the surfacing conventions did not arrive on their own.
//
// The failure this guards is silence in the wrong direction, and it has both
// halves. A nudge that never fires leaves a session working without the
// conventions and saying nothing, which is how the retired injection channel
// ran at 5% for nineteen days. A nudge that fires when the conventions ARE in
// context spends the reader's attention on nothing and trains them to skip it,
// which is worse than not having one. So both silence and speech are asserted,
// against the two real shapes: web-tools, which @-imports the primitives, and
// home, which names /web-tools in prose and imports nothing.
//
// Driven as a subprocess with a built tree rather than by importing anything:
// the hook is a bash script the harness runs, and its contract is exactly
// (CLAUDE_PROJECT_DIR in, stdout out, always exit 0). Stubbing its file reads
// would test a different program.
import { test } from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { repoRoot } from './bootstrap.mjs';

const HOOK = path.join(repoRoot, '.claude/skills/hooks/conventions-nudge.sh');
const SURFACING = readFileSync(path.join(repoRoot, 'docs/SURFACING.md'), 'utf8');

// One temp root per run, and the fixtures go INSIDE it rather than beside it.
// The hook scans the project root's siblings on purpose, so a fixture placed
// directly in the system temp dir reads every unrelated directory there as a
// candidate. Found the first time this was exercised by hand: 42 scratch
// clones left by scripts/showing.py, each carrying a .web-tools.json, turned
// up in the output.
const tmp = mkdtempSync(path.join(os.tmpdir(), 'nudge-'));
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

const run = (root) => execFileSync('bash', [HOOK], {
  env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  encoding: 'utf8', input: '',
}).trim();

test('a checkout that @-imports the primitives silences it', () => {
  const root = build('imported', {
    'web-tools': { 'CLAUDE.md': '@docs/SURFACING.md\n', 'docs/SURFACING.md': SURFACING },
  });
  assert.equal(run(root), '', 'the conventions are in context; the nudge must not speak');
});

test('a checkout that only names the command in prose gets the directive', () => {
  const root = build('prose-only', {
    home: { 'CLAUDE.md': 'Working style: run `/web-tools` to load the conventions.\n' },
  });
  const out = run(root);
  assert.match(out, /^Invoke \/portable:default now/, 'the directive leads, so it survives a truncated preview');
  assert.match(out, /did not get the surfacing conventions/, 'and gives the cause, so it outranks the ask in hand');
});

// The distinction the whole hook turns on, stated as a test because prose in
// two repos disagreed about it before: naming the skill is intent, importing it
// is delivery, and only delivery puts the text in context.
test('intent is not delivery: the same file wired both ways differs', () => {
  const intent = build('intent', { r: { 'CLAUDE.md': 'run /web-tools; see portable@web-tools\n' } });
  const delivery = build('delivery', {
    r: { 'CLAUDE.md': '@docs/SURFACING.md\n', 'docs/SURFACING.md': SURFACING },
  });
  assert.notEqual(run(intent), '', 'prose naming the plugin is not delivery');
  assert.equal(run(delivery), '', 'a resolved import is');
});

test('an opted-out repo is silent, and the field is the declared one', () => {
  const root = build('optout', {
    home: { 'CLAUDE.md': 'run /web-tools\n', '.web-tools.json': '{"conventions":"optout"}' },
  });
  assert.equal(run(root), '', 'an explicit opt-out stops the asking');
});

test('a manifest without a CLAUDE.md is not a repo this asks anything of', () => {
  const root = build('no-claude-md', { scratch: { '.web-tools.json': '{}' } });
  assert.equal(run(root), '', 'no import channel means nothing to be missing');
});

test('an import resolving to a file without the primitives does not count', () => {
  const root = build('wrong-target', {
    r: { 'CLAUDE.md': '@docs/OTHER.md\n', 'docs/OTHER.md': '# Something else\n' },
  });
  assert.notEqual(run(root), '', 'the marker is the heading, not the mere presence of an import');
});

// Every path exits 0 and prints nothing it cannot stand behind. execFileSync
// throws on a non-zero exit, so these assert the exit code by not throwing.
test('a dangling import, unreadable JSON, and a missing root all fail soft', () => {
  const dangling = build('dangling', { r: { 'CLAUDE.md': '@docs/GONE.md\n' } });
  assert.notEqual(run(dangling), '', 'an import that resolves to nothing has not delivered');

  const badJson = build('bad-json', {
    r: { 'CLAUDE.md': 'run /web-tools\n', '.web-tools.json': '{not json' },
  });
  assert.notEqual(run(badJson), '', 'an unparseable manifest is not an opt-out');

  assert.equal(run(path.join(tmp, 'does-not-exist')), '', 'a missing project root says nothing');
});

test('the plugin registers it as its OWN SessionStart entry, not inside the dispatcher', () => {
  // The harness output cap applies per hook entry: measured 2026-08-30, the
  // dispatcher's 28,670 characters were cut while a separate 298-character
  // SessionStart hook in the same session arrived whole. Folded in, this would
  // be the first thing truncated on a heavy session, which is the exact failure
  // that retired the injection channel.
  const hooks = JSON.parse(readFileSync(path.join(repoRoot, '.claude/skills/hooks/hooks.json'), 'utf8'));
  const entries = hooks.hooks.SessionStart;
  const commands = entries.map(e => e.hooks.map(h => h.command).join(' '));
  const mine = commands.filter(c => c.includes('conventions-nudge.sh'));
  assert.equal(mine.length, 1, 'registered exactly once');
  assert.equal(commands.filter(c => c.includes('session-dispatch.sh') && c.includes('conventions-nudge.sh')).length,
    0, 'it does not share an entry with the dispatcher, so it does not share a budget');
  assert.match(mine[0], /\$\{CLAUDE_PLUGIN_ROOT\}/, 'addressed through the plugin root, like its siblings');
  for (const e of entries) assert.equal(e.matcher, 'startup|resume', 'both entries fire on the same two events');
});

test('the directive fits the preview a truncated hook payload leaves', () => {
  const root = build('size', { home: { 'CLAUDE.md': 'run /web-tools\n' } });
  // 2,000 bytes is what the harness passes along when it decides an output is
  // too large (session-dispatch.sh's OUTPUT_BUDGET note). This should not be
  // anywhere near it, and if it grows past a quarter of it somebody is writing
  // a document into a nudge.
  assert.ok(Buffer.byteLength(run(root)) < 500,
    'a nudge is one instruction and its reason, not a summary of the conventions');
});

process.on('exit', () => rmSync(tmp, { recursive: true, force: true }));
