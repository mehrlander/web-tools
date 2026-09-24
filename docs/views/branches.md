# Branches

`?view=branches`, a pane of the Activity stop (`lib/alpineComponents/estate.js`),
lists every estate branch in one cross-repo list, freshest first, from the
activity cache. `&detail=` opens one branch's form
([forms/branch.md](../forms/branch.md)).

## The list

- **Scope chips** are `BRANCH_SCOPES` in `estate.js`, each with its own `note`;
  the default is Recent. Open, Abandoned and Unrecorded ignore the time window.
  **Repo chips** narrow to one repo without changing the counts.
- **A row** is tinted by what became of its PR (ready, draft, merged, closed
  unmerged, never proposed, or `PR ?` past the PR index's reach, `prReach`). Its
  action line, in order: the repo chip (the repo's own menu), the GitHub menu
  (every row opens github.com, except Copy branch name), the session mark, the
  Files route, Stage, then route chips. The arrows (commits ahead and behind)
  hold the right edge.
- **Counts open cards.** Files changed, new and missing, and the two arrows,
  each open a panel: the head count, a shape digest from the cache, then the
  file list and patches from one compare through `BranchBrief`'s memo. A card's
  fresher numbers are written back into the row in memory (`absorbCompare`),
  never into the cache, and never touch the landed verdict.
- **Stage** sends the branch's changed files to the Stage at `ref=branch`.
- A row with no merge base reads `no merge base`, since every number on it
  spans more than the branch.

The Repos cards borrow the same cache for their rollups; the abandoned count is
computed from the same rows as the chip, so the two cannot disagree.

## The activity cache

`state/activity.json` in the private registry, built by
[`lib/kits/activity-crawl.js`](../../lib/kits/activity-crawl.js) and
[`lib/kits/repo-activity-cache.js`](../../lib/kits/repo-activity-cache.js)
(`refreshActivityCache`). It stores, per estate repo, branches with dates and
session links, open PRs, the any-state PR index (`branchPulls`, capped at 100
per repo), recent default-branch commits, and each branch's content verdict from
`lib/kits/branch-status.js`. A visit kicks it on a per-browser throttle; State
shows the throttle and forces a refresh. Invariants an edit can break:

- **Every read that feeds a commit is fresh** (`GH.FRESH`), and the next read
  is reconciled against what this page last wrote
  ([`lib/kits/last-write.js`](../../lib/kits/last-write.js), `readForFold`),
  because the contents API is only eventually consistent after a write.
- **Commit only on material change**; `changedRepos` is both the count reported
  and the gate, so they cannot disagree. A document stamp decides which copy is
  newer, not the clock.
- **A verdict is carried when neither input moved** (`needsScan`: the branch
  tip, the default tip, or a missing or errored row). `noBase` rows carry while
  their tip holds. At most `ACTIVITY_ERROR_RETRY` errored rows retry per repo.
- **A quiet repo is skipped whole**: its `pushed_at` and its PR watermark
  (`gh.prWatermark`) both match the last crawl. Both halves are required, since
  `pushed_at` cannot see a PR open or close. Watermarks live in `localStorage`,
  not in the cache. A forced refresh ignores the gate. Held by
  `activity-watermark-gate.test.mjs`.
- `buildCache` carries a failed or skipped repo's stored entry forward.
- The crawl reports progress on the shell's `crawlProgress` channel, which this
  pane, Sessions and State all draw, and hands its document along on
  `web-tools:activity-refreshed` so listeners need not re-read it.
