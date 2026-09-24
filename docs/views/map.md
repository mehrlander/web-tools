# Map

**Map** (`?view=map`, always stamped; `?view=portable` still resolves here) turns
the coordination layer itself into a first-class object, and is the operational
face of the constellation doctrine ([`docs/CONSTELLATION.md`](CONSTELLATION.md)
is the portable kernel, opened from the Distribution header; the full worked instance is
in the private `home` repo). Ten top-level tabs in
`lib/alpineComponents/map.js` answer distinct questions about the layer. Two of
those stops carry a smaller second level: **Docs** holds **Inventory**, **Purpose**,
and **Growth**, while **Harness** holds **Automation** and **Tests**. Who
carries the set is a fact about a repo
and lives on the Repos cards.

**The open tab or subview is addressable:**
`?view=map&tab=aims|set|surfacing|showing|docs|growth|claims|harness|tests|kits|skills|views|registries`,
on the same `tab` key the project view's pills use, with the default (`set`)
left out of the URL so a plain `?view=map` link is unchanged. The tab is held
by the shell rather than by `map()`, because the URL is the shell's to own and
the component mounts lazily; the component renders whichever tab is set, watches
the shell for a back-button change, and fetches that tab's manifest on arrival
by whatever route. Existing `?tab=aims`, `?tab=growth`, and `?tab=tests` links
retain their exact destinations even though their views now sit below Docs or
Harness rather than on the main strip. A tap on the Docs top-level stop and
`?tab=docs` both open Inventory; Purpose remains addressable at `?tab=aims`.
That routing also avoids the failure this replaced: non-default tabs once
fetched from the click handler alone, so a tab nobody
tapped had nothing to render.

*Distribution* (labelled Portable until 2026-09-17 and The set until
2026-08-07; the `?tab=set` URL key is unchanged) renders the hub's authored
crosswalk, [`docs/portable.csv`](portable.csv). The registry is the owner; it
has no prose parent. Its rows select artifacts from their primary inventories
and say how each one travels: installed by the plugin, read live, referenced,
adopted once, or fetched on demand. Skills remains the capability inventory,
Docs/Inventory remains the documentation inventory, and Harness/Automation
remains the executable inventory. Distribution links to those owning views
instead of pretending to be a second copy of them.

Opening a file title launches the Map's Swipe Deck over the visible crosswalk,
with the selected row first and the rest available by swiping. Markdown opens
rendered; the deck's view control exposes its source, and the action menu keeps
the copy and Files-view routes. In rendered Markdown, authored relative links
and whole inline-code filenames that resolve to one repository file become
repository doors. A file already in the deck becomes the active slide; any
other file opens one level down, where Back returns to the citing document.
Ambiguous code names stay inert. Directory rows open their folders, and each
row's GitHub control still provides the direct source path. The doctrine kernel
rides here as a reference, so the theory sits beside the delivery contract it
explains. The hub is public, so this view needs no token.

*Scope and adoption moved to the Repos cards on 2026-08-03.* They are facts
about a repo, and a card is where a repo is described, so a second grid of the
same repos with different columns was a copy of the roster. It also ended a real
drift: the Map kept its own roster, and a repo that joined the estate was never
graded. The cards are the roster now, so there is no second list to disagree.

On a card: the **verdict** badge beside the name, then the four checks as chips
(marketplace, plugins, conventions, config), failing ones visible rather than
collapsed into a score, since a failing check is the next step. **Scope** is the
repo's own account of what it holds and why, read live from its
`.web-tools.json` `scope` field (inline prose, or a repo path ending in `.md`
linked to its blob) and **expanded on tap** rather than carried open: it is a
paragraph worth reading once, and on a card it would push the live rows off the
bottom. The repo owns the story; the estate only stacks the statements, so the
cross-repo picture is a view, never an authored central list. The hub and the
registry carry a role instead of a grade, since grading the hub against its own
set says nothing. Grading stops at estate members deliberately: probing every
repo in the cache would make this an account-wide scan mostly composed of
repos that will never carry the set, at three live reads each. The blind spot
that buys is that a repo adopting nothing is invisible, since the file that
would list it is the first thing adoption writes. Graded by [`lib/kits/portable-align.js`](../lib/kits/portable-align.js), which is pure and
tested.

