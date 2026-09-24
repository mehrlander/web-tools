// lib/kits/installation.js — the installation ledger's derivation, apart from
// the pane that shows it. The subject is a work computer nothing here can
// inspect, so the test walks the one sequence the design has to get right:
// a file begins unknown, a supplied copy is compared (browser-local, and
// still unknown here), a placement is recorded, the record survives a reload,
// GitHub moves and the state says so, a later copy verifies or contradicts,
// a form's two files read apart, and a locally known area stays local. Then
// the guards: no path but an explicit row() with kind `installed` produces
// that claim, every row is validated, and append() writes exactly one line
// against the sha it read. When an adoption is pending, the observation and
// removal of that queue entry land together, or neither reaches the branch.

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

const LEDGER = P + '/data/observations.csv';
const MANIFEST_PATH = P + '/data/installation.json';
const pendingEntry = { path: 'app/Modules/Forms/Forms.psm1', since: '2026-09-14', transfer: 'changed',
  limit: 'Module import has not run on the work computer' };
const adoptionManifest = (entries = [pendingEntry]) => ({ ...JSON.parse(MANIFEST), pending_adoption: entries });

test('pending adoption carries transfer limits without turning them into installation evidence', () => {
  const raw = adoptionManifest([pendingEntry,
    { path: 'app/Forms/Bookmarks/Bookmarks.ps1', since: '2026-09-15', transfer: 'new', limit: 'Live form untested', note: 'drop prose' },
    { path: 'app/Scripts/Demos/Demo.ps1', transfer: 'new' },
    { path: 'app/invalid.ps1', transfer: 'installed' }, null]);
  const before = JSON.stringify(raw);
  const pending = K.manifest(raw);
  assert.deepEqual(pending.pendingAdoption[0], pendingEntry);
  assert.equal(pending.pendingAdoption.length, 3);
  assert.equal('note' in pending.pendingAdoption[1], false);
  assert.deepEqual(K.manifest('{}').pendingAdoption, []);
  assert.deepEqual(K.manifest({ pending_adoption: 'wrong shape' }).pendingAdoption, []);
  const inventory = K.inventory({ tree, manifest: pending, projectPath: P });
  const module = inventory.find(i => i.path === FORMS);
  const form = inventory.find(i => i.kind === 'controller');
  const script = inventory.find(i => i.kind === 'script');
  assert.deepEqual(module.pendingAdoption, pendingEntry);
  assert.equal(K.derive(module, []).state, 'pending-changed');
  assert.equal(K.derive(form, []).label, 'new file awaiting adoption');
  assert.equal(K.derive(module, []).latest, null, 'a queue entry is not an observed placement');
  assert.equal(K.derive(script, []).state, 'repo-only', 'no destination takes priority over a malformed pending entry');
  assert.equal(K.derive(module, [rowOf({})]).state, 'reported', 'recorded evidence takes priority even if stale manifest data remains');
  assert.equal(K.derive(module, [rowOf({})]).conflict, true, 'a row beside a pending entry is named as a contradiction');
  assert.equal(K.derive(module, [rowOf({})]).label, 'reported installed; pending entry still listed');
  assert.equal(K.derive(module, []).conflict, false);
  const profile = inventory.find(i => i.rel === 'app/Profile.ps1');
  assert.equal(K.derive(profile, [rowOf({ path: profile.path, blobSha: sha40('1') })]).conflict, false, 'a row on a file without an entry is no contradiction');
  assert.equal(JSON.stringify(raw), before, 'reading the manifest and deriving status never removes adoption entries');
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
    { unknown: 1, reported: 1, verified: 0, changed: 0, differs: 0, 'differs-changed': 0, 'repo-only': 1,
      'pending-new': 0, 'pending-changed': 0 });
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

test('a transfer script places the exact bytes under the manifest root and claims nothing', () => {
  const bytes = new TextEncoder().encode("\ufeffWrite-Output 'ändrad'\r\n");
  const base = { path: 'app/Modules/Forms/Forms.psm1', name: 'Forms.psm1', installs: 'Modules/Forms/Forms.psm1', root: 'Documents\\WindowsPowerShell', revision: 'a'.repeat(40), blobSha: 'b'.repeat(40), bytes };
  const script = K.transferScript(base);
  assert.match(script, /^\$dest = Join-Path \$HOME 'Documents\\WindowsPowerShell\\Modules\\Forms\\Forms\.psm1'\r$/m);
  assert.deepEqual(Buffer.from(/FromBase64String\('([^']+)'\)/.exec(script)[1], 'base64'), Buffer.from(bytes), 'the BOM and Unicode survive the round trip');
  assert.match(script, /^if \(\$blob -eq 'b{40}'\)/m);
  assert.doesNotMatch(script, /\?\?|&&|\|\|/, 'Windows PowerShell 5.1 only');
  assert.doesNotMatch(script, /observations|installed/i, 'the script neither names nor writes the ledger');
  const profile = K.transferScript({ ...base, path: "app/It's.ps1", name: "It's.ps1", installs: '' });
  assert.match(profile, /^\$dest = Join-Path \$HOME 'Documents\\WindowsPowerShell\\It''s\.ps1'\r$/m);
  assert.match(profile, /filename; adjust \$dest/);
  assert.match(K.transferScript({ ...base, root: 'C:\\Tools\\' }), /^\$dest = 'C:\\Tools\\Modules\\Forms\\Forms\.psm1'\r$/m);
  assert.throws(() => K.transferScript({ ...base, installs: null }), /no installation destination/);
  assert.throws(() => K.transferScript({ ...base, blobSha: 'short' }), /Git blob sha/);
  assert.throws(() => K.transferScript({ ...base, bytes: 'text' }), /source bytes/);
});

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

test('append creates a missing ledger, surfaces conflicts without retry, and refuses a pinned ref', async () => {
  const missing = ghStub({ missing: true });
  await K.append({ gh: missing.gh, path: 'p.csv', row: rowOf({}) });
  const body = missing.calls[1][3];
  assert.equal(body.sha, undefined);
  assert.ok(Buffer.from(body.content, 'base64').toString('utf8').startsWith(CSV_HEAD));
  const racy = ghStub({ failFirstPut: true });
  await assert.rejects(K.append({ gh: racy.gh, path: 'p.csv', row: rowOf({}) }), /conflict/);
  assert.deepEqual(racy.calls.map(c => c[0]), ['get', 'req'], 'a conflict needs fresh user review, not an automatic second write');
  const pinned = ghStub(); pinned.gh.ref = sha40('a');
  await assert.rejects(K.append({ gh: pinned.gh, path: 'p.csv', row: rowOf({}) }), /branch/);
  const odd = ghStub({ text: 'date,path\n' });
  await assert.rejects(K.append({ gh: odd.gh, path: 'p.csv', row: rowOf({}) }), /header/);
  assert.equal(odd.calls.some(c => c[0] === 'req'), false);
});

test('a delayed confirmation cannot append before a newer observation through the single-file API', async () => {
  const newer = rowOf({ date: '2026-09-14T10:05:00Z' });
  const { gh, calls } = ghStub({ text: CSV_HEAD + K.line(newer) + '\n' });
  await assert.rejects(K.append({ gh, path: LEDGER, row: rowOf({}) }), /newer observation.*Refresh.*prepare/);
  assert.equal(calls.some(c => c[0] === 'req'), false, 'the reviewed timestamp is rejected before any write');
});

// The stub holds immutable files at the parent and publishes a complete tree
// only when the ref update succeeds. Failure tests inspect that published
// state rather than accepting success because the expected API was called.
function atomicStub({ ledger = CSV_HEAD, manifest = JSON.stringify(adoptionManifest()),
  moved = false, failAt = '', status = 500, missingShaAt = '', afterSnapshot = () => {} } = {}) {
  const calls = [], blobs = new Map(), trees = new Map();
  const parent = sha40('a'), baseTree = sha40('b'), newTree = sha40('c'), newCommit = sha40('d');
  const files = new Map([[LEDGER, ledger], [MANIFEST_PATH, manifest]]);
  let tipReads = 0, published = false;
  const gh = {
    ref: 'codex/adoption', repo: 'owner/work',
    async get(p, opts) {
      calls.push({ method: 'GET', path: p, ref: this.ref, repo: this.repo, cache: opts?.cache });
      assert.equal(this.ref, parent, 'every file read uses the captured commit, never a moving branch');
      if (failAt === 'read ' + p) throw Object.assign(new Error('read failed'), { status });
      const text = files.get(p);
      if (text === null) throw Object.assign(new Error('Not Found'), { status: 404 });
      return { text, sha: sha40('e') };
    },
    async req(p, opts = {}) {
      const method = opts.method || 'GET', body = opts.body ? JSON.parse(opts.body) : undefined;
      calls.push({ method, path: p, repo: this.repo, cache: opts.cache, body });
      const stage = method + ' ' + p;
      if (stage === failAt) throw Object.assign(new Error('write failed at ' + stage), { status });
      if (stage === missingShaAt) return {};
      if (p === 'git/ref/heads/codex/adoption') {
        tipReads++;
        if (tipReads === 2) afterSnapshot(gh);
        return { object: { sha: moved && tipReads > 1 ? sha40('f') : parent } };
      }
      if (p === 'git/commits/' + parent) return { tree: { sha: baseTree } };
      if (p === 'git/blobs' && method === 'POST') {
        const sha = sha40(String(blobs.size + 1));
        assert.equal(body.encoding, 'base64');
        blobs.set(sha, Buffer.from(body.content, 'base64').toString('utf8'));
        return { sha };
      }
      if (p === 'git/trees' && method === 'POST') {
        assert.equal(body.base_tree, baseTree);
        const next = new Map(files);
        for (const entry of body.tree) next.set(entry.path, blobs.get(entry.sha));
        trees.set(newTree, next);
        return { sha: newTree };
      }
      if (p === 'git/commits' && method === 'POST') {
        assert.deepEqual(body.parents, [parent]);
        assert.equal(body.tree, newTree);
        return { sha: newCommit };
      }
      if (p === 'git/refs/heads/codex/adoption' && method === 'PATCH') {
        assert.deepEqual(body, { sha: newCommit, force: false });
        for (const [key, value] of trees.get(newTree)) files.set(key, value);
        published = true;
        return { object: { sha: newCommit } };
      }
      throw new Error('Unexpected request: ' + stage);
    },
  };
  return { gh, calls, files, blobs, published: () => published,
    append: (over = {}) => K.append({ gh, path: LEDGER, manifestPath: MANIFEST_PATH, row: rowOf({}), ...over }) };
}

test('a delayed atomic confirmation leaves the newer ledger and pending adoption intact without writing Git objects', async () => {
  const newer = rowOf({ path: P + '/app/Profile.ps1', date: '2026-09-14T10:05:00Z' });
  const s = atomicStub({ ledger: CSV_HEAD + K.line(newer) + '\n' });
  const before = [...s.files];
  await assert.rejects(s.append(), /newer observation.*Refresh.*prepare/);
  assert.deepEqual([...s.files], before);
  assert.equal(s.published(), false);
  assert.ok(s.calls.every(c => c.method === 'GET'), 'date validation precedes blob, tree, commit and ref writes');
});

test('an observation at the same ledger timestamp remains appendable', async () => {
  const existing = rowOf({ path: P + '/app/Profile.ps1' });
  const s = atomicStub({ ledger: CSV_HEAD + K.line(existing) + '\n' });
  await s.append();
  assert.equal(s.published(), true);
  assert.deepEqual(K.observations(s.files.get(LEDGER)).map(r => r.date), [existing.date, existing.date]);
});

test('the first observation closes only its adoption entry in the same published commit', async () => {
  const other = { path: 'app/Forms/Bookmarks/Bookmarks.ps1', transfer: 'new', since: '2026-09-15', limit: 'Unrun' };
  const raw = { ...adoptionManifest([pendingEntry, other]), futureKey: { preserved: true } };
  const existing = rowOf({ path: P + '/app/Profile.ps1', blobSha: sha40('1') });
  const s = atomicStub({ manifest: JSON.stringify(raw), ledger: CSV_HEAD + K.line(existing) });
  const observed = rowOf({});
  const result = await s.append({ row: observed, message: 'Record the reviewed observation' });
  assert.equal(s.published(), true);
  assert.equal(result.adoptionClosed, true);
  assert.equal(result.commit, sha40('d'));
  assert.equal(result.sha, sha40('1'));
  assert.equal(result.line, K.line(observed));
  assert.equal(s.files.get(LEDGER), CSV_HEAD + K.line(existing) + '\n' + K.line(observed) + '\n');
  assert.deepEqual(JSON.parse(s.files.get(MANIFEST_PATH)), { ...raw, pending_adoption: [other] });
  const tree = s.calls.find(c => c.path === 'git/trees').body.tree;
  assert.deepEqual(tree.map(f => f.path), [LEDGER, MANIFEST_PATH]);
  assert.equal(s.calls.find(c => c.path === 'git/commits').body.message, 'Record the reviewed observation');
  assert.ok(s.calls.filter(c => c.method === 'GET').every(c => c.cache === 'no-store'));
  assert.equal(s.gh.ref, 'codex/adoption', 'snapshot reads leave the UI client on its selected branch');
  assert.equal(K.manifest(s.files.get(MANIFEST_PATH)).pendingAdoption.some(e => e.path === pendingEntry.path), false);
});

test('verified and differing observations also close adoption without claiming an install or runtime test', async () => {
  for (const exact of [true, false]) {
    const s = atomicStub();
    const observed = K.fromCheck({ path: FORMS, revision: sha40('a'), blobSha: sha40('2'),
      incomingSha256: sha64('f'), exact, source: 'paste' });
    await s.append({ row: observed });
    const rows = K.observations(s.files.get(LEDGER));
    const parsed = K.manifest(s.files.get(MANIFEST_PATH));
    const item = K.inventory({ tree, manifest: parsed, projectPath: P }).find(i => i.path === FORMS);
    assert.equal(parsed.pendingAdoption.length, 0);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].kind, 'installed');
    assert.equal(K.derive(item, rows).state, exact ? 'verified' : 'differs');
    assert.equal(rows[0].method, 'paste');
  }
});

