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
// THE SLOTS are drawn as described above slotJs below. thumbs.csv's pattern
// column names the declared pattern.
//
// THE RECIPE. A unit's address in units.csv says where it is, and for most
// units that is the whole recipe. The rest need a query a bare address cannot
// carry (a project path, a repo), a scenario script with stand-in rows (the
// Activity panes render a token prompt without one), or a click (a stepper with
// no address). Those are
// rows of shots.csv beside each store's coded.csv: unit, query, script, click,
// focus, shot, region, note. `shot` is `no-script` where the script reads a private
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
import { HUB, ESTATE, STORES, rowsOf, slug, codedUnits, focusJs, evalFrom, shoot, needHomeModules, stageOf, PUBLIC_SIBLINGS } from './ui-recipes.mjs';

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

// The unit's slots, drawn (data/ui-units/codebook.md, "Slots"): each control
// that carries one of its frame codes, and the element that is its body, are
// outlined in their dimension's colour (dimensions.csv) and labelled with the
// code's name (codes.csv), so a shot shows what the unit includes and which
// code each part of it carries. The generic parts of a declared pattern (item,
// title, meta) are no longer drawn: they are the anatomy of one slot, the
// body, and the deck slide lists them.
//
// Outlines paint over the page without moving anything, so the crop measured
// afterwards is the crop of the page as it lays out. The labels are drawn
// last, in a layer fixed over the window, at each slot's place once the crop
// has scrolled, so they cannot move the page either. A figure drawn in a
// same-origin frame (Atlas, Growth) has its controls in the framed page, so
// the frame is drawn into too; a host's frame holds another unit and is not.
const COLOR = Object.fromEntries(rowsOf(path.join(HUB, 'data/ui-units/dimensions.csv')).filter(d => d.color).map(d => [d.dimension, d.color]));
const NAME = Object.fromEntries(rowsOf(path.join(HUB, 'data/ui-units/codes.csv')).map(c => [c.axis + ':' + c.code, c.name]));
const slotJs = (stage, coded) => `
  const SHOWN = (e) => e.getClientRects().length > 0;
  const STAGE = ${JSON.stringify(stage)};
  const IN = (e) => e.ownerDocument !== document || (STAGE.region ? !!e.closest(STAGE.region)
    : STAGE.outside ? !e.parentElement?.closest(STAGE.sel) : !!e.parentElement?.closest(STAGE.sel));
  const DOCS = [document];
  for (const f of document.querySelectorAll('iframe')) {
    if (!IN(f) || !SHOWN(f) || f.dataset.pattern === 'host') continue;
    try { if (f.contentDocument) DOCS.push(f.contentDocument); } catch { /* another origin */ }
  }
  const PATS = [...document.querySelectorAll('[data-pattern]')].filter((e) => IN(e) && SHOWN(e));
  const BODY = PATS.find((e) => e.dataset.pattern === ${JSON.stringify(coded)}) || PATS[0];
  const SLOTS = DOCS.flatMap((d) => [...d.querySelectorAll('[data-slot]')]).filter((e) => IN(e) && SHOWN(e));`;
const drawJs = (stage, coded) => `(() => {
  ${slotJs(stage, coded)}
  const C = ${JSON.stringify(COLOR)};
  for (const e of SLOTS) { e.style.outline = '2px solid ' + C.frame; e.style.outlineOffset = '1px'; }
  if (BODY) { BODY.style.outline = '2px dashed ' + C.body; BODY.style.outlineOffset = '-2px'; }
})()`;
const labelJs = (stage, coded) => `(() => {
  ${slotJs(stage, coded)}
  const C = ${JSON.stringify(COLOR)}, N = ${JSON.stringify(NAME)};
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  const at = (e) => { const r = e.getBoundingClientRect(); const fr = e.ownerDocument.defaultView.frameElement;
    if (!fr || e.ownerDocument === document) return r; const o = fr.getBoundingClientRect();
    return { left: r.left + o.left, top: r.top + o.top }; };
  // Kept inside the crop: a label that would rise above it sits inside its
  // slot's top edge, or at the crop's top where the slot starts above it, and
  // one that would run past the right edge is pulled in.
  const crop = typeof f === 'string' && f !== 'null' ? JSON.parse(f) : { x: 0, y: 0, w: innerWidth };
  document.body.append(layer);
  const tag = (e, text, color) => {
    const r = at(e), t = document.createElement('div');
    t.textContent = text;
    t.style.cssText = 'position:absolute;font:600 11px/1.35 system-ui,sans-serif;color:#fff;padding:1px 6px;border-radius:4px;'
      + 'box-shadow:0 1px 2px rgba(0,0,0,.25);white-space:nowrap;background:' + color;
    layer.append(t);
    let left = Math.min(Math.max(crop.x + 2, r.left), crop.x + crop.w - t.offsetWidth - 2);
    const top = Math.max(2, crop.y + 2, r.top - 9 >= crop.y + 1 ? r.top - 9 : r.top + 2), h = t.offsetHeight;
    // Two slots sharing a top edge (a search box at the top of its body) would
    // stack their labels; the later one moves along to the right.
    for (let hit = true; hit;) {
      hit = false;
      for (const p of placed) if (top < p.top + p.h && p.top < top + h && left < p.right + 4 && p.left < left + t.offsetWidth + 4) { left = p.right + 4; hit = true; }
    }
    t.style.left = Math.max(2, left) + 'px'; t.style.top = top + 'px';
    placed.push({ left, right: left + t.offsetWidth, top, h });
  };
  const placed = [];
  for (const e of SLOTS) tag(e, N[e.dataset.slot] || e.dataset.slot.split(':')[1], C.frame);
  if (BODY) tag(BODY, N['body:' + BODY.dataset.pattern] || BODY.dataset.pattern, C.body);
})()`;
// The app's live GitHub reads are unauthenticated here, and past the hourly
// limit the app swaps the unit for a token prompt. The answer says so, and a
// shot of the prompt does not replace the unit's last good one.
const shotJs = (w) => {
  const stage = { ...stageOf(w.u), region: w.r.region || '' };
  const coded = w.c.body || '';
  return `(async () => { ${drawJs(stage, coded)};
  const f = await ${w.r.focus ? focusJs(w.r.focus, stage, coded) : "'null'"};
  ${labelJs(stage, coded)};
  await new Promise((ok) => setTimeout(ok, 100));
  const limited = /API rate limit exceeded/.test(document.body.innerText);
  return f === 'null' ? JSON.stringify(limited ? { limited } : null) : JSON.stringify({ ...JSON.parse(f), limited }); })()`;
};

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
      // A public unit's shot reads public siblings only (ui-recipes.mjs,
      // PUBLIC_SIBLINGS), whatever its pane asks for.
      const env = w.store.name === 'public' ? { SHOT_SIBLINGS: PUBLIC_SIBLINGS.join(',') } : {};
      if (!(REUSE && existsSync(png))) {
        rmSync(png, { force: true });
        res = await shoot(w.r, size, touch, png, shotJs(w), env);
        // One retry: three headless browsers at once, against a rate-limited
        // API, now and then lose a shot that the next attempt takes cleanly.
        if (!existsSync(png)) res = await shoot(w.r, size, touch, png, shotJs(w), env);
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
