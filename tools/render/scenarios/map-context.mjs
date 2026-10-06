// Context Delivery: live CSV identity, filtering, inspector and topic round-trip.
// npm run shot -- app/index.html --query "view=map&tab=context"
//   --script tools/render/scenarios/map-context.mjs --full
// Data is read from disk explicitly: the renderer otherwise honors committed
// refs for CSVs, so before a commit it would pair new code with the old schema.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

export default async function (page) {
  const sources = readFileSync(new URL('../../../docs/context-sources.csv', import.meta.url), 'utf8');
  const topics = readFileSync(new URL('../../../docs/context-topics.csv', import.meta.url), 'utf8');
  await page.waitForFunction(() => [...document.querySelectorAll('[x-data]')].some(el => el.getAttribute('x-data') === 'map()'));
  await page.evaluate(async ({ sources, topics }) => {
    const el = [...document.querySelectorAll('[x-data]')].find(el => el.getAttribute('x-data') === 'map()');
    const state = window.Alpine.$data(el);
    const get = window.GH.prototype.get;
    window.GH.prototype.get = async function (name, ...args) {
      if (name === 'docs/context-sources.csv') return { text: sources };
      if (name === 'docs/context-topics.csv') return { text: topics };
      return get.call(this, name, ...args);
    };
    try {
      while (state.ctxLoading) await new Promise(resolve => setTimeout(resolve, 20));
      state.ctxReg = null;
      await state.loadContextReg();
    } finally { window.GH.prototype.get = get; }
  }, { sources, topics });
  const source = page.locator('[data-context-source="plugin-default"]');
  await source.click();
  const inspector = page.locator('[data-context-inspector]');
  assert.match(await inspector.innerText(), /The conventions \(default skill\)/);
  assert.match(await inspector.innerText(), /Session record/);
  assert.doesNotMatch(await inspector.innerText(), /tokens|Footprint/);
  await page.getByRole('combobox', { name: 'Delivery classification' }).selectOption('outside');
  assert.doesNotMatch(await inspector.innerText(), /The conventions \(default skill\)/);
  await page.getByRole('combobox', { name: 'Delivery classification' }).selectOption('unclassified');
  await page.getByText('No sources match these filters.', { exact: true }).waitFor({ state: 'visible' });
  assert.equal(await inspector.count(), 0);
  await page.getByRole('combobox', { name: 'Delivery classification' }).selectOption('');
  await source.click();
  await inspector.getByRole('button', { name: /How the conventions arrive/ }).click();
  await page.getByRole('button', { name: 'View How the conventions arrive in Delivery', exact: true }).click();
  const result = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[x-data]')].find(el => el.getAttribute('x-data') === 'map()');
    const s = window.Alpine.$data(el);
    return { lens: s.ctxLens, selected: s.ctxSpectraActive.id, topic: s.ctxTopic,
      classes: s.ctxSpectraFilteredDiscretions.map(d => d.id),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  assert.equal(result.lens, 'delivery');
  assert.equal(result.selected, 'plugin-default');
  assert.equal(result.topic, 'conventions-delivery');
  assert.ok(!result.classes.includes('unclassified'), 'all public rows declare their classification');
  assert.ok(result.scrollWidth <= result.width + 1, JSON.stringify(result));
  await page.evaluate(() => window.scrollTo(0, 0));
  console.log('Context browser checks:', JSON.stringify(result));
}