test('a manifest without a matching pending entry stays byte-for-byte unchanged', async () => {
  const raw = JSON.stringify(adoptionManifest([{ ...pendingEntry, path: 'app/Modules/Other/Forms.psm1' }]), null, 4);
  const s = atomicStub({ manifest: raw });
  const result = await s.append();
  assert.equal(result.adoptionClosed, false);
  assert.equal(s.files.get(MANIFEST_PATH), raw);
  assert.equal(s.calls.find(c => c.path === 'git/trees').body.tree.length, 1);
});

test('a missing ledger can be created atomically while closing adoption', async () => {
  const s = atomicStub({ ledger: null });
  await s.append();
  assert.equal(s.files.get(LEDGER), CSV_HEAD + K.line(rowOf({})) + '\n');
  assert.deepEqual(JSON.parse(s.files.get(MANIFEST_PATH)).pending_adoption, []);
});

test('reading status and comparing a supplied copy perform no GitHub writes or adoption removal', () => {
  const s = atomicStub();
  const mfText = s.files.get(MANIFEST_PATH), ledger = s.files.get(LEDGER);
  const m = K.manifest(mfText), rows = K.observations(ledger);
  const all = K.inventory({ tree, manifest: m, projectPath: P });
  K.groups(all, m);
  K.summary(all.map(item => K.derive(item, rows)));
  const check = { path: FORMS, revision: sha40('a'), blobSha: sha40('2'), incomingSha256: sha64('f'), exact: true, source: 'paste' };
  K.fromCheck(check);
  assert.equal(K.isRecorded(check, rows), false);
  assert.equal(s.files.get(MANIFEST_PATH), mfText);
  assert.equal(s.files.get(LEDGER), ledger);
  assert.deepEqual(s.calls, []);
  assert.equal(s.published(), false);
});

