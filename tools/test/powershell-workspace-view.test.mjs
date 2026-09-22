// Real Alpine bindings over the workspace, language, diff, installation and
// correspondence kits. GitHub and browser storage are observable boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { makeWindow, captureAlpineErrors, tick } from './bootstrap.mjs';

const P = 'projects/wps', REPO = 'example/estate', REV = 'a'.repeat(40), TREE = 'b'.repeat(40);
const NEXT = 'c'.repeat(40), PUBLISHED = 'd'.repeat(40);
const A = `${P}/app/Forms/Report/Report.ps1`, X = `${P}/app/Forms/Report/Report.xaml`;
const B = `${P}/app/Modules/Utility/Utility.psm1`, C = `${P}/app/Scripts/Search.ps1`;
const ORIGINAL = '\ufefffunction Get-Report {\r\n    param([string]$Name)\r\n    "héllo 🌳"\r\n}\r\n';
const gitBlob = text => createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const { window, problems } = makeWindow();
Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
window.Alpine = Alpine; captureAlpineErrors(Alpine);
for (const file of ['kits/installation.js', 'kits/powershell-workspace.js', 'kits/powershell-language.js', 'kits/powershell-editor.js', 'kits/text-diff.js', 'kits/file-correspondence.js', 'alpineComponents/powershell-workspace.js']) {
  new window.Function(readFileSync(new URL('../../lib/' + file, import.meta.url), 'utf8'))();
}
const editorTools = window.PowerShellEditor;
Alpine.store('browser', { repo: REPO, ref: 'main', stage: [] });
Alpine.store('toast', () => {});
Alpine.start();
await tick(3);

async function until(predicate, message) {
  for (let i = 0; i < 200; i++) { if (predicate()) return; await tick(1); }
  assert.fail(message);
}
const mounted = new Set();
function unmount(view) {
  if (!mounted.has(view)) return;
  Alpine.mutateDom(() => { Alpine.destroyTree(view.el); view.el.remove(); });
  mounted.delete(view);
}
test.afterEach(async () => {
  for (const view of [...mounted]) unmount(view);
  await tick(3);
  assert.deepEqual(problems.splice(0), [], 'Alpine must not emit expression or teardown errors');
});

