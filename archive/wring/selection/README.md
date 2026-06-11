# Stage 4: Selection (MDL plus weighted interval scheduling)

The fuller version of Stage 4 from [`ARCHITECTURE.md`](../ARCHITECTURE.md).
`groupByTemplate` already does a greedy MDL slice, but it assigns each *record*
to one template and assumes records don't overlap. This module handles the
general case: **candidate templates whose instances compete for the same
characters**, resolved by minimizing total description length.

```
totalCost = dictionaryCost(used templates)   // literal bytes + slot overhead, paid once per template
          + dataCost(selected instances)     // template ref + slot encoding
          + residualCost(uncovered chars)     // everything left unexplained
```

## What's here

| Function | Guarantee |
|---|---|
| `weightedIntervalSchedule(intervals)` | **Exact.** O(n log n) DP for the max-gain non-overlapping subset of half-open `[start,end)` intervals. Verified optimal against brute force over 400 random cases. |
| `mdlCost(selected, templatesById, docLength)` | Description-length accounting for a selection (dictionary + data + residual). |
| `selectTemplates({templates, instances, docLength})` | Greedy template inclusion (Krimp-style) wrapped around exact scheduling. |

## Why greedy on top of an exact scheduler?

Each template carries a fixed `dictBytes` cost paid once if it's used at all.
That shared fixed cost makes the joint "which templates **and** which instances"
problem NP-hard (a facility-location flavor). So:

- The **instance** sub-problem (given a fixed set of allowed templates, pick the
  best non-overlapping instances) is solved **exactly** by weighted interval
  scheduling.
- The **template** sub-problem (which templates to "open") is solved by a
  greedy loop that adds the single most cost-reducing template each round and
  stops when none helps. This is the Krimp-style accept-if-it-compresses heuristic
  named in ARCHITECTURE.

The tests demonstrate the behavior that matters: a worthwhile template is kept,
a template that can't pay for its dictionary cost is dropped, and when a broad
template and a narrow one overlap on the same span, the combination with the
lower total cost wins.

## Status / wiring

Standalone and tested; not yet wired into a front-end. It becomes load-bearing
once a candidate generator produces **overlapping** instances, for example a
suffix-tree or grammar repeat enumerator, or a Stage 3 that proposes competing
templates over the same regions. The DOM and line-based pipelines produce
non-overlapping records, where `groupByTemplate`'s simpler greedy already
suffices, so this is the selection layer the *next* candidate generator will need.

```bash
node selection/test-mdl-select.js
```
