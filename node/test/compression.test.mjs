// kits/compression.js — gzip via Node's own CompressionStream, brotli and
// acorn via the npm-vendored copies (KIT_IMPORTS in the bootstrap). DOMParser
// (used by text.fromDataUrl on text/html bodies) comes from jsdom.

import test from 'node:test';
import assert from 'node:assert/strict';
import jsdomPkg from 'jsdom';
import { loadKit } from './bootstrap.mjs';

const { JSDOM } = jsdomPkg;
globalThis.DOMParser = new JSDOM('').window.DOMParser;

const { compression } = loadKit('compression');
const { brotli, gzip, acorn, text } = compression;

// ---- gzip ------------------------------------------------------------

test('gzip round-trips, with the GZ64: prefix protocol', async () => {
  const payload = 'hello world '.repeat(20) + '— ünïcode ✓ 🎉';
  const packed = await gzip(payload);
  assert.ok(packed.startsWith('GZ64:'));
  assert.equal(await gzip.decompress(packed), payload);
});

test('gzip labels ride in the prefix and surface via detect', async () => {
  const packed = await gzip.compress('content', 'my label');
  assert.ok(packed.startsWith('GZ64("my label"):'));
  assert.deepEqual(gzip.detect(packed),
    { alg: 'gzip', label: 'my label', prefixLen: 'GZ64("my label"):'.length });
  assert.equal(await gzip.decompress(packed), 'content');
});

test('gzip raw variants emit/consume bare base64; sizeOf reports byte length', async () => {
  const b64 = await gzip.compressRaw('abc abc abc');
  assert.doesNotMatch(b64, /^GZ64/);
  assert.equal(await gzip.decompressRaw(b64), 'abc abc abc');
  assert.equal(await gzip.sizeOf('abc abc abc'), atob(b64).length);
});

// ---- brotli (vendored wasm) -------------------------------------------

test('brotli round-trips, with the BR64: prefix protocol', async () => {
  const payload = 'brotli payload '.repeat(10) + 'émoji ✓';
  const packed = await brotli('brotli payload '.repeat(10) + 'émoji ✓', 'tag');
  assert.ok(packed.startsWith('BR64("tag"):'));
  assert.deepEqual(brotli.detect(packed), { alg: 'brotli', label: 'tag', prefixLen: 12 });
  assert.equal(await brotli.decompress(packed), payload);
  assert.equal(await brotli.decompressRaw(await brotli.compressRaw('x y z')), 'x y z');
});

// ---- detection over mixed text ------------------------------------------

test('findCompressedChunks finds labeled + bare chunks of both algs, in order', async () => {
  const gz = await gzip('one', 'g');
  const br = await brotli('two');
  const prose = `Here is one: ${gz} and another: ${br} done.`;
  const chunks = text.findCompressedChunks(prose);
  assert.deepEqual(chunks.map(c => [c.alg, c.label]), [['gzip', 'g'], ['brotli', null]]);
  assert.equal(prose.slice(chunks[0].start, chunks[0].end), chunks[0].text);
  assert.equal(chunks[0].text, gz);
  assert.equal(chunks[1].text, br);
});

test('detectCompressionType: prefix-only, anchored at the string start', async () => {
  assert.equal(text.detectCompressionType('plain text'), null);
  assert.equal(text.detectCompressionType('prose then GZ64:abcd'), null);
  assert.equal((text.detectCompressionType(await gzip('x'))).alg, 'gzip');
  assert.equal((text.detectCompressionType(await brotli('x'))).alg, 'brotli');
});

// ---- acorn (vendored) ----------------------------------------------------

test('acorn.isJS distinguishes JS from not-JS', async () => {
  assert.equal(await acorn.isJS('const x = 1; x + 1'), true);
  assert.equal(await acorn.isJS('<h1>nope</h1>'), false);
});

// ---- data: URLs ----------------------------------------------------------

test('fromDataUrl parses urlencoded and base64 bodies, params, and rejects junk', () => {
  assert.deepEqual(text.fromDataUrl('data:,hello%20world').body, 'hello world');

  const b64 = text.fromDataUrl('data:text/html;charset=utf-8;base64,' +
    btoa(unescape(encodeURIComponent('<p>héllo</p>'))));
  assert.equal(b64.mediaType, 'text/html');
  assert.deepEqual(b64.params, { charset: 'utf-8' });
  assert.equal(b64.body, '<p>héllo</p>');
  assert.equal(b64.seed, null);

  assert.equal(text.fromDataUrl('not a url'), null);
  assert.equal(text.fromDataUrl('data:no-comma'), null);
});

