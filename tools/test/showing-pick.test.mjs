// scripts/showing.py — which render link shows a branch's changes.
//
// The script is python3/stdlib, so this drives it the way a person does,
// through the file system, and reads what it prints. Same shape as
// dead-opacity.test.mjs.
//
// What is pinned is the CLASSIFIER, and the case that matters most is the one
// the repo got wrong by hand on 2026-08-22: a change under
// lib/alpineComponents/ was reported as unshowable "because it is in the app
// shell". It is in lib, and `?use=` reaches it. That reading is now a fixture
// rather than a thing a session has to recall correctly under pressure.
//
// The four rules come from docs/routes.json's `showing.picker`, so a rule
// changing there and not here should fail: the fixtures below ARE the picker's
// behaviour, and a mechanism table nothing executes is what this replaced.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const SCRIPT = path.join(repoRoot, 'scripts/showing.py');
const ZERO = '0'.repeat(40);
// A link spells a commit at 12 characters; the JSON keeps it whole.
const Z12 = ZERO.slice(0, 12);

function run(files, extra = []) {
  const out = execFileSync('python3', [SCRIPT, '--files', files, '--json', ...extra],
    { cwd: repoRoot, encoding: 'utf8' });
  return JSON.parse(out);
}

// A diff fixture, since the top-level-document test reads hunks rather than
// paths: the same file is showable or not depending on what the change DOES.
function withDiff(files, text) {
  const f = path.join(mkdtempSync(path.join(tmpdir(), 'showing-')), 'd.diff');
  writeFileSync(f, text);
  return run(files, ['--diff', f]);
}

test('a lib change resolves to ?use=, which is the call the repo got wrong by hand', () => {
  const d = run('lib/alpineComponents/estate.js,dist/web-tools.js');
  assert.equal(d.mechanism, 'use');
  const app = d.links.find(l => l.page === 'app/index.html');
  assert.ok(app, 'the app is the subject, since app-routes.csv declares the file as its code');
  assert.match(app.url, new RegExp(`^https://mehrlander\\.github\\.io/web-tools/app/\\?use=${Z12}(&|$)`));
  assert.equal(d.sha, ZERO, 'the JSON keeps the whole commit; only the link is short');
  // Not seven links. A page importing the pre-build LOADS every component and
  // renders few, so those are reported as carried rather than offered.
  assert.equal(d.links.length, 1);
  assert.ok(d.carried.length >= 3);
});

test('a shared reader is offered to each page and requires an explicit app view', () => {
  const d = run('lib/kits/session-render.js,dist/web-tools.js');
  const pages = d.links.map(l => l.page);
  assert.ok(pages.includes('pages/session.html'), 'the page that names it in a gh.load chain');
  for (const link of d.links) {
    assert.doesNotMatch(link.page, /\\/, 'repository paths use forward slashes on every host');
    assert.doesNotMatch(link.url, /\\|%5c/i, 'render URLs must not inherit filesystem separators');
  }
  const app = d.links.find(l => l.page === 'app/index.html');
  assert.equal(app.view, null, 'Search and Sessions share the reader, so neither route is implied');
  assert.equal(new URL(app.url).searchParams.has('view'), false);
  assert.match(d.warnings.join(' '), /2 routes \(search, sessions\)/);
  for (const view of ['search', 'sessions']) {
    const explicit = run('lib/kits/session-render.js,dist/web-tools.js', ['--query', 'view=' + view]);
    const link = explicit.links.find(l => l.page === 'app/index.html');
    assert.equal(new URL(link.url).searchParams.get('view'), view, 'the requested view reaches the shared reader');
  }
});

