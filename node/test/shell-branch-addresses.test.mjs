// How the app is pointed at a branch: by address, and only by address.
//
// Two addresses do it, and each reads the branch where the reader asked for
// it. `?app=owner/repo@branch:path` opens one page at the branch, and the
// sidebar lists it even when no manifest on main declares it.
// `?repo=owner/repo&ref=branch` browses a repo at the branch, and the repo's
// own manifest (landing, pins, projects) is read there too. A sidebar row
// names no branch, so tapping one never moves the reader onto a branch or off
// the one already being browsed.
//
// The estate-level lists (the Repos rows, the app views a manifest promotes,
// another repo's project rows) come from the config cache, which the crawl
// builds from main. The last test holds the crawl to main whatever the reader
// is browsing, so a branch session cannot commit a branch manifest into the
// shared cache.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { makeShell } from './shell.mjs';

const REGISTRY = 'mehrlander/web-tools-private';
const BRANCH = 'claude/some-branch';

const withRepoAddress = (win = {}) => {
  new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/repo-address.js'), 'utf8'))(win);
  return win;
};

test('?app=owner/repo@branch:path opens the page at the branch and lists it beside the declared one', async () => {
  const { shell } = makeShell({
    search: '?app=' + encodeURIComponent('me/home@' + BRANCH + ':pages/news.html'),
    browserStore: { repo: '' }, win: withRepoAddress(),
  });
  // main's manifest promotes the same page; the address names another ref.
  const declared = { repo: 'me/home', ref: '', path: 'pages/news.html', label: 'News',
                     icon: 'ph-newspaper', key: 'me/home:pages/news.html', query: '' };
  shell.appViews = [declared];

  const v = await shell.appViewFromUrl(shell.parseUrl());
  assert.equal(v.ref, BRANCH, 'the address keeps its ref');
  assert.equal(v.key, 'me/home@' + BRANCH + ':pages/news.html');
  shell.goAppView(v);

  assert.deepEqual(shell.sidebarAppViews.map(x => x.key),
    ['me/home@' + BRANCH + ':pages/news.html', 'me/home:pages/news.html'],
    'the opened page joins the list without a declaration, and main\'s entry stays');
  assert.match(shell.appViewUrl, new RegExp('#gh=me/home@' + BRANCH + ':pages/news\\.html$'),
    'the page renders at the branch');
  assert.match(shell.appViewTitle(v), new RegExp('rendered at ' + BRANCH + '$'),
    'an entry naming a ref says which');
  assert.doesNotMatch(shell.appViewTitle(declared), /rendered at/,
    'an entry naming no ref says nothing about one');
});

test('the sidebar entry shows the ref an app view names', () => {
  const page = readFileSync(path.join(repoRoot, 'app/index.html'), 'utf8');
  const at = page.indexOf('x-for="v in sidebarAppViews"');
  assert.ok(at > 0, 'the sidebar app-view list was not found');
  const entry = page.slice(at, page.indexOf('</template>', at));
  assert.match(entry, /:title="appViewTitle\(v\)"/);
  assert.match(entry, /x-show="v\.ref"[^>]*x-text="'@' \+ v\.ref"/);
});

// A stand-in for the headless repo component (lib/alpineComponents/repo.js),
// recording what the shell asks of it. Its pick() points the shared client at
// the chosen ref; this does the same so loadConfig reads where repo.js would.
function repoElement(store, calls) {
  return {
    __repo: {
      async pickByName(repo, opts = {}) {
        calls.push([repo, opts.ref]);
        store.repo = repo;
        store.ref = opts.ref || 'main';
        store.gh.ref = store.ref;
      },
    },
  };
}

