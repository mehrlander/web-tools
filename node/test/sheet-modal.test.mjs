// alpineComponents/sheet-modal.js — logic-level tests with real Alpine under
// jsdom, per the recipe in docs/environment/testing.md (now packaged as the
// bootstrap). The slot deliberately carries an EAGERLY-evaluated binding
// (x-text reading component scope): a slot-handling regression that orphans
// the slotted nodes throws at startup, which lazy @click-only slots miss.
// Not covered here (needs real pixels/gestures): drag physics, CSS visuals.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const { window, setMedia, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="host" x-data="sheetModal({ title: 'Editor', openOn: 'open-editor' })">
      <p id="slot-content" x-text="isDesktop ? 'desktop' : 'mobile'"></p>
      <button id="closer" @click="close()"></button>
    </div>
  </body></html>`,
});

const slotBefore = window.document.getElementById('slot-content');
const Alpine = await startAlpine(window, ['lib/alpineComponents/sheet-modal.js']);
const host = window.document.getElementById('host');
const data = Alpine.$data(host);
const panel = () => host.querySelector('.sheet-modal-panel');
const H = window.innerHeight; // jsdom default 768

test('mounts with zero startup warnings/errors despite the eager slot binding', () => {
  assert.deepEqual(problems, []);
});

test('chrome is assembled around the slot: scrim, panel, header, body', () => {
  assert.ok(host.querySelector('.sheet-modal-scrim'));
  assert.ok(panel());
  assert.equal(panel().querySelector('h2').textContent, 'Editor');
  assert.ok(host.querySelector('[data-sheet-body] #slot-content'),
    'slot content lives inside the scrollable body');
  assert.ok(window.document.getElementById('sheet-modal-css'), 'style tag injected once');
});

test('slot nodes are MOVED, not rebuilt — node identity survives init()', () => {
  assert.equal(window.document.getElementById('slot-content'), slotBefore);
});

test('slot bindings resolve against component scope', () => {
  assert.equal(slotBefore.textContent, 'mobile'); // matchMedia starts false
});

test('mobile: starts parked offscreen; open() snaps to the first snap point', async () => {
  assert.equal(data.isDesktop, false);
  assert.equal(panel().style.transform, 'translateY(100%)');
  data.open();
  await tick();
  assert.equal(data.shown, true);
  // snaps default [0.5, 0.92] → first snap sits at h * (1 - 0.5)
  assert.equal(panel().style.transform, `translateY(${H * 0.5}px)`);
});

test('mobile: close() animates fully offscreen', async () => {
  data.close();
  await tick();
  assert.equal(data.shown, false);
  assert.equal(panel().style.transform, `translateY(${H}px)`);
});

test('the openOn window event opens it', async () => {
  window.dispatchEvent(new window.CustomEvent('open-editor'));
  await tick();
  assert.equal(data.shown, true);
});

test('a slotted @click can reach close()', async () => {
  window.document.getElementById('closer').click();
  await tick();
  assert.equal(data.shown, false);
});

test('breakpoint flip to desktop re-presents in place', async () => {
  data.open();
  await tick();
  setMedia(true); // cross 640px while open
  await tick();
  assert.equal(data.isDesktop, true);
  assert.equal(slotBefore.textContent, 'desktop', 'slot binding tracked the flip');
  assert.equal(panel().style.transform, '', 'desktop centers via CSS, JS transform cleared');
});

test('desktop: scrim + panel ride the shown class branches', async () => {
  const scrim = host.querySelector('.sheet-modal-scrim');
  assert.ok(data.shown);
  assert.ok(!scrim.className.includes('pointer-events-none'));
  assert.ok(panel().className.includes('scale-100'));
  data.close();
  await tick();
  assert.ok(scrim.className.includes('pointer-events-none'));
  assert.ok(panel().className.includes('scale-95'));
});

test('flip back to mobile while closed parks the panel offscreen again', async () => {
  setMedia(false);
  await tick();
  assert.equal(data.isDesktop, false);
  assert.equal(panel().style.transform, 'translateY(100%)');
});

test('Escape closes only while shown', async () => {
  data.open();
  await tick();
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
  await tick();
  assert.equal(data.shown, false);
});

test('no warnings or errors accumulated across the whole run', () => {
  assert.deepEqual(problems, []);
});
