// ORIGINALS REPOS in the shell: repos that hold a working repo's files exactly
// as fetched (home's constellation doctrine, Principle 2), carry no manifest,
// and are not estate members. The working repo names them in `originals`, at
// the top level or on one `projects` entry, and the app shows each under it.
// This holds the parse (repoOriginals), the claim map every surface reads
// (originalsClaims: members first, first listing wins), the working repo in
// view for the open repo, the switcher rows that indent its originals under
// it, and the markup that renders them in the crumb switcher, the
// masthead menu, the masthead's way back and the repo sidebar.
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
  [WA]: { estate: true, originals: ['me/budget-wa-lbn', 'me/budget-wa-abr'] },
  [HOME]: { estate: true, projects: ['news', { path: 'projects/budget-drs/', label: 'DRS', originals: ['me/budget-drs-acfr'] }] },
  'me/budget-wa-lbn': null,
};
const MEMBERS = [
  { repo: HOME, short: 'home', icon: 'ph-house' },
  { repo: WA, short: 'budget-wa', icon: 'ph-bank' },
];
const shellAt = (repo, configs = CONFIGS) => {
  const made = makeShell({ browserStore: { repo } });
  made.shell.estateConfigs = configs;
  made.shell.estateRepos = MEMBERS;
  return made;
};

test('repoOriginals: top-level and project entries, the project named', () => {
  const { shell } = shellAt('');
  assert.deepEqual(shell.repoOriginals(WA), [
    { repo: 'me/budget-wa-lbn', short: 'budget-wa-lbn', project: '', projectLabel: '' },
    { repo: 'me/budget-wa-abr', short: 'budget-wa-abr', project: '', projectLabel: '' },
  ]);
  assert.deepEqual(shell.repoOriginals(HOME), [
    { repo: 'me/budget-drs-acfr', short: 'budget-drs-acfr', project: 'projects/budget-drs', projectLabel: 'DRS' },
  ]);
});

test('repoOriginals: junk, duplicates, itself and members are dropped', () => {
  const { shell } = shellAt('');
  const cfg = {
    originals: ['me/a', 'me/a', 'no-owner', 42, '', ' me/b ', WA, 'me/x/y', HOME],
    projects: [{ path: 'p', originals: 'me/c' }, { path: 'q', originals: ['me/a', 'me/d'] }],
  };
  assert.deepEqual(shell.repoOriginals(WA, cfg).map(o => o.repo), ['me/a', 'me/b', 'me/d'],
    'a bare string field is not a list, and the first mention of a name wins');
  assert.deepEqual(shell.repoOriginals('me/none', null), []);
  assert.deepEqual(shell.repoOriginals('me/none', { originals: 'me/a' }), []);
});

test('repoOriginals: the open repo reads its live manifest, as repoProjects does', () => {
  const { shell, browserStore } = shellAt(WA);
  browserStore.config = { originals: ['me/live-only'] };
  assert.deepEqual(shell.repoOriginals(WA).map(o => o.repo), ['me/live-only']);
});

test('originalsClaims: a member outranks a non-member, then the first by name', () => {
  const { shell } = shellAt('');
  const claims = shell.originalsClaims({
    'me/aaa-scratch': { originals: ['me/shared'] },        // not a member, first by name
    'me/zzz-member':  { estate: true, originals: ['me/shared'] },
    'me/mmm':         { estate: true, projects: [{ path: 'x', originals: ['me/other'] }] },
    'me/nothing':     null,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(claims)), {
    'me/shared': { host: 'me/zzz-member', project: '', projectLabel: '' },
    'me/other':  { host: 'me/mmm', project: 'x', projectLabel: 'x' },
  });
});

test('originalsWorkingRepo: a working repo is itself, an originals repo resolves to its working repo', () => {
  assert.equal(shellAt(WA).shell.originalsWorkingRepo, WA);
  assert.equal(shellAt('me/budget-wa-abr').shell.originalsWorkingRepo, WA);
  assert.equal(shellAt('me/budget-drs-acfr').shell.originalsWorkingRepo, HOME);
  assert.equal(shellAt('me/unrelated').shell.originalsWorkingRepo, '');
  assert.equal(shellAt('').shell.originalsWorkingRepo, '');
});

