# Wring: Consolidated Research Findings

## Executive Synthesis

Wring addresses a fundamental problem in text processing: extracting reusable structural templates from unstructured text to enable both compression and structured data extraction. This document consolidates findings from five research areas into a unified technical specification for implementation.

**The Core Insight**: Template discovery is equivalent to finding the smallest grammar that explains the document—an information-theoretic problem with a well-defined objective (Minimum Description Length) and mature algorithmic solutions from adjacent domains. The key innovation is combining techniques from log parsing, clone detection, grammar compression, web wrapper induction, and bioinformatics into a coherent pipeline that handles natural language text.

**The Central Trade-off**: Every design decision balances **pattern frequency** (how often patterns appear) against **structural fidelity** (how well patterns align with meaningful units). MDL provides the objective function that naturally resolves this trade-off: templates are worth extracting when their compression benefit exceeds their description cost.

**Output Flexibility**: The architecture supports both **flat templates** (disjoint coverage, simple concatenation) and **nested templates** (hierarchical DAG where templates reference sub-templates). Grammar-based mining naturally produces hierarchy; an optional flattening step converts to flat output when preferred. This dual-mode capability addresses use cases ranging from logs (typically flat) to structured documents and HTML (naturally hierarchical).

---

## Unified Architecture: Six-Phase Pipeline

The research converges on a six-phase architecture where each phase solves a specific problem. The final phase branches to support both flat and nested output modes:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ABSTRACTION   │───▶│   SEGMENTATION  │───▶│     MINING      │───▶│   REFINEMENT    │───▶│    SELECTION    │───▶│   EXTRACTION    │
│                 │    │                 │    │                 │    │                 │    │                 │    │                 │
│ Tokenization +  │    │ Entropy-based   │    │ Grammar-based   │    │ Multi-sequence  │    │ Grammar MDL +   │    │ Template        │
│ Type normalization│  │ boundary detect │    │ rule induction  │    │ alignment       │    │ Optional flatten│    │ matching + diff │
│                 │    │                 │    │                 │    │                 │    │                 │    │                 │
│ Q1 techniques   │    │ Q5 techniques   │    │ Q2 + Q5         │    │ Q3 techniques   │    │ Q4 techniques   │    │ Q4 + Q5         │
│                 │    │                 │    │ techniques      │    │                 │    │                 │    │ techniques      │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
       │                      │                      │                      │                      │                      │
       ▼                      ▼                      ▼                      ▼                      ▼                      ▼
   Raw text →          Abstract tokens →       Pseudo-records →      Grammar rules →     Rule refinement →     Nested templates
   Abstract tokens     Discrete records        Grammar rules         Aligned templates   Selected templates    OR Flat templates
                                               (hierarchical)        with slots          (nested or flat)      + slot values
```

### Phase 1: Abstraction (Q1 Tokenization + Typing)

**Problem**: Raw text has too much variability—timestamps, IDs, and names create near-zero exact repeats.

**Solution**: Punctuation-aware tokenization with selective pre-typing:
- Split on character-class boundaries (letter→digit, symbol→letter)
- Normalize high-entropy tokens: `2024-01-15 14:30:22` → `<TIMESTAMP>`, `user_12847` → `user_<NUM>`
- Preserve structural markers (punctuation, delimiters) as distinct tokens

**Algorithm**: Regex-based token classification with NER fallback
```
Token stream: ["User", "_", "<NUM>", "logged", "in", "at", "<TIMESTAMP>", "from", "<IP>"]
```

**Output**: Integer-encoded abstract token stream (vocabulary reduced from 50K+ words to <500 token types)

### Phase 2: Segmentation (Q5 Adjacent Domains - Information Theory)

**Problem**: Continuous text lacks natural boundaries; log parsing algorithms assume line-delimited records.

**Solution**: Entropy-based boundary detection:
- Calculate conditional entropy H(token_i | token_{i-1}) in sliding window
- Local maxima indicate structural boundaries (uncertainty spikes = pattern transitions)
- Creates pseudo-records from continuous stream

**Algorithm**: Sliding window entropy calculation, O(n) linear scan
```
Entropy: ─────╲╱─────╲╱─────╲╱─────
                ↑       ↑       ↑
             boundary boundary boundary
