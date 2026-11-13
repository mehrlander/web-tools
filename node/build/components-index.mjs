// The components registry, docs/components.csv: one row per Alpine component
// file (lib/alpineComponents/*.js), every field derived from the tree.
//
// The kit shelf has had this accounting since 2026-09-05 (kits-index.mjs) and
// the component folder had none: 42 files on 2026-11-11, from a 13-line
// counter to a 16,000-line view, listed nowhere the app could show. This is
// the same registry for the layer beside the kits, which the Map view's
// Components tab renders. It authors nothing. A component says what it is in
// its own `description:` property, the folder's convention, so the one prose
// field here (gloss) is READ OFF that string, and off the file's leading
// comment where a file has no description.
//
// Derived, never authored:
//
//   names      every name the file registers with Alpine.data(), `;`-joined,
//              in file order; x-data mounts a component by one of these
//   gloss      the first sentence of the first `description:` string in the
//              file, else of its leading comment block; blank where neither
//              opens with a sentence
//   lines      file length
//   routes     how many rows of docs/app-routes.csv name the file among their
//              files: above zero, the component draws an app view
//   views      the keys of those rows, `;`-joined: ?view=<key> opens each
//   leads      the views it is the top component of, `;`-joined: among the
//              components a route names, the ones no other of them mounts.
//              The Files route names file-browser, path-picker and viewer;
//              file-browser mounts the other two, so it alone leads Files.
//              A component that leads a view draws that view whole; one a
//              route names without leading is a piece inside it
//   loads      how many other files under lib/, pages/ and app/ name its load
//              path (alpineComponents/<name>.js)
//   mounts     how many other files there mount it: a line that carries
//              x-data and one of its names. A component that draws its own
//              root is loaded and never mounted by name, so the two differ
//   mounted_by those files, `;`-joined
//   pages      the UI units (data/ui-units/units.csv) that show it, `;`-joined:
//              a unit whose files name the component, or name a page that
//              mounts it. A mount inside another component is NOT carried
//              through to that component's units: the viewer mounted in one
//              tab's deck is not on every page that component draws
//              A component that leads a view is on the units whose files
//              name it and no others: the page that mounts it does so for
//              one route, so that page's other units do not show it
//   patterns   how many times the file writes data-pattern, the attribute a
//              page's markup declares its body's arrangement with
//              (data/ui-units/codebook.md, "Declaring a pattern in markup")
//   kits       the kits it names by load path (kits/<name>.js), `;`-joined
//   events     the events it sends: every name handed to $dispatch or to
//              new CustomEvent, `;`-joined
//   options    the keys it reads off the argument its factory takes
//              (`cfg.items`, `const { repo } = opts`), `;`-joined in file
//              order: what a host passes in x-data. A factory whose argument
//              is used whole, never by key, lists the argument's own name
//   hears      the events it listens for by name: an Alpine handler
//              (`@drop-file=`, `x-on:`) or addEventListener, for a name with
//              a hyphen or a colon in it, which a browser's own events never
//              have; `;`-joined
//   codes      the patterns its markup declares, each as `code:count`,
//              `;`-joined: the values of data-pattern, the detail under the
//              patterns count
//   parts      the part names its markup declares (data-part), `;`-joined
//   setups     how many setups are written for it: the
//              <template data-setup> blocks in demos/<file>.html beside the
//              component, which the component stage (demos/index.html) mounts
//   seen_at    where the app shows it for real: the page address its demos
//              file names in a <template data-seen-at> block, from the site's
//              root (app/index.html?view=sessions&session=…). A look link to
//              that page with `component:<name>` lands on it there
//   seen_label    that block's data-seen: a few words on what the address shows
//   tested     its basename appears in a file under node/test/
//
// Run `npm run components-index` to restamp; `--check` compares instead of
// writing.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeCsv, parseCsv } from './registries-load.mjs';
import { headlineOf } from './kits-index.mjs';
import { repoRoot } from '../repo-root.mjs';

