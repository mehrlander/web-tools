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
- **A Haiku codebook groups widely and loosely.** Drafted from the step 1
  phrases, it ran to 207 tags for 544 units, and Haiku then tagged every unit
  from it. Every key member shares a tag with a partner in another file, and 6
  of the judge's 7 same-job pairs share one; so do 12 of the 27 pairs judged
  different. A shared tag is a reason to look, not a finding.

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

**Step 2**, the codebook route: one Haiku agent drafted a job list from every
unit's step 1 phrases ([`prompt-codebook.md`](prompt-codebook.md), into
`runs/haiku/codebook.jsonl`), and three tagged the units from it, reading
the descriptions rather than the code ([`prompt-tags.md`](prompt-tags.md), into
`runs/haiku/tags-*.jsonl`), about 0.8 million agent tokens in all, 17
minutes of it the job list. [`tags.py`](tags.py) scores them:

| Measure | Result |
| --- | --- |
| Tags drafted, and used | 207, all used; 77 span more than one file, 33 hold one unit |
| Tags a unit | 1.6 on average; 2 units proposed a new tag |
| Widest tags | status-message (22 units, 6 files), scroll-to-target (22, 4), select-item-in-list (20, 5) |
| Key members sharing a tag with a partner in another file | 27 of 27 |
| Judged pairs sharing a tag | same 6 of 7, related 13 of 25, different 12 of 27 |

Reproduce the scores with `python3 research/code-jobs/score.py`; the embedded
rows need `--embed` from a venv with model2vec, as `python/doc-overlap.py`
describes. `pool.py score research/code-jobs/review/judge-sonnet-*.jsonl`
recounts the verdicts.

## Across all of lib/, with no model

[`scan-lib.py`](scan-lib.py) runs the code-text method over every `lib/` file:
5,386 units in 171 files, each unit's three nearest partners in other files,
in seconds. Of those pairs, 34 score 0.99 or more (37 files), 76 score 0.9 or
more (56 files), and 31 of the 76 have eight or more lines on both sides. The
top of the list is copies the key never held:

- `loadZip` in `io.js`, `xlsx.js`, `xlsx-write.js` and `docx.js`;
- a byte-size formatter in `stage.js`, `json-explorer.js` and `drop-zone.js`;
- `mention.js` and `path-picker.js` sharing `buildTree`, `sort`, `matches` and
  `ensureDir`;
- `stripScroll` in `waiting.js` as well as `here-view.js`, so the swiper family
  reaches past the three components sampled here;
- `hash` in two caches, `h` in `record-deck.js` and `row-menu.js`, `el` in
  `md-history.js` and `md-variants.js`.

Those come from the list's names and scores; no judge read them and neither
did this session, pair by pair. At this scale the measure looks like a standing
view in the Themes tab's shape, with function pairs in place of passages.

## Beside the other two reader passes

The estate runs the same shape of work twice already: web-tools-private's
session topics (Gemini summarizes each exchange, then names topics from the
summaries) and this repo's UI inventory (`data/ui-units/`, readers code each
page against a codebook). This probe is the third.

| Step | Session topics | UI inventory | Code jobs |
| --- | --- | --- | --- |
| Unit | an exchange | a view, tab or page | a function |
| Counted by script | the turn's tool calls and pushes | kit calls, hand-built signatures | the unit's identifiers |
| Reader step | a summary per exchange | codes from a fixed list | jobs and a summary per function |
| Grouping step | topics from the summaries | codes settled at a merge | similarity of descriptions; a drafted job list |
| Agreement check | two blind readers and a reviewer, scored | none | a key and one blind judge, scored |

What carried over from session topics held: summarize first and group from
the summaries, and score against something fixed before the run. What this
probe adds is that the script-counted signal is a method in its own right at
the right unit size, and finds pairs the reader misses.

## Limits

- **The key leans toward text.** Its groups were found by reading names and
  grepping, so they are the cases text can find; it cannot show what text
  misses. The pooled pairs are the fairer test, and one judge read them.
- **The judge's "same" is strict.** It asked whether one unit could replace the
  other, so two functions doing one job with different side effects came back
  related (pair 58, both finding the slide nearest a strip's edge). Topic size
  was the same open question in the session topics key.
- **One reader model.** Gemini was asked to read the same batches through the
  laptop daemon's `ping` errand, and neither attempt returned anything: all
  nine batches (`daemon-2026-10-24-ping-871828`), then batch 2 alone, 43 units
  (`daemon-2026-10-24-ping-cbf66c`), each closed with "Worker gave no response
  within 600s". The limit is the channel's wait for a first reply, not a
  measure of Gemini. A fair run needs batches of about ten units, some 55
  errands, or a laptop script that calls Gemini directly.
- **Fourteen files**, chosen because they hold known cases. The rate of new
  findings elsewhere is unmeasured.
- **Six one-line wrappers** share an id with the function they wrap in these
  batches. `score.py` keeps the inner function; `unitize.mjs` now drops such
  wrappers, so the batches are reproduced by the unitizer at `c21e4e95b`.