```

**Output**: Discrete candidate records (segments) with boundary positions

### Phase 3: Mining (Q2 Repeat Primitives + Q5 Grammar Compression)

**Problem**: Find all recurring patterns without O(n²) explosion, while preserving hierarchical structure.

**Solution**: Grammar induction as the primary approach, with SA+LCP for candidate seeding when needed.

**Primary Algorithm - Grammar Induction** (produces hierarchy naturally):
1. Run Sequitur or Re-Pair on abstract token stream
2. Grammar rules directly represent templates; rule references represent nesting
3. Prune single-use rules (utility < 2)
4. Each rule = candidate template; rule body = literals + slots (references to other rules or terminal slots)

**Candidate Seeding - Suffix Array Mining** (optional, for precision):
1. Build suffix array from abstract token stream (SA-IS algorithm, O(n))
2. Compute LCP array for repeat structure (O(n))
3. Enumerate closed repeats via interval stack traversal (O(n log n) output)
4. Use closed repeats to validate/seed grammar rules or identify missed patterns

**Algorithm Selection**:
| Scenario | Algorithm | Rationale |
|----------|-----------|-----------|
| Hierarchical output needed | Sequitur/Re-Pair | Grammar rules ARE the nested templates |
| Streaming/real-time | Sequitur | Online, O(n), incremental updates |
| Batch + maximum quality | Re-Pair | Global optimization, higher compression |
| Flat output, precision focus | SA + LCP → WIS | Maximum control over pattern selection |
| Very large (>100MB) | Winnowing → Grammar on shards | Pre-filter then grammar induction |

**Why Grammar-First for Hierarchy**:
- Sequitur/Re-Pair naturally discover containment: if pattern B always appears inside pattern A, B becomes a rule referenced by A
- The "smallest grammar" objective = MDL; no separate selection step needed for hierarchy
- Rule utility (usage count) automatically decides: keep as sub-template or inline
- Produces a DAG of rules that directly maps to nested template output

**Output**: Grammar rules with hierarchy `{rule_id, body: [literal | slot | rule_ref, ...], occurrences: [...]}`

### Phase 4: Refinement (Q3 Template Formation)

**Problem**: Raw repeats don't distinguish literals from slots; need to determine which positions vary.

**Solution**: Center-star multiple sequence alignment + gap entropy analysis:

1. **Cluster occurrences** by pattern similarity (edit distance)
2. **Select center**: Pick median-length instance from each cluster
3. **Pairwise align**: Align all cluster members to center via Myers' diff
4. **Column analysis**:
   - Identical columns → template literals
   - Variable columns → template slots
5. **Gap entropy validation**:
   - H(gap) < 1.5 → merge (missed literal)
   - H(gap) > 3.0 → slot (true variable)

**Merge Decision Cascade**:
```
IF min_literal_length >= 3 tokens
   AND slot_count <= 4
   AND occurrences >= 3
   AND compression_gain > threshold
   AND gap_entropy confirms slot/literal classification
