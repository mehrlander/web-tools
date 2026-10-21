// A glossary's terms marked where a text first names them (lib/kits/term-marks.js).
// What is under test: each entity is marked once, the longest term first, a
// connective set apart with data-glue is left alone, the mark carries no class,
// and the words read the same afterwards.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot, makeWindow } from './bootstrap.mjs';

const { window } = makeWindow();
new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits/term-marks.js'), 'utf8'))(window, window.document);
const T = window.TermMarks;

const TEXT = `<div>
  <div class="decide">Switch the topic follow-up? <span>one call reads your messages</span></div>
  <div class="size"><span data-field="size">How big is a topic?</span> <span data-glue>the key: </span><span>the key starts one when the thing built changes</span></div>
</div>`;

test('mark marks each entity once, longest term first, draws nothing, and leaves glue alone', () => {
  const el = window.document.createElement('div');
  el.innerHTML = TEXT;
  assert.equal(T.mark(el, [{ id: 'follow-up', terms: ['topic follow-up'] }, { id: 'topic', terms: ['topic'] }, { id: 'key', terms: ['the key'] }]), el);
  const marks = [...el.querySelectorAll('[data-entity]')].map((n) => [n.dataset.entity, n.textContent]);
  assert.deepEqual(marks, [['follow-up', 'topic follow-up'], ['topic', 'topic'], ['key', 'the key']]);
  assert.equal(el.querySelector('[data-glue] [data-entity]'), null, 'a connective is not marked');
  assert.equal(el.querySelector('[data-entity][class]'), null, 'a mark draws nothing: no underline, no question-mark cursor');
  assert.equal(el.querySelector('[data-field="size"]').textContent, 'How big is a topic?', 'the words read the same');
});
