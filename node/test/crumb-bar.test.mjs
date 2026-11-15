// alpineComponents/crumb-bar.js — the header crumb trail, driven by the real
// Alpine runtime under jsdom. The component's header states three things a
// host relies on, and each is a test here: the trail is re-read from the host
// on every render, a menu crumb's open state is the component's own and its
// action hears each change, and tapping any other crumb closes the menu.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <nav id="bar" x-data="crumbBar({ items: () => window.trail })"></nav>
  </body></html>`,
});

const heard = [];
window.trail = [
  { key: 'home', icon: 'ph-house', title: 'Home', action: (open) => heard.push(['home', open]) },
  { key: 'repo', label: 'web-tools', mono: true, menu: true, action: (open) => heard.push(['repo', open]) },
  { key: 'here', label: 'docs' },
];

const Alpine = await startAlpine(window, ['lib/alpineComponents/crumb-bar.js']);
const bar = window.document.getElementById('bar');
const data = Alpine.$data(bar);
await tick();
const buttons = () => [...bar.querySelectorAll('button')];

test('mounts with no startup warnings or errors', () => {
  assert.deepEqual(problems, []);
  assert.ok(data.description.length > 0);
});

test('draws one crumb per item, and marks the last as the current page', () => {
  const b = buttons();
  assert.equal(b.length, 3);
  assert.deepEqual(b.map(x => x.getAttribute('aria-current')), [null, null, 'page']);
  assert.equal(b[1].querySelector('span').textContent, 'web-tools');
});

test('a crumb with no action takes no taps', () => {
  assert.match(buttons()[2].className, /pointer-events-none/);
  assert.doesNotMatch(buttons()[0].className, /pointer-events-none/);
});

test('a menu crumb toggles the open state it owns, and its action hears each change', async () => {
  heard.length = 0;
  buttons()[1].click();
  await tick();
  assert.equal(data.open, true);
  buttons()[1].click();
  await tick();
  assert.equal(data.open, false);
  assert.deepEqual(heard, [['repo', true], ['repo', false]]);
});

test('tapping a crumb that is not the menu closes the menu', async () => {
  heard.length = 0;
  buttons()[1].click();
  await tick();
  assert.equal(data.open, true);
  buttons()[0].click();
  await tick();
  assert.equal(data.open, false);
  assert.deepEqual(heard, [['repo', true], ['home', false]]);
});

test('the host can put the caret down through the published instance', async () => {
  buttons()[1].click();
  await tick();
  assert.equal(bar.__crumbBar.open, true);
  bar.__crumbBar.setOpen(false);
  await tick();
  assert.equal(data.open, false);
});

test('the trail is read from the host each time, never cached at init', () => {
  window.trail = [window.trail[0], { key: 'only', label: 'home' }];
  assert.equal(data.list.length, 2);
  assert.equal(data.list[1].label, 'home');
  window.trail = 'not a list';
  assert.equal(data.list.length, 0, 'anything but an array reads as an empty trail');
});
