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

test('received copies open Compare against the captured base without editing the browser draft', async () => {
  const f = fixture(), v = await f.mount();
  const intake = v.data.captureIntake(), incoming = '# @file ' + A + '\r\n' + ORIGINAL;
  f.state.revision = NEXT;
  assert.equal(await intake.receive(intake.selected, incoming, { source: 'clipboard', name: 'Report.ps1' }), true);
  assert.equal(v.data.pane, 'diff'); assert.equal(v.data.diffAgainst, 'local');
  assert.equal(v.data.localCheck.content, incoming); assert.equal(v.data.doc.text, ORIGINAL);
  assert.ok(f.calls.some(c => c.path === 'commits?sha=' + REV + '&per_page=1'), 'Comparison must request the document base, not current main');
  assert.equal(f.records('wpsWorkspace.drafts').length, 0);
  assert.equal(v.el.querySelector('[aria-label="Supplied local copy"]'), null);
  assert.deepEqual(f.writes, []);
});

test('the workspace receiver rethrows the retained comparison error unchanged for app recovery', async () => {
  const f = fixture(), v = await f.mount();
  const retained = Object.assign(new Error('Pinned source is unavailable'), { retained: true, pendingSaved: true });
  const open = window.FileCorrespondence.open;
  window.FileCorrespondence.open = async () => { throw retained; };
  try {
    const intake = v.data.captureIntake();
    await assert.rejects(intake.receive(intake.selected, 'incoming copy'), error => {
      assert.equal(error, retained, 'The app must receive the original recovery flags and error identity');
      assert.equal(error.retained, true); assert.equal(error.pendingSaved, true);
      return true;
    });
    assert.equal(v.data.error, retained.message); assert.equal(v.data.comparing, false);
    assert.equal(v.data.doc.text, ORIGINAL); assert.deepEqual(f.writes, []);
  } finally { window.FileCorrespondence.open = open; }
});

test('a failed new receive makes the previous comparison unadoptable during and after the request', async () => {
  const f = fixture(), v = await f.mount(), previous = ORIGINAL + '# previous copy';
  let intake = v.data.captureIntake();
  await intake.receive(intake.selected, previous);
  assert.equal(v.data.localCheck.content, previous);
  v.data.confirmation = 'local';
  const gate = deferred(), incoming = ORIGINAL + '# newly received copy';
  f.gates.set('storage:put', gate); f.state.failPut = true;
  intake = v.data.captureIntake();
  const receiving = intake.receive(intake.selected, incoming);
  const rejected = assert.rejects(receiving, error => {
    assert.equal(error.retained, true); assert.equal(error.pendingSaved, false);
    assert.match(error.message, /Browser storage is full/);
    return true;
  });
  try {
    await tick(3);
    assert.equal(v.data.comparing, true);
    assert.equal(v.data.localCheck, null); assert.equal(v.data.doc.localCheck, null);
    assert.equal(v.data.confirmation, '', 'Receiving clears the earlier adoption confirmation');
    assert.equal(button(v, 'Use as draft…').disabled, true);
    assert.deepEqual([...v.data.diffRows], [], 'The old comparison no longer remains on screen');
    v.data.confirmation = 'local'; await v.data.confirmAction();
    assert.equal(v.data.doc.text, ORIGINAL, 'An already queued confirmation cannot adopt the old copy');
    gate.resolve(); await rejected; await tick(3);
    assert.equal(v.data.comparing, false);
    assert.equal(v.data.localCheck, null); assert.equal(v.data.doc.localCheck, null);
    v.data.confirmation = 'local'; await v.data.confirmAction();
    assert.equal(v.data.doc.text, ORIGINAL, 'A failed receive cannot revive the old copy for adoption');
    assert.equal(f.records('wpsWorkspace.drafts').length, 0);
    assert.equal(f.records('wpsCorrespondence.checks').length, 1, 'The previous historical check is preserved');
    assert.ok(Alpine.store('browser').stage.some(item => item.local && item.text === incoming), 'The failed copy remains available for app Stage recovery');
    assert.deepEqual(f.writes, []);
  } finally { gate.resolve(); await rejected; }
});

