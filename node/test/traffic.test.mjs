// traffic.js is the pure read behind the FAB's Traffic tab, and its whole
// reason for existing is that a byte figure is easy to state and easy to state
// dishonestly. So the tests are mostly about the three states a size can be in
// (real, cached, undisclosed) and about totals refusing to absorb the third.
//
// The collection half (gh-boot's fetch and get wrappers) is exercised for real
// at the bottom: the source runs against a window stub, so the ledger, the cap,
// the running totals, and the inlined-vs-fetched tell are executed rather than
// pattern-matched.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const src = readFileSync(path.join(repoRoot, 'lib/kits/traffic.js'), 'utf8');
const window = {};
new Function('window', src)(window);
const T = window.Traffic;

// A Resource Timing entry, in the three shapes a browser actually produces.
const netRow = (name, transfer, decoded, extra = {}) =>
  ({ name, transferSize: transfer, encodedBodySize: Math.round(transfer * 0.9), decodedBodySize: decoded, duration: 100, startTime: 0, initiatorType: 'script', ...extra });
const cachedRow = (name, decoded) =>
  ({ name, transferSize: 0, encodedBodySize: Math.round(decoded * 0.3), decodedBodySize: decoded, duration: 2, startTime: 0, initiatorType: 'script' });
const opaqueRow = (name) =>
  ({ name, transferSize: 0, encodedBodySize: 0, decodedBodySize: 0, duration: 40, startTime: 0, initiatorType: 'script' });

test('fmtBytes keeps the shape of the figures that matter', () => {
  assert.equal(T.fmtBytes(0), '0 B');
  assert.equal(T.fmtBytes(900), '900 B');
  assert.equal(T.fmtBytes(1024), '1.0 KB');
  assert.equal(T.fmtBytes(417435), '408 KB');
  assert.equal(T.fmtBytes(1460047), '1.39 MB');
  // Unknown is never rendered as zero, at any level of the stack.
  assert.equal(T.fmtBytes(null), '?');
  assert.equal(T.fmtBytes(undefined), '?');
  assert.equal(T.fmtBytesShort(1460047), '1.4 MB');
  assert.equal(T.fmtCount(14952), '15k');
  assert.equal(T.fmtCount(4952), '5k');
  assert.equal(T.fmtCount(120), '120');
});

test('classify names GitHub endpoints by shape, and everything else by host', () => {
  const g = u => T.classify(u).group;
  assert.equal(g('https://api.github.com/graphql'), 'graphql');
  assert.equal(g('https://api.github.com/repos/o/r/contents/lib/x.js?ref=main'), 'contents');
  assert.equal(g('https://api.github.com/repos/o/r/git/blobs/abc'), 'contents');
  assert.equal(g('https://api.github.com/repos/o/r/git/trees/main?recursive=1'), 'trees');
  assert.equal(g('https://api.github.com/repos/o/r/commits?sha=main'), 'commits');
  assert.equal(g('https://api.github.com/repos/o/r/commits/abc123'), 'commits');
  assert.equal(g('https://api.github.com/repos/o/r/branches'), 'branches');
  assert.equal(g('https://api.github.com/repos/o/r/pulls?state=open'), 'pulls');
  assert.equal(g('https://api.github.com/rate_limit'), 'meta');
  assert.equal(g('https://api.github.com/repos/o/r/something-new'), 'api', 'an unrecognized API path still reads as the API');
  assert.equal(g('https://cdn.jsdelivr.net/npm/x'), 'cdn');
  assert.equal(g('https://raw.githubusercontent.com/o/r/main/f.js'), 'raw');
  // An unexpected host groups under its own name rather than vanishing into a
  // catch-all, so a page pulling from somewhere new says where.
  assert.equal(g('https://tracker.example.com/beacon'), 'tracker.example.com');
});

test('label collapses a jsDelivr combine URL instead of wrapping four lines', () => {
  assert.equal(
    T.label('https://cdn.jsdelivr.net/combine/npm/daisyui@5/themes.css,npm/daisyui@5,npm/@tailwindcss/typography/dist/typography.min.css'),
    'daisyui@5/themes.css +2');
  assert.equal(T.label('https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js'), 'cdn.min.js');
  assert.equal(T.label('https://example.com/a/b/'), 'b');
  // A generic filename borrows its folder, or a resource list turns into eight
  // rows reading "style.css".
  assert.equal(T.label('https://example.com/pkg/index.js'), 'pkg/index.js');
  assert.equal(T.label('https://cdn.jsdelivr.net/npm/daisyui/components/collapse/style.css'), 'collapse/style.css');
  assert.equal(T.label('https://cdn.jsdelivr.net/npm/daisyui/components/collapse.css'), 'collapse.css');
});

