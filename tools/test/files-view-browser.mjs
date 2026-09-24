#!/usr/bin/env node
// The repo Files view in the real app, by tap: a file picked in the tree shows
// in the reader, and the folder's deck steps the pane to the next file. Desktop
// and phone widths, since the deck door moved to a bar both widths can reach.
// Runs tools/render/screenshot.mjs with tools/render/scenarios/files-view-tap-and-deck.mjs,
// which asserts and throws; the renderer serves this checkout's tree offline.
// Run explicitly: npm run test:files-view. Kept outside *.test.mjs because npm
// test is browser-free.
import { spawnSync } from 'node:child_process';
import { repoRoot } from '../repo-root.mjs';

let failed = 0;
for (const [label, width, height] of [['desktop', 1400, 800], ['phone', 390, 844]]) {
  const run = spawnSync('node', ['tools/render/screenshot.mjs', 'app/index.html',
    '--query', 'repo=mehrlander/web-tools&view=files&path=docs',
    '--width', String(width), '--height', String(height), '--wait', '6000',
    '--script', 'tools/render/scenarios/files-view-tap-and-deck.mjs'], { cwd: repoRoot, encoding: 'utf8', timeout: 240000 });
  const out = (run.stdout || '') + (run.stderr || '');
  const ok = run.status === 0 && out.includes('CHECK OK files-view');
  console.log((ok ? 'ok   ' : 'FAIL ') + label);
  if (!ok) { failed++; console.error(out.split('\n').filter(l => /files-view|fatal|error/i.test(l)).join('\n')); }
}
console.log('\n' + (2 - failed) + '/2 browser checks passed');
if (failed) process.exitCode = 1;
