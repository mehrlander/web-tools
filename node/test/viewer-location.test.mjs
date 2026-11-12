// alpineComponents/viewer.js: the `location` host option.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const { window } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="asks" x-data="viewer({ location: true, bindStore: false })"></div>
    <div id="bare" x-data="viewer({ bindStore: false })"></div>
  </body></html>`,
});

const Alpine = await startAlpine(window, ['lib/alpine-bundle.js', 'lib/alpineComponents/viewer.js']);
const show = (id, file, origin) => Object.assign(Alpine.$data(window.document.getElementById(id)), { file, content: '# T\n', mode: 'raw', origin });

test('the line reads repository, ref and folder, with the branch for a pinned commit', () => {
  const d = show('asks', 'app/reversions/README.md', { repo: 'mehrlander/budget-drs', ref: 'd9706d517712', branch: 'codex/fund-reversions' });
  assert.equal(d.locationLine, 'budget-drs@codex/fund-reversions · app/reversions');
  assert.equal(d.fullAddress, 'mehrlander/budget-drs@codex/fund-reversions@d9706d517712:app/reversions/README.md');
});

test('a file at the root of a branch has no folder to name', () => {
  const d = show('asks', 'README.md', { repo: 'mehrlander/home', ref: 'main' });
  assert.equal(d.locationLine, 'home@main');
  assert.equal(d.fullAddress, 'mehrlander/home@main:README.md');
});

test('a local file, and a host that did not ask, get no line', () => {
  assert.equal(show('asks', 'paste.md', { local: true }).locationLine, '');
  assert.equal(show('bare', 'app/a.md', { repo: 'mehrlander/home', ref: 'main' }).locationLine, '');
});

test('the line is the header row\'s last child, under the name and the buttons', () => {
  const row = window.document.querySelector('#asks [data-sd-chrome]');
  assert.equal(row.lastElementChild.getAttribute('data-viewer-location'), '');
  assert.match(row.className, /flex-wrap/);
});
