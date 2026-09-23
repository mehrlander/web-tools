// fab-layers.test.mjs — the drawer's layer strip: the frame stack a page
// reaches the screen through, named rather than picked silently.
//
// The two things worth pinning:
//
// DERIVED, NOT REMEMBERED. readLayers walks the live frames every time. That is
// the whole reason no clear is needed when a frame goes away, so the tests walk
// fake roots rather than stubbing a remembered subject.
//
// THE PICK REACHES EVERYTHING. selectLayer re-points repo, path and ref, which
// is what every other pane in the drawer reads. A pick that moved the strip and
// left the ref bar behind would pass a shallower test and be worse than the
// silent choice it replaced.
//
// AND THE ROW HAS TO BE TAPPABLE, which the tests above cannot see. Calling
// selectLayer on the component proves the model and says nothing about the
// button, and for the strip's whole life every button in it carried a disabled
// attribute nobody asked for: Alpine's x-bind turns an undefined result into ''
// whenever the expression contains a dot, and '' is not one of the three values
// bind() treats as absent, so :disabled="L.sealed" on a row with no sealed flag
// SET the attribute. Every model test passed. So the last block here renders
// the real template and asks the DOM, which is the only place that bug lived.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick } from './bootstrap.mjs';

const { window } = makeWindow({ html: '<!doctype html><html><body></body></html>' });
const Alpine = await startAlpine(window, [
  'lib/kits/guide-render.js', 'lib/alpineComponents/path-picker.js', 'lib/alpineComponents/fab.js',
]);
const doc = window.document;

async function mountFab(attrs = 'data-repo="mehrlander/web-tools" data-path="app/index.html"') {
  const host = doc.createElement('div');
  host.innerHTML = `<div x-data="fab()" ${attrs}></div>`;
  doc.body.appendChild(host);
  Alpine.initTree(host);
  await tick(3);
  return Alpine.$data(host.firstElementChild);
}

// A window with an address of its own, the way a framed toss-render has one.
const pagesWin = (path, opts = {}) => ({
  frames: opts.frames || [],
  location: { href: 'https://mehrlander.github.io/web-tools/' + path,
              hostname: 'mehrlander.github.io', pathname: '/web-tools/' + path,
              search: opts.search || '' },
  __tossSubject: opts.subject || null,
});

// A window with no address worth reading, the way toss-render's blob: frame has
// none. Its parent's announcement is the only name it has.
const blobWin = (opts = {}) => ({
  frames: opts.frames || [],
  location: { href: 'blob:https://mehrlander.github.io/abc', hostname: '', pathname: '', search: '' },
  __tossSubject: opts.subject || null,
});

// A cross-origin child: every access throws, which is the answer rather than an
// error.
const sealedWin = () => ({ get location() { throw new Error('cross-origin'); } });

test('a page on its own is one layer, which the strip shows as a label', async () => {
  const d = await mountFab();
  const layers = d.readLayers({ frames: [] });
  assert.equal(layers.length, 1);
  assert.equal(layers[0].repo, 'mehrlander/web-tools');
  assert.equal(layers[0].path, 'app/index.html');
  assert.equal(layers[0].role, 'page', 'nothing nested under it, so it is just the page');
});

test('a toss is two layers: the renderer names itself, the page is named by the announcement', async () => {
  const d = await mountFab('data-repo="mehrlander/web-tools" data-path="pages/toss-render.html"');
  const subject = { repo: 'mehrlander/home', ref: 'main', path: 'projects/budget-drs/app/view/app.html' };
  const root = { frames: [blobWin()], __tossSubject: subject, location: { href: 'x' } };
  const layers = d.readLayers(root);

  assert.equal(layers.length, 2);
  assert.equal(layers[0].path, 'pages/toss-render.html');
  assert.equal(layers[1].repo, 'mehrlander/home');
  assert.equal(layers[1].path, subject.path);
  assert.equal(layers[1].role, 'page');
});

