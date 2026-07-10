---
name: source-anchoring
description: "Doctrine for output that does not ask to be believed: every element sits on a walkable chain back to a trusted source, or is marked as not. Covers the source, the output's reference back to it, and the chain between, at one hop (an anchor) or many (lineage). Parent of source-anchored-writing (prose), source-anchored-xlsx (workbooks), and source-manifest (packaged data sources); route to those for mechanics, apply directly for anything else (deck, dashboard, generated page, chat analysis, pipeline). Fires on an explicit ask: 'source-anchored', 'zero-trust', 'verifiable', 'auditable', 'show your sources', 'clear lineage', 'no hallucinations', 'survive review', or how to make a deliverable checkable. Not triggered by stakes alone; a plain draft or summary is not a trigger."
---

# Source Anchoring

## Premise

A fluent sentence can easily hide an incorrect fact. Because a fabricated claim often reads just as well as a factual one, readers tend to trust citations without checking them. We want a transparent process to assess claims in writing, especially AI output.

## The relation

Consider three parts: a **source**, an **output**, and a **chain** tying each piece of the output back to a source. The rule: every element is walkable to a source or flagged. The source is the fixed point; the chain is how the output reaches it. Everything below is an aspect of this.

## The chain

One act at two scales.

- **Anchor**, one hop. A claim binds to a span, not a document: page plus quote, a cell range, a cropped snippet. A bare link to a whole report is the weak form; it borrows authority without exposing the claim. Carry the source material itself where you can. An embedded snippet is harder to fake than a reference to one.
- **Lineage**, many hops. Output to derived data to source: a graph whose nodes are committed artifacts and whose edges are committed, re-runnable transforms. An interior node can itself be a packaged source (see source-manifest). A value whose derivation is invisible is a typed number, suspect until checked.

## Flagging

Where the chain has no link, flag it; never blend it in. The subtle case is inference dressed as citation: two sourced facts stitched into a third no source states.

## Referencing back

The output's end of the chain, and the part most often skipped. The output must name its link well enough to follow: a span citation, a page anchor, a content hash, a manifest entry. "See the repo" is not a reference; the addressable span is. For a packaged data source, source-manifest carries the form.

## Verification cost

The verifier is usually a tired human, so minimize the price of a check rather than maximize checking. Floor: any three elements traceable to ground in under thirty seconds. Ceiling: a harness re-checks every claim on every run, and the human only audits the harness. This bounds the apparatus too: generous where claims matter, silent where nothing needs checking. Density that buries the prose is cost without audit.

## Seams

Where the check physically happens, set by how the artifact renders, not its format.

- **Data seam** (live-rendered): the artifact renders from an explicit data object; commit the object apart from the markup.
- **Materialized intermediate** (build-rendered): assemble the object the output will show, commit it, render from exactly that; a step asserts every figure in the output appears in it.
- **Checking harness** (authored): nothing mechanical to extract, so invert. A script asserts every quote and figure appears in the committed sources.

Shared rule: materialize what the claims are checked against as a committed, diffable object. When an artifact resists a seam, change seams, not standards.

## Claim discipline

Figures and dates announce themselves; characterizations, causal links, superlatives, and attributions hide in prose. Use the provenance states from source-anchored-writing (Quoted, Supported, Inferred, Unfiled, Unsupported), and atomic-decomposition to inventory a large document first. The line that matters: Supported is restatement and stays sourced; Inferred is stitching and crosses into residue.

## Routing

Format picks the child; rendering mode and hop count pick the seam.

- Prose: source-anchored-writing.
- Workbook: source-anchored-xlsx.
- Packaged data source or pipeline node: source-manifest.
- Claim inventory of an existing document: atomic-decomposition.
- Anything else: apply the relation directly.

**Manifest**

The documentation required to independently reproduce a derived dataset from its raw sources. While its depth scales with the project, an effective manifest generally captures three core concepts:

* **Transformation logic:** An accounting of how the data was processed, explicitly logging any manual interventions.
* **Verification steps:** Straightforward methods, such as spot-checks or automated reconciliation against source totals, to validate the final numbers.
* **Upstream anomalies:** A recorded history of source errors, dropped data, or manual overrides, rather than silently smoothing them out.

The guiding principle is auditability: resolving messy input data without a paper trail obscures its true lineage.

## Anti-patterns

- **Decorative citation**: a real source on a claim it never made. Worse than none.
- **Document-level anchor**: a 90-page report cited for one sentence.
- **Laundered inference**: a stitched conclusion wearing a parent's citation.
- **Unmaterialized intermediate**: real derivation surviving only woven into the output. Nothing to diff.
- **Hallucinated lineage**: a methodology note for a computation never run.
- **Verification theater**: apparatus that signals rigor while raising the cost of any single check.
- **Silent uncertainty**: a shaky claim hedged into vagueness instead of flagged.

## Tone

Matter-of-fact. Never apologize for a flagged gap; exposing the joint is the point. The artifact reads as confident because it can afford the audit.