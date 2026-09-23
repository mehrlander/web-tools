// lib/kits/installation.js — the installation ledger's derivation, apart from
// the pane that shows it. The subject is a work computer nothing here can
// inspect, so the test walks the one sequence the design has to get right:
// a file begins unknown, a supplied copy is compared (browser-local, and
// still unknown here), a placement is recorded, the record survives a reload,
// GitHub moves and the state says so, a later copy verifies or contradicts,
// a form's two files read apart, and a locally known area stays local. Then
// the guards: no path but an explicit row() with kind `installed` produces
// that claim, every row is validated, and append() writes exactly one line
// against the sha it read.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { repoRoot } from './bootstrap.mjs';

const win = { crypto: webcrypto, GH: { FRESH: { cache: 'no-store' }, toBase64: s => Buffer.from(s, 'utf8').toString('base64') } };
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/csv.js'), 'utf8'))(win);
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/installation.js'), 'utf8'))(win);
const K = win.Installation;

const MANIFEST = JSON.stringify({
  as_of: '2026-09-14', root: 'Documents\\WindowsPowerShell', observations: 'projects/wps/data/observations.csv',
  correspondence: [
    { repo: 'app/Profile.ps1', area: 'Profile', installs: '' },
    { repo: 'app/Modules/', area: 'Modules', installs: 'Modules/' },
    { repo: 'app/Forms/', area: 'Forms', installs: 'Forms/' },
    { repo: 'app/Scripts/', area: 'Scripts', installs: null },
  ],
  doc: 'projects/wps/docs/INSTALLATION.md',
  local_areas: [
    { name: 'Leg', status: 'unresolved', shape: 'reportedly bill collections' },
    { name: 'ISELog', status: 'local-only', shape: 'ZIP snapshots of editor text' },
    { name: 'Odd', status: 'something-else' },
  ],
});
const P = 'projects/wps';
const sha40 = c => c.repeat(40);
const sha64 = c => c.repeat(64);
const blob = (rel, sha) => ({ type: 'blob', path: P + '/' + rel, sha, size: 10 });
const tree = [
  blob('app/Profile.ps1', sha40('1')),
  blob('app/Modules/Forms/Forms.psm1', sha40('2')),
  blob('app/Modules/Forms/Theme.xaml', sha40('3')),
  blob('app/Modules/ISE/Tools/Buttons.xml', sha40('4')),
  blob('app/Forms/Bookmarks/Bookmarks.ps1', sha40('5')),
  blob('app/Forms/Bookmarks/Bookmarks.xaml', sha40('6')),
  blob('app/Forms/HTMLViewer/HTMLViewer.xaml', sha40('7')),
  blob('app/Scripts/Demos/Demo.ps1', sha40('8')),
  blob('docs/INSTALLATION.md', sha40('9')),
  { type: 'tree', path: P + '/app/Modules' },
];
const m = K.manifest(MANIFEST);
const items = K.inventory({ tree, manifest: m, projectPath: P });
const by = rel => items.find(it => it.rel === rel);
const FORMS = P + '/app/Modules/Forms/Forms.psm1';
const CSV_HEAD = K.HEADER.join(',') + '\n';
const rowOf = (over) => K.row({ kind: 'installed', path: FORMS, revision: sha40('a'), blobSha: sha40('2'),
  sha256: sha64('f'), method: 'reported', date: '2026-09-14T10:00:00Z', ...over });

test('the manifest normalizes destinations: a string, the root, or none', () => {
  assert.deepEqual(m.correspondence.map(c => c.installs), ['', 'Modules/', 'Forms/', null]);
  assert.deepEqual(m.localAreas.map(a => a.status), ['unresolved', 'local-only', 'unresolved'],
    'an unknown status reads as unresolved rather than as settled');
  assert.equal(m.root, 'Documents\\WindowsPowerShell');
});

