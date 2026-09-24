// alpineComponents/installation-view.js — the Installation pill under real
// Alpine in jsdom, against a stub repository. The derivation is held by
// installation.test.mjs; what this holds is the surface's one rule and its
// wiring: the corpus renders grouped with the local areas beside it, a
// selected file becomes the shell's correspondence target, a comparison goes
// through the shell's flow and comes back as a browser check, and NOTHING
// writes to the ledger until the confirm is tapped with the row on screen.
// A reload then reads the row back from the repository, not from memory.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash, webcrypto } from 'node:crypto';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const P = 'projects/wps';
const { window, problems } = makeWindow({
  html: `<!doctype html><html><body><div id="v" x-data="installationView({ path: '${P}', installation: '${P}/data/installation.json' })"></div></body></html>`,
});
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });

const REV = 'a'.repeat(40);
const sha = c => c.repeat(40);
const gitBlob = text => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const files = {
  [`${P}/data/installation.json`]: JSON.stringify({
    root: 'Documents\\WindowsPowerShell', observations: `${P}/data/observations.csv`,
    correspondence: [
      { repo: 'app/Profile.ps1', area: 'Profile', installs: '' },
      { repo: 'app/Modules/', area: 'Modules', installs: 'Modules/' },
      { repo: 'app/Forms/', area: 'Forms', installs: 'Forms/' },
      { repo: 'app/Scripts/', area: 'Scripts', installs: null },
    ],
    doc: `${P}/docs/INSTALLATION.md`,
    local_areas: [{ name: 'Leg', status: 'unresolved', shape: 'reportedly bill collections' },
                  { name: 'ISELog', status: 'local-only', shape: 'ZIP snapshots of editor text' }],
    pending_adoption: [
      { path: 'app/Modules/Forms/Forms.psm1', transfer: 'changed', since: '2026-09-14', limit: 'Module import has not run on the work computer' },
      { path: 'app/Forms/Bookmarks/Bookmarks.ps1', transfer: 'new', since: '2026-09-15', limit: 'Live form has not been exercised' },
    ],
  }),
  [`${P}/data/observations.csv`]: 'date,path,kind,revision,blob_sha,local_sha256,match,method,note\n',
  [`${P}/app/Profile.ps1`]: 'profile\n',
  [`${P}/app/Modules/Forms/Forms.psm1`]: 'function Import-Form {}\n',
  [`${P}/app/Forms/Bookmarks/Bookmarks.ps1`]: 'controller\n',
  [`${P}/app/Forms/Bookmarks/Bookmarks.xaml`]: '<Window/>\n',
  [`${P}/app/Scripts/Demo.ps1`]: 'demo\n',
  [`${P}/docs/INSTALLATION.md`]: '# map\n',
};
const tree = snapshot => Object.entries(snapshot).map(([p, t]) => ({ type: 'blob', path: p, sha: gitBlob(t), size: t.length }));
const publications = [], reads = [], requests = [];
const snapshots = new Map([[REV, { ...files }]]), blobs = new Map(), trees = new Map(), commits = new Map(), changedTrees = new Map();
let currentRevision = REV, readGate = null, commitGate = null, history = null;
const snapshotAt = ref => snapshots.get(ref) || files;
const advanceHead = () => {
  currentRevision = gitBlob(JSON.stringify(files));
  snapshots.set(currentRevision, { ...files });
};
let treeReads = 0;
window.TOKEN = 't';
window.GH = class {
  constructor({ repo, ref } = {}) { this.repo = repo; this.ref = ref || ''; }
  async get(p, opts = {}) {
    const t = snapshotAt(this.ref)[p];
    reads.push({ path: p, ref: this.ref, cache: opts.cache });
    await readGate?.(p, this.ref);
    if (t === undefined) { const e = new Error('Not Found'); e.status = 404; throw e; }
    return { text: t, sha: gitBlob(t) };
  }
  async req(p, opts = {}) {
    const method = opts.method || 'GET', body = opts.body ? JSON.parse(opts.body) : null;
    requests.push({ path: p, method, body, cache: opts.cache });
    if (method === 'GET' && p === 'git/ref/heads/main') return { object: { sha: currentRevision } };
    if (method === 'GET' && p.startsWith('git/commits/')) {
      const revision = p.slice('git/commits/'.length);
      const treeSha = gitBlob('tree at ' + revision);
      trees.set(treeSha, { ...snapshotAt(revision) });
      return { tree: { sha: treeSha } };
    }
    if (method === 'POST' && p === 'git/blobs') {
      const text = Buffer.from(body.content, 'base64').toString('utf8'), sha = gitBlob(text);
      assert.equal(body.encoding, 'base64');
      blobs.set(sha, text);
      return { sha };
    }
    if (method === 'POST' && p === 'git/trees') {
      const snapshot = { ...trees.get(body.base_tree) };
      for (const file of body.tree) snapshot[file.path] = blobs.get(file.sha);
      const sha = gitBlob(JSON.stringify(snapshot));
      trees.set(sha, snapshot); changedTrees.set(sha, body.tree.map(f => f.path));
      return { sha };
    }
    if (method === 'POST' && p === 'git/commits') {
      const sha = gitBlob(JSON.stringify(body));
      commits.set(sha, body); snapshots.set(sha, { ...trees.get(body.tree) });
      return { sha };
    }
    if (method === 'PATCH' && p === 'git/refs/heads/main') {
      assert.equal(body.force, false);
      const commit = commits.get(body.sha);
      if (commit.parents[0] !== currentRevision) throw Object.assign(new Error('branch moved'), { status: 422 });
      currentRevision = body.sha;
      Object.assign(files, snapshotAt(currentRevision));
      publications.push({ body, paths: changedTrees.get(commit.tree), snapshot: { ...files } });
      return { object: { sha: currentRevision } };
    }
    if (method === 'GET' && p.startsWith('git/blobs/')) {
      const sha = p.slice('git/blobs/'.length);
      const hit = [...snapshots.values(), files].flatMap(s => Object.entries(s)).find(([, t]) => gitBlob(t) === sha);
      if (!hit) throw Object.assign(new Error('Not Found'), { status: 404 });
      await readGate?.(hit[0], this.ref);
      return { sha, encoding: 'base64', content: Buffer.from(hit[1], 'utf8').toString('base64') };
    }
    if (method === 'GET' && p.startsWith('git/trees/')) {
      treeReads++;
      const revision = p.slice('git/trees/'.length).split('?')[0];
      return { tree: tree(snapshotAt(revision)) };
    }
    // A file's history before a date: answered only for the one file a test
    // declares in `history`, so every other file reads as having none.
    if (method === 'GET' && p.startsWith('commits?') && p.includes('&path=')) {
      const q = new URLSearchParams(p.slice('commits?'.length));
      return history && q.get('path') === history.path && q.get('until') === history.until ? [{ sha: history.revision }] : [];
    }
    if (method === 'GET' && p.startsWith('commits?')) {
      const revision = currentRevision;
      await commitGate?.();
      return [{ sha: revision }];
    }
    throw new Error('unexpected ' + p);
  }
};
window.GH.FRESH = { cache: 'no-store' };
window.GH.toBase64 = s => Buffer.from(s, 'utf8').toString('base64');
const checks = [];
const shellCalls = [];
window.FileCorrespondence = {
  applies: t => /\.(ps1|psm1|xaml)$/i.test(t?.path || ''),
  decodeBytes: (bytes, encoding = 'auto') => new TextDecoder(encoding === 'auto' ? 'utf-8' : encoding, { fatal: true }).decode(bytes),
  checksUnder: async (repo, prefix) => checks.filter(c => c.repo === repo && c.path.startsWith(prefix)),
  reopen: async c => { shellCalls.push(['reopen', c.id]); },
};
window.__shell = {
  installationItem: '',
  syncUrl() { shellCalls.push(['syncUrl']); },
  goStage() { shellCalls.push(['goStage']); },
  pasteAnywhere() { shellCalls.push(['pasteAnywhere', this.installationItem]); },
  goProject(...args) { shellCalls.push(['goProject', ...args]); },
  openFile(p) { shellCalls.push(['openFile', p]); },
  // As the app does on the Overview (app/index.html openCorrespondence): the
  // copy goes to the view, which compares it in memory and stores nothing.
  async openCorrespondence(target, text, name, source) {
    shellCalls.push(['compare', target.path, source]);
    await window.Alpine.$data(window.document.getElementById('v')).takeCopy(target, text, name, source);
  },
};
// The pane links the explanation document and the ledger through the shared
// link builder, so the harness carries the real one rather than a guess at
// the URL shape it produces.
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/github-links.js'), 'utf8'))();
const saves = [], clip = [];
window.io = { save: (data, name) => saves.push({ data, name }) };
Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async t => { clip.push(t); } } });

