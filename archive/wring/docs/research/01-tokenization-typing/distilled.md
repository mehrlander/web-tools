# Distilled Findings: Tokenization + Typing

## Executive Summary

The representation that best supports template discovery is one that exposes repeated structure while minimizing false generalization. The fundamental trade-off is between **pattern frequency** (how often patterns appear) and **structural fidelity** (how well patterns align with meaningful units). Character-level tokenization maximizes pattern discovery but produces noise and unintuitive boundaries; word-level tokenization is interpretable but misses intra-word patterns and is brittle to formatting variations. The optimal middle ground is **punctuation-aware tokenization** that treats words, numbers, and structural symbols (punctuation, HTML tags, delimiters) as separate tokens, preserving both interpretability and the ability to capture structural patterns.

Typing strategies—how variable content is normalized—directly affect what patterns surface. **Pre-typing** (replacing numbers, dates, IDs with placeholders before mining) dramatically increases pattern frequency by making structurally similar text identical, essential for domains like logs where raw text has almost no exact repeats. **Post-typing** (inferring types after finding exact repeats) preserves fidelity but misses patterns that require generalization. **Baker-style parameterization** offers maximum generalization by treating any consistent token substitution as equivalent structure, though at higher implementation complexity. The choice depends on document type: logs demand aggressive pre-typing, structured documents (legal text) need minimal normalization, and HTML benefits from tag-aware tokenization with moderate content typing.

The MDL objective naturally guides these choices: good representations increase compression savings (more reuse from discovered patterns) while keeping costs low (template complexity, slot encoding). Typed slots with bounded domains (integers, dates) cost less to encode than unconstrained strings, incentivizing appropriate normalization. Implementation-wise, tokenization reduces sequence length by an order of magnitude versus character-level, making browser-based suffix array algorithms tractable. The representation should preserve enough information for exact reconstruction while abstracting incidental variations—treating it as factorizing text into Structure × Content.

## Key Insights

- **Tokenization is a granularity knob**: Character-level finds everything but creates noise; word-level is clean but brittle; punctuation-aware tokens balance both by isolating structural markers (delimiters, tags) from content
- **Pre-typing transforms the discovery problem**: Without normalizing timestamps/IDs in logs, almost no lines match exactly; with normalization, thousands of lines reduce to a handful of templates—a vocabulary collapse that makes patterns discoverable
- **Baker's parameterized matching is the theoretical foundation**: The ability to match "same structure, different atoms" through prev-encoding (replacing variables with positional references) enables discovering templates that would otherwise be invisible
- **Slot typing directly affects MDL costs**: A slot known to contain bounded integers has lower encoding cost than arbitrary strings, so the objective function naturally favors appropriate type inference
- **Token boundaries determine slot boundaries**: Templates should use whole tokens as slots for interpretability; intra-token patterns (like `error123` → `error` + `<NUM>`) require selective token refinement
- **Format drift breaks delimiter-based approaches**: Systems that split on whitespace treat `key=value` and `key = value` as structurally different, failing to unify them—micro-tokenization on character classes solves this
- **Domain dictates strategy**: Logs are morphologically rich (variable names, codes) and need aggressive normalization; legal text has exact phrasal repeats and needs minimal typing; HTML has hierarchical tag structure requiring markup-aware tokens
- **The dual-stream concept separates concerns**: Structural discovery (where is the pattern?) uses normalized tokens for compression; content analysis (what are the slot values?) uses raw text for semantic typing—treating these as separate phases prevents over-generalization

## Recommendations

| Aspect | Recommendation | Rationale |
|--------|---------------|-----------|
| **Primary tokenization** | Punctuation-aware: split on character class boundaries (letter/digit/symbol), preserve whitespace and punctuation as tokens | Balances interpretability with pattern discovery; reduces sequence length vs. character-level while avoiding word-level brittleness |
| **Typing strategy** | Selective pre-typing for high-entropy tokens (timestamps, UUIDs, random IDs); post-typing for semantic labels | Pre-typing essential for logs/structured data to expose patterns; post-typing preserves fidelity for less templated content |
| **Variable handling** | Apply Baker-style prev-encoding or equivalence classes for consistent substitutions | Enables "same structure, different values" matching without requiring exact literals |
| **Slot boundaries** | Align with token boundaries; selectively refine tokens when internal structure is evident (e.g., `server_01` → `server_` + `<NUM>`) | Maintains interpretability; allows intra-token pattern discovery when MDL gain is significant |
| **Implementation** | Start with regex-based token classification (digit sequences, hex strings, etc.) mapped to integer IDs for suffix array input | Keeps core mining algorithms tractable; existing string algorithms work on integer sequences |
| **Domain adaptation** | - **Logs**: Aggressive masking of timestamps/IDs/IPs, line-oriented processing<br>- **Legal/structured text**: Minimal normalization, preserve exact phrasing<br>- **HTML**: Tag-aware tokens, normalize attribute values | Pattern repetition characteristics differ fundamentally across document types |
| **Validation** | Use MDL objective to evaluate representation choices; lower total description length indicates better tokenization/typing | Provides objective measure without requiring labeled data; naturally penalizes both under- and over-generalization |
