// alpineComponents/user-call-form.js — the Critic view's By edit face: each of
// a documentation call's edits with the critic's trips on it in run order,
// each followed by the change that answered it, ending on the last run's
// verdict, and a last thread for the trips outside every edit. A call whose
// critic tagged its trips (E1, E-) is placed by the tags through each run's
// spans, and a change answers the trips the session linked it to; a call
// recorded before the tags (the b2664d00 pilot) is placed by inference from
// each quote and the recorded changes, at paragraph grain within each edit's
// new text, and says so. Two calls mounted side by side over a fake GH, with
// md-diff stubbed and the real linked-swiper kit, as in
// user-call-form-review.test.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const STORE = 'me/private';
const T = (peeve, o) => ({ peeve, where: 'w', clause: 'Why it trips.', ...o });
// The upgraded record: two edits, three runs, every trip tagged.
const R1 = '**Trips**\n- P05 · E1 · a · "with no base, the default branch" · x\n- P12 · E1 · b · "The end now" · x\n'
  + '- P08 · E2 · c · "The base ref is" · x\n- P04 · E- · d · "so that the lines" · x\n\nVerdict: FAIL';
const R2 = '**Trips**\n- P74 · E2 · e · "The base ref is the branch" · x\n\nVerdict: FAIL';
const R3 = '**Trips**\n- P03 · E- · f · "Another paragraph" · x\n\nVerdict: PASS';
const TAGGED = { id: 'c0ffee04-tagged', session: 'c0ffee04', kind: 'documentation', question: 'Apply 2 edits to docs/x.md?',
  brief: 'Names the key.', file: 'me/widget@main:docs/x.md', status: 'closed', closed: { at: '2026-11-20T00:00:00+00:00', answer: 'Approved', note: '' },
  edits: [{ from: 'One.', to: 'Without a base, the default branch stands in.', why: 'names the default' },
          { from: 'Two.', to: 'The base ref names the branch.', why: 'names the ref' }],
  review: { runs: [
    { verdict: 'fail', report: R1, edits: [{ lines: [3, 3], edit: 1 }, { lines: [5, 5], edit: 2 }],
      trips: [T('P05', { edit: 1, quote: 'with no base, the default branch', answer: 'changed' }),
              T('P12', { edit: 1, quote: 'The end now', answer: 'kept', why: 'A misquote; the words read fine.', misquoted: true }),
              T('P08', { edit: 2, quote: 'The base ref is', answer: 'kept', why: 'The ref is named once.' }),
              T('P04', { edit: 0, quote: 'so that the lines' })],
      changes: [{ from: 'with no base, the default branch', to: 'Without a base, the default branch stands in.', answers: [1] },
                { from: 'The base ref is the branch.', to: 'The base ref is the branch it names.' }], reflow: 2 },
    { verdict: 'fail', report: R2, edits: [{ lines: [5, 5], edit: 2 }],
      trips: [T('P74', { edit: 1, quote: 'The base ref is the branch', answer: 'changed' })],
      changes: [{ from: 'The base ref is the branch it names.', to: 'The base ref names the branch.' }] },
    { verdict: 'pass', report: R3, edits: [{ lines: [3, 3], edit: 1 }, { lines: [5, 5], edit: 2 }],
      trips: [T('P03', { edit: 0, quote: 'Another paragraph' })] },
  ] } };
// A pilot record: no tags and no links, so every place is inferred.
const P1 = '**Trips**\n- P05 · the new paragraph · "with no base, the default branch" · x\n'
  + '- P06 · the last paragraph · "A second paragraph names the key" · x\n- P24 · somewhere · "have home and budget-drs" · x\n\nVerdict: FAIL';
const PILOT = { id: 'c0ffee04-pilot', session: 'c0ffee04', kind: 'documentation', question: 'Apply 1 edit to docs/y.md?',
  brief: 'Adds the mode.', file: 'me/widget@main:docs/y.md', status: 'closed', closed: { at: '2026-11-20T00:00:00+00:00', answer: 'Approved', note: '' },
  edits: [{ from: 'Intro.', to: 'Intro.\n\nThe changes mode marks edits, without a base the default branch.\n\nA second paragraph names the key.', why: 'adds the mode' }],
  review: { runs: [
    { verdict: 'fail', report: P1,
      trips: [T('P05', { quote: 'with no base, the default branch', answer: 'changed' }),
              T('P06', { quote: 'A second paragraph names the key', answer: 'kept', why: 'It is the key.' }),
              T('P24', { quote: 'have home and budget-drs', answer: 'kept', why: 'Not in the text.' })],
      changes: [{ from: 'The changes mode marks edits, with no base, the default branch.', to: 'The changes mode marks edits, without a base the default branch.' }] },
    { verdict: 'pass', report: '**Trips**\nNone.', trips: [] },
  ] } };
