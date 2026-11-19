# Statistical quality control: Shewhart, Deming and the people around them

An exploration for the [Discovery](../../programs/discovery/README.md) program:
the people who made quality control a statistical discipline, what each
contributed, and what their ideas offer the AI processes that run across the
owner's repositories (the estate). The owner asked for this line of knowledge
here rather than in Testing, with its people treated as possible personas. It
was gathered on 2026-11-19 from the sources at the end. None of its ideas has
yet been tried on our data; the closing section proposes three probes that
would.

## Why this lineage

The estate's goal **Mechanical** reads "A process can be improved if it is
reproducible and interpretable" ([`docs/aims-goals.csv`](../../docs/aims-goals.csv)).
Shewhart's 1931 definition of control states the reproducible half: "A
phenomenon will be said to be controlled when, through the use of past
experience, we can predict, at least within limits, how the phenomenon may be
expected to vary in the future." The lineage holds that a process is improved
by changing the process once its variation is predictable, not by reacting to
each bad output.

The live case is a preference flagger. A Gemini step in the session-topics
daemon marks the owner's standing preferences in session transcripts
([web-tools-private#192](https://github.com/mehrlander/web-tools-private/pull/192));
its preview flagged 158 sentences. A gold set of 837 hand-labeled sentences
from home's
[prompt-sentiment run](https://github.com/mehrlander/home/blob/main/projects/text/runs/2026-11-06-prompt-sentiment/README.md)
scores it through `flag_score.py` ([home#976](https://github.com/mehrlander/home/pull/976)).
The [inspection form](../../pages/inspection.html) takes the owner's verdict on
each flag against its source sentence: Right, Wrong, or Flip for the opposite
stance. An assessment step, a model weighing each candidate in context, is
being trialed.

## The people

### Walter A. Shewhart (1891–1967)

A physicist at Western Electric and, from 1925, Bell Telephone Laboratories.
His memo of 16 May 1924 held the first control chart, and *Economic Control of
Quality of Manufactured Product* (1931) gave the theory. He separated **chance
causes** of variation, many and small and part of the process, from
**assignable causes**, which can be found and removed; Deming later called them
common and special causes. A control chart plots a measure over time against
limits computed from the process's own past, conventionally three standard
deviations. A point outside signals an assignable cause; a point inside is not
evidence of one. His 1939 lectures, edited by Deming, framed quality control as
a cycle of specification, production and inspection.

**In the estate.** A p-chart of weekly flag precision would plot the share of
inspected flags marked Right, with limits at p ± 3√(p(1−p)/n). At 20 verdicts a
week and a precision of 0.8, the limits run from about 0.53 to 1, and only a
large drop would signal. At our volumes the chart mainly keeps us from acting
on small movements. A signal would come with a candidate cause recorded: each
run is stamped with `flags_sha`, a hash of the flags instructions.

### Harold F. Dodge (1893–1976) and Harry G. Romig

Shewhart's colleagues at Bell Laboratories, who published "A method of sampling
inspection" in 1929 and the sampling tables named for them. Their
**acceptance sampling** accepts a lot when a sample of n items holds no more
than c defectives, and otherwise inspects it in full.

**In the estate.** A daemon run is a lot: the owner could judge 20 of its flags
and accept the run when no more than c are Wrong. **First-article inspection**,
codified for aerospace in AS9102, is the complement: when a process changes,
inspect its first output in full. The 25-session preview the flagger's PR waits
on is one, and a new `flags_sha` marks when the next is due.

### W. Edwards Deming (1900–1993)

A statistician who taught statistical quality control in Japan from 1950.
*Out of the Crisis* (1986) estimates that about 94 percent of troubles belong to
the system, which management owns. One of its fourteen points is "cease
dependence on inspection to achieve quality." Its funnel experiment shows
**tampering**: adjusting a stable process after each result makes the output
vary more. Its **all-or-none rule** says a stable process is cheapest to
inspect fully or not at all, depending on whether the fraction defective
exceeds the cost of one inspection divided by the cost of one defect that gets
through.

*The New Economics* (1993) sets out the **System of Profound Knowledge**:
appreciation for a system, knowledge about variation, theory of knowledge, and
psychology. In his last years Deming called Shewhart's cycle plan, do, study,
act, and objected to "check".

**In the estate.** Here the worker is the model. Deming's estimate suggests
most Wrong flags will trace to the system: the definition of a standing
preference, the input (48 percent of the gold set's likes are hedged), and
`flag_score.py`'s rule for matching a flag to a gold sentence. Rewording the
prompt after each Wrong flag would be tampering. The narrow standard
([home#936](https://github.com/mehrlander/home/pull/936)), which counts only
standing preferences, was a system change: it cut the share of sentences
counted from 43 to 9 percent. In the cycle, the flagger's PR is plan and do and
home#976's score is study, which needs the plan to have predicted a precision.

The all-or-none rule sorts downstream uses by the cost of a Wrong flag. In a
topics summary the cost is small, and the rule points to inspecting none and
watching the gold-set score. In a house rule the cost is large, and the rule
points to inspecting every flag.

### Joseph M. Juran (1904–2008)

Author of the *Quality Control Handbook* (1951), who lectured in Japan from
1954. He named the **Pareto principle** for quality, "the vital few and the
trivial many", later preferring "the useful many". His **trilogy** (1986)
divides quality management into planning, control and improvement.

**In the estate.** A Pareto chart of verdict reasons would code the owner's
notes on Wrong and Flip verdicts and sort the reasons by count. The narrow
standard gives one for the sentences it dropped: requests for a change in the
case at hand 43 percent, corrections 16, approvals 11. The trilogy matches a
program's parts: the charter plans, measures control, probes improve.

### Kaoru Ishikawa (1915–1989)

A University of Tokyo professor who drew the **cause-and-effect diagram** in the
1940s and popularized it in the 1960s, started quality-control circles in 1962,
and promoted the seven basic tools of quality, the Pareto and control charts
among them.

**In the estate.** A cause-and-effect diagram for a Wrong flag would have
branches for method (the flags instructions in
[`turn_prompt.md`](https://github.com/mehrlander/web-tools-private/blob/main/sessions/tools/turn_prompt.md)),
material (the transcript, with its dictation and pasted text), machine (the
Gemini model and the laptop worker), measurement (the gold labels, the narrow
standard, the matching rule) and people (the owner as speaker and as inspector). The
measurement branch is the easiest to skip: a rise in Wrong verdicts can come
from a change in the gold labels or the matching rule rather than the flagger.

### Genichi Taguchi (1924–2012)

An engineer awarded the Deming Prize in 1960. His **quality loss function**,
L(y) = k(y − T)², charges a cost for any distance from the target, inside the
specification limits as well as outside. His **robust design** chooses the
settings an engineer controls so that performance varies least across noise
factors the engineer cannot control.

**In the estate.** The loss function fits loosely, since a flag is right or
wrong. Robust design fits better, because the noise factors are known: hedged
sentences, run-on dictation, long sessions. A trial would cross prompt variants
with gold sentences stratified by those factors, and pick the variant whose
precision varies least across them, not the one with the best average.

### Shigeo Shingo (1909–1990)

A consultant engineer who worked with Toyota on its production system.
*Zero Quality Control: Source Inspection and the Poka-yoke System* (in English,
1986) distinguishes **judgment inspection**, which sorts good from bad after the
fact; **informative inspection**, whose results return to the process, as in
successive checks; and **source inspection**, which checks the conditions
before a step runs. A **poka-yoke** is a device that prevents a mistake or
makes it obvious.

**In the estate.** The flagger's quote check is a poka-yoke: a flag whose
quotation is not in the owner's message is dropped. The inspection form is
judgment inspection until its verdicts change the flagger's instructions. The
assessment step is a successive check, the next process inspecting the previous
one's output.

### Noriaki Kano (born 1940)

With Seraku, Takahashi and Tsuji, Kano published "Attractive quality and
must-be quality" in 1984. A **must-be** quality dissatisfies when absent and
goes unnoticed when present; a **one-dimensional**, or performance, quality
satisfies in proportion to its amount; an **attractive** quality pleases when
present and is not missed when absent. Indifferent and reverse qualities
complete the set.

**In the estate.** For the flagger, a verbatim quote is must-be, precision and
recall are performance, and naming the peeve a flag matches would be
attractive. For the owner's preferences, the definitions imply that a must-be
quality surfaces as a complaint, since only its absence is noticed, and an
attractive one as an approval. If so, the [peeves](../../skills/peeves/SKILL.md)
list, mined from corrections, is mostly a list of must-be qualities.

### Michael Fagan (IBM, 1970s)

"Design and code inspections to reduce errors in program development" (*IBM
Systems Journal* 15(3), 1976) made inspection a formal process of overview,
preparation, an inspection meeting, rework and follow-up, run by a moderator
with inspectors drawn from design, coding and testing. Errors found are
classified and counted, and the counts are used to improve the process that
made them. Fagan's life dates were not found.

**In the estate.** The inspection form is a one-inspector Fagan inspection
without the classification: a Wrong verdict's reason lives only in a free
note. A declared list of reasons would feed Juran's Pareto chart. Audit
vocabulary names the form's direction. **Vouching** goes from a record back to
its source, from a flag to the owner's sentence, and estimates precision.
**Tracing** goes from the source to the record, from an owner's sentence to a
flag or its absence, and estimates recall. The form vouches; the gold set
traces, as would web-tools#1354's open thread on marking a missed preference.

## Personas

[`programs/organization/chiefs.html`](../../programs/organization/chiefs.html)
proposes a chief for each program: the program's manager agent, given a name
and a face. Its current picks are Drucker for Organization, Popper for Testing
and Darwin for Discovery. Deming is a candidate for Organization, and Grace
Hopper for Testing.

| Seat | Figure | What it would bring | Where it fits less well |
| --- | --- | --- | --- |
| Organization | Deming | asks whether a fault belongs to the system before blaming a part; reads each measure as a series | the seat keeps the chart of the programs, a narrower job than his doctrine |
| Testing | Shewhart | watches a process over time, where Popper's test and Grace's bug are single events; Testing's planned timing log is a series a control chart could read | the suite is pass or fail per commit, with nothing to chart |
| Discovery | Shewhart or Taguchi | the cycle as scientific method; designed experiments for probes | weaker than Darwin on gathering from outside sources |

A figure from this lineage could also be a reviewer rather than a chief, asking
of any change prompted by a bad output whether that output was a special cause
or ordinary variation.

## Probe candidates

1. **Is the flag rate in control?** Chart the weekly share of owner sentences
   labeled standing preferences. Haiku's narrow labels on a seeded tenth of the
   corpus
   ([`narrow.jsonl`](https://github.com/mehrlander/home/blob/main/projects/text/runs/2026-11-06-prompt-sentiment/results/haiku/narrow.jsonl))
   allow a start now, until the flagger's output replaces them. Read each week
   outside the limits for a nameable cause. The prediction is that most such
   weeks were spent writing rules. If so, the chart tracks the owner's subject
   matter as much as the flagger, and needs stratifying by session topic before
   it can catch a flagger fault.
2. **Does Kano's asymmetry hold for the owner's preferences?** Pair the like and
   dislike clusters in the run's
   [`recurring-preferences.csv`](https://github.com/mehrlander/home/blob/main/projects/text/runs/2026-11-06-prompt-sentiment/results/recurring-preferences.csv)
   that state the same quality, and count sessions on each side. The asymmetry
   implies two groups, voiced almost only as dislikes (must-be) or almost only
   as likes (attractive), with the clusters the peeves fully cover in the
   first. A spread with no gap would
   say the categories describe this owner poorly.
3. **Would sampling have reached the same decision?** Once the owner has judged
   the preview's 158 flags, take the full Wrong rate as the truth, draw many
   samples of 20 with an acceptance number set in advance, and count how often a
   sample's decision matches the full judgment. The `at` stamps in the
   inspection form's answers file give the seconds per verdict, the inspection
   cost in the all-or-none rule.

## Sources

Read secondhand through the pages below unless a primary text is named.

- Shewhart: [Wikipedia](https://en.wikipedia.org/wiki/Walter_A._Shewhart);
  Best and Neuhauser, [*Quality and Safety in Health Care*](https://pmc.ncbi.nlm.nih.gov/articles/PMC2464836),
  on the 1924 memo; the 1931 definition of control as quoted by
  [Keller and Pyzdek](https://qualityamerica.com/LSS-Knowledge-Center/statisticalprocesscontrol/common_and_special_causes_of_variation.php);
  *Statistical Method from the Viewpoint of Quality Control* (1939),
  [full text at AgEcon Search](https://ageconsearch.umn.edu/record/327285).
- Dodge and Romig: [ASQ](https://asq.org/about-asq/honorary-members/dodge);
  "A method of sampling inspection", [*Bell System Technical Journal* 8, 1929](https://www.nokia.com/bell-labs/publications-and-media/publications/a-method-of-sampling-inspection).
- First-article inspection: [Wikipedia](https://en.wikipedia.org/wiki/First_article_inspection).
- Deming: [Deming Institute timeline](https://deming.org/timeline/) and
  [fourteen points](https://deming.org/explore/fourteen-points/);
  Moen and Norman, ["Circling back"](https://qi.elft.nhs.uk/wp-content/uploads/2026/02/ron-cliff-circling-back.pdf),
  *Quality Progress*, 2010, on the cycle;
  [the funnel experiment](https://sites.ualberta.ca/~yreshef/orga432/funnel.html);
  [the 94 percent estimate](https://digestibledeming.substack.com/p/deming-devotional-5-troubles-and);
  Papadakis, [on the all-or-none rule](https://doi.org/10.1080/00224065.1985.11978950),
  *Journal of Quality Technology*, 1985;
  [the System of Profound Knowledge](https://quality.org/knowledge/applying-deming-system-profound-knowledge).
- Juran: [Wikipedia](https://en.wikipedia.org/wiki/Joseph_M._Juran);
  [Juran Institute, on the trilogy](https://www.juran.com/?p=4637).
- Ishikawa: [ASQ](https://asq.org/about-asq/honorary-members/ishikawa);
  [Wikipedia](https://en.wikipedia.org/wiki/Kaoru_Ishikawa).
- Taguchi: [obituary, Lean Blog](https://leanblog.org/2012/06/dr-genichi-taguchi-january-1-1924-june-2-2012);
  [Taguchi methods, Wikipedia](https://en.wikipedia.org/wiki/Taguchi_methods).
- Shingo: [mistakeproofing.com](https://mistakeproofing.com/a-brief-tutorial-on-mistake-proofing-poka-yoke-and-zqc/);
  [*Zero Quality Control*, Routledge](https://www.routledge.com/Zero-Quality-Control-Source-Inspection-and-the-Poka-yoke-System/Shingo/p/book/9780915299072).
- Kano: the 1984 paper's [J-STAGE record](https://www.jstage.jst.go.jp/article/quality/14/2/14_KJ00002952366/_article/-char/en);
  [Kano model, Wikipedia](https://en.wikipedia.org/wiki/Kano_model).
- Fagan: the 1976 paper's [abstract](https://www.ifsq.org/work-fagan-1976.html)
  and [IEEE record](https://ieeexplore.ieee.org/document/5388086);
  [Fagan inspection, Wikipedia](https://en.wikipedia.org/wiki/Fagan_inspection).
