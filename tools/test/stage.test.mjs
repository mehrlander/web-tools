// alpineComponents/stage.js — logic-level tests for the stager: the repo-first
// "Copy to repo" destination picker (destRoots / onDestPicked) and the folding
// of dropped local files into the one stage (a local item beside refs, both
// flowing through the one send/save/mint). Driven directly against a fake
// browser store; no network, no real files, no picker pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const calls = [];

// A GH stand-in: srcGh builds `new base.constructor(...)`, so the methods must
// live on the class. copyTo (refs), save/saveBytes (local bytes), get (reads).
class FakeGH {
  constructor(conf = {}) { this.token = conf.token || ''; this.repo = conf.repo || ''; this.ref = 'main'; }
  async get(path) { return { text: 'CONTENT ' + this.repo + ':' + path, sha: 'x' }; }
  async copyTo(dest, paths) { calls.push({ kind: 'copyTo', from: this.repo, dest, paths }); return paths.map(p => ({ path: p, status: 'ok' })); }
  async save(path, value, msg) { calls.push({ kind: 'save', repo: this.repo, path, value, msg }); return { content: { sha: 'x' } }; }
  async saveBytes(path, bytes, msg) { calls.push({ kind: 'saveBytes', repo: this.repo, path, bytes, msg }); return { content: { sha: 'x' } }; }
}

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="st" x-data="stager()"></div>
  </body></html>`,
});

// alpine-bundle.js defines the browser store; the stager composes dropZone and
// (lazily) mention, so both must be registered before it mounts.
const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/alpineComponents/drop-zone.js',
  'lib/alpineComponents/mention.js',
  'lib/alpineComponents/stage.js',
]);

const data = Alpine.$data(window.document.getElementById('st'));
const store = Alpine.store('browser');
store.gh = new FakeGH({ token: 't', repo: 'me/open' });
const plain_ = (v) => JSON.parse(JSON.stringify(v));
const reset = () => { store.stage = []; };

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
  assert.ok(data.description.length > 0);
});

// ---- the destination picker (repo-first) --------------------------------

test('destRoots leads with the open repo, then configured targets, deduped', () => {
  store.repo = 'me/open';
  store.config = { stage: { targets: ['me/dest:pkg', 'me/open:vendor', 'other/lib@dev:src'] } };
  assert.deepEqual(plain_(data.destRoots()), [
    { repo: 'me/open', ref: '' },
    { repo: 'me/dest', ref: '' },
    { repo: 'other/lib', ref: 'dev' },
  ]);
});

test('destRoots without configured targets is just the open repo', () => {
  store.repo = 'me/open';
  store.config = null;
  assert.deepEqual(plain_(data.destRoots()), [{ repo: 'me/open', ref: '' }]);
});

test('onDestPicked writes owner/repo:dir from the picked file folder', () => {
  data.destBrowsing = true;
  data.onDestPicked({ repo: 'me/dest', ref: '', path: 'src/lib/index.js' });
  assert.equal(data.destSpec, 'me/dest:src/lib');
  assert.equal(data.destBrowsing, false);
});

test('a repo-root file yields a bare owner/repo (no dir = root)', () => {
  data.onDestPicked({ repo: 'me/dest', ref: '', path: 'README.md' });
  assert.equal(data.destSpec, 'me/dest');
});

test('a picked ref is carried into the destSpec', () => {
  data.onDestPicked({ repo: 'other/lib', ref: 'dev', path: 'src/a.js' });
  assert.equal(data.destSpec, 'other/lib@dev:src');
});

// ---- folding dropped local files into the stage -------------------------

test('a dropped file becomes a local stage item holding its bytes', () => {
  reset();
  data.onDropped({ file: {}, name: 'logo.png', size: 3, type: 'image/png', bytes: new Uint8Array([1, 2, 3]), buf: new ArrayBuffer(3) });
  assert.equal(data.localItems.length, 1);
  assert.equal(data.refItems.length, 0);
  const it = data.localItems[0];
  assert.equal(it.local, true);
  assert.equal(it.name, 'logo.png');
  assert.equal(it.isText, false);
  assert.equal(it.bytes[0], 1);
});

test('pasted text that reads as refs stages those refs, not a text file', () => {
  reset();
  data.onDropped({ text: 'me/a:lib/x.js\nme/b@dev:docs/y.md', size: 30, type: 'text/plain' });
  assert.equal(data.localItems.length, 0);
  assert.deepEqual(plain_(data.refItems), [
    { repo: 'me/a', ref: '', path: 'lib/x.js' },
    { repo: 'me/b', ref: 'dev', path: 'docs/y.md' },
  ]);
});

test('pasted prose is held as a local text item', () => {
  reset();
  data.onDropped({ text: 'just some notes, not a ref', size: 26, type: 'text/plain' });
  assert.equal(data.localItems.length, 1);
  assert.equal(data.localItems[0].isText, true);
  assert.equal(data.localItems[0].text, 'just some notes, not a ref');
  assert.equal(data.localItems[0].name, 'pasted.txt');
});

test('groups covers only refs; local items render on their own', () => {
  reset();
  store.stage = [
    { repo: 'me/a', ref: '', path: 'x.js' },
    { local: true, id: 91, name: 'n.txt', path: 'n.txt', size: 2, isText: true, text: 'hi' },
  ];
  assert.equal(data.groups.length, 1);
  assert.equal(data.groups[0].key, 'me/a');
  assert.equal(data.localItems.length, 1);
});

// ---- one deposit: refs via copyTo, local bytes via saveBytes/save --------

test('send deposits refs through copyTo and local files through save/saveBytes', async () => {
  reset();
  calls.length = 0;
  store.stage = [
    { repo: 'me/a', ref: '', path: 'lib/x.js' },
    { local: true, id: 92, name: 'a.bin', path: 'a.bin', size: 2, isText: false, bytes: new Uint8Array([9, 9]) },
    { local: true, id: 93, name: 'note.txt', path: 'note.txt', size: 2, isText: true, text: 'yo' },
  ];
  data.destSpec = 'me/dest:pkg';

  await data.send();               // first tap arms
  assert.equal(calls.length, 0, 'arming writes nothing');
  await data.send();               // second tap deposits

  const copy = calls.find(c => c.kind === 'copyTo');
  assert.equal(copy.from, 'me/a');
  assert.equal(copy.dest.repo, 'me/dest');
  assert.equal(copy.dest.dir, 'pkg');
  assert.deepEqual(plain_(copy.paths), ['lib/x.js']);

  const bin = calls.find(c => c.kind === 'saveBytes');
  assert.equal(bin.repo, 'me/dest');
  assert.equal(bin.path, 'pkg/a.bin');
  assert.equal(bin.bytes[0], 9);

  const txt = calls.find(c => c.kind === 'save' && c.path === 'pkg/note.txt');
  assert.equal(txt.repo, 'me/dest');
  assert.equal(txt.value, 'yo');
});

test('an empty dir deposits local files at the repo root', async () => {
  reset();
  calls.length = 0;
  store.stage = [{ local: true, id: 94, name: 'top.txt', path: 'top.txt', size: 1, isText: true, text: 'x' }];
  data.destSpec = 'me/dest';
  await data.send();               // arm
  await data.send();               // deposit
  const txt = calls.find(c => c.kind === 'save');
  assert.equal(txt.path, 'top.txt', 'no dir prefix at root');
});

test('copyLink refuses a link when only local files are staged', () => {
  reset();
  store.stage = [{ local: true, id: 95, name: 'x', path: 'x', size: 1, isText: true, text: '' }];
  data.linkCopied = false;
  data.copyLink();
  assert.equal(data.linkCopied, false, 'no link minted from local-only stage');
});

test('save writes only the ref items to .show-repo.json', async () => {
  reset();
  calls.length = 0;
  store.repo = 'me/open';
  store.stage = [
    { repo: 'me/open', ref: '', path: 'lib/a.js' },
    { local: true, id: 96, name: 'd.bin', path: 'd.bin', size: 1, isText: false, bytes: new Uint8Array([1]) },
  ];
  await data.save();
  const cfgSave = calls.find(c => c.kind === 'save' && c.path === '.show-repo.json');
  assert.deepEqual(plain_(cfgSave.value.stage.files), ['lib/a.js']);
});