test('?repo=&ref= browses the branch, and the repo\'s own manifest is read there', async () => {
  const reads = [];
  const gh = {
    ref: 'main',
    async get(p) {
      reads.push([p, this.ref]);
      if (p === '.web-tools.json' && this.ref === BRANCH)
        return { text: JSON.stringify({ projects: ['projects/on-branch'] }) };
      const e = new Error('GitHub Error 404'); e.status = 404; throw e;
    },
  };
  const store = { repo: '', ref: '', defaultRef: 'main', gh };
  const calls = [];
  const { shell, doc } = makeShell({
    search: '?repo=me/home&ref=' + encodeURIComponent(BRANCH), browserStore: store,
  });
  doc.getElementById = (id) => (id === 'repo' ? repoElement(store, calls) : null);
  shell._setup = true;
  shell.runChecks = () => {};
  // The cache says what main declares, which is what the estate rows read.
  shell.estateConfigs = { 'me/home': { projects: ['projects/on-main'] } };

  const url = shell.parseUrl();
  await shell.ensureBrowser(url.repo, url.ref);
  assert.deepEqual(calls, [['me/home', BRANCH]], 'the address\'s ref reaches the repo component');

  await shell.loadConfig();
  assert.deepEqual(reads, [['.web-tools.json', BRANCH]], 'the manifest is read at the browsed ref');
  assert.deepEqual(shell.repoProjects('me/home').map(p => p.path), ['projects/on-branch'],
    'the open repo\'s project rows follow its live manifest, not the cache');
});

test('a repo row names no branch: it keeps the browsed ref, and opens any other repo at its default', async () => {
  const store = { repo: 'me/home', ref: BRANCH, defaultRef: 'main', gh: { ref: BRANCH } };
  const calls = [];
  const { shell, doc } = makeShell({ browserStore: store });
  doc.getElementById = (id) => (id === 'repo' ? repoElement(store, calls) : null);
  shell._setup = true;
  shell.goLanding = () => {};

  await shell.openPinned('me/home');
  assert.deepEqual(calls, [], 'tapping the open repo leaves it where it is');
  assert.equal(store.ref, BRANCH);

  await shell.openPinned('me/ledger');
  assert.deepEqual(calls, [['me/ledger', undefined]], 'another repo opens with no ref named');
});

// A GH stub for the crawl: the registry's config cache, per-repo manifests at
// a ref, the account enumeration, and the registry save. Every construction
// and every save is recorded.
function fakeGH({ cache, manifests = {}, account = [] }, log) {
  return class FakeGH {
    constructor(opts) { this.opts = opts; log.push(opts); }
    async save(p) { log.push({ save: p, repo: this.opts.repo }); }
    async get(p) {
      if (this.opts.repo === REGISTRY && p === 'state/configs.json')
        return { text: JSON.stringify(cache) };
      if (p === '.web-tools.json') {
        const m = manifests[this.opts.repo + '@' + this.opts.ref];
        if (m) return { text: JSON.stringify(m) };
      }
      const e = new Error('GitHub Error 404'); e.status = 404; throw e;
    }
    async repos() { return account.map(n => ({ full_name: n, private: true })); }
  };
}

test('the config crawl reads every repo at main while the reader browses a branch, and commits', async () => {
  const log = [];
  const { shell, win } = makeShell({
    browserStore: { repo: 'me/home', ref: BRANCH, defaultRef: 'main' },
  });
  win.TOKEN = 'tok';
  win.GH = fakeGH({
    cache: { repos: {} },
    account: ['me/home', 'me/ledger'],
    manifests: {
      'me/home@main': { estate: true },
      'me/ledger@main': { estate: true },
      ['me/home@' + BRANCH]: { estate: true, projects: ['projects/x'] },
    },
  }, log);
  const built = [];
  win.RepoConfigCache = {
    CACHE_PATH: 'state/configs.json',
    buildCache: (prev, fetched, now) => { built.push(fetched); return { generatedAt: now, repos: fetched }; },
    // The crawl commits on the changed LIST rather than the boolean, so the run
    // record and the gate that decides to write it share one derivation.
    changedRepos: () => ['me/home'],
  };
  await shell.refreshConfigCache(true);
  assert.equal(built.length, 1, 'the crawl ran');
  const perRepoReads = log.filter(o => o.repo && o.repo !== REGISTRY && o.ref !== undefined);
  assert.ok(perRepoReads.length >= 2, 'the crawl read the account repos');
  for (const o of perRepoReads)
    assert.equal(o.ref, 'main', 'crawl inputs never read the browsed branch');
  assert.ok(log.some(o => o.save === 'state/configs.json' && o.repo === REGISTRY),
    'the rebuilt cache commits to the registry');
});
