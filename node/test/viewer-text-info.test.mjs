// alpineComponents/viewer.js — the `textInfo` host option. Under it a text
// file's header shows a button that asks the FAB for its Text tab, in place of
// the lines and size. A module's own report still shows as the line.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const { window } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="asks" x-data="viewer({ textInfo: true })"></div>
    <div id="bare" x-data="viewer()"></div>
  </body></html>`,
});

const Alpine = await startAlpine(window, ['lib/alpine-bundle.js', 'lib/alpineComponents/viewer.js']);
const data = (id) => Alpine.$data(window.document.getElementById(id));
const text = (d) => Object.assign(d, { file: 'a.md', content: '# T\n', mode: 'raw', meta: null });

test('the button stands in for the lines and size only where the host asks', () => {
  assert.equal(text(data('asks')).figuresInDrawer, true);
  assert.equal(text(data('bare')).figuresInDrawer, false);
});

test('a module that reported its own figures keeps the line', () => {
  const d = text(data('asks'));
  d.meta = '3 sheets';
  assert.equal(d.figuresInDrawer, false);
  assert.equal(d.stats, '3 sheets');
});

test('the button asks the FAB for its Text tab', async () => {
  const asked = [];
  window.addEventListener('web-tools:open-drawer', (e) => asked.push(e.detail));
  await text(data('asks')).openText();
  assert.equal(JSON.stringify(asked), '[{"tab":"text"}]');
});

test('the header carries the button, hidden unless the figures moved', () => {
  const b = window.document.querySelector('#asks [data-viewer-text-info]');
  assert.ok(b);
  assert.equal(b.getAttribute('x-show'), 'figuresInDrawer');
  assert.ok(window.document.querySelector('#bare [data-viewer-text-info]'), 'one template for every host');
});
