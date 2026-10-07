// kits/report-layout.js: the layout is data, and the transcription is the risk.
//
// The kit computes every subtotal and the grand total from the item rows, so
// asserting that a computed sum equals itself would prove nothing. The figures
// asserted below are typed in from the SOURCE TABLE as printed, independently
// of the item rows in data/report-layout/three-way-compare.csv. A mistyped item
// therefore fails here, which is the only failure this fixture can actually
// have.
//
// The second half asserts the separation the kit exists for: the same rows under
// a second committed layout (compare-by-year.json, which bands on fiscal year
// instead of on budget version) must produce the same figures under different
// column keys. If a layout could change an amount, it would not be a layout.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const window = {};
for (const kit of ['lib/vanilla-bundle.js', 'lib/kits/csv.js', 'lib/kits/report-layout.js'])
  new Function('window', readFileSync(path.join(repoRoot, kit), 'utf8'))(window);

const dataDir = path.join(repoRoot, 'data/report-layout');
const read = f => readFileSync(path.join(dataDir, f), 'utf8');
const rows = window.Csv.rows(read('three-way-compare.csv'));
const spec = JSON.parse(read('three-way-compare.json'));
const byYear = JSON.parse(read('compare-by-year.json'));

const model = window.ReportLayout.build(spec, rows);
const line = label => model.rows.find(r => r.labels[0] === label);
// Read the column key off the model rather than rebuilding it, so the test does
// not carry a second copy of how a key is composed.
const keyIn = (m, band, within) => m.columns.find(c => c.band === band && c.within === within).key;
const at = (row, band, within) => row.values[keyIn(model, band, within)];

// The source table as printed, read off the workbook screenshot: every bold
// line, both fiscal years, all three budget versions. `null` is a blank cell,
// which is not the same claim as 0.
const PRINTED = {
  'Top Line (incoming)':    { GOVJANUP: [67382000, 76367000], OHCHAIR: [67382000, 76367000], OSCHAIR: [67382000, 76367000] },
  'Comp Total Change':      { GOVJANUP: [0, -53000],          OHCHAIR: [0, -66000],          OSCHAIR: [0, -82000] },
  'Ctrl Svc Total Change':  { GOVJANUP: [56000, 605000],      OHCHAIR: [11000, 8000],        OSCHAIR: [11000, 8000] },
  'Other Total Change':     { GOVJANUP: [null, null],         OHCHAIR: [0, 290000],          OSCHAIR: [8000, 388000] },
  'Grand Total':            { GOVJANUP: [67438000, 76919000], OHCHAIR: [67393000, 76599000], OSCHAIR: [67401000, 76681000] },
};

test('every printed line of the source table is reproduced from the item rows', () => {
  for (const [label, versions] of Object.entries(PRINTED)) {
    const row = line(label);
    assert.ok(row, `${label} is missing from the model`);
    for (const [version, [y26, y27]] of Object.entries(versions)) {
      assert.equal(at(row, version, '2026') ?? null, y26, `${label} / ${version} / 2026`);
      assert.equal(at(row, version, '2027') ?? null, y27, `${label} / ${version} / 2027`);
    }
  }
});

test('a blank cell and a zero stay different claims', () => {
  const restatement = model.rows.find(r => r.labels[2] === 'LEOFF Restatement');
  assert.equal(at(restatement, 'OHCHAIR', '2026'), 0, 'the chair filed the item at zero');
  assert.equal(at(restatement, 'GOVJANUP', '2026'), undefined, 'the Governor filed no such item');

  // And it carries up: the Governor has no Other rows at all, so the subtotal
  // is blank rather than a zero the reader would take for a decision.
  assert.equal(at(line('Other Total Change'), 'GOVJANUP', '2026'), undefined);
  assert.equal(at(line('Other Total Change'), 'OHCHAIR', '2026'), 0);
});

test('the grand total is the opening line plus the three subtotals', () => {
  for (const version of ['GOVJANUP', 'OHCHAIR', 'OSCHAIR']) {
    for (const year of ['2026', '2027']) {
      const parts = ['Comp Total Change', 'Ctrl Svc Total Change', 'Other Total Change']
        .reduce((sum, l) => sum + (at(line(l), version, year) || 0), at(line('Top Line (incoming)'), version, year));
      assert.equal(at(line('Grand Total'), version, year), parts, `${version} ${year}`);
    }
  }
});

test('the declared band order is the printed order, not first appearance', () => {
  assert.deepEqual(model.columns.map(c => c.band + ' ' + c.within), [
    'GOVJANUP 2026', 'GOVJANUP 2027',
    'OHCHAIR 2026', 'OHCHAIR 2027',
    'OSCHAIR 2026', 'OSCHAIR 2027',
  ]);
  assert.deepEqual(model.columns.map(c => !!c.gapBefore),
    [false, false, true, false, true, false],
    'a gap opens each band after the first, never inside one');
});

