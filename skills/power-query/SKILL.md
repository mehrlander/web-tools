---
name: power-query
description: >
  Patterns, gotchas, and best practices for Power Query (M language). Use whenever
  the user is writing or debugging Power Query / M code, or putting queries into a
  workbook.
---

# Power Query

## Fetching and Parsing HTML

### Which fetch function to use

| Function | Returns | Use when |
|---|---|---|
| `Web.Contents(url)` | Raw binary | Default. Fast. Prefer for static HTML. |
| `Web.BrowserContents(url)` | Rendered HTML string | JS rendering required. **Significantly slower**, especially in loops. |
| `Web.Page(url)` | Table of `<table>` elements | Page has real HTML tables you want as structured data. |

### Converting binary to text

```powerquery
DocHtml = Text.FromBinary(Web.Contents(Url))
```

**Never use `Text.From()` on a binary**: it produces garbled output. Always `Text.FromBinary()`.

### Extracting links: two patterns

**Line-by-line**, for directory listings (one link per line):

```powerquery
Source       = Lines.FromBinary(Web.Contents(Url)),
ToTable      = Table.FromList(Source, each {_}, {"Line"}),
FilterLinks  = Table.SelectRows(ToTable, each Text.Contains([Line], "<A HREF=")),
ExtractHref  = Table.AddColumn(FilterLinks, "Url",
                 each Text.BetweenDelimiters([Line], "<A HREF=""", """"), type text)
```

**Split on `href=`**, for bulk extraction from a full HTML blob:

```powerquery
SplitByHref  = Text.Split(DocHtml, "href="),
LinkSegments = List.Skip(SplitByHref, 1),
Links        = List.Transform(LinkSegments,
                 each Text.BeforeDelimiter(Text.TrimStart(_, """"), """"))
```

### Attribute quoting gotchas

Quote style varies by server: always inspect the raw HTML first.

```powerquery
// Double-quoted:  href="value"
Text.BeforeDelimiter(Text.TrimStart(raw, """"), """")

// Single-quoted:  href='value'
Text.BeforeDelimiter(Text.TrimStart(raw, "'"), "'")

// Unquoted with other delimiter:  cite=19.27.097'>
Text.BeforeDelimiter(Text.AfterDelimiter(raw, "cite="), "'")
```

### Other gotchas

- **IIS directory listings use uppercase tags** (`<A HREF=`). Case-sensitive matching (e.g. `href=`) will miss them entirely.
- **Relative hrefs** need the base domain prepended manually: Power Query won't resolve them.
- **Use `Table.Buffer()`** on expensive upstream fetches to prevent redundant re-evaluation during downstream steps.
- **Separate `Excel.CurrentWorkbook()` table reads from multi-query references (Formula Firewall):** Power Query's firewall refuses a query that both reads a workbook table via `Excel.CurrentWorkbook(){[Name="..."]}[Content]` and references another query (`"references other queries or steps, so it may not directly access a data source"`). Give each workbook table its own connection-only staging query, and have downstream queries reference only queries.

## Getting M into a workbook

Writing M, adding it to a workbook and running it are separate steps. Running it needs Excel, because only Excel's Power Query engine evaluates M. A workbook stores its queries and their metadata in one `DataMashup` part. Adding them has three tested routes, the *add Power Query queries* rows of the [office crosswalk](https://github.com/mehrlander/home/blob/main/projects/office/crosswalk.csv) in `mehrlander/home`:

| Route | Needs | Use when | Record |
|---|---|---|---|
| COM: `Workbook.Queries.Add`, a `QueryTable` over `Microsoft.Mashup.OleDb.1`, `Refresh($false)` | Excel on Windows, reachable by the script | the saved workbook must already hold query results, or an existing query's M must change | [runbook](https://github.com/mehrlander/home/blob/main/projects/office/research/2026-10-30-excel-script-creation/RUNBOOK.md); mechanics in [`excel-com`](../excel-com/SKILL.md) |
| File writer: [`build_pq_xlsx.py`](https://github.com/mehrlander/home/blob/main/projects/office/research/2026-10-30-power-query-workbook/build_pq_xlsx.py) writes the `DataMashup` part | Python | no Excel is at hand, and whoever opens the workbook refreshes it | [workbook generation](https://github.com/mehrlander/home/blob/main/projects/office/research/2026-10-30-power-query-workbook/README.md) |
| Clipboard: [`Set-MashupClipboard`](https://github.com/mehrlander/home/blob/main/projects/wps/app/Modules/ExcelService/ExcelXml.ps1), then a paste into Queries & Connections | Windows and a person in Excel | a person is already working in the workbook | [clipboard serialization](https://github.com/mehrlander/home/blob/main/projects/office/research/2026-10-08-power-query-clipboard/README.md) |

None of the three runs in a browser; the [browser paste test](https://github.com/mehrlander/home/blob/main/projects/office/research/2026-10-08-browser-query-paste/README.md) is the record.

### The file writer's format

In [`build_pq_xlsx.py`](https://github.com/mehrlander/home/blob/main/projects/office/research/2026-10-30-power-query-workbook/build_pq_xlsx.py), `parse_mashup_xml` reads a Mashup XML document, the form `Set-MashupClipboard` takes, and `inject_power_query_into_xlsx` writes these parts:

1. **The query package**, a zip of `[Content_Types].xml`, `Config/Package.xml` and `Formulas/Section1.m`: `section Section1;`, then `[ Description = "..." ] shared Name = ...;` for each query.
2. **The DataMashup stream**, laid out by Microsoft's [Query Definition File Format](https://learn.microsoft.com/en-us/openspecs/office_file_formats/ms-qdeff/) specification (MS-QDEFF), each length a little-endian uint32: version `0`, package length, package, permissions length, permissions XML, metadata length, metadata, and a permission bindings length of `0`. Excel's own saves hold an encrypted blob in the permission bindings, bound to the saving machine by Windows DPAPI; desktop Excel 16.0 opened and refreshed a file whose bindings were empty, without a prompt or a repair. In the metadata's `LocalPackageMetadataFile.xml`, a connection-only query has `FillEnabled` `l0` and `FillObjectType` `sConnectionOnly`; a loaded one has `FillEnabled` `l1`, `FillObjectType` `sTable` and `FillTarget` `s<TableName>`. `ResultType` is `sText` for a text parameter query and `sTable` otherwise.
3. **The workbook parts:** the stream, base64-encoded in `<DataMashup xmlns="http://schemas.microsoft.com/DataMashup">`, as `customXml/item{N}.xml`; and for each loaded query a type 5 connection in `xl/connections.xml` (`Provider=Microsoft.Mashup.OleDb.1;Data Source=$Workbook$;Location=<Query>`, command `SELECT * FROM [<Query>]`), a hidden `ExternalData_N` defined name, and a `tableType="queryTable"` table with its `xl/queryTables/` part. The writer keeps the workbook's existing sheets, tables, formulas and comments.

From reading the writer: its tables hold placeholder rows until Excel refreshes; it cannot edit existing queries, and on a workbook that has them it writes a second `DataMashup` part, untested; and its output differs on every run, since it stamps random ids and the current time.

Desktop Excel saves `customXml/item*.xml` as UTF-16LE with a `FF FE` byte-order mark. A reader has to decode that before it can match `<DataMashup>`; web-tools' [`xlsxKit.readZip`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/xlsx.js) does.
