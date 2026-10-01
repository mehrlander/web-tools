# State

The State view, a pane of the Activity stop, lists everything the estate keeps
derived: each cache with its age, what builds it, what a rebuild costs, and a
Refresh where the page can rebuild it. Age pills elsewhere in the app open it at
their row. It is the one place Refresh lives.

## Sections

- **Derived:** the caches in the private registry. Rows that one press
  refreshes together sit in a group under one button. The entity index has no
  button: a session rebuilds it, outside the page.
- **This browser:** the search caches and the page itself, whose button
  reloads the page.
- Authored content (the lists, the private config) and captured records
  (sessions, errands, proposals) are named at the foot and get no rows, since
  nothing rebuilds them.

## What a row shows

- **Two ages.** *Built* is when the cache last changed; *checked* is when this
  browser last looked. A crawl writes only when something changed, so an old
  *built* beside a recent *checked* means the cache is current.
- **Whether there is anything new.** The view asks GitHub whether any source
  has moved, in two requests for the whole view, and draws a Refresh lighter
  when there is nothing to fetch.
- **Used by:** a chip for each view that reads the cache. The sidebar and the
  Repos card rollups read some caches too, and get no chip.
- **Progress.** A refresh started here shows a bar and the request in flight.
  A refresh running in the background shows none.

## The panel

Each row opens a panel with two tabs:

- **Contents:** the file exactly as committed. One row is open at a time.
- **History:** the file's last twenty changes and the gaps between them, with,
  where the crawl recorded it, how long it ran and how much it examined.
  Tapping a gap lists which records changed between the two versions.

**Calls** shows each crawl's last run as the GitHub requests it made, grouped by
kind.