test('a second layout over the same rows moves the figures without changing them', () => {
  const other = window.ReportLayout.build(byYear, rows);
  assert.deepEqual(other.columns.map(c => c.band + ' ' + c.within), [
    '2026 GOVJANUP', '2026 OHCHAIR', '2026 OSCHAIR',
    '2027 GOVJANUP', '2027 OHCHAIR', '2027 OSCHAIR',
  ]);
  const there = (label, band, within) =>
    other.rows.find(r => r.labels[0] === label).values[keyIn(other, band, within)];
  for (const [label, versions] of Object.entries(PRINTED))
    for (const [version, [y26, y27]] of Object.entries(versions)) {
      assert.equal(there(label, '2026', version) ?? null, y26, `${label} / ${version} / 2026`);
      assert.equal(there(label, '2027', version) ?? null, y27, `${label} / ${version} / 2027`);
    }
});

test('the row hierarchy prints as suppressed columns, not as indentation', () => {
  const html = window.ReportLayout.render(model, spec);
  const trs = html.split('<tr').slice(1);
  const rowWith = text => trs.find(r => r.includes('>' + text + '<'));

  assert.ok(rowWith('ML Ctrl Svc').includes('>Ctrl Svc<'),
    "the group's first leaf names the group");
  assert.ok(!rowWith('PL Ctrl Svc').includes('>Ctrl Svc<'),
    'the second leaf leaves that cell empty rather than repeating it');
  assert.ok(!html.includes('padding-left') && !/class="[^"]*\bpl-\d/.test(html),
    'no indentation is used to carry depth');
});

test('the TSV export carries raw numbers, so a paste lands as numbers', () => {
  const lines = window.ReportLayout.tsv(model).split('\n');
  assert.equal(lines[0], '\t\t\tGOVJANUP\tGOVJANUP\tOHCHAIR\tOHCHAIR\tOSCHAIR\tOSCHAIR');
  assert.equal(lines[1], '\t\t\t2026\t2027\t2026\t2027\t2026\t2027');
  const grand = lines.find(l => l.startsWith('Grand Total'));
  assert.ok(grand.includes('\t67438000\t'), 'no thousands separator survives into the export');
});

// ---- fromPartition: the workbench's pivot tree, drawn as a report ----------
//
// The shapes below are transform-workbench.js's pvTree() output as its own code
// documents it: a node carries {label, value, n, cells, children}, `cells` holds
// only the column keys that node actually saw, and `partition` is true only for
// sum and count. These are hand-built rather than driven through the component,
// because what is under test is the adapter's reading of that contract.
const node = (label, value, cells, children) =>
  ({ label, value, n: 1, cells: cells || {}, children: children || [] });

const PIVOT = {
  partition: true,
  colKeys: ['GOV · 2026', 'GOV · 2027', 'SEN · 2026', 'SEN · 2027'],
  tree: node('Total', 300, { 'GOV · 2026': 100, 'GOV · 2027': 50, 'SEN · 2026': 100, 'SEN · 2027': 50 }, [
    node('Comp', 200, { 'GOV · 2026': 100, 'SEN · 2026': 100 }, [
      node('PEBB', 200, { 'GOV · 2026': 100, 'SEN · 2026': 100 }),
    ]),
    node('Other', 100, { 'GOV · 2027': 50, 'SEN · 2027': 50 }, [
      node('LEOFF', 100, { 'GOV · 2027': 50, 'SEN · 2027': 50 }),
    ]),
  ]),
};

test('two column dimensions become a band over a period', () => {
  const m = window.ReportLayout.fromPartition(PIVOT, { levels: ['group', 'item'], band: true });
  assert.deepEqual(m.columns.map(c => [c.band, c.within, !!c.gapBefore]), [
    ['GOV', '2026', false], ['GOV', '2027', false],
    ['SEN', '2026', true], ['SEN', '2027', false],
  ]);
});

test('one column dimension stays a flat header with no band', () => {
  const flat = { ...PIVOT, colKeys: ['2026', '2027'] };
  const m = window.ReportLayout.fromPartition(flat, { levels: ['group', 'item'], band: false });
  assert.deepEqual(m.columns.map(c => c.band), ['', '']);
  assert.ok(!window.ReportLayout.render(m, {}).includes('bg-neutral'),
    'no band means no band header row is drawn at all');
});

test('a subtotal follows its block, and the root is the total', () => {
  const m = window.ReportLayout.fromPartition(PIVOT, { levels: ['group', 'item'], band: true });
  assert.deepEqual(m.rows.map(r => [r.kind, r.labels[r.labels.length - 1]]), [
    ['item', 'PEBB'], ['subtotal', 'Comp Total'],
    ['item', 'LEOFF'], ['subtotal', 'Other Total'],
    ['total', 'Total'],
  ]);
  const k = keyIn(m, 'SEN', '2027');
  assert.equal(m.rows.find(r => r.kind === 'total').values[k], 50);
});

