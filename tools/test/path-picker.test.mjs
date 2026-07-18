// alpineComponents/path-picker.js — logic-level tests for the input-anchored
// path selector: the whole-input path resolve, file picks (emit and stay open),
// dir mode (folder-as-target, files naming their folder), and typed-spec
// passthrough. The tree is injected directly; no network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="pf" x-data="pathPicker({ mode: 'file' })"></div>
    <div id="pd" x-data="pathPicker({ mode: 'dir' })"></div>
  </body></html>`,
});

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/alpineComponents/path-picker.js',
]);

// The tree a real ensureTree() would build from two roots: a repo node whose
// name carries its own '/', folders with children, files without.
const TREE = () => [{
  name: 'me/open', kind: 'repo', repo: 'me/open', ref: '',
  children: [
    { name: 'lib', kind: 'folder', children: [
      { name: 'a.js', kind: 'file' },
      { name: 'b.js', kind: 'file' },
    ]},
    { name: 'README.md', kind: 'file' },
  ],
}, {
  name: 'other/lib@dev', kind: 'repo', repo: 'other/lib', ref: 'dev',
  children: [{ name: 'src', kind: 'folder', children: [{ name: 'x.js', kind: 'file' }] }],
}];

const file = Alpine.$data(window.document.getElementById('pf'));
const dir = Alpine.$data(window.document.getElementById('pd'));
for (const d of [file, dir]) { d.tree = TREE(); d._loaded = true; }
const plain_ = (v) => JSON.parse(JSON.stringify(v));

const picks = [];
window.document.getElementById('pf').addEventListener('path-pick', e => picks.push(plain_(e.detail)));
window.document.getElementById('pd').addEventListener('path-pick', e => picks.push(plain_(e.detail)));
const inputs = [];
window.document.getElementById('pd').addEventListener('path-input', e => inputs.push(e.detail));

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

test('a typed path resolves through the repo node into its folders', () => {
  file.text = 'me/open/lib/a';
  file.resolveText();
  assert.deepEqual(plain_(file.scope.map(n => n.name)), ['me/open', 'lib']);
  assert.equal(file.query, 'a');
  assert.deepEqual(plain_(file.matches().map(n => n.name)), ['a.js']);
});

test('choosing a folder descends and rewrites the input', () => {
  file.text = ''; file.resolveText(); file.open = true;
  file.choose(file.matches().find(n => n.name === 'me/open'));
  assert.equal(file.text, 'me/open/');
  file.choose(file.matches().find(n => n.name === 'lib'));
  assert.equal(file.text, 'me/open/lib/');
  assert.equal(file.open, true);
});

test('file mode: choosing a file emits repo/ref/path and stays open in place', () => {
  picks.length = 0;
  file.text = 'me/open/lib/'; file.resolveText(); file.open = true;
  file.choose(file.matches().find(n => n.name === 'b.js'));
  assert.deepEqual(plain_(picks), [{ repo: 'me/open', ref: '', path: 'lib/b.js' }]);
  assert.equal(file.open, true, 'stays open for the next grab');
  assert.equal(file.text, 'me/open/lib/');
});

test('dir mode: dirSpec is null at the top, a spec inside a repo', () => {
  dir.text = ''; dir.resolveText();
  assert.equal(dir.dirSpec(), null);
  dir.text = 'other/lib@dev/src/'; dir.resolveText();
  assert.deepEqual(plain_(dir.dirSpec()), { repo: 'other/lib', ref: 'dev', dir: 'src', spec: 'other/lib@dev:src' });
});

test('dir mode: choosing a file picks its containing folder and closes', () => {
  picks.length = 0;
  dir.text = 'other/lib@dev/src/'; dir.resolveText(); dir.open = true;
  dir.choose(dir.matches().find(n => n.name === 'x.js'));
  assert.deepEqual(plain_(picks), [{ repo: 'other/lib', ref: 'dev', dir: 'src', spec: 'other/lib@dev:src' }]);
  assert.equal(dir.open, false);
  assert.equal(dir.text, 'other/lib@dev:src');
});

test('typed text emits path-input so hand-written specs pass through', () => {
  inputs.length = 0;
  dir.text = 'someone/else:pkg';
  dir.onInput();
  assert.deepEqual(plain_(inputs), ['someone/else:pkg']);
});

test('folders sort before files and prefix matches lead', () => {
  file.text = 'me/open/'; file.resolveText();
  assert.deepEqual(plain_(file.matches().map(n => n.name)), ['lib', 'README.md']);
  file.text = 'me/open/RE'; file.resolveText();
  assert.deepEqual(plain_(file.matches().map(n => n.name)), ['README.md']);
});
