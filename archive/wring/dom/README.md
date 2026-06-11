# DOM Template Induction

The **DOM use case** of Wring, end to end: a raw HTML page → the repeated UI
components it contains, each as a template (fixed boilerplate) with interpolation
slots (the per-instance variation).

The name is the use case, not a limitation: this directory is *not* restricted to a
fixed list of signature strings. The Stage-1 segmenter ([`extract-signatures.js`](extract-signatures.js))
turns any HTML document into `tag#id.class.class` **signatures**, and the shared
Stage-3/4 engine ([`../core/group-by-template.js`](../core/group-by-template.js)) groups
them. That engine lives in [`core/`](../core/README.md) because it is generic — pure
string-in / string-out — and the general-text front-end calls the same code.

**[Live Demo](demo.html)**: an interactive browser tool — paste signatures, or paste
raw HTML and run Stage 1 + Stage 3 live.

## What is a DOM Signature?

A dot-separated string encoding an element's tag and CSS classes:

```
div.flex.items-center.gap-2.transition.border-t-0.5.border-transparent
h3#_r_14a_.text-[12px].break-words.text-text-100.line-clamp-4
```

These signatures are extracted from real web UIs. Many share a common structure with small variations, which is exactly the kind of internal repetition Wring is designed to discover.

## How It Works

The `groupByTemplate` function discovers shared templates with interpolation slots:

```
Input:
  h3#_r_14a_.text-[12px].break-words.text-text-100.line-clamp-4
  h3#_r_14k_.text-[12px].break-words.text-text-100.line-clamp-4
  h3#_r_d1_.text-[12px].break-words.text-text-100.line-clamp-4
  ...

Output:
  Template: h3#_r_${0}.text-[12px].break-words.text-text-100.line-clamp-4
  Slot values: "14a_", "14k_", "d1_", ...
```

### The engine is shared — see `core/`

The grouping itself (pairwise bookend merge → broadcast matching → MDL scoring →
greedy assignment → character + multi-slot refinement, plus the `compress`/`specific`
strategies and all configuration options) is the use-case-independent engine. It is
documented once in [`core/README.md`](../core/README.md), because the general-text
front-end calls the very same code. It is **lossless**: `reconstruct(template, slots)`
reproduces every grouped member exactly.

What's specific to this directory is the **DOM segmenter** (above) that produces the
signature strings, and the **results on real DOM data** (below).

## Results on Test Data

81 real DOM signatures from a production web UI (reproduce with `node ../core/test-group.js`):

| Mode | Grouped | Ungrouped | Groups |
|------|---------|-----------|--------|
| Single-slot (`maxSlots=1`) | 73/81 (90%) | 8 | 7 |
| Multi-slot (`maxSlots=2`) | 73/81 (90%) | 8 | 7 |
| Specific strategy (`maxSlots=1`) | 74/81 (91%) | 7 | 19 |

`maxSlots=2` does not increase coverage on this data. Instead it refines *structure* within a
group (the two `button` signatures gain a second slot) rather than capturing more strings.
The `specific` strategy trades broad groups for finer-grained templates: more groups, and
one extra string captured.

Reconstruction fidelity is **100%**: all 146 grouped members across the modes reconstruct
to their original string exactly (`reconstruct(template, slots) === original`).

## End-to-end: raw HTML → templates

The shared [`../core/group-by-template.js`](../core/group-by-template.js) engine operates
on pre-segmented signature strings. The
[`extract-signatures.js`](extract-signatures.js) **segmenter** closes the loop by
turning a raw HTML document into those signatures, so you can hand the pipeline a
real page instead of a hand-collected list. This is the DOM use case running
end-to-end (Stage 1, then Stages 3 to 5) for the first time.

```bash
# Induce templates from an HTML file…
node dom/induce-from-html.js dom/fixtures/sample.html

# …or from any page on stdin:
curl -s https://example.com | node dom/induce-from-html.js
```

```js
import { extractSignatures } from './extract-signatures.js';
import { groupByTemplate, summarize } from '../core/group-by-template.js';

const signatures = extractSignatures(htmlString);   // Stage 1 (DOM segmenter)
const result = groupByTemplate(signatures);          // Stages 3-4
console.log(summarize(result));                       // induced templates + slots
```

The segmenter emits `tag#id.class.class` signatures in document order. It is
dependency-free: in Node it scans start tags with a regex (robust enough for real
markup, no tree build); in the browser, `extractSignaturesFromNodes(root)` walks a
live DOM / `DOMParser` result for exact parsing. `<script>`, `<style>`, and `<head>`
content are skipped, and (by default) elements with neither a class nor an id are
dropped. `--dedupe` collapses identical signatures; `countSignatures` tallies the
most-repeated structures.

The DOM segmenter is *one* concrete Stage-1 implementation. Any function producing
`string[]` can feed Stage 3. The general-text front-end ([`../general/`](../general/README.md))
is exactly that: a different segmenter (Tokenize → grammar) feeding the same shared merge.

## Files

| File | Description |
|------|-------------|
| [`extract-signatures.js`](extract-signatures.js) | DOM segmenter (Stage 1): `extractSignatures`, `extractSignaturesFromNodes`, `countSignatures` |
| [`induce-from-html.js`](induce-from-html.js) | End-to-end CLI: HTML file or stdin to induced templates plus a compression summary |
| [`fixtures/sample.html`](fixtures/sample.html) | Hand-written HTML fixture with genuine component repetition |
| [`test-extract.js`](test-extract.js) | Tests for the segmenter and the end-to-end HTML → templates path |
| [`demo.html`](demo.html) | Interactive browser demo (DaisyUI + Alpine.js). Toggle **Signatures / HTML** to paste raw HTML and run Stage 1 extraction + Stage 3 grouping live. |
| [`../core/group-by-template.js`](../core/group-by-template.js) | Shared Stage-3/4 engine (`groupByTemplate`, `summarize`, `reconstruct`). Lives in `core/`; tested by `../core/test-group.js` on 81 real DOM signatures. |

## Usage

The end-to-end composition for DOM (`extractSignatures` → `groupByTemplate` →
`summarize`) is shown under [raw HTML → templates](#end-to-end-raw-html--templates)
above. The engine's full options (`maxSlots`, `minGroupSize`, `strategy`,
`refineSlots`, `delimiter`) and its `reconstruct` round-trip are documented once in
[`core/README.md` § API](../core/README.md#api), since they are not DOM-specific.

### CLI tests

```bash
node core/test-group.js    # Stage 3 engine on 81 real signatures (lives in core/)
node dom/test-extract.js   # DOM segmenter + end-to-end HTML path
```

## Relation to Wring Pipeline

The canonical five-stage pipeline is defined in [`ARCHITECTURE.md`](../ARCHITECTURE.md).
The DOM path maps onto it as:

- **Stage 1 · Tokenize** → `extract-signatures.js` (the DOM segmenter)
- **Stage 2 · Grammar** → *skipped*. A DOM signature is already an atomic unit, so there
  are no sub-token repeats for a grammar to find; the segmenter feeds Bookend Merge directly.
- **Stages 3-4 · Bookend Merge + Selection** → the shared [`../core/`](../core/README.md) engine
- **Stage 5 · Extraction** → `reconstruct` plus the fidelity checks

The general-text path ([`../general/`](../general/README.md)) differs only at the front:
it inserts Tokenize → Grammar ahead of Stage 3.
