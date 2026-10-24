// kits/row-menu.js: the row tap, what it offers, and when it stays out of the
// way.
//
// WHAT IS NOT HERE, for the same reason annotate's pointer path is not: jsdom
// computes no rects, so `place`'s clamp is real-browser behavior and cannot be
// asserted from a node test. Everything the clamp positions IS asserted, which
// is the menu's membership, its wording, what each item does, and the four ways
// it goes away.
//
// The table is a stub rather than a real Tabulator, and deliberately: the row
// menu touches exactly three of that library's methods (`on`, `getColumns`,
// `getRows`), and a stub is how that stays true. A drift into a fourth fails
// here rather than in a browser. The header menu is Tabulator's alone and gets
// a stub of its own, at the depth it uses.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, loadKit } from './bootstrap.mjs';

const { window } = makeWindow();
const doc = window.document;
loadKit('row-menu.js', { window });
const RM = window.rowMenu;

const COLS = [
  { field: 'item_id', title: 'Item' },
  { field: 'amount', title: 'Amount' },
  { field: 'hidden', title: 'Hidden' },
];
const ROWS = [
  { item_id: 'a-1', amount: 10, hidden: 'x', note: 'not a column' },
  { item_id: 'b-2', amount: null, hidden: 'y' },
  { item_id: 'c-3', amount: 'two\tlines\nhere', hidden: 'z' },
];

// A Tabulator stand-in over the three calls the kit is allowed to make.
function stubTable({ rows = ROWS, cols = COLS } = {}) {
  const handlers = {};
  const els = rows.map(() => doc.createElement('div'));
  rows.forEach((r, i) => { els[i].className = 'tabulator-row'; doc.body.append(els[i]); });
  const element = doc.createElement('div');
  els.forEach(el => element.append(el));
  doc.body.append(element);
  return {
    element,
    calls: [],
    on(ev, fn) { this.calls.push('on'); (handlers[ev] ||= []).push(fn); },
    off(ev, fn) { handlers[ev] = (handlers[ev] || []).filter(f => f !== fn); },
    getColumns() {
      this.calls.push('getColumns');
      return cols.map(c => ({
        getField: () => c.field,
        isVisible: () => c.field !== 'hidden',
        getDefinition: () => ({ title: c.title }),
      }));
    },
    getRows(which) {
      this.calls.push('getRows:' + which);
      return rows.map((r, i) => ({ getData: () => r, getElement: () => els[i], getCells: () => [] }));
    },
    // Drive a row tap the way Tabulator does: the native event, then the row.
    tap(i, target) {
      const e = new window.MouseEvent('click', { bubbles: true, clientX: 40, clientY: 60 });
      Object.defineProperty(e, 'target', { value: target || els[i] });
      for (const fn of handlers.rowClick || []) {
        fn(e, { getData: () => rows[i], getElement: () => els[i] });
      }
      return e;
    },
    // A right-click or a long press, which Tabulator reports as its own events.
    fire(ev, i) {
      const e = new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 60 });
      Object.defineProperty(e, 'target', { value: els[i] });
      for (const fn of handlers[ev] || []) fn(e, { getData: () => rows[i], getElement: () => els[i] });
      return e;
    },
    rowEl: (i) => els[i],
  };
}

const menu = () => doc.querySelector('[role="menu"]');
const labels = () => [...(menu()?.querySelectorAll('[role="menuitem"]') || [])]
  .map(b => b.textContent.trim());
const clickItem = (text) => {
  const b = [...menu().querySelectorAll('[role="menuitem"]')]
    .find(x => x.textContent.trim() === text);
  assert.ok(b, 'no menu item reading ' + JSON.stringify(text) + '; saw ' + JSON.stringify(labels()));
  b.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  return b;
};
const reset = () => { RM.close(); delete window.recordDeck; delete window.io; };

test('tsv leads with headers and keeps one row on one line', () => {
  const out = RM.tsv([{ field: 'a', title: 'A' }, { field: 'b', title: 'B' }],
                     [{ a: 'x', b: 'y' }, { a: null, b: 'two\tlines\nhere' }]);
  assert.deepEqual(out.split('\n'), ['A\tB', 'x\ty', '\ttwo lines here']);
});

test('columnsOf drops the hidden and the field-less, and keeps the order', () => {
  const t = stubTable();
  assert.deepEqual(RM.columnsOf(t), [
    { field: 'item_id', title: 'Item' }, { field: 'amount', title: 'Amount' },
  ]);
});

