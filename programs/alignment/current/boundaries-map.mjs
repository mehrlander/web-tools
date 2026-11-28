#!/usr/bin/env node
// The boundaries map: items the text work raises placement questions about,
// one row each in boundaries.csv beside this file. Two columns are measured:
//   project  the home project whose folder holds the path (projects/<name>/…)
//   program  the web-tools program whose `governs` list in .web-tools.json
//            covers the path, by exact match or folder prefix
// named_by, proposed and basis are recorded by hand; their entity ids are the
// ENTITIES below.
//
//   node programs/alignment/current/boundaries-map.mjs          rewrites project and program
//   node programs/alignment/current/boundaries-map.mjs --check  exit 1 if either is stale,
//        an entity id is unknown, or a path is missing from a checkout that is present
//
// A path in mehrlander/home is checked against a clone beside this checkout
// (../home) when one exists, and skipped when none does.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, writeCsv } from '../../../node/build/registries-load.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const hub = path.resolve(here, '../../..');
const FILE = path.join(here, 'boundaries.csv');
const COLS = ['item', 'label', 'group', 'path', 'project', 'program', 'named_by', 'proposed', 'basis'];
export const ENTITIES = ['text', 'skill-lab', 'strategic-writing', 'local-models', 'content', 'discovery', 'sessions', 'alignment'];

const checkouts = { 'mehrlander/web-tools': hub, 'mehrlander/home': path.resolve(hub, '../home') };
const programs = JSON.parse(readFileSync(path.join(hub, '.web-tools.json'), 'utf8')).programs || [];

export function projectOf(loc) {
  const m = /^mehrlander\/home:projects\/([^/]+)\//.exec(loc);
  return m ? m[1] : '';
}

export function programOf(loc, progs = programs) {
  const [repo, p] = loc.split(/:(.*)/s);
  if (repo !== 'mehrlander/web-tools') return '';
  const hit = progs.find(g => (g.governs || []).some(f => f === p || (f.endsWith('/') && p.startsWith(f))));
  return hit ? hit.name : '';
}

const rows = parseCsv(readFileSync(FILE, 'utf8'));
const problems = [];
const fresh = rows.map(r => {
  const want = { ...r, project: projectOf(r.path), program: programOf(r.path) };
  for (const c of ['project', 'program']) {
    if ((r[c] || '') !== want[c]) problems.push(`${r.item}: ${c} is "${r[c] || ''}", measured "${want[c]}"`);
  }
  for (const id of [...(r.named_by || '').split(';'), r.proposed || ''].filter(Boolean)) {
    if (!ENTITIES.includes(id)) problems.push(`${r.item}: unknown entity "${id}"`);
  }
  const [repo, p] = r.path.split(/:(.*)/s);
  const root = checkouts[repo];
  if (!root) problems.push(`${r.item}: no checkout rule for ${repo}`);
  else if (existsSync(root) && !existsSync(path.join(root, p))) problems.push(`${r.item}: ${r.path} does not exist`);
  return want;
});

if (process.argv.includes('--check')) {
  if (problems.length) { problems.forEach(p => console.error(p)); process.exit(1); }
  console.log(`boundaries map: ${rows.length} rows current`);
} else {
  writeFileSync(FILE, writeCsv(fresh, COLS));
  const left = problems.filter(p => !/ (project|program) is /.test(p));
  left.forEach(p => console.error(p));
  console.log(`boundaries map: wrote ${fresh.length} rows`);
  if (left.length) process.exit(1);
}
