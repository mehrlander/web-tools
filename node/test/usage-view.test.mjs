// alpineComponents/usage.js, the Usage tab of the app's Activity row, mounted
// with the real Alpine over a stand-in for the session store: the listings
// under sessions/usage, each file with its git blob sha, and a blob by that
// sha. The extracts are the made-up ones usage-readings.test.mjs works by
// hand; here the question is what reaches the page: which files are read and
// when, what each pane draws from a reading, and what a tap does. Nothing in
// the pane may move the reader unless they asked to leave, so every scroll
// the page could make and every link a click would follow is recorded below,
// and a tap on a row, a bar or a dot must leave both lists empty. jsdom has no
// layout, so the scatter is driven as the string it is and its host's width
// set by hand, and a row's one line is read off its grid: as many cells as
// its narrow template has tracks.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { makeWindow, startAlpine, tick, repoRoot, withBase64 } from './bootstrap.mjs';

const DIR = path.join(repoRoot, 'node/test/fixtures/usage');
const ROOT = 'sessions/usage';
const blobSha = (text) => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
// The newest session's last step is 09:45; this is fifteen minutes on.
const NOW = Date.parse('2026-11-04T10:00:00.000Z');

const { window, problems } = makeWindow({ html: '<!doctype html><html><body><div id="host" x-data="usage(window.__cfg)"></div></body></html>' });
window.eval(readFileSync(path.join(repoRoot, 'lib/vanilla-bundle.js'), 'utf8'));
window.Date.now = () => NOW;

// The store: record name -> the file's text. `calls` lists every read made.
const store = new Map(readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => [f.slice(0, -5), readFileSync(path.join(DIR, f), 'utf8')]));
const calls = [];
const broken = new Set();
const entry = (name) => ({ type: 'file', name: name + '.json', path: `${ROOT}/${name.slice(0, 4)}/${name.slice(5, 7)}/${name}.json`, sha: blobSha(store.get(name)), size: 1 });
const dir = (p) => ({ type: 'dir', name: p.split('/').pop(), path: p });
class FakeGH {
  async ls(p) {
    calls.push('ls ' + p);
    const months = [...new Set([...store.keys()].map((n) => `${ROOT}/${n.slice(0, 4)}/${n.slice(5, 7)}`))].sort();
    if (p === ROOT) return [...new Set(months.map((m) => m.slice(0, ROOT.length + 5)))].map(dir).concat([{ type: 'file', name: 'README.md', path: ROOT + '/README.md', sha: 'x' }]);
    if (/\/\d{4}$/.test(p)) return months.filter((m) => m.startsWith(p + '/')).map(dir);
    return [...store.keys()].filter((n) => p === `${ROOT}/${n.slice(0, 4)}/${n.slice(5, 7)}`).sort().map(entry);
  }
  async req(p) {
    calls.push(p);
    const sha = /^git\/blobs\/([0-9a-f]{40})$/.exec(p)?.[1];
    const name = [...store.keys()].find((n) => blobSha(store.get(n)) === sha);
    if (!name || broken.has(name)) throw Object.assign(new Error('GitHub Error 404'), { status: 404 });
    return { sha, encoding: 'base64', content: FakeGH.toBase64(store.get(name)) };
  }
}
window.GH = withBase64(FakeGH);
window.TOKEN = 'fixture';
window.gh = { load: async (p) => { throw new Error('the pane loaded ' + p + ', which the page already had'); } };
// The title-tip kit, as far as the pane calls it: what a tap asked it to open.
const tips = [];
window.TitleTip = { open: (el) => tips.push(el), close: () => tips.push(null) };
// Every way the page could move the reader. jsdom implements none of these, so
// each is a recorder: a scroll of any element or of the window, by method or
// by setting an offset.
const scrolls = [];
for (const m of ['scrollIntoView', 'scrollTo', 'scrollBy', 'scroll']) window.Element.prototype[m] = function () { scrolls.push(m); };
for (const m of ['scrollTo', 'scrollBy', 'scroll']) window[m] = () => { scrolls.push('window.' + m); };
for (const k of ['scrollTop', 'scrollLeft']) Object.defineProperty(window.Element.prototype, k, { configurable: true, get() { return 0; }, set() { scrolls.push(k); } });
// This browser's kept copies (kits/persistence.js's collection, as the pane uses it).
const keptRows = new Map();
window.persistence = { collection: (name) => ({
  all: async () => { calls.push('kept ' + name); return [...keptRows.values()]; },
  put: async (row) => { keptRows.set(row.id, row); return row; },
  delete: async (id) => { calls.push('drop ' + id); keptRows.delete(id); },
}) };
// The two ways out the app offers a row: a summary opened in the Compactions
// tab, and a session opened by the shell on this event.
const opened = [];
const sessions = [];
window.document.addEventListener('web-tools:open-session', (e) => sessions.push(JSON.parse(JSON.stringify(e.detail))));
window.__cfg = {
  label: (short) => (short === 'aaaa0001' ? 'A titled session' : ''),
  sessionHref: (short) => '?view=sessions&session=' + short,
  compactionHref: (name) => '?view=compactions&item=' + name,
  openCompaction: (name) => opened.push(name),
  shown: () => true,
};
const run = (rel) => new window.Function('window', readFileSync(path.join(repoRoot, rel), 'utf8'))(window);
run('lib/kits/session-usage.js');
run('lib/kits/usage-chart.js');
run('lib/kits/usage-readings.js');

