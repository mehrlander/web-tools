// The Program view (lib/alpineComponents/program.js): one declared program in
// a space of its own, at ?view=program&program=<name>. It was a page inside the
// Map's Programs tab until 2026-11-18, and these checks moved with it from
// map-research.test.mjs: the masthead, the tabs and which of them a program
// gets, the count each carries as a badge, the charter's Areas table, the
// commits joined by sha, the open tasks from board.csv, the notes on the
// charter, the measures drawn in their tab, and the signed-out read limits.
// Also window.Programs, the one reading of a declaration that the Map's list,
// this view and the shell's sidebar share, and the Areas tab drawn from the
// charter and the manifest: a tile an area, its icon (declared, else its Map
// view's), the files its Covers cell links less those a panel names, what it
// covers in a panel-tip, the panels its declaration names (a measure attached
// by the area's exact name, a registry broken down by a column, a gallery of
// a registry's rows, a run of registries as one row of chips that open their
// rows, a breakdown folded to one line that opens its groups),
// its width from its panels (half the pane on a phone, side by side) and the
// rows packed in order, its height its own, and its heat grid: four weeks of
// commits matched by path, a row a week, in its top line. The views that display it open
// from the masthead in the shell's anchored menu. On a wide pane the tiles stand
// beside a side panel of the commits both reads found, by day and marked with
// their areas, the open tasks and the notes; a picked tile narrows the commits
// and rides the address as &area=, and a commit and its tiles mark each other.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';
import { makeShell } from './shell.mjs';
import { marked } from 'marked';

const { window, problems } = makeWindow({ html: '<div id="program" x-data="program()"></div>' });
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
const menus = [], maps = [], picks = [];
window.__shell = Alpine.reactive({
  _authState: 'auth', programName: 'surfacing', programTab: '', programArea: '', estateConfigs: {}, estateHidden: [],
  REGISTRY_REPO: 'mehrlander/web-tools-private',
  hasToken(){ return this._authState === 'auth'; },
  goProgramTab(k){ this.programTab = k === 'areas' ? '' : k; },
  goProgramArea(a){ picks.push(a); this.programArea = a; },
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
      reviewers: ['portable:owner-proxy'], views: ['?view=map&tab=showing', '?view=waiting'],
      areas: [
        { name: 'Reply', icon: 'ph-chat-circle-text', panels: [{ kind: 'measure' },
          { kind: 'breakdown', registry: 'docs/portable.csv', by: 'kind', icons: { skill: 'ph-sparkle', doc: 'not-a-glyph' } }] },
        { name: 'Showing', icon: 'showing.svg', panels: [{ kind: 'measure' },
          { kind: 'gallery', registry: 'docs/showing-mechanisms.csv', label: 'label', glyph: 'glyph' },
          { kind: 'breakdown', registry: 'docs/harness.csv', by: 'invocation', split: ':', only: ['hook', 'ci', 'git'] },
          { kind: 'gallery', registry: 'docs/docs.csv', where: { path: '^docs/envelopes/(?!README)' }, label: 'path' },
          { kind: 'gallery', registry: 'pages/pages.csv', label: 'label', thumb: 'thumb', href: 'href' },
          { kind: 'views', views: ['?view=waiting'] }] },
        { name: 'Resources', icon: 'ph-toolbox', panels: [
          { kind: 'groups', registry: 'skills/manifest.csv', by: 'group', label: 'name', text: 'description', file: 'skills/{name}/SKILL.md',
            icons: { session: 'ph-terminal-window', prose: 'ph-pen-nib' } },
          { kind: 'groups', registry: 'docs/agents.csv', by: 'kind', only: ['definition', 'retired'], label: 'id', text: 'role', file: '{path}', icon: 'icon',
            labels: { definition: 'agents' }, icons: { definition: 'ph-robot' } },
          { kind: 'breakdown', registry: 'docs/context-sources.csv', by: 'arrives', fold: true, labels: { hook: 'hook output' }, icons: { hook: 'ph-lightning' } }] },
        { name: 'Not in the charter', panels: [{ kind: 'measure' }] }] },
    { name: 'plain', label: 'Plain', path: 'programs/plain' }, { label: 'unnamed' }] },
  [home]: { estate: true, programs: [{ name: 'budget', label: 'Budget', path: 'projects/budget/program' }] },
  'mehrlander/hidden': { estate: true, programs: [{ name: 'secret', label: 'Secret' }] },
  'mehrlander/outside': { estate: false, programs: [{ name: 'outside', label: 'Outside' }] },
};
const commit = (sha, date, message) => ({ sha, html_url: 'https://github.com/' + hub + '/commit/' + sha,
  commit: { message, committer: { date } } });
// Days back from now, at local noon, so the fortnight's cells hold them
// whatever day the suite runs.
const ago = d => { const t = new Date(); t.setDate(t.getDate() - d); t.setHours(12, 0, 0, 0); return t.toISOString(); };
const commits = {
  'docs/CONVERSATION.md': [commit('c3c3c3c3c3', '2026-11-10T12:00:00Z', 'Both files at once\n\nBody'), commit('c1c1c1c1c1', '2026-11-01T12:00:00Z', 'The oldest')],
  'python/showing.py': [commit('c3c3c3c3c3', '2026-11-10T12:00:00Z', 'Both files at once\n\nBody'), commit('c2c2c2c2c2', '2026-11-05T12:00:00Z', 'The middle one')],
  // The Forms area's two links: one commit under both, one under the folder
  // alone, one twenty days back, inside the heat grid's four weeks whatever
  // the weekday and past a fortnight, and one older than the grid.
  'docs/forms': [commit('a1a1a1a1a1', ago(1), 'Forms and envelopes'), commit('a2a2a2a2a2', ago(3), 'A form'),
    commit('a4a4a4a4a4', ago(20), 'Three weeks back'), commit('a3a3a3a3a3', ago(60), 'Long ago')],
  'docs/envelopes/README.md': [commit('a1a1a1a1a1', ago(1), 'Forms and envelopes')],
  // A busy file, past a page of a hundred inside the grid's weeks: the last
  // twenty days, which the four weeks hold whatever the weekday.
  'docs/a0.md': Array.from({ length: 130 }, (_, i) => commit('b' + String(i).padStart(9, '0'), ago(1 + i % 20), 'Busy ' + i)),
};
const charterAbout = hub + ':programs/surfacing/README.md';
// A charter whose Areas table the page lists: links resolve from the charter's
// folder, code stays code, and the table under Measures is not read.
// Its Measures table attaches a row by the area's exact name, and a measure by
// the file its Measure cell names.
const charterMd = ['# Surfacing', '', 'The charter, *rendered*.', '', '## Areas', '',
  '| Area | Covers |', '| --- | --- |',
  '| Reply | what a reply hands over, in [`CONVERSATION.md`](../../docs/CONVERSATION.md), counted in [`portable.csv`](../../docs/portable.csv) and framed in [`portable.md`](../../docs/portable.md) |',
  '| Showing | the link, from `showing.py` and the [Map](https://example.com/?view=map) |',
  '| Forms | the forms in [`docs/forms/`](../../docs/forms/) and the [envelopes](../../docs/envelopes/README.md "Envelopes"), again [here](../../docs/forms/) |',
  '| Resources | what a session is given, in [`MARKETPLACE.md`](../../docs/MARKETPLACE.md), [`context-sources.csv`](../../docs/context-sources.csv) and the [skills](../../skills/manifest.csv) |', '',
  '## Measures', '', '| Area | Measure | Working means |', '| --- | --- | --- |',
  '| Reply | web-tools-private `state/closings.json` on the `background` branch | the share of *Open* falls |',
  '| Showing | none yet; a candidate is `state/closings.json.bak` | every turn hands over a link |',
  '| Forms and more | `state/closings.json` | not this area |', ''].join('\n');
const notes = [
  { id: 'n1', at: '2026-11-02T10:00:00Z', author: 'owner', about: charterAbout, text: 'The first note' },
  { id: 'n2', at: '2026-11-03T10:00:00Z', author: 'claude', about: charterAbout + '#scope', text: 'On a section' },
  { id: 'n3', at: '2026-11-04T10:00:00Z', author: 'owner', about: 'note:n1', text: 'A reply' },
  { id: 'n4', at: '2026-11-05T10:00:00Z', author: 'owner', about: hub + ':docs/APP.md', text: 'Another file' },
];
const closings = { generated: '2026-11-14T00:00:00Z', states: { ok: 'Closed', open: 'Open' },
  summary: { columns: ['week', 'from', 'turns', 'Closed'] }, caveats: ['A caveat'],
  days: [{ day: '2026-11-03', closings: { ok: 3, open: 1 } }, { day: '2026-11-10', closings: { ok: 2, open: 2 } }] };
