// tools/build/console-suite.mjs — assemble console/suite.js: base.js plus
// every module under console/mods/ in manifest order, so the whole suite is
// one paste. base.js stays the standalone core; each mod is independently
// paste-able after it; suite.js is the everything artifact.
//
// Output is byte-deterministic (no timestamps), so the build-on-commit hook
// can regenerate and stage it with its sources. Run via `npm run build:console`.
// A mod file on disk that isn't in MODS (or vice versa) fails the build:
// adding a module means adding it here, which keeps assembly order explicit.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MODS = [
  'verbs.js', 'query.js', 'grow.js', 'pick.js',
  'infer.js', 'tap.js', 'columns.js', 'harvest.js',
  'lasso.js', 'census.js', 'sets.js', 'deck.js',
];

export function assemble() {
  const onDisk = readdirSync(path.join(root, 'console', 'mods')).filter(f => f.endsWith('.js')).sort();
  const unlisted = onDisk.filter(f => !MODS.includes(f));
  if (unlisted.length) throw new Error(`console-suite: mods not in manifest: ${unlisted.join(', ')} — add them to MODS in tools/build/console-suite.mjs`);
  const absent = MODS.filter(f => !onDisk.includes(f));
  if (absent.length) throw new Error(`console-suite: manifest lists missing mods: ${absent.join(', ')}`);

  const read = p => readFileSync(path.join(root, p), 'utf8').trimEnd();
  const names = MODS.map(f => f.replace(/\.js$/, ''));
  return [
    '// console/suite.js — GENERATED, do not edit. `npm run build:console` reassembles',
    `// it from console/base.js + console/mods/{${names.join(',')}}.js.`,
    '',
    read('console/base.js'),
    ...MODS.flatMap(f => ['', `/* ══ mods/${f} ${'═'.repeat(Math.max(3, 58 - f.length))} */`, '', read(`console/mods/${f}`)]),
    '',
    `console.style?.(console.formatter?.('gray;italic', 'mods'), console.formatter?.('#345', '${names.join(', ')}'));`,
    '',
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(root, 'console', 'suite.js'), assemble());
  console.log(`console/suite.js ← base.js + ${MODS.length} mods (${MODS.join(', ')})`);
}
