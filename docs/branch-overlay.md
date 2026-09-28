# The branch overlay: preview a cross-repo change before it merges

How the Web Tools app shows a branch's version of the estate: the overlay that
substitutes a branch's files while you browse, the branch-detail takeover, the
sidebar's second ref, the ref bar's in-place actions, and dropping a file on a
branch. The app that hosts it is documented in [APP.md](APP.md), and the branch page itself
(`pages/branch.html`) is the shareable single-branch address the surfacing
conventions call the branch anchor.

```
app/?overlay=<branch>
```

Previews the estate **as if `<branch>` were merged wherever it exists**. The
join it rides is a platform fact the conventions already name: a session uses
one branch name across every repository it touches (a workstream), so a
same-named branch across repos is a session's signature, not a coincidence.
The overlay applies the branch per repo where it exists and falls back to the
default branch where it does not; existence is asked of GitHub (one branch
probe per cached repo, once per session), never assumed.

Why this needs to exist at all: the toss machinery pins two of the three
things a preview depends on, and the third is the one cross-repo changes live
in. `#gh=` pins the subject file and its same-repo dependencies; `?use=` pins
the lib the shell loads; neither reaches the **runtime data reads** the
running app composes itself ("read that other repo's manifest"). Worse, the
read that feeds the sidebar is not even a read of the other repo: it is a
read of the **config cache** (`state/configs.json`), a derived artifact baked
from main-side crawls, which no view-time ref redirection can change. The
overlay closes both gaps for the piece that matters:

- **Manifest splice.** Each overlaid repo's `.web-tools.json` is fetched live
  at the branch and laid over its cached entry before anything derives from
  the cache (membership, groups, icons, `projects` rows, app views). One GET
  per overlaid repo; a branch without a manifest keeps the cached one.
- **Browse at the branch.** Opening an overlaid repo (its row, a project row)
  opens it at the branch ref, so the landing, pins, files, and the repo's own
  live-read config all preview the branch. The crumb trail's ref chip shows
  the off-default ref as usual.
- **A preview says it is one.** The Repos header carries a warning-tinted
  branch chip (tooltip: which repos the branch applied to), and each overlaid
  row gets a matching glyph.
- **Writes are classified, not banned.** The split that matters is whether the
  overlay touches a write's **inputs** or its **target**, and refreshing the
  derived caches touches neither: the crawls build their own clients pinned at
  main, so a Refresh under overlay reads and commits exactly what a normal
  session would, and the buttons work inside a preview the way intuition says
  they should (held by test: the crawl never reads at the overlay branch).
  This shipped guarded at first, on the instinct that a preview must not
  commit derived state; the guard defended nothing and turned Refresh into a
  silent no-op, which is the worse failure. The genuinely hazardous class is
  writes the overlay *does* touch, and it has one known member: the
  contents-API save path commits to the default branch, so editing an
  overlaid repo's config would read branch state into the editor and write it
  to main. Entering the Config view under overlay warns about exactly that
  mix. Note the residual honesty gap the crawls keep: Activity ages update on
  Refresh but describe main, per the general limit below.

Because the parameter rides the query and the toss params shim delivers a
subject's `?query`, a coordinated preview works **before any of it merges**,
through main's deployed toss renderer:

```
…/toss-render.html#gh=owner/web-tools@<branch>:app/index.html?overlay=<branch>
```

The outer `@<branch>` pins the shell (the code half); `?overlay=` pins the
data half. After the shell change merges, the deployed form
`app/?overlay=<branch>` does the same for data-only branches.

The honest limits, stated rather than implied: the overlay re-derives only
the per-repo **manifests**; other main-derived artifacts (the activity and
sessions caches, tracker boards, generated catalogs) are not overlaid and read
main. And an
overlay link is only as durable as the branch it names: once the branch
merges and is deleted, every probe misses and the link degrades to a plain
main view, which is the correct end state for a preview.

## Branch detail: the takeover

