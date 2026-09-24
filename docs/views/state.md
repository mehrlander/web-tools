# State

### State (`?view=state`)

**State** (`lib/alpineComponents/state-view.js`) lists everything the estate
keeps derived, each piece with its age, what builds it, what the build costs,
and a Refresh where one is possible. It is the address the age pills open, and
the reason the four estate Refresh buttons could go.

**Branches and Sessions share one Refresh.** They are two crawls over two
sources into two files, and nothing about that changed: the branch scan reads
every estate repo on github.com (231 calls and about 28 seconds on the run
logged 2026-08-21) while the sessions fold reads one folder in the registry and
a blob per record that moved (4 calls, about a second). They are two rows for
that reason, each with its own store, throttle, history, and probe. What they
are not is two decisions. A session ending moves both at once, its record
landing in the registry and its commits landing on a branch, so a press that
refreshed one and left the other was asking the reader about a boundary that is
internal to the crawls. The two rows sit in an **Activity** group under one
button, which runs both, sessions first, and reports once; the throttled
background passes stay independent on their own intervals, since the cost gap is
a real reason to fetch one four times as often as the other. `GROUPS` in
`state-view.js` declares the group and names the shell method that runs it,
and `tools/test/state-view-groups.test.mjs` holds the fold and checks that the
method the view names is one the shell actually defines.

The row that reads `Branches` was `Branch activity` until the group arrived.
That label was the confusion in three words: **Activity** is the nav stop over
five views with Sessions among them, so a row wearing it read as *the* activity
cache and made the Sessions row look like a half that had been split off. Under
the group heading the row is Branches, which is what its own `used by` chip
always said.

**Each row says who uses it, as view keys**, rendered as chips that route
through the shell's own `go*` methods, so a tap goes and looks at the data being
consumed.

**The chips are composed, not authored.** The authored side is `reads` on
[`docs/app-routes.csv`](app-routes.csv), one column on the registry that already
owns a routed view, naming what each view consumes; a cache row's chips are that
relation read backwards, built at read time and stored nowhere. A scan
([`cache-readers.mjs`](../tools/build/cache-readers.mjs)) bounds what may be
claimed there, and [`state-feeds.test.mjs`](../tools/test/state-feeds.test.mjs)
is where the two meet: it holds the upper bound (no view claims a read no file
of its own makes) and the lower (a row listing a cache's own kit, or carrying a
file that backs no other route, must declare it). The residue between the bounds
is what only a person can settle, which is which of `estate.js`'s seven views
consumes which cache.

The list is still deliberately only the clean answers. The prose it replaced
also named the sidebar, quick links, and things below view granularity, which is
where the detail now lives instead: configs also drives the sidebar, the
quick-link row, and every promoted app view; activity also feeds the Repos
cards' per-repo rollups; sessions also feeds the branch rows' session links.
None of those is a view, so inventing keys for them would be the
over-normalization [registries.md](registries.md) warns against. The entity
index's consumers are `pages` rather than views, kept as a separate field
because a page opens at its own URL while a view is a stop inside this shell,
and one chip cannot honestly mean both. Session titles have no file of their own
at all: the crawl joins the export onto the sessions rows, so the row declares
`via: 'sessions'` and a view claiming titles must claim sessions too. Each row's
crawl cost rides its Refresh button's tooltip, where it is actionable, rather
than a line of its own.

