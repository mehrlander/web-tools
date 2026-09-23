# Text tools on the page at hand

Three Web Tools surfaces read prose where it is displayed: the **Text tab** in
the drawer of the FAB (the floating action button on every page), and the file
viewer's **Proposals** and **History** modes. The estate's other text
instruments take a corpus or pasted text; these read the document a reader has
open. None calls a model or changes anything. The mechanics are in
[`fab.js`](../lib/alpineComponents/fab.js) and the kits linked below.

## The Text tab

The tab reads the selection, or the whole page if nothing is selected, and
reports three things:

- **Figures:** words, sentences, reading time, the longest sentence, and two
  house-rule counts, em dashes and file paths written outside a link.
- **Retained proposals:** edits proposed for a passage whose text equals the
  selection exactly, from the Text collection in `mehrlander/home`. Each shows
  its author and kind of edit. None can be applied. Text Lab lists the whole
  collection.
- **Registered files:** the files the text names, with what their registry says
  about each.

**Files are matched by path, not by term.** The tab was requested to connect
the terms a page uses to registered data. No committed file is keyed by those
terms, and the estate does not commit one, because `vocab.py` rebuilds it in
seconds. Five registries are keyed by path (`docs.csv`, `tests.csv`,
`harness.csv`, `portable.csv`, and `pages.csv`), so the tab searches the text
for every path they list. A second report lists paths the text names that no
registry holds.

**Apps are not held to prose rules.** A page that averages fewer than 6 words
per text run is treated as an app, and the house-rule counts are withheld. When
the threshold was set, apps measured 1.1 to 5.0 words per run and documents
8.3 and 20.0. The share of words in buttons and links was tried first, and it
ranked the pages backwards.

**Limits:**

- **Specific to this estate.** The file report depends on registries keyed by
  path, and `lib/` is in none of the five. Proposals require read access to
  `mehrlander/home`.
- **Rules checked on the rendered page.** The house rules govern markdown
  source, but the tab counts on the rendered page and cannot point to the
  source line.
- **No entity recognition, by choice.** The estate's recognizer is 19% precise
  on organization names (`state/entities.json` in `mehrlander/web-tools-private`),
  so terms drawn from it would mostly be wrong.
- **Thinly calibrated.** The app threshold rests on six pages. A remeasure on
  2026-09-17 moved the pages index from 5.4 to 5.9, near the threshold. The fix
  is to measure again under the original conditions, not to move the threshold.
- **Unproven in use.** Every recorded use has been a demonstration.

**Open questions.** Are the figures and the file report one feature or two? Do
house-rule counts belong on rendered output at all? Can terms be matched
without a committed vocabulary?

## The Proposals mode

For a markdown file, the **Proposals** mode shows each paragraph whose exact
text has a retained proposal as a swipeable container: the paragraph as it
stands, the changes marked, and the paragraph as proposed, with the proposer
and kind of edit underneath. [`kits/md-proposals.js`](../lib/kits/md-proposals.js)
builds it on [`kits/md-diff.js`](../lib/kits/md-diff.js). Exact matching is the
limit: on 2026-09-18, 71 of 2,272 half-length rewrites no longer matched,
because their paragraphs had been edited since.

## The History mode

The **History** mode shows what each paragraph of a markdown file said before,
read from git. [`kits/md-history.js`](../lib/kits/md-history.js) reads the file
at each commit that changed it and pairs paragraphs between versions by shared
words, the rule the Diff mode uses. Each changed paragraph becomes a swipeable
container between its earlier and current wording, listing the commits that
changed it and any proposals made against an earlier wording. The mode reads up
to 20 commits and offers more.

The pairing is an inference, not a record. A paragraph split in two is paired
with the part that shares more words. A paragraph moved to another file has no
history, because git records a deletion and an addition. A third collection
file, `revisions.jsonl`, held these connections until 2026-09-22;
`projects/text/DESIGN.md` in `mehrlander/home` explains why git replaced it.

## Where proposals come from

Proposals enter the collection from runs in `mehrlander/home`, including a
[local-model worker](https://github.com/mehrlander/home/tree/main/projects/text/instruments/proposals)
that appends its edits with the author `Ollama <model>`. Web Tools only
displays them.
