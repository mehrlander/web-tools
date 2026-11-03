// The launcher's newer-on-branch badge (lib/alpineComponents/fab.js,
// checkNewer). A render link pins one commit, so a reload keeps showing it
// after the session behind it pushes again; the badge says so, and a tap on it
// (or its long-press row) redraws at the branch's latest commit. What breaks
// without these: a badge over a page already at the tip, a badge built from a
// merged PR's branch, calls spent with no token, a refocus that re-reads from
// the one-minute cache, a tap that drags the launcher instead of redrawing, and
// a tap that redraws nothing because the kit it routes through never loaded.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
const doc = window.document;
Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'visible' });

// A GitHub stand-in that answers the two calls the check makes and records
// every call, with the options it was given.
let calls = [], answers = {};
let token = 'ghp_test';
window.ghAuth = { resolve: () => token };
window.GH = class {
  constructor(o) { this.repo = o.repo; }
  async req(p, opts) {
    calls.push({ repo: this.repo, p, opts });
    const hit = Object.keys(answers).find(k => p.startsWith(k));
    if (!hit) throw Object.assign(new Error('404'), { status: 404 });
    return answers[hit];
  }
  static FRESH = { cache: 'no-store' };
};
const navs = [];
window.__tossNavigate = (addr) => navs.push(addr);

const Alpine = await startAlpine(window, ['lib/kits/guide-render.js', 'lib/alpineComponents/path-picker.js', 'lib/alpineComponents/fab.js']);

const SHA = 'aaaaaaa11111', TIP = 'c'.repeat(40);
const ahead = (n) => ({ ahead_by: n, commits: Array.from({ length: n }, (_, i) => ({ sha: i === n - 1 ? TIP : 'b'.repeat(40) })) });

async function mount(subject) {
  calls = []; navs.length = 0;
  window.__tossSubject = subject;
  const host = doc.createElement('div');
  host.innerHTML = '<div x-data="fab()" data-repo="mehrlander/web-tools" data-path="pages/toss-render.html"></div>';
  doc.body.appendChild(host);
  Alpine.initTree(host);
  await tick(6);
  const el = host.firstElementChild;
  return { el, d: Alpine.$data(el), badge: () => el.querySelector('[data-fab-newer]') };
}
const shown = (node) => !!node && node.style.display !== 'none';
// The calls the newer check makes, without the ref bar's line standing against
// the default branch (checkLine), which a pin with a known line makes too.
const own = () => calls.map(c => c.p).filter(p => !p.startsWith('compare/main...'));
// The check is two awaits and Alpine renders a tick after it, so wait on the
// condition rather than on a count of ticks.
async function until(fn, n = 40) { for (let i = 0; i < n && !fn(); i++) await tick(1); return fn(); }

test('a pinned toss behind its branch wears the badge, and a tap redraws at the tip', async () => {
  answers = { 'compare/': ahead(2) };
  const { d, badge, el } = await mount({ repo: 'me/r', ref: SHA, branch: 'claude/x', path: 'pages/a.html' });
  assert.deepEqual({ ...d.newer }, { branch: 'claude/x', ahead: 2, sha: 'cccccccccccc', target: 'claude/x@cccccccccccc' });
  assert.deepEqual(own(), ['compare/' + SHA + '...claude/x'], 'the named branch needs no PR lookup');
  assert.ok(await until(() => shown(badge())), 'the badge is up');
  assert.match(badge().textContent, /2/);
  assert.equal(badge().dataset.titleTip, '2 newer versions', 'the badge\'s tip is the count alone');
  badge().click();
  await until(() => navs.length);
  assert.deepEqual(navs, ['me/r@claude/x@cccccccccccc:pages/a.html'], 'redrawn at the tip, pinned');
  // The long-press row offers the same redraw, named in full.
  d.fabMenu = true;
  await until(() => el.querySelector('[data-fab-newer-row]'));
  const row = el.querySelector('[data-fab-newer-row]');
  assert.ok(row, 'the menu carries the row');
  assert.match(row.textContent, /Latest version/);
  assert.equal(row.dataset.titleTip, 'Commit cccccccccccc, the latest on claude/x', 'the commit and branch ride in the tip');
  assert.match(row.textContent, /2 newer/);
});

test('a tap before the guide kit has loaded waits for it, rather than redrawing nothing', async () => {
  // A toss shell pulls fab.js alone, so kits/guide-render.js (where
  // renderTarget lives) arrives by self-load, and until 2026-10-29 only a
  // rendered PR guide asked for it. The first test above has the kit up front,
  // which is how it passed while the badge did nothing on a real toss.
  answers = { 'compare/': ahead(1) };
  const kit = window.GuideRender;
  delete window.GuideRender;
  try {
    const { d, badge } = await mount({ repo: 'me/r', ref: SHA, branch: 'claude/x', path: 'pages/a.html' });
    const loads = [];
    d._selfLoad = async (p, ready) => { loads.push(p); if (p === 'kits/guide-render.js') window.GuideRender = kit; return ready(); };
    assert.ok(await until(() => shown(badge())), 'the badge is up');
    badge().click();
    await until(() => navs.length);
    assert.ok(loads.includes('kits/guide-render.js'), 'the tap asked for the kit');
    assert.deepEqual(navs, ['me/r@claude/x@cccccccccccc:pages/a.html'], 'and then redrew at the tip');
  } finally { window.GuideRender = kit; }
});

