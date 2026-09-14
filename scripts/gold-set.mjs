#!/usr/bin/env node
// scripts/gold-set.mjs — build the sheet picker's gold set: a few real
// workbooks rebuilt with a sheet dropped, for a person to open in Excel. That
// is the third of the three checks named for kits/xlsx-write.js and the only
// one no sandbox can run.
//
//   npm run gold-set                 -> rebuild the committed gold-set/
//   npm run gold-set -- --from <dir> -> read the sources from somewhere else
//   npm run gold-set -- --check      -> exit 1 if the committed folder is stale
//
// THREE FILES, CHOSEN, NOT THIRTEEN SWEPT. The first version of this pointed
// scripts/xlsx-picker-sweep.mjs at a directory and kept every sheet but the
// last. That produced 839 KB of workbooks that tested LESS than these 225 KB:
// five of the thirteen were single-sheet, so nothing was dropped at all, and
// the rule threw away the sheet the TECM template's pivot sits on, so the
// committed set exercised the pivot graft nowhere. The sweep is still the right
// tool for measuring across a corpus; it is the wrong tool for choosing a
// sample.
//
// THE SELECTION RULE, AND IT IS CHECKED RATHER THAN REMEMBERED: drop a sheet
// that no kept sheet reads. Otherwise Excel's complaint is ambiguous between
// "the picker broke this" and "you dropped the sheet it needed", which is the
// one thing a gold set must not be. The swept version got this wrong twice:
// 11.01 dropped ActiveFunds, the hidden sheet holding the lookups FundSplits'
// dropdowns read, and 09.01 dropped its dropdown source the same way. Those
// references run through DEFINED NAMES rather than literal sheet names, so
// checkSelection() below follows that hop; reading formulas alone finds nothing
// and reports a clean drop that is not one.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsdomPkg from 'jsdom';
import { loadKit } from '../tools/test/bootstrap.mjs';

const { JSDOM } = jsdomPkg;
globalThis.DOMParser = new JSDOM('').window.DOMParser;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The sources are OFM's published 2027-29 budget instruction forms. They live
// in the private `home` repo, checked out beside this one, which is the layout
// the estate assumes elsewhere (home's own CLAUDE.md runs
// `python3 ../web-tools/scripts/showing.py`). Each also has a public
// ofm.wa.gov URL, recorded in that snapshot's _meta/manifest.json.
const DEFAULT_FROM = path.resolve(repoRoot, '..', 'home', 'projects', 'budget-drs', 'submittal',
  'source-docs', '2026-06-13-ofm-instructions', 'part1-operating-transportation', 'forms');

// WHAT EACH FILE IS FOR. Between them these three fire every graft the kit has
// and every loss mode it knows about, which thirteen swept files did not.
const SELECTION = [
  {
    file: '15.02-TECM-Template.xlsm',
    keep: ['HeadCounts&CostPerCredit', 'HeadCountCheck'],
    why: 'The only file that fires all three grafts. VBA with three signature parts, '
       + 'three customXml items, and a pivot on HeadCountCheck whose cache reads '
       + 'HeadCounts&CostPerCredit, so both must be kept or the pivot is orphaned and '
       + 'the graft is refused. Dropping GrossNetOperatingFee takes 21 cells and three '
       + 'comments and nothing reads it.',
  },
  {
    file: '11.01-Central-Service-Fund-Split-Form.xlsm',
    keep: ['FundSplits', 'ActiveFunds'],
    why: 'The formula and validation case: 2,795 formulas, 16 data validations, 4 '
       + 'conditional formats, 16 defined names, a workbook connection, VBA, and a '
       + 'hidden sheet that must come back still hidden. FundSplits and ActiveFunds read '
       + "each other through named ranges, so both stay; Instructions is the form's only "
       + 'sheet nothing points at.',
  },
  {
    file: '09.02-Decision-Package-Addendum.xlsx',
    keep: ['DP Addendum'],
    why: 'The drawing and geometry case: 129 merged ranges and an embedded image. It is '
       + 'also the file that demonstrates the two known losses, a hyperlink sharing an '
       + 'anchor cell and a VML drawing, so the manifest here should read short and the '
       + 'file should still open. Neither sheet reads the other.',
  },
];

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const at = (n) => { const i = args.indexOf(`--${n}`); return i < 0 ? null : args[i + 1]; };
const from = at('from') || DEFAULT_FROM;
const outDir = path.join(repoRoot, 'gold-set');