function fixture(options = {}) {
  const files = { [A]: ORIGINAL, [X]: '<Window><Button x:Name="Save"/></Window>\n',
    [B]: "function Get-Utility { 'search needle' }\n", [C]: "# search needle\nWrite-Output 'another needle'\n" };
  const manifest = JSON.stringify({ root: 'Documents\\WindowsPowerShell',
    correspondence: [{ repo: 'app/Forms/', area: 'Forms', installs: 'Forms/' },
      { repo: 'app/Modules/', area: 'Modules', installs: 'Modules/' }, { repo: 'app/Scripts/', area: 'Scripts', installs: 'Scripts/' }] });
  const calls = [], writes = [], storage = new Map(), copies = [], downloads = [], routes = [], editorCalls = [];
  const gates = new Map();
  const state = { revision: REV, failPut: false, failDelete: false, allowWrites: false, createdBranches: new Set(),
    create: options.create || (async () => { throw new Error('Editor assets could not load. The plain text editor is available.'); }) };
  const tree = () => Object.entries(files).map(([path, text]) => ({ path, type: 'blob', mode: '100644', sha: gitBlob(text), size: Buffer.byteLength(text) }));
  const collection = name => {
    if (!storage.has(name)) storage.set(name, new Map());
    const records = storage.get(name);
    return {
      async find(predicate) { return [...records.values()].filter(predicate).map(clone); },
      async put(record) {
        if (gates.has('storage:put')) await gates.get('storage:put').promise;
        if (state.failPut) throw new Error('Browser storage is full');
        const value = clone({ ...record, id: record.id || `record-${records.size + 1}` }); records.set(value.id, value); return clone(value);
      },
      async delete(id) {
        if (gates.has('storage:delete')) await gates.get('storage:delete').promise;
        if (state.failDelete) throw new Error('Browser storage is unavailable');
        records.delete(id);
      },
    };
  };
  window.persistence = { collection };
  window.GH = class {
    constructor({ repo }) { this.repo = repo; this.ref = 'main'; }
    async get(path) {
      calls.push({ method: 'GET', path: 'contents/' + path, ref: this.ref });
      if (gates.has('contents/' + path)) await gates.get('contents/' + path).promise;
      const text = path === `${P}/data/installation.json` ? manifest : files[path];
      if (text === undefined) throw new Error('Unexpected source path: ' + path);
      return { text, sha: gitBlob(text) };
    }
    async req(path, opts = {}) {
      const method = opts.method || 'GET'; calls.push({ method, path, ref: this.ref });
      if (method !== 'GET') {
        const body = JSON.parse(opts.body); writes.push({ method, path, body });
        if (!state.allowWrites) throw new Error('Unexpected GitHub write');
        if (path === 'git/trees') return { sha: 'e'.repeat(40) };
        if (path === 'git/commits') return { sha: PUBLISHED };
        if (path === 'git/refs') { state.createdBranches.add(body.ref.slice('refs/heads/'.length)); return { ref: body.ref, object: { sha: body.sha } }; }
        throw new Error('Unexpected GitHub write: ' + path);
      }
      if (gates.has(path)) await gates.get(path).promise;
      if (path === 'commits/main' || path === 'commits/review') return { sha: state.revision };
      if (path === '') return { default_branch: 'main' };
      if (path.startsWith('git/commits/')) return { sha: path.slice('git/commits/'.length), tree: { sha: TREE } };
      if (path.startsWith('git/ref/heads/')) {
        if (state.createdBranches.has(path.slice('git/ref/heads/'.length))) return { object: { sha: PUBLISHED } };
        const error = new Error('Not found'); error.status = 404; throw error;
      }
      if (path.startsWith('git/trees/')) return { sha: TREE, tree: tree() };
      if (path.startsWith('git/blobs/')) {
        const sha = path.slice('git/blobs/'.length), text = Object.values(files).find(t => gitBlob(t) === sha);
        if (text === undefined) throw new Error('Unexpected blob: ' + sha);
        return { sha, encoding: 'base64', content: Buffer.from(text).toString('base64') };
      }
      if (path.startsWith('commits?path=')) return [{ sha: state.revision, html_url: 'https://github.com/example/estate/commit/' + state.revision, commit: { message: 'Update report\n\nDetail', author: { date: '2026-09-22T00:00:00Z' } } }];
      if (path.startsWith('commits?')) return [{ sha: state.revision }];
      throw new Error('Unexpected GitHub request: ' + path);
    }
  };
  window.GH.FRESH = { cache: 'no-store' };
  window.PowerShellEditor = { ...editorTools, async create(host, config) { editorCalls.push({ host, config }); return state.create(host, config); } };
  // The correspondence kit's Stage intake boundary returns plain staged items;
  // it does not bypass the kit's pinned reads, hashes, or persistence.
  let stageId = 0;
  window.StageIntake = {
    textItem: (name, text) => ({ local: true, id: 'local-' + ++stageId, name, text }),
    keyOf: item => item.local ? 'local:' + item.id : `${item.repo}@${item.ref}:${item.path}`,
  };
  window.__shell = { installationItem: A, syncUrl: () => routes.push(['sync']), goProject: (...args) => routes.push(args) };
  window.io = { save: (value, name) => downloads.push({ value: clone(value), name }) };
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: async value => copies.push(value) } });
  Alpine.store('browser', { repo: REPO, ref: 'main', stage: [], stageCompare: null });
  const records = name => [...(storage.get(name)?.values() || [])];
  return { files, calls, writes, storage, copies, downloads, routes, editorCalls, state, gates, records,
    async mount({ wait = true } = {}) {
      const el = window.document.createElement('div');
      el.setAttribute('x-data', `powershellWorkspace({path:'${P}', installation:'${P}/data/installation.json'})`);
      Alpine.mutateDom(() => window.document.body.append(el));
      Alpine.initTree(el);
      const view = { el, data: Alpine.$data(el) }; mounted.add(view);
      if (wait) { await until(() => !view.data.loading && !view.data.opening && !!view.data.active, 'Workspace did not finish opening: ' + view.data.error); await tick(3); }
      return view;
    },
  };
}
function input(view, label, value) {
  const el = view.el.querySelector(`[aria-label="${label}"]`);
  assert.ok(el, 'Input exists: ' + label);
  el.value = value; el.dispatchEvent(new window.Event('input', { bubbles: true }));
  return el;
}
function button(view, text, scope = view.el) {
  const found = [...scope.querySelectorAll('button')].find(el => el.textContent.trim() === text);
  assert.ok(found, 'Button exists: ' + text); return found;
}
const bundleEvent = value => ({ target: { files: [{ text: async () => typeof value === 'string' ? value : JSON.stringify(value) }], value: 'chosen.json' } });

