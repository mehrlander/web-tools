# Algorithmic Foundations for Unsupervised Template Induction from Single-Document Repetitions

> **A sixth report, recovered rather than recombined.** This is a Gemini
> **Deep Research** run from 2025-12-20 17:29 UTC, four hours before the five
> Canvas reports beside it, and it answers the whole strawman pipeline rather
> than one research question. It was never committed to this repo, and is
> extracted from the private `mehrlander/chat-histories` archive (`2026-06-01-gemini-export`),
> whose activity record holds the finished report in full:
> `activity/2025-12.json`, `Prompted Start research` @ 2025-12-20T17:29:31.524Z · 4,433 words · 40 cited sources
>
> A Deep Research record and a Canvas record arrive in opposite formats, which
> is why this one needed no repair: Takeout exported it as HTML in the activity
> record's `safeHtmlItem`, carrying its own source list, where a Canvas arrives as
> Markdown in `subtitles` carrying no sources at all. Two edits: the `## Works
> cited` heading above that list, and its 40 entries turned into Markdown links.

<details>
<summary>Originating prompt, as the archive's extractor inferred it</summary>

> Deep Research Prompt: Inducing Templates From One Document Using Repeats  Goal Given one text document, discover a compact set of parameterized templates (literals + slots) plus where each template instantiates in the document. The guiding objective is to “wring out repetition”: templates should explain frequent structure and compress the document better than naïve substring deduping.  Core framing 	•	Input: a single string (≈ 100KB–10MB). 	•	Output: templates[] and instances[] (template id + start/end + slot values), plus any residual text not covered. 	•	Approach bias: bottom-up—start from repeated structure, then generalize into templates.  Research Questions (what I actually need answered) 	1.	Repeated-structure primitives (single-string): What are the best practical ways to extract repeated units with frequency/length thresholds? Compare: 	•	suffix array + LCP, suffix tree, and any output-sensitive “enumerate repeats” methods 	•	maximal / supermaximal / closed repeats: which primitive is most useful as an anchor for template literals? 	2.	From repeats to templates (“stitching”): How do we reliably combine repeats into a template skeleton (literals separated by variable gaps) and infer slot boundaries? 	•	positional co-occurrence / consistent relative offsets 	•	multi-occurrence alignment to decide what’s invariant vs variable 	•	relationship to grammar induction / grammar compression (e.g., Sequitur, Re-Pair) and when grammar rules can be treated as templates 	3.	Scoring and selection: What objective functions are well-founded and usable? 	•	MDL / compression-based scoring: templates + parameters + residual 	•	coverage vs parsimony tradeoffs (fewer templates with more slots vs many narrow templates) 	•	overlap resolution and whether greedy selection is “good enough” in practice 	4.	Near-neighbor domains worth stealing from: Identify the most relevant transferable ideas from: 	•	log template extraction (even if logs are line-segmented; what generalizes to free text?) 	•	motif discovery / approximate repeats (if fuzziness is allowed) 	•	clone / macro discovery in code (parameterized matching) 	5.	Implementation reality (browser/JS): What is feasible in JS for 100KB–1MB+ strings? 	•	practical suffix array/LCP options in JS or WASM (Rust/C/C++) 	•	any existing JS implementations of grammar induction or repeat mining 	•	memory/perf constraints and recommended architecture (streaming vs batch; chunking vs whole-string)  Strawman algorithm to critique (keep or replace) 	1.	build SA+LCP (or equivalent) 	2.	extract candidate repeats (prefer maximal/closed) with thresholds 	3.	discover co-occurring repeats with stable offsets → template skeletons 	4.	align occurrences → infer slots (invariants become literals) 	5.	score templates via MDL-ish compression + coverage penalty terms 	6.	select a non-overlapping (or conflict-resolved) set; optionally hierarchical templates 	7.	emit templates + instance map + residual  Ask: Is this decomposition sane? What are the known failure modes, and what algorithms/papers improve each step?  Desired deliverable from the research 	•	A short list of foundational algorithms/papers for repeat enumeration + maximal/closed repeat extraction 	•	The best-known approaches for stitching repeats into templates (incl. alignment strategies) 	•	A concrete objective function (MDL or proxy) and practical selection/overlap strategy 	•	A pragmatic JS/WASM implementation plan (what to build vs reuse)  Constraints: single document; bottom-up from repeats; aim for compression/structure discovery; practical browser implementation.

</details>

## 1. Executive Summary and Problem Formalization

