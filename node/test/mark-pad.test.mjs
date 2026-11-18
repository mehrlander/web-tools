// lib/kits/mark-pad.js — the arrows that step through a page's marks.
//
// What a reader relies on: down from no mark is the first and up the last,
// each end holds, the disc between the arrows counts the mark in view and
// says its name, a new scope starts again, the disc switches kinds only where
// there is one to switch to, a page with nothing to step through shows no pad
// at all, and a control sharing the corner hears when the pad comes and goes.

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
  const disc = () => $('disc').textContent.trim();
  const said = () => $('disc').getAttribute('aria-label');
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
  assert.equal(said(), 'mark 1 of 3', 'the disc says the mark it counts');
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

test('the disc changes kind where there is one to change to, and says so', () => {
  let kind = 'marks';
  const kinds = [{ key: 'marks', label: 'the marked passages', icon: 'ph-bookmark-simple' }, { key: 'citations', label: 'the citations', icon: 'ph-paperclip' }];
  const { $, disc, said } = pad({
    items: () => (kind === 'marks' ? marks(2, 'focus') : marks(110, 'citation')),
    kinds: () => kinds, kind: () => kind, choose: (k) => { kind = k; },
    scope: () => kind, idle: (n) => (kind === 'citations' ? `${n} citations` : `${n} marks`),
  });
  assert.equal($('disc').disabled, false);
  assert.match(said(), /Step through the citations instead/);
  assert.match($('disc').querySelector('i').className, /ph-bookmark-simple/);
  $('disc').click();
  assert.equal(kind, 'citations');
  assert.equal(disc(), '–/110');
  assert.match(said(), /^110 citations/);
  assert.match($('disc').querySelector('i').className, /ph-paperclip/, 'the disc wears the kind in force');
  $('down').click();
  assert.equal(disc(), '1/110');
  assert.match(said(), /^citation 1 of 110/);
  const single = pad({ items: () => marks(2) });
  assert.equal(single.$('disc').disabled, true, 'one kind: the disc is only a count');
  assert.match(single.$('disc').querySelector('i').className, /ph-bookmark-simple/, 'and wears a bookmark');
});

test('a named pad carries anchors a look link can name', () => {
  const { $ } = pad({ items: () => marks(1), at: 'marks' });
  assert.deepEqual(['up', 'disc', 'down'].map((k) => $(k).getAttribute('data-at')), ['marks-up', 'marks-disc', 'marks-down']);
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

test('the count keeps inside the disc: the type steps down as the count grows, and the disc does not', () => {
  const { handle, $ } = pad({ items: () => marks(110, 'citation') });
  const size = () => $('disc').querySelector('span').className.match(/text-(xs|\[\d+px\])/)[0];
  assert.equal(size(), 'text-xs', '–/110 is five characters');
  handle.set(13);
  assert.equal(size(), 'text-[11px]', '14/110');
  handle.set(103);
  assert.equal($('disc').textContent.trim(), '104/110');
  assert.equal(size(), 'text-[10px]', '104/110');
  assert.match($('disc').className, /\bsize-14\b/, 'the disc keeps its size');
  assert.match($('disc').className, /tabular-nums/);
});
