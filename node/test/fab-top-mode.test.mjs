// The drawer on a top-level toss (pages/toss-render.html's ?top, which stamps
// window.__tossTop; fab.js _topAddress). Top mode writes the page in as the
// tab's document, so the tab's address is the renderer's own. What breaks
// without these: the drawer
// names pages/toss-render.html as what you are looking at, so the pin's ✕,
// the branch list and the newer badge re-render the renderer itself, outside
// top mode, in main's drawer; and "go to main" reloads the same pinned page.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const ADDR = 'https://mehrlander.github.io/web-tools/pages/toss-render.html'
  + '?gh=mehrlander/web-tools@claude/x@aaaaaaa11111:pages/data-view.html&top&src=me/r:a.md#intro=hi';
const { window } = makeWindow({ url: ADDR });
window.__tossTop = { repo: 'mehrlander/web-tools', ref: 'aaaaaaa11111', path: 'pages/data-view.html', lib: 'aaaaaaa11111' };
window.ghAuth = { resolve: () => '' };

const Alpine = await startAlpine(window, ['lib/kits/guide-render.js', 'lib/alpineComponents/path-picker.js', 'lib/alpineComponents/fab.js']);

async function mount() {
  const host = window.document.createElement('div');
  host.innerHTML = '<div x-data="fab()"></div>';
  window.document.body.appendChild(host);
  Alpine.initTree(host);
  await tick(6);
  return Alpine.$data(host.firstElementChild);
}

test('the drawer names the page its address names, not the renderer', async () => {
  const d = await mount();
  assert.equal(d.repo, 'mehrlander/web-tools');
  assert.equal(d.path, 'pages/data-view.html', 'the page, not pages/toss-render.html');
  assert.equal(d.previewRef, 'aaaaaaa11111', 'pinned at the address\'s commit');
  assert.equal(d.refPinned, true);
  assert.equal(d.refLine, 'claude/x', 'the line from the address, with nothing stamped');
});

test('a change of ref stays a top-level toss and keeps the page\'s own query', async () => {
  const d = await mount();
  d.frameRef = 'claude/x';
  assert.equal(d.tossUrl,
    'https://mehrlander.github.io/web-tools/pages/toss-render.html'
    + '?gh=mehrlander/web-tools@claude/x:pages/data-view.html&top&src=me/r:a.md#intro=hi',
    'only the ref changes: unpinned to the line, still ?top, src and the fragment kept');
});

test('going to main leaves for the deployed page, with the page\'s own query', async () => {
  const d = await mount();
  assert.equal(d.topLiveUrl, 'https://mehrlander.github.io/web-tools/pages/data-view.html?src=me/r:a.md#intro=hi');
});

test('a page query inside the address is the page\'s, not part of its path', async () => {
  // How npm run showing mints it, #gh=…:pages/data-view.html?src=…, which the
  // renderer moves into the query with the page query encoded inside gh=.
  window.history.replaceState(null, '', '/web-tools/pages/toss-render.html?top&gh=mehrlander/web-tools@claude/x@aaaaaaa11111:pages/data-view.html%3Fsrc%3Dme/r@b@cccccccc:a.md');
  try {
    const d = await mount();
    assert.equal(d.path, 'pages/data-view.html', 'the path stops at the page query');
    d.frameRef = 'claude/x';
    assert.equal(d.tossUrl, 'https://mehrlander.github.io/web-tools/pages/toss-render.html'
      + '?top&gh=mehrlander/web-tools@claude/x:pages/data-view.html%3Fsrc%3Dme/r@b@cccccccc:a.md',
      'unpinned, the page query rides along as it came');
    assert.equal(d.topLiveUrl, 'https://mehrlander.github.io/web-tools/pages/data-view.html?src=me/r@b@cccccccc:a.md');
  } finally {
    window.history.replaceState(null, '', new URL(ADDR).pathname + new URL(ADDR).search + new URL(ADDR).hash);
  }
});

