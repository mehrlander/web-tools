# Provenance across the estate

**Question.** Provenance here means how a piece of content, data or a claim ties back to where it came from. The question is what the owner's four repositories already hold on provenance, whether their vocabularies agree, and how a probe holds the sources it rests on. It was asked on 2026-11-20 as the first step in taking provenance into the [Discovery](../../programs/discovery/README.md) program. The owner had found the topic hard to see whole, and had twice asked whether "authorship bundle" was a term in use.

## What was tried

- **A table of terms.** [`terms.csv`](terms.csv) holds 93 provenance terms drawn from budget-drs, web-tools, home and web-tools-private. Each row gives the term's defining quote, its home file and line, its closed values where it is a classifier, and the tool that checks it. Each row also carries a **facet**, assigned by this probe: the question the term answers, as listed in the next section. [`check.py`](check.py) confirms that every quote still appears within 12 lines of its cited line on each repository's `origin/main`. The table is a curated selection, not an inventory: three readers proposed about 150 terms, and terms that only repeat another were dropped.
- **A survey of how write-ups hold their sources.** [`sourcing/measure.py`](sourcing/measure.py) measures 79 probe and research write-ups across the four repositories into [`sourcing/measures.csv`](sourcing/measures.csv). For each write-up it counts words, links into stores of fetched outside material, external addresses, links to other analysis, files in the write-up's own folder, and quotations longer than 15 words. The 79 include two unmerged probes on budget-drs branch `claude/great-ramanujan-9enimt`. A reader then assigned each write-up its sourcing patterns, recorded in [`sourcing/patterns.csv`](sourcing/patterns.csv). That reading also recounted the own-folder files of five write-ups, whose folders the script's naming rule misread; those five rows are given under the survey section below.
- The repositories were read at budget-drs `ddfabe1` (the branch at `2f7be04`), web-tools `5f0e12e`, home `50639db` and web-tools-private `1b330a6`.

## Seven facets

The estate's provenance terms each answer one of seven questions:

| Facet | The question it answers | Examples | Terms | Checked by a tool |
| --- | --- | --- | --- | --- |
| acquisition | How did the material enter the repository? | source bundle, intake, provenance class, `pull`, `arrival`, `not_taken` | 15 | 9 |
| producer | Who or what made it? | `creation_mode`, `mode` (recorded or computed), authored column, authorship event, the `by` role | 14 | 13 |
| derivation | What path did it take from source to display? | table and column lineage, `column_op`, the structured stage, the basis flag | 15 | 6 |
| binding | Which part of which source supports this piece of output? | anchor, provenance state, `anchors.csv`, the `from` and `shows` roles, locator kinds | 18 | 8 |
| correctness | Is it right, measured against something independent? | gold set, concordance, confront, the claim check, the census verdict | 10 | 1 |
| durability | What is lost if the file is lost, and how may it change? | the registries' authored, derived and captured; edit policy; frozen | 8 | 3 |
| record | Where is the provenance written down, and how completely? | the data catalog, bundle frontmatter, `confidence`, the source manifest | 13 | 7 |

Tools hold the producer facet almost entirely: 13 of 14 terms, mostly through budget-drs's `evidence.py` and web-tools's properties tests. Correctness is held least: one of 10 terms has a check, budget-drs's `verify-acfr-quotes.py`. Gold sets exist as a skill and as one instance in web-tools, and no repository runs one as a standing check. The facets are this probe's sorting, not a vocabulary any file declares.

## Where the words collide