test('a tap on a plain cell opens a menu; on a link it does not', () => {
  reset();
  const t = stubTable();
  const off = RM.attach(t);
  t.tap(0);
  assert.ok(menu(), 'a plain row tap raised no menu');
  RM.close();

  const link = doc.createElement('a');
  t.rowEl(0).append(link);
  t.tap(0, link);
  assert.equal(menu(), null, 'a tap on a link raised the menu anyway');

  const btn = doc.createElement('button');
  t.rowEl(0).append(btn);
  t.tap(0, btn);
  assert.equal(menu(), null, 'a tap on a button raised the menu anyway');
  off();
});

test('the deck item appears only when record-deck is loaded, and starts on the tapped row', () => {
  reset();
  const t = stubTable();
  const off = RM.attach(t, { deck: { title: 'Items' } });

  t.tap(1);
  assert.deepEqual(labels(), ['Copy this record'],
    'the deck item showed with no record-deck loaded');
  RM.close();

  const seen = [];
  window.recordDeck = { fromGrid: (table, o) => { seen.push({ table, o }); } };
  t.tap(1);
  assert.deepEqual(labels(), ['Read from here', 'Copy this record']);
  clickItem('Read from here');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].table, t);
  assert.equal(seen[0].o.title, 'Items', 'the host options did not reach fromGrid');
  assert.equal(seen[0].o.startRow, ROWS[1], 'the deck did not open on the row that was tapped');
  off();
});

test('the row menu is about the row: no table copy, and the row is tinted while it is up', () => {
  reset();
  const t = stubTable({ rows: ROWS.slice(0, 2) });
  const cell = doc.createElement('div');
  cell.className = 'tabulator-cell';
  t.rowEl(0).append(cell);
  const off = RM.attach(t, { noun: 'row' });
  t.tap(0);
  assert.deepEqual(labels(), ['Copy this row'],
    'a menu opened on one row offered to copy the table, which the row cannot show');
  assert.ok(cell.classList.contains('bg-primary/15'), 'nothing shows which row "this row" is');
  RM.close();
  assert.ok(!cell.classList.contains('bg-primary/15'), 'the tint outlived the menu');
  off();
});

test('the table copy counts what the filters show, and copies that', async () => {
  reset();
  // A filtered grid answers getRows('active') with what is left, and the label
  // has to follow it: 322 over 74 visible rows would describe the file.
  const few = stubTable({ rows: ROWS.slice(0, 2) });
  const it = RM.copyTableItem(few);
  assert.equal(it.label, 'Copy 2 rows');
  assert.ok(few.calls.includes('getRows:active'), 'the count came from somewhere other than the active rows');
  assert.equal(RM.copyTableItem(stubTable({ rows: [ROWS[0]] })).label, 'Copy 1 row');
  assert.equal(RM.copyTableItem(stubTable({ rows: [] })), null, 'an empty grid offered a copy of nothing');

  const wrote = [];
  window.io = { copy: (text) => { wrote.push(text); return Promise.resolve(true); } };
  assert.equal(await RM.copyTableItem(stubTable()).run(), 'Copied');
  assert.deepEqual(wrote[0].split('\n'), ['Item\tAmount', 'a-1\t10', 'b-2\t', 'c-3\ttwo lines here']);
});

test('copy delegates to io.copy and reports what it got back', async () => {
  reset();
  const wrote = [];
  window.io = { copy: (text) => { wrote.push(text); return Promise.resolve(true); } };
  const t = stubTable();
  const off = RM.attach(t);

  t.tap(2);
  const btn = clickItem('Copy this record');
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(wrote, ['Item\tAmount\nc-3\ttwo lines here'],
    'the row copy is not the visible columns as TSV');
  assert.match(btn.textContent, /Copied/, 'a finished copy said nothing');


  // A refused write says so rather than claiming success.
  window.io = { copy: () => Promise.resolve(false) };
  RM.close();
  t.tap(0);
  const b2 = clickItem('Copy this record');
  await new Promise(r => setTimeout(r, 0));
  assert.match(b2.textContent, /Copy failed/);
  off();
});

test('host items ride along and are handed the row', () => {
  reset();
  const got = [];
  const t = stubTable();
  const off = RM.attach(t, {
    copy: false,
    items: [{ label: 'Open', icon: 'ph-arrow-square-out', run: (ctx) => { got.push(ctx); } }],
  });
  t.tap(2);
  assert.deepEqual(labels(), ['Open']);
  clickItem('Open');
  assert.equal(got.length, 1);
  assert.equal(got[0].data, ROWS[2]);
  assert.equal(got[0].table, t);
  off();
});

