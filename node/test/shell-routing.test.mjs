// The app's view routing: the address a screen mints must be an address the
// page can open.
//
// The shell used to state its view table THREE times, by hand: the dispatch
// chain in init(), the dispatch chain in restoreFromUrl() (the popstate
// mirror), and the stamp chain in deepLinkParams(). Nothing held them in step,
// and all three ways of drifting had happened at once (measured 2026-08-11, by
// walking every ?view= param through the real page in headless Chromium):
//
//   ?view=pages      stamped and restorable, missing from init: a link copied
//                    out of the Pages view cold-loaded onto the repo landing.
//   ?view=proposals  dispatched by both chains, stamped by neither: the view
//                    opened, then erased its own address on the first sync.
//   ?view=estate     stamped only beside a repo/ref param, on a premise that
//                    had expired (see the comment at that row).
//
// The three chains are now one VIEWS table, so that class of drift is
// structural rather than a thing to remember. This holds the collapse in place
// (nothing may route around the table) and then round-trips every row through
// the real stamp and the real parse, which is the property the table is FOR
// and which the table alone does not prove.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShell, page } from './shell.mjs';

const { shell } = makeShell({ browserStore: { repo: '' } });
const rows = shell.VIEWS;

test('the table is the only router', () => {
  // A view-name literal inside the routing functions is the shape the collapse
  // removed: it is how a special case creeps back in and starts drifting again.
  for (const fn of ['routeFromUrl(url){', 'deepLinkParams(base){']) {
    const at = page.indexOf(fn);
    assert.ok(at > 0, 'routing function not found in the page source: ' + fn);
    const body = page.slice(at, page.indexOf('\n  },', at));
    const literals = [...body.matchAll(/(?:this\.view|url\.view|\.view) === '(\w+)'/g)].map(m => m[1]);
    assert.deepEqual(literals, [],
      `${fn} compares a view name directly (${literals}); route it through VIEWS instead`);
  }
});

test('every view the shell can enter has a row', () => {
  // `this.view = '<key>'` in a go* method is the app entering a view. One with
  // no row would render fine and be unaddressable, which is defect 2 exactly.
  const entered = new Set([...page.matchAll(/this\.view = '(\w+)'/g)].map(m => m[1]));
  const keys = new Set(rows.map(r => r.key));
  for (const v of entered)
    assert.ok(keys.has(v), `the shell enters view '${v}' but VIEWS has no row for it`);
});

// Two namespaces, not one, since `writes` split them: a KEY is the shell's own
// name for a view (`this.view`) and an ADDRESS is a ?view= spelling. They are
// the same word for almost every row, and where they are not, 'activity' is a
// key on one row and an address on another, which is the whole point of the
// split and would read as a collision if both were counted together.
test('rows are well formed, and keys and addresses are unique', () => {
  const keys = new Set(), addrs = new Set();
  for (const r of rows) {
    assert.ok(r.key && typeof r.open === 'function', `row ${r.key}: needs a key and an open()`);
    assert.ok(!keys.has(r.key), `two rows answer to the key '${r.key}'`);
    keys.add(r.key);
    for (const name of [r.writes || r.key, r.alias].filter(Boolean)) {
      assert.ok(!addrs.has(name), `two rows answer to the address '${name}'`);
      addrs.add(name);
    }
    // `self` says the view names itself another way, so the row must stamp
    // that other way itself; without a stamp it would name nothing at all.
    if (r.self) assert.ok(r.stamp, `row ${r.key}: declares self but stamps nothing`);
  }
});

// The Activity nav stop opens Sessions, so a link copied from it carries
// ?view=sessions.
test('the Activity nav stop opens Sessions', () => {
  const nav = page.match(/label: 'Activity', go: \(\) => this\.(\w+)\(\)/);
  assert.equal(nav?.[1], 'goSessions');
});

// What each view needs on the shell before it has anything to stamp. A row
// absent from here stamps from its key alone.
const SEED = {
  project: (s) => { s.projectPath = 'projects/budget-drs'; },
  program: (s) => { s.programName = 'sessions'; },
  state: (s) => { s.stateItem = 'sessions'; },
  search: (s) => { s.searchSeed = { q: 'tracker', mode: 'names' }; },
  app: (s) => { s.appView = { repo: 'mehrlander/home', path: 'links/index.html' }; },
};

