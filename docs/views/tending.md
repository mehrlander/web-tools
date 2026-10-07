# Tending (`?view=tending`)

The **Tending** view lists the findings tending passes wrote about the estate's
branches, pull requests, tracker tasks, snags and session records. Component:
`lib/alpineComponents/tending.js`; fold and witness comparison:
`lib/kits/findings.js`.

## The record

A finding is a note ([notes skill](../../skills/notes/SKILL.md)) carrying a
`finding` object:

| Field | Holds |
| --- | --- |
| `kind` | `unreached`, `answer`, `overlap` or `superseded` ([tend skill](../../skills/tend/SKILL.md#findings)). Provisional: the view shows any other kind by name. |
| `subjects` | Locators for everything it concerns, a session's record file included. The note's `about` is the first. |
| `why`, `next` | Why it matters, and the next step. A decision the owner must make is a user call among the subjects, answered in the Waiting view (`?view=waiting`); a finding never asks. |
| `evidence` | Short verifiable facts. |
| `witnesses` | Pinned references ([locators.md](../locators.md)) the conclusion rests on, inside the subjects or not. |

A finding is **open** while it carries a `next`, whatever its
kind, unless the owner resolves it. Only a reply carrying `finding` changes it,
replacing the fields it carries: a pass records progress with `did`, settles it
(`status: "settled"`) once no `next` remains, or reopens it
(`status: "open"`). The owner's **Handled** (`status: "resolved"`) acknowledges
each changed witness as it stands, so only a later change brings the finding
back; **Reopen** reverses it. A reply without `finding` is a comment and changes
nothing.

| Witness | Changed when |
| --- | --- |
| `owner/repo@ref` + `sha` | the branch tip is another commit |
| `owner/repo@ref` + `contains` | the ref no longer contains the commit |
| `owner/repo@ref:path` + `sha` | the blob or tree at the path differs |
| `owner/repo#N` + `state` | the state differs, or an open pull request was updated since |

A ref or path that is gone reads broken. `findings.py check` applies the same
rule, held to the view's by the cases in `tools/test/findings.test.mjs`, but
reads pull requests from the crawl's cache, so one the cache lacks reads
unverifiable there.

## The view

**Open** holds the open findings, plus any closed finding
whose witnesses changed, until it is reassessed or handled. **Settled** holds the
rest, each saying what closed it. The view checks every finding's witnesses on
load and names a changed one at the top of its finding.
`&tab=settled` opens Settled; `&item=<note id>` opens one finding.

Activity shows open findings beside their subjects: a line under the Branches
and Sessions rows they name, the Branches **Findings** scope, and a count on
each Repos card. Each opens the finding here.

## Where findings come from

A tending pass ([tend skill](../../skills/tend/SKILL.md)) writes them with
`skills/tend/findings.py`. Its selection signals choose what to investigate and
never appear as findings.
