// lib/kits/swipe-deck.js — a slide's own header chrome (render's setChrome).
//
// A slide's component can know facts and controls the deck's caller cannot:
// a branch view's state, a session view's counts and its search. setChrome
// puts them in the deck's header while that slide is in view. Three slots:
//
//   note   leads the caller's subtitle, joined to it by a dot;
//   sub    takes the subtitle's place, the caller's text included, for a
//          slide whose second line is a set of facts of its own (the session
//          view's id, date and counts);
//   head   takes the place of the title AND the subtitle, for a header that
//          turns into a field (the session view's find).
//
// What has to hold: each slot shows only for the active slide; withdrawing it
// puts the caller's own header back exactly; and the title and subtitle stay
// adjacent siblings (`h1 + p`), which half the estate reads.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/swipe-deck.js'), 'utf8'))();
const sd = window.swipeDeck;
window.Element.prototype.scrollTo = function(){};
window.Element.prototype.scrollIntoView = function(){};
const tick = (n = 1) => new Promise(r => setTimeout(r, n * 10));
const span = (text) => { const s = window.document.createElement('span'); s.textContent = text; return s; };

// A deck whose slides hand their setChrome out, so the test can call it.
const deck = async () => {
  const sets = [];
  const h = sd.open({ count: 3, title: 'Caller title', subtitle: 'caller sub',
                      render: (i, slide, ctx) => { sets[i] = ctx.setChrome; } });
  // Slides are built on the first animation frame.
  for (let n = 0; n < 20 && !(sets[0] && sets[1]); n++) await tick();
  const head = h.el.querySelector('.sd-header');
  const title = head.querySelector('h1');
  return { h, sets, head, title, sub: title.nextElementSibling };
};
const shown = (el) => el.style.display !== 'none';

test('a note leads the caller\'s subtitle, and withdrawing it restores the line', async () => {
  const { h, sets, sub } = await deck();
  sets[0]({ note: span('live') });
  assert.equal(sub.textContent, 'live · caller sub');
  sets[0](null);
  assert.equal(sub.textContent, 'caller sub');
  h.drop();
});

test('a sub takes the subtitle\'s place, and the caller\'s text returns without it', async () => {
  const { h, sets, title, sub } = await deck();
  sets[0]({ sub: span('ab12cd34 · Nov 17 · 40') });
  assert.equal(sub.tagName, 'P', 'the subtitle is still the p after the h1');
  assert.equal(title.nextElementSibling, sub);
  assert.equal(sub.textContent, 'ab12cd34 · Nov 17 · 40', 'the caller\'s subtitle is not appended');
  h.setSubtitle('caller sub, later');
  assert.equal(sub.textContent, 'ab12cd34 · Nov 17 · 40', 'and a later setSubtitle does not bring it back');
  sets[0]({});
  assert.equal(sub.textContent, 'caller sub, later', 'withdrawn, the caller\'s own text shows');
  h.drop();
});

test('a head hides the title and the subtitle while it stands, and only then', async () => {
  const { h, sets, head, title, sub } = await deck();
  const field = window.document.createElement('input');
  sets[0]({ sub: span('facts'), head: field });
  assert.ok(head.contains(field), 'the field is in the header');
  assert.ok(!shown(title) && !shown(sub), 'in place of the title and the subtitle');
  assert.equal(title.nextElementSibling, sub, 'which stay adjacent siblings, hidden');
  sets[0]({ sub: span('facts') });
  assert.ok(!head.contains(field), 'without it the field leaves');
  assert.ok(shown(title) && shown(sub));
  assert.equal(sub.textContent, 'facts');
  h.drop();
});

test('each slide\'s chrome shows only while that slide is active', async () => {
  const { h, sets, head, sub } = await deck();
  const field = window.document.createElement('input');
  sets[1]({ sub: span('second slide'), head: field });
  assert.equal(sub.textContent, 'caller sub', 'slide 1 is not in view, so the header is the caller\'s');
  assert.ok(!head.contains(field));
  sets[0]({ sub: span('first slide') });
  assert.equal(sub.textContent, 'first slide');
  h.drop();
});
