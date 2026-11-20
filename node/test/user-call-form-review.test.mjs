// alpineComponents/user-call-form.js — a documentation call's review, the
// peeves critic's runs on its document, drawn as the Critic view beside the
// document's own: a row per run with its verdict and the peeves it tripped,
// and a card per run naming each trip's peeve from the peeves list, quoting
// its words, saying how the session answered it (a kept one with its reason)
// and drawing what changed before the next run. A run with no verdict shows
// its report. This file reads the By run face; user-call-form-threads.test.mjs
// reads By edit. Driven over a fake GH, with md-diff stubbed as in
// user-call-form-filed.test.mjs and the real linked-swiper kit.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const STORE = 'me/private';
const REPORT = '**Trips**\n- P05 · the new paragraph · "with no base, the default branch" · Unclear when.\n'
  + '- P08 · the paragraph · "The base ref is" · Said twice.\n\n**Clear**: P01, P07\n\nVERDICT: FAIL';
const CALL = { id: 'c0ffee03-doc', session: 'c0ffee03', kind: 'documentation', question: 'Apply 1 edit to docs/x.md?',
  brief: 'Names the key.', file: 'me/widget@main:docs/x.md', status: 'closed',
  closed: { at: '2026-11-20T00:00:00+00:00', answer: 'Approved', note: '' },
  edits: [{ from: 'One.', to: 'First.', why: 'clearer' }],
  review: { runs: [
    { verdict: 'fail', report: REPORT, clear: ['P01', 'P07'], candidates: ['A table cell that holds a condition.'], preexisting: [{ peeve: 'P04', text: '"thin on purpose"' }],
      trips: [{ peeve: 'P05', where: 'the new paragraph', quote: 'with no base, the default branch', clause: 'Unclear when.', answer: 'changed' },
              { peeve: 'P08', where: 'the paragraph', quote: 'The base ref is', clause: 'Said twice.', answer: 'kept', why: 'The row names the mode; the paragraph says when.' }],
      changes: [{ from: 'with no base, the default branch', to: 'Without a base, the default branch stands in.' }] },
    { verdict: 'unknown', report: 'I could not read the peeves list.', note: 'The next run could read it.', trips: [] },
    { verdict: 'pass', report: '**Trips**\nNone.\n\n**Clear**: P01, P05, P08', trips: [], clear: ['P01', 'P05', 'P08'] },
  ] } };
const PEEVES = 'id,name,area,peeve\nP01,Documentation bloat,writing,x\nP05,Vague writing,writing,x\nP07,Em dashes,writing,x\nP08,Say a thing once,writing,x\n';
const reads = [];
class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || ''; }
  async get(p) {
    reads.push(this.repo + '@' + this.ref + ':' + p);
    if (this.repo === STORE && p === 'user-calls/c0ffee03-doc.json') return { text: JSON.stringify(CALL) };
    if (this.repo === 'mehrlander/web-tools' && p === 'skills/peeves/peeves.csv') return { text: PEEVES };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req() { return {}; }
  static FRESH = { cache: 'no-store' };
}

const { window, problems } = makeWindow({ html: `<!doctype html><html><body>
  <div id="form" x-data="userCallForm(window.__form)"></div></body></html>` });
window.GH = FakeGH;
window.TOKEN = 'tkn';
window.gh = { load: async () => {} };
window.AssistantMark = { shortBranch: (b) => String(b || '') };
const drawn = [], inlined = [];
window.mdDiff = {
  render: async (host, a, b) => { drawn.push({ a, b }); return { goto: () => {}, onMove: (cb) => cb({ at: -1 }) }; },
  inline: async (a, b) => { inlined.push({ a, b }); const el = window.document.createElement('div'); el.dataset.inline = ''; el.textContent = b; return el; },
};
window.Diff = {};
window.MdSurface = { patch: () => '' };
window.__form = { src: STORE + ':user-calls/c0ffee03-doc.json' };

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
const root = () => window.document.getElementById('form');
const data = () => Alpine.$data(root());
const until = async (ok) => { for (let i = 0; i < 80 && !ok(); i++) await tick(2); return ok(); };
const $ = (s) => root().querySelector(s);
const $$ = (s) => [...root().querySelectorAll(s)];
await until(() => data().doc.ready && $('[data-doc-view="critic"]'));
const flag = () => $('[data-doc-view="critic"] [data-critic-flag]');
await until(() => flag()?.style.display === '');
const switchShown = { count: $('[data-doc-view="critic"] [data-critic-count]')?.textContent, flag: flag()?.style.display === '', tip: flag()?.dataset.titleTip };
const drawsBefore = drawn.length;
$('[data-doc-view="critic"]').click();
await until(() => $('[data-thread-card]') && $('[data-doc-scroll]').style.display === 'none');
const byEditFirst = { checked: $('[data-critic-show="edit"]')?.getAttribute('aria-checked'), runs: $('[data-review-root]').style.display };
$('[data-critic-show="run"]').click();
await until(() => $('[data-run-card]') && inlined.length);
const card = () => $('[data-review-card]');

