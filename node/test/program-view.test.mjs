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
// a registry's rows),
// its width from its panels and the rows packed in order without holes, its
// height its own unless it draws a measure, and its commits of the last
// fortnight matched by path.
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
  // alone, and one older than the fortnight.
  'docs/forms': [commit('a1a1a1a1a1', ago(1), 'Forms and envelopes'), commit('a2a2a2a2a2', ago(3), 'A form'), commit('a3a3a3a3a3', ago(20), 'Long ago')],
  'docs/envelopes/README.md': [commit('a1a1a1a1a1', ago(1), 'Forms and envelopes')],
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
  '| Forms | the forms in [`docs/forms/`](../../docs/forms/) and the [envelopes](../../docs/envelopes/README.md "Envelopes"), again [here](../../docs/forms/) |', '',
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
  'docs/docs.csv': 'path,status\ndocs/envelopes/README.md,living\ndocs/envelopes/approval.md,living\ndocs/envelopes/audit.md,record\ndocs/APP.md,living\n',
  'pages/pages.csv': 'top,label,thumb,href\n' + Array.from({ length: 5 }, (_, i) => `main,p${i},thumbs/p${i}.png,p${i}.html`).join('\n') + '\n',
};
const asked = [];
window.GH = class {
  static FRESH = { cache: 'no-store' };
  static refFor(repo){ return repo === hub ? 'codex/program-preview' : 'main'; }
  constructor(opts){ this.opts = opts; }
  async req(url){
    asked.push({ ...this.opts, file: url });
    if (url.startsWith('commits?')) {
      const q = new URLSearchParams(url.slice(8)), since = q.get('since');
      return (commits[q.get('path')] || []).filter(c => !since || c.commit.committer.date >= since);
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
  assert.deepEqual(areas.map(r => r.dataset.area), ['Reply', 'Showing', 'Forms'],
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
      { kind: 'chart' }, { kind: 'views', views: ['?view=sessions', 3] }, { kind: 'measure' }] },
    { icon: 'ph-x' }, { name: 'B', icon: 'not-a-glyph' }] }] } }]);
  assert.deepEqual([...p.areas.map(a => a.name)], ['A', 'B'], 'an area names itself');
  assert.equal(p.areas[1].icon, '', 'an icon is a ph- glyph or nothing');
  const kinds = [...p.areas[0].panels.map(pn => pn.kind)];
  assert.deepEqual(kinds, ['breakdown', 'gallery', 'views', 'measure'],
    'a breakdown needs a CSV and a column, a gallery a CSV and a label or a source, and the kind must be one of four');
  const [bd, gal, views] = p.areas[0].panels;
  assert.deepEqual({ ...bd.icons }, { a: 'ph-x' }, 'group icons are glyphs');
  assert.deepEqual({ ...bd.where }, { k: '^a$' }, 'a pattern that does not compile is dropped');
  assert.equal(gal.source, 'research');
  assert.deepEqual([...views.views], ['?view=sessions']);
  assert.ok(bd.sig && bd.sig !== gal.sig, 'each panel carries its own signature');
  assert.equal(window.Programs.rows([{ repo: hub, config: { programs: [{ name: 'y' }] } }])[0].areas.length, 0, 'no declaration, no areas');
});

