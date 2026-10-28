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
  // One decimal from MB up, the reading this kit's own comment always named
  // (1.4 MB); it printed two until it became every view's rule on 2026-10-24.
  assert.equal(T.fmtBytes(1460047), '1.4 MB');
  assert.equal(T.fmtBytes(2 ** 31), '2.0 GB');
  // The unit follows the figure as rounded, so a count just under a boundary
  // reads as the larger unit would: not 10.0 KB, and not 1024 KB.
  assert.equal(T.fmtBytes(10235), '10 KB');
  assert.equal(T.fmtBytes(10178), '9.9 KB');
  assert.equal(T.fmtBytes(1048300), '1.0 MB');
  assert.equal(T.fmtBytesShort(1048300), '1.0 MB');
  // Unknown is never rendered as zero, at any level of the stack.
  assert.equal(T.fmtBytes(null), '?');
  assert.equal(T.fmtBytes(undefined), '?');
  assert.equal(T.fmtBytes(NaN), '?');
  // A view that would rather show nothing says so; a number is untouched by it.
  assert.equal(T.fmtBytes(null, ''), '');
  assert.equal(T.fmtBytes(900, ''), '900 B');
  assert.equal(T.fmtBytesShort(1460047), '1.4 MB');
  assert.equal(T.fmtBytesShort(9728), '10 KB');
  assert.equal(T.fmtBytesShort(null, 'not stored'), 'not stored');
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

test('the page load is one row: its files and the calls made before a view was on screen', () => {
  const files = { count: 3, cached: 1, ms: 900, rows: [
    { name: 'https://x/app/', group: 'document', start: 0, ms: 50, wire: 2000, state: 'network' },
    { name: 'https://x/dist/app.js', group: 'code', start: 100, ms: 300, wire: 0, state: 'cached' },
    { name: 'https://fonts.example/f.woff2', group: 'font', start: 200, ms: 80, wire: null, state: 'undisclosed' },
  ] };
  const entries = [
    { url: 'https://api.github.com/user', t: 1300, job: null, where: '', wire: 500, status: 200 },
    { url: 'https://api.github.com/x', t: 2000, job: null, where: 'sessions', wire: 900 },
    { url: 'https://api.github.com/y', t: 2100, job: 4, where: '', wire: 700 },
  ];
  const calls = T.fileCalls(files, 1000);
  assert.deepEqual(calls.map(c => c.t), [1000, 1100, 1200], 'a file is placed at the page start plus its own offset');
  assert.equal(calls[1].cached, true);
  assert.equal(calls[2].wire, null, 'an undisclosed size stays unknown, never zero');
  const row = T.loadRow(files, entries, 1000);
  assert.equal(row.key, 'load');
  assert.equal(row.files, 3);
  assert.equal(row.calls, 4, 'three files and the one call made before a view, not a view\'s or a job\'s');
  assert.equal(row.wire, 2500, 'a cached file transferred nothing');
  assert.equal(row.unknown, 1);
  assert.equal(row.last, 1300);
});

test('traffic findings keep only what stands out in a window', () => {
  const at = (t, url, o = {}) => ({ t, url, method: 'GET', status: 200, wire: 1000, hidden: false, job: null, where: 'estate', ...o });
  const ping = 'https://api.github.com/repos/o/r/contents/errands/requests';
  const rows = [
    ...[0, 15000, 30000, 45000, 60000].map(t => at(t, ping, { job: 7, hidden: t >= 30000 })),
    at(1000, 'https://api.github.com/repos/o/r/contents/big.json', { wire: 300 * 1024 }),
    at(2000, 'https://api.github.com/repos/o/r/boom', { status: 502, msg: 'Server Error' }),
    at(3000, 'https://api.github.com/repos/o/r/contents/missing.csv', { status: 404 }),
    at(4000, 'https://api.github.com/repos/o/r/contents/once.json'),
  ];
  const f = T.trafficFindings(rows, { owner: e => e.job === 7 ? 'Poll Gemini pings' : 'view ' + e.where, rate: { from: 4000, to: 3600 } });
  const kinds = f.map(x => x.kind).sort();
  assert.deepEqual(kinds, ['burn', 'failed', 'hidden', 'large', 'repeat']);
  const rep = f.find(x => x.kind === 'repeat');
  assert.equal(rep.calls, 5);
  assert.equal(rep.hidden, 3);
  assert.equal(rep.gapMs, 15000, 'the shortest gap between repeats is the poll interval');
  assert.deepEqual(rep.by, ['Poll Gemini pings']);
  assert.equal(f.find(x => x.kind === 'hidden').by, 'Poll Gemini pings');
  assert.equal(f.find(x => x.kind === 'failed').status, 502, 'a 404 is not a failure');
  assert.equal(f.find(x => x.kind === 'burn').spent, 400);
  assert.equal(f.find(x => x.kind === 'burn').mine, 9, 'the token is shared, so the page says how many calls were its own');
  assert.ok(!f.some(x => x.url && x.url.endsWith('once.json')), 'a single ordinary call is not a finding');
  assert.deepEqual(T.trafficFindings([at(0, ping), at(1, ping)], {}), [], 'a quiet window has nothing to say');
});

