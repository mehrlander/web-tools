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

One JSON file per call in [web-tools-private](https://github.com/mehrlander/web-tools-private/tree/main/user-calls)'s `user-calls/` folder, in the `user-call/1` format of its contract, [`docs/envelopes/user-call.md`](https://github.com/mehrlander/web-tools/blob/main/docs/envelopes/user-call.md). Read the contract before writing a call.

Say "user call": "call" alone also means an API call or a tool call.

## Process

```
python3 user-call.py add < call.json             # validate, stamp, commit to main; prints the call's path
python3 user-call.py link <id> [--at REPO@REF]   # the address of the call's page
python3 user-call.py answers <id>                # what the owner answered, with each edit's decision and note
python3 user-call.py patch <id> | git apply      # a documentation answer's patch, in a checkout of the file's repo
python3 user-call.py close <id> <answer> [note]
python3 user-call.py list [session]              # open calls, newest first
python3 user-call.py edits --base REF FILE       # a documentation call's edits, FILE against its text at REF
python3 user-call.py edits --old A --new B       # the same, from two copies
python3 user-call.py review <call.json> <document> --spans   # before a critic run: the edits as line ranges E1, E2, ...
python3 user-call.py review <call.json> <document> <report>  # after it: record the run
python3 user-call.py review <call.json> --answers <change> <trips> | --kept <trip> "<why>"
```

`review` keeps a draft call's [peeves critic](../agents/peeves-critic.md) runs for [doc-craft](../doc-craft/SKILL.md)'s Review step, in the record the contract's [Review](https://github.com/mehrlander/web-tools/blob/main/docs/envelopes/user-call.md#review) section states. `--spans` recomputes the edits from the document and the call's `base`. It keeps the why, background, proposal and notes written on each edit.

`user-call.py` finds the store, web-tools-private's `user-calls/` folder, in a checkout in or beside the project root, or takes the folder `--store` names. `add` and `close` commit and push straight to the store's main. The checkout's branch stays as it is.

## Key insights

- **File a call only for a decision that is the owner's to make.** Tidy a PR, split work or rename a thing within the task, then report it. A call that offers a choice the session could have made is not ready.
- **Write for a glance:** one plain question, and answers short enough for a button. Put the reasoning and evidence in the materials.

## Bundled

- [`user-call.py`](user-call.py): the commands under Process. Run it with no arguments to print them.