test('Programs breaks a registry down, packs tiles in order without holes, and finds an area its icon', () => {
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

  const spans = (w, c) => window.Programs.tileSpans(w, c).map(t => t.i + ':' + t.span).join(' ');
  assert.equal(spans([2, 3, 2, 1, 1], 3), '0:3 1:3 2:2 3:1 4:3',
    'in order: a gap the next tile does not fit widens the row\'s tile, and no later tile is pulled forward into it');
  assert.equal(spans([2, 2], 3), '0:3 1:3', 'a gap nothing fits goes to the row\'s tile');
  assert.equal(spans([1, 1], 3), '0:2 1:1', 'shared out from the first');
  assert.equal(window.Programs.tileSpans([1, 1], 3, [false, true]).map(t => t.span).join(), '1,2', 'a tile of views alone grows last');
  assert.equal(spans([1, 1, 1, 1, 1], 4), '0:1 1:1 2:1 3:1 4:4');
  assert.equal(spans([3, 2], 1), '0:1 1:1', 'one column: every tile one wide, in order');
  for (const c of [1, 2, 3, 4]) {
    const out = window.Programs.tileSpans([2, 1, 3, 1, 2, 1, 1], c);
    assert.deepEqual([...out.map(t => t.i)], [0, 1, 2, 3, 4, 5, 6], c + ' columns: in the order given');
    assert.ok(out.every(t => t.span <= c));
    assert.equal(out.reduce((n, t) => n + t.span, 0) % c, 0, c + ' columns: every row full');
  }
  const P = window.Programs;
  assert.equal(P.panelWeight({ kind: 'measure' }, { measure: { addr: 'x' } }), 2, 'a drawn measure asks for two');
  assert.equal(P.panelWeight({ kind: 'measure' }, { measure: { addr: '' } }), 1);
  assert.equal(P.panelWeight({ kind: 'gallery', thumb: 'thumb' }), 2);
  assert.equal(P.panelWeight({ kind: 'gallery', source: 'research' }, null, 2), 1, 'two research rows fit a narrow tile');
  assert.equal(P.panelWeight({ kind: 'gallery', source: 'research' }, null, 3), 2);
  assert.equal(P.panelWeight({ kind: 'breakdown' }), 1);
  assert.equal(P.tileWant([{ w: 2 }, { w: 1 }, { w: 2 }]), 3, 'at most three');
  assert.equal(P.tileWant([]), 1);

  const prog = { views: ['?view=map&tab=showing', '?view=waiting'] };
  assert.equal(P.areaIcon(prog, 'Showing', { icon: 'ph-books' }), 'ph-books', 'a declared icon first');
  assert.equal(P.areaIcon(prog, 'Showing', null), 'ph-paper-plane-tilt', 'else its Map view\'s');
  assert.equal(P.areaIcon(prog, 'Waiting', null), 'ph-circle-dashed', 'a view outside the Map has only the door, which is no icon');
});

