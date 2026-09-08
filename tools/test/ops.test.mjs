// ops.test.mjs — every op in lib/ops/ is a value a caller can evaluate, and
// session-menu.js answers correctly for each thing a clipboard can hold.
//
// The op runs on a phone inside a data: page that is coerced to text and never
// shown, so nothing about it can be inspected there. It is exercised here the
// way the phone runs it: the file's text is evaluated, the function is called
// with an input object, and a fake synchronous XMLHttpRequest stands in for
// the GitHub API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OPS = path.join(root, 'lib', 'ops');
const files = readdirSync(OPS).filter(f => f.endsWith('.js'));

// Evaluate an op the way Run-Op does: the file is text, eval yields the value.
function load(name, { status = 200, body = {} } = {}) {
  const src = readFileSync(path.join(OPS, name), 'utf8');
  const sent = [];
  const ctx = vm.createContext({
    Date, JSON, Math, RegExp, Error, Array, String, Object, isFinite, sent,
    XMLHttpRequest: function () {
      this.open = (method, url, async) => sent.push({ method, url, async });
      this.setRequestHeader = (k, v) => sent.push([k, v]);
      this.send = () => { this.status = status; this.responseText = JSON.stringify(body); };
    },
  });
  const value = vm.runInContext(src, ctx);
  // A result crosses back out of the vm realm as JSON, which is the contract
  // anyway: an op's result must serialise, since the phone reads it as text.
  const fn = typeof value === 'function' ? (input) => JSON.parse(JSON.stringify(value(input))) : value;
  return { fn, value, sent };
}

