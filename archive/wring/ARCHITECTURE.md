# Architecture

This is the canonical description of how Wring works. It supersedes the individual phase READMEs where they conflict.

---

## The Problem

Given one document, discover its recurring structure. No prior knowledge of what varies. Produce a set of templates (literals interleaved with slots) and a map of their occurrences, optimizing for the balance of compression and interpretability (MDL).

## The Pipeline

```
Tokenize  ──>  Sequitur  ──>  Bookend Merge  ──>  Selection  ──>  Extraction
            (Re-Pair today)
```

Five stages. Each consumes the output of the previous. Stage 2 names Sequitur for
the family; the implemented carrier is Re-Pair (see §2 for why).

---

### 1. Tokenize

Segment the document into a symbol stream. This defines the alphabet Sequitur operates on.

| Granularity | What Sequitur sees | Trade-off |
|---|---|---|
| Characters | Every character | Maximum pattern discovery; rules may cut across meaningful units |
| Punctuation-aware | Split on character-class transitions | Balanced default |
| Domain-aware | HTML tags, code tokens | Best boundaries; requires parser |

Pre-typing (normalizing known field types like dates or IPs before grammar induction) is an optional optimization, not a prerequisite. The mechanism must work without it.

**Status**: Implemented for both use cases. `dom/extract-signatures.js` turns raw HTML into `tag#id.class.class` signatures; `general/tokenize.js` provides four lossless general-text tokenizers (punctuation-aware, word, character, line), tested in `general/test-grammar.js` and exercised end-to-end by `general/induce.js`.

---

### 2. Sequitur

Run Sequitur on the token stream. Sequitur replaces repeated digrams with grammar rules, building a hierarchy of exact repeats in linear time.

**Input**: Token stream.
**Output**: A grammar. Its rules have right-hand sides that are sequences of terminals and rule references.

Sequitur finds exact repeats only. If two sequences differ at any position, no rule is formed. This is the gap that Stage 3 addresses.

**Status**: Implemented via **Re-Pair** (`general/grammar.js`), behind a neutral `{ start, rules, ruleUses }` grammar interface. Re-Pair is an offline member of the same grammar-induction family: it greedily replaces the globally most-frequent digram and produces the same hierarchy of exact repeats Stage 3 needs. Online Sequitur can be dropped in behind the same interface later (an initial Sequitur attempt was abandoned because its incremental pointer surgery was fragile, and correctness of Stage 2 matters more than which family member provides it). The suffix tree prototype (now surfaced as `demos/custom-suffix-tree-engine.html`) separately validated O(n) repeat enumeration in the browser.

---

### 3. Bookend Merge

The core insight. Compare Sequitur's grammar rules by aligning their bodies. Rules that share a prefix and suffix but differ in the middle are candidates for merging into a slotted template.

```
R1 → A B C D E
R2 → A B X D E
R3 → A B Y D E

Shared prefix: [A, B]
Shared suffix: [D, E]
Varying middle: {C, X, Y}

Merge → A B $1 D E    where $1 := {C, X, Y}
```

Slots are discovered as positions where rule bodies diverge. No pre-declaration of slot types needed. A slot's identity is the set of values observed at that position. Characterization (numeric, enum, timestamp) is optional post-hoc analysis.

**Open questions** (from `docs/research/FirstReview.md`):

| Question | Consideration |
|---|---|
| Which rules to compare? | All pairs is O(n^2). Need clustering or indexing by prefix/suffix hash. |
| Minimum bookend length? | Too short = coincidental. Too long = misses patterns. |
| Multi-position variance? | When two positions differ, is that one compound slot or two? |
| Nested variation? | When the varying middle is itself a rule reference, should alternatives collapse? |
| Ambiguous splits? | Multiple valid prefix/suffix decompositions for the same pair. |

**Status**: Implemented, in two flavors.
- **Bookend Merge** (`core/group-by-template.js`) is the literal prefix/suffix version above, with optional LCS multi-slot refinement. It is strong when records share a long structural literal, as DOM signatures do. It is the shared Stage-3/4 engine that both the DOM and general-text front-ends call.
- **Structural alignment** (`general/align-group.js`, `--group align`) buckets records by token count, then clusters by positional agreement. Divergent positions become slots. This directly answers the **multi-position variance** question: it recovers one template with a slot per varying field, where Bookend Merge would anchor on an incidental literal such as a client IP and fracture the template. It is demonstrated on `general/fixtures/access.log`. Still open: reconciling records whose field *count* differs, since they fall into different length buckets.

---

### 4. Selection

Rank merged templates by MDL. A template is worth keeping when its compression benefit exceeds its description cost.

```
totalCost = dictionaryCost + dataCost

dictionaryCost = sum over templates of (literalBytes + slotOverhead * slotCount)
dataCost = sum over instances of (templateRef + slotEncoding) + residualCost
```

When candidate templates overlap (compete for the same characters), resolve via weighted interval scheduling: select the non-overlapping subset maximizing total compression gain.

Concepts that remain valid from the phase specs:
- **Character Allocation invariant**: every byte belongs to either a template instance or residual
- **Greedy selection** (Krimp-style): accept templates in order of compression gain, stop when none improve
- **Hierarchy**: templates may nest (a slot value may itself match another template)
- **Residual diagnosis**: high-entropy residual = satiety; low-entropy residual = latent structure worth revisiting

**Status**: Built at two levels. `groupByTemplate` (Stage 3) contains a greedy MDL slice that assigns each *record* to at most one template. The fuller version lives in `selection/mdl-select.js`: an explicit MDL cost model (dictionaryCost + dataCost + residualCost) plus **exact weighted interval scheduling** (O(n log n) DP, verified optimal against brute force) for candidate templates whose instances overlap on the same characters, wrapped in Krimp-style greedy template inclusion. It is standalone today and becomes load-bearing once a candidate generator emits overlapping instances. The Phase 4 spec (`docs/history/phase-4-selection/README.md`) applies without modification.

