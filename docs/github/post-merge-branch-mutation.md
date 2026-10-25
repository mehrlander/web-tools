# Post-Merge Branch Mutation

A developer merges a feature branch into main, then returns to the branch and
adds commits, amends history, rebases, or force-pushes.

## Why it creates problems

The merge commit stays accurate, but the source branch name no longer means the
reviewed and merged work. Adding commits to a merged branch creates ambiguity
about what the merge delivered; rewriting or force-pushing it creates
coordination cost for every clone, pull request, compare view and CI record
that holds the old tip, and for tools such as bisect and blame. New work
branched from the old tip can produce duplication or conflicts.

## The Bottom Line

A merged branch should stop being treated as live workspace.

One label would otherwise carry two meanings: the reviewed work that was
integrated, and the later work that happened afterward.

## Rule of Thumb

**Merged means closed.**

Once a branch has been merged into a shared target branch, do not keep working
on it. Delete it, retire it, or leave it untouched.

Follow-up work gets a new branch from the current tip of the target branch. Then
open a new pull request.

A branch is a workbench, not a second home.

---

In this repo the rule is the 🟣 Merged state's "Further edits go in a new PR"
([CONVERSATION.md](../CONVERSATION.md)): a session that continues after a merge
starts a new branch from the current tip of the target branch and opens a *new*
PR rather than reopening the merged one.