THEN merge into template
ELSE reject or keep separate
```

**Output**: Refined templates with explicit literal/slot structure

### Phase 5: Selection (Q4 Objective + Selection)

**Problem**: Select which templates/rules to keep; decide between nested and flat output.

**Solution**: Grammar-based selection with optional flattening.

**Grammar-Based Selection** (for nested output):
1. Start with grammar rules from Phase 3
2. Apply MDL pruning: remove rules where `rule_cost > inline_cost`
3. Rule utility threshold: keep rules used ≥2 times (configurable)
4. The grammar IS the template library; no separate selection needed
5. Containment handled naturally: sub-rules that compress well are kept; others inlined

**Flattening** (for flat output):
1. Start with selected grammar rules
2. Traverse rule DAG in dependency order (leaves first)
3. For each rule, decide: keep as template OR inline into parent
   - Inline if: only used within one parent rule AND inlining improves parent's MDL
   - Keep if: used in multiple contexts OR standalone occurrences exist
4. Result: flat template set with disjoint coverage
5. Apply Weighted Interval Scheduling if overlaps remain after flattening

**Hybrid Selection** (when starting from SA+LCP instead of grammar):
1. Score each candidate pattern by MDL gain: `gain = savings - (template_cost + slot_cost)`
2. Build containment graph: edge A→B if B's occurrences ⊂ A's occurrences
3. Select via graph-aware WIS: allow nested intervals if parent-child relationship
4. Or: construct grammar from candidates, then apply grammar-based selection

**Output Modes**:
| Mode | Output Structure | Use Case |
|------|------------------|----------|
| **Nested** | Template DAG with rule references | Structured docs, HTML, legislation |
| **Flat** | Disjoint templates, no references | Logs, simple repetition |
| **Hybrid** | Top-level flat, allow 1-level nesting | Balanced interpretability |

**Output**: Selected template set (nested DAG or flat list)

### Phase 6: Extraction (Q5 Diff Techniques)

**Problem**: Apply templates to text; extract slot values; support reconstruction.

**Solution**: Template matching + diff-based slot extraction.

**Template Matching**:
1. Build lookup index: hash on anchor tokens or parse tree (Drain-style)
2. For input segment, find best-match template via index
3. For nested templates: match outer template first, then recursively match slot contents

**Slot Extraction**:
1. Run token-level Myers' diff between input and matched template
2. Diff regions = slot values
3. Apply semantic cleanup (align to token boundaries)
4. For nested: slot value may itself match a sub-template → recursive extraction

**Reconstruction** (round-trip correctness):
1. Nested mode: traverse template DAG in topological order
2. For each template instance: substitute slot values (which may be sub-template instances)
3. Concatenate in document order
4. Flat mode: simpler concatenation of template instances + residual

**Output**: Structured data with hierarchy support
```typescript
interface ExtractionResult {
  // Flat mode
  instances: Array<{template_id, start, end, slots: Record<string, string>}>;
  residual: string;

  // Nested mode (additional)
  instances: Array<{
    template_id,
    start,
    end,
    slots: Record<string, string | NestedInstance>
  }>;
}
```

---

## Critical Path: What Must Be Built First

Implementation must follow dependency order. Each layer builds on the previous:

```
Layer 1: Foundation (no dependencies)
├── Punctuation-aware tokenizer (Q1)
├── Type detection regexes (dates, IPs, numbers, UUIDs)
├── Token-to-integer encoder (vocabulary management)
└── Basic entropy calculator

Layer 2: Grammar Induction (depends on Layer 1)
├── Sequitur implementation (JS, typed arrays)
│   ├── Digram index (Map-based)
│   ├── Rule utility tracking
│   └── Single-use rule pruning
├── OR: Re-Pair implementation (for batch/quality priority)
└── Grammar → template structure mapping

Layer 3: Refinement (depends on Layer 2)
├── Myers' diff implementation (or use diff-match-patch)
├── Center-star alignment for rule instances
├── Gap entropy calculation
└── Literal vs slot classification

Layer 4: Selection + Output Modes (depends on Layer 3)
├── MDL cost functions (Elias codes, type-aware encoding)
├── Grammar-based selection (rule utility + MDL pruning)
├── Flattening algorithm (for flat output mode)
├── Optional: Weighted interval scheduling (for SA+LCP path)
└── Template library management

Layer 5: Extraction (depends on Layer 4)
├── Template matching index
├── Slot extraction via diff
├── Nested extraction (recursive matching)
└── Reconstruction algorithm (round-trip validation)

