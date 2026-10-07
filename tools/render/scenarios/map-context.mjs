// Context Delivery: row groups, source connections and a topic round-trip.
// npm run shot -- app/index.html --query "view=map&tab=context"
//   --script tools/render/scenarios/map-context.mjs --full
// Data is read from disk explicitly: the renderer otherwise honors committed
// refs for CSVs, so before a commit it would pair new code with the old schema.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

export default async function (page) {
  const files = Object.fromEntries(['docs/context-sources.csv', 'docs/context-topics.csv',
    'docs/context-links.csv', 'skills/hooks/hooks.json'].map(p =>
    [p, readFileSync(new URL('../../../' + p, import.meta.url), 'utf8')]));
  await page.waitForFunction(() => [...document.querySelectorAll('[x-data]')].some(el => el.getAttribute('x-data') === 'map()'));
  await page.evaluate(async files => {
    const el = [...document.querySelectorAll('[x-data]')].find(el => el.getAttribute('x-data') === 'map()');
    const state = window.Alpine.$data(el);
    const get = window.GH.prototype.get;
    window.GH.prototype.get = async function (name, ...args) {
      if (Object.hasOwn(files, name)) return { text: files[name] };
      return get.call(this, name, ...args);
    };
    try {
      while (state.ctxLoading) await new Promise(resolve => setTimeout(resolve, 20));
      state.ctxReg = null;
      await state.loadContextReg();
    } finally { window.GH.prototype.get = get; }
  }, files);
  assert.equal(await page.getByRole('combobox', { name: 'Delivery classification' }).count(), 0);
  const matrix = page.locator('[data-context-matrix]');
  assert.equal(await matrix.locator('thead th').count(), 4);
  assert.equal(await matrix.locator('tbody').count(), 5);
  const source = page.locator('[data-context-source="plugin-default"]');
  await source.click();
  const inspector = page.locator('[data-context-inspector]');
  assert.match(await inspector.innerText(), /The conventions \(default skill\)/);
  assert.match(await inspector.innerText(), /Session record/);
  assert.doesNotMatch(await inspector.innerText(), /tokens|Footprint/);
  const connections = inspector.locator('[data-context-connections]');
  await connections.getByRole('button', { name: 'Conventions directive', exact: true }).click();
  await connections.getByRole('button', { name: 'The portable plugin', exact: true }).click();
  await connections.getByRole('button', { name: 'Environment setup script', exact: true }).click();
  assert.equal(await inspector.locator('h3').innerText(), 'Environment setup script');
  await source.click();
  await inspector.getByRole('button', { name: /How the conventions arrive/ }).click();
  await page.getByRole('button', { name: 'View How the conventions arrive in Delivery', exact: true }).click();
  const result = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[x-data]')].find(el => el.getAttribute('x-data') === 'map()');
    const s = window.Alpine.$data(el);
    return { lens: s.ctxLens, selected: s.ctxSpectraActive.id, topic: s.ctxTopic,
      classes: s.ctxDeliveryGroups.map(d => d.id),
      rows: [...document.querySelectorAll('[data-context-group]')].map(body => ({
        span: body.rows[0].cells[0].colSpan, columns: body.rows[1].cells.length,
        left: body.rows[1].cells[0].getBoundingClientRect().left,
        headerLeft: body.closest('table').tHead.rows[0].cells[0].getBoundingClientRect().left
      })),
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  assert.equal(result.lens, 'delivery');
  assert.equal(result.selected, 'plugin-default');
  assert.equal(result.topic, 'conventions-delivery');
  assert.ok(!result.classes.includes('unclassified'), 'all public rows declare their classification');
  assert.ok(result.rows.every(r => r.span === 4 && r.columns === 4 && Math.abs(r.left - r.headerLeft) < 1), 'row groups share the four scope columns');
  assert.ok(result.scrollWidth <= result.width + 1, JSON.stringify(result));
  await page.evaluate(() => {
    document.querySelector('[data-context-matrix]').scrollLeft = 0;
    for (const el of document.querySelectorAll('*')) if (el.scrollTop) el.scrollTop = 0;
    window.scrollTo(0, 0);
  });
  console.log('Context browser checks:', JSON.stringify(result));
}