test('a cell the node never saw stays absent, exactly as the pivot leaves it', () => {
  const m = window.ReportLayout.fromPartition(PIVOT, { levels: ['group', 'item'], band: true });
  const comp = m.rows.find(r => r.labels[0] === 'Comp Total');
  assert.equal(comp.values[keyIn(m, 'GOV', '2026')], 100);
  assert.equal(comp.values[keyIn(m, 'GOV', '2027')], undefined,
    'the pivot recorded no cell there, so the report prints a blank and not a zero');
});

test('an aggregate that does not partition gets no subtotal rows', () => {
  const avg = { ...PIVOT, partition: false };
  const m = window.ReportLayout.fromPartition(avg, { levels: ['group', 'item'], band: true });
  assert.equal(m.rows.filter(r => r.kind === 'subtotal').length, 0,
    'under avg, min or max a parent is not the sum of its children');
  assert.equal(m.partition, false, 'and the model says so, so a caller can report it');
  assert.ok(m.rows.some(r => r.kind === 'item'), 'the items still print');
});

test('one row level means no subtotals, since each block would be its own leaf', () => {
  const m = window.ReportLayout.fromPartition(PIVOT, { levels: ['group'], band: true });
  assert.equal(m.rows.filter(r => r.kind === 'subtotal').length, 0);
  assert.deepEqual(m.rows.filter(r => r.kind === 'item').map(r => r.labels[0]), ['Comp', 'Other']);
});

test('no column axis gives one column named for the aggregate', () => {
  const none = { partition: true, colKeys: [], tree: PIVOT.tree };
  const m = window.ReportLayout.fromPartition(none, { levels: ['group', 'item'], measureLabel: 'sum(amount)' });
  assert.deepEqual(m.columns.map(c => c.within), ['sum(amount)']);
  assert.equal(m.rows.find(r => r.kind === 'total').values[''], 300, 'the node value is the single cell');
});

// ---- order: whose reading of the same partition ---------------------------
//
// pvTree sorts children by value, so the tree arrives in magnitude order and
// carries `seq`, each node's position among its siblings before that sort. The
// two readings below are the same partition and the same figures; only the
// sequence of blocks differs, which is what makes order a reader's choice
// rather than a property of the data.
const SEQD = {
  partition: true,
  colKeys: ['2026'],
  // As pvTree emits it: sorted by value, seq remembering the source order
  // (Comp first, Ctrl Svc second, Other third).
  tree: {
    label: 'Total', value: 600, n: 3, cells: { 2026: 600 }, seq: 0,
    children: [
      { label: 'Ctrl Svc', value: 500, n: 1, cells: { 2026: 500 }, seq: 1, children: [] },
      { label: 'Other', value: 90, n: 1, cells: { 2026: 90 }, seq: 2, children: [] },
      { label: 'Comp', value: 10, n: 1, cells: { 2026: 10 }, seq: 0, children: [] },
    ],
  },
};

test('order source prints the blocks as the rows introduced them', () => {
  const m = window.ReportLayout.fromPartition(SEQD, { levels: ['group'], order: 'source' });
  assert.deepEqual(m.rows.filter(r => r.kind === 'item').map(r => r.labels[0]),
    ['Comp', 'Ctrl Svc', 'Other']);
});

test('order value leaves the tree as the Pivot view sorted it', () => {
  const m = window.ReportLayout.fromPartition(SEQD, { levels: ['group'], order: 'value' });
  assert.deepEqual(m.rows.filter(r => r.kind === 'item').map(r => r.labels[0]),
    ['Ctrl Svc', 'Other', 'Comp']);
});

test('the two readings differ in sequence and in nothing else', () => {
  const opts = { levels: ['group'] };
  const a = window.ReportLayout.fromPartition(SEQD, { ...opts, order: 'source' });
  const b = window.ReportLayout.fromPartition(SEQD, { ...opts, order: 'value' });
  const byLabel = m => Object.fromEntries(m.rows.map(r => [r.labels[0], r.values]));
  assert.deepEqual(byLabel(a), byLabel(b), 'every figure is identical under both');
  assert.deepEqual(a.columns, b.columns);
});

test('a tree with no seq falls back to its own order rather than an undefined sort', () => {
  const bare = { ...SEQD, tree: { ...SEQD.tree, children: SEQD.tree.children.map(({ seq, ...c }) => c) } };
  const m = window.ReportLayout.fromPartition(bare, { levels: ['group'], order: 'source' });
  assert.deepEqual(m.rows.filter(r => r.kind === 'item').map(r => r.labels[0]),
    ['Ctrl Svc', 'Other', 'Comp'], 'the tree as given, not a scrambled one');
});
