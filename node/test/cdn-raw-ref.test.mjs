// node/render/cdn.mjs, the own-code raw rule: a raw.githubusercontent.com URL
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

// The contents rule reads material at the ref asked for. A folder there is a
// tree, which `git show` printed as text and the rule sent as a file's bytes,
// so a page listing a folder at a ref got no listing.
test('a folder at a ref is listed as the contents API lists it', () => {
  const r = resolveCdn(`https://api.github.com/repos/${REPO}/contents/docs/favicons/map?ref=main`, repoRoot, null, {});
  const list = JSON.parse(r.body);
  assert.ok(Array.isArray(list), r.tag);
  assert.ok(list.some(e => e.type === 'file' && e.path === 'docs/favicons/map/docs.svg'));
});

// A contents request for a file that is not here answers 404, as GitHub does.
// It answered an empty 200, so a page that shows an absent state on a 404
// parsed nothing instead and rendered a different branch than it does live.
test('a contents path that is not here answers 404', () => {
  const r = resolveCdn(`https://api.github.com/repos/${REPO}/contents/no/such/file.json`, repoRoot, null, {});
  assert.equal(r.status, 404, r.tag);
  assert.match(r.tag, /^MISS api /);
  assert.equal(JSON.parse(r.body).message, 'Not Found');
});
