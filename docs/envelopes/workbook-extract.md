# Workbook extract: the payload contract

Part of an `.xlsx` workbook, picked and carried as **data**. Nothing is written
back to the workbook and nothing is reconstructed from the extract. The current
Structure → Extract picker is sheet-centered: selecting a sheet includes its
available readings, then each reading can be unticked independently. Pivot
tables, cached pivot records, connections, and Power Query sections are
individual choices.

Written by [`lib/kits/xlsx-extract.js`](../../lib/kits/xlsx-extract.js), read by
[`pages/data-view.html`](../../pages/data-view.html) with no change to that page,
and described by
[`schemas/workbook-extract-v2.schema.json`](schemas/workbook-extract-v2.schema.json).
The original cross-product API and its
[`v1 schema`](schemas/workbook-extract-v1.schema.json) remain available.

## Sheet-centered selection (v2)

`XlsxExtract.catalog(result)` returns sheets in workbook order, with counts
for their nine supported readings, and separately lists each modeled object.
The UI shows a pivot table under the sheet where it sits and a pivot cache
under its source sheet when that sheet is in the workbook. This is an
association for navigation, not an inclusion rule: selecting a sheet does not
select any related object. A cache may contain rows from a different sheet.

`XlsxExtract.extractSelected(result, pick, opts)` accepts:

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

The returned `workbook-extract/2` envelope keeps the data-view `items` shape.
`picked.sheets` records the kinds chosen for each sheet; `picked.objects`
records the selected object's ID, kind, label, and associated sheet.
`left.sheets`, `left.sheetKinds`, and `left.objects` state what was omitted.
An object's item has an `object` ID, and its `sheet` names the associated sheet
where known. Table content is JSON rows; query content is M source text. The
picker previews the exact JSON it saves or compresses into a share link, and
lets the reader inspect one included item's content at a time.

This is a selective reading, not a redaction of references. An included pivot
can still name an omitted source sheet. Charts and VBA are not modeled by the
extract kit, so neither appears as a selectable object. Pivot cache records are
parsed as rows, not carried as binary; the underlying workbook reader retains
at most 20,000 cache rows and reports `truncated` when the cache held more.

## Legacy cross-product selection (v1)

### The two axes

**Which sheets**, and **which kinds of reading**. They cross and they do not
nest, which is the whole character of the format: "values and comments from two
sheets" and "every pivot in the file" are the same gesture at different points
of one matrix, so both axes are flat lists rather than a tree of sheets each
carrying kinds.

Thirteen kinds. The first nine are read per sheet and appear once per picked
sheet that has any; the last four are read once per workbook, appear once
however many sheets are picked, and carry a null `sheet`.

| id | scope | one row per | reads |
| --- | --- | --- | --- |
| `values` | sheet | sheet row | `sheetRows`, so a date is a date rather than a serial |
| `cells` | sheet | one object per sheet | every cell as `{Address, Formula, Value}`, plus `Dimension` and `MergedCells`: the serialized-workbook shape, below |
| `formulas` | sheet | computed cell | the stored formula text, and the value beside it |
| `styles` | sheet | styled cell | `cellStyle`, flattened to what the cell draws |
| `merges` | sheet | merged range | the span, and the value its anchor draws |
| `comments` | sheet | comment | `workbookNotes`, the comment half |
| `validations` | sheet | validation **rule** | `workbookNotes`, the form-instruction half |
| `conditional` | sheet | rule | the rules as written, with the format each applies |
| `columns` | sheet | column | `profileColumns`: role, kind, fill, distincts |
| `pivots` | workbook | pivot table | `views.pivots`, joined to its cache |
| `records` | workbook | cache row | `pivotRecords`, one item per cache |
| `sources` | workbook | connection | `views.sources` |
| `queries` | workbook | M section | `xl.powerQuery`, as source rather than as a table cell |

Two of these produce **several items** rather than one: a workbook has one
records table per pivot cache and one M section per query part, and folding
those together would lose which cache or which section a row came from.

### What each kind is not

`formulas` reports the text the file stored. A **shared** formula's followers
store none of their own (the master carries the text and every cell after it
carries `<f t="shared" si="0"/>`), so those arrive with an empty `Formula` and
the item's note says how many. Recovering them means rewriting relative
references per cell, which is a formula engine.

`conditional` reports the rules as the file states them. Which cells Excel would
actually paint is a second question, answered by `xlsxKit.cfApplies` and only for
the rule types decidable from a cell alone.

