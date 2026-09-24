# Branches

**Branches** (`?view=activity`, called Open until the scope chips arrived) is
**every** branch of the estate in one cross-repo list, freshest first, narrowed
by two axes: **scope** and **repo**.

**Scope** picks which branches to show, and the chips carry their counts off the
full list, so the row doubles as a running count of the estate's branches. Four scopes read
the scan's `group` values; **Abandoned** reads the PR index instead, which is
why it is a chip rather than a fifth group:

| Scope | Shows | For |
| --- | --- | --- |
| **Open** (default) | an open PR, or `stranded` | work in flight |
| **Recent** | `active` | what was touched lately, unjudged |
| **Stranded** | `stranded` | content that exists nowhere on the default branch |
| **Landed** | `landed` | the cleanup pass: content already on the default branch |
| **Abandoned** | a PR closed unmerged | work decided against, still in the list |
| **All** | everything scanned | the whole list |

**Abandoned is the scope the content scan could not have.** Its verdict is
landed-or-not, and abandoned work is landed nowhere, so a closed-unmerged branch
sat among the stranded looking exactly like work still waiting to be finished.
The two answers are opposite: stranded asks to be rescued, abandoned asks to be
deleted. It is appended to the chip row rather than slotted beside Stranded,
where it reads better: the row scrolls sideways on a phone, so a chip inserted
mid-row pushes Landed and All off the screen and moves every position a reader
had learned. Like Open, it ignores the window, since a branch abandoned in May
is as abandoned as one abandoned yesterday.

Open is not "recent", which is why it is its own scope rather than a date sort:
a branch merged via a merge commit is an ancestor of the default, so it holds
nothing ahead and would stage to nothing, yet its commit date still reads
recent. Gating on open-PR-or-stranded drops the flood of merged-but-undeleted
session branches.

**Landed is the scope that had no home before.** The crawl always scanned and
stored it (`state/activity.json` holds every branch it reached, classified, with
the content counts), but this view hard-filtered it away in one line, so the
per-repo **branch review** was the only place a landed branch appeared, one repo
at a time. Exposing `group` as a control is what turns this into the estate's
one branch list; see "The branch review" for what stays repo-scoped (the live
uncapped scan, a repo outside the estate, the in-app compare).

Each row is **highlighted by PR state** (a colored left rail plus faint tint)
and carries a **caption-style link cluster**. The state is what became of the
branch, in six answers rather than two: green for a ready open PR, amber for a
draft, blue for one that **merged**, red for one **closed unmerged**, and muted
for a branch never proposed at all. The sixth is the honest one, `PR ?`: the
crawl's PR index reaches back only so far (below), and a branch older than that
gets no claim either way.

Until 2026-08-15 the row read the open-PR list alone, so "no PR" meant "no OPEN
PR" and every merged branch, which is most of the Recent window since branches
are not deleted here, was reported as though it had never been proposed. Two
readings of the same branch disagreed inside one app: the row said no PR while
the detail takeover, which reads `state=all` per branch, showed the merged one.
The list now reads a per-repo index of the same shape (`gh.branchPulls`), so the
answer costs one call per repo instead of one per branch. The `#`-number links
whichever PR the row is about, merged included, and its mark carries the state,
with the word beside it where the width allows and a `+N` when a head has had
several PRs over its life. `New pull request` in the row menu is gated on the
absence of an **open** PR, so a merged branch that kept going can still open one.

**The action line is two columns, not one wrapping row**, and that is what keeps
the arrows out of trouble. They used to be the last item in a wrapping flex with
`ml-auto`, so the moment anything ahead of them overflowed (the route chips, on
the one repo that has them) they dropped to a line of their own and sat there
right-aligned against nothing: a reader loses a row's shape when its rightmost
fact moves. The left box wraps within itself and the right box never shrinks, so
the **arrows hold the right edge of the first line at every width**.

That also settles the chips without a breakpoint. They stay inline on a desktop,
where the left box has room to spare and the alternative was more of the empty
space this layout already has too much of, and they fall to a second line on a
phone, where they do not. One rule, two behaviours.

