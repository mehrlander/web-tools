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
    assert.match(row.textContent, /Hide/);
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
