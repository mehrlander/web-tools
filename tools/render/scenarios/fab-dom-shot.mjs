// screenshot.mjs interaction scenario: take a real DOM-rendered viewport PNG
// from the FAB and leave the drawer showing the renderer's result line.
//
//   node tools/render/screenshot.mjs pages/demos/sheet-modal-demo.html \
//     --script tools/render/scenarios/fab-dom-shot.mjs \
//     --out tools/.preview/fab-dom-shot-controls.png

import path from 'node:path';

export default async function (page, { repoRoot }) {
  const ok = await page.evaluate(() => {
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('fab'));
    if (!host || !window.Alpine) return false;
    const d = window.Alpine.$data(host);
    d.open = true;
    return true;
  });
  if (!ok) throw new Error('FAB host / Alpine not found');
  await page.waitForTimeout(700);
  // Opening runs detect(), which owns and may replace the inferred identity.
  // Seed the Pages-shaped identity after that pass has settled.
  await page.evaluate(() => {
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('fab'));
    const d = window.Alpine.$data(host);
    d.repo = 'mehrlander/web-tools';
    d.path = location.pathname.replace(/^\/+/, '');
    d.activeTab = 'render';
  });
  await page.waitForTimeout(300);

  const view = page.locator('button[title^="The visible part of this page as a PNG"]');
  if (await view.count() !== 1) {
    const diag = await page.evaluate(() => {
      const host = [...document.querySelectorAll('[x-data]')]
        .find(el => (el.getAttribute('x-data') || '').includes('fab'));
      const d = host && window.Alpine?.$data(host);
      return {
        open: d?.open, path: d?.path, tab: d?.activeTab,
        groups: (d?.takeGrid || []).map(g => [g.kind, g.items.map(i => i.label)]),
        renderedGroups: [...document.querySelectorAll('span[x-text="g.kind"]')].map(n => n.textContent),
      };
    });
    throw new Error('FAB Image / View control not found exactly once: ' + JSON.stringify(diag));
  }
  const downloadReady = page.waitForEvent('download', { timeout: 30000 }).catch(error => ({ error }));
  await view.click();
  await page.waitForFunction(() => {
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('fab'));
    const d = host && window.Alpine?.$data(host);
    return !!(d?.outMsg || d?.outError);
  });
  const state = await page.evaluate(() => {
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('fab'));
    const d = host && window.Alpine?.$data(host);
    return { msg: d?.outMsg || '', error: d?.outError || '' };
  });
  if (state.error) throw new Error('FAB DOM shot failed: ' + state.error);
  const download = await downloadReady;
  if (download.error) throw download.error;
  await download.saveAs(path.join(repoRoot, 'tools', '.preview', 'fab-dom-shot-output.png'));
  if (!/DOM render/.test(state.msg)) throw new Error('FAB did not name the DOM render: ' + state.msg);

  const pageTake = page.locator('button[title^="The full scrolling page as a PNG"]');
  const pageReady = page.waitForEvent('download', { timeout: 30000 });
  await pageTake.click();
  const pageDownload = await pageReady;
  await pageDownload.saveAs(path.join(repoRoot, 'tools', '.preview', 'fab-dom-shot-page-output.png'));
  await page.waitForFunction(() => {
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('fab'));
    return /-page-/.test(window.Alpine?.$data(host)?.outMsg || '');
  });

  await page.evaluate(async () => {
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('fab'));
    await window.Alpine.$data(host).openShotPicker();
    window.Peek.select(document.querySelector('h1'));
  });
  const regionReady = page.waitForEvent('download', { timeout: 30000 });
  await page.locator('[data-peek-act="take"]').click();
  const regionDownload = await regionReady;
  await regionDownload.saveAs(path.join(repoRoot, 'tools', '.preview', 'fab-dom-shot-region-output.png'));
  await page.evaluate(() => {
    window.Peek.disable();
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('fab'));
    const d = window.Alpine.$data(host);
    d.open = true;
    d.activeTab = 'render';
  });
  await page.waitForTimeout(200);
}
