// kits/call-answer.js — answering a documentation user call, for Dictate and
// the Docs tab of the Map view alike.
//
// What can go wrong is an answer line that says something other than what the
// owner decided: an edit staged in the wrong place or twice, a patch carrying
// an edit that was discarded, a summary that miscounts, or the line written
// somewhere user-call.py's `answers` does not look. The page halves (how each
// surface arrives at a decision) are covered by node/test/dictate-page.mjs
// and node/test/map-view.test.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const src = readFileSync(path.join(repoRoot, 'lib/kits/call-answer.js'), 'utf8');
const addr = readFileSync(path.join(repoRoot, 'lib/kits/repo-address.js'), 'utf8');
const load = (extra = {}) => {
  const window = { ...extra };
  new Function('window', addr)(window);
  new Function('window', src)(window);
  return { A: window.CallAnswer, window };
};

const BASE = 'A first paragraph.\n\nThe second   paragraph,\nwrapped.\n\nA third.\n';

test('an edit is found exactly, or across any run of whitespace, and once', () => {
  const { A } = load();
  assert.deepEqual(A.spans(BASE, 'A third.'), [[BASE.indexOf('A third.'), BASE.indexOf('A third.') + 8]]);
  assert.equal(A.spans(BASE, 'The second paragraph, wrapped.').length, 1, 'a re-wrap is still the same text');
  assert.equal(A.spans(BASE, 'A ').length, 2);
  assert.deepEqual(A.spans(BASE, '   '), [], 'blank text is found nowhere');
});

test('each edit gets its standing in the text, and only the staged go in', () => {
  const { A } = load();
  const edits = [
    { from: 'A first paragraph.', to: 'The first paragraph.' },   // staged
    { from: 'gone text', to: 'A third.' },                         // applied: the file already says it
    { from: 'gone text', to: 'never written' },                    // stale
    { from: 'A ', to: 'An ' },                                     // ambiguous: twice
  ];
  const { text, status } = A.stage(BASE, edits);
  assert.deepEqual(status, ['staged', 'applied', 'stale', 'ambiguous']);
  assert.match(text, /^The first paragraph\./);
  assert.match(text, /A third\./);
});

test('two edits over the same words: the later one in the file is staged, the other overlaps', () => {
  const { A } = load();
  const { status } = A.stage(BASE, [{ from: 'first paragraph.', to: 'x' }, { from: 'A first', to: 'y' }]);
  assert.deepEqual(status, ['staged', 'overlap']);
});

test('the text a patch is cut from carries the confirmed edits and nothing else', () => {
  const { A } = load();
  const edits = [{ from: 'A first paragraph.', to: 'One.' }, { from: 'A third.', to: 'Three.' }];
  const next = A.withConfirmed(BASE, edits, ['discarded', 'confirmed']);
  assert.match(next, /A first paragraph\./, 'the discarded edit is not in it');
  assert.match(next, /Three\.\n$/);
  assert.equal(A.withConfirmed(BASE, edits, ['open', 'open']), BASE, 'nothing confirmed, nothing changed');
});

test('the summary counts each decision in one fixed order', () => {
  const { A } = load();
  assert.equal(A.summary(['discarded', 'confirmed', 'stale', 'confirmed']), '2 confirmed, 1 discarded, 1 stale');
  assert.equal(A.summary([]), '');
});

test('the answer line has the shape user-call.py reads, notes only when there are some', () => {
  const { A } = load();
  const e = A.entry({ decisions: [{ edit: 1, decision: 'confirmed' }, { edit: 2, decision: 'discarded', note: 'too strong' }],
                      note: '  thanks  ', call: 'o/r:user-calls/x.json', file: 'o/r:docs/a.md', patch: 'diff', apply: 'session' });
  assert.equal(e.answer, '1 confirmed, 1 discarded');
  assert.equal(e.note, 'thanks');
  assert.ok(!Number.isNaN(Date.parse(e.at)));
  assert.deepEqual(Object.keys(e), ['answer', 'note', 'at', 'call', 'file', 'decisions', 'patch', 'apply']);
  assert.deepEqual(A.entry({ decisions: [], call: 'c', file: 'f', notes: [{ on: 'x', note: 'y' }] }).notes, [{ on: 'x', note: 'y' }]);
});

test("a call's document is read where its address says, at main when it names no ref", () => {
  const { A } = load();
  assert.deepEqual({ ...A.fileOf({ file: 'mehrlander/web-tools@main:docs/CONVERSATION.md' }) },
    { repo: 'mehrlander/web-tools', ref: 'main', path: 'docs/CONVERSATION.md' });
  assert.equal(A.fileOf({ file: 'o/r:a/b.md' }).ref, 'main');
  assert.equal(A.fileOf({ file: 'nonsense' }), null);
});

