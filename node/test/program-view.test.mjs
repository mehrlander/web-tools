// The Program view (lib/alpineComponents/program.js): one declared program in
// a space of its own, at ?view=program&program=<name>. It was a page inside the
// Map's Programs tab until 2026-11-18, and these checks moved with it from
// map-research.test.mjs: the masthead, the tabs and which of them a program
// gets, the marks that open the tab they count, the charter's Areas table, the
// commits joined by sha, the open tasks from board.csv, the notes on the
// charter, the measures drawn in their tab, and the signed-out read limits.
// Also window.Programs, the one reading of a declaration that the Map's list,
// this view and the shell's sidebar share.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';
import { marked } from 'marked';

const { window, problems } = makeWindow({ html: '<div id="program" x-data="program()"></div>' });
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
const menus = [], maps = [];
window.__shell = Alpine.reactive({
  _authState: 'auth', programName: 'surfacing', programTab: '', estateConfigs: {}, estateHidden: [],
  REGISTRY_REPO: 'mehrlander/web-tools-private',
  hasToken(){ return this._authState === 'auth'; },
  goProgramTab(k){ this.programTab = k === 'areas' ? '' : k; },
  goMap(t){ maps.push(t); },
  toggleRepoMenu(repo, el, kind, opts){ menus.push({ repo, kind, opts }); },
});
window.history.replaceState({}, '', '?view=program&program=surfacing&use=codex/program-preview');
window.TOKEN = 'fixture-token';
window.marked = marked;
const hub = 'mehrlander/web-tools', home = 'mehrlander/home';
const manifests = {
  [hub]: { tracker: 'tracker/board.md',
    programs: [{ name: 'surfacing', label: 'Surfacing', icon: 'ph-megaphone', path: 'programs/surfacing',
      scope: 'replies and render links', governs: ['docs/CONVERSATION.md', 'python/showing.py'],
      measures: ['owner/private@background:state/closings.json'],
      reviewers: ['portable:owner-proxy'], views: ['?view=map&tab=showing', '?view=waiting'] },
    { name: 'plain', label: 'Plain', path: 'programs/plain' }, { label: 'unnamed' }] },
  [home]: { estate: true, programs: [{ name: 'budget', label: 'Budget', path: 'projects/budget/program' }] },
  'mehrlander/hidden': { estate: true, programs: [{ name: 'secret', label: 'Secret' }] },
  'mehrlander/outside': { estate: false, programs: [{ name: 'outside', label: 'Outside' }] },
};
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
const closings = { generated: '2026-11-14T00:00:00Z', states: { ok: 'Closed', open: 'Open' },
  summary: { columns: ['week', 'from', 'turns', 'Closed'] }, caveats: ['A caveat'],
  days: [{ day: '2026-11-03', closings: { ok: 3, open: 1 } }, { day: '2026-11-10', closings: { ok: 2, open: 2 } }] };
const asked = [];
window.GH = class {
  static FRESH = { cache: 'no-store' };
  static refFor(repo){ return repo === hub ? 'codex/program-preview' : 'main'; }
  constructor(opts){ this.opts = opts; }
  async req(url){
    asked.push({ ...this.opts, file: url });
    if (url.startsWith('commits?')) return commits[new URLSearchParams(url.slice(8)).get('path')] || [];
    return [];
  }
  async get(file, opts){
    asked.push({ ...this.opts, file, cache: opts?.cache });
    if (file === '.web-tools.json') return { text: JSON.stringify(manifests[this.opts.repo]) };
    if (file === 'tracker/board.csv' && this.opts.repo === hub)
      return { text: 'id,title,status,project,href\na,A,backlog,surfacing,tasks/a.md\nb,B,done,surfacing,tasks/b.md\n'
        + 'c,C,in-progress,app,tasks/c.md\ne,Draft the page,in-progress,surfacing,tasks/e.md\n' };
    if (file === 'programs/surfacing/README.md') return { text: charterMd };
    if (file === 'programs/plain/README.md') return { text: '# Plain\n\nA charter with [no areas](../../docs/APP.md).\n\n## Measures\n\n| A | B |\n| --- | --- |\n| x | y |\n' };
    if (file === 'notes/notes.jsonl' && this.opts.repo === 'mehrlander/web-tools-private')
      return { text: notes.map(n => JSON.stringify(n)).join('\n') + '\n' };
    if (file === 'state/closings.json') return { text: JSON.stringify(closings) };
    const e = new Error('Not found'); e.status = 404; throw e;
  }
};
// map.js publishes window.MapTabs, which names a program's Map views.
for (const file of ['lib/kits/repo-address.js', 'lib/kits/csv.js', 'lib/vanilla-bundle.js',
  'lib/alpineComponents/program.js', 'lib/alpineComponents/map.js'])
  new window.Function(readFileSync(path.join(repoRoot, file), 'utf8'))();
