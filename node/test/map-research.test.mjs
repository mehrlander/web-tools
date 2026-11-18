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
    account('projects/text/probes/README.md', 'Text findings'),
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
for (const file of ['lib/kits/repo-address.js', 'lib/kits/csv.js', 'lib/vanilla-bundle.js', 'lib/alpineComponents/map.js'])
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

test("a program's title opens its page in the tab, and Back to the list closes it", async () => {
  const stamped = [];
  window.__shell.setMapCtx = (spec, o) => stamped.push([{ ...spec }, { ...o }]);
  try {
    data.setTab('programs'); await settled();
    el.querySelector('[data-map-programs] [data-map-program="surfacing"] [data-map-program-open]').click();
    // Wait for the list to hide rather than a fixed count of ticks, which a
    // loaded CI runner can outlast.
    for (let i = 0; i < 100 && el.querySelector('[data-map-programs]').style.display !== 'none'; i++) await new Promise(r => setTimeout(r, 20));
    assert.equal(data.programSel, 'surfacing');
    assert.deepEqual(stamped.at(-1), [{ program: 'surfacing' }, { push: true }], 'opening stamps the address as a new entry');
    assert.equal(el.querySelector('[data-map-programs]').style.display, 'none', 'the page takes the list\'s place');
    const page = el.querySelector('[data-map-program-page]');
    assert.equal(page.dataset.mapProgram, 'surfacing');
    assert.match(page.querySelector('[data-part="title"]').textContent, /Surfacing/);
    assert.match(page.querySelector('[data-map-program-charter-open]').textContent, /programs\/surfacing\/README\.md/);
    el.querySelector('[data-map-program-back]').click();
    // x-show reveals a frame later (Alpine defers a show past the click).
    await tick(3); await new Promise(r => window.requestAnimationFrame(() => r()));
    assert.equal(data.programSel, '');
    assert.deepEqual(stamped.at(-1), [{ program: '' }, { push: true }]);
    assert.equal(el.querySelector('[data-map-program-page]'), null);
    assert.notEqual(el.querySelector('[data-map-programs]').style.display, 'none');
  } finally { delete window.__shell.setMapCtx; }
});

test("the list draws no measure charts; a measure's name opens the page on its Measures tab", async () => {
  window.__shell.setMapCtx = () => {};
  data.setTab('programs'); await settled();
  const row = el.querySelector('[data-map-programs] [data-map-program="surfacing"]');
  assert.equal(el.querySelector('[data-map-programs] [data-map-program-measures]'), null);
  row.querySelector('[data-map-program-measure]').click();
  await tick(3);
  assert.equal(data.programSel, 'surfacing');
  assert.equal(data.programTab, 'measures');
  data.closeProgram();
  await tick(3); await new Promise(r => window.requestAnimationFrame(() => r()));
});

test('Back and Forward on Programs open the page the address names', async () => {
  const before = window.location.search;
  window.history.replaceState({}, '', '?view=map&tab=programs&program=surfacing');
  window.dispatchEvent(new window.PopStateEvent('popstate'));
  assert.equal(data.programSel, 'surfacing');
  window.history.replaceState({}, '', '?view=map&tab=programs');
  window.dispatchEvent(new window.PopStateEvent('popstate'));
  assert.equal(data.programSel, '', 'an address naming no program is the list');
  window.history.replaceState({}, '', '?view=map&tab=docs&program=surfacing');
  window.dispatchEvent(new window.PopStateEvent('popstate'));
  assert.equal(data.programSel, '', 'the key means nothing off the Programs tab');
  window.history.replaceState({}, '', before);
});