The problem of inducing parameterized templates from a single text document constitutes a specific and highly challenging sub-domain of grammatical inference and structural data mining. Unlike traditional information extraction, which often relies on supervised training sets or massive corpora to achieve statistical significance, the single-document constraint mandates a "desert island" approach: the algorithm must derive its own statistical validity solely from the internal redundancy of the input string. The objective is to factorize a raw string $S$ (typically 100KB to 10MB in size) into a structured representation consisting of a set of templates $\mathcal{T}$ and a set of instances $\mathcal{I}$. A template is defined as a sequence of rigid literals interrupted by variable slots (parameters), while instances represent the specific values filling those slots at specific offsets in $S$.

The guiding principle for this induction is the "wringing out" of repetition. From an information-theoretic perspective, any recurring structure represents redundancy. If a string $S$ contains frequent occurrences of the substring `Error at address [HEX]`, a raw encoding is inefficient. Replacing these occurrences with a reference to a template $T_i$ and the differential data (the distinct hex addresses) compresses the document. Thus, the problem of template induction is isomorphic to the problem of **optimal dictionary-based data compression** under the constraint of human-interpretability. We seek a model that minimizes the global description length of the data, leveraging the Minimum Description Length (MDL) principle to navigate the trade-off between model complexity (the number and granularity of templates) and data fit (the amount of residual, uncovered text).

This report conducts a comprehensive analysis of the algorithmic primitives, combinatorial "stitching" strategies, and objective functions required to solve this problem. We adopt a bottom-up bias, positing that global structure emerges from the coalescence of local primitives (repeats). We rigorously critique a "strawman" algorithm—which naively chains repeats—and propose a refined pipeline that integrates state-of-the-art techniques from bioinformatics (Multiple Sequence Alignment, Profile HMMs), log analysis (Drain, Spell), and stringology (Suffix Arrays, LCP Intervals). Finally, we assess the implementation reality of deploying these algorithms in a browser-based JavaScript/WebAssembly (WASM) environment, addressing specific constraints regarding memory layout, garbage collection overhead, and the zero-copy transfer of large textual datasets.

### 1.1 Formal Problem Statement

Let $S$ be a string over an alphabet $\Sigma$ with length $N$. We seek to discover a set of templates $\mathcal{T} = {T_1, T_2, \dots, T_k}$. Each template $T_i$ is a sequence of tokens comprising literals $L \in \Sigma^*$ and wildcard slots $\phi$.
$$T_i = L_{i,1} \cdot \phi_1 \cdot L_{i,2} \cdot \phi_2 \cdot \dots \cdot L_{i,m}$$
The goal is to find a set of non-overlapping occurrences $\mathcal{O}$ that "cover" the string $S$ such that the total description length is minimized. An occurrence is a tuple $(T_{id}, \text{start_pos}, {v_1, v_2, \dots, v_k})$, where $v_j$ are the substrings of $S$ corresponding to the slots $\phi_j$.

The core research questions addressed herein are:

1. **Primitives:** How do we efficiently extract candidate repeats from $S$ in linear time?
2. **Stitching:** How do we assemble fragmented repeats into parameterized templates?
3. **Selection:** How do we distinguish structural signal from random noise using MDL?
4. **Implementation:** Can this be executed performantly in a browser for 10MB strings?

---

## 2. Repeated-Structure Primitives: The Suffix Domain

The extraction of repeated primitives is the bedrock of bottom-up template induction. In a string of length $N$, the number of substrings is $O(N^2)$, making brute-force counting impossible for $N > 10^4$. We must rely on indexed string structures to identify repetition classes in linear or near-linear time. The Suffix Array (SA) combined with the Longest Common Prefix (LCP) array provides the theoretically optimal and practically most efficient mechanism for this task.[1, 2]

### 2.1 The Suffix Array and LCP Ecosystem

A Suffix Array $SA$ for string $S$ is an integer array of size $N$ such that $SA[i]$ is the starting position of the $i$-th lexicographically smallest suffix of $S$. Unlike Suffix Trees, which require extensive pointer overhead (often $20N$ bytes), Suffix Arrays store only integers ($4N$ bytes), a critical advantage for browser-based processing of megabyte-scale files.[1, 3]

However, the sorted order alone obscures the _structure_ of repetitions. The LCP array bridges this gap. $LCP[i]$ stores the length of the longest common prefix between suffix $S..]$ and $S..]$.

- **LCP Intervals:** A value $LCP[i] \ge \ell$ implies that the suffixes at $SA[i]$ and $SA[i-1]$ share a prefix of length $\ell$. A continuous range (interval) in the LCP array where all values are $\ge \ell$ represents a set of suffixes that all share a common prefix of length $\ell$. This common prefix is a **repeat**.
- **Tree Simulation:** It has been proven that traversing the LCP intervals of a Suffix Array is equivalent to a bottom-up traversal of a Suffix Tree.[1, 4] This allows us to access the rich structural insights of suffix trees (branching factors, subtree sizes) without the memory penalty.