// The manifest owns mappings and statuses; the document it names owns the
// reasoning. Reading a prose field here would be the first step back toward
// the same policy written down twice, so the normalizer carries none.
test('the manifest carries the document pointer and no explanatory prose', () => {
  assert.equal(m.doc, 'projects/wps/docs/INSTALLATION.md');
  for (const c of m.correspondence) assert.deepEqual(Object.keys(c).sort(), ['area', 'installs', 'repo']);
  for (const a of m.localAreas) assert.deepEqual(Object.keys(a).sort(), ['name', 'shape', 'status']);
  assert.equal(m.localAreas[0].shape, 'reportedly bill collections', 'shape is a structural line, not policy');
  const withProse = K.manifest(JSON.stringify({
    correspondence: [{ repo: 'app/x.ps1', area: 'X', installs: '', note: 'why it goes there' }],
    local_areas: [{ name: 'Y', status: 'unresolved', policy: 'preserve it' }],
  }));
  assert.equal('note' in withProse.correspondence[0], false, 'a stray note is dropped, not rendered');
  assert.equal('policy' in withProse.localAreas[0], false, 'a stray policy is dropped, not rendered');
  const g = K.groups(items, m);
  for (const area of g) assert.equal('note' in area, false, 'a group carries no prose either');
});

test('the inventory places only app/ material, by the manifest, and pairs a form\'s two files', () => {
  assert.deepEqual(items.map(it => it.rel), [
    'app/Forms/Bookmarks/Bookmarks.ps1', 'app/Forms/Bookmarks/Bookmarks.xaml', 'app/Forms/HTMLViewer/HTMLViewer.xaml',
    'app/Modules/Forms/Forms.psm1', 'app/Modules/Forms/Theme.xaml', 'app/Modules/ISE/Tools/Buttons.xml',
    'app/Profile.ps1', 'app/Scripts/Demos/Demo.ps1'], 'docs/ and tree nodes are not installation material');
  assert.equal(by('app/Modules/Forms/Forms.psm1').installs, 'Modules/Forms/Forms.psm1');
  assert.equal(by('app/Profile.ps1').installs, '', 'the profile lands at the root under a filename nobody has verified');
  assert.equal(by('app/Scripts/Demos/Demo.ps1').installs, null, 'a script has no destination');
  const ctl = by('app/Forms/Bookmarks/Bookmarks.ps1'), xaml = by('app/Forms/Bookmarks/Bookmarks.xaml');
  assert.equal(ctl.kind, 'controller'); assert.equal(xaml.kind, 'xaml');
  assert.equal(ctl.companion, xaml.path); assert.equal(xaml.companion, ctl.path);
  assert.equal(by('app/Forms/HTMLViewer/HTMLViewer.xaml').companion, '', 'an orphan XAML pairs with nothing');
  assert.equal(by('app/Modules/Forms/Theme.xaml').kind, 'resource', 'XAML inside a module is a resource, not a form');
  assert.equal(by('app/Modules/ISE/Tools/Buttons.xml').comparable, false, 'the comparison flow takes PowerShell and XAML only');
  assert.equal(by('app/Modules/ISE/Tools/Buttons.xml').unit, 'ISE', 'a tool file belongs to its module');
  const g = K.groups(items, m);
  assert.deepEqual(g.map(x => x.area), ['Profile', 'Modules', 'Forms', 'Scripts'], 'area order follows the manifest');
  assert.deepEqual(g[2].units.map(u => u.name), ['Bookmarks', 'HTMLViewer']);
  assert.deepEqual(g[2].units[0].files.map(f => f.kind), ['controller', 'xaml'], 'the controller leads its XAML');
});

