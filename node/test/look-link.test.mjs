// python/look-link.py — make a look link for a page, and check its anchors
// against the page's source before the link is sent.
//
// Driven through the file system, the way a session runs it (the same shape as
// showing-pick.test.mjs). Three things are pinned. What the source read counts
// as an anchor, since a bound name and a literal one are different promises.
// That every walk and opener a tracked page declares resolves, which is the
// gate: a renamed control otherwise leaves a walk that only fails on the
// reader's screen. And that the two encoders agree, since a session encodes
// steps here and the kit decodes them in the page.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { TextEncoder, TextDecoder } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { makeWindow, repoRoot } from './bootstrap.mjs';

const SCRIPT = path.join(repoRoot, 'python/look-link.py');
const dir = mkdtempSync(path.join(tmpdir(), 'look-link-'));

function page(name, html) {
  const f = path.join(dir, name);
  writeFileSync(f, html);
  return f;
}

const py = (...args) => spawnSync('python3', [SCRIPT, ...args], { cwd: repoRoot, encoding: 'utf8' });

const FIXTURE = page('fixture.html', `<!doctype html><html><head>
<script src="../lib/kits/look.js"></script></head><body>
<button data-at="tab-a">A</button>
<button id="plain">has an id</button>
<section data-at-open="tab-a" hidden>
  <tr :data-at="'row-' + r.id"></tr>
  <li x-bind:data-at="\`item-\${i}\`"></li>
  <p :data-at="'whole'"></p>
</section>
<script type="application/json" id="look-walks">
{ "good": [{ "at": "tab-a", "tap": true }, { "at": "row-x" }, { "at": "plain" }, { "at": "text:Anything" }] }
</script>
</body></html>`);

test('a literal, a bound prefix, a whole bound literal and an id are each counted for what they promise', () => {
  const info = JSON.parse(py('anchors', FIXTURE, '--json').stdout);
  assert.deepEqual(info.names, ['tab-a', 'whole']);
  assert.deepEqual(info.prefixes, ['item-', 'row-']);
  assert.ok(info.ids.includes('plain'));
  assert.deepEqual(info.opens, ['tab-a']);
  assert.equal(info.takes, true);
  assert.deepEqual(Object.keys(info.walks), ['good']);
});

test('check passes a page whose walks and openers all resolve', () => {
  const r = py('check', FIXTURE);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('check names a walk step and an opener that resolve to nothing, and fails', () => {
  const bad = page('bad.html', `<button data-at="real">x</button>
<div data-at-open="gone" hidden></div>
<script type="application/json" id="look-walks">{ "w": [{ "at": "real" }, { "at": "renamed" }, {}] }</script>`);
  const r = py('check', bad);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /walk 'w' step 2: 'renamed' is not an anchor/);
  assert.match(r.stdout, /walk 'w' step 3 has no anchor/);
  assert.match(r.stdout, /data-at-open='gone' names no anchor/);
});

test('a walk block that is not JSON is a failure, not an empty set of walks', () => {
  const r = py('check', page('broken.html', '<script type="application/json" id="look-walks">{ nope }</script>'));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /not valid JSON/);
});

test('make prints the plainest fragment and exits 1 on an anchor the page lacks', () => {
  let r = py('make', FIXTURE, '--tap', 'tab-a', '--say', 'Open A, then look');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'tap=tab-a&say=Open%20A%2C%20then%20look');
  r = py('make', FIXTURE, '--show', 'nope');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /'nope' is not an anchor on this page/);
  r = py('make', FIXTURE, '--show', 'row-42');
  assert.equal(r.status, 0);
  assert.match(r.stderr, /matches only a bound prefix/, 'a prefix match passes, and says how weakly');
  r = py('make', FIXTURE, '--walk', 'absent');
  assert.equal(r.status, 1);
});

test('steps encoded here decode to the same steps in the kit', () => {
  // The session encodes, the page decodes. Unicode and the characters base64
  // spells with + and / are the cases a mismatch would show first.
  const steps = [{ at: 'tab-a', tap: true, say: 'Öffnen » dann ~ prüfen?/+' }, { at: 'text:Ünïcode', say: '' }];
  const r = py('make', FIXTURE, '--steps', JSON.stringify(steps));
  assert.equal(r.status, 0, r.stderr);
  const frag = r.stdout.trim();
  assert.match(frag, /^steps=[A-Za-z0-9_-]+$/, 'base64url, nothing a URL would rewrite');
  const { window } = makeWindow();
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
  window.Element.prototype.animate = function () { return { cancel() {} }; };
  new window.Function(readFileSync(path.join(repoRoot, 'lib/kits/look.js'), 'utf8'))();
  const read = JSON.parse(JSON.stringify(window.Look.fromHash('#' + frag)));
  window.close();
  assert.deepEqual(read, steps.map(s => ({ at: s.at, say: s.say, tap: !!s.tap })));
});

test('every tracked page that declares a walk or an opener passes the check', () => {
  // The gate. A walk is a set of names, and a renamed control leaves one that
  // fails only on the reader's screen; this fails here instead.
  const files = execFileSync('git', ['ls-files', '*.html'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .filter(f => /look-walks|data-at-open/.test(readFileSync(path.join(repoRoot, f), 'utf8')));
  assert.ok(files.includes('lib/kits/demos/look.html'), 'the demo declares both, so the gate is never empty');
  const r = py('check', ...files);
  assert.equal(r.status, 0, r.stdout);
});

test('a page takes look links by loading the kit or booting the loader, not by naming either', () => {
  // The kit demo's index links to look.js's source and boots nothing; a look
  // link reaches it only through the toss renderer.
  const takes = (name, html) => JSON.parse(py('anchors', page(name, html), '--json').stdout).takes;
  assert.equal(takes('mention.html', '<a href="https://github.com/mehrlander/web-tools/blob/main/lib/kits/look.js">src</a>'), false);
  assert.equal(takes('chain.html', "<script>await gh.load('kits/look.js');</script>"), true);
  assert.equal(takes('cdn.html', '<script src="https://mehrlander.github.io/web-tools/lib/kits/look.js"></script>'), true);
  assert.equal(takes('inlined.html', '<script>window.Look = { start };</script>'), true);
  // Booting the loader is enough: gh-boot.js brings the kit when a fragment asks.
  assert.equal(takes('boots.html', "<script type=module>await import('https://mehrlander.github.io/web-tools/lib/entry.js');</script>"), true);
  assert.equal(takes('prebuilt.html', "<script type=module>import '../dist/web-tools.js';</script>"), true);
  // A relative src resolves against the page's own folder: the demo's ../look.js.
  assert.equal(JSON.parse(py('anchors', 'lib/kits/demos/look.html', '--json').stdout).takes, true);
  assert.equal(JSON.parse(py('anchors', 'lib/kits/demos/index.html', '--json').stdout).takes, false);
});

test('a page that declares no anchors cannot fail a name, only leave it unchecked', () => {
  const plain = page('plain.html', "<script type=module>await import('../lib/entry.js');</script><button id=go>Go</button>");
  let r = py('make', plain, '--tap', 'go');
  assert.equal(r.status, 0);
  r = py('make', plain, '--show', 'whatever');
  assert.equal(r.status, 0);
  assert.match(r.stderr, /unchecked here/);
});