### 2.2 Classes of Repeats: Filtering for Significance

Blindly extracting all repeats yields massive redundancy. If "template" is a repeat, then "templat", "emplat", and "mplate" are also repeats. We must filter for maximality and closure to obtain useful template skeletons.

#### 2.2.1 Maximal Repeats

A repeat is **maximal** if it cannot be extended to the left or right without reducing its frequency. Formally, a substring $P$ occurring at positions ${p_1, p_2, \dots}$ is left-maximal if the set of characters ${S[p_i - 1]}$ contains at least two distinct characters. It is right-maximal if ${S[p_i + |P|]}$ contains distinct characters.[1, 5]

- **Relevance:** Maximal repeats capture the full extent of a rigid literal sequence. For a template `Error: [code]`, the string "Error: " is a maximal repeat because it is preceded by various distinct characters (end of previous lines) and followed by distinct error codes.
- **Computation:** Maximal repeats can be computed in $O(N)$ time by analyzing the "change" in LCP values (local maxima in the LCP array) and checking the Burrows-Wheeler Transform (BWT) character set for left-maximality.[1]

#### 2.2.2 Supermaximal Repeats

A **supermaximal** repeat is a maximal repeat that does not occur as a substring of any other maximal repeat.

- **Relevance:** These represent the longest independent repeated entities.
- **Limitations:** This criterion is often too strict for template induction. If `User:` and `User: [Name]` are both templates, the literal `User: ` is a repeat. If `User: ` is always part of one of these two longer structures, it might not be supermaximal if the data is dense, or it might be supermaximal only if the variable slots are unique. We generally prefer Closed Repeats over Supermaximal repeats for this specific domain.

#### 2.2.3 Closed Repeats (The Gold Standard)

A substring $P$ is a **Closed Repeat** if there exists no extension of $P$ (left or right) that has the **exact same set of occurrence positions**.[6, 7]

- **Relevance:** This is the most semantically significant primitive for template extraction. If the string `Server Start` occurs at positions ${10, 500, 900}$, and extending it to `Server Start ` (with space) also occurs at ${10, 500, 900}$, then `Server Start` is _not_ closed. The space is structurally implied. However, extending to `Server Start 1` might only occur at ${10}$, dropping the others. Thus, `Server Start ` is the closed repeat.
- **Implication:** Closed repeats define the exact boundaries between literals and slots. They represent the "edge of determinism" in the string.
- **Algorithm:** Closed repeats can be computed in $O(N)$ or $O(N \log N)$ time using discretized LCP intervals.[6]

### 2.3 Algorithms for Construction

To satisfy the "implementation reality" requirement, we must select algorithms that are not just theoretically linear but cache-friendly and parallelizable.

#### 2.3.1 SA-IS (Induced Sorting)

The **SA-IS** algorithm [8] is currently the standard for linear-time Suffix Array construction.

1. **Classification:** Classify suffixes as S-type (smaller than next suffix) or L-type (larger).
2. **LMS Substrings:** Identify Left-Most S-type (LMS) suffixes.
3. **Recursive Sort:** Sort LMS substrings recursively (reducing the problem size).
4. **Induction:** Use the sorted LMS suffixes to induce the order of L-type and then S-type suffixes in a single pass.
**Performance:** SA-IS is extremely fast and memory efficient ($O(N)$ working space). It is the engine behind popular libraries like `libdivsufsort` and `libsais`.[9, 10]

#### 2.3.2 Skew Algorithm (DC3)

The Skew algorithm [11] (Difference Cover 3) recursively sorts suffixes at positions $i \mod 3 \neq 0$. It is easier to implement parallelly but generally slower in sequential execution than SA-IS due to higher constant factors and memory usage.

#### 2.3.3 Kasai’s Algorithm for LCP

Once the SA is built, the LCP array is constructed using **Kasai’s Algorithm**.[12] It iterates through suffixes in _string order_ (using the Inverse Suffix Array, or Rank array). It relies on the theorem that $LCP[rank[i]] \ge LCP[rank[i-1]] - 1$. This allows "skipping" comparisons that are already known, ensuring $O(N)$ total comparisons.

### 2.4 Table: Comparison of Suffix Construction Algorithms

