# State

`?view=state[&item=<key>]` (`lib/alpineComponents/state-view.js`), a pane of the
Activity stop, lists everything the estate keeps derived: each piece with its
ages, what builds it, what the build costs, and a Refresh where one is
possible. Cache age pills elsewhere open it at their row with `&item=`. It is
the one place Refresh lives.

## Sections

- **Derived:** the private registry's `state/` files. Branches and Sessions are
  two rows in an **Activity** group under one button that runs both, sessions
  first; `GROUPS` names the shell method each group runs
  (`state-view-groups.test.mjs`). `state/entities.json` gets a row with no
  button: it needs spaCy over the checkouts and is rebuilt outside the page.
- **This browser:** the search caches and the page itself (the reload calls the
  FAB's `hardRefresh` through `web-tools:hard-refresh`).
- Authored registry content (lists, the private config) and captured records
  (sessions, mailbox, proposals) are named at the foot and get no rows: they
  are not derived.

## What a row reads

- **Two ages.** `built` is the file's last commit; `checked` is this browser's
  throttle stamp (`wt:*CacheCheckedAt`). Crawls commit only on material change,
  so an old `built` with a recent `checked` means current.
- **The probe** answers whether there is anything to fetch, with two calls for
  the whole view: the account's repo listing (`pushed_at`) and one commits call
  on the registry's `sessions/`. It reports a fact about the source, never a
  verdict about the cache, and it sets the Refresh button's weight.
- **Used by** chips are composed from the `reads` column of
  [app-routes.csv](../app-routes.csv), read backwards. A declared read is
  bounded by [`cache-readers.mjs`](../../tools/build/cache-readers.mjs) and held
  both ways by `state-feeds.test.mjs`. Consumers below view granularity (the
  sidebar, the Repos rollups) are deliberately not chips.
- **Progress.** A crawl started here draws its bar from the shell's
  `crawlProgress` slot; the crawl names its own verb and unit. Under the bar,
  the current request is tailed from gh-boot's traffic ledger (api.github.com
  only, method first, status only on failure). Throttled background passes
  draw no bar.

## The panel

Each row expands to a panel with two tabs:

- **Contents:** the committed bytes verbatim, never re-serialized, fetched
  uncached; one row open at a time.
- **History:** the file's last twenty registry commits, their gaps and median,
  beside the crawl's throttle. Tapping an interval diffs its two versions
  through each cache's own change detector (`hash`, `alignHash`, a record's
  blob `sha`), so the panel and the commit gate agree. Versions are cached by
  sha.

**Calls** reads `state/calls.json`: the last run per crawl, grouped by request
shape. It costs a commit per run, which is why it is a separate file.

**Run records.** Each cache carries a bounded `runs` ring
([`lib/kits/crawl-runs.js`](../../lib/kits/crawl-runs.js)) that rides the
crawl's own commit. It must stay a top-level sibling of the record collection,
because the change detectors compare only the records: that is what keeps a
`runs` entry from causing a commit by itself. A field the crawl did not measure
is dropped, not written as zero.

A deep link can mount the view before auth resolves; it re-reads on
`web-tools:auth-state`.
