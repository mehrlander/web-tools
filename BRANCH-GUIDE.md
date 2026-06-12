# Branch guide: claude/keen-carson-w36rui

Design review, no code changes yet: assessing how the PR #173 pages-cards-in-show-repo integration should actually fit together (top-level lens tabs?), what the card view offers that file nav doesn't, whether the FAB is becoming the new show-repo, and what show-repo is uniquely for (including a possible token-holding "actions" surface for requests the Claude session can't execute).

⭐ [show-repo as merged](https://mehrlander.github.io/web-tools/pages/show-repo/show-repo.html) (the layout under review)

**Changed:**
- BRANCH-GUIDE.md (this file)

**Next steps / open threads:**
- Pick a direction: Files/Pages as top-level lenses under the repo@ref header vs. removing the pages section from show-repo
- Decide whether the "actions console" idea (paste a payload from chat, review, execute with the local token) is worth prototyping
- Clarify FAB vs show-repo division of labor before adding more to either
