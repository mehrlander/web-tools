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
const M = P + '/app/Modules/Example/Example.psm1';
const files = {
  '.web-tools.json': JSON.stringify({ icon: 'ph-terminal', projects: [{ path: P, installation: P + '/data/installation.json' }] }),
  'README.md': '# PowerShell\n',
  [P + '/data/installation.json']: JSON.stringify({ root: 'Documents\\WindowsPowerShell', observations: P + '/data/observations.csv', correspondence: [
    { repo: 'app/Forms/', area: 'Forms', installs: 'Forms/' }, { repo: 'app/Modules/', area: 'Modules', installs: 'Modules/' }, { repo: 'app/Scripts/', area: 'Scripts', installs: null },
  ] }),
  [P + '/data/observations.csv']: 'date,path,kind,revision,blob_sha,local_sha256,match,method,note\n',
  [A]: source,
  [B]: '<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"><StackPanel><Button x:Name="RefreshButton" Content="Refresh" /></StackPanel></Window>\n',
  [M]: "function Get-Example { 'Hello' }\nExport-ModuleMember -Function Get-Example\n",
};
const hash = text => createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const entries = () => Object.entries(files).map(([path, text]) => ({ path, type: 'blob', mode: '100644', sha: hash(text), size: Buffer.byteLength(text) }));
const writes = [], errors = [], contrastIssues = [];
const server = http.createServer(async (req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'content-type': typeFor(file) }); res.end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
for (const options of [{}, { channel: 'chrome' }, { channel: 'msedge' }]) {
  try { browser = await chromium.launch({ ...options, args: ['--no-sandbox'] }); break; }
  catch (error) { if (options.channel === 'msedge') { server.close(); throw error; } }
}
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
const page = await context.newPage();
page.on('pageerror', e => errors.push(e.message));
// Native clipboard transport may use CRLF on Windows. Observe the event's
// actual plain text without intercepting it, then hold intake to those bytes.
await page.addInitScript(() => document.addEventListener('paste', event => {
  window.__lastPlainPaste = event.clipboardData?.getData('text/plain');
}, true));
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
  return d ? { active: d.active, error: d.error, text: d.doc?.text, loading: d.loading, editorReady: d.editorReady, editorError: d.editorError, dirty: d.dirtyDocs.length, pane: d.pane, panel: d.panel, diffAgainst: d.diffAgainst, received: d.localCheck?.content, pending: !!window.__shell.correspondencePending, view: window.__shell.view, projectTab: window.__shell.projectTab } : null;
});
const workspace = () => page.locator('[data-powershell-workspace]');
const viewTab = name => workspace().getByRole('tab', { name, exact: true });
const menuDialog = name => page.getByRole('dialog', { name, exact: true });
async function menuAction(menu, action) {
  await workspace().getByRole('button', { name: menu, exact: true }).click();
  await menuDialog(menu).getByRole('button', { name: action, exact: true }).click();
}
async function ready() {
  await page.waitForFunction(() => {
    const el = document.querySelector('[x-data^="powershellWorkspace"]');
    const d = el && window.Alpine?.$data(el);
    return d && !d.loading && (d.editorReady || d.editorError || d.error);
  }, null, { timeout: 30000 });
  assert.equal((await state()).error, '', JSON.stringify(await state()));
  assert.equal((await state()).editorReady, true, JSON.stringify(await state()));
}
async function exactText(text) {
  await page.waitForFunction(text => Alpine.$data(document.querySelector('[x-data^="powershellWorkspace"]')).doc?.text === text, text);
  await page.waitForFunction(() => Alpine.$data(document.querySelector('[x-data^="powershellWorkspace"]')).saveState === 'Saved in this browser');
  assert.equal((await state()).text, text);
}
async function clipboard(text) {
  return page.evaluate(async text => {
    await navigator.clipboard.writeText(text);
    return navigator.clipboard.readText();
  }, text);
}
async function pasteOnPage(text) {
  // A focused view tab is outside CodeMirror and all native text inputs.
  await viewTab('Compare').click();
  await clipboard(text);
  await page.evaluate(() => { window.__lastPlainPaste = null; });
  await page.keyboard.press('Control+V');
  await page.waitForFunction(() => typeof window.__lastPlainPaste === 'string');
  const delivered = await page.evaluate(() => window.__lastPlainPaste);
  assert.equal(delivered.replace(/\r\n?/g, '\n'), text.replace(/\r\n?/g, '\n'), 'native clipboard delivers the intended code');
  return delivered;
}
async function received(text, path) {
  await page.waitForFunction(({ text, path }) => {
    const el = document.querySelector('[x-data^="powershellWorkspace"]');
    const d = el && Alpine.$data(el);
    return d?.active === path && d.localCheck?.content === text && !d.comparing;
  }, { text, path });
  const d = await state();
  assert.equal(d.error, '', JSON.stringify(d));
  assert.equal(d.view, 'project', 'intake keeps the project workspace open');
  assert.equal(d.projectTab, 'code', 'intake keeps the Code route');
  assert.equal(d.pane, 'diff', 'received text opens Compare');
  assert.equal(d.diffAgainst, 'local', 'Compare selects the received copy');
  assert.equal(await workspace().getByRole('textbox', { name: 'Supplied local copy', exact: true }).count(), 0, 'incoming code needs no parallel paste field');
}
async function withinViewport(locator, name, inset = 0) {
  const box = await locator.boundingBox(), viewport = page.viewportSize();
  assert.ok(box, name + ' is visible');
  assert.ok(box.x >= inset - 1 && box.y >= inset - 1 && box.x + box.width <= viewport.width - inset + 1 && box.y + box.height <= viewport.height - inset + 1, name + ' stays on screen: ' + JSON.stringify({ box, viewport }));
  return box;
}
async function noOverflow(label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, label + ' has no horizontal page overflow');
}
async function toolbarTargets() {
  for (const name of ['Files', 'GitHub source', 'Workspace actions', 'File actions', 'Review changes', 'Find', 'Undo', 'Redo']) {
    const box = await withinViewport(workspace().getByRole('button', { name, exact: true }), name);
    assert.ok(box.width >= 44 && box.height >= 44, name + ' has a 44px touch target: ' + JSON.stringify(box));
  }
  for (const name of ['Code', 'Compare', 'History']) {
    const box = await withinViewport(viewTab(name), name + ' tab');
    assert.ok(box.width >= 44 && box.height >= 44, name + ' tab has a 44px touch target: ' + JSON.stringify(box));
  }
}
async function keyboardViews() {
  await viewTab('Code').focus();
  for (const [key, name] of [['ArrowRight', 'Compare'], ['ArrowRight', 'History'], ['Home', 'Code'], ['End', 'History'], ['ArrowLeft', 'Compare'], ['Home', 'Code']]) {
    await page.keyboard.press(key);
    await workspace().getByRole('tabpanel', { name, exact: true }).waitFor({ state: 'visible' });
    assert.equal(await viewTab(name).getAttribute('aria-selected'), 'true', key + ' selects ' + name);
    assert.equal(await viewTab(name).evaluate(el => document.activeElement === el), true, key + ' focuses ' + name);
    const tabbable = workspace().getByRole('tablist', { name: 'Code views' }).locator('[role="tab"][tabindex="0"]');
    assert.equal(await tabbable.count(), 1, 'only the active view tab is in the Tab order');
  }
}
async function filePickerActions() {
  for (const { trigger, menu, action, input } of [
    { trigger: 'Workspace actions', menu: 'Workspace actions', action: 'Restore drafts…', input: 'Restore draft bundle' },
    { trigger: 'File actions', menu: 'Receive copy', action: 'Choose file…', input: 'Receive a file' },
  ]) {
    await workspace().getByRole('button', { name: trigger, exact: true }).click();
    if (menu !== trigger) await menuDialog(trigger).getByRole('button', { name: menu, exact: true }).click();
    const dialog = menuDialog(menu);
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 10000 }),
      dialog.getByRole('button', { name: action, exact: true }).click(),
    ]);
    assert.equal(await chooser.element().getAttribute('aria-label'), input, action + ' activates its native file input from the modal');
    await chooser.setFiles([]);
    if (await dialog.isVisible()) await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal((await state()).dirty, 0, 'cancelled file picking creates no draft');
    assert.equal((await state()).text, source, 'cancelled file picking preserves source');
  }
}
async function emptyComparison(label) {
  await viewTab('Compare').click();
  const empty = workspace().locator('[data-comparison-empty]');
  await empty.waitFor({ state: 'visible' });
  assert.match(await empty.innerText(), /No changes/i, 'an unchanged file states the comparison result');
  assert.equal(await workspace().locator('[data-code-diff] pre:visible').count(), 0, 'unchanged comparison does not repeat the source');
  assert.equal(await workspace().locator('[data-diff-mobile-line]:visible, [data-diff-desktop-line]:visible').count(), 0, 'unchanged comparison renders no line gutters');
  await noOverflow(label);
  await page.screenshot({ path: path.join(output, 'powershell-workspace-' + label + '-compare-empty.png') });
}
async function changedComparison(mobile) {
  const diff = workspace().locator('[data-code-diff]');
  await diff.waitFor({ state: 'visible' });
  assert.equal(await workspace().locator('[data-comparison-empty]:visible').count(), 0, 'changed comparison does not report an empty result');
  const mobileGutters = diff.locator('[data-diff-mobile-line]:visible');
  const desktopGutters = diff.locator('[data-diff-desktop-line]:visible');
  assert.ok(await diff.locator('pre:visible').count() > 0, 'changed comparison renders source lines');
  await diff.getByText("# browser edit: 'exact' ✓", { exact: true }).waitFor({ state: 'visible' });
  if (mobile) {
    assert.ok(await mobileGutters.count() > 0, 'phone diff shows its single line-number gutter');
    assert.equal(await desktopGutters.count(), 0, 'phone diff hides both desktop line-number columns');
    for (const text of await mobileGutters.allTextContents()) assert.match(text.trim(), /^\d+$/, 'a mobile gutter contains one line number');
    for (const row of await diff.locator('pre:visible').all()) {
      const gutters = await row.evaluate(el => {
        const parent = el.parentElement;
        return [...parent.querySelectorAll('[data-diff-mobile-line]')].filter(e => e.getClientRects().length).length;
      });
      assert.equal(gutters, 1, 'each visible phone diff row has exactly one number gutter');
    }
  } else {
    assert.equal(await mobileGutters.count(), 0, 'desktop diff hides the phone gutter');
    assert.ok(await desktopGutters.count() > 0, 'desktop diff has line-number columns');
    await diff.getByText('From', { exact: true }).waitFor({ state: 'visible' });
    await diff.getByText('Draft', { exact: true }).waitFor({ state: 'visible' });
  }
  const markerText = await diff.innerText();
  assert.match(markerText, /−/, 'the comparison marks removed lines');
  assert.match(markerText, /\+/, 'the comparison marks added lines');
  await noOverflow(mobile ? 'phone comparison' : 'desktop comparison');
}
async function menuSheets(label) {
  for (const name of ['Workspace actions', 'File actions', 'GitHub source', 'Receive copy']) {
    const trigger = name === 'Receive copy' ? 'File actions' : name;
    await workspace().getByRole('button', { name: trigger, exact: true }).click();
    if (name === 'Receive copy') await menuDialog('File actions').getByRole('button', { name, exact: true }).click();
    const dialog = menuDialog(name);
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.evaluate(el => el.matches(':modal')), true, name + ' uses the browser modal top layer');
    await withinViewport(dialog.locator(':scope > section'), label + ' ' + name + ' sheet');
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true, name + ' receives keyboard focus');
    await page.screenshot({ path: path.join(output, 'powershell-workspace-' + label + '-' + name.toLowerCase().replaceAll(' ', '-') + '.png') });
    for (const control of await dialog.locator('button:visible, a:visible, select:visible').all()) {
      await control.scrollIntoViewIfNeeded();
      const box = await withinViewport(control, label + ' menu control after scrolling');
      if (await control.evaluate(el => el.matches('button, select'))) assert.ok(box.width >= 44 && box.height >= 44, name + ' control has a 44px touch target: ' + JSON.stringify(box));
      const reachable = await control.evaluate(el => {
        const box = el.getBoundingClientRect();
        return [box.x + box.width / 2, box.right - Math.min(20, box.width / 4)].every(x => {
          const hit = document.elementFromPoint(x, box.y + box.height / 2);
          return hit === el || el.contains(hit);
        });
      });
      assert.equal(reachable, true, label + ' menu action cannot be covered by the floating app control');
    }
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await workspace().getByRole('button', { name: trigger, exact: true }).evaluate(el => document.activeElement === el), true, 'Escape returns focus to the ' + name + ' trigger');
  }
}
async function controlContrast(locator, label) {
  const result = await locator.evaluate(el => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d'), ancestors = [];
    for (let parent = el; parent; parent = parent.parentElement) ancestors.unshift(parent);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1, 1);
    for (const parent of ancestors) { ctx.fillStyle = getComputedStyle(parent).backgroundColor; ctx.fillRect(0, 0, 1, 1); }
    const pixels = () => [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
    const background = pixels(), color = getComputedStyle(el).color;
    ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
    const foreground = pixels();
    const luminance = rgb => rgb.map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const front = luminance(foreground), back = luminance(background);
    return { foreground, background, color, ratio: (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05) };
  });
  if (result.ratio < 4.5) {
    const issue = label + ' contrast ' + result.ratio.toFixed(2) + ':1; ' + JSON.stringify(result);
    contrastIssues.push(issue); console.error('CONTRAST ' + issue);
  }
}
async function selectedContrast(theme) {
  await controlContrast(workspace().getByRole('tablist', { name: 'Open files' }).getByRole('tab', { selected: true }), theme + ' selected file');
  await controlContrast(viewTab('Code'), theme + ' selected Code tab');
}
async function diffCountContrast(theme) {
  await controlContrast(workspace().getByText(/^\+\d+$/, { exact: true }), theme + ' added count');
  await controlContrast(workspace().getByText(/^[−-]\d+$/, { exact: true }), theme + ' removed count');
}
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
  await ready();
  assert.equal((await state()).text, source);
  const cm = page.locator('[data-editor-host] .CodeMirror');
  assert.ok((await cm.boundingBox()).height > 250, 'the editor receives viewport space');
  assert.deepEqual((await workspace().getByRole('tablist', { name: 'Code views' }).getByRole('tab').allTextContents()).map(text => text.trim()), ['Code', 'Compare', 'History']);
  await keyboardViews();
  await filePickerActions();
  await checkSyntaxContrast('light');
  await page.screenshot({ path: path.join(output, 'powershell-workspace-desktop.png') });
  await emptyComparison('desktop');
  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready();
    assert.equal((await state()).panel, '', 'phone analysis panels start closed');
    assert.equal((await state()).text, source, 'normal phone view starts with unchanged source');
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
      await viewTab('Code').click();
      await toolbarTargets();
      await checkSyntaxContrast(theme);
      await selectedContrast(theme);
      await noOverflow(width + 'px ' + theme + ' code');
      await page.screenshot({ path: path.join(output, `powershell-workspace-phone-${width}-${theme}-code-clean.png`) });
      await emptyComparison(`phone-${width}-${theme}`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready();
  await menuAction('File actions', 'Split companion');
  await page.locator('[data-companion-host] .CodeMirror').waitFor({ state: 'visible' });
  await page.waitForFunction(() => Alpine.$data(document.querySelector('[x-data^="powershellWorkspace"]')).connections.some(row => row.name === 'RefreshButton'));
  await page.screenshot({ path: path.join(output, 'powershell-workspace-companion.png') });
  const originalTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await checkSyntaxContrast('dark');
  await page.screenshot({ path: path.join(output, 'powershell-workspace-dark.png') });
  await page.evaluate(theme => theme ? document.documentElement.setAttribute('data-theme', theme) : document.documentElement.removeAttribute('data-theme'), originalTheme);
  await page.getByRole('button', { name: 'Close companion', exact: true }).click();
  // Actual clipboard paste must reach CodeMirror, even when the code names a
  // different repository file. The app-level signature router may not steal it.
  const nativePaste = '# @file ' + M + "\nWrite-Output 'native editor paste'\n";
  const pastedDraft = source + nativePaste.replace(/\n/g, '\r\n');
  await cm.click();
  await page.keyboard.press('Control+End');
  await clipboard(nativePaste);
  await page.keyboard.press('Control+V');
  await exactText(pastedDraft);
  assert.equal((await state()).active, A, 'native paste keeps the open file');
  assert.equal((await state()).pane, 'code', 'native paste keeps the editor');
  assert.equal((await state()).pending, false, 'native code signature does not open a routing choice');
  assert.equal((await state()).received, undefined, 'native paste does not become a comparison');
  await workspace().getByRole('button', { name: 'Undo', exact: true }).click();
  await exactText(source);
  await workspace().getByRole('button', { name: 'Redo', exact: true }).click();
  await exactText(pastedDraft);
  await workspace().getByRole('button', { name: 'Undo', exact: true }).click();
  await exactText(source);
  await cm.click();
  await page.keyboard.press('Control+End');
  await page.keyboard.insertText("# browser edit: 'exact' ✓");
  const editedDraft = source + "# browser edit: 'exact' ✓";
  await exactText(editedDraft);
  await menuAction('File actions', 'Companion');
  assert.equal((await state()).active, B);
  await page.getByRole('tab', { name: '● Example.ps1', exact: true }).click();
  assert.equal((await state()).text, editedDraft);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready();
  assert.equal((await state()).text, editedDraft, 'browser reload restores drafts');
  assert.equal(writes.length, 0, 'editing and restoration write only browser storage');

  const incoming = source.replace(/\r\n/g, '\n').replace("'Today'", "'From the work machine'");
  const deliveredIncoming = await pasteOnPage(incoming);
  await received(deliveredIncoming, A);
  assert.equal((await state()).text, editedDraft, 'page paste compares without replacing the browser draft');
  assert.equal((await state()).dirty, 1, 'a received copy is not an editor draft');
  await changedComparison(false);
  await page.screenshot({ path: path.join(output, 'powershell-workspace-diff.png') });
  await menuAction('File actions', 'Find and replace');
  await cm.locator('.CodeMirror-dialog input').waitFor({ state: 'visible' });
  assert.equal((await state()).pane, 'code', 'Find and replace from Compare opens the code editor');
  assert.equal(await cm.locator('.CodeMirror-dialog input').evaluate(el => document.activeElement === el), true, 'Find and replace focuses its search field');
  await page.keyboard.press('Escape');
  await cm.locator('.CodeMirror-dialog').waitFor({ state: 'hidden' });

  const moduleIncoming = '# @file ' + M + "\nfunction Get-Example { 'Changed on the work machine' }\n";
  const deliveredModule = await pasteOnPage(moduleIncoming);
  const choice = page.getByRole('dialog', { name: 'Choose repository file for comparison', exact: true });
  await choice.waitFor({ state: 'visible' });
  assert.equal((await state()).active, A, 'a mismatched signature waits for a target choice');
  assert.equal((await state()).received, deliveredIncoming, 'no comparison is replaced before the choice');
  await choice.getByRole('button', { name: /Example\.ps1.*open file/ }).click();
  await received(deliveredModule, A);
  assert.equal((await state()).text, editedDraft, 'choosing the open file retains its draft');
  await pasteOnPage(moduleIncoming);
  await choice.waitFor({ state: 'visible' });
  await choice.getByRole('button', { name: /Example\.psm1.*# @file/ }).click();
  await received(deliveredModule, M);
  assert.equal((await state()).text, files[M], 'choosing a declared file opens its GitHub source unchanged');
  assert.equal((await state()).dirty, 1, 'choosing a target does not create a draft');
  await page.getByRole('tab', { name: '● Example.ps1', exact: true }).click();
  await viewTab('Compare').click();

  const download = page.waitForEvent('download');
  await menuAction('Workspace actions', /^Back up drafts\b/);
  const exported = await download;
  const stream = await exported.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const bundle = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.equal(bundle.drafts[0].text, editedDraft);
  assert.equal(bundle.drafts.length, 1, 'received comparison text is excluded from draft backup');
  await page.getByRole('button', { name: /Review changes/ }).click();
  await page.getByRole('textbox', { name: 'New branch', exact: true }).fill('wps/browser-verification');
  assert.equal(writes.length, 0, 'review performs no writes');
  await page.getByRole('button', { name: 'Create branch and commit', exact: true }).click();
  await page.waitForFunction(() => !!Alpine.$data(document.querySelector('[x-data^="powershellWorkspace"]')).published);
  assert.deepEqual(writes.map(w => w.method + ' ' + w.path), ['POST git/trees', 'POST git/commits', 'POST git/refs']);
  assert.equal(writes[0].body.tree[0].content, editedDraft);
  assert.equal(writes[2].body.ref, 'refs/heads/wps/browser-verification');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready();
  assert.equal((await state()).panel, '', 'restoring a draft does not open phone analysis panels');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await viewTab('Code').click();
  const phoneEditor = await withinViewport(cm, 'phone editor');
  assert.ok(phoneEditor.height >= 320, 'phone editor retains at least 320px: ' + phoneEditor.height);
  assert.ok(phoneEditor.y <= 280, 'phone toolbars leave the code near the top: ' + phoneEditor.y);
  await toolbarTargets();
  await withinViewport(workspace().getByRole('button', { name: /Review changes/ }), 'phone Review changes');
  await page.screenshot({ path: path.join(output, 'powershell-workspace-phone-code.png') });
  await menuSheets('phone');
  await viewTab('Compare').click();
  const appIncoming = source.replace(/\r\n/g, '\n').replace("'Today'", "'Pasted from the app action'");
  const deliveredApp = await clipboard(appIncoming);
  await page.getByRole('button', { name: 'Web-tools panel', exact: true }).click({ button: 'right' });
  await page.getByRole('button', { name: /(?:^|\s)Paste$/ }).click();
  await received(deliveredApp, A);
  assert.equal((await state()).text, editedDraft, 'the app Paste tap compares without replacing the draft');
  assert.equal(writes.length, 3, 'phone intake performs no further GitHub writes');
  assert.ok((await page.locator('[data-code-diff]').boundingBox()).height > 200, 'phone diff retains readable viewport space');
  await changedComparison(true);
  await page.screenshot({ path: path.join(output, 'powershell-workspace-phone.png') });
  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
      await viewTab('Compare').click();
      await changedComparison(true);
      await diffCountContrast(theme);
      await page.screenshot({ path: path.join(output, `powershell-workspace-phone-${width}-${theme}-compare.png`) });
      await viewTab('Code').click();
      await toolbarTargets();
      await checkSyntaxContrast(theme);
      await noOverflow(width + 'px ' + theme + ' edited code');
      await page.screenshot({ path: path.join(output, `powershell-workspace-phone-${width}-${theme}-code.png`) });
      if (width === 360 && theme === 'dark') await menuSheets('phone-360-dark');
    }
  }
  await workspace().getByRole('button', { name: 'Files', exact: true }).click();
  await page.getByRole('button', { name: /Example.xaml/ }).first().click();
  assert.equal((await state()).active, B, 'phone explorer reaches a file');
  assert.deepEqual(errors, []);
  assert.deepEqual(contrastIssues, [], 'control text must meet 4.5:1 contrast');
  console.log('PASS full app Code route, native modal file pickers, exact native paste and undo, comparison intake and target choices, app Paste tap, companions, retained drafts, backup, publication, unchanged comparison state, single mobile diff gutter, labelled desktop gutters, keyboard view tabs, 360/390px light/dark views, 44px toolbar targets, selected-text/diff-count contrast, menu bounds and unobstructed actions');
} catch (e) {
  console.error('State:', JSON.stringify(await state().catch(() => null)));
  console.error('Page errors:', errors);
  await page.screenshot({ path: path.join(output, 'powershell-workspace-failure.png') });
  throw e;
} finally { await browser.close(); server.close(); }
