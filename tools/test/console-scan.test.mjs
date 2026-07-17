// console/mods/scan.js — the durable-capture mod, driven under jsdom against
// fake-indexeddb. scan touches globals jsdom doesn't ship (indexedDB,
// Compression/DecompressionStream) and one it does with a different realm
// (Blob/Response); boot() points all of them at the Node globals so the mod's
// bare references resolve same-realm and gzip pipes cleanly. Lives apart from
// console-suite.test.mjs because `fake-indexeddb/auto` patches the whole
// process — the artifact pin and manifest check stay in that file.

import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow } from './bootstrap.mjs';
import { assemble } from '../build/console-suite.mjs';

// A fresh db name per boot so tests don't share a store; suite loaded after the
// IDB/stream globals are wired onto the window.
let dbn = 0;
const boot = (html = '<!doctype html><html><head></head><body></body></html>') => {
  const { window } = makeWindow({ html });
  for (const k of ['indexedDB', 'IDBKeyRange', 'CompressionStream', 'DecompressionStream', 'Blob', 'Response', 'btoa', 'atob'])
    window[k] = globalThis[k];
  window.eval(assemble());
  window.glom.scan.db(`scan-test-${++dbn}`);
  return window;
};
const tick = async (n = 2) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)); };

const feed = (w, n, tag = 'article') => {
  const el = w.document.createElement(tag);
  el.textContent = `msg ${n}`;
  w.document.body.append(el);
  return el;
};

test('tick: persists fresh records and dedups by key across passes', async () => {
  const w = boot();
  feed(w, 1); feed(w, 2);
  await w.glom.scan.define('msgs', { selector: 'article', format: el => ({ key: el.textContent, text: el.textContent }) });

  assert.equal(await w.glom.scan.tick(), 2);       // both new
  assert.equal(await w.glom.scan.tick(), 0);       // nothing fresh the second pass
  feed(w, 3);
  assert.equal(await w.glom.scan.tick(), 1);       // only the new one
  assert.deepEqual([...w.glom.scan.data('msgs')].map(r => r.text), ['msg 1', 'msg 2', 'msg 3']);
});

test('durability: a second session hydrates the records the first persisted', async () => {
  const w1 = boot();
  feed(w1, 1); feed(w1, 2);
  await w1.glom.scan.define('msgs', { selector: 'article', format: el => ({ key: el.textContent, text: el.textContent }) });
  await w1.glom.scan.tick();
  const name = w1.glom.scan.db();

  const w2 = boot();                               // fresh window, same fake-idb process
  w2.glom.scan.db(name);
  await w2.glom.scan.define('msgs', { selector: 'article', format: el => ({ key: el.textContent, text: el.textContent }) });
  assert.deepEqual([...w2.glom.scan.data('msgs')].map(r => r.text).sort(), ['msg 1', 'msg 2']);
});

test('compress: content is gzipped in the store and decompressed on hydrate', async () => {
  const w1 = boot();
  const el = w1.document.createElement('article');
  el.innerHTML = '<p>hello world</p>'.repeat(20);
  w1.document.body.append(el);
  const fmt = e => ({ key: 'only', content: e.innerHTML });
  await w1.glom.scan.define('c', { selector: 'article', compress: true, field: 'content', format: fmt });
  await w1.glom.scan.tick();

  // gzip round-trips through the exposed codec
  const packed = await w1.glom.scan.gzip.compress('payload');
  assert.notEqual(packed, 'payload');
  assert.equal(await w1.glom.scan.gzip.decompress(packed), 'payload');

  const name = w1.glom.scan.db();
  const w2 = boot();
  w2.glom.scan.db(name);
  await w2.glom.scan.define('c', { selector: 'article', compress: true, field: 'content', format: fmt });
  assert.equal(w2.glom.scan.data('c')[0].content, '<p>hello world</p>'.repeat(20)); // came back intact
});

test('sweep: scroll reveals more rows and capture accumulates until dry', async () => {
  const w = boot();
  feed(w, 1); feed(w, 2);
  await w.glom.scan.define('msgs', { selector: 'article', format: el => ({ key: el.textContent, text: el.textContent }) });
  let n = 2;
  const scroll = () => { if (n < 6) { feed(w, ++n); feed(w, ++n); } };
  const got = await w.glom.scan.sweep({ scroll, settle: 1, dry: 2 });
  assert.equal(got, 6);
  assert.equal(w.glom.scan.data('msgs').length, 6);
});

