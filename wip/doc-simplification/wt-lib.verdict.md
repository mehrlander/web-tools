# Verdicts: wt-lib

## 1. Delete the per-kit sections of `lib/kits/README.md`

**Verdict:** revise

**Checked:** The self-description holds: `lib/kits/README.md:63-64` says the sections "cover only some kits" and that "Each kit is documented in its own header comment." `ls lib/kits/*.js | wc -l` is 100 and `docs/kits.csv` has 101 lines. The `build.js` drift is real: README lines 408-409 say `bake` rewrites "the page's gh-api.js import to a data: URL", line 427 says it rewrites the `lib/entry.js` import call, and the `lib/build.js` header (lines 23-28) says `blob:`. The `lib/build.js` header itself still says "same strip+wrap+execute" at line 11, so the header is not a clean owner either. There are 24 `###` kit sections, not 23. `sed -n '56,$p' | wc -w` gives 11,788, which matches.

The fold-in is badly under-scoped. I compared each kit's leading comment block to its README section. The reader names three thin headers (`io.js` 3 lines, `treemap.js` 4, `messaging.js`). But several more headers carry none of the API the README carries:
- `xlsx.js`: 21 header lines, no API. The README section (1,026 words) holds the whole `readZip`, `sheetLayout`, `workbookNotes`, `cellStyle`, `dxfStyle`, `cfApplies` surface, plus the "three boundaries" (expression rules skipped, VML not read, defined-name lists return null), the legacy-comments rels walk, and the 2026-09-14 formula-text contract. None of that is in the header.
- `pdf.js`: 28 header lines naming only `open, geom, stream, lattice, doc, config`. The README (892 words) holds the `loadPdfjs`/`loadPdfLib` split, the rule that a viewer should not call `open()`, and the full `d.items`/`d.paths` shape.
- `wring.js`: 18 lines with three example calls, and its own last line says "Documented in lib/kits/README.md" (`wring.js:18`). The reader lists it as a header that "already carries the API". It does not; the README section is 417 words.
- `persistence.js`: the header covers `save`/`load` and path syntax. The README's "Collections" and "IndexedDB introspection" subsections are not in the header block (there is an inline comment at `persistence.js:210`).
- `data-shelf.js` (9 lines), `wsl.js` (10) and `wsl-core.js` (13) are also thin.

Missed inbound claims that become false: `docs/code-layers.md:103` says "`lib/kits/README.md` carries the per-kit table", and root `README.md:255-257` says the file holds "What each kit exposes on `window`, with usage examples; the full list lives there". `archive/wring/export/README.md:13,24` tells a reader to append a section to "Current kits"; it is archive, so it can stay. No test or script parses the file (`grep` over `tools/test`, `tools/build`, `scripts`, `.githooks`).

**Revised proposal:** Delete the 24 sections and "Salvage status", but first fold the API blocks and the stated boundaries into the headers of at least `xlsx.js`, `pdf.js`, `wring.js`, `persistence.js`, `io.js`, `treemap.js`, `data-shelf.js`, `wsl.js` and `wsl-core.js`. Leave the headers that already carry their design (`annotate`, `md-doc`, `peek`, `docx`, `dictate`, `export`, `brief`) alone and drop the README history. Fix the stale "strip+wrap+execute" line in `lib/build.js:11` in the same pass. Retarget `docs/code-layers.md:103` and `README.md:218,255-257` to the Kits tab and `docs/kits.csv`. Drop the "documented in lib/kits/README.md" lines in `io.js:3` and `wring.js:18`.

**Corrected words removed:** about 11,790 from the README. Roughly 3,000 to 3,500 of those move into code headers (the xlsx, pdf, wring and persistence sections alone are about 2,660), so the net reduction is about 8,300, not 10,800.

## 2. Collapse `console/README.md`'s per-mod sections to a table

**Verdict:** revise

**Checked:** `sed -n 55,343p console/README.md | wc -w` gives 1,707. There are 19 `###` mod sections (lines 57-332), not 18. Every mod in `console/mods/` has a header of 9 to 31 lines, and `console/suite.js` keeps all 20 headers (`grep -c '^// console/mods' console/suite.js` is 20), so the claim that the header is what a user sees holds. The `scan` overlap is real (`scan.js:1-22` against `README.md:214-243`). The only inbound references are root `README.md`, `tools/test/tests-registry.test.mjs:200` (a comment about the Testing section, which stays) and the generated `docs/themes.csv`.

The sections are not pure copies. Facts in the README that the headers lack: for `tap`, "Requests pass through untouched (responses are cloned)", `walk`'s `delay` default of 250 ms, and "GETs only, tap doesn't record request bodies" (`README.md:137-162` against `tap.js:1-23`). For `scan`, `scan.db(name)` and the `glom-scan` default database, `{compress:true}`, `scan.chat()`, and the key-stability advice (`README.md:228-243`). The larger README sections (`query` 189 words, `templates` 122, `tap` 159) are likely to hold more of this.

**Revised proposal:** Before replacing the sections with the table, diff each section against its mod header and move any fact the header lacks into the header. Then replace lines 55-343 with the one-line-per-mod table. The layout paragraph at lines 34-41 already gives the find, dance, grab loop across mods, so the table needs no prose of its own.

**Corrected words removed:** about 1,400 (1,707 minus a table of about 250, minus a few dozen words moved into headers).
