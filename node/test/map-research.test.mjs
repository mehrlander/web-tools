// Projects and research share repository declarations, including auth and refresh.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';
import { marked } from 'marked';

const { window, problems } = makeWindow({ html: '<div id="map" x-data="map()"></div>' });
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
window.__shell = Alpine.reactive({ mapTab: 'research', _authState: 'public',
  hasToken(){ return this._authState === 'auth'; } });
window.history.replaceState({}, '', '?view=map&tab=research&use=codex/research-preview');
window.TOKEN = '';
window.marked = marked;
const hub = 'mehrlander/web-tools', home = 'mehrlander/home';
const account = (path, label, kind = 'probe') => ({ path, label, kind });
const manifests = {
  [hub]: { research: [account('research/excel/README.md', 'Excel findings')], tracker: 'tracker/board.md',
    programs: [{ name: 'surfacing', label: 'Surfacing', icon: 'ph-megaphone', path: 'programs/surfacing',
      governs: ['docs/CONVERSATION.md', 'python/showing.py'], measures: ['owner/private@background:state/closings.json'],
      reviewers: ['portable:owner-proxy'], views: ['?view=map&tab=showing'] }, { label: 'unnamed' }] },
  [home]: { estate: true, projects: [
    { path: 'projects/text', label: 'Text', tracker: false },
    { path: 'projects/text/nested', label: 'Nested', tracker: 'boards/text.md' },
    'projects/budget',
  ], research: [
    { ...account('projects/text/probes/README.md', 'Text findings'), status: 'measured' },
    account('projects/text/nested/research/README.md', 'Nested findings'),
    account('projects/budget/research/reports/README.md', 'Outside reports', 'exploration'),
    account('projects/text/studies/README.md', '<b>A study</b>'),
  ] },
  'mehrlander/outside': { estate: false, research: [account('research/README.md', 'Excluded')] },
  'mehrlander/gone': null,
};
// A program page's reads: the commits that touched each governed path (one
// shared by both, so the page joins them by sha), and the notes store.
const commit = (sha, date, message) => ({ sha, html_url: 'https://github.com/' + hub + '/commit/' + sha,
  commit: { message, committer: { date } } });
const commits = {
  'docs/CONVERSATION.md': [commit('c3c3c3c3c3', '2026-11-10T12:00:00Z', 'Both files at once\n\nBody'), commit('c1c1c1c1c1', '2026-11-01T12:00:00Z', 'The oldest')],
  'python/showing.py': [commit('c3c3c3c3c3', '2026-11-10T12:00:00Z', 'Both files at once\n\nBody'), commit('c2c2c2c2c2', '2026-11-05T12:00:00Z', 'The middle one')],
};
const charterAbout = hub + ':programs/surfacing/README.md';
// A charter whose Areas table the page lists: links resolve from the charter's
// folder, code stays code, and the table under Measures is not read.
const charterMd = ['# Surfacing', '', 'The charter, *rendered*.', '', '## Areas', '',
  '| Area | Covers |', '| --- | --- |',
  '| Reply | what a reply hands over, in [`CONVERSATION.md`](../../docs/CONVERSATION.md) |',
  '| Showing | the link, from `showing.py` and the [Map](https://example.com/?view=map) |', '',
  '## Measures', '', '| Area | Measure |', '| --- | --- |', '| Reply | closings |', ''].join('\n');