**Inside the left box the order runs GitHub, session, files, Stage, then the
chips, and that order is load-bearing.** The three middle controls are the row's
own and sit to the LEFT of the chips: with the session mark after them, the one
repo that has chips carried it halfway across the row while every other row
carried it at the left, and a mark a reader scans down a column for cannot move
with a neighbour's width. The session slot is **reserved rather than collapsed**
for the same reason, so a branch with no resolvable session costs one glyph of
empty space instead of pulling the two controls after it out of column.

The GitHub button is **the mark alone**. The word "GitHub" beside a GitHub logo
said nothing the logo had not and cost about fifty pixels on the row where pixels
are scarce. The caret stays, since that is what says "menu" rather than "link",
and the title carries the sentence.

**Files** is the route the row was missing. The branch name opens the detail
too, but on the Guide where there is one, so "show me what changed" cost a tap,
a read, and a second tap; this is that destination on its own glyph, the one the
detail's file deck already wears. It carries **two numbers, and the same two on
every row**: how many files this branch changed, and how many of them are new.
Both are free, from the compare the crawl already runs for each open PR's
ahead/behind pair, and from the scan's own compare where it reached the
branch: every file in either response carries a status and a line count, and
`BranchStatus.fileStats` reads them. A row with stranded content adds one more
thing, the **missing** count in amber, which opens the pane already filtered to
those files.

Each count opens a **card**: one for new files, one for changed, one for missing,
and one for each of the ahead/behind arrows. The card is the reason the row can
afford to show so few numbers. It is a real
panel rather than a `title` attribute, which is what a title cannot be: one
string, in the browser's own type, at the browser's own delay, with nothing in
it a reader can open. Three bands:

1. **The head:** the count and the `+/-` line total, both describing *this
   class* rather than the branch. The crawl's stored count answers first and the
   listed files answer once they land, so the two numbers always come from one
   source.
2. **The shape**, and it needs no call at all: how many of each extension and
   each top-level folder, capped at six and biggest first. `BranchStatus.fileStats`
   builds it during the crawl and it rides in the cache, so the card is useful in
   its first frame. An extensionless file reports `(none)` and a repo-root file
   reports `(root)`, named rather than dropped, since a branch that only touches
   root config is a real shape. A dotfile is extensionless by this reading, which
   keeps `.gitignore` out of the histogram as a bar of one.
3. **The files**, from the compare, fetched when the card opens and swapped in
   underneath, each carrying its own `+/-`. The folder is muted and the filename
   is not, so a truncation eats the half that matters least. **A row opens its
   own diff in place**, because the compare embeds the unified patch beside the
   file list: the card is already holding every diff it can show, and expanding
   one asks nobody for anything. The patch renders in the same tinting the
   file-review card uses, capped at 400 lines, since the pre-build's own diff is
   three lines of a quarter megabyte each and would freeze the panel drawing
   them. A small out-arrow keeps the route to the file on GitHub.

**The missing card is the odd one, and it is the one that needs no fetch.**
`missing` is the scan's verdict about paths rather than a status in a diff, so
its list comes from the crawl's own `missingPaths` and is complete the moment the
card opens; the diff, when it lands, only adds line counts and a patch to the
rows it recognises, and a path it does not name keeps its row and claims nothing.
Its digest is built client-side from the same `BranchStatus.fileKind`, so the
three histograms cannot disagree about what an extension is. It also carries one
line of prose saying what the word means, since the other two classes name
themselves and this one is a verdict: a card listing files under a bare word
nobody defined is the tooltip problem again in a nicer box.

It leans on `BranchBrief`'s own sixty-second memo rather than caching anything of
its own, which is what keeps the read affordable: hovering one row twice is a
single call, and opening the branch detail afterwards is none, since the takeover
reads through the same memo. That is also why **paths are not stored in the crawl
cache**. A path list per branch across the estate is hundreds of kilobytes read
on every Activity load, spent to save a call on the rows a reader actually opens.
A no-merge-base branch has no compare at all, so its card shows the shape and
says plainly that there is no diff to list.

Hovering opens a card on a fine pointer, tapping opens it everywhere, and its
footer opens the branch view's Files pane. Removals and renames stay out of the
row and out of the cards, in the pairs' plain hover text, since a scanned list
carries two classes and a card is opened one at a time.

