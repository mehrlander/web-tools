// The UI census: every unit of user interface the estate's two apps show, the
// ring it sits in, and the shared kits its files call. Passes 0 and 1 of the
// pattern catalog (data/ui-census/README.md); the codebook beside it is Pass 2.
//
// A UNIT is the grain a pattern is read at: an app view, a view's tab where the
// view declares tabs, or a page. Units are enumerated from declarations, never
// from a walk of the tree, so the census says what the apps CLAIM to show:
//
//   web-tools  docs/app-routes.csv (the router's rows), docs/map-tabs.csv
//              (the Map's addresses), app-routes `tabs` for the other tabbed
//              views, pages/pages.csv (the gallery)
//   any repo   .web-tools.json `pages[]`, where `appView: true` promotes a page
//              into the app
//   budget-drs app/view/app.html VIEWS (its views, and `embed` for the pages it
//              frames), RENDER (which function draws each view), and
//              data/design/view-tabs.csv (its tabs; `switch` rows are controls
//              inside a tab, not units)
//
// THE RING says how far a unit sits from the Web Tools app's center. No registry
// declares it; each value rests on the declaration named in `ring_basis`:
//
//   0  the app's built-in views and their tabs        app-routes.csv, map-tabs.csv
//   1  pages a repo promotes, and the views of a       appView: true
//      promoted app
//   2  pages a promoted app frames                     VIEWS[key].embed
//   3  gallery pages, and other pages nothing reaches  pages.csv, pages[]
//   4  demonstrations and scratch                      pages.csv top: demos,
//                                                      kit-demos, drop, scratch
//
// Named `app_ring` in the output because budget-drs's lineage/exposure.csv
// already has a `ring`, for how far a DATA file is from being displayed.
//
// THE SIGNALS are counts of call sites, per file, of the shared kits a pattern
// is built from, plus three signatures of a hand-built equivalent: a snap track
// in a file that never calls swipeDeck, a drag divider in one that never calls
// dockSplit, and a fixed full-window layer in one that does neither. A signature
// is a reason to read the file, not a finding: a page may carry scroll-snap for
// a reason that has nothing to do with decks.
//
//   node tools/ui-census.mjs [--date YYYY-MM-DD] [--estate <dir>] [--write]
//
// Without --write it prints a summary. With it, public rows go to this repo's
// data/ui-census/ and the budget-drs app's rows to home's data/ui-census/, so a
// private file's name never lands in public source.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, writeCsv } from './build/registries-load.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HUB = path.resolve(HERE, '..');
const OWNER = 'mehrlander';
// Visibility is not readable offline. A repo absent from this list is treated
// as private, so an unknown repo errs toward the store that discloses nothing.
const PUBLIC = new Set(['web-tools']);

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const DATE = opt('--date', new Date().toISOString().slice(0, 10));
const ESTATE = path.resolve(opt('--estate', path.join(HUB, '..')));
const WRITE = args.includes('--write');

const checkout = (repo) => path.join(ESTATE, repo);
const has = (repo, p = '') => existsSync(path.join(checkout(repo), p));
const read = (repo, p) => readFileSync(path.join(checkout(repo), p), 'utf8');
const csv = (repo, p) => parseCsv(read(repo, p));
const json = (repo, p) => JSON.parse(read(repo, p));
const sha = (repo) => {
  try { return execFileSync('git', ['-C', checkout(repo), 'rev-parse', '--short=12', 'HEAD']).toString().trim(); }
  catch { return ''; }
};

const units = [];
const add = (u) => units.push({ reachable: 'yes', attribution: 'declared', ...u });

