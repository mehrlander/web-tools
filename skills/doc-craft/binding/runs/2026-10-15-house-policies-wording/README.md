# Wording audit of the house-policies revision, 2026-10-15

One run of a sentence-by-sentence wording audit, kept so it can be opened in `pages/audit-render.html`. The target is `docs/house-policies.md` with the revision proposed in PR #950 applied.

- `payload.json` is the `audit/1` payload the page loads: the revised text, 158 units, and each unit's label, verdict and reader notes. Open it with `pages/audit-render.html?use=<this branch>&src=skills/doc-craft/binding/runs/2026-10-15-house-policies-wording/payload.json`.
- `vocab.tsv` is the label vocabulary: OK, WEAK and WRONG. Reader notes keep the readers' original labels, one per rule from doc-craft's General Principles and the Qualified writing rules.

Two Sonnet readers labeled each half of the document independently; a unit carries a label where both flagged it, and every reader note is attached. A fifth Sonnet reader read the whole file for the rules a single sentence cannot show; its findings are not in the payload.
