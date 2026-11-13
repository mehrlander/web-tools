// alpineComponents/usage.js, the Usage tab of the app's Activity row, mounted
// with the real Alpine over a stand-in for the session store: the listings
// under sessions/usage, each file with its git blob sha, and a blob by that
// sha. The extracts are the made-up ones usage-readings.test.mjs works by
// hand; here the question is what reaches the page: which files are read and
// when, what each pane draws from a reading, and where a row goes. jsdom has
// no layout, so the scatter is driven as the string it is and its host's
// width set by hand.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
window.TitleTip = {};
// This browser's kept copies (kits/persistence.js's collection, as the pane uses it).
const keptRows = new Map();
window.persistence = { collection: (name) => ({
  all: async () => { calls.push('kept ' + name); return [...keptRows.values()]; },
  put: async (row) => { keptRows.set(row.id, row); return row; },
  delete: async (id) => { calls.push('drop ' + id); keptRows.delete(id); },
}) };
const opened = [];
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
// The pane keeps a clock running for Continue; without this the file never ends.
test.after(() => { data.destroy(); window.close(); });
const show = async (key) => { $(`[data-at="usage-tab-${key}"]`).click(); await settle(); };

test('the first visit lists the store by three levels and reads each file once, as a blob by its sha', () => {
  assert.deepEqual(calls.filter((c) => c.startsWith('ls ')), ['ls sessions/usage', 'ls sessions/usage/2026', 'ls sessions/usage/2026/10', 'ls sessions/usage/2026/11']);
  assert.equal(blobs().length, 5);
  assert.deepEqual(blobs().sort(), [...store.keys()].map((n) => 'git/blobs/' + blobSha(store.get(n))).sort());
  assert.equal(data.loading, false);
  assert.equal(data.error, '');
  assert.equal(keptRows.size, 5, 'each read file is kept in this browser under its sha');
  assert.equal(keptRows.get('2026-11-01-aaaa0001').sha, blobSha(store.get('2026-11-01-aaaa0001')));
  assert.match(text($('[data-usage]')), /5 sessions · Oct 20 to Nov 4/);
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
  assert.ok($('[data-slot="frame:subtabs"]'));
  assert.ok($('[data-pattern="figure"]'));
});

