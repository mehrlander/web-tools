# Phase 4: Selection

> **Status: CURRENT.** The algorithms in this spec (weighted interval scheduling, MDL objective, hierarchy inference, residual diagnosis) are path-independent and apply without modification to the Sequitur + Bookend Merge architecture. See [`ARCHITECTURE.md`](../../../ARCHITECTURE.md).

Global optimization; final arbitration of the document's real estate.

---

## Interface

### Input

| Field | Type | Description |
|-------|------|-------------|
| `templates` | `Array<Template>` | Refined templates from Phase 3 |
| `instances` | `Array<Instance>` | All candidate instances from Phase 3 |
| `document` | `string` | Original document |

### Output

| Field | Type | Description |
|-------|------|-------------|
| `selectedTemplates` | `Array<Template>` | Final template set |
| `selectedInstances` | `Array<Instance>` | Non-overlapping instance assignments |
| `hierarchy` | `Uint32Array` | Parent-child relationships: `[childInstanceId, parentInstanceId, ...]` |
| `residual` | `Array<{start: number, end: number, entropy: number}>` | Un-patterned spans with entropy annotation |

The output provides complete document coverage: every character belongs to either a selected instance or residual.

---

## Goal

Receive the global pool of candidate instances from all refined templates. Act as final arbitrator:

1. **Resolve overlaps**: When instances conflict, select the subset maximizing total value
2. **Infer hierarchy**: Determine nesting relationships (which templates contain which)
3. **Select templates**: Choose the template set that best balances compression and interpretability
4. **Diagnose residual**: Characterize un-matched spans as noise vs. latent structure

---

## Optimization Problems

| Problem | Input | Objective | Constraint |
|---------|-------|-----------|------------|
| Overlap Resolution | Conflicting candidate instances | Select non-overlapping subset maximizing total gain | Weighted interval scheduling (flat) or DAG (hierarchical) |
| Hierarchical Nesting | Selected templates/instances | Infer nesting; build structural parse tree | Parent must fully enclose child instances |
| Template Selection | Global template pool | Maximize total DRY gain and intelligibility | Balance model complexity vs. document coverage |
| Residual Diagnosis | Unmatched spans | Distinguish noise from near-misses; assess entropy | High entropy -> satiety; low entropy -> latent structure |

---

## Overlap Resolution

### Flat Model: Weighted Interval Scheduling

Each instance is an interval `[start, end]` with weight (value). Select non-overlapping subset maximizing total weight.

**Algorithm**: Dynamic programming in O(n log n):
1. Sort instances by end position
2. For each instance, compute latest non-overlapping predecessor (binary search)
3. `dp[i] = max(dp[i-1], weight[i] + dp[predecessor[i]])`

**Weight function**:
```
weight(instance) = coverage(instance) * templateQuality(template)
```

Where:
- `coverage` = character span
- `templateQuality` = frequency * literalRatio * slotTypeScore

### Hierarchical Model: DAG Selection

Allow nested instances where parent fully encloses children.

**Representation**: DAG where edges represent valid nesting relationships.

**Algorithm**:
1. Compute transitive containment graph
2. For each node, compute maximum value achievable from its subtree
3. Select root nodes; recursively select best children

**Constraint**: Child instance must be fully contained within a slot of the parent, not overlapping with parent literals.

---

## Template Selection

### MDL-Style Objective

Minimize total description length:

```
totalCost = dictionaryCost + dataCost
```

Where:
- `dictionaryCost` = cost to describe selected templates
- `dataCost` = cost to encode document using templates + residual

**Dictionary cost**:
```
dictionaryCost = sum over templates of (literalBytes + slotOverhead * slotCount)
```

**Data cost**:
```
dataCost = sum over instances of (templateIdBits + slotEncodingCost) + residualCost
```

Where `templateIdBits` is the cost to reference a specific template (e.g., `ceil(log2(selectedTemplateCount))` bits per instance reference).

