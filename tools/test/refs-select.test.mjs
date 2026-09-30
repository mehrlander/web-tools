// refs-select.test.mjs — the selection (docs/loader.md, "The selection"): a
// link names, for any repository a page reads, the ref to read it at, and the
// GH client follows it for reads while every write stays where it was.
//
// Three copies of the resolver exist, because three documents install it
// before any other code runs: lib/gh-api.js (a deployed page), the renderer's
// prelude (pages/toss-render.html) and the top-mode launcher
// (pages/scratch/toss-top-probe.html). They are lifted out here and held to one
// table of answers, and the four parsers of `refs=owner/repo@ref[:path]` to one
// grammar, so a link can never mean two things in two places.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const read = p => readFileSync(path.join(repoRoot, p), 'utf8');
const GHAPI = read('lib/gh-api.js'), RENDER = read('pages/toss-render.html'),
      LAUNCH = read('pages/scratch/toss-top-probe.html'), ENTRY = read('lib/entry.js'),
      STORE = read('lib/gh-store.js');

// Brace-matched lift of `function NAME(...) {...}` or `NAME = function (...) {...}`.
function lift(src, sig) {
  const start = src.indexOf(sig);
  assert.notEqual(start, -1, sig + ' not found');
  let depth = 0;
  for (let j = src.indexOf('{', start); j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(start, j + 1);
  }
  throw new Error('unbalanced braces after ' + sig);
}

// Each copy as (E, I, repo, path, pathOnly) => ref.
const copies = {
  renderer: new Function('return ' + lift(RENDER, 'function refForIn(E, I, repo, path, pathOnly)'))(),
  launcher: new Function('return ' + lift(LAUNCH, 'function refForIn(E, I, repo, path, pathOnly)'))(),
  ghApi: (() => {
    const body = lift(GHAPI, 'window.__refFor = function (repo, path, pathOnly)').replace(/^window\.__refFor = /, '');
    return (E, I, repo, p, pathOnly) => new Function('window', 'return ' + body)({ __refs: E, __refsImplied: I })(repo, p, pathOnly);
  })(),
};

const E = {
  'o/r': 'repo-br',
  'o/r:lib/': 'dir-br',
  'o/r:lib/kits/x.js': 'file-br',
  'o/r:pages/a.html': 'page-br',
  'o/other': 'other-br',
};
const I = { 'o/r': 'implied-r', 'o/implied-only': 'implied-only-br' };
const CASES = [
  // [repo, path, pathOnly, expected, why]
  ['o/r', 'lib/kits/x.js', false, 'file-br', 'a file entry beats its folder'],
  ['o/r', 'lib/kits/y.js', false, 'dir-br', 'a folder entry covers what is under it'],
  ['o/r', 'lib', false, 'repo-br', 'a folder entry does not cover the folder name without its slash'],
  ['o/r', '/lib/kits/x.js', false, 'file-br', 'a leading slash is ignored'],
  ['o/r', 'pages/a.html', false, 'page-br', 'a file entry'],
  ['o/r', 'pages/b.html', false, 'repo-br', 'the repository entry for the rest'],
  ['o/r', '', false, 'repo-br', 'no path: the repository entry'],
  ['o/r', undefined, false, 'repo-br', 'an absent path reads as none'],
  ['o/r', 'pages/b.html', true, '', 'pathOnly answers path entries alone'],
  ['o/r', 'lib/a.js', true, 'dir-br', 'pathOnly still answers a folder entry'],
  ['o/other', 'x', false, 'other-br', 'another repository'],
  ['o/implied-only', 'x', false, 'implied-only-br', 'an implication answers where nothing was asked'],
  ['o/none', 'x', false, '', 'nothing selected, nothing implied'],
  ['o/r2', 'lib/kits/x.js', false, '', 'a repository whose name extends another is not it'],
];

for (const [name, fn] of Object.entries(copies)) {
  test(`the ${name} resolver answers the selection table`, () => {
    for (const [repo, p, pathOnly, want, why] of CASES) {
      assert.equal(fn(E, I, repo, p, pathOnly), want, `${repo} ${p} ${pathOnly}: ${why}`);
    }
  });
}

test('an explicit entry outranks an implied one for the same repository', () => {
  for (const fn of Object.values(copies)) {
    assert.equal(fn({ 'o/r': 'asked' }, { 'o/r': 'implied' }, 'o/r', 'x'), 'asked');
    assert.equal(fn({}, { 'o/r': 'implied' }, 'o/r', 'x'), 'implied');
  }
});

