// Verifies kits/treemap.js: the category taxonomy, tree build (rollups,
// sorting, parents), catTotals aggregation, the squarified layout's tiling
// invariants (area conservation, containment, no overlap), and fmtBytes.
// Loaded via the bootstrap's loadKit (the gh.load shape), so what's tested is
// the artifact pages run. Fixtures are inlined.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKit } from './bootstrap.mjs';

const { treemap } = loadKit('treemap.js');

const ENTRIES = [
  { path: 'README.md', type: 'blob', size: 100 },
  { path: 'lib/a.js', type: 'blob', size: 500 },
  { path: 'lib/b.js', type: 'blob', size: 300 },
  { path: 'lib/kits/deep.js', type: 'blob', size: 200 },
  { path: 'pages/x.html', type: 'blob', size: 400 },
  { path: 'pages/thumbs/x.png', type: 'blob', size: 900 },
  { path: 'lib', type: 'tree' },            // tree entries are ignored
  { path: 'sub/module', type: 'commit' },   // submodules too
  { path: 'data.json', type: 'blob' },      // missing size → 0
];

test('kit surface', () => {
  for (const k of ['CATS', 'categorize', 'buildTree', 'catTotals', 'squarify', 'fmtBytes']) {
    assert.ok(treemap[k], `treemap.${k} present`);
  }
  assert.deepEqual(Object.keys(treemap.CATS),
    ['code', 'docs', 'data', 'markup', 'media', 'styles', 'other']);
});

test('categorize: extensions, special names, fallbacks', () => {
  const c = treemap.categorize;
  assert.equal(c('app.js'), 'code');
  assert.equal(c('APP.TSX'), 'code');
  assert.equal(c('notes.md'), 'docs');
  assert.equal(c('feed.json'), 'data');
  assert.equal(c('index.html'), 'markup');
  assert.equal(c('logo.svg'), 'media');
  assert.equal(c('site.css'), 'styles');
  assert.equal(c('LICENSE'), 'docs');
  assert.equal(c('Dockerfile'), 'code');
  assert.equal(c('.gitignore'), 'other');   // leading dot ≠ extension
  assert.equal(c('mystery.xyz'), 'other');
  assert.equal(c('noext'), 'other');
});

test('buildTree: hierarchy, rollups, sort, parents', () => {
  const root = treemap.buildTree(ENTRIES, 'fixture');
  assert.equal(root.name, 'fixture');
  assert.equal(root.size, 2400);
  assert.equal(root.fileCount, 7);
  assert.equal(root.dirCount, 4); // lib, lib/kits, pages, pages/thumbs

  const lib = root.children.find(c => c.name === 'lib');
  assert.ok(lib.isDir);
  assert.equal(lib.size, 1000);
  assert.equal(lib.fileCount, 3);
  assert.equal(lib.dirCount, 1);
  assert.equal(lib.parent, root);

  // children sorted by size desc
  const sizes = root.children.map(c => c.size);
  assert.deepEqual(sizes, [...sizes].sort((a, b) => b - a));

  // deep file wired with path + parent chain
  const kits = lib.children.find(c => c.name === 'kits');
  const deep = kits.children[0];
  assert.equal(deep.path, 'lib/kits/deep.js');
  assert.equal(deep.parent.parent.parent, root);

  // non-blob entries ignored; sizeless blob defaults to 0
  assert.ok(!root.children.find(c => c.name === 'module'));
  assert.equal(root.children.find(c => c.name === 'data.json').size, 0);
});

test('catTotals aggregates bytes and files per category', () => {
  const root = treemap.buildTree(ENTRIES, 'fixture');
  const t = treemap.catTotals(root);
  assert.deepEqual(t.code, { bytes: 1000, files: 3 });
  assert.deepEqual(t.docs, { bytes: 100, files: 1 });
  assert.deepEqual(t.markup, { bytes: 400, files: 1 });
  assert.deepEqual(t.media, { bytes: 900, files: 1 });
  assert.deepEqual(t.data, { bytes: 0, files: 1 });
  assert.equal(t.styles, undefined);
});

test('squarify: tiles the rect exactly, in proportion, without overlap', () => {
  const weights = [6, 6, 4, 3, 2, 2, 1];
  const items = weights.map(w => ({ weight: w }));
  const X = 10, Y = 20, W = 240, H = 100;
  const rects = treemap.squarify(items, X, Y, W, H);
  assert.equal(rects.length, items.length);

  const total = weights.reduce((a, b) => a + b, 0);
  let areaSum = 0;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    // containment (allow float fuzz)
    assert.ok(r.x >= X - 1e-6 && r.y >= Y - 1e-6, `rect ${i} inside origin`);
    assert.ok(r.x + r.w <= X + W + 1e-6 && r.y + r.h <= Y + H + 1e-6, `rect ${i} inside extent`);
    // area proportional to weight
    const share = (r.w * r.h) / (W * H);
    assert.ok(Math.abs(share - weights[i] / total) < 1e-6, `rect ${i} area ∝ weight`);
    areaSum += r.w * r.h;
  }
  assert.ok(Math.abs(areaSum - W * H) < 1e-6, 'tiling conserves area');

  // no pairwise overlap
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const overlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
                      Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      assert.ok(overlap < 1e-6, `rects ${i}/${j} overlap`);
    }
  }
});

test('squarify: aspect ratios beat naive slicing', () => {
  // equal weights in a square → squarified must not produce 1×16 slivers
  const items = Array.from({ length: 16 }, () => ({ weight: 1 }));
  const rects = treemap.squarify(items, 0, 0, 400, 400);
  const worst = Math.max(...rects.map(r => Math.max(r.w / r.h, r.h / r.w)));
  assert.ok(worst <= 3, `worst aspect ratio ${worst.toFixed(2)} ≤ 3`);
});

test('squarify: degenerate inputs', () => {
  assert.deepEqual(treemap.squarify([], 0, 0, 100, 100), []);
  const zeros = treemap.squarify([{ weight: 0 }, { weight: 0 }], 0, 0, 100, 100);
  assert.equal(zeros.length, 2);
  for (const r of zeros) assert.equal(r.w * r.h, 0);
  // one giant + many tiny stays finite and contained
  const skew = [{ weight: 1e9 }, ...Array.from({ length: 50 }, () => ({ weight: 1 }))];
  const rects = treemap.squarify(skew, 0, 0, 300, 200);
  for (const r of rects) {
    assert.ok(Number.isFinite(r.x + r.y + r.w + r.h), 'finite rects');
    assert.ok(r.w >= 0 && r.h >= 0, 'non-negative extents');
  }
});

test('squarify scales: 10k items lay out fast and completely', () => {
  const items = Array.from({ length: 10000 }, (_, i) => ({ weight: 10000 - i }));
  const t0 = performance.now();
  const rects = treemap.squarify(items, 0, 0, 1920, 1080);
  const ms = performance.now() - t0;
  assert.equal(rects.length, 10000);
  assert.ok(ms < 2000, `10k layout took ${ms.toFixed(0)}ms`);
});

test('fmtBytes', () => {
  assert.equal(treemap.fmtBytes(0), '0 B');
  assert.equal(treemap.fmtBytes(1023), '1023 B');
  assert.equal(treemap.fmtBytes(1024), '1.0 KB');
  assert.equal(treemap.fmtBytes(6672908), '6.4 MB');
  assert.equal(treemap.fmtBytes(2 ** 31), '2.00 GB');
});
