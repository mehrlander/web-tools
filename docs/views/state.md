# State

The State view, a pane of the Activity stop, lists each derived cache with its
age, what builds it and what a rebuild costs. It is the one place Refresh
lives; age pills elsewhere in the app link to their row.

- **Derived** rows are the caches in the private registry. The entity index has
  no Refresh: a session rebuilds it, outside the page.
- **This browser** rows are the search caches and the page itself.
- Authored content (the lists, the private config) and captured records
  (sessions, errands, proposals) get no rows, since nothing rebuilds them.
- **Built** is when a cache last changed and **checked** is when this browser
  last looked. A crawl writes only on a change, so an old *built* beside a
  recent *checked* means the cache is current.
- **Used by** chips name the views that read a cache. The sidebar and the
  Repos card rollups also read some caches; they are not views and get no chip.
