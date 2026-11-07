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

| Route | Use when | Code |
|---|---|---|
| COM: `Workbook.Queries.Add`; mechanics in [`excel-com`](../excel-com/SKILL.md) | the saved workbook must already hold results, or an existing query's M must change | [`New-PowerQueryDemo.ps1`](https://github.com/mehrlander/home/blob/main/projects/office/research/2026-10-30-excel-script-creation/New-PowerQueryDemo.ps1) |
| File writer, in Python | no Excel is at hand; the workbook shows results once someone refreshes it in Excel | [`build_pq_xlsx.py`](https://github.com/mehrlander/home/blob/main/projects/office/research/2026-10-30-power-query-workbook/build_pq_xlsx.py) |
| Clipboard: paste into Queries & Connections | a person is already working in the workbook | [`Set-MashupClipboard`](https://github.com/mehrlander/home/blob/main/projects/wps/app/Modules/ExcelService/ExcelXml.ps1) |