test('paste context expires when the explorer clears selection or the same file is reopened', async () => {
  const f = fixture(), v = await f.mount();
  const old = v.data.captureIntake();
  v.data.active = '';
  assert.equal(v.data.captureIntake().selected, null, 'The previous installationItem is not an active document');
  assert.equal(old.isCurrent(), false);
  await assert.rejects(old.receive(old.selected, 'incoming'), /open file changed/);
  await v.data.open(A);
  assert.equal(old.isCurrent(), false, 'Returning to the same path does not revive the gesture');
  assert.equal(v.data.localCheck, null); assert.equal(v.data.doc.text, ORIGINAL);
  unmount(v);
  assert.equal(old.isCurrent(), false);
});

test('a declared workspace file can receive a comparison from the explorer', async () => {
  const f = fixture(), v = await f.mount();
  v.data.active = '';
  const intake = v.data.captureIntake();
  const incoming = '# @file ' + B + '\r\n' + f.files[B];
  assert.equal(await intake.receive({ repo: REPO, ref: 'main', path: B }, incoming), true);
  assert.equal(v.data.active, B); assert.equal(v.data.localCheck.content, incoming);
  assert.equal(v.data.doc.text, f.files[B]);
  const next = v.data.captureIntake();
  assert.equal(await next.receive({ repo: REPO, ref: 'other', path: B }, incoming), false);
  assert.equal(await next.receive({ repo: REPO, ref: 'main', path: 'projects/other/app/Test.ps1' }, incoming), false);
  assert.deepEqual(f.writes, []);
});

test('a file opened for received code cannot overtake a newer file selection', async () => {
  const f = fixture(), v = await f.mount();
  const gate = deferred(); f.gates.set('git/blobs/' + gitBlob(f.files[B]), gate);
  const intake = v.data.captureIntake();
  const receiving = intake.receive({ repo: REPO, ref: 'main', path: B }, 'incoming for B');
  const rejected = assert.rejects(receiving, /receiving file could not be opened/);
  await tick(3); await v.data.open(C);
  gate.resolve(); await rejected;
  assert.equal(v.data.active, C); assert.equal(v.data.localCheck, null);
  assert.equal(f.records('wpsCorrespondence.checks').length, 0);
});

test('a pasted draft bundle opens restoration review before any draft write', async () => {
  const f = fixture(), v = await f.mount(), incoming = ORIGINAL + '# restored';
  const bundle = window.PowerShellWorkspace.exportBundle({ repo: REPO, project: P, ref: 'main', revision: REV, drafts: [{ ...clone(v.data.doc), text: incoming }] });
  await v.data.captureIntake().receive(null, JSON.stringify(bundle));
  assert.equal(v.data.importBundle.drafts[0].text, incoming);
  assert.equal(v.data.doc.text, ORIGINAL); assert.equal(f.records('wpsWorkspace.drafts').length, 0);
  await v.data.restoreImport();
  assert.equal(v.data.doc.text, incoming); assert.deepEqual(f.writes, []);
});

test('unchanged original and checked GitHub comparisons report exact identity without rendering source rows', async () => {
  const f = fixture(), v = await f.mount(), d = v.data;
  await d.setPane('diff');
  assert.equal(d.diffState, 'identical');
  assert.equal(d.diffBeforeLabel, 'Original GitHub version');
  assert.match(d.diffMessage, /exactly matches original GitHub version/);
  assert.deepEqual(clone(d.diffRows), []);
  assert.deepEqual(clone(d.diffCounts), { added: 0, removed: 0 });
  await d.refreshUpstream(); d.diffAgainst = 'current'; d.buildDiff();
  assert.equal(d.diffState, 'identical');
  assert.equal(d.diffBeforeLabel, 'Last checked GitHub');
  assert.match(d.diffMessage, /exactly matches last checked GitHub/);
  assert.deepEqual(clone(d.shownDiff), []);
  assert.equal(d.doc.text, ORIGINAL); assert.deepEqual(f.writes, []);
});

