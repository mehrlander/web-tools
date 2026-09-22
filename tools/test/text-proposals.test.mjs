// The collection, read in the browser from its two files. The fixture is a
// miniature texts.jsonl and proposals.jsonl; what is under test is identity,
// validation, lookup boundaries, search, and the GH read cache.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { loadKit } from './bootstrap.mjs';

const window = { crypto: webcrypto, TextEncoder, GH: { FRESH: { cache: 'no-store' } } };
loadKit('text-proposals.js', { window });
const T = window.TextProposals;

const SPEC_PATH = 'projects/text/current-sources.json';
const SPEC = { schema: 'text-current-sources/v2', texts: 'projects/text/texts.jsonl', proposals: 'projects/text/proposals.jsonl' };
const sha = value => createHash('sha256').update(value, 'utf8').digest('hex');
const pyJson = obj => '{' + Object.keys(obj).sort().map(k => `${JSON.stringify(k)}: ${JSON.stringify(obj[k])}`).join(', ') + '}';

const STRINGS = ['families', 'bill-section families', 'chrome', 'decoration', 'old wording', 'new wording',
  'The lanes answer to different authorities.', 'The lanes answer to different authorities; adding them misleads.'];
const ID = Object.fromEntries(STRINGS.map(s => [s, sha(s)]));
const TEXTS = STRINGS.map(s => JSON.stringify({ id: ID[s], text: s })).join('\n') + '\n';
const EDGES = [
  ['families', 'bill-section families', 'guarded editorial pass', 'qualify'],
  ['chrome', 'decoration', 'guarded editorial pass', 'rephrase'],
  ['old wording', 'new wording', 'doc-audit', 'repair'],
  ['The lanes answer to different authorities.', 'The lanes answer to different authorities; adding them misleads.', 'Chief of Staff (Grok)', 'half-length'],
];
const PROPOSALS = EDGES.map(([from, to, author, purpose]) =>
  JSON.stringify({ from: ID[from], to: ID[to], author, purpose })).join('\n') + '\n';
const pid = ([from, to, author, purpose]) => sha(pyJson({ from: ID[from], to: ID[to], author, purpose }));

const args = ({ texts = TEXTS, proposals = PROPOSALS, spec = SPEC } = {}) => ({
  spec, files: { texts, proposals },
  metadata: { spec: { sha: '0'.repeat(40) }, texts: { sha: '1'.repeat(40), size: texts.length }, proposals: { sha: '2'.repeat(40), size: proposals.length } },
  repo: 'mehrlander/home', ref: 'main', specPath: SPEC_PATH,
});
const index = await T.build(args());

test('build reads the two files and derives the Python identities', () => {
  assert.equal(index.schema, 'text-browser-proposals/v2');
  assert.equal(index.summary.texts, 8);
  assert.equal(index.summary.proposals, 4);
  assert.deepEqual(index.summary.by_purpose, { qualify: 1, rephrase: 1, repair: 1, 'half-length': 1 });
  assert.deepEqual(index.summary.by_author, { 'guarded editorial pass': 2, 'doc-audit': 1, 'Chief of Staff (Grok)': 1 });
  assert.equal(index.proposals[0].id, pid(EDGES[0]), 'the proposal id is the hash text_store.propose writes');
  assert.equal(index.sources.texts.path, SPEC.texts);
  assert.equal(index.sources.proposals.sha, '2'.repeat(40));
});

test('view is the one shape every surface reads', () => {
  const v = T.view(index, index.proposals[0]);
  assert.deepEqual(Object.keys(v), ['id', 'from', 'to', 'author', 'purpose']);
  assert.equal(v.from.text, 'families');
  assert.equal(v.to.text, 'bill-section families');
  assert.equal(T.view(index, v.id).id, v.id, 'an id resolves to the same view');
  assert.equal(T.view(index, 'nope'), null);
});

test('lookup keeps exact and contained results distinct and honors Python edge trimming', () => {
  const exact = T.lookup(index, ' \u0085\u001cfamilies\u001f ', { contained: true });
  assert.equal(exact.selection.text, 'families');
  assert.equal(exact.exact.length, 1);
  assert.equal(exact.contained.length, 0, 'an exact proposal is never repeated under contained');
  assert.deepEqual(exact.warnings, [T.SCOPE_WARNING]);
  assert.equal(T.lookup(index, '﻿families﻿').exact.length, 0,
    'U+FEFF is not stripped by Python str.strip and must not alias an id');
  const larger = T.lookup(index, 'The families appear beside chrome, then families appear again.', { contained: true });
  assert.equal(larger.exact.length, 0);
  assert.deepEqual(larger.contained.map(row => row.from.text), ['families', 'chrome']);
  assert.deepEqual(larger.contained[0].spans, [[4, 12], [40, 48]]);
  assert.equal(T.lookup(index, 'FAMILIES', { contained: true }).contained.length, 0, 'case-sensitive');
  assert.equal(T.lookup(index, 'microchrome', { contained: true }).contained.length, 0, 'token-bounded');
});

