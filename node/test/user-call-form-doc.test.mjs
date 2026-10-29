// alpineComponents/user-call-form.js — a documentation call answered on its own
// form (owner, 2026-10-29: "It should just be the call, and that's the form",
// not Dictate's machinery). The form reads the call's file, stages each edit
// through kits/call-answer.js, and records one answer line for the whole call
// once every staged edit is kept or discarded.
//
// Driven over a fake GH holding the document and the call. md-diff's inline
// reading and MdSurface's patch are stubbed: their own suites hold them, and
// what is held here is the decisions and the line they write.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const STORE = 'me/private';
const DOC = 'One.\n\nTwo.\n\nThree.\n';
const CALL = { id: 'c0ffee01-doc', session: 'c0ffee01', kind: 'documentation', question: 'Apply 3 edits to docs/x.md?',
  brief: 'Tidy the doc.', file: 'me/widget@main:docs/x.md', recommend: 'Apply all three',
  edits: [{ from: 'One.', to: 'First.', why: 'clearer' }, { from: 'Two.', to: 'Second.' }, { from: 'Gone.', to: 'Nothing.' }] };
const puts = [];
class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; }
  async get(p) {
    if (this.repo === 'me/widget' && p === 'docs/x.md') return { text: DOC };
    if (this.repo === STORE && p === 'user-calls/c0ffee01-doc.json') return { text: JSON.stringify(CALL) };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req(p, o = {}) {
    if (p === '/user') return { login: 'owner' };
    if (o.method === 'PUT') { puts.push({ repo: this.repo, path: p, body: JSON.parse(o.body) }); return {}; }
    return {};
  }
  static FRESH = { cache: 'no-store' };
  static toBase64 = (s) => Buffer.from(s, 'utf8').toString('base64');
}

const { window, problems } = makeWindow({ html: `<!doctype html><html><body>
  <div id="form" x-data="userCallForm(window.__form)"></div></body></html>` });
window.GH = FakeGH;
window.TOKEN = 'tkn';
window.gh = { load: async () => {} };
window.AssistantMark = { shortBranch: (b) => String(b || '') };
// md-diff's own suite holds its drawing; here it draws one container per
// changed block, with the host's actions as buttons, as the real one does.
const drawn = [];
window.mdDiff = { render: async (host, a, b, opts) => {
  drawn.push({ a, b });
  const A = a.split('\n\n'), B = b.split('\n\n');
  A.forEach((old, k) => {
    if (old === B[k]) return;
    const box = window.document.createElement('section');
    box.dataset.mdDiffChange = String(k);
    box.dataset.pair = old + '>' + B[k];
    for (const act of opts.actions({ kind: 'changed', old, new: B[k] }, k) || []) {
      const btn = window.document.createElement('button');
      btn.textContent = act.label; btn.dataset.act = act.label;
      btn.addEventListener('click', () => act.run());
      box.append(btn);
    }
    host.append(box);
  });
} };
window.Diff = {};
window.MdSurface = { patch: (p, a, b) => 'PATCH ' + p + ' ' + JSON.stringify(b) };
window.__form = { src: STORE + ':user-calls/c0ffee01-doc.json' };

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
const box = (n) => root().querySelector(`[data-doc-mark][data-doc-edit="${n}"]`)?.closest('[data-md-diff-change]');
const act = (n, a) => box(n).querySelector(`[data-act="${a}"]`).click();
const mark = (n) => root().querySelector(`[data-doc-mark][data-doc-edit="${n}"]`);
const send = () => root().querySelector('[data-doc-send]');

test('mounting is quiet', () => assert.deepEqual(problems, []));

test('the document is drawn whole, its edits staged, under a head naming the file', () => {
  assert.deepEqual(drawn[0], { a: DOC, b: 'First.\n\nSecond.\n\nThree.\n' }, 'the file as it stands against the file with every edit in it');
  assert.equal(box(1).dataset.pair, 'One.>First.');
  assert.match(root().querySelector('[data-doc-head]').textContent, /docs\/x\.md/);
  assert.match(root().querySelector('[data-doc-head]').textContent, /3 edits · 0 of 2 decided/);
  assert.equal(root().querySelector('[data-dictate-link]'), null, 'no way out to Dictate');
});

test('an edit the file cannot place says why, under the document, with no container', () => {
  assert.deepEqual(Array.from(data().doc.status), ['staged', 'staged', 'stale']);
  assert.equal(mark(3), null);
  assert.match(root().querySelector('[data-doc-unplaced="3"]').textContent, /no longer holds/);
});

test('nothing records until every staged edit is decided, and a decision stays marked', async () => {
  assert.equal(send().disabled, true);
  assert.match(send().textContent, /2 to decide/);
  act(1, 'Keep');
  await tick(2);
  assert.match(send().textContent, /1 to decide/);
  assert.equal(mark(1).dataset.decision, 'confirmed');
  assert.match(mark(1).textContent, /kept/);
  act(1, 'Keep');
  await tick(2);
  assert.equal(mark(1).dataset.decision, 'open', 'a second tap lets it go');
});

test('the answer line is the one Dictate and the Docs tab write, with the kept edits as a patch', async () => {
  act(1, 'Keep');
  act(2, 'Discard');
  act(2, 'Note');
  await tick(2);
  const note = root().querySelector('[data-doc-note="2"]');
  note.value = 'keep the number';
  note.dispatchEvent(new window.Event('input'));
  assert.equal(send().disabled, false);
  send().click();
  await until(() => puts.length);
  const put = puts[0], line = JSON.parse(Buffer.from(put.body.content, 'base64').toString('utf8').trim());
  assert.equal(put.repo, STORE);
  assert.equal(put.path, 'contents/user-calls/c0ffee01-doc.answers.jsonl');
  assert.equal(line.answer, '1 confirmed, 1 discarded, 1 stale');
  assert.deepEqual(line.decisions, [{ edit: 1, decision: 'confirmed' }, { edit: 2, decision: 'discarded', note: 'keep the number' },
                                    { edit: 3, decision: 'stale' }]);
  assert.equal(line.call, STORE + ':user-calls/c0ffee01-doc.json');
  assert.equal(line.file, 'me/widget:docs/x.md');
  assert.equal(line.apply, 'session');
  assert.equal(line.patch, 'PATCH docs/x.md ' + JSON.stringify('First.\n\nTwo.\n\nThree.\n'), 'only the kept edit is in the patch');
  await until(() => data().done);
  assert.equal(data().done, line.answer, 'the form reads as answered');
});
