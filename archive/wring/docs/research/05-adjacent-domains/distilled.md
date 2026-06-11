# Distilled Findings: Adjacent Domains

## Executive Summary

No single adjacent domain provides a complete solution for Wring, but six domains contribute essential primitives that combine into a robust architecture. **Log parsing** (Drain, Spell, LogMine) solves the template extraction problem but assumes pre-segmented lines—adaptation requires **entropy-based segmentation** (detecting boundaries via conditional entropy spikes H(W_next|W_prev) in continuous streams) to create pseudo-lines. **Clone detection** (CCFinder, Baker's parameterized matching) contributes the critical concept of **abstract tokenization**: replacing variable content (dates, IDs, numbers) with generic placeholders before mining—converting "fuzzy" Type-2 templates (same structure, different values) into exact repeats in abstract space, dramatically improving pattern frequency. **Grammar compression** (Sequitur, Re-Pair) provides the core mining primitive for hierarchical structure discovery; Sequitur's online linear-time digram replacement is ideal for continuous streams, while Re-Pair's global optimization yields higher-quality templates for batch processing—both require abstract token input to handle variability, as they're inherently lossless/exact-match algorithms.

**Web wrapper induction** (IEPAD) is the most directly analogous pipeline: it uses suffix trees (PAT trees) to find maximal repeats in semi-structured HTML, then applies **center-star multiple sequence alignment** to refine templates by determining literal versus variable positions across occurrences. This maps one-to-one to Wring's Repeat→Stitch approach—the key adaptation is using suffix arrays on tokens instead of HTML tags, and applying alignment to natural text segments rather than DOM records. **Motif discovery** (bioinformatics MEME/Gibbs sampling) addresses approximate matching but suffers from the **large alphabet problem** (50K+ words vs. 4-20 amino acids)—only viable after alphabet reduction via abstract tokenization; provides suffix tree algorithms for finding (ℓ,d)-motifs (patterns with d mismatches) which enable fuzzy template discovery for Type-3 clones. **Diff algorithms** (Myers' algorithm, diff-match-patch) are too slow (O(ND)) for corpus-wide mining but critical for **template refinement** and slot boundary extraction: semantic cleanup heuristics (aligning edits to word boundaries, merging adjacent small diffs) ensure slots don't fragment meaningful units; used in center-star alignment as the pairwise comparison step.

The synthesis yields a **hybrid six-phase architecture**: (1) **Abstraction** via clone detection's parameterized tokenization (reduces alphabet, exposes structure); (2) **Segmentation** via entropy maxima (converts continuous text to discrete records); (3) **Mining** via grammar compression (primary for hierarchical output) or suffix arrays (for flat output) on abstract stream; (4) **Refinement** via center-star alignment with semantic diff (determines literals vs. slots); (5) **Selection** via grammar MDL pruning with optional flattening; (6) **Extraction** via Myers' diff on new text (populates slot values). Each phase solves a specific weakness: abstraction handles variability (Type-2), segmentation handles continuous streams, mining provides O(n) scalability with natural hierarchy, alignment handles noise, selection enables flat/nested output modes, diff provides precision. The integration transforms Wring from a novel research problem into an engineering problem solvable with mature cross-disciplinary techniques.

**Architecture Decision**: Grammar compression (Sequitur/Re-Pair) is the **primary mining approach** for hierarchical template discovery. Grammar rules directly express nested template relationships through rule references. SA+LCP remains available for candidate seeding or precision-focused flat output. Both paths converge at the refinement phase.

## Key Insights

