// lib/kits/deck-host.js: the host half of swipe-deck's placement contract,
// for a page with no host of its own.
//
// What is asserted here is the decision logic: which hooks get installed, when
// their claims hold, and how the width clamps. jsdom has no layout, so the
// geometry itself (the deck docked on the right, the content's margin) is
// checked in a real browser, as the swipe-deck dock was
// (node/test/deck-dock-reflow.mjs).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { repoRoot } from './bootstrap.mjs';

const host = readFileSync(path.join(repoRoot, 'lib/kits/deck-host.js'), 'utf8');
const deck = readFileSync(path.join(repoRoot, 'lib/kits/swipe-deck.js'), 'utf8');

// jsdom's matchMedia is absent; the stub answers what the test says the width
// is, and `wide` can be flipped to stand for a resize across the breakpoint.
function mount({ wide = true, width = 1600, before, html = '<main></main>' } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    pretendToBeVisual: true, runScripts: 'outside-only', url: 'https://example.com/',
  });
  const w = dom.window;
  const state = { wide };
  w.matchMedia = (q) => ({ media: q, get matches() { return state.wide; }, addEventListener() {}, removeEventListener() {} });
  Object.defineProperty(w, 'innerWidth', { configurable: true, get: () => width });
  if (before) before(w);
  w.eval(host);
  return { window: w, state, root: w.document.documentElement };
}

test('loading the kit installs both hooks, qualified, with a stylesheet', () => {
  const { window: w, root } = mount();
  assert.equal(typeof w.__deckPane, 'function', 'the claim that this page can dock');
  assert.equal(typeof w.__deckPane.when, 'function');
  assert.equal(typeof w.__deckWidth, 'function', 'the claim that it can be told how wide');
  assert.equal(typeof w.__deckWidth.when, 'function');
  assert.equal(typeof w.__deckWidth.min, 'function');
  assert.equal(typeof w.__deckWidth.max, 'function');
  assert.equal(w.deckHost.active, true);
  assert.equal(root.dataset.deckPane, 'dock', 'a deck opens docked from the breakpoint up');
  assert.ok(w.document.querySelector('main').hasAttribute('data-deck-host-content'), 'main gives the deck its width');
  const css = w.document.querySelector('style[data-deck-host]').textContent;
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /\[data-deck-open\]:not\(\[style\*="--deck-left"\]\) \[data-deck-host-content\]/,
    'the reflow keys on an open deck, not on the standing preference');
  assert.match(root.style.getPropertyValue('--deck-host-left'), /calc\(100vw - 55vw\)/, 'the default share');
});

test('a host that already installed __deckPane is left alone', () => {
  const theirs = () => {};
  const { window: w, root } = mount({ before: (w) => { w.__deckPane = theirs; } });
  assert.equal(w.__deckPane, theirs, 'the app keeps its own hook');
  assert.equal(w.__deckWidth, undefined, 'and the kit adds no width claim of its own beside it');
  assert.equal(w.deckHost.active, false);
  assert.equal(w.deckHost.install({ share: 40 }), false, 'a later install is refused too');
  assert.equal(w.document.querySelector('style[data-deck-host]'), null, 'no stylesheet');
  assert.equal(root.dataset.deckPane, undefined, 'and no pane attribute');
});

test('a host that installs after the kit takes over, and the kit withdraws', () => {
  const { window: w } = mount();
  const theirs = () => {};
  w.__deckPane = theirs;
  w.dispatchEvent(new w.Event('resize'));
  assert.equal(w.deckHost.active, false);
  assert.equal(w.__deckPane, theirs);
  assert.equal(w.__deckWidth, undefined, 'the width hook the kit installed goes with it');
});

test('below the breakpoint the claims do not hold and the pane is the full takeover', () => {
  const { window: w, root } = mount({ wide: false });
  assert.equal(w.__deckPane.when(), false, 'no toggle on a phone');
  assert.equal(w.__deckWidth.when(), false, 'no seam either');
  assert.equal(root.dataset.deckPane, undefined, 'the deck takes the window');
});

test('crossing the breakpoint re-derives the pane, and the reader\'s choice holds', () => {
  const { window: w, state, root } = mount();
  assert.equal(w.__deckPane.when(), true);
  w.__deckPane('pane');
  assert.equal(root.dataset.deckPane, 'inset', 'the toggle widens the deck to the window');
  state.wide = false;
  w.dispatchEvent(new w.Event('resize'));
  assert.equal(root.dataset.deckPane, undefined);
  state.wide = true;
  w.dispatchEvent(new w.Event('resize'));
  assert.equal(root.dataset.deckPane, 'inset', 'the next deck opens the way the reader left it');
  w.__deckPane('dock');
  assert.equal(root.dataset.deckPane, 'dock');
});

