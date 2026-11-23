// fab-tuck.test.mjs — the FAB's tuck: the launcher steps aside into a handle
// in the corner while a page's mark pad (lib/kits/mark-pad.js) is up, or when
// the menu's Hide asks, and a tap on the handle brings it back.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
const doc = window.document;
const Alpine = await startAlpine(window, [
  'lib/kits/csv.js', 'lib/kits/guide-render.js', 'lib/alpineComponents/path-picker.js', 'lib/alpineComponents/fab.js',
]);

async function mountFab() {
  const host = doc.createElement('div');
  host.innerHTML = '<div x-data="fab()" data-repo="mehrlander/web-tools" data-path="pages/text-lab.html"></div>';
  doc.body.appendChild(host);
  Alpine.initTree(host);
  await tick(3);
  return { d: Alpine.$data(host.firstElementChild), host };
}

// A page's mark pad stands in the launcher's column, so while it is up the
// launcher steps aside to a handle in the corner and tells the pad where to
// stand; a tap on the handle brings it back until the pad next comes up.
test('a page’s mark pad tucks the launcher into its corner, and a tap brings it back', async () => {
  const { d, host } = await mountFab();
  const root = doc.documentElement;
  const pad = shown => window.dispatchEvent(new window.CustomEvent('mark-pad', { detail: { shown } }));
  try {
    assert.equal(d.tuckNow, false, 'no pad, no tuck');
    pad(true); await tick(2);
    assert.equal(d.tuckNow, true);
    assert.equal(root.style.getPropertyValue('--mark-pad-bottom'), '34px', 'the pad is told to come down, to just above the handle');
    d.deckFloor = () => 57;
    root.setAttribute('data-deck-open', ''); await tick(2); await new Promise(r => window.setTimeout(r, 40));
    assert.equal(d.deckOpen, true);
    assert.equal(root.style.getPropertyValue('--mark-pad-bottom'), '65px', 'over an open deck the handle stays in the corner, and the pad stands above the footer');
    root.removeAttribute('data-deck-open'); await tick(2); await new Promise(r => window.setTimeout(r, 40));
    assert.equal(root.style.getPropertyValue('--mark-pad-bottom'), '34px');
    const tab = host.querySelector('[data-fab-tab]');
    assert.ok(tab, 'the handle takes a tap of its own');
    assert.match(tab.className, /rounded-tl-2xl/, 'a pull tab: rounded on its inner corner only');
    assert.match(tab.className, /size-\[26px\]/, 'and small, about a quarter of the launcher');
    assert.equal(tab.querySelector('i'), null, 'its grip is drawn, not a glyph');
    tab.click(); await tick(2);
    assert.equal(d.tuckNow, false, 'the tap brings the launcher back');
    assert.equal(root.style.getPropertyValue('--mark-pad-bottom'), '', 'and the pad goes back over it');
    pad(true); await tick(2);
    assert.equal(d.tuckNow, false, 'and it stays back while that pad is up');
    pad(false); pad(true); await tick(2);
    assert.equal(d.tuckNow, true, 'until the pad next comes up');
    d.open = true; await tick(2);
    assert.equal(d.tuckNow, false, 'an open drawer is never tucked');
    d.open = false;
    pad(false); await tick(2);
    assert.equal(d.tuckNow, false);
    assert.equal(root.style.getPropertyValue('--mark-pad-bottom'), '');
  } finally { host.remove(); }
});

test('the menu\'s Hide tucks the launcher into the corner on any page, until the handle brings it back', async () => {
  const { d, host } = await mountFab();
  const pad = shown => window.dispatchEvent(new window.CustomEvent('mark-pad', { detail: { shown } }));
  try {
    d.fabMenu = true; await tick(2);
    const row = host.querySelector('[data-fab-hide]');
    assert.ok(row, 'the menu offers Hide');
    assert.equal(row.getAttribute('aria-label'), 'Hide', 'an icon button on the Place row, named for what it does');
    row.click(); await tick(2);
    assert.equal(d.fabMenu, false, 'the row closes the menu');
    assert.equal(d.tuckNow, true, 'and tucks the launcher with no pad on the page');
    pad(true); pad(false); await tick(2);
    assert.equal(d.tuckNow, true, 'a pad coming and going leaves it hidden');
    host.querySelector('[data-fab-tab]').click(); await tick(2);
    assert.equal(d.tuckNow, false, 'a tap on the handle brings it back');
    assert.equal(d.hidden, false);
  } finally { host.remove(); }
});

test('a pad that came up before the launcher still tucks it', async () => {
  const pad = doc.createElement('div');
  pad.setAttribute('data-mark-pad', '');
  doc.body.append(pad);
  const { d, host } = await mountFab();
  try {
    await new Promise(r => window.setTimeout(r, 5)); await tick(2);
    assert.equal(d.tuckNow, true, 'the page booted first, and the pad is on screen');
  } finally {
    host.remove(); pad.remove();
    window.dispatchEvent(new window.CustomEvent('mark-pad', { detail: { shown: false } }));
  }
});

// A drag that presses the launcher against the right edge and the bottom
// together tucks it, as Hide does; it dims and shrinks on arriving there, so
// the release is a choice, and it comes back to where the drag began.
const ev = (type, x, y) => ({ type, button: 0, pointerId: 1, clientX: x, clientY: y, currentTarget: { setPointerCapture() {} } });
const wait = (ms) => new Promise(r => window.setTimeout(r, ms));

