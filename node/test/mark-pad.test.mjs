// lib/kits/mark-pad.js — the arrows that step through a page's marks.
//
// What a reader relies on: down from no mark is the first and up the last,
// each end holds, the bookmark between the arrows counts the mark in view
// inside itself and says its name, a long count stacks rather than spills, a
// new scope starts again, the bookmark switches kinds only where there is one
// to switch to and shows which, a page with nothing to step through shows no
// pad at all, and a control sharing the corner hears when the pad comes and
// goes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { repoRoot } from './bootstrap.mjs';

const SRC = readFileSync(path.join(repoRoot, 'lib/kits/mark-pad.js'), 'utf8');

function pad(o, win = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  new Function('window', 'document', 'console', SRC)(win, dom.window.document, console);
  const went = [];
  const handle = win.MarkPad.mount({ go: (i, item) => went.push([i, item.label]), ...o });
  const $ = (k) => handle.el.querySelector(`[data-mark-pad="${k}"]`);
  const disc = () => $('mark').querySelector('[data-count]').getAttribute('data-count');
  const said = () => $('mark').getAttribute('aria-label');
  return { handle, went, $, disc, said, doc: dom.window.document };
}
const marks = (n, name = 'mark') => Array.from({ length: n }, (_, i) => ({ label: `${name} ${i + 1} of ${n}` }));

test('the arrows step like arrow keys: down from nothing is the first, up the last, and each end holds', () => {
  const { handle, went, $, disc, said } = pad({ items: () => marks(3) });
  assert.equal(handle.el.hidden, false);
  assert.equal(disc(), '–/3', 'before a step, the count and no mark');
  assert.equal(said(), '3 marks');
  $('down').click();
  assert.deepEqual(went.at(-1), [0, 'mark 1 of 3']);
  assert.equal(disc(), '1/3');
  assert.equal(said(), 'mark 1 of 3', 'the bookmark says the mark it counts');
  assert.equal($('mark').querySelector('[data-count]').textContent, '1/3', 'inside it, on one line');
  assert.equal($('up').disabled, true, 'the first holds');
  $('down').click(); $('down').click();
  assert.equal(disc(), '3/3');
  assert.equal($('down').disabled, true, 'the last holds');
  $('up').click();
  assert.equal(disc(), '2/3');
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
  const { handle, $, disc } = pad({ items: () => marks(4), scope: () => scope });
  $('down').click(); $('down').click();
  assert.equal(handle.at, 1);
  scope = 'b';
  handle.refresh();
  assert.equal(handle.at, -1);
  assert.equal(disc(), '–/4');
});

test('set places the pad on a mark the reader reached another way, without going there', () => {
  const { handle, went, $, disc } = pad({ items: () => marks(3) });
  handle.set(1);
  assert.equal(disc(), '2/3');
  assert.deepEqual(went, [], 'set does not go');
  $('down').click();
  assert.deepEqual(went, [[2, 'mark 3 of 3']], 'the next arrow goes on from there');
  handle.set(7);
  assert.equal(disc(), '3/3', 'a mark that is not there changes nothing');
});

test('the bookmark changes kind where there is one to change to, and shows which', () => {
  let kind = 'marks';
  const kinds = [{ key: 'marks', label: 'the marked passages', icon: 'ph-bookmark-simple' }, { key: 'citations', label: 'the citations', icon: 'ph-paperclip' }];
  const { $, disc, said } = pad({
    items: () => (kind === 'marks' ? marks(2, 'focus') : marks(110, 'citation')),
    kinds: () => kinds, kind: () => kind, choose: (k) => { kind = k; },
    scope: () => kind, idle: (n) => (kind === 'citations' ? `${n} citations` : `${n} marks`),
  });
  assert.equal($('mark').disabled, false);
  assert.match(said(), /Step through the citations instead/);
  assert.equal($('mark').querySelector('[data-kind]'), null, 'the bookmark is the marks\' own glyph, so it carries none inside');
  $('mark').click();
  assert.equal(kind, 'citations');
  assert.equal(disc(), '–/110');
  assert.match(said(), /^110 citations/);
  assert.match($('mark').querySelector('[data-kind]').className, /ph-paperclip/, 'another kind shows its glyph, small, inside');
  $('down').click();
  assert.equal(disc(), '1/110');
  assert.match(said(), /^citation 1 of 110/);
  const single = pad({ items: () => marks(2) });
  assert.equal(single.$('mark').disabled, true, 'one kind: the bookmark is only a count');
});

test('a named pad carries anchors a look link can name', () => {
  const { $ } = pad({ items: () => marks(1), at: 'marks' });
  assert.deepEqual(['up', 'mark', 'down'].map((k) => $(k).getAttribute('data-at')), ['marks-up', 'marks-mark', 'marks-down']);
});

test('the pad says when it comes and goes, so a control in the same corner can make way', () => {
  const heard = [];
  const win = { dispatchEvent: (e) => { heard.push([e.type, e.detail.shown]); return true; } };
  let list = [];
  const { handle } = pad({ items: () => list }, win);
  assert.deepEqual(heard, [['mark-pad', false]]);
  list = marks(2);
  handle.refresh(); handle.refresh();
  assert.deepEqual(heard, [['mark-pad', false], ['mark-pad', true]], 'once per change, not per refresh');
  handle.destroy();
  assert.deepEqual(heard.at(-1), ['mark-pad', false]);
});

test('a count of a hundred or more stacks n over m inside the bookmark, which keeps its size', () => {
  const { handle, $ } = pad({ items: () => marks(110, 'citation') });
  const box = () => $('mark').querySelector('[data-count]');
  assert.ok(box().hasAttribute('data-stacked'), 'stacked from the first, so the layout holds as n grows');
  assert.deepEqual([...box().children].map(e => e.textContent), ['–', '', '110'], 'n, a rule, m');
  handle.set(103);
  assert.equal(box().getAttribute('data-count'), '104/110');
  assert.deepEqual([...box().children].map(e => e.textContent), ['104', '', '110']);
  assert.match($('mark').className, /\bw-12\b/, 'the bookmark keeps its size');
  assert.match($('mark').className, /tabular-nums/);
  const few = pad({ items: () => marks(14) });
  few.handle.set(9);
  assert.equal(few.$('mark').querySelector('[data-count]').hasAttribute('data-stacked'), false, 'a short count sits on one line');
  assert.equal(few.$('mark').querySelector('[data-count]').textContent, '10/14');
});
