// skills/hooks/warn-governing-docs.sh: the PostToolUse warning after a
// documentation edit. Exit 2 puts the warning in front of the model; exit 0 is
// silence. Asserted both ways: a document in a governed place warns, and
// research the repo declares in .web-tools.json does not, whether the declared
// path is the file itself or the README.md of its folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const HOOK = join(repoRoot, 'skills/hooks/warn-governing-docs.sh');

function edit(files, rel) {
  const root = mkdtempSync(join(tmpdir(), 'warn-docs-'));
  try {
    spawnSync('git', ['-C', root, 'init', '-q']);
    for (const [p, body] of Object.entries(files)) {
      mkdirSync(join(root, dirname(p)), { recursive: true });
      writeFileSync(join(root, p), body);
    }
    const r = spawnSync('bash', [HOOK], { input: JSON.stringify({ tool_input: { file_path: join(root, rel) } }),
                                         encoding: 'utf8' });
    return { status: r.status, err: r.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const manifest = JSON.stringify({ research: [{ path: 'docs/lab/findings.md', kind: 'probe' },
                                             { path: 'docs/probes/README.md', kind: 'probe' }] });
const files = { '.web-tools.json': manifest, 'docs/lab/findings.md': 'x', 'docs/probes/run.md': 'x', 'docs/guide.md': 'x' };

test('a document in a governed place warns', () => {
  const r = edit(files, 'docs/guide.md');
  assert.equal(r.status, 2);
  assert.match(r.err, /is documentation/);
  assert.match(r.err, /Follow the doc-craft skill for the wording/);
});

test('a skill file is pointed at skill-prefs too', () => {
  const r = edit({ 'skills/x/SKILL.md': 'x' }, 'skills/x/SKILL.md');
  assert.equal(r.status, 2);
  assert.match(r.err, /doc-craft and skill-prefs skills/);
});

test('declared research stays silent: the file itself, or a file in a declared folder', () => {
  assert.equal(edit(files, 'docs/lab/findings.md').status, 0);
  assert.equal(edit(files, 'docs/probes/run.md').status, 0);
});

test('without a manifest, or with one that does not parse, the warning is unchanged', () => {
  assert.equal(edit({ 'docs/lab/findings.md': 'x' }, 'docs/lab/findings.md').status, 2);
  assert.equal(edit({ '.web-tools.json': '{not json', 'docs/lab/findings.md': 'x' }, 'docs/lab/findings.md').status, 2);
});
