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
| [review.html](review.html#walkthrough=wacares&test=wacares) | the sixteen examples, each with Prompt and Result tabs and its original referenced inputs |
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
([tools/blind.py](experiment/tools/blind.py)), with code comments stripped,
since some builders' comments named their model file; the key
([blind-key.json](experiment/judgments/blind-key.json)) was committed only
after the last judge reported. Three kinds of judge, none given the method or its vocabulary:

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

Handing builders the method raised the blind judges' scores on one source of
three, tied on the other two, and lowered none. Added to the house style, it
raised scores on all three. Builders converged on a structure with or without
the method; the method changed what they converged on. The full tables are in
[results.md](experiment/results.md), generated from the judgments by
[tools/analyze.py](experiment/tools/analyze.py).

### Designer scores

Mean of two blind judges' scores out of 10; WA Cares cells for bare and mps
average three replicates.

| Source | bare | house | mps | house-mps |
|---|---|---|---|---|
| wacares | 5.7 | 5.5 | **7.8** | 7.0 |
| races | 7.0 | 5.5 | 7.0 | **7.5** |
| dca | **8.0** | 6.0 | **8.0** | 6.5 |
| mean of the three | 6.9 | 5.7 | **7.6** | 7.0 |

The two judges ranked the pages alike on WA Cares (Spearman 0.86) and on the
NTSB report (0.80), and less alike on the races (0.40), where they split over
the mps page.

### What separated the arms

1. **On the short single-subject article, the method won outright.** Both
   judges ranked all four method pages (mps and house-mps) above all four
   others. Every bare replicate reused the article's headline and its
   explainer sections; the structure judge, who knew nothing of the arms,
   described each bare page's subject as "the news story", and each mps page's
   as the measure itself. The judges' complaint about the bare pages was
   repetition: "generic stacks of sections that repeat facts". That is the
   duplication the third structural form removes.
2. **On the collection and the long report, the method tied.** The races
   mps page reduced each race to a row reading "4 candidates" behind a toggle,
   which one judge ranked first for its framing and fidelity and the other
   third for hiding the comparison. The NTSB bare page ran to 4,466 words and
   14,800 pixels with an altitude chart and a radio diagram; one judge ranked
   it first, the other second, both naming its length and repetition as the
   cost.
3. **Adding the method to the house style helped every time**: +1.5 on WA
   Cares, +2.0 on races, +0.5 on the NTSB report.
4. **The house style alone scored lowest on all three sources.** Its pages
   followed the rules (compact header figures, tabs, side-by-side columns) and
   left out a plain sentence saying what the subject is: the WA Cares house
   page never states what the measure does, the races house page labels seats
   by surname, and the NTSB house page's first screen names the aircraft only
   by code. Whether
   rule 2 ("No explanatory prose") led the builders to drop that sentence is an
   inference, not something the test isolates.
5. **No page lost a fact.** The locator judge found every answer on every page.
   The arms differed in where answers sat: bare pages kept them on one long
   scroll; house pages moved them behind tabs; method pages put more on the
   first screen for WA Cares (3.7 of 10, against 1.3 for bare) and fewer for
   the other two.
6. **The method pages kept attribution.** Two of three bare WA Cares pages and
   the house page stated a campaign spokeswoman's claim as fact; no method
   page did. Form 2 attaches a claim to its speaker, though the tested text did
   not say so outright; the revision now does.

### The predictions, checked

1. **Convergence decreases down the ladder: partly wrong.** Replicates agreed
   on 87 percent of treatments without the method and 89 percent with it. Both
   arms agreed completely on their roots, but on different roots: the article
   without the method, the measure with it. The divergence sat in earned views
   (Jaccard 0.44 among mps replicates, 0.60 among bare ones), which the
   prediction placed with the entities as the part builders would agree on.
   Label contents were not measured. The owner's "seventeen experts" holds, in
   that independent builders converge; what they converge on is a genre unless
   something gives them a root.
2. **Guidance changes the organizing principle: supported on WA Cares only.**
   The root changed there, lookups moved toward the first screen, and the
   repetition went. On the other two sources the bare builders already
   organized by entity (races by district, the NTSB report by aircraft and
   time), and the method added little.
3. **The failure modes are predictable: both appeared.** Repetition without
   the method (WA Cares, the NTSB bare page); over-disclosure with it (the
   races mps page hiding its candidates).

### What the test changed in the method

Five revisions, now in [method.md](method.md); the tested text is
[method-as-tested.md](experiment/conditions/method-as-tested.md).

| Revision | Prompted by |
|---|---|
| One name per thing: settle on one name where the text uses several | wacares-mps3 found the article naming one account four ways |
| A claim belongs to whoever makes it | bare and house pages stating a spokeswoman's claim as fact |
| A thing earns a view when its facts exceed what its label carries, or the reader reaches it from two places | the mps replicates splitting on SEIU 775 and the 2020 measure; one noted it "passes the threshold formally" while its facts "fit in its label" |
| A collection root shows its rows with their distinguishing fields | the races mps page's "4 candidates" behind a toggle |
| A label a newcomer cannot place (a surname alone, a party letter) fails the scent check | the races house page |

### Limits

- **Small cells.** Races and the NTSB report ran one page per arm, so a single
  builder's choices stand for the arm.
- **Judges share the builders' model family.** A shared taste could favor the
  method without a human reader agreeing. The owner's own read is the check
  this test lacks.
- **The rubric's reader is a newcomer.** The house style was written for the
  owner's working surfaces, whose reader knows the domain; a rubric built for
  that reader could rank the house arm differently.
- **Harness defect.** The full-page screenshot of a page taller than 9,000
  pixels came out as its first screen; the judges noticed and took their own.
  [shoot.js](experiment/tools/shoot.js) is fixed.
- **The source has an inconsistency.** The races article gives the Senate split
  as 30-19 and later 29-20; judges credited pages that flagged it.

## Source chats

Earlier conversations this work draws on (they resolve only when logged in):

- [Structural formats for conveying information](https://claude.ai/chat/f473a851-f8ce-4237-8b71-15afadc400f5),
  July 2026: multiplexing, progressive disclosure and Shneiderman's mantra,
  the vocabulary behind the shape-text skill.
- [Deep research typography](https://chatgpt.com/c/6a497842-c824-83e8-8841-3468cdb7449e),
  July 2026: matching each kind of content to the lowest-complexity structural
  form.
- [Washington State API research](https://chatgpt.com/c/69417bb1-7c3c-832f-9673-d1d5dae5dab8),
  December 2025: the legislature's entities (Legislation, Sponsor, Committee,
  RollCall) and their relations.
