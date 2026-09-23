---
id: file-history-in-branch-view-hxtdep
title: Explore a fuller file history in the Branch view
status: backlog
opened: 2026-09-23
size: ?
awaiting: owner to choose a direction; open-ended by request, bolder ideas welcome
---
# Explore a fuller file history in the Branch view

The Branch view (`pages/branch.html`) compares each changed file against the merge base, main today, or one of the file's earlier versions on the branch (#761, #763). It answers "what changed since X". It does not yet give a file's history as a thing to read: how the file evolved edit by edit, what one edit changed on its own, how it read at an earlier point, or its history beyond the branch, the way GitHub's per-file history and blame do.

This task is deliberately open-ended. The owner (2026-09-23) wants a session that explores the space before settling a mechanism, and does not want the minimal option taken by default: a bolder design is in scope. Linking out to GitHub's history is one option, not the answer.

Ideas raised so far, none chosen:
- **Step through edits.** Picking a version moves both sides: show vK, compared against vK-1. The view buttons then show vK whole or the one edit's change. The card already fetches both sides by commit; the header counts and GitHub links would follow the shown version.
- **A history view per file:** a timeline of commits touching the path, across branches and main, not only the branch's own.
- **Link out** to GitHub's history and blame for the path.

## Related

- `lib/alpineComponents/file-review.js`: the card. `loadVersions`, `versionChoices` and `pickVersion` (per-card, not broadcast) are the current version mechanism; `adoptCompare` moves only the base side.
- `lib/alpineComponents/branch-brief.js`: the swiper header and compare menu; `cmpBase` (merge base) and `compareChoices`.
- `lib/kits/branch-brief.js`: keeps the compare's `merge_base_commit` as `mergeBase`.
- `lib/kits/md-diff.js`: the rendered markdown diff; its jsdiff loader also feeds the per-slide change counts.
- PR #763: versions, rendered-diff default, change counts. PR #761: merge-base comparison and the compare menu.

## Done when

A direction is chosen with the owner and either built, or split into tasks for the parts that decouple.

## Progress log
- 2026-09-23: Filed at the owner's request after #763 merged, from the session that built the compare menu and per-file versions. Next: a session that surveys options (including how GitHub presents file history) and brings a recommendation before building.