const CALLS = { 'user-calls/c0ffee04-tagged.json': TAGGED, 'user-calls/c0ffee04-pilot.json': PILOT };
const PEEVES = 'id,name,area,peeve\nP03,Unexplained jargon,writing,x\nP04,Thin,writing,x\nP05,Vague writing,writing,x\nP06,Loose referent,writing,x\n'
  + 'P08,Say a thing once,writing,x\nP12,One name,writing,x\nP24,Link what you mention,writing,x\nP74,Two claims,writing,x\n';
class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || ''; }
  async get(p) {
    if (this.repo === STORE && CALLS[p]) return { text: JSON.stringify(CALLS[p]) };
    if (this.repo === 'mehrlander/web-tools' && p === 'skills/peeves/peeves.csv') return { text: PEEVES };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req() { return {}; }
  static FRESH = { cache: 'no-store' };
}

const { window, problems } = makeWindow({ html: `<!doctype html><html><body>
  <div id="tagged" x-data="userCallForm(window.__tagged)"></div>
  <div id="pilot" x-data="userCallForm(window.__pilot)"></div></body></html>` });
window.GH = FakeGH;
window.TOKEN = 'tkn';
window.gh = { load: async () => {} };
window.AssistantMark = { shortBranch: (b) => String(b || '') };
const inlined = [];
window.mdDiff = {
  render: async () => ({ goto: () => {}, onMove: (cb) => cb({ at: -1 }) }),
  inline: async (a, b) => { inlined.push({ a, b }); const el = window.document.createElement('div'); el.dataset.inline = ''; el.textContent = b; return el; },
};
window.Diff = {};
window.MdSurface = { patch: () => '' };
window.__tagged = { src: STORE + ':user-calls/c0ffee04-tagged.json' };
window.__pilot = { src: STORE + ':user-calls/c0ffee04-pilot.json' };

const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
for (const k of ['lib/kits/repo-address.js', 'lib/kits/call-answer.js']) {
  new window.Function('window', readFileSync(path.join(repoRoot, k), 'utf8'))(window);
}
for (const p of ['lib/vanilla-bundle.js', 'lib/alpine-bundle.js', 'lib/kits/csv.js', 'lib/kits/linked-swiper.js', 'lib/alpineComponents/user-call-form.js']) {
  new window.Function(readFileSync(path.join(repoRoot, p), 'utf8'))();
}
Alpine.start();
const until = async (ok) => { for (let i = 0; i < 80 && !ok(); i++) await tick(2); return ok(); };
const form = (id) => {
  const root = window.document.getElementById(id);
  return { root, data: () => Alpine.$data(root), $: (s) => root.querySelector(s), $$: (s) => [...root.querySelectorAll(s)] };
};
const A = form('tagged'), B = form('pilot');
for (const f of [A, B]) {
  await until(() => f.data().doc.ready && f.$('[data-doc-view="critic"]'));
  f.$('[data-doc-view="critic"]').click();
  await until(() => f.$('[data-thread-card]'));
}
const pills = (row) => [...row.querySelectorAll('[data-run-peeve]')].map((p) => p.textContent);
const items = (card) => [...card.querySelectorAll('[data-run-trip], [data-thread-change], [data-thread-run]')]
  .map((x) => x.dataset.threadRun != null ? 'run ' + (+x.dataset.threadRun + 1) : x.dataset.threadChange ? 'change ' + x.dataset.threadChange
    : x.querySelector('.badge.font-mono').textContent);
const show = async (f, key) => {
  f.$(`[data-thread-list] [data-thread="${key}"]`).click();
  await until(() => f.$(`[data-thread-card="${key}"]`));
  return f.$(`[data-thread-card="${key}"]`);
};

test('mounting is quiet', () => assert.deepEqual(problems, []));

test('By edit lists the call\'s edits, each with the peeves tripped on it, and a last row for the trips outside every edit', () => {
  assert.equal(A.$('[data-critic-show="edit"]').getAttribute('aria-checked'), 'true');
  const rows = A.$$('[data-thread-list] [data-thread]');
  assert.deepEqual(rows.map((r) => r.dataset.thread), ['1', '2', 'out']);
  assert.deepEqual(rows.map(pills), [['P05', 'P12'], ['P08', 'P74'], ['P04', 'P03']]);
  assert.match(rows[0].textContent, /names the default/, 'a row names its edit by its why');
  assert.ok(rows[1].querySelector('[data-run-peeve="P08"]').className.includes('bg-warning/30'), 'a kept finding in the warning hue');
  const many = A.data().criticPeeveCounts([{ peeve: 'P74' }, { peeve: 'P05' }, { peeve: 'P74', answer: 'kept' }]);
  assert.equal(many.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), 'P74 ×2 P05', 'a peeve tripped twice on an edit is one pill with its count');
});