Layer 6: Enhancement (independent, can parallelize)
├── SA+LCP for candidate seeding (WASM - SA-IS algorithm)
├── Segmentation for continuous text
├── Domain-specific parameter tuning
└── Performance optimization
```

**Critical Dependencies**:
1. Nothing works without the tokenizer (Layer 1) producing integer-encoded abstract tokens
2. Grammar induction (Layer 2) is the core—produces hierarchical structure that flows through remaining layers
3. SA+LCP (Layer 6) is enhancement, not blocking; grammar induction provides the primary path

---

## Top 15 Critical Insights

### Algorithmic Foundations

1. **Closed repeats solve the redundancy problem**: Unlike maximal repeats (O(n²) candidates), closed repeats are bounded at O(n log n) while preserving hierarchical structure. They eliminate fragment redundancy by requiring each occurrence set to be unique.

2. **SA + LCP is the practical workhorse**: 4-8 bytes per character (vs. 20-40 for suffix trees), O(n) construction, excellent cache locality. Interval stack traversal provides virtual suffix tree capabilities without the memory overhead.

3. **Pre-typing transforms the discovery problem**: Without normalizing timestamps/IDs, almost no lines match exactly. With normalization, thousands of lines reduce to a handful of templates—a vocabulary collapse that makes patterns discoverable.

4. **MDL is the objective function, not a heuristic**: The Minimum Description Length principle provides an information-theoretic foundation: optimal templates minimize `L(model) + L(data|model)`. This replaces arbitrary similarity thresholds with principled compression-based decisions.

5. **Grammar compression may be the primitive**: Sequitur's online digram replacement directly produces the smallest grammar (= best templates) in O(n) time. For many use cases, running Sequitur on abstract tokens may be simpler than the full SA pipeline.

### Design Decisions

6. **Tokenization is the granularity knob**: Character-level finds everything but creates noise; word-level is clean but brittle. Punctuation-aware tokens (split on character class boundaries) balance interpretability with pattern discovery.

7. **Type-aware slot costs enable self-tuning**: Elias gamma for small integers (cheap), length-prefix for strings (expensive), dictionary encoding for enums (auto-detected). Accurate costs make the system distinguish error codes (worth extracting) from random IDs (noise).

8. **Center-star alignment beats full MSA**: Multiple sequence alignment is NP-hard; center-star provides 2-approximation in O(k·L²). Sufficient for logs where a clear prototype exists.

9. **Offset histogram topology is diagnostic**: Gap distance distributions reveal structure:
   - Narrow peak → fixed delimiter (merge)
   - Multiple modes → enum slot
   - Gaussian spread → variable slot
   - Uniform → no relationship

10. **Residuals are anomalies by construction**: Lines that don't compress (ratio ≈ 1.0) are high-entropy—surprising to the model, likely novel or erroneous. Compression score = unified anomaly metric.

### Architecture

11. **Abstract tokenization is the bridge to exact algorithms**: Clone detection's key insight: replacing variables with placeholders converts fuzzy Type-2 patterns into exact repeats in abstract space. This enables lossless grammar compression algorithms to find parametric templates.

12. **Segmentation enables continuous text processing**: Log parsing assumes line-delimited records. Entropy-based boundary detection (H(token|prev) spikes) creates pseudo-records from continuous streams, enabling reuse of mature algorithms.

13. **All domains converge on suffix structures**: Log parsing (tries), wrapper induction (PAT trees), clone detection (suffix arrays), bioinformatics (suffix trees)—independent development of the same fundamental data structure for O(n) repeat finding.

14. **WASM for compute, JS for orchestration**: Suffix array construction is the only truly performance-critical component. Everything else (tokenization, entropy, alignment, selection) is tractable in pure JavaScript for reasonable input sizes.

15. **Each adjacent domain solves one weakness**: Log parsing (clustering), clone detection (abstraction), grammar compression (mining), wrapper induction (alignment), diff algorithms (extraction)—synthesizing these creates a complete solution none provides alone.

---

## Implementation Roadmap: JS/WASM Architecture

### Component Allocation

| Component | Implementation | Rationale |
|-----------|---------------|-----------|
| **Tokenizer** | Pure JS | Simple regex/string ops; not bottleneck |
| **Type detector** | Pure JS | NER via compromise.js or regex; <1ms per token |
| **Token encoder** | Pure JS | Map operations; vocabulary management |
| **Entropy calculator** | Pure JS | Frequency counting + log2; trivial |
| **Sequitur** | Pure JS (primary) | Typed arrays + Map; core of grammar-first path; fallback to WASM if >5MB |
| **Re-Pair** | Pure JS or WASM | Batch alternative to Sequitur; WASM for large inputs |
| **Grammar → Template mapping** | Pure JS | Convert grammar rules to template structure |
| **Suffix array (SA-IS)** | WASM (C++) | O(n) but tight loops; optional for candidate seeding |
| **LCP array** | WASM (C++) | Build alongside SA; same memory layout |
| **Closed repeat enum** | WASM or JS | O(n log n); for SA-based path |
| **Center-star alignment** | Pure JS | O(k·L²) for small k; diff-match-patch for pairwise |
| **MDL calculation** | Pure JS | Arithmetic on costs; pure computation |
| **Grammar selection** | Pure JS | Rule utility + MDL pruning |
| **Flattening** | Pure JS | DAG traversal to convert nested → flat |
| **Template matching** | Pure JS | Hash lookup or trie traversal |
| **Slot extraction** | Pure JS | diff-match-patch library; small segments |
| **Reconstruction** | Pure JS | Template instantiation + concatenation |

### WASM Interface Design

```typescript
// Minimal WASM interface - suffix array only
interface WringSA {
  // Input: Uint32Array of token IDs
  // Output: Uint32Array of suffix positions
  buildSuffixArray(tokens: Uint32Array): Uint32Array;

