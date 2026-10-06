// The Waiting view (lib/alpineComponents/waiting.js) answering a call where
// it is read: a merge call's row button and card, and a decision's options,
// mounted against stub user calls and a stub of the call page's helpers, so
// what would be written to the answers file and commented on a PR is seen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const CALLS = [
  { id: 's1-merge-7', kind: 'merge', pr: 'acme/widget#7', question: 'Merge widget #7?', created: '2026-10-06T06:00:00Z',
    shipped: [{ kind: 'fixed', head: 'Spend list', old: 'omitted a table', new: 'lists it',
                proof: { kind: 'file', ref: 'acme/widget@b:app.html' } }],
    loose: ['Look at one preset first'], effect: 'The sidebar names its table.',
    materials: [{ kind: 'pr', ref: 'acme/widget#7', label: 'The PR' }, { kind: 'file', ref: 'acme/widget@b:app.html' },
                { kind: 'file', ref: 'acme/widget@main:docs/why.md', label: 'Why' }],
    _repo: 'me/store', _ref: 'main', _path: 'user-calls/s1-merge-7.json', answers: [], open: true },
  { id: 's1-close-two', kind: 'decision', question: 'Close two PRs?', brief: 'b', options: ['Close all', 'Keep some'],
    recommend: 'Close all', why: 'w', created: '2026-10-06T05:00:00Z',
    _repo: 'me/store', _ref: 'main', _path: 'user-calls/s1-close-two.json', answers: [], open: true },
];
const posted = [];

const { window } = makeWindow({ html: `<!doctype html><html><body><div id="w" x-data="waiting()"></div></body></html>` });
window.TOKEN = 'tkn';
// jsdom has no CSS.escape; the view uses it to find the selected row.
window.CSS = globalThis.CSS = { escape: (x) => String(x).replace(/["\\]/g, '\\$&') };
window.__shell = { waitingCount: 2 };
window.UserCalls = { STORE: 'me/store', list: async () => CALLS, pendingEdits: async () => new Map(),
                     href: (c) => 'page#' + c.id, sessionHref: () => '', fileKey: (f) => String(f || ''), dictateHref: () => '#' };
window.UserCallForm = {
  prOf: (ref) => { const m = String(ref || '').match(/^([^/]+\/[^#]+)#(\d+)$/); return m ? { slug: m[1], n: m[2] } : null; },
  prFacts: async () => ({ state: 'open', ci: 'passing', mergeable: 'clean', files: 1, add: 1, del: 1 }),
  postAnswer: async (a) => { posted.push(a); return a.entry; },
  linkOf: (l) => ({ href: l.ref, label: l.label || l.ref, icon: 'ph-link' }),
};
const Alpine = await startAlpine(window, ['lib/alpine-bundle.js', 'lib/alpineComponents/waiting.js']);
const el = window.document.getElementById('w');
const data = Alpine.$data(el);
const tick = (ms = 20) => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 40 && (data.loadingCalls || data.loadingPending); i++) await tick(5);
data.markNear(); await tick(40);
const q = (sel) => el.querySelector(sel);

test('a merge row asks twice: the first tap reads Confirm and sends nothing', async () => {
  const b = q('[data-waiting-quick][data-id="s1-merge-7"]');
  assert.ok(b, 'the merge row carries its answer');
  assert.match(b.textContent, /Merge/);
  b.click(); await tick();
  assert.match(b.textContent, /Confirm/);
  assert.equal(posted.length, 0, 'one tap sends nothing');
});

test('the second tap writes Merge beside the call and comments it on the PR', async () => {
  q('[data-waiting-quick][data-id="s1-merge-7"]').click(); await tick(60);
  assert.equal(posted.length, 1);
  const a = posted[0];
  assert.equal(a.path, 'user-calls/s1-merge-7.answers.jsonl');
  assert.equal(a.repo, 'me/store');
  assert.equal(a.entry.answer, 'Merge');
  assert.deepEqual({ ...a.pr }, { slug: 'acme/widget', n: '7' });
  assert.match(a.comment, /Answer: \*\*Merge\*\*/, 'the comment wakes the session watching the PR');
  assert.ok(!data.openCalls.some(c => c.id === 's1-merge-7'), 'the call leaves the open list');
  assert.equal(window.__shell.waitingCount, 1);
});

test('a merge card shows the PR, what ships, what stays loose and the effect, and no material twice', async () => {
  const c = CALLS[0];
  c.open = true; c.answers = [];   // read it as it stood
  data.showAnswered = true; data.picked.calls = c.id; data.markNear(); await tick(60);
  const card = el.querySelector('[data-waiting-detail-call][data-id="s1-merge-7"]');
  assert.ok(card, 'the card mounted');
  assert.match(card.querySelector('[data-waiting-pr]').textContent, /open · CI passing · merges cleanly · 1 file · \+1 −1/);
  assert.match(card.querySelector('[data-waiting-shipped]').textContent, /Spend list[\s\S]*omitted a table[\s\S]*lists it/);
  assert.match(card.querySelector('[data-waiting-loose]').textContent, /one preset/);
  assert.match(card.querySelector('[data-waiting-effect]').textContent, /names its table/);
  const mats = [...card.querySelectorAll('[data-waiting-materials] a')].map(a => a.textContent.trim());
  assert.deepEqual(mats, ['Why'], 'the PR is the chip and the proof sits on its line');
});

test('a decision is answered on its card: an option, a note, Send', async () => {
  data.picked.calls = 's1-close-two'; data.markNear(); await tick(60);
  const card = el.querySelector('[data-waiting-detail-call][data-id="s1-close-two"]');
  const opts = [...card.querySelectorAll('[data-waiting-option]')].map(b => b.dataset.option);
  assert.deepEqual(opts, ['Close all', 'Keep some']);
  card.querySelector('[data-waiting-option][data-option="Keep some"]').click(); await tick();
  data.notes['s1-close-two'] = 'keep #401';
  card.querySelector('[data-waiting-send]').click(); await tick(60);
  const a = posted.at(-1);
  assert.equal(a.entry.answer, 'Keep some');
  assert.equal(a.entry.note, 'keep #401');
  assert.equal(a.pr, null, 'no PR, so nothing is commented');
  assert.equal(a.path, 'user-calls/s1-close-two.answers.jsonl');
});
