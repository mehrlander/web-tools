#!/usr/bin/env node
// The h plugin's skills, one per policy, written from docs/house-policies.md.
//
// docs/house-policies.md is authoritative. A `### Title · `h:a`` heading
// names its policy once, without a slash; the entry becomes
// plugins/h/skills/a/SKILL.md, holding the whole entry, so typing `/h:a` shows
// it. Every skill is user-only (disable-model-invocation), which keeps all of
// them out of the skill list a session's model reads.
//
// It refuses a heading with no name or more than one, a name two entries
// claim, and a name a skill cannot carry.
//
// --check compares bytes and writes nothing, which is what
// derived-artifacts.test.mjs runs.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const SOURCE = 'docs/house-policies.md';
const SKILLS = path.join(repoRoot, 'plugins', 'h', 'skills');
const BANNER = `<!-- Generated from ${SOURCE} by node/build/policy-skills.mjs; do not hand-edit. -->`;

export function entries(text) {
  const out = [];
  let cur = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('## ') || line.startsWith('### ')) {
      if (cur) out.push(cur);
      cur = null;
      if (line.startsWith('### ')) {
        const [title, list = ''] = line.slice(4).split(' · ');
        const names = [...list.matchAll(/`h:([^`]+)`/g)].map(m => m[1]);
        cur = { heading: line.slice(4), title: title.trim(), names, body: [] };
      }
    } else if (cur) cur.body.push(line);
  }
  if (cur) out.push(cur);
  return out.map(e => ({ ...e, body: e.body.join('\n').trim() }));
}

// A description holding a double quote is single-quoted, since YAML's
// double-quoted form writes it as \" and a rendered page shows that escape
// as text it cannot map back to the file.
const yamlString = (s) => (s.includes('"') ? `'${s.replace(/'/g, "''")}'` : JSON.stringify(s));

function skillFor(e, name) {
  const lede = e.body.split('\n\n')[0].replace(/\s+/g, ' ');
  return [
    '---',
    `name: ${name}`,
    `description: ${yamlString(`${e.title}: ${lede}`)}`,
    'disable-model-invocation: true',
    '---',
    '',
    BANNER,
    '',
    `# ${e.heading}`,
    '',
    e.body,
    '',
  ].join('\n');
}

const want = new Map();
const owner = new Map();
for (const e of entries(readFileSync(path.join(repoRoot, SOURCE), 'utf8'))) {
  if (e.names.length !== 1) throw new Error(`${SOURCE}: "${e.title}" must name one h: policy, without a slash`);
  for (const name of e.names) {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`${SOURCE}: h:${name} is not a valid skill name`);
    if (owner.has(name)) throw new Error(`${SOURCE}: h:${name} is claimed by "${owner.get(name)}" and "${e.title}"`);
    owner.set(name, e.title);
  }
  for (const name of e.names) want.set(name, skillFor(e, name));
}

const have = existsSync(SKILLS)
  ? readdirSync(SKILLS, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name) : [];
const extra = have.filter(n => !want.has(n));
const check = process.argv.includes('--check');
const behind = [];

for (const [name, text] of want) {
  const file = path.join(SKILLS, name, 'SKILL.md');
  let current = null;
  try { current = readFileSync(file, 'utf8'); } catch { /* not written yet */ }
  if (current === text) continue;
  if (check) { behind.push(name); continue; }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

if (check) {
  if (behind.length || extra.length) {
    console.error('plugins/h/skills is behind ' + SOURCE + ':' +
      (behind.length ? ' stale ' + behind.join(', ') + ';' : '') +
      (extra.length ? ' no entry for ' + extra.join(', ') + ';' : '') +
      "\nrun 'npm run policy-skills' and commit the result");
    process.exit(1);
  }
  process.exit(0);
}
for (const name of extra) rmSync(path.join(SKILLS, name), { recursive: true });
console.log(`policy-skills: ${want.size} skills from ${owner.size ? new Set(owner.values()).size : 0} entries`);
