# Research Question 6: Implementation

> **Note**: This research question should be analyzed alongside the main project README.md, which provides the general research plan and context for the Wring project.

## Primary Question

What JS/WASM architecture enables practical use in the browser?

## Research Focus

### JS Landscape Gaps (verify current state)
- `mnemonist`: GeneralizedSuffixArray, no repeat enumeration
- `@jayrbolton/suffix-tree`: Ukkonen's, no frequency-filtered enumeration
- `string-algorithms`: SA+LCP construction, no repeat API
- No library provides `getRepeats(minLen, minFreq)` → implement LCP-interval stack traversal

### Architecture Questions
- **WASM candidates**: SA+LCP construction, suffix automaton, grammar compression
- **JS layer**: tokenization, typing, candidate filtering, scoring, selection, output
- **Memory strategy**: TypedArrays, zero-copy views, chunking

### WASM↔JS Boundary
- Memory layout strategy needed: how do SA/LCP integers in WASM memory map to JS `templates[]` without expensive copying?
- Serialization of tree structures is the friction point

### Data Structures
- Interval lists for occurrences
- Cover bitmaps for overlap detection
- Template DAG if hierarchical model chosen