| Algorithm | Time Complexity | Space Complexity | Practical Speed | Key Feature |
| :--- | :--- | :--- | :--- | :--- |
| **Naive (Quicksort)** | $O(N^2 \log N)$ | $O(N)$ | Very Slow | Trivial to implement; fails on repetitive text. |
| **Manber-Myers** | $O(N \log N)$ | $O(N)$ | Moderate | First doubling algorithm; conceptually simple. |
| **Skew (DC3)** | $O(N)$ | $O(N)$ | Fast | Easily parallelizable; good for distributed systems. |
| **SA-IS** | $O(N)$ | $O(N)$ | **Very Fast** | State-of-the-art; minimizes cache misses. |
| **LibDivSufSort** | $O(N \log N)$ (worst) | $O(1)$ aux | **Fastest** | Engineered implementation of induced sorting; sub-linear memory. |

**Conclusion for Section 2:** The "Strawman" step 1 is correct but requires specificity. We must use **SA-IS** (via `libsais` in WASM) to build the SA, followed by Kasai's algorithm for LCP. We must then harvest **Closed Repeats** from the LCP intervals to form the candidate set of literals.

---

## 3. From Repeats to Templates: The Stitching Problem

The "Stitching" phase transforms a bag of rigid repeats into a structured template skeleton. A template like `Process started` implies a structural relationship between the repeat `Process ` and the repeat ` started`. They co-occur positionally with a variable gap. This is the "Gapped Repeat" problem.

### 3.1 Combinatorics of Gapped Repeats

A gapped repeat is a structure $uvu$ where $u$ is the arm (literal) and $v$ is the gap. For template induction, we generalize this to $u_1 v u_2$, where $u_1$ and $u_2$ are distinct repeats that form a sequence.

- **Positional Co-occurrence:** If repeat $R_A$ occurs at positions $P_A = {a_1, a_2, \dots}$ and repeat $R_B$ occurs at $P_B = {b_1, b_2, \dots}$, we seek a mapping where $b_i - a_i \approx \delta$ (or within a valid slot length range).

**Chaining Algorithm:** This can be modeled as finding the longest path in a Directed Acyclic Graph (DAG) where nodes are repeat instances and edges represent "valid gap" constraints.

  - _Nodes:_ Every occurrence of every closed repeat.
  - _Edges:_ $(R_{A, i}, R_{B, j})$ exists if $start(R_{B, j}) > end(R_{A, i})$ and $distance < \text{max_slot_size}$.
  - _Optimization:_ Finding the "heaviest" path (coverage) in this graph yields a template skeleton.[13] Since the graph is massive, we filter by only linking repeats that appear in the same relative order in at least $K$ instances.

### 3.2 Alignment-Based Stitching

Borrowing from bioinformatics, **Multiple Sequence Alignment (MSA)** offers a powerful way to infer slots.[14, 15]

1. **Clustering:** Group string segments that share a "seed" repeat (e.g., all lines starting with `[INFO]`).
2. **Global Alignment:** Perform MSA (e.g., using ClustalW logic or progressive pairwise alignment) on the cluster.

**Consensus Extraction:** Examine the columns of the alignment matrix.

  - _Conserved Columns:_ Tokens/Characters identical in >90% of rows $\to$ **Literals**.
  - _Variable Columns:_ Tokens/Characters with high entropy or gaps $\to$ **Slots**.[16, 17]

**Example:**
Seq 1: User 'Alice' login
Seq 2: User 'Bob'   login
Seq 3: User 'Eve'   login
MSA  : User '---'   login  (Consensus: User '' login)
While full MSA is computationally expensive ($O(L^N)$), constrained variants like **Profile HMMs** (Hidden Markov Models) are highly effective. A Profile HMM trains a state machine where "Match" states emit literals and "Insert" states model variable slots. Training a Profile HMM on a cluster of text segments effectively "learns" the template structure and transition probabilities.[18, 19]

### 3.3 Grammar Induction Approaches

Grammar induction algorithms like **Sequitur** [20] and **Re-Pair** [21] operate by iteratively compressing frequent bigrams into non-terminal rules.

- **Sequitur Logic:** Scans the text. Maintains a constraint that no pair of adjacent symbols appears more than once in the grammar. If `ab` appears twice, replace with rule $A \to ab$.

**Application to Templates:** A template `A [slot] B` might be induced as a set of rules:

  - $S \to X \text{Alice} Y$
  - $S \to X \text{Bob} Y$
  - $X \to \text{User }$
  - $Y \to \text{ Login}$
