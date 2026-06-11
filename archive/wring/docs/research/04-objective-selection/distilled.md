# Distilled Findings: Objective + Selection

## Executive Summary

The core objective for template selection is **Minimum Description Length (MDL)**: `gain = savings_from_reuse − (template_cost + slot_encoding_cost + residual_cost)`. Optimal template selection is equivalent to finding the smallest grammar for the document, which is **NP-hard**, requiring approximation strategies from grammar compression. The MDL framework replaces arbitrary similarity thresholds with an information-theoretic principle—the best templates are those that compress the document most effectively. This naturallypenalizes degenerate cases: mostly-slot templates waste bits encoding variable content; single-use templates pay overhead without reuse savings; tiny frequent literals add complexity for negligible gain. The objective inherently balances compression against interpretability by making templates "expensive" enough that only structurally significant patterns survive selection.

**Cost modeling** must be type-aware to reflect true information content. Integers encoded with **Elias gamma/delta codes** cost logarithmically (small values = few bits), making numeric slots cheap when values are bounded but expensive for random IDs—the system automatically distinguishes low-entropy enums from high-entropy noise. **Timestamp delta encoding** (encode differences between sequential timestamps) reduces 24-byte ISO strings to ~10-bit deltas, powerfully incentivizing isolation of time fields into dedicated slots. **String encoding** uses length-prefix plus character entropy (~5-6 bits/char for ASCII logs); for low-cardinality slots, **dictionary encoding** (maintain vocab + index) switches automatically when `L(dictionary) + Σ(-log P(index)) < L(literals)`, effectively discovering enums through compression. **Calibration** adjusts costs based on document statistics: larger documents tolerate more template overhead (absolute cost amortizes); high-entropy documents need lower thresholds to capture sparse patterns; observed slot entropy informs type-specific costs dynamically.

**Selection algorithms** resolve the combinatorial search over template candidates. The approach differs based on whether flat or nested output is desired:

For **flat output**, **Weighted interval scheduling (WIS)** models template instances as intervals with weight = MDL gain, using DP to find the optimal non-overlapping set in O(n log n) time—guarantees maximum compression for disjoint coverage models. **Krimp-style greedy** iteratively adds candidates in decreasing gain order, accepts only if total description length decreases, and prunes templates that lost support after each addition—approximates global optimum efficiently with online MDL recalculation.

For **nested/hierarchical output**, **grammar-based selection** leverages the grammar structure directly. Grammar rules from Sequitur/Re-Pair naturally encode containment: a sub-pattern becomes a rule when reused, and the rule reference in parent templates represents nesting. Selection becomes rule pruning: keep rules where `rule_cost < inline_cost`, prune single-use rules, and the resulting grammar IS the nested template structure. This sidesteps the combinatorial selection problem—the grammar induction algorithm already made containment decisions via its digram/pair replacement heuristics.

**Flattening** converts nested templates to flat when needed: traverse the rule DAG in dependency order, inline rules that are only used within one parent, and apply WIS to resolve any remaining overlaps. This provides both output modes from a unified pipeline.

**Termination criteria** include coverage thresholds (stop when >95% covered), diminishing returns (marginal gain < ε), or template count limits (maintain interpretability). **Partial match handling**: strict mode leaves outliers as residual; variant templates create separate patterns for clusters; fuzzy matching uses edit-distance costs where `L(edits) + L(template_code) < L(literal)` determines acceptance—MDL eliminates arbitrary 80% similarity thresholds by making "noise" compression-prohibitive. **Residuals** become anomaly detectors: high-cost lines (compression ratio ≈ 1.0) indicate novel behaviors or concept drift versus normal patterns (ratio << 1.0).

## Key Insights