for (const rel of ['lib/kits/csv.js', 'lib/kits/installation.js', 'lib/kits/text-diff.js', 'lib/kits/powershell-workspace.js', 'lib/kits/powershell-language.js', 'lib/alpineComponents/installation-view.js'])
  new window.Function(readFileSync(path.join(repoRoot, rel), 'utf8'))();
const toasts = [];
Alpine.store('browser', { repo: 'mehrlander/home', ref: 'main', defaultRef: 'main', gh: new window.GH({ repo: 'mehrlander/home', ref: 'main' }) });
Alpine.store('toast', (...a) => toasts.push(a));
Alpine.start();
await tick(3);
const el = window.document.getElementById('v');
const data = Alpine.$data(el);
for (let i = 0; i < 20 && data.loading; i++) await tick(2);
const q = sel => [...el.querySelectorAll(sel)];
// x-show hides on the next animation frame (Alpine's hide cascade), which
// jsdom's pretendToBeVisual clock ticks at 60 Hz, so a visibility assertion
// waits a frame rather than a microtask.
const settle = async () => { await tick(2); await new Promise(r => setTimeout(r, 40)); await tick(2); };
const FORMS = `${P}/app/Modules/Forms/Forms.psm1`;

test('mounts with the corpus grouped by area and the local areas beside it', () => {
  assert.deepEqual(problems, []);
  assert.equal(data.err, '');
  assert.equal(data.items.length, 5, 'docs/ is not installation material');
  assert.deepEqual([...data.groups.map(g => g.area)], ['Profile', 'Modules', 'Forms', 'Scripts']);
  assert.equal(q('[data-installation] section button.text-left').length, 5, 'one row per file');
  const text = el.textContent;
  assert.match(text, /Local areas/); assert.match(text, /Leg/); assert.match(text, /local only/); assert.match(text, /unresolved/);
  assert.match(text, /reportedly bill collections/, 'the shape reads on the row');
  // The explanation is linked, not copied onto the pane, and nothing on it
  // parks a fact in a title where a phone and a screenshot cannot reach it.
  const titled = [...el.querySelectorAll('[title]')].map(e => e.getAttribute('title'));
  assert.deepEqual(titled.filter(t => t.split(/\s+/).length > 2), [],
    'a title is the label of an icon-only control, never a sentence of explanation');
  assert.doesNotMatch(el.textContent, /the installation map|5 files/, 'no map link and no counts line in the header');
  assert.equal(publications.length, 0);
  assert.ok(reads.every(r => r.ref === REV), 'manifest and ledger are read at the captured revision');
});

