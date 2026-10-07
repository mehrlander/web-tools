// The repo landing view: masthead with repo mark & switcher, metadata badges,
// and the tabstrip (Overview README, App toss-render frame, Board tracker,
// Pages gallery, Files browser, Atlas link). Holds the methods and markup
// wiring to ensure repo presentation matches project presentation.

import test from 'node:test';
import assert from 'node:assert/strict';
import { page, makeShell } from './shell.mjs';

test('repoGlyph: resolves from estateRepos or config icon, falls back to ph-folder-simple', () => {
  const { shell, browserStore } = makeShell({ browserStore: { repo: 'mehrlander/home' } });
  
  // 1. Fallback when unconfigured
  assert.equal(shell.repoGlyph('mehrlander/home'), 'ph-folder-simple');

  // 2. From estateRepos (with or without ph- prefix)
  shell.estateRepos = [{ repo: 'mehrlander/home', icon: 'house' }];
  assert.equal(shell.repoGlyph('mehrlander/home'), 'ph-house');

  shell.estateRepos = [{ repo: 'mehrlander/home', icon: 'ph-terminal' }];
  assert.equal(shell.repoGlyph('mehrlander/home'), 'ph-terminal');

  // 3. From estateConfigs
  shell.estateRepos = [];
  shell.estateConfigs = { 'mehrlander/home': { icon: 'cube' } };
  assert.equal(shell.repoGlyph('mehrlander/home'), 'ph-cube');

  // 4. From browserStore.config
  browserStore.config = { icon: 'bank' };
  assert.equal(shell.repoGlyph('mehrlander/home'), 'ph-bank');
});

test('repoLanding: discovers landing from cfg.landing, showing.app, or repo pages', () => {
  const { shell, browserStore } = makeShell({ browserStore: { repo: 'mehrlander/home' } });

  // None declared
  assert.equal(shell.repoLanding, '');

  // cfg.landing
  browserStore.config = { landing: 'app/index.html' };
  assert.equal(shell.repoLanding, 'app/index.html');

  // cfg.showing.app
  browserStore.config = { showing: { app: 'pages/home.html' } };
  assert.equal(shell.repoLanding, 'pages/home.html');

  // cfg.pages matching repo name slug
  browserStore.config = { pages: [{ path: 'pages/home.html', slug: 'home' }] };
  assert.equal(shell.repoLanding, 'pages/home.html');

  // cfg.pages matching app/index.html
  browserStore.config = { pages: [{ path: 'app/index.html', appView: true }] };
  assert.equal(shell.repoLanding, 'app/index.html');
});

test('repoLandingUrl: formats toss-render hash with repo, ref and route query', () => {
  const { shell, browserStore } = makeShell({ browserStore: {
    repo: 'mehrlander/home', ref: 'dev', defaultRef: 'main',
  }});
  browserStore.config = { landing: 'app/index.html' };
  shell.landingAppRoute = 'view=calc';

  assert.equal(shell.repoLandingUrl, '../pages/toss-render.html#gh=mehrlander/home@dev:app/index.html?view=calc');
});

test('repoBoardFile: discovers tracker board or defaults to tracker/board.md unless tracker is false', () => {
  const { shell, browserStore } = makeShell({ browserStore: { repo: 'mehrlander/home' } });

  // Default
  assert.equal(shell.repoBoardFile, 'tracker/board.md');
  assert.equal(shell.repoBoardCsvFile, 'tracker/board.csv');

  // Custom path
  browserStore.config = { tracker: 'work/board.md' };
  assert.equal(shell.repoBoardFile, 'work/board.md');
  assert.equal(shell.repoBoardCsvFile, 'work/board.csv');

  // Explicitly disabled
  browserStore.config = { tracker: false };
  assert.equal(shell.repoBoardFile, '');
  assert.equal(shell.repoBoardCsvFile, '');
});

test('repoPagesCount: counts repo pages, blank on default repo', () => {
  const { shell, browserStore } = makeShell({ browserStore: { repo: 'mehrlander/web-tools' } });
  shell.DEFAULT_REPO = 'mehrlander/web-tools';

  // On default repo, returns '' (pages gallery has its own standing nav stop)
  assert.equal(shell.repoPagesCount, '');

  // On another repo
  browserStore.repo = 'mehrlander/home';
  browserStore.config = { pages: [{ path: 'a.html' }, { path: 'b.html' }] };
  assert.equal(shell.repoPagesCount, 2);
});

test('estateRepoMenuItems: builds switcher items with current marked, runs openPinned', () => {
  const { shell, browserStore } = makeShell({ browserStore: { repo: 'mehrlander/home' } });
  shell.estateRepos = [
    { repo: 'mehrlander/home', short: 'home', icon: 'ph-house' },
    { repo: 'mehrlander/web-tools', short: 'web-tools', icon: 'ph-hammer' },
  ];

  let pinned = '';
  let closed = false;
  shell.openPinned = (r) => { pinned = r; };
  shell.closeRepoMenu = () => { closed = true; };

  const items = shell.estateRepoMenuItems;
  assert.equal(items.length, 2);
  assert.equal(items[0].current, true);
  assert.equal(items[1].current, false);

  // Clicking current closes menu without navigating
  items[0].run();
  assert.equal(closed, true);
  assert.equal(pinned, '');

  // Clicking another repo navigates
  closed = false;
  items[1].run();
  assert.equal(closed, true);
  assert.equal(pinned, 'mehrlander/web-tools');
});

