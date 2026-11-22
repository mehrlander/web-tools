// node/render/cdn.mjs, the esm.sh mirror. It serves a package's ESM entry from
// node_modules and rewrites the file's bare import specifiers to esm.sh URLs,
// so the next hop comes back here too.
//
// Found 2026-10-07: ten demo pages threw `m.javascript is not a function` or
// `htmlLang is not a function` in every headless render. Two causes, one after
// the other. @codemirror/lang-javascript and lang-html were not installed, so
// the mirror answered with an empty module; and once they were, the rewrite
// fired on the words `import` and `export` inside string literals
// (`"@import":204` in @lezer/css, `label: "import"` in lang-javascript) and
// served a file that did not parse. A page that loads an editor through
// lib/kits/cm6.js reaches both packages, so this checks every CodeMirror and
// Lezer package the mirror can serve: each must parse, and none may keep a
// bare specifier a browser could not resolve.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'acorn';
import { repoRoot } from './bootstrap.mjs';
import { resolveCdn } from '../render/cdn.mjs';

const serve = pkg => resolveCdn(`https://esm.sh/${pkg}`, repoRoot);
const scope = s => readdirSync(path.join(repoRoot, 'node_modules', s)).map(n => `${s}/${n}`);

test('the language packages lib/kits/cm6.js imports are served, not skipped', () => {
  for (const pkg of ['@codemirror/lang-javascript', '@codemirror/lang-html']) {
    assert.equal(serve(pkg).kind, 'fulfill', pkg);
  }
});

for (const pkg of ['codemirror', ...scope('@codemirror'), ...scope('@lezer')]) {
  const r = serve(pkg);
  if (r.kind !== 'fulfill') continue;   // a package with no root entry, e.g. legacy-modes
  test(`esm.sh/${pkg} parses after the rewrite and keeps no bare specifier`, () => {
    const body = String(r.body);
    assert.doesNotThrow(() => parse(body, { ecmaVersion: 'latest', sourceType: 'module' }));
    const bare = [...body.matchAll(/^\s*(?:import|export)\b[^'"]*?\bfrom\s*(['"])([^'"]+)\1/gm)]
      .map(m => m[2]).filter(s => !/^(https:|\.)/.test(s));
    assert.deepEqual(bare, []);
  });
}

test('the words import and export inside a string are left alone', () => {
  const css = String(serve('@lezer/css').body);
  assert.match(css, /"@import":\d+/);
  const js = String(serve('@codemirror/lang-javascript').body);
  assert.match(js, /label: "import",/);
});

test('an object key "@import" is not rewritten: the body is served byte for byte', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'cdn-esm-'));
  const dir = path.join(tmp, 'node_modules', 'probepkg');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'probepkg', module: 'index.js' }));
  const text = 'let t,y;t={"@import":1};y="z";export{t,y};\n';
  writeFileSync(path.join(dir, 'index.js'), text);
  assert.equal(String(resolveCdn('https://esm.sh/probepkg', tmp).body), text);
});
