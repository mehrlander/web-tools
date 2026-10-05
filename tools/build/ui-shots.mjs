#!/usr/bin/env node
// The UI units' screenshots: one desktop and one phone shot of every coded
// unit, as the JPEG thumbnails the Map's UI > Patterns gallery shows.
//
//   node tools/build/ui-shots.mjs [--only <text>] [--jobs N] [--reuse]
//
//   --only   shoot only units whose key contains <text>; their manifest rows are
//            replaced and every other row is kept
//   --jobs   shots taken at once (default 3; each is a headless Chromium)
//   --reuse  re-encode the last full-size shots under tools/.preview/ui-shots/
//            instead of taking new ones, for a change of thumbnail size alone;
//            each shot's focus is kept beside it, so the crop is reused too
//
// The phone thumbnail is the full 390px width, not a reduction: on a phone the
// gallery shows phone shots one to a row, at about the width they were taken.
//
// THE FOCUS. A shot starts where the unit's own content starts, not at the top
// of the window. Above a Map tab sit the app's nav, the Map's thirteen-tab
// strip, its sub-strip and its lede: about 500 of a phone's 844 pixels, the
// same on every Map card, so a card cropped square from the top showed the
// strip and nothing of the tab. The unit's focus names the element its content
// starts at, and the shot is cropped to that element's left edge, width and
// top or bottom, after scrolling it to the top of its pane. A pattern the
// markup declares is the focus wherever there is one; otherwise each host has
// a default (focusOf in ui-recipes.mjs). shots.csv's focus column replaces it
// for one unit, and `none` keeps the whole window. The desktop shot is then
// cut to 16:10 from its top, the shape of the gallery's card; the phone shot
// keeps its whole height, since the card shows its top square and the deck
// shows the rest.
//
// THE PARTS. Where the markup declares a pattern (data/ui-units/codebook.md,
// "Declaring a pattern in markup"), each declared part is outlined and tinted
// in its color from parts.csv before the shot: every item, and one exemplar
// item's anatomy, the selected item taking the stronger tint, so a card shows
// what a list item is, not only that there is a list. thumbs.csv's pattern column names the declared pattern.
//
// THE RECIPE. A unit's address in units.csv says where it is, and for most
// units that is the whole recipe. The rest need a query a bare address cannot
// carry (a project path, a repo), a scenario script with stand-in rows (the
// Activity panes render a token prompt without one), or a click (a stepper with
// no address). Those are
// rows of shots.csv beside each store's coded.csv: unit, query, script, click,
// focus, shot, note. `shot` is `no-script` where the script reads a private
// repository: tools/build/ui-instances.mjs runs it, and the shot does not. A row there replaces the derived query; an empty cell keeps it. A
// query that opens with # is a fragment, for the pages that route on
// location.hash.
//
// THE OUTPUT, split by visibility like the units tables themselves: public
// units' shots go to data/ui-units/thumbs/ here, home's to web-tools-private's
// thumbs/mehrlander/home/ui-units/, the private registry's store for shots of
// private repos' pages. Each folder gets thumbs.csv, one row per unit, which is
// what the gallery reads. Shots are not byte-deterministic, so no commit hook
// owns them: refresh once per session, like pages/thumbs/.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { writeCsv } from './registries-load.mjs';
import { HUB, ESTATE, STORES, rowsOf, slug, codedUnits, focusJs, evalFrom, shoot, needHomeModules } from './ui-recipes.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ONLY = opt('--only', '');
const JOBS = Math.max(1, +opt('--jobs', 3));
const REUSE = args.includes('--reuse');

// The desktop window is taller than the 16:10 it is cut to, so a unit whose
// content starts low still fills the card once the chrome above it is gone.
const DESK = { width: 1280, height: 900, thumb: 800, ratio: 10 / 16 };
const PHONE = { width: 390, height: 844, thumb: 390, ratio: 0 };
const QUALITY = 0.72;
const MANIFEST_COLS = ['unit', 'desk', 'phone', 'shot_at', 'recipe', 'focus', 'pattern'];
const TMP = path.join(HUB, 'tools/.preview/ui-shots');
mkdirSync(TMP, { recursive: true });

