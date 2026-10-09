---
name: validate-excel
description: Validate Excel workbook generation and browser previews against the installed Excel application. Use to investigate rendering or calculation assumptions, compare workbook creation engines, or verify that a preview corresponds to the downloadable workbook. Covers tables, PivotTables, charts, sheet layout, and controlled experiments; ordinary spreadsheet authoring alone does not require this workflow.
---

# Validate against Excel

Use the actual application to answer a concrete question about a workbook or its browser representation. Produce evidence another agent can repeat, and state precisely what that evidence establishes. This skill supports both faithful native previews and development of an independent browser renderer.

## Establish the claim

Identify the workbook or generator, target sheet/range/object, browser entry point and renderer revision, and the behavior under investigation. Turn a broad request into a small first case using available context. Examples: a table's total row survives export; a chart places negative values correctly; a downloaded workbook is the one Excel rendered.

Choose the applicable comparison:

- **Native preview delivery:** Excel produces the image/PDF displayed in the browser. Test capture completeness, artifact identity, and browser presentation. Displaying Excel's own image does not validate an independent renderer.
- **Independent rendering:** the browser draws from workbook data or a shared specification. Compare that output with Excel's output and object properties for the same case.
- **Creation-route experiment:** different writers create the same intended object. Compare the written package, Excel's interpretation, and final appearance separately.

Distinguish a worksheet's on-screen appearance from its printed layout. A PDF generated using print areas and page scaling is evidence for that layout, not automatically for the sheet grid.

## Discover what already works

Search the current project and relevant prior experiments before inventing a new automation path. Existing scripts establish available techniques; retained results establish what actually ran. Record those separately. On this user's machine, consult [local-evidence.md](references/local-evidence.md) for starting points, then verify relevant facts rather than assuming old paths or capabilities still hold.

Use [windows-routes.md](references/windows-routes.md) when selecting or comparing engines. Classify the operation by its engine, not by the language: PowerShell/Python can drive native Excel or write files without Excel.

`scripts/Probe-ExcelCapabilities.ps1 [-PythonExe <absolute path>]` provides a read-only inventory. It does not start Excel or prove that native automation works. A missing Python package applies only to the interpreter inspected. Prefer the environment's configured runtime discovery over assuming `python` names the intended interpreter.

## Make a bounded experiment

Use a task-owned directory and either a synthetic workbook or a copy of the relevant artifact. Preserve an existing workbook's bytes before experimenting. For workbooks we generate ourselves, retain the common specification so workbook creation and browser drawing can use the same explicit intent.

Start with the smallest example that exercises the claim. Change one property at a time initially; add combinations when the isolated behavior is understood. Read [validation-cases.md](references/validation-cases.md) for object-specific evidence and comparison methods. Expand coverage in response to actual needs and findings, not toward an assumed obligation to emulate all of Excel.

For native automation, prefer an available object-model route. Use a task-owned Excel instance for isolated fixtures; do not attach to and recalculate the user's unrelated workbooks. Track ownership, close only task-owned workbooks, restore any settings changed in a borrowed session, and release owned resources. Never terminate all Excel processes as cleanup. Use bounded execution and investigate a failure before retrying; a timed-out export is not success.

Opening a workbook can refresh links, calculate formulas, or execute workbook automation. Choose the calculation/refresh policy deliberately; use ordinary data-only fixtures without macros or external refresh unless the experiment calls for them. Do not weaken application security settings or publish files merely because validation is requested. Honor already-authorized operations without creating redundant confirmation steps.

## Capture the native and browser evidence

1. Record the input file identity and relevant inputs. If Excel recalculates or changes the package, retain the distinction between the input and the final saved artifact. Record formula text, cached values, and freshly calculated values as different evidence where relevant. Calculation completion alone does not prove that asynchronous data refresh completed.
2. Fix the view being compared: object dimensions or range, zoom/viewport, capture bounds, and relevant fonts/locale. Record Excel version/build and browser renderer revision. Only investigate extra environmental detail when it affects the case.
3. Prefer native chart export, range picture capture, or fixed-format export according to the intended view. Screenshots are a valid fallback. Inspect the actual output for blank content, clipping, missing objects, and readable labels; a successful API return or an existing file is insufficient.
4. Load the actual app rendering path for the same artifact and capture it with the project's existing screenshot script or available browser tooling. Verify the intended sheet/object and renderer revision have loaded; account for cached bundles. A separately authored mock page cannot establish fidelity of the app's renderer.
5. Obtain the file through the actual download action when testing delivery. Compare its SHA-256 with the final workbook used for reference rendering. Detect changes between capture and publication. A workbook containing equivalent cells is not necessarily the same downloadable artifact.

Do not overwrite imported workbooks through a file library just to inspect them. Unsupported parts may be lost on a library save. Saving through Excel can also change package content; inspect preservation only to the extent the case requires.

## Evaluate and deliver

Evaluate three independent questions: **artifact identity**, **meaning/structure**, and **appearance**. Hash equality answers the first; application properties and numerical assertions answer the second; visual inspection and appropriate measurements answer the third. None alone proves all three.

Keep native and browser captures separately labeled. Align comparable content at a recorded scale before measuring. Use image differences to locate discrepancies; do not silently resize images, approve a chart from one similarity score, or tune tolerances merely to make a case pass. Check values, blank/error handling, axes, and aggregation independently of pixels. Do not compute chart totals from a truncated browser display or incomplete recovered cache.

Retain the smallest useful evidence bundle: final workbook, native capture, browser capture when applicable, repeatable case inputs/command, and a short result record. For a delivery test, include download identity. The result record states the hypothesis, versions, calculation/refresh policy, target/capture method, artifact hashes, observed differences, outcome, and unresolved limits. Use `confirmed`, `contradicted`, or `inconclusive` for the stated claim; missing native evidence cannot confirm native fidelity.

Show the compared output when useful and provide the actual workbook download. State which objects/cases were checked. Keep diagnostic comparison images separate from production previews. Updating the renderer, deploying a site, installing software, or modifying the original workbook follows the user's task scope, not an automatic next step of this skill.

When a new discrepancy is understood, retain its minimal reproduction and update the narrow relevant reference. End when the requested claim is answered or the concrete missing prerequisite is identified.