**A card's read is written back into the row it was opened from.** The compare
it fetches is seconds old against a crawl that may be hours old, so its numbers
are simply better: a branch has usually gained files and commits since. Without
the write-back, a card opens over a row saying 62 changed and reports 71 itself,
which is two readings of one branch a tap apart, disagreeing. `absorbCompare`
patches the counts, the shape digest and the ahead/behind pair into whichever
cache entries the row derives from, and the branches pill grows a small dot
naming how many rows have outrun the age it states.

Two limits, and both are deliberate. It is **in memory only**: the crawl owns
`state/activity.json`, and writing the private registry from a hover would put a
commit-shaped cost on a gesture meant to be cheap, so this lasts the visit and
the next crawl makes it durable. And it does **not touch the verdict**, since
landed / differs / missing is a function of two trees that a compare cannot
supply; refreshing the counts around it and leaving it alone is the honest
half-update rather than a stale verdict quietly restamped as fresh.

**This deliberately overlaps the branch detail**, and the overlap runs in the
card's favour on cost: the detail fetches a file's content per card opened, while
this one fetched every patch at once without meaning to, as part of a compare it
needed anyway. What the detail still owns is the full dossier per file (the
new-file and base-file tabs, the annotations) and the registry grouping. If the
overlap keeps growing, the honest next move is to put the dossier in the card
rather than to keep two readings of one branch.

**The palette says one thing each.** Neutral is changed, green is added, amber
is stranded. Green used to tint the whole control when the scan found nothing
missing, a signal the absent missing count and the Landed chip were already
carrying twice over; freeing it is what lets a file-plus glyph read as a
different thing from a files glyph at eighteen pixels. Spacing carries the
grouping: four pixels binds a glyph to its number, eight separates the two pairs
inside the control, twelve separates controls, without which a row with two new
files and two missing ones read as `2 2`.

The landed **ratio** rode here until 2026-08-18, so a scanned row read
`28/80 landed 11 missing *` while an unscanned row read nothing at all: four
mono elements on the busy rows, none on the quiet ones, and no column a reader
could scan down. A ratio is a verdict and this is a route, so the verdict moved
to where there is room to state it whole (the hover, and the Files pane's own
strip, which names all three classes) and the row kept the counts every row can
carry plus the one flag worth raising unasked. A no-merge-base row keeps its
numbers rather than blanking, since the mark beside them already says that every
number on that row spans more than the branch. A cache written before the
breakdown existed shows its total as one number and claims no split, rather than
printing a split of zeroes.

**That mark reads `no merge base`, and until 2026-08-19 it was an asterisk.**
One amber character, with its entire meaning in a `title` attribute, saying
something a reader cannot afford to miss: that every number beside it is
measuring something wider than the branch. A tooltip never appears on a phone,
so on a phone it said nothing at all. Thirteen characters is a real cost on this
row and it is the right trade, since the alternative was a caveat nobody could
reach. The general rule it is a case of is now in
[the house style](../skills/daisy-alpine/SKILL.md), and [`scripts/stranded-titles.py`](../scripts/stranded-titles.py)
counts the remaining cases.

**Stage** sends the files this branch changed to the Stage (one `compare` call,
removed paths skipped), appended and deduped onto any working stage at
`ref=branch`, so an item reads the branch's version and the Stage's Diff tab
compares it back. It was the row's original name-tap action, then a row in the
GitHub menu, and a control of its own since 2026-08-18: it acts on this app's
own Stage, so a menu whose every other row opens `github.com` was the wrong
place for it. Its spinner rides in the button that was pressed rather than in a
separate label at the head of the line.

The **Session** that authored the branch is the `claude.ai/code/session_…` link
read from the branch's own commit trailer, with the PR body's footer as
fallback; a per-repo **Branches** drill-down sits at the row's right (whole-tree
browse lives there).

**The arrows are commits, and both of their cards are free.** They state how
many commits the branch has that the default branch does not (green, muted at
zero, which flags a branch with nothing left to stage) and how many the default
has that the branch does not. Neither is lines and neither is files, a thing they
said only in a `title` attribute, which never appears on a phone, so the pair read
as two bare numbers a reader could reasonably take for either.