- **MDL unifies learning and compression**: The "best" hypothesis is the one allowing most compact lossless encoding—templates are dictionary entries, instances are references, slots are parameters; total bits = model + data + residual
- **NP-hardness demands approximations**: Optimal template selection relates to smallest grammar (NP-hard); grammar compression heuristics (Sequitur linear-time digram replacement, Re-Pair most-frequent-pair substitution) provide tractable approximations with provable bounds
- **Grammar-based selection solves hierarchy naturally**: When using grammar induction, containment decisions are made during rule formation—a sub-pattern becomes a rule when its reuse justifies the overhead; the grammar structure directly encodes which templates nest within others
- **Rule utility = containment ranking**: Sequitur's rule utility (count of rule references) determines whether a sub-pattern survives as its own template or gets inlined; this is exactly the "should B exist separately or be absorbed into A" decision
- **Type-aware slot costs are critical**: Elias gamma for small integers (2⌊log x⌋+1 bits), delta for large (log x + 2 log log x); delta-time for timestamps; dictionary for enums—accurate costs make system self-tuning, distinguishing error codes (cheap) from random IDs (expensive)
- **Calibration creates the granularity knob**: Increasing template overhead (α > 1) forces aggressive generalization (fewer broad templates); decreasing (α < 1) allows precise distinctions (more specific templates)—no fixed "similarity threshold", tuning reflects domain priorities
- **Weighted interval scheduling solves flat coverage optimally**: Cast instances as intervals, gains as weights; DP finds global maximum in O(n log n); requires non-overlapping constraint—use for flat output mode or after flattening
- **Flattening preserves flexibility**: Starting with hierarchical grammar and optionally flattening provides both output modes; flattening inlines rules used only once or only within one parent, then applies WIS to resolve overlaps
- **Greedy-cover with MDL recalc approximates global optimum**: Sort by gain proxy (coverage × literal_length - slot_entropy), iteratively add if L(D,CT_new) < L(D,CT_old), prune unsupported templates—Krimp/Slim show this yields near-optimal compression with massive candidate reduction
- **Degenerate template prevention is automatic**: Single-use templates have negative gain (overhead > 0 savings), rejected; mostly-slot templates pay high slot_encoding_cost, accepted only if reuse massive; MDL inherently enforces "at least 2 occurrences" and "substantial literal skeleton"
- **Proxy scores enable efficient filtering**: `score = (freq × literal_len) - slot_entropy_penalty` correlates with MDL gain; rank candidates, compute full MDL only for top-N—avoids expensive calculation on thousands of poor candidates
- **Termination has intrinsic criteria**: Stop when best candidate has ΔL < ε (no more compression gain); coverage > threshold (residual acceptably small); code table stable (no changes in full pass)—information-theoretic versus arbitrary iteration counts
- **Partial matches via edit-cost MDL**: Allow fuzzy matching when `L(Levenshtein_edits) + L(template_ref) < L(literal)`; automatically determines when variations are "noise" (high edit cost = leave as residual) versus "pattern" (low edit cost = merge)—no manual thresholds
- **Residuals are anomalies by construction**: Uncompressible data (compression ratio ≈ 1.0) is high-entropy—surprising to model, likely novel/erroneous; compression score = unified anomaly metric without domain-specific rules

## Recommendations

