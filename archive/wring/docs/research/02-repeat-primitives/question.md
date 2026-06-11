# Research Question 2: Repeat Primitives + Candidate Control

> **Note**: This research question should be analyzed alongside the main project README.md, which provides the general research plan and context for the Wring project.

## Primary Question

Which primitives yield high-signal candidates while avoiding pattern explosion?

## Key Terminology

- **Occurrence list**: sorted positions of a candidate anchor in the document
- **Interval**: SA-range (pair of suffix array indices) representing those positions

## Research Focus

### Enumeration Approaches
- SA+LCP interval traversal: scan LCP array with stack of open intervals
- Suffix tree internal node traversal
- Suffix automaton
- Winnowing/fingerprinting as coarse seeding for large documents

### Repeat Types
- **Maximal repeats**: can't extend without losing occurrences
- **Supermaximal repeats**: maximal and not contained in any longer repeat with same frequency
- **Closed repeats**: no strict superpattern with the same occurrence set

**Open question**: which repeat type produces cleaner literal skeletons across different document types (logs vs legal text vs source code)?

### Candidate Control
- Frequency and length thresholds
- Dominance/containment pruning: when does a longer pattern subsume a shorter?
- Output-sensitive complexity depends on document structure
