// alpineComponents/stage.js: the Stage as the courier's popup. Opened by the
// courier bookmarklet with `courier=1`, the bench hears only the window that
// opened it, stages what the page sends, reads the errand for that host with
// its own token, sends the errand's script back, and stages the script's
// result aimed at the errand's destination.
//
// Its own file because the intake is fixed at load: the flag is read from the
// address before the shell can rewrite it, and window.opener exists only here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, startAlpine, tick, deckGeometry } from './bootstrap.mjs';

const { window, problems } = makeWindow({
  html: `<!doctype html><html><body><div id="st" x-data="stager()"></div></body></html>`,
  url: 'https://localhost/web-tools/app/?view=stage&courier=1',
});
deckGeometry(window);

const sent = [];
const opener = { postMessage(msg, origin) { sent.push({ msg, origin }); } };
Object.defineProperty(window, 'opener', { value: opener, configurable: true });

const ERRANDS = {
  'mehrlander/web-tools-private': { errands: [
    { id: 'priv', host: 'private.example', status: 'open', title: 'A private errand', script: 'sites/private.example/go.js',
      result: { repo: 'mehrlander/web-tools-private', branch: 'main', path: 'courier/results/priv.md' } },
  ] },
  'mehrlander/web-tools': { errands: [
    { id: 'pub', host: 'site.example', status: 'open', title: 'A public errand', script: 'sites/site.example/go.js',
      result: { repo: 'mehrlander/web-tools-private', branch: 'main', path: 'courier/results/pub.md' } },
    { id: 'shut', host: 'closed.example', status: 'done', title: 'Closed', script: 'sites/closed.example/go.js',
      result: { repo: 'x/y', branch: 'main', path: 'r.md' } },
  ] },
};
const reads = [];
class FakeGH {
  constructor(conf = {}) { this.token = conf.token || ''; this.repo = conf.repo || ''; this.ref = conf.ref || 'main'; }
  async get(path) {
    reads.push(this.repo + ':' + path);
    if (path === 'courier/errands.json' && ERRANDS[this.repo]) return { text: JSON.stringify(ERRANDS[this.repo]) };
    if (path.endsWith('/go.js')) return { text: 'return "script from ' + this.repo + '"' };
    throw Object.assign(new Error('404'), { status: 404 });
  }
}

const Alpine = await startAlpine(window, [
  'lib/alpine-bundle.js',
  'lib/kits/url-params.js',
  'lib/kits/repo-address.js',
  'lib/kits/repo-mailbox.js',
  'lib/kits/surface.js',
  'lib/kits/text-diff.js',
  'lib/kits/git-change.js',
  'lib/kits/swipe-deck.js',
  'lib/kits/subject-channel.js',
  'lib/alpineComponents/drop-zone.js',
  'lib/alpineComponents/path-picker.js',
  'lib/alpineComponents/viewer.js',
  'lib/alpineComponents/stage.js',
]);
const data = Alpine.$data(window.document.getElementById('st'));
const store = Alpine.store('browser');
store.gh = new FakeGH({ token: 't', repo: 'me/open' });

// A message as the browser delivers it. jsdom's MessageEvent will not take a
// plain object as its source, so the source is set on the event afterwards.
const deliver = (data, source = opener, origin = 'https://site.example') => {
  const ev = new window.MessageEvent('message', { data, origin });
  Object.defineProperty(ev, 'source', { value: source });
  window.dispatchEvent(ev);
};
const settle = async () => { for (let i = 0; i < 10; i++) await tick(); };
const names = () => (store.stage || []).map(it => it.name);

test('in courier mode the bench tells its opener it is ready, and waits', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(sent[0])), { msg: { type: 'courier-ready' }, origin: '*' });
  assert.equal(data.courier.state, 'waiting');
});

test('a message from any window but the opener is ignored', async () => {
  const before = names().length;
  deliver({ type: 'courier-page', url: 'https://site.example/x', title: 'X', links: [] }, { postMessage() {} });
  await settle();
  assert.equal(names().length, before);
  assert.equal(data.courier.state, 'waiting');
});

test('a page with no errand stages its links and nothing is sent back', async () => {
  const before = sent.length;
  deliver({ type: 'courier-page', url: 'https://plain.example/p', title: 'Plain | page', selection: '',
    links: [{ text: 'One', href: 'https://plain.example/1' }, { text: 'Bad', href: 'javascript:alert(1)' }] },
    opener, 'https://plain.example');
  await settle();
  const item = store.stage.find(it => /^plain\.example-.*-links\.md$/.test(it.name));
  assert.ok(item, 'the links arrive as one markdown file named for the host');
  assert.match(item.text, /^# Plain \| page/);
  assert.match(item.text, /\| One \| https:\/\/plain\.example\/1 \|/);
  assert.doesNotMatch(item.text, /javascript:/, 'only http(s) links are kept');
  assert.equal(data.courier.links, 1);
  assert.equal(data.destSpec, 'mehrlander/web-tools-private@main:courier/captures', 'with no errand, the bench aims at the default capture folder');
  assert.equal(sent.length, before, 'no errand, so no script goes back');
});

test('an errand for the host sends its script back, aims the bench, and stages the result', async () => {
  deliver({ type: 'courier-page', url: 'https://site.example/index', title: 'Site', links: [] });
  await settle();
  const run = sent.at(-1);
  assert.equal(run.msg.type, 'courier-run');
  assert.equal(run.msg.id, 'pub');
  assert.equal(run.msg.code, 'return "script from mehrlander/web-tools"', 'the script is read from the repo its list lives in');
  assert.equal(run.origin, 'https://site.example', 'the script goes only to the origin that asked');
  assert.equal(data.destSpec, 'mehrlander/web-tools-private@main:courier/results', 'the destination is the errand record, not the message');
  assert.equal(data.courier.state, 'running');
  deliver({ type: 'courier-ran', id: 'pub', text: '# result' });
  await settle();
  assert.equal(store.stage.find(it => it.name === 'pub.md')?.text, '# result');
  assert.equal(data.courier.state, 'ran');
});

test('the private list is read first, so a private errand wins for its host', async () => {
  reads.length = 0;
  deliver({ type: 'courier-page', url: 'https://private.example/', title: 'P', links: [] }, opener, 'https://private.example');
  await settle();
  assert.equal(reads[0], 'mehrlander/web-tools-private:courier/errands.json');
  assert.equal(sent.at(-1).msg.id, 'priv');
  assert.equal(sent.at(-1).msg.code, 'return "script from mehrlander/web-tools-private"');
});

test('a result for an errand that is not running is ignored, and a failure is shown', async () => {
  const before = names().length;
  deliver({ type: 'courier-ran', id: 'someone-else', text: 'x' });
  await settle();
  assert.equal(names().length, before);
  deliver({ type: 'courier-ran', id: 'priv', error: 'EvalError: unsafe-eval' });
  await settle();
  assert.equal(data.courier.state, 'failed');
  assert.match(data.courier.note, /unsafe-eval/);
});

test('a closed errand is not run', async () => {
  const before = sent.length;
  deliver({ type: 'courier-page', url: 'https://closed.example/', title: 'C', links: [] }, opener, 'https://closed.example');
  await settle();
  assert.equal(sent.length, before);
});

test('mounts with no warnings or errors', () => {
  assert.deepEqual(problems, []);
});
