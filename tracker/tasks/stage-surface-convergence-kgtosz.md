---
id: stage-surface-convergence-kgtosz
title: Converge the stage and surface item schemas
status: backlog
opened: 2026-07-18
---
# Converge the stage and surface item schemas

The stage and the surface are the same substrate (ordered lists of cross-repo refs) with different verbs: the stage is a workbench (bundle, send, link), the surface a shelf (arrangement, commentary). Keep them as two named things but converge at the schema level: a stage item becomes a surface item restricted to the ref kinds. Two bridges then follow: "open as stage" on a surface (pull its ref items into the stage, ignore prose) and "save as surface" from the stage (promote a working set; commentary enters at the moment of promotion, which is when it is worth writing). Optional per-item note on staged refs rides the shared shape for free; the bundle can carry it in its header lines. A markdown literate source form (ref lines as machine-readable spine, prose between) is the possible future shared format, not part of this task. Context: PR #239's stage rework and the session discussion behind it. Done means: shared item vocabulary defined, both bridges working in show-repo, docs/show-repo.md updated.

Related smaller lever, take or split: the finder's root repos (Recent/Search) come from pickerRoots (open repo + quick links + targets); the estate registry could drive them instead.

## Progress log
- 2026-07-18: Filed at wrap-up of the stage-rework session (PR #239), which moved the stage to the estate context and left this convergence as the agreed direction.
