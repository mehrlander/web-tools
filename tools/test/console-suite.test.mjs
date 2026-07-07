// console/suite.js — the assembled console toolkit (base.js + mods), driven
// under jsdom. Tests run against assemble()'s output so they exercise exactly
// what a paste of suite.js executes; a final test pins the committed artifact
// to that output (the build is deterministic, so stale = byte-diff).
//
// jsdom caveat: layout is inert (offsetWidth 0, empty client rects), so
// sig.visible is false for everything; the `visible` engine is tested via
// visible=false only.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';
import { assemble } from '../build/console-suite.mjs';

const PAGE = `<!doctype html><html><head></head><body>
  <h1>Bills</h1>
  <table id="bills">
    <thead><tr><th>Bill</th><th>Status</th></tr></thead>
    <tbody>
      <tr class="row odd"><td><a href="/hb1">HB 1001</a></td><td>In committee hearing</td></tr>
      <tr class="row even"><td><a href="/hb2">HB 1002</a></td><td>Passed</td></tr>
      <tr class="row odd"><td><a href="/hb3">HB 1003</a></td><td>Scheduled for hearing</td></tr>
    </tbody>
  </table>
  <div id="cards">
    <div class="c hash-x1">alpha</div>
    <div class="c hash-x2">beta</div>
    <div class="c hash-x3">gamma</div>
    <div class="other">delta</div>
    <p class="c">not a card</p>
  </div>
</body></html>`;

const boot = () => {
  const { window } = makeWindow({ html: PAGE });
  window.eval(assemble());
  return window;
};
// Spread into this realm: jsdom-realm arrays fail strict deepEqual on prototype.
const texts = els => [...els].map(n => n.textContent.trim().replace(/\s+/g, ' '));

// ---- q: the chain grammar ---------------------------------------------

test('q: chained css scopes each stage inside the previous set', () => {
  const w = boot();
  assert.equal(w.q('#bills >> tbody tr').length, 3);
  assert.equal(w.q('#cards >> div').length, 4);
});

test('q: text= forms — substring (case-insensitive), "exact", /regex/', () => {
  const w = boot();
  assert.deepEqual(texts(w.q('td >> text=HEARING')), ['In committee hearing', 'Scheduled for hearing']);
  assert.deepEqual(texts(w.q('td >> text="Passed"')), ['Passed']);
  assert.deepEqual(texts(w.q('td >> text=/^HB \\d+$/')), []); // links hold the text, not the cells
  assert.deepEqual(texts(w.q('a >> text=/^HB \\d+$/')), ['HB 1001', 'HB 1002', 'HB 1003']);
});

test('q: has-text= matches full textContent; has= requires a descendant', () => {
  const w = boot();
  assert.equal(w.q('tr >> has-text=/hb 100/i').length, 3);
  assert.equal(w.q('tr >> has=a[href="/hb2"]').length, 1);
});

test('q: nth picks indexes, negatives, and inclusive ranges', () => {
  const w = boot();
  const rows = 'tbody tr';
  assert.deepEqual(texts(w.q(`${rows} >> nth=0 >> down=a`)), ['HB 1001']);
  assert.deepEqual(texts(w.q(`${rows} >> nth=-1 >> down=a`)), ['HB 1003']);
  assert.equal(w.q(`${rows} >> nth=0-1`).length, 2);
  assert.equal(w.q(`${rows} >> nth=1--1`).length, 2);
});

test('q: dance stages — up to ancestors, down/down* to descendants, over to siblings', () => {
  const w = boot();
  assert.equal(w.q('a >> up=tr').length, 3);
  assert.equal(w.q('a >> up >> up').length, 3);            // td -> tr, bare up twice
  assert.deepEqual(texts(w.q('td >> text=Passed >> over=-1')), ['HB 1002']);
  assert.equal(w.q('tbody tr >> down=a').length, 3);        // first match per member
  assert.equal(w.q('#bills >> down*=td').length, 6);        // union of all matches
});

