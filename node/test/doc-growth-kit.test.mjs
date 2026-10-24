// kits/doc-growth.js: the arithmetic behind the Map's Growth tab and the
// full-page chart. What breaks without these: a file a commit hook writes
// ranked as a document someone tends; a file that no longer exists ranked by
// its last size; a session's reads counted at a sample before it happened, or
// left out of the last sample because the payload is older than the reads; a
// startup load added to the sessions that opened a file; a ranking that orders
// by one count when another was asked for; and a file filed under the wrong
// kind, which the tab filters and colours by.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const win = {};
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/doc-growth.js'), 'utf8'))(win);
const G = win.DocGrowth;

// Three samples a week apart; `e` is edits in each sample's week.
const file = (p, w, e, extra = {}) => ({ p, g: 0, w, e, born: 0, edits: e.reduce((x, y) => x + y, 0), ...extra });
const payload = () => ({
  days: 7, frames: ['2026-10-01', '2026-10-08', '2026-10-15'], groups: ['docs'],
  files: [
    file('docs/short.md', [200, 300, 300], [2, 3, 3]),
    file('docs/long.md', [3000, 4000, 4000], [5, 5, 10]),
    file('docs/README.md', [500, 500, 500], [9, 9, 9], { gen: 1 }),
    file('chron/2026/10/note.md', [100, 100, 100], [9, 9, 9]),
    file('docs/gone.md', [800, 800, null], [5, 5, 0]),
    file('docs/once.md', [400, 400, 400], [1, 0, 0]),
  ],
});
// The reads data file's rows for this repo, days after `from` (2026-09-30):
// short.md opened on 10-01, 10-09 and 10-20 (after the last sample), long.md
// once, CLAUDE-like presence on note.md that must never count as opening it.
const FROM = '2026-09-30';
const ROWS = {
  'docs/short.md': { opened: [1, 9, 20], context: [], via: { shell: 2, tool: 1 } },
  'docs/long.md': { opened: [8], context: [], via: { skill: 1 } },
  'chron/2026/10/note.md': { opened: [], context: [1, 2, 8, 9, 15] },
};
const data = G.join(payload(), ROWS, FROM);

test('join counts each session at the first sample on or after its day, and the last sample counts them all', () => {
  const short = data.files.find(f => f.p === 'docs/short.md');
  assert.deepEqual(short.o, [1, 1, 3], 'the 10-09 read lands at 10-15, and the 10-20 one at the last sample');
  assert.deepEqual(short.ec, [2, 5, 8], 'edits to date');
  assert.equal(short.opened, 3);
  assert.equal(short.lastRead, '2026-10-20');
});

test('being in context at startup is kept apart and never added to opening', () => {
  const note = data.files.find(f => f.p === 'chron/2026/10/note.md');
  assert.deepEqual(note.o, [0, 0, 0]);
  assert.equal(note.ctx, 5);
  assert.equal(G.rank(data).find(r => r.p === 'chron/2026/10/note.md').o, 0);
});

test('without reads every file sits at zero and the payload says so', () => {
  const bare = G.join(payload(), null, '');
  assert.equal(bare.reads, false);
  assert.ok(bare.files.every(f => f.o.every(v => v === 0)));
  assert.equal(data.reads, true);
});

test('a file far larger than the rest sets a cap on bubble size, and a corpus without one sets none', () => {
  assert.equal(data.peak.cap, 0, 'the fixture\'s largest file is within sixteen times its 90th percentile');
  const big = payload();
  for (let i = 0; i < 10; i++) big.files.push(file('docs/n' + i + '.md', [500, 500, 500], [1, 0, 0]));
  big.files.push(file('data/dump.md', [200000, 200000, 200000], [1, 0, 0]));
  assert.equal(G.join(big, null, '').peak.cap, 16 * 4000, 'sixteen times the 90th-percentile file, docs/long.md');
});

test('rank leaves out hook-written files and files gone at the last sample, and keeps every other edited file', () => {
  assert.deepEqual(G.rank(data).map(r => r.p).sort(), ['chron/2026/10/note.md', 'docs/long.md', 'docs/once.md', 'docs/short.md']);
  assert.ok(!G.shown(data).some(f => f.gen), 'the chart draws no hook-written file either');
});

test('rank orders by sessions that opened it unless asked for another column', () => {
  const by = b => G.rank(data, { by: b }).map(r => r.p);
  assert.deepEqual(by('reads'), ['docs/short.md', 'docs/long.md', 'chron/2026/10/note.md', 'docs/once.md']);
  assert.deepEqual(G.rank(data).map(r => r.p), by('reads'));
  assert.deepEqual(by('edits'), ['chron/2026/10/note.md', 'docs/long.md', 'docs/short.md', 'docs/once.md']);
  assert.deepEqual(by('words'), ['docs/long.md', 'docs/once.md', 'docs/short.md', 'chron/2026/10/note.md']);
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
});

test('a bubble sits at its edits and its sessions, sized by its words; a mark draws the rest faint', () => {
  const calls = [];
  const cv = { clientWidth: 400, clientHeight: 300, width: 0, height: 0,
    getContext: () => new Proxy({}, { get: (t, k) => k in t ? t[k] : (typeof k === 'string' && /^[a-z]/.test(k) ? (...a) => calls.push([k, ...a]) : undefined),
                                      set: (t, k, v) => { t[k] = v; if (k === 'fillStyle') calls.push(['fill=', v]); return true; } }) };
  globalThis.getComputedStyle = () => ({ color: 'rgb(11,11,11)' });
  const pts = G.draw(cv, data, { t: 2, mark: new Set(['docs/long.md']), hue: f => f.p === 'docs/long.md' ? 1 : -1 });
  assert.equal(pts.at(-1).f.p, 'docs/long.md', 'the marked file draws last, on top');
  assert.ok(calls.some(c => c[0] === 'fill=' && c[1] === G.LIGHT[1]), 'its hue is the slot the function gave');
  const at = p => pts.find(q => q.f.p === p);
  assert.ok(at('chron/2026/10/note.md').x > at('docs/short.md').x, 'more edits sits further right');
  assert.ok(at('docs/short.md').y < at('docs/long.md').y, 'more sessions sits higher');
  assert.ok(at('docs/long.md').r > at('docs/short.md').r, 'more words is a larger bubble');
  assert.ok(Math.abs(at('chron/2026/10/note.md').y - at('docs/once.md').y) <= 24, 'presence alone leaves a file at zero, spread no more than its offsets');
  assert.ok(!pts.some(q => q.f.p === 'docs/gone.md'), 'a file gone at the sample is not drawn');
});