test('a row is network, cached, or undisclosed, and the three are distinguishable', () => {
  assert.equal(T.bootRow(netRow('https://x/a.js', 1000, 3000)).state, 'network');
  // Cache hit: nothing transferred, but the body is still there.
  assert.equal(T.bootRow(cachedRow('https://x/a.js', 3000)).state, 'cached');
  // Cross-origin with no Timing-Allow-Origin: all three zero. The size is
  // unknowable, which is not the same claim as zero.
  const o = T.bootRow(opaqueRow('https://other/a.js'));
  assert.equal(o.state, 'undisclosed');
  assert.equal(o.wire, null);
  assert.equal(o.decoded, null);
});

test('boot totals exclude undisclosed rows and report how many they excluded', () => {
  const b = T.boot([
    netRow('https://cdn.jsdelivr.net/npm/a.js', 70164, 282666),
    netRow('https://mehrlander.github.io/web-tools/dist/web-tools.js', 417435, 1460047),
    cachedRow('https://mehrlander.github.io/web-tools/lib/favicon.svg', 400),
    opaqueRow('https://unknown.example/x.js'),
  ], { name: 'https://mehrlander.github.io/p.html', transferSize: 81941, encodedBodySize: 81941, decodedBodySize: 260000, duration: 300, startTime: 0 });

  assert.equal(b.count, 5);
  assert.equal(b.cached, 1);
  assert.equal(b.undisclosed, 1);
  assert.equal(b.wire, 70164 + 417435 + 81941, 'cached (0) adds nothing and undisclosed is not counted as 0');
  assert.equal(b.decoded, 282666 + 1460047 + 400 + 260000);
  // Heaviest first: the pre-build leads, which is the finding the band exists
  // to make obvious.
  assert.match(b.rows[0].name, /web-tools\.js$/);
  assert.equal(b.rows[0].group, 'code');
});

test('the navigation entry becomes the document row', () => {
  const b = T.boot([], { name: 'https://x/p.html', transferSize: 100, encodedBodySize: 100, decodedBodySize: 400, duration: 10, startTime: 0 });
  assert.equal(b.rows.length, 1);
  assert.equal(b.rows[0].group, 'document');
});

test('boot rows group by role, and a group carries its own undisclosed count', () => {
  const b = T.boot([
    netRow('https://cdn.jsdelivr.net/npm/daisyui@5/themes.css', 94688, 1262704),
    netRow('https://mehrlander.github.io/web-tools/dist/web-tools.js', 417435, 1460047),
    netRow('https://cdn.jsdelivr.net/npm/@phosphor-icons/web/src/regular/Phosphor.woff2', 5000, 5000),
    opaqueRow('https://cdn.jsdelivr.net/npm/mystery.js'),
  ], null);
  const g = Object.fromEntries(T.bootGroups(b.rows).map(x => [x.group, x]));
  assert.equal(g.cdn.count, 2, 'the stylesheet and the opaque one; the font left for its own group');
  assert.equal(g.font.count, 1);
  assert.equal(g.code.wire, 417435);
  assert.equal(g.cdn.undisclosed, 1);
  assert.equal(g.cdn.wire, 94688, 'the undisclosed row contributes nothing to its group total either');
});

test('a .woff2 is a font whatever host serves it', () => {
  const r = T.bootRow(netRow('https://cdn.jsdelivr.net/npm/@phosphor-icons/web/src/bold/Phosphor-Bold.woff2', 5000, 5000));
  assert.equal(r.group, 'font');
});

test('API groups roll by shape, and a missing content-length stays unknown', () => {
  const entries = [
    { url: 'https://api.github.com/repos/o/r/commits?sha=main', ms: 120, status: 200, wire: 4000 },
    { url: 'https://api.github.com/repos/o/r/commits/abc', ms: 90, status: 200, wire: 8000 },
    { url: 'https://api.github.com/repos/o/r/contents/a.js', ms: 60, status: 200, wire: null },
    { url: 'https://api.github.com/repos/o/r/contents/b.js', ms: 60, status: 404, wire: 200, error: null },
    { url: 'https://api.github.com/graphql', ms: 300, status: 200, wire: 12000 },
  ];
  const groups = Object.fromEntries(T.apiGroups(entries).map(g => [g.group, g]));
  assert.equal(groups.commits.calls, 2);
  assert.equal(groups.commits.wire, 12000);
  assert.equal(groups.contents.calls, 2);
  assert.equal(groups.contents.unknown, 1, 'the one with no content-length is counted, not summed');
  assert.equal(groups.contents.wire, 200);
  assert.equal(groups.contents.errors, 1);

  const tot = T.apiTotals(entries);
  assert.equal(tot.calls, 5);
  assert.equal(tot.wire, 4000 + 8000 + 200 + 12000);
  assert.equal(tot.unknown, 1);
  assert.equal(tot.errors, 1);
  assert.equal(tot.ms, 630);
  assert.equal(tot.slowest, 300);
});

