// Captured dependencies and process costs retain their own revision and venue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, until, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const { window, problems } = makeWindow({ html: '<div id="map" x-data="map()"></div>' });
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
window.__shell = Alpine.reactive({ mapTab: 'tests', ref: 'codex/observations', _authState: 'public',
  hasToken(){ return this._authState === 'auth'; } });
window.history.replaceState({}, '', '?view=map&tab=tests&use=codex/observations');
window.TOKEN = '';
const hub = 'mehrlander/web-tools', registry = 'mehrlander/web-tools-private';
const a = 'node/test/a.test.mjs', b = 'node/test/b.test.mjs', gate = 'node/test/gate.test.mjs';
const opaque = 'node/test/opaque.test.mjs', fresh = 'node/test/fresh.test.mjs';
const testPaths = [a, b, gate, opaque, fresh];
const observed = (file, extra = {}) => ({ path: file, elapsed_ms: null, complete: true, exit_code: 0,
  files: [file], directories: [], missing: [], opaque: [], ...extra });
const reach = { schema: 'web-tools-test-run/1', source: { repo: hub, checkout_sha: 'a'.repeat(40), dirty: false },
  runtime: { platform: 'linux', arch: 'x64', node: '22.24.0', concurrency: 3 },
  mode: 'full', complete: true, exit_code: 0, finished_at: '2026-11-23T12:00:00Z',
  tests: [observed(a, { files: [a, 'lib/a.js'], directories: ['plugins'], missing: ['optional/feature.json'] }),
    observed(b, { files: [b, 'lib/b.js'] }), observed(gate), observed(opaque, { opaque: ['spawn: python3 <b>untracked</b>'] })] };
const capturePath = 'data/tests/runs/2026-11/123-2.json';
const cost = { ...reach, source: { repo: hub, checkout_sha: 'b'.repeat(40), dirty: true },
  runtime: { platform: 'win32', arch: 'arm64', node: '24.22.3', concurrency: 1 },
  mode: 'selected', complete: false, exit_code: 1, wall_ms: 5000, sum_process_wall_ms: 10000,
  tests: [observed(a, { elapsed_ms: 1200, complete: false, exit_code: 1 })] };
let publicPayload = reach, latestPath = capturePath, failPrivate = false, heldPublic = null, heldPrivate = null;
const asked = [];
window.GH = class {
  static FRESH = { cache: 'no-store' };
  static refFor(repo){ return repo === hub ? window.__shell.ref : 'main'; }
  constructor(options){ this.options = options; }
  async get(file){
    asked.push({ ...this.options, file });
    if (file === 'data/tests/reach.json') {
      if (heldPublic) { const pending = heldPublic; heldPublic = null; return pending; }
      return { text: JSON.stringify(publicPayload) };
    }
    if (file === 'data/tests/latest.json') {
      if (failPrivate) throw new Error('Private run not captured yet');
      return { text: JSON.stringify({ schema: 'web-tools-test-measures/1', record: latestPath }) };
    }
    if (file === capturePath) {
      if (heldPrivate) { const pending = heldPrivate; heldPrivate = null; return pending; }
      return { text: JSON.stringify(cost) };
    }
    if (file === 'state/configs.json') return { text: '{"repos":{}}' };
    if (file === '.web-tools.json') return { text: '{"checking":{"execution":[]}}' };
    if (file === 'docs/tests.csv') return { text: 'path,test_count,method,runner,boot_smoke,test_names\n' +
      testPaths.map(p => `${p},1,pure,suite,,case`).join('\n') };
    if (file === 'docs/tests-authored.csv') return { text: 'path,kind,protects\n' +
      testPaths.map(p => `${p},${p === gate ? 'gate' : 'behavior'},<b>Protection</b>`).join('\n') };
    if (file === 'data/checks-reading/explanations.csv') throw new Error('No comparison fixture');
    return { text: readFileSync(path.join(repoRoot, file), 'utf8') };
  }
};
for (const file of ['lib/kits/repo-address.js', 'lib/kits/csv.js', 'lib/vanilla-bundle.js', 'lib/alpineComponents/map.js'])
  new window.Function(readFileSync(path.join(repoRoot, file), 'utf8'))();
Alpine.start();
const el = window.document.getElementById('map'), data = Alpine.$data(el);
const panel = () => el.querySelector('[data-test-observations]');
async function settled(){
  await tick(2);
  await until(() => !data.testObservationLoading && !!data.testsReg, 'test observations load', 5000);
  await tick(2);
}
await settled();

