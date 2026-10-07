// The sidebar Repos index's PROJECT rows: a repo carrying several workspaces
// declares them in its manifest's `projects` field (the defining convention:
// a workspace running a tracker is a project; the repo root's tracker marks
// the repo itself), and the shell renders them indented under the repo's row.
// This holds the halves that could drift apart silently: the normalizer
// (repoProjects: string/object entries, the derived board, junk dropped), the
// PROJECT VIEW a row opens (goProject, its deep link, the README read), and the
// markup wiring for both sidebar lists, the estate's nested one and the repo's
// own.
//
// The shell's app() lives inline in app/index.html, so the test evaluates the
// plain <script> block against stubs via the shared shell.mjs
// harness (see its header for the tactic and its provenance).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { page, makeShell } from './shell.mjs';

test('repoProjects: absent, non-array, or empty config yields no rows', () => {
  const { shell } = makeShell();
  shell.estateConfigs = {};
  assert.deepEqual(shell.repoProjects('mehrlander/home'), []);
  shell.estateConfigs = { 'mehrlander/home': { estate: true } };
  assert.deepEqual(shell.repoProjects('mehrlander/home'), []);
  shell.estateConfigs = { 'mehrlander/home': { projects: 'projects/budget-drs' } };
  assert.deepEqual(shell.repoProjects('mehrlander/home'), [], 'a bare string field is not a list');
});

test('repoProjects: string and object entries normalize to {path, label, board, inbox, powershellOutpost}', () => {
  const { shell } = makeShell();
  shell.estateConfigs = {
    'mehrlander/home': {
      projects: [
        'news',
        { path: 'projects/budget-drs' },
        // A `ph-` icon is kept as given: the rows draw it as that glyph.
        { path: 'projects/budget-wa/', label: 'WA budget', icon: 'ph-bank' },
      ],
    },
  };
  assert.deepEqual(shell.repoProjects('mehrlander/home'), [
    { path: 'news', label: 'news', board: 'news/tracker/board.md', landing: '', icon: '', inbox: null, powershellOutpost: '' },
    { path: 'projects/budget-drs', label: 'budget-drs',
      board: 'projects/budget-drs/tracker/board.md', landing: '', icon: '', inbox: null, powershellOutpost: '' },
    { path: 'projects/budget-wa', label: 'WA budget',
      board: 'projects/budget-wa/tracker/board.md', landing: '', icon: 'ph-bank', inbox: null, powershellOutpost: '' },
  ]);
});

test('repoProjects: a landing is kept as a root-relative path, junk reads as undeclared', () => {
  const { shell } = makeShell();
  shell.estateConfigs = {
    'mehrlander/home': {
      projects: [
        { path: 'projects/a', landing: 'projects/a/app/view/app.html' },
        { path: 'projects/b', landing: '/projects/b/index.html/' },  // stray slashes trimmed
        { path: 'projects/c', landing: '' },
        { path: 'projects/d', landing: 42 },
        { path: 'projects/e' },
      ],
    },
  };
  assert.deepEqual(shell.repoProjects('mehrlander/home').map(p => p.landing), [
    'projects/a/app/view/app.html',
    'projects/b/index.html',
    '', '', '',
  ]);
});

test('repoProjects: the board is derived from the convention, and overridable', () => {
  const { shell } = makeShell();
  shell.estateConfigs = {
    'mehrlander/home': {
      projects: [
        { path: 'projects/a', tracker: 'projects/a/work/board.md' },   // named elsewhere
        { path: 'projects/b', tracker: 'boards/b/' },                  // a folder, trailing slash
        { path: 'projects/c', tracker: false },                        // no board button
        { path: 'projects/d', tracker: '' },                           // empty falls back
      ],
    },
  };
  assert.deepEqual(shell.repoProjects('mehrlander/home').map(p => p.board), [
    'projects/a/work/board.md',
    'boards/b',
    '',
    'projects/d/tracker/board.md',
  ]);
});

test('repoProjects: junk entries drop instead of throwing', () => {
  const { shell } = makeShell();
  shell.estateConfigs = {
    'mehrlander/home': { projects: [null, 42, {}, { path: '' }, { label: 'no path' }, 'ok'] },
  };
  assert.deepEqual(shell.repoProjects('mehrlander/home'),
    [{ path: 'ok', label: 'ok', board: 'ok/tracker/board.md', landing: '', icon: '', inbox: null, powershellOutpost: '' }]);
});

// The workspace's own tray, and the reason it is DECLARED where `board` above
// is derived: a board is a link, so a wrong guess costs a 404, while an inbox
// is a write target and a wrong guess files a deposit into a plausible folder
// nothing drains. repoProjects guards on the kit's absence, which is why every
// other test here reads inbox: null; this one loads the real parser the way the
// page does, as an IIFE assigning window.RepoAddress.
test('repoProjects: an inbox parses in the repo-level grammar, and stays optional', () => {
  const { shell, win } = makeShell();
  new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/repo-address.js'), 'utf8'))(win);
  shell.estateConfigs = {
    'mehrlander/home': {
      projects: [
        { path: 'projects/wps', inbox: 'projects/wps/dump' },
        { path: 'projects/b', inbox: '@drop:incoming' },
        { path: 'projects/c', inbox: 'mehrlander/other@v2:tray' },
        { path: 'projects/d' },
        { path: 'projects/e', inbox: 42 },
      ],
    },
  };
  assert.deepEqual(shell.repoProjects('mehrlander/home').map(p => p.inbox), [
    { repo: 'mehrlander/home', ref: '', dir: 'projects/wps/dump' },
    { repo: 'mehrlander/home', ref: 'drop', dir: 'incoming' },
    { repo: 'mehrlander/other', ref: 'v2', dir: 'tray' },
    null,
    null,
  ]);
});

test('openProject switches the repo, then opens the project view', async () => {
  const { shell, browserStore } = makeShell({ browserStore: { repo: '' } });
  const calls = [];
  shell.ensureBrowser = async (repo) => { calls.push(['ensure', repo]); browserStore.repo = repo; };
  shell.syncUrl = () => {};
  shell.loadProjectReadme = async () => { calls.push('readme'); };
  await shell.openProject('mehrlander/home', { path: 'projects/budget-drs' });
  assert.deepEqual(calls, [['ensure', 'mehrlander/home'], 'readme']);
  assert.equal(shell.view, 'project');
  assert.equal(shell.projectPath, 'projects/budget-drs');
});

test('openProject does not navigate when the repo switch failed', async () => {
  const { shell } = makeShell({ browserStore: { repo: 'mehrlander/web-tools' } });
  const calls = [];
  shell.ensureBrowser = async () => { calls.push('ensure'); /* pickByName failed; repo unchanged */ };
  shell.syncUrl = () => {};
  shell.loadProjectReadme = async () => { calls.push('readme'); };
  await shell.openProject('mehrlander/home', { path: 'projects/budget-drs' });
  assert.deepEqual(calls, ['ensure'], 'a failed switch must not open a project in the wrong repo');
  assert.notEqual(shell.view, 'project');
});

test('goProject sets the view, normalizes the path, and reads the README', () => {
  const { shell } = makeShell({ browserStore: { repo: 'mehrlander/home' } });
  const reads = [];
  shell.syncUrl = () => {};
  shell.loadProjectReadme = async () => { reads.push(shell.projectPath); };
  shell.goProject('projects/budget-wa/');
  assert.equal(shell.view, 'project');
  assert.equal(shell.projectPath, 'projects/budget-wa', 'a trailing slash is trimmed');
  assert.deepEqual(reads, ['projects/budget-wa']);
  // An empty path is not a destination.
  shell.goProject('');
  assert.equal(shell.projectPath, 'projects/budget-wa');
});

