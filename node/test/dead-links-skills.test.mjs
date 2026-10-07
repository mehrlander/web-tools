// python/dead-links.py, the skill class: a living instruction file naming a
// portable skill that web-tools skills/manifest.csv does not list.
//
// Added 2026-10-07, after budget-wa, spend-wa and chat-histories were found
// still sending sessions to /portable:web-tools and /portable:caption, a day
// after home and spend-wa had been fixed by hand for the same thing. What is
// pinned here is what the class READS, since a reader that is too wide fails
// every consumer on prose and a reader that is too narrow passes the retired
// name it exists for:
//
//   read      /portable:<name> anywhere in CLAUDE.md, code spans included;
//             skills/<name>/ inside a web-tools URL; in web-tools itself,
//             skills/<name>/ in a code span or a link target
//   not read  the same names in a file that is not an instruction file (a
//             dated record names a retired skill as history); the scanned
//             repo's own .claude/skills/<name>/; skills/<name>/ in bare prose;
//             skills/hooks/, the one folder under skills/ that is not a skill
//
// Each case runs a COPY of the script from inside a scratch layout, because
// the manifest resolves from the script's own checkout before a sibling, and
// the real checkout would answer every case with the real manifest.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const script = path.join(repoRoot, 'python', 'dead-links.py');

function put(root, rel, text) {
  const p = path.join(root, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, text);
}

function gitRepo(dir, files) {
  for (const [rel, text] of Object.entries(files)) put(dir, rel, text);
  execFileSync('git', ['init', '-q', dir]);
  execFileSync('git', ['-C', dir, 'add', '-A']);
}

function run(scriptCopy, root) {
  try {
    return { code: 0, out: execFileSync('python3', [scriptCopy, root, '--check'], { encoding: 'utf8', stdio: 'pipe' }) };
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const MANIFEST = 'name,group,description\ntasks,repo,"the tracker"\ndefault,repo,"the conventions"\n';

function withLayout(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'dead-links-skills-'));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('a consumer CLAUDE.md naming a skill the manifest lacks fails --check', () => withLayout((dir) => {
  gitRepo(path.join(dir, 'web-tools'), {
    'skills/manifest.csv': MANIFEST,
    'skills/tasks/SKILL.md': '# tasks\n',
  });
  const consumer = path.join(dir, 'consumer');
  gitRepo(consumer, {
    'CLAUDE.md': [
      'Run the `web-tools` skill (`/portable:web-tools`) at session start.',
      'Boards regenerate through `/portable:tasks`.',
      'Fetch [the skill](https://raw.githubusercontent.com/mehrlander/web-tools/main/skills/caption/SKILL.md).',
      'Our own skill lives at `.claude/skills/drain/SKILL.md`.',
      'The template is `/portable:<name>`.',
    ].join('\n'),
    'chron/2026/09/old.md': 'Sessions used to run `/portable:web-tools`.\n',
    '.claude/skills/drain/SKILL.md': 'Then run `/portable:default`.\n',
  });
  const copy = path.join(consumer, '.web-tools-scripts', 'dead-links.py');
  mkdirSync(path.dirname(copy), { recursive: true });
  copyFileSync(script, copy);

  const { code, out } = run(copy, consumer);
  assert.equal(code, 1, out);
  assert.match(out, /== skill: 2 dead/);
  assert.match(out, /CLAUDE\.md:1 {2}\[\/portable:web-tools\] -> no skill named web-tools/);
  assert.match(out, /CLAUDE\.md:3 {2}\[skills\/caption\] -> no skill named caption/);
  assert.doesNotMatch(out, /\/portable:tasks\]/, 'a listed skill is not reported');
  assert.doesNotMatch(out, /chron\/2026/, 'a dated record is not an instruction file');
  assert.doesNotMatch(out, /skills\/drain/, "the repo's own .claude/skills/ folder is not web-tools'");
}));

test('in web-tools itself, a path to a removed skill is read from code, not from prose', () => withLayout((dir) => {
  const wt = path.join(dir, 'web-tools');
  gitRepo(wt, {
    'skills/manifest.csv': MANIFEST,
    'skills/tasks/SKILL.md': [
      'Its companion is `skills/gone/SKILL.md`, and [the default](../../skills/default/SKILL.md).',
      'It uses your real tools, skills/plugins/connectors and all.',
      'The hooks sit at `skills/hooks/hooks.json`.',
      '```bash',
      'python3 skills/retired/run.py',
      '```',
    ].join('\n'),
    'skills/default/SKILL.md': '# default\n',
  });
  const copy = path.join(wt, 'python', 'dead-links.py');
  mkdirSync(path.dirname(copy), { recursive: true });
  copyFileSync(script, copy);

  const { code, out } = run(copy, wt);
  assert.equal(code, 1, out);
  assert.match(out, /== skill: 2 dead/);
  assert.match(out, /skills\/tasks\/SKILL\.md:1 {2}\[skills\/gone\]/, 'a code span is read');
  assert.match(out, /skills\/tasks\/SKILL\.md:5 {2}\[skills\/retired\]/, 'a fence is read');
  assert.doesNotMatch(out, /skills\/plugins/, 'bare prose is not read');
  assert.doesNotMatch(out, /skills\/hooks/, 'hooks/ is a folder, not a skill');
}));

test('with no manifest on disk a reference is unverifiable, never dead', () => withLayout((dir) => {
  const lonely = path.join(dir, 'lonely');
  gitRepo(lonely, { 'CLAUDE.md': 'Run `/portable:web-tools` first.\n' });
  const copy = path.join(lonely, '.web-tools-scripts', 'dead-links.py');
  mkdirSync(path.dirname(copy), { recursive: true });
  copyFileSync(script, copy);

  const { code, out } = run(copy, lonely);
  assert.equal(code, 0, out);
  assert.match(out, /0 dead, 1 unverifiable/);
  assert.match(out, /no web-tools manifest/);
}));