// Run the round trip against BOTH repo cases. On the default repo the `repo`
// key is dropped as redundant, which is a different query and was the case
// ?view=estate broke in: it stamped only when a repo/ref param happened to be
// there, so browsing the hub itself left the view unaddressable while browsing
// any other repo looked fine.
const REPOS = ['mehrlander/home', 'mehrlander/web-tools'];

// What the app would open for a parsed address: routeFromUrl's resolution,
// modelled rather than run, since running it would need the whole DOM.
function landsOn(reopened, url) {
  if (!url) return 'dashboard';
  if (url.file) return 'files';
  const r = reopened.routeFor(url.view);
  return r && (!r.when || r.when(url)) ? r.key : 'landing';
}

test('every view round-trips: stamped, then parsed back to itself', () => {
  for (const repo of REPOS) for (const row of rows) {
    const view = row.key;
    const where = `${view} (browsing ${repo})`;
    const { shell: s } = makeShell({ browserStore: {
      repo, ref: '', defaultRef: 'main', activeFile: null, path: '' } });
    s.view = view;
    SEED[view]?.(s);
    const qs = s.deepLinkParams(new URLSearchParams()).toString();
    assert.ok(qs, `${where}: stamped an empty query, so the view has no address at all`);

    const { shell: reopened } = makeShell({ search: '?' + qs, browserStore: { repo: '' } });
    const url = reopened.parseUrl();
    assert.ok(url, `${where}: its own address parses to nothing, so a cold load ignores it`);
    assert.equal(landsOn(reopened, url), view,
      `${where}: reopening its address (?${qs}) lands on a different view`);
  }
});

test('the second key rides along, for the views that carry one', () => {
  const cases = [
    ['state', (s) => { s.stateItem = 'sessions'; }, 'item', 'sessions'],
    ['search', (s) => { s.searchSeed = { q: 'tracker', mode: 'names' }; }, 'sq', 'tracker'],
    ['map', (s) => { s.mapTab = 'showing'; }, 'tab', 'showing'],
    ['branches', (s) => { s.detailSpec = 'mehrlander/web-tools@main'; }, 'detail', 'mehrlander/web-tools@main'],
    ['waiting', (s) => { s.waitingCall = '2708d02c-close-four-tasks'; }, 'call', '2708d02c-close-four-tasks'],
    ['program', (s) => { s.programName = 'sessions'; }, 'program', 'sessions'],
    ['program', (s) => { s.programName = 'sessions'; s.programTab = 'measures'; }, 'tab', 'measures'],
  ];
  for (const [view, seed, key, want] of cases) {
    const { shell: s } = makeShell({ browserStore: {
      repo: 'mehrlander/home', ref: '', defaultRef: 'main', activeFile: null, path: '' } });
    s.view = view;
    seed(s);
    const qs = s.deepLinkParams(new URLSearchParams()).toString();
    const { shell: reopened } = makeShell({ search: '?' + qs, browserStore: { repo: '' } });
    // `detail` is read off the location directly rather than through parseUrl,
    // because deepLinkParams rebuilds the query from a whitelist and would
    // erase an incoming value before the estate read it. Assert the field the
    // shell actually seeds, which is what the deep link depends on.
    const got = key === 'detail' ? reopened.detailSpec : reopened.parseUrl()[key];
    assert.equal(got, want, `?view=${view}&${key}= did not survive the round trip`);
  }
});

// ── The Program view, and the Map address it replaced ───────────────────────
//
// A program's page was the Map's Programs tab's until 2026-11-18, at
// ?view=map&tab=programs&program=<name>. It is a view of its own now, and the
// old address is a link people hold, so it has to open the new view and stamp
// the new address rather than land on the list.

test('?view=program opens a program, and its first tab stays out of the address', () => {
  const { shell: s } = makeShell({ search: '?view=program&program=testing&tab=changes', browserStore: { repo: '' } });
  s.syncUrl = () => {};
  const url = s.parseUrl();
  assert.equal(url.program, 'testing');
  s.routeFor(url.view).open.call(s, url);
  assert.equal(s.view, 'program');
  assert.equal(s.programName, 'testing');
  assert.equal(s.programTab, 'changes');
  let p = s.deepLinkParams(new URLSearchParams());
  assert.equal(p.get('view'), 'program');
  assert.equal(p.get('program'), 'testing');
  assert.equal(p.get('tab'), 'changes');
  s.goProgramTab('areas');
  p = s.deepLinkParams(new URLSearchParams());
  assert.equal(p.has('tab'), false, 'Areas is the first tab, so a bare address means it');
  s.goProgramTab('bogus');
  assert.equal(s.programTab, '', 'a tab the view does not draw is ignored');
  s.goProgram('content', 'nowhere');
  assert.equal(s.programTab, '', 'an unknown tab from a link opens the first');
  assert.equal(s.estateCtx, true, 'a program is estate-level, so the sidebar is the estate one');
});