test('the open project resolves to its declared entry, or a derived one', () => {
  const { shell } = makeShell({ browserStore: { repo: 'mehrlander/home' } });
  shell.estateConfigs = {
    'mehrlander/home': { projects: [{ path: 'projects/a', label: 'Alpha' }] },
  };
  shell.syncUrl = () => {};
  shell.loadProjectReadme = async () => {};
  shell.goProject('projects/a');
  assert.deepEqual(shell.project, { path: 'projects/a', label: 'Alpha',
                                    board: 'projects/a/tracker/board.md', landing: '', icon: '', inbox: null, powershellOutpost: '' });
  // A deep link may name a workspace the manifest has not caught up with; the
  // view still opens, on the conventions the path itself implies.
  shell.goProject('projects/unlisted');
  assert.deepEqual(shell.project, { path: 'projects/unlisted', label: 'unlisted',
                                    board: 'projects/unlisted/tracker/board.md', landing: '', icon: '', inbox: null, powershellOutpost: '' });
});

test('repoProjects prefers the OPEN repo\'s live manifest over the estate cache', () => {
  const { shell, browserStore } = makeShell({ browserStore: { repo: 'mehrlander/home' } });
  shell.estateConfigs = { 'mehrlander/home': { projects: ['stale'] } };
  browserStore.config = { projects: ['live'] };
  assert.deepEqual(shell.repoProjects('mehrlander/home').map(p => p.path), ['live'],
    'inside a repo the manifest at the browsed ref wins over the main-derived cache');
  // Any other repo still reads the cache, which is all there is for one you are
  // not standing in.
  shell.estateConfigs['mehrlander/other'] = { projects: ['cached'] };
  assert.deepEqual(shell.repoProjects('mehrlander/other').map(p => p.path), ['cached']);
});

test('openProjectBoard routes a file board to the Board pill, a folder board to Files', async () => {
  const { shell, browserStore } = makeShell({ browserStore: { repo: '' } });
  const calls = [];
  shell.ensureBrowser = async (repo) => { calls.push(['ensure', repo]); browserStore.repo = repo; };
  shell.openFolder = async (p) => { calls.push(['folder', p]); };
  shell.goProject = (path, tab) => { calls.push(['project', path, tab]); };

  // A file board lands on the rendered, navigable pill, so every board tap
  // (estate row, repo sidebar row, header button) reads the same surface.
  await shell.openProjectBoard('mehrlander/home',
    { path: 'projects/a', board: 'projects/a/tracker/board.md' });
  assert.deepEqual(calls, [['ensure', 'mehrlander/home'], ['project', 'projects/a', 'board']]);

  // A `tracker` naming a folder has no one file to render: openPin's rule.
  calls.length = 0;
  await shell.openProjectBoard('mehrlander/home', { path: 'projects/b', board: 'projects/b/tracker' });
  assert.deepEqual(calls, [['ensure', 'mehrlander/home'], ['folder', 'projects/b/tracker']]);

  // A project with no board never reaches the browser at all (the button is
  // hidden too, but the method is what would run if it were tapped).
  calls.length = 0;
  await shell.openProjectBoard('mehrlander/home', { path: 'projects/c', board: '' });
  assert.deepEqual(calls, []);
});

test('the Board pill exists for a file board only, and renders the board keyed per ref', async () => {
  const gets = [];
  const { shell, browserStore } = makeShell({ browserStore: {
    repo: 'mehrlander/home', ref: 'main', defaultRef: 'main',
    gh: { get: async (p) => { gets.push(p); return { text: '# Board' }; } },
  }});
  shell.syncUrl = () => {};
  browserStore.config = { projects: [
    { path: 'projects/a' },
    { path: 'projects/b', tracker: 'projects/b/boards' },
  ] };
  shell.goProject('projects/a', 'board');
  assert.equal(shell.projectBoardFile, 'projects/a/tracker/board.md');
  await new Promise(r => setTimeout(r));
  // The typed projection is tried first (docs/TRACKER.md, board.csv). This
  // stub answers every path with the same markdown, which reads as a CSV with a
  // header and no rows, so the loader falls through to the markdown board:
  // exactly the path a tracker that has not regenerated yet takes. Both fetches
  // are the correct trace for that case; the projection's own path is covered
  // in shell-board-review.test.mjs.
  assert.deepEqual(gets, ['projects/a/tracker/board.csv', 'projects/a/tracker/board.md']);
  assert.equal(shell.projectBoardTasks, null, 'nothing parsed as a projection');
  assert.equal(shell.projectBoardLoading, false);
  // marked is unloadable under the harness, so the render falls back to the
  // escaped <pre>; the loader having produced SOMETHING is the contract here.
  assert.match(shell.projectBoardHtml, /Board/);
  // A folder board earns no pill; the header button keeps the folder route.
  shell.projectPath = 'projects/b';
  assert.equal(shell.projectBoardFile, '');
});

test('resolveRepoRelative folds board links onto repo-root paths', () => {
  const { shell } = makeShell();
  const base = 'projects/a/tracker';
  assert.equal(shell.resolveRepoRelative(base, 'tasks/foo-x1.md'), 'projects/a/tracker/tasks/foo-x1.md');
  assert.equal(shell.resolveRepoRelative(base, './README.md'), 'projects/a/tracker/README.md');
  assert.equal(shell.resolveRepoRelative(base, '../notes/x.md'), 'projects/a/notes/x.md');
  assert.equal(shell.resolveRepoRelative(base, '../../../tools'), 'tools');
  assert.equal(shell.resolveRepoRelative(base, 'tasks/foo.md#L10'), 'projects/a/tracker/tasks/foo.md',
    'a fragment is display baggage, not path');
  assert.equal(shell.resolveRepoRelative(base, '/docs/TRACKER.md'), 'docs/TRACKER.md',
    'a root-absolute href resolves from the repo root');
  assert.equal(shell.resolveRepoRelative(base, '../../../../escape.md'), '',
    'a hop past the root resolves to nothing rather than guessing');
  assert.equal(shell.resolveRepoRelative(base, ''), '');
});

test('onReadmeClick opens a README link in the viewer, resolved against the project folder', () => {
  // The Overview renders the workspace README, whose relative links name its
  // siblings. They must reach the shell's viewer, not the app's own URL.
  const { shell } = makeShell();
  shell.projectPath = 'projects/a';
  const opened = [];
  shell.openFile = p => opened.push(['file', p]);
  shell.openFolder = p => opened.push(['folder', p]);
  const click = href => {
    let prevented = false;
    const a = { getAttribute: () => href };
    shell.onReadmeClick({ target: { closest: () => a }, preventDefault: () => { prevented = true; } });
    return prevented;
  };
  assert.equal(click('rules.csv'), true);
  assert.equal(click('lenses/x.md'), true);
  assert.equal(click('proposals/'), true);
  assert.equal(click('../text/README.md'), true);
  assert.equal(click('https://example.com/a'), false, 'an absolute link keeps its default');
  assert.equal(click('#top'), false, 'an in-page anchor keeps its default');
  assert.deepEqual(opened, [
    ['file', 'projects/a/rules.csv'],
    ['file', 'projects/a/lenses/x.md'],
    ['folder', 'projects/a/proposals'],
    ['file', 'projects/text/README.md'],
  ]);
});

