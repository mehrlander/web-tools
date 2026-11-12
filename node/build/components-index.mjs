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
//   patterns   how many times the file writes data-pattern, the attribute a
//              page's markup declares its body's arrangement with
//              (data/ui-units/codebook.md, "Declaring a pattern in markup")
//   kits       the kits it names by load path (kits/<name>.js), `;`-joined
//   events     the events it sends: every name handed to $dispatch or to
//              new CustomEvent, `;`-joined
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
export const COMPONENTS_COLS = ['path', 'names', 'gloss', 'lines', 'routes', 'views', 'loads', 'mounts', 'mounted_by', 'pages', 'patterns', 'kits', 'events', 'tested'];

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
 * Derive every row.
 * @param {string} root
 * @returns {object[]} rows, sorted by path
 */
export function deriveComponents(root) {
  const files = tracked(root);
  const comps = files.filter(f => /^lib\/alpineComponents\/[\w-]+\.js$/.test(f)).sort();
  const tests = files.filter(f => f.startsWith('node/test/')).map(f => read(root, f)).join('\n');
  const readers = files.filter(f =>
    (f.startsWith('lib/') || f.startsWith('pages/') || f.startsWith('app/')) && /\.(html|js|mjs)$/.test(f));
  const sources = new Map(readers.map(f => [f, read(root, f)]));
  const routes = parseCsv(read(root, 'docs/app-routes.csv'));
  const list = (cell) => String(cell || '').split(';').map(x => x.trim()).filter(Boolean);
  const units = files.includes('data/ui-units/units.csv') ? parseCsv(read(root, 'data/ui-units/units.csv')) : [];
  const uniq = (src, re) => [...new Set([...src.matchAll(re)].map(m => m[1]))].sort();

  return comps.map(rel => {
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
    const shows = new Set([rel, ...mounters.filter(f => f.endsWith('.html'))]);
    return {
      path: rel,
      names: names.join(';'),
      gloss: glossOf(src, base),
      lines: src.split('\n').length,
      routes: named.length,
      views: named.map(r => r.key).join(';'),
      loads,
      mounts,
      mounted_by: mounters.sort().join(';'),
      pages: units.filter(u => list(u.files).some(f => shows.has(f))).map(u => u.unit).join(';'),
      patterns: (src.match(/\bdata-pattern=/g) || []).length,
      kits: uniq(src, /['"`]kits\/([\w-]+)\.js/g).join(';'),
      events: uniq(src, /(?:\$dispatch|new CustomEvent)\(\s*['"`]([\w:.-]+)['"`]/g).join(';'),
      tested: tests.includes(base) ? 'yes' : 'no',
    };
  });
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
  console.log(`components-index: ${rows.length} components; ${rows.filter(r => r.routes).length} draw an app view, `
    + `${rows.filter(r => r.patterns).length} declare a pattern, ${rows.filter(r => r.tested === 'yes').length} tested`);
  for (const r of rows.filter(r => !r.gloss)) console.log('  no gloss  ' + r.path);
  for (const r of rows.filter(r => !r.names)) console.log('  no Alpine.data name  ' + r.path);
}