test('every op evaluates to one function and reaches neither window nor document', () => {
  assert.ok(files.length > 0, 'lib/ops/ has at least one op');
  for (const f of files) {
    const { value } = load(f);
    assert.equal(typeof value, 'function', `${f} should evaluate to a function`);
    const src = readFileSync(path.join(OPS, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(src, /\b(?:window|document)\b/, `${f} must not reach the page`);
  }
});

// Styling is a presentation layer over the same words: undo both alphabets to
// assert on content. Sans-serif bold carries values inside a line; sans-serif
// bold italic carries the rule line's own words.
const plainText = (s) => Array.from(s).map(ch => {
  const c = ch.codePointAt(0);
  if (c >= 0x1D5D4 && c <= 0x1D5ED) return String.fromCharCode(65 + c - 0x1D5D4);
  if (c >= 0x1D5EE && c <= 0x1D607) return String.fromCharCode(97 + c - 0x1D5EE);
  if (c >= 0x1D7EC && c <= 0x1D7F5) return String.fromCharCode(48 + c - 0x1D7EC);
  if (c >= 0x1D656 && c <= 0x1D66F) return String.fromCharCode(97 + c - 0x1D656);
  return ch;
}).join('');
// The header as two comparable pieces: the rule's words, and the line under it.
const header = (caption) => {
  const [bar, line = ''] = plainText(caption).split('\n');
  return { rule: bar.trim().replace(/^- | -$/g, '').trim(), line: line.trim() };
};
const rowText = (l) => plainText(l).replace(/^[\u{1F33F}\u{1F558}] /u, '').replace(/ {2}/g, ' · ');

// ONE CLOCK for every row: read per call, two rows meant to tie land a
// millisecond apart whenever the runner is slow between two calls.
const NOW = Date.now();
const stamp = (minsAgo) => new Date(NOW - minsAgo * 60000).toISOString();
// The payload's entry shape, which is the whole thing the phone reads:
// [id, last active, one plain line of the ask].
const entry = (id, minsAgo, ask) => [id, stamp(minsAgo), ask];
const index = ({ recent = [], branches = {}, minsOld = 5 } = {}) =>
  ({ generatedAt: stamp(minsOld), recent, branches });

test('session-menu reads the purpose-built index once, synchronously, raw, with the token as given', () => {
  const { fn, sent } = load('session-menu.js', { body: index() });
  fn({ input: 'claude/x-aa11bb', token: 'ghp_x' });
  const open = sent.find(s => s.method);
  assert.equal(open.async, false, 'an async read returns after the coercion has captured the page');
  // NOT state/sessions.json, which is 1.16 MB and holds a session's every tool
  // call. This file exists so the phone reads 46 KB and looks a branch up.
  assert.match(open.url, /web-tools-private\/contents\/state\/session-menu\.json\?ref=main$/);
  assert.deepEqual(sent.find(s => s[0] === 'Authorization'), ['Authorization', 'Bearer ghp_x']);
  assert.deepEqual(sent.find(s => s[0] === 'Accept'), ['Accept', 'application/vnd.github.raw']);
  assert.equal(sent.filter(s => s.method).length, 1, 'no probe on the happy path');
});

test('session-menu: the clipboard shapes that carry a branch all reduce to it', () => {
  const want = 'claude/double-tap-read-aloud-shortcut-wb6uh9';
  const body = index({ branches: { [want]: entry('aaaaaaaa', 30, 'On the branch') } });
  for (const clip of [
    want, 'origin/' + want, 'refs/heads/' + want, '  ' + want + '\n',
    'https://github.com/mehrlander/web-tools/tree/' + want,
    'https://github.com/mehrlander/web-tools/compare/' + want + '?expand=1',
    'https://mehrlander.github.io/web-tools/pages/branch.html#gh=mehrlander/web-tools@' + want,
    want + '\nsecond line of a caption',
  ]) {
    const r = load('session-menu.js', { body }).fn({ input: clip, token: 't' });
    assert.equal(r.state, 'on-branch', JSON.stringify(clip));
    assert.equal(r.branch, want, JSON.stringify(clip));
  }
});

test('session-menu: a plain URL is not a branch', () => {
  // The 2026-09-08 defect: the guard was "has a slash, has no whitespace",
  // which every http address passes, so pasting any page produced a header
  // asserting a branch that never existed, 54 characters of it.
  const body = index({ recent: [entry('bbbbbbbb', 10, 'Something else')] });
  for (const clip of [
    'https://mehrlander.github.io/web-tools/pages/index.html',
    'http://example.com/a/b',
    'github.com/mehrlander/web-tools',
    'mehrlander.github.io/web-tools/pages/session.html',
  ]) {
    const r = load('session-menu.js', { body }).fn({ input: clip, token: 't' });
    assert.equal(r.branch, '', JSON.stringify(clip));
    assert.equal(r.state, 'no-branch', JSON.stringify(clip));
  }
});

test('session-menu: the header names the case in words and the line under it carries the evidence', () => {
  const want = 'claude/x-aa11bb';
  const found = index({ branches: { [want]: entry('aaaaaaaa', 30, 'Ask') } });
  const empty = index({ recent: [entry('bbbbbbbb', 90, 'Ask')] });
  const run = (body, input) => header(load('session-menu.js', { body }).fn({ input, token: 't' }).caption);

  assert.deepEqual(run(found, want), { rule: '🌿 branch recognized', line: 'x · 30m' });
  // A branch with no row says so, and stamps the index's age at every age: there
  // the age is the difference between "no such session" and "the crawl has not
  // run since this one started", and nothing else distinguishes them.
  assert.deepEqual(run(empty, want), { rule: '🌿 branch, no session yet', line: 'x · index 5m old' });
  // No branch shows what WAS read, so the verdict is checkable rather than
  // merely asserted.
  assert.deepEqual(run(empty, 'just some prose'), { rule: '📋 no branch on clipboard', line: '“just some prose”' });
  assert.deepEqual(run(empty, '   '), { rule: '📋 clipboard is empty', line: '' });
});

test('session-menu: a matched branch stamps the index age only past six hours', () => {
  const want = 'claude/x-aa11bb';
  const at = (minsOld) => index({ branches: { [want]: entry('aaaaaaaa', 30, 'Ask') }, minsOld });
  assert.equal(header(load('session-menu.js', { body: at(180) }).fn({ input: want, token: 't' }).caption).line, 'x · 30m');
  assert.equal(header(load('session-menu.js', { body: at(16 * 60) }).fn({ input: want, token: 't' }).caption).line,
    'x · 30m · index 16h old');
});

test('session-menu: the branch row leads, recent rows fill, nothing repeats, every row maps to its page', () => {
  const want = 'claude/x-aa11bb';
  const body = index({
    branches: { [want]: entry('aaaaaaaa', 600, 'On the branch') },
    recent: [entry('bbbbbbbb', 30, 'Newest, elsewhere'), entry('aaaaaaaa', 600, 'On the branch')],
  });
  const r = load('session-menu.js', { body }).fn({ input: want, token: 't' });
  // The branch's own session leads even though it is older, and does not come
  // round again in the recent fill.
  assert.deepEqual(r.rows.map(l => r.urls[l].slice(-8)), ['aaaaaaaa', 'bbbbbbbb']);
  assert.equal(rowText(r.rows[0]), '10h · On the branch');
  assert.match(r.rows[0], /^\u{1F33F} /u, 'the branch row carries the branch glyph');
  assert.match(r.rows[1], /^\u{1F558} /u, 'a recent row carries the recent glyph');
  for (const l of r.rows) assert.match(r.urls[l], /^https:\/\/mehrlander\.github\.io\/web-tools\/pages\/session\.html#id=[0-9a-f]{8}$/);
  assert.equal(r.id, 'aaaaaaaa');
});

test('session-menu: a branch with no row still gets a row, and it bypasses this index', () => {
  // The arm that matters most. The payload is rebuilt only when someone opens
  // the estate, so a session reaches it two hops behind; session.html's
  // `#branch=` walks the store itself and reaches no cache, so it answers for
  // exactly the session this index cannot see.
  const want = 'claude/brand-new-work-zz99yy';
  const body = index({ recent: [entry('bbbbbbbb', 30, 'Something else')] });
  const r = load('session-menu.js', { body }).fn({ input: want, token: 't' });
  assert.equal(r.state, 'no-session');
  assert.equal(r.urls[r.rows[0]], 'https://mehrlander.github.io/web-tools/pages/session.html#branch=' + want);
  assert.equal(rowText(r.rows[0]), 'look it up · brand-new-work');
  assert.equal(r.id, '', 'no session was identified, and the result says so');
});

test('session-menu: `menu` is the whole menu and always ends in the verbs', () => {
  // Choose-Claude is a shell that draws `menu` without testing anything first,
  // so the verbs have to be there in every result, an ERROR included.
  const body = index({ recent: [entry('bbbbbbbb', 30, 'Ask')] });
  const ok = load('session-menu.js', { body }).fn({ input: '', token: 't' });
  assert.deepEqual(ok.menu.slice(-2), ['Show-Loop', 'Out']);
  assert.deepEqual(ok.menu.slice(0, -2), ok.rows);
  for (const verb of ok.menu.slice(-2))
    assert.equal(ok.urls[verb], undefined, 'a verb is a shortcut name, never a page');
});

test('session-menu: the row count is bounded so the menu stays a menu', () => {
  const body = index({ recent: Array.from({ length: 40 }, (_, i) =>
    entry(String(i).padStart(8, '0'), i, 'Ask ' + i)) });
  const r = load('session-menu.js', { body }).fn({ input: '', token: 't' });
  assert.equal(r.rows.length, 12);
  assert.equal(r.menu.length, 14);
});

test('session-menu: no token is an ERROR result, and the index is never read without one', () => {
  const { fn, sent } = load('session-menu.js');
  const r = fn({ input: 'claude/x-aa11bb' });
  assert.equal(r.state, 'error');
  assert.equal(r.error, 'ERROR no token reached the op at start');
  assert.deepEqual(r.rows, []);
  assert.equal(sent.filter(s => s.method && /session-menu\.json/.test(s.url)).length, 1,
    'only the probe touches the index address, once, with the token alone');
  assert.deepEqual(Object.keys(r.probe), ['zen plain', 'zen auth', 'index auth only']);
});

test('session-menu: a failed read keeps the header shape, names the status and stage, and still draws a menu', () => {
  const { fn } = load('session-menu.js', { status: 401 });
  const r = fn({ input: 'claude/x-aa11bb', token: 't' });
  const h = header(r.caption);
  assert.equal(h.rule, '⚠️ sessions unreachable');
  assert.equal(h.line, 'ERROR HTTP 401 reading state/session-menu.json at status 401');
  // Claude-Session tests the caption for the word ERROR and shows the text
  // rather than drawing a menu, so the word has to survive the header.
  assert.match(r.caption, /ERROR/);
  assert.equal(r.error, h.line);
  assert.deepEqual(r.menu, ['Show-Loop', 'Out']);
  assert.deepEqual(Object.keys(r.probe), ['zen plain', 'zen auth', 'index auth only']);
});

test('session-menu: the two menus are set in one register, so they read as siblings', () => {
  // Describe-Input titles the OTHER back-tap menu (Choose-BackTap, in
  // shortcut-tools) with a rule centred in a 68-column field, its words in
  // sans-serif bold italic and lowercased. Copied rather than shared, because
  // the two run in different places, so the copy is held here.
  const body = index({ recent: [entry('bbbbbbbb', 30, 'Ask')] });
  const bar = load('session-menu.js', { body }).fn({ input: '', token: 't' }).caption.split('\n')[0];
  assert.match(bar, /^ +- \u{1F4CB} [\u{1D656}-\u{1D66F} ]+ -$/u, 'centred rule, sans-serif bold italic words');
  const width = Array.from(bar.trim()).length;
  assert.equal(bar.length - bar.trimStart().length, Math.floor((68 - width) / 2) + 2);
});
