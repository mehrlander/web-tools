// kits/linked-swiper.js — a list over a strip of cards, moving together.
//
// The kit holds the pick that every list-detail view used to copy: a row tap,
// a key on a row, a step of the pager and a swipe all land on one selection,
// and the host hears each through onPick. jsdom has no layout, so the strip's
// geometry is stubbed the way the swipe-deck tests stub it, and the layout
// thresholds are read through the width option.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const kit = name => readFileSync(path.join(repoRoot, 'lib', name), 'utf8');
const tick = (n = 1) => new Promise(r => setTimeout(r, n * 20));

function page({ swipe = true } = {}) {
  const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
  new window.Function(kit('vanilla-bundle.js'))();
  if (swipe) new window.Function(kit('kits/swipe-deck.js'))();
  new window.Function(kit('kits/linked-swiper.js'))();
  Object.defineProperty(window.Element.prototype, 'clientWidth', { value: 400, configurable: true });
  window.Element.prototype.scrollTo = function ({ left }) {
    Object.defineProperty(this, 'scrollLeft', { value: left, configurable: true, writable: true });
    this.dispatchEvent(new window.Event('scroll'));
  };
  window.Element.prototype.getBoundingClientRect = function () {
    return { left: 0, right: 400, top: 0, bottom: 300, width: 400, height: 300 };
  };
  return window;
}

function mountList(window, ids, o = {}) {
  const doc = window.document;
  const root = doc.createElement('div');
  // Data attributes, not ids: a page here mounts several, and jsdom's `#id`
  // lookup finds only the document's first element with a given id.
  root.innerHTML = '<div data-t="list"></div><div data-t="card"></div>';
  doc.body.append(root);
  const list = root.querySelector('[data-t="list"]');
  list.innerHTML = ids.map(id => `<div role="option" tabindex="0" data-row="${id}" aria-selected="false">${id}</div>`).join('');
  const picks = [];
  let sel = o.sel ?? ids[0];
  const handle = window.linkedSwiper.attach({
    root, list, card: root.querySelector('[data-t="card"]'), key: 'row', noun: 'row',
    ids: () => ids, sel: () => sel,
    name: id => ({ title: 'Row ' + id }),
    body: id => `<p>body ${id}</p>`,
    onPick: (id, via) => { sel = id; picks.push([id, via]); },
    width: () => o.width ?? 1200,
    ...o.extra,
  });
  return { root, list, card: root.querySelector('[data-t="card"]'), handle, picks, sel: () => sel };
}

const selected = list => [...list.querySelectorAll('[aria-selected="true"]')].map(r => r.dataset.row);
const headText = card => card.querySelector('[data-ls="head"]').textContent.replace(/\s+/g, ' ').trim();

test('attach draws a head row over a body and marks the selected row', async () => {
  const w = page();
  const s = mountList(w, ['a', 'b', 'c'], { sel: 'b' });
  await tick();
  assert.equal(headText(s.card), 'Row b2/3');
  assert.deepEqual(selected(s.list), ['b']);
  assert.ok(s.card.querySelector('[data-ls="body"] .sd-track'), 'the body holds the strip');
});

