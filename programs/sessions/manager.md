# Sessions manager

The session holding the Sessions manager role, taken on with `/portable:programs sessions` ([programs skill](../../skills/programs/SKILL.md)), answers the processes [the README](README.md) lists as below.

First read the owner's rulings, the [notes](../../skills/notes/SKILL.md) addressed to `mehrlander/web-tools:programs/sessions/README.md` or its earlier path `mehrlander/web-tools:programs/surfacing/README.md`. Name any source you could not read.

## Open calls

Check every open user call ([`forms/README.md`](../../docs/forms/README.md)) unless the question narrows the sweep to repositories or a session window. Read three sources, starting with the `user-calls/` folder:

- **User calls:** [`user-calls/`](https://github.com/mehrlander/web-tools-private/tree/main/user-calls) in web-tools-private holds each call's `.json` record (`kind`, `status`, `session` and target file or pull request) and any `.answers.jsonl` picks recorded from a choice board.
- **Pull requests and branches:** GitHub pull request state and comments on the branch behind each call show whether an answered call was applied and merged, sits unapplied on an open branch, or belongs to a pull request already closed.
- **Trackers and session records:** [`board.csv`](../../tracker/board.csv) (rows with a non-empty `awaiting` field) and the originating session record in [`sessions/`](https://github.com/mehrlander/web-tools-private/tree/main/sessions) in web-tools-private supply the surrounding task and branch context.

Return one line for each open call, answered-but-unmerged call, or awaiting task, oldest first:

```
<waiting | answered-unmerged | stale-closed> · <call id or task id> · <kind> · <pull request or branch> · <date created> · <session id[:8]>
```
