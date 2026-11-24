---
id: test-selection-by-reach-p2xtc5
title: Run the tests affected by a change, and measure their time
status: in-progress
session: codex/test-cost-and-selection
opened: 2026-11-13
project: testing
size: L
---
# Run the tests affected by a change, and measure their time

A developer may repeat a full `npm test` run several times while making one change. Each full run takes minutes, even when only a small part of the code changed. This task adds a way to rerun the relevant existing test files between edits and record how much time the checking takes.

Full checks remain required before a pull request and in GitHub's automated checks, usually called continuous integration (CI), while the new method is evaluated. CI also takes time and can delay review; moving work there does not remove that cost.

## What gets selected

A test case checks a particular result. A test file can contain many cases. The tool chooses whole test files, so selecting a file with ten cases runs all ten. The first version covers the JavaScript test files normally run by `npm test`; browser checks and other separate commands still need their own assessment.

During a full recorded run, the tool notes which source files and folders each test reads. For example, a test for comma-separated values (CSV) files may read the CSV reader. When that reader changes, the saved record is one reason to rerun that test file.

Some tests enforce rules across the repository, such as keeping file lists and generated files consistent. Those tests always run. The tool also includes new or changed test files and tests whose file access is unknown or could not be fully recorded, including tests that launch another program.

The tool runs all tests when its saved record cannot be used, a changed file has no explanation in that record, or shared testing setup changes. The aim is to reduce repeated checking where the evidence supports a smaller run.

