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
// The notes store: a tending finding that names the decision call among its
// subjects, Gemini agreeing with the call, and the owner's reply to Gemini.
const CALL_LOC = 'me/store:user-calls/s1-close-two.json';
const NOTES = [
  { id: 'nf1', at: '2026-10-06T05:10:00Z', author: 'claude/tend-pass', about: 'acme/widget#1', text: 'Its work landed in #9.',
    finding: { kind: 'superseded', subjects: ['acme/widget#1', CALL_LOC], why: 'w', next: 'n' } },
  // The pass's own update to that finding: a reply that carries `finding`.
  { id: 'nu1', at: '2026-10-06T06:00:00Z', author: 'claude/tend-pass', about: 'note:nf1', text: 'Closed with the call.',
    finding: { status: 'settled', subjects: ['acme/widget#1', CALL_LOC] } },
  { id: 'ng1', at: '2026-10-06T08:00:00Z', author: 'gemini', about: CALL_LOC, text: 'All three still hold.', vote: 'up' },
  { id: 'no1', at: '2026-10-06T09:00:00Z', author: 'me', about: 'note:ng1', text: 'Good.' },
];
const put = [];
// The errands store, as the Gemini check writes and reads it.
const saved = [], RESULTS = {};
// A tracker task's status, as its file says it.
const TASKS = { 'tracker/tasks/trim-ab12cd.md': 'in-progress' };
window.GH = class {
  static FRESH = { cache: 'no-store' };
  static toBase64(t) { return Buffer.from(t).toString('base64'); }
  async save(path, data, message) { saved.push({ repo: this.repo, path, data, message }); return { ok: true }; }
  constructor(o = {}) { this.repo = o.repo; }
  async get(path) {
    if (path === 'state/session-menu.json') return { text: JSON.stringify(MENU) };
    const res = /^errands\/results\/(.+)\.json$/.exec(path);
    if (res && RESULTS[res[1]]) return { text: JSON.stringify(RESULTS[res[1]]) };
    // The sha follows the content, as GitHub's does, so the kit's guard
    // against a stale read after its own write sees a newer file as newer.
    if (path === 'notes/notes.jsonl') return { text: NOTES.map((n) => JSON.stringify(n)).join('\n') + '\n', sha: 's' + NOTES.length };
    if (path in TASKS) return { text: '---\nid: x\nstatus: ' + TASKS[path] + '\n---\n# A task\n' };
    throw new Error('no ' + path);
  }
  async req(path, opts = {}) {
    asked.push([this.repo, path, opts.cache || '']);
    if (path === '/user') return { login: 'owner' };
    if (path === 'contents/notes/notes.jsonl' && opts.method === 'PUT') { put.push(JSON.parse(opts.body)); return { content: { sha: 's1' } }; }
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
const Alpine = await startAlpine(window, ['lib/alpine-bundle.js', 'lib/kits/swipe-deck.js', 'lib/kits/notes.js', 'lib/kits/findings.js', 'lib/kits/errands.js', 'lib/alpineComponents/waiting.js']);
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

test('a call says what sort it is: its name in the row, its shape atop the card, and each dependency checked', async () => {
  const decision = CALLS[1];
  decision.open = true; decision.answers = [];
  const named = { id: 's2-ghosts', kind: 'decision', session: 'aaaa1111', name: 'Nine Ghost PRs', question: 'Close nine PRs?',
    brief: 'b', options: ['Close all', 'Keep some'], recommend: 'Close all', why: 'landed', created: '2026-10-06T04:00:00Z',
    size: 'XS', confidence: 'firm', reversible: true,
    depends_on: ['acme/widget#3', 's1-close-two', 'acme/widget:tracker/tasks/trim-ab12cd.md'],
    _repo: 'me/store', _ref: 'main', _path: 'user-calls/s2-ghosts.json', answers: [], open: true };
  data.calls.push(named);
  await data.loadDeps(named);
  const keys = () => Array.from(data.shapeOf(named), (t) => t.key + ':' + t.label);
  assert.deepEqual(Array.from(data.depsOf(named), (d) => d.label + '=' + d.state),
    ['widget #3=merged', 'call s1-close-two=open', 'task trim-ab12cd=in-progress']);
  assert.equal(data.easy(named), false, 'firm, reversible and XS, but it waits, so not easy');
  assert.deepEqual(keys(), ['size:XS', 'conf:Firm', 'deps:Waits on 2']);
  assert.match(data.depsTip(named), /call s1-close-two: open; task trim-ab12cd: in-progress/);

  decision.open = false;
  TASKS['tracker/tasks/trim-ab12cd.md'] = 'done';
  delete data.deps['acme/widget:tracker/tasks/trim-ab12cd.md'];
  await data.loadDeps(named);
  assert.equal(data.easy(named), true, 'with nothing left to wait on it is easy');
  assert.deepEqual(keys(), ['easy:Easy', 'size:XS', 'deps:All 3 met']);

  const row = () => el.querySelector('[data-waiting-call][data-key="call:s2-ghosts"]');
  await until(() => row());
  assert.equal(row().querySelector('.line-clamp-2').textContent, 'Nine Ghost PRs', 'the row shows the name');
  assert.equal(row().querySelector('.line-clamp-2').dataset.titleTip, 'Close nine PRs?', 'the question rides in its tip');
  const mark = () => row().parentElement.querySelector('[data-waiting-row-easy]');
  await until(() => mark().style.display !== 'none');
  assert.notEqual(mark().style.display, 'none', 'and the easy mark');
  data.picked.calls = 's2-ghosts';
  const card = () => el.querySelector('[data-waiting-detail-call][data-id="s2-ghosts"]');
  await until(() => card()?.querySelector('[data-shape="easy"]'));
  assert.equal(card().querySelector('[data-waiting-question]').textContent, 'Close nine PRs?', 'a named card states its question');
  assert.ok(card().querySelector('[data-shape="easy"]'), 'the shape line leads the card');

  data.calls.splice(data.calls.indexOf(named), 1);
  decision.open = true;
});

test('a task link opens the task file at its ref, drawn as a task and named by its id', async () => {
  // The real link builder, in a window of its own: this file stubs it above.
  const { window: w2 } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
  await startAlpine(w2, ['lib/alpine-bundle.js', 'lib/alpineComponents/user-call-form.js']);
  const L = w2.UserCallForm.linkOf;
  const t = L({ kind: 'task', ref: 'mehrlander/home:projects/budget-drs/tracker/tasks/grid-membership-cv0o2a.md' });
  assert.equal(t.href, 'https://github.com/mehrlander/home/blob/main/projects/budget-drs/tracker/tasks/grid-membership-cv0o2a.md');
  assert.equal(t.label, 'grid-membership-cv0o2a');
  assert.equal(t.icon, 'ph-list-checks');
  assert.equal(t.kind, 'task');
  const at = L({ kind: 'task', ref: 'mehrlander/web-tools@dev:tracker/tasks/trim-ab12cd.md', label: 'Trim' });
  assert.equal(at.href, 'https://github.com/mehrlander/web-tools/blob/dev/tracker/tasks/trim-ab12cd.md', 'a ref is kept');
  assert.equal(at.label, 'Trim');
});

test('an address naming a call opens Waiting on it, and the shell then forgets it', async () => {
  const [merge, decision] = CALLS;
  merge.open = true; decision.open = true;
  data.setTab('edit');
  window.__shell.waitingCall = 's1-close-two';
  window.document.dispatchEvent(new window.CustomEvent('web-tools:waiting-call', { detail: { id: 's1-close-two' } }));
  assert.equal(data.tab, 'calls', 'the Calls tab');
  assert.equal(data.picked.calls, 's1-close-two', 'on that call');
  assert.equal(window.__shell.waitingCall, '', 'taken once, so a later pick leaves no stale address');
  data.focusCall('no-such-call');
  assert.equal(data.picked.calls, 's1-close-two', 'an unknown id moves nothing');
});

test('a call carries its notes and findings, a vote reaches the row, and a note is kept without answering', async () => {
  const decision = CALLS[1];
  decision.open = true; decision.answers = [];
  await until(() => data.allNotes.length === 4);
  assert.ok(!asked.some(([, p]) => p === '/user'), 'no login read on load');
  assert.deepEqual(Array.from(data.noteRows(decision), (x) => x.n.id + '@' + x.d), ['nf1@0', 'ng1@0', 'no1@1'],
    'the finding naming it once, then Gemini, then the reply nested under Gemini');
  assert.equal(data.noteRows(decision)[0].n.finding.status, 'settled', 'the finding as its update left it');
  assert.match(data.callLine(decision), / · Gemini votes up /, 'who voted, which way, and when');
  assert.equal(data.whoOf('me'), 'You', 'the store\'s owner is the owner');
  assert.equal(data.whoOf('gemini'), 'Gemini');
  data.picked.calls = decision.id;
  const card = () => el.querySelector('[data-waiting-detail-call][data-id="s1-close-two"]');
  await until(() => card()?.querySelectorAll('[data-waiting-note-row]').length === 3);
  assert.equal(card().querySelector('[data-waiting-note-row][data-vote="up"] .badge').textContent.trim(), 'Votes up');

  const answersBefore = posted.length;
  await data.saveNote(decision, '  Hold #2 a day.  ');
  assert.equal(put.length, 1, 'one write to the notes store');
  const wrote = Buffer.from(put[0].content, 'base64').toString().trim().split('\n').map((l) => JSON.parse(l)).at(-1);
  assert.equal(wrote.about, CALL_LOC);
  assert.equal(wrote.author, 'owner');
  assert.equal(wrote.text, 'Hold #2 a day.');
  assert.equal(decision.open, true, 'a note answers nothing');
  assert.equal(posted.length, answersBefore, 'and writes no answer');
  await until(() => data.noteRows(decision).length === 4);
  assert.equal(data.noteRows(decision).at(-1).n.text, 'Hold #2 a day.');
});

test('Ask Gemini files a call check with what GitHub shows, and its verdict comes back as Gemini\'s note', async () => {
  const merge = CALLS[0];
  merge.open = true; merge.answers = [];
  data.facts[merge.id] = { ...data.facts[merge.id], state: 'open', ci: 'passing' };
  data.POLL_MS = 10;
  await data.askGemini(merge);
  assert.equal(saved.length, 1, 'one request filed');
  const req = saved[0];
  assert.equal(req.repo, 'me/store');
  assert.match(req.path, /^errands\/requests\/daemon-\d{4}-\d{2}-\d{2}-call-check-[a-z0-9]+\.json$/);
  assert.equal(req.data.run.op, 'call-check');
  assert.equal(req.data.run.method, 'laptop-daemon');
  assert.equal(req.data.run.args.call, 's1-merge-7');
  const ev = req.data.run.args.evidence;
  assert.match(ev, /Its PR, acme\/widget#7/, 'the PR as read now');
  assert.match(ev, /CI passing/);
  assert.match(ev, /Commits since filing:\n- /, 'what moved since filing, one line each');
  assert.match(ev, /\n- acme\/widget:docs\/why\.md: changed since filing \(1 commit\)/);
  assert.match(ev, /\n- acme\/widget:app\.html: unchanged since filing/);
  assert.equal(data.checks[merge.id].stage, 'sent');
  assert.equal(data.geminiBusy(merge), true, 'one check at a time');

  NOTES.push({ id: 'ngc1', at: new Date().toISOString(), author: 'gemini', about: 'me/store:user-calls/s1-merge-7.json',
               text: 'Merged already, so nothing is left to vote on.' });
  RESULTS[data.checks[merge.id].id] = { ok: true, message: 'Gemini: moot. Merged already.', closedAt: new Date().toISOString() };
  await until(() => data.checks[merge.id].stage === 'done');
  await until(() => data.allNotes.some((n) => n.id === 'ngc1'));
  assert.equal(data.noteRows(merge).at(-1).n.text, 'Merged already, so nothing is left to vote on.', 'the verdict reaches the card');
  assert.doesNotMatch(data.callLine(merge), /Gemini votes/, 'a moot call gets a note and no vote');
  assert.match(data.geminiTip(merge), /^Checked .*Gemini: moot\. Merged already\. Ask again/);
});

test('a withdrawn vote leaves the row: an author\'s latest vote is the one that counts', async () => {
  const decision = CALLS[1];
  NOTES.push({ id: 'ng2', at: '2026-10-06T10:00:00Z', author: 'gemini', about: CALL_LOC, text: 'Taken back.', vote: '' });
  await data.loadNotes();
  await until(() => data.allNotes.some((n) => n.id === 'ng2'));
  assert.doesNotMatch(data.callLine(decision), /Gemini votes/);
  NOTES.pop();
});
