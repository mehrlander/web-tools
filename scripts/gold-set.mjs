#!/usr/bin/env node
// scripts/gold-set.mjs — regenerate the sheet picker's gold set: a handful of
// real workbooks rebuilt with a sheet dropped from each, for someone to open in
// Excel. That is the third of the three checks named for this work, and the
// only one no sandbox can run.
//
//   npm run gold-set              -> ./gold-set/ (gitignored)
//   npm run gold-set -- <out dir> [--from <dir of workbooks>]
//
// WHY THIS REGENERATES RATHER THAN THE FILES BEING COMMITTED. The estate's
// size discipline says a derived artifact stays out of the tree when its
// builder is committed and deterministic AND its inputs are durably sourced.
// All three now hold: kits/xlsx-write.js and this script are committed, the
// rebuild is byte-reproducible (held by tools/test/xlsx-write.test.mjs, and it
// was not until the entry timestamps were pinned), and the source workbooks are
// committed in mehrlander/home. Committing four .xlsm files would also put them
// a commit behind the kit the first time the kit changes, and a stale gold set
// answers a question about code nobody is running.
//
// The default source is the OFM 2027-29 budget instruction forms in the sibling
// `home` checkout, which is the layout the estate assumes elsewhere (home's own
// CLAUDE.md runs `python3 ../web-tools/scripts/showing.py`). Pass --from for
// any other directory of workbooks.

import { mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_FROM = path.resolve(repoRoot, '..', 'home', 'projects', 'budget-drs', 'submittal',
  'source-docs', '2026-06-13-ofm-instructions', 'part1-operating-transportation', 'forms');

const args = process.argv.slice(2);
const at = (n) => { const i = args.indexOf(`--${n}`); return i < 0 ? null : args[i + 1]; };
const from = at('from') || DEFAULT_FROM;
const out = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--from')
         || path.join(repoRoot, 'gold-set');

if (!existsSync(from)) {
  console.error(`gold-set: no workbooks at ${from}`);
  console.error('That is the sibling `home` checkout. Clone it next to this repo, or pass');
  console.error('  npm run gold-set -- <out dir> --from <a directory of .xlsx/.xlsm files>');
  process.exit(1);
}

mkdirSync(out, { recursive: true });
const r = spawnSync(process.execPath,
  [path.join(repoRoot, 'scripts', 'xlsx-picker-sweep.mjs'), from, '--out', out, '--manifests'],
  { cwd: repoRoot, stdio: 'inherit' });

if (r.status === 0) {
  console.log(`\nOpen these in Excel. Each .md beside a workbook is its manifest: what the`);
  console.log(`rebuild carried, what it dropped, and what the package check found.`);
  console.log(`  ${out}`);
}
process.exit(r.status ?? 1);
