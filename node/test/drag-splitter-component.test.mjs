// alpineComponents/drag-splitter.js — the drag-splitter as an Alpine component.
//
// The kit's gesture is tested in drag-splitter.test.mjs; this file holds the
// component's half: a size kept and written where the host's layout reads it,
// a reset that hands the layout back its default, and stops in the host's unit.
// jsdom lays out nothing, so every box is stubbed: the frame 1000px wide, the
// area before the drag-splitter 300px.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot, startAlpine, tick, until } from './bootstrap.mjs';

const { window } = makeWindow({ html: `<!doctype html><html><body>
  <div data-t="px" style="display:grid">
    <div data-t="area"></div>
    <div x-data="dragSplitter({ sets: '--w', store: 'ds-px', min: 100, max: 800, label: 'Resize the area', onChange: v => (window.__seen = v) })"></div>
    <div></div>
  </div>
  <div data-t="pct">
    <div></div>
    <div x-data="dragSplitter({ axis: 'row', from: 'end', unit: '%', sets: '--h', store: 'ds-pct', min: (el, span) => 100 / span * 100 })"></div>
    <div data-t="after"></div>
  </div>
</body></html>` });
window.localStorage.setItem('ds-pct', '40');
window.Element.prototype.getBoundingClientRect = function () {
  const w = this.dataset.t === 'area' ? 300 : 1000, h = this.dataset.t === 'after' ? 250 : 500;
  return { left: 0, top: 0, right: w, bottom: h, width: w, height: h };
};
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/drag-splitter.js'), 'utf8'))();
await startAlpine(window, ['lib/alpineComponents/drag-splitter.js']);

const frame = t => window.document.querySelector(`[data-t="${t}"]`);
const splitter = t => frame(t).querySelector('[x-data]');
const key = (el, k) => el.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true }));
const data = el => window.Alpine.$data(el);

test('the element becomes the kit\'s drag-splitter, named for a screen reader', async () => {
  const el = await until(() => splitter('px').classList.contains('drag-splitter') && splitter('px'), 'the attach');
  assert.equal(el.getAttribute('role'), 'separator');
  assert.equal(el.getAttribute('aria-orientation'), 'vertical', 'a column one by default');
  assert.equal(el.getAttribute('aria-label'), 'Resize the area');
  assert.equal(el.getAttribute('aria-valuenow'), '30', 'reading the area before it, 300 of 1000px');
  assert.equal(el.getAttribute('aria-valuemin'), '10', 'its stops given in px, reported in percent');
  assert.equal(el.getAttribute('aria-valuemax'), '80');
});

test('a key step writes the size on the parent, tells the host, and keeps it', async () => {
  const el = splitter('px');
  key(el, 'ArrowRight');
  await tick();
  assert.equal(data(el).size, 320, 'one 2% step of 1000px wider');
  assert.equal(frame('px').style.getPropertyValue('--w'), '320px');
  assert.equal(window.__seen, 320, 'onChange heard it');
  assert.equal(window.localStorage.getItem('ds-px'), '320', 'kept on commit');
  key(el, 'End');
  await tick();
  assert.equal(data(el).size, 800, 'held at the max');
});

test('a double-click hands the layout back its default', async () => {
  const el = splitter('px');
  el.dispatchEvent(new window.Event('dblclick'));
  await tick();
  assert.equal(data(el).size, null);
  assert.equal(frame('px').style.getPropertyValue('--w'), '', 'the property removed, so the CSS fallback applies');
  assert.equal(window.localStorage.getItem('ds-px'), null, 'and the kept size forgotten');
});

test('a kept size in percent is restored at init, and a function stop gets the span', async () => {
  const el = await until(() => splitter('pct').classList.contains('drag-splitter') && splitter('pct'), 'the attach');
  assert.equal(el.getAttribute('aria-orientation'), 'horizontal', 'a row one');
  assert.equal(frame('pct').style.getPropertyValue('--h'), '40%', 'the kept 40% written before any drag');
  assert.equal(el.getAttribute('aria-valuemin'), '20', '100px of the 500px span');
  key(el, 'Home');
  await tick();
  assert.equal(data(el).size, 95, 'measured from the end, Home is the largest size, the default 95% max');
});