test('a program address with no name lands on the landing, and goProgram with none opens the list', () => {
  const { shell: s } = makeShell({ search: '?view=program', browserStore: { repo: '' } });
  s.syncUrl = () => {};
  const url = s.parseUrl();
  const r = s.routeFor(url.view);
  assert.equal(r.when(url), false, 'the row needs a name');
  s.goProgram('');
  assert.equal(s.view, 'map');
  assert.equal(s.mapTab, 'programs');
});

test("the Map's old program address opens the Program view and stamps the new one", () => {
  const { shell: s } = makeShell({ search: '?view=map&tab=programs&program=sessions', browserStore: { repo: '' } });
  s.syncUrl = () => {};
  const url = s.parseUrl();
  assert.equal(url.view, 'map');
  s.routeFor(url.view).open.call(s, url);
  assert.equal(s.view, 'program', 'the redirect is the map row\'s, through the table');
  assert.equal(s.programName, 'sessions');
  const p = s.deepLinkParams(new URLSearchParams('view=map&tab=programs&program=sessions'));
  assert.equal(p.get('view'), 'program');
  assert.equal(p.get('program'), 'sessions');
  assert.equal(p.has('tab'), false, 'the Programs tab key does not ride onto the program');
  // And the Programs list itself is still the Map's.
  const { shell: m } = makeShell({ search: '?view=map&tab=programs', browserStore: { repo: '' } });
  m.syncUrl = () => {};
  m.routeFor('map').open.call(m, m.parseUrl());
  assert.equal(m.view, 'map');
  assert.equal(m.mapTab, 'programs');
});

// ── ?header= and ?sidebar=, READING parameters beside the view table ────────
//
// They say how much of the app is drawn around the view, not which view, so
// they have no VIEWS row on purpose and are stamped unconditionally beside
// whatever the table stamped. That places them outside everything above, and
// the two properties they have to hold are exactly the ones the view table's
// rows get for free: an address that reopens as itself, and a default that
// never appears.

const homeStore = () => ({ repo: 'mehrlander/home', ref: '', defaultRef: 'main', activeFile: null, path: '' });
const bareStore = () => ({ repo: '', ref: '', defaultRef: 'main', activeFile: null, path: '' });
const opened = (search, store = { repo: '' }) => {
  const { shell: s } = makeShell({ search, browserStore: store });
  s.readDisplayParams();
  return s;
};

test('header=0 round-trips, and only when it is not the default', () => {
  const { shell: s } = makeShell({ browserStore: homeStore() });
  s.syncUrl = () => {};
  s.view = 'map';
  s.setHeader(false);
  const qs = s.deepLinkParams(new URLSearchParams()).toString();
  assert.match(qs, /(^|&)header=0($|&)/, '?header=0 was not stamped, so the bare view cannot be linked to');

  const reopened = opened('?' + qs);
  assert.equal(reopened.headerOn, false, '?header=0 did not survive a cold load');
  // Reopening must still land on the view: the parameter rides beside the
  // view keys, so a collision would show up here as a lost or hijacked address.
  assert.equal(landsOn(reopened, reopened.parseUrl()), 'map', '?header=0 disturbed the view its link also names');

  // The default stays out, which keeps every bare link byte-identical.
  const { shell: plain } = makeShell({ browserStore: homeStore() });
  plain.view = 'map';
  assert.equal(plain.headerOn, true, 'the header is not shown by default');
  const p = plain.deepLinkParams(new URLSearchParams());
  for (const k of ['header', 'sidebar', 'shell'])
    assert.ok(!p.has(k), `the default stamped ${k}, so it would appear on every address`);
});

