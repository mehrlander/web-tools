// python/showing.py — which render link shows a branch's changes.
//
// The script is python3/stdlib, so this drives it the way a person does,
// through the file system, and reads what it prints. Same shape as
// dead-opacity.test.mjs.
//
// What is pinned is the CLASSIFIER, and the case that matters most is the one
// the repo got wrong by hand on 2026-08-22: a change under
// lib/alpineComponents/ was reported as unshowable "because it is in the app
// shell". It is in lib, and a toss at the branch reaches it. That reading is now a fixture
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

const SCRIPT = path.join(repoRoot, 'python/showing.py');
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
// The tossed page's own ?query, which rides inside the fragment after its path.
const pageQuery = (url) => new URLSearchParams(((url.split('#gh=')[1] || '').split('?')[1] || '').split('#')[0]);

function withDiff(files, text) {
  const f = path.join(mkdtempSync(path.join(tmpdir(), 'showing-')), 'd.diff');
  writeFileSync(f, text);
  return run(files, ['--diff', f]);
}

test('a lib change resolves to a toss of the page that draws it, which is the call the repo got wrong by hand', () => {
  const d = run('lib/alpineComponents/estate.js,dist/web-tools.js');
  assert.equal(d.mechanism, 'toss-gh');
  const app = d.links.find(l => l.page === 'app/index.html');
  assert.ok(app, 'the app is the subject, since app-routes.csv declares the file as its code');
  // The toss supersedes ?use= as the preview link (docs/showing-consolidation.md):
  // tossed at the branch, the untouched page boots the branch's library.
  assert.equal(app.url, `https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=mehrlander/web-tools@${Z12}:app/index.html`);
  assert.equal(d.sha, ZERO, 'the JSON keeps the whole commit; only the link is short');
  // Not seven links. A page importing the pre-build LOADS every component and
  // renders few, so those are reported as carried rather than offered.
  assert.equal(d.links.length, 1);
  assert.ok(d.carried.length >= 3);
});

test('a page that mounts the changed component by name is offered, not filed as carried', () => {
  // pages/session.html takes sessionBrief from the pre-build and mounts it by
  // name, unframed; the app mounts it framed and hides its branch list. Before
  // 2026-10-12 the app was the only link and the page sat among the carried.
  const d = run('lib/alpineComponents/session-brief.js,dist/web-tools.js');
  const page = d.links.find(l => l.page === 'pages/session.html');
  assert.ok(page, 'the page that mounts sessionBrief is a subject');
  assert.equal(page.via, 'mounts');
  assert.ok(!(d.carried || []).includes('pages/session.html'));
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
  assert.equal(pageQuery(app.url).has('view'), false);
  assert.match(d.warnings.join(' '), /2 routes \(search, sessions\)/);
  for (const view of ['search', 'sessions']) {
    const explicit = run('lib/kits/session-render.js,dist/web-tools.js', ['--query', 'view=' + view]);
    const link = explicit.links.find(l => l.page === 'app/index.html');
    assert.equal(pageQuery(link.url).get('view'), view, 'the requested view reaches the shared reader');
  }
});

test('a page file resolves to the toss at the branch', () => {
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
  // A real page in the nest: a space or an angle bracket in the destination is
  // not markdown, and the pasted line showed as raw text (2026-10-21).
  assert.match(d.links[0].url, /^[^\s<>]+$/);
  assert.match(d.links[0].url, new RegExp(`#gh=mehrlander/web-tools@${Z12}:pages/index\\.html$`));
  assert.ok(!d.warnings.some(w => /route on their own location\.hash/.test(w)), 'the inner #gh= is the address');
  const own = run('pages/toss-render.html,pages/diff-tool.html');
  assert.match(own.links[0].url, new RegExp(`#gh=mehrlander/web-tools@${Z12}:pages/diff-tool\\.html$`),
    'the branch\'s own changed page, when it has one');
});

