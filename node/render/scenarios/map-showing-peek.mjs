// Open the Map's Showing tab and hold the pointer over the shown card's source
// link, so the source peek renders headlessly. The tab is public, so this needs
// no token; with --ref the screenshot reads the branch's files.
//
//   npm run shot -- app/index.html --query 'view=map&tab=showing' \
//     --script node/render/scenarios/map-showing-peek.mjs
//
// ROW picks the row whose card is shown, by its list id (default: the first).

export default async (page) => {
  const card = '[data-show-root] [data-show-card]';
  await page.waitForSelector(`${card} a[data-peek]`, { timeout: 20000 });
  if (process.env.ROW) await page.click(`[data-show-root] [data-row="${process.env.ROW}"]`);
  await page.waitForTimeout(400);
  await page.locator(`${card} a[data-peek]:visible`).first().hover();
  // Clears the peek's ~320 ms dwell plus its fetch; the row's own passage is
  // seeded by the view, so only a cold address waits.
  await page.waitForTimeout(1400);
};
