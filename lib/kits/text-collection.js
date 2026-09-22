// kits/text-collection.js: the shared Text collection, read in the browser.
//
// The collection is three committed JSONL files in mehrlander/home,
// projects/text/: texts.jsonl, one line per distinct string {id, text};
// proposals.jsonl, one line per proposed edit {from, to, author, purpose};
// and revisions.jsonl, one line per change that happened {from, to, repo,
// path, commit}. from and to are text ids everywhere. This kit reads the
// three files as they are. Nothing is assembled from run inputs, and a
// document is matched by its text.
//
//   TextCollection.load(gh, { fresh, quiet })           -> index
//   TextCollection.view(index, idOrProposal)            -> { id, from, to, author, purpose }
//   TextCollection.lookup(index, text)                  -> { selection, exact, warnings }
//   TextCollection.search(index, { q, author, purpose })-> [view]
//   TextCollection.chain(index, textId)                 -> the text's history, newest first
//
// A text id is the sha256 of the edge-trimmed UTF-8 bytes (edge-trim-v1, the
// same rule as collection.text_id), and load checks every id against its
// text. A proposal id is the sha256 of the Python json.dumps of {from, to,
// author, purpose} with sorted keys, computed here since the file does not
// carry it; it is what a Text Lab address names.
//
// READ-ONLY. A retained proposal is prior work on the same literal string, not
// a recommendation for the occurrence on screen, and no surface applies one.
(() => {
  const SCHEMA = 'text-collection/v1';
  const PATHS = { texts: 'projects/text/texts.jsonl', proposals: 'projects/text/proposals.jsonl', revisions: 'projects/text/revisions.jsonl' };
  const REVISION_FIELDS = ['from', 'to', 'repo', 'path', 'commit'];
  const SCOPE_WARNING = 'Retained proposals are prior work on the same string, not recommendations for this selection.';
  const loads = new Map();
  const authScopes = new Map();
  let nextAuthScope = 1;

  // The collection can contain private text. Share work for the same
  // credential without putting that credential in a cache key, and never let
  // two GH clients for different accounts receive one shared index.
  const authorizationOf = (gh) => {
    const headers = gh?.headers || {};
    if (typeof headers.get === 'function') return headers.get('authorization') || '';
    return headers.Authorization || headers.authorization || '';
  };
  const authScope = (authorization) => {
    if (!authorization) return 'anon';
    if (!authScopes.has(authorization)) authScopes.set(authorization, `auth-${nextAuthScope++}`);
    return authScopes.get(authorization);
  };

  // Python str.strip() follows Unicode White_Space and also treats four
  // information-separator controls as whitespace. JavaScript trim() includes
  // U+FEFF instead, so native trim would create different text identities at
  // those edges.
  const PY_EDGE = /^(?:\p{White_Space}|[\u001c-\u001f])+|(?:\p{White_Space}|[\u001c-\u001f])+$/gu;
  const edgeTrim = value => String(value ?? '').replace(PY_EDGE, '');

  const encoder = () => {
    const Encoder = window.TextEncoder || globalThis.TextEncoder;
    if (!Encoder) throw new Error('TextCollection requires TextEncoder');
    return new Encoder();
  };

  async function sha256(value) {
    const crypt = window.crypto?.subtle ? window.crypto : globalThis.crypto;
    if (!crypt?.subtle) throw new Error('TextCollection requires Web Crypto');
    const digest = await crypt.subtle.digest('SHA-256', encoder().encode(value));
    return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
  }

  // Python json.dumps(..., ensure_ascii=False, sort_keys=True) uses a space
  // after each comma and colon. Proposal ids hash that exact representation.
  function pythonJson(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return '[' + value.map(pythonJson).join(', ') + ']';
    if (typeof value === 'object') {
      return '{' + Object.keys(value).sort()
        .map(key => `${JSON.stringify(key)}: ${pythonJson(value[key])}`)
        .join(', ') + '}';
    }
    const out = JSON.stringify(value);
    if (out === undefined) throw new Error('TextCollection cannot hash undefined');
    return out;
  }

  const textId = text => sha256(edgeTrim(text));
  const proposalId = ({ from, to, author, purpose }) => sha256(pythonJson({ from, to, author, purpose }));

  function parseJsonl(text, path) {
    const rows = [];
    const lines = String(text ?? '').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      try { rows.push(JSON.parse(line)); }
      catch (error) { throw new Error(`${path} line ${i + 1} is not JSON: ${error.message}`); }
    }
    return rows;
  }

  function parseJson(text, path) {
    try { return JSON.parse(text); }
    catch (error) { throw new Error(`${path} is not JSON: ${error.message}`); }
  }

  const fileMeta = (meta = {}, path) => ({
    path, sha: String(meta.sha || ''), size: Number.isFinite(meta.size) ? meta.size : null, url: meta.url || '',
  });

  // ── Build ─────────────────────────────────────────────────────────────────
  // `files` carries the three JSONL texts under `texts`, `proposals`, and
  // `revisions`; `metadata` the contents-API facts for each.
  async function build({ files, metadata = {}, repo = '', ref = 'main' }) {
    for (const role of Object.keys(PATHS)) {
      if (typeof files?.[role] !== 'string') throw new Error(`TextCollection is missing ${role}: ${PATHS[role]}`);
    }
    const texts = {};
    for (const row of parseJsonl(files.texts, PATHS.texts)) {
      if (typeof row?.id !== 'string' || typeof row?.text !== 'string' || !row.text) {
        throw new Error(`${PATHS.texts} has a row without an id and a text`);
      }
      if (row.text !== edgeTrim(row.text)) throw new Error(`${PATHS.texts} text ${row.id} is not edge-trimmed`);
      if (await textId(row.text) !== row.id) throw new Error(`${PATHS.texts} text ${row.id} does not hash to its id`);
      if (row.id in texts) throw new Error(`${PATHS.texts} repeats text ${row.id}`);
      texts[row.id] = row.text;
    }
    const proposals = [];
    const seen = new Set();
    const byAuthor = {};
    const byPurpose = {};
    for (const row of parseJsonl(files.proposals, PATHS.proposals)) {
      const { from, to, author, purpose } = row || {};
      if (!(from in texts) || !(to in texts)) throw new Error(`${PATHS.proposals} names a text the collection does not hold`);
      if (from === to) throw new Error(`${PATHS.proposals} proposes a text as its own replacement`);
      if (typeof author !== 'string' || !author || typeof purpose !== 'string' || !purpose) {
        throw new Error(`${PATHS.proposals} has a proposal without an author or a purpose`);
      }
      const proposal = { id: await proposalId({ from, to, author, purpose }), from, to, author, purpose };
      if (seen.has(proposal.id)) throw new Error(`${PATHS.proposals} repeats proposal ${proposal.id}`);
      seen.add(proposal.id);
      proposals.push(proposal);
      byAuthor[author] = (byAuthor[author] || 0) + 1;
      byPurpose[purpose] = (byPurpose[purpose] || 0) + 1;
    }
    const revisions = [];
    const seenRevisions = new Set();
    for (const row of parseJsonl(files.revisions, PATHS.revisions)) {
      const revision = Object.fromEntries(REVISION_FIELDS.map(key => [key, row?.[key]]));
      if (REVISION_FIELDS.some(key => typeof revision[key] !== 'string' || !revision[key])) {
        throw new Error(`${PATHS.revisions} has a revision missing one of ${REVISION_FIELDS.join(', ')}`);
      }
      if (!(revision.from in texts) || !(revision.to in texts)) throw new Error(`${PATHS.revisions} names a text the collection does not hold`);
      if (revision.from === revision.to) throw new Error(`${PATHS.revisions} revises a text into itself`);
      const key = JSON.stringify(revision);
      if (seenRevisions.has(key)) throw new Error(`${PATHS.revisions} repeats a revision`);
      seenRevisions.add(key);
      revisions.push(revision);
    }
    return {
      schema: SCHEMA,
      repo,
      ref,
      sources: Object.fromEntries(Object.entries(PATHS).map(([role, path]) => [role, fileMeta(metadata[role], path)])),
      texts,
      proposals,
      revisions,
      summary: {
        texts: Object.keys(texts).length,
        proposals: proposals.length,
        revisions: revisions.length,
        by_author: byAuthor,
        by_purpose: byPurpose,
      },
    };
  }

  // ── Views ─────────────────────────────────────────────────────────────────
  function view(index, proposalOrId) {
    const proposal = typeof proposalOrId === 'string'
      ? index.proposals.find(row => row.id === proposalOrId)
      : proposalOrId;
    if (!proposal?.id) return null;
    return {
      id: proposal.id,
      from: { text_id: proposal.from, text: index.texts[proposal.from] },
      to: { text_id: proposal.to, text: index.texts[proposal.to] },
      author: proposal.author,
      purpose: proposal.purpose,
    };
  }

  // Exact: the edge-trimmed selection equals a proposal's text. Not semantic,
  // and not containment: a proposal shown against text it was not written for
  // is worse than one not shown.
  function lookup(index, value) {
    const text = edgeTrim(value);
    if (!text) throw new Error('The selection is empty after edge trimming');
    const exact = index.proposals.filter(row => index.texts[row.from] === text).map(row => view(index, row));
    return { selection: { text }, exact, warnings: exact.length ? [SCOPE_WARNING] : [] };
  }

  // The history of a text, newest first: each step is a text, the revision
  // that turned it into the step above (null on the first step, the text asked
  // about), the proposals made against it, and any other revisions that also
  // led into it. Follows revisions.jsonl backwards by id; where
  // several revisions lead into one text, the first in file order is followed
  // and the rest are listed on the step. Bounded and cycle-safe.
  function chain(index, textId, { limit = 20 } = {}) {
    const into = new Map();
    for (const revision of index.revisions || []) {
      if (!into.has(revision.to)) into.set(revision.to, []);
      into.get(revision.to).push(revision);
    }
    const steps = [];
    const seen = new Set();
    let id = textId;
    let by = null;
    while (id && id in index.texts && !seen.has(id) && steps.length < limit) {
      seen.add(id);
      const arrivals = into.get(id) || [];
      steps.push({
        text_id: id,
        text: index.texts[id],
        revision: by,
        proposals: index.proposals.filter(row => row.from === id).map(row => view(index, row)),
        also_from: arrivals.slice(1),
      });
      by = arrivals[0] || null;
      id = by ? by.from : null;
    }
    return steps;
  }

  function search(index, { q = '', author = '', purpose = '' } = {}) {
    const query = edgeTrim(q).toLowerCase();
    return index.proposals.map(row => view(index, row)).filter(row => {
      if (author && row.author !== author) return false;
      if (purpose && row.purpose !== purpose) return false;
      if (!query) return true;
      return `${row.from.text}\n${row.to.text}\n${row.author}\n${row.purpose}`.toLowerCase().includes(query);
    });
  }

  // ── Load ──────────────────────────────────────────────────────────────────
  // Quiet and interactive reads cannot share one promise. gh-auth attaches its
  // page-level token prompt outside GH's request promise, so a FAB background
  // read must never inherit the takeover behavior of a simultaneous viewer read.
  const loadKey = (gh, quiet = false) =>
    `${authScope(authorizationOf(gh))}:${gh?.repo || ''}@${gh?.ref || 'main'}:${quiet ? 'quiet' : 'interactive'}`;

  async function load(gh, { fresh = false, quiet = false } = {}) {
    if (!gh || typeof gh.get !== 'function') throw new Error('TextCollection.load requires a GH client');
    const key = loadKey(gh, quiet);
    const held = loads.get(key);
    if (fresh) loads.delete(key);
    else if (held) {
      // A rejection is HELD, not dropped. The FAB re-reads on every scan, so
      // deleting it meant a fresh failing request per selection change, which
      // spends the anonymous rate limit on a page a reader leaves open. It is
      // held only for FAIL_MS, so the three ways access can change all recover
      // without a reload: a different credential is a different cache key
      // already, a permission grant on the same token expires with the entry,
      // and so does the file landing on the branch this reads.
      if (!held.failedAt || Date.now() - held.failedAt < api.FAIL_MS) return held.promise;
      loads.delete(key);
    }
    const readOptions = {
      ...(fresh ? (window.GH?.FRESH || { cache: 'no-store' }) : {}),
      ...(quiet ? { quiet: true } : {}),
    };
    // A failed read cannot tell the reader WHY. A 404 on a private repository
    // is missing access, a missing path, or a file that has not landed on the
    // ref being read. So name the state and the status, and let the cause stay
    // on the error for anyone debugging. The kit's own validation errors are
    // never swallowed: those name a real problem in the data.
    const unavailable = (error) => {
      const status = Number.isFinite(error?.status) ? error.status : null;
      const wrapped = new Error('The Text collection is unavailable'
        + (status ? ` (the read returned ${status}).` : '.'));
      if (status) wrapped.status = status;
      wrapped.cause = error;
      return wrapped;
    };
    const promise = (async () => {
      const read = (path) => gh.get(path, readOptions).catch(error => { throw unavailable(error); });
      const roles = Object.keys(PATHS);
      const results = await Promise.all(roles.map(role => read(PATHS[role])));
      return build({
        files: Object.fromEntries(roles.map((role, i) => [role, results[i].text])),
        metadata: Object.fromEntries(roles.map((role, i) => [role, results[i]])),
        repo: gh.repo || '',
        ref: gh.ref || 'main',
      });
    })();
    const entry = { promise, failedAt: 0 };
    loads.set(key, entry);
    try { return await promise; }
    catch (error) {
      if (loads.get(key) === entry) entry.failedAt = Date.now();
      throw error;
    }
  }

  function clear(gh = null) {
    if (!gh) {
      loads.clear();
      authScopes.clear();
    }
    else {
      loads.delete(loadKey(gh, false));
      loads.delete(loadKey(gh, true));
    }
  }

  const api = {
    SCHEMA,
    PATHS,
    SCOPE_WARNING,
    // How long a failed read is remembered, mirroring GH.MEMO_MS: the same
    // minute GitHub's own Cache-Control grants a successful read, applied to a
    // failed one. Settable, like GH.MEMO_MS, so a test need not wait it out.
    FAIL_MS: 60_000,
    load,
    build,
    view,
    lookup,
    search,
    chain,
    clear,
    textId,
    proposalId,
    edgeTrim,
  };
  window.TextCollection = api;
})();
