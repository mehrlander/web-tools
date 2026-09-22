// lib/kits/text-history.js — occurrence-scoped passage history and the joins
// back to retained proposals.
//
// The fixture is intentionally adversarial. The current string occurs twice
// in one document and once in an unrelated document, all under one text_id.
// Only one occurrence has explicit predecessor connections. A second revision
// removes and adds nearby text without such a connection. Those facts hold the
// line between shared text identity, an observed document edit, and an
// inferred historical relationship.

import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { loadKit } from './bootstrap.mjs';

const window = { crypto: webcrypto, TextEncoder };
loadKit('text-proposals.js', { window });
loadKit('text-history.js', { window });
const H = window.TextHistory;

const CURRENT = 'The **current guide** sends readers to [Text Lab](https://example.test/lab) and uses `text_id` for shared identity.';
const EARLIER_DIRECT = 'The **guide** sends readers to [Text Lab](https://example.test/lab) and treats `text_id` as passage history.';
const EARLIER_SHORT = 'Use [Text Lab](https://example.test/lab) to inspect passage history.';
const PROPOSED_OLD = 'The guide links to Text Lab and distinguishes shared text from occurrence history.';
const PROPOSED_DEAD = 'Open Text Lab for every historical edit.';
const PROPOSED_FRESH = 'The **current guide** links to [Text Lab](https://example.test/lab) and distinguishes shared text identity from the history of each occurrence.';
const GUIDE_DOC = `# Guide\n\n${CURRENT}\n\nAn unchanged block.\n\n${CURRENT}\n`;
const UNRELATED_DOC = `# Other\n\n${CURRENT}\n`;
const SOURCE_COMMIT = '8'.repeat(40);
const PRE_COMMIT = 'a'.repeat(40);
const REVISION_COMMIT = 'b'.repeat(40);
const CURRENT_COMMIT = 'c'.repeat(40);
const GUIDE_BLOB = await H.gitBlobId(GUIDE_DOC);
const UNRELATED_BLOB = await H.gitBlobId(UNRELATED_DOC);

async function sha256(text) {
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
}

const textId = sha256;
function pythonJson(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return '[' + value.map(pythonJson).join(', ') + ']';
  if (typeof value === 'object') {
    return '{' + Object.keys(value).sort()
      .map(key => `${JSON.stringify(key)}: ${pythonJson(value[key])}`).join(', ') + '}';
  }
  return JSON.stringify(value);
}

const IDS = {
  current: await textId(CURRENT),
  earlierDirect: await textId(EARLIER_DIRECT),
  earlierShort: await textId(EARLIER_SHORT),
  nearby: await textId('A removed paragraph near the current one.'),
  proposedOld: await textId(PROPOSED_OLD),
  proposedDead: await textId(PROPOSED_DEAD),
  proposedFresh: await textId(PROPOSED_FRESH),
};
const FRESH_AUTHOR = 'passage-history reconsideration';
const FRESH_PURPOSE = 'Carry forward the still-useful occurrence distinction.';
const FRESH_PROPOSAL_ID = await sha256(pythonJson({
  from: IDS.current,
  to: IDS.proposedFresh,
  author: FRESH_AUTHOR,
  purpose: FRESH_PURPOSE,
}));

