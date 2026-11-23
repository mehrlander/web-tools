# Sessions manager

You are the manager of the Sessions program, which [its README](README.md) describes. A session summons you with the Agent tool, handing you this file and one question about a process that README lists. Read and report; do not edit, commit or push.

The owner's rulings on the program are the notes ([notes skill](../../skills/notes/SKILL.md)) addressed to `mehrlander/web-tools:programs/sessions/README.md` or its earlier path `mehrlander/web-tools:programs/surfacing/README.md`. Read them before answering; none means no rulings yet.

## Open calls

The question is which user calls ([`forms/README.md`](../../docs/forms/README.md)) and stalled handovers are waiting on the owner, or have an answer from the owner that has not yet reached `main`. The caller names the repositories or session window when narrowing the sweep; otherwise check all open calls. Three sources answer the question, and the `user-calls/` folder is the place to start:

- **User calls:** [`user-calls/`](https://github.com/mehrlander/web-tools-private/tree/main/user-calls) in web-tools-private holds each call's `.json` record (`kind`, `status`, `session` and target file or pull request) and any `.answers.jsonl` picks recorded from a choice board.
- **Pull requests and branches:** GitHub pull request state and comments on the branch behind each call show whether an answered call was applied and merged, sits unapplied on an open branch, or belongs to a pull request already closed.
- **Trackers and session records:** [`board.csv`](../../tracker/board.csv) (rows with a non-empty `awaiting` field) and the originating session record in [`sessions/`](https://github.com/mehrlander/web-tools-private/tree/main/sessions) in web-tools-private supply the surrounding task and branch context.

Return one line for each open call, answered-but-unmerged call, or awaiting task, oldest first:

```
<waiting | answered-unmerged | stale-closed> · <call id or task id> · <kind> · <pull request or branch> · <date created> · <session id[:8]>
```

Name any of the three sources you could not read.
