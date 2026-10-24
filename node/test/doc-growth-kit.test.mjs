// kits/doc-growth.js: the arithmetic behind the Map's Growth tab and the
// full-page chart. What breaks without these: a file a commit hook writes
// ranked as a document someone tends; a file that no longer exists ranked by
// its last size; focused edits summed past the sample in view; a ranking that
// orders by count when density was asked for; and a file filed under the wrong
// kind, which the tab filters and colours by.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const win = {};
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/doc-growth.js'), 'utf8'))(win);
const G = win.DocGrowth;

// Three samples. `f` is focused edits per sample, `e` all edits.
const file = (p, w, f, extra = {}) => ({
  p, g: 0, w, r: w, e: f.map(x => x + 1), f, n: [0, 0, 0], born: 0,
  edits: f.reduce((a, b) => a + b + 1, 0), focused: f.reduce((a, b) => a + b, 0), ...extra,
});
const data = {
  days: 7, focus: 5, frames: ['2026-10-01', '2026-10-08', '2026-10-15'], groups: ['docs'],
  files: [
    file('docs/short.md', [200, 300, 300], [2, 3, 3]),           // 8 focused, 300 words
    file('docs/long.md', [3000, 4000, 4000], [5, 5, 10]),        // 20 focused, 4000 words
    file('docs/README.md', [500, 500, 500], [9, 9, 9], { gen: 1 }),
    file('chron/2026/10/note.md', [100, 100, 100], [9, 9, 9]),
    file('docs/gone.md', [800, 800, null], [5, 5, 0]),
    file('docs/rare.md', [400, 400, 400], [1, 1, 1]),            // 3 focused
  ],
};

test('rank leaves out hook-written files, files gone at the last sample and files under the minimum', () => {
  const rows = G.rank(data, { min: 5 });
  assert.deepEqual(rows.map(r => r.p), ['chron/2026/10/note.md', 'docs/short.md', 'docs/long.md']);
});

test('rank orders by focused edits per thousand words unless asked for the count or the words', () => {
  const dens = G.rank(data, { min: 5 });
  assert.deepEqual(dens.map(r => r.p), ['chron/2026/10/note.md', 'docs/short.md', 'docs/long.md']);
  assert.ok(Math.abs(dens[1].d - 1000 * 8 / 300) < 1e-9);
  assert.deepEqual(G.rank(data, { min: 5, by: 'count' }).map(r => r.p), ['chron/2026/10/note.md', 'docs/long.md', 'docs/short.md']);
  assert.deepEqual(G.rank(data, { min: 5, by: 'words' }).map(r => r.p), ['docs/long.md', 'docs/short.md', 'chron/2026/10/note.md']);
});

test('care sums focused edits only through the sample in view', () => {
  const f = data.files[1];
  assert.equal(G.care(f, 0), 5);
  assert.equal(G.care(f, 1), 10);
  assert.equal(G.care(f, 2), 20);
  assert.equal(G.care({ p: 'x.md' }, 2), 0);
});

test('the Care measure draws only what the ranking could hold', () => {
  const shown = G.shown(data, { y: 'care', min: 5 }).map(f => f.p);
  assert.ok(!shown.includes('docs/README.md'), 'a hook-written file');
  assert.ok(shown.includes('docs/short.md') && shown.includes('chron/2026/10/note.md'));
  assert.equal(G.shown(data, { y: 'churn', min: 5 }).length, data.files.filter(f => f.edits >= 5).length);
});

test('a payload without focused edits says so, and older payloads still chart', () => {
  assert.equal(G.hasCare(data), true);
  const old = { ...data, files: data.files.map(({ f, ...rest }) => rest) };
  assert.equal(G.hasCare(old), false);
  assert.deepEqual(G.rank(old, { min: 1 }), []);
  assert.ok(G.bounds(old).churn >= 4);
});

test('kind tells what a file is by its path alone, the first match winning', () => {
  const cases = {
    'CLAUDE.md': 'instructions', 'projects/x/AGENTS.md': 'instructions',
    'tracker/tasks/fix-x-ab12cd.md': 'task', 'projects/budget-drs/tracker/tasks/y.md': 'task',
    'chron/threads/naming-things.md': 'thread', 'chron/blog/2026-10-01-post.md': 'blog',
    'chron/2026/10/2026-10-01-entry.md': 'log', 'chron/dump/raw.md': 'log',
    'archive/wring/README.md': 'archive',
    'skills/tend/SKILL.md': 'skill', 'skills/agents/owner-proxy.md': 'agent',
    '.claude/agents/drs-budget-analyst.md': 'agent', 'lib/kits/README.md': 'readme',
    'skills/README.md': 'readme', 'skills/html-style/references/mechanics.md': 'reference',
    'tracker/README.md': 'readme', 'docs/agents.md': 'doc', 'docs/claude.md': 'doc',
  };
  for (const [p, k] of Object.entries(cases)) assert.equal(G.kind(p), k, p);
  assert.ok(Object.values(cases).every(k => G.KINDS.some(x => x.k === k)), 'every kind is a named one');
  assert.deepEqual(G.rank(data, { min: 5 }).map(r => [r.k, r.g]), [['log', 'docs'], ['doc', 'docs'], ['doc', 'docs']]);
});

test('a hue function colours each file, and a mark draws the rest faint', () => {
  const calls = [];
  const cv = { clientWidth: 400, clientHeight: 300, width: 0, height: 0,
    getContext: () => new Proxy({}, { get: (t, k) => k in t ? t[k] : (typeof k === 'string' && /^[a-z]/.test(k) ? (...a) => calls.push([k, ...a]) : undefined),
                                      set: (t, k, v) => { t[k] = v; if (k === 'fillStyle') calls.push(['fill=', v]); return true; } }) };
  globalThis.getComputedStyle = () => ({ color: 'rgb(11,11,11)' });
  const pts = G.draw(cv, data, { t: 2, y: 'care', unit: 'w', min: 5, groups: [], bounds: G.bounds(data),
    mark: new Set(['docs/long.md']), hue: f => f.p === 'docs/long.md' ? 1 : -1 });
  assert.equal(pts.at(-1).f.p, 'docs/long.md', 'the marked file draws last, on top');
  assert.ok(calls.some(c => c[0] === 'fill=' && c[1] === G.LIGHT[1]), 'its hue is the slot the function gave');
});
