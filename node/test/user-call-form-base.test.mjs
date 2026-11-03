// alpineComponents/user-call-form.js — a documentation call filed on its PR's
// branch after the edits were committed there, as doc-craft asks. Read at that
// branch, every edit already stands in the file and nothing stages; the form
// reads the file at the PR's base instead (owner, 2026-11-03: the call page
// said "Already in the file" four times and drew no change to decide). And the
// Diff presentation: the whole file as one unified diff, through
// kits/cm6-merge.js, stubbed here since its own module graph loads from esm.sh.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const STORE = 'me/private';
const OLD = 'One.\n\nTwo.\n';
const NEW = 'First.\n\nSecond.\n';
const CALL = { id: 'c0ffee02-doc', session: 'c0ffee02', kind: 'documentation', question: 'Apply 2 edits to docs/x.md?',
  brief: 'Tidy the doc.', file: 'me/widget@feature:docs/x.md', pr: 'me/widget#7',
  edits: [{ from: 'One.', to: 'First.' }, { from: 'Two.', to: 'Second.' }] };
class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || ''; }
  async get(p) {
    if (this.repo === 'me/widget' && p === 'docs/x.md') return { text: this.ref === 'main' ? OLD : NEW };
    if (this.repo === STORE && p === 'user-calls/c0ffee02-doc.json') return { text: JSON.stringify(CALL) };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req(p) {
    if (p === '/user') return { login: 'owner' };
    if (this.repo === 'me/widget' && p === 'pulls/7') return { state: 'open', draft: true, base: { ref: 'main' }, head: { ref: 'feature', sha: 'abc' } };
    if (p.endsWith('/check-runs')) return { check_runs: [] };
    return {};
  }
  static FRESH = { cache: 'no-store' };
}

const { window, problems } = makeWindow({ html: `<!doctype html><html><body>
  <div id="form" x-data="userCallForm(window.__form)"></div></body></html>` });
window.GH = FakeGH;
window.TOKEN = 'tkn';
window.gh = { load: async () => {} };
window.AssistantMark = { shortBranch: (b) => String(b || '') };
const drawn = [];
window.mdDiff = { render: async (host, a, b) => { drawn.push({ a, b }); host.replaceChildren(); } };
const merges = [];
window.cm6Merge = { unified: async (host, o) => {
  const el = window.document.createElement('div');
  el.className = 'cm-editor';
  host.append(el);
  const h = { o, destroyed: false, destroy() { h.destroyed = true; el.remove(); } };
  merges.push(h);
  return h;
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
await until(() => data().doc.ready && drawn.length);

test('mounting is quiet', () => assert.deepEqual(problems, []));

test("a call filed on its PR's branch is read at the PR's base, where its edits stage", () => {
  assert.equal(data().doc.at, 'main');
  assert.deepEqual(Array.from(data().doc.status), ['staged', 'staged']);
  assert.deepEqual(drawn[0], { a: OLD, b: NEW }, 'the base against the file with every edit in it');
  assert.match(root().querySelector('[data-doc-head]').textContent, /docs\/x\.md · main/, 'the head says where the file was read');
  assert.equal(root().querySelectorAll('[data-doc-unplaced]').length, 0, 'no edit reads as already in the file');
});

test('Diff draws the whole file as one unified diff, and leaves when another view is chosen', async () => {
  const view = (v) => root().querySelector(`[data-doc-view="${v}"]`).click();
  view('diff');
  await until(() => merges.length);
  await tick(4);
  assert.deepEqual({ ...merges[0].o }, { original: OLD, doc: NEW, language: 'md' });
  assert.ok(root().querySelector('[data-doc-host] .cm-editor'));
  const before = drawn.length;
  view('changes');
  await until(() => drawn.length > before);
  assert.equal(merges[0].destroyed, true, 'the diff is torn down');
  assert.equal(root().querySelector('[data-doc-host] .cm-editor'), null);
});