test('received-copy identity compares with the browser draft, not the check against original GitHub', async () => {
  const f = fixture(), v = await f.mount(), d = v.data, received = ORIGINAL + '# received edit';
  d.localText = received; await d.compareCopy();
  assert.equal(d.localCheck.exact, false);
  assert.equal(d.diffState, 'changed');
  d.edit(received);
  assert.equal(d.diffBeforeLabel, 'Received copy');
  assert.equal(d.diffState, 'identical');
  assert.match(d.diffMessage, /exactly matches received copy/i);
  assert.deepEqual(clone(d.diffRows), []);
  assert.deepEqual(clone(d.diffCounts), { added: 0, removed: 0 });
  d.localText = ORIGINAL; await d.compareCopy();
  assert.equal(d.localCheck.exact, true, 'This observation names the pinned GitHub original');
  assert.equal(d.diffState, 'changed', 'The browser draft still contains its received edit');
  assert.ok(d.diffCounts.added > 0);
  assert.equal(d.doc.text, received); assert.deepEqual(f.writes, []);
});

test('empty existing files and empty compared texts are available exact matches', async () => {
  const f = fixture(); f.files[A] = '';
  const v = await f.mount(), d = v.data;
  assert.notEqual(d.doc.baseBlob, '');
  d.doc.currentText = ''; d.localCheck = { content: '', exact: false };
  for (const source of ['base', 'current', 'local']) {
    d.diffAgainst = source; d.buildDiff();
    assert.equal(d.diffState, 'identical', source);
    assert.match(d.diffMessage, /exactly matches/i);
    assert.deepEqual(clone(d.diffRows), []);
    assert.deepEqual(clone(d.diffCounts), { added: 0, removed: 0 });
  }
});

test('unavailable, unchecked, removed and unreceived sources never claim an unchanged draft', async () => {
  const f = fixture(), v = await f.mount(), d = v.data;
  d.doc.text = 'different draft'; d.buildDiff(); assert.equal(d.diffState, 'changed');
  d.doc.baseText = undefined; d.diffAgainst = 'base'; d.buildDiff();
  assert.equal(d.diffState, 'unavailable'); assert.match(d.diffMessage, /original GitHub text is unavailable/i);
  d.doc.currentText = undefined; d.diffAgainst = 'current'; d.buildDiff();
  assert.equal(d.diffState, 'unavailable'); assert.match(d.diffMessage, /Check GitHub/i);
  d.doc.currentText = null; d.buildDiff();
  assert.equal(d.diffState, 'unavailable'); assert.match(d.diffMessage, /removed from GitHub/i);
  d.diffAgainst = 'local'; d.localText = 'Uncompared incoming text';
  for (const check of [null, {}, { content: null }]) {
    d.localCheck = check; d.buildDiff();
    assert.equal(d.diffState, 'unavailable'); assert.match(d.diffMessage, /Receive a copy/i);
    assert.deepEqual(clone(d.diffRows), []);
    assert.deepEqual(clone(d.diffCounts), { added: 0, removed: 0 });
    assert.equal(d.diffWarning, '');
  }
  d.active = ''; d.buildDiff();
  assert.equal(d.diffState, 'unavailable'); assert.match(d.diffMessage, /Choose a file/i);
});

test('line-ending-only comparisons remain distinct from exact identity and preserve both source texts', async () => {
  const f = fixture(), v = await f.mount(), d = v.data;
  for (const [source, before, after] of [
    ['base', 'first\r\nsecond\r\n', 'first\nsecond\n'],
    ['current', 'first\rsecond\r', 'first\nsecond\n'],
    ['local', 'first\r\nsecond\rthird\n', 'first\nsecond\nthird\r\n'],
  ]) {
    d.doc.baseText = before; d.doc.currentText = before; d.localCheck = { content: before, exact: true };
    d.doc.text = after; d.diffAgainst = source; d.buildDiff();
    assert.equal(d.diffState, 'line-endings', source);
    assert.match(d.diffMessage, /Only line endings differ/);
    assert.match(d.diffMessage, /Exact text is preserved/);
    if (source !== 'local') assert.match(d.diffMessage, /GitHub/);
    assert.equal(d.doc.text, after); assert.equal(d.doc.baseText, before); assert.equal(d.localCheck.content, before);
    assert.deepEqual(clone(d.diffRows), []);
    assert.deepEqual(clone(d.diffCounts), { added: 0, removed: 0 });
    assert.equal(d.diffWarning, '');
  }
  d.doc.baseText = 'first\n'; d.doc.text = 'first'; d.diffAgainst = 'base'; d.buildDiff();
  assert.equal(d.diffState, 'changed', 'Removing the final newline changes text beyond its newline encoding');
  assert.deepEqual(clone(d.diffCounts), { added: 0, removed: 1 });
  d.doc.baseText = '\ufefffirst'; d.doc.text = 'first'; d.buildDiff();
  assert.equal(d.diffState, 'changed', 'A BOM difference is not a line-ending-only difference');
});