test('a write is counted apart from a read, at both levels', () => {
  const entries = [
    { url: 'https://api.github.com/repos/o/r/contents/a.js', method: 'GET', ms: 10, status: 200, wire: 100 },
    { url: 'https://api.github.com/repos/o/r/contents/a.js', method: 'PUT', ms: 40, status: 200, wire: 300 },
    { url: 'https://api.github.com/repos/o/r/contents/b.js', method: 'DELETE', ms: 30, status: 200, wire: 90 },
    { url: 'https://api.github.com/repos/o/r/commits', method: 'GET', ms: 10, status: 200, wire: 100 },
  ];
  assert.equal(T.apiTotals(entries).writes, 2);
  const g = Object.fromEntries(T.apiGroups(entries).map(x => [x.group, x]));
  // The point of the whole column: the write and the read share an endpoint
  // shape, so nothing but the method separates them.
  assert.equal(g.contents.calls, 3);
  assert.equal(g.contents.writes, 2);
  assert.equal(g.commits.writes, 0);

  // Case is not the caller's problem, and an absent method reads as a write:
  // the ledger reports what it saw, and unknown is nearer to "look at this"
  // than to "routine read".
  assert.equal(T.isWrite({ method: 'put' }), true);
  assert.equal(T.isWrite({ method: 'get' }), false);
  assert.equal(T.isWrite({ method: 'HEAD' }), false);
  assert.equal(T.isWrite({}), false, 'no method at all defaults to GET, which is what fetch does');
});

test('repoOf reads the target repo out of every address form we use', () => {
  assert.equal(T.repoOf('https://api.github.com/repos/mehrlander/home/contents/x?ref=main'), 'mehrlander/home');
  assert.equal(T.repoOf('https://api.github.com/repos/o/r/commits/abc'), 'o/r');
  assert.equal(T.repoOf('https://raw.githubusercontent.com/o/r/main/f.js'), 'o/r');
  assert.equal(T.repoOf('https://o.github.io/r/lib/entry.js'), 'o/r');
  // A GraphQL POST names its repo in the body, and the ledger does not read
  // bodies. Null, not a guess.
  assert.equal(T.repoOf('https://api.github.com/graphql'), null);
  assert.equal(T.repoOf('https://example.com/x'), null);
});

test('the repo cut separates a crawl from browsing, and still adds up', () => {
  const entries = [
    // A config crawl: one call each across four repos.
    ...['home', 'budget-wa', 'spend-wa', 'fn-data'].map(r =>
      ({ url: `https://api.github.com/repos/mehrlander/${r}/contents/.web-tools.json`, ms: 90, status: 200, wire: 2000 })),
    // Browsing one repo.
    { url: 'https://api.github.com/repos/mehrlander/web-tools/commits', ms: 100, status: 200, wire: 4000 },
    { url: 'https://api.github.com/repos/mehrlander/web-tools/branches', ms: 100, status: 200, wire: 5000 },
    // A write to the private registry.
    { url: 'https://api.github.com/repos/mehrlander/web-tools-private/contents/state/activity.json', method: 'PUT', ms: 200, status: 200, wire: 800 },
    // And one the URL cannot attribute.
    { url: 'https://api.github.com/graphql', ms: 300, status: 200, wire: 9000 },
  ];
  const rows = T.repoGroups(entries);
  assert.equal(rows.reduce((n, r) => n + r.calls, 0), entries.length, 'every call lands somewhere');
  const by = Object.fromEntries(rows.map(r => [r.repo, r]));
  assert.equal(by['mehrlander/web-tools'].calls, 2);
  assert.equal(by['mehrlander/home'].calls, 1);
  assert.equal(by['mehrlander/web-tools-private'].writes, 1);
  // Four repos at one call each is the crawl's signature, and no endpoint
  // grouping shows it: all four are the same `contents` shape.
  assert.equal(rows.filter(r => r.named && r.calls === 1 && !r.writes).length, 4);
  // The unattributable bucket sorts last, since it is a caveat not a finding.
  assert.equal(rows[rows.length - 1].named, false);
  assert.equal(rows[rows.length - 1].calls, 1);
});

