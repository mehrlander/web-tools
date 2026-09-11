// screenshot.mjs interaction scenario: preview each real DOM-rendered PNG in
// the house swipe-deck, explicitly download it there, and leave the selected
// region's preview open for the visual artifact.
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

  await page.evaluate(async () => {
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('fab'));
    await window.Alpine.$data(host).previewDomShot('viewport');
  });
  await page.locator('.sd-overlay').waitFor({ state: 'visible' });
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
  const downloadReady = page.waitForEvent('download', { timeout: 30000 });
  await page.getByRole('button', { name: 'Download PNG' }).click();
  const download = await downloadReady;
  await download.saveAs(path.join(repoRoot, 'tools', '.preview', 'fab-dom-shot-output.png'));
  if (!/DOM render/.test(state.msg)) throw new Error('FAB did not name the DOM render: ' + state.msg);
  await page.locator('.sd-overlay button[aria-label="Close"]').click();
  await page.locator('.sd-overlay').waitFor({ state: 'detached' });

  await page.evaluate(async () => {
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('fab'));
    await window.Alpine.$data(host).previewDomShot('page');
  });
  await page.locator('.sd-overlay').waitFor({ state: 'visible' });
  const pageReady = page.waitForEvent('download', { timeout: 30000 });
  await page.getByRole('button', { name: 'Download PNG' }).click();
  const pageDownload = await pageReady;
  await pageDownload.saveAs(path.join(repoRoot, 'tools', '.preview', 'fab-dom-shot-page-output.png'));
  await page.waitForFunction(() => {
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('fab'));
    return /-page-/.test(window.Alpine?.$data(host)?.outMsg || '');
  });
  await page.locator('.sd-overlay button[aria-label="Close"]').click();
  await page.locator('.sd-overlay').waitFor({ state: 'detached' });

  await page.evaluate(async () => {
    const host = [...document.querySelectorAll('[x-data]')]
      .find(el => (el.getAttribute('x-data') || '').includes('fab'));
    await window.Alpine.$data(host).openShotPicker();
    window.Peek.select(document.querySelector('h1'));
  });
  await page.locator('[data-peek-act="take"]').click();
  await page.locator('.sd-overlay').waitFor({ state: 'visible' });
  const regionReady = page.waitForEvent('download', { timeout: 30000 });
  await page.getByRole('button', { name: 'Download PNG' }).click();
  const regionDownload = await regionReady;
  await regionDownload.saveAs(path.join(repoRoot, 'tools', '.preview', 'fab-dom-shot-region-output.png'));
  await page.waitForTimeout(200);
}
