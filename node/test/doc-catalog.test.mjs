// python/doc-catalog.py: the documentation catalog's computed codes. A
// throwaway git repo holds one file of each kind the path decides, and each
// row's position, folder_kind and role_by_path is asserted, with one inbound
// link counted and one repo:path lookup printed alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const SCRIPT = join(repoRoot, 'python/doc-catalog.py');

const files = {
  '.web-tools.json': JSON.stringify({ projects: [{ path: 'projects/wps' }] }),
  '.gitattributes': 'docs/old.md edit=write-once\n',
  'README.md': 'See [the guide](docs/guide.md).\n',
  'docs/guide.md': 'x',
  'docs/old.md': 'x',
  'notes/2026-01-02-sweep/README.md': 'x',
  'data/source/2026-01-03-export/README.md': 'x',
  'projects/wps/README.md': 'x',
};

function catalog(args) {
  const parent = mkdtempSync(join(tmpdir(), 'doc-catalog-'));
  const root = join(parent, 'demo');
  try {
    spawnSync('git', ['init', '-q', root]);
    for (const [p, body] of Object.entries(files)) {
      mkdirSync(join(root, dirname(p)), { recursive: true });
      writeFileSync(join(root, p), body);
    }
    spawnSync('git', ['-C', root, 'add', '-A']);
    const r = spawnSync('python3', [SCRIPT, parent, '--repo', 'demo', ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const [head, ...lines] = r.stdout.trim().split('\n');
    const cols = head.split(',');
    const rows = lines.map(l => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])));
    return { rows, err: r.stderr, byPath: Object.fromEntries(rows.map(x => [x.path, x])) };
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}

const expected = {
  'README.md': ['readme', 'code', ''],
  'docs/guide.md': ['docs', 'code', ''],
  'docs/old.md': ['docs', 'code', 'record'],
  'notes/2026-01-02-sweep/README.md': ['readme', 'run', 'record'],
  'data/source/2026-01-03-export/README.md': ['readme', 'source', 'subject'],
  'projects/wps/README.md': ['readme', 'project', ''],
};

test('each documentation-slot file gets the position, folder kind and role its path decides', () => {
  const { byPath, err } = catalog([]);
  assert.deepEqual(Object.keys(byPath).sort(), Object.keys(expected).sort());
  for (const [path, [position, kind, role]] of Object.entries(expected)) {
    const r = byPath[path];
    assert.deepEqual([r.position, r.folder_kind, r.role_by_path], [position, kind, role], path);
  }
  assert.equal(byPath['docs/old.md'].edit, 'write-once');
  assert.equal(byPath['docs/guide.md'].links_in, '1', 'the README links the guide');
  assert.equal(byPath['README.md'].links_in, '0');
  assert.match(err, /repo x folder_kind/, 'the summary follows the rows');
});

test('a repo:path lookup prints that one row and no summary', () => {
  const { rows, err } = catalog(['demo:docs/old.md']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].role_by_path, 'record');
  assert.equal(err, '');
});