`cells` is the one kind that is not a table and is never cut. It is the shape
home's PowerShell exporter (`Get-WsDetail`) writes and the fund view's reader
(home's `projects/budget-drs/app/fund-balance/workbook-fill.js`) consumes, one object per sheet:
`{ SheetName, Dimension, MergedCells: ['A1:B1', …], Cells: [{ Address, Formula,
Value }, …] }`. `Value` is the cached value as a string, raw rather than
formatted, because a reader parses `35624913.378` and cannot parse
`35,624,913`. `Formula` is `''` for an entered cell and `=<text>` where the file
stored text. A shared formula's follower stores none, and here the reading does
what `formulas` above declines to: it writes `=[fill N] <master text>`, the
master's own text under the shared index, which is exactly what Get-WsDetail
emits and what `workbook-fill.js` resolves by shifting the master's relative
references. Still no formula engine on this side; the marker hands the
follower to the reader that has one. A partial sheet in this shape would read
as a whole one, which is why the cap does not apply to it.

There is no `layout` kind. `xlsxKit.sheetLayout` returns a sheet as geometry,
which is an input to a renderer rather than a table, and it already has a
renderer in the viewer's sheet mode. The appearance that is tabular is `styles`.

## Shared envelope facts

**Where it came from.** `source` is the workbook's address (`repo`, `ref`,
`path`, `name`, `bytes`) and `taken` is when the extract was made. `source` is
null where the workbook has no address: a file dropped onto a page has bytes and
a name and nothing else, and saying so beats minting a repo path it never had.
A `ref` that is a commit SHA is the only form that still resolves to these bytes
later.

**What was left behind.** In v1, `picked` and `left` are complements over the
workbook's sheets and the thirteen kinds. In v2, they record each selected
sheet's readings, the omitted readings on that sheet, and individually chosen
or omitted objects. Without `left`, a reader cannot tell a partial selection
from the whole file.

Per item, `rows` against `total` plus `truncated` say whether that item is short
of what the workbook holds. The habit is `pivotRecords`': report the cut rather
than apply it silently, so a reader sees the edge instead of discovering it. The
same fact is written into the item's `note`, derived from the record in the same
function, so today's data-view reader shows it without knowing this format
exists.

This is a v1 example; the v2 selection shape is above.

```jsonc
{
  "kind": "workbook-extract/1",
  "title": "ledger.xlsx: values, comments",
  "source": { "repo": "mehrlander/home", "ref": "abc1234",
              "path": "x/ledger.xlsx", "name": "ledger.xlsx", "bytes": 58122 },
  "taken": "2026-09-14T00:00:00.000Z",
  "picked": { "sheets": ["Ledger"], "kinds": ["values", "comments"] },
  "left":   { "sheets": ["Notes"],  "kinds": ["formulas", "styles", "…"] },
  "items": [
    { "name": "Ledger.values.json", "view": "table", "note": "2 of 4 rows",
      "sheet": "Ledger", "kind": "values", "rows": 2, "total": 4, "truncated": true,
      "content": "[{\"Row\":1,\"A\":\"Fund\",\"B\":\"Spend\"}]" }
  ]
}
```

## Item names are addresses

A name is how `#item=` reaches one item of an envelope, so a collision is a link
that opens the wrong thing. Names are `<sheet>.<kind>[.<label>].json`, with the
sheet name reduced to filename characters, `workbook` standing in for a
workbook-scoped kind, and a numeric suffix where two sheets reduce to one stem.
A pivot cache's label is the range it was built from, since a cache has no name
of its own and the part filename says nothing a reader knows.

## Delivery

