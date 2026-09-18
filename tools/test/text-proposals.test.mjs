// The browser proposal projection, held against a complete miniature copy of
// its three durable inputs. The fixture covers proposal identity, duplicate
// transformations with distinct provenance, both lanes, lookup boundaries,
// source validation, and the GH read cache without reaching the network.

import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { gzipSync } from 'node:zlib';
import { loadKit } from './bootstrap.mjs';

const window = {
  crypto: webcrypto,
  TextEncoder,
  DecompressionStream: globalThis.DecompressionStream,
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
      // The shapes make-packet.py actually writes. An invented {kind, value}
      // stood here and passed, because the kit hands evidence through whole
      // and no test rendered it: both surfaces read {type, source, quote} and
      // would have drawn nothing.
      evidence: [{
        type: 'probe',
        source: 'position-probes.md, probe E',
        quote: 'Real catch: the phrase is undefined at this point.',
      }],
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
      relocation: {
        destination: 'docs/spec.md, the notes section',
        status: 'drafted',
        excerpt: 'The notes move whole; the source paragraph is untouched.',
        note: 'Drafting the destination section is a step in applying this.',
      },
      evidence: [
        { type: 'walk', source: 'coverage-walk.md, relocated bucket', quote: 'Destination named.' },
        { type: 'lexical', source: 'lexical-report.md, rung 1', quote: 'p16~p18 cosine 0.29.' },
      ],
    },
  ],
}, null, 2);

const SPEC_TEXT = JSON.stringify(SPEC, null, 2);

const WEB_TOOLS_PATH = 'projects/text/runs/demo/drafts.jsonl.gz';
const WEB_TOOLS_ROWS = [
  {
    id: 'docs/demo.md:p001',
    path: 'docs/demo.md',
    index: 1,
    startLine: 10,
    endLine: 12,
    kind: 'prose',
    original: 'The families of this page need a shorter reading.',
    draft: 'This page needs a shorter reading.',
    words: 9,
    draftWords: 6,
    ratio: 0.5,
    agent: 'Chief of Staff (Grok)',
    signedAt: '2026-09-16',
    priority: 'high',
  },
  {
    id: 'docs/demo.md:p002',
    path: 'docs/demo.md',
    index: 2,
    startLine: 14,
    endLine: 14,
    kind: 'prose',
    original: 'chrome',
    draft: 'decoration',
    words: 1,
    draftWords: 1,
    ratio: 0.5,
    agent: 'Chief of Staff (Grok)',
    signedAt: '2026-09-16',
    priority: 'low',
  },
];
const WEB_TOOLS_JSONL = WEB_TOOLS_ROWS.map(row => JSON.stringify(row)).join('\n') + '\n';
const WEB_TOOLS_GZ = gzipSync(Buffer.from(WEB_TOOLS_JSONL, 'utf8'), { mtime: 0 });

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
    by_lane: { 'phrase-reviews': 2, 'audit-packet': 2, 'web-tools-paragraphs': 0 },
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
    'original_verdict', 'patient', 'document', 'agent', 'signedAt',
    'targetRatio', 'ratio', 'draftWords', 'words',
    'operation', 'original_status',
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
  assert.deepEqual(audit.origins[0].evidence, [{
    type: 'probe',
    source: 'position-probes.md, probe E',
    quote: 'Real catch: the phrase is undefined at this point.',
  }], 'evidence passes through with the three keys the packet writes');

  // Both surfaces read origin.relocation.destination and origin.relocation
  // .status, and origin.evidence[].type/.source/.quote. A fixture that does
  // not carry those keys cannot tell whether either surface draws anything.
  const extract = T.search(index, { lane: 'audit-packet', action: 'extract' })[0];
  assert.equal(extract.origins[0].relocation.destination, 'docs/spec.md, the notes section');
  assert.equal(extract.origins[0].relocation.status, 'drafted');
  assert.match(extract.origins[0].relocation.note, /applying this/,
    'a pending relocation explains itself, and both surfaces show that note');
  assert.deepEqual(extract.origins[0].evidence.map(row => row.type), ['walk', 'lexical']);
  assert.ok(extract.origins[0].evidence.every(row => row.source && row.quote),
    'every evidence row carries the source and the quote the surfaces render');
  assert.equal(extract.origins[0].source.pinned, false,
    'the contents-API address follows the ref, and the surfaces must say so');
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

