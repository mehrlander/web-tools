#!/usr/bin/env node
// The pages map: every page a catalogue in the estate names, with the facts
// that can be measured about it, written to pages.csv beside this file, and
// the blocks of pages.md between its pages-map markers: the counts, and the
// meanings of the app and standing values, which docs/vocabularies.csv owns.
//
//   node programs/organization/current/pages-map.mjs          writes both
//   node programs/organization/current/pages-map.mjs --check  exit 1 if either is stale,
//                                                             or page-jobs.csv is out of step
//
// Inputs, all read at run time:
//   - pages/pages.csv, docs/tools.csv, data/ui-units/coded.csv, docs/forms/README.md
//     and docs/app-routes.csv in this checkout;
//   - every repo's .web-tools.json, from web-tools-private's state/configs.json
//     (the app's crawl), found beside this checkout or at --private <dir>;
//   - which repos are public, from GitHub's repository search (no token needed);
//   - the source of each page in a public repo, from this checkout or a clone
//     of that repo beside it (<parent>/<repo> or <parent>/<owner>/<repo>).
// A page in a private repo is private by where it lives, so its source is not read.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, writeCsv } from '../../../node/build/registries-load.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const hub = path.resolve(here, '../../..');
const HUB = 'mehrlander/web-tools';
const OWNER = 'mehrlander';
const args = process.argv.slice(2);
const check = args.includes('--check');
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : ''; };
const privateDir = opt('--private') || path.resolve(hub, '..', 'web-tools-private');

const COLS = ['page', 'visibility', 'catalogues', 'declared_by', 'app', 'linked_from', 'names_private'];
const csvAt = p => parseCsv(readFileSync(p, 'utf8'));
// Value sets, in order, with their meanings: docs/vocabularies.csv owns them.
const vocab = csvAt(path.join(hub, 'docs/vocabularies.csv'));
const values = (reg, prop) => vocab.filter(v => v.registry === reg && v.property === prop);
const STANDING = values('page-jobs', 'standing').map(v => v.value);
const BASIS = values('page-jobs', 'basis').map(v => v.value);
const APP = values('pages-map', 'app').map(v => v.value);
const at = (repo, p) => `${repo}:${p}`;
const fail = m => { console.error(m); process.exit(2); };

// ---- the catalogues ----------------------------------------------------------
const pages = new Map();                       // page -> { catalogues:Set, declaredBy:Set, view, full }
const add = (page, cat) => {
  if (!pages.has(page)) pages.set(page, { cats: new Set(), by: new Set(), view: false, full: false });
  if (cat) pages.get(page).cats.add(cat);
  return pages.get(page);
};

for (const r of csvAt(path.join(hub, 'pages/pages.csv'))) {
  add(at(HUB, r.code.replace(`https://github.com/${HUB}/blob/main/`, '')), 'gallery');
}
for (const r of csvAt(path.join(hub, 'docs/tools.csv'))) add(at(HUB, r.path), 'tools');
for (const r of csvAt(path.join(hub, 'data/ui-units/coded.csv'))) {
  const m = r.unit.match(/^web-tools:(pages\/.+\.html)$/);
  if (m) add(at(HUB, m[1]), 'units');
}
const forms = readFileSync(path.join(hub, 'docs/forms/README.md'), 'utf8');
for (const m of new Set(forms.match(/pages\/[\w/.-]+\.html/g))) add(at(HUB, m), 'forms');

const configsPath = path.join(privateDir, 'state/configs.json');
if (!existsSync(configsPath)) fail(`No crawl at ${configsPath}: clone web-tools-private beside this checkout, or pass --private <dir>.`);
const crawl = JSON.parse(readFileSync(configsPath, 'utf8')).repos;
// A manifest path is bare (this repo) or qualified 'owner/repo[@ref]:path'.
const resolve = (repo, p) => { const m = p.match(/^([\w.-]+\/[\w.-]+)(?:@[^:]+)?:(.+)$/); return m ? at(m[1], m[2]) : at(repo, p); };
for (const [repo, v] of Object.entries(crawl)) {
  const c = v.config || {};
  for (const p of c.pages || []) {
    const e = add(resolve(repo, p.path), 'manifest');
    e.by.add(repo.split('/')[1]);
    if (p.fullApp) e.full = true; else if (p.appView) e.view = true;
  }
  for (const pr of c.projects || []) if (pr.landing) {
    const e = add(resolve(repo, pr.landing), 'landing');
    e.by.add(repo.split('/')[1]);
    e.view = true;
  }
}