| Component | Approach | Algorithm/Formula | Rationale |
|-----------|----------|-------------------|-----------|
| **Objective function** | Two-part MDL | `L(D,H) = L(H) + L(D|H)` | Minimizes model + data costs; penalizes both overfitting (large H) and underfitting (large D|H) |
| **Template cost** | Fixed + length-proportional | `L(template) = C_template + L_literal × len(literal)` | Overhead ensures ≥2 uses needed; length cost favors compact skeletons |
| **Integer slots** | Elias gamma (small), delta (large) | γ: `2⌊log x⌋+1`; δ: `log x + 2 log log x` | Logarithmic cost makes bounded values cheap, random values expensive—auto-detects enums vs noise |
| **Timestamp slots** | Delta encoding + Elias | `L(t_i) = L_δ(t_i - t_{i-1})` | Sequential logs have small Δt; 24-byte string → ~10 bits; massive incentive to isolate time fields |
| **String slots (general)** | Length-prefix + entropy | `L(s) = L_δ(|s|) + |s| × H_char` | H_char ≈ 5-6 bits for log ASCII; reflects empirical entropy, not full 8-bit |
| **String slots (enum)** | Dynamic dictionary + index | `L(dict) + Σ(-log P(index))` | Switch when dict+indices < literals; automatically discovers categorical fields |
| **Template selection (nested)** | Grammar-based | Keep rules where `rule_cost < inline_cost`; prune utility < 2 | Grammar structure IS the hierarchy; containment decided during rule formation |
| **Template selection (flat)** | Weighted interval scheduling | DP: `OPT(i) = max(w_i + OPT(p(i)), OPT(i-1))` | O(n log n); global maximum for flat model; use after flattening or with SA+LCP path |
| **Template selection (streaming)** | Greedy Krimp-style | Sort by gain → add if L↓ → prune unsupported | Approximates optimal; handles overlaps by covering greedily; online MDL recalc ensures correctness |
| **Flattening** | DAG traversal + inline | Topo-sort rules; inline if single-parent or utility=1 | Converts nested → flat; preserves standalone sub-templates; WIS on remaining overlaps |
| **Gain proxy (filtering)** | Coverage × literal - entropy | `(freq × len_lit) - (slots × H(slot_values))` | Cheap heuristic correlates with MDL; prefilters thousands of candidates to top-N for exact evaluation |
| **Calibration factor** | Tunable α on template cost | α=1 (pure MDL), α>1 (conservative/fewer), α<1 (precise/more) | Domain-dependent: security needs precision (α<1), noisy logs need generalization (α>1) |
| **Termination: gain threshold** | Stop when `Δ L_best < ε` | ε = 0.1% of total or absolute bits | Diminishing returns—no more significant patterns; prevents overfitting noise |
| **Termination: coverage** | Stop when `covered / total > τ` | τ = 0.95 typical | Residual acceptably small; further templates address tiny fraction, not worth complexity |
| **Termination: code table stability** | Full pass with no adds/deletes/changes | Monitor template set between iterations | Fixed point reached; local optimum stable |
| **Partial matches** | Edit-distance cost comparison | Accept if `L(edits) + L(code) < L(literal)` | Compression-driven: merge only if describing difference cheaper than literal—no arbitrary similarity % |
| **Outlier policy** | Strict residual unless recurring | Single deviants → residual; 3+ variant instances → separate template | Avoid one-off template overhead; cluster variations when MDL justifies |
| **Residual classification** | Compression ratio as anomaly score | `score = L(line|model) / L(line_literal)` | Normal ≈ 0.1-0.5 (high compression); anomaly ≈ 0.9-1.0 (incompressible); unified metric across domains |

### Implementation Strategy

**Path A: Grammar-First (recommended for hierarchical output)**

1. **Grammar induction** — Run Sequitur or Re-Pair on abstract token stream; grammar rules = candidate templates with natural hierarchy

2. **Rule pruning** — Remove rules where `rule_cost > inline_cost`; enforce minimum utility (≥2 uses); the surviving grammar is the nested template set

3. **Optional flattening** — If flat output needed:
   - Topological sort rules by dependency
   - Inline rules with utility=1 or single parent
   - Apply WIS to resolve any remaining overlaps

4. **MDL calculation** — Validate final template set; encode with type-aware costs; verify compression gain

**Path B: SA+LCP (for precision-focused flat output)**

1. **Candidate generation** — Use repeat mining (Q2) to extract closed repeats; apply tokenization/typing (Q1); form candidate set with occurrence lists

2. **Gain estimation** — Calculate proxy score `(freq × lit_len) - slot_penalty`; sort descending; compute full MDL for top N%

3. **Selection** — Apply Weighted Interval Scheduling DP for optimal flat coverage

4. **MDL verification** — Validate final set; encode with type-aware costs

**Common Final Steps**

5. **Termination check** — Stop when (a) best ΔL < 0.001 × L(D) OR (b) coverage > 95% OR (c) template count > limit OR (d) no changes in full pass

6. **Residual analysis** — Calculate compression ratio for uncovered segments; flag high-cost segments (ratio > 0.8) as anomalies; optionally run second-pass on large residuals

### Cost Function Reference (Engineering)

```
L_total = L(CT) + L(D|CT) + L(residual)

L(CT) = Σ [C_template + L_δ(len(lit_i)) + lit_i × 5.5 bits/char + slots_i × C_slot]

L(D|CT) = Σ [-log₂ P(template_j) + Σ_slots L(value_k)]
  where L(int) = 2⌊log x⌋+1 (gamma) or log x + 2 log log x (delta)
        L(time_delta) = L_γ(t_i - t_{i-1})
        L(string) = L_δ(|s|) + |s| × H
        L(enum) = -log₂ P(category)

L(residual) = Σ lit_bits × 8 bits/byte (or entropy-based)
```

**Critical**: Use universal codes (Elias), not fixed-width; delta-encode timestamps; maintain dynamic dictionaries for enums. These encoding choices are the primary determinant of whether MDL correctly distinguishes signal from noise.
