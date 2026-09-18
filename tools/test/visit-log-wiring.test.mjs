// The shell's half of the visit log: the allowlist it holds in code, and the
// recording that hangs off syncUrl.
//
// kits/visit-log.js is pure and takes its tables from the caller, which is what
// makes it testable. The shell is the caller, and it cannot fetch: recordVisit
// runs inside a navigation, so an allowlist that arrived over the network would
// miss every visit before it landed and, worse, would make what gets stored
// depend on whether a fetch had finished. So the shell carries the two short
// tables in code, the way lib/alpineComponents/fab.js carries _TOSS_MODES, and
// this file is the gate that keeps them honest against the registries that own
// them. A mode described in docs/routes-modes.csv and missing here would be
// read as a route key and its payload matched as an address.
//
// App routes need no such list: VIEWS is the router, so the shell hands the kit
// the keys straight off it and there is nothing to drift.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';
import { makeShell } from './shell.mjs';

const page = readFileSync(path.join(repoRoot, 'app/index.html'), 'utf8');
const rows = (f) => parseCsv(readFileSync(path.join(repoRoot, 'docs', f), 'utf8'));

const win = {};
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/visit-log.js'), 'utf8'))(win);

function shellWith() {
  const { shell, location, history } = makeShell({
    browserStore: { repo: 'mehrlander/web-tools', ref: '', defaultRef: 'main' },
    win,
  });
  shell.visits = [];
  return { shell, location, history };
}

test('the shell knows every delivery mode the registry describes, and the same carries', () => {
  const { shell } = shellWith();
  const declared = rows('routes-modes.csv').filter(m => m.param !== '<route>');
  const held = new Map(shell.VISIT_MODES.map(m => [m.param, m.carries]));
  for (const m of declared) {
    assert.ok(held.has(m.param),
      `docs/routes-modes.csv describes '${m.param}' and app/index.html's VISIT_MODES omits it, ` +
      'so a visit carrying it would be matched as a route key');
    assert.equal(held.get(m.param), m.carries,
      `VISIT_MODES disagrees with the registry about what '${m.param}' carries`);
  }
  for (const p of held.keys()) {
    assert.ok(declared.some(m => m.param === p), 'VISIT_MODES holds an undescribed mode: ' + p);
  }
});

test('the shell knows every typed toss route', () => {
  const { shell } = shellWith();
  const declared = rows('routes-routes.csv').map(r => r.key).filter(Boolean).sort();
  const held = shell.VISIT_TOSS_ROUTES.map(r => r.key).sort();
  assert.deepEqual(held, declared,
    'app/index.html VISIT_TOSS_ROUTES and docs/routes-routes.csv disagree');
});

test('app route keys come off VIEWS rather than a second list', () => {
  const { shell } = shellWith();
  const t = shell.visitTables();
  assert.ok(t.routes.length > 15, 'the kit was handed a suspiciously short route list');
  const keys = new Set(t.routes.map(r => r.key));
  for (const k of ['sessions', 'map', 'search', 'project', 'app']) {
    assert.ok(keys.has(k), 'VIEWS key missing from the tables handed to the kit: ' + k);
  }
  // No hand-written copy of the route keys anywhere in the shell: the whole
  // point of taking them off VIEWS is that there is nothing to keep in step.
  assert.ok(!/VISIT_ROUTES\s*:/.test(page), 'a second copy of the app route keys appeared');
});

test('a visit is recorded on a push and not on a replace', () => {
  // syncUrl already decides push against replace by comparing the next address
  // to the current one. The log hangs off that decision rather than inventing a
  // second notion of a navigation, so this is really a test that the call site
  // did not drift onto the wrong branch of the if.
  const src = page.match(/if \(this\._restoring \|\| next === cur\) history\.replaceState[\s\S]{0,160}/);
  assert.ok(src, 'the push/replace branch in syncUrl was not found');
  assert.match(src[0], /else this\._pushVisit\(next\);/, 'the push branch does not reach _pushVisit');
  assert.ok(!/replaceState\(null, '', next\); this\._pushVisit/.test(src[0]),
    '_pushVisit moved onto the replace branch, where it would log no-ops and popstate restores');
  // And _pushVisit reads the address back before recording. Without this a toss
  // of the app records on every syncUrl, because the renderer wraps pushState
  // to swallow a SecurityError and `cur` therefore never moves. Those rows land
  // in the same-origin localStorage the real app reads.
  const fn = page.match(/_pushVisit\(next\)\{[\s\S]*?\n  \},/);
  assert.ok(fn, '_pushVisit was not found');
  assert.match(fn[0], /if \(location\.pathname \+ location\.search \+ location\.hash === next\) this\.recordVisit/,
    '_pushVisit records without checking that the push took');
});

