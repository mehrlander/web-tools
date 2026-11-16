# Where tooltip text comes from

**Question.** Can every tooltip be treated as data: specified one way, reviewed in one table, with how and by whom its text was written shown beside it? The question has three parts, answered in turn below: where each tooltip's words come from, what git can say about who wrote them, and what could name a tooltip so its row survives a change to the markup around it.

## What was tried

- [`scan.py`](scan.py) reads each `.html` and `.js` file in scope and records one row per tooltip: the house title-tip ([`data-title-tip`](../../lib/kits/title-tip.js), written in markup, bound by Alpine or set in a script), a `title` attribute, or daisyUI's `data-tip`. Each row holds the tooltip's words, or the expression that makes them. With `--provenance`, each row also gets the oldest commit in which `git log -S` sees those words enter the file, that commit's agent and claude.ai session, and the commit `git blame` names for the line.
- [`trace.py`](trace.py) sorts the rows whose text is computed by what the expression reads.
- Scope in web-tools, at [`2668629`](https://github.com/mehrlander/web-tools/commit/2668629f1): `app/index.html`, `lib/alpineComponents/`, `lib/kits/` and `pages/`, without demos.
- Scope in budget-drs, at [`52b1b30`](https://github.com/mehrlander/budget-drs/commit/52b1b30a): `app/`, without generated payloads, `tools/` folders and the dated records in `app/workshop/`. budget-drs's own [`tooltips.csv`](https://github.com/mehrlander/budget-drs/blob/claude/amazing-turing-e0yl7d/data/design/catalog/tooltips.csv) holds the same rows plus its data-file cells and two kinds of hover card, browsable in its Data view ([budget-drs#27](https://github.com/mehrlander/budget-drs/pull/27)).
- The [diagram](diagram.html) draws the findings.

## Where the words come from

A tooltip's words arrive by one of three routes, and a fourth row holds what a scan alone cannot place. Each name is followed by the `form` value budget-drs's table uses for it. Counts are tooltips.

| Route | What it is | web-tools | budget-drs |
| --- | --- | --- | --- |
| From a data file (`data-cell`) | A prose cell of a committed data file that a page shows as a tooltip, such as a tab's note in [`view-tabs.csv`](https://github.com/mehrlander/budget-drs/blob/main/data/design/view-tabs.csv) | none declared | 223 |
| Written for the tooltip (`literal`) | Fixed words in markup or a script | 461 | 77 |
| Built at runtime (`template`) | Fixed words around a value filled in at runtime, such as "Scope to {…}" | 164 | 52 |
| Computed (`expression`) | A value computed at runtime, sorted below | 430 | 134 |
| **Total** | | **1,055** | **486** |

web-tools declares no data-file cells because its pages read their data at runtime, so text from a data file appears there among the computed rows. `trace.py` sorts those rows by the names the expression reads:

| Computed, by what it reads | Example | web-tools | budget-drs |
| --- | --- | --- | --- |
| Fixed words chosen by a condition | `open ? 'Hide the sidebar' : 'Show the sidebar'` | 77 | 7 |
| A field or function named for written text (`gloss`, `note`, `tip`, `hint`, `why` and similar) | `t.gloss`, `TIPS.gap` | 138 | 47 |
| A name or value (`label`, `title`, `path`, `repo` and similar) | `it.label` | 97 | 21 |
| A count, a number or an error message | `newer ? newerCount : null` | 27 | 2 |
| Not sorted | `sel`, `status` | 91 | 57 |

The sort reads identifiers, not what they hold. In a hand check of 30 web-tools rows from a first run, every one of the 22 rows it sorted matched a reading of the code, and 3 of the 8 it left unsorted could have been placed. The budget-drs unsorted count includes its 17 hover-card and sankey-card calls, which `scan.py` does not read. Written text is not necessarily in a data file: `TIPS.gap` reads a table in `usage.js`, and `fileTip(...)` is a function.

One copy shows why a table of tooltips should point at a data file rather than repeat it. budget-drs's [`spend-glosses.csv`](https://github.com/mehrlander/budget-drs/blob/main/app/spend/spend-glosses.csv) is built into `glosses-data.js`, which the app loads, while [`spend.js`](https://github.com/mehrlander/budget-drs/blob/main/app/view/views/spend.js) shows the sankey's glosses from its own `SPEND_GLOSS` constant. `build-spend-glosses.py` and `verify-text-payloads.mjs` both pass, because they check that the generated file is built and loaded, not that anything reads it.

## Who wrote the words

`git blame` names the last commit that touched a line. Both repositories converted their tooltips from `title` attributes to `data-title-tip` in a few large commits that changed the attribute and kept the words; here such a commit is a conversion. For most tooltips, blame names the conversion.

| | web-tools | budget-drs |
| --- | --- | --- |
| Tooltips scanned | 1,055 | 246 |
| `git log -S` finds the commit that introduced the words | 1,042 | 243 |
| `git blame` names that same commit | 244 | 115 |
| `git blame` names a conversion | 682 | 44 |
| `git blame` names another later commit | 116 | 84 |
| The introducing commit names a claude.ai session | 791 | 216 |

The largest conversions are [`fdb397b`](https://github.com/mehrlander/web-tools/commit/fdb397b27) "App: replace every title attribute with a title-tip" (389), [`744e0a4`](https://github.com/mehrlander/web-tools/commit/744e0a42a) "Convert the remaining title tooltips under pages/ and lib/ to title-tips" (151), [`360ca91`](https://github.com/mehrlander/web-tools/commit/360ca91f3) "Rename the popups" (99) and, in budget-drs, [`17a8e90`](https://github.com/mehrlander/budget-drs/commit/17a8e90be) "switch to title-tip and panel-tip" (44). Git holds the introducing commit, its date, its Co-Authored-By agent and its session. Who chose the words is in that session's prompts, which git does not hold.

## What could name a tooltip

A row's name has to survive markup changing around it. In this run, 278 of 1,055 web-tools tooltips and 63 of 246 budget-drs tooltips have an `aria-label`, `data-part`, `x-ref`, `data-nav` or `id` within two lines, a name that could survive. budget-drs's four data files name each text by its subject instead: a view, a tab, a filter or a sankey node.

## Standing

Mixed. Every tooltip in scope can be listed in one table, as budget-drs's now is. Writing every tooltip in one table does not hold: text from a data file is already held by that file, counts and states have no written words, and a control's label can be reviewed where it is written.
