// fab-select.test.mjs — the launcher's selection offer: select text on the
// page and "+ note" appears above the launcher; one tap turns the annotator on
// and opens the composer on that passage.
//
// The fab declined a listener on the host document for years (the Text tab
// snapshots the selection at the launcher tap instead), and the cost was that
// a selection had no route to a note from the fab at all: the launcher's press
// collapses it, and the menu behind the press offers every aim but the text.
// Since 2026-09-08 the fab watches selectionchange, debounced, and offers the
// passage; the kit loads only when the offer is taken.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const { window } = makeWindow({ html: `<!doctype html><html><body>
  <article><p id="p1">The quick brown fox jumps over the lazy dog.</p>
  <textarea id="ta">typed words here</textarea></article>
</body></html>` });
const doc = window.document;
// The trio rides along so noteSelection() finds window.Annotate without a
// gh.load, which jsdom has no network for. Nothing here mounts until enable().
const Alpine = await startAlpine(window, [
  'lib/kits/dictate.js', 'lib/kits/annotate.js',
  'lib/kits/guide-render.js', 'lib/alpineComponents/path-picker.js', 'lib/alpineComponents/fab.js',
]);

const host = doc.createElement('div');
host.innerHTML = '<div x-data="fab()" data-repo="mehrlander/web-tools" data-path="app/index.html"></div>';
doc.body.appendChild(host);
Alpine.initTree(host);
await tick(3);
const d = Alpine.$data(host.firstElementChild);
d.SEL_SETTLE = 5;

// jsdom has no layout, so every rect is zero and the offer would read every
// selection as detached. One stub on the prototype covers the range the fab
// clones as well as the one the selection hands out; `rect` is what the
// placement test varies.
let rect = { left: 120, top: 300, right: 260, bottom: 318, width: 140, height: 18 };
window.Range.prototype.getBoundingClientRect = () => rect;

const select = (node, a, b) => {
  const r = doc.createRange();
  r.setStart(node, a); r.setEnd(node, b);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(r);
  doc.dispatchEvent(new window.Event('selectionchange'));
};
const settle = async () => { await new Promise(r => setTimeout(r, 30)); await tick(2); };
// TELEPORTED, so it is a child of the BODY rather than of the fab: the
// launcher's root carries a transform for the drag, which is a containing
// block for fixed descendants, so an offer inside it would be placed against
// that box and would travel with the launcher.
const offerEl = () => doc.body.querySelector('[data-fab-sel-offer]');

test('selecting text on the page raises the offer, on the passage', async () => {
  const p1 = doc.getElementById('p1').firstChild;
  select(p1, 4, 19);
  await settle();
  assert.ok(d.selOffer, 'the offer is up');
  assert.equal(d.selOffer.quote, 'quick brown fox');
  // x-transition lifts display:none on a later frame; bounded poll, as the
  // menu test does, rather than counting the scheduler's flushes.
  for (let i = 0; i < 20 && offerEl().style.display === 'none'; i++) await tick(1);
  assert.notEqual(offerEl().style.display, 'none');
  // NO QUOTE ON IT: the offer sits on the words, so printing them would be the
  // text saying itself twice, in width taken from the thing being read. The
  // passage rides the button's title instead.
  assert.equal(offerEl().textContent.replace(/\s+/g, ' ').trim(), '+ note');
  assert.match(offerEl().querySelector('button').title, /quick brown fox/);
});

test('the offer is placed on the passage, and follows it when the page scrolls', async () => {
  // It sat above the launcher first, which put a control about these words in
  // the corner where the fab lives. jsdom has no layout, so the range's rect is
  // stubbed: what is under test is the placement rule, not the geometry engine.
  const p1 = doc.getElementById('p1').firstChild;
  const base = rect;
  try {
    select(p1, 4, 19);
    await settle();
    assert.ok(d.selOffer, 'the offer is up');
    // Below the passage by default: iOS puts its own callout above a selection
    // where there is room, so the underside is the freer one more often.
    assert.equal(d.selOffer.top, 326, 'just under the passage');
    assert.equal(d.selOffer.left, 120, 'aligned to its left edge');

    // Scrolling moves the words and fires no selectionchange, so the offer has
    // to be told; otherwise it points at whatever scrolled into its place.
    rect = { ...base, top: 60, bottom: 78 };
    doc.dispatchEvent(new window.Event('scroll'));
    await tick(2);
    assert.equal(d.selOffer.top, 86, 'and it followed');

    // Scrolled clear of the viewport, the offer goes rather than clamping to an
    // edge, where it would point at nothing.
    rect = { ...base, top: -400, bottom: -382 };
    doc.dispatchEvent(new window.Event('scroll'));
    await tick(2);
    assert.equal(d.selOffer, null);
  } finally {
    rect = base;
  }
});

test('a collapsed selection takes the offer down; a caret is not a passage', async () => {
  const p1 = doc.getElementById('p1').firstChild;
  select(p1, 4, 19);
  await settle();
  assert.ok(d.selOffer);
  window.getSelection().removeAllRanges();
  doc.dispatchEvent(new window.Event('selectionchange'));
  await settle();
  assert.equal(d.selOffer, null);
});

test('a selection inside a field the reader is typing in is not offered', async () => {
  const ta = doc.getElementById('ta');
  ta.focus();
  // jsdom keeps the document selection apart from the textarea's; what the
  // fab reads is the active element, which is the honest signal on a browser
  // too, since a selection inside a field is the reader editing, not reading.
  select(doc.getElementById('p1').firstChild, 0, 3);
  await settle();
  assert.equal(d.selOffer, null);
  ta.blur();
});

test('the offer stands down while the annotator is on, whose own controls offer the same', async () => {
  window.Annotate.enable({ doc });
  select(doc.getElementById('p1').firstChild, 4, 19);
  await settle();
  assert.equal(d.selOffer, null);
  window.Annotate.disable();
});

test('taking the offer turns the annotator on and opens the composer on the passage', async () => {
  const p1 = doc.getElementById('p1').firstChild;
  select(p1, 4, 19);
  await settle();
  assert.ok(d.selOffer);
  // The platform may collapse the live selection on the tap; the Range the
  // offer read is what travels, so the note is still about the passage.
  window.getSelection().removeAllRanges();
  await d.noteSelection();
  assert.equal(d.selOffer, null, 'the offer is spent');
  const A = window.Annotate;
  assert.equal(A.enabled, true, 'the annotator came on');
  const S = A._state;
  assert.ok(S.draft, 'and a draft is open');
  assert.equal(S.draft.target.type, 'text');
  assert.equal(S.draft.target.quote.exact, 'quick brown fox');
  A.disable();
});

test('forgetting the offer drops it and the range with it', async () => {
  select(doc.getElementById('p1').firstChild, 4, 19);
  await settle();
  assert.ok(d.selOffer);
  d.dropSelOffer();
  assert.equal(d.selOffer, null);
  await d.noteSelection();
  assert.equal(window.Annotate.enabled, false, 'nothing to note, so nothing came on');
});
