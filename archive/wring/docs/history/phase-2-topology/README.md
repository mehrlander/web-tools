# Phase 2: Topology

> **Status: SUPERSEDED.** The pairwise gap-variance approach is replaced by Bookend Merge in the current architecture. The decoy problem analysis and distance-decay concepts remain valuable as background. See [`ARCHITECTURE.md`](../../../ARCHITECTURE.md).

Reduce document to symbol stream; score pairwise consistency; mine anchor chains.

---

## Interface

### Input

| Field | Type | Description |
|-------|------|-------------|
| `vocabulary` | `Uint32Array` | From Phase 1: `[substringOffset, substringLength, symbolId, ...]` |
| `positions` | `Uint32Array` | Per-symbol occurrence positions from Phase 1 |
| `symbolStream` | `Uint32Array` | Document as symbol IDs in occurrence order |
| `maxGap` | `number` | Maximum character distance for adjacency consideration |

### Output

| Field | Type | Description |
|-------|------|-------------|
| `distanceMatrix` | `Float32Array` | Sparse pairwise consistency scores: `[symbolA, symbolB, score, ...]` |
| `candidateChains` | `Array<Uint32Array>` | Ordered symbol sequences with consistent spacing |
| `chainPositions` | `Array<Uint32Array>` | Per-chain occurrence positions in document |
| `residual` | `Array<{start: number, end: number}>` | Spans not participating in any chain. Maintains Character Allocation: every byte is in either a chain occurrence or residual. |

---

## Goal

Distinguish **structural anchors** from **variable decoys**. Both are repeated substrings found in Phase 1, but only anchors define template topology. Decoys (common terms like "USD", "the", recurring dates) appear at inconsistent distances relative to structural anchors.

The key insight: structural symbols appear at consistent "lags" relative to each other; decoys appear at random/inconsistent distances.

---

## Optimization Problems

| Problem | Input | Objective | Constraint |
|---------|-------|-----------|------------|
| Pairwise Consistency | Symbol stream, symbol pair (A, B) | Measure variance of gap distances across all co-occurrences | Low variance -> structural; high variance -> floating |
| Distance Matrix | Symbol stream, all symbol pairs | Pairwise consistency scores as adjacency weights | Sparse: only pairs within max gap window |
| Sequence Mining | Distance matrix, max gap | Ordered anchor chains (paths) with consistent spacing | Chains must appear >= k times |

---

## The Decoy Problem

When mining templates, repetition alone is insufficient signal. Consider:

```
Invoice No: 12345    USD 100.00    Total Due: 100.00
Invoice No: 67890    USD 250.00    Total Due: 250.00
```

Both "Invoice No:" and "USD" are repeated substrings. But:
- **"Invoice No:"** is a structural anchor (template literal)
- **"USD"** is a variable decoy (appears inside slot data)

A naive adjacency check might link "Invoice No:" to "USD" because USD frequently follows. The distance matrix discriminates: the gap between "Invoice No:" and "Total Due:" has low variance across instances; the gap to "USD" has high variance (depends on invoice number length).

---

## Algorithms

### Pairwise Consistency Scoring

For each symbol pair (A, B), collect all gap distances where B follows A within `maxGap`:

```
gaps(A, B) = [d1, d2, d3, ...]  where di = pos(Bi) - pos(Ai)
```

Consistency score inversely proportional to variance:

```
score(A, B) = 1 / (1 + variance(gaps(A, B)))
```

Or using coefficient of variation for scale-invariance:

```
score(A, B) = 1 / (1 + stddev(gaps) / mean(gaps))
```

### Distance Decay

Instead of binary match (gap < threshold), apply continuous decay:

```
contribution(gap) = exp(-gap / decay_constant)
```

Accumulate contributions across all co-occurrences. Sharp accumulation at specific lags indicates structural relationship; smeared accumulation indicates noise.

### Cross-Correlation

Treat symbol A and B occurrences as signals. Compute cross-correlation at various lags:
- **Sharp spike** at specific lag -> rigid template structure
- **Broad peak** -> loose association (e.g., footer at variable distance from header)

### Sequential Pattern Mining

#### PrefixSpan

Projection-based algorithm for frequent subsequence mining:
1. Find frequent 1-sequences
2. For each frequent prefix, project database and recursively mine extensions
3. MaxGap constraint prunes projections where gap exceeds threshold

Efficient for mining "broken" sequences that span variable content.

#### GSP (Generalized Sequential Patterns)

Iterative candidate generation:
1. Generate candidate k-sequences from (k-1)-sequences
2. Scan database to count support
3. Prune infrequent candidates

MaxGap constraint integrated into candidate generation.

---

## Failure Modes

### Conflation

Distinct structures collapse into a single generic template via shared syntax.

**Example**: Two different table formats both use `|` as delimiter. Mining merges them into one malformed template.

**Mitigations**:
- Position-relative scoring (templates occurring in different document regions treated separately)
- Instance clustering by slot content similarity before chain extraction

### Scale Bias

Capturing the broad container while missing discrete items within (or vice versa).

**Example**: Mining finds "BEGIN SECTION ... END SECTION" but misses the repeated rows inside.

**Mitigations**:
- Multi-scale mining with different maxGap values
- Hierarchical chain detection: mine within already-identified containers

---

## Browser Considerations

### Sparse Distance Matrix

Full N x N matrix for N symbols is infeasible. Store only pairs with non-trivial co-occurrence within maxGap:

```
distanceMatrix: Float32Array  // [symbolA, symbolB, score, symbolA, symbolB, score, ...]
```

### Streaming Consistency Computation

For large documents, compute pairwise statistics in streaming fashion:
1. Maintain sliding window of recent symbol positions
2. Update running variance estimates incrementally (Welford's algorithm)
3. Flush low-scoring pairs to minimize memory
