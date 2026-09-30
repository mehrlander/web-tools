#!/usr/bin/env node
// The Overview's source pane (installation-view.js mounting
// alpineComponents/powershell-file.js inline) under real Alpine, Tailwind and
// CodeMirror 6, with GitHub fixture reads and every CDN asset resolved from
// node_modules through tools/render/cdn.mjs. No external requests. Holds what
// jsdom cannot: a selected file renders in .cm-editor read-only, Edit in its
// bar writes only a browser draft, a second selection reuses the same view through open(), the
// Source header's tools are visible at both widths and a real drop on the
// pane compares, a phone width keeps the code collapsed below Record
// installed, the <pre> fallback when esm.sh is unreachable, and no GitHub
// write from any of it.
// Run explicitly: node tools/test/installation-source-browser.mjs
// SHOTS=<dir> also writes a desktop and a phone screenshot there.
// Kept outside *.test.mjs because npm test is browser-free.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { repoRoot } from '../repo-root.mjs';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const project = 'projects/wps', repo = 'fixture/installation', revision = 'a'.repeat(40);
const blob = text => createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const files = {
  [project + '/data/installation.json']: JSON.stringify({ root: 'Documents\\WindowsPowerShell', observations: project + '/data/observations.csv',
    correspondence: [{ repo: 'app/Modules/', area: 'Modules', installs: 'Modules/' }] }),
  [project + '/app/Modules/Fixture/A.psm1']: 'function Get-Message {\r\n    param([string]$Name)\r\n    "Hello, $Name"\r\n}\r\n',
  [project + '/app/Modules/Fixture/B.psm1']: 'function Get-Total {\n    param([int[]]$Values)\n    ($Values | Measure-Object -Sum).Sum\n}\n',
  [project + '/app/Modules/Fixture/Form.xaml']: '<Window xmlns="x">\n  <Grid/>\n</Window>\n',
  [project + '/app/Modules/Fixture/C.psm1']: 'function Get-Count {\n    param([int]$Step = 2)\n    $Step * 10\n}\n',
};
const A = project + '/app/Modules/Fixture/A.psm1', B = project + '/app/Modules/Fixture/B.psm1', X = project + '/app/Modules/Fixture/Form.xaml';
// C was recorded installed at an older revision, so it reads "GitHub changed
// since" and its Source pane opens on Changes: that older text against now.
const C = project + '/app/Modules/Fixture/C.psm1', oldRevision = 'c'.repeat(40);
const oldC = 'function Get-Count {\n    $Step = 1\n    $Step * 10\n}\n';
files[project + '/data/observations.csv'] = 'date,path,kind,revision,blob_sha,local_sha256,match,method,note\n'
  + ['2026-09-01T00:00:00Z', C, 'installed', oldRevision, blob(oldC), createHash('sha256').update(oldC).digest('hex'), '', 'copy', ''].join(',') + '\n';
const fixture = { repo, revision, files, blobs: Object.fromEntries(Object.entries(files).map(([p, t]) => [p, blob(t)])),
  oldRevision, old: { [C]: { text: oldC, sha: blob(oldC) } } };
