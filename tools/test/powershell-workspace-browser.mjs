#!/usr/bin/env node
// The full app Code route, real CodeMirror and browser storage. Network writes
// are captured by the fixture; this test never contacts GitHub. Run separately
// from npm test: node tools/test/powershell-workspace-browser.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = process.env.WPS_SCREENSHOT_DIR || path.join(root, 'tools/.preview');
await mkdir(output, { recursive: true });
const P = 'projects/wps', R = 'example/powershell';
const REV = 'a'.repeat(40), TREE = 'b'.repeat(40);
const source = `# @file ${P}/app/Forms/Example/Example.ps1\r\nfunction Show-Example {\r\n    param([string]$Title = 'Today')\r\n    $button = $window.FindName('RefreshButton')\r\n    $button.Add_Click({ Write-Output $Title })\r\n}\r\n`;
const A = P + '/app/Forms/Example/Example.ps1', B = P + '/app/Forms/Example/Example.xaml';
const files = {
  '.web-tools.json': JSON.stringify({ icon: 'ph-terminal', projects: [{ path: P, installation: P + '/data/installation.json' }] }),
  'README.md': '# PowerShell\n',
  [P + '/data/installation.json']: JSON.stringify({ root: 'Documents\\WindowsPowerShell', observations: P + '/data/observations.csv', correspondence: [
    { repo: 'app/Forms/', area: 'Forms', installs: 'Forms/' }, { repo: 'app/Modules/', area: 'Modules', installs: 'Modules/' }, { repo: 'app/Scripts/', area: 'Scripts', installs: null },
  ] }),
  [P + '/data/observations.csv']: 'date,path,kind,revision,blob_sha,local_sha256,match,method,note\n',
  [A]: source,
  [B]: '<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"><StackPanel><Button x:Name="RefreshButton" Content="Refresh" /></StackPanel></Window>\n',
  [P + '/app/Modules/Example/Example.psm1']: "function Get-Example { 'Hello' }\nExport-ModuleMember -Function Get-Example\n",
};
const hash = text => createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const entries = () => Object.entries(files).map(([path, text]) => ({ path, type: 'blob', mode: '100644', sha: hash(text), size: Buffer.byteLength(text) }));
const writes = [], errors = [];
const server = http.createServer(async (req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'content-type': typeFor(file) }); res.end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
const page = await context.newPage();
page.on('pageerror', e => errors.push(e.message));
await page.route('**/*', async route => {
  const request = route.request(), url = request.url(), u = new URL(url);
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (url.startsWith(origin)) return route.continue();
  if (u.hostname === 'api.github.com' && u.pathname.startsWith('/repos/' + R)) {
    const p = decodeURIComponent(u.pathname.slice(('/repos/' + R).length)).replace(/^\//, '');
    if (request.method() !== 'GET') {
      writes.push({ path: p, method: request.method(), body: request.postDataJSON() });
      if (p === 'git/trees') return json({ sha: 'c'.repeat(40) });
      if (p === 'git/commits') return json({ sha: 'd'.repeat(40) });
      if (p === 'git/refs') return json({ ref: request.postDataJSON().ref, object: { sha: 'd'.repeat(40) } });
      return json({ message: 'Unexpected write' }, 500);
    }
    if (!p) return json({ full_name: R, name: 'powershell', owner: { login: 'example' }, default_branch: 'main', private: false, html_url: 'https://github.com/' + R });
    if (p.startsWith('contents/')) {
      const name = p.slice(9), text = files[name];
      if (text !== undefined) return json({ path: name, name: name.split('/').pop(), type: 'file', sha: hash(text), encoding: 'base64', content: Buffer.from(text).toString('base64') });
      const list = entries().filter(e => e.path.startsWith(name + '/') && !e.path.slice(name.length + 1).includes('/'));
      return list.length ? json(list.map(e => ({ ...e, type: 'file', name: e.path.split('/').pop() }))) : json({ message: 'Not Found' }, 404);
    }
    if (p.startsWith('git/trees/')) return json({ sha: TREE, truncated: false, tree: entries() });
    if (p.startsWith('git/blobs/')) {
      const pair = Object.entries(files).find(([, text]) => hash(text) === p.slice(10));
      return pair ? json({ sha: hash(pair[1]), encoding: 'base64', content: Buffer.from(pair[1]).toString('base64') }) : json({ message: 'Not Found' }, 404);
    }
    if (p.startsWith('git/commits/')) return json({ sha: REV, tree: { sha: TREE } });
    if (p.startsWith('commits/')) return json({ sha: REV, commit: { tree: { sha: TREE } } });
    if (p === 'commits') return json([{ sha: REV, html_url: 'https://github.com/' + R + '/commit/' + REV, commit: { message: 'Add Example form', author: { date: '2026-09-22T00:00:00Z' } } }]);
    if (p.startsWith('git/ref/heads/')) return json({ message: 'Not Found' }, 404);
    if (p === 'branches') return json([{ name: 'main', commit: { sha: REV } }]);
    return json([]);
  }
  const resolved = resolveCdn(url, root);
  if (resolved.kind === 'fulfill') return route.fulfill({ status: 200, contentType: resolved.contentType, body: resolved.body });
  if (resolved.kind === 'empty') return route.fulfill({ status: 200, contentType: resolved.contentType, body: '' });
  // No identity, other repositories or external APIs are part of this fixture.
  return json({ message: 'Not Found' }, 404);
});
const state = () => page.evaluate(() => {
  const el = document.querySelector('[x-data^="powershellWorkspace"]');
  const d = el && window.Alpine.$data(el);
  return d ? { active: d.active, error: d.error, text: d.doc?.text, loading: d.loading, editorReady: d.editorReady, editorError: d.editorError, dirty: d.dirtyDocs.length } : null;
});
async function checkSyntaxContrast(theme) {
  const ratios = await page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const editor = document.querySelector('[data-editor-host] .CodeMirror');
    const bg = getComputedStyle(editor).backgroundColor;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    const pixels = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = bg; ctx.fillRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const luminance = rgb => rgb.map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const back = luminance(pixels(bg));
    return ['keyword', 'variable-2', 'string', 'builtin', 'comment'].map(kind => {
      const token = editor.querySelector('.cm-' + kind);
      if (!token) throw new Error('Missing syntax fixture: ' + kind);
      const front = luminance(pixels(getComputedStyle(token).color));
      return { kind, ratio: (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05) };
    });
  });
  for (const { kind, ratio } of ratios) assert.ok(ratio >= 4.5, `${theme} ${kind} contrast ${ratio.toFixed(2)} must meet 4.5:1`);
}
try {
  const url = origin + '/app/index.html?repo=' + R + '&view=project&project=' + P + '&tab=code&item=' + A + '&shell=nav';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('[data-powershell-workspace]'), null, { timeout: 30000 });
  await page.waitForFunction(() => {
    const d = Alpine.$data(document.querySelector('[x-data^="powershellWorkspace"]'));
    return !d.loading && (d.editorReady || d.editorError || d.error);
  });
  assert.equal((await state()).error, '');
  assert.equal((await state()).editorReady, true, JSON.stringify(await state()));
  assert.equal((await state()).text, source);
  const cm = page.locator('[data-editor-host] .CodeMirror');
  assert.ok((await cm.boundingBox()).height > 250, 'the editor receives viewport space');
  await checkSyntaxContrast('light');
  await page.screenshot({ path: path.join(output, 'powershell-workspace-desktop.png') });
  await page.getByRole('button', { name: 'Split companion', exact: true }).click();
  await page.locator('[data-companion-host] .CodeMirror').waitFor({ state: 'visible' });
  await page.waitForFunction(() => Alpine.$data(document.querySelector('[x-data^="powershellWorkspace"]')).connections.some(row => row.name === 'RefreshButton'));
  await page.screenshot({ path: path.join(output, 'powershell-workspace-companion.png') });
  const originalTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await checkSyntaxContrast('dark');
  await page.screenshot({ path: path.join(output, 'powershell-workspace-dark.png') });
  await page.evaluate(theme => theme ? document.documentElement.setAttribute('data-theme', theme) : document.documentElement.removeAttribute('data-theme'), originalTheme);
  await page.getByRole('button', { name: 'Close companion', exact: true }).click();
  await cm.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.insertText("# browser edit: 'exact' ✓");
  await page.waitForFunction(() => Alpine.$data(document.querySelector('[x-data^="powershellWorkspace"]')).saveState === 'Saved in this browser');
  assert.equal((await state()).text, source + "# browser edit: 'exact' ✓");
  await page.getByRole('button', { name: 'Companion', exact: true }).click();
  assert.equal((await state()).active, B);
  await page.getByRole('tab', { name: '● Example.ps1', exact: true }).click();
  assert.equal((await state()).text, source + "# browser edit: 'exact' ✓");
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.Alpine && document.querySelector('[x-data^="powershellWorkspace"]') && Alpine.$data(document.querySelector('[x-data^="powershellWorkspace"]'))?.editorReady);
  assert.equal((await state()).text, source + "# browser edit: 'exact' ✓", 'browser reload restores drafts');
  assert.equal(writes.length, 0, 'editing and restoration write only browser storage');
  await page.getByRole('tab', { name: 'diff', exact: true }).click();
  await page.screenshot({ path: path.join(output, 'powershell-workspace-diff.png') });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export drafts', exact: true }).click();
  const exported = await download;
  const stream = await exported.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const bundle = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.equal(bundle.drafts[0].text, source + "# browser edit: 'exact' ✓");
  await page.getByRole('button', { name: /Review changes/ }).click();
  await page.getByRole('textbox', { name: 'New branch', exact: true }).fill('wps/browser-verification');
  assert.equal(writes.length, 0, 'review performs no writes');
  await page.getByRole('button', { name: 'Create branch and commit', exact: true }).click();
  await page.waitForFunction(() => !!Alpine.$data(document.querySelector('[x-data^="powershellWorkspace"]')).published);
  assert.deepEqual(writes.map(w => w.method + ' ' + w.path), ['POST git/trees', 'POST git/commits', 'POST git/refs']);
  assert.equal(writes[0].body.tree[0].content, source + "# browser edit: 'exact' ✓");
  assert.equal(writes[2].body.ref, 'refs/heads/wps/browser-verification');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.Alpine && document.querySelector('[x-data^="powershellWorkspace"]') && Alpine.$data(document.querySelector('[x-data^="powershellWorkspace"]'))?.editorReady);
  await page.getByRole('tab', { name: 'diff', exact: true }).click();
  assert.ok((await page.locator('[data-code-diff]').boundingBox()).height > 200, 'phone diff retains readable viewport space');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'phone page has no horizontal overflow');
  await page.screenshot({ path: path.join(output, 'powershell-workspace-phone.png') });
  await page.getByRole('button', { name: 'All files', exact: true }).click();
  await page.getByRole('button', { name: /Example.xaml/ }).first().click();
  assert.equal((await state()).active, B, 'phone explorer reaches a file');
  assert.deepEqual(errors, []);
  console.log('PASS full app Code route, editor geometry, exact edits, companions, restored drafts, diff, JSON export, reviewed publication, phone navigation and overflow');
} catch (e) {
  console.error('State:', JSON.stringify(await state().catch(() => null)));
  console.error('Page errors:', errors);
  await page.screenshot({ path: path.join(output, 'powershell-workspace-failure.png') });
  throw e;
} finally { await browser.close(); server.close(); }
