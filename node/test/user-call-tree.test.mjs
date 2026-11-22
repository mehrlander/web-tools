// alpineComponents/user-call-form.js — a decision call's tree drawing a
// decision open or closed by the tree file's own `state` when the decision
// names a call, though the call has since closed or reopened. A decision that
// names a call takes its state from that call (owner, 2026-11-15); one with no
// call, or whose call cannot be read, keeps the tree's.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const STORE = 'me/private';
const OWN = 'c0ffee03-own';
// Each decision's tree `state` is the opposite of what its call says, where it
// names a call that can be read.
const TREE = { goal: { text: 'Ship the widget' }, decisions: [
  { id: 'own', call: OWN, state: 'closed', text: 'Ship it this week?', decisions: [
    { id: 'other', call: 'c0ffee03-other', state: 'open', text: 'Paint it blue?' },
    { id: 'plain', state: 'closed', text: 'Paint it red', not: 'red' },
    { id: 'lost', call: 'c0ffee03-lost', state: 'open', text: 'Paint it green?' },
    { id: 'lostclosed', call: 'c0ffee03-lostclosed', state: 'closed', text: 'Paint it gold?' },
  ] },
] };
const CALL = { id: OWN, session: 'c0ffee03', kind: 'decision', status: 'open', question: 'Ship it this week?',
  brief: 'The widget is ready.', recommend: 'Ship it', tree: STORE + '@main:trees/widget.json', materials: [] };
const OTHER = { id: 'c0ffee03-other', session: 'c0ffee03', kind: 'decision', status: 'closed', question: 'Paint it blue?' };
const reads = [];
class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || ''; }
  async get(p) {
    reads.push(this.repo + '@' + this.ref + ':' + p);
    if (this.repo !== STORE) throw Object.assign(new Error('404'), { status: 404 });
    if (p === 'user-calls/' + OWN + '.json') return { text: JSON.stringify(CALL) };
    if (p === 'user-calls/c0ffee03-other.json') return { text: JSON.stringify(OTHER) };
    if (p === 'trees/widget.json') return { text: JSON.stringify(TREE) };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req(p) { return p === '/user' ? { login: 'owner' } : {}; }
  static FRESH = { cache: 'no-store' };
}

const { window, problems } = makeWindow({ html: `<!doctype html><html><body>
  <div id="form" x-data="userCallForm(window.__form)"></div></body></html>` });
window.GH = FakeGH;
window.TOKEN = 'tkn';
window.gh = { load: async () => {} };
window.AssistantMark = { shortBranch: (b) => String(b || '') };
window.__form = { src: STORE + ':user-calls/' + OWN + '.json' };

const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
for (const k of ['lib/kits/repo-address.js', 'lib/kits/term-marks.js']) {
  new window.Function('window', readFileSync(path.join(repoRoot, k), 'utf8'))(window);
}
for (const p of ['lib/vanilla-bundle.js', 'lib/alpine-bundle.js', 'lib/alpineComponents/user-call-form.js']) {
  new window.Function(readFileSync(path.join(repoRoot, p), 'utf8'))();
}
Alpine.start();
const data = () => Alpine.$data(window.document.getElementById('form'));
const until = async (ok) => { for (let i = 0; i < 80 && !ok(); i++) await tick(2); return ok(); };
await until(() => data().chainHTML || data().chainErr);

// Whether the drawn tree shows a decision closed: a closed decision's pill
// takes the muted ground, an open one its kind's tint.
const box = window.document.createElement('div');
box.innerHTML = data().chainHTML;
const closed = (id) => {
  const line = box.querySelector('[data-node="' + id + '"] > [data-line]');
  assert.ok(line, 'decision ' + id + ' is drawn');
  return line.classList.contains('bg-base-200/50');
};

test('mounting is quiet, and the tree draws', () => {
  assert.deepEqual(problems, []);
  assert.equal(data().chainErr, '');
  assert.ok(box.querySelector('[data-tree]'));
});

test("this call's own decision is drawn by this call's state, not the tree's", () => {
  assert.equal(closed('own'), false);
});

test("another call's decision is drawn by that call's state, read beside this call", () => {
  assert.equal(closed('other'), true);
  assert.ok(reads.includes(STORE + '@main:user-calls/c0ffee03-other.json'));
});

test("a decision with no call, or whose call cannot be read, keeps the tree's state", () => {
  assert.equal(closed('plain'), true);
  assert.equal(closed('lost'), false);
  assert.equal(closed('lostclosed'), true, "an unreadable call's closed tree state stands too");
});
