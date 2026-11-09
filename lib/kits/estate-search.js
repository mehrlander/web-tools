// The estate's search calls, in one place, with one cache.
//
// Two consumers ask the same questions: the sidebar finder (a dispatcher whose
// deeper lanes are tap-gated) and the Search view (the central file surface).
// Each search existed first inside the finder component; extracting them here
// is what lets the view exist without a second implementation, and what makes
// the caches shared, so a tree the finder fetched is a tree the view never
// re-fetches. Pure fetch-and-match: no Alpine, no DOM, no rendering opinions.
// Consumers own reactivity by copying results into their own state.
//
// The calls, and what each honestly covers:
//
//   tree(repo, ref)    one recursive git/trees call per (repo, ref), cached
//                      for the session (the stage's Browse/Search economy).
//                      A FAILED fetch is not cached as an empty tree; it backs
//                      off briefly and retries, so a blip does not kill the
//                      file lanes until reload.
//   names(...)         substring match over tree paths, any ref, any repos,
//                      optionally scoped to a folder (`under`). Recursive and
//                      flat: it answers "which paths match".
//   level(...)         one level of one repo's tree, folders and files, off the
//                      same cache. It answers "what is in here", which has
//                      folders in it and is the question a recursive match
//                      cannot fold back into.
//
// Every file a caller gets back carries its SIZE IN BYTES, from the same
// recursive read: the trees API reports a blob's size on the entry, so nothing
// is fetched for it. This is the one thing the retired per-repo explorer had
// that the cached walk did not, and it turned out to cost nothing to keep.
//   contents(...)      the estate's MARKDOWN, by word, from the content index
//                      the crawl writes into the registry
//                      (kits/content-index.js: a manifest and each repo's
//                      shards, default branches). Not GitHub's code-search
//                      API, which a page cannot read: its answers carry no
//                      CORS header (the kit's header has the measurement).
//                      Shards are read once per registry and credential, like
//                      the session shards. snippet(...) reads one hit's text
//                      for the line a row quotes.
//   sessions(...)      a client-side grep of the captured session records
//                      (web-tools-private sessions/, via state/sessions.json):
//                      what was SAID across every stored prompt and reply,
//                      answered from kits/session-index.js rather than by
//                      opening the records: 1.0 MB of monthly shards against
//                      156 MB of store, 89 ms to load and 2 to 9 ms a query.
//                      Unioned with what the ROW says (searchSegs: the two
//                      names, the opening ask, attachments, repos, files),
//                      because those are two halves of one question and the
//                      rows are already in hand. A hit says which side
//                      answered; the index holds terms rather than text, so a
//                      match on the conversation has no fragment to quote.
//   chats(...)         the chat archive's CHEAP PASS: the catalog month shards
//                      in mehrlander/chat-histories (hand entries and machine
//                      summaries merged), matched on title, tags and summary.
//                      Read through kits/chat-archive.js, which owns the shard
//                      memo, so this lane adds no cache of its own. It is the
//                      sibling of sessions(...) and deliberately the opposite
//                      trade: about 10 MB of model-written summaries across 41
//                      months against 156 MB of verbatim records, so it finds a
//                      chat you can DESCRIBE where the session lane finds words
//                      that were SAID. Neither reaches the chat snapshots' full
//                      text, which stays CLI-only (chat-histories
//                      tools/search_chats.py, whose docstring names the split:
//                      --catalog is the cheap semantic pass, full text the
//                      exhaustive one).
//
// Attaches to window.EstateSearch, loaded via gh.load('kits/estate-search.js').
(() => {
  const TREE_RETRY_MS = 30_000;   // a failed tree fetch may retry after this
  const trees = {};               // "repo@ref" -> { paths, sizes, truncated }
  const treeFailedAt = {};        // "repo@ref" -> epoch ms of the last failure
  const treeInFlight = {};        // "repo@ref" -> Promise
  // Each registry keeps only its current credential's cache. Requests retain
  // their cache object, so changing credentials or clearing caches detaches
  // unfinished old reads. Tokens never enter a cache key or statistics.
  const sessionCaches = new Map();
  let sessionCache = null;
  // The registry's file-name index (state/files.json, lib/kits/file-index.js),
  // read once per page and kept: the crawl rewrites it at most once per push to
  // a default branch, so a second read in one visit would almost never differ.
  // `false` marks an index that could not be read, so a keystroke loop does not
  // re-request it; reset() clears either.
  const FILES_PATH = 'state/files.json';
  let fileIdx = null;
  let fileIdxInFlight = null;
  // Months the chats lane has folded. The ROWS live in chat-archive's own memo
  // (immutable shards, never re-fetched once read), so this is a count for the
  // State view rather than a second copy of anything.
  const chatMonthsRead = new Set();
  const CHAT_POOL = 4;            // shard reads in flight at once
  // Successful session shards stay in the active cache. Failed months remain
  // retryable on the next query, and overlapping readers share their promises.
  const SHARD_POOL = 4;
  // When this cache was last emptied, page load counting as the first empty.
  // It is the only age these caches have: nothing here is built, only fetched
  // and kept, so there is no build timestamp to report. The State view renders
  // it as "cleared 30m ago, 11 trees", which is the honest answer to the
  // question the Search view's own control kept being asked ("are these
  // results cached?").
  let clearedAt = Date.now();

  // ~one line of context around the first case-insensitive hit.
  // `lead` is how much comes before the hit; a narrow row wants it short, or
  // the hit itself is what truncation cuts.
  function clip(text, q, lead = 35) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    const i = s.toLowerCase().indexOf(String(q || '').toLowerCase());
    if (i < 0) return s.slice(0, 110);
    const from = Math.max(0, i - lead);
    return (from > 0 ? '…' : '') + s.slice(from, from + 120) + (from + 120 < s.length ? '…' : '');
  }

  // The blob paths of a repo at a ref ('' or 'HEAD' both mean the default
  // branch, resolved server-side), plus `sizes`, the same entries' byte counts
  // keyed by path. Throws on failure so a caller can say so; the failure is
  // remembered only long enough to stop a keystroke loop from hammering a dead
  // endpoint.
  async function tree(repo, ref, token) {
    const key = repo + '@' + (ref || 'HEAD');
    if (trees[key]) return trees[key];
    if (treeInFlight[key]) return treeInFlight[key];
    if (treeFailedAt[key] && Date.now() - treeFailedAt[key] < TREE_RETRY_MS) {
      throw new Error('tree fetch for ' + key + ' recently failed; retrying shortly');
    }
    treeInFlight[key] = (async () => {
      try {
        const gh = new window.GH({ token, repo });
        const t = await gh.req('git/trees/' + encodeURIComponent(ref || 'HEAD') + '?recursive=1');
        const blobs = (t.tree || []).filter(e => e.type === 'blob');
        const sizes = Object.create(null);
        for (const e of blobs) if (typeof e.size === 'number') sizes[e.path] = e.size;
        trees[key] = {
          paths: blobs.map(e => e.path),
          sizes,
          truncated: !!t.truncated,
        };
        delete treeFailedAt[key];
        return trees[key];
      } catch (e) {
        treeFailedAt[key] = Date.now();
        throw e;
      } finally { delete treeInFlight[key]; }
    })();
    return treeInFlight[key];
  }

  // File-name search: substring over the trees of the given repos, each at its
  // own ref. Unreachable trees are reported, not thrown, so one bad ref does
  // not empty the whole answer.
  //
  // `under` is a FOLDER SCOPE, applied before the substring match so the cap
  // counts scoped hits rather than spending itself outside the scope. It is
  // what makes an EMPTY query useful: with no q every path matches, so
  // `{ q: '', under: 'lib/kits' }` is a listing of that folder and the search
  // and the browse are one call. Leading and trailing slashes are forgiving.
  async function names({ q, repos, token, cap = 50, under = '' }) {
    const ql = String(q || '').toLowerCase();
    const scope = String(under || '').replace(/^\/+|\/+$/g, '');
    const inScope = (p) => !scope || p === scope || p.startsWith(scope + '/');
    const hits = [], errors = [];
    let truncated = false;
    await Promise.all((repos || []).map(async ({ repo, ref }) => {
      try {
        const t = await tree(repo, ref, token);
        truncated = truncated || t.truncated;
        for (const p of t.paths) {
          if (!inScope(p)) continue;
          if (p.toLowerCase().includes(ql)) hits.push({ repo, ref: ref || '', path: p, size: t.sizes[p] });
        }
      } catch (e) { errors.push(repo + (ref ? '@' + ref : '') + ': ' + (e?.message || e)); }
    }));
    hits.sort((a, b) => a.repo.localeCompare(b.repo) || a.path.localeCompare(b.path));
    return { hits: hits.slice(0, cap), total: hits.length, truncated, errors };
  }

  // ONE LEVEL of one repo's tree: the folders and files sitting directly under
  // `under`, rather than everything below it. Same cached tree as names(), so
  // browsing a folder costs no fetch after the first read of the repo, and
  // descending never costs another one.
  //
  // This is the browse half, and it is a different question from names() rather
  // than a narrower one: names() answers "which paths match", which is
  // recursive and flat by nature, while this answers "what is in here", which
  // is one level and has folders in it. A consumer that folded folders out of a
  // recursive match would be answering neither.
  //
  // A folder carries the count of blobs BELOW it, not in it, since that is what
  // the one recursive read knows and what says whether a folder is worth
  // opening. A file carries its own size, off the same entries.
  async function level({ repo, ref, under, token }) {
    const t = await tree(repo, ref, token);
    const scope = String(under || '').replace(/^\/+|\/+$/g, '');
    const prefix = scope ? scope + '/' : '';
    const dirs = new Map();
    const files = [];
    for (const p of t.paths) {
      if (prefix && !p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      if (!rest) continue;
      const cut = rest.indexOf('/');
      if (cut < 0) files.push({ path: p, size: t.sizes[p] });
      else {
        const name = rest.slice(0, cut);
        dirs.set(name, (dirs.get(name) || 0) + 1);
      }
    }
    return {
      dirs: [...dirs.entries()]
        .map(([name, n]) => ({ name, path: prefix + name, n }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
      truncated: t.truncated,
    };
  }

  // WHAT A SESSION IS CALLED used to be folded in here, as `nameSegs`. It is
  // gone because RepoSessionsCache.searchSegs carries the same two names in
  // the same two spellings and eleven more fields besides, and one definition
  // of "what a row says" beats two that can drift. The argument it carried is
  // worth keeping: search.py holds --name apart from --grep because a name is
  // ASSIGNED and not said, so a hit on one must be distinguishable from a hit
  // on the other. The labelled segments do that here, and the sessions lane
  // below says which side answered on every hit.

  // Session search, over the index rather than the store.
  //
  // IT USED TO OPEN EVERY RECORD. The registry holds 372 of them and 156 MB,
  // six at a time, and the first search of a session paid for all of it. What
  // that grep read was the prose, 22 MB of the 156, and kits/session-index.js
  // turns those into 1.0 MB of monthly shards over the wire. Measured: 89 ms
  // to load every shard and 2 to 9 ms a query, against tens of seconds and the
  // whole store.
  //
  // TWO SOURCES, UNIONED, because they answer different halves and always did.
  // The INDEX answers what was SAID, across every prompt and reply. The ROW
  // answers what the session IS: its exported title, its derived name, its
  // opening ask, its attachments, the repos and files it worked
  // (RepoSessionsCache.searchSegs). Folding them keeps the old promise that
  // either spelling finds the session, and it costs nothing, since the rows
  // are already read for the shard months anyway.
  //
  // WHAT A HIT CANNOT CARRY ANY MORE is a quoted fragment of the conversation.
  // The index holds terms, not text, so a match on what was said has nothing
  // to quote; the row's own ask stands in and the note line says which side
  // answered. Reading the sentence means opening the session, which fetches
  // that one record rather than all of them.
  async function sessions({ q, registry, token, onProgress, includeIds = [] } = {}) {
    let cache = sessionCaches.get(registry);
    if (!cache || cache.token !== token) {
      cache = { token, rows: null, rowsFlight: null, shards: new Map(), flights: new Map() };
      sessionCaches.set(registry, cache);
    }
    sessionCache = cache;
    // Pinned to main: the session store is live shared state written there.
    const reg = new window.GH({ token, repo: registry, ref: 'main' });
    if (!cache.rows) {
      // Through the kit's constant, like every other read of this file. The
      // literal stays as the fallback for a boot where the kit has not loaded.
      const path = window.RepoSessionsCache?.CACHE_PATH || 'state/sessions.json';
      if (!cache.rowsFlight) cache.rowsFlight = (async () => {
        const doc = JSON.parse((await reg.get(path)).text);
        return cache.rows = Array.isArray(doc.rows) ? doc.rows : [];
      })().finally(() => { cache.rowsFlight = null; });
      await cache.rowsFlight;
    }
    const X = window.SessionIndex;
    // The months to read come from the rows, not from a tree call: every row
    // carries the day its session began, which is the folder its record sits
    // in and so the shard that holds it.
    const months = X
      ? [...new Set(cache.rows.map(r => X.monthOf(r)).filter(Boolean))].sort().reverse()
      : [];
    const pending = months.filter(m => !cache.shards.has(m));
    let done = 0, next = 0;
    const tick = () => { try { onProgress?.({ done: ++done, total: pending.length }); } catch {} };
    const worker = async () => {
      while (next < pending.length) {
        const m = pending[next++];
        let flight = cache.flights.get(m);
        if (!flight) {
          flight = (async () => {
            try {
              const shard = JSON.parse((await reg.get(X.shardPath(m))).text);
              if (shard && typeof shard === 'object') cache.shards.set(m, shard);
            } catch { /* missing this time; a later query can retry */ }
          })().finally(() => { if (cache.flights.get(m) === flight) cache.flights.delete(m); });
          cache.flights.set(m, flight);
        }
        await flight;
        tick();
      }
    };
    await Promise.all(Array.from({ length: Math.min(SHARD_POOL, pending.length) }, worker));

    const shards = months.map(m => cache.shards.get(m)).filter(Boolean);
    const missing = months.filter(m => !cache.shards.has(m));
    const said = X ? X.search(shards, q) : new Set();
    const match = window.RepoSessionsCache?.matches;
    const segsOf = window.RepoSessionsCache?.searchSegs;
    // Activity can also match joined branch metadata that is absent from the
    // session row cache. Carry those known matches for this one query, so its
    // inspection list has the same membership after a cold link or refresh.
    const included = new Set(includeIds);
    const hits = [];
    for (const row of cache.rows) {
      const onRow = match ? match(row, q) : false;
      const onDiscussion = said.has(row.id);
      const onActivity = included.has(row.id) && !onRow && !onDiscussion;
      if (!onRow && !onDiscussion && !onActivity) continue;
      // The quoted segment where the ROW answered, and a plain label where
      // only the conversation did, since there is nothing to quote.
      const seg = onRow && segsOf ? segsOf(row).find(x => matchesEvery(x, q)) : '';
      hits.push({
        id: row.id, day: row.day || '', ask: row.ask || '',
        title: window.RepoSessionsCache?.labelOf?.(row) || '',
        frag: seg ? clip(seg, firstTerm(q)) : 'said in the conversation',
        onRow: !!onRow, onDiscussion, onActivity,
        matchNote: onRow ? (seg ? clip(seg, firstTerm(q)) : 'Session details match') : onActivity ? 'Activity details match' : '',
      });
    }
    hits.sort((a, b) => (b.day || '').localeCompare(a.day || ''));
    // `indexed` says whether the deep half ran at all. A registry whose crawl
    // has not written a shard yet answers on rows alone, and a consumer that
    // reported that as a complete result would be claiming a search it did not
    // perform.
    return { hits, total: hits.length, indexed: shards.length, months: months.length, missing };
  }

  // Chat grep, over the archive's catalog layers. `repo` is the chat archive
  // (mehrlander/chat-histories); the shards load once per session through
  // chat-archive's memo and later queries match in memory.
  //
  // WHOLE-ARCHIVE BY DEFAULT, which is what makes this a search rather than
  // the pane's filter. The Chats pane pages one month at a time on purpose and
  // its box narrows only what is loaded; this reads every month the frontier
  // names, about 10 MB across 41 shards, so it is a deliberate act and the
  // caller is expected to gate it. `months` caps the walk from the newest end
  // for a caller that wants a cheaper answer.
  //
  // PROGRESS RATHER THAN A SPINNER. Forty shard reads is tens of seconds on a
  // cold pass, so `onProgress({ done, total })` fires per shard and the view
  // can say how far along it is. The crawl bars in the estate make the same
  // bargain for the same reason.
  //
  // A MISSING SHARD IS NOT AN ERROR. Most months have exactly one of the two
  // layers, and chat-archive's loadMonth throws only when BOTH are absent,
  // which for a month the frontier named means the archive is inconsistent
  // rather than that the search failed. Those months are counted and reported
  // beside the hits, never thrown, so one bad month does not empty the answer.
  async function chats({ q, repo, token, ref, months = 0, onProgress } = {}) {
    const A = window.chatArchive;
    if (!A) throw new Error('The chat archive kit has not loaded (kits/chat-archive.js).');
    const frontier = await A.loadFrontier({ repo, token, ref });
    const all = A.monthsDesc(frontier);
    const take = months > 0 ? all.slice(0, months) : all;
    const rowsByMonth = {};
    const missing = [];
    let done = 0, next = 0;
    const tick = () => { try { onProgress?.({ done: ++done, total: take.length }); } catch {} };
    const worker = async () => {
      while (next < take.length) {
        const m = take[next++];
        try {
          rowsByMonth[m] = await A.loadMonth({ repo, token, ref, month: m });
          chatMonthsRead.add(repo + ':' + m);
        } catch { missing.push(m); }
        tick();
      }
    };
    await Promise.all(Array.from({ length: Math.min(CHAT_POOL, take.length) }, worker));

    const hits = [];
    for (const m of take) {
      for (const row of rowsByMonth[m] || []) {
        if (!A.matches(row, q)) continue;
        // Which field answered, for the note line. Same precedence the segments
        // are built in (title, summary, tags), so a hit whose title matched
        // says so rather than quoting a summary that happens to repeat it.
        const seg = A.searchSegs(row).find(x => matchesEvery(x, q));
        hits.push({
          url: row.url, open: row.open, title: row.title, date: row.date,
          month: row.month, provider: row.provider, hand: row.hand,
          frag: clip(seg || row.summary || row.title, firstTerm(q)),
        });
      }
    }
    // The shards are already newest-first inside a month and `take` is
    // newest-first across months, so this is only a tiebreak for rows whose
    // dates disagree with their shard.
    hits.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return { hits, total: hits.length, months: take.length, missing };
  }

  // One segment holding every term. The per-row test is chat-archive's
  // `matches`, which joins the segments; this narrower one exists only to pick
  // WHICH segment to quote, and a segment holding all the terms is the honest
  // one to show. Nothing is quoted when the terms are spread across fields.
  function matchesEvery(text, q) {
    const terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const hay = String(text || '').toLowerCase();
    return terms.every(t => hay.includes(t));
  }
  // What `clip` should centre on. It takes one needle, and a multi-term query
  // has no single one, so the first term stands in: it is the one the reader
  // typed first and the window is a courtesy rather than a claim.
  function firstTerm(q) {
    return String(q || '').trim().split(/\s+/)[0] || '';
  }

  // Forget everything fetched, so the next search reads fresh. The Search
  // view's refresh control; a finder consumer clears its own copies too.
  // The index document, or null when the registry has none yet (a crawl has
  // not written it) or it cannot be read. Never throws: the callers fall back
  // to the live tree reads above, which is what they did before it existed.
  async function fileIndex({ registry, token }) {
    if (fileIdx) return fileIdx;
    if (fileIdx === false) return null;
    if (fileIdxInFlight) return fileIdxInFlight;
    fileIdxInFlight = (async () => {
      try {
        const gh = new window.GH({ token, repo: registry, ref: 'main' });
        fileIdx = JSON.parse((await gh.get(FILES_PATH)).text);
        return fileIdx;
      } catch { fileIdx = false; return null; }
      finally { fileIdxInFlight = null; }
    })();
    return fileIdxInFlight;
  }
  // A crawl that just wrote the index hands it here, so this page sees what it
  // committed without reading it back.
  function setFileIndex(doc) { if (doc?.repos) fileIdx = doc; }

  // File-name search over the index: every indexed repo, default branches, in
  // one pass with no network after the first read. `repos` narrows it (the
  // estate's visible members, so a hidden repo stays hidden). Same row shape as
  // names(), plus `folders`, the capped folders whose path matched, and `at`,
  // the index's own age for the caller to show.
  async function indexNames({ q, registry, token, repos = null, preferRepo = '', cap = 50 }) {
    const doc = await fileIndex({ registry, token });
    if (!doc || !window.FileIndex) return null;
    const keep = repos ? new Set(repos) : null;
    const scoped = keep
      ? { repos: Object.fromEntries(Object.entries(doc.repos || {}).filter(([r]) => keep.has(r))) }
      : doc;
    const res = window.FileIndex.search(scoped, q, { preferRepo, cap });
    const truncated = Object.values(scoped.repos || {}).some(e => e.truncated);
    return {
      hits: res.hits.map(h => ({ repo: h.repo, ref: '', path: h.path })),
      total: res.total, folders: res.folders, truncated, errors: [],
      at: doc.generatedAt || '', indexed: Object.keys(scoped.repos || {}),
    };
  }

  // Contents, over the content index. Like sessions(), each registry keeps
  // only its current credential's reads, so a token change cannot reuse
  // another identity's shards.
  const contentCaches = new Map();
  async function contents({ q, repos = [], registry, token, under = '' } = {}) {
    const CI = window.ContentIndex;
    if (!CI || !window.SessionIndex) throw new Error('The content index kit has not loaded (kits/content-index.js).');
    let cache = contentCaches.get(registry);
    if (!cache || cache.token !== token) contentCaches.set(registry, cache = { token, manifest: null, shards: new Map() });
    const reg = new window.GH({ token, repo: registry, ref: 'main' });
    if (!cache.manifest) {
      cache.manifest = reg.get(CI.MANIFEST).then(r => JSON.parse(r.text))
        .catch(e => { cache.manifest = null; if (e?.status === 404) return null; throw e; });
    }
    const man = await cache.manifest;
    const shard = (p) => {
      if (!cache.shards.has(p)) {
        const f = reg.get(p).then(r => JSON.parse(r.text));
        f.catch(() => cache.shards.delete(p));
        cache.shards.set(p, f);
      }
      return cache.shards.get(p);
    };
    const scope = String(under || '').replace(/^\/+|\/+$/g, '');
    const inScope = (p) => !scope || p === scope || p.startsWith(scope + '/');
    const order = new Map(repos.map((r, i) => [r, i]));
    const hits = [], missing = [];
    let pending = 0;
    await Promise.all(repos.map(async (repo) => {
      const e = man?.repos?.[repo];
      if (!e) { missing.push(repo); return; }
      try {
        const found = CI.search(await Promise.all((e.shards || []).map(shard)), q);
        pending += e.pending || 0;
        for (const p of found) if (inScope(p)) hits.push({ repo, ref: '', path: p });
      } catch { missing.push(repo); }
    }));
    hits.sort((a, b) => order.get(a.repo) - order.get(b.repo) || a.path.localeCompare(b.path));
    missing.sort((a, b) => order.get(a) - order.get(b));
    // `indexed` says whether a manifest exists at all, so a caller can tell
    // "nothing matched" from "nothing has been built yet".
    return { hits, total: hits.length, indexed: !!man, missing, pending, at: man?.generatedAt || '' };
  }
  // One hit's quoted line: the file at its default branch, clipped around the
  // query's first term.
  async function snippet({ repo, path, q, token }) {
    const gh = new window.GH({ token, repo });
    gh.ref = '';
    return clip((await gh.get(path)).text, firstTerm(q).replace(/["'\u2018\u2019\u201c\u201d]/g, ''), 12);
  }

  function reset() {
    fileIdx = null;
    contentCaches.clear();
    for (const k of Object.keys(trees)) delete trees[k];
    for (const k of Object.keys(treeFailedAt)) delete treeFailedAt[k];
    sessionCache = null;
    sessionCaches.clear();
    // The chat shards are immutable once committed, so chat-archive keeps them
    // and only its failure backoff is worth clearing: a retry must not be told
    // to wait, and re-fetching a shard that read fine would be a reload of
    // everything already on screen for nothing. The count is this lane's own,
    // so it resets with the rest.
    chatMonthsRead.clear();
    window.chatArchive?.forget?.();
    clearedAt = Date.now();
  }

  function stats() {
    return {
      trees: Object.keys(trees).length,
      fileIndex: !!fileIdx,
      rows: sessionCache?.rows?.length || 0,
      shards: sessionCache?.shards.size || 0,
      chatMonths: chatMonthsRead.size,
      contentShards: [...contentCaches.values()].reduce((n, c) => n + c.shards.size, 0),
      clearedAt,
    };
  }

  window.EstateSearch = { clip, tree, names, level, sessions, chats, contents, snippet, reset, stats, TREE_RETRY_MS, fileIndex, setFileIndex, indexNames, FILES_PATH };
})();
