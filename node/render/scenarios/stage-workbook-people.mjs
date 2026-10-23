// Drop a workbook onto the Stage, read it in the Structure mode, and open the
// tab that says where it names people (TAB=people, the default) or the
// Extract tab whose roster says which of those names the pick would carry
// (TAB=extract, with PICK naming the sheets to tick). Added 2026-10-23 with
// kits/xlsx-people.js.
//
//   XLSX_FIXTURE=<a workbook with names in it> npm run shot -- app/index.html \
//     --query "view=stage" --script node/render/scenarios/stage-workbook-people.mjs --wait 3000
//
// The first-name list is a jsDelivr fetch the renderer serves from
// node_modules, so a run without @stdlib/datasets-{female,male}-first-names-en
// installed shows the check's own fallback (headings, labels, addresses).

import { readFileSync } from 'node:fs';

export default async function (page) {
  const file = process.env.XLSX_FIXTURE || 'docs/examples/allotment-ledger.xlsx';
  const tab = process.env.TAB || 'people';
  const bytes = [...readFileSync(file)];
  await page.waitForSelector('[x-data*="stager"]', { timeout: 15000 });

  await page.evaluate(async ({ bytes, name }) => {
    const data = Alpine.$data(document.querySelector('[x-data*="stager"]'));
    Alpine.store('browser').stage = [];
    const u8 = Uint8Array.from(bytes);
    data.onDropped({ file: {}, name, size: u8.length, type: '', bytes: u8, buf: u8.buffer });
    data.view(data.localItems[0]);
  }, { bytes, name: file.split('/').pop() });

  // The sheet draws first; then the reading is switched the way the header's
  // reading menu does it.
  await page.waitForSelector('[data-c="A1"]', { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => document.querySelector('[data-reader-slide="0"]')?.__viewer?.switchMode('xlsx-structure'));
  await page.waitForSelector('[data-xs="tabs"] button', { timeout: 20000 });
  const label = tab === 'extract' ? 'Extract' : 'People';
  await page.locator('[data-xs="tabs"] button', { hasText: label }).first().click();
  await page.waitForTimeout(1200);
  // On the Extract tab, tick the sheets PICK names (comma-separated) the way
  // a reader does, by their rows, so the roster's names line has a pick to
  // read. Staff and Totals by default: one sheet with names and one without.
  if (tab === 'extract') {
    for (const name of (process.env.PICK || 'Staff,Totals').split(',').filter(Boolean)) {
      await page.locator(`[data-ex-sheetrow="${name}"]`).first().click().catch(() => {});
      await page.waitForTimeout(300);
    }
    // Back to the roster, which is what the picture is of; a tap on a sheet
    // row scrolls the pane to it.
    await page.evaluate(() => { const st = document.querySelector('[data-xs="stage"]'); if (st) st.scrollTop = 0; });
    await page.waitForTimeout(800);
  }

  const seen = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll('[data-xs="tabs"] button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()),
    rows: [...document.querySelectorAll('[data-xs="stage"] tbody tr')].map(tr =>
      [...tr.querySelectorAll('td')].map(td => td.textContent.trim()).join(' | ')),
    roster: [...document.querySelectorAll('[data-xs="ex-roster"] > div')].map(d => d.textContent.replace(/\s+/g, ' ').trim()),
  }));

  console.log('\n--- where the workbook names people ---');
  console.log('  tabs:   ' + JSON.stringify(seen.tabs));
  for (const r of seen.rows.slice(0, 12)) console.log('  row:    ' + r);
  for (const r of seen.roster) console.log('  roster: ' + r);
  console.log('');
}
