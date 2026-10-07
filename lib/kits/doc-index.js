// kits/doc-index.js — every estate repo's Markdown, with word counts, kept in
// the private registry so the Map's Docs tab can read the constellation's
// documentation in one fetch.
//
// The hub's own documents have a curated registry (docs/docs.csv), whose
// subject, status and reach fields only the hub can state. Every other repo
// gets this instead: the facts a crawl can derive, which are the Markdown
// paths and each file's word count, counted the way node/build/docs-reach.mjs
// counts the hub's (whitespace-split tokens). Nothing here is authored.
//
// WHAT AN ENTRY HOLDS. Per repo: the default-branch commit it was read at
// (`sha`), the totals, and the documents GROUPED BY FOLDER as in
// state/files.json, `dirs: { "chron/2026/10": { "x.md": [words, blob] } }`,
// where `blob` is the first twelve characters of the file's git blob sha. The
// blob is what makes the next read incremental: a file whose blob has not
// changed keeps its count, so a push costs one tree read plus one read per
// Markdown file it changed. A folder holding more than FOLDER_CAP documents
// directly is stored as its count, as file-index.js does.
//
// THE FETCH CAP. A push that rewrites thousands of files (a data repo
// regenerating its extracts) would spend the crawl's rate budget in one run.
// A run reads at most FETCH_CAP files per repo; the rest are stored with a
// null count, the entry says how many are `pending`, and the next run fills
// them without reading the tree again. A first build from nothing is the
// seeder's job (node/doc-index-seed.mjs reads local checkouts), not the
// crawl's.
//
// Pure builders plus one network function, like file-index.js. Attaches to
// window.DocIndex, loaded via gh.load('kits/doc-index.js'), and run by the
// hourly crawl in node/activity-crawl.mjs.
(() => {
  const CACHE_PATH = 'state/docs.json';
  const FOLDER_CAP = 2000;
  const FETCH_CAP = 300;

  const isDoc = (p) => /\.(md|markdown)$/i.test(p || '');
  const countWords = (text) => String(text || '').split(/\s+/).filter(Boolean).length;

  // Contents-API JSON -> text. atob gives one char per byte; TextDecoder makes
  // it UTF-8, so a curly quote is one character and the split is unchanged.
  function decode(j) {
    const bin = atob(String(j?.content || '').replace(/\s+/g, ''));
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }

  // [{ path, blob, words }] -> the stored entry's body.
  function encode(docs, cap = FOLDER_CAP) {
    const by = new Map();
    for (const d of docs) {
      const i = d.path.lastIndexOf('/');
      const dir = i < 0 ? '' : d.path.slice(0, i);
      if (!by.has(dir)) by.set(dir, []);
      by.get(dir).push(d);
    }
    const dirs = {};
    let count = 0, words = 0, pending = 0, collapsed = 0;
    for (const dir of [...by.keys()].sort()) {
      const list = by.get(dir).sort((a, b) => a.path.localeCompare(b.path));
      if (list.length > cap) { dirs[dir] = list.length; collapsed++; continue; }
      const files = {};
      for (const d of list) {
        files[d.path.slice(d.path.lastIndexOf('/') + 1)] = [d.words, String(d.blob || '').slice(0, 12)];
        count++;
        if (d.words == null) pending++; else words += d.words;
      }
      dirs[dir] = files;
    }
    return { docs: count, words, pending, collapsed, dirs };
  }

  // An entry, flat: [{ path, words, blob }]. Capped folders contribute nothing.
  function rows(entry) {
    const out = [];
    for (const [dir, v] of Object.entries(entry?.dirs || {})) {
      if (!v || typeof v !== 'object') continue;
      for (const [name, [words, blob]] of Object.entries(v))
        out.push({ path: dir ? dir + '/' + name : name, words, blob });
    }
    return out;
  }

  // One repo's entry, or the stored one when its tip has not moved and nothing
  // is pending. `headSha` is the default-branch tip the caller already read.
  async function crawlRepo(repo, headSha, { makeGH, prev = null, cap = FOLDER_CAP, fetchCap = FETCH_CAP } = {}) {
    if (!headSha) return prev ? { ...prev, carried: true } : null;
    if (prev?.sha === headSha && !prev.pending) return { ...prev, carried: true };
    const gh = makeGH(repo);
    let list, calls = 0, truncated = false;
    if (prev?.sha === headSha) {
      list = rows(prev);
    } else {
      const t = await window.FileIndex.readTree(gh, headSha, { blobs: isDoc });
      list = t.blobs.map(b => ({ path: b.path, blob: b.sha }));
      calls += t.calls;
      truncated = t.truncated;
    }
    const old = new Map(rows(prev).map(r => [r.path, r]));
    const docs = [];
    let fetched = 0;
    for (const d of list) {
      const b12 = String(d.blob || '').slice(0, 12);
      const o = old.get(d.path);
      if (o && o.blob === b12 && o.words != null) { docs.push({ path: d.path, blob: b12, words: o.words }); continue; }
      if (fetched >= fetchCap) { docs.push({ path: d.path, blob: b12, words: null }); continue; }
      fetched++; calls++;
      const path = d.path.split('/').map(encodeURIComponent).join('/');
      const words = await gh.req('contents/' + path + '?ref=' + headSha)
        .then(j => countWords(decode(j)))
        .catch(() => null);
      docs.push({ path: d.path, blob: b12, words });
    }
    return { sha: headSha, at: new Date().toISOString(), truncated, calls, ...encode(docs, cap) };
  }

  // The next document, scoped to `members`, run facts stripped. Same rules as
  // FileIndex.buildIndex.
  function buildIndex(prev, fetched, members, nowISO) {
    const repos = {};
    for (const repo of members) {
      const e = fetched[repo] || prev?.repos?.[repo];
      if (!e) continue;
      const { carried, calls, ...keep } = e;
      repos[repo] = keep;
    }
    return { generatedAt: nowISO, folderCap: FOLDER_CAP, repos };
  }

  // Repos whose content moved: a new tip, a change in what is pending, or an
  // entry added or dropped.
  function changedRepos(prev, next) {
    const a = prev?.repos || {}, b = next?.repos || {};
    return [...new Set([...Object.keys(a), ...Object.keys(b)])]
      .filter(r => !a[r] !== !b[r] || (a[r]?.sha || '') !== (b[r]?.sha || '')
        || (a[r]?.pending || 0) !== (b[r]?.pending || 0));
  }

  window.DocIndex = { CACHE_PATH, FOLDER_CAP, FETCH_CAP, isDoc, countWords, decode, encode, rows, crawlRepo, buildIndex, changedRepos,
    // The layout is file-index.js's, so its serializer is this file's too.
    serialize: (doc) => window.FileIndex.serialize(doc) };
})();