The branch takeover is documented in
[forms/branch.md](forms/branch.md#branch-detail-the-takeover).

## The sidebar owns the second ref too

The drawer answered "which version am I looking at". From 2026-08-14 it answers
"against what", and the file surface answers neither. That is the whole
division: **the sidebar owns the comparison, and a card showing a file does
what it is told.**

The card's four source tabs were the argument for it. Diff, Patch, New and Base
are four renderings of one fixed pair, and on a reading surface the question is
not which of four renderings but against what: the branch's merge base, the
default branch, another branch entirely. That is a ref, and a ref is the one
thing the drawer already knows how to pick. So on a `read` host the strip
collapses to the file and one **Compare** pane, and the pair arrives from
outside.

Two channels, one per direction, and neither side holds a reference to the
other. Up: the deck's subject announcement gained `base` and `baseName`, which
is what makes the compare bar appear at all; a page rendered at a ref has no
second version in play and gets no bar. Down: `web-tools:compare-ref` carries
`{repo, ref, base, baseName, off}`, with `window.__compareRef` holding the last
one for a slide that mounts after the choice was made. `off` is a field rather
than a null payload, because null already means "nobody has published
anything", and a deck that has just opened must not read the previous deck's
silence as an instruction.

Three things the move costs, all of them facts that were only ever true of the
announced base:

- **The API patch.** The compare endpoint's patch text describes the merge
  base and nothing else, so moving the base drops it: the diff is computed from
  the two files instead, and the copy button on that pane goes with the patch
  it used to hand over.
- **The status.** `added`, `removed` and `renamed` are the same kind of claim,
  so once the base moves the card stops trusting them and derives status from
  what the two fetches found. A file "added" on this branch may well exist on
  the branch now being compared against.
- **The rename mapping.** `previousPath` is how the announced base saw the
  file, so on any other ref it is a guess. It is still the best guess going, so
  it is tried first and the current path is the fallback, at one extra call on
  a renamed file only.

Only the base side refetches. The new side did not move, and on a deck slide it
is already on screen: refetching it would blank the pane the reader is looking
at to arrive back at the same bytes.

The comparison is a property of the branch pair, so it survives a swipe and
does not survive the branch changing under it, and leaving the deck takes it
with it rather than leaving a pair on the global naming a branch nothing on
screen is showing. A card also declines a pair addressed to another repo or
another ref: the channel is a global, and silently diffing against a ref the
reader never chose for this file is the worst failure available here.

The cross-window case is the same asymmetry as the announcement and needs the
same bridge. Inside a toss the cards are in the frame and the listening fab is
the shell's, so it publishes on a window the cards are not in; the deck relays
shell to frame, one direction, for as long as it is open.

`tools/render/scenarios/sidebar-compare.mjs` runs the round trip in a browser,
which is the only place the two halves meet: jsdom holds the publish
(`fab-toss.test.mjs`) and the adoption (`file-review-card.test.mjs`)
separately. `SHOT=menu` and `SHOT=card` point the same scenario at the picker
and at the slide.

## And the ref bar acts in place too

The bar above it still went to the renderer: outside a toss it navigates to
`toss-render`, inside one it re-addresses through `__tossNavigate`. Over a deck
both are wrong. The reader is thirty files into a changeset, and answering
"show me this at main" by leaving for a single-file renderer throws away the
list, their place in it, and the way back.

A deck can do better, because it already owns the slide: change the ref,
rebuild the two or three slides that are mounted, and the reader has not moved.
So the deck publishes `__deckNavigate({repo, ref, path})` on the windows it
announces to, borrowed and returned with the subject, and `goTarget` tries it
before it navigates. **The handle's answer is authoritative:** false means the
deck genuinely cannot show that file (another repo, or a path not in this
changeset), and then it is a real navigation after all. That is what keeps the
path picker working, which reaches `goTarget` by the same route.

Moving the ref voids the same class of fact the compare bar's move does, one
step further out: `patch`, `status`, `additions`, `deletions` and
`previousPath` are all things the compare said about **the branch**, so a slide
rebuilt at another ref is passed none of them and derives what it needs from
the two fetches. The crumb changes too, and it has to: its whole job is to say
where the reader is, so the ref takes the head slot from the parent deck's
title, and a caller-supplied context that was itself naming the ref gives way
rather than leaving both refs in one line saying neither is current.

That closes the three steps this section has been tracking since the deck
first announced.

## Drop a file on a branch

The Activity view's branch menu carries **Drop a file here**: GitHub's
new-file form opened on that branch with the filename prefilled
(`github.com/<repo>/new/<branch>?filename=…`), defaulting into the repo's
declared `inbox` (else `dump/`), date-stamped and still editable in the form.
It exists for the phone flow: paste long content straight onto a session's
branch without routing it through a chat context, with no placeholder commit
and no cleanup. In the frame vocabulary above this is a deliberately
*ambient* write with matching frames: the form both shows and targets the
named branch. The chat-side twin is the `drop-link` skill, which mints the
same URL on request.

Session drops are intake, not cargo: the session that receives one promotes
or consumes it, and wrap-up leaves the intake folder empty, so a merge
carries no drop residue. Gitignore cannot do that job (it governs untracked
files, and a drop is a commit); the convention is the mechanism, and it is
the same one home's `chron/dump` already runs ("trends toward empty"). A
repo that instead wants transient bulk kept off main entirely declares a
branch box (`"inbox": "@drops:inbox"`), per Inbox and outbox below.
