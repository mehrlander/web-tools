Wring Engine: Phase 1 — High-Performance Suffix Tree Pattern Induction
This document summarizes the architectural and algorithmic foundations of the Wring Phase 1 Engine. This module is responsible for the linear-time construction of a Suffix Tree and the extraction of structural anchors from single documents.
1. Technical Architecture: Struct-of-Arrays (SoA)
To achieve high performance within the JavaScript runtime (V8), the engine avoids the "Object Tax" (memory overhead and GC pressure of millions of small objects). Instead, it manages memory manually using TypedArrays.
Memory Map
The tree topology and metadata are stored in parallel Int32Array buffers. Each "Node" is a simple integer index pointing into these arrays:
| Buffer | Type | Description |
|---|---|---|
| start | Int32Array | Starting index of the edge label in the source text. |
| end | Int32Array | Ending index of the edge label (or -1 for global leaf end). |
| links | Int32Array | Suffix links for O(1) lateral traversal during construction. |
| firstChild | Int32Array | Index of the first child node (First-Child/Next-Sibling layout). |
| nextSibling | Int32Array | Index of the next sibling in the adjacency list. |
Performance Impact: This architecture allows for O(n) construction and O(n) traversal while keeping the memory footprint strictly linear (~20–24 bytes per character).
2. Algorithm: Ukkonen’s Linear-Time Construction
The engine implements Ukkonen’s Algorithm (1995) to build the tree online in a single pass.
Key Optimizations
 * Implicit Suffix Links: Enables the algorithm to jump to the next suffix extension point without traversing from the root.
 * Active Point Management: Tracks the current location in the tree via a (node, edge, length) tuple, allowing the algorithm to skip redundant character comparisons.
 * The Showstopper Rule: Construction for the current phase halts as soon as a suffix is found to already exist in the tree, ensuring true O(n) complexity.
3. Pattern Extraction & The "Decoy" Problem
Once the tree is built, the engine performs a post-order Depth-First Search (DFS) to identify repeating patterns.
Scoring Logic
Each internal node represents a repeated substring. We calculate a Coverage Score (S) to rank patterns:

 * Frequency (f): The number of leaves in the node's subtree.
 * Length (L): The string depth (number of characters from root to node).
Semantic Filtering (Super-string Collapsing)
To solve the "Decoy Problem" (where short patterns score high because they are subsets of longer anchors), the engine applies a Maximal Repeat Filter:
> If Pattern A is a substring of Pattern B, and Frequency(A) == Frequency(B), Pattern A is discarded.
> 
This ensures that the engine surfaces Invoice No:  rather than just Invoice  or : .
4. Summary of Capabilities
 * Structural Anchor Discovery: Automatically identifies the "static" parts of a document.
 * Noise Suppression: Effectively categorizes low-length or low-frequency repeats as residual noise.
 * Phase 2 Readiness: The output (JSON Repeat Registry) provides the necessary "pins" for pairwise document alignment and template synthesis.
5. Sample Output Format
The engine produces a Repeat Registry optimized for downstream induction:
[
  {
    "pattern": "Total Due: $",
    "freq": 3,
    "len": 12,
    "score": 36
  },
  {
    "pattern": "Invoice No: ",
    "freq": 3,
    "len": 12,
    "score": 36
  }
]

Next Step: Proceed to Phase 2: Pairwise Consistency, where these registries are intersected across multiple documents to define global structural anchors and extract variable slot content.
