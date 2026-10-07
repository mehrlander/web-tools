// Does the guide renderer give the audit's table real cell padding, now that
// `prose prose-sm` is gone? Measures rather than eyeballs, then frames it.
export default async function (page) {
  await page.waitForSelector('[x-ref="doc"] [data-uid]');   // rendered is the default
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const td = document.querySelector('[x-ref="doc"] table td');
    if (!td) return { table: false };
    const cs = getComputedStyle(td);
    td.scrollIntoView({ block: 'center' });
    return { table: true, padding: cs.padding, border: cs.borderTopWidth, font: cs.fontSize };
  });
  console.log('TABLE ' + JSON.stringify(r));
  await page.waitForTimeout(300);
}