The **ahead** list is the compare's own `commits`, which is exactly the set and
which the file cards already fetch. The **behind** list is the newest commits on
the default branch, which the crawl has always fetched once per repo for its own
moved-or-not gate (`recentCommits`) and never read for anything else: main's side
was sitting in the cache unread the whole time. That is why both arrows became
cards at once rather than one now and one when someone paid for it.

Behind is answered twice, and sharpens: before the compare lands it takes the
newest `behind_by` of the cached log, which is exact while the default branch is
linear and costs nothing; once the compare is in hand it takes everything newer
than `merge_base_commit`, which is exact regardless. A branch that forked before
the cached window gets a card that says so and keeps its count, rather than an
empty list under a number. `ACTIVITY_RECENT_COMMITS` rose from 12 to 40 on
2026-08-19 for exactly this: the estate routinely runs branches 20 to 40 behind,
and the wider page is the same call and about 5 KB per repo.

Each row's right edge states the branch's **lifespan**, first commit then latest,
as `15 days → 2 hours`, which answers "how long has this been open" beside "when
was it last touched". Neither costs a call: the crawl's compare already lists a
branch's unique commits oldest-first, so its start is `commits[0]`
(`BranchStatus.firstCommitDate`) off a response the scan holds anyway. The
start is dropped when it rounds to the same label as the tip (a same-day branch,
where `2h → 2h` is noise) and when it cannot be known honestly: a branch with no
merge base has no unique-commit list, and a compare past GitHub's 250-commit cap
reports a total larger than the list it returns, so the oldest entry present is
not the first. Those rows show the tip age alone.

Where the scan reached a branch it also measures a **content verdict**: of the
paths the branch uniquely touched, how many hold content the default branch has
now. It is what makes a Landed row actionable rather than a claim, and it costs
nothing, since the crawl stored it. The row shows the verdict's one urgent half,
the missing count; the whole of it is one hover away and lives fully in the
branch view's Files pane.

**Three classes, and the third one had no name.** A touched path is **landed**
(those bytes are on the default branch, at this path or moved anywhere in the
tree, or the branch deleted the path and so stranded nothing), **differs** (the
default branch holds the path with other bytes, which is either unlanded edits
or the default's own drift since, and separating those costs a history walk the
scan does not make), or **missing** (neither the path nor the bytes, the only
class that says deleting the branch would lose something). The three sum to the
touched total. Until 2026-08-18 the row showed `28/80` beside `11 missing` and
named nothing else, so a reader could only read the pair as a failed
subtraction. `landed` now rides the ratio, since a bare `28/80` does not say
which direction is good, and the full partition is in the hover.

**Both halves are routes into the files.** Tapping the count opens the branch
detail on its **Files** pane; tapping `11 missing` opens it filtered to those
eleven, as diffs a reader can actually read. What they replaced was inert text
whose tooltip pasted up to twelve missing paths under a sentence describing the
paths that were *present*, so the wrong list sat under the wrong clause and
nothing in it could be opened. The counts and the filter live on in the pane
itself, which re-measures them rather than only rendering what it was handed;
see [branch-overlay.md](branch-overlay.md).

**Repo chips** below the scope chips narrow the list to one repo, `All` first
and a count on each. The row's own **repo chip menu** contributes **Only
`<repo>`** (and **All repos** once filtered), the same filter reached from the
row you are reading rather than from the chip row above. It names the repo
rather than saying "this repo", since the menu is read after the pointer has
left the row it belongs to. Only repos that have open rows get a chip, since the estate is larger than
the set with work in flight and a row of zeroes says nothing, and the row hides
below two of them. It scrolls sideways rather than wrapping, which is what keeps
a second row of controls from pushing the first branch off a phone screen. The
filter narrows what renders, not what is counted: the tab badge and the `All`
chip keep the cross-repo total. A filter naming a repo that goes quiet on a
refresh lapses back to `All` on its own, rather than leaving an empty list with
no lit chip to explain it.

