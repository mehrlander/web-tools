# The estate's pages: proposals

Proposed 2026-11-23 from [the pages map](../current/pages.md), whose terms these use. Each awaits the owner's decision.

## 1. Make the Tools view hold tools

The [Tools view](https://mehrlander.github.io/web-tools/app/?view=tools) lists every page a manifest declares: 64 pages, of which 15 are tools. [`docs/tools.csv`](../../../docs/tools.csv) picks five web-tools tools by hand and misses seven others.

**Recommended:** list only tools, read from the map's [`pages.csv`](../current/pages.csv) and [`page-jobs.csv`](../current/page-jobs.csv), and retire `tools.csv`. Each repository's [Pages view](https://mehrlander.github.io/web-tools/app/?view=pages) still lists all its pages. The alternative is to keep the list and rename the view.

## 2. Show products first in the gallery

Of the gallery's 123 pages, 46 are products.

**Recommended:** let the Pages view and [`pages/index.html`](../../../pages/index.html) sort by the standing in [`page-jobs.csv`](../current/page-jobs.csv).

## 3. Code the web-tools pages' jobs in coded.csv

[`coded.csv`](../../../data/ui-units/coded.csv), kept by the [Content program](../../content/README.md), codes the jobs of 20 of the map's 177 pages. `page-jobs.csv` judges the other 157.

**Recommended:** code the remaining web-tools product pages in `coded.csv`. Leave other repositories' pages in `page-jobs.csv`, because `coded.csv` covers web-tools only.

## 4. Undeclare the records

The Tools view still lists three record pages: wa-bills' [`LegislationTrackerUsingGitHub.html`](https://github.com/mehrlander/wa-bills/blob/main/wsl-api/data/LegislationTrackerUsingGitHub.html) and [`LegislationTrackerFresh.html`](https://github.com/mehrlander/wa-bills/blob/main/wsl-api/tools/LegislationTrackerFresh.html), and fn-data's [`fn-paste-join.html`](https://github.com/mehrlander/fn-data/blob/main/summaries/fn-paste-join.html).

**Recommended:** remove the three from their manifests' `pages` and leave the files in place.