  // Input: tokens + SA
  // Output: Uint32Array of LCP values
  buildLCPArray(tokens: Uint32Array, sa: Uint32Array): Uint32Array;

  // Input: SA + LCP + parameters
  // Output: List of (start, length, frequency, occurrence_list)
  enumerateClosedRepeats(
    sa: Uint32Array,
    lcp: Uint32Array,
    minLen: number,
    minFreq: number
  ): ClosedRepeat[];
}
```

### Memory Budget (Browser Constraint: ~1GB)

| Input Size | SA Memory | LCP Memory | Working Set | Feasible? |
|------------|-----------|------------|-------------|-----------|
| 1 MB text | 4 MB | 4 MB | ~20 MB | ✓ Yes |
| 10 MB text | 40 MB | 40 MB | ~200 MB | ✓ Yes |
| 50 MB text | 200 MB | 200 MB | ~600 MB | ⚠ Marginal |
| 100 MB text | 400 MB | 400 MB | ~1.2 GB | ✗ Needs sharding |

**Scale-out Strategy**: For inputs >50MB:
1. Use winnowing (k-gram fingerprinting) to identify candidate regions
2. Shard into overlapping 10MB chunks
3. Run SA mining on each shard
4. Merge candidates with cross-shard validation

---

## MDL Cost Function Specification

### Template Cost

```
L(template) = C_overhead + L(literal_tokens) + L(slot_count)

Where:
  C_overhead     = 16 bits (fixed cost for having a template)
  L(literal)     = Σ token_i × 5.5 bits/char (entropy-adjusted)
  L(slot_count)  = γ(slots) = 2⌊log₂(slots)⌋ + 1 bits (Elias gamma)
```

### Slot Value Costs

| Slot Type | Encoding | Cost Formula |
|-----------|----------|--------------|
| **Small integer** (0-1000) | Elias gamma | `2⌊log₂(x)⌋ + 1` bits |
| **Large integer** (>1000) | Elias delta | `log₂(x) + 2log₂(log₂(x)) + 1` bits |
| **Timestamp (sequential)** | Delta + gamma | `γ(t_i - t_{i-1})` bits |
| **String (general)** | Length-prefix + chars | `δ(len) + len × H_char` bits |
| **Enum (low cardinality)** | Dictionary index | `-log₂(P(value))` bits |
| **High-entropy string** | Literal | `len × 8` bits |

### Total Description Length

```
L_total(D, CT) = L(CT) + L(D|CT) + L(residual)

