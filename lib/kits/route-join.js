// kits/route-join.js — the app-route join: the hub's own route manifest, and
// for each open pull request against the hub, the files it touches.
//
// TWO PANES READ THIS AND THEY ARE IN TWO COMPONENTS. Map's Views tab ranks
// every destination the app can be sent to by when its code last moved; the
// estate's Branches rows carry the reciprocal, a chip saying which destination
// a branch is working on. Both need the same manifest, the same pull list and
// the same file list per pull, so a copy in each would fetch all of it twice to
// answer one question two ways.
//
// It lived in lib/alpineComponents/estate.js until 2026-09-08, when the Views
// pane left for the Map view and the two readings stopped sharing a component.
// The obvious next home was the shell, which is where every other cross-pane
// cache sits; that was wrong for a reason worth writing down. app/index.html is
// a page, not a lib file, so tools/test/bootstrap.mjs cannot load it: moving
// this there would have traded fourteen assertions for one saved fetch, and the
// suite said so on the first run.
//
// FETCHES, unlike its sibling. lib/kits/route-activity.js is the pure fold over
// what this returns and takes no client at all; the split is the same one
// repo-activity-cache.js draws, and it is why the ranking is testable without a
// network and the reading is testable without a browser. A kit that takes a
// `gh` and calls it is ordinary here (branch-status, chat-archive, repo-mailbox
// all do); what a kit must not do is hold the state, which stays with whoever
// asked.
//
//   RouteJoin.manifest(gh)             -> the folded manifest (needs window.Csv)
//   RouteJoin.branchFiles(gh, repo)    -> [{ repo, name, pr, title, ..., files }]
//   RouteJoin.dates(gh, paths, ref)    -> { path: touch }
//   RouteJoin.pool(items, worker[, n]) -> bounded-concurrency map
//
// Attaches to window.RouteJoin, loaded via gh.load('kits/route-join.js').
(() => {
  const MANIFEST = 'docs/app-routes.csv';
  const VOCAB = 'docs/vocabularies.csv';

  // Run `items` through a small pool. Bounded concurrency matters here for the
  // same reason it does in the branch scan: two dozen commit reads fired at
  // once spend the rate limit in one burst and gain nothing, since the wall
  // clock is set by the slowest, not the sum. A thrown worker yields null
  // rather than failing the batch, so one dead path costs its own row only.
  async function pool(items, worker, size = 6) {
    const out = new Array(items.length);
    let i = 0;
    const run = async () => {
      while (i < items.length) {
        const idx = i++;
        try { out[idx] = await worker(items[idx], idx); } catch { out[idx] = null; }
      }
    };
    await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
    return out;
  }

  // Assembled from two CSVs since 2026-08-16. The shell is a row keyed `shell`
  // rather than a sibling key, and the group glosses live in the shared
  // value-gloss table, which is where every closed domain's do. Parsed here,
  // folded in route-activity: which row is the shell and which vocabulary rows
  // are the groups is the fold's own shape, and it was written out three times
  // before it was.
  //
  // The failure names the address it could not read. A bare "404: Not Found"
  // sent the first diagnosis of this to auth, which the rate-limit figure in
  // the same message had already ruled out.
  async function manifest(gh) {
    try {
      const [routesText, vocabText] = await Promise.all([
        gh.get(MANIFEST).then(r => r.text),
        gh.get(VOCAB).then(r => r.text).catch(() => ''),
      ]);
      return window.routeActivity.manifest(
        window.Csv.rows(routesText).map(r => ({
          ...r, files: window.Csv.list(r.files), tabs: window.Csv.list(r.tabs),
        })),
        window.Csv.rows(vocabText));
    } catch (e) {
      e.message = (gh.repo || '') + '@' + (gh.ref || '') + ':' + MANIFEST + ' — ' + (e.message || e);
      throw e;
    }
  }

  // Every open pull request against the hub, with the files it touches. A
  // failed pull list is an empty join rather than a thrown one: the manifest is
  // the half that must be there, and a route with no branch against it is the
  // normal case anyway.
  async function branchFiles(gh, repo) {
    let prs = [];
    try { prs = await gh.pulls('open', 30); } catch { prs = []; }
    const withFiles = await pool(prs, async (pr) => {
      const files = await gh.req('pulls/' + pr.number + '/files?per_page=100');
      return {
        repo, name: pr.head, pr: pr.number, title: pr.title, draft: pr.draft,
        // pulls() returns no html_url (it keeps the projection narrow), and the
        // address is fully determined by the repo and the number, so it is
        // built rather than fetched.
        url: 'https://github.com/' + repo + '/pull/' + pr.number,
        session: pr.session || '',
        files: (files || []).map(f => f.filename),
      };
    });
    return withFiles.filter(Boolean);
  }

  // One last-commit read per path. `per_page=1` on the commits endpoint
  // filtered by path is the whole question: when did this file last move, and
  // in what commit. A path with no commits simply does not appear, which is
  // what leaves its route undated rather than dated wrong.
  async function dates(gh, paths, ref) {
    const rows = await pool(paths, async (p) => {
      const commits = await gh.req('commits?path=' + encodeURIComponent(p)
                                   + '&sha=' + encodeURIComponent(ref) + '&per_page=1');
      const c = commits && commits[0];
      if (!c) return null;
      return { path: p, touch: {
        date: c.commit?.committer?.date || c.commit?.author?.date || '',
        sha: c.sha, shortSha: (c.sha || '').slice(0, 7),
        subject: (c.commit?.message || '').split('\n')[0],
        author: c.author?.login || c.commit?.author?.name || '',
        url: c.html_url || '',
      } };
    });
    const touches = {};
    for (const r of rows) if (r) touches[r.path] = r.touch;
    return touches;
  }

  window.RouteJoin = { MANIFEST, VOCAB, pool, manifest, branchFiles, dates };
})();
