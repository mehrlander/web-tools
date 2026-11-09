// lib/kits/repo-address.js — the one owner/repo[@ref]:path grammar, plus the
// inbox/outbox box specs built on it.
//
// Two decisions are under test, both of them answers to open questions rather
// than incidental behavior:
//
//   1. A missing @ref parses as '' (unspecified), never 'main'. '' is what the
//      contents API wants, and it is right for a repo whose default branch is
//      named something else. A fallback belongs at the link-building boundary,
//      which is what ref() is for.
//   2. A box spec defaults to a FOLDER on the default branch, and can name a
//      ref when a repo wants one. That is the folder-vs-branch question
//      settled as a per-repo choice with the discoverable option as default.
//
// The three older copies of the grammar (StageLink.parseItem,
// DataPayload.parseSpec, ShorterPayload.parseSpec) now DELEGATE here, keeping
// their exported names. What is tested below is that they return this module's
// answer rather than merely agreeing with it, including for the case where they
// used to differ, and that every page loading one of them loads this module
// first. That load order is the delegation's one real constraint: a component
// registers during the bundle's boot, before a page's own gh.load chain runs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/repo-address.js'), 'utf8'))();
const RA = window.RepoAddress;

test('an address parses into repo, ref, and path', () => {
  assert.deepEqual({...RA.parse('me/proj@feat/x:docs/a.md')}, { repo: 'me/proj', ref: 'feat/x', path: 'docs/a.md' });
  assert.deepEqual({...RA.parse('me/proj:docs/a.md')}, { repo: 'me/proj', ref: '', path: 'docs/a.md' });
  assert.deepEqual({...RA.parse('me.dash-repo/a.b-c:x/y/z.json')},
    { repo: 'me.dash-repo/a.b-c', ref: '', path: 'x/y/z.json' }, 'dots and hyphens on both halves');
});

test('a missing ref is unspecified, not a guess', () => {
  assert.equal(RA.parse('me/proj:a.md').ref, '', "'' lets the contents API resolve the default branch");
  assert.equal(RA.ref(RA.parse('me/proj:a.md')), '', 'no fallback asked for, none invented');
  assert.equal(RA.ref(RA.parse('me/proj:a.md'), 'trunk'), 'trunk', 'the caller supplies one where a link needs it');
  assert.equal(RA.ref(RA.parse('me/proj@v2:a.md'), 'trunk'), 'v2', 'a stated ref always wins');
});

test('a non-address is null, so a caller can read it as a bare path', () => {
  assert.equal(RA.parse('just/a/path.md'), null);
  assert.equal(RA.parse('README.md'), null);
  assert.equal(RA.parse(''), null);
  assert.equal(RA.parse(null), null);
});

test('parseRepo reads the grammar with no path: a repo or a branch', () => {
  assert.deepEqual({...RA.parseRepo('me/proj')}, { repo: 'me/proj', ref: '' });
  assert.deepEqual({...RA.parseRepo(' me/proj@feat/x ')}, { repo: 'me/proj', ref: 'feat/x' }, 'trimmed; a slashed ref intact');
  assert.equal(RA.parseRepo('me/proj:a.md'), null, 'a file address is parse()\'s, not this');
  assert.equal(RA.parseRepo('me/proj@x:a.md'), null);
  assert.equal(RA.parseRepo('proj@x'), null, 'no owner, no repo');
  assert.equal(RA.parseRepo(''), null);
});

test('fmt round-trips what parse read', () => {
  for (const s of ['me/proj:a.md', 'me/proj@feat/x:a/b.md', 'me/proj@claude/x@1014b1897601:a/b.md']) {
    assert.equal(RA.fmt(RA.parse(s)), s);
  }
});

