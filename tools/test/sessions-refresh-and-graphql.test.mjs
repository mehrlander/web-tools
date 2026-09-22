// tools/test/sessions-refresh-and-graphql.test.mjs — tests for:
// 1. Sessions view "as of x" agePill in-place refreshActivityGroup wiring
// 2. sessionsBusy flag covering activityGroupRefreshing
// 3. crawlLabel('sessions') falling back to 'activity' progress while activityGroupRefreshing
// 4. GraphQL response capture and Activity view inspector state

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, startAlpine, repoRoot } from './bootstrap.mjs';

const fetchSrc = readFileSync(path.join(repoRoot, 'lib/gh-fetch.js'), 'utf8');
const estateSrc = readFileSync(path.join(repoRoot, 'lib/alpineComponents/estate.js'), 'utf8');

class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; this.headers = {}; }
  ago(d) { return 'just now'; }
  async repos() { return []; }
  async ls() { return []; }
  async get(name) { return { text: '{}' }; }
  async req() { return []; }
  async branchesDatedSessions() { return { branches: [], sessions: {}, ordered: true, capped: false }; }
}

test('sessions agePill markup invokes refreshActivityGroup directly and shows refresh icon', () => {
  assert.ok(
    estateSrc.includes("agePill('sessions', 'sessionsGeneratedAt', 'sessionsBusy', 'Crawling…', 'Sessions cache', 0, 'window.__shell?.refreshActivityGroup()', 'click to refresh sessions and branches')"),
    'sessions header passes refreshActivityGroup and refresh title to agePill'
  );
  assert.ok(
    estateSrc.includes("ph-arrow-clockwise"),
    'agePill supports ph-arrow-clockwise for custom refresh actions'
  );
});

test('sessionsBusy reflects both sessionsRefreshing and activityGroupRefreshing', async () => {
  const { window } = makeWindow({
    html: '<!doctype html><html><body><div id="es" x-data="estate()"></div></body></html>',
  });
  window.TOKEN = 'tok';
  window.GH = FakeGH;
  const shell = { sessionsRefreshing: false, activityGroupRefreshing: false };
  window.__shell = shell;

  const Alpine = await startAlpine(window, [
    'lib/alpine-bundle.js',
    'lib/alpineComponents/estate.js',
  ]);

  const est = Alpine.$data(window.document.getElementById('es'));
  assert.equal(est.sessionsBusy, false);

  shell.sessionsRefreshing = true;
  assert.equal(est.sessionsBusy, true);

  shell.sessionsRefreshing = false;
  shell.activityGroupRefreshing = true;
  assert.equal(est.sessionsBusy, true, 'sessionsBusy is true while activityGroupRefreshing');

  shell.activityGroupRefreshing = false;
  assert.equal(est.sessionsBusy, false);
});

test('crawlLabel falls back to activity progress during activityGroupRefreshing', async () => {
  const { window } = makeWindow({
    html: '<!doctype html><html><body><div id="es" x-data="estate()"></div></body></html>',
  });
  window.TOKEN = 'tok';
  window.GH = FakeGH;
  const shell = {
    activityGroupRefreshing: true,
    crawlProgress: {
      sessions: null,
      activity: { verb: 'Refreshing activity', done: 4, total: 10, unit: 'repos' },
    },
  };
  window.__shell = shell;

  const Alpine = await startAlpine(window, [
    'lib/alpine-bundle.js',
    'lib/alpineComponents/estate.js',
  ]);

  const est = Alpine.$data(window.document.getElementById('es'));
  const label = est.crawlLabel('sessions');
  assert.equal(label, 'Refreshing activity · 4 of 10 repos');
});

