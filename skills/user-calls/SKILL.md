---
name: user-calls
description: >-
  File, read or close a user call, one question for the owner kept as a JSON
  file in web-tools-private and answered on its page in the Web Tools app: documentation edits to keep or discard, a pick among found images or
  concepts, or a recommendation to take or adjust. Use when another skill says
  to file a user call, when reading or applying the owner's answer to one,
  when closing one, or when changing the call format.
---

# user-calls

## Premise

Complex decisions can benefit from rich supporting context. A user call puts a question on a page in the Web Tools app, with the files it concerns rendered beside it. The owner answers there, and the page saves the answer next to the call, where the session reads it. [doc-craft](../doc-craft/SKILL.md) files a user call for each changed document, and [design-sprint](../design-sprint/SKILL.md) one for each idea board.

## Goal and output

One JSON file per call in the store, [web-tools-private](https://github.com/mehrlander/web-tools-private/tree/main/user-calls)'s `user-calls/` folder. The `user-call/1` format is in its contract, [`docs/envelopes/user-call.md`](https://github.com/mehrlander/web-tools/blob/main/docs/envelopes/user-call.md). Read the contract before writing a call.

Say "user call": "call" alone here also means a GitHub API call a crawl logs and a tool call a session record counts.

## Process

```
python3 user-call.py add < call.json             # validate, stamp, commit to main; prints the call's path
python3 user-call.py link <id> [--at REPO@REF]   # the address of the call's page
python3 user-call.py answers <id>                # what the owner answered
python3 user-call.py patch <id> | git apply      # a documentation answer's patch, in a checkout of the file's repo
python3 user-call.py close <id> <answer> [note]
python3 user-call.py list [session]              # open calls, newest first
python3 user-call.py edits --base REF FILE       # a documentation call's edits, FILE against its text at REF
python3 user-call.py edits --old A --new B       # the same, from two copies
python3 user-call.py review <call.json> <document> [--spans | <report>]
```

`edits --old A --new B` writes the edits array from the document and an edited copy of it, pairing blank-line blocks the way home's projects/text/tools/ propose.py does: an insertion or a removal takes its unchanged neighbour as context, so every `from` is text the file holds. `link` prints the call page's address, reading the call from the store at main unless `--at <owner/repo>@<ref>` names another place.

`answers` prints each line's summary, and under a documentation line each decision with the edit it is on, named by its `why` or, without one, the start of its `from`, then the owner's note on it, then the other notes: everything a session acting on the answer needs, with no need to read the raw line.

`review` records each run of the [peeves critic](../agents/peeves-critic.md) over the document, for [doc-craft](../doc-craft/SKILL.md)'s Review step. The contract's [Review](https://github.com/mehrlander/web-tools/blob/main/docs/envelopes/user-call.md#review) section describes the record. Before each run, `review <call.json> <document> --spans` prints the call's edits as numbered line ranges (E1, E2, ...) for the critic's prompt. `--spans` first recomputes the edits from the document and the call's `base`. The recomputed edits keep the why, background, proposal and notes the session wrote on them.

After the run, `review <call.json> <document> <report>` records it. The record calls each of the critic's findings a trip. The record also numbers the changes made to the document since the previous run c1, c2 and so on. Link each change to the trips it addresses with `--answers <change> <trips>`. Set a trip aside with `--kept <trip> "<why>"`.

`user-call.py` looks for the store in the project root, the folders inside it and the folders beside it, and takes the first checkout whose `.web-tools.json` on main declares `"user-calls"`, a folder in that checkout; `--store <folder>` names the folder instead. A command fetches the store's main before reading it. `add` and `close` commit the call straight to the store's main and push it, leaving the checkout's working tree and branch as they are.

## Key insights

- **File a call only for a decision that is the owner's to make.** Tidy a PR, split work or rename a thing within the task, then report it. A call that offers a choice the session could have made is not ready.
- **Write for a glance:** one plain question, and answers short enough for a button. Put the reasoning and evidence in the materials. `add` refuses a call that breaks its kind's limits.

## Bundled

- [`user-call.py`](user-call.py): the commands under Process. Run it with no arguments to print them.
