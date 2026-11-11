// alpineComponents/session-brief.js: the Cost tab, after Turns, which draws
// kits/session-usage.js's reading of a measured record as one chart in two
// panels, through kits/usage-chart.js. Driven over a record handed in whole,
// with the real kits loaded where the component asks for them; jsdom has no
// layout, so the chart is drawn by calling the string builder at a width the
// test names.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const step = (at, read, write) => ({ at, model: 'claude-opus-5-5',
  usage: { input_tokens: 1, cache_read_input_tokens: read, cache_creation_input_tokens: write, output_tokens: 50 } });
const record = {
  schema: 17, short: 'c0517ab1', day: '2026-11-03', started: '2026-11-03T10:00:00Z', ended: '2026-11-03T16:00:00Z',
  repos: [], exchanges: 2, calls: [], replies: [],
  cost: { totalCostUSD: 3.5 },
  prompts: [{ at: '2026-11-03T10:00:00.000Z', text: 'one' },
            { at: '2026-11-03T10:20:00.000Z', text: 'peer', origin: 'peer' },
            { at: '2026-11-03T13:00:00.000Z', text: 'two' }],
  injected: [{ kind: 'compaction', at: '2026-11-03T13:30:00.000Z', chars: 900 }],
  responses: [step('2026-11-03T10:00:01.000Z', 0, 200000), step('2026-11-03T10:30:00.000Z', 200000, 5000),
              step('2026-11-03T13:00:02.000Z', 1000, 204000), step('2026-11-03T13:31:00.000Z', 0, 160000)],
};
const old = { ...record, short: 'feed0002', responses: undefined, schema: 15 };

const { window, problems } = makeWindow({ html: `<!doctype html><html><body>
  <div id="cost" x-data="sessionBrief(window.__cost)"></div>
  <div id="old" x-data="sessionBrief(window.__old)"></div></body></html>` });
class FakeGH {
  constructor(conf = {}) { this.repo = conf.repo || ''; }
  async get() { throw Object.assign(new Error('404'), { status: 404 }); }
  async req() { return []; }
}
window.GH = FakeGH;
window.TOKEN = 'tkn';
const loads = [];
window.gh = { load: async (k) => {
  loads.push(k);
  if (k === 'kits/session-usage.js' || k === 'kits/usage-chart.js') new window.Function('window', readFileSync(path.join(repoRoot, 'lib', k), 'utf8'))(window);
} };
window.claudeMark = { svg: () => '<svg></svg>' };
window.sessionRender = { describe: (r) => ({ title: r.short, subtitle: '' }), turns: (r) => r.replies || [], groups: (t) => t.map((x) => [x]),
                         open: async () => ({ close(){} }) };
window.sessionExport = { index: () => ({ el: window.document.createElement('div') }) };
window.chatRender = { block: () => window.document.createElement('pre') };
window.swipeDeck = { top: () => null };
window.__cost = { id: 'c0517ab1', repo: 'me/private', framed: true, record, pane: 'cost' };
window.__old = { id: 'feed0002', repo: 'me/private', framed: true, record: old, pane: 'cost' };

const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
for (const k of ['lib/kits/repo-address.js', 'lib/kits/closing-state.js', 'lib/kits/repo-sessions-cache.js']) {
  new window.Function('window', readFileSync(path.join(repoRoot, k), 'utf8'))(window);
}
for (const p of ['lib/alpine-bundle.js', 'lib/alpineComponents/session-brief.js']) {
  new window.Function(readFileSync(path.join(repoRoot, p), 'utf8'))();
}
Alpine.start();
const el = (id) => window.document.getElementById(id);
const data = (id) => Alpine.$data(el(id));
const until = async (ok) => { for (let i = 0; i < 60 && !ok(); i++) await tick(2); return ok(); };
await until(() => data('cost').usage);

test('mounting is quiet', () => assert.deepEqual(problems, []));

test('pane=cost lands on the tab, after Turns, and reads the record through the kit', () => {
  const tabs = [...el('cost').querySelectorAll('[data-at="tabs"] [role="tab"]')].map((t) => t.textContent.trim());
  assert.deepEqual(tabs.slice(0, 3), ['Overview', 'Turns', 'Cost']);
  assert.equal(data('cost').topPane, 'cost');
  assert.ok(loads.includes('kits/session-usage.js'));
  assert.ok(loads.includes('kits/usage-chart.js'), 'the chart is the shared kit\'s');
  const u = data('cost').usage;
  assert.equal(u.prompts.length, 2, 'the peer note is not a prompt');
  assert.equal(u.totals.reloads, 1);
  assert.equal(u.totals.harness, 3.5);
});

test('a record without responses has no Cost tab, and pane=cost falls back', () => {
  assert.equal(data('old').measured, false);
  assert.equal(data('old').topPane, 'overview');
  const tab = el('old').querySelector('[data-at="cost"]');
  assert.equal(tab.style.display, 'none');
});

test('the totals carry the list-price caveat once, as a title-tip', () => {
  const line = el('cost').querySelector('[data-cost-total]');
  assert.match(line.textContent, /main conversation/);
  assert.match(line.getAttribute('data-title-tip'), /list prices.*not what a subscription is billed/);
  assert.equal(el('cost').querySelectorAll('[data-session-cost] [title]').length, 0, 'no fact in a title');
});

test('the chart: two panels, a bar and a re-load segment, hues by theme, a compaction linked to its summary', () => {
  const d = data('cost');
  const light = d.costSvg(d.usage, 390, false, 120);
  assert.match(light, /width="390"/);
  assert.match(light, /Context after each prompt/);
  assert.match(light, /Cost of each prompt/);
  assert.match(light, />warm cache</);
  assert.match(light, />idle re-load</);
  assert.match(light, /fill="#2a78d6"/);
  assert.match(light, /fill="#eb6834"/);
  const dark = d.costSvg(d.usage, 390, true, 120);
  assert.match(dark, /#3987e5/);
  assert.match(dark, /#d95926/);
  assert.doesNotMatch(dark, /#2a78d6/);
  // Text is drawn in the text colour, never a series colour.
  assert.doesNotMatch(light, /<text[^>]*fill="#/);
  assert.match(light, /href="https:\/\/mehrlander\.github\.io\/web-tools\/pages\/compactions\.html#at=2026-11-03-c0517ab1-20261103T133000Z"/);
  // One hit area per prompt in each panel, carrying its figures.
  const hits = light.match(/data-k="\d+"/g) || [];
  assert.equal(hits.length, 4);
  assert.match(light, /data-title-tip-lead="Prompt 2"/);
});

test('a tap goes to that prompt\'s turn, by its place in record.prompts', async () => {
  const d = data('cost');
  const host = el('cost').querySelector('[data-cost-chart]');
  host.innerHTML = d.costSvg(d.usage, 390, false, 120);
  d._costHost = host;
  const jumps = [];
  d.goTurn = (i) => jumps.push(i);
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  host.querySelectorAll('rect[data-k="1"]')[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await tick(2);
  assert.deepEqual(jumps, [2], 'the second owner prompt is record.prompts[2]');
});
