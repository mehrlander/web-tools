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
  charter: 'docs/programs/surfacing.md', governs: ['docs/SURFACING.md', 'python/showing.py'] }] });
const files = { '.web-tools.json': manifest, 'docs/SURFACING.md': 'x', 'python/showing.py': 'x', 'docs/APP.md': 'x' };

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
    assert.match(first.err, /governed by the Surfacing program \(charter docs\/programs\/surfacing\.md\)/);
    assert.match(first.err, /\/portable:programs surfacing/);
    assert.equal(r.edit('docs/SURFACING.md').status, 0, 'the same program stays quiet for the rest of the session');
    assert.equal(r.edit('docs/SURFACING.md', 's2').status, 2, 'another session hears it');
  } finally { r.done(); }
});

test('a file no program governs, or a repo with no programs, is silent', () => {
  const r = repo();
  try { assert.equal(r.edit('docs/APP.md').status, 0); } finally { r.done(); }
  const bare = repo({ 'docs/SURFACING.md': 'x' });
  try { assert.equal(bare.edit('docs/SURFACING.md').status, 0); } finally { bare.done(); }
  const broken = repo({ '.web-tools.json': '{not json', 'docs/SURFACING.md': 'x' });
  try { assert.equal(broken.edit('docs/SURFACING.md').status, 0); } finally { broken.done(); }
});