test('a call carrying `via` is a code load, whatever endpoint it used', () => {
  const load = { url: 'https://api.github.com/repos/o/r/contents/lib/x.js?ref=main', via: 'lib/x.js', ms: 40, status: 200, wire: 900 };
  const read = { url: 'https://api.github.com/repos/o/r/contents/data.js?ref=main', ms: 40, status: 200, wire: 900 };
  assert.equal(T.classify(load.url, load).group, 'load');
  assert.equal(T.classify(read.url, read).group, 'contents', 'the identical endpoint, without via, stays a plain file read');
  const g = Object.fromEntries(T.apiGroups([load, read]).map(x => [x.group, x]));
  assert.equal(g.load.calls, 1);
  assert.equal(g.contents.calls, 1);
});

test('the readout line carries three facts, and omits what it does not know', () => {
  const b = T.boot([netRow('https://x/a.js', 680000, 3000000)], null);
  assert.equal(T.summary({ boot: b, api: { calls: 12 }, rate: 4952 }), '664 KB · 12 calls · 5k left');
  assert.equal(T.summary({ boot: b, api: { calls: 1 }, rate: null }), '664 KB · 1 call',
    'no rate header seen yet means no rate claim');
  assert.equal(T.summary({ boot: b, api: { calls: 0 }, rate: null }), '664 KB');

  // Every row withheld its size: there is no weight to report, and "0 B" would
  // be the most confident wrong number the strip could print.
  const blind = T.boot([opaqueRow('https://a/x.js'), opaqueRow('https://b/y.js')], null);
  assert.equal(blind.wire, 0);
  assert.equal(blind.undisclosed, blind.count);
  assert.equal(T.summary({ boot: blind, api: { calls: 3 }, rate: null }), 'size undisclosed · 3 calls');
});

test('storageRows counts UTF-16 bytes for keys and values, biggest first', () => {
  const store = (() => {
    const m = new Map([['ghToken', 'x'.repeat(40)], ['tiny', 'a']]);
    const keys = [...m.keys()];
    return { get length() { return keys.length; }, key: i => keys[i], getItem: k => m.get(k) };
  })();
  const r = T.storageRows(store, 'localStorage');
  assert.equal(r.keys, 2);
  assert.equal(r.bytes, ('ghToken'.length + 40) * 2 + ('tiny'.length + 1) * 2);
  assert.equal(r.top[0].key, 'ghToken');
  assert.equal(T.storageRows(null, 'x'), null, 'a blocked or absent store reports nothing, it does not throw');
});

// ── The collection half, executed ─────────────────────────────────────────
// gh-boot is network-bound as a whole, so this runs it against a window stub
// with every load stubbed out, then drives the wrappers it installed.

async function bootWithStub({ fetchImpl, getImpl } = {}) {
  const boot = readFileSync(path.join(repoRoot, 'lib/gh-boot.js'), 'utf8');
  const events = [];
  class FakeGH {
    async load() {}
    async get(p) { return getImpl ? getImpl(p) : { text: 'x', sha: 'deadbeef', size: 1 }; }
    async read() {}
  }
  const win = {
    gh: new FakeGH(),
    fetch: fetchImpl || (async () => ({ status: 200, headers: { get: () => null } })),
    location: { hash: '' },
    addEventListener() {},
    dispatchEvent(e) { events.push(e.type); },
  };
  win.gh.load = async () => {};
  // gh-boot is run by the loader as new Function('gh', src)(scopedGh), so the
  // scoped loader arrives as a bare identifier, not through window.
  const fn = new Function('gh', 'window', 'CustomEvent', 'performance', 'setTimeout', 'clearTimeout', 'document', 'console', boot);
  await fn(win.gh, win, CustomEvent, performance, setTimeout, clearTimeout, undefined, console);
  return { win, events, proto: Object.getPrototypeOf(win.gh) };
}

test('the fetch wrapper records a call without touching the body', async () => {
  let bodyRead = false;
  const body = { status: 200, headers: { get: h => (h === 'content-length' ? '4096' : h === 'x-ratelimit-remaining' ? '4952' : null) },
                 text() { bodyRead = true; return Promise.resolve('{}'); } };
  const { win } = await bootWithStub({ fetchImpl: async () => body });

  const res = await win.fetch('https://api.github.com/repos/o/r/commits');
  assert.equal(res, body, 'the very same Response object is handed back');
  assert.equal(bodyRead, false, 'the instrument never reads or clones the body');

  assert.equal(win.__traffic.length, 1);
  assert.equal(win.__traffic[0].wire, 4096);
  assert.equal(win.__traffic[0].status, 200);
  assert.equal(win.__trafficTotals.calls, 1);
  assert.equal(win.__trafficTotals.wire, 4096);
  assert.equal(win.__trafficRate, 4952, 'the rate limit is picked up in passing');
});

