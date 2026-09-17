// The browser proposal projection, held against a complete miniature copy of
// its three durable inputs. The fixture covers proposal identity, duplicate
// transformations with distinct provenance, both lanes, lookup boundaries,
// source validation, and the GH read cache without reaching the network.

import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { loadKit } from './bootstrap.mjs';

const window = {
  crypto: webcrypto,
  TextEncoder,
  GH: { FRESH: { cache: 'no-store' } },
};
loadKit('csv.js', { window });
loadKit('text-proposals.js', { window });
const T = window.TextProposals;

const SPEC_PATH = 'projects/text/current-sources.json';
const SPEC = {
  schema: 'text-current-sources/v1',
  phrase_reviews: 'runs/phrase-reviews.csv',
  phrase_context: 'runs/passages.md',
  audit_packet: 'runs/packet.json',
};

const PHRASES = [
  'para,phrase,ordinary_reading,closed_in_situ,cheapest_fix,fix_words,verdict',
  'A1,families,people related by birth or marriage,no,bill-section families,2,qualify',
  'A1,tracker task,ordinary tracker label,yes,,0,leave',
  'B1,chrome,visual decoration,no,decoration,1,rephrase',
  'B2,families,people related by birth or marriage,no,bill-section families,2,qualify',
].join('\n');

const PASSAGES = [
  '# Phrase review contexts',
  '',
  '### A1 (2026-09-13 abcdef12)',
  'The families and tracker task appear here.',
  '',
  '### B1 (2026-09-14 beaded01)',
  'A chrome concern appears here.',
  '',
  '### B2 (2026-09-15 c0ffee22)',
  'A second source occurrence of families appears here.',
].join('\n');

const PACKET = JSON.stringify({
  schema: 'review-packet/v1',
  patient: {
    repo: 'mehrlander/web-tools',
    path: 'README.md',
    commit: 'abc123',
  },
  regions: [
    {
      id: 'unchanged-1',
      kind: 'unchanged',
      original_text: 'Retained wording',
    },
    {
      id: 'repair-1',
      kind: 'edit',
      original_text: 'old wording',
      proposed_text: 'new wording',
      original_text_status: 'verified',
      original_text_note: 'README line 10',
      decision: 'repair',
      rationale: 'The replacement states the claim directly.',
      relocation: null,
      evidence: [{ kind: 'source', value: 'README.md' }],
    },
    {
      id: 'extract-1',
      kind: 'edit',
      original_text: 'embedded notes',
      proposed_text: 'linked notes',
      original_text_status: 'verified',
      original_text_note: null,
      decision: 'extract',
      rationale: 'The detail belongs with its specification.',
      relocation: { path: 'docs/spec.md' },
      evidence: [],
    },
  ],
}, null, 2);

const SPEC_TEXT = JSON.stringify(SPEC, null, 2);
const SHAS = {
  [SPEC_PATH]: '0'.repeat(40),
  [SPEC.phrase_reviews]: '1'.repeat(40),
  [SPEC.phrase_context]: '2'.repeat(40),
  [SPEC.audit_packet]: '3'.repeat(40),
};

function args({ phraseReviews = PHRASES, phraseContext = PASSAGES,
                auditPacket = PACKET, spec = SPEC } = {}) {
  return {
    spec,
    files: {
      phrase_reviews: phraseReviews,
      phrase_context: phraseContext,
      audit_packet: auditPacket,
    },
    metadata: {
      spec: { sha: SHAS[SPEC_PATH], size: Buffer.byteLength(JSON.stringify(spec, null, 2)) },
      phrase_reviews: { sha: SHAS[SPEC.phrase_reviews], size: Buffer.byteLength(phraseReviews) },
      phrase_context: { sha: SHAS[SPEC.phrase_context], size: Buffer.byteLength(phraseContext) },
      audit_packet: { sha: SHAS[SPEC.audit_packet], size: Buffer.byteLength(auditPacket) },
    },
    repo: 'mehrlander/home',
    ref: 'main',
    specPath: SPEC_PATH,
  };
}

const index = await T.build(args());

