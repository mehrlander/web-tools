# Wring: Consideration of Initial Findings

## Summary

The initial findings consolidate useful research but inherit assumptions from log parsing that don't fit the general problem. This document identifies the mismatch and sketches a revised approach.

---

## The Core Mismatch

**The log parsing assumption:**

> Slots are known in advance. Timestamps, IPs, session IDs—domain knowledge tells you what varies. Pre-type these before mining. Sequitur confirms patterns exist around pre-declared slot positions.

**The actual problem:**

> Given one document, discover its structure. No prior knowledge of what varies. Slots must emerge from repetition, not declaration.

Pre-typing is a shortcut that works when you know the domain. For general text—legislation, HTML, contracts, mixed documents—you don't know in advance what will vary. A slot might be:

- A dollar amount
- A bill number  
- An agency name
- An arbitrary noun phrase
- A nested clause
- Any sequence of tokens

Pre-typing can't enumerate this. The mechanism must be structural.

---

## What Sequitur Actually Gives You

Sequitur finds **exact repeats** and organizes them hierarchically. It builds a grammar by replacing repeated digrams with rules.

**What it requires:** A sequence of symbols (the alphabet).

**What it produces:** Rules whose right-hand sides are sequences of terminals and rule references.

**What it doesn't do:** Handle variation. If two sequences differ at any position, they're different. No rule formed.

This is the gap. Sequitur finds structure in identical sequences. Slot discovery requires finding structure across *nearly* identical sequences.

---

## The Revised Approach: Bookend Merge

Separate the concerns:

| Step | Operation | Output |
|------|-----------|--------|
| 1. Tokenize | Segment text into symbols | Token stream |
| 2. Mine (Sequitur) | Find exact repeats | Grammar with many rules |
| 3. Align rules | Compare rule bodies, find shared bookends | Candidate merges |
| 4. Merge | Collapse rules with matching prefix/suffix | Rules with slots |
| 5. Select | Rank by MDL, bookend length, occurrences | Final templates |
| 6. Extract | Map slots to original values | Structured output |

**The key insight:** Slots are discovered as positions where rule bodies differ but bookends match. No pre-declaration needed.

---

## Bookend Merge in Detail

**After Sequitur, you have rules:**

```
R1 → A B C D E
R2 → A B X D E  
R3 → A B Y D E
```

**Align rule bodies:**

```
R1: [A, B, C, D, E]
R2: [A, B, X, D, E]
R3: [A, B, Y, D, E]

Shared prefix: [A, B]
Shared suffix: [D, E]
Varying middle: {C, X, Y}
```

**Merge into slotted rule:**

```
R' → A B $1 D E
$1 := {C, X, Y}
```

The slot's identity is the observed set. Characterization (numeric, enum, timestamp) is optional post-hoc analysis, not a prerequisite.

---

## Open Questions for Bookend Merge

| Question | Considerations |
|----------|----------------|
| **Which rules to compare?** | All pairs is O(n²). Need clustering or indexing by prefix/suffix. |
| **Minimum bookend length?** | Too short = coincidental matches. Too long = misses patterns. |
| **Ambiguous splits?** | `[A, B, C, X, D, E]` vs `[A, B, Y, C, D, E]`—multiple valid prefix/suffix? |
| **Multi-position variance?** | Two positions differ—one compound slot or two slots? |
| **Correlation across slots?** | If positions 2 and 4 vary together, track or ignore? |
| **Nested variation?** | Varying middle is itself a rule reference—collapse alternatives? |

---

## What Remains Valid from Initial Findings

| Component | Status | Notes |
|-----------|--------|-------|
| Sequitur as mining primitive | ✓ Valid | Core mechanism for exact structure |
| Grammar hierarchy | ✓ Valid | Natural output; flatten if needed |
| MDL as objective | ✓ Valid | Principled selection criterion |
| SA+LCP | ? Revisit | Alternative path; may be useful for bookend enumeration |
| Tokenization | ✓ Valid | Defines alphabet; separate from typing |
| Pre-typing | ✗ Revise | Optional optimization, not core mechanism |
| Center-star alignment | ✓ Valid | Applies to bookend merge step |
| Entropy for slot classification | ✓ Valid | Post-hoc characterization |
| Flat vs nested output | ✓ Valid | Both supported via flattening |

---

## Revised Pipeline

