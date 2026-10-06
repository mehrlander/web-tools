// The Waiting view (lib/alpineComponents/waiting.js) answering a call where
// it is read: a merge call's row button and card, and a decision's options,
// mounted against stub user calls and a stub of the call page's helpers, so
// what would be written to the answers file and commented on a PR is seen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const CALLS = [
  { id: 's1-merge-7', kind: 'merge', pr: 'acme/widget#7', session: 'aaaa1111', question: 'Merge widget #7?', created: '2026-10-06T06:00:00Z',
    shipped: [{ kind: 'fixed', head: 'Spend list', old: 'omitted a table', new: 'lists it',
                proof: { kind: 'file', ref: 'acme/widget@b:app.html' } }],
    loose: ['Look at one preset first'], effect: 'The sidebar names its table.',
    materials: [{ kind: 'pr', ref: 'acme/widget#7', label: 'The PR' }, { kind: 'file', ref: 'acme/widget@b:app.html' },
                { kind: 'file', ref: 'acme/widget@main:docs/why.md', label: 'Why' }],
    _repo: 'me/store', _ref: 'main', _path: 'user-calls/s1-merge-7.json', answers: [], open: true },
  { id: 's1-close-two', kind: 'decision', session: 'bbbb2222', question: 'Close two PRs?', brief: 'b', options: ['Close all', 'Keep some'],
    recommend: 'Close all', why: 'w', created: '2026-10-06T05:00:00Z',
    materials: [{ kind: 'pr', ref: 'acme/widget#1' }, { kind: 'pr', ref: 'acme/widget#2' }, { kind: 'pr', ref: 'acme/widget#3' }],
    _repo: 'me/store', _ref: 'main', _path: 'user-calls/s1-close-two.json', answers: [], open: true },
];
const posted = [];

