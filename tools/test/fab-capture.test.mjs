// fab-capture.test.mjs — the capture serializes what the drawer already
// collects, and says so honestly: mode names the fidelity, read() entries
// carry sizes rather than bytes, and the console buffer rides along whole.
// The clipboard half is a real-browser fact; this pins the bundle's shape,
// which is the contract a session reading a pasted capture depends on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const { window } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="pthost"></div>
    <div id="fabhost"></div>
  </body></html>`,
});

// Pre-mount state, the way gh-boot and gh-api leave it: a console buffer that
// predates the FAB, a script registry, a read() registry.
window.__consoleLogs = [
  { level: 'warn', msg: 'gh-fetch: GraphQL BranchSessions rejected: something', time: 1 },
  { level: 'error', msg: 'boom', time: 2 },
];
window.__loadedScripts = [{ path: 'kits/io.js', status: 'ok', auto: false }];
window.__reads = [{ path: 'data/big.json', value: { rows: [1, 2, 3] } }];

const Alpine = await startAlpine(window, ['lib/kits/guide-render.js', 'lib/alpineComponents/path-picker.js', 'lib/alpineComponents/fab.js']);
const doc = window.document;

Alpine.data('pageThing', () => ({
  description: 'a page component',
  actions: [{ label: 'Do it', run: () => {} }],
}));
doc.getElementById('pthost').setAttribute('x-data', 'pageThing');
Alpine.initTree(doc.getElementById('pthost'));

doc.getElementById('fabhost').setAttribute('x-data', 'fab()');
Alpine.initTree(doc.getElementById('fabhost'));
await tick(2);

const fab = Alpine.$data(doc.getElementById('fabhost'));

test('captureData serializes the collected state with honest fidelity', () => {
  const c = fab.captureData();
  assert.equal(c.capture, 'fab/1');
  assert.equal(c.mode, 'top-level', 'outside a toss the mode says so');
  assert.ok(c.at && c.address !== undefined);

  // The console buffer rides whole, including lines from before the mount:
  // this is what lets a capture answer whether a GraphQL query rejected.
  const msgs = [...c.console].map(l => l.msg);
  assert.ok(msgs.some(m => m.includes('GraphQL BranchSessions rejected')));
  assert.equal(c.errors, 1);

  // Scripts from the registry; reads as path + size, never the bytes.
  assert.ok([...c.scripts].some(s => s.path === 'kits/io.js' && s.status === 'ok'));
  const read = [...c.reads].find(r => r.path === 'data/big.json');
  assert.ok(read && read.bytes > 0);
  assert.equal(read.value, undefined, 'a capture reports sizes, not payloads');

  // The component scan, with the page's contributed actions by label.
  const pt = [...c.components].find(g => g.name === 'pageThing');
  assert.ok(pt, 'the page component is scanned');
  assert.equal(pt.side, 'page');
  assert.deepEqual([...(pt.actions || [])], ['Do it']);
});

test('the take grid carries Capture and runs it onto the clipboard', async () => {
  let written = '';
  window.navigator.clipboard = { writeText: async t => { written = t; } };
  const copy = [...fab.takeGroups].find(g => g.kind === 'Copy');
  assert.ok([...copy.items].some(i => i.key === 'capture'), 'Capture rides the Copy group, on the default tab');
  await fab.runTake('capture');
  assert.ok(written.length > 100, 'the JSON landed on the clipboard');
  assert.equal(JSON.parse(written).capture, 'fab/1', 'and parses back');
  assert.match(fab.outMsg, /^Copied a \d+K capture$/, 'reported on the shared output line');
});

// Region is the one take scoped to a PART of the page: it arms Peek on its
// Render reading rather than copying anything itself, so the row is held to
// naming what a pick becomes and the run to opening the kit on that reading.
test('the take grid carries Region, which arms Peek on its Render reading', async () => {
  const open = [...fab.takeGroups].find(g => g.kind === 'Open');
  const region = [...open.items].find(i => i.key === 'region');
  assert.ok(region, 'Region rides the Open group');
  assert.match(region.desc, /renders alone/, 'the row says what the copy becomes');
  const calls = [];
  window.Peek = { enabled: false, enable: (o) => calls.push(o), disable: () => {} };
  await fab.runTake('region');
  assert.equal(calls.length, 1, 'Peek was armed once');
  assert.equal(calls[0].view, 'render', 'on the Render reading');
  assert.equal(calls[0].doc, window.document, 'aimed at this document outside a toss');
  assert.match(fab.outMsg, /^Region:/, 'reported on the shared output line');
  assert.equal(fab.open, false, 'the drawer closes so the page can be tapped');
});

test('the take grid previews view, page, and picked-region DOM screenshots in the house deck', async () => {
  const image = [...fab.takeGroups].find(g => g.kind === 'Image');
  assert.deepEqual([...image.items].map(i => i.key), ['shot-view', 'shot-page', 'shot-region']);
  assert.ok(image.items.every(i => /DOM|renderer|reconstructed/.test(i.desc)),
    'every image scope says this is a renderer output');

  const captures = [];
  const previews = [];
  const downloads = [];
  const revoked = [];
  window.URL.createObjectURL = () => 'blob:preview';
  window.URL.revokeObjectURL = u => revoked.push(u);
  window.DomShot = {
    capture: async (node, o) => {
      captures.push({ node, o });
      return { blob: new window.Blob(['png']), mode: o.mode, renderer: 'test renderer',
               width: 390, height: 844, warnings: [] };
    },
    filename: (_node, mode) => mode + '.png',
    download: (blob, filename, doc) => downloads.push({ blob, filename, doc }),
  };
  window.swipeDeck = {
    open: o => {
      const el = window.document.createElement('div');
      const slide = window.document.createElement('div');
      o.render(0, slide);
      const handle = { el, deck: {}, options: o, slide };
      previews.push(handle);
      return handle;
    },
  };
  await fab.runTake('shot-view');
  await fab.runTake('shot-page');
  assert.deepEqual(captures.map(s => s.o.mode), ['viewport', 'page']);
  assert.ok(captures.every(s => s.node === window.document.documentElement));
  assert.deepEqual(previews.map(p => p.options.title), ['Visible view', 'Full page']);
  assert.ok(previews.every(p => p.options.count === 1), 'a single image uses the deck as a takeover, not as a false set');
  assert.ok(previews.every(p => p.el.hasAttribute('data-dom-shot-ignore')),
    'a second capture does not photograph the first preview');
  assert.match(previews[0].slide.textContent, /Reconstructed from the DOM by test renderer/);
  assert.equal(previews[0].slide.querySelector('img').src, 'blob:preview');
  assert.match(fab.outMsg, /DOM render/, 'the shared result line names the fidelity');
  previews[0].options.actions[0].onClick();
  assert.equal(downloads[0].filename, 'viewport.png', 'download is an explicit action in the preview');
  previews[0].options.onClose();
  assert.deepEqual(revoked, ['blob:preview'], 'the preview releases its object URL when closed');

  const calls = [];
  let peekDisabled = false;
  window.Peek = {
    enabled: false,
    enable(o) { calls.push(o); this.enabled = true; },
    disable() { peekDisabled = true; this.enabled = false; },
  };
  await fab.runTake('shot-region');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].takeLabel, 'Preview PNG');
  assert.equal(typeof calls[0].onTake, 'function');
  await calls[0].onTake(window.document.body);
  assert.equal(captures.at(-1).o.mode, 'element', 'the picker captures the chosen element');
  assert.equal(previews.at(-1).options.title, 'Selected region');
  assert.equal(peekDisabled, true, 'the picker gets out of the way before the takeover is shown');
});