test('it goes away: Escape, an outside tap, a scroll, and detach', () => {
  reset();
  const t = stubTable();
  const off = RM.attach(t);

  t.tap(0);
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(menu(), null, 'Escape left the menu up');

  t.tap(0);
  doc.body.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
  assert.equal(menu(), null, 'a tap outside left the menu up');

  t.tap(0);
  doc.dispatchEvent(new window.Event('scroll', { bubbles: true }));
  assert.equal(menu(), null, 'a scroll left the menu pointing at a row that had moved');

  // The row it belongs to is marked while it is up, and unmarked after.
  t.tap(0);
  assert.ok(t.rowEl(0).classList.contains('row-menu-on'), 'the tapped row is not marked');
  RM.close();
  assert.ok(!t.rowEl(0).classList.contains('row-menu-on'), 'the mark outlived the menu');

  off();
  t.tap(0);
  assert.equal(menu(), null, 'detach left the row tap wired');
});

test('the kit touches only the three Tabulator calls it declares', () => {
  reset();
  const t = stubTable();
  window.recordDeck = { fromGrid: () => {} };
  const off = RM.attach(t, { deck: {} });
  t.tap(0);
  clickItem('Read from here');
  off();
  const used = new Set(t.calls.map(c => c.split(':')[0]));
  const declared = new Set(['getColumns', 'getRows', 'on']);
  assert.deepEqual([...used].filter(c => !declared.has(c)), [],
    'the kit reached for a Tabulator method its header does not declare');
});

// A finger on `el`: touchstart now, and the hold's timer left to run.
const press = (el, x = 20, y = 20) => {
  const e = new window.Event('touchstart', { bubbles: true });
  Object.defineProperty(e, 'touches', { value: [{ clientX: x, clientY: y }] });
  el.dispatchEvent(e);
};
const drag = (el, x, y) => {
  const e = new window.Event('touchmove', { bubbles: true });
  Object.defineProperty(e, 'touches', { value: [{ clientX: x, clientY: y }] });
  el.dispatchEvent(e);
};
const wait = (ms) => new Promise(r => setTimeout(r, ms));

test('on: context opens on a right-click or a held finger, and a tap stays a tap', async () => {
  reset();
  const t = stubTable();
  const off = RM.attach(t, { on: 'context', noun: 'row' });
  t.tap(0);
  assert.equal(menu(), null, 'a plain tap raised the context menu');
  const e = t.fire('rowContext', 0);
  assert.deepEqual(labels(), ['Copy this row']);
  assert.ok(e.defaultPrevented, "the browser's own menu would open over this one");
  RM.close();

  press(t.rowEl(1));
  await wait(250);
  assert.equal(menu(), null, 'a quarter second is a tap, not a hold');
  await wait(300);
  assert.ok(menu(), 'a held finger, the touch path, raised nothing');
  assert.ok(t.rowEl(1).classList.contains('row-menu-on'), 'the menu is not about the row under the finger');
  doc.dispatchEvent(new window.Event('touchcancel', { bubbles: true }));
  await wait(450);
  RM.close();

  press(t.rowEl(1), 20, 20);
  drag(t.rowEl(1), 20, 60);
  await wait(550);
  assert.equal(menu(), null, 'a finger that moved was a scroll and still opened the menu');

  off();
  t.fire('rowContext', 0);
  press(t.rowEl(0));
  await wait(550);
  assert.equal(menu(), null, 'detach left a gesture wired');
});

// ── the header menu ─────────────────────────────────────────────────────────