- **The Merging Problem:** Sequitur is lossless and rigid. It creates a "branch" for every unique slot value. To recover the template, we must post-process the grammar, merging rules that share context (e.g., $X$ and $Y$) but differ in the middle. This "Merge-based" grammar induction is analogous to the "Stitching" problem but operates on the rule set rather than raw text.[22]

### 3.4 Failure Modes of Naive Stitching

The "Strawman" approach suggests "align occurrences". The critical failure mode here is **misalignment due to variable length slots**. Standard alignment algorithms (Needleman-Wunsch) penalize gaps linearly or affinely. If one slot value is length 5 (`Alice`) and another is length 50 (`Administrator_Account`), the alignment score drops drastically, potentially breaking the association between the surrounding literals.

- **Fix:** Use **Token-Based Alignment** rather than character-based alignment. Mapping words to integers abstracts away length differences. Use **Affine Gap Penalties** where the cost of opening a gap is high, but extending it is low or zero. This encourages the algorithm to bridge large slot variances.[23, 24]

---

## 4. Scoring and Selection: The MDL Objective

The extraction and stitching phases will produce a "Pattern Explosion": a massive, overlapping set of candidate templates. `User *` is a candidate. `* Login` is a candidate. `User * Login` is a candidate. Which ones are "real"?

The **Minimum Description Length (MDL)** principle provides the rigorous razor to shave away redundant or coincidental patterns. MDL equates "learning" with "compression". The best set of templates is the one that compresses the original document $D$ most effectively.[25, 26]

### 4.1 The Two-Part Code Formulation

We define the total description length $L(D, H)$ as:
$$L(D, H) = L(CT) + L(D | CT)$$
Where $CT$ is the "Code Table" (the set of templates) and $D | CT$ is the document encoded using that table.

#### 4.1.1 Code Table Cost $L(CT)$

This is the cost to transmit the model itself.

- We must encode the number of templates $|\mathcal{T}|$.

For each template $T \in \mathcal{T}$, we encode:

  - The literals (using standard character entropy).
  - The structure (number and position of slots).
  - The "Gap Code" parameters (expected distribution of slot lengths).[27]
- **Insight:** Heavy, complex templates cost more. This penalizes overfitting (storing the whole document as one template).

#### 4.1.2 Encoded Data Cost $L(D | CT)$

This is the cost to transmit the document stream using the templates.

- The document is represented as a stream of **Template IDs** and **Slot Fills**.
- **Template IDs:** Encoded using optimal prefix codes (Huffman/Shannon) based on their usage frequency. $Cost \approx -\sum \log_2 P(T_i)$. Frequent templates get short codes.
- **Slot Fills:** The raw text inside the slots is encoded. If the slots are truly random, this is high cost. If the slots show internal regularity (e.g., always digits), we can use a specialized "Gap Code" to reduce this cost.
- **Residue:** Any text not covered by a template is encoded as raw literals (high cost).

### 4.2 The Krimp Algorithm (Heuristic Search)

Finding the optimal $CT$ is NP-hard. We adapt the **Krimp** (Itemset Mining) and **GoKrimp** (Sequence Mining) algorithms.[28, 29, 30]

**The Krimp Algorithm Steps:**

1. **Candidate Generation:** Start with the set of Closed Repeats and Stitched Chains from previous steps.
2. **Standard Candidate Order:** Sort candidates by a heuristic prioritizing likely utility (e.g., Length $\times$ Frequency).

**The Sieve:** Start with an empty $CT$ (containing only single characters). Iterate through the sorted candidates:

  - Tentatively add candidate $C$ to $CT$.
  - **Cover** the document using the new $CT$. (Greedy strategy: at current position, match the longest/best template in $CT$).
  - Calculate $L(D, H)$.
  - If the total length **decreases**, keep $C$ in $CT$. Otherwise, discard it.
4. **Pruning:** Periodically remove templates from $CT$ that are no longer used (usage count drops to zero due to better templates stealing their occurrences).

**Refining SQS (Sequence Squeeze):**
The **SQS** algorithm [27, 31] extends this by specifically modelling **gaps**. In SQS, the cost function explicitly penalizes the information required to describe the _length_ of the gap.

- If a template has a gap that is always length 0 (no gap), the cost is near zero.
- If the gap varies (1 to 100), the cost increases.
- This naturally favors "rigid" templates while allowing flexibility where necessary.

---

## 5. Near-Neighbor Domains: "Stealing" Heuristics

We can significantly improve robustness by adopting heuristics from related fields.

### 5.1 Log Template Extraction (Log Parsing)

Logs are essentially "templates with slots" generated by code.

