// Horizontal overflow probe for pages/xlsx-picker.html: the manifest table is
// the one element wide enough to push the page sideways, and it is meant to
// scroll inside its own container rather than move the body.
import load from './xlsx-picker-load.mjs';

export default async function (page) {
  await load(page);
  const m = await page.evaluate(() => ({
    body: document.documentElement.scrollWidth,
    view: window.innerWidth,
    table: document.querySelector('table.table')?.parentElement?.scrollWidth ?? 0,
  }));
  console.log('  overflow:', JSON.stringify(m));
  if (m.body > m.view) throw new Error(`the page scrolls horizontally: ${m.body} > ${m.view}`);
}
