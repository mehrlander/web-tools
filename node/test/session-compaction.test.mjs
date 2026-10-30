// Compaction summaries on the session page: lib/kits/session-render.js places
// each one among the turns by its `at`, and kits/session-export.js marks it on
// the outline row of the exchange it fell in.
//
// A record keeps them under `injected`, kind `compaction` (record schema 14,
// web-tools-private sessions/README.md). Before this nothing read them, so the
// summary a session continued from could not be found on any page.
//
// The pure half runs against a stub window, as session-render.test.mjs does;
// the DOM half loads the kits into jsdom, as session-export-open.test.mjs does.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot, withTraffic, makeWindow } from './bootstrap.mjs';

const stub = withTraffic({});
new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits/session-render.js'), 'utf8'))(
  stub, { createElement: () => ({ style: {}, append() {}, setAttribute() {} }) });
const { turns, groups, blocks, outline, find, compactions, summaryRuns, compactionLabel } = stub.sessionRender;

const at = (m, s = 0) => `2026-10-06T06:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}Z`;

const SUMMARY = 'This session is being continued from a previous conversation that ran out of context.\n\n'
  + 'Summary:\n1. Primary Request and Intent:\n   - Initial: make **one** change to `pages/session.html`.\n'
  + '2. Current Work:\nI was writing the <id>.json reader.\n';

// Two exchanges. The compaction falls inside the first, between two runs of
// work, which is where all 166 in the store fell on 2026-10-30.
const REC = {
  schema: 16, short: 'cafe1234', day: '2026-10-06',
  started: at(0), ended: at(30), exchanges: 2, prompts_stored: 2,
  prompts: [{ at: at(0), text: 'Read every compaction summary on the session page.' },
            { at: at(20), text: 'Now shoot it.' }],
  replies: [{ at: at(1), text: 'Let me look.' },
            { at: at(12), text: 'The summaries are placed among the turns, folded, by their time.' },
            { at: at(21), text: 'Here is the screenshot, taken at desktop width.' }],
  calls: [{ at: at(1), name: 'Bash', ok: true, arg: 'ls', body: 'a' },
          { at: at(9), name: 'Read', ok: true, bytes: 120 },
          { at: at(9, 30), name: 'Edit', ok: true, arg: 'x' }],
  injected: [
    { at: at(2), kind: 'skill', head: 'a skill', body: 'skill text' },
    { at: at(5), kind: 'compaction', chars: 15092, head: SUMMARY.slice(0, 40), body: SUMMARY },
  ],
};

const shape = list => list.map(t => t.role).join(',');

test('a compaction is a turn placed by its time among the asks, replies and calls', () => {
  const t = turns(REC);
  assert.equal(shape(t), 'user,assistant,tool,compaction,tool,tool,assistant,user,assistant');
  const c = t.find(x => x.role === 'compaction');
  assert.equal(c.md, SUMMARY, 'the body is carried whole');
  assert.equal(c.chars, 15092, 'the size is the record\'s own count');
  assert.equal(c.ts, '06:05:00');
});

test('only the compaction kind is read; skills and notifications stay out', () => {
  assert.equal(compactions(REC).length, 1);
  assert.ok(!turns(REC).some(t => t.md === 'skill text'));
});

test('a record without compactions merges exactly as it did', () => {
  const plain = { ...REC, injected: REC.injected.filter(x => x.kind !== 'compaction') };
  assert.equal(shape(turns(plain)), 'user,assistant,tool,tool,tool,assistant,user,assistant');
});

test('at a shared instant the summary sorts after the ask and before the work it resumed', () => {
  const same = { ...REC, injected: [{ at: at(9), kind: 'compaction', chars: 3, body: 'abc' }] };
  const t = turns(same);
  const i = t.findIndex(x => x.role === 'compaction');
  assert.equal(t[i + 1].src?.name, 'Read', 'the call at the same second follows the summary');
});

test('the compaction stays in the exchange it interrupted and splits the work around it', () => {
  const cards = groups(turns(REC));
  assert.equal(cards.length, 2, 'it opens no card of its own');
  assert.ok(cards[0].some(t => t.role === 'compaction'));
  const b = blocks(cards[0]);
  const ci = b.findIndex(x => x.turn?.role === 'compaction');
  assert.ok(ci > 0, 'the compaction is a block of its own');
  assert.ok(b[ci - 1].tools && b[ci + 1].tools,
    'the work before and after it are two folds, not one sequence hiding the summary');
});

test('the outline row keeps its title and turn count, and counts the compaction apart', () => {
  const plain = { ...REC, injected: [] };
  const [a, b] = [outline(REC)[0], outline(plain)[0]];
  assert.equal(a.title, b.title);
  assert.equal(a.turns, b.turns, 'the harness\'s summary is not a turn of the conversation');
  assert.equal(a.compactions, 1);
  assert.equal(b.compactions, 0);
});

test('a compaction ahead of the first ask joins that ask\'s card', () => {
  const early = { ...REC, injected: [{ at: '2026-10-06T05:59:00Z', kind: 'compaction', chars: 3, body: 'abc' }] };
  const cards = groups(turns(early));
  assert.equal(cards.length, 2);
  assert.equal(shape(cards[0].slice(0, 2)), 'compaction,user');
  assert.equal(outline(early)[0].exchange, 1);
});