// The registries the fixture's tiles read.
const csvs = {
  'docs/portable.csv': 'kind,path\nskill,a\nscript,b\nskill,c\ndoc,d\nskill,e\nscript,f\n',
  'docs/showing-mechanisms.csv': 'key,glyph,label\nhosted,diamond,Deployed page\ntoss,disc,Toss\nnone,x,No link\n',
  'docs/harness.csv': 'path,invocation\na.sh,hook:SessionStart\nb.sh,hook:Stop\nc.yml,ci:push\nd.mjs,driver\ne.py,argv\n',
  'docs/docs.csv': 'path,status\ndocs/envelopes/README.md,living\ndocs/envelopes/approval.md,living\ndocs/envelopes/audit.md,\ndocs/APP.md,living\n',
  'pages/pages.csv': 'top,label,thumb,href\n' + Array.from({ length: 5 }, (_, i) => `main,p${i},thumbs/p${i}.png,p${i}.html`).join('\n') + '\n',
  'skills/manifest.csv': 'name,group,description\nbake-page,web,Bakes a page.\ncaveman,prose,Says less.\ndefault,session,The conventions.\n'
    + 'sessions,session,Logs the session.\ntasks,session,Runs the tracker.\n',
  'docs/agents.csv': 'id,kind,path,icon,role\nportable:closer,definition,skills/agents/closer.md,skills/agents/icons/closer.svg,Weighs the findings.\n'
    + 'portable:owner-proxy,definition,skills/agents/owner-proxy.md,,Gives the owner\'s view.\ngold-set:reader,inline,skills/gold-set/SKILL.md,,Labels rows.\n',
  'docs/context-sources.csv': 'id,arrives\n' + ['hook', 'hook', 'hook', 'instructions', 'install', 'message', 'none', 'settings', 'skill', 'tool']
    .map((a, i) => 's' + i + ',' + a).join('\n') + '\n',
};
const asked = [];
window.GH = class {
  static FRESH = { cache: 'no-store' };
  static refFor(repo){ return repo === hub ? 'codex/program-preview' : 'main'; }
  constructor(opts){ this.opts = opts; }
  async req(url){
    asked.push({ ...this.opts, file: url });
    if (url.startsWith('commits?')) {
      const q = new URLSearchParams(url.slice(8)), since = q.get('since'), per = +q.get('per_page') || 30, page = +q.get('page') || 1;
      return (commits[q.get('path')] || []).filter(c => !since || c.commit.committer.date >= since).slice((page - 1) * per, page * per);
    }
    return [];
  }
  async get(file, opts){
    asked.push({ ...this.opts, file, cache: opts?.cache });
    if (file === '.web-tools.json') return { text: JSON.stringify(manifests[this.opts.repo]) };
    if (file === 'tracker/board.csv' && this.opts.repo === hub)
      return { text: 'id,title,status,project,href\na,A,backlog,surfacing,tasks/a.md\nb,B,done,surfacing,tasks/b.md\n'
        + 'c,C,in-progress,app,tasks/c.md\ne,Draft the page,in-progress,surfacing,tasks/e.md\n' };
    if (file === 'programs/surfacing/README.md') return { text: charterMd };
    if (csvs[file]) return { text: csvs[file] };
    if (file === 'programs/plain/README.md') return { text: '# Plain\n\nA charter with [no areas](../../docs/APP.md).\n\n## Measures\n\n| A | B |\n| --- | --- |\n| x | y |\n' };
    if (file === 'notes/notes.jsonl' && this.opts.repo === 'mehrlander/web-tools-private')
      return { text: notes.map(n => JSON.stringify(n)).join('\n') + '\n' };
    if (file === 'state/closings.json') return { text: JSON.stringify(closings) };
    if (file === 'programs/marked/icon.svg') return { text: '<svg viewBox="0 0 32 32"><title>x</title><path fill="#0891b2" d="M0 0h32v32H0z"/></svg>' };
    if (file === 'programs/wide/README.md') return { text: ['## Areas', '', '| Area | Covers |', '| --- | --- |',
      ...Array.from({ length: 5 }, (_, i) => `| A${i} | [one](../../docs/a${i}.md) and [two](../../docs/b${i}.md) |`)].join('\n') };
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
      && data.activityOf(p).state !== 'loading' && (!data.hasToken() || data.notesOf(p).state !== 'loading')) break;
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
  assert.equal(page.querySelector('[data-program-scope]'), null, 'the scope is the Map list\'s, not repeated over the tiles');
  assert.doesNotMatch(page.querySelector('[data-program-body]').textContent, /replies and render links/);
  assert.deepEqual([...page.querySelectorAll('[data-program-tab]')].map(b => b.dataset.programTab),
    ['areas', 'measures', 'changes', 'tasks', 'notes']);
  assert.equal(page.querySelector('[role="tab"][aria-selected="true"]').dataset.programTab, 'areas', 'the page opens on Areas');
  assert.ok(shown('[data-program-areas]'));
  for (const sel of ['[data-program-commits]', '[data-program-tasks]', '[data-program-notes]'])
    assert.equal(shown(sel), false, sel + ' waits for its tab');
  assert.equal(page.querySelector('[data-program-measures]'), null, 'the measures mount with their tab');

  const areas = [...page.querySelectorAll('[data-program-area]')];
  assert.deepEqual(areas.map(r => r.dataset.area), ['Reply', 'Showing', 'Forms', 'Resources'],
    'the rows of the table under Areas only; a declared area the charter lacks gets no tile');
  assert.equal(page.querySelector('[data-part="summary"]'), null, 'what an area covers is not printed on its tile');
  // It opens from the icon beside the name, as the charter writes it.
  areas[0].querySelector('[data-area-covers]').click(); await tick(3);
  const tip = el.querySelector('[data-program-chart-tip]'), link = tip.querySelector('a');
  assert.equal(data.chartTip.body.title, 'Reply');
  assert.equal(link.getAttribute('href'), 'https://github.com/' + hub + '/blob/codex/program-preview/docs/CONVERSATION.md',
    'a relative link resolves from the charter\'s folder');
  assert.equal(link.textContent, 'CONVERSATION.md');
  assert.equal(link.querySelector('code'), null, 'a linked file name takes the sentence\'s type');
  data.closeChartTip();
  areas[1].querySelector('[data-area-covers]').click(); await tick(3);
  assert.equal(tip.querySelector('code')?.textContent, 'showing.py', 'inline code stays code');
  assert.equal(tip.querySelector('a').getAttribute('href'), 'https://example.com/?view=map');
  data.closeChartTip(); await tick();

  // The views that display it open from the Map's mark on the masthead, in
  // the shell's anchored menu, rather than taking a line under it.
  assert.equal(page.querySelector('[data-program-views]'), null, 'no row of views under the masthead');
  const mast = page.querySelector('[data-part="title"]');
  assert.ok(mast.querySelector('[data-program-views-open] i.ph-compass'), 'the Map\'s mark, beside the name');
  assert.ok(mast.querySelector('[data-program-refresh]'), 'and the refresh on the same line, so no line holds only it');
  mast.querySelector('[data-program-views-open]').click();
  const viewsMenu = menus.at(-1);
  assert.deepEqual([viewsMenu.repo, viewsMenu.kind, viewsMenu.opts.align], [hub, 'views', 'left']);
  assert.deepEqual([...viewsMenu.opts.extra.map(r => [r.label, r.icon])], [['Showing', 'ph-paper-plane-tilt'], ['Waiting', 'ph-arrow-square-out']],
    'a row a declared view, under its icon');
  viewsMenu.opts.extra[0].run();
  assert.deepEqual(maps.at(-1), 'showing', 'a Map view opens in place');
  assert.equal(new URL(data.viewHref(data.page.views[0])).searchParams.get('use'), 'codex/program-preview', 'a view\'s address keeps the preview');

  page.querySelector('[data-program-switch]').click();
  assert.deepEqual(JSON.parse(JSON.stringify(menus.at(-1))), { repo: hub, kind: 'programs', opts: { align: 'left' } },
    'the mark opens the shell\'s program switcher');
});

