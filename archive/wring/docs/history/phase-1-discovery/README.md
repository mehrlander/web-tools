# Phase 1: Substring Discovery

> **Status: PARTIALLY SUPERSEDED.** The interface contracts, failure modes, and browser considerations remain valid. The algorithm (suffix tree / SA+LCP enumeration) is replaced by Sequitur grammar induction in the current architecture. See [`ARCHITECTURE.md`](../../../ARCHITECTURE.md).

Enumerate repeated substrings; build the vocabulary that subsequent phases consume.

---

## Interface

### Input

| Field | Type | Description |
|-------|------|-------------|
| `document` | `string` | Raw document as UTF-8 string |
| `minLength` | `number` | Minimum substring length (default: 3) |
| `minFrequency` | `number` | Minimum occurrence count (default: 2) |

### Output

| Field | Type | Description |
|-------|------|-------------|
| `vocabulary` | `Uint32Array` | Flat array: `[substringOffset, substringLength, symbolId, ...repeating]` |
| `positions` | `Uint32Array` | Per-symbol occurrence positions: `[symbolId, count, pos0, pos1, ..., symbolId, count, ...]` |
| `symbolStream` | `Uint32Array` | High-density array of vocabulary item IDs in occurrence order. Does NOT contain sentinels for gaps; inter-symbol distances must be calculated using the `positions` array which maps IDs to raw document offsets. |
| `residual` | `Array<{start: number, end: number}>` | **Source of truth** for all characters not captured in the `symbolStream`. Every byte in the original document is accounted for in either a vocabulary item occurrence or a residual span. |

The `vocabulary` array provides the Vocabulary-to-Symbol mapping: each entry maps a substring (via offset + length into the original document) to a unique symbol ID.

---

## Goal

Identify all repeated substrings that meet minimum length and frequency thresholds. These substrings form the raw vocabulary—the alphabet of potential template components. Variable content (slots) and structural anchors (literals) are indistinguishable at this phase; that discrimination happens in Phase 2.

---

## Optimization Problems

| Problem | Input | Objective | Constraint |
|---------|-------|-----------|------------|
| Repeat Enumeration | Document, min length, min frequency | All maximal repeated substrings | O(n) space; efficient LCP-interval traversal |
| Anchor Ranking | Repeated substrings | Score by structural signal vs. incidental repetition | Length x frequency baseline; topological neighborhood weight |

---

## Algorithms

### Suffix Array + LCP Interval Traversal

The suffix array `SA` sorts all suffixes lexicographically. The LCP (Longest Common Prefix) array stores the shared prefix length between adjacent suffixes. Together, they enable O(n) enumeration of all repeated substrings.

**LCP Intervals**: An interval `[i, j]` in the LCP array where `lcp[k] >= m` for all `k` in `(i, j]` corresponds to a repeated substring of length `m` occurring `j - i + 1` times.

### Suffix Tree Internal Nodes

Each internal node in a suffix tree represents a repeated substring. The node's string depth gives the substring length; the leaf count gives the frequency. Internal nodes can be enumerated in O(n) time.

### Suffix Automaton

The suffix automaton compactly represents all substrings. States with multiple incoming transitions correspond to repeated substrings. Offers O(n) construction and enumeration.

### Winnowing / Fingerprinting

For documents exceeding browser memory limits, winnowing provides a coarse seeding strategy:
- Hash all k-grams
- Select minimum hash per sliding window
- Use selected fingerprints as candidate anchors for targeted verification

---

## Ranking Heuristics

### Length x Frequency Baseline

```
score(s) = length(s) * frequency(s)
```

Captures raw "text coverage" but does not distinguish structural anchors from variable decoys.

### Topological Neighborhood Weight

Score adjustment based on co-occurrence patterns with other vocabulary items. Deferred to Phase 2 for full implementation, but Phase 1 may compute preliminary adjacency statistics.

---

## Failure Modes

### Token Splitting

Pattern boundaries land inside semantic atoms (words, numbers, identifiers).

**Symptoms**:
- Vocabulary items like `"ount: "` instead of `"Amount: "`
- Numeric prefixes captured without full number

**Mitigations**:
- Post-filter vocabulary to prefer token-aligned boundaries
- Score penalty for mid-token boundaries (requires tokenization pass)

### Vocabulary Explosion

Too many low-value substrings inflate the vocabulary without contributing structural signal.

**Symptoms**:
- Thousands of 2-3 character substrings
- Memory pressure in browser context

**Mitigations**:
- Aggressive minimum length/frequency thresholds
- Top-k selection by score
- Subsumption filtering: discard substring if fully contained in higher-scoring superstring with equal frequency

---

## Browser Considerations

### Memory Budget

For a 1MB document, the suffix array alone requires 4MB (32-bit indices). LCP array adds another 4MB. Total working memory for indexing: ~10x document size.

**Strategies**:
- Stream processing for documents > 1MB
- WASM suffix array construction to minimize GC pressure
- Lazy LCP computation (only materialize intervals above threshold)

### TypedArray Usage

All position and length data stored in `Uint32Array` for cache efficiency and reduced GC overhead. Symbol IDs are 32-bit unsigned integers.