- **Log parsing requires segmentation adaptation**: Drain/Spell assume newline-delimited records with fixed structure; continuous text needs entropy-based segmentation (H(token_i | token_{i-1}) spikes mark boundaries) to create pseudo-lines before applying clustering/consensus algorithms
- **Abstract tokenization is the bridge to exact algorithms**: Clone detection's pre-typing (replace <PERSON>, <DATE>, <NUM>, <IP> with placeholders) converts fuzzy natural language into exact token sequences—enables grammar compression and exact repeat mining to find Type-2 clones that differ only in slot values
- **Grammar compression may be the primitive, not inspiration**: Sequitur/Re-Pair directly solve "smallest grammar = best templates"; Sequitur's online O(n) digram replacement with rule utility (delete single-use rules) naturally produces reusable templates; requires abstract token input to handle non-exact repetition
- **Suffix arrays are the core data structure**: Log parsers, wrapper induction, clone detectors, and grammar compressors all converge on suffix trees/arrays for O(n) maximal repeat enumeration—PAT trees (IEPAD) and generalized suffix trees solve the "find all recurring substrings" problem efficiently at massive scale
- **Center-star alignment solves the refinement problem**: Multi-occurrence alignment is NP-hard; center-star (pick median, align all to it pairwise) gives 2-approximation in O(k·L²)—wrapper induction and bioinformatics confirm this as standard practice for defining template constants (identical columns) vs. slots (variable columns)
- **Large alphabet problem demands reduction**: Bioinformatics motif algorithms (MEME, PWMs) fail on 50K-word vocabularies—only viable after abstracting to <100 token classes (POS tags, entity types); reinforces that abstraction phase must precede all mining
- **Semantic diff cleanup prevents fragmentation**: Standard diff minimizes edits but may split meaningful units; cleanup heuristics (align to word/token boundaries, merge adjacent diffs) ensure slots align with interpretable segments—diff-match-patch's cleanupSemanticLossless provides this out-of-box
- **Each domain solves one specific weakness**: Log parsing (clustering/consensus), clone detection (abstraction), grammar (hierarchical mining), wrapper induction (alignment), motif discovery (fuzzy matching theory), diff (precision)—no domain is sufficient alone, all are necessary together
- **Wrapper induction is the architectural template**: IEPAD's pipeline (tokenize → PAT tree → maximal repeats → validator → alignment → extractor) is isomorphic to Wring's Repeat→Stitch; adaptation only requires replacing HTML tags with abstract text tokens and DOM structure with entropy segmentation
- **Drain's parse tree enables fast matching**: Fixed-depth tree indexed by length + prefix provides O(depth) template lookup vs. O(M) linear scan—adaptation must replace "length" (fragile for variable-length slots) with robust invariants like semantic hash or syntactic features
- **Re-Pair optimizes globally, Sequitur locally**: Re-Pair scans entire corpus for most-frequent pair (offline, higher quality); Sequitur processes incrementally (online, streaming-friendly)—Wring should use Sequitur for live streams, Re-Pair for batch optimization
- **Motif discovery formalizes approximate matching**: (ℓ,d)-motif problem (find length-ℓ pattern appearing ≥q times with ≤d mismatches) defines fuzzy templates rigorously; suffix tree "Spelling" algorithm traverses with error budget—enables Type-3 clone discovery (optional words, minor edits)

## Recommendations

