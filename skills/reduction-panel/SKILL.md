---
name: reduction-panel
description: "Run a fan-out reduction panel over a document: one cheap reader per section proposing telegraphic and tightened versions plus a cut list, one stronger judge over the whole file and every pass, then a restore round guarded against the author's own defensiveness. Use when a document should get shorter and the author has already trimmed it, when the user asks for condensed versions passage by passage, or says reduction panel."
---

# Reduction Panel

## The premise

The model that wrote a document is poor at shortening it, and so is the model
that just trimmed it: both defend material by calling it useful context. Cheap
readers with no stake propose cuts the author would not reach, and a stronger
judge over all of them catches what a per-section pass cannot see. Measured
run: home `chron/2026/09/2026-09-08-reduction-panel-on-a-doc-i-just-trimmed.md`
(1,484 words to 968 on a doc trimmed an hour earlier; 21 of 32 proposed cuts
stood).

## Goal and output

The reduced document, plus a restore report: every proposed cut, kept or
restored, and for each restoration the behavior that would change without the
material. The restore rate is reported; a rate near 100% is a result about the
author, not the file.

## The process

1. **Section passes.** One Haiku subagent per section. Each returns three
   things: a telegraphic version, a tightened version, and a cut list naming
   anything that does not change what a reader would do. Two prompt clauses do
   the work: exact technical specifics survive verbatim, and the release: you
   are not asked to preserve every claim, you are asked to find shorter ways to
   do the job, including ways that carry a point implicitly.
2. **The judge.** One Sonnet subagent over the whole file plus all section
   passes, asked four things: which cuts are good, which are wrong and what
   each loss is, what a per-section pass could not see, and its own reduction.
3. **Restore round.** Apply the surviving cuts. For every restoration, name a
   behavior that changes without the material; "useful context" is disallowed
   as a reason. Report the restore rate.

## Key insights

- **The release clause is the panel.** Without permission to carry a point
  implicitly, cheap readers return synonyms, not reductions.
- **The best finds are structural.** In the measured run the strongest cut was
  a section-shape change no sentence-level pass proposed; expect the judge, not
  the section readers, to supply it.
- **The panel does not see everything.** The one defect all three models missed
  was found by a human reading a single heading. The panel replaces the grind,
  not the author's read of the result.

## Extending

The same shape scores other per-passage judgments (a clarity panel, a claims
panel) by swapping what the section readers are asked for; the judge and the
restore guard carry over unchanged.
