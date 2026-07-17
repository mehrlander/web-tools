// Branch-survey math: the content-level landed/stranded signal, ported from
// home's tools/branch-survey.sh (the CLI reference instrument). Squash merges
// and history rewrites make ref-level "unmerged" unreliable, so the signal to
// read is content: does each path a branch uniquely touched hold, at the
// branch tip, bytes that exist on the default branch right now, at the same
// path or moved anywhere in the tree.
//
// Pure functions only, so they can be unit-tested and checked for agreement
// against the CLI (scripts/check-branch-survey.mjs). The network fetches that
// feed them (branch list, default-branch tree, per-branch compare + tree) live
// in the branches view (lib/alpineComponents/branches.js). Attaches to
// window.BranchSurvey, loaded via gh.load('branch-survey.js').
(() => {
  // Calibration carried over from the CLI: the recently-active window, and the
  // landed-ratio threshold hand-verified against the five branches home's
  // June 14 reconcile memo confirmed as landed (they score 85-95%; shared
  // files keep evolving on the default branch after a squash, so 100% never
  // happens for a real branch).
  const RECENT_DAYS = 14;
  const LANDED_PCT = 80;

  // {blobs, paths} from a recursive git tree listing: `blobs` is the set of
  // every blob sha in the tree (recognizes content that landed and then
  // MOVED), `paths` maps each file path to its blob sha (separates "we both
  // have this file, bytes differ" churn from truly absent content). Accepts
  // the API's tree-entry array ({path, type, sha}) directly.
  function treeSets(entries) {
    const blobs = new Set();
    const paths = new Map();
    for (const e of entries || []) {
      if (e.type !== 'blob') continue;
      blobs.add(e.sha);
      paths.set(e.path, e.sha);
    }
    return { blobs, paths };
  }

  // The content signal for one branch. Inputs:
  //   uniquePaths  paths the branch's unique commits touched (from compare
  //                files, or `git log --not <base>` at the CLI)
  //   tip          treeSets() of the branch tip
  //   main         treeSets() of the default branch
  // Per path, in CLI order: identical bytes at the same path -> landed; blob
  // present anywhere on main -> landed (moved); absent from the branch tip
  // (the branch deleted it) -> landed, a deletion carries no stranded content;
  // otherwise unlanded, and MISSING when the path is absent from main in both
  // path and bytes — the strong stranded evidence. What is unlanded but not
  // missing is churn: either unlanded edits or main's forward drift,
  // indistinguishable cheaply.
  function landedSignal(uniquePaths, tip, main) {
    const unique = [...new Set(uniquePaths || [])];
    let nLanded = 0;
    const missingPaths = [];
    for (const p of unique) {
      const tipSha = tip.paths.get(p);
      if (tipSha === undefined) { nLanded++; continue; }
      if (main.paths.get(p) === tipSha || main.blobs.has(tipSha)) { nLanded++; continue; }
      if (!main.paths.has(p)) missingPaths.push(p);
    }
    return { nUnique: unique.length, nLanded, nMissing: missingPaths.length, missingPaths };
  }

  // 'active' | 'landed' | 'stranded', mirroring the CLI: fresh work is active
  // regardless of signal; then the content signal separates landed (nothing
  // missing, or 80%+ of touched paths match main byte-for-byte — an empty
  // unique set is the squash-merge shadow, whose whole diff already exists on
  // main) from stranded. The honest limits carry over too: a branch whose
  // files landed and kept evolving on main can still read stranded, and an
  // edit-only branch can hide in landed; the compare link is ground truth.
  function classify({ daysAgo, nUnique, nLanded, nMissing }, opts = {}) {
    const recentDays = opts.recentDays ?? RECENT_DAYS;
    const landedPct = opts.landedPct ?? LANDED_PCT;
    if (daysAgo <= recentDays) return 'active';
    if (nUnique === 0 || nMissing === 0 || nLanded * 100 >= nUnique * landedPct) return 'landed';
    return 'stranded';
  }

  // Whole days from an ISO commit date to `now` (ms since epoch). Matches the
  // CLI's integer (NOW - unix) / 86400.
  function daysAgo(isoDate, now) {
    return Math.floor((now - new Date(isoDate).getTime()) / 86400000);
  }

  window.BranchSurvey = { RECENT_DAYS, LANDED_PCT, treeSets, landedSignal, classify, daysAgo };
})();
