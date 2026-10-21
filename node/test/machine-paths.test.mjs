// skills/hooks/machine-paths.py — the machine-path gate, which refuses a commit
// whose added lines name a path into one machine's user folder, and which the
// suite runs over the whole tree so a commit that skipped the hook still fails.
//
// Like the consent gate beside it, a wrong refusal is the expensive answer: it
// teaches a session --no-verify. So the cases below hold the lines that must
// pass as firmly as the lines that must not: the cloud sandbox's /home/user/,
// a placeholder, a repository path inside a URL, the two exempt folders, and a
// line that carries the marker. Each staged case is a throwaway repository,
// because the gate reads the staged diff, not the working tree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const GATE = join(repoRoot, 'skills/hooks/machine-paths.py');

function git(cwd, ...args) {
  return spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
}

/** Stage `files` ({ path: body }) in a fresh repository and run the gate on them. */
function staged(files) {
  const root = mkdtempSync(join(tmpdir(), 'machine-paths-'));
  try {
    git(root, 'init', '-q', '-b', 'main');
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(join(root, dirname(rel)), { recursive: true });
      writeFileSync(join(root, rel), body);
    }
    git(root, 'add', '-A');
    const r = spawnSync('python3', [GATE, '--staged'], { cwd: root, encoding: 'utf8' });
    return { status: r.status, err: (r.stderr || '').trim() };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('no tracked file names a path into one machine\'s user folder', () => {
  const r = spawnSync('python3', [GATE, '--tree'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('a path into a user folder is refused, in code and prose alike, naming the file and line', () => {
  for (const [rel, body, kind] of [
    ['node/render/crop.mjs', "const dir = 'C:/Users/someone/.gemini/x';\n", 'a Windows user folder'], // machine-path-ok
    ['tools/run.ps1', 'Set-Location C:\\Users\\someone\\Code\n', 'a Windows user folder'], // machine-path-ok
    ['notes.md', 'Saved under /Users/someone/Desktop/out.png\n', 'a macOS user folder'], // machine-path-ok
    ['data/rows.csv', 'a,/home/someone/data.csv\n', 'a Linux home folder'], // machine-path-ok
    ['x.py', "ART = 'antigravity/brain/26c2bc15'\n", 'an Antigravity conversation folder'], // machine-path-ok
  ]) {
    const r = staged({ [rel]: body });
    assert.equal(r.status, 1, rel);
    assert.match(r.err, new RegExp(rel.replace(/[.\\]/g, '\\$&') + ':1  ' + kind), rel);
  }
});

test('the cloud sandbox, a placeholder, a URL, the exempt folders and a marked line pass', () => {
  for (const [rel, body] of Object.entries({
    'node/render/out.mjs': "const out = '/home/user/web-tools/shot.png';\n",
    'tracker/task.md': 'nssm install Ollama "C:\\Users\\<user>\\AppData\\ollama.exe"\n',
    'node/fetch.mjs': "fetch('https://api.github.com/repos/mehrlander/home/contents/x')\n",
    'docs/environment/laptop.md': 'Clones live under `C:\\Users\\someone\\Code\\gh\\`.\n', // machine-path-ok
    'research/probe-2026/source/notes.md': 'Read /Users/someone/Downloads/report.pdf\n', // machine-path-ok
    'node/test/x.test.mjs': "rowOf({ path: 'C:\\\\Users\\\\me\\\\F.psm1' }); // machine-path-ok\n",
  })) {
    const r = staged({ [rel]: body });
    assert.equal(r.status, 0, rel + ': ' + r.err);
  }
});

test('only the lines a commit adds are read, so an existing line never blocks an unrelated commit', () => {
  const root = mkdtempSync(join(tmpdir(), 'machine-paths-'));
  try {
    git(root, 'init', '-q', '-b', 'main');
    git(root, 'config', 'user.email', 't@e.st');
    git(root, 'config', 'user.name', 'T');
    writeFileSync(join(root, 'old.mjs'), "const dir = 'C:/Users/someone/x/';\n"); // machine-path-ok
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '--no-verify', '-m', 'seed');
    writeFileSync(join(root, 'old.mjs'), "const dir = 'C:/Users/someone/x/';\nconst more = 1;\n"); // machine-path-ok
    git(root, 'add', '-A');
    const r = spawnSync('python3', [GATE, '--staged'], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