test('repoMenuItems: returns estateRepoMenuItems when menuKind === repos', () => {
  const { shell } = makeShell();
  shell.estateRepos = [{ repo: 'mehrlander/home', short: 'home' }];
  shell.menuKind = 'repos';
  assert.equal(shell.repoMenuItems.length, 1);
  assert.equal(shell.repoMenuItems[0].label, 'home');
});

test('goLanding: switches tab and syncs URL', () => {
  const { shell } = makeShell();
  shell.syncUrl = () => {};

  shell.goLanding();
  assert.equal(shell.view, 'landing');
  assert.equal(shell.landingTab, 'overview');

  shell.goLanding('board');
  assert.equal(shell.landingTab, 'board');

  shell.goLanding('app', 'view=status');
  assert.equal(shell.landingTab, 'app');
  assert.equal(shell.landingAppRoute, 'view=status');

  shell.goLanding('files');
  assert.equal(shell.landingTab, 'files');

  shell.goLanding('pages');
  assert.equal(shell.landingTab, 'pages');

  // Unknown falls back to overview
  shell.goLanding('nonexistent');
  assert.equal(shell.landingTab, 'overview');
});

test('landingPane: falls back to overview when app is selected without a landing', () => {
  const { shell, browserStore } = makeShell({ browserStore: { repo: 'mehrlander/home' } });
  browserStore.config = {};
  shell.landingTab = 'app';
  assert.equal(shell.landingPane, 'overview');

  browserStore.config = { landing: 'app/index.html' };
  assert.equal(shell.landingPane, 'app');
});

test('landing deep link: stamps ?repo, tab, and item params', () => {
  const { shell, browserStore } = makeShell({ browserStore: { repo: 'mehrlander/home' } });
  browserStore.config = { landing: 'app/index.html' };
  shell.view = 'landing';

  // Overview stamps ?repo=owner/repo with no tab
  shell.landingTab = 'overview';
  const p1 = new URLSearchParams();
  shell.deepLinkParams(p1);
  assert.equal(p1.get('repo'), 'mehrlander/home');
  assert.equal(p1.get('tab'), null);

  // Board stamps &tab=board
  shell.landingTab = 'board';
  const p2 = new URLSearchParams();
  shell.deepLinkParams(p2);
  assert.equal(p2.get('repo'), 'mehrlander/home');
  assert.equal(p2.get('tab'), 'board');

  // App stamps &tab=app and &item=route
  shell.landingTab = 'app';
  shell.landingAppRoute = 'mode=preview';
  const p3 = new URLSearchParams();
  shell.deepLinkParams(p3);
  assert.equal(p3.get('repo'), 'mehrlander/home');
  assert.equal(p3.get('tab'), 'app');
  assert.equal(p3.get('item'), 'mode=preview');

  // Files stamps &tab=files
  shell.landingTab = 'files';
  const p4 = new URLSearchParams();
  shell.deepLinkParams(p4);
  assert.equal(p4.get('repo'), 'mehrlander/home');
  assert.equal(p4.get('tab'), 'files');
});

test('routeFromUrl: opens repo landing and activates tab', async () => {
  const { shell } = makeShell();
  const opened = [];
  shell.goLanding = (tab, item) => { opened.push({ tab, item }); };

  // URL naming repo without view routes to landing overview
  const ok1 = await shell.routeFromUrl({ repo: 'mehrlander/home' });
  assert.equal(ok1, true);
  assert.deepEqual(opened[0], { tab: undefined, item: undefined });

  // URL with tab=board
  const ok2 = await shell.routeFromUrl({ repo: 'mehrlander/home', tab: 'board' });
  assert.equal(ok2, true);
  assert.deepEqual(opened[1], { tab: 'board', item: undefined });

  // URL with tab=app and item
  const ok3 = await shell.routeFromUrl({ repo: 'mehrlander/home', tab: 'app', item: 'view=summary' });
  assert.equal(ok3, true);
  assert.deepEqual(opened[2], { tab: 'app', item: 'view=summary' });
});

test('markup: repo masthead and tabs wired to shell methods', () => {
  // 1. Repo mark button triggers switcher menu
  assert.match(page, /toggleRepoMenu\(\$store\.browser\.repo,\s*\$event\.currentTarget,\s*'repos',\s*\{\s*align:\s*'left'\s*\}\)/);

  // 2. Tab buttons wired to goLandingTab
  assert.match(page, /goLandingTab\('overview'\)/);
  assert.match(page, /goLandingTab\('app'\)/);
  assert.match(page, /goLandingTab\('board'\)/);
  assert.match(page, /goLandingTab\('pages'\)/);
  assert.match(page, /goLandingTab\('files'\)/);

  // 3. Toss-render iframe in app pane
  assert.match(page, /:src="repoLandingUrl"/);

  // 4. File browser in files pane
  assert.match(page, /fileBrowser\(\{ repo: r, ref: \$store\.browser\.ref/);

  // 5. Prose has !max-w-none (reading column house style)
  assert.match(page, /prose prose-sm !max-w-none prose-pre:bg-base-200/);
});
