---
name: power-query
description: >
  Patterns, gotchas, and best practices for Power Query (M language). Use whenever
  the user is writing or debugging Power Query / M code.
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

## Packaging M in a closed `.xlsx` (MS-QDEFF `DataMashup`)

To generate an `.xlsx` workbook containing a live, refreshable Power Query (`M`) expression without running desktop Excel (see `projects/office/research/2026-10-30-power-query-workbook/build_pq_xlsx.py`):

1. **Build the inner OPC ZIP (`Formulas/Section1.m`):**
   - Include `[Content_Types].xml`, `_rels/.rels`, `Config/Package.xml`, and `Formulas/Section1.m` (`section Section1; shared QueryName = let ... in ...;`).
2. **Assemble the MS-QDEFF binary stream:**
   - Concatenate `[Version: uint32 = 0]` + `[PkgLen: uint32]` + `[Inner OPC ZIP]` + `[PermissionsLen: uint32]` + `[Permissions XML]` + `[MetaLen: uint32]` + `[Metadata Stream]` + `[EndLen: uint32 = 0]`.
   - Writing four zero bytes (`\x00\x00\x00\x00`) for the trailing Permission Bindings length omits the machine-bound Windows DPAPI blob while allowing desktop Excel to open and refresh (`Workbook.RefreshAll()`) without prompts or repair warnings.
3. **Wrap in `customXml/item1.xml` and wire the workbook parts:**
   - Base64-encode the binary stream inside `<DataMashup xmlns="http://schemas.microsoft.com/DataMashup">...</DataMashup>` (desktop Excel writes `customXml/item1.xml` as UTF-16LE with a `FF FE` byte-order mark; ZIP readers must decode UTF-16LE/BE before matching `<DataMashup>`).
   - Pair with `xl/connections.xml` (`type="5"`, `<dbPr connection="Provider=Microsoft.Mashup.OleDb.1;Data Source=$Workbook$;Location=QueryName" command="SELECT * FROM [QueryName]"/>`), a hidden `<definedName name="workbook_Connection_..." hidden="1">` in `xl/workbook.xml`, and a `QueryTable`-backed worksheet table (`xl/tables/table1.xml` + `xl/queryTables/queryTable1.xml`).