**The grade is read, not probed.** It rides the config cache
(`state/configs.json`), computed by the crawl that already reads each repo's
manifest, so a card costs nothing beyond the cache read the estate was making
anyway. The first cut fanned out three live reads per member on every estate
load, which is the bill that comes due when a Map tab becomes a dashboard: a tab
is opened sometimes, a dashboard is the front door. The trade is that a grade is
as fresh as the last crawl rather than as fresh as the render, which is right,
since adoption changes when someone edits a settings file. The State view's
config row re-crawls when the answer matters now. A repo the crawl has not reached shows no
verdict and no chips: absent means not read, never not aligned.

*Surfacing* indexes the primitives from [`docs/surfacing.csv`](surfacing.csv),
one card each (glyph, use, form, boundary). The ownership runs opposite to
every other tab, and the header says so: [`SURFACING.md`](SURFACING.md) is the
authoritative document, since it is what sessions load and follow, and the
manifest is its gated index (membership held two-way to the doc's bullet
lead-ins by `tools/test/surfacing-manifest.test.mjs`; the card summaries are
paraphrases and stay unchecked, which the Docs registry's claims table states).
A card's TITLE opens the doc at the bullet it paraphrases (2026-09-04), docking
the deck so the two sit side by side, scrolling smoothly to the bullet and
tinting it yellow for four seconds. That treatment is
[`lib/kits/land.js`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/land.js)'s
rather than this tab's, and the kit is a SECOND implementation lifted rather
than a first invented: `mehrlander/home`'s budget-drs submittal view has
answered the same question for months over two subjects, a block of prose in an
office document and a rectangle on a page of a PDF, and this tab arrived at a
near-identical scroller walk independently. A landing sits 28% down rather than
centred, since centred puts half the previous section above the heading that was
asked for; only the nearest scrolling ancestor moves, since scrollIntoView walks
every one and scrolled the card list out from under the reader. home's copy is
still inline in its own page and is the adopter, not the source.

**The estate had six landings and they disagreed on both axes.** A survey on
2026-09-04 found them in five files across two repos, sitting at the centre, at
28%, at a fixed 80px and at the page top, in three different yellows, two of
them a hardcoded orange the theme does not carry. Nothing reported it, because
each one looked right on its own surface. `kits/pdf.js` is the one now brought
alongside: its find hit lands at the kit's height and its marks read
`--color-warning` through the same `color-mix` the kit compiles to, held by
[`tools/test/land-parity.test.mjs`](https://github.com/mehrlander/web-tools/blob/main/tools/test/land-parity.test.mjs)
rather than by a call, since pdf.js has no kit dependencies and one consumer
loads it straight from jsDelivr. Three of its lessons went the other way: a set
has a **current** member and is drawn at two strengths; an overlay mark
**multiplies** so it sits under the glyphs it covers; and a mark over a rendered
page needs a stronger percentage than one behind DOM text, because multiplying
against white washes the same number out. `state-view.js`'s `aim` takes the kit's
scroll and keeps its own tint, since `item` already drives a reactive class
there and two owners for one mark leaves one behind. Two stay put on purpose:
`fab.js`'s highlight has no dwell and a clear button, which makes it a
highlighter rather than a landing, and `annotate.js` lands on a foreign page
where its 80px is a gap above a drawn rectangle rather than a fraction of a
pane.
No correspondence is invented for it: `surfacing.csv`'s `lead` already is that
bullet's bold lead-in, held both ways by `surfacing-manifest.test.mjs`. What the
manifest gate cannot say is whether the key survives RENDERING, and it barely
does: the primitives are a loose list, so marked wraps each item in a `<p>` and
the lead-in is `li > p > strong:first-child`. The tight `li > strong` matched
none of the twenty-two. [`tools/test/surfacing-lead-anchor.test.mjs`](https://github.com/mehrlander/web-tools/blob/main/tools/test/surfacing-lead-anchor.test.mjs)
renders the real doc and holds both facts.

The header's deck door opens `SURFACING.md` and its index as two slides of the
house swipe deck rather than routing to the Files view (2026-09-04): docked, the
prose sits beside the cards it is authoritative for, where the route change put
them off screen. It wears `swipeDeck.entry`'s glyph and wording like every other
door in the estate, ghost-toned because the cards are the subject. Surfacing
decides what to hand over; Showing is what makes it openable.

*Showing* (named Transport until 2026-08-04; renamed because
[`SURFACING.md`](SURFACING.md) already uses "transport" for the stage link, and
the lead section here was titled Showing all along) answers how content moves,
renders, and gets looked at, from the
hub's committed [`docs/showing-mechanisms.csv`](showing-mechanisms.csv),
[`docs/routes-modes.csv`](routes-modes.csv), [`docs/routes-routes.csv`](routes-routes.csv)
and the frame in [`docs/routes.json`](routes.json). It opens with **Showing**,
the mechanism table: given a subject at a version and a viewer, which link
reaches it and, more usefully, what each one cannot show. That table is the
reason `CLAUDE.md` no longer carries 1,589 words on the subject and
[`showing.md`](showing.md) carries only the frame and the record; a rule nobody
could hold in their head is one the app holds instead. Then three sections on
the machinery: the **address grammar**
(`owner/repo[@ref]:path`, with a chip per place it is spoken, each opening that
file in the shell viewer), the **delivery modes** `toss-render.html` accepts
(each row carrying whether it ships the bytes inline or fetches a reference, and
the trust posture that buys: a payload renders under an opaque origin that
cannot reach this origin's token, an address-mode fetch is same-origin and can,
which is why only the second is allowlisted), and the **toss routes** resolving
a content type to its renderer page. The modes section leads with the read
order, since it is one rule everywhere: fragment first, query as fallback, in
`toss-render` for its own params and in the renderer pages through
[`lib/kits/url-params.js`](../lib/kits/url-params.js). A payload belongs in the fragment,
which never reaches a server and so escapes the roughly 8KB cap the Pages edge
enforces with a 414; an address is short, and a routed toss hands `?src=` to
the page through the params shim rather than over the wire. Those facts previously existed only as
source comments in three files, so a reader had to reconstruct them; the
manifest owns them instead. The `routes` block is the owner of `toss-render`'s
`TOSS_ROUTES` literal, which stays inlined so the critical render path takes no
fetch, with `tools/test/routes-manifest.test.mjs` failing if the two drift: the
same builder-plus-drift-check shape as the set's manifest test. Public, like the
set, and loaded on first open of the tab rather than at mount.

*Docs/Purpose* renders the existing estate mission, five goals, and reading
paths from `docs/aims.json`, `docs/aims-goals.csv`, and `docs/aims-reading.csv`.
The reading list begins with the root `README.md` (the repository's public
front door), `CLAUDE.md` (its agent contract), and `docs/README.md` (the
generated documentation index). None is copied into a new Aims Markdown file.
The route remains `?tab=aims` so saved links reach Purpose directly.

*Docs/Inventory* renders the documentation registry,
[`docs/docs.csv`](docs.csv), in the same lazy shape. Two tables. The
**documents table**: every `.md`/`.json`/`.csv` under `docs/`, each with its subject,
its status (**living** claims current truth and is wrong when stale; **record**
preserves a moment and is wrong when rewritten; **measured** carries dated
observations and is corrected by re-probing), its **reach** and **words** (both
derived, see below), and its maintenance (authored or generated, with the
discipline that keeps it true); complete by construction, since
`tools/test/docs-registry.test.mjs` holds the folder and the table to exactly one
row per file. The table is navigated from a folder rail
(2026-08-07): each directory is a row with rolled-up file count and word mass
and its own GitHub link, the selected folder shows its direct files beside it
with that folder's README subject as the gloss, and a reach filter moves the
counts without changing the tree's shape. A row is read in place: its title
opens the document in the house swipe deck (`lib/kits/swipe-deck.js`, loaded on
demand), full length with the peek's own rendition helpers so deck and peek
cannot drift, paging through the selected folder's files as filtered, opened
on the tapped row; its GitHub icon, inline with the badges and always visible,
carries the source peek for the desktop glance, one details toggle on the
reach strip shows every row's maintenance at once, and the files view stays
the route for working on a file rather than reading it. The folder heading
carries the deck's own door beside its GitHub mark (2026-09-04), since the row
tap was a gesture nobody was told about. The **Tests** and **Automation**
subviews under Harness answer the same tap the same way from that date: a row
title opens the deck rather than routing to the Files view, and each carries the
door. Tests pages the suite as its strip has cut it, counted in checks rather
than files, since what a check protects is prose at the top of its own file;
Automation pages the selected folder, the Docs Inventory shape exactly. A
`.csv` row opens as a TABLE rather
than as raw text: the deck converts it to a markdown table so md-doc's wide-table
scroller and prose styling apply, with each cell's markdown escaped, since a
registry that describes markdown was otherwise rendering its own
`[caption](url)` as a link. The peek keeps the raw excerpt, which is what a
glance at the head of a file wants. The file list runs two
columns above `xl` so a wide screen is used rather than left as a gutter. And the **shared claims**: statements that live in
more than one place, each with the one file that owns it and its typed
repetitions (copy, paraphrase, pointer, live read; a copy says who keeps it, by
hand or by a named builder), where an absent check renders in the warning tone
rather than being omitted, because an unchecked copy should look unchecked every
time the tab opens. The claims table renders on its own **Claims** tab
(2026-08-07), off [`docs/owners.csv`](owners.csv); the `?tab=claims` key is
unchanged, the way `?tab=set` outlived "The set". It keys on claims rather than files, so trailing the documents it
read as an appendix, first open, then folded behind a count; a tab keeps the
documents on one viewport and gives the claims their own. The two registries differ in
how membership is decided, which is the whole reason they cannot share a pane: the claims are
curated and authoritative only for what they cover, while the documents are computed from the
folder and therefore complete. The documents half is public, like the other hub-owned readings.

The **Growth** subview keeps the same documentation subject but changes the
scale of the reading. It frames `pages/doc-growth.html` over the declared
`data/doc-growth/*.json` payload, showing every Markdown file as a bubble moving
through repository history. Inventory answers how one document has changed;
Growth answers what the corpus is doing as a whole. A repository selector only
appears when more than one estate repo declares a growth payload. The retained
`?tab=growth` address opens this subview directly.

Three numbers sit on a row, and they answer three different questions. **Reach**
(derived by `tools/build/docs-reach.mjs`, gated against the registry) says who
*can* get to a file, strongest channel first: injected, project, skill, app,
orphan. **Words** says how much of the folder it is. **Readership**, the eye
column, says who actually opened it: distinct sessions, read from the private
registry's `docAttention` rollup. Reach and readership are the pair worth reading
together, since an orphan nobody opens and an orphan opened in nine sessions are
different problems.

Readership is the one token-gated thing on the tab. Without a token the column
is **absent** rather than blank, because a blank one reads as "nobody opened
it." Its caveats sit in the strip above it and are load-bearing: only sessions
the recorder captured are covered, only the four file tools count (a file read
through a shell command or by a subagent leaves no trace), and an **injected**
doc says `injected` rather than reporting the zero it is guaranteed to score.
That last case is the reason the caveats are on screen instead of in this file:
`CONVENTIONS.md` and `SURFACING.md` are among the most-read documents in the
estate and are precisely the two no file tool can see, so a bare count would rank
them last.

*Harness* has two local readings. *Tests*, from
[`docs/tests.csv`](tests.csv), is the Docs Inventory shape one axis over:
every file in the suite with its kind (gate or behavior)
and what breaks if it is deleted, its assertions, method,
runner and boot-smoke count all derived from the files and gated against the
registry. The strip cuts the total by kind rather than reporting it, since a
pass count cannot tell a boot check from an adversarial gate, and a browser
check reports **no** assertion count rather than zero, because `test()` is not
its unit. *Automation*, from [`docs/harness.csv`](harness.csv), holds every
executable the repository runs on itself, including scripts, git hooks,
session and plugin hooks, and CI workflows. It is grouped by the route on which
execution arrives and keeps test files in the Tests registry rather than
duplicating them. Both readings are public.
