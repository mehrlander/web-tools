// docs/icon-families.csv: one row per family of icons the estate has settled
// on, the file declaring its members, and what they stand for. The Map's
// Overview > Icons reads it.
//
// A row is held to its source by the reader the Map will use for it: a CSV
// row's icon and name columns must exist in that CSV and give the family at
// least one member, a folder must hold SVG files, one SVG must exist, and any
// other row must have its own entry in ICON_READERS in
// lib/alpineComponents/map.js. The reader set is held in both directions, so a
// reader cannot outlive its row. A row's doc is held to the passage it names.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv, parseCsvLine } from '../build/registries-load.mjs';

const rows = parseCsv(readFileSync(path.join(repoRoot, 'docs', 'icon-families.csv'), 'utf8'));
const src = readFileSync(path.join(repoRoot, 'lib', 'alpineComponents', 'map.js'), 'utf8');
const readersBlock = src.match(/ICON_READERS:\s*\{([\s\S]*?)\r?\n {6}\},\r?\n/)?.[1] || '';
const READERS = [...readersBlock.matchAll(/^ {8}'?([a-z-]+)'?\(\)\{/gm)].map(m => m[1]);
const at = p => path.join(repoRoot, p);

test('every family is read by the Map, from a source that exists', () => {
  assert.ok(READERS.length, 'the ICON_READERS block was found');
  const coded = [];
  for (const f of rows) {
    assert.ok(existsSync(at(f.source)), `${f.family}: ${f.source} exists`);
    if (f.source.endsWith('/')) {
      assert.ok(statSync(at(f.source)).isDirectory(), `${f.family}: ${f.source} is a folder`);
      assert.ok(readdirSync(at(f.source)).some(n => n.endsWith('.svg')), `${f.family}: ${f.source} holds SVG files`);
    } else if (f.source.endsWith('.svg') || f.icon_column) {
      assert.ok(!READERS.includes(f.family), `${f.family} is read from its file, so it has no reader of its own`);
    } else coded.push(f.family);
    if (f.icon_column) {
      const text = readFileSync(at(f.source), 'utf8');
      const head = parseCsvLine(text.split(/\r?\n/)[0]).map(h => h.trim());
      for (const c of [f.icon_column, f.name_column])
        assert.ok(head.includes(c), `${f.family}: ${f.source} has a ${c} column`);
      assert.ok(parseCsv(text).some(r => r[f.icon_column]), `${f.family}: at least one row of ${f.source} carries an icon`);
    } else assert.equal(f.name_column, '', `${f.family}: a name column needs an icon column`);
  }
  assert.deepEqual([...READERS].sort(), coded.sort(), 'ICON_READERS has one entry per family read from code or a manifest, and no other');
});

// The doc's anchor is the one the Map slices a peek by: a Markdown heading's
// GitHub anchor, or the key in a CSV's first column. A renamed heading or key
// would leave the link opening the file and the peek empty.
const slug = s => String(s).trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
test('every family names a doc passage that exists', () => {
  for (const f of rows) {
    const [file, frag] = f.doc.split('#');
    assert.ok(existsSync(at(file)), `${f.family}: ${file} exists`);
    if (!frag) continue;
    const text = readFileSync(at(file), 'utf8');
    if (file.endsWith('.md')) {
      const heads = [...text.matchAll(/^#+\s+(.*)$/gm)].map(m => slug(m[1]));
      assert.ok(heads.includes(frag), `${f.family}: ${file} has a heading whose anchor is #${frag}`);
    } else {
      assert.ok(file.endsWith('.csv'), `${f.family}: an anchor names a Markdown heading or a CSV key`);
      assert.ok(parseCsv(text).some(r => Object.values(r)[0] === frag), `${f.family}: ${file} has a row keyed ${frag}`);
    }
  }
});

test('an SVG a CSV family names exists', () => {
  for (const f of rows.filter(f => f.icon_column)) {
    for (const r of parseCsv(readFileSync(at(f.source), 'utf8'))) {
      const v = r[f.icon_column];
      if (v?.endsWith('.svg')) assert.ok(existsSync(at(v)), `${f.family}: ${v} exists`);
    }
  }
});

// A drawn mark's alternatives (docs/favicons/README.md, Alternatives): each
// file in an alternatives/ folder is <mark>.<option>.svg beside a mark that
// exists, and keeps the drawn-mark rules a file can be read for: the shared
// box, a <desc> saying what it depicts, no strokes, and the mark's own paint.
// The 2.5-unit gap is a design check, measured when the mark is drawn.
test('every alternative names its mark and keeps the drawn-mark rules', () => {
  const files = execFileSync('git', ['-C', repoRoot, 'ls-files', '*/alternatives/*.svg'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const f of files) {
    const dir = path.dirname(path.dirname(f)), name = path.basename(f);
    const m = name.match(/^([^.]+)\.([^.]+)\.svg$/);
    assert.ok(m, `${f}: named <mark>.<option>.svg`);
    const mark = path.join(dir, m[1] + '.svg');
    assert.ok(existsSync(at(mark)), `${f}: its mark ${mark} exists`);
    const svg = readFileSync(at(f), 'utf8'), own = readFileSync(at(mark), 'utf8');
    assert.match(svg, /viewBox="1\.5 1\.75 29 29"/, `${f}: the drawn-mark box`);
    assert.match(svg, /<desc>[^<]+<\/desc>/, `${f}: a <desc> says what it depicts`);
    assert.doesNotMatch(svg, /\bstroke(-width)?=/, `${f}: solid fills, no strokes`);
    assert.equal(/currentColor/.test(svg), /currentColor/.test(own), `${f}: painted as its mark is`);
  }
});