const { window } = makeWindow({ html: `<!doctype html><html><body><div id="w" x-data="waiting()"></div></body></html>` });
window.TOKEN = 'tkn';
// jsdom has no CSS.escape; the view uses it to find the selected row.
window.CSS = globalThis.CSS = { escape: (x) => String(x).replace(/["\\]/g, '\\$&') };
window.__shell = { waitingCount: 2 };
// The store's short-id index: a row is [short, at, ask, claude.ai session id].
const MENU = { recent: [['aaaa1111', '2026-10-06T06:00:00Z', 'ask', 'session_01AAA']], branches: {} };
// GitHub as the since-filed line reads it: the call's PR moved after the call
// (one commit and one comment after it, one of each before), and the decision's
// two PRs, one since closed.
const READS = {
  'pulls/7/commits?per_page=100': [{ commit: { committer: { date: '2026-10-06T05:00:00Z' } } }, { commit: { committer: { date: '2026-10-06T07:00:00Z' } } }],
  'pulls/7/reviews?per_page=100': [],
  'pulls/1': { state: 'open' }, 'pulls/2': { state: 'closed', merged_at: null, closed_at: '2026-10-06T09:00:00Z' },
  'pulls/3': { state: 'closed', merged_at: '2026-10-01T00:00:00Z', closed_at: '2026-10-01T00:00:00Z' },
};
const asked = [];
window.GH = class {
  static FRESH = { cache: 'no-store' };
  constructor(o = {}) { this.repo = o.repo; }
  async get(path) { if (path === 'state/session-menu.json') return { text: JSON.stringify(MENU) }; throw new Error('no ' + path); }
  async req(path, opts = {}) {
    asked.push([this.repo, path, opts.cache || '']);
    if (path.startsWith('issues/7/comments')) return [{ created_at: '2026-10-06T05:30:00Z' }, { created_at: '2026-10-06T08:00:00Z' }];
    if (path.startsWith('commits?')) return path.includes('docs%2Fwhy.md') ? [{ sha: 'x' }] : [];
    if (path in READS) return READS[path];
    throw Object.assign(new Error('unexpected ' + path), { status: 404 });
  }
};
window.claudeMark = { svg: () => '<svg data-mark></svg>' };
window.UserCalls = { STORE: 'me/store', list: async () => CALLS, pendingEdits: async () => new Map(),
                     href: (c) => 'page#' + c.id, sessionHref: () => '', fileKey: (f) => String(f || ''), dictateHref: () => '#' };
window.UserCallForm = {
  prOf: (ref) => { const m = String(ref || '').match(/^([^/]+\/[^#]+)#(\d+)$/); return m ? { slug: m[1], n: m[2] } : null; },
  prFacts: async () => ({ state: 'open', ci: 'passing', mergeable: 'clean', files: 1, add: 1, del: 1 }),
  postAnswer: async (a) => { posted.push(a); return a.entry; },
  linkOf: (l) => ({ href: l.ref, label: l.label || l.ref, icon: 'ph-link' }),
};
const Alpine = await startAlpine(window, ['lib/alpine-bundle.js', 'lib/kits/swipe-deck.js', 'lib/alpineComponents/waiting.js']);
const el = window.document.getElementById('w');
const data = Alpine.$data(el);
const tick = (ms = 20) => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 40 && (data.loadingCalls || data.loadingPending); i++) await tick(5);
data.markNear(); await tick(40);
const q = (sel) => el.querySelector(sel);
// x-show hides on the next animation frame, so a fixed pause is a race on a
// slow runner; wait for the state itself, up to a second.
const until = async (ok) => { for (let i = 0; i < 50 && !ok(); i++) await tick(20); return ok(); };

test('the head row opens the filing session by the Claude mark, and a call answered here has no other way out', async () => {
  data.picked.calls = 's1-merge-7';
  await until(() => q('[data-waiting-agent]')?.getAttribute('href'));
  const mark = q('[data-waiting-agent]');
  assert.equal(mark.getAttribute('href'), 'https://claude.ai/code/session_01AAA');
  assert.ok(mark.querySelector('svg'), 'the mark is drawn');
  await until(() => [...el.querySelectorAll('[data-waiting-open]')].every(a => a.style.display === 'none'));
  assert.ok([...el.querySelectorAll('[data-waiting-open]')].every(a => a.style.display === 'none'),
    'no link to the call page: the card and the deck carry it');
  data.picked.calls = 's1-close-two';
  await until(() => q('[data-waiting-agent]').style.display === 'none');
  assert.equal(q('[data-waiting-agent]').style.display, 'none', 'a session the index does not name gets no mark');
  data.picked.calls = 's1-merge-7'; await tick();
});

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

test('a card says what moved since its call was filed, and the arrows read it again past the cache', async () => {
  const merge = CALLS[0];
  await until(() => data.since['s1-merge-7'] && !data.since['s1-merge-7'].busy);
  assert.match(data.sinceLine(merge), /Since it was filed .*: 1 commit, 1 comment on widget #7; 1 of 2 files changed\./);
  await until(() => data.since['s1-close-two'] && !data.since['s1-close-two'].busy);
  assert.match(data.sinceLine(CALLS[1]), /: 1 of its 3 PRs was closed or merged\. 1 of its 3 PRs is still open\./,
    'a PR merged before the call is not news');
  asked.length = 0;
  await data.refreshCall(merge);
  assert.ok(asked.length && asked.every(([, , cache]) => cache === 'no-store'), 'a refresh is not served from the cache');
});

test('the expander opens the deck takeover on the row in view, with its answer at the head of the card', async () => {
  data.showAnswered = false;
  const open = data.openCalls;
  data.picked.calls = open[open.length - 1].id; await tick();
  q('[data-waiting-full]').click();
  await until(() => data._deck);
  assert.ok(data._deck, 'the deck opened');
  const cards = () => [...window.document.querySelectorAll('[data-waiting-detail-call]')].filter(c => !el.contains(c));
  await until(() => cards().length);
  assert.ok(cards().length, 'the card is drawn in the deck, outside the view');
  data._deck.close(); await until(() => !data._deck);
  assert.equal(data._deck, null);
});
