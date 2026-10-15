// A design from the template route, filled and marked (lib/kits/design-fill.js).
// The fixture is a small template in the threaded shape: a goal, and under it a
// decision whose two paths repeat and whose optional part shows for one path
// only, then an inquiry. What is under test: the words reach their fields, a
// repeat makes one copy per item, a condition drops an empty part, a field asks
// for a second length, and marking a block rings the element that holds it,
// dims nothing, and rings nothing where the block runs through the whole design.
// A second fixture, of disclosures, holds focus (the call's own block opens, the
// others become their line) and annotate (each entity's first mention marked).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot, makeWindow } from './bootstrap.mjs';

const { window } = makeWindow();
new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits/design-fill.js'), 'utf8'))(window, window.document);
const D = window.DesignFill;

const TEMPLATE = `<div>
  <div class="goal"><span data-text="goal.text" data-max="40"></span>
    <div class="decide"><span data-text="decide.text" data-form="short" data-max="20"></span>
      <span data-each="decide.paths"><b data-value=".letter"></b> <span data-text=".name" data-max="12"></span><span data-if=".when"><span data-glue>, </span><span data-text=".when" data-max="6"></span></span></span>
    </div>
    <div class="know"><span data-text="know.text" data-max="40"></span></div>
  </div>
</div>`;
const WORDS = {
  goal: { text: 'Gemini marks topic changes' },
  decide: { text: { text: 'Switch the follow-up to two steps?', short: 'Two steps?' }, paths: [{ letter: 'A', name: 'one call', when: 'now' }, { letter: 'B', name: 'two steps' }] },
  know: { text: 'Do the replies find them closer?' },
};
const box = () => { const el = window.document.createElement('div'); el.innerHTML = TEMPLATE; return el; };

test('the words reach their fields, a repeat per item, a condition and a second length', () => {
  const el = box(), rep = D.fill(el, WORDS);
  assert.equal(el.querySelector('[data-field="goal.text"]').textContent, 'Gemini marks topic changes');
  assert.equal(el.querySelector('[data-field="decide.text@short"]').textContent, 'Two steps?');
  assert.deepEqual([...el.querySelectorAll('b')].map((b) => b.textContent), ['A', 'B']);
  assert.equal(el.querySelectorAll('[data-field$=".when"]').length, 1, 'the second path has no when, so its part is dropped');
  assert.ok(rep.every((r) => !r.over && !r.missing));
});

test('fields lists what a template declares, unfilled', () => {
  const f = D.fields(box());
  assert.ok(f.some((x) => x.path === 'decide.paths' && x.kind === 'list'));
  assert.ok(f.some((x) => x.path === 'decide.paths[].when' && x.kind === 'if'));
  assert.ok(f.some((x) => x.path === 'decide.text' && x.form === 'short' && x.max === 20));
});

test('marking a block rings the element that holds it and dims nothing', () => {
  const el = box(); D.fill(el, WORDS);
  const ring = D.mark(el, 'decide');
  assert.equal(ring?.className.includes('decide'), true, 'the decision block is ringed, not the goal around it');
  assert.equal(ring.getAttribute('aria-current'), 'step');
  assert.equal(el.querySelectorAll('[class*="opacity-"]').length, 0, 'the rest of the chain is read, not faded');
});

test('a block spread through the whole design is not ringed', () => {
  const el = window.document.createElement('div');
  el.innerHTML = '<p><span data-text="def.text" data-max="20"></span> and <span data-text="goal.text" data-max="40"></span>, so <span data-text="def.answer" data-max="20"></span></p>';
  D.fill(el, { def: { text: 'How big?', answer: 'by the thing built' }, goal: { text: 'marks' } });
  assert.equal(D.mark(el, 'def'), null);
});

const FOLDS = `<div>
  <details class="group k-decide"><summary class="flex cursor-pointer"><span class="line"><span data-text="decide.text" data-max="40"></span><i class="ph ph-caret-down"></i></span></summary>
    <div class="more"><span data-text="decide.more" data-max="60"></span></div></details>
  <details class="group k-def"><summary class="flex cursor-pointer"><span class="line"><span data-text="def.text" data-max="30"></span><i class="ph ph-caret-down"></i></span></summary>
    <div class="more"><span data-glue>the key: </span><span data-text="def.answer" data-max="60"></span></div></details>
</div>`;
const FOLD_WORDS = { decide: { text: 'Switch the topic follow-up?', more: 'one call reads your messages' },
                     def: { text: 'How big is a topic?', answer: 'the key starts one when the thing built changes' } };
const folds = () => { const el = window.document.createElement('div'); el.innerHTML = FOLDS; D.fill(el, FOLD_WORDS); return el; };

test('focus opens the call\'s own block and reduces every other to its line', () => {
  const el = folds();
  D.focus(el, 'def');
  const open = el.querySelectorAll('details');
  assert.equal(open.length, 1, 'only the call\'s own block is still a disclosure');
  assert.ok(open[0].hasAttribute('open') && open[0].classList.contains('k-def'));
  const other = el.querySelector('.k-decide');
  assert.equal(other.tagName, 'DIV', 'the other block is a plain line');
  assert.ok(other.querySelector('[data-field="decide.text"]'), 'its line keeps its words');
  assert.equal(other.querySelector('[data-field="decide.more"]'), null, 'its detail is gone');
  assert.equal(other.querySelector('[class*="caret"]'), null, 'and nothing says it opens');
  const ring = D.mark(el, 'def');
  assert.ok(ring.classList.contains('line'), 'the ring sits on the line a reader sees, not around the opened detail');
});

test('annotate marks each entity once, longest term first, and leaves glue alone', () => {
  const el = folds();
  D.annotate(el, [{ id: 'follow-up', terms: ['topic follow-up'] }, { id: 'topic', terms: ['topic'] }, { id: 'key', terms: ['the key'] }]);
  const marks = [...el.querySelectorAll('[data-entity]')].map((n) => [n.dataset.entity, n.textContent]);
  assert.deepEqual(marks, [['follow-up', 'topic follow-up'], ['topic', 'topic'], ['key', 'the key']]);
  assert.equal(el.querySelector('[data-glue] [data-entity]'), null, 'the template\'s own connectives are not marked');
  assert.equal(el.querySelector('[data-field="def.text"]').textContent, 'How big is a topic?', 'the words read the same');
});
