# The branch form

A branch is an object of type `branch` ([subjects.csv](../subjects.csv)). Its
form has two carriers:

- **In the app:** the branch takeover over the Branches view, addressed by
  `&detail=` ([views/branches.md](../views/branches.md)).
- **Standalone:** [`pages/branch.html`](../../pages/branch.html), the estate's
  shareable single-branch address: `#gh=owner/repo@branch[&base=ref]`, or
  `#gh=owner/repo&pr=<n>` for a PR's own head and base.

The takeover's panes, the overlay, the sidebar's second ref and drop-on-a-branch
are documented in [branch-overlay.md](../branch-overlay.md).

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
agreement with it by `scripts/check-branch-status.mjs`. It is advisory; deleting
a branch happens on GitHub.