An extract is bytes, so it travels the routes
[`data-view.md`](data-view.md#delivery) already describes, first match wins:
`#gz=` carries it in a link with no server, `?src=` reads a committed one, and
`#data=` is the toss shorthand onto `?src=`. `io.saveJson` writes it to disk.

The `#gz=` route is the one with an edge worth knowing: a fragment is a URL, and
a large extract makes a link nothing will carry. That is why the cap is a
parameter (`maxRows`, 2000 by default) and why the picker states the payload's
size before the link is handed over. A cut extract is honest; a link that was
silently trimmed to fit is not.

## Receptions: a receiving repo's standing pick

A repo can say in advance what it wants from a workbook it expects to receive.
`receptions` in its `.web-tools.json` (fields in
[`manifest-fields.csv`](../manifest-fields.csv)) declares, per expected
workbook: the sheets that identify it, the sheets to leave behind, the
readings to take, and where the extract lands.

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

The receiver declares it and the picker runs it. A reception with no
`match.sheets` applies to every workbook opened in the viewer's Structure
mode; one that names sheets applies only where all of them are present.
`XlsxExtract.receptions(catalog, declared)` returns the pick (every sheet not
omitted, with the readings it has any of), the Extract tab opens with that
pick ticked and the reception's cap, and a band names the reception, its repo,
and the destination, with no sentence beside them: the unticked sheets say
what is left behind.

`omit` takes names and the token `hidden`. The token leaves behind every sheet
the workbook hides, which makes hiding a sheet in Excel the whole gesture for
keeping it out of the repo: no name to keep in step with the manifest, and a
rename does not undo it. The two union, so a sheet named in `omit` or hidden is
kept back either way.

`never` is the backstop for the mirror-image failure, which is real: unhide a
private sheet to work on it, forget, and drop the workbook, and `omit` alone
takes it. A sheet named there is **reported rather than dropped**. It stays in
the pick, the roster and its row draw it in the error colour, and the Stage
button goes dark and names it instead of handing anything over. Dropping it
quietly would be the worse fix, since the reader would see a clean pick and
learn nothing in exactly the case the usual signal lapsed. `omit` decides what
is taken; `never` decides what may not be, and both have to lapse for a private
sheet to reach a repo.

## Staging an extract

The picker's preview pane shows the serialized envelope, the same string Save
writes, the link carries, and Stage puts on the stage, so what is read is what
travels. **Stage for `<repo>`** puts the envelope on the stage as a text file
under the reception's name, takes the dropped workbook off the stage (a Send
carries every staged item, and the bytes are what the reception exists to keep
back), aims the stage at `repo:dest`, and switches to it; Send is still the
reader's own tap. Declarations are collected across the estate the way
`pages[].appView` is, so the workbook can be dropped while browsing any repo.
Nothing about any one workbook lives in the kit, the viewer, or the stage.

Matching, where a reception matches at all, is by sheet set rather than file
name, because a workbook is renamed more often than its tabs are; declarations
are tried in order, so a specific one listed before a general one wins. The
pick is the opening state, not a lock: what is ticked at Stage is what travels.
The workbook's bytes never leave the browser, so a workbook holding sheets that
stay private can be dropped. The omitted sheets' cached values still ride along
wherever a taken sheet's formula reads them, and `left.sheets` says which
sheets were declared away.

`{date}` in `dest` or `file` is the UTC day and `{time}` the UTC hour and
minute as `HHMM`; `{stem}` is the workbook's name without its extension,
reduced to filename characters; `{slug}` is that stem lowercased, for a folder
convention that wants it; `{sheet}` is the one picked sheet's name, slugged, or
`workbook` when several are picked. One folder per workbook and one file per
extract, stamped, is the shape that collects versions without overwriting:
two extracts a minute apart, or of two sheets, never share a path. `file` defaults to
`{stem}.extract.json`. `cap` defaults to null, since a landed extract is a file
rather than a link.

## Seeing it

[`docs/examples/allotment-ledger.xlsx`](../examples/allotment-ledger.xlsx) is a
sample workbook built by
[`node/build/sample-workbook.mjs`](../../node/build/sample-workbook.mjs)
(`npm run sample-workbook`, held to the generator by `--check`), sized so every
kind and the picker's cap show. `npm run sample-workbook -- --link --at <sha>
--use <sha>` prints the address that opens it; use the command rather than
writing the link, since it holds the two traps its `--link` code names
(`?src=`, not `#data=`, and the link-length limit). In the page, pick **Structure** from the
mode menu at the right of the file line; **Extract** is the last tab in its
strip. The minimal fixture in
[`node/test/viewer-xlsx.mjs`](../../node/test/viewer-xlsx.mjs) stays separate
from this sample.

## Why this is a profile over data-view rather than a sibling

The three tests of the [chat-results decision](README.md#the-decision-chat-results-stays-a-sibling)
give the opposite answer here:

1. **The shapes do not differ structurally.** Every kind serialises to a table
   of rows or a block of source text, which a data-view item carries (`content`
   a string, `view` the mode, `note` a line).
2. **The convergence has happened.** `DataPayload.isEnvelope` admits an object
   whose `items` entries carry `content`, `src` or `name`, whatever its `kind`,
   so an extract renders in `pages/data-view.html` with no change to
   [`lib/kits/data-payload.js`](../../lib/kits/data-payload.js).
3. **A concrete need is asking:** provenance, which data-view deliberately does
   not carry. An extract that cannot say which file, which ref, and what it left
   out is a table with no way back to what it is a reading of.

So: a profile, not a sibling. The reader is data-view's, unchanged. The schema
constrains what data-view leaves open rather than restructuring it, and it
exists for the provenance block: an unvalidated `items` array is fine because
the reader falls back on what it does not understand, while a `ref` that is
sometimes a SHA, sometimes a branch and sometimes absent is worse than no
provenance at all.

**When to revisit:** a second producer of workbook-shaped extracts (a `.csv`
bundle, a Word table set) whose items are not data-view items, or a reader that
wants to re-run an extract rather than read it, which needs the picker's own
state rather than `picked`.