test('the app view is three layers, and the outermost stops calling itself the shell', async () => {
  const d = await mountFab();
  const subject = { repo: 'mehrlander/home', ref: 'main', path: 'projects/budget-drs/app/view/app.html' };
  const renderer = pagesWin('pages/toss-render.html', { subject, frames: [blobWin()] });
  const layers = d.readLayers({ frames: [renderer] });

  // Array.from re-homes the row into this realm: the component builds its
  // arrays inside the jsdom window, and strict deepEqual compares prototypes.
  assert.deepEqual(Array.from(layers.map(L => L.role)), ['app', 'renderer', 'page']);
  assert.equal(layers[0].path, 'app/index.html');
  assert.equal(layers[1].path, 'pages/toss-render.html');
  assert.equal(layers[2].path, subject.path);
});

// ── The typed subject: the second reading of the same walk ─────────────────
//
// The role says where a row sits; the type says what it is, in the terms of
// docs/subjects.csv. A lone unframed layer used to be captioned "page", which
// on the deployed app read as one more file being rendered.
test('the deployed app is the estate, captioned by its view rather than as a page', async () => {
  const d = await mountFab();
  const [L] = d.readLayers({ frames: [], location: { search: '?view=sessions', hash: '' } });
  assert.equal(L.role, 'page', 'the stack reading is unchanged');
  assert.equal(L.type, 'estate');
  assert.equal(L.typeLabel, 'Sessions', 'with no shell on the window the key stands in for the nav label');
  assert.equal(d.layerCaption(L), 'estate');
  assert.equal(d.layerLabel(L), 'Sessions');
  assert.equal(d.layerIcon(L), 'ph-toolbox opacity-50');
});

test('a repo open in the app is a repo, and a project narrows it', async () => {
  const d = await mountFab();
  const [R] = d.readLayers({ frames: [], location: { search: '?repo=mehrlander/home&view=atlas', hash: '' } });
  assert.equal(R.type, 'repo');
  assert.equal(R.typeLabel, 'mehrlander/home › Atlas');
  const [O] = d.readLayers({ frames: [], location: { search: '?repo=mehrlander/home', hash: '' } });
  assert.equal(O.typeLabel, 'mehrlander/home', 'the Overview is the repo itself, not a stop under it');
  const [P] = d.readLayers({ frames: [], location: { search: '?repo=mehrlander/home&view=project&project=projects/budget-drs', hash: '' } });
  assert.equal(P.type, 'project');
  assert.equal(P.typeLabel, 'mehrlander/home / budget-drs › Project');
  // An estate view scoped by a repo keeps the estate as its subject.
  const [B] = d.readLayers({ frames: [], location: { search: '?view=branches&repo=mehrlander/home', hash: '' } });
  assert.equal(B.type, 'estate');
});

test('the shell on the window supplies the nav label', async () => {
  const d = await mountFab();
  const shell = { estateCtx: true,
    estateNav: [{ view: 'sessions', views: ['sessions', 'branches'], label: 'Activity' }] };
  const [L] = d.readLayers({ frames: [], __shell: shell, location: { search: '?view=branches', hash: '' } });
  assert.equal(L.typeLabel, 'Activity › Branches');
});

test('a brief is typed by what it carries: the branch, or the session', async () => {
  const d = await mountFab('data-repo="mehrlander/web-tools" data-path="pages/branch.html"');
  const [B] = d.readLayers({ frames: [], location: { search: '', hash: '#gh=mehrlander/home@claude/serene-einstein-dyr03b' } });
  assert.equal(B.type, 'branch');
  assert.equal(B.typeLabel, 'claude/serene-einstein-dyr03b');
  assert.equal(d.layerLabel(B), 'branch.html · claude/serene-einstein-dyr03b');
  const [P] = d.readLayers({ frames: [], location: { search: '', hash: '#gh=mehrlander/home&pr=364' } });
  assert.equal(P.typeLabel, 'PR #364');
  const s = await mountFab('data-repo="mehrlander/web-tools" data-path="pages/session.html"');
  const [S] = s.readLayers({ frames: [], location: { search: '', hash: '#id=abc12345' } });
  assert.equal(S.type, 'session');
  assert.equal(S.typeLabel, 'abc12345');
});

