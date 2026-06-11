// kits/messaging.js — string-path pub/sub.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKit } from './bootstrap.mjs';

const fresh = () => {
  const errors = [];
  const cons = { ...console, error: (...a) => errors.push(a) };
  const w = loadKit('messaging', { console: cons });
  return { m: w.messaging, errors };
};

test('publish delivers (occasion, data, path) to subscribers', () => {
  const { m } = fresh();
  const seen = [];
  m.subscribe('a.b', (...args) => seen.push(args));
  const delivered = m.publish('a.b', 'change', { x: 1 });
  assert.equal(delivered, 1);
  assert.deepEqual(seen, [['change', { x: 1 }, 'a.b']]);
});

test('publish defaults: occasion "data", data null; no propagation across paths', () => {
  const { m } = fresh();
  const seen = [];
  m.subscribe('a.b', (...args) => seen.push(args));
  m.subscribe('a', () => seen.push('parent should not fire'));
  m.publish('a.b');
  assert.deepEqual(seen, [['data', null, 'a.b']]);
});

test('publish to a path with no subscribers returns 0', () => {
  const { m } = fresh();
  assert.equal(m.publish('nobody.home', 'x', 1), 0);
});

test('the returned off() unsubscribes, and empty paths are dropped', () => {
  const { m } = fresh();
  const off = m.subscribe('p', () => {});
  assert.equal(m.subscriberCount('p'), 1);
  assert.deepEqual(m.activePaths(), ['p']);
  off();
  assert.equal(m.subscriberCount('p'), 0);
  assert.deepEqual(m.activePaths(), []);
  off(); // second call is a no-op
});

test('a throwing subscriber is isolated: others still run, error is logged', () => {
  const { m, errors } = fresh();
  const seen = [];
  m.subscribe('p', () => { throw new Error('boom'); });
  m.subscribe('p', () => seen.push('ok'));
  const delivered = m.publish('p', 'go');
  assert.equal(delivered, 1);        // only the surviving callback counts
  assert.deepEqual(seen, ['ok']);
  assert.equal(errors.length, 1);
  assert.match(String(errors[0][0]), /subscriber on "p" threw/);
});

test('clearPath drops every subscriber for a path', () => {
  const { m } = fresh();
  m.subscribe('p', () => {});
  m.subscribe('p', () => {});
  assert.equal(m.subscriberCount('p'), 2);
  m.clearPath('p');
  assert.equal(m.subscriberCount('p'), 0);
  assert.equal(m.publish('p'), 0);
});

test('argument validation throws', () => {
  const { m } = fresh();
  assert.throws(() => m.subscribe('', () => {}), /non-empty string/);
  assert.throws(() => m.subscribe(42, () => {}), /non-empty string/);
  assert.throws(() => m.subscribe('p', 'not a fn'), /requires a function/);
});
