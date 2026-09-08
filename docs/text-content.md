# Text content and commentary

Where the estate's authored text lives, whether the carrier holding it is in
any shape to be relied on, and how much text never reached a carrier at all.
Measured 2026-08-10 across `mehrlander/web-tools` and `mehrlander/home`, with
two instruments that make every figure below one command away:

```bash
python3 scripts/embedded-prose.py . pages lib --weight   # text with no carrier
python3 scripts/text-carriers.py . --fields           # the carriers we have
```

Re-derive rather than cite. The numbers move as the repos do.

Two questions, and they needed different work:

1. **How organized are the carriers we have?** Every authored carrier in both
   repos is declared, which is better than expected. The vocabulary inside them
   was not: budget-DRS used **16 different field names for what is broadly one
   concept**, an authored justification or gloss, across 46 carriers and 31,883
   words. [`docs/text-fields.csv`](text-fields.csv) now states twelve names with
   the rule for picking among them, and every prose field name in budget-DRS
   maps to one of them.
2. **What never reached a carrier?** Widening the scan from `.js`/`.html` to
   `.py` roughly doubled the commentary found in budget-DRS's app and took its
   uncarried text tables from 2 to 10. Six registry rows moved another 53,115
   words from "no carrier" to correctly declared as supplied or generated, and
   the largest remaining uncarried table, the app's ten view blurbs, now has one.

## Three kinds, three different answers

The kinds are not degrees of one thing. They differ in who the reader is, and
that decides where each belongs.

| Kind | Reader | Belongs in | Failure mode |
| --- | --- | --- | --- |
| **Text content** | the app's reader | a data carrier (CSV, JSON) with declared authorship | only an editor can find or revise it |
| **Commentary** | whoever edits the file | the source file | grows into a document with no registry row |
| **Inline prose** | the app's reader | rendered from a carrier | a sentence with no owner, category, or check |

The scan names them `text-table`, `commentary`, and `inline`. None is an
error and the script never says otherwise. A comment is supposed to exist, and
a three-row gloss table is not worth a CSV.

---

# Part 1: the carriers we have

[`scripts/text-carriers.py`](../scripts/text-carriers.py) finds every CSV column
and JSON key whose values are sentences, then asks whether anything in the repo
names the file and whether the text is the estate's own voice or quoted source.

## Declaration is not the problem

| | Carriers | Authored words | Undeclared |
| --- | --- | --- | --- |
| budget-DRS | 160 (67 authored) | 53,852 | **0** |
| web-tools | 22 (16 authored) | 13,978 | 1,031 in one file |

Every authored carrier in budget-DRS is named by a registry, a README, or
`CLAUDE.md`. web-tools has one exception,
[`tracker/assessments/2026-08-07.json`](../tracker/assessments/2026-08-07.json).
Whatever else is wrong here, text is not being filed into files nobody knows
about.

## The vocabulary is the problem

budget-DRS's 67 authored carriers use **65 distinct prose field names**, and
**80% of them appear in exactly one carrier**. web-tools is the same shape at a
smaller scale: 25 names, 64% used once.

Sixteen of budget-DRS's names are doing one job:

| Field | Carriers | Words |
| --- | --- | --- |
| `note` | 25 | 15,567 |
| `basis` | 6 | 1,205 |
| `evidence` | 4 | 1,934 |
| `why` | 3 | 868 |
| `origin`, `notes`, `method`, `detail` | 2 each | 6,389 |
| `rationale`, `comment`, `reason`, `concordance`, `implication`, `premise`, `description`, `work` | 1 each | 5,920 |
| **total** | **46 carriers** | **31,883** |

That is not a naming quibble. It means no reader and no tool can ask this repo
for its authored rationale and get an answer, and the estate's own
`concept-index` and `semsearch` tools cannot weight a `why` differently from an
`item_title`. A vocabulary nobody has stated is the honest measure of how
organized the carriers are, and this one has never been stated.

Note what the spread is *not* evidence of. `note` at 25 carriers is a
reasonable default and most of those rows are fine. The cost lands on the tail:
`premise`, `concordance`, `implication`, and `work` each exist once, and a
reader meeting one of them has no way to know whether it means what `basis`
means somewhere else.

---

# Part 2: text that never reached a carrier

