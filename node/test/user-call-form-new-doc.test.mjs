// alpineComponents/user-call-form.js — a documentation call for a NEW document
// (user-call.py's `new`, owner 2026-11-07): shown whole, with no other view to
// switch to, and approved by Record. Shares the harness of
// user-call-form-doc.test.mjs; the original form (owner, 2026-10-29: "It should just be the call, and that's the form",
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
const DOC = 'One.\n\nTwo.\n\nThree.\n\nFour.\n';
const CALL = { id: 'c0ffee01-doc', session: 'c0ffee01', kind: 'documentation', question: 'Add docs/x.md?',
  brief: 'A new doc.', file: 'me/widget@main:docs/x.md', new: true, edits: [] };
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
const heads = [];
window.__form = { src: STORE + ':user-calls/c0ffee01-doc.json', onHead: (hd) => heads.push(hd) };

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
await until(() => data().doc.ready);
const box = (n) => root().querySelector(`[data-doc-mark][data-doc-edit="${n}"]`)?.closest('[data-md-diff-change]');
const act = (n, a) => box(n).querySelector(`[data-act="${a}"]`).click();
const mark = (n) => root().querySelector(`[data-doc-mark][data-doc-edit="${n}"]`);
const send = () => root().querySelector('[data-doc-send]');

test('mounting is quiet', () => assert.deepEqual(problems, []));

test('a new document is drawn whole, with no changes and no view to switch to', () => {
  assert.deepEqual(drawn[0], { a: DOC, b: DOC }, 'the file against itself');
  assert.equal(root().querySelectorAll('[data-md-diff-change]').length, 0);
  const pill = root().querySelector('[data-doc-head] .badge-success');
  assert.equal(pill?.textContent.trim(), 'New', 'a green New pill heads the document');
  const views = root().querySelector('[data-doc-view]').closest('.join');
  assert.equal(views.style.display, 'none', 'Old, Changes, Diff and New are hidden');
  assert.equal(root().querySelector('[data-doc-list]').style.display, 'none', 'and there is no list of edits');
});

test('a new document carries a copy icon at the end of its head row, which copies the file whole', async () => {
  const btn = root().querySelector('[data-doc-head] [data-doc-copy]');
  assert.ok(btn, 'the button sits in the row with the New pill');
  await until(() => btn.style.display !== 'none');
  assert.notEqual(btn.style.display, 'none', 'and shows once the document is read');
  assert.ok(btn.classList.contains('ml-auto'), 'at the right end of the row');
  assert.equal(btn.textContent.trim(), '', 'an icon, with no word on it');
  assert.equal(btn.getAttribute('aria-label'), 'Copy the document', 'named for a screen reader');
  const icon = btn.querySelector('i');
  assert.ok(icon.classList.contains('ph-copy'));
  const copied = [];
  window.io = { copy: async (t) => { copied.push(t); return true; } };
  btn.click();
  await until(() => copied.length);
  assert.deepEqual(copied, [DOC], 'the text as the branch holds it');
  await until(() => icon.classList.contains('ph-check'));
  assert.ok(icon.classList.contains('ph-check'), 'the icon turns to a check once the copy worked');
  delete window.io;
});

test('a documentation slide fills the deck: no ground padding and no card border', () => {
  const ground = root().querySelector('[data-call-ground]'), card = root().querySelector('[data-call-card]');
  assert.ok(!ground.classList.contains('p-3'));
  assert.ok(!card.classList.contains('border') && !card.classList.contains('rounded-xl'));
  assert.ok(card.classList.contains('flex-1'));
});

test('Record approves the new document', async () => {
  assert.equal(send().disabled, false, 'nothing to decide first');
  send().click();
  await until(() => puts.length);
  const line = JSON.parse(Buffer.from(puts[0].body.content, 'base64').toString('utf8').trim());
  assert.equal(line.answer, 'approved');
  assert.deepEqual(line.decisions, []);
  assert.equal(line.patch, undefined, 'nothing to apply');
});
