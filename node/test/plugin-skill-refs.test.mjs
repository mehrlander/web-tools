// A plugin skill that names another skill is pointing a session at it, so the
// named skill has to travel in the plugin or a declared dependency. Added 2026-09-27, when the
// portable plugin took in the whole library and google-style-clarity was
// removed: before that, a skill could name a library skill that a consumer
// session only reached by a deliberate load, and a removed skill could stay
// named with nothing to say so.
//
// Two reference shapes are checked, both unambiguous in prose: the namespaced
// command `/portable:<name>`, and a backticked name followed by the word
// skill ("the `tasks` skill"). Bare "the x skill" and bare `/x` were measured
// on the day this was written and are mostly ordinary words and URL paths, so
// they are not read.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const marketplace = JSON.parse(
  readFileSync(path.join(repoRoot, '.claude-plugin', 'marketplace.json'), 'utf8'));
const portable = marketplace.plugins.find(p => p.name === 'portable');
const source = path.join(repoRoot, portable.source);
const carried = new Set(portable.skills.map(s => path.posix.basename(s)));

// Skills a plugin skill may name because the platform supplies them, not this
// plugin. Each entry says where it comes from.
const PLATFORM = new Map([
  ['dataviz', 'bundled with Claude; html-style cites its stat-tile heuristic to overrule it'],
]);

const dependencies = marketplace.plugins.filter(p =>
  (portable.dependencies || []).includes(p.name));
const supplied = new Set(dependencies.flatMap(p => p.skills.map(s => path.posix.basename(s))));

const PATTERNS = [
  /\/portable:([a-z][\w-]*)/g,
  /`\/?([a-z][\w-]*)` skill\b/g,
];

function markdownUnder(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...markdownUnder(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

test('every skill a plugin skill names is carried by the plugin', () => {
  const missing = [];
  for (const skill of carried) {
    for (const file of markdownUnder(path.join(source, skill))) {
      const text = readFileSync(file, 'utf8');
      for (const re of PATTERNS) {
        for (const [, name] of text.matchAll(re)) {
          if (!carried.has(name) && !supplied.has(name) && !PLATFORM.has(name)) {
            missing.push(`${path.relative(repoRoot, file)} names "${name}"`);
          }
        }
      }
    }
  }
  assert.deepEqual(missing, [],
    'a plugin skill names a skill the plugin does not carry; add it to the roster in ' +
    '.claude-plugin/marketplace.json, or change the reference');
});

test('the platform allowlist names nothing the plugin now carries', () => {
  for (const name of PLATFORM.keys()) {
    assert.ok(!carried.has(name), `${name} is carried now; drop it from PLATFORM`);
  }
});

test('external commands name a declared dependency and an exposed skill', () => {
  const exposed = new Set(dependencies.flatMap(p => p.skills.map(s => `${p.name}:${path.posix.basename(s)}`)));
  for (const skill of carried) {
    for (const file of markdownUnder(path.join(source, skill))) {
      const text = readFileSync(file, 'utf8');
      for (const [, command] of text.matchAll(/\/(third-party-(?:documents|authoring):[a-z][\w-]*)/g)) {
        assert.ok(exposed.has(command), `${file}: ${command} is not supplied by a declared dependency`);
      }
    }
  }
});

test('third-party dependencies stay separate and use a pinned official source', () => {
  const expected = ['doc-coauthoring', 'docx', 'pdf', 'pptx', 'skill-creator', 'xlsx'];
  assert.deepEqual([...supplied].sort(), expected);
  assert.equal(dependencies.length, 2);
  for (const p of dependencies) {
    assert.equal(p.source.source, 'git-subdir');
    assert.equal(p.source.url, 'https://github.com/anthropics/skills.git');
    assert.equal(p.source.path, 'skills');
    assert.match(p.source.sha, /^[a-f0-9]{40}$/);
    assert.equal(p.author.name, 'Anthropic');
    for (const s of p.skills) assert.ok(!carried.has(path.posix.basename(s)), `${s} is still presented as personal`);
  }
});