**Drain (Fixed-Depth Tree):** Drain [32, 33] parses logs by building a tree where each depth is a token position.

  - _Logic:_ If a leaf node (template) differs from a new log line only by specific tokens, and the "similarity" is high, merge them. If a specific token position has high variance (fan-out > threshold), collapse it to a wildcard `*`.
  - _Steal:_ The **Fixed-Depth Tree** is an excellent $O(N)$ first pass to cluster lines that share the same prefix structure.

**Spell (LCS Streaming):** Spell [34] uses Longest Common Subsequence.

  - _Logic:_ Maintain a list of active LCS objects. For a new line, find the LCS with existing templates. If $|LCS| \ge \alpha \times Length$, merge and update the template.
  - _Steal:_ The **LCS-based update** mechanism. When merging a new instance into a template, any token that doesn't match the consensus becomes a slot. This effectively "learns" slots online.

### 5.2 Bioinformatics

**Motif Discovery (MEME/GLAM2):** These tools use Expectation-Maximization or Gibbs Sampling to find probabilistic motifs.

  - _Steal:_ **Position Weight Matrices (PWM)**. Instead of binary "Literal vs Slot", model each position as a probability distribution over characters. If entropy is low ($P('A') > 0.9$), it's a literal. If entropy is high, it's a slot. This handles "noisy" templates (typos) better than strict string algorithms.[35]

### 5.3 Code Clone Detection

**Tokenization:** Clone detectors (CCFinder) operate on tokens (identifiers, keywords, literals) rather than characters.

  - _Steal:_ **Abstract Tokenization**. Before running Suffix Arrays, convert the document to a stream of `(Type, Value)` tuples. Map all numbers to `<NUM>`, all strings to `<STR>`, all identifiers to `<ID>`. Run repeat finding on this abstract stream. This immediately "solves" the slot problem for simple types (e.g., `ID = ID + 1` becomes `ID = ID + NUM`, which is a rigid repeat in token space).

---

## 6. Implementation Reality: JS/WASM in the Browser

Deploying this pipeline in a browser for 10MB strings requires careful architectural choices. JavaScript's managed heap and garbage collection (GC) are ill-suited for the massive integer arrays ($O(N)$) required for Suffix Arrays.

### 6.1 The WASM Advantage

WebAssembly (WASM) offers linear memory and near-native performance for array manipulations.

- **Memory Management:** A 10MB string requires 40MB for the SA (32-bit integers) and 40MB for the LCP. Total ~100MB. This fits comfortably in WASM's 4GB address space.
- **Zero-Copy:** We can instantiate `WebAssembly.Memory` in JS, create a `Uint8Array` view, and copy the document directly into it. The WASM module (compiled from C/C++) can access this memory directly without serialization overhead. The resulting SA/LCP arrays can be read back by JS using `Int32Array` views on the same buffer.[36, 37]

### 6.2 Library Selection

- **`libdivsufsort`:** This is widely considered the fastest lightweight Suffix Array construction library.[38, 39] It uses an optimized Induced Sorting algorithm. It compiles cleanly to WASM via Emscripten.
- **`libsais`:** A newer alternative that also implements Induced Sorting (SA-IS) and includes LCP construction.[9] Benchmarks often show it outperforming `libdivsufsort` on modern hardware.
- **Recommendation:** Use `libsais` compiled to WASM. It provides both SA and LCP in linear time with minimal footprint.

### 6.3 Performance and Chunking

For strings >10MB (or low-end devices), we can use **Sparse Suffix Arrays**.[40]

- _Concept:_ Only sort every $K$-th suffix. Reduces memory by factor $K$.
- _Trade-off:_ Repeat finding becomes approximate. Given the goal is finding _frequent_ templates, missing a few occurrences is acceptable if it allows processing 50MB logs on a phone.
- _Chunking:_ If the document is massive, split it into chunks (e.g., 5MB). Process each chunk to find local templates. Then, merge the template sets (Code Tables) by checking if templates from Chunk A explain Chunk B efficiently (MDL cross-validation).

---

## 7. Synthesis: The Refined Algorithmic Pipeline

Based on the research, we propose the following robust pipeline, replacing the flawed strawman.

### Phase 1: Preprocessing & Indexing (WASM)

1. **Tokenize:** Convert raw string $S$ into a Token Stream $T$ and an associated "Skeleton String" (abstracted tokens). This dramatically reduces the effective $N$.

**Construct Indices:**

  - Load $T$ into WASM linear memory.
  - Run `libsais` to compute **Suffix Array ($SA$)** and **LCP Array**.
  - Compute **Inverse SA (Rank)** for rapid lookups.

### Phase 2: Primitive Extraction (WASM/JS)

