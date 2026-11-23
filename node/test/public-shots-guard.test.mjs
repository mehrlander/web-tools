// The scripts that commit screenshots to this public repository read public
// siblings only (node/render/cdn.mjs, SHOT_SIBLINGS). A page that reads a
// private repository beside this checkout must paint it as missing in a shot,
// the way GitHub answers that repository to a reader with no token.
//
// ui-shots.mjs and component-shots.mjs have set the guard since 2026-10-06.
// pages-shots.mjs set none until 2026-11-22, and pages/thumbs/compactions.png
// showed a private session's compaction summary read from web-tools-private.
// pages-shots is checked by behavior: its environment, applied to the
// resolver, keeps a private sibling's file out of a render. The other two
// build their environment inline in a loop that also launches browsers, so
// they are checked by their source.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';
import { resolveCdn } from '../render/cdn.mjs';
import { shotEnv } from '../build/pages-shots.mjs';
import { PUBLIC_SIBLINGS } from '../build/ui-recipes.mjs';

// An estate in a temp directory: a hub checkout and a private sibling holding
// one file, so the test does not depend on which siblings this machine has.
function estate() {
  const dir = mkdtempSync(path.join(tmpdir(), 'shots-guard-'));
  const hub = path.join(dir, 'web-tools');
  mkdirSync(hub);
  mkdirSync(path.join(dir, 'secret-store', '.git'), { recursive: true });
  writeFileSync(path.join(dir, 'secret-store', 'notes.json'), '{"private":true}');
  return { dir, hub };
}
const URL_ = 'https://api.github.com/repos/mehrlander/secret-store/contents/notes.json';

function withEnv(env, fn) {
  const saved = process.env.SHOT_SIBLINGS;
  if (env.SHOT_SIBLINGS == null) delete process.env.SHOT_SIBLINGS;
  else process.env.SHOT_SIBLINGS = env.SHOT_SIBLINGS;
  try { return fn(); } finally {
    if (saved == null) delete process.env.SHOT_SIBLINGS; else process.env.SHOT_SIBLINGS = saved;
  }
}

test('pages-shots runs each shot with the public siblings only', () => {
  const env = shotEnv({ PATH: '/bin' });
  assert.equal(env.SHOT_SIBLINGS, PUBLIC_SIBLINGS.join(','));
  assert.equal(env.PATH, '/bin', 'the rest of the environment passes through');
});

test("pages-shots' environment keeps a private sibling's file out of a render", () => {
  const { dir, hub } = estate();
  try {
    // Without the guard the resolver serves the sibling's file: the leak.
    const open = withEnv({}, () => resolveCdn(URL_, hub));
    assert.equal(open.kind, 'fulfill');
    assert.match(String(open.tag), /^api secret-store\/notes\.json/);
    // With pages-shots' environment it does not.
    const guarded = withEnv(shotEnv({}), () => resolveCdn(URL_, hub));
    assert.ok(!String(guarded.tag || '').startsWith('api secret-store/'),
      `a guarded render served the private sibling: ${guarded.tag}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('ui-shots and component-shots set the guard for public shots', () => {
  const src = (f) => readFileSync(path.join(repoRoot, 'node/build', f), 'utf8');
  assert.match(src('ui-shots.mjs'),
    /store\.name === 'public' \? \{ SHOT_SIBLINGS: PUBLIC_SIBLINGS\.join\(','\) \}/,
    'ui-shots: a public unit shot without SHOT_SIBLINGS');
  assert.match(src('component-shots.mjs'), /SHOT_SIBLINGS: PUBLIC_SIBLINGS\.join\(','\)/,
    'component-shots: shots without SHOT_SIBLINGS');
});