test('build preserves the Python proposal identity and collapses duplicate transformations', () => {
  assert.equal(index.schema, 'text-browser-proposals/v1');
  assert.deepEqual(index.summary, {
    proposals: 4,
    origins: 5,
    contexts: 3,
    by_lane: { 'phrase-reviews': 2, 'audit-packet': 2 },
    by_action: { qualify: 1, rephrase: 1, repair: 1, extract: 1 },
  });

  const first = index.proposals[0];
  assert.equal(first.id,
    'df7f922eee5b3c672d19f6c88b461fa703eb7334c96afe2fa7dff0fe645fb639');
  assert.equal(first.from,
    'e1c0624695f43eba3d97cbe2d973b61b456a262d4d4768b5607335f7f647facf');
  assert.equal(first.to,
    'cbb7cf09d1b8aa2e81df08127b723013f3bb7f62f2c0e11d26344ef93a20b0fc');
  assert.equal(T.view(index, first).origins.length, 2,
    'one proposal keeps both source occurrences');
});

test('view exposes one stable shape for phrase and audit provenance', () => {
  const phrase = T.view(index, index.proposals[0]);
  assert.deepEqual(Object.keys(phrase), [
    'id', 'lane', 'action', 'verdict', 'decision', 'operation',
    'from', 'to', 'author', 'purpose', 'analysis', 'origins',
  ]);
  assert.equal(phrase.lane, 'phrase-reviews');
  assert.equal(phrase.action, 'qualify');
  assert.equal(phrase.verdict, 'qualify');
  assert.equal(phrase.decision, null);
  assert.equal(phrase.from.text, 'families');
  assert.equal(phrase.to.text, 'bill-section families');
  assert.deepEqual(phrase.analysis, {
    ordinary_reading: 'people related by birth or marriage',
    closed_in_situ: 'no',
    fix_words: 2,
  });
  assert.deepEqual(phrase.origins.map(origin => origin.record), [1, 4]);
  assert.deepEqual(Object.keys(phrase.origins[0]), [
    'proposal_id', 'lane', 'scope', 'record', 'source', 'context',
    'original_verdict', 'patient', 'operation', 'original_status',
    'original_note', 'decision', 'rationale', 'relocation', 'evidence',
  ]);
  assert.equal(phrase.origins[0].source.path, SPEC.phrase_reviews);
  assert.equal(phrase.origins[0].context.source.path, SPEC.phrase_context);
  assert.equal(phrase.origins[0].context.section, 'A1');
  assert.equal(phrase.origins[0].context.date, '2026-09-13');
  assert.equal(phrase.origins[0].context.markdown,
    'The families and tracker task appear here.');

  const audit = T.search(index, { lane: 'audit-packet', action: 'repair' })[0];
  assert.equal(audit.verdict, null);
  assert.equal(audit.decision, 'repair');
  assert.equal(audit.operation, 'repair');
  assert.equal(audit.origins[0].source.path, SPEC.audit_packet);
  assert.equal(audit.origins[0].patient.url,
    'https://github.com/mehrlander/web-tools/blob/abc123/README.md');
  assert.equal(audit.origins[0].original_status, 'verified');
  assert.equal(audit.origins[0].original_note, 'README line 10');
  assert.deepEqual(audit.origins[0].evidence,
    [{ kind: 'source', value: 'README.md' }]);
});

test('lookup keeps exact and contained results distinct and honors Python edge trimming', () => {
  const exact = T.lookup(index, ' \u0085\u001cfamilies\u001f ', { contained: true });
  assert.equal(exact.selection.text, 'families');
  assert.equal(exact.exact.length, 1);
  assert.equal(exact.contained.length, 0,
    'an exact proposal is never repeated under contained');
  assert.deepEqual(exact.warnings, [T.SCOPE_WARNING]);

  const bom = T.lookup(index, '\ufefffamilies\ufeff');
  assert.equal(bom.exact.length, 0,
    'U+FEFF is not stripped by Python str.strip and must not alias an ID');

  const larger = T.lookup(index,
    'The families appear beside chrome, then families appear again.',
    { contained: true });
  assert.equal(larger.exact.length, 0);
  assert.deepEqual(larger.contained.map(row => row.from.text), ['families', 'chrome']);
  assert.deepEqual(larger.contained[0].spans, [[4, 12], [40, 48]]);
  assert.deepEqual(larger.contained[1].spans, [[27, 33]]);

  assert.equal(T.lookup(index, 'FAMILIES', { contained: true }).contained.length, 0,
    'matching is deliberately case-sensitive');
  assert.equal(T.lookup(index, 'microchrome', { contained: true }).contained.length, 0,
    'a source phrase inside a larger token is not a contained match');
});

