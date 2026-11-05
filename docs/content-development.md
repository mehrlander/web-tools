# Content development

How a piece of content moves from notes or gathered pages toward an app view,
and when each move is worth its upkeep. It is for a session deciding whether to
extract a table, build a page, or bring a page into an app. Each rule it cites
is owned by the document linked beside it. The worked examples are in
[`data/content-development/`](../data/content-development/README.md).

## Two scales

A piece of content has a position on two scales, defined in
[`scales.csv`](../data/content-development/scales.csv):

- **Held as:** prose, records, records with a check, records with a gold set.
- **Shown in:** a file, a page, a page framed in an app, an app view.

The scales move separately. The budget-drs app frames two pages from home side
by side as appendices, pages it shows but does not own: the
[information landscape](https://github.com/mehrlander/home/blob/main/projects/wa-budget-landscape/display/explorer.html),
an index of excerpts from Markdown pages, and
[pension systems](https://github.com/mehrlander/home/blob/main/projects/pension-landscape/display/explorer.html), rows
whose every quote a check finds in its source. Both are shown in the same place
and held very differently.

One rule ties the scales: what a page or app view shows rests on records a
check holds. Home states it as structured stages, "data before display"
([`CLAUDE.md`, Conventions](https://github.com/mehrlander/home/blob/main/CLAUDE.md#conventions)). Prose framed in an app with no records beneath it breaks the
rule.

## When to move

| Move | Worth making when | Rule owned by |
| --- | --- | --- |
| Prose to records | a fact is reused, compared, joined, or must be kept current | home [`favoring-the-mechanical`](https://github.com/mehrlander/home/blob/main/created/2026-07-03-favoring-the-mechanical.md); [`text-content.md`](text-content.md) |
| Records to records with a check | anything displays them; the check lands in the same change | home [`CLAUDE.md`, Conventions](https://github.com/mehrlander/home/blob/main/CLAUDE.md#conventions), structured stages |
| Check to gold set | the question is whether the records are right, not whether the display matches them | the [`gold-set`](../skills/gold-set/SKILL.md) skill |
| File to page | a reader needs a comparison the file cannot give | the [`html-style`](../skills/html-style/SKILL.md#a-page-is-for-comparing) skill, "A page is for comparing" |
| Page to framed in an app | an app's reader needs a page whose subject the app does not own (an appendix) | budget-drs [`app/view/README.md`, Appendix views](https://github.com/mehrlander/home/blob/main/projects/budget-drs/app/view/README.md#appendix-views) |
| Framed to app view | the app must hold the content, not only reach it: import a copy into its own sources, with a record of where it came from | budget-drs [`app/view/README.md`, Appendix views](https://github.com/mehrlander/home/blob/main/projects/budget-drs/app/view/README.md#appendix-views), "Reaching is not holding" |
| Page to Web Tools app view | a repository's page deserves its own stop in the Web Tools app | [`APP.md`](APP.md); [`manifest.md`](manifest.md), `appView` |

## When to stop, or move back

Every move adds something to keep current: a builder, a check, a generated
data file, a page. Make a move only when it earns that cost. Several documents already state
where to stop:

- A thing gets a view of its own only when it has facts beyond its name or
  relations to more than one other thing (the earned-view rule,
  [minimal progressive structure](../research/minimal-progressive-structure/theory.md)).
- [`TRACKER.md`](TRACKER.md) recognizes a tag by graduation, not anticipation;
  the same test fits a table.
- A question asked once a cycle can keep its CSV with no view (budget-drs
  [`pension-sections-proposal.md`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/app/view/pension-sections-proposal.md)).

Moves also run back. In the
[worked examples](https://mehrlander.github.io/web-tools/app/?view=map&tab=development),
the Contracts view was retired and
its statewide page returned two days later as an appendix, the CORE throughline
view was retired with its detail kept in a Markdown file, and the pension catalog
left a tab of the Benefits view for an appendix of its own.
