# Text tools on the page at hand

The FAB drawer's Text tab. It reads the page or selection you are looking at and
reports three things: prior revisions retained for the same literal strings,
figures about the prose, and which registered files the text names. The figures
are local; the other two lanes read committed catalogs. No model is called and
nothing is written anywhere. Built 2026-08-13 and connected to the shared Text
proposal sources on 2026-09-17. This document is the design account and the
honest assessment; the mechanics live in
[`fab.js`](../lib/alpineComponents/fab.js) beside the code.

## Why it exists

The estate holds a shelf of text instruments: the private estate's
`projects/text/instruments/concept-lab/` (in this repo until 2026-08-25),
[`vocab.py`](../.claude/skills/concept-index/vocab.py),
`semsearch.py` (moved to the private estate with concept-lab, then into the
shared text project), and the
[entities](../pages/entities.html), [citations](../pages/citations.html) and
[shorter](../pages/shorter.html) pages. The private estate's
`projects/text/INSTRUMENTS.md` is the index of them, and the count is not
carried here because this document cannot gate it. Almost all take a corpus or
a paste. **None takes the document a reader currently has open.** This tab is
the only thing that closes that gap, and it is the strongest claim available
here.

It reuses machinery rather than inventing any: the FAB already knows the page's
repo, path and ref, survives into a toss, and through
[`kits/annotate.js`](../lib/kits/annotate.js) already walks a document's text.

## What it reports

**The subject** is your selection if there is one, the whole `body` otherwise.
In a readable `#gh=` toss it reads the tossed page, not the shell. The
selection is snapshotted when you tap the launcher, because that tap collapses
it.

**Figures**, computed locally: words against a chrome denominator, sentences and
their average, reading time, the longest sentence with its text, and two
house-rule counts (em dashes, and path-shaped tokens sitting outside any link).

**Prior revisions**, reconstructed from the private estate's durable Text
sources. The browser reads `projects/text/current-sources.json`, the phrase
review and its passage context, the document-audit packet, and (when declared)
`web_tools_paragraphs.drafts_inventory` (gzip JSONL of draft-bearing rows with
originals and path/line/paragraph provenance). Those inputs produce the
attributed proposal subset counted live in Text Lab. An exact band
means the edge-trimmed selection equals a proposal's original string. A
contained band means the same case-sensitive, token-bounded string occurs
inside the larger selection or page. Neither band is semantic, and neither says
that prior source-occurrence work should be applied to the occurrence now on
screen.

Every proposal shows its earlier original and revision, action, attribution,
and source provenance. Phrase reviews retain their passage and imported
judgments. Document-audit proposals retain the historical patient revision,
rationale, relocation, and evidence. There is no Apply action. A browse-all
link opens the same records in Text Lab, where they can be searched, filtered,
expanded, and addressed by proposal ID.

**One gate.** Under 6 mean words per text run, the page is treated as an app
rather than a document, and the two house-rule rows are withheld: they are prose
rules, and a file browser listing filenames is not prose. The threshold was
measured, and chrome share was tried first and abandoned because it inverts the
separation, putting the most document-like page at 2% and an app at 9%:

| links | data-view | show-repo | pages index | annotate | shorter |
| --- | --- | --- | --- | --- | --- |
| 1.1 | 3.0 | 4.0 | 5.0 | 8.3 | 20.0 |

## The join is the path

The tab was asked for as *terms* connected to registered data. It matches
*filenames*, and the retreat is structural rather than a shortcut.

Nothing committed for a browser to read is keyed by the words prose actually
uses.
[`surfacing.csv`](surfacing.csv) is keyed by sentence-shaped titles
(*Reference is a link*) that never occur in running text.
[`text-fields.csv`](text-fields.csv) and [`properties.csv`](properties.csv)
are keyed by ordinary English words: note, open, scope, role.
[`board.csv`](../tracker/board.csv) is keyed by task ids, whose only human
handle is the title. No committed
vocabulary keyed by surface form exists, and that is a decision: `vocab.py`
builds one in 1.7 seconds and the `concept-index` skill declines to commit the
result, on the rule that retired the merge guide.

What does exist is **five registries keyed by path**, and a path is a token this
prose really uses. So the lookup runs *from the registry*, searching the text
for every path the five carry:

| Registry | Covers | Says |
| --- | --- | --- |
| [`docs.csv`](docs.csv) | declared documentation paths | subject, status |
| [`tests.csv`](tests.csv) | `tools/test/` | protects, kind |
| [`harness.csv`](harness.csv) | `tools/`, `scripts/` | role, layer |
| [`portable.csv`](portable.csv) | the distribution crosswalk | role, kind, delivery mode |
| [`pages.csv`](../pages/pages.csv) | `pages/` | note, live address |

