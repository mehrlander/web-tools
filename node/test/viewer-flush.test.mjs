// alpineComponents/viewer.js — the `flush` host option and the Markdown
// panes' side padding (ViewRegistry.MD_INSET).
//
// pages/data-view.html gives the viewer the screen's full width on a phone and
// asks for `flush`, so the header row and the Markdown panes take 10px of
// their own: the redline's 6px change bar on the screen's edge and 4px before
// the text. What is held here is that the option reaches the root as an
// attribute, that a host which does not ask is left unmarked, and that
// Preview and Changes carry the same padding, since a difference between them
// moves the text sideways when a reader switches modes. Where the padding
// lands is layout, which node/render/scenarios/md-redline.mjs measures.

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