L(CT) = Σ_templates L(template_i)

L(D|CT) = Σ_instances [template_code + Σ_slots L(slot_value)]
        = Σ_instances [-log₂(P(template)) + Σ_slots L(value)]

L(residual) = Σ_uncovered literal_bits × 8
```

### Gain Calculation

```
gain(template) = L(occurrences_as_literal) - L(template) - L(all_slot_values)
               = (freq × literal_len × 5.5) - C_template - L(slots) - Σ L(values)

Accept template IF gain > 0
```

---

## Output Schema: Flat vs Nested

The system produces two output modes with different schema structures.

### Flat Output Schema

Templates are independent; instances are disjoint intervals; slots contain only terminal values.

```typescript
interface FlatOutput {
  templates: Array<{
    id: string;
    literals: string[];           // Literal segments between slots
    slots: Array<{
      name: string;
      position: number;           // Index in literals array (slot appears after literals[position])
      type: 'string' | 'number' | 'timestamp' | 'enum';
      enumValues?: string[];      // If type is 'enum'
    }>;
  }>;

  instances: Array<{
    templateId: string;
    start: number;                // Character offset in original
    end: number;
    slotValues: Record<string, string>;
  }>;

  residual: Array<{
    start: number;
    end: number;
    content: string;
  }>;
}
```

### Nested Output Schema

Templates can reference other templates; slots can contain either terminal values or sub-template instances.

```typescript
interface NestedOutput {
  templates: Array<{
    id: string;
    body: Array<TemplateElement>;  // Ordered sequence of literals, slots, and sub-template refs
  }>;

  rootInstances: Array<NestedInstance>;  // Top-level instances (not contained in other instances)
  residual: Array<{start: number; end: number; content: string}>;
}

type TemplateElement =
  | { type: 'literal'; value: string }
  | { type: 'slot'; name: string; slotType: 'string' | 'number' | 'timestamp' | 'enum' }
  | { type: 'templateRef'; templateId: string };  // Slot that's always filled by this sub-template