| Domain | Core Technique | Direct Application | Required Adaptation | Integration Phase |
|--------|---------------|-------------------|---------------------|------------------|
| **Log Parsing** | Drain: fixed-depth parse tree; Spell: LCS clustering; LogMine: hierarchical clustering | Template clustering + consensus formation | **Segmentation layer**: Use entropy-based segmentation (H(token_i\|token_{i-1})) to split continuous text before clustering; replace "length" heuristic with robust features | Phase 2 (Segmentation) + Phase 3 (Mining) |
| **Clone Detection** | CCFinder: token-based suffix arrays with abstract tokenization (identifiers→$P, numbers→$N) | Pre-typing to expose hidden structure | Replace code lexer (keywords, braces) with NLP tokenizer (NER for <PERSON>, <DATE>, <IP>; POS tags for <VERB>, <NOUN>) | Phase 1 (Abstraction) |
| **Grammar Compression** | Sequitur: online digram replacement (linear time); Re-Pair: offline frequent-pair substitution | Hierarchical template discovery via smallest grammar | Apply to **abstract token stream** (not raw text) to handle Type-2 clones; post-process to merge rules into interpretable templates | Phase 3 (Mining) |
| **Web Wrapper Induction** | IEPAD: PAT tree for maximal repeats + pattern validator + MSA for refinement | Repeat→Stitch pipeline architecture | Replace HTML tag tokenization with abstract text tokens; use entropy segmentation instead of DOM structure; adapt regularity validator for text (not HTML) | Phase 3 (Mining) + Phase 4 (Refinement) |
| **Motif Discovery** | MEME/Gibbs: PWM via EM; Suffix tree "Spelling" for (ℓ,d)-motifs | Fuzzy template discovery (Type-3 clones) | **Alphabet reduction mandatory**: Only apply after Phase 1 abstraction (<100 token classes); use Spelling algorithm on abstract stream to find patterns with mismatches | Phase 3 (Mining - for fuzzy matching) |
| **Diff Algorithms** | Myers' diff: SES/LCS via O(ND) DP; cleanup heuristics for semantic alignment | Slot boundary extraction + template refinement | Use **only for refinement** (Phase 4) and extraction (Phase 5), not corpus mining; apply cleanup (cleanupSemanticLossless) to align edits to token boundaries | Phase 4 (Refinement) + Phase 5 (Extraction) |

### Integrated Six-Phase Architecture

#### **Phase 1: Abstraction (Clone Detection Layer)**
- **Input**: Raw continuous text
- **Algorithm**: Tokenize + NER + Regex patterns
- **Output**: Abstract token stream (e.g., `<PERSON> bought <NUM> <ITEM> on <DATE>`)
- **Implementation**: JS with NER library (compromise.js or simple regex for dates/IPs/numbers); reduces 50K vocabulary to <100 classes
- **Purpose**: Solves large-alphabet problem; exposes Type-2 clone structure

#### **Phase 2: Segmentation (Information Theory Layer)**
- **Input**: Abstract token stream
- **Algorithm**: Calculate conditional entropy H(token_i | token_{i-1}) in sliding window; detect local maxima as boundaries
- **Output**: Discrete candidate records (pseudo-lines)
- **Implementation**: JS entropy calculation (token frequency maps); linear scan O(n)
- **Purpose**: Converts continuous stream to discrete records for log-parsing algorithms

#### **Phase 3: Mining (Suffix Array + Grammar Layer)**
- **Input**: Segmented abstract token stream
- **Algorithm Option A**: Build suffix array (WASM), enumerate maximal repeats (closed repeats from Q2) with frequency/length thresholds
- **Algorithm Option B**: Run Sequitur on stream (JS or WASM), extract grammar rules as candidate templates
- **Output**: Candidate template structures with occurrence lists
- **Implementation**: WASM for SA construction (SA-IS algorithm); JS for Sequitur (manageable for 10MB with typed arrays)
- **Purpose**: O(n) discovery of all recurring patterns

#### **Phase 4: Refinement (Center-Star Alignment Layer)**
- **Input**: Clusters of original text segments corresponding to each candidate template
- **Algorithm**:
  1. Compute pairwise edit distance for all cluster members
  2. Select center (minimum total distance)
  3. Align each member to center via Myers' diff
  4. Propagate gaps; analyze columns for constant (all identical) vs. variable (differs)
- **Output**: Refined templates with literal segments + slot positions
- **Implementation**: JS diff-match-patch for pairwise alignment; column analysis in JS
- **Purpose**: Distinguishes template constants from slots; handles noise in clusters

#### **Phase 5: Selection (Grammar MDL Layer)**
- **Input**: Refined grammar rules / candidate templates
- **Algorithm**:
  - For grammar path: Apply MDL pruning (keep rules where `rule_cost < inline_cost`); enforce minimum utility
  - For SA path: Weighted Interval Scheduling for optimal non-overlapping coverage
  - Optional flattening: Inline rules with single parent; apply WIS for remaining overlaps
- **Output**: Selected template set (nested DAG or flat list based on output mode)
- **Implementation**: JS for MDL calculation and DAG traversal; DP for WIS
- **Purpose**: Chooses between nested and flat output; handles containment decisions