Alpine.start();
const el = window.document.getElementById('program'), data = Alpine.$data(el);
const frame = async () => { await tick(3); await new Promise(r => window.requestAnimationFrame(() => r())); };
const shown = sel => { const n = el.querySelector(sel); return !!n && n.style.display !== 'none'; };
async function settled(){
  for (let i = 0; i < 40; i++) {
    const p = data.page;
    if (!data.loading && p && data.commitsOf(p).state !== 'loading' && data.charterOf(p).state !== 'loading'
      && (!data.hasToken() || data.notesOf(p).state !== 'loading')) break;
    await tick();
  }
  await frame();
}
await settled();

test('Programs reads every named declaration, the hub first, as the list, the view and the sidebar do', () => {
  const rows = window.Programs.rows([
    { repo: home, ref: 'main', config: manifests[home] },
    { repo: hub, ref: 'x', config: manifests[hub] },
    { repo: 'mehrlander/none', config: null },
  ]);
  assert.deepEqual(rows.map(p => p.key), [hub + ':surfacing', hub + ':plain', home + ':budget'], 'a program without a name is not a row');
  const p = rows[0];
  assert.equal(p.charter, 'programs/surfacing/README.md');
  assert.equal(p.path, 'programs/surfacing');
  assert.equal(p.icon, 'ph-megaphone');
  assert.equal(p.root.tracker, 'tracker/board.md');
  assert.equal(window.Programs.rows([{ repo: hub, config: { programs: [{ name: 'x', icon: 'programs/x/icon.svg', path: '../up' }] } }])[0].charter, '',
    'a path that climbs names no charter');
  assert.equal(window.Programs.measureName(p.measures[0]), 'closings.json');
  assert.equal(window.Programs.viewLabel('?view=map&tab=showing'), 'Showing', 'a Map tab by its strip name');
  assert.equal(window.Programs.viewLabel('?view=map&tab=overview'), 'Contents', 'a tab by the subview it lands on');
  assert.equal(window.Programs.viewLabel('?view=waiting'), 'Waiting');
  assert.equal(window.Programs.viewIcon('?view=waiting'), 'ph-arrow-square-out');
});

test('the hub is read at the selected revision, and the page opens on its masthead and Areas', async () => {
  assert.deepEqual(problems, []);
  assert.ok(asked.some(a => a.repo === hub && a.file === '.web-tools.json' && a.ref === 'codex/program-preview' && a.cache === 'no-store'));
  const page = el.querySelector('[data-program-page]');
  assert.equal(page.dataset.program, 'surfacing');
  assert.equal(page.querySelector('h1').textContent, 'Surfacing');
  assert.ok(page.querySelector('[data-program-charter-open]'), 'the charter opens from beside the name');
  assert.equal(page.querySelector('[data-program-repo]').textContent, hub);
  assert.equal(page.querySelector('[data-program-scope]').textContent, 'replies and render links');
  assert.deepEqual([...page.querySelectorAll('[data-program-tab]')].map(b => b.dataset.programTab),
    ['areas', 'measures', 'changes', 'tasks', 'notes']);
  assert.equal(page.querySelector('[role="tab"][aria-selected="true"]').dataset.programTab, 'areas', 'the page opens on Areas');
  assert.ok(shown('[data-program-areas]'));
  for (const sel of ['[data-program-commits]', '[data-program-tasks]', '[data-program-notes]'])
    assert.equal(shown(sel), false, sel + ' waits for its tab');
  assert.equal(page.querySelector('[data-program-measures]'), null, 'the measures mount with their tab');

  const areas = [...page.querySelectorAll('[data-program-area]')];
  assert.deepEqual(areas.map(r => r.dataset.area), ['Reply', 'Showing'], 'the rows of the table under Areas only');
  const link = areas[0].querySelector('a');
  assert.equal(link.getAttribute('href'), 'https://github.com/' + hub + '/blob/codex/program-preview/docs/CONVERSATION.md',
    'a relative link resolves from the charter\'s folder');
  assert.equal(link.querySelector('code')?.textContent, 'CONVERSATION.md');
  assert.equal(areas[1].querySelector('code')?.textContent, 'showing.py', 'inline code stays code');
  assert.equal(areas[1].querySelector('a').getAttribute('href'), 'https://example.com/?view=map');

  const views = [...page.querySelectorAll('[data-program-views] a')];
  assert.deepEqual(views.map(a => a.textContent.trim()), ['Showing', 'Waiting'], 'the views ride under the masthead');
  assert.equal(new URL(views[0].href).searchParams.get('tab'), 'showing');
  assert.equal(new URL(views[0].href).searchParams.get('use'), 'codex/program-preview', 'a view link keeps the preview');
  views[0].click();
  assert.deepEqual(maps.at(-1), 'showing', 'a Map view opens in place');

  page.querySelector('[data-program-switch]').click();
  assert.deepEqual(JSON.parse(JSON.stringify(menus.at(-1))), { repo: hub, kind: 'programs', opts: { align: 'left' } },
    'the mark opens the shell\'s program switcher');
});

