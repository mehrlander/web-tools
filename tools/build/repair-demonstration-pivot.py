"""Prepare the original demo for an Excel refresh; never fabricate result caches.

Usage: python tools/build/repair-demonstration-pivot.py INPUT.xlsx OUTPUT.xlsx
Open OUTPUT in Excel, refresh all, calculate, save, then run the fixture tests.
The input is the pre-cleanup demonstration workbook from PR 792, not a generic
workbook. ZIP parts unrelated to this repair retain their original bytes.
"""
import re
import sys
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile

source, destination = map(Path, sys.argv[1:])
if source.resolve() == destination.resolve():
    raise SystemExit("Use a different output path; keep the source evidence.")
with ZipFile(source) as src:
    cache = src.read("xl/pivotCache/pivotCacheDefinition1.xml").decode()
    old = '<worksheetSource ref="B5:N30" sheet="RawData"/>'
    if old not in cache:
        raise SystemExit("Expected the original RawData B5:N30 PivotTable source.")
    cache = cache.replace(old, '<worksheetSource name="Financials"/>')
    cache = cache.replace('<pivotCacheDefinition ', '<pivotCacheDefinition refreshOnLoad="1" ')
    sheet = src.read("xl/worksheets/sheet4.xml").decode()
    if 'ref="B2:F9"' not in sheet:
        raise SystemExit("Expected the original four-row reconciliation sheet.")
    rows = []
    for row, column, caption in [(10, "Budget", "Sum of Budget"), (11, "Actual", "Sum of Actual"), (12, "Variance", "Variance ($)")]:
        cells = []
        for col, text in [("B", f"PivotTable {column}: source data vs grand total"), ("C", f"Financials[{column}]"), ("D", f"FinancialPivot: {caption}")]:
            cells.append(f'<c r="{col}{row}" t="inlineStr"><is><t>{escape(text)}</t></is></c>')
        formula = f'ABS(SUM(Financials[{column}])-GETPIVOTDATA("{caption}",PivotSummary!$B$5))'
        cells.append(f'<c r="E{row}" s="12"><f>{escape(formula)}</f></c>')
        status = f'IFERROR(IF(E{row}=0,"PASS: EXACT MATCH","FAIL"),"FAIL")'
        cells.append(f'<c r="F{row}" s="13" t="str"><f>{escape(status)}</f></c>')
        rows.append(f'<row r="{row}" spans="2:6">{"".join(cells)}</row>')
    sheet = sheet.replace('ref="B2:F9"', 'ref="B2:F12"').replace('</sheetData>', ''.join(rows) + '</sheetData>')
    workbook = src.read("xl/workbook.xml").decode()
    workbook = re.sub(r'<calcPr\b[^>]*/>', '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>', workbook)
    replacements = {"xl/pivotCache/pivotCacheDefinition1.xml": cache.encode(), "xl/worksheets/sheet4.xml": sheet.encode(), "xl/workbook.xml": workbook.encode()}
    destination.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(destination, "w") as dst:
        for entry in src.infolist():
            dst.writestr(entry, replacements.get(entry.filename, src.read(entry)))
print(f"Prepared {destination}; Excel must refresh, calculate, and save it.")