The row's **GitHub menu** replaced a Tree and a Compare link. Those were one tap
each and a menu is two, which pays only because the menu carries destinations
that had no route at all: the PR's **Files changed** and **Checks** tabs, the
branch's **Commits**, and **New pull request** for a row with no PR, plus a copy
action for the branch name. It also gives the row's action
line back the width the pair was spending. A **Copy compare link** row sat
beside that one until 2026-07-30 and was cut: `Compare to <default>` opens the
page the URL names, and the browser copies it from there. It shares the sidebar repo menu's
geometry (`shell.anchorMenu` / `menuStyle`: fixed, aligned to the trigger's own
edge, flipped above near the viewport bottom), its row spec (`.wt-menu-row`,
flat, an out-arrow on anything leaving the app), and its hover behavior.

**Every row in it opens `github.com`, with one exception, and the rule is what
put Stage on the action line.** The `#`-number, the session mark, the files
route and the Stage all stay outside: none is GitHub navigation. `Copy branch
name` is the exception that earns its place, since a branch name is long,
hyphenated, and typed into git commands and `#gh=` addresses with no address bar
to lift it from, which makes it the ADDRESS of what the other rows open rather
than an action somewhere else.

Each row opens with its **repo chip**, the repo's own declared icon plus its
short name. It is a control, not a label: it opens the repo's whole grouped
menu in the sidebar's panel, so the branch's destinations and its repo's are
one gesture apart and the control is learned once. The icon is the mark the
repo declares for its estate card, so a row is identifiable before its name is
read.

It reads the registry's **activity cache**
(`state/activity.json`, below) in one GET, so the whole estate renders without a
per-repo API fanout: the branch join to its PR is `pr.head === branch`, against
two stored lists (the open PRs, which carry the guide body, and `branchPRs`, the
lean any-state index that says what became of each head), and the session link
rides the cached PR, so nothing is fetched per visit. `prReach` travels with the
index: the read is capped at 100 PRs per repo, and the oldest `updated_at` it
reached is what lets a row distinguish "no PR" from "past what this can see". Landed and
stranded older branches are the per-repo branch review's job, not this "what's in
flight" read. The Repos view borrows the same cache for a **freshness rollup** on
each card (branch count, stranded count, abandoned count, open-PR count, with the
branch count a one-tap route into the branch review and the abandoned count a
one-tap route into the Abandoned scope). That last badge is computed in the view
from the same rows the pane's chip counts, not counted in the crawl over the full
branch list: one word, one derivation, or the card would report a larger number
than the chip and make a reader distrust both. The crawl is forced from the State view through the
shell (`refreshActivity`); a normal visit kicks it throttled. The internal view
key stays `activity` (and `?view=activity`), so existing links resolve.

That forced crawl runs for tens of seconds across the whole estate, so it
**reports itself**. While it runs, the header's as-of readout becomes
`Refreshing activity · 4 of 11 repos` with the repos currently in flight named
after it (the pool runs two at once, so it is a list), over a determinate bar
whose only input is repos finished over repos total. Nothing finer is counted
and no in-flight fraction is estimated: per-repo cost varies by an order of
magnitude, and a sub-counter ticking several times a second is the churn this
replaces. The numbers come off the shell's **progress channel**, a slot per cache
key, which all three crawls write and every reader draws: this pane, the
Sessions pane, and the State view's rows. Pressing Refresh in any of them lights
the others, and nothing holds a second copy of the reading. The verb and the
unit ride in the slot rather than being inferred by whoever draws it, since only
the crawl knows whether it is counting repos or session records.

**One pass, and it was two.** The refresh shipped split, a quick pass (commits,
PRs, branch dates) so the list landed in seconds and a scan true-up behind it.
The call log priced that: `deep` gates the **scan alone**, so the second pass
re-fetched every cheap read the first had just made, and a refresh of 11 repos
spent 66 calls, a fifth of the run, asking for the same commits and the same two
PR lists twice inside a minute. The seconds it bought back were real and did not
cover that, so the Refresh button and the arrival kick each run one crawl,
scan included. The quick shape stays supported because one caller still wants
it: the State view's arrival kick warms this cache for rows that need the repo
list and the open PRs and no branch verdicts at all. Retired 2026-08-17; the run record still
carries `pass: 'quick' | 'scan'`, since those two differ by an order of
magnitude in cost and averaging them would mean nothing.

