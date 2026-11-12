// alpineComponents/viewer.js: the `textInfo` host option. A text file's header
// shows a button for the FAB's Text tab in place of the lines and size.

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

test('the button replaces the lines and size only where the host asks', () => {
  assert.equal(text(data('asks')).statsInFab, true);
  assert.equal(text(data('bare')).statsInFab, false);
});

test('a module that reported its own figures keeps the line', () => {
  const d = text(data('asks'));
  d.meta = '3 sheets';
  assert.equal(d.statsInFab, false);
  assert.equal(d.stats, '3 sheets');
});

test('the button asks the FAB for its Text tab', async () => {
  const asked = [];
  window.addEventListener('web-tools:open-drawer', (e) => asked.push(e.detail));
  await text(data('asks')).openText();
  assert.equal(JSON.stringify(asked), '[{"tab":"text"}]');
});

test('the header has the button, shown only under the option', () => {
  const b = window.document.querySelector('#asks [data-viewer-text-info]');
  assert.ok(b);
  assert.equal(b.getAttribute('x-show'), 'statsInFab');
  assert.ok(window.document.querySelector('#bare [data-viewer-text-info]'), 'one template for every host');
});
