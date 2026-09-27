// kits/notes.js: the browser's half of notes. What breaks without these: an
// append that loses a note written between its read and its write, a read
// served the copy an append just replaced, a reply shown as a top-level note,
// and a page locator that carries a ref or cannot be read at all.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const win = { GH: { FRESH: { cache: 'no-store' }, toBase64: s => Buffer.from(s).toString('base64') } };
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/repo-address.js'), 'utf8'))(win);
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/notes.js'), 'utf8'))(win);
const N = win.Notes;

// A registry holding one file, with a blob sha per version. `interfere` runs
// once, between the append's read and its PUT, as another writer would.
let registries = 0;
function registry({ interfere } = {}) {
  const S = { text: null, sha: null, v: 0, puts: 0, history: [] };
  const commit = (text) => { S.history.push({ text: S.text, sha: S.sha }); S.text = text; S.sha = 's' + ++S.v; };
  return {
    S, commit, repo: 'me/registry' + ++registries, ref: 'main',
    async get() {
      if (S.text == null) throw Object.assign(new Error('404'), { status: 404 });
      return { text: S.text, sha: S.sha };
    },
    async req(p, opts) {
      assert.equal(p, 'contents/' + N.PATH);
      const body = JSON.parse(opts.body);
      if (interfere) { const f = interfere; interfere = null; f(); }
      S.puts++;
      if ((body.sha || null) !== S.sha) throw Object.assign(new Error('409'), { status: 409 });
      commit(Buffer.from(body.content, 'base64').toString());
      return { content: { sha: S.sha } };
    },
  };
}

const note = (about, text) => N.make({ about, text, author: 'me' });

test('make refuses what is not a locator and an empty note, and keeps a quote anchor', () => {
  assert.throws(() => note('not a locator', 'x'));
  assert.throws(() => note('a/b', '  '));
  const n = N.make({ about: 'a/b:docs/X.md', text: 'ok', author: 'me', anchor: { exact: 'the words', prefix: 'p', extra: 1 } });
  assert.deepEqual(Object.keys(n), ['id', 'at', 'author', 'about', 'text', 'anchor']);
  assert.deepEqual(n.anchor, { exact: 'the words', prefix: 'p', suffix: '' });
  for (const about of ['a/b', 'a/b@claude/x', 'a/b:p', 'a/b:p#frag', 'a/b@main:p', 'a/b#12', 'note:nabc1'])
    assert.ok(N.LOCATOR.test(about), about);
});

test('append writes to an empty store, then extends it', async () => {
  const gh = registry();
  await N.append(gh, note('a/b', 'first'));
  const all = await N.append(gh, note('a/b', 'second'));
  assert.deepEqual(all.map(n => n.text), ['first', 'second']);
  assert.equal(gh.S.text.split('\n').length, 3, 'two lines and a trailing newline');
});

test('a note written between the read and the write survives the append', async () => {
  const gh = registry({ interfere: () => gh.commit(gh.S.text + JSON.stringify(note('a/b', 'theirs')) + '\n') });
  gh.commit(JSON.stringify(note('a/b', 'mine')) + '\n');
  const all = await N.append(gh, note('a/b', 'later'));
  assert.deepEqual(all.map(n => n.text), ['mine', 'theirs', 'later']);
  assert.equal(gh.S.puts, 2, 'the first PUT was refused and the second re-read');
});

test('a read served the copy this page just replaced is read as the copy it wrote', async () => {
  const gh = registry();
  await N.append(gh, note('a/b', 'one'));
  await N.append(gh, note('a/b', 'two'));
  const lagging = { ...gh, get: async () => gh.S.history.at(-1) };
  gh.S.puts = 0;
  const all = await N.append(lagging, note('a/b', 'three'));
  assert.deepEqual(all.map(n => n.text), ['one', 'two', 'three']);
  assert.equal(gh.S.puts, 1, 'no conflict: the remembered copy supplied the current sha');
});

test('threads nests replies under the note they answer, newest subject first', () => {
  const a = { ...note('a/b@x', 'old'), at: '2026-01-01T00:00:00Z' };
  const b = { ...note('a/b@x', 'new'), at: '2026-01-02T00:00:00Z' };
  const r = { ...note('note:' + a.id, 'reply'), at: '2026-01-03T00:00:00Z' };
  const rr = { ...note('note:' + r.id, 'reply to reply'), at: '2026-01-04T00:00:00Z' };
  const ts = N.threads([rr, r, b, a, note('c/d', 'other')], s => s === 'a/b@x');
  assert.deepEqual(ts.map(t => t.text), ['new', 'old']);
  assert.equal(ts[1].replies[0].text, 'reply');
  assert.equal(ts[1].replies[0].replies[0].text, 'reply to reply');
  assert.equal(N.count(ts), 4);
});

test('parse skips a line it cannot read rather than losing the file', () => {
  assert.deepEqual(N.parse('{"id":"n1"}\nnot json\n\n{"id":"n2"}\n').map(n => n.id), ['n1', 'n2']);
});

test('a page locator is the file without its ref, from a blob URL or a toss link', () => {
  assert.equal(N.fromUrl('https://github.com/o/r/blob/main/docs/A%20B.md#x'), 'o/r:docs/A B.md');
  assert.equal(N.fromUrl('https://x.github.io/web-tools/pages/toss-render.html#gh=o/r@feat/y:pages/p.html'), 'o/r:pages/p.html');
  assert.equal(N.fromUrl('https://example.com/page'), '');
  assert.equal(N.listItem('o/r', 'lists/jots.json', 'j1'), 'o/r:lists/jots.json#j1');
});