// part -> 'r,g,b', from parts.csv, so the shot and the gallery's legend agree.
const PART_RGB = Object.fromEntries(rowsOf(path.join(HUB, 'data/ui-units/parts.csv')).map(p => {
  const h = p.color.replace('#', '');
  return [p.part, [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(',')];
}));

// Outline the parts of every shown declared pattern, and tint only where a tint
// teaches something. Every item is outlined, but an item's own anatomy (title,
// meta, summary, body, links, actions) is drawn on one exemplar only, the
// selected item where there is one and the first otherwise: drawn on every row
// it turned a list into a wall of small boxes, and one item answers "what is an
// item" as well as forty. A group's own parts are drawn on every group.
//
// The tints are the exemplar's anatomy and the group headings, and a faint one
// on a selected item. The list and the detail get a dashed outline and no fill,
// and every other item a thin, faint outline: filled, they washed the whole
// list blue under the anatomy's own colours (owner, 2026-10-05). Outlines and
// inset shadows paint over the page without moving anything in it, so the crop
// measured afterwards is the crop of the page as it lays out.
const drawJs = `(() => {
  const C = ${JSON.stringify(PART_RGB)};
  const ANATOMY = ['title', 'meta', 'summary', 'body', 'links', 'actions'];
  const shown = (e) => e.getClientRects().length > 0;
  const marked = (e) => e.getAttribute('aria-selected') === 'true'
    || ['true', 'page', 'step', 'location'].includes(e.getAttribute('aria-current'));
  for (const root of [...document.querySelectorAll('[data-pattern]')].filter(shown)) {
    const own = [root, ...root.querySelectorAll('[data-part]')]
      .filter((e) => e.dataset.part && C[e.dataset.part] && shown(e) && e.closest('[data-pattern]') === root);
    const items = own.filter((e) => e.dataset.part === 'item');
    const exemplar = items.find(marked) || items[0];
    for (const e of own) {
      const part = e.dataset.part;
      if (ANATOMY.includes(part) && !(exemplar && exemplar.contains(e)) && !e.parentElement?.closest('[data-part="group"]')) continue;
      const box = part === 'list' || part === 'detail';
      const lead = part === 'item' && e === exemplar;
      const fill = box ? 0 : part === 'item' ? (lead && marked(e) ? 0.08 : 0) : 0.1;
      e.style.outline = box ? '2px dashed rgb(' + C[part] + ')'
        : part === 'item' && !lead ? '1px solid rgba(' + C[part] + ',0.45)'
        : '2px solid rgb(' + C[part] + ')';
      e.style.outlineOffset = '-2px';
      if (fill) e.style.boxShadow = 'inset 0 0 0 9999px rgba(' + C[part] + ',' + fill + ')';
    }
  }
})()`;
// The app's live GitHub reads are unauthenticated here, and past the hourly
// limit the app swaps the unit for a token prompt. The answer says so, and a
// shot of the prompt does not replace the unit's last good one.
const shotJs = (focus) => `(async () => { ${drawJs};
  const f = await ${focus ? focusJs(focus) : "'null'"};
  const limited = /API rate limit exceeded/.test(document.body.innerText);
  return f === 'null' ? JSON.stringify(limited ? { limited } : null) : JSON.stringify({ ...JSON.parse(f), limited }); })()`;

// PNG to a JPEG of the given width, drawn in the same headless browser the
// shots came from, since this checkout carries no image library of its own.
// The focus box is in CSS pixels; the shot may be at twice that, so it is
// scaled by the PNG's width over the window's. ratio, when set, cuts the kept
// height to that fraction of the kept width.
async function toJpeg(page, png, size, focus, out) {
  const src = 'data:image/png;base64,' + readFileSync(png).toString('base64');
  const data = await page.evaluate(async ({ src, width, ratio, focus, q }) => {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = src; });
    const k = focus ? img.width / focus.vw : 1;
    const sx = focus ? focus.x * k : 0, sy = focus ? focus.y * k : 0;
    const sw = focus ? Math.min(focus.w * k, img.width - sx) : img.width;
    const sh = Math.min(img.height - sy, ratio ? sw * ratio : Infinity);
    const c = document.createElement('canvas');
    c.width = width; c.height = Math.round(sh * width / sw);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q).split(',')[1];
  }, { src, width: size.thumb, ratio: size.ratio, focus, q: QUALITY });
  writeFileSync(out, Buffer.from(data, 'base64'));
}

