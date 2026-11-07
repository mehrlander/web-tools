// Drop a workbook onto the Stage and take it to the transform workbench, the
// door added 2026-10-23. The reader opens on the Sheet view, which shows the
// workbook as Excel draws it; its header carries the workbench button, and the
// workbench takes each sheet as its own batch of typed rows.
//
// Taps the button in the reader's header rather than calling openTransform,
// since the button being there is half of what this checks.
//
//   npm run shot -- app/index.html --query "view=stage" \
//     --script node/render/scenarios/stage-workbook-bench.mjs --wait 4000
//
// XLSX_FIXTURE names another workbook; the committed sample is the default.

import { readFileSync } from 'node:fs';

export default async function (page) {
  const file = process.env.XLSX_FIXTURE || 'docs/examples/allotment-ledger.xlsx';
  const bytes = [...readFileSync(file)];
  await page.waitForSelector('[x-data*="stager"]', { timeout: 15000 });

  const staged = await page.evaluate(async ({ bytes, name }) => {
    const data = Alpine.$data(document.querySelector('[x-data*="stager"]'));
    Alpine.store('browser').stage = [];
    const u8 = Uint8Array.from(bytes);
    data.onDropped({ file: {}, name, size: u8.length, type: '', bytes: u8, buf: u8.buffer });
    return data.transformables.map(t => ({ name: t.item.name, kind: t.kind, label: t.label }));
  }, { bytes, name: file.split('/').pop() });

  // Open the reader the way a tap on the row does, then find its header button.
  await page.evaluate(() => {
    const data = Alpine.$data(document.querySelector('[x-data*="stager"]'));
    data.view(data.localItems[0]);
  });
  const sel = '[aria-label^="Open in the transform workbench"], [data-title-tip^="Open in the transform workbench"]';
  // The header is rebuilt once the slide's viewer mounts and contributes its
  // modes, so the first button found can be detached by the time it is
  // clicked: let the sheet draw, then click through a fresh lookup.
  await page.waitForSelector('[data-c="A1"]', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(600);
  // Every toast the open raises, success or failure, since a failed open
  // closes its deck and says why only there.
  await page.evaluate(() => {
    const real = Alpine.store('toast');
    window.__toasts = [];
    Alpine.store('toast', (...a) => { window.__toasts.push(a.slice(0, 2).join(': ')); return real?.(...a); });
  });
  const button = await page.locator(sel).first().click({ timeout: 10000 }).then(() => true, () => false);
  await page.waitForFunction(() => document.querySelector('.tf-root')?.__workbench?.ran, { timeout: 20000 })
    .catch(() => {});
  await page.waitForTimeout(800);

  const opened = await page.evaluate(() => {
    const wb = document.querySelector('.tf-root')?.__workbench;
    return {
      mounted: !!wb,
      batches: wb?.datasets?.map(d => [d.name, d.rows.length]) ?? null,
      combine: wb?.combine ?? null,
      scope: wb?.scope ?? null,
      cols: wb?.raw?.[0] ? Object.keys(wb.raw[0]) : null,
      second: wb?.raw?.[1] ?? null,
      tableRows: document.querySelectorAll('#tf-tab-target > :not(.hidden) .tabulator-row').length,
      toasts: window.__toasts,
      deck: !!Alpine.$data(document.querySelector('[x-data*="stager"]'))._tfDeck,
    };
  });

  // The picture shows the largest sheet, which is the one with a table in it;
  // the first is often a cover sheet of labels.
  await page.evaluate(async () => {
    const wb = document.querySelector('.tf-root')?.__workbench;
    const big = [...(wb?.datasets || [])].sort((a, b) => b.rows.length - a.rows.length)[0];
    if (big) await wb.setScope(big.name);
  });
  await page.waitForTimeout(800);

  // HOVER=<batch name> rests the pointer on that chip until its peek opens,
  // so the picture shows the hover card over the data-inputs row.
  let peek = null;
  if (process.env.HOVER) {
    await page.locator('.tf-root .join button', { hasText: process.env.HOVER }).first().hover();
    await page.waitForTimeout(1500);
    peek = await page.evaluate(() => {
      const card = document.querySelector('[role="tooltip"]:not([hidden])');
      return card ? card.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : null;
    });
  }

  console.log('\n--- a workbook to the workbench ---');
  console.log('  recognized: ' + JSON.stringify(staged));
  console.log('  button:     ' + (button ? 'found in the reader header, tapped' : 'NOT FOUND'));
  console.log('  opened:     ' + JSON.stringify(opened));
  if (process.env.HOVER) console.log('  peek:       ' + JSON.stringify(peek));
  console.log('');
}
