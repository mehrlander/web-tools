# Repos

**Repos: membership and fields live on each repo.** A repo appears on the estate
by opting in with `estate: true` in its **own** `.web-tools.json`. Every
descriptive field is the repo's too: `group`, `note`, `icon`, `order`, plus its
`pins` and `landing`. The registry holds **no per-repo config**. The single
source of truth for how a repo appears is the repo.

The estate discovers members by enumerating the account's repos (`gh.repos()`,
one list call that also carries description / visibility / pushed-ago) and
reading each one's config. Reads are served through the registry's **config
cache** (`state/configs.json`, below), so a normal load is two GETs, not an
N-repo scan; a cold cache falls back to a live per-repo scan and then rebuilds.

Cards lay out full-width as a three-wide grid grouped by `group` (a section
header + count per group, like the pages index). Group order and within-group
order both derive from each repo's `order` (a group sorts by its lowest member's
order). An `owner/foo-private` companion folds into `owner/foo`'s card by naming
convention (both on the estate; no field), where the visibility glyph becomes a
**toggle**: tap it to flip the card to the private repo's face (title, icon,
note, gear, jumps all switch) and back. The card name opens the repo in the
shell; the github-logo opens it on GitHub; the cloud-download icon opens the repo
in **Public browse**; the `pins` render as direct-jump chips. The gear opens the
shared repo dialog on its **Settings** tab (a form for `icon` / `group` / `note`
/ …, beside the raw-JSON **Config** tab and the **Info** tab), which writes the
repo's own `.web-tools.json` without navigating away.

