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
//   loads      how many other files under lib/, pages/ and app/ name its load
//              path (alpineComponents/<name>.js)
//   mounts     how many other files there mount it: a line that carries
//              x-data and one of its names. A component that draws its own
//              root is loaded and never mounted by name, so the two differ
//   patterns   how many times the file writes data-pattern, the attribute a
//              page's markup declares its body's arrangement with
//              (data/ui-units/codebook.md, "Declaring a pattern in markup")
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
export const COMPONENTS_COLS = ['path', 'names', 'gloss', 'lines', 'routes', 'loads', 'mounts', 'patterns', 'tested'];

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
    let mounts = 0, loads = 0;
    for (const [f, text] of sources) {
      if (f === rel) continue;
      if (text.includes(load)) loads++;
      if (mount && mount.test(text)) mounts++;
    }
    return {
      path: rel,
      names: names.join(';'),
      gloss: glossOf(src, base),
      lines: src.split('\n').length,
      routes: routes.filter(r => String(r.files || '').split(';').map(s => s.trim()).includes(rel)).length,
      loads,
      mounts,
      patterns: (src.match(/\bdata-pattern=/g) || []).length,
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
