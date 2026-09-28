// toss-lib-ref.test.mjs — which web-tools ref a TOSSED page's library boots at.
//
// The question this answers is the one the showing consolidation plan
// (docs/showing-consolidation.md, experiment E2) turns on: when toss-render
// frames a page, does the page's own lib chain load the version the address
// meant? toss-render hands the framed page its ref by patching
// URLSearchParams.prototype.get so a lookup of `use` answers the subject's @ref,
// and lib/entry.js reads `?ref=` off its own import URL, then `use`, then main.
//
// Nothing here fetches. The real addressHtml prelude is lifted out of
// toss-render.html, mounted in a jsdom realm the way the frame mounts it, and
// entry.js's own ref expression is evaluated inside that realm. So the answers
// are the shipped code's answers, not a model of them.
//
// Three cases were held as `todo` from 2026-09-27 until the renderer's ?lib=
// and the scoped params shim landed on 2026-09-28: a cross-repo page booting a
// web-tools ref named after its own repo's branch, a page query `ref`
// re-pinning the library, and an unrelated URLSearchParams answering `use`.
// They are ordinary tests now. Each case prints what it observed, so the
// answer is on the record in the test output.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const SRC = fs.readFileSync(new URL('../../pages/toss-render.html', import.meta.url), 'utf8');
const ENTRY = fs.readFileSync(new URL('../../lib/entry.js', import.meta.url), 'utf8');