---

### 5. Extraction

Map selected templates back to the original document. For each template, produce the list of instances with their slot values as offsets into the source text. Verify reconstruction: concatenating literals and slot values must reproduce the original spans exactly.

**Status**: Reconstruction verification is implemented. `reconstruct(template, slots)` round-trips every grouped member, and the DOM tests assert 100% fidelity. Mapping slot values back to *byte offsets* in the source document, rather than to the signature strings, is not yet built.

---

## What's Validated

| Component | Evidence |
|---|---|
| End-to-end DOM induction (HTML → signatures → templates) | `node dom/induce-from-html.js dom/fixtures/sample.html`; tested by `dom/test-extract.js` |
| End-to-end general-text induction (Tokenize → grammar → templates) | `node general/induce.js general/fixtures/access.log`; lossless at every layer, tested by `general/test-induce.js` |
| Grammar induction (Re-Pair), Stage 2 | `general/grammar.js`; reconstruction + rule-utility invariants in `general/test-grammar.js` |
| Weighted interval scheduling, Stage 4 | `selection/mdl-select.js`; exact, verified vs brute force over 400 random cases |
| Bookend Merge + greedy MDL selection (Stages 3-4) | `core/group-by-template.js`; 90-91% grouped, 100% reconstruction on 81 real signatures (`core/test-group.js`) |
| Suffix tree construction (Ukkonen's, SoA layout) | Working prototype: `demos/custom-suffix-tree-engine.html` |
| Repeat extraction + super-string collapsing | Prototype produces correct results on invoice test data |
| Character Allocation invariant | Enforced and verified in prototype (symbolStream + residual = full document) |
| Browser-viable TypedArray architecture | Prototype runs in-browser with no GC issues on test inputs |

## What's Still Open

These are genuine frontiers, not unbuilt basics. The five stages above all have
working implementations (see "What's Validated"); what remains is depth.

| Component | Notes |
|---|---|
| Online Sequitur | Re-Pair stands in for Stage 2 today behind the same grammar interface; an incremental Sequitur can replace it later. Both are well-studied. |
| Record-boundary discovery | Splitting a delimiter-free stream into records purely from the grammar (the `anchor` strategy) is unsolved when the dominant repeat doesn't coincide with the record unit. |
| Differing field counts | Structural alignment buckets records by token count, so records whose field *count* differs land in separate buckets and go ungrouped. |
| Overlapping-candidate selection | `selection/mdl-select.js` (exact weighted interval scheduling + Krimp-style greedy) is built and tested, but only becomes load-bearing once a generator emits candidates that compete for the same characters. |
| Nested / hierarchical templates | Slot values that themselves match another template (a parse DAG) are modeled conceptually but not yet produced. |
| Offset-level extraction | Slot values map back to signature/token strings, not yet to byte offsets in the source document. |
| Pairwise consistency / distance matrix | From the earlier Phase 2 spec; may be unnecessary given Bookend Merge, or may serve as a ranking signal for merge candidates. |

---

## Relationship to Existing Phase Specs

The four phase directories (`docs/history/phase-1-discovery/` through `docs/history/phase-4-selection/`) were written before the Sequitur + Bookend Merge pivot. They are archived under `docs/history/`; see `docs/history/README.md` for how their four-phase numbering relates to this pipeline's five stages. They describe a different algorithmic path: suffix array + LCP enumeration, followed by pairwise gap-variance scoring, followed by center-star alignment, followed by MDL selection.

**What still applies from those specs:**
- Interface contracts (TypedArray layouts, typed output structures)
- Failure mode analysis (token splitting, vocabulary explosion, conflation, shattering, cost modeling errors)
- Browser considerations (memory budgets, streaming computation, sparse representations)
- The Selection phase algorithms (interval scheduling, MDL, hierarchy) are path-independent

**What is superseded:**
- The specific Discovery algorithm (suffix tree traversal → Sequitur)
- The Topology phase concept (statistical gap-variance discrimination → structural Bookend Merge)
- Slot typing as an early concern (now explicitly post-hoc)

---

## The Decoy Problem

Both paths address the same core challenge: distinguishing structural anchors from variable decoys. "Invoice No:" is structure; "USD" is content that happens to repeat.

- **Old path**: Score symbol pairs by gap-variance. Low variance = structural, high variance = noise.
- **New path**: Sequitur only forms rules from exact repeats. Decoys that appear at inconsistent positions never become rules. Bookend Merge then handles near-repeats structurally.

The old path's insight (consistency of distance) may still be useful as a ranking signal within the new path. For example, it could score merge candidates by how consistently their instances are spaced. But it is no longer the primary discrimination mechanism.

---

## Key Invariants

These hold across both paths and are non-negotiable:

1. **Character Allocation**: Every character in the document is accounted for, either within a template instance or in residual. No gaps, no overlaps.
2. **Reconstruction Fidelity**: Concatenating a template's literals with an instance's slot values reproduces the original span exactly.
3. **Slots as Sets**: A slot is defined by its observed values, not a declared type. Typing is optional post-hoc characterization.

---

## Conceptual Foundations

These documents remain current and are not affected by the algorithmic pivot:

- `docs/concepts/Foundations.md`: the premises, objectives, and primitive model behind Wring (design rationale)
- `docs/concepts/Intuition.md`: first-principles observations about template structure
- `docs/concepts/Terms.md`: vocabulary for matching and emergence
- `docs/concepts/Order.md`: the decoy problem and distance-based discrimination (still valid as a concept; the implementation path changed)
