// python/repo_address.py is the Python side of lib/kits/repo-address.js: the
// same owner/repo[@ref]:path grammar and the same GitHub URL encoding. Three
// scripts carried a pattern each until 2026-10-20 and disagreed on what a repo
// name, a ref and a path may hold. This holds the two languages to one answer
// over the cases they used to differ on, so a change to either shows here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../repo-root.mjs';

const window = {};
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/repo-address.js'), 'utf8'))(window);
const RA = window.RepoAddress;

const CASES = [
  'me/proj:a.md', 'me/proj@feat/x:a/b.md', ' me.dash/a.b-c@v2:x/y.json ', 'a/b@feat/x:p',
  'o/r@f#1:x?.md', 'o/r@main:dir/a b(1).md', 'o/r:', 'just/a/path.md', 'README.md', '', 'o/r@x',
];

test('Python and JavaScript read every address alike, and build the same GitHub URL', () => {
  const py = JSON.parse(execFileSync('python3', ['-c', `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(repoRoot, 'python'))})
import repo_address as r
out = []
for s in json.loads(sys.argv[1]):
    a = r.parse(s)
    out.append({"a": a, "url": r.github_blob(a["repo"], a["ref"], a["path"]) if a else ""})
print(json.dumps(out))
`, JSON.stringify(CASES)], { encoding: 'utf8' }));
  CASES.forEach((s, i) => {
    const a = RA.parse(s);
    assert.deepEqual(py[i].a, a ? { ...a } : null, `parse ${JSON.stringify(s)}`);
    assert.equal(py[i].url, a ? RA.github.blob(a.repo, a.ref, a.path) : '', `url ${JSON.stringify(s)}`);
  });
});