**Every cache read that feeds the commit is FRESH** (`gh.get(path, GH.FRESH)`),
and the split refresh is what forced it. GitHub answers an API read with
`Cache-Control: private, max-age=60`, so the scan pass, running seconds behind
the quick pass, was handed the very copy the quick pass had just replaced: it
folded onto a stale base and then failed `409 does not match …` on the dead sha
it had been given along with it. The 409 was the guardrail rather than the bug,
since a matching sha would have meant one pass silently reverting the other. The
same rule now covers the config and sessions crawls, which read a cache and
write it back the same way. Measured 2026-08-16; the first bite of this is on
`GH.FRESH` in lib/gh-api.js.

**FRESH was not enough, because the layer under it is the API's own lag.** The
409 came back on the next run with the browser cache out of the picture, and the
crawl's own call log named it: six PUTs to `state/activity.json` in one refresh,
`422, 409, 409, 409`, each retry carrying a sha a fresh read had just supplied.
GitHub's contents API is read-after-write **eventual**, so a read seconds after a
commit can be answered by a replica that has not seen it, and no cache header
reaches that. The answer is not a longer retry but a better source: this page
knows what it wrote and what sha the write returned, so
[`lib/kits/last-write.js`](https://github.com/mehrlander/web-tools/blob/main/lib/kits/last-write.js)
notes each committed document and `readForFold` reconciles the next read against
it, newest **document stamp** winning rather than the clock. The sha then rides
into `save(path, doc, msg, { sha })` and no read is consulted at all. The retry
behind it got more patient too (six attempts, backoff to seconds), and its
recovery read got cheaper: it buys the sha from the parent directory's listing,
about a kilobyte, rather than re-reading a 370 KB cache to look at forty
characters.

The crawl **commits only when something materially changed**, which
used to make a productive refresh and a no-op refresh end identically, so the
run closes with a toast, `Activity refreshed · 3 repos changed` or `No activity
changes · 11 repos checked`, and names any repo the crawl failed on (previously
a `console.warn` and nothing else). The count comes from
`RepoActivityCache.changedRepos`, which `cacheChanged` is defined in terms of,
so the number reported and the gate that skipped the commit cannot disagree.

**A verdict is carried when neither of its inputs moved.** A branch's
landed-or-stranded call is a function of exactly two things, its own tip and the
default branch, so a pass where neither moved is re-deriving an answer it
already has. The crawl now hands the scan the previous rows and the default
tip it judged against (`scan.mainSha`), and `BranchStatus.needsScan` decides
per branch: the branch moved, or main moved, or there is no stored row, or the
stored row is an error. When nothing needs scanning the default tree is not
read either, so an untouched repo costs nothing. The same pair gates the open-PR
compares, since `main...head` cannot move while the PR's `updated_at` and main's
tip both hold.

One case trades exactness for cost on purpose, and it is the one the log made
impossible to ignore. web-tools' history was rewritten, so every branch older
than the rewrite **404s** on compare and falls into the fallback: a 50-commit
read plus a second compare, three calls to re-derive a verdict about dead
history, times thirty branches, on every crawl. Those rows carry `noBase`, and a
`noBase` row is now carried while its tip holds even when main moved. Measured
2026-08-17: 98 of one refresh's 145 calls were that one repo's dead branches.

**And the reading that is still open.** The run after the carry rule landed came
back with **86 of its 183 calls at 404**, spread across every repo and mostly on
`compare`, including one repo (wa-bills) paying 93 calls of the run to re-derive
branches that answer 404 every time. Two of those calls are the same shape and
mean opposite things: GitHub answers `compare` with 404 both when there is **no
common ancestor** (a real verdict about two histories, which the scan handles)
and when a ref or a permission is missing (a fault). The log could not tell them
apart, because the traffic ledger never touches a response body. It does now, by
one narrow route: `gh.req` already parses the error message, so it hands it to
the ledger through `window.__noteApiError`, and a failed row in the call log
carries `msg` and the rate-limit remaining at that moment. The next run says
which kind of 404 it hit; until then the shape of the failure is recorded and
its meaning is not.

Beside it, the same cost lesson one level down: an **errored scan row is
carried** like a `noBase` one, and a bounded few (`ACTIVITY_ERROR_RETRY`, three
per repo per crawl) are retried, so a transient failure heals within a few
crawls while a permanent one stops costing the estate anything.

**What the call log bought, in its first three readings.** The crawl's own log is
the instrument for its cost, and the first run it recorded (2026-08-17, 373
calls, 58s) named three things prose had not. Its top row was 79 GraphQL posts
for 75s of request time, three per repo where two were `branchesDated` and
`branchSessions` walking the same refs connection with the same page size: they
are one call now (`gh.branchesDatedSessions`), since the crawl has always wanted
both. Its heaviest row by bytes was eleven reads of `state/activity.json` for
7.2 MB, of which the conflict recovery's share is gone (it buys the sha from a
listing) and the views' share is gone too: the crawl hands its document along on
the `web-tools:activity-refreshed` event, so a listener that used to re-read
370 KB now reads nothing and a detail-less event still falls back to reading.
Its third reading was the scan itself: with the split gone, 69 compares and 30
commit reads stood out as one repo re-deriving verdicts nobody had asked it to
re-derive, which is the carry rule above. And a run that died on a phone at
`Load failed` after 300-odd successful calls bought one retry for a **dropped
connection**, reads only, in both `GH.req` and `gh.graphql`: a rejected fetch is the network rather than GitHub, an HTTP error
is not retried because the answer will not change in 600ms, and a write is never
retried because it may have landed.

