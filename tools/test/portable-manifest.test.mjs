// docs/portable.json — the machine-readable index of the portable set, whose
// prose parent is docs/PORTABLE.md. This test is the consistency check that
// lets the two coexist without drifting: every manifest path must exist in the
// repo and be named somewhere in PORTABLE.md, and every path linked from
// PORTABLE.md's "### Docs" and "### Scripts" tables must appear in the
// manifest. Adding a piece to one place without the other fails here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'docs', 'portable.json'), 'utf8'));
const portableMd = readFileSync(path.join(repoRoot, 'docs', 'PORTABLE.md'), 'utf8');

// First-cell code-span paths from the Docs and Scripts tables:  | [`path`](…) | … |
function tablePaths(md, heading) {
  const sec = md.split(heading)[1]?.split(/\n### /)[0] || '';
  return [...sec.matchAll(/^\|\s*\[`([^`]+)`\]/gm)]
    .map(m => m[1].replace(/\/$/, ''));
}

const tableSet = new Set([...tablePaths(portableMd, '### Docs'), ...tablePaths(portableMd, '### Scripts')]);
const manifestPaths = new Set(manifest.items.map(i => i.path));

test('manifest shape: hub, plugin block, and non-empty typed items', () => {
  assert.equal(manifest.hub, 'mehrlander/web-tools');
  assert.ok(Array.isArray(manifest.plugin.plugins) && manifest.plugin.plugins.includes('portable'));
  assert.ok(manifest.items.length > 10);
  for (const it of manifest.items) {
    assert.ok(['skill', 'doc', 'dir', 'script'].includes(it.kind), it.path + ': kind');
    assert.ok(it.path && it.title && it.role, it.path + ': path/title/role');
  }
});

test('every manifest path exists in the repo', () => {
  for (const it of manifest.items) {
    assert.ok(existsSync(path.join(repoRoot, it.path)), 'missing on disk: ' + it.path);
  }
});

test('every manifest path is named in PORTABLE.md', () => {
  for (const it of manifest.items) {
    if (it.path === 'docs/PORTABLE.md') continue;   // the doc never names its own path
    assert.ok(portableMd.includes(it.path), 'not in PORTABLE.md: ' + it.path);
  }
});

test("every PORTABLE.md Docs/Scripts table row is in the manifest", () => {
  assert.ok(tableSet.size > 10, 'table parse found rows');
  for (const p of tableSet) {
    assert.ok(manifestPaths.has(p), 'in PORTABLE.md tables but not the manifest: ' + p);
  }
});
