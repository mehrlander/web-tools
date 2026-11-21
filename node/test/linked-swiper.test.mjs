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
  list.innerHTML = ids.map(id => `<div role="option"${o.focus === false ? '' : ' tabindex="0"'} data-row="${id}" aria-selected="false">${id}</div>`).join('');
  const picks = [];
  let sel = o.sel ?? ids[0];
  const handle = window.linkedSwiper.attach({
    root, list, card: root.querySelector('[data-t="card"]'), key: 'row', noun: 'row',
    ids: () => ids, sel: () => sel,
    name: id => ({ title: 'Row ' + id }),
    body: id => `<p>body ${id}</p>`,
    onPick: (id, via, sub) => { sel = id; picks.push(sub === undefined ? [id, via] : [id, via, sub]); },
    width: () => o.width ?? 1200,
    ...o.extra,
  });
  return { root, list, card: root.querySelector('[data-t="card"]'), handle, picks, sel: () => sel };
}

const selected = list => [...list.querySelectorAll('[data-row][aria-selected="true"]')].map(r => r.dataset.row);
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

// Up and Down in the list do what a swipe does on the card, in every view
// built on the kit (owner, 2026-10-22: "up and down does the same thing as
// swiping"), and focus walks with the selection.
// Without swipe-deck the card redraws on each pick, which jsdom can follow;
// with it, the stubbed geometry snaps every strip back to its first slide.
test('Up and Down in the list step the selection, the card following and focus moving with it', async () => {
  const w = page({ swipe: false });
  const s = mountList(w, ['a', 'b', 'c']);
  const row = id => s.list.querySelector(`[data-row="${id}"]`);
  const press = (el, key) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  await tick();
  row('a').focus();
  press(row('a'), 'ArrowDown');
  await tick();
  assert.deepEqual(s.picks.at(-1), ['b', 'list']);
  assert.deepEqual(selected(s.list), ['b']);
  assert.equal(headText(s.card), 'Row b2/3');
  assert.match(s.card.textContent, /body b/, 'the card follows');
  assert.equal(w.document.activeElement, row('b'), 'focus follows the row');
  assert.deepEqual(Array.from(s.list.querySelectorAll('[data-row]'), r => r.tabIndex), [-1, 0, -1], 'one tab stop, on the selected row');
  press(row('b'), 'ArrowUp');
  await tick();
  assert.deepEqual(selected(s.list), ['a']);
  press(row('a'), 'ArrowUp');
  assert.equal(s.picks.length, 2, 'the first row stays put at the top');
});

