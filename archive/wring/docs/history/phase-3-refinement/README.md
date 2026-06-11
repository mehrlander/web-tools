# Phase 3: Refinement

> **Status: PARTIALLY SUPERSEDED.** Alignment, consolidation, and slot typing concepts still apply to the Bookend Merge output. The center-star alignment algorithm and MDL cost model remain valid. The input interface has changed (templates come from Bookend Merge, not chain mining). See [`ARCHITECTURE.md`](../../../ARCHITECTURE.md).

Gravitate templates toward idealized forms; distinguish alignment from consolidation.

---

## Interface

### Input

| Field | Type | Description |
|-------|------|-------------|
| `candidateChains` | `Array<Uint32Array>` | Ordered symbol sequences from Phase 2 |
| `chainPositions` | `Array<Uint32Array>` | Per-chain occurrence positions |
| `document` | `string` | Original document for slot content extraction |
| `vocabulary` | `Uint32Array` | Symbol-to-substring mapping from Phase 1 |

### Output

| Field | Type | Description |
|-------|------|-------------|
| `templates` | `Array<Template>` | Refined template structures (see below) |
| `instances` | `Array<Instance>` | Per-template occurrence bindings (see below) |
| `residual` | `Array<{start: number, end: number}>` | Spans not bound to any template instance. Maintains Character Allocation: every byte is in either a template instance or residual. |

```typescript
interface Template {
  id: number;
  literals: Uint32Array;      // [offset, length, offset, length, ...]
  slotCount: number;
  slotTypes: Array<SlotType>; // Inferred type per slot
}

interface Instance {
  templateId: number;
  start: number;              // Document offset
  end: number;
  slotValues: Uint32Array;    // [offset, length, ...] - absolute offsets into the original document string
}

interface SlotType {
  kind: 'integer' | 'decimal' | 'word' | 'identifier' | 'date' | 'unconstrained';
  pattern?: string;           // Optional regex refinement
}
```

---

## Goal

Transform candidate chains into well-formed templates. This involves two distinct operations:

1. **Alignment**: Make instances consistent with each other (adjust boundaries so all instances share the same literal/slot structure)
2. **Consolidation**: Cost-based merge/split decisions (should similar templates unify or remain distinct?)

---

## Alignment vs. Consolidation

### Alignment

Given a set of instances believed to share a template, adjust their boundaries so literals coincide exactly.

**Problem**: Raw instances from Phase 2 may have ragged edges:
```
Instance 1: "Amount: $100.00"
Instance 2: "Amount:  $50.00"    // Extra space
Instance 3: "Amount: $1,000.00" // Comma in number
```

Alignment resolves: the literal is "Amount: $" and the slot captures the numeric portion (with or without comma).

### Consolidation

Given multiple templates, decide whether to merge or split.

**Merge**: Two templates with minor literal differences may unify if the merge reduces total description cost.
```
Template A: "Total: ${amount}"
Template B: "Total:  ${amount}"   // Extra space
-> Merge into single template with flexible whitespace
```

**Split**: A high-variance template may benefit from partitioning into distinct sub-templates.
```
Template: "${label}: ${value}"    // Too generic
-> Split into "Name: ${name}", "Amount: ${amount}", etc.
```

---

## Optimization Problems

| Problem | Input | Objective | Constraint |
|---------|-------|-----------|------------|
| Idealized Refinement | Candidate template, bound instances | Gravitate toward instances with coherent slot signatures | Reject/expunge instances that pollute the structural model |
| Template Merge/Split | Similar or high-variance templates | Unify or partition templates toward idealized form | Merge/split based on dictionary cost vs. slot entropy |
| Slot Boundary Refinement | Template skeleton, instance alignments | Minimize slot entropy while preserving token integrity | Boundaries align with token edges or stable whitespace boundaries |
| Slot Typing | Slot values across instances | Infer regex, character class, or grammar for content | Aids interpretability and validation |

---

## Algorithms

### Center-Star Alignment

For multi-instance comparison without expensive all-pairs alignment:

1. Select **center** instance (minimize sum of edit distances to all others)
2. Align each instance to the center
3. Derive consensus template from aligned positions

Complexity: O(k * n) where k = instance count, n = instance length (vs. O(k^2 * n) for all-pairs).

### Gap Entropy Stitching

When deciding slot boundaries, compute entropy of each position across instances:

```
entropy(position) = -sum(p * log(p)) for each character at that position
```

- **Low entropy**: Position is part of literal (same character across instances)
- **High entropy**: Position is part of slot (variable content)

Boundary placed at entropy transitions. Ties broken by token alignment preference.

### Edit Distance for Near-Miss Detection

Instances with small edit distance from a template but failing to match may be "near-misses":
- Typos in source document
- Template variants worth promoting to distinct templates
- Noise to be discarded

Threshold-based triage: if `editDistance(instance, template) < threshold`, attempt repair.

---

## Consolidation Cost Model

### Dictionary Cost

Each distinct template adds to the "dictionary" that must be transmitted:
```
dictionaryCost(template) = sum(literalLengths) + slotCount * slotOverhead
```

Merging reduces dictionary size but may increase slot entropy.

### Slot Entropy Cost

Variable slot content has encoding cost:
```
slotCost(slot) = sum over instances of length(slotValue) * entropyFactor(slotType)
```

Lower entropy (e.g., integers) has lower cost than unconstrained strings.

### Merge Decision

```
merge(A, B) if dictionaryCost(A) + dictionaryCost(B) > dictionaryCost(merged) + deltaSlotCost
```

Where `deltaSlotCost` captures increased slot entropy from merging.

---

## Slot Typing

Examine slot values across all instances to infer type:

| Observed Values | Inferred Type | Pattern |
|-----------------|---------------|---------|
| "123", "456", "7890" | integer | `\d+` |
| "12.50", "100.00" | decimal | `\d+\.\d{2}` |
| "USD", "EUR", "GBP" | enum | `USD\|EUR\|GBP` |
| "2024-01-15", "2024-12-31" | date | `\d{4}-\d{2}-\d{2}` |
| Mixed/no pattern | unconstrained | `.*` |

Typing improves interpretability and enables validation of future matches.

---

## Failure Modes

### Shattering

Cohesive logical units fracture into disconnected micro-templates.

**Example**: A table row becomes three separate templates (one per cell) instead of one row template.

**Mitigations**:
- Minimum literal span threshold
- Adjacency bonus: templates that consistently co-occur should merge
- User review for borderline cases

### Cost Modeling Errors

Miscalculating the utility of merging variants versus keeping them distinct.

**Example**: Merging "Price: $X" and "Cost: $X" into "${label}: $X" loses semantic distinction.

**Mitigations**:
- Literal entropy penalty (varying literals are expensive)
- Semantic similarity scoring if NLP is available
- Conservative merge thresholds

---

## Browser Considerations

### Incremental Alignment

For large instance sets, compute alignments incrementally:
1. Start with first two instances
2. Add instances one at a time, updating consensus
3. Early-exit if alignment quality drops below threshold

### Slot Type Inference

Use sampling for large instance counts:
- Randomly sample N slot values
- Infer type from sample
- Verify against remaining instances
