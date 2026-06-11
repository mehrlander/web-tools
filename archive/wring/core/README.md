# core — Shared Template Engine

The use-case-independent heart of Wring: **Bookend Merge + greedy MDL selection**
(Stages 3-4 of [`ARCHITECTURE.md`](../ARCHITECTURE.md)). It is pure string-in /
string-out, so every front-end calls the same code instead of carrying its own copy.

- The **DOM** front-end ([`../dom/`](../dom/README.md)) feeds it `tag#id.class.class`
  signatures.
- The **general-text** front-end ([`../general/`](../general/README.md)) feeds it
  NUL-joined token records (via `delimiter: '\u0000'`).

Both get back the same shape: `{ groups: [{ template, members: [{ original, slots }], score }], ungrouped }`.

## What it does

`groupByTemplate(strings, options)` discovers shared templates with interpolation slots:

```
Input:   h3#_r_14a_.text-[12px].break-words.line-clamp-4
         h3#_r_14k_.text-[12px].break-words.line-clamp-4
         h3#_r_d1_.text-[12px].break-words.line-clamp-4

Output:  Template: h3#_r_${0}.text-[12px].break-words.line-clamp-4
         Slots:    "14a_", "14k_", "d1_"
```

It is **lossless**: `reconstruct(template, slots, delimiter)` reproduces each grouped
member's original string exactly.

| Phase | What happens |
|-------|-------------|
| 1. Pairwise Bookend Merge | Find shared prefix + suffix of two token sequences; the divergent middle is a slot |
| 2. Broadcast matching | Test each candidate template against all inputs, not just the originating pair |
| 3. MDL scoring | Rank by compression gain: `(groupSize - 1) * literalChars` |
| 4. Greedy assignment | Select highest-scoring templates first; no string in two groups |
| 5. Character refinement | Tighten slot boundaries by absorbing shared character prefixes/suffixes |
| 6. Multi-slot (LCS) | Optionally split one slot into several via Longest Common Subsequence anchors |

## Files

| File | Description |
|------|-------------|
| [`group-by-template.js`](group-by-template.js) | The engine: `groupByTemplate`, `summarize`, `reconstruct` |
| [`test-group.js`](test-group.js) | Test harness: runs the engine on 81 real DOM signatures (generic data) |

```bash
node core/test-group.js
```

## API

```js
import { groupByTemplate, summarize, reconstruct } from '../core/group-by-template.js';

const result = groupByTemplate(strings, {
  maxSlots: 1,          // max interpolation slots per template
  minGroupSize: 2,      // minimum members per group
  strategy: 'compress', // 'compress' (broad groups) or 'specific' (fine-grained)
  refineSlots: true,    // character-level boundary refinement
  delimiter: '.',       // token delimiter ('.' for DOM signatures, '\u0000' for token records)
});
```

> **Note on Stage 3 alternatives.** This engine groups by *literal* shared bookends.
> The general-text path also offers a *structural* Stage 3,
> [`../general/align-group.js`](../general/README.md), which groups by positional
> agreement and is stronger on records with many independent fields (logs).
