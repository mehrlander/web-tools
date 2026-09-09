---
name: reduction-panel
description: "Run a fan-out reduction panel over a document: one cheap reader per section proposing telegraphic and tightened versions plus a cut list, one stronger judge over the whole file and every pass, then a restore round guarded against the author's own defensiveness. Use when a document should get shorter and the author has already trimmed it, or when the user asks for condensed versions passage by passage."
---

# Reduction Panel

The model that wrote a document defends its material as useful context, and so
does the model that just trimmed it. Cheap readers with no stake propose the
cuts; a stronger judge catches what a per-section pass cannot see. Measured
run: home `chron/2026/09/2026-09-08-reduction-panel-on-a-doc-i-just-trimmed.md`
(1,484 words to 968 on a doc trimmed an hour earlier; 21 of 32 cuts stood).

## Protocol

1. **Section readers.** One Haiku subagent per section, each returning a
   telegraphic version, a tightened version, and a cut list naming anything
   that does not change what a reader would do. Two prompt clauses do the
   work: exact technical specifics survive verbatim, and the release: you are
   not asked to preserve every claim, you are asked to find shorter ways to do
   the job, including carrying a point implicitly. Without the release, cheap
   readers return synonyms.
2. **The judge.** One Sonnet subagent over the whole file plus every section
   pass: which cuts are good, which are wrong and what each loss is, what a
   per-section pass could not see, and its own reduction. Expect the strongest
   cut, usually structural, from the judge.
3. **Restore round.** Apply the surviving cuts. Every restoration must name a
   behavior that changes without the material; "useful context" is disallowed
   as a reason. Report the restore rate: near 100% is a result about the
   author, not the file.

Deliver the reduced document plus the restore report: every cut, kept or
restored, with the named behavior.

The panel replaces the grind, not the author's read of the result: the one
defect all three models missed in the measured run was found by a human
reading a single heading.