test('a drag into the corner tucks the launcher, and the handle brings it back to where the drag began', async () => {
  const { d, host } = await mountFab();
  try {
    d.x = -200; d.y = -300;
    d.onDown(ev('pointerdown', 500, 400));
    d.onMove(ev('pointermove', 600, 500));
    assert.equal(d.tuckAim, false, 'out in the open, nothing is aimed');
    d.onMove(ev('pointermove', 800, 500));
    assert.equal(d.tuckAim, false, 'against one edge is not the corner');
    d.onMove(ev('pointermove', 800, 800));
    assert.equal(d.tuckAim, true, 'against both edges, the corner is aimed');
    assert.deepEqual([d.x, d.y], [24, 24], 'and the disc is flush in it');
    d.onUp(ev('pointerup', 800, 800)); await tick(2);
    assert.equal(d.tuckNow, true, 'the release tucks it');
    assert.equal(d.hidden, true, 'the same tuck as Hide, so a pad coming and going leaves it');
    assert.equal(d.open, false, 'and the drawer does not open behind it');
    assert.deepEqual([d.x, d.y], [-200, -300], 'its place is where the drag began');
    host.querySelector('[data-fab-tab]').click(); await tick(2);
    assert.equal(d.tuckNow, false, 'a tap on the handle brings it back');
  } finally { host.remove(); }
});

test('a drag pulled back out of the corner, or cancelled in it, does not tuck', async () => {
  const { d, host } = await mountFab();
  try {
    d.onDown(ev('pointerdown', 900, 700));
    d.onMove(ev('pointermove', 960, 760));
    assert.equal(d.tuckAim, true);
    d.onMove(ev('pointermove', 880, 690));
    assert.equal(d.tuckAim, false, 'pulled back out, the aim is off');
    d.onUp(ev('pointerup', 880, 690)); await tick(2);
    assert.equal(d.tuckNow, false);
    d.onDown(ev('pointerdown', 900, 700));
    d.onMove(ev('pointermove', 960, 760));
    d.onUp(ev('pointercancel', 960, 760)); await tick(2);
    assert.equal(d.tuckNow, false, 'a gesture the system took over is not a release');
    assert.equal(d.tuckAim, false);
  } finally { host.remove(); }
});

// The tuck is true at once; `stow` is the picture of it. Out, the disc is
// carried to the handle's spot at the handle's size before the wrapper moves
// to the corner; back, it is put there first and carried home.
test('the launcher travels into the handle and back out, and does not where motion is reduced', async () => {
  const { d, host } = await mountFab();
  const wrap = host.querySelector('[data-fab-wrap]');
  try {
    d.hide(); await tick(1);
    assert.equal(d.tuckNow, true, 'the tuck is not delayed');
    assert.equal(d.stow, 'out', 'the disc travels first');
    assert.match(wrap.getAttribute('style'), /scale\(0\.46\)/, 'to the handle’s size');
    assert.doesNotMatch(wrap.className, /!bottom-0/, 'from the wrapper’s own place');
    await wait(260); await tick(1);
    assert.equal(d.stow, '');
    assert.match(wrap.className, /!bottom-0/, 'then the wrapper moves to the corner');
    d.untuck(); await tick(1);
    assert.equal(d.stow, 'at', 'back out, the disc is first put at the handle');
    await wait(40); await tick(1);
    assert.equal(d.stow, 'back', 'then carried home');
    await wait(360); await tick(1);
    assert.equal(d.stow, '');
    const mm = window.matchMedia;
    window.matchMedia = (q) => ({ ...mm(q), matches: /reduce/.test(q) });
    try {
      d.hide(); await tick(1);
      assert.equal(d.tuckNow, true);
      assert.equal(d.stow, '', 'reduced motion cuts straight to the handle');
    } finally { window.matchMedia = mm; }
  } finally { host.remove(); }
});

// The reader's own Hide holds over an open drawer, where a pad's tuck gives
// way to it: the handle brings the launcher back with the drawer still open,
// and a tap on the launcher then closes it.
test('Hide or a drag into the corner tucks the launcher with the drawer open, and the drawer stays open', async () => {
  const { d, host } = await mountFab();
  try {
    d.open = true; await tick(2);
    d.onDown(ev('pointerdown', 900, 700));
    d.onMove(ev('pointermove', 960, 760));
    d.onUp(ev('pointerup', 960, 760)); await tick(2);
    assert.equal(d.tuckNow, true, 'the drag tucks it over the open drawer');
    assert.equal(d.open, true, 'and the drawer stays open');
    host.querySelector('[data-fab-tab]').click(); await tick(2);
    assert.equal(d.tuckNow, false, 'the handle brings the launcher back');
    assert.equal(d.open, true, 'without closing the drawer');
    assert.ok(['at', 'back'].includes(d.stow), 'and it travels back out, as it does with the drawer shut: ' + d.stow);
    d.onDown(ev('pointerdown', 900, 700));
    d.onUp(ev('pointerup', 900, 700)); await tick(2);
    assert.equal(d.open, false, 'a tap on the launcher then closes it');
  } finally { host.remove(); }
});

test('a pad the toss-rendered subject put up before the launcher mounted still tucks it', async () => {
  const frameDoc = new window.DOMParser().parseFromString('<!doctype html><body><div data-mark-pad></div></body>', 'text/html');
  window.__tossFrame = { contentDocument: frameDoc };
  const { d, host } = await mountFab();
  try {
    await new Promise(r => window.setTimeout(r, 5)); await tick(2);
    assert.equal(d.tuckNow, true, 'the pad is in the subject frame, not the top document');
  } finally {
    host.remove(); delete window.__tossFrame;
    window.dispatchEvent(new window.CustomEvent('mark-pad', { detail: { shown: false } }));
  }
});
