// How a UI unit (a row of data/ui-units/units.csv) is reached headless, shared
// by tools/build/ui-shots.mjs, which shoots each coded unit, and
// tools/build/ui-instances.mjs, which checks the pattern a unit's markup
// declares. Both need the same four things: where the two stores of tables
// are, the recipe a unit's row implies once shots.csv has its say, where the
// unit's own content starts, and the call into whichever render tool serves it.
//
// A unit is shot by the render tool that already knows how to serve it, so
// nothing here adds browser plumbing of its own:
//
//   web-tools units  tools/render/screenshot.mjs, the app at this checkout's
//                    HEAD (--ref) so a tab shows the branch's code
//   home units       home's tools/screenshot.mjs, which answers the budget-drs
//                    app's contents reads from the sibling checkouts; it needs
//                    node_modules in home, linked to this repo's
//
// Both tools take --eval, a JS expression run in the page after its clicks or
// script and before the shot, whose result they print as `eval: <json>`. That
// line is how a caller learns anything about the page it got back.

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './registries-load.mjs';

export const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ESTATE = path.resolve(HUB, '..');
export const HOME = path.join(ESTATE, 'home');
export const PRIVATE = path.join(ESTATE, 'web-tools-private');

// Split by visibility: the public units' tables and shots here, home's tables
// in home and their shots in web-tools-private, the private registry's store
// for shots of private repos' pages.
export const STORES = [
  { name: 'public', tables: path.join(HUB, 'data/ui-units'), thumbs: path.join(HUB, 'data/ui-units/thumbs') },
  { name: 'private', tables: path.join(HOME, 'data/ui-units'), thumbs: path.join(PRIVATE, 'thumbs/mehrlander/home/ui-units') },
];

export const rowsOf = (p) => existsSync(p) ? parseCsv(readFileSync(p, 'utf8')) : [];
export const slug = (unit) => unit.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const tabSlug = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const head = execFileSync('git', ['-C', HUB, 'rev-parse', 'HEAD']).toString().trim();

export function needHomeModules() {
  if (existsSync(path.join(HOME, 'node_modules'))) return;
  console.error(`home has no node_modules; its screenshot tool needs the vendored libs. Link them:\n  ln -s ${path.join(HUB, 'node_modules')} ${path.join(HOME, 'node_modules')}`);
  process.exit(2);
}

// The recipe a unit's own row implies, before shots.csv has its say.
function derive(u) {
  if (u.repo === 'web-tools') {
    if (u.kind === 'page') return { tool: 'wt', page: u.files.split(';')[0], query: '' };
    // A unit reached at two addresses (a route that lands on a tab) is shot at
    // its first, which is its own.
    let q = String(u.address || '').split(' | ')[0].replace(/^\?/, '');
    if (u.group === 'repo') q = q.replace(/^repo=owner\/name/, 'repo=mehrlander/web-tools');
    if (u.group === 'repo' && !/^repo=/.test(q)) q = 'repo=mehrlander/web-tools' + (q ? '&' + q : '');
    return { tool: 'wt', page: 'app/index.html', query: q };
  }
  // A page the app frames from another repo has no file in home's checkout,
  // so it is shot where a reader meets it, in the app's view that frames it.
  if (u.host === 'budget-drs app' && u.kind === 'framed page' && u.repo !== 'home' && u.view)
    return { tool: 'home', page: 'projects/budget-drs/app/view/app.html', query: 'view=' + u.view };
  if (u.host === 'budget-drs app' && u.kind !== 'framed page' && u.view) {
    const q = 'view=' + u.view + (u.tab ? '&tab=' + tabSlug(u.tab) : '');
    return { tool: 'home', page: 'projects/budget-drs/app/view/app.html', query: q };
  }
  return { tool: 'home', page: u.files.split(';')[0], query: '' };
}

