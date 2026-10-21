// alpineComponents/map.js — the Map view's FEDERATED halves, the two tabs whose
// rows come from other repos' manifests rather than from a hub registry.
//
// map-view.test.mjs mounts with no token, so `hasToken()` is false there and
// both of these stay gated off. This file is the other side: a token, a stubbed
// private-registry config cache, and the assertions that the aggregate is
// assembled the way the charter requires. The hub reads what each repo
// DECLARED; it never goes reading trees.
//
// The growth half is why the file exists. web-tools and home each promoted
// pages/doc-growth.html as an app view with a different `?src=`, and the estate
// nav rendered the words "Doc Growth" twice with nothing to choose between
// them. One instrument over several corpora is a control on a tab, so the
// promotion became a `growth` key each repo declares and the Growth tab reads.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, tick, repoRoot, captureAlpineErrors } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body>
    <div id="map" x-data="map()"></div>
  </body></html>`,
});

const { default: Alpine } = await import('alpinejs/dist/module.esm.js');
captureAlpineErrors(Alpine);
window.Alpine = Alpine;

// The crawl's cache, in the shape lib/kits/repo-config-cache.js writes: one
// entry per repo, each carrying that repo's whole manifest under `config`. A
// new manifest key therefore needs no crawler change, which is the property
// this fixture is really asserting.
const configs = {
  repos: {
    'mehrlander/web-tools': {
      config: { estate: true, growth: 'data/doc-growth/web-tools.json' },
    },
    'mehrlander/home': {
      config: {
        estate: true,
        growth: 'data/doc-growth.json',
        skills: ['blog', { name: 'tasks', origin: 'forked' }, 'drain'],
      },
    },
    // Declares neither. The ordinary case: it contributes no row to either
    // aggregate rather than an empty one.
    'mehrlander/quiet': { config: { estate: true } },
    // Visited and found to have no manifest. `config: null` is how a repo
    // leaves the cache, and nothing downstream may throw on it.
    'mehrlander/gone': { config: null },
  },
};

const skillsCsv = readFileSync(path.join(repoRoot, 'skills', 'manifest.csv'), 'utf8');
const portableCsv = readFileSync(path.join(repoRoot, 'docs', 'portable.csv'), 'utf8');
const harnessCsv = readFileSync(path.join(repoRoot, 'docs', 'harness.csv'), 'utf8');
const propsRegCsv = readFileSync(path.join(repoRoot, 'docs', 'registries.csv'), 'utf8');
const propsDeclCsv = readFileSync(path.join(repoRoot, 'docs', 'properties.csv'), 'utf8');
const propsVocabCsv = readFileSync(path.join(repoRoot, 'docs', 'vocabularies.csv'), 'utf8');
const archiveCsv = readFileSync(path.join(repoRoot, 'archive', 'skills', 'archive.csv'), 'utf8');
const pagesCsv = readFileSync(path.join(repoRoot, 'pages', 'pages.csv'), 'utf8');
const upstreamCsv = readFileSync(path.join(repoRoot, 'docs', 'upstream-skills.csv'), 'utf8');

const asked = [];
// The peek kit is not loaded in this harness; its address grammar is, as a
// stand-in, so a card's peek can be asserted (kits/source-peek.js, addrOf).
window.SourcePeek ??= { addr: (repo, ref, p) => repo + (ref ? '@' + ref : '') + ':' + p, seed() {} };
window.TOKEN = 'test-token';
window.__shell = { REGISTRY_REPO: 'mehrlander/web-tools-private', hasToken: () => true };
window.GH = class {
  constructor(opts) { this.opts = opts; }
  async get(p) {
    asked.push({ repo: this.opts.repo, path: p });
    if (p === 'state/configs.json') return { text: JSON.stringify(configs) };
    if (p === 'skills/manifest.csv') return { text: skillsCsv };
    if (p === 'docs/portable.csv') return { text: portableCsv };
    if (p === 'docs/harness.csv') return { text: harnessCsv };
    if (p === 'docs/registries.csv') return { text: propsRegCsv };
    if (p === 'docs/properties.csv') return { text: propsDeclCsv };
    if (p === 'docs/vocabularies.csv') return { text: propsVocabCsv };
    if (p === 'archive/skills/archive.csv') return { text: archiveCsv };
    if (p === 'pages/pages.csv') return { text: pagesCsv };
    if (p === 'docs/upstream-skills.csv') return { text: upstreamCsv };
    throw new Error('unexpected fetch: ' + p);
  }
};

new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/repo-address.js'), 'utf8'))();
new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/csv.js'), 'utf8'))();
new window.Function(readFileSync(path.join(repoRoot, 'lib/vanilla-bundle.js'), 'utf8'))();
new window.Function(readFileSync(path.join(repoRoot, 'lib/alpineComponents/map.js'), 'utf8'))();
Alpine.start();
await tick(3);

const el = window.document.getElementById('map');
const data = Alpine.$data(el);

test('mounts with a token and no startup warnings', () => {
  assert.deepEqual(problems, []);
  assert.equal(data.hasToken(), true);
});

// ── Growth ───────────────────────────────────────────────────────────────────

test('the Growth tab collects every repo that declares a payload, hub included', async () => {
  assert.equal(data.estateGrowth, null, 'nothing is fetched before the tab is opened');
  await data.loadEstateGrowth();
  assert.deepEqual([...data.estateGrowth.map(g => g.repo)],
    ['mehrlander/web-tools', 'mehrlander/home'],
    'the hub sorts first, because it is the corpus the tab opens on');
  assert.deepEqual([...data.estateGrowth.map(g => g.path)],
    ['data/doc-growth/web-tools.json', 'data/doc-growth.json'],
    'the path is per repo: two repos keep their payloads in different places');
});

test('a repo declaring no payload, and one with no manifest at all, contribute nothing', () => {
  const repos = data.estateGrowth.map(g => g.repo);
  assert.ok(!repos.includes('mehrlander/quiet'), 'declaring nothing is the ordinary case');
  assert.ok(!repos.includes('mehrlander/gone'), 'config: null must not throw or enter');
});

test('the hub needs no ?src= and no token; every other corpus is addressed', () => {
  assert.equal(data.growthSubject.repo, 'mehrlander/web-tools',
    'nothing selected opens on the hub');
  assert.equal(data.growthUrl, '../pages/doc-growth.html',
    "the hub's payload is the page's own built-in default");

  data.selectGrowthRepo('mehrlander/home');
  assert.equal(data.growthUrl,
    '../pages/doc-growth.html?src=mehrlander/home:data/doc-growth.json');
  assert.equal(data.growthSeen, true, 'selecting a corpus arms the frame');
});

test('the payload source follows the selection rather than always naming the hub', () => {
  const tab = data.mapTab;
  data.mapTab = 'growth';
  try {
    assert.equal(data.mapSources[0].addr, 'mehrlander/home@main:data/doc-growth.json');
    data.selectGrowthRepo('mehrlander/web-tools');
    assert.equal(data.mapSources[0].addr, 'mehrlander/web-tools@main:data/doc-growth/web-tools.json');
  } finally { data.mapTab = tab; }
});

test('a selection naming a repo the cache no longer carries falls back to the hub', () => {
  data.growthRepo = 'mehrlander/departed';
  assert.equal(data.growthSubject.repo, 'mehrlander/web-tools');
  assert.equal(data.growthUrl, '../pages/doc-growth.html');
  data.growthRepo = '';
});

// ── Skills ───────────────────────────────────────────────────────────────────

test('Docs source panel points at Context in the app', () => {
  const panel = el.querySelector('[data-map-sources-panel]');
  const link = [...panel.querySelectorAll('button')].find(b => b.textContent.trim() === 'Session context ↗');
  assert.equal(link?.getAttribute('@click'), "setTab('context')");
  assert.equal(el.querySelector('a[href*="session-context.html"]'), null, 'the retired page is no longer linked');
});

test('the estate skills half reads each repo\'s own declaration, and skips the hub', async () => {
  await data.loadEstateSkills();
  assert.deepEqual([...data.estateSkills.map(g => g.repo)], ['mehrlander/home'],
    "the hub's committed set IS the plugin, so counting it here would double it");
  assert.deepEqual([...data.estateSkills[0].skills.map(s => s.name)],
    ['blog', 'drain', 'tasks'], 'bare strings and objects both resolve, sorted by name');
  assert.equal(data.estateSkills[0].skills.find(s => s.name === 'tasks').origin, 'forked');
});

test('an estate skill is a card like any other: its repo a badge, its SKILL.md the peek', () => {
  const est = data.skillRowsAll.filter(r => r.set === 'estate');
  assert.deepEqual([...est.map(r => r.name)], ['blog', 'drain', 'tasks']);
  const tasks = est.find(r => r.name === 'tasks');
  assert.deepEqual([...tasks.badges.map(b => b.label)], ['home', 'forked']);
  assert.match(tasks.peek, /^mehrlander\/home(@[^:]+)?:\.claude\/skills\/tasks\/SKILL\.md$/);
  assert.equal(tasks.group, '', 'the estate declares no subject yet, so it sits under Unsorted');
});

test('the three sets are one population, and All counts each skill once', async () => {
  await Promise.all([data.loadSkillsReg(), data.loadUpstreams(), data.loadSkillExtras()]);
  const counts = Object.fromEntries(data.skillSetCounts.map(c => [c.key, c.n]));
  assert.deepEqual(Object.keys(counts), ['all', 'yours', 'estate', 'outside']);
  assert.equal(counts.yours, data.skillsReg.length,
    'the plugin index joins the roster; it does not add a second row per skill');
  assert.ok(data.yoursAll.every(r => r.plugin), 'every roster skill finds its plugin row');
  assert.equal(data.skillCommand(data.yoursAll.find(r => r.name === 'tasks')), '/portable:tasks');
  assert.equal(counts.estate, 3, 'the estate is the aggregate above');
  const outside = window.Csv.rows(upstreamCsv).filter(r => !['adapted', 'vendored'].includes(r.status));
  assert.equal(counts.outside, outside.length, 'a copy that ships in skills/ is one of Yours, not a third party');
  assert.equal(counts.all, counts.yours + counts.estate + counts.outside, 'no skill is counted twice');

  assert.equal(data.skillSet, 'all', 'the tab opens on All');
  assert.equal(data.skillTally.shown, counts.all);
  data.skillSet = 'estate';
  assert.equal(data.skillTally.shown, counts.estate, 'a selection narrows the tally with it');
  assert.equal(data.showSkillSet('yours'), false);
  data.skillSet = 'all';
});

test('a query re-weights every set, so a miss in one is visibly not a gap', () => {
  data.skillQ = 'tasks';
  const counts = Object.fromEntries(data.skillSetCounts.map(c => [c.key, c.n]));
  assert.ok(counts.yours >= 1, 'the plugin ships a tasks skill');
  assert.equal(counts.estate, 1, "home's forked copy answers too");
  assert.equal(counts.all, counts.yours + counts.estate + counts.outside);
  data.skillQ = 'zzzz-no-such-skill';
  assert.equal(data.skillTally.shown, 0, 'the empty state is one number, over the set in view');
  data.skillQ = '';
});

test('the subject axis reaches every set that declares one, and each axis counts under the other', async () => {
  await data.loadSkillExtras();
  data.skillGroup = 'documents';
  try {
    const shown = data.skillShown;
    assert.ok(shown.length > 0 && shown.every(r => r.group === 'documents'));
    assert.ok(shown.some(r => r.set === 'outside'), 'a third party with a subject answers the chip too');
    const counts = Object.fromEntries(data.skillSetCounts.map(c => [c.key, c.n]));
    assert.equal(counts.all, shown.length, 'the set strip counts under the subject chip');
    assert.equal(counts.estate, 0, 'the estate has no subject yet, so documents finds none of it');
    assert.equal(data.skillTally.shown, shown.length);
    assert.deepEqual([...data.retiredRows], [], 'a retired skill has no subject to match');
  } finally { data.skillGroup = ''; }

  data.skillGroup = '_none';
  try {
    assert.ok(data.skillShown.length && data.skillShown.every(r => r.set === 'estate'), 'Unsorted is what has no subject');
  } finally { data.skillGroup = ''; }

  data.skillSet = 'outside';
  try {
    const g = Object.fromEntries(data.skillGroupCounts.map(c => [c.key, c.n]));
    assert.equal(g.documents, 1, 'the subject strip counts under the set');
    assert.equal(data.skillGroupAll, data.skillShown.length);
    assert.equal(g._none, undefined, 'Unsorted shows only while something in view lacks a subject');
    assert.deepEqual([...data.retiredRows], [], 'Retired belongs to Yours');
  } finally { data.skillSet = 'all'; }
  assert.ok(data.retiredRows.some(r => r.name === 'safe-html-templating' && r.successor),
    'the archive renders at the foot, with where its guidance went');
});

test('a dashed card is one no session loads', () => {
  const by = Object.fromEntries(data.skillRowsAll.map(r => [r.name, r]));
  assert.equal(by['tasks'].loaded, true);
  assert.equal(by['anthropics/xlsx'].loaded, true, 'the host supplies a referenced skill');
  assert.equal(by['obra/writing-skills'].loaded, false, 'held: kept under outside/, never shipped');
  assert.equal(by['anthropic-cowork/schedule'].loaded, false, 'declined');
  assert.match(by['obra/writing-skills'].peek, /outside\/obra\/writing-skills\/SKILL\.md$/, 'a held copy peeks our copy');
  assert.match(by['anthropics/xlsx'].peek, /^anthropics\/skills@[0-9a-f]+:skills\/xlsx\/SKILL\.md$/,
    'a referenced skill peeks its upstream at the pin');
});

test('a skill demo comes from the pages catalog and opens as an app view', async () => {
  await data.loadSkillExtras();
  assert.ok(data.skillDemo('caveman'), 'the catalog lists skills/caveman/demo.html');
  assert.equal(data.skillDemo('tasks'), '', 'no demo, no badge');
  const q = new URLSearchParams(data.skillDemoHref('caveman').slice(1));
  assert.equal(q.get('view'), 'app');
  assert.equal(q.get('appPath'), 'skills/caveman/demo.html');
});

test('each set states its own rule, and the tab carries no paragraph doing it instead', () => {
  for (const key of data.skillSetOrder) {
    assert.ok(data.skillSetGloss(key).length > 40, key + ': the set says what it costs');
  }
  const src = readFileSync(path.join(repoRoot, 'lib/alpineComponents/map.js'), 'utf8');
  assert.ok(!src.includes('Two sets, one search'),
    'the explanatory paragraph is replaced by the control it was describing');
  assert.ok(!src.includes("peek('archive/skills/README.md')"),
    'the archive is rows on the tab, not a link to a README');
});

// ── The manifests behind both ────────────────────────────────────────────────

test('the hub declares its own growth payload, and the file is there', () => {
  const cfg = JSON.parse(readFileSync(path.join(repoRoot, '.web-tools.json'), 'utf8'));
  assert.equal(typeof cfg.growth, 'string');
  assert.ok(readFileSync(path.join(repoRoot, cfg.growth), 'utf8').length > 0);
});

test('the hub promotes no page whose subject is a query', () => {
  // The trap this branch closes. A promoted page renders as label plus icon, so
  // two repos promoting one page with different arguments are indistinguishable
  // in the nav however correct the two entries are.
  const cfg = JSON.parse(readFileSync(path.join(repoRoot, '.web-tools.json'), 'utf8'));
  for (const pg of cfg.pages || []) {
    assert.ok(!(pg.appView && pg.query),
      pg.path + ': an app view carrying a query is a lens, and a lens belongs on a control');
  }
});

test('only the private registry is asked for the cache', () => {
  for (const a of asked.filter(a => a.path === 'state/configs.json')) {
    assert.equal(a.repo, 'mehrlander/web-tools-private');
  }
});