test('projectGithubUrl points at the folder, at the ref a row tap would browse', () => {
  // The real link builder, so the encoding contract is exercised rather than
  // restated: lib/kits/github-links.js only assigns onto window.
  const win = {};
  new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/github-links.js'), 'utf8'))(win);
  const { shell, browserStore } = makeShell({
    win, browserStore: { repo: 'mehrlander/web-tools', ref: 'main', defaultRef: 'main' },
  });
  const p = { path: 'projects/budget-wa' };
  // A repo you are not browsing: no ref to name, so HEAD.
  assert.equal(shell.projectGithubUrl('mehrlander/home', p),
    'https://github.com/mehrlander/home/tree/HEAD/projects/budget-wa');
  // The open repo, off its default branch: the browsed ref is stamped.
  browserStore.ref = 'claude/some-branch';
  assert.equal(shell.projectGithubUrl('mehrlander/web-tools', p),
    'https://github.com/mehrlander/web-tools/tree/claude/some-branch/projects/budget-wa');
  // Under a branch overlay, the branch a tap would open the repo at wins, even
  // for a repo that is not the open one.
  shell.overlayRefFor = (repo) => (repo === 'mehrlander/home' ? 'claude/overlay' : '');
  assert.equal(shell.projectGithubUrl('mehrlander/home', p),
    'https://github.com/mehrlander/home/tree/claude/overlay/projects/budget-wa');
});

test('a project deep-links as ?repo&view=project&project=', () => {
  const { shell, history } = makeShell({
    browserStore: { repo: 'mehrlander/home', ref: 'main', defaultRef: 'main' },
  });
  const stamped = [];
  history.pushState = (a, b, url) => stamped.push(url);
  history.replaceState = (a, b, url) => stamped.push(url);
  shell.loadProjectReadme = async () => {};
  shell.goProject('projects/budget-wa');
  const last = stamped.at(-1);
  assert.match(last, /view=project/);
  assert.match(last, /project=projects%2Fbudget-wa/);
  assert.match(last, /repo=mehrlander%2Fhome/);
  // Leaving the view drops both keys rather than stranding them on the next URL.
  shell.view = 'landing';
  shell.syncUrl();
  assert.doesNotMatch(stamped.at(-1), /view=project|project=/);
});

test('parseUrl reads the project back off a deep link', () => {
  const { shell } = makeShell({
    search: '?repo=mehrlander/home&view=project&project=projects/budget-wa',
  });
  const url = shell.parseUrl();
  assert.equal(url.view, 'project');
  assert.equal(url.project, 'projects/budget-wa');
  assert.equal(url.repo, 'mehrlander/home');
});

test('the sidebar markup wires the project rows to the shell methods', () => {
  assert.match(page, /x-for="p in repoProjects\(r\.repo\)"/,
    'the Repos index no longer iterates repoProjects');
  assert.match(page, /@click="openProject\(r\.repo, p\)"/,
    'a project row no longer opens through openProject');
  assert.match(page, /repoProjects\(r\.repo\)"[^>]*:key="r\.repo \+ ':' \+ p\.path"/,
    'project rows need a repo-scoped key (two repos may declare the same path)');
  assert.match(page, /@click\.stop="openProjectBoard\(r\.repo, p\)"/,
    'the board button no longer opens through openProjectBoard');
  assert.match(page, /:href="projectGithubUrl\(r\.repo, p\)"/,
    'the github button no longer links through projectGithubUrl');
  // The leading glyph came back as each project's OWN icon: it had gone because
  // every row took the same defaulted glyph, which distinguished nothing.
  assert.match(page, /:src="projectIconSrc\(r\.repo, p\)"/, 'an estate project row no longer draws its icon');
  assert.match(page, /:src="projectIconSrc\(\$store\.browser\.repo, p\)"/, 'a repo sidebar project row no longer draws its icon');
  assert.equal((page.match(/:class="projectGlyph\(p\)"|projectGlyph\(p\), view==='project'/g) || []).length, 2,
    'both project lists fall back to the stock glyph where a project has no picture');
});

test('the repo sidebar carries the same list, and the pane binds the open one', () => {
  // Inside a repo the projects are a section of their own, reading the same
  // normalizer the estate list reads, and selecting one lights that row.
  assert.match(page, /x-for="p in repoProjects\(\$store\.browser\.repo\)"/,
    'the repo sidebar no longer lists the open repo\'s projects');
  assert.match(page, /@click="goProject\(p\.path\)"/,
    'a repo-sidebar project row no longer opens the project view');
  assert.match(page, /view==='project' && projectPath===p\.path/,
    'the repo-sidebar row no longer shows which project is open');
  // The pane is bound to shell state, which is what makes a selection repaint
  // it; a nested component would have to reach through window.__shell.
  assert.match(page, /x-show="view==='project'"/, 'the project pane is gone');
  assert.match(page, /x-html="projectHtml"/, 'the project pane no longer renders its README');
});

test('both project lists hang off the same rule, and the card carries neither list', () => {
  // Two lists now, not three: the estate sidebar's nested rows and the repo
  // sidebar's Projects section. One treatment; a change to one that skips the
  // other is the drift this catches.
  assert.match(page, /class="flex flex-col gap-0\.5 ml-4 pl-2 border-l border-base-300"/,
    'the repo sidebar\'s Projects section no longer hangs off the rule');

  // The estate card dropped its pins and projects bands on 2026-07-31: two
  // bands of static navigation sat above the only row reporting live state
  // (branches, stranded, open PRs), and a card answers "does this repo need
  // me?", which a list that reads the same every day cannot help answer. Both
  // are one sidebar tap away. Asserted as an absence so a later change has to
  // be deliberate about putting them back.
  const estate = readFileSync(path.join(repoRoot, 'lib/alpineComponents/estate.js'), 'utf8');
  assert.doesNotMatch(estate, /face\(e\)\.projects/,
    'the estate card renders projects again');
  assert.doesNotMatch(estate, /face\(e\)\.pins/,
    'the estate card renders pins again');
  // And the entry stops carrying what nothing reads, so the dead fields cannot
  // quietly come back ahead of the markup.
  assert.doesNotMatch(estate, /^\s*projects: window\.__shell/m,
    'the card entry carries a projects field again with no consumer');
  assert.doesNotMatch(estate, /^\s*pins: Array\.isArray\(cfg\.pins\)/m,
    'the card entry carries a pins field again with no consumer');

  // The live row is what the space was cleared for; losing it silently would
  // make the removal a net loss.
  assert.match(estate, /cardActivity\(face\(e\)\.repo\)/,
    'the card no longer reports branch activity');
});

test('a landing is the App tab, rendered through toss-render at the browsed ref, and the Overview stays the README', () => {
  const { shell, browserStore } = makeShell({
    browserStore: { repo: 'mehrlander/home', ref: 'main', defaultRef: 'main' },
  });
  browserStore.config = { projects: [{ path: 'projects/a', landing: 'projects/a/app.html' }, { path: 'projects/plain' }] };
  shell.syncUrl = () => {};
  const reads = [];
  shell.loadProjectReadme = async () => reads.push('readme');
  shell.loadProjectDocs = async () => reads.push('docs');
  shell.goProject('projects/a');
  assert.equal(shell.projectTab, 'overview');
  assert.deepEqual(reads, ['readme'], 'the Overview is the README even where a landing is declared');
  shell.goProjectTab('app');
  assert.deepEqual(reads, ['readme'], 'the App tab reads nothing itself: its frame loads the page');
  assert.equal(shell.projectLandingUrl, '../pages/toss-render.html#gh=mehrlander/home:projects/a/app.html');
  // Off the default branch the landing follows the browsed ref, like
  // projectGithubUrl: inside a repo the honest list is the one on the ref you
  // are standing on, and its landing is too.
  browserStore.ref = 'claude/b';
  assert.equal(shell.projectLandingUrl, '../pages/toss-render.html#gh=mehrlander/home@claude/b:projects/a/app.html');
  // The tabs load only what they render: Docs fetches its listing, Pages
  // fetches nothing (a pure derivation off the manifest already in hand).
  shell.goProjectTab('docs');
  assert.deepEqual(reads, ['readme', 'docs']);
  shell.goProjectTab('pages');
  assert.deepEqual(reads, ['readme', 'docs']);
  // App exists only where a landing is declared; asked of another workspace it draws the Overview.
  shell.goProject('projects/plain', 'app');
  assert.equal(shell.projectPane, 'overview');
});


