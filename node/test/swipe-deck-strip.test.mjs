// kits/swipe-deck.js — strip(), the driver for a strip a component draws itself.
//
// Seven components carried their own copy of this until 2026-10-24 (see A STRIP
// SOMEONE ELSE DRAWS in the kit). jsdom does no layout, so the strip is given
// one here, the branch-brief test's: 300px cards with a 12px gap, each card's
// left edge measured against the strip's as scrollLeft moves.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/swipe-deck.js'), 'utf8'))();
const sd = window.swipeDeck;
const doc = window.document;
const frame = () => new Promise((r) => window.requestAnimationFrame(() => setTimeout(r, 0)));

// jsdom has no ResizeObserver; this one is fired by hand.
const observers = [];
window.ResizeObserver = class { constructor(cb) { this.cb = cb; observers.push(this); } observe(el) { this.el = el; } disconnect() { this.el = null; } };

const W = 300, GAP = 12;
function laidOut(n, { smooth = false, width = W } = {}) {
  const s = doc.createElement('div');
  const tpl = doc.createElement('template');   // x-for's anchor, which is not a slide
  s.append(tpl);
  for (let i = 0; i < n; i++) { const k = doc.createElement('div'); k.dataset.slide = ''; s.append(k); }
  s.scrollLeft = 0;
  s.box = width;
  s.getBoundingClientRect = () => ({ left: 0, width: s.box });
  Object.defineProperty(s, 'clientWidth', { get: () => s.box });
  // Each card is the strip's width, so narrowing the strip moves every card.
  [...s.querySelectorAll('[data-slide]')].forEach((k, i) => {
    k.getBoundingClientRect = () => ({ left: i * ((s.box || W) + GAP) - s.scrollLeft, width: s.box || W });
  });
  s.calls = [];
  // A smooth scroll leaves the strip where it was until the test moves it.
  s.scrollTo = ({ left, behavior }) => { s.calls.push({ left, behavior }); if (!smooth || behavior === 'instant') s.scrollLeft = left; };
  doc.body.append(s);
  return s;
}

test('go() drives the strip to a card, counting the gap, and says it arrived', () => {
  const s = laidOut(5), arrived = [], slid = [];
  const d = sd.strip({ el: () => s, onSlide: (i) => slid.push(i), onArrive: (i) => arrived.push(i) });
  d.go(2);
  assert.equal(s.scrollLeft, 2 * (W + GAP));
  assert.equal(d.at, 2);
  assert.deepEqual(arrived, [2], 'a move that lands at once arrives at once');
  assert.deepEqual(slid, [], 'a drive is not a swipe');
  d.go(2);
  assert.equal(s.calls.length, 1, 'already there: no second scroll');
  d.go(1, true);
  assert.equal(s.calls.at(-1).behavior, 'instant');
});

test('the slide in view is the nearest, measured, not a division', () => {
  const s = laidOut(5), slid = [];
  const d = sd.strip({ el: () => s, onSlide: (i) => slid.push(i) });
  s.scrollLeft = W + GAP + 40; d.read();
  assert.equal(d.at, 1);
  s.scrollLeft = 2 * (W + GAP) + 140; d.read();
  assert.equal(d.at, 2, 'card 2 is 140px off and card 3 is 172px; scrollLeft / width would say 3');
  assert.deepEqual(slid, [1, 2]);
});

test('a go() in flight holds the readings until the strip lands', () => {
  const s = laidOut(5, { smooth: true }), slid = [], arrived = [];
  const d = sd.strip({ el: () => s, onSlide: (i) => slid.push(i), onArrive: (i) => arrived.push(i) });
  d.go(3);
  s.scrollLeft = W + GAP; d.read();
  s.scrollLeft = 2 * (W + GAP); d.read();
  assert.equal(d.at, 3, 'the cards passed do not walk the selection');
  assert.deepEqual(slid, []);
  s.scrollLeft = 3 * (W + GAP); d.read();
  assert.deepEqual(arrived, [3]);
  assert.deepEqual(slid, [], 'landing where it was sent is not a swipe');
  s.scrollLeft = 4 * (W + GAP); d.read();
  assert.deepEqual(slid, [4], 'once landed, a swipe reads again');
});