test('mount renders the manifest tree, exact source identity, companion and real outline', async () => {
  const f = fixture(), v = await f.mount(), d = v.data;
  assert.equal(d.repo, REPO); assert.equal(d.revision, REV); assert.equal(d.doc.baseText, ORIGINAL); assert.equal(d.doc.text, ORIGINAL);
  assert.equal(d.companion, X);
  assert.ok(v.el.querySelector('[data-powershell-workspace]'));
  assert.match(v.el.textContent, /Modules/);
  assert.equal(d.analysis.symbols.find(s => s.name === 'Get-Report').line, 1);
  assert.equal(v.el.querySelector('a[href*="/blob/"]').getAttribute('href'), `https://github.com/${REPO}/blob/${REV}/${A}`);
  assert.equal(f.records('wpsWorkspace.drafts').length, 0, 'Opening exact source creates no draft');
  assert.deepEqual(f.writes, []);
});

test('explorer filters and tree selection are driven by rendered Alpine bindings', async () => {
  const f = fixture(), v = await f.mount();
  input(v, 'Find file', 'Utility'); await tick(3);
  assert.deepEqual(clone(v.data.visibleGroups).flatMap(g => g.files.map(it => it.path)), [B]);
  const file = [...v.el.querySelectorAll('aside button')].find(el => el.textContent.includes('Utility.psm1'));
  file.click(); await until(() => v.data.active === B, 'Tree selection did not open the module');
  assert.equal(v.data.doc.text, f.files[B]);
  assert.equal(v.el.querySelector('[role="tab"][aria-selected="true"]').textContent, 'Utility.psm1');
  assert.deepEqual(f.writes, []);
});

test('a slower file response cannot replace the last selected file or create a stale tab', async () => {
  const f = fixture(), v = await f.mount(), gate = deferred();
  const address = 'git/blobs/' + gitBlob(f.files[B]); f.gates.set(address, gate);
  const older = v.data.open(B);
  await until(() => f.calls.some(c => c.path === address), 'Delayed source request did not start');
  await v.data.open(C); gate.resolve(); await older; await tick(3);
  assert.equal(v.data.active, C); assert.equal(v.data.doc.text, f.files[C]);
  assert.ok(!v.data.docs.some(d => d.path === B), 'Stale source does not become an open tab');
});

test('editor failure leaves a usable textarea and saves edits under the correct document identity', async () => {
  const f = fixture(), v = await f.mount();
  assert.equal(v.data.editorReady, false); assert.match(v.data.editorError, /plain text editor/);
  const displayed = ORIGINAL.replace(/\r\n/g, '\n') + '# typed in fallback\nfunction Get-Fallback {}\n';
  const text = ORIGINAL + '# typed in fallback\r\nfunction Get-Fallback {}\r\n';
  const field = input(v, 'PowerShell source', displayed); await tick(3);
  assert.equal(field.readOnly, false); assert.notEqual(field.style.display, 'none');
  await until(() => f.records('wpsWorkspace.drafts')[0]?.text === text, 'Typed fallback text was not saved');
  assert.equal(v.data.doc.baseText, ORIGINAL); assert.equal(v.data.doc.text, text);
  assert.equal(f.records('wpsWorkspace.drafts')[0].path, A);
  assert.equal(v.data.analysis.symbols.find(s => s.name === 'Get-Fallback').line, 6);
});

