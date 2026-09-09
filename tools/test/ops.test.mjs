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
// The header as two comparable pieces: the first line's words, and the line
// under it. Nothing is trimmed off the front any more: the padding and the
// `- … -` marks are gone, and a test that trimmed them would not notice their
// return.
const header = (caption) => {
  const [bar, line = ''] = plainText(caption).split('\n');
  return { rule: bar, line };
};
const rowText = (l) => plainText(l).replace(/^[\u{1F33F}\u{1F558}] /u, '').replace(/ {2}/g, ' · ');

// ONE CLOCK for every row: read per call, two rows meant to tie land a
// millisecond apart whenever the runner is slow between two calls.
const NOW = Date.now();
const stamp = (minsAgo) => new Date(NOW - minsAgo * 60000).toISOString();
// The payload's entry shape, which is the whole thing the phone reads:
// [id, last active, one plain line of the ask].
const entry = (id, minsAgo, ask, branch = '') => [id, stamp(minsAgo), ask, branch];
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
  assert.doesNotMatch(run(found, want).rule, /^\s|^-/, 'no leading padding and no rule marks');
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

test('session-menu: a session row is named by its branch, not by a clipped ask', () => {
  // THE 2026-09-08 PHONE READING. Ten rows reading "2h" over 56 characters of a
  // dictated opening sentence are ten rows a reader cannot tell apart. The slug
  // is the same ask already reduced to a topic by whoever named the branch, and
  // short enough to survive a phone row whole.
  const want = 'claude/activity-tooltip-full-history-8vhmzr';
  const body = index({
    branches: { [want]: entry('aaaaaaaa', 600, 'In the web tools activity view we have a tooltip panel …') },
    recent: [entry('bbbbbbbb', 30, 'On iphone you can run a bookmarklet but also a shortcut …',
                   'claude/bookmarklets-shortcuts-iphone-safari-rjakex'),
             entry('cccccccc', 45, 'A session that did no branch work at all')],
  });
  const r = load('session-menu.js', { body }).fn({ input: want, token: 't' });
  assert.deepEqual(r.rows.map(rowText), [
    '10h · activity-tooltip-full-history',
    '30m · bookmarklets-shortcuts-iphone-safari',
    // No branch, so the ask is the fallback rather than an empty row.
    '45m · A session that did no branch work at all',
  ]);
  assert.match(r.rows[0], /^\u{1F33F} /u, 'the clipboard branch row carries the branch glyph');
  assert.match(r.rows[1], /^\u{1F558} /u, 'a recent row carries the recent glyph');
  for (const l of r.rows) assert.match(r.urls[l], /session\.html#id=[0-9a-f]{8}$/);
});

test('session-menu: `menu` is three or four rows, and the fourth is what to do about the header', () => {
  // The back tap draws this, and the header has already answered the question
  // the tap asked, so the rows only carry what to DO about it. The first build
  // put the session list here and the phone showed what that is.
  const want = 'claude/x-aa11bb';
  const found = index({ branches: { [want]: entry('aaaaaaaa', 30, 'Ask') },
                        recent: Array.from({ length: 16 }, (_, i) => entry(String(i).padStart(8, '0'), i, 'Ask')) });
  const run = (input) => load('session-menu.js', { body: found }).fn({ input, token: 't' });

  const on = run(want);
  assert.deepEqual(on.menu.map(plainText), ['🌿 Open this session', '🕘 All sessions', 'Show-Loop', 'Out']);
  assert.equal(on.urls[on.menu[0]], 'https://mehrlander.github.io/web-tools/pages/session.html#id=aaaaaaaa');
  // A BRANCH WITH NO ROW STILL GETS ONE, and this is the arm that matters most:
  // session.html's `#branch=` walks the store and reaches no cache, so it
  // answers for exactly the session this index cannot see yet.
  const missing = run('claude/brand-new-work-zz99yy');
  assert.deepEqual(missing.menu.map(plainText), ['🌿 Look it up', '🕘 All sessions', 'Show-Loop', 'Out']);
  assert.equal(missing.urls[missing.menu[0]],
    'https://mehrlander.github.io/web-tools/pages/session.html#branch=claude/brand-new-work-zz99yy');
  // No branch, so there is nothing to open and the row is not offered.
  assert.deepEqual(run('some prose').menu.map(plainText), ['🕘 All sessions', 'Show-Loop', 'Out']);
  assert.deepEqual(run('').menu.map(plainText), ['🕘 All sessions', 'Show-Loop', 'Out']);
  // The list did not go away, it moved to where a list is worth reading.
  assert.equal(on.rows.length, 12, '`rows` still carries the list, for Claude-Session');
});

test('session-menu: every menu row opens a page except the verbs, which are shortcut names', () => {
  // Choose-Claude runs a row it cannot find in `urls` by name, and that arm is
  // what this chain's dispatch exercises. A `shortcuts://` row would also work
  // (12 of 613 corpus workflows open one), so this holds a preference rather
  // than a prohibition: it keeps the two kinds of row distinguishable, which is
  // what the chain's space test relies on to tell a missed lookup from a verb.
  const body = index({ branches: { 'claude/x-aa11bb': entry('aaaaaaaa', 30, 'Ask') } });
  const r = load('session-menu.js', { body }).fn({ input: 'claude/x-aa11bb', token: 't' });
  for (const row of r.menu) {
    const url = r.urls[row];
    if (url === undefined) assert.match(row, /^[A-Z][A-Za-z-]*$/, `a nameless row must be a shortcut name: ${row}`);
    else assert.match(url, /^https:\/\//, `a menu row opens https, never a scheme nothing has measured: ${url}`);
  }
  assert.deepEqual(r.menu.slice(-2), ['Show-Loop', 'Out']);
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
  // BOTH PAGE ROWS SURVIVE AN UNREACHABLE INDEX, and neither is a leftover.
  // `#branch=` walks the store itself and reaches no cache, so it is precisely
  // the route that still answers when this file is the thing that failed; the
  // estate view is what rebuilds the file. A menu of two verbs would have
  // dropped the only two rows worth tapping.
  assert.deepEqual(r.menu.map(plainText), ['🌿 Look it up', '🕘 All sessions', 'Show-Loop', 'Out']);
  assert.match(r.urls[r.menu[0]], /session\.html#branch=claude\/x-aa11bb$/);
  assert.match(r.urls[r.menu[1]], /\/app\/\?view=sessions$/);
  assert.deepEqual(Object.keys(r.probe), ['zen plain', 'zen auth', 'index auth only']);
});

test('session-menu: the header never pads, because a space is not a column', () => {
  // THE 2026-09-08 PHONE READING. iOS draws this prompt in a proportional font,
  // so leading spaces move a line by an amount no character count predicts: the
  // first line landed indented past centre while the line under it sat flush
  // left. Left-aligned is also robust rather than merely corrected, since an
  // unpadded line reads correctly whether the host centres the prompt or not.
  const body = index({ branches: { 'claude/x-aa11bb': entry('aaaaaaaa', 30, 'Ask') } });
  for (const input of ['', 'claude/x-aa11bb', 'claude/gone-zz99yy', 'some prose'])
    for (const line of load('session-menu.js', { body }).fn({ input, token: 't' }).caption.split('\n'))
      assert.doesNotMatch(line, /^\s/, `padded: ${JSON.stringify(line)}`);
  // The words still carry the register Describe-Input sets a clipboard caption
  // in: sans-serif bold italic, lowercased, behind a glyph.
  const bar = load('session-menu.js', { body }).fn({ input: '', token: 't' }).caption.split('\n')[0];
  assert.match(bar, /^\u{1F4CB} [\u{1D656}-\u{1D66F} ]+$/u);
});