test('Spend: one bar of four named parts, then a row per session with the same four on one scale', () => {
  const pane = $('[data-at="usage-spend"]');
  const legend = [...pane.querySelectorAll('span[data-usage-part]')].filter((x) => x.textContent.trim()).map(text);
  assert.deepEqual(legend, ['Context reads $7.10 17%', 'Idle re-loads $13.28 33%', 'Other cache writes $14.80 36%', 'Output $5.42 13%']);
  assert.match(text(pane), /total \$40\.60/);
  const total = widths(pane.querySelector('[role="img"]'));
  assert.equal(total.length, 4);
  assert.ok(Math.abs(total.reduce((a, b) => a + b, 0) - 100) < 0.05, 'the four parts fill the bar');
  const rows = [...pane.querySelectorAll('a[data-usage-session]')];
  assert.deepEqual(rows.map((a) => a.getAttribute('data-usage-session')),
    ['2026-11-02-bbbb0002', '2026-11-01-aaaa0001', '2026-10-20-cccc0003', '2026-11-03-eeee0005'], 'dearest first; the unpriced session has no row');
  assert.ok(Math.abs(widths(rows[0]).reduce((a, b) => a + b, 0) - 100) < 0.05, 'the dearest session fills the scale');
  assert.ok(Math.abs(widths(rows[1]).reduce((a, b) => a + b, 0) - 100 * 11.104 / 26.28) < 0.05, 'the next is on the same scale');
  assert.match(text(rows[1]), /^Nov 1 A titled session \$11\.10$/, 'named by the sessions index');
  assert.match(text(rows[0]), /^Nov 2 A made-up session on the dearer model.* \$26\.28$/, 'else by what it was first asked');
  assert.match(text(rows[3]), /^Nov 3 eeee0005 \$1\.50$/, 'else by its short id');
  assert.equal(rows[0].getAttribute('href'), '?view=sessions&session=bbbb0002&pane=cost');
  assert.match(text(pane), /1 session used claude-sonnet-5-5, which has no price here/);
  assert.match(pane.querySelector('[data-usage-part="read"]').className, /bg-\[#2a78d6\]/, 'the chart\'s blue');
  assert.match(pane.querySelector('[data-usage-part="reload"]').className, /bg-\[#eb6834\]/, 'the chart\'s orange');
});

test('a session row opens the session at its Cost tab; a modified click is left to the browser', () => {
  const got = [];
  window.document.addEventListener('web-tools:open-session', (e) => got.push(e.detail));
  const row = $('a[data-usage-session="2026-11-01-aaaa0001"]');
  const click = new window.MouseEvent('click', { bubbles: true, cancelable: true });
  row.dispatchEvent(click);
  assert.deepEqual(JSON.parse(JSON.stringify(got)), [{ id: 'aaaa0001', day: '2026-11-01', pane: 'cost' }]);
  assert.equal(click.defaultPrevented, true);
  // jsdom cannot follow a link, so the page takes the click once the row has had it.
  let left = null;
  const after = (e) => { left = !e.defaultPrevented; e.preventDefault(); };
  window.document.addEventListener('click', after);
  row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
  window.document.removeEventListener('click', after);
  assert.equal(got.length, 1);
  assert.equal(left, true, 'the link is the browser\'s to open in a new tab');
});

test('Calls: a row per bin, the share of prompts and the share of calls on one scale', async () => {
  await show('calls');
  const pane = $('[data-at="usage-calls"]');
  assert.equal(pane.style.display, '');
  assert.equal($('[data-at="usage-spend"]').style.display, 'none');
  assert.equal($('[data-at="usage-spend"] a[data-usage-session]'), null, 'a closed pane keeps no rows on the page');
  assert.match(text(pane), /^share of 7 prompts share of 105 model calls median 4 · mean 15 calls per prompt · 1 prompt with none calls per prompt share count 1 14%/);
  const rows = [...pane.querySelectorAll('[data-usage-bin]')];
  assert.deepEqual(rows.map((x) => text(x)), ['1 14% 1 1.0% 1', '2-3 29% 2 4.8% 5', '4-7 29% 2 8.6% 9', '8-15 0% 0 0% 0', '16-31 14% 1 19% 20', '32-63 0% 0 0% 0', '64+ 14% 1 67% 70']);
  const bars = rows[6].querySelectorAll('span.block');
  assert.equal(bars.length, 2);
  assert.equal(parseFloat(bars[1].style.width), 100, 'the largest share is the scale');
  assert.ok(Math.abs(parseFloat(bars[0].style.width) - 100 * (1 / 7) / (70 / 105)) < 0.05, 'and the other bar is on it');
  assert.match(bars[1].className, /bg-\[#2a78d6\]/, 'calls in the reads\' blue');
});

test('Re-loads: a row per ender, the dearest first, its bar the dollars its re-loads wrote', async () => {
  await show('reloads');
  const pane = $('[data-at="usage-reloads"]');
  assert.match(text(pane), /^5 idle re-loads wrote \$13\.28/);
  const rows = [...pane.querySelectorAll('[data-usage-ender]')];
  assert.deepEqual(rows.map((x) => text(x)), [
    'Another session 1 re-load · median gap 2 h $6.40',
    'Owner prompt 1 re-load · median gap 2 h $2.00',
    'Pull request 1 re-load · median gap 5 h $2.00',
    'Background task 1 re-load · median gap 1.5 h $1.28',
    'Not recorded 1 re-load $1.60']);
  assert.equal(parseFloat(rows[0].querySelector('span.block').style.width), 100);
  assert.equal(parseFloat(rows[1].querySelector('span.block').style.width), 31.25);
  assert.match(rows[0].querySelector('span.block').className, /bg-\[#eb6834\]/);
  assert.match(rows[4].querySelector('[data-title-tip]').getAttribute('data-title-tip'), /before re-loads were listed/);
});

test('Continue: an orange bar where lapsed; where warm a grey one, what it becomes, and the minutes left', async () => {
  await show('continue');
  const pane = $('[data-at="usage-continue"]');
  const chips = [...pane.querySelectorAll('[data-slot="frame:count-chips"] button')];
  assert.deepEqual(chips.map(text), ['All 5', 'Warm 1', 'Lapsed 4'], 'each chip counts the rows it narrows to');
  const rows = () => [...pane.querySelectorAll('a[data-usage-session]')];
  assert.deepEqual(rows().map((a) => a.getAttribute('data-usage-session').slice(11)), ['aaaa0001', 'cccc0003', 'eeee0005', 'bbbb0002', 'dddd0004']);
  assert.match(text(rows()[0]), /^3d A titled session 400k \$3\.20$/);
  assert.match(rows()[0].querySelector('span[style]').className, /bg-\[#eb6834\]/);
  const warm = rows()[3];
  assert.match(text(warm), /^15m A made-up session on the dearer model.* 500k 45 min, then \$8\.00 \$0\.10$/);
  const bars = warm.querySelectorAll('span[style]');
  assert.equal(bars.length, 2);
  assert.match(bars[0].className, /bg-base-content\/40/, 'grey: what it costs now');
  assert.match(bars[1].className, /border-dashed border-\[#eb6834\]/, 'outlined: what it becomes');
  // One scale for all: the dearest lapsed row is 3.20, the warm one becomes 8.00.
  assert.equal(parseFloat(bars[0].style.width) + parseFloat(bars[1].style.width), 100);
  assert.equal(parseFloat(rows()[0].querySelector('span[style]').style.width), 40);
  assert.match(text(rows()[4]), /50k no price$/);
  assert.equal(rows()[0].getAttribute('href'), '?view=sessions&session=aaaa0001');
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
  const first = $('[data-at="usage-continue"] a[data-usage-session]');
  assert.match(text(first), /^1h A made-up session on the dearer model.* 500k \$8\.00$/, 'now the dearest, and orange');
  assert.match(text($('[data-at="usage-continue"] [data-slot="frame:count-chips"]')), /Warm ?0/);
  window.Date.now = () => NOW;
  data.refold();
  await settle();
});

test('Compactions: a row each, the estimated cost marked as one, and where a row goes', async () => {
  await show('compactions');
  const pane = $('[data-at="usage-compactions"]');
  assert.match(text(pane), /^4 compactions cost about \$19\.28 saved \$15\.50 in context reads 1 of 2 paid back · break-even about 8 calls/);
  const rows = [...pane.querySelectorAll('a[data-usage-compaction]')];
  assert.deepEqual(rows.map(text), [
    'Nov 4 A made-up session on the dearer model: still warm, compacted twice. 0 calls 500k to ? about $0.50',
    'Nov 3 A made-up session on the dearer model: still warm, compacted twice. 10 calls 900k to 150k about $17.40 $1.50 saved',
    'Nov 1 A titled session 100 calls 800k to 100k about $1.16 $14.00 saved',
    'Oct 20 A made-up session in the extract shape of before the re-loads were listed. 600k to 100k about $0.22']);
  for (const row of rows) assert.match(text(row), /about \$/, 'an estimated cost says so wherever it shows');
  assert.match(rows[2].querySelector('[data-title-tip]').getAttribute('data-title-tip'),
    /^An estimate: about \$0\.36 for the summary and \$0\.80 to write the new context, paid back after about 9 calls$/);
  assert.equal(rows[2].getAttribute('href'), '?view=compactions&item=2026-11-01-aaaa0001-20261101T104500Z');
  rows[2].dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.deepEqual(opened, ['2026-11-01-aaaa0001-20261101T104500Z'], 'the app opens the summary in the Compactions tab');
});

test('the scatter: a dot per compaction with its calls counted, over the break-even curve', () => {
  const svg = window.Usage.scatter(data.r.compactions, 600, { ph: 200 });
  const dots = svg.match(/<g data-usage-dot="[^"]+"/g) || [];
  assert.deepEqual(dots.map((d) => /"([^"]+)"/.exec(d)[1]).sort(),
    ['2026-11-01-aaaa0001-20261101T104500Z', '2026-11-02-bbbb0002-20261103T150000Z', '2026-11-02-bbbb0002-20261104T094400Z'],
    'the older row has no count of calls, so no place on the chart');
  assert.equal((svg.match(/data-usage-even /g) || []).length, 1, 'one break-even curve');
  assert.match(svg, />about break-even</, 'named as the estimate it is');
  assert.match(svg, />calls after</);
  assert.match(svg, />context before</);
  assert.match(svg, /<svg [^>]*width="600" height="266"/, '30 above, 200 of plot, 36 for the axis');
  for (const name of ['2026-11-02-bbbb0002-20261103T150000Z', '2026-11-02-bbbb0002-20261104T094400Z']) {
    const hollow = new RegExp('<g data-usage-dot="' + name + '"[^>]*>(.*?)</g>').exec(svg)[1];
    assert.match(hollow, /class="fill-base-100" stroke="currentColor"/, 'one that has not paid for itself is hollow');
  }
  const paid = /<g data-usage-dot="2026-11-01-aaaa0001-20261101T104500Z"[^>]*>(.*?)<\/g>/.exec(svg)[1];
  assert.match(paid, /fill="#2a78d6"/);
  assert.match(svg, /data-title-tip="Nov 1 · 800k to 100k · 100 calls after · about \$1\.16 to compact · \$14\.00 saved"/);
  assert.match(window.Usage.scatter(data.r.compactions, 600, { dark: true }), /fill="#3987e5"/, 'the dark page\'s blue');
  assert.doesNotMatch(svg, /tabindex/, 'the rows are the keyboard\'s way to a compaction, not 150 tab stops');
});

test('a dot and its row are one compaction: pointing at either marks both', async () => {
  const pane = $('[data-at="usage-compactions"]');
  const box = pane.querySelector('[data-usage-scatter]');
  Object.defineProperty(box, 'clientWidth', { value: 600, configurable: true });
  data.paintScatter(box);
  assert.equal(box.querySelectorAll('[data-usage-dot]').length, 3);
  const name = '2026-11-01-aaaa0001-20261101T104500Z';
  const row = pane.querySelector(`a[data-usage-compaction="${name}"]`);
  const mark = box.querySelector('[data-usage-mark]');
  assert.equal(mark.getAttribute('visibility'), 'hidden');
  row.querySelector('span').dispatchEvent(new window.Event('pointerover', { bubbles: true }));
  const dot = [...box.querySelectorAll('[data-usage-dot]')].find((d) => d.getAttribute('data-usage-dot') === name).querySelector('circle');
  assert.equal(mark.getAttribute('visibility'), 'visible');
  assert.deepEqual([mark.getAttribute('cx'), mark.getAttribute('cy')], [dot.getAttribute('cx'), dot.getAttribute('cy')]);
  assert.ok(row.hasAttribute('data-usage-marked'));
  const other = '2026-11-02-bbbb0002-20261103T150000Z';
  [...box.querySelectorAll('[data-usage-dot]')].find((d) => d.getAttribute('data-usage-dot') === other).querySelector('circle')
    .dispatchEvent(new window.Event('pointerover', { bubbles: true }));
  assert.equal(pane.querySelectorAll('[data-usage-marked]').length, 1);
  assert.equal(pane.querySelector('[data-usage-marked]').getAttribute('data-usage-compaction'), other);
  box.dispatchEvent(new window.Event('pointerleave'));
  assert.equal(pane.querySelectorAll('[data-usage-marked]').length, 0);
  assert.equal(mark.getAttribute('visibility'), 'hidden');
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
  const rows = $$('[data-at="usage-spend"] a[data-usage-session]');
  assert.deepEqual(rows.map((a) => a.getAttribute('data-usage-session').slice(11)), ['bbbb0002', 'eeee0005', 'aaaa0001']);
  assert.match(text(rows[1]), /\$11\.50$/, 'ten dollars of output more');
  assert.match(text($('[data-usage]')), /4 sessions · Nov 1 to Nov 4/);
});

test('a copy this browser kept under the listed sha is not read again', async () => {
  window.Usage.EXTRACTS.clear();
  calls.length = 0;
  await data.refresh();
  await settle();
  assert.deepEqual(blobs(), [], 'four files, all kept');
  assert.ok(calls.includes('kept usage.extracts'));
  assert.equal($$('[data-at="usage-spend"] a[data-usage-session]').length, 3);
});

test('one file that cannot be read is left out and said so; the rest still draw', async () => {
  window.Usage.EXTRACTS.clear();
  keptRows.clear();
  broken.add('2026-11-01-aaaa0001');
  await data.refresh();
  await settle();
  assert.equal(data.missed, 1);
  assert.equal(data.error, '');
  assert.match(text($('[data-usage]')), /1 file could not be read and is left out/);
  assert.equal($$('[data-at="usage-spend"] a[data-usage-session]').length, 2);
  broken.clear();
  await data.refresh();
  await settle();
  assert.equal(data.missed, 0);
  assert.equal($$('[data-at="usage-spend"] a[data-usage-session]').length, 3);
});

test('a listing that fails is the pane\'s error, with what was drawn left in place', async () => {
  const ls = FakeGH.prototype.ls;
  FakeGH.prototype.ls = async () => { throw new Error('GitHub Error 404: Not Found'); };
  await data.refresh();
  await settle();
  assert.equal(data.error, 'sessions/usage: GitHub Error 404: Not Found');
  assert.equal(data.loading, false);
  assert.equal($$('[data-at="usage-spend"] a[data-usage-session]').length, 3);
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
