// The Waiting view (lib/alpineComponents/waiting.js) answering a call where
// it is read: the detail container's header (status read from GitHub), body
// (what the answer rests on) and footer (the answers), and the same cards in
// the deck takeover, mounted against stub user calls, a stub GitHub and a stub
// of the call page's helpers, so what would be written and read is seen.

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
  { id: 's1-close-two', kind: 'decision', session: 'bbbb2222', question: 'Close two PRs?', brief: 'b', options: ['Keep some', 'Close all'],
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
// GitHub as the header and the since-filed counts read it. The call's PR is a
// clean draft with passing checks, and moved after the call (one commit and
// one comment after it, one of each before); of the decision's three PRs one
// is open, one closed after the call, and one merged before it.
const READS = {
  'pulls/7': { state: 'open', draft: true, mergeable_state: 'draft', head: { sha: 'abc', ref: 'claude/spend', repo: { full_name: 'acme/widget' } },
               changed_files: 1, additions: 1, deletions: 1 },
  'commits/abc/check-runs': { check_runs: [{ status: 'completed', conclusion: 'success' }] },
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
const head = () => q('[data-waiting-head]');
const foot = () => q('[data-waiting-foot]');
const answerBtn = (o) => foot().querySelector('[data-waiting-answer-btn][data-option="' + o + '"]');

test('the header carries the PR, its checks and mergeability as read, the session mark, and no other way out', async () => {
  data.picked.calls = 's1-merge-7';
  await until(() => head().querySelector('[data-waiting-ci] i')?.className.includes('ph-check-circle'));
  assert.equal(head().querySelector('[data-waiting-pr]').textContent.trim(), '#7');
  assert.match(head().querySelector('[data-waiting-ci] i').className, /ph-check-circle/, 'CI passing on the head commit');
  assert.match(head().querySelector('[data-waiting-mergeable] i').className, /ph-pencil-simple-line/, 'a draft says so');
  assert.equal(q('[data-waiting-agent]').getAttribute('href'), 'https://claude.ai/code/session_01AAA');
  assert.ok(![...head().querySelectorAll('[data-waiting-open]')].length, 'no link out to the call page');
  data.picked.calls = 's1-close-two';
  await until(() => q('[data-waiting-agent]').style.display === 'none');
  assert.equal(q('[data-waiting-agent]').style.display, 'none', 'a session the index does not name gets no mark');
  data.picked.calls = 's1-merge-7'; await tick();
});

test('the footer\'s answer asks twice: the first tap reads Confirm and sends nothing', async () => {
  await until(() => answerBtn('Merge'));
  answerBtn('Merge').click(); await tick();
  assert.match(answerBtn('Merge').textContent, /Confirm/);
  assert.equal(posted.length, 0, 'one tap sends nothing');
});

test('the second tap writes Merge beside the call and comments it on the PR', async () => {
  answerBtn('Merge').click(); await tick(60);
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

test('a merge card\'s body holds what ships, what stays loose and the effect, and no material twice', async () => {
  const c = CALLS[0];
  c.open = true; c.answers = [];   // read it as it stood
  data.showAnswered = true; data.picked.calls = c.id; data.markNear(); await tick(60);
  const card = el.querySelector('[data-waiting-detail-call][data-id="s1-merge-7"]');
  assert.ok(card, 'the card mounted');
  assert.equal(card.querySelector('[data-waiting-pr]'), null, 'the PR is in the header, not the body');
  assert.match(card.querySelector('[data-waiting-shipped]').textContent, /Spend list[\s\S]*omitted a table[\s\S]*lists it/);
  assert.match(card.querySelector('[data-waiting-loose]').textContent, /one preset/);
  assert.match(card.querySelector('[data-waiting-effect]').textContent, /names its table/);
  const mats = [...card.querySelectorAll('[data-waiting-materials] a')].map(a => a.textContent.trim());
  assert.deepEqual(mats, ['Why'], 'the PR is the chip and the proof sits on its line');
});

test('a decision is answered from the footer: the recommended option first, a note opened in place, two taps', async () => {
  data.picked.calls = 's1-close-two'; await tick(40);
  await until(() => answerBtn('Close all'));
  const opts = [...foot().querySelectorAll('[data-waiting-answer-btn]')].map(b => b.dataset.option);
  assert.deepEqual(opts, ['Close all', 'Keep some'], 'the recommendation leads');
  foot().querySelector('[data-waiting-note]').click();
  await until(() => foot().querySelector('[data-waiting-note-field] input'));
  assert.ok(foot().querySelector('[data-waiting-note-field] input'), 'the note opens in the footer, not a modal');
  data.notes['s1-close-two'] = 'keep #401';
  answerBtn('Keep some').click(); await tick();
  answerBtn('Keep some').click(); await tick(60);
  const a = posted.at(-1);
  assert.equal(a.entry.answer, 'Keep some');
  assert.equal(a.entry.note, 'keep #401');
  assert.equal(a.pr, null, 'no PR, so nothing is commented');
  assert.equal(a.path, 'user-calls/s1-close-two.answers.jsonl');
});

test('what moved since filing is counted in the header, and the refresh reads everything again past the cache', async () => {
  const merge = CALLS[0];
  await until(() => data.since['s1-merge-7']?.at && !data.since['s1-merge-7'].busy);
  assert.equal(data.movedCount(merge), 3, 'a commit and a comment after the call, and one named file changed');
  assert.match(data.sinceLine(merge), /Since it was filed .*: 1 commit, 1 comment on widget #7; 1 of 2 files changed\./);
  await until(() => data.since['s1-close-two']?.at);
  assert.match(data.sinceLine(CALLS[1]), /: 1 of its 3 PRs was closed or merged\. 1 of its 3 PRs is still open\./,
    'a PR merged before the call is not news');
  assert.equal(data.prsLine(CALLS[1]), '1/3 open');
  assert.match(data.checkedTip(merge), /^PR state, CI, conflicts, and new commits, comments or reviews since filing; which of its 2 files changed since filing\. Checked /,
    'the refresh says what it checks for this call');
  assert.match(data.checkedTip(CALLS[1]), /^Which of its 3 PRs are open\./);
  assert.doesNotMatch(data.checkedTip(merge) + data.checkedTip(CALLS[1]), /again/);
  asked.length = 0;
  await data.refreshCall(merge);
  assert.ok(asked.some(([, p]) => p === 'pulls/7') && asked.some(([, p]) => p.endsWith('/check-runs')), 'the PR and its checks are read again');
  assert.ok(asked.every(([, , cache]) => cache === 'no-store'), 'a refresh is not served from the cache');
});

test('the expander opens the deck takeover on the row in view, the status at the head of each card and the answers at its foot', async () => {
  data.showAnswered = false;
  const open = data.openCalls;
  data.picked.calls = open[0].id; await tick();
  q('[data-waiting-full]').click();
  await until(() => data._deck);
  assert.ok(data._deck, 'the deck opened');
  const outside = (sel) => [...window.document.querySelectorAll(sel)].filter(x => !el.contains(x));
  await until(() => outside('[data-waiting-detail-call]').length);
  assert.ok(outside('[data-waiting-detail-call]').length, 'the card is drawn in the deck, outside the view');
  assert.ok(outside('[data-waiting-answer-btn]').length, 'the answers ride at the foot of the card');
  data._deck.close(); await until(() => !data._deck);
  assert.equal(data._deck, null);
});

test('a merge whose PR GitHub already merged offers nothing to merge, and conflicts are the header icon\'s alone', async () => {
  const c = CALLS[0];
  c.open = true; c.answers = [];
  data.picked.calls = c.id; await tick();
  data.facts[c.id] = { ...data.facts[c.id], state: 'open', mergeable: 'dirty' };
  await until(() => head().querySelector('[data-waiting-mergeable] i')?.className.includes('ph-warning-circle'));
  assert.match(data.mergeTip(c), /Conflicts with main\. Merge has the session resolve them first\./);
  assert.doesNotMatch(el.querySelector('[data-waiting-detail-call][data-id="s1-merge-7"]').textContent, /merge conflicts/i,
    'no line in the body repeats the icon');
  data.facts[c.id] = { ...data.facts[c.id], state: 'merged' };
  await until(() => foot().querySelector('[data-waiting-pr-done]'));
  assert.match(foot().textContent, /Already merged on GitHub/);
  assert.equal(answerBtn('Merge'), null, 'no Merge button for a merged PR');
});

test('a row says who recommends what and when, and a merge row carries its CI and mergeability', async () => {
  const [merge, decision] = CALLS;
  merge.open = true; merge.answers = [];
  data.facts[merge.id] = { state: 'open', ci: 'passing', mergeable: 'clean', at: new Date().toISOString() };
  await until(() => el.querySelector('[data-waiting-row-status]')?.style.display !== 'none');
  assert.match(data.callLine(decision), /^Session bbbb2222 recommends Close all · /, 'a session the index does not name is said as one');
  assert.match(data.callLine(merge), /^Claude · /, 'no kind word: the icon says it');
  const row = el.querySelector('[data-waiting-call][data-key="call:s1-merge-7"]').parentElement;
  assert.match(row.querySelector('[data-waiting-row-status]').innerHTML, /ph-check-circle[\s\S]*ph-git-merge/);
});

test('a merge card opens its branch in Activity\'s takeover, from the container and from the deck', async () => {
  const [merge] = CALLS;
  merge.open = true; merge.answers = [];
  data.picked.calls = merge.id;
  await data.readFacts(merge, true);
  const opened = [];
  window.__shell.openBranchSpec = (repo, name) => { opened.push(repo + '@' + name); return true; };
  const btn = () => head().querySelector('[data-waiting-branch]');
  await until(() => btn() && btn().style.display !== 'none');
  assert.equal(btn().dataset.titleTip, 'claude/spend', 'the tip names the branch');
  btn().click();
  assert.deepEqual(opened, ['acme/widget@claude/spend'], 'the shell opens the takeover');
  q('[data-waiting-full]').click();
  await until(() => data._deck);
  const inDeck = () => [...window.document.querySelectorAll('[data-waiting-detail-call][data-id="s1-merge-7"] [data-waiting-branch]')]
    .find((x) => !el.contains(x));
  await until(() => inDeck());
  inDeck().click();
  await until(() => !data._deck && opened.length === 2);
  assert.equal(data._deck, null, 'the deck closes first');
  assert.equal(opened[1], 'acme/widget@claude/spend', 'then the branch opens');
  data.facts[merge.id] = { ...data.facts[merge.id], branchRepo: 'someone/fork' };
  assert.equal(data.branchOf(merge), null, 'a fork\'s branch is outside the estate: no button');
});

test('a merge whose PR already merged is settled: out of the count, last in the list, and its line says so', async () => {
  const [merge, decision] = CALLS;
  merge.open = true; merge.answers = []; decision.open = true; decision.answers = [];
  data.facts[merge.id] = { ...data.facts[merge.id], state: 'merged' };
  data.syncCount();
  await until(() => el.querySelector('[data-waiting-settled-label]')?.style.display !== 'none');
  assert.deepEqual(data.waitingCalls.map((c) => c.id), ['s1-close-two'], 'only the decision waits');
  assert.equal(window.__shell.waitingCount, 1, 'the badge counts what waits');
  assert.deepEqual(Array.from(data.rowsOf('calls'), (r) => r.key), ['s1-close-two', 's1-merge-7'], 'the settled call sorts last');
  assert.match(data.callLine(merge), /^Claude · merged on GitHub · /);
  assert.equal(data.whoTip(merge), 'Filed by session aaaa1111: "ask"', 'the line names the filing session by its first ask');
  assert.equal(data.whoTip(decision), 'Filed by session bbbb2222', 'a session the index does not hold is named by its id');
  data.facts[merge.id] = { ...data.facts[merge.id], state: 'open' };
  data.syncCount();
  assert.equal(window.__shell.waitingCount, 2);
});