[`scripts/embedded-prose.py`](../scripts/embedded-prose.py) reads `.js`, `.mjs`,
`.html`, and `.py`, splits what it finds into the three kinds, and separates
generated payloads and supplied files, whose text has a carrier somewhere else.
It reads the repo's `data/design/content.csv` where one exists, so it reports
against the declaration rather than beside it.

## web-tools, `pages/` and `lib/`

156 files, 4.81 MB.

| Class | Words | Units |
| --- | --- | --- |
| commentary | 138,089 | 2,757 blocks, 892,473 bytes, 18% of the tree |
| text tables | 801 | 5 tables, none with a carrier |
| inline prose | 4,589 | 190 runs |

Comment blocks by size, where a block is one HTML comment, one `/* */`, or a
run of consecutive `//` lines, which is the unit a person actually wrote:

| Size | Blocks | Words |
| --- | --- | --- |
| under 40 words | 1,784 | 35,337 |
| 40 to 99 | 696 | 41,358 |
| 100 to 249 | 220 | 32,560 |
| 250 to 599 | 50 | 17,776 |
| 600 or more | 7 | 11,058 |

The mass is not in the tail. Over half the words sit in blocks of 40 to 249
words, which is the file-header essay this codebase writes on nearly every
module: [`lib/kits/dictate.js`](../lib/kits/dictate.js) opens with 703 words,
[`lib/kits/repo-proposals.js`](../lib/kits/repo-proposals.js) with 861,
[`lib/alpineComponents/ref-switch.js`](../lib/alpineComponents/ref-switch.js)
with 669. That is a convention, consistently applied, and it is the most
defensible prose in the estate. It is also entirely undeclared.

### The outlier, and it is a document

[`app/index.html`](../app/index.html) is 295 KB, of which **153,676 bytes
(52%) are comments**: 23,665 words in 327 blocks. One block, at line 4370, runs
**5,962 words** under the heading "Design notes: the estate, the landing
mechanism, the views, the stage."

**Moved 2026-08-16:** the file was at `pages/show-repo/show-repo.html` when
these figures were taken. The link is retargeted so the numbers stay attached
to a reachable file; the figures themselves are as measured and are not
restated for the move.

The page also has a companion doc, [`docs/show-repo.md`](show-repo.md), at
23,920 words, overlapping 4.5% by 8-gram. This document has now been wrong
about that pair twice, and the second correction is the useful one.

**First reading:** two parallel bodies with no declared authority. Wrong. The
doc's 27 headings are a contract; 326 of the page's 327 comment blocks are
per-site rationale beside the code they explain. That is the reader/editor
split the field vocabulary names, and both halves are on the right side of it.

**Second reading:** the one exception, a 5,962-word block at line 4370, is a
lagging partial copy of the contract, so delete it. Also wrong, and the way it
was wrong is worth recording. The evidence for it was a token comparison: the
doc carries 57 technical tokens to the block's 34, sharing 29, and names six
view keys (`chats`, `guides`, `proposals`, `public`, `sessions`, `state`) the
block never mentions. All of that is true. It is also the wrong instrument for
the question, because it can only see claims that carry an identifier.

**What a read found that the tokens could not.** The block is a mix, and its
two halves want opposite treatments:

| | Words | Verified against | Treatment |
| --- | --- | --- | --- |
| Contract | ~3,850 | the doc, by substance | redundant |
| UI decision rationale | ~2,760 | the doc *and* the page's own per-site comments | unique |

The contract half checks out as redundant on every probe run against it: all
ten `.web-tools.json` fields in its table are in the doc, and
[`manifest-fields.csv`](manifest-fields.csv) governs forty-six; the federation account was in
the doc's Roadmap with the same reasoning, and is now in the closed tracker task
`private-repo-landing-federation-u50nns`, which holds the fuller version; the branch overlay section is longer
and carries a "why this needs to exist" analysis the block lacks; the boundary
covers four channels where the block covers two.

The rationale half is not in the doc and, measured, not in the page's own
per-site comments either: the header-nav passage overlaps those at 7.5%, the
jump-overs at 3.2%. It is material like *"Open went because tapping the row
itself opens the repo"*, *"a menu offering a jump to a row three lines down is
answering a question the list has already answered"*, *"when adding a view, add
its jump-over, and prefer the shared list to a fresh one"*, and the rule that
repo, branch, menu and folder icons deliberately carry no file glyph. Those are
decisions and conventions addressed to whoever edits this page. Deleting them
would lose them.

