import assert from 'node:assert/strict';

export default async function (page) {
  page.setDefaultTimeout(20000);
  const step = label => console.log('peeves check:', label);
  const section = page.locator('section[x-show="mapTab===\'peeves\'"]');
  const root = section.locator('[data-peeve-root]');
  const list = section.locator('[data-peeve-list]');
  const card = section.locator('[data-peeve-card]');
  const state = fn => page.evaluate(fn);
  const selected = () => list.locator('[aria-selected="true"]').getAttribute('data-row');
  const waitSelection = id => page.waitForFunction(id => document.querySelector('[data-peeve-list] [aria-selected="true"]')?.dataset.row === id, id);
  await page.waitForFunction(() => document.querySelector('[data-peeve-card] .sd-track'));
  step('mounted');
  assert.equal(await section.locator('[role="tablist"], [aria-expanded]').count(), 0);
  const count = await list.locator('[role="option"]').count();
  assert.equal(count, 33);
  assert.equal(await list.getByRole('group', { name: 'Core', exact: true }).locator('[role="option"]').count(), 24);
  assert.equal(await list.getByRole('group', { name: 'Secondary', exact: true }).locator('[role="option"]').count(), 9);
  const geometry = async () => root.evaluate(el => {
    const list = el.querySelector('[data-peeve-list]'), card = el.querySelector('[data-peeve-card]');
    return { height: el.clientHeight, list: list.clientHeight, detail: card.clientHeight,
      stacked: el.hasAttribute('data-ls-stacked'), row: list.querySelector('[role="option"]').getBoundingClientRect().height,
      width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth };
  });
  const phone = await geometry();
  assert.ok(phone.stacked && phone.list <= 178 && phone.detail > phone.list, JSON.stringify(phone));
  assert.ok(phone.row <= 34 && phone.scroll <= phone.width + 1, JSON.stringify(phone));

  await list.locator('[data-row="P44"] [data-part="title"]').click();
  await waitSelection('P44');
  assert.match(await card.locator('[data-ls="head"]').innerText(), /Wasted space/);
  await list.locator('[data-row="P44"] [data-part="title"]').click();
  assert.equal(await selected(), 'P44');
  assert.equal((await geometry()).list, phone.list, 'selection leaves the list height unchanged');
  assert.ok(await card.locator('[data-peeve-detail="P44"] a[data-peeve-ref]').count());
  step('selection and reference');

  const ids = await list.locator('[data-row]').evaluateAll(rows => rows.map(r => r.dataset.row));
  await page.keyboard.press('ArrowDown');
  await waitSelection(ids[ids.indexOf('P44') + 1]);
  const next = ids.indexOf('P44') + 2;
  await card.locator('.sd-track').evaluate((el, next) => el.scrollTo({ left: el.clientWidth * next, behavior: 'instant' }), next);
  await waitSelection(ids[next]);
  step('keyboard and swipe');

  await page.getByRole('button', { name: 'Filter: Peeves by name or text', exact: true }).click();
  const search = page.locator('#find-pill-box');
  await search.fill('accordions');
  await waitSelection('P52');
  step('search selected P52');
  assert.equal(await list.locator('[role="option"]').count(), 1);
  assert.match(await card.innerText(), /Accordions and nesting/);
  await search.fill('no such peeve');
  await root.waitFor({ state: 'hidden' });
  assert.ok(await section.getByText('No peeve matches.', { exact: true }).isVisible());
  await search.fill('');
  await search.press('Enter');
  await root.waitFor({ state: 'visible' });
  assert.equal(await list.locator('[role="option"]').count(), count);
  await waitSelection('P52');
  step('search cleared');
  await state(() => {
    const d = window.Alpine.$data(document.querySelector('[x-data="map()"]'));
    d.peeveQuotes = { P52: [{ quote: 'Quoted correction for this test.', session: '2026-10-27-deadbeef', short: 'deadbeef' }] };
  });
  await page.waitForFunction(() => document.querySelector('[data-peeve-card]').textContent.includes('Quoted correction for this test.')).catch(async error => {
    const detail = await state(() => {
      const d = window.Alpine.$data(document.querySelector('[x-data="map()"]'));
      const root = document.querySelector('[data-peeve-root]');
      return { selected: d.peeveSel, quotes: d.peeveQuotes, tab: d.mapTab, width: root.clientWidth,
        body: root.querySelector('[data-peeve-card]').textContent.slice(0, 250),
        track: root.querySelector('.sd-track')?.scrollLeft };
    });
    throw new Error(error.message + ' ' + JSON.stringify(detail));
  });
  assert.equal(await selected(), 'P52', 'late source quotes preserve the selection');
  step('quotes updated');
  await state(() => { window.Alpine.$data(document.querySelector('[x-data="map()"]')).peeveQuotes = null; });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForFunction(() => !document.querySelector('[data-peeve-root]').hasAttribute('data-ls-stacked'));
  const wide = await geometry();
  step('wide layout');
  assert.ok(wide.scroll <= wide.width + 1 && wide.detail > 300, JSON.stringify(wide));
  await card.locator('[data-swipe-cards]').click();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('[data-peeve-list] [aria-selected="true"]')?.dataset.row === 'P52');
  await page.screenshot({ path: 'node/.preview/peeves-desktop.png' });
  step('deck closed');

  await page.setViewportSize({ width: 390, height: 620 });
  await state(() => { window.__shell.sidebarOpen = false; });
  await page.waitForFunction(() => document.querySelector('[data-peeve-root]').hasAttribute('data-ls-stacked'));
  const short = await geometry();
  step('short phone layout');
  assert.ok(short.list <= 163 && short.detail > short.list, JSON.stringify(short));
  await page.setViewportSize({ width: 390, height: 760 });
  await state(() => window.__shell.goMap('policy'));
  step('opened Policy');
  await page.waitForFunction(() => document.querySelector('[data-policy-card] .sd-track'));
  const policy = await page.locator('[data-policy-root]').evaluate(el => ({
    list: el.querySelector('[data-policy-list]').clientHeight, detail: el.querySelector('[data-policy-card]').clientHeight,
    row: el.querySelector('[role="option"]').getBoundingClientRect().height,
  }));
  assert.ok(policy.list <= 178 && policy.detail > policy.list && policy.row <= 34, JSON.stringify(policy));
  await page.screenshot({ path: 'node/.preview/policy-phone.png' });
  // Recreate the prior Policy spacing for a comparison on the same running view.
  await page.locator('[data-policy-list]').evaluate(el => {
    el.style.maxHeight = '38vh';
    for (const row of el.querySelectorAll('[role="option"]')) row.style.paddingBlock = '8px';
  });
  await page.screenshot({ path: 'node/.preview/policy-before.png' });
  await page.locator('[data-policy-list]').evaluate(el => {
    el.style.maxHeight = '';
    for (const row of el.querySelectorAll('[role="option"]')) row.style.paddingBlock = '';
  });
  await state(() => window.__shell.goMap('peeves'));
  await root.waitFor({ state: 'visible' });
  await list.locator('[data-row="P44"] [data-part="title"]').click();
  await waitSelection('P44');
  console.log('peeves layout:', JSON.stringify({ phone, short, wide, policy }));
}