test('a pinned address reads at its commit and names its branch', () => {
  // owner/repo@branch@commit:path, the commit 7 to 40 hex characters: every
  // caller fetching by `ref` reads what a commit-only address would.
  assert.deepEqual({...RA.parse('me/proj@claude/x@1014b18:a.md')},
    { repo: 'me/proj', ref: '1014b18', branch: 'claude/x', path: 'a.md' });
  assert.deepEqual({...RA.parseRepo('me/proj@claude/x@1014b18')},
    { repo: 'me/proj', ref: '1014b18', branch: 'claude/x' });
  // Not a commit after the last '@', so the whole of it is the ref, as before.
  for (const ref of ['feat@x', 'b@abc123', 'b@ABCDEF1', 'b@' + 'f'.repeat(41)])
    assert.deepEqual({...RA.parse('me/proj@' + ref + ':a.md')}, { repo: 'me/proj', ref, path: 'a.md' }, ref);
  const t = RA.fromPaste('https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=me/proj@claude/x@1014b1897601:pages/a.html?v=1');
  assert.deepEqual({...t}, { repo: 'me/proj', ref: '1014b1897601', branch: 'claude/x', path: 'pages/a.html', query: 'v=1' });
});

test('the renderer splits a pinned ref as this module does', () => {
  // toss-render.html keeps a copy, since its render path loads no lib.
  const src = readFileSync(path.join(repoRoot, 'pages/toss-render.html'), 'utf8');
  const copy = src.match(/function splitPin\(ref\) \{\n\s*const m = (\/.+\/)\.exec/);
  assert.ok(copy, 'toss-render.html defines splitPin');
  const lib = readFileSync(path.join(repoRoot, 'lib/kits/repo-address.js'), 'utf8').match(/const PIN_RE = (\/.+\/);/);
  assert.equal(copy[1], lib[1]);
});

test('a box spec is a folder by default, on the default branch', () => {
  assert.deepEqual({...RA.parseBox('inbox', 'me/proj')}, { repo: 'me/proj', ref: '', dir: 'inbox' });
  assert.deepEqual({...RA.parseBox('/inbox/', 'me/proj')}, { repo: 'me/proj', ref: '', dir: 'inbox' }, 'slashes normalized');
  assert.deepEqual({...RA.parseBox('drop/incoming', 'me/proj')}, { repo: 'me/proj', ref: '', dir: 'drop/incoming' });
  assert.equal(RA.parseBox('', 'me/proj'), null, 'nothing declared is not the root, it is nothing');
});

test('a box spec can name a branch, which is the per-repo escape hatch', () => {
  assert.deepEqual({...RA.parseBox('@drop:incoming', 'me/proj')}, { repo: 'me/proj', ref: 'drop', dir: 'incoming' });
  assert.deepEqual({...RA.parseBox('@drop:', 'me/proj')}, { repo: 'me/proj', ref: 'drop', dir: '' }, 'a branch root');
});

test('a box can live in another repo entirely', () => {
  assert.deepEqual({...RA.parseBox('other/repo@main:inbox', 'me/proj')},
    { repo: 'other/repo', ref: 'main', dir: 'inbox' });
  assert.deepEqual({...RA.parseBox('other/repo:inbox', 'me/proj')},
    { repo: 'other/repo', ref: '', dir: 'inbox' });
});

test('box() reads the field off a config, or reports nothing declared', () => {
  const cfg = { inbox: 'inbox', outbox: '@shelf:out' };
  assert.deepEqual({...RA.box(cfg, 'inbox', 'me/proj')}, { repo: 'me/proj', ref: '', dir: 'inbox' });
  assert.deepEqual({...RA.box(cfg, 'outbox', 'me/proj')}, { repo: 'me/proj', ref: 'shelf', dir: 'out' });
  assert.equal(RA.box({}, 'inbox', 'me/proj'), null);
  assert.equal(RA.box(null, 'inbox', 'me/proj'), null);
});

// The delegation check. Same inputs, one answer: not "these agree today" but
// "there is one implementation," which is the difference the task was about.
const CASES = ['me/proj:a.md', 'me/proj@feat/x:a/b.md', 'me.dash/a.b-c:x/y.json',
               'a/b@feat/x:p', 'bare/path.md', 'README.md', ''];

test('the three entry points return this module\'s answer, not their own', () => {
  for (const f of ['lib/kits/shorter-payload.js', 'lib/kits/data-payload.js', 'lib/alpineComponents/stage.js']) {
    new window.Function(readFileSync(path.join(repoRoot, f), 'utf8'))();
  }
  const readers = {
    'ShorterPayload.parseSpec': window.ShorterPayload.parseSpec,
    'DataPayload.parseSpec': window.DataPayload.parseSpec,
    'StageLink.parseItem': window.StageLink.parseItem,
  };
  for (const s of CASES) {
    const mine = RA.parse(s);
    for (const [name, read] of Object.entries(readers)) {
      const got = read(s);
      assert.deepEqual(got ? {...got} : got, mine ? {...mine} : mine, `${name}: ${JSON.stringify(s)}`);
    }
  }
});

test('the one behavior change: DataPayload no longer guesses main', () => {
  // It used to fill a missing @ref with 'main'. That was the only place the
  // copies disagreed, and it was the wrong answer for a repo whose default
  // branch is named otherwise. The fallback moved to the link-building
  // boundary (RepoAddress.ref, used by the viewer's fileUrls).
  assert.equal(window.DataPayload.parseSpec('me/proj:a.md').ref, '');
  assert.equal(RA.ref(window.DataPayload.parseSpec('me/proj:a.md'), 'main'), 'main');
});

test('a stage group still splits its comma list, through the shared parser', () => {
  const { items } = window.StageLink.parseLink('#stage=me/proj@dev:a.md,dir/b.md;you/other:c.md');
  // Array.from, not .map: the items come from the jsdom realm, and strict
  // deepEqual compares prototypes.
  assert.deepEqual(Array.from(items, i => ({...i})), [
    { repo: 'me/proj', ref: 'dev', path: 'a.md' },
    { repo: 'me/proj', ref: 'dev', path: 'dir/b.md' },
    { repo: 'you/other', ref: '', path: 'c.md' },
  ]);
});

// The load-order constraint, which is what kept the delegation from landing
// with the module. A page that loads a delegating module without this one gets
// a thrown error at first parse, so the order is checked rather than trusted.
test('every page loading a delegating module loads repo-address.js first', () => {
  const DELEGATES = ['kits/data-payload.js', 'kits/shorter-payload.js', 'alpineComponents/stage.js'];
  const pages = ['pages/data-view.html', 'pages/shorter.html', 'app/index.html'];
  for (const rel of pages) {
    const src = readFileSync(path.join(repoRoot, rel), 'utf8');
    const at = needle => src.indexOf(`gh.load('${needle}')`);
    const grammar = at('kits/repo-address.js');
    for (const d of DELEGATES) {
      const use = at(d);
      if (use === -1) continue;
      assert.ok(grammar !== -1, `${rel} loads ${d} but never repo-address.js`);
      assert.ok(grammar < use, `${rel} loads ${d} before repo-address.js`);
    }
  }
});

test('the pre-build boots url-params.js and repo-address.js before the components', () => {
  // The app takes the bundle, whose components register and start Alpine
  // during the import, before the page's own chain runs. So the bundle has to
  // carry the grammar and the param read in its boot list, not just in its
  // source cache: stage.js reads a stage link during init through both.
  const boot = readFileSync(path.join(repoRoot, 'node/build/build-lib.mjs'), 'utf8');
  assert.match(boot, /extraBoot\s*=\s*\['kits\/url-params\.js',\s*'kits\/repo-address\.js',\s*'kits\/csv\.js',\s*\.\.\.components/);
  // The boot list, not the source cache: the cache is alphabetical and says
  // nothing about order of execution.
  const dist = readFileSync(path.join(repoRoot, 'dist/web-tools.js'), 'utf8');
  const at = p => dist.indexOf(`await window.gh.load("${p}")`);
  const params = at('kits/url-params.js'), grammar = at('kits/repo-address.js'), stage = at('alpineComponents/stage.js');
  assert.ok(params !== -1, 'the built bundle never boots url-params.js');
  assert.ok(grammar !== -1, 'the built bundle never boots repo-address.js');
  assert.ok(stage !== -1 && grammar < stage, 'the built bundle boots the grammar before stage.js');
  assert.ok(params < stage, 'the built bundle boots the param read before stage.js');
});

// ── fromPaste: what a pasted string names ───────────────────────────────────
//
// The question a paste asks is one step wider than "is this an address", and
// the widening is deliberate rather than lenient. A toss link is the shape most
// likely to be in a clipboard, since it is what gets handed over in chat, and
// the renderer wrapping the file is never what pasting it means. Everything
// else must decline, because a caller's fallback is to treat the text as
// content and a false positive silently swallows it.

test('fromPaste reads the bare grammar, splitting the query tail off the path', () => {
  const { fromPaste } = window.RepoAddress;
  assert.deepEqual({...fromPaste('mehrlander/home:projects/budget-drs/submittal/packages.csv')},
    { repo: 'mehrlander/home', ref: '', path: 'projects/budget-drs/submittal/packages.csv', query: '' });
  assert.deepEqual({...fromPaste('  mehrlander/home@feat/x:a/b.md  ')},
    { repo: 'mehrlander/home', ref: 'feat/x', path: 'a/b.md', query: '' });
  // The tail is split rather than left on the path: a caller opening the result
  // has a filename, and toss-render hands that tail to the page as its query.
  assert.deepEqual({...fromPaste('mehrlander/home:projects/budget-drs/app/view/app.html?data=sub_packages')},
    { repo: 'mehrlander/home', ref: '', path: 'projects/budget-drs/app/view/app.html', query: 'data=sub_packages' });
  // A '#frag' belongs to the rendered page, not to the file being named.
  assert.equal(fromPaste('a/b:c/d.html?x=1#top').path, 'c/d.html');
  assert.equal(fromPaste('a/b:c/d.html?x=1#top').query, 'x=1');
  assert.equal(fromPaste('a/b:c/d.html#top').path, 'c/d.html');
});

test('fromPaste reads a toss link as its subject, on any route key', () => {
  const { fromPaste } = window.RepoAddress;
  const toss = 'https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=';
  assert.deepEqual({...fromPaste(toss + 'mehrlander/home@abc123:projects/budget-drs/app/view/app.html?data=sub_packages')},
    { repo: 'mehrlander/home', ref: 'abc123', path: 'projects/budget-drs/app/view/app.html', query: 'data=sub_packages' });
  // A typed toss is read the same way. No route-key list here on purpose:
  // toss-render is itself schema-blind about which page a key names, so a list
  // would be a second registry to keep in step with docs/routes-routes.csv.
  assert.equal(fromPaste(toss.replace('#gh=', '#data=') + 'mehrlander/home:a/rows.csv').path, 'a/rows.csv');
  assert.equal(fromPaste(toss.replace('#gh=', '#shorter=') + 'mehrlander/home:a/doc.md').repo, 'mehrlander/home');
  // Only the first fragment segment carries the subject.
  assert.equal(fromPaste(toss + 'a/b:c.html&w=390').path, 'c.html');
});

test('fromPaste declines everything a caller should treat as content', () => {
  const { fromPaste } = window.RepoAddress;
  for (const s of [
    '', '   ', null, undefined,
    'just some prose',
    'a/b:c.md\nd/e:f.md',                       // multi-line is a block of refs
    'mehrlander/home',                          // a repo names no file
    'https://github.com/mehrlander/home/blob/main/a.md',   // not a toss
    'https://mehrlander.github.io/web-tools/app/?app=budget-drs#data=sub_packages',
    'https://mehrlander.github.io/web-tools/pages/toss-render.html#gz=H4sIA',
    'https://mehrlander.github.io/web-tools/pages/toss-render.html',
    'https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=',
  ]) assert.equal(fromPaste(s), null, `should not read as an address: ${JSON.stringify(s)}`);
});

test('the shell routes a paste through fromPaste rather than its own matcher', () => {
  // The recognition has one owner. A second copy in the shell is how the two
  // would come to disagree about what an address is, which presents as "the
  // paste opened the wrong thing" and is invisible from either side.
  const shell = readFileSync(path.join(repoRoot, 'app/index.html'), 'utf8');
  assert.match(shell, /window\.RepoAddress\.fromPaste\(text\)/,
    'app/index.html no longer routes a pasted address through RepoAddress.fromPaste');
  assert.match(shell, /if \(await this\.pasteRoute\(cd\)\) return;/,
    'the app paste handler no longer tries a route before staging');
  // A file in the clipboard is content whatever text rides beside it.
  assert.match(shell, /if \(\[\.\.\.\(cd\.items \|\| \[\]\)\]\.some\(i => i\.kind === 'file'\)\) return false;/,
    'pasteRoute no longer yields a file-carrying clipboard to the Stage');
});

// ── github: where an address lives on GitHub ───────────────────────────────
test('github builders encode a ref and a path per segment, and default the ref to HEAD', () => {
  const G = RA.github;
  assert.equal(G.blob('o/r', 'claude/x-y', 'docs/a b.md'), 'https://github.com/o/r/blob/claude/x-y/docs/a%20b.md');
  assert.equal(G.blob('o/r', '', 'a.md'), 'https://github.com/o/r/blob/HEAD/a.md', 'no ref is HEAD');
  assert.equal(G.blob('o/r', 'main', '/a.md', 12), 'https://github.com/o/r/blob/main/a.md#L12');
  assert.equal(G.blob('o/r', 'main', 'a.md', '12-20'), 'https://github.com/o/r/blob/main/a.md#L12-L20');
  assert.equal(G.blob('o/r', 'main', 'a.md', 'L3'), 'https://github.com/o/r/blob/main/a.md#L3');
  assert.equal(G.blob('o/r', 'f#1', 'x?.md'), 'https://github.com/o/r/blob/f%231/x%3F.md', 'what broke the raw form');
  assert.equal(G.tree('o/r', 'claude/x'), 'https://github.com/o/r/tree/claude/x');
  assert.equal(G.tree('o/r', 'main', 'lib/kits'), 'https://github.com/o/r/tree/main/lib/kits');
  assert.equal(G.commits('o/r', 'claude/x', 'a.md'), 'https://github.com/o/r/commits/claude/x/a.md');
  assert.equal(G.commit('o/r', 'abc123'), 'https://github.com/o/r/commit/abc123');
  assert.equal(G.compare('o/r', 'main', 'claude/x'), 'https://github.com/o/r/compare/main...claude/x');
  assert.equal(G.pull('o/r', 7), 'https://github.com/o/r/pull/7');
  assert.equal(G.issue('o/r', 7), 'https://github.com/o/r/issues/7');
  assert.equal(G.repo('o/r'), 'https://github.com/o/r');
  assert.equal(G.repo('o/r', 'pulls'), 'https://github.com/o/r/pulls');
  assert.equal(G.newFile('o/r', 'claude/x', 'chron/dump/a b.md'), 'https://github.com/o/r/new/claude/x/chron/dump?filename=a%20b.md');
  assert.equal(G.newFile('o/r', 'main', 'top.md'), 'https://github.com/o/r/new/main?filename=top.md');
  assert.equal(G.of(RA.parse('o/r@claude/x:a.md')), 'https://github.com/o/r/blob/claude/x/a.md');
  assert.equal(G.of(null), '');
});
