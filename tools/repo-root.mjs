// tools/repo-root.mjs: where the repo is, and nothing else.
//
// It sat in tools/test/bootstrap.mjs, which is the right place for a test
// helper and the wrong place for this one: bootstrap imports jsdom at the top
// level, so every consumer of `repoRoot` needed a DOM installed. That is
// invisible while the only consumers are tests, since the suite has jsdom
// anyway. It stops being invisible the moment something outside the suite needs
// it, which is how it was found: scripts/derived-csv-merge.mjs is a git merge
// driver, git runs it during a merge in whatever clone it lands in, and a clone
// with no node_modules died on `Cannot find package 'jsdom'` before reading a
// line of CSV. A merge driver that only works where the dev dependencies are
// installed is not one.
//
// bootstrap.mjs re-exports this, so all 207 of its importers are unaffected and
// this file is additive rather than a migration.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