// ── Ring 0: the Web Tools app's own views ────────────────────────────────────
const codeFiles = (s) => (s || '').split(';').map(x => x.trim()).filter(x => /\.(js|mjs|html)$/.test(x));
const routes = csv('web-tools', 'docs/app-routes.csv');
const mapTabs = csv('web-tools', 'docs/map-tabs.csv');
for (const r of routes) {
  const files = codeFiles(r.files);
  const base = {
    repo: 'web-tools', app_ring: 0, ring_basis: 'docs/app-routes.csv', host: 'Web Tools app',
    group: r.group, view: r.key, label: r.label,
    address: r.key === 'shell' ? '' : (r.address || `?view=${r.key}`),
  };
  // A route with no files of its own renders from the shell (app-routes.csv
  // says so in its own words), so the shell is where a reader must look.
  const own = files.length ? files : ['app/index.html'];
  const attribution = files.length ? 'declared' : 'shell';
  if (r.key === 'map') {
    for (const t of mapTabs) add({ ...base, unit: `web-tools:map/${t.tab}`, kind: 'tab', tab: t.tab,
      label: `Map: ${t.tab}`, ring_basis: 'docs/map-tabs.csv', address: `?view=map&tab=${t.tab}`,
      files: 'lib/alpineComponents/map.js', attribution: 'shared' });
    continue;
  }
  const tabs = (r.tabs || '').split(';').map(x => x.trim()).filter(Boolean);
  add({ ...base, unit: `web-tools:view/${r.key}`, kind: r.key === 'shell' ? 'shell' : 'view', tab: '',
    files: own.join(';'), attribution });
  for (const t of tabs) add({ ...base, unit: `web-tools:view/${r.key}/${t}`, kind: 'tab', tab: t,
    label: `${r.label}: ${t}`, address: `?view=${r.key}&tab=${t}`, files: own.join(';'), attribution: 'shared' });
}

// ── Promotions and frames, from every checked-out repo's manifest ────────────
const repos = readdirSync(ESTATE).filter(d => has(d, '.web-tools.json') && has(d, '.git'));
// A page's identity is repo plus path; `owner/repo:path` in a manifest names a
// page in another repo, which is how home promotes web-tools' Links and News.
const pageId = (declaringRepo, p) => {
  const m = String(p).match(/^([\w.-]+)\/([\w.-]+):(.+)$/);
  return m ? { repo: m[2], path: m[3] } : { repo: declaringRepo, path: p };
};
const promoted = new Map();   // "repo:path" -> [declaring repo, ...]
const listed = new Map();
for (const repo of repos) {
  let cfg; try { cfg = json(repo, '.web-tools.json'); } catch { continue; }
  for (const p of cfg.pages || []) {
    const id = pageId(repo, p.path); const k = `${id.repo}:${id.path}`;
    const into = p.appView ? promoted : listed;
    into.set(k, [...(into.get(k) || []), { by: repo, title: p.title || p.label || '' }]);
  }
}

