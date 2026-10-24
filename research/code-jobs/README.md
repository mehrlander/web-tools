# Code jobs: finding one job done in several places

A probe, run 2026-10-24. The question: can a cheap model reader find functions
that do the same job in different files, when the code shares little text? A
copy detector (jscpd) and a comparison of file header comments both missed the
case that prompted it: two table engines, the transform workbench and the
tabular explorer, each with its own Profile and Pivot.

The method is the session topics follow-up's (web-tools-private
`sessions/topics/`): read each unit and say what it does, then group the units
by what was said, and score the grouping against a key. Here the unit is a
function rather than an exchange.

## What it found

- **The unit size mattered more than the reader.** Ranked by TF-IDF over their
  own identifiers, function units already put a known partner first for 70% of
  the key's members and in the top ten for all of them. The file-level
  measures that missed the table engines were measuring the wrong unit.
- **Haiku's descriptions did a little better on the key** (every member's
  partner in its top five, against 81% for the code) and **much better on
  noise**: of each method's 20 most similar new pairs, a blind judge called 4
  of Haiku's different jobs and 8 of the code's.
- **The two find different pairs.** Of the seven new pairs the judge called
  the same job, four only the code text proposed, two only Haiku's
  descriptions did, and one both. Run both.
- **Embeddings did worse than TF-IDF** on both inputs, with the model the
  Themes tab's Similar wording uses.

The findings worth acting on, each read back against the code:

1. **The hand-built swiper is a family of jobs.** Between them,
   `file-browser.js`, `here-view.js` and `user-call-form.js` rebuild four
   things `swipeDeck.core` returns: scrolling to a slide, reading which slide
   is showing, coalescing scroll events, and mounting the panels near the
   current one. Two of them also write the same callback that retitles an open
   deck on each slide. The UI inventory's `hand_snap` signature flags all
   three files in its 2026-10-23 snapshot (`data/ui-units/signals.csv`); this
   names the functions.
2. **The two pivots disagree.** The explorer's `renderPivotTable`
   (`tabular-explorer.js:854`) adds a measure that will not parse as zero, to
   the sum, the count and the minimum, and reads a dimension value of `0` as
   `(blank)`; the workbench's `pvTree` skips the row and reports the count. The
   workbench's saved recipe also parses numbers more loosely than its own view
   (`pvFnSrc` against `pvNum`).
3. **At least eight files build their own download link** beside `io.save`
   and `io.saveJson` in `lib/kits/io.js`: four kits or components and four
   pages, by a grep for one spelling of it. The workbench's, which the judge
   paired with json-explorer's, uses another, so the count is low. Some of the
   pages may load no library, the exception #1015's guard tests allow.
4. **`node/build/registries-load.mjs` carries `csv.js`'s parser byte for
   byte**, both the line split and the record build, with no comment saying why.

## How it was run

| Step | What | Result |
| --- | --- | --- |
| Units | [`unitize.mjs`](unitize.mjs) cuts each nested function of five or more lines out of its parent, adds a top-level unit per block, and splits a unit past 150 lines into parts | 550 units from 14 files, 544 distinct (below) |
| Key | [`key.json`](key.json), written before any model ran: eight groups known to share a job, each with its evidence | 27 member rankings |
| Step 1 | Haiku, nine agents, one batch each, [`prompt-summary.md`](prompt-summary.md): every job the unit does, as a short phrase, and a summary | every unit described, ids exact; about 1.6 million agent tokens, five minutes |
| Score | [`score.py`](score.py) ranks every unit in other files by similarity and finds where a member's partner lands | [`scores.json`](scores.json) |
| Pool | [`pool.py`](pool.py) takes each method's 20 most similar pairs the key does not hold, shuffled | 59 pairs in [`review/`](review/) |
| Judge | three Sonnet agents, blind to method, [`prompt-judge.md`](prompt-judge.md): same, related or different | [`review/judge-sonnet-*.jsonl`](review/) |

**Against the key**, the share of members whose partner ranks k or better:

| Method | @1 | @5 | @10 | MRR |
| --- | --- | --- | --- | --- |
| code, TF-IDF | 0.70 | 0.81 | 1.00 | 0.76 |
| Haiku, TF-IDF | 0.74 | 1.00 | 1.00 | 0.83 |
| code, embedded | 0.52 | 0.74 | 0.81 | 0.61 |
| Haiku, embedded | 0.67 | 0.85 | 0.93 | 0.75 |

**New pairs**, each method's top 20 as the judge saw them:

| Method | Same | Related | Different |
| --- | --- | --- | --- |
| code, TF-IDF | 5 | 7 | 8 |
| Haiku, TF-IDF | 3 | 13 | 4 |
| code, embedded | 2 | 3 | 15 |
| Haiku, embedded | 1 | 15 | 4 |

Reproduce the scores with `python3 research/code-jobs/score.py`; the embedded
rows need `--embed` from a venv with model2vec, as `python/doc-overlap.py`
describes. `pool.py score research/code-jobs/review/judge-sonnet-*.jsonl`
recounts the verdicts.

## Limits

- **The key leans toward text.** Its groups were found by reading names and
  grepping, so they are the cases text can find; it cannot show what text
  misses. The pooled pairs are the fairer test, and one judge read them.
- **The judge's "same" is strict.** It asked whether one unit could replace the
  other, so two functions doing one job with different side effects came back
  related (pair 58, both finding the slide nearest a strip's edge). Topic size
  was the same open question in the session topics key.
- **One reader model.** Gemini was asked to read the same batches through the
  laptop daemon (errand `daemon-2026-10-24-ping-871828`), and the laptop was
  asleep; its answers land in `runs/gemini/` if it runs.
- **Fourteen files**, chosen because they hold known cases. The rate of new
  findings elsewhere is unmeasured.
- **Six one-line wrappers** share an id with the function they wrap in these
  batches. `score.py` keeps the inner function; `unitize.mjs` now drops such
  wrappers, so the batches are reproduced by the unitizer at `c21e4e95b`.
