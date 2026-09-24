# Lists

The Lists stop shows To-do over Jot on one screen, with Pins above them
(`lib/alpineComponents/estate.js`). `?view=todo` and `?view=jots` both open it;
Pins has no key. All three are authored files in the private registry under
`lists/`, written whole through the viewer's token (`gh-store.js`'s `save`), so
each check-off is a commit. `state/` holds only derived caches, never these.

| List | File | Item shape |
| --- | --- | --- |
| To-do | `lists/todo.json` | `{id, text, done, created_at, done_at, urgent, due}` |
| Jot | `lists/jots.json` | `{id, text, created_at, kind}` |
| Pins | `lists/pins.json` | `{id, target, title, note, group, created_at}` |

- **Optional fields round-trip.** A field is written only when set, and the
  savers write parsed items back whole, so a field added by hand or by a session
  survives the pane.
- **To-do:** a row is hot when `urgent` or its `due` (`YYYY-MM-DD`) has
  arrived. Open items sort hot, then dated, then undated. Checked items move to
  a folded done pile; delete is the only removal.
- **Jot:** no done state. A jot stays until it is promoted somewhere with a real
  home (a chron entry, a tracker task, a to-do) and deleted; a session can drain
  the pile the way `chron/dump/` is drained. `kind` is an open vocabulary grown
  from use, normalized to lowercase and hyphens, at most 24 characters. A kind
  earns a name only by naming a destination the text cannot imply (`snag` →
  the owning repo's [SNAGS.md](../SNAGS.md)).
- **Pins:** each `target` is `owner/repo[@ref]:path`; a path with an extension
  opens the file, anything else opens the Files view at that folder. Unpinning
  removes the pointer only. `pinGroups` derives groups from the items.
- Each heading links its file with a source peek, re-seeded by every save.
