#!/usr/bin/env node
// Prove a page's dist bundle renders identically to its live gh.load chain.
//
//   node tools/verify-bundle.mjs <page-path>
//
// Builds dist/<page>.js, renders the page twice with tools/screenshot.mjs —
// once live (own code via the gh.load chain), once through the bundle — and
// checks three things:
//   1. both render with zero page errors,
//   2. the set of own-code scripts that loaded ok is identical,
//   3. the two PNGs are byte-identical.
// Exit 0 on parity, 1 otherwise. PNGs + logs are under tools/.preview/.

import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = process.argv[2];
if (!pagePath) {
  console.error('Usage: node tools/verify-bundle.mjs <page-path>');
  process.exit(2);
}
const baseName = path.basename(pagePath, path.extname(pagePath));

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: repoRoot, encoding: 'utf8' });
  if (r.status !== 0) {
    process.stdout.write(r.stdout || '');
    process.stderr.write(r.stderr || '');
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}`);
  }
  return r.stdout;
}

async function md5(p) {
  return createHash('md5').update(await readFile(p)).digest('hex');
}

// Parse "loadedScripts ok (N)" block from a screenshot log into a sorted list.
async function okScripts(logPath) {
  const txt = await readFile(logPath, 'utf8');
  const m = txt.match(/--- loadedScripts ok \(\d+\) ---\n([\s\S]*?)\n\n/);
  if (!m) return [];
  return m[1].split('\n').map(l => l.trim()).filter(Boolean).sort();
}

console.log(`[1/3] building dist/${baseName}.js`);
run('node', ['tools/bundle.mjs', pagePath]);

console.log(`[2/3] rendering live`);
run('node', ['tools/screenshot.mjs', pagePath]);

console.log(`[3/3] rendering via bundle`);
run('node', ['tools/screenshot.mjs', pagePath, '--bundle']);

const livePng = path.join(repoRoot, 'tools/.preview', `${baseName}.png`);
const bundlePng = path.join(repoRoot, 'tools/.preview', `${baseName}.bundle.png`);
const liveLog = path.join(repoRoot, 'tools/.preview', `${baseName}.shot.log`);
const bundleLog = path.join(repoRoot, 'tools/.preview', `${baseName}.bundle.shot.log`);

const checks = [];
for (const p of [livePng, bundlePng]) if (!existsSync(p)) checks.push(`missing render: ${path.relative(repoRoot, p)}`);

const [liveScripts, bundleScripts] = await Promise.all([okScripts(liveLog), okScripts(bundleLog)]);
const scriptsEqual = liveScripts.length && JSON.stringify(liveScripts) === JSON.stringify(bundleScripts);
if (!scriptsEqual) checks.push(`loadedScripts differ:\n  live:   ${liveScripts.join(', ')}\n  bundle: ${bundleScripts.join(', ')}`);

const [a, b] = await Promise.all([md5(livePng), md5(bundlePng)]);
const pixelsEqual = a === b;
if (!pixelsEqual) checks.push(`PNGs differ: live=${a} bundle=${b}`);

console.log('');
console.log(`page:           ${pagePath}`);
console.log(`own scripts:    ${liveScripts.length} loaded, sets ${scriptsEqual ? 'MATCH' : 'DIFFER'}`);
console.log(`render:         ${pixelsEqual ? 'byte-identical' : 'DIFFERENT'} (md5 ${a.slice(0, 12)})`);

if (checks.length) {
  console.log(`\nFAIL:\n- ${checks.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nPASS — bundle renders identically to the live gh.load chain.`);
