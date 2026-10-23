// lib/kits/swipe-deck.js — which taps an immersive deck reads as a request for
// the screen.
//
// A tap on a document toggles the header and the footer. Two kinds of slide
// opt out, and they differ in one respect that is the reason both exist:
// `data-sd-surface` (the Stage's image editor) is exempt from the tap AND the
// scroll-hide, since its lists scroll while the bands hold its tools;
// `data-sd-taps` (the formatted sheet, which selects a cell on a tap) is
// exempt from the tap only, since a sheet is still scrolled down like a page.
// The scroll half is the stage-sheet-reader scenario's, since jsdom has no
// scrolling to measure.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/swipe-deck.js'), 'utf8'))();
const sd = window.swipeDeck;
window.Element.prototype.scrollTo = function(){};
window.Element.prototype.scrollIntoView = function(){};

const tick = (n = 1) => new Promise(r => setTimeout(r, n * 10));

const openWith = async (attr) => {
  const h = sd.open({
    count: 2, immersive: true,
    render: (i, slide) => {
      const doc = window.document.createElement('div');
      if (attr) doc.setAttribute(attr, '');
      const cell = window.document.createElement('span');
      cell.className = 'cell';
      cell.textContent = 'text ' + i;
      doc.append(cell);
      slide.append(doc);
    },
  });
  await tick(3);
  const panel = h.el.querySelector('.sd-subheader').parentElement;
  const header = panel.children[0];
  const tap = () => h.el.querySelector('.cell').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  return { h, header, tap };
};

test('a tap on a plain document toggles the chrome', async () => {
  const { h, header, tap } = await openWith(null);
  assert.equal(header.classList.contains('hidden'), false);
  tap();
  assert.equal(header.classList.contains('hidden'), true, 'the tap took the header away');
  tap();
  assert.equal(header.classList.contains('hidden'), false, 'and the next one brought it back');
  h.drop();
});

for (const attr of ['data-sd-surface', 'data-sd-taps']) {
  test(`a tap inside ${attr} leaves the chrome where it is`, async () => {
    const { h, header, tap } = await openWith(attr);
    tap();
    assert.equal(header.classList.contains('hidden'), false, 'the slide owns its taps');
    h.drop();
  });
}