test('sidebar= round-trips, and only where it differs from the view default', () => {
  // The harness has no matchMedia, so wideViewport reads true: a non-app view
  // starts with the sidebar open, an app view with it closed.
  for (const [view, start] of [['map', '0'], ['app', '1']]) {
    const { shell: s } = makeShell({ browserStore: bareStore() });
    s.view = view;
    if (view === 'app') s.appView = { key: 'me/home:a.html', slug: 'budget-drs', repo: 'me/home', path: 'a.html' };
    s.sidebarStart = start;
    const qs = s.deepLinkParams(new URLSearchParams());
    assert.equal(qs.get('sidebar'), start, `${view}: ?sidebar=${start} differs from the default and was not stamped`);
    assert.equal(opened('?' + qs.toString()).sidebarStart, start, `${view}: ?sidebar=${start} did not survive a cold load`);

    s.sidebarStart = start === '1' ? '0' : '1';
    assert.ok(!s.deepLinkParams(new URLSearchParams()).has('sidebar'),
      `${view}: a sidebar start that agrees with the default was stamped`);
  }
});

test('the sidebar starts by view, width and header, and an explicit start outranks them', () => {
  const { shell: s } = makeShell({ browserStore: { repo: '' } });
  s.syncUrl = () => {};
  for (const v of ['map', 'repos', 'landing', 'search']) {
    s.view = v;
    assert.equal(s.sidebarStartsOpen, true, `?view=${v} on a wide screen must start with the sidebar out`);
  }
  s.view = 'app';
  assert.equal(s.headerOn, true, 'an app view keeps the header for navigation');
  assert.equal(s.sidebarStartsOpen, false, 'an app view starts with the sidebar closed');
  s.view = 'repos';
  assert.equal(s.sidebarStartsOpen, true, 'a latched default would strand the dashboard with no sidebar');
  s.setHeader(false);
  assert.equal(s.sidebarStartsOpen, false, 'hiding the header must put the sidebar away with it');
  s.sidebarStart = '1';
  assert.equal(s.sidebarStartsOpen, true, 'an explicit ?sidebar=1 is honored with the header off');
});

test('the address carries the header only where it differs from the default, on an app view too', () => {
  const { shell: s } = makeShell({ browserStore: bareStore() });
  s.syncUrl = () => {};
  s.view = 'app';
  s.appView = { key: 'me/home:a.html', slug: 'budget-drs', repo: 'me/home', path: 'a.html' };
  assert.equal(s.deepLinkParams(new URLSearchParams()).toString(), 'app=budget-drs',
    'the bare address already means "header shown, sidebar closed"; stamping it would say it twice');

  s.setHeader(false);
  assert.equal(s.deepLinkParams(new URLSearchParams()).get('header'), '0',
    'the app view without its header is the linkable exception');
  // And back: the address self-heals to the short form.
  s.setHeader(true);
  assert.equal(s.deepLinkParams(new URLSearchParams()).toString(), 'app=budget-drs');
});

test('toggling the header back is not a choice, and hiding it survives navigation', () => {
  const { shell: s } = makeShell({ browserStore: { repo: '' } });
  s.syncUrl = () => {};
  s.view = 'app';
  s.setHeader(false);
  assert.equal(s._headerChoice, '0', 'hiding the header IS a choice');
  s.view = 'map';
  assert.equal(s.headerOn, false, 'and it survives navigation, as a reading parameter should');
  s.setHeader(true);
  assert.equal(s._headerChoice, '', 'showing it agrees with the default, so nothing is latched');
  s.view = 'app';
  assert.equal(s.headerOn, true);
});

test('bringing the header back keeps the sidebar start the link asked for', () => {
  // The case the old three-mode preset needed a remembered return mode for: a
  // link that asked for the sidebar closed, whose header went off and came
  // back, must not have the sidebar spring out. The start is its own reading,
  // so nothing needs remembering.
  for (const [search, open] of [['?sidebar=0', false], ['', true]]) {
    const s = opened(search);
    s.syncUrl = () => {};
    s.view = 'repos';
    s.setHeader(false);
    assert.equal(s.sidebarOpen, false, `${search || 'bare'}: the sidebar outlived the header`);
    s.setHeader(true);
    assert.equal(s.sidebarOpen, open, `${search || 'bare'}: the header came back with the wrong sidebar`);
  }
});

