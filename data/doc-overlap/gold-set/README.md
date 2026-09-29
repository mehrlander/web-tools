# Gold set: Related lens

Hand-labelled passage pairs that score the cosine cutoffs of the Themes tab's
Related lens (named Restated until 2026-09-29). [`gold.csv`](gold.csv) is the record: one row per sampled pair,
with the sampling weight, both passages' offsets and hashes, the reader's label
and one-clause rationale, the skeptic's verdict and quoted note, and the final
`relation`, `reading` and `consolidate`. The label definitions are in the
docstring of [`scripts/doc-overlap-gold.py`](../../../scripts/doc-overlap-gold.py),
which built, checked and scored it.

The file is precious. A rerun of its agents would label a different set, so it
is not regenerated, only checked (`tools/test/doc-overlap.test.mjs`). More
labels come from a new sample with a new seed.

Samples, told apart by the `seed` column:

- seed 20260929: 159 of 545 pairs, `sample.csv` md5
  `9641b867501fb02ce2114cbc45700630`, drawn by
  `python3 scripts/doc-overlap-gold.py sample --run <dir>`.
- seed 20260930: 116 of the 268 long pairs (shorter passage 20+ words) the
  first sample had not labelled, `sample.csv` md5
  `187382308faf743d3522123ca55c7589`, drawn by
  `sample --run <dir> --seed 20260930 --prefix h --long-only --n 120`, which
  holds out every pair already in `gold.csv`.

The first was drawn from the tables in `data/doc-overlap/` at commit
`534d6e53`; the second from the same scan at `9fc4208f`, which added the
`target_words` column and two files without an embedding match to those pairs.

Scorecards: [2026-09-29](2026-09-29-scorecard.md), which set the lens's
cutoffs, and [2026-09-29, held out](2026-09-29-held-out-scorecard.md), which
scored them on pairs they were not tuned on.
