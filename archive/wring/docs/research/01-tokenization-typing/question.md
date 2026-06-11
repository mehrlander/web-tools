# Research Question 1: Tokenization + Typing

> **Note**: This research question should be analyzed alongside the main project README.md, which provides the general research plan and context for the Wring project.

## Primary Question

What representation best supports template discovery in the context of single-document template induction?

## Key Considerations

### Token Granularity
- Character-level vs token stream (word/punct/whitespace)
- Should token boundaries be discovered from repeated structure rather than imposed?
- How does pre-tokenization affect pattern discovery?
- Trade-offs: pattern frequency vs structural fidelity

### Typing Strategy
- **Pre-typing**: normalize values (`<NUM>`, `<DATE>`, `<UUID>`) before mining
- **Post-typing**: infer types from discovered slot contents
- **Baker-style parameterization**: normalize to placeholders before mining
- **Hybrid approaches**: mine on both skeleton and value streams in parallel

### Implications
- How does typing affect slot encoding cost in MDL?
- What are the trade-offs between mining on "skeleton tokens" vs "value tokens"?
- Impact on pattern frequency vs structural fidelity
