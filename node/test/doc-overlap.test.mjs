// data/doc-overlap/ — the passage-embedding tables the Themes tab's Related
// lens reads, written by hand with python/doc-overlap.py.
//
// The model is not here and cannot be: the suite is browser-free and
// model-free, and the generator needs Python 3.12 and a model download. So this
// holds what can be checked without it. The shapes, and every match pointing
// at a file the scan read. And, for every file whose bytes still hash to what
// the scan recorded, that each passage's UTF-16 offsets cut out text with the
// recorded hash: the same slice the browser takes, so a unit mismatch (code
// points against UTF-16, which an emoji makes differ) fails here rather than
// showing the wrong words beside the right line number.
//
// A file edited since the scan is STALE, not wrong: its rows stop being
// checkable, and the lens says so in place of the cut. Failing on it would turn
// every doc edit red until someone reran a model the suite cannot run, so it is
// counted and left to the next run of the generator.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const dir = path.join(repoRoot, 'data', 'doc-overlap');
const docs = parseCsv(readFileSync(path.join(dir, 'docs.csv'), 'utf8'));
const rows = parseCsv(readFileSync(path.join(dir, 'matches.csv'), 'utf8'));
const h12 = (s) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 12);

test('the two tables have the columns the lens reads', () => {
  assert.deepEqual(Object.keys(docs[0]), ['path', 'sha', 'prose_words', 'passages', 'shingles']);
  assert.deepEqual(Object.keys(rows[0]), ['source', 'start', 'end', 'line', 'words', 'hash',
    'target', 'target_start', 'target_end', 'target_line', 'target_words', 'target_hash', 'cosine']);
  assert.ok(docs.length > 100 && rows.length > 100, 'the tables parsed short');
});

test('every match joins two different files the scan read, above the floor', () => {
  const known = new Set(docs.map(d => d.path));
  assert.equal(known.size, docs.length, 'a file appears twice in docs.csv');
  const keys = new Set();
  for (const r of rows) {
    assert.ok(known.has(r.source) && known.has(r.target), `${r.source} -> ${r.target}: not in docs.csv`);
    assert.notEqual(r.source, r.target);
    const c = +r.cosine;
    assert.ok(c >= 0.75 && c <= 1.0005, `${r.source}:${r.start}: cosine ${r.cosine} is outside the floor`);
    assert.ok(+r.start < +r.end && +r.target_start < +r.target_end);
    const k = r.source + ':' + r.start + '>' + r.target;
    assert.ok(!keys.has(k), 'a passage keeps one best match per other file: ' + k);
    keys.add(k);
  }
});

test('offsets cut the recorded text out of every file the scan still describes', () => {
  const fresh = new Map();
  for (const d of docs) {
    const p = path.join(repoRoot, d.path);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8');
    if (h12(text) === d.sha) fresh.set(d.path, text);
  }
  let checked = 0;
  for (const r of rows) {
    for (const [file, a, b, h] of [[r.source, r.start, r.end, r.hash], [r.target, r.target_start, r.target_end, r.target_hash]]) {
      const text = fresh.get(file);
      if (!text) continue;
      assert.equal(h12(text.slice(+a, +b)), h, `${file} [${a}, ${b}) no longer cuts the passage the scan hashed`);
      checked++;
    }
  }
  // Stale files are allowed; a table in which nothing can be checked is not a
  // table this lens should be reading.
  assert.ok(checked > rows.length / 2, `only ${checked} of ${rows.length * 2} passage cuts are checkable; rerun python/doc-overlap.py`);
});

test('the Map reads the tables and keeps the lens out of the shingle controls', () => {
  const src = readFileSync(path.join(repoRoot, 'lib', 'alpineComponents', 'map.js'), 'utf8');
  assert.match(src, /const OVERLAP_MATCHES = 'data\/doc-overlap\/matches\.csv'/);
  assert.match(src, /\{ k: 'related', n: 'Related', i: 'ph-swap' \}/);
  assert.match(src, /themeGraph && lens !== 'owners' && lens !== 'related'/,
    'the shingle dial and its concern counts must not apply to the embedding lens');
  assert.match(src, /text\.slice\(start, end\)/, 'the lens cuts passages by UTF-16 offset, as this test does');
});

// data/doc-overlap/gold-set/gold.csv — the hand-labelled sample that scores the
// cutoff (python/doc-overlap-gold.py; the method is the gold-set skill). The
// file is precious: a rerun of its agents would label a different set, so it is
// never regenerated, only checked. More labels come from a new seed.
const goldPath = path.join(dir, 'gold-set', 'gold.csv');

test('the gold set carries its labels in their domains, and each passage still cuts where recorded', () => {
  if (!existsSync(goldPath)) return;
  const gold = parseCsv(readFileSync(goldPath, 'utf8'));
  assert.ok(gold.length >= 100, 'the gold set parsed short');
  const RELATIONS = ['same', 'summary', 'related', 'conflict', 'unrelated', 'fragment'];
  let checked = 0, present = 0;
  const moved = [];
  // Where a passage can begin: the file's start, a line's first non-blank
  // character, or a sentence's first word.
  const starts = (text) => [0, ...[...text.matchAll(/\n[ \t]*|[.!?] +/g)].map((m) => m.index + m[0].length)];
  for (const g of gold) {
    assert.ok(RELATIONS.includes(g.relation) && RELATIONS.includes(g.reader_relation), `${g.id}: relation`);
    for (const k of ['reading', 'consolidate']) assert.ok(['yes', 'no'].includes(g[k]), `${g.id}: ${k}`);
    if (g.consolidate === 'yes') assert.ok(['same', 'summary'].includes(g.relation), `${g.id}: consolidate needs same or summary`);
    if (g.verdict) assert.equal(g.verdict === 'confirm', g.relation === g.reader_relation, `${g.id}: verdict and relation disagree`);
    assert.ok(+g.stratum_seats >= 1 && +g.stratum_seats <= +g.stratum_size, `${g.id}: sampling weight`);
    for (const s of ['a', 'b']) {
      const p = path.join(repoRoot, g[s + '_path']);
      if (!existsSync(p)) continue;
      const text = readFileSync(p, 'utf8'), a = +g[s + '_start'], b = +g[s + '_end'], h = g[s + '_hash'];
      if (h12(text.slice(a, b)) === h) { present++; checked++; continue; }
      const at = starts(text).find((i) => h12(text.slice(i, i + b - a)) === h);
      if (at == null) continue;
      present++;
      moved.push(`${g.id}.${s} ${g[s + '_path']}: ${a} is now ${at}`);
    }
  }
  // Files move on; a gold row outlives its offsets. Most should still cut.
  // A passage that is gone has no offsets to drift, so the share is taken over
  // the passages still in their file: docs/SNAGS.md held 118 of the 550 when
  // its entries moved to the Snag list on 2026-10-20, and the 2026-10-22
  // documentation cleanup cut 267 more out of files that remain. A passage is
  // found again by its hash at a line or sentence start, which is where the
  // scan cuts; one found elsewhere in its file counts against the share.
  assert.ok(checked > present / 2,
    `only ${checked} of ${present} gold passages still in their file cut where recorded; moved:\n${moved.join('\n')}`);
});
