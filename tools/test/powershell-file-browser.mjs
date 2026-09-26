#!/usr/bin/env node
// The Overview's file deck (installation-view.js openFileDeck, one
// alpineComponents/powershell-file.js per slide) under real Alpine, Tailwind,
// daisyUI and CodeMirror 6, with GitHub fixture reads and every CDN asset
// resolved from node_modules through tools/render/cdn.mjs. Holds what jsdom
// cannot: the real editor opens read-only, Edit unlocks it and pauses the
// swipe, typed text keeps the file's CRLF separators in the browser draft,
// arrow keys stay in the editor, Problems follows the draft, the header menu
// opens under its button, the Overview offers the draft for publication, and
// nothing is written to GitHub.
// Run explicitly: node tools/test/powershell-file-browser.mjs
// SHOTS=<dir> also writes phone and desktop screenshots there.
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
const scripts = ['kits/csv.js', 'kits/installation.js', 'kits/sync-status.js', 'kits/text-diff.js', 'kits/github-links.js', 'kits/powershell-editor.js', 'kits/powershell-workspace.js', 'kits/powershell-language.js', 'kits/swipe-deck.js', 'alpineComponents/powershell-file.js', 'alpineComponents/installation-view.js'];
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
  browser = await chromium.launch({ headless: true });
  for (const [name, width, height] of [['phone', 390, 844], ['desktop', 1400, 900]]) {
    const v = await openPage({ width, height });
    const card = () => v.page.evaluate(() => { const c = [...document.querySelectorAll('[data-ps-file]')].map(n => Alpine.$data(n)).find(c => c.item.name === 'A.psm1');
      return c && { loading: c.loading, editing: c.editing, draft: c.draft, plain: c.plain, text: c.text, problems: c.analysis.diagnostics.map(d => d.rule) }; });
    await check(name + ': the deck opens the chosen file read-only in the real editor', async () => {
      await v.page.evaluate(p => Alpine.$data(document.querySelector('#mount')).openFileDeck(p), A);
      await v.page.waitForSelector('[data-ps-file] .cm-editor', { timeout: 30000 });
      await v.page.waitForSelector('button[title="Edit"]', { timeout: 30000 });
      assert.equal(await v.page.evaluate(() => window.swipeDeck.stack.at(-1).title), 'A.psm1');
      assert.equal((await card()).plain, false);
      assert.equal(await v.page.evaluate(() => document.documentElement.scrollWidth), width, 'no horizontal page scroll');
    });
    await check(name + ': Edit unlocks the editor, pauses the swipe, and keeps CRLF in the draft', async () => {
      await v.page.click('button[title="Edit"]');
      await v.page.click('[data-ps-file] .cm-content');
      await v.page.keyboard.press('Control+End');
      await v.page.keyboard.press('Enter');
      await v.page.keyboard.type('$y = $ok ? 1 : 2');
      await v.page.keyboard.press('Home'); await v.page.keyboard.press('ArrowLeft'); await v.page.keyboard.press('ArrowRight');
      await v.page.waitForTimeout(500);
      const c = await card();
      assert.equal(c.editing, true); assert.equal(c.draft, true);
      assert.ok(c.text.endsWith('\r\n$y = $ok ? 1 : 2'), "the new line joins with the file's CRLF: " + JSON.stringify(c.text.slice(-24)));
      assert.ok(!/[^\r]\n/.test(c.text), 'no bare LF enters a CRLF file');
      assert.deepEqual(c.problems, ['ps51-ternary']);
      assert.equal(await v.page.evaluate(() => window.swipeDeck.stack.at(-1).deck.track.style.overflowX), 'hidden');
      assert.equal(await v.page.evaluate(() => window.swipeDeck.stack.at(-1).title), 'A.psm1', 'arrow keys stayed in the editor');
      if (process.env.SHOTS) await v.page.screenshot({ path: process.env.SHOTS + '/file-deck-' + name + '-editing.png' });
    });
    await check(name + ': the file menu opens under its button, above the slide', async () => {
      await v.page.click('button[title="Done editing"]');
      await v.page.click('button[title="File actions"]');
      const box = await v.page.locator('.sd-hdr-menu').boundingBox(), btn = await v.page.locator('button[title="File actions"]').boundingBox();
      assert.ok(box.x + box.width >= btn.x && box.x <= btn.x + btn.width + 8, 'the menu spans its button horizontally');
      const labels = await v.page.locator('.sd-hdr-menu li').allTextContents();
      assert.ok(labels.map(t => t.trim()).includes('Publish drafts…'));
      const top = await v.page.evaluate(() => { const r = document.querySelector('.sd-hdr-menu li').getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.sd-hdr-menu') !== null; });
      assert.ok(top, 'the first menu row is not covered by the slide');
      if (process.env.SHOTS) await v.page.screenshot({ path: process.env.SHOTS + '/file-deck-' + name + '-menu.png' });
    });
    await check(name + ': Publish drafts closes the deck and opens the Overview panel with the draft', async () => {
      await v.page.locator('.sd-hdr-menu li', { hasText: 'Publish drafts' }).click();
      await v.page.waitForSelector('[data-publish] input[aria-label="New branch"]', { state: 'visible', timeout: 10000 });
      assert.equal(await v.page.evaluate(() => window.swipeDeck.stack.length), 0);
      assert.match(await v.page.locator('[data-publish]').innerText(), /1 browser draft/);
      assert.equal(await v.writes(), 0, 'nothing written to GitHub');
      if (process.env.SHOTS) await v.page.screenshot({ path: process.env.SHOTS + '/file-deck-' + name + '-publish.png' });
    });
    await v.context.close();
  }
  await check('no browser errors and no unresolved CDN requests', async () => {
    assert.deepEqual(browserErrors, []); assert.deepEqual(blocked, []);
  });
} finally { await browser?.close(); server.close(); }
const failed = results.filter(r => !r.pass);
console.log(results.length - failed.length + '/' + results.length + ' browser checks passed');
process.exit(failed.length ? 1 : 0);
