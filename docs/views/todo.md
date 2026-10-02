# Lists

The Lists stop holds To-do, Jot, Note and Pins (`lib/alpineComponents/estate.js`).
`?view=todo` and `?view=jots` both open it; Pins has no key. To-do, Jot and Pins
are authored files in the private registry under `lists/`, written whole through
the viewer's token (`gh-store.js`'s `save`), so each check-off is a commit.
`state/` holds only derived caches, never these.

| List | File | Item shape |
| --- | --- | --- |
| To-do | `lists/todo.json` | `{id, text, done, created_at, done_at, urgent, due}` |
| Jot | `lists/jots.json` | `{id, text, created_at, kind}` |
| Pins | `lists/pins.json` | `{id, target, title, note, group, created_at}` |
| Note | `notes/notes.jsonl` | `{id, at, author, about, text, anchor}` |

- **Optional fields round-trip.** A field is written only when set, and the
  savers write parsed items back whole, so a field added by hand or by a session
  survives the pane.
- **To-do:** an item is hot when `urgent` or its `due` (`YYYY-MM-DD`) has
  arrived.
- **Jot:** no done state. A jot stays until it is promoted somewhere with a real
  home (a chron entry, a tracker task, a to-do) and deleted. `kind` is an open
  vocabulary, lowercase and hyphenated, at most 24 characters. A kind earns a
  name only by naming a destination the text cannot imply (`snag` → the owning
  repo's [SNAGS.md](../SNAGS.md)).
- **Pins:** each `target` is `owner/repo[@ref]:path`; a path with an extension
  opens the file, anything else the Files view at that folder.
- **Note:** one line per note, appended through `lib/kits/notes.js` and never
  rewritten. A to-do's or jot's note key addresses it as
  `<registry>:lists/<file>.json#<id>`. The skill is
  [`skills/notes/SKILL.md`](../../skills/notes/SKILL.md).