const notes = [
  { id: 'n1', at: '2026-11-02T10:00:00Z', author: 'owner', about: charterAbout, text: 'The first note' },
  { id: 'n2', at: '2026-11-03T10:00:00Z', author: 'claude', about: charterAbout + '#scope', text: 'On a section' },
  { id: 'n3', at: '2026-11-04T10:00:00Z', author: 'owner', about: 'note:n1', text: 'A reply' },
  { id: 'n4', at: '2026-11-05T10:00:00Z', author: 'owner', about: hub + ':docs/APP.md', text: 'Another file' },
];
const asked = [], failures = new Set();
let heldHub, homeRef = 'main';
window.GH = class {
  static FRESH = { cache: 'no-store' };
  static refFor(repo){ return repo === home ? homeRef : repo === hub ? 'codex/research-preview' : 'main'; }
  constructor(opts){ this.opts = opts; }
  async req(url){
    asked.push({ ...this.opts, file: url });
    if (url.startsWith('commits?')) return commits[new URLSearchParams(url.slice(8)).get('path')] || [];
    const paths = this.opts.repo === home ? ['projects/text/probes/README.md', 'projects/text/probes/probes.csv',
      'projects/text/probes/view.html', 'projects/text/probes/run.py', 'projects/text/other.md'] : [];
    return { tree: paths.map(path => ({ path, type: 'blob' })) };
  }
  async get(file, opts){
    asked.push({ ...this.opts, file, cache: opts?.cache });
    if (file === '.web-tools.json') {
      if (this.opts.repo === hub && heldHub) { const pending = heldHub; heldHub = null; return pending; }
      if (failures.has(this.opts.repo)) throw new Error('Temporary failure');
      return { text: JSON.stringify(manifests[this.opts.repo]) };
    }
    if (file === 'boards/text.csv') return { text: 'id,title,status\na,A,backlog\nb,B,in-progress\nc,C,blocked\nd,D,done\n' };
    if (file === 'tracker/board.csv' && this.opts.repo === hub)
      return { text: 'id,title,status,project,href\na,A,backlog,surfacing,tasks/a.md\nb,B,done,surfacing,tasks/b.md\n'
        + 'c,C,in-progress,app,tasks/c.md\ne,Draft the page,in-progress,surfacing,tasks/e.md\n' };
    if (file === 'programs/surfacing/README.md') return { text: charterMd };
    if (file === 'programs/plain/README.md') return { text: '# Plain\n\nA charter with [no areas](../../docs/APP.md).\n\n## Measures\n\n| A | B |\n| --- | --- |\n| x | y |\n' };
    if (file === 'notes/notes.jsonl' && this.opts.repo === 'mehrlander/web-tools-private')
      return { text: notes.map(n => JSON.stringify(n)).join('\n') + '\n' };
    if (file === 'state/configs.json') return { text: JSON.stringify({ repos:
      Object.fromEntries(Object.entries({ ...manifests, [hub]: { research: [] } })
        .map(([repo, config]) => [repo, { config }])) }) };
    return { text: readFileSync(path.join(repoRoot, file), 'utf8') };
  }
};
// program.js carries window.Programs, the reading of a program declaration the
// Map's Programs list shares with the Program view.
for (const file of ['lib/kits/repo-address.js', 'lib/kits/csv.js', 'lib/vanilla-bundle.js',
  'lib/alpineComponents/program.js', 'lib/alpineComponents/map.js'])
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

test('a folder account lists the files beside its write-up by kind', async () => {
  await data.loadResearchTrees();
  const text = data.researchAccounts.find(r => r.label === 'Text findings');
  assert.deepEqual([...data.researchParts(text).map(p => p.key + ':' + p.files.length)], ['pages:1', 'data:1', 'scripts:1']);
  assert.deepEqual([...data.researchParts(data.researchAccounts.find(r => r.label === 'Excel findings'))], []);
  assert.equal(data.researchDate({ path: 'research/2026-11-16-x/README.md' }), '2026-11-16');
});

test('a declared status rides on the account, and an unknown one invalidates it', () => {
  assert.equal(data.researchAccounts.find(r => r.label === 'Text findings').status, 'measured');
  const entry = { path: 'research/x.md', label: 'X', kind: 'probe' };
  assert.ok(data.validResearchEntry(entry));
  for (const status of ['living', 'measured', 'record']) assert.ok(data.validResearchEntry({ ...entry, status }));
  assert.ok(!data.validResearchEntry({ ...entry, status: 'closed' }));
  for (const lifecycle of ['planned', 'active', 'maintained', 'revising']) assert.ok(data.validResearchEntry({ ...entry, lifecycle }));
  assert.ok(!data.validResearchEntry({ ...entry, lifecycle: 'finished' }));
});

