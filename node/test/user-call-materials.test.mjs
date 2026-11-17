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
  // The framed page runs a changed page only when asked; the link out does not
  // carry that, so the branch page opened on its own keeps its behaviour.
  assert.equal(m.peek.url, m.href + '&live=ask');
  assert.equal(m.gh, 'https://github.com/me/widget/pull/12');
});

test('a branch material does the same, at its branch', () => {
  const m = mat('branch');
  assert.equal(m.href, 'https://mehrlander.github.io/web-tools/pages/branch.html#gh=me/widget@claude%2Ftry-it');
  assert.equal(m.peek.kind, 'html');
  assert.equal(m.peek.url, m.href + '&live=ask');
  assert.match(m.gh, /^https:\/\/github\.com\/me\/widget\/tree\/claude\/try-it$/);
});

test('the PR slide frames the page, with no button out to GitHub', async () => {
  for (let i = 0; i < 40 && !root().querySelector('[data-slide]'); i++) await tick(2);
  const slides = [...root().querySelectorAll('[data-slide]')];
  const at = data().mats.findIndex((m) => m.src === 'pr');
  const slide = slides[at];
  assert.ok(slide.querySelector('iframe'), 'the slide holds the framed branch page');
  assert.equal(slide.querySelector('iframe').getAttribute('src'), mat('pr').peek.url);
  assert.equal([...slide.querySelectorAll('a')].filter((a) => /github\.com/.test(a.getAttribute('href') || '')).length, 0);
});

// Each framed page is a whole page booting, and the strip held its neighbours
// and every slide seen at once inside one iPhone tab (2026-11-17). Only the
// slide in view holds its frame now; turning away releases it.
test('only the slide in view holds a framed page', async () => {
  const frames = () => [...root().querySelectorAll('[data-slide]')].map((s) => !!s.querySelector('iframe'));
  const pr = data().mats.findIndex((m) => m.src === 'pr');
  const br = data().mats.findIndex((m) => m.src === 'branch');
  data().at = pr;
  await tick(3);
  assert.deepEqual(frames(), frames().map((_, i) => i === pr), 'the PR slide alone');
  data().at = br;
  await tick(3);
  assert.equal(frames()[pr], false, 'the slide turned away from is released');
  assert.equal(frames()[br], true, 'and the one in view loads');
  data().at = pr;
  await tick(3);
});

test('a plain URL, which nothing here can frame, keeps its one way out', () => {
  const m = mat('url');
  assert.equal(m.peek, null);
});

// A DECISION WITH MATERIALS IS ONE CARD (owner, 2026-11-17): the call is the
// deck's head bar, the material's name and the pager end the answers, and the
// brief is a panel-tip off the question.
const shown = (el) => !!el && el.style.display !== 'none';
const until = async (ok) => { for (let i = 0; i < 80 && !ok(); i++) await tick(2); return ok(); };

test('a decision with materials is one card: the call heads its deck', () => {
  assert.equal(data().headed, true);
  const frame = root().querySelector('[data-call-frame]');
  assert.ok(frame.classList.contains('rounded-xl') && frame.classList.contains('border'), 'the frame is the card');
  assert.ok(frame.querySelector(':scope > [data-call-card]') && frame.querySelector(':scope > [data-swipe-section]'), 'the call and the slides share it');
  const card = root().querySelector('[data-call-card]');
  assert.ok(!card.classList.contains('rounded-xl'), 'the call is a head bar, not a card of its own');
  const pager = card.querySelector('[data-mat-pager]');
  assert.ok(shown(pager), 'the pager ends the answers');
  assert.match(pager.querySelector('[data-at="call-material"]').textContent, /The change · #12/);
  assert.match(pager.querySelector('[data-at="call-pager"]').textContent, /1\/4/);
  assert.ok(!shown(root().querySelector('[data-swipe-section] > .h-10')), "the deck's own head bar steps aside");
  for (const at of ['call-question', 'call-brief', 'call-take', 'call-adjust', 'call-send'])
    assert.ok(card.querySelector(`[data-at="${at}"]`), at + ' is named for a look link');
});

test("the brief is a panel-tip from the question's mark, pinned by a tap and closed by another", async () => {
  const mark = root().querySelector('[data-brief-tip]');
  assert.ok(shown(mark));
  assert.equal([...root().querySelectorAll('[data-call-card] > p')].filter((p) => shown(p) && /widget is ready/.test(p.textContent)).length, 0,
    'the brief is not drawn on the card');
  const tip = root().querySelector('[data-at="call-brief-tip"]');
  mark.click();
  assert.ok(await until(() => shown(tip)), 'a tap opens it');
  assert.equal(data().briefPinned, true, 'pinned, with its way out');
  assert.match(tip.textContent, /The widget is ready\./);
  mark.click();
  assert.ok(await until(() => !shown(tip)), 'a second tap closes it');
  assert.equal(data().briefOpen, false);
});

test('the pager turns the slides from the head', async () => {
  root().querySelector('[data-at="call-pager"] button:last-child').click();
  assert.ok(await until(() => data().at === 1));
  assert.match(root().querySelector('[data-at="call-material"]').textContent, /widget @ try-it/);
  data().go(0);
  await tick(2);
});

test('a decision whose deck is only its Adjust form keeps two cards and its brief in view', async () => {
  data().c = { ...CALL, materials: [] };
  assert.ok(await until(() => !data().headed && !shown(root().querySelector('[data-brief-tip]'))));
  assert.ok(root().querySelector('[data-call-frame]').classList.contains('contents'), 'no frame around the two');
  assert.ok(root().querySelector('[data-call-card]').classList.contains('rounded-xl'));
  assert.ok([...root().querySelectorAll('[data-call-card] > p')].some((p) => shown(p) && /widget is ready/.test(p.textContent)));
  assert.ok(shown(root().querySelector('[data-swipe-section] > .h-10')), 'the deck keeps its own head bar');
});