test('a card holding only a compaction and work is titled by its work, not the boilerplate', () => {
  const resumed = { schema: 16, prompts: [], replies: [],
    calls: [{ at: at(6), name: 'Bash', ok: true, arg: 'ls' }],
    injected: [{ at: at(5), kind: 'compaction', chars: 3, body: SUMMARY }] };
  const row = outline(resumed)[0];
  assert.doesNotMatch(row.title, /being continued/);
});

test('find does not search a compaction summary', () => {
  assert.equal(find(REC, 'Primary').total, 0);
  assert.equal(find(REC, 'placed').total, 1);
});

test('the label names the compaction and its size', () => {
  assert.equal(compactionLabel(compactions(REC)[0]), 'Context compaction · 15,092 chars');
});

test('a summary keeps every line, marks bold and code, and reads nothing as HTML', () => {
  const runs = summaryRuns(SUMMARY);
  assert.equal(runs.map(r => r.text).join(''), SUMMARY.replace('**one**', 'one').replace('`pages/session.html`', 'pages/session.html'),
    'only the two marks\' delimiters are dropped');
  assert.deepEqual(runs.filter(r => r.kind !== 'text'),
    [{ text: 'one', kind: 'strong' }, { text: 'pages/session.html', kind: 'code' }]);
  assert.ok(runs.some(r => r.kind === 'text' && r.text.includes('<id>.json')), 'a bare tag stays text');
});

test('inside a fence nothing is read as a mark, and the fence is kept whole', () => {
  const text = 'Before `a`.\n```js\nconst s = `x` + **y**;\n```\nAfter **b**.\n';
  const runs = summaryRuns(text);
  assert.equal(runs.map(r => r.text).join('').length, text.length - 6, 'four backticks and four stars, outside the fence');
  const fence = runs.find(r => r.kind === 'fence');
  assert.equal(fence.text, '```js\nconst s = `x` + **y**;\n```\n');
  assert.deepEqual(runs.filter(r => r.kind === 'strong' || r.kind === 'code').map(r => r.text), ['a', 'b']);
});

// ── The DOM half ───────────────────────────────────────────────────────────
const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener(){}, removeEventListener(){} }));
const mdHtml = (md) => String(md).split(/\n{2,}/).map(x => `<p>${x}</p>`).join('');
window.marked = globalThis.marked = {
  lexer: (md) => String(md).split(/\n{2,}/).map(raw => ({ type: 'paragraph', raw })),
  parser: (toks) => mdHtml(toks.map(t => t.raw).join('\n\n')),
  parse: mdHtml,
};
for (const f of ['lib/kits/proof.js', 'lib/kits/swipe-deck.js', 'lib/kits/chat-render.js',
                 'lib/kits/session-render.js', 'lib/kits/session-export.js']) {
  new window.Function(readFileSync(path.join(repoRoot, f), 'utf8'))();
}

test('the deck draws a closed fold where the compaction fell, and builds its body on open', async () => {
  const host = window.document.createElement('div');
  await window.sessionRender.card(window.sessionRender.groups(window.sessionRender.turns(REC))[0], host);
  const fold = host.querySelector('details[data-compaction]');
  assert.ok(fold, 'a fold');
  assert.equal(fold.open, false, 'closed at rest');
  assert.match(fold.querySelector('summary').textContent, /Context compaction · 15,092 chars/);
  assert.equal(fold.querySelector('[data-compaction-body]'), null, 'nothing built before it is opened');
  const order = [...host.children].map(n => n.matches('details[data-compaction]') ? 'C' : n.tagName === 'DETAILS' ? 'W' : 'T');
  assert.deepEqual(order.slice(0, 4), ['T', 'W', 'C', 'W'], 'ask, work, the compaction, work');
  fold.open = true;
  fold.dispatchEvent(new window.Event('toggle'));
  const body = fold.querySelector('[data-compaction-body]');
  assert.ok(body.className.includes('whitespace-pre-wrap'), 'line breaks are kept by the box');
  assert.equal(body.textContent, SUMMARY.replace('**one**', 'one').replace('`pages/session.html`', 'pages/session.html'));
  assert.equal(body.querySelector('.font-semibold').textContent, 'one');
});

test('the outline row of that exchange carries one quiet line, and its panel holds the summary', async () => {
  const view = window.sessionExport.index(REC, {});
  window.document.body.replaceChildren(view.el);
  const rows = [...window.document.querySelectorAll('[data-card]')];
  assert.equal(rows.length, 2);
  const line = rows[0].querySelector('[data-compaction]');
  assert.ok(line, 'the first row marks it');
  assert.equal(rows[1].querySelector('[data-compaction]'), null, 'the second does not');
  assert.equal(line.textContent, 'Context compaction · 15,092 chars');
  const kids = [...rows[0].children];
  assert.ok(kids.indexOf(line) < kids.indexOf(rows[0].querySelector('.ph-sparkle')),
    'it sits above the reply it came before');
  line.click();
  const body = window.document.querySelector('[data-compaction-body]');
  assert.ok(body, 'the panel opened on the summary');
  assert.match(body.textContent, /Primary Request and Intent:\n {3}- Initial/);
});
