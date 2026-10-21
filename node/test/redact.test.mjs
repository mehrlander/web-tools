// kits/redact.js: what decides behaviour without pixels. The editor is canvas
// work that jsdom cannot draw, so what is held here is which words get
// flagged for hiding, what a box is labelled, how a dragged rectangle snaps to
// whole pixels, which ink a fill gets, and what a tap selects or boxes. The
// Stage's door into the editor, and the swap it makes, are held in
// stage.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, loadKit } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
loadKit('redact.js', { window });
const R = window.Redact;

test('the flags catch the shapes they claim, and leave plain words alone', () => {
  const kinds = Object.fromEntries([
    '<jane.doe@example.com>', '(360)', '555-0142', '360-555-0142', '$1,240.18',
    '2026-44817', '4417', '9:41', 'Friday.', 'Jane', '123',
  ].map(t => [t, R.kindOf(t)]));
  assert.deepEqual(kinds, {
    '<jane.doe@example.com>': 'email', '(360)': 'phone', '555-0142': 'phone',
    '360-555-0142': 'phone', '$1,240.18': 'amount', '2026-44817': 'number', '4417': 'number',
    // A clock time, a word, a name and a short number are not flagged. Names
    // in particular: no pattern tells a name from a word.
    '9:41': '', 'Friday.': '', 'Jane': '', '123': '',
  });
});

test('a box spanning several kinds takes the strongest label', () => {
  assert.equal(R.labelOf(['phone', 'phone']), '[phone]');
  assert.equal(R.labelOf(['number', 'email']), '[email]', 'an email outranks a number beside it');
  assert.equal(R.labelOf([]), '');
});

test('a rectangle snaps outward to whole pixels and stays on the image', () => {
  // Outward, not rounded: a fractional edge would leave the original blended
  // into the border pixels, and the byte check would fail on it.
  assert.deepEqual({ ...R.snap(10.6, 20.2, 30.1, 40.9, 100, 100) }, { x: 10, y: 20, w: 21, h: 21 });
  assert.deepEqual({ ...R.snap(30, 40, 10, 20, 100, 100) }, { x: 10, y: 20, w: 20, h: 20 }, 'a drag up and left is the same box');
  assert.deepEqual({ ...R.snap(-5, -5, 120, 130, 100, 100) }, { x: 0, y: 0, w: 100, h: 100 });
});

test('a label reads on its fill', () => {
  assert.equal(R.ink('#ffffff'), '#000000');
  assert.equal(R.ink('#fde047'), '#000000');
  assert.equal(R.ink('#000000'), '#ffffff');
  assert.equal(R.ink('#1d4ed8'), '#ffffff');
});

// The editor's press-and-release logic, run on the component itself over a
// stand-in canvas 100 px square at scale 1: no pixels are drawn, only what a
// tap selects or boxes is read back.
const editor = async () => {
  const { window: w } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
  let make;
  w.Alpine = { data: (_, f) => { make = f; } };
  // The kit runs through new Function, so its bare names resolve here.
  globalThis.createImageBitmap = async () => ({ width: 100, height: 100 });
  loadKit('redact.js', { window: w });
  const ed = make();
  ed.$refs = {
    cv: { width: 0, height: 0, clientWidth: 100, offsetLeft: 0, offsetTop: 0, clientLeft: 0, clientTop: 0,
          getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) },
    edit: { style: {}, value: '', focus() {}, select() {}, blur() {} },
  };
  await ed.load({}, 'test.png');
  return ed;
};
const tap = (ed, x, y) => { ed.down({ clientX: x, clientY: y, pointerId: 1, target: { setPointerCapture() {} } }); ed.up(); };

test('a tap on a box selects it, and a second tap edits its label in the box', async () => {
  // A press selects a box, so a release that toggled the selection
  // unselected the box the finger had just picked.
  const ed = await editor();
  ed.addBox({ x: 10, y: 10, w: 40, h: 20, label: '[removed]' });
  const id = ed.sel;
  ed.sel = null;
  tap(ed, 30, 20);
  assert.equal(ed.sel, null, 'with the tools off the image is only shown: a tap selects nothing');
  ed.active = true;
  tap(ed, 80, 80);
  assert.equal(ed.sel, null, 'a tap off every box clears the selection and ends any edit');
  assert.equal(ed.editing, null);
  tap(ed, 30, 20);
  assert.equal(ed.sel, id, 'a tap on the box selects it');
  assert.equal(ed.editing, null, 'the first tap does not edit');
  tap(ed, 30, 20);
  assert.equal(ed.sel, id, 'a second tap leaves it selected');
  assert.equal(ed.editing?.id, id, 'and edits its label in the box');
  ed.selLabel = '[Name removed]';
  ed.endEdit(false);
  assert.equal(ed.selBox.label, '[removed]', 'Escape restores the label the edit opened with');
});

test('a tap on a found word boxes it, once the tools are on', async () => {
  const ed = await editor();
  ed.lines = [{ words: [{ id: 0, line: 0, i: 0, text: 'Jane', kind: '', bbox: { x0: 10, y0: 60, x1: 40, y1: 75 } }] }];
  tap(ed, 20, 70);
  assert.equal(ed.boxes.length, 0, 'tools off: the word is left alone');
  ed.active = true;
  tap(ed, 20, 70);
  assert.equal(ed.boxes.length, 1, 'tools on: the word is boxed');
});
