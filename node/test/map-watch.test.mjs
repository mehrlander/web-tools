// The Map view's Watch tab groups the private registry's trigger paths by the
// machine each reaches. A trigger's machine is a docs/machines.csv key, so the
// groups follow that registry's order and carry its labels; a value it lacks
// keeps a group of its own under its text, and a blank one reads as any machine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const { window, problems } = makeWindow({ html: '<div id="map" x-data="map()"></div>' });
const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;
window.__shell = Alpine.reactive({ mapTab: 'watch', _authState: 'auth', hasToken(){ return true; } });
window.history.replaceState({}, '', '?view=map&tab=watch');
window.TOKEN = 'fixture';
const triggers = `id,machine,path,starts
ping,lenovo,A ping errand,A request
fork,actions-hosted,Pull requests from forks,A pull request
tools,lenovo,The daemon's tools,A tick
plugin,,The plugin's hooks,A session start
odd,Home laptop,An old spelling,Anything
odd2,Home laptop,Another old spelling,Anything
`;
const asked = [];
window.GH = class {
  constructor(opts){ this.opts = opts; }
  async get(file){
    asked.push({ repo: this.opts.repo, file });
    if (file === 'data/design/triggers.csv') return { text: triggers };
    if (file === 'state/watch.json') return { text: '{"public":{"files":[]},"marks":[]}' };
    return { text: readFileSync(path.join(repoRoot, file), 'utf8') };
  }
};
for (const file of ['lib/kits/repo-address.js', 'lib/kits/csv.js', 'lib/vanilla-bundle.js', 'lib/alpineComponents/map.js'])
  new window.Function(readFileSync(path.join(repoRoot, file), 'utf8'))();
Alpine.start();
const el = window.document.getElementById('map'), data = Alpine.$data(el);
// The component's arrays are the window's, so they compare as plain data.
const plain = (v) => JSON.parse(JSON.stringify(v));
await data.loadWatch();
await tick(2);

test('the groups follow docs/machines.csv, under its labels, read from the hub', () => {
  assert.deepEqual(problems, []);
  const labels = Object.fromEntries(window.Csv.rows(readFileSync(path.join(repoRoot, 'docs/machines.csv'), 'utf8')).map(v => [v.machine, v.label]));
  const groups = data.watchGroups;
  assert.deepEqual(plain(groups.slice(0, 2).map(g => [g.machine, g.label, g.rows.map(r => r.id)])),
    [['lenovo', labels['lenovo'], ['ping', 'tools']], ['actions-hosted', labels['actions-hosted'], ['fork']]]);
  assert.ok(asked.some(a => a.repo === data.hub() && a.file === 'docs/machines.csv'));
  const watch = [...el.querySelectorAll('section')].find(x => x.getAttribute('x-show') === "mapTab==='watch'");
  const heads = [...watch.querySelectorAll('[data-part="list"] h3')].map(h => h.textContent.trim());
  assert.deepEqual(plain(heads), [labels['lenovo'], labels['actions-hosted'], 'Home laptop', 'Any machine']);
});

test('a value machines.csv lacks keeps its own group, and a blank one reads as any machine, last', () => {
  const [stray, any] = data.watchGroups.slice(-2);
  assert.deepEqual(plain([stray.machine, stray.label, stray.rows.map(r => r.id)]), ['Home laptop', 'Home laptop', ['odd', 'odd2']]);
  assert.deepEqual(plain([any.machine, any.label, any.rows.map(r => r.id)]), ['', 'Any machine', ['plugin']]);
  assert.equal(data.watchGroups.length, 4, 'a machine with no trigger draws no group');
});
