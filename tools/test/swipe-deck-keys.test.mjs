// kits/swipe-deck.js — the keys of a strip embedded in a page.
//
// A deck opened with open() steps on Left and Right itself. A strip a page
// embeds with core() answered nothing until 2026-10-06 unless its caller wired
// a handler, and five callers had, each to the same rule. `core({ keys })` and
// `swipeDeck.keys()` are that rule, held once: the strip takes the arrows while
// the pointer is over its host or focus is inside it, never while typing, the
// innermost host wins, and a strip under a deck is out of reach.
//
// jsdom has no pointer, so `:hover` never matches here and every case arms the
// strip by focus, which is the other half of the same condition. It has no
// layout either: the geometry below is the stack test's, plus a box for every
// element so a host reads as on screen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/swipe-deck.js'), 'utf8'))();
const sd = window.swipeDeck;
const doc = window.document;

Object.defineProperty(window.Element.prototype, 'clientWidth', { value: 400, configurable: true });
window.Element.prototype.scrollTo = function ({ left }) {
  Object.defineProperty(this, 'scrollLeft', { value: left, configurable: true, writable: true });
  this.dispatchEvent(new window.Event('scroll'));
};
window.Element.prototype.getBoundingClientRect = function () {
  return { left: 0, right: 400, top: 0, bottom: 300, width: 400, height: 300 };
};

const tick = (n = 1) => new Promise(r => setTimeout(r, n * 10));
// From the element that has focus, as a key from a reader's keyboard is, so the
// event travels the document and reaches window in both phases.
const key = (k, extra = {}) => (doc.activeElement || doc.body).dispatchEvent(
  new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra }));

// A card the way a page builds one: a head row with a control in it, and the
// track under it. `keys` is the card, so focus on the head's button arms it.
function strip(n, parent = doc.body) {
  const card = doc.createElement('div');
  const btn = doc.createElement('button');
  btn.textContent = 'head';
  card.append(btn);
  const core = sd.core(n, (i, el) => { el.textContent = 'card ' + i; }, { keys: card });
  card.append(core.track);
  parent.append(card);
  return { card, btn, core };
}

test('focus in the card arms it: Right steps the track, Left steps it back', async () => {
  const s = strip(4);
  s.btn.focus();
  key('ArrowRight');
  await tick();
  assert.equal(s.core.active(), 1);
  key('ArrowLeft');
  await tick();
  assert.equal(s.core.active(), 0);
  s.card.remove();
});

test('with neither the pointer nor focus in the card, the keys are not taken', async () => {
  const s = strip(4);
  doc.body.focus();
  const ev = new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
  doc.body.dispatchEvent(ev);
  await tick();
  assert.equal(s.core.active(), 0);
  assert.equal(ev.defaultPrevented, false, 'an event the strip did not take is left alone');
  s.card.remove();
});

test('typing in a field inside the card, or a modifier held, leaves the keys to the page', async () => {
  const s = strip(4);
  const input = doc.createElement('input');
  s.card.prepend(input);
  input.focus();
  key('ArrowRight');
  await tick();
  assert.equal(s.core.active(), 0, 'the caret moves, not the strip');
  s.btn.focus();
  key('ArrowRight', { shiftKey: true });
  key('ArrowRight', { metaKey: true });
  await tick();
  assert.equal(s.core.active(), 0);
  s.card.remove();
});

test('a strip of one card does not take the key', async () => {
  const s = strip(1);
  s.btn.focus();
  const ev = new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
  doc.activeElement.dispatchEvent(ev);
  await tick();
  assert.equal(ev.defaultPrevented, false);
  s.card.remove();
});

test('the innermost strip wins: a strip inside another card takes the key from it', async () => {
  const outer = strip(5);
  const inner = strip(3, outer.card);
  inner.btn.focus();
  key('ArrowRight');
  await tick();
  assert.equal(inner.core.active(), 1, 'the inner strip stepped');
  assert.equal(outer.core.active(), 0, 'and the strip around it did not');
  outer.btn.focus();
  key('ArrowRight');
  await tick();
  assert.equal(outer.core.active(), 1, 'focus elsewhere on the outer card steps the outer strip');
  assert.equal(inner.core.active(), 1);
  outer.card.remove();
});

test('a key pressed again before the track arrives counts from where it is headed', async () => {
  const s = strip(6);
  // A smooth scroll still in flight: the track has not moved yet.
  s.core.track.scrollTo = () => {};
  s.btn.focus();
  key('ArrowRight');
  key('ArrowRight');
  let to = null;
  s.core.track.scrollTo = ({ left }) => { to = left / 400; };
  key('ArrowRight');
  assert.equal(to, 3, 'three presses, three cards, though the track had not moved');
  s.card.remove();
});

test('a strip under a deck is out of reach; one inside the deck on top takes the key from the deck', async () => {
  const under = strip(4);
  under.btn.focus();
  const deck = sd.open({ count: 3, title: 'deck', render: (i, el) => { el.textContent = 'slide ' + i; } });
  await tick(2);
  // Focus is still on the strip under the overlay, which the reader cannot see.
  under.btn.focus();
  key('ArrowRight');
  await tick();
  assert.equal(under.core.active(), 0, 'the covered strip did not step');
  assert.equal(deck.deck.active(), 1, 'the deck did, by its own keys');

  const inside = strip(3, deck.el);
  inside.btn.focus();
  key('ArrowRight');
  await tick();
  assert.equal(inside.core.active(), 1, 'the strip in the deck stepped');
  assert.equal(deck.deck.active(), 1, 'and the deck around it did not');
  deck.drop();
  under.card.remove();
});

test('keys() serves a track built some other way, one registration per host, and off() forgets it', async () => {
  const host = doc.createElement('div');
  const btn = doc.createElement('button');
  host.append(btn);
  doc.body.append(host);
  let at = 0, n = 3;
  const off1 = sd.keys(host, d => { at += d; }, () => n);
  sd.keys(host, d => { at += 10 * d; }, () => n);
  btn.focus();
  key('ArrowRight');
  assert.equal(at, 10, 'registering the host again replaced the first registration');
  off1();
  key('ArrowRight');
  assert.equal(at, 20, 'an off() from a replaced registration does not remove its successor');
  n = 1;
  key('ArrowRight');
  assert.equal(at, 20, 'under two, the key is not taken');
  host.remove();
});
