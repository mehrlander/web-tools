// kits/redact.js: the pure parts. The editor is canvas work that jsdom cannot
// draw, so what is held here is what decides behaviour without pixels: which
// words get flagged for hiding, what a box is labelled, how a dragged
// rectangle snaps to whole pixels, and which ink a fill gets. The Stage's door
// into the editor, and the swap it makes, are held in stage.test.mjs.
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
