# Search log

A durable record of user-requested retrievals, one file per subject. The
file-retrieval skill appends here so past searches are a record, not lost with
the session.

**One file per subject**, named `<subject-slug>.md` (e.g. `toss-render.md`,
`merge-guide.md`). Append one dated line per run:

```
- 2026-07-15: `corpus_search.py "toss-render" --max 6` -> 16 documents matched
```

Record the query and flags verbatim and the hit count, so a run is reproducible
from its log line.

**Durability.** This directory is committed, so logs persist across sessions. A
purely exploratory search need not be logged; a search the user asked for should
be. Keep the lines terse.