// ---- pack ------------------------------------------------------------

test('pack "none" passes content through', () => {
  const r = text.pack('anything', { packed: 'none' });
  assert.equal(r.output, 'anything');
  assert.deepEqual(r.packingSegments, [{ t: 'payload', v: 'anything' }]);
});

test('pack wraps plain JS as an eager bookmarklet', () => {
  const r = text.pack('alert(1)', { isJavaScript: true });
  assert.equal(r.output, 'javascript:(()=>{alert(1)})()');
});

test('pack wraps plain HTML as a window.open bookmarklet; target picks popup vs tab', () => {
  const popup = text.pack('<h1>x</h1>', { isJavaScript: false }).output;
  assert.ok(popup.startsWith('javascript:'));
  assert.ok(popup.includes("'width=600,height=400'"));
  const tab = text.pack('<h1>x</h1>', { isJavaScript: false, target: 'tab' }).output;
  assert.ok(!tab.includes('width=600'));
});

test('pack embeds a compressed chunk with the matching decompressor', async () => {
  const gz = await gzip('console.log(1)');
  const r = text.pack(gz, { isJavaScript: true }).output;
  assert.ok(r.startsWith('javascript:'));
  assert.ok(r.includes(gz));
  assert.ok(r.includes('DecompressionStream'), 'gzip decompressor inlined');
  assert.ok(r.includes('eval(d)'), 'JS payload executes');
});

test('output is always the concatenation of packingSegments', async () => {
  for (const r of [
    text.pack('plain', { packed: 'none' }),
    text.pack('alert(1)', { isJavaScript: true }),
    text.pack(await gzip('<p>hi</p>'), {}),
    text.pack('<p>hi</p>', { packed: 'data-url' }),
  ]) {
    assert.equal(r.output, r.packingSegments.map(s => s.v).join(''));
  }
});

// ---- assess ⇄ pack round-trips -------------------------------------------

test('assess(pack(gzip(html), data-url)).raw recovers the original html', async () => {
  const html = '<h1>Hello ✓</h1><p>data-url round trip</p>';
  const packed = text.pack(await gzip(html), { packed: 'data-url' });
  const a = await text.assess(packed.output);
  assert.equal(a.raw, html);
  assert.equal(a.isCompressed, true);
  assert.equal(a.compAlg, 'gzip');
  assert.equal(a.wrapper.outer, 'dataUrl');
  assert.equal(a.wrapper.dataUrl.mediaType, 'text/html');
  assert.equal(a.isJavaScript, false);
});

test('assess(pack(plain html, data-url)).raw recovers it too (no inner layer)', async () => {
  const html = '<p>uncompressed</p>';
  const packed = text.pack(html, { packed: 'data-url' });
  const a = await text.assess(packed.output);
  assert.equal(a.raw, html);
  assert.equal(a.isCompressed, false);
  assert.equal(a.wrapper.inner, null);
});

test('assess unwraps a bare brotli chunk and reports sizes', async () => {
  const js = 'const answer = 42; console.log(answer);';
  const a = await text.assess(await brotli(js, 'src'));
  assert.equal(a.raw, js);
  assert.deepEqual(a.wrapper.inner, { alg: 'brotli', label: 'src' });
  assert.equal(a.isJavaScript, true);
  assert.equal(a.sizes.raw, js.length);
  assert.ok(a.sizes.brotli > 0 && a.sizes.gzip > 0);
});

// ---- process (the full pipeline) -----------------------------------------

test('process compresses JS and packs a self-decompressing bookmarklet', async () => {
  const r = await text.process('console.log("hi from process")', { alg: 'gzip' });
  assert.ok(r.output.startsWith('javascript:'));
  assert.ok(r.output.includes('GZ64:'));
  assert.equal(r.isJavaScript, true);
  assert.equal(r.outSize, r.output.length);
});

test('process with compression and packing off is identity', async () => {
  const r = await text.process('plain text in', { compressed: false, packed: 'none' });
  assert.equal(r.output, 'plain text in');
});

test('process re-uses an existing compressed chunk instead of re-wrapping', async () => {
  const gz = await gzip('alert(7)', 'keep');
  const r = await text.process(gz, {});
  assert.ok(r.output.includes(gz), 'original chunk embedded verbatim');
});