test("a program's page opens on its charter's areas, and its tabs hold the changes, tasks and notes", async () => {
  data.setTab('programs'); await settled();
  data.programSel = 'surfacing'; data.programTab = 'areas';
  const p = data.programPage;
  for (let i = 0; i < 30 && (data.programCommitsOf(p).state !== 'ok' || data.programNotesOf(p).state !== 'ok'
    || data.programCharterOf(p).state !== 'ok'); i++) await tick();
  await tick(3);
  const page = el.querySelector('[data-map-program-page]');
  const shown = sel => page.querySelector(sel) && page.querySelector(sel).style.display !== 'none';
  // x-show reveals a frame later (Alpine defers a show past the click).
  const frame = async () => { await tick(3); await new Promise(r => window.requestAnimationFrame(() => r())); };
  const tab = async k => { page.querySelector('[data-map-program-tab="' + k + '"]').click(); await frame(); };

  assert.deepEqual([...page.querySelectorAll('[data-map-program-tab]')].map(b => b.dataset.mapProgramTab),
    ['areas', 'measures', 'changes', 'tasks', 'notes']);
  assert.equal(page.querySelector('[role="tab"][aria-selected="true"]').dataset.mapProgramTab, 'areas', 'the page opens on Areas');
  assert.ok(shown('[data-map-program-areas]'));
  for (const sel of ['[data-map-program-commits]', '[data-map-program-tasks]', '[data-map-program-notes]'])
    assert.equal(shown(sel), false, sel + ' waits for its tab');
  assert.equal(page.querySelector('[data-map-program-measures]'), null, 'the measures mount with their tab');
  assert.equal(page.querySelector('[data-map-program-charter]'), null, 'the charter no longer renders inline');

  const areas = [...page.querySelectorAll('[data-map-program-area]')];
  assert.deepEqual(areas.map(r => r.dataset.area), ['Reply', 'Showing'], 'the rows of the table under Areas only');
  const link = areas[0].querySelector('a');
  assert.equal(link.getAttribute('href'), 'https://github.com/' + hub + '/blob/codex/research-preview/docs/CONVERSATION.md',
    'a relative link resolves from the charter\'s folder');
  assert.equal(link.querySelector('code')?.textContent, 'CONVERSATION.md');
  assert.equal(areas[1].querySelector('code')?.textContent, 'showing.py', 'inline code stays code');
  assert.equal(areas[1].querySelector('a').getAttribute('href'), 'https://example.com/?view=map');

  const marks = Object.fromEntries([...page.querySelectorAll('[data-map-program-mark]')]
    .map(b => [b.dataset.mapProgramMark, b.style.display === 'none' ? null : b.textContent.trim()]));
  assert.equal(marks.tasks, '2 open');
  assert.equal(marks.changes, data.programRecent(p) + ' in 14 days');
  assert.equal(marks.notes, '2 notes');

  const views = [...page.querySelectorAll('[data-map-program-views] a')];
  assert.deepEqual(views.map(a => a.textContent.trim()), ['Showing'], 'the views ride in the header');
  assert.equal(new URL(views[0].href).searchParams.get('tab'), 'showing');

  await tab('changes');
  assert.ok(shown('[data-map-program-commits]'));
  assert.equal(shown('[data-map-program-areas]'), false);
  const shas = [...page.querySelectorAll('[data-map-program-commit]')].map(li => li.dataset.sha);
  assert.deepEqual(shas, ['c3c3c3c3c3', 'c2c2c2c2c2', 'c1c1c1c1c1'], 'joined by sha, newest first');
  const top = page.querySelector('[data-map-program-commit]');
  assert.match(top.textContent, /Both files at once/);
  assert.doesNotMatch(top.textContent, /Body/, 'the subject line only');
  assert.equal(top.querySelector('a').getAttribute('href'), 'https://github.com/' + hub + '/commit/c3c3c3c3c3');
  assert.equal(top.querySelector('a').textContent, 'c3c3c3c');
  assert.match(top.textContent, /2026-11-10/);
  assert.deepEqual([...data.programCommitsOf(p).rows[0].paths], ['docs/CONVERSATION.md', 'python/showing.py']);
  const reads = asked.filter(a => a.file.startsWith('commits?'));
  assert.ok(reads.every(a => a.repo === hub && new URLSearchParams(a.file.slice(8)).get('per_page') === '5'));

  page.querySelector('[data-map-program-mark="tasks"]').click(); await frame();
  assert.equal(data.programTab, 'tasks', 'a mark opens the tab it counts');
  assert.ok(shown('[data-map-program-tasks]'));
  assert.equal(shown('[data-map-program-commits]'), false);
  const tasks = [...page.querySelectorAll('[data-map-program-task]')];
  assert.deepEqual(tasks.map(t => t.textContent.trim()), ['Draft the page', 'A'], 'titles, in progress first');
  assert.deepEqual(tasks.map(t => t.dataset.status), ['in-progress', 'backlog']);
  assert.deepEqual([...data.programTaskRows(p).map(t => t.path)], ['tracker/tasks/e.md', 'tracker/tasks/a.md']);

  await tab('notes');
  assert.ok(shown('[data-map-program-notes]'));
  const noted = [...page.querySelectorAll('[data-map-program-note]')].map(li => li.textContent.replace(/\s+/g, ' ').trim());
  assert.equal(noted.length, 2, 'notes on the charter and its sections, not on other files or replies');
  assert.match(noted[0], /On a section/);
  assert.match(noted[1], /The first note.*1 reply/);

  await tab('measures');
  assert.ok(page.querySelector('[data-map-program-measures] [data-map-measure="closings.json"]'), 'the measures draw in their tab');

  data.closeProgram(); await tick(3);
  data.openProgram(p); await tick(3);
  assert.equal(data.programTab, 'areas', 'a page opens on Areas again');
  assert.deepEqual(problems, []);
});

test('a charter without an Areas table gives its first paragraph', async () => {
  const plain = { key: hub + ':plain', repo: hub, ref: 'codex/research-preview', name: 'plain', label: 'Plain',
    charter: 'programs/plain/README.md', measures: [], governs: [], root: { kind: 'repo', repo: hub, ref: 'codex/research-preview', tracker: '' } };
  await data.loadProgramCharter(plain);
  const c = data.programCharterOf(plain);
  assert.equal(c.state, 'ok');
  assert.deepEqual([...c.areas], [], 'a table under another heading is not the areas');
  assert.match(c.lead, /^A charter with <a href="https:\/\/github\.com\/mehrlander\/web-tools\/blob\/codex\/research-preview\/docs\/APP\.md"/);
  assert.deepEqual([...data.programTabs({ ...plain, charter: '' }).map(t => t.k)].includes('areas'), false,
    'a program without a charter has no Areas tab');
});

test("signed out, a program's page reads fewer paths and leaves out the notes", async () => {
  window.TOKEN = ''; window.__shell._authState = 'public';
  try {
    await settled();
    const p = data.programPage;
    assert.ok(p, 'the hub program stays');
    for (let i = 0; i < 30 && !(data.programCommitsOf(p).state === 'ok' && data.programCommitsOf(p).authed === false); i++) await tick();
    assert.equal(data.programCommitsOf(p).authed, false, 'a sign-out reads the changes again, unauthenticated');
    await tick();
    assert.equal(el.querySelector('[data-map-program-notes]').style.display, 'none');
    assert.equal(el.querySelector('[data-map-program-tab="notes"]'), null, 'signed out, no Notes tab');
    assert.equal(el.querySelector('[data-map-program-mark="notes"]').style.display, 'none', 'nor a count of notes');
  } finally {
    window.TOKEN = 'fixture-token'; window.__shell._authState = 'auth';
    await settled();
    data.programSel = ''; data.setTab('research');
  }
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