test('a page file resolves to the toss, since ?use= never swaps a page shell', () => {
  const d = run('pages/session.html');
  assert.equal(d.mechanism, 'toss-gh');
  const [l] = d.links;
  // AND NO ?use= ON THE SHELL. It was there on the reasoning that the renderer
  // should match the ref the page is fetched at, which the @ref in the fragment
  // already achieves: toss-render injects use=<ref> into the framed page. What
  // the shell pin changes is how the SHELL's own lib arrives, through a blob
  // import and the contents API rather than from jsDelivr, and on an iPhone a
  // shell loaded that way while hosting a frame kills the web process every
  // time. The mechanism is not yet established; the measurement is. Measured by
  // matrix on the device
  // 2026-09-08: pinned shell plus frame dies whatever the frame holds, the same
  // pin with no frame survives, and a frame under an unpinned shell survives
  // with the subject still pinned to the branch.
  assert.doesNotMatch(l.url, /toss-render\.html\?use=/);
  assert.match(l.url, /toss-render\.html#gh=mehrlander\/web-tools@0{12}:pages\/session\.html$/);
});

test('the renderer previews by nesting rather than by rendering itself', () => {
  const d = run('pages/toss-render.html');
  assert.equal(d.mechanism, 'toss-nested');
  assert.equal((d.links[0].url.match(/#gh=/g) || []).length, 2);
});

test('a shell change acting on the top-level document reaches no link at all', () => {
  // The favicon case (PR #315): a framed shell sets it on its own document,
  // correctly and invisibly, because the tab belongs to whatever is on top.
  const d = withDiff('pages/branch.html', '+++ b/pages/branch.html\n+ document.title = subject;\n');
  assert.equal(d.mechanism, 'none');
  assert.match(d.why.join(' '), /document\.title/);
  // The control: the same file, a change that touches nothing top-level.
  const ok = withDiff('pages/branch.html', '+++ b/pages/branch.html\n+ const x = 1;\n');
  assert.equal(ok.mechanism, 'toss-gh');
});

test('docs and tools get an honest no-link rather than a link that shows nothing', () => {
  const d = run('docs/showing.md,tools/test/x.test.mjs');
  assert.equal(d.mechanism, 'none-needed');
  assert.equal(d.links.length, 0);
});

test('lib without a rebuilt pre-build warns, since ?use= fetches dist', () => {
  const d = run('lib/kits/session-render.js');
  assert.match(d.warnings.join(' '), /build:lib/);
  // And says nothing about it once the artifact rides along.
  const built = run('lib/kits/session-render.js,dist/web-tools.js');
  assert.ok(!/build:lib/.test(built.warnings.join(' ')));
});

// ── the read itself, not the classifier ─────────────────────────────────────
//
// Every test above hands the script a file list with --files, which is exactly
// the blind spot that shipped: the classifier was right the whole time and the
// INPUT was empty, because `sh()` returned `.stdout.strip()` without reading
// the exit code. A failed `git diff` and a branch that changed nothing were the
// same value, so a nine-file branch printed "No render link: nothing that
// renders changed" and a session passed that on (2026-09-03, PR #574).
//
// Driven through git rather than a fixture, since the defect lives in the git
// read. `git commit-tree` on the empty tree makes a dangling orphan commit: it
// shares no ancestor with HEAD, so `orphan...HEAD` fails with "no merge base",
// which is the same failure the sandbox's shallow clone produces every run.
// Nothing is written: no ref moves and the working tree is untouched.
//
// The identity is passed in rather than inherited. `commit-tree` writes a
// commit object and so demands an author, and a CI runner has no git identity
// configured: this test passed on every developer machine and failed the first
// time it ran on Actions with "fatal: empty ident name" (run 33777865076). The
// value is irrelevant, since the object is never referenced or pushed; what
// matters is that the test carries its own and depends on no ambient config.
const IDENT = {
  GIT_AUTHOR_NAME: 'showing-test', GIT_AUTHOR_EMAIL: 'showing-test@invalid',
  GIT_COMMITTER_NAME: 'showing-test', GIT_COMMITTER_EMAIL: 'showing-test@invalid',
};

// THE LINK THAT RESOLVES, RENDERS, AND SHOWS NOTHING, one level down from the
// one this script exists to prevent. A page routing on its own hash opens on
// its default without an address, and for branch.html and session.html that
// default is the empty form. Emitted twice on 2026-09-05 and opened twice
// before anyone worked out why.
test('a page that routes on its own hash is warned about, and --at answers it', () => {
  const bare = run('pages/branch.html');
  assert.equal(bare.mechanism, 'toss-gh');
  assert.ok(bare.warnings.some(w => /location\.hash/.test(w) && /--at/.test(w)),
    'the warning names the risk and the flag: ' + JSON.stringify(bare.warnings));
  assert.ok(!bare.links[0].url.includes('#gh=mehrlander/web-tools&pr='),
    'and the bare link carries no address');

  const at = run('pages/branch.html', ['--at', 'gh=owner/repo&pr=12']);
  assert.ok(at.links[0].url.endsWith(':pages/branch.html#gh=owner/repo&pr=12'),
    'the address rides as a trailing fragment, which the toss hands the page as its own hash');
  assert.equal(at.warnings.filter(w => /location\.hash/.test(w)).length, 0,
    'and the warning stands down once an address is given');
});

// The warning is scoped, not blanket: a file that reaches no hash-routing page
// must not carry it, or it becomes noise every session learns to skip.
test('a subject that reads no hash is not warned about', () => {
  const d = run('docs/showing.md');
  assert.equal(d.warnings.filter(w => /location\.hash/.test(w)).length, 0);
});

test('a diff that FAILS is never reported as a diff that found nothing', () => {
  const emptyTree = execFileSync('git', ['hash-object', '-t', 'tree', '/dev/null'],
    { cwd: repoRoot, encoding: 'utf8' }).trim();
  const orphan = execFileSync('git', ['commit-tree', emptyTree, '-m', 'orphan probe'],
    { cwd: repoRoot, encoding: 'utf8', input: '', env: { ...process.env, ...IDENT } }).trim();

  const raw = execFileSync('python3', [SCRIPT, '--base', orphan, '--json'],
    { cwd: repoRoot, encoding: 'utf8' });
  const d = JSON.parse(raw);

  assert.equal(d.mechanism, 'unknown', 'a failed read is its own answer');
  assert.notEqual(d.mechanism, 'none-needed',
    'the whole defect: "could not read" wearing the words of "nothing to show"');
  assert.match(d.warnings.join(' '), /could not read the diff|SHALLOW/);
  assert.equal(d.links.length, 0);

  // And the printed line, which is what a session actually copies. It must not
  // contain the phrase that travelled into a reply.
  const text = execFileSync('python3', [SCRIPT, '--base', orphan],
    { cwd: repoRoot, encoding: 'utf8' });
  assert.match(text, /CANNOT TELL/);
  assert.ok(!/nothing that renders changed/.test(text),
    'the false-negative wording must not appear on a failed read');
});

// ANOTHER REPO'S PAGES. A repo whose pages one app frames declares the app and
// its views in .web-tools.json, and the picker reads that instead of this
// repo's page graph. The fixture is home's shape. What is pinned is the route:
// the 2026-09-05 read of the session store found "the framed page on its own,
// where the app was wanted" the largest named cause of a wrong render link,
// and the rule lived in three prose files and no executable.
function framedRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), 'showing-framed-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/mehrlander/home.git'], { cwd: dir });
  writeFileSync(path.join(dir, '.web-tools.json'), JSON.stringify({ showing: {
    hosted: false,
    app: 'projects/budget-drs/app/view/app.html',
    app_dir: 'projects/budget-drs/app/',
    views: { submittal: 'projects/budget-drs/submittal/', cem: ['projects/budget-drs/cem/'] },
  } }));
  return dir;
}

