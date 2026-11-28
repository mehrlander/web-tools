// Drive the FAB's bottom panel through its three menu buttons: the launcher
// menu with its Panel row, then Peek, Probe and Comment, each opened from that
// row. FAB_SHOT picks where it stops: menu, peek, probe, all (Peek, then Probe)
// or comment (default).
//
//   FAB_SHOT=probe npm run shot -- pages/index.html --script node/render/scenarios/fab-bottom-tabs.mjs
export default async (page) => {
  const stop = process.env.FAB_SHOT || 'comment';
  await page.waitForSelector('[data-fab-wrap] [role="button"]', { timeout: 20000 });
  const disc = page.locator('[data-fab-wrap] [role="button"]').first();
  const menu = async () => {
    await disc.click({ button: 'right' });
    await page.waitForSelector('[data-fab-panel-row]', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(500);
  };
  await menu();
  if (stop === 'menu') return;
  const tap = async (sel) => { await page.click(sel); await page.waitForTimeout(600); };
  if (stop === 'peek') {
    await tap('[data-fab-panel-peek]');
    const box = await page.locator('h1, h2, main').first().boundingBox();
    if (box) await page.mouse.click(box.x + 20, box.y + 10);
    await page.waitForTimeout(500);
    return;
  }
  if (stop === 'probe' || stop === 'all') {
    if (stop === 'all') { await tap('[data-fab-panel-peek]'); await menu(); }
    await tap('[data-fab-panel-probe]');
    await page.waitForSelector('[data-fab-probe-host] #wt-probe', { timeout: 8000 });
    await page.mouse.move(200, 200); await page.mouse.move(260, 240);
    await page.waitForTimeout(400);
    return;
  }
  await tap('[data-fab-panel-comment]');
  await page.waitForSelector('[data-fab-bottom] [data-fab-note-ta]', { state: 'visible', timeout: 5000 });
  await page.fill('[data-fab-bottom] [data-fab-note-ta]', 'The header wraps at phone width; the second button drops below the first.');
  await page.waitForTimeout(300);
};
