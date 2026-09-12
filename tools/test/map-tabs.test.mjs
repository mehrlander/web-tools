// lib/alpineComponents/map.js — the Map view's tab strip, and the one sentence
// each tab opens with.
//
// WHAT THIS HOLDS is a writing convention, which is an unusual thing to gate, so
// the reason has to be exact. Before 2026-08-31 eleven of the twelve views opened
// straight into cards with nothing saying what the cards were, and the twelfth
// opened with three sentences whose last one was mechanics. The Owners tab had a
// framing sentence and it was deleted on 2026-08-26 under the repo's own rule
// against prose that describes state, on the argument that "the cards say what
// the registry holds". That argument is wrong in a way worth catching: the cards
// say what a ROW is and never what the SET is, and a reader arriving cold needs
// the second one first.
//
// So the convention is narrow enough to be checkable. A lede says what the tab's
// rows ARE. It never says what the reader can do with them, which is the line
// between a lede and a manual, and it is the line prose on a page crosses when it
// starts to rot. The shape assertions below are the whole of it: one sentence,
// bounded, no second person, no imperative pointing at a control.
//
// The strip is generated from the same array, so a tab cannot be added without a
// sentence. That is the load-bearing part: a convention nothing renders from is a
// convention that lasts one session.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const src = readFileSync(path.join(repoRoot, 'lib', 'alpineComponents', 'map.js'), 'utf8');

