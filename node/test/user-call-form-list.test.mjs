// alpineComponents/user-call-form.js — a documentation call on entries of a
// list (lists/*.json). The form reads each entry as its text and note, draws
// and decides it as a paragraph's edit, and records an answer whose patch is
// the list's JSON with the kept entry set, not a diff of that reading.
//
// Driven over a fake GH holding the list and the call; md-diff is stubbed as in
// user-call-form-doc.test.mjs, and MdSurface's patch returns what it was given.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const STORE = 'me/private';
const LIST = { title: 'Useful', items: [
  { id: 'two-way-door', text: 'Two-way door', note: 'A choice that can be undone cheaply.' },
  { id: 'standfirst', text: 'Standfirst', note: 'The lead under a headline.' },
  { id: 'fact-strip', text: 'Fact strip' },
] };
const JSONTEXT = JSON.stringify(LIST, null, 2) + '\n';
const CALL = { id: 'c0ffee03-useful', session: 'c0ffee03', kind: 'documentation', question: 'Keep 2 edits to the Useful list?',
  brief: 'Tightens two entries.', file: 'me/private@claude/x:lists/useful.json',
  edits: [
    { item: 'two-way-door', from: { text: 'Two-way door', note: 'A choice that can be undone cheaply.' },
      to: { text: 'Two-way door', note: 'A decision that can be reversed cheaply.' }, why: 'the plain word' },
    { item: 'fact-strip', from: { text: 'Fact strip' }, to: { text: 'Fact row' }, why: 'the shorter name' },
  ] };
const puts = [];
class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  async get(p) {
    if (this.repo === STORE && p === 'lists/useful.json' && this.ref === 'claude/x') return { text: JSONTEXT };
    if (this.repo === STORE && p === 'user-calls/c0ffee03-useful.json') return { text: JSON.stringify(CALL) };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req(p, o = {}) {
    if (p === '/user') return { login: 'owner' };
    if (o.method === 'PUT') { puts.push({ path: p, body: JSON.parse(o.body) }); return {}; }
    return {};
  }
  static FRESH = { cache: 'no-store' };
  static toBase64 = (s) => Buffer.from(s, 'utf8').toString('base64');
}

const { window, problems } = makeWindow({ html: `<!doctype html><html><body>
  <div id="form" x-data="userCallForm(window.__form)"></div></body></html>` });
window.GH = FakeGH;
window.Element.prototype.scrollIntoView = function () {};
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
      btn.addEventListener('click', () => act.run());
      box.append(btn);
    }
    host.append(box);
  });
  return { onMove: (cb) => cb({ at: -1 }) };
} };
window.Diff = {};
window.MdSurface = { patch: (p, a, b) => JSON.stringify([p, a, b]) };
window.__form = { src: STORE + ':user-calls/c0ffee03-useful.json' };

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

test('mounting is quiet', () => assert.deepEqual(problems, []));

test("the entries are drawn as their text and note, the list's own reading against the edited one", () => {
  assert.deepEqual(drawn[0], {
    a: '**two-way-door** · Two-way door\n\nA choice that can be undone cheaply.\n\n* * *\n\n**fact-strip** · Fact strip',
    b: '**two-way-door** · Two-way door\n\nA decision that can be reversed cheaply.\n\n* * *\n\n**fact-strip** · Fact row',
  });
  assert.deepEqual(Array.from(data().doc.status), ['staged', 'staged']);
  assert.equal(data().docPath, 'lists/useful.json', 'the head names the list');
  const rows = [...root().querySelectorAll('[data-doc-list] [data-doc-row]')];
  assert.deepEqual(rows.map((r) => r.querySelector('[data-doc-row-n]').parentElement.textContent.replace(/\s+/g, ' ').trim()),
    ['1 the plain word', '2 the shorter name']);
});

test("the answer's patch is the list with the kept entry set and the discarded one left", async () => {
  box(1).querySelector('[data-act="Keep"]').click();
  box(2).querySelector('[data-act="Discard"]').click();
  await tick(2);
  root().querySelector('[data-doc-send]').click();
  await until(() => puts.length === 1);
  const line = JSON.parse(Buffer.from(puts[0].body.content, 'base64').toString('utf8').trim());
  assert.equal(line.answer, '1 confirmed, 1 discarded');
  assert.equal(line.file, 'me/private:lists/useful.json');
  assert.equal(line.apply, 'session');
  const [p, from, to] = JSON.parse(line.patch);
  assert.equal(p, 'lists/useful.json');
  assert.equal(from, JSONTEXT);
  const want = structuredClone(LIST);
  want.items[0].note = 'A decision that can be reversed cheaply.';
  assert.equal(to, JSON.stringify(want, null, 2) + '\n');
});