// ── the grammar ──────────────────────────────────────────────────────────────
// Every parser of the refs= grammar uses one regular expression; a copy that
// drifts is a link that means two things.
const RE = String.raw`/^([^/@:\s]+\/[^/@:\s]+)@([^:]+?)(?::(.+))?$/`;
test('the four refs= parsers share one grammar', () => {
  const inJs = RE;
  assert.ok(GHAPI.includes(inJs), 'lib/gh-api.js');
  assert.ok(ENTRY.includes(inJs), 'lib/entry.js');
  assert.ok(RENDER.includes(inJs), 'pages/toss-render.html');
  assert.ok(LAUNCH.includes(inJs), 'pages/scratch/toss-top-probe.html');
});

const parseRefs = new Function('return ' + lift(RENDER, 'const parseRefs = (values, into) =>').replace(/^const parseRefs = /, ''))();
test('the grammar reads repository, file and folder entries, and a ref with slashes', () => {
  assert.deepEqual(parseRefs([
    'mehrlander/home@revised-records',
    'mehrlander/web-tools@claude/x-y:lib/alpineComponents/map.js',
    'mehrlander/web-tools@main:lib/',
    'o/r@sha123:/leading.js',
    'not-a-repo@x', 'o/r', 'o/r@',
  ], {}), {
    'mehrlander/home': 'revised-records',
    'mehrlander/web-tools:lib/alpineComponents/map.js': 'claude/x-y',
    'mehrlander/web-tools:lib/': 'main',
    'o/r:leading.js': 'sha123',
  });
});

// ── a deployed page installs the selection from its own address ─────────────
async function freshGhApi(search) {
  // __consoleLogs set skips the console capture, which needs a real window.
  const w = { location: { search }, __consoleLogs: [] };
  globalThis.window = w; globalThis.location = w.location;
  try {
    const mod = await import('../../lib/gh-api.js?deployed=' + encodeURIComponent(search) + '&n=' + Math.random());
    return { GH: mod.default, window: w };
  } finally { delete globalThis.location; }
}

test('a deployed page reads refs= and ?use= into window.__refs', async () => {
  const { window: w } = await freshGhApi('?refs=mehrlander/home@h-br&refs=mehrlander/web-tools@x:lib/a.js&use=u-br');
  assert.deepEqual(w.__refs, { 'mehrlander/home': 'h-br', 'mehrlander/web-tools:lib/a.js': 'x', 'mehrlander/web-tools': 'u-br' });
  assert.equal(w.__refFor('mehrlander/web-tools', 'lib/a.js'), 'x');
  assert.equal(w.__refFor('mehrlander/web-tools', 'lib/b.js'), 'u-br');
  delete globalThis.window;
});

test('a refs= entry for web-tools outranks ?use= on the same page', async () => {
  const { window: w } = await freshGhApi('?refs=mehrlander/web-tools@r-br&use=u-br');
  assert.equal(w.__refs['mehrlander/web-tools'], 'r-br');
  delete globalThis.window;
});

test('a renderer\'s stamp is left alone: nothing is re-read off the address', async () => {
  const w = { __refs: { 'o/r': 'stamped' }, __refsImplied: {}, __consoleLogs: [], location: { search: '?refs=o/r@other&use=u' } };
  w.__refFor = () => 'the renderer';
  globalThis.window = w; globalThis.location = w.location;
  await import('../../lib/gh-api.js?stamped=' + Math.random());
  delete globalThis.location; delete globalThis.window;
  assert.deepEqual(w.__refs, { 'o/r': 'stamped' });
  assert.equal(w.__refFor(), 'the renderer');
});

// ── the client: reads follow, writes do not ─────────────────────────────────
const { default: GH } = await import('../../lib/gh-api.js');
async function withSelection(refs, implied, fn) {
  const w = { __refs: refs, __refsImplied: implied || {} };
  w.__refFor = (repo, p, only) => copies.renderer(w.__refs, w.__refsImplied, repo, p, only);
  globalThis.window = w;
  try { return await fn(); } finally { delete globalThis.window; }
}
// Record the contents URL a read asks for.
function recording(conf) {
  const gh = new GH(conf);
  const urls = [];
  gh.req = async (p) => { urls.push(p); return { content: btoa('x'), sha: 's', size: 1 }; };
  return { gh, urls };
}

test('a client given no ref reads where the selection points, and writes to main', async () => {
  await withSelection({ 'o/r': 'sel-br', 'o/r:data/one.json': 'file-br' }, {}, async () => {
    const { gh, urls } = recording({ repo: 'o/r' });
    await gh.get('data/two.json');
    await gh.get('data/one.json');
    assert.deepEqual(urls, ['contents/data/two.json?ref=sel-br', 'contents/data/one.json?ref=file-br']);
    assert.equal(gh.ref, 'main', 'gh.ref, the write branch, is untouched');
    assert.equal(gh.rawUrl('data/one.json'), 'https://raw.githubusercontent.com/o/r/file-br/data/one.json');
  });
});

