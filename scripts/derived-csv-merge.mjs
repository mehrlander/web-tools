#!/usr/bin/env node
// scripts/derived-csv-merge.mjs: a git merge driver for this repo's registry
// CSVs, so two branches stop conflicting on numbers neither of them wrote.
//
//   node scripts/derived-csv-merge.mjs <base> <ours> <theirs> <path>
//
// Git calls it with %O %A %B %P and reads the result back out of <ours>. Exit 0
// means resolved; any non-zero exit leaves git to report a normal conflict,
// which is this file's answer to everything it does not fully understand.
//
// WHY IT EXISTS, measured rather than supposed. docs/docs.csv stores a word
// count for every document INCLUDING the generated registries, so appending one
// row to docs/tests.csv moves a number in a third file that neither branch
// edited. Two branches that each add a test therefore collide on a line no
// human wrote. That would be a two-minute annoyance except for what follows it:
// a conflicted pull request has no merge ref, a `pull_request` run is computed
// against the merge ref, so NO CI RUN STARTS and the head sits at zero checks
// with nothing saying why. Both halves are in docs/SNAGS.md, at
// `derived-field-conflicts-per-branch` (whose own pointer proposed this fix "if
// it recurs") and `ci-run-silently-not-started`, which is at six sightings.
//
// THE DECLARATION IT READS ALREADY EXISTED, which is what makes this safe
// rather than clever. docs/properties.csv marks every registry column `computed`
// (with the deriver that writes it) or `recorded` (authored by a person), and
// docs/registries.csv gives each registry its key column. So the driver never
// guesses which cells are safe to overwrite:
//
//   computed cell  -> take ours and move on. Whatever it says is wrong on both
//                     sides after a merge anyway; the deriver restamps it, and
//                     tools/test/derived-artifacts.test.mjs fails loudly until
//                     someone runs it. A stale number is a red check; a
//                     conflict is no check at all, and red beats silent.
//   recorded cell  -> a strict three-way merge. Only one side changed it, that
//                     side wins. Both changed it the same way, fine. Both
//                     changed it differently, CONFLICT, because that is a
//                     person's sentence and no rule here can pick.
//
// Rows are unioned on the key, so each side's new rows survive. That is the
// half docs/SNAGS.md `merge-drops-authored-csv-cells` warns about: taking one
// side wholesale drops the other side's authored rows, and the deriver then
// refills them blank. This driver never takes a side wholesale.
//
// It is registered per clone by .claude/hooks/session-githooks.sh, beside the
// core.hooksPath line, because a merge driver lives in git config and config is
// not cloned. A clone that never ran that hook falls back to today's behaviour:
// an ordinary conflict, resolved by hand. Nothing here is load-bearing for
// correctness, only for friction.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, writeCsv } from '../tools/build/registries-load.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Exit 1 is not a failure of this script, it is its considered answer: hand the
// file back to git as a normal conflict. Every unknown shape lands here.
const bail = (why) => { console.error(`derived-csv-merge: ${why}; leaving a normal conflict`); process.exit(1); };

const [basePath, oursPath, theirsPath, filePath] = process.argv.slice(2);
if (!basePath || !oursPath || !theirsPath || !filePath) bail('expected <base> <ours> <theirs> <path>');

// Which registry is this, and what does it declare?
const registries = parseCsv(readFileSync(path.join(repoRoot, 'docs/registries.csv'), 'utf8'));
const properties = parseCsv(readFileSync(path.join(repoRoot, 'docs/properties.csv'), 'utf8'));

const norm = (p) => String(p).replace(/\\/g, '/');
const registry = registries.find(r => norm(r.path) === norm(filePath));
if (!registry) bail(`${filePath} is not a registry in docs/registries.csv`);

// A composite key is declared as "a+b", which is exactly how the registry rows
// spell it (themes is a+b, tracker-tags is task+tag).
const keyCols = String(registry.key || '').split('+').map(s => s.trim()).filter(Boolean);
if (!keyCols.length) bail(`registry ${registry.id} declares no key`);

const computed = new Set(properties
  .filter(p => p.registry === registry.id && p.mode === 'computed')
  .map(p => p.property));

const read = (p) => {
  const text = readFileSync(p, 'utf8');
  const rows = parseCsv(text);
  const header = String(text.split(/\r?\n/)[0] || '').trim();
  return { rows, header, cols: header ? header.split(',').map(c => c.replace(/^"|"$/g, '')) : [] };
};

const base = read(basePath), ours = read(oursPath), theirs = read(theirsPath);

// A schema change is a person's decision and REGISTRY_COLS warns what a silent
// one costs, so the driver refuses rather than picking a header.
if (ours.header !== theirs.header) bail('the two sides disagree on the header');
const cols = ours.cols;
if (!keyCols.every(k => cols.includes(k))) bail(`the key ${registry.key} is not in the header`);

const keyOf = (row) => keyCols.map(k => row[k] ?? '').join('');

const index = (side) => {
  const m = new Map();
  for (const row of side.rows) {
    const k = keyOf(row);
    // A duplicate key means the declared key does not identify a row, so the
    // whole row-merge below rests on nothing. Refuse.
    if (m.has(k)) return null;
    m.set(k, row);
  }
  return m;
};

const B = index(base), O = index(ours), T = index(theirs);
if (!B || !O || !T) bail(`the declared key ${registry.key} is not unique in one of the three sides`);

const conflicts = [];

// One cell, three ways. `computed` short-circuits: the deriver owns it.
function mergeCell(col, key, b, o, t) {
  if (o === t) return o;
  if (computed.has(col)) return o;
  if (b === o) return t;
  if (b === t) return o;
  conflicts.push(`${key.replace(//g, '+')} / ${col}`);
  return o;
}

const keys = [...new Set([...O.keys(), ...T.keys(), ...B.keys()])];
const merged = [];
for (const k of keys) {
  const b = B.get(k), o = O.get(k), t = T.get(k);
  // Deleted on one side, untouched on the other: honour the deletion. Deleted
  // on one side and edited on the other is a real disagreement.
  if (!o && !t) continue;
  if (!o) { if (b && JSON.stringify(b) !== JSON.stringify(t)) conflicts.push(`${k} (deleted here, edited there)`); else if (!b) merged.push(t); continue; }
  if (!t) { if (b && JSON.stringify(b) !== JSON.stringify(o)) conflicts.push(`${k} (edited here, deleted there)`); else if (!b) merged.push(o); continue; }
  merged.push(Object.fromEntries(cols.map(c => [c, mergeCell(c, k, b?.[c] ?? '', o[c] ?? '', t[c] ?? '')])));
}

if (conflicts.length) bail(`${conflicts.length} authored cell(s) changed on both sides: ${conflicts.slice(0, 5).join(', ')}`);

// Row ORDER is not merged and does not need to be: every one of these files is
// written by a deriver that sorts, so the next restamp normalises it. Ours
// first, then rows only theirs had, which keeps the diff small in the common
// case where one side only appended.
const seen = new Set();
const ordered = [];
for (const row of ours.rows) { const k = keyOf(row); if (!seen.has(k)) { const m = merged.find(x => keyOf(x) === k); if (m) { ordered.push(m); seen.add(k); } } }
for (const row of merged) { const k = keyOf(row); if (!seen.has(k)) { ordered.push(row); seen.add(k); } }

writeFileSync(oursPath, writeCsv(ordered, cols));
console.error(`derived-csv-merge: ${filePath} resolved (${ordered.length} rows; ${computed.size} computed column(s) left to the deriver)`);
process.exit(0);