test('in the app view the app is a carrier and the tossed page is the subject', async () => {
  const d = await mountFab();
  const subject = { repo: 'mehrlander/home', ref: 'main', path: 'projects/budget-drs/app/view/app.html' };
  const renderer = pagesWin('pages/toss-render.html', { subject, frames: [blobWin()] });
  const layers = d.readLayers({ frames: [renderer], location: { search: '?app=budget-drs', hash: '' } });
  assert.deepEqual(Array.from(layers.map(L => L.type)), ['', '', 'page']);
  assert.deepEqual(Array.from(layers.map(L => d.layerCaption(L))), ['app', 'renderer', 'page']);
});

test('tossed content is typed coarsely by extension, and a brief framed inside the app keeps its hash', async () => {
  const d = await mountFab('data-repo="mehrlander/web-tools" data-path="pages/toss-render.html"');
  const md = d.readLayers({ frames: [blobWin()], location: { href: 'x' },
    __tossSubject: { repo: 'mehrlander/home', ref: 'main', path: 'chron/2026/09/x.md' } });
  assert.equal(md[1].type, 'file');
  const json = d.readLayers({ frames: [blobWin()], location: { href: 'x' },
    __tossSubject: { repo: 'mehrlander/home', ref: 'main', path: 'app/data.json' } });
  assert.equal(json[1].type, 'data');
  const app = await mountFab();
  const brief = pagesWin('pages/branch.html');
  brief.location.hash = '#gh=mehrlander/home@claude/x';
  const layers = app.readLayers({ frames: [brief], location: { search: '?view=sessions', hash: '' } });
  assert.equal(layers[1].type, 'branch');
  assert.equal(layers[1].typeLabel, 'claude/x');
  app.layers = layers; app.layerIndex = 1;
  assert.equal(app.subjectHead, 'Branch · claude/x');
  assert.equal(app.subjectIcon, 'ph-git-branch');
});

test('a ?use= pin is the renderer layer own ref, not the page own', async () => {
  const d = await mountFab();
  const subject = { repo: 'mehrlander/home', ref: 'main', path: 'a/b/c.html' };
  const renderer = pagesWin('pages/toss-render.html', { subject, search: '?use=claude/thing', frames: [blobWin()] });
  const layers = d.readLayers({ frames: [renderer] });

  assert.equal(layers[1].ref, 'claude/thing');
  assert.equal(layers[2].ref, 'main', 'the page is at main even while the shell around it is not');
  assert.equal(d.layerOffRef(layers[1]), true);
  assert.equal(d.layerOffRef(layers[2]), false, 'so one row is marked and the other is not');
});

test('a sealed layer is listed as sealed rather than left out', async () => {
  const d = await mountFab();
  const layers = d.readLayers({ frames: [sealedWin()] });
  assert.equal(layers.length, 2);
  assert.equal(layers[1].sealed, true);
  assert.equal(d.layerName(layers[1]), 'sealed');
  assert.match(d.layerTitle(layers[1]), /opaque origin/);
});

test('refreshLayers selects the innermost readable layer', async () => {
  const d = await mountFab();
  d.layers = [{ repo: 'a/b', path: 'x', ref: 'main' }, { sealed: true }];
  d.layerIndex = 1;
  d.readLayers = () => [{ repo: 'a/b', path: 'x', ref: 'main', role: 'app' },
                        { repo: 'c/d', path: 'y', ref: 'main', role: 'page' },
                        { sealed: true, role: 'sealed' }];
  d.refreshLayers();
  assert.equal(d.layerIndex, 1, 'the last row is sealed, so the pick falls back to the one before it');
});