test('the sequence: unknown, compared, recorded, reloaded, GitHub moves, verified or contradicted', async () => {
  const forms = by('app/Modules/Forms/Forms.psm1');
  // 1. Nothing recorded.
  let d = K.derive(forms, []);
  assert.equal(d.state, 'unknown'); assert.equal(d.label, 'local state unknown');
  // 2. A supplied copy compared in the browser: a check exists, the ledger
  //    does not know, and the derivation reads the ledger alone.
  const check = { path: FORMS, revision: sha40('a'), blobSha: sha40('2'), incomingSha256: sha64('c'),
    exact: true, lineEndingsOnly: false, source: 'paste', checkedAt: '2026-09-14T09:00:00Z' };
  assert.equal(K.derive(forms, []).state, 'unknown', 'a comparison alone claims nothing durable');
  assert.equal(K.isRecorded(check, []), false);
  // 3. The placement is recorded, explicitly, as its own row.
  const installed = rowOf({});
  let rows = [installed];
  d = K.derive(forms, rows);
  assert.equal(d.state, 'reported'); assert.equal(d.label, 'reported installed');
  // 4. Reload: the row round-trips through the CSV the way the pane reads it.
  const text = CSV_HEAD + K.line(installed) + '\n';
  rows = K.observations(text);
  assert.deepEqual(rows, [installed], 'what was written is what is read back');
  assert.equal(K.derive(forms, rows).state, 'reported');
  // 5. GitHub moves: the same file at a new blob.
  const moved = { ...forms, blobSha: sha40('e') };
  d = K.derive(moved, rows);
  assert.equal(d.state, 'changed'); assert.equal(d.label, 'GitHub changed since reported install');
  assert.equal(d.latest.revision, sha40('a'), 'the state still names the revision that was reported');
  // 6a. A later supplied copy matches the new revision: verified.
  const verify = K.fromCheck({ ...check, revision: sha40('b'), blobSha: sha40('e'), checkedAt: '2026-09-15T09:00:00Z' });
  assert.equal(verify.kind, 'verified'); assert.equal(verify.match, 'exact');
  rows = K.observations(text + K.line({ ...verify, date: '2026-09-15T09:00:00Z' }) + '\n');
  d = K.derive(moved, rows);
  assert.equal(d.state, 'verified'); assert.equal(d.label, 'verified from supplied copy');
  assert.equal(d.history.length, 2, 'the earlier row is kept, not replaced');
  assert.equal(K.isRecorded({ ...check, revision: sha40('b') }, rows), true);
  // 6b. Or it contradicts the record.
  const differ = K.fromCheck({ ...check, revision: sha40('b'), blobSha: sha40('e'), exact: false, incomingSha256: sha64('d') });
  assert.equal(differ.kind, 'differs'); assert.equal(differ.match, 'none');
  d = K.derive(moved, [installed, { ...differ, date: '2026-09-16T09:00:00Z' }]);
  assert.equal(d.state, 'differs'); assert.equal(d.label, 'local copy differs');
  assert.equal(K.derive({ ...moved, blobSha: sha40('f') }, [installed, { ...differ, date: '2026-09-16T09:00:00Z' }]).state,
    'differs-changed', 'a differing copy against a since-moved revision says both');
  // Line endings only is a verification with a note in the label.
  const le = K.fromCheck({ ...check, exact: false, lineEndingsOnly: true });
  assert.equal(le.match, 'line-endings');
  assert.equal(K.derive(forms, [{ ...le, date: '2026-09-17T00:00:00Z' }]).label, 'verified from supplied copy (line endings differ)');
});

test('a form\'s controller and XAML read apart, and repository-only material says so', () => {
  const ctl = by('app/Forms/Bookmarks/Bookmarks.ps1'), xaml = by('app/Forms/Bookmarks/Bookmarks.xaml');
  const rows = [rowOf({ path: ctl.path, blobSha: sha40('5') })];
  assert.equal(K.derive(ctl, rows).state, 'reported');
  assert.equal(K.derive(xaml, rows).state, 'unknown', 'recording the controller says nothing about its XAML');
  const script = by('app/Scripts/Demos/Demo.ps1');
  assert.equal(K.derive(script, []).state, 'repo-only');
  assert.equal(K.derive(script, [rowOf({ path: script.path, blobSha: sha40('8') })]).state, 'repo-only',
    'a row on a file with no destination does not make it installed material');
  assert.deepEqual(K.summary([K.derive(ctl, rows), K.derive(xaml, rows), K.derive(script, [])]),
    { unknown: 1, ahead: 0, reported: 1, verified: 0, changed: 0, differs: 0, 'differs-changed': 0, 'repo-only': 1 });
});

