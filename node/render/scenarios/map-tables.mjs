// screenshot.mjs interaction scenario: the Map view's Data tab, Tables, a
// line per table with its columns in their primitives' marks.
//
//   node node/render/screenshot.mjs app/index.html \
//     --script node/render/scenarios/map-tables.mjs \
//     --out node/.preview/map-tables.png --full
//
// The sandbox blocks api.github.com, so the scenario serves the committed
// registry pair, docs/vocabularies.csv, docs/text-fields.csv, the hub's
// declaration, its CSV census and the drawn marks through a stubbed GH.get.
// No token is set, so the view shows the hub's tables alone, which is what a
// tokenless reader sees.
//
// What the pixels prove: the primitive chips with their marks and counts, the
// tables grouped by folder, each column a chip in its primitive's mark and
// colour, and one panel-tip pinned open. TABLES_TAB=registries draws the
// Registries narrowing instead; TABLES_PICK=<primitive> picks a primitive
// chip; TABLES_TIP=table pins the table's tip rather than a column's, and
// TABLES_TIP=none pins none and leaves the page at its top.
// TABLES_ESTATE=<path to a home checkout> also serves budget-drs's column
// lineage as a declared data.columns registry, through a stubbed token and
// config cache, so the estate half draws.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const HOME_COLUMNS = 'projects/budget-drs/data/design/lineage/columns.csv';

export default async function (page) {
  const files = {};
  for (const f of ['docs/registries.csv', 'docs/properties.csv', 'docs/vocabularies.csv', 'docs/text-fields.csv',
    'data/csv-census.csv', '.web-tools.json', ...['id', 'label', 'locator', 'value'].map(p => `docs/favicons/primitives/${p}.svg`)])
    files[f] = await page.evaluate(p => fetch('../../' + p).then(r => r.text()), f);
  const home = process.env.TABLES_ESTATE;
  if (home) {
    files[HOME_COLUMNS] = readFileSync(path.join(home, HOME_COLUMNS), 'utf8');
    files['state/configs.json'] = JSON.stringify({ repos: { 'mehrlander/home': { config: JSON.parse(readFileSync(path.join(home, '.web-tools.json'), 'utf8')) } } });
  }
  const ok = await page.evaluate((files) => {
    if (!window.Alpine || !window.__shell || !window.GH) return 'no shell';
    window.TOKEN = files['state/configs.json'] ? 'scenario' : '';
    const origGet = window.GH.prototype.get;
    window.GH.prototype.get = async function (name) {
      if (files[name] != null) return { text: files[name] };
      if (name === '.claude/settings.json' || name === 'CLAUDE.md' || name === 'docs/portable.csv'
          || name === 'state/configs.json' || name === 'state/activity.json'
          || name === 'lists/to-do.json' || name === 'lists/jot.json')
        throw Object.assign(new Error('404'), { status: 404 });
      return origGet.call(this, name);
    };
    window.__shell.goMap();
    return true;
  }, files);
  if (ok !== true) throw new Error('map-tables scenario: ' + ok);

  const find = () => [...document.querySelectorAll('[x-data]')].find(e => (e.getAttribute('x-data') || '').includes('map('));
  await page.waitForFunction(`(${find})()`, { timeout: 20000 });
  await page.evaluate(([tab, pick]) => {
    const el = [...document.querySelectorAll('[x-data]')].find(e => (e.getAttribute('x-data') || '').includes('map('));
    const d = window.Alpine.$data(el);
    if (window.TOKEN) d.hasToken = () => true;
    d.setTab(tab || 'data');
    if (pick) d.primPick = pick;
  }, [process.env.TABLES_TAB || '', process.env.TABLES_PICK || '']);
  await page.waitForFunction(() => {
    const el = [...document.querySelectorAll('[x-data]')].find(e => (e.getAttribute('x-data') || '').includes('map('));
    const d = el && window.Alpine.$data(el);
    return d && d.propsReg && !d.propsLoading && !d.dataLoading && !d.estateColumnsLoading && document.querySelector('[data-col]');
  }, { timeout: 20000 });
  // Pin one tip: the registry pair's key_primitive column, or that table
  // itself, so the shot shows what a tap opens. The tap waits for the scroll
  // to settle, since a scroll closes an open tip (kits/panel-tip.js).
  const anchor = (which) => {
    const row = document.querySelector('[data-table="docs/registries.csv"]') || document.querySelector('[data-table]');
    return which === 'table' ? row.querySelector('[data-part="title"]') : (row.querySelector('[data-col="key_primitive"]') || row.querySelector('[data-col]'));
  };
  const which = process.env.TABLES_TIP || '';
  if (which === 'none') return page.waitForTimeout(600);
  await page.evaluate(`(${anchor})(${JSON.stringify(which)}).scrollIntoView({ block: 'center' })`);
  await page.waitForTimeout(400);
  await page.evaluate(`(${anchor})(${JSON.stringify(which)}).click()`);
  await page.waitForTimeout(800);
}
