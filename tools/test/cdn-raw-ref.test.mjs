// tools/render/cdn.mjs, the own-code raw rule: a raw.githubusercontent.com URL
// for this repo is answered from the working tree, and the ref inside it has
// to be stripped first. A branch name carries slashes, so with no --ref given
// the rule takes the first split that names a file here, as the sibling rule
// does. Dropping exactly one segment, as it did, turned a nested toss at
// claude/<slug> into a request for <slug>/lib/gh-api.js and a page that said
// only "gh is not defined".

import test from 'node:test';
import assert from 'node:assert/strict';
import { repoRoot } from './bootstrap.mjs';
import { resolveCdn, REPO } from '../render/cdn.mjs';

const raw = (refAndPath, ref = null) =>
  resolveCdn(`https://raw.githubusercontent.com/${REPO}/${refAndPath}`, repoRoot, ref, {});

test('a one-segment ref is stripped as before', () => {
  assert.equal(raw('main/lib/gh-api.js').tag, 'raw lib/gh-api.js');
});

test('a slashed branch name with no --ref finds the file', () => {
  assert.equal(raw('claude/some-branch/lib/gh-api.js').tag, 'raw lib/gh-api.js');
  assert.equal(raw('a/b/c/lib/kits/land.js').tag, 'raw lib/kits/land.js');
});

test('a --ref still decides when it is given', () => {
  assert.equal(raw('claude/some-branch/lib/gh-api.js', 'claude/some-branch').tag, 'raw lib/gh-api.js');
});

test('a path that is not here is still a miss', () => {
  assert.match(raw('claude/some-branch/lib/no-such-file.js').tag, /^MISS raw /);
});
