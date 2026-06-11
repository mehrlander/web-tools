# Branch guide: claude/review-unfinished-branches-16akol

Review-only session: inventory of every unmerged chunk across the repo's ~150 branches, and a processing order for them.

⭐ [This guide](https://github.com/mehrlander/web-tools/blob/claude/review-unfinished-branches-16akol/BRANCH-GUIDE.md) (the session's findings live in chat; no code changed)

**Findings, in brief:**
- The June stacked chain (each session branched from the last) is fully merged via PRs #146-#171; only its leaves are live.
- History was truncated ~May 29 (main's root is the PR #125 snapshot); all older branches share no ancestor with main. Their content was carried into the snapshot or superseded, with two exceptions noted below.

**Live unmerged chunks:**
1. PR #170 (`claude/nice-hamilton-z1wj9e`): pages reorg + scope-filter chips, open, merges clean. Body describes only the chips commit; the branch tip also carries the reorg commit.
2. `claude/wizardly-pascal-j7peg3`: 2 small CONVENTIONS.md preamble-link commits, merges clean, no PR.
3. `claude/peaceful-carson-f7ymn5`: the Wring import (kit + 2 demo pages + archive snapshot), 1 large commit, no PR; only conflict vs main is the generated `dist/web-tools.js`.
4. `claude/good-idea-list-xALwO`: `docs/IDEAS.md` backlog (May 30), merges clean but content is two weeks stale.
5. `claude/zelda-music-list-7k9GI`: `piano-pieces.md` exists only here (orphaned history; salvage = copy the file).

**Next steps / open threads:**
- Process in the order above; details and links in the session chat.
- After processing, the merged June chain branches (~20) and the pre-snapshot orphans (~120) are deletable cleanup.