test('boot re-derives the sidebar after routing, since the watcher is not wired yet', () => {
  // Source-level: init() runs against a browser this harness does not build.
  // The claim is the ORDER. routeFromUrl settles the view before the $watch
  // below exists, so the boot's own change is the one nothing observes.
  const init = page.match(/await this\.routeFromUrl\(url\);[\s\S]*?this\.\$watch\('sidebarStartsOpen'/);
  assert.ok(init, 'the boot route and the sidebarStartsOpen watcher were not found in one block');
  assert.ok(init[0].indexOf('this.sidebarOpen = this.sidebarStartsOpen;') > 0,
    'nothing re-derives the sidebar between the boot route and the watcher');
});

test('the sidebar re-derives when its start changes, or it outlives the header', () => {
  // The header hides by x-show, the sidebar does not: it is `sidebarOpen` that
  // puts it away. Without this the aside stays a column at lg after the header
  // has gone, which is the state nothing else in the app produces.
  assert.match(page, /this\.\$watch\('sidebarStartsOpen', \(\) => \{\n\s+this\.sidebarOpen = this\.sidebarStartsOpen;/,
    'a change in how the sidebar starts must re-derive it before anything reads it');
});

test('an unknown value reads as absent rather than blanking the app', () => {
  // A hand-edited or truncated link must not hide the header with no way back.
  // Surrounding whitespace is trimmed rather than rejected, so `header=%200`
  // is `0` and is not in this list.
  for (const bad of ['', 'off', 'no', 'false', '00', 'none']) {
    const s = opened('?header=' + encodeURIComponent(bad) + '&sidebar=' + encodeURIComponent(bad));
    assert.equal(s.headerOn, true, `?header=${JSON.stringify(bad)} hid the header`);
    assert.equal(s.sidebarStart, '', `?sidebar=${JSON.stringify(bad)} was taken as a start`);
  }
});

// ── SUNSET(2027-02-01): ?shell= still reads, as an alias ────────────────────
//
// Links to the preset sit in PR bodies, artifacts and a phone shortcut's
// baked-in address (pages/shortcut-log.html), so until the sunset each value
// opens the screen it used to and the next stamp rewrites it.

test('?shell= opens as the preset it was, and stamps as the new parameters', () => {
  const cases = [
    // [shell value, view, header shown, sidebar starts open, stamp]
    ['full', 'app', true, true, 'sidebar=1'],
    ['nav', 'map', true, false, 'sidebar=0'],
    ['none', 'map', false, false, 'header=0'],
    ['full', 'map', true, true, ''],
  ];
  for (const [mode, view, header, side, stamp] of cases) {
    const s = opened('?shell=' + mode);
    s.view = view;
    if (view === 'app') s.appView = { key: 'me/home:a.html', slug: 'budget-drs', repo: 'me/home', path: 'a.html' };
    assert.equal(s.headerOn, header, `shell=${mode} on ${view}: wrong header`);
    assert.equal(s.sidebarStartsOpen, side, `shell=${mode} on ${view}: wrong sidebar start`);
    const p = s.deepLinkParams(new URLSearchParams('shell=' + mode));
    assert.ok(!p.has('shell'), `shell=${mode}: the alias was stamped back instead of rewritten`);
    for (const k of ['app', 'view']) p.delete(k);
    assert.equal(p.toString(), stamp, `shell=${mode} on ${view}: rewritten to the wrong parameters`);
  }
});

test('the new parameters outrank the alias where both are present', () => {
  const s = opened('?shell=none&header=1&sidebar=1');
  assert.equal(s.headerOn, true);
  assert.equal(s.sidebarStart, '1');
  const half = opened('?shell=nav&header=0');
  assert.equal(half.headerOn, false, 'header=0 was overridden by the alias');
  assert.equal(half.sidebarStart, '0', 'the alias did not fill the sidebar the new parameters left out');
  assert.equal(opened('?shell=hidden').headerOn, true, 'an unknown preset value is not a fourth mode');
});

test('the FAB toggle contract is well formed, and its setter is the header setter', () => {
  // The Render tab renders one on/off control per entry, inline with the width
  // presets. A malformed row paints a dead button, so the shape is checked here
  // rather than left to be seen.
  const { shell: s } = makeShell({ browserStore: { repo: '' } });
  s.syncUrl = () => {};
  const [t, ...rest] = s.toggles;
  assert.equal(rest.length, 0, 'the app contributes more than one toggle; the doc names one');
  assert.ok(t.key && t.label && t.icon && typeof t.set === 'function',
    'the toggle row is missing key, label, icon, or set');
  assert.equal(t.on, true, 'the toggle does not start on, so the default state reads as the exceptional one');
  // The row is one line and carries no prose, so the tooltip is the only place
  // a state can be said in words, and both states have to say something.
  for (const state of [true, false]) {
    s.setHeader(state);
    const cur = s.toggles[0];
    assert.equal(cur.on, state, 'the toggle re-reads a stale value, so it would light the wrong way');
    assert.ok(cur.title && cur.title !== cur.label, `the ${state ? 'on' : 'off'} state has no tooltip of its own`);
  }
  assert.equal(s.headerOn, false, "the toggle's setter did not move the header");
});

// The repo sidebar's Files row leaves the repo for the central surface, and
// what it carries is the whole of that hand-off: the repo, and the ref only
// when it is off the default, since '' means "the default branch" on the other
// side. A row that dropped the ref would open a listing of main while the
// shell was browsing a branch, which reads as the branch having no files.
test('the repo sidebar hands its Files row to the central surface, scoped', () => {
  const off = makeShell({ browserStore: {
    repo: 'mehrlander/home', ref: 'claude/topic', defaultRef: 'main', activeFile: null, path: '' } });
  off.shell.searchRepoFiles();
  assert.equal(off.shell.view, 'search');
  assert.equal(off.shell.searchSeed.repo, 'mehrlander/home');
  assert.equal(off.shell.searchSeed.ref, 'claude/topic');
  assert.equal(off.shell.searchSeed.mode, 'names');
  assert.equal(off.shell.searchSeed.q, '', 'no query: the row lists the repo, it does not search it');

  const onDefault = makeShell({ browserStore: {
    repo: 'mehrlander/home', ref: 'main', defaultRef: 'main', activeFile: null, path: '' } });
  onDefault.shell.searchRepoFiles();
  assert.equal(onDefault.shell.searchSeed.ref, '', 'the default branch rides as the empty ref, not by name');
});

// ?view=files carries a scope of its own: the folder the tree opens on.
test('?view=files opens the tree on its ?path= folder', () => {
  const files = makeShell({ search: '?repo=mehrlander/home&view=files&path=docs',
                            browserStore: { repo: '' } });
  files.shell.routeFor('files').open.call(files.shell, files.shell.parseUrl());
  assert.equal(files.shell.view, 'files');
  assert.equal(files.shell.filesPath, 'docs');
});

// A file named by a pin, a recent, or a ?file= link opens in the repo's Files
// view, the tree open on its folder and the file beside it, at the browsed ref.
test('opening a file routes to the Files view, scoped to its folder', () => {
  const { shell: s } = makeShell({ browserStore: {
    repo: 'mehrlander/home', ref: 'claude/topic', defaultRef: 'main', path: '' } });
  s.openFile('docs/envelopes/surface.md');
  assert.equal(s.view, 'files');
  assert.equal(s.filesPath, 'docs/envelopes');
  assert.equal(s.filesFile, 'docs/envelopes/surface.md');
  const qs = s.deepLinkParams(new URLSearchParams()).toString();
  assert.match(qs, /view=files/); assert.match(qs, /path=docs%2Fenvelopes/);
  assert.match(qs, /file=docs%2Fenvelopes%2Fsurface\.md/); assert.match(qs, /ref=claude%2Ftopic/);
  s.openFolder('lib/kits/');
  assert.equal(s.view, 'files'); assert.equal(s.filesPath, 'lib/kits'); assert.equal(s.filesFile, '');
});

// The browsed ref is repo-scoped state, not a view's. It rode the Files view's
// row until that row retired, and the atlas, the config form, the gallery and
// mention all read it, so it stamps beside `repo` now.
test('the browsed ref rides the address from any repo view', () => {
  for (const view of ['landing', 'atlas', 'config', 'pages']) {
    const { shell: s } = makeShell({ browserStore: {
      repo: 'mehrlander/home', ref: 'claude/topic', defaultRef: 'main', path: '' } });
    s.view = view;
    const qs = s.deepLinkParams(new URLSearchParams()).toString();
    assert.match(qs, /ref=claude%2Ftopic/, `${view} dropped the browsed ref`);
    const { shell: reopened } = makeShell({ search: '?' + qs, browserStore: { repo: '' } });
    assert.equal(reopened.parseUrl().ref, 'claude/topic');
  }
  // The default branch stays out of the URL, as every other default does.
  const { shell: onDefault } = makeShell({ browserStore: {
    repo: 'mehrlander/home', ref: 'main', defaultRef: 'main', path: '' } });
  onDefault.view = 'atlas';
  assert.doesNotMatch(onDefault.deepLinkParams(new URLSearchParams()).toString(), /ref=/);
});

// The landing is the README, for every repo including the hub. `landingKind()`
// used to pick one of three things for that slot and the README lost whenever
// anything else was declared.
test('the landing is the overview, and the gallery is its own view', () => {
  const hub = makeShell({ browserStore: {
    repo: 'mehrlander/web-tools', ref: '', defaultRef: 'main', config: {} } });
  assert.equal(hub.shell.showPagesNav, true, "the hub's catalog gets the Pages row");
  assert.equal(hub.shell.repoLandingView, null);

  const plain = makeShell({ browserStore: {
    repo: 'mehrlander/other', ref: '', defaultRef: 'main', config: {} } });
  assert.equal(plain.shell.showPagesNav, false);

  const withPages = makeShell({ browserStore: {
    repo: 'mehrlander/other', ref: '', defaultRef: 'main',
    config: { pages: [{ path: 'a.html' }] } } });
  assert.equal(withPages.shell.showPagesNav, true);

  // A declared landing is a row of its own, routed through the app view, so
  // there is one mechanism for "render this repo's page as a view".
  const withLanding = makeShell({ browserStore: {
    repo: 'mehrlander/other', ref: '', defaultRef: 'main',
    config: { landing: 'site/index.html' } } });
  const lv = withLanding.shell.repoLandingView;
  assert.equal(lv.repo, 'mehrlander/other');
  assert.equal(lv.path, 'site/index.html');
  assert.equal(withLanding.shell.showPagesNav, false,
    'a landing no longer displaces anything, so it turns nothing else on either');
});

// A row to land on rides with the file it names: ?col=<header>&row=<value>,
// what the Map lede's link mints. It belongs to that one file, so opening any
// other drops it.
test('a row landing round-trips with its file and clears on the next open', () => {
  const addr = '?repo=mehrlander/web-tools&file=docs/map-tabs.csv&col=tab&row=harness';
  const { shell: s } = makeShell({ search: addr, browserStore: {
    repo: 'mehrlander/web-tools', ref: '', defaultRef: 'main', activeFile: null, path: '' } });
  const url = s.parseUrl();
  assert.equal(url.col, 'tab');
  assert.equal(url.row, 'harness');
  s.routeFromUrl(url);
  assert.equal(s.view, 'files');
  assert.equal(s.filesFile, 'docs/map-tabs.csv');
  assert.deepEqual(s.filesAt, { col: 'tab', row: 'harness' });

  const qs = new URLSearchParams(s.deepLinkParams(new URLSearchParams()).toString());
  assert.equal(qs.get('col'), 'tab', 'the landing did not survive the stamp');
  assert.equal(qs.get('row'), 'harness');

  s.openFile('docs/registries.csv');
  assert.equal(s.filesAt, null, 'a landing for one file carried onto another');
  const after = new URLSearchParams(s.deepLinkParams(new URLSearchParams()).toString());
  assert.ok(!after.has('col') && !after.has('row'));

  // Half a pair names no row, so it is not kept.
  s.openFile('docs/map-tabs.csv', { col: 'tab', row: '' });
  assert.equal(s.filesAt, null);
});

// openBranchSpec is how any view hands a branch to Activity's takeover. The
// estate mounts lazily and reads `&detail=` only at mount, so from a view that
// has not mounted it the address IS the hand-off. It once wrote the address
// beside goBranches, whose whitelist rebuild erased it: from Waiting the link
// landed on the plain branch list (measured headless 2026-10-06).
test('a branch opened from another view keeps its &detail= through the sync', () => {
  const { shell: s, history: h, events } = makeShell({ search: '?view=waiting',
    browserStore: { repo: 'mehrlander/home', ref: '', defaultRef: 'main', activeFile: null, path: '' } });
  const urls = [];
  h.pushState = (_s, _t, u) => urls.push(String(u));
  h.replaceState = (_s, _t, u) => urls.push(String(u));
  s.view = 'waiting'; s.estateSeen = false;
  s.openBranchSpec('mehrlander/web-tools', 'claude/x');
  const last = new URLSearchParams(String(urls.at(-1) || '').split('?')[1] || '');
  assert.equal(last.get('view'), 'branches');
  assert.equal(last.get('detail'), 'mehrlander/web-tools@claude/x', 'the address the estate reads at mount');
  assert.ok(events.some((e) => e.type === 'web-tools:open-branch-detail'), 'a mounted estate is told too');
});