test('search filters the normalized lane and action and includes provenance', () => {
  assert.deepEqual(T.search(index, { q: 'second source occurrence' })
    .map(row => row.from.text), ['families']);
  assert.deepEqual(T.search(index, { q: 'docs/spec.md' })
    .map(row => row.action), ['extract']);
  assert.deepEqual(T.search(index, { lane: 'audit-packet', action: 'repair' })
    .map(row => row.from.text), ['old wording']);
  assert.equal(T.search(index, { lane: 'phrase-reviews' }).length, 2);
  assert.equal(T.search(index, { q: 'not in the fixture' }).length, 0);
});

test('build rejects a claimed edit without a fix and a review without context', async () => {
  const inconsistent = PHRASES.replace(
    'bill-section families,2,qualify', ',2,qualify');
  await assert.rejects(T.build(args({ phraseReviews: inconsistent })),
    /Phrase verdict and fix disagree/);

  const missing = PASSAGES.replace('### B2', '### C2');
  await assert.rejects(T.build(args({ phraseContext: missing })),
    /Phrase review context does not exist: B2/);
});

function fixtureGh({ repo = 'mehrlander/home', token = '', failSpecOnce = false } = {}) {
  const blobs = {
    [SPEC_PATH]: SPEC_TEXT,
    [SPEC.phrase_reviews]: PHRASES,
    [SPEC.phrase_context]: PASSAGES,
    [SPEC.audit_packet]: PACKET,
  };
  const calls = [];
  let shouldFail = failSpecOnce;
  return {
    repo,
    ref: 'main',
    get headers() { return token ? { Authorization: `Bearer ${token}` } : {}; },
    calls,
    async get(path, options = {}) {
      calls.push({ path, options });
      if (path === SPEC_PATH && shouldFail) {
        shouldFail = false;
        throw new Error('fixture spec read failed');
      }
      if (!(path in blobs)) throw new Error(`Unknown fixture path: ${path}`);
      return {
        text: blobs[path],
        sha: SHAS[path],
        size: Buffer.byteLength(blobs[path]),
      };
    },
  };
}

test('load cache never crosses authenticated clients', async () => {
  T.clear();
  const left = fixtureGh({ token: 'account-a' });
  const right = fixtureGh({ token: 'account-b' });
  await T.load(left);
  await T.load(right);
  assert.equal(left.calls.length, 4);
  assert.equal(right.calls.length, 4,
    'the second account reads its own private sources instead of receiving the first index');
  T.clear();
});

test('load shares work, preserves quiet reads, supports fresh reads, and evicts rejection', async () => {
  T.clear();
  const gh = fixtureGh();
  const [left, right] = await Promise.all([T.load(gh), T.load(gh)]);
  assert.equal(left, right, 'both callers receive the same built index');
  assert.equal(gh.calls.length, 4, 'the shared load reads each durable source once');

  const fresh = await T.load(gh, { fresh: true });
  assert.equal(fresh.summary.proposals, 4);
  assert.equal(gh.calls.length, 8);
  assert.ok(gh.calls.slice(4).every(call => call.options.cache === 'no-store'),
    'every source in a fresh load uses the GH fresh-read policy');

  T.clear();
  const quiet = fixtureGh({ repo: 'mehrlander/home-quiet' });
  await T.load(quiet, { quiet: true });
  assert.equal(quiet.calls.length, 4);
  assert.ok(quiet.calls.every(call => call.options.quiet === true),
    'every optional FAB read suppresses gh-auth page takeover');

  T.clear();
  const retrying = fixtureGh({ repo: 'mehrlander/home-retry', failSpecOnce: true });
  await assert.rejects(T.load(retrying), /fixture spec read failed/);
  const recovered = await T.load(retrying);
  assert.equal(recovered.summary.proposals, 4);
  assert.equal(retrying.calls.length, 5,
    'the failed spec read plus a complete retry proves rejection was evicted');
  T.clear();
});
