# Sessions

### Sessions

**Sessions** (`?view=sessions`) is every recorded Claude Code session, newest
first. Branches answers what is in flight; this answers what a stretch of work
was about, how long it ran, what it fought, and which files it opened. Each row
carries the day and the record's short id (its own filename, so what is on screen
is what you type at `search.py --show`), the branches it was sitting on, the
opening ask, and a count row: user turns, tool calls, failures, distinct files,
and output tokens. The rail goes amber where the session hit failures and stays
muted otherwise, deliberately not green-for-clean, since a clean session is the
normal case and a page of green rails says nothing.

**Each count in that row opens a card**, the same panel the branch row's counts
open, with a third kind of body: label and number, biggest first. This row is the
branch row's twin and it had the branch row's old defect, which is why it got the
same answer. Four glyph-and-number pairs stated their *unit* only in a `title`,
and the breakdown behind each number had no other route at all, so on a phone the
strip was four bare digits. Turns splits into user turns and assistant messages;
tool calls into the per-tool histogram, which also owns the failure count, since
the amber failures pair is a subset of those calls rather than a fifth axis;
files into the busiest paths; and the token total into output, input, and the two
cache halves, with output leading because cache reads run two orders of magnitude
larger and measure the harness rather than the work.

**These cards cost nothing.** Where the branch row's cards fetch a compare, every
number here is already in the session record the pane is rendering, so the card
is complete in its first frame and no read can sharpen it. `rowCardSummary`
answers for this kind first and returns the stored count, which is also what
keeps the head honest: 62 files opened over a list of the two busiest is the
right reading, and a head that shrank to the list's length would be the mistake
the branch cards had to be taught not to make.

Two marks in that row are **dimmed twins**: a files glyph and a Claude star,
shown greyed when the record *could not say* rather than when there was nothing
to report. Each now carries a `&mdash;` beside it, the same dash this component
uses everywhere for "unknown", because a grey icon alone is indistinguishable
from a zero. Which of the two causes applies (a pre-schema-3 record, or a session
that never committed) is still only in the title, and that is the honest
remainder rather than a claim to have finished.

The sessions crawl reports the same way Branches does, off the same channel:
while it runs, the pane's age pill is joined by `Reading records · 18 of 120
records` over a determinate bar above the list. It is the lighter of the two
crawls (a tree read, then up to 120 record blobs six at a time, against a branch
scan per repo), but a cold pass is still tens of seconds, and it had a spinner
and one word.

Two axes, the same shape as Branches. **Scope** is time (`Week`, `Month`, `All`)
plus **Snagged**, which is not a time window at all: it is every session that hit
a failing tool call, however old, and it is the cross-session recurrence question
a corpus can count and a person cannot. **Repo** chips narrow it further, off the
scoped list, and lapse back to All when the scope stops holding that repo.

Below the list, **File attention** is the cross-session rollup: per path, how
many **distinct** sessions opened it. Distinct sessions is the number that
resists one session's habits, since one session editing a file forty times says
the session was busy while ten sessions opening it says the file is load-bearing.
It carries its own honesty note, and that note is load-bearing too: the counts
come from four file tools (`Read`, `Edit`, `Write`, `NotebookEdit`) and nothing
else, so a file read through a shell command leaves no trace, subagent traffic is
excluded upstream, and a doc injected at session start reads **zero** while being
among the most-read files in the estate. Without that stated, the ranking says
the opposite of the truth on exactly the docs that matter most.

### Sessions cache (`state/sessions.json`)

The third derived cache, and the odd one: its source is not another repo's
config but the registry's own **captured** layer, the per-session records the
Stop hook publishes (`web-tools-private/sessions/README.md`). It exists because
that layer cannot be read directly. The store is 4.6 MB across 40 records and
grows about six a day, and one record runs to half a megabyte. Measured on the
first live crawl (2026-08-05, 42 records) the whole cache is 135 KB, about 1 KB a
row: smaller than the largest single record, 34x smaller than the store, and a
full record is fetched only when a row is opened.

The crawl is genuinely incremental where the other two are not. A published
record is addressed by a git blob sha, so one recursive trees call names every
record and its sha, and `stalePaths` re-reads only those whose sha moved. In
steady state that is the day's handful plus the live session's own record, which
is republished on every Stop and so is always stale by design, with no special
case for "the current one". `refreshSessionsCache` runs it on a ~15m per-browser
throttle (lighter than the activity crawl, being a tree read and a few blobs) and
commits only when the folded rows materially changed. This crawl never needed the
activity crawl's watermark gate: being incremental by blob sha, a pass over a
store where nothing moved is one tree read and no blob reads at all.

The fold's scope is the **full** listing, never the batch it read: a record the
per-crawl cap deferred keeps its row, and only a record genuinely gone from the
store loses one. That is the same distinction `buildCache` draws in the activity
cache, for the same reason, and it matters more here because the source is
unregenerable.

A sha is not the only way a row goes stale, and the second way has no natural
tell. A published record is frozen, so a row built by an older summarizer would
keep its blob sha forever and never be re-read: add a field and it stays empty
for the whole back catalogue. Each row therefore carries the summarizer's
version (`v`, `ROW_V` in the lib), and `stalePaths` treats a version behind as
stale exactly like a sha that moved. One pass after a summarizer change re-reads
the store and heals it.

**Two rollups ride the cache, and the split is not tidiness.** `attention` folds
each row's `files`, which is that session's busiest eight, and answers "what is
the estate working on." `docAttention` folds `docFiles`, the row's **complete**
`docs/` slice, and answers "who opened this document," which the first cannot:
a doc opened once in a session that touched forty files is exactly the reading
being counted and exactly what a top-eight discards, and a registry row would
have said zero with nothing on screen to suggest otherwise. Uncapped is
affordable because the set is closed and small (43 files in this repo's `docs/`,
a handful per session). `fileAttention(rows, cap, field)` computes both, so the
two numbers cannot come to mean different things.
