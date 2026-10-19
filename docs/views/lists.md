# Lists

The Lists view holds To-do, Jot, Ping, Note, Pins and the lists created in it
(`lib/alpineComponents/estate.js`). Its address is `?view=lists`; the older
`?view=todo` and `?view=jots` open it too. To-do, Jot, Pins and the created
lists are authored files in the private registry under `lists/`, written whole through the
viewer's token (`gh-store.js`'s `save`), so each check-off is a commit.
`state/` holds only derived caches, never these.

| List | File | Item shape |
| --- | --- | --- |
| To-do | `lists/todo.json` | `{id, text, done, created_at, done_at, urgent, due}` |
| Jot | `lists/jots.json` | `{id, text, created_at, kind}` |
| Pins | `lists/pins.json` | `{id, target, title, note, group, created_at}` |
| Created lists | `lists/<name>.json` with a `title` | `{title, icon, capabilities, items: [{id, text, note, done, done_at, created_at}]}` |
| Ping | `errands/requests/`, `errands/results/`, on the `background` branch | a `ping` errand and its result |
| Note | `notes/notes.jsonl` | `{id, at, author, about, text, anchor}` |

- **Optional fields round-trip.** A field is written only when set, and the
  savers write parsed items back whole, so a field added by hand or by a session
  survives the pane.
- **To-do:** an item is hot when `urgent` or its `due` (`YYYY-MM-DD`) has
  arrived.
- **Jot:** no done state. A jot stays until it is promoted somewhere with a real
  home (a chron entry, a tracker task, a to-do) and deleted. `kind` is an open
  vocabulary, normalized to lowercase and hyphens, at most 24 characters. A kind earns a
  name only by naming a destination the text cannot imply (`snag` → the owning
  repo's [SNAGS.md](../SNAGS.md)).
- **Ping:** a question typed here goes to Gemini as an errand in the
  registry's `errands/` folder, which the Gemini home laptop daemon answers.
  The ten latest questions are listed, each showing when it is sent, when
  Gemini is working on it, and Gemini's reply. Questions filed from a
  session's command line appear too. A marker beside the heading says whether
  the daemon is running: active, behind, or quiet. Its Check asks the daemon
  to answer a `status` errand.
- **Pins:** each `target` is `owner/repo[@ref]:path`; a path with an extension
  opens the file, anything else the Files view at that folder.
- **Created lists:** a file in `lists/` with a `title` beside its `items` is a
  list made in this view. Its file is named from its first title and keeps that
  name through a rename. `capabilities` can turn on `done`, the one capability
  `lib/kits/lists.js` opens to created lists so far; that kit declares the rest.
  `lists/autocorrect.json` has no title and stays the dictate page's.
- **Note:** one line per note, appended through `lib/kits/notes.js` and never
  rewritten. A list item's note key addresses it as
  `<registry>:lists/<file>.json#<id>`. The skill is
  [`skills/notes/SKILL.md`](../../skills/notes/SKILL.md).
