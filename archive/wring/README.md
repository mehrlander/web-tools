# Wring

Single-document template induction from internal repetition.

Give Wring **one** document that has repeated structure, such as a log or an HTML
page, and it returns the recurring **templates** (fixed boilerplate with variable
**slots**) plus the values that fill each slot. It is lossless: the templates and
their slot values reconstruct the original document exactly.

**Requirements:** a recent Node and a browser. No dependencies, no install, no build step —
every script runs with `node` directly, and every demo opens straight in a browser.

## What you actually get

**A log file → one template, one slot per field.**

```bash
node general/induce.js general/fixtures/access.log --group align
```

```
in    192.168.1.10 - - [05/Jun/2026:10:00:01 +0000] "GET /api/users/1 HTTP/1.1" 200 1534
      192.168.1.11 - - [05/Jun/2026:10:00:02 +0000] "GET /api/users/2 HTTP/1.1" 200 1622
      … 8 lines …

out   192.168.1.${0} - - [05/Jun/2026:10:00:${1} +0000] "${2} /api/${3}/${4} HTTP/1.1" ${5} ${6}
        ${0} ip   ${1} seconds   ${2} method   ${3} resource   ${4} id   ${5} status   ${6} bytes
```

The boilerplate collapses into one template and the data falls out as labeled
columns. (7 of the 8 lines fit this template. The 8th has a different shape, so
Wring reports it separately instead of forcing a bad fit.)

**Raw HTML → the repeated components.**

```bash
node dom/induce-from-html.js dom/fixtures/sample.html
```

```
out   div.flex.…rounded-full.h-9.w-9.bg-text-${0}00.text-bg-100      ← avatar      slot = 2,3,4,5
      h3#_r_${0}.text-[12px].break-words.text-text-100.line-clamp-4   ← list heading slot = the id
      button.inline-flex.…font-base-bold.rounded-${0}                ← button      slot = md / lg
```

Same idea on DOM structure: each repeated UI component surfaces as a template, its
per-instance differences as slots. On this fixture that is 5 templates covering
18 of 27 signatures, all reconstructing exactly; on the larger 81-signature corpus
in `core/test-group.js` the same engine groups 90-91% (see below).

> The field names (`ip`, `seconds`, `method`…) and the `← avatar` labels above are
> read off by hand to show what the slots *mean*; the tools themselves report bare
> `slot 0..n` with the values observed at each. `…` abbreviates long signatures for
> the page. Run the commands to see the raw output.

**That is the deliverable.** Boilerplate is separated from data, and the split
reverses exactly. Everything below is how it is built and what is still open.

## Status & what exists today

Two paths run end-to-end (text→templates and HTML→templates), and **every stage of
the five-stage pipeline now has a working, tested implementation.** See
[`ARCHITECTURE.md`](ARCHITECTURE.md) for the canonical pipeline.