Row counts are deliberately not carried in this prose: the
[Map view](https://mehrlander.github.io/web-tools/app/?view=map) renders each
registry live. The five grew by about half between this page's build date and
2026-09-08, which is why the figures that stood here are gone rather than
restamped.

The first build ran the other way: a regex for path-shaped strings, then a tree
read to validate each guess, with the registry consulted last. Inverting it made
root-level files reachable at all (`CLAUDE.md`, `README.md` and `package.json`
were invisible to it, since the pattern needs a slash), stopped URL
tails being generated and then reported as misses, and made the tree read
optional.

The regex survives as a second, demoted lane: paths the text names that nothing
has registered, split by whether the repo holds them. That is the only lane that
reads the tree, and only to tell a gap in the registries from a reference to
nothing. Both lanes run when the tab opens.

## What it is not

**Not semantic.** A regular expression, a set-membership test and a dictionary
lookup. The word "resolve" describes a string comparison.

**Not a general capability.** The registered-file lane works because *this*
estate keys its registries by path. Off `mehrlander/web-tools` there are no path
descriptions at all, and within it `lib/` is uncovered, so many rows carry a
link and nothing else. The proposal lane is also estate-specific:
it reads `mehrlander/home@main` and requires the viewer's access to that private
repository.

**Not built on the recognizer, deliberately.** `state/entities.json` reports ORG
precision of 0.19 stratified on one rater; its top ORG entries for this repo are
`ref`, `API`, `HTML`, `GitHub`. A pane surfacing that as "terms on this page"
would be wrong four times in five, and wrong in the way hardest to notice.

**Checking the wrong artifact, in two of six figures.** The em-dash and
reference-is-a-link rules govern authored markdown. The tab reads rendered
output, reports a count, and offers no route to the source line that must
change. The other four figures are generic.

**Thinly calibrated, and the table above predates the read it describes.** The
app gate rests on six pages plus one long document observed later. The threshold
decides whether the house-rule rows appear at all. Those figures were measured
before the read learned to skip hidden text, which every page with a closed tab,
an inactive pane or an `x-cloak` attribute has. Re-measured on 2026-09-17 with
and without that filter, on pages rendered without their live data, so the
absolute numbers are not the calibration conditions and only the movement means
anything: words-per-run shifted a little and chrome share roughly halved.
No page changed side of the gate, and the pages index moved from 5.4 to 5.9
against a threshold of 6, which is most of its remaining margin. The right fix
is a re-measurement under the original conditions, not a nudge to the threshold.

**Read-only.** It writes nothing and cannot apply a proposal. The local figures
exist while the drawer is open; retained proposals have stable IDs and can be
opened in Text Lab, but a later source edit remains a separate operation against
a verified current occurrence.

**Unproven in use.** Every run so far has been a demonstration. There is no
evidence a second tap follows a first.

## What the building cost, and what that indicates

Six defects were found by running it, not by reading it: a lazy module load
deleted by an unrelated edit while the suite stayed green, because every test
stubbed the thing the load exists to supply; a selection destroyed by the tap
that opens the drawer, so the scope feature had never once functioned; two
hidden elements whose contents still evaluated, since `x-show` toggles display
without stopping evaluation; table cells joined into one reported sentence; and
two token extractors that had drifted apart, so one count read 6 where the other
listed 2. In a feature this size, that indicates a design substantially
discovered at the screen rather than reasoned out first.

Its existence also cost a redesign of the tab strip. Four tabs already filled the
drawer at 390px. The strip now carries one label in a fixed slot so the icons
hold constant coordinates; the version that put the label inside the selected
button reflowed on every tap, five distinct layouts with an icon travelling 49px.
That change is independently defensible and may be worth more than the tab that
forced it.

## Not built, and unresolved

**Flag** (terms leaned on but never introduced) wants a corpus the browser does
not have. The `assumed` tier is a property of a repo's whole prose, so this pane
can only reach it by fetching the vocabulary index the estate declines to
commit. It likely stays an agent-side answer the tab links to.

The private text project also builds an ignored, current-checkout collection far
larger than this browser projection. The browser does not transport that
machine-local store. It reconstructs only the proposals recoverable from
committed review sources, so current occurrences, normalization and lemma
relationships, the wider exact index, and any semantic index remain absent.

**Ask** (hand the text to a model) probably belongs in the FAB's existing
take-away menu, whose job is already handing the page somewhere else.

Three things remain undecided. Whether "how long is this text" and "which files
does it name" are one feature or two co-located ones. Whether the estate-specific
checks belong on rendered output at all, given the fix always lives in a source
file the tab cannot reach. And whether *terms* in the original sense is
reachable, or whether it simply requires the committed vocabulary the estate has
chosen not to keep.

`data/design/content.csv` is a sixth path-keyed registry, left out: it is a CSV,
its locators are often directories, and its description classifies how content
was made rather than saying what a file is.
