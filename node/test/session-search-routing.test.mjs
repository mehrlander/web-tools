import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';
import { makeShell } from './shell.mjs';

test('Activity discussion query and filters survive cold links without changing branch-window grammar', async () => {
  const { shell, events } = makeShell({ search: '?view=sessions&aq=needle&discussion=1&ascope=week&arepo=me%2Ftools&astate=open&window=12h' });
  shell.goSessions = () => { shell.view = 'sessions'; };
  const parsed = shell.parseUrl();
  assert.equal(parsed.window, 0.5);
  await shell.routeFromUrl(parsed);
  const p = shell.deepLinkParams();
  for (const [key, value] of Object.entries({ aq: 'needle', discussion: '1', ascope: 'week', arepo: 'me/tools', astate: 'open' }))
    assert.equal(p.get(key), value);
  const seed = events.find(e => e.type === 'web-tools:session-search-seed').detail;
  assert.deepEqual(seed, { q: 'needle', discussion: true, scope: 'week', repo: 'me/tools', state: 'open' });
  shell.view = 'search';
  const other = shell.deepLinkParams(p);
  for (const key of ['aq', 'discussion', 'ascope', 'arepo', 'astate']) assert.equal(other.has(key), false);
});

test('Activity filter edits replace one address rather than adding history per keystroke', () => {
  const { shell, history } = makeShell({ search: '?view=sessions' });
  shell.view = 'sessions';
  const calls = [];
  for (const op of ['pushState', 'replaceState']) history[op] = () => calls.push(op);
  shell.setSessionSearch({ q: 'two words', discussion: true, scope: 'day', repo: '', state: '' });
  assert.deepEqual(calls, ['replaceState']);
  assert.equal(shell.deepLinkParams().has('ascope'), false, 'Day is retained as the default');
});

test('Search selection and explicit scope snapshots round-trip, including an empty scope', async () => {
  for (const set of [null, '', 'aaa11111,bbb22222']) {
    const p = new URLSearchParams({ view: 'search', sq: 'needle', smode: 'sessions', sitem: 'bbb22222', sscope: 'week', sextra: 'bbb22222' });
    if (set !== null) p.set('sset', set);
    const { shell } = makeShell({ search: '?' + p });
    await shell.routeFromUrl(shell.parseUrl());
    const stamped = shell.deepLinkParams();
    assert.equal(stamped.get('sset'), set);
    assert.equal(stamped.get('sitem'), 'bbb22222');
    assert.equal(stamped.get('sq'), 'needle');
    assert.equal(stamped.get('sscope'), 'week');
    assert.equal(stamped.get('sextra'), 'bbb22222');
    shell.view = 'sessions';
    const other = shell.deepLinkParams(stamped);
    for (const key of ['sset', 'sitem', 'sq', 'sscope', 'sextra']) assert.equal(other.has(key), false);
  }
});

test('a session query survives boot and only rides its session route', () => {
  const { shell } = makeShell({ search: '?view=sessions&session=abc12345&find=cache+invalidation' });
  shell.view = 'sessions';
  let p = shell.deepLinkParams(new URLSearchParams('find=stale'));
  assert.equal(p.get('session'), 'abc12345');
  assert.equal(p.get('find'), 'cache invalidation');
  shell.view = 'search';
  p = shell.deepLinkParams(p);
  assert.equal(p.has('find'), false);
  assert.equal(p.has('session'), false);
});

test('editing a session query replaces history, and a different session clears it', () => {
  const { shell, location, history } = makeShell({ search: '?view=sessions&session=abc12345&find=old' });
  shell.view = 'sessions';
  const calls = [];
  for (const op of ['pushState', 'replaceState']) history[op] = (_state, _title, href) => {
    calls.push(op);
    const url = new URL(href, 'https://localhost');
    location.search = url.search;
  };
  shell.setSession('abc12345', 'new phrase');
  assert.deepEqual(calls, ['replaceState']);
  assert.equal(new URLSearchParams(location.search).get('find'), 'new phrase');
  assert.equal(shell._restoring, false);
  shell.setSession('def67890');
  assert.equal(calls.at(-1), 'replaceState', 'the deck owns the one navigation entry');
  assert.equal(shell.sessionFind, '');
  assert.equal(new URLSearchParams(location.search).has('find'), false);
  shell.setSession('');
  assert.equal(new URLSearchParams(location.search).has('session'), false);
});

