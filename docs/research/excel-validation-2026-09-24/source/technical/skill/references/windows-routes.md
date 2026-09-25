# Choose the engine for the operation

PowerShell, Python, and VBA are orchestration choices. Their ability to reach Excel's object model does not imply that every library written in those languages uses Excel.

| Route | Engine and appropriate use | Calculation and rendering boundary |
| --- | --- | --- |
| PowerShell COM | Installed Excel; native tables, pivots, charts, properties, saves, and exports. Practical default when PowerShell and Excel are already usable. | Excel computes and renders. COM registration is not proof of successful activation in the current session. |
| Python `win32com` | The same native Excel COM object model, with Python orchestration. | Native Excel computation/exports; requires a compatible installed bridge and accessible Excel session. |
| Python desktop xlwings on Windows | Convenience wrappers around Excel; `.api` exposes the native object. | Native Excel; wrapper coverage may differ from the underlying API. |
| VBA inside Excel | The same native object model from inside the application. Useful for existing workbook/macro workflows. | Native Excel. A new macro-enabled artifact or changed trust setting is not necessary just to investigate a plain workbook. |
| Python openpyxl | Reads/writes supported OOXML structures; useful for package inspection and controlled authorship. | Does not evaluate formulas or supply Excel's renderer. `data_only` reads stored values. Saving can lose unsupported content. |
| Python XlsxWriter | Creates new workbooks and chart definitions. Does not read or modify existing workbooks. | Does not calculate formulas; normally stores a zero result with recalculation requested unless a cached result is supplied. Excel must open/calculate/render to provide native evidence. |
| PowerShell ImportExcel / EPPlus | Normal import/export operations manipulate workbook packages without Excel. | Its calculation uses the bundled EPPlus engine, not Excel. Some included chart-export helpers separately launch COM: inspect the actual function. |
| Direct ZIP/XML or other file generators | Explicit file construction/inspection; useful for controlled fixtures and examining writer differences. | Valid XML and valid relationships do not establish native calculation or rendering fidelity. |

Use the existing route that reaches the behavior under test. Comparing several languages that issue identical COM calls is mainly an orchestration test. Comparing a file writer with native Excel tests serialization choices, defaults, and preservation as well.

## Capture choices

- **Chart.Export:** native graphic output of a chart. Fix object dimensions and inspect the decoded image. Test any requirement to activate a chart/sheet in this environment before generalizing it.
- **Range.CopyPicture:** picture of a range via the clipboard. Account for clipboard use and the chosen screen/printer appearance; output is not inherently a file until captured/exported. Avoid disrupting user clipboard activity when another route suffices.
- **ExportAsFixedFormat:** native PDF/XPS with print-area, scaling, and pagination semantics. Useful for print previews; do not compare page margins with an unpaginated grid as if they were layout defects.
- **Screen capture:** records the visible application view. Identify the actual window, region, zoom and display scaling. It can include UI, selection, or occlusion; inspect and bound the capture.

An apparently hidden Excel instance may still require an interactive desktop for some operations. Test the route; do not describe it as fully headless based only on `Visible = false`. Excel is a desktop application with modal dialogs and shared resources. Serial task-owned jobs with timeouts are a starting point; a service or permanent queue is a separate implementation task.

For calculation experiments, compare formula strings and results. Excel's `CalculateFullRebuild` operates across the workbooks in its instance, which is a reason to isolate fixtures. Treat external refresh separately from calculation. If native saving changes the file, choose and record which version is delivered before making an exact-artifact claim.

## Primary references

Consult current documentation for the specific operation rather than treating this table as a promise of exhaustive support.

- [Excel object model](https://learn.microsoft.com/en-us/office/vba/api/overview/excel/object-model)
- [PowerShell COM creation](https://learn.microsoft.com/en-us/powershell/scripting/samples/creating-.net-and-com-objects--new-object-)
- [pywin32 COM quick start](https://github.com/mhammond/pywin32/blob/main/com/win32com/HTML/QuickStartClientCom.html)
- [xlwings application API](https://docs.xlwings.org/en/stable/api/app.html), [chart API](https://docs.xlwings.org/en/stable/api/chart.html)
- [openpyxl formulas](https://openpyxl.readthedocs.io/en/3.1/simple_formulae.html), [loading and preservation limitations](https://openpyxl.readthedocs.io/en/3.1/tutorial.html#loading-from-a-file)
- [XlsxWriter formula results](https://xlsxwriter.readthedocs.io/working_with_formulas.html#formula-results), [FAQ](https://xlsxwriter.readthedocs.io/faq.html)
- [ImportExcel Export-Excel implementation](https://github.com/dfinke/ImportExcel/blob/master/Public/Export-Excel.ps1), [native chart-export helper](https://github.com/dfinke/ImportExcel/blob/master/Export-charts.ps1)
- [Chart.Export](https://learn.microsoft.com/en-us/office/vba/api/excel.chart.export), [Range.CopyPicture](https://learn.microsoft.com/en-us/office/vba/api/excel.range.copypicture), [Workbook.ExportAsFixedFormat](https://learn.microsoft.com/en-us/office/vba/api/excel.workbook.exportasfixedformat)
- [CalculateFullRebuild](https://learn.microsoft.com/en-us/office/vba/api/excel.application.calculatefullrebuild), [CalculationState](https://learn.microsoft.com/en-us/office/vba/api/excel.application.calculationstate)
- [Desktop Office automation limitations](https://learn.microsoft.com/en-us/office/client-developer/integration/considerations-unattended-automation-office-microsoft-365-for-unattended-rpa)