test('a pending_adoption entry reads as ahead until the first observation row lands', () => {
  const mf = K.manifest(JSON.stringify({ ...JSON.parse(MANIFEST), pending_adoption: [
    { path: 'app/Modules/Forms/Forms.psm1', since: '2026-09-23', transfer: 'changed', limit: 'never loaded since the change' },
    { path: 'app/Forms/Bookmarks/Bookmarks.xaml', since: '2026-09-23', transfer: 'new', limit: 'drawn, never opened' },
    { path: 'app/Scripts/Demos/Demo.ps1', since: '2026-09-23', transfer: 'new', limit: 'repository-retained; the check refuses this' },
    { limit: 'no path' },
  ] }));
  assert.equal(mf.pending.length, 3, 'an entry without a path is dropped');
  const inv = K.inventory({ tree, manifest: mf, projectPath: P });
  const forms = inv.find(it => it.rel === 'app/Modules/Forms/Forms.psm1');
  const xaml = inv.find(it => it.rel === 'app/Forms/Bookmarks/Bookmarks.xaml');
  const ctl = inv.find(it => it.rel === 'app/Forms/Bookmarks/Bookmarks.ps1');
  const demo = inv.find(it => it.rel === 'app/Scripts/Demos/Demo.ps1');
  assert.equal(forms.ahead.limit, 'never loaded since the change');
  assert.equal(ctl.ahead, null, 'the entry names one file, not its companion');
  // Ahead, with the transfer on the label so the list says which kind.
  assert.equal(K.derive(forms, []).state, 'ahead');
  assert.equal(K.derive(forms, []).label, 'repository ahead, not yet placed (changed file)');
  assert.equal(K.derive(xaml, []).label, 'repository ahead, not yet placed (new file)');
  assert.equal(K.derive(forms, []).ahead.since, '2026-09-23');
  assert.equal(K.derive(ctl, []).state, 'unknown', 'a file without an entry keeps the presumption');
  assert.equal(K.derive(demo, []).state, 'repo-only', 'no destination outranks the entry');
  // The first row ends the entry's claim: newest evidence wins, as everywhere.
  const d = K.derive(forms, [rowOf({})]);
  assert.equal(d.state, 'reported');
  assert.equal(d.ahead, null);
  const counts = K.summary([K.derive(forms, []), K.derive(xaml, []), K.derive(ctl, []), K.derive(demo, [])]);
  assert.equal(counts.ahead, 2);
  assert.equal(K.STATES.indexOf('ahead'), K.STATES.indexOf('unknown') + 1, 'ahead follows unknown in the headline order');
});

test('a locally known area is carried as local, never as a repository folder', () => {
  assert.deepEqual(m.localAreas.map(a => a.name), ['Leg', 'ISELog', 'Odd']);
  assert.ok(!items.some(it => /Leg|ISELog/.test(it.rel)), 'nothing in the inventory pretends those exist in GitHub');
});

