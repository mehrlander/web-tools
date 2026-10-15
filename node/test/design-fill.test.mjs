// A design from the template route, filled and marked (lib/kits/design-fill.js).
// The fixture is a small template in the threaded shape: a goal, and under it a
// decision whose two paths repeat and whose optional part shows for one path
// only, then an inquiry. What is under test: the words reach their fields, a
// repeat makes one copy per item, a condition drops an empty part, a field asks
// for a second length, and marking a block rings the element that holds it and
// dims the rest, but rings nothing where the block runs through the whole design.

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

test('marking a block rings the element that holds it and dims the rest', () => {
  const el = box(); D.fill(el, WORDS);
  const ring = D.mark(el, 'decide');
  assert.equal(ring?.className.includes('decide'), true, 'the decision block is ringed, not the goal around it');
  assert.equal(ring.getAttribute('aria-current'), 'step');
  assert.ok(el.querySelector('[data-field="goal.text"]').classList.contains('opacity-45'));
  assert.ok(!el.querySelector('[data-field="decide.text@short"]').classList.contains('opacity-45'));
});

test('a block spread through the whole design is not ringed', () => {
  const el = window.document.createElement('div');
  el.innerHTML = '<p><span data-text="def.text" data-max="20"></span> and <span data-text="goal.text" data-max="40"></span>, so <span data-text="def.answer" data-max="20"></span></p>';
  D.fill(el, { def: { text: 'How big?', answer: 'by the thing built' }, goal: { text: 'marks' } });
  assert.equal(D.mark(el, 'def'), null);
  assert.ok(el.querySelector('[data-field="goal.text"]').classList.contains('opacity-45'));
});