test('an edit\'s thread: its trips run by run, each followed by the change the session linked to it, ending on the last run', async () => {
  const card = await show(A, '1');
  assert.deepEqual(items(card), ['run 1', 'P05', 'change 0.0', 'P12']);
  assert.match(card.querySelector('[data-thread-end]').textContent, /Run 3 · Pass/);
  assert.ok(card.querySelector('[data-trip-misquoted]'), 'a quote not in the text is marked');
  assert.equal(card.querySelector('[data-trip-inferred], [data-change-inferred]'), null, 'a tagged and linked trip is not inferred');
  assert.equal(card.querySelector('[data-trip-edit]'), null, 'the thread names the edit, so a trip does not');
  await until(() => card.querySelector('[data-thread-change] [data-inline]'));
  assert.equal(card.querySelector('[data-thread-change] [data-inline]').textContent, 'Without a base, the default branch stands in.');
});

test('a trip with no linked change is answered by inference, and says so', async () => {
  const card = await show(A, '2');
  assert.deepEqual(items(card), ['run 1', 'P08', 'run 2', 'P74', 'change 1.0']);
  assert.ok(card.querySelector('[data-thread-change="1.0"] [data-change-inferred]'));
  assert.ok(card.querySelector('[data-trip-why]'), 'a kept trip shows why');
});

test('the trips outside every edit are a thread of their own, each with its tag', async () => {
  const card = await show(A, 'out');
  assert.deepEqual(items(card), ['run 1', 'P04', 'run 3', 'P03']);
  assert.deepEqual([...card.querySelectorAll('[data-trip-edit]')].map((x) => x.textContent), ['outside', 'outside']);
});

test('By run counts the rewrapped blocks apart, tags each trip, and marks a misquote', async () => {
  A.$('[data-critic-show="run"]').click();
  await until(() => A.$('[data-run-card="0"]'));
  const card = A.$('[data-run-card="0"]');
  assert.match(card.querySelector('[data-run-reflow]').textContent, /2 blocks rewrapped/);
  assert.deepEqual([...card.querySelectorAll('[data-trip-edit]')].map((x) => x.textContent), ['E1', 'E1', 'E2', 'outside']);
  assert.ok(card.querySelector('[data-run-trip="1"] [data-trip-misquoted]'));
  const passRow = A.$('[data-review-list] [data-run="2"]');
  assert.match(passRow.textContent, /Pass/, 'a run whose only trip is outside the edits passes');
  assert.ok(passRow.querySelector('[data-run-peeve="P03"]').className.includes('opacity-50'), 'its trip outside shows faint');
  assert.match(A.$('[data-critic-flag]').dataset.titleTip, /1 quote not in the text the run read/);
  A.$('[data-critic-show="edit"]').click();
  await until(() => A.$('[data-thread-root]').style.display === '');
  assert.equal(A.$('[data-review-root]').style.display, 'none');
});

test('a pilot record is placed by inference, at a paragraph of the edit\'s new text, and a quote in no text is not placed', async () => {
  const rows = B.$$('[data-thread-list] [data-thread]');
  assert.deepEqual(rows.map((r) => r.dataset.thread), ['1', 'out']);
  const card = await show(B, '1');
  assert.deepEqual(items(card), ['run 1', 'P05', 'change 0.0', 'P06']);
  const trips = [...card.querySelectorAll('[data-run-trip]')];
  assert.deepEqual(trips.map((t) => t.querySelector('[data-trip-para]')?.textContent), ['¶2', '¶3']);
  assert.ok(B.$('[data-thread-card-host] [data-ls="head"] [data-thread-inferred]'), 'the card head says the places are inferred, once');
  assert.equal(card.querySelector('[data-trip-inferred], [data-change-inferred]'), null, 'so no trip or change repeats it');
  assert.equal(A.$('[data-thread-inferred]'), null, 'a tagged record is not inferred');
  const out = await show(B, 'out');
  assert.deepEqual(items(out), ['run 1', 'P24']);
  assert.ok(out.querySelector('[data-trip-lost]'), 'a quote found nowhere is marked as not placed');
});