const w = {};
loadKit('xlsx', { window: w });
loadKit('xlsx-write', { window: w });
globalThis.window = w;
const K = w.xlsxKit, W = w.xlsxWriteKit;

// Does any KEPT sheet reach a DROPPED one? Follows the defined-name hop, which
// is how these forms actually point across sheets.
function checkSelection(read, keep) {
  const sheets = Object.values(read.xl.sheets).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const kept = new Set(keep);
  const target = {};
  for (const d of read.xl.definedNames || []) {
    for (const s of sheets) if (String(d.reference || '').includes(s.name)) target[d.name] = s.name;
  }
  const problems = [];
  for (const s of sheets) {
    if (!kept.has(s.name)) continue;
    const text = JSON.stringify({
      v: s.validations || [], cf: s.conditionalFormats || [],
      f: (s.rows || []).flatMap(r => Object.values(r.formulas || {})),
    });
    for (const [name, sheet] of Object.entries(target)) {
      if (kept.has(sheet)) continue;
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (re.test(text)) problems.push(`${s.name} reads ${name}, which lives on the dropped ${sheet}`);
    }
    for (const o of sheets) {
      if (kept.has(o.name)) continue;
      if (text.includes(`${o.name}!`) || text.includes(`'${o.name}'!`)) problems.push(`${s.name} names the dropped ${o.name} directly`);
    }
  }
  return [...new Set(problems)];
}

if (!existsSync(from)) {
  console.error(`gold-set: no sources at ${from}`);
  console.error('That is the sibling `home` checkout. Clone it beside this repo, or pass');
  console.error('  npm run gold-set -- --from <a directory holding the OFM forms>');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const written = new Set(['README.md']);
let stale = 0, refused = 0;

for (const entry of SELECTION) {
  const src = path.join(from, entry.file);
  if (!existsSync(src)) { console.error(`gold-set: ${entry.file} is not in ${from}`); process.exit(1); }
  const bytes = readFileSync(src);

  const read = await K.readZip(bytes);
  const problems = checkSelection(read, entry.keep);
  if (problems.length) {
    // Refuse rather than warn. A sample whose drop breaks the form cannot
    // answer the question the gold set exists to ask.
    console.error(`gold-set: ${entry.file}'s selection is not a clean drop:`);
    for (const p of problems) console.error(`    ${p}`);
    refused++;
    continue;
  }

  const { bytes: out, manifest, suffix } = await W.rebuild(bytes, entry.keep);
  const stem = entry.file.replace(/\.xls[xm]$/i, '');
  const wbPath = path.join(outDir, `${stem}.${suffix}`);
  const mdPath = path.join(outDir, `${stem}.md`);
  const md = `${W.manifestText(manifest)}\n\n## Why this file is in the gold set\n\n${entry.why}\n`;

  for (const [p, body] of [[wbPath, Buffer.from(out)], [mdPath, md]]) {
    const before = existsSync(p) ? readFileSync(p) : null;
    const next = Buffer.isBuffer(body) ? body : Buffer.from(body);
    if (!before || Buffer.compare(before, next) !== 0) { stale++; if (!flag('check')) writeFileSync(p, next); }
    written.add(path.basename(p));
  }

  console.log(`${entry.file.padEnd(46)} keep ${manifest.kept.length}/${manifest.source.sheets.length}`
    + `  ${(manifest.source.bytes / 1024) | 0}→${(manifest.output.bytes / 1024) | 0} KB`
    + `  ${manifest.checks.ok ? 'ok' : manifest.checks.problems.map(p => p.kind).join(',')}`
    + (manifest.carried.length ? `  carried: ${manifest.carried.map(c => c.id).join(', ')}` : ''));
}

// The folder is the selection, which means deleting too: a file left behind by
// a selection that no longer claims it keeps answering for a sample that has
// been withdrawn.
for (const name of readdirSync(outDir)) {
  if (written.has(name)) continue;
  stale++;
  if (!flag('check')) rmSync(path.join(outDir, name), { recursive: true });
  console.log(`removed ${name}, which no selection claims`);
}

if (refused) { console.error(`\n${refused} file(s) refused; fix the selection above.`); process.exit(1); }
if (flag('check')) {
  if (stale) { console.error(`\ngold-set/ is behind its sources; run: npm run gold-set`); process.exit(1); }
  console.log('\ngold-set: current');
} else {
  console.log(`\nOpen these in Excel. Each .md beside a workbook is its manifest and why it is here.`);
  console.log(`  ${outDir}`);
}
