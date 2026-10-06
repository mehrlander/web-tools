// The sessions crawl as a kit: the pass that folds the per-session records under
// sessions/ in the private registry into state/sessions.json, its phone copy
// state/session-menu.json, and the monthly search shards under
// state/sessions-index/. Lifted out of the app on 2026-10-05 for the reason
// activity-crawl.js was: a caller outside a browser can load a kit and cannot
// load the shell. It mattered more here, because one reader of these files is
// not the app at all. The phone's Claude menu (lib/ops/session-menu.js) reads
// state/session-menu.json, and until this only a browser ever wrote it, so on a
// day worked from the phone the menu did not know that day's sessions.
//
// Two callers. The app's _crawlSessions keeps what only a browser has: the
// listing gate (this browser's record, in localStorage, of the listing it last
// folded completely), the progress ticks and the call log. scripts/sessions-crawl.mjs
// makes the same calls from Node, on the hourly activity-cache Action.
//
// What the caller supplies, none of it read off a global: `reg`, a GH client on
// the registry at main; `S`, the RepoSessionsCache kit; `readFold(path)` and
// `saveFold(path, doc, message, base)`, which read and write with whatever
// conflict handling the caller has; `readTitles()`; and `loadIndex()`, which
// resolves to the SessionIndex kit. Optional: `tick(patch)` for progress,
// `onBuilt({ complete })`, called after the fold is built and before anything
// is written, `runs` (the CrawlRuns kit), `via` for the run record, and the two
// budgets, which default to BUDGET below. The shell's constants are held to
// BUDGET by tools/test/sessions-crawl.test.mjs, so CI and a browser read the
// same number of records a pass.
//
// Attaches to window.SessionsCrawl, loaded via gh.load('kits/sessions-crawl.js').
(() => {
  const BUDGET = {
    maxFetch: 120,   // records read per pass; the rest wait for the next
    pool: 6,         // record blobs read at once
  };

  // Every record's path and blob sha, from one recursive tree read, which is
  // the whole basis of the incremental crawl: no per-file HEAD, no guessing
  // from dates.
  async function listRecords(reg, S) {
    const tree = await reg.req('git/trees/main?recursive=1');
    return (tree?.tree || [])
      .filter(e => e.type === 'blob' && S.isRecordPath(e.path))
      .map(e => ({ path: e.path, sha: e.sha }));
  }

  // The title join's second input. A session's real title reaches no
  // container, so a Dispatch session scrapes the claude.ai/code sidebar and
  // commits one dated CSV per capture to the titles repo. Two calls: list the
  // folder, read the newest file. `gh` is a client on S.TITLES_REPO; a browser
  // passes one that honours its selection, and readRef() answers it.
  //
  // Every failure returns null, which the fold reads as "carry the titles you
  // already have." A repo the token cannot see, a missing folder and a
  // malformed CSV are all the same answer, and none may cost the crawl its
  // records. An export that parses to nothing is a broken export, not an empty
  // one: treating it as empty would blank every title on the next fold.
  async function readTitles(gh, S, warn = console.warn) {
    try {
      const ref = typeof gh.readRef === 'function' ? gh.readRef(S.TITLES_DIR + '/') : 'main';
      const pick = S.newestExport(await gh.req('contents/' + S.TITLES_DIR + '?ref=' + encodeURIComponent(ref)));
      if (!pick) return null;
      const byId = S.parseTitles((await gh.get(pick.path)).text);
      return Object.keys(byId).length ? { at: pick.at, path: pick.path, byId } : null;
    } catch (e) { warn('session titles export:', e?.message || e); return null; }
  }

  const monthOf = (path) => (path.match(/sessions\/(\d{4})\/(\d{2})\//) || []).slice(1).join('-');
  const idOf = (path) => (path.match(/-([0-9a-f]{8})\.json$/) || [])[1];

  // One pass over a listing the caller already holds (the shell gates on it
  // before calling, so it reads the tree once). Returns the summary the shell
  // reports: { total, read, deferred, complete, committed, titlesAt, doc, sha }.
  async function fold(o) {
    const { reg, S, listing, readFold, saveFold, readTitles: titlesOf, loadIndex,
            tick = () => {}, onBuilt = () => {}, runs = null, via = '',
            maxFetch = BUDGET.maxFetch, pool = BUDGET.pool, warn = console.warn } = o;
    const t0 = Date.now();
    const nowISO = new Date().toISOString();

    // This read decides which records are stale AND supplies the sha the save
    // rides on, so a copy that is behind both under-reads the store and writes
    // with a dead sha. The caller's readFold is where that is handled.
    const base = await readFold(S.CACHE_PATH);
    const prev = base?.doc || null;

    // Newest first, so a capped pass reads the records a reader is most likely
    // to want and the older tail catches up on later passes.
    const stale = S.stalePaths(prev, listing).sort().reverse();
    const take = stale.slice(0, maxFetch);
    const shaByPath = new Map(listing.map(e => [e.path, e.sha]));

    // The denominator is the records this pass will read, not the whole store,
    // since the cap defers the rest.
    const fetched = {};
    let i = 0, done = 0;
    const active = [];
    tick({ verb: 'Reading records', total: take.length, done: 0, active: [] });
    const readOne = async () => {
      while (i < take.length) {
        const path = take[i++];
        active.push(path);
        tick({ done, total: take.length, active });
        try {
          // By blob sha, not by path: the sha is already in hand from the tree,
          // and a blob read cannot race a push that moves the path.
          const blob = await reg.req('git/blobs/' + shaByPath.get(path));
          fetched[path] = { record: JSON.parse(reg.decode(blob.content)), sha: shaByPath.get(path) };
        } catch (e) { warn('sessions crawl', path, e?.message || e); }
        active.splice(active.indexOf(path), 1);
        tick({ done: ++done, total: take.length, active });
      }
    };
    await Promise.all(Array.from({ length: Math.min(pool, take.length) }, readOne));

    // Read after the records, so a slow or missing titles repo cannot delay the
    // part of the crawl that matters.
    const titles = await titlesOf();

    // The scope is the FULL listing, never `take`: a record the cap deferred
    // must keep its row, and only a record genuinely gone from the store loses
    // one.
    const deferred = Math.max(0, stale.length - take.length);
    const next = S.buildCache(prev, fetched, listing.map(e => e.path), nowISO, titles);
    // COMPLETE only when this pass left nothing behind. `stale` can exceed the
    // cap, and a record whose blob read threw is not in `fetched` either; both
    // stay stale for the next pass. A caller that records "the store has not
    // moved since" must do it only on a complete pass, or the deferred records
    // would never be read again.
    const complete = !deferred && Object.keys(fetched).length === take.length;
    onBuilt({ complete });

    const changed = S.cacheChanged(prev, next);
    // The blob sha of the copy main now holds for what this pass hands over:
    // the base it matched, or the commit below.
    let sha = base?.sha || '';
    if (changed) {
      next.runs = runs?.push(prev?.runs, {
        at: new Date().toISOString(), ms: Date.now() - t0,
        checked: listing.length, read: Object.keys(fetched).length, deferred,
        ...(via ? { via } : {}),
      }) ?? prev?.runs;
      sha = (await saveFold(S.CACHE_PATH, next, 'Update sessions cache (state/sessions.json)', base))?.content?.sha || sha;
      // THE PHONE'S COPY, written only when the cache itself moved, with its
      // own change gate: the cache moves for things this file does not carry.
      try {
        const menu = S.buildMenuIndex(next);
        const mbase = await readFold(S.MENU_PATH);
        if (S.menuChanged(mbase?.doc || null, menu))
          await saveFold(S.MENU_PATH, menu, 'Update session menu index (state/session-menu.json)', mbase);
      } catch (e) { warn('session menu index:', e?.message || e); }
    }

    // The search index, one shard per touched month, outside the cache's
    // `changed` gate: a record's sha can be unchanged while a ROW_V bump
    // rewrites its row, and a month can need its shard on a pass where nothing
    // about the cache moved. The records are already in hand, so tokenizing
    // costs no network. Merged rather than rebuilt (kits/session-index.js), and
    // the keep-set is applied only on a COMPLETE pass, since a capped pass has
    // not read every record and dropping the rest would empty the index.
    try {
      const X = await loadIndex();
      const idsByMonth = {};
      for (const e of listing) {
        const m = monthOf(e.path), id = idOf(e.path);
        if (m && id) (idsByMonth[m] ||= new Set()).add(id);
      }
      const changedByMonth = {};
      for (const [path, hit] of Object.entries(fetched)) {
        const m = monthOf(path), id = idOf(path);
        if (!m || !id || !hit?.record) continue;
        (changedByMonth[m] ||= {})[id] = X.tokens(X.docText(hit.record));
      }
      for (const [month, changedDocs] of Object.entries(changedByMonth)) {
        const path = X.shardPath(month);
        const sbase = await readFold(path);
        const shard = X.mergeShard(sbase?.doc || null, changedDocs, complete ? idsByMonth[month] : null);
        if (X.shardChanged(sbase?.doc || null, shard))
          await saveFold(path, shard, 'Update session search index (' + path + ')', sbase);
      }
    } catch (e) { warn('session search index:', e?.message || e); }

    // `doc` rides the summary because the caller is holding a megabyte it would
    // otherwise re-read, and because its stamp says when the store was checked:
    // a pass that changes nothing does not commit, so the stored file keeps the
    // previous pass's `generatedAt`.
    return { total: listing.length, read: Object.keys(fetched).length, deferred, complete,
             committed: changed, titlesAt: next.titlesAt || '', doc: next, sha };
  }

  window.SessionsCrawl = { BUDGET, listRecords, readTitles, fold };
})();