test('restoring the Sessions route re-reads the addressed record and query', async () => {
  const { shell, events } = makeShell();
  shell.goSessions = () => {};
  shell._restoring = true;
  await shell.routeFromUrl({ view: 'sessions', session: 'abc12345', find: 'needle', card: '2' });
  assert.equal(shell.sessionSpec, 'abc12345');
  assert.equal(shell.sessionFind, 'needle');
  assert.equal(events.at(-1).type, 'web-tools:restore-session');
  assert.deepEqual(events.at(-1).detail, { id: 'abc12345', find: 'needle', pane: undefined, card: '2' });
  await shell.routeFromUrl({ view: 'sessions' });
  assert.equal(shell.sessionSpec, '');
  assert.equal(shell.sessionFind, '');
  assert.equal(events.at(-1).detail.id, '');
});

// Run the page's actual component factory: every identity form uses this same
// resolver, including token-free payloads whose identity must not be rewritten.
const pageSource = readFileSync(path.join(repoRoot, 'pages/session.html'), 'utf8');
const pageScript = pageSource.match(/<script>\s*(\/\/ The store,[\s\S]*?)<\/script>/)?.[1];
assert.ok(pageScript, 'standalone session component script');
function standalone(href) {
  let factory;
  const location = new URL(href);
  const writes = [];
  const history = { state: { keep: true }, replaceState(state, _, next) {
    writes.push({ state, next }); location.href = new URL(next, location).href;
  } };
  const Alpine = { data(_name, fn) { factory = fn; } };
  const document = { addEventListener(_name, fn) { fn(); } };
  const window = {}; window.self = window; window.top = window;
  new Function('window', 'document', 'Alpine', 'location', 'history', pageScript)(
    window, document, Alpine, location, history);
  return { data: factory(), location, writes };
}

test('standalone id, file, branch and payload links carry find and zero-based card', () => {
  for (const [key, value, kind] of [
    ['id', 'abc12345', 'id'], ['gh', 'me/store:sessions/a.json', 'path'],
    ['branch', 'claude/feature', 'branch'], ['gz', 'payload-bytes', 'gz'],
  ]) {
    const { data } = standalone('https://example.test/session.html#' + key + '='
      + encodeURIComponent(value) + '&card=0&find=two+words');
    const t = data.resolve();
    assert.equal(t.kind, kind);
    assert.equal(t.at.start, 0);
    assert.equal(t.at.find, 'two words');
  }
});

test('standalone search updates preserve identity and loader version, and drop a stale card', () => {
  for (const identity of ['gz=payload-bytes', 'id=abc12345', 'gh=me%2Fstore%3Asessions%2Fa.json']) {
    const { data, location, writes } = standalone('https://example.test/session.html?use=codex%2Ftest#'
      + identity + '&card=5&find=old');
    data.stampFind('  next phrase  ');
    const p = new URLSearchParams(location.hash.slice(1));
    assert.equal(p.get(identity.split('=')[0]), decodeURIComponent(identity.split('=')[1]));
    assert.equal(p.get('find'), 'next phrase');
    assert.equal(p.has('card'), false);
    assert.equal(location.searchParams.get('use'), 'codex/test');
    assert.deepEqual(writes[0].state, { keep: true });
    data.stampFind('');
    assert.equal(new URLSearchParams(location.hash.slice(1)).has('find'), false);
  }
});

test('query-based session identities retain query-based finding', () => {
  const { data, location } = standalone('https://example.test/session.html?id=abc12345&find=old&card=2');
  data.stampFind('new');
  assert.equal(location.searchParams.get('id'), 'abc12345');
  assert.equal(location.searchParams.get('find'), 'new');
  assert.equal(location.searchParams.has('card'), false);
  assert.equal(data.resolve().at.find, 'new');
});