test('selecting a file shows its destination and makes it the shell\'s correspondence target', async () => {
  data.select(FORMS);
  await settle();
  assert.equal(window.__shell.installationItem, FORMS);
  assert.ok(shellCalls.some(c => c[0] === 'syncUrl'));
  assert.match(el.textContent, /Documents\\WindowsPowerShell\\Modules\\Forms\\Forms\.psm1/);
  assert.equal(data.statusOf(FORMS).label, 'Update pending');
  assert.doesNotMatch(el.textContent, /Nothing recorded for this file|local state unknown/, 'no "we do not know" notes on the pane');
  assert.equal(el.querySelector('[data-observations]').style.display, 'none', 'an empty ledger history is not shown');
  const line = () => el.querySelector('[data-status-line]').textContent;
  assert.equal(line(), 'Update pending · since 2026-09-14', 'one status line carries the state and its date');
  assert.doesNotMatch(el.querySelector('[data-adoption]').textContent, /awaiting adoption|Pending since/, 'the pending note is only the entry\'s own words');
  assert.equal(el.querySelector('[data-installation] dl'), null, 'no installs-to / GitHub-now field list');
  assert.match(el.querySelector('[data-adoption]').textContent, /Module import has not run on the work computer/);
  await data.runAction(FORMS, 'code');
  assert.deepEqual(shellCalls.find(c => c[0] === 'goProject'), ['goProject', P, 'code', FORMS]);
  data.select(`${P}/app/Forms/Bookmarks/Bookmarks.xaml`);
  await settle();
  assert.match(el.textContent, /with\s+Bookmarks\.ps1/, 'the companion reads as "with <file>"');
  data.select(`${P}/app/Scripts/Demo.ps1`);
  await settle();
  assert.equal(el.querySelector('[data-destination]').textContent, `${P}/app/Scripts/Demo.ps1`, 'repository-only material shows its repository path');
  assert.deepEqual([...data.actionsFor(`${P}/app/Scripts/Demo.ps1`).map(a => a.key)], ['code'], 'repository-only material offers no placement to confirm');
  data.select(FORMS);
  await settle();
});

const dropped = text => ({ dataTransfer: { files: [], getData: () => text } });

test('a comparison goes through the shell and comes back as a browser check, with no ledger write', async () => {
  await data.compareDrop(dropped('function Import-Form {}\r\n'));
  await settle();
  assert.deepEqual([...data.checks.map(c => c.path + ' ' + c.source)], [FORMS + ' drop'], 'the copy is held by the view');
  assert.equal(checks.length, 0, 'nothing is written to the browser-local check store');
  assert.equal(data.checks.length, 1);
  assert.equal(data.checks[0].lineEndingsOnly, true);
  assert.equal(data.stateOf(FORMS).state, 'pending-changed', 'a check is browser-local; adoption stays pending');
  assert.equal(el.querySelector('[data-checks]'), null, 'no checks section; the menu carries what it offered');
  assert.ok(data.actionsFor(FORMS).some(a => a.key === 'record-check' && a.label === 'Record the match…'));
  assert.equal(publications.length, 0, 'comparing writes nothing');
});

test('copy and download fetch the GitHub text and write nothing', async () => {
  await data.copyText();
  assert.equal(clip[0], files[FORMS]);
  await data.downloadText();
  assert.deepEqual(saves[0], { data: files[FORMS], name: 'Forms.psm1' });
  assert.equal(data.lastTransfer[FORMS], 'download');
  assert.equal(publications.length, 0, 'a transfer is not an installation');
});