test('an opener that frames its own deck withdraws both claims', () => {
  const { window: w, root } = mount();
  root.style.setProperty('--deck-left', '30rem');
  assert.equal(w.__deckPane.when(), false, 'no toggle that would not move the deck');
  assert.equal(w.__deckWidth.when(), false, 'no seam over the opener\'s own divider');
});

test('__deckWidth clamps to min and max', () => {
  // 1600px wide: a 400px floor is 25%, and an 800px ceiling is 50%.
  const { window: w, root } = mount();
  w.deckHost.install({ min: 400, max: '800px' });
  assert.equal(w.__deckWidth.min(), 25);
  assert.equal(w.__deckWidth.max(), 50);
  assert.equal(w.__deckWidth(10), 25, 'a drag past the floor stops at it');
  assert.match(root.style.getPropertyValue('--deck-host-left'), /calc\(100vw - 25vw\)/);
  assert.equal(w.__deckWidth(), 25, 'read with no argument');
  assert.equal(w.__deckWidth(90, true), 50, 'and past the ceiling at that');
  assert.equal(w.__deckWidth(40), 40, 'a width inside the stops is taken as given');
});

test('the default stops are 24rem for the deck and 20rem for the content', () => {
  const { window: w } = mount();
  assert.equal(w.__deckWidth.min(), 24 * 16 / 1600 * 100);
  assert.equal(w.__deckWidth.max(), (1600 - 20 * 16) / 1600 * 100);
});

test('the share is clamped as well, so a narrow window cannot hand the deck the content\'s floor', () => {
  // 1100px with a 900px share: the ceiling is 1100 - 320 = 780px.
  const { window: w } = mount({ width: 1100 });
  w.deckHost.install({ share: 900 / 11 });
  assert.equal(w.__deckWidth(), Math.round(780 / 1100 * 1000) / 10);
});

test('options reach the stylesheet: breakpoint, top and content', () => {
  const { window: w, root } = mount({ html: '<header id="chrome"></header><div id="app"></div>' });
  w.deckHost.install({ breakpoint: '(min-width: 900px)', top: '3rem', content: '#app' });
  const css = w.document.querySelector('style[data-deck-host]').textContent;
  assert.match(css, /@media \(min-width: 900px\)/);
  assert.match(css, /--deck-top: var\(--deck-host-top, 0px\)/);
  assert.equal(root.style.getPropertyValue('--deck-host-top'), '3rem');
  assert.ok(w.document.getElementById('app').hasAttribute('data-deck-host-content'));
  assert.equal(w.document.querySelectorAll('style[data-deck-host]').length, 1, 'a reinstall replaces, not adds');
});

test('without a main, the body gives the width; without a top, the page keeps its own', () => {
  const { window: w } = mount({ html: '<div></div>' });
  assert.ok(w.document.body.hasAttribute('data-deck-host-content'));
  assert.doesNotMatch(w.document.querySelector('style[data-deck-host]').textContent, /--deck-top:/);
});

test('uninstall puts back what install changed', () => {
  const { window: w, root } = mount();
  w.deckHost.uninstall();
  assert.equal(w.__deckPane, undefined);
  assert.equal(w.__deckWidth, undefined);
  assert.equal(root.dataset.deckPane, undefined);
  assert.equal(root.style.getPropertyValue('--deck-host-left'), '');
  assert.equal(w.document.querySelector('[data-deck-host-content]'), null);
  assert.equal(w.document.querySelector('style[data-deck-host]'), null);
});

test('swipe-deck, opened on the page, offers the toggle and leaves page scroll unlocked', () => {
  const { window: w, root } = mount();
  w.eval(deck);
  const handle = w.swipeDeck.open({ count: 2, render: () => {} });
  const toggle = [...handle.el.querySelectorAll('button')]
    .find(b => /Dock beside|Fill the pane/.test(b.getAttribute('data-title-tip') || ''));
  assert.ok(toggle, 'the pane toggle renders on the claim');
  assert.notEqual(toggle.style.display, 'none');
  assert.equal(root.style.overflow, '', 'a docked deck must not lock the content beside it');
  assert.ok('deckOpen' in root.dataset, 'the kit\'s fact the reflow keys on');
  toggle.click();
  assert.equal(root.dataset.deckPane, 'inset');
  assert.equal(root.style.overflow, 'hidden', 'filling the window locks it, as a takeover does');
  handle.close();
});