test('search filters by author and purpose and reads both texts', () => {
  assert.deepEqual(T.search(index, { q: 'misleads' }).map(row => row.purpose), ['half-length']);
  assert.deepEqual(T.search(index, { purpose: 'repair' }).map(row => row.from.text), ['old wording']);
  assert.equal(T.search(index, { author: 'guarded editorial pass' }).length, 2);
  assert.equal(T.search(index, { author: 'guarded editorial pass', purpose: 'repair' }).length, 0);
  assert.equal(T.search(index, { q: 'not in the fixture' }).length, 0);
});

test('build refuses a text that does not hash to its id, and a proposal outside the collection', async () => {
  await assert.rejects(T.build(args({ texts: TEXTS.replace('"text":"chrome"', '"text":"chromium"') })), /does not hash to its id/);
  await assert.rejects(T.build(args({ texts: TEXTS.replace('"text":"chrome"', '"text":" chrome"') })), /not edge-trimmed/);
  await assert.rejects(T.build(args({ proposals: PROPOSALS + JSON.stringify({ from: 'x', to: ID.chrome, author: 'a', purpose: 'p' }) + '\n' })), /does not hold/);
  await assert.rejects(T.build(args({ proposals: PROPOSALS + JSON.stringify({ from: ID.chrome, to: ID.decoration, author: '', purpose: 'p' }) + '\n' })), /without an author/);
  await assert.rejects(T.build(args({ proposals: PROPOSALS + PROPOSALS.split('\n')[0] + '\n' })), /repeats proposal/);
  await assert.rejects(T.build(args({ spec: { ...SPEC, schema: 'text-current-sources/v1' } })), /Unsupported text source schema/);
});

function fixtureGh({ token = '', failSpecOnce = false, specText = JSON.stringify(SPEC) } = {}) {
  const blobs = { [SPEC_PATH]: specText, [SPEC.texts]: TEXTS, [SPEC.proposals]: PROPOSALS };
  const calls = [];
  let shouldFail = failSpecOnce;
  return {
    repo: 'mehrlander/home', ref: 'main', calls,
    get headers() { return token ? { Authorization: `Bearer ${token}` } : {}; },
    async get(path, options = {}) {
      calls.push({ path, options });
      if (path === SPEC_PATH && shouldFail) { shouldFail = false; const e = new Error('Not Found'); e.status = 404; throw e; }
      if (!(path in blobs)) { const e = new Error('Not Found'); e.status = 404; throw e; }
      return { text: blobs[path], sha: sha(blobs[path]), size: blobs[path].length, url: `https://github.com/mehrlander/home/blob/main/${path}` };
    },
  };
}

test('load reads the spec and the two files, and caches per credential', async () => {
  const anon = fixtureGh();
  const a = await T.load(anon);
  const b = await T.load(anon);
  assert.equal(a, b, 'one read per client');
  assert.deepEqual(anon.calls.map(c => c.path), [SPEC_PATH, SPEC.texts, SPEC.proposals]);
  assert.equal(a.summary.proposals, 4);
  const other = fixtureGh({ token: 'other' });
  assert.notEqual(await T.load(other), a, 'a different credential never receives another account\'s index');
  const quiet = fixtureGh();
  await T.load(quiet, { quiet: true });
  assert.ok(quiet.calls.every(c => c.options.quiet === true), 'a quiet read stays quiet on every fetch');
  await T.load(anon, { fresh: true });
  assert.equal(anon.calls.filter(c => c.path === SPEC_PATH).length, 2, 'fresh re-reads');
});

test('an unreachable collection reports the status, is held briefly, and recovers', async () => {
  T.clear();
  const gh = fixtureGh({ failSpecOnce: true });
  const old = T.FAIL_MS; T.FAIL_MS = 50;
  try {
    await assert.rejects(T.load(gh), /unavailable \(the collection read returned 404\)/);
    await assert.rejects(T.load(gh), /unavailable/, 'the rejection is held rather than retried per call');
    await new Promise(r => setTimeout(r, 60));
    assert.equal((await T.load(gh)).summary.proposals, 4, 'and recovers once the hold expires');
  } finally { T.FAIL_MS = old; }
});

test('a malformed file names the line rather than the network', async () => {
  const gh = fixtureGh();
  gh.get = async (path, options) => path === SPEC.proposals ? { text: '{"from":\n' } : fixtureGh().get(path, options);
  await assert.rejects(T.load(gh, { fresh: true }), /proposals\.jsonl line 1 is not JSON/);
  T.clear();
});