test('recording shows the exact row and adoption closure before publishing both files together', async () => {
  await data.askInstalled();
  await settle();
  assert.ok(data.pending, 'the confirm is open');
  assert.equal(data.pending.row.kind, 'installed');
  assert.equal(data.pending.row.method, 'download', 'the method names the transfer that preceded it');
  assert.equal(data.pending.row.blob_sha, gitBlob(files[FORMS]));
  assert.equal(data.pending.row.local_sha256, createHash('sha256').update(files[FORMS], 'utf8').digest('hex'));
  assert.match(el.textContent, /I placed this on the work computer/);
  assert.ok(el.querySelector('pre').textContent.includes(',installed,' + REV + ','), 'the exact line is on screen');
  assert.match(el.textContent, /also removes this file from the pending adoption list/);
  assert.equal(publications.length, 0, 'asking is not writing');
  data.recordNote = 'copied over at lunch'; data.renderPending();
  await data.confirmRecord();
  await settle();
  assert.equal(publications.length, 1);
  assert.deepEqual(publications[0].paths, [`${P}/data/observations.csv`, `${P}/data/installation.json`]);
  const written = publications[0].snapshot[`${P}/data/observations.csv`];
  assert.match(written, /,installed,a{40},[0-9a-f]{40},[0-9a-f]{64},,download,copied over at lunch\n$/);
  assert.equal(data.pending, null);
  assert.equal(data.stateOf(FORMS).state, 'reported');
  assert.equal(data.item.pendingAdoption, null, 'the view reloads the manifest as well as its ledger');
  assert.equal(JSON.parse(files[`${P}/data/installation.json`]).pending_adoption.length, 1);
  assert.equal(data.revision, publications[0].body.sha);
  assert.match(el.textContent, /reported installed/);
  assert.match(el.querySelector('[data-status-line]').textContent, /^Confirmed installed · \d{4}-\d{2}-\d{2}$/);
});

test('a browser check can be promoted to a verified row, and then reads as recorded', async () => {
  const check = data.checks[0];
  assert.equal(data.isRecorded(check), false);
  data.askCheck(check);
  await settle();
  assert.equal(data.pending.row.kind, 'verified');
  assert.equal(data.pending.row.match, 'line-endings');
  assert.equal(data.pending.row.method, 'drop');
  await data.confirmRecord();
  await settle();
  assert.equal(publications.length, 2);
  assert.equal(data.isRecorded(check), true);
  assert.equal(data.stateOf(FORMS).state, 'verified');
  assert.equal(data.stateOf(FORMS).history.length, 2, 'the installed row is kept beneath the verification');
  assert.ok(!data.actionsFor(FORMS).some(a => a.key === 'record-check'), 'a recorded check is no longer offered');
});

test('the record survives a reload, and GitHub moving turns it into "changed since"', async () => {
  await data.reload();
  await settle();
  assert.equal(data.stateOf(FORMS).state, 'verified', 'read back from the repository, not remembered');
  files[FORMS] = 'function Import-Form { param($Name) }\n';
  advanceHead();
  await data.reload();
  await settle();
  assert.equal(data.stateOf(FORMS).state, 'changed');
  assert.equal(data.lastTransfer[FORMS], undefined, 'a download of older bytes is not evidence of transferring the new file');
  assert.equal(data.stateOf(FORMS).label, 'GitHub changed since verification');
  data.select(FORMS); await settle();
  assert.match(el.querySelector('[data-status-line]').textContent, /^Update pending · installed \d{4}-\d{2}-\d{2}$/);
  // A later copy that differs from the new revision contradicts the record.
  await window.__shell.openCorrespondence({ repo: 'mehrlander/home', ref: 'main', path: FORMS }, 'something else\n', 'Forms.psm1', 'drop');
  await settle();
  data.askCheck(data.checks.find(c => !c.exact && !c.lineEndingsOnly));
  await data.confirmRecord();
  await settle();
  assert.equal(data.stateOf(FORMS).state, 'differs');
  // The filter narrows the corpus to that state.
  data.filter = 'differs';
  await settle();
  assert.equal(q('[data-installation] section button.text-left').length, 1);
  data.filter = '';
});

test('a form\'s controller and XAML are recorded apart', async () => {
  const xaml = `${P}/app/Forms/Bookmarks/Bookmarks.xaml`, ctl = `${P}/app/Forms/Bookmarks/Bookmarks.ps1`;
  data.select(xaml); await settle();
  await data.askInstalled(); await settle();
  assert.equal(data.pending.row.method, 'reported', 'no transfer preceded it, so the row says so');
  await data.confirmRecord(); await settle();
  assert.equal(data.stateOf(xaml).state, 'reported');
  assert.equal(data.stateOf(ctl).state, 'pending-new');
});

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

test('an older file fetch cannot replace the new selection\'s text or busy state', async () => {
  const profile = `${P}/app/Profile.ps1`, gate = deferred();
  data.select(FORMS);
  readGate = p => p === FORMS ? gate.promise : undefined;
  const old = data.fetchText();
  await tick(1);
  data.select(profile);
  assert.equal(data.textBusy, false);
  await data.fetchText();
  assert.equal(data.text, files[profile]);
  gate.resolve();
  await old;
  readGate = null;
  assert.equal(data.selected, profile);
  assert.equal(data.text, files[profile]);
  assert.equal(data.textBusy, false);
  data.select(FORMS);
  assert.equal(await data.fetchText(), files[FORMS]);
});

