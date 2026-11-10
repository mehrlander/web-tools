// alpineComponents/user-call-form.js — a closed documentation call is drawn
// from its own edits, not the file. Once its edits merge, or a later change
// rewrites the same passages, the file says nothing about the call: a closed
// call once counted 3 edits and drew none, each reading "Already in the file"
// or "The file no longer holds this text".
//
// Driven over a fake GH that refuses the document, so a read of it fails the
// test; md-diff is stubbed as in user-call-form-doc.test.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const STORE = 'me/private';
const CALL = { id: 'c0ffee02-doc', session: 'c0ffee02', kind: 'documentation', question: 'Apply 2 edits to docs/x.md?',
  brief: 'Tidy the doc.', file: 'me/widget@main:docs/x.md', status: 'closed',
  closed: { at: '2026-11-09T19:15:18+00:00', answer: 'Apply both', note: '' },
  edits: [{ from: 'One.', to: 'First.', why: 'clearer' }, { from: 'Two.', to: 'Second.', why: 'an order, not a count' }] };
const ANSWER = { answer: '1 confirmed, 1 discarded', note: '', at: '2026-11-09T19:00:00Z',
  decisions: [{ edit: 1, decision: 'confirmed' }, { edit: 2, decision: 'discarded' }] };
const reads = [];
class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; }
  async get(p) {
    reads.push(this.repo + ':' + p);
    if (this.repo === STORE && p === 'user-calls/c0ffee02-doc.json') return { text: JSON.stringify(CALL) };
    if (this.repo === STORE && p === 'user-calls/c0ffee02-doc.answers.jsonl') return { text: JSON.stringify(ANSWER) + '\n' };
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
window.eval(readFileSync(new URL('../../lib/kits/call-marks.js', import.meta.url), 'utf8'));
window.AssistantMark = { shortBranch: (b) => String(b || '') };
const drawn = [];
window.mdDiff = { render: async (host, a, b, opts) => {
  drawn.push({ a, b });
  const A = a.split('\n\n'), B = b.split('\n\n');
  A.forEach((old, k) => {
    if (old === B[k]) return;
    const box = window.document.createElement('section');
    box.dataset.mdDiffChange = String(k);
    for (const act of opts.actions({ kind: 'changed', old, new: B[k] }, k) || []) {
      const btn = window.document.createElement('button');
      btn.dataset.act = act.label;
      box.append(btn);
    }
    host.append(box);
  });
  return { goto: () => {}, onMove: (cb) => cb({ at: -1 }) };
} };
window.Diff = {};
window.MdSurface = { patch: () => '' };
window.__form = { src: STORE + ':user-calls/c0ffee02-doc.json' };

const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
for (const k of ['lib/kits/repo-address.js', 'lib/kits/call-answer.js']) {
  new window.Function('window', readFileSync(path.join(repoRoot, k), 'utf8'))(window);
}
for (const p of ['lib/vanilla-bundle.js', 'lib/alpine-bundle.js', 'lib/alpineComponents/user-call-form.js']) {
  new window.Function(readFileSync(path.join(repoRoot, p), 'utf8'))();
}
Alpine.start();
const root = () => window.document.getElementById('form');
const data = () => Alpine.$data(root());
const until = async (ok) => { for (let i = 0; i < 80 && !ok(); i++) await tick(2); return ok(); };
await until(() => data().doc.ready && root().querySelectorAll('[data-md-diff-change]').length === 2);
const mark = (n) => root().querySelector(`[data-doc-mark][data-doc-edit="${n}"]`);

test('mounting is quiet', () => assert.deepEqual(problems, []));

test('a closed call never reads its document', () => {
  assert.deepEqual(reads.filter((r) => r.startsWith('me/widget')), []);
});

test('its edits are drawn from the call, passage by passage', () => {
  assert.deepEqual(drawn[0], { a: 'One.\n\n* * *\n\nTwo.', b: 'First.\n\n* * *\n\nSecond.' },
    'each edit\'s old text against its new, a rule between them');
  assert.deepEqual(Array.from(data().doc.status), ['staged', 'staged']);
  assert.equal(root().querySelector('[data-doc-filed]').style.display, '', 'the head says the edits are as filed');
  assert.equal(root().querySelector('[data-doc-unplaced]'), null, 'no edit reads as missing from the file');
});

test('the decisions are the answer\'s, and nothing is offered to decide', () => {
  assert.equal(mark(1).dataset.decision, 'confirmed');
  assert.equal(mark(2).dataset.decision, 'discarded');
  assert.equal(root().querySelector('[data-act]'), null, 'no Keep, Discard or Note on a closed call');
  const rows = [...root().querySelectorAll('[data-doc-list] [data-doc-row]')];
  assert.deepEqual(rows.map((r) => r.textContent.replace(/\s+/g, ' ').trim()), ['1. clearer', '2. an order, not a count']);
  assert.deepEqual(rows.map((r) => r.querySelector('[data-doc-row-n]').className.match(/text-(success|error)/)?.[1]), ['success', 'error'],
    'each row\'s number takes the answer\'s decision');
});
