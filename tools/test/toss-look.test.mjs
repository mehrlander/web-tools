// toss-look.test.mjs — withLook, the renderer adding lib/kits/look.js to a
// tossed page whose trailing fragment asks for a look marker.
//
// The renderer is the one page every toss link passes through, so the guard
// that matters most is the one that does nothing: a fragment with no look key
// must leave the page byte for byte as it was, and a page that already loads
// the kit must not get a second copy. After that, the kit has to arrive after
// the page's own scripts, at the Web Tools version the render boots, and a
// failed fetch must cost the marker and nothing else.
//
// Lifted out of the page by brace matching and run against stubs, the tactic
// toss-inline-deps.test.mjs uses for the inliner beside it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SRC = fs.readFileSync(new URL('../../pages/toss-render.html', import.meta.url), 'utf8');

function lift(name) {
  let start = SRC.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} not found in toss-render.html`);
  if (SRC.slice(start - 6, start) === 'async ') start -= 6;
  const open = SRC.indexOf('(', start);
  let depth = 0, after = -1;
  for (let j = open; j < SRC.length; j++) {
    if (SRC[j] === '(') depth++;
    else if (SRC[j] === ')' && --depth === 0) { after = j + 1; break; }
  }
  depth = 0;
  for (let j = SRC.indexOf('{', after); j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}' && --depth === 0) return SRC.slice(start, j + 1);
  }
  throw new Error(`unbalanced braces lifting ${name}`);
}

const KITS = {
  'lib/kits/land.js': 'window.Land = { mark() {} };',
  'lib/kits/look.js': 'window.Look = { start() {} }; var s = "</' + 'script>";',
};

function build(files = KITS) {
  const fetched = [];
  const fn = new Function('ghText', `${lift('escapeClose')}\n${lift('withLook')}\nreturn withLook;`);
  const ghText = async (owner, name, ref, p) => {
    fetched.push(`${owner}/${name}@${ref}:${p}`);
    if (!(p in files)) throw new Error('HTTP 404');
    return files[p];
  };
  return { withLook: fn(ghText), fetched };
}

const PAGE = '<!doctype html><html><head></head><body><p id="x">x</p><script>window.page = 1;</' + 'script></body></html>';

test('no look key in the fragment: the page is untouched and nothing is fetched', async () => {
  const { withLook, fetched } = build();
  for (const frag of ['', 'tab=x', 'gh=o/r&pr=12', 'showcase=1', 'x=show=y']) {
    assert.equal(await withLook(PAGE, frag, 'main'), PAGE, `frag ${JSON.stringify(frag)}`);
  }
  assert.deepEqual(fetched, []);
});

test('a look key on a page without the kit brings Land and Look, at the boot version, after the page\'s scripts', async () => {
  const { withLook, fetched } = build();
  const out = await withLook(PAGE, 'tab=x&tap=x&say=hi', 'abc123');
  assert.deepEqual(fetched, ['mehrlander/web-tools@abc123:lib/kits/land.js', 'mehrlander/web-tools@abc123:lib/kits/look.js']);
  const land = out.indexOf('window.Land ='), look = out.indexOf('window.Look ='), own = out.indexOf('window.page = 1');
  assert.ok(own < land && land < look, 'the page runs first, then Land, then Look');
  assert.ok(look < out.lastIndexOf('</body>'), 'inside the body, before it closes');
  assert.ok(!out.includes('"</' + 'script>"'), 'a close tag inside a kit is escaped, so it cannot end its script early');
});

test('a page that already loads the kit is left alone, and one that loads Land gets Look only', async () => {
  let { withLook, fetched } = build();
  const loads = PAGE.replace('<head>', '<head><script src="../lib/kits/look.js"></' + 'script>');
  assert.equal(await withLook(loads, 'show=x', 'main'), loads);
  const inlined = PAGE.replace('window.page = 1;', 'window.Look = {};');
  assert.equal(await withLook(inlined, 'show=x', 'main'), inlined);
  assert.deepEqual(fetched, []);
  ({ withLook, fetched } = build());
  await withLook(PAGE.replace('window.page = 1;', 'window.Land = {};'), 'walk=w', 'main');
  assert.deepEqual(fetched, ['mehrlander/web-tools@main:lib/kits/look.js']);
});

test('a failed fetch costs the marker and nothing else', async () => {
  const { withLook } = build({});
  assert.equal(await withLook(PAGE, 'show=x', 'main'), PAGE);
});

test('a page with no closing body still gets the kit, at the end', async () => {
  const { withLook } = build();
  const out = await withLook('<p>bare fragment of html', 'steps=W10', 'main');
  assert.ok(out.startsWith('<p>bare fragment of html<script>window.Land'));
});
