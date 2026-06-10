# History

Superseded design specs and abandoned prototype artifacts from earlier stages of
the project. None of this is the live design. The canonical, current description is
the root [`ARCHITECTURE.md`](../../ARCHITECTURE.md); where anything here conflicts
with it, `ARCHITECTURE.md` wins.

This material is kept because the *reasoning* in it is still useful: interface
contracts, failure-mode catalogs, browser/memory considerations, and the decoy-problem
analysis all outlived the algorithms they were written for.

## Why this folder exists: four numbering schemes

The single biggest source of confusion in this repo's history is that **four different
documents each impose their own numbering, and none is a relabeling of another.** They
describe overlapping concerns at different granularities and from different moments in
the project's evolution.

| Scheme | Where | Count | The sequence |
|---|---|---|---|
| **Stages** (live) | [`ARCHITECTURE.md`](../../ARCHITECTURE.md) | 5 | Tokenize · Sequitur · Bookend Merge · Selection · Extraction |
| **Phases** (archived here) | `phase-1`…`phase-4` below | 4 | Discovery · Topology · Refinement · Selection |
| **Research questions** | [`../research/`](../research/README.md) | 6 | tokenization-typing · repeat-primitives · template-formation · objective-selection · adjacent-domains · implementation |
| **Findings pipeline** | [`../research/FINDINGS.md`](../research/FINDINGS.md) | 6 | Abstraction · Segmentation · Mining · Refinement · Selection · Extraction |

Do not try to read these as one renamed sequence. The closest honest mapping of the
**Phases** onto the live **Stages** is:

| Phase (archived) | Status | Closest live Stage(s) | What changed |
|---|---|---|---|
| 1 · Discovery | Partially superseded | Tokenize + Sequitur | Suffix array / LCP enumeration → grammar induction (Sequitur/Re-Pair). Interface contracts and failure modes still valid. |
| 2 · Topology | Superseded | (folded into Bookend Merge) | Pairwise gap-variance discrimination → structural Bookend Merge. The decoy-problem analysis survives as background. |
| 3 · Refinement | Partially superseded | Bookend Merge | Center-star alignment and the MDL cost model still apply; the input interface changed (templates now come from Bookend Merge, not chain mining). |
| 4 · Selection | Current in content, archived in form | Selection | Algorithms (weighted interval scheduling, MDL, hierarchy, residual diagnosis) are path-independent and apply unmodified. The spec is written in the prior-architecture idiom and cross-references Phase 3's I/O, so it lives here; the live carriers are `ARCHITECTURE.md` §4 and `selection/mdl-select.js`. |

## Contents

- **`phase-1-discovery/`** — substring-discovery spec, plus a **`prototype/`** subfolder
  of abandoned suffix-tree artifacts:
  - `prototype/custom-suffix-tree-engine-summary.md` — writeup of the SoA / Ukkonen
    engine that the surfaced demo ([`/demos/custom-suffix-tree-engine.html`](../../demos/README.md))
    is built from.
  - `prototype/mnemonist-suffix-tree-demo.html` + `prototype/mnemonist-suffix-tree-demo-results.md`
    — a diagnostic page evaluating the `mnemonist` library. This is the evidence behind
    research Q6's finding that no off-the-shelf JS library offers frequency-filtered
    repeat enumeration (`getRepeats(minLen, minFreq)`).
  - `prototype/custom-suffix-tree-engine-results.json` — sample repeat-registry output.
- **`phase-2-topology/`** — pairwise consistency / gap-variance spec (superseded).
- **`phase-3-refinement/`** — alignment vs. consolidation spec.
- **`phase-4-selection/`** — selection spec (current in content; see table above).
