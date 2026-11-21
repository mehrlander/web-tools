#!/usr/bin/env node
// Regenerate docs/README.md from docs/docs.csv, the documentation registry.
//
//   node node/build/docs-readme.mjs         -> writes docs/README.md
//   node node/build/docs-readme.mjs --check -> exit 1 if stale (CI-friendly)
//
// The README used to be hand-kept and indexed well under half the folder; the
// registry's registry is complete by construction (docs-registry.test.mjs), so
// the index is now a projection of it. Subjects, statuses, and maintenance
// live in the registry: edit docs/docs.csv, never this file's output. Which
// docs are records is not a registry column: .gitattributes owns it as
// edit=write-once, read here through `git check-attr`.

import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseCsv } from './registries-load.mjs';
import { repoRoot } from '../repo-root.mjs';

const REG_PATH = path.join(repoRoot, 'docs', 'docs.csv');
const OUT_PATH = path.join(repoRoot, 'docs', 'README.md');

// Group order: the root first, then subfolders alphabetically; within a group
// the registry's own row order holds, so curation stays in one place.
function groups(documents) {
  const byDir = new Map();
  for (const d of documents) {
    const rel = d.path.replace(/^docs\//, '');
    const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '.';
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push(d);
  }
  return [...byDir.entries()]
    .sort(([a], [b]) => a === '.' ? -1 : b === '.' ? 1 : a.localeCompare(b));
}

// The registered paths .gitattributes holds write-once: the records.
function writeOnce(paths) {
  const out = spawnSync('git', ['check-attr', '--stdin', '-z', 'edit'],
    { cwd: repoRoot, input: paths.join('\0') }).stdout.toString().split('\0');
  const found = new Set();
  for (let i = 0; i + 2 < out.length; i += 3) if (out[i + 2] === 'write-once') found.add(out[i]);
  return found;
}

function render(reg) {
  const lines = [];
  lines.push('# docs');
  lines.push('');
  lines.push('<!-- GENERATED from docs/docs.csv by node/build/docs-readme.mjs; do not hand-edit. -->');
  lines.push('');
  lines.push('Reference docs that don\'t belong at the repo root. This index is generated');
  lines.push('from [`docs.csv`](docs.csv), the documentation registry, which also renders');
  lines.push('live in [the Web Tools app\'s Map → Docs → Inventory](https://mehrlander.github.io/web-tools/app/?view=map&tab=docs).');
  lines.push('A **record** (`edit=write-once` in `.gitattributes`) preserves a moment and is');
  lines.push('not edited once on main: a note corrects it; a **measured** doc carries dated');
  lines.push('observations and is corrected by re-probing; everything else is living and');
  lines.push('must stay correct.');
  lines.push('');
  const reach = {};
  for (const d of reg.documents) reach[d.reach] = (reach[d.reach] || 0) + 1;
  lines.push('**Reach** (derived by `node/build/docs-reach.mjs`, gated against the registry):');
  lines.push(`${reach.injected || 0} arrive in every session's context, ${reach.project || 0} are named by CLAUDE.md,`);
  lines.push(`${reach.skill || 0} by a skill, ${reach.app || 0} by a page or component. The remaining ${reach.orphan || 0} are`);
  lines.push('marked *(orphan)* below: nothing points at them except this index.');
  lines.push('');
  const records = writeOnce(reg.documents.map(d => d.path));
  for (const [dir, docs] of groups(reg.documents)) {
    lines.push(dir === '.' ? '## docs/' : `## docs/${dir}/`);
    lines.push('');
    for (const d of docs) {
      const rel = d.path.replace(/^docs\//, '');
      const name = rel.slice(rel.lastIndexOf('/') + 1);
      const marks = [];
      const status = records.has(d.path) ? 'record' : d.status;
      if (status && status !== 'living') marks.push(status);
      if (d.reach === 'orphan') marks.push('orphan');
      const tag = marks.length ? ` *(${marks.join(', ')})*` : '';
      lines.push(`- [\`${name}\`](${rel})${tag} — ${d.subject}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

const reg = { documents: parseCsv(await readFile(REG_PATH, 'utf8')) };
const want = render(reg);

if (process.argv.includes('--check')) {
  const have = await readFile(OUT_PATH, 'utf8').catch(() => '');
  if (have !== want) {
    console.error('docs/README.md is behind docs/docs.csv - run: npm run docs-readme');
    process.exit(1);
  }
} else {
  await writeFile(OUT_PATH, want);
  console.log('wrote docs/README.md');
}
