// The pages a branch or a session offers to OPEN: the paths the crawl stores,
// the address each one deserves, and the join that puts both on a row.
//
// Three files meet here and each owns one part, which is why the test is one
// file rather than three:
//
//   kits/branch-status.js    which changed paths are pages at all (renderablePages)
//   kits/guide-render.js     which ADDRESS each page deserves (pageTargets)
//   alpineComponents/estate.js  the join: a branch row's paths, the repo's own
//                            showing declaration, and the ref to open them at
//
// The rule worth pinning is the framed one. A repo whose pages are mounted by
// an app declares that in .web-tools.json, and a page under a declared view is
// NOT addressable on its own: the toss straight at it renders a document that
// boots into nothing. docs/showing-mechanisms.csv records that route as the one
// the session store got wrong most often, and scripts/showing.py reads the same
// three fields to avoid it, so the app and the script pick from one declaration
// rather than from two opinions.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot, startAlpine } from './bootstrap.mjs';

const load = (rel) => {
  const w = {};
  new Function('window', readFileSync(path.join(repoRoot, rel), 'utf8'))(w);
  return w;
};
const B = load('lib/kits/branch-status.js').BranchStatus;
const G = load('lib/kits/guide-render.js').GuideRender;

const REPO = 'mehrlander/home';
const BRANCH = 'claude/sidebar-tables-fyl605';
// home's own declaration, trimmed to what this rule reads.
const SHOWING = {
  hosted: false,
  app: 'projects/budget-drs/app/view/app.html',
  app_dir: 'projects/budget-drs/app/',
  views: { submittal: 'projects/budget-drs/submittal/', cem: 'projects/budget-drs/cem/' },
};

// ── Which paths are pages ──────────────────────────────────────────────────

test('renderablePages keeps pages, drops deletions and everything else', () => {
  const pages = B.renderablePages([
    { filename: 'pages/one.html', status: 'modified' },
    { filename: 'pages/gone.html', status: 'removed' },
    { filename: 'lib/kits/thing.js', status: 'modified' },
    { filename: 'docs/notes.md', status: 'added' },
    { filename: 'app/index.htm', status: 'added' },
  ]);
  assert.deepEqual(pages, ['pages/one.html', 'app/index.htm']);
});

test('renderablePages caps, because the strip is a strip', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ filename: `pages/p${i}.html`, status: 'modified' }));
  assert.equal(B.renderablePages(many).length, B.PAGES_CAP);
});

// ── Which address each page deserves ───────────────────────────────────────

test('with no declaration every page is addressed on its own', () => {
  const out = G.pageTargets(REPO, BRANCH, ['pages/a.html', 'pages/b.html', 'docs/x.md'], null);
  assert.deepEqual(out.map(t => t.label), ['a.html', 'b.html']);
  assert.equal(out[0].url,
    'https://mehrlander.github.io/web-tools/pages/toss-render.html'
    + '#gh=mehrlander/home@claude/sidebar-tables-fyl605:pages/a.html');
  assert.equal(out.every(t => !t.framed), true);
});

test('a framed page is opened through its app, on the view that frames it', () => {
  const out = G.pageTargets(REPO, BRANCH, ['projects/budget-drs/submittal/submittal.html'], SHOWING);
  assert.equal(out.length, 1);
  assert.equal(out[0].framed, true);
  assert.equal(out[0].view, 'submittal');
  assert.equal(out[0].addr,
    'mehrlander/home@claude/sidebar-tables-fyl605:projects/budget-drs/app/view/app.html?view=submittal');
  // The reason rides the title, since the chip says only the view's name.
  assert.match(out[0].title, /framed by the app/);
});

test('several pages under one view are one chip, being one thing to open', () => {
  const out = G.pageTargets(REPO, BRANCH, [
    'projects/budget-drs/submittal/submittal.html',
    'projects/budget-drs/submittal/IT-DP-Process-Map.html',
    'projects/budget-drs/cem/cem.html',
  ], SHOWING);
  assert.deepEqual(out.map(t => t.view), ['submittal', 'cem']);
});

test('the app\'s own page is the app, and an undeclared page keeps its own toss', () => {
  const out = G.pageTargets(REPO, BRANCH, [
    'projects/budget-drs/app/view/app.html',
    'pages/loose.html',
  ], SHOWING);
  assert.deepEqual(out.map(t => t.label), ['app.html', 'loose.html']);
  assert.deepEqual(out.map(t => t.framed), [true, undefined]);
  assert.equal(out[0].addr.includes('?view='), false);
});

test('the longest declared prefix wins, so a nested view resolves to itself', () => {
  const nested = { ...SHOWING, views: { outer: 'projects/x/', inner: 'projects/x/deep/' } };
  const out = G.pageTargets(REPO, BRANCH, ['projects/x/deep/page.html'], nested);
  assert.equal(out[0].view, 'inner');
});