// The literals live in a component that needs a browser to evaluate, so read
// just their source blocks. Scoping matters now that Growth and Tests are
// addressable subviews rather than entries in the top-level strip.
const tabsBlock = src.match(/TABS:\s*\[([\s\S]*?)\r?\n\s*\],\r?\n\s*SUBVIEWS:/)?.[1] || '';
const subviewsBlock = src.match(/SUBVIEWS:\s*\{([\s\S]*?)\r?\n\s*\},\r?\n\s*SUBVIEW_PARENT:/)?.[1] || '';
const ledePattern = /\{ k: '([a-z]+)', n: '([A-Za-z]+)', i: '(ph-[a-z-]+)',\s*\n\s*g: '((?:[^'\\]|\\.)*)' \}/g;
const optionPattern = /\{ k: '([a-z]+)', n: '([A-Za-z]+)', i: '(ph-[a-z-]+)'/g;
const ledesOf = block => [...block.matchAll(ledePattern)]
  .map(m => ({ k: m[1], n: m[2], i: m[3], g: m[4].replace(/\\'/g, "'") }));
const TABS = ledesOf(tabsBlock);
const SUBVIEWS = [...subviewsBlock.matchAll(optionPattern)]
  .map(m => ({ k: m[1], n: m[2], i: m[3] }));
const parentBlock = src.match(/SUBVIEW_PARENT:\s*\{([^}]+)\}/)?.[1] || '';
const SUBVIEW_PARENT = Object.fromEntries(
  [...parentBlock.matchAll(/(?:^|,)\s*([a-z]+): '([a-z]+)'(?=\s*(?:,|$))/g)]
    .map(m => [m[1], m[2]]));
const LEDES = [...TABS, ...ledesOf(subviewsBlock)];

test('every tab in the strip is one entry in the array that generates it', () => {
  // 12 to 13 on 2026-09-05: the Kits tab. 13 to 14 on 2026-09-08: the Views tab.
  // 14 to 13 on 2026-09-09: the Injection tab retired with the injection hook,
  // which is the Routes pane arriving from the Activity view. It reads one
  // repo's own registry about one repo's own destinations, which is what every
  // other tab in this strip already does.
  // 13 to 11 on 2026-09-11: Growth moved inside Docs and Tests inside Harness.
  assert.equal(TABS.length, 11, 'eleven top-level tabs, or this test is reading the wrong literal');
  assert.equal(SUBVIEWS.length, 4, 'Docs and Harness each carry two generated subview choices');
  // One x-for per level, not hand-copied buttons: the copies are what let a tab
  // ship without a sentence, and what let the Injection tab ship without an icon.
  const buttons = src.match(/role="tab" @click="setTab\(/g) || [];
  assert.equal(buttons.length, 2, 'the top-level strip and subview strip each generate one button shape');
  assert.match(src, /<template x-for="t in TABS"/, 'the strip loops over the array');
  assert.match(src, /<template x-for="s in subviews"/, 'the nested strip loops over the current parent subviews');
  assert.match(src, /displayTab === t\.k/, 'a selected subview keeps its parent highlighted');
  assert.match(src, /x-text="tabGloss"/, 'the lede is rendered from the selected tab');
});

test('every tab key the view dispatches on has an entry', () => {
  // x-show="mapTab==='k'" is how each section decides to render, so the set of
  // keys in the markup is the set of tabs that exist, whatever the array claims.
  const shown = new Set([...src.matchAll(/x-show="mapTab==='([a-z]+)'"/g)].map(m => m[1]));
  const declared = new Set([...TABS.map(t => t.k), ...Object.keys(SUBVIEW_PARENT)]);
  for (const [child, parent] of Object.entries(SUBVIEW_PARENT))
    assert.ok(TABS.some(t => t.k === parent), `${child} names missing top-level parent ${parent}`);
  for (const k of shown) assert.ok(declared.has(k), `section "${k}" has no top-level or subview route`);
  for (const k of declared) assert.ok(shown.has(k), `route "${k}" has no section`);
});

test('every icon is a name the installed Phosphor carries', () => {
  // The Injection tab shipped a blank glyph for want of this. blank-icons.py
  // scans the file wholesale; this holds the array specifically, so a bad name
  // fails beside the tab it belongs to.
  const sheet = readFileSync(
    path.join(repoRoot, 'node_modules', '@phosphor-icons', 'web', 'src', 'regular', 'style.css'), 'utf8');
  const carried = new Set([...sheet.matchAll(/\.ph\.ph-([a-z0-9-]+)/g)].map(m => m[1]));
  for (const t of [...TABS, ...SUBVIEWS])
    assert.ok(carried.has(t.i.slice(3)), `${t.n}: ${t.i} is not an icon the font carries`);
});

test('a lede is one sentence and stays one', () => {
  for (const t of LEDES) {
    assert.ok(t.g, `${t.n}: no lede`);
    // Sentence-final punctuation, counted outside the abbreviations and decimals
    // that would otherwise read as an end.
    const ends = (t.g.match(/[.!?](\s|$)/g) || []).length;
    assert.equal(ends, 1, `${t.n}: a lede is one sentence, found ${ends}`);
    assert.match(t.g, /[.!?]$/, `${t.n}: a lede ends in a full stop`);
    assert.match(t.g, /^[A-Z]/, `${t.n}: a lede starts a sentence`);
  }
});

test('a lede is bounded, because the ones that rot are the ones that grew', () => {
  for (const t of LEDES) {
    const words = t.g.split(/\s+/).length;
    assert.ok(words >= 12, `${t.n}: ${words} words is a label, not a lede`);
    assert.ok(words <= 30, `${t.n}: ${words} words; say what the rows are and stop`);
  }
});

test('a lede says what the rows are, never what the reader can do', () => {
  // The line between a lede and a manual. Second person and control-naming are
  // the two ways the second one gets in, and both are mechanical to spot.
  const forbidden = [
    [/\byou\b|\byour\b/i, 'second person'],
    [/\buse (this|it|the)\b/i, 'telling the reader to use something'],
    [/\bclick\b|\btap\b|\bdrag\b|\bselect\b/i, 'naming an interaction'],
    [/\bbelow\b|\babove\b|\bthis (tab|view|page)\b/i, 'pointing at the page it sits on'],
    [/\bhere\b/i, 'deixis; the lede should read away from its own placement'],
  ];
  for (const t of LEDES)
    for (const [re, why] of forbidden)
      assert.doesNotMatch(t.g, re, `${t.n}: ${why} — a lede states its subject`);
});

test('the ledes are distinct, so none is a template somebody filled in', () => {
  const opens = LEDES.map(t => t.g.split(/\s+/).slice(0, 3).join(' ').toLowerCase());
  assert.equal(new Set(opens).size, opens.length,
    'two ledes open with the same three words; write the second one about its own subject');
});
