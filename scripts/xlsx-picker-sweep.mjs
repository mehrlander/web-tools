#!/usr/bin/env node
// scripts/xlsx-picker-sweep.mjs — run kits/xlsx-write.js over a directory of
// real workbooks and report, per file, what the rebuild cost.
//
// WHY THIS IS A SCRIPT AND NOT A TEST. The suite's fixture is synthesised, so
// it proves the engine handles the traps it was built to hold and proves
// nothing about workbooks nobody wrote for it. The evidence that the writer
// keeps what matters came from thirteen real OFM budget forms, and those are
// binaries living in a private repo: committing them here would put a
// megabyte of someone else's documents in a public tree to make one check
// convenient. So the corpus stays where it is and the runner is committed.
//
// It is also how the third check gets its candidates. A mechanical pass and a
// second reader can both be satisfied by a file Excel refuses, so the last
// word is a person opening the output, and --out writes the files to open.
//
//   node scripts/xlsx-picker-sweep.mjs <dir> [--keep-drop-last|--keep-all]
//                                            [--out <dir>] [--manifests]
//
// The default keeps every sheet but the last, which is the interesting case:
// it exercises the drop path on every file that has more than one sheet.
//
// Recorded run, 2026-09-14, against the OFM 2027-29 budget instruction forms
// in mehrlander/home (projects/budget-drs/submittal/source-docs/
// 2026-06-13-ofm-instructions/part1-operating-transportation/forms): thirteen
// files, every one rebuilt, every one passing verify(). No cell holding a
// value, a formula, or a style that renders was lost. What was lost, in full:
// hyperlinks where two share an anchor cell or one carries only a location
// fragment, per-sheet printerSettings, a VML drawing with no comments behind
// it, and the scope of sheet-local defined names. One caution the run also
// produced: the 505 KB, 94,450-cell reference workbook took 49 seconds, which
// is a main-thread figure a caller has to plan around.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import jsdomPkg from 'jsdom';
import { loadKit } from '../tools/test/bootstrap.mjs';

const { JSDOM } = jsdomPkg;
globalThis.DOMParser = new JSDOM('').window.DOMParser;

const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--'));
const flag = (n) => args.includes(`--${n}`);
const value = (n) => { const i = args.indexOf(`--${n}`); return i < 0 ? null : args[i + 1]; };

if (!dir) {
  console.error('usage: node scripts/xlsx-picker-sweep.mjs <dir> [--keep-all] [--out <dir>] [--manifests]');
  process.exit(2);
}

const w = {};
loadKit('xlsx', { window: w });
loadKit('xlsx-write', { window: w });
globalThis.window = w;
const K = w.xlsxKit, W = w.xlsxWriteKit;

const outDir = value('out');
if (outDir) mkdirSync(outDir, { recursive: true });

const files = readdirSync(dir).filter(n => /\.xls[xm]$/i.test(n)).sort();
if (!files.length) { console.error(`no .xlsx or .xlsm files in ${dir}`); process.exit(1); }

const col = (s, n) => String(s).slice(0, n - 1).padEnd(n);
console.log(col('file', 44) + col('keep', 7) + col('KB in→out', 13) + col('ms', 7)
          + col('short of kept sheets', 32) + 'check');

let failures = 0;
for (const f of files) {
  const bytes = readFileSync(path.join(dir, f));
  try {
    const read = await K.readZip(bytes);
    const names = Object.values(read.xl.sheets).sort((a, b) => a.index - b.index).map(s => s.name);
    const keep = flag('keep-all') || names.length === 1 ? names : names.slice(0, -1);

    const t = Date.now();
    const { bytes: out, manifest, suffix } = await W.rebuild(bytes, keep);
    const ms = Date.now() - t;

    const short = manifest.rows.filter(r => r.short).map(r => `${r.id} ${r.out}/${r.expect}`).join(' ') || '';
    const check = manifest.checks.ok ? 'ok' : manifest.checks.problems.map(p => p.kind).join(',');
    if (!manifest.checks.ok) failures++;

    console.log(col(f, 44) + col(`${keep.length}/${names.length}`, 7)
      + col(`${(manifest.source.bytes / 1024) | 0}→${(manifest.output.bytes / 1024) | 0}`, 13)
      + col(ms, 7) + col(short, 32) + check);

    if (manifest.cellLoss?.valued || manifest.cellLoss?.styled) {
      for (const s of manifest.cellLoss.samples) console.log(`    ${s}`);
    }
    if (outDir) {
      const stem = f.replace(/\.xls[xm]$/i, '');
      writeFileSync(path.join(outDir, `${stem}.${suffix}`), Buffer.from(out));
      if (flag('manifests')) writeFileSync(path.join(outDir, `${stem}.md`), W.manifestText(manifest));
    }
  } catch (e) {
    failures++;
    console.log(col(f, 44) + col('—', 7) + col('—', 13) + col('—', 7) + col('', 32) + `threw: ${e.message}`);
  }
}

console.log(`\n${files.length} workbook${files.length === 1 ? '' : 's'}, ${failures} that did not rebuild cleanly.`);
process.exit(failures ? 1 : 0);