function runIn(root, files, extra = []) {
  const out = execFileSync('python3',
    [SCRIPT, '--root', root, '--files', files, '--json', ...extra],
    { cwd: repoRoot, encoding: 'utf8' });
  return JSON.parse(out);
}

test('a framed page resolves to the app carrying its view, never to the page on its own', () => {
  const d = runIn(framedRepo(), 'projects/budget-drs/submittal/submittal.html,projects/budget-drs/submittal/data.js');
  assert.equal(d.mechanism, 'toss-app');
  assert.equal(d.links.length, 1, 'two files under one view are one link');
  const [l] = d.links;
  assert.equal(l.page, 'projects/budget-drs/app/view/app.html');
  assert.equal(l.view, 'submittal');
  assert.match(l.url, new RegExp(`#gh=mehrlander/home@${Z12}:projects/budget-drs/app/view/app\\.html\\?view=submittal$`));
  assert.doesNotMatch(l.url, /\?use=/, 'the renderer is web-tools main; the ref belongs to the framed repo');
  // The MCP body-cap warning fires exactly when the address reaches the cap,
  // and says where that matters rather than shortening it by hand. This one
  // fell under it on 2026-10-02, when commits went to 12 characters.
  assert.equal(d.warnings.some(w => /150\+ characters/.test(w)), l.url.length >= 150);
});

test("a change under the app's own folder is the app, bare, since the path does not name a view", () => {
  const d = runIn(framedRepo(), 'projects/budget-drs/app/spend/data.js');
  assert.equal(d.mechanism, 'toss-app');
  assert.equal(d.links[0].view, null);
  assert.match(d.links[0].url, /app\.html$/);
});

test('a view beats the bare app when a branch touches both', () => {
  const d = runIn(framedRepo(), 'projects/budget-drs/app/spend/data.js,projects/budget-drs/cem/cem.html');
  assert.deepEqual(d.links.map(l => l.view), ['cem']);
});