test('public observations name their captured source without presenting process costs as known', () => {
  assert.deepEqual(problems, []);
  assert.equal(data.testReach.source.checkout_sha, 'a'.repeat(40));
  assert.match(panel().querySelector('[data-test-reach-stamp]').textContent, /Observed source aaaaaaaaaaaa/);
  assert.match(panel().textContent, /Last observed cost: Unknown/);
  assert.equal(panel().querySelector('b'), null);
  assert.ok(!asked.some(row => row.file === 'data/tests/latest.json'));
  assert.ok(asked.filter(row => row.file === 'data/tests/reach.json').every(row => row.ref === 'codex/observations'));
  assert.ok(data.testObservedFileUrl(data.testObservationRows[0]).includes('/' + 'a'.repeat(40) + '/'));
});

test('reverse lookup includes readers, gates, opaque tests and tests without observations', async () => {
  for (const query of ['lib/a.js', 'plugins/new.js', 'optional/feature.json']) {
    data.testObservationPath = query; await tick(2);
    assert.deepEqual([...data.testObservationRows.map(row => row.path)], [a, gate, opaque, fresh]);
    assert.equal(data.testObservationUnknownPath, false);
    assert.equal(panel().querySelectorAll('[data-test-observed-row]').length, 4);
  }
  data.testObservationPath = 'lib/unobserved.js'; await tick(2);
  assert.equal(data.testObservationUnknownPath, true);
  assert.deepEqual([...data.testObservationRows.map(row => row.path)], [gate, opaque, fresh]);
  data.testObservationPath = '';
});

test('last observed costs retain failed, selected and incomplete status at their actual venue and source', async () => {
  window.TOKEN = 'fixture'; window.__shell._authState = 'auth'; await settled();
  assert.equal(data.testObservedRun.source.checkout_sha, 'b'.repeat(40));
  const summary = panel().querySelector('[data-test-observed-cost]').textContent;
  assert.match(summary, /Selected run.*observations incomplete.*exit 1/);
  assert.match(summary, /win32\/arm64.*Node 24\.22\.3/);
  assert.match(summary, /Suite wall\s*5\.00 s/);
  assert.match(summary, /Accumulated process elapsed\s*10\.00 s/);
  assert.equal(data.testObservationRows.find(row => row.path === a).cost_ms, 1200);
  assert.equal(data.testObservationRows.find(row => row.path === b).cost_ms, null);
  assert.ok(asked.filter(row => row.file === 'data/tests/latest.json' || row.file === capturePath)
    .every(row => row.repo === registry && row.ref === 'background'));
});

test('private absence and invalid pointers leave public reach available without requesting an unsafe path', async () => {
  failPrivate = true; await data.loadTestObservations(true); await tick(2);
  assert.match(data.testObservationPrivateError, /not captured yet/);
  assert.equal(data.testReach.source.checkout_sha, 'a'.repeat(40));
  assert.equal(data.testObservedRun, null);
  failPrivate = false; latestPath = '../secret'; await data.loadTestObservations(true);
  assert.match(data.testObservationPrivateError, /Invalid captured-run pointer/);
  assert.ok(!asked.some(row => row.file === '../secret'));
  latestPath = capturePath;
});

test('sign-out clears private costs on another tab and a late response cannot restore them', async () => {
  let release;
  heldPrivate = new Promise(resolve => { release = resolve; });
  const old = data.loadTestObservations(true); await tick(3);
  await until(() => asked.at(-1)?.file === capturePath, 'private capture starts', 5000);
  data.setTab('harness'); window.TOKEN = ''; window.__shell._authState = 'public'; await tick(3);
  assert.equal(data.testObservedRun, null);
  assert.equal(data.testObservedRecord, '');
  release({ text: JSON.stringify(cost) }); await old;
  assert.equal(data.testObservedRun, null);
  data.setTab('tests'); await settled();
});

test('a late public response cannot replace observations for the newly selected revision', async () => {
  let release;
  heldPublic = new Promise(resolve => { release = resolve; });
  const old = data.loadTestObservations(true); await tick(2);
  publicPayload = { ...reach, source: { ...reach.source, checkout_sha: 'c'.repeat(40) } };
  window.__shell.ref = 'codex/new-observations'; await settled();
  assert.equal(data.testReach.source.checkout_sha, 'c'.repeat(40));
  release({ text: JSON.stringify(reach) }); await old;
  assert.equal(data.testReach.source.checkout_sha, 'c'.repeat(40));
  assert.deepEqual(problems, []);
});

test('an incomplete initial baseline stays visible as pending and malformed dependency paths are nonfatal', async () => {
  publicPayload = { schema: 'web-tools-test-run/1', source: { checkout_sha: null }, runtime: {},
    mode: 'full', complete: false, exit_code: null, tests: [] };
  await data.loadTestObservations(true); await tick(2);
  assert.match(panel().textContent, /Awaiting first observed full run/);
  publicPayload = { ...reach, tests: [observed(a, { files: ['../outside'] })] };
  await data.loadTestObservations(true);
  assert.match(data.testObservationError, /Invalid test dependency/);
  assert.equal(data.testReach, null);
  assert.ok(data.testsReg.tests.length);
  assert.deepEqual(problems, []);
});
