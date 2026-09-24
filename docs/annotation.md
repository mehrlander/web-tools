# Annotating a document

An **annotation** splits a document into units about a sentence long and gives each
unit a **label** from a declared vocabulary (what the unit is), a **verdict**
(`KEEP` or `DROP`), and an optional **note**. It is stored beside the document as a
**standoff**: a JSON file of character spans, the question, the vocabulary, and a
`sha256` of the document it describes. Any question works; the vocabulary is data.

The user reviews it in [`pages/audit-render.html`](../pages/audit-render.html),
which shows the whole document tinted by label, removed units struck through, and
lets them relabel, remove, add a note, split, merge, or drag a unit's edges, then
save to the branch.

The scripts are in [`scripts/annotate/`](../scripts/annotate/); the builder is
[`tools/build/audit-payload.py`](../tools/build/audit-payload.py).

## Vocabularies

A vocabulary is a TSV of `label`, `side`, `gloss`, and an optional `color`
(`r,g,b`). The default is doc-craft's
[`skills/doc-craft/binding/vocab.tsv`](../skills/doc-craft/binding/vocab.tsv).

## The pass

1. **Segment.** `python3 scripts/annotate/segment.py <file> <first-line> <last-line> > units.jsonl`
2. **Label.** Write `labels.tsv` with columns `uid`, `label`, `verdict`.
3. **Build and hand over.**
   `python3 tools/build/audit-payload.py standoff <doc> <run-dir> [--vocab <tsv>] [--question <text>]`,
   The page loads the standoff from `?src=<spec>`, and Save writes it back;
   `… payload <doc> <run-dir> --inject <page>` embeds it instead. Hand the user
   the page before rewriting anything.
4. **Rewrite** from the corrected annotation.
   `python3 scripts/annotate/materialize.py <standoff.json> <doc> --out <file>`
   drafts it from the `DROP`s and insertions, and lists the noted units to reword.
5. **Check.**
   `python3 scripts/annotate/check.py units.jsonl labels.tsv <original> <rewrite> [--section <heading>]`,
   then `python3 scripts/annotate/seams.py` with the same arguments. `check.py`
   over-reports: most candidates on loose prose are reworded survivors, so probe
   each for its distinctive words before calling it a loss. If the rewrite
   removes a `KEEP` unit after all, change its verdict to `DROP`.
6. **Record** surprises in
   [`scripts/annotate/LOG.md`](../scripts/annotate/LOG.md).

The scripts cannot see a definition that exists only in a tooltip, or a paragraph
repeated within one file. Look for both, and run the repo's own gates as well.

## Revising the annotation

The page and `python3 scripts/annotate/ops.py <standoff.json> <patch.json> <doc> [--write]`
apply a patch, a list of operations keyed by `uid`. A patch that breaks the
annotation is refused whole; without `--write` it is a dry run.

| operation | is |
| --- | --- |
| `{"op":"split","uid":…,"at":<offset>}` | one unit becomes two, meeting at `at` |
| `{"op":"merge","uid":…}` | a unit absorbs its successor |
| `{"op":"shift","after":…,"to":<offset>}` | the boundary after that unit moves |
| `{"op":"relabel","uid":…,"label":…}` | a label from the declared vocabulary |
| `{"op":"verdict","uid":…,"verdict":…}` | a verdict from the declared list |
| `{"op":"note","uid":…,"text":…}` | what the label cannot say; empty text clears it |
| `{"op":"insert","after":…,"text":…,"as":…}` | text the document lacks; `as` is `block` or `run` |
