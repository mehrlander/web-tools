#!/usr/bin/env node
// The UI census's screenshots: one desktop and one phone shot of every coded
// unit, as the JPEG thumbnails the Map's UI > Patterns gallery shows.
//
//   node tools/build/ui-shots.mjs [--only <text>] [--jobs N]
//
//   --only  shoot only units whose key contains <text>; their manifest rows are
//           replaced and every other row is kept
//   --jobs  shots taken at once (default 3; each is a headless Chromium)
//
// A unit is shot by the render tool that already knows how to serve it, so
// this file adds no browser plumbing of its own beyond the resize:
//
//   web-tools units  tools/render/screenshot.mjs, the app at this checkout's
//                    HEAD (--ref) so a tab shows the branch's code
//   home units       home's tools/screenshot.mjs, which answers the budget-drs
//                    app's contents reads from the sibling checkouts; it needs
//                    node_modules in home, linked to this repo's
//
// THE RECIPE. A unit's address in units.csv says where it is, and for most
// units that is the whole recipe. The rest need a query a bare address cannot
// carry (a project path, a repo), a fixture script (the Activity panes render a
// token prompt without one), or a click (a stepper with no address). Those are
// rows of shots.csv beside each store's coded.csv: unit, query, script, click,
// note. A row there replaces the derived query; an empty cell keeps it.
//
// THE OUTPUT, split by visibility like the census itself: public units' shots
// go to data/ui-census/thumbs/ here, home's to web-tools-private's
// thumbs/mehrlander/home/ui-census/, the private registry's store for shots of
// private repos' pages. Each folder gets thumbs.csv, one row per unit, which is
// what the gallery reads. Shots are not byte-deterministic, so no commit hook
// owns them: refresh once per session, like pages/thumbs/.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { parseCsv, writeCsv } from './registries-load.mjs';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ESTATE = path.resolve(HUB, '..');
const HOME = path.join(ESTATE, 'home');
const PRIVATE = path.join(ESTATE, 'web-tools-private');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ONLY = opt('--only', '');
const JOBS = Math.max(1, +opt('--jobs', 3));

const DESK = { width: 1280, height: 800, thumb: 800 };
const PHONE = { width: 390, height: 844, thumb: 260 };
const QUALITY = 0.72;

const STORES = [
  { name: 'public', census: path.join(HUB, 'data/ui-census'), thumbs: path.join(HUB, 'data/ui-census/thumbs') },
  { name: 'private', census: path.join(HOME, 'data/ui-census'), thumbs: path.join(PRIVATE, 'thumbs/mehrlander/home/ui-census') },
];
const MANIFEST_COLS = ['unit', 'desk', 'phone', 'shot_at', 'recipe'];

const rowsOf = (p) => existsSync(p) ? parseCsv(readFileSync(p, 'utf8')) : [];
const slug = (unit) => unit.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tabSlug = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const head = execFileSync('git', ['-C', HUB, 'rev-parse', 'HEAD']).toString().trim();
const TMP = path.join(HUB, 'tools/.preview/ui-shots');
mkdirSync(TMP, { recursive: true });

// The recipe a unit's own row implies, before shots.csv has its say.
function derive(u) {
  if (u.repo === 'web-tools') {
    if (u.kind === 'page') return { tool: 'wt', page: u.files.split(';')[0], query: '' };
    let q = String(u.address || '').replace(/^\?/, '');
    if (u.group === 'repo') q = q.replace(/^repo=owner\/name/, 'repo=mehrlander/web-tools');
    if (u.group === 'repo' && !/^repo=/.test(q)) q = 'repo=mehrlander/web-tools' + (q ? '&' + q : '');
    return { tool: 'wt', page: 'app/index.html', query: q };
  }
  if (u.host === 'budget-drs app' && u.kind !== 'framed page' && u.view) {
    const q = 'view=' + u.view + (u.tab ? '&tab=' + tabSlug(u.tab) : '');
    return { tool: 'home', page: 'projects/budget-drs/app/view/app.html', query: q };
  }
  return { tool: 'home', page: u.files.split(';')[0], query: '' };
}