const HISTORY = {
  schema: 'text-passage-history/v1',
  scope: { repo: 'mehrlander/web-tools', current_commit: CURRENT_COMMIT },
  occurrences: [
    {
      id: 'current-first', text_id: IDS.current, text: CURRENT, state: 'current',
      document: { repo: 'mehrlander/web-tools', path: 'docs/guide.md', commit: CURRENT_COMMIT, blob: GUIDE_BLOB },
      location: { start_line: 4, end_line: 4, start_byte: 20, end_byte: 145, same_text_ordinal: 1 },
    },
    {
      id: 'current-connected', text_id: IDS.current, text: CURRENT, state: 'current',
      document: { repo: 'mehrlander/web-tools', path: 'docs/guide.md', commit: CURRENT_COMMIT, blob: GUIDE_BLOB },
      location: { start_line: 12, end_line: 12, start_byte: 220, end_byte: 345, same_text_ordinal: 2 },
    },
    {
      id: 'current-unrelated', text_id: IDS.current, text: CURRENT, state: 'current',
      document: { repo: 'mehrlander/web-tools', path: 'docs/unrelated.md', commit: CURRENT_COMMIT, blob: UNRELATED_BLOB },
      location: { start_line: 3, end_line: 3, start_byte: 10, end_byte: 135, same_text_ordinal: 1 },
    },
    {
      id: 'earlier-direct', text_id: IDS.earlierDirect, text: EARLIER_DIRECT, state: 'predecessor',
      document: { repo: 'mehrlander/web-tools', path: 'docs/guide.md', commit: PRE_COMMIT, blob: '3'.repeat(40) },
      location: { start_line: 9, end_line: 9, start_byte: 170, end_byte: 295, same_text_ordinal: 0 },
    },
    {
      id: 'earlier-short', text_id: IDS.earlierShort, text: EARLIER_SHORT, state: 'predecessor',
      document: { repo: 'mehrlander/web-tools', path: 'docs/guide.md', commit: PRE_COMMIT, blob: '3'.repeat(40) },
      location: { start_line: 9, end_line: 9, start_byte: 170, end_byte: 240, same_text_ordinal: 0 },
    },
    {
      id: 'nearby-removal', text_id: IDS.nearby, text: 'A removed paragraph near the current one.', state: 'predecessor',
      document: { repo: 'mehrlander/web-tools', path: 'docs/unrelated.md', commit: PRE_COMMIT, blob: '5'.repeat(40) },
      location: { start_line: 2, end_line: 2, start_byte: 0, end_byte: 42, same_text_ordinal: 0 },
    },
    {
      id: 'proposal-source-direct', text_id: IDS.earlierDirect, text: EARLIER_DIRECT, state: 'predecessor',
      document: { repo: 'mehrlander/web-tools', path: 'docs/guide.md', commit: SOURCE_COMMIT, blob: '7'.repeat(40) },
      location: { start_line: 8, end_line: 8, start_byte: 150, end_byte: 275, same_text_ordinal: 0 },
      source: { record: 'docs/guide.md:p004' },
    },
    {
      id: 'proposal-source-short', text_id: IDS.earlierShort, text: EARLIER_SHORT, state: 'predecessor',
      document: { repo: 'mehrlander/web-tools', path: 'docs/guide.md', commit: SOURCE_COMMIT, blob: '7'.repeat(40) },
      location: { start_line: 7, end_line: 7, start_byte: 80, end_byte: 149, same_text_ordinal: 0 },
      source: { record: 'docs/guide.md:p003' },
    },
    {
      id: 'result-connected', text_id: IDS.current, text: CURRENT, state: 'revision-result',
      document: { repo: 'mehrlander/web-tools', path: 'docs/guide.md', commit: REVISION_COMMIT, blob: GUIDE_BLOB },
      location: { start_line: 12, end_line: 12, start_byte: 220, end_byte: 345, same_text_ordinal: 2 },
    },
    {
      id: 'result-unrelated', text_id: IDS.current, text: CURRENT, state: 'revision-result',
      document: { repo: 'mehrlander/web-tools', path: 'docs/unrelated.md', commit: REVISION_COMMIT, blob: UNRELATED_BLOB },
      location: { start_line: 3, end_line: 3, start_byte: 10, end_byte: 135, same_text_ordinal: 1 },
    },
  ],
  revisions: [
    {
      id: 'revision-guide', kind: 'actual-revision', repo: 'mehrlander/web-tools', path: 'docs/guide.md',
      commit: REVISION_COMMIT, parent: PRE_COMMIT, before_blob: '3'.repeat(40), after_blob: GUIDE_BLOB,
      removed_occurrence_ids: ['earlier-direct', 'earlier-short'], added_occurrence_ids: ['result-connected'],
      evidence: [{ type: 'git-diff', source: 'git show cccccccc -- docs/guide.md', quote: 'two possible earlier blocks changed around this passage' }],
    },
    {
      id: 'revision-nearby-only', kind: 'actual-revision', repo: 'mehrlander/web-tools', path: 'docs/unrelated.md',
      commit: REVISION_COMMIT, parent: PRE_COMMIT, before_blob: '5'.repeat(40), after_blob: UNRELATED_BLOB,
      removed_occurrence_ids: ['nearby-removal'], added_occurrence_ids: ['result-unrelated'],
      evidence: [{ type: 'git-diff', source: 'git show dddddddd -- docs/unrelated.md', quote: 'a deletion happens near an addition' }],
    },
  ],
};