// Where a unit's own content starts. A pattern the markup declares comes first
// when it is the unit's coded body: the element carrying data-pattern is then
// the arrangement itself (data/ui-units/codebook.md, "Declaring a pattern in
// markup"). A declared pattern of another code is one the unit contains, such
// as Stage's errands list inside a tool, and is not where the unit starts. Without one, by
// host: the Map draws its tabs' bodies as sections; a repo view's tab sits under
// the view's tab strip; every other view of the Web Tools app starts below the
// app's nav, at <main>. A budget-drs tab sits under the first tab strip inside
// its view's section, beside the app's sidebar; a budget-drs view with no strip
// (Reversions' stepper, Search) starts at that section. A page, framed or not,
// is its own unit and keeps its window unless it declares a pattern.
function focusOf(u, body) {
  const declared = `top:[data-pattern="${body}"]`;
  // The unit's slots first: the shot starts at the topmost of them, so the
  // frame a unit is coded with is in it (data/ui-units/codebook.md, "Slots").
  // The rest is the fallback for a unit that declares none.
  if (u.host === 'Web Tools app' || u.repo === 'web-tools') return `slots || ${focusTail(u, declared)}`;
  return focusTail(u, declared);
}
function focusTail(u, declared) {
  if (u.kind === 'framed page' && u.repo !== 'home') return `${declared} || top:[data-embed-frame] || top:main`;
  if (u.kind === 'page' || u.kind === 'framed page') return declared;
  if (u.host === 'Web Tools app' && u.view === 'map') return `${declared} || top:[data-pane="map"] section || top:main`;
  if (u.host === 'Web Tools app' && u.group === 'repo' && u.kind === 'tab') return `${declared} || below:main [role="tablist"] || top:main`;
  if (u.host === 'Web Tools app') return `${declared} || top:main`;
  return `${declared} || below:section[id^="view-"] [role="tablist"] || top:section[id^="view-"] || top:main`;
}

// Where a unit's slots may sit: the region of the page that is the unit's own.
// The Web Tools app draws every view and tab inside <main>, and the shell, a
// unit of its own, is everything around it with <main> as its body. A
// budget-drs view sits in the app's <main> beside its sidebar. A page is its
// own document. A page the budget-drs app frames from another repo is drawn
// in an iframe the checks cannot read into, so its slots go unread.
export function stageOf(u) {
  if (u.host === 'Web Tools app' && u.kind === 'shell') return { sel: 'main', outside: true };
  if (u.host === 'Web Tools app' && u.kind !== 'page') return { sel: 'main' };
  if (u.kind === 'framed page' && u.repo !== 'home') return { sel: 'body', framed: true };
  if (u.host === 'budget-drs app' && u.kind !== 'framed page') return { sel: 'main' };
  return { sel: 'body' };
}

// Every coded unit that is checked out here, with its recipe: [{ store, unit,
// u (its units.csv row), c (its coded.csv row), r (the recipe) }].
export function codedUnits(only = '') {
  const out = [];
  for (const store of STORES) {
    if (!existsSync(store.tables)) continue;
    const units = Object.fromEntries(rowsOf(path.join(store.tables, 'units.csv')).map(u => [u.unit, u]));
    const over = Object.fromEntries(rowsOf(path.join(store.tables, 'shots.csv')).map(r => [r.unit, r]));
    for (const c of rowsOf(path.join(store.tables, 'coded.csv'))) {
      const u = units[c.unit];
      if (!u || u.reachable !== 'yes' || (only && !c.unit.includes(only))) continue;
      const r = derive(u);
      const o = over[c.unit] || {};
      if (o.query) r.query = o.query;
      if (o.script) r.script = o.script;
      if (o.click) r.click = o.click;
      if (o.shot) r.shot = o.shot;
      // A unit that shares its page with another names the part that is its
      // own (shots.csv, region): the Errands panel and its toggle, not the
      // Stage around them.
      if (o.region) r.region = o.region;
      r.focus = o.focus === 'none' ? '' : (o.focus || focusOf(u, c.body || ''));
      out.push({ store, unit: c.unit, u, c, r });
    }
  }
  return out;
}