| | What | Where |
|---|---|---|
| ✅ **Runnable** | **End-to-end general-text induction**: Tokenize, grammar, then group (bookend *or* structural align) | [`general/`](general/README.md) |
| ✅ **Runnable** | **End-to-end DOM induction**: raw HTML to signatures to slotted templates | [`dom/induce-from-html.js`](dom/induce-from-html.js) |
| ✅ **Runnable** | Interactive browser demos, one per use case: a [DOM page](dom/demo.html) (signatures or raw HTML) and a [general-text page](general/demo.html) (logs/records). All demos are indexed in [`demos/`](demos/README.md). | [`dom/demo.html`](dom/demo.html), [`general/demo.html`](general/demo.html) |
| ✅ **Runnable** | `tokenize` and `extractSignatures`: segmenters (Stage 1) | [`general/`](general/README.md), [`dom/`](dom/README.md) |
| ✅ **Runnable** | `induceGrammar`: grammar induction via Re-Pair (Stage 2) | [`general/grammar.js`](general/grammar.js) |
| ✅ **Runnable** | `groupByTemplate` (literal bookends) and `groupByAlignment` (positional): Stage 3 | [`core/`](core/README.md), [`general/`](general/README.md) |
| ✅ **Runnable** | `selectTemplates`: MDL plus exact weighted interval scheduling (Stage 4) | [`selection/`](selection/README.md) |
| 📦 **Handoff** | The engine packaged as a web-tools *kit* plus ported demo pages, ready to copy into [`mehrlander/web-tools`](https://github.com/mehrlander/web-tools) (see the move manifest) | [`export/`](export/README.md) |
| 📝 **Spec only** | Online Sequitur (Re-Pair stands in for Stage 2 today) | `ARCHITECTURE.md` |
| 📚 **Background** | Conceptual foundations, external research reports, and archived prior-architecture specs | [`docs/`](docs/) ([`concepts/`](docs/concepts/), [`research/`](docs/research/README.md), [`history/`](docs/history/README.md)) |

Run the whole test suite (six harnesses, all green):

```bash
npm test
```

That runs all six harnesses in sequence and fails if any does. To run one on its
own, invoke it directly, e.g. `node core/test-group.js`.

**What's still open** (honest frontiers, not loose ends): reconciling records whose
field *count* differs; discovering record boundaries with no delimiter; and putting
the [`selection/`](selection/README.md) MDL layer to work once a generator emits
overlapping candidates. Full findings in [`general/README.md`](general/README.md).

## What it's for

Given one document, infer a compact set of recurring patterns (templates) and a map of
where their instances occur, optimizing for a balance of compression and human
interpretability. The bias is toward interpretability over maximal compression:

 * Structured documents (budget bills, legislation): infer markup structure for annotation or XML conversion
 * Web development: convert repetitive HTML into data-driven JS generation
 * Logs: separate boilerplate from variable content to surface the actual information

The premises and objectives behind this — the primitive model, the design goals, and
the assumptions Wring makes about what "structure" is — live in
[`docs/concepts/Foundations.md`](docs/concepts/Foundations.md). The two non-negotiable
output guarantees, **Character Allocation** and **Reconstruction Fidelity**, are stated
as invariants in [`ARCHITECTURE.md`](ARCHITECTURE.md#key-invariants).

---

## Pipeline

Five stages, and every one has a real implementation today. See
[`ARCHITECTURE.md`](ARCHITECTURE.md) for full detail.

| Stage | Goal | Implemented by |
|-------|------|----------------|
| Tokenize | Segment the document into a symbol stream | `general/tokenize.js`, `dom/extract-signatures.js` |
| Grammar | Find exact repeats; build a grammar | `general/grammar.js` (Re-Pair; ARCHITECTURE names Sequitur) |
| Bookend Merge | Align near-identical sequences; discover slots | `core/group-by-template.js` (literal bookends) · `general/align-group.js` (structural) |
| Selection | Rank by MDL; resolve overlaps | greedy slice in `core/group-by-template.js` · full version in `selection/mdl-select.js` |
| Extraction | Map back to the source; verify reconstruction | reconstruction is verified end-to-end on both paths (lossless) |

### Two working pipelines

- **General text** ([`general/`](general/README.md)): `tokenize` → `induceGrammar`
  (Re-Pair) → group by **bookend** or **structural alignment** → reconstruction check.
  Driver: `general/induce.js`, plus an [interactive demo](general/demo.html). Best on
  records with many independent fields (logs).
- **DOM** ([`dom/`](dom/README.md)): `extractSignatures` →
  `groupByTemplate` (+ greedy MDL selection) → reconstruction check. Driver:
  `induce-from-html.js`, plus an [interactive demo](dom/demo.html). On the
  `sample.html` fixture it groups 18 of 27 signatures; on the larger 81-signature
  corpus exercised by `core/test-group.js` it groups 90-91%, both with 100%
  reconstruction fidelity.

Both front-ends share one Stage-3/4 engine, [`core/group-by-template.js`](core/README.md),
so the generic algorithm lives in `core/` rather than inside either use case.

### Earlier phase specs

The `phase-*/` directories under [`docs/history/`](docs/history/README.md) contain detailed specs (interfaces, algorithms, failure modes) written before the Sequitur + Bookend Merge pivot. Each has a status header indicating what still applies. They remain useful reference material; [`docs/history/README.md`](docs/history/README.md) maps their four-phase numbering against the current five-stage pipeline.

| Directory | Status |
|---|---|
| [`phase-1-discovery/`](docs/history/phase-1-discovery/README.md) | Partially superseded (interfaces and failure modes valid; algorithm replaced by Sequitur) |
| [`phase-2-topology/`](docs/history/phase-2-topology/README.md) | Superseded (replaced by Bookend Merge) |
| [`phase-3-refinement/`](docs/history/phase-3-refinement/README.md) | Partially superseded (alignment and consolidation concepts valid; input interface changed) |
| [`phase-4-selection/`](docs/history/phase-4-selection/README.md) | Current in content (algorithms are path-independent), archived in form (written in the prior-architecture idiom; the live carriers are ARCHITECTURE.md §4 and `selection/mdl-select.js`) |

---

## Concepts

Conceptual foundations and terminology live in [`docs/concepts/`](docs/concepts/):

- **Foundations.md**: The premises, objectives, and primitive model behind Wring (the design rationale)
- **Intuition.md**: First-principles observations about template structure
- **Terms.md**: Vocabulary for matching (seat, bind, register) and emergence (crystallize, induce, distill)
- **Order.md**: Quantifying ordered relationships; distinguishing structural anchors from variable decoys