test('only the active session slide may change the shared query', async () => {
  const { window } = makeWindow();
  let factory, opened;
  const stamps = [];
  const Alpine = { data(_name, fn) { factory = fn; }, initTree() {} };
  const gh = { load: async () => {} };
  window.Alpine = Alpine;
  window.__shell = { REGISTRY_REPO: 'me/store', setSession: (...args) => stamps.push(args) };
  window.swipeDeck = { open(opts) {
    opened = opts;
    return { deck: { onSlide() {} }, setTitle() {}, setSubtitle() {}, setLink() {} };
  } };
  new Function('window', 'document', 'Alpine', 'gh', 'location',
    readFileSync(path.join(repoRoot, 'lib/alpineComponents/estate.js'), 'utf8'))(
    window, window.document, Alpine, gh, window.location);
  window.document.dispatchEvent(new window.Event('alpine:init'));
  const data = factory();
  const rows = [{ id: 'aaa11111' }, { id: 'bbb22222' }];
  data.sessionDeck = { rows, i: 0, find: 'seed' };
  data._openCard = { find: 'seed', start: 0 };
  data.sessionChrome = () => ({});
  data.sessionPages = () => [];
  data.sessionLabel = r => r.id;
  await data.mountSessionDeck();
  const options = [];
  for (let i = 0; i < rows.length; i++) {
    const slide = window.document.createElement('div');
    opened.render(i, slide);
    const key = slide.firstChild.getAttribute('x-data').match(/window\.(\w+)/)[1];
    options.push(window[key]);
  }
  assert.equal(options[0].find, 'seed');
  assert.equal(options[0].start, 0);
  assert.equal(options[1].find, '');
  assert.equal(data._openCard, null, 'initial reading is consumed once');
  assert.deepEqual(stamps, [[''], ['aaa11111', 'seed']], 'the list entry precedes the reader address');
  stamps.length = 0;
  options[1].onFind('wrong neighbour');
  assert.equal(stamps.length, 0);
  options[0].onFind('current');
  assert.deepEqual(stamps.at(-1), ['aaa11111', 'current']);
  const rebuilt = window.document.createElement('div');
  opened.render(0, rebuilt);
  const rebuiltKey = rebuilt.firstChild.getAttribute('x-data').match(/window\.(\w+)/)[1];
  assert.equal(window[rebuiltKey].find, 'current', 'rebuilding cannot replay the original query');
  assert.equal(window[rebuiltKey].start, undefined, 'an addressed card opens only once');
  data.onSessionDeckSlide(1);
  assert.deepEqual(stamps.at(-1), ['bbb22222', 'wrong neighbour']);
  options[0].onFind('late old slide');
  assert.deepEqual(stamps.at(-1), ['bbb22222', 'wrong neighbour']);
  data.onSessionDeckSlide(0);
  assert.deepEqual(stamps.at(-1), ['aaa11111', 'late old slide'], 'a debounced edit survives swiping away before it ran');
  data.sessionDeck = { rows: [...rows], i: 1, find: '' };
  options[1].onFind('replaced deck');
  assert.equal(data.sessionDeck.find, '');
  const restored = [];
  data.openSessionDetail = (...args) => restored.push(args);
  Object.defineProperty(data, 'sessionDeckRows', { value: rows });
  Object.defineProperty(data, 'allSessionRows', { value: rows });
  data.restoreSession({ id: 'bbb22222', find: '' });
  assert.equal(restored.length, 0, 'Back from an exchange keeps its parent');
  data.sessionDeck = null;
  data.restoreSession({ id: 'aaa11111', find: 'forward query', card: '0' });
  assert.deepEqual(restored[0], [rows[0], undefined, { replace: true }]);
  assert.equal(data._openCard.find, 'forward query');
  assert.equal(data._openCard.start, 0);
});
