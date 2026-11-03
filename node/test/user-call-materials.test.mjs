// alpineComponents/user-call-form.js — a call's materials pane. A PR or a
// branch opens as the branch page, framed in the pane, with GitHub as the mark
// beside its name; before 2026-11-03 its slide held only a button out to
// GitHub, which read as an empty container (owner, 2026-11-03).
//
// Driven over a fake GH holding one decision call with a PR, a branch and a
// plain URL among its materials.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const STORE = 'me/private';
const CALL = { id: 'c0ffee02-mats', session: 'c0ffee02', kind: 'decision', question: 'Ship the widget?',
  brief: 'The widget is ready.', recommend: 'Ship it',
  materials: [{ kind: 'pr', ref: 'me/widget#12', label: 'The change' },
              { kind: 'branch', ref: 'me/widget@claude/try-it' },
              { kind: 'url', ref: 'https://example.com/notes', label: 'Notes elsewhere' }] };
class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; }
  async get(p) {
    if (this.repo === STORE && p === 'user-calls/c0ffee02-mats.json') return { text: JSON.stringify(CALL) };
    throw Object.assign(new Error('404'), { status: 404 });
  }
  async req(p) {
    if (p === '/user') return { login: 'owner' };
    return {};
  }
  static FRESH = { cache: 'no-store' };
}

const { window, problems } = makeWindow({ html: `<!doctype html><html><body>
  <div id="form" x-data="userCallForm(window.__form)"></div></body></html>` });
window.GH = FakeGH;
window.TOKEN = 'tkn';
window.gh = { load: async () => {} };
window.AssistantMark = { shortBranch: (b) => String(b || '').replace(/^claude\//, '') };
window.__form = { src: STORE + ':user-calls/c0ffee02-mats.json' };

const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
new window.Function('window', readFileSync(path.join(repoRoot, 'lib/kits/repo-address.js'), 'utf8'))(window);
for (const p of ['lib/vanilla-bundle.js', 'lib/alpine-bundle.js', 'lib/alpineComponents/user-call-form.js']) {
  new window.Function(readFileSync(path.join(repoRoot, p), 'utf8'))();
}
Alpine.start();
const root = () => window.document.getElementById('form');
const data = () => Alpine.$data(root());
for (let i = 0; i < 80 && !(data().c && data().mats.length); i++) await tick(2);
await tick(4);
const mat = (kind) => data().mats.find((m) => m.src === kind);

test('mounting is quiet', () => assert.deepEqual(problems, []));

test('a PR material opens as the branch page, framed, with GitHub beside its name', () => {
  const m = mat('pr');
  assert.equal(m.label, 'The change · #12');
  assert.equal(m.href, 'https://mehrlander.github.io/web-tools/pages/branch.html#gh=me/widget&pr=12');
  assert.equal(m.peek.kind, 'html');
  assert.equal(m.peek.url, m.href);
  assert.equal(m.gh, 'https://github.com/me/widget/pull/12');
});

test('a branch material does the same, at its branch', () => {
  const m = mat('branch');
  assert.equal(m.href, 'https://mehrlander.github.io/web-tools/pages/branch.html#gh=me/widget@claude%2Ftry-it');
  assert.equal(m.peek.kind, 'html');
  assert.match(m.gh, /^https:\/\/github\.com\/me\/widget\/tree\/claude\/try-it$/);
});

test('the PR slide frames the page, with no button out to GitHub', async () => {
  for (let i = 0; i < 40 && !root().querySelector('[data-slide]'); i++) await tick(2);
  const slides = [...root().querySelectorAll('[data-slide]')];
  const at = data().mats.findIndex((m) => m.src === 'pr');
  const slide = slides[at];
  assert.ok(slide.querySelector('iframe'), 'the slide holds the framed branch page');
  assert.equal(slide.querySelector('iframe').getAttribute('src'), mat('pr').href);
  assert.equal([...slide.querySelectorAll('a')].filter((a) => /github\.com/.test(a.getAttribute('href') || '')).length, 0);
});

test('a plain URL, which nothing here can frame, keeps its one way out', () => {
  const m = mat('url');
  assert.equal(m.peek, null);
});