test('the traffic log files a finding once, leaves out its own writes, and needs a token', async () => {
  const src = readFileSync(path.join(repoRoot, 'lib/kits/traffic-log.js'), 'utf8');
  const store = {};
  const saves = [];
  const w = {
    Traffic: T, __traffic: [], __trafficTotals: { calls: 0 }, __jobs: [{ id: 1, name: 'Poll Gemini pings' }],
    __trafficRate: 4000, __trafficRateReset: 1,
    BrowserKind: { kind: () => 'Mac Chrome', note: () => 'Desk Chrome' },
    // gh-auth.js's reader, over the same store: it is on every page that boots.
    ghAuth: { resolve: () => store.ghToken || '' },
  };
  const env = {
    window: w,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    location: { pathname: '/app/index.html', search: '' },
    document: { hidden: false, addEventListener() {}, getElementsByTagName: () => ({ length: 3 }) },
    performance: { timeOrigin: Date.now() - 60000 },
    matchMedia: () => ({ matches: false }),
    GH: function () { this.save = async (p, doc, msg) => { saves.push({ p, doc, msg }); }; },
  };
  new Function(...Object.keys(env), src)(...Object.values(env));
  const U = w.TrafficLog;
  const ping = 'https://api.github.com/repos/o/r/contents/errands/requests';
  let n = 0;
  const call = (o = {}) => { n++; w.__trafficTotals.calls = n; w.__traffic.push({ n, t: Date.now(), url: ping, method: 'GET', status: 200, wire: 10, job: 1, ...o }); };

  for (let i = 0; i < 5; i++) call();
  assert.equal((await U.check()).why, 'no token', 'without a token nothing is written');

  store.ghToken = 'x';
  for (let i = 0; i < 5; i++) call();
  call({ url: 'https://api.github.com/repos/o/web-tools-private/contents/logs/traffic/2026-10-16/x.json', method: 'PUT' });
  const r = await U.check();
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(saves.length, 1);
  assert.match(saves[0].p, /^logs\/traffic\/\d{4}-\d\d-\d\d\/\d{6}-[a-z0-9]+\.json$/);
  assert.equal(saves[0].msg, 'Log tab traffic (logs/traffic)');
  const rep = saves[0].doc.findings.find(f => f.kind === 'repeat');
  assert.equal(rep.calls, 5, 'only the window since the last check, and not the log\'s own write');
  assert.deepEqual(rep.by, ['Poll Gemini pings']);
  assert.ok(!JSON.stringify(saves[0].doc).includes('"x"'), 'the token never reaches the file');
  assert.deepEqual([saves[0].doc.browser, saves[0].doc.browserNote], ['Mac Chrome', 'Desk Chrome'], 'the file names the browser that filed it, both ways');

  for (let i = 0; i < 5; i++) call();
  assert.equal((await U.check()).why, 'nothing new', 'the same poll inside the hour is not filed again');
  assert.equal(saves.length, 1);

  U.disable();
  assert.equal((await U.check()).why, 'not running');
});


