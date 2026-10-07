// The page-measures pass: numbers read off a settled page, for
// `screenshot.mjs --measure`. No model call and no judgment, so it costs about
// 0.7 seconds a page and reads the same every run.
//
// Each measure answers a failure this repo has recorded or a house-style rule
// (skills/html-style/SKILL.md), and none of them is a verdict. A dense working
// surface legitimately runs more type sizes than a deck; an empty table may be
// waiting on data the render could not reach. The report says what it saw;
// skills/screenshot-review/SKILL.md is where a person or a reader decides.
//
// Two measures were cut from the prototype after a sweep of every page
// (2026-10-06). "Elements past the right edge" fired on 30 of 38 pages, nearly
// all clipped or inside a scroll container, so `wide` now counts only the
// outermost element that runs off with no clipping or scrolling ancestor: the
// culprit behind an overflow, or content cut off where the root hides it. And
// "stat cards" matched a plain `<span class="stat">` on word-select, so it now
// reads daisyUI's own `stats` and `stat-value`, the two classes rule 1 names.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const PHONE = { width: 390, height: 844 };

// Runs in the page. Self-contained: page.evaluate serializes the function.
function probeDom() {
  const shown = el => el.checkVisibility({ visibilityProperty: true });
  const all = [...document.querySelectorAll('body *')].filter(shown);
  const ownText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
    (typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const doc = document.documentElement, W = innerWidth;

  // Runs off the right edge with nothing between it and the root to clip or
  // scroll it. Outermost only, so one wide row is one finding, not forty.
  const contained = el => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement)
      if (getComputedStyle(a).overflowX !== 'visible') return true;
    return false;
  };
  const off = new Set(all.filter(el => { const r = el.getBoundingClientRect();
    return r.width && r.left < W - 1 && r.right > W + 1 && !contained(el); }));
  const wide = [...off].filter(el => { for (let a = el.parentElement; a; a = a.parentElement) if (off.has(a)) return false; return true; });

  // A Phosphor name the font does not carry draws a blank
  // (snags: phosphor-weight-is-a-family); here at run time, after templating.
  // Read off the glyph, not the box: Phosphor draws in ::before, and an icon
  // that is a flex item stretches to full width with no glyph in it at all.
  const blankIcons = all.filter(el => el.tagName === 'I' && /(^|\s)ph-[\w-]+/.test(el.className) &&
    !/^["'].+["']$/.test(getComputedStyle(el, '::before').content));
  // Header cells and no body rows (snags: cross-repo-data-invisible-to-the-render).
  const emptyTables = all.filter(el => el.tagName === 'TABLE' && el.querySelector('th') && !el.querySelector('tbody tr'));

  // Type actually applied, weighted by characters. A browser-default serif means
  // the design system never reached that text.
  const sizes = {}, serif = [];
  let serifChars = 0;
  for (const el of all.filter(ownText)) {
    const cs = getComputedStyle(el);
    const chars = [...el.childNodes].filter(n => n.nodeType === 3).reduce((s, n) => s + n.textContent.trim().length, 0);
    sizes[cs.fontSize] = (sizes[cs.fontSize] || 0) + chars;
    if (/^["']?(times new roman|times|serif)["']?$/i.test(cs.fontFamily.split(',')[0].trim())) { serifChars += chars; serif.push(el); }
  }
  // The typography plugin missing: prose headings no bigger than prose text
  // (snags: headless-shot-prose-flat).
  const flatProse = [...document.querySelectorAll('.prose')].filter(shown).filter(p => {
    const h = p.querySelector('h1,h2,h3'), t = p.querySelector('p');
    return h && t && parseFloat(getComputedStyle(h).fontSize) <= parseFloat(getComputedStyle(t).fontSize);
  });
  const statCards = all.filter(el => el.matches('.stats, .stat-value'));           // html-style rule 1
  const daisyTips = all.filter(el => el.matches('.tooltip, [data-tip]'));          // html-style rule 11

  const sample = els => els.slice(0, 2).map(name);
  return {
    overflowPx: Math.max(0, doc.scrollWidth - doc.clientWidth),
    wide: wide.length, wideAt: sample(wide),
    blankIcons: blankIcons.length, blankIconsAt: sample(blankIcons),
    emptyTables: emptyTables.length, emptyTablesAt: sample(emptyTables),
    serifChars, serifAt: sample(serif),
    flatProse: flatProse.length,
    statCards: statCards.length, statCardsAt: sample(statCards),
    daisyTips: daisyTips.length,
    typeSizes: Object.keys(sizes).length,
    smallestPx: Object.keys(sizes).length ? Math.min(...Object.keys(sizes).map(parseFloat)) : null,
  };
}

// Runs in a blank scratch page: compares two PNGs in a canvas, so no image
// library is needed. `flatPct` is the share of 10px tiles that are one colour,
// the signature of an empty pane (snags: app-frame-outruns-the-inliner).
async function probePixels([before, after]) {
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const pixels = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
  const b = pixels(await load(after)), w = b.width, d = b.data;
  const near = (i, j, tol) => Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]) <= tol;
  let flat = 0, tiles = 0;
  for (let ty = 0; ty + 10 <= b.height; ty += 10) for (let tx = 0; tx + 10 <= w; tx += 10) {
    tiles++; const o = (ty * w + tx) * 4; let same = true;
    for (let y = 0; y < 10 && same; y++) for (let x = 0; x < 10 && same; x++) same = near(((ty + y) * w + tx + x) * 4, o, 6);
    if (same) flat++;
  }
  const out = { flatPct: +(100 * flat / tiles).toFixed(1) };
  if (!before) return out;
  const a = pixels(await load(before));
  if (a.width !== w || a.height !== b.height) return { ...out, thumb: `size ${a.width}x${a.height}, shot ${w}x${b.height}` };
  let n = 0, x0 = w, y0 = b.height, x1 = -1, y1 = -1;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(a.data[i] - d[i]) + Math.abs(a.data[i + 1] - d[i + 1]) + Math.abs(a.data[i + 2] - d[i + 2]) > 24) {
      n++; const p = i / 4, x = p % w, y = (p / w) | 0;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  return { ...out, changedPct: +(100 * n / (w * b.height)).toFixed(2), changedBox: n ? [x0, y0, x1, y1] : null };
}

// The committed thumbnail a page's shot is compared with, mirroring
// node/build/pages-shots.mjs: pages/<p>.png, kit demos under kit-demos/.
export function thumbFor(repoRoot, pagePath) {
  const rel = pagePath.split(path.sep).join('/');
  const key = rel.startsWith('pages/') ? rel.slice(6) : rel.startsWith('lib/kits/demos/') ? 'kit-demos/' + rel.slice(15) : null;
  const fp = key && path.join(repoRoot, 'pages', 'thumbs', key.replace(/\.html$/, '.png'));
  return fp && existsSync(fp) ? fp : null;
}

// Desktop first, on the page as shot; then the phone width, with its own PNG;
// then the viewport is put back so a caller's later steps see what they expect.
export async function measure(page, { repoRoot, pagePath, pngPath, phonePng }) {
  const t0 = Date.now();
  const desktop = await page.evaluate(probeDom);
  const thumb = thumbFor(repoRoot, pagePath);
  const uri = async f => 'data:image/png;base64,' + (await readFile(f)).toString('base64');
  const scratch = await page.context().newPage();
  const pixels = await scratch.evaluate(probePixels, [thumb && await uri(thumb), await uri(pngPath)]);
  await scratch.close();
  if (thumb) pixels.thumbPath = path.relative(repoRoot, thumb);

  const vp = page.viewportSize();
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(400);
  const phone = await page.evaluate(probeDom);
  if (phonePng) await page.screenshot({ path: phonePng });
  await page.setViewportSize(vp);
  return { page: pagePath, viewport: vp, desktop, phone, pixels, ms: Date.now() - t0 };
}

// One line per measure that found something, for the shot log and the report.
export function findings(m) {
  const out = [];
  const at = list => list && list.length ? ` (${list.join(', ')})` : '';
  for (const [view, r] of [['phone', m.phone], ['desktop', m.desktop]]) {
    if (r.overflowPx) out.push(`${view}: scrolls sideways by ${r.overflowPx}px`);
    if (r.wide) out.push(`${view}: ${r.wide} element(s) run past the right edge${at(r.wideAt)}`);
  }
  const d = m.desktop;
  if (d.blankIcons) out.push(`${d.blankIcons} blank icon(s)${at(d.blankIconsAt)}`);
  if (d.emptyTables) out.push(`${d.emptyTables} table(s) with headers and no rows${at(d.emptyTablesAt)}`);
  if (d.serifChars) out.push(`${d.serifChars} characters in the browser's default serif${at(d.serifAt)}`);
  if (d.flatProse) out.push(`${d.flatProse} prose block(s) with headings no bigger than text`);
  if (d.statCards) out.push(`${d.statCards} daisyUI stat element(s)${at(d.statCardsAt)}`);
  if (d.daisyTips) out.push(`${d.daisyTips} daisyUI tooltip(s)`);
  return out;
}

// The rest are signals: read beside the image, never alone.
export function signals(m) {
  const p = m.pixels;
  const thumb = p.thumb ? `thumbnail ${p.thumb}` : p.changedPct === undefined ? 'no thumbnail'
    : `${p.changedPct}% changed from thumbnail` + (p.changedBox ? ` in [${p.changedBox.join(',')}]` : '');
  const type = m.desktop.typeSizes ? `type ${m.desktop.typeSizes} sizes, smallest ${m.desktop.smallestPx}px` : 'no visible text';
  return `${type}; ${p.flatPct}% flat; ${thumb}`;
}
