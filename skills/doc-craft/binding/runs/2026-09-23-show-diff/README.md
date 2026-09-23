# Annotation run: skills/show-diff/SKILL.md, 2026-09-23

One pass of the method in [`docs/annotation.md`](../../../../../docs/annotation.md), kept so `pages/audit-render.html` can load it by link.

- `units.jsonl`: the 44 units `segment.py` cut.
- `labels.tsv`: the label and verdict first given to each unit.
- `standoff.json`: the annotation. The page's Save writes here.
- `payload.json`: `standoff.json` joined to the document text, which the page reads from `?src=`. Rebuild it after a save with `python3 tools/build/audit-payload.py payload skills/show-diff/SKILL.md <this directory>`.

Open it at `pages/audit-render.html?use=<branch>&src=skills/doc-craft/binding/runs/2026-09-23-show-diff/payload.json`.
