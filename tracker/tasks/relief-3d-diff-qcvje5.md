---
id: relief-3d-diff-qcvje5
title: Revisit Relief, the 3D difference viewer
status: dormant
opened: 2026-11-15
---
# Revisit Relief, the 3D difference viewer

Relief is a difference viewer the owner built as a private claude.ai artifact. It renders a two-text comparison in CSS 3D: removed lines sink behind the page, added lines stand in front of it, and a moved block lifts and crosses to its new place along an arc. One old-to-new slider plays the edits one at a time, the page sways a few degrees when left alone, and a Profile view turns the page edge-on as a map of the whole comparison.

The owner parked the concept on 2026-11-15. A test that put static depth on the viewer's Changes mode (`#1320`, closed unmerged) did not help the redline read and, in the owner's words, lacked the charm of the original.

What the test showed:
- On a phone, each struck or added run of words becomes an inline box, since a transform does not apply to inline text, so a long run wraps onto lines of its own.
- At desktop width, raised added words partly overlap the sunk struck words beside them.

This session's reading, not the owner's: Relief's appeal appears to come from motion (the slider, the crossing blocks, the sway) and from line-based text, where whole lines move as units. Static depth on rendered prose kept the clutter without the motion.

If revived:
- **Diff page.** The likeliest host is the Diff page, as a view beside Split and Unified.
- **Viewer.** Another is the viewer for non-Markdown text reached by a `#base=` link, which Changes mode does not cover.
- **Engine.** Either way, use the repo's diff engine rather than Relief's own. Relief computes a full LCS table and reports the whole middle of a comparison as replaced once the table passes 30 million cells.

## Related

- [Relief](https://claude.ai/artifact/Apdz3WnQik2svwd5X1LZ6Y): the prototype. It is a private artifact, readable by the owner's sessions with the Artifact tool.
- `lib/kits/text-diff.js`: the patience diff a revival should use. Its header explains why the repo dropped full LCS tables.
- `pages/diff-tool.html`: the likeliest host. It has Split, Unified and Patch views, takes `#d=` and `?a=&b=`, and receives the Stage's Open in Diff handoff.
- `lib/alpineComponents/viewer.js`: Changes mode, the test's host. It is limited to Markdown files in a repository.
- `#1320`, branch `claude/cool-fermat-fqswkf` at `486a9581`: the Changes-mode test, a 3D toggle on the legend row.

## Done when

The owner decides whether Relief joins Web Tools, and where.

## Progress log
- 2026-11-15: Filed dormant at the owner's word, after the Changes-mode test (`#1320`) was judged not to help. No next step until the owner names this task.
