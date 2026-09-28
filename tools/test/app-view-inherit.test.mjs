// app-view-inherit.test.mjs — what a view the web-tools app frames inherits
// from the app: its page ref and its Web Tools version.
//
// The app frames a promoted page through the toss renderer, so the address it
// builds (appViewAddress in app/index.html) is the only thing that carries the
// app's selections down a level. Anything it drops, the view re-derives from
// its own address, silently.
//
// The regression this exists for, reported against 70036ba: an app tossed at a
// branch with ?lib=main (window.__ref 'page-branch', window.__lib 'main')
// framing a web-tools view with no ref addressed the view at page-branch and
// dropped the main, so the view defaulted its library to page-branch. The rule
// now: a view's own selection wins, then an explicit one of the app's, then the
// view's own default; an explicit main is a selection like any other.
//
// The method lives in the page's inline Alpine component, so it is lifted out
// by brace matching and run as a plain function, the same tactic as the toss
// tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const SRC = fs.readFileSync(new URL('../../app/index.html', import.meta.url), 'utf8');

function liftMethod(sig) {
  const start = SRC.indexOf(sig);
  assert.notEqual(start, -1, `${sig} not found in app/index.html`);
  let depth = 0;
  for (let j = SRC.indexOf('{', start + sig.length - 1); j < SRC.length; j++) {
    if (SRC[j] === '{') depth++;
    else if (SRC[j] === '}' && --depth === 0) return 'function ' + SRC.slice(start, j + 1);
  }
  throw new Error('unbalanced braces');
}
const appViewAddress = new Function(liftMethod('appViewAddress(v, ctx){') + '\nreturn appViewAddress;')();

const HUB = 'mehrlander/web-tools';
const R = '../pages/toss-render.html';
const wt = (extra = {}) => ({ repo: HUB, path: 'pages/diff-tool.html', ...extra });
const home = (extra = {}) => ({ repo: 'mehrlander/home', path: 'projects/p/page.html', ...extra });
const at = (appRef, appLib) => ({ hub: HUB, appRef, appLib });

test('an explicit main library survives into a web-tools view at the app branch (the regression)', () => {
  assert.equal(appViewAddress(wt(), at('page-branch', 'main')),
    R + '?lib=main#gh=' + HUB + '@page-branch:pages/diff-tool.html');
});

test('with no explicit library, nothing rides and the view derives its own', () => {
  assert.equal(appViewAddress(wt(), at('page-branch', '')),
    R + '#gh=' + HUB + '@page-branch:pages/diff-tool.html', 'a web-tools view then runs its own ref');
  assert.equal(appViewAddress(home(), at('page-branch', '')),
    R + '#gh=mehrlander/home:projects/p/page.html', 'another repo takes no app ref, and runs main');
});

test('an explicit library reaches a view of another repo, which takes no page ref', () => {
  assert.equal(appViewAddress(home(), at('page-branch', 'lib-branch')),
    R + '?lib=lib-branch#gh=mehrlander/home:projects/p/page.html');
});

test('a view that names its ref keeps it, and an explicit app library still rides', () => {
  assert.equal(appViewAddress(wt({ ref: 'view-branch' }), at('page-branch', '')),
    R + '#gh=' + HUB + '@view-branch:pages/diff-tool.html', 'the view ref wins; its library follows it');
  assert.equal(appViewAddress(wt({ ref: 'view-branch' }), at('page-branch', 'main')),
    R + '?lib=main#gh=' + HUB + '@view-branch:pages/diff-tool.html');
});

test('a view that carries its own lib keeps it, and the app selection does not override', () => {
  assert.equal(appViewAddress(wt({ query: 'lib=view-lib&view=x' }), at('page-branch', 'main')),
    R + '#gh=' + HUB + '@page-branch:pages/diff-tool.html?lib=view-lib&view=x');
});

test('an app at main passes no page ref down', () => {
  assert.equal(appViewAddress(wt(), at('main', '')), R + '#gh=' + HUB + ':pages/diff-tool.html');
  assert.equal(appViewAddress(wt(), at('', '')), R + '#gh=' + HUB + ':pages/diff-tool.html', 'the deployed app has no page ref');
});

test('the getter hands the method the app state: __ref and __lib tossed, a real ?use= deployed', () => {
  const getter = SRC.slice(SRC.indexOf('get appViewUrl(){'), SRC.indexOf('get appViewUrl(){') + 600);
  assert.match(getter, /window\.__fabHosted === true/);
  assert.match(getter, /tossed \? \(window\.__lib \|\| ''\) : \(new URLSearchParams\(location\.search\)\.get\('use'\)/);
});

// ── inside a toss, where the params shim is live ─────────────────────────────
// The tests above run in Node, where URLSearchParams is unpatched. Inside a
// toss the renderer's shim answers an EMPTY instance with the page address, so
// a method that parsed an empty view query read the app's own injected lib as
// the view's (the selection probe caught it, case X5d). Run the method in a
// realm carrying the real prelude.

import { JSDOM } from 'jsdom';
const TOSS = fs.readFileSync(new URL('../../pages/toss-render.html', import.meta.url), 'utf8');
function liftFn(name) {
  const start = TOSS.indexOf(`function ${name}(`);
  const open = TOSS.indexOf('(', start);
  let depth = 0, after = -1;
  for (let j = open; j < TOSS.length; j++) { if (TOSS[j] === '(') depth++; else if (TOSS[j] === ')' && --depth === 0) { after = j + 1; break; } }
  depth = 0;
  for (let j = TOSS.indexOf('{', after); j < TOSS.length; j++) { if (TOSS[j] === '{') depth++; else if (TOSS[j] === '}' && --depth === 0) return TOSS.slice(start, j + 1); }
  throw new Error('unbalanced');
}
const { addressHtml } = new Function(['hashNavigationShim', 'fetchShim', 'addressHtml'].map(liftFn).join('\n') + '\nreturn { addressHtml };')();

test('inside a toss with ?lib=main, the app still forwards main to a view with no query of its own', () => {
  // The app, tossed at page-branch with the renderer's ?lib=main.
  const html = addressHtml('<!doctype html><html><head></head><body></body></html>',
    { owner: 'mehrlander', name: 'web-tools', ref: 'page-branch', path: 'app/index.html',
      pageQuery: 'view=app&lib=main', lib: 'main', libAsked: 'main' });
  const { window } = new JSDOM(html, { runScripts: 'dangerously', url: 'https://mehrlander.github.io/' });
  assert.equal(window.eval("new URLSearchParams('').get('lib')"), 'main', 'the shim answers an empty parse with the page query');
  const fn = window.eval('(' + liftMethod('appViewAddress(v, ctx){') + ')');
  const got = fn({ repo: HUB, path: 'pages/diff-tool.html' }, { hub: HUB, appRef: 'page-branch', appLib: 'main' });
  window.close();
  assert.equal(got, R + '?lib=main#gh=' + HUB + '@page-branch:pages/diff-tool.html');
});
