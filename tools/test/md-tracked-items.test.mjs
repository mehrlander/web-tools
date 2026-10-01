// List items as blocks of their own in the tracked render (mdDiff.align with
// `items`, kits/md-surface.js): one bullet edited is one card, not its list.
//
// For every scenario: the card count, and that taking changes back gives
// GitHub's text exactly, both every card at once and each card alone, since
// pages/dictate.html's Apply builds its commit by reverting the cards left
// unconfirmed. The edge it guards is a tight list's last item, whose removal
// must keep the blank line before the next paragraph, and whose return must
// land on the line after the item before it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import jsdomPkg from 'jsdom';
import { marked } from 'marked';
import { repoRoot } from './bootstrap.mjs';

const { JSDOM } = jsdomPkg;
const dom = new JSDOM('<!doctype html><body><div id="box"><div id="host"></div></div></body>');
const window = dom.window;
window.mdDoc = { html: (t) => marked.parse(t) };
window.GuideRender = { render: (md) => ({ html: marked.parse(md) }) };
window.Range.prototype.getClientRects = () => [];
window.Range.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
window.matchMedia = () => ({ matches: true });
const Diff = (await import('diff')).default ?? (await import('diff'));
window.Diff = Diff;
for (const kit of ['standoff.js', 'md-diff.js', 'md-surface.js', 'dictate.js']) {
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits', kit), 'utf8'))(window, window.document);
}
const host = window.document.getElementById('host');
const box = window.document.getElementById('box');
const M = window.MdSurface, mdDiff = window.mdDiff;

const BASE = [
  '# Title', '',
  'Intro paragraph here.', '',
  '- **Structure.** The sections:',
  '    - *Premise:* the situation.',
  '    - *Goal:* shape or behavior.',
  '    - *Process:* how it plays out.',
  '- **Kinds.** Five families.',
  '- **Register.** Terse and dry.', '',
  'Middle paragraph.', '',
  '1. First step.',
  '2. Second step,',
  '   continued here.',
  '3. Third step.', '',
  'Closing paragraph.', '',
].join('\n');

const paint = (text) => { host.__mdKey = null; host.__readings = {}; M.paint(host, { text, base: BASE, track: true, overlay: box }); };
const revertAll = (text, runs) => { let t = text; for (let i = runs.length - 1; i >= 0; i--) t = mdDiff.revert(BASE, t, runs[i]); return t; };

const SCENARIOS = [
  { name: 'a nested bullet reworded', cards: 1, edit: (t) => t.replace('shape or behavior', 'shape or conduct') },
  { name: 'two bullets of one list reworded', cards: 2, edit: (t) => t.replace('the situation', 'the setting').replace('Five families', 'Six families') },
  { name: 'the last bullet of a tight list removed', cards: 1, edit: (t) => t.replace('- **Register.** Terse and dry.\n', '') },
  { name: 'a middle nested bullet removed', cards: 1, edit: (t) => t.replace('    - *Goal:* shape or behavior.\n', '') },
  { name: 'a bullet added at the end of a list', cards: 1, edit: (t) => t.replace('Terse and dry.\n', 'Terse and dry.\n- **Trigger.** Name the situation.\n') },
  { name: 'a nested bullet added', cards: 1, edit: (t) => t.replace('how it plays out.\n', 'how it plays out.\n    - *Extending:* a growth path.\n') },
  { name: 'an ordered item with a continuation line reworded', cards: 1, edit: (t) => t.replace('continued here', 'carried on here') },
  { name: 'the last ordered item removed', cards: 1, edit: (t) => t.replace('3. Third step.\n', '') },
  { name: 'the first bullet removed', cards: 1, edit: (t) => t.replace('- **Structure.** The sections:\n', '') },
  { name: 'a paragraph and a bullet changed', cards: 2, edit: (t) => t.replace('Intro paragraph', 'Opening paragraph').replace('Terse and dry', 'Terse, dry') },
];

for (const s of SCENARIOS) {
  test('list items as blocks: ' + s.name, () => {
    const text = s.edit(BASE);
    assert.notEqual(text, BASE, 'the edit changed nothing');
    paint(text);
    const runs = M.cards(host);
    assert.equal(host.querySelectorAll('[data-md-card]').length, s.cards, 'card count');
    assert.equal(revertAll(text, runs), BASE, 'every card taken back');
    runs.forEach((r, i) => {
      // One card taken back alone, then the rest: the base again either way.
      const one = mdDiff.revert(BASE, text, r);
      const left = mdDiff.align(BASE, one, { items: true }).filter((e) => e.kind !== 'same');
      assert.equal(left.length, runs.reduce((n, x, k) => n + (k === i ? 0 : x.length), 0), `card ${i + 1} alone leaves the others`);
    });
  });
}

test('blocks with items: a bullet or "1." interrupts a paragraph, "2." mid-paragraph does not, a rule is no item', () => {
  const b = (md) => mdDiff.blocks(md, { items: true }).map((x) => x.text);
  assert.deepEqual(b('Lead:\n- a\n- b'), ['Lead:', '- a', '- b']);
  assert.deepEqual(b('In the year\n2. of grace'), ['In the year\n2. of grace']);
  assert.deepEqual(b('1. a\n2. b'), ['1. a', '2. b']);
  assert.deepEqual(b('Text\n\n* * *\n\nMore'), ['Text', '* * *', 'More']);
  assert.deepEqual(b('- a\n  lazy more\n- b'), ['- a\n  lazy more', '- b']);
  assert.deepEqual(b('```\n- not\n- items\n```'), ['```\n- not\n- items\n```']);
  // Without the option, a list is still one block.
  assert.deepEqual(mdDiff.blocks('- a\n- b').map((x) => x.text), ['- a\n- b']);
});

test('a nested item renders dedented, indented by depth, never as code', () => {
  paint(BASE.replace('shape or behavior', 'shape or conduct'));
  const card = host.querySelector('[data-md-card]');
  assert.ok(card.querySelector('li'), 'the nested bullet is a list item');
  assert.equal(card.querySelector('pre, code:not(li code)'), null, 'not a code block');
  assert.ok(card.querySelector('[data-md-item].pl-6'), 'one level in');
});

test('an item between two items of its list keeps the list spacing, not a paragraph margin', () => {
  paint(BASE.replace('Intro paragraph', 'Opening paragraph'));
  const items = [...host.querySelectorAll('[data-md-item]')];
  const goal = items.find((x) => x.textContent.includes('Goal:'));
  assert.ok(goal.className.includes('[&>ul]:mt-0!') && goal.className.includes('[&>ul]:mb-0!'), 'tight both sides');
  const register = items.find((x) => x.textContent.includes('Register.'));
  assert.ok(register.className.includes('[&>ul]:mt-0!') && !register.className.includes('mb-0'), 'the last keeps its margin below');
  const structure = items.find((x) => x.textContent.includes('Structure.'));
  assert.ok(!structure.className.includes('mt-0'), 'the first keeps its margin above');
});
