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
//   reviews.jsonl    one line per review {from, to, by, at, vote?, note?}: a
//                    reader's vote on a variant ('up', 'down', or '' to take
//                    one back) and a comment, either or both. Append-only; a
//                    reader's latest vote on a pair is the one that counts,
//                    and every note is kept. Read into index.reviews; absent
//                    reads as none. Written by Text Lab, one line per act.
//   occurrences.json a snapshot of where each variant's original stands in the
//                    estate's Markdown: {commits: {repo: sha}, at: {passage id:
//                    ["owner/name:path", ...]}}, written by home's
//                    tools/occurrences.py. Read into index.occurrences and
//                    onto each view as `at`; absent reads as unknown.
//   purposes.csv     one row per purpose word {purpose, kind, prompt, gloss}:
//                    what the word means, and the exact instruction it stands
//                    for when one was recorded. Read into index.purposes,
//                    keyed by word; absent reads as no definitions.
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
    purposes: 'projects/text/purposes.csv',
    reviews: 'projects/text/reviews.jsonl',
    occurrences: 'projects/text/occurrences.json',
  };
  const PURPOSE_COLUMNS = ['purpose', 'kind', 'prompt', 'gloss'];
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

  // RFC 4180 as Python's csv module writes it: quoted fields may hold commas,
  // doubled quotes and newlines.
  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    const s = String(text ?? '');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (quoted) {
        if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') quoted = false;
        else field += c;
      }
      else if (c === '"') quoted = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && s[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(v => v !== '')) rows.push(row);
        row = [];
      }
      else field += c;
    }
    row.push(field);
    if (row.some(v => v !== '')) rows.push(row);
    return rows;
  }

  // Definitions are advisory, so a bad file or row costs its definitions and
  // a warning, never the collection.
  function parsePurposes(text, warnings) {
    const [header, ...rows] = parseCsv(text);
    if (!header || PURPOSE_COLUMNS.some((col, i) => header[i] !== col)) {
      warnings.push(`${PATHS.purposes}: the header is not ${PURPOSE_COLUMNS.join(',')}; no definitions are shown`);
      return {};
    }
    const out = {};
    for (const cells of rows) {
      const [purpose, kind = '', prompt = '', gloss = ''] = cells;
      if (!purpose || /\s/.test(purpose) || purpose in out) {
        warnings.push(`${PATHS.purposes}: a row without a single-word purpose, or a repeated one; the row was skipped`);
        continue;
      }
      out[purpose] = { kind, prompt, gloss };
    }
    return out;
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
    const purposes = typeof files.purposes === 'string' ? parsePurposes(files.purposes, warnings) : {};
    // Reviews are read like proposals: a bad row is skipped and named, and a
    // review of a pair no variant holds is skipped, since it has nothing to
    // be shown on.
    const reviews = [];
    const variantPairs = new Set(variants.map(v => `${v.from}\n${v.to}`));
    let reviewRows = [];
    try { reviewRows = parseJsonl(files.reviews ?? '', PATHS.reviews); }
    catch (error) { warnings.push(`${error.message}; no reviews were read`); }
    for (const row of reviewRows) {
      const { from, to, by, at, vote, note } = row || {};
      const skipReview = (why) => warnings.push(`${PATHS.reviews}: ${why}; the row was skipped`);
      if (![from, to, by, at].every(value => typeof value === 'string' && value)) { skipReview('a review without a from, to, by and at'); continue; }
      if (vote !== undefined && !['up', 'down', ''].includes(vote)) { skipReview(`a vote that is not up, down or empty`); continue; }
      if (note !== undefined && typeof note !== 'string') { skipReview('a note that is not text'); continue; }
      if (vote === undefined && !note) { skipReview('a review with neither a vote nor a note'); continue; }
      if (!variantPairs.has(`${from}\n${to}`)) { skipReview('a review of a pair no variant holds'); continue; }
      reviews.push({ from, to, by, at, ...(vote !== undefined ? { vote } : {}), ...(note ? { note } : {}) });
    }
    // Occurrences are a snapshot another tool writes, read softly: a file that
    // does not parse leaves every variant without an `at` and says so.
    let occurrences = null, occurrenceCommits = {};
    if (typeof files.occurrences === 'string') {
      try {
        const snap = JSON.parse(files.occurrences);
        occurrences = snap && typeof snap.at === 'object' ? snap.at : {};
        occurrenceCommits = snap?.commits || {};
      } catch (error) { warnings.push(`${PATHS.occurrences} is not JSON; no occurrences are shown`); }
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
      purposes,
      reviews,
      occurrences,
      occurrenceCommits,
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

  // One pair's reviews: who stands up and who down (each reader's latest vote),
  // and every note, oldest first. Keyed once per index, and rebuilt when
  // addReview appends.
  const reviewTables = new WeakMap();
  function reviewsFor(index, from, to) {
    let m = reviewTables.get(index);
    if (!m) {
      m = new Map();
      for (const r of index.reviews || []) {
        const key = `${r.from}\n${r.to}`;
        if (!m.has(key)) m.set(key, { votes: new Map(), notes: [] });
        const t = m.get(key);
        if (r.vote !== undefined) t.votes.set(r.by, r.vote);
        if (r.note) t.notes.push({ by: r.by, at: r.at, note: r.note });
      }
      reviewTables.set(index, m);
    }
    const t = m.get(`${from}\n${to}`) || { votes: new Map(), notes: [] };
    const who = (dir) => [...t.votes].filter(([, v]) => v === dir).map(([by]) => by);
    return { up: who('up'), down: who('down'), notes: t.notes, voteOf: (by) => t.votes.get(by) || '' };
  }

  // A review the page has just written, applied to the loaded index so the
  // counts move without a reload.
  function addReview(index, row) {
    (index.reviews ||= []).push(row);
    reviewTables.delete(index);
  }

  // One line of reviews.jsonl, keys in the order Python's json.dumps(sort_keys)
  // would write them, so a file written by either reads the same.
  function reviewLine(row) {
    return pythonJson(row);
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
      // Where the original stood when home last scanned: a list of
      // "owner/name:path", empty when it was not found, null when unknown.
      at: index.occurrences ? (index.occurrences[variant.from] || []) : null,
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
    `${authScope(authorizationOf(gh))}:${gh?.repo || ''}@${refOf(gh)}:${quiet ? 'quiet' : 'interactive'}`;
  // The ref the client reads at: a client with no named ref follows the selection.
  const refOf = (gh) => (typeof gh?.readRef === 'function' ? gh.readRef() : '') || gh?.ref || 'main';

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
      const [passages, variants, proposalRead, purposeRead, reviewRead, occurrenceRead] = await Promise.all([
        read(PATHS.passages), read(PATHS.variants), soft(PATHS.proposals), soft(PATHS.purposes),
        soft(PATHS.reviews), soft(PATHS.occurrences),
      ]);
      const proposals = proposalRead.file || null;
      const files = { passages: passages.text, variants: variants.text };
      const metadata = { passages, variants };
      const warnings = [];
      if (proposals) { files.proposals = proposals.text; metadata.proposals = proposals; }
      else if (proposalRead.error?.status !== 404) {
        warnings.push(`${PATHS.proposals} could not be read (${proposalRead.error?.message || 'unknown error'}); no proposals are shown`);
      }
      // Purposes are read the same soft way, and for the same reason.
      if (purposeRead.file) { files.purposes = purposeRead.file.text; metadata.purposes = purposeRead.file; }
      else if (purposeRead.error?.status !== 404) {
        warnings.push(`${PATHS.purposes} could not be read (${purposeRead.error?.message || 'unknown error'}); no definitions are shown`);
      }
      if (reviewRead.file) { files.reviews = reviewRead.file.text; metadata.reviews = reviewRead.file; }
      else if (reviewRead.error?.status !== 404) {
        warnings.push(`${PATHS.reviews} could not be read (${reviewRead.error?.message || 'unknown error'}); no reviews are shown`);
      }
      if (occurrenceRead.file) { files.occurrences = occurrenceRead.file.text; metadata.occurrences = occurrenceRead.file; }
      else if (occurrenceRead.error?.status !== 404) {
        warnings.push(`${PATHS.occurrences} could not be read (${occurrenceRead.error?.message || 'unknown error'}); no occurrences are shown`);
      }
      return build({ files, metadata, repo: gh.repo || '', ref: refOf(gh), warnings });
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
    reviewsFor,
    addReview,
    reviewLine,
    lookup,
    search,
    clear,
    passageId,
    variantId,
    edgeTrim,
  };
  window.TextCollection = api;
})();