test('where no row takes focus the list does, so the arrows still reach it', async () => {
  const w = page({ swipe: false });
  const s = mountList(w, ['a', 'b', 'c'], { focus: false });
  await tick();
  assert.equal(s.list.tabIndex, 0);
  s.list.querySelector('[data-row="b"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  assert.equal(w.document.activeElement, s.list, 'a tap leaves focus where the arrows are heard');
  s.list.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await tick();
  assert.deepEqual(selected(s.list), ['c']);
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

test('the Next arrow is disabled on the last row and enabled on the first, with and without swipe-deck', async () => {
  for (const swipe of [true, false]) {
    const w = page({ swipe });
    const last = mountList(w, ['a', 'b', 'c'], { sel: 'c' });
    await tick();
    assert.equal(last.card.querySelector('[data-swipe-step="1"]').disabled, true, `no next row from the last (swipe ${swipe})`);
    const first = mountList(w, ['a', 'b', 'c']);
    await tick();
    assert.equal(first.card.querySelector('[data-swipe-step="1"]').disabled, false, `next is open on the first (swipe ${swipe})`);
  }
});

test('Ctrl, Meta or Alt with an arrow on a row is left to the browser', async () => {
  const w = page({ swipe: false });
  const s = mountList(w, ['a', 'b', 'c']);
  await tick();
  const row = s.list.querySelector('[data-row="a"]');
  row.focus();
  for (const mod of ['ctrlKey', 'metaKey', 'altKey']) {
    const ev = new w.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true, [mod]: true });
    row.dispatchEvent(ev);
    assert.equal(ev.defaultPrevented, false, mod);
  }
  assert.deepEqual(s.picks, []);
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
  // The host's own word for the move reaches onPick, so a host can add a
  // history entry for a link followed and replace it for a browse.
  s.handle.pick('a', 'follow');
  assert.deepEqual(s.picks, [['b', 'api'], ['a', 'follow']]);
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

test('a head name with a pill draws it straight after the title, and one without draws none', () => {
  const { window } = page();
  const plain = window.linkedSwiper.head({ title: 'A session' }, 0, 3, 'summary');
  assert.doesNotMatch(plain, /data-ls-pill/);
  assert.match(plain, /<h2 class="[^"]*\btruncate\b[^"]*"[^>]*>A session<\/h2>/, 'without one the heading is as it was');
  const marked = window.linkedSwiper.head({ title: 'A session', pill: 2 }, 0, 3, 'summary');
  assert.match(marked, /<h2[^>]*><span class="min-w-0 truncate">A session<\/span><span data-ls-pill class="[^"]*\bflex-none\b[^"]*">2<\/span><\/h2>/,
    'the title gives way and the pill, after it, stays whole');
  assert.match(marked, /data-title-tip="A session 2"/, 'the tip reads the title, then the pill');
});

// Sub-items: a card per sub-item, item by item, the row's tabs naming them.
// Generalized from the Compactions view, whose rows are sessions and whose
// cards are their compactions.
function mountSubs(window, o = {}) {
  const subs = { a: ['x', 'y', 'z'], b: [], c: ['p'] };
  return mountList(window, ['a', 'b', 'c'], {
    ...o,
    extra: {
      subs: id => subs[id], subNoun: 'flag',
      selSub: () => o.selSub,
      body: (id, el, sub) => `<p>body ${id}${sub ? '.' + sub : ''}</p>`,
      ...o.extra,
    },
  });
}
const picked = s => s.picks.map(([id, via, sub]) => [id, via, sub ?? null]);
const tabsOf = (list, id) => [...list.querySelectorAll(`[data-row="${id}"] [data-ls-sub]`)];

test('with sub-items there is a card per sub-item, item by item, and one for an item with none', async () => {
  const w = page({ swipe: false });
  const s = mountSubs(w);
  assert.deepEqual(s.handle.slides().map(c => [c.id, c.sub ?? null, c.j, c.n]),
    [['a', 'x', 0, 3], ['a', 'y', 1, 3], ['a', 'z', 2, 3], ['b', null, 0, 0], ['c', 'p', 0, 1]]);
  assert.equal(headText(s.card), 'Row a11/5', 'the counter counts cards, and the head carries the open tab\'s label');
  assert.equal(s.card.querySelector('[data-ls="body"]').textContent, 'body a.x');
});

test('a row with more than one sub-item gets numbered tabs at its end; the others keep a hidden strip', async () => {
  const w = page({ swipe: false });
  const s = mountSubs(w, { extra: { tab: (id, sub, j, n) => ({ cls: sub === 'y' ? 'bg-success/30' : '' }) } });
  const strip = s.list.querySelector('[data-row="a"]').lastElementChild;
  assert.equal(strip.getAttribute('role'), 'tablist');
  assert.equal(strip.getAttribute('aria-label'), 'Flags');
  assert.deepEqual(tabsOf(s.list, 'a').map(t => [t.textContent, t.getAttribute('aria-label'), t.getAttribute('aria-selected')]),
    [['1', 'Flag 1 of 3', 'true'], ['2', 'Flag 2 of 3', 'false'], ['3', 'Flag 3 of 3', 'false']]);
  assert.ok(tabsOf(s.list, 'a')[1].classList.contains('bg-success/30'), "the host's class marks a sub-item's state");
  for (const id of ['b', 'c']) {
    assert.equal(tabsOf(s.list, id).length, 0);
    assert.equal(s.list.querySelector(`[data-row="${id}"] [data-ls-tabs]`).hidden, true);
  }
});

test('a tap on a tab opens that sub-item, and a tap elsewhere on the row its item\'s first', async () => {
  const w = page({ swipe: false });
  const s = mountSubs(w);
  const tap = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  tap(tabsOf(s.list, 'a')[2]);
  assert.deepEqual(picked(s).at(-1), ['a', 'list', 'z']);
  assert.deepEqual(tabsOf(s.list, 'a').map(t => t.getAttribute('aria-selected')), ['false', 'false', 'true']);
  assert.deepEqual(selected(s.list), ['a'], 'the row stays the selection');
  assert.equal(headText(s.card), 'Row a33/5');
  tap(s.list.querySelector('[data-row="a"]'));
  assert.deepEqual(picked(s).at(-1), ['a', 'list', 'x']);
  tap(s.list.querySelector('[data-row="b"]'));
  assert.deepEqual(picked(s).at(-1), ['b', 'list', null]);
  assert.equal(headText(s.card), 'Row b4/5', 'no pill for an item with no sub-items');
});

test('a step and Up and Down move card by card, crossing into the next item, focus on the open tab', async () => {
  const w = page({ swipe: false });
  const s = mountSubs(w, { selSub: 'y' });
  await tick();
  assert.equal(headText(s.card), 'Row a22/5', 'selSub() names the open sub-item');
  s.handle.step(1);
  assert.deepEqual(picked(s).at(-1), ['a', 'step', 'z']);
  s.handle.step(1);
  assert.deepEqual(picked(s).at(-1), ['b', 'step', null]);
  const press = (el, key) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  press(s.list.querySelector('[data-row="b"]'), 'ArrowUp');
  assert.deepEqual(picked(s).at(-1), ['a', 'list', 'z']);
  assert.equal(w.document.activeElement, tabsOf(s.list, 'a')[2], 'focus is on the open tab');
  assert.deepEqual(tabsOf(s.list, 'a').map(t => t.tabIndex), [-1, -1, 0], 'which holds the list\'s one tab stop');
  assert.equal(s.list.querySelector('[data-row="a"]').tabIndex, -1);
  press(w.document.activeElement, 'Enter');
  assert.deepEqual(picked(s).at(-1), ['a', 'list', 'z'], 'Enter on a tab opens its sub-item');
});

test('pick and show take a sub-item, and tabs() draws a changed state', async () => {
  const w = page({ swipe: false });
  let judged = new Set();
  const s = mountSubs(w, { extra: { tab: (id, sub) => ({ cls: judged.has(sub) ? 'bg-success/30' : '' }) } });
  s.handle.pick('a', 'follow', 'y');
  assert.deepEqual(picked(s).at(-1), ['a', 'follow', 'y'], 'the host\'s via, then the sub-item, as onPick hears them');
  s.handle.pick('c');
  assert.deepEqual(picked(s).at(-1), ['c', 'api', 'p'], 'without one, the item\'s first');
  s.handle.show('a', 'z');
  assert.equal(s.picks.length, 2);
  assert.equal(s.card.querySelector('[data-ls="body"]').textContent, 'body a.z');
  judged.add('x');
  s.handle.tabs('a');
  assert.ok(tabsOf(s.list, 'a')[0].classList.contains('bg-success/30'));
  assert.equal(tabsOf(s.list, 'a')[2].getAttribute('aria-selected'), 'true', 'the redrawn strip keeps the open tab');
});

test('a row may say where its tabs go', async () => {
  const w = page({ swipe: false });
  const doc = w.document;
  const root = doc.createElement('div');
  root.innerHTML = '<div data-t="list"><div data-row="a" tabindex="0"><span data-ls-tabs></span><span>tail</span></div></div><div data-t="card"></div>';
  doc.body.append(root);
  w.linkedSwiper.attach({
    root, list: root.querySelector('[data-t="list"]'), card: root.querySelector('[data-t="card"]'), key: 'row',
    ids: () => ['a'], sel: () => 'a', subs: () => [1, 2], body: () => '', width: () => 1200,
  });
  const row = root.querySelector('[data-row="a"]');
  assert.equal(row.firstElementChild.getAttribute('role'), 'tablist');
  assert.equal(row.lastElementChild.textContent, 'tail');
});

// Places: with `places`, a sub-item is a place in its item's card. The
// inspection form's outputs are places in their run's card, since a step
// between them leaves the input text where it is (owner, 2026-11-19: no
// slide-out when the move stays in the same run).
function recordMoves(window) {
  const moves = [], was = window.Element.prototype.scrollTo;
  window.Element.prototype.scrollTo = function (o) {
    if (this.classList.contains('sd-track')) moves.push(o.behavior || 'smooth');
    return was.call(this, o);
  };
  return moves;
}

test('with places a step inside an item redraws its card in place, and a step into the next item slides the track', async () => {
  const w = page();
  const moves = recordMoves(w);
  const drawn = [];
  const s = mountSubs(w, { extra: { places: true, body: (id, el, sub) => { drawn.push(el); return `<p>body ${id}${sub ? '.' + sub : ''}</p>`; } } });
  await tick(3);
  const track = s.card.querySelector('.sd-track');
  assert.equal(track.children.length, 3, 'one slide per item');
  const el = track.children[0].firstElementChild;
  moves.length = 0;
  s.handle.step(1);
  await tick(3);
  assert.deepEqual(picked(s).at(-1), ['a', 'swipe', 'y']);
  assert.equal(track.scrollLeft, 0, 'the track stays on the item');
  assert.equal(el.textContent, 'body a.y', 'its card shows the next sub-item');
  assert.equal(drawn.at(-1), el, 'body is handed the element already showing the item');
  assert.ok(!moves.includes('smooth'), 'no transition ran');
  assert.equal(headText(s.card), 'Row a22/5', 'the counter and pill still count sub-items');
  s.handle.step(1);
  await tick(3);
  moves.length = 0;
  s.handle.step(1);
  await tick(3);
  assert.deepEqual(picked(s).at(-1), ['b', 'swipe', null]);
  assert.equal(track.scrollLeft, 400, 'into the next item the track moves');
  assert.deepEqual(moves, ['smooth'], 'with the transition');
  s.handle.step(-1);
  await tick(3);
  assert.deepEqual(picked(s).at(-1), ['a', 'swipe', 'z'], 'back into an item lands on its last sub-item');
  assert.equal(el.textContent, 'body a.z');
});

test('with places a tab, show() and a swipe inside an item stay on its card', async () => {
  const w = page();
  const s = mountSubs(w, { extra: { places: true } });
  await tick(3);
  const track = s.card.querySelector('.sd-track');
  const el = track.children[0].firstElementChild;
  tabsOf(s.list, 'a')[2].dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  await tick(3);
  assert.deepEqual(picked(s).at(-1), ['a', 'list', 'z']);
  assert.equal(track.scrollLeft, 0);
  assert.equal(el.textContent, 'body a.z');
  s.handle.show('a', 'x');
  await tick(3);
  assert.equal(el.textContent, 'body a.x');
  assert.ok(track.hasAttribute('data-sd-steps'), 'an item of several sub-items holds the track still under a pan');
  const touch = (type, x) => {
    const e = new w.Event(type, { bubbles: true });
    e.touches = type === 'touchend' ? [] : [{ clientX: x, clientY: 100 }];
    e.changedTouches = [{ clientX: x, clientY: 100 }];
    el.dispatchEvent(e);
  };
  touch('touchstart', 300); touch('touchend', 200);
  await tick(3);
  assert.deepEqual(picked(s).at(-1), ['a', 'swipe', 'y'], 'a swipe to the left is a step to the next');
  assert.equal(track.scrollLeft, 0);
  assert.equal(el.textContent, 'body a.y');
  s.handle.pick('c');
  await tick(3);
  assert.equal(track.scrollLeft, 800);
  assert.ok(!track.hasAttribute('data-sd-steps'), 'an item of one swipes as before');
});

test('a deck that follows slides() with card() steps through an item in place and slides between items', async () => {
  const w = page();
  const s = mountSubs(w, { extra: { places: true } });
  await tick(3);
  const cards = s.handle.slides();
  const d = w.swipeDeck.open({
    count: cards.length, title: 'deck', start: 1, card: i => cards[i].id,
    render: (i, el) => { el.textContent = 'deck ' + cards[i].id + (cards[i].sub ?? ''); },
  });
  await tick(3);
  const track = d.deck.track, el = track.children[0].firstElementChild;
  assert.equal(track.children.length, 3);
  assert.equal(d.deck.active(), 1);
  assert.equal(el.textContent, 'deck ay', 'it opens on its start');
  const key = k => w.dispatchEvent(new w.KeyboardEvent('keydown', { key: k }));
  key('ArrowRight');
  await tick(3);
  assert.equal(d.deck.active(), 2);
  assert.equal(track.scrollLeft, 0);
  assert.equal(el.textContent, 'deck az');
  key('ArrowRight');
  await tick(3);
  assert.equal(d.deck.active(), 3);
  assert.equal(track.scrollLeft, 400);
  key('ArrowLeft');
  await tick(3);
  assert.equal(d.deck.active(), 2);
  assert.equal(track.scrollLeft, 0);
  assert.equal(el.textContent, 'deck az');
  d.close();
  await tick(3);
});
