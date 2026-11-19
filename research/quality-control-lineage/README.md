# Statistical quality control: two proposed probes of the preference flagger

The owner asked that the [Discovery](../../programs/discovery/README.md) program's probes reflect the line of knowledge from Walter Shewhart and W. Edwards Deming. The ask included its people and their reasoning. This account proposes two probes of one AI process, with the lineage behind them. None of these ideas has yet been tried on our data.

## The case

The **session-topics daemon** ([`gemini_followup.py`](https://github.com/mehrlander/web-tools-private/blob/main/sessions/tools/gemini_followup.py)), on the owner's laptop, summarizes each recorded Claude Code session, with Gemini as its model.

The daemon's **flagger** ([web-tools-private#192](https://github.com/mehrlander/web-tools-private/pull/192), which adds it) marks the owner's sentences that state a standing preference: a view of how things should be beyond the case at hand. A quote check drops any flag whose quotation is not in the owner's message. A preview over 25 sessions flagged 158 sentences.

The **gold set** is 837 of the owner's sentences from home's prompt-sentiment run, labeled by blind model readers and reviewed by model skeptics ([the run's gold labels](https://github.com/mehrlander/home/blob/main/projects/text/runs/2026-11-06-prompt-sentiment/README.md#the-gold-labels)). [`flag_score.py`](https://github.com/mehrlander/home/blob/claude/admiring-ride-kd04wp/projects/text/runs/2026-11-06-prompt-sentiment/src/flag_score.py) scores the flags against it ([home#976](https://github.com/mehrlander/home/pull/976), which adds the script).

The score follows the **narrow standard**, which counts only standing preferences ([home#936](https://github.com/mehrlander/home/pull/936), where Claude Haiku first applied it to a tenth of the corpus).

Each daemon run is stamped with **`flags_sha`**, a hash of the flagger's instructions.

The [**inspection form**](https://mehrlander.github.io/web-tools/pages/inspection.html) shows the owner each flag under its source sentence and takes a **verdict**: Right, Wrong, or Flip for the opposite stance. None of the 158 is judged yet.

An **assessment step** ([`assess.md`](https://github.com/mehrlander/web-tools-private/blob/claude/admiring-ride-kd04wp/sessions/tools/assess.md)), being trialed, has Claude read each flag in its session's context and keep the preferences that hold.

## Probe 1: sampling the flags

Would judging a sample of about 20 flags reach the same accept or reject decision as judging all 158?

**Harold F. Dodge and Harry G. Romig**, Shewhart's colleagues at Bell Laboratories, published acceptance sampling in 1929. It fixes an acceptance number, c, in advance. A daemon run is accepted when a sample of 20 holds no more than c flags judged Wrong or Flip. Otherwise every flag is judged.

The probe depends on the owner having judged all 158 flags. Taking that as the truth, draw many samples of 20 and count how often their decision matches.

Deming's all-or-none rule weighs the cost of judging a flag against the cost of a defect that gets through. For a stable process, it points to judging every flag or none. Each verdict's `at` time stamp gives the cost of judging, in seconds.

The yield is a decision on how many flags to judge per run: all, about 20, or none.

## Probe 2: a first look at a control chart

Shewhart's control chart plots a measure over time against limits computed from the process's own past. Once verdicts exist, the measure is weekly precision, the share of judged flags marked Right.

Until then, Haiku's narrow labels ([`narrow.jsonl`](https://github.com/mehrlander/home/blob/main/projects/text/runs/2026-11-06-prompt-sentiment/results/haiku/narrow.jsonl)) give a measure: the weekly share of the owner's sentences that state a standing preference.

Either chart is drawn once per subject: the flag's `about` or the label's `topic`.

The chart could show whether the series stays within its limits, Shewhart's sense of control. A week outside them would point to a cause. That week's `flags_sha` shows whether the instructions changed. Charting by subject separates a week spent on one subject from a change in the flagger.

Whether the flags are right stays the gold set's question, even on a stable chart. At our counts the limits are wide: a hypothetical week of 20 verdicts at a precision of 0.8 gives limits of about 0.53 to 1. Haiku's series describes Haiku's reading of the owner.

## Contributions

**Walter A. Shewhart** (1891–1967), a physicist at Bell Telephone Laboratories, drew the first control chart in 1924. He separated chance causes of variation, part of the process, from assignable causes, which can be removed.

The goal **Mechanical** in [`docs/aims-goals.csv`](../../docs/aims-goals.csv) reads "A process can be improved if it is reproducible and interpretable." Shewhart's control, a process varying within predictable limits, is its reproducible half. Probe 2 tests the flagger for that half.

**W. Edwards Deming** (1900–1993), a statistician, taught statistical quality control in Japan from 1950. His funnel experiment shows tampering: adjusting a stable process after each result makes its output vary more.

Deming offered a rule of thumb for human organizations: about 94 percent of troubles belong to the system. It is read here secondhand. The flagger's system includes its definition of a standing preference, the matching rule in [`flag_score.py`](https://github.com/mehrlander/home/blob/claude/admiring-ride-kd04wp/projects/text/runs/2026-11-06-prompt-sentiment/src/flag_score.py), and its input.

The input is often hedged: 48 percent of the gold sentences stating a want or an approval carry a hedge such as "maybe" or "I think" ([the run's findings](https://github.com/mehrlander/home/blob/main/projects/text/runs/2026-11-06-prompt-sentiment/README.md#what-was-found), item 3).

If the flagger proves stable, rewording its instructions after each Wrong flag would be tampering. No chart has shown it stable yet.

**Joseph M. Juran** (1904–2008), author of the *Quality Control Handbook* (1951), named the Pareto principle for quality: "the vital few and the trivial many". A Pareto chart sorts causes by count, largest first.

Coded notes on Wrong and Flip verdicts would give a Pareto chart of their reasons. The narrow standard's record already sorts the sentences it drops by reason: requests for a change in the case at hand 43 percent, corrections 16 and approvals 11 ([the run's "A narrower standard"](https://github.com/mehrlander/home/blob/main/projects/text/runs/2026-11-06-prompt-sentiment/README.md#a-narrower-standard)).

**Noriaki Kano** (1984) separated must-be qualities, missed only when absent, from attractive ones, which please when present. A speculative guess: the [peeves](../../skills/peeves/SKILL.md), mined from corrections, lean must-be.

**Michael Fagan**'s 1976 code inspections count errors by class to improve the process that made them. Coded verdict notes would do the same here. Fagan's life dates were not found.

**Shigeo Shingo**'s poka-yoke, a device that prevents a mistake or makes it obvious, describes the flagger's quote check.

## Personas

[`programs/organization/chiefs.html`](../../programs/organization/chiefs.html) proposes a persona for each program's manager agent, called its chief, with Deming among Organization's candidates. Two notes on it:

- Shewhart is not among the candidate chiefs. Testing is the program he would fit. Its planned timing log would record the suite's cost on each push to main. That series is one his chart could read ([the test-selection task](../../tracker/tasks/test-selection-by-reach-p2xtc5.md)).
- The page's Deming blurb says "plan, do, check, act". Deming preferred "study" to "check".

## Sources

Read secondhand through the pages below unless a primary text is named.

- Shewhart: [Shewhart on Wikipedia](https://en.wikipedia.org/wiki/Walter_A._Shewhart); Best and Neuhauser, [*Quality and Safety in Health Care*](https://pmc.ncbi.nlm.nih.gov/articles/PMC2464836), on the 1924 memo; the 1931 definition as quoted by [Keller and Pyzdek](https://qualityamerica.com/LSS-Knowledge-Center/statisticalprocesscontrol/common_and_special_causes_of_variation.php).
- Dodge and Romig: [Dodge at ASQ](https://asq.org/about-asq/honorary-members/dodge); "A method of sampling inspection", [*Bell System Technical Journal* 8, 1929](https://www.nokia.com/bell-labs/publications-and-media/publications/a-method-of-sampling-inspection).
- Deming: [Deming Institute timeline](https://deming.org/timeline/); Moen and Norman, ["Circling back"](https://qi.elft.nhs.uk/wp-content/uploads/2026/02/ron-cliff-circling-back.pdf), *Quality Progress*, 2010, on "study" and "check"; [the funnel experiment](https://sites.ualberta.ca/~yreshef/orga432/funnel.html); [the 94 percent rule of thumb](https://digestibledeming.substack.com/p/deming-devotional-5-troubles-and); Papadakis, [on the all-or-none rule](https://doi.org/10.1080/00224065.1985.11978950), *Journal of Quality Technology*, 1985.
- Juran: [Juran on Wikipedia](https://en.wikipedia.org/wiki/Joseph_M._Juran).
- Kano: the 1984 paper's [J-STAGE record](https://www.jstage.jst.go.jp/article/quality/14/2/14_KJ00002952366/_article/-char/en); [Kano model, Wikipedia](https://en.wikipedia.org/wiki/Kano_model).
- Fagan: the 1976 paper's [abstract](https://www.ifsq.org/work-fagan-1976.html) and [IEEE record](https://ieeexplore.ieee.org/document/5388086).
- Shingo: [mistakeproofing.com](https://mistakeproofing.com/a-brief-tutorial-on-mistake-proofing-poka-yoke-and-zqc/).