test('the transfer script carries the exact GitHub bytes to the manifest destination and records nothing', async () => {
  const written = publications.length;
  data.select(FORMS); await settle();
  await data.copyTransferScript();
  const script = clip[clip.length - 1];
  assert.match(script, /^\$dest = Join-Path \$HOME 'Documents\\WindowsPowerShell\\Modules\\Forms\\Forms\.psm1'\r$/m);
  const encoded = /FromBase64String\('([^']+)'\)/.exec(script)[1];
  assert.equal(Buffer.from(encoded, 'base64').toString('utf8'), files[FORMS]);
  assert.match(script, /WriteAllBytes\(\$dest, \$bytes\)/);
  assert.ok(script.includes(gitBlob(files[FORMS])), 'the script names the Git blob the placed file should hash to');
  assert.equal(data.lastTransfer[FORMS], 'script');
  assert.equal(publications.length, written, 'a transfer script is not an installation');
  assert.equal(window.PowerShellLanguage.inspect(script).diagnostics.length, 0, 'the script itself uses no PowerShell 7 syntax');
  const demo = `${P}/app/Scripts/Demo.ps1`, copies = clip.length;
  data.select(demo); await settle();
  assert.equal(el.querySelector('[aria-label="Copy transfer script"]').style.display, 'none', 'repository-only material offers no script');
  await data.copyTransferScript();
  assert.equal(clip.length, copies, 'repository-only material has no destination to script');
  assert.match(data.err, /no installation destination/);
  data.err = ''; data.select(FORMS); await settle();
});

test('selection changes cancel pending copy, download, and installed-row preparation', async () => {
  const profile = `${P}/app/Profile.ps1`;
  for (const method of ['copyText', 'downloadText', 'copyTransferScript', 'askInstalled']) {
    data.select(FORMS);
    const gate = deferred(), copies = clip.length, downloads = saves.length;
    readGate = p => p === FORMS ? gate.promise : undefined;
    const pending = data[method]();
    await tick(1);
    data.select(profile);
    gate.resolve();
    await pending;
    readGate = null;
    assert.equal(clip.length, copies, method + ' does not copy stale text');
    assert.equal(saves.length, downloads, method + ' does not download under the new filename');
    assert.equal(data.pending, null, method + ' does not associate old text hashes with the new file');
    assert.equal(data.lastTransfer[profile], undefined);
  }
});

test('a selected file cannot change while a supplied copy is being read', async () => {
  data.select(FORMS);
  const gate = deferred(), comparisons = data.checks.length;
  const pending = data.compareFile({ name: 'Forms.psm1', arrayBuffer: () => gate.promise }, 'file picker');
  data.select(`${P}/app/Profile.ps1`);
  gate.resolve(new TextEncoder().encode(files[FORMS]).buffer);
  await pending;
  assert.equal(data.checks.filter(c => c.path === FORMS).length <= 1, true);
  assert.equal(data.checks.length, comparisons);
});

test('a reload reads manifest, inventory, and ledger from the same revision even when the branch moves', async () => {
  const beforeRevision = currentRevision, before = { ...files }, beforeCount = data.rows.length;
  const gate = deferred(), startRead = reads.length;
  readGate = p => p === `${P}/data/installation.json` ? gate.promise : undefined;
  const pending = data.reload();
  await tick(2);
  const changedManifest = JSON.parse(files[`${P}/data/installation.json`]);
  changedManifest.root = 'Changed installation root';
  files[`${P}/data/installation.json`] = JSON.stringify(changedManifest);
  files[FORMS] = 'function Import-Form { param($DifferentRevision) }\n';
  const row = window.Installation.row({ kind: 'verified', path: FORMS, revision: beforeRevision,
    blobSha: gitBlob(files[FORMS]), sha256: createHash('sha256').update(files[FORMS]).digest('hex'),
    match: 'exact', method: 'paste', date: '2030-01-01T00:00:00Z' });
  files[`${P}/data/observations.csv`] += window.Installation.line(row) + '\n';
  advanceHead();
  readGate = null; gate.resolve();
  await pending;
  assert.equal(data.revision, beforeRevision);
  assert.equal(data.root, JSON.parse(before[`${P}/data/installation.json`]).root);
  assert.equal(data.items.find(it => it.path === FORMS).blobSha, gitBlob(before[FORMS]));
  assert.equal(data.rows.length, beforeCount);
  assert.ok(reads.slice(startRead).every(r => r.ref === beforeRevision));
  data.select(FORMS);
  assert.equal(data.target().ref, beforeRevision, 'comparison starts from the revision the view shows');
  assert.equal(await data.fetchText(), before[FORMS]);
  await data.reload();
  assert.equal(data.revision, currentRevision);
  assert.equal(data.root, 'Changed installation root');
  assert.equal(data.rows.length, beforeCount + 1);
  Object.assign(files, before); advanceHead();
  await data.reload();
});

