# The estate's pages

The estate is the owner's repositories and everything in them.

This map answers four questions about the estate's HTML pages:

1. What is each page, and is it a tool?
2. How does it relate to the Web Tools app?
3. Is it public, and does its source name a private repository?
4. Which catalogues list it?

A catalogue here is a file that lists pages; each is under [Catalogues](#catalogues). The map covers every page that at least one of them names. The [Tools view](https://mehrlander.github.io/web-tools/app/?view=tools)'s **Find undeclared** button lists the HTML files that none of them names.

## Files

| File | Holds | Written by |
| --- | --- | --- |
| [`pages.csv`](pages.csv) | the measured facts, one row per page | [`pages-map.mjs`](pages-map.mjs), from the catalogues, the app's code, the source of each page in a public repository, and GitHub's list of public repositories |
| [`page-jobs.csv`](page-jobs.csv) | each page's standing and job | hand |

Run as `node programs/organization/current/pages-map.mjs`, [`pages-map.mjs`](pages-map.mjs) rewrites [`pages.csv`](pages.csv) and the generated blocks of this document. With `--check`, it reports what is stale instead. The check also fails when [`page-jobs.csv`](page-jobs.csv) lacks a row for a page or breaks a rule under [Terms](#terms).

The script, run either way, reads two kinds of checkout beside the web-tools checkout it runs in:

- [web-tools-private](https://github.com/mehrlander/web-tools-private), whose [`state/configs.json`](https://github.com/mehrlander/web-tools-private/blob/main/state/configs.json) holds the app's copy of every repository's [`.web-tools.json`](../../../docs/manifest.md);
- a clone of each other public repository that declares pages, whose page sources the script reads.

## Catalogues

| Catalogue | File | Lists | The app shows it in |
| --- | --- | --- | --- |
| gallery | [`pages/pages.csv`](../../../pages/pages.csv) | every page under [`pages/`](../../../pages/); every page under [`lib/kits/demos/`](../../../lib/kits/demos/); and each skill's `demo.html` under [`skills/`](../../../skills/) | the [Pages view](https://mehrlander.github.io/web-tools/app/?view=pages) of web-tools, and [`pages/index.html`](../../../pages/index.html) |
| manifest | `pages` in each repository's [`.web-tools.json`](../../../docs/manifest.md), as in [web-tools' own manifest](../../../.web-tools.json) | the pages a repository declares, its own or another repository's | the [Tools view](https://mehrlander.github.io/web-tools/app/?view=tools), the repository's [Pages view](https://mehrlander.github.io/web-tools/app/?view=pages), and the sidebar, for an entry that sets the app-view flag [`appView`](../../../docs/manifest-fields.csv) |
| landing | `projects[].landing` in each [`.web-tools.json`](../../../docs/manifest.md) | a project's front page | the [Project view](https://mehrlander.github.io/web-tools/app/?view=project)'s App tab |
| utilities | [`docs/tools.csv`](../../../docs/tools.csv) | the web-tools pages the Tools view lists as utilities, with their icons | the [Tools view](https://mehrlander.github.io/web-tools/app/?view=tools), in the web-tools group |
| units | [`data/ui-units/coded.csv`](../../../data/ui-units/coded.csv) | the pages the [UI codebook](../../../data/ui-units/codebook.md) codes, each with its jobs | the Map view's [Units tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=units) |
| forms | [`docs/forms/README.md`](../../../docs/forms/README.md) | the pages it names as forms | the Map view's [Forms tab](https://mehrlander.github.io/web-tools/app/?view=map&tab=forms) |

## Terms

**Relation to the app**, the `app` column of [`pages.csv`](pages.csv), takes the first of these that holds:

<!-- pages-map:app -->
| Value | The page |
| --- | --- |
| view | is marked `appView` in a manifest or is a project's landing; the app shows it inside its own frame as a destination |
| full-app | is marked `fullApp`: it brings its own header and navigation and opens outside the app |
| framed | is named in the `files` of a row of `docs/app-routes.csv`, as `pages/repo-atlas.html` draws the Atlas view and `pages/toss-render.html` renders every app view |
| linked | is named by a line of code in `app/index.html` or `lib/`, comment lines and demo folders excepted |
| standalone | meets none of these: the app reaches it only through a catalogue listing |
<!-- /pages-map:app -->

**Standing** is what a page is kept for, judged in [`page-jobs.csv`](page-jobs.csv):

<!-- pages-map:standing -->
| Value | The page |
| --- | --- |
| product | is opened by a reader to do a job |
| service | is opened by another page or a link to perform one step, and has no reader job of its own |
| exhibit | shows a kit, component, library or skill working |
| experiment | is a trial page, kept under pages/scratch/ or pages/drop/ or named as a probe or prototype, that answers a question about how to build a page, a kit or a component |
| record | is kept for history or provenance and no longer does its job |
<!-- /pages-map:standing -->

**Job** takes the values that [`codes.csv`](../../../data/ui-units/codes.csv) lists on its `job` axis. [The forms README](../../../docs/forms/README.md#jobs) defines them. A page that [`coded.csv`](../../../data/ui-units/coded.csv) codes takes its job from there. [`page-jobs.csv`](page-jobs.csv) leaves that page's job blank.

The `basis` column of [`page-jobs.csv`](page-jobs.csv) names what the judgment of standing and job read: the page's source, the manifest's or gallery's note, or the page's name alone.

A **tool** is a product page whose job includes make. In the make job, the reader works on something they bring or own, such as a text, a workbook, a recording or a data file.

**Visibility** is whether the page's repository is public. A page in a private repository renders only for a reader with a GitHub token, through [`toss-render.html`](../../../pages/toss-render.html).

**names_private** is a column for pages in public repositories. For such a page, the column lists the private repositories that the page's source names as `owner/repo`. It holds `none` when the source names no private repository. For a page in a private repository, the column is blank. The script does not read that page's source.

A page that names none may still read a private repository with the reader's token: [`branch.html`](../../../pages/branch.html) reads whichever repository its address names.

## The map

In the second table, `pages` counts the pages a catalogue names, `only here` the pages no other catalogue names, and each catalogue column the pages both catalogues name.

<!-- pages-map:map -->
177 pages in 11 repositories; 143 in public repositories.

| Relation to the app | product | service | exhibit | experiment | record | all |
| --- | --- | --- | --- | --- | --- | --- |
| view | 18 | 0 | 0 | 0 | 0 | 18 |
| full-app | 1 | 0 | 0 | 0 | 0 | 1 |
| framed | 2 | 0 | 0 | 0 | 0 | 2 |
| linked | 12 | 1 | 2 | 2 | 0 | 17 |
| standalone | 60 | 1 | 40 | 34 | 4 | 139 |

| Catalogue | pages | only here | gallery | manifest | landing | utilities | units | forms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gallery | 123 | 94 | 123 | 12 | 2 | 5 | 20 | 7 |
| manifest | 64 | 51 | 12 | 64 | 3 | 0 | 7 | 1 |
| landing | 5 | 2 | 2 | 3 | 5 | 0 | 1 | 0 |
| utilities | 5 | 0 | 5 | 0 | 0 | 5 | 2 | 0 |
| units | 20 | 0 | 20 | 7 | 1 | 2 | 20 | 6 |
| forms | 7 | 0 | 7 | 1 | 0 | 0 | 6 | 7 |

Tools (26): [`art-of-memory:MajorSystem.html`](https://github.com/mehrlander/art-of-memory/blob/main/MajorSystem.html), [`art-of-memory:pages/visual-dictionary/index.html`](https://github.com/mehrlander/art-of-memory/blob/main/pages/visual-dictionary/index.html), [`fun:projects/nifty-hoops/01-deliverable/01-configurator-prototype.html`](https://github.com/mehrlander/fun/blob/main/projects/nifty-hoops/01-deliverable/01-configurator-prototype.html), [`shortcut-tools:pages/library.html`](https://github.com/mehrlander/shortcut-tools/blob/main/pages/library.html), [`wa-bills:bills/content/CombineContent.html`](https://github.com/mehrlander/wa-bills/blob/main/bills/content/CombineContent.html), [`wa-bills:bills/content/DivideContent.html`](https://github.com/mehrlander/wa-bills/blob/main/bills/content/DivideContent.html), [`wa-bills:bills/terms-and-rcws/BienniumTermsAndRCWs.html`](https://github.com/mehrlander/wa-bills/blob/main/bills/terms-and-rcws/BienniumTermsAndRCWs.html), [`wa-bills:bills/topic/ScanFromList.html`](https://github.com/mehrlander/wa-bills/blob/main/bills/topic/ScanFromList.html), [`wa-bills:fiscal-notes/fn-paste-join.html`](https://github.com/mehrlander/wa-bills/blob/main/fiscal-notes/fn-paste-join.html), [`wa-bills:rcw/PensionMappingInverter.html`](https://github.com/mehrlander/wa-bills/blob/main/rcw/PensionMappingInverter.html), [`wa-bills:wsl-api/data/LegislationSinceWithRcwScanner.html`](https://github.com/mehrlander/wa-bills/blob/main/wsl-api/data/LegislationSinceWithRcwScanner.html), [`wa-bills:wsl-api/data/generate-grouped.html`](https://github.com/mehrlander/wa-bills/blob/main/wsl-api/data/generate-grouped.html), [`wa-bills:wsl-api/tools/content/ClearSessionBills.html`](https://github.com/mehrlander/wa-bills/blob/main/wsl-api/tools/content/ClearSessionBills.html), [`wa-bills:wsl-api/tools/content/ScanSessionBills.html`](https://github.com/mehrlander/wa-bills/blob/main/wsl-api/tools/content/ScanSessionBills.html), [`web-tools:pages/annotate.html`](https://github.com/mehrlander/web-tools/blob/main/pages/annotate.html), [`web-tools:pages/compression-helper.html`](https://github.com/mehrlander/web-tools/blob/main/pages/compression-helper.html), [`web-tools:pages/dictate.html`](https://github.com/mehrlander/web-tools/blob/main/pages/dictate.html), [`web-tools:pages/diff-tool.html`](https://github.com/mehrlander/web-tools/blob/main/pages/diff-tool.html), [`web-tools:pages/gist-editor.html`](https://github.com/mehrlander/web-tools/blob/main/pages/gist-editor.html), [`web-tools:pages/launcher.html`](https://github.com/mehrlander/web-tools/blob/main/pages/launcher.html), [`web-tools:pages/links.html`](https://github.com/mehrlander/web-tools/blob/main/pages/links.html), [`web-tools:pages/reception.html`](https://github.com/mehrlander/web-tools/blob/main/pages/reception.html), [`web-tools:pages/shorter.html`](https://github.com/mehrlander/web-tools/blob/main/pages/shorter.html), [`web-tools:pages/toss-render.html`](https://github.com/mehrlander/web-tools/blob/main/pages/toss-render.html), [`web-tools:pages/transform.html`](https://github.com/mehrlander/web-tools/blob/main/pages/transform.html), [`web-tools:pages/xlsx-picker.html`](https://github.com/mehrlander/web-tools/blob/main/pages/xlsx-picker.html).

Public pages that name a private repository (17): [`shortcut-tools:pages/library.html`](https://github.com/mehrlander/shortcut-tools/blob/main/pages/library.html), [`web-tools:lib/kits/demos/md-variants.html`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/demos/md-variants.html), [`web-tools:pages/citations.html`](https://github.com/mehrlander/web-tools/blob/main/pages/citations.html), [`web-tools:pages/dictate.html`](https://github.com/mehrlander/web-tools/blob/main/pages/dictate.html), [`web-tools:pages/doc-growth.html`](https://github.com/mehrlander/web-tools/blob/main/pages/doc-growth.html), [`web-tools:pages/entities.html`](https://github.com/mehrlander/web-tools/blob/main/pages/entities.html), [`web-tools:pages/links.html`](https://github.com/mehrlander/web-tools/blob/main/pages/links.html), [`web-tools:pages/news/news.html`](https://github.com/mehrlander/web-tools/blob/main/pages/news/news.html), [`web-tools:pages/scratch/toss-top-probe.html`](https://github.com/mehrlander/web-tools/blob/main/pages/scratch/toss-top-probe.html), [`web-tools:pages/session.html`](https://github.com/mehrlander/web-tools/blob/main/pages/session.html), [`web-tools:pages/shortcut-edit.html`](https://github.com/mehrlander/web-tools/blob/main/pages/shortcut-edit.html), [`web-tools:pages/shortcut-log.html`](https://github.com/mehrlander/web-tools/blob/main/pages/shortcut-log.html), [`web-tools:pages/shortcuts.html`](https://github.com/mehrlander/web-tools/blob/main/pages/shortcuts.html), [`web-tools:pages/skill-lab.html`](https://github.com/mehrlander/web-tools/blob/main/pages/skill-lab.html), [`web-tools:pages/text-lab.html`](https://github.com/mehrlander/web-tools/blob/main/pages/text-lab.html), [`web-tools:pages/toss-render.html`](https://github.com/mehrlander/web-tools/blob/main/pages/toss-render.html), [`web-tools:skills/concept-index/demo.html`](https://github.com/mehrlander/web-tools/blob/main/skills/concept-index/demo.html).
<!-- /pages-map:map -->

The changes this map suggests are in [the pages proposals](../future/pages.md).
