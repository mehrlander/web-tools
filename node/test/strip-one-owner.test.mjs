// ONE DRIVER FOR A STRIP A COMPONENT DRAWS, held here because copies drift
// apart without anyone deciding they should: which slide is in view, a go()
// that holds the readings until it lands, a jump() that waits for a width. A
// copy that divides scrollLeft by the width is exact only for full-width cards
// with no gap, and one with no hold walks the selection through every card a
// go() passes. The driver is lib/kits/swipe-deck.js's strip() (A STRIP A
// COMPONENT DRAWS), tested in swipe-deck-strip.test.mjs; the drawing stays each
// component's.
//
// The gate is the three shapes a copy took: a slide index divided out of
// scrollLeft, a nearest-left-edge loop measured against the strip's x0, and
// the in-flight hold's timer. A write to scrollLeft, or arithmetic that adds
// to it (the viewer's zoom), is not a reading and does not trip it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sources, linesMatching, excusesHold } from './one-home.mjs';

const HOME = 'lib/kits/swipe-deck.js';

const ALLOWED = new Map([
  [HOME, 'where the rule lives'],
  // The diff card's mode stage runs its own glide, with a finger's velocity
  // and a held touch, over full-width modes with no gap, where scrollLeft over
  // the width is exact. A different job from a strip of cards.
  ['lib/kits/md-surface.js', 'a mode stage with its own glide'],
  // A probe page measuring how a snap track settles, which reads the raw
  // position on purpose.
  ['pages/probe-snap.html', 'a probe of snap scrolling itself'],
]);

const DIVIDES = /scrollLeft\s*\/(?![/*])/;
const NEAREST = /getBoundingClientRect\(\)\.left\s*-\s*x0\b/;
const HOLD = /\b_?aimT\b/;

export const offendersIn = linesMatching((line) => DIVIDES.test(line) || NEAREST.test(line) || HOLD.test(line));

test('only swipe-deck.js reads where a drawn strip is', () => {
  assert.deepEqual(offendersIn(sources(ALLOWED)), [],
    'these read a strip\'s slide by hand; drive the strip with window.swipeDeck.strip() instead');
});

test('the gate catches the shapes the copies took, and not a write or a zoom', () => {
  const lines = {
    'a.js': 'return Math.round(el.scrollLeft / el.clientWidth);',
    'b.js': 'const d = Math.abs(k.getBoundingClientRect().left - x0);',
    'c.js': 'this._aimT = setTimeout(() => { this._aim = -1; }, 900);',
    'd.js': 'if (el) el.scrollLeft = 0;',
    'e.js': 'const x = (pane.scrollLeft + to.x) / scale();',
    'f.js': 'strip.scrollLeft += a.left - b.left - 8;',
  };
  assert.deepEqual(offendersIn(Object.keys(lines), (f) => lines[f]), ['a.js:1', 'b.js:1', 'c.js:1']);
});

test('each exception still holds what excuses it', () => {
  excusesHold(ALLOWED, HOME, offendersIn, 'reads a strip by hand');
});