test('recording a route stores the destination, and a revisit moves it rather than splitting it', () => {
  const { shell } = shellWith();
  shell.recordVisit('/web-tools/app/?view=sessions&session=2bf8fcae&lens=list');
  assert.equal(shell.visits.length, 1);
  assert.equal(shell.visits[0].view, 'sessions');
  assert.equal(shell.visits[0].session, '2bf8fcae');
  assert.equal(shell.visits[0].seen, 1);

  // The same screen at another lens is the same destination.
  shell.recordVisit('/web-tools/app/?view=sessions&session=2bf8fcae&lens=table&grain=turn');
  assert.equal(shell.visits.length, 1, 'a reading parameter split one destination into two rows');
  assert.equal(shell.visits[0].seen, 2);

  // A different screen is a different row, newest first.
  shell.recordVisit('/web-tools/app/?view=map&tab=views');
  assert.equal(shell.visits.length, 2);
  assert.equal(shell.visits[0].view, 'map');
});

test('rendering a pasted document is counted and never stored', () => {
  const { shell } = shellWith();
  const MARK = 'PASTEDDOCUMENT';
  const blob = 'H4sIA' + MARK + 'y'.repeat(400) + MARK;
  shell.recordVisit('/web-tools/pages/toss-render.html#gz=' + blob);
  assert.equal(shell.visits.length, 1);
  const row = shell.visits[0];
  assert.equal(row.kind, 'payload');
  assert.ok(row.bytes > 400, 'the size is worth keeping even when the bytes are not');
  assert.ok(!JSON.stringify(shell.visits).includes(MARK),
    'the log holds the pasted document; this is the failure the whole design exists to prevent');
  assert.equal(shell.visitOpenable(row), false, 'a payload row must not offer a link it cannot honour');
  // The row says its size and nothing else, on one line, since the size is the
  // only honest thing a refusal can report about what it refused.
  assert.equal(shell.visitLabel(row), 'Local document');
  assert.match(shell.visitDetail(row), /^\d+(\.\d)? (B|KB|MB)$/,
    'a payload row should name its size: ' + shell.visitDetail(row));
  assert.equal(shell.visitBytes(0), 'not stored');
});

test('a row is one line: the thing, then the short context, and never both the same', () => {
  // The house style keeps a menu row to one line (the launcher menu says so
  // outright) and keeps one type size across everything a reader came to read.
  // A stacked label over a muted text-sm detail broke both, and it also buried
  // the filename behind its category. So the label names the SPECIFIC thing and
  // the detail names the short context it sits in.
  const { shell } = shellWith();
  shell.routeManifest = { routes: rows('app-routes.csv') };
  const say = (u) => {
    shell.visits = [];
    shell.recordVisit(u);
    const v = shell.visits[0];
    return [shell.visitLabel(v), shell.visitDetail(v)];
  };

  assert.deepEqual(say('/web-tools/app/?view=search&sfile=mehrlander/home:CLAUDE.md'),
    ['CLAUDE.md', 'Files'], 'a file row leads with the file, not with its category');
  assert.deepEqual(say('/web-tools/app/?view=project&project=projects/budget-drs&tab=board'),
    ['budget-drs', 'Project']);
  assert.deepEqual(say('/web-tools/app/?view=sessions&session=2bf8fcae'),
    ['2bf8fcae', 'Sessions']);
  assert.deepEqual(say('/web-tools/pages/toss-render.html#gh=mehrlander/web-tools@x:pages/links.html'),
    ['links.html', 'web-tools']);

  // A route that IS the destination names itself once and takes its repo as the
  // context, rather than saying the same word in both halves.
  // The unrecognized row follows the same rule: the page that failed to match
  // is the specific thing, and the word "unrecognized" is its context. Labelled
  // the other way round it clipped itself against a filename.
  assert.deepEqual(say('/web-tools/pages/toss-render.html#undescribedKey=abc'),
    ['toss-render.html', 'unrecognized']);

  const [repoLabel, repoDetail] = say('/web-tools/app/?view=estate');
  assert.equal(repoLabel, 'Repos');
  assert.notEqual(repoDetail, 'Repos', 'the two halves said the same word twice');

  // Nothing is parked in a `title`, which reaches no touch screen and no
  // screenshot (house style, rule 11).
  const panel = page.match(/<div x-show="markMenu"[\s\S]*?\n      <\/div>/);
  assert.ok(panel, 'the mark menu panel was not found');
  assert.ok(!/:title=/.test(panel[0]), 'a fact was parked in a title inside the mark menu');
  assert.ok(!/text-sm/.test(panel[0]),
    'the menu demoted a row to text-sm; this sidebar carries hierarchy in opacity, not size');
});

