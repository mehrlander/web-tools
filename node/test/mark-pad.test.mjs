// lib/kits/mark-pad.js — the arrows that step through a page's marks.
//
// What a reader relies on: down from no mark is the first and up the last,
// each end holds, the label names the mark in view, a new scope starts again,
// the label switches kinds only where there is one to switch to, and a page
// with nothing to step through shows no pad at all.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { repoRoot } from './bootstrap.mjs';

const SRC = readFileSync(path.join(repoRoot, 'lib/kits/mark-pad.js'), 'utf8');

function pad(o) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const win = {};
  new Function('window', 'document', 'console', SRC)(win, dom.window.document, console);
  const went = [];
  const handle = win.MarkPad.mount({ go: (i, item) => went.push([i, item.label]), ...o });
  const $ = (k) => handle.el.querySelector(`[data-mark-pad="${k}"]`);
  const label = () => $('label').textContent.trim();
  return { handle, went, $, label, doc: dom.window.document };
}
const marks = (n, name = 'mark') => Array.from({ length: n }, (_, i) => ({ label: `${name} ${i + 1} of ${n}` }));

test('the arrows step like arrow keys: down from nothing is the first, up the last, and each end holds', () => {
  const { handle, went, $, label } = pad({ items: () => marks(3) });
  assert.equal(handle.el.hidden, false);
  assert.equal(label(), '3 marks', 'before a step, how many');
  $('down').click();
  assert.deepEqual(went.at(-1), [0, 'mark 1 of 3']);
  assert.equal(label(), 'mark 1 of 3');
  assert.equal($('up').disabled, true, 'the first holds');
  $('down').click(); $('down').click();
  assert.equal(label(), 'mark 3 of 3');
  assert.equal($('down').disabled, true, 'the last holds');
  $('up').click();
  assert.equal(label(), 'mark 2 of 3');
  const fresh = pad({ items: () => marks(3) });
  fresh.$('up').click();
  assert.deepEqual(fresh.went, [[2, 'mark 3 of 3']], 'up from nothing is the last');
});

test('a page with nothing to step through shows no pad, and refresh follows the page', () => {
  let list = [];
  const { handle } = pad({ items: () => list });
  assert.equal(handle.el.hidden, true);
  list = marks(2);
  handle.refresh();
  assert.equal(handle.el.hidden, false);
});

test('a new scope starts again from no mark', () => {
  let scope = 'a';
  const { handle, $, label } = pad({ items: () => marks(4), scope: () => scope });
  $('down').click(); $('down').click();
  assert.equal(handle.at, 1);
  scope = 'b';
  handle.refresh();
  assert.equal(handle.at, -1);
  assert.equal(label(), '4 marks');
});

test('the label changes kind where there is one to change to, and says so', () => {
  let kind = 'marks';
  const kinds = [{ key: 'marks', label: 'the marked passages', icon: 'ph-bookmark-simple' }, { key: 'citations', label: 'the citations', icon: 'ph-paperclip' }];
  const { $, label } = pad({
    items: () => (kind === 'marks' ? marks(2, 'focus') : marks(110, 'citation')),
    kinds: () => kinds, kind: () => kind, choose: (k) => { kind = k; },
    scope: () => kind, idle: (n) => (kind === 'citations' ? `${n} citations` : `${n} marks`),
  });
  assert.equal($('label').disabled, false);
  assert.match($('label').getAttribute('aria-label'), /Step through the citations instead/);
  assert.match($('label').querySelector('i').className, /ph-bookmark-simple/);
  $('label').click();
  assert.equal(kind, 'citations');
  assert.equal(label(), '110 citations');
  $('down').click();
  assert.equal(label(), 'citation 1 of 110');
  const single = pad({ items: () => marks(2) });
  assert.equal(single.$('label').disabled, true, 'one kind: the label is only a label');
});

test('a named pad carries anchors a look link can name', () => {
  const { $ } = pad({ items: () => marks(1), at: 'marks' });
  assert.deepEqual(['up', 'down', 'label'].map((k) => $(k).getAttribute('data-at')), ['marks-up', 'marks-down', 'marks-label']);
});
