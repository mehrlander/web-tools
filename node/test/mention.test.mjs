// alpineComponents/mention.js — logic-level tests with real Alpine under jsdom.
// Two modes: the default single-repo picker (tree from the shared browser
// store) and the repo-first picker (opts.roots), where the top level is a
// choice of repository and a pick emits a fully-qualified {repo, ref, path}.
// The store's gh is a fake GH class whose constructor + req serve canned git
// trees per repo, so no network or real files are touched.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

// Canned recursive git-tree entries ({path, type}) per repo.
const TREES = {
  'me/open': [
    { path: 'lib', type: 'tree' },
    { path: 'lib/app.js', type: 'blob' },
    { path: 'README.md', type: 'blob' },
  ],
  'me/dest': [
    { path: 'docs', type: 'tree' },
    { path: 'docs/guide.md', type: 'blob' },
    { path: 'src', type: 'tree' },
    { path: 'src/index.js', type: 'blob' },
  ],
  'me/broken': null, // req throws for this one
};

class FakeGH {
  constructor(conf = {}) { this.token = conf.token || ''; this.repo = conf.repo || ''; this.ref = 'main'; }
  async req() {
    const tree = TREES[this.repo];
    if (tree == null) throw new Error('404 ' + this.repo);
    return { tree, truncated: false };
  }
}

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="plain" x-data="mention()"></div>
    <div id="roots" x-data="mention({ roots: [{ repo: 'me/dest' }, { repo: 'me/open' }, { repo: 'me/broken' }] })"></div>
    <div id="rootstr" x-data="mention({ roots: ['me/dest'] })"></div>
  </body></html>`,
});

// alpine-bundle.js defines the browser store synchronously (Alpine present), so
// each mention's init() sees a store even before we point it at a repo.
const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/alpineComponents/mention.js',
]);

Alpine.store('browser').gh = new FakeGH({ token: 't', repo: 'me/open' });
Alpine.store('browser').repo = 'me/open';
Alpine.store('browser').ref = '';

const plain = Alpine.$data(window.document.getElementById('plain'));
const roots = Alpine.$data(window.document.getElementById('roots'));
const rootstr = Alpine.$data(window.document.getElementById('rootstr'));

// Init ran with gh:null (store empty at boot), so drive the load now that the
// store points at a repo. Both modes route through reload().
await plain.reload();
await roots.reload();
await rootstr.reload();
await tick(3);

// Capture the mention-select detail a pick dispatches.
const capture = (el) => {
  let detail = null;
  el.addEventListener('mention-select', (e) => { detail = e.detail; });
  return () => detail;
};

const find = (nodes, name) => nodes.find((n) => n.name === name);
// Alpine hands back reactive proxies; strip to plain values before a strict
// structural compare (deepStrictEqual rejects the proxy prototype otherwise).
const plain_ = (v) => JSON.parse(JSON.stringify(v));

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
  assert.ok(plain.description.length > 0);
});

// ---- default single-repo mode ------------------------------------------

test('default mode builds the open repo tree from the store', () => {
  assert.equal(plain.roots, null);
  assert.equal(plain.repoShort, 'open');
  const names = plain.tree.map((n) => n.name).sort();
  assert.deepEqual(plain_(names), ['README.md', 'lib']);
});

test('default mode emits an open-repo-relative {repo, ref, path}', () => {
  const el = window.document.getElementById('plain');
  const read = capture(el);
  plain.choose(find(plain.tree, 'README.md'));
  assert.deepEqual(plain_(read()), { repo: 'me/open', ref: '', path: 'README.md' });
});

// ---- repo-first (roots) mode -------------------------------------------

test('roots mode presents repositories as the top level, sorted', () => {
  assert.ok(Array.isArray(roots.roots));
  assert.equal(roots.repoShort, 'Repos');
  const names = roots.tree.map((n) => n.name);
  assert.deepEqual(plain_(names), ['me/broken', 'me/dest', 'me/open']);
  assert.ok(roots.tree.every((n) => n.kind === 'repo'));
});

test('a root that fails to load still appears, empty', () => {
  const broken = find(roots.tree, 'me/broken');
  assert.deepEqual(plain_(broken.children), []);
});

test('descending a repo shows its own tree, folders first', () => {
  roots.choose(find(roots.tree, 'me/dest'));
  assert.equal(roots.scope.length, 1);
  assert.equal(roots.scope[0].repo, 'me/dest');
  const names = roots.children().map((n) => n.name);
  assert.deepEqual(plain_(names), ['docs', 'src']); // both folders, alnum
});

test('picking a file emits a fully-qualified {repo, ref, path}', () => {
  const el = window.document.getElementById('roots');
  const read = capture(el);
  // From repo root of me/dest (scope set by the previous test), go into src…
  roots.choose(find(roots.children(), 'src'));
  // …then pick the file.
  roots.choose(find(roots.children(), 'index.js'));
  assert.deepEqual(plain_(read()), { repo: 'me/dest', ref: '', path: 'src/index.js' });
  // Choosing a file clears the scope back to the repo list.
  assert.equal(roots.scope.length, 0);
});

test('a bare "owner/repo" root string is normalized', () => {
  assert.equal(rootstr.roots[0].repo, 'me/dest');
  assert.equal(rootstr.roots[0].ref, '');
  assert.equal(rootstr.roots[0].label, 'me/dest');
  assert.equal(rootstr.tree[0].name, 'me/dest');
});
