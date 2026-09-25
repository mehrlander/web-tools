// The Map Data lifecycle: public boot, credentials, refresh, and the Files
// handoff. Real Alpine watches/events drive invalidation; no cache reset in
// the tests can hide a missing production reset.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: '<!doctype html><html><body><div id="map" x-data="map()"></div></body></html>',
});
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
Alpine.store('browser', { repo: '', ref: '' });
const opened = [];
window.__shell = Alpine.reactive({
  mapTab: 'data', _authState: 'public', REGISTRY_REPO: 'mehrlander/web-tools-private',
  hasToken(){ return this._authState === 'auth'; },
  async ensureBrowser(repo, ref){ Object.assign(Alpine.store('browser'), { repo, ref }); },
  async openFile(file){ opened.push({ ...Alpine.store('browser'), file }); },
});
window.history.replaceState({}, '', '?view=map&tab=data&use=codex/census-preview');
window.TOKEN = '';

const hub = 'mehrlander/web-tools', home = 'mehrlander/home';
const censusPath = 'data/csv-census.csv';
const quote = v => '"' + String(v).replaceAll('"', '""') + '"';
function census(...files) {
  const own = [censusPath, files.length + 1, 5, 100,
    '["path","rows","columns","bytes","headers"]'];
  return 'path,rows,columns,bytes,headers\n' + [own, ...files].map(row =>
    row.map(quote).join(',')).join('\n') + '\n';
}
const manifests = {
  [hub]: { estate: true, data: { census: censusPath } },
  [home]: { estate: true, data: { census: censusPath } },
  'mehrlander/quiet': { estate: true },
  'mehrlander/empty': { estate: true, data: { census: censusPath } },
  'mehrlander/invalid': { estate: true, data: { census: 42 } },
  'mehrlander/bad-heading': { estate: true, data: { census: censusPath } },
  'mehrlander/drive-absolute': { estate: true, data: { census: 'C:/foo.csv' } },
  'mehrlander/drive-relative': { estate: true, data: { census: censusPath } },
  'mehrlander/gone': null,
};
const contents = {
  [hub]: census(['docs/data.csv', 1, 1, 12, '["hub heading"]']),
  [home]: census([' leading.csv', 1, 2, 15, '["name","value"]'],
    ['leading.csv', 2, 1, 20, '["name"]']),
  'mehrlander/empty': census(),
  'mehrlander/bad-heading': census().replace('path,rows,columns,bytes,headers', '"path,rows,columns,bytes,headers"'),
  'mehrlander/drive-relative': census(['c:foo.csv', 1, 1, 10, '["name"]']),
};
const failed = new Set(), asked = [];
let heldHub = null;
window.GH = class {
  static FRESH = { cache: 'no-store' };
  constructor(opts){ this.opts = opts; }
  async get(file, opts){
    asked.push({ ...this.opts, path: file, cache: opts?.cache });
    if (file === '.web-tools.json') return { text: JSON.stringify(manifests[this.opts.repo]) };
    if (file === 'state/configs.json') return { text: JSON.stringify({ repos:
      Object.fromEntries(Object.entries(manifests).map(([repo, config]) => [repo, { config }])) }) };
    if (file === censusPath) {
      if (this.opts.repo === hub && heldHub) { const held = heldHub; heldHub = null; return held; }
      if (failed.has(this.opts.repo)) throw new Error('Temporary network failure');
      return { text: contents[this.opts.repo] };
    }
    return { text: readFileSync(path.join(repoRoot, file), 'utf8') };
  }
};
for (const file of ['lib/kits/csv.js', 'lib/vanilla-bundle.js', 'lib/alpineComponents/map.js'])
  new window.Function(readFileSync(path.join(repoRoot, file), 'utf8'))();
Alpine.start();
const el = window.document.getElementById('map');
const data = Alpine.$data(el);
async function settled(){
  await tick(2);
  for (let i = 0; data.dataLoading && i < 30; i++) await tick();
  assert.equal(data.dataLoading, false, 'inventory request settled');
  await tick();
}
await settled();

test('a cold Data link reads only the public hub and follows its preview ref', () => {
  assert.deepEqual(problems, []);
  assert.deepEqual([...data.dataCensus.map(s => s.repo)], [hub]);
  assert.equal(data.dataCensus[0].ref, 'codex/census-preview');
  assert.ok(!asked.some(r => r.path === 'state/configs.json'));
  assert.ok(asked.filter(r => r.repo === hub && r.path === censusPath)
    .every(r => r.ref === 'codex/census-preview'));
});