test('a commit-only link finds its branch through an open pull request, never a merged one', async () => {
  answers = {
    ['commits/' + SHA + '/pulls']: [
      { state: 'closed', head: { ref: 'claude/old', repo: { full_name: 'me/r' } } },
      { state: 'open', head: { ref: 'claude/y', repo: { full_name: 'me/r' } } },
    ],
    'compare/': ahead(1),
  };
  const { d } = await mount({ repo: 'me/r', ref: SHA, path: 'pages/a.html' });
  await until(() => d.newer);
  assert.equal(d.newer && d.newer.branch, 'claude/y');
  assert.deepEqual(own(), ['commits/' + SHA + '/pulls', 'compare/' + SHA + '...claude/y']);

  answers = { ['commits/' + SHA + '/pulls']: [{ state: 'closed', head: { ref: 'claude/old', repo: { full_name: 'me/r' } } }] };
  const merged = await mount({ repo: 'me/r', ref: SHA, path: 'pages/b.html' });
  await until(() => calls.length >= 1 && !merged.d._newerBusy);
  assert.equal(merged.d.newer, null, 'a merged PR offers nothing');
  assert.deepEqual(calls.map(c => c.p), ['commits/' + SHA + '/pulls'], 'and asks for no compare');
});

test('no badge at the tip, on a branch-named ref, or without a token', async () => {
  answers = { 'compare/': { ahead_by: 0, commits: [] } };
  const tip = await mount({ repo: 'me/r', ref: SHA, branch: 'claude/x', path: 'pages/a.html' });
  await until(() => calls.length >= 1 && !tip.d._newerBusy);
  assert.equal(tip.d.newer, null);
  assert.ok(!shown(tip.badge()), 'nothing newer, no badge');

  const named = await mount({ repo: 'me/r', ref: 'claude/x', path: 'pages/a.html' });
  assert.equal(named.d.newer, null);
  // The only call a branch-named address makes is the ref bar's line standing
  // against the default branch (checkLine); the newer check makes none.
  assert.deepEqual(own(), [], 'a branch-named address already follows its tip');

  token = '';
  try {
    const bare = await mount({ repo: 'me/r', ref: SHA, branch: 'claude/x', path: 'pages/a.html' });
    assert.equal(bare.d.newer, null);
    assert.deepEqual(calls, [], 'no token, no calls: the anonymous limit is the whole browser\'s');
  } finally { token = 'ghp_test'; }
});

test('a return to the tab re-asks past the read cache, and not twice in a row', async () => {
  answers = { 'compare/': ahead(1) };
  const { d } = await mount({ repo: 'me/r', ref: SHA, branch: 'claude/x', path: 'pages/a.html' });
  await until(() => d.newer);
  assert.equal(own().length, 1);
  d._newerAt = 0;
  answers = { 'compare/': ahead(3) };
  doc.dispatchEvent(new window.Event('visibilitychange'));
  await until(() => d.newer && d.newer.ahead === 3);
  const back = calls.filter(c => c.opts && c.opts.cache === 'no-store');
  assert.ok(back.length >= 1, 'the refocus read is fresh');
  assert.equal(d.newer.ahead, 3, 'and its answer replaces the last one');
  const before = calls.length;
  doc.dispatchEvent(new window.Event('visibilitychange'));
  await tick(4);
  assert.equal(calls.length, before, 'a second return inside 30 seconds is not asked again');
});

test('the badge is a button, so the launcher\'s touch guard lets its tap through', async () => {
  // holdTouch cancels touchstart on the launcher except over a button or a
  // link, and a cancelled touchstart on iOS eats the click.
  answers = { 'compare/': ahead(1) };
  const { badge } = await mount({ repo: 'me/r', ref: SHA, branch: 'claude/x', path: 'pages/a.html' });
  await until(() => badge());
  assert.equal(badge().tagName, 'BUTTON');
  assert.ok(!badge().closest('[role="button"]'), 'and it is not a control inside the launcher control');
});

