// skills/hooks/program-files.sh: the PostToolUse line after an edit to a file a
// declared program governs. Exit 2 puts the line in front of the model; exit 0
// is silence. It speaks once per program per session, and never for a file no
// program governs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const HOOK = join(repoRoot, 'skills/hooks/program-files.sh');
const manifest = JSON.stringify({ programs: [{ name: 'surfacing', label: 'Surfacing',
  path: 'programs/surfacing', governs: ['docs/CONVERSATION.md', 'python/showing.py', 'docs/forms/'] }] });
const files = { '.web-tools.json': manifest, 'docs/CONVERSATION.md': 'x', 'python/showing.py': 'x', 'docs/APP.md': 'x',
  'docs/forms/branch.md': 'x', 'docs/forms-old.md': 'x' };

function repo(body = files) {
  const root = mkdtempSync(join(tmpdir(), 'program-files-'));
  spawnSync('git', ['-C', root, 'init', '-q']);
  for (const [p, text] of Object.entries(body)) {
    mkdirSync(join(root, dirname(p)), { recursive: true });
    writeFileSync(join(root, p), text);
  }
  const tmp = mkdtempSync(join(tmpdir(), 'program-files-tmp-'));
  const edit = (rel, session = 's1') => {
    const r = spawnSync('bash', [HOOK], { input: JSON.stringify({ session_id: session, tool_input: { file_path: join(root, rel) } }),
                                         encoding: 'utf8', env: { ...process.env, TMPDIR: tmp } });
    return { status: r.status, err: r.stderr };
  };
  return { edit, done: () => { rmSync(root, { recursive: true, force: true }); rmSync(tmp, { recursive: true, force: true }); } };
}

test('a governed file names its program and the skill, once per session', () => {
  const r = repo();
  try {
    const first = r.edit('python/showing.py');
    assert.equal(first.status, 2);
    assert.match(first.err, /governed by the Surfacing program \(charter programs\/surfacing\/README\.md\)/);
    assert.match(first.err, /\/portable:programs surfacing/);
    assert.equal(r.edit('docs/CONVERSATION.md').status, 0, 'the same program stays quiet for the rest of the session');
    assert.equal(r.edit('docs/CONVERSATION.md', 's2').status, 2, 'another session hears it');
  } finally { r.done(); }
});

test('an entry ending in / covers the files under it, and only those', () => {
  const r = repo();
  try {
    assert.equal(r.edit('docs/forms/branch.md').status, 2);
    assert.equal(r.edit('docs/forms-old.md', 's3').status, 0, 'a sibling that shares the prefix is not inside the folder');
  } finally { r.done(); }
});

test('a file no program governs, or a repo with no programs, is silent', () => {
  const r = repo();
  try { assert.equal(r.edit('docs/APP.md').status, 0); } finally { r.done(); }
  const bare = repo({ 'docs/CONVERSATION.md': 'x' });
  try { assert.equal(bare.edit('docs/CONVERSATION.md').status, 0); } finally { bare.done(); }
  const broken = repo({ '.web-tools.json': '{not json', 'docs/CONVERSATION.md': 'x' });
  try { assert.equal(broken.edit('docs/CONVERSATION.md').status, 0); } finally { broken.done(); }
});