test('a row tap picks it: the host hears it, the mark and the head move', async () => {
  const w = page();
  const s = mountList(w, ['a', 'b', 'c']);
  s.list.querySelector('[data-row="c"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await tick();
  assert.deepEqual(s.picks, [['c', 'list']]);
  assert.deepEqual(selected(s.list), ['c']);
  assert.equal(headText(s.card), 'Row c3/3');
});

test('Enter or Space on a focused row picks it', async () => {
  const w = page();
  const s = mountList(w, ['a', 'b', 'c']);
  const row = s.list.querySelector('[data-row="b"]');
  row.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  row.dispatchEvent(new w.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  assert.deepEqual(s.picks, [['b', 'list'], ['b', 'list']]);
});

test('a swipe moves the selection and reports itself as a swipe', async () => {
  const w = page();
  const s = mountList(w, ['a', 'b', 'c']);
  await tick();
  const track = s.card.querySelector('.sd-track');
  track.scrollTo({ left: 800 });
  await tick(3);
  assert.deepEqual(s.picks.at(-1), ['c', 'swipe']);
  assert.deepEqual(selected(s.list), ['c']);
});

test('the pager steps the strip, and the arrows are disabled at the ends', async () => {
  const w = page();
  const s = mountList(w, ['a', 'b', 'c']);
  await tick();
  const prev = s.card.querySelector('[data-swipe-step="-1"]');
  assert.ok(prev.disabled, 'no previous row from the first');
  s.card.querySelector('[data-swipe-step="1"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await tick(3);
  assert.deepEqual(s.picks.at(-1), ['b', 'swipe']);
});

test('without swipe-deck the card is drawn once and a step redraws it', async () => {
  const w = page({ swipe: false });
  const s = mountList(w, ['a', 'b']);
  const body = s.card.querySelector('[data-ls="body"]');
  assert.equal(body.textContent, 'body a');
  s.card.querySelector('[data-swipe-step="1"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(s.picks, [['b', 'step']]);
  assert.equal(body.textContent, 'body b');
});

test('ids are matched as strings, and the host gets its own value back', async () => {
  const w = page({ swipe: false });
  const s = mountList(w, [1, 2, 3], { sel: 2 });
  assert.deepEqual(selected(s.list), ['2']);
  s.list.querySelector('[data-row="3"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(s.picks, [[3, 'list']]);
  assert.strictEqual(s.sel(), 3);
});

test('pick() from the host goes to a row, and ignores an id the list does not have', async () => {
  const w = page({ swipe: false });
  const s = mountList(w, ['a', 'b']);
  s.handle.pick('b');
  s.handle.pick('zz');
  assert.deepEqual(s.picks, [['b', 'api']]);
  assert.deepEqual(selected(s.list), ['b']);
});

test('the door is offered only with a deck to open, and opens it', async () => {
  const w = page();
  let opened = 0;
  const plain = mountList(w, ['a', 'b']);
  assert.equal(plain.card.querySelector('[data-swipe-cards]'), null);
  const decked = mountList(w, ['a', 'b'], { extra: { deck: () => { opened++; } } });
  decked.card.querySelector('[data-swipe-cards]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.equal(opened, 1);
});

test('below stackBelow the list stacks over the card; below tightBelow the arrows go', async () => {
  const w = page();
  const wide = mountList(w, ['a', 'b'], { width: 1200 });
  assert.equal(wide.root.hasAttribute('data-ls-stacked'), false);
  assert.ok(!wide.card.querySelector('[data-swipe-step="1"]').classList.contains('hidden'));
  const mid = mountList(w, ['a', 'b'], { width: 800 });
  assert.equal(mid.root.hasAttribute('data-ls-stacked'), true);
  assert.ok(mid.list.classList.contains('max-h-[38vh]'));
  const narrow = mountList(w, ['a', 'b'], { width: 390 });
  assert.ok(narrow.card.querySelector('[data-swipe-step="1"]').classList.contains('hidden'));
});

test('an empty list shows the host\'s empty card and no pager', async () => {
  const w = page();
  const s = mountList(w, [], { extra: { empty: '<p>nothing</p>' } });
  assert.equal(s.card.querySelector('[data-ls="body"]').textContent, 'nothing');
  assert.equal(s.card.querySelector('[data-swipe-step]'), null);
});

test('destroy stops the kit answering the list', async () => {
  const w = page({ swipe: false });
  const s = mountList(w, ['a', 'b']);
  s.handle.destroy();
  s.list.querySelector('[data-row="b"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.deepEqual(s.picks, []);
});

test('show() moves to a row and marks it without telling the host', async () => {
  const w = page({ swipe: false });
  const s = mountList(w, ['a', 'b', 'c']);
  s.handle.show('c');
  assert.deepEqual(s.picks, []);
  assert.deepEqual(selected(s.list), ['c']);
  assert.equal(s.card.querySelector('[data-ls="body"]').textContent, 'body c');
});

test('a click the host claimed first, with preventDefault, does not pick the row', async () => {
  const w = page({ swipe: false });
  const s = mountList(w, ['a', 'b']);
  s.list.addEventListener('click', e => e.preventDefault(), true);
  s.list.querySelector('[data-row="b"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.deepEqual(s.picks, []);
});

test('a host\'s own columns replace the default when there is no seam', async () => {
  const w = page({ swipe: false });
  const s = mountList(w, ['a'], { extra: { wide: 'grid-cols-[minmax(0,290px)_minmax(0,1fr)]' } });
  assert.ok(s.root.classList.contains('grid-cols-[minmax(0,290px)_minmax(0,1fr)]'));
  assert.ok(!s.root.classList.contains('grid-cols-[minmax(0,340px)_minmax(0,1fr)]'));
});