// ---- visibility --------------------------------------------------------------
const pub = new Set();
try {
  const res = await fetch(`https://api.github.com/search/repositories?q=user:${OWNER}+is:public&per_page=100`);
  const j = await res.json();
  if (!Array.isArray(j.items)) throw new Error(j.message || 'no items');
  j.items.forEach(x => pub.add(x.full_name));
} catch (e) { fail(`Could not read the public repo list from GitHub: ${e.message}`); }
const repoOf = page => page.slice(0, page.indexOf(':'));
const privateRepos = Object.keys(crawl).filter(r => !pub.has(r));

// ---- the app's own code ------------------------------------------------------
const walk = d => readdirSync(d).flatMap(f => {
  const p = path.join(d, f);
  return statSync(p).isDirectory() ? (/(^|\/)(demos|node_modules)$/.test(p) ? [] : walk(p)) : /\.(js|html)$/.test(f) ? [p] : [];
});
// Comment lines are dropped, so a mention in prose does not count as a link.
const codeLines = f => readFileSync(f, 'utf8').split('\n').filter(l => !/^\s*(\/\/|\*|\/\*|<!--)/.test(l)).join('\n');
const appCode = [path.join(hub, 'app/index.html'), ...walk(path.join(hub, 'lib'))].map(f => codeLines(f));
const framed = new Set(csvAt(path.join(hub, 'docs/app-routes.csv'))
  .flatMap(r => r.files.split(';')).filter(f => /\.html$/.test(f) && f !== 'app/index.html').map(f => at(HUB, f)));
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const linkedFrom = page => {
  const repo = repoOf(page), p = page.slice(repo.length + 1);
  // A hub page is named by its path under pages/; another repo's page only
  // with its repo beside it, as the qualified 'owner/repo[@ref]:path' form.
  const re = repo === HUB
    ? new RegExp(`(?<![\\w.-])${esc(p.replace(/^pages\//, ''))}(?![\\w-])`)
    : new RegExp(`${esc(repo.split('/')[1])}(@[^:'"\\s]+)?:${esc(p)}(?![\\w-])`);
  return appCode.filter(src => re.test(src)).length;
};

// ---- sources of public pages -------------------------------------------------
const checkoutOf = repo => {
  if (repo === HUB) return hub;
  const name = repo.split('/')[1];
  return [path.resolve(hub, '..', name), path.resolve(hub, '..', OWNER, name)].find(d => existsSync(path.join(d, '.git'))) || '';
};
const missing = new Set();
const namesPrivate = page => {
  const repo = repoOf(page);
  if (!pub.has(repo)) return '';
  const dir = checkoutOf(repo);
  if (!dir) { missing.add(repo); return ''; }
  const f = path.join(dir, page.slice(repo.length + 1));
  if (!existsSync(f)) return 'missing';
  const src = readFileSync(f, 'utf8');
  const named = privateRepos.filter(r => new RegExp(`${esc(r)}(?![\\w.-])`).test(src)).map(r => r.split('/')[1]);
  return named.length ? named.join(';') : 'none';
};

// ---- the rows ----------------------------------------------------------------
const CAT_ORDER = ['gallery', 'manifest', 'landing', 'tools', 'units', 'forms'];
const rows = [...pages.keys()].sort().map(page => {
  const e = pages.get(page);
  const n = linkedFrom(page);
  const app = e.full ? 'full-app' : e.view ? 'view' : framed.has(page) ? 'framed' : n ? 'linked' : 'standalone';
  return {
    page, visibility: pub.has(repoOf(page)) ? 'public' : 'private',
    catalogues: CAT_ORDER.filter(c => e.cats.has(c)).join(';'),
    declared_by: [...e.by].sort().join(';'), app, linked_from: String(n), names_private: namesPrivate(page),
  };
});
if (missing.size) fail(`No checkout of ${[...missing].join(', ')} beside ${hub}; clone each public repo there to read its pages.`);

