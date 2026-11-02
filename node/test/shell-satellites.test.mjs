// SATELLITES in the shell: repos off the estate that belong to a member or to
// one of its projects, such as a store of fetched files the member's scripts
// read by path. The name says whose a satellite is (a member's name, or a
// member project's folder name, then "-"), and a member's `satellites` field
// lists the ones whose names cannot. This holds the rule (satelliteClaims:
// listing before name, longest prefix, repo before project, owners match,
// members never), the shell's own map with the open repo's live manifest, the
// member in view, the switcher rows that indent its satellites under it, and
// the markup that renders them in both switchers, the masthead and the sidebar.
//
// Driven over the shared shell.mjs harness: the inline app() with stubbed
// globals, no network, no pixels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { page, makeShell } from './shell.mjs';

const WA = 'me/budget-wa', HOME = 'me/home';
const CONFIGS = {
  [WA]: { estate: true, satellites: ['me/page-store'] },
  [HOME]: { estate: true, projects: ['news', { path: 'projects/ledger/', label: 'Ledger' }] },
};
// Every repo the config cache names, member or not.
const NAMES = [WA, HOME, 'me/budget-wa-notices', 'me/budget-wa-tables', 'me/ledger-reports',
               'me/page-store', 'me/scratch', 'me/home-tools-old', 'other/budget-wa-x'];
const MEMBERS = [
  { repo: HOME, short: 'home', icon: 'ph-house' },
  { repo: WA, short: 'budget-wa', icon: 'ph-bank' },
];
const shellAt = (repo) => {
  const made = makeShell({ browserStore: { repo } });
  made.shell.estateConfigs = CONFIGS;
  made.shell.accountRepoNames = NAMES;
  made.shell.estateRepos = MEMBERS;
  return made;
};
const plain = (v) => JSON.parse(JSON.stringify(v));

test('satelliteClaims: by name for a member and for a project folder, by listing for the rest', () => {
  const { shell } = shellAt('');
  assert.deepEqual(plain(shell.satelliteClaims(CONFIGS, NAMES)), {
    'me/page-store':        { host: WA,   project: '', projectLabel: '', by: 'listed' },
    'me/budget-wa-notices': { host: WA,   project: '', projectLabel: '', by: 'name' },
    'me/budget-wa-tables':  { host: WA,   project: '', projectLabel: '', by: 'name' },
    'me/ledger-reports':    { host: HOME, project: 'projects/ledger', projectLabel: 'Ledger', by: 'name' },
    'me/home-tools-old':    { host: HOME, project: '', projectLabel: '', by: 'name' },
  }, 'scratch matches nothing, and another owner\'s budget-wa-x is not ours');
});

test('satelliteClaims: members are never satellites, and a bare prefix is not a name', () => {
  const { shell } = shellAt('');
  const confs = { [WA]: { estate: true }, 'me/budget-wa-private': { estate: true },
                  'me/budget-wa': { estate: true, satellites: ['me/budget-wa-private', WA, 'junk', 7] } };
  assert.deepEqual(plain(shell.satelliteClaims(confs, ['me/budget-wa-', 'me/budget-wa-private'])), {},
    'a member stays a member, "budget-wa-" alone has no suffix, and junk listings drop');
});

test('satelliteClaims: the longest prefix wins, and a repo before a project on a tie', () => {
  const { shell } = shellAt('');
  const confs = {
    'me/data':      { estate: true },
    'me/data-wa':   { estate: true },
    'me/home':      { estate: true, projects: [{ path: 'projects/data-wa' }, { path: 'projects/data-wa-drs' }] },
  };
  const c = plain(shell.satelliteClaims(confs, ['me/data-wa-scans', 'me/data-wa-drs-pdfs', 'me/data-old']));
  assert.equal(c['me/data-wa-scans'].host, 'me/data-wa', 'data-wa- beats data-, and the repo beats the project data-wa');
  assert.equal(c['me/data-wa-scans'].project, '');
  assert.equal(c['me/data-wa-drs-pdfs'].project, 'projects/data-wa-drs', 'the longer project folder wins');
  assert.equal(c['me/data-old'].host, 'me/data');
});

test('satelliteClaims: a listing outranks a name, and a member\'s listing outranks a non-member\'s', () => {
  const { shell } = shellAt('');
  const confs = {
    [WA]: { estate: true },
    'me/aaa': { satellites: ['me/budget-wa-shared'] },
    'me/zzz': { estate: true, satellites: ['me/budget-wa-shared'] },
  };
  assert.equal(shell.satelliteClaims(confs, ['me/budget-wa-shared'])['me/budget-wa-shared'].host, 'me/zzz');
});

test('satelliteMap reads the open repo\'s live manifest in place of its cached one', () => {
  const { shell, browserStore } = shellAt(WA);
  browserStore.config = { estate: true, satellites: ['me/live-only'] };
  assert.equal(shell.satelliteParent('me/live-only')?.host, WA);
  assert.equal(shell.satelliteParent('me/page-store'), null, 'the cached listing is replaced, not merged');
});

test('repoSatellites: the repo\'s own first, then each project\'s, each run by name', () => {
  const { shell } = shellAt('');
  assert.deepEqual(shell.repoSatellites(WA).map(o => o.repo), ['me/budget-wa-notices', 'me/budget-wa-tables', 'me/page-store']);
  assert.deepEqual(shell.repoSatellites(HOME).map(o => [o.repo, o.projectLabel]),
    [['me/home-tools-old', ''], ['me/ledger-reports', 'Ledger']]);
});