// Run in the page by either render tool's --eval, after its clicks or script:
// scroll the focus to the top of its pane, let it settle, and say where it is.
// Alternatives are tried in order, split by ` || `: `top:<selector>` crops at
// the first shown match's top, `below:<selector>` at its bottom, taking its
// width from the match's container, since a strip can be a narrow pill. A bar
// fixed or stuck to the top of the window, outside the focus, can cover the
// line once the focus is scrolled up to it (budget-drs's top bar does at phone
// width), so the focus's pane is scrolled back by what the bar covers and the
// line measured again. A bar is one that ends in the window's top third; a
// full-height fixed layer is not one. The answer names the pattern when the
// focus is a declared one.
//
// A declared root can hold its frame too, a count line, chips or a search box
// above the first group or item, where no tighter element holds the items
// alone (the Pages view, the Skills tab). The frame is coded on its own axis,
// so the crop starts at the root's first shown group or item, keeping the
// root's width.
export const focusJs = (spec, stage = {}, coded = '') => `(async () => {
  const shown = (e) => e.getClientRects().length > 0;
  const STAGE = ${JSON.stringify(stage)};
  const inStage = (e) => STAGE.region ? !!e.closest(STAGE.region)
    : STAGE.outside ? !e.parentElement?.closest(STAGE.sel || 'main') : !!e.parentElement?.closest(STAGE.sel || 'body');
  for (const alt of ${JSON.stringify(spec)}.split(' || ')) {
    // The union of the unit's shown slots and its body: the coded body where
    // one is declared at any depth, else the first shown declaration.
    if (alt.trim() === 'slots') {
      const pats = [...document.querySelectorAll('[data-pattern]')].filter((e) => inStage(e) && shown(e));
      const body = pats.find((e) => e.dataset.pattern === ${JSON.stringify(coded)}) || pats[0];
      const els = [...document.querySelectorAll('[data-slot]')].filter((e) => inStage(e) && shown(e));
      if (body) els.push(body);
      if (!els.length) continue;
      const settle = () => new Promise((ok) => setTimeout(ok, 800));
      const topOf = () => els.reduce((a, e) => e.getBoundingClientRect().top < a.getBoundingClientRect().top ? e : a);
      topOf().scrollIntoView({ block: 'start', behavior: 'instant' });
      // Back off a little where the pane can, so the topmost slot's label,
      // drawn just above its outline, falls inside the shot.
      let up = topOf().parentElement;
      while (up && !(/auto|scroll/.test(getComputedStyle(up).overflowY) && up.scrollHeight > up.clientHeight)) up = up.parentElement;
      (up || document.scrollingElement).scrollTop -= 14;
      await settle();
      const box = () => els.map((e) => e.getBoundingClientRect()).reduce((u, r) => ({
        left: Math.min(u.left, r.left), right: Math.max(u.right, r.right), top: Math.min(u.top, r.top) }),
        { left: Infinity, right: -Infinity, top: Infinity });
      let b = box();
      // A bar fixed or stuck above the union (a header) can cover its top once
      // scrolled there; the union's pane is scrolled back by what it covers.
      const cover = (y) => {
        for (const e of document.querySelectorAll('body *')) {
          const pos = getComputedStyle(e).position;
          if ((pos !== 'fixed' && pos !== 'sticky') || els.some((x) => e.contains(x) || x.contains(e)) || !shown(e)) continue;
          const q = e.getBoundingClientRect();
          if (q.top <= y + 1 && q.bottom > y && q.right > b.left && q.left < b.right && q.bottom < innerHeight / 3) y = q.bottom;
        }
        return y;
      };
      const under = cover(Math.max(0, b.top)) - Math.max(0, b.top);
      if (under > 0) {
        let pane = topOf().parentElement;
        while (pane && !(/auto|scroll/.test(getComputedStyle(pane).overflowY) && pane.scrollHeight > pane.clientHeight)) pane = pane.parentElement;
        (pane || document.scrollingElement).scrollTop -= under;
        await settle();
        b = box();
      }
      const x = Math.max(0, b.left);
      // 12px of headroom for the label on the topmost slot, never reaching
      // above the unit's own region (the app's header sits over <main>).
      const room = document.querySelector(STAGE.region || (STAGE.outside ? 'body' : (STAGE.sel || 'body')));
      const floor = room && room !== document.body ? room.getBoundingClientRect().top : 0;
      return JSON.stringify({ at: 'slots', x: Math.round(x), y: Math.max(0, Math.round(Math.max(floor, b.top - 12))),
                              w: Math.round(Math.min(b.right, innerWidth) - x), vw: innerWidth,
                              pattern: body ? body.getAttribute('data-pattern') : '' });
    }
    const m = /^(top|below):(.+)$/.exec(alt.trim());
    // A declared pattern with no item shown is empty here, and a crop to it
    // would be a blank card; the unit's usual crop shows its empty state.
    const el = m && [...document.querySelectorAll(m[2])].find((e) => shown(e)
      && (!e.hasAttribute('data-pattern') || [...e.querySelectorAll('[data-part="item"]')].some(shown)));
    if (!el) continue;
    const settle = () => new Promise((ok) => setTimeout(ok, 800));
    const below = m[1] === 'below';
    const lead = !below && el.hasAttribute('data-pattern')
      && [...el.querySelectorAll('[data-part="group"], [data-part="item"]')].find(shown);
    const at = lead && lead.getBoundingClientRect().top > el.getBoundingClientRect().top + 1 ? lead : el;
    const line = () => { const r = at.getBoundingClientRect(); return below ? r.bottom : r.top; };
    const box = (below ? el.parentElement : el).getBoundingClientRect();
    const cover = (y) => {
      for (const e of document.querySelectorAll('body *')) {
        const pos = getComputedStyle(e).position;
        if ((pos !== 'fixed' && pos !== 'sticky') || e.contains(el) || el.contains(e) || !shown(e)) continue;
        const q = e.getBoundingClientRect();
        if (q.top <= y + 1 && q.bottom > y && q.right > box.left && q.left < box.right && q.bottom < innerHeight / 3) y = q.bottom;
      }
      return y;
    };
    at.scrollIntoView({ block: 'start', behavior: 'instant' });
    await settle();
    // Clamped, since a scroll can leave the top a fraction of a pixel above the
    // window, where a bar starting at 0 would no longer seem to cover it.
    let y = Math.max(0, line());
    const under = cover(y) - y;
    if (under > 0) {
      let pane = el.parentElement;
      while (pane && !(/auto|scroll/.test(getComputedStyle(pane).overflowY) && pane.scrollHeight > pane.clientHeight)) pane = pane.parentElement;
      (pane || document.scrollingElement).scrollTop -= under;
      await settle();
      y = cover(Math.max(0, line()));
    }
    const x = Math.max(0, box.left);
    return JSON.stringify({ at: alt.trim(), x: Math.round(x), y: Math.max(0, Math.round(y)),
                            w: Math.round(Math.min(box.width, innerWidth - x)), vw: innerWidth,
                            pattern: el.getAttribute('data-pattern') || '' });
  }
  return 'null';
})()`;

