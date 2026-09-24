// alpineComponents/branch-brief.js — the branch page's view.
//
// Renders what kits/branch-brief.js assembles: a derived layer that reloads
// from the API every visit, and an optional authored layer laid over it. The
// model does the thinking; this file is markup and three pieces of formatting.
//
// Mounted by pages/branch.html. The per-file diff cards are fileReview
// (alpineComponents/file-review.js), the same dossier pages/review.html uses,
// so a file reads identically in both places.
//
// Two hosts, one component. pages/branch.html mounts it as a page; show-repo's
// branch deck mounts one per slide, directly, in the shell's own Alpine. There
// was an iframe between them until 2026-08-13, which cost a second boot of the
// whole library and forced a hand-rolled swipe over a single live surface. A
// host passes `framed: true` to say it supplies the identity chrome, `warm` to
// name the neighbours worth reading ahead, `onMeta` to be told what only a
// finished read knows (the PR number for a branch whose PR has merged),
// `onSubject` to be told which of the presented documents is showing, and
// `facts` to lend what it already knows about the branch. A framed view reports
// its subject rather than announcing it, since only the host knows whether this
// slide is the one the reader is on.
//
// `facts` exists because of the deferral, and it also SWITCHES it. The compare
// is the expensive read, and only the file list and the no-PR account need it,
// so a host that lends the head's numbers gets a view that renders the guide on
// the pulls call alone and offers the diff as a row the reader taps.
// show-repo's crawl has ahead, behind, the first date and the sessions on the
// row the reader tapped, so there the deferral costs the head nothing. A cold
// pages/branch.html has no such row, and there the compare is the head's only
// source, so it is read up front as before. The rule in one line: defer when
// something else can answer the head, never otherwise.
// Registration is defensive rather than a bare `alpine:init` listener: this
// component arrives at the end of a gh.load chain, which can finish after
// Alpine has already started, and a missed event leaves the page rendering
// "branchBrief is not defined". Same idiom lib/alpine-bundle.js uses for the
// same race.
(function () {
  // Content registries already read, keyed repo@ref, value the parsed rows or
  // null for "this repo declares none". Module scope rather than component
  // state because the swiper reuses one mount across every branch it steps
  // through, and the answer is a property of the ref, not of the visit. A null
  // is cached as deliberately as a hit: the no-registry answer is a 404, and
  // paying for it once per branch was most of what this cache saves.
  //
  // Same expiry as the brief cache, and for the same reason: this page claims
  // its facts are read at open time, and the only version of a cache that
  // keeps that claim honest is one that describes a single reading pass. The
  // registry is not fetched by kits/content-registry.js because that kit is
  // pure by contract (the caller knows the repo and ref, so the caller
  // fetches), which is why the memo lives here beside its one caller.
  const REGISTRIES = new Map();   // 'repo@ref' -> { at, rows }
  const registryTtl = () => window.BranchBrief?.TTL_MS || 60000;

  // The app's route manifest, memoized the same way and for the same reason:
  // the swiper reuses one mount across every branch it steps through, and which
  // routes exist is a property of the ref rather than of the visit.
  //
  // Keyed by ref because a branch may ADD a route or move a route's files, and
  // the question this page asks is what the branch does, not what main does.
  // Only the hub declares routes, so every other repo is a null nobody fetches.
  const MANIFESTS = new Map();    // ref -> promise of the manifest, or null
  const ROUTES_REPO = 'mehrlander/web-tools';
  const ROUTES_CSV = 'docs/app-routes.csv';
  const ROUTES_VOCAB = 'docs/vocabularies.csv';

  const register = function () {
  Alpine.data('branchBrief', function (opts) {
    const o = opts || {};

    return {
      description: 'One branch as a page: derived state from the API, plus an optional authored layer',

      repo: o.repo || '', branch: o.branch || '', base: o.base || '',
      brief: null, loading: true,
      // Three fields, not one string, because a failure here has three things
      // to say and they are read at different depths: what went wrong, what to
      // do about it, and what actually threw. The last one used to BE the
      // message, which is how a reader got
      // "undefined is not an object (evaluating 'window.BranchBrief.fetchBrief')"
      // presented as though GitHub had refused the branch (reported from a
      // phone, 2026-08-07).
      error: '', errorHint: '', errorRaw: '',
      // The repo's content registry (data/design/content.csv, parsed rows) at
      // the branch ref, or null where none is declared. It is what lets the
      // file list group by creation mode instead of listing dist/ output and
      // authored work as equals. groupState holds the reader's own open/closed
      // overrides per group; the default comes from the grouping (mechanical
      // starts collapsed).
      registry: null, groupState: {},
      // The app's routes, at this branch's ref, or null where the branch is not
      // in the repo that declares them. Feeds the Look row above the sections.
      routeManifest: null,
      // ── The content verdict ──────────────────────────────────────────────
      // For each file this branch changed, is that content on the base branch
      // now? BranchStatus answers it three ways (landed / differs / missing),
      // and this is where the answer becomes something a reader can act on: the
      // file list counts it, filters by it, and marks the missing ones.
      //
      // The estate's activity crawl already computes the same verdict for its
      // row chip, so a host that has one LENDS it (o.scan) on the same
      // provisional contract as `facts`: it makes the counts right in the first
      // frame, and the measurement below replaces it. A cold pages/branch.html
      // has no host to lend one and measures from scratch, which is the point
      // of measuring here at all rather than only rendering what was passed in.
      scan: null,               // measured: { states: Map } plus countStates fields
      scanLoading: false, scanError: '',
      // The file list a NO-MERGE-BASE branch has instead of a compare, read
      // through BranchStatus.recentHistory when the scan asks for one. Kept so
      // the empty state can tell "nothing was found" from "nothing was read".
      fallbackFiles: [],
      // Which verdict caveat is open, '' for none. A caveat about the numbers
      // above it cannot live in a title: it is exactly the thing a phone
      // reader must be able to reach, so it opens a line instead.
      verdictNote: '',
      fileState: o.fileState || '',   // '' (all) | landed | differs | missing
      inbox: null,   // the repo's declared inbox dir, from the shell cache; aims the deposit
      // Whether a HOST is supplying the identity chrome. A branch mounted as a
      // slide of show-repo's branch deck is: the deck's header carries the
      // repo, the PR and the position, so this view drops all three and keeps
      // only the branch name, which is the one thing a truncating header
      // cannot show in full. Standalone (pages/branch.html) it carries its own.
      framed: !!o.framed,
      // The subject channel, opened on first announcement rather than at mount:
      // a visit to a branch with nothing reviewable never opens one. `_gone`
      // is the destroy flag the async open re-reads, since the load is a trip
      // and the reader can leave during it.
      _chan: null, _chanLoad: null, _gone: false,
      // Which SECTION the address is about, '' for the whole page. It named
      // the visible tab until 2026-08-31; with both sections on one surface it
      // is an intent rather than a state, and it does two things: 'files' asks
      // for the compare a host would otherwise defer, and either value scrolls
      // its section into view. Everything else is '' and starts at the top.
      pane: '',
      // The guide: which PR is on display, and its rendered body.
      guideIdx: 0, guideHtml: '', guideTargets: [], guideFor: null,

      template: `
        <!-- The layout, and the one thing it decides: WHERE the scrollbar is.
             There are three answers, not two.

             FRAMED, this is a dialog, and a dialog scrolls inside itself: the
             identity, the facts strip and the heading row hold their place
             while ONE region under them scrolls, carrying both sections. A
             deck slide is phone-shaped whatever the screen is, so it keeps the
             single scroller.

             STANDALONE OUTSIDE roomy, it is a page and scrolls as one, because
             a page that pins its own header costs a phone its URL-bar collapse
             and splitting an 844px screen between two panes leaves neither
             readable. The roomy variant is declared once, in pages/branch.html,
             and its two floors are measured there.

             STANDALONE INSIDE roomy, it is locked to the viewport and the two
             sections scroll separately. Nothing is lost there (no URL bar to
             collapse) and something is gained: measured 2026-09-04 at
             1440x900, the guide began at y=575 of a 983px document, so reading
             it scrolled the branch name, the facts strip, the Look row and
             every control off the top. The head is 185px and the masthead 49,
             which leaves 618 for the sections.

             The three shapes are one rule read at three sizes, so the classes
             below are the only place any of it is decided. -->
        <!-- gap-2, and a shorter top. The Files heading row is the heading of
             the card directly under it, so 16px between them read as a gap
             between two unrelated things while costing a phone two file rows.
             The heading keeps its own py-2, which is the air it actually needs.
             Measured 2026-09-05 at 390x844: the bands above the first file row
             held 72px of pure padding.
             (No backticks in this markup: it is a JS template literal.) -->
        <div class="mx-auto w-full flex flex-col px-4 pt-2 pb-2 gap-0.5"
             :class="framed ? 'h-full min-h-0 pb-0' : 'roomy:h-full roomy:min-h-0'">

          <!-- The head: mounted through a load, not swapped out under one.
               It used to sit inside x-if="brief && !loading" with everything
               else, so every step tore the whole page down to a spinner and
               built it again, which is the flash a reader saw between
               branches. Nothing here needs the compare: the branch, the repo
               and the base arrive with the message that asked for them, so the
               head can be correct immediately and only the numbers wait. -->
          <!-- gap-2, not gap-4. Three bands separated by 16px each read as three
               floating pieces with air between them rather than as one head,
               which is what the reader saw as "white space where nothing is
               happening" (2026-09-05). The 16px that matters is the one below,
               between the head and the files: that separation is real.
               (No backticks in this markup: it is a JS template literal.) -->
          <!-- gap-1, the control gap: the identity block and the Look row are
               two strips of ONE section, and gap-2 is what one section takes
               against the next. Same rule the strip's pager follows against its
               strip, and the file list against its heading row. -->
          <div class="shrink-0 flex flex-col gap-0.5">
            <!-- Identity, and how much of it depends on who is asking.
                 The state chip is the one thing to read first: a branch that
                 is landed or on an unrelated line cannot be in flight,
                 whatever its name or date suggests.

                 Who writes the branch NAME moved once, and the rule is that
                 exactly one surface does. It lived here while the host was an
                 iframe with a header of its own, because both carried it and
                 both truncated, so one screen showed two stubs of one name.
                 Now the host is a swipe-deck whose header IS the name (with
                 the repo, the PR and the position beside it), so framed this
                 drops to a single quiet line: the state, which is the one
                 thing to read first, and what it is measured against.
                 Standalone the page still owns all of it. -->
            <div class="flex items-start justify-between gap-2 min-w-0">
              <div class="flex flex-col gap-0.5 min-w-0">
                <div class="flex items-center gap-2 min-w-0" x-show="!framed">
                  <!-- Shown on the state, not on the brief: a deferred compare
                       leaves it unknown, and an empty badge is a claim of its
                       own. A host that knows the ahead count supplies it and the
                       badge is right from the first frame. -->
                  <span class="badge shrink-0" x-show="brief?.state" :class="stateClass" x-text="brief?.state"></span>
                  <span class="font-mono text-base font-medium truncate min-w-0"
                        :title="branch" x-text="branch"></span>
                </div>
                <div class="flex items-center gap-2 min-w-0 text-xs opacity-55 font-mono">
                  <span class="badge badge-sm shrink-0" x-show="framed && brief?.state"
                        :class="stateClass" x-text="brief?.state"></span>
                  <span x-show="framed" class="truncate min-w-0" :title="branch" x-text="branch"></span>
                  <span class="shrink-0"><span x-show="!framed" x-text="repo + ' '"></span>vs <span x-text="base"></span></span>
                  <span class="shrink-0 ml-auto pl-2" :title="codeRefTitle">running <span x-text="codeRef"></span></span>
                </div>
              </div>
              <!-- Branch action toolbar lifted above containers -->
              <div class="flex items-center gap-1 shrink-0 ml-auto" x-show="!loading">
                <button x-show="!loading && !!(brief?.pending || deckFiles.length)"
                        @click="openFileDeck(0)" :disabled="deckOpening"
                        class="btn btn-square btn-sm btn-ghost text-primary"
                        :title="brief?.pending ? 'Read files one at a time'
                                               : 'Read ' + plural(deckFiles.length, 'file') + ' one at a time'">
                  <span x-show="deckOpening" class="loading loading-spinner loading-xs"></span>
                  <i x-show="!deckOpening" class="ph ph-cards-three text-lg max-sm:text-xl"></i></button>
                <template x-for="(s, i) in (brief?.sessions || [])" :key="s">
                  <a :href="s" target="_blank" class="btn btn-sm btn-square btn-ghost"
                     :title="sessionTitle(i)"
                     x-html="window.claudeMark.svg({ cls: 'w-4 h-4 max-sm:w-5 max-sm:h-5 shrink-0' })"></a>
                </template>
                <details class="dropdown dropdown-end" x-ref="ghMenu">
                  <summary class="btn btn-sm btn-ghost gap-1 cursor-pointer" title="This branch on GitHub">
                    <i class="ph ph-github-logo text-lg max-sm:text-xl"></i>
                    <i class="ph ph-caret-down text-[10px] opacity-50"></i>
                  </summary>
                  <ul class="dropdown-content menu menu-sm z-20 mt-1 w-60 rounded-box border border-base-200 bg-base-100 p-1 shadow-lg">
                    <template x-for="l in ghRows" :key="l.label">
                      <li><a :href="l.url" target="_blank" rel="noopener" @click="$refs.ghMenu.open = false"
                             class="gap-2 flex-nowrap">
                        <i class="ph shrink-0" :class="l.icon"></i>
                        <span class="shrink-0" x-text="l.label"></span>
                        <span class="grow"></span>
                        <span class="font-mono text-xs opacity-40 shrink-0" x-text="l.hint"></span></a></li>
                    </template>
                  </ul>
                </details>
                <a :href="stageDepositUrl" class="btn btn-sm btn-square btn-ghost"
                   title="Add a file to this branch: opens the stage with the destination set">
                  <i class="ph ph-plus text-lg max-sm:text-xl"></i></a>
              </div>
            </div>

            <!-- ── Look: the branch, running ──────────────────────────────
                 Above both sections, because it is not a reading of the branch but
                 the branch itself, and because a constant position is most of
                 what it is for: the render link was reachable before this (a
                 dimmed icon at the end of a file row, a menu row two taps in)
                 and was still asked for in chat every time, which is what a
                 thing being findable-in-principle looks like.

                 Routes first, pages second, and the order is the finding rather
                 than a preference. Most work here is a component under lib/,
                 where nothing renders itself and the thing to open is a view of
                 the deployed app running the branch's library. A changed page
                 is the smaller case and gets its own toss beside it.

                 Both sets are joins already drawn elsewhere: routesTouched is
                 the estate's own branch-row chips, and renderTarget is the
                 table behind every other render link in the app. This row
                 picks neither rule; it supplies the ref they were missing. -->
            <!-- ONE LINE THAT SCROLLS, not a row that wraps. Measured at
                 390x844 the four chips a real branch carries (two routes, two
                 pages) plus the signpost come to 461px in a 358px row, and no
                 arrangement fits them: dropping the icon reaches 439, dropping
                 .html from both page labels reaches 385. So the row wrapped,
                 and the wrap put ONE chip on a second line, spending 30px to
                 show a single label with 230px of white beside it.

                 The trade is honest and worth naming: a chip past the right
                 edge is reached by swiping rather than seen. The partial chip
                 at the edge is the affordance, and it is the treatment
                 session.html's own tab row already uses for the same reason.
                 (No backticks in this markup: it is a JS template literal.) -->
            <div x-show="!loading && hasLook"
                 class="flex items-center gap-1.5 flex-nowrap min-w-0
                        overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <i class="ph ph-signpost text-base text-base-content/40 shrink-0"
                 data-note="What this branch changes, as something to open" data-note-bare></i>

              <!-- THE FIGURES RIDE THIS ROW, since 2026-09-07. They were the
                   identity block's third line, which cost 21px plus a gap for a
                   strip about 190px wide beside a chip strip that scrolls: two
                   bands where the content of one and a half fits. They lead
                   here because they are read rather than tapped, so they hold
                   the left edge and the chips scroll past them.
                   flex-wrap is gone with the move: this row does not wrap, it
                   scrolls, and a wrapping child inside a nowrap scroller is the
                   one shape that would put the strip back to two lines. -->
              <span class="shrink-0 flex items-baseline gap-x-4 text-sm">
                  <span class="whitespace-nowrap">
                    <span class="opacity-55">ahead</span>
                    <span class="font-mono font-medium text-success" x-text="brief?.ahead ?? '?'"></span>
                    <span class="opacity-55 ml-1">behind</span>
                    <span class="font-mono font-medium text-warning" x-text="brief?.behind ?? '?'"></span>
                  </span>
                  <span class="whitespace-nowrap font-mono text-xs tabular-nums" x-show="!!brief?.files.length">
                    <span class="text-success" x-text="'+' + fileTotals.additions"></span>
                    <span class="text-error ml-1" x-text="'-' + fileTotals.deletions"></span>
                  </span>
                  <span class="whitespace-nowrap text-xs opacity-45"
                        x-show="brief && !brief.complete">file list capped</span>
              </span>

              <!-- The deferral, stated. In show-repo the compare waits for a
                   tap and this row cannot know its routes until it lands, so it
                   asks for the same read the Files tab would make rather than
                   rendering as absent, which a reader correctly reads as "this
                   branch changes no view". -->
              <button x-show="brief?.pending && !pageChips.length" @click="ensureCompare()"
                      class="btn btn-xs btn-ghost gap-1 normal-case"
                      data-note="Read the diff to find the views this branch changes" data-note-bare>
                <span x-show="filesLoading" class="loading loading-spinner loading-xs"></span>
                <span>Find views</span></button>

              <template x-for="c in (routeChips?.on || [])" :key="c.key">
                <a :href="c.url" target="_blank" rel="noopener" :data-note="c.title" data-note-bare
                   class="shrink-0 rounded-full px-2.5 py-0.5 text-sm font-medium
                          bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                   x-text="c.label"></a>
              </template>
              <!-- A NOTE: the same chip the estate's branch rows carry, and the
                   same reasoning. Its sentence is the whole of what it says, and
                   a title carrying it reaches neither a phone nor a screenshot. -->
              <span x-show="!!routeChips?.nearCount" :data-note="routeChips?.nearTitle" data-note-bare
                    class="shrink-0 rounded-full px-2.5 py-0.5 text-sm
                           bg-base-200/70 text-base-content/40"
                    x-text="'+' + routeChips?.nearCount + ' shared'"></span>
              <span x-show="pageChips.length"
                    class="text-sm shrink-0 select-none leading-none opacity-80"
                    data-note="Pages this branch changed, rendered via toss"
                    data-note-bare>🥏</span>
              <template x-for="t in pageChips" :key="t.addr">
                <a :href="t.url" target="_blank" rel="noopener" :data-note="t.title" data-note-bare
                   class="shrink-0 rounded-full px-2.5 py-0.5 text-sm font-mono
                          bg-base-200/70 hover:bg-base-200 transition-colors"
                   x-text="t.label"></a>
              </template>

              <!-- The one caveat that makes a working link lie. ?use= fetches
                   the pre-build, so a branch that changed lib without rebuilding
                   serves the old bundle under a link that resolves and renders. -->
              <span x-show="bundleStale" class="shrink-0 text-xs text-warning/80"
                    data-note="?use= fetches the app's pre-build (dist/app.js), which this branch did not rebuild: run npm run build:app (and build:lib) and commit, or these links serve the old bundle"
                    data-note-bare>
                bundle not rebuilt</span>
            </div>

          </div>

          <!-- One child, not three. A daisyUI alert lays its children out in a
               grid column, so three siblings become three columns and the copy
               renders as three narrow stripes. -->
          <div x-show="error" class="alert alert-warning shrink-0">
            <div class="flex flex-col gap-1 min-w-0">
              <div class="font-medium" x-text="error"></div>
              <div x-show="errorHint" class="text-sm opacity-80" x-text="errorHint"></div>
              <div x-show="errorRaw" class="font-mono text-xs opacity-50 break-all" x-text="errorRaw"></div>
            </div>
          </div>

          <!-- THE SECTIONS, IN READING ORDER: what changed, then why, then the
               documents themselves. The order has moved twice in two days and
               each move was the reader's, so the reasoning is kept rather than
               overwritten. Files led first, on the reading that the list is what
               cannot be read anywhere else in one place. The guide led on
               2026-09-06, because presenting the readable files meant the page
               opened on a document with no statement of what the branch was
               for. It leads again from 2026-09-07: the list is SHUT, so it costs
               a heading row rather than a screen, and what a reader wants first
               from a branch is what it touched.

               The heading row is the first thing in this box, which is what
               makes its sticky pin cover the whole scroll rather than part of
               it.

               ONE SCROLLER, at every size. Locked (roomy, standalone) this used
               to scroll nothing itself and hand each of two sections a
               scrollbar of its own, so that a long file list could not push the
               guide off the screen. The guide is clipped and scrolls in place
               now, which answers that without a pane, and what is left is one
               region that scrolls, the same shape a phone has, with the heading
               row pinned inside it.
               (No backticks in this markup: it is a JS template literal.) -->
          <div class="flex flex-col gap-0.5"
               :class="framed ? 'flex-1 min-h-0'
                              : 'roomy:flex-1 roomy:min-h-0'">
            <div x-show="loading" class="flex justify-center py-16">
              <span class="loading loading-spinner loading-lg text-primary"></span>
            </div>

            <!-- TWO PARTS, GUIDE OVER FILES (2026-09-23). The guide is the
                 judgment layer and the files are the evidence, so the guide
                 leads and the files follow in one swiper below it. The FAB
                 sidebar also shows the guide, but a reader on this page should
                 not have to open a drawer to learn why the branch exists.

                 The swiper reads like kits/swipe-deck.js: one sequence,
                 reviewable files first, a mark at the top left that drops the
                 whole list, and n/m with arrows at the right. Cards mount only
                 when the swiper nears them, so a 25-file branch fetches the
                 diffs a reader reaches rather than all of them on load.
                 (No backticks in this markup: it is a JS template literal.) -->

            <!-- ══ Guide ═════════════════════════════════════════════════════ -->
            <div data-guide-section x-show="!loading"
                 class="rounded-lg border border-base-300 bg-base-100 overflow-hidden flex flex-col min-h-0"
                 :class="framed ? 'flex-1 min-h-0 basis-1/2 max-h-[50%]'
                                : 'max-h-[60vh] roomy:max-h-[50%] roomy:min-h-0 roomy:flex-1 roomy:basis-1/2'">
              <div x-ref="guide" class="flex-1 min-h-0 overflow-y-auto">
                <template x-if="brief?.prs?.length">
                  <div class="p-4 flex flex-col gap-3">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-xs uppercase tracking-wide opacity-60">Guide</span>
                      <a :href="prUrl" target="_blank"
                         class="font-mono text-sm font-semibold hover:text-primary"
                         x-text="'#' + guidePr.number"></a>
                      <span class="badge badge-sm" :class="prStateClass" x-text="prStateLabel"></span>
                      <div class="grow"></div>
                      <div x-show="(brief?.prs.length || 0) > 1" class="join">
                        <button class="btn btn-xs join-item" @click="stepGuide(1)"
                                :disabled="guideIdx >= brief.prs.length - 1"
                                title="Older PR for this branch"><i class="ph ph-caret-left"></i></button>
                        <span class="btn btn-xs join-item no-animation pointer-events-none font-mono"
                              x-text="(guideIdx + 1) + '/' + (brief?.prs.length || 0)"></span>
                        <button class="btn btn-xs join-item" @click="stepGuide(-1)"
                                :disabled="guideIdx <= 0"
                                title="Newer PR for this branch"><i class="ph ph-caret-right"></i></button>
                      </div>
                    </div>
                    <div class="text-sm font-semibold leading-snug" x-text="guidePr.title"></div>
                    <div x-show="guideTargets.length > 0" class="flex flex-wrap gap-1">
                      <template x-for="t in guideTargets" :key="t.addr">
                        <a :href="t.url" target="_blank" rel="noopener" :title="t.title"
                           class="btn btn-xs btn-ghost gap-1 font-mono normal-case">
                          <i class="ph" :class="t.icon"></i><span x-text="t.label"></span>
                        </a>
                      </template>
                    </div>
                    <div x-show="guideHtml" x-html="guideHtml" :class="guideBodyClass"></div>
                    <div x-show="!guideHtml && guidePr.body" class="text-sm opacity-50">Rendering…</div>
                    <div x-show="!guidePr.body" class="text-sm opacity-50 italic">This PR has an empty body.</div>
                  </div>
                </template>

                <template x-if="brief?.authored">
                  <div class="p-4 flex flex-col gap-3 border-t border-base-300 first:border-t-0">
                    <div x-show="brief.authored.intent" class="text-sm whitespace-pre-line" x-text="brief.authored.intent"></div>
                    <div x-show="brief.authored.open.length">
                      <div class="text-xs uppercase tracking-wide opacity-60 mb-1">Open</div>
                      <ul class="list-disc list-inside text-sm flex flex-col gap-0.5">
                        <template x-for="t in brief.authored.open" :key="t"><li x-text="t"></li></template>
                      </ul>
                    </div>
                    <div x-show="brief.authored.omitted.length">
                      <div class="text-xs uppercase tracking-wide opacity-60 mb-1">Left out</div>
                      <ul class="list-disc list-inside text-sm opacity-70 flex flex-col gap-0.5">
                        <template x-for="t in brief.authored.omitted" :key="t"><li x-text="t"></li></template>
                      </ul>
                    </div>
                    <div x-show="brief.authored.notes" class="text-sm opacity-80 whitespace-pre-line"
                         x-text="brief.authored.notes"></div>
                  </div>
                </template>

                <!-- No PR and no envelope: the commits are the account. -->
                <template x-if="!hasGuide">
                  <div class="p-4 flex flex-col gap-2">
                    <div class="flex items-baseline gap-2 flex-wrap">
                      <span class="text-xs uppercase tracking-wide opacity-60">What this branch did</span>
                      <span class="text-xs opacity-45">no pull request describes it</span>
                    </div>
                    <div x-show="!!brief?.pending || filesLoading" class="text-sm opacity-50 italic">Reading the commits…</div>
                    <div x-show="!brief?.pending && !brief?.commits?.length" class="text-sm opacity-50 italic">
                      No commits on this branch that are not on <span class="font-mono" x-text="base"></span>.
                    </div>
                    <div x-show="!!brief?.commits?.length" class="flex flex-col gap-1">
                      <template x-for="c in (brief?.commits || []).slice(0, 12)" :key="c.sha">
                        <div class="flex items-baseline gap-2 text-sm border-b border-base-200 last:border-b-0 py-1">
                          <a :href="'https://github.com/' + brief.repo + '/commit/' + c.sha" target="_blank"
                             class="font-mono text-xs opacity-50 hover:text-primary shrink-0"
                             x-text="c.sha.slice(0, 7)"></a>
                          <span class="truncate" x-text="c.subject"></span>
                        </div>
                      </template>
                      <div x-show="(brief?.commitCount || 0) > 12" class="text-xs opacity-45 pt-1"
                           x-text="'and ' + ((brief?.commitCount || 0) - 12) + ' more'"></div>
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <!-- ══ Files: one swiper ═══════════════════════════════════════ -->
            <div data-swipe-section x-show="!loading"
                 @pointerenter="swipeHovered = true" @pointerleave="swipeHovered = false"
                 @pointerdown="swipeHovered = true"
                 class="relative mt-1 rounded-lg border border-base-300 bg-base-100 flex flex-col min-h-0"
                 :class="framed ? 'flex-1 min-h-0 basis-1/2 max-h-[50%]'
                                : 'h-[80vh] roomy:h-auto roomy:flex-1 roomy:min-h-0 roomy:basis-1/2 roomy:max-h-[50%]'">
              <!-- ONE HEADER ROW, as the full deck has. The slide's card is
                   hosted: it draws neither its collapse row nor its control row,
                   and this row carries both, reading viewModes and ghLinks off
                   the card in view. A slide has nothing to collapse into, so the
                   caret is gone rather than moved.
                   (No backticks in this markup: it is a JS template literal.) -->
              <div data-swipe-header class="relative flex items-center gap-1 max-sm:gap-0.5 shrink-0 pl-1 pr-1 py-1 bg-base-200 border-b border-base-300 rounded-t-lg">
                <button type="button" data-file-list-btn class="btn btn-sm btn-ghost btn-square shrink-0"
                        @click="listOpen = !listOpen" :disabled="!swipeFiles.length"
                        :title="listOpen ? 'Back to the file' : 'Files'" :aria-expanded="String(listOpen)">
                  <i class="ph text-lg" :class="listOpen ? 'ph-caret-up' : 'ph-list'"></i></button>
                <span x-show="!swipeFiles[at]" class="text-xs uppercase tracking-wide opacity-60">Files</span>
                <!-- The name over its scope: two short lines inside the row's
                     32px, so the counts cost no height and no width. The scope is
                     +added -removed against the comparison on screen, then the
                     file's length. -->
                <div x-show="!!swipeFiles[at]" data-slide-name class="min-w-0 shrink flex flex-col leading-tight"
                     :title="swipeFiles[at]?.path">
                  <span class="font-mono text-sm min-w-0 flex items-baseline">
                    <span x-show="(swipeFiles[at]?.path || '').includes('/')" class="opacity-40 truncate shrink-[9999]"
                          x-text="(swipeFiles[at]?.path || '').split('/').slice(0, -1).join('/') + '/'"></span>
                    <span class="min-w-0 truncate shrink" x-text="(swipeFiles[at]?.path || '').split('/').pop()"></span>
                  </span>
                  <span data-change-stats class="font-mono text-[11px] tabular-nums whitespace-nowrap truncate"
                        :title="card?.changeStats ? (card.changeStats.added == null
                                  ? card.changeStats.lines + ' lines'
                                  : card.changeStats.added + ' lines added, ' + card.changeStats.removed
                                    + ' removed, of ' + card.changeStats.lines) : ''">
                    <!-- The status letter yields on a phone: the counts already
                         say it (a new file is all +), and the row needs the width. -->
                    <span class="font-semibold max-sm:hidden" :class="card?.statusClass" x-text="card?.statusTag || ''"></span>
                    <template x-if="card?.changeStats?.added != null">
                      <span><span class="text-success" x-text="'+' + card.changeStats.added"></span>
                        <span class="text-error" x-text="'\u2212' + card.changeStats.removed"></span></span>
                    </template>
                    <span x-show="!!card?.changeStats" class="opacity-50"
                          x-text="(card?.changeStats?.added != null ? '\u00b7 ' : '') + (card?.changeStats?.lines ?? 0).toLocaleString() + ' ln'"></span>
                  </span>
                </div>
                <details x-show="!!card?.ghLinks?.length" class="dropdown dropdown-start shrink-0" x-ref="slideGh">
                  <summary class="btn btn-ghost btn-sm gap-0.5 px-1.5 max-sm:px-1 cursor-pointer" title="This file on GitHub">
                    <i class="ph ph-github-logo text-lg"></i>
                    <i class="ph ph-caret-down text-[10px] opacity-50 max-sm:hidden"></i>
                  </summary>
                  <ul class="dropdown-content menu menu-sm z-30 mt-1 w-56 rounded-box border border-base-300 bg-base-100 p-1 shadow-lg">
                    <template x-for="l in (card?.ghLinks || [])" :key="l.label">
                      <li><a :href="l.url" target="_blank" rel="noopener" @click="$refs.slideGh.open = false"
                             class="gap-2 flex-nowrap">
                        <i class="ph shrink-0" :class="l.icon"></i>
                        <span class="shrink-0" x-text="l.label"></span>
                        <span class="grow"></span>
                        <span class="font-mono text-xs opacity-40 shrink-0" x-text="l.hint"></span></a></li>
                    </template>
                  </ul>
                </details>
                <div class="grow"></div>
                <!-- WHAT THE SLIDE IS COMPARED AGAINST. Branch changes (the
                     merge base, as GitHub's PR diff) by default, the base branch
                     as it is today, or nothing. A pick goes out on the shared
                     compare channel, so every slide moves together. -->
                <!-- For any text file, not only one that differs from its base:
                     a file identical to the base (an edit reverted, a squash
                     read against main today) is when an earlier version or
                     another base is the thing to reach for. -->
                <details x-show="!!card?.read && !['image', 'pdf', 'binary'].includes(card?.kind)"
                         @toggle="$el.open && card?.loadVersions()"
                         data-compare-menu class="dropdown dropdown-end shrink-0 max-sm:static" x-ref="slideCmp">
                  <summary class="btn btn-ghost btn-sm gap-1 px-1.5 max-sm:px-1 cursor-pointer" title="Compare against">
                    <i class="ph text-lg" :class="card?.compareOff ? 'ph-git-diff opacity-40' : 'ph-git-diff'"></i>
                    <span class="max-sm:hidden text-xs font-normal"
                          x-text="[...(card?.compareChoices || []), ...(card?.versionChoices || [])].find(c => c.on)?.label || ''"></span>
                    <i class="ph ph-caret-down text-[10px] opacity-50 max-sm:hidden"></i>
                  </summary>
                  <!-- On a phone the summary sits mid-row, and a panel hung from
                       it runs off the left edge; static above makes the header
                       the anchor, so the panel ends at the header's right edge. -->
                  <ul class="dropdown-content menu menu-sm z-30 mt-1 w-60 rounded-box border border-base-300 bg-base-100 p-1 shadow-lg
                             max-sm:right-1 max-sm:top-full">
                    <template x-for="c in (card?.compareChoices || [])" :key="c.key">
                      <li><button type="button" :class="c.on && 'menu-active'"
                                  @click="$refs.slideCmp.open = false; card.pickCompare(c)"
                                  x-text="c.label"></button></li>
                    </template>
                    <!-- This file's versions on the branch, newest first. A pick
                         compares the file against that version, on this slide
                         only. The newest is the file as it stands. -->
                    <li x-show="!!card?.versionScope?.length" class="menu-title pt-2">This file</li>
                    <li x-show="card?.versionsLoading"><span class="opacity-50">Reading versions…</span></li>
                    <template x-for="v in (card?.versionChoices || [])" :key="v.key">
                      <li data-version-row><button type="button" :disabled="!!v.current" :title="v.title"
                                  :class="[v.on && 'menu-active', v.current && 'opacity-60']"
                                  @click="$refs.slideCmp.open = false; card.pickVersion(v)">
                        <span class="font-mono" x-text="v.label"></span>
                        <span class="grow"></span>
                        <span class="text-xs opacity-50" x-text="v.current ? 'current' : v.when"></span></button></li>
                    </template>
                  </ul>
                </details>
                <div x-show="!!card?.viewModes?.length" data-view-modes class="join shrink-0">
                  <template x-for="m in (card?.viewModes || [])" :key="m.key">
                    <!-- Side by side is two 180px columns on a phone, so it
                         goes there and the name gets the room. -->
                    <button type="button" class="btn btn-sm btn-square join-item max-sm:btn-xs max-sm:w-7"
                            :class="[m.on ? 'btn-active' : 'btn-ghost', m.key === 'split' && 'max-sm:hidden']"
                            :title="m.label" @click="card.pickView(m)">
                      <i class="ph text-base" :class="m.icon"></i></button>
                  </template>
                </div>
                <!-- Arrows on a pointer device; a phone swipes, and the row
                     needs the width for the name. n/m shows everywhere. -->
                <div x-show="swipeFiles.length > 1" data-pager class="flex items-center shrink-0">
                  <button type="button" class="btn btn-xs btn-ghost btn-square max-sm:hidden"
                          @click="go(at - 1)" :disabled="at <= 0"
                          title="Previous file"><i class="ph ph-caret-left"></i></button>
                  <span data-pager-label class="font-mono text-xs opacity-60 tabular-nums px-1" x-text="(at + 1) + '/' + swipeFiles.length"></span>
                  <button type="button" class="btn btn-xs btn-ghost btn-square max-sm:hidden"
                          @click="go(at + 1)" :disabled="at >= swipeFiles.length - 1"
                          title="Next file"><i class="ph ph-caret-right"></i></button>
                </div>
                <!-- INTO THE FULL DECK, AT THIS FILE. The masthead's deck button
                     opens at the first file; this one opens where the reader is,
                     which is why it sits on the file's own row. -->
                <button type="button" data-expand-deck x-show="!!swipeFiles[at]"
                        class="btn btn-sm btn-ghost btn-square shrink-0"
                        @click="openFileDeckAt(swipeFiles[at].path)" :disabled="deckOpening"
                        title="Open in the full deck">
                  <i class="ph ph-cards-three text-lg"></i></button>
              </div>

              <!-- The file list, dropped from the mark like the deck's contents. -->
              <div data-file-list x-show="listOpen"
                   @click.outside="if (!$event.target.closest('[data-file-list-btn]')) listOpen = false"
                   @keydown.escape.window="listOpen = false"
                   class="absolute left-1 top-11 z-20 w-80 max-w-[calc(100%-0.5rem)]
                          max-h-[min(60vh,26rem)] overflow-y-auto overscroll-contain
                          rounded-xl border border-base-300 bg-base-100 shadow-xl">
                <div x-show="!!verdict" class="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-base-200 text-xs">
                  <button type="button" @click="fileState = ''"
                          title="Every file this branch changed"
                          class="rounded-full px-2 py-0.5 font-mono tabular-nums text-[11px] transition-colors"
                          :class="fileState ? 'bg-base-200 text-base-content/60' : 'bg-base-content/70 text-base-100'">
                    <span x-text="verdict?.nUnique"></span> <span class="font-sans">all</span></button>
                  <template x-for="c in pathStateChips" :key="c.key">
                    <button type="button" @click="setFileState(c.key)"
                            :title="c.label + ': ' + c.hint"
                            class="rounded-full px-2 py-0.5 font-mono tabular-nums text-[11px] transition-colors"
                            :class="[fileState === c.key ? c.on : c.off, c.exact ? '' : 'opacity-50']">
                      <span x-text="c.n"></span> <span class="font-sans" x-text="c.label"></span></button>
                  </template>
                </div>
                <template x-for="(f, i) in swipeFiles" :key="f.path">
                  <div>
                    <div x-show="i === 0 || isReviewable(f.path) !== isReviewable(swipeFiles[i - 1].path)"
                         class="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide opacity-50"
                         x-text="isReviewable(f.path) ? 'Reviewable' : 'Changed'"></div>
                    <button type="button" data-file-row @click="go(i, true); listOpen = false"
                            class="flex w-full items-start gap-2.5 border-b border-base-200 px-3 py-2 text-left transition-colors"
                            :class="i === at ? 'bg-primary/10' : 'hover:bg-base-200/60'"
                            :aria-current="i === at ? 'true' : null">
                      <span class="mt-0.5 w-6 shrink-0 text-right font-mono text-xs tabular-nums"
                            :class="i === at ? 'text-primary' : 'text-base-content/40'" x-text="i + 1"></span>
                      <span class="min-w-0 flex-1">
                        <span class="block truncate font-mono text-sm" x-text="f.path.split('/').pop()"></span>
                        <span x-show="f.path.includes('/')" class="block truncate font-mono text-xs opacity-50"
                              x-text="f.path.split('/').slice(0, -1).join('/')"></span>
                      </span>
                      <span x-show="stateOf(f.path) === 'missing'" class="ph ph-warning-circle text-warning mt-0.5"
                            :title="'Not on ' + base"></span>
                    </button>
                  </div>
                </template>
              </div>

              <!-- The deferral, as a row rather than as an absence -->
              <div x-show="!!brief?.pending && !filesLoading" class="p-3">
                <button @click="ensureCompare()"
                        title="The diff is the expensive read, so it waits to be asked for"
                        class="w-full rounded-lg border border-dashed border-base-300 bg-base-100 px-3 py-3
                               flex items-center justify-center gap-2 text-sm text-base-content/60
                               hover:text-base-content hover:bg-base-200/50 transition-colors">
                  <i class="ph ph-git-diff text-base"></i>Read the changed files</button>
              </div>
              <div x-show="filesLoading" class="flex-1 flex items-center justify-center gap-2 p-4 text-xs opacity-40 font-mono">
                <span class="loading loading-spinner loading-xs text-primary"></span><span>reading changed files...</span>
              </div>

              <div x-show="swipeFiles.length > 0 && !filesLoading && !brief?.pending" class="flex-1 min-h-0 flex flex-col">
                <div x-ref="swipeStrip" @scroll.passive="stripScroll()"
                     class="flex-1 min-h-0 items-stretch flex gap-3 snap-x snap-mandatory
                            overflow-x-auto overflow-y-hidden overscroll-x-contain
                            [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <template x-for="(f, i) in swipeFiles" :key="f.path">
                    <div data-slide class="relative w-full shrink-0 snap-center flex flex-col min-h-0">
                      <div x-show="!fileState && stateOf(f.path) === 'missing'"
                           class="flex items-center gap-1 text-xs text-warning px-2 pt-1"
                           :title="'Neither this path nor these bytes are on ' + base + ', so this file exists only on the branch'">
                        <i class="ph ph-warning-circle"></i>missing on <span class="font-mono" x-text="base"></span></div>
                      <div x-show="fileNote(f.path)" class="text-xs opacity-70 px-2 pt-1" x-text="fileNote(f.path)"></div>
                      <div class="overflow-hidden overflow-y-auto flex-1 min-h-0 px-3 pb-3">
                        <template x-if="mounted[f.path]">
                          <div x-data="fileReview(slideCardOpts(f))"></div>
                        </template>
                      </div>
                    </div>
                  </template>
                </div>
              </div>

              <div data-swipe-placeholder x-show="swipeFiles.length === 0 && !brief?.pending && !filesLoading"
                   class="flex-1 min-h-0 flex items-center justify-center p-4">
                <span class="text-xs opacity-40 font-mono">no files changed on this branch</span>
              </div>
            </div>

          </div>
        </div>
      `,

      init() {
        this.$el.innerHTML = this.template;
        this.$nextTick(() => {
          if (this.$el.isConnected) Alpine.initTree(this.$el);
        });
        // Mount the slide in view and its neighbours; see markNear.
        this.$watch('at', () => this.markNear());
        this.$watch(() => this.swipeFiles.map(f => f.path).join('\n'), () => {
          if (this.at >= this.swipeFiles.length) this.at = Math.max(0, this.swipeFiles.length - 1);
          this.markNear();
        });
        // The note kit, for the shared-routes chip. Delegated, so a late arrival
        // still reaches rows already drawn.
        if (!window.Note && window.gh?.load) window.gh.load('kits/note.js');
        this.load();
        // The subject follows the strip. One watcher covers every way it moves,
        // since all three facts are in the key: the reader swipes, the file
        // list loads or is filtered, or the base resolves. The first call is
        // for the case the watcher cannot see, a host that lends enough for the
        // strip to be populated before anything changes.
        this.$watch('subjectKey', () => this.announceSubject());
        this.announceSubject();

        this._onKey = (e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          if (e.target && /^(INPUT|TEXTAREA|SELECT)$/i.test(e.target.tagName)) return;
          if (!this.$el?.isConnected) return;
          const rect = this.$el.getBoundingClientRect?.() || { width: 0, left: 0, right: 0 };
          if (rect.width > 0 && (rect.right <= 0 || (typeof window !== 'undefined' && rect.left >= (window.innerWidth || 10000)))) return;

          // The swiper takes the arrows while the pointer or focus is in it.
          const sec = this.$refs.swipeStrip?.closest('[data-swipe-section]');
          const active = this.swipeHovered || (sec && sec.contains(document.activeElement));
          if (!active || this.swipeFiles.length < 2) return;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          this.go(this.at + (e.key === 'ArrowRight' ? 1 : -1));
        };
        if (typeof window !== 'undefined') window.addEventListener('keydown', this._onKey, true);
      },

      // Read the neighbours the embedder named, into the kit's cache, after
      // this branch has settled. Nothing is rendered and nothing is awaited:
      // the point is only that the compare is already in flight, or already
      // answered, when the reader arrives. A failure is silent by design,
      // since it costs a warm and the real open will report it properly.
      //
      // This is what the takeover's own note ruled out for the src-swap era,
      // and the ruling still holds in the form it was made: N slides cannot be
      // N live pages. One live page reading two neighbours ahead is a
      // different proposition, and it is the same active-plus-neighbours rule
      // kits/swipe-deck.js already renders by.
      //
      // The warm follows the READER, and that is what keeps it affordable. It
      // always takes the two cheap reads, the guide and the registry, which are
      // a few KB each and are what the next slide opens on. It takes the
      // compare only when this slide has already read its own, which is to say
      // only when the reader has opened a diff and is likely to want the next
      // one: warming it unconditionally meant three copies of a
      // 1.8 MB response in flight to show three PR bodies.
      warmNeighbours() {
        const alsoCompare = !!this.brief && !this.brief.pending;
        for (const n of (o.warm || [])) {
          if (!n || !n.repo || !n.branch) continue;
          if (n.repo === this.repo && n.branch === this.branch) continue;
          try {
            const gh = new window.GH({ token: window.TOKEN, repo: n.repo, ref: n.branch });
            const at = { repo: n.repo, branch: n.branch, base: n.base || '' };
            window.BranchBrief.readGuide(gh, at).catch(() => {});
            // Both cheap reads, not just one. Warming one of the two leaves the
            // other as the step's entire wait, which is the shape the
            // measurement caught.
            this.readRegistry(n.repo, n.branch).catch(() => {});
            if (alsoCompare) window.BranchBrief.readCompare(gh, at).catch(() => {});
          } catch {}
        }
      },

      // What actually went wrong, in the reader's terms. The address is the
      // same in every case, so it leads; the second line is the only part that
      // differs, and it is the only part worth reading.
      //
      // 404 gets the longest hint on purpose. It is the failure a correct link
      // produces most often, because an owner-mode #gh= address reads through a
      // token stored in ONE browser: opened in a fresh browser, an in-app
      // sheet, or by anyone else, a private repo is indistinguishable from a
      // missing one and GitHub says 404 either way. That caveat is stated in
      // the surfacing conventions and nowhere the reader can see it, which is
      // the gap this line closes.
      fail(e) {
        const at = this.repo + '@' + this.branch;
        const raw = e?.message || String(e);
        const hint = {
          401: 'The stored GitHub token was rejected. Sign in again to refresh it.',
          403: 'GitHub refused the read: either an un-tokened request hit the rate limit, or the token lacks access to this repo.',
          404: 'Either the branch is gone, or this browser holds no GitHub token. A private repo reads as missing to an un-tokened browser, which is what an in-app or fresh browser usually is. Sign in, or open the link in your normal browser.',
        }[e?.status];
        this.error = 'Could not read ' + at;
        this.errorHint = hint || (/^(Failed to fetch|NetworkError|Load failed)/.test(raw)
          ? 'The request never reached GitHub. Check the connection and reload.'
          : '');
        this.errorRaw = raw;
      },

      async load() {
        this.loading = true; this.error = ''; this.errorHint = ''; this.errorRaw = '';
        // Which load this is. A step that lands while the previous read is in
        // flight must not have the older answer arrive on top of it, and with
        // the cache in front of the fetch the two can now settle out of order
        // cheaply enough to matter.
        const pass = ++this._pass;
        // A verdict belongs to ONE branch. The deck steps this component across
        // several, so a stale map would mark this branch's files with the last
        // branch's answers, which is worse than no marks at all.
        this.scan = null; this.scanError = ''; this.fallbackFiles = [];
        this.fileState = o.fileState || '';
        // The cap is per branch, for the reason the verdict is: the deck steps
        // this component across several, and a reader who opened one branch's
        // long list has said nothing about the next one's.
        this.showAllFiles = false;
        // The swiper's place and its mounted cards are per branch too.
        this.at = 0; this.mounted = {}; this.listOpen = false;
        try {
          // Checked, not assumed. This component is registered by the pre-build's
          // auto-boot while kits/branch-brief.js rides in its page's own gh.load
          // chain, which runs after; a page that forgets the ready gate mounts
          // this against a kit that does not exist yet. Naming that condition is
          // the difference between "reload the page" and a TypeError the reader
          // has no way to act on.
          if (!window.BranchBrief) {
            this.error = 'This page has not finished loading its code';
            this.errorHint = 'Reload the page. If it persists, the page is being served from a stale cache: reload once more with the cache bypassed.';
            this.errorRaw = 'window.BranchBrief is undefined (kits/branch-brief.js did not run before the mount)';
            return;
          }
          const gh = new window.GH({ token: window.TOKEN, repo: this.repo, ref: this.branch });
          // Both reads START here. The registry used to run after the brief
          // resolved, which put a whole round trip on the critical path for a
          // CSV that decides nothing but the grouping of one pane, and on a
          // repo declaring none it was a 404 the reader watched before seeing
          // a diff. Started together, the page costs max(compare, csv) rather
          // than their sum, and the memo makes the second branch of a repo pay
          // nothing at all.
          //
          // It is awaited BEFORE the render rather than allowed to land late,
          // and that is the part worth keeping. Letting it arrive after would
          // regroup the pane under the reader, tearing down every file card
          // that had already mounted and re-fetching whatever they had opened.
          // A pane that appears once, grouped, is worth the shorter of two
          // waits that are now running at the same time.
          const registry = this.loadRegistry(pass);
          // Started with the registry, on the same reasoning: two small reads
          // that decide how one strip renders, running beside the brief rather
          // than after it. Unlike the registry it is NOT awaited before the
          // render: the Look row appears above the sections when it lands, and a
          // row that fades in costs nothing, where the file grouping arriving
          // late would tear down every mounted card.
          const routes = this.loadRouteManifest(pass);
          // Whether to defer the compare, and the test is whether anything
          // ELSE can answer the head. The compare is the expensive half (see
          // the kit's note: most of a megabyte on this repo, 88% of it a
          // generated bundle) and only the Files and Commits panes need it, so
          // where a host lends the numbers it costs nothing to wait for a tap.
          // Where nothing does, the compare is the head's only source and
          // deferring would trade a megabyte for a strip of question marks on
          // a page whose whole claim is that its facts are read at open time.
          // A cold pages/branch.html is that case, and it is why this turns on
          // `facts` rather than on `framed`: supplying the chrome and knowing
          // the ahead count are different things a host may do.
          const at = { repo: this.repo, branch: this.branch, base: this.base };
          const defer = o.facts?.ahead != null;
          const r = await (defer ? window.BranchBrief.readGuide(gh, at)
                                 : window.BranchBrief.readBrief(gh, at));
          if (pass !== this._pass) return;      // a later branch overtook this one
          this._pulls = r.pulls;
          this.brief = this.assemble({ compare: r.compare || null, noBase: !!r.noBase });
          // The repo's declared inbox, for the drop-a-file mint: the shell's
          // config cache when this renders inside show-repo, else null, which
          // BranchStatus turns into dump/. Deliberately NOT a fetch: mount
          // reads nothing beyond the brief (branch-brief-cards holds that),
          // and dump/ is the convention's own universal default.
          this.inbox = window.__shell?.estateConfigs?.[this.repo]?.inbox || null;
          // A link that named a PR opens on that PR rather than the newest, so
          // #gh=owner/repo&pr=<n> lands where it says even after a second PR
          // has opened on the same branch.
          if (o.pr) {
            const i = this.brief.prs.findIndex(p => p.number === Number(o.pr));
            if (i >= 0) this.guideIdx = i;
          }
          // What the ADDRESS asked for, if anything. Both sections render, so
          // this no longer picks one: it is honoured as a scroll below, and
          // read here for the one thing it still decides, which is whether to
          // spend the compare.
          this.pane = o.pane === 'files' || o.pane === 'guide' ? o.pane : '';
          this.renderGuide();
          await registry;                       // already running; assigns this.registry
          // WHEN THE DIFF IS WORTH FETCHING UNASKED, and the rule is the one
          // the tabs enforced by accident: read it unless something else on
          // this page is worth reading first. A branch with no guide has
          // nothing else, so its files are fetched at once rather than behind
          // a tap the reader has no reason to make; a branch with one keeps
          // the deferral (most of a megabyte on a repo that commits a bundle)
          // and offers the ask as a row where the list would be. An address
          // naming the files, or naming a file, is that ask arriving early.
          //
          // THE FIRST CLAUSE IS NOT ABOUT FETCHING. A brief that is not pending
          // has its compare already, so the call reaches ensureCompare's own
          // first line and runs the SCAN, which is the only thing that puts the
          // verdict strip over the file list. Without it the one host that can
          // never be lent a verdict was the one host that never computed one:
          // a cold pages/branch.html with a pull request, which is nearly every
          // branch, paid for the compare and then rendered a file list with no
          // "on main" strip, no landed/differs/missing counts and no missing
          // mark on a row. The estate lends its slides that strip so they read
          // the same as this page (estate.js, `scan: this.verdictOf(r)`); this
          // is the half of that pair that was not holding.
          if (!this.brief.pending || !this.hasGuide || this.pane === 'files' || o.file || o.autoCompare) this.ensureCompare();
          // An address may also name a FILE, and that is the deck rather than a
          // section: a link naming one path is asking to READ it, where the
          // list is the route to a file and never the destination. Not awaited,
          // so the head and the sections render while the compare that turns a
          // path into a slide is still in flight.
          if (o.file) this.openFileFromAddress(o.file, pass);
          // And the scroll, last, so it measures a page that has rendered.
          // Only an explicit ask moves the view: an opening that jumped by
          // default would take the reader off the head they just opened.
          if (this.pane) this.$nextTick(() => this.scrollToSection(this.pane));
          routes.catch(() => {});         // never rejects; this only states so
        } catch (e) {
          if (pass === this._pass) this.fail(e);
        } finally {
          if (pass === this._pass) {
            this.loading = false;
            this.reportMeta();
            // Last, and only once this branch is on screen: the neighbours the
            // embedder named. Nothing here is awaited or rendered.
            this.warmNeighbours();
          }
        }
      },
      _pass: 0,
      _pulls: [],
      _cmpPass: -1,
      // Whether the compare is in flight, which the panes that need it show a
      // spinner for. Separate from `loading`, which is the head's: the head is
      // done and correct while this is still running.
      filesLoading: false,
      // The deck button's own busy state, distinct from filesLoading: a tap
      // that has to fetch first gives feedback in the control that was tapped,
      // not in a pane the reader may not even be looking at.
      deckOpening: false,

      // One projection, called twice: once on the guide alone and again when
      // the compare lands. Both go through the kit rather than patching the
      // first result, so there is one statement of what a brief is and the
      // second pass cannot drift from the first.
      assemble({ compare, noBase }) {
        return window.BranchBrief.assemble({
          repo: this.repo, branch: this.branch, base: this.base,
          compare, noBase, pull: this._pulls[0] || null, pulls: this._pulls,
          authored: o.authored || null, facts: o.facts || null,
        });
      },

      // The deferred half. Called when the reader opens a pane that needs the
      // diff, and idempotent per load: a reader tapping between Files and
      // Commits asks once.
      async ensureCompare() {
        if (!this.brief) return;
        // Opening Files is the gesture that means "measure this branch", and it
        // has to mean that however the diff arrived. A cold page reads the
        // compare up front, so without this line the one host that cannot be
        // lent a verdict would be the one host that never computes one.
        if (!this.brief.pending) { this.ensureScan(); return; }
        // Idempotent per load, and a second caller AWAITS the first rather than
        // returning to a brief that is still pending. Two callers is the
        // ordinary case since `&file=` shipped: the pane asks on mount and the
        // address asks beside it, and a bare `return` handed the second one an
        // empty file list, so a link naming a real file opened nothing at all.
        // The deck button had the same latent fault, one tap behind a pane tap.
        if (this._cmpPass === this._pass) return this._cmpWait;
        this._cmpPass = this._pass;
        return (this._cmpWait = this._readCompare(this._pass));
      },
      _cmpWait: null,
      async _readCompare(pass) {
        this.filesLoading = true;
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.repo, ref: this.branch });
          const { compare, noBase } = await window.BranchBrief.readCompare(gh, {
            repo: this.repo, branch: this.branch, base: this.base,
          });
          if (pass !== this._pass) return;             // a step landed while reading
          this.brief = this.assemble({ compare, noBase });
          // The state badge and the counts are the compare's to correct, so the
          // host hears again now that they are read rather than provisional.
          this.reportMeta();
          this.ensureScan();          // not awaited: the file list paints first
          // And warm again, which now takes the neighbours' diffs as well: a
          // reader who has opened one diff is the reader the expensive warm was
          // meant for. Without this the rule would be unreachable, since the
          // first warm runs at the end of load(), before any pane was tapped.
          this.warmNeighbours();
        } catch (e) {
          if (pass === this._pass) this.fail(e);
        } finally {
          if (pass === this._pass) this.filesLoading = false;
        }
      },

      // Measure the verdict: two recursive tree reads, one for the base and one
      // for the branch tip, and then the same pure function the estate crawl
      // uses. Deliberately NOT awaited by its caller. The file list is already
      // on screen from the compare, the marks and the counts arrive a moment
      // later, and a reader who never looks at them has waited for nothing.
      //
      // Two trees is the whole cost, and on this repo that is about a fifth of
      // what the compare it follows already spent. It is paid once per branch
      // per reading pass, since `scan` is set and this returns early after.
      async ensureScan() {
        if (this.scan || this.scanLoading) return;
        if (!window.BranchStatus || !this.base) return;
        const pass = this._pass;
        this.scanLoading = true; this.scanError = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.repo, ref: this.branch });
          // NO MERGE BASE, so the compare 404'd and there is no file list to
          // classify. The branch still changed something, and the crawl reads it
          // through the same fallback (BranchStatus.recentHistory) before
          // lending its slides the result. A cold page has nobody to lend it
          // one, so it makes the same read rather than rendering a branch whose
          // files are unknown as a branch that changed nothing.
          //
          // Skipped where the host already lent the answer, which is the same
          // rule the compare's own deferral follows: read it unless something
          // else can say. A slide arrives with the crawl's missing paths in
          // hand, so paying two calls to recompute them would spend the
          // deferral's saving on the one branch shape that has no diff to read.
          let files = this.brief?.files || [];
          if (!files.length && this.brief?.noBase && !(o.scan?.missingPaths || []).length) {
            const fb = await window.BranchStatus.recentHistory(gh, { name: this.branch, sha: o.sha || '' });
            if (pass !== this._pass) return;
            files = (fb.files || []).map(f => ({ path: f.filename }));
            this.fallbackFiles = files;
          }
          if (!files.length) return;                   // nothing to classify
          const [base, tip] = await Promise.all([
            window.BranchStatus.defaultTree(gh, this.base),
            window.BranchStatus.defaultTree(gh, this.tipRef),
          ]);
          if (pass !== this._pass) return;             // a step landed while reading
          const states = window.BranchStatus.pathStates(
            files.map(f => f.path), tip.sets, base.sets);
          this.scan = { ...window.BranchStatus.countStates(states), states,
                          // A tree GitHub truncated is short, and a path it left
                          // out reads as missing when it is merely unlisted. The
                          // strip says so rather than letting the count assert
                          // something the read cannot support.
                          truncated: base.truncated || tip.truncated };
        } catch (e) {
          if (pass === this._pass) this.scanError = e?.message || String(e);
        } finally {
          if (pass === this._pass) this.scanLoading = false;
        }
      },

      // WHICH REF the tip tree is read at, and it prefers a SHA on purpose. A
      // tree address is a path segment, so a branch called claude/something has
      // to be percent-encoded into it, and every branch in this estate has a
      // slash. The rest of the app reads trees that way and it works, but a SHA
      // needs no encoding at all, so where one is at hand it is the address with
      // nothing to be wrong about. The host lends the tip it already crawled;
      // failing that, the compare's newest commit IS the tip, but only when the
      // commit list is the whole branch (GitHub caps it at 250 and reports the
      // real total, and past the cap the newest entry present is not the tip).
      // The branch name is the last resort and the standalone page's normal one.
      get tipRef() {
        if (o.sha) return o.sha;
        const c = this.brief?.complete ? this.brief.commits?.[0]?.sha : '';
        return c || this.branch;
      },

      // What the pane shows: the measurement when it has landed, otherwise the
      // host's lent copy, which carries the counts and the missing paths but no
      // per-path map. `lent` is what the strip reads to know that two of its
      // three filters are not exact yet.
      get verdict() {
        if (this.scan) return { ...this.scan, lent: false };
        const s = o.scan;
        if (!s || !s.nUnique) return null;
        return { nUnique: s.nUnique, nLanded: s.nLanded || 0, nMissing: s.nMissing || 0,
                 nDiffers: s.nDiffers ?? (s.nUnique - (s.nLanded || 0) - (s.nMissing || 0)),
                 missingPaths: s.missingPaths || [], differsPaths: [],
                 states: null, truncated: false, lent: true };
      },
      // One file's verdict, or '' when nothing can answer yet. A lent scan
      // answers for exactly one class, and answers it exactly: the crawl stored
      // the missing paths themselves, so the class a reader most often taps is
      // right from the first frame and the other two wait for the trees.
      stateOf(path) {
        if (this.scan?.states) return this.scan.states.get(path) || '';
        const lent = o.scan?.missingPaths;
        return (lent && lent.length && lent.includes(path)) ? 'missing' : '';
      },
      // The strip: one chip per state, plus a leading All that clears the
      // filter. Built from BranchStatus.PATH_STATES so the vocabulary and the
      // hover text have one owner and the estate chip cannot drift from this.
      get pathStateChips() {
        const v = this.verdict;
        if (!v) return [];
        const n = { landed: v.nLanded, differs: v.nDiffers, missing: v.nMissing };
        // Inactive fills are deliberately even. A tinted `success` and `warning`
        // at 15% are nearly invisible in the light theme while a flat base-200
        // is not, which put the most visible pill on the least urgent class.
        const cls = {
          landed: ['bg-success/20 text-success', 'bg-success text-success-content'],
          differs: ['bg-base-content/10 text-base-content/60', 'bg-base-content/70 text-base-100'],
          missing: ['bg-warning/20 text-warning', 'bg-warning text-warning-content'],
        };
        // A state with no files in it is not offered: an empty filter is a dead
        // tap, and "0 missing" is already said by the absence of the chip.
        return (window.BranchStatus?.PATH_STATES || [])
          .filter(st => n[st.key] > 0)
          .map(st => ({ ...st, n: n[st.key], off: cls[st.key][0], on: cls[st.key][1],
                        exact: !v.lent || st.key === 'missing' }));
      },
      // What the pane and the deck actually page through. The filter runs here,
      // above the registry grouping, so one rule covers the list, the groups and
      // the deck rather than each filtering for itself.
      get filteredFiles() {
        const files = this.brief?.files || [];
        if (!this.fileState) return files;
        return files.filter(f => this.stateOf(f.path) === this.fileState);
      },
      // The heading reads what the list SHOWS, and says what it is showing out
      // of when that is not everything. A count beside a heading that disagrees
      // with the list under it is how a filter goes unnoticed.
      // THE HEADING COUNTS ITS OWN LIST, not the branch, since 2026-09-05 put
      // the pages and the prose in a section above it. The two counts partition
      // the branch and both are on screen, which is what keeps this honest: a
      // heading reading the branch total over a shorter list is the lie that
      // killed the first version of the split, where the reviewable files were
      // to be dropped from the list rather than moved out of it.
      get fileCount() {
        if (!this.brief || this.brief.pending) return '';
        const all = this.brief.files.filter(f => !this.isReviewable(f.path)).length;
        return this.fileState ? this.listFiles.length + '/' + all : (all || '');
      },
      setFileState(key) { this.fileState = this.fileState === key ? '' : key; },
      toggleVerdictNote(key) { this.verdictNote = this.verdictNote === key ? '' : key; },
      get verdictNoteText() {
        if (this.verdictNote === 'truncated')
          return 'GitHub truncated a tree listing for this repo, so a path it left out reads as missing here. '
               + 'The missing count is a ceiling rather than an answer.';
        if (this.verdictNote === 'error') return this.scanError;
        return '';
      },
      // A branch with no merge base has no compare and so no diff to render,
      // and its missing paths are the actionable half of what can still be
      // known. Linked, because the whole point of naming a file is being able
      // to open it.
      //
      // TWO SOURCES, one answer, in falling order of authority: the scan this
      // view ran, then the host's lent copy. The lent one is all there was
      // until 2026-09-04, which made this the last thing a cold page could not
      // show; it now runs the same fallback (see ensureScan) and measures its
      // own. The lent copy stays first-frame useful and is still the only
      // answer while the scan is in flight.
      get lentMissing() {
        if (!this.brief || this.brief.files.length) return [];
        return this.scan?.missingPaths?.length ? this.scan.missingPaths
             : (o.scan?.missingPaths || []);
      },
      blobUrl(path) {
        return 'https://github.com/' + this.repo + '/blob/'
             + encodeURIComponent(this.branch) + '/' + path.split('/').map(encodeURIComponent).join('/');
      },

      // What the host could not know until a read finished. The PR number is
      // the case that matters: the activity crawl asks GitHub for OPEN pull
      // requests only, so a branch whose PR merged has none in the cache, and a
      // deck header wanting to show it has to be told. A plain callback,
      // because the host mounts this component directly; it used to be a
      // postMessage across an iframe.
      reportMeta() {
        const pr = this.guidePr;
        try {
          o.onMeta?.({ repo: this.repo, branch: this.branch, base: this.base,
                       pr: pr ? pr.number : 0, prState: pr ? this.prStateLabel : '',
                       state: this.brief?.state || '', pane: this.pane });
        } catch {}
      },
      // Asking for a section: record it, tell the host, and go there. It is a
      // reported fact and not just local state because the host stamps the
      // address from what the slide is showing, so a reader who went to the
      // files and copied the link gets a link that lands on them.
      //
      // It swaps the pane AND scrolls. The swap is the whole of it in the
      // locked layout, where the pane is a box in view; the scroll matters
      // unlocked (a phone turned sideways) where the document still runs long.
      // Harmless in the case it does not apply to, which is why there is one
      // path rather than two.
      setPane(p) {
        this.pane = p;
        if (p === 'files' || p === 'guide') {
          this.topPaneAsked = p;
        }
        if (p === 'files' && this.brief?.pending) this.ensureCompare();
        this.reportMeta();
        this.scrollToSection(p);
      },

      // Bring a section into view. Guarded twice over: the ref is only there
      // once the section has rendered, and jsdom (which every test here runs
      // in) implements no scrolling at all, so this has to be a no-op rather
      // than a throw inside a load.
      scrollToSection(name) {
        const el = this.$refs?.[name];
        if (!el || typeof el.scrollIntoView !== 'function') return;
        try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        catch { try { el.scrollIntoView(); } catch {} }
      },

      // The content registry, read at the BRANCH ref so a branch that declares
      // new rows reviews under them. Absent or unparsable means no
      // categorization, which is the flat list this pane always had: the
      // registry owes the repo no inventory, and this pane owes the registry
      // no error. Landing late is fine: `fileGroups` falls back to the flat
      // list until it arrives, so the pane regroups rather than appearing.
      //
      // The reader is lazy-loaded HERE, not owed to the page's own load chain
      // (the estate's sessionRender idiom). This is load-bearing for previews:
      // ?use= swaps the BUNDLE while github.io serves the PAGE FILE from main,
      // so a gh.load line added to branch.html does not exist in the deployed
      // shell until merge, and the grouping shipped dark under exactly the link
      // meant to show it (measured 2026-08-08, from a phone). The bundle's
      // inlined cache serves this load without a network trip; branch.html
      // still lists it for the plain chain.
      //
      // Cached per repo@ref for the swiper's sake: stepping through eight
      // branches of one repo asked the same question eight times, and on a repo
      // with no registry that is eight 404s.
      async loadRegistry(pass) {
        const rows = await this.readRegistry(this.repo, this.branch);
        if (pass === this._pass) this.registry = rows;
      },

      // The read itself, with nothing of the current branch in it, so a
      // neighbour can be warmed through the same path. Keyed by ref rather
      // than by repo because a branch that declares new rows must review under
      // them, which is also why warming it matters: it is the one read a
      // warmed neighbour would otherwise still owe, and it was left as the
      // whole critical path of an otherwise free step (measured at 246ms
      // against 53ms for a fully warmed one, branch-step-cost.mjs).
      readRegistry(repo, ref) {
        const key = repo + '@' + ref;
        const hit = REGISTRIES.get(key);
        if (hit && Date.now() - hit.at < registryTtl()) return hit.p;
        // The PROMISE is stored, for the same reason readBrief stores one: a
        // warm still in flight has to be JOINED, not raced. Storing the
        // resolved rows instead left the arriving reader issuing a second
        // request while the prefetch was mid-air, so the neighbour was warmed
        // and the step paid for it anyway.
        const p = (async () => {
          try {
            if (!window.Csv && window.gh?.load) await window.gh.load('kits/csv.js');
            if (!window.ContentRegistry && window.gh?.load) await window.gh.load('kits/content-registry.js');
            const gh = new window.GH({ token: window.TOKEN, repo, ref });
            const csv = (await gh.get(window.ContentRegistry?.PATH || 'data/design/content.csv')).text;
            const parsed = window.ContentRegistry?.parse?.(csv) || [];
            return parsed.length ? parsed : null;
          } catch { return null; }      // never rejects, so the memo is always an answer
        })();
        REGISTRIES.set(key, { at: Date.now(), p });
        return p;
      },
      // Drop the memo ahead of its expiry. The refresh message is the reader
      // saying the cached observation is no longer the one they want.
      forgetRegistry() { REGISTRIES.clear(); },

      // ── The Look row: which of the app's own views this branch changes ────
      //
      // The reverse join is kits/route-activity.js's `routesTouched`, the same
      // fold and the same WIDE rule the estate's Open list has painted on its
      // branch rows since the Routes pane shipped. Nothing about the judgment
      // is re-decided here: a hit on a file fewer than three routes declare is
      // ON the route, a hit only on a widely shared file is NEAR it, and the
      // shell never counts. That rule has a scar behind it (the Routes pane's
      // first render claimed work open on eleven routes off three PRs), and
      // re-deriving it beside a second copy is how a scar gets forgotten.
      //
      // What this adds is the REF. The Open list's chips call the shell's own
      // dispatcher, which walks the page you are already on to that view: main,
      // rendered from main, at the one moment the branch was the point. Here a
      // chip is an address (`?use=<tip>&view=<key>`) and the tip is what the
      // page already resolved for its tree reads, so the link opens the branch's
      // library in the deployed app.
      async loadRouteManifest(pass) {
        const m = await this.readRouteManifest(this.repo, this.branch);
        if (pass === this._pass) this.routeManifest = m;
      },

      // Read at the branch ref, memoized per ref, and never rejecting, so the
      // memo always holds an answer rather than a retry. A repo that declares no
      // routes is answered without a request at all: routes are one page in one
      // repo, and asking every other repo for a CSV it cannot have is a 404 per
      // branch step for a question already settled by the repo's name.
      readRouteManifest(repo, ref) {
        if (repo !== ROUTES_REPO) return Promise.resolve(null);
        const hit = MANIFESTS.get(ref);
        if (hit && Date.now() - hit.at < registryTtl()) return hit.p;
        const p = (async () => {
          try {
            if (!window.Csv && window.gh?.load) await window.gh.load('kits/csv.js');
            if (!window.routeActivity && window.gh?.load) await window.gh.load('kits/route-activity.js');
            if (!window.routeActivity || !window.Csv) return null;
            const gh = new window.GH({ token: window.TOKEN, repo, ref });
            // The vocabulary is glosses only, so a repo mid-rename still gets
            // its routes; the manifest is the half this row cannot do without.
            const [routes, vocab] = await Promise.all([
              gh.get(ROUTES_CSV).then(r => r.text),
              gh.get(ROUTES_VOCAB).then(r => r.text).catch(() => ''),
            ]);
            return window.routeActivity.manifest(
              window.Csv.rows(routes).map(r => ({
                ...r, files: window.Csv.list(r.files), tabs: window.Csv.list(r.tabs),
              })),
              window.Csv.rows(vocab));
          } catch { return null; }
        })();
        MANIFESTS.set(ref, { at: Date.now(), p });
        return p;
      },

      // The chips, or null for "there is nothing to say yet". Three ways to be
      // null and they are different facts: no manifest (not the hub), no
      // compare (the deferral, which the row reports rather than hides), and a
      // compare that found no route's declared file among the changed files.
      get routeChips() {
        const m = this.routeManifest;
        if (!m || !window.routeActivity || this.brief?.pending) return null;
        const paths = (this.brief?.files || []).map(f => f.path);
        if (!paths.length) return null;
        const { on, near } = window.routeActivity.routesTouched(m, paths);
        if (!on.length && !near.length) return null;
        const ref = this.tipRef;
        return {
          on: on.map(r => ({
            key: r.key, label: r.label,
            url: window.routeActivity.viewUrl(r, ref),
            title: r.label + ', on this branch: ' + r.hits.join(', '),
          })),
          // The near set is a COUNT, not chips, and both the rule and its
          // wording live in the kit now (routeActivity.nearNote): the estate's
          // branch rows draw the same slot, and this string being written twice
          // is how they came to disagree, one collapsing the set and the other
          // rendering it as a ghosted link per route.
          nearCount: near.length,
          nearTitle: window.routeActivity.nearNote(near),
        };
      },

      // The pages this branch changed that can be RENDERED, routed through the
      // same table that decides where a guide's links point and where a file
      // card's one action goes (kits/guide-render.js). No second rule about
      // what is renderable: a page that opens rendered there opens rendered
      // here. Removed files are dropped, since nothing renders a deletion.
      get pageChips() {
        if (!window.GuideRender) return [];
        let paths = [];
        if (!this.brief?.pending) {
          paths = (this.brief?.files || [])
            .filter(f => f.status !== 'removed' && /\.html?$/i.test(f.path))
            .map(f => f.path);
        } else if (Array.isArray(o.pages) && o.pages.length) {
          paths = o.pages;
        } else {
          return [];
        }
        // Through pageTargets rather than renderTarget per path, for the one
        // rule a per-path table cannot hold: where the host lends the repo's
        // `showing` block (its .web-tools.json), a page under a framed view is
        // opened through the app that frames it, and several such pages collapse
        // to the one chip they are one thing to open. Lent nothing, this returns
        // exactly what the per-path map returned before.
        return window.GuideRender.pageTargets(this.repo, this.tipRef, paths, o.showing || null);
      },

      // Whether `?use=` would serve a stale bundle. Free: the same file list
      // the chips are derived from answers it.
      get bundleStale() {
        if (this.brief?.pending || !window.routeActivity) return false;
        return window.routeActivity.bundleStale((this.brief?.files || []).map(f => f.path));
      },

      // Whether the row has anything at all to occupy its line with. It shows
      // the deferral too, which is the one state worth rendering as an
      // affordance rather than as nothing: in show-repo the compare waits for a
      // tap, and a reader who cannot see that the row exists concludes the
      // branch changes no view. The tap costs the call the Files tab would have
      // made, not a call of its own, which is what separates this from a probe.
      get hasLook() {
        return !!(this.routeChips || this.pageChips.length
                  || (this.routeManifest && this.brief?.pending));
      },

      // ── Which copy of this page is running ────────────────────────────
      // window.gh.ref is what the LOADER booted from: `main` on the deployed
      // page, the SHA inside a toss or under a ?use= pin. Not the address bar's
      // ask, which a page whose boot block ignores ?use= would report falsely;
      // the FAB reasons the same way at loaderRef.
      //
      // A 40-character SHA is trimmed to 7, which is enough to tell two commits
      // apart in a screenshot and short enough not to push the line. A branch
      // name is left whole, since truncating one is how you get two branches
      // that read the same.
      get codeRef() {
        const r = (typeof window !== 'undefined' && window.gh && window.gh.ref) || 'main';
        return /^[0-9a-f]{7,40}$/i.test(r) ? r.slice(0, 7) : r;
      },
      get codeRefTitle() {
        return 'This page is running code from ' + this.codeRef
          + '. That is the page itself, not the branch it is describing.';
      },

      get stateClass() {
        return { live: 'badge-success', landed: 'badge-ghost', unrelated: 'badge-warning' }[this.brief?.state]
               || 'badge-ghost';
      },
      // ── The guide ────────────────────────────────────────────────────────
      // Whether there is a judgment layer at all: a PR body, or an envelope
      // handed in on the link. A branch with neither gets no Guide tab rather
      // than a tab onto an empty pane.
      get hasGuide() {
        return !!(this.brief?.prs?.length || this.brief?.authored);
      },
      // The body's styling comes from the kit, not from here, so the drawer and
      // this page render one guide the same way.
      get guideBodyClass() { return window.GuideRender?.bodyClass('page') || 'text-sm'; },
      get guidePr() { return this.brief?.prs?.[this.guideIdx] || this.brief?.pr || null; },
      get prUrl() { return 'https://github.com/' + this.repo + '/pull/' + (this.guidePr?.number || ''); },
      get prStateLabel() {
        const p = this.guidePr;
        return !p ? '' : (p.state === 'open' && p.draft ? 'draft' : p.state);
      },
      get prStateClass() {
        return { merged: 'badge-secondary', open: 'badge-success', closed: 'badge-ghost' }[this.guidePr?.state]
               || 'badge-ghost';
      },
      // Newer is index 0, so the right arrow steps DOWN the list. `dir` is the
      // reader's direction rather than the array's, which is why it is negated.
      stepGuide(dir) {
        const n = this.brief?.prs?.length || 0;
        const next = this.guideIdx + dir;
        if (next < 0 || next >= n) return;
        this.guideIdx = next;
        this.renderGuide();
      },
      // Render the body on display, once per PR. The known refs are this
      // branch and its base, which is all a guide for this branch can name
      // with a slashed ref, and the preferred ref is the branch, so the chip
      // strip shows each file at the version the branch is about rather than
      // at main.
      async renderGuide() {
        const pr = this.guidePr;
        const key = pr ? String(pr.number) : '';
        if (this.guideFor === key) return;
        this.guideFor = key;
        this.guideHtml = ''; this.guideTargets = [];
        if (!pr || !pr.body) return;
        try {
          if (!window.GuideRender) await window.gh?.load('kits/guide-render.js');
          await window.GuideRender.needMarked();
        } catch { return; }
        if (this.guideFor !== key) return;      // a step landed while loading
        const out = window.GuideRender.render(pr.body, {
          knownRefs: [this.branch, this.base, 'main'].filter(Boolean),
          preferRef: this.branch,
        });
        this.guideTargets = out.targets;
        this.guideHtml = out.html;
      },

      get treeUrl() { return 'https://github.com/' + this.repo + '/tree/' + this.branch; },
      // The GitHub exits, as labeled menu rows (the bare-glyph row read as
      // cryptic in the field). "New file here" keeps GitHub's own editor
      // reachable for the case the stage cannot take, a binary upload.
      get ghRows() {
        const rows = [];
        if (this.brief?.pr && !this.framed) {
          rows.push({ icon: 'ph-git-pull-request', label: 'Pull request',
                      hint: '#' + this.brief.pr.number + (this.brief.pr.draft ? ' draft' : ''), url: this.prUrl });
        }
        rows.push({ icon: 'ph-git-branch', label: 'Browse tree', hint: '', url: this.treeUrl });
        rows.push({ icon: 'ph-git-diff', label: 'Compare vs ' + this.base, hint: '', url: this.compareUrl });
        rows.push({ icon: 'ph-file-plus', label: 'New file here',
                    hint: '', url: window.BranchStatus ? window.BranchStatus.dropFileUrl(this.repo, this.branch, this.inbox) : '#' });
        return rows;
      },

      // The add-file plus: the stage, opened already aimed at this branch
      // (dest prefills repo@branch:inbox-or-dump; StageLink reads the key).
      // The stage owns deposit intake: paste or drop content there, tap send,
      // and gh-store lands the local items on the branch. A ?use= on the
      // current address rides along so a preview keeps previewing.
      get stageDepositUrl() {
        const dir = window.BranchStatus ? window.BranchStatus.dropDir(this.inbox) : 'dump';
        const dest = this.repo + '@' + this.branch + ':' + dir;
        let u = 'https://mehrlander.github.io/web-tools/app/?view=stage&dest='
          + encodeURIComponent(dest);
        try {
          const use = new URLSearchParams(location.search).get('use');
          if (use) u += '&use=' + encodeURIComponent(use);
        } catch { }
        return u;
      },
      get compareUrl() {
        return 'https://github.com/' + this.repo + '/compare/' + this.base + '...' + this.branch;
      },

      // One binding for count-plus-noun. A trailing <span>s</span> renders a
      // space before the plural ("3 changed file s").
      plural(n, noun) { return n + ' ' + noun + (n === 1 ? '' : 's'); },

      // What the Claude mark claims, which depends on where the link came
      // from. The mark is one unlabeled glyph, so its tooltip is the only
      // place the provenance is stated; saying "read from the branch tip"
      // over a link lifted out of a PR body would be a plausible lie, and the
      // kind nothing would ever catch. Sources: kits/branch-brief.js.
      sessionTitle(i) {
        const b = this.brief;
        if (!b) return '';
        const which = (b.sessions || []).length > 1 ? 'Session ' + (i + 1) + ': ' : '';
        const from = b.sessionsFrom === 'pr' ? 'named by the pull request body'
                   : b.sessionsExact ? 'the session that authored this branch'
                   : 'approximate, read from the branch tip';
        return which + from;
      },
      get fileTotals() {
        return (this.brief?.files || []).reduce((a, f) => ({
          additions: a.additions + (f.additions || 0),
          deletions: a.deletions + (f.deletions || 0),
        }), { additions: 0, deletions: 0 });
      },
      fileNote(path) { return this.brief?.authored?.files?.[path] || ''; },
      // The file list's shape: registry groups where one is declared, else
      // one unlabeled group holding the flat list (`labeled` gates the header
      // row, so the no-registry render is byte-for-byte the old one).
      // ── Reviewable, and the list ─────────────────────────────────────
      //
      // TWO SECTIONS, NOT TWO AXES IN ONE LIST. The registry groups by WHO MADE
      // IT and that stays its own question, untouched here; what a reader
      // reviews by READING is a different one, and on 2026-09-05 it stopped
      // being a group inside the list and became a section above it. The pages
      // and the prose are what a branch is read for; the rest is code, read as
      // a diff, and the list holding it starts shut.
      //
      // Mechanical is never reviewable. A generated .md is machine output
      // whatever its extension, so promoting one would put a generator's docs
      // above the work someone did.
      REVIEWABLE: /\.(?:html?|md|markdown)$/i,

      isMechanical(path) {
        if (!this.registry || !window.ContentRegistry) return false;
        return window.ContentRegistry.resolve(this.registry, path)?.mode === 'mechanical';
      },
      isReviewable(path) { return this.REVIEWABLE.test(path) && !this.isMechanical(path); },
      get reviewableFiles() { return this.filteredFiles.filter(f => this.isReviewable(f.path)); },
      get listFiles() { return this.filteredFiles.filter(f => !this.isReviewable(f.path)); },

      // WHICH OF THE TWO THE TOP PANE IS SHOWING. It was `filesOpen`, a
      // tri-state where null meant "the branch decides": shut where a reviewable
      // section stood in its place, open where none did. Measured over 20 merged
      // branches, twelve changed no .html and two changed neither .html nor .md,
      // so a page that collapsed to nothing but a caret was the ordinary case
      // and the default had to cover it.
      //
      // Tabs make the same answer simpler, because there is no shut: the pane
      // shows one of two. `null` still means the branch decides, and it decides
      // the same way, by whether there is a guide to show instead.
      topPaneAsked: null,
      get topPane() {
        const asked = this.topPaneAsked;
        if (asked === 'guide') return this.hasGuide ? 'guide' : 'files';
        if (asked === 'files') return 'files';
        return this.hasGuide ? 'guide' : 'files';
      },
      // Kept because everything downstream of the list reads it: the deck's
      // set, the group mounts, the address handler.
      get filesShown() { return this.topPane === 'files'; },

      // The list's own grouping, unchanged and over the list's own files. The
      // registry decides the order and which group trails collapsed; this
      // hands it a set with the reviewable section already taken out.
      get fileGroups() {
        const files = this.listFiles;
        if (!this.registry || !window.ContentRegistry) {
          return [{ mode: 'all', files, collapsed: false, note: '', labeled: false }];
        }
        return window.ContentRegistry.group(files, this.registry)
          .map(g => ({ ...g, labeled: true }));
      },
      groupOpen(g) { return this.groupState[g.mode] ?? !g.collapsed; },

      // ── The row cap ──────────────────────────────────────────────────────
      //
      // WHAT IT IS FOR: the guide sits under this list, so the list's length is
      // the guide's distance. Measured at 390px on a sixty-file branch, the
      // guide's top landed at 2309px, which is 2.7 screens of scrolling to
      // reach the judgment layer. Twenty rows puts it around 1050px, one flick.
      //
      // WHY A ROW COUNT AND NOT A HEIGHT: a max-height with its own scrollbar
      // bounds the list without hiding anything, and it was the first design.
      // It loses on two counts. A card expands INSIDE the panel, so a diff
      // would open into a bounded box inside the page's own scroller, which is
      // the nested-scroller shape the file-review pass already rejected once at
      // 1280px. And the panel clips (rounded corners need overflow-hidden), so
      // a row's dropdown would be cut by the box that is scrolling it. A row
      // budget costs one tap and none of that.
      //
      // It is not a filter. `deckFiles` reads `fileGroups`, so the deck still
      // pages every file in an open group whether or not the cap drew it; the
      // group toggles remain the only thing that narrows what the deck holds.
      ROW_CAP: 20,
      showAllFiles: false,
      // The groups as DRAWN: the same groups, with each open one's rows cut to
      // whatever is left of the budget. A collapsed group draws no rows and so
      // spends none, which is what lets a repo whose generated output starts
      // collapsed show its whole authored half. `total` carries the group's own
      // size, since the header must report the branch and not the slice.
      get displayGroups() {
        // SHUT MEANS UNMOUNTED, not merely hidden. x-show leaves the rows in
        // the DOM, so a collapsed list still built 20 fileReview components and
        // paid for every one: measured 2026-09-05 at 23 cards on a page drawing
        // three. Returning nothing here is the same move the group headers
        // already make with x-if one level down, and it keeps the reason in one
        // place rather than spread across three x-shows in the template.
        if (!this.filesShown) return [];
        const groups = this.fileGroups.map(g => ({ ...g, total: g.files.length }));
        if (this.showAllFiles) return groups;
        let budget = this.ROW_CAP;
        return groups.map(g => {
          if (!this.groupOpen(g)) return g;
          const take = Math.max(0, Math.min(g.files.length, budget));
          budget -= take;
          return take === g.files.length ? g : { ...g, files: g.files.slice(0, take) };
        });
      },
      // How many rows the cap is holding back, which is what its footer offers.
      // Counted off the drawn groups rather than recomputed, so the number and
      // the list cannot disagree.
      get hiddenFileCount() {
        return this.displayGroups.reduce(
          (n, g) => n + (this.groupOpen(g) ? g.total - g.files.length : 0), 0);
      },
      // The marker's tooltip. It states the destination and the title both,
      // since the title is the half a narrow row drops.
      get guideJumpTitle() {
        const p = this.guidePr;
        return !p ? 'Jump to the guide'
             : 'Jump to the guide: #' + p.number + (p.title ? ' — ' + p.title : '');
      },

      // ── The file deck ────────────────────────────────────────────────────
      //
      // What the deck pages through: the reviewable files, then every file in
      // an open list group, in that order.
      //
      // THE GROUP TOGGLES ARE ITS ONLY FILTER, and that is why there is no
      // second control to learn or keep in step. A collapsed group is a reader
      // saying the machine's output is not what they came for, so the deck
      // honours it. The reviewable section has no toggle to be out by, being a
      // section rather than a group, so it is always in.
      //
      // WHICH TAB IS UP DOES NOT NARROW IT. This read `filesShown ? … : []`
      // while the list was a section a reader could collapse, so that a shut
      // list emptied the deck. Files and the guide are tabs now and a guide is
      // not a file set, so that rule emptied the deck whenever the guide was
      // up, which on a branch with a guide and nothing reviewable took the
      // page's one accented control off the screen: its button keys x-show on
      // deckFiles.length (caught by branch-brief-hosted). The deck reads files,
      // so it reads them from either tab.
      get deckFiles() {
        const inList = this.fileGroups.filter(g => this.groupOpen(g)).flatMap(g => g.files);
        return [...this.reviewableFiles, ...inList];
      },

      // Drill into the files. The parent is the deck this branch is a slide of,
      // so the header becomes the file's, the crumb keeps the branch, and Back
      // returns the reader here rather than closing them out of anything.
      //
      // The kit is pulled on first use, not owed to the page's load chain: a
      // visit that never opens the deck pays nothing, and the pre-build's
      // inlined cache serves the load without a network trip. Same idiom the
      // content registry uses two methods up, and load-bearing for the same
      // reason: a gh.load line added to pages/branch.html would not exist in
      // the deployed shell until merge.
      async openFileDeck(start) {
        // The deck is a way INTO the files, not a view of a list already open,
        // so it fetches what it needs rather than requiring the reader to have
        // opened the file list first. That is the whole difference between a
        // second control on the list and a first-class route to the diff.
        if (this.brief?.pending) {
          this.deckOpening = true;
          try { await this.ensureCompare(); } finally { this.deckOpening = false; }
        }
        const files = this.deckFiles;
        if (!files.length) return;
        try {
          if (!window.swipeDeck && window.gh?.load) await window.gh.load('kits/swipe-deck.js');
          if (!window.subjectChannel && window.gh?.load) await window.gh.load('kits/subject-channel.js');
          if (!window.fileDeck && window.gh?.load) await window.gh.load('kits/file-deck.js');
          if (!window.fileDeck) return;
          // A parent deck already names this branch in its own title, so the
          // crumb takes it from there; standalone there is no parent and this
          // view has to supply it.
          const parent = window.swipeDeck.top();
          window.fileDeck.open({
            repo: this.repo, ref: this.branch, base: this.cmpBase, baseName: this.cmpBaseName,
            files, start: start || 0,
            subtitle: parent ? '' : this.branch,
            parent,
          });
        } catch (e) { console.warn('file deck:', e?.message || e); }
      },
      openFileDeckAt(path) {
        const i = this.deckFiles.findIndex(f => f.path === path);
        return this.openFileDeck(i < 0 ? 0 : i);
      },
      // `&file=<path>` on the address, which the standalone page and the
      // in-app takeover both parse. Three things it will not do, and each one
      // is a way this could open a deck the reader did not ask for:
      //
      //   - a path this branch does not touch opens NOTHING. openFileDeckAt
      //     falls back to index 0 on a miss, which is right for a tap on a row
      //     that exists and wrong for an address that may be stale or mistyped:
      //     a deck of the wrong file reads as an answer.
      //   - a step to another branch cancels it. The deck steps this component
      //     across slides, so the compare can land after the reader has moved,
      //     and `pass` is how every other deferred read here says so.
      //   - it fires ONCE. The option is deleted after it is consumed, so
      //     closing the deck and returning to the list leaves the reader on the
      //     list rather than reopening what they just dismissed.
      async openFileFromAddress(path, pass) {
        delete o.file;
        try {
          await this.ensureCompare();
          if (pass !== this._pass) return;
          // AGAINST THE WHOLE BRANCH, NOT THE OPEN GROUPS. This read
          // `deckFiles`, which is only what is open, and once most of the list
          // started collapsed (2026-09-05) a perfectly good address opened
          // nothing and said nothing. An address is not a display preference:
          // the reader named a file, so the group holding it opens and stays
          // open behind the deck. A path the branch does not touch still opens
          // nothing, which is the rule above and the reason this looks the file
          // up rather than trusting the address.
          const idx = this.swipeFiles.findIndex(f => f.path === path);
          if (idx < 0) return;
          this.go(idx, true);
          await this.openFileDeckAt(path);
        } catch (e) { console.warn('file from address:', e?.message || e); }
      },
      toggleGroup(mode) {
        const g = this.fileGroups.find(x => x.mode === mode);
        this.groupState[mode] = !(this.groupState[mode] ?? !(g?.collapsed));
      },
      // The per-card options, read from the CLOSURE rather than off `this`, and
      // that is not a style choice. This method is called from inside an
      // x-data expression (x-data="fileReview(cardOpts(f))"), the one place
      // Alpine injects every registered component name into the evaluation
      // scope as a callable. So `this.repo` there resolves to the `repo`
      // DATA PROVIDER (alpineComponents/repo.js), not to this component's own
      // repo string, and each card was handed Alpine's provider wrapper as its
      // repo. Every content fetch then addressed
      // /repos/(...i)=>n.bind(e)(...i)/contents/… and 404'd, so each card lost
      // its Diff, New, and Base tabs and fell back to Patch alone: the page's
      // whole diff layer, gone with nothing said. It bites only where the full
      // library is registered, which is exactly how pages/branch.html boots
      // (dist/web-tools.js), and never in the unit tests, which register two
      // components. review.html escaped it by building its card opts in a
      // getter, where no providers are in scope.
      // WHAT A CARD COMPARES AGAINST: the merge base, the commit the file list
      // was diffed from, so a card shows the change the list names. The base
      // branch's tip is the fallback while the compare is unread, and a choice
      // in the compare menu (see compareChoices).
      get cmpBase() { return this.brief?.mergeBase || o.base || ''; },
      // Named for what it is, not by its sha: a bare id reads as the branch's
      // own and raises a question it does not answer.
      get cmpBaseName() { return this.brief?.mergeBase ? 'merge base' : (o.base || ''); },
      get compareChoices() {
        const out = [];
        if (this.brief?.mergeBase) out.push({ base: this.brief.mergeBase,
          label: 'vs merge base' });
        if (o.base) out.push({ base: o.base, label: 'vs ' + o.base + ' today' });
        return out;
      },
      cardOpts(f) {
        const openAt = (path) => this.openFileDeckAt(path);
        return { repo: o.repo || '', ref: o.branch || '',
                 // `base` as well as `baseName`: without it fileReview falls
                 // back to 'main', which is a guess this page never had to
                 // make, and which the file deck would then have to repeat to
                 // keep the two diffs agreeing.
                 base: this.cmpBase, baseName: this.cmpBaseName, path: f.path,
                 baseChoices: this.compareChoices,
                 versionScope: (this.brief?.commits || []).map(c => c.sha),
                 prevPath: f.previousPath, status: f.status,
                 additions: f.additions, deletions: f.deletions, patch: f.patch,
                 // Read from here: the deck, opened at THIS file. The callback
                 // is built in the closure for the same reason the rest of this
                 // object is; see the note below.
                 action: { label: 'Read from here', icon: 'ph-cards-three', onClick: openAt },
                 // Cards start CLOSED, at every width and every size of change
                 // set. They opened on a wide screen with a modest one until
                 // 2026-08-31, on the reading that a wall of closed caret rows
                 // was two taps of collapsing before any content, and that
                 // reading held while the files were a pane of their own with
                 // nothing below them. They are not: the guide sits under the
                 // list, so an open card is no longer free, and four of them
                 // put the judgment layer three screens down on a change set
                 // the reader can take in at a glance. Closed, the list is the
                 // scannable manifest the stacking was for, and the diff is one
                 // tap on a row or the deck button on the heading row.
                 open: false };
      },

      // ── A reviewable file, PRESENTED ──────────────────────────────────────
      //
      // The same card the list uses, with the two switches that turn a row into
      // a view. `open`, so it lands showing the file rather than a caret; and
      // `read`, which is fileReview's own word for preferring what a file IS
      // over how it changed. Without it a markdown card opens on a diff of the
      // markup, which _defaultTab decides by asking whether the SURFACE is a
      // reading one. This one is: it exists because the reader said the point
      // of the page is looking at these.
      //
      // `read` also hands the comparison up rather than owning it, so the strip
      // is the file and one Compare pane instead of four readings of a pair.
      // Compare survives (compareOff is false unless the FAB's compare bar
      // turns it off), so the diff is still one tap from a rendered document.
      reviewCardOpts(f) {
        const { action, ...rest } = this.cardOpts(f);
        return { ...rest, open: true, read: true, fill: true };
      },
      // A slide's card. Reviewable files read as documents with Compare one
      // tap away; the rest open on their diff. No per-card pager: the swiper's
      // header carries n/m for every slide.
      // HOSTED, as kits/file-deck.js mounts its slides: the swiper's header
      // names the file and carries its controls, so the card is the content.
      // Each opens on its comparison: markdown on the rendered one, code on the
      // source diff. A page (html) opens on itself, having no rendered diff. A
      // file with nothing to compare against falls back to itself.
      slideCardOpts(f) {
        const { action, ...rest } = this.cardOpts(f);
        const md = /\.(md|markdown)$/i.test(f.path);
        return { ...rest, open: true, read: true, hosted: true, fill: true, stats: true,
                 openOn: md ? 'mddiff' : this.isReviewable(f.path) ? '' : 'diff',
                 onChrome: () => { this._chromeTick++; } };
      },

      // HOW TALL ANY ONE BLOCK GETS BEFORE IT IS THE WHOLE PAGE. A rendered
      // SNAGS.md is fifteen thousand words, and a guide body can be two
      // thousand; either one out in the open puts everything after it screens
      // away. So a block is clipped to a preview, says so with a fade, and one
      // tap gives it the room it wants.
      //
      // KEYED, not per-section: the reviewable panels key on their path and the
      // guide on the constant "guide", which is the whole difference between
      // them. It was named revOpen/watchRev while the panels were the only
      // caller, which read as belonging to the strip rather than to the page.
      //
      // The clip is overflow-hidden and not a scroller. A presented file's card
      // already owns a scroller inside its pane, and a scrollbar inside a
      // scrollbar is the shape both this file and the house style refuse; the
      // guide has no inner scroller, but two blocks on one page that clip the
      // same way and expand the same way are worth more than one of them
      // scrolling because it could.
      clipOpen: {},
      clipTall: {},
      clipExpanded(key) { return !!this.clipOpen[key]; },
      toggleClip(key) { this.clipOpen = { ...this.clipOpen, [key]: !this.clipOpen[key] }; },

      // WHETHER THERE IS ANYTHING MORE, measured rather than assumed. A card
      // whose content fits under the clip drew the fade anyway and offered
      // "more" over empty space, which is a control that lies about what it
      // does. The observer is on the clip, so it re-answers when the card's own
      // tab changes and the content under it changes height.
      watchClip(el, key) {
        if (!window.ResizeObserver) { this.clipTall = { ...this.clipTall, [key]: true }; return; }
        const set = () => {
          const tall = el.scrollHeight > el.clientHeight + 4;
          if (!!this.clipTall[key] !== tall) this.clipTall = { ...this.clipTall, [key]: tall };
        };
        const ro = new ResizeObserver(set);
        ro.observe(el);
        for (const c of el.children) ro.observe(c);
        this._clipObs = (this._clipObs || []).concat(ro);
        set();
      },

      // ── Which panel of the strip is showing ───────────────────────────────
      //
      // Read off the scroll position rather than owned, because the scrolling
      // is the browser's: a swipe, a trackpad, a smooth scrollTo from a dot,
      // and a resize that re-lays the strip all move it, and only one of those
      // passes through code here. So `at` follows the strip and never
      // drives it.
      //
      // NEAREST PANEL, not scrollLeft over width. The panels have a gap
      // between them, so a division is off by a panel by the third one, and a
      // partly-swiped strip has no index at all under that reading. Measuring
      // each panel against the strip answers both, and costs three rects on a
      // scroll of a three-panel strip.
      at: 0,
      listOpen: false,
      swipeHovered: false,
      // Paths whose card has mounted. A card mounts when the swiper comes
      // within one slide of it and then stays, so swiping back is instant and
      // a reader's scroll position inside a card survives.
      mounted: {},
      get swipeFiles() { return [...this.reviewableFiles, ...this.listFiles]; },
      // The card in view, whose controls the header draws. Read off the DOM,
      // so `_chromeTick` is what makes the header look again: a card bumps it
      // whenever its controls change, and a slide mounting bumps it too.
      _chromeTick: 0,
      get card() {
        this._chromeTick; this.at;
        const el = this.panels()[this.at]?.querySelector('[x-data^="fileReview"]');
        return el && el._x_dataStack ? window.Alpine.$data(el) : null;
      },
      markNear() {
        const files = this.swipeFiles;
        for (let i = Math.max(0, this.at - 1); i <= Math.min(files.length - 1, this.at + 1); i++) {
          if (!this.mounted[files[i].path]) this.mounted[files[i].path] = true;
        }
        this.$nextTick(() => { this._chromeTick++; });
      },
      // NOT el.children: x-for leaves its <template> in the DOM as an anchor.
      panels() {
        const el = this.$refs.swipeStrip;
        return el ? [...el.querySelectorAll(':scope > [data-slide]')] : [];
      },
      stripScroll() {
        const el = this.$refs.swipeStrip;
        if (!el) return;
        // The panel nearest the strip's left edge; panels have a gap between
        // them, so scrollLeft over width drifts by the third one.
        const x0 = el.getBoundingClientRect().left;
        let best = 0, near = Infinity;
        this.panels().forEach((k, i) => {
          const d = Math.abs(k.getBoundingClientRect().left - x0);
          if (d < near) { near = d; best = i; }
        });
        if (this.at !== best) this.at = best;
      },
      // Set `at` here as well as on the scroll it starts: a scroll already at
      // its target fires no scroll event. `jump` skips the smooth scroll, for
      // a pick from the list, where animating past twenty slides is noise.
      go(i, jump = false) {
        const n = this.swipeFiles.length;
        if (!n) return;
        i = Math.max(0, Math.min(n - 1, i));
        this.at = i;
        const el = this.$refs.swipeStrip, k = this.panels()[i];
        if (!el || !k) return;
        const x = k.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
        if (el.scrollTo) el.scrollTo({ left: x, behavior: jump ? 'instant' : 'smooth' });
        else el.scrollLeft = x;
      },

      // ── Saying which document is being read ───────────────────────────────
      //
      // The strip is a container holding several documents, and which one is
      // showing is chosen INSIDE this page rather than by its address. Nothing
      // above can derive it: the sidebar's layer strip walks the live frame
      // stack, and a markdown panel is a div in this document rather than a
      // frame, so the walk reaches this page and stops one level short of what
      // the reader is on.
      //
      // So the container says so, on the subject channel the file deck already
      // speaks, with the same `route: 'deck'` that means an in-document
      // subject. This is the job a self-describing markdown file would have
      // been for, and it belongs to the container instead: everything an
      // announcement carries (repo, ref, path, base) is known to whoever
      // fetched the file and is not in the file, and a convention living in
      // content would work only on files this estate wrote, which is the
      // opposite of what this page is for.
      //
      // WHAT IT BUYS is the sidebar's compare bar. That bar is gated on a
      // subject having announced a BASE, and this page announced nothing while
      // mounting up to three reading cards that each subscribe to the answer on
      // web-tools:compare-ref. The listeners were wired and the one control
      // that drives them was hidden.
      //
      // FRAMED, IT REPORTS RATHER THAN ANNOUNCES, through `onSubject`. As a
      // slide of show-repo's branch deck three of these are mounted at once and
      // none can tell which one the reader is on, so a slide that announced for
      // itself would be one of three racing. Worse than the race is the
      // RESTORE: a channel snapshots at open and puts the snapshot back on
      // release, and with three overlapping lifetimes a slide being left can
      // restore over the slide being arrived at. Both go away when the deck
      // owns one channel and each slide only says what it is showing, which is
      // how kits/file-deck.js has always done it. `onSubject` is the mirror of
      // `onMeta`: what only the slide knows, going up to whoever can act on it.
      get subject() {
        // The reviewable file in view, or the last one passed: code slides
        // follow the reviewable ones and carry no document to compare.
        const f = this.reviewableFiles[Math.min(this.at, this.reviewableFiles.length - 1)];
        if (!f) return null;
        // `base` and `baseName` are both the branch name here, as openFileDeck
        // already passes them: this page compares against a branch, not against
        // a computed merge base, and the pair travels so a reader is told the
        // same string a client fetches.
        return { repo: this.repo, ref: this.branch, path: f.path, route: 'deck',
                 base: this.cmpBase, baseName: this.cmpBaseName };
      },
      get subjectKey() {
        const s = this.subject;
        return s ? [s.repo, s.ref, s.path, s.base].join('|') : '';
      },
      // A deck OVER this page owns the subject while it is up. It opens its own
      // channel, which snapshots this announcement and puts it back on close,
      // so announcing underneath would overwrite the slide the reader is
      // actually on. That is reachable rather than theoretical: openFileDeck
      // awaits the compare with the deck already built, and the compare landing
      // is exactly what moves this key.
      async announceSubject() {
        if (this._gone) return;
        // A host that mounts this owns the channel, so the report goes up
        // whatever the deck stack is doing: which slide is active, and whether
        // a file deck is drilled over it, are both the host's to know.
        if (this.framed) { if (o.onSubject) o.onSubject(this.subject); return; }
        if (window.swipeDeck?.top()) return;
        if (!this.subject) {
          // Nothing reviewable: hand the drawer back to the page itself rather
          // than leaving it pointed at a document that is no longer on screen.
          this._chan?.release(); this._chan = null;
          return;
        }
        if (!this._chan) {
          if (!window.subjectChannel && window.gh?.load) {
            // One load however many keys arrive during it, and every caller
            // waits on the same trip rather than opening a second channel.
            this._chanLoad = this._chanLoad || window.gh.load('kits/subject-channel.js');
            try { await this._chanLoad; } catch (e) { return; }
          }
          // Every precondition again: the load is a trip, and the reader may
          // have left, opened the deck, or filtered the strip empty during it.
          if (!window.subjectChannel || this._gone || window.swipeDeck?.top()) return;
          if (!this.subject) return;
          // BRIDGED, because the answer comes back on a window this view may
          // not be in. Inside a toss it runs in the FRAME and the fab that
          // hears the announcement is the shell's, so the pair that fab
          // publishes is dispatched one window up from the cards reading it.
          // A toss is how branch work is looked at before it merges, so this is
          // the case that matters rather than the exotic one.
          if (!this._chan) this._chan = window.subjectChannel.open({ bridge: true });
        }
        const s = this.subject;
        if (s) this._chan.announce(s);
      },

      // The observers go with the component. This view is mounted PER SLIDE in
      // show-repo's branch deck, so a reader stepping through twenty branches
      // would otherwise leave twenty sets of them observing detached nodes.
      destroy() {
        for (const ro of this._clipObs || []) ro.disconnect();
        this._clipObs = [];
        this._gone = true;
        if (this._onKey && typeof window !== 'undefined') {
          window.removeEventListener('keydown', this._onKey, true);
          this._onKey = null;
        }
        // Puts back whatever was the subject before this view claimed it, and
        // clears the bridge with it. Releasing twice is a no-op, so the flag
        // above is about the open in flight rather than about this line.
        this._chan?.release(); this._chan = null;
      },
    };
  });
  };
  if (window.Alpine?.directive) register();
  else document.addEventListener('alpine:init', register);
})();
