#!/usr/bin/env node
// Editing a markdown section in the viewer, end to end in a browser.
//
//   node node/test/md-edit-live.mjs [--editor tabs|studio] [--shots <dir>] [--width 390]
//
// node/test/md-edit.test.mjs proves what gets written; this proves the path a
// reader takes to write it: the heading's pencil opens an editor, Publish shows
// the checks and the message, Save sends one strict PUT carrying the sha that
// was read, the pane re-renders from the saved text, and the receipt follows
// the commit's checks and the repair commit. Then the two refusals: a section
// someone else changed in the meantime (nothing is written), and a generated
// file (the pencil says why and offers no editor).
//
// ANY EDITOR VARIANT, through the attributes every variant carries (see
// "Variants" in lib/kits/md-edit.js): [data-md-edit-source] is the text box,
// [data-md-edit-publish] opens the commit sheet, [data-md-edit-tab] marks a
// view a shot should visit. `--editor` puts `?editor=` on the address, which
// also shows the switch between variants; the check uses it to prove the text
// goes across.
//
// GitHub is an in-memory file behind intercepted routes; everything else is the
// working tree, served the way node/test/viewer-find.mjs serves it. Not part of
// `npm test` (needs a browser).

import http from 'node:http';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { readFile as read } from 'node:fs/promises';
import { chromium } from 'playwright';
import { resolveCdn, typeFor } from '../render/cdn.mjs';
import { repoRoot as root } from '../repo-root.mjs';

const REPO = 'mehrlander/web-tools';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const SHOTS = arg('--shots', null);
const WIDTH = +arg('--width', 390);
const EDITOR = arg('--editor', '');
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  ok    ${name}`);
  else { console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); failures.push(name); }
};

// ── the repository, in memory ───────────────────────────────────────────────
const DOC = 'docs/fixtures/edit-sample.md';
const GEN = 'docs/fixtures/generated-sample.md';
const FRONT = '---\nstatus: draft\n---\n';
const ORIGINAL = FRONT + [
  '# Sample document',
  '',
  'An opening paragraph.',
  '',
  '## First',
  '',
  'The first section says one thing.',
  '',
  '## Second',
  '',
  'The second section says another.',
  '',
].join('\n');
const files = {
  [DOC]: { text: ORIGINAL, sha: 'a'.repeat(40) },
  [GEN]: { text: '# Generated\n\n<!-- GENERATED from x.csv by build.mjs; do not hand-edit. -->\n\n## Rows\n\nOne.\n', sha: 'b'.repeat(40) },
};
const puts = [];
let checkPolls = 0, commitPolls = 0;
const commitSha = (n) => (n.toString(16) + 'c'.repeat(40)).slice(0, 40);

const contentsJson = (text, sha) => JSON.stringify({
  content: Buffer.from(text).toString('base64'), encoding: 'base64',
  size: Buffer.byteLength(text), sha, html_url: 'https://github.com/' + REPO + '/blob/main/x',
});

const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  try {
    const body = await read(path.join(root, rel.replace(/^\//, '')));
    res.writeHead(200, { 'content-type': typeFor(rel) });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ args: ['--no-sandbox', '--ignore-certificate-errors'] });
const page = await browser.newPage({ viewport: { width: WIDTH, height: 844 }, hasTouch: WIDTH < 600 });

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
await page.route('**/*', async (route) => {
  const req = route.request();
  const url = req.url();
  if (url.startsWith(origin)) return route.continue();
  const api = `https://api.github.com/repos/${REPO}`;
  const u = new URL(url);
  const p = decodeURIComponent(u.pathname);
  for (const f of [DOC, GEN]) {
    if (p === `/repos/${REPO}/contents/${f}`) {
      if (req.method() === 'PUT') {
        const body = JSON.parse(req.postData());
        puts.push({ ...body, text: Buffer.from(body.content, 'base64').toString('utf8') });
        if (body.sha !== files[f].sha) return json(route, { message: 'does not match' }, 409);
        const sha = commitSha(puts.length);
        files[f] = { text: puts.at(-1).text, sha: 'd'.repeat(39) + puts.length };
        return json(route, { content: { sha: files[f].sha },
                             commit: { sha, html_url: 'https://github.com/' + REPO + '/commit/' + sha } });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: contentsJson(files[f].text, files[f].sha) });
    }
  }
  if (url === api || url === api + '/') {
    return json(route, { full_name: REPO, default_branch: 'main', permissions: { push: true } });
  }
  if (/\/check-runs$/.test(p)) {
    checkPolls++;
    const done = checkPolls > 1;
    return json(route, { check_runs: [{ name: 'test', status: done ? 'completed' : 'in_progress', conclusion: done ? 'success' : null }] });
  }
  if (p === `/repos/${REPO}/commits` && u.searchParams.get('per_page') === '1') {
    return json(route, [{ sha: 'e'.repeat(40), commit: { tree: { sha: 'tree1' } } }]);
  }
  if (p === `/repos/${REPO}/commits`) {
    commitPolls++;
    const last = puts.filter(x => x.sha && x.text).length ? commitSha(puts.length).slice(0, 7) : '';
    const list = commitPolls > 1 && last
      ? [{ sha: 'f'.repeat(40), html_url: 'https://github.com/' + REPO + '/commit/' + 'f'.repeat(40),
           commit: { message: 'Refresh derived files after ' + last + '\n\ndocs/docs.csv' } }]
      : [];
    return json(route, list);
  }
  if (p === `/repos/${REPO}/git/trees/tree1`) {
    return json(route, { truncated: false, tree: [{ path: 'docs/APP.md' }, { path: DOC }] });
  }
  if (p === '/search/code') return json(route, { items: [] });
  const r = resolveCdn(url, root, null);
  if (r.kind === 'continue') return route.continue();
  if (r.kind === 'empty') return route.fulfill({ status: 200, contentType: r.contentType, body: '' });
  return route.fulfill({ status: 200, contentType: r.contentType, body: r.body });
});
const thrown = [];
page.on('pageerror', e => { thrown.push(e.message); console.log(`  [pageerror] ${e.message}`); });

