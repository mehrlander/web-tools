// kits/notes.js: the browser's half of notes. What breaks without these: an
// append that loses a note written between its read and its write, a read
// served the copy an append just replaced, a reply shown as a top-level note,
// and a page locator that carries a ref or cannot be read at all.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
    assert.ok(N.isLocator(about), about);
});

// note.py carries the notes grammar as patterns, since the plugin ships it
// without lib/; the browser reads the same grammar through RepoAddress. The
// cases are the edges where two copies of a grammar drift: whitespace, a
// non-ASCII name, a slashed ref, and the forms only notes have.
const LOCATOR_CASES = [
  'a/b', 'a/b@claude/x', 'a/b:p', 'a/b:p#frag', 'a/b@main:p', 'a/b#12', 'note:nabc1',
  'me.dash/a.b-c@v2:x/y.json', 'o/r@main:dir/a b(1).md', 'a/b@x#1', 'a/b@feat/x:p#h=1',
  'not a locator', '', ' a/b', 'a/b ', 'a/b\n', 'a/b:', 'a/b#', 'a/b#x', 'note:', 'note:N1',
  'é/r:x', 'a/b@:x', 'README.md', 'a/b/c',
];

test('the browser and note.py accept the same locators', () => {
  const py = JSON.parse(execFileSync('python3', ['-c', `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(repoRoot, 'skills/notes'))})
import note
print(json.dumps([note.is_locator(s) for s in json.loads(sys.argv[1])]))
`, JSON.stringify(LOCATOR_CASES)], { encoding: 'utf8' }));
  LOCATOR_CASES.forEach((s, i) => assert.equal(py[i], N.isLocator(s), JSON.stringify(s)));
});

test('append writes to an empty store, then extends it', async () => {
  const gh = registry();
  await N.append(gh, note('a/b', 'first'));
  const all = await N.append(gh, note('a/b', 'second'));
  assert.deepEqual(all.map(n => n.text), ['first', 'second']);
  assert.equal(gh.S.text.split('\n').length, 3, 'two lines and a trailing newline');
});

