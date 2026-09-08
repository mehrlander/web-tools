// The app-route join, across the three places it now lives.
//
//   lib/kits/route-join.js          fetches the manifest, the open pull
//                                   requests' file lists, and one last-commit
//                                   date per declared carrier
//   lib/alpineComponents/map.js     the Map view's Views tab, which ranks the
//                                   app's destinations off all three
//   lib/alpineComponents/estate.js  the reciprocal, a chip on a branch row
//                                   saying which destination it is working on
//
// It was all one component until 2026-09-08 (the Views pane was Activity's
// fifth pill), which is why this file was called estate-routes. The pane moved
// to the Map view and the fetching moved to a kit, so the file follows the
// subject rather than the component.
//
// The FOLD itself (ranking, the wide-file rule, the shell exclusion) is covered
// in app-routes.test.mjs against lib/kits/route-activity.js. What is tested
// here is the wiring that fold cannot see: that the loader asks for the paths
// the manifest declares and nothing else, that it survives a carrier with no
// commits, that the attempt-once guard holds after a failure, and that the
// pane's aggregates read off the rows rather than off the manifest.
//
// The shell's own half is a memo (which ref the join was read at, and whether
// it has been tried), so the stub below implements it the way app/index.html
// does. That page is not loadable here, which is the reason the fetching is in
// a kit at all rather than beside the state.
//
// No network, no pixels: GH is stubbed and answers from a fixture.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine } from './bootstrap.mjs';

const MANIFEST = {
  shell: 'app/index.html',
  shellNote: 'every route’s file, so no route’s signal',
  groups: [{ key: 'estate', label: 'Estate', gloss: 'above any repo' }],
  routes: [
    { key: 'map', address: '?view=map', label: 'Map', group: 'estate', what: 'the coordination layer',
      files: ['lib/alpineComponents/map.js'] },
    { key: 'sessions', address: '?view=sessions', label: 'Sessions', group: 'estate',
      what: 'the work that made the branches',
      files: ['lib/alpineComponents/estate.js', 'lib/kits/repo-sessions-cache.js'] },
    { key: 'landing', address: '?repo=owner/name', label: 'Landing', group: 'estate',
      what: 'a repo front door', files: [], note: 'inline in the shell' },
  ],
};

// The manifest is two CSVs on disk since 2026-08-16: the shell is a row keyed
// `shell` rather than a sibling key, and the group glosses live in the shared
// value-gloss table. The fixture emits both, so the loader is exercised through
// the same assembly the app does.
const csv = (cols, rows) => [cols.join(','),
  ...rows.map(r => cols.map(c => {
    const v = Array.isArray(r[c]) ? r[c].join(';') : (r[c] ?? '');
    return /[",]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
  }).join(','))].join('\n') + '\n';

const ROUTES_CSV = csv(['key', 'address', 'label', 'group', 'what', 'files', 'note'], [
  { key: 'shell', what: MANIFEST.shellNote, group: 'shell', files: [MANIFEST.shell] },
  ...MANIFEST.routes,
]);
const VOCAB_CSV = csv(['registry', 'property', 'value', 'label', 'gloss'],
  MANIFEST.groups.map(g => ({ registry: 'app-routes', property: 'group',
                              value: g.key, label: g.label, gloss: g.gloss })));

// Newest first per path, so the ranking has something to order by.
const COMMITS = {
  'lib/alpineComponents/map.js': { sha: 'aaaaaaa1', date: '2026-08-14T10:00:00Z', msg: 'map: registries tab' },
  'lib/kits/repo-sessions-cache.js': { sha: 'bbbbbbb2', date: '2026-08-02T10:00:00Z', msg: 'sessions: derive the branch' },
  // estate.js and the shell deliberately have no entry: one exercises the
  // no-commits path, the other must not date anything even when it does.
  'app/index.html': { sha: 'ccccccc3', date: '2026-08-14T23:00:00Z', msg: 'shell: route table' },
};

let asked = [];
let failNext = false;
let gotRef = null;      // the ref the pane built its client at
let manifestRef = null; // the ref it read the manifest at

class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || ''; gotRef = this.ref; }
  ago(iso) {
    const d = Math.round((Date.parse('2026-08-15T00:00:00Z') - Date.parse(iso)) / 86400000);
    return d < 1 ? 'just now' : d + ' days ago';
  }
  async get(path) {
    if (failNext) throw new Error('GitHub Error 404: Not Found');
    // The manifest exists only at the ref the code came from, which is the
    // whole point: reading it at main while running branch code is the bug
    // this fixture reproduces.
    if (path === 'docs/app-routes.csv') {
      manifestRef = this.ref;
      if (this.ref !== 'main' && this.ref !== 'claude/branch') throw new Error('GitHub Error 404: Not Found');
      return { text: ROUTES_CSV };
    }
    if (path === 'docs/vocabularies.csv') return { text: VOCAB_CSV };
    throw new Error('404');
  }
  async req(path) {
    if (path.startsWith('commits?path=')) {
      const p = decodeURIComponent(path.slice('commits?path='.length).split('&')[0]);
      asked.push(p);
      // The dates ride the same ref as the manifest, so the pane speaks about
      // one tree rather than mixing a branch's code with main's history.
      assert.match(path, new RegExp('&sha=' + encodeURIComponent(this.ref).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '&'));
      const c = COMMITS[p];
      if (!c) return [];
      return [{ sha: c.sha, html_url: 'https://github.com/x/y/commit/' + c.sha,
                commit: { message: c.msg, committer: { date: c.date } },
                author: { login: 'mehrlander' } }];
    }
    if (/^pulls\/\d+\/files/.test(path)) {
      const n = +path.match(/^pulls\/(\d+)/)[1];
      return n === 7
        ? [{ filename: 'lib/alpineComponents/map.js' }, { filename: 'README.md' }]
        : [{ filename: 'docs/SNAGS.md' }];
    }
    throw new Error('404 ' + path);
  }
  async pulls() {
    return [
      { number: 7, title: 'map: a registries tab', head: 'claude/registries', draft: true, session: 's7' },
      { number: 8, title: 'a snag', head: 'claude/snag', draft: false, session: '' },
    ];
  }
  async ls() { throw new Error('404'); }
}