test('Programs reads a charter cell\'s links, resolves them as repository paths, and matches a commit to an area by path', async () => {
  assert.deepEqual([...window.Programs.mdLinks('in [`a.md`](../../docs/a.md) and [b](../b/ "B") and [c](https://x.y/z)').map(l => l.href)],
    ['../../docs/a.md', '../b/', 'https://x.y/z'], 'every link as written, a title dropped');
  const from = 'programs/sessions/README.md';
  assert.equal(window.Programs.repoPath(from, '../../docs/CONVERSATION.md'), 'docs/CONVERSATION.md');
  assert.equal(window.Programs.repoPath(from, '../../docs/forms/'), 'docs/forms/', 'a folder keeps its slash');
  assert.equal(window.Programs.repoPath(from, 'manager.md#processes'), 'programs/sessions/manager.md', 'an anchor is not the path');
  assert.equal(window.Programs.repoPath(from, 'https://example.com/a.md'), '', 'a link with a scheme leaves the repository');
  assert.equal(window.Programs.repoPath(from, '#scope'), '');

  const { touches, areaDays } = window.Programs;
  assert.equal(touches(['docs/forms/'], ['docs/forms/']), true, 'the same path');
  assert.equal(touches(['docs/envelopes/README.md'], ['docs/envelopes/']), true, 'a path under a linked folder');
  assert.equal(touches(['docs/envelopes/'], ['docs/envelopes/README.md']), false, 'a folder does not stand for one file in it');
  assert.equal(touches(['docs/formsx/a.md'], ['docs/forms']), false, 'a linked file is not a folder');
  const now = new Date(2026, 10, 18, 9).getTime();
  const at = (y, m, d) => new Date(y, m, d, 12).toISOString();
  const pool = [{ sha: 'a', date: at(2026, 10, 18), paths: ['docs/x.md'] }, { sha: 'b', date: at(2026, 10, 18), paths: ['docs/f/'] },
    { sha: 'c', date: at(2026, 10, 5), paths: ['docs/x.md'] }, { sha: 'd', date: at(2026, 10, 4), paths: ['docs/x.md'] },
    { sha: 'e', date: at(2026, 10, 10), paths: ['docs/y.md'] }];
  const r = areaDays(pool, ['docs/x.md', 'docs/f/'], now, 14);
  assert.equal(r.days.length, 14);
  assert.equal(r.days[0].day, '2026-11-05', 'the first of the fortnight');
  assert.equal(r.days[13].day, '2026-11-18', 'ending today');
  assert.equal(r.count, 3, 'two today and one on the first day; a day before it and another file do not count');
  assert.equal(r.days[13].n, 2);
  assert.deepEqual([...r.days[13].commits.map(c => c.sha)], ['a', 'b']);

  // The heat grid as a calendar: four rows of a week, Monday to Sunday along
  // each, the newest at the bottom, so on a Wednesday the last four cells are
  // to come.
  const { heatStart, heatDays } = window.Programs;
  assert.equal(new Date(2026, 10, 18).getDay(), 3, 'the 18th is a Wednesday');
  assert.equal(heatStart(now, 4).getTime(), new Date(2026, 9, 26).getTime(), 'the Monday three weeks before this week\'s');
  assert.equal(heatStart(now).getTime(), heatStart(now, 4).getTime(), 'four weeks unless told otherwise');
  const g = heatDays([...pool, { sha: 'f', date: at(2026, 9, 26), paths: ['docs/x.md'] }, { sha: 'g', date: at(2026, 9, 25), paths: ['docs/x.md'] }],
    ['docs/x.md', 'docs/f/'], now, 4);
  assert.equal(g.days.length, 28, 'four rows of seven');
  assert.deepEqual([g.first, g.last], ['2026-10-26', '2026-11-18']);
  assert.deepEqual([0, 7, 14, 21].map(i => new Date(g.days[i].day + 'T12:00:00').getDay()), [1, 1, 1, 1], 'each row opens on a Monday');
  assert.equal(g.days[23].day, '2026-11-18', 'today, the Wednesday of the last row');
  assert.deepEqual([...g.days.slice(24).map(d => d.day + (d.future ? '+' : ''))], ['2026-11-19+', '2026-11-20+', '2026-11-21+', '2026-11-22+'],
    'the rest of this week, blank');
  assert.equal(g.days.filter(d => d.future).length, 4);
  assert.equal(g.count, 5, 'the window\'s first Monday counts and the Sunday before it does not');
  assert.equal(heatDays([], ['a'], new Date(2026, 10, 22, 9).getTime(), 4).days.filter(d => d.future).length, 0, 'on a Sunday the last row is full');
  assert.equal(heatDays([], ['a'], new Date(2026, 10, 16, 9).getTime(), 4).days.filter(d => d.future).length, 6, 'on a Monday one cell is today');
});

test('a program\'s colour is its drawn mark\'s first fill, read with its icon', async () => {
  const p = { repo: hub, ref: 'main', iconFile: 'programs/marked/icon.svg' };
  window.Programs.color(p);
  for (let i = 0; i < 10 && !window.Programs.color(p); i++) await tick();
  assert.equal(window.Programs.color(p), '#0891b2');
  assert.equal(window.Programs.color({ repo: hub, icon: 'ph-gauge', iconFile: '' }), '', 'a glyph has none');
  assert.equal(data.programColor({ repo: hub, iconFile: '' }), 'var(--color-primary)', 'and the view falls back to primary');
  assert.equal(el.querySelector('[data-program-areas]').style.getPropertyValue('--program'), 'var(--color-primary)',
    'the tab carries the colour as --program');
});

test('Programs reads an area declaration, keeping only panels it can draw', () => {
  const [p] = window.Programs.rows([{ repo: hub, config: { programs: [{ name: 'x', areas: [
    { name: 'A', icon: 'ph-books', panels: [
      { kind: 'breakdown', registry: 'docs/a.csv', by: 'kind', icons: { a: 'ph-x', b: 'url(x)' }, where: { k: '^a$', bad: '(' } },
      { kind: 'breakdown', registry: 'docs/a.csv' }, { kind: 'breakdown', registry: '../up.csv', by: 'kind' },
      { kind: 'gallery', registry: 'docs/a.json', label: 'name' }, { kind: 'gallery', registry: 'docs/a.csv' },
      { kind: 'gallery', source: 'research', where: { kind: '^probe$' } }, { kind: 'gallery', source: 'elsewhere' },
      { kind: 'chart' }, { kind: 'views', views: ['?view=sessions', 3] }, { kind: 'measure' },
      { kind: 'groups', registry: 'skills/manifest.csv', by: 'group', label: 'name', text: 'description', file: 'skills/{name}/SKILL.md' },
      { kind: 'groups', registry: 'skills/manifest.csv', by: 'group' }, { kind: 'groups', registry: 'skills/manifest.csv', label: 'name' },
      { kind: 'breakdown', registry: 'docs/a.csv', by: 'kind', fold: true }, { kind: 'gallery', registry: 'docs/a.csv', label: 'name', fold: true }] },
    { icon: 'ph-x' }, { name: 'B', icon: 'not-a-glyph' }] }] } }]);
  assert.deepEqual([...p.areas.map(a => a.name)], ['A', 'B'], 'an area names itself');
  assert.equal(p.areas[1].icon, '', 'an icon is a ph- glyph or nothing');
  const kinds = [...p.areas[0].panels.map(pn => pn.kind)];
  assert.deepEqual(kinds, ['breakdown', 'gallery', 'views', 'measure', 'groups', 'breakdown', 'gallery'],
    'a breakdown needs a CSV and a column, a gallery a CSV and a label or a source, groups a CSV, a column and a label, and the kind must be one of five');
  const [bd, gal, views] = p.areas[0].panels, [grp, folded, notFolded] = p.areas[0].panels.slice(4);
  assert.deepEqual([grp.registry, grp.by, grp.label, grp.text, grp.file], ['skills/manifest.csv', 'group', 'name', 'description', 'skills/{name}/SKILL.md']);
  assert.deepEqual([bd.fold, folded.fold, notFolded.fold], [false, true, false], 'only a breakdown folds');
  assert.deepEqual({ ...bd.icons }, { a: 'ph-x' }, 'group icons are glyphs');
  assert.deepEqual({ ...bd.where }, { k: '^a$' }, 'a pattern that does not compile is dropped');
  assert.equal(gal.source, 'research');
  assert.equal(gal.repo, '', 'a research gallery reads its own repository unless it names another');
  const [named, bad] = window.Programs.rows([{ repo: hub, config: { programs: [{ name: 'z', areas: [{ name: 'R', panels: [
    { kind: 'gallery', source: 'research', repo: 'owner/other' }, { kind: 'gallery', source: 'research', repo: '../x' }] }] }] } }])[0].areas[0].panels;
  assert.deepEqual([named.repo, bad.repo], ['owner/other', ''], 'the repository is owner/repo or nothing');
  assert.deepEqual([...views.views], ['?view=sessions']);
  assert.ok(bd.sig && bd.sig !== gal.sig, 'each panel carries its own signature');
  assert.equal(window.Programs.rows([{ repo: hub, config: { programs: [{ name: 'y' }] } }])[0].areas.length, 0, 'no declaration, no areas');
});

