---
name: source-anchoring
description: "Doctrine for output that does not ask to be believed: every element traces back to a trusted source, or is flagged as not. Parent of source-anchored-writing (prose) and source-anchored-xlsx (workbooks); route to those for mechanics and apply this directly to anything else (deck, dashboard, generated page, chat analysis, pipeline). Fires on an explicit ask: 'source-anchored', 'zero-trust', 'verifiable', 'auditable', 'show your sources', 'clear lineage', 'no hallucinations', 'survive review', or how to make a deliverable checkable. Not triggered by stakes alone; a plain draft or summary is not a trigger."
---

# Source Anchoring

Every element of the output traces to a source, or is flagged as not. For a workbook, load source-anchored-xlsx; for prose, source-anchored-writing.

## The chain

- **Anchor**: cite a span (page and quote, a cell range, a cropped image), not a whole document. Carry the source material itself where you can.
- **Image and numbers**: put the numbers next to an image of the source, laid out the same way. Formatted tables draw from those numbers, creating an inspectable chain of provenance.
- **Lineage**: across several steps, keep each intermediate as a committed file and each step as a re-runnable script. A number with no visible derivation is suspect until checked. A derived dataset records how it was made, how to verify it, and any source errors or manual fixes.

## Flag and reference

- Where a link is missing, flag it. Watch for two sourced facts stitched into a claim neither makes.
- Make each reference followable: a span, page, cell range or content hash. "See the repo" is not a reference.

## Keep checks cheap

Any three elements should trace to their source in under thirty seconds. Where claims matter, a script can re-check all of them on every run. Add no apparatus where nothing needs checking.

## Where the check happens

Commit what claims are checked against as a diffable file:

- Live-rendered: the data file the page renders from.
- Build-rendered: the assembled data the output renders from, with a check that every figure in the output appears in it.
- Authored: a script that checks every quote and figure against the committed sources.

## Claims in prose

Figures announce themselves; characterizations, causes, superlatives and attributions hide. Use source-anchored-writing's provenance states: restatement is Supported; stitching is Inferred, and the note says so. Inventory a long document with atomic-decomposition first.

## Avoid

- A real source cited for a claim it doesn't make.
- A methodology note for a computation never run.
- Apparatus that looks rigorous but makes any single check harder.
- A shaky claim hedged into vagueness instead of flagged.

Never apologize for a flagged gap.