**The JSON is read in the app, not on GitHub.** Every registry row carries one
**Expand** control, a bare caret at the row's end: expanding a row to see its
detail is the gesture people arrive with, where `{}` said "JSON" only to someone
who already knew. It carried a caption first (`Expand`/`Collapse`, then `Expand`
alone) and carries none now. A caret at the end of a row is the most established
control on the web, the panel it opens is directly beneath it, and every other
affordance on the row is already a word, so the caption was a third label
competing on a line that has Refresh and a chip strip. Size carries it instead. It opens a panel with two tabs, **Contents** and
**History**, described below. The file's SIZE is not on the row: it is one more
figure on a line already carrying a path, a grain, and three ages, and it
answers no question the reader arrived with. It rides the Expand control's
tooltip, where it qualifies what pressing costs, which is also what keeps the
one `ls state` read earning its place. The **Contents** tab fetches the file and shows the bytes, verbatim,
in a scrolling `pre` with a line count and a Copy button and nothing else. It
ran through the shared multi-mode viewer first, which brought a mode switcher, a
filter, a sort, a search, an undo pair, a tree toggle, an open-out, and a
GitHub/Raw/CDN menu, all stacked above the data on a phone. That is an editor's
chrome, and nothing here is edited: the crawl owns these files, so every control
but copy answered a question the row does not raise. The full multi-mode reading
stays one tap away at the github mark and at the data route
(`toss-render.html#data=`), which is a viewer: five ways of reading the same
bytes, with no grouping or aggregation in it. Grouping lives in the transform
workbench's Pivot view ([`pages/transform.html`](../pages/transform.html)), a
different page for a different verb. Nothing is re-serialized, since the crawls already write a 2-space indent and the
row's promise is that this is what is committed. One row is open at a time: these run 68 KB to 818 KB,
so mounting four is a cost with no reader. The fetch is not cached, since the
row's whole promise is that what you are looking at is what is committed now.
The path beside each label is a plain label, not a link: it used to be an anchor
to GitHub, which is the one destination a tap on this page should not have, and
the small github mark tight beside it is the deliberate way out. That mark rides
the **filename** at the house size (16px, the shell's default for the mark,
explicit or inherited, and what this view's own header mark already used; it
shipped at 14px, one of only two such instances in the codebase, which put two
github marks at two sizes on one screen). Riding the filename is the shell's own
convention for a jump-over naming an exact file (the estate's surface rows, the Map's item rows, the repo dialog's
title all place it the same way): beside the name it opens, faint and small,
rather than in a strip at the far end of the card. It sat with Expand at first
because the two read as one group of file controls, which they are not, since
Expand acts on the panel and the mark leaves the page. Moving it also fixed an
omission: naming an exact file, it must carry `data-peek`, the narrow rule
[source-peek](https://github.com/mehrlander/web-tools/blob/main/lib/kits/source-peek.js)
states so that a reader can tell a file jump-over from a repo, branch, or menu
one. Refresh sits at the row's top right and Expand at its bottom right, on the
consumer line, with the chips wrapping inside their own box so a third chip
never pushes the control to a line of its own. The panel is separated
by a hairline and bleeds to the card's edges rather than sitting in a bordered,
tinted, indented box of its own: that box, inside the card, around a viewer that
draws its own frame, was four nested edges squeezing an editor that then
truncated its own filename. The viewer is handed the file's basename for the
same reason, since the row two lines up already names the path in full and
`origin` still carries the real one for its links. Height is a share of the
viewport, not a fixed 26rem that was cramped on a phone and stingy on a desktop.

The card's icon rides its title line rather than a gutter to the left. Hanging
it cost about 28px of width on every row, narrowed the description into three
wrapped lines on a phone, and left every line beneath it choosing between a
matching indent and a ragged edge.

**An age pill aims at its row.** `?view=state&item=<key>` names one entry
(`configs`, `activity`, `sessions`, `entities`, `search`, `page`), in
the same idiom `&detail=` uses to open one branch inside the Activity takeover:
the estate addresses one entry in a rendered set by naming it in the URL, not by
scrolling on a callback. Rows carry `id="state-<key>"`, so the anchor is a real
element. The named row is tinted and scrolled to on arrival, and the tint fades
after a few seconds rather than latching, since it answers "which one did I come
here for" and stops meaning anything once that is read; the `?item=` persists, so
the link stays shareable and a reload lands the same way. A bare `?view=state`,
which is what the nav opens, singles out nothing.

The view exists because "refresh" was one icon over two unrelated verbs. A
**crawl** commits a file to the registry and can be hours stale; a **local
recompute** (the search caches, the stage bundle, an Inspect rescan) is instant,
stores nothing, and has no age at all. Both wore the same button in six places,
and the as-of reading that says whether to press was the part hidden below `sm`,
so a phone kept the control and dropped the fact. Three sections carry the
split: **Derived** (the registry's `state/`) and **This browser** (the search
caches and the page itself, both gone on reload, neither estate state). A third,
**Read live**, held the guides list alone and went with it.

**Built and checked are two different ages, and one alone misreads.** `built` is
the last commit touching the file; `checked` is this browser's throttle stamp
(`wt:*CacheCheckedAt`). Every crawl here commits only on material change, so
"built 3d ago, checked 12m ago" means current, not stale, which is precisely
what a lone as-of could never say. The build time is read as the file's last
commit rather than its own `generatedAt`, because reading four `generatedAt`
fields would cost 1.5 MB of JSON for four timestamps, and for a file only the
crawl writes, the commit is the write. Staleness is only claimed where the
source declares a bar: past twice a crawl's own throttle, or past the 30 days
the entity index's repo check already uses. The whole view costs one `ls state`
plus one commit read per file, regardless of estate size, and it kicks no crawl
on arrival: a view that ran a crawl to show you how old things were would answer
its own question before you read it.

**A crawl started here draws its own bar.** Taking the Refresh controls off the
panes moved the button to the reading that says whether to press it, and for one
release left behind the reading the crawl was already producing: the Branches
pane has had a determinate per-repo bar since the crawl learned to report, and
the same crawl pressed here ran for the same tens of seconds behind a spinner saying only
`Running…`. A control moved without its progress is a control made worse, so the
bar moves with it. Under the ages line each row draws `Reading configs · 31 of 44
repos`, `Scanning branches · 4 of 11 repos · chat-histories, home`, or `Reading
records · 18 of 120 records`, over a bar whose only input is items finished over
items total. All three read the shell's one progress channel
(`crawlProgress`, a slot per cache key), the same one the Branches and Sessions
panes draw, and **the crawl names its own verb and unit**, since only it knows
whether it is counting repos or session records, and whether the scan is
running. A crawl that fans
out unpooled (configs) names nothing in flight, because "every repo" is not a
reading. Nothing is smoothed between two ticks, for the same reason the pane's
bar smooths nothing. The bar spanned **two passes** for a day, since the activity
refresh ran quick-then-scan and a bar that filled, reached the end and started
over says the run has finished when it has not, which is the one thing a
progress bar must never say. The refresh is one pass now (the second was
re-fetching the first's cheap reads), so items finished over items total is
again the whole measure. The throttled background passes publish into no slot and so
draw no bar, which is the point: a list refreshing on its own schedule must not
grow a progress bar nobody asked for.

**Under the bar, the wire.** The bar says how far along; the line beneath it
says what the crawl is doing right now, as the request itself: `GET
repos/mehrlander/home/git/trees/main?recursive=1`, with this crawl's call count
at the right. It comes off gh-boot's traffic ledger, the same capped ring of
every request the page makes that the FAB's Traffic tab reads, tailed here
through its coalesced `traffic` event (one per 250ms, which is what makes a
per-request readout affordable on a crawl that fires hundreds). Three decisions
in it are the honesty: the path is **verbatim** past the host, since a
prettified path stops being the thing being reported and the host is the only
part that repeats on every line; the **method leads**, because a PUT here is the
commit, the one request in a run that changes anything, and it read as an
ordinary row without it; and the count is **this crawl's**, off a baseline the
slot stamps when it opens, since the page makes requests the crawl did not. A
status appears only when it is a failure, because 200 on every line is furniture
and a 409 is the whole story. Only api.github.com rows are shown: a font or a
CDN module arriving mid-crawl is a true row and a misleading one. This is the
one place the reading goes, rather than onto the panes: those show a list being
filled, and this view's subject is the refresh itself.

**The probe answers the question the age was standing in for.** An age says how
old a file is; the question anyone opens this view with is whether there is
anything to fetch, and until the probe the only proxy was the clock (a row went
bold past twice its own throttle, which is a guess dressed as a reading). Two
calls answer it as a fact for the whole view, whatever the estate's size: one
account repo listing gives every repo's live `pushed_at`, and one commits call
on the registry's `sessions/` tree gives the records written. Each is compared
against the row's own `built` date, which the view has already read, so the
probe needs no cache contents and reads no file. Comparing against each cached
entry's own stamp would have meant pulling 66 KB, 371 KB and 279 KB of JSON to
count timestamps. It runs as a second pass after the ages, unawaited, so a slow
or failed probe leaves every row exactly as it was.

**It reports a fact about the source, never a verdict about the cache**, and the
distinction is not pedantry. A push that never touched a manifest still moves
`pushed_at`, so "3 repos pushed since built" is true where "3 repos changed"
would not be; a PR opened with no push changes what the activity cache stores
and moves no `pushed_at` at all. The same figure is an over-count in one
direction and an under-count in the other, and each row's tooltip says which way
its own reading leans. **The Refresh button's weight now rides the probe**,
which is what that weight always claimed to say: solid where the source has
moved, soft where it has not, and back to the twice-the-throttle clock only for
a row the probe cannot answer. The entity index gets no probe, because its
source is the content of ~4,000 files across seven checkouts and the honest
probe is the rebuild.

**Calls answers what the other two readings cannot: what the run SPENT.** The
bar and the wire are live and gone when the crawl ends; the same traffic is kept
in `state/calls.json`, one run per cache key, written by the crawl as it closes
and overwritten by the next. The tab opens on the run: its verb, when, how long,
how many calls, how many bytes disclosed, and how many passes. Then **by shape**,
which is the reading the list cannot give: the path with the parts that vary
between one call and the next taken out (owner and repo, shas, numbers, and a
query's values but not its keys), counted and timed, commonest first. That is
what turns 214 rows into `×167 GET repos/…/…/git/trees/<sha>?recursive`, which
is a fact about the crawl's design rather than about one call. The full list sits
underneath, since a shape can hide the one call that failed; a non-GET method and
a status past 399 are the two things marked, for the same reason they are marked
on the wire.

Three things it does not do, each on purpose. **Only the last run per crawl**, so
the file stays small: the `runs` ring beside the caches already carries the
history at four numbers a run, and twenty runs of two hundred rows would be a
projection nobody reads. **It costs a commit per run**, including a run that
changed nothing, which is exactly what the caches' material-change gate avoids
for them; that is why the log is a separate file, so the gate still holds where
it matters and a log whose whole subject is the run has nothing to compare
against. And **a run that outran the ledger says so**: gh-boot trims its traffic
ring at 400 entries, so the stored rows are the tail, the run's own call count
comes off the totals (which survive trimming), and the tab prints the warning
rather than presenting a short list as complete.

**History answers what an age cannot: how often this really changes.** Beside
Expand, every registry row carries a **History** caret that opens the file's
change log, and the two share one slot, since a row is being read one way or the
other, as the panel's second tab. It first shipped as a second caret beside
Expand, on the argument that the bytes and the file's past are different
subjects rather than two readings of one thing. Overruled 2026-08-10, and the
reason generalizes: at the control strip nobody is reading an argument about
subjects, they are reading two adjacent disclosure triangles on one row and
wondering what the second one does. The distinction was real and belonged one
level in, where a tab strip states it in two words and the panel is already
open. The tabs are two plain words: a glyph beside an exact word is decoration,
the same charge that kept `{}` off the Expand control. The tab choice sticks
across rows for the life of the panel, so a reader working down the histories
does not re-pick it on every row, and each tab loads on its first showing and
then holds. The list is the registry's own commits touching that path, one call
per open (the same `history` the row already makes for `built`, asked for twenty
rows rather than one), each with its stamp, its age, and the gap to the change
before it. An interval's magnitude reads `6 of 11 repos changed · 55%`: the verb is
there because the count alone left the reader to supply one, and "changed" is
the honest superset of the chips below it, which split added from removed from
moved. The expanding row says what it is reading while it reads (`reading
activity.json at both commits…`), since the two versions of the cache itself are
the source and nothing here reads a log. The header folds the list into the
reading worth having, a count, a span,
and a **median** gap, set beside the throttle that governs when the file is
checked. Two measured numbers side by side, not a verdict: a store that changes
every 3h under a 12h throttle is a fact about the estate the schedule has to
answer for, and the panel's job is to put them in one line rather than to grade
them.

**What changed is lazy, and read through each store's own fingerprint.** Tapping
an interval fetches its two committed versions and names the records that moved:
`4 of 19 repos · 21%`, at the grain the row already declares. Because the
magnitude is lazy, that control exists before its own answer does, and it
carried the words "what changed" twenty times down the column to say so. It is a
caret now, in the idiom the panel already uses, and the reading takes its place
on the tap: the column stays quiet until it has something to report. The comparison is
each cache's *own* change detector, the one its crawl uses to decide whether to
commit at all (`hash` in the config and activity caches, with `alignHash` beside
it where a moved alignment grade counts as a changed cache; the record's blob
`sha` in the sessions cache; the serialized record for the entity index, which
keeps no fingerprint). So the panel's answer and the commit gate are one
reading and cannot drift into disagreeing. It is lazy because these files run 68
KB to 818 KB: diffing twenty intervals up front would read a megabyte and a half
to fill a column nobody asked for. Adjacent intervals share a version, and a
version addressed by sha cannot move, so it is parsed once and kept, which is
the opposite of the peek panel's rule and for the same reason: the peek promises
the current bytes, a version promises an immutable one.

**How long a run took is the one thing a read could not answer, so the crawls
record it.** Each cache file carries a bounded `runs` ring
([`lib/kits/crawl-runs.js`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/crawl-runs.js)):
per run, when it finished, how long it took, how much it examined, and how much
changed or failed. Two constraints make it free. It **rides the commit that
already happens**, so it adds no commit of its own: a run log written on every
run would destroy the material-change gate that keeps the registry from filling
with no-op commits, and a separate file beside each cache would double them.
And it is **invisible to the change detectors**, because all three caches decide
whether to commit by comparing their record collections (`repos`, `rows`) rather
than the whole document, so a `runs` key can never cause a commit by itself.
That is a property of those three functions, which is why the ring must stay a
top-level sibling of the records. The config cache gained a `changedRepos` to
match the activity cache's, so the count written into the record and the gate
that decided to write it are one derivation rather than two that can part. A
field the crawl did not measure is **dropped rather than written as zero**: the
config crawl swallows a per-repo read failure, and `0 failed` would be a claim
where an absent key is not. The record is optional by construction: a window
without the kit carries the ring forward and still commits, since nothing about
an extra reading may stand between a crawl and the commit it exists to make.

The panel reads the ring in the **one eager read** it makes: the newest
committed version, whose window is the same twenty, so a single fetch fills the
duration column for every row and is also the version the first interval needs,
making that expansion cost one read rather than two. Buffering the *no-op* runs
locally and flushing them into the next commit was considered and dropped: the
buffer would be per-browser, so a run count assembled that way would silently
undercount every device that never commits again, which is worse than a figure
plainly absent.

**Two limits remain, and each is carried by the thing it qualifies rather than
by a notice.** A crawl commits only on material change, so a run that found
nothing leaves no trace: the log counts changes, not runs, and a quiet week
reads exactly like a week nobody opened the page. That is carried by the
summary's own first word, `10 changes`, which is the whole caveat in one word in
the place the eye lands first. Separately, a row is dated when a crawl *noticed*
a change rather than when it happened, so a gap bounds the interval instead of
measuring it, and the cadence is partly a fact about the estate and partly a
fact about how often the page was open. No label can carry that, so it hangs on
the gap figure's own hover, where someone puzzling over a long gap will look.
Both are limits of *reading* rather than writing; the fix for either is to have
the crawl record something. Duration was a third and was lifted exactly that
way, which is the exception that shows the rule, and it needs no notice either:
a duration shows or it does not.

**This shipped as a paragraph and the paragraph was removed** (2026-08-10),
which is worth recording because the mistake is easy to repeat. All of the above
sat as 40 words of standing prose above the rows, printed on every open. Not
over-claiming is a property of the **labels**; standing prose is insurance
against a misreading, and it earns its space only where the labels actually
invite one. Two of the three clauses restated what the rendering already said,
and on a 430px phone the block was four of about ten visible lines, read once
and noise thereafter. The general rule: **prose in the interface is the
expensive fallback for a label that cannot be made honest, and it should be
rare.** The same pass moved the probe's reading off the Refresh button's
tooltip, where it duplicated the probe line an inch to its left; the button
again says only what pressing it does and costs, and the visible line beside it
is the basis for the button's weight.

**The fourth file has no button, and says so.** `state/entities.json` is derived
like the other three and cannot be rebuilt from a page: it needs spaCy over
~4,000 files across seven checkouts, about half an hour. It gets a full row
anyway, naming its builder and why the control is missing. A freshness surface
that lists only what it can fix repeats the omission it was built to end.

**A deep link mounts the view before auth resolves**, so its first read finds no
token and it would otherwise hold its signed-out state for the life of the page.
The shell announces `web-tools:auth-state` from the same watch that reloads the
estate, and the view re-reads on it. Signed out is a note, not an error: nothing
has gone wrong, the registry rows simply have no ages yet.

Reaching the one row the shell does not own: the page reload asks the fab for
its `hardRefresh`, the one implementation, via `web-tools:hard-refresh`. The
registry's authored content (lists, surfaces, the private config) and its
captured records (sessions, mailbox, proposals) are named at the foot of the
view and deliberately have no rows: neither is derived, so neither has an age to
report or a crawl to run.