test('the wrapper records the method, from init or from a Request', async () => {
  const { win } = await bootWithStub({ fetchImpl: async () => ({ status: 200, headers: { get: () => null } }) });
  await win.fetch('https://api.github.com/repos/o/r/contents/a.js');
  await win.fetch('https://api.github.com/repos/o/r/contents/a.js', { method: 'put' });
  await win.fetch({ url: 'https://api.github.com/repos/o/r/contents/b.js', method: 'DELETE' });
  assert.deepEqual(win.__traffic.map(e => e.method), ['GET', 'PUT', 'DELETE']);
  assert.equal(win.__trafficTotals.writes, 2, 'reads are not writes and the count says so');
  assert.equal(win.__trafficTotals.calls, 3);
});

test('a response with no content-length is unknown, not zero', async () => {
  const { win } = await bootWithStub({ fetchImpl: async () => ({ status: 200, headers: { get: () => null } }) });
  await win.fetch('https://api.github.com/repos/o/r/commits');
  assert.equal(win.__traffic[0].wire, null);
  assert.equal(win.__trafficTotals.wire, 0);
  assert.equal(win.__trafficTotals.unknown, 1);
});

test('a failed fetch is recorded and still rejects', async () => {
  const { win } = await bootWithStub({ fetchImpl: async () => { throw new Error('offline'); } });
  await assert.rejects(() => win.fetch('https://api.github.com/x'), /offline/);
  assert.equal(win.__traffic[0].error, 'offline');
  assert.equal(win.__trafficTotals.errors, 1);
});

test('the ledger is capped but its totals are not', async () => {
  const { win } = await bootWithStub({ fetchImpl: async () => ({ status: 200, headers: { get: h => (h === 'content-length' ? '10' : null) } }) });
  for (let i = 0; i < 450; i++) await win.fetch('https://api.github.com/repos/o/r/commits/' + i);
  assert.equal(win.__traffic.length, 400, 'the row list is bounded');
  assert.equal(win.__trafficTotals.calls, 450, 'the count is not');
  assert.equal(win.__trafficTotals.wire, 4500, 'and neither is the byte figure');
  assert.ok(win.__trafficTotals.trimmed > 0, 'and the tab can say rows were dropped');
});

test('the via marker attributes the right fetch, even with gets interleaved', async () => {
  // The claim the whole mechanism rests on: between entering get() and the
  // fetch() call there is no await, so a synchronous marker cannot be captured
  // by a concurrent get. Reasoning like that stops holding the moment someone
  // adds an await, so it is executed here rather than trusted.
  //
  // The stub reproduces gh-api's shape exactly: get calls req synchronously,
  // req runs synchronously as far as fetch(url), and only then awaits.
  const boot = readFileSync(path.join(repoRoot, 'lib/gh-boot.js'), 'utf8');
  const resolvers = [];
  const win = {
    fetch: () => new Promise(res => resolvers.push(() => res({ status: 200, headers: { get: () => null } }))),
    location: { hash: '' },
    addEventListener() {}, dispatchEvent() {},
  };
  class StubGH {
    async req(p) { return win.fetch('https://api.github.com/repos/o/r/' + p).then(() => ({ content: '', sha: 'x', size: 0 })); }
    async get(p) { const d = await this.req('contents/' + p); return { text: '', sha: d.sha, size: 0 }; }
    async load() {} async read() {}
  }
  win.gh = new StubGH();
  win.gh.load = async () => {};
  const fn = new Function('gh', 'window', 'CustomEvent', 'performance', 'setTimeout', 'clearTimeout', 'document', 'console', boot);
  await fn(win.gh, win, CustomEvent, performance, setTimeout, clearTimeout, undefined, console);

  // Three gets fired without awaiting between them: maximal interleaving.
  const all = Promise.all([win.gh.get('a.js'), win.gh.get('b.js'), win.gh.get('c.js')]);
  assert.equal(win.__traffic.length, 3, 'all three requests are in flight at once');
  assert.deepEqual(win.__traffic.map(e => e.via), ['a.js', 'b.js', 'c.js'],
    'each call kept its own path; none captured a neighbour');
  assert.equal(win.__ghGetPath, null, 'and the marker does not leak past the synchronous window');
  // A bare fetch alongside them carries no via at all. Asserted before the
  // resolvers run, since the ledger row is pushed synchronously and the
  // responses are what this stub holds open.
  const bare = win.fetch('https://api.github.com/repos/o/r/commits');
  assert.equal(win.__traffic[3].via, null);

  resolvers.forEach(r => r());
  await Promise.all([all, bare]);
});

