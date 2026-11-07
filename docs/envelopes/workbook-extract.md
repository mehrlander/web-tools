# Workbook extract: the payload contract

A workbook extract takes chosen parts of an `.xlsx` workbook out of the file as JSON, so the extract can be shared by link or committed to a repo without sending the workbook itself, which may hold private sheets. An extract is how a workbook dropped into the Web Tools app reaches a repo that has declared in advance which of the workbook's sheets it wants ([Receptions](#receptions-a-receiving-repos-standing-pick)). This document is the contract for that JSON, for anyone writing code that makes or reads an extract and for the author of a repo that receives one. An extract holds rows, cell records, formulas and pivot records; the workbook cannot be rebuilt from one. [`lib/kits/xlsx-extract.js`](../../lib/kits/xlsx-extract.js) writes extracts, [`pages/data-view.html`](../../pages/data-view.html) opens them without any change to that page, and [`schemas/workbook-extract-v2.schema.json`](schemas/workbook-extract-v2.schema.json) describes the current format. The original format keeps its [v1 schema](schemas/workbook-extract-v1.schema.json).

Terms used below:

- **Envelope**: the extract's top-level JSON object, with `kind`, `title`, `source`, `taken`, `picked`, `left` and `items`.
- **Item**: one entry in the envelope's `items` array, holding one reading of one sheet, or of the whole workbook.
- **Reading**: one kind of content taken from a sheet or a workbook, such as `values` (the rows as the sheet displays them) or `formulas`. The pick (the selection passed to `extractSelected`, shown under [Sheet-centered selection](#sheet-centered-selection-v2)) and the v1 envelope call a reading a `kind`. The [readings table](#readings) lists all fourteen.
- **Object**: a pivot table, pivot cache, connection or Power Query section, selected on its own rather than with a sheet.
- **Picker**: the selection list in the Overview of Structure mode, one of the modes of the file viewer ([`lib/alpineComponents/viewer.js`](../../lib/alpineComponents/viewer.js)) that `pages/data-view.html` and the Web Tools app both use.
- **Stage**: the Web Tools app's list of files that its Send button delivers to a repo ([Staging an extract](#staging-an-extract)).
- **Reception**: a default selection that a repo declares, in the `receptions` field of its `.web-tools.json`, for a workbook it expects to receive ([Receptions](#receptions-a-receiving-repos-standing-pick)).

## Sheet-centered selection (v2)

In the picker, selecting a sheet adds that sheet's `values` reading or, when a reception applies, the readings the reception names. Each of the sheet's other readings is selected separately. Objects are listed after the sheets and selected one by one. Each object names its associated sheet where one is known: the sheet a pivot table sits on, or a pivot cache's source sheet when that sheet is in the workbook. Selecting a sheet selects none of its objects. An included pivot table may name a sheet that was left out, and a pivot cache may hold rows from a sheet other than the one it names.

`XlsxExtract.catalog(result)` returns the sheets in workbook order, each with a count for every reading the sheet supports, and lists the objects separately. `XlsxExtract.extractSelected(result, pick, opts)` takes a pick of this shape:

```js
{
  sheets: [
    { name: 'Budget', kinds: ['values', 'formulas', 'columns'] },
    { name: 'Notes', kinds: ['values'] }
  ],
  objects: ['pivot:xl/pivotTables/pivotTable1.xml'],
  headerRow: 1
}
```

`extractSelected` returns a `workbook-extract/2` envelope whose items have data-view's item shape:

- `picked.sheets` lists the readings chosen for each sheet, and `picked.objects` each chosen object's ID, type (pivot table, pivot cache, connection or Power Query section), label and associated sheet.
- `left.sheets`, `left.sheetKinds` and `left.objects` list what was not chosen: whole sheets, readings on chosen sheets, and objects.
- An object's item has an `object` field holding its ID and, where known, a `sheet` field.
- Table content is JSON rows; Power Query content is M source text.

Charts and VBA are not modeled, so they cannot be selected. Pivot cache records are parsed as rows; the workbook reader keeps at most 20,000 rows per cache and marks the item `truncated` when the cache held more.

## Legacy cross-product selection (v1)

A v1 pick is two lists, sheets and readings, and every chosen reading is taken from every chosen sheet. `XlsxExtract.extract(result, pick, opts)` still accepts it.

## Readings

A sheet reading gives one item for each selected sheet that has any content of that kind. A workbook reading gives one item however many sheets are selected, and its `sheet` is null.

| id | scope | one item row per | holds |
| --- | --- | --- | --- |
| `values` | sheet | sheet row | each cell as the sheet displays it; a date reads as a date, not a serial number |
| `raw` | sheet | sheet row with a value | numbers as numbers, dates and times as ISO text, TRUE and FALSE as booleans |
| `cells` | sheet | one object per sheet | every cell as `{Address, Formula, Value}`, plus `Dimension` and `MergedCells` (below) |
| `formulas` | sheet | cell with a formula | the stored formula text, and the cell's value |
| `styles` | sheet | styled cell | each cell's style, reduced to what the cell draws |
| `merges` | sheet | merged range | the range, and the value its first cell shows |
| `comments` | sheet | comment | the cell comments |
| `validations` | sheet | validation rule | the data-validation rules |
| `conditional` | sheet | rule | the conditional-format rules as written, with the format each applies |
| `columns` | sheet | column | a profile of each column: its role, value type, share filled and distinct values |
| `pivots` | workbook | pivot table | each pivot table, joined to its cache |
| `records` | workbook | cache row | the rows of each pivot cache, one item per cache |
| `sources` | workbook | connection | the data connections |
| `queries` | workbook | Power Query section | the M source of each section, one item per section |

## Limits of particular readings

- `formulas` holds only the text the file stores. Cells that share another cell's formula store none of their own, so they arrive with an empty `Formula`, and the item's note counts them. Filling them in would mean rewriting each cell's relative references, which needs a formula engine this kit does not have.
- `conditional` holds the rules as written. Which cells a rule paints is answered by `xlsxKit.cfApplies`, for the rule types decidable from one cell.
- `cells` is the shape `Get-WsDetail`, a PowerShell exporter in the [`mehrlander/home`](https://github.com/mehrlander/home) repo, writes, and the fund-balance view there reads ([`workbook-fill.js`](https://github.com/mehrlander/home/blob/main/projects/budget-drs/app/fund-balance/workbook-fill.js)): `{ SheetName, Dimension, MergedCells: ['A1:B1', …], Cells: [{ Address, Formula, Value }, …] }`. `Value` is the cell's cached value as a string with no number format applied, `35624913.378` rather than `35,624,913`, because a reader can parse the first and not the second. `Formula` is `''` for an entered value and `=<text>` for a stored formula. A cell that shares another cell's formula gets `=[fill N] <master formula>`, where N is the shared formula's index in the file and the text is the formula of the cell that stores it. `workbook-fill.js` resolves the marker by shifting the master formula's relative references, so the formula engine stays on that side. The row cap never applies to `cells`, because a partial sheet in this shape would pass for a whole one.
- There is no layout reading. `xlsxKit.sheetLayout` returns a sheet's geometry for the viewer's sheet mode; cell appearance is in `styles`.

## Shared envelope facts

These fields appear in both versions:

- `source` is the workbook's address: `repo`, `ref`, `path`, `name`, `bytes`. It is null for a file dropped on a page, which has a name and bytes but no repo address. Only a `ref` that is a commit SHA identifies the same bytes later.
- `taken` is when the extract was made.
- `picked` and `left` record what was chosen and what was not, so a reader can tell a partial selection from the whole workbook. In v1 they are complements over the workbook's sheets and readings. In v2 they hold the fields listed under [Sheet-centered selection](#sheet-centered-selection-v2).
- Per item, `rows`, `total` and `truncated` say whether the item holds less than the workbook does. `note` says the same in words, and data-view shows a note without knowing anything about this format.

## Item names

An item is named `<sheet>.<reading>[.<label>].json`, and `#item=` opens an item by its name, so names must not collide. The sheet name is reduced to filename characters, `workbook` stands in for a workbook-wide reading, and a numeric suffix separates two sheets whose names reduce to the same text. A pivot cache is labelled by the range it was built from, since a cache has no name of its own.

## Delivery

An extract reaches data-view by the routes in [`data-view.md`](data-view.md#delivery), the first that matches winning: `#gz=` encodes the extract in the link itself, `?src=` reads a committed file, and `#data=` is a shorthand that resolves to `?src=`. `io.saveJson` saves an extract to disk. A `#gz=` link is as long as the compressed extract, and a long enough link is refused or cut off by the apps that would pass it on. So `maxRows` (2000 by default) caps the rows of each table, the picker shows the extract's size before giving out a link, and a capped item says so through `truncated`.

## Receptions: a receiving repo's standing pick

A repo declares a reception in the `receptions` field of its [`.web-tools.json`](../manifest.md) (fields in [`manifest-fields.csv`](../manifest-fields.csv)). A reception says which sheets identify the workbook, which to leave out, which readings to take, and where the extract goes:

```jsonc
"receptions": [{
  "id": "source-workbook",
  "label": "Budget DRS source workbook",
  "omit": ["hidden"],
  "never": ["CC", "Cash"],
  "readings": ["cells"],
  "dest": "projects/budget-drs/data/source/{slug}",
  "file": "{date}-{time}-{sheet}.json"
}]
```

- **Naming.** `id` is the reception's stable key, and `label` the name the picker shows.
- **Matching.** `match.sheets` names sheets that must all be present; a reception without it applies to every workbook opened in Structure mode. Receptions are tried in order, so a specific one goes before a general one. Matching is by sheet names, not by file name, because a workbook is renamed more often than its sheets.
- **The default selection.** `XlsxExtract.receptions(catalog, declared)` returns every sheet not omitted, each with the declared `readings` it has. The Overview opens with that selection and the reception's `cap` (below), with a line above the list naming the reception, its repo and its destination, and a list marking each sheet `in` or `out`. The selection can be changed: what is selected when the Stage button is pressed is what goes.
- **`omit`** takes sheet names and the token `hidden`, which omits every sheet the workbook hides. Hiding a sheet in Excel therefore keeps it out, and renaming it does not bring it back.
- **`never`** names sheets that must not reach the repo even when `omit` misses them, as when a private sheet is unhidden for editing and the workbook is dropped before it is hidden again. Such a sheet stays selected and is drawn in the error colour, in the `in`/`out` list and in its Overview row, and the Stage button is disabled and names it. Dropping it silently would show a clean selection in the case where the reader most needs a warning. Save, Link and Open stay available, because they give the extract to the reader. Both `omit` and `never` have to fail before a private sheet reaches a repo.
- **Placeholders** in `dest` and `file`: `{date}` is the UTC day, `{time}` the UTC hour and minute as `HHMM`, `{stem}` the workbook's file name without its extension in filename characters, `{slug}` that stem lowercased, and `{sheet}` the one selected sheet's name in filename characters, lowercased, or `workbook` when several are selected. One folder per workbook and one stamped file per extract keep every version: extracts made a minute or more apart, or of different sheets, get different paths. `file` defaults to `{stem}.extract.json`.
- **`cap`** is the per-table row limit for the extract this reception makes. It defaults to none, because a staged extract is a file.
- **What the extract can still reveal.** The workbook's bytes stay in the browser, so a workbook with private sheets can be dropped safely. An omitted sheet's cached values still appear in the extract wherever a taken sheet's formula reads them. `left.sheets` names the omitted sheets.

## Staging an extract

**Stage for `<repo>`** adds the extract to the stage as a text file named by the reception. It removes the dropped workbook from the stage, so a Send cannot deliver it, points the stage at the reception's `repo:dest`, and opens the stage; sending is a separate tap. The JSON preview in the Overview shows the same JSON that Save writes, a link encodes and Stage adds. The preview opens the content of one included item at a time. Receptions are read from every repo the app lists, the same way the app reads each repo's page declarations, so a workbook can be dropped while browsing any of them. Anything particular to one workbook belongs in the receiving repo's reception, so that the extract kit, the file viewer and the stage stay the same for every workbook.

## Seeing it

[`docs/examples/allotment-ledger.xlsx`](../examples/allotment-ledger.xlsx) is a sample workbook built by [`node/build/sample-workbook.mjs`](../../node/build/sample-workbook.mjs) (`npm run sample-workbook`, held to the generator by `--check`), with enough content that every reading and the row cap show. `npm run sample-workbook -- --link --at <sha> --use <sha>` prints the address that opens it. Build the link with the command: data-view reads the workbook from `?src=`, not from `#data=`, and the command checks the link's length. In the page, pick **Structure** from the mode menu at the right of the file line; Structure opens on **Overview**, which holds the picker. The minimal test fixture in [`node/test/viewer-xlsx.mjs`](../../node/test/viewer-xlsx.mjs) is separate from this sample.

## Why this is a profile over data-view rather than a sibling

An extract reuses data-view's envelope, with extra fields, instead of a format of its own, because the three tests in [README.md](README.md#the-decision-chat-results-stays-a-sibling) that gave chat results their own format all point the other way here. Every reading serializes to rows or source text, which a data-view item holds. `DataPayload.isEnvelope` already accepts an extract, so data-view renders one with no change to [`lib/kits/data-payload.js`](../../lib/kits/data-payload.js). The one thing data-view lacks is provenance (`source`, `picked`, `left`), and the schema exists mainly to keep `source.ref` reliable.

Revisit the choice if a second producer makes extracts whose items are not data-view items, such as a `.csv` bundle, or if a reader needs to re-run an extract, which would need the picker's state rather than `picked`.