test('same relative file in a different project never closes this project\'s adoption', async () => {
  const s = atomicStub();
  const result = await s.append({ row: rowOf({ path: 'projects/other/app/Modules/Forms/Forms.psm1' }) });
  assert.equal(result.adoptionClosed, false);
  assert.deepEqual(JSON.parse(s.files.get(MANIFEST_PATH)).pending_adoption, [pendingEntry]);
});

test('manifest and ledger read failures leave both published files untouched', async () => {
  const cases = [
    { manifest: '{broken' },
    { manifest: JSON.stringify({ ...adoptionManifest(), observations: 'some-other-ledger.csv' }) },
    { manifest: JSON.stringify({ ...adoptionManifest(), pending_adoption: {} }) },
    { ledger: 'date,path\n' },
    { failAt: 'read ' + LEDGER, status: 403 },
    { failAt: 'read ' + MANIFEST_PATH, status: 404 },
    { missingShaAt: 'GET git/ref/heads/codex/adoption' },
    { missingShaAt: 'GET git/commits/' + sha40('a') },
  ];
  for (const input of cases) {
    const s = atomicStub(input);
    const original = [...s.files];
    await assert.rejects(s.append());
    assert.equal(s.published(), false);
    assert.deepEqual([...s.files], original);
    assert.ok(s.calls.every(c => c.method === 'GET'), 'invalid input never reaches an object or branch write');
  }
});

