---
id: registry-authored-derived-split-v3qm2x
title: Separate authored from derived data across the registries
status: backlog
opened: 2026-08-18
size: M
awaiting: one decision, not three: take the recommended shape (fix pages.note, split tests only, named exceptions elsewhere). The ordering question closed itself on 2026-09-10
---
# Separate authored from derived data across the registries

Three kinds of file should be distinguishable on sight: an **authored source** no
generator touches, a **derived** file a generator rewrites whole, and a **view**
joined at read time. Today one file kind pretends to be all three.

Half the enforcement exists. `docs/properties.csv` declares each property
`recorded` or `computed` (152 of them on 2026-09-04, 110 and 42). The gate is:
a property's declared mode must match which file its column lives in.

## The survey, measured 2026-08-18

| Layer | Where the mixing is | Fix |
| --- | --- | --- |
| 1 | 4 registries hold 17 authored columns beside 14 computed: `registries`, `tests`, `docs`, `harness` | split the file |
| 2 | `NOTES` in `pages-index.mjs` (26 hand-written blurbs, `pages.note` declared `computed` while a human writes it, so the declaration is false); `INJECTED`/`PROJECT_FILES` in `docs-reach.mjs` | authored file |
| 3 | 18 values in 5 glossaries in `map.js`, plus `ADOPT_VERDICT`/`DUE` in `estate.js` and `STATUS_TAG` in `file-review.js` | move to `docs/vocabularies.csv` |
| 4 | presentation mappings (`KIND_TONE`, `MODE_ICON`, `TYPE_ICONS`) | stay, named as deliberate |

32 closed value domains; three have per-value meaning recorded in data.

**Why it happened, since it decides the fix.** A registry absorbs authored
judgment when its subject has nowhere to keep its own: zero of the 63 files under
`docs/` carry frontmatter, and a `.mjs` carries none, so the registry row was the
only slot. Where a subject does describe itself, the registry stays clean:
`tracker-board` is 100% computed because `tracker/tasks/*.md` carry frontmatter.

## Decide first, because it changes the shape

1. **Sibling CSV or the subject file?** Per registry, not globally. Frontmatter is
   right for `docs/*.md` and wrong for `role` across 147 harness files.
2. **Suffix or folder?** `docs-derived.csv` or `authored/`+`derived/`. The folder
   is the stronger signal and moves 22 paths.
3. **`registries.csv` is 11 authored columns and one computed.** A whole file for
   22 values may cost more than it buys; the alternative is one named exception.

## Remeasured 2026-09-17, and the shape it argues for

The survey above is a 2026-08-18 reading and stays as one. These are today's
numbers, taken from `docs/properties.csv` and `docs/vocabularies.csv`.

**The ordering question is settled by events, not by argument.**
`column-primitive-across-registries-r8qiea` closed `done` on 2026-09-10, the same
day the log below said to decide the order before either moved, and
`column_primitive` is populated on all 178 rows. That race ran and this task did
not win it, so the third `awaiting` decision is not a decision.

**The harm it predicted happened, and is one row.** The argument for going first
was that a property added beside a false `mode` inherits the falsehood.
`pages.note` is still `mode: computed`, `deriver: tools/build/pages-index.mjs`,
while a human writes the 26 blurbs. So `column_primitive` did land beside a false
row. One of 178.

**The mixing is lopsided, which the "split the file" fix does not fit.** Four of
thirty registries mix, and only one of the four splits cleanly:

| Registry | recorded | computed | Reading |
| --- | --- | --- | --- |
| `registries` | 13 | 1 (`renders_in`) | a named exception, not a file |
| `harness` | 1 (`role`) | 6 | a named exception; `role` across 147 `.mjs`/`.sh` cannot take frontmatter |
| `docs` | 4 | 2 (`reach`, `words`) | frontmatter is available and unused; the `words` merge conflict is the standing cost |
| `tests` | 2 (`kind`, `protects`) | 5 | **the one clean split**: authored prose inside 145 KB of counts |

**Layer 2 is about 35 lines, not a condition.** `NOTES` in `pages-index.mjs` is
33 lines; `INJECTED` and `PROJECT_FILES` in `docs-reach.mjs` are one line each.

**Layer 3 is partly done.** `docs/vocabularies.csv` holds 37 values across
`app-routes`, `harness`, `properties`, `registries`, `skills` and `tests`. It does
not hold `docs.reach`, which still lives in `map.js`'s `REACH` and carries
`orphan`, nor `harness.invocation`, which carries `none found`. Those two are the
warning words `align-map-view-cleanup-40afu8` item 5 waits on, so what remains of
Layer 3 is exactly the part that unblocks Map.

**Recommended shape**, replacing the three stages below:

1. **Fix `pages.note` first, as an XS.** One row of the registry that governs the
   gate is false. Move `NOTES` to a small authored file and keep the declaration,
   or declare it `recorded` and name the literal. Either removes the premise of
   every ordering argument this task has carried.
2. **Split `tests` only.** `tests-authored.csv` beside `tests.csv`, two columns
   over 285 rows. The cost is demonstrated rather than argued: on 2026-09-17 a
   session ran `npm run tests-index`, got a row scaffolded with `protects` blank,
   and hand-wrote prose into a machine-written file.
