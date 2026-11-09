#!/usr/bin/env node
// skills/peeves/peeves.csv, written from skills/peeves/peeves.md.
//
// peeves.md is authoritative. Each `### Name · `Pnn`` heading opens an entry:
// one paragraph holding the peeve, a `**Look for:**` line, an optional
// `**Owner:**` line, and a metadata line of `**Key:** value` pairs joined by
// ` · ` (Area, Detector, Sessions, Status, and Merged into when it applies).
// The CSV keeps one row per entry in id order, for the Map view, the peeves
// critic and the scripts that read the list.
//
// It refuses an entry missing a part, a part it does not recognize, an unknown
// metadata key, and an id two entries claim, so the format stays rigid enough
// to parse.
//
// --check compares bytes and writes nothing, which is what
// derived-artifacts.test.mjs runs.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';
import { writeCsv } from './registries-load.mjs';

const SOURCE = 'skills/peeves/peeves.md';
const TARGET = 'skills/peeves/peeves.csv';
const COLS = ['id', 'name', 'area', 'peeve', 'look_for', 'owner', 'detector', 'sessions', 'status', 'merged_into'];
const META = { 'Area': 'area', 'Detector': 'detector', 'Sessions': 'sessions', 'Status': 'status', 'Merged into': 'merged_into' };

export function entries(text) {
  const out = [];
  let cur = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('#')) {
      if (cur) out.push(cur);
      cur = null;
      if (line.startsWith('### ')) {
        const m = line.slice(4).match(/^(.+) · `(P\d{2,})`$/);
        if (!m) throw new Error(`${SOURCE}: "${line}" must read "### Name · \`Pnn\`"`);
        cur = { heading: line, name: m[1], id: m[2], blocks: [] };
      }
    } else if (cur) cur.blocks.push(line);
  }
  if (cur) out.push(cur);
  return out.map(parse);
}

function parse(e) {
  const row = Object.fromEntries(COLS.map(c => [c, '']));
  Object.assign(row, { id: e.id, name: e.name });
  const blocks = e.blocks.join('\n').split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  const peeve = [];
  for (const b of blocks) {
    if (b.includes('\n')) throw new Error(`${SOURCE}: ${e.id} has a part broken across lines`);
    if (b.startsWith('**Look for:** ')) row.look_for = b.slice(14);
    else if (b.startsWith('**Owner:** ')) row.owner = b.slice(11);
    else if (b.startsWith('**Area:** ')) {
      for (const pair of b.split(' · ')) {
        const m = pair.match(/^\*\*([^*]+):\*\* (.+)$/);
        if (!m || !META[m[1]]) throw new Error(`${SOURCE}: ${e.id} has an unknown metadata part "${pair}"`);
        row[META[m[1]]] = m[2];
      }
    } else if (b.startsWith('**')) throw new Error(`${SOURCE}: ${e.id} has an unrecognized part "${b.slice(0, 40)}"`);
    else peeve.push(b);
  }
  if (peeve.length !== 1) throw new Error(`${SOURCE}: ${e.id} needs exactly one paragraph stating the peeve`);
  row.peeve = peeve[0];
  for (const c of ['look_for', 'area', 'detector', 'sessions', 'status'])
    if (!row[c]) throw new Error(`${SOURCE}: ${e.id} has no ${c}`);
  return row;
}

const rows = entries(readFileSync(path.join(repoRoot, SOURCE), 'utf8'));
const seen = new Set();
for (const r of rows) {
  if (seen.has(r.id)) throw new Error(`${SOURCE}: ${r.id} is claimed by two entries`);
  seen.add(r.id);
}
rows.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
const text = writeCsv(rows, COLS);
const file = path.join(repoRoot, TARGET);
let current = null;
try { current = readFileSync(file, 'utf8'); } catch { /* not written yet */ }

if (process.argv.includes('--check')) {
  if (current !== text) {
    console.error(`${TARGET} is behind ${SOURCE}\nrun 'npm run peeves-csv' and commit the result`);
    process.exit(1);
  }
  process.exit(0);
}
if (current !== text) writeFileSync(file, text);
console.log(`peeves-csv: ${rows.length} rows from ${SOURCE}`);
