// kits/root-has-prune.js — daisyUI's :root:has() rules taken out of a loaded
// stylesheet. The browser side (a CORS-mode link, the CSSOM edit) is measured
// in a render; what is held here is the part that decides what is removed:
// splitting a selector list at the right commas, keeping every alternative
// that is not anchored on :root:has(), and deleting only a rule left with
// none, at any depth.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKit } from './bootstrap.mjs';

const w = {};
loadKit('root-has-prune', { window: w });
const { RootHasPrune } = w;

test('kit surface', () => {
  assert.deepEqual(Object.keys(RootHasPrune).sort(), ['prune', 'run', 'split', 'strip']);
});

test('split cuts at top-level commas only', () => {
  assert.deepEqual(RootHasPrune.split(':root,:root:has(input.theme-controller[value=light]:checked),[data-theme=light]'),
    [':root', ':root:has(input.theme-controller[value=light]:checked)', '[data-theme=light]']);
  assert.deepEqual(RootHasPrune.split(':is(.a, .b) > .c, [title="x,y"]'), [':is(.a, .b) > .c', '[title="x,y"]']);
});

test('strip keeps every alternative that is not anchored on :root:has()', () => {
  assert.equal(RootHasPrune.strip(':root,:root:has(input.theme-controller[value=light]:checked),[data-theme=light]'),
    ':root, [data-theme=light]');
  assert.equal(RootHasPrune.strip(':root:has(.drawer-open>.drawer-toggle:checked)'), '');
  assert.equal(RootHasPrune.strip(':where(:root:has(.drawer-toggle:checked))'), '');
  assert.equal(RootHasPrune.strip('.join:has(> input)'), '.join:has(> input)', 'an element-scoped :has() stays');
});

// A stylesheet-shaped object: rules with selectorText and, for grouping and
// nested rules, their own cssRules and deleteRule.
const rule = (selectorText, kids) => {
  const r = { selectorText };
  if (kids) { r.cssRules = kids; r.deleteRule = (i) => kids.splice(i, 1); }
  return r;
};
const group = (kids) => ({ cssRules: kids, deleteRule: (i) => kids.splice(i, 1) });

test('prune rewrites a mixed list, deletes an all-root list, and reaches nested and grouped rules', () => {
  const nested = rule('.modal-open', [rule(':root:has(&)'), rule('.inner')]);
  const layer = group([rule(':root:has(.drawer-toggle:checked)'), nested, rule('.btn')]);
  const sheet = group([
    rule(':root,:root:has(input.theme-controller[value=light]:checked),[data-theme=light]'),
    layer,
  ]);
  const n = RootHasPrune.prune(sheet);
  assert.deepEqual(n, { rewritten: 1, removed: 2 });
  assert.equal(sheet.cssRules[0].selectorText, ':root, [data-theme=light]');
  assert.deepEqual(layer.cssRules.map(r => r.selectorText), ['.modal-open', '.btn']);
  assert.deepEqual(nested.cssRules.map(r => r.selectorText), ['.inner']);
});

test('a sheet whose rules cannot be read is left alone', () => {
  const sheet = { get cssRules() { throw new Error('SecurityError'); } };
  assert.deepEqual(RootHasPrune.prune(sheet), { rewritten: 0, removed: 0 });
});
