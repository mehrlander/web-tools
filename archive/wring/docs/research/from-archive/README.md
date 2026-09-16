# from-archive

Complete copies of the Gemini research reports, plus one report this repo never
received. **Nothing upstream was modified to make them**: every file in this
folder is an addition, and the five `../0N-*/` folders are the byte-for-byte
snapshot they always were.

## Why the folder exists

No copy of a Gemini report in this estate is complete on its own, and the two
halves are complementary rather than redundant.

| | `../0N-*/gemini-report.md` (this repo) | The canvas source in the export |
| --- | --- | --- |
| Body prose | yes | yes |
| Headings, bold, tables | flattened | yes |
| Display-math blocks | dropped | yes |
| Inline `[n]` citation markers | dropped | yes |
| Numbered source list | **yes, 29 to 52 entries** | **absent** |

The committed copy was made by pasting a Gemini Canvas build into a file, which
kept the bibliography and flattened everything else. The other copy is the
canvas document's **own Markdown source**, which Google Takeout does export:
every `Created Gemini Canvas titled …` activity record carries it in
`subtitles[0].name`, and the private `mehrlander/chat-histories` archive renders
that field inline in its conversation files byte-identically. It kept the
structure, the math and the markers, and it has no bibliography: for all five,
`Works cited` is absent, there are zero `http` occurrences, and the `[n]`
markers sit there with nothing to resolve against. So the missing sources are
not a Takeout gap and not a rendering artifact. The canvas document as stored
simply ends without them, and the paste is the only surviving copy of the
bibliographies.

Joining the two makes 187 cited sources resolvable rather than leaving them
under prose that no longer points at them.

## What is here

| File | What it is |
| --- | --- |
| `01-tokenization-typing.md` … `05-adjacent-domains.md` | the five per-question reports, recombined |
| `00-algorithmic-foundations.md` | a sixth report, a Deep Research run from four hours earlier the same day, never committed here |
| `gpt-report-sources.md` | the external sources each ChatGPT report's record names, which is as far as that side can be taken |
| `recombine-reports.py` | the method, runnable only with the private archive present |

## Provenance

All five canvas builds come from one Gemini session, `gemini-session/177`, on
2025-12-20. The source of record is the export's activity log,
`2026-06-01-gemini-export/activity/2025-12.json`, five `Created Gemini Canvas
titled …` records between 20:54 and 21:29 UTC. This script reads them through
the snapshot's conversation render,
`2026-06-01-gemini-export/conversations/2025-12/0376-2025-12-20-discuss-how-we-could-use-an-arrow-function-and-template-lite.md`,
which is byte-identical to the activity field for all five (24,835, 25,743,
23,303, 28,385 and 32,999 characters). That snapshot's canvas catalog is
title-only and says the content is not exported at all, which is wrong and is
marked `Wrong` there as of 2026-09-16, with the measurements in its
`canvas/content-2026-09-16.md`.

| Report | Canvas title, and time (UTC) | ChatGPT counterpart, same day |
| --- | --- | --- |
| 01-tokenization-typing | Template Induction: Tokenization and Typing, 20:58 | Tokenization and Typing Analysis |
| 02-repeat-primitives | Repeat Primitives and Candidate Control, 20:54 | Research question clarification |
| 03-template-formation | Template Formation Research Strategy, 21:01 | Template formation research |
| 04-objective-selection | Research Question 4: Objective and Selection, 21:26 | Objective selection analysis |
| 05-adjacent-domains | Adjacent Domains Research Synthesis, 21:29 | Adjacent domain analysis |

The five ChatGPT chat links are in
[`gpt-report-sources.md`](gpt-report-sources.md). The prompt-drafting chat that
preceded all of them is
[Template induction research](https://chatgpt.com/c/6946db44-bf5c-8326-8ff4-71aba0666406).

## How the join was checked

Both copies were reduced to bare words, absorbing the six classes of paste
damage that `normalize` in the script enumerates, and then compared. The result,
run 2026-09-16:

- Four of the five bodies are **word-for-word identical**.
- `04-objective-selection` differs by **ten words** the paste dropped from one
  cell of the cost-model table, which the canvas copy supplies.
- The canvas body is embedded verbatim in every generated file, checked after
  generation with the provenance blockquote stripped back out.
- The paste also dropped **29 display-math blocks** across the set, 20 of them
  from `04-objective-selection` alone.

Marker numbering is consistent with the source list, spot-checked on the first
marker of each report: the MDL claim points at the MDL entry, the Drain claim at
the Drain entry, the suffix-array memory claim at the suffix-array entries. That
is consistency, not proof, and the original canvas document is not in the export
to check against.

**One gap that does not close.** `02-repeat-primitives` cites 31 sources and its
list holds 29, ending on a complete entry, so `[30]` and `[31]` resolve to
nothing. Whether the paste truncated the list or Gemini numbered past its own
cannot be settled from either copy. The file says so where a reader meets it.

## The dependency, stated plainly

`recombine-reports.py` reads a private repo, so it cannot run for a public
reader and is not a build step. The generated files are the durable artifact and
the script is the auditable method behind them. Re-running it needs
`mehrlander/chat-histories` checked out at `/home/user/chat-histories`; edit
`ARCHIVE` at the top if it sits elsewhere.
