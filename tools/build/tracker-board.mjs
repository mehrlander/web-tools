#!/usr/bin/env node
// Regenerate tracker/board.md from tracker/tasks/*.md.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tasksDir = path.join(root, 'tracker/tasks');
const outFile = path.join(root, 'tracker/board.md');

function parseFrontmatter(text) {
  const parts = text.split('---');
  if (parts.length < 3) return {};
  const d = {};
  for (const line of parts[1].trim().split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) d[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return d;
}

const files = (await readdir(tasksDir)).filter(f => f.endsWith('.md')).sort();
const tasks = await Promise.all(
  files.map(async f => parseFrontmatter(await readFile(path.join(tasksDir, f), 'utf8')))
);

const buckets = { backlog: [], 'in-progress': [], blocked: [], done: [] };
for (const m of tasks) {
  (buckets[m.status] || buckets.backlog).push(m);
}

function row(m) {
  const who = m.session ? ` (\`${m.session}\`)` : '';
  const nxt = m.next ? ` next: ${m.next}` : '';
  return `- ${m.title || '(untitled)'}${who}${nxt}`;
}

const lines = ['# Board', '', '_Generated from tasks/. Do not hand-edit._', ''];
for (const [head, key] of [['On deck', 'backlog'], ['In progress', 'in-progress'],
                            ['Blocked', 'blocked'], ['Done', 'done']]) {
  lines.push(`## ${head}`);
  const rows = buckets[key].map(row);
  lines.push(...(rows.length ? rows : ['- (none)']));
  lines.push('');
}

await writeFile(outFile, lines.join('\n'));
