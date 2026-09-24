// kits/errands.js: one record for everything a session needs a person's browser
// for. What breaks without these: an old mailbox record read as the wrong kind
// of errand; a run block the Stage would show with a venue or return route its
// method cannot use; a grade saying green on a partial read or an unmet
// expectation, which is the one line a person trusts before tapping; a signed
// result that cannot find its errand; a decline closed without its reason.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './bootstrap.mjs';

const win = {};
new Function('window', readFileSync(path.join(repoRoot, 'lib/kits/errands.js'), 'utf8'))(win);
const E = win.Errands;

const RUN = { script: 'me/tools@main:ps/list.ps1', method: 'ise-f5', venue: 'work-machine', outputType: 'json' };

// Stub GH whose read methods return canned data; get() throws for a missing
// path so per-file error isolation can be exercised.
function makeGH({ tree, branches, files } = {}) {
  return class GH {
    constructor(conf) { this.conf = conf; }
    async req(p) {
      if (p.startsWith('git/trees/')) return tree;
      throw new Error('unexpected req ' + p);
    }
    async branches() { return branches; }
    async get(p) {
      if (files && p in files) return files[p];
      const e = new Error('404'); e.status = 404; throw e;
    }
  };
}

test('pending lists request files with no same-named result', () => {
  assert.deepEqual(E.pending(['a.json', 'b.json', 'c.txt'], ['b.json']), ['a.json']);
});

test('normalize reads the older mailbox shapes as errands', () => {
  const ask = E.normalize({ id: 'a', kind: 'ask', note: 'the files\nfrom the laptop', dest: 'me/r:dump', task: 'me/h:t.md' });
  assert.equal(ask.action, '', 'an ask is the plain case: no action');
  assert.equal(ask.run, null, 'and no run block');
  assert.equal(ask.title, 'the files', 'the first line titles it when nothing else does');
  assert.equal(ask.for, 'me/h:t.md', 'task becomes for');
  assert.equal(E.normalize({ id: 't', kind: 'tree', repo: 'me/r', note: 'n' }).action, 'tree');
  assert.equal(E.normalize({ id: 'u', url: 'https://y.example/a' }).host, 'y.example', 'host falls out of the url');
  assert.equal(E.normalize(null), null);
});

test('normalize fills outputReturn, and a single venue, from the method registry', () => {
  const e = E.normalize({ id: 'x', note: 'n', dest: 'me/r:d', run: RUN });
  assert.equal(e.run.outputReturn, 'direct-to-clipboard');
  assert.equal(e.run.outputSigned, false, 'unsigned unless the record says true');
  const c = E.normalize({ id: 'c', note: 'n', dest: 'me/r:d', url: 'https://x.example/',
    run: { script: 'me/r@main:c.js', method: 'courier-bookmark' } });
  assert.equal(c.run.venue, 'browser', 'a method with one venue supplies it');
  assert.equal(c.run.outputReturn, 'courier-message');
  const two = E.normalize({ id: 'p', note: 'n', dest: 'me/r:d', run: { script: 'me/r@main:p.ps1', method: 'ise-f5' } });
  assert.equal(two.run.venue, '', 'a method with two venues does not pick one');
});

test('validate: a note on every errand, an action only for the Stage reads', () => {
  const v = (raw) => E.validate(E.normalize(raw));
  assert.equal(v({ id: 'x', action: 'fetch', repo: 'me/r', paths: ['a'], note: 'n' }).ok, true);
  assert.equal(v({ id: 'x', action: 'fetch', repo: 'me/r', note: 'n' }).ok, false, 'fetch needs paths');
  assert.equal(v({ id: 'x', action: 'tree', repo: 'r', note: 'n' }).ok, false, 'a read needs owner/name');
  assert.equal(v({ id: 'x', action: 'tree', repo: 'me/r' }).ok, false, 'a read needs its note too');
  assert.equal(v({ id: 'x', note: 'n', dest: 'me/r:d' }).ok, true, 'the plain case');
  assert.equal(v({ id: 'x', note: ' ', dest: 'me/r:d' }).ok, false);
  assert.equal(v({ id: 'x', action: 'courier', note: 'n', dest: 'me/r:d' }).ok, false, 'an unknown action is refused, not guessed');
  assert.equal(v({ id: 'x', note: 'n', dest: 'me/r:d', purpose: 'trial' }).ok, false, 'purpose is a closed set');
  assert.equal(v({ id: 'x', note: 'n', dest: 'me/r:d', purpose: 'get-data' }).ok, true);
  assert.equal(v({ note: 'n', dest: 'me/r:d' }).ok, false, 'an errand needs an id');
});