**Adding a repo** sets `estate: true` (plus `group` / `note`) in the chosen
repo's own config through the viewer's token (candidates come from the header
picker's account list, minus current members). So both add and edit write the
**repo**, never a registry list.

**Hiding one is the exception, and it writes the registry.** A member can be
kept off the dashboard without leaving it, through the `hidden` list in the
private registry's own `.web-tools.json` (an array of `owner/repo`). The
asymmetry is the argument: membership and every descriptive field are
properties of the repo, and *not wanting to look at something* is a property of
the person looking, so it belongs where the other viewer-owned estate content
already lives, beside the pins and the lists. Nothing is written to the repo it
names, which is what makes it reversible from here.

A hidden repo drops out of the sidebar Repos index, the app-view nav (its
promoted `pages` with it), the Repos grid, and the activity crawl, so it stops
costing a per-branch scan as well as attention. It keeps `estate: true` and
every field it declared, and opening it by address still works. The **Hide from
the estate** row on the repo actions menu writes the list from the sidebar row,
the card, or the Hidden row alike, and the Repos view carries a folded
**Hidden** section whose count is the only thing visible until it is opened:
one line, and a Show button per row, since a list you cannot undo from is a
trap. The write leaves a local override behind that retires itself once the
config crawl agrees, the same self-retiring idiom the Unfiled rows use, so a
just-hidden repo does not reappear for a pass and read as a failed write.

It does not compete with `conventions: 'optout'` below, though the questions
sound alike. Optout is the repo's own statement that it is not part of this
estate; `hidden` is the dashboard being told what to draw, for a repo that
still is. Setting `estate: false` instead would drop the repo's group, note,
icon and order on the way out and make coming back a reconstruction.

**Unfiled: the rest of the account**, below a rule at the foot of the grid. The
membership filter above discards most of what the load already fetched, since
`gh.repos()` returns every repo you own and the cards keep only the opt-ins, so a
repo you own but have not filed was visible nowhere except the Add form's
`datalist`. That models non-membership as "not yet added" and leaves the decision
itself unrepresented: there was no way to say *I looked at this one and it does
not belong here*.

The rows split three ways, on **two independent axes**, so neither subsumes the
other:

| State | Set by | Asks | Group |
| --- | --- | --- | --- |
| archived | GitHub | is this finished? | Retired |
| `conventions: 'optout'` | the repo's `.web-tools.json` | is it on my dashboard? | Set aside |
| neither | | undecided | Unfiled |

A live repo can be off the dashboard, which is why both exist. `archived` is the
cheaper of the two and the only one needing no file in the repo, which is what
makes it reachable for a 2018 repo that will never carry a `.web-tools.json`; it
also rides in free on the list call already being made. Undecided sorts newest
push first and stays open; the two settled groups fold, because an undecided list
that never empties is a second inventory and one that drains is a work surface.

Each row carries the three outcomes it actually has. **Adopt** routes into the
existing Add form prefilled, so membership keeps one implementation and `group` /
`note` stay available. **Set aside** writes `conventions: 'optout'`, the field
[`kits/portable-align.js`](../lib/kits/portable-align.js) has graded since PR #222
and which until now had a schema entry, a reader, and no way to set it. Both go
through one `patchRepoConfig`, so both write the **repo**.

**Retire is a link out, and deliberately not a write.** Deleting needs a
`delete_repo`-scoped token and this one is `repo`-scoped on purpose (the view's own
"Get a token" link says so), so widening it for a twice-a-year action would put a
delete-capable credential in `localStorage` and into every tossed page. GitHub's
danger zone also offers Archive above Delete and demands the name typed, which is
better space in front of the decision than a dialog here would be. So the page
names the destination, GitHub performs the act, and the next load tells the truth
on its own: because `archived` arrives in the list call, a repo archived on GitHub
moves itself into Retired with nothing stored here. An archived row is muted, keeps
its browse jump (the point of archiving rather than deleting is that it stays
readable), and drops both write actions rather than offering what the API
will refuse. The foot of the section carries the other end of the same errand, a
link to `github.com/new`: create there, adopt on the row, it gets a card.

One wrinkle the writes share: a config lands in the repo instantly but reaches
these rows only through the config cache, which rebuilds asynchronously. A local
override carries the row in the meantime and **retires itself once the cache
agrees**, rather than being cleared per load, which would bounce a just-filed row
back to Unfiled for a pass and read as a failed write.

The same population is what the tracker's *session-start nudge for unconfigured
repos* addresses from the agent side. Both read `conventions: 'optout'`, so keep
them on that one field rather than growing a second vocabulary.
**Saved surfaces are gone, and so is the repo surface chip** (2026-08-27). The
Stage's Saved pane listed `.surface` files from two places, the registry's
`surfaces/` and any repo declaring a `surface` in its own `.web-tools.json`,
and offered Load onto the stage; the bench could save its set back as one. All
of it went, because a surface is not a saved stage: two files ever existed,
neither came from a bench, and the curated content they hold was filed behind a
workbench pill. The format keeps its reader
([`lib/kits/surface.js`](../lib/kits/surface.js)) and its contract
([`docs/envelopes/surface.md`](envelopes/surface.md)); the one page reading a
surface today is `pages/branch.html`, through `branch-review/1`.
Token gating: no token means the public default card only, no surfaces, no
activity, no sessions, and no write controls. In that state the Repos view leads with a
**public banner** that says exactly what is and isn't available and offers the
two real next steps, a token or Public browse, instead of a vague "set a token"
aside. Deep links: `?view=estate`, `?view=stage`, `?view=activity`, and
`?view=sessions`, each always stamped and so shareable on its own. Estate was
the exception until 2026-08-11, stamped only alongside a `repo`/`ref` param on
the reasoning that the bare URL was the Repos estate already. That premise
expired when the bare URL started routing a token-bearing browser to Activity:
signed in, Repos had no address, and copying it handed the reader Branches.

**The shared dialog is scoped by how it is opened.** With no repo, from the
**account row** at the top right of the Repos view, it is an **account panel**:
the token control alone, no repo tabs (**Refresh views** left with the header
shield, being the same `refreshConfigs` the Repos view carried its own button
for; that button is now the State view's config row, and the account row is
where the token lives).
With a repo, from a card gear, a sidebar Repos row, or the Map, it is the **repo
dialog**: the **Info** tab (repo facts, the token control, a Public-browse
shortcut, and the repo name as the one-tap GitHub link), plus the **Settings**
and **Config** tabs. It is the path for a repo you are *not* in; the open repo's
manifest is edited in the roomier Config view. The dialog's former GitHub /
jsDelivr-CDN / flat-tree link list was retired (2026-07-19): GitHub is the header
link, and a file listing lives in Public browse.
