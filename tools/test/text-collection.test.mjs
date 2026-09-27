// The collection, read in the browser from its files. The fixture is a
// miniature passages.jsonl, variants.jsonl and proposals.jsonl; what is under
// test is identity, validation, the variant-proposal join, lookup, search, the
// read cache, and the transition read of a home that has no variants.jsonl.

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
const PASSAGES = STRINGS.map(s => JSON.stringify({ id: ID[s], text: s })).join('\n') + '\n';
const EDGES = [
  ['families', 'bill-section families', 'guarded editorial pass', 'qualify'],
  ['chrome', 'decoration', 'guarded editorial pass', 'rephrase'],
  ['old wording', 'new wording', 'doc-audit', 'repair'],
  ['The lanes answer to different authorities.', 'The lanes answer to different authorities; adding them misleads.', 'Chief of Staff (Grok)', 'half-length'],
];
const VARIANTS = EDGES.map(([from, to, author, purpose]) =>
  JSON.stringify({ from: ID[from], to: ID[to], author, purpose })).join('\n') + '\n';
const BASIS = 'https://github.com/mehrlander/web-tools/pull/1';
const PROPOSALS = JSON.stringify({ from: ID.families, to: ID['bill-section families'],
  repo: 'mehrlander/web-tools', path: 'docs/text-tools.md', basis: BASIS }) + '\n';
const vid = ([from, to, author, purpose]) => sha(pyJson({ from: ID[from], to: ID[to], author, purpose }));
const args = ({ passages = PASSAGES, variants = VARIANTS, proposals = PROPOSALS } = {}) => ({
  files: { passages, variants, proposals },
  metadata: {
    passages: { sha: '1'.repeat(40), size: passages.length },
    variants: { sha: '2'.repeat(40), size: variants.length },
    proposals: { sha: '3'.repeat(40), size: proposals.length },
  },
  repo: 'mehrlander/home', ref: 'main',
});
const index = await T.build(args());

test('build reads the three files and derives the Python identities', () => {
  assert.equal(index.schema, 'text-collection/v1');
  assert.equal(index.summary.passages, 9);
  assert.equal(index.summary.variants, 4);
  assert.equal(index.summary.proposals, 1);
  assert.equal('revisions' in index, false, 'a passage\'s history is git\'s, read by md-history, not a file here');
  assert.deepEqual(index.summary.by_purpose, { qualify: 1, rephrase: 1, repair: 1, 'half-length': 1 });
  assert.deepEqual(index.summary.by_author, { 'guarded editorial pass': 2, 'doc-audit': 1, 'Chief of Staff (Grok)': 1 });
  assert.equal(index.variants[0].id, vid(EDGES[0]), 'the variant id is the hash proposal ids were, so old addresses resolve');
  assert.equal(index.sources.passages.path, P.passages);
  assert.equal(index.sources.variants.path, 'projects/text/variants.jsonl');
  assert.equal(index.sources.variants.sha, '2'.repeat(40));
  assert.deepEqual(Object.keys(index.sources), ['passages', 'variants', 'proposals']);
  assert.deepEqual(index.proposals, [{ from: ID.families, to: ID['bill-section families'],
    repo: 'mehrlander/web-tools', path: 'docs/text-tools.md', basis: BASIS }]);
});

