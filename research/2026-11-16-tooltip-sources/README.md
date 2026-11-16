# Where tooltip text comes from

**Question.** Can every tooltip be treated as data: specified one way, reviewed in one table, with how and by whom its text was written shown beside it? The test was to list every tooltip in web-tools and mehrlander/budget-drs and see what the list shows and what it cannot show.

**What was tried.** [`scan.py`](scan.py) reads each `.html` and `.js` file in scope and records one row per tooltip: the house title-tip (`data-title-tip`, bound or assigned in a script), a `title` attribute, or daisyUI's `data-tip`. For each row it records the text, or the expression that makes it. With `--provenance` it adds the oldest commit in which `git log -S` sees those words enter the file, that commit's agent and session, and what `git blame` names for the line. The run covered web-tools at `2668629` (`app/index.html`, `lib/alpineComponents/`, `lib/kits/`, `pages/`, demos excluded) and budget-drs at `b22f0a2` (`app/`, less pipeline outputs, `tools/` folders and `app/workshop/`). budget-drs's own table of the same rows, with its data cells, is `data/design/catalog/tooltips.csv`, browsable in its Data view. The [diagram](diagram.html) draws the findings.

## Findings

**Tooltip text comes from three places.** A tooltip is a way of showing text, not a kind of text, and its words arrive by one of three routes.

| Source | What it is | web-tools | budget-drs |
| --- | --- | --- | --- |
| Borrowed from data | A prose cell of a committed data file that a page shows as a tooltip, such as a tab's note in `view-tabs.csv` | not traced | 223 cells, from five columns of four files |
| Written for the tooltip | Fixed words in markup, a script or a constant | 461 | 77 |
| Built at runtime | Fixed words around a slot, such as "Scope to {…}" | 156 | 52 |
| Computed, not yet traced | A field, a call or a conditional: either borrowed from data or a readout with no authored words | 438 | 134 |

The last row is the limit of a mechanical scan. `t.gloss` reads text someone wrote for a registry; `newer ? newerCount : null` reads state. Telling them apart means tracing each expression to what it reads.

**Borrowed text belongs to its source.** A gloss is keyed by its subject and often appears somewhere besides a tooltip: budget-drs's view premise is also the phone's info card. A table of tooltips should point at the source's `path#column`, not hold a second copy. The one copy in this run shows why: budget-drs's `app/spend/spend-glosses.csv` reaches a payload the Spend view loads, while `spend.js` renders the sankey glosses from its own `SPEND_GLOSS` constant and nothing reads the payload. Both checks over the file pass, because they test that the payload is built and loaded, not that it is read.

**`git blame` names the conversion, not the writing.** For web-tools, `git log -S` finds the commit that introduced the words for 1,042 of 1,055 tooltips, and blame names that same commit for 244. Most of the rest point at three conversion sweeps: 389 at "App: replace every title attribute with a title-tip", 151 at "Convert the remaining title tooltips under pages/ and lib/ to title-tips" and 99 at "Rename the popups: note becomes title-tip, card becomes panel-tip". budget-drs is the same in smaller numbers: 243 found, 115 agreeing, 44 pointing at "budget-drs: switch to title-tip and panel-tip". The introducing commit carries a claude.ai session for 791 web-tools tooltips. Git records a commit, a date, an agent and a session; who chose the words is in the session's prompts, which git does not hold.

**Markup offers no stable key.** A row's name has to come from its file and its words. In a first pass over web-tools at `00913fc`, 273 of 1,054 tooltips sat on an element with a durable name such as an `aria-label`, `data-part` or `x-ref`, so a key that survives a refactor exists only once text moves into a data file, as budget-drs's four files already show.

## Standing

Mixed. Every tooltip can be listed and reviewed in one table, and doing so found a defect two checks miss. Writing every tooltip in one table does not hold: borrowed text has an owner already, readouts have no authored words, and a control's label is reviewed as well in place. The plan that follows from this, in budget-drs first and then here, is to keep the list generated, point borrowed rows at their source, and move tooltip-only text into data only where a group of it is worth moving.

