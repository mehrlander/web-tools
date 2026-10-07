// lib/gh-boot.js, LOOK_BOOT: every page that boots the loader takes look links,
// and pays for the two kits only when a fragment asks for a marker.
//
// The cost is the point, so what is pinned is mostly what does NOT happen: no
// load without a look key, no load for a toss shell whose own fragment merely
// carries a page's look keys inside its address, no second load on a later
// hashchange. Then the order (Land before Look), and that a failed Land still
// lets Look arrive, since Look lands without it. gh-boot is network-bound, so
// as in gh-boot-pageboot.test.mjs the function is lifted out and run against
// a stub loader and a stub window rather than driven live.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const SRC = readFileSync(path.join(repoRoot, 'lib/gh-boot.js'), 'utf8');
const decl = SRC.match(/const LOOK_BOOT = \[[^\]]*\];/);
assert.ok(decl, 'LOOK_BOOT is declared in gh-boot.js');
const start = SRC.indexOf('function lookOnDemand(');
let depth = 0, end = -1;
for (let j = SRC.indexOf('{', SRC.indexOf(')', start)); j < SRC.length; j++) {
  if (SRC[j] === '{') depth++;
  else if (SRC[j] === '}' && --depth === 0) { end = j + 1; break; }
}
const lookOnDemand = new Function(`${decl[0]}\n${SRC.slice(start, end)}\nreturn lookOnDemand;`)();

const tick = () => new Promise(r => setTimeout(r, 0));

function run(hash, failing = []) {
  const loaded = [];
  const win = new EventTarget();
  win.location = { hash };
  const gh = { load: async (p) => { loaded.push(p); if (failing.includes(p)) throw new Error('HTTP 404'); } };
  lookOnDemand(gh, win);
  const go = async (h) => { win.location.hash = h; win.dispatchEvent(new Event('hashchange')); await tick(); await tick(); };
  return { loaded, go };
}

test('a fragment with no look key loads nothing', async () => {
  for (const h of ['', '#', '#tab=funds', '#gh=o/r&pr=12', '#showcase=1']) {
    const { loaded } = run(h);
    await tick();
    assert.deepEqual(loaded, [], h);
  }
});

test('a look key at boot loads Land, then Look', async () => {
  const { loaded } = run('#tab=x&tap=btn-export&say=here');
  await tick(); await tick();
  assert.deepEqual(loaded, ['kits/land.js', 'kits/look.js']);
});

test('a look key arriving later loads them then, once', async () => {
  const { loaded, go } = run('#tab=x');
  await go('#tab=y');
  assert.deepEqual(loaded, []);
  await go('#walk=tour');
  assert.deepEqual(loaded, ['kits/land.js', 'kits/look.js']);
  await go('#show=other');
  assert.deepEqual(loaded, ['kits/land.js', 'kits/look.js'], 'the kit takes later changes itself');
});

test('a toss shell carrying a page\'s look keys inside its address loads nothing for itself', async () => {
  const { loaded } = run('#gh=mehrlander/web-tools@abc123:pages/x.html#show=row&say=hi');
  await tick();
  assert.deepEqual(loaded, []);
});

test('Look still arrives when Land cannot be loaded', async () => {
  const { loaded } = run('#show=x', ['kits/land.js']);
  await tick(); await tick();
  assert.deepEqual(loaded, ['kits/land.js', 'kits/look.js']);
});