test('a shell change acting on the tab is tossed with ?top, since a frame never is the tab', () => {
  // The favicon case (PR #315): a framed shell sets it on its own document,
  // correctly and invisibly, because the tab belongs to whatever is on top.
  // Until 2026-10-17 this case printed "no link reaches this", while the
  // toss-gh row of showing-mechanisms.csv said ?top makes the page the tab.
  const d = withDiff('pages/branch.html', '+++ b/pages/branch.html\n+ document.title = subject;\n');
  assert.equal(d.mechanism, 'toss-gh');
  assert.equal(d.top, true);
  assert.match(d.links[0].url, /toss-render\.html\?top#gh=mehrlander\/web-tools@0{12}:pages\/branch\.html$/);
  assert.match(d.why.join(' '), /document\.title/);
  assert.ok(d.warnings.some(w => /iPhone is unmeasured/.test(w)), 'where ?top is unmeasured is said with the link');
  const back = withDiff('pages/branch.html', "+++ b/pages/branch.html\n+ history.pushState(null, '', next);\n");
  assert.equal(back.top, true, 'history is the tab too');
  // The control: the same file, a change that touches nothing top-level.
  const ok = withDiff('pages/branch.html', '+++ b/pages/branch.html\n+ const x = 1;\n');
  assert.equal(ok.mechanism, 'toss-gh');
  assert.equal(ok.top, undefined);
  assert.doesNotMatch(ok.links[0].url, /\?top/);
});

test('--top opens any toss as the tab, and says so where it has nothing to add', () => {
  // Back in a framed preview of the app left the preview (PR #966): the page's
  // pushState throws in the frame and the renderer swallows it. That change
  // touched no history call, so the reader asks for the tab directly.
  const d = run('pages/session.html', ['--top']);
  assert.equal(d.top, true);
  assert.match(d.links[0].url, /toss-render\.html\?top#gh=/);
  const refs = run('pages/session.html', ['--top', '--refs', 'mehrlander/home@claude/x']);
  assert.match(refs.links[0].url, /toss-render\.html\?top&refs=mehrlander\/home@claude\/x#gh=/,
    'a selection rides after the flag');
  const lag = run('pages/diff-tool.html,lib/kits/branch-status.js', ['--overlay', 'yes', '--behind', '2', '--top']);
  assert.equal(lag.mechanism, 'overlay');
  assert.match(lag.links[0].url, new RegExp(`toss-render\\.html\\?top&refs=mehrlander/web-tools@${B12}&`));
  const app = runIn(framedRepo(), 'projects/budget-drs/submittal/submittal.html', ['--top']);
  assert.match(app.links[0].url, /toss-render\.html\?top#gh=mehrlander\/home@/);
  const lib = run('lib/alpineComponents/estate.js,dist/web-tools.js', ['--top']);
  assert.equal(lib.mechanism, 'toss-gh');
  assert.equal(lib.top, true, 'a lib change is a toss too, so --top applies to it');
  const nested = run('pages/toss-render.html', ['--top']);
  assert.ok(nested.warnings.some(w => /nested renderer is never the tab/.test(w)));
  assert.doesNotMatch(nested.links[0].url, /\?top/);
});

// A DOCUMENT IS SHOWN, NOT SKIPPED. The toss renders Markdown as a preview and
// CSV or JSON as a table through its data route, so a doc-only branch has a 🥏
// link. Until 2026-10-16 this fixture asserted an honest no-link for a doc, and
// sessions handed over GitHub blob links for every doc they changed.
test('a doc change is a data-route toss; a tool change alone is still no link', () => {
  const d = run('docs/showing.md,tools/test/x.test.mjs');
  assert.equal(d.mechanism, 'toss-data');
  assert.deepEqual(d.links.map(l => l.page), ['docs/showing.md']);
  assert.match(d.links[0].url,
    new RegExp(`^https://mehrlander\\.github\\.io/web-tools/pages/toss-render\\.html#data=mehrlander/web-tools@${Z12}:docs/showing\\.md$`));
  const none = run('tools/test/x.test.mjs');
  assert.equal(none.mechanism, 'none-needed');
  assert.equal(none.links.length, 0);
});

test('documents ride after the page links, and generated files are not documents', () => {
  const d = run('pages/branch.html,docs/showing.md,docs/README.md,tracker/board.md', ['--at', 'gh=o/r&pr=1']);
  assert.equal(d.mechanism, 'toss-gh');
  assert.deepEqual(d.documents.map(l => l.page), ['docs/showing.md'],
    'docs/README.md is regenerated by the hook and a tracker board by the board generator');
  assert.doesNotMatch(d.documents[0].url, /pr=1/, '--at addresses the page, not the documents');
  assert.equal(run('docs/README.md,tracker/board.md').mechanism, 'none-needed');
});

test('the data route takes a look link like a page does, and spells a space', () => {
  const d = run('docs/a b.md', ['--at', 'show=text:Intro&say=Start here']);
  assert.equal(d.mechanism, 'toss-data');
  assert.match(d.links[0].url, /#data=mehrlander\/web-tools@0{12}:docs\/a%20b\.md%23show=text:Intro%26say=Start here$/);
});

test('a look fragment inside a toss keeps its escapes through the toss', () => {
  // toss-render percent-decodes its whole value once, so a `%23` written for a
  // "#" in an intro would reach the frame as a bare "#" and split the fragment.
  const d = run('docs/a.md', ['--intro', 'PR #1035 & more']);
  assert.match(d.links[0].url, /%23intro=PR%2520%25231035%2520%2526%2520more$/);
  const url = d.links[0].url;
  const once = decodeURIComponent(url.slice(url.indexOf('#') + 1));
  assert.equal(new URLSearchParams(once.slice(once.indexOf('#') + 1)).get('intro'), 'PR #1035 & more');
});

test('a toss link holds one raw "#", so a client that re-encodes an invalid URL leaves it alone', () => {
  // A second raw "#" is not a legal URL character. The Claude app on an iPhone
  // re-encodes a link holding one, "%" included, and the intro's card read
  // "Swipe%20between%20sessions" (2026-10-22). The page's fragment rides
  // behind "%23", and its own "&" as "%26", so the shell's look gate, which
  // reads the shell's whole fragment, finds no page key of its own.
  const d = run('pages/index.html', ['--query', 'view=a&x=1', '--intro', 'Look here', '--at', 'show=row']);
  const url = d.links[0].url;
  assert.equal(url.split('#').length, 2, url);
  const shell = new URLSearchParams(url.slice(url.indexOf('#') + 1));
  for (const k of ['intro', 'show']) assert.equal(shell.has(k), false, 'the shell reads no ' + k + '=');
  const value = decodeURIComponent(url.slice(url.indexOf('#') + 1));
  const page = new URLSearchParams(value.slice(value.indexOf('#') + 1));
  assert.equal(page.get('intro'), 'Look here');
  assert.equal(page.get('show'), 'row');
});

test('any HTML outside archive/ is a page file, a kit demo or a dated prototype alike', () => {
  // showing-whitelists-pages-only: a branch whose only HTML sat in dump/ was
  // handed links to two pages it never touched.
  for (const file of ['lib/kits/demos/md-diff.html', 'dump/2026-08-28-question-lane.html']) {
    const d = run(file);
    assert.equal(d.mechanism, 'toss-gh', file);
    assert.deepEqual(d.links.map(l => l.page), [file]);
  }
  assert.equal(run('archive/alp/repo/index.html').mechanism, 'none-needed');
});

test('a kit change reaches its demo, which gh.loads the kit like any page', () => {
  const d = run('lib/kits/md-diff.js,dist/web-tools.js');
  assert.equal(d.mechanism, 'toss-gh');
  assert.ok(d.links.some(l => l.page === 'lib/kits/demos/md-diff.html'));
});

test('a lib file only a relative script tag loads is tossed on that page', () => {
  // page-skips-the-loader-ignores-use: transform.html loads its workbench with
  // a bare <script src>, so ?use= showed main's code with no error.
  const d = run('lib/alpineComponents/transform-workbench.js,dist/web-tools.js');
  assert.equal(d.mechanism, 'toss-gh');
  assert.deepEqual(d.links.map(l => l.page), ['pages/transform.html']);
});

test('lib without a rebuilt pre-build warns, since the page loads dist at the link\'s commit', () => {
  const d = run('lib/kits/session-render.js');
  assert.match(d.warnings.join(' '), /build:lib/);
  // And says nothing about it once the artifact rides along.
  const built = run('lib/kits/session-render.js,dist/web-tools.js');
  assert.ok(!/build:lib/.test(built.warnings.join(' ')));
});

test('a change to the FAB is tossed with ?top, since a frame shows the renderer\'s FAB', () => {
  const d = run('lib/alpineComponents/fab.js,dist/web-tools.js');
  assert.equal(d.mechanism, 'toss-gh');
  assert.equal(d.top, true);
  assert.ok(d.links.length > 0 && d.links.every(l => /toss-render\.html\?top#gh=/.test(l.url)));
  assert.ok(!d.links.some(l => l.page === 'pages/toss-render.html'), 'the renderer is never its own subject');
  assert.match(d.why.join(' '), /FAB's own code/);
});

// --path is the link a session used to build by hand: a file the branch did
// not change, at the real commit rather than --files' zero one.
test('--path links any named file at the real commit, a page by toss and a document by the data route', () => {
  const d = JSON.parse(execFileSync('python3', [SCRIPT, '--path', 'pages/branch.html', '--path', 'docs/APP.md', '--json'],
    { cwd: repoRoot, encoding: 'utf8' }));
  assert.equal(d.mechanism, 'toss-gh');
  assert.match(d.sha, /^[0-9a-f]{40}$/);
  assert.notEqual(d.sha, ZERO);
  // The branch rides ahead of the commit wherever one is checked out and main's
  // renderer reads that form (a detached CI checkout has neither).
  assert.match(d.links[0].url, new RegExp(`toss-render\\.html#gh=mehrlander/web-tools@(?:[\\w./-]+@)?${d.sha.slice(0, 12)}:pages/branch\\.html$`));
  assert.deepEqual(d.documents.map(l => l.page), ['docs/APP.md']);
  assert.match(d.documents[0].url, /toss-render\.html#data=mehrlander\/web-tools@(?:[\w./-]+@)?[0-9a-f]{12}:docs\/APP\.md$/);
});

test('--width puts ?w= on the renderer, and says so when it cancels ?top', () => {
  const d = run('pages/session.html', ['--width', '390']);
  assert.match(d.links[0].url, /toss-render\.html\?w=390#gh=/);
  const both = run('pages/session.html', ['--width', '390', '--top']);
  assert.match(both.links[0].url, /toss-render\.html\?top&w=390#gh=/);
  assert.ok(both.warnings.some(w => /ignores \?top/.test(w)));
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
  assert.ok(at.links[0].url.endsWith(':pages/branch.html%23gh=owner/repo%26pr=12'),
    'the address rides as a trailing fragment, which the toss hands the page as its own hash');
  assert.ok(decodeURIComponent(at.links[0].url).endsWith(':pages/branch.html#gh=owner/repo&pr=12'),
    'and the toss\'s one decode gives the page exactly that address');
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

test('a framed repo links its documents through the data route, and only those the app does not', () => {
  const d = runIn(framedRepo(), 'chron/2026/09/x.md,tools/x.py');
  assert.equal(d.mechanism, 'toss-data');
  assert.match(d.links[0].url, /toss-render\.html#data=mehrlander\/home@0{12}:chron\/2026\/09\/x\.md$/);
  // A document under a declared view is the view's to show, so it is not
  // listed a second time beside the app.
  const v = runIn(framedRepo(), 'projects/budget-drs/submittal/memo.md');
  assert.equal(v.mechanism, 'toss-app');
  assert.equal(v.documents, undefined);
  assert.equal(runIn(framedRepo(), 'tools/x.py').mechanism, 'none-needed');
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

// A --query naming the view is the reader's choice of view, so it replaces the
// one the script inferred. Appended, the link read ?view=submittal&view=benefits
// and the app routed on the first (home's Benefits view, 2026-10-15).
test('a view named in --query replaces the inferred one rather than doubling it', () => {
  const d = runIn(framedRepo(), 'projects/budget-drs/submittal/submittal.html',
                  ['--query', 'view=benefits&tab=abs']);
  assert.equal(d.mechanism, 'toss-app');
  assert.match(d.links[0].url, /\?view=benefits&tab=abs$/, 'one view, the one asked for');
});

// A cross-repo selection rides on the renderer's own query, before the `#`;
// inside --query it reaches the framed page instead and the renderer reads the
// other repo at main (docs/SNAGS.md refs-in-page-query-ignored-by-toss).
test('--refs puts the selection on the renderer, and refs= in --query is flagged', () => {
  const d = runIn(framedRepo(), 'projects/budget-drs/submittal/submittal.html',
                  ['--refs', 'mehrlander/home@claude/x', '--refs', 'mehrlander/web-tools@y']);
  assert.equal(d.mechanism, 'toss-app');
  assert.match(d.links[0].url,
    /pages\/toss-render\.html\?refs=mehrlander\/home@claude\/x&refs=mehrlander\/web-tools@y#gh=/);
  const q = runIn(framedRepo(), 'projects/budget-drs/submittal/submittal.html',
                  ['--query', 'tab=abs&refs=mehrlander/home@claude/x']);
  assert.ok(q.warnings.some(w => /pass it as --refs/.test(w)), 'refs= in --query is named');
});

test('--at puts a fragment on a framed link', () => {
  const d = runIn(framedRepo(), 'projects/budget-drs/submittal/submittal.html',
                  ['--at', 'note=abc']);
  assert.equal(d.mechanism, 'toss-app');
  assert.match(d.links[0].url, /%23note=abc$/);
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
  assert.equal(d.mechanism, 'toss-gh');
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

test('while main cannot read path entries, a lib change is the toss at the branch', () => {
  const d = run('lib/alpineComponents/estate.js,dist/web-tools.js', ['--overlay', 'no']);
  assert.equal(d.mechanism, 'toss-gh');
});

test('past the cap the overlay steps aside and says so', () => {
  const many = Array.from({ length: 21 }, (_, i) => `lib/kits/k${i}.js`).join(',');
  const d = run(many, ['--overlay', 'yes', '--behind', '2']);
  assert.equal(d.mechanism, 'toss-gh');
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

test('level with main, a rebuilt lib change is the toss at the branch, and the cap does not apply', () => {
  const many = Array.from({ length: 21 }, (_, i) => `lib/kits/k${i}.js`).concat('dist/web-tools.js').join(',');
  const d = run(many, ['--overlay', 'yes']);
  assert.equal(d.mechanism, 'toss-gh');
  assert.ok(!d.warnings.some(w => /past the overlay/.test(w)));
});

test('level with main, a lib change with no rebuilt bundle keeps the overlay, which steps around the stale build', () => {
  const d = run('lib/alpineComponents/estate.js', ['--overlay', 'yes']);
  assert.equal(d.mechanism, 'overlay');
  assert.ok(d.why.some(w => /current with main, so for those files this is the branch itself/.test(w)));
});

test('a kit demo is a page file under lib/, so the link is the demo\'s own toss', () => {
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

test('once main reads it, a link names the branch beside its commit', () => {
  // owner/repo@branch@commit:path (lib/kits/repo-address.js, "A PINNED
  // ADDRESS"). Every 🥏 link is served by main's renderer, so the form waits
  // on main reading it: a renderer that does not would fetch a ref named
  // `branch@commit` and find nothing.
  const pin = ['--pin', 'yes', '--branch', 'claude/x'];
  assert.equal(run('pages/branch.html', pin).links[0].url,
    `https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=mehrlander/web-tools@claude/x@${Z12}:pages/branch.html`);
  assert.equal(run('pages/branch.html', ['--pin', 'no', '--branch', 'claude/x']).links[0].url,
    `https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=mehrlander/web-tools@${Z12}:pages/branch.html`,
    'while main cannot read it, the commit alone');
  const doc = run('docs/locators.md', pin);
  assert.match(doc.links[0].url, new RegExp(`#data=mehrlander/web-tools@claude/x@${Z12}:docs/locators\\.md$`));
  // The subject names the branch; the refs= entries keep a plain commit,
  // since the selection's grammar takes one.
  const o = run('pages/diff-tool.html,lib/kits/branch-status.js', ['--overlay', 'yes', '--behind', '2', ...pin]);
  assert.equal(o.links[0].url, 'https://mehrlander.github.io/web-tools/pages/toss-render.html'
    + `?refs=mehrlander/web-tools@${B12}&refs=mehrlander/web-tools@${Z12}:lib/kits/branch-status.js`
    + `#gh=mehrlander/web-tools@claude/x@${Z12}:pages/diff-tool.html`);
});