test('picking a layer re-points the whole drawer, not just the strip', async () => {
  const d = await mountFab();
  d.layers = [
    { repo: 'mehrlander/web-tools', path: 'app/index.html', ref: 'main', role: 'app' },
    { repo: 'mehrlander/home', path: 'projects/budget-drs/app/view/app.html', ref: 'claude/x', role: 'page' },
  ];
  d.layerIndex = 0;

  d.selectLayer(1);
  assert.equal(d.layerIndex, 1);
  assert.equal(d.repo, 'mehrlander/home');
  assert.equal(d.path, 'projects/budget-drs/app/view/app.html');
  assert.equal(d.ref, 'claude/x');
  assert.equal(d.viaToss, true, 'the drawer is no longer describing its own document');
  assert.equal(d.frameRef, 'claude/x', 'and the panes that key off the identity followed');

  d.selectLayer(0);
  assert.equal(d.repo, 'mehrlander/web-tools');
  assert.equal(d.viaToss, false, 'back to the document the fab is mounted on');

  d.selectLayer(0);
  assert.equal(d.layerIndex, 0, 'picking the row you are on is inert');
});

test('the default selection re-points the drawer, not just the strip', async () => {
  const d = await mountFab();
  // The app view: nothing announces across the frame boundary, so the drawer
  // starts describing the app. Picking the innermost layer by default is only
  // half the job, and the half that was missing: the strip said PAGE while
  // every pane under it still said app/index.html. Caught in the pixels.
  d.readLayers = () => [
    { repo: 'mehrlander/web-tools', path: 'app/index.html', ref: 'main', role: 'app' },
    { repo: 'mehrlander/web-tools', path: 'pages/toss-render.html', ref: 'main', role: 'renderer' },
    { repo: 'mehrlander/home', path: 'projects/budget-drs/app/view/app.html', ref: 'main', role: 'page' },
  ];
  d.refreshLayers();

  assert.equal(d.layerIndex, 2);
  assert.equal(d.repo, 'mehrlander/home', 'the drawer describes the innermost layer');
  assert.equal(d.path, 'projects/budget-drs/app/view/app.html');
  assert.equal(d.viaToss, true);
});

// ── Which path the drawer is aimed at, and what the row calls it ──────────

// infer() reads the address off `location`, so these drive it through a stub
// rather than through jsdom's URL, which the harness cannot move per test.
const inferWith = async (pagesPath, attrs) => {
  const d = await mountFab(attrs);
  d._fromPagesUrl = () => ({ repo: 'mehrlander/web-tools', path: pagesPath });
  d.infer();
  return d;
};

test('a directory address takes the declared path; a file address does not', async () => {
  // The app: /web-tools/app/ can only infer the FOLDER, so the declaration is
  // the only thing that names the file running there.
  const app = await inferWith('app', 'data-path="app/index.html"');
  assert.equal(app.path, 'app/index.html');

  // A file address is the file being served, so it wins over a declaration
  // that has gone stale. Three pages under pages/scratch/ carried exactly this
  // mismatch, naming the path they had before they moved.
  const moved = await inferWith('pages/scratch/demo.html', 'data-path="pages/demo.html"');
  assert.equal(moved.path, 'pages/scratch/demo.html', 'the address, not the claim');
});

test('an index file is named by its folder, since index.html identifies nothing', async () => {
  const d = await mountFab();
  assert.equal(d.layerName({ path: 'app/index.html' }), 'app');
  assert.equal(d.layerName({ path: 'pages/demos/index.html' }), 'demos');
  assert.equal(d.layerName({ path: 'pages/branch.html' }), 'branch.html',
    'every other file keeps its own name');
  assert.equal(d.layerName({ path: 'index.html' }), 'index.html',
    'with no folder above it there is nothing better to say');
  assert.equal(d.layerName({ path: 'a/b.html', label: 'Spend' }), 'Spend',
    'an announced label still wins');
});