test('validate refuses a run its method cannot perform', () => {
  const v = (run, extra = {}) => E.validate(E.normalize({ id: 'x', note: 'n', dest: 'me/r:d', run, ...extra }));
  assert.equal(v(RUN).ok, true);
  assert.match(v({ ...RUN, venue: 'browser' }).error, /ise-f5 runs on personal-laptop or work-machine/);
  assert.match(v({ ...RUN, outputReturn: 'courier-message' }).error, /returns by direct-to-clipboard/);
  assert.match(v({ ...RUN, script: 'ps/list.ps1' }).error, /owner\/repo@ref:path/);
  assert.match(v({ ...RUN, method: 'f5' }).error, /unknown run.method/);
  assert.match(v({ ...RUN, outputType: 'xml' }).error, /unknown run.outputType/);
  const courier = { script: 'me/r@main:c.js', method: 'courier-bookmark' };
  assert.match(v(courier).error, /url of its page/);
  assert.equal(v(courier, { url: 'https://x.example/' }).ok, true);
});

test('parseScript splits the address, and nothing else', () => {
  assert.deepEqual(E.parseScript('me/r@main:a/b.ps1'), { repo: 'me/r', ref: 'main', path: 'a/b.ps1' });
  assert.equal(E.parseScript('me/r:a.ps1'), null, 'the ref is required: the exact code');
});

test('withErrandId puts the id after # @file in PowerShell and first in JavaScript', () => {
  assert.equal(E.withErrandId('# @file ps/a.ps1\n$x = 1', 'ise-f5', 'e1'), "# @file ps/a.ps1\n$ErrandId = 'e1'\n$x = 1");
  assert.equal(E.withErrandId('$x = 1', 'ise-f5', 'e1'), "$ErrandId = 'e1'\n$x = 1", 'no @file line: first');
  assert.equal(E.withErrandId('copy(1)', 'console-enter', "e'2"), "const ErrandId = 'e2';\ncopy(1)", 'a quote cannot end the string');
});

test('a signed envelope is recognised, and its body becomes the staged file', () => {
  const env = { envelope: 'errand-result/1', errand: 'e1', script: 'ps/a.ps1', ranAt: 'T', venue: 'work-machine',
                outputType: 'json', body: { rows: 2 } };
  const got = E.envelope('  ' + JSON.stringify(env) + '\n');
  assert.equal(got.errand, 'e1');
  assert.deepEqual(E.envelopeFile(got), { name: 'e1.json', text: '{\n  "rows": 2\n}' });
  assert.equal(E.envelopeFile({ ...env, outputType: 'csv', body: 'a,b\n' }).name, 'e1.csv');
  assert.equal(E.envelope(JSON.stringify({ ...env, envelope: 'other/1' })), null);
  assert.equal(E.envelope(JSON.stringify({ ...env, errand: '' })), null, 'an envelope names its errand');
  assert.equal(E.envelope('{"envelope":"errand-result/1"'), null, 'a torn paste is ordinary text');
  assert.equal(E.envelope('just text'), null);
});