interface NestedInstance {
  templateId: string;
  start: number;
  end: number;
  slotValues: Record<string, string | NestedInstance>;  // Values can be nested instances
}
```

### Conversion: Nested → Flat

Flattening traverses the template DAG and inlines sub-templates:

```
function flatten(nestedOutput: NestedOutput): FlatOutput {
  1. Topological sort templates by dependency (leaves first)
  2. For each template with templateRef slots:
     - If referenced template used ONLY within this parent: inline it
     - If referenced template has standalone uses: keep separate, convert ref to slot
  3. Rebuild instances with inlined content
  4. Run WIS if any instance overlaps remain
}
```

### Reconstruction Algorithm

Round-trip correctness requires ordered reconstruction:

```
function reconstruct(output: NestedOutput | FlatOutput): string {
  1. Collect all instances (including nested) with their [start, end] positions
  2. Sort by start position
  3. For nested instances: recursively expand by substituting slot values
  4. Concatenate: instance_1 + residual + instance_2 + residual + ...
  5. Verify: reconstructed === original
}
```

---

## Unresolved Research Questions

### Decision Points Requiring Experimentation

1. **Tokenization granularity threshold**: When should `error_code_42` be treated as one token vs. `error_code_` + `42`? Current heuristic (MDL gain from split) needs empirical validation.

2. **Entropy threshold for slot classification**: H < 1.5 → literal, H > 3.0 → slot. What about 1.5-3.0? Need domain-specific calibration data.

3. **Minimum pattern length in tokens vs. characters**: Q2 suggests 8 characters OR 2-3 tokens. Which is more robust across document types?

4. **Streaming vs. batch trade-offs**: Progressive alignment (Spell-style) trades accuracy for speed. Quantify the accuracy loss for different redundancy levels.

5. **Grammar algorithm selection**: Sequitur (online, streaming) vs Re-Pair (batch, global optimization). Current guidance is domain-dependent; need empirical comparison on representative document types.

### Areas Needing Further Investigation

6. **Incremental updates**: When new text arrives, how to efficiently update the grammar/template library without full recomputation? Sequitur supports incremental addition but not deletion.

7. **Cross-document patterns**: Current focus is single-document. Extending to corpus-wide boilerplate detection requires additional winnowing/fingerprinting layer.

8. **Type inference accuracy**: Pre-typing assumes regex patterns for dates/IPs/etc. are sufficient. Need validation on diverse document types; may need ML-based NER for complex cases.

9. **Calibration automation**: Cost function parameters (C_overhead, α in F∝1/L^α) are currently manual. Can these be learned from document statistics?

10. **Rule interpretability**: Grammar rules may not align with human-meaningful units. Heuristics for rule naming, splitting overly-long rules, and merging trivial rules need development.

### Resolved in This Document

- **Hierarchical vs flat templates**: Addressed via grammar-first mining with optional flattening (see Phase 5: Selection)
- **Containment ranking**: Handled by grammar rule utility and MDL-based inlining decisions

---

## Domain-Specific Adaptation

### Logs

| Parameter | Setting | Rationale |
|-----------|---------|-----------|
| Pre-typing | Aggressive | Timestamps, IPs, session IDs, hex values |
| Segmentation | Line-based | Newlines are natural boundaries |
| Min frequency | 5+ | High-volume, need strong signal |
| Entropy threshold | 3.0 | Many slot types; tolerate variation |
| Template limit | None | Logs can have thousands of templates |

### Legal/Contract Text

| Parameter | Setting | Rationale |
|-----------|---------|-----------|
| Pre-typing | Minimal | Exact phrasal repeats are the signal |
| Segmentation | Paragraph/section | Larger structural units |
| Min frequency | 2 | Boilerplate may appear exactly twice |
| Entropy threshold | 1.5 | Conservative slot detection |
| Template limit | ~100 | Focus on major clauses |

### HTML/Semi-structured

| Parameter | Setting | Rationale |
|-----------|---------|-----------|
| Pre-typing | Tag-aware | Normalize attribute values, preserve tags |
| Segmentation | DOM-based | Use tag structure as boundaries |
| Min frequency | 3 | Web pages have moderate repetition |
| Entropy threshold | 2.5 | Mixed content in attributes |
| Template limit | ~500 | Many page elements |

### Source Code

| Parameter | Setting | Rationale |
|-----------|---------|-----------|
| Pre-typing | Identifier normalization | `$ID`, `$STR`, `$NUM` placeholders |
| Segmentation | Statement/block | Syntax-aware boundaries |
| Min frequency | 2 | Clone detection even for pairs |
| Entropy threshold | 2.0 | Limited vocabulary |
| Template limit | None | Find all clones |

---

## Validation Strategy

### Unit Tests

1. **Tokenization**: Verify character-class splitting, type detection for known patterns
2. **Closed repeats**: Compare against brute-force on small inputs; verify O(n log n) bound
3. **Alignment**: Test center-star against full MSA on known examples
4. **MDL costs**: Validate encoding lengths match theoretical formulas

### Integration Tests

1. **Round-trip**: Raw text → templates → structured extraction → reconstructed text
2. **Compression ratio**: Compare output size vs. input size; should be significantly smaller for repetitive input
3. **Template stability**: Same input should produce identical templates across runs

### Benchmark Suite

| Test Case | Size | Expected Templates | Target Time |
|-----------|------|-------------------|-------------|
| Apache log (1000 lines) | ~100KB | 10-20 | <1s |
| Legal contract | ~500KB | 50-100 | <5s |
| HTML page collection | ~5MB | 200-500 | <30s |
| Large log file | ~50MB | 100-500 | <5min |

### Anomaly Detection Validation

- Inject known anomalous lines into repetitive logs
- Verify compression ratio for injected lines is >0.8 (poorly compressed)
- Verify normal lines have ratio <0.3 (well compressed)

---

## Appendix: Algorithm Reference

### SA-IS (Suffix Array - Induced Sorting)

Linear-time suffix array construction suitable for WASM implementation:
1. Classify suffixes as S-type or L-type
2. Identify LMS (leftmost S-type) suffixes
3. Recursively sort LMS suffixes
4. Induce remaining suffix positions

Reference: Nong, Zhang, Chan (2009)

### Interval Stack Traversal for Closed Repeats

```
stack = [(0, n, 0)]  # (left, right, lcp_depth)
while stack:
    left, right, depth = stack.pop()
    if right - left >= min_freq and depth >= min_len:
        emit(depth, left, right)  # Closed repeat
    # Split interval by LCP
    for each sub-interval with distinct lcp:
        stack.push(sub_interval)
