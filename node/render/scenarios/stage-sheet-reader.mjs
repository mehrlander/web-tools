// A workbook dropped onto the Stage, read in the formatted Sheet mode.
//
//   npm run shot -- app/index.html --query "view=stage" \
//     --script node/render/scenarios/stage-sheet-reader.mjs --width 390
//
// SHEET_EXTRA=1 stages a text file first, so the reader opens on a deck of
// two rather than one. SHEET_TAP=1 taps a cell after the sheet draws, and
// SHEET_SHOT=<png> saves the before-tap frame there, so one run shows both.
import { readFileSync } from 'node:fs';

const file = process.env.SHEET_FIXTURE || 'docs/examples/allotment-ledger.xlsx';

const chrome = (page) => page.evaluate(() => {
  const vis = (el) => !!el && el.offsetParent !== null && !el.classList.contains('hidden');
  const panel = document.querySelector('.sd-subheader')?.parentElement;
  const kids = panel ? [...panel.children] : [];
  return {
    header: vis(kids[0]),
    footer: vis(kids[3]),
    count: kids.length,
    selected: [...document.querySelectorAll('td[data-sel],th[data-sel]')].map(e => e.getAttribute('data-c') || e.textContent).slice(0, 6),
    inspector: document.querySelector('[data-sheet="inspect"]')?.innerText?.replace(/\s+/g, ' ').trim() || null,
    tip: !!document.querySelector('[aria-describedby="wt-title-tip"]'),
    modes: document.querySelector('[data-reader-modes]')?.innerText?.trim() || null,
  };
});

export default async (page) => {
  await page.waitForSelector('[x-data*="stager"]', { timeout: 15000 });
  const bytes = [...readFileSync(file)];
  const name = file.split('/').pop();
  await page.evaluate(async ({ bytes, name, extra }) => {
    const el = document.querySelector('[x-data*="stager"]');
    const data = window.Alpine.$data(el);
    if (extra) {
      const t = new TextEncoder().encode('a note staged before the workbook\n');
      data.onDropped({ file: {}, name: 'note.txt', size: t.length, type: 'text/plain', bytes: t, buf: t.buffer });
    }
    const b = new Uint8Array(bytes);
    data.onDropped({ file: {}, name, size: b.length, type: '', bytes: b, buf: b.buffer });
    const it = data.localItems.find(x => x.name === name);
    await data.view(it);
  }, { bytes, name, extra: !!process.env.SHEET_EXTRA });
  await page.waitForSelector('td[data-c]', { timeout: 30000 });
  await page.waitForTimeout(800);
  console.log('OPEN  ' + JSON.stringify(await chrome(page)));
  if (process.env.SHEET_SHOT) await page.screenshot({ path: process.env.SHEET_SHOT });
  if (process.env.SHEET_TAP) {
    const at = await page.evaluate((c) => {
      const td = document.querySelector(`td[data-c="${c}"]`) || document.querySelectorAll('td[data-c]')[5];
      const r = td.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, c: td.getAttribute('data-c') };
    }, process.env.SHEET_TAP === '1' ? 'B4' : process.env.SHEET_TAP);
    // SHEET_TOUCH=1 taps with a finger (run with --touch), which is what
    // decides whether a cell's title-tip opens; the mouse path always hovers.
    if (process.env.SHEET_TOUCH) await page.touchscreen.tap(at.x, at.y);
    else await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(400);
    console.log('TAP ' + at.c + ' ' + JSON.stringify(await chrome(page)));
  }
};