test('q: results dedupe in document order; visible=false passes everything in jsdom', () => {
  const w = boot();
  const tds = w.q('tbody tr >> td');                        // 2 tds per row, shared parents walked once
  assert.equal(tds.length, 6);
  assert.deepEqual(texts(w.q('td >> visible=false')).length, 6);
  assert.equal(w.q('td >> visible').length, 0);             // layout is inert under jsdom
});

test('q: decorations — texts(), glom() adopts the set', () => {
  const w = boot();
  assert.deepEqual([...w.q('a').texts()], ['HB 1001', 'HB 1002', 'HB 1003']);
  const set = w.q('tbody tr').glom();
  assert.equal(set.length, 3);
  assert.equal(w.document.querySelectorAll('[data-glom]').length, 3);
});

// ---- verbs: lockstep set navigation ------------------------------------

test('verbs: up/down/over move every member in lockstep', () => {
  const w = boot();
  w.glom(w.q('tbody a'));
  assert.equal(w.glom.up('tr').length, 3);
  assert.equal(w.glom.down('a').length, 3);
  w.glom.up('tr');
  assert.deepEqual(texts(w.glom.downAll('td')), [
    'HB 1001', 'In committee hearing', 'HB 1002', 'Passed', 'HB 1003', 'Scheduled for hearing',
  ]);
  w.glom(w.q('tbody td >> nth=0'));
  assert.deepEqual(texts(w.glom.over(1)), ['In committee hearing']);
});

test('verbs: members whose step lands nowhere drop out; landing together dedupes', () => {
  const w = boot();
  w.glom(w.q('#cards div'));                    // 4 divs
  assert.equal(w.glom.up().length, 1);          // all share #cards
  w.glom(w.q('h1'));
  assert.equal(w.glom.up('table').length, 0);   // h1 has no table ancestor
});

// ---- grow: by-example expansion ----------------------------------------

test('grow: two examples expand to structural siblings, shared classes filter decoys', () => {
  const w = boot();
  const cards = w.q('#cards div.c');
  w.glom([cards[0], cards[1]]);                 // two examples with hashy classes
  const grown = w.glom.grow();
  assert.equal(grown.length, 3);                // finds gamma, excludes .other and p.c
  assert.deepEqual(texts(grown), ['alpha', 'beta', 'gamma']);
});

test('grow: from table rows, header row is excluded by tag path (thead vs tbody)', () => {
  const w = boot();
  const rows = w.q('tbody tr');
  w.glom([rows[0], rows[1]]);
  assert.equal(w.glom.grow().length, 3);
  assert.equal(w.document.querySelectorAll('thead [data-glom], thead[data-glom]').length, 0);
});

test('alike: one example matches structure alone (classes unknowable from one)', () => {
  const w = boot();
  const alpha = w.q('#cards div >> text=alpha')[0];
  assert.equal(w.glom.alike(alpha).length, 4);  // 3 cards + .other, not p.c
});

// ---- pick: click-to-collect ---------------------------------------------

test('pick: clicks toggle membership, Esc finishes and disarms', () => {
  const w = boot();
  const [alpha, beta] = w.q('#cards div');
  const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));

  w.glom.clear();
  w.glom.pick();
  click(alpha); click(beta);
  assert.equal(w.glom.get().length, 2);
  click(alpha);                                  // toggle off
  assert.deepEqual(texts(w.glom.get()), ['beta']);

  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(w.document.getElementById('glom-pick-style'), null);
  click(alpha);                                  // disarmed: no effect
  assert.deepEqual(texts(w.glom.get()), ['beta']);
});

test('pick: swallows the click so page handlers never fire', () => {
  const w = boot();
  let navigated = 0;
  const link = w.q('a')[0];
  link.addEventListener('click', () => navigated++);
  w.glom.clear();
  w.glom.pick();
  link.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.equal(navigated, 0);
  assert.equal(w.glom.get().length, 1);
  w.glom.pick.done();
});

// ---- the committed artifact ----------------------------------------------

test('console/suite.js on disk matches a fresh assemble()', () => {
  const disk = readFileSync(path.join(repoRoot, 'console', 'suite.js'), 'utf8');
  assert.equal(disk, assemble(), 'console/suite.js is stale — run `npm run build:console`');
});