needHomeModules();
const work = codedUnits(ONLY);
console.log(`${work.length} units to shoot, ${JOBS} at a time`);

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const resize = await (await browser.newContext()).newPage();
const done = new Map(STORES.map(s => [s.name, []]));
const before = new Map(STORES.flatMap(s => rowsOf(path.join(s.thumbs, 'thumbs.csv')).map(r => [r.unit, r])));
let n = 0;
const worker = async () => {
  for (let w = work.shift(); w; w = work.shift()) {
    const base = slug(w.unit);
    mkdirSync(w.store.thumbs, { recursive: true });
    // A unit whose script reads a private repository is checked with it and
    // shot without it (shots.csv's shot column, `no-script`), so no private
    // row reaches a shot in the public store.
    if (w.r.shot === 'no-script') w.r = { ...w.r, script: '' };
    const row = { unit: w.unit, desk: '', phone: '', shot_at: new Date().toISOString().slice(0, 10),
      recipe: [w.r.page + (w.r.query ? '?' + w.r.query : ''), w.r.script, w.r.click].filter(Boolean).join(' · '),
      focus: '', pattern: '' };
    for (const [kind, size, touch] of [['desk', DESK, false], ['phone', PHONE, true]]) {
      const png = path.join(TMP, `${base}.${kind}.png`);
      const box = png.replace(/\.png$/, '.focus.json');
      let res = { code: 0, err: '', out: '' };
      if (!(REUSE && existsSync(png))) {
        rmSync(png, { force: true });
        res = await shoot(w.r, size, touch, png, shotJs(w.r.focus));
        // One retry: three headless browsers at once, against a rate-limited
        // API, now and then lose a shot that the next attempt takes cleanly.
        if (!existsSync(png)) res = await shoot(w.r, size, touch, png, shotJs(w.r.focus));
        writeFileSync(box, JSON.stringify(evalFrom(res.out)));
      }
      if (!existsSync(png)) { console.log(`  ${w.unit} ${kind}: no shot (${res.code}) ${res.err.split('\n').slice(-2).join(' ').slice(0, 160)}`); continue; }
      const read = existsSync(box) ? JSON.parse(readFileSync(box, 'utf8')) : null;
      if (read?.limited) {
        const old = before.get(w.unit);
        console.log(`  ${w.unit} ${kind}: GitHub's rate limit showed a token prompt; ${old?.[kind] ? 'kept the previous shot' : 'no previous shot to keep'}`);
        row[kind] = old?.[kind] || '';
        if (kind === 'desk' && old) { row.focus = old.focus || ''; row.pattern = old.pattern || ''; row.shot_at = old.shot_at; }
        continue;
      }
      const focus = read?.at ? read : null;
      // A page's only focus is a declared pattern, so its missing one is the norm.
      if (w.r.focus && !focus && !/^top:\[data-pattern="[^"]*"\]$/.test(w.r.focus)) console.log(`  ${w.unit} ${kind}: no focus matched (${w.r.focus}); kept the whole window`);
      const file = `${base}.${kind}.jpg`;
      await toJpeg(resize, png, size, focus, path.join(w.store.thumbs, file));
      row[kind] = file;
      if (kind === 'desk' && focus) { row.focus = `${focus.at} @${focus.y}`; row.pattern = focus.pattern || ''; }
      // The day the shot was TAKEN, which a --reuse run must not move.
      if (kind === 'desk') row.shot_at = statSync(png).mtime.toISOString().slice(0, 10);
    }
    done.get(w.store.name).push(row);
    console.log(`[${++n}] ${w.unit} ${row.desk ? 'desk' : '-'} ${row.phone ? 'phone' : '-'}${row.pattern ? ' declares ' + row.pattern : ''}`);
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