// Same brace-matching lift as toss-inline-deps.test.mjs: run the shipped
// source, not a copy that could drift from it.
function lift(name) {
  let start = SRC.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} not found in toss-render.html`);
  const open = SRC.indexOf('(', start);
  let depth = 0, afterParams = -1;
  for (let j = open; j < SRC.length; j++) {
    if (SRC[j] === '(') depth++;
    else if (SRC[j] === ')' && --depth === 0) { afterParams = j + 1; break; }
  }
  depth = 0;
  for (let j = SRC.indexOf('{', afterParams); j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}' && --depth === 0) return SRC.slice(start, j + 1);
  }
  throw new Error(`unbalanced braces lifting ${name}`);
}

const { addressHtml, libRef } = new Function(
  [lift('hashNavigationShim'), lift('fetchShim'), lift('libRef'), lift('addressHtml')].join('\n') +
  '; return { addressHtml, libRef };')();

// entry.js's ref expression, read off the file so a change to its precedence
// changes what this test evaluates. `import.meta.url` becomes a parameter.
const refExpr = (ENTRY.match(/const ref = ([\s\S]*?);\n/) || [])[1];
assert.ok(refExpr, 'entry.js no longer declares `const ref = …;`');

// Frame one tossed page: the prelude toss-render stamps into it, mounted in a
// realm of its own, then entry.js's ref resolved inside that realm.
// `asked` is the renderer's own ?lib=; showAddress resolves it through libRef
// exactly this way before it builds the prelude.
function libRefFor({ owner = 'mehrlander', name, ref, path = 'pages/x.html', pageQuery = '', asked = null,
                     importUrl = 'https://mehrlander.github.io/web-tools/lib/entry.js', extra = '' }) {
  const handed = libRef(owner + '/' + name, ref, asked || new URLSearchParams(pageQuery).get('lib'));
  const html = addressHtml('<!doctype html><html><head></head><body></body></html>',
    { owner, name, ref, path, pageQuery, lib: handed });
  const { window } = new JSDOM(html, { runScripts: 'dangerously', url: 'https://mehrlander.github.io/' });
  const lib = window.eval(`(function(u){ return ${refExpr.replace(/import\.meta\.url/g, 'u')}; })`)(importUrl);
  const other = extra ? window.eval(extra) : undefined;
  window.close();
  return { lib, other };
}

test('a web-tools page tossed at a branch boots its lib at that branch', (t) => {
  const { lib } = libRefFor({ name: 'web-tools', ref: 'claude/x' });
  t.diagnostic(`observed lib ref: ${lib}`);
  assert.equal(lib, 'claude/x');
});

test('a web-tools page tossed with no @ref boots main', (t) => {
  const { lib } = libRefFor({ name: 'web-tools', ref: '' });
  t.diagnostic(`observed lib ref: ${lib}`);
  assert.equal(lib, 'main');
});

test('a page query `use` cannot override the addressed ref', (t) => {
  const { lib } = libRefFor({ name: 'web-tools', ref: 'claude/x', pageQuery: 'use=claude/other' });
  t.diagnostic(`observed lib ref: ${lib}`);
  assert.equal(lib, 'claude/x');
});

test('a cross-repo page that pins its import with ?ref= keeps its pin', (t) => {
  const { lib } = libRefFor({ name: 'home', ref: 'claude/x',
    importUrl: 'https://mehrlander.github.io/web-tools/lib/entry.js?ref=main' });
  t.diagnostic(`observed lib ref: ${lib}`);
  assert.equal(lib, 'main');
});

// shortcut-tools/pages/library.html imports entry.js with no ?ref=. The @ref in
// the address names a shortcut-tools branch, and it is handed to the page as
// `use`, which entry.js reads as a WEB-TOOLS ref: a 404 on raw, or, where the
// same branch name exists in both repos, that web-tools branch in silence.
test('a cross-repo page with a plain entry.js import boots web-tools main', (t) => {
  const { lib } = libRefFor({ name: 'shortcut-tools', ref: 'claude/x', path: 'pages/library.html' });
  t.diagnostic(`observed lib ref: ${lib}`);
  assert.equal(lib, 'main');
});

// repo-atlas, shortcuts and shortcut-edit read a `ref` query of their own. The
// patched get() answers the page query for EVERY URLSearchParams in the frame,
// including the one entry.js builds from its own import URL.
test('a page query `ref` does not re-pin the library', (t) => {
  const { lib } = libRefFor({ name: 'web-tools', ref: 'claude/x', path: 'pages/repo-atlas.html',
    pageQuery: 'repo=mehrlander/home&ref=feature' });
  t.diagnostic(`observed lib ref: ${lib}`);
  assert.equal(lib, 'claude/x');
});

test('an unrelated URLSearchParams in the frame answers only its own keys', (t) => {
  const { other } = libRefFor({ name: 'web-tools', ref: 'claude/x',
    extra: "new URLSearchParams('a=1').get('use')" });
  t.diagnostic(`observed get('use') on 'a=1': ${other}`);
  assert.equal(other, null);
});

// ── the renderer's ?lib= ─────────────────────────────────────────────────────
// Added 2026-09-28: the Web Tools ref picked apart from the page's own ref.

test('the renderer ?lib= picks a web-tools page library apart from the page ref', (t) => {
  const { lib } = libRefFor({ name: 'web-tools', ref: 'claude/page', asked: 'claude/lib' });
  t.diagnostic(`observed lib ref: ${lib}`);
  assert.equal(lib, 'claude/lib');
});

test('the renderer ?lib= reaches a cross-repo page too, under both names it reads', (t) => {
  const { lib, other } = libRefFor({ name: 'home', ref: 'claude/x', asked: 'claude/lib',
    extra: "[new URLSearchParams(location.search).get('lib'), window.__lib, window.__ref]" });
  assert.equal(lib, 'claude/lib');
  assert.deepEqual([...other], ['claude/lib', 'claude/lib', 'claude/x'], 'lib and __lib name the library; __ref stays the page ref');
});

test('a page reads its own address through URL too', (t) => {
  const { other } = libRefFor({ name: 'web-tools', ref: 'claude/x', pageQuery: 'view=stage',
    extra: "new URL(location.href).searchParams.get('view')" });
  assert.equal(other, 'stage');
});

test('with no explicit version the rule applies', () => {
  assert.equal(libRef('mehrlander/home', 'claude/x', null), 'main');
  assert.equal(libRef('mehrlander/web-tools', '', null), '');
});

test('a page query `lib` still picks the library when the renderer says nothing', (t) => {
  // Links minted before the renderer had a ?lib= carried it in the page query
  // (home's budget-drs pages read it). They must keep meaning what they meant.
  const { lib, other } = libRefFor({ name: 'home', ref: 'claude/x', pageQuery: 'lib=claude/old',
    extra: "new URLSearchParams(location.search).get('use')" });
  assert.equal(lib, 'claude/old');
  assert.equal(other, 'claude/old', 'a plain entry.js import reads the same version as use');
});

test('the renderer ?lib= wins over a page query `lib`', () => {
  const { lib } = libRefFor({ name: 'home', ref: 'claude/x', pageQuery: 'lib=claude/old', asked: 'claude/new' });
  assert.equal(lib, 'claude/new');
});