test('the line goes beside the call, and on its PR only when asked', async () => {
  const posted = [];
  const UserCallForm = { prOf: (s) => (s ? { slug: 'o/r', n: 7 } : null), postAnswer: async (o) => { posted.push(o); return o.entry; } };
  const { A } = load({ UserCallForm });
  const call = { id: 'x-call', question: 'Apply 2 edits?', pr: 'o/r#7' };
  const entry = { answer: '1 confirmed', note: '', patch: 'diff' };
  await A.record({ where: { repo: 'o/store', ref: '', path: 'user-calls/x-call.json' }, call, entry, token: 't', from: 'the Docs tab' });
  await A.record({ where: { repo: 'o/store', ref: 'main', path: 'user-calls/x-call.json' }, call, entry, token: 't', comment: true, from: 'the Docs tab' });
  assert.equal(posted[0].path, 'user-calls/x-call.answers.jsonl');
  assert.equal(posted[0].ref, undefined, 'no ref is the store\'s default branch');
  assert.equal(posted[0].pr, null, 'not on the PR unless asked');
  assert.deepEqual(posted[1].pr, { slug: 'o/r', n: 7 });
  assert.match(posted[1].comment, /^\*\*User call: Apply 2 edits\?\*\*/);
  assert.match(posted[1].comment, /for a session to apply/);
  assert.match(posted[1].comment, /x-call, answered in the Docs tab\._$/);
});

// A session commits its edits before it files the call (doc-craft), so the
// call's ref already holds them. What can go wrong is a call that shows every
// edit as already applied, with nothing to decide, or an answer whose patch
// cannot apply to the branch: one built against the base, putting in edits the
// branch already has.
const COMMITTED = [{ from: 'A first paragraph.', to: 'One.' }, { from: 'A third.', to: 'Three.' }];
const reader = (byRef) => async (ref) => { if (!(ref in byRef)) throw new Error('no ' + ref); return byRef[ref]; };
const stub = { MdSurface: { patch: (p, a, b) => JSON.stringify([p, a, b]) } };

test('a call filed after its edits are committed is decided on the text they replace, at its base', async () => {
  const { A } = load(stub);
  const head = A.stage(BASE, COMMITTED).text;
  const call = { file: 'o/r@topic:doc.md', base: 'main', edits: COMMITTED };
  const s = await A.source(call, reader({ topic: head, main: BASE }));
  assert.equal(s.base, BASE);
  assert.equal(s.committed, 'main');
  assert.deepEqual(s.status, ['staged', 'staged'], 'each edit is the owner\'s to keep or discard');
  const viaPr = await A.source({ ...call, base: undefined }, reader({ topic: head, main: BASE }), async () => 'main');
  assert.equal(viaPr.committed, 'main', 'a call naming a PR finds the base through it');
});

test("a committed call's patch takes the discarded edits back out of the branch, and keeping all needs none", async () => {
  const { A } = load(stub);
  const head = A.stage(BASE, COMMITTED).text;
  const kept = A.answerPatch({ path: 'doc.md', base: BASE, edits: COMMITTED, decisions: ['confirmed', 'confirmed'], committed: 'main' });
  assert.equal(kept, '', 'the branch already says what was decided');
  const [p, from, to] = JSON.parse(A.answerPatch({ path: 'doc.md', base: BASE, edits: COMMITTED, decisions: ['discarded', 'confirmed'], committed: 'main' }));
  assert.equal(p, 'doc.md');
  assert.equal(from, head, 'cut from the branch as it stands');
  assert.match(to, /^A first paragraph\./, 'the discarded edit is taken back out');
  assert.match(to, /Three\./, 'the kept one stays');
});

test('an uncommitted call is staged on the file as it names it, and its patch puts the confirmed edits in', async () => {
  const { A } = load(stub);
  const call = { file: 'o/r@main:doc.md', edits: COMMITTED };
  const s = await A.source(call, reader({ main: BASE }));
  assert.equal(s.committed, '');
  assert.equal(A.answerPatch({ path: 'doc.md', base: BASE, edits: COMMITTED, decisions: ['discarded', 'discarded'], committed: '' }), '');
  const [, from, to] = JSON.parse(A.answerPatch({ path: 'doc.md', base: BASE, edits: COMMITTED, decisions: ['confirmed', 'discarded'], committed: '' }));
  assert.equal(from, BASE);
  assert.match(to, /^One\./);
});

test("the PR comment says which way a committed call's patch runs", () => {
  const { A } = load();
  const call = { id: 'x', question: 'Keep 2 edits?' };
  assert.match(A.comment(call, { answer: '1 discarded', patch: 'd', base: 'main' }, 'the call form'), /discarded edits as a patch that takes them back out/);
  assert.match(A.comment(call, { answer: '1 confirmed', patch: 'd' }, 'the call form'), /confirmed edits as a patch/);
});