test('multiple edited tabs survive unmount and restore with exact BOM, Unicode and separators', async () => {
  const f = fixture(), v = await f.mount();
  const aText = ORIGINAL + '# first draft\r\n', bText = "\ufefffunction Get-Utility { 'ändrad' }\r\n";
  v.data.edit(aText); await v.data.open(B); v.data.edit(bText);
  await until(() => f.records('wpsWorkspace.drafts').length === 2, 'Both file drafts were not stored');
  await v.data.open(A); assert.equal(v.data.doc.text, aText);
  v.data.close(A); assert.equal(v.data.active, A); assert.match(v.data.notice, /browser draft/);
  unmount(v); const restored = await f.mount();
  assert.equal(restored.data.doc.text, aText); await restored.data.open(B); assert.equal(restored.data.doc.text, bText);
  assert.equal(restored.data.doc.baseText, f.files[B]);
  assert.equal(restored.data.dirtyDocs.length, 2); assert.deepEqual(f.writes, []);
});

test('stored drafts stay isolated from another repository ref', async () => {
  const f = fixture(), v = await f.mount(); v.data.edit('# main-only draft');
  await until(() => f.records('wpsWorkspace.drafts').length === 1, 'Draft was not saved');
  unmount(v); Alpine.store('browser').ref = 'review';
  const other = await f.mount(); assert.equal(other.data.ref, 'review'); assert.equal(other.data.doc.text, ORIGINAL);
  assert.equal(other.data.dirtyDocs.length, 0); assert.equal(f.records('wpsWorkspace.drafts').length, 1);
});

test('copy, download, search and supplied-copy checks make no GitHub writes or installation claims', async () => {
  const f = fixture(), v = await f.mount();
  await v.data.copyDraft(); v.data.downloadDraft();
  assert.equal(f.copies[0], ORIGINAL); assert.equal(f.downloads[0].value, ORIGINAL);
  v.data.searchText = 'needle'; await v.data.search();
  assert.deepEqual(clone(v.data.searchResults).map(h => [h.path, h.line]), [[B, 1], [C, 1], [C, 2]]);
  const copy = ORIGINAL.replace('héllo', 'local version'); v.data.localText = copy; await v.data.compareCopy(); await tick(3);
  assert.equal(v.data.localCheck.content, copy); assert.equal(v.data.localCheck.path, A); assert.equal(v.data.localCheck.revision, REV);
  assert.equal(v.data.localCheck.incomingSha256, createHash('sha256').update(copy).digest('hex'));
  assert.equal(v.data.localCheck.exact, false); assert.match(v.data.localCheck.installation, /not inspected/);
  assert.equal(v.data.doc.text, ORIGINAL, 'Comparing does not edit the draft');
  assert.equal(f.records('wpsCorrespondence.checks').length, 1); assert.equal(f.records('wpsWorkspace.drafts').length, 0);
  assert.equal(Alpine.store('browser').stage.length, 2, 'Existing correspondence flow stages the comparison pair');
  assert.deepEqual(f.writes, []);
});

test('search reads browser drafts and symbol navigation uses the fallback line address', async () => {
  const f = fixture(), v = await f.mount();
  input(v, 'PowerShell source', 'one\nfunction Get-UniqueNeedle {}\nthree');
  v.data.searchText = 'UniqueNeedle'; await v.data.search();
  assert.deepEqual(clone(v.data.searchResults).map(h => [h.path, h.line]), [[A, 2]]);
  v.data.goLine(2); await tick(3);
  assert.equal(v.el.querySelector('[aria-label="PowerShell source"]').selectionStart, 4, 'Line 2 begins after the preceding newline');
});