// repo.js registers Alpine.data('repo'), as the app does; that name shadows the
// view's repo inside the pane's x-data expression, which is how the 2026-09-25
// break reached the app while this check stayed green.
const scripts = ['kits/csv.js', 'kits/installation.js', 'kits/sync-status.js', 'kits/text-diff.js', 'kits/github-links.js', 'kits/powershell-editor.js', 'kits/powershell-workspace.js', 'kits/powershell-language.js', 'alpineComponents/repo.js', 'alpineComponents/powershell-file.js', 'alpineComponents/installation-view.js'];
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Installation source pane verification</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://cdn.jsdelivr.net/combine/npm/@tailwindcss/browser@4,npm/@phosphor-icons/web"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/combine/npm/daisyui@5/themes.css,npm/daisyui@5/daisyui.css">
<script>
window.__fixture = ${JSON.stringify(fixture).replace(/</g, '\\u003c')};
window.__fixture.calls = [];
window.TOKEN = 't';
const __drafts = new Map(); window.persistence = { collection: () => ({ async find(m) { return [...__drafts.values()].filter(m); }, async put(r) { __drafts.set(r.id, r); return r; }, async delete(id) { __drafts.delete(id); } }) };
window.GH = class {
  static FRESH = { cache: 'no-store' };
  constructor(opts = {}) { this.repo = opts.repo; this.ref = opts.ref || 'main'; }
  async get(path) {
    const f = window.__fixture;
    f.calls.push({ method: 'GET', path, ref: this.ref });
    if (this.ref === f.oldRevision && f.old[path]) return f.old[path];
    if (path in f.files) return { text: f.files[path], sha: f.blobs[path] };
    throw Object.assign(new Error('Not found'), { status: 404 });
  }
  async req(path, opts = {}) {
    const f = window.__fixture;
    f.calls.push({ method: opts.method || 'GET', path, ref: this.ref });
    if (opts.method && opts.method !== 'GET') throw new Error('Browser verification forbids publication');
    if (path.startsWith('commits?')) return [{ sha: f.revision }];
    if (path.startsWith('git/blobs/')) { const sha = path.slice(10); const p = Object.keys(f.blobs).find(k => f.blobs[k] === sha); if (p) return { sha, encoding: 'base64', content: btoa(unescape(encodeURIComponent(f.files[p]))) }; }
    if (path.startsWith('git/trees/')) return { truncated: false, tree: Object.keys(f.files).map(p => ({ type: 'blob', path: p, sha: f.blobs[p], size: f.files[p].length })) };
    throw Object.assign(new Error('Not found'), { status: 404 });
  }
};
window.__shell = { installationItem: '', syncUrl() {}, goProject() {}, goStage() {}, openFile() {},
  compared: [], pasted: 0,
  async openCorrespondence(target, text, name, source) { this.compared.push({ path: target.path, text, name, source }); },
  pasteAnywhere() { this.pasted++; } };
document.addEventListener('alpine:init', () => Alpine.store('browser',
  { repo: window.__fixture.repo, ref: 'main', defaultRef: 'main', gh: new window.GH({ repo: window.__fixture.repo, ref: 'main' }) }));