The cache is what makes this affordable. The branch review costs ~2 + 2N calls to
scan N branches, so scanning every repo live on a dashboard is a flood.
Instead `refreshActivityCache` crawls each estate repo on a ~30m per-browser
throttle and stores the capped landed/stranded scan plus cheap summary signals; the branch review, the
estate cards, and this view all render from the stored result. The per-repo
branch review is **cache-first** too: with a token it renders Landed / Stranded
from `state/activity.json` and marks the header `cached`, running the live fanout
only on an explicit Refresh or where the cache has no coverage. Same scan math
either way (`lib/kits/branch-status.js` `scanBranchLive`, shared by the view and the
crawl). Source-of-truth rule as ever: the cache is derived and may be briefly
stale; Refresh re-scans live.

**Two gates decide what a pass actually pays for**, and they answer different
questions. The **scan gate** has been there since the crawl was written: a repo
whose `pushed_at` has not moved since its last `scannedAt` cannot have changed a
branch verdict, so its stored rows carry forward and the tree reads go where
something moved. The **watermark gate** is newer and covers the rest of the
pass. Measured 2026-08-21, a run over ten repos spent 231 calls, of which 168
were the scan the first gate already rations; the remaining ~62 were four calls
per repo fired unconditionally, so a completely quiet estate still paid them.

A repo is **quiet** when both its `pushed_at` and its **PR watermark**
(`gh.prWatermark`, one row of the same `pulls?state=all&sort=updated` list
`branchPulls` reads a hundred of) match what the last successful crawl recorded.
A quiet repo is skipped whole and carries its stored entry forward through the
same `buildCache` path a failed repo takes. A quiet estate therefore costs one
account listing plus one watermark per repo, about a dozen calls, which is what
let the throttle come down from twelve hours to thirty minutes: the floor fell,
not the ceiling. A repo that moved still pays its summary, and one that was
pushed still pays its scan.

**Both halves are required, and the second is the one to keep.** `pushed_at`
cannot see a pull request opening, merging or closing, and this cache stores
exactly that in `openPRs`, `branchPRs` and `prReach`. Gating on pushes alone
would freeze every branch row's PR verdict until something happened to push,
and nothing on screen would look wrong. The watermark over-reports instead
(`updated_at` moves on a comment or a review), which costs a crawl that then
finds nothing material and skips its commit. That is the direction a gate must
err in.

The watermarks live in `localStorage`, not in the cache, because the committed
file has no safe place for them: riding the material hash would restamp and
recommit a 700 KB file whenever anyone commented on a PR, and staying out of it
would mean a crawl never persists what it just learned, so the next pass sees
the same movement and never converges. A forced pass ignores the gate entirely,
since Refresh has to mean "go and look". `tools/test/activity-watermark-gate.test.mjs`
holds each of those clauses.