const Alpine = await startAlpine(window, ['lib/alpineComponents/usage.js']);
const host = window.document.getElementById('host');
const data = Alpine.$data(host);
const settle = async () => { for (let i = 0; i < 8; i++) await tick(2); };
await settle();
const $ = (sel) => host.querySelector(sel);
const $$ = (sel) => [...host.querySelectorAll(sel)];
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const widths = (el) => [...el.querySelectorAll('[data-usage-part]')].map((x) => +x.style.width.replace('%', ''));
const blobs = () => calls.filter((c) => c.startsWith('git/blobs/'));
// The page shows an instant as a date in the reader's zone, so what it should
// say for one is worked out here from the runner's own zone, not written down
// as one zone's answer. A session's day is shown as its record writes it, in
// any zone, so those stay written out below.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const localDay = (iso) => { const d = new Date(iso); return MONTHS[d.getMonth()] + ' ' + d.getDate(); };
const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The pane keeps a clock running for Continue; without this the file never ends.
test.after(() => { data.destroy(); window.close(); });
const show = async (key) => { $(`[data-at="usage-tab-${key}"]`).click(); await settle(); };
// A link a click would follow: one on an `a[href]` that nothing prevented.
// jsdom cannot follow a link, so the page takes the click once the pane has
// had it.
const followed = [];
window.document.addEventListener('click', (e) => {
  const a = e.target instanceof window.Element ? e.target.closest('a[href]') : null;
  if (a && !e.defaultPrevented) { followed.push(a.getAttribute('href')); e.preventDefault(); }
});
const tap = (el, init = {}) => { const e = new window.MouseEvent('click', { bubbles: true, cancelable: true, ...init }); el.dispatchEvent(e); return e; };
const over = (el) => el.dispatchEvent(new window.Event('pointerover', { bubbles: true }));
// What the reader would have been moved by since the last call: scrolls, links
// followed, sessions and summaries opened.
const here = window.location.href;
const moved = () => {
  const m = [...scrolls.map((x) => 'scroll ' + x), ...followed.map((x) => 'link ' + x), ...sessions.map((x) => 'session ' + x.id),
             ...opened.map((x) => 'summary ' + x), ...(window.location.href === here ? [] : ['address ' + window.location.href])];
  scrolls.length = followed.length = sessions.length = opened.length = 0;
  return m;
};
// Everything in a row a tap can land on, the row itself included, but its way out.
const tappable = (row) => [row, ...row.querySelectorAll('*')].filter((x) => !x.closest('[data-usage-out]'));
// A row is one line where it has as many cells as its narrow grid has tracks:
// a cell that only a wider pane shows is `hidden` here.
const tracks = (el) => /(?:^|\s)grid-cols-\[([^\]]+)\]/.exec(el.className)[1].split('_').length;
const cells = (el) => [...el.children].filter((x) => x.tagName !== 'TEMPLATE' && !/(?:^|\s)hidden(?:\s|$)/.test(x.className));

test('the first visit lists the store by three levels and reads each file once, as a blob by its sha', () => {
  assert.deepEqual(calls.filter((c) => c.startsWith('ls ')), ['ls sessions/usage', 'ls sessions/usage/2026', 'ls sessions/usage/2026/10', 'ls sessions/usage/2026/11']);
  assert.equal(blobs().length, 5);
  assert.deepEqual(blobs().sort(), [...store.keys()].map((n) => 'git/blobs/' + blobSha(store.get(n))).sort());
  assert.equal(data.loading, false);
  assert.equal(data.error, '');
  assert.equal(keptRows.size, 5, 'each read file is kept in this browser under its sha');
  assert.equal(keptRows.get('2026-11-01-aaaa0001').sha, blobSha(store.get('2026-11-01-aaaa0001')));
  assert.match(text($('[data-usage]')), new RegExp('5 sessions · Oct 20 → ' + localDay('2026-11-04T09:45:00.000Z')));
  assert.equal($('a[data-usage-source]').getAttribute('href'),
    'https://github.com/mehrlander/web-tools-private/tree/main/sessions/usage', 'the view\'s jump-over to what it reads');
  assert.deepEqual(problems, [], 'mounting is quiet');
});

test('five pills, Spend open: each pane is a look anchor whose opener is its pill', () => {
  const tabs = $$('[role="tab"]');
  assert.deepEqual(tabs.map((t) => t.textContent.trim()), ['Spend', 'Calls', 'Re-loads', 'Continue', 'Compactions']);
  assert.deepEqual(tabs.map((t) => t.getAttribute('aria-selected')), ['true', 'false', 'false', 'false', 'false']);
  for (const key of ['spend', 'calls', 'reloads', 'continue', 'compactions']) {
    const pane = $(`[data-at="usage-${key}"]`);
    assert.ok(pane, key + ' pane');
    assert.ok($(`[data-at="${pane.getAttribute('data-at-open')}"]`), key + ': its opener is on the page');
    assert.equal(pane.style.display === 'none', key !== 'spend', key + ' shown');
  }
  assert.ok($('[data-pattern="figure"]'));
});

test('the five pills hold still: five equal columns of icons in a narrow pane, each named, and no choice moves one', async () => {
  const strip = $('[data-slot="frame:subtabs"]');
  const tabs = $$('[role="tab"]');
  assert.match(strip.className, /(?:^|\s)grid(?:\s|$)/);
  assert.match(strip.className, /(?:^|\s)grid-cols-5(?:\s|$)/, 'five columns, one a pill, all on screen at once');
  assert.match(strip.className, /(?:^|\s)shrink-0(?:\s|$)/, 'and the strip is never squeezed');
  assert.doesNotMatch(strip.className, /overflow-x|flex-wrap|scrollbar/, 'nothing in it scrolls or wraps');
  for (const [i, t] of tabs.entries()) {
    const p = window.Usage.PANES[i];
    assert.equal(t.getAttribute('aria-label'), p.label, 'its accessible name, where the icon stands alone');
    assert.equal(t.getAttribute('data-title-tip'), p.tip);
    assert.ok(p.tip.startsWith(p.label + ': '), 'the tip leads with the name');
    assert.match(t.className, /(?:^|\s)w-10(?:\s|$)/, 'a fixed width in a narrow pane, whatever its name');
    assert.match(t.className, /(?:^|\s)h-9(?:\s|$)/);
    const icon = t.querySelector('i.ph');
    assert.ok(icon && !/hidden/.test(icon.className), p.label + ': its icon shows at every width');
    assert.match(t.querySelector('span').className, /^hidden @2xl:inline$/, 'its name shows from 42rem');
  }
  // What a choice changes on a pill is its colour and its shadow: nothing
  // that has a size.
  const shape = (t) => t.className.split(/\s+/).filter((c) => !['bg-base-100', 'text-primary', 'shadow-sm', 'text-base-content/60', 'hover:text-base-content'].includes(c)).sort().join(' ');
  const names = tabs.map((t) => t.textContent);
  const open = $('[data-usage-open]');
  assert.match(open.className, /(?:^|\s)w-28(?:\s|$)/, 'the open reading\'s name has the widest name\'s room');
  assert.match(open.className, /(?:^|\s)shrink-0(?:\s|$)/);
  assert.match(open.className, /@2xl:hidden/, 'and goes where the pills carry their own');
  // A strip that did scroll would be wider than its box: nothing reads that.
  Object.defineProperty(strip, 'scrollWidth', { value: 500, configurable: true });
  Object.defineProperty(strip, 'clientWidth', { value: 300, configurable: true });
  moved();
  for (const [i, key] of ['calls', 'reloads', 'continue', 'compactions', 'spend'].entries()) {
    await show(key);
    assert.deepEqual(moved(), [], key + ': choosing it scrolls nothing and goes nowhere');
    assert.deepEqual(tabs.map((t) => t.getAttribute('aria-selected') === 'true'), tabs.map((t) => t.getAttribute('data-at') === 'usage-tab-' + key));
    assert.equal(new Set(tabs.map(shape)).size, 1, key + ': the chosen pill has the shape of the others');
    assert.deepEqual(tabs.map((t) => t.textContent), names, key + ': no pill gains or loses a word');
    assert.equal(open.textContent, window.Usage.PANES[(i + 1) % 5].label, 'the name beside the strip is the open reading\'s');
  }
  delete strip.scrollWidth; delete strip.clientWidth;
});

