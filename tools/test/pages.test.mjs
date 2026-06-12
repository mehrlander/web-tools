// alpineComponents/pages.js — the pages view inside show-repo. Logic-level
// tests with real Alpine under jsdom (bootstrap.mjs recipe): scan a fake
// git-tree, group by folder, build render/source/thumb URLs, and re-scan when
// the browsed repo/ref changes. Not covered: live iframes, real API calls.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="pages" x-data="pages()"></div>
  </body></html>`,
});

// Mirror startAlpine, plus the two things pages.js needs from its host page:
// the collapse plugin and the shared 'browser' store (alpine-bundle's job in
// show-repo.html).
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
const { default: collapse } = await import('@alpinejs/collapse/dist/module.esm.js');
window.Alpine = Alpine;
Alpine.plugin(collapse);

const fakeTree = {
  truncated: false,
  tree: [
    { type: 'blob', path: 'README.md' },
    { type: 'blob', path: 'top.html' },
    { type: 'blob', path: 'pages/foo.html' },
    { type: 'blob', path: 'pages/demos/bar.html' },
    { type: 'blob', path: 'pages/thumbs/foo.png' },
    { type: 'tree', path: 'pages' },
  ],
};
const reqLog = [];
window.document.addEventListener('alpine:init', () => {
  Alpine.store('browser', {
    gh: { req: async (p) => { reqLog.push(p); return fakeTree; } },
    repo: 'me/proj',
    ref: 'main',
    defaultRef: 'main',
    repoObj: { has_pages: true },
  });
});

new window.Function(readFileSync(path.join(repoRoot, 'lib/alpineComponents/pages.js'), 'utf8'))();
Alpine.start();
await tick(3);

const el = window.document.getElementById('pages');
const data = Alpine.$data(el);

test('mounts closed with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
  assert.equal(data.open, false);
  assert.equal(reqLog.length, 0, 'no API call before the section is opened');
  assert.ok(data.description.length > 0);
});

test('first open scans the tree for .html blobs only', async () => {
  data.toggle();
  await tick(3);
  assert.deepEqual(reqLog, ['git/trees/main?recursive=1']);
  assert.deepEqual(data.items.map(p => p.path).sort(),
    ['pages/demos/bar.html', 'pages/foo.html', 'top.html']);
});

test('groups by folder, root first', () => {
  // [...] rebuilds the realm-crossed array on this side for deepEqual.
  assert.deepEqual([...data.groups.map(g => g.dir)], ['', 'pages', 'pages/demos']);
});

test('render/source/thumb URLs follow the conventions', () => {
  const foo = data.items.find(p => p.path === 'pages/foo.html');
  assert.equal(foo.renderUrl, 'https://me.github.io/proj/pages/foo.html');
  assert.equal(foo.codeUrl, 'https://github.com/me/proj/blob/main/pages/foo.html');
  assert.equal(foo.thumb, 'https://cdn.jsdelivr.net/gh/me/proj@main/pages/thumbs/foo.png');
  const top = data.items.find(p => p.path === 'top.html');
  assert.equal(top.thumb, '', 'thumbs only attempted under pages/');
});

test('ref change re-scans and appends ?use= off the default ref', async () => {
  Alpine.store('browser').ref = 'dev';
  await tick(3);
  assert.deepEqual(reqLog, ['git/trees/main?recursive=1', 'git/trees/dev?recursive=1']);
  const foo = data.items.find(p => p.path === 'pages/foo.html');
  assert.equal(foo.renderUrl, 'https://me.github.io/proj/pages/foo.html?use=dev');
});

test('unpublished repos are flagged', () => {
  assert.equal(data.unpublished, false);
  Alpine.store('browser').repoObj = { has_pages: false };
  assert.equal(data.unpublished, true);
});
