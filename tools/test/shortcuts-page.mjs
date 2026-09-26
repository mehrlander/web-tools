#!/usr/bin/env node
// pages/shortcuts.html — the estate's entry point, list view and detail view.
//
//   node tools/test/shortcuts-page.mjs
//
// catalog.json and the private device sources are stubbed, so what is checked
// is the part this page decides for itself: which view the URL selects, whether
// a `run X` line resolves to X's own page, who calls a chain (an answer no file
// holds, since a chain records its targets and nothing records its callers),
// and the three ways an answer can be missing. That last one is the rule this
// page exists under: an unknown must never render like a good answer, so a
// catalog with no listing, a name the catalog does not hold, and a device
// nobody read each have to say so rather than draw an empty chain.
//
// Exits nonzero on any failure. Not part of `npm test` (needs a browser).

import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { typeFor } from '../render/cdn.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const failures = [];
const ok = (n, c, d = '') => {
  if (c) console.log(`  ok    ${n}`);
  else { console.log(`  FAIL  ${n}${d ? ' — ' + d : ''}`); failures.push(n); }
};

const server = http.createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
  try {
    res.writeHead(200, { 'content-type': typeFor(rel) });
    res.end(await readFile(path.join(root, rel)));
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

// Four rows, one per case the page has to tell apart: a named chain that calls
// another and calls out of the estate; the chain it calls, which therefore has
// a caller; a probe, which has no name and so can never be installed; and a
// row with no listing at all, which is what a catalog published before the
// listing existed looks like.
const CATALOG = {
  meta: { chains: 4, installable: 3, external_targets: 1 },
  external_targets: ['Show-Ace'],
  rows: [
    { file: 'alpha.json', label: 'Alpha: calls one of ours and one of theirs (4 actions)',
      name: 'Alpha', actions: 6, build: 'aaa111', settings: true,
      targets: ['Beta', 'Show-Ace'],
      sketch: ['  0 text "hello there"',
               '  1 if «0» has value',
               '  2   run Beta ← «0»',
               '  3 else',
               '  4   run Show-Ace',
               '  5 end if'] },
    { file: 'beta.json', label: 'Beta: the one Alpha calls (1 actions)',
      name: 'Beta', actions: 1, build: 'bbb222', settings: false, targets: [],
      sketch: ['  0 clipboard'] },
    { file: 'probe-thing.json', label: 'a probe, which has no name (1 actions)',
      name: null, actions: 1, build: 'ppp333', settings: false, targets: [],
      sketch: ['  0 show "what happened"'] },
    { file: 'gamma.json', label: 'Gamma: published before listings existed (2 actions)',
      name: 'Gamma', actions: 2, build: 'ggg444', settings: false, targets: [] },
  ],
};

// The survey, which is the device half's first source. Three names, and only
// one of them is a chain in the catalog above: that asymmetry is the real one
// (77 chains against 606 surveyed names), and it is what the missing-name
// answers are built on.
const LIBRARY = {
  meta: { shortcuts: 3, actions: 40 },
  rows: [
    { name: 'Alpha', tier: 'core', provenance: 'authored', lifecycle: 'live',
      connectivity: 'called', actions: 6, calls: ['Beta'], callers: [],
      from: '2026-09-14-01.zip' },
    // The Choose-GPT case: a real shortcut on the phone that this repo does not
    // author, so it has no plist, no build, and nothing to install.
    { name: 'Choose-Thing', tier: 'kept', provenance: 'authored', lifecycle: 'live',
      connectivity: 'called', actions: 9, calls: ['Alpha'], callers: ['Menu-Thing'],
      from: '2026-09-14-01.zip' },
    { name: 'Menu-Thing', tier: 'core', provenance: 'authored', lifecycle: 'live',
      connectivity: 'uncalled', actions: 4, calls: ['Choose-Thing'], callers: [],
      from: '2026-09-14-01.zip' },
  ],
};

// The device's own list, newer than the survey. It carries Library-Replace,
// without which no install link may name it, and Fresh-Install, which is in no
// dump and therefore has no listing anywhere.
const WITH_REPLACE = '==name==\nAlpha\nChoose-Thing\nMenu-Thing\n'
                   + 'Library-Replace\nFresh-Install\n==folder==\nAgentic\n';
// The same device before 2026-09-16, which is the state the install link has to
// degrade for rather than assume away.
const WITHOUT_REPLACE = '==name==\nAlpha\nChoose-Thing\nMenu-Thing\n'
                      + 'Fresh-Install\n==folder==\nAgentic\n';
let MANIFEST = WITH_REPLACE;
// Two rows for Alpha, newest first. The paste is the case that read wrong until
// 2026-09-26: its `build` is Library-Paste's own stamp (fff999) and Alpha's is
// `target`, so a page reading `build` called a fresh paste stale. The older run
// carries a superseded build, which the paste must win over.
const LOG = {
  '2026-09-15-101010.json': JSON.stringify({ op: 'paste', name: 'Alpha', target: 'aaa111', build: 'fff999',
    from: 'https://raw.githubusercontent.com/mehrlander/shortcut-tools/0123456789012345678901234567890123456789/packed/alpha.json' }),
  '2026-09-15-090000.json': JSON.stringify({ op: 'run', name: 'Alpha', build: 'old000' }),
};

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
await ctx.addInitScript(() => { try { localStorage.setItem('ghToken', 'stub'); } catch {} });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const contents = (route, text) =>
  json(route, { content: Buffer.from(text).toString('base64'), encoding: 'base64' });

const cdn = new Map();
const handler = async route => {
  const url = route.request().url();
  if (url.includes('shortcut-tools') && url.includes('catalog.json')) return json(route, CATALOG);
  if (url.includes('/contents/shortcuts/library.json')) return contents(route, JSON.stringify(LIBRARY));
  if (url.includes('/contents/shortcuts/manifests'))
    return json(route, [{ name: '2026-09-14.txt', download_url: origin + '/__man' }]);
  const logFile = url.match(/\/contents\/shortcuts\/log\/([^?]+)/);
  if (logFile) return contents(route, LOG[decodeURIComponent(logFile[1])] || '');
  if (url.includes('/contents/shortcuts/log'))
    return json(route, Object.keys(LOG).map(name => ({ name, path: 'shortcuts/log/' + name })));
  if (url.endsWith('/__man')) return route.fulfill({ status: 200, body: MANIFEST });
  // The boot chain, served from this checkout: hitting the real CDN and the
  // real API would make this check depend on the network and on rate limits.
  if (url.includes('/lib/gh-api.js'))
    return route.fulfill({ status: 200, contentType: 'application/javascript',
                           body: await readFile(path.join(root, 'lib/gh-api.js')) });
  const lib = url.match(/api\.github\.com\/repos\/mehrlander\/web-tools\/contents\/(lib\/[^?]+)/);
  if (lib) {
    const buf = await readFile(path.join(root, decodeURIComponent(lib[1])));
    return contents(route, buf.toString());
  }
  if (url.startsWith('https://cdn.jsdelivr.net')) {
    if (!cdn.has(url)) {
      const r = await fetch(url);
      cdn.set(url, { status: r.status, body: Buffer.from(await r.arrayBuffer()),
                     type: r.headers.get('content-type') || 'application/javascript' });
    }
    const c = cdn.get(url);
    return route.fulfill({ status: c.status, body: c.body, contentType: c.type });
  }
  return route.continue();
};
await page.route('**/*', route => handler(route));

const open = async (query = '') => {
  await page.goto(`${origin}/pages/shortcuts.html${query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.getElementById('status').textContent !== 'loading',
                             { timeout: 8000 });
};

console.log('shortcuts.html');

// ── the list ───────────────────────────────────────────────────────────────
await open();
const list = await page.evaluate(() => ({
  rows: document.querySelectorAll('#rows > tr').length,
  names: [...document.querySelectorAll('#rows a.link')].map(a => a.textContent),
  hrefs: [...document.querySelectorAll('#rows a.link')].map(a => a.getAttribute('href')),
  states: Object.fromEntries([...document.querySelectorAll('#rows > tr')].map(tr =>
    [tr.querySelector('a.link').textContent, tr.children[3].textContent.trim()])),
  icons: [...document.querySelectorAll('#rows > tr td:nth-child(4) i')].map(i => i.className),
  tally: document.getElementById('tally').textContent,
  status: document.getElementById('status').textContent,
}));
const st = JSON.stringify(list.states);
ok('page boots with no error', errors.length === 0, errors[0]);
ok('the device half is read with a token', list.status === 'device read', list.status);
ok('the default view is the installable chains', list.rows === 3, String(list.rows));
ok('every chain name is a link to its own page',
   list.hrefs.every(h => /^\?(name|chain)=/.test(h)), list.hrefs.join(' '));
// The join this page exists for: a build that ran matches the build published.
ok('a paste is read by its target, not the installer\'s stamp: current', list.states.Alpha === 'current', st);
ok('a chain the device has never reported reads not installed', list.states.Gamma === 'not installed', st);
ok('states are drawn with the shared icons', list.icons.some(c => c.includes('ph-check-circle'))
   && list.icons.some(c => c.includes('ph-plus-circle')), list.icons.join(' | '));
ok('the header states the counts', /4 chains · 3 installable/.test(list.tally), list.tally);

// ── the detail view ────────────────────────────────────────────────────────
await open('?name=Alpha');
const d = await page.evaluate(() => {
  const lines = [...document.querySelectorAll('#detail code')];
  const targetLink = [...document.querySelectorAll('#detail code a')];
  return {
    title: document.getElementById('title').textContent,
    meta: document.getElementById('meta').textContent,
    listHidden: document.getElementById('list').classList.contains('hidden'),
    filtersHidden: document.getElementById('filters').classList.contains('hidden'),
    lines: lines.length,
    gutter: [...document.querySelectorAll('#detail [id^="L"] span')].slice(0, 1).map(s => s.textContent),
    text: lines.map(c => c.textContent),
    literal: [...document.querySelectorAll('#detail .text-success')].map(s => s.textContent),
    refs: [...document.querySelectorAll('#detail code button')].map(b => b.textContent),
    runLinks: targetLink.map(a => a.getAttribute('href')),
    chips: [...document.querySelectorAll('#detail .badge')].map(b => b.textContent),
    buttons: [...document.querySelectorAll('#detail .btn')].map(b => b.textContent),
  };
});
ok('?name= opens that chain instead of the list', d.listHidden && d.filtersHidden && d.title === 'Alpha',
   `${d.title} list=${d.listHidden}`);
ok('the figures move to the header', /alpha\.json · aaa111 · 6 cards · file settings/.test(d.meta), d.meta);
ok('every action is listed', d.lines === 6, String(d.lines));
ok('the nesting survives', d.text[2].startsWith('  run '), JSON.stringify(d.text[2]));
ok('a literal is marked as a literal', d.literal.join() === '"hello there"', d.literal.join());
ok('a value reference is a jump', d.refs.join(',') === '«0»,«0»', d.refs.join(','));
// The reason a by-name call is worth linking: the name is a string nothing
// validates, and a link that resolves is the cheapest proof that it still does.
ok('a call to a chain we hold is a link to it', d.runLinks.join() === '?name=Beta', d.runLinks.join());
ok('a call out of the estate is not a link',
   d.text[4].includes('run Show-Ace') && d.runLinks.length === 1,
   d.text[4] + ' / ' + d.runLinks.join());
ok('what it calls is shown', d.chips.includes('Beta') && d.chips.includes('Show-Ace'), d.chips.join(','));
// THE INSTALL LINK'S RECEIVER, which is the whole of the clean-install rule.
// Import over a name the device already holds leaves both copies and the older
// one keeps the index, so the button on a chain that is already there has to
// name Library-Replace. Asserting the label alone would pass on a button that
// says Replace and sends an Import.
ok('a chain already on the device is replaced, not imported over',
   d.buttons.some(b => b.includes('Replace')), d.buttons.join(','));
const aHref = await page.locator('#detail a.btn-primary').getAttribute('href');
ok('and its link names Library-Replace',
   aHref.includes('name=Library-Replace'), aHref);
ok('carrying the same two-line payload either receiver reads',
   decodeURIComponent(aHref).includes('text=Alpha\nhttps://'), aHref);

// Clicking a «N» takes the reader to the line that produced the value.
await page.locator('#detail code button').first().click();
const flashed = await page.evaluate(() => document.getElementById('L0').className.includes('bg-warning'));
ok('a jump marks the line it lands on', flashed);

// ── who calls this ─────────────────────────────────────────────────────────
await open('?name=Beta');
const b = await page.evaluate(() => ({
  labels: [...document.querySelectorAll('#detail .uppercase')].map(s => s.textContent),
  chips: [...document.querySelectorAll('#detail .badge')].map(b => b.textContent),
  buttons: [...document.querySelectorAll('#detail .btn')].map(b => b.textContent),
}));
ok('a chain is told who calls it', b.labels.includes('Called by') && b.chips.includes('Alpha'),
   b.labels.join(',') + ' / ' + b.chips.join(','));
ok('a chain the device lacks offers a plain install',
   b.buttons.some(t => t.includes('Install')) && !b.buttons.some(t => t.includes('Replace')),
   b.buttons.join(','));
const bHref = await page.locator('#detail a.btn-primary').getAttribute('href');
ok('and its link names Library-Import, since there is nothing to delete',
   bHref.includes('name=Library-Import'), bHref);

// ── the three missing answers ──────────────────────────────────────────────
await open('?chain=probe-thing.json');
const p = await page.evaluate(() => ({
  title: document.getElementById('title').textContent,
  buttons: [...document.querySelectorAll('#detail .btn')].map(b => b.textContent),
}));
ok('a probe opens by file, since it has no name', p.title === 'probe-thing', p.title);
ok('a probe is never offered for install',
   !p.buttons.some(t => /Install|Run|Plist/.test(t)), p.buttons.join(','));

await open('?name=Gamma');
ok('a catalog with no listing says so rather than drawing an empty chain',
   (await page.locator('#detail').textContent()).includes('No listing in catalog.json'));

// A NAME OFF THE CATALOG HAS THREE ANSWERS, and the page used to give one.
// `?name=Choose-GPT` is the case that exposed it: a real shortcut, on the
// device, answered with "No chain here called Choose-GPT", which reads as "no
// such thing" and is not what was checked.
await open('?name=Choose-Thing');
const dev = await page.evaluate(() => ({
  title: document.getElementById('title').textContent,
  meta: document.getElementById('meta').textContent,
  text: document.getElementById('detail').textContent,
  buttons: [...document.querySelectorAll('#detail .btn')].map(b => b.textContent),
  hrefs: [...document.querySelectorAll('#detail a.btn')].map(a => a.getAttribute('href')),
  chips: [...document.querySelectorAll('#detail .badge')].map(b => b.textContent),
  chipLinks: [...document.querySelectorAll('#detail a.badge')].map(a => a.getAttribute('href')),
}));
ok('a device shortcut off the catalog is named as one rather than denied',
   dev.title === 'Choose-Thing' && /is on the device/.test(dev.text), dev.text.slice(0, 90));
ok('and is never offered for install, having no plist here',
   !dev.buttons.some(t => /Install|Replace/.test(t)), dev.buttons.join(','));
ok('what it offers instead is Open',
   dev.hrefs.some(h => h.includes('name=Library-Open')), dev.hrefs.join(' '));
ok('its survey figures are stated', /kept · authored · called · 9 cards/.test(dev.meta), dev.meta);
// survey.py computes both directions for these, so both are shown, and a name
// that IS a chain here becomes a link back into the catalog.
ok('its calls and callers are shown',
   dev.chips.includes('Alpha') && dev.chips.includes('Menu-Thing'), dev.chips.join(','));
ok('and a call that is a chain here links to it',
   dev.chipLinks.join() === '?name=Alpha', dev.chipLinks.join());

// In the manifest and not in the survey. 89 names were in that gap on
// 2026-09-19, and no listing exists for any of them until the next dump runs.
await open('?name=Fresh-Install');
const fresh = await page.locator('#detail').textContent();
ok('a name newer than the dump says so, and dates the dump it is newer than',
   /Installed since the last dump \(2026-09-14-01\.zip\)/.test(fresh), fresh.slice(0, 140));

await open('?name=Nope-NotHere');
ok('a name in neither the catalog nor the device is the only flat no',
   /not a chain in this catalog, and not on the device/.test(
     await page.locator('#detail').textContent()));

// ── back, and the pins that must survive it ────────────────────────────────
await open('?name=Alpha&ref=some-branch');
await page.locator('#back').click();
const back = await page.evaluate(() => ({
  search: location.search,
  listHidden: document.getElementById('list').classList.contains('hidden'),
}));
ok('back returns to the list', !back.listHidden && !back.search.includes('name='), back.search);
// Dropping ?ref= on a navigation would silently change which branch is read.
ok('?ref= survives the navigation', back.search.includes('ref=some-branch'), back.search);

// ── no token, which must not look like a good answer ───────────────────────
// "current" and "not looked up" rendering the same is the failure this page is
// built to avoid, so the unread device leaves the column empty rather than
// green, and the table is still worth reading without it.
const anon = await browser.newContext({ viewport: { width: 430, height: 932 } });
const bare = await anon.newPage();
await bare.route('**/*', route => handler(route));
await bare.goto(`${origin}/pages/shortcuts.html`, { waitUntil: 'networkidle' });
await bare.waitForFunction(() => document.getElementById('status').textContent !== 'loading',
                           { timeout: 8000 });
const n = await bare.evaluate(() => ({
  status: document.getElementById('status').textContent,
  rows: document.querySelectorAll('#rows > tr').length,
  badges: document.querySelectorAll('#rows > tr td:nth-child(4) i').length,
  tally: document.getElementById('tally').textContent,
}));
ok('without a token the catalog still renders', n.rows === 3, String(n.rows));
ok('without a token no chain claims a device state', n.badges === 0, String(n.badges));
ok('the header says the device was not read', n.status === 'no token', n.status);
ok('and states no device figures', !/current|stale/.test(n.tally), n.tally);

// An unread device cannot tell an absent name from an unseen one, so the flat
// no above must not be what it says.
await bare.goto(`${origin}/pages/shortcuts.html?name=Nope-NotHere`, { waitUntil: 'networkidle' });
await bare.waitForFunction(() => document.getElementById('status').textContent !== 'loading',
                           { timeout: 8000 });
ok('and a missing name is not called absent when nothing looked',
   /device has not been read/.test(await bare.locator('#detail').textContent()));
// Nor may it guess at the receiver: Import is the honest default for a state
// nobody looked up, since Replace would delete on the strength of an assumption.
await bare.goto(`${origin}/pages/shortcuts.html?name=Alpha`, { waitUntil: 'networkidle' });
await bare.waitForFunction(() => document.getElementById('status').textContent !== 'loading',
                           { timeout: 8000 });
ok('an unread device installs rather than replaces',
   (await bare.locator('#detail a.btn-primary').getAttribute('href')).includes('name=Library-Import'));

// ── a device that has not got Library-Replace ──────────────────────────────
// The receiver only reached the phone on 2026-09-16, and a link naming a
// receiver the device lacks fails at the point of use with nothing installed.
// So presence is asked of the manifest, not assumed from the calendar.
MANIFEST = WITHOUT_REPLACE;
const older = await browser.newContext({ viewport: { width: 430, height: 932 } });
await older.addInitScript(() => { try { localStorage.setItem('ghToken', 'stub'); } catch {} });
const oldPage = await older.newPage();
await oldPage.route('**/*', route => handler(route));
await oldPage.goto(`${origin}/pages/shortcuts.html?name=Alpha`, { waitUntil: 'networkidle' });
await oldPage.waitForFunction(() => document.getElementById('status').textContent !== 'loading',
                              { timeout: 8000 });
const oldHref = await oldPage.locator('#detail a.btn-primary').getAttribute('href');
ok('a device without Library-Replace falls back to Import',
   oldHref.includes('name=Library-Import'), oldHref);

await browser.close();
server.close();
console.log(failures.length ? `\n${failures.length} failed` : '\nall passed');
process.exit(failures.length ? 1 : 0);