const shot = async (name) => {
  if (!SHOTS) return;
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
  console.log(`  shot   ${path.join(SHOTS, name + '.png')}`);
};
const open = async (file) => {
  await page.goto(`${origin}/pages/data-view.html?src=${encodeURIComponent(`${REPO}@main:${file}`)}${EDITOR ? '&editor=' + EDITOR : ''}`,
                  { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-md-act="copy"]', { timeout: 20000 });
};
// The controls on the heading titled `title`, and its pencil, tapped.
const controls = (title) => page.locator('[data-md-section]', { hasText: title }).first()
  .locator('[data-md-act]').evaluateAll(bs => bs.map(b => b.dataset.mdAct).join(','));
const pencil = async (title) => {
  const h = page.locator('[data-md-section]', { hasText: title }).first();
  await h.scrollIntoViewIfNeeded();
  await h.locator('[data-md-act="edit"]').click();
};

try {
  // ── 1. the edit, start to finish ──────────────────────────────────────────
  // The browser starts with no token: the pencil still shows, and asks for one.
  await open(DOC);
  ok('the heading carries a copy and a pencil, nothing to open', (await controls('Second')) === 'edit,copy',
     await controls('Second'));
  await shot('1-heading');
  await pencil('Second');
  await page.waitForSelector('[data-md-edit]', { timeout: 10000 });
  const asked = await page.locator('[data-md-edit]').innerText();
  ok('with no token, the pencil asks for one', /No GitHub token in this browser/.test(asked) && /Add token/.test(asked), asked);
  await shot('1b-token');
  await page.evaluate(() => {
    localStorage.setItem('ghToken', 'test-token');
    window.dispatchEvent(new CustomEvent('web-tools:token-changed'));
  });
  await page.waitForSelector('[data-md-edit-source]', { timeout: 15000 });
  ok('a saved token carries straight on into the editor', true);
  const variant = await page.evaluate(() => document.querySelector('[data-md-edit-variant]')?.dataset.mdEditVariant || 'basic');
  console.log('  variant ' + variant);
  if (EDITOR) ok('the requested editor mounted', variant === EDITOR, variant);
  const ta = page.locator('[data-md-edit-source]');
  ok('the section becomes its source', (await ta.inputValue()) === '## Second\n\nThe second section says another.');
  ok('the rest of the document stays rendered underneath',
     (await page.locator('[data-md-section]', { hasText: 'First' }).count()) === 1);
  ok('the rendered Second heading is hidden while editing',
     !(await page.locator('h2[data-md-section]', { hasText: 'Second' }).isVisible()));

  await ta.fill('## Second\n\nThe second section says something better.\n\nA new line — with a dash.\n\nSee [the app](../APP.md) and [nothing](../NOPE.md).');
  await page.waitForTimeout(400);
  const chrome = await page.evaluate(() => [...document.querySelectorAll('[data-md-edit], [data-md-edit-variant]')]
    .map(n => n.innerText).join('\n'));
  ok('the editor carries no stray text', !/\bnull\b|\bundefined\b|\[object /.test(chrome), chrome.slice(0, 200));
  await shot('2-editor');
  // Each view a variant marks gets a shot, so a tabbed editor's Preview and
  // Changes are seen, not only its Write.
  const tabs = await page.$$eval('[data-md-edit-tab]', (ns) => ns.map(n => n.dataset.mdEditTab));
  for (const t of tabs) {
    await page.locator(`[data-md-edit-tab="${t}"]`).first().click();
    await page.waitForTimeout(900);
    await shot('2-tab-' + t);
  }
  if (tabs.length) await page.locator(`[data-md-edit-tab="${tabs[0]}"]`).first().click();

  await page.locator('[data-md-edit-publish]').first().click();
  await page.waitForSelector('dialog[data-md-edit-sheet][open]', { timeout: 10000 });
  await page.waitForFunction(() => !document.querySelector('dialog[data-md-edit-sheet] .loading'), null, { timeout: 10000 }).catch(() => {});
  const sheetText = await page.locator('dialog[data-md-edit-sheet]').innerText();
  ok('the sheet counts the change', /\+3/.test(sheetText) && /−1/.test(sheetText), sheetText);
  ok('the sheet flags the em dash by file line', /Em dash on line 16/.test(sheetText), sheetText);
  ok('the sheet flags the link that points nowhere', /Nothing at \.\.\/NOPE\.md/.test(sheetText), sheetText);
  ok('the commit message is prefilled', (await page.locator('[data-md-edit-message]').inputValue())
     === 'Edit ' + DOC + ' § Second');
  await page.waitForTimeout(400);   // daisyUI's modal fades in; a shot before then is see-through
  await shot('3-sheet');

  await page.locator('[data-md-edit-commit]').click();
  await page.waitForSelector('[data-md-edit-receipt]', { timeout: 15000 });
  ok('one PUT was sent', puts.length === 1, String(puts.length));
  ok('the PUT named the sha that was read', puts[0]?.sha === 'a'.repeat(40), puts[0]?.sha);
  ok('the PUT targeted main', puts[0]?.branch === 'main', puts[0]?.branch);
  const expected = ORIGINAL.replace('## Second\n\nThe second section says another.',
    '## Second\n\nThe second section says something better.\n\nA new line — with a dash.\n\nSee [the app](../APP.md) and [nothing](../NOPE.md).');
  ok('only the section changed, frontmatter included', puts[0]?.text === expected, JSON.stringify(puts[0]?.text));
  await page.waitForTimeout(600);
  ok('the pane re-rendered from the saved text',
     await page.locator('.prose', { hasText: 'something better' }).first().isVisible());
  ok('the editor is gone', (await page.locator('[data-md-edit], [data-md-edit-source], [data-md-edit-variant]').count()) === 0);
  const early = await page.locator('[data-md-edit-receipt]').innerText();
  ok('before the repair, the receipt says what it may refresh',
     /Repair on main may refresh [^\n]*docs\/docs\.csv/.test(early) || /Repair f{7}/.test(early), early);
  await page.waitForFunction(() => /Repair/.test(document.querySelector('[data-md-edit-receipt]')?.textContent || '')
    && /Checks passed/.test(document.querySelector('[data-md-edit-receipt]')?.textContent || ''), null, { timeout: 40000 }).catch(() => {});
  const receipt = await page.locator('[data-md-edit-receipt]').innerText();
  ok('the receipt names the commit', /Committed [0-9a-f]{7}/.test(receipt), receipt);
  ok('the receipt follows the checks to passed', /Checks passed/.test(receipt), receipt);
  ok('the receipt links the repair commit', /Repair f{7} on main/.test(receipt), receipt);
  await shot('4-receipt');
  await page.locator('[data-md-edit-receipt] button[aria-label="Close"]').click();

  // ── 2. someone else changed the same section ──────────────────────────────
  await pencil('First');
  await page.waitForSelector('[data-md-edit-source]');
  await page.locator('[data-md-edit-source]').fill('## First\n\nMy version of the first section.');
  if (EDITOR && await page.locator('[data-md-edit-switch]').count()) {
    const other = EDITOR === 'tabs' ? 'studio' : 'tabs';
    await page.locator(`[data-md-edit-switch-to="${other}"]`).first().click();
    await page.waitForSelector('[data-md-edit-source]', { timeout: 15000 });
    await page.waitForTimeout(300);
    ok('switching editors carries the text across',
       (await page.locator('[data-md-edit-source]').inputValue()) === '## First\n\nMy version of the first section.');
  }
  files[DOC] = { text: files[DOC].text.replace('The first section says one thing.', 'Their version.'), sha: '9'.repeat(40) };
  const before = puts.length;
  await page.locator('[data-md-edit-publish]').first().click();
  await page.waitForSelector('dialog[data-md-edit-sheet][open]');
  await page.locator('[data-md-edit-commit]').click();
  await page.waitForSelector('dialog[data-md-edit-sheet] .border-warning\\/40', { timeout: 10000 }).catch(() => {});
  const conflict = await page.locator('dialog[data-md-edit-sheet]').innerText();
  ok('a conflicting save writes nothing', puts.length === before, `${before} -> ${puts.length}`);
  ok('the conflict is shown with the draft kept', /changed on main since you opened it/.test(conflict)
     && /Copy my section/.test(conflict), conflict);
  await shot('5-conflict');
  await page.locator('[data-md-edit-back]').click();

  // ── 3. a generated file ───────────────────────────────────────────────────
  await open(GEN);
  await pencil('Rows');
  await page.waitForSelector('[data-md-edit]');
  await page.waitForFunction(() => /Generated file/.test(document.querySelector('[data-md-edit]')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
  const gen = await page.locator('[data-md-edit]').innerText();
  ok('a generated file is refused, with its own reason', /Generated file\. GENERATED from x\.csv/.test(gen), gen);
  ok('and no editor is offered', (await page.locator('[data-md-edit-source]').count()) === 0);
  await shot('6-generated');

  ok('no page errors were thrown', thrown.length === 0, thrown.join(' | '));
} catch (e) {
  console.log('  EXCEPTION ' + (e && e.stack || e));
  failures.push('exception');
} finally {
  await browser.close();
  server.close();
}
console.log(failures.length ? `\n${failures.length} failed` : '\nall passed');
process.exit(failures.length ? 1 : 0);
