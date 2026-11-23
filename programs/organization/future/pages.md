# The estate's pages: proposals

This future-state map was proposed on 2026-11-23, from [the current-state map of the estate's pages](../current/pages.md). The estate is the owner's repositories and everything in them. Standing, job and tool have the meanings under that map's [Terms](../current/pages.md#terms). None of the proposals is adopted. Each ends in a decision for the owner, with a recommendation.

## 1. Make the Tools view hold tools

**What the map shows.** The [Tools view](https://mehrlander.github.io/web-tools/app/?view=tools) lists every page a manifest declares: 64 pages, of which 15 are tools. [`docs/tools.csv`](../../../docs/tools.csv) gives five web-tools pages a utility icon. Seven other web-tools pages are tools: [`annotate`](../../../pages/annotate.html), [`dictate`](../../../pages/dictate.html), [`gist-editor`](../../../pages/gist-editor.html), [`launcher`](../../../pages/launcher.html), [`links`](../../../pages/links.html), [`reception`](../../../pages/reception.html) and [`xlsx-picker`](../../../pages/xlsx-picker.html).

**The change.** List only the tools in the Tools view. Each repository's [Pages view](https://mehrlander.github.io/web-tools/app/?view=pages) still lists every page it declares. The alternative is to keep the list and rename the view for what it holds.

**The decision.** Recommended: list only the tools, and retire `tools.csv` once the Tools view reads the tool test from the map, because the test then selects what `tools.csv` selects by hand.

## 2. Show products first in the gallery

**What the map shows.** The gallery, [`pages/pages.csv`](../../../pages/pages.csv), lists all 123 HTML files under [`pages/`](../../../pages/), [`lib/kits/demos/`](../../../lib/kits/demos/) and the skill folders' `demo.html` files. Of those, 46 are products. The rest are exhibits, experiments, services and one record.

**The change.** Let the [Pages view](https://mehrlander.github.io/web-tools/app/?view=pages) and [`pages/index.html`](../../../pages/index.html) filter by standing, read from [`page-jobs.csv`](../current/page-jobs.csv), and show the products first.

**The decision.** Recommended: let the app read `page-jobs.csv`, a declared registry, because the gallery's file is generated whole and cannot hold a judgment written by hand.

## 3. Give every page its job in one place

**What the map shows.** [`coded.csv`](../../../data/ui-units/coded.csv), which the [Content program](../../content/README.md) keeps, codes the jobs of 20 of the map's 177 pages. [`page-jobs.csv`](../current/page-jobs.csv) judges the rest. For 36 of those, the judgment read only a one-line note or the page's name. Their `basis` column says which.

**The change.** Code each web-tools product page in `coded.csv` until every one has a row. Blank each page's job in `page-jobs.csv` when `coded.csv` codes it; [`pages-map.mjs --check`](../current/pages-map.mjs) fails until that is done.

**The decision.** Recommended: code the web-tools product pages and leave other repositories' pages in `page-jobs.csv`, because every unit `coded.csv` codes is a web-tools unit.

## 4. Retire the records

**What the map shows.** Four pages have the standing record. One is [`delivery.html`](../../../pages/delivery.html) in web-tools. Two are earlier legislation trackers in [wa-bills](https://github.com/mehrlander/wa-bills). Their notes call them cleanup candidates. The fourth is the paste-join page in [fn-data](https://github.com/mehrlander/fn-data). Its note calls it provenance only. The three outside web-tools are still declared, so the Tools view lists them.

**The change.** Remove the three declarations from their manifests' `pages`. The files stay where they are.

**The decision.** Recommended: remove the three declarations and keep `delivery.html` in the gallery, because the gallery lists what the tree holds and a record still belongs there.
