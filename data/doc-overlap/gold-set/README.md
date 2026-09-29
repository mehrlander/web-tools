# Gold set: Restated lens

Hand-labelled passage pairs that score the cosine cutoff of the Themes tab's
Restated lens. [`gold.csv`](gold.csv) is the record: one row per sampled pair,
with the sampling weight, both passages' offsets and hashes, the reader's label
and one-clause rationale, the skeptic's verdict and quoted note, and the final
`relation`, `reading` and `consolidate`. The label definitions are in the
docstring of [`scripts/doc-overlap-gold.py`](../../../scripts/doc-overlap-gold.py),
which built, checked and scored it.

The file is precious. A rerun of its agents would label a different set, so it
is not regenerated, only checked (`tools/test/doc-overlap.test.mjs`). More
labels come from a new sample with a new seed.

Sample: seed 20260929, 159 of 545 pairs, `sample.csv` md5
`9641b867501fb02ce2114cbc45700630`, rebuilt by
`python3 scripts/doc-overlap-gold.py sample --run <dir>` from the tables in
`data/doc-overlap/` at the commit that added this folder.

Scorecards: [2026-09-29](2026-09-29-scorecard.md).