</script>
${scripts.map(file => '<script src="/lib/' + file + '"></script>').join('\n')}
<script defer src="/node_modules/alpinejs/dist/cdn.min.js"></script>
</head><body class="p-4"><div id="mount" x-data="installationView({ path: '${project}', installation: '${project}/data/installation.json' })"></div></body></html>`;

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://fixture').pathname;
  if (pathname === '/') { res.writeHead(200, { 'content-type': 'text/html;charset=utf-8' }); return res.end(html); }
  const target = path.resolve(repoRoot, '.' + decodeURIComponent(pathname));
  if (!target.startsWith(repoRoot + path.sep) || !existsSync(target)) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'content-type': typeFor(target) }); res.end(readFileSync(target));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
const results = [], browserErrors = [], blocked = [];
const check = async (name, run) => {
  try { await run(); results.push({ name, pass: true }); console.log('ok   ' + name); }
  catch (error) { results.push({ name, pass: false, error: error.message }); console.error('FAIL ' + name + '\n' + error.message); }
};
const display = text => text.replace(/\r\n?|\n/g, '\n');

// One page per scenario. withoutEsm aborts every esm.sh request, which is
// how the kit fails to load in the field.
const openPage = async ({ width, height, withoutEsm = false }) => {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/')) return route.continue();
    if (withoutEsm && url.startsWith('https://esm.sh/')) return route.abort();
    const resolved = resolveCdn(url, repoRoot);
    if (resolved.kind === 'fulfill') return route.fulfill({ status: 200, contentType: resolved.contentType, body: resolved.body });
    blocked.push(url); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.goto(origin + '/');
  await page.waitForFunction(() => { const v = window.Alpine?.$data(document.querySelector('#mount')); return v && !v.loading && v.items.length; });
  const select = p => page.evaluate(p => Alpine.$data(document.querySelector('#mount')).select(p), p);
  const settled = () => page.waitForFunction(() => {
    const s = Alpine.$data(document.querySelector('#mount')).sourceState;
    return s === 'editor' || s === 'plain' || s === 'error';
  }, null, { timeout: 30000 });
  const editor = () => page.evaluate(() => {
    const host = document.querySelector('[data-source-editor]'), v = host?.__editor;
    return v ? { text: v.state.doc.toString(), readOnly: v.state.readOnly, editable: v.contentDOM.getAttribute('contenteditable'),
      views: document.querySelectorAll('[data-source] .cm-editor').length, same: v === window.__firstView } : null;
  });
  const writes = () => page.evaluate(() => window.__fixture.calls.filter(c => c.method !== 'GET').length);
  return { context, page, select, settled, editor, writes };
};

try {
  const launches = [{}, { channel: 'chrome' }, { channel: 'msedge' }];
  let lastError;
  for (const option of launches) {
    try { browser = await chromium.launch({ headless: true, ...option }); break; }
    catch (error) { lastError = error; }
  }
  if (!browser) throw lastError;

  const desk = await openPage({ width: 1500, height: 1000 });
  await check('selecting a file renders its text in .cm-editor, read-only', async () => {
    await desk.select(A); await desk.settled();
    assert.equal(await desk.page.evaluate(() => Alpine.$data(document.querySelector('#mount')).sourceState), 'editor');
    await desk.page.locator('[data-source] .cm-editor').waitFor({ state: 'visible' });
    const e = await desk.editor();
    assert.equal(e.text, display(files[A]));
    assert.equal(e.readOnly, true);
    assert.equal(e.editable, 'false');
    await desk.page.evaluate(() => { window.__firstView = document.querySelector('[data-source-editor]').__editor; });
    assert.equal(await desk.page.locator('[data-source-toggle]').isVisible(), false, 'no toggle at desktop width');
    if (process.env.SHOTS) await desk.page.screenshot({ path: path.join(process.env.SHOTS, 'source-pane-desktop.png'), fullPage: true });
  });
  await check('typing into the pane changes nothing', async () => {
    await desk.page.locator('[data-source] .cm-content').click();
    await desk.page.keyboard.type('Write-Host oops');
    await desk.page.keyboard.press('Enter');
    assert.equal((await desk.editor()).text, display(files[A]));
  });
  await check('switching files swaps the text in the same view', async () => {
    await desk.select(B); await desk.settled();
    await desk.page.waitForFunction(t => document.querySelector('[data-source-editor]').__editor?.state.doc.toString() === t, display(files[B]));
    let e = await desk.editor();
    assert.equal(e.views, 1); assert.equal(e.same, true, 'open() reused the view');
    assert.equal(e.readOnly, true);
    await desk.select(X); await desk.settled();
    await desk.page.waitForFunction(t => document.querySelector('[data-source-editor]').__editor?.state.doc.toString() === t, display(files[X]));
    e = await desk.editor();
    assert.equal(e.same, true); assert.equal(e.readOnly, true);
    assert.ok(await desk.page.locator('[data-source] .cm-tag').count() > 0, 'XAML is highlighted as XML');
  });
  await check('deselecting tears the editor down', async () => {
    await desk.select('');
    await desk.page.waitForFunction(() => !document.querySelector('[data-source]'));
    assert.equal(await desk.page.evaluate(() => window.__firstView.dom.isConnected), false);
    await desk.select(A); await desk.settled();
    const e = await desk.editor();
    assert.equal(e.text, display(files[A])); assert.equal(e.same, false, 'a fresh view after teardown');
  });
  await check('the Source header tools and the paste zone are visible, and a drop on the pane is described, then compared', async () => {
    await desk.select(A); await desk.settled();
    for (const label of ['Open in deck', 'Copy GitHub text'])
      assert.equal(await desk.page.getByLabel(label, { exact: true }).isVisible(), true, label);
    for (const gone of ['Download GitHub text', 'Copy transfer script', 'Compare a file with this file'])
      assert.equal(await desk.page.getByLabel(gone, { exact: true }).count(), 0, gone + ' is gone');
    assert.equal(await desk.page.locator('textarea').count(), 0);
    await desk.page.locator('[data-copy-zone]').click();
    assert.equal(await desk.page.evaluate(() => window.__shell.pasted), 1);
    await desk.page.evaluate(async () => {
      const target = document.querySelector('[data-source] .cm-content'), dt = new DataTransfer();
      dt.setData('text/plain', 'function Get-Message {}\n');
      for (const type of ['dragenter', 'dragover']) target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
      await new Promise(resolve => setTimeout(resolve, 50)); // Alpine applies the binding on its next flush
      window.__ringWhileDragging = document.querySelector('[data-source-file]').classList.contains('ring-2');
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
    assert.equal(await desk.page.evaluate(() => window.__ringWhileDragging), true, 'the code box highlights under a drag');
    // The view compares the drop itself, in memory: a summary says what the
    // copy is, Changes is one tap away, and nothing goes to the shell's
    // stored-check flow.
    await desk.page.waitForFunction(() => Alpine.$data(document.querySelector('#mount')).baseline?.label === 'Supplied copy');
    await desk.page.locator('[data-copy-summary]').waitFor({ state: 'visible' });
    assert.match(await desk.page.locator('[data-copy-summary]').innerText(), /differs from GitHub[\s\S]*Changed: Get-Message/);
    if (process.env.SHOTS) await desk.page.screenshot({ path: path.join(process.env.SHOTS, 'copy-summary-desktop.png'), fullPage: true });
    await desk.page.locator('[data-copy-summary] button', { hasText: 'Show line changes' }).click();
    await desk.page.locator('[data-source-diff]').waitFor({ state: 'visible' });
    assert.equal(await desk.page.evaluate(() => window.__shell.compared.length), 0);
    assert.equal(await desk.page.evaluate(() => Alpine.$data(document.querySelector('#mount')).checks[0].content), 'function Get-Message {}\n');
    await desk.page.locator('[data-source-views] button', { hasText: 'Code' }).click();
    assert.equal((await desk.editor()).text, display(files[A]), 'a drop compares; it does not insert into the read-only view');
    await desk.page.waitForFunction(() => !document.querySelector('[data-source-file]').classList.contains('ring-2'));
    assert.equal(await desk.page.evaluate(() => document.querySelector('[data-source-file]').classList.contains('border-base-300')), true, 'the box settles to its quiet border');
  });
  await check('a file changed since it was recorded opens on Changes, and Code is one tap away', async () => {
    await desk.select(C); await desk.settled();
    await desk.page.waitForFunction(() => Alpine.$data(document.querySelector('#mount')).sourceView === 'changes');
    await desk.page.locator('[data-source-diff]').waitFor({ state: 'visible' });
    assert.equal(await desk.page.locator('[data-source] .cm-editor').isVisible(), false);
    const rows = await desk.page.locator('[data-source-diff] [role=row]').evaluateAll(rs => rs
      .map(r => r.querySelector('[aria-label]').getAttribute('aria-label') + ' ' + r.querySelector('pre').textContent)
      .filter(t => !t.startsWith('Unchanged')));
    assert.deepEqual(rows, ['Removed     $Step = 1', 'Added     param([int]$Step = 2)']);
    assert.match(await desk.page.locator('[data-source-diff]').innerText(), /reported installed at ccccccc/);
    for (const label of ['Files', 'Stage', 'Open code workspace', 'Mark as installed']) assert.equal(await desk.page.getByRole('button', { name: label, exact: true }).count(), 0, label + ' is gone');
    assert.equal(await desk.page.locator('[data-row]', { hasText: 'C.psm1' }).locator('[data-status]').getAttribute('title'), 'Update pending');
    if (process.env.SHOTS) await desk.page.screenshot({ path: path.join(process.env.SHOTS, 'source-pane-changes.png'), fullPage: true });
    await desk.page.locator('[data-source-views] button', { hasText: 'Code' }).click();
    await desk.page.locator('[data-source] .cm-editor').waitFor({ state: 'visible' });
    assert.equal((await desk.editor()).text, files[C]);
    assert.equal(await desk.page.locator('[data-source-diff]').isVisible(), false);
  });
  await check('Edit in the pane writes a browser draft, and its menu offers the draft actions', async () => {
    await desk.select(B); await desk.settled();
    await desk.page.locator('[data-file-actions] [title="Edit"]').click();
    assert.equal((await desk.editor()).readOnly, false);
    await desk.page.locator('[data-source] .cm-content').click();
    await desk.page.keyboard.press('Control+End');
    await desk.page.keyboard.type('# edited');
    await desk.page.waitForFunction(() => Alpine.$data(document.querySelector('#mount')).draftList.length === 1);
    await desk.page.locator('[data-file-actions] [title="Done editing"]').click();
    assert.equal((await desk.editor()).readOnly, true);
    await desk.page.locator('[data-file-actions] [title="File actions"]').click();
    const menu = desk.page.locator('[data-file-menu]');
    await menu.waitFor({ state: 'visible' });
    const items = await menu.locator('li').allInnerTexts();
    for (const label of ['Copy draft text', 'Discard draft…', 'Publish drafts…']) assert.ok(items.some(t => t.includes(label)), label + ' is offered');
    if (process.env.SHOTS) await desk.page.screenshot({ path: path.join(process.env.SHOTS, 'source-pane-edit.png'), fullPage: true });
    await menu.locator('button', { hasText: 'Discard draft' }).click();
    await desk.page.locator('[data-discard] button', { hasText: 'Discard draft' }).click();
    await desk.page.waitForFunction(() => Alpine.$data(document.querySelector('#mount')).draftList.length === 0);
    assert.equal((await desk.editor()).text, display(files[B]));
  });
  await check('the pane writes nothing to GitHub', async () => { assert.equal(await desk.writes(), 0); });
  await desk.context.close();

  const phone = await openPage({ width: 390, height: 844 });
  await check('on a phone the list menu opens on screen, and the detail keeps its status menu above the collapsed code', async () => {
    await phone.page.locator('[data-row]').first().locator('[data-status]').click();
    const listMenu = phone.page.locator('[data-row] [data-status-menu]').first();
    await listMenu.waitFor({ state: 'visible' });
    const lb = await listMenu.boundingBox();
    assert.ok(lb.x >= 0 && lb.x + lb.width <= 390, 'the list menu is inside the viewport: ' + JSON.stringify(lb));
    await phone.page.keyboard.press('Escape');
    await phone.select(A); await phone.settled();
    const status = phone.page.locator('[data-status]:not([data-row] [data-status])');
    const box = await status.boundingBox();
    assert.ok(box && box.y + box.height <= 844, 'the status menu is above the fold');
    await status.click();
    const menu = phone.page.locator('[data-status-menu]:not([data-row] [data-status-menu])');
    await menu.waitFor({ state: 'visible' });
    const mb = await menu.boundingBox();
    assert.ok(mb.x >= 0 && mb.x + mb.width <= 390, 'the detail menu is inside the viewport: ' + JSON.stringify(mb));
    assert.equal(await menu.getByRole('button', { name: 'Confirm installed…' }).isVisible(), true);
    if (process.env.SHOTS) await phone.page.screenshot({ path: path.join(process.env.SHOTS, 'status-menu-phone.png') });
    await phone.page.keyboard.press('Escape');
    assert.equal(await phone.page.locator('[data-source] .cm-editor').isVisible(), false);
    assert.equal(await phone.page.getByLabel('Copy GitHub text', { exact: true }).isVisible(), true, 'Copy shows while the code is collapsed');
    assert.equal(await phone.page.locator('[data-copy-zone]').isVisible(), true, 'the paste zone shows while the code is collapsed');
    const toggle = phone.page.locator('[data-source-toggle]');
    assert.equal(await toggle.isVisible(), true);
    await toggle.click();
    await phone.page.locator('[data-source] .cm-editor').waitFor({ state: 'visible' });
    assert.equal((await phone.editor()).text, display(files[A]));
    const overflow = await phone.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, 'no horizontal page scroll, got ' + overflow);
    if (process.env.SHOTS) await phone.page.screenshot({ path: path.join(process.env.SHOTS, 'source-pane-phone.png'), fullPage: true });
    assert.equal(await phone.writes(), 0);
  });
  await phone.context.close();

  const offline = await openPage({ width: 1500, height: 1000, withoutEsm: true });
  await check('without esm.sh the pane falls back to a <pre> of the text', async () => {
    await offline.select(B); await offline.settled();
    assert.equal(await offline.page.evaluate(() => Alpine.$data(document.querySelector('#mount')).sourceState), 'plain');
    const pre = offline.page.locator('[data-source-plain]');
    await pre.waitFor({ state: 'visible' });
    assert.equal(await pre.evaluate(el => el.textContent), files[B]);
    assert.equal(await offline.page.locator('[data-source] .cm-editor').count(), 0);
    assert.equal(await offline.writes(), 0);
  });
  await offline.context.close();

  await check('no browser errors and no unresolved CDN requests', async () => {
    assert.deepEqual(browserErrors, []);
    assert.deepEqual(blocked.filter(u => !u.startsWith('https://esm.sh/')), []);
  });
} catch (error) {
  console.error(error.stack || error); results.push({ name: 'browser setup', pass: false, error: error.message });
} finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
}
const failed = results.filter(result => !result.pass);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' browser checks passed');
if (failed.length) process.exitCode = 1;
