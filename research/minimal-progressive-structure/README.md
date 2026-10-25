# Minimal progressive structure

**Question.** Is there a describable procedure behind the pages we keep
building by hand, one that takes content arriving as text, finds its entities,
lists and relations, and lays them out in layers so the page discloses
progressively? And does handing that procedure to an agent produce a better
page on the first try?

Started 2026-10-25 from the owner's prompt, which named the idea *minimal
progressive structure* (MPS) and suggested the analogy to database normal
forms.

## What is here

| File | Holds |
|---|---|
| [theory.md](theory.md) | the theory: a page as a rooted projection of an entity graph, the structural forms, the projection ladder, and what the theory predicts |
| [method.md](method.md) | the procedure, as handed to the test agents |
| [experiment/](experiment/) | sources, prompts, pages, judgments and the scripts that produced them |

## Experiment design

**Sources.** Three real texts of different shapes, each kept with its
attribution in [experiment/sources/](experiment/sources/):

| Id | Text | Words | Shape |
|---|---|---|---|
| wacares | Washington State Standard, 2025-10-31: the WA Cares investment amendment (SJR 8201) | 757 | one subject with references: a measure, its fund, its backers and opponents, an earlier attempt |
| races | Washington State Standard, 2026-05-08: legislative races to watch | 1,534 | a collection of peers: districts, each with candidates |
| dca | NTSB preliminary report DCA25MA108, the 2025 midair collision at Reagan National | 5,824 | a long technical record: two aircraft, a timeline, parties, findings |

**Conditions.** Every builder got the same frame
([conditions/common.md](experiment/conditions/common.md)): one self-contained
HTML page, Tailwind and daisyUI from a CDN, Alpine.js if needed, the source's
facts only. The arms differ by one added paragraph:

| Arm | Added guidance |
|---|---|
| bare | none |
| house | the html-style skill |
| mps | [method.md](method.md), with its model written to a file before the page |
| house-mps | both |

Builders wrote files through Bash rather than the Write tool, so the plugin's
reading-column guard, which fires on Write and Edit, could not coach the bare
arm. WA Cares ran three bare and three mps replicates to measure convergence;
every other cell ran once. Sixteen pages in all, every builder on the same
model.

**Judging.** Pages were copied under random codes before any judge saw them
([tools/blind.py](experiment/tools/blind.py)); the key stayed out of the
judges' reach. Three kinds of judge, none given the method or its vocabulary:

- **Locator:** for ten reader questions per source, written beforehand by an
  agent that never saw a page ([questions.json](experiment/judgments/questions.json)),
  where on each page the answer sits: first screen, scroll, one step, two or
  more steps, absent, or wrong.
- **Designer:** two independent information-design judges per source rank the
  pages and score five criteria (first screen, findability, fit, economy,
  fidelity).
- **Structure:** for WA Cares, a canonical list of named things and each
  page's treatment of each (own view, row, label, absent), to measure how far
  independent builders agree.

[tools/shoot.js](experiment/tools/shoot.js) takes the screenshots and the
mechanical measures (visible words, words on the first screen, controls,
stat-card classes, overflow).

## Findings

Pending the judges.
