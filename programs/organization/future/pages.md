# The estate's pages: proposals

This future-state map was proposed on 2026-11-23, from [the current-state map of the estate's pages](../current/pages.md), and its counts are of that date. The estate, a catalogue, a manifest, standing (product, service, exhibit, experiment or record), job and tool mean what that map's opening, [Catalogues](../current/pages.md#catalogues) and [Terms](../current/pages.md#terms) say. Each proposal awaits the owner's decision.

## 1. Make the Tools view hold tools

**What the map shows.** The [Tools view](https://mehrlander.github.io/web-tools/app/?view=tools) lists every page that a repository's [`.web-tools.json`](../../../docs/manifest.md) declares under `pages`. That is 64 pages, and 15 of them are tools; the map's generated Tools list names every tool. [`tools.csv`](../../../docs/tools.csv) gives five web-tools pages a utility icon. Seven other web-tools pages are tools: [`annotate`](../../../pages/annotate.html), [`dictate`](../../../pages/dictate.html), [`gist-editor`](../../../pages/gist-editor.html), [`launcher`](../../../pages/launcher.html), [`links`](../../../pages/links.html), [`reception`](../../../pages/reception.html) and [`xlsx-picker`](../../../pages/xlsx-picker.html).

**Recommended.** List only the tools in the Tools view, read from the map. Each repository's [Pages view](https://mehrlander.github.io/web-tools/app/?view=pages) still lists every page it declares. [`tools.csv`](../../../docs/tools.csv) would then repeat by hand what the map selects, so retire it once the view reads the map.

**The alternative.** Keep the list, and rename the view for what it holds.

## 2. Show products first in the gallery

**What the map shows.** The gallery, [`pages/pages.csv`](../../../pages/pages.csv), lists all 123 HTML files under [`pages/`](../../../pages/), [`lib/kits/demos/`](../../../lib/kits/demos/) and the `demo.html` files in the folders under [`skills/`](../../../skills/). Of those, 46 are products. The rest are exhibits, experiments, services and one record.

**Recommended.** Let the [Pages view](https://mehrlander.github.io/web-tools/app/?view=pages) and [`pages/index.html`](../../../pages/index.html) filter by standing, read from [`page-jobs.csv`](../current/page-jobs.csv), a declared registry, and show the products first. The gallery's generator rewrites its own file whole, which would overwrite a judgment written there by hand.

**The alternative.** Leave the gallery in path order.

## 3. Give every page its job in one place

**What the map shows.** [`coded.csv`](../../../data/ui-units/coded.csv), which the [Content program](../../content/README.md) keeps, codes the jobs of 20 of the map's 177 pages. [`page-jobs.csv`](../current/page-jobs.csv) judges the rest. For 36 of those pages, the judgment read only a one-line note or the page's name, as the `basis` column of [`page-jobs.csv`](../current/page-jobs.csv) records.

**Recommended.** Code each web-tools product page in [`coded.csv`](../../../data/ui-units/coded.csv) until every one has a row, and leave other repositories' pages in [`page-jobs.csv`](../current/page-jobs.csv). Every unit [`coded.csv`](../../../data/ui-units/coded.csv) codes is a web-tools unit. When [`coded.csv`](../../../data/ui-units/coded.csv) codes a page, blank its job in [`page-jobs.csv`](../current/page-jobs.csv); [`pages-map.mjs --check`](../current/pages-map.mjs) fails until that is done.

**The alternative.** Keep the jobs of uncoded pages in [`page-jobs.csv`](../current/page-jobs.csv) indefinitely.

## 4. Undeclare the records

**What the map shows.** Four pages have the standing record. One is [`delivery.html`](../../../pages/delivery.html) in web-tools. Two are earlier legislation trackers in wa-bills, [`LegislationTrackerUsingGitHub.html`](https://github.com/mehrlander/wa-bills/blob/main/wsl-api/data/LegislationTrackerUsingGitHub.html) and [`LegislationTrackerFresh.html`](https://github.com/mehrlander/wa-bills/blob/main/wsl-api/tools/LegislationTrackerFresh.html). Their notes call them cleanup candidates. The fourth is fn-data's [`fn-paste-join.html`](https://github.com/mehrlander/fn-data/blob/main/summaries/fn-paste-join.html). Its note calls it provenance only. The three outside web-tools are still declared, and the Tools view lists them.

**Recommended.** Remove the three declarations from the `pages` lists of [wa-bills' `.web-tools.json`](https://github.com/mehrlander/wa-bills/blob/main/.web-tools.json) and [fn-data's](https://github.com/mehrlander/fn-data/blob/main/.web-tools.json), and leave the files where they are. Keep [`delivery.html`](../../../pages/delivery.html) in the gallery, which lists every HTML file under [`pages/`](../../../pages/), records included.

**The alternative.** Leave the declarations as they are.
