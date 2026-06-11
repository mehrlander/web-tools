#!/usr/bin/env node
/**
 * build-kit.mjs
 *
 * Generates `export/lib/kits/wring.js` — the Wring engine packaged as a
 * web-tools *kit* (see web-tools/lib/kits/README.md for the contract:
 * no top-level import/export, body wrapped in an IIFE, public surface
 * assigned to a single window namespace, loadable via `gh.load`).
 *
 * The kit is a mechanical concatenation of the Wring source modules with
 * module syntax stripped: static imports are dropped (concatenation puts
 * every symbol in scope), `export` keywords are removed, and the dead
 * CJS-compat footers are cut. A collision check refuses to build if two
 * modules declare the same top-level name.
 *
 * Usage: node export/build-kit.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

// Concatenation order is documentation, not necessity: function declarations
// hoist within the IIFE, so cross-file references resolve regardless.
const SOURCES = [
  'general/tokenize.js',        // Stage 1 (general text)
  'dom/extract-signatures.js',  // Stage 1 (DOM)
  'general/grammar.js',         // Stage 2
  'core/group-by-template.js',  // Stages 3-4 (Bookend Merge + greedy MDL)
  'general/align-group.js',     // Stage 3 alternative (structural alignment)
  'selection/mdl-select.js',    // Stage 4 (full MDL + interval scheduling)
  'general/bridge.js',          // bridge + end-to-end induce()
];

const PUBLIC_API = [
  '// Stage 1: segmenters',
  'tokenize', 'extractSignatures', 'extractSignaturesFromNodes', 'countSignatures',
  '// Stage 2: grammar induction (Re-Pair)',
  'induceGrammar', 'expandRule', 'reconstructTokens',
  '// Stages 3-4: grouping + reconstruction',
  'groupByTemplate', 'summarize', 'reconstruct',
  'groupByAlignment', 'reconstructAlign',
  '// Stage 4: full MDL selection',
  'weightedIntervalSchedule', 'mdlCost', 'selectTemplates',
  '// Bridge + end-to-end pipeline',
  'NUL', 'recordsByLines', 'recordsByAnchor', 'induce',
];

function stripModuleSyntax(src) {
  return src
    // static imports: concatenation provides the symbols
    .replace(/^import\s.*\n/gm, '')
    // export keyword on declarations
    .replace(/^export\s+(function|const|class|let)/gm, '$1')
    // dead CJS-compat footer (from the section header to end of file)
    .replace(/\n\/\/ ─── Node\.js \/ browser compatibility[\s\S]*$/, '\n');
}

function topLevelNames(src) {
  const names = [];
  for (const m of src.matchAll(/^(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.push(m[1]);
  }
  return names;
}

let commit = 'unknown';
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
} catch { /* not a git checkout */ }

const seen = new Map();
const sections = [];

for (const rel of SOURCES) {
  const raw = readFileSync(path.join(root, rel), 'utf8');
  const body = stripModuleSyntax(raw).trimEnd();

  for (const name of topLevelNames(body)) {
    if (seen.has(name)) {
      console.error(`COLLISION: top-level "${name}" declared in both ${seen.get(name)} and ${rel}`);
      process.exit(1);
    }
    seen.set(name, rel);
  }

  sections.push(
    `// ${'═'.repeat(74)}\n// ${rel}\n// ${'═'.repeat(74)}\n\n${body}`,
  );
}

const apiLines = PUBLIC_API
  .map((e) => (e.startsWith('//') ? `  ${e}` : null) ?? `  ${e},`)
  .join('\n');

const out = `/**
 * wring.js — single-document template induction (kit)
 *
 * Give it one document with repeated structure (a log, an HTML page) and it
 * returns the recurring templates (fixed boilerplate with variable slots)
 * plus the values that fill each slot. Lossless: templates + slot values
 * reconstruct the original exactly.
 *
 * Load via gh.load('kits/wring.js'); exposes window.wring.
 * Quick start:
 *   const run = wring.induce(logText, { group: 'align' });   // text → templates
 *   const sigs = wring.extractSignaturesFromNodes(document); // DOM → signatures
 *   const res  = wring.groupByTemplate(sigs);                //   → templates
 *
 * GENERATED FILE — do not edit by hand. Source of truth: the module files in
 * mehrlander/wring (snapshot under archive/wring/); regenerate with
 * \`node export/build-kit.mjs\` there. Generated from wring@${commit}.
 * Design doc: archive/wring/ARCHITECTURE.md (the five-stage pipeline).
 */
(() => {
'use strict';

${sections.join('\n\n')}

// ─── Public surface ──────────────────────────────────────────────────────────

window.wring = {
${apiLines}
};
})();
`;

const dest = path.join(here, 'lib', 'kits', 'wring.js');
mkdirSync(path.dirname(dest), { recursive: true });
writeFileSync(dest, out);
console.log(`wrote ${path.relative(root, dest)} (${out.length.toLocaleString()} chars, ` +
  `${out.split('\n').length} lines, from wring@${commit})`);
