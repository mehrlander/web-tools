// lib/kits/md-history.js — the raw-Markdown document join and its read-only
// evidence view.
//
// This test uses syntax that disappears in rendered DOM text: a link target,
// emphasis markers, and inline-code delimiters. The same raw block also occurs
// twice. The retained occurrence names only the second, so a useful history
// view must keep the source string and its occurrence ordinal rather than
// falling back to FAB-style visible text or global text identity.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { repoRoot, makeWindow, deckGeometry } from './bootstrap.mjs';
import { marked } from 'marked';
import * as Diff from 'diff';

const { window } = makeWindow();
deckGeometry(window);
window.marked = marked;
window.Diff = Diff;
window.TextEncoder = TextEncoder;
Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
global.DOMParser = window.DOMParser;
for (const kit of [
  'guide-render.js', 'swipe-deck.js', 'md-diff.js', 'text-proposals.js',
  'text-history.js', 'md-history.js',
]) {
  new Function('window', 'document', readFileSync(path.join(repoRoot, 'lib/kits', kit), 'utf8'))(window, window.document);
}

const H = window.TextHistory;
const K = window.mdHistory;
const CURRENT = 'The **current guide** sends readers to [Text Lab](https://example.test/lab) and uses `text_id` for shared identity.';
const VISIBLE_ONLY = 'The current guide sends readers to Text Lab and uses text_id for shared identity.';
const PREVIOUS = 'The **guide** sends readers to [Text Lab](https://example.test/lab), where `text_id` stood in for passage history.';
const PROPOSED = 'The guide uses Text Lab to distinguish shared text identity from occurrence history.';
const DOC = `# Passage history\n\n${CURRENT}\n\nAn unchanged block separates two identical strings.\n\n${CURRENT}\n`;
const SOURCE_COMMIT = '8'.repeat(40);
const PRE_COMMIT = 'a'.repeat(40);
const REVISION_COMMIT = 'b'.repeat(40);
const COMMIT = 'c'.repeat(40);
const DOC_BLOB = await H.gitBlobId(DOC);
const OTHER_BLOB = await H.gitBlobId(`# Other\n\n${CURRENT}\n`);

async function textId(text) {
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
}

const IDS = {
  current: await textId(CURRENT),
  previous: await textId(PREVIOUS),
  proposed: await textId(PROPOSED),
};

const HISTORY = {
  schema: 'text-passage-history/v1',
  scope: { repo: 'mehrlander/web-tools', current_commit: COMMIT },
  occurrences: [
    {
      id: 'current-second', text_id: IDS.current, text: CURRENT, state: 'current',
      document: { repo: 'mehrlander/web-tools', path: 'docs/history.md', commit: COMMIT, blob: DOC_BLOB },
      location: { start_line: 7, end_line: 7, start_byte: 180, end_byte: 305, same_text_ordinal: 2 },
    },
    {
      id: 'same-text-other-document', text_id: IDS.current, text: CURRENT, state: 'current',
      document: { repo: 'mehrlander/web-tools', path: 'docs/unrelated.md', commit: COMMIT, blob: OTHER_BLOB },
      location: { start_line: 2, end_line: 2, start_byte: 10, end_byte: 135, same_text_ordinal: 0 },
    },
    {
      id: 'previous', text_id: IDS.previous, text: PREVIOUS, state: 'predecessor',
      document: { repo: 'mehrlander/web-tools', path: 'docs/history.md', commit: PRE_COMMIT, blob: '3'.repeat(40) },
      location: { start_line: 7, end_line: 7, start_byte: 175, end_byte: 300, same_text_ordinal: 0 },
    },
    {
      id: 'proposal-source', text_id: IDS.previous, text: PREVIOUS, state: 'predecessor',
      document: { repo: 'mehrlander/web-tools', path: 'docs/history.md', commit: SOURCE_COMMIT, blob: '4'.repeat(40) },
      location: { start_line: 6, end_line: 6, start_byte: 160, end_byte: 285, same_text_ordinal: 0 },
      source: { record: 'docs/history.md:p003' },
    },
    {
      id: 'revision-result', text_id: IDS.current, text: CURRENT, state: 'revision-result',
      document: { repo: 'mehrlander/web-tools', path: 'docs/history.md', commit: REVISION_COMMIT, blob: DOC_BLOB },
      location: { start_line: 7, end_line: 7, start_byte: 180, end_byte: 305, same_text_ordinal: 2 },
    },
  ],
  revisions: [{
    id: 'revision-history', kind: 'actual-revision', repo: 'mehrlander/web-tools', path: 'docs/history.md',
    commit: REVISION_COMMIT, parent: PRE_COMMIT, before_blob: '3'.repeat(40), after_blob: DOC_BLOB,
    removed_occurrence_ids: ['previous'], added_occurrence_ids: ['revision-result'],
    evidence: [{ type: 'git-diff', source: 'git show cccccccc -- docs/history.md', quote: 'the link-bearing paragraph changed in place' }],
  }],
};

