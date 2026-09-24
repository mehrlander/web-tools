# Sessions

`?view=sessions`, the Activity stop's default pane
(`lib/alpineComponents/estate.js`), lists every recorded Claude Code session
from the sessions cache, newest first. `?view=activity` resolves here. A row
opens the session form ([forms/session.md](../forms/session.md)); a branch chip
opens that branch's form at `pages/branch.html`.

**Address.** `&session=<short id>` (the open record), `&set=<ids>` (a scope of
short ids, comma-separated; `sessionSetIds` owns the grammar), `&lens=`
(`list` default, `table`, `stars`, `repos`), `&grain=` (`session` default,
`branch`, `edge` for session-and-branch pairs). Defaults stay out of the URL.

**Rows.** Day, short id (the record's filename stem, which is what `search.py
--show` takes), branches, opening ask, and counts: turns, tool calls, failures,
files, output tokens. Each count opens a card built from the record the row
already holds (`rowCardSummary`), so cards cost no fetch. Scope chips are Day, Week,
Month, **Snagged** (any session with a failing tool call) and All; repo chips
narrow further.

**File attention**, below the list, counts per path how many distinct sessions
opened it, from the four file tools only (`Read`, `Edit`, `Write`,
`NotebookEdit`). Shell reads, subagent traffic and docs injected at session
start leave no trace, and the pane says so.

## The sessions cache

`state/sessions.json` in the private registry, built by
[`lib/kits/repo-sessions-cache.js`](../../lib/kits/repo-sessions-cache.js) from
the per-session records the Stop hook publishes under `sessions/`.

- **Incremental by blob sha.** One recursive tree read names every record;
  `stalePaths` re-reads only records whose sha moved, or whose row was built by
  an older summarizer (`ROW_V`). **Bump `ROW_V` when the summarizer gains a
  field**, or the back catalogue keeps the old shape.
- The fold's scope is the full listing, never the batch read: a record the
  per-crawl cap deferred keeps its row.
- `refreshSessionsCache` runs on a per-browser throttle and commits only on a
  material change. State's Activity group refreshes it with Branches.
- Two rollups: `attention` over each row's busiest files, and `docAttention`
  over each row's complete `docs/` slice, which feeds the Map's readership
  column. `fileAttention(rows, cap, field)` computes both.