```

### Center-Star Alignment

```
# Given k sequences S_1, ..., S_k
center = argmin_i Σ_j edit_distance(S_i, S_j)
aligned = [S_center]
for each S_j ≠ S_center:
    alignment = myers_diff(S_center, S_j)
    propagate_gaps(aligned, alignment)
columns = transpose(aligned)
literals = [col for col in columns if all_equal(col)]
slots = [col for col in columns if not all_equal(col)]
```

### Weighted Interval Scheduling DP

```
# Given intervals I_1, ..., I_n sorted by end position
# with weights w_i = MDL gain
p(i) = largest j < i where I_j doesn't overlap I_i

OPT(0) = 0
for i in 1..n:
    OPT(i) = max(w_i + OPT(p(i)), OPT(i-1))

# Backtrack to find selected intervals
selected = []
i = n
while i > 0:
    if w_i + OPT(p(i)) > OPT(i-1):
        selected.append(i)
        i = p(i)
    else:
        i -= 1
```

---

## Conclusion

The Wring system is implementable using mature algorithms from multiple adjacent domains. The six-phase architecture (Abstraction → Segmentation → Mining → Refinement → Selection → Extraction) maps directly to proven techniques, with grammar-based mining as the primary path for hierarchical template discovery:

| Phase | Primary Algorithm | Complexity | Domain Origin |
|-------|------------------|------------|---------------|
| Abstraction | Regex + NER tokenization | O(n) | Clone detection |
| Segmentation | Entropy boundary detection | O(n) | Information theory |
| Mining | Sequitur/Re-Pair grammar induction | O(n) | Grammar compression |
| Refinement | Center-star + gap entropy | O(k·L²) | Bioinformatics, wrapper induction |
| Selection | Grammar MDL + optional flattening | O(n) | Grammar compression |
| Extraction | Template matching + Myers' diff | O(n log n) | Diff algorithms |

The architecture supports **both flat and nested output modes**. Grammar-based mining naturally produces hierarchical templates; an optional flattening step converts to disjoint coverage when needed. This resolves the flat-vs-hierarchical architectural fork by supporting both from a unified pipeline.

The MDL objective function provides the principled foundation for all decisions: tokenization granularity, pattern selection, slot classification, containment ranking, and termination criteria. Implementation should begin with the tokenizer and Sequitur core, then progressively add alignment, selection modes, and extraction layers. SA+LCP remains available for candidate seeding and precision-focused use cases.

**Key Risk**: Browser memory constraints limit single-document processing to ~50MB. Larger inputs require sharding strategies (winnowing + merge) that add architectural complexity.

**Key Opportunity**: Once the core pipeline works, it generalizes across domains (logs, legal text, HTML, code) with only parameter tuning, not architectural changes. The dual output mode (flat/nested) allows the same engine to serve simple log parsing and complex structured document analysis.
