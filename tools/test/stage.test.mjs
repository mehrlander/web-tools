// alpineComponents/stage.js — logic-level tests for the "Copy to repo"
// destination picker added on top of the stager. destRoots() supplies the
// repo-first mention picker its top level (open repo + configured targets),
// and onDestPicked() turns a picked {repo, ref, path} into an owner/repo:dir
// destSpec. Driven directly against a fake browser store; no network or the
// nested picker's pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="st" x-data="stager()"></div>
  </body></html>`,
});

// alpine-bundle.js defines the browser store (and x-collapse-free directives)
// synchronously; the stager reads that store at init.
const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/alpineComponents/mention.js',
  'lib/alpineComponents/stage.js',
]);

const data = Alpine.$data(window.document.getElementById('st'));
const store = Alpine.store('browser');
// Strip reactive proxies before a strict structural compare.
const plain_ = (v) => JSON.parse(JSON.stringify(v));

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
  assert.ok(data.description.length > 0);
});

test('destRoots leads with the open repo, then configured targets, deduped', () => {
  store.repo = 'me/open';
  store.config = { stage: { targets: ['me/dest:pkg', 'me/open:vendor', 'other/lib@dev:src'] } };
  const roots = data.destRoots();
  assert.deepEqual(plain_(roots), [
    { repo: 'me/open', ref: '' },   // open repo first; the me/open target dedupes away
    { repo: 'me/dest', ref: '' },
    { repo: 'other/lib', ref: 'dev' },
  ]);
});

test('destRoots without configured targets is just the open repo', () => {
  store.repo = 'me/open';
  store.config = null;
  assert.deepEqual(plain_(data.destRoots()), [{ repo: 'me/open', ref: '' }]);
});

test('onDestPicked writes owner/repo:dir from the picked file folder', () => {
  data.destBrowsing = true;
  data.onDestPicked({ repo: 'me/dest', ref: '', path: 'src/lib/index.js' });
  assert.equal(data.destSpec, 'me/dest:src/lib');
  assert.equal(data.destBrowsing, false, 'closes the picker after a pick');
});

test('a repo-root file yields a bare owner/repo (no dir)', () => {
  data.onDestPicked({ repo: 'me/dest', ref: '', path: 'README.md' });
  assert.equal(data.destSpec, 'me/dest');
});

test('a picked ref is carried into the destSpec', () => {
  data.onDestPicked({ repo: 'other/lib', ref: 'dev', path: 'src/a.js' });
  assert.equal(data.destSpec, 'other/lib@dev:src');
});

test('the destSpec round-trips through parseDest', () => {
  data.onDestPicked({ repo: 'other/lib', ref: 'dev', path: 'pkg/mod/x.js' });
  assert.deepEqual(plain_(data.parseDest(data.destSpec)), { repo: 'other/lib', ref: 'dev', dir: 'pkg/mod' });
});
