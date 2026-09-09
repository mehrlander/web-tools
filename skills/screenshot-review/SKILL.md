---
name: screenshot-review
description: "Review a rendered screenshot before handing it over or drawing a conclusion from it, using a self-read against a failure checklist and a fresh-eyes reader (a context-free Haiku subagent) run blind first, then informed. Use when a headless screenshot is about to be sent into chat, when a shot is the evidence that a change worked, or when the user asks what a human would notice in an image."
---

# Screenshot Review

A headless screenshot that fails rarely errors; it renders something plausible
and wrong (the recorded classes: web-tools `docs/SNAGS.md`). The session that
produced the shot is its worst-placed reader: it sees what the image is
supposed to show. Put fresh readers in front of the image before the user is.

## Protocol

1. **Self-read** the image against the checklist below.
2. **Blind reader**: a Haiku subagent given only the image path: describe the
   page as a first-time viewer, then flag anything a person would notice. No
   other context, and blind runs first: an informed reader stops seeing.
3. **Informed reader**: the same reader, now told the one-sentence intent: is
   the change visible, and does anything contradict it? "Visible" must name
   pixels, not restate the intent.
4. **Reconcile**: every divergence between a reader and the expectation is a
   finding. If the informed reader cannot see the change, the shot is evidence
   of nothing; re-render before arguing with the reader.

Report all four results before the image travels or is cited as evidence, and
fix or explain each discrepancy. Mechanical signals (the shot log's
did-not-load warnings, `scrollWidth`, exit codes) answer questions no image
can; the readers do not replace them.

## Checklist

Extend it in SNAGS first, here second.

- Flat prose: default serif or unstyled weights where the page uses a design
  system.
- Unchanged pixels: if you cannot point at a pixel the change moved, the shot
  proves nothing.
- Empty or vacuous regions; placeholder data where real data was wired.
- Overflow: the frame hides horizontal scroll; pair with a `scrollWidth`
  measurement.
- Wrong build: for a page importing a pre-build, rebuild before the shot
  proves anything.
- Theme mismatch; tofu boxes or icon-ligature text.

## Optional readers

One subagent each; a reader given two jobs lets one prime the other.

- **Style**: assess against the house rules by file path (web-tools:
  `skills/daisy-alpine/SKILL.md`), never from memory, with rule-by-rule
  verdicts naming regions. Checklist first: a style verdict on a broken render
  grades the failure as a design choice.
- **Comprehension**: two questions, no checklist, no stated intent: how do you
  interpret this page's premise, and what does it convey informationally? A
  premise the reader gets wrong is a design finding, not a reader error.

## Fan-out

For a family of surfaces (an app's tabs), shoot each and run one blind reader
per shot, in parallel. Convergence is the signal: a defect independent readers
hit unprompted outranks any single reader's list. Verify a finding against the
pixels, and the source where it implicates code, before it travels.
