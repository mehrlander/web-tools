// tools/render/scenarios/xlsx-picker-load.mjs — drive pages/xlsx-picker.html
// with a real workbook, since the page's whole surface is downstream of one
// being open and a shot of the empty drop target proves nothing.
//
// The workbook is named by XLSX_FIXTURE, so the shot can be taken against any
// file on disk without a binary landing in this repo. It falls back to nothing
// and the scenario says so rather than shooting the empty state silently.
import { readFileSync } from 'node:fs';

export default async function (page) {
  const file = process.env.XLSX_FIXTURE;
  if (!file) throw new Error('set XLSX_FIXTURE=<path to an .xlsx or .xlsm>');
  const bytes = [...readFileSync(file)];
  const name = file.split('/').pop();

  await page.waitForFunction(() => !!window.xlsxWriteKit, { timeout: 30000 });
  // Hand the bytes to the component directly. A DataTransfer drop through
  // Chromium's input layer would exercise the browser's file plumbing rather
  // than this page's, and the component's own open() is what the drop and the
  // file input both call.
  await page.evaluate(async ({ bytes, name }) => {
    const root = document.querySelector('[x-data]');
    const f = new File([new Uint8Array(bytes)], name);
    await window.Alpine.$data(root).open(f);
  }, { bytes, name });
  await page.waitForSelector('input[type=checkbox]:checked', { timeout: 30000 });

  const drop = process.env.XLSX_DROP;
  if (drop) {
    await page.evaluate((n) => window.Alpine.$data(document.querySelector('[x-data]')).toggle(n), drop);
  }
  if (process.env.XLSX_BUILD !== '0') {
    // await the build rather than firing it: build() is async and the page
    // holds the main thread while it runs, so an unawaited call races the
    // selector wait and the shot lands on a half-built page.
    const state = await page.evaluate(async () => {
      const d = window.Alpine.$data(document.querySelector('[x-data]'));
      await d.build();
      return { error: d.error, stack: d.__stack, hasResult: !!d.result, rows: d.rows.length, ms: d.elapsed };
    });
    console.log('  build:', JSON.stringify(state));
    if (!state.hasResult) throw new Error('the rebuild produced nothing: ' + (state.error || 'no error reported'));
    await page.waitForSelector('table.table', { timeout: 30000 });
  }
  await page.waitForTimeout(300);
}
