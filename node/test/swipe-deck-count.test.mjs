// kits/swipe-deck.js — the header's n / m count. It shows at every width on a
// deck of two or more (owner, 2026-11-07: a phone reader had no count where
// they look), and not at all on a deck of one, where "1 / 1" is no position.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/swipe-deck.js'), 'utf8'))();
window.Element.prototype.scrollTo = function(){};
window.Element.prototype.scrollIntoView = function(){};

const count = () => window.document.body.querySelector('.sd-overlay [data-sd-count]');
const open = (n) => window.swipeDeck.open({ count: n, title: 'a.md', render: (i, el) => { el.textContent = 'slide ' + i; } });

test('a deck of several shows its count at every width', () => {
  const d = open(4);
  const el = count();
  assert.ok(el, 'the header has a count');
  assert.equal(el.textContent.replace(/\s/g, ''), '1/4');
  assert.ok(!el.classList.contains('hidden'), 'not hidden on a phone');
  assert.ok(![...el.classList].some((c) => /^(sm|md|lg):/.test(c)), 'no breakpoint gates it');
  d.drop();
});

test('a deck of one shows no count', () => {
  const d = open(1);
  assert.ok(count().classList.contains('hidden'));
  d.drop();
});