test('the github.io inference is one function, and infer() is one of its callers', async () => {
  const d = await mountFab();
  assert.deepEqual({ ...d._fromPagesUrl({ hostname: 'mehrlander.github.io', pathname: '/web-tools/pages/x.html' }) },
    { repo: 'mehrlander/web-tools', path: 'pages/x.html' });
  assert.deepEqual({ ...d._fromPagesUrl({ hostname: 'mehrlander.github.io', pathname: '/' }) },
    { repo: 'mehrlander/mehrlander.github.io', path: '' });
  assert.equal(d._fromPagesUrl({ hostname: 'example.com', pathname: '/x' }), null);
});

// ── The strip as rendered, not as modelled ─────────────────────────────────

// The rows the drawer actually draws, in order. Read off the DOM rather than
// off `layers`, since the whole point of these three is that the two disagreed.
const stripRows = (d) => [...d.$root.querySelectorAll('button')]
  .filter(b => b.getAttribute('@click') === 'selectLayer(i)');

// Reached the way the real drawer reaches it: refreshLayers derives the stack
// and points the drawer at the innermost readable row, then the panel opens.
// Opening last keeps _afterIdentityChange from firing the loads, which have no
// answer here.
async function mountStrip(layers) {
  const d = await mountFab();
  d.readLayers = () => layers;
  d.refreshLayers();
  d.open = true;
  await tick(4);
  return d;
}

test('a readable row carries no disabled attribute, and a sealed one does', async () => {
  const d = await mountStrip([
    { repo: 'mehrlander/web-tools', path: 'app', ref: 'main', role: 'app' },
    { repo: 'mehrlander/web-tools', path: 'pages/toss-render.html', ref: 'main', role: 'renderer' },
    { sealed: true, role: 'sealed' },
  ]);
  const rows = stripRows(d);
  assert.equal(rows.length, 3, 'one button per layer');

  // The bug was invisible from the component and total from the DOM: it
  // disabled every row, the selected one included.
  assert.equal(rows[0].hasAttribute('disabled'), false, 'the app row is tappable');
  assert.equal(rows[1].hasAttribute('disabled'), false, 'so is the renderer row');
  assert.equal(rows[2].hasAttribute('disabled'), true, 'and the sealed row is not');
});

test('tapping the rendered app row re-points the drawer', async () => {
  const d = await mountStrip([
    { repo: 'mehrlander/web-tools', path: 'app', ref: 'main', role: 'app' },
    { repo: 'mehrlander/home', path: 'projects/budget-drs/app/view/app.html', ref: 'main', role: 'page' },
  ]);
  assert.equal(d.repo, 'mehrlander/home', 'the drawer starts on the innermost layer');

  stripRows(d)[0].click();
  await tick(3);

  assert.equal(d.layerIndex, 0);
  assert.equal(d.repo, 'mehrlander/web-tools', 'a tap, not a method call, moved it');
  assert.equal(d.path, 'app');
  assert.equal(d.viaToss, false);
});

test('the glyph slot names the layer, and the off-ref mark still takes it', async () => {
  const d = await mountFab();
  // A placeholder circle in this slot is what left two rows reading app and
  // app.html with nothing to tell them apart.
  // The app row wears web-tools' own declared mark (.web-tools.json), which is
  // the glyph on its card in the app's sidebar, so the two rows named for an
  // app are told apart by a mark the reader already reads as Web Tools.
  assert.match(d.layerIcon({ role: 'app', ref: 'main' }), /ph-toolbox/);
  assert.match(d.layerIcon({ role: 'renderer', ref: 'main' }), /ph-frame-corners/);
  assert.match(d.layerIcon({ role: 'page', ref: 'main' }), /ph-file-html/);

  assert.match(d.layerIcon({ sealed: true, role: 'sealed' }), /ph-lock-simple/);
  assert.match(d.layerIcon({ role: 'app', ref: 'claude/x' }), /ph-disc text-warning/,
    'branch code cannot hide behind an identity glyph');
});
