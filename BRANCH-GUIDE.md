# Branch guide: claude/hanging-work-review-psozqz

Session reviewing hanging work across the repo's branches. The code change is a docs note pinning down how branch deletion works in-session (it can't, and why), a capture-before-delete caution, a correction that commit-pushes to *other* branches do work, and the marker-commit pattern for flagging a stray branch you can't delete.

⭐ [docs/environment/capabilities.md](https://github.com/mehrlander/web-tools/blob/claude/hanging-work-review-psozqz/docs/environment/capabilities.md)

**Changed:**
- docs/environment/capabilities.md ([new](https://github.com/mehrlander/web-tools/blob/claude/hanging-work-review-psozqz/docs/environment/capabilities.md), [main](https://github.com/mehrlander/web-tools/blob/main/docs/environment/capabilities.md))

**Next steps / open threads:**
- Ready to merge and close. Supersedes the note on `claude/busy-carson-x1mufj`, which has been marked "SUPERSEDED, safe to delete" (a marker commit pushed to its tip); delete it from the GitHub UI after this merges.
- Other stray branches the user may delete: `claude/delete-probe-temp` (left over from the original deletion test), and the orphan leaves listed in the `review-unfinished-branches` guide.
- Still-hanging elsewhere (not touched): `overnight-exploration-3qwe3z` (text-atlas feature, actively iterated), `wizardly-pascal-j7peg3` (CONVENTIONS.md tappable links), `good-idea-list-xALwO` (stale IDEAS.md backlog).