test('the stores keep calls in bins, add every tab\'s, sum them into a range\'s bars, and keep what the ranges draw', () => {
  const MIN = 60e3, H = 60 * MIN, D = 24 * H;
  const at = (t, o = {}) => ({ t, method: 'GET', url: 'u', status: 200, wire: 100, hidden: false, job: null, where: 'estate', ...o });
  const owner = e => e.job ? 'Poll Gemini pings' : 'view ' + e.where;
  const q = {}, h = {};
  // Two tabs add their own calls to the same two stores.
  for (const rows of [[at(10 * H + MIN), at(10 * H + 2 * MIN, { hidden: true, job: 1 })],
                      [at(10 * H + 20 * MIN, { status: 502 }), at(11 * H + 6 * MIN, { wire: null })]]) {
    T.addBins(q, rows, { step: 15, owner });
    T.addBins(h, rows, { step: 60, owner });
  }
  assert.deepEqual(Object.keys(q).sort(), ['1970-01-01T10:00', '1970-01-01T10:15', '1970-01-01T11:00']);
  assert.deepEqual(Object.keys(h).sort(), ['1970-01-01T10', '1970-01-01T11']);
  assert.equal(T.recordStart(h), 10 * H, 'the record begins at its oldest bin');

  const [day, week, month] = ['day', 'week', 'month'].map(k => T.RANGES.find(r => r.key === k));
  const bars = T.lastBins(q, 11 * H + 10 * MIN, day);
  assert.equal(bars.length, 96);
  assert.deepEqual([bars[95].t0, bars[95].t1], [11 * H, 11 * H + 15 * MIN], 'the current quarter closes the day');
  assert.deepEqual([bars[91].calls, bars[91].hidden, bars[91].wire], [2, 1, 200]);
  assert.deepEqual(bars[91].by, { 'view estate': 1, 'Poll Gemini pings': 1 });
  assert.deepEqual([bars[92].calls, bars[92].errors], [1, 1], 'a failure counted');
  assert.deepEqual([bars[95].calls, bars[95].wire], [1, 0], 'an unsized call adds no bytes');
  assert.equal(bars[0].calls, 0, 'a bar with nothing is there, empty');
  // A week's bar is two hours, on the even hour, and sums the hours inside it.
  const wk = T.lastBins(h, 11 * H + 10 * MIN, week);
  assert.equal(wk.length, 84);
  assert.equal(wk[83].t0, 10 * H);
  assert.deepEqual([wk[83].calls, wk[83].errors, wk[83].wire], [4, 1, 300]);
  assert.deepEqual(wk[83].by, { 'view estate': 3, 'Poll Gemini pings': 1 });
  assert.equal(T.lastBins(h, 11 * H, month)[119].t0, 6 * H, 'a month\'s bar is six hours');

  // A reader eight hours behind UTC files a call under their own hour, and one
  // five and a half ahead under their own quarter, which reads back to the call.
  assert.deepEqual(Object.keys(T.addBins({}, [at(10 * H)], { offset: 480 })), ['1970-01-01T02']);
  const east = Object.keys(T.addBins({}, [at(10 * H)], { step: 15, offset: -330 }));
  assert.deepEqual(east, ['1970-01-01T15:30']);
  assert.equal(T.binStart(east[0], -330), 10 * H);

  // Each store keeps the longest range it serves, and a bar.
  assert.equal(T.keepFor('quarters'), 97 * 15 * MIN);
  assert.equal(T.keepFor('hours'), 121 * 6 * H);
  T.pruneBins(q, 10 * H + 2 * D, { step: 15, keep: T.keepFor('quarters') });
  assert.deepEqual(Object.keys(q), [], 'two days on, the quarters are gone');
  T.pruneBins(h, 10 * H + 2 * D, { step: 60, keep: T.keepFor('hours') });
  assert.equal(Object.keys(h).length, 2, 'and the hours stay for the month');
  T.pruneBins(h, 10 * H + 32 * D, { step: 60, keep: T.keepFor('hours') });
  assert.deepEqual(Object.keys(h), []);
});

test('a lane\'s scale is a round number, and its axis is marked where the reader keeps time', () => {
  assert.deepEqual([0, 7, 12, 40, 100, 101].map(T.niceMax), [0, 10, 20, 50, 100, 200]);
  const [day, week, month] = ['day', 'week', 'month'].map(k => T.RANGES.find(r => r.key === k));
  const now = Date.UTC(2026, 9, 17, 11, 10), off = new Date(now).getTimezoneOffset();
  const local = m => new Date(m.t);
  const d = T.axisMarks(T.lastBins({}, now, day, off), day, 3);
  assert.equal(d.length, 8, 'a day named every three hours');
  assert.ok(d.every(m => local(m).getHours() % 3 === 0 && local(m).getMinutes() === 0));
  const w = T.axisMarks(T.lastBins({}, now, week, off), week);
  assert.equal(w.length, 7, 'a week named at each midnight');
  assert.ok(w.every(m => m.line && local(m).getHours() === 0));
  const mo = T.axisMarks(T.lastBins({}, now, month, off), month);
  assert.ok(mo.length >= 4 && mo.length <= 5 && mo.every(m => local(m).getDay() === 1 && local(m).getHours() === 0),
    'a month named on its Mondays');
});
