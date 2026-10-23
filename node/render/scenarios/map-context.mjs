// Context: a question filters one source table, and a source opens in its panel-tip.
// The working-tree fixtures pair registry edits with the current code before a commit.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

export default async function (page) {
  const files = Object.fromEntries(['docs/context-sources.csv', 'docs/context-topics.csv',
    'docs/context-links.csv', 'skills/hooks/hooks.json', 'docs/map-tabs.csv'].map(p =>
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
      await state.loadTabLedes();
      state.openCtxDeliveryTopic('conventions-delivery', true);
    } finally { window.GH.prototype.get = get; }
  }, files);
  assert.equal(await page.locator('[data-context-matrix]').count(), 0);
  const workspace = page.locator('[data-context-workspace]');
  assert.equal(await workspace.locator('[data-slot="frame:subtabs"], [role="tablist"]').count(), 0);
  assert.equal(await page.getByRole('combobox', { name: 'Context question', exact: true }).count(), 0);
  assert.equal(await page.locator('[data-context-question]').count(), 12);
  for (const question of await page.locator('[data-context-question]').all()) assert.ok(await question.isVisible());
  assert.equal(await page.locator('[data-context-path]').count(), 2);
  assert.match(await page.locator('[data-context-paths]').innerText(), /asks to read/);
  const panel = page.locator('[data-context-tip-panel]');
  const heading = () => panel.locator('[data-context-source-heading]').innerText();
  await page.locator('[data-context-path-source="plugin-writing"]').click();
  await panel.waitFor({ state: 'visible' });
  assert.equal(await heading(), 'Qualified writing rules');
  // Each scale lights the source's own value among its alternatives.
  const lit = key => panel.locator('[data-context-scale="' + key + '"] [aria-current="true"]').allInnerTexts();
  assert.deepEqual(await lit('circle'), ['Portable plugin']);
  assert.ok((await panel.locator('[data-context-scale="circle"] .rounded').count()) >= 6, 'the whole circle scale is drawn');
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });

  await page.locator('[data-context-show-all]').click();
  const table = page.locator('[data-context-table]');
  const count = await page.locator('[data-context-source-row]').count();
  assert.equal(count, await page.evaluate(() => window.Alpine.$data(document.querySelector('[data-context-workspace]')).ctxAll.length),
    'with no question picked the table holds every source');
  assert.equal(await page.locator('[data-context-question-detail]').count(), 0, 'with no question there is no question detail');
  await table.locator('[data-context-source="env-setup"]').click();
  await panel.waitFor({ state: 'visible' });
  assert.equal(await heading(), 'Environment setup script');
  assert.equal(await page.locator('[data-context-source-row]').count(), count, 'a panel never filters the table');
  await table.locator('[data-context-source="env-setup"]').click();
  await panel.waitFor({ state: 'hidden' });
  await table.locator('[data-context-source="env-setup"]').click();
  await panel.waitFor({ state: 'visible' });
  await panel.locator('[data-context-connections]').getByRole('button', { name: 'The portable plugin', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-context-tip-panel] [data-context-source-heading]')?.textContent === 'The portable plugin');
  // Hover opens an unpinned panel on a fine pointer, and leaving closes it.
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });
  await table.locator('[data-context-source="hook-refresh"]').hover();
  await panel.waitFor({ state: 'visible' });
  assert.equal(await heading(), 'Plugin refresher');
  await page.mouse.move(2, 2);
  await panel.waitFor({ state: 'hidden' });

  const tableSize = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(tableSize.scroll <= tableSize.width + 1, JSON.stringify(tableSize));
  const chooseQuestion = async key => {
    await page.locator('[data-context-question="' + key + '"]').click();
    await page.waitForFunction(() => document.activeElement?.hasAttribute('data-context-question-heading'));
  };
  await chooseQuestion('askuserquestion');
  assert.equal(await page.locator('[data-context-path]').count(), 0, 'topic association has no arrows');
  assert.ok(await page.locator('[data-context-source-row]').count() >= 2);
  assert.ok(await panel.isHidden(), 'a question does not open an arbitrary source');
  await chooseQuestion('pr-lifecycle');
  assert.match(await page.locator('[data-context-paths]').innerText(), /create_pull_request/);
  await chooseQuestion('conventions-delivery');
  await page.locator('[data-context-question="conventions-delivery"]').click();
  assert.equal(await page.locator('[data-context-source-row]').count(), count, 'picking the picked question again shows every source');

  // Synthetic observations exercise the measurement UI, then are removed before the shot.
  await page.evaluate(() => {
    const s = window.Alpine.$data(document.querySelector('[data-context-workspace]'));
    s.docStartup = { 'web-tools/CLAUDE.md': { path: 'web-tools/CLAUDE.md', sessions: 12, reconstructed: 12, last: '2026-10-01' },
      'fixture/CLAUDE.md': { path: 'fixture/CLAUDE.md', sessions: 3, reconstructed: 3, last: '2026-10-01' } };
    s.skillUses = { default: { path: 'default', sessions: 7, last: '2026-10-01' },
      'fixture-skill': { path: 'fixture-skill', sessions: 2, last: '2026-10-01' } };
    s.docReadsSessions = 40;
  });
  await page.getByRole('combobox', { name: 'Sort context sources' }).selectOption('usage');
  assert.equal(await page.locator('[data-context-source-row]').first().getAttribute('data-context-source-row'), 'wt-claude');
  assert.match(await page.locator('[data-context-source-row="wt-claude"]').innerText(), /12 sessions[\s\S]*At session start/);
  assert.match(await page.locator('[data-context-source-row="plugin-default"]').innerText(), /7 sessions[\s\S]*Skill invoked/);
  assert.match(await page.locator('[data-context-source-row="plugin-writing"]').innerText(), /Not measured/);
  await table.locator('[data-context-source="wt-claude"]').click();
  await panel.waitFor({ state: 'visible' });
  assert.match(await panel.locator('[data-context-scale="sessions"]').innerText(), /12 of 40 recorded/);
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });
  assert.match(await page.locator('[data-context-session-records]').innerText(), /fixture\/CLAUDE.md/);
  assert.match(await page.locator('[data-context-session-records]').innerText(), /fixture-skill/);
  await page.evaluate(() => {
    const s = window.Alpine.$data(document.querySelector('[data-context-workspace]'));
    s.docStartup = null; s.skillUses = null; s.docReadsSessions = 0;
    s.ctxSpectraSelected = ''; s.setCtxSort('name');
  });
  await chooseQuestion('conventions-delivery');
  await page.getByRole('button', { name: 'All questions ↑', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.hasAttribute('data-context-question-index'));

  // What the tab reads is in the app drawer's About tab since 2026-10-22: the
  // launcher opens the drawer on it, and it follows the Map tab in view.
  await page.evaluate(() => window.Alpine.$data(document.querySelector('[x-data^="fab"]')).toggle());
  const about = page.locator('[data-fab-about]');
  await about.waitFor({ state: 'visible' });
  assert.match(await about.innerText(), /docs\/context-sources\.csv/);
  assert.match(await about.innerText(), /skills\/hooks\/hooks\.json/);
  await page.evaluate(() => window.Alpine.$data(document.querySelector('[x-data^="fab"]')).close());
  await page.waitForFunction(() => !window.Alpine.$data(document.querySelector('[x-data^="fab"]')).open);
  await page.getByRole('tab', { name: /Context/ }).click();

  const result = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[x-data]')].find(el => el.getAttribute('x-data') === 'map()');
    const s = window.Alpine.$data(el);
    for (const box of document.querySelectorAll('*')) if (box.scrollTop) box.scrollTop = 0;
    window.scrollTo(0, 0);
    return { selected: s.ctxSpectraActive?.id || '', topic: s.ctxTopic,
      sources: s.ctxAll.length, questionSources: s.ctxGroupedSources.length, paths: s.ctxQuestionPaths.length,
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  assert.equal(result.selected, '');
  assert.equal(result.topic, 'conventions-delivery');
  assert.ok(result.scrollWidth <= result.width + 1, JSON.stringify(result));
  console.log('Context browser checks:', JSON.stringify(result));
}
