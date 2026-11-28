// lib/kits/swipe-deck.js — the header's download button: the takeover covers
// the page a file came from, so the only way to keep the file a deck is
// showing is one the header carries.
//
// What is held: the button exists only when a source is given; setDownload
// swaps and withdraws it per slide, as setLink does; bytes save through an
// object URL clicked with the file's name; and a source that is a function,
// or bytes that are a promise, is awaited on the tap rather than at open.

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/swipe-deck.js'), 'utf8'))();
const sd = window.swipeDeck;
window.Element.prototype.scrollTo = function(){};
window.Element.prototype.scrollIntoView = function(){};

// jsdom has no object URLs and does not navigate, so both are recorded.
const made = [], clicks = [];
window.URL.createObjectURL = (blob) => { made.push(blob); return `blob:test/${made.length}`; };
window.URL.revokeObjectURL = () => {};
window.HTMLAnchorElement.prototype.click = function () {
  clicks.push({ href: this.getAttribute('href'), download: this.getAttribute('download'),
                target: this.target, attached: this.isConnected });
};

// The kit holds each object URL for a minute; closing the window clears that
// timer so the run does not wait it out.
after(() => window.close());

const tick = (n = 1) => new Promise(r => setTimeout(r, n * 10));
const btnOf = (h) => h.el.querySelector('.sd-header .ph-download-simple, .sd-header .loading, .sd-header .ph-warning-circle')?.closest('button');
const shown = (b) => !!b && b.style.display !== 'none';
const reset = () => { made.length = 0; clicks.length = 0; };

test('no download option, no button; given one, a button named for the file', async () => {
  const bare = sd.open({ count: 2, render: () => {} });
  await tick();
  assert.ok(!shown(btnOf(bare)), 'a deck that offers no file shows no save');
  bare.drop();

  const h = sd.open({ count: 2, render: () => {}, link: { href: 'https://example.test/x' },
                      download: { name: 'Book.xlsm', bytes: new Uint8Array([1, 2]) } });
  await tick();
  const b = btnOf(h);
  assert.ok(shown(b));
  assert.equal(b.getAttribute('aria-label'), 'Download Book.xlsm');
  assert.equal(b.dataset.titleTip, 'Download Book.xlsm');
  const link = h.el.querySelector('.sd-header a[target="_blank"]');
  assert.equal(b.nextElementSibling, link, 'it sits immediately left of the open-elsewhere link');
  h.drop();
});

test('setDownload retargets the button and null withdraws it', async () => {
  const h = sd.open({ count: 3, render: () => {}, download: { name: 'a.pdf', href: '/a.pdf' } });
  await tick();
  const b = btnOf(h);
  assert.equal(b.getAttribute('aria-label'), 'Download a.pdf');
  h.setDownload({ name: 'b.bas', bytes: 'Sub Main()\nEnd Sub', title: 'Save the module' });
  assert.ok(shown(b));
  assert.equal(b.getAttribute('aria-label'), 'Save the module', 'a caller title wins over the default');
  h.setDownload(null);
  assert.ok(!shown(b), 'withdrawn, for a slide with nothing to keep');
  h.setDownload({ name: 'c.txt' });
  assert.ok(!shown(b), 'a name with neither bytes nor an href is nothing to save');
  h.drop();
});

test('bytes save through an object URL, clicked with the file name and the media type', async () => {
  reset();
  const type = 'application/vnd.ms-excel.sheet.macroEnabled.12';
  const h = sd.open({ count: 1, render: () => {},
                      download: { name: 'Book.xlsm', type, bytes: new Uint8Array([80, 75, 3, 4]) } });
  await tick();
  btnOf(h).click();
  await tick();
  assert.equal(made.length, 1);
  assert.equal(made[0].type, type.toLowerCase(), 'a Blob lowercases its type, per the File API');
  assert.equal(made[0].size, 4);
  assert.equal(clicks.length, 1);
  assert.deepEqual(clicks[0], { href: 'blob:test/1', download: 'Book.xlsm', target: '', attached: true });
  assert.equal(window.document.querySelectorAll('body > a').length, 0, 'the anchor leaves with its click');
  h.drop();
});

test('an href alone is followed with download set, in a new tab for the cross-origin case', async () => {
  reset();
  const h = sd.open({ count: 1, render: () => {}, download: { name: 'r.pdf', href: 'https://example.test/r.pdf' } });
  await tick();
  btnOf(h).click();
  await tick();
  assert.equal(made.length, 0, 'nothing to wrap');
  assert.deepEqual(clicks[0], { href: 'https://example.test/r.pdf', download: 'r.pdf', target: '_blank', attached: true });
  h.drop();
});

test('a function source is awaited on the tap and handed the core handle', async () => {
  reset();
  let calls = 0, got = null, release;
  const gate = new Promise(r => { release = r; });
  const h = sd.open({ count: 3, start: 0, render: () => {},
    download: async (deck) => { calls++; got = deck; await gate;
                                return { name: `slide-${deck.active() + 1}.txt`, bytes: new window.Blob(['hi'], { type: 'text/plain' }) }; } });
  await tick();
  const b = btnOf(h);
  assert.equal(b.getAttribute('aria-label'), 'Download', 'no name to give until the source resolves');
  assert.equal(calls, 0, 'nothing is read at open');
  b.click();
  await tick();
  assert.equal(calls, 1);
  assert.ok(b.querySelector('.loading'), 'the button spins while the source is pending');
  b.click();
  await tick();
  assert.equal(calls, 1, 'a second tap while one is pending does not start another');
  assert.equal(clicks.length, 0);
  release();
  await tick();
  assert.equal(typeof got.active, 'function');
  assert.equal(clicks.length, 1);
  assert.equal(clicks[0].download, 'slide-1.txt');
  assert.equal(made[0].type, 'text/plain', 'a typed Blob keeps its own type');
  assert.ok(b.querySelector('.ph-download-simple'), 'and the glyph comes back');
  h.drop();
});

test('lazy bytes behind a known name: the title is ready at open, the bytes are read on the tap', async () => {
  reset();
  let read = 0;
  const h = sd.open({ count: 1, render: () => {},
    download: { name: 'Mod.bas', type: 'text/plain', bytes: () => { read++; return Promise.resolve('Attribute VB_Name = "Mod"'); } } });
  await tick();
  assert.equal(btnOf(h).getAttribute('aria-label'), 'Download Mod.bas');
  assert.equal(read, 0);
  btnOf(h).click();
  await tick();
  assert.equal(read, 1);
  assert.equal(clicks[0].download, 'Mod.bas');
  assert.equal(made[0].type, 'text/plain');
  h.drop();
});

test('a failed read says so on the button rather than throwing into the page', async () => {
  reset();
  const h = sd.open({ count: 1, render: () => {},
    download: { name: 'x.xlsm', bytes: () => Promise.reject(new Error('404')) } });
  await tick();
  const b = btnOf(h);
  b.click();
  await tick();
  assert.equal(clicks.length, 0);
  assert.ok(b.querySelector('.ph-warning-circle'));
  assert.match(b.dataset.titleTip, /Download failed: 404/);
  h.drop();
});
