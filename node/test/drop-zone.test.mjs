// alpineComponents/drop-zone.js — logic-level tests with real Alpine under
// jsdom, per the bootstrap recipe. The component self-injects its template and
// hands files to the host by dispatching a bubbling `drop-file` event; these
// tests drive the accept/size gates and the emit path without real files by
// feeding synthetic File-like objects (arrayBuffer() + size + name + type).
// Not covered here (needs real pixels/gestures): drag hover visuals, the
// native paste event, the file dialog.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="host">
      <div id="dz" x-data="dropZone({ accept: '.json,text/plain', maxSize: 1024 })"></div>
    </div>
  </body></html>`,
});

const Alpine = await startAlpine(window, ['lib/alpineComponents/drop-zone.js']);
const dz = window.document.getElementById('dz');
const data = Alpine.$data(dz);

// Capture the bubbling drop-file event at the host, the way a real host page
// listens. `last` holds the most recent detail; reset it per test.
let last = null;
window.document.getElementById('host').addEventListener('drop-file', e => { last = e.detail; });

// A minimal File stand-in: arrayBuffer() plus the fields the gates read.
const fakeFile = (name, bytes, type = '') => ({
  name, type, size: bytes.length,
  arrayBuffer: async () => new Uint8Array(bytes).buffer,
});

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

test('injects the drop area and exposes a description', () => {
  assert.ok(dz.querySelector('[role="button"]'), 'focusable drop area present');
  assert.ok(dz.querySelector('input[type="file"]'), 'hidden browse input present');
  assert.ok(data.description.length > 0);
});

test('config from the factory arg is read', () => {
  assert.equal(data.accept, '.json,text/plain');
  assert.equal(data.maxSize, 1024);
  assert.equal(data.multiple, false);
});

test('matchesAccept: extension, mime, and glob forms', () => {
  assert.equal(data.matchesAccept(fakeFile('a.json', [1])), true);
  assert.equal(data.matchesAccept(fakeFile('a.txt', [1], 'text/plain')), true);
  assert.equal(data.matchesAccept(fakeFile('a.png', [1], 'image/png')), false);
  data.accept = 'image/*';
  assert.equal(data.matchesAccept(fakeFile('a.png', [1], 'image/png')), true);
  data.accept = '.json,text/plain';
});

test('an accepted file emits a drop-file detail with bytes', async () => {
  last = null;
  await data.emitFile(fakeFile('x.json', [0x7b, 0x7d], 'application/json'));
  await tick();
  const d = last;
  assert.ok(d, 'event fired and bubbled to the host');
  assert.equal(d.name, 'x.json');
  assert.equal(d.size, 2);
  assert.equal(d.bytes[0], 0x7b);
  assert.equal(data.statusKind, 'ok');
  assert.equal(data.last.name, 'x.json');
  assert.equal(data.last.size, 2);
});

test('oversize is rejected: no event, error status', async () => {
  last = null;
  const big = fakeFile('big.json', new Array(2048).fill(0x20));
  await data.emitFile(big);
  await tick();
  assert.equal(last, null, 'no drop-file for a rejected file');
  assert.equal(data.statusKind, 'error');
  assert.match(data.status, /limit/);
});

test('wrong type is rejected', async () => {
  last = null;
  await data.emitFile(fakeFile('a.png', [1, 2, 3], 'image/png'));
  await tick();
  assert.equal(last, null);
  assert.equal(data.statusKind, 'error');
});

test('take() honors multiple=false (first file only)', async () => {
  const seen = [];
  window.document.getElementById('host').addEventListener('drop-file', e => seen.push(e.detail.name));
  data.take([fakeFile('one.json', [1]), fakeFile('two.json', [2])]);
  await tick();
  assert.deepEqual(seen, ['one.json']);
});

test('pasted text emits a text payload', async () => {
  last = null;
  const handled = data.emitText('mehrlander/web-tools:lib/x.js');
  await tick();
  assert.equal(handled, true);
  assert.equal(last.text, 'mehrlander/web-tools:lib/x.js');
  assert.equal(last.name, '');
});