test('several notes append as one write, and survive a write between the read and the PUT', async () => {
  const gh = registry({ interfere: () => gh.commit(gh.S.text + JSON.stringify(note('a/b', 'theirs')) + '\n') });
  gh.commit(JSON.stringify(note('a/b', 'mine')) + '\n');
  const all = await N.append(gh, [note('a/b', 'x'), note('a/b:p', 'y'), note('a/b', 'z')]);
  assert.deepEqual(all.map(n => n.text), ['mine', 'theirs', 'x', 'y', 'z']);
  assert.equal(gh.S.puts, 2, 'one refused PUT and one that carried all three');
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

// What a list of notes shows for each one. Without these a chip counts a note
// under the wrong kind of subject, a link pill opens the wrong place, and a
// title runs on past its sentence or stops inside a file name.
const SUBJECTS = [
  ['o/r:sessions/2026/10/2026-10-14-4b1d9c3e.json', 'session'],
  ['o/r:user-calls/7e2c4a19-plain-row-labels.json', 'call'],
  ['o/r:lists/jot.json#j1', 'list'],
  ['o/r:lists/snag.json#a-slug', 'list'],
  ['o/tools:docs/SNAGS.md#a-slug', 'list'],
  ['o/r#12', 'pull'],
  ['o/r@claude/a-branch', 'branch'],
  ['o/r@x#1', 'branch'],
  ['o/r:docs/X.md', 'file'],
  ['o/r:docs/X.md#a-heading', 'file'],
  ['o/r@main:lib/a.js', 'file'],
  ['o/r:tracker/tasks/a-task.md', 'file'],
  ['o/r:lists/jot.json', 'file'],
  ['o/r:sessions/compactions/2026/10/a.json', 'file'],
  ['o/r', 'repo'],
  ['note:nabc1', 'note'],
  ['not a locator', ''],
  ['', ''],
];

test('a locator reads as the kind of thing it names, and every kind has a label and an icon', () => {
  for (const [about, kind] of SUBJECTS) assert.equal(N.kind(about), kind, JSON.stringify(about));
  for (const [about, kind] of SUBJECTS) if (kind) assert.ok(N.KINDS[kind].label && /^ph-[a-z-]+$/.test(N.KINDS[kind].icon), about);
  assert.deepEqual(Object.keys(N.KINDS), ['session', 'call', 'list', 'pull', 'branch', 'file', 'repo', 'note']);
});

test('a subject carries what a link to it is built from', () => {
  const pick = (about, keys) => { const s = N.subject(about); return Object.fromEntries(keys.map(k => [k, s[k]])); };
  assert.deepEqual(pick('o/r:sessions/2026/10/2026-10-14-4b1d9c3e.json', ['repo', 'path', 'name', 'short']),
    { repo: 'o/r', path: 'sessions/2026/10/2026-10-14-4b1d9c3e.json', name: '2026-10-14-4b1d9c3e', short: '4b1d9c3e' });
  assert.deepEqual(pick('o/r:user-calls/7e2c4a19-plain-row-labels.json', ['repo', 'name']), { repo: 'o/r', name: '7e2c4a19-plain-row-labels' });
  assert.deepEqual(pick('o/r:lists/jot.json#j1', ['repo', 'path', 'list', 'id']), { repo: 'o/r', path: 'lists/jot.json', list: 'jot', id: 'j1' });
  assert.deepEqual(pick('o/tools:docs/SNAGS.md#a-slug', ['repo', 'list', 'id']), { repo: 'o/tools', list: 'snag', id: 'a-slug' },
    'a snag keeps the address its entry had in the Markdown log');
  assert.deepEqual(pick('o/r#12', ['repo', 'number']), { repo: 'o/r', number: 12 });
  assert.deepEqual(pick('o/r@claude/a-branch', ['repo', 'ref']), { repo: 'o/r', ref: 'claude/a-branch' });
  assert.deepEqual(pick('o/r@feat/x:docs/X.md#a-heading', ['repo', 'ref', 'path', 'fragment']),
    { repo: 'o/r', ref: 'feat/x', path: 'docs/X.md', fragment: 'a-heading' });
  assert.deepEqual(N.subject('o/r'), { kind: 'repo', repo: 'o/r' });
  assert.deepEqual(N.subject('note:nabc1'), { kind: 'note', id: 'nabc1' });
  assert.deepEqual(N.subject('a/b c'), { kind: '' });
});

// findings.js reads a finding's subjects with a parser of its own, which
// tells a snag and a tracker task apart where a note's kind does not.
test('a note and a finding read one locator as the same kind of thing', () => {
  new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/findings.js'), 'utf8'))(win);
  const same = { session: ['session'], call: ['call'], list: ['snag', 'file'], pull: ['pr'], branch: ['branch'],
                 file: ['file', 'task'], repo: ['repo'], note: ['note'], '': ['unknown'] };
  for (const [about, kind] of SUBJECTS) {
    const type = win.Findings.parse(about).type;
    assert.ok(same[kind].includes(type), `${JSON.stringify(about)}: ${kind} beside ${type}`);
  }
  assert.equal(win.Findings.parse('o/r:lists/jot.json#j1').type, 'file', 'the one difference: only a note counts a jot as a list item');
});

test('a note is titled by its first sentence, cut at a word when it runs long', () => {
  assert.equal(N.title('The kit still works on main. Nothing uses it.'), 'The kit still works on main');
  assert.equal(N.title('Is it still needed? Nobody said.'), 'Is it still needed?');
  assert.equal(N.title('\n\n  One line with no stop\nand a second line'), 'One line with no stop');
  assert.equal(N.title('docs/code-layers.md was cut in v2.5 of the doc. More.'), 'docs/code-layers.md was cut in v2.5 of the doc',
    'a stop inside a file name or a number ends nothing');
  assert.equal(N.title('Named by H. W. Fowler, e.g. in 1926. Then more.'), 'Named by H. W. Fowler, e.g. in 1926',
    'nor does one after an initial or an abbreviation');
  assert.equal(N.title('- **Read** `npm test` in [the log](https://e.x/y). Then more.'), 'Read npm test in the log');
  assert.equal(N.title('He wrote "done." And left.'), 'He wrote "done."');
  assert.equal(N.title(''), '');
  assert.equal(N.title(null), '');

  const long = 'Checked 2026-03-07: the harness table lost two rows in the last merge and still lists a script nobody runs, and the count beside it is stale.';
  const cut = N.title(long);
  assert.equal(cut, 'Checked 2026-03-07: the harness table lost two rows in the last merge and still lists a…');
  assert.ok(cut.length <= 90);
  assert.equal(N.title(long, 30), 'Checked 2026-03-07: the…');
  assert.equal(N.title(long, 21), 'Checked 2026-03-07…', 'a cut that lands on a mark drops it');
  assert.equal(N.title('x'.repeat(200), 20), 'x'.repeat(19) + '…', 'a run with no space is cut where it stands');
});

test('a note may vote up or down on a user call, or withdraw with an empty vote, and nothing else', () => {
  const n = N.make({ about: 'a/b:user-calls/x.json', text: 'Still holds.', author: 'gemini', vote: 'up' });
  assert.equal(n.vote, 'up');
  assert.equal(N.make({ about: 'a/b', text: 'x', author: 'me', vote: '' }).vote, '', 'an empty vote withdraws one');
  assert.equal('vote' in note('a/b', 'plain'), false, 'a plain note carries no vote');
  assert.throws(() => N.make({ about: 'a/b', text: 'x', author: 'me', vote: 'agrees' }), /vote/);
  assert.deepEqual([...N.VOTES], ['up', 'down']);
});
