# The estate's pages: proposals

This future-state map was proposed on 2026-11-23, from [the current-state map of the estate's pages](../current/pages.md). Each proposal names what the map shows, the change, and the decision it needs from the owner. None is adopted; an adopted one leaves this file once its change lands, and the map then shows the result.

## 1. Make the Tools view hold tools

**What the map shows.** The [Tools view](https://mehrlander.github.io/web-tools/app/?view=tools) lists every page a manifest declares. Most of those pages are not tools by the map's test (a product page whose job includes make): they are explorers, follow pages and respond forms. [`docs/tools.csv`](../../../docs/tools.csv) names five hub utilities, and seven other gallery pages meet the test: `annotate`, `dictate`, `gist-editor`, `launcher`, `links`, `reception` and `xlsx-picker`.

**The change.** Either list in the Tools view only the pages that meet the test, leaving every declared page to each repository's Pages view, or rename the view for what it lists.

**The decision.** Which of the two, and whether `tools.csv` then selects by the test or is retired.

## 2. Separate the gallery's exhibits and experiments

**What the map shows.** The gallery lists every HTML file under `pages/`, so kit demos, drops and scratch pages sit beside the products. In web-tools, product pages are fewer than half of the gallery's rows.

**The change.** Let the Pages view and `pages/index.html` filter by standing, read from [`page-jobs.csv`](../current/page-jobs.csv), with products shown first.

**The decision.** Whether an app view may read a file the Organization program keeps, or standing should move to a registry the gallery's generator owns.

## 3. Give every page its job in one place

**What the map shows.** [`coded.csv`](../../../data/ui-units/coded.csv), which the Content program keeps, codes the jobs of a minority of the pages. `page-jobs.csv` judges the rest, some from a one-line note alone (`basis` reads `note` or `name`).

**The change.** Code the remaining product pages in `coded.csv` over time, blanking each one's job in `page-jobs.csv` as it is coded, which the map's check already requires.

**The decision.** Whether the UI units catalogue is meant to cover every product page, including pages in other repositories.

## 4. Retire the records

**What the map shows.** Four pages have the standing record: `delivery.html` in web-tools, two earlier legislation trackers in wa-bills that their notes call cleanup candidates, and fn-data's paste-join page, which its note calls provenance only. The three outside web-tools are still declared, so the Tools view lists them.

**The change.** Remove each from its manifest's `pages`, or move it to an archive folder.

**The decision.** Per page, whether it goes.
