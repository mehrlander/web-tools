// fab-bottom.test.mjs — the FAB's bottom panel: a band along the foot of the
// window that holds the console, opened from the sidebar's Console row, and
// Peek's readings when the menu's Peek starts it. It takes turns with the
// sidebar on a phone, and the launcher stands on its top edge.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
const doc = window.document;
const Alpine = await startAlpine(window, [
  'lib/vanilla-bundle.js', 'lib/kits/csv.js', 'lib/kits/guide-render.js', 'lib/kits/peek.js', 'lib/alpineComponents/path-picker.js', 'lib/alpineComponents/fab.js',
]);

async function mountFab() {
  const host = doc.createElement('div');
  host.innerHTML = '<div x-data="fab()" data-repo="mehrlander/web-tools" data-path="pages/index.html"></div>';
  doc.body.appendChild(host);
  Alpine.initTree(host);
  await tick(3);
  return { d: Alpine.$data(host.firstElementChild), host };
}
const wide = (on) => {
  const mm = window.matchMedia;
  window.matchMedia = (q) => ({ ...mm(q), matches: on && /min-width/.test(q) });
  return () => { window.matchMedia = mm; };
};

test('the sidebar\'s Console row opens the console in the bottom panel, and on a phone puts the sidebar away', async () => {
  const { d, host } = await mountFab();
  try {
    d.toggle(); await tick(3);
    assert.equal(d.open, true);
    const row = host.querySelector('[data-fab-console-row]');
    assert.ok(row, 'the sidebar keeps a Console row');
    row.click(); await tick(3);
    assert.equal(d.bottom, 'console');
    assert.equal(d.consoleOpen, true, 'consoleOpen reads the panel');
    assert.equal(d.open, false, 'on a phone the sidebar makes way');
    const panel = host.querySelector('[data-fab-bottom]');
    assert.ok(panel && !panel.closest('[data-fab-viewport]'), 'the panel is its own surface, outside the sidebar');
    assert.ok(panel.querySelector('#__fab-console-panel, [x-ref="consoleHost"]'), 'and holds the console');
    assert.match(panel.className, /bottom-0/);
    d.toggle(); await tick(3);
    assert.equal(d.open, true);
    assert.equal(d.bottom, '', 'opening the sidebar on a phone puts the panel away');
  } finally { host.remove(); }
});

test('on a wide screen the panel sits beside an open sidebar', async () => {
  const restore = wide(true);
  const { d, host } = await mountFab();
  try {
    d.toggle(); await tick(3);
    d.toggleConsole(); await tick(3);
    assert.equal(d.open, true, 'both stay up');
    assert.equal(d.bottom, 'console');
    assert.match(host.querySelector('[data-fab-bottom]').className, /sm:right-\[22rem\]/, 'stopping at the sidebar\'s edge');
    assert.equal(d.bottomLift, 0, 'clear of the launcher\'s corner, so the launcher stays put');
    d.toggleConsole(); await tick(2);
    assert.equal(d.bottom, '', 'the row puts it away again');
  } finally { restore(); host.remove(); }
});

test('the launcher stands on the panel\'s top edge, and the fab-open event still reaches the console', async () => {
  const { d, host } = await mountFab();
  try {
    window.dispatchEvent(new window.CustomEvent('web-tools:open-drawer', { detail: { console: true } })); await tick(3);
    assert.equal(d.bottom, 'console', 'a caller asking for the console gets it');
    const lift = Math.round(window.innerHeight * 0.38) + 12;
    assert.equal(d.bottomLift, lift);
    assert.equal(d.yShown, 24 - lift);
    d.closeBottom(); await tick(2);
    assert.equal(d.yShown, 0);
  } finally { host.remove(); }
});

test('the menu\'s Peek reads into the panel, takes the edge Peek asks for, and putting the panel away ends it', async () => {
  const { d, host } = await mountFab();
  try {
    await d.openPeek(); await tick(3);
    assert.equal(window.Peek.enabled, true);
    assert.equal(d.bottom, 'peek');
    assert.equal(d.peekHosted, true);
    const hostEl = host.querySelector('[data-fab-peek-host]');
    assert.ok(hostEl.querySelector('[data-peek-panel]'), 'Peek\'s readings are inside the panel');
    assert.equal(doc.body.querySelectorAll(':scope > [data-peek-panel]').length, 0, 'and Peek drew no band of its own');
    assert.equal(doc.documentElement.hasAttribute('data-peek-open'), false, 'nor announced one');
    window.Peek.select(doc.body); await tick(1);
    host.querySelector('[data-peek-act="dock"]')?.click(); await tick(2);
    assert.equal(d.bottomSide, 'top', 'Peek\'s other edge moves the panel');
    assert.equal(d.bottomLift, 0, 'and the launcher keeps its place');
    d.toggleConsole(); await tick(2);
    assert.equal(d.bottom, 'console', 'the console shares the panel');
    assert.equal(window.Peek.enabled, true, 'without ending Peek');
    d.toggleConsole(); await tick(2);
    assert.equal(d.bottom, 'peek', 'closing the console goes back to Peek');
    d.closeBottom(); await tick(2);
    assert.equal(window.Peek.enabled, false, 'putting the panel away ends Peek');
    assert.equal(d.peekHosted, false);
    await d.openPeek(); await tick(3);
    window.Peek.disable(); await tick(2);
    assert.equal(d.bottom, '', 'and Peek ending on its own puts the panel away');
  } finally { if (window.Peek?.enabled) window.Peek.disable(); host.remove(); }
});