```
┌─────────────────┐
│  TOKENIZATION   │  Define alphabet. No typing required.
│                 │  Character-class splits or domain-aware.
└────────┬────────┘
         ▼
┌─────────────────┐
│    SEQUITUR     │  Find exact repeats. Build grammar.
│                 │  Output: many fine-grained rules.
└────────┬────────┘
         ▼
┌─────────────────┐
│  BOOKEND MERGE  │  Align rule bodies. Find shared prefix/suffix.
│                 │  Merge near-identical rules. Slots emerge.
└────────┬────────┘
         ▼
┌─────────────────┐
│   SELECTION     │  Rank by MDL, bookend length, occurrence count.
│                 │  Prune low-value templates.
└────────┬────────┘
         ▼
┌─────────────────┐
│   EXTRACTION    │  Map template occurrences to original text.
│                 │  Extract slot values. Reconstruct to verify.
└─────────────────┘
```

---

## Tokenization: Separate Concern

Tokenization defines the alphabet Sequitur operates on. This is independent of slot discovery.

**Options:**

| Granularity | What Sequitur sees | Trade-off |
|-------------|-------------------|-----------|
| Characters | Every character | Maximum pattern discovery; rules may cut across meaningful units |
| Words | Space-delimited | Clean boundaries; misses sub-word patterns |
| Punctuation-aware | Split on character-class transitions | Balanced default |
| Domain-aware | HTML tags, code tokens, etc. | Best boundaries for domain; requires parser |

**Pre-typing is optional optimization:**

If you *know* certain tokens will vary (dates, IPs, numbers), normalizing them before Sequitur increases pattern frequency. But it's not required. Bookend merge discovers slots either way.

---

## Slots as Sets

Banish types from the core model.

A slot is a position in a template. Its definition is the set of observed values:

```
$1 := {123, 456, 789}
$2 := {main-office, branch-7, headquarters}
$3 := {<div class="a">...</div>, <div class="b">...</div>}
```

**Characterization is post-hoc:**

| Observed set | Optional characterization |
|--------------|---------------------------|
| {123, 456, 789} | Numeric, or regex `\d+` |
| {main-office, branch-7, HQ} | Enum (closed set) |
| High cardinality, no pattern | Unconstrained string |
| All match `\d{4}-\d{2}-\d{2}` | Timestamp |

This is useful for compression cost (MDL), validation, or human interpretation. But it's not fundamental to slot discovery.

---

## Hierarchy and Nesting

Sequitur produces hierarchy naturally. Rules reference other rules.

**After bookend merge, slots can contain:**

- Terminal values: `$1 := {apple, banana}`
- Rule references: `$1 := {R7, R8, R9}` (alternatives)
- Mixed: `$1 := {apple, R7}` (terminal or structure)

This supports nested templates without special handling. The slot is still just a set—the set happens to contain structured elements.

---

## Domain-Specific Ranking

The grammar finds candidates. Domain knowledge scores them.

**For HTML:**

- Balanced tags rank higher
- Slot contains balanced subtree → clean nesting
- Mismatched tags → likely artifact, downrank

**For legislation:**

- Section markers as bookends rank higher
- Slot contains complete clause → clean structure
- Slot crosses sentence boundary → possibly valid, check

**For logs:**

- Line-aligned patterns rank higher
- Slot is short, bounded → likely field
- Slot is long, variable → residual or noise

Ranking heuristics are domain-specific. The core mechanism (bookend merge) is domain-agnostic.

---

## Next Steps

### Immediate: Clarify bookend merge algorithm

1. Specify rule comparison strategy (clustering by prefix hash?)
2. Define merge criteria (min bookend length, max slot count)
3. Handle ambiguous cases (multiple valid splits)
4. Prototype on simple examples

### Near-term: Validate on real documents

1. Run pipeline on legislation sample
2. Run on HTML sample
3. Evaluate: do discovered templates align with human intuition?
4. Iterate merge criteria based on results

### Deferred: Optimization

1. SA+LCP for bookend enumeration (if rule comparison is bottleneck)
2. Incremental updates (new text without full recomputation)
3. WASM for Sequitur if JS performance insufficient

---

## Appendix: What "Pre-typing" Actually Does

Pre-typing is not wrong. It's a shortcut.

**Without pre-typing:**

```
Input: [User, 123, logged, in], [User, 456, logged, in]
Sequitur: no shared rule (sequences differ)
Bookend merge: finds shared [User, _, logged, in], slot = {123, 456}
```

**With pre-typing:**

```
Normalize: [User, <NUM>, logged, in], [User, <NUM>, logged, in]
Sequitur: creates rule R1 → User <NUM> logged in
Slot positions: known immediately (the <NUM> token)
```

Pre-typing front-loads slot identification. Bookend merge discovers it post-hoc. Same result, different path.

**When pre-typing helps:**

- High-volume logs with known field types
- You want faster processing (skip merge pass)
- Domain knowledge is strong and complete

**When bookend merge is necessary:**

- Unknown document structure
- Slots aren't typed (arbitrary phrases, nested content)
- Discovery is the goal, not confirmation