**Extract Closed Repeats:**

  - Scan the LCP array. Identify intervals $[i, j]$ where LCP values are $\ge \text{min_len}$.
  - Check **Closure Property:** Can this interval be extended left/right without changing the set of suffix indices ${SA[i] \dots SA[j]}$?
  - Filter by **Coverage**: Keep candidates where $Length \times Frequency > \text{threshold}$.
  - _Result:_ A dictionary of rigid "Literal Blocks".

### Phase 3: Stitching & Template Formation (JS)

**Chain Co-occurrences:**

  - Represent document as a sequence of Literal Block IDs.
  - Use a **Sliding Window** or **Suffix Tree on Block IDs** to find frequent sequences of blocks (e.g., Block A followed by Block B).
  - Calculate **Gap Statistics**: For every pair $(A, B)$, record the distribution of gap lengths.
  - _Heuristic:_ If Gap Entropy is low (gaps are consistent), merge into a larger literal. If Gap Entropy is high (gaps vary), define a **Slot**.

**Alignment Refinement (Optional):**

  - For high-value candidates, gather all raw text instances.
  - Run **Profile HMM** training (or simple column-wise consensus) to refine the boundaries between literals and slots.

### Phase 4: MDL Selection (JS)

**Krimp Sieve:**

  - Initialize Code Table $CT = \text{Singletons}$.
  - Sort candidates by Coverage Gain.

**Loop:**

    - Add candidate $C$ to $CT$.
    - **Greedy Cover:** Encode the token stream $T$ using $CT$. Resolve overlaps by picking the longest matching template at each position.
    - **Cost Check:** Calculate $L(CT) + L(T|CT)$.
    - If Total Length decreases, **Commit** $C$. Else, **Rollback**.

**Post-Processing:**

  - Generalize slots (e.g., if a slot matches `\d+` in all instances, tag it as `<NUM>`).
  - Emit final Templates (Regex) and Instance Map.

### 7.1 Comparison with Strawman

| Feature | Strawman Algorithm | Refined Pipeline |
| :--- | :--- | :--- |
| **Repeat Type** | Undefined (likely maximal) | **Closed Repeats** (handles boundaries) |
| **Stitching** | "Discover co-occurring" (Vague) | **Token Chaining + Gap Entropy** |
| **Scoring** | Generic MDL | **Krimp Sieve (Greedy Cover)** |
| **Data Structure**| SA+LCP (Generic) | **SA-IS + LCP (WASM) + Tokenization** |
| **Failure Mode** | Explosion of patterns | **MDL prevents overfitting** |

This refined approach leverages the raw speed of Suffix Arrays for discovery and the theoretical rigor of MDL for selection, ensuring the output is a compact, interpretable set of templates rather than a noisy list of substrings.

## Works cited

