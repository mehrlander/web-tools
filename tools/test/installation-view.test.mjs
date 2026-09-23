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
    pending_adoption: [{ path: 'app/Modules/ExcelService/ExcelSnag.ps1', since: '2026-09-14', transfer: 'new',
                         limit: 'scope resolution has never run against live Excel COM' }],
  }),
  [`${P}/data/observations.csv`]: 'date,path,kind,revision,blob_sha,local_sha256,match,method,note\n',
  [`${P}/app/Profile.ps1`]: 'profile\n',
  [`${P}/app/Modules/Forms/Forms.psm1`]: 'function Import-Form {}\n',
  [`${P}/app/Modules/ExcelService/ExcelSnag.ps1`]: 'function Copy-Selection {}\n',
  [`${P}/app/Forms/Bookmarks/Bookmarks.ps1`]: 'controller\n',
  [`${P}/app/Forms/Bookmarks/Bookmarks.xaml`]: '<Window/>\n',
  [`${P}/app/Scripts/Demo.ps1`]: 'demo\n',
  [`${P}/docs/INSTALLATION.md`]: '# map\n',
};
const tree = () => Object.entries(files).map(([p, t]) => ({ type: 'blob', path: p, sha: gitBlob(t), size: t.length }));
const puts = [];
let treeReads = 0;
window.TOKEN = 't';
window.GH = class {
  constructor({ repo, ref } = {}) { this.repo = repo; this.ref = ref || ''; }
  async get(p) {
    const t = files[p];
    if (t === undefined) { const e = new Error('Not Found'); e.status = 404; throw e; }
    return { text: t, sha: gitBlob(t) };
  }
  async req(p, opts = {}) {
    if (opts.method === 'PUT') {
      const body = JSON.parse(opts.body);
      const rel = p.slice('contents/'.length);
      puts.push({ path: rel, body });
      files[rel] = Buffer.from(body.content, 'base64').toString('utf8');
      return { content: { sha: gitBlob(files[rel]) }, commit: { sha: '9'.repeat(40) } };
    }
    if (p.startsWith('git/trees/')) { treeReads++; return { tree: tree() }; }
    if (p.startsWith('commits')) return [{ sha: REV }];
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
  openFile(p) { shellCalls.push(['openFile', p]); },
  async openCorrespondence(target, text, name, source) {
    shellCalls.push(['compare', target.path, source]);
    const file = files[target.path];
    const exact = text === file;
    const rec = { id: 'c' + checks.length, repo: target.repo, path: target.path, revision: REV, blobSha: gitBlob(file),
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
  assert.equal(data.items.length, 6, 'docs/ is not installation material');
  assert.deepEqual([...data.groups.map(g => g.area)], ['Profile', 'Modules', 'Forms', 'Scripts']);
  assert.equal(q('[data-installation] section button.text-left').length, 6, 'one row per file');
  const text = el.textContent;
  assert.match(text, /Local areas/); assert.match(text, /Leg/); assert.match(text, /local only/); assert.match(text, /unresolved/);
  assert.match(text, /reportedly bill collections/, 'the shape reads on the row');
  // The explanation is linked, not copied onto the pane, and nothing on it
  // parks a fact in a title where a phone and a screenshot cannot reach it.
  assert.match(data.docUrl, /INSTALLATION\.md$/);
  const titled = [...el.querySelectorAll('[title]')].map(e => e.getAttribute('title'));
  assert.deepEqual(titled.filter(t => t.split(/\s+/).length > 2), [],
    'a title is the label of an icon-only control, never a sentence of explanation');
  assert.match(data.headline, /^aaaaaaa · 6 files · 4 local state unknown · 1 repository ahead, not yet placed · 1 repository only$/);
  assert.equal(puts.length, 0);
});

test('a file the repository holds ahead of the work computer says so, with its limit, until a row lands', async () => {
  const SNAG = `${P}/app/Modules/ExcelService/ExcelSnag.ps1`;
  assert.equal(data.stateOf(SNAG).state, 'ahead');
  assert.equal(data.stateOf(SNAG).label, 'repository ahead, not yet placed (new file)');
  data.select(SNAG); await settle();
  const pane = el.querySelector('[data-ahead]');
  assert.ok(pane, 'the entry renders on the selected file');
  assert.match(pane.textContent, /since 2026-09-14, no copy at the destination yet/);
  assert.match(pane.textContent, /Not yet exercised: scope resolution has never run against live Excel COM/);
  assert.match(el.textContent, /never, and the repository is ahead of the work computer/);
  // The filter narrows to the ahead files, like any other state.
  data.filter = 'ahead'; await settle();
  assert.equal(q('[data-installation] section button.text-left').length, 1);
  data.filter = ''; await settle();
  // The confirm text says the entry ends with this row; nothing is written yet.
  await data.askInstalled(); await settle();
  assert.match(data.pending.why, /pending_adoption entry/);
  data.pending = null; data.select(''); await settle();
  assert.equal(puts.length, 0);
});

test('selecting a file shows its destination and makes it the shell\'s correspondence target', async () => {
  data.select(FORMS);
  await settle();
  assert.equal(window.__shell.installationItem, FORMS);
  assert.ok(shellCalls.some(c => c[0] === 'syncUrl'));
  assert.match(el.textContent, /Documents\\WindowsPowerShell\\Modules\\Forms\\Forms\.psm1/);
  assert.match(el.textContent, /local state unknown/);
  assert.match(el.textContent, /Nothing recorded for this file/);
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
  assert.equal(data.stateOf(FORMS).state, 'unknown', 'a check is browser-local; the ledger still says unknown');
  assert.match(el.textContent, /Checks in this browser/);
  assert.match(el.textContent, /matched, line endings differ/);
  assert.equal(puts.length, 0, 'comparing writes nothing');
});

test('copy and download fetch the GitHub text and write nothing', async () => {
  await data.copyText();
  assert.equal(clip[0], files[FORMS]);
  await data.downloadText();
  assert.deepEqual(saves[0], { data: files[FORMS], name: 'Forms.psm1' });
  assert.equal(data.lastTransfer[FORMS], 'download');
  assert.equal(puts.length, 0, 'a transfer is not an installation');
});

test('recording a placement takes the confirm: the row is shown first, then one PUT lands it', async () => {
  await data.askInstalled();
  await settle();
  assert.ok(data.pending, 'the confirm is open');
  assert.equal(data.pending.row.kind, 'installed');
  assert.equal(data.pending.row.method, 'download', 'the method names the transfer that preceded it');
  assert.equal(data.pending.row.blob_sha, gitBlob(files[FORMS]));
  assert.equal(data.pending.row.local_sha256, createHash('sha256').update(files[FORMS], 'utf8').digest('hex'));
  assert.match(el.textContent, /I placed this on the work computer/);
  assert.ok(el.querySelector('pre').textContent.includes(',installed,' + REV + ','), 'the exact line is on screen');
  assert.equal(puts.length, 0, 'asking is not writing');
  data.recordNote = 'copied over at lunch'; data.renderPending();
  await data.confirmRecord();
  await settle();
  assert.equal(puts.length, 1);
  assert.equal(puts[0].path, `${P}/data/observations.csv`);
  assert.equal(puts[0].body.branch, 'main');
  const written = Buffer.from(puts[0].body.content, 'base64').toString('utf8');
  assert.match(written, /,installed,a{40},[0-9a-f]{40},[0-9a-f]{64},,download,copied over at lunch\n$/);
  assert.equal(data.pending, null);
  assert.equal(data.stateOf(FORMS).state, 'reported');
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
  assert.equal(puts.length, 2);
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
  await data.reload();
  await settle();
  assert.equal(data.stateOf(FORMS).state, 'changed');
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
  assert.equal(data.stateOf(ctl).state, 'unknown');
});

test('every ledger write in this run went through a confirm', () => {
  assert.equal(puts.length, 4);
  assert.deepEqual(problems, []);
});
