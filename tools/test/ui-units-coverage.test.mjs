// The UI units' census and coding, held to the app they describe. Without this
// a new view or tab reaches no table: data/ui-units/units.csv changes only when
// someone reruns tools/ui-units.mjs, and nothing asked whether a unit was ever
// coded. The Map's UI > Dimensions tab sat uncounted for a day for exactly that
// reason (2026-10-06).
//
// What it holds, from the registries the router itself is held to:
//   every first-class address of the Web Tools app is a unit, and a route that
//     lands on a tab (docs/app-routes.csv, lands) is an address of that tab's
//     unit rather than a unit of its own;
//   every Web Tools unit is still an address, so a retired tab leaves no row;
//   every unit in rings 0 to 2 is coded, with the commit it was read at;
//   every coded value is a code of its dimension, one where the dimension
//     takes one (data/ui-units/dimensions.csv, per_unit).
// The coding checks run over home's private tables too where a sibling
// checkout of home is present; CI has only this repo, so there they cover the
// public units alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const rows = (p) => parseCsv(readFileSync(p, 'utf8'));
const list = (s) => String(s || '').split(';').map(x => x.trim()).filter(Boolean);
const FIX = 'rerun `node tools/ui-units.mjs --write`, then code the unit against data/ui-units/codebook.md';

const routes = rows(path.join(repoRoot, 'docs/app-routes.csv'));
const mapTabs = rows(path.join(repoRoot, 'docs/map-tabs.csv'));
const UI = path.join(repoRoot, 'data/ui-units');
const HOME_UI = path.join(repoRoot, '..', 'home', 'data/ui-units');
const stores = [UI, ...(existsSync(path.join(HOME_UI, 'coded.csv')) ? [HOME_UI] : [])];
const units = rows(path.join(UI, 'units.csv'));
// The app's own views and tabs, ring 0; a promoted page shares the host but is no route.
const app = units.filter(u => u.host === 'Web Tools app' && u.app_ring === '0');
const addrs = (u) => String(u.address || '').split(' | ').map(x => x.trim());

test('every first-class address of the Web Tools app is a UI unit', () => {
  for (const r of routes) {
    if (r.key === 'shell' || r.key === 'map') continue;
    const own = app.find(u => u.unit === `web-tools:view/${r.key}`);
    if (r.lands) {
      assert.ok(!own, `${r.key}: lands on ${r.lands}, so it is not a unit of its own; ${FIX}`);
      const target = app.filter(u => addrs(u)[0] === r.lands);
      assert.ok(target.length, `${r.key}: lands on ${r.lands}, which no unit has; ${FIX}`);
      for (const u of target) assert.ok(addrs(u).includes(r.address || `?view=${r.key}`),
        `${u.unit}: does not carry ${r.key}'s address, which lands on it; ${FIX}`);
    } else assert.ok(own, `?view=${r.key} has no unit; ${FIX}`);
    for (const t of list(r.tabs)) assert.ok(app.some(u => u.view === r.key && u.tab === t),
      `?view=${r.key}&tab=${t} has no unit; ${FIX}`);
  }
  for (const t of mapTabs) assert.ok(app.some(u => u.unit === `web-tools:map/${t.tab}`),
    `?view=map&tab=${t.tab} has no unit; ${FIX}`);
});

test('every Web Tools unit is still an address of the app', () => {
  const live = new Set(mapTabs.map(t => `map/${t.tab}`));
  for (const r of routes) {
    if (!r.lands) live.add(`view/${r.key}`);
    if (r.key !== 'map') for (const t of list(r.tabs)) live.add(`view/${r.key}/${t}`);
  }
  for (const u of app) {
    const key = u.unit.replace(/^web-tools:/, '');
    // A tab drawn several ways by its data is one unit per rendering, under the tab.
    assert.ok(live.has(key) || live.has(key.split('/').slice(0, 3).join('/')),
      `${u.unit} names no route or tab in docs/app-routes.csv or docs/map-tabs.csv; ${FIX}`);
  }
});

test('every unit in rings 0 to 2 is coded, with the commit it was read at', () => {
  for (const dir of stores) {
    const coded = new Map(rows(path.join(dir, 'coded.csv')).map(c => [c.unit, c]));
    const census = rows(path.join(dir, 'units.csv'));
    for (const u of census.filter(u => u.app_ring !== '' && +u.app_ring <= 2))
      assert.ok(coded.has(u.unit), `${u.unit} (ring ${u.app_ring}) is not coded; ${FIX}`);
    const known = new Set(census.map(u => u.unit));
    for (const c of coded.values()) {
      assert.ok(known.has(c.unit), `${c.unit} is coded but not in ${path.relative(repoRoot, dir)}/units.csv`);
      assert.match(c.at || '', /^[0-9a-f]{7,40}$/, `${c.unit}: at must name the commit the unit was read at`);
    }
  }
});

test('every coded value is a code of its dimension, one where the dimension takes one', () => {
  const codes = rows(path.join(UI, 'codes.csv'));
  const dims = rows(path.join(UI, 'dimensions.csv')).filter(d => d.read_from.startsWith('coded.csv'));
  for (const dir of stores) for (const c of rows(path.join(dir, 'coded.csv'))) for (const d of dims) {
    const vals = list(c[d.dimension]).map(v => v.split(':')[0]);
    if (d.per_unit === 'one') assert.equal(vals.length, 1, `${c.unit}: ${d.dimension} takes exactly one code, has ${vals.length}`);
    for (const v of vals) assert.ok(codes.some(k => k.axis === d.dimension && k.code === v),
      `${c.unit}: ${d.dimension} code ${v} is not in data/ui-units/codes.csv`);
  }
});