test('auth arriving loads estate inventories and preserves distinct source paths', async () => {
  window.TOKEN = 'test-token';
  window.__shell._authState = 'auth';
  await settled();
  const states = Object.fromEntries(data.dataCensus.map(s => [s.repo, s.state]));
  assert.equal(states[home], 'declared');
  assert.equal(states['mehrlander/quiet'], 'undeclared');
  assert.equal(states['mehrlander/empty'], 'empty');
  assert.equal(states['mehrlander/invalid'], 'unavailable');
  assert.equal(states['mehrlander/bad-heading'], 'unavailable', 'the census header must contain five fields');
  assert.equal(states['mehrlander/drive-absolute'], 'unavailable', 'a declaration cannot name a Windows drive');
  assert.equal(states['mehrlander/drive-relative'], 'unavailable', 'a source path cannot be drive-relative');
  assert.ok(!asked.some(r => r.path === 'C:/foo.csv'), 'an invalid declaration is rejected before fetching');
  assert.ok(!('mehrlander/gone' in states));
  assert.deepEqual([...data.dataCensus.find(s => s.repo === home).files.map(f => f.path)],
    [censusPath, ' leading.csv', 'leading.csv']);
  assert.ok(!asked.some(r => r.path === ' leading.csv'), 'source files are read only when opened');
  assert.match(el.textContent, /Invalid census path/, 'the unavailable reason is visible');
});

test('scope and header search use inventory rows, with no source fetch', () => {
  const before = asked.length;
  data.dataScope = home;
  data.dataQ = 'value';
  assert.deepEqual([...data.dataMatches.map(f => f.path)], [' leading.csv']);
  assert.equal(asked.length, before);
  data.dataScope = ''; data.dataQ = '';
});

test('Data opens Files at the exact repository, ref, and path', async () => {
  const source = data.dataCensus.find(s => s.repo === home).files.find(f => f.path === ' leading.csv');
  await data.openDataFile(source);
  await data.openDataFile(data.dataCensus[0].files[1]);
  assert.deepEqual(opened, [
    { repo: home, ref: 'main', file: ' leading.csv' },
    { repo: hub, ref: 'codex/census-preview', file: 'docs/data.csv' },
  ]);
  const ensure = window.__shell.ensureBrowser;
  window.__shell.ensureBrowser = async () => {};
  await data.openDataFile(source);
  assert.equal(opened.length, 2, 'a failed repository switch cannot open the path in the old repo');
  window.__shell.ensureBrowser = ensure;
});

test('revisiting Data retries a failed inventory without resetting component state', async () => {
  failed.add(home);
  await data.loadDataCensus(true);
  assert.equal(data.dataCensus.find(s => s.repo === home).state, 'unavailable');
  assert.match(el.textContent, /Temporary network failure/);
  failed.delete(home);
  data.setTab('set'); data.setTab('data');
  await settled();
  assert.equal(data.dataCensus.find(s => s.repo === home).state, 'declared');
});

test('the Refresh control discovers declarations added to the config cache', async () => {
  delete manifests['mehrlander/invalid'];
  delete manifests['mehrlander/bad-heading'];
  delete manifests['mehrlander/drive-absolute'];
  delete manifests['mehrlander/drive-relative'];
  manifests['mehrlander/new'] = { estate: true, data: { census: censusPath } };
  contents['mehrlander/new'] = census();
  const refresh = [...el.querySelectorAll('button')].find(b => b.getAttribute('@click') === 'loadDataCensus(true)');
  assert.ok(refresh);
  const before = asked.length;
  refresh.click();
  await settled();
  assert.equal(data.dataCensus.find(s => s.repo === 'mehrlander/new').state, 'empty');
  assert.equal(data.dataNeedsRetry, false);
  assert.ok(asked.slice(before).every(r => r.cache === 'no-store'),
    'refresh bypasses the GH memo and browser cache for every declaration and inventory');
});

test('a config refresh wins over an earlier inventory request still in flight', async () => {
  let finishOld;
  heldHub = new Promise(resolve => { finishOld = resolve; });
  const oldRead = data.loadDataCensus(true);
  await tick(2);
  assert.equal(data.dataLoading, true);
  contents[hub] = census(['data/new.csv', 2, 1, 20, '["fresh"]']);
  document.dispatchEvent(new window.CustomEvent('web-tools:configs-refreshed'));
  await settled();
  assert.equal(data.dataCensus[0].files[1].path, 'data/new.csv');
  finishOld({ text: census(['data/old.csv', 1, 1, 10, '["old"]']) });
  await oldRead;
  assert.equal(data.dataCensus[0].files[1].path, 'data/new.csv', 'old completion cannot overwrite the refresh');
});

test('a hidden Data tab invalidates on config refresh and reads again on arrival', async () => {
  data.setTab('set');
  const before = asked.length;
  delete manifests['mehrlander/new'];
  document.dispatchEvent(new window.CustomEvent('web-tools:configs-refreshed'));
  await tick();
  assert.equal(data.dataCensus, null);
  assert.equal(asked.length, before, 'a hidden inventory remains lazy');
  data.setTab('data');
  await settled();
  assert.ok(!data.dataCensus.some(s => s.repo === 'mehrlander/new'));
});

test('auth removal clears estate rows and component teardown removes the refresh listener', async () => {
  window.TOKEN = '';
  window.__shell._authState = 'public';
  await settled();
  assert.deepEqual([...data.dataCensus.map(s => s.repo)], [hub]);
  Alpine.destroyTree(el);
  const before = asked.length;
  document.dispatchEvent(new window.CustomEvent('web-tools:configs-refreshed'));
  await tick();
  assert.equal(asked.length, before);
  assert.deepEqual(problems, []);
});
