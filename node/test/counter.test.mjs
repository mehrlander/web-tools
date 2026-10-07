// alpineComponents/counter.js — the minimal demo component, driven by the
// real Alpine runtime under jsdom. Doubles as the smallest working example
// of the bootstrap's makeWindow + startAlpine.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="c" x-data="counter">
      <span id="n" x-text="count"></span>
      <button id="plus" @click="inc()"></button>
    </div>
  </body></html>`,
});

const Alpine = await startAlpine(window, ['lib/alpineComponents/counter.js']);
const el = window.document.getElementById('c');
const data = Alpine.$data(el);

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
});

test('renders count reactively and exposes a description', async () => {
  assert.equal(window.document.getElementById('n').textContent, '0');
  data.inc();
  await tick();
  assert.equal(window.document.getElementById('n').textContent, '1');
  assert.ok(data.description.length > 0);
});

test('@click wiring drives inc()', async () => {
  const before = data.count;
  window.document.getElementById('plus').click();
  await tick();
  assert.equal(data.count, before + 1);
});

test('dec and reset', async () => {
  data.reset();
  data.dec();
  await tick();
  assert.equal(data.count, -1);
  assert.equal(window.document.getElementById('n').textContent, '-1');
  data.reset();
  await tick();
  assert.equal(window.document.getElementById('n').textContent, '0');
});