### Greedy Selection (Krimp-style)

1. Sort templates by compression gain (coverage - cost)
2. Greedily accept templates if total code length decreases
3. Stop when no template improves compression

**Degenerate prevention**: Explicit costs prevent:
- Single-character templates
- Templates matching only once
- Templates where slot cost exceeds literal savings

---

## Hierarchical Nesting

### Nesting Rules

1. Parent instance fully encloses child instance: `parent.start <= child.start && child.end <= parent.end`
2. Child must fall within a parent slot, not overlap parent literals
3. No partial overlaps allowed

### Parse Tree Construction

```typescript
interface ParseNode {
  instanceId: number;
  children: ParseNode[];
  slotIndex: number;  // Which parent slot contains this child
}
```

Build bottom-up:
1. Identify leaf instances (no valid children)
2. Iteratively assign children to enclosing parents
3. Resolve conflicts (child could nest in multiple parents) by preferring tighter fit

---

## Residual Diagnosis

### Entropy Assessment

For each residual span, compute character entropy:

```
entropy(span) = -sum over chars of (freq(c) / len * log(freq(c) / len))
```

**Interpretation**:
- **High entropy** (approaching log(alphabet)): Random/varied content, likely genuine noise or unique data
- **Low entropy**: Repetitive content, potentially latent structure missed by earlier phases

### Near-Miss Detection

Residual spans with low edit distance to existing templates are near-misses:

```
isNearMiss(span) = min over templates of editDistance(span, template) < threshold
```

Near-misses indicate:
- Typos or OCR errors in source
- Template variants worth revisiting in Phase 3
- Boundary errors in instance detection

### Satiety Signal

When residual entropy is uniformly high and near-miss rate is low, further mining is unlikely to yield structure. This signals satiety—the document has been adequately wrung.

---

## Failure Modes

### Cost Modeling Errors

Slot encoding costs that don't reflect actual complexity.

**Problem hierarchy**:
- Whitespace: nearly free (predictable)
- Bounded integers: cheap (log encoding)
- Short enums: cheap (dictionary)
- Unconstrained strings: expensive (full entropy)

**Mitigation**: Use slot types from Phase 3 to inform encoding cost model.

### Over-Selection

Accepting low-value templates that add model complexity without meaningful compression.

**Mitigation**:
- Minimum coverage threshold per template
- Compression ratio floor (template must save at least X bytes)
- User review for marginal templates

### Under-Selection

Rejecting valid templates due to overly aggressive pruning.

**Mitigation**:
- Preserve templates with high literal ratio even if low frequency
- Consider interpretability value (template might be worth keeping for human understanding even if marginal compression)

---

## Browser Considerations

### Interval Scheduling Implementation

```typescript
function selectInstances(instances: Instance[]): Instance[] {
  // Sort by end position
  instances.sort((a, b) => a.end - b.end);

  // Binary search for predecessor
  const predecessors = new Int32Array(instances.length);
  for (let i = 0; i < instances.length; i++) {
    predecessors[i] = binarySearchPredecessor(instances, i);
  }

  // DP
  const dp = new Float64Array(instances.length + 1);
  const selected = new Uint8Array(instances.length);

  for (let i = 0; i < instances.length; i++) {
    const take = instances[i].weight + (predecessors[i] >= 0 ? dp[predecessors[i] + 1] : 0);
    const skip = dp[i];
    if (take > skip) {
      dp[i + 1] = take;
      selected[i] = 1;
    } else {
      dp[i + 1] = skip;
    }
  }

  // Backtrack to recover selection
  return backtrack(instances, dp, predecessors, selected);
}
```

### Streaming Residual Analysis

For large documents, compute residual statistics in streaming fashion:
1. Mark covered spans as instances are selected
2. Compute entropy incrementally over residual spans
3. Sample near-miss detection (don't check every residual against every template)
