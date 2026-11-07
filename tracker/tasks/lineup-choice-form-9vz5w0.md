---
id: lineup-choice-form-9vz5w0
title: Build the lineup, the form for choosing one of several working options
status: backlog
opened: 2026-10-25
project: app
size: L
awaiting: whether a lineup's verdict lands as a verdict file beside the request (as approval/1 does) or as a note in the notes store; sign-off on the two governed-doc entries below
---
# Build the lineup, the form for choosing one of several working options

A **lineup** is one page drawn several ways under a strip of option pills,
so the reader compares working versions and picks one. It is the form the
`choice` row of `docs/forms/README.md` lists as "none yet". The name and its
mark were settled with the owner on 2026-10-23 to 2026-10-25, growing out of
the option page in `docs/prototypes/themes-options.html` (the design-sprint
skill's phase 3); a working prototype of a closings lineup was handed over as
an uncommitted toss link and is not in the repo.

Decided so far:

- **The strip.** Compact, at the option page's height (about 43px): the
  lineup's mark, then one filled pill per option ("A · Columns"), the chosen
  pill tinted. The mark opens a menu listing every option with its letter and
  one-line description, the chosen one tinted. Picking an option draws nothing
  on the page itself.
- **The mark.** Fanned prints: three photographs fanned behind one another,
  the front one showing a hill under the sun. Drawn to the drawn-mark rules in
  `docs/favicons/README.md`; it replaces the flask the option page used. The
  SVG, until it is committed:

  ```svg
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="1.5 1.75 29 29" fill="currentColor"><desc>Three photographs fanned in a hand, the front one showing a hill under the sun: leafing through prints to pick one.</desc><defs><mask id="behind"><rect x="0" y="0" width="32" height="32" fill="#fff"/><rect x="10" y="6" width="12" height="18" rx="1.5" fill="#000" stroke="#000" stroke-width="5"/></mask><mask id="picture"><rect x="0" y="0" width="32" height="32" fill="#fff"/><circle cx="18.9" cy="10.1" r="1.6" fill="#000"/><path d="M11.8 21.8 15 15.5l2.4 3.6 1.8-2.2 1 4.9z" fill="#000"/></mask></defs><g mask="url(#behind)"><rect x="10" y="6" width="12" height="18" rx="1.5" transform="rotate(-22 16 27)"/><rect x="10" y="6" width="12" height="18" rx="1.5" transform="rotate(22 16 27)"/></g><rect x="10" y="6" width="12" height="18" rx="1.5" mask="url(#picture)"/></svg>
  ```

- **Notes, for now.** The look panel, one step per option: note steps with a
  `mark` letter, started with `Look.start(steps, { folded: true })`, kept in
  step with the pills through `Look.go(j)` and the `look:step` event. Those
  hooks merged in web-tools #1081.
- **Notes and the verdict, next.** The FAB drawer rather than the bottom panel
  (mocked 2026-10-23). The About tab lists the options, each tappable. The Note
  tab names the option on screen as the note's subject, gains a verdict
  control (one button per option, a "why" field) and a Send, and lists the
  notes by option. Two constraints were measured: the drawer reads nothing from
  a `#gz=` page, so a lineup must be a committed page opened through `#gh=`;
  and the drawer is 22rem wide, capped at 92vw, so on a phone it hides the
  page while the verdict is written.

Scope, in order:

1. A lineup kit: a page declares its options (key, short name, one-line
   description) and gets the strip, the mark, the menu and `#v=<key>` in its
   address, with the look panel as its notes.
2. The mark committed under `docs/favicons/`, and the closings lineup
   committed as a page that reads `state/closings.json` from web-tools-private
   with the reader's token instead of carrying the counts, since web-tools is
   public.
3. The drawer: a page contract naming the option on screen as a note's subject,
   the verdict control, and Send from the Note tab.
4. With the owner's sign-off, since both are governed docs: the mark's entry
   in `docs/favicons/README.md`, and the lineup named in the `choice` row of
   `docs/forms/README.md`, with where its answer lands.

## Related

- `docs/forms/README.md`: the `choice` row this form fills, beside `decision` and `reaction`
- `docs/envelopes/approval.md`: the verdict-file pattern a lineup's verdict may follow
- `lib/kits/look.js`: the panel and the four hooks a lineup drives (`mark`, `folded`, `go`, `look:step`)
- `lib/alpineComponents/fab.js`: the drawer's About and Note tabs and the page contracts (`about`, `actions`, `toggles`, `menu`)
- `docs/fab.md`: the drawer's account of the Note tab and the annotator
- `docs/favicons/README.md`: the drawn-mark rules the mark follows
- `docs/prototypes/themes-options.html`: the option page the lineup grew out of
- `skills/design-sprint/SKILL.md`: phase 3, "Comparing working options", which hands over an option page
- `mehrlander/web-tools-private:state/closings.json` (background branch): the data the first lineup draws

## Done when

A page in this repo declares a lineup and gets the strip, the mark and the
menu from the kit; the closings lineup is committed and reads its data with the
reader's token; and a verdict written in the FAB drawer lands where the owner
decided.

## Progress log
- 2026-10-25: Filed from claude/look-panel-fold after web-tools #1081 merged the look-panel hooks. Next: the lineup kit, scope item 1.