#### **Phase 6: Extraction (Diff Layer)**
- **Input**: New text + template library
- **Algorithm**: Match text to template (Drain-style lookup tree); run token-level Myers' diff to extract slot values; for nested: recursive matching of slot contents
- **Output**: Structured data (template ID + slot value dict, with optional nesting)
- **Implementation**: JS diff for small segments; template lookup via hash or parse tree
- **Purpose**: Operational extraction of structured data from unstructured input; supports round-trip reconstruction

### Domain-Specific Adaptation Matrix

| Challenge | Source Domain | Technique | Wring Adaptation |
|-----------|--------------|----------|-----------------|
| **Pre-segmented lines** | Log parsing | Assumes newline delimiters | Entropy-based segmentation; H(token_i\|token_{i-1}) maxima = boundaries |
| **Variable content obscuring patterns** | Clone detection | Parameterized tokenization | NER + regex → abstract tokens (<PERSON>, <DATE>, <NUM>); run mining on abstract stream |
| **Exact-match rigidity** | Grammar compression | Sequitur/Re-Pair lossless only | Apply to abstract stream (fuzzy becomes exact); combine with motif discovery for true fuzzy |
| **Large alphabet (50K+ words)** | Motif discovery | MEME/PWM fail on large Σ | Reduce to <100 classes via abstraction; use Spelling algorithm on reduced alphabet |
| **HTML/DOM structure** | Wrapper induction | Tag hierarchy for segmentation | Replace with entropy segmentation; use tokens not tags; alignment algorithms transfer directly |
| **Slot boundary precision** | Diff algorithms | Character-level diff fragments units | Semantic cleanup heuristics (align to token boundaries); use token-level diff not char-level |
| **Continuous stream (no records)** | All domains | Most assume discrete inputs | Entropy segmentation (Phase 2) creates pseudo-records before applying domain algorithms |
| **Hierarchical templates** | Grammar compression | Sequitur natural hierarchy | Sequitur rules = nested templates; post-process to merge/split for interpretability |
| **Fuzzy matching (Type-3 clones)** | Motif discovery | (ℓ,d)-motif with d mismatches | Suffix tree Spelling algorithm with error budget; identify optional segments |
| **Fast template lookup** | Log parsing (Drain) | Fixed-depth parse tree | Adapt tree: index by semantic features (anchor tokens, slot count) not length; O(depth) lookup |

### Implementation Priorities (JS/WASM Balance)

**WASM (Performance-Critical):**
- Suffix array construction (SA-IS or DC3 algorithm)
- Sequitur/Re-Pair grammar induction for large inputs
- Pairwise edit distance matrix for center-star (if clusters are large)

**JavaScript (Orchestration + Light Processing):**
- Tokenization + NER (compromise.js or regex-based)
- Entropy calculation (frequency maps, simple math)
- Template library management (lookup, storage)
- Myers' diff for small segment alignment (diff-match-patch library)
- Column analysis for alignment matrices (identify constant vs. variable)

**Hybrid (Start JS, Escalate to WASM):**
- Sequitur: Try JS first (typed arrays, efficient digram map); fall back to WASM if >5MB
- Alignment: JS diff for typical segments (<1KB); WASM for outlier large segments

### Validation: Cross-Domain Convergence

All domains independently converge on:
1. **Suffix structures** for repeat finding (log parsing's tries, wrapper induction's PAT trees, clone detection's suffix arrays, motif discovery's suffix trees)
2. **Abstract tokenization** for handling variability (clone detection explicit, log parsing implicit via wildcard merging, grammar compression requires it)
3. **Alignment for consensus** (wrapper induction's MSA, bioinformatics MSA, diff algorithms for pairwise, log parsing's LCS)
4. **MDL-style objectives** (grammar compression explicit smallest-grammar, wrapper induction's pattern density, log parsing's coverage maximization)

This convergence validates that combining these techniques into Wring's pipeline is not arbitrary assembly but a theoretically grounded synthesis of proven approaches to the same fundamental problem across different data types.