test('an asynchronously loaded local file cannot attach to a different selection', async () => {
  const f = fixture(), v = await f.mount(), gate = deferred();
  const pending = v.data.loadCopy({ name: 'Report.ps1', arrayBuffer: () => gate.promise }, 'file picker');
  await v.data.open(B); gate.resolve(new TextEncoder().encode('stale supplied copy').buffer); await pending;
  assert.equal(v.data.active, B); assert.equal(v.data.localText, ''); assert.equal(v.data.localCheck, null);
  assert.equal(f.records('wpsCorrespondence.checks').length, 0);
});

test('returning to the same file cannot resurrect a copy from an earlier selection', async () => {
  const f = fixture(), v = await f.mount(), gate = deferred();
  const pending = v.data.loadCopy({ name: 'Report.ps1', arrayBuffer: () => gate.promise }, 'file picker');
  await v.data.open(B); await v.data.open(A); v.data.localText = 'newer supplied copy';
  gate.resolve(new TextEncoder().encode('older supplied copy').buffer); await pending;
  assert.equal(v.data.localText, 'newer supplied copy'); assert.equal(v.data.localCheck, null);
  assert.equal(f.records('wpsCorrespondence.checks').length, 0);
});

test('review is read-only and invalid publication inputs cannot create GitHub objects', async () => {
  const f = fixture(), v = await f.mount(); v.data.edit(ORIGINAL + '# reviewed draft\r\n');
  await v.data.reviewPublish(); await tick(3);
  assert.equal(v.data.publishOpen, true); assert.equal(v.data.pane, 'diff'); assert.equal(f.writes.length, 0);
  input(v, 'New branch', 'main'); input(v, 'Commit message', 'Update report'); await tick(3);
  button(v, 'Create branch and commit').click(); await until(() => /Not published/.test(v.data.error), 'Invalid branch was not rejected');
  assert.match(v.data.error, /new feature branch/); assert.equal(v.data.publishOpen, true); assert.equal(v.data.publishing, false);
  input(v, 'New branch', 'wps/valid'); input(v, 'Commit message', '   '); await tick(3);
  assert.equal(button(v, 'Create branch and commit').disabled, true);
  await v.data.publish(); assert.match(v.data.error, /commit message is required/);
  assert.equal(v.data.dirtyDocs.length, 1); assert.deepEqual(f.writes, []);
});

test('teardown rejects late source/editor completions and removes unload handling', async () => {
  const f = fixture(), gate = deferred(), source = 'git/blobs/' + gitBlob(f.files[A]); f.gates.set(source, gate);
  const v = await f.mount({ wait: false });
  await until(() => f.calls.some(c => c.path === source), 'Source request never began');
  unmount(v); gate.resolve(); await tick(5);
  assert.equal(v.data.active, ''); assert.equal(v.data.docs.length, 0);
  const editorGate = deferred(); let destroyed = 0; f.gates.delete(source); f.state.create = () => editorGate.promise;
  const next = await f.mount(); unmount(next);
  editorGate.resolve({ destroy() { destroyed++; } }); await tick(3);
  assert.equal(destroyed, 1, 'An editor that loads after teardown must be disposed');
  next.data.saveState = 'Saving…';
  const unload = new window.Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload);
  assert.equal(unload.defaultPrevented, false, 'Destroyed view no longer intercepts unload');
});

