// The collection, read in the browser from its three files. The fixture is a
// miniature texts.jsonl, proposals.jsonl, and revisions.jsonl; what is under
// test is identity, validation, lookup, search, the chain, and the read cache.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { loadKit } from './bootstrap.mjs';

const window = { crypto: webcrypto, TextEncoder, GH: { FRESH: { cache: 'no-store' } } };
loadKit('text-collection.js', { window });
const T = window.TextCollection;
const P = T.PATHS;
const sha = value => createHash('sha256').update(value, 'utf8').digest('hex');
const pyJson = obj => '{' + Object.keys(obj).sort().map(k => `${JSON.stringify(k)}: ${JSON.stringify(obj[k])}`).join(', ') + '}';

const STRINGS = ['families', 'bill-section families', 'chrome', 'decoration', 'old wording', 'new wording',
  'The lanes answer to different authorities.', 'The lanes answer to different authorities; adding them misleads.',
  'The oldest wording.'];
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
const REVISIONS = [
  { from: ID['The oldest wording.'], to: ID['old wording'], repo: 'mehrlander/web-tools', path: 'docs/a.md', commit: 'a'.repeat(40) },
  { from: ID['old wording'], to: ID['new wording'], repo: 'mehrlander/web-tools', path: 'docs/a.md', commit: 'b'.repeat(40) },
  { from: ID['chrome'], to: ID['new wording'], repo: 'mehrlander/web-tools', path: 'docs/b.md', commit: 'c'.repeat(40) },
].map(r => JSON.stringify(r)).join('\n') + '\n';

const args = ({ texts = TEXTS, proposals = PROPOSALS, revisions = REVISIONS } = {}) => ({
  files: { texts, proposals, revisions },
  metadata: { texts: { sha: '1'.repeat(40), size: texts.length }, proposals: { sha: '2'.repeat(40), size: proposals.length }, revisions: { sha: '3'.repeat(40) } },
  repo: 'mehrlander/home', ref: 'main',
});
const index = await T.build(args());

test('build reads the three files and derives the Python identities', () => {
  assert.equal(index.schema, 'text-collection/v1');
  assert.equal(index.summary.texts, 9);
  assert.equal(index.summary.proposals, 4);
  assert.equal(index.summary.revisions, 3);
  assert.deepEqual(index.summary.by_purpose, { qualify: 1, rephrase: 1, repair: 1, 'half-length': 1 });
  assert.deepEqual(index.summary.by_author, { 'guarded editorial pass': 2, 'doc-audit': 1, 'Chief of Staff (Grok)': 1 });
  assert.equal(index.proposals[0].id, pid(EDGES[0]), 'the proposal id is the hash text_store.propose writes');
  assert.equal(index.sources.texts.path, P.texts);
  assert.equal(index.sources.proposals.sha, '2'.repeat(40));
  assert.deepEqual(Object.keys(index.revisions[0]), ['from', 'to', 'repo', 'path', 'commit']);
});

test('view is the one shape every surface reads', () => {
  const v = T.view(index, index.proposals[0]);
  assert.deepEqual(Object.keys(v), ['id', 'from', 'to', 'author', 'purpose']);
  assert.equal(v.from.text, 'families');
  assert.equal(v.to.text, 'bill-section families');
  assert.equal(T.view(index, v.id).id, v.id, 'an id resolves to the same view');
  assert.equal(T.view(index, 'nope'), null);
});

test('lookup matches the exact text only and honors Python edge trimming', () => {
  const exact = T.lookup(index, ' \u0085\u001cfamilies\u001f ');
  assert.equal(exact.selection.text, 'families');
  assert.equal(exact.exact.length, 1);
  assert.deepEqual(Object.keys(exact), ['selection', 'exact', 'warnings'], 'no contained band');
  assert.deepEqual(exact.warnings, [T.SCOPE_WARNING]);
  assert.equal(T.lookup(index, '\ufefffamilies\ufeff').exact.length, 0,
    'U+FEFF is not stripped by Python str.strip and must not alias an id');
  assert.equal(T.lookup(index, 'The families appear beside chrome.').exact.length, 0, 'a larger selection is not a match');
  assert.equal(T.lookup(index, 'FAMILIES').exact.length, 0, 'case-sensitive');
});

test('chain follows revisions back by id, newest first, with the proposals at each step', () => {
  const steps = T.chain(index, ID['new wording']);
  assert.deepEqual(steps.map(s => s.text), ['new wording', 'old wording', 'The oldest wording.']);
  assert.equal(steps[0].revision, null, 'the text asked about was produced by nothing in this chain');
  assert.equal(steps[1].revision.commit, 'b'.repeat(40), 'each step carries the revision that produced the step above it');
  assert.equal(steps[0].also_from.length, 1, 'a second revision into the same text is listed, not followed');
  assert.equal(steps[0].also_from[0].path, 'docs/b.md');
  assert.deepEqual(steps[1].proposals.map(p => p.purpose), ['repair'], 'the proposals made against the earlier text ride with it');
  assert.equal(T.chain(index, ID['families']).length, 1, 'a text no revision led into is its own one-step chain');
  assert.equal(T.chain(index, 'nope').length, 0);
});