test('the masthead way back opens the project when the claim sits on one, else the host', () => {
  const calls = [];
  const atAcfr = shellAt('me/budget-drs-acfr').shell;
  atAcfr.openProject = (repo, p) => calls.push(['project', repo, p.path]);
  atAcfr.openPinned = (repo) => calls.push(['repo', repo]);
  atAcfr.openOriginalsHost();
  const atAbr = shellAt('me/budget-wa-abr').shell;
  atAbr.openProject = atAcfr.openProject; atAbr.openPinned = atAcfr.openPinned;
  atAbr.openOriginalsHost();
  assert.deepEqual(calls, [['project', HOME, 'projects/budget-drs'], ['repo', WA]]);
  assert.equal(atAcfr.originalsHostLabel('me/budget-drs-acfr'), 'home › DRS');
  assert.equal(atAbr.originalsHostLabel('me/budget-wa-abr'), 'budget-wa');
  assert.equal(atAbr.repoGlyph('me/budget-wa-abr'), 'ph-vault', 'a claimed repo with no config wears the vault');
});

test('switcher rows: only the originals of the working repo in view, indented under it', () => {
  const rowsAt = (repo) => shellAt(repo).shell.estateSwitcherRows.map(r => (r.child ? '  ' : '') + r.repo);
  assert.deepEqual(rowsAt('me/unrelated'), [HOME, WA], 'no working repo in view: the members alone');
  assert.deepEqual(rowsAt(WA), [HOME, WA, '  me/budget-wa-lbn', '  me/budget-wa-abr']);
  assert.deepEqual(rowsAt('me/budget-drs-acfr'), [HOME, '  me/budget-drs-acfr', WA]);
});

test('masthead menu items: an originals row is a marked, hinted child that opens the repo', () => {
  const { shell } = shellAt('me/budget-drs-acfr');
  let pinned = '';
  shell.openPinned = (r) => { pinned = r; };
  shell.closeRepoMenu = () => {};
  const items = shell.estateRepoMenuItems;
  const acfr = items.find(i => i.key === 'repo:me/budget-drs-acfr');
  assert.equal(acfr.child, true);
  assert.equal(acfr.head, true, 'a repo name, so mono and no rule above it');
  assert.equal(acfr.current, true);
  assert.equal(acfr.hint, 'DRS');
  assert.equal(acfr.icon, 'ph-vault');
  assert.match(acfr.title, /originals of home › DRS/);
  items.find(i => i.key === 'repo:' + WA).run();
  assert.equal(pinned, WA);
});

test('repo sizes come from the account list the privacy pass already reads', async () => {
  const made = makeShell({ browserStore: { repo: WA } });
  made.win.TOKEN = 't';
  made.win.GH = class { async repos(){
    return [{ full_name: 'me/budget-wa-abr', private: true, size: 2490932 }, { full_name: WA, private: true }];
  } };
  made.shell.hasToken = () => true;
  made.shell.estateRepos = MEMBERS.map(m => ({ ...m, priv: null }));
  await made.shell.enrichSidebarPrivacy();
  assert.equal(made.shell.repoSizes['me/budget-wa-abr'], 2490932);
  assert.equal(made.shell.repoSizes[WA], undefined, 'a row with no size records none');
  assert.match(made.shell.repoSizeLabel('me/budget-wa-abr'), /GB/);
  assert.equal(made.shell.repoSizeLabel('me/none'), '');
  assert.equal(made.shell.estateRepos.find(r => r.repo === WA).priv, true, 'privacy still lands');
});

test('markup: both switchers, the masthead and the repo sidebar render the originals', () => {
  assert.match(page, /x-for="r in estateSwitcherRows"/, 'the crumb switcher reads the nested rows');
  assert.match(page, /r\.child && 'ml-5 pl-1 border-l border-base-300'/, 'and hangs a child off the rule');
  assert.match(page, /data-originals-host[\s\S]{0,400}openOriginalsHost\(\)|openOriginalsHost\(\)[\s\S]{0,200}data-originals-host/,
    'the masthead carries the way back');
  assert.match(page, /data-originals-section/, 'the repo sidebar carries the section');
  assert.match(page, /x-for="o in repoOriginals\(originalsWorkingRepo\)"/, 'listing the working repo in view');
  const menu = readFileSync(path.join(repoRoot, 'lib/alpineComponents/repo-menu.js'), 'utf8');
  assert.match(menu, /item\.child && 'ml-3 pl-1 border-l border-base-300'/, 'the masthead menu indents a child');
  assert.match(menu, /x-show="item\.hint"/, 'and draws its hint');
});