test('view is the one shape every surface reads', () => {
  const v = T.view(index, index.variants[0]);
  assert.deepEqual(Object.keys(v), ['id', 'from', 'to', 'author', 'purpose', 'proposals']);
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

test('search filters by author and purpose and reads both texts', () => {
  assert.deepEqual(T.search(index, { q: 'misleads' }).map(row => row.purpose), ['half-length']);
  assert.deepEqual(T.search(index, { purpose: 'repair' }).map(row => row.from.text), ['old wording']);
  assert.equal(T.search(index, { author: 'guarded editorial pass' }).length, 2);
  assert.equal(T.search(index, { author: 'guarded editorial pass', purpose: 'repair' }).length, 0);
  assert.equal(T.search(index, { q: 'not in the fixture' }).length, 0);
});

test('build refuses a passage that does not hash to its id, and a row outside the collection', async () => {
  await assert.rejects(T.build(args({ passages: PASSAGES.replace('"text":"chrome"', '"text":"chromium"') })), /does not hash to its id/);
  await assert.rejects(T.build(args({ passages: PASSAGES.replace('"text":"chrome"', '"text":" chrome"') })), /not edge-trimmed/);
  await assert.rejects(T.build(args({ variants: VARIANTS + JSON.stringify({ from: 'x', to: ID.chrome, author: 'a', purpose: 'p' }) + '\n' })), /does not hold/);
  await assert.rejects(T.build(args({ variants: VARIANTS + JSON.stringify({ from: ID.chrome, to: ID.decoration, author: '', purpose: 'p' }) + '\n' })), /without an author/);
  await assert.rejects(T.build(args({ variants: VARIANTS + VARIANTS.split('\n')[0] + '\n' })), /repeats variant/);
  await assert.rejects(T.build({ ...args(), files: { passages: PASSAGES } }), /missing variants/);
});

test('build validates proposals and treats a missing proposals text as none', async () => {
  const row = { from: ID.chrome, to: ID.decoration, repo: 'mehrlander/home', path: 'README.md', basis: BASIS };
  await assert.rejects(T.build(args({ proposals: JSON.stringify({ ...row, from: 'x' }) + '\n' })), /does not hold/);
  await assert.rejects(T.build(args({ proposals: JSON.stringify({ ...row, basis: '' }) + '\n' })), /without a from, to, repo, path and basis/);
  await assert.rejects(T.build(args({ proposals: JSON.stringify({ ...row, path: 7 }) + '\n' })), /without a from, to, repo, path and basis/);
  const line = JSON.stringify(row) + '\n';
  await assert.rejects(T.build(args({ proposals: line + line })), /repeats a proposal for mehrlander\/home:README\.md/);
  const none = await T.build({ ...args(), files: { passages: PASSAGES, variants: VARIANTS } });
  assert.deepEqual(none.proposals, []);
  assert.equal(none.summary.proposals, 0);
});

test('a proposal rides on the view of the variant with the same passage pair, and only that one', () => {
  const families = T.view(index, vid(EDGES[0]));
  assert.deepEqual(families.proposals, [{ repo: 'mehrlander/web-tools', path: 'docs/text-tools.md', basis: BASIS }]);
  assert.deepEqual(T.view(index, vid(EDGES[1])).proposals, [], 'a variant nobody has proposed carries an empty list');
  assert.deepEqual(T.lookup(index, 'families').exact[0].proposals, families.proposals, 'lookup reads the same view');
});

function fixtureGh({ token = '', failOnce = false, blobs = { [P.passages]: PASSAGES, [P.variants]: VARIANTS, [P.proposals]: PROPOSALS } } = {}) {
  const calls = [];
  let shouldFail = failOnce;
  return {
    repo: 'mehrlander/home', ref: 'main', calls,
    get headers() { return token ? { Authorization: `Bearer ${token}` } : {}; },
    async get(path, options = {}) {
      calls.push({ path, options });
      if (path === P.passages && shouldFail) { shouldFail = false; const e = new Error('Not Found'); e.status = 404; throw e; }
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
  assert.deepEqual(anon.calls.map(c => c.path).sort(), [P.proposals, P.passages, P.variants].sort());
  assert.equal(a.summary.variants, 4);
  assert.equal(a.summary.proposals, 1);
  const other = fixtureGh({ token: 'other' });
  assert.notEqual(await T.load(other), a, 'a different credential never receives another account\'s index');
  const quiet = fixtureGh();
  await T.load(quiet, { quiet: true });
  assert.ok(quiet.calls.every(c => c.options.quiet === true), 'a quiet read stays quiet on every fetch');
  await T.load(anon, { fresh: true });
  assert.equal(anon.calls.filter(c => c.path === P.passages).length, 2, 'fresh re-reads');
});

test('an unreachable collection reports the status, is held briefly, and recovers', async () => {
  T.clear();
  const gh = fixtureGh({ failOnce: true });
  const old = T.FAIL_MS; T.FAIL_MS = 50;
  try {
    await assert.rejects(T.load(gh), /unavailable \(the read returned 404\)/);
    await assert.rejects(T.load(gh), /unavailable/, 'the rejection is held rather than retried per call');
    await new Promise(r => setTimeout(r, 60));
    assert.equal((await T.load(gh)).summary.variants, 4, 'and recovers once the hold expires');
  } finally { T.FAIL_MS = old; }
});

test('a malformed file names the line rather than the network', async () => {
  const gh = fixtureGh();
  gh.get = async (path, options) => path === P.variants ? { text: '{"from":\n' } : fixtureGh().get(path, options);
  await assert.rejects(T.load(gh, { fresh: true }), /variants\.jsonl line 1 is not JSON/);
  T.clear();
});

test('a proposals.jsonl that 404s is an empty list, not an unavailable collection', async () => {
  T.clear();
  const gh = fixtureGh({ blobs: { [P.passages]: PASSAGES, [P.variants]: VARIANTS } });
  const loaded = await T.load(gh);
  assert.deepEqual(loaded.proposals, []);
  assert.equal(loaded.summary.variants, 4);
  assert.deepEqual(T.view(loaded, loaded.variants[0]).proposals, []);
  T.clear();
});

test('a proposals.jsonl that fails for any other reason still fails the read', async () => {
  T.clear();
  const gh = fixtureGh();
  const base = gh.get.bind(gh);
  gh.get = async (path, options) => {
    if (path === P.proposals) { const e = new Error('Forbidden'); e.status = 403; throw e; }
    return base(path, options);
  };
  await assert.rejects(T.load(gh), /unavailable \(the read returned 403\)/);
  T.clear();
});

test('TRANSITION: without variants.jsonl, legacy rows in proposals.jsonl are split by shape', async () => {
  T.clear();
  const legacy = VARIANTS + PROPOSALS;
  const gh = fixtureGh({ blobs: { [P.passages]: PASSAGES, [P.proposals]: legacy } });
  const loaded = await T.load(gh);
  assert.equal(loaded.summary.variants, 4, 'rows with an author and a purpose are variants');
  assert.equal(loaded.summary.proposals, 1, 'rows with a repo, path and basis are proposals');
  assert.equal(loaded.variants[0].id, vid(EDGES[0]), 'a legacy row keeps the id its address was minted with');
  assert.equal(loaded.sources.variants.path, P.proposals, 'the source names the file actually read');
  assert.deepEqual(T.view(loaded, vid(EDGES[0])).proposals.map(p => p.path), ['docs/text-tools.md']);
  T.clear();
  const neither = fixtureGh({ blobs: { [P.passages]: PASSAGES } });
  await assert.rejects(T.load(neither), /unavailable \(the read returned 404\)/,
    'with neither file the collection is unavailable, not empty');
  T.clear();
});
