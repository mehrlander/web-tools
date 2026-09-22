// kits/text-proposals.js: the shared Text collection, read in the browser.
//
// The collection is two committed files in mehrlander/home, named by
// projects/text/current-sources.json: texts.jsonl, one line per distinct
// string {id, text}, and proposals.jsonl, one line per proposed edit
// {from, to, author, purpose}, where from and to are text ids and purpose is
// one short word. This kit reads them as they are. Nothing is assembled from
// run inputs, and nothing here says where a text was seen or which run
// produced a proposal; a document is matched by its text.
//
//   TextProposals.load(gh, { specPath, fresh, quiet })  -> index
//   TextProposals.view(index, idOrProposal)             -> { id, from, to, author, purpose }
//   TextProposals.lookup(index, text, { contained })    -> { selection, exact, contained, warnings }
//   TextProposals.search(index, { q, author, purpose }) -> [view]
//
// A text id is the sha256 of the edge-trimmed UTF-8 bytes (edge-trim-v1, the
// same rule as text_store.text_id), and load checks every id against its text.
// A proposal id is the sha256 of the Python json.dumps of {from, to, author,
// purpose} with sorted keys, the formula text_store.propose uses, computed here
// since the file does not carry it.
//
// READ-ONLY. A retained proposal is prior work on the same literal string, not
// a recommendation for the occurrence on screen, and no surface applies one.
(() => {
  const SCHEMA = 'text-browser-proposals/v2';
  const SOURCE_SCHEMA = 'text-current-sources/v2';
  const DEFAULT_SPEC = 'projects/text/current-sources.json';
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
    if (!Encoder) throw new Error('TextProposals requires TextEncoder');
    return new Encoder();
  };

  async function sha256(value) {
    const crypt = window.crypto?.subtle ? window.crypto : globalThis.crypto;
    if (!crypt?.subtle) throw new Error('TextProposals requires Web Crypto');
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
    if (out === undefined) throw new Error('TextProposals cannot hash undefined');
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
  // `files` carries the two JSONL texts under `texts` and `proposals`;
  // `metadata` the contents-API facts for each, plus `spec`.
  async function build({ spec, files, metadata = {}, repo = '', ref = 'main', specPath = DEFAULT_SPEC }) {
    if (spec?.schema !== SOURCE_SCHEMA) {
      throw new Error(`Unsupported text source schema: ${spec?.schema || '(missing)'}`);
    }
    for (const role of ['texts', 'proposals']) {
      if (typeof spec[role] !== 'string' || !spec[role]) throw new Error(`Text source specification is missing ${role}`);
      if (typeof files?.[role] !== 'string') throw new Error(`TextProposals is missing ${role}: ${spec[role]}`);
    }
    const texts = {};
    for (const row of parseJsonl(files.texts, spec.texts)) {
      if (typeof row?.id !== 'string' || typeof row?.text !== 'string' || !row.text) {
        throw new Error(`${spec.texts} has a row without an id and a text`);
      }
      if (row.text !== edgeTrim(row.text)) throw new Error(`${spec.texts} text ${row.id} is not edge-trimmed`);
      if (await textId(row.text) !== row.id) throw new Error(`${spec.texts} text ${row.id} does not hash to its id`);
      if (row.id in texts) throw new Error(`${spec.texts} repeats text ${row.id}`);
      texts[row.id] = row.text;
    }
    const proposals = [];
    const seen = new Set();
    const byAuthor = {};
    const byPurpose = {};
    for (const row of parseJsonl(files.proposals, spec.proposals)) {
      const { from, to, author, purpose } = row || {};
      if (!(from in texts) || !(to in texts)) throw new Error(`${spec.proposals} names a text the collection does not hold`);
      if (from === to) throw new Error(`${spec.proposals} proposes a text as its own replacement`);
      if (typeof author !== 'string' || !author || typeof purpose !== 'string' || !purpose) {
        throw new Error(`${spec.proposals} has a proposal without an author or a purpose`);
      }
      const proposal = { id: await proposalId({ from, to, author, purpose }), from, to, author, purpose };
      if (seen.has(proposal.id)) throw new Error(`${spec.proposals} repeats proposal ${proposal.id}`);
      seen.add(proposal.id);
      proposals.push(proposal);
      byAuthor[author] = (byAuthor[author] || 0) + 1;
      byPurpose[purpose] = (byPurpose[purpose] || 0) + 1;
    }
    return {
      schema: SCHEMA,
      repo,
      ref,
      spec: fileMeta(metadata.spec, specPath),
      sources: {
        texts: fileMeta(metadata.texts, spec.texts),
        proposals: fileMeta(metadata.proposals, spec.proposals),
      },
      texts,
      proposals,
      summary: {
        texts: Object.keys(texts).length,
        proposals: proposals.length,
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

  const WORD = /[\p{L}\p{N}_]/u;
  const word = char => !!char && WORD.test(char);

  function spansIn(haystack, needle) {
    const spans = [];
    if (!needle || needle.length > haystack.length) return spans;
    let at = haystack.indexOf(needle);
    while (at !== -1) {
      const end = at + needle.length;
      const leftOk = !word(needle[0]) || !word(haystack[at - 1]);
      const rightOk = !word(needle[needle.length - 1]) || !word(haystack[end]);
      // An ACCEPTED span consumes its own length, so two reported occurrences
      // never overlap. A REJECTED one must only advance by a character: it was
      // rejected for its neighbours, not its content, and skipping a needle's
      // length past it loses a real match that starts inside it. Probe: `a-a`
      // in `xa-a-a` found nothing, where [3,6] is a valid span.
      if (leftOk && rightOk) { spans.push([at, end]); at = haystack.indexOf(needle, end); }
      else at = haystack.indexOf(needle, at + 1);
    }
    return spans;
  }

  // Exact is edge-trimmed equality with a proposal's text. Contained is the
  // same string inside a larger selection, on token boundaries, so `families`
  // is not reported inside `nonfamilies`. Neither is semantic.
  function lookup(index, value, { contained = false } = {}) {
    const text = edgeTrim(value);
    if (!text) throw new Error('The selection is empty after edge trimming');
    const exactRows = index.proposals.filter(row => index.texts[row.from] === text);
    const exactIds = new Set(exactRows.map(row => row.id));
    const exact = exactRows.map(row => view(index, row));
    const within = [];
    if (contained) {
      for (let order = 0; order < index.proposals.length; order++) {
        const proposal = index.proposals[order];
        if (exactIds.has(proposal.id)) continue;
        const needle = index.texts[proposal.from];
        if (!needle || needle.length > text.length) continue;
        const spans = spansIn(text, needle);
        if (spans.length) within.push({ proposal, spans, order, length: needle.length });
      }
      within.sort((a, b) => b.length - a.length || a.order - b.order);
    }
    const containedViews = within.map(row => ({ ...view(index, row.proposal), spans: row.spans }));
    return {
      selection: { text },
      exact,
      contained: containedViews,
      warnings: exact.length || containedViews.length ? [SCOPE_WARNING] : [],
    };
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
  const loadKey = (gh, specPath, quiet = false) =>
    `${authScope(authorizationOf(gh))}:${gh?.repo || ''}@${gh?.ref || 'main'}:${specPath}:${quiet ? 'quiet' : 'interactive'}`;

  async function load(gh, { specPath = DEFAULT_SPEC, fresh = false, quiet = false } = {}) {
    if (!gh || typeof gh.get !== 'function') throw new Error('TextProposals.load requires a GH client');
    const key = loadKey(gh, specPath, quiet);
    const held = loads.get(key);
    if (fresh) loads.delete(key);
    else if (held) {
      // A rejection is HELD, not dropped. The FAB re-reads on every scan, so
      // deleting it meant a fresh failing request per selection change, which
      // spends the anonymous rate limit on a page a reader leaves open. It is
      // held only for FAIL_MS, so the three ways access can change all recover
      // without a reload: a different credential is a different cache key
      // already, a permission grant on the same token expires with the entry,
      // and so does the source landing on the branch this reads.
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
      const wrapped = new Error('Retained proposals are unavailable'
        + (status ? ` (the collection read returned ${status}).` : '.'));
      if (status) wrapped.status = status;
      wrapped.cause = error;
      return wrapped;
    };
    const promise = (async () => {
      const read = (path) => gh.get(path, readOptions).catch(error => { throw unavailable(error); });
      const specResult = await read(specPath);
      const spec = parseJson(specResult.text, specPath);
      if (spec?.schema !== SOURCE_SCHEMA) {
        throw new Error(`Unsupported text source schema: ${spec?.schema || '(missing)'}`);
      }
      for (const role of ['texts', 'proposals']) {
        if (typeof spec[role] !== 'string' || !spec[role]) throw new Error(`Text source specification is missing ${role}`);
      }
      const [texts, proposals] = await Promise.all([read(spec.texts), read(spec.proposals)]);
      return build({
        spec,
        files: { texts: texts.text, proposals: proposals.text },
        metadata: { spec: specResult, texts, proposals },
        repo: gh.repo || '',
        ref: gh.ref || 'main',
        specPath,
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

  function clear(gh = null, { specPath = DEFAULT_SPEC } = {}) {
    if (!gh) {
      loads.clear();
      authScopes.clear();
    }
    else {
      loads.delete(loadKey(gh, specPath, false));
      loads.delete(loadKey(gh, specPath, true));
    }
  }

  const api = {
    SCHEMA,
    SOURCE_SCHEMA,
    DEFAULT_SPEC,
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
    clear,
    textId,
    proposalId,
    edgeTrim,
  };
  window.TextProposals = api;
})();