test('Programs breaks a registry down, packs tiles in order, counts the columns a width holds, and finds an area its icon', () => {
  const rows = window.Csv.rows(csvs['docs/harness.csv']);
  const all = window.Programs.breakdown(rows, { by: 'invocation', split: ':' });
  assert.deepEqual([...all.groups.map(g => [g.key, g.n])], [['hook', 2], ['argv', 1], ['ci', 1], ['driver', 1]],
    'by the part before the split, largest first, then by name');
  assert.equal(all.total, 5);
  assert.equal(all.groups[1].pct, 50, 'a bar against the largest group');
  const only = window.Programs.breakdown(rows, { by: 'invocation', split: ':', only: ['hook', 'ci', 'git'], labels: { ci: 'workflows' }, icons: { hook: 'ph-lightning' } });
  assert.deepEqual([...only.groups.map(g => [g.label, g.n, g.icon])], [['hook', 2, 'ph-lightning'], ['workflows', 1, ''], ['git', 0, '']],
    'the groups named, in their order, a missing one at nought');
  assert.deepEqual([only.total, only.of], [3, 5]);
  const many = window.Programs.breakdown(Array.from({ length: 9 }, (_, i) => ({ k: 'g' + i })), { by: 'k' });
  assert.equal(many.groups.length, 6);
  assert.deepEqual({ ...many.rest }, { groups: 3, n: 3 }, 'past six groups, the rest summed');
  assert.deepEqual([...window.Programs.pick([{ a: 'x1' }, { a: 'y' }], { a: '^x' })], [{ a: 'x1' }]);
  // groups: every group, largest first, its rows in the registry's order, or
  // those `only` names, in its order, a missing one at nought.
  const skills = window.Csv.rows(csvs['skills/manifest.csv']);
  const g = window.Programs.groups(skills, { by: 'group', icons: { session: 'ph-terminal-window' } });
  assert.deepEqual([...g.groups.map(x => [x.key, x.n, x.icon])], [['session', 3, 'ph-terminal-window'], ['prose', 1, ''], ['web', 1, '']],
    'all of them, ties by name, none summed as the rest');
  assert.deepEqual([...g.groups[0].rows.map(r => r.name)], ['default', 'sessions', 'tasks']);
  assert.deepEqual([g.total, g.of], [5, 5]);
  const named = window.Programs.groups(window.Csv.rows(csvs['docs/agents.csv']), { by: 'kind', only: ['definition', 'retired'], labels: { definition: 'agents' } });
  assert.deepEqual([...named.groups.map(x => [x.label, x.n])], [['agents', 2], ['retired', 0]]);
  assert.deepEqual([named.total, named.of], [2, 3]);
  assert.equal(window.Programs.groups(Array.from({ length: 9 }, (_, i) => ({ k: 'g' + i })), { by: 'k' }).groups.length, 9,
    'a chip each, where a breakdown sums past six');
  // rowFile: a template over the row's columns, whole or nothing.
  const { rowFile } = window.Programs;
  assert.equal(rowFile('skills/{name}/SKILL.md', { name: 'caveman' }), 'skills/caveman/SKILL.md');
  assert.equal(rowFile('{path}', { path: 'skills/agents/closer.md' }), 'skills/agents/closer.md');
  assert.equal(rowFile('skills/{name}/SKILL.md', { name: '' }), '', 'an empty value opens nothing');
  assert.equal(rowFile('{path}', { path: '../up.md' }), '', 'nor a path that climbs');
  assert.equal(rowFile('', { name: 'x' }), '');

  const spans = (w, c) => window.Programs.tileSpans(w, c).map(t => t.i + ':' + t.span).join(' ');
  assert.equal(spans([2, 3, 2, 1, 1], 3), '0:3 1:3 2:2 3:1 4:2',
    'in order: a gap the next tile does not fit widens the row\'s tile, and no later tile is pulled forward into it');
  assert.equal(spans([2, 2], 3), '0:3 1:3', 'a gap nothing fits goes to the row\'s tile');
  assert.equal(spans([1, 1], 3), '0:2 1:1', 'shared out from the first');
  assert.equal(window.Programs.tileSpans([1, 1], 3, [false, true]).map(t => t.span).join(), '1,2', 'a tile of views alone grows last');
  assert.equal(spans([1, 1, 1, 1, 1], 4), '0:1 1:1 2:1 3:1 4:2', 'a last tile alone grows to twice its ask, not across the row');
  assert.equal(spans([3, 2], 1), '0:1 1:1', 'one column: every tile one wide, in order');
  for (const c of [1, 2, 3, 4]) {
    const wants = [2, 1, 3, 1, 2, 1, 1], out = window.Programs.tileSpans(wants, c);
    assert.deepEqual([...out.map(t => t.i)], [0, 1, 2, 3, 4, 5, 6], c + ' columns: in the order given');
    assert.ok(out.every(t => t.span <= c));
    assert.ok(out.every(t => t.span <= 2 * Math.min(c, wants[t.i])), c + ' columns: no tile past twice its ask');
  }
  // Two half-width tiles wherever two can stand, a 360px phone included;
  // a wide pane holds as many 13rem tracks as fit.
  assert.deepEqual([200, 328, 358, 600, 881, 1400].map(P => window.Programs.tileCols(P)), [1, 2, 2, 2, 4, 6]);
  const P = window.Programs;
  assert.equal(P.panelWeight({ kind: 'measure' }, { measure: { addr: 'x' } }), 1, 'a drawn measure fits a half-width tile');
  assert.equal(P.panelWeight({ kind: 'measure' }, { measure: { addr: '' } }), 1);
  assert.equal(P.panelWeight({ kind: 'gallery', thumb: 'thumb' }), 2);
  assert.equal(P.panelWeight({ kind: 'gallery', source: 'research' }, null, 2), 1, 'two research rows fit a narrow tile');
  assert.equal(P.panelWeight({ kind: 'gallery', source: 'research' }, null, 3), 2);
  assert.equal(P.panelWeight({ kind: 'breakdown' }), 1);
  assert.equal(P.panelWeight({ kind: 'groups' }), 1);
  assert.equal(P.panelWeight({ kind: 'breakdown', fold: true }), 0, 'a folded breakdown is one line, and asks for no width');
  assert.equal(P.tileWant([{ w: 1 }, { w: 0 }]), 1, 'so a tile of chips and a folded line stays one column wide');
  assert.equal(P.tileWant([{ w: 0 }]), 1);
  assert.equal(P.tileWant([{ w: 2 }, { w: 1 }, { w: 2 }]), 2, 'at most two');
  assert.equal(P.tileWant([]), 1);

  const prog = { views: ['?view=map&tab=showing', '?view=waiting'] };
  assert.equal(P.areaIcon(prog, 'Showing', { icon: 'ph-books' }), 'ph-books', 'a declared icon first');
  assert.equal(P.areaIcon(prog, 'Showing', null), 'ph-paper-plane-tilt', 'else its Map view\'s');
  assert.equal(P.areaIcon(prog, 'Waiting', null), 'ph-circle-dashed', 'a view outside the Map has only the door, which is no icon');
});