test('a named ref pins every read, main and the empty string included', async () => {
  await withSelection({ 'o/r': 'sel-br', 'o/r:data/one.json': 'file-br' }, {}, async () => {
    for (const [conf, want] of [[{ ref: 'main' }, 'main'], [{ ref: '' }, 'main'], [{ ref: 'x' }, 'x']]) {
      const { gh, urls } = recording({ repo: 'o/r', ...conf });
      await gh.get('data/one.json');
      assert.deepEqual(urls, ['contents/data/one.json?ref=' + want], JSON.stringify(conf));
    }
  });
});

test('assigning gh.ref pins a client the way naming it did', async () => {
  await withSelection({ 'o/r': 'sel-br' }, {}, async () => {
    const { gh, urls } = recording({ repo: 'o/r' });
    gh.ref = 'assigned';
    await gh.get('a');
    assert.deepEqual(urls, ['contents/a?ref=assigned']);
  });
});

test('a boot client (follow) takes path entries but keeps its own ref for the rest', async () => {
  await withSelection({ 'o/r': 'other-br', 'o/r:lib/x.js': 'file-br' }, {}, async () => {
    const { gh, urls } = recording({ repo: 'o/r', ref: 'boot-br', follow: true });
    await gh.get('lib/x.js'); await gh.get('lib/y.js');
    assert.deepEqual(urls, ['contents/lib/x.js?ref=file-br', 'contents/lib/y.js?ref=boot-br']);
  });
});

test('opts.ref forces one read and never reaches fetch', async () => {
  await withSelection({ 'o/r': 'sel-br' }, {}, async () => {
    const gh = new GH({ repo: 'o/r' });
    const seen = [];
    gh.req = async (p, opts) => { seen.push([p, opts]); return { content: btoa('x'), sha: 's' }; };
    await gh.get('a', { cache: 'no-store', ref: 'main' });
    assert.deepEqual(seen, [['contents/a?ref=main', { cache: 'no-store' }]]);
  });
});

test('with nothing selected, a client given no ref reads main, as before', async () => {
  await withSelection({}, {}, async () => {
    const { gh, urls } = recording({ repo: 'o/r' });
    await gh.get('a');
    assert.deepEqual(urls, ['contents/a?ref=main']);
  });
  const { gh, urls } = recording({ repo: 'o/r' });   // no window at all (Node, a worker)
  await gh.get('a');
  assert.deepEqual(urls, ['contents/a?ref=main']);
});

test('a save through a following client reads its sha at the write branch and writes there', async () => {
  await withSelection({ 'o/r': 'sel-br' }, {}, async () => {
    const gh = new GH({ repo: 'o/r' });
    const calls = [];
    let failed = false;
    gh.req = async (p, opts = {}) => {
      calls.push([p, opts.method || 'GET', opts.body ? JSON.parse(opts.body).branch : undefined]);
      if (opts.method === 'PUT' && !failed) { failed = true; throw Object.assign(new Error('conflict'), { status: 409 }); }
      if (opts.method === 'PUT') return { content: { sha: 'new' } };
      if (p.startsWith('contents/data?')) return [{ name: 'f.json', sha: 'cur' }];
      return { content: btoa('x'), sha: 'cur' };
    };
    gh.ls = async function (dir, o = {}) { return this.req(`contents/${dir}?ref=${o.ref || this.readRef(dir + '/')}`); };
    const w = { GH };
    w.GH.FRESH = GH.FRESH;
    new Function('window', STORE)(w);
    await gh.save('data/f.json', { a: 1 }, 'm');
    const puts = calls.filter(c => c[1] === 'PUT');
    assert.ok(puts.length === 2 && puts.every(c => c[2] === 'main'), 'both PUTs name main: ' + JSON.stringify(calls));
    const shaRead = calls.find(c => c[1] === 'GET');
    assert.equal(shaRead[0], 'contents/data?ref=main', 'the recovery lists the directory at main, not the preview');
  });
});

test('a delete names the branch its sha was read at', async () => {
  const gh = new GH({ repo: 'o/r', ref: 'b' });
  const calls = [];
  gh.req = async (p, opts = {}) => { calls.push([p, opts.method || 'GET', opts.body && JSON.parse(opts.body)]); return { sha: 's' }; };
  new Function('window', STORE)({ GH });
  await gh.del('a.json');
  assert.deepEqual(calls.map(c => c.slice(0, 2)), [['contents/a.json?ref=b', 'GET'], ['contents/a.json', 'DELETE']]);
  assert.equal(calls[1][2].branch, 'b');
});

test('GH.flatTree defaults to the selection, then main', async () => {
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u) => { seen.push(u); return { ok: true, json: async () => ({ tree: [] }) }; };
  try {
    await withSelection({ 'o/r': 'sel-br' }, {}, () => GH.flatTree('o/r'));
    await GH.flatTree('o/r');
  } finally { globalThis.fetch = realFetch; }
  assert.deepEqual(seen.map(u => u.split('/git/trees/')[1]), ['sel-br?recursive=1', 'main?recursive=1']);
});