3. **Take the named exception for `registries`, `harness` and `docs`.** One
   declared exception each, held by the existing gate, is cheaper than three files
   and three generators.
4. **Finish Layer 3 for `docs.reach` and `harness.invocation`,** which also
   releases Map's item 5.

Decision 2 (suffix or folder) then mostly evaporates: one new file needs no layout
scheme, and a folder move of 22 paths is a cost paid for a shape no longer being
adopted.

## Stages, each green on its own

1. Layer 3, which exercises the join before anything structural moves.
2. Layer 2, which corrects the false `mode` declaration stage 3's gate needs.
3. Layer 1, with the mode-matches-file gate alongside, since the gate is what
   keeps the split from decaying.

## Related

- `docs/properties.csv`: the `mode` declaration this task's gate compares against the file
- `docs/vocabularies.csv`: Layer 3's destination, already in the tree
- `lib/alpineComponents/map.js`: holds the five glossaries Layer 3 moves, warning words among them
- `lib/alpineComponents/estate.js`, `lib/alpineComponents/file-review.js`: the other Layer 3 carriers (`ADOPT_VERDICT`, `DUE`, `STATUS_TAG`)
- `docs/docs.csv`, `docs/harness.csv`: two registries whose columns carry a warning word as a value (`reach: orphan`, `invocation: none found`)
- `tools/build/pages-index.mjs`, `tools/build/docs-reach.mjs`: Layer 2's authored blocks, inside generators
- `docs/registries.csv`: decision 3's subject, 11 authored columns beside one computed
- `tools/test/properties-registry.test.mjs`: where this task's gate and `column-primitive-across-registries-r8qiea` meet
- `docs/column-primitives.md`: the neighbouring task's doctrine, read before settling the order
- task `align-map-view-cleanup-40afu8`: its item 5 waits on this task's Layer 3

## Done when
Every property's declared `mode` matches the file its column lives in, a gate
holds it, and no authored value remains in a generator or component except
Layer 4.

## Why it is worth carrying
The costs are already here: the `words` merge conflict fires for any two branches
touching `docs/`; three generators are read-modify-write merges rather than
emitters; the commit hook's leg 3c fixpoint exists because `docs/README.md` is a
row in the registry that generates it; and `tests.csv` hides a small authored
table inside 145 KB of machine output.

## Progress log
- 2026-08-18: Filed out of the JSON-to-CSV migration (PR #441), which made the
  mixing legible. Survey measured against that branch's tip.
- 2026-08-18: Corrected after the vocabulary pass. The defect is not confined to
  one kind of registry: `pages` is curated and has it too. Table names updated.
- 2026-09-04: Property count restamped 126 to 152; body cut from 1,038 words to 534. The survey tables keep their 2026-08-18 measurements, which carry the
  shape of the finding rather than a total. Still first: decision 1.
- 2026-09-10: **Scoped against a second task that lands on the same 161 rows and
  the same gate.** budget-drs's `column-primitive-across-registries-r8qiea` adds
  one property, `column_primitive`, saying what kind of thing each column holds
  (`id`, `label`, `locator`, `value`), with the doctrine in
  [docs/column-primitives.md](../../docs/column-primitives.md) and a 58-row pilot
  beside it. The two are near neighbours and not the same question: this task
  asks *where a column came from* and whether its declared `mode` matches its
  the file it sits in, that one asks *what a column contains*. They meet at
  `properties-registry.test.mjs`, which would gain assertions from both.
  Decide the order before either moves. The argument for this one first: its
  Layer 2 finding, that `pages.note` is declared `computed` while a human writes
  the 26 blurbs, means the `mode` column is currently false on some rows, and a
  second property added beside a false one inherits the falsehood.
- 2026-09-17: Layer 3 (vocabularies out of map.js) sequences after Map cleanup. Surfaced shape/order decisions as awaiting; carve Layer 3 as its own task after Map if approved.
- 2026-09-17: **The sequencing in the line above is backwards, and it was
  circular.** `align-map-view-cleanup-40afu8` had recorded the same claim in the
  other direction, so each task was waiting on the other. This task's own Stages
  list settles it: Layer 3 goes first, because it exercises the join before
  anything structural moves. Map's item 5 now waits on Layer 3 and says so.
  Layer 3 also grew a subject the survey did not name: the warning words those
  glossaries carry are not all component strings. `docs/docs.csv` holds `orphan`
  on 26 rows of `reach` and `docs/harness.csv` holds `none found` in
  `invocation`, so the six-way naming Map complains of is partly a column
  vocabulary and lands here. `docs/vocabularies.csv`, the destination the survey
  names, already exists.
- 2026-09-17: Added `## Related`, and rewrote `awaiting:` from four noun
  fragments into the decisions they stand for.
- 2026-09-17: Remeasured. Properties 152 to 178 (110/42 to 122/56).
  `column-primitive-across-registries-r8qiea` is `done` since 2026-09-10 and
  `column_primitive` is populated 178 of 178, so the ordering question this task
  has carried for a week is moot. `pages.note` is still declared `computed` while
  authored, which is the falsehood the ordering argument was about, and it is one
  row. Four of thirty registries mix and only `tests` splits cleanly. Layer 2 is
  about 35 lines. Layer 3 has moved 37 values and has not reached `docs.reach` or
  `harness.invocation`, the two that release Map's item 5. Recommended shape
  written above; size L to M.