**Done 2026-08-10.** The contract half is retired, the rationale half sits at
the code it explains, and three facts that were in the block and in neither the
doc nor `estate.js` were salvaged into the doc first: the `?view=app&appRepo&appPath`
address for a promoted app view, `docs/owners.csv` behind the Map's Claims tab,
and `lists/pins.json` with the Pin item shape. The page went from 294,628 to
255,545 bytes and from 91,970 to 76,894 gzipped, and its comment count rose from
327 blocks to 335, which is the shape of the change: fewer words, more sites.

**The treatment was a split, not a verdict.** The contract half went, because
the doc says it better and two copies is a tax the git history shows being paid:
four commits in one week touched both, and the block still fell six views
behind. The rationale half moves to the code it explains, which is where the
file's own convention already puts everything else. The passages and their
anchors are the header nav (`estateNav`), the repo menu (`repoMenuItems`), the
crumb trail (`sidebarCrumbs`), the jump-over convention, which is cross-cutting
and belongs at the top of the file rather than at one site, and the landing seam
(`landingKind`).

One passage is unresolved and should not be moved on the current evidence: the
1,540-word estate description overlaps `estate.js`'s own commentary at 9.7% and
the doc at 11.9%, and low n-gram overlap is not evidence of unique content in
this pair, since the whole page-and-doc corpus overlaps 4.5% while covering the
same subjects. It needs the same substance check the manifest table got.

**The general lesson, which is why this sits in this document rather than in a
commit message:** a token comparison is the right first instrument and the wrong
last one. It found the coverage gap in minutes and would have authorized
deleting 2,760 words of unique judgment, because the judgments that matter most
are exactly the ones phrased without an identifier to match on. Every scan in
this document has that shape. They are worth running and not worth obeying.

The transfer cost is real and separable. Stripping comments takes the page from
295 KB to 139 KB, and gzipped from 92.0 KB to 31.5 KB, so **two thirds of what
this page ships is commentary**. Across `pages/` and `lib/` the figure is
391 KB gzipped. That is not an argument for deleting it. It is an argument that
it is a shipped artifact and should be accounted for like one.

## budget-DRS, the live app

112 files, 5.05 MB, workshop exhibits excluded as generated, builders included.

| Class | Words | Units |
| --- | --- | --- |
| commentary | 68,306 | 1,563 blocks, 447,432 bytes, 8% of the tree |
| text tables, no carrier | 1,361 | 10 tables |
| text tables inside generated payloads | 17,735 | 14 tables, carrier is the builder's input |
| inline prose | 8,578 | 482 runs |

The 8% is diluted by the committed data payloads. In the hand-written view
modules the density matches web-tools: `app/view/views/spend.js` 28%,
`composition.js` 43%, `app/view/app.html` 35%. The largest single block is 610
words, against web-tools' 5,962.

The 13-to-1 split between carried and uncarried text content is still the
finding worth keeping. The repo's "data before display" rule is holding nearly
everywhere it applies.

## What widening the net cost, and what it found

Reading `.py` was not a rounding error. In the same scope, adding builders to
`.js` and `.html`:

| | `.js`/`.html` only | with `.py` |
| --- | --- | --- |
| commentary | 34,911 words | 68,306 |
| uncarried text tables | 739 words, 2 tables | 1,361 words, 10 tables |

Python belongs in scope because a build script is where a page's reader-facing
strings go to hide. A `blurb` list in
[`build-atlas.py`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/app/atlas/tools/build-atlas.py)
reaches a reader exactly as one in a view module does, and until this pass the
two could not be counted by the same means: the 113 builder literals in the
first version of this document had to be counted by hand.

The scan separates the guard messages, which are legitimately code. The
distinction is mechanical: a string inside a `raise`, `assert`, `sys.exit`, or
`print` is addressed to whoever ran the build.

## Six registry rows, and 53,115 words

The other half of "never reached a carrier" is text the registry mislabels
because the covering row is a directory. Four rows added to home's
`data/design/content.csv` and two to web-tools':