test('export, restore-base confirmation, and reviewed import preserve exact drafts', async () => {
  const f = fixture(), v = await f.mount(), edited = ORIGINAL + '# export this draft\r\n';
  v.data.edit(edited); await v.data.persist(v.data.doc);
  v.data.exportDrafts(); const exported = JSON.parse(f.downloads.at(-1).value);
  assert.equal(exported.format, 'web-tools-powershell-drafts'); assert.equal(exported.drafts[0].text, edited);
  assert.equal(exported.drafts[0].baseText, ORIGINAL); assert.equal(exported.storage, 'browser-local');
  v.data.confirmation = 'discard'; await tick(3);
  assert.equal(v.data.doc.text, edited, 'Showing the discard confirmation does not discard');
  assert.equal(f.records('wpsWorkspace.drafts').length, 1);
  await v.data.confirmAction(); await tick(3);
  assert.equal(v.data.doc.text, ORIGINAL); assert.equal(v.data.dirtyDocs.length, 0);
  assert.equal(f.records('wpsWorkspace.drafts').length, 0);
  await v.data.previewImport(bundleEvent(exported)); await tick(3);
  assert.ok(v.data.importBundle); assert.equal(v.data.doc.text, ORIGINAL);
  assert.equal(f.records('wpsWorkspace.drafts').length, 0, 'Import preview does not write drafts');
  await v.data.restoreImport(); await tick(3);
  assert.equal(v.data.doc.text, edited); assert.equal(v.data.doc.baseText, ORIGINAL); assert.equal(v.data.importBundle, null);
  assert.equal(f.records('wpsWorkspace.drafts')[0].text, edited); assert.deepEqual(f.writes, []);
});

test('new files are browser-only and discard removes their draft, tab, and explorer entry', async () => {
  const f = fixture(), v = await f.mount(), path = `${P}/app/Scripts/New.ps1`;
  v.data.newPath = path; await v.data.newFile();
  assert.equal(v.data.active, path); assert.equal(v.data.doc.baseBlob, ''); assert.equal(v.data.dirtyDocs.length, 1);
  assert.equal(f.records('wpsWorkspace.drafts')[0].path, path);
  v.data.exportDrafts(); const bundle = JSON.parse(f.downloads.at(-1).value); assert.equal(bundle.drafts[0].baseText, '');
  v.data.confirmation = 'discard'; await v.data.confirmAction(); await tick(3);
  assert.ok(!v.data.items.some(it => it.path === path)); assert.ok(!v.data.docs.some(d => d.path === path));
  assert.equal(f.records('wpsWorkspace.drafts').length, 0); assert.equal(v.data.active, A);
  await v.data.previewImport(bundleEvent(bundle)); await v.data.restoreImport();
  assert.equal(v.data.active, path); assert.equal(v.data.doc.text, bundle.drafts[0].text); assert.deepEqual(f.writes, []);
});

test('import rejects another ref and conflicting drafts, including edits after import review', async () => {
  const f = fixture(), v = await f.mount(); v.data.edit(ORIGINAL + '# bundle'); await v.data.persist(v.data.doc);
  v.data.exportDrafts(); const bundle = JSON.parse(f.downloads.at(-1).value);
  v.data.edit(ORIGINAL + '# newer browser draft'); await v.data.persist(v.data.doc);
  await v.data.previewImport(bundleEvent(bundle));
  assert.match(v.data.error, /different drafts/); assert.equal(v.data.importBundle, null);
  const another = clone(bundle); another.ref = 'review'; another.drafts.forEach(d => { d.ref = 'review'; delete d.id; });
  await v.data.previewImport(bundleEvent(another)); assert.match(v.data.error, /another repository workspace or ref/);
  v.data.confirmation = 'discard'; await v.data.confirmAction(); await v.data.previewImport(bundleEvent(bundle));
  assert.ok(v.data.importBundle);
  v.data.edit(ORIGINAL + '# changed after review'); await v.data.persist(v.data.doc); await v.data.restoreImport();
  assert.match(v.data.error, /changed after import review/); assert.equal(v.data.doc.text, ORIGINAL + '# changed after review');
  assert.equal(f.records('wpsWorkspace.drafts')[0].text, v.data.doc.text); assert.deepEqual(f.writes, []);
});

