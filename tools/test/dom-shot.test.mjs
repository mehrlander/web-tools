// kits/dom-shot.js - scope geometry, fidelity warnings, and output scaling.
// The renderer itself is upstream browser code. Stub it here so the test pins
// the options and the kit's contract without pretending jsdom paints pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const boot = () => {
  const { window } = makeWindow({ html: `<!doctype html><html><head><title>Shot Test</title></head><body>
    <main id="subject"><img src="https://elsewhere.example/image.png"><canvas></canvas></main>
    <aside data-dom-shot-ignore>controls</aside>
  </body></html>` });
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
  Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
  Object.defineProperty(window, 'scrollX', { value: 0, configurable: true });
  Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });
  Object.defineProperty(window.document.documentElement, 'scrollWidth', { value: 390, configurable: true });
  Object.defineProperty(window.document.documentElement, 'scrollHeight', { value: 12000, configurable: true });
  window.document.getElementById('subject').getBoundingClientRect = () => ({
    left: 0, top: -120, right: 390, bottom: 880, width: 390, height: 1000,
  });
  window.HTMLCanvasElement.prototype.getContext = () => ({
    fillStyle: '', fillRect() {}, drawImage() {},
  });
  window.HTMLCanvasElement.prototype.toBlob = callback => {
    callback(new window.Blob(['png'], { type: 'image/png' }));
  };
  const calls = [];
  window.modernScreenshot = {
    domToCanvas: async (node, options) => {
      calls.push({ node, options });
      return {
      width: Math.round((options.width || 120) * options.scale),
      height: Math.round((options.height || 80) * options.scale),
      toBlob: callback => callback(new window.Blob(['png'], { type: 'image/png' })),
      };
    },
  };
  window.eval(readFileSync(path.join(repoRoot, 'lib/kits/dom-shot.js'), 'utf8'));
  return { window, calls };
};

test('viewport capture composes visible body children at the visible dimensions', async () => {
  const { window, calls } = boot();
  const r = await window.DomShot.capture(window.document.documentElement, { mode: 'viewport' });
  assert.equal(calls.length, 1);
  const o = calls[0].options;
  assert.equal(calls[0].node, window.document.getElementById('subject'));
  assert.deepEqual([r.cssWidth, r.cssHeight], [390, 844]);
  assert.deepEqual([r.width, r.height], [1170, 2532]);
  assert.equal('style' in o, false);
  assert.ok(o.scale <= 3 && o.scale > 0);
  assert.equal(r.mode, 'viewport');
  assert.equal(r.renderer, 'modern-screenshot 4.7.0');
});

test('full-page capture downscales a long phone page and reports likely omissions', async () => {
  const { window, calls } = boot();
  Object.defineProperty(window.navigator, 'userAgent', { value: 'iPhone', configurable: true });
  const r = await window.DomShot.capture(window.document.documentElement, { mode: 'page' });
  const o = calls[0].options;
  assert.deepEqual([r.cssWidth, r.cssHeight], [390, 12000]);
  assert.ok(o.scale < 3, 'the output is reduced below device scale to stay under the iOS canvas cap');
  assert.ok(r.warnings.some(w => /cross-origin image/.test(w)));
  assert.ok(r.warnings.some(w => /canvas/.test(w)));
  assert.ok(r.warnings.some(w => /downscaled/.test(w)));
  assert.equal(o.filter(window.document.querySelector('[data-dom-shot-ignore]')), false);
});

test('element capture lets the renderer measure the picked node', async () => {
  const { window, calls } = boot();
  const node = window.document.getElementById('subject');
  const r = await window.DomShot.capture(node, { mode: 'element', scale: 1 });
  assert.equal(calls[0].node, node);
  assert.equal(calls[0].options.style.margin, '0');
  assert.equal('width' in calls[0].options, false);
  assert.equal(r.mode, 'element');
  assert.match(window.DomShot.filename(node, 'element'), /^shot-test-element-.*\.png$/);
});