The [command guide](../../docs/environment/testing.md#choose-which-tests-to-rerun-while-making-changes) explains how to record a full run, preview the selected files and run them.

## Who decides whether the tests are enough

Selecting files answers which existing tests to rerun. The [Testing program](../../programs/testing/README.md) organizes the project's checking rules, evidence and ongoing work. An agent takes the program's manager role by following its [instructions](../../programs/testing/manager.md), then assesses the intended behavior, the results the tests actually check, and any missing cases or separately run checks. A developer or coding agent working on the change supplies that context and follows the program's procedures.

A recorded file read does not establish that the test checks the behavior being changed. The [assertion audit](https://github.com/mehrlander/web-tools/pull/1405) addressed that separate question by deliberately breaking behavior and checking whether the tests detected the break. The selection tool builds on those tests and the descriptions of what each test is supposed to check.

## Where to see the results

The Web Tools app's [Map view](https://mehrlander.github.io/web-tools/app/?view=map&tab=tests) lets a reader look up a source file and see connected test files, files included for other reasons, descriptions of what each test checks, and recorded times when available. Each record names the code version and computer software used for the run, so differences are visible when comparing times.

On a developer's machine, records stay in a local folder that Git leaves out of commits. Successful recorded full runs on `main`, the project's main development branch, publish file relationships to the Web Tools app. The project's private companion repository, [web-tools-private](https://github.com/mehrlander/web-tools-private), stores dated timing records. Only a complete, successful recorded full run started without uncommitted changes can become the saved reference for later selections.

[web-tools#1443](https://github.com/mehrlander/web-tools/pull/1443) merged with the approved commands, instructions and Map display. The first [recorded full run on `main`](https://github.com/mehrlander/web-tools/actions/runs/45351776949) captured all 473 test files without observation errors.

The workflow published the public file relationships. The coding agent saved the private record with the local publishing command because CI lacked the credential needed to write there. The public file, private dated record, latest summary and saved reference match the saved CI record and expected publishing output. Automatic private delivery still needs `REGISTRY_WRITE_TOKEN` configured with write access to the private repository.

The Map shows the last recorded time and links to the run record; a view of past slow runs remains part of the outlined work.

## How to judge the result

| Question | Evidence to examine |
| --- | --- |
| Is checking becoming quicker? | Compare the total time of full runs made under similar conditions. Also inspect time spent preparing the run and in individual test files. |
| Would smaller runs leave failures unchecked? | Compare the proposed selection with an actual full run, including any failing test files the selection would have left out. One passing comparison is evidence for that change, not a guarantee for later changes. |
| Are developers and coding agents repeating fewer full runs? | Count full runs and their time. Only runs made through the new recording and selection commands are recorded locally; existing chat records and ordinary `npm test` runs do not yet provide a complete measure. |

Tests can run at the same time. Adding their individual times counts overlapping periods more than once, so that sum is neither the time a person waits for the whole run nor a measure of processor work. The reports must keep those quantities separate.

CI currently downloads only the newest code version. If the saved record names an earlier version that CI has not downloaded, the tool proposes all tests. The trial must distinguish that fallback from a useful smaller proposal and compare the saved records where both code versions are available. Any change to download more history needs its added time measured. Full-run capture and publication still work.

During a trial across 20 varied code revisions, keep `npm run preflight` before each pull request and retain full CI runs. That command prepares the project and runs the full `npm test` collection; other required checks still apply. Compare the proposed smaller runs with those full runs. The Testing program reviews the results before proposing changes to the normal checking instructions. Collect observations during full runs that are already needed.

## Earlier investigation and separate startup experiment

On November 13, the investigation recorded one full run and replayed 40 older changes against that record. The replay used a later record of file reads, rather than a record from each older change, and did not measure actual savings from smaller runs. The [original findings and prototype](https://github.com/mehrlander/web-tools/blob/8da39a28f/tracker/tasks/test-selection-by-reach-p2xtc5.md) retain the technical details.

The investigation also found repeated startup cost: many tests load jsdom, a library that simulates a browser, even when they need only a small helper. Loading jsdom only when a test needs a simulated browser is a separate change to measure after full-run timing records are available. Savings remain unmeasured.

## Where the code lives

| File | Responsibility |
| --- | --- |
| [`node/testing/observe.cjs`](../../node/testing/observe.cjs) | Records file access during a test and notes where recording is incomplete. |
| [`node/testing/select.mjs`](../../node/testing/select.mjs) | Chooses whole test files and explains each inclusion or decision to run everything. |
| [`node/testing/run.mjs`](../../node/testing/run.mjs) | Provides the commands and keeps local records. |
| [`node/testing/publish.mjs`](../../node/testing/publish.mjs) | Publishes public file relationships and separate private timing records. |
| [Testing charter](../../programs/testing/README.md) | Defines the program's responsibilities and measures. |
| [Map component](../../lib/alpineComponents/map.js) | Displays the test inventory, file relationships and recorded costs. |

## Done when

- The command lists selected test files, reasons and available time estimates, and can run those files.
- A full run on `main` publishes a usable file-reading record and a dated private timing record.
- The Testing program has measures for checking time, proposed smaller runs and repeated full runs during development.
- The Map shows which files connect to a check, its recorded time and the records needed to inspect past slow runs.
- The repository owner has approved the checking instructions. The full checks before pull requests and in CI continue until a later decision changes those instructions.

## Progress log

- 2026-11-13: The owner approved the outline and asked for implementation. The investigation recorded one full run and replayed 40 earlier changes.
- 2026-11-23: Codex claimed the task and implemented the draft in [web-tools#1443](https://github.com/mehrlander/web-tools/pull/1443). The current approach keeps full verification, retains tests whose file access is uncertain, separates elapsed time from processor work, and leaves final instruction wording for review. First publication, the 20-revision trial, historical slow-run inspection and the separate startup experiment remain to be completed or assessed.

- 2026-11-24: The owner approved the final wording. [web-tools#1443](https://github.com/mehrlander/web-tools/pull/1443) merged after full integrated CI passed. Main run [45351776949](https://github.com/mehrlander/web-tools/actions/runs/45351776949) recorded all 473 test files in 501.50 seconds of suite elapsed time, with no observation errors. Public delivery was automatic; private delivery used the local publishing command after the missing credential was found. All stored files matched the saved CI record and expected publishing output. The task remains in progress for automatic private delivery, the 20-revision evaluation including history fallbacks, past slow-run inspection and the separate measured startup experiment.