function run(cmd, argv, cwd) {
  return new Promise((resolve) => {
    const p = spawn(cmd, argv, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    const t = setTimeout(() => p.kill('SIGKILL'), 150000);
    p.on('close', code => { clearTimeout(t); resolve({ code, err }); });
  });
}

async function shoot(r, size, touch, out) {
  if (r.tool === 'wt') {
    const a = ['tools/render/screenshot.mjs', r.page, '--width', String(size.width), '--height', String(size.height),
      '--wait', '6000', '--out', out];
    if (r.page === 'app/index.html') a.push('--ref', head);
    if (r.query) a.push('--query', r.query);
    if (r.script) a.push('--script', path.resolve(HUB, r.script));
    if (touch) a.push('--touch');
    return run('node', a, HUB);
  }
  const target = r.page + (r.query ? '?' + r.query : '');
  const a = ['tools/screenshot.mjs', target, out, '--width', String(size.width), '--height', String(size.height),
    '--no-full', '--wait', '5000'];
  if (r.click) a.push('--click', r.click);
  if (touch) a.push('--touch');
  return run('node', a, HOME);
}

// PNG to a JPEG of the given width, drawn in the same headless browser the
// shots came from, since this checkout carries no image library of its own.
async function toJpeg(page, png, width, out) {
  const src = 'data:image/png;base64,' + readFileSync(png).toString('base64');
  const data = await page.evaluate(async ({ src, width, q }) => {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = src; });
    const c = document.createElement('canvas');
    c.width = width; c.height = Math.round(img.height * width / img.width);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q).split(',')[1];
  }, { src, width, q: QUALITY });
  writeFileSync(out, Buffer.from(data, 'base64'));
}

if (!existsSync(path.join(HOME, 'node_modules'))) {
  console.error(`home has no node_modules; its screenshot tool needs the vendored libs. Link them:\n  ln -s ${path.join(HUB, 'node_modules')} ${path.join(HOME, 'node_modules')}`);
  process.exit(2);
}

const work = [];
for (const store of STORES) {
  if (!existsSync(store.census)) continue;
  const units = Object.fromEntries(rowsOf(path.join(store.census, 'units.csv')).map(u => [u.unit, u]));
  const over = Object.fromEntries(rowsOf(path.join(store.census, 'shots.csv')).map(r => [r.unit, r]));
  for (const c of rowsOf(path.join(store.census, 'coded.csv'))) {
    const u = units[c.unit];
    if (!u || u.reachable !== 'yes' || (ONLY && !c.unit.includes(ONLY))) continue;
    const r = derive(u);
    const o = over[c.unit] || {};
    if (o.query) r.query = o.query;
    if (o.script) r.script = o.script;
    if (o.click) r.click = o.click;
    work.push({ store, unit: c.unit, r });
  }
}
console.log(`${work.length} units to shoot, ${JOBS} at a time`);

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const resize = await (await browser.newContext()).newPage();
const done = new Map(STORES.map(s => [s.name, []]));
let n = 0;
const worker = async () => {
  for (let w = work.shift(); w; w = work.shift()) {
    const base = slug(w.unit);
    mkdirSync(w.store.thumbs, { recursive: true });
    const row = { unit: w.unit, desk: '', phone: '', shot_at: new Date().toISOString().slice(0, 10),
      recipe: [w.r.page + (w.r.query ? '?' + w.r.query : ''), w.r.script, w.r.click].filter(Boolean).join(' · ') };
    for (const [kind, size, touch] of [['desk', DESK, false], ['phone', PHONE, true]]) {
      const png = path.join(TMP, `${base}.${kind}.png`);
      rmSync(png, { force: true });
      const res = await shoot(w.r, size, touch, png);
      if (!existsSync(png)) { console.log(`  ${w.unit} ${kind}: no shot (${res.code}) ${res.err.split('\n').slice(-2).join(' ').slice(0, 160)}`); continue; }
      const file = `${base}.${kind}.jpg`;
      await toJpeg(resize, png, size.thumb, path.join(w.store.thumbs, file));
      row[kind] = file;
    }
    done.get(w.store.name).push(row);
    console.log(`[${++n}] ${w.unit} ${row.desk ? 'desk' : '-'} ${row.phone ? 'phone' : '-'}`);
  }
};
await Promise.all(Array.from({ length: JOBS }, worker));
await browser.close();

for (const store of STORES) {
  const fresh = done.get(store.name);
  if (!fresh.length) continue;
  const file = path.join(store.thumbs, 'thumbs.csv');
  const keep = rowsOf(file).filter(r => !fresh.some(f => f.unit === r.unit));
  const rows = [...keep, ...fresh].sort((a, b) => a.unit.localeCompare(b.unit));
  writeFileSync(file, writeCsv(rows, MANIFEST_COLS));
  console.log(`${store.name}: ${fresh.length} shot, ${rows.length} in ${path.relative(ESTATE, file)}`);
}