test('a hold that never lands lets go after 900ms', async () => {
  const s = laidOut(5, { smooth: true }), arrived = [];
  const d = sd.strip({ el: () => s, onArrive: (i) => arrived.push(i) });
  d.go(4);
  s.scrollLeft = W + GAP;   // interrupted: the reader's thumb caught it on card 1
  await new Promise((r) => setTimeout(r, 950));
  assert.equal(d.at, 1, 'the strip is where the reader left it');
  assert.equal(arrived.length, 1);
});

test('scrolled() reads once a frame, however many scroll events arrive', async () => {
  const s = laidOut(5), slid = [];
  const d = sd.strip({ el: () => s, onSlide: (i) => slid.push(i) });
  s.scrollLeft = W + GAP;
  d.scrolled(); d.scrolled(); d.scrolled();
  await frame();
  assert.deepEqual(slid, [1]);
});

test('a strip with no width reads nothing, and jump() waits for one', async () => {
  const s = laidOut(5, { width: 0 }), slid = [];
  const d = sd.strip({ el: () => s, onSlide: (i) => slid.push(i) });
  d.read();
  assert.deepEqual(slid, [], 'a hidden strip has every card at 0 and no card in view');
  d.jump(3);
  await frame();
  assert.equal(s.calls.length, 0, 'no width, no move');
  s.box = W;
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(s.scrollLeft, 3 * (W + GAP), 'the move lands once the strip has a width');
  assert.equal(s.calls.at(-1).behavior, 'instant');
});

test('a slide the strip has not drawn yet is remembered, not scrolled to', () => {
  const s = laidOut(2);
  const d = sd.strip({ el: () => s });
  assert.equal(d.go(4), false, 'so a caller waiting on arrival can stop waiting');
  assert.equal(d.at, 4);
  assert.equal(s.calls.length, 0);
  assert.equal(d.go(1), true);
});

test('a component that keeps its own index is read, not shadowed', () => {
  // branch-brief puts its index back to 0 on a new branch without telling the
  // strip; a driver keeping its own copy would still think it was on 3, and a
  // swipe back to card 3 would never be reported.
  const s = laidOut(5), c = { at: 0 }, slid = [];
  const d = sd.strip({ el: () => s, at: () => c.at, onSlide: (i) => { c.at = i; slid.push(i); } });
  s.scrollLeft = 3 * (W + GAP); d.read();
  assert.equal(c.at, 3);
  c.at = 0;
  s.scrollLeft = 0; d.read();
  assert.deepEqual(slid, [3], 'already on 0 by its own count');
  s.scrollLeft = 3 * (W + GAP); d.read();
  assert.deepEqual(slid, [3, 3]);
  assert.equal(d.at, 3);
});

test('a strip swiped by hand, never driven, is kept on its card when its width changes', async () => {
  const s = laidOut(5);
  const d = sd.strip({ el: () => s });
  s.scrollLeft = 2 * (W + GAP); d.read();
  const ro = observers.find((o) => o.el === s);
  assert.ok(ro, 'one reading is enough to watch the strip');
  s.box = 250; ro.cb();   // a phone turned: card 2 is now 2 × (250 + 12) in
  await frame();
  assert.equal(s.scrollLeft, 2 * (250 + GAP));
  assert.equal(s.calls.at(-1).behavior, 'instant');
});

test('destroy() stops every reading', async () => {
  const s = laidOut(5), slid = [];
  const d = sd.strip({ el: () => s, onSlide: (i) => slid.push(i) });
  d.destroy();
  s.scrollLeft = W + GAP; d.read(); d.scrolled();
  await frame();
  assert.deepEqual(slid, []);
});
