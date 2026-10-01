// tools/render/cdn.mjs, SHOT_GIT_API: the headless browser's answers to the
// reads a finding's witnesses need, taken from git at the ref asked for. The
// Tending view's own observe() is verified in Chromium against these answers
// (tools/render/scenarios/tending-findings.mjs), so they have to be git's real
// objects: a folder listing whose shas are the blob and tree shas
// `git rev-parse <ref>:<path>` prints, a compare whose status says which side
// contains which, and a branch tip. Off by default, so every other shot keeps
// serving the working tree.
//
// Run against this checkout at HEAD, which exists however shallow the clone.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { repoRoot } from './bootstrap.mjs';
import { resolveCdn, REPO } from '../render/cdn.mjs';

const git = (...a) => execFileSync('git', ['-C', repoRoot, ...a], { encoding: 'utf8' }).trim();
const head = git('rev-parse', 'HEAD');
const ask = (p) => resolveCdn(`https://api.github.com/repos/${REPO}/${p}`, repoRoot, null, {});
const body = (r) => JSON.parse(String(r.body));

test('off by default: a ref-pinned listing is not answered from git', () => {
  delete process.env.SHOT_GIT_API;
  const r = ask('contents/lib?ref=HEAD');
  assert.ok(!/git-api/.test(r.tag || ''), 'the git-backed answer must stay opt-in');
});

test('a folder listing at a ref carries git\'s blob and tree shas', () => {
  process.env.SHOT_GIT_API = '1';
  try {
    const r = ask('contents/lib?ref=HEAD');
    assert.match(r.tag, /^git-api /);
    const list = body(r);
    const kits = list.find(e => e.name === 'kits');
    assert.equal(kits.type, 'dir');
    assert.equal(kits.sha, git('rev-parse', 'HEAD:lib/kits'));
    const file = body(ask('contents/lib/kits?ref=HEAD')).find(e => e.name === 'findings.js');
    assert.equal(file.type, 'file');
    assert.equal(file.sha, git('rev-parse', 'HEAD:lib/kits/findings.js'));
  } finally { delete process.env.SHOT_GIT_API; }
});

test('a branch tip, a compare, and a miss', () => {
  process.env.SHOT_GIT_API = '1';
  try {
    assert.equal(body(ask('branches/HEAD')).commit.sha, head);
    assert.equal(body(ask(`compare/${head}...HEAD`)).status, 'identical');
    const miss = ask('branches/no-such-branch-' + Date.now());
    assert.equal(miss.status, 404);
  } finally { delete process.env.SHOT_GIT_API; }
});