test('what arrives later has its room: the reading line holds the progress and then the count, and the chart\'s host its height', () => {
  const line = $('[data-usage-line]');
  assert.ok(line.querySelector('[role="status"]'), 'the first read reports in the line');
  assert.ok(line.querySelector('a[data-usage-source]'), 'that the count of sessions then takes');
  assert.equal($('progress'), null, 'no bar of its own under the pills, to be replaced by the reading');
  assert.match(line.className, /(?:^|\s)min-h-8(?:\s|$)/, 'as tall with a spinner as with the button');
  const was = [data.done, data.of];
  data.of = 198;
  const widths = [0, 7, 42, 198].map((n) => { data.done = n; return data.progress.length; });
  assert.equal(new Set(widths).size, 1, 'the count so far is padded to the total\'s width, so the line does not creep');
  assert.match(data.progress, /^Reading 198 \/ 198 sessions$/);
  data.of = 0;
  assert.equal(data.progress, 'Listing sessions');
  [data.done, data.of] = was;
  const U = window.Usage;
  assert.equal(U.HOLD, `min-h-[${U.PLOT.narrow + U.PLOT.frame}px] @min-[${U.PLOT.at}px]:min-h-[${U.PLOT.wide + U.PLOT.frame}px]`,
    'the host is as tall as the chart at either width');
});

