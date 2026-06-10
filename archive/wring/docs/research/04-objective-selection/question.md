# Research Question 4: Objective + Selection

> **Note**: This research question should be analyzed alongside the main project README.md, which provides the general research plan and context for the Wring project.

## Primary Question

What scoring and selection regime works in practice?

## Research Focus

### MDL-Style Objective

```
gain = savings_from_reuse − (template_cost + slot_encoding_cost + residual_cost)
```

**Open question**: optimal template selection relates to smallest grammar (NP-hard). What approximation strategies from grammar compression literature apply?

### Cost Modeling
- Explicit costs prevent degenerates: mostly-slot templates, tiny frequent literals, single-use templates
- Slot encoding cost depends on type: bounded integer < date < unconstrained string

### Calibration
- How should costs adjust based on document size, average token length, observed entropy?
- Proxy scores: `coverage × literal_length − slot_entropy_penalty` as cheaper approximation

### Selection Algorithms
- **Weighted interval scheduling**: candidate instances as intervals with weight = gain; classic DP for flat model
- **Krimp-style greedy**: order by length × frequency, accept if total code length decreases

### Termination Criteria
- Coverage threshold
- Diminishing returns
- Template count limit

### Partial Matches
- Policy needed when most but not all instances fit a pattern
- Options: exclude outliers to residual, create variant templates, allow fuzzy matching (breaks exact reconstruction)
- State chosen policy explicitly

### Residual Classification
- Residual regions may be noise (truly random) or outliers (near-matches that failed threshold)
- Outlier promotion policy: if a residual is 90% similar to existing template, force-fit as dirty instance or keep separate?
