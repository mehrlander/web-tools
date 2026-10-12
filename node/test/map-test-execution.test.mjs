// Workflow-backed explanations preserve source revisions and private visibility.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const { window, problems } = makeWindow({ html: '<div id="map" x-data="map()"></div>' });
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
window.jsyaml = yaml;
window.__shell = Alpine.reactive({ mapTab: 'tests', _authState: 'public', hasToken(){ return this._authState === 'auth'; } });
window.history.replaceState({}, '', '?view=map&tab=tests&use=codex/tests-preview');
window.TOKEN = '';
const hub = 'mehrlander/web-tools', member = 'example/member';
const declaration = { workflow: '.github/workflows/check.yml', job: 'verify', step: 'Check', purpose: '<b>Protect the records</b>', limits: 'Only the named checks.', checks: [{ path: 'tools/check.py', purpose: 'Retain cited records.' }] };
const config = { [hub]: { checking: { execution: [declaration] } }, [member]: { estate: true, checking: { execution: [declaration] } } };
let memberRef = 'main', heldWorkflow, failMember = false;
const asked = [];
const workflow = `name: Records
on:
  pull_request:
    paths: ['data/**']
  workflow_dispatch:
jobs:
  verify:
    runs-on: windows-latest
    if: github.event_name != 'push'
    steps:
      - name: Check
        run: |
          python tools/check.py
        if: success()
`;
window.GH = class {
  static FRESH = { cache: 'no-store' };
  static refFor(repo){ return repo === member ? memberRef : 'codex/tests-preview'; }
  constructor(opts){ this.opts = opts; }
  async get(file){
    asked.push({ ...this.opts, file });
    if (file === '.web-tools.json') return { text: JSON.stringify(config[this.opts.repo]) };
    if (file === 'state/configs.json') return { text: JSON.stringify({ repos: Object.fromEntries(Object.entries(config).map(([repo, c]) => [repo, { config: c }])) }) };
    if (file === declaration.workflow) {
      if (this.opts.repo === hub && heldWorkflow) { const pending = heldWorkflow; heldWorkflow = null; return pending; }
      if (this.opts.repo === member && failMember) throw new Error('Workflow temporarily unavailable');
      return { text: workflow };
    }
    return { text: readFileSync(path.join(repoRoot, file), 'utf8') };
  }
};
for (const file of ['lib/kits/csv.js', 'lib/vanilla-bundle.js', 'lib/alpineComponents/map.js'])
  new window.Function(readFileSync(path.join(repoRoot, file), 'utf8'))();
Alpine.start();
const el = window.document.getElementById('map'), data = Alpine.$data(el);
async function settled(){
  await tick(2);
  for (let i = 0; data.testExecutionLoading && i < 30; i++) await tick();
  assert.equal(data.testExecutionLoading, false);
  await tick();
}
await settled();

test('workflow facts come from YAML at the selected public revision', () => {
  assert.deepEqual(problems, []);
  const group = data.testExecutionGroups[0], row = group.runs[0];
  assert.equal(group.ref, 'codex/tests-preview');
  assert.equal(row.command, 'python tools/check.py');
  assert.equal(row.machine, 'GitHub-hosted machine: windows-latest');
  assert.equal(row.triggers, 'pull_request, workflow_dispatch');
  assert.match(row.conditions, /data\/\*\*/);
  assert.match(row.conditions, /job: github.event_name/);
  assert.match(row.conditions, /step: success/);
  assert.equal(el.querySelector('[data-test-execution] b'), null);
  assert.ok(!asked.some(a => a.file === 'state/configs.json'));
  assert.ok(asked.filter(a => a.file === declaration.workflow).every(a => a.ref === group.ref));
});

test('runner expressions and self-hosted labels are not presented as GitHub machines', () => {
  const doc = yaml.load(workflow);
  doc.jobs.verify['runs-on'] = ['self-hosted', 'windows'];
  assert.equal(data.executionRow(declaration, doc).machine, 'Self-hosted runner: self-hosted, windows');
  doc.jobs.verify['runs-on'] = '${{ matrix.os }}';
  assert.equal(data.executionRow(declaration, doc).machine, 'Workflow runner: ${{ matrix.os }}');
});

test('missing or duplicate steps and invalid source paths fail visibly', () => {
  const doc = yaml.load(workflow);
  assert.throws(() => data.executionRow({ ...declaration, job: 'gone' }, doc), /job not found/);
  assert.throws(() => data.executionRow({ ...declaration, step: 'gone' }, doc), /step not found/);
  doc.jobs.verify.steps.push(doc.jobs.verify.steps[0]);
  assert.throws(() => data.executionRow(declaration, doc), /ambiguous/);
  for (const workflow of ['../check.yml', 'https://example.com/check.yml', '.github/workflows/../check.yml'])
    assert.throws(() => data.executionRow({ ...declaration, workflow }, doc), /Invalid/);
});

test('authentication and selection read a member declaration and workflow at the same revision', async () => {
  memberRef = 'codex/member-preview';
  window.TOKEN = 'fixture'; window.__shell._authState = 'auth';
  await settled();
  assert.equal(data.testExecutionGroups.length, 2);
  assert.ok(asked.some(a => a.repo === member && a.file === '.web-tools.json' && a.ref === memberRef));
  assert.ok(asked.some(a => a.repo === member && a.file === declaration.workflow && a.ref === memberRef));
  assert.ok(asked.filter(a => a.file === 'state/configs.json').every(a => a.repo === 'mehrlander/web-tools-private' && a.ref === 'main'));
  assert.match(data.executionFileUrl(data.testExecutionGroups[1], 'tools/check.py'), /codex%2Fmember-preview/);
});

test('a failed workflow keeps the source link and refresh recovers without stale success', async () => {
  failMember = true; await data.loadTestExecution(true);
  assert.match(data.testExecutionError, /temporarily unavailable/);
  const row = data.testExecutionGroups[1].runs[0];
  assert.ok(row.error);
  assert.equal(row.command, undefined);
  assert.equal(row.workflow, declaration.workflow);
  failMember = false; await data.loadTestExecution();
  assert.equal(data.testExecutionError, '');
  assert.equal(data.testExecutionGroups[1].runs[0].command, 'python tools/check.py');
});

test('sign-out clears private rows on another tab and invalidates an older response', async () => {
  let release;
  heldWorkflow = new Promise(resolve => { release = resolve; });
  const old = data.loadTestExecution(true);
  await tick(2);
  data.setTab('harness');
  window.TOKEN = ''; window.__shell._authState = 'public';
  await tick(3);
  assert.equal(data.testExecutionGroups.length, 0);
  release({ text: workflow }); await old;
  assert.equal(data.testExecutionGroups.length, 0);
  data.setTab('tests'); await settled();
  assert.deepEqual([...data.testExecutionGroups.map(g => g.repo)], [hub]);
  assert.deepEqual(problems, []);
});

test('committed Web Tools execution declarations resolve to real workflow commands', () => {
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, '.web-tools.json'), 'utf8'));
  for (const d of manifest.checking.execution) {
    const row = data.executionRow(d, yaml.load(readFileSync(path.join(repoRoot, d.workflow), 'utf8')));
    assert.ok(row.command.length);
  }
});