test('an HTML file the manifest does not frame is tossed on its own and said to be undeclared', () => {
  const d = runIn(framedRepo(), 'created/thing.html,chron/2026/09/x.md');
  assert.equal(d.mechanism, 'toss-app');
  assert.equal(d.links[0].page, 'created/thing.html');
  assert.match(d.links[0].url, /#gh=mehrlander\/home@0{12}:created\/thing\.html$/);
  assert.ok(d.warnings.some(w => /not declared under showing\.views/.test(w)));
});

test('a framed repo with only non-rendering changes says so in the same words as this one', () => {
  const d = runIn(framedRepo(), 'chron/2026/09/x.md,tools/x.py');
  assert.equal(d.mechanism, 'none-needed');
});

// THE FLAGS THAT REACHED EVERY MECHANISM EXCEPT THE ONE THEY WERE ADDED FOR.
// `--query` exists because the app routes on ?view=, which `--at` cannot
// express; the comment above address() says as much, and names the 2026-09-08
// link that got hand-built for want of it. pick_framed took neither argument
// and passed neither on, so on toss-app, the only mechanism a framed repo ever
// reaches, both were silently dropped: the script printed a bare ?view= link
// and said nothing, which is worse than refusing, since the address looks
// right. Found 2026-09-09 while trying to put &track= on a render line.
test('--query joins the view on a framed link rather than being dropped', () => {
  const d = runIn(framedRepo(), 'projects/budget-drs/submittal/submittal.html',
                  ['--query', 'tab=abs&track=submittal']);
  assert.equal(d.mechanism, 'toss-app');
  assert.match(d.links[0].url, /\?view=submittal&tab=abs&track=submittal$/,
    'the query joins with & because the framed page reads one query span');
});

test('--at puts a fragment on a framed link', () => {
  const d = runIn(framedRepo(), 'projects/budget-drs/submittal/submittal.html',
                  ['--at', 'note=abc']);
  assert.equal(d.mechanism, 'toss-app');
  assert.match(d.links[0].url, /#note=abc$/);
});

// ── The overlay (docs/loader.md, "The selection") ───────────────────────────
// Main at a pinned commit with the branch's changed files over it, offered only
// when it is the merge preview: main changed none of those files since the
// branch point, and the branch removes none. --overlay yes stands in for a main
// whose renderer and build read path entries; --main-changed, --removed and
// --behind stand in for the git facts.
const B12 = 'b'.repeat(12);
test('a lib change on a branch behind main, touching nothing main touched, is an overlay pinned to main', () => {
  const d = run('lib/alpineComponents/estate.js,dist/web-tools.js', ['--overlay', 'yes', '--behind', '9', '--main-changed', 'lib/kits/other.js']);
  assert.equal(d.mechanism, 'overlay');
  assert.equal(d.links.find(l => l.page === 'app/index.html').url,
    'https://mehrlander.github.io/web-tools/pages/toss-render.html'
    + `?refs=mehrlander/web-tools@${B12}&refs=mehrlander/web-tools@${Z12}:lib/alpineComponents/estate.js`
    + `#gh=mehrlander/web-tools@${B12}:app/index.html`, 'main is pinned, the build left out, the one file over it');
  assert.ok(d.warnings.some(w => /150\+ characters/.test(w)), 'an overlay still passes the MCP body cap, and says so');
  assert.ok(d.why.some(w => /9 commit\(s\) behind main.*a merge would produce/.test(w)));
});

test('main having changed an overlaid file refuses the overlay and says neither link is the merge', () => {
  const d = run('lib/alpineComponents/estate.js,dist/web-tools.js', ['--overlay', 'yes', '--behind', '9', '--main-changed', 'lib/alpineComponents/estate.js']);
  assert.equal(d.mechanism, 'use');
  assert.ok(d.warnings.some(w => /main has changed 1 of this branch's files.*Neither link shows the merge/.test(w)));
  assert.ok(d.why.some(w => /as it stands: 9 commit\(s\) behind main/.test(w)), 'the fallback does not claim to be the real thing');
});

test('a deleted or renamed file refuses the overlay', () => {
  const d = run('pages/diff-tool.html,lib/kits/branch-status.js', ['--overlay', 'yes', '--behind', '2', '--removed', 'lib/kits/old.js']);
  assert.equal(d.mechanism, 'toss-gh');
  assert.ok(d.warnings.some(w => /deletes or renames lib\/kits\/old\.js/.test(w)));
});

test('on a lagging branch a changed page is addressed at the branch, with pinned main under it and its other files over it', () => {
  const d = run('pages/diff-tool.html,lib/kits/branch-status.js', ['--overlay', 'yes', '--behind', '2']);
  assert.equal(d.mechanism, 'overlay');
  assert.equal(d.links[0].url, 'https://mehrlander.github.io/web-tools/pages/toss-render.html'
    + `?refs=mehrlander/web-tools@${B12}&refs=mehrlander/web-tools@${Z12}:lib/kits/branch-status.js`
    + `#gh=mehrlander/web-tools@${Z12}:pages/diff-tool.html`);
  assert.ok(d.why.some(w => /2 commit\(s\) behind main.*a merge would produce/.test(w)));
});

test('while main cannot read path entries, a lib change stays on ?use=', () => {
  const d = run('lib/alpineComponents/estate.js,dist/web-tools.js', ['--overlay', 'no']);
  assert.equal(d.mechanism, 'use');
});

test('past the cap the overlay steps aside and says so', () => {
  const many = Array.from({ length: 21 }, (_, i) => `lib/kits/k${i}.js`).join(',');
  const d = run(many, ['--overlay', 'yes', '--behind', '2']);
  assert.equal(d.mechanism, 'use');
  assert.ok(d.warnings.some(w => /past the overlay's 20/.test(w)));
});

test('a generated catalog both sides changed is read at main, named, and does not refuse the overlay', () => {
  const d = run('lib/alpineComponents/estate.js,docs/tests.csv,dist/web-tools.js',
    ['--overlay', 'yes', '--behind', '3', '--main-changed', 'docs/tests.csv']);
  assert.equal(d.mechanism, 'overlay');
  assert.ok(!d.links[0].url.includes('docs/tests.csv'), 'a regenerated file is not overlaid');
  assert.ok(d.why.some(w => /generated file\(s\).*docs\/tests\.csv.*read at main/.test(w)));
});

// Level with main, a merge fast-forwards, so the branch's own commit is the
// merge and one ref shows it. The overlay listed main and every changed file
// as separate refs even then, which is how a branch zero commits behind
// handed over links several hundred characters long (2026-10-02).
test('level with main, a changed page is the plain toss at the branch, not an overlay', () => {
  const d = run('pages/diff-tool.html,lib/kits/branch-status.js,dist/web-tools.js', ['--overlay', 'yes']);
  assert.equal(d.mechanism, 'toss-gh');
  assert.equal(d.links[0].url, `https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=mehrlander/web-tools@${Z12}:pages/diff-tool.html`);
  assert.ok(d.why.some(w => /level with main.*fast-forward/.test(w)));
  assert.ok(!d.warnings.some(w => /overlay/.test(w)), 'nothing to refuse when no overlay is wanted');
});

test('level with main, a rebuilt lib change is ?use= at the branch, and the cap does not apply', () => {
  const many = Array.from({ length: 21 }, (_, i) => `lib/kits/k${i}.js`).concat('dist/web-tools.js').join(',');
  const d = run(many, ['--overlay', 'yes']);
  assert.equal(d.mechanism, 'use');
  assert.ok(!d.warnings.some(w => /past the overlay/.test(w)));
});

test('level with main, a lib change with no rebuilt bundle keeps the overlay, which steps around the stale build', () => {
  const d = run('lib/alpineComponents/estate.js', ['--overlay', 'yes']);
  assert.equal(d.mechanism, 'overlay');
  assert.ok(d.why.some(w => /current with main, so for those files this is the branch itself/.test(w)));
});

test('a kit demo is a page file under lib/, so it is tossed rather than reached by ?use=', () => {
  // ?use= swaps the code a page loads, never the page: Pages serves the demo
  // file from the default branch, so a new demo had no ?use= link that showed
  // it, and the classifier used to offer the pre-build's pages instead.
  const d = run('lib/kits/look.js,lib/kits/demos/look.html,dist/web-tools.js');
  assert.equal(d.mechanism, 'toss-gh');
  assert.deepEqual(d.links.map(l => l.page), ['lib/kits/demos/look.html']);
});

test('a page that takes look links says so, and a look link naming no anchor is caught', () => {
  // The hint arrives at the handover, which is when a session decides what the
  // link says; the check catches a renamed anchor before the reader does.
  let d = run('lib/kits/demos/look.html');
  assert.equal(d.look.length, 1);
  assert.equal(d.look[0].page, 'lib/kits/demos/look.html');
  assert.ok(d.look[0].anchors.includes('btn-export'));
  assert.ok(d.look[0].walks.includes('change-licenses'));
  d = run('lib/kits/demos/look.html', ['--at', 'tap=btn-export&say=here']);
  assert.deepEqual(d.look, [], 'a link already carrying a look key needs no hint');
  assert.ok(!d.warnings.some(w => /look link/.test(w)), 'and a resolving anchor draws no warning');
  d = run('lib/kits/demos/look.html', ['--at', 'tap=renamed-button']);
  assert.ok(d.warnings.some(w => /'renamed-button' is not an anchor/.test(w)));
  d = run('pages/approve.html');
  assert.deepEqual(d.look, [], 'a page without the kit gets no hint');
});