test('Spend: one bar of four named parts, then a one-line row per session with the same four on one scale', () => {
  const pane = $('[data-at="usage-spend"]');
  const legend = [...pane.querySelectorAll('span[data-usage-part]')].filter((x) => x.textContent.trim());
  assert.deepEqual(legend.map(text), ['Reads $7.10 17%', 'Re-loads $13.28 33%', 'Writes $14.80 36%', 'Output $5.42 13%'], 'a label is one word');
  assert.deepEqual(legend.map((x) => x.querySelector('[data-title-tip]').getAttribute('data-title-tip').split(':')[0]),
    ['Context reads', 'Idle re-loads', 'Other cache writes', 'What the model wrote'], 'and its tip says the rest');
  assert.match(text(pane), /total \$40\.60/);
  const total = widths(pane.querySelector('[role="img"]'));
  assert.equal(total.length, 4);
  assert.ok(Math.abs(total.reduce((a, b) => a + b, 0) - 100) < 0.05, 'the four parts fill the bar');
  const rows = [...pane.querySelectorAll('[data-usage-session]')];
  assert.deepEqual(rows.map((x) => x.getAttribute('data-usage-session')),
    ['2026-11-02-bbbb0002', '2026-11-01-aaaa0001', '2026-10-20-cccc0003', '2026-11-03-eeee0005'], 'dearest first; the unpriced session has no row');
  assert.ok(Math.abs(widths(rows[0]).reduce((a, b) => a + b, 0) - 100) < 0.05, 'the dearest session fills the scale');
  assert.ok(Math.abs(widths(rows[1]).reduce((a, b) => a + b, 0) - 100 * 11.104 / 26.28) < 0.05, 'the next is on the same scale');
  assert.match(text(rows[1]), /^Nov 1 A titled session 3 prompts 1 re-load \$11\.10$/, 'named by the sessions index');
  assert.match(text(rows[0]), /^Nov 2 A made-up session on the dearer model.* 2 prompts 2 re-loads \$26\.28$/, 'else by what it was first asked');
  assert.match(text(rows[3]), /^Nov 3 eeee0005 0 prompts 1 re-load \$1\.50$/, 'else by its short id');
  // One line: the bar is a cell of the row, between the name and the figure,
  // and the two counts are cells only a pane of 48rem shows.
  for (const row of rows) {
    assert.equal(cells(row).length, tracks(row), 'as many cells as the narrow grid has columns: one line');
    assert.equal(cells(row).length, 4, 'the day, the name, the bar, the figure');
    const bar = row.querySelector('[data-usage-part]').parentElement;
    assert.equal(bar.parentElement, row, 'the bar is in the row\'s line');
    assert.equal(bar.nextElementSibling, row.lastElementChild, 'beside the figure');
    assert.doesNotMatch(row.className + ' ' + bar.className, /col-span|order-last|basis-full|w-full/, 'and has no line of its own');
  }
  assert.deepEqual([...rows[0].children].filter((x) => /(?:^|\s)hidden(?:\s|$)/.test(x.className)).map((x) => x.className.includes('@3xl:block')), [true, true]);
  // aaaa0001 by hand: 13M read at $0.20 and 1k of input at $4; 250k re-written
  // at $8; the other 650k of writes at $8; 65k of output at $20. Four prompts,
  // one of which drew no call.
  assert.equal(rows[1].querySelector('[data-usage-part]').parentElement.getAttribute('data-title-tip'),
    'Reads $2.60 · Re-loads $2.00 · Writes $5.20 · Output $1.30 · 3 prompts · 1 re-load', 'the short bar gives its four parts, and the counts, in its tip');
  assert.equal(rows[0].querySelector('a[data-usage-out]').getAttribute('href'), '?view=sessions&session=bbbb0002&pane=cost');
  assert.match(text(pane), /No price: claude-sonnet-5-5 \(1 session\)/);
  assert.match(pane.querySelector('[data-usage-part="read"]').className, /bg-\[#2a78d6\]/, 'the chart\'s blue');
  assert.match(pane.querySelector('[data-usage-part="reload"]').className, /bg-\[#eb6834\]/, 'the chart\'s orange');
});

test('a part of the spend and the bars in its tone are one thing: pointing at one fades the rest', () => {
  const pane = $('[data-at="usage-spend"]'), root = pane.querySelector(':scope > div');
  const of = (key) => [...pane.querySelectorAll(`[data-usage-part="${key}"]`)];
  const faded = (key) => of(key).filter((x) => x.classList.contains('opacity-25')).length;
  const entry = (key) => of(key).find((x) => x.textContent.trim());
  assert.equal(of('reload').length, 6, 'its legend entry, its segment of the total and one in each of four rows');
  over(entry('reload').querySelector('span'));
  assert.deepEqual(['read', 'reload', 'write', 'output'].map(faded), [6, 0, 6, 6], 'from the legend: every other part fades, legend and bars');
  over(pane.querySelector('[data-usage-session] [data-usage-part="output"]'));
  assert.deepEqual(['read', 'reload', 'write', 'output'].map(faded), [6, 6, 6, 0], 'from a session\'s segment: the same, for its part');
  root.dispatchEvent(new window.Event('pointerleave'));
  assert.equal(pane.querySelectorAll('.opacity-25').length, 0, 'leaving clears it');
  // A tap on the total bar or the legend keeps the mark until the next tap.
  moved();
  tap(pane.querySelector('[role="img"] [data-usage-part="read"]'));
  root.dispatchEvent(new window.Event('pointerleave'));
  assert.deepEqual(['read', 'reload', 'write', 'output'].map(faded), [0, 6, 6, 6], 'a tapped part stays marked');
  over(entry('write'));
  assert.equal(faded('write'), 0, 'pointing elsewhere still shows that part');
  root.dispatchEvent(new window.Event('pointerleave'));
  assert.equal(faded('read'), 0, 'and leaving returns to the tapped one');
  tap(entry('read'));
  assert.equal(pane.querySelectorAll('.opacity-25').length, 0, 'a second tap lets it go');
  // A tap on a session's bar is its part's too: it marks, and opens nothing.
  tap(pane.querySelector('[data-usage-session] [data-usage-part="reload"]'));
  root.dispatchEvent(new window.Event('pointerleave'));
  assert.deepEqual(['read', 'reload', 'write', 'output'].map(faded), [6, 0, 6, 6], 'a session\'s segment marks its part, as the total\'s does');
  assert.equal(pane.querySelectorAll('[data-usage-marked]').length, 0, 'and the tap was the part\'s, not the row\'s');
  // A tap on the row beside its bar is the row's, and leaves the part marked.
  tap(pane.querySelector('[data-usage-session] span'));
  assert.equal(faded('reload'), 0);
  assert.equal(faded('read'), 6, 'the part keeps its mark');
  tap(pane.querySelector('[data-usage-session] span'));
  tap(root);
  assert.equal(pane.querySelectorAll('.opacity-25').length, 0, 'a tap on the pane beside every part lets the part go');
  assert.deepEqual(moved(), [], 'and none of these taps moved the reader');
});

test('a tap on a session\'s row goes nowhere: it marks the row where it stands, and the arrow is the way out', () => {
  const pane = $('[data-at="usage-spend"]');
  const rows = [...pane.querySelectorAll('[data-usage-session]')];
  moved();
  for (const row of rows) {
    assert.equal(row.tagName, 'DIV', 'the row is not a link');
    assert.equal(row.closest('a'), null);
    assert.equal(row.querySelectorAll('a').length, 1, 'and holds one: its way out');
    for (const el of tappable(row)) tap(el);
  }
  assert.deepEqual(moved(), [], 'a tap anywhere on a row but its arrow scrolls nothing, follows no link and opens no session');
  for (const row of rows) for (const x of row.querySelectorAll('.opacity-25')) x.classList.remove('opacity-25');
  for (const x of pane.querySelectorAll('[data-usage-marked]')) tap(x.querySelector('span'));
  data._part = '';
  assert.equal(pane.querySelectorAll('[data-usage-marked]').length, 0);
  // The mark: one row at a time, where the row stands, until the next tap.
  tap(rows[1].querySelector('span'));
  assert.deepEqual(rows.map((x) => x.hasAttribute('data-usage-marked')), [false, true, false, false]);
  assert.ok(rows[1].classList.contains('bg-primary/10'));
  assert.ok(!rows[1].classList.contains('hover:bg-base-200/60'), 'the hover tint would hide the mark from the pointer that made it');
  tap(rows[2].lastElementChild);
  assert.deepEqual(rows.map((x) => x.hasAttribute('data-usage-marked')), [false, false, true, false], 'another row takes it');
  assert.ok(rows[1].classList.contains('hover:bg-base-200/60') && !rows[1].classList.contains('bg-primary/10'));
  tap(rows[2].lastElementChild);
  assert.equal(pane.querySelectorAll('[data-usage-marked]').length, 0, 'a second tap lets it go');
  assert.deepEqual(moved(), []);
  // The way out: the arrow after the name, named and tipped, to the Cost tab.
  const out = rows[1].querySelector('a[data-usage-out]');
  assert.equal(out.getAttribute('aria-label'), 'Open the session\'s Cost tab');
  assert.equal(out.getAttribute('data-title-tip'), 'Open the session\'s Cost tab');
  assert.ok(out.querySelector('i.ph-arrow-up-right'));
  assert.equal(out.previousElementSibling.textContent, 'A titled session', 'it follows the name');
  const click = tap(out.querySelector('i'));
  assert.equal(click.defaultPrevented, true);
  assert.deepEqual(sessions, [{ id: 'aaaa0001', day: '2026-11-01', pane: 'cost' }], 'the app opens the session at its Cost tab');
  assert.equal(pane.querySelectorAll('[data-usage-marked]').length, 0, 'leaving by the arrow marks nothing');
  assert.deepEqual(moved(), ['session aaaa0001']);
  tap(out, { ctrlKey: true });
  assert.deepEqual(moved(), ['link ?view=sessions&session=aaaa0001&pane=cost'], 'a modified click is the browser\'s, to open in a new tab');
});

test('Calls: a one-line row per bin, the share of prompts over the share of calls on one scale', async () => {
  await show('calls');
  const pane = $('[data-at="usage-calls"]');
  assert.equal(pane.style.display, '');
  assert.equal($('[data-at="usage-spend"]').style.display, 'none');
  assert.equal($('[data-at="usage-spend"] [data-usage-session]'), null, 'a closed pane keeps no rows on the page');
  assert.match(text(pane), /^7 prompts 105 calls median 4 · mean 15 \/ prompt · 1 with none calls \/ prompt prompts calls 1 14%/);
  const rows = [...pane.querySelectorAll('[data-usage-bin]')];
  assert.deepEqual(rows.map((x) => text(x)), ['1 14% 1 1.0% 1', '2-3 29% 2 4.8% 5', '4-7 29% 2 8.6% 9', '8-15 0% 0 0% 0', '16-31 14% 1 19% 20', '32-63 0% 0 0% 0', '64+ 14% 1 67% 70']);
  const bars = rows[6].querySelectorAll('span.block');
  assert.equal(bars.length, 2);
  assert.equal(parseFloat(bars[1].style.width), 100, 'the largest share is the scale');
  assert.ok(Math.abs(parseFloat(bars[0].style.width) - 100 * (1 / 7) / (70 / 105)) < 0.05, 'and the other bar is on it');
  assert.match(bars[0].className, /\bborder border-base-content\/60\b/, 'prompts outlined');
  assert.match(bars[1].className, /\bbg-base-content\/60\b/, 'calls filled, in the same ink');
  for (const row of rows) {
    assert.equal(cells(row).length, tracks(row), 'one line: the bin, its bars, and a share and a count for each');
    assert.equal(row.querySelectorAll('span.block')[0].closest('.flex-col'), row.children[1], 'the two bars share one cell, one over the other');
  }
  const head = rows[0].previousElementSibling.previousElementSibling;
  assert.equal(text(head), 'calls / prompt prompts calls', 'the columns are named once, over the list');
  assert.equal(tracks(head), tracks(rows[0]), 'on the rows\' own grid');
  assert.equal(data.tally(99999), '99,999');
  assert.equal(data.tally(123456), '123k', 'a count past its column is cut short, not pushed out of it');
  assert.doesNotMatch(pane.innerHTML, /#2a78d6|#3987e5|#eb6834|#d95926|bg-base-content\/(40|20)\b/,
    'no hue or grey of the spend means something else here');
  // The legend and the bars mark each other, as the spend's do.
  const of = (key) => [...pane.querySelectorAll(`[data-usage-part="${key}"]`)];
  assert.deepEqual([of('prompts').length, of('calls').length], [8, 8], 'a legend entry and a bar in each of seven bins');
  assert.match(of('calls')[0].querySelector('[data-title-tip]').getAttribute('data-title-tip'), /^Model calls: /, 'the one word "calls" has the rest in its tip');
  over(of('calls')[0].querySelector('span'));
  assert.deepEqual([of('prompts').filter((x) => x.classList.contains('opacity-25')).length, of('calls').filter((x) => x.classList.contains('opacity-25')).length], [8, 0]);
  pane.querySelector(':scope > div').dispatchEvent(new window.Event('pointerleave'));
  assert.equal(pane.querySelectorAll('.opacity-25').length, 0);
  moved();
  for (const el of tappable(rows[6])) tap(el);
  tap(pane.querySelector(':scope > div'));
  assert.deepEqual(moved(), [], 'a tap on a bin or its bars moves nothing');
  assert.equal(pane.querySelector('a'), null, 'and no bin leads anywhere');
});

test('Re-loads: a one-line row per ender, the dearest first, its bar the dollars its re-loads wrote', async () => {
  await show('reloads');
  const pane = $('[data-at="usage-reloads"]');
  assert.match(text(pane), /^5 re-loads \$13\.28/);
  const rows = [...pane.querySelectorAll('[data-usage-ender]')];
  assert.deepEqual(rows.map((x) => text(x)), [
    'Session 1 2 h $6.40',
    'Owner 1 2 h $2.00',
    'PR 1 5 h $2.00',
    'Task 1 1.5 h $1.28',
    'Unlisted 1 $1.60']);
  const head = rows[0].previousElementSibling.previousElementSibling;
  assert.equal(text(head), 'ended by re-loads gap', 'the columns are named once, so a row carries figures alone');
  assert.equal(head.querySelector('[data-title-tip]').getAttribute('data-title-tip'), 'Median idle gap before the re-load');
  for (const row of rows) {
    assert.equal(tracks(head), tracks(row));
    assert.equal(cells(row).length, tracks(row), 'one line: the ender, the count, the gap, the bar, the figure');
    assert.equal(row.querySelector('span[style]').parentElement.nextElementSibling, row.lastElementChild, 'the bar beside the figure');
  }
  assert.equal(parseFloat(rows[0].querySelector('span[style]').style.width), 100);
  assert.equal(parseFloat(rows[1].querySelector('span[style]').style.width), 31.25);
  assert.match(rows[0].querySelector('span[style]').className, /bg-\[#eb6834\]/);
  assert.match(rows[0].querySelector('[data-title-tip]').getAttribute('data-title-tip'), /another Claude session/, 'an ender\'s one word has the rest in its tip');
  assert.match(rows[4].querySelector('[data-title-tip]').getAttribute('data-title-tip'), /before re-loads were listed/);
  assert.equal(data.gap(50 * 3600000), '2.1 d');
  assert.equal(data.gap(20 * 60000), '20 min');
  moved();
  for (const row of rows) for (const el of tappable(row)) tap(el);
  assert.deepEqual(moved(), [], 'a tap on an ender moves nothing');
  assert.equal(pane.querySelector('a'), null);
});

test('Continue: one line a session, an orange bar where lapsed; where warm a grey one, what it becomes, and the minutes left', async () => {
  await show('continue');
  const pane = $('[data-at="usage-continue"]');
  const chips = [...pane.querySelectorAll('[data-slot="frame:count-chips"] button')];
  assert.deepEqual(chips.map(text), ['All 5', 'Warm 1', 'Lapsed 4'], 'each chip counts the rows it narrows to');
  const rows = () => [...pane.querySelectorAll('[data-usage-session]')];
  assert.deepEqual(rows().map((a) => a.getAttribute('data-usage-session').slice(11)), ['aaaa0001', 'cccc0003', 'eeee0005', 'bbbb0002', 'dddd0004']);
  assert.match(text(rows()[0]), /^3d A titled session 400k \$3\.20$/, 'how long idle, the name, the context\'s size, the figure');
  assert.match(rows()[0].querySelector('span[style]').className, /bg-\[#eb6834\]/);
  const warm = rows()[3];
  assert.match(text(warm), /^15m A made-up session on the dearer model.* 500k \$0\.10 45 min → \$8\.00$/);
  const bars = warm.querySelectorAll('span[style]');
  assert.equal(bars.length, 2);
  assert.match(bars[0].className, /bg-base-content\/40/, 'grey: what it costs now');
  assert.match(bars[1].className, /border-dashed border-\[#eb6834\]/, 'outlined: what it becomes');
  // One scale for all: the dearest lapsed row is 3.20, the warm one becomes 8.00.
  assert.equal(parseFloat(bars[0].style.width) + parseFloat(bars[1].style.width), 100);
  assert.equal(parseFloat(rows()[0].querySelector('span[style]').style.width), 40);
  assert.match(text(rows()[4]), /50k no price$/);
  for (const row of rows()) {
    const ahead = row.querySelector('[data-usage-ahead]');
    assert.equal(cells(row).length - (ahead ? 1 : 0), tracks(row), 'one line: the bar is a cell beside the figure');
    assert.equal(!!ahead, row === warm, 'only a warm row says what is ahead of it');
    assert.equal(row.tagName, 'DIV');
    assert.equal(row.querySelectorAll('a').length, 1);
  }
  assert.match(warm.querySelector('[data-usage-ahead]').className, /(?:^|\s)col-span-full(?:\s|$)/, 'under its row in a narrow pane');
  assert.match(warm.querySelector('[data-usage-ahead]').className, /@2xl:col-span-1 @2xl:col-start-3 @2xl:row-start-1/, 'and in the row from 42rem');
  // A tap marks the row and goes nowhere; the arrow opens the session.
  moved();
  for (const row of rows()) for (const el of tappable(row)) tap(el);
  for (const c of chips) tap(c);
  await settle();
  chips[0].click();
  await settle();
  assert.deepEqual(moved(), [], 'no tap on a row or a chip scrolls, follows a link or opens a session');
  for (const x of pane.querySelectorAll('[data-usage-marked]')) tap(x.querySelector('span'));
  tap(rows()[0].querySelector('span'));
  assert.deepEqual(rows().map((x) => x.hasAttribute('data-usage-marked')), [true, false, false, false, false]);
  const out = rows()[0].querySelector('a[data-usage-out]');
  assert.equal(out.getAttribute('href'), '?view=sessions&session=aaaa0001');
  assert.equal(out.getAttribute('aria-label'), 'Open the session');
  tap(out);
  assert.deepEqual(sessions, [{ id: 'aaaa0001', day: '2026-11-01' }]);
  assert.deepEqual(moved(), ['session aaaa0001']);
  chips[1].click();
  await settle();
  assert.deepEqual(rows().map((a) => a.getAttribute('data-usage-session').slice(11)), ['bbbb0002']);
  chips[2].click();
  await settle();
  assert.equal(rows().length, 4);
  chips[0].click();
  await settle();
});

test('Continue follows the clock: opened again later, the warm session has lapsed', async () => {
  await show('spend');
  window.Date.now = () => NOW + 50 * 60000;
  await show('continue');
  const first = $('[data-at="usage-continue"] [data-usage-session]');
  assert.match(text(first), /^1h A made-up session on the dearer model.* 500k \$8\.00$/, 'now the dearest, and orange');
  assert.equal(first.querySelector('[data-usage-ahead]'), null, 'with nothing ahead of it');
  assert.match(text($('[data-at="usage-continue"] [data-slot="frame:count-chips"]')), /Warm ?0/);
  window.Date.now = () => NOW;
  data.refold();
  await settle();
});

test('Compactions: a row each, the estimated cost marked as one, and the arrow to its summary', async () => {
  await show('compactions');
  const pane = $('[data-at="usage-compactions"]');
  assert.match(text(pane), /^4 compactions ≈ \$19\.28 saved \$15\.50 1 \/ 2 paid back · break-even ≈ 8 calls/);
  assert.match(pane.querySelector('[data-title-tip^="In context reads"]').textContent, /^saved$/, 'what the saving is in is the word\'s tip');
  const rows = [...pane.querySelectorAll('[data-usage-compaction]')];
  assert.deepEqual(rows.map(text), [
    localDay('2026-11-04T09:44:00.000Z') + ' A made-up session on the dearer model: still warm, compacted twice. 0 calls 500k → ? ≈ $0.50',
    localDay('2026-11-03T15:00:00.000Z') + ' A made-up session on the dearer model: still warm, compacted twice. 10 calls 900k → 150k ≈ $17.40 $1.50 saved',
    localDay('2026-11-01T10:45:00.000Z') + ' A titled session 100 calls 800k → 100k ≈ $1.16 $14.00 saved',
    localDay('2026-10-20T17:00:00.000Z') + ' A made-up session in the extract shape of before the re-loads were listed. 600k → 100k ≈ $0.22']);
  for (const row of rows) assert.match(text(row), /≈ \$/, 'an estimated cost says so wherever it shows');
  assert.match(rows[2].querySelector('[data-title-tip^="≈"]').getAttribute('data-title-tip'),
    /^≈ \$0\.36 summary \+ \$0\.80 new context · paid back after ≈ 9 calls$/);
  for (const row of rows) {
    assert.equal(row.tagName, 'DIV', 'the row is not a link');
    assert.equal(row.querySelectorAll('a').length, 1, 'and holds one: its way out');
  }
  const out = rows[2].querySelector('a[data-usage-out]');
  assert.equal(out.getAttribute('href'), '?view=compactions&item=2026-11-01-aaaa0001-20261101T104500Z');
  assert.equal(out.getAttribute('aria-label'), 'Open the summary');
  assert.equal(out.previousElementSibling.textContent, 'A titled session', 'it follows the name');
  moved();
  assert.equal(tap(out).defaultPrevented, true);
  assert.deepEqual(moved(), ['summary 2026-11-01-aaaa0001-20261101T104500Z'], 'the app opens the summary in the Compactions tab');
});

test('the scatter: a dot per compaction with its calls counted, over the break-even curve', () => {
  const svg = window.Usage.scatter(data.r.compactions, 600, { ph: 200 });
  const dots = svg.match(/<g data-usage-dot="[^"]+"/g) || [];
  assert.deepEqual(dots.map((d) => /"([^"]+)"/.exec(d)[1]).sort(),
    ['2026-11-01-aaaa0001-20261101T104500Z', '2026-11-02-bbbb0002-20261103T150000Z', '2026-11-02-bbbb0002-20261104T094400Z'],
    'the older row has no count of calls, so no place on the chart');
  assert.equal((svg.match(/data-usage-even /g) || []).length, 1, 'one break-even curve');
  assert.match(svg, />≈ break-even</, 'named as the estimate it is');
  assert.match(svg, />calls after</);
  assert.match(svg, />context before</);
  assert.match(svg, /<svg [^>]*width="600" height="266"/, '30 above, 200 of plot, 36 for the axis');
  for (const name of ['2026-11-02-bbbb0002-20261103T150000Z', '2026-11-02-bbbb0002-20261104T094400Z']) {
    const hollow = new RegExp('<g data-usage-dot="' + name + '"[^>]*>(.*?)</g>').exec(svg)[1];
    assert.match(hollow, /class="fill-base-100" stroke="currentColor"/, 'one that has not paid for itself is hollow');
  }
  const paid = /<g data-usage-dot="2026-11-01-aaaa0001-20261101T104500Z"[^>]*>(.*?)<\/g>/.exec(svg)[1];
  assert.match(paid, /fill="#2a78d6"/);
  // A dot's tip is its row: the figures, under the session's name.
  assert.match(svg, new RegExp('data-title-tip="' + rx(localDay('2026-11-01T10:45:00.000Z') + ' · 800k → 100k · 100 calls · cost ≈ $1.16 · saved $14.00') + '"'));
  const named = window.Usage.scatter(data.r.compactions, 600, { name: (c) => (c.short === 'aaaa0001' ? 'A titled session' : 'x'.repeat(200)) });
  assert.match(named, /data-usage-dot="2026-11-01-aaaa0001-20261101T104500Z" data-title-tip="[^"]+" data-title-tip-lead="A titled session"/);
  assert.match(named, new RegExp('data-title-tip-lead="x{47}…"'), 'a long name is cut short: a title-tip does not scroll');
  assert.match(svg, /data-title-tip-lead="A made-up session: three prompts, one idle re-l…"/, 'without a name, what the session was first asked');
  assert.match(window.Usage.scatter(data.r.compactions, 600, { dark: true }), /fill="#3987e5"/, 'the dark page\'s blue');
  assert.doesNotMatch(svg, /tabindex/, 'the rows are the keyboard\'s way to a compaction, not 150 tab stops');
});

test('a dot and its row are one compaction: pointing at either marks both', async () => {
  const pane = $('[data-at="usage-compactions"]');
  const box = pane.querySelector('[data-usage-scatter]');
  for (const c of window.Usage.HOLD.split(' ')) assert.ok(box.classList.contains(c), 'the chart\'s room is kept before it is drawn: ' + c);
  Object.defineProperty(box, 'clientWidth', { value: 600, configurable: true });
  data.paintScatter(box);
  assert.equal(box.querySelectorAll('[data-usage-dot]').length, 3);
  assert.match(box.innerHTML, /<svg [^>]*height="266"/, 'the height its host keeps from 520px');
  const name = '2026-11-01-aaaa0001-20261101T104500Z';
  const row = pane.querySelector(`[data-usage-compaction="${name}"]`);
  const mark = box.querySelector('[data-usage-mark]');
  assert.equal(mark.getAttribute('visibility'), 'hidden');
  over(row.querySelector('span'));
  const dot = [...box.querySelectorAll('[data-usage-dot]')].find((d) => d.getAttribute('data-usage-dot') === name).querySelector('circle');
  assert.equal(mark.getAttribute('visibility'), 'visible');
  assert.deepEqual([mark.getAttribute('cx'), mark.getAttribute('cy')], [dot.getAttribute('cx'), dot.getAttribute('cy')]);
  assert.ok(row.hasAttribute('data-usage-marked'));
  const other = '2026-11-02-bbbb0002-20261103T150000Z';
  over([...box.querySelectorAll('[data-usage-dot]')].find((d) => d.getAttribute('data-usage-dot') === other).querySelector('circle'));
  assert.equal(pane.querySelectorAll('[data-usage-marked]').length, 1);
  assert.equal(pane.querySelector('[data-usage-marked]').getAttribute('data-usage-compaction'), other);
  box.dispatchEvent(new window.Event('pointerleave'));
  assert.equal(pane.querySelectorAll('[data-usage-marked]').length, 0);
  assert.equal(mark.getAttribute('visibility'), 'hidden');
});

test('a tap on a dot scrolls nowhere: it marks the dot and its row where they stand, and the dot\'s tip gives the row\'s figures', () => {
  const pane = $('[data-at="usage-compactions"]');
  const box = pane.querySelector('[data-usage-scatter]');
  const dotOf = (n) => [...box.querySelectorAll('[data-usage-dot]')].find((d) => d.getAttribute('data-usage-dot') === n);
  const rowOf = (n) => pane.querySelector(`[data-usage-compaction="${n}"]`);
  const mark = () => box.querySelector('[data-usage-mark]');
  const at = (n) => { const c = dotOf(n).querySelector('circle'); return [c.getAttribute('cx'), c.getAttribute('cy')]; };
  const name = '2026-11-01-aaaa0001-20261101T104500Z', other = '2026-11-02-bbbb0002-20261103T150000Z';
  moved(); tips.length = 0;
  tap(dotOf(name).querySelector('circle'));
  assert.deepEqual(moved(), [], 'no scroll to the row, no link, no summary opened');
  assert.deepEqual(tips, [dotOf(name)], 'the dot\'s title-tip is opened, at the dot');
  assert.equal(dotOf(name).getAttribute('data-title-tip-lead'), 'A titled session', 'under the name its row has');
  assert.equal(dotOf(name).getAttribute('data-title-tip'), localDay('2026-11-01T10:45:00.000Z') + ' · 800k → 100k · 100 calls · cost ≈ $1.16 · saved $14.00',
    'with the figures its row has');
  for (const figure of ['100 calls', '800k → 100k', '≈ $1.16', '$14.00']) assert.ok(text(rowOf(name)).includes(figure), figure + ' is the row\'s too');
  assert.ok(rowOf(name).hasAttribute('data-usage-marked'), 'the row is marked where it stands');
  assert.deepEqual([mark().getAttribute('visibility'), mark().getAttribute('cx'), mark().getAttribute('cy')], ['visible', ...at(name)]);
  // The tap's mark stays: pointing elsewhere shows that one, leaving returns.
  box.dispatchEvent(new window.Event('pointerleave'));
  assert.ok(rowOf(name).hasAttribute('data-usage-marked'), 'a tapped dot stays marked when the pointer leaves');
  over(rowOf(other).querySelector('span'));
  assert.deepEqual([rowOf(name).hasAttribute('data-usage-marked'), rowOf(other).hasAttribute('data-usage-marked')], [false, true]);
  pane.querySelector('[data-usage-compaction]').parentElement.dispatchEvent(new window.Event('pointerleave'));
  assert.deepEqual([rowOf(name).hasAttribute('data-usage-marked'), rowOf(other).hasAttribute('data-usage-marked')], [true, false], 'and leaving returns to it');
  // A new drawing of the chart puts the mark back.
  Object.defineProperty(box, 'clientWidth', { value: 390, configurable: true });
  data.paintScatter(box);
  assert.match(box.innerHTML, /<svg [^>]*width="390" height="236"/, 'the height its host keeps under 520px');
  assert.deepEqual([mark().getAttribute('visibility'), mark().getAttribute('cx'), mark().getAttribute('cy')], ['visible', ...at(name)]);
  assert.ok(rowOf(name).hasAttribute('data-usage-marked'));
  // A tap on a row marks it and its dot, goes nowhere, and a second lets go.
  tips.length = 0;
  for (const el of tappable(rowOf(other))) tap(el);
  assert.deepEqual(moved(), [], 'a tap anywhere on a row but its arrow scrolls nothing and opens no summary');
  if (!rowOf(other).hasAttribute('data-usage-marked')) tap(rowOf(other));
  assert.deepEqual([rowOf(name).hasAttribute('data-usage-marked'), rowOf(other).hasAttribute('data-usage-marked')], [false, true]);
  assert.deepEqual([mark().getAttribute('cx'), mark().getAttribute('cy')], at(other), 'the row\'s dot is ringed');
  assert.deepEqual(tips, [], 'a row has its figures on it, and opens no tip');
  tap(rowOf(other));
  assert.equal(pane.querySelectorAll('[data-usage-marked]').length, 0, 'a second tap lets both go');
  assert.equal(mark().getAttribute('visibility'), 'hidden');
  // A tap on the plot beside the dots lets a dot's mark go.
  tap(dotOf(other));
  assert.ok(rowOf(other).hasAttribute('data-usage-marked'));
  tap(box.querySelector('svg'));
  assert.equal(pane.querySelectorAll('[data-usage-marked]').length, 0);
  assert.deepEqual(moved(), []);
  Object.defineProperty(box, 'clientWidth', { value: 600, configurable: true });
  data.paintScatter(box);
});

test('reading again fetches only what changed, and forgets a file the store dropped', async () => {
  await show('spend');
  calls.length = 0;
  const changed = JSON.parse(store.get('2026-11-03-eeee0005'));
  changed.unowned.models['claude-opus-5-5'].output = 501000;
  store.set('2026-11-03-eeee0005', JSON.stringify(changed));
  store.delete('2026-10-20-cccc0003');
  await data.refresh();
  await settle();
  assert.deepEqual(blobs(), ['git/blobs/' + blobSha(store.get('2026-11-03-eeee0005'))], 'one changed file, one read');
  assert.ok(calls.includes('drop 2026-10-20-cccc0003'), 'the dropped file leaves this browser too');
  assert.equal(keptRows.has('2026-10-20-cccc0003'), false);
  assert.equal(keptRows.get('2026-11-03-eeee0005').sha, blobSha(store.get('2026-11-03-eeee0005')));
  const rows = $$('[data-at="usage-spend"] [data-usage-session]');
  assert.deepEqual(rows.map((a) => a.getAttribute('data-usage-session').slice(11)), ['bbbb0002', 'eeee0005', 'aaaa0001']);
  assert.match(text(rows[1]), /\$11\.50$/, 'ten dollars of output more');
  assert.match(text($('[data-usage]')), new RegExp('4 sessions · Nov 1 → ' + localDay('2026-11-04T09:45:00.000Z')));
});

test('a copy this browser kept under the listed sha is not read again', async () => {
  window.Usage.EXTRACTS.clear();
  calls.length = 0;
  await data.refresh();
  await settle();
  assert.deepEqual(blobs(), [], 'four files, all kept');
  assert.ok(calls.includes('kept usage.extracts'));
  assert.equal($$('[data-at="usage-spend"] [data-usage-session]').length, 3);
});

test('one file that cannot be read is left out and said so; the rest still draw', async () => {
  window.Usage.EXTRACTS.clear();
  keptRows.clear();
  broken.add('2026-11-01-aaaa0001');
  await data.refresh();
  await settle();
  assert.equal(data.missed, 1);
  assert.equal(data.error, '');
  assert.match(text($('[data-usage]')), /1 file unread, left out/);
  assert.equal($$('[data-at="usage-spend"] [data-usage-session]').length, 2);
  broken.clear();
  await data.refresh();
  await settle();
  assert.equal(data.missed, 0);
  assert.equal($$('[data-at="usage-spend"] [data-usage-session]').length, 3);
});

test('a listing that fails is the pane\'s error, with what was drawn left in place', async () => {
  const ls = FakeGH.prototype.ls;
  FakeGH.prototype.ls = async () => { throw new Error('GitHub Error 404: Not Found'); };
  await data.refresh();
  await settle();
  assert.equal(data.error, 'sessions/usage: GitHub Error 404: Not Found');
  assert.equal(data.loading, false);
  assert.equal($$('[data-at="usage-spend"] [data-usage-session]').length, 3);
  FakeGH.prototype.ls = ls;
  await data.refresh();
  await settle();
  assert.equal(data.error, '');
});

test('without a token nothing is read, and the pane says where usage comes from', async () => {
  window.Usage.EXTRACTS.clear();
  data.r = null;
  window.TOKEN = '';
  calls.length = 0;
  await data.refresh();
  await settle();
  assert.deepEqual(calls, []);
  assert.equal(data.r, null);
  const note = [...host.querySelectorAll('p')].find((p) => /private registry/.test(p.textContent));
  assert.notEqual(note.style.display, 'none');
  window.TOKEN = 'fixture';
  assert.deepEqual(problems, [], 'no expression failed along the way');
});

// Run apart, each under its own TZ: a date on the page is the reader's local
// date for an instant, and the day a record writes for a session's day.
test('an instant is shown as the reader\'s local date, a session\'s day as written, in any zone', () => {
  const file = path.join(repoRoot, 'lib/alpineComponents/usage.js');
  const script = `const w = {}; new Function('window', 'document', require('fs').readFileSync(${JSON.stringify(file)}, 'utf8'))(w, { addEventListener() {} });`
    + `console.log(JSON.stringify(['2026-11-03', '2026-11-03T15:00:00.000Z', '2026-11-01T10:45:00.000Z'].map(w.Usage.day)));`;
  const days = (tz) => JSON.parse(execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: tz }, encoding: 'utf8' }));
  assert.deepEqual(days('UTC'), ['Nov 3', 'Nov 3', 'Nov 1']);
  assert.deepEqual(days('Asia/Tokyo'), ['Nov 3', 'Nov 4', 'Nov 1'], 'nine hours ahead, the afternoon instant is already the next day');
  assert.deepEqual(days('Pacific/Pago_Pago'), ['Nov 3', 'Nov 3', 'Oct 31'], 'eleven hours behind, the morning instant is still the day before');
  assert.equal(window.Usage.day('2026-11-03T15:00:00.000Z'), localDay('2026-11-03T15:00:00.000Z'), 'and in this runner\'s own zone');
});
