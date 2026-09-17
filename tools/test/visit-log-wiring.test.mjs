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

test('off the default ref, Home on main leaves for the deployed app', () => {
  const { shell, location } = makeShell({
    browserStore: { repo: 'mehrlander/web-tools', ref: '', defaultRef: 'main' },
    search: '?use=claude/some-branch&view=map', win,
  });
  assert.equal(shell.offMainRef, true, 'a ?use= pin off main is exactly the state this row is for');
  let went = '';
  shell._go = (u) => { went = u; };
  shell.goHomeOnMain();
  assert.equal(went, shell.showRepoBase,
    'Home on main must be a fixed address, not a re-render of this view elsewhere');
  assert.equal(shell.markMenu, false, 'the menu stayed up over the navigation');
  assert.ok(location);
});

test('re-opening a visit rebuilds an address from the row, never replays a string', () => {
  const { shell } = shellWith();
  let went = '';
  shell._go = (u) => { went = u; };

  shell.openVisit({ kind: 'toss', repo: 'mehrlander/web-tools', ref: 'claude/x', path: 'pages/index.html' });
  assert.equal(went, '../pages/toss-render.html#gh=mehrlander/web-tools@claude/x:pages/index.html');

  shell.openVisit({ kind: 'route', view: 'project', project: 'projects/budget-drs', tab: 'board' });
  assert.match(went, /\?view=project&project=projects%2Fbudget-drs&tab=board$/);

  // The two rows that have nowhere to go stay where they are.
  went = '';
  shell.openVisit({ kind: 'payload', mode: 'gz', bytes: 900 });
  shell.openVisit({ kind: 'unrecognized', why: 'x' });
  assert.equal(went, '', 'a row with no stored address offered a navigation anyway');
});