test('watch: DOM churn triggers a capture pass (debounced)', async () => {
  const w = boot();
  feed(w, 1);
  await w.glom.scan.define('msgs', { selector: 'article', format: el => ({ key: el.textContent, text: el.textContent }) });
  w.glom.scan.watch({ settle: 5 });
  await tick();
  assert.equal(w.glom.scan.data('msgs').length, 1);   // initial pass
  feed(w, 2);
  await new Promise(r => setTimeout(r, 40));
  assert.equal(w.glom.scan.data('msgs').length, 2);   // churn healed
  w.glom.scan.stop();
  feed(w, 3);
  await new Promise(r => setTimeout(r, 40));
  assert.equal(w.glom.scan.data('msgs').length, 2);   // disarmed
});

test('join: two streams merge, unmatched tail on; search + clear(term) prune', async () => {
  const w = boot();
  await w.glom.scan.define('caps', { selector: 'nav a', format: a => ({ key: a.getAttribute('href'), caption: a.textContent }) });
  await w.glom.scan.define('cons', { selector: 'section', format: s => ({ key: s.id, body: s.textContent }) });
  const nav = w.document.createElement('nav');
  nav.innerHTML = '<a href="/x">X</a><a href="/y">Y</a>';
  const sx = w.document.createElement('section'); sx.id = '/x/full'; sx.textContent = 'body of x';
  w.document.body.append(nav, sx);
  await w.glom.scan.tick();

  const rows = w.glom.scan.join('caps', 'cons');       // default rel: content key contains caption key
  assert.equal(rows.length, 2);                        // X joins /x/full, Y unmatched
  assert.equal(rows.find(r => r.a?.key === '/x').joined, true);
  assert.equal(rows.find(r => r.a?.key === '/y').joined, false);

  assert.equal(w.glom.scan.search('body', 'cons').cons.length, 1);
  await w.glom.scan.clear('caps', 'X');                // drop the X caption only
  assert.deepEqual([...w.glom.scan.data('caps')].map(r => r.key), ['/y']);
});

test('set-seeding: a bare define() infers the selector and snapshots the set', async () => {
  const w = boot('<!doctype html><html><body><main></main></body></html>');
  const main = w.document.querySelector('main');
  for (const n of [1, 2, 3]) { const a = w.document.createElement('article'); a.textContent = `msg ${n}`; main.append(a); }
  w.glom(w.q('article'));                              // dance to a set first
  await w.glom.scan.define('rows');                    // no selector, no format
  assert.equal(await w.glom.scan.tick(), 3);           // snapshot captured all three
  const rec = w.glom.scan.data('rows')[0];
  assert.equal(rec.text, 'msg 1');                     // default snapshot: text + html + key
  assert.ok(rec.html.includes('<article'));
});

test('grab: adopts a stream\'s still-present elements back into the working set', async () => {
  const w = boot();
  const a = feed(w, 1), b = feed(w, 2);
  await w.glom.scan.define('msgs', { selector: 'article', format: el => ({ key: el.textContent, text: el.textContent }) });
  await w.glom.scan.tick();
  w.glom.clear();
  assert.equal(w.glom.get().length, 0);
  const got = w.glom.scan.grab('msgs');
  assert.equal(got.length, 2);
  assert.deepEqual([...got], [a, b]);                  // the live captured elements, in document order
  assert.equal(w.document.querySelectorAll('[data-glom]').length, 2);
});

test('highlight: outlines only the elements on record', async () => {
  const w = boot();
  const a = feed(w, 1), b = feed(w, 2);
  await w.glom.scan.define('msgs', { selector: 'article', format: el => ({ key: el.textContent }) });
  await w.glom.scan.tick();
  feed(w, 3);                                          // present but not yet captured
  w.glom.scan.highlight();
  assert.equal(a.getAttribute('data-scan'), 'msgs');
  assert.equal(b.getAttribute('data-scan'), 'msgs');
  assert.equal(w.document.querySelectorAll('article[data-scan]').length, 2); // the third isn't outlined
});
