// kits/text-history.js: occurrence-scoped passage history for the Text estate.
//
// Text identity is intentionally not history identity. The same literal string
// may occur in several documents, or several times in one document. This kit
// therefore answers only an occurrence-scoped question: given an exact current
// block, its same-text ordinal, and the Git blob for the whole open file, what
// explicit continuation reaches a curated predecessor connection? The records
// already contain the historical judgment and its evidence; this browser
// projection never infers a connection from proximity, similarity, or a ref
// name that may have moved.
(() => {
  if (window.TextHistory) return;

  const SCHEMA = 'text-browser-history/v1';
  const SOURCE_SCHEMA = 'text-current-sources/v2';
  const HISTORY_SCHEMA = 'text-passage-history/v1';
  const RECONSIDERATIONS_SCHEMA = 'text-passage-reconsiderations/v1';
  const DEFAULT_SPEC = 'projects/text/current-sources.json';
  const FRESH_LANE = 'historical-reconsideration';
  const loads = new WeakMap();

  // History joins Text identity, whose only normalization is Python's edge
  // strip. A rewrap is a different string and needs its own explicit current
  // occurrence. Proposal display deliberately keeps its older flattened join.
  const PY_EDGE = /^(?:\p{White_Space}|[\u001c-\u001f])+|(?:\p{White_Space}|[\u001c-\u001f])+$/gu;
  const edgeTrim = value => String(value ?? '').replace(PY_EDGE, '');
  const list = value => Array.isArray(value) ? value : [];
  const unique = values => [...new Set(values.filter(Boolean))];
  const OID = /^[0-9a-f]{40}$/;
  const ids = (row, plural, singular) => unique([
    ...list(row?.[plural]),
    ...(row?.[singular] ? [row[singular]] : []),
  ]);

  function parseJson(value, label) {
    if (value && typeof value === 'object') return value;
    try { return JSON.parse(String(value ?? '')); }
    catch (error) { throw new Error(`${label} is not valid JSON: ${error.message || error}`); }
  }

  function requireArray(value, label) {
    if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
    return value;
  }

  function keyed(rows, label) {
    const out = new Map();
    for (const row of rows) {
      if (!row || typeof row.id !== 'string' || !row.id) {
        throw new Error(`Every ${label} must have an id`);
      }
      if (out.has(row.id)) throw new Error(`Duplicate ${label}: ${row.id}`);
      out.set(row.id, row);
    }
    return out;
  }

  const pathUrl = (repo, commit, path, location = {}) => {
    if (!repo || !commit || !path) return '';
    const encoded = String(path).split('/').map(encodeURIComponent).join('/');
    let url = `https://github.com/${repo}/blob/${encodeURIComponent(commit)}/${encoded}`;
    const start = Number(location.start_line);
    const end = Number(location.end_line);
    if (Number.isFinite(start) && start > 0) {
      url += Number.isFinite(end) && end > start ? `#L${start}-L${end}` : `#L${start}`;
    }
    return url;
  };

  function occurrenceView(row) {
    const document = { ...(row.document || {}) };
    const location = { ...(row.location || {}) };
    return {
      ...row,
      document,
      location,
      url: pathUrl(document.repo, document.commit, document.path, location),
      label: [
        document.path || '',
        Number.isFinite(Number(location.start_line)) ? `L${location.start_line}` : '',
        document.commit ? String(document.commit).slice(0, 7) : '',
      ].filter(Boolean).join(' · '),
    };
  }

  async function digest(algorithm, bytes) {
    const Encoder = window.TextEncoder || globalThis.TextEncoder;
    const crypt = window.crypto?.subtle ? window.crypto : globalThis.crypto;
    if (!Encoder || !crypt?.subtle) throw new Error('TextHistory requires Web Crypto');
    const value = typeof bytes === 'string' ? new Encoder().encode(bytes) : bytes;
    const result = await crypt.subtle.digest(algorithm, value);
    return [...new Uint8Array(result)].map(n => n.toString(16).padStart(2, '0')).join('');
  }
  const sha256 = text => digest('SHA-256', String(text));
  const textId = text => sha256(edgeTrim(text));
  async function gitBlobId(text) {
    const Encoder = window.TextEncoder || globalThis.TextEncoder;
    if (!Encoder) throw new Error('TextHistory requires TextEncoder');
    const body = new Encoder().encode(String(text ?? ''));
    const header = new Encoder().encode(`blob ${body.byteLength}\0`);
    const bytes = new Uint8Array(header.byteLength + body.byteLength);
    bytes.set(header);
    bytes.set(body, header.byteLength);
    return digest('SHA-1', bytes);
  }
  function pythonJson(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return '[' + value.map(pythonJson).join(', ') + ']';
    if (typeof value === 'object') {
      return '{' + Object.keys(value).sort()
        .map(key => `${JSON.stringify(key)}: ${pythonJson(value[key])}`)
        .join(', ') + '}';
    }
    const out = JSON.stringify(value);
    if (out === undefined) throw new Error('TextHistory cannot hash undefined');
    return out;
  }

  async function proposalOverlay(base, fresh, occurrenceById) {
    const index = {
      ...(base || {}),
      texts: { ...(base?.texts || {}) },
      proposals: [...(base?.proposals || [])],
      sources: { ...(base?.sources || {}) },
      contexts: { ...(base?.contexts || {}) },
      _lane_by_proposal: { ...(base?._lane_by_proposal || {}) },
      _origins_by_proposal: Object.fromEntries(Object.entries(base?._origins_by_proposal || {})
        .map(([key, value]) => [key, [...value]])),
      _analysis_by_proposal: { ...(base?._analysis_by_proposal || {}) },
    };
    const byId = new Map(index.proposals.map(row => [row.id, row]));

    async function textRef(value, role, proposal) {
      const sourceOccurrenceId = proposal.source_occurrence_id || proposal.current_occurrence_id;
      const source = occurrenceById.get(sourceOccurrenceId);
      if (value && typeof value === 'object') {
        const id = value.text_id || value.id || '';
        const text = value.text ?? index.texts[id] ?? (id === source?.text_id ? source.text : '');
        if (!id && text !== '') return { id: await textId(text), text: edgeTrim(text) };
        if (id && text !== '') return { id, text: edgeTrim(text) };
      }
      if (typeof value === 'string' && index.texts[value] !== undefined) {
        return { id: value, text: index.texts[value] };
      }
      if (typeof value === 'string' && value === source?.text_id) {
        return { id: value, text: source.text };
      }
      if (role === 'to' && typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
          && typeof proposal.replacement === 'string') {
        return { id: value, text: edgeTrim(proposal.replacement) };
      }
      if (role === 'from' && (value === undefined || value === null || value === '')) {
        if (!source) throw new Error(`Fresh proposal ${proposal.id} has no source occurrence`);
        return { id: source.text_id, text: source.text };
      }
      if (typeof value === 'string' && !/^[0-9a-f]{64}$/.test(value)) {
        return { id: await textId(value), text: edgeTrim(value) };
      }
      throw new Error(`Fresh proposal ${proposal.id} has an unresolved ${role} text`);
    }

    for (const row of fresh) {
      if (!row?.id) throw new Error('Every fresh proposal must have an id');
      if (byId.has(row.id)) continue;
      const from = await textRef(row.from, 'from', row);
      const to = await textRef(row.to, 'to', row);
      if (!from.text || !to.text || from.id === to.id) continue;
      if (await textId(from.text) !== from.id) {
        throw new Error(`Fresh proposal ${row.id} from text does not match ${from.id}`);
      }
      if (await textId(to.text) !== to.id) {
        throw new Error(`Fresh proposal ${row.id} replacement does not match ${to.id}`);
      }
      const expected = await sha256(pythonJson({
        from: from.id,
        to: to.id,
        author: row.author || '',
        purpose: row.purpose || '',
      }));
      if (expected !== row.id) throw new Error(`Fresh proposal identity does not match its fields: ${row.id}`);
      index.texts[from.id] = from.text;
      index.texts[to.id] = to.text;
      const proposal = {
        id: row.id,
        from: from.id,
        to: to.id,
        author: row.author || '',
        purpose: row.purpose || '',
      };
      index.proposals.push(proposal);
      byId.set(row.id, proposal);
      index._lane_by_proposal[row.id] = FRESH_LANE;
      const sourceOccurrenceId = row.source_occurrence_id || row.current_occurrence_id;
      const source = occurrenceById.get(sourceOccurrenceId);
      const reconsiderationId = row.historical_inputs?.reconsideration_id || null;
      index._origins_by_proposal[row.id] = [{
        proposal_id: row.id,
        scope: 'source-occurrence',
        record: reconsiderationId || sourceOccurrenceId || row.id,
        source_occurrence_id: sourceOccurrenceId || null,
        reconsideration_id: reconsiderationId,
        historical_inputs: row.historical_inputs ?? null,
        agent: row.author || null,
        rationale: row.purpose || null,
        document: source ? {
          ...source.document,
          start_line: source.location?.start_line,
          end_line: source.location?.end_line,
        } : null,
      }];
    }
    return index;
  }

  function proposalRefs(row, kind) {
    const roots = kind === 'earlier'
      ? ['earlier_proposal', 'prior_proposal', 'historical_proposal']
      : ['fresh_proposal', 'current_proposal'];
    const found = roots.flatMap(root => [
      ...ids(row, `${root}_ids`, `${root}_id`),
      ...(typeof row?.[root] === 'string' ? [row[root]] : []),
    ]);
    if (kind === 'earlier' && typeof row?.historical_proposal?.id === 'string') {
      found.push(row.historical_proposal.id);
    }
    return unique(found);
  }

  async function build({ history, reconsiderations, proposalIndex, repo = '', ref = 'main', sources = {} }) {
    history = parseJson(history, 'passage history');
    reconsiderations = parseJson(reconsiderations, 'passage reconsiderations');
    if (history?.schema !== HISTORY_SCHEMA) {
      throw new Error(`Unsupported passage history schema: ${history?.schema || '(missing)'}`);
    }
    if (reconsiderations?.schema !== RECONSIDERATIONS_SCHEMA) {
      throw new Error(`Unsupported passage reconsiderations schema: ${reconsiderations?.schema || '(missing)'}`);
    }

    const occurrences = requireArray(history.occurrences, 'history occurrences').map(occurrenceView);
    const revisions = requireArray(history.revisions, 'history revisions').map(row => ({ ...row }));
    const connections = requireArray(reconsiderations.predecessor_connections,
      'predecessor connections').map(row => ({ ...row }));
    const proposalSourceConnections = requireArray(reconsiderations.proposal_source_connections,
      'proposal source connections').map(row => ({ ...row }));
    const continuations = requireArray(reconsiderations.occurrence_continuations,
      'occurrence continuations').map(row => ({ ...row }));
    const reviews = requireArray(reconsiderations.reconsiderations,
      'passage reconsiderations').map(row => ({ ...row }));
    const fresh = requireArray(reconsiderations.fresh_proposals, 'fresh proposals').map(row => ({ ...row }));
    const occurrenceById = keyed(occurrences, 'occurrence');
    const revisionById = keyed(revisions, 'revision');
    const connectionById = keyed(connections, 'predecessor connection');
    const proposalSourceConnectionById = keyed(proposalSourceConnections, 'proposal source connection');
    const continuationById = keyed(continuations, 'occurrence continuation');
    const reviewById = keyed(reviews, 'reconsideration');
    keyed(fresh, 'fresh proposal');

    for (const occurrence of occurrences) {
      if (!['predecessor', 'revision-result', 'current'].includes(occurrence.state)) {
        throw new Error(`Occurrence ${occurrence.id} has unsupported state ${occurrence.state || '(missing)'}`);
      }
      if (await textId(occurrence.text) !== occurrence.text_id) {
        throw new Error(`Occurrence ${occurrence.id} text does not match ${occurrence.text_id}`);
      }
      const document = occurrence.document || {};
      if (!document.repo || !document.path || !OID.test(document.commit || '') || !OID.test(document.blob || '')) {
        throw new Error(`Occurrence ${occurrence.id} must pin a repo, path, commit, and Git blob`);
      }
      if (occurrence.state === 'current' && history.scope?.current_commit
          && document.commit !== history.scope.current_commit) {
        throw new Error(`Current occurrence ${occurrence.id} is not pinned to history.scope.current_commit`);
      }
    }

    const revisionForRemoved = new Map();
    const revisionForAdded = new Map();
    for (const revision of revisions) {
      if (revision.kind !== 'actual-revision') {
        throw new Error(`Revision ${revision.id} must have kind actual-revision`);
      }
      if (!OID.test(revision.commit || '') || !OID.test(revision.parent || '')
          || !OID.test(revision.before_blob || '') || !OID.test(revision.after_blob || '')) {
        throw new Error(`Revision ${revision.id} must pin commit, parent, before_blob, and after_blob`);
      }
      const removed = list(revision.removed_occurrence_ids);
      const added = list(revision.added_occurrence_ids);
      if (!removed.length || !added.length) throw new Error(`Revision ${revision.id} must name removed and added occurrences`);
      for (const id of removed) {
        const occurrence = occurrenceById.get(id);
        if (!occurrence) throw new Error(`Revision ${revision.id} references missing occurrence ${id}`);
        if (occurrence.state !== 'predecessor') {
          throw new Error(`Revision ${revision.id} removed endpoint ${id} must be a predecessor`);
        }
        if (occurrence.document.repo !== revision.repo || occurrence.document.path !== revision.path
            || occurrence.document.commit !== revision.parent || occurrence.document.blob !== revision.before_blob) {
          throw new Error(`Revision ${revision.id} removed endpoint ${id} does not match its pinned before document`);
        }
        if (revisionForRemoved.has(id)) throw new Error(`Revision predecessor ${id} belongs to more than one revision`);
        revisionForRemoved.set(id, revision);
      }
      for (const id of added) {
        const occurrence = occurrenceById.get(id);
        if (!occurrence) throw new Error(`Revision ${revision.id} references missing occurrence ${id}`);
        if (occurrence.state !== 'revision-result') {
          throw new Error(`Revision ${revision.id} added endpoint ${id} must be a revision-result`);
        }
        if (occurrence.document.repo !== revision.repo || occurrence.document.path !== revision.path
            || occurrence.document.commit !== revision.commit || occurrence.document.blob !== revision.after_blob) {
          throw new Error(`Revision ${revision.id} added endpoint ${id} does not match its pinned after document`);
        }
        if (revisionForAdded.has(id)) throw new Error(`Revision result ${id} belongs to more than one revision`);
        revisionForAdded.set(id, revision);
      }
    }
    for (const connection of connections) {
      if (connection.kind !== 'inferred-predecessor') {
        throw new Error(`Connection ${connection.id} must have kind inferred-predecessor`);
      }
      for (const id of [...list(connection.from_occurrence_ids), ...list(connection.to_occurrence_ids)]) {
        if (!occurrenceById.has(id)) throw new Error(`Connection ${connection.id} references missing occurrence ${id}`);
      }
      if (connection.revision_id && !revisionById.has(connection.revision_id)) {
        throw new Error(`Connection ${connection.id} references missing revision ${connection.revision_id}`);
      }
      const revision = revisionById.get(connection.revision_id);
      if (!revision) throw new Error(`Connection ${connection.id} must reference an actual revision`);
      const removed = new Set(revision.removed_occurrence_ids);
      const added = new Set(revision.added_occurrence_ids);
      const fromIds = list(connection.from_occurrence_ids);
      const toIds = list(connection.to_occurrence_ids);
      if (!fromIds.length || !toIds.length) throw new Error(`Connection ${connection.id} must name both endpoint sets`);
      if (fromIds.some(id => !removed.has(id)) || toIds.some(id => !added.has(id))) {
        throw new Error(`Connection ${connection.id} endpoints do not belong to revision ${revision.id}`);
      }
    }

    for (const connection of proposalSourceConnections) {
      if (connection.kind !== 'inferred-proposal-source-continuation') {
        throw new Error(`Proposal source connection ${connection.id} must have kind inferred-proposal-source-continuation`);
      }
      const fromIds = list(connection.from_occurrence_ids);
      const toIds = list(connection.to_occurrence_ids);
      if (fromIds.length !== 1 || toIds.length !== 1 || connection.cardinality !== 'one-to-one') {
        throw new Error(`Proposal source connection ${connection.id} must be one-to-one`);
      }
      if (!list(connection.basis).length || !connection.limits) {
        throw new Error(`Proposal source connection ${connection.id} must retain evidence and limits`);
      }
      const from = fromIds.map(id => occurrenceById.get(id));
      const to = toIds.map(id => occurrenceById.get(id));
      if (from.some(row => !row) || to.some(row => !row)) {
        throw new Error(`Proposal source connection ${connection.id} references a missing occurrence`);
      }
      if (from.some(row => row.state !== 'predecessor' || revisionForRemoved.has(row.id))) {
        throw new Error(`Proposal source connection ${connection.id} must start at a retained proposal-source occurrence`);
      }
      if (to.some(row => row.state !== 'predecessor' || !revisionForRemoved.has(row.id))) {
        throw new Error(`Proposal source connection ${connection.id} must end at an exact revision predecessor`);
      }
      const predecessorConnection = connectionById.get(connection.predecessor_connection_id);
      if (!predecessorConnection
          || toIds.some(id => !predecessorConnection.from_occurrence_ids.includes(id))) {
        throw new Error(`Proposal source connection ${connection.id} cross-wires its predecessor connection`);
      }
      for (const source of from) {
        for (const predecessor of to) {
          if (source.document.repo !== predecessor.document.repo
              || source.document.path !== predecessor.document.path
              || Number(source.location?.same_text_ordinal) !== Number(predecessor.location?.same_text_ordinal)
              || source.text_id !== predecessor.text_id || source.text !== predecessor.text) {
            throw new Error(`Proposal source connection ${connection.id} endpoints must keep repo, path, occurrence ordinal, and exact text`);
          }
        }
      }
    }

    for (const continuation of continuations) {
      if (continuation.kind !== 'inferred-occurrence-continuation') {
        throw new Error(`Continuation ${continuation.id} must have kind inferred-occurrence-continuation`);
      }
      const fromIds = list(continuation.from_occurrence_ids);
      const toIds = list(continuation.to_occurrence_ids);
      if (!fromIds.length || !toIds.length) throw new Error(`Continuation ${continuation.id} must name both endpoint sets`);
      const from = fromIds.map(id => occurrenceById.get(id));
      const to = toIds.map(id => occurrenceById.get(id));
      if (from.some(row => !row) || to.some(row => !row)) {
        throw new Error(`Continuation ${continuation.id} references a missing occurrence`);
      }
      if (from.some(row => row.state !== 'revision-result' || !revisionForAdded.has(row.id))) {
        throw new Error(`Continuation ${continuation.id} must start at an actual revision-result`);
      }
      if (to.some(row => row.state !== 'current')) {
        throw new Error(`Continuation ${continuation.id} must end at a pinned current occurrence`);
      }
      for (const before of from) {
        for (const current of to) {
          if (before.document.repo !== current.document.repo
              || before.document.path !== current.document.path
              || before.text_id !== current.text_id || before.text !== current.text) {
            throw new Error(`Continuation ${continuation.id} endpoints must keep repo, path, and exact text`);
          }
        }
      }
    }

    const proposals = await proposalOverlay(proposalIndex, fresh, occurrenceById);
    // The collection's view carries no origins or lane; the history overlay
    // attaches its own for the proposals it records (fresh ones, and any a
    // fixture supplies), so md-history can name the pinned source occurrence.
    const documentUrl = document => {
      if (!document?.repo || !document?.path) return '';
      const path = String(document.path).split('/').map(encodeURIComponent).join('/');
      const start = Number(document.start_line);
      const end = Number(document.end_line);
      let url = `https://github.com/${document.repo}/blob/${encodeURIComponent(document.commit || 'main')}/${path}`;
      if (Number.isFinite(start) && start > 0) url += end && end !== start ? `#L${start}-L${end}` : `#L${start}`;
      return url;
    };
    const proposalView = idOrRow => {
      const view = window.TextProposals?.view?.(proposals, idOrRow) || null;
      if (!view) return null;
      return {
        ...view,
        lane: proposals._lane_by_proposal?.[view.id] || '',
        origins: list(proposals._origins_by_proposal?.[view.id]).map(origin => origin?.document && !origin.document.url
          ? { ...origin, document: { ...origin.document, url: documentUrl(origin.document) } }
          : origin),
      };
    };
    const proposalSourceConnectionViews = proposalSourceConnections.map(row => ({
      ...row,
      from_occurrences: list(row.from_occurrence_ids).map(id => occurrenceById.get(id)),
      to_occurrences: list(row.to_occurrence_ids).map(id => occurrenceById.get(id)),
    }));
    const proposalSourceConnectionViewById = new Map(
      proposalSourceConnectionViews.map(row => [row.id, row]));
    const freshByReview = new Map();
    for (const proposal of fresh) {
      const reconsiderationId = proposal.historical_inputs?.reconsideration_id
        || proposal.reconsideration_id || '';
      if (!reconsiderationId) continue;
      if (!freshByReview.has(reconsiderationId)) freshByReview.set(reconsiderationId, []);
      freshByReview.get(reconsiderationId).push(proposal.id);
    }
    const reviewViews = reviews.map(row => {
      const connectionIds = unique([
        ...ids(row, 'connection_ids', 'connection_id'),
        ...ids(row, 'predecessor_connection_ids', 'predecessor_connection_id'),
      ]);
      const earlierIds = proposalRefs(row, 'earlier');
      const freshIds = unique([
        ...proposalRefs(row, 'fresh'),
        ...(typeof row.outcome?.proposal_id === 'string' ? [row.outcome.proposal_id] : []),
        ...(freshByReview.get(row.id) || []),
      ]);
      if (!connectionIds.length) throw new Error(`Reconsideration ${row.id} must reference a predecessor connection`);
      const reviewConnections = connectionIds.map(id => connectionById.get(id));
      if (reviewConnections.some(value => !value)) {
        throw new Error(`Reconsideration ${row.id} references a missing predecessor connection`);
      }
      const proposalSourceConnectionIds = ids(row,
        'proposal_source_connection_ids', 'proposal_source_connection_id');
      if (proposalSourceConnectionIds.length !== 1) {
        throw new Error(`Reconsideration ${row.id} must reference one proposal source connection`);
      }
      const proposalSourceConnection = proposalSourceConnectionById.get(proposalSourceConnectionIds[0]);
      if (!proposalSourceConnection) {
        throw new Error(`Reconsideration ${row.id} references a missing proposal source connection`);
      }
      const predecessorIds = new Set(reviewConnections.flatMap(value => list(value.from_occurrence_ids)));
      if (!connectionIds.includes(proposalSourceConnection.predecessor_connection_id)
          || list(proposalSourceConnection.to_occurrence_ids).some(id => !predecessorIds.has(id))) {
        throw new Error(`Reconsideration ${row.id} cross-wires its proposal source and predecessor connection`);
      }
      const historicalSourceId = row.historical_proposal?.source_occurrence_id || '';
      if (!historicalSourceId || !proposalSourceConnection.from_occurrence_ids.includes(historicalSourceId)) {
        throw new Error(`Reconsideration ${row.id} does not pin its proposal source occurrence`);
      }
      const historicalSource = occurrenceById.get(historicalSourceId);
      const continuationIds = ids(row, 'occurrence_continuation_ids', 'occurrence_continuation_id');
      if (!continuationIds.length) throw new Error(`Reconsideration ${row.id} must reference an occurrence continuation`);
      const reviewContinuations = continuationIds.map(id => continuationById.get(id));
      if (reviewContinuations.some(value => !value)) {
        throw new Error(`Reconsideration ${row.id} references a missing occurrence continuation`);
      }
      const resultIds = new Set(reviewConnections.flatMap(value => list(value.to_occurrence_ids)));
      if (reviewContinuations.some(value => !list(value.from_occurrence_ids).some(id => resultIds.has(id)))) {
        throw new Error(`Reconsideration ${row.id} cross-wires its connection and continuation`);
      }
      const currentIds = ids(row, 'current_occurrence_ids', 'current_occurrence_id');
      const continuedCurrentIds = new Set(reviewContinuations.flatMap(value => list(value.to_occurrence_ids)));
      if (!currentIds.length || currentIds.some(id => !continuedCurrentIds.has(id))
          || [...continuedCurrentIds].some(id => !currentIds.includes(id))) {
        throw new Error(`Reconsideration ${row.id} names a current occurrence outside its continuations`);
      }
      const predecessorTextIds = new Set(reviewConnections.flatMap(value => list(value.from_occurrence_ids))
        .map(id => occurrenceById.get(id)?.text_id).filter(Boolean));
      // An earlier proposal is the review's historical_proposal record, matched
      // to the collection by id where the index carries that id, else by its
      // edge (from, to). The collection records no location for a proposal,
      // so the pinning of that edge to a source occurrence is the review's own
      // proposal-source connection, checked above.
      const byEdge = new Map(list(proposals?.proposals).map(p => [`${p.from}\n${p.to}`, p]));
      const earlierProposals = earlierIds.map(id => {
        const historical = row.historical_proposal || {};
        let proposal = proposalView(id);
        if (!proposal && historical.id === id && historical.from && historical.to) {
          const retained = byEdge.get(`${historical.from}\n${historical.to}`);
          proposal = retained ? proposalView(retained) : null;
        }
        if (!proposal) throw new Error(`Reconsideration ${row.id} references missing earlier proposal ${id}`);
        const fromId = proposal.from?.text_id || proposal.from?.id || proposal.from;
        if (!predecessorTextIds.has(fromId)) {
          throw new Error(`Reconsideration ${row.id} earlier proposal ${id} does not start from a predecessor text`);
        }
        if (fromId !== historicalSource.text_id) {
          throw new Error(`Reconsideration ${row.id} earlier proposal ${id} does not start from its proposal source text`);
        }
        return proposal;
      });
      const freshProposals = freshIds.map(id => {
        const proposal = proposalView(id);
        if (!proposal) throw new Error(`Reconsideration ${row.id} references missing fresh proposal ${id}`);
        return proposal;
      });
      return {
        ...row,
        connection_ids: connectionIds,
        proposal_source_connection_id: proposalSourceConnection.id,
        proposal_source_connection: proposalSourceConnectionViewById.get(proposalSourceConnection.id),
        occurrence_continuation_ids: continuationIds,
        earlier_proposal_ids: earlierIds,
        fresh_proposal_ids: freshIds,
        earlier_proposals: earlierProposals,
        fresh_proposals: freshProposals,
      };
    });

    for (const row of fresh) {
      const inputs = row.historical_inputs || {};
      const review = reviewById.get(inputs.reconsideration_id);
      if (!review) throw new Error(`Fresh proposal ${row.id} has no valid historical reconsideration`);
      const connection = connectionById.get(inputs.predecessor_connection_id);
      if (!connection) throw new Error(`Fresh proposal ${row.id} has no valid predecessor connection`);
      const reviewConnectionIds = unique([
        ...ids(review, 'connection_ids', 'connection_id'),
        ...ids(review, 'predecessor_connection_ids', 'predecessor_connection_id'),
      ]);
      if (!reviewConnectionIds.includes(connection.id)
          || (inputs.revision_id && inputs.revision_id !== connection.revision_id)
          || (inputs.historical_proposal_id
            && !proposalRefs(review, 'earlier').includes(inputs.historical_proposal_id))) {
        throw new Error(`Fresh proposal ${row.id} cross-wires its historical reconsideration inputs`);
      }
      const proposalSourceConnection = proposalSourceConnectionById.get(
        inputs.proposal_source_connection_id);
      if (!proposalSourceConnection
          || inputs.proposal_source_connection_id !== review.proposal_source_connection_id
          || proposalSourceConnection.to_occurrence_ids.some(
            id => !connection.from_occurrence_ids.includes(id))) {
        throw new Error(`Fresh proposal ${row.id} cross-wires its proposal source connection`);
      }
      const continuationIds = ids(inputs, 'occurrence_continuation_ids', 'occurrence_continuation_id');
      if (!continuationIds.length) throw new Error(`Fresh proposal ${row.id} has no occurrence continuation input`);
      const reviewContinuationIds = ids(review, 'occurrence_continuation_ids', 'occurrence_continuation_id');
      if (continuationIds.some(id => !reviewContinuationIds.includes(id))) {
        throw new Error(`Fresh proposal ${row.id} cross-wires its reconsideration and continuation`);
      }
      const proposalContinuations = continuationIds.map(id => continuationById.get(id));
      if (proposalContinuations.some(value => !value)) {
        throw new Error(`Fresh proposal ${row.id} references a missing occurrence continuation`);
      }
      const resultIds = new Set(connection.to_occurrence_ids);
      if (proposalContinuations.some(value => !list(value.from_occurrence_ids).some(id => resultIds.has(id)))) {
        throw new Error(`Fresh proposal ${row.id} cross-wires its connection and continuation`);
      }
      const sourceOccurrenceId = row.source_occurrence_id || row.current_occurrence_id;
      const source = occurrenceById.get(sourceOccurrenceId);
      const currentIds = new Set(proposalContinuations.flatMap(value => list(value.to_occurrence_ids)));
      if (!source || source.state !== 'current' || !currentIds.has(sourceOccurrenceId)) {
        throw new Error(`Fresh proposal ${row.id} source is not the continued current occurrence`);
      }
      const view = proposalView(row.id);
      if ((view?.from?.text_id || view?.from?.id) !== source.text_id) {
        throw new Error(`Fresh proposal ${row.id} does not start from its current source text`);
      }
    }
    const reviewsByConnection = new Map();
    for (const review of reviewViews) {
      for (const id of review.connection_ids) {
        if (!reviewsByConnection.has(id)) reviewsByConnection.set(id, []);
        reviewsByConnection.get(id).push(review);
      }
    }

    const continuationViews = continuations.map(row => ({
      ...row,
      from_occurrences: list(row.from_occurrence_ids).map(id => occurrenceById.get(id)),
      to_occurrences: list(row.to_occurrence_ids).map(id => occurrenceById.get(id)),
    }));
    const continuationViewById = new Map(continuationViews.map(row => [row.id, row]));
    const continuationsByResult = new Map();
    for (const continuation of continuationViews) {
      for (const id of continuation.from_occurrence_ids) {
        if (!continuationsByResult.has(id)) continuationsByResult.set(id, []);
        continuationsByResult.get(id).push(continuation);
      }
    }

    const connectionViews = connections.map(row => {
      const from = list(row.from_occurrence_ids).map(id => occurrenceById.get(id)).filter(Boolean);
      const to = list(row.to_occurrence_ids).map(id => occurrenceById.get(id)).filter(Boolean);
      const revision = row.revision_id ? revisionById.get(row.revision_id) || null : null;
      const connectionReviews = reviewsByConnection.get(row.id) || [];
      const connectionProposalSources = unique(connectionReviews
        .map(review => review.proposal_source_connection?.id))
        .map(id => proposalSourceConnectionViewById.get(id));
      const connectionContinuations = unique(list(row.to_occurrence_ids)
        .flatMap(id => list(continuationsByResult.get(id))).map(value => value.id))
        .map(id => continuationViewById.get(id));
      return {
        ...row,
        from_occurrences: from,
        predecessors: from,
        to_occurrences: to,
        revision: revision ? {
          ...revision,
          removed_occurrences: list(revision.removed_occurrence_ids)
            .map(id => occurrenceById.get(id)).filter(Boolean),
          added_occurrences: list(revision.added_occurrence_ids)
            .map(id => occurrenceById.get(id)).filter(Boolean),
        } : null,
        reconsiderations: connectionReviews,
        proposals: connectionReviews.flatMap(review => review.earlier_proposals),
        fresh_proposals: connectionReviews.flatMap(review => review.fresh_proposals),
        proposal_source_connections: connectionProposalSources,
        occurrence_continuations: connectionContinuations,
        current_occurrence_ids: unique(connectionContinuations.flatMap(value => value.to_occurrence_ids)),
      };
    });
    const connectionsByCurrent = new Map();
    for (const connection of connectionViews) {
      for (const id of list(connection.current_occurrence_ids)) {
        if (!connectionsByCurrent.has(id)) connectionsByCurrent.set(id, []);
        connectionsByCurrent.get(id).push(connection);
      }
    }

    const current = occurrences.filter(row => row.state === 'current');
    const byDocumentBlob = new Map();
    for (const occurrence of current) {
      const key = `${occurrence.document.repo || ''}\u0000${occurrence.document.path || ''}\u0000${occurrence.document.blob || ''}`;
      if (!byDocumentBlob.has(key)) byDocumentBlob.set(key, []);
      byDocumentBlob.get(key).push(occurrence);
    }

    return {
      schema: SCHEMA,
      repo,
      ref,
      sources: { ...sources },
      occurrences,
      revisions,
      predecessor_connections: connectionViews,
      proposal_source_connections: proposalSourceConnectionViews,
      occurrence_continuations: continuationViews,
      reconsiderations: reviewViews,
      fresh_proposals: fresh,
      proposals,
      summary: {
        occurrences: occurrences.length,
        revisions: revisions.length,
        predecessor_connections: connections.length,
        proposal_source_connections: proposalSourceConnections.length,
        occurrence_continuations: continuations.length,
        reconsiderations: reviews.length,
        fresh_proposals: fresh.length,
      },
      _occurrence_by_id: occurrenceById,
      _revision_by_id: revisionById,
      _connections_by_current: connectionsByCurrent,
      _current_by_document_blob: byDocumentBlob,
    };
  }

  function lookup(index, value, { repo = '', path = '', blob = '', ref = '', sameTextOrdinal = null } = {}) {
    if (!repo || !path || !OID.test(blob)) {
      throw new Error('TextHistory.lookup requires repo, path, and a full-file Git blob');
    }
    const text = String(value ?? '');
    if (!edgeTrim(text)) throw new Error('The passage is empty after edge trimming');
    const key = `${repo}\u0000${path}\u0000${blob}`;
    let occurrences = list(index._current_by_document_blob?.get(key))
      .filter(row => edgeTrim(row.text) === edgeTrim(text));
    const wanted = Number(sameTextOrdinal);
    if (Number.isFinite(wanted) && wanted > 0) {
      occurrences = occurrences.filter(row => Number(row.location?.same_text_ordinal) === wanted);
    }
    const matches = occurrences.map(occurrence => ({
      occurrence,
      connections: list(index._connections_by_current?.get(occurrence.id)),
    })).filter(row => row.connections.length);
    return {
      selection: { text, repo, path, blob, ref, same_text_ordinal: Number.isFinite(wanted) ? wanted : null },
      matches,
      ambiguous: matches.length > 1,
    };
  }

  function loadBucket(gh) {
    let bucket = loads.get(gh);
    if (!bucket) { bucket = new Map(); loads.set(gh, bucket); }
    return bucket;
  }

  async function load(gh, {
    specPath = DEFAULT_SPEC,
    proposalIndex = null,
    fresh = false,
    quiet = false,
  } = {}) {
    if (!gh || typeof gh.get !== 'function') throw new Error('TextHistory.load requires a GH client');
    const key = `${specPath}:${quiet ? 'quiet' : 'interactive'}`;
    const bucket = loadBucket(gh);
    if (!fresh && bucket.has(key)) return bucket.get(key);
    const options = {
      ...(fresh ? (window.GH?.FRESH || { cache: 'no-store' }) : {}),
      ...(quiet ? { quiet: true } : {}),
    };
    const promise = (async () => {
      const specResult = await gh.get(specPath, options);
      const spec = parseJson(specResult.text, specPath);
      if (spec?.schema !== SOURCE_SCHEMA) {
        throw new Error(`Unsupported text source schema: ${spec?.schema || '(missing)'}`);
      }
      const pair = spec.passage_history;
      if (!pair || typeof pair !== 'object' || Array.isArray(pair)
          || typeof pair.history !== 'string' || typeof pair.reconsiderations !== 'string') {
        throw new Error('Text source specification has no passage_history history/reconsiderations pair');
      }
      const [historyResult, reconsiderationsResult] = await Promise.all([
        gh.get(pair.history, options),
        gh.get(pair.reconsiderations, options),
      ]);
      let base = proposalIndex;
      if (!base) {
        if (!window.TextProposals?.load) throw new Error('TextHistory.load requires TextProposals');
        base = await window.TextProposals.load(gh, { specPath, fresh, quiet });
      }
      return build({
        history: historyResult.text,
        reconsiderations: reconsiderationsResult.text,
        proposalIndex: base,
        repo: gh.repo || '',
        ref: gh.ref || 'main',
        sources: {
          spec: { path: specPath, sha: specResult.sha || '', url: specResult.url || '' },
          history: { path: pair.history, sha: historyResult.sha || '', url: historyResult.url || '' },
          reconsiderations: {
            path: pair.reconsiderations,
            sha: reconsiderationsResult.sha || '',
            url: reconsiderationsResult.url || '',
          },
        },
      });
    })().catch(error => {
      if (/Unsupported|requires|must|Duplicate|references|specification/.test(error?.message || '')) throw error;
      const status = Number.isFinite(error?.status) ? error.status : null;
      const wrapped = new Error('Passage history is unavailable'
        + (status ? ` (the catalog read returned ${status}).` : '.'));
      if (status) wrapped.status = status;
      wrapped.cause = error;
      throw wrapped;
    });
    bucket.set(key, promise);
    try { return await promise; }
    catch (error) { if (bucket.get(key) === promise) bucket.delete(key); throw error; }
  }

  function clear(gh = null) {
    if (gh) loads.delete(gh);
  }

  window.TextHistory = {
    SCHEMA,
    SOURCE_SCHEMA,
    HISTORY_SCHEMA,
    RECONSIDERATIONS_SCHEMA,
    DEFAULT_SPEC,
    FRESH_LANE,
    build,
    load,
    lookup,
    gitBlobId,
    clear,
    _edgeTrim: edgeTrim,
  };
})();