// ── The budget-drs app: a promoted page that hosts views of its own ──────────
const BD = 'projects/budget-drs';
const bdApp = `${BD}/app/view/app.html`;
const framed = new Map();     // "repo:path" -> view key
if (has('home', bdApp)) {
  const html = read('home', bdApp);
  // The VIEWS literal: one `key: { ... }` per view, in sidebar order. Keys are
  // read off the line starts; `embed:{ repo, path }` follows within the entry.
  const start = html.indexOf('const VIEWS = {');
  const end = html.indexOf('\n    };', start);
  const body = html.slice(start, end > 0 ? end : start + 40000);
  const keyRe = /^\s{6}([a-z][\w]*):\s*\{/gm;
  const keys = []; let m;
  while ((m = keyRe.exec(body))) keys.push({ key: m[1], at: m.index });
  const entries = keys.map((k, i) => ({ key: k.key, text: body.slice(k.at, keys[i + 1]?.at ?? body.length) }));
  const renderStart = html.indexOf('const RENDER = {');
  const renderBody = html.slice(renderStart, html.indexOf('};', renderStart));
  const RENDER = Object.fromEntries([...renderBody.matchAll(/(\w+):\s*(\w+)/g)].map(x => [x[1], x[2]]));

  // Which views/*.js defines which top-level function, so RENDER's function
  // names resolve to a file, and a file's calls into a sibling resolve too.
  const vdir = `${BD}/app/view/views`;
  const vfiles = readdirSync(path.join(checkout('home'), vdir)).filter(f => f.endsWith('.js'));
  const defines = new Map();
  const src = {};
  for (const f of vfiles) {
    const raw = read('home', `${vdir}/${f}`);
    // Comments stripped before matching, since a header that says "renderData
    // in data-explorer.js mounts it" is a reference in prose, not in code.
    src[f] = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`\\])\/\/.*$/gm, '$1');
    // Top-level functions, and the globals a file hangs on window or
    // globalThis, which is how the Data view reaches review.js's builders.
    // A name with no capital or underscore is skipped: Fund balance and Spend
    // say `transform` as a CSS property, which is not transform.js's function.
    for (const d of raw.matchAll(/^(?:async\s+)?function\s+(\w+)\s*\(|^(?:window|globalThis)\.(\w+)\s*=/gm)) {
      const name = d[1] || d[2];
      if (/[A-Z_]/.test(name) && !defines.has(name)) defines.set(name, f);
    }
  }
  // A view's files: the one defining its RENDER function, then every sibling
  // whose top-level names that file REFERENCES, transitively. A reference, not
  // a call: Funding picks mountRequestsTab or mountNotesTab into a variable and
  // calls that. app.html is left out on purpose: it defines the helpers every
  // view shares, so naming it on every row would say nothing about any of them.
  const closure = (file) => {
    const seen = new Set([file]); const q = [file];
    while (q.length) {
      const f = q.shift();
      for (const [name, def] of defines) {
        if (seen.has(def)) continue;
        if (new RegExp(`\\b${name}\\b`).test(src[f])) { seen.add(def); q.push(def); }
      }
    }
    return [...seen].map(f => `${vdir}/${f}`);
  };

  const meta = Object.fromEntries(csv('home', `${BD}/data/design/views.csv`).map(r => [r.view, r]));
  const tabsBy = {};
  for (const t of csv('home', `${BD}/data/design/view-tabs.csv`)) {
    if (t.control === 'switch') continue;
    (tabsBy[t.view] ||= []).push(t);
  }
  for (const { key, text } of entries) {
    const em = text.match(/embed:\s*\{\s*repo:\s*"([^"]+)",\s*path:\s*"([^"]+)"/);
    const label = meta[key]?.title || key;
    const base = { repo: 'home', host: 'budget-drs app', group: meta[key]?.kind || '', view: key, address: `#view=${key}` };
    if (em) {
      const [ownerRepo, p] = [em[1].split('/')[1], em[2]];
      framed.set(`${ownerRepo}:${p}`, key);
      const reach = has(ownerRepo, p);
      add({ ...base, repo: ownerRepo, unit: `${ownerRepo}:${p}`, kind: 'framed page', tab: '', label,
        app_ring: 2, ring_basis: `VIEWS.${key}.embed in ${bdApp}`, files: p,
        reachable: reach ? 'yes' : 'not checked out', attribution: reach ? 'declared' : 'none' });
      continue;
    }
    const fn = RENDER[key];
    const own = fn && defines.has(fn) ? closure(defines.get(fn)) : [];
    const files = own.join(';');
    const attribution = own.length ? 'derived' : 'shell';
    const ring = { app_ring: 1, ring_basis: `VIEWS.${key} in ${bdApp}, promoted by home` };
    const tabs = tabsBy[key] || [];
    if (!tabs.length) {
      add({ ...base, ...ring, unit: `home:budget-drs/${key}`, kind: 'view', tab: '', label,
        files: files || bdApp, attribution });
      continue;
    }
    for (const t of tabs) add({ ...base, ...ring, unit: `home:budget-drs/${key}/${t.tab}`, kind: 'tab',
      tab: t.tab, label: `${label}: ${t.tab}`, files: files || bdApp, attribution: 'shared' });
  }
}

// ── Pages: promoted (1), framed (2, above), gallery or unlisted (3), demos (4) ─
const DEMO_TOPS = new Set(['demos', 'kit-demos', 'drop', 'scratch']);
const seenPage = new Set(units.filter(u => u.kind === 'framed page').map(u => u.unit));
const addPage = (repo, p, ring, basis, label) => {
  const k = `${repo}:${p}`;
  if (seenPage.has(k)) return; seenPage.add(k);
  add({ repo, unit: k, kind: 'page', tab: '', group: '', view: '', label, address: p,
    host: ring === 1 ? 'Web Tools app' : '', app_ring: ring, ring_basis: basis, files: p,
    reachable: has(repo, p) ? 'yes' : 'not checked out', attribution: has(repo, p) ? 'declared' : 'none' });
};
for (const [k, by] of promoted) {
  const [repo, p] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
  // The budget-drs app is the HOST of ring 1 views, enumerated above; its own
  // row is the frame: header, sidebar, the panes they share.
  addPage(repo, p, 1, `appView in ${by.map(b => `${b.by}/.web-tools.json`).join(', ')}`, by[0].title);
}
for (const r of csv('web-tools', 'pages/pages.csv')) {
  const p = r.href.startsWith('../') ? path.normalize(path.join('pages', r.href)) : `pages/${r.href}`;
  if (!p.endsWith('.html')) continue;
  const demo = DEMO_TOPS.has(r.top);
  addPage('web-tools', p, demo ? 4 : 3, `pages/pages.csv top=${r.top}`, r.title || r.label);
}
for (const [k, by] of listed) {
  const [repo, p] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
  addPage(repo, p, 3, `pages[] in ${by.map(b => `${b.by}/.web-tools.json`).join(', ')}`, by[0].title);
}
// Pages on disk that no declaration names. Ring 3 by default, since a page that
// exists is reachable by address; listed=no says nothing claimed it.
const walk = (repo, dir, out = []) => {
  const abs = path.join(checkout(repo), dir);
  if (!existsSync(abs)) return out;
  for (const e of readdirSync(abs)) {
    const rel = path.join(dir, e);
    if (/node_modules|thumbs|renditions|source-docs|\/data\/source/.test(rel)) continue;
    const st = statSync(path.join(checkout(repo), rel));
    if (st.isDirectory()) walk(repo, rel, out);
    else if (e.endsWith('.html')) out.push(rel);
  }
  return out;
};
for (const p of walk('web-tools', 'pages')) {
  const demo = /^pages\/(demos|drop|scratch)\//.test(p);
  addPage('web-tools', p, demo ? 4 : 3, 'on disk, in no declaration', path.basename(p, '.html'));
}
if (has('home', BD)) for (const p of walk('home', `${BD}/app`)) {
  if (p === bdApp) continue;
  addPage('home', p, 3, 'on disk, in no declaration', p.split('/').slice(-2).join('/'));
}
for (const u of units) if (u.ring_basis === 'on disk, in no declaration') u.listed = 'no';
for (const u of units) u.listed ??= 'yes';

// ── Pass 1: signals per file ─────────────────────────────────────────────────
const SIG = {
  deck_open: /swipeDeck\.open\s*\(/g,
  deck_core: /swipeDeck\.core\s*\(|\bkit\.core\s*\(/g,
  deck_drill: /swipeDeck\.drill\s*\(/g,
  deck_entry: /swipeDeck\.entry\s*\(|ph-cards-three/g,
  record_deck: /recordDeck\.(open|fromGrid)\s*\(/g,
  file_deck: /fileDeck\.(open|jumpTo)\s*\(/g,
  dock_split: /dockSplit\s*\(|dockSplit\.\w+\s*\(/g,
  source_peek: /\bx-blob\b|data-peek\b/g,
  land: /\bLand\.\w+\s*\(|\bland\s*\(/g,
  row_menu: /rowMenu\.\w+\s*\(|kits\/row-menu\.js/g,
  sheet_modal: /sheetModal|sheet-modal/g,
  title_tip: /data-title-tip|TitleTip\./g,
  panel_tip: /data-panel-tip|PanelTip\./g,
  tabulator: /new\s+Tabulator\s*\(/g,
  viewer: /x-data="viewer|viewer\(\{|ViewRegistry\./g,
  daisy_modal: /modal-box|<dialog\b/g,
  tablist: /role="tablist"|class="[^"]*\btabs\b/g,
  alpine_xdata: /\bx-data\b/g,
  inner_html: /\.innerHTML\s*=/g,
};
const HAND = {
  hand_snap: /scroll-snap-type|snap-x|snap-mandatory/,
  hand_divider: /col-resize|row-resize/,
  hand_overlay: /fixed\s+inset-0|position:\s*fixed;\s*inset:\s*0/,
};
// Which kits a file pulls in, by name: a gh.load path (`kits/swipe-deck.js`) or
// a bare filename in a loader call, which is how budget-drs reaches record-deck
// (`__loadKit("record-deck.js")`, then row-menu opens the deck). A call count
// alone missed that route entirely.
const KIT_NAMES = new Set(readdirSync(path.join(HUB, 'lib/kits')).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)));
const kitsIn = (text) => [...new Set([...text.matchAll(/["'\/]([\w-]+)\.js\b/g)].map(x => x[1]).filter(n => KIT_NAMES.has(n)))].sort();
const fileRows = new Map();
const scan = (repo, p) => {
  const k = `${repo}:${p}`;
  if (fileRows.has(k) || !has(repo, p)) return;
  const text = read(repo, p);
  const row = { file: k, repo, lines: text.split('\n').length };
  for (const [name, re] of Object.entries(SIG)) row[name] = (text.match(re) || []).length;
  row.kits = kitsIn(text).join(';');
  const usesDeck = row.deck_open + row.deck_core + row.deck_drill + row.record_deck + row.file_deck > 0;
  // Snap CSS of a file's own means an inline track: open(), drill() and the
  // deck kits bring their own. So only core() excuses it. The pilot found the
  // branch page's files swiper hand-built in a file that also calls
  // fileDeck.open, which an any-deck-call rule had passed as clean.
  row.hand_snap = HAND.hand_snap.test(text) && !row.deck_core ? 'yes' : '';
  row.hand_divider = HAND.hand_divider.test(text) && !row.dock_split ? 'yes' : '';
  row.hand_overlay = HAND.hand_overlay.test(text) && !usesDeck && !row.daisy_modal ? 'yes' : '';
  fileRows.set(k, row);
};
for (const u of units) for (const f of (u.files || '').split(';').filter(Boolean)) scan(u.repo, f);
// The shared surfaces every unit of an app sits inside are scanned too, so the
// census can say what the chrome itself is built from.
scan('web-tools', 'app/index.html');
for (const f of readdirSync(path.join(HUB, 'lib/alpineComponents'))) if (f.endsWith('.js')) scan('web-tools', `lib/alpineComponents/${f}`);
if (has('home', bdApp)) scan('home', bdApp);

// Unit-level totals, summed over the unit's files. A shared file's counts land
// on every unit it serves, which is why `attribution` rides beside them.
const SUM = ['deck_open', 'deck_core', 'deck_drill', 'deck_entry', 'record_deck', 'file_deck', 'dock_split',
  'source_peek', 'tabulator', 'alpine_xdata', 'inner_html'];
for (const u of units) {
  const rows = (u.files || '').split(';').filter(Boolean).map(f => fileRows.get(`${u.repo}:${f}`)).filter(Boolean);
  for (const s of SUM) u[s] = rows.length ? rows.reduce((a, r) => a + r[s], 0) : '';
  u.kits = [...new Set(rows.flatMap(r => r.kits ? r.kits.split(';') : []))].sort().join(';');
  u.hand = [...new Set(rows.flatMap(r => ['hand_snap', 'hand_divider', 'hand_overlay'].filter(h => r[h]).map(h => h.slice(5))))].join(';');
}

const UNIT_COLS = ['unit', 'repo', 'app_ring', 'ring_basis', 'host', 'kind', 'group', 'view', 'tab', 'label',
  'address', 'files', 'attribution', 'listed', 'reachable', ...SUM, 'kits', 'hand'];
const FILE_COLS = ['file', 'repo', 'lines', ...Object.keys(SIG), 'kits', 'hand_snap', 'hand_divider', 'hand_overlay'];
const order = (a, b) => a.app_ring - b.app_ring || a.repo.localeCompare(b.repo) || a.unit.localeCompare(b.unit);
units.sort(order);
const files = [...fileRows.values()].sort((a, b) => a.file.localeCompare(b.file));

const byRing = {};
for (const u of units) byRing[u.app_ring] = (byRing[u.app_ring] || 0) + 1;
console.log(`${units.length} units; by ring ${JSON.stringify(byRing)}; ${files.length} files scanned`);
for (const r of [...new Set(units.map(u => u.repo))]) console.log(`  ${r}: ${units.filter(u => u.repo === r).length} units`);

if (WRITE) {
  // Two stores, one per visibility. Public rows go to this repo's data/; every
  // private row goes to home's, including a page framed by the budget-drs app
  // from a repo not checked out here, since home's own VIEWS already names it.
  // Units of any other repo (shortcut-tools' own pages) are counted above and
  // written nowhere: the census covers the two apps, not every estate page.
  const WRITE_TO = { public: path.join(HUB, 'data/ui-census'), home: path.join(checkout('home'), 'data/ui-census') };
  const destOf = (row) => PUBLIC.has(row.repo) ? WRITE_TO.public
    : (row.repo === 'home' || row.host === 'budget-drs app') ? WRITE_TO.home : null;
  const groups = new Map();
  const put = (row, k) => { const d = destOf(row); if (!d) return; (groups.get(d) || groups.set(d, { u: [], f: [] }).get(d))[k].push(row); };
  for (const u of units) put(u, 'u');
  for (const f of files) put(f, 'f');
  for (const [d, g] of groups) {
    if (!existsSync(path.dirname(d))) continue;
    mkdirSync(d, { recursive: true });
    writeFileSync(path.join(d, `${DATE}-units.csv`), writeCsv(g.u, UNIT_COLS));
    writeFileSync(path.join(d, `${DATE}-signals.csv`), writeCsv(g.f, FILE_COLS));
    console.log(`wrote ${g.u.length} units, ${g.f.length} files -> ${path.relative(ESTATE, d)}`);
  }
  const stamp = Object.fromEntries(repos.map(r => [r, sha(r)]));
  console.log('source commits', JSON.stringify(stamp));
}