const RECONSIDERATIONS = {
  schema: 'text-passage-reconsiderations/v1',
  predecessor_connections: [
    {
      id: 'connection-direct', kind: 'inferred-predecessor',
      from_occurrence_ids: ['earlier-direct'], to_occurrence_ids: ['result-connected'],
      revision_id: 'revision-guide', confidence: 'strong',
      basis: [{ type: 'exact-diff-hunk', source: 'revision-guide', quote: 'the sentence is edited in place' }],
      limits: 'The shared link and position support continuity; they do not prove authorial intent.',
    },
    {
      id: 'connection-alternative', kind: 'inferred-predecessor',
      from_occurrence_ids: ['earlier-short'], to_occurrence_ids: ['result-connected'],
      revision_id: 'revision-guide', confidence: 'possible',
      basis: [{ type: 'same-section', source: 'revision-guide', quote: 'the shorter block occupied the same section in an earlier commit' }],
      limits: 'This is an alternative branch, not a second certain parent.',
    },
  ],
  proposal_source_connections: [
    {
      id: 'proposal-source-connection-direct', kind: 'inferred-proposal-source-continuation',
      predecessor_connection_id: 'connection-direct',
      from_occurrence_ids: ['proposal-source-direct'], to_occurrence_ids: ['earlier-direct'],
      cardinality: 'one-to-one', confidence: 'strong',
      basis: [{ type: 'exact-text', source: 'git history', observation: 'The proposal source text persists to the revision parent.' }],
      limits: 'This is an occurrence inference, not shared text identity.',
    },
    {
      id: 'proposal-source-connection-short', kind: 'inferred-proposal-source-continuation',
      predecessor_connection_id: 'connection-alternative',
      from_occurrence_ids: ['proposal-source-short'], to_occurrence_ids: ['earlier-short'],
      cardinality: 'one-to-one', confidence: 'possible',
      basis: [{ type: 'exact-text', source: 'git history', observation: 'The shorter source text persists to the revision parent.' }],
      limits: 'This remains an alternative predecessor branch.',
    },
  ],
  occurrence_continuations: [{
    id: 'continuation-guide', kind: 'inferred-occurrence-continuation',
    from_occurrence_ids: ['result-connected'], to_occurrence_ids: ['current-connected'],
    cardinality: 'one-to-one', confidence: 'strong',
    basis: [{ type: 'exact-text', source: 'git history', observation: 'The result persists byte-for-byte.' }],
    limits: 'This continuation applies only to the pinned occurrence.',
  }],
  reconsiderations: [
    {
      id: 'review-nothing', predecessor_connection_id: 'connection-alternative',
      proposal_source_connection_id: 'proposal-source-connection-short',
      occurrence_continuation_ids: ['continuation-guide'],
      historical_proposal: { id: 'proposal-dead', source_occurrence_id: 'proposal-source-short' }, historical_occurrence_id: 'earlier-short', current_occurrence_id: 'current-connected',
      attempted_improvement: 'Make the route to history shorter.', already_achieved: 'The current passage already names Text Lab.',
      remains_useful: 'Nothing useful remains.', no_longer_applies: 'The proposal would now overstate what Text Lab contains.',
      outcome: 'nothing-useful-remains', author: 'passage-history reconsideration', date: '2026-09-18',
    },
    {
      id: 'review-fresh', predecessor_connection_id: 'connection-direct',
      proposal_source_connection_id: 'proposal-source-connection-direct',
      occurrence_continuation_ids: ['continuation-guide'],
      historical_proposal: { id: 'proposal-old', source_occurrence_id: 'proposal-source-direct' }, historical_occurrence_id: 'earlier-direct', current_occurrence_id: 'current-connected',
      attempted_improvement: 'Separate shared text identity from occurrence history.', already_achieved: 'The new wording says identity is shared.',
      remains_useful: 'It can still say that history belongs to each occurrence.', no_longer_applies: 'The earlier proposal referred to the old guide wording.',
      outcome: 'fresh-proposal', fresh_proposal_id: FRESH_PROPOSAL_ID,
      author: 'passage-history reconsideration', date: '2026-09-18',
    },
  ],
  fresh_proposals: [
    {
      id: FRESH_PROPOSAL_ID, from: IDS.current, to: IDS.proposedFresh,
      original: CURRENT, replacement: PROPOSED_FRESH,
      author: FRESH_AUTHOR, purpose: FRESH_PURPOSE,
      action: 'clarify', lane: 'historical-reconsideration', current_occurrence_id: 'current-connected',
      historical_inputs: {
        reconsideration_id: 'review-fresh', historical_proposal_id: 'proposal-old',
        predecessor_connection_id: 'connection-direct',
        proposal_source_connection_id: 'proposal-source-connection-direct',
        occurrence_continuation_ids: ['continuation-guide'],
      },
    },
  ],
};

