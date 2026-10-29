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
window.mdDiff = { inline: async (a, b) => { const d = window.document.createElement('div'); d.innerHTML = '<del></del><ins></ins>'; d.dataset.pair = a + '>' + b; return d; } };
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
await until(() => data().doc.ready && root().querySelectorAll('[data-doc-edit]').length === 3);
const edit = (n) => root().querySelector(`[data-doc-edit="${n}"]`);
const send = () => root().querySelector('[data-doc-send]');

test('mounting is quiet', () => assert.deepEqual(problems, []));

test('every edit is drawn with its reason and its change, and none sends to Dictate', async () => {
  await until(() => edit(1).querySelector('[data-pair]'));
  assert.equal(edit(1).querySelector('[data-pair]').dataset.pair, 'One.>First.', 'the inline reading is of the edit itself');
  assert.match(edit(1).textContent, /clearer/);
  assert.equal(root().querySelector('[data-dictate-link]'), null, 'no way out to Dictate');
});

test('an edit the file cannot place says why and offers no decision', () => {
  assert.deepEqual(Array.from(data().doc.status), ['staged', 'staged', 'stale']);
  assert.match(edit(3).textContent, /no longer holds/);
  assert.equal(edit(3).querySelector('[data-doc-keep]').closest('[x-show]').style.display, 'none');
});

test('nothing records until every staged edit is decided', async () => {
  assert.equal(send().disabled, true);
  assert.match(send().textContent, /2 to decide/);
  edit(1).querySelector('[data-doc-keep]').click();
  await tick(2);
  assert.match(send().textContent, /1 to decide/);
  assert.equal(edit(1).querySelector('[data-doc-keep]').getAttribute('aria-pressed'), 'true');
  edit(1).querySelector('[data-doc-keep]').click();
  await tick(2);
  assert.equal(edit(1).querySelector('[data-doc-keep]').getAttribute('aria-pressed'), 'false', 'a second tap lets it go');
});

test('the answer line is the one Dictate and the Docs tab write, with the kept edits as a patch', async () => {
  edit(1).querySelector('[data-doc-keep]').click();
  edit(2).querySelector('[data-doc-discard]').click();
  await tick(2);
  data().doc.notes[1] = 'keep the number';
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
