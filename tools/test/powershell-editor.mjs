#!/usr/bin/env node
// Real CodeMirror + Alpine + IndexedDB workspace checks, with GitHub fixture
// reads and every CDN asset resolved from node_modules. No external requests.
// Run explicitly: node tools/test/powershell-editor.mjs
// Kept outside *.test.mjs because npm test is browser-free.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { repoRoot } from '../repo-root.mjs';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const project = 'projects/wps', repo = 'fixture/powershell';
const revision = 'a'.repeat(40), treeSha = 'b'.repeat(40);
const files = [
  { name: 'A.psm1', text: '\ufefffunction Get-Message {\r\n    param([string]$Name = \'O\'\'Brien\')\r\n    "Hello, $Name"\r\n}\r\n' },
  { name: 'B.psm1', text: 'function Get-Total {\n    param([int[]]$Values)\n    ($Values | Measure-Object -Sum).Sum\n}\n' },
  { name: 'Mixed.ps1', text: '# Mixed endings\r\nfunction Get-Mixed {\n    \'quoted\'\r    \'last\'\r\n}\n' },
  { name: 'Classic.ps1', text: '# CR source\rfunction Get-Classic {\r    \'old separator\'\r}\r' },
].map(file => {
  const bytes = Buffer.from(file.text, 'utf8');
  return { ...file, path: project + '/app/Modules/Fixture/' + file.name,
    sha: createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex'),
    content: bytes.toString('base64') };
});
const manifest = { root: 'Documents\\WindowsPowerShell', observations: project + '/data/observations.csv',
  correspondence: [{ repo: 'app/Modules/', area: 'Modules', installs: 'Modules/' }] };
const fixture = { project, repo, revision, treeSha, files, manifest };
const scripts = ['kits/persistence.js', 'kits/io.js', 'kits/csv.js', 'kits/installation.js',
  'kits/text-diff.js', 'kits/powershell-language.js', 'kits/powershell-workspace.js',
  'kits/powershell-editor.js', 'alpineComponents/powershell-workspace.js'];
