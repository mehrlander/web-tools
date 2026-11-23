// The Tending view over the real notes store, read through SHOT_GIT_API's
// answers (node/render/cdn.mjs). Fetch the store's checkout first so origin
// is current.
//
//   npm run shot -- app/index.html --width 390 --height 844 \
//     --script node/render/scenarios/tending-findings.mjs
//
// Optional: TENDING_TAB=settled, TENDING_OPEN=<id,id>, TENDING_SCROLL=<id>.
process.env.SHOT_GIT_API = '1';

export default async (page) => {
  const tab = process.env.TENDING_TAB || '';
  const open = (process.env.TENDING_OPEN || '').split(',').filter(Boolean);
  const scroll = process.env.TENDING_SCROLL || '';

  // A token the shim does not check: the view only needs to believe it has one.
  await page.evaluate((tab) => { window.TOKEN = 'FAKE'; window.__shell.goTending({ tab }); }, tab);
  await page.waitForFunction(() => {
    const el = document.querySelector('[x-data="tending()"]');
    const d = el && window.Alpine.$data(el);
    return d && !d.loading && d.notes.length > 0;
  }, null, { timeout: 60000 });

  if (open.length) {
    await page.evaluate((open) => {
      const d = window.Alpine.$data(document.querySelector('[x-data="tending()"]'));
      for (const id of open) d.open[id] = true;
    }, open);
  }
  await page.waitForTimeout(300);
  if (scroll) {
    await page.evaluate((id) => document.getElementById('finding-' + id)?.scrollIntoView({ block: 'start' }), scroll);
    await page.waitForTimeout(200);
  }
};