test('a slow older reload cannot replace a newer snapshot or report an obsolete error', async () => {
  for (const fail of [false, true]) {
    const manifestPath = `${P}/data/installation.json`, before = files[manifestPath];
    const gate = deferred();
    commitGate = () => gate.promise;
    const old = data.reload();
    await tick(1);
    commitGate = null;
    files[manifestPath] = JSON.stringify({ ...JSON.parse(before), root: 'Newest snapshot root' });
    advanceHead();
    await data.reload();
    const revision = data.revision, itemHash = data.items.find(it => it.path === FORMS).blobSha;
    if (fail) gate.reject(new Error('Obsolete request failed')); else gate.resolve();
    await old;
    assert.equal(data.revision, revision);
    assert.equal(data.items.find(it => it.path === FORMS).blobSha, itemHash);
    assert.equal(data.root, 'Newest snapshot root');
    assert.equal(data.err, '');
    assert.equal(data.loading, false);
    files[manifestPath] = before; advanceHead();
    await data.reload();
  }
});

test('empty repository files are cached and can be transferred without inventing content', async () => {
  const profile = `${P}/app/Profile.ps1`, original = files[profile];
  files[profile] = ''; advanceHead();
  await data.reload(); data.select(profile);
  const start = reads.length;
  assert.equal(await data.fetchText(), '');
  assert.equal(await data.fetchText(), '');
  assert.equal(reads.length - start, 1);
  await data.downloadText();
  assert.deepEqual(saves.at(-1), { data: '', name: 'Profile.ps1' });
  files[profile] = original; advanceHead();
  await data.reload();
});

// jsdom has no CodeMirror, so the pane takes the <pre> fallback; the editor
// path is held by installation-source-browser.mjs.
test('the source pane shows the selected file read-only, swaps on reselect, and collapses on a phone', async () => {
  assert.equal(window.PowerShellEditor, undefined, 'this harness carries no editor kit');
  const profile = `${P}/app/Profile.ps1`, writes = requests.filter(r => r.method !== 'GET').length;
  data.select(FORMS);
  await settle();
  const pane = () => el.querySelector('[data-source]');
  const plain = () => el.querySelector('[data-source-plain]');
  assert.equal(data.sourceState, 'plain');
  assert.equal(plain().textContent, files[FORMS]);
  assert.doesNotMatch(plain().className, /(^|\s)hidden(\s|$)/);
  assert.match(el.querySelector('[data-source-editor]').className, /(^|\s)hidden(\s|$)/);
  // Collapsed below @3xl until the toggle; the container variant shows it on desktop.
  const body = el.querySelector('[data-source-body]'), toggle = el.querySelector('[data-source-toggle]');
  assert.match(body.className, /(^|\s)hidden(\s|$)/); assert.match(body.className, /@3xl:block/);
  assert.match(toggle.textContent, /Show code/); assert.match(toggle.className, /@3xl:hidden/);
  toggle.click(); await settle();
  assert.equal(data.sourceOpen, true);
  assert.doesNotMatch(body.className, /(^|\s)hidden(\s|$)/);
  assert.match(toggle.textContent, /Hide code/);
  // The pane follows the state and the actions in the detail column.
  const status = [...el.querySelectorAll('[data-status]')].find(b => !b.closest('[data-row]'));
  assert.ok(status.compareDocumentPosition(pane()) & window.Node.DOCUMENT_POSITION_FOLLOWING, 'the header\'s status menu precedes the pane');
  data.select(profile);
  await settle();
  assert.equal(data.sourceOpen, false, 'a new selection starts collapsed');
  assert.equal(plain().textContent, files[profile]);
  data.select('');
  await settle();
  assert.equal(data.sourceState, '');
  assert.equal(pane(), null, 'deselecting removes the pane');
  assert.equal(requests.filter(r => r.method !== 'GET').length, writes, 'the pane writes nothing');
  data.select(FORMS); await settle();
});

test('the Source header carries copy, download and compare; the action row keeps placement and navigation', async () => {
  data.select(FORMS); await settle();
  const tools = el.querySelector('[data-source-tools]');
  const labels = [...tools.querySelectorAll('[aria-label]')].map(b => b.getAttribute('aria-label'));
  assert.deepEqual(labels, ['Copy GitHub text', 'Download GitHub text', 'Copy transfer script', 'Compare the clipboard with this file', 'Compare a file with this file']);
  assert.ok(tools.querySelector('input[type=file]'), 'the file picker rides the compare icon');
  const rowLabels = q('button.btn-sm').filter(b => !b.closest('[data-source]')).map(b => b.textContent.trim()).filter(Boolean);
  for (const gone of ['Compare copy', 'Copy GitHub text', 'Download']) assert.ok(!rowLabels.includes(gone), gone + ' left the action row');
  assert.equal(el.querySelector('textarea'), null, 'no paste field: the page-wide paste and the clipboard icon take a copy');
  assert.equal(q('select').length, 1, 'only the state filter; encoding is asked for when decoding fails');
  tools.querySelector('[aria-label="Compare the clipboard with this file"]').click();
  assert.deepEqual(shellCalls.at(-1), ['pasteAnywhere', FORMS], 'the clipboard goes through the app\'s Paste, aimed at this file');
});

