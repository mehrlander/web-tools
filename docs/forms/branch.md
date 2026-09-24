# The branch form

## The branch review: landed / stranded per branch

**Retired as a per-repo view on 2026-08-14; the reading lives in Activity's
Branches tab**, which is the same rollup with the same signal across every repo
at once and opens the branch takeover. `?view=branches` aliases there.

The math outlived the view and is the part worth knowing. Every branch sorts
into **recently active** (commits in the last 14 days; judge nothing yet),
**likely landed**, and **likely stranded**, on a content-level signal rather
than `ahead_by`: which of the branch's uniquely-touched paths hold, at the
branch tip, bytes the default branch holds right now, at the same path or moved
anywhere in the tree. **Missing** counts paths absent from the default branch in
both path and bytes, the strong stranded evidence. Squash merges and history
rewrites make ref-level "unmerged" (and `ahead_by`, whose count on a
rewrite-orphaned branch spans its whole line, marked `*`) unreliable; the
content columns are the ones to read.

It is the browser port of home's `tools/unmerged-branches.sh` (the CLI reference
instrument), lives in `lib/kits/branch-status.js` as pure unit-tested functions,
and is held in agreement with the CLI by `scripts/check-branch-status.mjs` (on
home's 56-branch estate: 52 exact, 4 divergent only where the CLI's git rename
detection credits moved-and-evolved content the API cannot see, all in the
conservative direction). Fetch cost per branch: one compare (with a
commits-list fallback for no-merge-base branches) and one recursive tree, over
one branch list and one default-branch tree.

Advisory and read-only, matching the CLI's posture: it frames the per-branch
reconcile judgment and decides nothing. The delete action lives on GitHub.

## The branch overlay: preview a cross-repo change before it merges

The overlay's contract lives in its own reference now,
[branch-overlay.md](branch-overlay.md): the branch-detail takeover, the
overlay's file substitution, the sidebar's second ref, the ref bar's in-place
actions, and dropping a file on a branch. What stays here is the boundary:
the overlay is how the shell reads a branch's version of the estate in place,
and the branch page (`pages/branch.html`) remains the shareable single-branch
address.
