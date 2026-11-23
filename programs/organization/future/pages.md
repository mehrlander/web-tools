# The estate's pages: proposals

This future-state map was proposed on 2026-11-23, from [the current-state map of the estate's pages](../current/pages.md). Standing, job and tool carry the meanings under that map's [Terms](../current/pages.md#terms). Each proposal names what the map shows, the change, and the decision it needs from the owner. None is adopted.

## 1. Make the Tools view hold tools

**What the map shows.** The [Tools view](https://mehrlander.github.io/web-tools/app/?view=tools) lists every page a manifest declares: 64 pages, of which 15 are tools. [`docs/tools.csv`](../../../docs/tools.csv) gives five web-tools pages a utility icon. Seven other web-tools pages are tools: [`annotate`](../../../pages/annotate.html), [`dictate`](../../../pages/dictate.html), [`gist-editor`](../../../pages/gist-editor.html), [`launcher`](../../../pages/launcher.html), [`links`](../../../pages/links.html), [`reception`](../../../pages/reception.html) and [`xlsx-picker`](../../../pages/xlsx-picker.html).

**The change.** Either list in the Tools view only the tools, leaving every declared page to each repository's Pages view, or rename the view for what it lists.

**The decision.** Which of the two, and whether `tools.csv` then lists the tools or is retired.

## 2. Show products first in the gallery

**What the map shows.** The gallery, [`pages/pages.csv`](../../../pages/pages.csv), lists all 123 HTML files under `pages/`, `lib/kits/demos/` and `skills/*/demo.html`. Of those, 46 are products. The rest are exhibits, experiments, services and one record.

**The change.** Let the Pages view and [`pages/index.html`](../../../pages/index.html) filter by standing, read from [`page-jobs.csv`](../current/page-jobs.csv), and show the products first.

**The decision.** Whether an app view may read a file the Organization program keeps, or standing should move to a registry the gallery's generator owns.

## 3. Give every page its job in one place

**What the map shows.** [`coded.csv`](../../../data/ui-units/coded.csv), which the Content program keeps, codes the jobs of 20 of the map's 177 pages. [`page-jobs.csv`](../current/page-jobs.csv) judges the rest. For 36 of those, the judgment read only a one-line note or the page's name, and its `basis` column says so.

**The change.** Code the remaining product pages in `coded.csv` over time. Blank each page's job in `page-jobs.csv` when `coded.csv` codes it; [`pages-map.mjs --check`](../current/pages-map.mjs) fails until that is done.

**The decision.** Whether the UI codebook should cover every product page, including the pages in other repositories.

## 4. Retire the records

**What the map shows.** Four pages have the standing record. One is [`delivery.html`](../../../pages/delivery.html) in web-tools. Two are earlier legislation trackers in [wa-bills](https://github.com/mehrlander/wa-bills), which their notes call cleanup candidates. The fourth is the paste-join page in [fn-data](https://github.com/mehrlander/fn-data), which its note calls provenance only. The three outside web-tools are still declared, so the Tools view lists them.

**The change.** Remove each from its manifest's `pages`, or move it to an archive folder.

**The decision.** For each page, whether it goes.