test('each mark opens the tab it counts, and the tabs hold the changes, tasks, notes and measures', async () => {
  const p = data.page, page = el.querySelector('[data-program-page]');
  const marks = Object.fromEntries([...page.querySelectorAll('[data-program-mark]')]
    .map(b => [b.dataset.programMark, b.style.display === 'none' ? null : b.textContent.trim()]));
  assert.equal(marks.tasks, '2 open');
  assert.equal(marks.changes, data.recent(p) + ' in 14 days');
  assert.equal(marks.notes, '2 notes');

  page.querySelector('[data-program-mark="changes"]').click(); await frame();
  assert.equal(window.__shell.programTab, 'changes', 'the tab is the shell\'s, so the address carries it');
  assert.ok(shown('[data-program-commits]'));
  assert.equal(shown('[data-program-areas]'), false);
  const shas = [...page.querySelectorAll('[data-program-commit]')].map(li => li.dataset.sha);
  assert.deepEqual(shas, ['c3c3c3c3c3', 'c2c2c2c2c2', 'c1c1c1c1c1'], 'joined by sha, newest first');
  const top = page.querySelector('[data-program-commit]');
  assert.match(top.textContent, /Both files at once/);
  assert.doesNotMatch(top.textContent, /Body/, 'the subject line only');
  assert.equal(top.querySelector('a').getAttribute('href'), 'https://github.com/' + hub + '/commit/c3c3c3c3c3');
  assert.equal(top.querySelector('a').textContent, 'c3c3c3c');
  assert.deepEqual([...data.commitsOf(p).rows[0].paths], ['docs/CONVERSATION.md', 'python/showing.py']);
  const reads = asked.filter(a => a.file.startsWith('commits?'));
  assert.ok(reads.every(a => a.repo === hub && new URLSearchParams(a.file.slice(8)).get('per_page') === '5'));

  page.querySelector('[data-program-mark="tasks"]').click(); await frame();
  assert.equal(window.__shell.programTab, 'tasks');
  assert.ok(shown('[data-program-tasks]'));
  assert.equal(shown('[data-program-commits]'), false);
  const tasks = [...page.querySelectorAll('[data-program-task]')];
  assert.deepEqual(tasks.map(t => t.textContent.trim()), ['Draft the page', 'A'], 'titles, in progress first');
  assert.deepEqual(tasks.map(t => t.dataset.status), ['in-progress', 'backlog']);
  assert.deepEqual([...data.taskRows(p).map(t => t.path)], ['tracker/tasks/e.md', 'tracker/tasks/a.md']);

  page.querySelector('[data-program-tab="notes"]').click(); await frame();
  assert.ok(shown('[data-program-notes]'));
  const noted = [...page.querySelectorAll('[data-program-note]')].map(li => li.textContent.replace(/\s+/g, ' ').trim());
  assert.equal(noted.length, 2, 'notes on the charter and its sections, not on other files or replies');
  assert.match(noted[0], /On a section/);
  assert.match(noted[1], /The first note.*1 reply/);

  page.querySelector('[data-program-tab="measures"]').click(); await frame();
  for (let i = 0; i < 20 && data.measureState(p.measures[0]) === 'loading'; i++) await tick();
  await frame();
  const m = page.querySelector('[data-program-measures] [data-program-measure="closings.json"]');
  assert.ok(m, 'the measures draw in their tab');
  assert.equal(data.measureState(p.measures[0]), 'ok');
  assert.equal(data.measureWeeks(p.measures[0]).length, 2, 'one column per week');
  assert.equal(data.measureMarkOf(p.measures[0]), 'ok', 'the summary\'s lead category is marked');

  page.querySelector('[data-program-tab="areas"]').click(); await frame();
  assert.equal(window.__shell.programTab, '', 'Areas is the first tab, so the address leaves it out');
  assert.deepEqual(problems, []);
});

