# Branch guide: claude/repo-structure-branch-guide-m0v7ib

Assessment session on the branch-guide vs tracker delineation, GitHub Projects, and formalizing the caption and reorientation as skills; file changes so far are replacing the guide PR #204 left on main and recording the added-repo mechanics in the environment docs.

⭐ [docs/environment/container.md](https://github.com/mehrlander/web-tools/blob/claude/repo-structure-branch-guide-m0v7ib/docs/environment/container.md)

**Changed:**
- docs/environment/container.md ([new](https://github.com/mehrlander/web-tools/blob/claude/repo-structure-branch-guide-m0v7ib/docs/environment/container.md), [main](https://github.com/mehrlander/web-tools/blob/main/docs/environment/container.md)) adds the added-repos section (primary-repo session metadata, no PR button for added repos, compare-link bridge)
- BRANCH-GUIDE.md ([new](https://github.com/mehrlander/web-tools/blob/claude/repo-structure-branch-guide-m0v7ib/BRANCH-GUIDE.md), [main](https://github.com/mehrlander/web-tools/blob/main/BRANCH-GUIDE.md)) replaces the guide the merged o8miz0 branch left on main

**Next steps / open threads:**
- Assessment delivered in chat. Standing recommendations: tracker holds intent, branch guide holds branch state (slimming rule when a branch is claimed against a task); stay on the file tracker over GitHub Projects; guides on main are the designed fallback of UI merges without wrap-up, so no enforcement needed (optional: an Action deleting BRANCH-GUIDE.md on push to main).
- Proposed but not built: /caption and /reorient as two separate portable skills (rows in PORTABLE.md, fetch lines in the sync hook), plus the CONVENTIONS.md sentence naming them; a wrap-up amendment for added repos (hand over the compare link where no PR button exists).
- Wrap-up deletion of this file also clears the leftover guide from main on merge.
