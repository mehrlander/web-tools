// A full app opens on its own, never framed inside this app.
//
// A page a manifest flags `fullApp: true` brings a shell of its own (the
// budget-drs app: its header and its rail of views). Framed in the Web Tools
// app, two shells stack, so the app replaces its own address with the page's
// wherever it would have framed it: an app view, or a project's App pane.
// A promoted page without the flag (News, Links) stays a hosted page.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShell, page } from './shell.mjs';

const REGISTRY = 'mehrlander/web-tools-private';
const APP = 'projects/budget/app.html';

const CACHE = {
  repos: {
    'me/home': {
      config: {
        estate: true, icon: 'ph-house',
        pages: [
          { path: APP, appView: true, viewLabel: 'Budget', slug: 'budget', fullApp: true },
          // A route entry: the same page at a query, with no flag of its own.
          { path: APP, query: 'view=spend', title: 'Spend' },
          { path: 'me/hub:pages/news.html', appView: true, viewLabel: 'News', slug: 'news' },
        ],
      },
    },
    [REGISTRY]: { config: { estate: true, icon: 'ph-shield-check' } },
  },
};

function shellOn(cache, opts = {}) {
  const { shell, win } = makeShell(opts);
  win.TOKEN = 'test-token';
  win.GH = class {
    async get(p) {
      if (p === 'state/configs.json') return { text: JSON.stringify(cache) };
      const e = new Error('GitHub Error 404'); e.status = 404; throw e;
    }
    async repos() { return Object.keys(cache.repos).map(n => ({ full_name: n })); }
  };
  shell.REGISTRY_REPO = REGISTRY;
  return { shell, win };
}

test('the flag marks the page at its path, whichever entry carries it', async () => {
  const { shell } = shellOn(CACHE);
  await shell.loadEstateSidebar();
  assert.deepEqual(shell.fullAppKeys, ['me/home:' + APP]);
  assert.equal(shell.isFullApp('me/home', APP), true);
  assert.equal(shell.isFullApp('me/hub', 'pages/news.html'), false,
    'a promoted page without the flag stays a hosted page');
  const byLabel = Object.fromEntries(shell.appViews.map(v => [v.baseLabel, v]));
  assert.equal(byLabel.Budget.fullApp, true);
  assert.equal(byLabel.News.fullApp, false);
});

test('an app view of a full app names its own address as the exit; a hosted page has none', async () => {
  const { shell } = shellOn(CACHE);
  await shell.loadEstateSidebar();
  shell.view = 'app';
  shell.appView = shell.appViews.find(v => v.baseLabel === 'Budget');
  assert.match(shell.fullAppExit, /toss-render\.html.*#gh=me\/home:projects\/budget\/app\.html$/);
  shell.appView = shell.appViews.find(v => v.baseLabel === 'News');
  assert.equal(shell.fullAppExit, '', 'News is framed as before');
});

test('leaving replaces the top window\'s address, once', async () => {
  const { shell, win } = shellOn(CACHE);
  await shell.loadEstateSidebar();
  const went = [];
  win.top = { location: { replace: (h) => went.push(h) } };
  shell.view = 'app';
  shell.appView = shell.appViews.find(v => v.baseLabel === 'Budget');
  shell.leaveForFullApp();
  shell.leaveForFullApp();
  assert.equal(went.length, 1, 'a re-run of the effect does not navigate twice');
  assert.match(went[0], /^https:\/\/localhost\/pages\/toss-render\.html.*#gh=me\/home:projects\/budget\/app\.html$/);
});

test('the browsed repo\'s own manifest is enough, before the estate cache has it', () => {
  const browserStore = { repo: 'me/home', config: { pages: [{ path: APP, fullApp: true }] } };
  const { shell } = shellOn({ repos: {} }, { browserStore });
  assert.equal(shell.isFullApp('me/home', APP), true);
  assert.equal(shell.isFullApp('me/home', 'pages/other.html'), false);
});

test('the header and sidebar say so, and both frames stand aside for a full app', async () => {
  const { shell } = shellOn(CACHE);
  await shell.loadEstateSidebar();
  const budget = shell.appViews.find(v => v.baseLabel === 'Budget');
  assert.match(shell.appViewTitle(budget), /opens outside Web Tools$/);
  assert.doesNotMatch(shell.appViewTitle(shell.appViews.find(v => v.baseLabel === 'News')), /outside/);
  assert.match(page, /<template x-if="appView && !fullAppExit">\s*<iframe :src="appViewUrl"/);
  assert.match(page, /<template x-if="projectPane==='app' && !fullAppExit">\s*<iframe :src="projectLandingUrl"/);
  assert.match(page, /<main data-pattern="host" x-effect="leaveForFullApp\(\)"/);
});