test('the get wrapper tells an inlined module from a fetched one', async () => {
  const { win } = await bootWithStub({
    getImpl: async p => (p === 'lib/cached.js'
      ? { text: 'abc', sha: 'build:main', size: 3 }
      : { text: 'abcdef', sha: '9f1c2d', size: 6 }),
  });
  await win.gh.get('lib/cached.js');
  await win.gh.get('lib/fetched.js');
  assert.equal(win.__ghFiles['lib/cached.js'].inlined, true, 'the pre-build stamps sha build:<ref> on what it serves from memory');
  assert.equal(win.__ghFiles['lib/cached.js'].bytes, 3);
  assert.equal(win.__ghFiles['lib/fetched.js'].inlined, false);
  assert.equal(win.__ghFiles['lib/fetched.js'].bytes, 6);
});

test('gh-boot loads traffic.js in the chain, so the readout is never waiting on it', () => {
  const boot = readFileSync(path.join(repoRoot, 'lib/gh-boot.js'), 'utf8');
  assert.match(boot, /\{ path: 'kits\/traffic\.js' \}/, 'the BOOT manifest carries the traffic kit');
  // The wrappers must be installed before the chain pulls anything, or the
  // ledger opens with its own dependencies already missing from it.
  const wrap = boot.indexOf('__trafficWrapped');
  const chain = boot.indexOf('for (const step of BOOT)');
  assert.ok(wrap !== -1 && chain !== -1 && wrap < chain, 'collection is installed before the chain runs');
});

// ── Jobs: the why behind the calls ────────────────────────────────────────
// The job ledger (gh-boot.js) credits a call to the job whose named frame is
// in the call's async stack. The claim worth executing is the hard one: two
// jobs in flight at once, interleaving their calls, each keep their own, and a
// call made beside them by no job is credited to none.

test('two jobs in flight at once each claim their own calls, and a bare call goes to neither', async () => {
  const { win } = await bootWithStub({
    fetchImpl: async () => { await new Promise(r => setTimeout(r, 2)); return { status: 200, headers: { get: h => (h === 'content-length' ? '100' : null) } }; },
  });
  const req = async (p) => { await null; return win.fetch('https://api.github.com/repos/o/r/' + p); };
  const crawl = async (tag) => {
    await new Promise(r => setTimeout(r, 1));
    await req(tag + '-a');
    await Promise.all([req(tag + '-b'), req(tag + '-c')]);
    return { committed: true, doc: { big: 'x'.repeat(1000) } };
  };
  const [ra] = await Promise.all([
    win.__job('Check branches', { cause: 'timer' }, () => crawl('one')),
    win.__job('Check sessions', { cause: 'arrival' }, () => crawl('two')),
    req('bare'),
  ]);
  assert.equal(ra.committed, true, 'the job hands back what its work returned');

  const byPath = Object.fromEntries(win.__traffic.map(e => [e.url.split('/').pop(), e]));
  const [one, two] = win.__jobs;
  for (const p of ['one-a', 'one-b', 'one-c']) assert.equal(byPath[p].job, one.id, p + ' belongs to the first job');
  for (const p of ['two-a', 'two-b', 'two-c']) assert.equal(byPath[p].job, two.id, p + ' belongs to the second job');
  assert.equal(byPath.bare.job, null, 'a call no job made is credited to none');
  assert.equal(byPath['one-a'].jobBy, 'stack');

  assert.equal(one.calls, 3);
  assert.equal(one.wire, 300, 'a job keeps its own byte count, apart from the capped rows');
  assert.equal(one.cause, 'timer');
  assert.equal(one.state, 'done');
  assert.deepEqual(one.result, { committed: true }, 'only the primitives stay: the document is not held');
});

test('a job that throws, or reports an error, ends failed and still rejects or resolves as it did', async () => {
  const { win } = await bootWithStub();
  await assert.rejects(() => win.__job('Refresh branches', { cause: 'tap' }, async () => { throw new Error('offline'); }), /offline/);
  const r = await win.__job('Check repo configs', { cause: 'boot' }, async () => ({ error: '409 conflict' }));
  assert.equal(r.error, '409 conflict');
  assert.equal(win.__jobs[0].state, 'failed');
  assert.equal(win.__jobs[0].error, 'offline');
  assert.equal(win.__jobs[1].state, 'failed');
  assert.equal(T.jobOutcome(win.__jobs[1]), 'failed: 409 conflict');
});

