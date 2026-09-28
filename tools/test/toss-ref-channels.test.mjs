// toss-ref-channels.test.mjs — the three channels by which a version reaches a
// framed page, and what each one means.
//
// addressHtml in pages/toss-render.html stamps a prelude into every page it
// renders in address mode. Three things in it carry a ref:
//
//   use           injected into the page's reads of its own address: the
//                 EFFECTIVE Web Tools ref libRef resolved, an explicit ask
//                 (the renderer's ?lib=, else the page query's lib), else the
//                 page's own ref for a page of web-tools, else main. entry.js
//                 and the pre-built bundles read it. `lib` is never invented:
//                 it reaches the page only from its own page query.
//   window.__lib  stamped only when a version was ASKED for, so a page that
//                 frames views of its own can pass a selection on without
//                 mistaking a default for one.
//   window.__ref  the SUBJECT repo's own ref, for any subject.
//
// Two defects shaped this. Until 2026-09-28 `use` was the addressed ref for
// every subject, so a page in another repo importing plain entry.js was told to
// load web-tools at a branch of ITS repo (PR #825, case C9). PR #823 fixed that
// by injecting `use` for web-tools pages only; this file started there, and the
// combined rule keeps its point while telling every page the one ref it should
// load, under every name it might read it by.
//
// The function lives in the page's inline script, so it is lifted out by brace
// matching, the same tactic as toss-inline-deps.test.mjs.

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


// addressHtml stamps the renderer's selection (SELECTED) and the resolver's
// source (refForSource), both module-level in the page: declared here from
// the shipped source, so the prelude under test is the real one.
const SELECTION_SCOPE = 'let SELECTED = {};\n' + lift('refForIn') + '\n' +
  (SRC.match(/const refForSource = [\s\S]*?;\n/) || [''])[0];
const { addressHtml, libRef } = new Function(SELECTION_SCOPE +
  lift('fetchShim') + '\n' + lift('hashNavigationShim') + '\n' + lift('libRef') + '\n' + lift('addressHtml') +
  '\nreturn { addressHtml, libRef };')();

// What showAddress does: resolve the explicit ask, then the effective ref.
const render = (o, hostLib = '') => {
  const libAsked = hostLib || new URLSearchParams(o.pageQuery || '').get('lib') || '';
  const lib = libRef(o.owner + '/' + o.name, o.ref, libAsked);
  return addressHtml(PAGE, { ...o, lib, libAsked });
};

const PAGE = '<!doctype html><html><head><title>t</title></head><body>x</body></html>';
const injected = (html) => {
  const m = html.match(/var P=(\{[^;]*\}),O=Object/);
  return m ? JSON.parse(m[1]) : null;
};
const stamp = (html, name) => {
  const m = html.match(new RegExp('window\\.' + name + '=("[^"]*")'));
  return m ? JSON.parse(m[1]) : undefined;
};

test('a page of web-tools at a ref: __ref and the effective use name that ref; no lib, no __lib', () => {
  const html = render({ owner: 'mehrlander', name: 'web-tools', ref: 'feature-b', path: 'pages/x.html', pageQuery: '' });
  assert.equal(stamp(html, '__ref'), 'feature-b');
  assert.deepEqual(injected(html), { use: 'feature-b' }, 'the default travels as use only');
  assert.equal(stamp(html, '__lib'), undefined, 'nothing was asked for, so nothing is stamped');
  assert.match(html, /<base href="https:\/\/mehrlander\.github\.io\/web-tools\/pages\/">/);
  assert.match(html, /window\.__fabHosted=true/);
});

test('a page in another repo at a ref: __ref names its ref, use names main', () => {
  const html = render({ owner: 'mehrlander', name: 'home', ref: 'feature-b', path: 'projects/p/page.html', pageQuery: 'view=x' });
  assert.equal(stamp(html, '__ref'), 'feature-b');
  assert.deepEqual(injected(html), { view: 'x', use: 'main' }, 'the page query rides; use is a web-tools ref, never this repo\'s');
  assert.equal(stamp(html, '__lib'), undefined);
});

test('an asked-for version reaches use and __lib, for any subject', () => {
  const home = render({ owner: 'mehrlander', name: 'home', ref: 'feature-b', path: 'p.html', pageQuery: '' }, 'wt-branch');
  assert.equal(stamp(home, '__lib'), 'wt-branch');
  assert.equal(stamp(home, '__ref'), 'feature-b');
  assert.deepEqual(injected(home), { use: 'wt-branch' }, 'the ask rides as use and as __lib');
  // A web-tools page and its library at two refs.
  const hub = render({ owner: 'mehrlander', name: 'web-tools', ref: 'feature-b', path: 'pages/x.html', pageQuery: '' }, 'wt-branch');
  assert.equal(stamp(hub, '__lib'), 'wt-branch');
  assert.deepEqual(injected(hub), { use: 'wt-branch' });
  // A `lib` in the page query is an ask too, and the renderer's own wins over it.
  const page = render({ owner: 'mehrlander', name: 'home', ref: 'feature-b', path: 'p.html', pageQuery: 'lib=old' });
  assert.equal(stamp(page, '__lib'), 'old');
  assert.equal(stamp(render({ owner: 'mehrlander', name: 'home', ref: 'feature-b', path: 'p.html', pageQuery: 'lib=old' }, 'new'), '__lib'), 'new');
  // entry.js's order: ?ref= on the import, then __lib, then ?use=, then main.
  const src = fs.readFileSync(new URL('../../lib/entry.js', import.meta.url), 'utf8');
  const entry = src.slice(src.indexOf('const ref ='));
  const order = entry.indexOf("searchParams.get('ref')") < entry.indexOf('window.__lib')
    && entry.indexOf('window.__lib') < entry.indexOf("get('use')");
  assert.ok(order, 'entry.js must read ?ref=, then window.__lib, then ?use=');
});

test('a web-tools page with no ref: nothing stamped, nothing injected, so it reads its own defaults', () => {
  const html = render({ owner: 'mehrlander', name: 'web-tools', ref: '', path: 'pages/x.html', pageQuery: '' });
  assert.equal(stamp(html, '__ref'), undefined);
  assert.equal(injected(html), null);
});