function proposalIndex() {
  return {
    schema: 'text-browser-proposals/v1',
    proposals: [
      { id: 'proposal-old', from: IDS.earlierDirect, to: IDS.proposedOld, author: 'earlier reviewer', purpose: 'Distinguish identity from occurrence history.' },
      { id: 'proposal-dead', from: IDS.earlierShort, to: IDS.proposedDead, author: 'earlier reviewer', purpose: 'Shorten the route to history.' },
    ],
    texts: {
      [IDS.current]: CURRENT,
      [IDS.earlierDirect]: EARLIER_DIRECT,
      [IDS.earlierShort]: EARLIER_SHORT,
      [IDS.proposedOld]: PROPOSED_OLD,
      [IDS.proposedDead]: PROPOSED_DEAD,
    },
    sources: {}, contexts: {},
    _lane_by_proposal: { 'proposal-old': 'audit-packet', 'proposal-dead': 'audit-packet' },
    _origins_by_proposal: {
      'proposal-old': [{
        proposal_id: 'proposal-old', record: 'docs/guide.md:p004', agent: 'earlier reviewer',
        rationale: 'The old wording conflated two identities.',
        document: { repo: 'mehrlander/web-tools', path: 'docs/guide.md', commit: SOURCE_COMMIT, start_line: 8, end_line: 8 },
      }],
      'proposal-dead': [{
        proposal_id: 'proposal-dead', record: 'docs/guide.md:p003', agent: 'earlier reviewer',
        rationale: 'The old route was long.',
        document: { repo: 'mehrlander/web-tools', path: 'docs/guide.md', commit: SOURCE_COMMIT, start_line: 7, end_line: 7 },
      }],
    },
    _analysis_by_proposal: {},
  };
}

const build = (overrides = {}) => H.build({
  history: HISTORY,
  reconsiderations: RECONSIDERATIONS,
  proposalIndex: proposalIndex(),
  repo: 'mehrlander/home',
  ref: 'main',
  sources: {
    history: { path: 'projects/text/passage-history/example.json', sha: '6'.repeat(40) },
    reconsiderations: { path: 'projects/text/passage-history/reconsiderations.json', sha: '7'.repeat(40) },
  },
  ...overrides,
});

function only(result) {
  assert.equal(result.matches.length, 1);
  return result.matches[0];
}

test('build preserves observed revisions and inferred predecessor connections as different records', async () => {
  const index = await build();
  assert.equal(index.schema, 'text-browser-history/v1');
  assert.deepEqual(index.revisions.map(row => row.kind), ['actual-revision', 'actual-revision']);
  assert.deepEqual(index.predecessor_connections.map(row => row.kind), ['inferred-predecessor', 'inferred-predecessor']);
  assert.deepEqual(index.proposal_source_connections.map(row => row.kind),
    ['inferred-proposal-source-continuation', 'inferred-proposal-source-continuation']);
  assert.deepEqual(index.occurrence_continuations.map(row => row.kind), ['inferred-occurrence-continuation']);
  assert.equal(index.revisions.some(row => row.kind === 'inferred-predecessor'), false);
  assert.equal(index.predecessor_connections.some(row => row.kind === 'actual-revision'), false);
});