test('search filters by author and purpose and reads both texts', () => {
  assert.deepEqual(T.search(index, { q: 'misleads' }).map(row => row.purpose), ['half-length']);
  assert.deepEqual(T.search(index, { purpose: 'repair' }).map(row => row.from.text), ['old wording']);
  assert.equal(T.search(index, { author: 'guarded editorial pass' }).length, 2);
  assert.equal(T.search(index, { author: 'guarded editorial pass', purpose: 'repair' }).length, 0);
  assert.equal(T.search(index, { q: 'not in the fixture' }).length, 0);
});

test('build refuses a text that does not hash to its id, and a row outside the collection', async () => {
  await assert.rejects(T.build(args({ texts: TEXTS.replace('"text":"chrome"', '"text":"chromium"') })), /does not hash to its id/);
  await assert.rejects(T.build(args({ texts: TEXTS.replace('"text":"chrome"', '"text":" chrome"') })), /not edge-trimmed/);
  await assert.rejects(T.build(args({ proposals: PROPOSALS + JSON.stringify({ from: 'x', to: ID.chrome, author: 'a', purpose: 'p' }) + '\n' })), /does not hold/);
  await assert.rejects(T.build(args({ proposals: PROPOSALS + JSON.stringify({ from: ID.chrome, to: ID.decoration, author: '', purpose: 'p' }) + '\n' })), /without an author/);
  await assert.rejects(T.build(args({ proposals: PROPOSALS + PROPOSALS.split('\n')[0] + '\n' })), /repeats proposal/);
  await assert.rejects(T.build(args({ revisions: REVISIONS + JSON.stringify({ from: ID.chrome, to: ID.chrome, repo: 'r', path: 'p', commit: 'c' }) + '\n' })), /revises a text into itself/);
  await assert.rejects(T.build(args({ revisions: REVISIONS + JSON.stringify({ from: ID.chrome, to: ID.decoration, repo: 'r', path: 'p' }) + '\n' })), /missing one of/);
});

function fixtureGh({ token = '', failOnce = false } = {}) {
  const blobs = { [P.texts]: TEXTS, [P.proposals]: PROPOSALS, [P.revisions]: REVISIONS };
  const calls = [];
  let shouldFail = failOnce;
  return {
    repo: 'mehrlander/home', ref: 'main', calls,
    get headers() { return token ? { Authorization: `Bearer ${token}` } : {}; },
    async get(path, options = {}) {
      calls.push({ path, options });
      if (path === P.texts && shouldFail) { shouldFail = false; const e = new Error('Not Found'); e.status = 404; throw e; }
      if (!(path in blobs)) { const e = new Error('Not Found'); e.status = 404; throw e; }
      return { text: blobs[path], sha: sha(blobs[path]), size: blobs[path].length, url: `https://github.com/mehrlander/home/blob/main/${path}` };
    },
  };
}

test('load reads the three files at their fixed paths, and caches per credential', async () => {
  const anon = fixtureGh();
  const a = await T.load(anon);
  const b = await T.load(anon);
  assert.equal(a, b, 'one read per client');
  assert.deepEqual(anon.calls.map(c => c.path).sort(), [P.proposals, P.revisions, P.texts].sort());
  assert.equal(a.summary.proposals, 4);
  const other = fixtureGh({ token: 'other' });
  assert.notEqual(await T.load(other), a, 'a different credential never receives another account\'s index');
  const quiet = fixtureGh();
  await T.load(quiet, { quiet: true });
  assert.ok(quiet.calls.every(c => c.options.quiet === true), 'a quiet read stays quiet on every fetch');
  await T.load(anon, { fresh: true });
  assert.equal(anon.calls.filter(c => c.path === P.texts).length, 2, 'fresh re-reads');
});

test('an unreachable collection reports the status, is held briefly, and recovers', async () => {
  T.clear();
  const gh = fixtureGh({ failOnce: true });
  const old = T.FAIL_MS; T.FAIL_MS = 50;
  try {
    await assert.rejects(T.load(gh), /unavailable \(the read returned 404\)/);
    await assert.rejects(T.load(gh), /unavailable/, 'the rejection is held rather than retried per call');
    await new Promise(r => setTimeout(r, 60));
    assert.equal((await T.load(gh)).summary.proposals, 4, 'and recovers once the hold expires');
  } finally { T.FAIL_MS = old; }
});

test('a malformed file names the line rather than the network', async () => {
  const gh = fixtureGh();
  gh.get = async (path, options) => path === P.proposals ? { text: '{"from":\n' } : fixtureGh().get(path, options);
  await assert.rejects(T.load(gh, { fresh: true }), /proposals\.jsonl line 1 is not JSON/);
  T.clear();
});