test('changed comparisons retain line positions, additions, deletions and contextual filtering', async () => {
  const f = fixture(), v = await f.mount(), d = v.data;
  d.doc.baseText = 'first\nold\nlast'; d.doc.text = 'first\nnew\nextra\nlast'; d.buildDiff();
  assert.equal(d.diffState, 'changed');
  assert.deepEqual(clone(d.diffCounts), { added: 2, removed: 1 });
  assert.deepEqual(clone(d.diffRows), [
    { type: 'eq', a: 1, b: 1, text: 'first' },
    { type: 'del', a: 2, b: '', text: 'old' },
    { type: 'add', a: '', b: 2, text: 'new' },
    { type: 'add', a: '', b: 3, text: 'extra' },
    { type: 'eq', a: 3, b: 4, text: 'last' },
  ]);
  d.onlyChanges = true;
  assert.deepEqual(clone(d.shownDiff).map(row => row.text), ['old', 'new', 'extra']);
  assert.deepEqual(clone(d.diffCounts), { added: 2, removed: 1 });
  d.onlyChanges = false; assert.equal(d.shownDiff.length, 5);
  d.doc.currentText = d.doc.text; d.diffAgainst = 'current'; d.buildDiff();
  assert.equal(d.diffState, 'identical'); assert.deepEqual(clone(d.shownDiff), []);
  assert.deepEqual(clone(d.diffCounts), { added: 0, removed: 0 });
  d.localCheck = null; d.diffAgainst = 'local'; d.buildDiff();
  assert.equal(d.diffState, 'unavailable'); assert.deepEqual(clone(d.shownDiff), []);
});

test('empty sources produce pure additions or deletions without a phantom empty-line replacement', async () => {
  const f = fixture(), v = await f.mount(), d = v.data;
  d.doc.baseText = ''; d.doc.text = 'first\nsecond'; d.buildDiff();
  assert.equal(d.diffState, 'changed');
  assert.deepEqual(clone(d.diffCounts), { added: 2, removed: 0 });
  assert.ok(d.diffRows.every(row => row.type === 'add' && row.a === ''));
  d.doc.baseText = 'first\nsecond'; d.doc.text = ''; d.buildDiff();
  assert.equal(d.diffState, 'changed');
  assert.deepEqual(clone(d.diffCounts), { added: 0, removed: 2 });
  assert.ok(d.diffRows.every(row => row.type === 'del' && row.b === ''));
});

test('edits to CR-only code retain correct visual line numbers without changing saved separators', async () => {
  const before = '# heading\rWrite-Output "old"\r# end';
  const after = '# heading\rWrite-Output "new"\rWrite-Output "added"\r# end';
  const f = fixture(); f.files[A] = before;
  const v = await f.mount(), d = v.data;
  d.edit(after); await d.persist(d.doc); await d.refreshUpstream();
  d.localText = before; await d.compareCopy();
  for (const source of ['base', 'current', 'local']) {
    d.diffAgainst = source; d.buildDiff();
    assert.equal(d.diffState, 'changed', source);
    assert.deepEqual(clone(d.diffCounts), { added: 2, removed: 1 });
    assert.deepEqual(clone(d.diffRows), [
      { type: 'eq', a: 1, b: 1, text: '# heading' },
      { type: 'del', a: 2, b: '', text: 'Write-Output "old"' },
      { type: 'add', a: '', b: 2, text: 'Write-Output "new"' },
      { type: 'add', a: '', b: 3, text: 'Write-Output "added"' },
      { type: 'eq', a: 3, b: 4, text: '# end' },
    ]);
  }
  assert.equal(d.doc.text, after); assert.equal(d.doc.baseText, before);
  assert.equal(d.doc.currentText, before); assert.equal(d.localCheck.content, before);
  assert.equal(f.records('wpsWorkspace.drafts')[0].text, after);
  assert.equal(f.records('wpsCorrespondence.checks')[0].content, before);
  assert.equal(f.files[A], before); assert.deepEqual(f.writes, []);
});