// ── The ref bar: the line's row, and a pin's row under it ─────────────────
test('the ref bar draws the line with its standing against main, and the pin under it', async () => {
  answers = { 'compare/main...': { ahead_by: 29, behind_by: 39, commits: [] }, 'compare/': ahead(2) };
  const { d, el } = await mount({ repo: 'me/r', ref: SHA, branch: 'claude/fab-naming-todqvq', path: 'pages/a.html' });
  await until(() => d.pin && d.line);
  assert.equal(d.refPinned, true);
  assert.equal(d.refLine, 'claude/fab-naming-todqvq', 'the line is the branch the link named, not the commit');
  assert.equal(d.refSha, SHA.slice(0, 7));
  assert.deepEqual({ ...d.refLineStanding }, { ahead: 29, behind: 39 }, 'the line against main, though the view is pinned');
  assert.deepEqual({ ...d.refPinStanding }, { kind: 'behind', text: '↓2' });
  assert.equal(calls.filter(c => c.p.startsWith('compare/main...')).length, 1, 'the line is asked about once');
  assert.equal(d.refPr, null, 'no PR, no line under the branch');
  d.open = true; d.activeTab = 'render';
  await until(() => el.querySelector('[data-ref-pin-standing]') && el.querySelector('[data-ref-line-standing]'), 80);
  const bar = el.querySelector('[data-ref-bar]');
  assert.match(bar.textContent.replace(/\s+/g, ' '), /claude\/fab-naming-todqvq ↑29 ↓39 └ @aaaaaaa ↓2/);
  assert.ok(!/house/.test(bar.innerHTML), 'no house: that icon is the home repo\'s');
  const toggle = el.querySelector('[data-ref-toggle]');
  assert.equal(toggle.tagName, 'BUTTON');
  assert.equal(toggle.getAttribute('aria-label'), 'Branches with another version of this page', 'the branch name opens the list');
  const leave = el.querySelector('[data-ref-leave]');
  assert.ok(shown(leave), 'the line\'s row has an x');
  assert.equal(leave.getAttribute('aria-label'), 'Go to main', 'and it goes to main');
  const x = el.querySelector('[data-ref-pin] [data-ref-unpin]');
  assert.equal(x.getAttribute('aria-label'), 'Unpin: show claude/fab-naming-todqvq live');
  x.click();
  await until(() => navs.length);
  assert.deepEqual(navs, ['me/r@claude/fab-naming-todqvq:pages/a.html'], 'unpinning shows the line live');
});

test('a pin at latest says latest, a pin on main has no line x, and a live branch has no pin row', async () => {
  answers = { 'compare/': { ahead_by: 0, behind_by: 0, commits: [] } };
  const tip = await mount({ repo: 'me/r', ref: SHA, branch: 'claude/x', path: 'pages/a.html' });
  await until(() => tip.d.pin);
  assert.deepEqual({ ...tip.d.refPinStanding }, { kind: 'latest', text: 'latest' });

  answers = { 'compare/': ahead(5) };
  const onMain = await mount({ repo: 'me/r', ref: SHA, branch: 'main', path: 'pages/a.html' });
  await until(() => onMain.d.pin);
  assert.equal(onMain.d.refLineStanding, null, 'main is not measured against itself');
  assert.deepEqual(calls.map(c => c.p), ['compare/' + SHA + '...main'], 'nor asked about');
  onMain.d.open = true; onMain.d.activeTab = 'render';
  await until(() => onMain.el.querySelector('[data-ref-unpin]'), 80);
  assert.ok(!shown(onMain.el.querySelector('[data-ref-leave]')), 'pinned on main, the main row has no x');
  assert.equal(onMain.el.querySelector('[data-ref-unpin]').getAttribute('aria-label'), 'Unpin: show main live');

  answers = { 'compare/': { ahead_by: 3, behind_by: 1, commits: [] } };
  const live = await mount({ repo: 'me/r', ref: 'claude/x', path: 'pages/a.html' });
  await until(() => live.d.line);
  assert.equal(live.d.refPinned, false);
  assert.equal(live.d.refLine, 'claude/x');
  assert.deepEqual({ ...live.d.refLineStanding }, { ahead: 3, behind: 1 });
  assert.deepEqual(calls.map(c => c.p), ['compare/main...claude/x']);
  assert.equal(live.el.querySelector('[data-ref-pin]'), null, 'a live branch has no pin row');
});

test('a pin\'s line with a pull request carries its title under the name', async () => {
  answers = {
    'compare/': ahead(1),
    'pulls?': [{ number: 1201, title: 'Ref bar rows', state: 'open', head: { ref: 'claude/x' } }],
  };
  const { d, el } = await mount({ repo: 'me/r', ref: SHA, branch: 'claude/x', path: 'pages/a.html' });
  d.activeTab = 'render';
  d.toggle();
  await until(() => d.refPr, 80);
  assert.ok(calls.some(c => c.p.startsWith('pulls?') && c.p.includes(encodeURIComponent('me:claude/x'))), 'asked for the line\'s PRs');
  assert.deepEqual({ ...d.refPr }, { number: 1201, title: 'Ref bar rows' }, 'the line\'s PR, found under the line rather than the commit');
  await until(() => /#1201 · Ref bar rows/.test(el.querySelector('[data-ref-pr]').textContent), 80);
  assert.ok(await until(() => shown(el.querySelector('[data-ref-pr]')), 80), 'and the line shows');
});