test('a read grades itself, and green means complete', () => {
  const fetch = E.normalize({ id: 'f', action: 'fetch', repo: 'me/r', paths: ['a', 'b'], note: 'n' });
  assert.equal(E.verdict(fetch, null).level, 'red');
  assert.equal(E.verdict(fetch, { ok: false, error: 'HTTP 401' }).text, 'HTTP 401');
  const part = { ok: true, data: { files: [{ path: 'a', ok: true }, { path: 'b', ok: false }] } };
  assert.equal(E.verdict(fetch, part).level, 'amber');
  assert.match(E.verdict(fetch, part).text, /missing b/);
  assert.equal(E.verdict(fetch, { ok: true, data: { files: [{ path: 'a', ok: true }, { path: 'b', ok: true }] } }).level, 'green');
  const tree = E.normalize({ id: 't', action: 'tree', repo: 'me/r', note: 'n' });
  assert.equal(E.verdict(tree, { ok: true, data: { truncated: true, entries: [{}] } }).level, 'amber', 'a truncated listing is not complete');
  assert.equal(E.verdict(tree, { ok: true, data: { truncated: false, entries: [{}, {}] } }).text, '2 entries listed');
});

test('any other errand is graded against what is staged and what it expects', () => {
  const e = E.normalize({ id: 'c', note: 'n', dest: 'me/r:d',
    expect: { files: 1, names: ['*.md'], match: '^\\| \\d{4} \\|', min: 2 } });
  assert.equal(E.verdict(e, { files: [] }).level, 'red');
  const g1 = E.verdict(e, { files: [{ name: 'list.md', text: '| 2019 | a |\n' }] });
  assert.equal(g1.level, 'amber');
  assert.match(g1.text, /1 match for the expected pattern, wanted 2/);
  assert.equal(E.verdict(e, { files: [{ name: 'list.md', text: '| 2019 | a |\n| 2020 | b |\n' }] }).level, 'green');
  assert.match(E.verdict(e, { files: [{ name: 'x.txt', text: '| 2019 |\n| 2020 |' }] }).text, /no file matching \*\.md/);
  const plain = E.normalize({ id: 'p', note: 'n', dest: 'me/r:d' });
  assert.equal(E.verdict(plain, { files: [{ name: 'any', text: '' }] }).level, 'green', 'with no expect, one file is enough');
});

test('close records both outcomes as served, and refuses a bare decline', () => {
  const e = E.normalize({ id: 'x', note: 'n', dest: 'me/r:d', purpose: 'test-script' });
  assert.equal(E.close(e, { answered: false, message: '  ' }).ok, false);
  const no = E.close(e, { answered: false, message: 'not needed', now: 'T' });
  assert.deepEqual(no, { id: 'x', purpose: 'test-script', closedAt: 'T', ok: true, answered: false, message: 'not needed' });
  const yes = E.close(E.normalize({ id: 't', action: 'tree', repo: 'me/r', note: 'n' }),
    { answered: true, grade: { level: 'green', text: 'ok' }, data: { n: 1 }, now: 'T' });
  assert.equal(yes.action, 'tree');
  assert.equal(yes.verdict.level, 'green');
  assert.deepEqual(yes.data, { n: 1 });
});

test('fulfill performs each read against the token, and never throws', async () => {
  const read = (raw, gh) => E.fulfill(E.normalize({ id: '1', note: 'n', repo: 'o/r', ...raw }), { GH: makeGH(gh), token: 't', now: 'T' });
  const tree = await read({ action: 'tree' }, { tree: { truncated: false, tree: [{ path: 'a.js', type: 'blob', size: 10, sha: 's1' }] } });
  assert.equal(tree.data.entries[0].path, 'a.js');
  const br = await read({ action: 'branches' }, { branches: [{ name: 'main', commit: { sha: 'abc' } }] });
  assert.deepEqual(br.data.branches, [{ name: 'main', sha: 'abc' }]);
  const f = await read({ action: 'fetch', paths: ['a.js', 'missing.js'] }, { files: { 'a.js': { size: 3, text: 'hi\n' } } });
  assert.equal(f.data.files[0].text, 'hi\n');
  assert.equal(f.data.files[1].ok, false, 'one missing file does not sink the rest');
  assert.equal((await read({ action: 'fetch' }, {})).ok, false, 'a bad request is refused before the network');
  assert.equal((await read({}, {})).ok, false, 'a plain errand is not a read');
});
