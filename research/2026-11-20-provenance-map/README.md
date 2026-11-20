# Provenance across the four repositories

**Question.** Provenance here means how a piece of content, data or a claim ties back to where it came from. What do budget-drs, web-tools, home and web-tools-private hold on provenance? Do their vocabularies agree? How should a probe hold the sources it rests on? The owner asked on 2026-11-20, while proposing that the [Discovery](../../programs/discovery/README.md) program take provenance up. The owner had also asked about the name "authorship bundle" in two earlier sessions, recorded in web-tools-private as [`2026-08-16-2c5c7b71.json`](https://github.com/mehrlander/web-tools-private/blob/main/sessions/2026/08/2026-08-16-2c5c7b71.json) and [`2026-09-09-2066b80c.json`](https://github.com/mehrlander/web-tools-private/blob/main/sessions/2026/09/2026-09-09-2066b80c.json).

**Answer.** Each repository is coherent on its own terms. The disagreement sits where they meet, at three words: "provenance" itself, "supplied" and "authored". Five words name a file a script rebuilds. The parts of an "authorship bundle" already exist under other names. One budget-drs probe already shows the source-heavy shape the owner described. That probe has a bundle of its own, and its build fails on any quoted passage it cannot find on the bundle's pages. No shared document describes that shape yet.

## Should a probe be source heavy, with a bundle of its own?

For a probe that rests on outside documents, yes. The working model is budget-drs's [`2026-11-07-gated-nonappropriated`](https://github.com/mehrlander/budget-drs/blob/main/data/design/probes/2026-11-07-gated-nonappropriated/FINDINGS.md), which runs 1,719 words:

- **Its documents are a dated bundle of their own.** [`2026-11-07-gated-funding-documents`](https://github.com/mehrlander/budget-drs/tree/main/data/source/2026-11-07-gated-funding-documents) keeps 12 one-page PDFs with their text and each word's position, plus workbooks. The probe's row in [`probes.csv`](https://github.com/mehrlander/budget-drs/blob/main/data/design/probes/probes.csv) names the bundle.
- **The prose states each claim once.** [`claims.csv`](https://github.com/mehrlander/budget-drs/blob/main/data/design/probes/2026-11-07-gated-nonappropriated/claims.csv) lists the claims, and [`anchors.csv`](https://github.com/mehrlander/budget-drs/blob/main/data/design/probes/2026-11-07-gated-nonappropriated/anchors.csv) holds the source's verbatim words for each of 27 anchors: 22 Supported and 5 Inferred, in the states [source-anchored-writing](../../skills/source-anchored-writing/SKILL.md) defines.
- **A check reads the anchors against the pages.** [`build-probes.py`](https://github.com/mehrlander/budget-drs/blob/main/app/probes/tools/build-probes.py) fails on any quoted passage it cannot find on its page.

The owner worried that explaining freehand drifts from the sources. In this shape the sources' words live in a table a check reads, and the prose states each claim and names its anchor.

Two other patterns occur:

- **Links into an existing bundle.** Some probes rest on documents a bundle already holds, and link into it. 15 write-ups do this, all but one in budget-drs.
- **Files in the probe's own folder.** A probe that fetched new documents can keep them beside its write-up. budget-drs's [`2026-11-09-classification-pay-approvals`](https://github.com/mehrlander/budget-drs/tree/main/data/design/probes/2026-11-09-classification-pay-approvals) keeps six texts in [`kept/`](https://github.com/mehrlander/budget-drs/tree/main/data/design/probes/2026-11-09-classification-pay-approvals/kept), with a [`sources.csv`](https://github.com/mehrlander/budget-drs/blob/main/data/design/probes/2026-11-09-classification-pay-approvals/sources.csv) of address, date, sha256 and size. The bundle table, [`bundles.csv`](https://github.com/mehrlander/budget-drs/blob/main/data/design/catalog/bundles.csv), lists only folders under the declared bundle roots. `kept/` is not under one. A bundle would put the same files in the catalog and under its checks.

**A note for the session that owns the trust-fund cost-allocation probe.** That probe is unmerged, on budget-drs branch [`claude/great-ramanujan-9enimt`](https://mehrlander.github.io/web-tools/pages/branch.html#gh=mehrlander/budget-drs@claude/great-ramanujan-9enimt). It runs 5,519 words. It links into bundles 18 times and quotes 12 passages of more than 15 words in its prose. Its sources all come from bundles already in the repository.

The probe states two claims "from general understanding of the statutes, not from a fetched RCW": the LEOFF 2 member share and the WSPRS funding sources. The existing bundle [`2026-10-09-pension-statutes`](https://github.com/mehrlander/budget-drs/tree/main/data/source/2026-10-09-pension-statutes) holds 21 sections, and neither claim's section is among them. RCW 41.26.725 sets the state's LEOFF 2 contribution, as the [FY2025 annual financial report extract](https://github.com/mehrlander/budget-drs/blob/main/data/source/2026-06-10-drs-acfr-extracts/ACFR_2025.md) cites it. The State Patrol retirement system's statutes are in Title 43.43, and the bundle holds no section of that title.

## What "authorship bundle" resolves to

budget-drs rules that "bundle" means material from outside the project ([`LAYERS.md`](https://github.com/mehrlander/budget-drs/blob/main/data/design/LAYERS.md?plain=1#L80), line 80). Both earlier sessions cited that ruling in declining the name. This probe maps the authored side onto the parts of a source bundle:

| Source bundle | Authored data |
| --- | --- |
| intake, the dated act of taking material in | authorship event: one CSV, one authored result column ([`EVIDENCE.md`](https://github.com/mehrlander/budget-drs/blob/main/data/authored/EVIDENCE.md)) |
| the bundle, a dated folder | the authored file: keys, context, one `call` column and its evidence columns |
| the README's frontmatter, read into [`bundles.csv`](https://github.com/mehrlander/budget-drs/blob/main/data/design/catalog/bundles.csv) | the file's row in [`authored-files.csv`](https://github.com/mehrlander/budget-drs/blob/main/data/design/catalog/authored-files.csv) |
| [`bundle-files.csv`](https://github.com/mehrlander/budget-drs/blob/main/data/design/catalog/bundle-files.csv), one row per file | [`authored-columns.csv`](https://github.com/mehrlander/budget-drs/blob/main/data/design/catalog/authored-columns.csv), one row per column |

An authored file is not a dated folder, and `authored-files.csv` has no date column like a bundle's `acquired`. The gated probe joins the two sides: its authored claims cite the source bundle that its registry row names.

## Where the vocabularies meet

1. **"Provenance" names at least five things.**
   - In web-tools [`docs/registries.md`](../../docs/registries.md) it means what a file's loss would cost: authored, derived (rebuilt if lost) or captured (gone if lost).
   - In [source-anchored-writing](../../skills/source-anchored-writing/SKILL.md) it is a claim's state, Quoted to Unsupported.
   - In budget-drs [`SOURCES.md`](https://github.com/mehrlander/budget-drs/blob/main/data/design/SOURCES.md) it is how a file came to exist in the repository: public, supplied, generated, authored or planned. The `provenance` column of [`leaves.csv`](https://github.com/mehrlander/budget-drs/blob/main/data/design/lineage/leaves.csv) holds that class.
   - In [source-anchored-xlsx](../../skills/source-anchored-xlsx/SKILL.md) it is a workbook sheet with one line per source: what it is, its date and its status.
   - In home's draft doctrine [`source-anchoring.md`](https://github.com/mehrlander/home/blob/main/created/2026-07-19-source-anchoring.md) it is each source's origin, method and class, the leaves of a graph whose edges are its lineage.
2. **"Supplied" covers different material.** The [content-registry](../../skills/content-registry/SKILL.md) skill's `supplied` is "external source material". web-tools's [`content.csv`](../../data/design/content.csv) applies it to bill records a cron job fetches from the Legislature. home's [`content.csv`](https://github.com/mehrlander/home/blob/main/data/design/content.csv) applies it to budget-drs's pulled ACFR extracts. budget-drs's `supplied` is "Assembled by hand off-project and provided as a file". There, a pulled public file is `public`.
3. **Whether "authored" includes model output.**
   - web-tools's `recorded` mode, in [`docs/registries.md`](../../docs/registries.md), counts as authored whoever wrote the value.
   - content-registry splits authorship into human, model and hybrid.
   - budget-drs's `authored` class "records a human choice", although sessions write many of its authored files.
4. **Five words for a file a script rebuilds:**
   - `derived` (registries)
   - `computed` (the `mode` column of [`docs/properties.csv`](../../docs/properties.csv))
   - `mechanical` (content-registry)
   - `generated` (budget-drs, renamed from `derived` on 2026-07-16)
   - `regenerated` (home's edit policy, [`.gitattributes`](https://github.com/mehrlander/home/blob/main/.gitattributes))
5. **One folder, two classes.** web-tools-private's [`content.csv`](https://github.com/mehrlander/web-tools-private/blob/main/data/design/content.csv) marks `sessions/` as `mechanical`. Its [README](https://github.com/mehrlander/web-tools-private/blob/main/README.md) marks the same folder captured, "gone if lost".

Smaller fixes, each local to one file:

- home's [`favoring-the-mechanical`](https://github.com/mehrlander/home/blob/main/created/2026-07-03-favoring-the-mechanical.md) cites a `PROVENANCE.md` that budget-drs no longer has, and still lists budget-drs's class as `derived`.
- The draft doctrine cites `projects/budget-drs/MANIFESTO.md`, now budget-drs [`docs/MANIFESTO.md`](https://github.com/mehrlander/budget-drs/blob/main/docs/MANIFESTO.md).
- budget-drs gives the provenance class three values in [`LAYERS.md`](https://github.com/mehrlander/budget-drs/blob/main/data/design/LAYERS.md?plain=1#L21) (line 21), four in [`app/lineage/README.md`](https://github.com/mehrlander/budget-drs/blob/main/app/lineage/README.md?plain=1#L94) (line 94) and five in [`catalog/vocabularies.csv`](https://github.com/mehrlander/budget-drs/blob/main/data/design/catalog/vocabularies.csv).
- budget-drs's [`SOURCES.md`](https://github.com/mehrlander/budget-drs/blob/main/data/design/SOURCES.md?plain=1#L221) says "Thirteen" origin families (line 221) where its vocabulary has 14.
- budget-drs's [`catalog/README.md`](https://github.com/mehrlander/budget-drs/blob/main/data/design/catalog/README.md?plain=1#L45) (lines 45 to 50) and [`catalog/tools/README.md`](https://github.com/mehrlander/budget-drs/blob/main/data/design/catalog/tools/README.md) use "bundle" for built output. The retired word "package" survives in [`.paths.json`](https://github.com/mehrlander/budget-drs/blob/main/.paths.json#L31) (line 31), [`data/source/README.md`](https://github.com/mehrlander/budget-drs/blob/main/data/source/README.md?plain=1#L12) (line 12), [`SOURCES.md`](https://github.com/mehrlander/budget-drs/blob/main/data/design/SOURCES.md?plain=1#L270) (lines 270 and 297) and [`properties.csv`](https://github.com/mehrlander/budget-drs/blob/main/data/design/properties.csv#L21) (line 21).


## Seven questions

This probe sorted the terms in [`terms.csv`](terms.csv) by the question each answers. The seven questions, and the facet names, are this probe's coinage.

| Facet | The question | Two examples |
| --- | --- | --- |
| acquisition | How did the material enter the repository? | source bundle; provenance class |
| producer | Who or what made it? | `creation_mode`; authorship event |
| derivation | What path did it take from source to display? | table and column lineage; the structured stage, "data before display" |
| binding | Which part of which source supports this piece of output? | an anchor, a cited span; provenance state |
| correctness | Is it right, measured against something independent? | gold set, an independently labeled sample; concordance with a second scheme |
| durability | What would losing the file cost, and how may it change? | the registries' authored, derived and captured; edit policy |
| record | Where is the provenance written down, and how completely? | the data catalog; bundle frontmatter |

Tools check the questions unevenly. Of the producer terms, 13 of 14 have a check, mostly budget-drs's [`evidence.py`](https://github.com/mehrlander/budget-drs/blob/main/data/authored/tools/evidence.py) and web-tools's [properties tests](../../node/test/properties-registry.test.mjs). Of the correctness terms, one of 10 does: budget-drs's [`verify-acfr-quotes.py`](https://github.com/mehrlander/budget-drs/blob/main/app/view/tools/verify-acfr-quotes.py). A gold set exists as the [gold-set](../../skills/gold-set/SKILL.md) skill and in one web-tools instance, [`data/doc-overlap/gold-set/`](../../data/doc-overlap/gold-set/).

## How the write-ups hold their sources

[`sourcing/measures.csv`](sourcing/measures.csv) measures 79 probe and research write-ups across the four repositories, and [`sourcing/patterns.csv`](sourcing/patterns.csv) gives each its patterns as read. A write-up can have several:

| Pattern | What it means | Write-ups |
| --- | --- | --- |
| `estate-material` | rests on the repositories' own files, code, sessions or runs | 53, of which 42 have no other pattern |
| `external-urls` | cites web addresses | 18 |
| `links-into-bundles` | links into existing source bundles | 15 |
| `included-files` | keeps fetched files in its own folder | 6 |
| `none` | cites no source, or lost its citations when an outside report was saved | 3 |
| `gathered-corpus` | gathered by script into an ignored build folder | 2 |
| `own-bundle` | took its sources in as a bundle of its own | 1 |

- **No rule says where a probe's source material goes.** [`docs/probes.md`](../../docs/probes.md) asks for a question, what was tried and what was found. [`docs/source-bundles.md`](../../docs/source-bundles.md) defines a bundle without mentioning probes. budget-drs's [`probes.csv`](https://github.com/mehrlander/budget-drs/blob/main/data/design/probes/probes.csv) has a `bundle` column. [`build-probes.py`](https://github.com/mehrlander/budget-drs/blob/main/app/probes/tools/build-probes.py) requires it only where an `anchors.csv` exists.
- **Length barely tracks sourcing.** The rank correlation between word count and links into source stores is 0.12 over all 79 and 0.26 over budget-drs's 14 probes. The three longest write-ups, of 9,000 to 12,400 words, cite no outside source.
- **Where a write-up states a claim without a source, it says so.** Besides the trust-fund probe, home's [entity-kinds study](https://github.com/mehrlander/home/blob/main/chron/2026/10/2026-10-16-entity-kinds-against-the-classification-schemes.md) states claims "from memory of their documentation". web-tools's [quality-control-lineage](../quality-control-lineage/README.md) was read "secondhand".

## Proposals for the Discovery program

1. **A Provenance area in the charter.** Discovery would own the theory of sources, as the owner proposed: how material is taken in, how output binds to it, and how correctness is tested. Each repository's own intake stays under its own checks, with budget-drs as the reference implementation. Recommended governed files, which state provenance practice and have no program today:
   - the [source-anchoring](../../skills/source-anchoring/SKILL.md), [source-anchored-writing](../../skills/source-anchored-writing/SKILL.md) and [source-anchored-xlsx](../../skills/source-anchored-xlsx/SKILL.md) skills, with [content-registry](../../skills/content-registry/SKILL.md) and [gold-set](../../skills/gold-set/SKILL.md)
   - [`docs/source-bundles.md`](../../docs/source-bundles.md) and [`docs/probes.md`](../../docs/probes.md), with their checks [`python/source-bundles.py`](../../python/source-bundles.py) and [`python/probes.py`](../../python/probes.py)

   [`docs/registries.md`](../../docs/registries.md) would stay with [Organization](../../programs/organization/README.md) and be named in Discovery's charter.
2. **Promote home's draft doctrine** to web-tools, as its status line already intends, with the seven questions as its outline. The recommendation rests on their sorting all 93 terms in [`terms.csv`](terms.csv), each into one question.
3. **Three vocabulary rulings, each with a recommended answer:**
   - **`supplied`** keeps budget-drs's meaning, material handed in by hand. content-registry's value becomes `external`, since it means any material from outside the repository.
   - **`authored`** means a judgment a person or a model made, which no script can rebuild. Who made it is recorded beside it, as content-registry's human, model and hybrid already do. budget-drs's definition widens to match.
   - **`generated`** is the one word for a file a script rebuilds, following budget-drs's 2026-07-16 ruling. "Derived from" stays reserved for the lineage relation.
4. **The gated probe's shape in `docs/probes.md`:** a probe that rests on outside documents takes them in as its own dated bundle, named in its registry row, with claims and anchors tables under a check.
5. **The manager's brief.** [`manager.md`](../../programs/discovery/manager.md) sends the manager to "`sources.csv`, `manifest.csv` and Wayback tables built under scour and wayback", naming the [scour](../../skills/scour/SKILL.md) and [wayback](../../skills/wayback/SKILL.md) skills. The recommended replacement is "a scour corpus's `roster.json` and its sources' `content/*.md` pages, the capture lists and saved pages a wayback run keeps, and the source bundles each checkout declares under `bundles` in [`.web-tools.json`](../../.web-tools.json)". The replacement is a one-line edit, made once the owner approves it.

## What this leaves open

- The facet of each term, the selection of terms and each write-up's patterns are judgments, made by this probe and the three subagents it sent out. [`check.py`](check.py) checks that each quote in `terms.csv` still appears within 12 lines of its cited line. The classifications have no check.
- The repositories were read at budget-drs [`ddfabe1`](https://github.com/mehrlander/budget-drs/commit/ddfabe1) (its branch at [`2f7be04`](https://github.com/mehrlander/budget-drs/commit/2f7be04)), web-tools [`5f0e12e`](https://github.com/mehrlander/web-tools/commit/5f0e12e), home [`50639db`](https://github.com/mehrlander/home/commit/50639db) and web-tools-private [`1b330a6`](https://github.com/mehrlander/web-tools-private/commit/1b330a6). The checkouts are shallow. Dates before mid-November come from the files and the session records.

## Run it

```bash
python3 research/2026-11-20-provenance-map/check.py
```

[`sourcing/README.md`](sourcing/README.md) says how `measures.csv` is rebuilt.
