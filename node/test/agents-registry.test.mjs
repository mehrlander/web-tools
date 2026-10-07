// docs/agents.csv — the agent roster: every agent the hub ships as a Claude
// Code definition file, and every reader role a hub skill spawns through the
// Agent tool with its prompt written into the skill.
//
// The two kinds are held differently because their sources differ. A
// definition is a file the platform loads, so its row's model, tools and
// preloads are copies of that file's frontmatter and are compared field by
// field, and the set of definition rows is held two ways against the plugin's
// agents/ folder. An inline reader has no file of its own and no name the
// platform knows; its row quotes the phrase that introduces the role, and the
// gate requires the skill to still contain it, so a renamed or removed role
// fails here rather than leaving a row describing nothing. Coverage of inline
// readers is curated: no scanner can tell a reader role from a passing mention
// of a subagent, so a skill that grows a new reader needs a row by hand.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const rows = parseCsv(readFileSync(path.join(repoRoot, 'docs', 'agents.csv'), 'utf8'));
const AGENTS_DIR = 'skills/agents';
const NAMESPACE = 'portable';

// The frontmatter subset agent files use: `key: value` lines, and a key with
// an empty value followed by `  - item` lines as a list.
function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(m, 'no frontmatter block');
  const out = {};
  let listKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) { out[listKey].push(item[1].trim()); continue; }
    const kv = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (!kv) continue;
    listKey = kv[2] === '' ? kv[1] : null;
    out[kv[1]] = kv[2] === '' ? [] : kv[2].trim();
  }
  return out;
}
const asList = (v) => (Array.isArray(v) ? v : String(v || '').split(','))
  .map(s => s.trim()).filter(Boolean).join(';');

test('every row has a unique namespaced id and a file that exists', () => {
  const ids = rows.map(r => r.id);
  assert.equal(new Set(ids).size, ids.length, 'an agent id appears twice');
  for (const r of rows) {
    assert.match(r.id, /^[a-z0-9-]+:[a-z0-9-]+$/, `${r.id}: id is <namespace>:<name>`);
    assert.ok(r.role, `${r.id}: no role`);
    assert.ok(existsSync(path.join(repoRoot, r.path)), `${r.id}: missing file ${r.path}`);
  }
});

test('a definition row copies its file\'s frontmatter exactly', () => {
  for (const r of rows.filter(r => r.kind === 'definition')) {
    const fm = frontmatter(readFileSync(path.join(repoRoot, r.path), 'utf8'));
    assert.equal(r.id, `${NAMESPACE}:${fm.name}`, `${r.path}: id is the plugin namespace plus the file's name`);
    assert.equal(path.basename(r.path, '.md'), fm.name, `${r.path}: file name and frontmatter name differ`);
    assert.ok(fm.description, `${r.path}: no description, so a session cannot know when to summon it`);
    assert.equal(r.model || '', fm.model || '', `${r.id}: model`);
    assert.equal(r.tools || '', asList(fm.tools), `${r.id}: tools`);
    assert.equal(r.preloads || '', asList(fm.skills), `${r.id}: preloads`);
    assert.equal(r.anchor || '', '', `${r.id}: a definition is its own file and takes no anchor`);
    assert.ok(r.team, `${r.id}: a definition belongs to a team, the tab it shows under`);
    // The icon is drawn in the project-icon system, so it carries a title and
    // one fill, and draws nothing with strokes.
    assert.ok(r.icon && existsSync(path.join(repoRoot, r.icon)), `${r.id}: no icon file at ${r.icon}`);
    const svg = readFileSync(path.join(repoRoot, r.icon), 'utf8');
    assert.match(svg, /<title>[^<]+<\/title>/, `${r.icon}: no <title>`);
    assert.doesNotMatch(svg, /stroke=/, `${r.icon}: strokes; the icon system is solid ink`);
    assert.equal(new Set(svg.match(/fill="#[0-9a-f]{6}"/gi) || []).size, 1, `${r.icon}: one colour`);
  }
});

test('the definition rows are exactly the files in the plugin\'s agents folder', () => {
  const dir = path.join(repoRoot, AGENTS_DIR);
  const onDisk = existsSync(dir)
    ? readdirSync(dir).filter(f => f.endsWith('.md')).map(f => `${AGENTS_DIR}/${f}`).sort() : [];
  const listed = rows.filter(r => r.kind === 'definition').map(r => r.path).sort();
  assert.deepEqual(listed, onDisk, 'a definition file has no row, or a row names no file');
});

test('an inline reader still appears where its row says it does', () => {
  for (const r of rows.filter(r => r.kind === 'inline')) {
    const skill = r.path.match(/^skills\/([^/]+)\//)?.[1];
    assert.ok(skill, `${r.id}: an inline reader lives inside a skill folder`);
    assert.equal(r.id.split(':')[0], skill, `${r.id}: the namespace is the skill that spawns it`);
    assert.ok(r.anchor, `${r.id}: no anchor, so nothing ties the row to the skill's text`);
    const text = readFileSync(path.join(repoRoot, r.path), 'utf8');
    assert.ok(text.includes(r.anchor),
      `${r.id}: "${r.anchor}" is no longer in ${r.path}; the role moved, was renamed, or is gone`);
    assert.equal((r.tools || '') + (r.preloads || ''), '',
      `${r.id}: tools and preloads are frontmatter fields, and an inline reader has no frontmatter`);
    assert.equal((r.team || '') + (r.icon || ''), '',
      `${r.id}: an inline reader belongs to its skill, so it takes no team and no icon`);
  }
});
