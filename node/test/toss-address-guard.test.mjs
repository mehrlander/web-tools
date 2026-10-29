// toss-address-guard.test.mjs — repoContentsUrl and showAddress's path guard in
// pages/toss-render.html.
//
// Address mode renders same-origin (with token access) because it checks that
// the addressed owner is in OWNERS. Before repoContentsUrl, the API URL was
// assembled by string concatenation (`apiBase + '/contents/' + path`), so dot
// segments (`..`, `%2e%2e`), backslashes, or traversal in `name` or `path`
// were normalized by fetch()'s URL parser and climbed out of
// `/repos/<owner>/<name>/contents/` into another repository on api.github.com.
//
// Lifts the real functions out of pages/toss-render.html by brace matching, the
// same tactic as toss-inline-deps.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SRC = fs.readFileSync(new URL('../../pages/toss-render.html', import.meta.url), 'utf8');

function lift(name) {
  let start = SRC.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} not found in toss-render.html`);
  if (SRC.slice(start - 6, start) === 'async ') start -= 6;

  const open = SRC.indexOf('(', start);
  let depth = 0, afterParams = -1;
  for (let j = open; j < SRC.length; j++) {
    if (SRC[j] === '(') depth++;
    else if (SRC[j] === ')' && --depth === 0) { afterParams = j + 1; break; }
  }
  assert.notEqual(afterParams, -1, `unbalanced parens lifting ${name}`);

  depth = 0;
  for (let j = SRC.indexOf('{', afterParams); j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}' && --depth === 0) return SRC.slice(start, j + 1);
  }
  throw new Error(`unbalanced braces lifting ${name}`);
}

const repoContentsUrl = new Function(`${lift('repoContentsUrl')}; return repoContentsUrl;`)();

test('ordinary repository paths resolve under the repository contents endpoint', () => {
  assert.equal(
    repoContentsUrl('mehrlander', 'web-tools', 'pages/index.html', 'main'),
    'https://api.github.com/repos/mehrlander/web-tools/contents/pages/index.html?ref=main'
  );
  assert.equal(
    repoContentsUrl('mehrlander', 'web-tools', 'pages/drop/json-viewers.html', 'claude/branch-name'),
    'https://api.github.com/repos/mehrlander/web-tools/contents/pages/drop/json-viewers.html?ref=claude%2Fbranch-name'
  );
});

test('dot segments, encoded traversal, backslashes, and empty segments are refused', () => {
  const hostile = [
    ['mehrlander', 'web-tools', '../../../stranger/repo/contents/page.html'],
    ['mehrlander', 'web-tools', 'pages/../../../../stranger/repo/contents/page.html'],
    ['mehrlander', 'web-tools', '%2e%2e/%2e%2e/%2e%2e/stranger/repo/contents/page.html'],
    ['mehrlander', 'web-tools', '..\\..\\..\\stranger\\repo\\contents\\page.html'],
    ['mehrlander', 'web-tools', './pages/index.html'],
    ['mehrlander', 'web-tools', '/pages/index.html'],
    ['mehrlander', 'web-tools', 'pages//index.html'],
    ['mehrlander', '..', 'pages/index.html'],
    ['mehrlander', 'web-tools%2f..%2fstranger', 'pages/index.html'],
    ['mehrlander', '', 'pages/index.html'],
    ['mehrlander', 'web-tools', ''],
  ];
  for (const [owner, name, p] of hostile) {
    assert.equal(repoContentsUrl(owner, name, p, 'main'), null,
      `expected null for ${owner}/${name}:${p}`);
  }
});

test('showAddress refuses a traversal path before calling fetch', async () => {
  const fetched = [];
  const empties = [];
  const scope = `
    const OWNERS = ['mehrlander'];
    const SELECTED = {};
    const RAW_MEDIA = 'application/vnd.github.raw+json';
    const TOP = false;
    function ghHeaders() { return {}; }
    function showEmpty(msg) { empties.push(msg); }
    ${lift('refForIn')}
    ${lift('splitPin')}
    ${lift('repoContentsUrl')}
    ${lift('showAddress')}
    return showAddress;
  `;
  const showAddress = new Function('fetch', 'empties', scope)(
    async (u) => { fetched.push(u); throw new Error('unexpected fetch: ' + u); },
    empties
  );

  await showAddress('mehrlander/web-tools:../../../stranger/repo/contents/page.html');
  await showAddress('mehrlander/web-tools:%2e%2e/%2e%2e/%2e%2e/stranger/repo/contents/page.html');

  assert.deepEqual(fetched, [], 'fetch is never called for a traversal address');
  assert.equal(empties.length, 2, 'each refused address surfaces through showEmpty');
  assert.match(empties[0], /Invalid repository or file path/);
});