// A Tabulator table and its columns at the depth headerItems reads them.
function stubGrid() {
  const el = doc.createElement('div');
  doc.body.append(el);
  const state = { sorters: [], filters: {}, redraws: 0 };
  const defs = [
    { field: 'item_id', title: 'Item', headerFilter: 'input' },
    { field: 'amount', title: 'Amount', headerFilter: 'input' },
  ];
  const table = {
    element: el, options: {},
    getSorters: () => state.sorters,
    setSort: (field, dir) => { state.sorters = [{ field, dir }]; },
    setGroupBy(by) { this.options.groupBy = by; },
    getColumn(f) { return this.getColumns().find(c => c.getField() === f); },
    clearSort: () => { state.sorters = []; },
    getHeaderFilterValue: (f) => state.filters[f],
    setHeaderFilterValue: (f, v) => { state.filters[f] = v; },
    getHeaderFilters: () => Object.entries(state.filters).filter(([, v]) => v).map(([field, value]) => ({ field, value })),
    clearHeaderFilter: () => { state.filters = {}; },
    getRows: () => ROWS.map(r => ({ getData: () => r })),
    redraw: () => { state.redraws++; },
  };
  const cols = defs.map(d => {
    const h = doc.createElement('div');
    h.innerHTML = '<span class="tabulator-col-title">' + d.title + '</span><div class="tabulator-header-filter"><input></div>';
    el.append(h);
    let shown = true;
    return {
      getField: () => d.field, getDefinition: () => d, getElement: () => h, getTable: () => table,
      isVisible: () => shown, hide: () => { shown = false; }, show: () => { shown = true; },
    };
  });
  table.getColumns = () => cols;
  return { table, cols, state, el };
}
const headings = () => [...(menu()?.children || [])].filter(c => !c.matches('[role="menuitem"]')).map(c => c.textContent);
const openHeader = (col, opts) => {
  const out = RM.headerDefaults(opts).headerContextMenu(new window.MouseEvent('contextmenu', { clientX: 10, clientY: 10 }), col);
  assert.deepEqual(out, [], "Tabulator's own popup would draw beside this one");
};

test('a header menu has the table, then the column, and no sorts or filter items', () => {
  reset();
  const { cols } = stubGrid();
  openHeader(cols[1]);
  assert.deepEqual(headings(), ['Table', 'Amount']);
  assert.deepEqual(labels(), [
    'Hide header filters', 'Copy 3 rows',
    'Group by this column', 'Copy 3 values', 'Hide column',
  ], 'a click on the header sorts and its filter box is under the title; the menu repeats neither');
});

test('grouping hides the column, a second one joins the name, and ungrouping brings both back', async () => {
  reset();
  const { cols, table } = stubGrid();
  openHeader(cols[0]);
  clickItem('Group by this column');
  assert.equal(cols[0].isVisible(), false, 'the grouped column still shows a value its heading already says');
  assert.equal(table.options.groupBy(ROWS[0]), 'a-1');

  openHeader(cols[1]);
  assert.ok(!labels().includes('Group by this column'), 'a grouped grid offered a second, separate grouping');
  clickItem('Add to grouping');
  assert.equal(cols[1].isVisible(), false);
  assert.equal(table.options.groupBy(ROWS[0]), 'a-1 | 10', 'the group name is not every value, pipe-delimited');
  assert.equal(table.options.groupBy(ROWS[1]), 'b-2 | (blank)', 'an empty value left a name with a hole in it');

  // Both grouped columns are hidden, so the table section is the way back.
  const wrote = [];
  window.io = { copy: (t) => { wrote.push(t); return Promise.resolve(true); } };
  RM.tableButton(table).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(labels().slice(0, 3), ['Ungroup (Item | Amount)', 'Stop grouping by Item', 'Stop grouping by Amount']);
  clickItem('Copy 3 rows');
  await new Promise(r => setTimeout(r, 0));
  assert.equal(wrote[0].split('\n')[0], 'Item\tAmount', 'a copy while grouped dropped the grouped columns');

  RM.tableButton(table).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  clickItem('Stop grouping by Item');
  assert.equal(cols[0].isVisible(), true);
  assert.equal(cols[1].isVisible(), false);
  assert.equal(table.options.groupBy(ROWS[0]), '10');

  RM.tableButton(table).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  clickItem('Ungroup (Amount)');
  assert.equal(table.options.groupBy, false);
  assert.ok(cols.every(c => c.isVisible()), 'ungrouping left a column hidden');
});

test('a column copies its values as TSV', async () => {
  reset();
  const { cols } = stubGrid();
  const wrote = [];
  window.io = { copy: (t) => { wrote.push(t); return Promise.resolve(true); } };
  openHeader(cols[0]);
  clickItem('Copy 3 values');
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(wrote[0].split('\n'), ['Item', 'a-1', 'b-2', 'c-3']);
});

test('a column of a hundred or more distinct values does not offer to group', () => {
  reset();
  const { cols, table } = stubGrid();
  const many = Array.from({ length: 150 }, (_, i) => ({ item_id: 'id-' + i, amount: i % 3 }));
  table.getRows = () => many.map(r => ({ getData: () => r }));
  openHeader(cols[0]);
  assert.ok(!labels().includes('Group by this column'), '150 groups of one row is the table again');
  RM.close();
  openHeader(cols[1]);
  assert.ok(labels().includes('Group by this column'), 'three distinct amounts should group');
});

