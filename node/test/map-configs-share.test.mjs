// The Map's four config-cache loaders share one fresh read. Work
// declarations, the data census, estate columns and test execution each read
// the registry's state/configs.json FRESH; loaders that open within a minute
// of each other share one read (readConfigsCache in map.js), a forced load
// starts a new one, a failed read is not kept, and a configs-refreshed ends
// the share. Driven through the real component, so the count is what a Map
// load would send.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const { window, problems } = makeWindow({ html: '<div id="map" x-data="map()"></div>' });
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
Alpine.store('browser', { repo: '', ref: '' });
window.__shell = Alpine.reactive({
  mapTab: 'data', _authState: 'auth', REGISTRY_REPO: 'mehrlander/web-tools-private',
  hasToken(){ return this._authState === 'auth'; },
});
window.history.replaceState({}, '', '?view=map&tab=data');
window.TOKEN = 'token-a';

// map.js runs in the jsdom realm, so its Date is this one.
let skew = 0;
const realNow = window.Date.now.bind(window.Date);
window.Date.now = () => realNow() + skew;

const hub = 'mehrlander/web-tools', member = 'example/member';
const columns = 'data/columns.csv';
const configs = { repos: {
  [hub]: { config: { estate: true } },
  [member]: { config: { estate: true, data: { columns: [{ path: columns, table: 'table', column: 'column' }] } } },
} };
const reads = [];
let failConfigs = false;
window.GH = class {
  static FRESH = { cache: 'no-store' };
  constructor(opts){ this.opts = opts; }
  async get(file, opts){
    if (file === 'state/configs.json') {
      reads.push({ ...this.opts, cache: opts?.cache });
      await tick(1);
      if (failConfigs) throw new Error('Temporary network failure');
      return { text: JSON.stringify(configs) };
    }
    if (file === '.web-tools.json') return { text: JSON.stringify({ estate: true }) };
    if (file === columns) return { text: 'table,column,column_primitive\nlist.csv,name,key\n' };
    return { text: readFileSync(path.join(repoRoot, file), 'utf8') };
  }
};
for (const file of ['lib/kits/repo-address.js', 'lib/kits/csv.js', 'lib/vanilla-bundle.js', 'lib/alpineComponents/map.js'])
  new window.Function(readFileSync(path.join(repoRoot, file), 'utf8'))();
Alpine.start();
const data = Alpine.$data(window.document.getElementById('map'));
async function settled(){
  await tick(3);
  for (let i = 0; i < 40 && (data.dataLoading || data.estateColumnsLoading || data.workLoading || data.testExecutionLoading); i++) await tick();
  assert.ok(!data.dataLoading && !data.estateColumnsLoading && !data.workLoading && !data.testExecutionLoading, 'loads settled');
  await tick();
}
await settled();

test('loaders opening within the window read the config cache once', async () => {
  assert.deepEqual(problems, []);
  assert.equal(reads.length, 1, 'Data opens two loaders, which share one read');
  assert.ok(data.dataCensus.some(s => s.repo === member), 'the census used the shared cache');
  assert.equal(data.estateColumns[0]?.rows.length, 1, 'estate columns used the shared cache');
  await Promise.all([data.loadWorkDeclarations(), data.loadTestExecution()]);
  await settled();
  assert.equal(reads.length, 1, 'two more loaders a moment later share it too');
  assert.ok(data.workSources.some(s => s.repo === member));
  assert.ok(reads.every(r => r.repo === 'mehrlander/web-tools-private' && r.ref === 'main' && r.cache === 'no-store'),
    'the shared read is still a fresh read of the registry on main');
});

test('a forced load starts a new read, which later loaders share', async () => {
  await data.loadEstateColumns(true);
  assert.equal(reads.length, 2);
  data.refreshDataCensus();
  await settled();
  assert.equal(reads.length, 2);
});

test('a load after the window reads again', async () => {
  skew += 61_000;
  data.refreshEstateColumns();
  await settled();
  assert.equal(reads.length, 3);
  assert.equal(data.estateColumns[0]?.rows.length, 1);
});

test('a failed read is not shared', async () => {
  failConfigs = true;
  await data.loadEstateColumns(true);
  assert.equal(reads.length, 4);
  assert.match(data.estateColumnsErr, /Estate declarations unavailable/);
  failConfigs = false;
  data.refreshEstateColumns();
  await settled();
  assert.equal(reads.length, 5, 'the next loader reads again rather than reusing the failure');
  assert.equal(data.estateColumnsErr, '');
  assert.equal(data.estateColumns[0]?.rows.length, 1);
});

test('a configs-refreshed ends the share, and its reloads share one read', async () => {
  window.document.dispatchEvent(new window.CustomEvent('web-tools:configs-refreshed'));
  await settled();
  assert.equal(reads.length, 6);
});

test('another token does not share the read', async () => {
  window.TOKEN = 'token-b';
  data.refreshEstateColumns();
  await settled();
  assert.equal(reads.length, 7);
  assert.deepEqual(problems, []);
});