test('branchesDatedSessions captures query, response, and extracted metadata in window.__graphQLByRepo', async () => {
  const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
  window.GH = class { constructor(conf = {}) { this.repo = conf.repo || ''; this.headers = {}; } };
  new window.Function(fetchSrc)();

  const gh = new window.GH({ repo: 'owner/test-repo' });
  const mockNodes = [
    {
      name: 'claude/feat-1',
      target: {
        oid: 'sha123',
        committedDate: '2026-09-21T10:00:00Z',
        messageHeadline: 'Feat headline',
        history: {
          nodes: [
            { messageBody: 'Some commit\n\nClaude-Session: https://claude.ai/code/session_abc123' },
          ],
        },
      },
    },
  ];

  window.fetch = async () => ({
    ok: true,
    json: async () => ({
      data: {
        repository: {
          refs: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: mockNodes,
          },
        },
      },
    }),
  });

  const result = await gh.branchesDatedSessions(10, 10, 8);
  assert.equal(result.branches.length, 1);
  assert.equal(result.branches[0].name, 'claude/feat-1');
  assert.equal(result.sessions['claude/feat-1'], 'https://claude.ai/code/session_abc123');

  const captured = window.__graphQLByRepo['owner/test-repo'];
  assert.ok(captured, 'snapshot exists for owner/test-repo');
  assert.equal(captured.repo, 'owner/test-repo');
  assert.equal(captured.branches.length, 1);
  assert.equal(captured.sessions['claude/feat-1'], 'https://claude.ai/code/session_abc123');
  assert.ok(captured.raw, 'raw response data captured');
  assert.equal(window.__lastActivityGraphQL, captured, 'last activity GraphQL holds the same snapshot');
});

test('State view GraphQL Activity Discovery inspector state, methods, and layout', async () => {
  const { window } = makeWindow({
    html: '<!doctype html><html><body><div id="sv" x-data="stateView()"></div></body></html>',
  });
  window.TOKEN = 'test-tok';
  window.GH = FakeGH;
  window.__shell = {
    REGISTRY_REPO: 'mehrlander/web-tools-private',
    estateRepos: [{ repo: 'mehrlander/web-tools' }, { repo: 'mehrlander/other-repo' }],
  };

  const Alpine = await startAlpine(window, [
    'lib/alpine-bundle.js',
    'lib/alpineComponents/state-view.js',
  ]);

  const sv = Alpine.$data(window.document.getElementById('sv'));
  assert.ok(sv.template.includes('lg:grid-cols-2'), 'State view template contains responsive 2-column desktop grid');
  assert.ok(sv.template.includes('BranchesDatedSessions'), 'State view template renders BranchesDatedSessions inspector');
  assert.equal(typeof sv.fetchActivityGraphQL, 'function');
  assert.equal(typeof sv.copyGraphQLText, 'function');
  assert.equal(sv.graphQLTab, 'response');
  assert.equal(sv.graphQLRepo, 'all', 'defaults to all repositories');
  assert.equal(sv.currentGraphQL, null, 'currentGraphQL is null when no repo snapshots exist');

  window.__graphQLByRepo = {
    'mehrlander/web-tools': {
      repo: 'mehrlander/web-tools',
      at: '2026-09-21T10:00:00Z',
      duration: 120,
      branchesCount: 2,
      sessionsCount: 1,
      branches: [{ name: 'main', date: '2026-09-21T09:00:00Z' }, { name: 'feat-1', date: '2026-09-21T10:00:00Z' }],
      sessions: { 'feat-1': 'https://claude.ai/code/session_1' },
      ordered: true,
      raw: { repository: { refs: { nodes: [] } } },
    },
    'mehrlander/other-repo': {
      repo: 'mehrlander/other-repo',
      at: '2026-09-21T11:00:00Z',
      duration: 80,
      branchesCount: 1,
      sessionsCount: 1,
      branches: [{ name: 'dev', date: '2026-09-21T11:00:00Z' }],
      sessions: { 'dev': 'https://claude.ai/code/session_2' },
      ordered: true,
      raw: { repository: { refs: { nodes: [] } } },
    },
  };

  // Aggregated view
  const all = sv.currentGraphQL;
  assert.equal(all?.isAll, true);
  assert.equal(all?.repoCount, 2);
  assert.equal(all?.branchesCount, 3);
  assert.equal(all?.duration, 200);
  assert.equal(all?.branches[0].name, 'dev', 'sorted newest first');
  assert.equal(all?.branches[0].repo, 'mehrlander/other-repo');

  // Single repo view
  sv.graphQLRepo = 'mehrlander/web-tools';
  assert.equal(sv.currentGraphQL?.repo, 'mehrlander/web-tools');
  assert.equal(sv.currentGraphQL?.branchesCount, 2);

  assert.ok(sv.graphQLReposList.includes('all'));
  assert.ok(sv.graphQLReposList.includes('mehrlander/web-tools'));
  assert.ok(sv.graphQLReposList.includes('mehrlander/other-repo'));
  assert.ok(sv.graphQLReposList.includes('mehrlander/web-tools-private'));
  sv.destroy();
});
