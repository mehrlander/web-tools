// Context: declared question paths and the complete source table.
// The working-tree fixtures pair registry edits with the current code before a commit.
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
      state.openCtxDeliveryTopic('conventions-delivery');
    } finally { window.GH.prototype.get = get; }
  }, files);
  assert.equal(await page.locator('[data-context-matrix]').count(), 0);
  assert.equal(await page.locator('[data-context-path]').count(), 2);
  assert.match(await page.locator('[data-context-paths]').innerText(), /asks to read/);
  await page.locator('[data-context-path-source="plugin-writing"]').click();
  let inspector = page.locator('[data-context-inspector]');
  assert.equal(await inspector.locator('h3').innerText(), 'Qualified writing rules');
  assert.match(await inspector.innerText(), /No joined tally/);

  await page.getByRole('button', { name: 'Sources', exact: true }).click();
  const table = page.locator('[data-context-table]');
  const count = await page.locator('[data-context-source-row]').count();
  assert.equal(count, 31);
  await table.locator('[data-context-source="env-setup"]').click();
  inspector = page.locator('[data-context-inspector]');
  assert.equal(await inspector.locator('h3').innerText(), 'Environment setup script');
  assert.equal(await inspector.count(), 1, 'one expanded source owns the inspector');
  assert.equal(await page.locator('[data-context-source-row]').count(), count, 'selection never filters the table');
  await table.locator('[data-context-source="env-setup"]').click();
  assert.equal(await page.locator('[data-context-inspector]').count(), 0, 'the table can show only its rows');
  await table.locator('[data-context-source="env-setup"]').click();
  await inspector.locator('summary').click();
  await inspector.locator('[data-context-connections]').getByRole('button', { name: 'The portable plugin', exact: true }).click();
  assert.equal(await page.locator('[data-context-inspector] h3').innerText(), 'The portable plugin');

  const tableSize = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(tableSize.scroll <= tableSize.width + 1, JSON.stringify(tableSize));
  await page.getByRole('button', { name: 'Questions', exact: true }).click();
  const chooseQuestion = async key => {
    const picker = page.getByRole('combobox', { name: 'Context question' });
    if (await picker.isVisible()) await picker.selectOption(key);
    else await page.locator('[data-context-question="' + key + '"]').click();
  };
  await chooseQuestion('askuserquestion');
  assert.equal(await page.locator('[data-context-path]').count(), 0, 'topic association has no arrows');
  assert.ok(await page.locator('[data-context-related-source]').count() >= 2);
  await chooseQuestion('pr-lifecycle');
  assert.match(await page.locator('[data-context-paths]').innerText(), /create_pull_request/);
  await chooseQuestion('conventions-delivery');
  await page.locator('[data-context-path-source="plugin-writing"]').click();
  await page.getByRole('button', { name: 'Compare the sources →', exact: true }).click();
  await page.getByRole('button', { name: 'View How do the conventions arrive? in Questions', exact: true }).click();
  const result = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[x-data]')].find(el => el.getAttribute('x-data') === 'map()');
    const s = window.Alpine.$data(el);
    for (const box of document.querySelectorAll('*')) if (box.scrollTop) box.scrollTop = 0;
    window.scrollTo(0, 0);
    return { lens: s.ctxLens, selected: s.ctxSpectraActive.id, topic: s.ctxTopic,
      sources: s.ctxAll.length, paths: s.ctxQuestionPaths.length,
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  assert.equal(result.lens, 'delivery');
  assert.equal(result.selected, 'plugin-writing');
  assert.equal(result.topic, 'conventions-delivery');
  assert.ok(result.scrollWidth <= result.width + 1, JSON.stringify(result));
  console.log('Context browser checks:', JSON.stringify(result));
}
