// screenshot.mjs interaction scenario: the Map view's Data tab, landing on
// Primitives, every declared column by the primitive it holds.
//
//   node node/render/screenshot.mjs app/index.html \
//     --script node/render/scenarios/map-primitives.mjs \
//     --out node/.preview/map-primitives.png --full
//
// The sandbox blocks api.github.com, so the scenario serves the committed
// registry pair, docs/vocabularies.csv and docs/text-fields.csv through a
// stubbed GH.get, as map-registries.mjs does. No token is set, so the view
// shows the hub's columns alone, which is what a tokenless reader sees.
//
// What the pixels prove: the four primitive chips with their icons and
// counts, the By primitive groups headed by each primitive's icon and
// definition, and one column's card opened. PRIM_LENS=table draws the By table
// lens instead. PRIM_ESTATE=<path to a home checkout> also serves budget-drs's
// column lineage as a declared data.columns registry, through a stubbed token
// and config cache, so the estate half draws.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const HOME_COLUMNS = 'projects/budget-drs/data/design/lineage/columns.csv';

export default async function (page) {
  const files = {};
  for (const f of ['docs/registries.csv', 'docs/properties.csv', 'docs/vocabularies.csv', 'docs/text-fields.csv'])
    files[f] = await page.evaluate(p => fetch('../../' + p).then(r => r.text()), f);
  const home = process.env.PRIM_ESTATE;
  if (home) {
    files[HOME_COLUMNS] = readFileSync(path.join(home, HOME_COLUMNS), 'utf8');
    files['state/configs.json'] = JSON.stringify({ repos: { 'mehrlander/home': { config: { estate: true, data: { columns: [
      { path: HOME_COLUMNS, base: 'projects/budget-drs', table: 'table', column: 'column', origin: 'role', gloss: 'transform' }] } } } } });
  }
  const ok = await page.evaluate((files) => {
    if (!window.Alpine || !window.__shell || !window.GH) return 'no shell';
    if (files['state/configs.json']) window.TOKEN = 'scenario';
    const origGet = window.GH.prototype.get;
    window.GH.prototype.get = async function (name) {
      if (files[name] != null) return { text: files[name] };
      if (name === '.claude/settings.json' || name === 'CLAUDE.md' || name === '.web-tools.json'
          || name === 'docs/portable.csv' || name === 'state/configs.json' || name === 'state/activity.json'
          || name === 'lists/to-do.json' || name === 'lists/jot.json')
        throw Object.assign(new Error('404'), { status: 404 });
      return origGet.call(this, name);
    };
    window.__shell.goMap();
    return true;
  }, files);
  if (ok !== true) throw new Error('map-primitives scenario: ' + ok);

  const find = () => [...document.querySelectorAll('[x-data]')].find(e => (e.getAttribute('x-data') || '').includes('map('));
  await page.waitForFunction(`(${find})()`, { timeout: 20000 });
  await page.evaluate((lens) => {
    const el = [...document.querySelectorAll('[x-data]')].find(e => (e.getAttribute('x-data') || '').includes('map('));
    const d = window.Alpine.$data(el);
    if (window.TOKEN) d.hasToken = () => true;
    d.setTab('primitives');
    if (lens) d.primLens = lens;
  }, process.env.PRIM_LENS || '');
  // PRIM_REPO narrows to one repository, and the card opens on its first
  // authored column rather than on the hub's key_primitive.
  await page.waitForFunction(() => {
    const el = [...document.querySelectorAll('[x-data]')].find(e => (e.getAttribute('x-data') || '').includes('map('));
    const d = el && window.Alpine.$data(el);
    return d && d.propsReg && !d.propsLoading && !d.estateColumnsLoading && document.querySelector('[data-prim-col]');
  }, { timeout: 20000 });
  await page.evaluate((only) => {
    const el = [...document.querySelectorAll('[x-data]')].find(e => (e.getAttribute('x-data') || '').includes('map('));
    const d = window.Alpine.$data(el);
    const repo = d.primRepoItems.find(r => r.label === only)?.key || '';
    d.primRepo = repo;
    d.primSel = (repo ? d.primAll.find(c => c.repo === repo && c.origin === 'authored' && c.gloss)
      : d.primAll.find(c => c.table === 'registries' && c.column === 'key_primitive')) || null;
  }, process.env.PRIM_REPO || '');
  await page.waitForTimeout(600);
}