test('the list is capped, so the log cannot grow without bound', () => {
  const { shell } = shellWith();
  for (let i = 0; i < shell.VISITS_CAP + 12; i++) {
    shell.recordVisit('/web-tools/app/?view=project&project=projects/p' + i);
  }
  assert.equal(shell.visits.length, shell.VISITS_CAP);
  // Newest first, so the cap drops the oldest rather than refusing the newest.
  assert.equal(shell.visits[0].project, 'projects/p' + (shell.VISITS_CAP + 11));
});

test('a storage that refuses costs nothing', () => {
  // Private mode, blocked site data, a full quota: every localStorage touch in
  // this shell is wrapped, and a visit log is the last thing that should take a
  // page down. The in-memory list still works, which is what the menu renders.
  const { shell } = shellWith();
  const ls = win.localStorage;
  win.localStorage = { getItem(){ throw new Error('denied'); },
                       setItem(){ throw new Error('denied'); } };
  try {
    assert.doesNotThrow(() => shell.loadVisits());
    assert.doesNotThrow(() => shell.recordVisit('/web-tools/app/?view=map'));
    assert.equal(shell.visits.length, 1, 'the in-memory list is what the menu reads');
  } finally { win.localStorage = ls; }
});

test('the mark opens a menu, and Home on main appears only off the default ref', () => {
  const { shell } = shellWith();
  const mark = shell.sidebarCrumbs[0];
  assert.equal(mark.key, 'home');
  assert.ok(mark.menu, 'the mark draws no caret, so nothing says it opens a menu');

  mark.action(true);
  assert.equal(shell.markMenu, true);
  mark.action(false);
  assert.equal(shell.markMenu, false);

  // On main the row would go where you already are.
  assert.equal(shell.offMainRef, false);
});

// THE SHELL MUST ALREADY HAVE WHAT THESE TESTS STUB, and this guard exists
// because the first version of them did not check. `goHomeOnMain` called
// `this._go(this.showRepoBase)`, lifted from fab.js where both of those live;
// the shell had neither. The tests passed anyway: one INSTALLED `_go` before
// calling the method under test, and the assertion compared `went` against
// `shell.showRepoBase`, which was undefined on both sides. So a dead row and a
// green suite, until it was tapped on a phone. A stub may stand in for a
// method; it may never conjure one.
function goCapture(shell) {
  assert.equal(typeof shell._go, 'function',
    'the shell has no _go, so every navigation in the mark menu is a TypeError');
  const calls = [];
  shell._go = (u) => calls.push(u);
  return calls;
}

test("the shell owns the address Home on main goes to, and it matches the fab's", () => {
  const { shell } = shellWith();
  assert.match(shell.APP_HOME, /^https:\/\/[\w.-]+\/[\w./-]*$/,
    'APP_HOME is not an absolute URL: ' + shell.APP_HOME);
  // The fab carries the same address for its own Home row, for pages that are
  // not this app. Two copies, held to each other here so the duplicate is loud.
  const fab = readFileSync(path.join(repoRoot, 'lib/alpineComponents/fab.js'), 'utf8');
  const m = fab.match(/showRepoBase: '([^']+)'/);
  assert.ok(m, "the fab's showRepoBase was not found");
  assert.equal(shell.APP_HOME, m[1],
    'app/index.html APP_HOME and fab.js showRepoBase name different homes');
});

test('off the default ref, Home on main leaves for the deployed app', () => {
  const { shell } = makeShell({
    browserStore: { repo: 'mehrlander/web-tools', ref: '', defaultRef: 'main' },
    search: '?use=claude/some-branch&view=map', win,
  });
  assert.equal(shell.offMainRef, true, 'a ?use= pin off main is exactly the state this row is for');
  const went = goCapture(shell);
  shell.goHomeOnMain();
  assert.deepEqual(went, [shell.APP_HOME],
    'Home on main must be a fixed address, not a re-render of this view elsewhere');
  assert.ok(went[0], 'the navigation target was empty');
  assert.equal(shell.markMenu, false, 'the menu stayed up over the navigation');

  // The ref is said as an ADDRESS, in the pathless form of the grammar the
  // repo already speaks (kits/review-target.js: `owner/repo@branch` is the repo
  // at a ref, and the ':' introduces a path), with the owner dropped the way
  // the crumb trail beside it drops it.
  assert.equal(shell.homeAddress, 'web-tools@main');
});