test('Areas draws a tile an area: its icon and files, its declared panels, its width and its fortnight', async () => {
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
  assert.ok(spark.querySelector('[data-week]').parentElement.classList.contains('h-8'), 'word-sized');
  assert.match(spark.textContent, /Closed\s*50%/, 'the marked category, then its share of the last week after the bars');
  assert.match(m.querySelector('[data-panel-head]').textContent.replace(/\s+/g, ' '), /closings\.json Nov\b/, 'one month: its name; no axis under the bars');
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

  // Width: a tile asks for its panels' weight, and the grid packs the rows in
  // the charter's order, with no dense reflow. Height: a tile is its own,
  // so a short one leaves no empty block over its footer; a measure's
  // sparkline is word-sized, so its tile no longer stretches to its row.
  assert.deepEqual(['Reply', 'Showing', 'Forms'].map(k => tile(k).dataset.want), ['3', '3', '1']);
  const grid = page.querySelector('[data-program-tiles]');
  assert.doesNotMatch(grid.className, /dense/);
  assert.ok(grid.classList.contains('items-start'));
  assert.deepEqual(['Reply', 'Showing', 'Forms'].map(k => tile(k).classList.contains('self-stretch')), [false, false, false],
    'Reply draws its measure, and is still its own height');
  assert.equal(page.querySelector('[data-program-tiles]').dataset.cols, '1', 'a pane jsdom gives no width holds one column');
  data.areaCols = 3; await frame();
  assert.deepEqual([...page.querySelectorAll('[data-program-area]')].map(t => t.dataset.area + ':' + t.dataset.span), ['Reply:3', 'Showing:3', 'Forms:3']);
  assert.equal(galleries[2].isConnected ? tile('Showing').querySelectorAll('[data-area-gallery][data-layout="thumbs"] [data-gallery-item]').length : 0, 5,
    'three columns wide, one row of six holds all five');
  data.areaCols = 1; await frame();

  // The fortnight: commits to what the area links, a cell a day, a commit
  // under two of its links counted once, one before the fortnight not at all.
  const c = data.charterOf(p);
  assert.equal(c.areas[0].measure.addr, p.measures[0]);
  assert.equal(c.areas[1].measure.addr, '', 'a longer file name is not the declared file');
  assert.equal(c.areas[2].measure, null, 'only an exact name attaches a row');
  const act = data.activityOf(p);
  assert.deepEqual([...act.read].sort(), ['docs/CONVERSATION.md', 'docs/envelopes/README.md', 'docs/forms/', 'docs/portable.csv', 'docs/portable.md'],
    'every file an area links, a chip left out for its panel included');
  assert.match(page.querySelector('[data-program-fortnight]').textContent.replace(/\s+/g, ' '), /commits to each area's files\s*[A-Z][a-z]+ \d+ → /,
    'what a tile\'s count covers, said once beside the fortnight');
  const areaReads = asked.filter(a => a.file.startsWith('commits?') && new URLSearchParams(a.file.slice(8)).get('since'));
  assert.ok(areaReads.every(a => new URLSearchParams(a.file.slice(8)).get('per_page') === '100'));
  const forms = data.areaDays(p, c.areas[2]);
  assert.equal(forms.count, 2);
  assert.equal(tile('Forms').querySelector('[data-area-count]').textContent.trim(), '2');
  const cells = [...tile('Forms').querySelectorAll('[data-area-activity] [data-day]')];
  assert.equal(cells.length, 14);
  assert.deepEqual(cells.map(b => +b.dataset.n).filter(Boolean), [1, 1]);
  assert.equal(cells.at(-2).dataset.n, '1', 'yesterday');
  assert.equal(data.areaDays(p, c.areas[1]), null, 'an area that links no file has no fortnight');
  assert.equal(tile('Showing').querySelectorAll('[data-day]').length, 0);
  assert.equal(data.areaDays(p, c.areas[0]).count,
    commits['docs/CONVERSATION.md'].filter(x => x.commit.committer.date >= data.areaDays(p, c.areas[0]).days[0].day).length);
  cells.at(-2).click(); await tick(3); await frame();
  assert.deepEqual([...(data.chartTip?.body?.rows || []).map(r => r.label)], ['Forms and envelopes'], 'a day opens its commits');
  data.closeChartTip();
  assert.equal(page.querySelector('[data-program-areas-read]').style.display, 'none', 'every linked path read');
  assert.ok(asked.some(a => a.file === 'docs/portable.csv' && a.ref === 'codex/program-preview'), 'a registry is read at the selected revision');
  assert.equal(asked.filter(a => a.file === 'docs/harness.csv').length, 1, 'once, however many panels read it');
  assert.deepEqual(problems, []);
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
    assert.equal(data.areaDays(wide, areas[4]), null, 'one whose links were not is unread, not quiet');
    for (let i = 0; i < 20 && Object.values(data.registries).some(r => r.state === 'loading' || r.authed); i++) await tick();
    assert.ok(fetched.includes('https://raw.githubusercontent.com/' + hub + '/codex/program-preview/docs/portable.csv'));
    assert.equal(data.regOf(p, 'docs/portable.csv').state, 'ok');
    assert.equal(data.galleryOf(p, { source: 'repos' }).state, 'locked', 'the estate\'s repositories need a token');
  } finally {
    delete window.fetch;
    window.TOKEN = 'fixture-token'; window.__shell._authState = 'auth';
    await settled();
  }
  assert.deepEqual(problems, []);
});
