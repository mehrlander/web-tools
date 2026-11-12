// alpineComponents/viewer.js: the `flush` host option. It sets
// data-viewer-flush on the viewer's root, and Preview and Changes share
// ViewRegistry.MD_INSET. node/render/scenarios/md-redline.mjs measures the
// layout.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const { window } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="flush" x-data="viewer({ flush: true })"></div>
    <div id="bare" x-data="viewer()"></div>
  </body></html>`,
});

await startAlpine(window, ['lib/alpine-bundle.js', 'lib/alpineComponents/viewer.js']);
const R = window.ViewRegistry;
const mod = (id) => R.modules.find((m) => m.id === id);

test('flush marks the viewer root, and a host that does not ask is unmarked', () => {
  assert.ok(window.document.getElementById('flush').hasAttribute('data-viewer-flush'));
  assert.ok(!window.document.getElementById('bare').hasAttribute('data-viewer-flush'));
});

test('the inset is 24px, and 10px on a phone only under a flush host', () => {
  assert.match(R.MD_INSET, /(^| )px-6( |$)/);
  assert.match(R.MD_INSET, /max-sm:\[\[data-viewer-flush\]_&\]:px-\[10px\]/);
});

test('Preview and Changes carry the same side padding', () => {
  // Preview's Markdown branch renders through marked and DOMPurify, which
  // this realm does not load; its escaped-source fallback uses the same
  // column, and the column is what is read here.
  window.DOMPurify = null;
  window.marked = { parse: (t) => t };
  window.esc ||= (t) => String(t);
  const preview = mod('preview').render({ ext: 'md', content: '# T', name: 'a.md' });
  const changes = mod('changes').render({ ext: 'md', content: '# T', name: 'a.md' });
  for (const html of [preview, changes]) assert.ok(html.includes(`prose prose-sm !max-w-none ${R.MD_INSET} py-4`), html);
  // The legend row above the document lines up with it.
  assert.ok(changes.includes(`${R.MD_INSET} pt-3`));
});

test('the header row takes the phone inset under a flush host', () => {
  const head = window.document.querySelector('#flush [data-sd-chrome]');
  assert.match(head.className, /max-sm:\[\[data-viewer-flush\]_&\]:px-\[10px\]/);
});
