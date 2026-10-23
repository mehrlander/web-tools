// alpineComponents/viewer.js — WHAT show() PROMISES, held behaviourally rather
// than by reading the source for an `await`.
//
// A mode module's `after()` is its async mount: it fetches, loads its library,
// parses, draws, and publishes what it publishes on `root`. switchMode used to
// fire it into a $nextTick and drop the promise, so show() resolved before
// after() had been CALLED and a host had nothing to wait on. Five polls grew in
// that gap, three of them for one workbook's sheet list.
//
// Driven through a probe module with no `assets`, so prepare() short-circuits
// and nothing touches a CDN (the trick viewer-host-modules.test.mjs uses). The
// probe's mount is a promise this file resolves by hand, which is what makes
// "did not resolve YET" assertable at all: a real module would race the test.
//
// The workbook half stubs `window.xlsxKit`. readZip is xlsx.test.mjs's subject
// and re-reading a zip here would only move the failure; what is under test is
// the order the module draws in, and the stub is the smallest thing that lets
// the real after() run to its end.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="v" x-data="viewer()"></div>
    <div id="wb" x-data="viewer()"></div>
  </body></html>`,
});

const Alpine = await startAlpine(window, [
  'lib/vanilla-bundle.js',
  'lib/alpine-bundle.js',
  'lib/alpineComponents/viewer.js',
]);

const R = window.ViewRegistry;
const doc = window.document;
const data = Alpine.$data(doc.getElementById('v'));

// The probe's mount, steered per test: 'hold' parks on a promise this file
// resolves, 'throw' gives up the way a module does when its bytes will not
// open, 'quick' returns without awaiting anything.
let plan = 'hold';
let release = null;
let started = 0;

R.modules.unshift({
  id: 'probe', label: 'Probe', icon: 'ph-bug',
  exclusive: true,
  test: (f) => f.ext === 'probe',
  render: () => '<div data-probe="root"></div>',
  after: async (f, ctx) => {
    started++;
    if (plan === 'throw') throw new Error('the bytes did not open');
    if (plan === 'hold') await new Promise(r => { release = r; });
    ctx.root.__probe = { name: f.name };
  },
});

// ── what show() waits for ────────────────────────────────────────────────────

test('show() does not resolve until the module has finished mounting', async () => {
  plan = 'hold';
  release = null;
  const root = doc.getElementById('v');
  delete root.__probe;

  let settled = false;
  const shown = data.show('a.probe', 'x', { local: true }).then(() => { settled = true; });

  // Far past the $nextTick the mount used to be fired and forgotten on.
  await tick(6);
  assert.equal(started, 1, 'the module never mounted');
  assert.equal(settled, false, 'show() resolved while the mount was still running');
  assert.equal(root.__probe, undefined, 'the mount published before it was allowed to');

  release();
  await shown;
  assert.equal(settled, true);
});

test('what the module publishes is there the moment show() resolves', async () => {
  plan = 'quick';
  const root = doc.getElementById('v');
  delete root.__probe;

  await data.show('b.probe', 'x', { local: true });

  // No tick, no poll, no frame: the read happens on the line after the await,
  // which is the thing home's sheetsOf() had to loop for.
  assert.deepEqual(root.__probe, { name: 'b.probe' });
});

test('the pane is visible while the module works, not held behind the spinner', async () => {
  // viewLoading flips BEFORE the mount is awaited, deliberately: the module
  // draws into the body that `x-show="!viewLoading"` gates, and Tabulator sizes
  // off a container that display:none reports as zero. Awaiting first would
  // hide every module's own progress message behind this spinner.
  plan = 'hold';
  release = null;
  const shown = data.show('c.probe', 'x', { local: true });
  await tick(6);
  assert.equal(data.viewLoading, false, 'the spinner is still up during the mount');
  release();
  await shown;
});

test('a module that gives up does not reject show()', async () => {
  plan = 'throw';
  const before = problems.length;

  // Resolves rather than throws. A module reports its own failure in its own
  // pane, and no host has ever had a rejection here to handle.
  await data.show('d.probe', 'x', { local: true });

  const said = problems.slice(before).map(p => p.join(' ')).join('\n');
  assert.match(said, /probe module failed to mount/,
    'the failure was swallowed without a word');
});

// ── the workbook's first sheet ───────────────────────────────────────────────

const wbData = Alpine.$data(doc.getElementById('wb'));
const wbRoot = doc.getElementById('wb');

// Tabulator is a CDN asset. The double carries exactly what the grid module
// asks of it, which is now four things: a table is constructed, destroyed,
// says when it has BUILT (the rows do not exist at construction, and a host
// citing a row the moment show() resolves asked an empty table before this),
// and can be asked for its rows.
window.Tabulator = class {
  constructor() { this._handlers = {}; }
  destroy() {}
  on(event, fn) { (this._handlers[event] ||= []).push(fn); setTimeout(() => fn(), 0); }
  getRows() { return []; }
};
R.loadAsset = () => Promise.resolve();
window.xlsxKit = {
  readZip: async () => ({ xl: { sheets: {
    s1: { name: 'Alpha', index: 0, cellCount: 1 },
    s2: { name: 'Beta', index: 1, cellCount: 1 },
    s3: { name: 'Gamma', index: 2, cellCount: 1 },
  } } }),
  sheetRows: (s) => [{ sheet: s.name }],
  // Enough shape for drawSheet to build a one-cell table; the kit's own tests
  // hold the layout itself.
  sheetLayout: (s) => ({
    cols: [{ index: 0, width: 64 }],
    rows: [{ row: 1, height: 20, cells: [{ col: 0, text: s.name, numeric: false,
      style: null, raw: null, colSpan: 1, rowSpan: 1, spillLeft: 0, spillRight: 0 }] }],
    maxCol: 0, freeze: null, truncated: null, empty: false,
  }),
  cellStyle: () => null,
  colLetter: () => 'A',
};

// gh-api.js's byte decoder, as Node answers it; the viewer reads a data URI's
// base64 through it.
window.GH = { decodeBytes: (s) => new Uint8Array(Buffer.from(String(s), 'base64')) };
const XLSX_URI = 'data:application/vnd.openxmlformats;base64,' + window.btoa('PK');
// Either mode's strip: the sheet render and the grid publish the same contract
// and wear the same tab row under different data attributes.
const tabs = () => [...wbRoot.querySelectorAll('[data-sheet="tabs"] button, [data-xlsx="tabs"] button')];
const activeTab = () => tabs().findIndex(b => b.classList.contains('tab-active'));

test('a workbook opens on the sheet render with its first sheet drawn', async () => {
  await wbData.show('book.xlsx', XLSX_URI, { local: true });
  assert.equal(wbData.mode, 'sheet', 'the exclusive mode is the one that opened');
  assert.deepEqual(tabs().map(b => b.textContent), ['Alpha', 'Beta', 'Gamma']);
  // Array.from, because `list` is built inside the jsdom realm and .map() on
  // it yields that realm's Array, which deepStrictEqual reports as a prototype
  // mismatch under a diff that reads identical.
  assert.deepEqual(Array.from(wbRoot.__sheets.list, s => s.name), ['Alpha', 'Beta', 'Gamma']);
  assert.equal(activeTab(), 0, 'the first sheet was left to a frame running after the mount');
});

test('the grid publishes the same sheets when a reader switches to it', async () => {
  await wbData.show('book.xlsx', XLSX_URI, { local: true });
  await wbData.switchMode('xlsx');
  await tick(6);
  assert.deepEqual(tabs().map(b => b.textContent), ['Alpha', 'Beta', 'Gamma']);
  assert.deepEqual(Array.from(wbRoot.__sheets.list, s => s.name), ['Alpha', 'Beta', 'Gamma'],
    "a host's deck must survive the reader changing mode");
});

test('a sheet chosen the moment show() resolves is not overwritten', async () => {
  // THE REGRESSION THIS FILE EXISTS FOR. The module opens sheet 0 on a frame;
  // while that frame ran after after() returned, a host acting on show()
  // selected its sheet first and the frame put sheet 0 back underneath the
  // heading the host had already written. Nothing in home was waiting for a
  // frame on purpose: a poll on a 100ms interval was the only thing sequencing
  // these two, by accident. Held for both modes, since the grid is the one
  // that still opens its first sheet on a frame.
  for (const mode of ['sheet', 'xlsx']) {
    await wbData.show('book.xlsx', XLSX_URI, { local: true });
    if (wbData.mode !== mode) { await wbData.switchMode(mode); await tick(6); }
    wbRoot.__sheets.show(2);
    await tick(6);
    assert.equal(activeTab(), 2, `${mode}: the mount drew over the sheet the host asked for`);
  }
});

test('mounting stayed quiet apart from the failure it was told to report', () => {
  const noise = problems.filter(([, m]) => !/probe module failed to mount/.test(String(m)));
  assert.deepEqual(noise, []);
});

// ── selection and the inspector band ─────────────────────────────────────────
//
// mountSheetSelect over a real drawSheet table: a tap selects a cell, a row
// number a row, a column letter a column, shift extends, a merge selects as
// one cell, and the copy text is tab-separated as the cells are shown. Driven
// with click() rather than pixels, since what is under test is the reading of
// the table and not where a finger lands; the pixels are the stage-sheet-reader
// scenario's.

test('a tap selects and the band reads the cell; rows, columns and ranges read as ranges', () => {
  const kit = window.xlsxKit;
  const was = { sheetLayout: kit.sheetLayout, colLetter: kit.colLetter, formulaText: kit.formulaText, cellFormat: kit.cellFormat };
  const cell = (col, text, o = {}) => ({ col, text, numeric: false, style: null, raw: null,
    colSpan: 1, rowSpan: 1, spillLeft: 0, spillRight: 0, ...o });
  const layout = {
    cols: [0, 1, 2].map(index => ({ index, width: 64 })),
    rows: [
      { row: 1, height: 20, cells: [cell(0, 'Title', { colSpan: 3 })] },
      { row: 2, height: 20, cells: [cell(0, 'Qty'), cell(1, '2', { numeric: true }), cell(2, '4', { numeric: true })] },
      { row: 3, height: 20, cells: [cell(0, 'a\tb'), cell(1, '3', { numeric: true }), cell(2, '6', { numeric: true,
        note: { kind: 'comment', comment: { author: 'Ann', text: 'checked' } } })] },
    ],
    maxCol: 2, freeze: null, truncated: null, empty: false,
  };
  const sheet = { merges: [{ r1: 1, c1: 0, r2: 1, c2: 2 }],
    rows: [{ row: 1, cells: { 0: 'Title' } }, { row: 2, cells: { 0: 'Qty', 1: '2', 2: '4' } },
           { row: 3, cells: { 0: 'a\tb', 1: '3', 2: '6' }, formulas: { 2: 'B3*2' } }] };
  Object.assign(kit, {
    sheetLayout: () => layout,
    colLetter: (n) => String.fromCharCode(65 + n),
    formulaText: (s, row, col) => typeof row?.formulas?.[col] === 'string' ? '=' + row.formulas[col] : '',
    cellFormat: () => null,
  });
  try {
    const root = doc.createElement('div'), pane = doc.createElement('div');
    root.append(pane); doc.body.append(root);
    const drawn = R.drawSheet(sheet, {}, 'k');
    pane.append(drawn);
    const heard = [];
    const sel = R.mountSheetSelect(root, pane, () => ({ s: sheet, xl: {}, layout: drawn.__layout, name: 'Data' }),
      (r) => heard.push(r));
    const band = root.querySelector('[data-sheet="inspect"]');
    const text = (k) => band.querySelector(`[data-f="${k}"]`);
    const shown = (k) => !text(k).hidden;
    const selected = () => Array.from(pane.querySelectorAll('td[data-sel]'), td => td.getAttribute('data-c'));
    const td = (a) => pane.querySelector(`td[data-c="${a}"]`);
    const click = (el, o = {}) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, ...o }));

    assert.equal(text('at').hidden, true, 'nothing selected, nothing read');
    click(td('C3'));
    assert.deepEqual(selected(), ['C3']);
    assert.ok(td('C3').hasAttribute('data-cur'), 'the tapped cell is the active one');
    assert.equal(text('at').hidden, false);
    assert.equal(text('at').textContent, 'C3');
    assert.equal(text('formula').textContent, '=B3*2');
    assert.ok(shown('Shown') && text('Shown').lastElementChild.textContent === '6');
    assert.ok(shown('Comment') && text('Comment').lastElementChild.textContent === 'Ann: checked');
    assert.equal(drawn.querySelectorAll('th[data-sel]').length, 2, 'its column letter and row number are lit');

    click(td('B2'), { shiftKey: true });
    assert.deepEqual(selected().sort(), ['B2', 'B3', 'C2', 'C3']);
    // The selection as data: a plain rectangle a later feature can read.
    assert.deepEqual({ ...sel.range() }, { sheet: 'Data', r1: 2, c1: 1, r2: 3, c2: 2, address: 'B2:C3', active: 'C3', kind: 'cell' });
    assert.equal(heard.at(-1).address, 'B2:C3', 'and every change is heard');
    assert.equal(text('formula').textContent, '=B3*2', 'the field holds the active cell, as Excel\'s does');
    assert.equal(text('Size').lastElementChild.textContent, '2 × 2');
    assert.equal(text('Count').lastElementChild.textContent, '4');
    assert.equal(text('Sum').lastElementChild.textContent, '15');
    assert.ok(!shown('Comment') && !shown('Shown'), 'a range clears what only a cell says');
    assert.equal(sel.tsv(), '2\t4\n3\t6');

    click(td('A1'));
    assert.equal(text('at').textContent, 'A1:C1', 'a merge reads as one cell, named by its range');
    assert.equal(text('Merged').lastElementChild.textContent, 'A1:C1');

    click(drawn.querySelectorAll('tbody th')[2]);
    assert.deepEqual(selected(), ['A3', 'B3', 'C3'], 'a row number selects the row');
    assert.equal(sel.tsv(), '"a\tb"\t3\t6', 'a cell holding a tab is quoted, as Excel quotes it');

    click(drawn.querySelectorAll('thead th')[2]);
    assert.deepEqual(selected().sort(), ['A1', 'A2', 'A3', 'B2', 'B3', 'C2', 'C3'],
      'a column letter selects the column, widened to every column the merge it cuts through covers');

    // The arrows. jsdom lays nothing out, so the root is given a box for the
    // on-screen check; keeping a cell in view is the scenario's to show.
    root.getBoundingClientRect = () => ({ width: 300, height: 200, left: 0, right: 300, top: 0, bottom: 200 });
    const key = (k, o = {}) => {
      const e = new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o });
      doc.body.dispatchEvent(e);
      return e.defaultPrevented;
    };
    click(td('B2'));
    assert.equal(key('ArrowRight'), true, 'with a selection, the sheet takes the arrow');
    assert.deepEqual(selected(), ['C2']);
    key('ArrowRight');
    assert.deepEqual(selected(), ['C2'], 'the last column is a wall');
    key('ArrowDown');
    assert.deepEqual(selected(), ['C3']);
    key('ArrowUp'); key('ArrowUp');
    assert.deepEqual(selected(), ['A1'], 'stepping into a merge lands on the merge, by its anchor');
    key('ArrowDown');
    assert.deepEqual(selected(), ['A2'], 'and stepping out leaves from its edge');
    key('ArrowRight', { shiftKey: true }); key('ArrowDown', { shiftKey: true });
    assert.deepEqual(selected().sort(), ['A2', 'A3', 'B2', 'B3'], 'Shift grows the range');
    assert.ok(td('A2').hasAttribute('data-cur'), 'from the cell that stays active');
    assert.equal(key('ArrowLeft', { ctrlKey: true }), false, 'Ctrl+arrow is not the sheet\'s');

    // The formulas toggle: the only computed cell is C3, and the tint is a
    // mark on the pane, so it outlives a redraw of the table inside it.
    assert.deepEqual(Array.from(pane.querySelectorAll('td[data-fx]'), x => x.getAttribute('data-c')), ['C3']);
    band.querySelector('[data-b="fx"]').click();
    assert.ok(pane.hasAttribute('data-show-fx'));

    sel.reset();
    assert.equal(text('at').hidden, true, 'a redraw clears the selection');
    assert.equal(heard.at(-1), null, 'and says so');
    assert.equal(key('ArrowRight'), false, 'with nothing selected, the arrows pass on to the deck');
    root.remove();
  } finally { Object.assign(kit, was); }
});

// ── links on the page render ─────────────────────────────────────────────────

test('drawSheet draws an external link as an anchor and an internal one for locate', () => {
  const kit = window.xlsxKit, was = kit.sheetLayout;
  kit.sheetLayout = () => ({
    cols: [{ index: 0, width: 64 }, { index: 1, width: 64 }, { index: 2, width: 64 }],
    rows: [{ row: 1, height: 20, cells: [
      { col: 0, text: 'OFM', numeric: false, style: null, raw: null, colSpan: 1, rowSpan: 1, spillLeft: 0, spillRight: 0,
        link: { href: 'https://ofm.wa.gov/', location: null, tooltip: 'contacts' } },
      { col: 1, text: 'Data', numeric: false, style: null, raw: null, colSpan: 1, rowSpan: 1, spillLeft: 0, spillRight: 0,
        link: { href: null, location: "'Data'!A1", tooltip: null } },
      { col: 2, text: 'x', numeric: false, style: null, raw: null, colSpan: 1, rowSpan: 1, spillLeft: 0, spillRight: 0,
        link: { href: 'javascript:alert(1)', location: null, tooltip: null } },
    ] }],
    maxCol: 2, freeze: null, truncated: null, empty: false,
  });
  try {
    const el = R.drawSheet({ merges: [] }, {}, 'k');
    const a = el.querySelectorAll('td a');
    assert.equal(a.length, 2, 'the javascript: scheme draws no anchor');
    assert.equal(a[0].getAttribute('href'), 'https://ofm.wa.gov/');
    assert.equal(a[0].getAttribute('target'), '_blank');
    assert.equal(a[0].getAttribute('title'), 'contacts');
    assert.equal(a[1].getAttribute('data-goto'), "'Data'!A1");
    assert.equal(a[1].textContent, 'Data');
  } finally { kit.sheetLayout = was; }
});