const html = `<!doctype html><html><head><meta charset="utf-8"><title>PowerShell editor verification</title>
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/combine/npm/daisyui@5/themes.css,npm/daisyui@5/daisyui.css">
<style>[x-cloak]{display:none!important}html,body,#mount{height:100%;margin:0}body{overflow:hidden}</style>
<script>
window.__fixture = ${JSON.stringify(fixture).replace(/</g, '\\u003c')};
window.__fixture.calls = [];
window.GH = class {
  static FRESH = { cache: 'no-store' };
  constructor(opts) { this.repo = opts.repo; this.ref = opts.ref || 'main'; }
  async get(path) {
    window.__fixture.calls.push({ method: 'GET', path, ref: this.ref });
    if (path.endsWith('/installation.json')) return {text: JSON.stringify(window.__fixture.manifest), sha: 'd'.repeat(40)};
    throw Object.assign(new Error('Not found'), {status: 404});
  }
  async req(path, opts = {}) {
    const f = window.__fixture;
    f.calls.push({ method: opts.method || 'GET', path, ref: this.ref });
    if (opts.method && opts.method !== 'GET') throw new Error('Browser verification forbids publication');
    if (path.startsWith('commits/')) return {sha:f.revision,commit:{tree:{sha:f.treeSha}}};
    if (path.startsWith('git/trees/')) return {sha:f.treeSha,truncated:false,tree:f.files.map(x => ({type:'blob',mode:'100644',path:x.path,sha:x.sha,size:x.text.length}))};
    if (path.startsWith('git/blobs/')) {const x=f.files.find(x=>path.endsWith(x.sha));if(x)return {sha:x.sha,encoding:'base64',content:x.content};}
    if (path.startsWith('commits?')) return [];
    if (path==='') return {default_branch:'main'};
    throw Object.assign(new Error('Not found'), {status:404});
  }
};
window.__shell={installationItem:window.__fixture.files[0].path,syncUrl(){},goProject(){}};
document.addEventListener('alpine:init',()=>Alpine.store('browser',{repo:window.__fixture.repo,ref:'main',defaultRef:'main'}));
</script>
${scripts.map(file => '<script src="/lib/' + file + '"></script>').join('\n')}
<script defer src="/node_modules/alpinejs/dist/cdn.min.js"></script>
</head><body><div id="mount" x-data="powershellWorkspace({path:'${project}',installation:'${project}/data/installation.json'})"></div></body></html>`;

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
try {
  const launches = [{}, { channel: 'chrome' }, { channel: 'msedge' }];
  let lastError;
  for (const option of launches) {
    try { browser = await chromium.launch({ headless: true, ...option }); break; }
    catch (error) { lastError = error; }
  }
  if (!browser) throw lastError;
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/')) return route.continue();
    const resolved = resolveCdn(url, repoRoot);
    if (resolved.kind === 'fulfill') return route.fulfill({ status: 200, contentType: resolved.contentType, body: resolved.body });
    blocked.push(url); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  const workspace = () => page.evaluate(() => {
    const w = Alpine.$data(document.querySelector('#mount'));
    return { active: w.active, doc: w.doc ? JSON.parse(JSON.stringify(w.doc)) : null, dirty: w.dirtyDocs.length,
      saveState: w.saveState, error: w.error, editorError: w.editorError, ready: w.editorReady };
  });
  const ready = async () => {
    await page.waitForFunction(() => {
      const w = window.Alpine?.$data(document.querySelector('#mount'));
      return w && !w.loading && (w.editorReady || w.editorError);
    });
    const state = await workspace(); assert.equal(state.editorError, ''); assert.equal(state.ready, true);
    await page.locator('.CodeMirror').waitFor({ state: 'visible' });
  };
  const open = async name => {
    await page.evaluate(async name => {
      const w = Alpine.$data(document.querySelector('#mount'));
      await w.open(window.__fixture.files.find(file => file.name === name).path);
      await w.setPane('code');
    }, name);
    assert.equal((await workspace()).doc.path, files.find(file => file.name === name).path);
  };
  const saved = () => page.waitForFunction(() => {
    const w = Alpine.$data(document.querySelector('#mount'));
    return w.saveState === 'Saved in this browser' || w.saveState === 'Save failed';
  }).then(async () => assert.notEqual((await workspace()).saveState, 'Save failed'));
  const source = name => files.find(file => file.name === name).text;
  const display = text => text.replace(/\r\n?|\n/g, '\n');
  const editor = () => page.evaluate(() => {
    const cm = document.querySelector('.CodeMirror').CodeMirror;
    return { text: cm.getValue(), lines: cm.lineCount(), cursor: cm.getCursor(), history: cm.historySize(), selection: cm.getSelection() };
  });
  const insertEnd = async text => {
    await page.locator('.CodeMirror textarea').focus();
    await page.keyboard.press('Control+End');
    await page.keyboard.insertText(text);
    await saved();
  };
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
  await ready();

  await check('opening source never creates a draft or changes BOM/CRLF/single quotes', async () => {
    const w = await workspace(), cm = await editor();
    assert.equal(w.doc.text, source('A.psm1')); assert.equal(cm.text, display(source('A.psm1'))); assert.equal(w.dirty, 0);
    const rows = await page.evaluate(() => PowerShellWorkspace.loadDrafts({ repo: __fixture.repo, project: __fixture.project, ref: 'main' }));
    assert.equal(rows.length, 0);
  });
  await check('type file A, switch B/A, and preserve exact independent draft text', async () => {
    await insertEnd('# A draft');
    assert.equal((await workspace()).doc.text, source('A.psm1') + '# A draft');
    await open('B.psm1'); await insertEnd('# B draft');
    assert.equal((await workspace()).doc.text, source('B.psm1') + '# B draft');
    await open('A.psm1');
    assert.equal((await workspace()).doc.text, source('A.psm1') + '# A draft');
    assert.equal((await editor()).text, display(source('A.psm1') + '# A draft'));
  });
  await check('undo/redo histories remain with each document across tab switches', async () => {
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await saved();
    assert.equal((await workspace()).doc.text, source('A.psm1'));
    await open('B.psm1');
    assert.equal((await workspace()).doc.text, source('B.psm1') + '# B draft');
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await saved();
    assert.equal((await workspace()).doc.text, source('B.psm1'));
    await open('A.psm1');
    await page.getByRole('button', { name: 'Redo', exact: true }).click(); await saved();
    assert.equal((await workspace()).doc.text, source('A.psm1') + '# A draft');
    await open('B.psm1'); await page.getByRole('button', { name: 'Redo', exact: true }).click(); await saved();
    assert.equal((await workspace()).doc.text, source('B.psm1') + '# B draft');
  });
  await check('PowerShell folding collapses a function without editing source', async () => {
    await open('A.psm1');
    const before = (await workspace()).doc.text;
    const gutter = page.locator('.CodeMirror-foldgutter-open').first(); await gutter.click();
    assert.ok(await page.locator('.CodeMirror-foldmarker').count());
    assert.equal((await workspace()).doc.text, before);
    await page.locator('.CodeMirror-foldmarker').first().click();
  });
  await check('Find and Replace operate through actual CodeMirror dialogs', async () => {
    await open('A.psm1');
    await page.getByRole('button', { name: 'Find', exact: true }).click();
    let input = page.locator('.CodeMirror-dialog input'); await input.fill('Get-Message'); await input.press('Enter');
    assert.equal((await editor()).selection, 'Get-Message');
    await page.getByRole('button', { name: 'Replace', exact: true }).click();
    input = page.locator('.CodeMirror-dialog input'); await input.fill('Hello'); await input.press('Enter');
    input = page.locator('.CodeMirror-dialog input'); await input.fill('Welcome'); await input.press('Enter');
    await page.locator('.CodeMirror-dialog').getByRole('button', { name: 'All', exact: true }).click(); await saved();
    assert.equal((await workspace()).doc.text, (source('A.psm1') + '# A draft').replace('Hello', 'Welcome'));
  });
  await check('exported draft download is valid JSON that restores exact browser text', async () => {
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export drafts', exact: true }).click();
    const download = await downloadEvent, stream = await download.createReadStream();
    const chunks = []; for await (const chunk of stream) chunks.push(chunk);
    const bundle = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const restored = await page.evaluate(bundle => PowerShellWorkspace.restoreBundle(bundle, { repo: __fixture.repo, project: __fixture.project, ref: 'main' }), bundle);
    assert.equal(restored.drafts.find(file => file.path.endsWith('/A.psm1')).text, (source('A.psm1') + '# A draft').replace('Hello', 'Welcome'));
  });
  await check('reloading the workspace restores edits from IndexedDB, not editor memory', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready();
    await open('A.psm1'); assert.equal((await workspace()).doc.text, (source('A.psm1') + '# A draft').replace('Hello', 'Welcome'));
    assert.equal((await editor()).text, display((await workspace()).doc.text));
    await open('B.psm1'); assert.equal((await workspace()).doc.text, source('B.psm1') + '# B draft');
    assert.equal((await editor()).text, display((await workspace()).doc.text));
  });
  for (const name of ['Mixed.ps1', 'Classic.ps1']) {
    await check(name + ' displays each original line and keeps untouched separators when typing', async () => {
      await open(name); const before = source(name);
      assert.equal((await editor()).lines, before.split(/\r\n?|\n/).length, 'editor line count must match physical source lines');
      assert.equal((await workspace()).doc.text, before);
      await insertEnd('# retained');
      assert.equal((await workspace()).doc.text, before + '# retained');
      await open('A.psm1'); await open(name);
      assert.equal((await workspace()).doc.text, before + '# retained');
    });
    await check(name + ' undo/redo restores deleted original separators across file switches', async () => {
      const before = (await workspace()).doc.text;
      await page.evaluate(() => {
        const cm = document.querySelector('.CodeMirror').CodeMirror;
        cm.getDoc().changeGeneration(true);
        cm.setSelection({ line: 0, ch: 0 }, { line: 3, ch: 0 }); cm.focus();
      });
      await page.keyboard.insertText('# replacement\n'); await saved();
      const edited = (await workspace()).doc.text;
      assert.notEqual(edited, before);
      await open('B.psm1'); await open(name);
      await page.getByRole('button', { name: 'Undo', exact: true }).click(); await saved();
      assert.equal((await workspace()).doc.text, before);
      await page.getByRole('button', { name: 'Redo', exact: true }).click(); await saved();
      assert.equal((await workspace()).doc.text, edited);
      await page.getByRole('button', { name: 'Undo', exact: true }).click(); await saved();
      assert.equal((await workspace()).doc.text, before);
    });
  }
  await check('mixed-ending replace-all and one undo restore exact bytes across a compound operation', async () => {
    await open('Mixed.ps1'); const before = (await workspace()).doc.text;
    await page.evaluate(() => {
      const cm = document.querySelector('.CodeMirror').CodeMirror;
      cm.getDoc().changeGeneration(true);
      cm.operation(() => {
        cm.replaceRange('Alpha', { line: 0, ch: 2 }, { line: 0, ch: 7 }, '+input');
        cm.replaceRange('Beta', { line: 2, ch: 5 }, { line: 2, ch: 11 }, '+input');
      });
    });
    await saved(); assert.notEqual((await workspace()).doc.text, before);
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await saved();
    assert.equal((await workspace()).doc.text, before);
  });
  await check('reading, editing, search and export never issue a GitHub write', async () => {
    const writes = await page.evaluate(() => __fixture.calls.filter(call => call.method !== 'GET'));
    assert.deepEqual(writes, []); assert.deepEqual(blocked, []); assert.deepEqual(browserErrors, []);
  });
  const fallbackContext = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  await fallbackContext.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/')) return route.continue();
    if (url.includes('codemirror@')) return route.fulfill({ status: 503, body: 'Editor intentionally unavailable' });
    const resolved = resolveCdn(url, repoRoot);
    if (resolved.kind === 'fulfill') return route.fulfill({ status: 200, contentType: resolved.contentType, body: resolved.body });
    return route.abort();
  });
  const fallbackPage = await fallbackContext.newPage();
  fallbackPage.on('dialog', dialog => dialog.accept());
  await fallbackPage.goto(origin + '/', { waitUntil: 'domcontentloaded' });
  await fallbackPage.waitForFunction(() => !!Alpine.$data(document.querySelector('#mount')).editorError);
  const fallback = fallbackPage.getByRole('textbox', { name: 'PowerShell source', exact: true });
  const fallbackText = () => fallbackPage.evaluate(() => Alpine.$data(document.querySelector('#mount')).doc.text);
  const fallbackSaved = () => fallbackPage.waitForFunction(() => Alpine.$data(document.querySelector('#mount')).saveState === 'Saved in this browser');
  await check('plain textarea fallback keeps exact BOM/CRLF source after a native input', async () => {
    assert.equal(await fallbackText(), source('A.psm1'));
    await fallback.focus(); await fallbackPage.keyboard.press('Control+End');
    await fallbackPage.keyboard.insertText('# fallback'); await fallbackSaved();
    assert.equal(await fallbackText(), source('A.psm1') + '# fallback');
    await fallbackPage.reload({ waitUntil: 'domcontentloaded' });
    await fallbackPage.waitForFunction(() => !!Alpine.$data(document.querySelector('#mount')).editorError);
    assert.equal(await fallbackText(), source('A.psm1') + '# fallback');
  });
  await check('plain textarea fallback undo restores deleted mixed separators', async () => {
    await fallbackPage.evaluate(async () => {
      const w = Alpine.$data(document.querySelector('#mount'));
      await w.open(__fixture.files.find(file => file.name === 'Mixed.ps1').path);
    });
    const before = source('Mixed.ps1'); assert.equal(await fallbackText(), before);
    await fallback.evaluate(field => {
      const lines = field.value.split('\n');
      field.focus(); field.setSelectionRange(0, lines.slice(0, 3).join('\n').length + 1);
    });
    await fallbackPage.keyboard.insertText('# changed\n'); await fallbackSaved();
    assert.notEqual(await fallbackText(), before);
    await fallbackPage.keyboard.press('Control+z');
    await fallbackSaved();
    assert.equal(await fallbackText(), before);
  });
  await fallbackContext.close();
} catch (error) {
  console.error(error.stack || error); results.push({ name: 'browser setup', pass: false, error: error.message });
} finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
}
const failed = results.filter(result => !result.pass);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' browser checks passed');
if (failed.length) process.exitCode = 1;
