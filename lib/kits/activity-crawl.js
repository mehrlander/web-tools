// One repo's activity crawl: the GitHub reads that fill a single entry of
// state/activity.json, lifted out of the show-repo shell on 2026-09-19 so the
// browser and a headless runner call ONE crawler rather than two that have to
// agree. The pure fold on the other side of it is lib/kits/repo-activity-cache.js
// and the branch math beneath it is lib/kits/branch-status.js; this file is the
// fetch orchestration between them, and it belongs out here for the reason
// branch-status.js does: the shell is the one layer a caller outside a browser
// cannot have.
//
// Two callers. show-repo's refreshActivityCache keeps the estate loop
// (membership, the watermark gate, progress ticks, the commit) and calls this
// once per repo; scripts/activity-crawl.mjs makes the same call from Node, so a
// merge to main refreshes the cache without waiting for someone to open the app
// and ask for it.
//
// What the caller supplies, none of it read off a global: `makeGH(repo, ref)`,
// a GH factory, so each caller owns its token; `B` and `checks`, the
// BranchStatus and RepoChecks kits; the repo's own
// .web-tools.json as `cfg`; and `caps`, the five budgets the shell documents
// beside its constants. CAPS below is the default set, and the shell's
// constants are held to it by tools/test/activity-crawl.test.mjs, so tuning one
// copy fails the suite rather than crawling CI at a different budget.
//
// THE ONE THING A CALLER MUST SETTLE BEFORE IT RUNS THIS: two of the reads below
// are GraphQL (gh.branchPulls, gh.branchesDatedSessions), and a caller without
// GraphQL gets a pass that reports success and is materially wrong. A Claude
// Code session is exactly that caller: its proxy answers api.github.com/graphql
// with 403, so the branch walk falls back to the dateless REST list (every
// branch classifies `older`, `active` reads zero) and the PR index comes back
// empty. scripts/activity-crawl.mjs preflights GraphQL and refuses to write
// without it; a browser has it and needs no preflight.
//
// Attaches to window.ActivityCrawl, loaded via gh.load('kits/activity-crawl.js').
(() => {
  // The five budgets this crawl spends, defaulted here and documented at the
  // shell's constants. A caller may override any of them; the runner takes
  // these as they are, so CI and a browser crawl at the same budget.
  const CAPS = {
    recentCommits: 40,   // newest commits fetched and stored per repo
    prReach: 100,        // how deep the any-state PR read goes (gh.branchPulls)
    scanCap: 30,         // older branches SCANNED per repo per pass
    scanKeep: 500,       // older branches that KEEP a row
    errorRetry: 3,       // errored scan rows retried per repo per pass
  };

  // The margin the scan gate allows between GitHub's pushed_at and the client
  // clock that stamped scannedAt. Anything unmeasurable scans.
  const SCAN_SKEW_MS = 10 * 60 * 1000;

  // One tree read and one commit read per distinct path, shared across every
  // check in the batch: several checks routinely want the same tree, and a
  // lockstep check asks for its sources' dates one at a time.
  function checkReader(gh, ref) {
    let treeP = null;
    const dates = new Map();
    return {
      text: async p => { try { return (await gh.get(p)).text; } catch { return null; } },
      tree: () => (treeP ||= gh.req(`git/trees/${encodeURIComponent(ref || 'main')}?recursive=1`)
        .then(t => (t?.tree || []).filter(e => e.type === 'blob').map(e => ({ path: e.path })))
        .catch(() => null)),
      lastCommitDate: p => {
        if (!dates.has(p)) dates.set(p, gh
          .req(`commits?sha=${encodeURIComponent(ref || 'main')}&path=${encodeURIComponent(p)}&per_page=1`)
          .then(cs => cs?.[0]?.commit?.author?.date || null).catch(() => null));
        return dates.get(p);
      },
    };
  }

  // THE SCAN GATE, shared by both callers for the same reason the crawl itself
  // is: a repo not pushed since its last scan cannot have changed a branch
  // verdict (landed/stranded read git state alone, and a branch delete counts
  // as a push), so its stored rows carry forward and the tree reads go where
  // something moved. `entry` is the repo's stored cache entry, `pushedAt` the
  // live one from the repos listing.
  //
  // A stamp with no rows behind it is not a scan, and the gate must not read it
  // as one. That is how a repo stayed empty after the failed-read wipe of
  // 2026-08-17: the bad pass left `scannedAt` current and `branches` empty, so
  // "not pushed since the last scan" skipped it forever. Costs nothing where it
  // fires wrongly: a repo with no older branches scans an empty queue and makes
  // no calls at all.
  function needsScan(entry, pushedAt) {
    const stored = entry?.scan;
    if (!stored?.branches?.length) return true;
    const pushed = Date.parse(pushedAt || '');
    const seen = Date.parse(stored.scannedAt || '');
    if (!Number.isFinite(pushed) || !Number.isFinite(seen)) return true;
    return pushed >= seen - SCAN_SKEW_MS;
  }

  // One repo, one pass. `meta` is that repo's row from the account listing
  // (pushed_at, default_branch), `now` a millisecond clock, and the return is
  // the `fetched` shape RepoActivityCache.mergeRepo folds. Every field it
  // OMITS is a field the fold carries forward, which is the whole vocabulary
  // this function has for saying "I could not read that".
  async function crawlRepo(repo, meta, now, { makeGH, B, checks, cfg, deep = true, prev = null, caps = CAPS } = {}) {
    const def = meta?.default_branch || 'main';
    const g = makeGH(repo, def);
    // Probe the repo's declared checks in the same pass. Cheap when declared
    // (one tree read plus one commit read per distinct path, shared across the
    // batch by checkReader) and free when not: probe() short-circuits on an
    // empty list before touching the network, so a repo declaring nothing pays
    // nothing for a feature only some repos use.
    const checkFacts = (Array.isArray(cfg?.checks) && cfg.checks.length && checks)
      ? await checks.probe(cfg.checks, checkReader(g, def)).catch(() => [])
      : [];
    const [recentCommits, openPRs, branchPulls, branchWalk] = await Promise.all([
      g.commits(caps.recentCommits).catch(() => []),
      g.pulls('open', 30).catch(() => []),
      // The PR each branch last had, in ANY state (gh.branchPulls). One call per
      // repo per crawl, and the one that makes a branch row able to say merged
      // rather than "no PR": the open read above cannot see a PR that merged,
      // which is the state most branches in the recent window are actually in.
      g.branchPulls(caps.prReach).catch(() => null),
      // The dated branch list AND the authoring session per branch, from one
      // walk of one refs connection (gh.branchesDatedSessions). They used to be
      // two GraphQL calls paying twice for the same pagination; the crawl's own
      // call log put that pair at the top of the bill (2026-08-17: 79 posts,
      // 75s of request time across 22 repos). Still optional by design: a
      // failure here leaves the scan to fall back to the REST branch list and
      // the session links blank, rather than costing the repo its row.
      g.branchesDatedSessions().catch(() => null),
    ]);
    const branchSessions = branchWalk?.sessions || {};
    // The default branch's tip, this pass and last. Every verdict below is a
    // function of it and of one branch tip, so these two comparisons are what
    // let the crawl skip work rather than redo it.
    const mainSha = recentCommits[0]?.sha || '';
    const prevMainSha = prev?.repos?.[repo]?.recentCommits?.[0]?.sha || '';
    // Ahead/behind for each open PR head, so the Open view can show it without a
    // per-visit compare. The same response carries the branch's oldest unique
    // commit (BranchStatus.firstCommitDate), which is what lets the Open row
    // show a lifespan for a PR head the scan never reached. Bounded pool,
    // best-effort: a failure leaves it null.
    // Same two inputs as the scan, so the same gate: a compare of `main` to a
    // PR head cannot have moved while the PR has not been updated and the
    // default branch's tip is where it was. The stored row already holds the
    // answer, so this skips the call and carries it. (`updatedAt` moves on a
    // push to the head, so a branch that gained commits is never carried.)
    {
      const priorPR = new Map((prev?.repos?.[repo]?.openPRs || []).map(r => [r.number, r]));
      const mainHeld = prevMainSha && mainSha && prevMainSha === mainSha;
      let pi = 0;
      const prAheadBehind = async () => {
        while (pi < openPRs.length){
          const p = openPRs[pi++];
          if (!p.head) continue;
          const was = priorPR.get(p.number);
          // `was.pages` in the gate, not just a carried field: a cache written
          // before the field existed would otherwise keep answering "no pages"
          // for every PR whose head has not moved since, which on a long-lived
          // draft is forever. One re-compare per open PR, once, and then the
          // gate holds again. The same trap firstDate hit, caught here rather
          // than after a week of empty strips.
          if (mainHeld && was && was.updatedAt === p.updatedAt && was.aheadBy != null && was.pages) {
            p.aheadBy = was.aheadBy; p.behindBy = was.behindBy;
            p.firstDate = was.firstDate || '';
            // Carried with the pair it was read beside. A cache written before
            // 2026-08-18 has no breakdown, and the row shows its files glyph
            // without one until the next real compare rather than showing a 0.
            p.stats = was.stats ?? null;
            p.pages = was.pages || [];
            if (was.sessions) { p.sessions = was.sessions; p.sessionsExact = !!was.sessionsExact; }
            continue;
          }
          try {
            const d = await g.compare(def, p.head);
            p.aheadBy = d.ahead_by ?? null; p.behindBy = d.behind_by ?? null;
            // What the branch changed and in what way, free from a response
            // already in hand: this is the compare the ahead/behind pair comes
            // from, and every file in it carries a status and a line count.
            // A floor rather than a total on a sweeping branch, since GitHub
            // caps a compare's file list at 300 and reports no total.
            p.stats = B.fileStats(d.files);
            // The renderable paths out of the same response. This is the one
            // compare a FRESH branch gets: recent branches are listed date-only
            // and never scanned (see `recent` below), so without this the rows
            // a session is actually working would be the rows with no pages.
            p.pages = B.renderablePages(d.files);
            // One compare, every field it can answer, through the one reader
            // that knows what each field does past GitHub's commit cap.
            Object.assign(p, B.compareFields(d));
          }
          catch { p.aheadBy = null; p.behindBy = null; p.firstDate = ''; p.stats = null; p.pages = []; }
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, openPRs.length) }, prAheadBehind));
    }
    // Branch scan: the same split the branches view runs (recent = date-only
    // active; older = scanned, capped), through the shared orchestrator.
    let branches = [], counts = { branches: 0, active: 0, landed: 0, stranded: 0, scanned: 0, older: 0, openPRs: openPRs.length };
    let truncated = false;
    // Held outside the guarded block because the successful scan's coverage
    // travels in the returned cache entry below. Keeping this block-local made
    // every real deep scan throw while assembling its result, after all of its
    // GitHub reads had already succeeded.
    let scanned = null;
    // Whether this pass actually READ the branch list. Everything below is
    // derived from it, so a failure here means the numbers are absent rather
    // than zero, and the difference is the whole of the guard at the bottom.
    let listOk = false;
    try {
      // The walk above already fetched this; REST is the fallback for a repo
      // whose GraphQL read failed, and it carries no dates, which is why the
      // classifier treats a dateless branch as older rather than guessing.
      let list = branchWalk?.branches;
      if (!list) list = (await g.branches()).map(b => ({ name: b.name, date: '', ago: '', sha: b.commit?.sha || '', subject: '' }));
      listOk = true;
      const dated = list.filter(b => b.name !== def)
        .map(b => ({ ...b, daysAgo: b.date ? B.daysAgo(b.date, now) : Infinity }));
      const recent = dated.filter(b => b.daysAgo <= B.RECENT_DAYS).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const older = dated.filter(b => b.daysAgo > B.RECENT_DAYS).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      // What the last scan saw, so a branch whose tip has not moved since is
      // carried rather than re-derived. `mainSha` is the default branch's tip
      // from the commits read above, and it is the scan's other input: while
      // both hold, a verdict cannot have changed. See BranchStatus.needsScan.
      const prior = new Map((prev?.repos?.[repo]?.scan?.branches || []).map(r => [r.name, r]));
      scanned = deep
        ? await B.scanOlder(g, { defaultRef: def, older, cap: caps.scanCap,
                                   keep: caps.scanKeep, pool: 3, now,
                                   prior, mainSha, priorMainSha: prev?.repos?.[repo]?.scan?.mainSha || '',
                                   errorRetry: caps.errorRetry })
        : { truncated: false, rows: [] };
      truncated = scanned.truncated;
      const prSessions = Object.fromEntries(openPRs.filter(p => p.head && p.sessions?.length).map(p => [p.head, p.sessions]));
      const sessionsFor = b => {
        if (b.sessions?.length) return { sessions: b.sessions, sessionsExact: !!b.sessionsExact };
        if (prSessions[b.name]) return { sessions: prSessions[b.name], sessionsExact: true };
        const g = branchSessions[b.name];
        return g ? { sessions: [g], sessionsExact: false } : { sessions: [], sessionsExact: false };
      };
      const trim = b => ({ name: b.name, date: b.date || '', firstDate: b.firstDate || '',
                           sha: b.sha || '', subject: b.subject || '', ago: b.ago || '',
                           group: b.group, noBase: !!b.noBase, nUnique: b.nUnique || 0, nLanded: b.nLanded || 0,
                           nMissing: b.nMissing || 0, nDiffers: b.nDiffers || 0,
                           missingPaths: b.missingPaths || [], stats: b.stats || null,
                           pages: b.pages || [],
                           ...sessionsFor(b),
                           aheadBy: b.aheadBy ?? null, behindBy: b.behindBy ?? null });
      branches = [...recent.map(b => trim({ ...b, group: 'active' })), ...scanned.rows.map(trim)];
      counts = {
        branches: list.length,
        active: recent.length,
        landed: scanned.rows.filter(r => r.group === 'landed').length,
        stranded: scanned.rows.filter(r => r.group === 'stranded').length,
        scanned: scanned.rows.length,
        older: older.length,
        openPRs: openPRs.length,
      };
    } catch(e){ console.warn('activity scan', repo, e?.message || e); }

    return {
      pushedAt: meta?.pushed_at || '',
      defaultBranch: def,
      recentCommits,
      openPRs,
      // The any-state PR per branch, and how far back that read reached. Stored
      // beside openPRs rather than folded into it: the open rows carry the
      // guide body and the session, and this is a lean index whose only job is
      // to tell a branch row what became of its PR.
      //
      // OMITTED when the read failed, which is the scan guard below applied to
      // the field beside it. This read is GraphQL, its failure mode was an
      // empty `rows` array, and mergeRepo takes any array as a snapshot, so one
      // failed call replaced a repo's whole PR index with nothing and every
      // branch row went back to saying "no PR" on a cache that knew better.
      // Omitting the pair is what makes mergeRepo carry the stored index, the
      // same shape `counts` and `scan` already use. (`openPRs` above is the
      // same class and is left as it is: it is REST, and blanking it would need
      // `counts.openPRs` to learn the same distinction, which is a separate
      // change rather than a line.)
      ...(branchPulls ? { branchPRs: branchPulls.rows || [], prReach: branchPulls.reach || '' } : {}),
      // Read by mergeRepo and dropped there: it describes THIS PASS, not the
      // repo, so it must never reach the stored entry or the hash. A pass whose
      // branch list would not read is partial in exactly the same sense as a
      // quick pass: it knows less than the stored entry does.
      ...(deep && listOk && scanned ? {} : { partial: true }),
      // Counts describe the branch list, so a pass that never read one has no
      // counts to give. Omitting them entirely is what makes mergeRepo carry
      // the stored ones; sending zeros would report an empty repo.
      ...(listOk ? { counts } : {}),
      // Omitted on a quick pass, so mergeRepo carries the prior scan
      // forward. Sending { branches: [] } here would silently delete every
      // content verdict the estate has, which is the trap this guards.
      //
      // IT GUARDED ONLY HALF THE TRAP UNTIL 2026-08-17. The quick pass was
      // handled; a DEEP pass whose branch read failed still wrote
      // `{ branches: [] }` over the stored rows, because the try/catch above
      // leaves `branches` empty and carries on. Three repos were emptied that
      // way in one run (home 89 rows, web-tools-private 25, fn-data 22) while
      // the crawl reported success. `listOk` is the missing half.
      // `mainSha` is what makes the next pass able to skip: it names the default
      // branch this scan judged against, the other half of the pair (with
      // each row's own `sha`) that decides whether a verdict can have moved.
      // WHAT THIS PASS COULD NOT REACH, stored beside what it did, so the pane
      // can say how far along coverage is instead of implying it is finished.
      // `pending` is rows the budget ran out before deriving and falls to zero
      // over quiet crawls; `beyondHorizon` is what `keep` itself cut and does
      // not; `listOrdered` is whether the branch WALK cut by date or by name,
      // which decides whether any of the three is a recency statement at all.
      ...(deep && listOk && scanned ? { scan: { scannedAt: new Date(now).toISOString(), cap: caps.scanCap,
                             keep: caps.scanKeep,
                             mainSha: recentCommits[0]?.sha || '',
                             scanned: counts.scanned, older: counts.older, truncated,
                             pending: scanned.pending || 0,
                             beyondHorizon: scanned.beyondHorizon || 0,
                             listOrdered: branchWalk ? !!branchWalk.ordered : null,
                             listCapped: branchWalk ? !!branchWalk.capped : null,
                             branches } } : {}),
      // Declared checks, PROBED not judged: the stored fact is time-independent
      // so the cache hash stays stable across crawls, and the card computes the
      // verdict against its own clock at render. Always an array, never
      // undefined, so a repo that dropped its declarations clears rather than
      // keeping a retired check alive through mergeRepo's snapshot fallback.
      checks: checkFacts,
    };
  }

  window.ActivityCrawl = { CAPS, SCAN_SKEW_MS, checkReader, needsScan, crawlRepo };
})();