test('a repository on the registry hidden list leaves research, its strip and projects', async () => {
  window.__shell.estateHidden = [home];
  try {
    await tick();
    assert.deepEqual([...data.workSources.map(s => s.repo)], [hub, home], 'the read is unchanged');
    assert.deepEqual([...data.researchAccounts.map(r => r.repo)], [hub]);
    assert.ok(!data.researchRepoItems.some(i => i.key === home));
    assert.ok(!data.workProjectGroups.some(g => g.repo === home));
  } finally { window.__shell.estateHidden = []; }
  await tick();
  assert.equal(data.researchAccounts.length, 5);
});

test('project research chooses the populated tab and filters without moving files', () => {
  data.showProjectResearch(data.workProjectGroups.find(g => g.repo === home).projects[2]);
  assert.equal(data.mapTab, 'exploration');
  assert.deepEqual([...data.researchRows.map(r => r.label)], ['Outside reports']);
  data.researchQ = 'absent'; assert.equal(data.researchRows.length, 0);
  data.researchQ = ''; data.researchProject = ''; data.researchRepo = ''; data.setTab('research');
});

test('Projects lists each repository as a workspace with its projects on shared columns', async () => {
  const rows = data.workRows, at = key => rows.find(r => r.key === key);
  assert.deepEqual([...rows.map(r => r.kind)], ['repo', 'repo', 'project', 'project', 'project']);
  assert.equal(at(hub).research, 1, 'a repository counts research filed under no project');
  assert.equal(at(home).research, 0);
  assert.equal(at(home + ':projects/text').research, 2);
  const nested = at(home + ':projects/text/nested');
  data.workTasks(nested); await tick(3);
  const { deck, doing, blocked } = data.workTasks(nested);
  assert.deepEqual({ deck, doing, blocked }, { deck: 1, doing: 1, blocked: 1 }, 'done tasks are not open');
  assert.equal(data.workTaskLine(nested), '1 in progress · 1 on deck · 1 blocked');
  assert.equal(data.workTasks(at(home + ':projects/budget')), null, 'an unreadable board stays a dash');
  assert.equal(data.workTasks(at(home + ':projects/text')), null, 'tracker: false has no board');
  data.workQ = 'nested';
  assert.deepEqual([...data.workRows.map(r => r.key)], [home, home + ':projects/text/nested'], 'a match keeps its repository as heading');
  data.workQ = '';
});

test('a repository row opens the research filed under no project', () => {
  data.showProjectResearch(data.workRows.find(r => r.key === hub));
  assert.equal(data.researchProject, '.');
  assert.deepEqual([...data.researchRows.map(r => r.label)], ['Excel findings']);
  data.researchProject = ''; data.researchRepo = ''; data.setTab('research');
});

test('Programs lists each declaration on shared columns, with its open tasks from the tracker', async () => {
  const rows = data.programRows;
  assert.deepEqual([...rows.map(p => p.key)], [hub + ':surfacing'], 'a program without a name is not a row');
  const p = rows[0];
  assert.equal(p.governs.length, 2);
  data.programTasks(p); await tick(3);
  assert.equal(data.programTasks(p), 2, 'open rows whose project is the program');
  assert.equal(data.measureName(p.measures[0]), 'closings.json');
  assert.equal(data.programViewLabel(p.views[0]), 'Showing');
  data.openProgramView(p.views[0]);
  assert.equal(data.mapTab, 'showing');
  data.setTab('research');
});