1. **"Provenance" names at least five facets.** In web-tools [`docs/registries.md`](../../docs/registries.md) it means durability: authored, derived (rebuilt if lost) or captured (gone if lost). In source-anchored-writing it is a per-claim binding state, Quoted to Unsupported. In budget-drs it is the acquisition class of a file, `public` to `planned`, and the column `provenance` in `leaves.csv` carries that class. In source-anchored-xlsx and home's draft [`source-anchoring.md`](https://github.com/mehrlander/home/blob/main/created/2026-07-19-source-anchoring.md) it is the per-source record of origin and method. Each use is coherent where it stands. The collisions appear when two of them meet in one reading.
2. **"Supplied" covers different material in two classifiers.** The content-registry skill's `supplied` is "external source material", and the registries apply it to fetched public material: web-tools `content.csv` marks the bill records the wsl-fetch cron pulls, and home `content.csv` marks budget-drs's pulled ACFR extracts. budget-drs's `supplied` is "Assembled by hand off-project and provided as a file", and a pulled public file there is `public`. The two scopes overlap only on files handed in by hand.
3. **Whether "authored" includes model output.** web-tools's `recorded` mode is authored by anyone. content-registry splits authorship three ways: human, model and hybrid. budget-drs's `authored` class "records a human choice". favoring-the-mechanical says "a human or model judgment or synthesis". No file states which reading governs where they meet.
4. **Five words for rebuilt by a script.** These are `derived` (registries), `computed` (the properties `mode`), `mechanical` (content-registry), `generated` (budget-drs, renamed from `derived` on 2026-07-16) and `regenerated` (home's edit policy). favoring-the-mechanical still lists budget-drs's class as `derived`.
5. **One folder, two classes.** web-tools-private's `content.csv` marks `sessions/` as `mechanical`. Its README marks the same folder `captured`, "gone if lost". The two words point opposite ways on whether the files could be rebuilt.
6. **Stale pointers.** favoring-the-mechanical cites `projects/budget-drs/data/catalog/PROVENANCE.md`, which no longer exists, and the draft doctrine cites the manifesto at its old path. The Discovery manager's brief names scour's `sources.csv` and `manifest.csv`, but scour writes `roster.json` and `<slug>/content/*.md`, and neither file exists in any checkout read.
7. **Inside budget-drs.** These are local cleanups for that repository:
   - The provenance class has three, four or five values depending on the document read.
   - The origin family count is "Thirteen" in `SOURCES.md` and 14 in the vocabulary.
   - "Bundle" still names two kinds of built output.
   - The retired "package" survives in five places.
   - "Basis" carries four senses and has no `properties.csv` row.

## What "authorship bundle" resolves to

budget-drs rules "bundle" to mean material from outside the project ([`LAYERS.md`](https://github.com/mehrlander/budget-drs/blob/main/data/design/LAYERS.md), line 80). The authored side has a counterpart for each part of a bundle:

| Acquisition side | Authored side |
| --- | --- |
| intake, the dated act | authorship event: one CSV, one authored result column |
| source bundle, the unit | authored file: keys, context, one `call` and its evidence columns |
| bundle README frontmatter, read into `bundles.csv` | the file's row in `authored-files.csv` |
| `bundle-files.csv`, one row per file | `authored-columns.csv`, one row per column |

The two sides differ in two ways. An authored file is not a dated folder, and `authored-files.csv` has no date column like a bundle's `acquired`. The thing nearest to what the owner described is a probe folder whose `claims.csv` and `anchors.csv` tie authored claims to a source bundle that the probe's `probes.csv` row names.

## How write-ups hold their sources

The 79 write-ups fall into these sourcing patterns, and a write-up can have several:

| Pattern | Write-ups | What it means |
| --- | --- | --- |
| estate material | 53 (42 with no other pattern) | rests on the repositories' own files, code, sessions or runs |
| external addresses | 18 | cites web addresses |
| links into bundles | 15 | cites files in existing source stores, all in budget-drs but one |
| included files | 6 | keeps fetched source files in its own folder |
| none | 3 | cites no source, or lost its citations in capture |
| gathered corpus | 2 | fetched by script into an ignored build folder |
| own bundle | 1 | took its sources in as a dedicated bundle |

The reading recounted the own-folder files of these five write-ups; [`sourcing/measures.csv`](sourcing/measures.csv) holds the script's first counts:

| Write-up | Source files | Scripts | Tables | What the folder holds |
| --- | --- | --- | --- | --- |
| budget-drs `2026-10-29-monthly-data-model` | 1 | 1 | 0 | a TSV pasted by the owner |
| web-tools `DOC_CRAFT_STUDY.md` | 2 | 0 | 0 | the original specimens |
| home concept-lab findings | 1 | 13 | 1 | fetched Google Books counts |
| home excel-validation | 0 | 12 | 16 | the run's own captures |
| home excel-chart-review | 6 | 2 | 2 | a supplied earlier Gemini pass |

Five findings bear on how a probe should hold its sources:

1. **No rule says where a probe's source material goes.** [`docs/probes.md`](../../docs/probes.md) asks for a question, what was tried and what was found. [`docs/source-bundles.md`](../../docs/source-bundles.md) defines a bundle. Neither names the other. budget-drs's `probes.csv` has a `bundle` column, enforced only by `build-probes.py` and only when an `anchors.csv` exists. It is filled in for one of the 14 probes on the branch.
2. **One probe has the full pattern.** budget-drs's [`2026-11-07-gated-nonappropriated`](https://github.com/mehrlander/budget-drs/blob/main/data/design/probes/2026-11-07-gated-nonappropriated/FINDINGS.md) runs 1,719 words. Its bundle, [`2026-11-07-gated-funding-documents`](https://github.com/mehrlander/budget-drs/tree/main/data/source/2026-11-07-gated-funding-documents), keeps 12 one-page PDFs with their text and word positions, plus workbooks. Each claim is a row of `claims.csv`, and each of its 27 anchors in `anchors.csv` holds the source's verbatim words: 22 rows are Supported and 5 Inferred. The build fails on any quoted passage it cannot find on its page. Its prose holds three long quotations, so the verbatim text sits in the anchors table, under a check, rather than in the prose.
3. **Included files go unregistered.** budget-drs's `2026-11-09-classification-pay-approvals` keeps six fetched texts in `kept/` with a `sources.csv` of address, date, sha256 and size. That is the shape of a bundle, but the folder lies outside the declared bundle roots, so `bundles.csv` does not list it and its `bundle` cell is empty.
4. **Length barely tracks sourcing.** The rank correlation between word count and links into source stores is 0.12 over the 79 write-ups and 0.26 over budget-drs's 14 probes. The three longest write-ups, of 9,000 to 12,400 words, cite no outside source, which suits probes of the estate's own tools.
5. **Claims stated without a source are rare, and where they occur the write-ups say so.** The unmerged trust-fund cost-allocation probe states two claims "from general understanding of the statutes, not from a fetched RCW". The bundle `data/source/2026-10-09-pension-statutes` exists, and this survey did not check whether it holds the sections those claims need. Similar admissions appear in home's entity-kinds study ("from memory of their documentation") and web-tools's quality-control-lineage (read "secondhand").

**For a probe that rests on outside documents,** the gated probe is the working model of a source-heavy probe. The prose states each claim once, a claims table and an anchors table hold the source's words, and a check holds the anchors to the pages. A probe whose documents an existing bundle already holds links into that bundle. A probe that fetches new documents takes them in as its own dated bundle, named in its registry row, rather than as unregistered files in its folder. The trust-fund probe, at 5,519 words with 18 bundle links and 12 long quotations in the prose, shows the other path: well sourced, but the sources' words sit in the prose, where no check reaches them.

## What this suggests for the Discovery program

These are proposals for the owner, not changes made here.

1. **A Provenance area in the charter**, with Discovery governing the files that state provenance practice and belong to no program:
   - the source-anchoring, source-anchored-writing and source-anchored-xlsx skills
   - the content-registry, gold-set and document-visual-mapping skills
   - [`docs/source-bundles.md`](../../docs/source-bundles.md) and [`docs/probes.md`](../../docs/probes.md), with `python/source-bundles.py` and `python/probes.py`
   - `data/design/content.csv`

   [`docs/registries.md`](../../docs/registries.md) stays with Organization and is named in Discovery's charter. budget-drs remains the reference implementation, governed by its own checks.
2. **Promote the draft doctrine.** Home's [`created/2026-07-19-source-anchoring.md`](https://github.com/mehrlander/home/blob/main/created/2026-07-19-source-anchoring.md) is marked "destined for web-tools/docs/SOURCE-ANCHORING.md once settled". The seven facets could organize it.
3. **Settle three vocabulary questions:** the scope of `supplied`, whether `authored` includes model output, and one word for rebuilt by a script.
4. **A source-anchored probe shape in `docs/probes.md`:** where a probe's documents go, and the claims, anchors and bundle pattern as the option for a probe that rests on outside documents.
5. **Correct the manager's brief:** the pointer to scour's files.

## What this leaves open

- The facet of each term, the selection of terms and each write-up's patterns are judgments, made by this probe and its readers. The quotes are checked; the classifications are not.
- The checkouts are shallow, so dates before mid-November come from the files and the session records, not from git history.
- The terms table holds the vocabulary as of the commits above. A later change to a cited file can move a quote, and `check.py` reports that as moved or missing.

## Run it

```bash
python3 research/2026-11-20-provenance-map/check.py
```

`sourcing/measure.py` rebuilds the survey table from extracted trees; its docstring gives the commands.
