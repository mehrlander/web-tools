// data/content-development: worked examples of content placed on two scales,
// how it is held and where a reader meets it, drawn by the Map's
// Docs/Development subview (lib/alpineComponents/map.js, devCell and devSteps).
//
// The table is descriptive, so what this holds is its shape: every point names
// a level the scales file defines, each example's steps run 1..n in date
// order, a proposed point comes only after the done ones, and evidence is a
// repo:path the subview can turn into a link. A web-tools path is checked to
// exist; another repository's is not, since CI has only this checkout.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const DIR = path.join(repoRoot, 'data', 'content-development');
const read = f => readFileSync(path.join(DIR, f), 'utf8');
const SCALES = parseCsv(read('scales.csv'));
const PATHS = parseCsv(read('paths.csv'));
const REPOS = ['web-tools', 'home', 'web-tools-private'];
const EVIDENCE = /^([\w-]+):([^@]+?)(?:@([0-9a-f]{6,40}))?$/;

test('the scales file defines held_as and shown_in, each level once', () => {
  assert.deepEqual([...new Set(SCALES.map(r => r.scale))], ['held_as', 'shown_in']);
  for (const scale of ['held_as', 'shown_in']) {
    const levels = SCALES.filter(r => r.scale === scale).map(r => r.level);
    assert.equal(new Set(levels).size, levels.length, `${scale}: a level appears twice`);
    assert.ok(levels.length >= 2, `${scale}: a scale needs at least two levels`);
  }
  for (const r of SCALES) assert.ok(r.name && r.gloss, `${r.scale}/${r.level}: name and gloss are required`);
});

test('paths.csv has the columns the subview reads', () => {
  const header = read('paths.csv').split(/\r?\n/)[0];
  assert.equal(header, 'example,seq,date,held_as,shown_in,state,evidence,move');
  assert.ok(PATHS.length >= 2, 'paths.csv parsed short');
});

test('every point sits on levels the scales file defines', () => {
  const has = (scale, level) => SCALES.some(r => r.scale === scale && r.level === level);
  for (const r of PATHS) {
    assert.ok(has('held_as', r.held_as), `${r.example} ${r.seq}: held_as '${r.held_as}' is not in scales.csv`);
    assert.ok(has('shown_in', r.shown_in), `${r.example} ${r.seq}: shown_in '${r.shown_in}' is not in scales.csv`);
  }
});

test("each example's steps run 1..n in date order, proposed ones last", () => {
  const byExample = new Map();
  for (const r of PATHS) byExample.set(r.example, [...(byExample.get(r.example) || []), r]);
  for (const [name, rows] of byExample) {
    assert.deepEqual(rows.map(r => Number(r.seq)), rows.map((_, i) => i + 1), `${name}: steps are 1..n, in file order`);
    let seenProposed = false, last = '';
    for (const r of rows) {
      assert.match(r.date, /^\d{4}-\d{2}(-\d{2})?$/, `${name} ${r.seq}: date is YYYY-MM-DD or YYYY-MM`);
      assert.ok(r.date >= last.slice(0, r.date.length), `${name} ${r.seq}: dated before the step it follows`);
      last = r.date;
      assert.ok(['done', 'proposed'].includes(r.state), `${name} ${r.seq}: state is done or proposed`);
      if (r.state === 'proposed') seenProposed = true;
      else assert.ok(!seenProposed, `${name} ${r.seq}: a done step after a proposed one`);
    }
  }
});

test('evidence is a repo:path the subview can link, and a web-tools path exists', () => {
  for (const r of PATHS) {
    const m = EVIDENCE.exec(r.evidence || '');
    assert.ok(m, `${r.example} ${r.seq}: evidence '${r.evidence}' is not repo:path or repo:path@sha`);
    assert.ok(REPOS.includes(m[1]), `${r.example} ${r.seq}: unknown repository '${m[1]}'`);
    if (m[1] === 'web-tools' && !m[3])
      assert.ok(existsSync(path.join(repoRoot, m[2].replace(/\/$/, ''))), `${r.example} ${r.seq}: ${m[2]} does not exist`);
  }
});

test('a move is a short literal phrase', () => {
  for (const r of PATHS) {
    const words = (r.move || '').split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 2 && words <= 10, `${r.example} ${r.seq}: move is ${words} words`);
    assert.doesNotMatch(r.move, /[–—]|--/, `${r.example} ${r.seq}: no dashes in a move`);
  }
});