1. [Enhanced Suffix Arrays and Applications - Uni Ulm](https://www.uni-ulm.de/fileadmin/website_uni_ulm/iui.inst.190/Mitarbeiter/ohlebusch/PAPERS/HCMB8.pdf)
2. [Suffix array - Wikipedia](https://en.wikipedia.org/wiki/Suffix_array)
3. [Fast Frequent String Mining Using Suffix Arrays - mediaTUM](https://mediatum.ub.tum.de/doc/1094574/document.pdf)
4. [Replacing suffix trees with enhanced suffix arrays](https://www.mi.fu-berlin.de/wiki/pub/ABI/Sequence_analysi_2013/Journal_of_Discrete_Algorithms_2004_AbouelhodaReplacing_suffix_trees_with_enhanced_suffix_arrays.pdf)
5. [[1304.0528] Efficient repeat finding via suffix arrays - arXiv](https://arxiv.org/abs/1304.0528)
6. [Closed Repeats - arXiv](https://www.arxiv.org/pdf/2410.00209)
7. [Closed Repeats](https://arxiv.org/abs/2410.00209)
8. [Formally Verified Suffix Array Construction - Minerva Access](https://minerva-access.unimelb.edu.au/bitstreams/23acb18e-6c06-4e6e-8bcc-5a748a598b59/download)
9. [libsais - crates.io: Rust Package Registry](https://crates.io/crates/libsais)
10. [Fast, parallel, and cache-friendly suffix array construction - PMC - NIH](https://pmc.ncbi.nlm.nih.gov/articles/PMC11056320/)
11. [Simple Linear Work Suffix Array Construction* - CMU School of Computer Science](https://www.cs.cmu.edu/~guyb/paralg/papers/KarkkainenSanders03.pdf)
12. [Suffix Array - VisuAlgo](https://visualgo.net/en/suffixarray)
13. [Minimum Unique Substrings and Maximum Repeats | Request PDF - ResearchGate](https://www.researchgate.net/publication/220444695_Minimum_Unique_Substrings_and_Maximum_Repeats)
14. [Multiple Sequence Alignment objects — Biopython 1.87.dev0 documentation](https://biopython.org/docs/dev/Tutorial/chapter_msa.html)
15. [Sequence alignment - Wikipedia](https://en.wikipedia.org/wiki/Sequence_alignment)
16. [A Novel Algorithm for Finding Interspersed Repeat Regions - PMC - NIH](https://pmc.ncbi.nlm.nih.gov/articles/PMC5172473/)
17. [Bioinformatics: How is consensus sequence created? - Quora](https://www.quora.com/Bioinformatics-How-is-consensus-sequence-created)
18. [HMMEditor: a visual editing tool for profile hidden Markov model - PMC - PubMed Central](https://pmc.ncbi.nlm.nih.gov/articles/PMC2386073/)
19. [HMM Lecture Notes-Part 2 Designing HMMs: Motif discovery and modeling](https://www.cs.cmu.edu/~durand/03-711/2015/Lectures/hmm-part2-Dec3.pdf)
20. [Grammar-based Compression of DNA Sequences - Broad Institute](https://personal.broadinstitute.org/neva/publications/dnasequitur.pdf)
21. [The original LZ77 algorithm works as follows: • A phrase Tj starting at a position i is encoded as a triple of the form hdista](https://www.cs.helsinki.fi/juha.karkkainen/opetus/12k/dct/lecture07.pdf)
22. [Discovering Textual Structures: Generative Grammar Induction using Template Trees - Association for Computational Creativity](https://computationalcreativity.net/iccc20/papers/148-iccc20.pdf)
23. [Pairwise Sequence Alignment — SeqAn main documentation - Read the Docs](https://seqan.readthedocs.io/en/main/Tutorial/Algorithms/Alignment/PairwiseSequenceAlignment.html)
24. [BSAlign: a library for nucleotide sequence alignment - bioRxiv](https://www.biorxiv.org/content/10.1101/2024.01.15.575791v1.full-text)
25. [A Tutorial Introduction to the Minimum Description Length Principle - CWI](https://homepages.cwi.nl/~pdg/ftp/mdlintro.pdf)
26. [Minimum description length - Wikipedia](https://en.wikipedia.org/wiki/Minimum_description_length)
27. [The Long and the Short of It: Summarising Event Sequences with Serial Episodes - Exploratory Data Analysis](https://eda.rg.cispa.io/pubs/2012/sqs-tatti,vreeken.pdf)
28. [Slim: Directly Mining Descriptive Patterns - Exploratory Data Analysis](https://eda.rg.cispa.io/pubs/2012/slim-smets,vreeken.pdf)
29. [Mining Compressing Sequential Patterns - Philippe Fournier-Viger](https://www.philippe-fournier-viger.com/spmf/gokrimp.pdf)
30. [KRIMP: Mining itemsets that compress | Request PDF - ResearchGate](https://www.researchgate.net/publication/220451863_KRIMP_Mining_itemsets_that_compress)
31. [Summarising Event Sequences | Adrem Data Lab](http://adrem.uantwerpen.be/sqs)
32. [Drain — logparser 0.1 documentation](https://logparser.readthedocs.io/en/latest/tools/Drain.html)
33. [How Drain3 Works: Parsing Unstructured Logs into Structured Format - Medium](https://medium.com/@lets.see.1016/how-drain3-works-parsing-unstructured-logs-into-structured-format-3458ce05b69a)
34. [Spell: Streaming Parsing of System Event Logs - Virtual Server List](https://users.cs.utah.edu/~lifeifei/papers/spell.pdf)
35. [Efficient motif search in ranked lists and applications to variable gap motifs - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC3401424/)
36. [Passing arrays between wasm and JavaScript - rob-blackbourn.github.io](https://rob-blackbourn.github.io/blog/2020/06/07/wasm-arrays/)
37. [WebAssembly JavaScript Interface - W3C](https://www.w3.org/TR/wasm-js-api-2/)
38. [libdivsufsort - Google Code](https://code.google.com/archive/p/libdivsufsort)
39. [y-256/libdivsufsort: A lightweight suffix-sorting library - GitHub](https://github.com/y-256/libdivsufsort)
40. [Direct construction of sparse suffix arrays with Libsais - bioRxiv](https://www.biorxiv.org/content/10.1101/2025.02.24.639849.full)
