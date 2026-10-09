// Projects and research share repository declarations, including auth and refresh.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const { window, problems } = makeWindow({ html: '<div id="map" x-data="map()"></div>' });
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
window.__shell = Alpine.reactive({ mapTab: 'research', _authState: 'public',
  hasToken(){ return this._authState === 'auth'; } });
window.history.replaceState({}, '', '?view=map&tab=research&use=codex/research-preview');
window.TOKEN = '';
const hub = 'mehrlander/web-tools', home = 'mehrlander/home';
const account = (path, label, kind = 'probe') => ({ path, label, kind });
const manifests = {
  [hub]: { research: [account('research/excel/README.md', 'Excel findings')] },
  [home]: { estate: true, projects: [
    { path: 'projects/text', label: 'Text', tracker: false },
    { path: 'projects/text/nested', label: 'Nested', tracker: 'boards/text.md' },
    'projects/budget',
  ], research: [
    account('projects/text/probes/README.md', 'Text findings'),
    account('projects/text/nested/research/README.md', 'Nested findings'),
    account('projects/budget/research/reports/README.md', 'Outside reports', 'exploration'),
    account('projects/text/studies/README.md', '<b>A study</b>'),
  ] },
  'mehrlander/outside': { estate: false, research: [account('research/README.md', 'Excluded')] },
  'mehrlander/gone': null,
};
const asked = [], failures = new Set();
let heldHub, homeRef = 'main';
window.GH = class {
  static FRESH = { cache: 'no-store' };
  static refFor(repo){ return repo === home ? homeRef : repo === hub ? 'codex/research-preview' : 'main'; }
  constructor(opts){ this.opts = opts; }
  async get(file, opts){
    asked.push({ ...this.opts, file, cache: opts?.cache });
    if (file === '.web-tools.json') {
      if (this.opts.repo === hub && heldHub) { const pending = heldHub; heldHub = null; return pending; }
      if (failures.has(this.opts.repo)) throw new Error('Temporary failure');
      return { text: JSON.stringify(manifests[this.opts.repo]) };
    }
    if (file === 'state/configs.json') return { text: JSON.stringify({ repos:
      Object.fromEntries(Object.entries({ ...manifests, [hub]: { research: [] } })
        .map(([repo, config]) => [repo, { config }])) }) };
    return { text: readFileSync(path.join(repoRoot, file), 'utf8') };
  }
};
for (const file of ['lib/kits/csv.js', 'lib/vanilla-bundle.js', 'lib/alpineComponents/map.js'])
  new window.Function(readFileSync(path.join(repoRoot, file), 'utf8'))();
Alpine.start();
const el = window.document.getElementById('map'), data = Alpine.$data(el);
async function settled(){
  await tick(3);
  for (let i = 0; data.workLoading && i < 30; i++) await tick();
  assert.equal(data.workLoading, false);
  await tick();
}
await settled();

test('public deep link reads the selected hub revision without private requests', () => {
  assert.deepEqual(problems, []);
  assert.equal(data.researchRows.length, 1);
  assert.equal(data.researchRows[0].ref, 'codex/research-preview');
  assert.ok(!asked.some(a => a.file === 'state/configs.json'));
  assert.match(el.querySelector('[data-map-research]').textContent, /Excel findings/);
});

test('auth arrival includes declared member research and preserves the live hub', async () => {
  window.TOKEN = 'fixture-token'; window.__shell._authState = 'auth';
  await settled();
  assert.deepEqual([...data.workSources.map(s => s.repo)], [hub, home]);
  assert.equal(data.researchAccounts.length, 5);
  assert.equal(data.researchAccounts[0].label, 'Excel findings');
  assert.ok(asked.filter(a => a.file === 'state/configs.json').every(a =>
    a.repo === 'mehrlander/web-tools-private' && a.ref === 'main' && a.cache === 'no-store'));
  assert.equal(el.querySelector('[data-map-research] b'), null, 'labels render as text');
});

