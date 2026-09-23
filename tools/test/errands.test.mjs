// kits/errands.js: one record for everything a session needs a person's browser
// for. What breaks without these: an old mailbox record or a courier list entry
// read as the wrong action, or closing somewhere it is never found again; a
// grade saying green on a partial read or an unmet expectation, which is the
// one line a person trusts before tapping; a decline closed without its reason.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const win = {};
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/errands.js'), 'utf8'))(win);
const E = win.Errands;

test('pending lists request files with no same-named result', () => {
  assert.deepEqual(E.pending(['a.json', 'b.json', 'c.txt'], ['b.json']), ['a.json']);
});

test('normalize reads every older shape as one errand', () => {
  const ask = E.normalize({ id: 'a', kind: 'ask', note: 'the files\nfrom the laptop', dest: 'me/r:dump', task: 'me/h:t.md' });
  assert.equal(ask.action, 'hand', 'an ask is a hand errand');
  assert.equal(ask.title, 'the files', 'the first line titles it when nothing else does');
  assert.equal(ask.dest, 'me/r:dump');
  assert.equal(ask.for, 'me/h:t.md', 'task becomes for');

  const read = E.normalize({ id: 't', kind: 'tree', repo: 'me/r' });
  assert.equal(read.action, 'tree');

  const courier = E.normalize({ id: 'c', host: 'x.example', url: 'https://x.example/p', script: 's.js', status: 'open',
    result: { repo: 'me/p', branch: 'main', path: 'courier/results/c.md' } });
  assert.equal(courier.action, 'courier', 'a list entry with a script is a courier errand');
  assert.equal(courier.dest, 'me/p@main:courier/results', 'the destination is the folder, not the file');
  assert.equal(courier.file, 'c.md', 'and the file keeps its name');

  assert.equal(E.normalize({ id: 'u', url: 'https://y.example/a' }).host, 'y.example', 'host falls out of the url');
  assert.equal(E.normalize(null), null);
});

test('validate names what each action needs', () => {
  const v = (raw) => E.validate(E.normalize(raw)).ok;
  assert.equal(v({ id: 'x', action: 'fetch', repo: 'me/r', paths: ['a'] }), true);
  assert.equal(v({ id: 'x', action: 'fetch', repo: 'me/r' }), false, 'fetch needs paths');
  assert.equal(v({ id: 'x', action: 'tree', repo: 'r' }), false, 'a read needs owner/name');
  assert.equal(v({ id: 'x', action: 'hand', note: 'n', dest: 'me/r:d' }), true);
  assert.equal(v({ id: 'x', action: 'hand', note: ' ', dest: 'me/r:d' }), false, 'a hand errand says what it wants');
  assert.equal(v({ id: 'x', action: 'courier', dest: 'me/r:d', url: 'https://a/' }), false, 'a courier errand needs its script');
  assert.equal(v({ id: 'x', action: 'launch', dest: 'me/r:d' }), false, 'an unknown action is refused, not guessed');
  assert.equal(v({ action: 'tree', repo: 'me/r' }), false, 'an errand needs an id');
});

test('a read grades itself, and green means complete', () => {
  const fetch = E.normalize({ id: 'f', action: 'fetch', repo: 'me/r', paths: ['a', 'b'] });
  assert.equal(E.verdict(fetch, null).level, 'red');
  assert.equal(E.verdict(fetch, { ok: false, error: 'HTTP 401' }).text, 'HTTP 401');
  assert.equal(E.verdict(fetch, { ok: true, data: { files: [{ path: 'a', ok: true }, { path: 'b', ok: false }] } }).level, 'amber');
  assert.match(E.verdict(fetch, { ok: true, data: { files: [{ path: 'a', ok: true }, { path: 'b', ok: false }] } }).text, /missing b/);
  assert.equal(E.verdict(fetch, { ok: true, data: { files: [{ path: 'a', ok: true }, { path: 'b', ok: true }] } }).level, 'green');
  const tree = E.normalize({ id: 't', action: 'tree', repo: 'me/r' });
  assert.equal(E.verdict(tree, { ok: true, data: { truncated: true, entries: [{}] } }).level, 'amber', 'a truncated listing is not complete');
  assert.equal(E.verdict(tree, { ok: true, data: { truncated: false, entries: [{}, {}] } }).text, '2 entries listed');
});

test('a courier or hand errand is graded against what is staged and what it expects', () => {
  const e = E.normalize({ id: 'c', action: 'hand', note: 'n', dest: 'me/r:d',
    expect: { files: 1, names: ['*.md'], match: '^\\| \\d{4} \\|', min: 2 } });
  assert.equal(E.verdict(e, { files: [] }).level, 'red');
  const one = [{ name: 'list.md', text: '| 2019 | a |\n' }];
  const g1 = E.verdict(e, { files: one });
  assert.equal(g1.level, 'amber');
  assert.match(g1.text, /1 match for the expected pattern, wanted 2/);
  const two = [{ name: 'list.md', text: '| 2019 | a |\n| 2020 | b |\n' }];
  assert.equal(E.verdict(e, { files: two }).level, 'green');
  assert.match(E.verdict(e, { files: [{ name: 'x.txt', text: '| 2019 |\n| 2020 |' }] }).text, /no file matching \*\.md/);
  const plain = E.normalize({ id: 'p', action: 'hand', note: 'n', dest: 'me/r:d' });
  assert.equal(E.verdict(plain, { files: [{ name: 'any', text: '' }] }).level, 'green', 'with no expect, one file is enough');
});

test('close records both outcomes as served, and refuses a bare decline', () => {
  const e = E.normalize({ id: 'x', action: 'hand', note: 'n', dest: 'me/r:d' });
  assert.equal(E.close(e, { answered: false, message: '  ' }).ok, false);
  const no = E.close(e, { answered: false, message: 'not needed', now: 'T' });
  assert.deepEqual(no, { id: 'x', action: 'hand', closedAt: 'T', ok: true, answered: false, message: 'not needed' });
  const yes = E.close(e, { answered: true, grade: { level: 'green', text: 'ok' }, data: { n: 1 }, now: 'T' });
  assert.equal(yes.verdict.level, 'green');
  assert.deepEqual(yes.data, { n: 1 });
});
