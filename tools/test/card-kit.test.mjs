// kits/card.js — the card of the house popup rule (daisy-alpine mechanics.md,
// "Notes and cards"), held at the edges that decide whether a reader can get
// out of one.
//
// What is checked here is the dismissal contract, which is the half that was
// written five times across the estate and written differently each time: the
// ✕ shows when the card is pinned AND on any screen with no hover, every way
// out reaches the same callback, and a press outside is not swallowed. Plus
// the check that catches a ✕ that is drawn and cannot be pressed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow({
  html: `<!doctype html><html><body>
    <button id="toggle">i</button>
    <div id="pop"><p>a card</p></div>
    <a id="under" href="#x">something under the page</a>
  </body></html>`,
});

// jsdom answers every media query false, so the fine-pointer path is the
// default here and the coarse path is driven by replacing matchMedia.
const setHover = (has) => {
  window.matchMedia = (q) => ({ matches: q.includes('hover: none') ? !has : has });
};
setHover(true);

new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/card.js'), 'utf8'))();
const Card = window.Card;
const $ = (sel) => window.document.querySelector(sel);
const press = (el) => {
  const ev = new window.Event('pointerdown', { bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  return ev;
};

test('the kit registers window.Card beside Note, the other half of one rule', () => {
  assert.equal(typeof Card, 'object');
  assert.equal(typeof Card.closeHTML, 'function');
  assert.equal(typeof Card.wire, 'function');
});

test('the ✕ shows when pinned, and on any screen with no hover', () => {
  // The second half is the one that keeps being missed: a touch synthesizes
  // the hover that opens a card and never sends the leave that would close it,
  // so a hover-opened card on a phone is pinned in all but name.
  setHover(true);
  assert.equal(Card.closeHTML(false), '', 'unpinned, hover available: the card closes on leaving');
  assert.match(Card.closeHTML(true), /wt-card-close/, 'pinned: nothing else closes it');
  setHover(false);
  assert.match(Card.closeHTML(false), /wt-card-close/, 'no hover: there is no leave to wait for');
  assert.match(Card.closeHTML(true), /wt-card-close/);
  setHover(true);
});

test('the ✕ is a ghost: no border, no fill', () => {
  // A bordered button reads as an action the card offers. This is the rule the
  // first draft got wrong, so it is held rather than left to taste.
  assert.match(Card.CSS, /\.wt-card-close\{[^}]*border:0/s);
  assert.match(Card.CSS, /\.wt-card-close\{[^}]*background:none/s);
  assert.doesNotMatch(Card.CSS, /\.wt-card-close\{[^}]*border:1px/s);
});

test('every way out reaches the same callback: the ✕, Escape, and a press outside', () => {
  const pop = $('#pop');
  let closed = 0;
  const w = Card.wire(pop, { onClose: () => { closed += 1; } });

  pop.innerHTML = Card.closeHTML(true) + '<p>a card</p>';
  pop.querySelector('[data-wt-card-close]').dispatchEvent(
    new window.Event('click', { bubbles: true }));
  assert.equal(closed, 1, 'the ✕');

  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(closed, 2, 'Escape');

  press($('#under'));
  assert.equal(closed, 3, 'a press outside');

  press(pop.querySelector('p'));
  assert.equal(closed, 3, 'a press inside the card is not a dismissal');

  w.detach();
  press($('#under'));
  assert.equal(closed, 3, 'detach removes the document listeners');
});

test('a press outside is not swallowed, which is why it cannot be the only way out', () => {
  // What was pressed still acts. That is correct, and it is exactly why a
  // dense page needs the ✕: every point outside the card is a control.
  const pop = $('#pop');
  const w = Card.wire(pop, { onClose: () => {} });
  const ev = press($('#under'));
  assert.equal(ev.defaultPrevented, false);
  w.detach();
});

test('the control that toggles a card is not "outside" it', () => {
  // Without this the press closes the card and the toggle immediately reopens
  // it, or the reverse, and which one you get depends on listener order.
  const pop = $('#pop');
  let closed = 0;
  const w = Card.wire(pop, { onClose: () => { closed += 1; }, except: ['#toggle'] });
  press($('#toggle'));
  assert.equal(closed, 0);
  press($('#under'));
  assert.equal(closed, 1);
  w.detach();
});

test('a ✕ that cannot be pressed is reported, since nothing else would notice', () => {
  // A shell that is pointer-events:none unless pinned draws a ✕ and lets the
  // tap through it. It looks right in a screenshot and fails only under a
  // finger.
  setHover(false);
  const pop = $('#pop');
  pop.style.pointerEvents = 'none';
  const warnings = [];
  const real = window.console.warn;
  window.console.warn = (...a) => warnings.push(a[0]);
  try {
    Card.wire(pop, { onClose: () => {} }).detach();
  } finally {
    window.console.warn = real;
    pop.style.pointerEvents = '';
    setHover(true);
  }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /cannot be pressed/);
});

// ── The staleness guards ───────────────────────────────────────────────────
//
// The half a leave event cannot promise. Each of these is a way the pointer
// stops being over the trigger, or the placement stops meaning anything, with
// no leave ever firing; before the guards, each left a card on screen anchored
// to content that had moved out from under it.

const over = (el) => el.dispatchEvent(
  new window.Event('pointerover', { bubbles: true }));
const scrollOn = (el) => el.dispatchEvent(
  new window.Event('scroll', { bubbles: false }));
const settle = (ms = 320) => new Promise((r) => setTimeout(r, ms));

test('a pointer demonstrably elsewhere closes the card, with no leave fired', async () => {
  let closed = 0;
  const w = Card.wire($('#pop'), { onClose: () => { closed += 1; }, except: ['#toggle'] });
  over($('#under'));
  await settle();
  assert.equal(closed, 1, 'the pointer being over something else is the close');
  w.detach();
});

test('the card and its trigger are not elsewhere, and cancel a pending close', async () => {
  let closed = 0;
  const w = Card.wire($('#pop'), { onClose: () => { closed += 1; }, except: ['#toggle'] });
  over($('#under'));      // start the grace
  over($('#pop'));        // the reader crossed the gap into the card
  await settle();
  assert.equal(closed, 0, 'arriving on the card cancels the fade');
  over($('#under'));
  over($('#toggle'));     // and the trigger counts the same way
  await settle();
  assert.equal(closed, 0, 'a pointer on the trigger has not left');
  w.detach();
});

test('a page scroll closes it, and a scroll inside it does not', async () => {
  let closed = 0;
  const w = Card.wire($('#pop'), { onClose: () => { closed += 1; } });
  scrollOn($('#pop'));
  assert.equal(closed, 0, 'a reader reaching the rest of a long card is not a departure');
  scrollOn(window.document);
  assert.equal(closed, 1, 'the content moved and the card did not');
  w.detach();
});

test('resize and window blur close it, since the placement stops meaning anything', () => {
  let closed = 0;
  const w = Card.wire($('#pop'), { onClose: () => { closed += 1; } });
  window.dispatchEvent(new window.Event('resize'));
  assert.equal(closed, 1);
  window.dispatchEvent(new window.Event('blur'));
  assert.equal(closed, 2);
  w.detach();
});

test('a hidden card is not closed again by any of them', async () => {
  let closed = 0;
  const pop = $('#pop');
  const w = Card.wire(pop, { onClose: () => { closed += 1; } });
  for (const hide of [
    () => { pop.classList.add('hidden'); },
    () => { pop.classList.remove('hidden'); pop.style.display = 'none'; },
    () => { pop.style.display = ''; pop.hidden = true; },
  ]) {
    hide();
    over($('#under'));
    scrollOn(window.document);
    window.dispatchEvent(new window.Event('resize'));
    await settle();
    assert.equal(closed, 0, 'the guards read actual visibility, all three ways');
  }
  pop.hidden = false;
  w.detach();
});

test('stale:false leaves a card that must survive a scroll alone', async () => {
  let closed = 0;
  const w = Card.wire($('#pop'), { onClose: () => { closed += 1; }, stale: false });
  scrollOn(window.document);
  over($('#under'));
  await settle();
  assert.equal(closed, 0, 'the opt-out is the whole opt-out');
  w.detach();
});

test('detach releases the guards, so a rebuilt card does not close twice', async () => {
  let closed = 0;
  Card.wire($('#pop'), { onClose: () => { closed += 1; } }).detach();
  scrollOn(window.document);
  over($('#under'));
  await settle();
  assert.equal(closed, 0);
});

// ── stale:'geometry', the mode a NOTE takes ───────────────────────────────
//
// A panel that is `pointer-events: none` is never the pointer's target, so
// `el.contains(target)` is false for every point on the panel itself and the
// pointer guard would arm the moment the panel opened. These three say the
// geometry guards still fire and that one does not, which is the whole
// difference between the two modes and the reason the mode exists.
test("stale:'geometry' still closes on a scroll, a resize and a blur", async () => {
  for (const fire of [
    () => scrollOn(window.document),
    () => window.dispatchEvent(new window.Event('resize')),
    () => window.dispatchEvent(new window.Event('blur')),
  ]) {
    let closed = 0;
    const w = Card.wire($('#pop'), { onClose: () => { closed += 1; }, stale: 'geometry' });
    fire();
    await settle();
    assert.equal(closed, 1, 'the geometry half is on');
    w.detach();
  }
});

test("stale:'geometry' ignores a pointer elsewhere, which is the point of it", async () => {
  let closed = 0;
  const w = Card.wire($('#pop'), { onClose: () => { closed += 1; }, stale: 'geometry' });
  over($('#under'));
  await settle();
  assert.equal(closed, 0,
    'a note is left to its trigger own leave; the pointer guard would close it on open');
  w.detach();
});

test("stale:'geometry' keeps Escape and the press outside", async () => {
  let closed = 0;
  const w = Card.wire($('#pop'), { onClose: () => { closed += 1; }, stale: 'geometry' });
  window.document.dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(closed, 1, 'Escape is not a staleness guard and is never gated');
  press($('#under'));
  assert.equal(closed, 2, 'nor is the press outside');
  w.detach();
});
