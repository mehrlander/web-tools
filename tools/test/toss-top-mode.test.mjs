// toss-top-mode.test.mjs — the renderer's top mode (?top): the page becomes the
// tab's document, with the prelude a frame gets and two shims of its own.
//
// In a frame the page has no query of its own and the renderer answers its
// reads; at the top level the page's query is the tab's real query, of which
// the renderer owns some keys (`top`, the address `gh` or a route key, and the
// selection `refs`/`lib`). So the params shim hides the renderer's keys from
// the page and answers the defaults, and the history shim keeps them in every
// URL the page writes, which is what lets a view switch, Back and a reload
// keep both the page and its versions. The shipped prelude is lifted out of
// pages/toss-render.html and run in a jsdom realm at a top-mode URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const SRC = fs.readFileSync(new URL('../../pages/toss-render.html', import.meta.url), 'utf8');
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
  throw new Error('unbalanced braces lifting ' + name);
}
const routes = (SRC.match(/const TOSS_ROUTES = \{[\s\S]*?\n {2}\};\n/) || [''])[0];
const hidden = (SRC.match(/const topHidden = [^\n]*\n/) || [''])[0];
assert.ok(routes && hidden, 'TOSS_ROUTES or topHidden moved');

// addressHtml as showAddress calls it in top mode, with the renderer's own
// query in scope, since its keys are what the shims preserve.
function topPage(rendererUrl, { owner = 'mehrlander', name = 'web-tools', ref = 'br', path = 'app/index.html', lib = 'br' } = {}) {
  const queryParams = new URL(rendererUrl).searchParams;
  const build = new Function('queryParams', 'location',
    'let SELECTED = {};\n' + lift('refForIn') + '\n' + (SRC.match(/const refForSource = [\s\S]*?;\n/) || [''])[0] +
    routes + hidden + ['topOwned', 'topHistoryShim', 'topParamsShim', 'hashNavigationShim', 'fetchShim', 'libRef', 'addressHtml'].map(lift).join('\n') +
    '\nreturn addressHtml;');
  const addressHtml = build(queryParams, new URL(rendererUrl));
  const html = addressHtml('<!doctype html><html><head></head><body></body></html>',
    { owner, name, ref, path, pageQuery: '', lib, libAsked: '', top: { addr: queryParams.get('gh'), repo: owner + '/' + name, path } });
  return new JSDOM(html, { runScripts: 'dangerously', url: rendererUrl }).window;
}

const R = 'https://mehrlander.github.io/web-tools/pages/toss-render.html';

test('the page reads its own query without the renderer\'s keys, and the defaults a frame answers', () => {
  const w = topPage(R + '?top&gh=mehrlander/web-tools@br:app/index.html&refs=mehrlander/home@h&view=map');
  const q = w.eval('new URLSearchParams(location.search)');
  assert.equal(q.get('gh'), null);
  assert.equal(q.has('top'), false);
  assert.equal(q.get('view'), 'map');
  assert.equal(q.get('use'), 'br', 'use answers the Web Tools ref the page boots');
  assert.equal(w.eval('new URLSearchParams(location.search).toString()'), 'refs=mehrlander%2Fhome%40h&view=map');
  assert.equal(w.eval("new URLSearchParams('a=1').get('use')"), null, 'another params object is left alone');
  assert.equal(w.eval('window.__fabHosted'), undefined, 'no shell on screen: the page mounts its own FAB');
  assert.equal(w.eval('window.__tossTop.repo'), 'mehrlander/web-tools');
  w.close();
});

test('a view switch the page writes keeps top, the address and the selection', () => {
  const w = topPage(R + '?top&gh=mehrlander/web-tools@br:app/index.html&lib=main&refs=mehrlander/home@h&view=map');
  w.eval("history.pushState(null, '', '?view=tools#x=1')");
  assert.equal(w.location.search, '?top&gh=mehrlander/web-tools@br:app/index.html&view=tools&lib=main&refs=mehrlander%2Fhome%40h');
  assert.equal(w.location.hash, '#x=1');
  assert.equal(w.location.pathname, '/web-tools/pages/toss-render.html');
  w.eval("history.replaceState(null, '', '?view=pages&lib=own')");
  assert.match(w.location.search, /&lib=own(&|$)/, 'a lib the page itself writes is the page\'s, and wins');
  assert.doesNotMatch(w.location.search, /lib=main/);
  w.close();
});

test('a routed page keeps its route key, and reads its own envelope', () => {
  const w = topPage(R + '?top&refs=mehrlander/web-tools@v&data=mehrlander/home:a.csv',
    { path: 'pages/data-view.html' });
  w.eval("history.replaceState(null, '', '?mode=table')");
  assert.equal(w.location.search, '?top&data=mehrlander/home:a.csv&mode=table&refs=mehrlander%2Fweb-tools%40v');
  assert.equal(w.eval("new URLSearchParams(location.search).get('data')"), null, 'the route key is the renderer\'s');
  w.close();
});

// topAddressInQuery, run in the renderer's own window before the page is
// written: an address in the fragment moves to the query.
function moved(url, pageFrag = '') {
  const w = new JSDOM('', { url }).window;
  const run = new Function('window', 'history', 'location',
    'const queryParams = new URLSearchParams(location.search);\n' +
    'const readFragment = ' + (SRC.match(/function readFragment\([\s\S]*?\n {2}\}\n/) || [''])[0].replace(/^function readFragment/, 'function') + ';\n' +
    'const [hashKey, hashValue] = readFragment(location.hash);\n' +
    routes + hidden + lift('topAddressInQuery') + '\ntopAddressInQuery(' + JSON.stringify(pageFrag) + ');');
  run(w, w.history, w.location);
  const out = w.location.search + w.location.hash;
  w.close();
  return out;
}

test('an address given in the fragment moves to the query, and its own #frag becomes the hash', () => {
  assert.equal(moved(R + '?top&refs=mehrlander/home@h#gh=mehrlander/web-tools@br:app/index.html?view=map#sec', 'sec'),
    '?top&gh=mehrlander/web-tools@br:app/index.html%3Fview%3Dmap&refs=mehrlander/home@h#sec');
  assert.equal(moved(R + '?top#data=mehrlander/home:a.csv'), '?top&data=mehrlander/home:a.csv');
  assert.equal(moved(R + '?top&gh=mehrlander/web-tools:pages/x.html#sec'), '?top&gh=mehrlander/web-tools:pages/x.html#sec',
    'an address already in the query is left alone, and so is a hash that is the page\'s');
});

test('the renderer never boots its own FAB in top mode', () => {
  assert.match(SRC, /if \(!window\.__tossTopMode\) try \{\s*\n\s*await import\('https:\/\/mehrlander\.github\.io\/web-tools\/lib\/entry\.js\?ref=main'\)/);
  assert.match(SRC, /const TOP = queryParams\.has\('top'\) && !queryParams\.has\('w'\);\n\s*window\.__tossTopMode = TOP;/,
    'top mode is decided before anything awaits, and a forced width keeps its frame');
});
