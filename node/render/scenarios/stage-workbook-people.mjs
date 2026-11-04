// Drop a workbook onto the Stage, read it in the Structure mode, and open the
// Details pill that says where it names people (TAB=people, the default) or
// the Overview whose roster says which of those names the pick would carry
// (TAB=extract, with PICK naming the sheets to tick). Added 2026-10-23 with
// kits/xlsx-people.js; the Overview and Details replaced the ten tabs the
// same day.
//
//   XLSX_FIXTURE=<a workbook with names in it> npm run shot -- app/index.html \
//     --query "view=stage" --script node/render/scenarios/stage-workbook-people.mjs --wait 3000
//
// The name lists are jsDelivr fetches the renderer serves from node_modules,
// so a run without @stdlib/datasets-{female,male}-first-names-en@0.2.3,
// @zxcvbn-ts/language-en@4.1.1 and wordlist-english@1.2.1 installed shows the
// check's own fallback (addresses, comment authors, file properties).

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
  await page.waitForSelector('[data-seg]', { timeout: 20000 });
  if (tab !== 'extract') {
    await page.locator('[data-seg="details"]').click();
    await page.locator('[data-dt="people"]').click();
  }
  await page.waitForTimeout(1200);
  // On the Overview, tick the sheets PICK names (comma-separated) the way a
  // reader does, by their boxes, so the roster's names line has a pick to
  // read. Staff and Totals by default: one sheet with names and one without.
  if (tab === 'extract') {
    for (const name of (process.env.PICK || 'Staff,Totals').split(',').filter(Boolean)) {
      await page.locator(`[data-ex-sheetrow="${name}"]`).first().click().catch(() => {});
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(800);
  }

  const seen = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll('[data-dt]')].map(b => b.textContent.replace(/\s+/g, ' ').trim()),
    // A Details grid's rows, or the Overview list's.
    rows: [...document.querySelectorAll('[data-xs="stage"] .tabulator-row, [data-xs="ov-list"] tr')].map(tr =>
      [...tr.querySelectorAll('.tabulator-cell, td')].map(td => td.textContent.trim()).filter(Boolean).join(' | ')),
    roster: [...document.querySelectorAll('[data-xs="ex-roster"] > div')].map(d => d.textContent.replace(/\s+/g, ' ').trim()),
  }));

  console.log('\n--- where the workbook names people ---');
  console.log('  tabs:   ' + JSON.stringify(seen.tabs));
  for (const r of seen.rows.slice(0, 12)) console.log('  row:    ' + r);
  for (const r of seen.roster) console.log('  roster: ' + r);
  console.log('');
}
