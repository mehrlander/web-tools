#!/usr/bin/env node
// docs/house-policies.md and skills/peeves/peeves.md, written from the two
// lists they are: lists/house-policies.json and lists/peeves.json, files in
// the Lists view's shape (lib/kits/lists.js). The Markdown keeps the headings
// and anchors every citation names, and node/build/policy-skills.mjs and
// node/build/peeves-csv.mjs go on reading it.
//
// A list's `title` is the H1 and its header `note` the lead paragraph. Each
// item is one `### ` entry under the `## ` heading its `group` names, in item
// order. A policy's `note` is its whole body. A peeve's parts are fields: the
// `note` paragraph, `look_for`, an optional `owner`, and the metadata line.
//
// It refuses an item without an id or a title, an id two items claim, and a
// group that comes back after another group, since the Markdown would split it.
//
// --check compares bytes and writes nothing, which is what
// derived-artifacts.test.mjs runs.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const banner = (source) => `<!-- Generated from ${source} by node/build/lists-md.mjs; do not hand-edit. -->`;

const META = [['area', 'Area'], ['detector', 'Detector'], ['sessions', 'Sessions'], ['status', 'Status'], ['merged_into', 'Merged into']];

const peeveBody = (it) => {
  for (const k of ['note', 'look_for', 'area', 'detector', 'sessions', 'status'])
    if (it[k] === undefined || it[k] === '') throw new Error(`lists/peeves.json: ${it.id} has no ${k}`);
  return [
    it.note,
    `**Look for:** ${it.look_for}`,
    ...(it.owner ? [`**Owner:** ${it.owner}`] : []),
    META.filter(([k]) => it[k] !== undefined && it[k] !== '').map(([k, label]) => `**${label}:** ${it[k]}`).join(' · '),
  ].join('\n\n');
};

export const LISTS = [
  { source: 'lists/house-policies.json', target: 'docs/house-policies.md',
    heading: (it) => `${it.text} · \`h:${it.id}\``, body: (it) => it.note || '' },
  { source: 'lists/peeves.json', target: 'skills/peeves/peeves.md',
    heading: (it) => `${it.text} · \`${it.id}\``, body: peeveBody },
];

export function render(list, doc) {
  const parts = [banner(list.source), `# ${doc.title}`];
  if (doc.note) parts.push(doc.note);
  const ids = new Set(), groups = [];
  for (const it of doc.items) {
    if (!it.id || !it.text) throw new Error(`${list.source}: an item needs an id and a text`);
    if (ids.has(it.id)) throw new Error(`${list.source}: ${it.id} is claimed by two items`);
    ids.add(it.id);
    const group = it.group || '';
    if (group !== groups[groups.length - 1]) {
      if (groups.includes(group)) throw new Error(`${list.source}: ${it.id} returns to the group "${group}"; keep a group's items together`);
      groups.push(group);
      if (group) parts.push(`## ${group}`);
    }
    parts.push(`### ${list.heading(it)}`);
    const body = list.body(it).trim();
    if (body) parts.push(body);
  }
  return parts.join('\n\n').replace(/^(<!--.*-->)\n\n/, '$1\n') + '\n';
}

const check = process.argv.includes('--check');
const behind = [];
for (const list of LISTS) {
  const text = render(list, JSON.parse(readFileSync(path.join(repoRoot, list.source), 'utf8')));
  const file = path.join(repoRoot, list.target);
  let current = null;
  try { current = readFileSync(file, 'utf8'); } catch { /* not written yet */ }
  if (current === text) continue;
  if (check) behind.push(`${list.target} is behind ${list.source}`);
  else writeFileSync(file, text);
}
if (check) {
  if (behind.length) {
    console.error(behind.join('\n') + "\nrun 'npm run lists-md' and commit the result");
    process.exit(1);
  }
  process.exit(0);
}
console.log(`lists-md: ${LISTS.map(l => l.target).join(', ')}`);