const { window } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="es" x-data="estate()"></div>
    <div id="mp" x-data="map()"></div>
  </body></html>`,
});
window.TOKEN = 'tkn';
window.GH = FakeGH;
window.gh = { load: async () => {} };

// The shell's half, implemented here the way app/index.html implements it: the
// memo and the guard, with the fetching delegated to the kit. A page is not
// loadable in this harness, which is why the fetching is in the kit and only
// these dozen lines are restated.
window.__shell = {
  REGISTRY_REPO: 'me/registry', DEFAULT_REPO: 'me/tools', quickLinks: [],
  hasToken: () => true, _authState: 'auth',
  routed: [],
  routeFromUrl(u){ this.routed.push(u); },
  ROUTES_REPO: 'mehrlander/web-tools',
  routeManifest: null,
  routeJoinRef: '',
  routeBranchFiles: [],
  routeJoinTried: false,
  get routesRef(){
    try { return new URLSearchParams(window.location.search).get('use') || 'main'; }
    catch { return 'main'; }
  },
  async loadRouteJoin(force){
    if (!this.hasToken()) return null;
    const ref = this.routesRef;
    if (this.routeJoinTried && !force && this.routeJoinRef === ref) return null;
    this.routeJoinTried = true;
    this.routeJoinRef = ref;
    const gh = new window.GH({ token: window.TOKEN, repo: this.ROUTES_REPO, ref });
    this.routeManifest = await window.RouteJoin.manifest(gh);
    this.routeBranchFiles = await window.RouteJoin.branchFiles(gh, this.ROUTES_REPO);
    return gh;
  },
};

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/csv.js',
  'lib/kits/surface.js',
  'lib/kits/route-activity.js',
  'lib/kits/route-join.js',
  'lib/alpineComponents/estate.js',
  'lib/alpineComponents/map.js',
]);
const data = Alpine.$data(window.document.getElementById('es'));
const view = Alpine.$data(window.document.getElementById('mp'));

// Values cross the jsdom realm boundary, so deepEqual would fail on prototype
// identity alone (every other estate suite does the same).
const plain_ = (v) => JSON.parse(JSON.stringify(v));

test('the loader asks for exactly the declared carriers plus the shell', async () => {
  asked = [];
  await view.loadAppViews(true);
  // Sorted, so the shell leads: it moved from pages/show-repo/show-repo.html
  // to app/index.html on 2026-08-16 and now sorts ahead of every lib/ carrier.
  assert.deepEqual(plain_(asked).sort(), [
    'app/index.html',
    'lib/alpineComponents/estate.js',
    'lib/alpineComponents/map.js',
    'lib/kits/repo-sessions-cache.js',
  ]);
});

test('a carrier with no commits leaves its route undated rather than throwing', () => {
  const sessions = view.viewRows.find(r => r.key === 'sessions');
  // estate.js answered empty; repo-sessions-cache.js dated the row.
  assert.equal(sessions.lastTouch.sha, 'bbbbbbb2');
  assert.equal(sessions.files.find(f => f.path === 'lib/alpineComponents/estate.js').touch, null);
});

test('the shell dates its own row and no route', () => {
  assert.ok(view.viewRows.every(r => r.lastTouch?.sha !== 'ccccccc3'));
  assert.equal(view.viewShellRow.touch.sha, 'ccccccc3');
  assert.equal(view.viewShellRow.routes, 3);
});

test('rows rank freshest first, undated last', () => {
  assert.deepEqual(plain_(view.viewRows.map(r => r.key)), ['map', 'sessions', 'landing']);
});

test('open PRs join on the files they touch, and only those', () => {
  const map = view.viewRows.find(r => r.key === 'map');
  assert.equal(map.branches.length, 1);
  assert.equal(map.branches[0].pr, 7);
  assert.deepEqual(plain_(map.branches[0].hits), ['lib/alpineComponents/map.js']);
  assert.match(map.branches[0].url, /\/pull\/7$/);
  // PR 8 touches nothing any route declares, so it appears on no row.
  assert.ok(view.viewRows.every(r => r.branches.every(b => b.pr !== 8)));
});

test('the registry counts the routes with no code of their own', () => {
  assert.equal(view.viewRows.length, 3);
  assert.equal(view.viewsWithoutCode, 1);
  assert.equal(view.viewsInFlight, 1);
});

test('only a bare ?view= address is offered as a tap', () => {
  const rows = view.viewRows;
  assert.equal(view.viewIsOpenable(rows.find(r => r.key === 'map')), true);
  assert.equal(view.viewIsOpenable(rows.find(r => r.key === 'landing')), false);
  view.openAppView(rows.find(r => r.key === 'map'));
  assert.deepEqual(plain_(window.__shell.routed), [{ view: 'map' }]);
  // A row that cannot be honoured does not navigate at all.
  view.openAppView(rows.find(r => r.key === 'landing'));
  assert.equal(window.__shell.routed.length, 1);
});

// The pane reads its manifest and its dates at the ref the CODE came from, not
// at main. Pinning to main 404ed on the very first preview of the branch that
// added the manifest, and the failure impersonated an auth problem (the fix is
// what the error message now names). `?use=` is the app's standing answer to
// "which ref am I running"; a #gh= toss injects the addressed ref under that
// same key through toss-render's params shim, so one read covers both.
test('the pane reads at the running ref, so a preview is not pinned to main', async () => {
  assert.equal(view.viewsRef, 'main');           // the deployed default
  window.history.replaceState(null, '', '?use=claude/branch');
  assert.equal(view.viewsRef, 'claude/branch');
  await view.loadAppViews(true);
  assert.equal(manifestRef, 'claude/branch');
  assert.equal(gotRef, 'claude/branch');
  assert.equal(view.viewsError, '');
  window.history.replaceState(null, '', '?');
  assert.equal(view.viewsRef, 'main');
});

test('a failed load names the address it could not read', async () => {
  failNext = true;
  await view.loadAppViews(true);
  assert.match(view.viewsError, /mehrlander\/web-tools@main:docs\/app-routes\.csv/);
  assert.match(view.viewsError, /404/);
  assert.equal(view.viewsBusy, false);
  // The x-effect fires again on the next render; the attempt-once guard is
  // what stops it pegging the main thread, so an unforced call is a no-op.
  asked = [];
  await view.loadAppViews();
  assert.deepEqual(plain_(asked), []);
  failNext = false;
});

// The Branches pane's side of the join. It reads the SAME state the Routes
// pane loads, so visiting either warms the other; what it must not do is answer
// for a repo whose routes nobody declared.
test('a branch row reports the routes it touches, and only for the hub', async () => {
  await view.loadAppViews(true);
  const row = { repo: 'mehrlander/web-tools', name: 'claude/registries' };  // PR 7: map.js
  const r = data.branchRoutes(row);
  assert.deepEqual(plain_(r.on.map(x => x.key)), ['map']);
  // A row from any other repo has no answer here rather than an empty one.
  assert.equal(data.branchRoutes({ repo: 'mehrlander/home', name: 'claude/registries' }), null);
  // A hub branch nobody has file lists for is also absent, not empty.
  assert.equal(data.branchRoutes({ repo: 'mehrlander/web-tools', name: 'claude/unknown' }), null);
  // PR 8 touches docs/SNAGS.md, which no route declares.
  assert.equal(data.branchRoutes({ repo: 'mehrlander/web-tools', name: 'claude/snag' }), null);
});

test('the shared half loads without the dating, and only once', async () => {
  const sh = window.__shell;
  sh.routeJoinTried = false;
  sh.routeManifest = null;
  asked = [];
  await sh.loadRouteJoin();
  assert.ok(sh.routeManifest, 'manifest loaded');
  assert.deepEqual(plain_(asked), [], 'no per-carrier commit reads for the join alone');
  assert.equal(sh.routeBranchFiles.length, 2);
  // Guarded: the x-effect on the Branches pane fires on every render.
  sh.routeBranchFiles = [];
  await sh.loadRouteJoin();
  assert.equal(sh.routeBranchFiles.length, 0, 'an unforced second call is a no-op');
  await sh.loadRouteJoin(true);
  assert.equal(sh.routeBranchFiles.length, 2, 'forcing re-reads it');
});

// The kit's own pieces, called directly: the pane and the chip both read what
// these return, so a shape change here is a change to both at once.
test('the kit pools its reads and drops a dead one without failing the batch', async () => {
  const seen = [];
  const out = await window.RouteJoin.pool([1, 2, 3, 4], async (n) => {
    seen.push(n);
    if (n === 3) throw new Error('nope');
    return n * 2;
  }, 2);
  assert.deepEqual(plain_(out), [2, 4, null, 8]);
  assert.equal(seen.length, 4);
});

test('the kit dates only the paths it is given, at the ref it is given', async () => {
  const gh = new FakeGH({ repo: 'mehrlander/web-tools', ref: 'main' });
  asked = [];
  const touches = await window.RouteJoin.dates(gh, ['lib/alpineComponents/map.js',
                                                    'lib/alpineComponents/estate.js'], 'main');
  assert.deepEqual(plain_(asked).sort(),
                   ['lib/alpineComponents/estate.js', 'lib/alpineComponents/map.js']);
  assert.equal(touches['lib/alpineComponents/map.js'].sha, 'aaaaaaa1');
  // A path with no commits is absent rather than present and empty, which is
  // what leaves its route undated instead of dated wrong.
  assert.ok(!('lib/alpineComponents/estate.js' in touches));
});

test('the group is a row label read off the manifest, not a section', async () => {
  await view.loadAppViews(true);
  assert.equal(view.viewGroupLabel('estate'), 'Estate');
  // An unknown key labels itself rather than rendering blank.
  assert.equal(view.viewGroupLabel('nope'), 'nope');
});

// The ref on the chip, which is the whole reason the reverse join is drawn on a
// branch row at all. Before this the chip called the shell's own dispatcher,
// which walks the page you are already on to that view: main, at the one moment
// the branch was the point.
test('a branch row chip opens the view running THAT branch', async () => {
  await view.loadAppViews(true);
  const sha = 'a'.repeat(40);
  const r = data.branchRoutes({ repo: 'mehrlander/web-tools', name: 'claude/registries', sha });
  assert.equal(r.on[0].key, 'map');
  assert.equal(r.on[0].url,
    'https://mehrlander.github.io/web-tools/app/?use=' + sha + '&view=map');
});

// A SHA and never the branch name: ?use= is interpolated straight into a
// raw.githubusercontent path and every branch here has a slash in its name, so
// a row the crawl has no tip for keeps the in-shell hop rather than minting an
// address that may not resolve. The chip's title is what tells the reader.
test('a row with no crawled tip keeps the old behavior instead of guessing', async () => {
  await view.loadAppViews(true);
  const r = data.branchRoutes({ repo: 'mehrlander/web-tools', name: 'claude/registries' });
  assert.equal(r.on[0].url, '', 'no tip, no address');
  assert.equal(r.on[0].key, 'map', 'the chip is still there');
});
