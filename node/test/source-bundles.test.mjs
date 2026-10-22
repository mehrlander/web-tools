// python/source-bundles.py: the two source-bundle tables a repository declares
// in `.web-tools.json` `bundles` (contract: docs/source-bundles.md). Fixture
// repositories only; the consumers check their own committed tables.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { parseCsv } from '../build/registries-load.mjs';

const script = path.join(repoRoot, 'python/source-bundles.py');
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const run = (root, ...args) => spawnSync('python3', [script, '--root', root, ...args],
  { cwd: repoRoot, encoding: 'utf8' });
const DECL = {
  base: 'proj', roots: ['source'], table: 'catalog/bundles.csv',
  fileTable: 'catalog/bundle-files.csv', fileSources: 'catalog/file-sources.csv', skip: ['cache'],
};
const README = (fm, body = '# A bundle\n') => `---\n${fm}\n---\n${body}`;

function fixture(t, decl = DECL) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'source-bundles-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q');
  git(root, 'config', 'core.autocrlf', 'false');
  git(root, 'config', 'core.hooksPath', '.disabled-hooks');
  writeFileSync(path.join(root, '.web-tools.json'), JSON.stringify({ bundles: [decl] }) + '\n');
  return root;
}
const put = (root, rel, text) => {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
};
const table = (root, rel) => parseCsv(readFileSync(path.join(root, rel), 'utf8'));

test('both tables come from the index, in path-part order, relative to the base', t => {
  const root = fixture(t);
  put(root, 'proj/source/2026-01-02-b/README.md', README([
    'title: "Bundle B: the second"', 'publisher: "OFM"', 'acquired: "2026-01-02"',
    'not_taken:', '  - what: "the PDFs"', '    why: "too large"', '  - what: "the notes"',
  ].join('\n')));
  for (const rel of ['raw/lower.txt', 'raw/Upper.txt', 'raw-data.csv', '_extract.py',
    'cache/held.bin', '.local/x.txt', 'raw/.hidden']) put(root, `proj/source/2026-01-02-b/${rel}`, 'x\n');
  put(root, 'proj/source/2026-01-01-a/README.md', README('title: "A"\nacquired: "2026-01-01"'));
  put(root, 'proj/source/no-readme/data.csv', 'a\n');
  put(root, 'proj/source/loose.txt', 'not in a bundle\n');
  git(root, 'add', '.');
  put(root, 'proj/source/2026-01-01-a/untracked.csv', 'never staged\n');

  const r = run(root);
  assert.equal(r.status, 0, r.stderr);
  const bundles = table(root, 'proj/catalog/bundles.csv');
  assert.deepEqual(bundles.map(b => b.bundle), ['source/2026-01-01-a', 'source/2026-01-02-b']);
  const b = bundles[1];
  assert.equal(b.root, 'source');
  assert.equal(b.title, 'Bundle B: the second');
  assert.equal(b.publisher, 'OFM');
  assert.equal(b.not_taken, 'the PDFs (too large); the notes');
  assert.equal(b.files, '5');
  const files = table(root, 'proj/catalog/bundle-files.csv');
  assert.deepEqual(files.filter(f => f.bundle === b.bundle).map(f => f.path),
    ['README.md', '_extract.py', 'raw/Upper.txt', 'raw/lower.txt', 'raw-data.csv']);
  assert.deepEqual(files.filter(f => f.bundle === 'source/2026-01-01-a').map(f => f.path), ['README.md'],
    'an untracked file stays out');
  assert.match(files[0].sha256, /^[0-9a-f]{64}$/);

  git(root, 'add', 'proj/catalog');
  assert.equal(run(root, '--check').status, 0);
  put(root, 'proj/source/2026-01-02-b/raw-data.csv', 'changed\n');
  git(root, 'add', 'proj/source/2026-01-02-b');
  const stale = run(root, '--check');
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /proj\/catalog\/bundle-files\.csv is behind the index/);
});

test('a bundle needs a title and a date acquired', t => {
  const root = fixture(t);
  put(root, 'proj/source/x/README.md', README('title: "X"'));
  git(root, 'add', '.');
  const r = run(root);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /proj\/source\/x: frontmatter has no `acquired`/);
});

test('past the enumeration cap a bundle gets one totals row', t => {
  const root = fixture(t, { ...DECL, enumerateMax: 2 });
  put(root, 'proj/source/big/README.md', README('title: "Big"\nacquired: "2026-01-01"'));
  for (const n of [1, 2, 3]) put(root, `proj/source/big/f${n}.txt`, 'abc\n');
  git(root, 'add', '.');
  assert.equal(run(root).status, 0);
  const files = table(root, 'proj/catalog/bundle-files.csv');
  assert.equal(files.length, 1);
  assert.match(files[0].path, /^\(4 files, past the 2 enumeration cap/);
  assert.equal(files[0].sha256, '');
});

test('an excluded folder is not a bundle, and a stale exclusion fails', t => {
  const root = fixture(t, { ...DECL, exclude: ['source/ledger'] });
  put(root, 'proj/source/ledger/README.md', '# A running record, no frontmatter\n');
  put(root, 'proj/source/ledger/pulls.csv', 'date\n');
  put(root, 'proj/source/x/README.md', README('title: "X"\nacquired: "2026-01-01"'));
  git(root, 'add', '.');
  assert.equal(run(root).status, 0);
  assert.deepEqual(table(root, 'proj/catalog/bundles.csv').map(b => b.bundle), ['source/x']);
  writeFileSync(path.join(root, '.web-tools.json'),
    JSON.stringify({ bundles: [{ ...DECL, exclude: ['source/ledger', 'source/gone'] }] }) + '\n');
  const stale = run(root);
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /exclude names source\/gone, which is not a folder under a declared root/);
});

test('a named folder is a bundle wherever it sits, and must hold a README', t => {
  const root = fixture(t, { table: 'catalog/bundles.csv', fileTable: 'catalog/bundle-files.csv',
    folders: ['checkbook', 'deep/register'] });
  put(root, 'checkbook/README.md', README('title: "Checkbook"\nacquired: "2026-01-01"'));
  put(root, 'deep/register/README.md', README('title: "Register"\nacquired: "2026-01-02"'));
  git(root, 'add', '.');
  assert.equal(run(root).status, 0);
  assert.deepEqual(table(root, 'catalog/bundles.csv').map(b => [b.bundle, b.root]),
    [['checkbook', '.'], ['deep/register', 'deep']]);
  writeFileSync(path.join(root, '.web-tools.json'), JSON.stringify({ bundles: [{
    table: 'catalog/bundles.csv', fileTable: 'catalog/bundle-files.csv', folders: ['checkbook', 'empty'] }] }) + '\n');
  put(root, 'empty/data.csv', 'a\n');
  git(root, 'add', '.');
  const r = run(root);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /folders names empty, which holds no tracked README\.md/);
});

test('an authored per-file row must name a file the file table lists', t => {
  const root = fixture(t);
  put(root, 'proj/source/x/README.md', README('title: "X"\nacquired: "2026-01-01"'));
  put(root, 'proj/catalog/file-sources.csv', 'bundle,path,source_url\nsource/x,gone.pdf,https://example.org\n');
  git(root, 'add', '.');
  const r = run(root);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /source\/x\/gone\.pdf is not a file in that bundle/);
});

test('a repository with no declaration is told so', t => {
  const root = fixture(t);
  writeFileSync(path.join(root, '.web-tools.json'), '{}\n');
  const r = run(root);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /declares no `bundles`/);
});
