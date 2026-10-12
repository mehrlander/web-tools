// A plugin skill that names another skill is pointing a session at it, so the
// named skill has to travel in the plugin, or be supplied by the host and
// recorded as referenced. Added 2026-09-27, when the portable plugin took in
// the whole library and google-style-clarity was removed: before that, a skill
// could name a library skill that a consumer session only reached by a
// deliberate load, and a removed skill could stay named with nothing to say so.
//
// A referenced skill is a row of docs/upstream-skills.csv with status
// `referenced`: someone else's skill that a plugin skill uses and the plugin
// does not ship. The claude.ai account supplies it to Claude Code cloud
// sessions; a link pinned to the row's commit supplies it everywhere else. Added 2026-10-12,
// when portable's declared dependency on two Anthropic plugins was removed. The
// dependency made the whole plugin refuse to load wherever those two were not
// installed, and two skills used any of the six they carried.
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
import { parseCsv } from '../build/registries-load.mjs';

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

const upstreams = parseCsv(readFileSync(path.join(repoRoot, 'docs', 'upstream-skills.csv'), 'utf8'));
const referenced = upstreams.filter(r => r.status === 'referenced').map(r => {
  const [repo, folder] = r.upstream.split(':');
  return { ...r, repo, folder, name: path.posix.basename(folder) };
});
const referencedNames = new Set(referenced.map(r => r.name));

// A link to a folder or file at a ref: github.com/<owner>/<repo>/tree|blob/<ref>/<path>.
const LINK = /https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/(?:tree|blob)\/([^/\s)]+)\/([^\s)#]+)/g;

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
          if (!carried.has(name) && !referencedNames.has(name) && !PLATFORM.has(name)) {
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

function skillLinks() {
  const out = [];
  for (const skill of carried) {
    for (const file of markdownUnder(path.join(source, skill))) {
      for (const [url, repo, ref, rest] of readFileSync(file, 'utf8').matchAll(LINK)) {
        out.push({ file: path.relative(repoRoot, file), url, repo, ref, rest: rest.replace(/\/$/, '') });
      }
    }
  }
  return out;
}

const inFolder = (link, row) =>
  link.repo === row.repo && (link.rest === row.folder || link.rest.startsWith(row.folder + '/'));

test('a link into a referenced upstream names a referenced folder at its pinned commit', () => {
  const repos = new Set(referenced.map(r => r.repo));
  const bad = [];
  for (const link of skillLinks().filter(l => repos.has(l.repo))) {
    const row = referenced.find(r => inFolder(link, r));
    if (!row) bad.push(`${link.file}: ${link.url} is in no referenced folder; add a row or drop the link`);
    else if (!/^[0-9a-f]{40}$/.test(link.ref) || !link.ref.startsWith(row.pinned))
      bad.push(`${link.file}: ${link.url} is not at ${row.id}'s pinned commit ${row.pinned}`);
  }
  assert.deepEqual(bad, []);
});

test('every referenced upstream is pinned and linked from a plugin skill', () => {
  const links = skillLinks();
  for (const row of referenced) {
    assert.match(row.pinned, /^[0-9a-f]{12}$/, `${row.id}: a referenced row names the commit its links point at`);
    assert.ok(links.some(l => inFolder(l, row)), `${row.id} is marked referenced, but no plugin skill links to it`);
    assert.ok(!carried.has(row.name), `${row.id}: the plugin carries ${row.name}, so it is not only referenced`);
  }
});
