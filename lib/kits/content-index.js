// kits/content-index.js — a word index over the estate's Markdown, so the
// Search view's Contents mode answers inside the app.
//
// WHY AN INDEX. A page cannot read GitHub's code-search API: an authenticated
// search comes back without the Access-Control-Allow-Origin header (measured
// 2026-11-09: a 200 and a 422 both lacked it, while the same endpoint's 401
// and every other endpoint the app calls carried it), so the browser withholds
// every answer. Contents is therefore answered here, from files the crawl
// writes into the registry, the way the Sessions lane is.
//
// WHAT IT REUSES. The words and the search are kits/session-index.js's, unchanged:
// its tokenizer (compounds kept whole and split, so `estate-search.js` and
// `estate` both find a file), its shard encoding, and its substring scan over
// the dictionary. A document id here is a file path, so a repo's shards are
// searched on their own and their hits carry the repo. Measured 2026-11-09 over
// web-tools, web-tools-private and home: 305 queries, none returned fewer
// files than a full text scan, 29 ms a query.
//
// WHAT IT COVERS. Markdown only, at each repo's default branch, listed by the
// documents index (kits/doc-index.js, state/docs.json), whose rows carry each
// file's blob. Two repos are left out on purpose, in SKIP below.
//
// THE FILES. state/content-index.json is the manifest: per repo, the tip it was
// read at, the shards, and how many files are still pending. Each shard is
// state/content-index/<owner>.<name>.<k>.json, a session-index shard plus
// `blobs`, the twelve-character blob of each doc, which is what makes the next
// pass incremental. A repo is split across ceil(docs / BUCKET_DOCS) shards by
// a hash of the path: home's Markdown is a 6.3 MB index whole and four shards
// of at most 2 MB, so a merge there rewrites one quarter of it, for about 0.5
// MB more in total.
//
// THE PASS. A file whose blob matches its shard entry keeps its terms. Others
// are read through the API, at most FETCH_CAP per repo per pass; a file past
// the cap keeps its old terms, if any, and counts as pending, so the next pass
// picks it up. A first build from nothing therefore fills over several passes,
// unless node/doc-index-seed.mjs --content seeds it from local clones.
//
// Pure builders plus one network function, like doc-index.js beside it.
// Needs window.SessionIndex. Attaches to window.ContentIndex, loaded via
// gh.load('kits/content-index.js').
(() => {
  const MANIFEST = 'state/content-index.json';
  const SHARD_DIR = 'state/content-index';
  const BUCKET_DOCS = 1000;
  const FETCH_CAP = 300;
  // Repos the index leaves out, each with its reason.
  const SKIP = {
    'mehrlander/chat-histories': 'its chat snapshots are the Chats lane\'s, searched by summary',
    'mehrlander/fn-data': 'about two thirds of the estate\'s Markdown words; left out until the index is measured',
  };
  const X = () => window.SessionIndex;

  const fnv = (s) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  };
  const bucketsFor = (docs) => Math.max(1, Math.ceil(docs / BUCKET_DOCS));
  const bucketOf = (path, n) => fnv(path) % n;
  const shardPath = (repo, k) => SHARD_DIR + '/' + String(repo).replace('/', '.') + '.' + k + '.json';

  // { path: { blob, terms } } -> one shard. Byte-deterministic for the same
  // input, since the commit is skipped when a shard's bytes did not move.
  function buildShard(entries) {
    const s = X().buildShard(Object.fromEntries(Object.entries(entries || {}).map(([p, e]) => [p, e.terms])));
    s.blobs = s.docs.map(p => entries[p].blob || '');
    return s;
  }
  // A shard back to { path: { blob, terms } }.
  function readShard(shard) {
    const byId = X().readShard(shard);
    const out = {};
    (shard?.docs || []).forEach((p, i) => { out[p] = { blob: shard.blobs?.[i] || '', terms: byId[p] }; });
    return out;
  }
  // Every entry, split into this many shards: [{ path, doc }].
  function split(repo, entries) {
    const n = bucketsFor(Object.keys(entries).length);
    const parts = Array.from({ length: n }, () => ({}));
    for (const [p, e] of Object.entries(entries)) parts[bucketOf(p, n)][p] = e;
    return parts.map((part, k) => ({ path: shardPath(repo, k), doc: buildShard(part) }));
  }

  /**
   * One repo's pass. `docEntry` is the repo's entry in state/docs.json, `prev`
   * its manifest entry, and `read(path)` resolves a shard the registry holds
   * (or null). Returns { sha, docs, pending, shards: [{ path, doc }], calls },
   * or the manifest entry marked `carried` when nothing can have moved, or
   * null for a skipped or unlisted repo.
   */
  async function crawlRepo(repo, docEntry, { makeGH, prev = null, read, fetchCap = FETCH_CAP } = {}) {
    if (SKIP[repo] || !docEntry?.sha) return null;
    if (prev?.sha === docEntry.sha && !prev.pending) return { ...prev, carried: true };
    const old = {};
    for (const p of prev?.shards || []) Object.assign(old, readShard(await read(p)));
    const gh = makeGH(repo);
    const entries = {};
    let fetched = 0, pending = 0, calls = 0;
    for (const d of window.DocIndex.rows(docEntry)) {
      const o = old[d.path];
      if (o && o.blob === d.blob) { entries[d.path] = o; continue; }
      let text = null;
      if (fetched < fetchCap) {
        fetched++; calls++;
        text = await gh.get(d.path, { ref: docEntry.sha }).then(r => r.text).catch(() => null);
      }
      if (text == null) { pending++; if (o) entries[d.path] = o; continue; }
      entries[d.path] = { blob: d.blob, terms: X().tokens(text) };
    }
    return { sha: docEntry.sha, docs: Object.keys(entries).length, pending, shards: split(repo, entries), calls };
  }

  // The next manifest, scoped to `members`, run facts and shard bodies
  // stripped: what it stores per repo is where the shards are.
  function buildManifest(prev, fetched, members, nowISO) {
    const repos = {};
    for (const repo of members) {
      const e = fetched[repo] || prev?.repos?.[repo];
      if (!e || SKIP[repo]) continue;
      repos[repo] = { sha: e.sha, docs: e.docs, pending: e.pending,
                      shards: (e.shards || []).map(s => (typeof s === 'string' ? s : s.path)) };
    }
    return { generatedAt: nowISO, bucketDocs: BUCKET_DOCS, repos };
  }

  // Repos whose entry moved: a new tip, a change in what is pending, or an
  // entry added or dropped.
  function changedRepos(prev, next) {
    const a = prev?.repos || {}, b = next?.repos || {};
    return [...new Set([...Object.keys(a), ...Object.keys(b)])]
      .filter(r => !a[r] !== !b[r] || (a[r]?.sha || '') !== (b[r]?.sha || '')
        || (a[r]?.pending || 0) !== (b[r]?.pending || 0)
        || (a[r]?.shards || []).join() !== (b[r]?.shards || []).join());
  }

  /**
   * The files of one repo matching a query, from its shards: every word
   * present, AND across words (session-index.js's rule, phrase order lost).
   * Quote marks are dropped rather than matched: no term holds one, so a
   * quoted word (the Map hands over `"ph-flask"`) would otherwise find nothing.
   */
  const search = (shards, q) => [...X().search(shards, String(q || '').replace(/["'\u2018\u2019\u201c\u201d]/g, ' '))].sort();

  window.ContentIndex = {
    MANIFEST, SHARD_DIR, BUCKET_DOCS, FETCH_CAP, SKIP,
    bucketsFor, bucketOf, shardPath, buildShard, readShard, split,
    crawlRepo, buildManifest, changedRepos, search,
  };
})();