test('a file that fails to decode is offered its encoding, and the retry compares it', async () => {
  data.select(FORMS); await settle();
  const before = data.checks.find(c => c.path === FORMS)?.id;
  // “Import” in Windows-1252 quotes: 0x93 and 0x94 are not UTF-8.
  const bytes = Uint8Array.from([0x93, ...Buffer.from('Import'), 0x94, 0x0a]);
  const file = { name: 'Forms.psm1', arrayBuffer: async () => bytes.buffer };
  await data.compareDrop({ dataTransfer: { files: [file], getData: () => '' } });
  await settle();
  assert.equal(data.checks.find(c => c.path === FORMS)?.id, before, 'nothing compared on a failed decode');
  assert.ok(data.compareRetry);
  const box = el.querySelector('[data-compare-error]');
  assert.notEqual(box.style.display, 'none');
  const choices = [...box.querySelectorAll('button')].map(b => b.textContent);
  assert.deepEqual(choices, ['UTF-16 LE', 'UTF-16 BE', 'Windows-1252']);
  [...box.querySelectorAll('button')].find(b => b.textContent === 'Windows-1252').click();
  for (let i = 0; i < 10 && data.checks.find(c => c.path === FORMS)?.id === before; i++) await tick(2);
  assert.equal(data.checks[0].path, FORMS); assert.equal(data.checks[0].source, 'drop');
  assert.equal(data.checks[0].content, '\u201cImport\u201d\n');
  assert.equal(data.compareRetry, null); assert.equal(data.compareError, '');
  // A retry never lands on a different selection.
  await data.compareDrop({ dataTransfer: { files: [file], getData: () => '' } });
  data.select(`${P}/app/Profile.ps1`); await settle();
  assert.equal(data.compareRetry, null, 'reselecting clears the offer');
  data.select(FORMS); await settle();
});

test('Changes shows what the work computer is known to hold against GitHub now, and opens by default when they differ', async () => {
  const xaml = `${P}/app/Forms/Bookmarks/Bookmarks.xaml`, ctl = `${P}/app/Forms/Bookmarks/Bookmarks.ps1`, original = files[xaml];
  const writes = requests.filter(r => r.method !== 'GET').length;
  const views = () => el.querySelector('[data-source-views]');
  const diff = () => el.querySelector('[data-source-diff]');
  const shown = node => !/(^|\s)hidden(\s|$)/.test(node.className);
  // No action row: no Files, no Stage, no Open code workspace, no Mark as installed.
  data.select(xaml); await settle();
  const labels = q('button').map(b => b.textContent.trim());
  for (const gone of ['Files', 'Stage', 'Open code workspace', 'Mark as installed']) assert.ok(!labels.includes(gone), gone + ' is gone');
  // Recorded and unchanged since: nothing to compare, so Code only.
  assert.equal(data.stateOf(xaml).state, 'reported');
  assert.equal(views().style.display, 'none'); assert.equal(data.sourceView, 'code');
  // GitHub moves past the recorded version: Changes opens on the update.
  files[xaml] = '<Window>\n  <Grid/>\n</Window>\n'; advanceHead();
  await data.reload(); data.select(xaml); await settle(); await settle();
  assert.equal(data.stateOf(xaml).state, 'changed');
  assert.equal(data.sourceView, 'changes', 'the update is the default view');
  assert.notEqual(views().style.display, 'none'); assert.ok(shown(diff()));
  assert.ok(!shown(el.querySelector('[data-source-plain]')));
  assert.match(data.baseline.label, /^reported installed at [0-9a-f]{7}$/);
  assert.deepEqual([...data.diffRows.filter(r => r.type !== 'eq').map(r => r.type + ' ' + r.text)],
    ['del <Window/>', 'add <Window>', 'add   <Grid/>', 'add </Window>']);
  assert.match(diff().textContent, /GitHub now at/);
  // Code is one tap away and Changes comes back.
  [...views().querySelectorAll('button')].find(b => b.textContent === 'Code').click(); await settle();
  assert.equal(data.sourceView, 'code'); assert.ok(shown(el.querySelector('[data-source-plain]'))); assert.ok(!shown(diff()));
  // A copy supplied from the work computer is newer evidence and takes over.
  await data.compareDrop(dropped('<Window>\n</Window>\n')); await settle(); await settle();
  assert.equal(data.sourceView, 'changes');
  assert.equal(data.baseline.label, 'Supplied copy');
  assert.deepEqual([...data.diffRows.filter(r => r.type !== 'eq').map(r => r.type + ' ' + r.text)], ['add   <Grid/>']);
  // The menu's Show changes returns to it from Code.
  data.setSourceView('code'); await settle();
  await data.runAction(xaml, 'changes'); await settle();
  assert.equal(data.sourceView, 'changes');
  // No evidence and nothing to guess: Code, with no note. A new file's
  // pending box already says it is new; an assumed-synced file says nothing.
  data.select(ctl); await settle(); await settle();
  assert.equal(data.baseline, null); assert.equal(data.sourceView, 'code'); assert.equal(data.baselineNote, '');
  data.select(`${P}/app/Profile.ps1`); await settle(); await settle();
  assert.equal(data.baselineNote, '');
  assert.equal(requests.filter(r => r.method !== 'GET').length, writes, 'Changes writes nothing');
  files[xaml] = original; advanceHead(); await data.reload();
  data.select(FORMS); await settle();
});

