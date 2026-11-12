// The Compactions card's context chart: kits/usage-chart.js drawing a usage
// extract (web-tools-private sessions/usage/YYYY/MM/<record name>.json) read
// through SessionUsage.fromExtract, inside alpineComponents/compactions.js.
// The kit is driven as a string builder at widths the test names; the
// component over a fake store, with the card's width set by hand, since jsdom
// has no layout.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot } from './bootstrap.mjs';

const { window } = makeWindow();
window.eval(readFileSync(path.join(repoRoot, 'lib/vanilla-bundle.js'), 'utf8'));
const run = (rel) => new window.Function('window', readFileSync(path.join(repoRoot, rel), 'utf8'))(window);
run('lib/kits/session-usage.js');
run('lib/kits/usage-chart.js');
let factory = null;
window.Alpine = { data: (name, f) => { if (name === 'compactions') factory = f; } };
new window.Function(readFileSync(path.join(repoRoot, 'lib/alpineComponents/compactions.js'), 'utf8'))();
window.document.dispatchEvent(new window.Event('alpine:init'));

const extract = JSON.parse(readFileSync(path.join(repoRoot, 'node/test/fixtures/session-usage/extract.json'), 'utf8'));
const u = window.SessionUsage.fromExtract(extract);
const C = window.UsageChart;
const FIRST = '2026-11-04-0ddba11a-20261104T120000Z', SECOND = '2026-11-04-0ddba11a-20261104T140000Z';

test('the context panel alone: no cost panel, no legend, its own prompt axis', () => {
  const s = C.svg(u, 390, { ph: 96, costPh: 0 });
  assert.match(s, /Context after each prompt/);
  assert.doesNotMatch(s, />Cost of each prompt<|>warm cache<|>idle re-load</);
  assert.match(s, /height="142"/, '22 above, 96 of panel, 24 for the prompt numbers');
  assert.equal((s.match(/data-k="\d+"/g) || []).length, u.prompts.length, 'one hit area per prompt');
});