test('a charter without an Areas table gives its first paragraph, and a tab a program lacks falls back', async () => {
  const plain = data.rows.find(p => p.name === 'plain');
  await data.loadCharter(plain);
  const c = data.charterOf(plain);
  assert.equal(c.state, 'ok');
  assert.deepEqual([...c.areas], [], 'a table under another heading is not the areas');
  assert.match(c.lead, /^A charter with <a href="https:\/\/github\.com\/mehrlander\/web-tools\/blob\/codex\/program-preview\/docs\/APP\.md"/);
  assert.equal([...data.tabs({ ...plain, charter: '' }).map(t => t.k)].includes('areas'), false,
    'a program without a charter has no Areas tab');
  assert.equal([...data.tabs(plain).map(t => t.k)].includes('measures'), false, 'nor Measures without measures');
  window.__shell.programTab = 'measures';
  assert.equal(data.tabOf(plain), 'areas', 'an asked tab the program lacks falls back to its first');
  window.__shell.programTab = '';
});

test('signed in, the estate repositories add their programs, except a hidden one and a non-member', async () => {
  window.__shell.estateConfigs = { [home]: manifests[home], 'mehrlander/hidden': manifests['mehrlander/hidden'],
    'mehrlander/outside': manifests['mehrlander/outside'], [hub]: { programs: [{ name: 'stale', label: 'Stale' }] } };
  window.__shell.estateHidden = ['mehrlander/hidden'];
  await tick(3);
  assert.deepEqual([...data.rows.map(p => p.key)], [hub + ':surfacing', hub + ':plain', home + ':budget'],
    'the hub at its selected revision, not the cache\'s copy');
  window.__shell.programName = 'budget';
  await frame();
  assert.equal(el.querySelector('[data-program-page]').dataset.program, 'budget');
  window.__shell.programName = 'nothing';
  await frame();
  assert.equal(el.querySelector('[data-program-page]'), null);
  assert.ok(shown('[data-program-missing]'), 'a name no repository declares says so');
  window.__shell.programName = 'surfacing';
  window.__shell.estateConfigs = {}; window.__shell.estateHidden = [];
  await settled();
});

test("signed out, a program's page reads fewer paths and leaves out the notes", async () => {
  window.TOKEN = ''; window.__shell._authState = 'public';
  try {
    await settled();
    const p = data.page;
    assert.ok(p, 'the hub program stays');
    for (let i = 0; i < 30 && !(data.commitsOf(p).state === 'ok' && data.commitsOf(p).authed === false); i++) await tick();
    assert.equal(data.commitsOf(p).authed, false, 'a sign-out reads the changes again, unauthenticated');
    await frame();
    assert.equal(el.querySelector('[data-program-notes]').style.display, 'none');
    assert.equal(el.querySelector('[data-program-tab="notes"]'), null, 'signed out, no Notes tab');
    assert.equal(el.querySelector('[data-program-mark="notes"]').style.display, 'none', 'nor a count of notes');
    const big = { ...p, key: 'x:big', governs: Array.from({ length: 12 }, (_, i) => 'docs/f' + i + '.md') };
    await data.loadCommits(big);
    assert.equal(data.commitsOf(big).read, 8, 'signed out, the first eight governed paths');
    assert.equal(data.measureState(p.measures[0]), 'locked', 'another repository\'s measure needs a token');
  } finally {
    window.TOKEN = 'fixture-token'; window.__shell._authState = 'auth';
    await settled();
  }
  assert.deepEqual(problems, []);
});
