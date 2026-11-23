# The estate's pages: proposals

This future-state map was proposed on 2026-11-23, from [the current-state map of the estate's pages](../current/pages.md). Its counts are as of that date. The estate, a catalogue, a manifest, standing, job and tool have the meanings that map gives them in its opening, its [Catalogues](../current/pages.md#catalogues) and its [Terms](../current/pages.md#terms). None of the proposals is adopted. Each ends in a decision for the owner, with a recommendation.

## 1. Make the Tools view hold tools

**What the map shows.** The [Tools view](https://mehrlander.github.io/web-tools/app/?view=tools) lists every page that a repository's `.web-tools.json` declares under `pages` ([web-tools' own](../../../.web-tools.json) is one): 64 pages, of which 15 are tools as the map defines a tool. The map's generated Tools list names every tool. [`docs/tools.csv`](../../../docs/tools.csv) gives five web-tools pages a utility icon. Seven other web-tools pages are tools: [`annotate`](../../../pages/annotate.html), [`dictate`](../../../pages/dictate.html), [`gist-editor`](../../../pages/gist-editor.html), [`launcher`](../../../pages/launcher.html), [`links`](../../../pages/links.html), [`reception`](../../../pages/reception.html) and [`xlsx-picker`](../../../pages/xlsx-picker.html).

**The change.** List only the tools in the Tools view. Each repository's [Pages view](https://mehrlander.github.io/web-tools/app/?view=pages) still lists every page it declares. The alternative is to keep the list and rename the view for what it holds.

**The decision.** Recommended: list only the tools. Then retire [`tools.csv`](../../../docs/tools.csv) once the Tools view reads, from the map, which pages are tools. The map would then select what [`tools.csv`](../../../docs/tools.csv) selects by hand.

## 2. Show products first in the gallery

**What the map shows.** The gallery, [`pages/pages.csv`](../../../pages/pages.csv), lists all 123 HTML files under [`pages/`](../../../pages/), [`lib/kits/demos/`](../../../lib/kits/demos/) and the `demo.html` files in the folders under [`skills/`](../../../skills/). Of those, 46 are products. The rest are exhibits, experiments, services and one record.

**The change.** Let the [Pages view](https://mehrlander.github.io/web-tools/app/?view=pages) and [`pages/index.html`](../../../pages/index.html) filter by standing, read from [`page-jobs.csv`](../current/page-jobs.csv), and show the products first.

**The decision.** Recommended: let the app read [`page-jobs.csv`](../current/page-jobs.csv), a declared registry. The gallery's generator rewrites its file whole. A judgment written by hand would not survive the next run.

## 3. Give every page its job in one place

**What the map shows.** [`coded.csv`](../../../data/ui-units/coded.csv), which the [Content program](../../content/README.md) keeps, codes the jobs of 20 of the map's 177 pages. [`page-jobs.csv`](../current/page-jobs.csv) judges the rest. For 36 of those pages, the judgment read only a one-line note or the page's name, as the `basis` column of [`page-jobs.csv`](../current/page-jobs.csv) records.

**The change.** Code each web-tools product page in [`coded.csv`](../../../data/ui-units/coded.csv) until every one has a row. Blank each page's job in [`page-jobs.csv`](../current/page-jobs.csv) when [`coded.csv`](../../../data/ui-units/coded.csv) codes it; [`pages-map.mjs --check`](../current/pages-map.mjs) fails until that is done.

**The decision.** Recommended: code the web-tools product pages, and leave other repositories' pages in [`page-jobs.csv`](../current/page-jobs.csv). Every unit [`coded.csv`](../../../data/ui-units/coded.csv) codes is a web-tools unit.

## 4. Retire the records

**What the map shows.** Four pages have the standing record. One is [`delivery.html`](../../../pages/delivery.html) in web-tools. Two are earlier legislation trackers in wa-bills, [`LegislationTrackerUsingGitHub.html`](https://github.com/mehrlander/wa-bills/blob/main/wsl-api/data/LegislationTrackerUsingGitHub.html) and [`LegislationTrackerFresh.html`](https://github.com/mehrlander/wa-bills/blob/main/wsl-api/tools/LegislationTrackerFresh.html). Their notes call them cleanup candidates. The fourth is fn-data's [`fn-paste-join.html`](https://github.com/mehrlander/fn-data/blob/main/summaries/fn-paste-join.html). Its note calls it provenance only. The three outside web-tools are still declared. The Tools view lists them.

**The change.** Remove the three declarations from the `pages` lists of [wa-bills' `.web-tools.json`](https://github.com/mehrlander/wa-bills/blob/main/.web-tools.json) and [fn-data's](https://github.com/mehrlander/fn-data/blob/main/.web-tools.json). The files stay where they are.

**The decision.** Recommended: remove the three declarations, and keep [`delivery.html`](../../../pages/delivery.html) in the gallery. The gallery lists every HTML file under `pages/`, records included.
