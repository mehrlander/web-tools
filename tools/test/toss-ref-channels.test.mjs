// toss-ref-channels.test.mjs — the three channels by which the addressed ref
// reaches a framed page, kept apart.
//
// addressHtml in pages/toss-render.html stamps a prelude into every page it
// renders in address mode. Three things in that prelude carry a ref, and they
// mean different things: `use`, injected into the page's URLSearchParams reads,
// is the ref lib/entry.js loads the web-tools library at, so it belongs only in
// a page of this repo; window.__ref is the SUBJECT repo's ref, for any subject;
// window.__lib is the web-tools ref for a page in another repo, stamped only
// when the renderer's own query carried ?lib=<ref>.
//
// The defect this exists for: until 2026-09-28 `use` was injected for every
// subject, so a page in another repo importing plain entry.js was told to load
// web-tools at that repo's commit, which web-tools does not have. The budget-drs
// pages avoided it by pinning entry.js?ref= themselves; any other page would
// have booted nothing.
//
// The function lives in the page's inline script, so it is lifted out by brace
// matching and run with its two helpers and the HUB constant handed in, the
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

// The HUB literal the page declares, read rather than retyped, so a rename
// there fails here rather than passing against a stale copy.
const HUB = (SRC.match(/const HUB = '([^']+)'/) || [])[1];
assert.ok(HUB, 'toss-render.html declares no HUB');

const addressHtml = new Function('HUB', 'fetchShim', 'hashNavigationShim',
  lift('fetchShim') + '\n' + lift('hashNavigationShim') + '\n' + lift('addressHtml') + '\nreturn addressHtml;'
)(HUB, null, null);

const PAGE = '<!doctype html><html><head><title>t</title></head><body>x</body></html>';
const injected = (html) => {
  const m = html.match(/var P=(\{[^;]*\}),O=Object/);
  return m ? JSON.parse(m[1]) : null;
};
const stamp = (html, name) => {
  const m = html.match(new RegExp('window\\.' + name + '=("[^"]*")'));
  return m ? JSON.parse(m[1]) : undefined;
};

test('a page of the hub at a ref gets __ref and the injected use, both naming that ref', () => {
  const html = addressHtml(PAGE, { owner: 'mehrlander', name: 'web-tools', ref: 'feature-b', path: 'pages/x.html', pageQuery: '' });
  assert.equal(stamp(html, '__ref'), 'feature-b');
  assert.deepEqual(injected(html), { use: 'feature-b' });
  assert.equal(stamp(html, '__lib'), undefined, 'no ?lib= on the host, so nothing is stamped');
  // The rest of the prelude is untouched by the split.
  assert.match(html, /<base href="https:\/\/mehrlander\.github\.io\/web-tools\/pages\/">/);
  assert.match(html, /window\.__fabHosted=true/);
});

test('a page in another repo at a ref gets __ref and NO use, so its library defaults to main', () => {
  const html = addressHtml(PAGE, { owner: 'mehrlander', name: 'home', ref: 'feature-b', path: 'projects/p/page.html', pageQuery: 'view=x' });
  assert.equal(stamp(html, '__ref'), 'feature-b');
  assert.deepEqual(injected(html), { view: 'x' }, 'the page query still rides; use does not');
  assert.equal(stamp(html, '__lib'), undefined);
});

test('?lib= on the host stamps __lib for any subject, and entry.js reads it before use', () => {
  const home = addressHtml(PAGE, { owner: 'mehrlander', name: 'home', ref: 'feature-b', path: 'p.html', pageQuery: '', lib: 'wt-branch' });
  assert.equal(stamp(home, '__lib'), 'wt-branch');
  assert.equal(stamp(home, '__ref'), 'feature-b');
  assert.equal(injected(home), null, 'still no use for a page outside the hub');
  // A hub page with a lib: the page file at its ref, the lib at the other one.
  const hub = addressHtml(PAGE, { owner: 'mehrlander', name: 'web-tools', ref: 'feature-b', path: 'pages/x.html', pageQuery: '', lib: 'wt-branch' });
  assert.equal(stamp(hub, '__lib'), 'wt-branch');
  assert.deepEqual(injected(hub), { use: 'feature-b' });
  // entry.js's order is what makes that mean lib-at-wt-branch: ?ref= on the
  // import, then __lib, then ?use=, then main.
  const src = fs.readFileSync(new URL('../../lib/entry.js', import.meta.url), 'utf8');
  const entry = src.slice(src.indexOf('const ref ='));   // the code, past the comment
  const order = entry.indexOf("searchParams.get('ref')") < entry.indexOf('window.__lib')
    && entry.indexOf('window.__lib') < entry.indexOf("get('use')");
  assert.ok(order, 'entry.js must read ?ref=, then window.__lib, then ?use=');
});

test('no ref addressed: nothing is stamped and nothing injected, so the page reads its own defaults', () => {
  const html = addressHtml(PAGE, { owner: 'mehrlander', name: 'web-tools', ref: '', path: 'pages/x.html', pageQuery: '' });
  assert.equal(stamp(html, '__ref'), undefined);
  assert.equal(injected(html), null);
});
