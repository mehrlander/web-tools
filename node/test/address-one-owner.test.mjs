// ONE OWNER FOR THE ADDRESS GRAMMAR, owner/repo[@ref]:path, held here because
// the copies arrived one session at a time and nobody swept for them. On
// 2026-10-20 a regex sweep found 38 readers of the grammar in 21 files beside
// lib/kits/repo-address.js, which existed to be the one reader. They had
// drifted: four refused an '@' in a ref that the rest accepted, some excluded
// whitespace and some kept it, and some cut a ?query off the path while others
// kept it as part of the path. Each now reads through window.RepoAddress
// (parse, or parseRepo for the form with no path), and this test fails on the
// next copy.
//
// The detector is the regex shape every copy had: an `@(` capture followed,
// within a few characters, by a `:(` capture. It reads source text, so it
// catches a copy in a page as well as in a kit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const SHAPE = /@\(\[.{0,30}:\(/;

// The files that keep a reader of their own, each for a reason a shared module
// cannot answer.
const ALLOWED = {
  // The owner.
  'lib/kits/repo-address.js': 'the grammar itself',
  // The refs= selection (owner/repo@ref[:path], ref required) is read at boot,
  // before any kit can load, and refs-select.test.mjs holds the copies to one
  // regular expression. toss-render.html also keeps two address readers: its
  // critical render path loads no lib on purpose (its head comment).
  'lib/gh-api.js': 'refs= at boot',
  'lib/entry.js': 'refs= at boot',
  'pages/toss-render.html': 'refs= at boot, and a render path that loads no lib',
};
// Probes and frozen copies: not product code.
const SKIP = /^(pages\/scratch\/|research\/|archive\/|dist\/|node\/test\/)/;

test('only lib/kits/repo-address.js reads the owner/repo[@ref]:path grammar', () => {
  const files = execFileSync('git', ['ls-files', '*.js', '*.mjs', '*.html'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').filter((f) => f && !SKIP.test(f) && !(f in ALLOWED));
  const offenders = [];
  for (const f of files) {
    readFileSync(path.join(repoRoot, f), 'utf8').split('\n').forEach((line, i) => {
      if (SHAPE.test(line)) offenders.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, [],
    'these lines parse the address with a regex of their own; use window.RepoAddress.parse (or parseRepo) instead');
});

test('the detector still sees the shape it was written for', () => {
  // A guard whose pattern drifted would pass by matching nothing. These are
  // three of the copies it replaced, verbatim.
  for (const copy of [
    String.raw`/^([\w.-]+\/[\w.-]+)(?:@([\w./-]+))?:(.+)$/`,
    String.raw`/^([^/@:\s]+\/[^@:\s]+)@([^:\s]+):(\S+)$/`,
    String.raw`/^([\w.-]+\/[\w.-]+)(?:@([^\s:]+))?(?::([^\s#]+)(?:#(\S+))?)?$/`,
  ]) assert.match(copy, SHAPE, copy);
  // And the allowed boot readers are still where the allowance says.
  for (const f of Object.keys(ALLOWED)) {
    assert.match(readFileSync(path.join(repoRoot, f), 'utf8'), SHAPE, `${f} no longer needs its allowance`);
  }
});
