# data-shelf — notes

Design notes and forward-looking direction for the data-shelf pages.
Reference-doc convention: "Current shape" describes what's in the repo now;
"Decisions" captures choices worth remembering with the reasoning;
"Open directions" parks ideas we might pick up later. Keep entries short
and prune as they ship.

## Current shape

The shelf is a single Alpine page over `persistence.collection('dataShelf.items')`
(idb-keyval under the hood). Records have one of four `type`s — `js`, `html`,
`json`, `text` — and the page provides a sidebar list, a CodeMirror-backed
editor, and an executor for the three executable types. UI metadata for each
type (`label`, `badge`, `exec`) lives on the page in `cfg.types`; the
canonical set of valid type names lives in `kits/data-shelf.js`.

Two pages exist:

- `pages/data-shelf/v1.html` — Dexie-backed (`DataShelfDB`). Kept for now
  as a fallback.
- `pages/data-shelf/index.html` — current, rebuilt on the in-repo kits/.

The importer (`alpineComponents/idb-importer.js`) is a modal owned by v2.
It walks IndexedDB on this origin, lets you pick a database and store, and
writes records into the shelf collection. Intake is shape-gated: every
incoming record is run through `dataShelf.coerceShelfRecord` and validated
with `dataShelf.isShelfShaped`. The preview shows recognized / not-shelf-shaped
counts plus one sample from each bucket; unrecognized records are skipped
on import.

For browsing arbitrary IDB content (anything that isn't shelf-shaped), see
`pages/idb-nav.html`, which is the general-purpose explorer (read-only via
`persistence.idb`, destructive ops behind `persistence.idb.admin`,
tree-mode editing via vanilla-jsoneditor).

## Decisions

- **Importer narrowed to shelf intake.** The original importer would write
  any record from any IDB store into the shelf, which produced rows the
  sidebar filter and viewer couldn't make sense of. With idb-nav now
  covering arbitrary-IDB browsing, the importer's job is just "pull shelf
  records forward from legacy stores," and shape validation gates writes.
  Legacy `DataJarDB` and `DataShelfDB` records both pass the predicate
  unchanged once `tags` is coerced from comma-string to array.
- **Context stamping on import: preserve incoming, stamp current if absent.**
  Records from v1 (`DataShelfDB`) carry their original `context`, which we
  preserve so multi-context exports survive a round-trip. Records from older
  stores (`DataJarDB`) have no `context` field, so we stamp the importing
  page's current context as a default. Trade-off considered: stamping
  unconditionally was simpler ("bring these into my current context"), but
  it loses the per-context structure of v1 data.
- **Schema lives in a kit, not the page.** `kits/data-shelf.js` exports
  `SHELF_TYPES`, `isShelfShaped`, `describeRejection`, `coerceShelfRecord`
  on `window.dataShelf`. The v2 page still owns UI metadata for each type
  (label, badge, exec) since that's render concern, not schema concern.

## Open directions

- **Shelf export.** The mirror of import. Two plausible shapes: (a) a
  JSON-blob download / copy-to-clipboard of the current collection,
  scoped to the active context or "all," that the importer could later
  accept as a file-based input; (b) an idb-nav-side "Export to shelf"
  action on a recognized store, flipping the validation gate to live on
  the side that already knows the source. (b) is more elegant but
  duplicates the validation surface; (a) is simpler and closes the loop
  on the use cases we actually have (back up my shelf, move it between
  origins). Probably do (a) first.
- **Index notes for idb-nav.** Once we're confident in the role, give it
  an entry in the `pages/index.html` notes block alongside the other
  canonical pages.
- **v1 sunset.** Once v2 has full feature parity (it does) and an export
  path (it doesn't yet), v1 can be archived. Until then it's a safety net.
- **Deduplicate the type registry.** v2's `cfg.types` re-states the type
  names already declared in `dataShelf.SHELF_TYPES`. If we add a new type,
  both places update. Low priority — the list rarely changes — but worth
  noting so a future addition doesn't drift.
- **Importer for non-shelf data, redux.** If we ever want to land
  arbitrary IDB records *somewhere structured*, that's a different tool —
  probably an idb-nav-side "copy store to a new collection" action.
  Explicitly out of scope for the shelf importer.
