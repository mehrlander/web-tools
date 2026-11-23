// alpineComponents/estate.js — the open row. A deck docked beside the Branches
// or Sessions list makes the pair a list and detail, and the list marks the
// item the deck shows (data/ui-units/codebook.md, "The selected item"):
// aria-current on the row, drawn in the row's own colour. Beside a list, the
// list's own axis is the one a reader reaches for, so ArrowUp and ArrowDown
// step the docked deck as ArrowLeft and ArrowRight do.
//
// The deck kit is the real one, so a key reaches the component the way a swipe
// does: go() scrolls the track, the track reports, onDeckSlide moves the mark.
// The branch view in a slide is a stub; its own suite covers it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, deckGeometry } from './bootstrap.mjs';

class FakeGH {
  static ago() { return 'just now'; }
  constructor(conf = {}) { this.repo = conf.repo || ''; }
  ago() { return 'just now'; }
  async repos() { return []; }
  async get() { throw Object.assign(new Error('404'), { status: 404 }); }
  async ls() { return []; }
  async req() { return {}; }
}

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body><div id="es" x-data="estate()"></div></body></html>`,
});
window.TOKEN = 'tkn';
window.GH = FakeGH;
window.open = () => null;
const shell = {
  REGISTRY_REPO: 'me/registry', DEFAULT_REPO: 'me/tools',
  quickLinks: [], hasToken: () => true, _authState: 'auth', view: 'branches',
  anchorMenu: (ev, rows, opts = {}) => ({ x: 10, y: 20, rows, ...opts }),
  menuStyle: () => 'left:-9999px;top:-9999px',
  refreshConfigCache() {}, refreshActivity() {}, refreshSessions() {},
};
window.__shell = shell;
deckGeometry(window);
window.gh = { load: async () => {} };

// vanilla-bundle for window.esc, which a branch row's repository mark escapes
// through; gh-boot loads it first on every page.
const Alpine = await startAlpine(window, [
  'lib/vanilla-bundle.js',
  'lib/alpine-bundle.js',
  'lib/kits/closing-state.js',
  'lib/kits/repo-sessions-cache.js',
  'lib/kits/branch-status.js',
  'lib/kits/swipe-deck.js',
  'lib/kits/subject-channel.js',
  'lib/kits/surface.js',
  'lib/alpineComponents/estate.js',
]);

const slides = [];
Alpine.data('branchBrief', (opts) => ({
  init() { this.$el.textContent = opts.branch; slides.push(opts.branch); },
}));

const doc = window.document;
const data = Alpine.$data(doc.getElementById('es'));
const tick = (n = 1) => new Promise(r => setTimeout(r, n * 10));
const until = async (ok, what) => {
  for (let n = 0; n < 200 && !ok(); n++) await tick(1);
  assert.ok(ok(), what);
};

const AGENT = 'https://claude.ai/code/session_01SX';
function rec(over = {}) {
  return {
    schema: 3, session_id: 'b8fae678-x', short: 'b8fae678', agent_session: AGENT,
    day: '2026-08-05', started: '2026-08-05T13:00:00Z', ended: '2026-08-05T16:00:00Z',
    repos: [{ name: 'tools', branch: 'feat/a', lines: 10 }],
    opening_ask: 'do the thing', exchanges: 4, assistant_messages: 9,
    tools: { Bash: 4 }, tokens: { input: 1, output: 2, cache_read: 3, cache_write: 4 },
    files_total: 0, files: {}, calls_total: 4, failures: 0, transcript_bytes: 100,
    ...over,
  };
}

const seed = () => {
  slides.length = 0;
  data.activity = {
    'me/tools': { defaultBranch: 'main', openPRs: [], scan: { branches: [
      { name: 'feat/a', sha: 'a1', group: 'stranded', date: '2026-07-19T22:00:00Z',
        firstDate: '2026-07-05T00:00:00Z', subject: 'work a', aheadBy: 4, behindBy: 1,
        sessions: [AGENT] },
      { name: 'feat/b', sha: 'b1', group: 'stranded', date: '2026-07-18T00:00:00Z',
        firstDate: '2026-07-17T20:00:00Z', subject: 'work b', aheadBy: 1, behindBy: 0 },
    ] } },
  };
  data.openRepoFilter = '';
  data.branchScope = 'open';
};

// The Branches pane's rows, one per branch, by the slug each row prints.
const branchRows = () => [...doc.querySelectorAll('[data-pattern="list"] > [data-part="item"]')]
  .filter(el => !el.hasAttribute('data-session-node'));
const marked = (els) => els.filter(el => el.getAttribute('aria-current') === 'true');
const named = (el, name) => el.textContent.includes(name);

async function openAt(i) {
  seed();
  await Alpine.nextTick();
  data.openBranchDetail(data.openBranches[i]);
  await until(() => data._deck && slides.length >= 2, 'the deck opened with both slides');
  await Alpine.nextTick();
  return window.swipeDeck.top();
}
const shut = async () => {
  delete doc.documentElement.dataset.deckPane;
  data.closeDetail(); await tick(4);
};

test('the Branches list marks the row the deck shows, and the mark follows the deck', async () => {
  await openAt(0);
  const rows = branchRows();
  assert.equal(rows.length, 2, 'both branches listed');
  const on = marked(rows);
  assert.equal(on.length, 1, 'one row marked');
  assert.ok(named(on[0], 'feat/a'), 'the row the deck opened on');
  // In the row's own colour: the rail the row already has, widened to the
  // other three sides, with the padding given back so nothing moves.
  assert.match(on[0].className, /border-y-2 border-r-2/);
  assert.match(on[0].className, /pr-2\.5/);
  const off = rows.find(el => el !== on[0]);
  assert.equal(off.hasAttribute('aria-current'), false, 'an unmarked row carries no attribute at all');
  assert.match(off.className, /\bpr-3\b/);
  assert.doesNotMatch(off.className, /border-y-2/);

  data.onDeckSlide(1);
  await Alpine.nextTick();
  const now = marked(branchRows());
  assert.equal(now.length, 1);
  assert.ok(named(now[0], 'feat/b'), 'a swipe moves the mark to the next row');
  await shut();
  assert.equal(marked(branchRows()).length, 0, 'no deck, no mark');
});

test('a session row and a branch tile under it carry the mark too', async () => {
  seed();
  shell.view = 'sessions';
  data.sessionTab = 'list';
  data.sessionScope = 'all';
  data.sessionRepoFilter = '';
  data.sessionRows_ = [window.RepoSessionsCache.summarize(rec(), 'sha1')];
  await Alpine.nextTick();
  const card = () => doc.querySelector('[data-session-node]:not([data-session-node^="stub"])');
  // The branch is one line under the session, named in its label: the line
  // shows what the branch is (its PR title or newest subject), not its name.
  const tile = () => [...doc.querySelectorAll('[data-branch-line]')]
    .find(el => (el.getAttribute('aria-label') || '').endsWith('/feat/a'));
  assert.ok(card(), 'the session is listed');
  assert.ok(tile(), 'with the branch it worked as a line inside it');
  assert.equal(card().hasAttribute('aria-current'), false);

  // The marks are read off which row the deck holds, so the state alone is
  // enough here; the deck that sets it is the other tests' subject.
  data.sessionDeck = { rows: data.sessionDeckRows, i: 0, find: '', finds: {} };
  await Alpine.nextTick();
  assert.equal(card().getAttribute('aria-current'), 'true', 'the session row is marked');
  assert.match(card().className, /border-y-2 border-r-2/);
  data.sessionDeck = null;
  await Alpine.nextTick();
  assert.equal(card().hasAttribute('aria-current'), false);

  assert.equal(tile().hasAttribute('aria-current'), false);
  assert.ok(tile().parentElement.className.includes('divide-y'),
    'the lines are one list, divided by hairlines, not a box each');
  assert.doesNotMatch(tile().className, /ring-2/, 'an unmarked line carries no ring');
  assert.doesNotMatch(tile().className, /bg-(success|warning|error|secondary)/,
    'and no state fill: the state is the mark after the number');
  assert.deepEqual(Object.keys(data.BRANCH_LINE_MARK).sort(), ['closed', 'draft', 'merged', 'ready'],
    'so every PR state has a mark, ready included');
  data.detail = { rows: [{ repo: 'me/tools', name: 'feat/a' }], i: 0 };
  await Alpine.nextTick();
  assert.equal(tile().getAttribute('aria-current'), 'true', 'a branch deck marks the line for that branch');
  assert.match(tile().className, /ring-2 ring-inset/);
  data.detail = null;
  data.sessionRows_ = [];
  shell.view = 'branches';
  await Alpine.nextTick();
});

test('a branch line opens the branch panel-tip, which draws the whole tile', async () => {
  seed();
  shell.view = 'sessions';
  data.sessionTab = 'list';
  data.sessionScope = 'all';
  data.sessionRepoFilter = '';
  data.sessionRows_ = [window.RepoSessionsCache.summarize(rec(), 'sha1')];
  await Alpine.nextTick();
  const line = [...doc.querySelectorAll('[data-branch-line]')]
    .find(el => (el.getAttribute('aria-label') || '').endsWith('/feat/a'));
  assert.ok(line, 'the branch is one line under its session');
  assert.ok(line.textContent.trim().startsWith('tools'), 'led by the repo, as a PR citation is');
  assert.ok(line.textContent.includes('work a'), 'then saying what the branch is');
  assert.equal(line.querySelectorAll('button:not([data-branch-mark]), a').length, 0,
    'with no control of its own but the state mark');
  const settle = async () => { await new Promise(r => setTimeout(r, 0)); await Alpine.nextTick(); };

  line.click();
  await settle();
  assert.equal(data.branchTip?.key, 'tile:me/tools/feat/a');
  assert.equal(data.branchTip.pinned, true, 'a click pins it');
  const tip = doc.querySelector('[data-branch-tip]');
  assert.ok(named(tip, 'feat/a'), 'the panel names the branch');
  assert.ok(tip.querySelector('[aria-label="GitHub links for feat/a"]'), 'and carries the tile\'s controls');

  line.click();
  await settle();
  assert.equal(data.branchTip, null, 'a second click on the same line closes it');

  line.click();
  await settle();
  data.detail = { rows: [{ repo: 'me/tools', name: 'feat/a' }], i: 0 };
  await settle();
  assert.equal(data.branchTip, null, 'opening the branch deck closes it');
  data.detail = null;
  data.sessionRows_ = [];
  shell.view = 'branches';
  await Alpine.nextTick();
});

test('a branch line\'s state mark goes to the PR guide on a click, and peeks on a tap', async () => {
  seed();
  shell.view = 'sessions';
  data.sessionTab = 'list';
  data.sessionScope = 'all';
  data.sessionRepoFilter = '';
  data.sessionRows_ = [window.RepoSessionsCache.summarize(rec(), 'sha1')];
  await Alpine.nextTick();
  const line = [...doc.querySelectorAll('[data-branch-line]')]
    .find(el => (el.getAttribute('aria-label') || '').endsWith('/feat/a'));
  const mark = line.querySelector('[data-branch-mark]');
  assert.ok(mark, 'the mark is a control of its own');
  let asked = null;
  const real = data.openBranchDetail;
  data.openBranchDetail = function(row){ asked = { name: row.name, pane: this._openFiles?.pane }; };
  shell.finePointer = true;
  mark.click();
  data.openBranchDetail = real;
  data._openFiles = null;
  assert.deepEqual(asked, { name: 'feat/a', pane: 'guide' }, 'a click opens the branch on its Guide pane');
  assert.equal(data.branchTip, null, 'and opens no panel');
  shell.finePointer = false;
  mark.click();
  await new Promise(r => setTimeout(r, 0));
  await Alpine.nextTick();
  assert.equal(data.branchTip?.kind, 'guide', 'where nothing hovers, a tap is the peek');
  assert.equal(data.branchTip.pinned, true);
  data.closeBranchTip();
  delete shell.finePointer;
  data.sessionRows_ = [];
  shell.view = 'branches';
  await Alpine.nextTick();
});

test('the guide peek reads the PR body and shows its guide section alone', async () => {
  const saved = { BB: window.BranchBrief, GR: window.GuideRender };
  window.BranchBrief = { readGuide: async () => ({ pulls: [{ number: 7,
    body: 'lead\n[//]: # (guide)\n## What this PR does\nIt does X.\n[//]: # (/guide)\nfooter' }] }) };
  window.GuideRender = { needMarked: async () => {}, bodyClass: () => 'guide-body',
                         render: (md) => ({ html: '<p>' + md + ' <a href="x">f</a></p>', targets: [] }) };
  const row = { repo: 'me/tools', name: 'feat/a', pr: { number: 7, title: 't', draft: true } };
  const el = doc.createElement('button');
  doc.body.appendChild(el);
  data.showBranchTip(row, [], el, true, 'guide');
  await new Promise(r => setTimeout(r, 0));
  await Alpine.nextTick();
  assert.equal(data.branchTip.kind, 'guide');
  assert.equal(data.branchTip.guide.state, 'ready');
  assert.match(data.branchTip.guide.html, /It does X\./);
  assert.doesNotMatch(data.branchTip.guide.html, /footer|lead/, 'the guide section alone');
  assert.match(data.branchTip.guide.html, /target="_blank"/, 'its links open in a new tab');
  const peek = doc.querySelector('[data-guide-peek]');
  assert.ok(peek && /Open guide/.test(peek.textContent), 'with a way through to the Guide pane');
  data.closeBranchTip();
  el.remove();
  window.BranchBrief = saved.BB;
  window.GuideRender = saved.GR;
});

const key = (k, target = doc.body, opts = {}) => {
  const e = new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts });
  target.dispatchEvent(e);
  return e;
};

test('ArrowDown and ArrowUp step a docked deck, and the list follows', async () => {
  await openAt(0);
  doc.documentElement.dataset.deckPane = 'dock';
  const down = key('ArrowDown');
  assert.equal(down.defaultPrevented, true, 'the key is taken, so the page does not scroll as well');
  await until(() => data.detail?.i === 1, 'ArrowDown moved the deck to the next row');
  await Alpine.nextTick();
  assert.ok(named(marked(branchRows())[0], 'feat/b'), 'and the mark with it');
  key('ArrowUp');
  await until(() => data.detail?.i === 0, 'ArrowUp moved it back');
  await shut();
});

test('the arrows are left alone when the deck is not docked, or the key belongs to something else', async () => {
  const h = await openAt(0);
  const steps = [];
  const go = h.deck.go;
  h.deck.go = (i) => steps.push(i);
  try {
    // Full pane: the deck covers the list, so the list's axis means nothing.
    assert.equal(key('ArrowDown').defaultPrevented, false, 'not docked: the page keeps the key');
    doc.documentElement.dataset.deckPane = 'dock';
    // A field, and the deck's own slide, whose pane scrolls on the arrows.
    const input = doc.createElement('input');
    doc.body.append(input);
    key('ArrowDown', input);
    input.remove();
    const fields = [doc.createElement('textarea'), doc.createElement('select'), doc.createElement('div')];
    fields[2].setAttribute('contenteditable', 'true');
    for (const f of fields) { doc.body.append(f); key('ArrowDown', f); f.remove(); }
    key('ArrowDown', h.el.querySelector('section') || h.el);
    // A modifier is someone else's shortcut.
    key('ArrowDown', doc.body, { shiftKey: true });
    assert.deepEqual(steps, [], 'none of those stepped the deck');

    // A deck stacked on the list's deck is not the list's to step.
    // (A session slide opens one of its own, session-brief.js.) Neither deck
    // moves: the one on top is not stepped by the list behind it.
    const over = window.swipeDeck.open({ count: 2, render: () => {} });
    const overSteps = [];
    over.deck.go = (i) => overSteps.push(i);
    key('ArrowDown');
    over.drop();
    assert.deepEqual([...steps, ...overSteps], [], 'a deck on top of the list deck is left alone');

    key('ArrowDown');
    assert.deepEqual(steps, [1], 'and with the list deck back on top, the key steps it');
  } finally {
    h.deck.go = go;
    await shut();
  }
});

test('nothing reported a console error along the way', () => {
  assert.deepEqual(problems, []);
});