test('failures at each object or ref write never publish half an adoption or silently retry', async () => {
  const stages = ['POST git/blobs', 'POST git/trees', 'POST git/commits', 'PATCH git/refs/heads/codex/adoption'];
  for (const failAt of stages) {
    for (const status of [409, 422, 500]) {
      const s = atomicStub({ failAt, status });
      const original = [...s.files];
      await assert.rejects(s.append(), /write failed/);
      assert.equal(s.published(), false);
      assert.deepEqual([...s.files], original);
      assert.equal(s.calls.filter(c => c.method + ' ' + c.path === failAt).length, 1, failAt + ' is never retried');
    }
  }
  for (const missingShaAt of stages.slice(0, -1)) {
    const s = atomicStub({ missingShaAt });
    await assert.rejects(s.append(), /no sha/);
    assert.equal(s.published(), false);
    assert.equal(s.calls.some(c => c.method === 'PATCH'), false);
  }
});

test('a moved branch refuses publication instead of rebuilding stale ledger bytes on the new tip', async () => {
  const s = atomicStub({ moved: true });
  const original = [...s.files];
  await assert.rejects(s.append(), /branch moved.*Reload/);
  assert.equal(s.published(), false);
  assert.deepEqual([...s.files], original);
  assert.equal(s.calls.filter(c => c.method === 'POST' && c.path === 'git/commits').length, 1);
  assert.equal(s.calls.some(c => c.method === 'PATCH'), false);
});

test('navigation during an append cannot redirect the captured repository or branch write', async () => {
  const s = atomicStub({ afterSnapshot: gh => { gh.ref = 'main'; gh.repo = 'owner/other'; } });
  await s.append();
  assert.equal(s.gh.ref, 'main');
  assert.equal(s.gh.repo, 'owner/other');
  assert.ok(s.calls.every(c => c.repo === 'owner/work'));
  assert.equal(s.calls.find(c => c.method === 'PATCH').path, 'git/refs/heads/codex/adoption');
});
