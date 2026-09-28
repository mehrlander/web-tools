// bundle-selection.test.mjs — a pre-built bundle answers a read from its cache
// only when the read resolves to the ref the bundle was loaded at.
//
// The bundle (lib/build.js's emit, around the real lib/gh-api.js) replaces
// GH.prototype.get with an in-memory copy of one commit's lib/. Until
// 2026-09-29 that copy answered any client asking for a cached path, so a
// client pinned to 'other-branch' reported the branch from readRef() and got
// main's text from get(). These tests build a real bundle, import it as the
// module a page imports, and ask it every kind of read the selection
// distinguishes (docs/loader.md, "The selection").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const read = p => readFileSync(path.join(repoRoot, p), 'utf8');
const WT = 'mehrlander/web-tools';

// lib/build.js is a browser script that installs window.buildKit.
function buildKit() {
  const w = {};
  new Function('window', read('lib/build.js'))(w);
  return w.buildKit;
}

// Emit a bundle holding one cached file and a trivial gh-boot, and import it.
// `win` is the window the bundle's module sees at evaluation, or none.
async function importBundle(win, { servedFrom } = {}) {
  let src = buildKit().emit({
    ghApiSrc: read('lib/gh-api.js'),
    cache: { 'lib/x.js': 'FROM THE BUILD', 'lib/gh-boot.js': '/* boot */' },
    repo: WT, defaultRef: 'main',
  });
  // A data: import has no https URL of its own; stand the module where a page
  // would have fetched it from.
  if (servedFrom) src = src.split('import.meta.url').join(JSON.stringify(servedFrom));
  if (win) globalThis.window = win; else delete globalThis.window;
  if (win) globalThis.location = win.location;
  try {
    const mod = await import('data:text/javascript;base64,' + Buffer.from(src + '\n//' + Math.random()).toString('base64'));
    return mod.default;
  } finally { delete globalThis.location; }
}

// A client whose network read is recorded instead of made.
function client(GH, conf) {
  const gh = new GH(conf);
  const net = [];
  gh.req = async (p) => { net.push(p); return { content: Buffer.from('FROM THE NETWORK').toString('base64'), sha: 's' }; };
  return { gh, net };
}

test('on a deployed page at main, a client that follows the selection reads the build', async () => {
  const GH = await importBundle(null);
  const { gh, net } = client(GH, { repo: WT });
  assert.equal((await gh.get('lib/x.js')).text, 'FROM THE BUILD');
  assert.deepEqual(net, []);
});

test('a client pinned to another ref reads that ref, not the build (the review finding)', async () => {
  const GH = await importBundle(null);
  const { gh, net } = client(GH, { repo: WT, ref: 'other-branch' });
  assert.equal(gh.readRef('lib/x.js'), 'other-branch');
  assert.equal((await gh.get('lib/x.js')).text, 'FROM THE NETWORK');
  assert.deepEqual(net, ['contents/lib/x.js?ref=other-branch']);
});

test('a read forced by opts.ref, and a client for another repository, go to the network', async () => {
  const GH = await importBundle(null);
  const a = client(GH, { repo: WT });
  assert.equal((await a.gh.get('lib/x.js', { ref: 'fix-br' })).text, 'FROM THE NETWORK');
  assert.deepEqual(a.net, ['contents/lib/x.js?ref=fix-br']);
  const b = client(GH, { repo: 'mehrlander/home' });
  assert.equal((await b.gh.get('lib/x.js')).text, 'FROM THE NETWORK');
});

test('a build loaded at a ref serves the clients that resolve there, and only those', async () => {
  // A deployed page with ?use=x: the bundle's bootstrap runs, boots at x, and
  // gh-api.js installs the selection from the same address.
  const win = { location: { search: '?use=x' }, __consoleLogs: [] };
  const GH = await importBundle(win);
  assert.equal(win.gh.ref, 'x');
  const follows = client(GH, { repo: WT });
  assert.equal((await follows.gh.get('lib/x.js')).text, 'FROM THE BUILD', 'the selection says x, the build is x');
  const main = client(GH, { repo: WT, ref: 'main' });
  assert.equal((await main.gh.get('lib/x.js')).text, 'FROM THE NETWORK', 'a client pinned to main is not served x');
  delete globalThis.window;
});

test('a path entry sends that one file to its own ref, over an unchanged build', async () => {
  const win = { location: { search: '?use=x&refs=mehrlander/web-tools@fix-br:lib/x.js' }, __consoleLogs: [] };
  const GH = await importBundle(win);
  const boot = client(GH, { repo: WT, ref: 'x', follow: true });
  assert.equal((await boot.gh.get('lib/x.js')).text, 'FROM THE NETWORK');
  assert.deepEqual(boot.net, ['contents/lib/x.js?ref=fix-br']);
  assert.equal((await boot.gh.get('lib/gh-boot.js')).text, '/* boot */', 'the rest stays the build');
  delete globalThis.window;
});

test('a build GitHub Pages served is main\'s, whatever was asked (an importer\'s fallback)', async () => {
  // home's surfacer asks for x, fails to resolve it, and imports the deployed
  // build. The bytes are main's, so the build must not take x as its ref.
  const win = { location: { search: '?use=x' }, __consoleLogs: [] };
  const GH = await importBundle(win, { servedFrom: 'https://mehrlander.github.io/web-tools/dist/web-tools.js' });
  assert.equal(win.gh.ref, 'main');
  assert.equal(win.__bundleRef, 'main');
  const follows = client(GH, { repo: WT });
  assert.equal((await follows.gh.get('lib/x.js')).text, 'FROM THE NETWORK', 'the selection says x; the build is main, so x is read');
  const main = client(GH, { repo: WT, ref: 'main' });
  assert.equal((await main.gh.get('lib/x.js')).text, 'FROM THE BUILD');
  delete globalThis.window;
});

test('the committed builds carry the rule', () => {
  for (const f of ['dist/app.js', 'dist/web-tools.js', 'dist/dictate.js']) {
    assert.match(read(f), /const __servesFromBuild = \(gh, p, opts\) =>/, f + ' predates the rule; rebuild it');
    assert.match(read(f), /const deployed = String\(import\.meta\.url\)/, f + ' predates the Pages rule; rebuild it');
  }
});
