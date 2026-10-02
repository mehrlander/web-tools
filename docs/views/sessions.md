# Sessions

`?view=sessions`, the Activity stop's default pane
(`lib/alpineComponents/estate.js`), lists every recorded Claude Code session
from the sessions cache, newest first. `?view=activity` resolves here. A row
opens the session form ([forms/session.md](../forms/session.md)); a branch chip
opens that branch's form at `pages/branch.html`.

**Address.** `&session=<short id>` (the open record), `&set=<ids>` (a scope of
short ids, comma-separated; `sessionSetIds` owns the grammar), `&topic=<topic>`
(the sessions carrying one topic), `&lens=` (`list` default, `table`, `stars`,
`repos`, `counts`, `topics`), `&grain=` (`session` default,
`branch`, `edge` for session-and-branch pairs). Defaults stay out of the URL.

## The sessions cache

`state/sessions.json` in the private registry, built by
[`lib/kits/repo-sessions-cache.js`](../../lib/kits/repo-sessions-cache.js) from
the per-session records the Stop hook publishes under `sessions/`.

- **Bump `ROW_V` when the summarizer gains a field**, or rows built by the
  older summarizer keep the old shape. Otherwise only records whose blob sha
  moved are re-read.
- A record the per-crawl cap deferred keeps its row: the fold's scope is the
  full listing, not the batch read.
- File attention counts only the four file tools (`Read`, `Edit`, `Write`,
  `NotebookEdit`). Shell reads, subagent traffic and docs injected at session
  start leave no trace, so a zero does not mean a file went unread.
- Topics are not cached: the pane joins them on read from
  `state/session-topics.json`, whose format web-tools-private's
  `sessions/topics/README.md` owns.
