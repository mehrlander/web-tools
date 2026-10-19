# Lists

The Lists view holds To-do, Jot, Snag, Ping, Note, Pin and the lists created in it
(`lib/alpineComponents/estate.js`). Its address is `?view=lists`; the older
`?view=todo` and `?view=jots` open it too. To-do, Jot, Pin, Snag and the
created lists are authored files in the private registry under `lists/`, each named for
its list and written whole through the viewer's token (`gh-store.js`'s
`save`), so each check-off is a commit.
`state/` holds only derived caches, never these.

| List | File | Item shape |
| --- | --- | --- |
| To-do | `lists/to-do.json` | `{id, text, done, created_at, done_at, urgent, due}` |
| Jot | `lists/jot.json` | `{id, text, created_at, kind}` |
| Pin | `lists/pin.json` | `{id, target, title, note, group, created_at}` |
| Snag | `lists/snag.json` | `{id, text, note, repo, seen, targets, created_at}` |
| Created lists | `lists/<name>.json` with a `title` | `{title, icon, capabilities, items: [{id, text, note, done, done_at, created_at}]}` |
| Ping | `errands/requests/`, `errands/results/`, on the `background` branch | a `ping` errand and its result |
| Note | `notes/notes.jsonl` | `{id, at, author, about, text, anchor}` |

- **Optional fields round-trip.** A field is written only when set, and every
  write changes a fresh read of the file (`lib/kits/lists.js`), so a field or
  an item added elsewhere survives the pane.
- **To-do:** an item is hot when `urgent` or its `due` (`YYYY-MM-DD`) has
  arrived.
- **Jot:** no done state. A jot stays until it is promoted somewhere with a real
  home (a chron entry, a tracker task, a to-do) and deleted. `kind` is an open
  vocabulary, normalized to lowercase and hyphens, at most 24 characters. A kind earns a
  name only by naming a destination the text cannot imply (`snag` → the Snag
  list).
- **Ping:** a question typed here goes to Gemini as an errand in the
  registry's `errands/` folder, which the Gemini home laptop daemon answers.
  The ten latest questions are listed, each showing when it is sent, when
  Gemini is working on it, and Gemini's reply. Questions filed from a
  session's command line appear too. A marker beside the heading says whether
  the daemon is running: active, behind, or quiet. Its Check asks the daemon
  to answer a `status` errand.
- **Pin:** each `target` is `owner/repo[@ref]:path`; a path with an extension
  opens the file, anything else the Files view at that folder.
- **Snag:** friction learned the hard way, every repo's in one list. `id` is a
  short slug, `text` the trip in one line, `note` the entry (what happened,
  why it was invisible, the corrected move), `repo` the repo it belongs to,
  `seen` every date it bit, and `targets` the files holding the fix, opened
  as a pin's target is. A repeat is another date on the item that owns it,
  never a second item, so the add box filters the list as it is typed into
  and Again adds today. The third date earns a tracker task that removes the
  cause. Snags were `docs/SNAGS.md` in web-tools until 2026-10-20; notes
  written before then address one as `<repo>:docs/SNAGS.md#<id>`, and the
  view counts them.
- **Created lists:** a file in `lists/` with a `title` beside its `items` is a
  list made in this view. `capabilities` can turn on `done`, the one capability
  `lib/kits/lists.js` opens to created lists so far; that kit declares the rest.
  `lists/autocorrect.json` has no title and stays the dictate page's.
- **Note:** one line per note, appended through `lib/kits/notes.js` and never
  rewritten. A list item's note key addresses it as
  `<registry>:lists/<file>.json#<id>`. The skill is
  [`skills/notes/SKILL.md`](../../skills/notes/SKILL.md).
