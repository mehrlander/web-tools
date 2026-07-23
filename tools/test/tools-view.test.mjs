// alpineComponents/tools.js — the curated Tools gallery inside show-repo.
// Logic-level tests with real Alpine under jsdom (bootstrap.mjs recipe): resolve
// a manifest path (bare hub path vs qualified cross-repo ref), build the
// render/thumb/source URLs the pages catalog conventions use, and load the
// curated manifest through a stubbed GH. Not covered: live iframes, real API.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="tools" x-data="tools()"></div>
  </body></html>`,
});

const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
window.Alpine = Alpine;

// The curated manifest the component fetches, served by a stubbed GH (no token,
// public hub). Mirrors docs/tools.json's shape.
const manifest = {
  items: [
    { path: 'pages/diff-tool.html', title: 'Diff', note: 'Drop-in side-by-side text compare.', icon: 'ph-git-diff' },
    { path: 'mehrlander/home@dev:projects/x/app.html', title: 'X', note: '', icon: 'ph-cube' },
    { path: 'other/repo:tool.html', title: 'Ext' },
  ],
};
const getLog = [];
window.TOKEN = 'ignored-in-test';
window.GH = class {
  constructor(opts) { this.opts = opts; }
  async get(p) { getLog.push([this.opts.repo, this.opts.ref, p]); return { text: JSON.stringify(manifest) }; }
};

new window.Function(readFileSync(path.join(repoRoot, 'lib/alpineComponents/tools.js'), 'utf8'))();
Alpine.start();
await tick(3);

const el = window.document.getElementById('tools');
const data = Alpine.$data(el);

test('mounts and loads the curated manifest with no startup warnings', () => {
  assert.deepEqual(problems, []);
  assert.ok(data.description.length > 0);
  assert.deepEqual(getLog, [['mehrlander/web-tools', 'main', 'docs/tools.json']]);
  assert.equal(data.items.length, 3);
});

test('resolve: bare path means the hub at main; qualified ref overrides', () => {
  // {...} rebuilds each realm-crossed object on this side for deepEqual.
  assert.deepEqual({ ...data.resolve('pages/diff-tool.html') },
    { repo: 'mehrlander/web-tools', ref: 'main', path: 'pages/diff-tool.html' });
  assert.deepEqual({ ...data.resolve('mehrlander/home@dev:projects/x/app.html') },
    { repo: 'mehrlander/home', ref: 'dev', path: 'projects/x/app.html' });
  assert.deepEqual({ ...data.resolve('other/repo:tool.html') },
    { repo: 'other/repo', ref: 'main', path: 'tool.html' });
});

test('render/thumb/source URLs follow the pages-catalog conventions', () => {
  // Bare hub path at main: hosted github.io + jsDelivr thumb + blob source.
  assert.equal(data.renderUrl('pages/diff-tool.html'),
    'https://mehrlander.github.io/web-tools/pages/diff-tool.html');
  assert.equal(data.thumbUrl('pages/diff-tool.html'),
    'https://cdn.jsdelivr.net/gh/mehrlander/web-tools@main/pages/thumbs/diff-tool.png');
  assert.equal(data.codeUrl('pages/diff-tool.html'),
    'https://github.com/mehrlander/web-tools/blob/main/pages/diff-tool.html');
  // A mehrlander repo off its default ref routes through toss-render #gh=.
  assert.equal(data.renderUrl('mehrlander/home@dev:projects/x/app.html'),
    'https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=mehrlander/home@dev:projects/x/app.html');
  // A non-pages/ path gets no thumbnail (placeholder icon instead).
  assert.equal(data.thumbUrl('mehrlander/home@dev:projects/x/app.html'), '');
});

test('cards derive title/icon defaults and carry the resolved URLs', () => {
  const cards = data.cards;
  const ext = cards.find(c => c.path === 'other/repo:tool.html');
  assert.equal(ext.title, 'Ext');
  assert.equal(ext.icon, 'ph-wrench', 'missing icon defaults to the wrench');
  assert.equal(ext.view, 'shot');
  const diff = cards.find(c => c.path === 'pages/diff-tool.html');
  assert.equal(diff.renderUrl, 'https://mehrlander.github.io/web-tools/pages/diff-tool.html');
});
