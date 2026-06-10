# Research Question 3: Template Formation

> **Note**: This research question should be analyzed alongside the main project README.md, which provides the general research plan and context for the Wring project.

## Primary Question

How to convert repeated spans into parameterized templates?

## Core Question

When should two co-occurring repeated spans become one template vs remain separate? This is analogous to `Diff_EditCost`—a granularity knob.

## Research Focus

### Anchor-Sequence Search
- Given repeated spans, find ordered chains (A – gap – B – gap – C) that recur across occurrences
- Technique: emit event stream of (pos, anchorID), then sliding-window join or segment-bucketed joins
- Directly yields template skeletons with gaps as candidate slots
- Require at least one O(#candidates) alignment strategy, not O(#candidates²)

### Offset Histograms
- For candidate pairs (A, B), compute distribution of `pos(B) − pos(A)` across occurrences
- Peaks indicate consistent relative positioning
- Gate by frequency/length to avoid quadratic blowup

### Multi-Occurrence Alignment
- Align all instances of a candidate template region to infer literal vs slot positions
- Baseline: center-star (pick highest-scoring instance as center, align all others pairwise, merge)

### Gap Analysis
- Gap entropy as stitching heuristic: high-entropy gaps become slots; low-entropy gaps suggest merging adjacent literals
- Minimum literal length, maximum slot count, compression gain threshold

### Slot Boundaries
- Primary mode: align with token boundaries
- Optional refinement: split tokens when it materially improves MDL without harming interpretability