test('the picked compaction: a tinted column at its prompt and a filled mark, the others hollow', () => {
  const s = C.svg(u, 600, { ph: 96, pick: 1, href: (c) => '?view=compactions&item=' + c.name });
  assert.equal((s.match(/data-usage-pick/g) || []).length, 1);
  const marks = s.match(/<a [^>]*data-cost-compaction[^>]*>/g) || [];
  assert.equal(marks.length, 2);
  assert.match(marks[1], /data-picked/);
  assert.doesNotMatch(marks[0], /data-picked/);
  assert.match(marks[0], new RegExp('data-name="' + FIRST + '"'));
  assert.match(marks[0], /href="\?view=compactions&amp;item=/, 'an ampersand in an address is escaped');
  assert.doesNotMatch(C.svg(u, 600, { ph: 96 }), /data-usage-pick|data-picked/, 'nothing picked by default');
});

test('a link at the panel head, drawn in the text colours, never a series hue', () => {
  const s = C.svg(u, 600, { ph: 96, link: { href: 'session.html#id=0ddba11a&pane=cost', label: 'Cost by prompt' } });
  assert.match(s, /<a href="session\.html#id=0ddba11a&amp;pane=cost" data-usage-link><text[^>]*class="fill-primary[^"]*">Cost by prompt</);
  assert.doesNotMatch(s, /<text[^>]*fill="#/);
});

test('combined: one short panel, the bars behind the line, dollars on a right axis, each series named', () => {
  const s = C.svg(u, 328, { ph: 48, combined: true, pick: 1 });
  assert.match(s, /height="82"/, '18 of legend, 48 of panel, 16 for the prompt numbers');
  assert.doesNotMatch(s, />Context after each prompt<|>Cost of each prompt</);
  assert.equal((s.match(/data-k="\d+"/g) || []).length, u.prompts.length, 'one hit area per prompt, not two');
  assert.ok((s.match(/data-usage-bar/g) || []).length > 0, 'the cost bars are drawn');
  assert.equal((s.match(/data-usage-right/g) || []).length, 3, 'three dollar labels on the right, level with the three on the left');
  assert.match(s, /data-usage-legend="line"[^>]*>context</);
  assert.match(s, /data-usage-legend="bar"[^>]*>cost per prompt</, 'at phone width the bars are named and the totals left out');
  assert.match(s, /data-usage-legend="idle"[^>]*>idle re-load</);
  const wide = C.svg(u, 700, { ph: 48, combined: true });
  assert.match(wide, /data-usage-legend="bar"[^>]*>cost per prompt, \$[\d.,]+ total</, "with room, the session's total follows the name");
  assert.equal((s.match(/data-usage-pick/g) || []).length, 1, 'the picked compaction is still picked out');

});

test('the record name and the extract path come from a summary id', () => {
  const X = window.Compactions;
  assert.equal(X.recordName(FIRST), '2026-11-04-0ddba11a');
  assert.equal(X.usagePath({ id: FIRST, day: '2026-11-04' }), 'sessions/usage/2026/11/2026-11-04-0ddba11a.json');
});

function component(files) {
  const reads = [];
  const c = factory(null);
  c.gh = { get: async (p) => { reads.push(p); if (!(p in files)) throw Object.assign(new Error('404'), { status: 404 }); return { text: files[p] }; } };
  c.rows = [FIRST, SECOND, '2026-10-01-feedbeef-20261001T100000Z'].map((id) => ({ id, path: 'p/' + id + '.json', size: 1,
    day: id.slice(0, 10), short: id.slice(11, 19), at: new Date() }));
  c.sel = FIRST;
  return { c, reads };
}
const card = (c, id, width = 600) => {
  const box = window.document.createElement('div');
  Object.defineProperty(box, 'clientWidth', { value: width });
  window.document.body.append(box);
  const host = c.chartEl(id, false);
  box.append(host);
  return host;
};
const settle = async () => { for (let i = 0; i < 6; i++) await tick(2); };
// A host draws on the next animation frame once its card is in the page.
const drawn = async (host) => { for (let i = 0; i < 100 && !host.querySelector('svg'); i++) await new Promise((r) => setTimeout(r, 10)); };

test('the extract is read once a card is current, once per session, and drawn with its summary picked', async () => {
  const { c, reads } = component({ 'sessions/usage/2026/11/2026-11-04-0ddba11a.json': JSON.stringify(extract) });
  const host = card(c, SECOND);
  await settle();
  assert.deepEqual(reads.filter((p) => p.startsWith('sessions/usage/')), [], 'nothing read until a card is current');
  c.read(SECOND);
  c.read(FIRST);
  await settle();
  await drawn(host);
  assert.deepEqual(reads.filter((p) => p.startsWith('sessions/usage/')), ['sessions/usage/2026/11/2026-11-04-0ddba11a.json']);
  const svg = host.querySelector('svg');
  assert.ok(svg, 'drawn once the extract arrived');
  assert.match(host.querySelector('[data-picked]').getAttribute('data-name'), new RegExp(SECOND));
  assert.equal(host.querySelector('[data-usage-link]'), null, 'the cost panel is on the card, so no link leads to it');
  assert.equal(svg.getAttribute('width'), '600');
  assert.equal(svg.getAttribute('height'), '82', 'one short panel for context and cost together');
  assert.ok(host.querySelector('[data-usage-bar]'), 'the cost bars are in it');
  const phone = card(c, SECOND, 328);
  await drawn(phone);
  assert.ok(phone.querySelector('[data-usage-bar]'), 'at phone width too');
});

test('a session without an extract draws nothing and says nothing', async () => {
  const { c } = component({});
  const id = '2026-10-01-feedbeef-20261001T100000Z';
  const host = card(c, id);
  c.read(id);
  await settle();
  assert.equal(host.childElementCount, 0);
  assert.equal(host.textContent, '');
  assert.match(host.className, /empty:hidden/);
});

test('a tap on another compaction\'s mark opens that summary\'s card', async () => {
  const { c } = component({ 'sessions/usage/2026/11/2026-11-04-0ddba11a.json': JSON.stringify(extract) });
  const picks = [];
  c._swiper = { pick: (id) => picks.push(id) };
  const host = card(c, FIRST);
  c.read(FIRST);
  await settle();
  await drawn(host);
  const other = host.querySelector(`[data-name="${SECOND}"] circle`);
  other.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.deepEqual(picks, [SECOND], 'the strip is asked to go to it');
});