test('projects may omit a tracker, and research belongs to the nearest project', () => {
  const group = data.workProjectGroups.find(g => g.repo === home);
  assert.equal(group.projects[0].tracker, '');
  assert.equal(group.projects[0].researchCount, 2);
  assert.equal(group.projects[1].tracker, 'boards/text.md');
  assert.equal(group.projects[1].researchCount, 1);
  assert.equal(group.projects[2].tracker, 'projects/budget/tracker/board.md');
  const url = new URL(data.workTrackerUrl(group.projects[1]));
  assert.equal(url.searchParams.get('project'), 'projects/text/nested');
  assert.equal(url.searchParams.get('tab'), 'board');
  assert.equal(url.searchParams.get('use'), 'codex/research-preview');
});

test('project research chooses the populated tab and filters without moving files', () => {
  data.showProjectResearch(data.workProjectGroups.find(g => g.repo === home).projects[2]);
  assert.equal(data.mapTab, 'exploration');
  assert.deepEqual([...data.researchRows.map(r => r.label)], ['Outside reports']);
  data.researchQ = 'absent'; assert.equal(data.researchRows.length, 0);
  data.researchQ = ''; data.researchProject = ''; data.researchRepo = ''; data.setTab('research');
});

test('Docs omits research folders and declared studies while keeping neighboring documents', () => {
  assert.equal(data.isResearchDocument(home, 'projects/text/probes/run.md'), true);
  assert.equal(data.isResearchDocument(home, 'projects/text/studies/results.md'), true);
  assert.equal(data.isResearchDocument(home, 'projects/text/studies-other/README.md'), false);
  assert.equal(data.isResearchDocument(home, 'projects/text/README.md'), false);
});

test('a config refresh follows a selected repo revision and reports invalid declarations', async () => {
  homeRef = 'codex/home-preview';
  manifests[home].research.push(account('../outside.md', 'Invalid'));
  window.document.dispatchEvent(new window.Event('web-tools:configs-refreshed'));
  await settled();
  assert.match(data.workError, /invalid research declaration/);
  assert.equal(data.researchAccounts.length, 5);
  assert.ok(asked.some(a => a.repo === home && a.file === '.web-tools.json' && a.ref === homeRef));
  assert.equal(data.researchAccounts.find(a => a.repo === home).ref, homeRef);
  manifests[home].research.pop();
  for (const p of ['docs/report.md', 'research/../report.md', 'C:/report.md', 'research/\\report.md', '/report.md'])
    assert.equal(data.validResearchEntry(account(p, 'Invalid')), false, p);
});

test('failed source reads remain retryable, and a slow earlier request cannot overwrite a refresh', async () => {
  failures.add(hub); await data.loadWorkDeclarations(true);
  assert.match(data.workError, /Web Tools declarations unavailable/);
  failures.delete(hub); await data.loadWorkDeclarations();
  assert.equal(data.workError, '');
  let release;
  heldHub = new Promise(resolve => { release = resolve; });
  const older = data.loadWorkDeclarations(true);
  await data.refreshWorkDeclarations();
  release({ text: JSON.stringify({ research: [account('research/old.md', 'Obsolete')] }) });
  await older;
  assert.equal(data.researchAccounts[0].label, 'Excel findings');
});

test('signing out removes private research even while another tab is open', async () => {
  data.setTab('harness');
  window.TOKEN = ''; window.__shell._authState = 'public';
  await tick(3);
  assert.equal(data.workSources, null);
  data.setTab('research'); await settled();
  assert.deepEqual([...data.workSources.map(s => s.repo)], [hub]);
  assert.deepEqual(problems, []);
});

test('the published hub accounts exist outside docs', () => {
  const config = JSON.parse(readFileSync(path.join(repoRoot, '.web-tools.json'), 'utf8'));
  for (const r of config.research) {
    assert.ok(data.validResearchEntry(r), r.path);
    assert.ok(existsSync(path.join(repoRoot, r.path)), r.path);
  }
});

test('switching tab groups tolerates a reveal queued for a removed subview', () => {
  assert.doesNotThrow(() => data.revealTab(window.document.createElement('button')));
});