test('upstream conflict blocks publication until the user accepts the current base', async () => {
  const f = fixture(), v = await f.mount(), draft = ORIGINAL + '# local work\r\n', upstream = ORIGINAL.replace('Get-Report', 'Get-UpstreamReport');
  v.data.edit(draft); await v.data.persist(v.data.doc);
  f.files[A] = upstream; f.state.revision = NEXT;
  await v.data.reviewPublish();
  assert.equal(v.data.doc.text, draft); assert.equal(v.data.doc.baseText, ORIGINAL); assert.equal(v.data.doc.currentText, upstream);
  assert.equal(v.data.statusOf(v.data.doc).state, 'conflict'); assert.equal(v.data.revision, NEXT);
  v.data.publishBranch = 'wps/reviewed-report'; await v.data.publish();
  assert.match(v.data.error, /accept the current base/); assert.deepEqual(f.writes, []);
  v.data.diffAgainst = 'current'; v.data.buildDiff();
  assert.ok(v.data.diffRows.some(r => r.type === 'del' && r.text.includes('Get-UpstreamReport')));
  v.data.confirmation = 'rebase'; await v.data.confirmAction();
  assert.equal(v.data.doc.baseRevision, NEXT); assert.equal(v.data.doc.baseBlob, gitBlob(upstream));
  assert.equal(v.data.doc.baseText, upstream); assert.equal(v.data.doc.text, draft);
  assert.equal(v.data.statusOf(v.data.doc).state, 'draft');
  assert.equal(f.records('wpsWorkspace.drafts')[0].baseText, upstream);
  f.state.allowWrites = true; await v.data.publish(); await tick(3);
  assert.deepEqual(f.writes.map(w => w.path), ['git/trees', 'git/commits', 'git/refs']);
  assert.equal(f.writes[0].body.tree[0].content, draft); assert.deepEqual(f.writes[1].body.parents, [NEXT]);
  assert.equal(f.writes[2].body.ref, 'refs/heads/wps/reviewed-report');
  assert.equal(v.data.published.revision, PUBLISHED); assert.equal(v.data.publishOpen, false);
  assert.ok(v.el.querySelector(`a[href="https://github.com/${REPO}/tree/wps%2Freviewed-report"]`));
  assert.equal(v.data.dirtyDocs.length, 1, 'Publishing retains the browser draft');
  assert.equal(f.records('wpsWorkspace.drafts')[0].text, draft); assert.match(v.data.notice, /installation remains unrecorded/);
});

test('a removed upstream file stays a visible conflict and cannot be published by accident', async () => {
  const f = fixture(), v = await f.mount(); v.data.edit(ORIGINAL + '# local draft'); await v.data.persist(v.data.doc);
  delete f.files[A]; f.state.revision = NEXT;
  await v.data.reviewPublish(); assert.equal(v.data.doc.currentText, null);
  assert.match(v.data.statusOf(v.data.doc).label, /removed/); assert.ok(v.data.items.some(it => it.path === A));
  await v.data.publish(); assert.match(v.data.error, /accept the current base/); assert.deepEqual(f.writes, []);
  assert.equal(v.data.doc.text, ORIGINAL + '# local draft');
});

test('storage failures retain editable text, block dirty-tab close, and keep export available', async () => {
  const f = fixture(), v = await f.mount(); f.state.failPut = true;
  const text = ORIGINAL + '# unsaved text'; v.data.edit(text); await v.data.persist(v.data.doc);
  assert.match(v.data.error, /not saved/); assert.equal(f.records('wpsWorkspace.drafts').length, 0);
  await v.data.open(B); v.data.close(A); assert.ok(v.data.docs.some(d => d.path === A && d.text === text));
  const unload = new window.Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload);
  assert.equal(unload.defaultPrevented, true, 'Another tab does not hide an unsaved-file unload warning');
  v.data.exportDrafts(); assert.equal(JSON.parse(f.downloads.at(-1).value).drafts[0].text, text);
  f.state.failPut = false; await v.data.open(A); await v.data.persist(v.data.doc);
  const safeUnload = new window.Event('beforeunload', { cancelable: true }); window.dispatchEvent(safeUnload);
  assert.equal(safeUnload.defaultPrevented, false); assert.equal(f.records('wpsWorkspace.drafts')[0].text, text);
});

