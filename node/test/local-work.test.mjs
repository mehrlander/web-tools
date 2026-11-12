import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { repoRoot } from './bootstrap.mjs';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const window = {};
new Function('window', readFileSync(repoRoot + '/lib/kits/local-work.js', 'utf8'))(window);
const W = window.LocalWork;
test('stale and missing observations never claim live state', () => {
  const now = Date.parse('2026-11-11T12:00:00Z');
  assert.equal(W.freshness({observedAt:'2026-11-11T11:00:00Z'}, now), 'Last observation');
  assert.equal(W.freshness({}, now), 'Last observation');
  assert.equal(W.freshness({observedAt:'2026-11-11T12:10:00Z'}, now), 'Last observation');
});
test('publication and incorporation remain independent', () => {
  const row = {publication:'pushed', changed:2, integration:'incorporated'};
  assert.equal(W.preservation(row), 'Committed content pushed');
  assert.equal(W.integration(row), 'Committed content is in the default branch');
  assert.equal(W.preservation({}), 'Publication unknown');
});
test('query includes path associations and session links reject arbitrary destinations', () => {
  assert.equal(W.rows({checkouts:[{path:'old-thread',sessions:[{title:'Excel assessment'}]}]}, 'excel old').length, 1);
  assert.equal(W.sessionUrl('javascript:alert(1)'), '');
  assert.ok(W.sessionUrl('aa11bb22').includes('session=aa11bb22'));
  assert.ok(W.sessionUrl('aa11bb22', 'sessions/2026/09/2026-09-19-aa11bb22.json').includes('pages/session.html#gh='), 'older records open without membership in the capped recent-session cache');
});

test('a loaded observation mounts checkout rows and survives a failed refresh', async () => {
  const {window: browser} = makeWindow({html:'<div id="local" x-data="localWork()"></div>'});
  let fail = false;
  browser.GH = class {
    async get() {
      if (fail) throw new Error('offline');
      return {text:JSON.stringify({schema:1,observedAt:'2026-11-11T12:00:00Z',coverage:{complete:true,sessions:[]},
        stores:[],standalone:[],sessions:[],checkouts:[{id:'checkout',path:'project',scope:'repositories',
          branch:'main',repo:'fixture/project',publication:'pushed',integration:'incorporated',changed:1,untracked:0,ignored:0,state:'ready'}]})};
    }
  };
  browser.__shell = {REGISTRY_REPO:'fixture/private'};
  const Alpine = await startAlpine(browser, ['lib/kits/repo-address.js','lib/kits/local-work.js','lib/alpineComponents/local-work.js']);
  await tick(5);
  const host = browser.document.getElementById('local'), data = Alpine.$data(host);
  assert.equal(host.querySelectorAll('article').length, 1);
  assert.match(host.textContent, /Working-file changes remain local/);
  assert.match(host.textContent, /Committed content pushed/);
  assert.match(host.textContent, /1 changed · 0 untracked/);
  fail = true;
  await data.load();
  assert.equal(data.snapshot.checkouts.length, 1);
  assert.match(data.error, /previous observation/);
  browser.close();
});
