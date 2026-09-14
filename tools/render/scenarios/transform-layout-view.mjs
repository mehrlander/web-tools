// The Transform page's Layout view, on real rows: ingest a small budget extract,
// run it, put two dimensions down the side and two across the top, and switch to
// Layout. Nothing here is planted on the model; it goes through the component's
// own ingest, run and view switch, so the shot is of the path a reader takes.
//
//   npm run shot -- pages/transform.html --width 1280 \
//     --script tools/render/scenarios/transform-layout-view.mjs --wait 3000

const R = (group, item, version, year, amount) => ({ group, item, version, year, amount });

const ROWS = [
  R('Comp', 'Updated PEBB Rate', 'GOV', '2026', 0),
  R('Comp', 'Updated PEBB Rate', 'GOV', '2027', -53000),
  R('Comp', 'Updated PEBB Rate', 'HOUSE', '2026', 0),
  R('Comp', 'Updated PEBB Rate', 'HOUSE', '2027', -66000),
  R('Comp', 'Retiree Healthcare Subsidy', 'HOUSE', '2027', -16000),
  R('Ctrl Svc', 'ML Ctrl Svc', 'GOV', '2026', 23000),
  R('Ctrl Svc', 'ML Ctrl Svc', 'GOV', '2027', 20000),
  R('Ctrl Svc', 'ML Ctrl Svc', 'HOUSE', '2026', 11000),
  R('Ctrl Svc', 'ML Ctrl Svc', 'HOUSE', '2027', 8000),
  R('Ctrl Svc', 'PL Ctrl Svc', 'GOV', '2027', 585000),
  R('Other', 'LEOFF Survivor Insurance', 'HOUSE', '2027', 149000),
  R('Other', 'LEOFF Restatement', 'HOUSE', '2026', 0),
  R('Other', 'LEOFF Restatement', 'HOUSE', '2027', 120000),
  R('Other', 'TRS & PERS Plan 1 COLA', 'HOUSE', '2026', 7000),
];

const bench = () => document.querySelector('[x-data^="transformWorkbench"]')._x_dataStack[0];

export default async (page) => {
  await page.waitForFunction(() => !!document.querySelector('[x-data^="transformWorkbench"]')?._x_dataStack);

  await page.evaluate(async (rows) => {
    const c = document.querySelector('[x-data^="transformWorkbench"]')._x_dataStack[0];
    c.ingest(rows, 'compare');
    await c.run();
  }, ROWS);
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    const c = document.querySelector('[x-data^="transformWorkbench"]')._x_dataStack[0];
    c.switchTo('pivot');
    c.pvDims = ['group', 'item'];
    c.pvColDims = ['version', 'year'];
    c.pvMeasure = 'amount';
    c.pvAgg = 'sum';
    c.switchTo('layout');
  });
  await page.waitForTimeout(400);

  console.log('LAYOUT ' + JSON.stringify(await page.evaluate(() => {
    const c = document.querySelector('[x-data^="transformWorkbench"]')._x_dataStack[0];
    return { view: c.curV, ready: c.rpReady(), rows: c.rpModel?.rows.length, cols: c.rpModel?.columns.length };
  })));
};
