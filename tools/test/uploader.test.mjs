// alpineComponents/uploader.js — logic-level tests with real Alpine under
// jsdom. The uploader composes dropZone + a bare mention picker and adds the
// commit; these tests drive the held-file/destination logic and the two-tap
// commit against a fake browser store (recording gh.save / gh.saveBytes),
// without real files, network, or the nested pickers' pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="up" x-data="uploader()"></div>
  </body></html>`,
});

const Alpine = await startAlpine(window, [
  'lib/alpineComponents/drop-zone.js',
  'lib/alpineComponents/mention.js',
  'lib/alpineComponents/uploader.js',
]);

const calls = [];
Alpine.store('toast', () => {});
Alpine.store('browser', {
  path: '',
  repo: 'me/proj',
  gh: {
    req: async () => ({ tree: [], truncated: false }),
    save: async (p, v, m) => { calls.push({ kind: 'save', p, v, m }); return { content: { sha: 'x' } }; },
    saveBytes: async (p, b, m) => { calls.push({ kind: 'saveBytes', p, bytes: b, m }); return { content: { sha: 'x' } }; },
  },
});

const up = window.document.getElementById('up');
const data = Alpine.$data(up);
const fileDetail = (name, bytes, type = '') => ({
  file: {}, name, size: bytes.length, type, bytes: new Uint8Array(bytes), buf: new Uint8Array(bytes).buffer,
});

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
  assert.ok(data.description.length > 0);
});

test('a dropped file becomes pending; destPath seeds from the filename', () => {
  Alpine.store('browser').path = '';
  data.onDropped(fileDetail('notes.md', [1, 2, 3], 'text/markdown'));
  assert.equal(data.pending.name, 'notes.md');
  assert.equal(data.pending.isText, false);
  assert.equal(data.destPath, 'notes.md');
});

test('the explorer folder prefixes the seeded destination', () => {
  Alpine.store('browser').path = 'lib/alpineComponents';
  data.onDropped(fileDetail('drop-zone.js', [9], 'text/javascript'));
  assert.equal(data.destPath, 'lib/alpineComponents/drop-zone.js');
});

test('pasted text becomes a text-kind pending with a fallback name', () => {
  Alpine.store('browser').path = 'docs';
  data.onDropped({ text: 'owner/repo:lib/x.js', size: 19, type: 'text/plain' });
  assert.equal(data.pending.isText, true);
  assert.equal(data.pending.text, 'owner/repo:lib/x.js');
  assert.equal(data.destPath, 'docs/pasted.txt');
});

test('picking a tree path keeps the filename, adopts the folder', () => {
  Alpine.store('browser').path = '';
  data.onDropped(fileDetail('logo.png', [1], 'image/png'));
  // onPathPicked is what the mention picker's event triggers; call it directly
  // (mounting the picker isn't needed to exercise the path derivation).
  data.onPathPicked({ repo: 'me/proj', ref: '', path: 'assets/icons/star.svg' });
  assert.equal(data.destPath, 'assets/icons/logo.png');
  assert.equal(data.browsing, false);
});

test('commit is two-tap: first arms, no write; second writes bytes via saveBytes', async () => {
  calls.length = 0;
  Alpine.store('browser').path = '';
  data.onDropped(fileDetail('a.bin', [0xde, 0xad], 'application/octet-stream'));
  data.destPath = 'bin/a.bin';

  await data.commit();
  assert.equal(data.armed, true);
  assert.equal(calls.length, 0, 'first tap only arms');

  await data.commit();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, 'saveBytes');
  assert.equal(calls[0].p, 'bin/a.bin');
  assert.equal(calls[0].bytes[0], 0xde);
  assert.equal(data.pending, null, 'cleared after a successful commit');
});

test('text pending commits through save (not saveBytes)', async () => {
  calls.length = 0;
  Alpine.store('browser').path = '';
  data.onDropped({ text: 'hello', size: 5, type: 'text/plain' });
  data.destPath = 'notes/hello.txt';
  await data.commit();          // arm
  await data.commit();          // write
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, 'save');
  assert.equal(calls[0].v, 'hello');
});

test('a folder-only destination is refused (needs a filename)', async () => {
  calls.length = 0;
  data.onDropped(fileDetail('x.json', [1], 'application/json'));
  data.destPath = 'lib/';
  await data.commit();          // would-arm, but the trailing slash is caught first
  await data.commit();
  assert.equal(calls.length, 0, 'never writes to a folder path');
});
