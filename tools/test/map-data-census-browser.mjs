#!/usr/bin/env node
// Map Data -> Files against this checkout's real public hub inventory. Browser
// layout and Tabulator rows are invisible to the browser-free npm test suite.
// CENSUS_SCREENSHOT_DIR optionally selects where both screenshots are saved.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const outDir = path.resolve(process.env.CENSUS_SCREENSHOT_DIR || path.join(repoRoot, 'tools/.preview'));
mkdirSync(outDir, { recursive: true });
let failed = 0;
for (const [label, width, height] of [['desktop', 1400, 800], ['phone', 390, 844]]) {
  const run = spawnSync(process.execPath, ['tools/render/screenshot.mjs', 'app/index.html',
    '--query', 'repo=mehrlander/web-tools&view=map&tab=data',
    '--width', String(width), '--height', String(height), '--wait', '6000',
    ...(label === 'phone' ? ['--touch'] : []),
    '--script', 'tools/render/scenarios/map-data-census.mjs',
    '--out', path.join(outDir, `map-data-census-files-${label}.png`)], {
    cwd: repoRoot, encoding: 'utf8', timeout: 240000,
    env: { ...process.env, CENSUS_SCREENSHOT_DIR: outDir },
  });
  const out = (run.stdout || '') + (run.stderr || '');
  const ok = run.status === 0 && out.includes('CHECK OK map-data-census');
  console.log((ok ? 'ok   ' : 'FAIL ') + label);
  if (!ok) {
    failed++;
    console.error(run.error?.message || out.split('\n').filter(l => /map-data-census|fatal|error/i.test(l)).join('\n'));
  } else {
    console.log(out.split('\n').find(l => l.includes('CHECK OK map-data-census')));
  }
}
console.log('\n' + (2 - failed) + '/2 browser checks passed');
console.log('screenshots: ' + outDir);
if (failed) process.exitCode = 1;