test('an armed timer is listed under its owner until it fires or is cleared', async () => {
  const { win } = await bootWithStub();
  win.__jobArm('fresh', 'Freshness check: branches', 5000);
  win.__jobArm('ping', 'Poll Gemini pings', 3000);
  assert.deepEqual(Object.keys(win.__jobArmed).sort(), ['fresh', 'ping']);
  win.__jobArm('fresh', 'Freshness check: sessions', 9000);
  assert.equal(win.__jobArmed.fresh.name, 'Freshness check: sessions', 'one row per owner: a re-arm replaces');
  win.__jobDisarm('ping');
  win.__jobDisarm('never-armed');
  assert.deepEqual(Object.keys(win.__jobArmed), ['fresh']);
});

test('jobOutcome reads the crawls\' own conventions', () => {
  assert.equal(T.jobOutcome({ state: 'running' }), 'running');
  assert.equal(T.jobOutcome({ state: 'failed', error: 'boom' }), 'failed: boom');
  assert.equal(T.jobOutcome({ state: 'done', result: { skipped: true } }), 'skipped');
  assert.equal(T.jobOutcome({ state: 'done', result: { skipped: true, reason: 'no estate members' } }), 'skipped: no estate members');
  assert.equal(T.jobOutcome({ state: 'done', result: { committed: true } }), 'committed');
  assert.equal(T.jobOutcome({ state: 'done', result: { committed: false } }), 'no change');
  assert.equal(T.jobOutcome({ state: 'done', result: null }), 'done');
});

test('jobRows lists jobs from their own counts and files the rest by view', () => {
  const jobs = [
    { id: 1, name: 'Check branches', cause: 'timer', t: 1000, end: 4000, state: 'done', result: { committed: false },
      calls: 50, wire: 9000, unknown: 0, errors: 0, writes: 0, hiddenCalls: 50 },
    { id: 2, name: 'Poll Gemini pings', cause: 'timer', t: 5000, end: 0, state: 'running', calls: 1, wire: 0, unknown: 1 },
  ];
  // Only two of job 1's fifty calls are still in the capped ledger; its row
  // must still say fifty.
  const entries = [
    { url: 'u1', t: 1100, job: 1, wire: 100, hidden: true },
    { url: 'u2', t: 1200, job: 1, wire: 100, hidden: true },
    { url: 'u3', t: 1300, job: null, where: 'sessions', wire: 10, status: 200 },
    { url: 'u4', t: 2300, job: null, where: 'sessions', wire: null, status: 404 },
    { url: 'u5', t: 900, job: null, where: '', wire: 5, method: 'PUT' },
  ];
  const { jobs: rows, free } = T.jobRows(jobs, entries, 6000);
  assert.deepEqual(rows.map(r => r.id), [2, 1], 'newest first');
  assert.equal(rows[1].calls, 50, 'a job row counts what the job counted, not what the ledger still holds');
  assert.equal(rows[1].hiddenCalls, 50);
  assert.equal(rows[1].outcome, 'no change');
  assert.equal(rows[0].running, true);
  assert.equal(rows[0].ms, 1000, 'a running job is timed to now');

  assert.deepEqual(free.map(g => g.where), ['sessions', ''], 'by view, the latest activity first');
  assert.equal(free[0].calls, 2);
  assert.equal(free[0].errors, 1);
  assert.equal(free[0].unknown, 1);
  assert.equal(free[0].t, 1300);
  assert.equal(free[0].last, 2300);
  assert.equal(free[1].writes, 1);

  assert.deepEqual(T.rowCalls(entries, rows[1]).map(e => e.url), ['u2', 'u1']);
  assert.deepEqual(T.rowCalls(entries, free[0]).map(e => e.url), ['u4', 'u3']);
  assert.deepEqual(T.rowCalls(entries, null), []);

  const tt = T.tabTotals({ calls: 120, wire: 50000, trimmed: 3 }, entries, jobs);
  assert.equal(tt.calls, 120, 'the header counts every call, not the rows held');
  assert.equal(tt.held, 5);
  assert.equal(tt.hidden, 2);
  assert.equal(tt.claimed, 2);
  assert.equal(tt.running, 1);
});