test('Areas draws a tile an area: its icon and files, its declared panels, its width and its heat grid', async () => {
  const p = data.page, page = el.querySelector('[data-program-page]');
  for (let i = 0; i < 30 && (data.measureState(p.measures[0]) !== 'ok' || Object.values(data.registries).some(r => r.state === 'loading')); i++) await tick();
  await frame();
  assert.ok(page.querySelector('[data-program-areas] [data-pattern="card-grid"] [data-part="list"]'), 'a card grid, declared');
  assert.equal(page.querySelector('[data-program-spine]'), null, 'no spine');
  const tile = key => page.querySelector(`[data-program-area][data-area="${key}"]`);

  // The header: the icon in the program's colour, declared or its view's,
  // and the files its Covers cell links, each once, a folder to its tree.
  const icon = key => tile(key).querySelector('[data-area-icon]').dataset.icon;
  assert.deepEqual(['Reply', 'Showing', 'Forms'].map(icon), ['ph-chat-circle-text', 'ph-paper-plane-tilt', 'ph-circle-dashed'],
    'declared; else the Showing view\'s, since a path is no glyph; else a dashed circle');
  assert.match(tile('Reply').querySelector('[data-area-icon]').className, /var\(--program\)/, 'drawn in the program\'s colour');
  assert.equal(tile('Reply').querySelector('[data-part="title"]').textContent.trim(), 'Reply');
  const docs = key => [...tile(key).querySelectorAll('[data-area-doc]')];
  assert.deepEqual(docs('Reply').map(a => a.textContent.trim()), ['CONVERSATION.md', 'portable.md'],
    'a file a panel\'s head names (its breakdown\'s portable.csv) is not named again; another file of that name is');
  assert.deepEqual(docs('Forms').map(a => a.textContent.trim()), ['docs/forms/', 'envelopes/README.md'],
    'a folder by its path, an index file with its folder, and a second link to one path dropped');
  assert.equal(docs('Forms')[0].getAttribute('href'), 'https://github.com/' + hub + '/tree/codex/program-preview/docs/forms');
  assert.equal(docs('Forms')[0].hasAttribute('data-peek'), false, 'a folder has no peek');
  assert.ok(docs('Forms')[1].querySelector('i').classList.contains('ph-file-text'));
  assert.equal(tile('Showing').querySelector('[data-area-docs]').style.display, 'none', 'no repository link, no chips');
  // A chip marks under the pointer, as a panel's file does.
  const chip = docs('Reply')[0];
  chip.dispatchEvent(new window.Event('mouseenter')); await tick();
  assert.ok(chip.classList.contains('bg-primary/10'));
  chip.dispatchEvent(new window.Event('mouseleave')); await tick();
  const opened = [], was = window.open;
  window.open = (u) => { opened.push(u); };
  try { docs('Reply')[0].click(); await tick(3); } finally { window.open = was; }
  assert.deepEqual(opened, ['https://github.com/' + hub + '/blob/codex/program-preview/docs/CONVERSATION.md'],
    'a file opens as the charter does: the deck, or GitHub without it');

  // The panels, as declared; an area the manifest leaves out keeps its
  // measure, and Forms, whose Measures row names another area, has none.
  const panels = key => [...tile(key).querySelectorAll('[data-panel]')].map(s => s.dataset.panel);
  assert.deepEqual(panels('Reply'), ['measure', 'breakdown']);
  assert.deepEqual(panels('Showing'), ['measure', 'gallery', 'breakdown', 'gallery', 'gallery', 'views']);
  assert.deepEqual(panels('Forms'), [], 'no declaration and no Measures row of its own: header and fortnight only');
  assert.equal(tile('Forms').querySelector('[data-part="body"]').style.display, 'none');

  // measure: the declared file as a sparkline, a bar a week, the marked
  // category and its share at its end, the months it runs over in its head
  // in place of an axis, its Working means from the target beside them.
  const m = tile('Reply').querySelector('[data-area-measure]');
  assert.equal(m.dataset.measure, 'closings.json');
  const spark = m.querySelector('[data-area-spark]');
  assert.equal(spark.querySelectorAll('[data-week]').length, 2, 'a bar a week');
  assert.ok(spark.querySelector('[data-week]').parentElement.classList.contains('h-6'), 'word-sized, on its own line under the share');
  assert.match(spark.textContent, /Closed\s*50%/, 'the marked category, then its share of the last week after the bars');
  assert.match(m.querySelector('[data-panel-head]').textContent.replace(/\s+/g, ' '), /closings Nov\b/, 'one month: its name; no axis under the bars');
  assert.equal(data.measureRange(p.measures[0]), 'Nov');
  assert.deepEqual([...data.tileWeeks(p.measures[0]).map(w => w.week)], ['2026-11-02', '2026-11-09']);
  assert.doesNotMatch(m.textContent, /share of Open falls/, 'working means is not printed');
  m.querySelector('[data-area-means]').click(); await tick(3);
  assert.equal(data.chartTip.body.title, 'Working means');
  assert.deepEqual([...data.chartTip.body.notes], ['the share of Open falls']);
  data.closeChartTip();
  const none = tile('Showing').querySelector('[data-area-measure="none"]');
  assert.match(none.textContent, /No measure yet/);
  assert.match(none.textContent, /none yet; a candidate is state\/closings\.json\.bak/);
  none.querySelector('[data-area-means]').click(); await tick(3);
  assert.deepEqual([...data.chartTip.body.notes], ['every turn hands over a link']);
  data.closeChartTip();

  // breakdown: a bar a group against the largest, its icon where declared.
  const bd = tile('Reply').querySelector('[data-area-breakdown]');
  assert.equal(bd.dataset.registry, 'docs/portable.csv');
  const groups = [...bd.querySelectorAll('[data-breakdown-group]')];
  assert.deepEqual(groups.map(g => g.dataset.group + ' ' + g.dataset.n), ['skill 3', 'script 2', 'doc 1']);
  assert.ok(groups[0].querySelector('i.ph-sparkle'), 'a declared group icon');
  assert.match(groups[1].querySelector('[data-bar]').getAttribute('style'), /width:\s*66\.7%/);
  assert.match(bd.querySelector('[data-panel-head]').textContent.replace(/\s+/g, ' '), /portable by kind 6/);
  const head = bd.querySelector('[data-panel-file="docs/portable.csv"]');
  head.dispatchEvent(new window.Event('mouseenter')); await tick();
  assert.ok(head.classList.contains('bg-primary/10'), 'a panel\'s file marks under the pointer, as its chip would');
  head.dispatchEvent(new window.Event('mouseleave')); await tick();
  const split = tile('Showing').querySelector('[data-area-breakdown][data-registry="docs/harness.csv"]');
  assert.deepEqual([...split.querySelectorAll('[data-breakdown-group]')].map(g => g.dataset.group + ' ' + g.dataset.n), ['hook 2', 'ci 1', 'git 0']);
  assert.match(split.querySelector('[data-panel-head]').textContent, /3 of 5/, 'the rows it counts, of the registry\'s');

  // gallery: chips, a chip with its mark through the Map's marker words, a
  // path as its file's name peeking the file, small thumbnails from raw at
  // the selected revision, and what is left out as a count.
  const galleries = [...tile('Showing').querySelectorAll('[data-area-gallery]')];
  assert.deepEqual(galleries.map(g => g.dataset.layout), ['icons', 'chips', 'thumbs']);
  const icons = [...galleries[0].querySelectorAll('[data-gallery-item]')];
  assert.deepEqual(icons.map(i => i.lastElementChild.textContent), ['Deployed page', 'Toss', 'No link']);
  assert.deepEqual(icons.map(i => i.querySelector('span[x-html]').textContent.trim()), ['🔷', '🥏', ''], 'the Map\'s marker for each word');
  assert.ok(icons[2].querySelector('.ph-minus'), 'a word with no marker draws a dash');
  const chips = [...galleries[1].querySelectorAll('[data-gallery-item]')];
  assert.deepEqual(chips.map(c => c.textContent), ['approval', 'audit'], 'README left out by its pattern');
  const thumbs = [...galleries[2].querySelectorAll('[data-gallery-item]')];
  assert.equal(thumbs.length, 2, 'a tile one column wide shows one row of two');
  assert.equal(thumbs[0].querySelector('img').getAttribute('src'), 'https://raw.githubusercontent.com/' + hub + '/codex/program-preview/pages/thumbs/p0.png');
  assert.equal(thumbs[0].getAttribute('href'), 'https://mehrlander.github.io/web-tools/pages/p0.html');
  assert.equal(galleries[2].querySelector('[data-gallery-more]').textContent, '+3');
  assert.deepEqual([...tile('Showing').querySelectorAll('[data-area-view]')].map(a => a.textContent.trim()), ['Waiting']);

  // Width: on a phone's two columns every tile takes one, side by side;
  // where the pane holds more, a tile asks for its panels' weight and the
  // grid packs the rows in the charter's order, with no dense reflow. Height:
  // a tile is its own.
  assert.deepEqual(['Reply', 'Showing', 'Forms'].map(k => tile(k).dataset.want), ['2', '2', '1']);
  const grid = page.querySelector('[data-program-tiles]');
  assert.doesNotMatch(grid.className, /dense/);
  assert.ok(grid.classList.contains('items-start'));
  assert.deepEqual(['Reply', 'Showing', 'Forms'].map(k => tile(k).classList.contains('self-stretch')), [false, false, false],
    'Reply draws its measure, and is still its own height');
  assert.equal(page.querySelector('[data-program-tiles]').dataset.cols, '1', 'a pane jsdom gives no width holds one column');
  const spansNow = () => [...page.querySelectorAll('[data-program-area]')].map(t => t.dataset.area + ':' + t.dataset.span);
  data.areaCols = 2; await frame();
  assert.deepEqual(spansNow(), ['Reply:1', 'Showing:1', 'Forms:1', 'Resources:1'], 'two columns: every tile half the width, whatever it asked for');
  data.areaCols = 3; await frame();
  assert.deepEqual(spansNow(), ['Reply:3', 'Showing:2', 'Forms:1', 'Resources:2']);
  assert.equal(tile('Showing').querySelectorAll('[data-area-gallery][data-layout="thumbs"] [data-gallery-item]').length, 4,
    'two columns wide, one row of four');
  data.areaCols = 1; await frame();

  // The heat grid: in the top line beside the name, the icon's height; a
  // row a week and a column a weekday, each day shaded by its commits to
  // what the area links, a commit under two of its links counted once, one
  // before the grid's four weeks not at all, and no footer or count.
  const c = data.charterOf(p);
  assert.equal(c.areas[0].measure.addr, p.measures[0]);
  assert.equal(c.areas[1].measure.addr, '', 'a longer file name is not the declared file');
  assert.equal(c.areas[2].measure, null, 'only an exact name attaches a row');
  const act = data.activityOf(p);
  assert.deepEqual([...act.read].sort(), ['docs/CONVERSATION.md', 'docs/MARKETPLACE.md', 'docs/context-sources.csv', 'docs/envelopes/README.md', 'docs/forms/',
    'docs/portable.csv', 'docs/portable.md', 'skills/manifest.csv'],
    'every file an area links, a chip left out for its panel included');
  assert.equal(page.querySelector('[data-program-fortnight], [data-program-count-scope]'), null, 'no line over the tiles says what they count');
  assert.equal(page.querySelector('[data-area-activity], [data-area-count], [data-program-area] footer'), null, 'no footer and no count');
  const areaReads = asked.filter(a => a.file.startsWith('commits?') && new URLSearchParams(a.file.slice(8)).get('since'));
  assert.ok(areaReads.length && areaReads.every(a => new URLSearchParams(a.file.slice(8)).get('per_page') === '100'));
  const start = window.Programs.heatStart(Date.now(), 4);
  assert.ok(areaReads.every(a => new URLSearchParams(a.file.slice(8)).get('since') === start.toISOString()), 'read from the grid\'s first Monday');
  const forms = data.areaDays(p, c.areas[2]);
  assert.equal(forms.count, 3, 'twenty days back counts, past the old fortnight; long ago does not');
  const heat = tile('Forms').querySelector('[data-area-heat]');
  assert.ok(heat.closest('[data-part="title"]'), 'on the top line, with the icon and the name');
  assert.ok(heat.classList.contains('h-7') && tile('Forms').querySelector('[data-area-icon]').classList.contains('size-7'), 'the icon\'s height');
  assert.ok(heat.classList.contains('grid-cols-[repeat(7,6px)]') && heat.classList.contains('grid-rows-[repeat(4,6px)]')
    && !heat.classList.contains('grid-flow-col'), 'seven columns of a weekday and four rows of a week, filled a row at a time');
  const name = tile('Forms').querySelector('[data-part="title"] h3');
  assert.ok(name.classList.contains('truncate') && (name.getAttribute('x-effect') || '').includes('fitTip'), 'the name cut short before the grid gives way, whole in a title-tip');
  assert.ok(heat.classList.contains('shrink-0'));
  assert.equal(heat.dataset.areaState, 'ok');
  const cells = [...heat.querySelectorAll('[data-day]')];
  assert.equal(cells.length, 28, 'four weeks of seven days');
  assert.equal(new Date(cells[0].dataset.day + 'T12:00:00').getDay(), 1, 'the oldest row opens on a Monday');
  assert.equal(cells[0].dataset.day, [start.getFullYear(), start.getMonth() + 1, start.getDate()].map(n => String(n).padStart(2, '0')).join('-'),
    'at the top left, the window\'s first day');
  assert.deepEqual(cells.map(b => +b.dataset.n).filter(Boolean), [1, 1, 1]);
  const dk = d => { const t = new Date(); t.setDate(t.getDate() - d); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
  const yesterday = cells.find(b => b.dataset.day === dk(1));
  assert.equal(yesterday.dataset.n, '1', 'yesterday');
  assert.match(yesterday.getAttribute('style'), /color-mix\(in oklab, var\(--program\) \d+%/, 'shaded in the program\'s colour');
  assert.match(cells.find(b => b.dataset.n === '0' && !b.hasAttribute('data-future')).getAttribute('style'), /var\(--color-base-content\)/, 'a quiet day faint and neutral');
  const future = cells.filter(b => b.hasAttribute('data-future'));
  assert.equal(future.length, 6 - (new Date().getDay() + 6) % 7, 'the days still to come this week');
  assert.ok(future.every(b => /transparent/.test(b.getAttribute('style'))), 'and left blank');
  assert.equal(cells.indexOf(cells.find(b => b.dataset.day === dk(0))), 27 - future.length, 'today, before them, in the bottom row');
  assert.match(heat.dataset.titleTip, /^[A-Z][a-z]+ \d+ → ([A-Z][a-z]+ )?\d+ · 3 commits$/, 'its span and count in a title-tip');
  assert.equal(data.areaDays(p, c.areas[1]), null, 'an area that links no file has no grid');
  assert.equal(tile('Showing').querySelector('[data-area-heat]'), null);
  assert.equal(data.areaDays(p, c.areas[0]).count,
    commits['docs/CONVERSATION.md'].filter(x => x.commit.committer.date >= data.areaDays(p, c.areas[0]).days[0].day).length);
  yesterday.click(); await tick(3); await frame();
  assert.deepEqual([...(data.chartTip?.body?.rows || []).map(r => r.label)], ['Forms and envelopes'], 'a day opens its commits');
  assert.equal(heat.hasAttribute('data-title-tip'), false, 'and the span\'s title-tip stands aside while it is open');
  data.closeChartTip();
  assert.equal(page.querySelector('[data-program-areas-read]').style.display, 'none', 'every linked path read');
  assert.ok(asked.some(a => a.file === 'docs/portable.csv' && a.ref === 'codex/program-preview'), 'a registry is read at the selected revision');
  assert.equal(asked.filter(a => a.file === 'docs/harness.csv').length, 1, 'once, however many panels read it');
  assert.deepEqual(problems, []);
});

test('a run of groups panels draws one row of chips that open their rows, and a folded breakdown one line that opens its groups', async () => {
  const page = el.querySelector('[data-program-page]');
  for (let i = 0; i < 30 && Object.values(data.registries).some(r => r.state === 'loading'); i++) await tick();
  await frame();
  const tile = page.querySelector('[data-program-area][data-area="Resources"]');
  assert.deepEqual([...tile.querySelectorAll('[data-panel]')].map(s => s.dataset.panel), ['groups', 'breakdown'],
    'two groups panels one after the other draw as one');
  assert.equal(tile.dataset.want, '1', 'chips and a folded line ask for one column');
  assert.deepEqual([...tile.querySelectorAll('[data-area-doc]')].map(a => a.textContent.trim()), ['MARKETPLACE.md'],
    'the registries the chips\' head and the folded line name are not named again');

  // The chips: each registry named once in the head with its count, a
  // manifest by its folder; then a chip a group across both, in one row.
  const groups = tile.querySelector('[data-area-groups]');
  assert.equal(groups.querySelector('[data-panel-head]').textContent.replace(/\s+/g, ' ').trim(), 'skills 5 · agents 2');
  const chips = [...groups.querySelectorAll('[data-groups-chip]')];
  assert.deepEqual(chips.map(c => c.dataset.registry.split('/').pop() + ':' + c.dataset.group + ' ' + c.textContent.trim()),
    ['manifest.csv:session 3', 'manifest.csv:prose 1', 'manifest.csv:web 1', 'agents.csv:definition 2', 'agents.csv:retired 0'],
    'largest first, ties by name, then the next registry\'s in the order its only names');
  assert.equal(new Set(chips.map(c => c.parentElement)).size, 1, 'one row');
  assert.ok(chips[0].querySelector('i.ph-duotone.ph-terminal-window'), 'its declared icon');
  assert.ok(chips[2].querySelector('i.ph-circle'), 'a plain circle where none is declared');
  assert.equal(chips[4].disabled, true, 'a group at nought is drawn, dimmed, and opens nothing');
  assert.deepEqual([chips[0].getAttribute('aria-haspopup'), chips[0].getAttribute('aria-label')], ['dialog', 'session: 3']);

  // A chip opens its group's rows in the chart panel-tip: a name each in
  // bold, which opens its file, and its text.
  chips[0].click(); await tick(3);
  const tip = el.querySelector('[data-program-chart-tip]');
  assert.equal(chips[0].getAttribute('aria-expanded'), 'true');
  assert.deepEqual([data.chartTip.body.title, data.chartTip.body.sub], ['Session', '3 of 5 in skills']);
  assert.equal(data.chartTip.body.sourceTip, 'Open skills/manifest.csv', 'the registry, peeked from beside the title');
  const items = [...tip.querySelectorAll('[data-chart-tip-item]')];
  assert.deepEqual(items.map(li => li.querySelector('button').textContent + ' | ' + li.querySelector('p').textContent),
    ['default | The conventions.', 'sessions | Logs the session.', 'tasks | Runs the tracker.'], 'the registry\'s order');
  assert.ok(items[0].querySelector('button').classList.contains('font-semibold'), 'a name in bold');
  assert.ok(items[0].querySelector('p').classList.contains('line-clamp-2'), 'its text two lines at most');
  assert.equal(items[0].dataset.file, 'skills/default/SKILL.md', 'the file the declaration\'s template names');
  const opened = [], was = window.open;
  window.open = u => { opened.push(u); };
  try { items[1].querySelector('button').click(); await tick(3); } finally { window.open = was; }
  assert.deepEqual(opened, ['https://github.com/' + hub + '/blob/codex/program-preview/skills/sessions/SKILL.md'],
    'a name opens its file as the charter does: the deck, or GitHub without it');
  assert.equal(data.chartTip, null, 'and the panel-tip closes');

  chips[3].click(); await tick(3);
  assert.deepEqual([data.chartTip.body.title, data.chartTip.body.sub], ['Agents', '2 of 3 in agents'], 'against the registry\'s rows');
  const agents = [...tip.querySelectorAll('[data-chart-tip-item]')];
  assert.deepEqual(agents.map(li => li.querySelector('button').textContent), ['closer', 'owner-proxy'], 'a namespaced name by its last part');
  assert.equal(agents[0].dataset.file, 'skills/agents/closer.md');
  assert.equal(agents[0].querySelector('img').getAttribute('src'), 'https://raw.githubusercontent.com/' + hub + '/codex/program-preview/skills/agents/icons/closer.svg',
    'its own mark, where its row names one');
  assert.equal(agents[1].querySelector('img').style.display, 'none');
  data.closeChartTip(); await tick();

  // The folded breakdown: its head line alone, which opens every group.
  const fold = tile.querySelector('[data-area-breakdown][data-fold]');
  assert.equal(fold.dataset.registry, 'docs/context-sources.csv');
  assert.equal(fold.querySelectorAll('[data-breakdown-group]').length, 0, 'no line a group');
  const line = fold.querySelector('button[data-panel-head]');
  assert.equal(line.textContent.replace(/\s+/g, ' ').trim(), 'context-sources by arrives 10');
  line.click(); await tick(3);
  assert.equal(line.getAttribute('aria-expanded'), 'true');
  assert.deepEqual([data.chartTip.body.title, data.chartTip.body.sub], ['context-sources', 'by arrives · 10']);
  assert.deepEqual([...data.chartTip.body.rows.map(r => r.label + ' ' + r.n + ' ' + r.share)],
    ['hook output 3 30%', 'install 1 10%', 'instructions 1 10%', 'message 1 10%', 'none 1 10%', 'settings 1 10%', 'skill 1 10%', 'tool 1 10%'],
    'every group, where a drawn breakdown sums past six');
  assert.ok(tip.querySelector('i.ph-lightning'), 'a group\'s icon beside its label');
  data.closeChartTip(); await tick();
  assert.deepEqual(problems, []);
});

test('Programs joins commits read under several sets of paths by sha, by local day, with the areas each touched', () => {
  const { commitDays } = window.Programs;
  const at = (d, h = 12) => new Date(2026, 10, d, h).toISOString();
  const areas = [{ key: 'Forms', docs: [{ path: 'docs/forms/' }, { path: 'docs/envelopes/README.md' }] },
    { key: 'Reply', docs: [{ path: 'docs/CONVERSATION.md' }] }, { key: 'Bare', docs: [] }];
  const governed = [{ sha: 'a', date: at(18), subject: 'A', url: 'u-a', paths: ['docs/CONVERSATION.md'] },
    { sha: 'b', date: at(18, 9), subject: 'B', paths: ['python/x.py'] }, { sha: 'old', date: at(1), subject: 'Old', paths: ['docs/CONVERSATION.md'] }];
  const linked = [{ sha: 'a', date: at(18), subject: 'A', paths: ['docs/forms/'] },
    { sha: 'c', date: at(17), subject: 'C', paths: ['docs/forms/', 'docs/envelopes/README.md'] }];
  const r = commitDays([governed, linked], areas, new Date(2026, 10, 10).getTime());
  assert.equal(r.count, 3, 'joined by sha, and one before the window left out');
  assert.deepEqual([...r.days.map(d => d.day)], ['2026-11-18', '2026-11-17'], 'the newest day first');
  assert.deepEqual([...r.days[0].commits.map(c => c.sha)], ['a', 'b'], 'and the newest first within it');
  const [a, b] = r.days[0].commits;
  assert.deepEqual([...a.paths], ['docs/CONVERSATION.md', 'docs/forms/'], 'every path it was read under, a file before a folder');
  assert.deepEqual([...a.areas], ['Forms', 'Reply'], 'the areas whose links it touched, in the charter\'s order');
  assert.equal(a.url, 'u-a', 'a link either read carried');
  assert.equal(a.short, 'a');
  assert.deepEqual([...b.areas], [], 'a governed path no area links marks none');
  assert.deepEqual([...r.days[1].commits[0].paths], ['docs/envelopes/README.md', 'docs/forms/']);
  const none = commitDays([], areas);
  assert.deepEqual([none.days.length, none.count], [0, 0]);
});

test('on a wide pane the tiles stand beside a side panel of the commits by day, marked with their areas, the open tasks and the notes', async () => {
  const p = data.page, page = el.querySelector('[data-program-page]');
  for (let i = 0; i < 30 && Object.values(data.registries).some(r => r.state === 'loading'); i++) await tick();
  await frame();
  // The layout is the pane's container query: below 60rem inside its padding
  // the tiles stand alone as they did, and above it they take two thirds
  // beside the panel, each column the pane's height and scrolling on its own.
  const areas = page.querySelector('[data-program-areas]'), body = page.querySelector('[data-program-body]');
  assert.ok(body.classList.contains('@container') && body.classList.contains('overflow-y-auto'));
  assert.equal(body.classList.contains('pb-8'), false, 'each tab ends on its own padding, so a wide Areas tab fills the pane');
  for (const c of ['pb-8', '@min-[60rem]:grid', '@min-[60rem]:h-full', '@min-[60rem]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]', '@min-[60rem]:grid-rows-[minmax(0,1fr)]', '@min-[60rem]:pb-3'])
    assert.ok(areas.classList.contains(c), 'the Areas tab: ' + c);
  const col = areas.querySelector(':scope > [data-program-tiles-col]'), rail = areas.querySelector(':scope > [data-program-rail]');
  assert.ok(col.querySelector('[data-program-tiles]'), 'the tiles in the first column');
  assert.ok(['@min-[60rem]:overflow-y-auto', '@min-[60rem]:min-h-0'].every(c => col.classList.contains(c)), 'which scrolls on its own beside the panel');
  assert.ok(rail.classList.contains('hidden') && rail.classList.contains('@min-[60rem]:flex'), 'the panel only where the pane is wide');
  assert.equal(data.railOn, false, 'jsdom lays nothing out, so it stands as a narrow pane does');

  // Three sections, each named by the tab it shortens, which its name opens.
  assert.deepEqual([...rail.querySelectorAll('[data-rail-tab]')].map(b => b.dataset.railTab), ['changes', 'tasks', 'notes']);
  rail.querySelector('[data-rail-tab="tasks"]').click(); await frame();
  assert.equal(window.__shell.programTab, 'tasks');
  page.querySelector('[data-program-tab="areas"]').click(); await frame();
  assert.ok(rail.querySelector('[data-rail-changes]').classList.contains('flex-1'), 'the commits take what the tasks and notes leave');
  assert.ok(['[data-rail-tasks]', '[data-rail-notes]'].every(s => rail.querySelector(s).classList.contains('max-h-[32%]')));

  // The commits: both reads joined over the heat grids' four weeks, a day a
  // heading in the label tier, newest first.
  const all = data.railOf(p), days = [...rail.querySelectorAll('[data-rail-day]')];
  assert.deepEqual(days.map(d => d.dataset.day), [...all.days.map(d => d.day)]);
  assert.deepEqual(days.map(d => d.dataset.day), days.map(d => d.dataset.day).slice().sort().reverse(), 'newest day first');
  const dk = d => { const t = new Date(); t.setDate(t.getDate() - d); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
  const row = sha => rail.querySelector(`[data-rail-commit][data-sha="${sha}"]`);
  assert.ok(row('a1a1a1a1a1') && row('a2a2a2a2a2') && row('a4a4a4a4a4'), 'the commits the tiles read');
  assert.equal(!!row('a3a3a3a3a3'), false, 'none older than the heat grids\' four weeks');
  const day = row('a1a1a1a1a1').closest('[data-rail-day]');
  assert.equal(day.dataset.day, dk(1));
  const head = day.querySelector('h4');
  assert.ok(head.classList.contains('text-xs') && head.classList.contains('sticky'), 'a day\'s heading in the label tier, held while its commits scroll');
  assert.match(head.firstElementChild.textContent, /^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}$/);
  assert.equal(head.lastElementChild.textContent, String(all.days.find(d => d.day === dk(1)).commits.length));
  assert.equal(data.railOf(p), all, 'drawn again without joining again');
  assert.equal(rail.querySelector('[data-rail-head] .tabular-nums').textContent, String(all.count));

  // A commit: its areas' icons in a gutter of their own, its subject at
  // content size, then its short sha and the file it touched as labels.
  const a1 = row('a1a1a1a1a1');
  assert.equal(a1.dataset.areas, 'Forms', 'a folder and a file Forms links, one area');
  const mark = a1.querySelector('[data-rail-mark]');
  assert.equal(mark.dataset.area, 'Forms');
  assert.ok(mark.querySelector('i').classList.contains(data.tilesOf(p).find(t => t.a.key === 'Forms').icon), 'the area\'s own icon, as its tile wears it');
  assert.match(mark.className, /var\(--program\)/, 'in the program\'s colour');
  assert.deepEqual([data.duotone('ph-books'), data.duotone('inline-block bg-current')], ['ph-duotone ph-books', 'inline-block bg-current'],
    'a Map view\'s drawn mark as it comes, as a tile draws it');
  assert.ok(a1.querySelector('p').classList.contains('text-sm'), 'the subject at the tiles\' content size');
  assert.equal(a1.querySelector('p').textContent, 'Forms and envelopes');
  const [sha, file] = a1.querySelectorAll('a');
  assert.deepEqual([sha.textContent, sha.getAttribute('href')], ['a1a1a1a', 'https://github.com/' + hub + '/commit/a1a1a1a1a1'],
    'a commit only the tiles read still links its commit');
  assert.equal(file.textContent, 'envelopes/README.md', 'the file before the folder, named as a tile names it');
  assert.equal(file.dataset.titleTip, 'docs/envelopes/README.md');
  assert.equal(file.getAttribute('x-blob'), 'peek(p, c.paths[0])', 'which peeks that file');
  assert.match(a1.textContent, /\+1/, 'and how many more it touched');

  // The tasks, in progress first, and the notes on the charter, as their tabs list them.
  assert.deepEqual([...rail.querySelectorAll('[data-rail-task]')].map(t => t.dataset.status + ' ' + t.textContent.trim()), ['in-progress Draft the page', 'backlog A']);
  assert.ok(rail.querySelector('[data-rail-task] i').classList.contains('ph-circle-half'), 'a status icon');
  assert.equal(rail.querySelectorAll('[data-rail-note]').length, 2);
  assert.ok(rail.querySelector('[data-rail-note] p').classList.contains('line-clamp-2'));
  assert.deepEqual(problems, []);
});

test('beside the panel a tile picks its area, which narrows the commits under a chip that clears it, and a commit and its tiles mark each other', async () => {
  const p = data.page, page = el.querySelector('[data-program-page]'), rail = page.querySelector('[data-program-rail]');
  const tile = key => page.querySelector(`[data-program-area][data-area="${key}"]`);
  const shas = () => [...rail.querySelectorAll('[data-rail-commit]')].map(r => r.dataset.sha);
  const forms = tile('Forms'), name = forms.querySelector('[data-part="title"] h3');
  picks.length = 0;

  // Below the threshold nothing picks, and the name is a heading as before.
  forms.click(); await frame();
  assert.deepEqual(picks, [], 'no panel, nothing to narrow');
  assert.deepEqual([name.getAttribute('role'), name.getAttribute('tabindex')], [null, null]);
  const whole = shas();

  data.railOn = true; await frame();
  assert.deepEqual([name.getAttribute('role'), name.getAttribute('tabindex'), name.getAttribute('aria-pressed')], ['button', '0', 'false']);
  forms.querySelector('[data-area-covers]').click(); await tick(3);
  assert.deepEqual(picks, [], 'a tile\'s own control does its own thing');
  data.closeChartTip();
  forms.click(); await frame();
  assert.deepEqual(picks, ['Forms'], 'a tap elsewhere on the tile picks it, by its name');
  assert.ok(forms.hasAttribute('data-picked'));
  assert.match(forms.className, /@min-\[60rem\]:ring-2/, 'ringed, only where the panel shows');
  assert.equal(name.getAttribute('aria-pressed'), 'true');
  const chip = rail.querySelector('[data-rail-chip]');
  assert.equal(chip.dataset.area, 'Forms');
  assert.match(chip.textContent, /Forms/);
  assert.ok(chip.closest('[data-rail-changes] [data-rail-head]'), 'at the panel\'s top, on the commits it narrows');
  const forms3 = data.areaDays(p, data.charterOf(p).areas[2]);
  assert.deepEqual(shas(), [...forms3.days.flatMap(d => d.commits).sort((a, b) => b.date.localeCompare(a.date)).map(c => c.sha)],
    'its commits, as its heat grid counts them');
  assert.ok([...rail.querySelectorAll('[data-rail-commit]')].every(r => r.dataset.areas.split('|').includes('Forms')));
  assert.equal(rail.querySelector('[data-rail-head] .tabular-nums').textContent, String(forms3.count));
  assert.equal(rail.querySelectorAll('[data-rail-task]').length, 2, 'the tasks name no file, so they stay whole');
  assert.equal(rail.querySelectorAll('[data-rail-note]').length, 2, 'and so do the notes');

  rail.querySelector('[data-rail-clear]').click(); await frame();
  assert.deepEqual(picks.at(-1), '', 'the chip\'s cross clears it');
  assert.equal(!!rail.querySelector('[data-rail-chip]'), false, 'and the chip goes');
  assert.deepEqual(shas(), whole);
  name.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await frame();
  assert.equal(picks.at(-1), 'Forms', 'the name answers Enter');
  rail.querySelector('[data-rail-commit][data-sha="a1a1a1a1a1"] [data-rail-mark]').click(); await frame();
  assert.equal(picks.at(-1), '', 'a commit\'s mark picks its area, and again clears it');
  rail.querySelector('[data-rail-commit][data-sha="a1a1a1a1a1"] [data-rail-mark]').click(); await frame();
  assert.equal(picks.at(-1), 'Forms');
  window.__shell.programArea = ''; await frame();

  // Hover: a commit marks its areas' tiles and its day in each one's heat
  // grid; a tile marks its commits.
  const a1 = rail.querySelector('[data-rail-commit][data-sha="a1a1a1a1a1"]');
  a1.dispatchEvent(new window.Event('mouseenter')); await frame();
  assert.deepEqual([...page.querySelectorAll('[data-program-area][data-hot]')].map(t => t.dataset.area), ['Forms']);
  assert.match(forms.className, /ring-\[var\(--program\)\]\/40/);
  assert.deepEqual([...page.querySelectorAll('[data-area-heat] [data-hot]')].map(b => b.closest('[data-program-area]').dataset.area + ' ' + b.dataset.day),
    ['Forms ' + a1.closest('[data-rail-day]').dataset.day]);
  a1.dispatchEvent(new window.Event('mouseleave')); await frame();
  assert.deepEqual([...page.querySelectorAll('[data-program-area][data-hot], [data-area-heat] [data-hot]')].map(n => n.dataset.area || n.dataset.day), []);
  forms.dispatchEvent(new window.Event('mouseenter')); await frame();
  const hot = [...rail.querySelectorAll('[data-rail-commit][data-hot]')].map(r => r.dataset.sha);
  assert.deepEqual(hot, shas().filter(s => rail.querySelector(`[data-rail-commit][data-sha="${s}"]`).dataset.areas.split('|').includes('Forms')));
  assert.ok(hot.includes('a1a1a1a1a1') && hot.length >= 3);
  forms.dispatchEvent(new window.Event('mouseleave')); await frame();
  assert.equal(rail.querySelectorAll('[data-rail-commit][data-hot]').length, 0);
  data.railOn = false; await frame();
  assert.deepEqual(problems, []);
});

test('a picked area rides the address on the Areas tab: a link reopens it, Back clears it, and a tab or another program leaves it', async () => {
  const { shell, history, location } = makeShell({ search: '?view=program&program=sessions&area=Showing' });
  const calls = [];
  for (const op of ['pushState', 'replaceState']) history[op] = (_s, _t, href) => { calls.push(op); location.search = new URL(href, 'https://localhost').search; };
  await shell.routeFromUrl(shell.parseUrl());
  assert.deepEqual([shell.view, shell.programName, shell.programArea], ['program', 'sessions', 'Showing'], 'a link opens on its area');
  assert.equal(new URLSearchParams(location.search).get('area'), 'Showing');
  shell.goProgramArea('Reply');
  assert.equal(calls.at(-1), 'pushState', 'a pick is a history entry');
  assert.equal(new URLSearchParams(location.search).get('area'), 'Reply');
  shell.goProgramArea('Reply');
  assert.equal(calls.length, 2, 'picking the picked area again moves nothing');
  // Back, as the browser restores the address before the pick.
  shell._restoring = true;
  location.search = '?view=program&program=sessions';
  await shell.routeFromUrl(shell.parseUrl());
  shell._restoring = false;
  assert.equal(shell.programArea, '', 'Back clears it');
  assert.equal(calls.at(-1), 'replaceState');
  shell.goProgramArea('Reply');
  shell.goProgramTab('areas');
  assert.equal(shell.programArea, 'Reply', 'the tab it is on keeps it');
  shell.goProgramTab('changes');
  assert.equal(shell.programArea, '', 'another tab leaves it');
  assert.deepEqual([new URLSearchParams(location.search).get('tab'), new URLSearchParams(location.search).has('area')], ['changes', false]);
  await shell.routeFromUrl({ ...shell.parseUrl(), view: 'program', program: 'sessions', tab: 'changes', area: 'Reply' });
  assert.equal(shell.programArea, '', 'an area names nothing on another tab');
  await shell.routeFromUrl({ ...shell.parseUrl(), view: 'program', program: 'sessions', tab: 'areas', area: 'Forms' });
  assert.equal(shell.programArea, 'Forms', 'Areas named outright is still the first tab');
  assert.deepEqual([new URLSearchParams(location.search).has('tab'), new URLSearchParams(location.search).get('area')], [false, 'Forms']);
  shell.goProgram('testing');
  assert.equal(shell.programArea, '', 'an area is one program\'s');
  shell.goProgramArea('Suite');
  shell.view = 'map';
  assert.equal(shell.deepLinkParams(new URLSearchParams(location.search)).has('area'), false, 'and rides no other view');
});

test('each tab carries its count as a badge, and the tabs hold the changes, tasks, notes and measures', async () => {
  const p = data.page, page = el.querySelector('[data-program-page]');
  assert.equal(page.querySelector('[data-program-marks], [data-program-mark]'), null, 'no row of counts apart from the tabs');
  const badges = Object.fromEntries([...page.querySelectorAll('[data-program-tab]')].map(b => {
    const n = b.querySelector('[data-program-badge]');
    return [b.dataset.programTab, n && n.style.display !== 'none' ? n.textContent.trim() : null];
  }));
  assert.equal(badges.tasks, '2', 'the open tasks');
  assert.equal(badges.changes, data.recent(p) ? String(data.recent(p)) : null, 'the commits of the last fortnight, none drawn at nought');
  assert.equal(badges.notes, '2');
  assert.equal(badges.areas, null, 'a tab with no count has no badge');
  assert.equal(badges.measures, null);
  assert.match(page.querySelector('[data-program-badge="changes"]').dataset.titleTip, /^Commits in the last 14 days, among the latest read from 2 governed paths$/,
    'the one count whose window its tab does not say');

  page.querySelector('[data-program-tab="changes"]').click(); await frame();
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
  const reads = asked.filter(a => a.file.startsWith('commits?') && !new URLSearchParams(a.file.slice(8)).get('since'));
  assert.ok(reads.length && reads.every(a => a.repo === hub && new URLSearchParams(a.file.slice(8)).get('per_page') === '5'),
    'the Changes tab reads five a governed path');

  page.querySelector('[data-program-tab="tasks"]').click(); await frame();
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
  // A registry signed out comes from raw.githubusercontent, which spends none
  // of the anonymous API calls the commit reads need.
  const fetched = [];
  window.fetch = async u => { fetched.push(u); const f = Object.keys(csvs).find(k => u.endsWith('/' + k));
    return f ? { ok: true, status: 200, text: async () => csvs[f] } : { ok: false, status: 404, text: async () => '' }; };
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
    assert.equal(data.tabCount(p, 'notes'), 0, 'nor a count of notes');
    const big = { ...p, key: 'x:big', governs: Array.from({ length: 12 }, (_, i) => 'docs/f' + i + '.md') };
    await data.loadCommits(big);
    assert.equal(data.commitsOf(big).read, 8, 'signed out, the first eight governed paths');
    assert.equal(data.measureState(p.measures[0]), 'locked', 'another repository\'s measure needs a token');
    // The areas read their linked paths to the same limit, in the charter's
    // order, and an area past it reads as unread rather than quiet.
    const wide = { ...p, key: hub + ':wide', name: 'wide', charter: 'programs/wide/README.md', measures: [] };
    await data.loadCharter(wide);
    await data.loadActivity(wide);
    const act = data.activityOf(wide), areas = data.charterOf(wide).areas;
    assert.equal(act.total, 10);
    assert.equal(act.read.length, 8, 'signed out, the first eight linked paths');
    assert.ok(data.areaDays(wide, areas[3]), 'an area whose links were read');
    assert.equal(data.areaDays(wide, areas[0]).count, 130, 'a busy file read past its first page');
    assert.ok(asked.some(a => a.file.includes('path=docs%2Fa0.md') && a.file.includes('&page=2')));
    assert.equal(data.areaDays(wide, areas[4]), null, 'one whose links were not is unread, not quiet');
    for (let i = 0; i < 20 && Object.values(data.registries).some(r => r.state === 'loading' || r.authed); i++) await tick();
    assert.ok(fetched.includes('https://raw.githubusercontent.com/' + hub + '/codex/program-preview/docs/portable.csv'));
    assert.equal(data.regOf(p, 'docs/portable.csv').state, 'ok');
    assert.equal(data.galleryOf(p, { source: 'repos' }).state, 'locked', 'the estate\'s repositories need a token');
    assert.equal(data.galleryOf(p, { source: 'research', repo: 'owner/unread' }).state, 'locked', 'another repository\'s research needs a token');
  } finally {
    delete window.fetch;
    window.TOKEN = 'fixture-token'; window.__shell._authState = 'auth';
    await settled();
  }
  assert.deepEqual(problems, []);
});