test('satelliteHost: a member with satellites is itself, a satellite resolves to its parent', () => {
  assert.equal(shellAt(WA).shell.satelliteHost, WA);
  assert.equal(shellAt('me/budget-wa-tables').shell.satelliteHost, WA);
  assert.equal(shellAt('me/ledger-reports').shell.satelliteHost, HOME);
  assert.equal(shellAt('me/scratch').shell.satelliteHost, '');
  assert.equal(shellAt('').shell.satelliteHost, '');
});

test('the masthead link opens the project when the parent is one, else the member', () => {
  const calls = [];
  const atLedger = shellAt('me/ledger-reports').shell;
  atLedger.openProject = (repo, p) => calls.push(['project', repo, p.path]);
  atLedger.openPinned = (repo) => calls.push(['repo', repo]);
  atLedger.openSatelliteParent();
  const atTables = shellAt('me/budget-wa-tables').shell;
  atTables.openProject = atLedger.openProject; atTables.openPinned = atLedger.openPinned;
  atTables.openSatelliteParent();
  assert.deepEqual(calls, [['project', HOME, 'projects/ledger'], ['repo', WA]]);
  assert.equal(atLedger.satelliteParentLabel('me/ledger-reports'), 'home › Ledger');
  assert.equal(atTables.satelliteParentLabel('me/budget-wa-tables'), 'budget-wa');
  assert.equal(atTables.repoGlyph('me/budget-wa-tables'), 'ph-planet', 'a satellite with no config wears the planet');
});

test('switcher rows: only the satellites of the member in view, indented under it', () => {
  const rowsAt = (repo) => shellAt(repo).shell.estateSwitcherRows.map(r => (r.child ? '  ' : '') + r.repo);
  assert.deepEqual(rowsAt('me/scratch'), [HOME, WA], 'no member in view: the members alone');
  assert.deepEqual(rowsAt(WA), [HOME, WA, '  me/budget-wa-notices', '  me/budget-wa-tables', '  me/page-store']);
  assert.deepEqual(rowsAt('me/ledger-reports'), [HOME, '  me/home-tools-old', '  me/ledger-reports', WA]);
});

test('masthead menu items: a satellite row is a marked, hinted child that opens the repo', () => {
  const { shell } = shellAt('me/ledger-reports');
  let pinned = '';
  shell.openPinned = (r) => { pinned = r; };
  shell.closeRepoMenu = () => {};
  const items = shell.estateRepoMenuItems;
  const row = items.find(i => i.key === 'repo:me/ledger-reports');
  assert.equal(row.child, true);
  assert.equal(row.head, true, 'a repo name, so mono and no rule above it');
  assert.equal(row.current, true);
  assert.equal(row.hint, 'Ledger');
  assert.equal(row.icon, 'ph-planet');
  assert.match(row.title, /satellite of home › Ledger/);
  items.find(i => i.key === 'repo:' + WA).run();
  assert.equal(pinned, WA);
});

test('the cache\'s repo names reach the shell with its configs', async () => {
  const made = makeShell({ browserStore: { repo: '' } });
  made.win.TOKEN = 't';
  const cache = { repos: { [WA]: { config: { estate: true } }, 'me/budget-wa-tables': { config: null } } };
  made.win.GH = class { async get(){ return { text: JSON.stringify(cache) }; } async repos(){ return []; } };
  made.shell.hasToken = () => true;
  made.shell.enrichSidebarPrivacy = async () => {};
  made.shell.loadRail = () => {};
  await made.shell.loadEstateSidebar();
  assert.deepEqual(plain(made.shell.accountRepoNames), [WA, 'me/budget-wa-tables']);
  assert.equal(made.shell.satelliteParent('me/budget-wa-tables')?.host, WA, 'a satellite with no config is found by name');
});

test('repo sizes come from the account list the privacy pass already reads', async () => {
  const made = makeShell({ browserStore: { repo: WA } });
  made.win.TOKEN = 't';
  made.win.GH = class { async repos(){
    return [{ full_name: 'me/budget-wa-tables', private: true, size: 2490932 }, { full_name: WA, private: true }];
  } };
  made.shell.hasToken = () => true;
  made.shell.estateRepos = MEMBERS.map(m => ({ ...m, priv: null }));
  await made.shell.enrichSidebarPrivacy();
  assert.equal(made.shell.repoSizes['me/budget-wa-tables'], 2490932);
  assert.equal(made.shell.repoSizes[WA], undefined, 'a row with no size records none');
  assert.match(made.shell.repoSizeLabel('me/budget-wa-tables'), /GB/);
  assert.equal(made.shell.repoSizeLabel('me/none'), '');
});

test('markup: both switchers, the masthead and the repo sidebar render satellites', () => {
  assert.match(page, /x-for="r in estateSwitcherRows"/, 'the crumb switcher reads the nested rows');
  assert.match(page, /r\.child && 'ml-5 pl-1 border-l border-base-300'/, 'and indents a child on the rule');
  assert.match(page, /openSatelliteParent\(\)" data-satellite-parent/, 'the masthead links to the parent');
  assert.match(page, /data-satellites-section/, 'the repo sidebar has the section');
  assert.match(page, /x-for="o in repoSatellites\(satelliteHost\)"/, 'listing the member in view');
  const menu = readFileSync(path.join(repoRoot, 'lib/alpineComponents/repo-menu.js'), 'utf8');
  assert.match(menu, /item\.child && 'ml-3 pl-1 border-l border-base-300'/, 'the masthead menu indents a child');
  assert.match(menu, /x-show="item\.hint"/, 'and draws its hint');
});