test('a pending update with no record compares from the version before its change', async () => {
  const profile = `${P}/app/Profile.ps1`, manifestPath = `${P}/data/installation.json`, manifest = files[manifestPath];
  const older = 'profile v1\n', revision = 'b'.repeat(40);
  snapshots.set(revision, { ...files, [profile]: older });
  const m = JSON.parse(manifest);
  m.pending_adoption.push({ path: 'app/Profile.ps1', transfer: 'changed', since: '2026-09-20', limit: 'one line changed' });
  files[manifestPath] = JSON.stringify(m); advanceHead();
  history = { path: profile, until: '2026-09-20T00:00:00Z', revision };
  await data.reload(); data.select(profile); await settle(); await settle();
  assert.equal(data.stateOf(profile).state, 'pending-changed');
  assert.equal(data.sourceView, 'changes', 'the pending update is the default view');
  assert.equal(data.baseline.label, 'Before the pending change (bbbbbbb, before 2026-09-20)');
  assert.deepEqual([...data.diffRows.map(r => r.type + ' ' + r.text)], ['del profile v1', 'add profile']);
  // No earlier version: say so.
  history = null;
  await data.reload(); data.select(profile); await settle(); await settle();
  assert.equal(data.baseline, null);
  assert.match(data.baselineNote, /No earlier version of this file/);
  files[manifestPath] = manifest; advanceHead(); await data.reload();
  data.select(FORMS); await settle();
});

test('the status icon opens a menu of the actions the file\'s state allows; a differing paste does not recolour it', async () => {
  const profile = `${P}/app/Profile.ps1`, demo = `${P}/app/Scripts/Demo.ps1`;
  const rowOf = path => q('[data-row]').find(r => r.textContent.includes(path.split('/').pop()));
  const writes = publications.length;
  data.select(''); await settle();
  // Assumed in sync is an outline check; a ledger confirmation is filled.
  assert.equal(data.statusOf(profile).cls, 'ph ph-check-circle text-success');
  assert.equal(data.statusOf(FORMS).cls.split(' ')[0], 'ph-fill');
  const icon = rowOf(profile).querySelector('[data-status]');
  assert.equal(icon.getAttribute('title'), 'Assumed synced');
  icon.click(); await settle();
  const menu = rowOf(profile).querySelector('[data-status-menu]');
  assert.notEqual(menu.style.display, 'none');
  assert.deepEqual([...menu.querySelectorAll('li button')].map(b => b.textContent.trim()), ['Confirm installed…', 'Open in Code']);
  // Right-click opens the same menu; Escape closes it.
  data.menuFor = ''; await settle();
  rowOf(profile).dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true })); await settle();
  assert.equal(data.menuFor, profile);
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' })); await settle();
  assert.equal(data.menuFor, '');
  assert.deepEqual([...data.actionsFor(demo).map(a => a.key)], ['code'], 'repository-only material offers no placement');
  // Confirm installed… selects the file and opens the confirm; nothing writes until it is tapped.
  icon.click(); await settle();
  [...rowOf(profile).querySelectorAll('[data-status-menu] li button')].find(b => /Confirm installed/.test(b.textContent)).click();
  for (let i = 0; i < 10 && !data.pending; i++) await tick(2);
  assert.equal(data.selected, profile); assert.equal(data.pending.kind, 'installed');
  assert.match(el.textContent, /I placed this on the work computer/);
  assert.equal(publications.length, writes, 'the menu opens the confirm; it does not write');
  data.pending = null;
  // A paste that differs, newer than any ledger row, shows as Differs with Record the difference….
  await data.compareDrop(dropped('something else\n')); await settle();
  assert.equal(data.statusOf(profile).short, 'Assumed synced', 'only a recorded difference turns the icon red');
  assert.ok(data.actionsFor(profile).some(a => a.key === 'record-check' && a.label === 'Record the difference…'));
  assert.ok(data.actionsFor(profile).some(a => a.key === 'changes'));
  await data.runAction(profile, 'record-check'); await settle();
  assert.equal(data.pending.kind, 'check'); assert.equal(data.pending.row.kind, 'differs');
  data.pending = null; await settle();
  assert.equal(publications.length, writes);
  data.select(FORMS); await settle();
});

test('every ledger write in this run went through a confirm', () => {
  assert.equal(publications.length, 4);
  assert.deepEqual(problems, []);
});