| Row | Was | Is | Words |
| --- | --- | --- | --- |
| `chron/2026/04/2026-04-19-paul-ford-code-bloomberg-article.html` | `mixed` under `chron/` | `supplied` | 27,870 |
| `chron/blog/index.html` | `mixed` under `chron/` | `mechanical` | 18,039 |
| `pages/wsl-sync/data/` | `hybrid-authored` under `pages/` | `supplied` | 6,900 |
| `pages/wsl-sync/rcw/` | `hybrid-authored` under `pages/` | `supplied` | 100 |
| `chron/index.md`, `chron/blog/index.md` | `mixed` under `chron/` | `mechanical` | the rest |

The first is a saved Bloomberg article, captured whole: 27,870 words of
somebody else's prose that the `chron/` row counted as this repo's own. The
second is the generated HTML twin of every blog post, so counting it doubles
the blog. The `wsl-sync` pair is legislative data fetched by a cron.

None of these was a mistake at the time. Each is a directory row that was right
when written and outlived a file that landed under it. That is the recurring
shape of this problem, and it argues for the periodic re-run rather than for
more rows up front.

Home's uncarried inline prose fell from 75,280 words to 29,371 as a result, and
its registry now covers 324 of 324 files that hold prose.

---

# The specific violators

## Text tables with no carrier

The clearest case, because there is no judgment in it. Reader-facing prose
keyed by something, with nothing behind it:

- [`app/view/app.html:580`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/app/view/app.html#L580), 10 entries, 456 words. The `VIEWS` registry's per-view `blurb` fields.
- [`app/view/views/spend.js:34`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/app/view/views/spend.js#L34), 22 entries, 283 words. Object glosses: `"Employee Benefits": "The benefits load on staff pay."` The app's definitions of its own spend taxonomy, existing nowhere else in the repo.
- [`app/lineage/tools/build-lineage.py:103`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/app/lineage/tools/build-lineage.py#L103), 12 entries, 389 words. Provenance rationale keyed by script path, the largest of the builder tables.
- [`data/design/catalog/tools/build-source-bundles.py:85`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/data/design/catalog/tools/build-source-bundles.py#L85), 17 entries, 256 words.

The first has a second reason to move.
[`app/data-explorer/tools/build-data-explorer.py`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/app/data-explorer/tools/build-data-explorer.py)
regex-parses those `blurb` strings back out of `app.html` so the Views manifest
can reuse them, and carries two guards against "regex shape drift." The guards
are the tell. The builder is doing the right thing about the wrong carrier: the
app shell is being treated as the registry, which inverts the rule the rest of
the repo follows. A CSV with `view, title, lens, blurb` would let the shell and
the manifest read the same rows, and the regexes would go away.

---

---

# The vocabulary, and what replaced the registry this document first proposed

## What was proposed, and why it was wrong

The first draft of this document proposed `data/design/text.csv`: one row per
text set, carrying `carrier`, `rendered_by`, `field`, `rows`, and the rest. That
was a mistake, and the estate's own rule says why. **Do not commit what a live
read already answers.** `text-carriers.py` derives the carrier, the field, the
row count, and the word count on every run; committing them would add a refresh
obligation and a way to be out of date, which is exactly the argument that
retired `docs/MERGE-GUIDE.md`.

What a scan cannot derive is what a name *means*. That is the whole finding of
Part 1, and it needs one row per **name**, not one per carrier.

## The carrier: docs/text-fields.csv

Thirteen sanctioned names, each with the audience it implies, a gloss, and the
`use_when` rule that settles which to pick. A definition alone never settles
that, which is why `use_when` is required rather than optional:

| Field | Audience | For |
| --- | --- | --- |
| `gloss` | reader | what the row's subject is |
| `narrative` | reader | prose meant to be read as prose |
| `payload` | reader | text the row exists to carry, not text about it |
| `rationale` | reader | why this judgment, against the alternative |
| `use_when` | reader | when to pick this over its neighbour |
| `scope` | reader | what it covers and deliberately does not |
| `evidence` | reader | the measured check, with figures |
| `caveat` | reader | what limits or qualifies it |
| `provenance` | reader | where it came from, how to reproduce it |
| `upkeep` | editor | what keeps it true, and who does it |
| `open` | editor | what is unresolved |
| `note` | editor | the deliberate catch-all |
| `quoted` | reader | verbatim from a source |

It is portable, because a concept named once should be the same concept in every
repo, and it is declared in [`docs/properties.csv`](properties.csv) with
[`tools/test/text-fields-registry.test.mjs`](../tools/test/text-fields-registry.test.mjs)
as its gate. That test holds the size (a vocabulary that grows a name whenever a
carrier wants one is not a vocabulary), the typing, and two properties that are
invisible on reading the file: the alias map has to be a function, and no alias
may also be a sanctioned name.

## Conformance by declaration, not by rename

The `instead_of` column is the part that makes this usable on an estate that
already exists. It lists the names in use that each sanctioned name accounts
for, so `text-carriers.py` resolves an old name rather than reporting it as a
violation. **An existing carrier conforms by declaration.** Renaming is optional
and separate, and mostly not worth it: `blurb` appears in 23 places across
budget-DRS, and renaming it to `gloss` would buy nothing the alias map does not
already give while touching a live app in 23 places.

Measured after the vocabulary was written against both repos:

| | On a sanctioned name | An alias of one | A value, not prose | Unclaimed |
| --- | --- | --- | --- | --- |
| budget-DRS | 17,817 words | 28,744 | 7,291 | **0** |
| web-tools | 1,573 words | 11,758 | 815 | **0** |

Every prose field name in both repos now maps to one of thirteen stated
concepts, and `text-carriers.py --check` exits 0 on both.
Both reached zero, but not by the same route, and the difference is the point.
budget-DRS's residue was absorbed by alias rows. web-tools' last name, `prompt`
in a tracker assessment, was not: it holds a session instruction, so the row
exists to CARRY the text rather than to describe something else. Every other
name in the set annotates a subject, and that one is the subject. It earned a
thirteenth name, `payload`, rather than an alias to something it is not.

That is the intended way for the vocabulary to grow: a name is added when a
carrier turns out to hold a kind the set genuinely lacks, and the count in
[`text-fields-registry.test.mjs`](../tools/test/text-fields-registry.test.mjs)
has to move in the same commit, so growth is deliberate.

The alias lists were built from the observed names, not invented: the run that
produced them is `text-carriers.py --offvocab`, and a name entered the list only
after its actual values were read.

---

# The worked example: the VIEWS blurbs

The migration this document listed as the highest-ratio move, done, so the
convention has a case rather than only a rule.

[`data/design/views.csv`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/data/design/views.csv)
is now the carrier for ten views' `title`, `lens`, `kind`, and `gloss`. It sits
beside `view-grains.csv` and `view-tabs.csv`, which are the same kind of
manifest about the same views, and that placement was not a preference: the
verify suite's leaf-homing rule rejected it anywhere else.

What the shell keeps is the structural half of each entry (lens/kind, icon,
source, data links, embed), and it merges the text in from a generated
`views-data.js` at module scope, so every consumer still reads one `VIEWS`
object. `build-data-explorer.py` reads the CSV directly, and the two drift
guards it carried against its own regexes are gone, replaced by a stronger
check: the carrier and the shell have to agree about which views exist, which
neither could notice before.

`app/data-explorer/data.js` came out **byte-identical**, which is what a refactor
onto a structured stage is supposed to leave behind.

Three things the migration turned up that generalize:

* **A fallback hides a break.** The merge falls back to the view key for a
  missing title and an empty string for a missing blurb. That is right at
  runtime and exactly wrong to leave unchecked, since a stale payload renders as
  a plausible header with the prose silently gone.
  [`verify-views-text.mjs`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/app/view/tools/verify-views-text.mjs)
  walks carrier to payload to shell and was confirmed against a negative
  control.
* **Two verify scripts were reading the fields being moved.** Both now read the
  carrier, which is a better place to read them from.
* **Widening a check's assumption exposed a second one.** Letting the lineage
  verifier accept a payload in the page's own directory made its bare `src=`
  pattern match a comment explaining why a relative `src="./data.js"` resolves
  against nothing. Anchoring the match to a real script tag fixed it. A check
  that has only ever seen one shape encodes that shape as a rule without saying
  so.


---

# Proposed: what a gate can and cannot hold

Be honest about the split, because the tempting check is the one that would
misfire.

**Checkable, and worth checking:**

- An **undeclared** text table over N prose-valued entries in a source file.
  Unambiguous, and `--tables` already reports it, with generated payloads
  separated out so a built `data.js` does not read as a violation.
- A prose field whose name is not in the stated vocabulary.
- An authored carrier nothing in the repo names. `text-carriers.py --check`
  exits 1 on one; both repos pass today except for a single web-tools file.
- A comment block over N words. `embedded-prose.py --check N` names the offenders.
- Drift between a declared `rows` count and the carrier's actual row count, the
  same shape as the registry gates already running.

**Not checkable, and a gate would be wrong:**

- Whether a given sentence is content or commentary. That is the judgment the
  registry records, not one a script can make.
- Whether a comment is too long in general. The 40-to-249-word file-header
  essay is this codebase's convention and is good. A hard ceiling would fire on
  916 blocks that are working as intended.
- Whether a directory row still fits every file under it. That is what the
  six-row correction above was, and it needed reading, not a rule.

So the recommended gate is narrow: fail on an undeclared text table and on an
off-vocabulary field name, and report everything else. Same posture as
[`scripts/dead-links.py`](../scripts/dead-links.py), which gates the
cross-repo classes and never gates the internal one, and
[`unclaimed-code.py`](../scripts/unclaimed-code.py), which never
gates at all.

Placement follows the estate's existing owner split:
[`.githooks/pre-commit`](../.githooks/pre-commit) for the local pass and
[`.github/workflows/test.yml`](../.github/workflows/test.yml) for the one the
platform enforces, since a hook that may not fire needs a check that runs on
every pull request.

# What to do first, if anything

Four of the five are done and described above: the field vocabulary, the
`VIEWS` blurbs, the spend glosses, and the gate.

**The spend glosses** moved to
[`app/spend/spend-glosses.csv`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/app/spend/spend-glosses.csv),
23 rows with a `grain` column that had been a comment heading in the source and
could not survive into a payload. Making it a column is most of what moving the
table bought.

**The gate runs in both suites.** `text-carriers.py --check` is a step of home's
`tools/verify-artifacts.sh` and a node test here, and both pass. It gates two
classes and only two: an authored carrier nothing names, and a field name
nothing accounts for. An alias passes.

**The check that holds the migrations is generic**, not one per carrier.
[`verify-text-payloads.mjs`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/app/lineage/tools/verify-text-payloads.mjs)
declares nothing new: it reads `pipeline.csv` for which CSV feeds which payload,
`pages.csv` for which page loads it, and this vocabulary for which columns hold
prose. It found a third pair nobody had touched, and covers the next one without
being edited.

**Markdown is read now too**, which closes the gap this document used to name.
`--markdown` reports GFM tables as carriers, with two deliberate exemptions: a
table header is a phrase written for a reader rather than a field name a tool
reads, so headers report as `label` and are never gated; and a `.md` needs no
second file to vouch for it, so the naming check skips it. Both were found by
turning the gate on and watching it misfire.

What remains:

1. **Register, do not move.** The show-repo split is done. For everything else a
   row saying where the text is and who wrote it is worth more than relocating
   it, at a fraction of the cost.


# What the scan cannot see

Stated so the numbers are not read as more than they are.

- **Markdown prose outside a table is uncovered.** The carrier scan reads GFM
  tables under `--markdown`; body prose in a document is not a carrier and
  nothing here counts it.
- **A template literal that emits JavaScript** reads as prose to a word
  counter. The `inline` class filters the obvious cases and still leaks.
- **"Generated" is detected from a banner** in the first 800 bytes, or from a
  `mechanical`/`supplied` row in `content.csv`. A payload built without either
  reports as having no carrier, which is how the blog twin was found.
- **The field-name tally counts names, not meanings.** Two carriers using
  `note` for genuinely different things read as agreement here.
- **Consistency is not correctness.** Neither instrument says whether any of
  this text is true or current.


---

# Is it true? A read of six files, 2026-09-08

Every figure above measures how much prose there is and whether it has a
carrier. The closing limit of this document said the honest thing about that:
consistency is not correctness, and neither instrument says whether any of the
text is true. This section is the first pass at the other question, and it
changes what a gate should aim at.

Six files were read in full by three agents, two files each, sampling comment
blocks on a fixed stride and classifying every sampled block into one primary
category: **contract** (what a function, option or return is), **criterion** (a
condition or threshold that changes how the code must be edited), **history** (a
dated measurement, or the story of how a bug was found), **rationale at length**
(a legitimate why at several times the words its criterion needs),
**restatement**, **stale**, and **debris**. Each reader also checked six claims
per file against the code.

| File | Comment words | Share of lines | Cut outright | Move to a record |
| --- | --- | --- | --- | --- |
| `lib/kits/swipe-deck.js` | 8,088 | 60% | 1,300 to 1,800 | 900 to 1,300 |
| `lib/alpineComponents/stage.js` | 21,111 | 41% | 700 to 1,600 | 500 to 1,200 |
| `pages/toss-render.html` | 7,019 | 44% | 1,300 to 2,100 | 1,100 to 1,600 |
| `tools/render/cdn.mjs` | 1,376 | 34% | 100 to 180 | 220 to 320 |
| home `views/spend.js` | 9,572 | 27% | 2,800 to 3,600 | 500 to 1,150 |
| home `build-submittal.py` | 8,235 | 41% | 1,550 to 2,300 | 1,650 to 2,300 |

`stage.js` counts the 56 HTML comment blocks inside its Alpine template, which
the block definition used elsewhere in this document excludes. They are the same
prose in a different delimiter.

**The categories a cleanup would aim at are empty.** Restatement and debris
together were 1 to 3 percent of sampled words in every file, and one reader
found no commented-out line at all in 354 blocks. There is nothing here to tidy.
What could go is history and long rationale, and all of it is true, which is why
it is the harder kind to cut: the criterion is often the middle sentence rather
than the first, so a fast pass takes the load-bearing clause with the story
around it.

**Two defects did show up, and neither is length.**

*The file header is the least accurate prose in the file.* `swipe-deck.js`
documents fourteen options where the code reads twenty, and omits three keys
from the return it describes. `stage.js`'s header says a content-carrying `#gz=`
form is "a contemplated follow-up, not built here" while `mint` emits one.
`toss-render.html`'s header restates three arguments its own per-site comments
own, near verbatim, and the header copy is the one that went stale. The
40-to-249-word header essay is this codebase's convention and this document
defends it; the convention protects a header's length without gating its truth.

*A count inside a narrative goes stale with nothing to re-run it.*
`build-submittal.py` says "0 of 20" and "0 of 22" for two CSVs that now hold 15
and 32 rows, and derives a figure from them that is wrong by the same drift.
Across 36 claims checked, 28 held; every failure was one of these two shapes.

## What this adds to the gate

The split proposed above still stands, and one line moves. "Whether a comment is
too long in general" remains uncheckable and a ceiling would still misfire. But
a **dated claim** is checkable in the only sense that matters, which is that it
can be listed and re-read:

    python3 scripts/embedded-prose.py . lib pages app --dated

`--dated` lists every comment block asserting an ISO date, oldest first, marking
those carrying a figure beside the date, since a figure counts something that
moves while the sentence does not. web-tools' `lib`, `pages` and `app` hold 324
such blocks in 69 files, 132 of them carrying a figure; home's budget-drs,
local-models and tools hold 408 in 157 files, 213 with a figure. It is advisory
and not a gate, because a dated block is not a defect. It is a claim someone has
to re-check, and the report only says which and how old.

**Its limit is the honest half of the result.** Of the two stale counts found by
reading, `--dated` catches one. The other, at `build-submittal.py:1616`, says
"three of these cites are a README.md" where there are now eight, and carries no
date at all. An undated count is invisible to a dated report, and no instrument
here reaches it. So the report narrows the class rather than closing it, and
reading remains the only thing that found the header drift.


---

# The history the pilot moved out, 2026-09-08

The rewrite of four files ([PR #625](https://github.com/mehrlander/web-tools/pull/625))
removed 48 passages of history under the rule that a comment keeps its
criterion and sends the date, the measurement and the incident here. This is
where they went, filtered: a passage already held by a test or by another file
is not repeated, because a second copy is the thing this whole pass is against.

Dropped as already held, with what holds them: the 867px-track-in-a-430px-panel
regression and the three-link width chain
([`swipe-deck-width.test.mjs`](../tools/test/swipe-deck-width.test.mjs)); the
44px phone floor and `size:'tight'`
([`deck-entry-parity.test.mjs`](../tools/test/deck-entry-parity.test.mjs));
`--deck-head` and `--deck-side` (`app/index.html` sets them); the charset and
inline-deps findings (`toss-charset.mjs`, `toss-inline-deps.test.mjs`); the
slide-retention DOM counts (`swipe-deck-stack.test.mjs` and
[`branch-overlay.md`](branch-overlay.md)); the menu placement measurement, which
is now restored to the code as a criterion rather than moved.

**What a constant was measured against.** `DIM_SATURATE` and `DIM_ALPHA` in
`toss-render.html` were picked against real icons on a light and a dark tab
strip; alpha near 0.55 reads well on light and goes muddy on dark, and full
grayscale is unmistakable but discards the colour that makes an icon
recognizable. `INK_TIE` in the sibling budget-drs work came from the atlas's
rounder 0.3, which put white on this palette's blue and red where black carries
about 60 percent more contrast. `GZ_MAX` is 24k of base64 against Safari's
roughly 80k URL ceiling, and a 7 KB HTML paste encodes to about 2 KB.

**What was tried and rejected.** The deck's desktop panel was a centred card
(`max-w-4xl my-4 rounded-3xl`, border and shadow) until 2026-08-18; over
show-repo it floated across the sidebar, so chrome the reader still needed sat
under a card they had to dismiss. Its overlay was measured the same day as
computed `rgba(0,0,0,0)` with no background image, meaning every deck had been
transparent since it was written. The header pill cost about 64px of a 390px
row and truncated a filename to "flow-a...." beside a duplicate of the count
the footer already showed. `stage.js`'s reader was a centred dialog over a
scrim with hand-rolled touch and arrow keys until 2026-08-18, and sixty lines
of pointer handling went with it.

**Where a fix looked correct for a long time.** The deck's grid rows were
auto-placed rather than named, which is invisible while a slide's content is
taller than the panel and appeared only against the pdf module's continuous
column on 2026-08-25: the track measured 111px inside an 843px panel while the
footer took 667. Two branches each added a watcher named `paneWatch`; git
merged them cleanly into two `const paneWatch` in one scope and the file did
not parse, which is a clean textual merge producing a syntax error.

**Where a default was wrong rather than missing.** `stage.js` read only tab as
a delimiter until 2026-08-18, so a table pasted from Excel opened correctly and
the same data as CSV arrived as a wall of text. Its `dataUri` read `IMAGE_MIME`
until 2026-08-15, so a dropped PDF rendered as mojibake. Its offers bar listed
only leftovers until 2026-08-28, which made it read as an ADD list rather than
as what is available.

**One thing that shipped and was withdrawn.** A links extractor lived in the
stage for a day, first emitting `a[href]` as a two-column CSV and then as
markdown, before being removed; its leftovers were a `-links.md` example in the
peek path and a dead duplicate comment, both now gone.


---

# What the pilot taught about running the pass, 2026-09-08

The trim is the smaller finding. The larger one is about the operation, and it
is the reason the fan-out this pilot was meant to authorize should not run in
the shape that was proposed.

**A rewriter marking its own work is not evidence.** Each of the six agents
reported that it kept every criterion and removed only history. A second agent
per file, told only to find where the first was wrong, found eleven defects.
**Seven were claims the rewrite ADDED**, not text it lost. `swipe-deck.js` came
back stating a menu's flip condition backwards, in a file where no test
exercises that placement. `spend.js` hardened a hedge into "never the
all-biennia totals" against its own `budgetAll` branch fifteen lines below,
which shows exactly those totals; that item had been reported as one of its
fixes. `stage.js` declared a diff ceiling absent that its own code surfaces a
warning for. A false comment is worse than a verbose one, so a pass that trades
length for accuracy in this direction loses.

**And the mechanical check proves the wrong thing.** Stripping comments and
comparing the remainder shows the code is character-identical, which is true,
necessary, and reads as verification. It is the easy half. A comment cannot fail
it however false it becomes, so it certifies exactly the property that was never
at risk. Two of the six files also needed the check taught that HTML comments in
an Alpine template and CSS comments in a styles literal are string content to a
JavaScript lexer; without that it reported a difference on the two files most
likely to have been over-cut, which is the failure that looks like diligence.

**The cost changes accordingly.** The honest unit is a writer plus an adversary,
which is roughly double, and the adversary needs the same model as the writer,
since what it is looking for is a plausible sentence that happens to be false.
Against that, the four accuracy fixes to file headers and the five stale counts
were most of what the pass actually bought. **An accuracy pass that touches
nothing else, reading each header against its code and each figure against its
file, is a much cheaper operation than the trim and captures the larger share of
the value.** That is the version worth considering next, and
`embedded-prose.py --dated` already lists half its worklist.