test('new files retain an additions review and distinguish an intentionally empty new file', async () => {
  const f = fixture(), v = await f.mount(), d = v.data;
  d.newPath = P + '/app/Scripts/New-Comparison.ps1'; await d.newFile();
  assert.equal(d.doc.baseBlob, ''); assert.equal(d.doc.baseText, '');
  d.doc.text = 'Write-Output "new file"'; d.diffAgainst = 'base'; d.buildDiff();
  assert.equal(d.diffBeforeLabel, 'New file'); assert.equal(d.diffState, 'changed');
  assert.deepEqual(clone(d.diffCounts), { added: 1, removed: 0 });
  assert.deepEqual(clone(d.diffRows), [{ type: 'add', a: '', b: 1, text: 'Write-Output "new file"' }]);
  d.doc.text = ''; d.buildDiff();
  assert.equal(d.diffState, 'identical'); assert.equal(d.diffMessage, 'This new file is empty.');
  assert.deepEqual(clone(d.diffRows), []);
  d.diffAgainst = 'current'; d.buildDiff();
  assert.equal(d.diffState, 'unavailable'); assert.match(d.diffMessage, /Check GitHub/i);
});

test('a capped alignment keeps its honest replacement warning and clears it on a new comparison', async () => {
  const f = fixture(), v = await f.mount(), d = v.data;
  d.doc.baseText = Array(650).fill('old repeated line').join('\n');
  d.doc.text = Array(650).fill('new repeated line').join('\n'); d.buildDiff();
  assert.equal(d.diffState, 'changed'); assert.match(d.diffWarning, /too different to align.*replacement/i);
  assert.deepEqual(clone(d.diffCounts), { added: 650, removed: 650 });
  d.doc.text = d.doc.baseText; d.buildDiff();
  assert.equal(d.diffState, 'identical'); assert.equal(d.diffWarning, '');
  assert.deepEqual(clone(d.diffRows), []);
  assert.deepEqual(clone(d.diffCounts), { added: 0, removed: 0 });
});

test('a missing diff engine cannot claim changed text is unchanged, but exact identity remains knowable', async () => {
  const f = fixture(), v = await f.mount(), d = v.data, engine = window.textDiff;
  try {
    window.textDiff = null; d.doc.text = ORIGINAL + '# changed'; d.buildDiff();
    assert.equal(d.diffState, 'unavailable'); assert.match(d.diffMessage, /comparison tool is unavailable/i);
    assert.deepEqual(clone(d.diffRows), []);
    d.doc.text = ORIGINAL; d.buildDiff();
    assert.equal(d.diffState, 'identical'); assert.match(d.diffMessage, /exactly matches/i);
  } finally { window.textDiff = engine; }
});

test('workspace tabs support arrow and Home/End navigation with linked panels and one tab stop', async () => {
  const f = fixture(), v = await f.mount();
  const group = v.el.querySelector('[aria-label="Code views"]');
  const tabs = [...group.querySelectorAll('[role="tab"]')];
  const key = (el, value) => el.dispatchEvent(new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  tabs[0].focus(); key(tabs[0], 'ArrowRight'); await tick(3);
  assert.equal(v.data.pane, 'diff'); assert.equal(window.document.activeElement, tabs[1]);
  assert.deepEqual(tabs.map(el => el.tabIndex), [-1, 0, -1]);
  assert.equal(v.el.querySelector('#' + tabs[1].getAttribute('aria-controls')).getAttribute('role'), 'tabpanel');
  assert.equal(v.data.diffState, 'identical');
  key(tabs[1], 'End'); await tick(3);
  assert.equal(v.data.pane, 'history'); assert.equal(window.document.activeElement, tabs[2]);
  key(tabs[2], 'Home'); await tick(3);
  assert.equal(v.data.pane, 'code'); assert.deepEqual(tabs.map(el => el.tabIndex), [0, -1, -1]);
  await v.data.open(B); await tick(3);
  const files = [...v.el.querySelectorAll('[aria-label="Open files"] [role="tab"]')];
  files[1].focus(); key(files[1], 'ArrowLeft'); await tick(3);
  assert.equal(v.data.active, A); assert.equal(window.document.activeElement, files[0]);
  assert.deepEqual(files.map(el => el.tabIndex), [0, -1]);
  assert.equal(v.data.doc.text, ORIGINAL); assert.deepEqual(f.writes, []);
});
