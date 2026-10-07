// Shoot the Branches pane's coverage line, which only appears when the crawl
// has not reached everything.
//
// The stored cache in the sibling checkout predates the fields the line reads,
// so it is patched in the page after load rather than waited for: a real crawl
// is the only thing that would write them, and this shot is about whether the
// sentence renders and reads, not about deriving it.
export default async (page) => {
  await page.evaluate(() => { try { localStorage.setItem('ghToken', 'local-preview'); } catch {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[x-data]', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(4000);
  // ?view=activity resolves to Sessions, which is deliberate (the nav stop and
  // the pane it opens share a name), so the Branches pane is reached by its
  // pill exactly as a reader reaches it.
  await page.getByRole('tab', { name: 'Branches' }).click().catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const el = document.querySelector('#es, [x-data*="estate"]');
    const d = window.Alpine && el && window.Alpine.$data(el);
    if (!d || !d.activity) return;
    const names = Object.keys(d.activity);
    if (names[0]) Object.assign(d.activity[names[0]].scan ||= {},
      { pending: 371, beyondHorizon: 79, listCapped: true, listOrdered: false });
    if (names[1]) Object.assign(d.activity[names[1]].scan ||= {},
      { pending: 395, beyondHorizon: 144, listCapped: true, listOrdered: true });
  });
  await page.waitForTimeout(1200);
};
