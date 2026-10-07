# The branch form

A branch is an object of type `branch` ([subjects.csv](../subjects.csv)). Its
form has two carriers:

- **In the app:** the branch takeover over the Branches view, addressed by
  `&detail=` ([views/branches.md](../views/branches.md)).
- **Standalone:** [`pages/branch.html`](../../pages/branch.html), the estate's
  shareable single-branch address: `#gh=owner/repo@branch[&base=ref]`, or
  `#gh=owner/repo&pr=<n>` for a PR's own head and base.

The takeover is documented below, in [Branch detail: the takeover](#branch-detail-the-takeover).

## Landed, differs, missing

The branch's content verdict is computed by
[`lib/kits/branch-status.js`](../../lib/kits/branch-status.js), pure and
unit-tested, and shared by the activity crawl and the live scan
(`scanBranchLive`). For each path the branch uniquely touched:

- **landed:** the default branch holds those bytes now, at this path or moved
  anywhere, or the branch deleted the path;
- **differs:** the default branch holds the path with other bytes. That is
  either unlanded edits or the default branch's own drift since, and the scan
  cannot tell which, so inspect these files before deleting the branch;
- **missing:** neither path nor bytes. Deleting the branch loses these
  outright.

Read these, not `ahead_by`: squash merges and history rewrites make ref-level
"unmerged" unreliable, and a branch with no merge base reports its whole line.
The kit is a browser port of home's `tools/unmerged-branches.sh`, held in
agreement with it by `node/check-branch-status.mjs`. It is advisory; deleting
a branch happens on GitHub.

## Branch detail: the takeover

In the app, a branch opens as a swipe deck over the Branches view: one slide per
branch in the list, frozen at the tap, each mounting the `branchBrief` component
directly (no iframe). `&detail=owner/repo@branch` is stamped while it is open
and cleared on close. A link naming a branch the list no longer holds still
opens, as a list of one.

**The Look row** links each app view the branch changes at the branch's own tip
(`app/?use=<sha>&view=<key>`), plus a render link per changed page. Which views
count is `routeActivity.routesTouched`'s rule, not this page's: a file fewer
than three routes declare puts the branch on that route, and wider files only
count as shared. Routes are read from `docs/app-routes.csv` at the branch ref,
so a branch in another repo gets no row. `?use=` serves `dist/web-tools.js`, not
`lib/`, so a branch that changed a component without rebuilding shows the old
code, and the row says **bundle not rebuilt**. `npm run showing` gives the same
address, and a test holds the two together.

**The guide** is the PR body, rendered through `kits/guide-render.js` and read
live, never copied. `#gh=owner/repo&pr=<n>` addresses one PR at its own head
and base. A branch with no PR shows its commit subjects instead.

**The verdict** is measured in the page from two recursive tree reads through
`BranchStatus.pathStates`, unless the host lends the crawl's answer in `facts`.
A truncated tree means a path GitHub left out reads as missing, so the missing
count is a ceiling. With no merge base there is no compare, and the page lists
the lent missing paths instead.

### Rules an edit can break

- **The compare is deferred** whenever something else can answer the head:
  `facts`, lent from the row the reader tapped, decides it, not `framed`. A
  cold `pages/branch.html` has no `facts` and reads the compare up front.
  `kits/branch-brief.js` caches the guide and the compare separately
  (`readGuide`, `readCompare`), because the compare carries every patch and the
  pre-build alone can make it megabytes.
- **The kit chain is pulled on first use** in `mountDeck`. The pre-build
  registers `branchBrief` but not `kits/branch-brief.js`, and a slide without it
  renders only a loading notice.
- **Opening replaces rather than stacks.** The old deck is `drop()`ped, not
  closed: `close()` leaves through history, which cannot land under a newer
  deck, so the old one would leak still mounted.
- **Slides far from the reader are emptied.** `swipe-deck.js` keeps `keep`
  slides either side (default 2) and calls `release(i, slide)` for the rest; a
  host frees its keyed global there, or every visited branch stays mounted.
- **The file deck announces each file** to the sidebar through
  [`kits/subject-channel.js`](../../lib/kits/subject-channel.js), writing to
  this window and, when hosted in a toss, the parent, since the listening
  sidebar may be one window up. A swipe reloads only the per-file branch scan;
  the guide, version chip and default branch are keyed on repo and ref and
  survive it.

`node/render/scenarios/branch-deck.mjs` measures the deck end to end.