test('pageFiles weighs the page\'s own files and leaves fetched calls to the ledger', () => {
  const nav = { name: 'https://x/app/', transferSize: 2000, encodedBodySize: 1800, decodedBodySize: 9000, duration: 50, startTime: 0, initiatorType: 'navigation' };
  const entries = [
    netRow('https://cdn.jsdelivr.net/npm/x.js', 1000, 5000),
    cachedRow('https://x/dist/app.js', 6000),
    opaqueRow('https://fonts.example/font.woff2'),
    { ...netRow('https://api.github.com/repos/o/r/commits', 500, 900), initiatorType: 'fetch' },
    { ...netRow('https://api.github.com/repos/o/r/branches', 500, 900), initiatorType: 'xmlhttprequest' },
  ];
  const f = T.pageFiles(entries, nav);
  assert.equal(f.count, 4, 'the document and its three files; the two calls belong to the ledger');
  assert.equal(f.decoded, 9000 + 5000 + 6000, 'unpacked size of every file that disclosed one');
  assert.equal(f.wire, 2000 + 1000, 'a cached file cost no transfer');
  assert.equal(f.cached, 1);
  assert.equal(f.undisclosed, 1, 'a file with no disclosed size is counted apart, not as zero');
});

test('timeline slices the page\'s life and finds the stretches it spent hidden', () => {
  const entries = [
    { t: 1000, job: 1, hidden: false, wire: 10 },
    { t: 1500, job: null, hidden: false, wire: 20 },
    { t: 6500, job: 2, hidden: true, wire: 30 },
    { t: 6600, job: 2, hidden: true, wire: null },
    { t: -50, job: null },             // before the start: not drawn
  ];
  const visibility = [{ t: 0, hidden: false }, { t: 6000, hidden: true }, { t: 7000, hidden: false }, { t: 9000, hidden: true }];
  const tl = T.timeline(entries, visibility, 0, 10000, 10);
  assert.equal(tl.slices.length, 10);
  assert.equal(tl.slices[1].calls, 2, 'the two calls at 1.0s and 1.5s share the second slice');
  assert.equal(tl.slices[1].jobCalls, 1);
  assert.equal(tl.slices[6].calls, 2);
  assert.equal(tl.slices[6].hidden, 2);
  assert.equal(tl.slices[6].wire, 30, 'an undisclosed size adds nothing rather than a guess');
  assert.equal(tl.max, 2);
  assert.equal(tl.from, 1000, 'the record begins at the earliest call drawn');
  assert.deepEqual(tl.hidden.map(h => [h.t0, h.t1]), [[6000, 7000], [9000, 10000]],
    'a stretch closes when the tab returns, and one still open runs to the end');
  assert.equal(tl.hidden[0].left, 0.6);
  assert.equal(tl.hidden[0].width, 0.1);
});

test('a row counts the bytes that went out hidden, for the dark part of its bar', () => {
  const { free } = T.jobRows([], [
    { url: 'a', t: 1, job: null, where: 'sessions', wire: 100, hidden: true },
    { url: 'b', t: 2, job: null, where: 'sessions', wire: 50, hidden: false },
  ], 3);
  assert.equal(free[0].wire, 150);
  assert.equal(free[0].hiddenWire, 100);
});

test('a job counts the bytes its hidden calls brought', async () => {
  const { win } = await bootWithStub({ fetchImpl: async () => ({ status: 200, headers: { get: h => (h === 'content-length' ? '64' : null) } }) });
  await win.__job('Poll', { cause: 'timer' }, async () => { await win.fetch('https://api.github.com/x'); });
  assert.equal(win.__jobs[0].wire, 64);
  assert.equal(win.__jobs[0].hiddenWire, 0, 'the stub page has no document, so nothing went out hidden');
});

test('a 404 is counted as not found, apart from calls that failed', () => {
  const rows = [
    { t: 1, status: 404 },
    { t: 2, status: 200 },
    { t: 3, status: 500 },
    { t: 4, status: 403 },
    { t: 5, status: 0, error: 'Load failed' },
  ];
  const tt = T.tabTotals({ calls: 5, errors: 4 }, rows, []);
  assert.equal(tt.notFound, 1, 'a file the app looked for and the repo does not keep');
  assert.equal(tt.failed, 3, 'an error status other than 404, or no answer at all');
  assert.equal(tt.errors, 4, 'the running total still counts all four');
  assert.ok(T.isNotFound(rows[0]) && !T.isFailed(rows[0]));
  assert.ok(T.isFailed(rows[4]) && !T.isNotFound(rows[4]));
});