// Fixed here so a restamp cannot reorder the file.
export const COMPONENTS_COLS = ['path', 'names', 'gloss', 'lines', 'routes', 'views', 'leads', 'loads', 'mounts', 'mounted_by', 'pages', 'patterns', 'kits', 'events', 'options', 'hears', 'codes', 'parts', 'setups', 'seen_at', 'seen_label', 'tested'];

const GLOSS_MAX = 160;
const read = (root, rel) => readFileSync(path.join(root, rel), 'utf8');
const tracked = (root) => execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);

/** Every name a file hands to Alpine.data(), in file order, once each. */
export function namesOf(src) {
  const out = [];
  for (const m of src.matchAll(/Alpine\.data\(\s*['"]([A-Za-z_$][\w$]*)['"]/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/**
 * What the component says it is: the first sentence of its `description:`
 * string, or of its leading comment. A sentence ends at a period, a colon or
 * a semicolon followed by a space, since most descriptions here open with a
 * name, a colon and then the account, and the name alone says too little.
 */
export function glossOf(src, base) {
  // The first description that says something: a view's template can carry
  // an empty `description: ''` in a form's defaults ahead of the component's.
  let text = '';
  for (const m of src.matchAll(/\bdescription:\s*(['"`])((?:\\.|(?!\1).)*)\1/gs)) {
    text = m[2].replace(/\\(['"`])/g, '$1').replace(/\s+/g, ' ').trim();
    if (text) break;
  }
  // No description: the leading comment, less the `alpineComponents/<file> —`
  // prefix that headlineOf, written for the kit shelf, does not know.
  if (!text) return headlineOf(src, base).replace(/^(?:lib\/)?alpineComponents\/[\w-]+\.js\s*[—:\-]+\s*/i, '');
  const first = text.match(/^(.*?[.!?])(?:\s|$)/);
  text = (first ? first[1] : text).trim();
  if (text.length > GLOSS_MAX) text = text.slice(0, GLOSS_MAX - 1).replace(/\s+\S*$/, '') + '…';
  return text;
}

/**
 * The keys a component reads off its factory's argument, in file order. The
 * argument is the one parameter of the function handed to Alpine.data; a
 * local that is assigned from it (`const cfg = opts || {}`, a spread, an
 * Object.assign) is read as the same thing. A parameter that is never read by
 * key is returned as its own name: the host passes one value, not a bag.
 */
export function optionsOf(src) {
  const out = [];
  const add = k => { if (!out.includes(k)) out.push(k); };
  for (const m of src.matchAll(/Alpine\.data\(\s*['"][\w$]+['"]\s*,\s*(?:async\s+)?(?:function\s*\(\s*([^)]*)\)|\(\s*([^)]*)\)\s*=>)/g)) {
    const p = (m[1] ?? m[2] ?? '').split('=')[0].trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(p)) continue;
    const names = new Set([p]);
    for (const a of src.matchAll(new RegExp('(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:Object\\.assign\\([^;]*?\\b' + p + '\\b[^;]*?\\)|' + p + '\\s*(?:\\|\\||\\?\\?)\\s*\\{\\}|\\{[^;]*?\\.\\.\\.' + p + '\\b[^;]*?\\})', 'g'))) names.add(a[1]);
    const found = [];
    for (const n of names) {
      for (const k of src.matchAll(new RegExp('(?<![\\w.$])' + n + '\\??\\.([A-Za-z_]\\w*)', 'g'))) found.push([k.index, k[1]]);
      for (const d of src.matchAll(new RegExp('(?:const|let)\\s*\\{([^}]*)\\}\\s*=\\s*' + n + '\\b', 'g')))
        for (const k of d[1].split(',')) { const key = k.split(/[:=]/)[0].trim(); if (/^\w+$/.test(key)) found.push([d.index, key]); }
    }
    if (!found.length) add(p);
    for (const [, k] of found.sort((a, b) => a[0] - b[0])) add(k);
  }
  return out;
}

/** The custom events a file listens for by name (a hyphen or a colon in it). */
export function hearsOf(src) {
  const out = new Set();
  // An attribute, not a mention: the name, any modifiers, then `=` and a
  // quote, and no word before the @ (owner/repo@ref:path in a comment).
  for (const m of src.matchAll(/(?<![\w/])(?:@|x-on:)([a-z][a-z0-9]*(?:[-:][a-z0-9]+)+)(?:\.[a-z0-9.-]+)?=["'`\\]/g)) out.add(m[1]);
  for (const m of src.matchAll(/addEventListener\(\s*['"]([a-z][a-z0-9]*(?:[-:][a-z0-9]+)+)['"]/g)) out.add(m[1]);
  out.delete('alpine:init'); out.delete('alpine:initialized');
  return [...out].sort();
}

/**
 * Derive every row.
 * @param {string} root
 * @returns {object[]} rows, sorted by path
 */
export function deriveComponents(root) {
  const files = tracked(root);
  const comps = files.filter(f => /^lib\/alpineComponents\/[\w-]+\.js$/.test(f)).sort();
  const tests = files.filter(f => f.startsWith('node/test/')).map(f => read(root, f)).join('\n');
  // The setups under demos/ mount a component in order to show it. They are
  // not hosts: counting them would make every component with a setup "shared".
  const readers = files.filter(f =>
    (f.startsWith('lib/') || f.startsWith('pages/') || f.startsWith('app/')) && /\.(html|js|mjs)$/.test(f)
    && !f.startsWith('lib/alpineComponents/demos/'));
  const sources = new Map(readers.map(f => [f, read(root, f)]));
  const routes = parseCsv(read(root, 'docs/app-routes.csv'));
  const list = (cell) => String(cell || '').split(';').map(x => x.trim()).filter(Boolean);
  const units = files.includes('data/ui-units/units.csv') ? parseCsv(read(root, 'data/ui-units/units.csv')) : [];
  const uniq = (src, re) => [...new Set([...src.matchAll(re)].map(m => m[1]))].sort();

  const demosOf = (base) => {
    const f = 'lib/alpineComponents/demos/' + base.replace(/\.js$/, '.html');
    return files.includes(f) ? read(root, f).replace(/<!--[\s\S]*?-->/g, '') : '';
  };
  const setupsOf = (base) => (demosOf(base).match(/<template\b[^>]*\bdata-setup=/g) || []).length;
  // The one place the app shows it, where its demos file names one.
  const seenOf = (base) => {
    const tag = (demosOf(base).match(/<template\b[^>]*\bdata-seen-at="[^"]*"[^>]*>/) || [''])[0];
    const attr = (k) => (tag.match(new RegExp('\\b' + k + '="([^"]*)"')) || [])[1] || '';
    return { at: attr('data-seen-at').replace(/&amp;/g, '&'), as: attr('data-seen') };
  };
  const rows = comps.map(rel => {
    const src = sources.get(rel) ?? read(root, rel);
    const base = path.posix.basename(rel);
    const names = namesOf(src);
    // A mount is a line that carries x-data and one of the names as a whole
    // word: `x-data="viewer()"` in a page, and equally a string a script
    // builds (`'x-data', 'sessionBrief(' + …`), which a quote-anchored match
    // would miss.
    const mount = names.length
      ? new RegExp('x-data[^\\n]*\\b(?:' + names.map(n => n.replace(/[$]/g, '\\$&')).join('|') + ')\\b')
      : null;
    const load = 'alpineComponents/' + base;
    let loads = 0;
    const mounters = [];
    for (const [f, text] of sources) {
      if (f === rel) continue;
      if (text.includes(load)) loads++;
      if (mount && mount.test(text)) mounters.push(f);
    }
    const mounts = mounters.length;
    const named = routes.filter(r => list(r.files).includes(rel));
    const code = src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    const codes = new Map();
    for (const m of src.matchAll(/\bdata-pattern="([a-z][\w-]*)"/g)) codes.set(m[1], (codes.get(m[1]) || 0) + 1);
    const shows = new Set([rel, ...mounters.filter(f => f.endsWith('.html'))]);
    return {
      path: rel,
      names: names.join(';'),
      gloss: glossOf(src, base),
      lines: src.split('\n').length,
      routes: named.length,
      views: named.map(r => r.key).join(';'),
      // Filled below, once every row's mounted_by is known.
      leads: '',
      loads,
      mounts,
      mounted_by: mounters.sort().join(';'),
      pages: units.filter(u => list(u.files).some(f => shows.has(f))).map(u => u.unit).join(';'),
      patterns: (src.match(/\bdata-pattern=/g) || []).length,
      kits: uniq(src, /['"`]kits\/([\w-]+)\.js/g).join(';'),
      events: uniq(src, /(?:\$dispatch|new CustomEvent)\(\s*['"`]([\w:.-]+)['"`]/g).join(';'),
      // Read off the code alone: a usage example in a comment line names
      // the events a HOST handles and the keys a host might pass.
      options: optionsOf(code).join(';'),
      hears: hearsOf(code).join(';'),
      codes: [...codes].map(([k, n]) => k + ':' + n).join(';'),
      parts: uniq(src, /\bdata-part="([a-z][\w-]*)"/g).join(';'),
      setups: setupsOf(base),
      seen_at: seenOf(base).at,
      seen_label: seenOf(base).as,
      tested: tests.includes(base) ? 'yes' : 'no',
    };
  });
  // LEADS: a route's top component. Of the components a route names, the ones
  // none of the others mounts.
  const by = new Map(rows.map(r => [r.path, new Set(list(r.mounted_by))]));
  for (const r of rows) {
    r.leads = routes.filter(route => {
      const named = list(route.files).filter(f => by.has(f));
      return named.includes(r.path) && !named.some(f => f !== r.path && by.get(r.path).has(f));
    }).map(route => route.key).join(';');
    // A view's lead is mounted by its page for that route alone (app/index.html
    // mounts tending() at ?view=tending), so the mount says nothing about the
    // page's other units. Measured 2026-11-13: carrying it through listed nine
    // units on each of 12 leads, none of which had the component on screen.
    if (r.leads) r.pages = units.filter(u => list(u.files).includes(r.path)).map(u => u.unit).join(';');
  }
  return rows;
}

// ── CLI: restamp (or --check) docs/components.csv ──────────────────────────

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = path.join(repoRoot, 'docs', 'components.csv');
  const checkOnly = process.argv.includes('--check');
  const rows = deriveComponents(repoRoot);
  const bytes = writeCsv(rows, COMPONENTS_COLS);
  if (checkOnly) {
    let current = null;
    try { current = readFileSync(file, 'utf8'); } catch { /* absent counts as stale */ }
    if (current !== bytes) {
      console.error('docs/components.csv is behind its sources; run: npm run components-index');
      process.exit(1);
    }
    process.exit(0);
  }
  writeFileSync(file, bytes);
  console.log(`components-index: ${rows.length} components; ${rows.filter(r => r.leads).length} lead an app view, ${rows.filter(r => r.setups).length} have a setup, ${rows.filter(r => r.seen_at).length} name where the app shows them, `
    + `${rows.filter(r => r.patterns).length} declare a pattern, ${rows.filter(r => r.tested === 'yes').length} tested`);
  for (const r of rows.filter(r => !r.gloss)) console.log('  no gloss  ' + r.path);
  for (const r of rows.filter(r => !r.names)) console.log('  no Alpine.data name  ' + r.path);
}
