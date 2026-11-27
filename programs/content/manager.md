# Content manager

The session holding the Content manager role, taken on with `/portable:programs content` ([programs skill](../../skills/programs/SKILL.md)), answers the processes [the README](README.md) lists as below.

First read the owner's rulings, the [notes](../../skills/notes/SKILL.md) addressed to `mehrlander/web-tools:programs/content/README.md`. Name any source you could not read.

## Rule placement

A session brings this process before adding prose to a living file, as the house policy [What earns space (`h:critical`)](https://mehrlander.github.io/web-tools/app/?view=map&tab=policy&h=critical) requires. Inputs: the candidate statement or page path. This process locates existing owners and duplicates; wording edits and page reviews go to the reviewers [the README](README.md#reviewers) names. Send a question about which document owns a topic to the Ownership process in [Alignment's manager brief](../alignment/manager.md). Read three sources:

- **Rule owners:** [`house-policies.json`](../../lists/house-policies.json), [`QUALIFIED-WRITING.md`](../../docs/QUALIFIED-WRITING.md), [`peeves.json`](../../lists/peeves.json) and [`html-style`](../../skills/html-style/SKILL.md).
- **Overlap and growth records:** [`themes.csv`](../../docs/themes.csv), [`matches.csv`](../../data/doc-overlap/matches.csv) and [`data/doc-growth/`](../../data/doc-growth/) record passages repeated across Markdown files and word-count growth over time.
- **UI codebook:** [`codebook.md`](../../data/ui-units/codebook.md), [`coded.csv`](../../data/ui-units/coded.csv) and [`instances.csv`](../../data/ui-units/instances.csv) (plus `data/ui-units/` in [`home`](https://github.com/mehrlander/home) for surfaces outside web-tools) record each unit's layout, parts and kits ([`kits.csv`](../../docs/kits.csv)).

Return one line for each existing owner, duplicate passage, or codebook entry that bears on the candidate:

```
<owner | duplicate | coded unit | uncoded> · <repo:path> · <policy id, peeve id, or unit code> · <what that entry already states or checks>
```

## Pending sign-off

A session brings this process before editing a file, since an open user call may already propose edits to it. The owner brings it to see what waits on approval. Inputs: a file or session to narrow to, or none for every open call. Read one source:

- **User calls:** the [`user-calls/`](https://github.com/mehrlander/web-tools-private/tree/main/user-calls) folder of web-tools-private holds the calls that [doc-craft's Review](../../skills/doc-craft/SKILL.md#review) step files. Read it with [`user-call.py`](../../skills/user-calls/user-call.py) `list`, or from each call's JSON file. A call awaiting an answer has `status` `open`. A wording call has `kind` `documentation`. Its `file` names the document as `owner/repo@branch:path`.

Return one line for each open documentation call that matches, oldest first:

```
<id> · <created date> · <owner/repo@branch:path> · <pr, or none> · <the call's question>
```

Mark a call `stale` when its branch no longer exists, or when its pull request has merged or closed. Report a stale call; do not close it.
