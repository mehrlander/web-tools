// kits/redact.js: what decides behaviour without pixels. The editor is canvas
// work that jsdom cannot draw, so what is held here is how a dragged
// rectangle snaps to whole pixels, which ink a fill gets, and what a tap
// selects or edits. The Stage's half (the slide, the header, the swap) is
// held in stage.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, loadKit } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
loadKit('redact.js', { window });
const R = window.Redact;

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
