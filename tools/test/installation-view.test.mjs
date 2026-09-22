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
let currentRevision = REV, readGate = null, commitGate = null;
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
    if (method === 'GET' && p.startsWith('git/trees/')) {
      treeReads++;
      const revision = p.slice('git/trees/'.length).split('?')[0];
      return { tree: tree(snapshotAt(revision)) };
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
  decodeBytes: bytes => new TextDecoder().decode(bytes),
  checksUnder: async (repo, prefix) => checks.filter(c => c.repo === repo && c.path.startsWith(prefix)),
  reopen: async c => { shellCalls.push(['reopen', c.id]); },
};
window.__shell = {
  installationItem: '',
  syncUrl() { shellCalls.push(['syncUrl']); },
  goStage() { shellCalls.push(['goStage']); },
  goProject(...args) { shellCalls.push(['goProject', ...args]); },
  openFile(p) { shellCalls.push(['openFile', p]); },
  async openCorrespondence(target, text, name, source) {
    shellCalls.push(['compare', target.path, source]);
    const file = snapshotAt(target.ref)[target.path];
    const exact = text === file;
    const rec = { id: 'c' + checks.length, repo: target.repo, path: target.path, revision: snapshots.has(target.ref) ? target.ref : currentRevision, blobSha: gitBlob(file),
      incomingSha256: createHash('sha256').update(text, 'utf8').digest('hex'), exact,
      lineEndingsOnly: !exact && text.replace(/\r\n?/g, '\n') === file.replace(/\r\n?/g, '\n'),
      source, checkedAt: new Date().toISOString(), content: text };
    checks.push(rec);
    window.dispatchEvent(new window.CustomEvent('correspondence-check', { detail: rec }));
  },
};
// The pane links the explanation document and the ledger through the shared
// link builder, so the harness carries the real one rather than a guess at
// the URL shape it produces.
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/github-links.js'), 'utf8'))();
const saves = [], clip = [];
window.io = { save: (data, name) => saves.push({ data, name }) };
Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async t => { clip.push(t); } } });

for (const rel of ['lib/kits/csv.js', 'lib/kits/installation.js', 'lib/alpineComponents/installation-view.js'])
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
  assert.match(data.docUrl, /INSTALLATION\.md$/);
  const titled = [...el.querySelectorAll('[title]')].map(e => e.getAttribute('title'));
  assert.deepEqual(titled.filter(t => t.split(/\s+/).length > 2), [],
    'a title is the label of an icon-only control, never a sentence of explanation');
  assert.match(data.headline, /^aaaaaaa · 5 files · 2 local state unknown · 1 repository only · 1 new file awaiting adoption · 1 update awaiting adoption$/);
  assert.equal(publications.length, 0);
  assert.ok(reads.every(r => r.ref === REV), 'manifest and ledger are read at the captured revision');
});

test('selecting a file shows its destination and makes it the shell\'s correspondence target', async () => {
  data.select(FORMS);
  await settle();
  assert.equal(window.__shell.installationItem, FORMS);
  assert.ok(shellCalls.some(c => c[0] === 'syncUrl'));
  assert.match(el.textContent, /Documents\\WindowsPowerShell\\Modules\\Forms\\Forms\.psm1/);
  assert.match(el.textContent, /local state unknown/);
  assert.match(el.textContent, /Nothing recorded for this file/);
  assert.equal(data.badgeOf(FORMS), 'badge-warning badge-outline');
  assert.match(el.querySelector('[data-adoption]').textContent, /Repository update awaiting adoption/);
  assert.match(el.querySelector('[data-adoption]').textContent, /Module import has not run on the work computer/);
  q('button').find(b => b.textContent.includes('Open code workspace')).click();
  assert.deepEqual(shellCalls.find(c => c[0] === 'goProject'), ['goProject', P, 'code', FORMS]);
  data.select(`${P}/app/Forms/Bookmarks/Bookmarks.xaml`);
  await settle();
  assert.match(el.textContent, /companion/);
  assert.match(el.textContent, /Bookmarks\.ps1/);
  data.select(`${P}/app/Scripts/Demo.ps1`);
  await settle();
  assert.match(el.textContent, /no installation destination \(repository only\)/);
  const record = q('button').find(b => /Record installed/.test(b.textContent));
  assert.equal(record.style.display, 'none', 'repository-only material offers no placement to record');
  data.select(FORMS);
  await settle();
});

test('a comparison goes through the shell and comes back as a browser check, with no ledger write', async () => {
  data.compareDraft = 'function Import-Form {}\r\n';
  await data.submitCompare();
  await settle();
  assert.deepEqual(shellCalls.filter(c => c[0] === 'compare'), [['compare', FORMS, 'field']]);
  assert.equal(data.checks.length, 1);
  assert.equal(data.checks[0].lineEndingsOnly, true);
  assert.equal(data.stateOf(FORMS).state, 'pending-changed', 'a check is browser-local; adoption stays pending');
  assert.match(el.textContent, /Checks in this browser/);
  assert.match(el.textContent, /matched, line endings differ/);
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
  assert.match(el.textContent, /this file has not changed since/);
});

test('a browser check can be promoted to a verified row, and then reads as recorded', async () => {
  const check = data.checks[0];
  assert.equal(data.isRecorded(check), false);
  data.askCheck(check);
  await settle();
  assert.equal(data.pending.row.kind, 'verified');
  assert.equal(data.pending.row.match, 'line-endings');
  assert.equal(data.pending.row.method, 'field');
  await data.confirmRecord();
  await settle();
  assert.equal(publications.length, 2);
  assert.equal(data.isRecorded(check), true);
  assert.equal(data.stateOf(FORMS).state, 'verified');
  assert.equal(data.stateOf(FORMS).history.length, 2, 'the installed row is kept beneath the verification');
  assert.match(el.textContent, /recorded/);
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
  assert.match(el.textContent, /this file has changed on GitHub since/);
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

test('selection changes cancel pending copy, download, and installed-row preparation', async () => {
  const profile = `${P}/app/Profile.ps1`;
  for (const method of ['copyText', 'downloadText', 'askInstalled']) {
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
  const gate = deferred(), comparisons = shellCalls.filter(c => c[0] === 'compare').length;
  const pending = data.compareFile({ name: 'Forms.psm1', arrayBuffer: () => gate.promise }, 'file picker');
  data.select(`${P}/app/Profile.ps1`);
  gate.resolve(new TextEncoder().encode(files[FORMS]).buffer);
  await pending;
  assert.equal(shellCalls.filter(c => c[0] === 'compare').length, comparisons);
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

test('every ledger write in this run went through a confirm', () => {
  assert.equal(publications.length, 4);
  assert.deepEqual(problems, []);
});