test('the FAB busts out of a project landing embed', () => {
  const { shell, browserStore } = makeShell({
    browserStore: { repo: 'mehrlander/home', ref: 'main', defaultRef: 'main' },
  });
  browserStore.config = { projects: [{ path: 'projects/a', label: 'Alpha', landing: 'projects/a/app.html' }] };
  shell.view = 'project';
  shell.projectPath = 'projects/a';
  shell.projectTab = 'app';
  const acts = shell.actions;
  assert.equal(acts.length, 1);
  assert.equal(acts[0].label, 'Open Alpha landing full-page');
  assert.match(acts[0].run().nav, /toss-render\.html#gh=mehrlander\/home:projects\/a\/app\.html$/);
  // The other tabs are not an embed, the README Overview included, so there is nothing to bust out of.
  shell.projectTab = 'overview';
  assert.deepEqual(shell.actions, []);
  shell.projectTab = 'docs';
  assert.deepEqual(shell.actions, []);
});


test('projectPages is the workspace slice of the repo catalog, derived not declared', () => {
  const { shell, browserStore } = makeShell({
    browserStore: { repo: 'mehrlander/home', ref: 'main', defaultRef: 'main' },
  });
  browserStore.config = {
    projects: ['projects/budget-drs'],
    pages: [
      { path: 'projects/budget-drs/app/view/app.html', title: 'Budget DRS', note: 'Fiscal explorer.' },
      { path: 'projects/budget-wa/dashboard/index.html', title: 'Another workspace' },
      { path: 'chron/blog/index.html', title: 'Claimed', project: 'projects/budget-drs' },
      { path: 'mehrlander/web-tools:pages/links.html', title: 'Cross-repo, unclaimed' },
      null, { title: 'no path' },
    ],
  };
  shell.syncUrl = () => {};
  shell.loadProjectReadme = async () => {};
  shell.goProject('projects/budget-drs');
  const items = shell.projectPages;
  // In-folder by prefix, plus the explicit `project` claim; a sibling
  // workspace's page and an unclaimed cross-repo page stay out.
  assert.deepEqual(items.map(i => i.label), ['Budget DRS', 'Claimed']);
  assert.equal(items[0].live,
    '../pages/toss-render.html#gh=mehrlander/home:projects/budget-drs/app/view/app.html');
  assert.equal(items[0].code,
    'https://github.com/mehrlander/home/blob/main/projects/budget-drs/app/view/app.html');
  // Browsing off the default branch, the tiles follow the ref like the rest of
  // the project view.
  browserStore.ref = 'claude/branch';
  assert.equal(shell.projectPages[0].live,
    '../pages/toss-render.html#gh=mehrlander/home@claude/branch:projects/budget-drs/app/view/app.html');
});

test('a route into the project\'s landing is a card that opens the App tab there, and the landing itself is not', () => {
  const { shell, browserStore } = makeShell({
    browserStore: { repo: 'mehrlander/home', ref: 'main', defaultRef: 'main' },
  });
  const APP = 'projects/budget-drs/app/view/app.html';
  browserStore.config = {
    projects: [{ path: 'projects/budget-drs', landing: APP }],
    pages: [
      { path: APP, title: 'Budget DRS', appView: true },
      { path: APP, query: 'view=submittal', title: 'Submittal' },
      { path: APP, query: '?view=spend&tab=acfr', title: 'Spend: ACFR' },
      { path: 'projects/budget-drs/cem/cem.html', query: 'tab=q9', title: 'CEM' },
    ],
  };
  shell.syncUrl = () => {};
  shell.loadProjectReadme = async () => {};
  shell.goProject('projects/budget-drs', 'pages');
  const items = shell.projectPages;
  assert.deepEqual(items.map(i => i.label), ['Submittal', 'Spend: ACFR', 'CEM'],
    'the landing with no query is the App tab already, so it is no card');
  assert.deepEqual(items.map(i => i.route), ['view=submittal', 'view=spend&tab=acfr', null],
    'a query on the landing is a route; a query on another page is only that page\'s address');
  assert.equal(new Set(items.map(i => i.key)).size, 3, 'one page, several cards, distinct keys');
  assert.equal(items[1].live, '../pages/toss-render.html#gh=mehrlander/home:' + APP + '?view=spend&tab=acfr');
  assert.equal(items[2].live, '../pages/toss-render.html#gh=mehrlander/home:projects/budget-drs/cem/cem.html?tab=q9');
  assert.equal(items[1].thumb, 'thumbs/mehrlander/home/projects/budget-drs/app/view/app@view-spend-tab-acfr.png');
  assert.equal(items[2].thumb, '', 'only a route card reads a cached shot; a page keeps its live preview');

  shell.openProjectApp('?view=spend&tab=acfr');
  assert.equal(shell.projectPane, 'app');
  assert.equal(shell.projectLandingUrl, '../pages/toss-render.html#gh=mehrlander/home:' + APP + '?view=spend&tab=acfr');
  const q = shell.deepLinkParams(new URLSearchParams());
  assert.equal(q.get('tab'), 'app');
  assert.equal(q.get('item'), 'view=spend&tab=acfr', 'the route rides the address as &item=');
  assert.equal(new URLSearchParams(shell.projectAppHref('view=submittal').split('?')[1]).get('item'), 'view=submittal');

  shell.openProjectApp('');
  assert.equal(shell.projectLandingUrl, '../pages/toss-render.html#gh=mehrlander/home:' + APP, 'the App button is the app\'s front');
  assert.equal(shell.deepLinkParams(new URLSearchParams()).get('item'), null);

  shell.goProject('projects/budget-drs', 'app', 'view=submittal');
  assert.equal(shell.projectAppRoute, 'view=submittal', 'a cold link lands on its route');
  shell.goProject('projects/other', 'app');
  assert.equal(shell.projectAppRoute, '', 'another project starts at its own front');
});

test('a route card takes a plain click in place and leaves a modified one to its link', () => {
  const { shell } = makeShell();
  const opened = [];
  shell.openProjectApp = (r) => opened.push(r);
  let prevented = 0;
  const ev = (mods = {}) => ({ preventDefault: () => { prevented++; }, ...mods });
  shell.followProjectRoute(ev(), 'view=a');
  shell.followProjectRoute(ev({ metaKey: true }), 'view=b');
  shell.followProjectRoute(ev({ ctrlKey: true }), 'view=c');
  assert.deepEqual(opened, ['view=a']);
  assert.equal(prevented, 1);
  assert.match(page, /@click="followProjectRoute\(\$event, pg\.route\)" data-project-route/,
    'the route card face no longer routes its click through followProjectRoute');
});

test('the repo Pages gallery gives a page query its own tile, and never defaults an app to live', async () => {
  const { shell, gallery, browserStore, win } = makeShell({
    browserStore: { repo: 'mehrlander/home', ref: 'main', defaultRef: 'main' },
  });
  const APP = 'projects/budget-drs/app/view/app.html';
  browserStore.config = {
    projects: [{ path: 'projects/budget-drs', landing: APP }],
    pages: [
      { path: APP, title: 'Budget DRS' },
      { path: APP, query: 'view=submittal', title: 'Submittal' },
      { path: 'tools/map.html', title: 'Map' },
    ],
  };
  win.__shell = shell;
  await gallery.load();
  const items = gallery.groups[0].items;
  assert.deepEqual(items.map(i => i.view), ['shot', 'shot', 'live'],
    'an app with no cached shot opens on the missing-shot face; a page stays live');
  assert.deepEqual(items.map(i => i.shotMissing), [true, true, false]);
  assert.equal(items[1].href, '../pages/toss-render.html#gh=mehrlander/home:' + APP + '?view=submittal');
  assert.equal(new Set(items.map(i => i.href)).size, 3, 'the tiles key on href, so a route is its own tile');
});

test('the app\'s thumb path and the thumb builder\'s name one file', () => {
  // repo-pages-shots.mjs writes the cache the galleries read; a route folded
  // into the name differently on either side would be a shot nothing finds.
  const fn = (src, name) => {
    const m = src.match(new RegExp('function ' + name + '\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}'));
    assert.ok(m, name + ' was not found');
    return new Function('return (' + m[0] + ')')();
  };
  const app = fn(page, 'catalogThumbPath');
  const builder = fn(readFileSync(path.join(repoRoot, 'tools/build/repo-pages-shots.mjs'), 'utf8'), 'thumbRel');
  for (const [p, q] of [['a/b.html', ''], ['a/app.html', 'view=spend&tab=acfr'], ['a/app.htm', '?View=Fund'], ['x.html', '&&']]) {
    assert.equal(app('o/r', p, q), 'thumbs/o/r/' + builder(p, q), p + ' ' + q);
  }
  assert.equal(app('o/r', 'a/b.html', ''), 'thumbs/o/r/a/b.png', 'a page with no query keeps the name it always had');
});

test('groupProjectDocs: root leads, folders alphabetical, READMEs lead their folder', () => {
  const { shell } = makeShell();
  const groups = shell.groupProjectDocs([
    'submittal/plan.md', 'README.md', 'submittal/README.md', 'app/notes.md',
    'DOCS.md', 'submittal/checklist.md',
  ]);
  assert.deepEqual(groups.map(g => g.dir), ['', 'app', 'submittal']);
  assert.deepEqual(groups[0].files.map(f => f.name), ['README.md', 'DOCS.md']);
  assert.deepEqual(groups[2].files.map(f => f.rel),
    ['submittal/README.md', 'submittal/checklist.md', 'submittal/plan.md']);
});

test('loadProjectDocs filters the tree to workspace markdown, and failure is not "no docs"', async () => {
  const tree = [
    { path: 'projects/a/README.md', type: 'blob' },
    { path: 'projects/a/DOCS.md', type: 'blob' },
    { path: 'projects/a/notes/x.md', type: 'blob' },
    { path: 'projects/a/notes', type: 'tree' },        // a folder is not a doc
    { path: 'projects/a/app.html', type: 'blob' },     // not markdown
    { path: 'projects/ab/decoy.md', type: 'blob' },    // sibling sharing the prefix chars
    { path: 'other/y.md', type: 'blob' },
  ];
  const gets = [];
  const { shell } = makeShell({ browserStore: {
    repo: 'mehrlander/home', ref: '', defaultRef: 'main',
    gh: {
      req: async (u) => { assert.equal(u, 'git/trees/HEAD?recursive=1'); return { tree }; },
      get: async (p) => { gets.push(p); return { text: '# idx' }; },
    },
  }});
  shell.projectPath = 'projects/a';
  await shell.loadProjectDocs();
  assert.deepEqual(shell.projectDocs.map(g => g.dir), ['', 'notes']);
  assert.equal(shell.projectDocsCount, 3);
  assert.equal(shell.projectDocsLoading, false);
  // A DOCS.md is fetched as the curated lead when the workspace keeps one (its
  // render is a browser concern; here the read is what is observable).
  assert.deepEqual(gets, ['projects/a/DOCS.md']);
  // The filter narrows by full relative path, dropping emptied groups.
  shell.projectDocsQ = 'notes';
  assert.deepEqual(shell.projectDocsGroups.map(g => g.dir), ['notes']);

  const { shell: s2 } = makeShell({ browserStore: {
    repo: 'mehrlander/home', ref: '', defaultRef: 'main',
    gh: { req: async () => { throw new Error('nope'); } },
  }});
  s2.projectPath = 'projects/a';
  await s2.loadProjectDocs();
  assert.equal(s2.projectDocs, null, 'a failed tree read must stay distinct from an empty workspace');
  assert.equal(s2.projectDocsLoading, false);
});

test('loadProjectDocs leads with docs/README.md and counts source packages instead of listing them', async () => {
  // The four-slot rule puts a workspace's documentation map at docs/README.md;
  // DOCS.md is the older name and stays honoured when it is the only one.
  const tree = [
    { path: 'projects/a/README.md', type: 'blob' },
    { path: 'projects/a/DOCS.md', type: 'blob' },
    { path: 'projects/a/docs/README.md', type: 'blob' },
    { path: 'projects/a/data/source/2026-06-01-pull/README.md', type: 'blob' },
    { path: 'projects/a/data/source/2026-06-01-pull/ACFR_2024.md', type: 'blob' },
    { path: 'projects/a/submittal/source-docs/2026-07-01-forms/README.md', type: 'blob' },
    { path: 'projects/a/data/design/SCHEMA.md', type: 'blob' },
  ];
  const gets = [];
  const { shell } = makeShell({ browserStore: {
    repo: 'mehrlander/home', ref: '', defaultRef: 'main',
    gh: {
      req: async () => ({ tree }),
      get: async (p) => { gets.push(p); return { text: '# map' }; },
    },
  }});
  shell.projectPath = 'projects/a';
  await shell.loadProjectDocs();
  assert.deepEqual(gets, ['projects/a/docs/README.md'], 'docs/README.md wins over DOCS.md as the curated lead');
  assert.equal(shell.projectDocsCount, 4, 'source-package documents are not listed');
  assert.equal(shell.projectDocsSourced, 3, 'but they are counted');
  assert.deepEqual(shell.projectDocs.map(g => g.dir), ['', 'data/design', 'docs']);
  assert.equal(shell.isSourcePackageDoc('data/source/x/README.md'), true);
  assert.equal(shell.isSourcePackageDoc('cem/source-docs/x.md'), true);
  assert.equal(shell.isSourcePackageDoc('data/sources.md'), false);
});

test('a doc opens in the reader beside the tree, and its path rides as &item=', () => {
  const { shell } = makeShell({ browserStore: { repo: 'mehrlander/home', ref: 'main', defaultRef: 'main' } });
  shell.syncUrl = () => {};
  const loads = [];
  shell.loadProjectDocs = async () => {};
  shell.loadProjectDoc = () => loads.push(shell.projectDocSel);
  shell.goProject('projects/a', 'docs');
  shell.openProjectDoc('notes/x.md');
  shell.openProjectDoc('');
  assert.equal(shell.projectDocSel, 'notes/x.md');
  assert.equal(loads.at(-1), 'notes/x.md');
  const p = shell.deepLinkParams(new URLSearchParams());
  assert.equal(p.get('tab'), 'docs');
  assert.equal(p.get('item'), 'projects/a/notes/x.md');
  // An address restores it, and another workspace starts with nothing open.
  shell.goProject('projects/b', 'docs');
  assert.equal(shell.projectDocSel, '');
  shell.goProject('projects/a', 'docs', 'projects/a/notes/x.md');
  assert.equal(shell.projectDocSel, 'notes/x.md');
  shell.closeProjectDoc();
  assert.equal(shell.deepLinkParams(new URLSearchParams()).get('item'), null);
});

test('Docs nests the listing into a tree, counts rolled up, the first level open', () => {
  const { shell } = makeShell();
  const f = (rel) => ({ rel, name: rel.split('/').pop() });
  shell.projectDocs = [
    { dir: '', files: [f('README.md')] },
    { dir: 'app', files: [f('app/README.md')] },
    { dir: 'app/view', files: [f('app/view/a.md'), f('app/view/b.md')] },
    { dir: 'docs', files: [f('docs/x.md')] },
  ];
  const show = () => shell.projectDocsRows.map(r => '  '.repeat(r.depth)
    + (r.kind === 'dir' ? r.name + '/ ' + r.n + (r.open ? '' : ' (closed)') : r.name));
  assert.deepEqual(show(), ['README.md', 'app/ 3', '  README.md', '  view/ 2 (closed)', 'docs/ 1', '  x.md']);
  const view = shell.projectDocsRows.find(r => r.dir === 'app/view');
  shell.toggleProjectDocsDir(view.dir, view.open);
  assert.deepEqual(show().slice(3, 6), ['  view/ 2', '    a.md', '    b.md'], 'a tap opens a folder and it stays open');
  const app = shell.projectDocsRows.find(r => r.dir === 'app');
  shell.toggleProjectDocsDir(app.dir, app.open);
  assert.deepEqual(show(), ['README.md', 'app/ 3 (closed)', 'docs/ 1', '  x.md']);
  shell.projectDocsQ = 'b.md';
  assert.deepEqual(show(), ['app/ 1', '  view/ 1', '    b.md'], 'a filter opens every folder holding a match');
});


test('a non-default pill rides the deep link as &tab=, and boot routes it back', () => {
  const { shell, history } = makeShell({
    browserStore: { repo: 'mehrlander/home', ref: 'main', defaultRef: 'main' },
  });
  const stamped = [];
  history.pushState = (a, b, url) => stamped.push(url);
  history.replaceState = (a, b, url) => stamped.push(url);
  shell.loadProjectReadme = async () => {};
  shell.loadProjectDocs = async () => {};
  shell.goProject('projects/budget-wa', 'docs');
  assert.match(stamped.at(-1), /tab=docs/);
  // Overview is the default, so it stamps no tab; an unknown tab collapses to
  // it rather than stranding the pane.
  shell.goProjectTab('overview');
  assert.doesNotMatch(stamped.at(-1), /tab=/);
  shell.goProject('projects/budget-wa', 'bogus');
  assert.equal(shell.projectTab, 'overview');

  const { shell: s2 } = makeShell({
    search: '?repo=mehrlander/home&view=project&project=projects/budget-wa&tab=docs',
  });
  assert.equal(s2.parseUrl().tab, 'docs');
  // Boot and popstate share one dispatch through the VIEWS table, so handing
  // the tab over with the project is the project row's job rather than a line
  // copied into two chains. The row also declares `when`, so an address naming
  // no project falls through to the landing instead of opening an empty pane.
  s2.loadProjectReadme = async () => {};
  s2.loadProjectDocs = async () => {};
  const row = s2.routeFor('project');
  assert.equal(row.when({ project: '' }), false, 'a project-less address still routes here');
  row.open.call(s2, s2.parseUrl());
  assert.equal(s2.projectPath, 'projects/budget-wa');
  assert.equal(s2.projectTab, 'docs', 'the project row does not route the tab off the URL');
});

test('the pane wires the tabs, the app frame, the pages grid, and the docs tree', () => {
  assert.match(page, /@click="goProjectTab\('overview'\)"/, 'the Overview tab is gone');
  assert.match(page, /x-show="project\.powershellOutpost" @click="goProjectTab\('outpost'\)"/,
    'the Outpost tab must appear where a PowerShell outpost is declared');
  assert.match(page, /x-show="projectBoardFile" @click="goProjectTab\('board'\)"/,
    'the Board tab must exist for a file board only');
  assert.match(page, /@click="onBoardClick\(\$event\)"/,
    'the rendered board no longer resolves its relative links in-app');
  assert.match(page, /x-html="projectBoardHtml"/, 'the board pane is gone');
  assert.match(page, /@click="goProjectTab\('pages'\)" :disabled="!projectPages\.length"/,
    'the Pages tab is always offered, disabled where the workspace claims no pages');
  assert.match(page, /@click="goProjectTab\('docs'\)"/, 'Files has lost its Docs mode');
  assert.match(page, /x-if="projectPane==='app'"/, 'the landing is no longer the App tab');
  assert.match(page, /:src="projectLandingUrl"/, 'the landing iframe is gone');
  assert.match(page, /@click="openProjectApp\(''\)" :aria-pressed="projectPane==='app'" data-project-app/,
    'the App button beside the name no longer opens the app at its front');
  assert.match(page, /data-project-switch>\s*<img x-show="projectIconSrc\(\$store\.browser\.repo, project\)"/,
    'the project mark no longer draws the project\'s icon');
  assert.match(page, /x-for="pg in projectPages"/, 'the pages grid no longer iterates projectPages');
  assert.match(page, /x-for="r in projectDocsRows"/, 'the docs tree is gone');
  assert.match(page, /openProjectDoc\(r\.rel\)/, 'a docs row no longer opens in the reader');
  assert.match(page, /x-html="projectDocHtml"/, 'the docs reader is gone');
  assert.match(page, /x-html="projectDocsIndexHtml"/, 'the curated docs/README.md lead is gone');
});

test('repoProjects carries a project\'s icon root-relative, with or without a landing', () => {
  const { shell } = makeShell();
  const rows = shell.repoProjects('a/b', { projects: [
    { path: 'x', landing: '/x/app.html', icon: '/x/icon.svg' },
    { path: 'y', icon: ' y/icon.svg ' },
    { path: 'z', icon: 'ph-newspaper' },
    { path: 'w', icon: 7 },
    { path: 'v', landingIcon: 'v/icon.svg' },
  ] });
  assert.deepEqual(rows.map(r => r.icon), ['x/icon.svg', 'y/icon.svg', 'ph-newspaper', '', ''],
    'a file path loses its leading slash, a glyph is kept, junk and the retired landingIcon read as none');
});

test('a project\'s icon is read once per repo@ref, and a glyph or no icon draws the stock mark', async () => {
  const reads = [];
  const { shell, browserStore } = makeShell({ browserStore: { repo: 'a/b', ref: 'main', defaultRef: 'main',
    gh: { get: async (f) => { reads.push(f); if (f === 'gone.svg') throw new Error('404'); return { text: '<svg/>' }; } } } });
  const p = { path: 'x', icon: 'x/icon.svg' };
  assert.equal(shell.projectIconSrc('a/b', p), '', 'nothing to draw before the read lands');
  assert.equal(shell.projectIconSrc('a/b', p), '');
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(reads, ['x/icon.svg'], 'two renders asked, one read went out');
  assert.equal(shell.projectIconSrc('a/b', p), 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg/>'));
  browserStore.ref = 'claude/branch';
  assert.equal(shell.projectIconSrc('a/b', p), '', 'another ref is another file');
  await new Promise(r => setTimeout(r, 0));
  assert.equal(reads.length, 2);
  assert.equal(shell.projectIconSrc('a/b', { path: 'g', icon: 'gone.svg' }), '');
  await new Promise(r => setTimeout(r, 0));
  assert.equal(shell.projectIconSrc('a/b', { path: 'g', icon: 'gone.svg' }), '', 'a failed read draws the glyph and is not retried');
  assert.equal(reads.filter(f => f === 'gone.svg').length, 1);
  assert.equal(shell.projectIconSrc('a/b', { path: 'z', icon: 'ph-newspaper' }), '');
  assert.equal(shell.projectGlyph({ icon: 'ph-newspaper' }), 'ph-newspaper');
  assert.equal(shell.projectGlyph({ icon: 'z/icon.svg' }), 'ph-kanban');
  assert.equal(shell.projectGlyph({ icon: '' }), 'ph-kanban');
});

test('a README whose title repeats the project name loses that title', () => {
  const { shell } = makeShell();
  assert.equal(shell.dropRepeatedTitle('<h1 id="wps">wps</h1>\n<p>Body</p>', 'wps'), '<p>Body</p>');
  assert.equal(shell.dropRepeatedTitle('<h1>Budget <code>DRS</code></h1><p>x</p>', 'budget drs'), '<p>x</p>');
  assert.equal(shell.dropRepeatedTitle('<h1>Something else</h1><p>x</p>', 'wps'), '<h1>Something else</h1><p>x</p>');
  assert.equal(shell.dropRepeatedTitle('<p>No title</p>', 'wps'), '<p>No title</p>');
});


test('the two sidebar project lists are sized the same', () => {
  // The estate's nested rows were smaller and dimmer than the repo sidebar's
  // for a while; the guideline made that argument unnecessary. Both now carry
  // the same row metrics, and this is what catches one drifting from the other.
  const rows = [...page.matchAll(
    /class="flex items-center gap-2 min-w-0 flex-1 px-2 py-1\.5 text-base text-left transition-colors/g)];
  assert.equal(rows.length, 2, 'the two project lists no longer share their row size');
  const blocks = [...page.matchAll(/flex flex-col gap-0\.5 ml-4 pl-2 border-l border-base-300/g)];
  assert.equal(blocks.length, 2, 'the two project blocks no longer share their guideline and gap');
  // The negative margin is gone with the size difference that needed it: at
  // equal row heights there is no slack to close and the pull would crowd.
  assert.doesNotMatch(page, /-mt-1 ml-4 pl-2/, 'the project block pulls up again');
});

// ── The PowerShell outpost view, which fills the Overview where one is declared ────────
// A workspace whose manifest entry names an outpost.json opens on that view in
// its Overview tab. Declared, never derived, since the view writes to the
// ledger that file names. Its selected file rides the address as &item= and
// takes a page-wide paste or drop the way an open Files result does.

test('repoProjects: `powershellOutpost` is carried root-relative, and only when declared', () => {
  const { shell } = makeShell();
  shell.estateConfigs = { 'mehrlander/home': { projects: [
    { path: 'projects/wps', powershellOutpost: '/projects/wps/data/outpost.json/' },
    { path: 'projects/a', powershellOutpost: 7 },
    { path: 'projects/b' },
  ] } };
  assert.deepEqual(shell.repoProjects('mehrlander/home').map(p => p.powershellOutpost),
    ['projects/wps/data/outpost.json', '', '']);
});

test('goProject: a declaring workspace has an Outpost tab, and its item stamps', () => {
  const { shell, browserStore, win } = makeShell({ browserStore: { repo: 'mehrlander/home', ref: 'main', defaultRef: 'main' } });
  shell.estateConfigs = { 'mehrlander/home': { projects: [{ path: 'projects/wps', powershellOutpost: 'projects/wps/data/outpost.json' }] } };
  shell.refreshProjectPane = () => {};
  shell.goProject('projects/wps', 'outpost', 'projects/wps/app/Modules/Forms/Forms.psm1');
  assert.equal(shell.projectTab, 'outpost');
  assert.equal(shell.powershellOutpostItem, 'projects/wps/app/Modules/Forms/Forms.psm1');
  const p = shell.deepLinkParams(new URLSearchParams());
  assert.equal(p.get('view'), 'project');
  assert.equal(p.get('tab'), 'outpost');
  assert.equal(p.get('item'), 'projects/wps/app/Modules/Forms/Forms.psm1');
  // The view's file is the page-wide correspondence target, at the browsed ref
  // when it is not the default, and only for a file the comparison can take.
  shell.view = 'project';
  win.FileCorrespondence = { applies: t => /\.(ps1|psm1|xaml)$/.test(t.path) };
  assert.deepEqual(shell.selectedCorrespondence, { repo: 'mehrlander/home', path: 'projects/wps/app/Modules/Forms/Forms.psm1', ref: '' });
  browserStore.ref = 'feat/x';
  assert.equal(shell.selectedCorrespondence.ref, 'feat/x');
  shell.powershellOutpostItem = 'projects/wps/app/Modules/ISE/Tools/Buttons.xml';
  assert.equal(shell.selectedCorrespondence, null, 'an XML tool file is not a comparison target');
  shell.powershellOutpostItem = 'projects/wps/app/Modules/Forms/Forms.psm1';
  // The README Overview is not the outpost view, so a paste there names no file.
  shell.projectTab = 'overview';
  assert.equal(shell.selectedCorrespondence, null);
  // Leaving for another workspace clears the item; a bare tab stamps none.
  shell.goProject('projects/other', 'docs');
  assert.equal(shell.powershellOutpostItem, '');
  assert.equal(shell.deepLinkParams(new URLSearchParams()).get('item'), null);
  // Switching tabs within the workspace keeps the item out of the stamp, so
  // a Docs link does not carry one.
  shell.goProject('projects/wps', 'outpost', 'x.ps1');
  shell.goProjectTab('docs');
  assert.equal(shell.deepLinkParams(new URLSearchParams()).get('item'), null);
  // A workspace that declares no outpost has no Outpost tab: asking for one
  // draws the Overview, and the paste target follows what is drawn.
  shell.estateConfigs = { 'mehrlander/home': { projects: [{ path: 'projects/plain' }] } };
  shell.goProject('projects/plain', 'outpost', 'projects/plain/x.ps1');
  assert.equal(shell.projectPane, 'overview');
  assert.equal(shell.selectedCorrespondence, null);
});

// A cold link names the tab before the manifest that declares it has been
// read. Checked against the manifest at that moment, &tab=outpost fell back to
// the Overview for good; kept as asked, it is drawn once the manifest arrives.
test('a cold link to Outpost or App is drawn once the manifest declares it', () => {
  const { shell, browserStore } = makeShell({ browserStore: { repo: 'mehrlander/home', ref: 'main', defaultRef: 'main' } });
  shell.syncUrl = () => {};
  const reads = [];
  shell.loadProjectReadme = async () => reads.push('readme');
  shell.goProject('projects/wps', 'outpost', 'projects/wps/app/Profile.ps1');
  assert.equal(shell.projectTab, 'outpost', 'the request is kept');
  assert.equal(shell.projectPane, 'overview', 'nothing declares the outpost yet');
  assert.deepEqual(reads, ['readme'], 'the Overview standing in has its README');
  browserStore.config = { projects: [
    { path: 'projects/wps', powershellOutpost: 'projects/wps/data/outpost.json' },
    { path: 'projects/budget-drs', landing: 'projects/budget-drs/app/view/app.html' },
  ] };
  assert.equal(shell.projectPane, 'outpost');
  assert.equal(shell.deepLinkParams(new URLSearchParams()).get('item'), 'projects/wps/app/Profile.ps1');
  browserStore.config = null;
  shell.goProject('projects/budget-drs', 'app');
  assert.equal(shell.projectPane, 'overview');
  browserStore.config = { projects: [{ path: 'projects/budget-drs', landing: 'projects/budget-drs/app/view/app.html' }] };
  assert.equal(shell.projectPane, 'app');
});


test('the Overview reads the README in every workspace, and the Outpost tab reads none', () => {
  const { shell, browserStore } = makeShell({
    browserStore: { repo: 'mehrlander/home', ref: 'main', defaultRef: 'main' },
  });
  browserStore.config = { projects: [
    { path: 'projects/wps', powershellOutpost: 'projects/wps/data/outpost.json' },
    { path: 'projects/plain' },
  ] };
  shell.syncUrl = () => {};
  const reads = [];
  shell.loadProjectReadme = async () => reads.push('readme');
  shell.goProject('projects/wps');
  assert.equal(shell.projectTab, 'overview');
  assert.deepEqual(reads, ['readme'], 'a declared outpost no longer takes the Overview');
  shell.goProjectTab('outpost');
  assert.deepEqual(reads, ['readme'], 'the outpost view reads its own manifest');
  shell.goProject('projects/plain');
  assert.deepEqual(reads, ['readme', 'readme']);
});


test('the drop target follows the outpost view to its Outpost tab', () => {
  const { shell, browserStore, win } = makeShell({ browserStore: { repo: 'mehrlander/home', ref: 'main', defaultRef: 'main' } });
  shell.estateConfigs = { 'mehrlander/home': { projects: [
    { path: 'projects/wps', powershellOutpost: 'projects/wps/data/outpost.json' },
    { path: 'projects/plain' },
  ] } };
  shell.refreshProjectPane = () => {};
  win.FileCorrespondence = { applies: () => true };
  shell.view = 'project';
  shell.goProject('projects/wps', 'outpost', 'projects/wps/app/Modules/Forms/Forms.psm1');
  assert.equal(shell.selectedCorrespondence?.path, 'projects/wps/app/Modules/Forms/Forms.psm1',
    'the Outpost tab takes a page-wide drop');
  shell.goProjectTab('overview');
  assert.equal(shell.selectedCorrespondence, null, 'the README Overview claims no drop');
  // A workspace with no manifest has no PowerShell outpost selection to compare
  // against, even with an item set, or its README would silently claim every
  // drop on the page.
  shell.goProject('projects/plain', 'outpost', 'projects/plain/x.ps1');
  assert.equal(shell.selectedCorrespondence, null);
});

test('the outpost view is the Outpost tab in the pane, keyed per workspace and ref', () => {
  assert.match(page, /x-show="projectPane==='outpost'"/);
  assert.match(page, /x-show="projectPane==='overview'"/,
    'and the README is the Overview whatever else the workspace declares');
  assert.match(page, /x-for="p in \(projectPane==='outpost' \? \[project\] : \[\]\)" :key="p\.path \+ '@' \+ \$store\.browser\.ref"/);
  assert.match(page, /x-data="powershellOutpostView\(p\)"/);
  assert.match(page, /gh\.load\('kits\/powershell-outpost\.js'\)/, 'the kit rides the boot chain so the pre-build reaches it');
});


// ── The README peek on a project's GitHub icon ───────────────────────────────
// Each project row in the two sidebar lists carries a GitHub icon: the tap
// opens the folder, the hover shows the README. See kits/source-peek.js for why
// a folder icon carries a card at all.

test('projectReadmePeek addresses the workspace README, at the browsed ref only for the open repo', () => {
  const { shell, win } = makeShell({ browserStore: { repo: 'mehrlander/home', ref: 'feat/x', defaultRef: 'main' } });
  win.SourcePeek = { addr: (repo, ref, path) => repo + (ref ? '@' + ref : '') + ':' + path };
  assert.equal(shell.projectReadmePeek('mehrlander/home', { path: 'projects/wps' }),
    'mehrlander/home@feat/x:projects/wps/README.md');
  // Another repo's row is not being browsed, so its peek takes that repo's
  // default branch rather than this one's branch name, which need not exist.
  assert.equal(shell.projectReadmePeek('mehrlander/other', { path: 'projects/a' }),
    'mehrlander/other:projects/a/README.md');
  assert.equal(shell.projectReadmePeek('', { path: 'projects/wps' }), null);
  assert.equal(shell.projectReadmePeek('mehrlander/home', null), null);
  // No kit, no attribute: the call site binds null rather than a broken card.
  win.SourcePeek = undefined;
  assert.equal(shell.projectReadmePeek('mehrlander/home', { path: 'projects/wps' }), null);
});

test('every project GitHub icon carries the README peek', () => {
  const icons = page.match(/:href="projectGithubUrl\([^"]*\)"/g) || [];
  assert.equal(icons.length, 2, 'the two project rows; the masthead\'s GitHub door is a row of the project switcher');
  assert.equal((page.match(/:data-peek="projectReadmePeek\([^"]*\)"/g) || []).length, icons.length,
    'each one peeks, or the README is reachable from some project lists and not others');
});


// ── The project switcher on the Project view's mark ─────────────────────────
test('the project mark opens the repo\'s projects in the shared menu, the open one marked', () => {
  const { shell, win } = makeShell({ browserStore: { repo: 'mehrlander/home', ref: 'main', defaultRef: 'main' } });
  shell.estateConfigs = { 'mehrlander/home': { projects: [{ path: 'news' }, { path: 'projects/budget-drs', label: 'budget-drs' }, { path: 'projects/wps' }] } };
  shell.refreshProjectPane = () => {};
  shell.goProject('projects/budget-drs', 'docs');
  shell.menuRepo = 'mehrlander/home'; shell.menuKind = 'projects';
  // The kit does the encoding (github-links.test.mjs covers it); the menu only
  // has to hand it the open project's repo and folder.
  win.GithubLinks = { pathUrl: (repo, p, ref) => `https://github.com/${repo}/tree/${ref || 'main'}/${p}` };
  const items = shell.repoMenuItems;
  delete win.GithubLinks;
  assert.deepEqual(items.map(i => i.label), ['home', 'news', 'budget-drs', 'wps', 'budget-drs on GitHub'],
    'the repo, its projects, then the open project\'s folder on GitHub');
  assert.equal(items.at(-1).external, true);
  assert.match(items.at(-1).url, /github\.com\/mehrlander\/home\/tree\/.*projects\/budget-drs/);
  assert.equal(items[0].head, true);
  assert.deepEqual(items.filter(i => i.current).map(i => i.label), ['budget-drs']);
  // Each project row carries its own mark, the open one included: its label
  // in primary marks it, so the check that used to replace its glyph is gone.
  assert.deepEqual(items.slice(1, 4).map(i => i.icon), ['ph-kanban', 'ph-kanban', 'ph-kanban']);
  assert.deepEqual(items.slice(1, 4).map(i => i.img), ['', '', ''], 'no icon declared, no picture');
  items.find(i => i.label === 'wps').run();
  assert.equal(shell.projectPath, 'projects/wps');
  assert.equal(shell.projectTab, 'docs', 'a tab every project has is kept');
  shell.goProject('projects/wps', 'board');
  shell.repoMenuItems.find(i => i.label === 'news').run();
  assert.equal(shell.projectTab, 'overview', 'a tab the next project may lack falls back to its Overview');
});

test('the markup wires the project mark to the switcher', () => {
  assert.match(page, /data-project-switch/);
  assert.match(page, /toggleRepoMenu\(\$store\.browser\.repo, \$event\.currentTarget, 'projects'/);
});