// The value a render tool printed: the last `eval: <json>` line of its output.
// Both evals here answer with a JSON string, so it is parsed twice, and it
// prints on one line from both tools, where an object prints across several
// from home's.
export const evalFrom = (out) => {
  const line = String(out || '').split('\n').filter(l => l.startsWith('eval: ')).pop();
  try { return line ? JSON.parse(JSON.parse(line.slice(6))) : null; } catch { return null; }
};

function run(cmd, argv, cwd, env = process.env) {
  return new Promise((resolve) => {
    const p = spawn(cmd, argv, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '', out = '';
    p.stderr.on('data', d => { err += d; });
    p.stdout.on('data', d => { out += d; });
    const t = setTimeout(() => p.kill('SIGKILL'), 150000);
    p.on('close', code => { clearTimeout(t); resolve({ code, err, out }); });
  });
}

// Open a unit at a window size, run evalJs in it, and write the shot to `out`.
export async function shoot(r, size, touch, out, evalJs) {
  if (r.tool === 'wt') {
    // Nine seconds, not six: the scenarios with stand-in rows look the Activity component
    // up the moment the wait ends, and the app's boot came close enough to six
    // that Sessions and Lists sometimes found nothing to fill.
    const a = ['tools/render/screenshot.mjs', r.page, '--width', String(size.width), '--height', String(size.height),
      '--wait', '9000', '--out', out];
    // UI_WORKTREE=1 renders the working tree, for checking markup before it is
    // committed; the published shots and checks render the commit.
    if (r.page === 'app/index.html' && !process.env.UI_WORKTREE) a.push('--ref', head);
    if (r.query && r.query.startsWith('#')) a.push('--hash', r.query.slice(1));
    else if (r.query) a.push('--query', r.query);
    if (r.script) a.push('--script', path.resolve(HUB, r.script));
    if (evalJs) a.push('--eval', evalJs);
    if (touch) a.push('--touch');
    // The live GitHub API off (tools/render/cdn.mjs, SHOT_NO_LIVE_API): the
    // app's own reads are answered locally, and the rest would spend GitHub's
    // hourly allowance within one load and put a token prompt in the shot.
    return run('node', a, HUB, { ...process.env, SHOT_NO_LIVE_API: '1' });
  }
  const target = r.page + (r.query ? '?' + r.query : '');
  const a = ['tools/screenshot.mjs', target, out, '--width', String(size.width), '--height', String(size.height),
    '--no-full', '--wait', '5000'];
  if (r.click) a.push('--click', r.click);
  if (evalJs) a.push('--eval', evalJs);
  if (touch) a.push('--touch');
  return run('node', a, HOME);
}
