// A component photographed where the app shows it: for every component whose
// demos file names such a place (docs/components.csv, seen_at), a desktop and
// a phone shot of that address with the component in the picture, and the
// box it occupies there. The Map view's Components tab leads a component's
// Gallery with it.
//
// The unit shots beside these (ui-shots.mjs) are pictures of pages, taken at
// each page's base address and cropped to its pane, and most do not hold the
// component a card is about: of 101 page listings on 2026-11-12, 5 did. A
// shell piece sits outside the crop, a menu is closed, a detail opens on a
// tap. These are pictures of the component instead: the address is the one
// that mounts it, the whole window is kept, and the look kit is asked for
// `component:<name>` first, so the control a closed menu or a slid-away
// sidebar declares (data-at-open) is clicked before the shot.
//
// ONLY PUBLIC DATA IS READABLE while a shot is taken, as for a public unit's
// shot (ui-recipes.mjs, PUBLIC_SIBLINGS): the images are committed to a public
// repository. An address that needs a private repository to mount its
// component (a session open in Sessions) therefore yields no box, and is
// recorded with none and no image rather than shot some other way.
//
// Writes data/ui-units/thumbs/component-<file>.<desk|phone>.jpg and
// component-shots.json beside them:
//
//   { "<file>": { "page": <seen_at>, "shot_at": "YYYY-MM-DD",
//                 "desk":  { "file": "component-<file>.desk.jpg", "box": [x, y, w, h] },
//                 "phone": { "file": "", "box": null, "refused": true } } }
//
// `refused` marks an address the shot could not show because the component
// needed a read the public-only render would not serve.
//
// A box is fractions of the kept image, as overlays.json's are. Not
// byte-deterministic, so no commit hook owns it: `npm run component-shots`,
// once per session at most, with `--only <file>[,<file>]` for some.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { launch } from '../render/chromium.mjs';
import { HUB, rowsOf, head, evalFrom, needHomeModules, PUBLIC_SIBLINGS, toJpeg } from './ui-recipes.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ONLY = opt('--only', '').split(',').filter(Boolean);
const JOBS = Math.max(1, +opt('--jobs', 3));

// The unit shots' image sizes (ui-shots.mjs), with the desktop window opened
// at 16:10 so that nothing is cut from it. A unit shot opens it 900 px tall
// and cuts the bottom 100, which is where a fixed control such as the FAB's
// launcher sits.
const SIZES = { desk: { width: 1280, height: 800, thumb: 800, ratio: 10 / 16, touch: false },
                phone: { width: 390, height: 844, thumb: 390, ratio: 0, touch: true } };
const OUT = path.join(HUB, 'data/ui-units/thumbs');
const TMP = path.join(HUB, 'node/.preview/component-shots');
mkdirSync(TMP, { recursive: true });

// Asked of the page once it has settled: hide the look kit's own marks, so
// the shot is the plain page, and say where the component is. The marks are
// hidden, not stopped: stopping rewrites the address, and the app answers a
// changed address by putting its menus away, which closed the very menu the
// look had opened. `refused` is the render shim's own words in the component
// for a read it would not serve, which is how an address that needs a private
// repository shows up here. No backslash classes: this text reaches the page
// through a command line.
const evalJs = (name) => `(async () => {
  const at = 'component:${name}';
  const L = window.Look;
  for (const e of document.querySelectorAll('[data-look]')) e.style.visibility = 'hidden';
  await new Promise((ok) => setTimeout(ok, 250));
  const el = L && L.find(at);
  const r = el && el.getBoundingClientRect();
  const root = [...document.querySelectorAll('[x-data]')].find((e) => (e.getAttribute('x-data') || '').trim().indexOf('${name}') === 0);
  const refused = !!root && root.innerText.indexOf('live API off') >= 0;
  const limited = /API rate limit exceeded/.test(document.body.innerText);
  return JSON.stringify({ box: r && r.width * r.height > 1 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null,
    vw: innerWidth, vh: innerHeight, limited, refused }); })()`;

const run = (argv, env) => new Promise((resolve) => {
  const p = spawn('node', argv, { cwd: HUB, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => resolve({ code, out, err }));
});

// The box as fractions of the kept image, cut to it; null where the kept
// image holds none of it.
function fit(read, size) {
  if (!read?.box || !read.vw) return null;
  const fw = read.vw, fh = Math.min(read.vh, size.ratio ? fw * size.ratio : Infinity);
  const b = read.box;
  const x0 = Math.max(b.x, 0), y0 = Math.max(b.y, 0), x1 = Math.min(b.x + b.w, fw), y1 = Math.min(b.y + b.h, fh);
  // Eight pixels either way at the least: a menu caught closing is a line.
  if (x1 - x0 < 8 || y1 - y0 < 8) return null;
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  return [r4(x0 / fw), r4(y0 / fh), r4((x1 - x0) / fw), r4((y1 - y0) / fh)];
}

needHomeModules();
const work = rowsOf(path.join(HUB, 'docs/components.csv')).filter(c => c.seen_at)
  .map(c => ({ file: path.posix.basename(c.path, '.js'), name: c.names.split(';')[0], at: c.seen_at }))
  .filter(c => !ONLY.length || ONLY.includes(c.file));
console.log(`${work.length} components to shoot, ${JOBS} at a time`);

const browser = await launch({ args: ['--no-sandbox'] });
const resize = await (await browser.newContext()).newPage();
const store = path.join(OUT, 'component-shots.json');
const all = existsSync(store) ? JSON.parse(readFileSync(store, 'utf8')) : {};
const today = new Date().toISOString().slice(0, 10);

const worker = async () => {
  for (let w = work.shift(); w; w = work.shift()) {
    const [, page, query = '', frag = ''] = w.at.match(/^([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/);
    const row = { page: w.at, shot_at: today };
    for (const [kind, size] of Object.entries(SIZES)) {
      const png = path.join(TMP, `${w.file}.${kind}.png`);
      rmSync(png, { force: true });
      const a = ['node/render/screenshot.mjs', page, '--width', String(size.width), '--height', String(size.height),
        '--wait', '9000', '--out', png, '--hash', (frag ? frag + '&' : '') + 'show=component:' + w.name, '--eval', evalJs(w.name)];
      if (page === 'app/index.html' && !process.env.UI_WORKTREE) a.push('--ref', head);
      if (query) a.push('--query', query);
      if (size.touch) a.push('--touch');
      const env = { ...process.env, SHOT_NO_LIVE_API: '1', SHOT_SIBLINGS: PUBLIC_SIBLINGS.join(',') };
      let res = await run(a, env);
      if (!existsSync(png)) res = await run(a, env);
      const read = evalFrom(res.out);
      const box = existsSync(png) && !read?.limited && !read?.refused ? fit(read, size) : null;
      const file = `component-${w.file}.${kind}.jpg`;
      // An image only where the component is in it.
      if (box) await toJpeg(resize, png, size, null, path.join(OUT, file));
      else rmSync(path.join(OUT, file), { force: true });
      row[kind] = { file: box ? file : '', box, ...(read?.refused ? { refused: true } : {}) };
    }
    all[w.file] = row;
    console.log(`${w.file}: desk ${row.desk.box ? 'shown' : 'not shown'}, phone ${row.phone.box ? 'shown' : 'not shown'}`);
  }
};
await Promise.all(Array.from({ length: JOBS }, worker));
await browser.close();
writeFileSync(store, JSON.stringify(Object.fromEntries(Object.keys(all).sort().map(k => [k, all[k]])), null, 1) + '\n');
console.log(`${Object.keys(all).length} in ${path.relative(HUB, store)}`);
