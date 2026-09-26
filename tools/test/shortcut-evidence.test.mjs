// lib/kits/shortcut-evidence.js — the phone's log read as installation
// evidence. Every row shape below is copied from shortcuts/log/ in
// web-tools-private, because the defect this kit exists to fix was a shape
// read wrongly: a paste row's `build` is Library-Paste's own stamp, and the page
// scored it against the pasted chain, so every paste read stale.
//
// Then the baseline. An install from a commit on an open pull request is scored
// against that PR's head, not main, and anything the kit cannot answer yields
// no verdict rather than a guessed one.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const win = {};
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/shortcut-evidence.js'), 'utf8'))(win);
const K = win.ShortcutEvidence;

const SHA = '3793674509e3378e65a4f4ed8007373c4e22c8ad';
const HEAD = '203abce496c0ad4836581952ee7cf64cd26035a4';
const raw = (dir, file, ref = SHA) => `https://raw.githubusercontent.com/mehrlander/shortcut-tools/${ref}/${dir}/${file}`;

const PASTE = JSON.stringify({ op: 'paste', name: 'Dump-Named', from: raw('packed', 'dump-named.json'), target: 'c4fd8aa', build: 'f18efdb' });
const IMPORT = JSON.stringify({ op: 'import', name: 'Capture-Link', from: raw('plists', 'Capture-Link.plist', 'claude/shortcuts-repo-status-rt3pp0') });
const FETCH = JSON.stringify({ op: 'fetch', name: 'Run-AppDetermined', build: '16b4f91', from: raw('signed', 'Run-AppDetermined.shortcut') });
const DUMP = JSON.stringify({ op: 'dump', name: 'Dump-Named', file: '2026-09-25-121941.zip', build: 'c4fd8aa' });
const RUN = 'run name=Run-Pick build=b07361d chose=Get-FileInfo\n{"Base64":"' + 'x'.repeat(300) + '"}';

test('a paste row is about the pasted chain, and its build is the target', () => {
  const e = K.parse('2026-09-25-081915', PASTE);
  assert.equal(e.op, 'paste');
  assert.equal(e.install, true);
  assert.equal(e.name, 'Dump-Named');
  assert.equal(e.build, 'c4fd8aa');
  assert.deepEqual(e.installer, { name: 'Library-Paste', build: 'f18efdb' });
  assert.equal(e.source.ref, SHA);
  assert.equal(e.source.sha, true);
  assert.equal(e.verb, 'pasted');
});

test('a fetch row carries the installer\'s build, not the chain\'s', () => {
  const e = K.parse('2026-08-30-172440', FETCH);
  assert.equal(e.build, '');
  assert.equal(e.installer.build, '16b4f91');
});

test('an import row carries no build and names a branch ref', () => {
  const e = K.parse('2026-08-15-161024', IMPORT);
  assert.equal(e.build, '');
  assert.equal(e.source.ref, 'claude/shortcuts-repo-status-rt3pp0');
  assert.equal(e.source.sha, false);
});

