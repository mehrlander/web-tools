// Context: visible questions and source grouping share one table and inspector.
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
      state.openCtxDeliveryTopic('conventions-delivery');
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
  await page.locator('[data-context-path-source="plugin-writing"]').click();
  let inspector = page.locator('[data-context-inspector]');
  assert.equal(await inspector.locator('h3').innerText(), 'Qualified writing rules');
  assert.match(await inspector.innerText(), /No joined tally/);

  await page.getByRole('radio', { name: 'Source', exact: true }).check();
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
  await page.getByRole('radio', { name: 'Question', exact: true }).check();
  const chooseQuestion = async key => {
    await page.locator('[data-context-question="' + key + '"]').click();
    await page.waitForFunction(() => document.activeElement?.hasAttribute('data-context-question-heading'));
  };
  await chooseQuestion('askuserquestion');
  assert.equal(await page.locator('[data-context-path]').count(), 0, 'topic association has no arrows');
  assert.ok(await page.locator('[data-context-source-row]').count() >= 2);
  assert.equal(await page.locator('[data-context-inspector]').count(), 0, 'a question does not open an arbitrary source');
  await chooseQuestion('pr-lifecycle');
  assert.match(await page.locator('[data-context-paths]').innerText(), /create_pull_request/);
  await chooseQuestion('conventions-delivery');
  await page.locator('[data-context-path-source="plugin-writing"]').click();
  await page.waitForFunction(() => document.activeElement?.hasAttribute('data-context-source-heading'));
  await page.getByRole('radio', { name: 'Source', exact: true }).check();
  assert.equal(await page.locator('[data-context-inspector] h3').innerText(), 'Qualified writing rules');

  // Synthetic observations exercise the measurement UI, then are removed before the shot.
  await page.evaluate(() => {
    const s = window.Alpine.$data(document.querySelector('[data-context-workspace]'));
    s.docStartup = { 'web-tools/CLAUDE.md': { path: 'web-tools/CLAUDE.md', sessions: 12, reconstructed: 12, last: '2026-10-01' },
      'fixture/CLAUDE.md': { path: 'fixture/CLAUDE.md', sessions: 3, reconstructed: 3, last: '2026-10-01' } };
    s.skillUses = { default: { path: 'default', sessions: 7, last: '2026-10-01' },
      'fixture-skill': { path: 'fixture-skill', sessions: 2, last: '2026-10-01' } };
  });
  await page.getByRole('combobox', { name: 'Sort context sources' }).selectOption('usage');
  assert.equal(await page.locator('[data-context-source-row]').first().getAttribute('data-context-source-row'), 'wt-claude');
  assert.match(await page.locator('[data-context-source-row="wt-claude"]').innerText(), /12 sessions[\s\S]*At session start/);
  assert.match(await page.locator('[data-context-source-row="plugin-default"]').innerText(), /7 sessions[\s\S]*Skill invoked/);
  assert.match(await page.locator('[data-context-source-row="plugin-writing"]').innerText(), /Not measured/);
  assert.equal(await page.locator('[data-context-inspector] h3').innerText(), 'Qualified writing rules', 'sorting preserves selection');
  await page.locator('[data-context-session-records] > summary').click();
  assert.match(await page.locator('[data-context-session-records]').innerText(), /fixture\/CLAUDE.md/);
  assert.match(await page.locator('[data-context-session-records]').innerText(), /fixture-skill/);
  await page.locator('[data-context-session-records] > summary').click();
  await page.evaluate(() => {
    const s = window.Alpine.$data(document.querySelector('[data-context-workspace]'));
    s.docStartup = null; s.skillUses = null;
    s.ctxSpectraSelected = ''; s.setCtxSort('name');
  });
  await page.getByRole('radio', { name: 'Question', exact: true }).check();
  await chooseQuestion('conventions-delivery');
  await page.getByRole('button', { name: 'All questions ↑', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.hasAttribute('data-context-question-index'));

  const sources = page.locator('[data-map-sources-button]:visible');
  const panel = page.locator('[data-map-sources-panel]');
  await sources.scrollIntoViewIfNeeded();
  // All questions uses smooth scrolling. A source panel deliberately closes
  // when its anchor scrolls away, so finish that navigation before opening it.
  await page.evaluate(() => new Promise(resolve => {
    let timer;
    const done = () => { document.removeEventListener('scroll', moved, true); resolve(); };
    const moved = () => { clearTimeout(timer); timer = setTimeout(done, 150); };
    document.addEventListener('scroll', moved, true);
    moved();
  }));
  await sources.click();
  await panel.waitFor({ state: 'visible' });
  assert.match(await panel.innerText(), /docs\/context-sources\.csv/);
  assert.match(await panel.innerText(), /skills\/hooks\/hooks\.json/);
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });
  assert.ok(await sources.evaluate(e => e === document.activeElement), 'Escape restores the source control');
  await sources.click();
  await panel.getByRole('button', { name: 'Close sources', exact: true }).click();
  await panel.waitFor({ state: 'hidden' });
  await sources.click();
  await page.getByRole('tab', { name: /Tests/ }).click();
  await panel.waitFor({ state: 'hidden' });
  await page.getByRole('tab', { name: /Context/ }).click();

  const result = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[x-data]')].find(el => el.getAttribute('x-data') === 'map()');
    const s = window.Alpine.$data(el);
    for (const box of document.querySelectorAll('*')) if (box.scrollTop) box.scrollTop = 0;
    window.scrollTo(0, 0);
    return { lens: s.ctxLens, selected: s.ctxSpectraActive?.id || '', topic: s.ctxTopic,
      sources: s.ctxAll.length, questionSources: s.ctxGroupedSources.length, paths: s.ctxQuestionPaths.length,
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  assert.equal(result.lens, 'delivery');
  assert.equal(result.selected, '');
  assert.equal(result.topic, 'conventions-delivery');
  assert.ok(result.scrollWidth <= result.width + 1, JSON.stringify(result));
  console.log('Context browser checks:', JSON.stringify(result));
}