test('lookup scopes shared text to a path and a particular repeated occurrence', async () => {
  const index = await build();

  const unresolved = H.lookup(index, CURRENT, {
    repo: 'mehrlander/web-tools', path: 'docs/guide.md', blob: GUIDE_BLOB, ref: 'moving-main',
  });
  assert.equal(unresolved.ambiguous, false);
  assert.deepEqual(unresolved.matches.map(row => row.occurrence.id), ['current-connected']);

  const first = H.lookup(index, CURRENT, {
    repo: 'mehrlander/web-tools', path: 'docs/guide.md', blob: GUIDE_BLOB, sameTextOrdinal: 1,
  });
  assert.deepEqual(first.matches, [],
    'the same words elsewhere in the file do not inherit another occurrence\'s connection');

  const connected = only(H.lookup(index, CURRENT, {
    repo: 'mehrlander/web-tools', path: 'docs/guide.md', blob: GUIDE_BLOB, sameTextOrdinal: 2,
  }));
  assert.equal(connected.occurrence.id, 'current-connected');
  assert.deepEqual(connected.connections.map(row => row.id), ['connection-direct', 'connection-alternative']);
  assert.deepEqual(connected.connections.flatMap(row => row.occurrence_continuations.map(value => value.id)),
    ['continuation-guide', 'continuation-guide'],
    'the current passage reaches predecessor connections only through the explicit continuation');
  assert.equal(H.lookup(index, CURRENT.replace(' sends ', '\nsends '), {
    repo: 'mehrlander/web-tools', path: 'docs/guide.md', blob: GUIDE_BLOB, sameTextOrdinal: 2,
  }).matches.length, 0, 'internal whitespace is part of history Text identity');

  const unrelated = H.lookup(index, CURRENT, {
    repo: 'mehrlander/web-tools', path: 'docs/unrelated.md', blob: UNRELATED_BLOB, sameTextOrdinal: 1,
  });
  assert.deepEqual(unrelated.matches, [],
    'shared text identity and a nearby removal/addition do not manufacture continuity');
  assert.equal(H.lookup(index, CURRENT, {
    repo: 'mehrlander/home', path: 'docs/guide.md', blob: GUIDE_BLOB,
  }).matches.length, 0);

  assert.equal(H.lookup(index, CURRENT, {
    repo: 'mehrlander/web-tools', path: 'docs/guide.md', blob: GUIDE_BLOB,
    ref: 'a-moving-branch-name', sameTextOrdinal: 2,
  }).matches.length, 1, 'a moving ref name is not occurrence identity when exact file bytes still match');
  assert.equal(H.lookup(index, CURRENT, {
    repo: 'mehrlander/web-tools', path: 'docs/guide.md', blob: 'f'.repeat(40),
    ref: CURRENT_COMMIT, sameTextOrdinal: 2,
  }).matches.length, 0, 'a matching ref and passage cannot override the wrong full-file blob');
  assert.throws(() => H.lookup(index, CURRENT, {
    repo: 'mehrlander/web-tools', path: 'docs/guide.md', sameTextOrdinal: 2,
  }), /full-file Git blob/);
});

test('alternative predecessor branches retain their evidence, revision, and attached proposals', async () => {
  const index = await build();
  const match = only(H.lookup(index, CURRENT, {
    repo: 'mehrlander/web-tools', path: 'docs/guide.md', blob: GUIDE_BLOB, sameTextOrdinal: 2,
  }));

  assert.equal(match.connections.length, 2, 'alternatives remain alternatives instead of being collapsed');
  const direct = match.connections.find(row => row.id === 'connection-direct');
  const alternative = match.connections.find(row => row.id === 'connection-alternative');
  assert.equal(direct.confidence, 'strong');
  assert.equal(alternative.confidence, 'possible');
  assert.equal(direct.revision.kind, 'actual-revision');
  assert.equal(direct.predecessors[0].id, 'earlier-direct');
  assert.equal(alternative.predecessors[0].id, 'earlier-short');
  assert.deepEqual(direct.proposals.map(row => row.id), ['proposal-old']);
  assert.deepEqual(alternative.proposals.map(row => row.id), ['proposal-dead']);
  assert.match(alternative.limits, /alternative branch/i);
  assert.deepEqual(direct.basis, RECONSIDERATIONS.predecessor_connections[0].basis);
});