test('hiding a column is undone from the table section, and only what it hid', () => {
  reset();
  const { cols } = stubGrid();
  openHeader(cols[0]);
  clickItem('Hide column');
  assert.equal(cols[0].isVisible(), false);
  openHeader(cols[1]);
  assert.ok(!labels().includes('Hide column'), 'the last column showing could be hidden');
  clickItem('Show the hidden column');
  assert.equal(cols[0].isVisible(), true);
});

test('the filter switch hides the row on the table, or hands it to the host', () => {
  reset();
  const { cols, el, state } = stubGrid();
  openHeader(cols[0]);
  clickItem('Hide header filters');
  assert.deepEqual([...el.querySelectorAll('.tabulator-header-filter')].map(f => f.style.display), ['none', 'none']);
  assert.equal(state.redraws, 1, 'a hidden filter row leaves the header its old height until a redraw');
  openHeader(cols[0]);
  assert.ok(labels().includes('Show header filters'), 'the switch does not say which way it goes now');
  RM.close();

  // A host that keeps the setting above one table (the workbench, across its
  // grids) owns it: the menu reads it there and writes it there.
  let on = false;
  const seen = [];
  const opts = { filters: { on: () => on, set: (v) => { seen.push(v); on = v; } } };
  openHeader(cols[1], opts);
  clickItem('Show header filters');
  assert.deepEqual(seen, [true]);
  openHeader(cols[1], opts);
  assert.ok(labels().includes('Hide header filters'));
});

// rowMenu.grid over the header stub: `new` on a function that returns an
// object yields that object, which is all grid needs of Tabulator.
const gridOver = (g, opts = {}) => {
  const prior = window.Tabulator;
  const handlers = {};
  g.table.on = (ev, fn) => { (handlers[ev] ||= []).push(fn); };
  g.fire = (ev) => (handlers[ev] || []).forEach(fn => fn());
  window.Tabulator = function () { return g.table; };
  try { return RM.grid(doc.createElement('div'), {}, { rows: false, ...opts }); } finally { window.Tabulator = prior; }
};

test('a held header opens its menu and eats the release, so it neither sorts nor picks', async () => {
  reset();
  const g = stubGrid();
  gridOver(g);
  let sorted = 0;
  const head = g.cols[0].getElement();
  head.className = 'tabulator-col';
  head.addEventListener('click', () => { sorted++; });
  press(head.querySelector('.tabulator-col-title'));
  await wait(500);
  assert.deepEqual(headings(), ['Table', 'Item'], 'a held header raised no menu, or the wrong one');
  doc.dispatchEvent(new window.Event('touchend', { bubbles: true }));
  head.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.equal(sorted, 0, "the finger's release reached the header and sorted it");
  assert.ok(menu(), 'the release closed the menu it opened');
  await wait(450);
  head.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(sorted, 1, 'a later tap was eaten too');
});

test('a hold on a header filter is the input\'s, and Tabulator\'s own hold opens nothing', async () => {
  reset();
  const g = stubGrid();
  gridOver(g);
  g.cols[0].getElement().className = 'tabulator-col';
  press(g.cols[0].getElement().querySelector('input'));
  await wait(500);
  assert.equal(menu(), null, 'holding the filter box opened the menu over it');
  assert.deepEqual(RM.headerDefaults().headerContextMenu(new window.Event('touchstart'), g.cols[0]), []);
  assert.equal(menu(), null, "Tabulator's second-long hold opened a second menu");
  assert.ok([...g.table.element.classList].some(c => c.includes('select-none')),
    'cell text still selects on a touch screen, which is the gesture Safari takes over');
});

test('the header carries no button: the menu is a right-click or a hold', () => {
  assert.deepEqual(Object.keys(RM.headerDefaults()), ['headerContextMenu']);
});

test('the table button opens the table section alone, and grid places none over the headers', () => {
  reset();
  const g = stubGrid();
  const btn = RM.tableButton(g.table);
  doc.body.append(btn);
  btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(headings(), [], 'the table menu carries a column heading it has no column for');
  assert.deepEqual(labels(), ['Hide header filters', 'Copy 3 rows']);
  RM.close();

  const head = doc.createElement('div');
  head.className = 'tabulator-header';
  g.el.append(head);
  gridOver(g);
  g.fire('tableBuilt');
  assert.equal(head.children.length, 0, 'the grid put something over its own headers');
});