test('a framed app leaves through the shell, because the sandbox forbids the tab', () => {
  // The reported symptom, twice over. First the row threw, because the shell had
  // no _go. Then it "reloaded but did not navigate", which is the shape of a
  // BLOCKED TOP NAVIGATION: pages/toss-render.html mounts address mode with
  // `allow-scripts allow-same-origin allow-popups allow-forms allow-modals
  // allow-downloads` and no allow-top-navigation, so `window.top.location.href`
  // is refused and the fallback navigated the frame instead. The app reloaded at
  // main INSIDE the preview and the address bar never moved.
  //
  // allow-same-origin is the way out: the subject calls __tossLeave and the
  // unsandboxed shell navigates itself.
  const toss = readFileSync(path.join(repoRoot, 'pages/toss-render.html'), 'utf8');
  const addressMode = toss.match(/mountFrame\(html, '([^']*allow-same-origin[^']*)'/);
  assert.ok(addressMode, 'the address-mode mountFrame call was not found');
  assert.ok(!addressMode[1].includes('allow-top-navigation'),
    'address mode now permits top navigation; the __tossLeave hop may be unnecessary, ' +
    'but do not drop it without re-testing on a phone');
  assert.match(toss, /window\.__tossLeave = /, 'the shell lost the handle the framed app leaves through');

  const framed = (top) => {
    const m = makeShell({ browserStore: { repo: 'mehrlander/web-tools', ref: '', defaultRef: 'main' },
                          search: '?use=claude/x', win });
    m.location.href = 'blob:https://mehrlander.github.io/abc';
    m.win.top = top; m.win.self = m.win;
    return m;
  };

  // The real case: the shell offers the handle and the top write would throw.
  let left = '';
  const a = framed({ __tossLeave: (u) => { left = u; },
                     location: { set href(v) { throw new Error('sandbox: top navigation refused'); } } });
  a.shell.goHomeOnMain();
  assert.equal(left, a.shell.APP_HOME, 'the handoff did not reach __tossLeave');
  assert.equal(a.location.href, 'blob:https://mehrlander.github.io/abc',
    'the frame navigated itself as a consolation, which is the bug being fixed: ' +
    'the reader reloads inside the preview and never leaves it');

  // A framer that is not our renderer: no handle, but the write may be allowed.
  const topLoc = { href: 'https://example.invalid/' };
  const b = framed({ location: topLoc });
  b.shell.goHomeOnMain();
  assert.equal(topLoc.href, b.shell.APP_HOME);
  assert.equal(b.location.href, 'blob:https://mehrlander.github.io/abc');

  // Neither available: SAY SO. A new tab was tried here and is gone; it works,
  // and tapping "Home" to get a second tab beside the one you wanted to leave
  // is its own small wrongness, reported as one within a day. Navigating this
  // frame stays out of the question either way.
  const opened = [];
  win.open = (u) => { opened.push(u); };
  const c = framed({ location: { set href(v) { throw new Error('blocked'); } } });
  c.shell.goHomeOnMain();
  assert.deepEqual(opened, [], 'a sealed frame opened a tab the reader did not ask for');
  assert.equal(c.location.href, 'blob:https://mehrlander.github.io/abc',
    'the frame navigated itself, which is the bug being fixed');
  assert.ok(c.toasts.some(t => /framed in/.test(t.msg || '')),
    'a sealed frame failed silently, which reads as a dead button');
  delete win.open;
});

test('unframed, Home on main is a plain navigation to the base URL', () => {
  // What the row means with no branches in the picture at all: the deployed
  // address, no query, no pin, nothing clever.
  const m = makeShell({ browserStore: { repo: 'mehrlander/web-tools', ref: '', defaultRef: 'main' },
                        search: '?use=claude/x&view=map', win });
  m.location.href = 'https://mehrlander.github.io/web-tools/app/?use=claude/x&view=map';
  m.win.top = m.win; m.win.self = m.win;
  m.shell.goHomeOnMain();
  assert.equal(m.location.href, m.shell.APP_HOME);
  assert.ok(!m.location.href.includes('?'), 'the base URL carried a query');
});



test('re-opening a visit rebuilds an address from the row, never replays a string', () => {
  const { shell } = shellWith();
  const went = goCapture(shell);

  shell.openVisit({ kind: 'toss', repo: 'mehrlander/web-tools', ref: 'claude/x', path: 'pages/index.html' });
  assert.equal(went.at(-1), '../pages/toss-render.html#gh=mehrlander/web-tools@claude/x:pages/index.html');

  shell.openVisit({ kind: 'route', view: 'project', project: 'projects/budget-drs', tab: 'board' });
  assert.match(went.at(-1), /\?view=project&project=projects%2Fbudget-drs&tab=board$/);

  // The two rows that have nowhere to go stay where they are.
  const before = went.length;
  shell.openVisit({ kind: 'payload', mode: 'gz', bytes: 900 });
  shell.openVisit({ kind: 'unrecognized', why: 'x' });
  assert.equal(went.length, before, 'a row with no stored address offered a navigation anyway');
});
