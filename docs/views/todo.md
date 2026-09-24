# Lists

**The stop used to hold four panes**, adding To-do and Jots on the reasoning
that the four read as a gradient of commitment: a jot is unshaped intent, a
to-do is shaped intent, an open branch is intent in flight. That reads well and
was still wrong. A personal checklist is not the estate's activity, it is
something you keep; and holding the two lists here cost the full content column
to the two panes that genuinely are activity. They are their own nav stop now,
**Lists** below.

The layout was responsive before that, the pill on narrow screens only and every
pane side by side on `lg+` (the branch list as the main column, the two lists a
24rem right rail). The rail held its width whether or not either list had
anything in it, so it was a standing claim on the page's scarce axis for content
read on purpose rather than watched. One pane at full width, at any size, is the
same trade the phone was already making, and the pill's counts keep an unopened
pile from going invisible, which is the only thing the rail bought that a tab
does not.
### Lists

**Lists** is To-do over Jot, both on screen at once. Merging them is what made
the tab unnecessary rather than merely fewer: the reason to switch tabs was to
see the other one. Both old keys still resolve here, `?view=todo` and
`?view=jots`, so a saved link lands somewhere real.

The split is fixed halves, each scrolling **inside itself**, so adding to one
never pushes the other off screen. That needs a definite height, which the shell
hands down: for this view only (`listsFill`), the estate pane and its column
become `flex` + `overflow-hidden` instead of the ordinary scrolling column, and
the component root joins the chain. That change of display had a cost nobody
saw for three weeks: an auto inline margin sizes a flex **item** to its content
rather than stretching it, so the `mx-auto` this wrapper already carried
silently capped the pane at the width of its widest row. Lists came out 548px
wide inside a 1280px window, `!max-w-none` and all, which is what made the Pin
grid split a half-width pane into two columns and clip a 26-character title.
`w-full` on that wrapper is the fix and is inert in every other view, where the
parent is still a block. Nothing in the pane adds a card, a border
box, or a second layer of padding: two sections, one hairline between them, and
the scroll on the list rather than the page. Each half keeps its heading and add
form pinned while its list scrolls, since the add form is the reason you came;
the heading row wraps at narrow widths so the input never squeezes, with no
breakpoint to disagree at any size.

**To-do** is a general, personal checklist: not repo-scoped and not a surface,
so it keeps its own tiny file, `lists/todo.json` in the registry (`{items: [{id,
text, done, created_at, done_at, urgent, due}]}`), rather than reusing the
surfaces schema. Add a line, check it off, or delete it; a checked item moves
into a collapsed "done" pile instead of disappearing, so delete is the only way
an item actually goes away.

Two fields say an item needs attention, and they answer the same question by
different routes. **`urgent`** is the flag button: set by hand, cleared by hand.
**`due`** is a plain `YYYY-MM-DD` from the date chip, which lays a transparent
native date input over itself so one tap opens the platform picker. A row is
**hot** when it is flagged or its date has arrived (today or overdue), and a hot
row takes the colored left rail the branch and session rows use for state. The
distinction is the point: a flag has no expiry and decays into noise once a busy
week has flagged everything, while a date arrives on its own and stops mattering
on its own.

Open items sort in three bands, soonest first within each and the file's own
order breaking ties: hot, then dated but not yet, then undated. The chip reads
forward (`3d late`, `today`, `tomorrow`, `4d`, then the date past a week) and
colors by band, and the count beside the total is the hot count. Both fields are
written only when set and deleted when cleared, so "never urgent" and "no longer
urgent" read identically; the done pile ignores both, since a done item is not
urgent whatever it was on the way in. Optional keys are honored where present
and the savers write the parsed items straight back, so a field added by hand or
by an agent session survives a round trip through this pane. Every mutation writes the whole file straight through the viewer's
token (`gh-store.js`'s `save`), the same as a surface edit, so it is durable
across browsers and devices, not a per-browser `localStorage` list. Token-gated
like Surfaces: no token, no list.

**Jot** is the capture sibling: quick ideas, one flat item list in the
registry's `lists/jots.json` (`{items: [{id, text, created_at, kind}]}`, `kind`
optional), same whole-file write mechanics. Singular, because you jot one thing; the file keeps
its plural name, since renaming a data file to match a label is a migration that
buys nothing. The lifecycles differ: a to-do tracks work and completes; a jot has
no done state. It sits in the pile, newest first with its age showing, until it
is promoted somewhere with a real home (a chron entry, a tracker task, a to-do)
or deleted. Two hooks anticipate the maintenance cycle around that promotion
without building it yet: the add commit carries the jot's text, so the file's git
history is itself a capture log, and the registry sits in agent-session scope, so
an agent session can read the pile and drain it (promote, then delete) the way
`chron/dump/` is drained.

**A jot's `kind` is the drain's routing hint, and it is open.** The estate had
already answered this question twice in opposite directions, and which answer
applies turns on one thing: `links/board.json`'s `kind` is a closed set of four
because the **renderer switches on it**, so the code has to exhaust the cases,
while `lists/pins.json`'s `group` is free text because it only groups, and
`pinGroups` derives the set from the items. A jot is the second sort. Every jot
renders identically and the only thing that acts on a kind is the drain, which
reads the text anyway, so nothing declares the set: it grows from use, and a
kind nobody uses again leaves with its last jot. The one discipline an open
vocabulary needs is a normal form (lowercase, hyphenated, 24 characters), or
`Snag`, `snag ` and `Doc Failure` become three kinds and the chips stop
converging.

The chips are what keep it converging rather than sprawling: the add form
offers the kinds already in the pile, commonest first, so tapping is always
cheaper than typing and nobody writes `snag` twice; a trailing `+` is how a kind
that does not exist yet gets made. They sit inside the capture form, ahead of
the box and always visible, so a kind can be picked before the text is typed
and the field is not something you have to know is there. A row of their own
was the first shape and it charged every jot a line; inside the form they cost
nothing until the pane is too narrow to hold chips and box on one line, where
the form wraps and the box drops below them. A kind
earns a chip by naming a **destination the text cannot imply**: `snag` names the
owning repo's [`SNAGS.md`](SNAGS.md), where a topic is in the text already and
grep finds it. Seeded with `snag` alone, 2026-08-26, because every jot in the
pile that day was the same thing, an idea for this app, which is the pile's
default and so needs no name.

**Pins** render above the two lists rather than beside them, and have no
`?view` key of their own. They are internal links kept at hand, one flat item
list in the registry's `lists/pins.json` (`{items: [{id, target, title, note,
group, created_at}]}`), each `target` in the `owner/repo[@ref]:path` grammar.
This is the estate-wide personal sibling of the per-repo `pins` manifest field
that fills the sidebar's Pinned block: same keep-at-hand meaning, same open rule
(an extension means a file, anything else opens the Files view at that folder).
Unpinning removes the pointer only; the target stays where it lives. Off the
commitment gradient the other two sit on, deliberately: a jot is unshaped
intent and a to-do is shaped intent, while a pin is memory, a pointer to
something that already has a home.

All three live under `lists/` because they are
authored content with the registry as their source of truth; `state/` stays
derived caches only.

**Each heading links its own file**, which is the jump-over convention arriving
somewhere it had been missed: three panes were writing three files in a private
registry with nothing on screen naming the repo, the path, or the fact that
checking a box is a commit. The glyph names an exact file, so it carries a
**peek** (`lib/kits/source-peek.js`): hover shows the JSON, a tap opens the
blob. The card is seeded from the bytes the loader already read, and re-seeded
by every saver, because a peek that kept its copy from mount would answer "what
is in the file" with a file that one check-off had already replaced.