test('mounting is quiet', () => assert.deepEqual(problems, []));

test('the Critic view sits in the document\'s switch, counting the runs and marking a finding kept', () => {
  assert.deepEqual($$('[data-doc-views] [data-doc-view]').map((b) => b.dataset.docView), ['old', 'changes', 'diff', 'new', 'critic']);
  assert.equal(switchShown.count, '3');
  assert.ok(switchShown.flag, 'a kept finding marks the switch');
  assert.equal(switchShown.tip, '1 finding kept as written');
  assert.equal($('[data-doc-scroll]').style.display, 'none', 'the document steps aside');
  assert.deepEqual(byEditFirst, { checked: 'true', runs: 'none' }, 'the Critic view opens By edit, with By run a tap away');
  assert.equal($('[data-doc-review]').style.display, '');
});

test('a row per run: its verdict, and the peeves it tripped, the kept one in the warning hue', () => {
  const rows = $$('[data-review-list] [data-run]');
  assert.deepEqual(rows.map((r) => r.querySelector('[data-run-verdict]').dataset.runVerdict), ['fail', 'unknown', 'pass']);
  const pills = [...rows[0].querySelectorAll('[data-run-peeve]')];
  assert.deepEqual(pills.map((p) => p.textContent), ['P05', 'P08']);
  assert.ok(pills[1].className.includes('bg-warning/30') && !pills[0].className.includes('bg-warning'));
  assert.equal(pills[0].dataset.titleTip, 'Vague writing', 'named from the peeves list');
  assert.equal(rows[2].textContent.replace(/\s+/g, ''), '3Pass');
});

test('a run\'s card names each trip\'s peeve, quotes it, says how it was answered, and draws what changed', () => {
  const trips = [...card().querySelectorAll('[data-run-trip]')];
  assert.equal(trips.length, 2);
  const name = trips[0].querySelector('[data-trip-name]');
  assert.equal(name.textContent, 'Vague writing');
  assert.ok(name.href.endsWith('/skills/peeves/peeves.md#vague-writing--p05'), name.href);
  assert.equal(trips[0].querySelector('[data-trip-quote]').textContent, 'with no base, the default branch');
  assert.equal(trips[0].querySelector('[data-trip-answer]').dataset.tripAnswer, 'changed');
  assert.equal(trips[1].querySelector('[data-trip-answer]').dataset.tripAnswer, 'kept');
  assert.equal(trips[1].querySelector('[data-trip-why]').textContent.trim(), 'The row names the mode; the paragraph says when.');
  assert.deepEqual(inlined[0], { a: 'with no base, the default branch', b: 'Without a base, the default branch stands in.' });
  assert.ok(card().querySelector('[data-run-change] [data-inline]'), 'the change is md-diff\'s inline reading');
  assert.equal(card().querySelector('[data-run-clear]').textContent, 'P01P07');
  assert.match(card().querySelector('[data-run-face="findings"]').textContent, /A table cell that holds a condition\./);
});

test('the report as it came back is the card\'s other face, chosen in the head row', async () => {
  const faces = () => [...card().querySelectorAll('[data-run-card="0"] [data-run-face]')].map((f) => f.dataset.runFace + (f.hidden ? '-' : '+'));
  assert.deepEqual(faces(), ['findings+', 'report-']);
  card().querySelector('[data-run-show="report"]').click();
  await tick(2);
  assert.deepEqual(faces(), ['findings-', 'report+']);
  assert.match(card().querySelector('[data-run-card="0"] [data-run-face="report"]').textContent, /VERDICT: FAIL/);
  card().querySelector('[data-run-show="findings"]').click();
  await tick(2);
  assert.deepEqual(faces(), ['findings+', 'report-']);
});

test('a run with no verdict shows its note and report, with no findings face to choose', async () => {
  $('[data-review-list] [data-run="1"]').click();
  await until(() => card().querySelector('[data-run-card="1"]'));
  const c = card().querySelector('[data-run-card="1"]');
  assert.equal(c.querySelector('[data-run-face="findings"]').hidden, true);
  assert.match(c.querySelector('[data-run-face="report"]').textContent, /The next run could read it\.\s*I could not read the peeves list\./);
  assert.equal(card().querySelector('[data-run-show]'), null, 'the head row offers no switch');
  assert.equal(data()._criticSel, 1);
});

test('going back to the view it left shows that view without drawing it again', async () => {
  data().docShow('changes');
  await until(() => $('[data-doc-scroll]').style.display === '');
  assert.equal(drawn.length, drawsBefore);
  assert.equal($('[data-doc-scroll]').style.display, '');
  assert.ok(reads.includes('mehrlander/web-tools@main:skills/peeves/peeves.csv'), 'the peeves list is read from the hub');
  assert.deepEqual(reads.filter((r) => r.startsWith('me/widget')), [], 'a closed call never reads its document');
});
