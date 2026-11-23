// alpineComponents/session-brief.js: what a measured session cost, on the
// Overview (the Cost tab's until 2026-11-17). One line of figures (the main
// conversation's cost, the prompts, the context's peak, the compactions), a
// short chart of the context after each prompt, and behind the cost figure a
// panel with cost per prompt and the harness's own total. kits/session-usage.js
// reads the record and kits/usage-chart.js draws both charts. Driven over a
// record handed in whole, with the real kits loaded where the component asks
// for them; jsdom has no layout, so a chart is drawn by calling the string
// builder at a width the test names.

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
  <div id="old" x-data="sessionBrief(window.__old)"></div>
  <div id="empty" x-data="sessionBrief(window.__empty)"></div></body></html>` });
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
window.__empty = { id: 'feed0003', repo: 'me/private', framed: true, record: { ...record, short: 'feed0003', responses: [] }, pane: 'cost' };

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

test('pane=cost lands on the Overview, reads the record through the kit, and opens the cost panel', async () => {
  const tabs = [...el('cost').querySelectorAll('[data-at="tabs"] [role="tab"]')].map((t) => t.textContent.trim());
  assert.ok(!tabs.includes('Cost'), 'the Cost tab is gone');
  assert.equal(data('cost').pane, 'overview');
  assert.ok(loads.includes('kits/session-usage.js'));
  assert.ok(loads.includes('kits/usage-chart.js'), 'the chart is the shared kit\'s');
  const u = data('cost').usage;
  assert.equal(u.prompts.length, 2, 'the peer note is not a prompt');
  assert.equal(u.totals.reloads, 1);
  assert.equal(u.totals.harness, 3.5);
  assert.ok(await until(() => data('cost').factTip?.kind === 'cost'), 'the address asked for the cost, so its panel opens once');
  assert.equal(data('cost').costAsked, false);
});

test('the cost line: the cost, the prompts, the peak and the compactions, the cost opening its panel', () => {
  const line = el('cost').querySelector('[data-cost-line]');
  const parts = [...line.children].map((n) => n.textContent.replace(/\s+/g, ' ').trim());
  assert.deepEqual(parts.slice(1), ['2 prompts', 'context peak 205k', '1 compaction']);
  const btn = line.querySelector('[data-at="cost"]');
  assert.ok(btn.hasAttribute('data-fact-btn'), 'the figure is a control, as the head\'s counts are');
  assert.match(btn.querySelector('i').className, /ph-coins/, 'the icon beside the figure (house style rule 10)');
  assert.match(btn.getAttribute('aria-label'), /main conversation/);
});

test('a record without responses has no cost line, and pane=cost lands on the Overview', () => {
  assert.equal(data('old').measured, false);
  assert.equal(data('old').pane, 'overview');
  assert.equal(el('old').querySelector('[data-session-cost]').style.display, 'none');
  assert.equal(data('old').usage, null);
});

test('a record whose responses are empty is not measured: no cost line either', () => {
  assert.equal(data('empty').measured, false);
  assert.equal(el('empty').querySelector('[data-session-cost]').style.display, 'none');
  assert.equal(el('empty').querySelector('[data-cost-line]'), null);
});

test('the panel carries the list-price caveat once, as a title-tip, and the harness total beside it', async () => {
  assert.ok(await until(() => el('cost').querySelector('[data-cost-panel]')));
  const panel = el('cost').querySelector('[data-cost-panel]');
  const head = panel.querySelector('[data-cost-total]');
  assert.match(head.textContent, /main conversation/);
  assert.match(head.getAttribute('data-title-tip'), /list prices.*not what a subscription is billed/);
  assert.match(panel.querySelector('[data-cost-harness]').textContent, /harness total\s*\$3\.50/);
  assert.equal(panel.querySelectorAll('[title]').length, 0, 'no fact in a title');
  const chart = panel.querySelector('[data-cost-panel-chart]').innerHTML;
  assert.match(chart, /normal cost/, 'cost per prompt, as bars behind the context line');
  assert.match(chart, /idle re-load/);
});

test('the Overview\'s chart: the context panel alone, short, a compaction linked to its summary', () => {
  const d = data('cost');
  const light = d.costSvg(d.usage, 390);
  assert.match(light, /width="390"/);
  assert.match(light, /Context after each prompt/);
  assert.doesNotMatch(light, /Cost of each prompt/, 'cost per prompt is the panel\'s');
  assert.match(light, /stroke="#2a78d6"/);
  // Text is drawn in the text colour, never a series colour.
  assert.doesNotMatch(light, /<text[^>]*fill="#/);
  assert.match(light, /href="https:\/\/mehrlander\.github\.io\/web-tools\/pages\/compactions\.html#at=2026-11-03-c0517ab1-20261103T133000Z"/);
  // One hit area per prompt, carrying its figures.
  const hits = light.match(/data-k="\d+"/g) || [];
  assert.equal(hits.length, 2);
  assert.match(light, /data-title-tip-lead="Prompt 2"/);
  const h = +light.match(/height="(\d+)"/)[1];
  assert.ok(h < 110, 'short: ' + h + 'px');
});

test('a tap goes to that prompt\'s turn, by its place in record.prompts', async () => {
  const d = data('cost');
  const host = el('cost').querySelector('[data-cost-chart]');
  host.innerHTML = d.costSvg(d.usage, 390);
  d._costHost = host;
  const jumps = [];
  d.goTurn = (i) => jumps.push(i);
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  host.querySelectorAll('rect[data-k="1"]')[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await tick(2);
  assert.deepEqual(jumps, [2], 'the second owner prompt is record.prompts[2]');
});