function fixtureGh({ repo = 'mehrlander/home', token = '', failSpecOnce = false,
                     specText = SPEC_TEXT, blobsExtra = {}, bytesExtra = {} } = {}) {
  const blobs = {
    [SPEC_PATH]: specText,
    [SPEC.phrase_reviews]: PHRASES,
    [SPEC.phrase_context]: PASSAGES,
    [SPEC.audit_packet]: PACKET,
    ...blobsExtra,
  };
  const byteBlobs = { ...bytesExtra };
  const calls = [];
  let shouldFail = failSpecOnce;
  return {
    repo,
    ref: 'main',
    get headers() { return token ? { Authorization: `Bearer ${token}` } : {}; },
    calls,
    async get(path, options = {}) {
      calls.push({ path, method: 'get', options });
      if (path === SPEC_PATH && shouldFail) {
        shouldFail = false;
        throw new Error('fixture spec read failed');
      }
      if (!(path in blobs)) throw new Error(`Unknown fixture path: ${path}`);
      return {
        text: blobs[path],
        sha: SHAS[path] || 'f'.repeat(40),
        size: Buffer.byteLength(blobs[path]),
      };
    },
    async bytes(path, options = {}) {
      calls.push({ path, method: 'bytes', options });
      if (!(path in byteBlobs)) throw new Error(`Unknown fixture bytes path: ${path}`);
      const bytes = byteBlobs[path];
      return {
        bytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
        sha: SHAS[path] || 'e'.repeat(40),
        size: bytes.byteLength || bytes.length,
        url: `https://github.com/${repo}/blob/main/${path}`,
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

test('load shares work, preserves quiet reads, supports fresh reads, and holds rejection briefly', async () => {
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

  // A rejection is HELD for FAIL_MS and then dropped. The FAB re-reads on
  // every scan, so evicting on rejection meant one failing request per
  // selection change against a catalog that is unreachable for the whole
  // session; holding it forever would mean a reload was the only way back.
  T.clear();
  const held = fixtureGh({ repo: 'mehrlander/home-held', failSpecOnce: true });
  const failed = (error) => {
    assert.equal(error.message, 'Prior revisions are unavailable.');
    assert.match(error.cause.message, /fixture spec read failed/);
    return true;
  };
  await assert.rejects(T.load(held), failed);
  await assert.rejects(T.load(held), failed);
  assert.equal(held.calls.length, 1,
    'a repeat scan inside the window reuses the rejection instead of re-reading');

  const previous = T.FAIL_MS;
  try {
    T.FAIL_MS = 0;
    const recovered = await T.load(held);
    assert.equal(recovered.summary.proposals, 4,
      'past the window the read is retried, so access granted later recovers without a reload');
    assert.equal(held.calls.length, 5, 'and the retry reads every durable source');
  } finally {
    T.FAIL_MS = previous;
  }
  T.clear();
});

// A 404 on a private repository is missing access, a missing path, or a source
// that has not landed on the ref being read. The surfaces must not pick one.
test('an unreachable catalog reports the status without naming a cause', async () => {
  T.clear();
  const denied = fixtureGh({ repo: 'mehrlander/home-denied' });
  denied.get = async (path) => {
    denied.calls.push({ path, options: {} });
    const error = new Error('GitHub Error 404: Not Found (Rate Rem: 59)');
    error.status = 404;
    throw error;
  };
  await assert.rejects(T.load(denied), (error) => {
    assert.equal(error.status, 404);
    assert.match(error.message, /Prior revisions are unavailable \(the catalog read returned 404\)\./);
    assert.doesNotMatch(error.message, /access|permission|token|private/i,
      'the message states what happened, not why');
    assert.match(error.cause.message, /Not Found/, 'the original stays reachable for debugging');
    return true;
  });
  assert.equal(denied.calls.length, 1, 'the spec read fails before the three role reads');

  // A read that fails without an HTTP status, which is what an empty 200 body
  // produces one layer down, is the same unavailable state to a reader.
  const broken = fixtureGh({ repo: 'mehrlander/home-broken' });
  broken.get = async (path) => {
    broken.calls.push({ path, options: {} });
    throw new TypeError("Cannot read properties of undefined (reading 'content')");
  };
  await assert.rejects(T.load(broken), (error) => {
    assert.equal(error.message, 'Prior revisions are unavailable.');
    assert.match(error.cause.message, /reading 'content'/);
    return true;
  });
  T.clear();
});

// The kit's own validation still names the problem: those errors are thrown
// after every read has returned, so the unavailable wrapper never reaches them.
test('a malformed catalog still says what is wrong with it', async () => {
  T.clear();
  const wrong = fixtureGh({ repo: 'mehrlander/home-wrong' });
  const good = wrong.get.bind(wrong);
  wrong.get = async (path, options) => path === SPEC_PATH
    ? { ...(await good(path, options)), text: JSON.stringify({ schema: 'nope/v1' }) }
    : good(path, options);
  await assert.rejects(T.load(wrong), /Unsupported text source schema: nope\/v1/);
  T.clear();
});

test('web-tools paragraph lane rebuilds from gzip drafts_inventory with document provenance', async () => {
  const spec = {
    ...SPEC,
    web_tools_paragraphs: {
      inventory: 'projects/text/runs/demo/inventory.jsonl.gz',
      drafts_inventory: WEB_TOOLS_PATH,
      run_id: 'demo',
      scanned_repo: 'mehrlander/web-tools',
      scan_method: 'blank-line paragraph scan',
      agent: 'Chief of Staff (Grok)',
      signedAt: '2026-09-16',
      targetRatio: 0.5,
      purpose: 'Half-length rewrite (targetRatio 0.5); retention is not endorsement',
      drafts: 2,
    },
  };
  const index = await T.build({
    ...args({ spec }),
    files: {
      ...args().files,
      web_tools_paragraphs: WEB_TOOLS_JSONL,
    },
    metadata: {
      phrase_reviews: { sha: SHAS[SPEC.phrase_reviews] },
      phrase_context: { sha: SHAS[SPEC.phrase_context] },
      audit_packet: { sha: SHAS[SPEC.audit_packet] },
      web_tools_paragraphs: { sha: 'e'.repeat(40), size: WEB_TOOLS_GZ.length },
      spec: { sha: SHAS[SPEC_PATH] },
    },
  });
  assert.equal(index.summary.by_lane['web-tools-paragraphs'], 2);
  assert.equal(index.summary.by_action['half-length'], 2);
  const row = T.search(index, { lane: 'web-tools-paragraphs', q: 'shorter reading' })[0];
  assert.equal(row.action, 'half-length');
  assert.equal(row.author, 'Chief of Staff (Grok)');
  assert.match(row.purpose, /retention is not endorsement/);
  assert.equal(row.origins[0].document.path, 'docs/demo.md');
  assert.equal(row.origins[0].document.paragraph, 1);
  assert.equal(row.origins[0].document.import_id, 'docs/demo.md:p001');
  assert.equal(row.origins[0].targetRatio, 0.5);
  assert.match(row.origins[0].document.url, /docs\/demo\.md#L10-L12$/);
  assert.equal(row.origins[0].document.label.includes('p1'), true);

  // Duplicate original string from phrase lane + web-tools shares exact lookup.
  const hit = T.lookup(index, 'chrome', { contained: false });
  assert.ok(hit.exact.some(r => r.lane === 'web-tools-paragraphs'));
  assert.ok(hit.exact.some(r => r.lane === 'phrase-reviews'));
});

test('load fetches gzip drafts_inventory through gh.bytes when the lane is declared', async () => {
  T.clear();
  const spec = {
    ...SPEC,
    web_tools_paragraphs: {
      drafts_inventory: WEB_TOOLS_PATH,
      inventory: 'projects/text/runs/demo/inventory.jsonl.gz',
      scanned_repo: 'mehrlander/web-tools',
      scan_method: 'blank-line paragraph scan',
      agent: 'Chief of Staff (Grok)',
      signedAt: '2026-09-16',
      targetRatio: 0.5,
      purpose: 'Half-length rewrite (targetRatio 0.5); retention is not endorsement',
      drafts: 2,
    },
  };
  SHAS[WEB_TOOLS_PATH] = 'e'.repeat(40);
  const gh = fixtureGh({
    specText: JSON.stringify(spec),
    bytesExtra: { [WEB_TOOLS_PATH]: WEB_TOOLS_GZ },
  });
  const index = await T.load(gh);
  assert.equal(index.summary.by_lane['web-tools-paragraphs'], 2);
  assert.equal(gh.calls.filter(c => c.method === 'get').length, 4);
  assert.equal(gh.calls.filter(c => c.method === 'bytes').length, 1);
  assert.equal(gh.calls.find(c => c.method === 'bytes').path, WEB_TOOLS_PATH);
  T.clear();
});