// ---- page-jobs.csv: the judged half ------------------------------------------
const jobsPath = path.join(here, 'page-jobs.csv');
const jobs = new Map(existsSync(jobsPath) ? csvAt(jobsPath).map(r => [r.page, r]) : []);
const jobVocab = new Set(csvAt(path.join(hub, 'data/ui-units/codes.csv')).filter(r => r.axis === 'job').map(r => r.code));
const coded = new Map(csvAt(path.join(hub, 'data/ui-units/coded.csv'))
  .filter(r => /^web-tools:pages\//.test(r.unit)).map(r => [at(HUB, r.unit.slice('web-tools:'.length)), r.job]));
const problems = [];
for (const r of rows) {
  const j = jobs.get(r.page);
  if (!j) { problems.push(`page-jobs.csv has no row for ${r.page}`); continue; }
  if (!STANDING.includes(j.standing)) problems.push(`${r.page}: standing '${j.standing}' is not one of ${STANDING.join(', ')}`);
  if (!BASIS.includes(j.basis)) problems.push(`${r.page}: basis '${j.basis}' is not one of ${BASIS.join(', ')}`);
  if (coded.has(r.page) && j.job) problems.push(`${r.page}: coded.csv owns its job; leave job blank`);
  for (const x of (j.job || '').split(';').filter(Boolean)) if (!jobVocab.has(x)) problems.push(`${r.page}: job '${x}' is not in codes.csv`);
  if (!coded.has(r.page) && !j.job && j.standing === 'product') problems.push(`${r.page}: a product page needs a job`);
}
for (const p of jobs.keys()) if (!pages.has(p)) problems.push(`page-jobs.csv names ${p}, which no catalogue names`);
const jobOf = p => coded.get(p) || jobs.get(p)?.job || '';
const isTool = p => jobs.get(p)?.standing === 'product' && jobOf(p).split(';').includes('make');

// ---- the summary pages.md states ---------------------------------------------
const count = f => rows.filter(f).length;
const name = p => p.replace(/^mehrlander\//, '');
// A page's link: its source on GitHub, named by repo and path.
const link = p => `[\`${name(p)}\`](https://github.com/${repoOf(p)}/blob/main/${p.slice(repoOf(p).length + 1)})`;
const tbl = (head, body) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...body.map(b => `| ${b.join(' | ')} |`)].join('\n');
const stOf = p => jobs.get(p)?.standing || '';
const summary = [
  `${rows.length} pages in ${new Set(rows.map(r => repoOf(r.page))).size} repositories; ${count(r => r.visibility === 'public')} in public repositories.`,
  '',
  tbl(['Relation to the app', ...STANDING, 'all'],
    APP.map(a => [a, ...STANDING.map(s => count(r => r.app === a && stOf(r.page) === s)), count(r => r.app === a)])),
  '',
  tbl(['Catalogue', 'pages', 'only here', ...CAT_ORDER],
    CAT_ORDER.map(c => [c, count(r => r.catalogues.split(';').includes(c)), count(r => r.catalogues === c),
      ...CAT_ORDER.map(d => count(r => { const s = r.catalogues.split(';'); return s.includes(c) && s.includes(d); }))])),
  '',
  `Tools (${count(r => isTool(r.page))}): ${rows.filter(r => isTool(r.page)).map(r => link(r.page)).join(', ')}.`,
  '',
  `Public pages that name a private repository (${count(r => r.names_private && !['none', 'missing'].includes(r.names_private))}): ` +
    rows.filter(r => r.names_private && !['none', 'missing'].includes(r.names_private)).map(r => link(r.page)).join(', ') + '.',
].join('\n');

// ---- write or check ----------------------------------------------------------
const csvPath = path.join(here, 'pages.csv');
const mdPath = path.join(here, 'pages.md');
const csvOut = writeCsv(rows, COLS);
const md = existsSync(mdPath) ? readFileSync(mdPath, 'utf8') : '';
// Three generated blocks: the meanings of the app and standing values, and the counts.
const terms = (reg, prop) => tbl(['Value', 'The page'], values(reg, prop).map(v => [v.value, v.gloss]));
const blocks = { map: summary, app: terms('pages-map', 'app'), standing: terms('page-jobs', 'standing') };
const B = k => `<!-- pages-map:${k} -->`, E = k => `<!-- /pages-map:${k} -->`;
const mdOut = Object.entries(blocks).reduce((t, [k, body]) =>
  t.replace(new RegExp(`${esc(B(k))}[\\s\\S]*?${esc(E(k))}`), `${B(k)}\n${body}\n${E(k)}`), md);
if (check) {
  const stale = [];
  if (!existsSync(csvPath) || readFileSync(csvPath, 'utf8') !== csvOut) stale.push('pages.csv');
  const absent = Object.keys(blocks).filter(k => !md.includes(B(k)) || !md.includes(E(k)));
  if (absent.length) problems.push(`pages.md lacks the pages-map block(s): ${absent.join(', ')}`);
  else if (md !== mdOut) stale.push('pages.md (its pages-map blocks)');
  for (const s of stale) problems.push(`${s} is stale: run node programs/organization/current/pages-map.mjs`);
  if (problems.length) { problems.forEach(p => console.error(p)); process.exit(1); }
  console.log(`pages map current: ${rows.length} pages`);
} else {
  writeFileSync(csvPath, csvOut);
  if (mdOut) writeFileSync(mdPath, mdOut);
  problems.forEach(p => console.error(p));
  console.log(`wrote pages.csv: ${rows.length} pages${problems.length ? `; ${problems.length} problems in page-jobs.csv` : ''}`);
}
