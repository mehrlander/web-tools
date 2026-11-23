// alpineComponents/tools.js — the Tools view: every page the estate declares,
// in a list beside a live preview. Logic-level tests with real Alpine under
// jsdom (bootstrap.mjs recipe): the rows built from the shell's config cache,
// the docs/tools.csv utilities folded into the hub's group with identities
// joined from pages/pages.csv, the preview address the shell supplies, the
// selection and filter, and the undeclared scan through a stubbed GH. Not
// covered: the live iframe, the real API.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="tools" x-data="tools()"></div>
  </body></html>`,
});

const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;

// The hub's utilities, docs/tools.csv's { path, icon } shape: one hub page, one
// cross-repo page, and one a manifest below already declares.
const manifest = [
  'path,icon',
  'pages/diff-tool.html,ph-git-diff',
  'other/repo:tool.html,',
  'pages/doc-growth.html,ph-chart-line',
].join('\n') + '\n';
// The pages catalog the identities are joined from, keyed by href. CSV text
// rather than objects, so the component's own parse runs.
const pages = [
  'href,title,note',
  'diff-tool.html,Diff,Side-by-side text diff tool.',
  'doc-growth.html,Doc Growth,Words over time.',
].join('\n') + '\n';
const getLog = [];
window.TOKEN = 'ignored-in-test';
window.GH = class {
  constructor(opts) { this.opts = opts; }
  async get(p) {
    getLog.push([this.opts.repo, p]);
    if (p === 'pages/pages.csv') return { text: pages };
    return { text: manifest };
  }
  async req() {
    if (this.opts.repo === 'mehrlander/budget') {
      return { tree: [
        { type: 'blob', path: 'app/view/app.html' },
        { type: 'blob', path: 'old/scratch.html' },
        { type: 'blob', path: 'node_modules/x/demo.html' },
        { type: 'blob', path: 'pages/thumbs/a.html' },
      ] };
    }
    return { tree: [] };
  }
};

// The shell's config cache, as loadEstateSidebar leaves it.
window.__shell = {
  appViewsReady: Promise.resolve(),
  REGISTRY_REPO: 'mehrlander/registry',
  DEFAULT_REPO: 'mehrlander/web-tools',
  estateConfigs: {
    'mehrlander/registry': { hidden: ['mehrlander/secret'] },
    'mehrlander/web-tools': { pages: [{ path: 'pages/doc-growth.html', title: 'Growth', icon: 'ph-chart-line' }] },
    'mehrlander/budget': { icon: 'ph-scales', group: 'data', pages: [
      { path: 'app/view/app.html', title: 'Budget', query: 'route=home', order: 1 },
      { path: 'app/view/app.html', title: 'Spend', query: '?route=spend', order: 2 },
      { path: 'standalone.html', title: 'Standalone', note: 'Its own shell.', fullApp: true, order: 3 },
      { path: 'mehrlander/budget@dev:x.html', title: 'Dev', order: 4 },
    ] },
    'mehrlander/secret': { pages: [{ path: 'hidden.html', title: 'Hidden' }] },
  },
  estateRepos: [{ repo: 'mehrlander/budget', icon: 'ph-scales', group: 'data', order: 3 }],
  resolveHidden(c) { return new Set((c && c.hidden) || []); },
  appViewAddress(v) { return 'frame:' + v.repo + (v.ref ? '@' + v.ref : '') + ':' + v.path + (v.query ? '?' + v.query : ''); },
};

new window.Function('window', readFileSync(path.join(repoRoot, 'lib/kits/csv.js'), 'utf8'))(window);
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/repo-address.js'), 'utf8'))();
new window.Function(readFileSync(path.join(repoRoot, 'lib/alpineComponents/tools.js'), 'utf8'))();
Alpine.start();
await tick(4);

const el = window.document.getElementById('tools');
const data = Alpine.$data(el);
const byTitle = t => data.rows.find(r => r.title === t);

test('mounts and reads the utilities and the page catalog, with no startup warnings', () => {
  assert.deepEqual(problems, []);
  assert.ok(data.description.length > 0);
  assert.deepEqual(getLog.sort(), [
    ['mehrlander/web-tools', 'docs/tools.csv'],
    ['mehrlander/web-tools', 'pages/pages.csv'],
  ]);
});

test('every declared page is a row, a route of one page included; hidden repos stay out', () => {
  // Budget and Spend share a page and differ by query: two rows, not one.
  assert.ok(byTitle('Budget') && byTitle('Spend'));
  assert.notEqual(byTitle('Budget').key, byTitle('Spend').key);
  assert.equal(byTitle('Hidden'), undefined);
  assert.equal(data.declaredCount, 7);
});

test('the utilities join the hub group, take the gallery identity, and defer to a declaration', () => {
  const diff = byTitle('Diff');
  assert.equal(diff.repo, 'mehrlander/web-tools');
  assert.equal(diff.note, 'Side-by-side text diff tool.');
  assert.equal(diff.icon, 'ph-git-diff');
  // A cross-repo utility has no row in the hub's catalog: the filename, not a
  // same-named hub page's identity, and the default icon.
  const ext = byTitle('tool');
  assert.equal(ext.repo, 'other/repo');
  assert.equal(ext.icon, 'ph-wrench');
  // doc-growth is declared by the hub's manifest, so the utility adds no
  // second row and the declaration's title stands.
  assert.equal(data.rows.filter(r => r.path === 'pages/doc-growth.html').length, 1);
  assert.equal(byTitle('Growth').path, 'pages/doc-growth.html');
});

test('a row previews where the shell would frame it; a full app at its own address', () => {
  const spend = byTitle('Spend');
  assert.equal(spend.previewUrl, 'frame:mehrlander/budget:app/view/app.html?route=spend');
  assert.equal(spend.appHref, '?app=mehrlander/budget:app/view/app.html');
  const own = byTitle('Standalone');
  assert.equal(own.previewUrl, 'https://mehrlander.github.io/budget/standalone.html');
  assert.equal(own.appHref, own.ownUrl);
  assert.equal(own.sourceUrl, 'https://github.com/mehrlander/budget/blob/main/standalone.html');
});

test('a page pinned to a ref keeps the ref in its preview and its app link; with no shell address it falls back to the toss page', () => {
  const dev = byTitle('Dev');
  assert.equal(dev.previewUrl, 'frame:mehrlander/budget@dev:x.html');
  assert.equal(dev.appHref, '?app=mehrlander/budget@dev:x.html');
  const shell = window.__shell, fn = shell.appViewAddress;
  delete shell.appViewAddress;
  try { assert.equal(data.previewUrl('o/r', 'dev', 'p.html', ''), '../pages/toss-render.html#gh=o/r@dev:p.html'); }
  finally { shell.appViewAddress = fn; }
});

test('groups follow the sidebar order; the filter and the selection move together', () => {
  // No group sorts before 'data'; within a group, order, then the name.
  assert.deepEqual([...data.groups.map(g => g.repo)],
    ['mehrlander/web-tools', 'other/repo', 'mehrlander/budget']);
  data.pageRepo = 'mehrlander/budget';
  assert.deepEqual([...data.flat.map(r => r.title)], ['Budget', 'Spend', 'Standalone', 'Dev']);
  data.sel = byTitle('Budget').key;
  data.step(1);
  assert.equal(data.current.title, 'Spend');
  data.step(5);
  assert.equal(data.current.title, 'Dev');
  data.pageRepo = '';
  data.q = 'side-by';
  assert.deepEqual([...data.flat.map(r => r.title)], ['Diff']);
  data.q = '';
});

test('the scan lists undeclared pages and skips folders that are not pages', async () => {
  await data.scanUndeclared();
  assert.deepEqual({ ...data.undeclared }, { 'mehrlander/budget': ['old/scratch.html'] });
  assert.equal(data.undeclaredTotal, 1);
  const g = data.groups.find(x => x.repo === 'mehrlander/budget');
  assert.equal(g.declared, 4);
  assert.equal(g.rows.at(-1).undeclared, true);
});
