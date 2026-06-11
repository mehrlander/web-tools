# docs

Background material for Wring. None of this is required to *run* the tool — the
runnable story lives in the root [`README.md`](../README.md) and the canonical design
in [`ARCHITECTURE.md`](../ARCHITECTURE.md). This umbrella holds the *why* and the
*how we got here*.

| Folder | What's in it | Start with |
|---|---|---|
| [`concepts/`](concepts/) | The conceptual layer: premises, objectives, vocabulary, and the decoy problem behind the mechanics. | [`Foundations.md`](concepts/Foundations.md) |
| [`research/`](research/README.md) | Deep-research reports on each core question, plus their distilled findings — the inputs that produced the current architecture. | [`research/FINDINGS.md`](research/FINDINGS.md) |
| [`history/`](history/README.md) | Superseded design specs and abandoned prototype artifacts, kept for the reasoning that outlived their algorithms. | [`history/README.md`](history/README.md) |

## concepts/

- [`Foundations.md`](concepts/Foundations.md) — the premises, objectives, and primitive model (design rationale)
- [`Intuition.md`](concepts/Intuition.md) — first-principles observations about template structure
- [`Terms.md`](concepts/Terms.md) — vocabulary for matching (seat, bind, register) and emergence (crystallize, induce, distill)
- [`Order.md`](concepts/Order.md) — quantifying ordered relationships; structural anchors vs. variable decoys

## research/

Six research questions (tokenization, repeat primitives, template formation, objective
selection, adjacent domains, implementation), each with the question posed, the raw
reports collected, and a distilled summary. Consolidated in
[`FINDINGS.md`](research/FINDINGS.md). See [`research/README.md`](research/README.md).

## history/

Four earlier *phase* specs (Discovery, Topology, Refinement, Selection) from before the
Sequitur + Bookend Merge pivot, plus the suffix-tree prototype artifacts. The
[`history/README.md`](history/README.md) maps the four-phase numbering onto the live
five-stage pipeline and flags what still applies.