const RECONSIDERATIONS = {
  schema: 'text-passage-reconsiderations/v1',
  predecessor_connections: [{
    id: 'connection-history', kind: 'inferred-predecessor',
    from_occurrence_ids: ['previous'], to_occurrence_ids: ['revision-result'], revision_id: 'revision-history',
    confidence: 'strong',
    basis: [{ type: 'same-hunk-and-position', source: 'revision-history', quote: 'same section, link target, and changed hunk' }],
    limits: 'The evidence supports this candidate but does not turn the inference into an observed fact.',
  }],
  proposal_source_connections: [{
    id: 'proposal-source-connection', kind: 'inferred-proposal-source-continuation',
    predecessor_connection_id: 'connection-history',
    from_occurrence_ids: ['proposal-source'], to_occurrence_ids: ['previous'],
    cardinality: 'one-to-one', confidence: 'strong',
    basis: [{ type: 'exact-text', source: 'git history', observation: 'The retained proposal source persists to the revision parent.' }],
    limits: 'This is an occurrence inference, not text identity.',
  }],
  occurrence_continuations: [{
    id: 'continuation-history', kind: 'inferred-occurrence-continuation',
    from_occurrence_ids: ['revision-result'], to_occurrence_ids: ['current-second'],
    cardinality: 'one-to-one', confidence: 'strong',
    basis: [{ type: 'exact-text-and-path', source: 'git history', observation: 'The exact block persists in the same path.' }],
    limits: 'This connects only the pinned result and current occurrences.',
  }],
  reconsiderations: [{
      id: 'review-nothing', predecessor_connection_id: 'connection-history',
    proposal_source_connection_id: 'proposal-source-connection',
    occurrence_continuation_ids: ['continuation-history'],
    historical_proposal: { id: 'proposal-previous', source_occurrence_id: 'proposal-source' }, historical_occurrence_id: 'previous', current_occurrence_id: 'current-second',
    attempted_improvement: 'Separate text identity from occurrence history.',
    already_achieved: 'The current sentence now says shared identity.', remains_useful: 'Nothing useful remains.',
    no_longer_applies: 'The old proposal targeted wording that has disappeared.', outcome: 'nothing-useful-remains',
    author: 'passage-history reconsideration', date: '2026-09-18',
  }],
  fresh_proposals: [],
};

const proposalIndex = {
  schema: 'text-browser-proposals/v1',
  proposals: [{
    id: 'proposal-previous', from: IDS.previous, to: IDS.proposed,
    author: 'earlier reviewer', purpose: 'Distinguish text identity from occurrence history.',
  }],
  texts: { [IDS.previous]: PREVIOUS, [IDS.proposed]: PROPOSED },
  sources: {}, contexts: {},
  _lane_by_proposal: { 'proposal-previous': 'audit-packet' },
  _origins_by_proposal: {
    'proposal-previous': [{
      proposal_id: 'proposal-previous',
      agent: 'earlier reviewer',
      rationale: 'One string can occur in several places.',
      document: {
        repo: 'mehrlander/web-tools', path: 'docs/history.md', commit: SOURCE_COMMIT,
        start_line: 6, end_line: 6,
      },
      record: 'docs/history.md:p003',
    }],
  },
  _analysis_by_proposal: {},
};

const index = await H.build({
  history: HISTORY,
  reconsiderations: RECONSIDERATIONS,
  proposalIndex,
  repo: 'mehrlander/home',
  ref: 'main',
  sources: {
    history: { path: 'projects/text/passage-history/example.json', sha: '6'.repeat(40) },
    reconsiderations: { path: 'projects/text/passage-history/reconsiderations.json', sha: '7'.repeat(40) },
  },
});

