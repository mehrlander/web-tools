---
name: outlining
description: "Use when asked to outline a document, lay out its structure, or pull its key points; to inventory the claims a text makes, including what it presupposes, before editing or fact-checking it; to read a reply, document or transcript as the questions it answers, for a question margin or to see what a conversation settled and left open; or to judge whether a document is too detailed or too thin. Settles the unit, grain and dimension, then produces entries tied to the source by a walk whose coverage can be checked."
---

# Outlining

## Goal and outputs

Produce an outline of a document to match the intended use. The work runs in two phases: phase one surveys the document and settles the entry criteria, the grain and dimension; phase two produces the outline. Three artifacts result.

- **The profile.** A fast read of the document, an EDA pass: structure and length, where substance sits against noise, a spread of rough outlines thrown together (topic, section, paragraph, concept), and the mechanical seams available for splitting, from markup boundaries down to plain bisection. The basis for choosing how to outline, and where to cut if it fans out.
- **The outline.** A list of entries at the chosen grain, the distillation of the source.
- **The crosswalk.** Each entry's link to the source span it came from, walkable both ways: result to source confirms each line, source to result finds the discards.

An entry is one unit of the outline at the chosen grain: the thing produced, anchored, and checked. It may also carry metadata for audit or scoring, a tag, note, or rating.

Success can be evaluated on four dimensions:

- **Fidelity.** Each entry says what its source says, without drift or invention.
- **Completeness.** Every piece matching the entry criteria is present, nothing dropped.
- **Consistency.** The same calls made the same way throughout, so grain and dimension do not drift down a long document.
- **Validity.** The entry criteria were the right ones: they capture what the intended use wanted, not just what it literally said.

## Key insights

Outlining can target informational content of different kinds and at different resolutions.

- **Dimension.** Structural or semantic. Structural traces what the document is: its headers, its paragraph order, the arrangement on the page. Semantic traces what it means. They may align, ideally, and hierarchy may be seen in either.
- **Grain.** How fine the unit: theme, section, paragraph, sentence, claim, subclaim. We may track at more than one level, flat or hierarchically.
- **Unit.** What an entry is: a passage, a claim (what the source asserts) or a question (what it answers). Claims and questions read one text with the polarity flipped: claims inventory what it commits to, including what it presupposes; questions show what a discussion settled and left open. Two measures build on claims: depth, how far down a tree of reader questions a claim sits, and rung, what kind of point it makes on its genre's ladder. Together they describe a document's level of detail.

## Process

1. **Survey (phase one).** Read before choosing: structure, length, where substance sits and where it thins. Throw together a spread of rough outlines; their density reads signal against noise, their disagreements flag outliers. Deliver the profile and propose the entry criteria, the grain and dimension, for the user to approve or adjust. Scale it: a line for the short or obvious, a fuller plan for the long or open-ended. A measurement fixes the criteria in advance instead and skips the approval, so different readers' results can be compared.
2. **Produce the outline and crosswalk (phase two).** Emit entries at the chosen grain, each carrying the source span it came from; the spans are the crosswalk. Material matching no entry criteria is left out. One pass suits a short source; a long one may fan out, split on the seams the profile found, run separately and merged, across parallel agents or a script loop. The strategy is open, since step three validates either.
3. **Check coverage.** From source and outline, emit the regions that match the criteria but reach no entry: the accidental drops. This check, not the manner of production, is what makes coverage trustworthy.
4. **Check validity.** Emit the discards the intent wanted. Any means the criteria were too narrow: back to phase one.

## Bundled

| File | Read when |
| --- | --- |
| [`claims.md`](claims.md) | the unit is a claim: its types, the existence threshold, grain, the output format |
| [`questions.md`](questions.md) | the unit is a question: grain by paragraph or exchange, the provenance mark, answers that stand alone, the open-loop filter |
| [`tree.md`](tree.md) | measuring depth: building the tree, placing claims, reading depth |
| [`ladders.md`](ladders.md) | placing claims on a genre ladder and reading the profile |