// A program's page is the Program view since 2026-11-18 (program-view.test.mjs
// holds the page). The list opens it: a title on its first tab, a measure's
// name on Measures. A row is its title, one row of flair (an icon and a count
// each) and its views; a list among the flair opens in the chart panel-tip
// rather than under the row.
test("a program's title opens the Program view, and a measure's name opens it on Measures", async () => {
  const opened = [];
  window.__shell.goProgram = (name, tab) => opened.push([name, tab]);
  const tip = () => el.querySelector('[data-map-chart-tip]');
  try {
    data.setTab('programs'); await settled();
    const row = el.querySelector('[data-map-programs] [data-map-program="surfacing"]');
    row.querySelector('[data-map-program-open]').click();
    assert.deepEqual(opened.at(-1), ['surfacing', undefined]);
    const flair = [...row.querySelectorAll('[data-map-program-flair]')];
    assert.deepEqual(flair.map(f => f.dataset.mapProgramFlair), ['governs', 'tasks', 'measures', 'reviewers'], 'one row, in one order');
    assert.deepEqual(flair.map(f => f.textContent.trim()), ['2', '2', '1', ''], 'counts, the reviewers by their icons');
    assert.equal(row.querySelector('[data-map-program-measure]'), null, 'no list sits in the row');

    row.querySelector('[data-map-program-flair="measures"]').click(); await settled();
    assert.equal(data.chartTip?.key, 'measures:' + hub + ':surfacing');
    assert.equal(data.chartTip.pinned, true, 'a tap pins it');
    tip().querySelector('[data-chart-tip-link="measure:owner/private@background:state/closings.json"]').click();
    assert.deepEqual(opened.at(-1), ['surfacing', 'measures']);
    assert.equal(data.chartTip, null, 'following a link closes the panel-tip');

    row.querySelector('[data-map-program-flair="governs"]').click(); await settled();
    assert.deepEqual([...tip().querySelectorAll('[x-blob]')].slice(1).map(a => a.textContent), ['CONVERSATION.md', 'showing.py'],
      'the governed paths, by folder, each its own link');
    assert.deepEqual([...data.chartTip.body.groups.map(g => g.dir)], ['docs/', 'python/']);
    row.querySelector('[data-map-program-flair="governs"]').click(); await settled();
    assert.equal(data.chartTip, null, 'its own flair closes it again');

    row.querySelector('[data-map-program-flair="reviewers"]').click(); await settled();
    assert.deepEqual([...data.chartTip.body.links.map(l => l.label)], ['owner-proxy']);
    data.closeChartTip();

    const views = row.querySelector('[data-map-program-views]');
    assert.match(views.className, /overflow-x-auto/, 'the views run on one line that scrolls sideways');
    assert.match(views.className, /flex-nowrap/);
    assert.equal(el.querySelector('[data-map-program-page]'), null, 'the Map draws no page of its own');
    assert.equal(el.querySelector('[data-map-programs] [data-program-measures]'), null, 'nor any measure charts');
    assert.notEqual(el.querySelector('[data-map-programs]').style.display, 'none', 'the list stays');
  } finally { delete window.__shell.goProgram; data.closeChartTip(); data.setTab('research'); }
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

// The Icons tab reads the declarations for its Projects and Programs families
// without being one of the tabs above, so a refresh must re-read what was asked
// for rather than what the open tab needs.
test('a config refresh re-reads declarations asked for from any tab', async () => {
  data.setTab('harness');
  await data.loadWorkDeclarations(true);
  window.document.dispatchEvent(new window.Event('web-tools:configs-refreshed'));
  await settled();
  assert.equal(data.workLoading, false);
  assert.ok(data.workSources?.some(s => s.repo === home), 'the private repository is read again');
});

test('signing out removes private research even while another tab is open', async () => {
  data.setTab('harness');
  window.TOKEN = ''; window.__shell._authState = 'public';
  await settled();
  assert.deepEqual([...data.workSources.map(s => s.repo)], [hub]);
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
