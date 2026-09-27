// kits/text-collection.js: the shared Text collection, read in the browser.
//
// The collection is committed JSONL in mehrlander/home, projects/text/, and it
// holds two concepts over one set of passages:
//
//   passages.jsonl   one line per distinct passage {id, text}.
//   variants.jsonl   one line per alternative wording {from, to, author,
//                    purpose}. A variant names no target and carries no
//                    endorsement; it asks nothing.
//   proposals.jsonl  one line per variant put forward for a named file
//                    {from, to, repo, path, basis}: the same passage pair as
//                    a variant, the repo (owner/name) and repo-relative path
//                    it is proposed for, and a basis URL. A proposal asks for
//                    a yes or no: its author would make the change now. The
//                    common case is a correction, whose basis is the PR or
//                    commit that made the old text wrong.
//
// from and to are passage ids everywhere. This kit reads the files as they
// are. Nothing is assembled from run inputs, and a document is matched by its
// text. A passage's history is not in the collection: kits/md-history.js reads
// it from git and consults this kit only for the variants of each earlier
// text. (A third file, revisions.jsonl, carried eight git-derived edges from
// 2026-09-22 until the same day's History rebuild retired it.)
//
//   TextCollection.load(gh, { fresh, quiet })           -> index
//   TextCollection.view(index, idOrVariant)             -> { id, from, to, author, purpose, proposals }
//   TextCollection.lookup(index, text)                  -> { selection, exact, warnings }
//   TextCollection.search(index, { q, author, purpose })-> [view]
//
// A passage id is the sha256 of the edge-trimmed UTF-8 bytes (edge-trim-v1,
// the same rule as collection.passage_id), and load checks every id against
// its text. A variant id is the sha256 of the Python json.dumps of {from, to,
// author, purpose} with sorted keys, computed here since the file does not
// carry it; it is what a Text Lab address names. It is the hash proposal ids
// were before the 2026-09-27 rename, so every earlier address still resolves.
//
// READ-ONLY. A retained variant is prior work on the same literal string, not
// a recommendation for the occurrence on screen, and no surface applies one.
// A proposal is the one row that names a file, and no surface applies that
// either.
(() => {
  const SCHEMA = 'text-collection/v1';
  const PATHS = {
    passages: 'projects/text/passages.jsonl',
    variants: 'projects/text/variants.jsonl',
    proposals: 'projects/text/proposals.jsonl',
  };
  const SCOPE_WARNING = 'Retained variants are prior work on the same string, not recommendations for this selection.';
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
  // after each comma and colon. Variant ids hash that exact representation.
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

  const passageId = text => sha256(edgeTrim(text));
  const variantId = ({ from, to, author, purpose }) => sha256(pythonJson({ from, to, author, purpose }));

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
  // `files` carries the JSONL texts under `passages`, `variants` and
  // `proposals`; `metadata` the contents-API facts for each. Proposals may be
  // absent, which reads as none: the file is newer than the other two.
  async function build({ files, metadata = {}, repo = '', ref = 'main', warnings: carried = [] }) {
    const warnings = [...carried];
    for (const role of ['passages', 'variants']) {
      if (typeof files?.[role] !== 'string') throw new Error(`TextCollection is missing ${role}: ${PATHS[role]}`);
    }
    const passages = {};
    for (const row of parseJsonl(files.passages, PATHS.passages)) {
      if (typeof row?.id !== 'string' || typeof row?.text !== 'string' || !row.text) {
        throw new Error(`${PATHS.passages} has a row without an id and a text`);
      }
      if (row.text !== edgeTrim(row.text)) throw new Error(`${PATHS.passages} passage ${row.id} is not edge-trimmed`);
      if (await passageId(row.text) !== row.id) throw new Error(`${PATHS.passages} passage ${row.id} does not hash to its id`);
      if (row.id in passages) throw new Error(`${PATHS.passages} repeats passage ${row.id}`);
      passages[row.id] = row.text;
    }
    const variantPath = metadata.variants?.path || PATHS.variants;
    const variants = [];
    const seen = new Set();
    const byAuthor = {};
    const byPurpose = {};
    for (const row of parseJsonl(files.variants, variantPath)) {
      const { from, to, author, purpose } = row || {};
      if (!(from in passages) || !(to in passages)) throw new Error(`${variantPath} names a passage the collection does not hold`);
      if (from === to) throw new Error(`${variantPath} offers a passage as its own variant`);
      if (typeof author !== 'string' || !author || typeof purpose !== 'string' || !purpose) {
        throw new Error(`${variantPath} has a variant without an author or a purpose`);
      }
      const variant = { id: await variantId({ from, to, author, purpose }), from, to, author, purpose };
      if (seen.has(variant.id)) throw new Error(`${variantPath} repeats variant ${variant.id}`);
      seen.add(variant.id);
      variants.push(variant);
      byAuthor[author] = (byAuthor[author] || 0) + 1;
      byPurpose[purpose] = (byPurpose[purpose] || 0) + 1;
    }
    // Proposals are the newest file and the least of the three, so a bad row
    // is skipped and named in `warnings` rather than blanking every variant
    // surface: a reader loses that proposal, not the collection.
    const proposals = [];
    const seenProposals = new Set();
    const skip = (why) => warnings.push(`${PATHS.proposals}: ${why}; the row was skipped`);
    let proposalRows = [];
    try { proposalRows = parseJsonl(files.proposals ?? '', PATHS.proposals); }
    catch (error) { warnings.push(`${error.message}; no proposals were read`); }
    for (const row of proposalRows) {
      const { from, to, repo: target, path, basis } = row || {};
      if (![from, to, target, path, basis].every(value => typeof value === 'string' && value)) {
        skip('a proposal without a from, to, repo, path and basis'); continue;
      }
      if (!(from in passages) || !(to in passages)) { skip('a proposal names a passage the collection does not hold'); continue; }
      const key = pythonJson({ from, to, repo: target, path, basis });
      if (seenProposals.has(key)) { skip(`a repeated proposal for ${target}:${path}`); continue; }
      seenProposals.add(key);
      proposals.push({ from, to, repo: target, path, basis });
    }
    return {
      schema: SCHEMA,
      repo,
      ref,
      sources: Object.fromEntries(Object.keys(PATHS).map(role =>
        [role, fileMeta(metadata[role], metadata[role]?.path || PATHS[role])])),
      passages,
      variants,
      proposals,
      warnings,
      summary: {
        passages: Object.keys(passages).length,
        variants: variants.length,
        proposals: proposals.length,
        by_author: byAuthor,
        by_purpose: byPurpose,
      },
    };
  }

  // ── Views ─────────────────────────────────────────────────────────────────
  // The proposals for one passage pair, keyed once per index and held weakly,
  // since search maps every variant through view().
  const pairs = new WeakMap();
  function proposalsFor(index, from, to) {
    let m = pairs.get(index);
    if (!m) {
      m = new Map();
      for (const p of index.proposals || []) {
        const key = `${p.from}\n${p.to}`;
        if (!m.has(key)) m.set(key, []);
        m.get(key).push({ repo: p.repo, path: p.path, basis: p.basis });
      }
      pairs.set(index, m);
    }
    return m.get(`${from}\n${to}`) || [];
  }

  function view(index, variantOrId) {
    const variant = typeof variantOrId === 'string'
      ? index.variants.find(row => row.id === variantOrId)
      : variantOrId;
    if (!variant?.id) return null;
    return {
      id: variant.id,
      from: { passage_id: variant.from, text: index.passages[variant.from] },
      to: { passage_id: variant.to, text: index.passages[variant.to] },
      author: variant.author,
      purpose: variant.purpose,
      proposals: proposalsFor(index, variant.from, variant.to),
    };
  }

  // Exact: the edge-trimmed selection equals a variant's text. Not semantic,
  // and not containment: a variant shown against text it was not written for
  // is worse than one not shown.
  function lookup(index, value) {
    const text = edgeTrim(value);
    if (!text) throw new Error('The selection is empty after edge trimming');
    const exact = index.variants.filter(row => index.passages[row.from] === text).map(row => view(index, row));
    return { selection: { text }, exact, warnings: exact.length ? [SCOPE_WARNING] : [] };
  }

  function search(index, { q = '', author = '', purpose = '' } = {}) {
    const query = edgeTrim(q).toLowerCase();
    return index.variants.map(row => view(index, row)).filter(row => {
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
      // Proposals are read softly: any failure there, 404 or otherwise, leaves
      // the collection readable with no proposals, and only a non-404 is worth
      // a warning.
      const soft = (path) => read(path).then(file => ({ file }), error => ({ error }));
      const [passages, variants, proposalRead] = await Promise.all([
        read(PATHS.passages), read(PATHS.variants), soft(PATHS.proposals),
      ]);
      const proposals = proposalRead.file || null;
      const files = { passages: passages.text, variants: variants.text };
      const metadata = { passages, variants };
      const warnings = [];
      if (proposals) { files.proposals = proposals.text; metadata.proposals = proposals; }
      else if (proposalRead.error?.status !== 404) {
        warnings.push(`${PATHS.proposals} could not be read (${proposalRead.error?.message || 'unknown error'}); no proposals are shown`);
      }
      return build({ files, metadata, repo: gh.repo || '', ref: gh.ref || 'main', warnings });
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
    clear,
    passageId,
    variantId,
    edgeTrim,
  };
  window.TextCollection = api;
})();