const options = { repo: 'mehrlander/web-tools', path: 'docs/history.md', blob: DOC_BLOB, ref: COMMIT, source: DOC };

test('plan joins on raw Markdown and the same-text occurrence ordinal', () => {
  const planned = K.plan(DOC, index, options);
  assert.equal(planned.count, 1, 'only the retained second occurrence gets history');
  assert.deepEqual(planned.ambiguous, []);
  assert.equal(planned.blocks[0].block.text, CURRENT);
  assert.equal(planned.blocks[0].block.start, DOC.lastIndexOf(CURRENT));
  assert.equal(planned.blocks[0].match.occurrence.id, 'current-second');

  assert.equal(K.plan(`# Passage history\n\n${VISIBLE_ONLY}\n`, index, options).count, 0,
    'rendered visible text is not a second identity for a raw Markdown string');
  assert.equal(K.plan(`# Passage history\n\n${CURRENT.replace(' sends ', '\nsends ')}\n`, index, options).count, 0,
    'a rewrap is a different Text string unless history records that occurrence explicitly');
  assert.equal(K.plan(`# Passage history\n\n${CURRENT}\n`, index, {
    ...options, path: 'docs/not-this-document.md',
  }).count, 0, 'identical wording in another path does not inherit this occurrence history');
  assert.equal(K.plan(DOC, index, { ...options, blob: 'f'.repeat(40), ref: COMMIT }).count, 0,
    'an exact ref and passage do not override a different full-file blob');
  assert.equal(K.plan(DOC, index, { ...options, ref: 'moving-main' }).count, 1,
    'a changed ref label does not break the pinned content identity');
});

test('render labels inference, observed revision, retained proposal, and model judgment separately', async () => {
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const handle = await K.render(host, DOC, index, options);

  assert.equal(handle.plan.count, 1);
  assert.match(host.textContent, /Inferred predecessor/i);
  assert.match(host.textContent, /Actual document revision/i);
  assert.match(host.textContent, /Inferred occurrence continuation/i);
  assert.match(host.textContent, /Inferred proposal-source continuation/i);
  assert.match(host.textContent, /Retained proposal/i);
  assert.match(host.textContent, /Reconsideration/i);
  assert.match(host.textContent, /Nothing useful remains/i);
  assert.match(host.textContent, /same section, link target, and changed hunk/i,
    'the historical connection carries the evidence behind it');
  assert.match(host.textContent, /exact block persists in the same path/i,
    'the later occurrence continuation carries its own evidence separately');
  assert.match(host.textContent, /proposal source persists to the revision parent/i,
    'the proposal-source association carries its own inspectable evidence');
  assert.match(host.textContent, /earlier reviewer/i,
    'work attached to the predecessor is visible with attribution');
  assert.match(host.textContent, /Source observation/i,
    'the retained proposal exposes its pinned occurrence provenance');
  assert.match(host.querySelector('a[href*="\/blob\/88888888"]')?.href || '', /#L6$/,
    'the provenance link targets the pinned source line rather than moving main');

  const applyButtons = [...host.querySelectorAll('button')]
    .filter(button => /^apply\b/i.test(button.textContent.trim()));
  assert.deepEqual(applyButtons, [], 'history inspection never applies a proposal to the document');
  host.remove();
});

test('render hashes the complete source, so unrelated bytes outside a passage prevent attachment', async () => {
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const handle = await K.render(host, DOC, index, {
    ...options,
    blob: DOC_BLOB,
    source: `${DOC}\nA later unrelated edit.\n`,
  });
  assert.equal(handle.count, 0,
    'render computes the Git blob itself instead of trusting the caller blob or moving ref');
  host.remove();
});

test('render has no history container when the document occurrence is not recorded', async () => {
  const host = window.document.createElement('div');
  window.document.body.append(host);
  const handle = await K.render(host, `# Other\n\n${CURRENT}\n`, index, {
    ...options, path: 'docs/not-this-document.md',
  });
  assert.equal(handle.plan.count, 0);
  assert.equal(host.querySelectorAll('[data-md-history-for]').length, 0);
  host.remove();
});