test('reconsideration keeps a no-op judgment and joins a fresh proposal without changing retained inputs', async () => {
  const proposals = proposalIndex();
  const before = structuredClone(proposals);
  const index = await build({ proposalIndex: proposals });
  const match = only(H.lookup(index, CURRENT, {
    repo: 'mehrlander/web-tools', path: 'docs/guide.md', blob: GUIDE_BLOB, sameTextOrdinal: 2,
  }));
  const reviews = match.connections.flatMap(row => row.reconsiderations || []);
  const nothing = reviews.find(row => row.id === 'review-nothing');
  const fresh = reviews.find(row => row.id === 'review-fresh');

  assert.equal(nothing.outcome, 'nothing-useful-remains');
  assert.deepEqual(nothing.fresh_proposals, [],
    'a judgment that nothing remains does not invent a replacement edge');
  assert.equal(fresh.outcome, 'fresh-proposal');
  assert.equal(fresh.fresh_proposals[0].id, FRESH_PROPOSAL_ID);
  assert.equal(fresh.fresh_proposals[0].from.text, CURRENT);
  assert.equal(fresh.fresh_proposals[0].to.text, PROPOSED_FRESH);
  assert.equal(fresh.fresh_proposals[0].author, FRESH_AUTHOR);
  assert.equal(fresh.fresh_proposals[0].origins[0].reconsideration_id, 'review-fresh',
    'fresh provenance takes the reconsideration id from historical_inputs');
  assert.deepEqual(proposals, before, 'the projection passed by the caller remains immutable');
  assert.equal(HISTORY.occurrences[1].text, CURRENT, 'retained source text is not rewritten');
});

test('schema validation rejects swapping observed and inferred record kinds', async () => {
  const wrongRevision = structuredClone(HISTORY);
  wrongRevision.revisions[0].kind = 'inferred-predecessor';
  await assert.rejects(build({ history: wrongRevision }), /actual-revision/);

  const wrongConnection = structuredClone(RECONSIDERATIONS);
  wrongConnection.predecessor_connections[0].kind = 'actual-revision';
  await assert.rejects(build({ reconsiderations: wrongConnection }), /inferred-predecessor/);
});

test('schema validation rejects cross-wired revision endpoints, continuations, and earlier proposals', async () => {
  const wrongEndpoint = structuredClone(RECONSIDERATIONS);
  wrongEndpoint.predecessor_connections[0].to_occurrence_ids = ['result-unrelated'];
  await assert.rejects(build({ reconsiderations: wrongEndpoint }), /endpoints do not belong to revision/);

  const wrongContinuation = structuredClone(RECONSIDERATIONS);
  wrongContinuation.occurrence_continuations[0].to_occurrence_ids = ['current-unrelated'];
  await assert.rejects(build({ reconsiderations: wrongContinuation }), /keep repo, path, and exact text/);

  const wrongSourceOccurrence = structuredClone(HISTORY);
  wrongSourceOccurrence.occurrences.find(row => row.id === 'proposal-source-direct')
    .location.same_text_ordinal = 7;
  await assert.rejects(build({ history: wrongSourceOccurrence }), /occurrence ordinal/,
    'identical wording in the same file is not enough to establish an occurrence continuation');

  const proposals = proposalIndex();
  proposals.proposals.find(row => row.id === 'proposal-old').from = IDS.earlierShort;
  await assert.rejects(build({ proposalIndex: proposals }), /does not start from a predecessor text/);

  const byEdge = proposalIndex();
  byEdge.proposals.find(row => row.id === 'proposal-old').id = 'renamed-by-the-collection';
  await assert.rejects(build({ proposalIndex: byEdge }), /missing earlier proposal/,
    'a record naming an id the index lacks needs its own from and to to be matched by edge');
});
