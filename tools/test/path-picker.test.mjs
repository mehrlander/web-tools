// alpineComponents/path-picker.js — logic-level tests for the tap-through
// path selector: descent by choose(), crumb jumps, file picks (emit and stay
// open), dir mode (folder-as-target, files naming their folder). There is no
// text input by design. The tree is injected directly; no network, no pixels.

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

const byName = (d, name) => d.children().find(n => n.name === name);

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

test('children() lists roots at the top, folders before files inside a repo', () => {
  file.scope = [];
  assert.deepEqual(plain_(file.children().map(n => n.name)), ['me/open', 'other/lib@dev']);
  file.choose(byName(file, 'me/open'));
  assert.deepEqual(plain_(file.children().map(n => n.name)), ['lib', 'README.md']);
});

test('choosing folders descends; jump and up walk back', () => {
  file.scope = []; file.open = true;
  file.choose(byName(file, 'me/open'));
  file.choose(byName(file, 'lib'));
  assert.deepEqual(plain_(file.scope.map(n => n.name)), ['me/open', 'lib']);
  file.up();
  assert.deepEqual(plain_(file.scope.map(n => n.name)), ['me/open']);
  file.jump(0);
  assert.equal(file.scope.length, 0);
});

test('file mode: choosing a file emits repo/ref/path, labels, and stays open', () => {
  picks.length = 0;
  file.scope = []; file.open = true;
  file.choose(byName(file, 'me/open'));
  file.choose(byName(file, 'lib'));
  file.choose(byName(file, 'b.js'));
  assert.deepEqual(plain_(picks), [{ repo: 'me/open', ref: '', path: 'lib/b.js' }]);
  assert.equal(file.open, true, 'stays open for the next grab');
  assert.equal(file.label, 'lib/b.js');
});

test('dir mode: dirSpec is null at the top, a spec inside a repo', () => {
  dir.scope = [];
  assert.equal(dir.dirSpec(), null);
  dir.choose(byName(dir, 'other/lib@dev'));
  dir.choose(byName(dir, 'src'));
  assert.deepEqual(plain_(dir.dirSpec()), { repo: 'other/lib', ref: 'dev', dir: 'src', spec: 'other/lib@dev:src' });
});

test('dir mode: choosing a file picks its containing folder and closes', () => {
  picks.length = 0;
  dir.scope = []; dir.open = true;
  dir.choose(byName(dir, 'other/lib@dev'));
  dir.choose(byName(dir, 'src'));
  dir.choose(byName(dir, 'x.js'));
  assert.deepEqual(plain_(picks), [{ repo: 'other/lib', ref: 'dev', dir: 'src', spec: 'other/lib@dev:src' }]);
  assert.equal(dir.open, false);
  assert.equal(dir.label, 'other/lib@dev:src');
});

test('dir mode: pickDir commits the bare repo root as owner/repo', () => {
  picks.length = 0;
  dir.scope = []; dir.open = true;
  dir.choose(byName(dir, 'me/open'));
  dir.pickDir();
  assert.deepEqual(plain_(picks), [{ repo: 'me/open', ref: '', dir: '', spec: 'me/open' }]);
});