// The mark rides the TARGET, so the three strips that draw these chips read one
// value instead of each typing the character. It is the chat convention's own
// glyph (SURFACING.md writes a render link as 🥏), which is the whole reason
// for carrying it rather than leaving every template on ph-disc.
test('every target carries the frisbee, framed or not', () => {
  const out = G.pageTargets(REPO, BRANCH, [
    'projects/budget-drs/submittal/submittal.html',
    'projects/budget-drs/app/view/app.html',
    'pages/loose.html',
  ], SHOWING);
  assert.equal(out.length, 3);
  assert.deepEqual([...new Set(out.map(t => t.mark))], [G.MARK]);
  assert.equal(G.MARK, '\u{1F94F}');
});

// The ref is a BRANCH and branches here always contain a slash, which is the
// thing that makes the choice safe to make: git forbids ':' in a ref name, so
// the toss grammar splits the address on the colon and carries the ref whole.
// (?use= cannot: it interpolates into a raw.githubusercontent path, which is
// why the route chip beside this one still pins a sha.)
test('a slashed branch name survives into the address intact', () => {
  const out = G.pageTargets(REPO, 'claude/a/b/c', ['pages/a.html'], null);
  assert.equal(out[0].url.endsWith('#gh=mehrlander/home@claude/a/b/c:pages/a.html'), true);
});

// ── The join, on a real estate component ───────────────────────────────────

class StubGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  ago() { return 'recently'; }
  async get() { throw new Error('404'); }
  async ls() { throw new Error('404'); }
  async req() { return { default_branch: 'main', description: '', private: true, pushed_at: '' }; }
}

const { window } = makeWindow({
  html: `<!doctype html><html><body><div id="es" x-data="estate()"></div></body></html>`,
});
window.TOKEN = 'tkn';
window.GH = StubGH;
window.__shell = { REGISTRY_REPO: 'me/registry', DEFAULT_REPO: 'me/tools',
                   quickLinks: [], hasToken: () => true, _authState: 'auth' };

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/branch-status.js',
  'lib/kits/guide-render.js',
  'lib/kits/surface.js',
  'lib/alpineComponents/estate.js',
]);
const data = Alpine.$data(window.document.getElementById('es'));

const SESS = (id) => `https://claude.ai/code/session_${id}`;
const setUp = ({ branches, records, showing }) => {
  data.activity = { [REPO]: { defaultBranch: 'main', scan: { branches } } };
  data.sessionRows_ = records || [];
  data.confMap_ = { [REPO]: showing ? { showing } : {} };
  data.sessionScope = 'all';
  data.sessionRepoFilter = '';
};
const branchRow = (name, pages, extra = {}) =>
  ({ name, group: 'active', date: '2026-09-14', pages, ...extra });

test('a branch row offers its pages, at the branch and through the app', () => {
  setUp({ branches: [branchRow(BRANCH, ['projects/budget-drs/submittal/submittal.html'])],
          showing: SHOWING });
  const row = data.allBranchRows.find(b => b.name === BRANCH);
  const chips = data.branchPages(row);
  assert.equal(chips.length, 1);
  assert.equal(chips[0].view, 'submittal');
  assert.match(chips[0].url, new RegExp('@' + BRANCH + ':'));
});

test('a branch the crawl has not scanned draws nothing rather than guessing', () => {
  setUp({ branches: [branchRow('claude/unscanned', undefined)], showing: SHOWING });
  const row = data.allBranchRows.find(b => b.name === 'claude/unscanned');
  // Spread across the realm boundary: the component's arrays are built in
  // jsdom's window, so a strict deepEqual would fail on the prototype alone.
  assert.deepEqual([...data.branchPages(row)], []);
});

test('a repo with no showing declaration addresses its pages directly', () => {
  setUp({ branches: [branchRow(BRANCH, ['projects/budget-drs/submittal/submittal.html'])] });
  const chips = data.branchPages(data.allBranchRows.find(b => b.name === BRANCH));
  assert.equal(chips[0].framed, undefined);
  assert.equal(chips[0].label, 'submittal.html');
});

test('a session folds its branches\' pages into one strip, deduplicated', () => {
  setUp({
    branches: [
      branchRow('claude/one', ['projects/budget-drs/submittal/a.html'], { sessions: [SESS('AAA')] }),
      branchRow('claude/two', ['projects/budget-drs/submittal/b.html', 'pages/solo.html'],
                { sessions: [SESS('AAA')] }),
    ],
    records: [{ id: 'rec1', agent: SESS('AAA'), day: '2026-09-14',
                started: '2026-09-14T00:00:00Z', ended: '2026-09-14T01:00:00Z',
                repos: [], branches: [], mins: 60, ask: 'build the thing' }],
    showing: SHOWING,
  });
  const chips = data.sessionPages({ id: 'rec1' });
  // Two branches, two framed pages under one view, and they are NOT one chip
  // here: each carries its own branch, so the addresses differ and both belong.
  assert.deepEqual([...chips.map(c => c.label)], ['submittal', 'submittal', 'solo.html']);
  assert.equal(new Set(chips.map(c => c.url)).size, 3);
});

test('a session with no branches has no strip, and the detail draws none', () => {
  setUp({ branches: [], records: [{ id: 'lone', day: '2026-09-14', started: '2026-09-14T00:00:00Z',
                                    ended: '2026-09-14T00:10:00Z', repos: [], branches: [],
                                    mins: 10, ask: 'read something' }] });
  assert.deepEqual([...data.sessionPages({ id: 'lone' })], []);
});