test('a run is about itself, in either payload form', () => {
  const j = K.parse('2026-09-25-121953', DUMP);
  assert.equal(j.install, false);
  assert.equal(j.build, 'c4fd8aa');
  const h = K.parse('2026-08-29-115055', RUN);
  assert.equal(h.op, 'run');
  assert.equal(h.name, 'Run-Pick');
  assert.equal(h.build, 'b07361d');
  assert.equal(h.fields.chose, 'Get-FileInfo');
  assert.match(h.payload, /^\{"Base64"/);
});

test('text, a bare JSON string, and a nameless object all parse', () => {
  assert.equal(K.parse('2026-08-22-170121', 'I pledge allegiance').op, 'text');
  const s = K.parse('2026-08-22-160103', '"Dr. Livingstone, I presume?"');
  assert.equal(s.payload, 'Dr. Livingstone, I presume?');
  const o = K.parse('2026-09-25-063818', '{"op":"stage","type":"Text","chars":"21","build":"9ac9e06"}');
  assert.equal(o.name, '');
  assert.equal(o.fields.type, 'Text');
  assert.equal(K.parse('2026-09-25-063818', '{"Base64":"eA=="}').op, 'json');
});

test('a run inherits the ref of the newest earlier install of its name', () => {
  const es = K.link([K.parse('2026-09-25-121953', DUMP), K.parse('2026-09-25-081915', PASTE)]);
  assert.equal(es[0].via, SHA);
  assert.deepEqual(K.refs(es), [SHA]);
});

test('an open PR carrying the commit is the baseline; otherwise main', () => {
  const open = [{ number: 50, state: 'open', head: { sha: HEAD, ref: 'claude/x' } }];
  assert.deepEqual(K.baseOf(SHA, open), { kind: 'pr', pr: 50, head: HEAD, branch: 'claude/x' });
  assert.deepEqual(K.baseOf(SHA, [{ number: 48, state: 'closed', head: { sha: HEAD } }]), { kind: 'main' });
  assert.deepEqual(K.baseOf(SHA, []), { kind: 'main' });
  assert.deepEqual(K.baseOf('main', null), { kind: 'main' });
  assert.equal(K.baseOf(SHA, null), null);
});

test('a paste scored against its PR head, not main', () => {
  const e = K.parse('2026-09-25-081915', PASTE);
  const ctx = { at: { main: { 'Dump-Named': 'f0304eb' }, [HEAD]: { 'Dump-Named': 'c4fd8aa' } },
                base: { [SHA]: { kind: 'pr', pr: 50, head: HEAD } } };
  const v = K.verdict(e, ctx);
  assert.equal(v.state, 'current');
  assert.equal(v.against.pr, 50);
  ctx.at[HEAD]['Dump-Named'] = 'abcb62e';
  assert.equal(K.verdict(e, ctx).state, 'stale');
  assert.equal(K.verdict(e, ctx).target, 'abcb62e');
});

test('an install from a commit on main is scored against main', () => {
  const e = K.parse('2026-09-25-081915', PASTE);
  const ctx = { at: { main: { 'Dump-Named': 'f0304eb' } }, base: { [SHA]: { kind: 'main' } } };
  assert.equal(K.verdict(e, ctx).state, 'stale');
  ctx.at.main['Dump-Named'] = 'c4fd8aa';
  assert.equal(K.verdict(e, ctx).state, 'current');
});

test('an import\'s build is read off builds.json at its own ref, and says so', () => {
  const e = K.parse('2026-08-15-161024', IMPORT);
  const ref = e.source.ref;
  const v = K.verdict(e, { at: { main: { 'Capture-Link': 'be25494' }, [ref]: { 'Capture-Link': 'be25494' } },
                           base: { [ref]: { kind: 'main' } } });
  assert.equal(v.state, 'current');
  assert.equal(v.inferred, true);
});

test('a run is scored through the install it inherited', () => {
  const es = K.link([K.parse('2026-09-25-121953', DUMP), K.parse('2026-09-25-081915', PASTE)]);
  const v = K.verdict(es[0], { at: { main: { 'Dump-Named': 'f0304eb' }, [HEAD]: { 'Dump-Named': 'c4fd8aa' } },
                               base: { [SHA]: { kind: 'pr', pr: 50, head: HEAD } } });
  assert.equal(v.state, 'current');
  assert.equal(v.against.kind, 'pr');
});

test('unknown is silent: no verdict without both numbers', () => {
  const e = K.parse('2026-09-25-081915', PASTE);
  assert.equal(K.verdict(e, { at: { main: { 'Dump-Named': 'x' } }, base: {} }), null, 'baseline unanswered');
  assert.equal(K.verdict(e, { at: {}, base: { [SHA]: { kind: 'main' } } }), null, 'main unread');
  assert.equal(K.verdict(e, { at: { main: {} }, base: { [SHA]: { kind: 'main' } } }), null, 'not published there');
  const imp = K.parse('2026-08-15-161024', IMPORT);
  assert.equal(K.verdict(imp, { at: { main: { 'Capture-Link': 'x' }, [imp.source.ref]: null },
                                base: { [imp.source.ref]: { kind: 'main' } } }), null, 'source ref unreadable');
  assert.equal(K.verdict(K.parse('s', 'plain text'), { at: {}, base: {} }), null, 'no name');
});

test('pretty elides a long string and keeps its length', () => {
  const p = K.pretty('{"Base64":"' + 'y'.repeat(200) + '","Type":"Text"}');
  assert.match(p, /"Base64": "y{48}…\[200\]"/);
  assert.match(p, /"Type": "Text"/);
  assert.equal(K.pretty('not json'), null);
});