test('a row is validated field by field, and only an explicit kind claims a placement', () => {
  assert.throws(() => rowOf({ kind: 'synced' }), /installed, verified or differs/);
  assert.throws(() => rowOf({ revision: 'main' }), /40-hex revision/);
  assert.throws(() => rowOf({ blobSha: '' }), /blob sha/);
  assert.throws(() => rowOf({ sha256: 'abc' }), /SHA-256/);
  assert.throws(() => rowOf({ match: 'exact' }), /blank for installed/);
  assert.throws(() => rowOf({ kind: 'verified' }), /exact, line-endings or none/);
  assert.throws(() => rowOf({ method: '' }), /method/);
  assert.throws(() => rowOf({ path: 'C:\\Users\\x\\Forms.psm1' }), /repository-relative/);
  assert.equal(rowOf({ note: 'two\nlines, "quoted"' }).note, 'two lines, "quoted"', 'a note is one line');
  assert.equal(K.line(rowOf({ note: 'two lines, "quoted"' })).split(',').length, 10,
    'a note with a comma is quoted, so it stays one field');
  assert.deepEqual(K.observations(CSV_HEAD + K.line(rowOf({ note: 'a, "b"' })) + '\n')[0].note, 'a, "b"');
  // fromCheck can only ever yield verified or differs.
  for (const c of [{ exact: true }, { exact: false, lineEndingsOnly: true }, { exact: false, lineEndingsOnly: false }]) {
    const r = K.fromCheck({ path: FORMS, revision: sha40('a'), blobSha: sha40('2'), incomingSha256: sha64('c'), source: 'drop', ...c });
    assert.notEqual(r.kind, 'installed');
  }
});

test('digest is SHA-256 over UTF-8, the same hash the correspondence check stores', async () => {
  const { createHash } = await import('node:crypto');
  assert.equal(await K.digest('Get-Item\r\n'), createHash('sha256').update('Get-Item\r\n', 'utf8').digest('hex'));
});

function ghStub({ text = CSV_HEAD, sha = sha40('c'), failFirstPut = false, missing = false } = {}) {
  const calls = [];
  let puts = 0;
  return { calls, gh: {
    ref: 'main',
    async get(p, opts) {
      calls.push(['get', p, opts?.cache]);
      if (missing) { const e = new Error('Not Found'); e.status = 404; throw e; }
      return { text, sha };
    },
    async req(p, opts) {
      calls.push(['req', p, opts?.method, JSON.parse(opts.body)]);
      if (failFirstPut && ++puts === 1) { const e = new Error('conflict'); e.status = 409; throw e; }
      return { content: { sha: sha40('d') }, commit: { sha: sha40('9') } };
    },
  } };
}

test('append reads fresh, appends one line, and PUTs against the sha it read', async () => {
  const { gh, calls } = ghStub({ text: CSV_HEAD + 'x,y\n' });
  const r = rowOf({});
  const out = await K.append({ gh, path: 'projects/wps/data/observations.csv', row: r });
  assert.equal(calls[0][2], 'no-store', 'the read bypasses the HTTP cache');
  const put = calls[1];
  assert.equal(put[2], 'PUT'); assert.equal(put[3].sha, sha40('c')); assert.equal(put[3].branch, 'main');
  assert.equal(Buffer.from(put[3].content, 'base64').toString('utf8'), CSV_HEAD + 'x,y\n' + K.line(r) + '\n');
  assert.match(put[3].message, /Record installation observation: installed Forms.psm1 via Web Tools/);
  assert.equal(out.commit, sha40('9')); assert.equal(out.line, K.line(r));
});

test('append creates a missing ledger with the header, retries one conflict, and refuses a pinned ref', async () => {
  const missing = ghStub({ missing: true });
  await K.append({ gh: missing.gh, path: 'p.csv', row: rowOf({}) });
  const body = missing.calls[1][3];
  assert.equal(body.sha, undefined);
  assert.ok(Buffer.from(body.content, 'base64').toString('utf8').startsWith(CSV_HEAD));
  const racy = ghStub({ failFirstPut: true });
  await K.append({ gh: racy.gh, path: 'p.csv', row: rowOf({}) });
  assert.deepEqual(racy.calls.map(c => c[0]), ['get', 'req', 'get', 'req'], 'a conflict re-reads before the one retry');
  const pinned = ghStub(); pinned.gh.ref = sha40('a');
  await assert.rejects(K.append({ gh: pinned.gh, path: 'p.csv', row: rowOf({}) }), /branch/);
  const odd = ghStub({ text: 'date,path\n' });
  await assert.rejects(K.append({ gh: odd.gh, path: 'p.csv', row: rowOf({}) }), /header/);
});