test('failed draft removal leaves edited content intact for recovery', async () => {
  const f = fixture(), v = await f.mount(); const text = ORIGINAL + '# keep me'; v.data.edit(text); await v.data.persist(v.data.doc);
  f.state.failDelete = true; v.data.confirmation = 'discard'; await v.data.confirmAction();
  assert.match(v.data.error, /Could not remove browser draft/); assert.equal(v.data.doc.text, text);
  assert.equal(f.records('wpsWorkspace.drafts')[0].text, text); assert.equal(v.data.confirmation, 'discard');
});

test('a failed browser save survives internal workspace navigation', async () => {
  const f = fixture(), v = await f.mount(); f.state.failPut = true;
  const text = ORIGINAL + '# survives route changes'; v.data.edit(text); await v.data.persist(v.data.doc);
  Alpine.destroyTree(v.el); v.el.remove(); mounted.delete(v);
  const restored = await f.mount();
  assert.equal(restored.data.doc.text, text);
  assert.match(restored.data.notice, /Recovered drafts/);
  const unload = new window.Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload);
  assert.equal(unload.defaultPrevented, true);
  f.state.failPut = false; await restored.data.persist(restored.data.doc);
  assert.equal(f.records('wpsWorkspace.drafts')[0].text, text);
  assert.equal(window.PowerShellWorkspace.recoveryDrafts({ repo: REPO, project: P, ref: 'main' }).length, 0);
});

test('an opening file keeps its captured revision when a GitHub check finishes first', async () => {
  const f = fixture(), v = await f.mount(), gate = deferred();
  const address = 'git/blobs/' + gitBlob(f.files[B]); f.gates.set(address, gate);
  const opening = v.data.open(B);
  await until(() => f.calls.some(c => c.path === address), 'Source request did not start');
  f.state.revision = NEXT;
  await v.data.refreshUpstream();
  assert.equal(v.data.revision, NEXT);
  gate.resolve(); await opening;
  assert.equal(v.data.doc.baseRevision, REV);
  assert.equal(v.data.doc.baseText, f.files[B]);
  assert.ok(v.data.fileUrl.includes('/blob/' + REV + '/'));
});

test('restoring an imported draft locks editing and document mutation until storage completes', async () => {
  const f = fixture(), v = await f.mount(), edited = ORIGINAL + '# imported';
  const bundle = window.PowerShellWorkspace.exportBundle({ repo: REPO, project: P, ref: 'main', revision: REV, drafts: [{ ...clone(v.data.doc), text: edited }] });
  await v.data.previewImport(bundleEvent(bundle));
  const gate = deferred(); f.gates.set('storage:put', gate);
  const restoring = v.data.restoreImport(); await tick(3);
  assert.equal(v.data.changingDraft, true);
  assert.equal(v.el.querySelector('[aria-label="PowerShell source"]').readOnly, true);
  v.data.edit(ORIGINAL + '# concurrent edit');
  await v.data.open(B); v.data.close(A);
  v.data.confirmation = 'discard'; await v.data.confirmAction();
  assert.equal(v.data.doc.text, ORIGINAL);
  assert.equal(v.data.active, A);
  gate.resolve(); await restoring;
  assert.equal(v.data.doc.text, edited);
  assert.equal(v.data.changingDraft, false);
  assert.equal(f.records('wpsWorkspace.drafts')[0].text, edited);
});

test('a GitHub check completing after teardown cannot save over the reopened draft', async () => {
  const f = fixture(), v = await f.mount();
  v.data.edit(ORIGINAL + '# older'); await v.data.persist(v.data.doc);
  const gate = deferred(); f.gates.set('commits/main', gate);
  const refreshing = v.data.refreshUpstream(); await tick(2);
  unmount(v); f.gates.delete('commits/main');
  const reopened = await f.mount(), latest = ORIGINAL + '# newest in reopened workspace';
  reopened.data.edit(latest); await reopened.data.persist(reopened.data.doc);
  gate.resolve(); await refreshing;
  assert.equal(f.records('wpsWorkspace.drafts')[0].text, latest);
  assert.equal(reopened.data.doc.text, latest);
});
