#!/usr/bin/env node
// The page-measures pass, against a page whose defects are known.
//
//   node tools/test/page-measures.mjs
//
// A measure that reports nothing across every page proves nothing: on the
// first sweep (2026-10-06) the serif, flat-prose and tooltip measures found zero
// hits on 38 pages, and there was no way to tell a clean estate from a dead
// detector. So tools/test/fixtures/page-measures.html plants one defect per
// measure, each beside a near miss, and this asserts both halves: the plant is
// found and named, and the near miss is not. The near misses are the two false
// positives the prototype produced, a wide element inside a scroll container
// and a plain class that happens to be called `stat`.
//
// The CI workflow runs this before the report, so a report that says "no
// findings" comes from detectors shown to fire on that same run.
//
// Exits nonzero on any failure. Not part of `npm test` (drives a browser).

import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(root, 'tools/.preview/page-measures-fixture.png');
const r = spawnSync(process.execPath, [path.join(root, 'tools/render/screenshot.mjs'),
  'tools/test/fixtures/page-measures.html', '--measure', '--width', '1000', '--height', '625', '--out', OUT],
  { cwd: root, encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stdout, r.stderr); process.exit(1); }
const m = JSON.parse(readFileSync(OUT.replace(/\.png$/, '.measures.json'), 'utf8'));
const d = m.desktop, p = m.phone;

const failures = [];
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : '  ' + detail}`);
  if (!cond) failures.push(name);
};
const names = (list, id) => list.some(s => s.includes('#' + id));

ok('the fixture rendered without a thrown error', m.thrown === 0, `thrown=${m.thrown}`);
ok('overflow is measured at both widths', d.overflowPx > 0 && p.overflowPx > 0, `desktop=${d.overflowPx} phone=${p.overflowPx}`);
ok('the wide element is named, the scrolled one is not',
  d.wide === 1 && names(d.wideAt, 'too-wide'), JSON.stringify(d.wideAt));
ok('the blank icon is found and the real one is not',
  d.blankIcons === 1 && names(d.blankIconsAt, 'blank-icon'), JSON.stringify(d.blankIconsAt));
ok('the empty table is found and the full one is not',
  d.emptyTables === 1 && names(d.emptyTablesAt, 'empty-table'), JSON.stringify(d.emptyTablesAt));
ok('only the unstyled paragraph is in the default serif',
  d.serifChars > 0 && d.serifAt.length === 1 && names(d.serifAt, 'unstyled'), JSON.stringify(d.serifAt));
ok('the flat prose block is found and the sized one is not', d.flatProse === 1, `flatProse=${d.flatProse}`);
ok('daisyUI stats are found and a class merely named stat is not',
  d.statCards === 2 && names(d.statCardsAt, 'stat-card') && !names(d.statCardsAt, 'custom-stat'), JSON.stringify(d.statCardsAt));
ok('the daisyUI tooltip is found', d.daisyTips === 1, `daisyTips=${d.daisyTips}`);
ok('a page with no thumbnail says so rather than comparing', m.pixels.changedPct === undefined && !m.pixels.thumbPath);

console.log(failures.length ? `\n${failures.length} failure(s)` : '\nall measures fire on their plant and spare their near miss');
process.exit(failures.length ? 1 : 0);
