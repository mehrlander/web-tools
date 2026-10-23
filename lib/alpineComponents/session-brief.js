// alpineComponents/session-brief.js — one recorded session as a page.
//
// The sibling of alpineComponents/branch-brief.js, and deliberately the same
// shape, because the two answer the same kind of question about two different
// objects: what is this thing, and what is inside it. A reader who has learned
// where the deck button sits on a branch should find it in the same place on a
// session.
//
// This markup lived inside pages/session.html until 2026-08-27. Moving it here
// changes nothing about that page and adds the host it could not have: the app's
// Sessions pane mounts one per slide, directly, in the shell's own Alpine, so a
// session can be swiped through the way a branch already is. That is the whole
// reason for the lift; branch-brief.js took the same step on 2026-08-13 and its
// header records why an iframe was the wrong way to do it.
//
// A host passes:
//   id        the record's short id: the eight hex characters that END its
//             filename, not the whole stem, which carries the date as well
//   day       the day it started, which with `id` derives the store path
//   path      the store path outright, when the host already knows it
//   branch    a branch name; opens that branch's latest session (resolveBranch)
//   repo      the store, defaulting to the private one below
//   record    a record already in hand; nothing is fetched
//   framed    true to say the host supplies the identity chrome
//   compact   show the discussion search and its excerpts, without the overview
//   fixedFind keep a compact reader tied to the host's submitted query
//   matchNote plain text for a compact search with no matching captured prose
//   pages     render chips for what this session's branches changed, lent by a
//             host that can join a record to the crawl (see the Look row)
//   facts     what the host already knows, so the head is right before the
//             read lands (see `factsRecord`)
//   warm      neighbours worth reading ahead: [{ id, day, path }]
//   onMeta    called with what only a finished read knows
//   pane      'outline' | 'files' | 'raw' | 'calls'
//   fileHref  (checkoutPath, record) => url, for the Files pane; see fileHref
//   start     open the card deck on this card, once loaded
//   find      find captured prose in this session after loading
//   onFind    called with the submitted query, for an address-owning host
//   onMatches called after a read or query change with exact local match counts
//   onOpen    called with the full source deck, for a host that owns its lifetime
//
// `facts` is the same contract branch-brief states and exists for the same
// reason: the app's sessions cache holds every number on the strip, so a
// slide can render its head immediately and only the outline waits on the JSON.
// A cold pages/session.html has no such row and shows the strip when the record
// arrives, which is the only thing it could do.
(function () {
  // The store. Overridable per mount so this is not welded to one repo, which
  // is the same courtesy pages/session.html paid before the lift.
  const STORE = 'mehrlander/web-tools-private';

  // Records already read, keyed by store and path. Module scope, not component
  // state, because the deck reuses one mount per slide and a record is a
  // property of the session rather than of the visit: stepping back to a slide
  // must not refetch it.
  //
  // A TTL at all, on a store whose records are written once and never revisited?
  // For exactly one record: the LIVE session's, which is rewritten and
  // republished on every Stop. Everything else is frozen and the expiry costs a
  // conditional request nobody notices. Same minute branch-brief uses.
  const RECORDS = new Map();          // [repo, path] -> { at, promise }
  const TTL_MS = 60000;

  // The store's own listing, for resolving a short id to a path. One recursive
  // tree read names every record, so a deck of twenty sessions addressed by id
  // pays for it once rather than twenty times. Keyed by repo, same expiry.
  const LISTINGS = new Map();         // repo -> { at, promise }

  // Gemini's topics file for a record (sessions/topics/ in the store, on the
  // `background` branch the laptop daemon writes): the session's title,
  // summary and agenda, and a summary of every turn. Read here rather than
  // taken from the host, for two reasons. The host's copy is the rollup,
  // state/session-topics.json, which carries no turns. And a deep link into
  // the Sessions swiper opened it before the rollup was joined, so the slide
  // had no summary and the header named the session by its branch, "HEAD"
  // (reported 2026-10-22). Same memo, same expiry, as RECORDS.
  const TOPICS = new Map();           // [repo, path] -> { at, promise }
  // How long a slide's outline waits for that file before it is built without
  // it. Built once with the summaries, not once bare and again when they land:
  // a swiper builds three slides at a time, and on a phone the second build of
  // three large records was a spike of its own beside a page already near
  // Safari's memory ceiling (a crash on 2026-10-22 that did not recur). A file
  // slower than this still arrives, and the outline is rebuilt for it.
  const TOPICS_WAIT_MS = 1500;

  // How far back a branch walk reads before giving up (see resolveBranch). A
  // ceiling on a loop that opens whole records, not a claim about the store: a
  // branch whose session is 25 records back is one nobody is holding on a phone
  // waiting to hear, and the error names the number it looked at.
  const WALK_CAP = 25;

  // WHAT A CLIPBOARD HOLDS, REDUCED TO A BRANCH NAME. The Claude app copies the
  // branch a session is on and nothing else about it, but what it copies has
  // varied: a bare name, a full ref, a GitHub tree or compare URL, a branch.html
  // address, or the name with a caption line under it. All of them reduce here,
  // so a shortcut passing a clipboard straight through does not have to know
  // which one it got.
  //
  // The same reduction lives in lib/ops/session-menu.js as `branchOf`, and that
  // copy cannot import this one: an op is a single standalone function that a
  // phone evaluates with no page around it. Two copies on purpose; change one
  // and change the other.
  //
  // ONE RULE IS DELIBERATELY NOT SHARED. The op also demands a `/` in the
  // result, because it is guessing whether a clipboard holds a branch at all
  // and needs a way to say no. Here the caller has already said it does, so a
  // slashless branch name is honoured rather than thrown away.
  function branchOf(text) {
    return String(text || '').trim().split(/\r?\n/)[0].trim()
      .replace(/^.*?(?:tree\/|compare\/|branch\.html#gh=[^@]+@|branch=)/, '')
      .replace(/^origin\//, '').replace(/^refs\/heads\//, '')
      .replace(/[?#&].*$/, '').replace(/\/$/, '');
  }

  // Every branch a record knows the session worked: each checkout's branch as of
  // the record's last write (`repos`), then every branch it pushed (`pushed`,
  // record schema 15). `repos` alone holds one branch per checkout, so a
  // session that worked several in one repo, or ended back on main, showed
  // fewer than it pushed: 15 of 54 records from 2026-09-29 to 2026-10-12.
  function sessionBranches(rec) {
    const seen = new Set(), out = [];
    for (const r of [...(rec?.repos || []), ...(rec?.pushed || [])]) {
      if (!r || !r.name || !r.branch || /^(main|master|HEAD)$/.test(r.branch)) continue;
      const k = r.name + '\u0000' + r.branch;
      if (!seen.has(k)) { seen.add(k); out.push({ name: r.name, branch: r.branch }); }
    }
    return out;
  }

  const register = function () {
  Alpine.data('sessionBrief', function (opts) {
    const o = opts || {};

    return {
      description: 'One captured session as a page: its facts, its outline, and the deck that reads it',

      id: o.id || '',
      day: o.day || '',
      repo: o.repo || STORE,
      path: o.path || '',
      // The branch to find a session FOR, resolved once at load. Not a filter:
      // the record it lands on is the whole subject of the mount.
      branch: o.branch || '',
      framed: !!o.framed,
      // Framed, or a standalone page on a desktop: the panes scroll inside a
      // shell the viewport's height (see the shell's own note). Read once at
      // mount, since the outline is built for one scroll model or the other.
      boxed: !!o.framed || (typeof matchMedia === 'function'
        && matchMedia('(min-width: 768px) and (hover: hover)').matches),
      // The shell's height when boxed standalone: the viewport less whatever
      // the host draws above it (the page's address bar), measured at mount.
      boxHeight: '100dvh',
      compact: !!o.compact,
      fixedFind: !!o.fixedFind,
      matchNote: String(o.matchNote || ''),
      facts: o.facts || null,
      // Gemini's topics file for this record, once read (see readTopics), and
      // how that read went: '' not tried, 'reading', 'found', 'none' (no file,
      // a 404) or 'unread' (anything else). The difference between the last
      // two is the difference between "not summarized" and "could not tell".
      topics: null,
      topicsState: '',
      // Each scope repository's declared icon, by short name (see loadMarks).
      marks: {},
      // The facts panel-tip: the breakdown behind a strip glyph.
      factTip: null, factTipClose: '', _factTimer: null, _factWired: false,
      // Notes on what is on screen (see openNotes). `noteAbout` is the chosen
      // target's key, or 'auto' for the first one offered.
      notes: [], noteText: '', noteAbout: 'auto', noteMsg: '', noteFailed: false,
      noteClearArmed: false, _noteMsgT: 0,

      record: inert(o.record) || null,
      loading: false,
      err: '',
      pane: !o.compact && ['raw', 'files', 'calls', 'views'].includes(o.pane) ? o.pane : 'outline',
      rawBuilt: false,
      outlineBuilt: false,
      deckOpening: false,
      findText: String(o.find || ''),
      findQuery: '',
      findResult: { terms: [], hits: [], total: 0, occurrenceTotal: 0, matchedTerms: [], allTerms: false },
      findAt: 0,
      findCopied: -1,
      findCopyError: '',
      // The Now section's data: fetched by loadWork, standalone only.
      work: { loading: false, loaded: false, branches: [], views: [], asks: [], last: null, err: '' },
      lastOpen: false,
      // The viewables strip's position, read off the scroll as in branch-brief.
      vAt: 0, viewListOpen: false, _aim: -1, _aimT: 0,
      // The action message (sessions/tools/now.py in the record store), read
      // from `nowRef`, main unless the address names another ref.
      // The component reads `now` off the address itself as well as taking it
      // from the host, because a `?use=` preview swaps this bundle and not the
      // host page: a host on main never learned to pass it along.
      now: null, nowErr: '', nowOpen: false, answers: [], answering: null,
      calls: [], callAnswers: {}, callsLoading: false,
      callSending: {}, callErr: {}, callArmed: '', _callArmT: 0, callNotes: {},
      nowRef: o.nowRef || (() => {
        try {
          const h = new URLSearchParams((location.hash || '').replace(/^#/, ''));
          return h.get('now') || new URLSearchParams(location.search).get('now') || 'main';
        } catch { return 'main'; }
      })(),
      viewPeek: null, _peekTimer: null,
      vSeen: {},

      template: `
        <!-- WHERE THE SCROLLBAR IS, and it is two different answers.
             Framed, this is a slide and scrolls inside itself: the facts strip
             and the tab row hold their place while the pane under them moves.
             Standalone it is a page and scrolls as one, for the reason
             branch-brief states: a page that pins its own header costs a phone
             its URL-bar collapse.

             What branch-brief's argument does not settle is the CHROME, and
             this view has more of it than a branch does. Document scroll took
             the tab row, the outline's own Cards chips and its export bar away
             with the head, because all three were built to pin above or below
             a pane that is a viewport. Measured 2026-09-04 at 390x844: 429px of
             head before the outline began, and at the bottom of the scroll the
             tabs 189px above the fold; Raw laid its 243 KB out as a single
             40,528px block, 48 screens with no control on any of them; and Pick
             all revealed an export bar at y=1456, 612px BELOW the fold, with
             nothing on screen to say it was there.

             So the page keeps document scroll and the chrome goes STICKY, which
             is the house style's shape for a page another page may embed
             (html-style rule 5). The head is content and still scrolls away;
             only the row that operates the pane stays. -->
        <!-- FULL WIDTH, NO CAP. This carried mx-auto and max-w-2xl, so a desktop
             browser drew a phone's column down the middle of the screen with
             the rest empty. The house style names that pattern outright (rule
             3), and the estate's own branch list already made the same call
             once nothing stood beside it to claim the space. A row here is a
             wide thing for the same reason a branch row is: an ask, an answer,
             a clock, a turn count and a tool tally all read across. -->
        <!-- BOXED ON A DESKTOP (2026-10-22): the shell is the viewport's
             height and the pane under the tabs scrolls inside itself, as a
             framed slide's does, so the page never scrolls as a whole. Phones
             keep document scroll, for branch-brief's reason: a page that pins
             its own header costs a phone its address-bar collapse. -->
        <div class="w-full flex flex-col gap-2.5 px-4 pt-3"
             :class="framed ? 'h-full min-h-0 pb-0' : boxed ? 'min-h-0 pb-0 overflow-hidden' : 'pb-4'"
             :style="boxed && !framed ? { height: boxHeight } : null">

          <div x-show="err" class="alert alert-warning shrink-0" x-text="err"></div>

          <!-- The title, and the id beside it. Framed, the deck header already
               carries both, so this line goes rather than being repeated at
               half width in two places; the same rule branch-brief applies to
               a branch name.

               ONE LINE, AND THE ID KEPT OUT OF THE WRAP. sessionRender.describe
               derives the title from the session's OPENING ASK, which the
               outline then prints again as card 1's own row a couple of hundred
               pixels below: at two lines that duplication cost 74px of a 932px
               phone to say the same sentence twice. Truncated it still names
               the session, which is all a heading over its own outline has to
               do. A flex row with a shrink-0 id is what keeps the stem on the
               line rather than wrapping alone under it, which is what a margin
               on an inline span did once the title filled the row. -->
          <!-- THE HEAD SIZES TO ITS CONTENT, AND THE TABS FOLLOW IT. From
               2026-10-13 the head and the Now section shared a column exactly
               one viewport tall whenever there were views, and the viewables
               card filled what was left, so the tabs and the transcript began
               a screen down. The owner read that as two big containers on a
               page built for one (2026-10-22): the viewables are a tab now
               (pane 'views'), and nothing here is sized to the screen. -->
          <template x-if="!compact">
          <div class="flex flex-col gap-2.5">
          <div x-show="!framed" class="shrink-0 flex items-baseline gap-1.5 text-base font-medium leading-snug">
            <span class="truncate" x-text="head.title"></span>
            <span class="shrink-0 font-mono text-xs font-normal opacity-45"
                  data-title-tip="The eight hex characters that end the record's filename, and how every other surface names this session."
                  x-text="'(' + (shortId || '') + ')'"></span>
            <!-- WHICH COPY OF THIS PAGE IS RUNNING. Everything else in this
                 head describes the SESSION; this describes the code doing the
                 describing, and without it a reader has no way to tell a branch
                 preview from the deployed page except through the FAB drawer,
                 which is one tap they may not have (branch.html grew the same
                 marker on 2026-09-04, after three rounds were lost to exactly
                 that). Framed it goes with the title, since a host that draws
                 the identity carries its own. -->
            <span class="ml-1.5 shrink-0 whitespace-nowrap font-mono text-sm font-normal opacity-45"
                  data-title-tip="The ref this page's own code booted from. That is the page, not the session it is describing."
                  x-text="'· running ' + codeRef"></span>
          </div>

          <!-- WHAT GEMINI MADE OF IT: the summary and topics the follow-up
               wrote, from the session's own topics file (web-tools-private
               sessions/topics/ on background, see readTopics) once it is read,
               and from the host's row until then. The standalone page has no
               row, so it shows them only once the file arrives. -->
          <!-- THREE LINES, A TAP FOR THE REST: "two or three sentences" ran
               to four and about 250px of a 932px phone on the first real
               one, which is the budget this head is measured against. The
               provenance note rides a mark at the start, where the clamp
               cannot hide it, rather than the whole paragraph, since
               title-tip underlines whatever carries it. -->
          <div x-show="gist.summary || gist.list.length" class="shrink-0 flex flex-col gap-1.5">
            <p x-show="gist.summary" x-data="{ more: false }" @click="more = !more"
               class="text-base leading-snug text-base-content/80 cursor-pointer"
               :class="more ? '' : 'line-clamp-3'">
              <span class="mr-1 inline-block align-[-1px] text-base-content/45" x-html="geminiGlyph()"
                    data-title-tip="Written by Gemini from the session record; not part of the record."></span>
              <span x-text="gist.summary"></span>
            </p>
            <!-- THE TOPICS AS A LIST, which is what the head is for: what did
                 this session actually work on. One line a topic, in the order
                 the session reached it, and a tap scrolls the outline to where
                 it starts, under the same header the outline draws there. The
                 mark is how the topic's last stretch ENDED (the closing state
                 said inside it), so an unfinished one reads as unfinished
                 before anything is opened; a dot where it ended on nothing.
                 Minor asides are left to the outline's headers. They were
                 rounded mono pills until 2026-10-02, which read as tags and
                 wrapped a 430px head to three lines for three topics. -->
            <ol x-show="gist.list.length" x-data="{ all: false }" class="flex flex-col">
              <template x-for="t in (all ? gist.list : gist.list.slice(0, 6))" :key="t.topic">
                <li>
                  <button type="button" @click="goTopic(t)" :disabled="t.first < 0"
                          :data-title-tip="topicTip(t)"
                          class="flex w-full items-baseline gap-2 rounded px-1 -mx-1 py-0.5 text-left
                                 enabled:hover:bg-base-200/70 enabled:cursor-pointer">
                    <span class="w-4 shrink-0 text-center text-sm"
                          :class="!t.state && 'text-base-content/30'"
                          x-text="t.state ? t.state.glyph : '\u00b7'"></span>
                    <span class="min-w-0 grow line-clamp-2 text-[15px] leading-snug" x-text="t.topic"></span>
                    <span class="shrink-0 font-mono text-xs text-base-content/45" x-text="topicMeta(t)"></span>
                  </button>
                </li>
              </template>
              <li x-show="!all && gist.list.length > 6">
                <button type="button" @click="all = true"
                        class="pl-6 text-sm text-base-content/50 hover:text-base-content/80"
                        x-text="(gist.list.length - 6) + ' more'"></button>
              </li>
            </ol>
          </div>

          <!-- The facts strip, drawn from whatever is known: the host's row
               while the record is in flight, the record itself once it lands.
               One implementation, two fidelities, so a slide never shows an
               empty strip and then a full one. -->
          <!-- GLYPHS WHERE THE SESSIONS ROW HAS THEM (2026-10-22). The Activity
               view's Sessions row draws these counts as a wrench, a fan-out
               tree and each repository's own mark, and each count is a button
               that opens the breakdown behind it. This strip drew the same
               facts as words, "72 tool calls · 0 failed · home, web-tools,
               web-tools-private", which wrapped to three lines at 430px and
               opened nothing. A date reads as a date and 1h 43m as a duration,
               so those two stay text; a bare 72 does not read as calls, which
               is what the glyph is for, and the panel under it names the unit
               in words.

               FAILURES FOLLOW THE ROW'S RULE: they ride the wrench's panel,
               which states a measured zero as "none failed", and take a place
               on the strip only when there are some. A zero on the strip spent
               a fact's width on the ordinary case.

               EVERY TEXT FACT STILL CARRIES ITS DEFINITION through
               kits/title-tip.js, for the reason it always did: a title reaches
               no touch screen and no screenshot. A glyph fact carries its words
               in its panel instead, since a hover opens the panel and a title-tip
               on the same control would draw a second box over it.

               ONE WRAPPING ROW, not a column of lines. -->
          <div class="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-[13px] shrink-0">
            <template x-for="(f, i) in strip" :key="f.k">
              <span class="inline-flex items-center whitespace-nowrap">
                <!-- A counted fact is a CONTROL: tap pins its panel, a hover
                     opens it where the pointer is fine. Several facts open the
                     same panel (calls, failures and agents are all the tool
                     list), as the Sessions row's agents count opens its tools
                     card. -->
                <template x-if="f.panel && f.k !== 'repos'">
                  <button type="button" data-fact-btn
                          @click="toggleFactTip(f.panel, $el)"
                          @mouseenter="hoverFactTip(f.panel, $el)" @mouseleave="leaveFactTip()"
                          class="-my-0.5 inline-flex items-center gap-1 rounded px-0.5 tabular-nums transition-colors hover:text-primary"
                          :class="f.tone || 'text-base-content/75'"
                          :aria-label="f.v + ' ' + f.t">
                    <i x-show="f.icon" class="ph text-base leading-none opacity-70" :class="f.icon"></i><span x-text="f.v"></span></button>
                </template>
                <!-- THE SCOPE AS ONE PILL: each repository's own icon, declared
                     in its .web-tools.json (see loadMarks), which is how the
                     Sessions row and the branch chips below already draw it,
                     grouped so the set reads as one fact. A tap opens the
                     checkouts panel, which lists them with what the session
                     committed to each; it was a title-tip reading "Checked out:"
                     and the names for an hour, until the owner asked for the
                     structure the tools panel has (2026-10-22).

                     A microphone rode the end of this fact until the same day:
                     it opened pages/dictate.html with these repositories
                     chosen, to start a follow-up session. The owner had not
                     used it, and a note about what is on screen is the FAB's
                     Note tab, which every page has. -->
                <template x-if="f.k === 'repos'">
                  <button type="button" data-fact-btn data-scope-pill
                          @click="toggleFactTip('scope', $el)"
                          @mouseenter="hoverFactTip('scope', $el)" @mouseleave="leaveFactTip()"
                          class="-my-0.5 inline-flex items-center gap-1.5 rounded-full bg-base-200/70 px-2 py-0.5
                                 text-base-content/60 transition-colors hover:text-primary"
                          :aria-label="'Checked out: ' + scopeNames">
                    <!-- DECLARED MARKS, THEN A COUNT. A repository that declares no
                         icon drew the neutral bookmark, and bb88ffa7's nine
                         checkouts drew six of them in a row on a phone (owner,
                         2026-10-22); they are a number now, and the panel names
                         them. -->
                    <template x-for="n in scopeMarked" :key="n">
                      <i class="ph text-base leading-none" :class="marks[n]"></i>
                    </template>
                    <i x-show="!scopeMarked.length" class="ph ph-folders text-base leading-none"></i>
                    <span x-show="scopeRepos.length > scopeMarked.length" class="font-mono text-xs tabular-nums"
                          x-text="(scopeMarked.length ? '+' : '') + (scopeRepos.length - scopeMarked.length)"></span>
                  </button>
                </template>
                <template x-if="!f.panel && f.k !== 'repos'">
                  <!-- A REAL SPACE between value and unit, not a margin, so a
                       screen reader, a copy and the tests read "40 calls"
                       rather than "40calls". -->
                  <span :data-title-tip="f.t">
                    <span x-text="f.v"></span>
                    <span x-show="f.unit" class="opacity-55" x-text="f.unit"></span>
                  </span>
                </template>
                <!-- TRAILING, NEVER LEADING. Led, the dot rides the fact it
                     precedes, so a wrap took the separator down with it and
                     line 2 opened on a bullet. None between two glyph counts,
                     which the glyphs already separate, as on the Sessions row;
                     and the last fact keeps its dot when the Gemini mark
                     follows it. -->
                <span x-show="i < strip.length - 1 ? !(f.panel && strip[i + 1].panel) : !!gemini"
                      class="opacity-25 ml-2.5" aria-hidden="true">&middot;</span>
              </span>
            </template>
            <!-- ── HOW FAR GEMINI HAS READ ──────────────────────────────────
                 The summary and the topics above are Gemini's, made by a poller
                 on the laptop some minutes after the record moves, and nothing
                 on the page said whether they had caught up. They had not on the
                 session that prompted this: six turns in the record, five in
                 the summary, and the head read as complete. A check when every
                 turn is summarized from the record on screen; otherwise the
                 fraction, amber; the panel lists each turn and what Gemini made
                 of it. See the gemini getter for what is and is not judged. -->
            <template x-if="gemini">
              <button type="button" data-fact-btn data-gemini-mark
                      @click="toggleFactTip('gemini', $el)"
                      @mouseenter="hoverFactTip('gemini', $el)" @mouseleave="leaveFactTip()"
                      class="-my-0.5 inline-flex items-center gap-1 rounded px-0.5 tabular-nums transition-colors hover:text-primary"
                      :class="gemini.tone" :aria-label="gemini.tip">
                <span class="inline-flex" x-html="geminiGlyph()"></span>
                <i x-show="gemini.icon" class="ph text-sm leading-none" :class="gemini.icon"></i>
                <span x-show="gemini.label" x-text="gemini.label"></span></button>
            </template>
          </div>

          <!-- The facts panel-tip: the breakdown behind a strip glyph, on the
               branch panel-tip's machinery below (kits/panel-tip.js owns the
               way out). Every number in it is already in the record or in
               Gemini's file, so it is complete in its first frame. -->
          <div x-ref="factTip" x-show="factTip" role="dialog" data-fact-tip
               :aria-label="({ gemini: 'Gemini summaries', scope: 'Checkouts', notes: 'Notes', time: 'When it ran' })[factTip?.kind] || 'Tool calls'"
               @mouseenter="clearTimeout(_factTimer)" @mouseleave="leaveFactTip()"
               class="fixed z-[1000] rounded-xl border border-base-300 bg-base-100 shadow-lg overflow-y-auto"
               :style="factTip ? 'left:' + factTip.x + 'px;top:' + factTip.y + 'px;width:' + factTip.w + 'px;max-height:' + factTip.mh + 'px' : ''">
            <div x-html="factTipClose"></div>
            <template x-if="factTip && factTip.kind === 'tools'">
              <div class="flex flex-col" :class="factTipClose && 'pr-7'">
                <div class="flex items-baseline gap-2 px-3 pt-2.5 pb-2 border-b border-base-200">
                  <i class="ph ph-wrench text-base self-center text-base-content/50"></i>
                  <span class="font-mono font-semibold tabular-nums" x-text="toolTally.calls"></span>
                  <span class="text-sm text-base-content/70">tool calls</span>
                  <span class="text-sm" :class="toolTally.failures ? 'text-warning' : 'text-base-content/45'"
                        x-text="toolTally.failures ? toolTally.failures + ' failed' : 'none failed'"></span>
                </div>
                <div class="flex flex-col py-1">
                  <template x-for="t in toolTally.rows" :key="t.name">
                    <div class="flex items-baseline gap-2 px-3 py-1 text-sm">
                      <span class="min-w-0 flex-1 truncate text-base-content/85" x-text="t.name"></span>
                      <span x-show="t.failed" class="shrink-0 font-mono text-xs text-warning" x-text="t.failed + ' failed'"></span>
                      <span class="shrink-0 font-mono tabular-nums text-base-content/55" x-text="t.n.toLocaleString()"></span>
                    </div>
                  </template>
                </div>
                <template x-if="toolTally.agents.length">
                  <div class="flex flex-col pb-1 border-t border-base-200">
                    <div class="flex items-baseline gap-2 px-3 pt-2 pb-1">
                      <i class="ph ph-tree-structure text-base self-center text-base-content/50"></i>
                      <span class="font-mono font-semibold tabular-nums" x-text="toolTally.agents.length"></span>
                      <span class="text-sm text-base-content/70"
                            x-text="toolTally.agents.length === 1 ? 'subagent' : 'subagents'"></span>
                    </div>
                    <template x-for="(a, j) in toolTally.agents" :key="j">
                      <div class="flex items-baseline gap-2 px-3 py-1 text-sm">
                        <span class="min-w-0 flex-1 truncate text-base-content/85" x-text="a.label"></span>
                        <span class="shrink-0 font-mono text-xs text-base-content/45" x-text="a.type"></span>
                        <span class="shrink-0 font-mono tabular-nums text-base-content/55" x-text="a.calls"></span>
                      </div>
                    </template>
                  </div>
                </template>
                <p x-show="toolTally.note" class="px-3 pt-1 pb-2.5 text-sm text-base-content/50" x-text="toolTally.note"></p>
              </div>
            </template>
            <!-- The checkouts: a group each, the repository's mark and name,
                 then a line per branch with work on it (see scopeRows). -->
            <template x-if="factTip && factTip.kind === 'scope'">
              <div class="flex flex-col" :class="factTipClose && 'pr-7'">
                <div class="flex items-baseline gap-2 px-3 pt-2.5 pb-2 border-b border-base-200">
                  <i class="ph ph-folders text-base self-center text-base-content/50"></i>
                  <span class="font-mono font-semibold tabular-nums" x-text="scopeRows.length"></span>
                  <span class="text-sm text-base-content/70">checked out</span>
                  <span x-show="scopePushed" class="text-sm text-base-content/45"
                        x-text="scopePushed + (scopePushed === 1 ? ' branch pushed' : ' branches pushed')"></span>
                </div>
                <div class="flex flex-col py-1">
                  <template x-for="g in scopeRows" :key="g.name">
                    <div class="flex flex-col px-3 py-1.5" data-scope-row>
                      <div class="flex items-center gap-2.5 text-sm">
                        <i class="ph text-lg shrink-0 text-base-content/60" :class="g.icon"></i>
                        <span class="min-w-0 flex-1 truncate font-medium" x-text="g.name"></span>
                        <span x-show="g.word" class="shrink-0 text-xs" :class="g.tone" x-text="g.word"></span>
                      </div>
                      <template x-for="b in g.branches" :key="b.branch">
                        <div class="flex items-center gap-2 pl-7 pt-1 text-xs" data-scope-branch>
                          <i class="ph ph-git-branch shrink-0 text-base-content/40"></i>
                          <template x-if="b.n >= 0">
                            <button type="button" @click="openBranchAt(b)"
                                    class="min-w-0 flex-1 truncate text-left font-mono text-base-content/60 hover:underline" x-text="b.short"></button>
                          </template>
                          <template x-if="b.n < 0">
                            <a :href="b.url" target="_blank" rel="noopener"
                               class="min-w-0 flex-1 truncate font-mono text-base-content/60 hover:underline" x-text="b.short"></a>
                          </template>
                          <!-- FILES CHANGED, not renderable views (owner,
                               2026-10-22): what a branch did, which the Views
                               tab already narrows to what renders. A tap opens
                               the branch deck on that branch's Files pane. -->
                          <button type="button" x-show="b.files" @click="openBranchAt(b, 'files')" data-branch-files
                                  class="shrink-0 inline-flex items-center gap-1 rounded px-1 font-mono text-base-content/60 hover:bg-base-200 hover:text-primary"
                                  :aria-label="b.files + (b.files === 1 ? ' file changed' : ' files changed')">
                            <i class="ph ph-file"></i><span x-text="b.files"></span></button>
                          <a x-show="b.pr" :href="b.prUrl" target="_blank" rel="noopener"
                             class="shrink-0 rounded-full border px-2 font-mono leading-5 hover:underline"
                             :class="({ draft: 'bg-warning/20 border-warning/60', open: 'bg-success/20 border-success/60',
                                        merged: 'bg-secondary/20 border-secondary/60', closed: 'bg-error/20 border-error/60' })[b.prState] || 'border-base-300'"
                             x-text="'#' + b.pr + ' ' + b.prState"></a>
                          <!-- A PR pill already says the branch was pushed. -->
                          <span x-show="!b.pr" class="shrink-0 inline-flex items-center gap-1" :class="b.tone">
                            <i x-show="b.mark" class="ph" :class="b.mark"></i><span x-text="b.word"></span></span>
                        </div>
                      </template>
                    </div>
                  </template>
                </div>
              </div>
            </template>
            <!-- The notes composer. What the note is about, the note, Add; the
                 notes so far; and the ways out with them. -->
            <template x-if="factTip && factTip.kind === 'notes'">
              <div class="flex flex-col" :class="factTipClose && 'pr-7'" data-notes-panel>
                <div class="flex items-baseline gap-2 px-3 pt-2.5 pb-2 border-b border-base-200">
                  <i class="ph ph-note-pencil text-base self-center text-base-content/50"></i>
                  <span class="font-mono font-semibold tabular-nums" x-text="notes.length"></span>
                  <span class="text-sm text-base-content/70" x-text="notes.length === 1 ? 'note' : 'notes'"></span>
                  <span x-show="noteMsg" class="text-sm" :class="noteFailed ? 'text-warning' : 'text-success'" x-text="noteMsg"></span>
                </div>
                <div class="flex flex-col gap-2 px-3 py-2.5">
                  <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="What the note is about">
                    <template x-for="t in noteTargets" :key="t.key">
                      <button type="button" role="radio" :aria-checked="noteTarget.key === t.key ? 'true' : 'false'"
                              @click="noteAbout = t.key"
                              class="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm"
                              :class="noteTarget.key === t.key ? 'border-primary bg-primary/10 text-primary' : 'border-base-300 hover:bg-base-200'">
                        <span class="truncate" x-text="t.label"></span>
                        <span class="truncate font-mono text-xs opacity-60" x-text="t.sub"></span></button>
                    </template>
                  </div>
                  <textarea x-ref="noteTa" x-model="noteText" rows="3" placeholder="A note on this"
                            @keydown.enter="if ($event.metaKey || $event.ctrlKey) { $event.preventDefault(); addNote(); }"
                            class="textarea textarea-bordered w-full text-base leading-snug"></textarea>
                  <div><button type="button" class="btn btn-sm btn-primary" @click="addNote()" :disabled="!noteText.trim()">Add note</button></div>
                </div>
                <ol x-show="notes.length" class="flex flex-col border-t border-base-200 py-1">
                  <template x-for="(n, i) in notes" :key="n.at + ':' + i">
                    <li class="flex items-start gap-2 px-3 py-1.5 text-sm" data-note-row>
                      <div class="min-w-0 grow">
                        <div class="truncate font-mono text-xs text-base-content/50" x-text="n.label"></div>
                        <div class="whitespace-pre-wrap text-base leading-snug" x-text="n.text"></div>
                      </div>
                      <button type="button" class="btn btn-ghost btn-xs btn-square shrink-0" @click="removeNote(i)"
                              aria-label="Remove this note"><i class="ph ph-x"></i></button>
                    </li>
                  </template>
                </ol>
                <div x-show="notes.length" class="flex flex-wrap items-center gap-2 px-3 pt-2 pb-2.5 border-t border-base-200">
                  <button type="button" class="btn btn-sm" @click="copyNotes()"><i class="ph ph-copy"></i>Copy as JSON</button>
                  <!-- A real link, so the new tab opens on the tap itself; the
                       copy starts in the same tap, before anything awaits. -->
                  <a x-show="agentUrl" :href="agentUrl" target="_blank" rel="noopener" @click="copyNotes()"
                     class="btn btn-sm btn-ghost">
                    <span class="inline-flex" x-html="window.claudeMark.svg({ cls: 'w-4 h-4 shrink-0' })"></span>Copy and open the session</a>
                  <span class="grow"></span>
                  <button type="button" class="btn btn-sm btn-ghost text-base-content/60" @click="clearNotes()"
                          x-text="noteClearArmed ? 'Clear all?' : 'Clear'"></button>
                </div>
                <!-- Where the clipboard refused, the JSON itself, to select. -->
                <textarea x-show="noteFailed" readonly :value="notesJson()" rows="6"
                          class="textarea textarea-bordered mx-3 mb-2.5 font-mono text-xs"></textarea>
              </div>
            </template>
            <!-- When it ran: the span and the turns in it, when it started and
                 last moved, and on how many days the owner spoke in it. The
                 turns ALONG the span are the outline's rail, which draws every
                 card on the same span; a rail here too drew it twice (owner,
                 2026-10-22). -->
            <template x-if="factTip && factTip.kind === 'time'">
              <div class="flex flex-col" :class="factTipClose && 'pr-7'" data-time-panel>
                <div class="flex items-baseline gap-2 px-3 pt-2.5 pb-2 border-b border-base-200">
                  <i class="ph ph-calendar-blank text-base self-center text-base-content/50"></i>
                  <span class="shrink-0 whitespace-nowrap font-mono font-semibold tabular-nums" x-text="timeFacts.span || '–'"></span>
                  <span class="grow"></span>
                  <!-- The turns the rail below draws, counted where the span
                       is: how long, and how much happened in it. -->
                  <span x-show="timeFacts.turns" class="shrink-0 whitespace-nowrap text-sm text-base-content/70"
                        x-text="plural(timeFacts.turns, 'turn')"></span>
                </div>
                <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                  <dt class="text-base-content/50">Started</dt>
                  <dd x-text="timeFacts.started"></dd>
                  <dt x-show="timeFacts.ended" class="text-base-content/50">Last write</dt>
                  <dd x-show="timeFacts.ended"><span x-text="timeFacts.ended"></span>
                    <span x-show="timeFacts.endedAgo" class="text-base-content/45" x-text="'· ' + timeFacts.endedAgo"></span></dd>
                  <dt x-show="timeFacts.days" class="text-base-content/50">Active on</dt>
                  <dd x-show="timeFacts.days" x-text="plural(timeFacts.days, 'day')"></dd>
                </dl>
              </div>
            </template>
            <template x-if="factTip && factTip.kind === 'gemini' && gemini">
              <div class="flex flex-col" :class="factTipClose && 'pr-7'">
                <div class="flex items-baseline gap-2 px-3 pt-2.5 pb-2 border-b border-base-200">
                  <span class="self-center inline-flex text-base-content/50" x-html="geminiGlyph()"></span>
                  <span class="font-mono font-semibold tabular-nums" x-text="gemini.head.count"></span>
                  <span class="text-sm text-base-content/70" x-text="gemini.head.unit"></span>
                  <span class="badge badge-sm badge-soft self-center" :class="gemini.badge" x-text="gemini.word"></span>
                </div>
                <ol x-show="geminiDetail.rows.length" class="flex flex-col py-1">
                  <template x-for="t in geminiDetail.rows" :key="t.n">
                    <li class="flex items-baseline gap-2 px-3 py-1 text-sm" :data-gemini-turn="t.mark">
                      <span class="w-4 shrink-0 text-right font-mono text-xs tabular-nums text-base-content/40" x-text="t.n"></span>
                      <i class="ph shrink-0 self-center text-sm"
                         :class="({ done: 'ph-check text-success', skipped: 'ph-minus-circle text-warning',
                                    after: 'ph-hourglass-medium text-base-content/40' })[t.mark]"></i>
                      <span class="min-w-0 flex-1 line-clamp-2 leading-snug"
                            :class="t.mark === 'done' ? 'text-base-content/85' : 'italic text-base-content/50'"
                            x-text="t.text"></span>
                      <span x-show="t.clock" class="shrink-0 font-mono text-xs tabular-nums text-base-content/40" x-text="t.clock"></span>
                    </li>
                  </template>
                </ol>
                <div x-show="geminiDetail.lines.length"
                     class="flex flex-col px-3 pt-1.5 pb-2.5 border-t border-base-200 font-mono text-xs leading-5 text-base-content/55">
                  <template x-for="l in geminiDetail.lines" :key="l"><span x-text="l"></span></template>
                </div>
              </div>
            </template>
          </div>
          <!-- ── NOW: where the session's work stands ─────────────────────
               Standalone only; a framed slide keeps the lent Look row below.
               What the session left for the owner: the action message where
               the session wrote one, else its last closing state, and the open
               asks from each branch's PR guide. The branches and what they
               changed are read here too (one compare and PR list per branch),
               and drawn elsewhere: the checkouts panel on the strip and the
               Views tab. User calls are the Calls tab's alone; they were
               listed here as well until the owner asked why (2026-10-22). -->
          <section x-show="!framed && (work.loading || work.last || now || work.err || work.asks.length)"
                   class="shrink-0 flex flex-col gap-2.5 mt-1">
            <!-- ── THE ACTION MESSAGE ─────────────────────────────────────
                 What the owner should act on now, kept as a file beside the
                 session's record (web-tools-private sessions/tools/now.py) and
                 written only when that changes, so churn in the chat never
                 moves it. Collapsed it is the headline and each ask's question
                 with its options; a tap opens the reasons and the links, each
                 link one tap from the thing it names and a hover from a peek.
                 With no file, the chat's last closing line stands in. -->
            <div x-show="now" data-peek-host class="shrink-0 rounded-xl border px-3 py-2 grid gap-1.5 text-base"
                 :class="nowTone(now?.state || 'needs')">
              <div class="flex items-start gap-2 cursor-pointer" @click="nowOpen = !nowOpen">
                <span class="shrink-0 leading-snug" x-text="nowGlyph(now?.state || 'needs')"></span>
                <div class="min-w-0 grow leading-snug">
                  <span class="font-semibold" x-text="nowLabel(now?.state || 'needs') + ':'"></span>
                  <span x-text="now?.headline || ''"></span>
                </div>
                <span class="shrink-0 font-mono text-xs opacity-50 mt-0.5" x-text="now?.updated ? ago(now.updated) : ''"></span>
                <i class="ph shrink-0 mt-1 opacity-50" :class="nowOpen ? 'ph-caret-up' : 'ph-caret-down'"></i>
              </div>
              <div x-show="nowStale" class="text-sm text-warning flex items-center gap-1">
                <i class="ph ph-warning-circle"></i><span>The chat has a newer ask than this message.</span></div>
              <!-- AN ASK IS ANSWERED HERE. A tap on an option opens a confirm
                   with an optional note; Send appends the answer to the
                   message's answers file, and where the ask links a PR, also
                   comments it there, which wakes a session subscribed to it. -->
              <template x-for="a in (now?.asks || [])" :key="a.id">
                <div class="rounded-lg bg-base-100/70 px-2.5 py-1.5 grid gap-1" :class="a.resolved && 'opacity-50'">
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span class="font-medium" :class="a.resolved && 'line-through'" x-text="a.q"></span>
                    <template x-for="o in (a.options || [])" :key="o">
                      <button type="button" @click="startAnswer(a, o)" :disabled="!!a.resolved"
                              class="rounded-full border px-2 text-sm leading-6 transition-colors"
                              :class="(answerFor(a)?.answer || a.resolved?.answer) === o ? 'bg-primary text-primary-content border-primary'
                                      : answering?.ask === a.id && answering?.option === o ? 'bg-primary/20 border-primary/60'
                                      : o === a.recommend ? 'border-primary/60 text-primary hover:bg-primary/10' : 'border-base-300 hover:bg-base-200'"
                              :data-title-tip="o === a.recommend ? 'Recommended' : null" data-title-tip-bare>
                        <i x-show="o === a.recommend" class="ph ph-star-four text-xs"></i> <span x-text="o"></span></button>
                    </template>
                  </div>
                  <div x-show="answerFor(a) && answering?.ask !== a.id" class="text-sm opacity-70 flex flex-wrap items-center gap-x-1.5">
                    <i class="ph ph-check-circle text-success"></i>
                    <span x-text="'Answered ' + (answerFor(a)?.answer || '') + (answerFor(a)?.at ? ' · ' + ago(answerFor(a).at) : '')"></span>
                    <span x-show="answerFor(a)?.note" class="italic" x-text="'“' + (answerFor(a)?.note || '') + '”'"></span>
                    <a x-show="answerFor(a)?.comment" :href="answerFor(a)?.comment" target="_blank" rel="noopener" class="link">comment ↗</a>
                  </div>
                  <template x-if="answering && answering.ask === a.id">
                  <div class="grid gap-1.5 rounded-lg border border-primary/40 bg-base-100 p-2">
                    <div class="text-sm"><span class="opacity-60">Answer:</span> <span class="font-semibold" x-text="answering?.option"></span></div>
                    <input type="text" class="input input-sm input-bordered w-full" placeholder="Add a note (optional)"
                           x-model="answering.note" @keydown.enter="sendAnswer(a)" @keydown.escape="answering = null">
                    <label x-show="askPr(a)" class="flex items-center gap-2 text-sm">
                      <input type="checkbox" class="checkbox checkbox-xs" x-model="answering.comment">
                      <span x-text="'Also comment on ' + (askPr(a)?.label || '') + ', which wakes a subscribed session'"></span></label>
                    <div class="flex items-center gap-2">
                      <button type="button" class="btn btn-sm btn-primary" @click="sendAnswer(a)" :disabled="!!answering?.busy">
                        <span x-show="answering?.busy" class="loading loading-spinner loading-xs"></span>Send</button>
                      <button type="button" class="btn btn-sm btn-ghost" @click="answering = null">Cancel</button>
                      <span x-show="answering?.err" class="text-sm text-error" x-text="answering?.err"></span>
                    </div>
                  </div>
                  </template>
                  <div x-show="nowOpen && a.why" class="text-sm opacity-75 leading-snug" x-text="a.why"></div>
                  <div x-show="nowOpen && a.links?.length" class="flex flex-wrap gap-1.5">
                    <template x-for="l in (a.links || [])" :key="l.kind + l.ref">
                      <a :href="nowLink(l).href" :target="nowLink(l).card ? null : '_blank'" rel="noopener"
                         @click="if (nowLink(l).card) { $event.preventDefault(); openDeck(nowLink(l).card) }"
                         @mouseenter="nowLink(l).peek && hoverViewPeek(nowLink(l).peek, $el)" @mouseleave="leaveViewPeek()"
                         class="inline-flex items-center gap-1 rounded-full border px-2 text-sm leading-6 hover:bg-base-200 min-w-0 max-w-full"
                         :class="nowLink(l).tone">
                        <i class="ph shrink-0" :class="nowLink(l).icon"></i><span class="truncate" x-text="nowLink(l).label"></span></a>
                    </template>
                  </div>
                </div>
              </template>
              <div x-show="nowOpen && now?.context?.length" class="flex flex-wrap gap-1.5 items-center">
                <span class="text-xs uppercase tracking-wide opacity-50">Context</span>
                <template x-for="l in (now?.context || [])" :key="l.kind + l.ref">
                  <a :href="nowLink(l).href" :target="nowLink(l).card ? null : '_blank'" rel="noopener"
                     @click="if (nowLink(l).card) { $event.preventDefault(); openDeck(nowLink(l).card) }"
                     @mouseenter="nowLink(l).peek && hoverViewPeek(nowLink(l).peek, $el)" @mouseleave="leaveViewPeek()"
                     class="inline-flex items-center gap-1 rounded-full border border-base-300 px-2 text-sm leading-6 hover:bg-base-200 min-w-0 max-w-full">
                    <i class="ph shrink-0" :class="nowLink(l).icon"></i><span class="truncate" x-text="nowLink(l).label"></span></a>
                </template>
              </div>
              <div x-show="nowOpen && now?.done?.length" class="grid gap-0.5 text-sm opacity-70">
                <span class="text-xs uppercase tracking-wide opacity-70">Shipped</span>
                <template x-for="d in (now?.done || [])" :key="d">
                  <div class="flex gap-1.5"><i class="ph ph-check mt-1 shrink-0"></i><span x-text="d"></span></div>
                </template>
              </div>
            </div>
            <div x-show="nowErr" class="shrink-0 text-sm text-warning font-mono break-all" x-text="nowErr"></div>
            <div x-show="!now && work.last" class="shrink-0 flex gap-2 items-start text-base cursor-pointer"
                 @click="lastOpen = !lastOpen">
              <span class="shrink-0 leading-snug" x-text="work.last && work.last.glyph"></span>
              <div class="min-w-0 leading-snug [&_a]:link [&_a]:link-primary"
                   :class="lastOpen ? '' : 'line-clamp-2'"
                   x-html="work.last ? inlineMd(work.last.text) : ''"></div>
            </div>
            <template x-for="a in (now ? [] : work.asks)" :key="a.key">
              <div class="shrink-0 flex gap-2 items-start text-base rounded-lg bg-base-200/60 px-3 py-2 cursor-pointer"
                   @click="if (!$event.target.closest('a')) lastOpen = !lastOpen">
                <span class="shrink-0 leading-snug" x-text="a.glyph"></span>
                <div class="min-w-0 leading-snug [&_a]:link [&_a]:link-primary" :class="lastOpen ? '' : 'line-clamp-2'">
                  <span x-html="inlineMd('**' + a.title + '**' + (a.text ? ' ' + a.text : ''))"></span>
                  <a :href="a.prUrl" target="_blank" rel="noopener"
                     class="ml-1 font-mono text-sm opacity-60 whitespace-nowrap no-underline"
                     x-text="a.repoShort + ' #' + a.pr"></a>
                </div>
              </div>
            </template>
            <!-- THE BRANCH ROWS ARE GONE (2026-10-22). A row per branch name,
                 a chip per repository coloured by its PR, each chip opening a
                 small branch panel: built on the premise that a session works
                 one branch name, which a long session breaks (bb88ffa7 drew
                 sixteen rows). The checkouts panel on the strip lists every
                 branch under its repository with its PR, and the owner judged
                 it the better presentation; a branch there opens the branch
                 deck that the rows' panel led to. -->
            <!-- The peek: one viewable, beside the card that lists it. A page is its
                 live render scaled down; a document is its rendered Markdown.
                 Nothing in it takes the pointer except the way to open it. -->
            <div x-ref="viewPeek" data-view-peek x-show="viewPeek"
                 @mouseenter="clearTimeout(_peekTimer)"
                 @mouseleave="leaveViewPeek()"
                 class="fixed z-[1001] rounded-xl border border-base-300 bg-base-100 shadow-xl overflow-hidden flex flex-col"
                 :style="viewPeek ? 'left:' + viewPeek.x + 'px;top:' + viewPeek.y + 'px;width:' + viewPeek.w + 'px;height:' + viewPeek.h + 'px' : ''">
              <template x-if="viewPeek">
                <div class="flex flex-col h-full min-h-0">
                  <div class="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-base-300 min-w-0">
                    <i class="ph shrink-0" :class="viewPeek.v.kind === 'md' ? 'ph-file-text' : 'ph-browser'"></i>
                    <span class="font-mono text-sm truncate grow" x-text="viewPeek.v.path"></span>
                    <a x-show="viewPeek.v.kind === 'html'" :href="viewPeek.v.url" target="_blank" rel="noopener" class="btn btn-ghost btn-xs btn-square"
                       data-title-tip="Open the page in a new tab"><i class="ph ph-arrow-square-out text-base"></i></a>
                  </div>
                  <div class="grow min-h-0 overflow-hidden relative">
                    <template x-if="viewPeek.v.kind === 'html'">
                      <iframe :src="viewPeek.v.url" tabindex="-1" class="absolute top-0 left-0 border-0 origin-top-left pointer-events-none bg-base-100"
                              :style="'width:1280px;height:' + Math.round((viewPeek.h - 36) * 1280 / viewPeek.w) + 'px;transform:scale(' + (viewPeek.w / 1280) + ')'"
                              sandbox="allow-scripts allow-same-origin"></iframe>
                    </template>
                    <template x-if="viewPeek.v.kind === 'md' || viewPeek.v.kind === 'text'">
                      <div class="px-4 py-3 text-sm leading-6 [overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:font-semibold [&_h2]:mt-3
                                  [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_code]:font-mono [&_code]:text-xs"
                           x-html="viewPeek.v.html || ''"></div>
                    </template>
                  </div>
                </div>
              </template>
            </div>
            <div x-show="work.loading || work.err" class="shrink-0 flex gap-2 items-center">
              <span x-show="work.loading" class="loading loading-dots loading-xs opacity-40"></span>
              <span x-show="work.err" class="text-sm text-error" x-text="work.err"></span>
            </div>
          </section>
          </div>
          </template>

          <!-- ── Look: what this session was building ─────────────────────
               The pages this session's branches changed, each opening at the
               BRANCH so it shows where the work got to rather than the commit
               some crawl happened to see. branch-brief carries the same row for
               one branch, in the same place and with the same chip; this is its
               fold across the branches one session left behind, which is the
               join the detail could not make for itself.

               LENT, NEVER COMPUTED, on the same contract the facts strip
               uses one level up: a
               record names its checkouts and their branches and stops there,
               and what each branch CHANGED is the estate's crawl to know. A
               cold pages/session.html is lent nothing and draws no row, which is
               the honest answer rather than a blank one, since the alternative
               is this page fetching a compare per branch on open.

               ONE LINE THAT SCROLLS, for the reason branch-brief's own Look row
               gives: a wrap spends a whole band on the chip that did not fit,
               and the partial chip at the edge is the affordance. -->
          <!-- shrink-0, and it is not decoration: the head is a column flex at
               h-full, so a child that does not claim its height is squeezed by
               whatever grows below it. Measured at 3px tall before this, with
               every chip inside it correct and invisible. -->
          <template x-if="!compact">
          <div x-show="pageChips.length"
               class="shrink-0 flex items-center gap-1.5 flex-nowrap min-w-0 mt-2
                      overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span class="text-sm shrink-0 select-none leading-none opacity-80"
                  data-title-tip="Pages this session changed, rendered via toss"
                  data-title-tip-bare>🥏</span>
            <template x-for="t in pageChips" :key="t.addr">
              <a :href="t.url" target="_blank" rel="noopener" :data-title-tip="t.title" data-title-tip-bare
                 class="shrink-0 rounded-full px-2.5 py-0.5 text-sm font-mono
                        bg-base-200/70 hover:bg-base-200 transition-colors"
                 x-text="t.label"></a>
            </template>
          </div>
          </template>

          <!-- The switch and the exits, branch-brief's row exactly: the tabs
               carry their own counts, the cards button is the one coloured
               control because it is what most readers came to do, and the
               links that leave sit ghost beside it. -->
          <!-- THE STICKY ROW, full-bleed against the shell's own padding so
               nothing slides past it down the margins. x-ref="chrome" is what
               trackChrome measures and publishes as the --chrome-h custom
               property; the outline's chips stick to that number.
               (No backticks in this markup: it is a JS template literal.) -->
          <div x-ref="chrome" class="flex flex-col gap-2 shrink-0"
               :class="!boxed && 'sticky top-0 z-20 -mx-4 px-4 py-2 bg-base-100 border-b border-base-300'">
            <template x-if="!compact">
            <!-- WRAPS RATHER THAN SCROLLS (2026-10-23). With the Views tab and
                 the notes mark, tabs and doors outgrew a phone's row, and the
                 tablist's own scroll hid all but the first tab with nothing to
                 say the rest were there. The doors drop to a second line when
                 the tabs need the width; the tablist keeps its scroll only for
                 a screen too narrow for the tabs alone. -->
            <div class="flex flex-wrap items-center gap-2 min-w-0 w-full">
            <div role="tablist" class="tabs tabs-box tabs-sm flex-nowrap bg-base-200 p-0.5 min-w-0 max-w-full
                                       overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <!-- Shown once the session is known to have filed a call; its
                   count is tinted while any of them waits on the owner. First,
                   ahead of the outline (owner, 2026-10-19), since what waits on
                   the owner is the first thing to see. -->
              <a role="tab" class="tab gap-1 flex-nowrap whitespace-nowrap" x-show="calls.length" data-session-calls-tab
                 :class="pane === 'calls' && 'tab-active'"
                 @click="pane = 'calls'; $nextTick(() => settlePane())">
                Calls<span class="font-mono rounded px-1" :class="openCallCount ? 'bg-warning/30 text-warning-content' : 'opacity-50'"
                           x-text="calls.length"></span></a>
              <a role="tab" class="tab gap-1 flex-nowrap whitespace-nowrap"
                 :class="pane === 'outline' && 'tab-active'"
                 @click="pane = 'outline'; $nextTick(() => { mountOutline(); settlePane(); })">
                Outline<span class="font-mono opacity-50" x-text="cards || ''"></span></a>
              <a role="tab" class="tab gap-1 flex-nowrap whitespace-nowrap" x-show="work.views.length" data-session-views-tab
                 :class="pane === 'views' && 'tab-active'"
                 @click="openViewsPane()">
                Views<span class="font-mono opacity-50" x-text="work.views.length"></span></a>
              <a role="tab" class="tab gap-1 flex-nowrap whitespace-nowrap"
                 :class="pane === 'files' && 'tab-active'"
                 @click="pane = 'files'; $nextTick(() => settlePane())">
                Files<span class="font-mono opacity-50" x-text="fileRows.length || ''"></span></a>
              <a role="tab" class="tab gap-1 flex-nowrap whitespace-nowrap"
                 :class="pane === 'raw' && 'tab-active'"
                 @click="pane = 'raw'; $nextTick(() => { mountRaw(); settlePane(); })">
                Raw<span class="font-mono opacity-50" x-text="rawSize"></span></a>
            </div>
            <div class="ml-auto flex items-center gap-2">
            <!-- NOTES ON WHAT IS ON SCREEN (owner, 2026-10-22). A tap opens a
                 composer: a note is about the view in front of the reader or
                 the session as a whole, named by the notes store's own
                 locators (skills/notes: owner/repo@ref:path, owner/repo:path),
                 and the set is copied out as JSON to paste into the session.
                 Kept in this browser per session until cleared, so a reload
                 loses nothing; nothing is written anywhere else. The count on
                 the mark is how it says notes are waiting to be copied. -->
            <button type="button" data-fact-btn data-notes-btn @click="openNotes($el)"
                    class="btn btn-sm btn-square btn-ghost max-sm:h-11 max-sm:w-11 relative"
                    :aria-label="notes.length ? plural(notes.length, 'note') + ' to copy out' : 'Write a note on what you are looking at'"
                    data-title-tip="Notes on what you are looking at, copied out as JSON">
              <i class="ph ph-note-pencil text-lg max-sm:text-xl"></i>
              <span x-show="notes.length" x-text="notes.length"
                    class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-neutral text-neutral-content
                           font-mono text-xs leading-4 text-center"></span></button>
            <!-- LISTEN, which is a door rather than a control: it opens the
                 deck and starts it speaking. Ghost beside the deck's primary,
                 because the deck is what most readers came to do and rule 10
                 spends the accent once. -->
            <button @click="listen()" :disabled="deckOpening || !record"
                    class="btn btn-sm btn-square btn-ghost max-sm:h-11 max-sm:w-11"
                    aria-label="Read this session aloud"
                    data-title-tip="Open the cards and read them aloud">
              <i class="ph ph-speaker-high text-lg max-sm:text-xl"></i></button>
            <!-- THE CLASSES AND THE WORDING ARE swipeDeck.entry()'s, held to it
                 by node/test/deck-entry-parity.test.mjs rather than by a call:
                 the kit loads on demand and is not on the page when this
                 template first renders, so a host that waited for it would show
                 no button at all on the first paint. Same copy, same gate, as
                 branch-brief's file-deck button. -->
            <button @click="openDeck()" :disabled="deckOpening || !record"
                    class="btn btn-square btn-sm max-sm:h-11 max-sm:w-11 btn-ghost text-primary"
                    :data-title-tip="cards ? 'Read ' + plural(cards, 'card') + ' one at a time'
                                  : 'Read cards one at a time'">
              <span x-show="deckOpening || (loading && !record)" class="loading loading-spinner loading-xs"></span>
              <i x-show="!deckOpening && !(loading && !record)"
                 class="ph ph-cards-three text-lg max-sm:text-xl"></i></button>
            <!-- The estate's standard way to link a session: the logomark in
                 brand colour, no label, exactly as the Sessions rows and the
                 deck header draw it. Drawn from kits/claude-mark.js rather than
                 pasted, and called plainly rather than defensively: gh-boot
                 carries the kit as standing equipment, which is what
                 node/test/claude-mark.test.mjs asserts one test below the one
                 that runs every call site's arguments. A guard here would only
                 hide the case that test exists to catch. -->
            <a x-show="agentUrl" :href="agentUrl" target="_blank"
               data-title-tip="Open this session in Claude Code"
               class="btn btn-sm btn-square btn-ghost max-sm:h-11 max-sm:w-11"
               x-html="window.claudeMark.svg({ cls: 'w-4 h-4 max-sm:w-5 max-sm:h-5 shrink-0' })"></a>
            <a x-show="recordUrl" :href="recordUrl" target="_blank" rel="noopener"
               data-title-tip="The stored record on GitHub"
               class="btn btn-sm btn-square btn-ghost max-sm:h-11 max-sm:w-11">
              <i class="ph ph-github-logo text-lg max-sm:text-xl"></i></a>
            </div>
            </div>
            </template>
            <template x-if="compact">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-sm font-semibold">Discussion</span>
                <button type="button" @click="openMatchedSession()" :disabled="!!(!record || deckOpening)"
                        class="btn btn-sm btn-ghost ml-auto">
                  <span x-show="deckOpening" class="loading loading-spinner loading-xs"></span>
                  Open session<i class="ph ph-arrow-up-right" aria-hidden="true"></i>
                </button>
              </div>
            </template>
            <template x-if="!compact || !fixedFind">
            <form x-show="pane === 'outline'" @submit.prevent="submitFind()"
                  class="min-w-0 flex items-center gap-1" role="search" aria-label="Find in conversation">
              <label class="input input-sm flex items-center gap-2 min-w-0 grow">
                <i class="ph ph-magnifying-glass shrink-0" aria-hidden="true"></i>
                <input type="search" x-model="findText" @input.debounce.200ms="runFind()"
                       @keydown.escape.stop.prevent="clearFind()"
                       @keydown.enter.shift.stop.prevent="stepFind(-1)"
                       placeholder="Find in conversation" aria-label="Find in conversation"
                       :disabled="!record" class="min-w-0 w-full" autocomplete="off">
              </label>
              <button type="button" @click="stepFind(-1)" :disabled="!findResult.hits.length"
                      class="btn btn-sm btn-square btn-ghost" aria-label="Previous matching exchange"
                      data-title-tip="Previous matching exchange"><i class="ph ph-caret-up"></i></button>
              <button type="button" @click="stepFind(1)" :disabled="!findResult.hits.length"
                      class="btn btn-sm btn-square btn-ghost" aria-label="Next matching exchange"
                      data-title-tip="Next matching exchange"><i class="ph ph-caret-down"></i></button>
              <button type="button" x-show="findText || findQuery" @click="clearFind()"
                      class="btn btn-sm btn-square btn-ghost" aria-label="Clear conversation search"
                      data-title-tip="Clear conversation search"><i class="ph ph-x"></i></button>
            </form>
            </template>
          </div>

          <div x-show="loading && !record" class="flex justify-center py-10 shrink-0">
            <span class="loading loading-dots loading-md opacity-30"></span>
          </div>

          <div x-ref="outline" x-show="pane === 'outline' && !findQuery" class="flex flex-col"
               :class="boxed && 'min-h-0 grow'"></div>

          <div x-show="pane === 'outline' && findQuery" x-cloak data-session-find
               class="min-w-0 pb-3" :class="boxed && 'min-h-0 grow overflow-y-auto'">
            <div class="flex items-center gap-2 py-2 text-sm text-base-content/65" role="status" aria-live="polite">
              <span x-text="findResult.hits.length ? plural(findResult.occurrenceTotal, 'occurrence') + ' · ' + plural(findResult.total, 'passage') + ' · ' + plural(findResult.hits.length, 'exchange') : compact ? matchNote || 'No matching discussion' : 'No matching captured exchanges'"></span>
              <span x-show="findResult.hits.length" class="ml-auto shrink-0 whitespace-nowrap font-mono tabular-nums"
                    x-text="findResult.hits.length ? (findAt + 1) + ' / ' + findResult.hits.length : ''"></span>
            </div>
            <template x-if="!compact && !findResult.hits.length">
              <p class="text-base text-pretty text-base-content/65 py-2">The search may have matched session details or recorded notifications.</p>
            </template>
            <p x-show="findCopyError" x-text="findCopyError" class="text-sm text-error" role="alert"></p>
            <template x-for="(hit, hitIndex) in findResult.hits" :key="hit.card">
              <article :data-session-match="hit.card" class="border-b border-base-300 py-3 min-w-0"
                       :class="hitIndex === findAt && 'bg-base-200/50'">
                <div class="flex items-center gap-2 px-2">
                  <button type="button" @click="findAt = hitIndex; openDeck(hit.card)"
                          class="btn btn-sm btn-ghost min-w-0 justify-start font-semibold"
                          :aria-label="'Read exchange ' + hit.exchange">
                    <i class="ph ph-chats-circle" aria-hidden="true"></i>
                    <span x-text="hit.exchange ? 'Exchange ' + hit.exchange : 'Opening notes'"></span>
                    <i class="ph ph-arrow-up-right text-base" aria-hidden="true"></i>
                  </button>
                  <span class="text-xs font-mono text-base-content/60" x-text="findTime(hit.at)"></span>
                  <button type="button" @click="copyExchange(hit.card)" :disabled="!exchangeUrl(hit.card)"
                          class="btn btn-sm btn-square btn-ghost ml-auto shrink-0"
                          :aria-label="findCopied === hit.card ? 'Exchange link copied' : 'Copy link to exchange ' + hit.exchange"
                          :data-title-tip="findCopied === hit.card ? 'Link copied' : 'Copy exchange link'">
                    <i class="ph" :class="findCopied === hit.card ? 'ph-check' : 'ph-link'"></i>
                  </button>
                </div>
                <div x-show="findResult.terms.length > 1 && !hit.allTerms" class="px-3 pt-1 text-xs text-base-content/60">
                  <span>Matches: </span><span x-text="hit.matchedTerms.join(', ')"></span>
                </div>
                <template x-for="(passage, passageIndex) in hit.passages" :key="passageIndex">
                  <div class="px-3 pt-2 min-w-0">
                    <div class="text-xs text-base-content/60 mb-1" x-text="passage.role === 'user' ? 'You' : 'Assistant'"></div>
                    <button type="button" @click="findAt = hitIndex; openDeck(hit.card)"
                            class="block w-full text-left text-base leading-7 text-pretty [overflow-wrap:anywhere]"
                            :aria-label="'Read ' + (passage.role === 'user' ? 'your prompt' : 'assistant reply') + ' in exchange ' + hit.exchange">
                      <template x-for="(part, partIndex) in findParts(passage.text)" :key="partIndex"><span :class="part.match && 'bg-warning/25 text-base-content'" x-text="part.text"></span></template>
                    </button>
                  </div>
                </template>
                <button type="button" x-show="hit.total > hit.passages.length" @click="findAt = hitIndex; openDeck(hit.card)"
                        class="btn btn-sm btn-ghost mx-2 mt-1" x-text="'Read ' + plural(hit.total, 'matching passage')"></button>
              </article>
            </template>
          </div>

          <!-- FILES: what the session opened, which the strip counts and had no
               route to. Alpine-rendered rather than imperative, unlike its two
               neighbours: this is a list of plain rows with no state of its own,
               so the reason those mount by hand (a kit that owns its selection)
               does not apply.

               Sorted by weight, not alphabetically: the question a reader brings
               here is what the session WORKED ON, and an edit says more than a
               read. The weighting is the sessions cache's own (fileWeight), so
               this list and the row's hover card cannot order the same files two
               ways. -->
          <template x-if="!compact">
          <div x-show="pane === 'files'" x-cloak class="pb-3"
               :class="boxed && 'min-h-0 grow overflow-y-auto'">
            <div x-show="!fileRows.length" class="text-sm opacity-60 py-3" x-text="filesNote"></div>
            <div x-show="fileRows.length > 0" class="space-y-3">
              <template x-for="g in branchGroups" :key="g.repo + '@' + g.branch">
                <div class="rounded-box border border-base-300 bg-base-100 overflow-hidden">
                  <!-- Branch header cap -->
                  <div class="flex items-center gap-2 px-3 py-1.5 bg-base-200/60 border-b border-base-300 flex-wrap">
                    <span class="font-semibold text-xs text-base-content/80 font-mono" x-text="g.repo"></span>
                    <template x-if="g.branch">
                      <a x-show="g.branchUrl" :href="g.branchUrl" target="_blank" rel="noopener"
                         class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-mono bg-base-300/60 hover:bg-primary hover:text-primary-content transition-colors"
                         :data-title-tip="'Open branch ' + g.branch">
                        <i class="ph ph-git-branch text-[11px]"></i>
                        <span x-text="g.branch"></span>
                      </a>
                    </template>
                    <template x-if="g.branch && !g.branchUrl">
                      <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-mono bg-base-300/40">
                        <i class="ph ph-git-branch text-[11px]"></i>
                        <span x-text="g.branch"></span>
                      </span>
                    </template>
                    <div class="grow"></div>
                    <span class="font-mono text-xs opacity-50" x-text="plural(g.files.length, 'file')"></span>
                  </div>
                  <!-- Files list for this branch -->
                  <div class="p-1 space-y-0.5">
                    <template x-for="f in g.files" :key="f.path">
                      <div class="flex items-baseline gap-2 py-1 px-2 border-b border-base-200/60 last:border-0 hover:bg-base-200/30 transition-colors">
                        <a :href="f.href || null"
                           :target="f.href ? '_blank' : null" :rel="f.href ? 'noopener' : null"
                           class="font-mono text-sm min-w-0 truncate"
                           :class="f.href ? 'hover:text-primary transition-colors' : 'cursor-default'"
                           :data-title-tip="f.path">
                          <span class="opacity-45" x-text="f.dir"></span><span x-text="f.name"></span>
                        </a>
                        <div class="grow"></div>
                        <template x-for="k in f.kinds" :key="k.label">
                          <span class="shrink-0 font-mono text-xs tabular-nums"
                                :class="k.label === 'edit' || k.label === 'write' ? 'text-warning font-semibold' : 'opacity-45'"
                                data-title-tip-bare :data-title-tip="k.n + ' ' + k.label + (k.n === 1 ? '' : 's')">
                            <span x-text="k.label.slice(0, 1)"></span><span x-text="k.n"></span></span>
                        </template>
                      </div>
                    </template>
                  </div>
                </div>
              </template>
            </div>
          </div>
          </template>

          <!-- ── THE VIEWS TAB ────────────────────────────────────────────
               Every page or Markdown file the session's branches changed,
               newest first. It sat above the tabs as a card the height of the
               screen until 2026-10-22; a tab it waits until asked, and so do
               its frames and the Markdown reads behind it. -->
            <!-- The viewables, one card at a time, the way branch-brief's
                 Files pane swipes: the strip is exactly as wide as the page
                 column, each slide is the strip's full width and snaps to its
                 centre, and the card's name and pager sit above the strip, so
                 nothing peeks and the first card loads square. -->
            <!-- THE MARK IS THE CONTENTS, as the full-screen deck's is and as
                 branch-brief's Files pane is: a tap drops the list, grouped by
                 repo and branch, the current card marked, a tap to go. -->
            <div x-show="pane === 'views' && work.views.length" x-cloak data-session-views class="relative flex flex-col pb-3"
                 :class="boxed && 'min-h-0 grow'" :style="!boxed && { height: 'calc(100dvh - var(--chrome-h, 0px) - 1rem)' }">
            <div data-views class="flex-1 min-h-0 rounded-xl border border-base-300 overflow-hidden bg-base-100 flex flex-col">
              <div class="flex items-center gap-2 px-3 py-1.5 border-b border-base-300 min-w-0">
                <button type="button" data-view-list-btn @click="viewListOpen = !viewListOpen"
                        class="btn btn-sm btn-square shrink-0 -ml-1" :class="viewListOpen ? 'btn-ghost bg-primary/10 text-primary' : 'btn-ghost'"
                        :data-title-tip="viewListOpen ? 'Back to the card' : 'Contents'" :aria-expanded="viewListOpen ? 'true' : 'false'">
                  <i class="ph text-lg" :class="viewListOpen ? 'ph-caret-up' : work.views[vAt]?.icon"></i></button>
                <div class="min-w-0 grow">
                  <div class="flex items-center gap-1 min-w-0">
                    <span class="font-mono text-sm truncate" x-text="work.views[vAt]?.name"></span>
                    <a :href="viewGh(work.views[vAt])" target="_blank" rel="noopener" data-title-tip="On GitHub"
                       class="shrink-0 opacity-40 hover:opacity-100"><i class="ph ph-github-logo text-sm"></i></a>
                  </div>
                  <div class="font-mono text-xs opacity-50 truncate"
                       x-text="work.views[vAt] ? work.views[vAt].repoShort + ' · ' + work.views[vAt].dir + (work.views[vAt].ago ? ' · ' + work.views[vAt].ago : '') : ''"></div>
                </div>
                <div x-show="work.views.length > 1" data-pager class="flex items-center shrink-0">
                  <button type="button" class="btn btn-xs btn-ghost btn-square max-sm:hidden"
                          @click="goView(vAt - 1)" :disabled="vAt <= 0" data-title-tip="Previous view"><i class="ph ph-caret-left"></i></button>
                  <span class="font-mono text-xs opacity-60 tabular-nums px-1" x-text="(vAt + 1) + '/' + work.views.length"></span>
                  <button type="button" class="btn btn-xs btn-ghost btn-square max-sm:hidden"
                          @click="goView(vAt + 1)" :disabled="vAt >= work.views.length - 1" data-title-tip="Next view"><i class="ph ph-caret-right"></i></button>
                </div>
                <a x-show="work.views[vAt]?.kind === 'html'" :href="work.views[vAt]?.url" target="_blank" rel="noopener" class="btn btn-ghost btn-sm btn-square shrink-0"
                   data-title-tip="Open the page in a new tab"><i class="ph ph-arrow-square-out text-lg"></i></a>
                <button class="btn btn-ghost btn-sm btn-square shrink-0 text-primary" @click="openViews(vAt)"
                        data-title-tip="Swipe through every view full screen"><i class="ph ph-cards-three text-lg"></i></button>
              </div>
              <div x-ref="viewStrip" @scroll.passive="viewScroll()"
                   class="flex-1 min-h-0 flex gap-3 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain
                          [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <template x-for="(v, i) in work.views" :key="v.key">
                  <div data-slide class="w-full shrink-0 snap-center flex flex-col min-h-0">
                    <template x-if="v.kind === 'html' && pane === 'views' && Math.abs(i - vAt) <= 1 || vSeen[v.key]">
                      <iframe :src="v.url" x-init="vSeen[v.key] = true" class="grow w-full border-0 bg-base-100"
                              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe>
                    </template>
                    <template x-if="v.kind === 'md'">
                      <div class="grow overflow-y-auto overflow-x-hidden [overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap px-4 py-3 text-base leading-7 [&_h1]:text-xl [&_h1]:font-semibold
                                  [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h3]:font-semibold [&_p]:my-2
                                  [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:link [&_code]:font-mono
                                  [&_code]:text-sm [&_table]:text-sm"
                           x-html="v.html || ''"></div>
                    </template>
                  </div>
                </template>
              </div>
            </div>
            <div data-view-list x-show="viewListOpen"
                 @click.outside="if (!$event.target.closest('[data-view-list-btn]')) viewListOpen = false"
                 @keydown.escape.window="viewListOpen = false"
                 x-effect="if (viewListOpen) $nextTick(() => { const r = $el.querySelector('[aria-current=true]'); if (r) $el.scrollTop = r.offsetTop - $el.clientHeight / 2; })"
                 class="absolute left-1 top-12 z-20 w-80 max-w-[calc(100%-0.5rem)] max-h-[min(60vh,26rem)] overflow-y-auto overscroll-contain
                        rounded-xl border border-base-300 bg-base-100 shadow-xl">
              <template x-for="(v, i) in work.views" :key="v.key">
                <div>
                  <div x-show="i === 0 || work.views[i - 1].slug + '@' + work.views[i - 1].branch !== v.slug + '@' + v.branch"
                       class="sticky top-0 z-10 bg-base-200/90 px-3 py-1 text-xs font-medium text-base-content/60 border-b border-base-200 truncate"
                       x-text="v.repoShort + ' · ' + v.short"></div>
                  <button type="button" @click="viewListOpen = false; goView(i)"
                          class="flex w-full items-start gap-2.5 border-b border-base-200 px-3 py-2 text-left transition-colors"
                          :class="i === vAt ? 'bg-primary/10' : 'hover:bg-base-200/60'" :aria-current="i === vAt ? 'true' : 'false'">
                    <span class="mt-0.5 w-6 shrink-0 text-right font-mono text-xs tabular-nums"
                          :class="i === vAt ? 'text-primary' : 'text-base-content/40'" x-text="i + 1"></span>
                    <i class="ph mt-0.5 shrink-0 text-base text-base-content/40" :class="v.kind === 'md' ? 'ph-file-text' : 'ph-browser'"></i>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm" :class="i === vAt && 'font-semibold text-primary'" x-text="v.name"></span>
                      <span class="block truncate text-xs text-base-content/50" x-text="(v.dir || '/') + (v.ago ? ' · ' + v.ago : '')"></span>
                    </span>
                  </button>
                </div>
              </template>
            </div>
            </div>

          <div x-ref="raw" x-show="pane === 'raw'" x-cloak class="flex flex-col min-h-0 pb-3"
               :class="boxed && 'grow'"
               :style="!boxed && { height: 'calc(100dvh - var(--chrome-h, 0px) - 1rem)' }"></div>

          <!-- ── CALLS: the decisions this session put to the owner ───────
               (owner, 2026-10-19: "it would be helpful to see it with the
               session like that as opposed to in this independent
               placement"). One card per call, as filed and as it stands; a
               tap opens the deck of call forms at it, where it is answered,
               as the Waiting view's form is. -->
          <template x-if="!compact">
          <div x-show="pane === 'calls'" x-cloak class="flex flex-col gap-3 pb-3" data-session-calls
               :class="boxed && 'min-h-0 grow overflow-y-auto'">
            <div x-show="callsLoading && !calls.length" class="flex py-3"><span class="loading loading-dots loading-sm opacity-40"></span></div>
            <template x-for="(c, i) in calls" :key="c.id">
              <!-- A tap on a chip shows its tip and opens nothing. -->
              <div role="button" tabindex="0" @click="$event.target.closest('[data-title-tip]') || openCalls(i)" @keydown.enter.prevent="openCalls(i)" data-session-call :data-id="c.id"
                   class="flex flex-col gap-1.5 rounded-box border border-base-300 bg-base-100 hover:bg-base-200/60 px-3 py-2.5 cursor-pointer"
                   :class="c.status === 'closed' && 'opacity-60'">
                <!-- The size and the cautions ride the name's line, on the
                     right, so the card spends no line of its own on them. -->
                <div class="flex items-center gap-1.5 text-sm text-base-content/60" data-session-call-head>
                  <i class="ph text-base" :class="callKindIcon(c)"></i>
                  <span class="min-w-0 truncate" x-text="c.name || callKindLabel(c)"></span>
                  <span class="grow"></span>
                  <template x-for="t in callChips(c)" :key="t.key">
                    <span class="badge badge-sm shrink-0 gap-1" :class="t.tone" data-title-tip-bare :data-title-tip="t.tip" :data-chip="t.key">
                      <i class="ph" :class="t.icon"></i><span x-text="t.label"></span></span>
                  </template>
                  <span class="badge badge-sm shrink-0" :class="callStateTone(c)" x-text="callState(c)"></span>
                </div>
                <!-- No text-pretty here: Safari's pretty wrap evens the rag of
                     the whole paragraph, so every line stopped short of the
                     card's right edge (owner, 2026-10-19). -->
                <p class="text-base font-medium" x-text="c.question"></p>
                <p x-show="c.brief" class="text-base text-base-content/80" x-text="c.brief"></p>
                <div x-show="c.recommend" class="text-base">
                  <span class="font-medium">Recommended:</span> <span x-text="c.recommend"></span><span
                    x-show="c.why" class="text-base-content/60" x-text="', since ' + c.why"></span></div>
                <!-- A call filed as Take or Adjust is answered in a box (owner,
                     2026-10-19): left empty, its send takes the
                     recommendation; anything written there is the adjustment,
                     sent as Adjust and go, as the call form's own default.
                     Come back first stays in the form, a tap on the card away.
                     Two taps, the second on Confirm, as everywhere a call is
                     answered. -->
                <div x-show="callAdjustable(c)" class="flex items-end gap-2 pt-1" @click.stop @keydown.enter.stop data-session-call-reply>
                  <textarea rows="1" class="textarea grow min-h-0 h-auto py-[7px] text-base leading-6 resize-none"
                            placeholder="Go ahead as recommended" :disabled="!!callSending[c.id]"
                            x-model="callNotes[c.id]" @input="fitCallNote($el); if (callArmed === c.id + '|send') callArmed = ''"
                            @keydown.enter="if (!$event.shiftKey) { $event.preventDefault(); tapCallSend(c); }" data-session-call-note></textarea>
                  <button type="button" class="btn btn-success shrink-0 gap-1.5" :class="callArmed === c.id + '|send' ? 'px-3' : 'btn-square'"
                          :disabled="!!callSending[c.id]" @click="tapCallSend(c)" data-session-call-send data-title-tip-bare
                          :data-title-tip="(callNotes[c.id] || '').trim() ? 'Send your words as the adjustment' : 'Take the recommendation: ' + c.recommend"
                          :aria-label="(callNotes[c.id] || '').trim() ? 'Send the adjustment' : 'Take the recommendation'">
                    <span x-show="!!callSending[c.id]" class="loading loading-spinner loading-sm"></span>
                    <i x-show="!callSending[c.id]" class="ph text-lg" :class="callArmed === c.id + '|send' ? 'ph-check-circle' : 'ph-paper-plane-right'"></i>
                    <span x-show="callArmed === c.id + '|send'">Confirm</span></button>
                </div>
                <!-- A merge, or an older call filed with options, keeps its
                     answers as buttons, two taps each. -->
                <div x-show="callOpts(c).length" class="flex flex-wrap items-center gap-2 pt-1" @click.stop @keydown.enter.stop>
                  <template x-for="o in callOpts(c)" :key="o">
                    <button type="button" class="btn btn-sm gap-1.5" :class="callBtnClass(c, o)" :disabled="!!callSending[c.id]"
                            @click="tapCallAnswer(c, o)" data-session-call-answer :data-option="o">
                      <span x-show="callSending[c.id] === o" class="loading loading-spinner loading-xs"></span>
                      <i x-show="callSending[c.id] !== o && callArmed === c.id + '|' + o" class="ph ph-check-circle"></i>
                      <span x-text="callArmed === c.id + '|' + o ? 'Confirm' : o"></span></button>
                  </template>
                </div>
                <p x-show="!!callErr[c.id]" class="text-sm text-error" x-text="callErr[c.id] || ''"></p>
              </div>
            </template>
          </div>
          </template>
        </div>
      `,

      init() {
        this.$el.innerHTML = this.template;
        this.$nextTick(() => {
          if (!this.$el.isConnected) return;
          Alpine.initTree(this.$el);
          this.trackChrome();
          this.fitBox();
        });
        // The estate's copy only: nothing may be read ahead of the record,
        // since a deck mounts three slides and each one's own blob comes first.
        this.loadMarks(false);
        this.load();
      },
      destroy() {
        this.chromeObs?.disconnect(); this.chromeObs = null;
        // The outline's rail listens for scroll on the window, because that is
        // the only listener that catches both this component's layouts; it is
        // the one thing index() builds that does not die with the tree, so it
        // is released here. On the estate's swiper this runs per slide left.
        this.outlineOff?.(); this.outlineOff = null;
        this._rawExplorer?.destroy?.(); this._rawExplorer = null;
      },
      outlineOff: null,
      outlineJump: null,

      // A boxed standalone shell ends at the viewport's foot: its height is
      // the viewport less its own top in the document, which is the host's
      // address bar on pages/session.html. MEASURED AGAIN ONCE THE RECORD IS
      // IN (settle calls this), and on the next frame: at mount the host's
      // loading spinner still stands above the shell, and the first build
      // measured 157px for a 49px bar, leaving a band empty at the foot.
      fitBox() {
        if (!this.boxed || this.framed) return;
        const set = () => {
          const top = Math.max(0, Math.round(this.$el.getBoundingClientRect().top + window.scrollY));
          this.boxHeight = 'calc(100dvh - ' + top + 'px)';
        };
        set();
        requestAnimationFrame(set);
        if (!this._boxWired) { this._boxWired = true; window.addEventListener('resize', set); }
      },

      // ── The sticky chrome, and its one published number ───────────────────
      // The tab row's height, written onto this mount as `--chrome-h` so the
      // outline's own chips can stick underneath it. MEASURED rather than
      // written down twice: the row is 44px of touch-sized buttons on a phone
      // and 32px above `sm`, and it grows a line whenever the tabs wrap or the
      // reader has scaled their text up, so a constant in the kit would be
      // wrong on some screen nobody tested. Framed there is no sticky row and
      // no number to publish.
      chromeObs: null,
      trackChrome() {
        if (this.boxed || this.chromeObs) return;
        const row = this.$refs.chrome;
        if (!row || !window.ResizeObserver) return;
        const set = () => this.$el.style.setProperty('--chrome-h', row.offsetHeight + 'px');
        this.chromeObs = new ResizeObserver(set);
        this.chromeObs.observe(row);
        set();
      },

      // SWITCHING PANES IS WHERE DOCUMENT SCROLL HAS TO BE CORRECTED, which is
      // the cost the house style names for sticky chrome. The three panes
      // differ by two orders of magnitude in height (an outline of 7 cards
      // against 40,000px of raw JSON), so a reader deep inside Raw who taps
      // Outline lands past the end of a list that no longer reaches there.
      // Only when the chrome has ALREADY left the top: at the top of the page
      // there is nothing to correct and pulling the head off screen would be
      // the jolt this exists to avoid.
      settlePane() {
        if (this.boxed) return;
        const top = this.$refs.chrome?.getBoundingClientRect().top;
        if (typeof top === 'number' && top < 0) window.scrollBy({ top, behavior: 'instant' });
      },

      // ── What is known before the record lands ─────────────────────────────
      // The host's row, shaped as a record. One strip implementation reads
      // this or the real thing, so the head cannot say two different numbers
      // on either side of a fetch. Provisional by contract: every field here is
      // overwritten by the record.
      get factsRecord() {
        const f = this.facts;
        if (!f) return null;
        return {
          short: f.id || this.id, day: f.day || this.day,
          started: f.started || '', ended: f.ended || '',
          repos: f.repos || [], opening_ask: f.ask || '',
          exchanges: f.exchanges || 0, calls_total: f.calls || 0,
          failures: f.failures || 0, files_total: f.filesTotal || 0,
          tokens: f.tokens || null, schema: f.schema || 0,
          agents_total: f.agents || 0, agents_unaccounted: f.agentsUnaccounted || 0,
          agent_session: f.agent || '',
          _title: f.title || '',
        };
      },
      get rec() { return this.record || this.factsRecord || {}; },
      // The follow-up's summary and topics, from the host's row (estate.js
      // joins them; RepoSessionsCache.withTopics). Never from the record,
      // which does not carry them.
      //
      // `agenda` is the session as stretches of turns (topicStretches), which
      // the outline draws as headers; `list` is each topic once, for the head.
      // A row with topics and no agenda still lists them, untappable.
      // The topics file outranks the row once it is read: it is the same
      // reading, newer by however long the rollup took, and it is the only one
      // a deep-linked slide or the standalone page has.
      get gist() {
        const f = this.facts || {};
        const t = this.topics;
        const S = window.RepoSessionsCache;
        const topics = Array.isArray(t?.topics) ? t.topics : Array.isArray(f.topics) ? f.topics : [];
        const agenda = t && Array.isArray(t.agenda) && S?.topicStretches ? S.topicStretches(t.agenda)
          : Array.isArray(f.topicAgenda) ? f.topicAgenda : [];
        const listed = (window.RepoSessionsCache?.topicList?.(agenda) || []).filter(t => !t.minor);
        const list = listed.length ? listed
          : topics.map(topic => ({ topic, kind: null, first: -1, spans: [], turns: 0, state: null }));
        return { summary: t?.summary || f.topicSummary || '', topics, agenda, list };
      },
      // Gemini's own mark, in the grey the outline's turn notes use, so the
      // summary and the notes under it read as one author.
      geminiGlyph() {
        return window.assistantMark?.svg?.('gemini', { cls: 'inline size-3', color: 'currentColor' })
          || '<i class="ph ph-sparkle text-sm"></i>';
      },
      // The line's right-hand note: how much of the session, and whether it
      // came back to it. Short on purpose, since at 430px every character it
      // takes is one the topic's name loses; the kind rides the tooltip.
      topicMeta(t) {
        return [t.turns ? this.plural(t.turns, 'turn') : '',
                t.spans.length > 1 ? t.spans.length + '\u00d7' : ''].filter(Boolean).join(' \u00b7 ');
      },
      topicTip(t) {
        const kind = { new: 'New work', improve: 'Improving something that existed',
                       fix: 'A fix', explore: 'A question or investigation' }[t.kind];
        const spans = t.spans.map(([a, b]) => a === b ? 'turn ' + (a + 1) : 'turns ' + (a + 1) + '\u2013' + (b + 1));
        return [t.area, kind, spans.join(', '), t.state && 'Ended on: ' + t.state.line].filter(Boolean).join('. ');
      },
      // A tap on the list: the outline, at the topic's first stretch.
      goTopic(t) {
        if (!t || t.first < 0) return;
        const go = () => this.outlineJump?.(t.first);
        if (this.pane === 'outline' && this.outlineBuilt) return go();
        this.pane = 'outline';
        this.$nextTick(() => { this.mountOutline(); this.settlePane(); requestAnimationFrame(go); });
      },
      get shortId() { return this.rec.short || this.id || ''; },
      get agentUrl() { return this.rec.agent_session || ''; },

      // The name. `describe` owns it once the record is here; before that the
      // host's own label is the best answer there is, and the id is the last
      // resort, which is also what the deck header shows.
      get head() {
        if (this.record && window.sessionRender) return window.sessionRender.describe(this.record);
        return { title: this.facts?.title || this.facts?.name || this.shortId, subtitle: '' };
      },

      // ── WHERE THE CLOSING REPLY WENT ──────────────────────────────────────
      // A clamped, expandable block sat here and drew the session's last reply
      // above the tab row, on the argument that a reader scanning sessions is
      // after what one CONCLUDED. Removed 2026-09-06 for 124px of a 932px phone,
      // which was a quarter of everything above the first card.
      //
      // The argument had already been answered twice over. The estate's
      // Sessions view draws a proper reply card for exactly that scanning case
      // (alpineComponents/estate.js, `replyTurns` and `replyLabel`), rendered
      // through the deck's own turn renderer and carrying the fidelity label
      // this block copied. And the reply is a turn inside the record's last
      // card, so the outline's own last row already previews it and the panel
      // on that row opens it whole. What went is prominence, not text.
      //
      // The cache still carries `reply` and `replyCut` and they are still read:
      // that card is their consumer, so nothing upstream is orphaned by this.

      // ── Which copy of this page is running ────────────────────────────
      // window.gh.ref is what the LOADER booted from: `main` on the deployed
      // page, the SHA inside a toss or under a ?use= pin. Not the address
      // bar's ask, which a page whose boot block ignores ?use= would report
      // falsely.
      //
      // THE SAME THREE LINES LIVE IN alpineComponents/branch-brief.js, and the
      // fab reasons identically at loaderRef. Three copies of a two-line read,
      // on purpose: a kit for it would be heavier than the thing, and each is
      // held to the same source by the gate in node/test/branch-brief-groups.
      // Change one and change the others.
      get codeRef() {
        const r = (typeof window !== 'undefined' && window.gh && window.gh.ref) || 'main';
        return /^[0-9a-f]{7,40}$/i.test(r) ? r.slice(0, 7) : r;
      },

      // The strip: what the record IS, as facts. Each carries its own
      // definition, because two of these are exact about something the plain
      // word is not: `calls` counts tool calls and not turns, and `repos` names
      // CHECKOUTS rather than the repositories a session touched through the
      // API. Source: sessions/README.md in the store.
      //
      // FIVE, DOWN FROM NINE (2026-09-06), and four of the cuts are one
      // argument each rather than a trim to taste. `asks` and `files` are
      // printed again 44px below as the Outline and Files tab counts, which are
      // the same numbers within one (a card folds a leading meta note into the
      // first ask). `schema` is the record FORMAT's version, which decides what
      // the reader can expect this view to show and is otherwise a fact about
      // the recorder rather than about the session. `out tokens` is a scale
      // reading with nothing to do: nothing on this page or in the estate reads
      // differently for a large one.
      //
      // `k` is the fact's NAME and is no longer drawn; `unit` is the word the
      // strip actually renders after the value, empty wherever the value names
      // itself. See the template, which carries why.
      //
      // GLYPHS SINCE 2026-10-22, on the Sessions row's model: `icon` draws the
      // count as a glyph and `panel` names the panel-tip a tap opens, so a fact
      // with a panel carries no unit word, since the panel's header says it.
      // `failures` left the five as a standing fact: it rides the tools panel,
      // which states a zero, and joins the strip only when it is not one.
      // `agents` joined on the row's terms, present only when one ran.
      get strip() {
        const r = this.rec;
        // Schema 8's count of what ran, else the tally of Agent calls, as the
        // sessions cache reads it; absent rather than zero where neither says.
        const tools = r.tools || {};
        const tally = Array.isArray(tools) ? (tools.find(([n]) => n === 'Agent' || n === 'Task') || [])[1]
                                           : (tools.Agent || 0) + (tools.Task || 0);
        const agents = r.agents_total || tally || 0;
        // THE START DATE ALONE, short and friendly, opening the time panel
        // (owner, 2026-10-22): "Oct 11" rather than 2026-10-11 beside
        // "224h 33m". How long it ran, when it last moved and on how many days
        // are the panel's (timeFacts).
        return [
          ['day', this.friendlyDay(r), '', 'session start', '', 'time'],
          ['calls', r.calls_total, '', 'tool calls', 'ph-wrench', 'tools'],
          ['failures', r.failures || null, '', 'tool calls came back an error', 'ph-warning-circle', 'tools', 'text-warning'],
          ['agents', agents || null, '', agents === 1 ? 'subagent dispatched' : 'subagents dispatched',
           'ph-tree-structure', 'tools', r.agents_unaccounted ? 'text-warning' : ''],
          // THE UNION, not `repos` alone. Record schema 8 added `attached`, the
          // container's own list, and `repos` is where the shell actually stood: a
          // checkout worked entirely through absolute paths appears in one and not
          // the other. Showing the narrower field here while the row below acts on
          // the wider one put two different answers to one question a line apart,
          // which a shot caught before this comment existed. An older record
          // carries no `attached` and reads as it always did.
          ['repos', this.scopeNames, '', 'Checked out', '', 'scope'],
        ].filter(([, v]) => v || v === 0)
         .map(([k, v, unit, t, icon, panel, tone]) => ({ k, v, unit, t, icon: icon || '', panel: panel || '', tone: tone || '' }));
      },

      // "Oct 11", in the reader's own zone, with the year only past a year
      // ago. The month is spelled en-US on purpose: the owner asked for the
      // three-letter month first, which other locales reorder.
      friendlyDay(r) {
        const t = Date.parse(r.started || '') || Date.parse((r.day || '') + 'T12:00:00Z');
        if (!t) return r.day || '';
        const far = Math.abs(Date.now() - t) > 365 * 864e5;
        return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(far ? { year: 'numeric' } : {}) });
      },
      // ── The time panel ────────────────────────────────────────────────────
      get timeFacts() {
        const r = this.rec;
        const a = Date.parse(r.started || ''), b = Date.parse(r.ended || '');
        const when = (t) => new Date(t).toLocaleString('en-US',
          { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        // Hours and minutes up to two days, days and hours past it: 224h 33m
        // is exact and reads as nothing.
        const m = a && b && b >= a ? Math.round((b - a) / 60000) : -1;
        const span = m < 0 ? '' : m < 60 ? m + 'm' : m < 2880 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm'
          : Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h';
        const prompts = Array.isArray(r.prompts) ? r.prompts : [];
        const days = new Set(prompts.map((p) => p && p.at && new Date(p.at).toDateString()).filter(Boolean)).size;
        return { span, started: a ? when(a) : (r.day || ''), ended: b ? when(b) : '',
                 endedAgo: b ? this.ago(new Date(b).toISOString()) : '', days, turns: prompts.length };
      },

      // ── The tools panel ───────────────────────────────────────────────────
      // The Sessions row's tools card, read off the record rather than the
      // cache's busiest six: every tool, each with its count, the failures
      // beside the tool that failed, and the subagents by what they were sent
      // to do. Before the record lands it says what the host's row knew.
      get toolTally() {
        const r = this.rec;
        const raw = r.tools || [];
        const pairs = Array.isArray(raw) ? raw : Object.entries(raw);
        // Per tool only where the record kept every call: a partial list
        // would undercount the failures and say so nowhere.
        const calls = Array.isArray(r.calls) ? r.calls : [];
        const whole = calls.length > 0 && calls.length === r.calls_total;
        const failed = {};
        if (whole) for (const c of calls) if (c && c.ok === false && c.name) failed[c.name] = (failed[c.name] || 0) + 1;
        const rows = pairs.map(([name, n]) => ({ name, n: +n || 0, failed: failed[name] || 0 }))
          .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
        const agents = (Array.isArray(r.agents) ? r.agents : []).map((a) => ({
          label: a.label || a.type || 'agent', type: a.type || '',
          calls: Object.values(a.tools || {}).reduce((sum, n) => sum + (+n || 0), 0) }));
        const note = [!rows.length && 'This record kept no per-tool breakdown.',
                      r.failures && rows.length && !whole && 'Which tools failed is not in this record.',
                      r.agents_unaccounted && (r.agents_unaccounted + ' launched and never reported.')]
          .filter(Boolean).join(' ');
        return { calls: r.calls_total || 0, failures: r.failures || 0, rows, agents, note };
      },

      // ── How far Gemini has read ───────────────────────────────────────────
      // The poller's own staleness test (web-tools-private
      // sessions/tools/poll_followup.py, stale_reason), as much of it as a page
      // can run: no companion yet, or a companion made from a different blob
      // of the record than the one on screen. Its other two reasons, an older
      // format and edited prompts, need the poller's own hashes and are not
      // judged here.
      //
      // Null where there is nothing to look for: a #gz= record has no path and
      // so no companion, and "not summarized" said of it would be a claim
      // about the store made from a copy that was never in it.
      get gemini() {
        const r = this.record, t = this.topics, st = this.topicsState;
        if (!r || !this.path || !st) return null;
        const prompts = Array.isArray(r.prompts) ? r.prompts : [];
        // Turn i is prompts[i] from schema 8, when the recorder began keeping
        // injected prompts apart; before it the two can disagree, which is
        // turnNotes' own condition, and the companion's count stands in.
        const aligned = (r.schema || 1) >= 8 || Array.isArray(r.injected);
        const found = st === 'found';
        // Per-turn summaries arrived with format 5. An older companion has the
        // title, summary and topics and no `turns` at all, which is not the
        // same as turns skipped, and 95 of the 150 on background are that
        // shape (2026-10-22): sessions past the poller's seven-day window.
        const perTurn = found && Array.isArray(t.turns);
        const turns = perTurn ? t.turns : [];
        const covered = found ? (Number.isInteger(t.turn_count) ? t.turn_count : turns.length) : 0;
        const asked = aligned ? prompts.length : covered;
        const done = turns.filter((x) => x && x.summary).length;
        // The blob where both sides have one; the end stamp where a host lent
        // the record without it.
        const moved = found && (r._blob && t.source_blob ? r._blob !== t.source_blob
                                : !!(t.source_ended && r.ended && t.source_ended !== r.ended));
        const state = !found ? st : moved ? 'behind' : !perTurn ? 'topics' : done < asked ? 'gaps' : 'current';
        const n = (k) => k + (k === 1 ? ' turn' : ' turns');
        // The panel's header: turns summarized where there are summaries to
        // count, turns read where the companion predates them.
        const head = perTurn || !found ? { count: done + '/' + asked, unit: 'turns summarized' }
                                       : { count: covered + '/' + asked, unit: 'turns read' };
        const look = {
          reading: { tone: 'text-base-content/35 animate-pulse', label: '', icon: '', word: 'reading',
                     tip: "Reading Gemini's summaries" },
          none:    { tone: 'text-base-content/40', label: asked ? '0/' + asked : '', icon: '', word: 'not yet',
                     tip: 'Gemini has not summarized this session' },
          unread:  { tone: 'text-base-content/40', label: '?', icon: '', word: 'could not read',
                     tip: "Gemini's summaries for this session could not be read" },
          topics:  { tone: 'text-base-content/50', label: '', icon: '', word: 'topics only',
                     tip: "Gemini's reading of this session predates per-turn summaries: it has the summary and the topics, not a summary of each turn" },
          current: { tone: 'text-success', label: '', icon: 'ph-check', word: 'current',
                     tip: 'Gemini has summarized all ' + n(asked) + ', from this version of the record' },
          gaps:    { tone: 'text-warning', label: done + '/' + asked, icon: '', word: (asked - done) + ' skipped',
                     tip: 'Gemini summarized ' + done + ' of ' + n(asked) + '; it skipped the rest on both tries' },
          behind:  { tone: 'text-warning', label: covered < asked ? covered + '/' + asked : '',
                     icon: covered < asked ? '' : 'ph-arrows-clockwise', word: 'behind the record',
                     tip: covered < asked ? 'Gemini has read ' + covered + ' of ' + n(asked) + '; the session went on after'
                                          : 'The record has changed since Gemini read it' },
        }[state];
        const badge = { current: 'badge-success', gaps: 'badge-warning', behind: 'badge-warning' }[state] || 'badge-ghost';
        return { state, asked, covered, done, perTurn, aligned, moved, head, badge, ...look };
      },
      // The panel's body: a row per turn and the provenance lines. Apart from
      // the mark's getter because only the open panel reads it, and the mark's
      // is read half a dozen times a render: building a row and a clock per
      // turn on each read cost about 0.1s on a 193-turn session (2026-10-22).
      get geminiDetail() {
        const g = this.gemini;
        if (!g) return { rows: [], lines: [] };
        const r = this.record, t = this.topics;
        const prompts = Array.isArray(r.prompts) ? r.prompts : [];
        const turns = g.perTurn ? t.turns : [];
        const byTurn = new Map(turns.filter(Boolean).map((u) => [u.turn, u]));
        const rows = !g.perTurn ? [] : Array.from({ length: Math.max(g.asked, g.covered) }, (_, i) => {
          const x = byTurn.get(i) || null;
          const mark = i >= g.covered ? 'after' : x && x.summary ? 'done' : 'skipped';
          return { n: i + 1, mark, clock: g.aligned ? this.findTime(prompts[i]?.at) : '',
                   text: mark === 'done' ? (x.headline || x.summary)
                       : mark === 'skipped' ? 'not summarized: skipped on both tries'
                       : 'said after Gemini read the record' };
        });
        const when = (iso) => {
          const d = new Date(iso);
          if (!iso || Number.isNaN(d.getTime())) return '';
          const day = d.toDateString() === new Date(r.started || r.ended || iso).toDateString()
            ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ';
          return day + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        };
        const drawn = { headline: 'the headlines', clipped: 'clipped headlines',
                        elided: 'the summaries, middle turns dropped', raw: 'the raw turns' }[t?.topic_input];
        const lines = g.state === 'none' || g.state === 'unread' || g.state === 'reading' ? [] : [
          'read the record as it stood at ' + when(t.source_ended),
          'made ' + when(t.analyzed_at) + (t.model ? ' by ' + t.model : ''),
          g.moved && 'the record has moved since: it now ends at ' + when(r.ended),
          drawn && 'topics drawn from ' + drawn,
        ].filter(Boolean);
        return { rows, lines };
      },

      // ── The scope ─────────────────────────────────────────────────────────
      // The checkouts this session stood in, drawn as the pill on the strip.
      //
      // THE OWNER COMES FROM THE STORE (loadMarks reads it to find each
      // repository's manifest), not from a guess and not from a list
      // this component does not have. A record names checkouts ("web-tools"),
      // not repositories, and resolving one to the other needs an owner; the
      // store is already mounted with one (the `repo` option, defaulting to STORE) and
      // every repository in this estate sits under it. A host that mounts a
      // store elsewhere gets that owner, which is the right answer for the same
      // reason it is the right store.
      //
      // The honest limit, and it is the recorder's rather than this file's:
      // `repos` is where the shell stood, so a checkout worked entirely through
      // absolute paths never appears. Record schema 8 added `attached` for
      // exactly that, and it is preferred here where a record carries it.
      //
      // AND EVERY CHECKOUT THE SESSION PUSHED FROM (schema 15), which neither
      // list holds when the session cloned it partway through: bb88ffa7
      // pushed from nine directories and attached six, so the checkouts panel
      // left out three of them and their branches (found 2026-10-22).
      get scopeRepos() {
        const r = this.rec || {};
        const worked = (r.repos || []).map((x) => x && x.name).filter(Boolean);
        const attached = Array.isArray(r.attached) ? r.attached : [];
        const pushed = (r.pushed || []).map((x) => x && x.name).filter(Boolean);
        return [...new Set([...attached, ...worked, ...pushed])].sort();
      },
      get scopeNames() { return this.scopeRepos.join(', '); },
      // The checkouts the pill draws as marks: those whose repository declares
      // one. The rest are counted beside them.
      get scopeMarked() { return this.scopeRepos.filter((n) => this.marks[n]); },

      // ── The checkouts panel ───────────────────────────────────────────────
      // A group per checkout, its mark and name, then a line per branch the
      // session did work on there: its PR where the page has read one, whether
      // it was pushed, and how many renderable views it changed. ONE BRANCH A
      // ROW WAS WRONG: 25 of the 56 records from schema 15 on name more than
      // one branch in some repository, and one session pushed nine in
      // web-tools-private (2026-10-22 count).
      //
      // A branch is listed only where there is work on it: pushed, holding
      // commits that were never pushed, or known to the live compare. The
      // branch a checkout merely sat on with nothing committed is the
      // harness's name for the checkout, and the repository line says "no
      // commits" in its place.
      //
      // Three sources, best first: the branch's live compare and PR
      // (standalone, once loadWork has read them), the record's `pushed`
      // (schema 15), and `ahead_base`, the commits past main at the session's
      // last stop (schema 13). A record older than both says nothing, rather
      // than "no commits".
      get scopeRows() {
        const r = this.rec || {};
        const owner = String(this.repo || STORE).split('/')[0];
        const plain = (b) => !b || /^(main|master|HEAD)$/.test(b);
        const NONE = { word: 'no commits', mark: '', tone: 'text-base-content/40' };
        return this.scopeRepos.map((name) => {
          const at = (r.repos || []).find((x) => x && x.name === name) || {};
          const pushes = (r.pushed || []).filter((x) => x && x.name === name);
          const live = this.work.branches.filter((b) => b.repoShort === name);
          const measured = (r.schema || 0) >= 15 || Number.isInteger(at.ahead_base);
          const names = [...new Set([at.branch, ...pushes.map((x) => x.branch), ...live.map((b) => b.branch)])]
            .filter((b) => !plain(b));
          const branches = names.map((branch) => {
            const b = live.find((x) => x.branch === branch) || null;
            const pushed = pushes.some((x) => x.branch === branch) || !!(b && (b.pr || b.ahead > 0));
            const ahead = at.branch === branch ? at.ahead_base : 0;
            const look = pushed ? { word: 'pushed', mark: 'ph-arrow-up', tone: 'text-success' }
              : ahead > 0 ? { word: ahead + (ahead === 1 ? ' commit' : ' commits') + ', not pushed',
                              mark: 'ph-warning', tone: 'text-warning' }
              : null;
            const n = this.workOrder.find((x) => x.repoShort === name && x.branch === branch)?.n;
            return look && { branch, short: window.AssistantMark?.shortBranch?.(branch) || branch,
                             slug: owner + '/' + name, pushed, n: Number.isInteger(n) ? n : -1,
                             url: b?.url || 'https://mehrlander.github.io/web-tools/pages/branch.html#gh='
                                  + owner + '/' + name + '@' + encodeURIComponent(branch),
                             pr: b?.pr || 0, prState: b?.prState || '', prUrl: b?.prUrl || '',
                             files: Number.isInteger(b?.files) ? b.files : 0, ...look };
          }).filter(Boolean);
          return { name, icon: this.marks[name] || 'ph-bookmark-simple', branches,
                   ...(branches.length || !measured ? { word: '', mark: '', tone: '' } : NONE) };
        });
      },
      // Branches pushed, across every checkout: what the header counts.
      get scopePushed() { return this.scopeRows.reduce((n, g) => n + g.branches.filter((b) => b.pushed).length, 0); },
      // A branch line opens the branch deck at that branch, over this page,
      // where the page has read it, and on its Files pane from the file
      // count; otherwise the branch page.
      openBranchAt(b, pane) {
        this.closeFactTip();
        if (b.n < 0) { window.open(b.url + (pane ? '&pane=' + pane : ''), '_blank', 'noopener'); return; }
        this.$nextTick(() => this.openBranches(b.n, pane ? { pane } : {}));
      },

      // What the Look row draws. A plain read of the lent list, so a host that
      // knows nothing draws nothing and this page never fetches on its behalf.
      get pageChips() { return Array.isArray(o.pages) ? o.pages : []; },

      // One space before the plural, not "3 card s". The same helper
      // branch-brief carries, so the two decks' door wording assembles the
      // same way and node/test/deck-entry-parity.test.mjs can hold both to
      // swipeDeck.entry().
      plural(n, noun) { return n + ' ' + noun + (n === 1 ? '' : 's'); },

      // ── What the session opened ───────────────────────────────────────────
      // The record's `files` is {"<checkout>/<path>": {read, edit, write, …}},
      // captured by four file tools and nothing else (sessions/README.md). The
      // strip counts them; this is the list, which the brief had no route to.
      //
      // WEIGHT ORDER, from the sessions cache's own fileWeight, which is a plain
      // sum over the kinds: every access counts one, an edit the same as a
      // read. Alphabetical would answer a question nobody asks, and using the
      // kit rather than a rule of this pane's own is what stops this list and
      // the Sessions row's hover card ordering the same files two ways.
      //
      // The limit that follows, and the reason the per-kind badges exist: a
      // file read nine times outranks one edited six, which is not what "worked
      // on" means to a reader. The badges are where that is visible, so the
      // ordering is a first cut and the row itself says what happened.
      get fileRows() {
        const files = this.record?.files || {};
        const weigh = window.RepoSessionsCache?.fileWeight
          || (k => Object.values(k || {}).reduce((n, v) => n + (+v || 0), 0));
        return Object.entries(files)
          .map(([path, kinds]) => {
            const i = path.lastIndexOf('/');
            return {
              path,
              dir: i < 0 ? '' : path.slice(0, i + 1),
              name: i < 0 ? path : path.slice(i + 1),
              weight: weigh(kinds),
              // Sorted so the heaviest kind leads, and zeroes dropped: a file
              // that was only read should not carry an "e0".
              kinds: Object.entries(kinds || {})
                .filter(([, n]) => +n > 0)
                .map(([label, n]) => ({ label, n: +n }))
                .sort((a, b) => b.n - a.n),
              href: this.fileHref(path),
            };
          })
          .sort((a, b) => (b.weight - a.weight) || a.path.localeCompare(b.path));
      },

      // Files grouped by repository checkout and active branch:
      // The session's branches by branch name, in first-seen order, each
      // item carrying its index in the flat list the branch deck swipes.
      get workOrder() {
        const names = [...new Set(this.work.branches.map((b) => b.branch))];
        return names.flatMap((n) => this.work.branches.filter((b) => b.branch === n))
          .map((b, n) => ({ ...b, n }));
      },
      get branchGroups() {
        const rows = this.fileRows;
        if (!rows.length) return [];
        const repos = this.record?.repos || [];
        const repoMap = new Map();
        for (const r of repos) {
          if (r?.name) repoMap.set(r.name, r);
        }

        const groups = [];
        const byRepo = new Map();
        const unassigned = [];

        for (const f of rows) {
          const slash = f.path.indexOf('/');
          const repoName = slash >= 0 ? f.path.slice(0, slash) : '';
          const relPath = slash >= 0 ? f.path.slice(slash + 1) : f.path;
          const relDirIdx = relPath.lastIndexOf('/');
          const relDir = relDirIdx >= 0 ? relPath.slice(0, relDirIdx + 1) : '';
          const relName = relDirIdx >= 0 ? relPath.slice(relDirIdx + 1) : relPath;

          const fileItem = {
            ...f,
            relPath,
            relDir,
            relName,
          };

          if (repoName && repoMap.has(repoName)) {
            if (!byRepo.has(repoName)) byRepo.set(repoName, []);
            byRepo.get(repoName).push(fileItem);
          } else {
            unassigned.push(fileItem);
          }
        }

        for (const r of repos) {
          const files = byRepo.get(r.name) || [];
          if (files.length > 0) {
            groups.push({
              repo: r.name,
              branch: r.branch || '',
              files,
              branchUrl: r.branch ? `https://mehrlander.github.io/web-tools/pages/branch.html#gh=${String(this.repo || STORE).split('/')[0]}/${encodeURIComponent(r.name)}@${encodeURIComponent(r.branch)}` : '',
            });
          }
        }

        for (const [repoName, files] of byRepo.entries()) {
          if (!repos.some(r => r.name === repoName)) {
            groups.push({
              repo: repoName,
              branch: '',
              files,
              branchUrl: '',
            });
          }
        }

        if (unassigned.length > 0) {
          groups.push({
            repo: 'other',
            branch: '',
            files: unassigned,
            branchUrl: '',
          });
        }

        return groups;
      },
      // Why the list is empty, which is two different answers. A record written
      // before schema 3 never captured file attention at all, and saying "no
      // files" over one of those would be a claim about the session rather than
      // about the record. Same distinction the Sessions row draws with its
      // dimmed files glyph.
      get filesNote() {
        if (!this.record) return 'Waiting for the record.';
        return (this.rec.schema || 0) < 3
          ? 'This record predates file-attention capture (schema 3); its files were never recorded.'
          : 'No files were opened by Read, Edit, Write or NotebookEdit. A file read through a shell command is not counted.';
      },
      // A GitHub link for a checkout-prefixed path, or '' for none.
      //
      // THE HOST SUPPLIES IT, because the record cannot. Its paths name a
      // checkout ("web-tools/lib/x.js") and its `repos` names that checkout's
      // branch, but nothing in the store knows the OWNER, and guessing one is
      // how a list of working links becomes a list of 404s. The app resolves
      // it against the estate and passes a function; a cold page has no estate
      // and the rows are plain text, which is the honest version of not knowing.
      fileHref(path) {
        if (typeof o.fileHref !== 'function') return '';
        try { return o.fileHref(path, this.record) || ''; } catch { return ''; }
      },

      get cards() {
        if (!this.record || !window.sessionRender) return 0;
        const sr = window.sessionRender;
        return sr.groups(sr.turns(this.record)).length;
      },
      get rawJson() { return this.record ? JSON.stringify(this.record, null, 2) : ''; },
      // THE STORED FILE'S SIZE, not the length of rawJson. That getter
      // serializes the whole record, and the tab label read it on every
      // render: about a second and a second 57 MB string for the largest
      // record in the store (bb88ffa7, 2026-10-22), to print one number. A
      // record with no file behind it (#gz=) is measured once and remembered.
      get rawSize() {
        const r = this.record;
        const n = !r ? 0 : r._size || sizeOf(r);
        return !n ? '' : n < 1024 ? n + 'B' : n < 1048576 ? Math.round(n / 1024) + 'K' : (n / 1048576).toFixed(1) + 'M';
      },
      // The record where it is stored. Absent for a mount handed its record
      // outright (#gz=), which has no file to point at; the button binds to
      // this rather than to the record, so an honest absence is a missing
      // button rather than a link that goes nowhere.
      get recordUrl() {
        return this.path ? window.RepoAddress.github.blob(this.repo, 'main', this.path) : '';
      },

      // Search the record already in hand. The estate index is only a cheap
      // session filter; this is where its result becomes a source passage.
      runFind(notify = true, force = false) {
        const query = this.findText.trim();
        if (!force && query === this.findQuery && this.record) return;
        this.findQuery = query;
        this.findAt = 0;
        this.findCopied = -1;
        this.findCopyError = '';
        this.findResult = window.sessionRender?.find?.(this.record, query)
          || { terms: [], hits: [], total: 0, occurrenceTotal: 0, matchedTerms: [], allTerms: false };
        if (this.record && typeof o.onMatches === 'function') {
          const result = this.findResult;
          try {
            o.onMatches({ exchanges: result.hits.length, passages: result.total,
              occurrences: result.occurrenceTotal, matchedTerms: [...result.matchedTerms], allTerms: result.allTerms });
          } catch { /* a host callback must not prevent reading the source */ }
        }
        if (notify && typeof o.onFind === 'function') o.onFind(query);
      },
      openMatchedSession() {
        return this.openDeck(this.findResult.hits[this.findAt]?.card ?? 0);
      },
      submitFind() {
        if (this.findText.trim() === this.findQuery) this.stepFind(1);
        else this.runFind();
      },
      clearFind() {
        this.findText = '';
        this.runFind();
        this.$nextTick(() => this.mountOutline());
      },
      stepFind(delta) {
        const n = this.findResult.hits.length;
        if (!n) return;
        this.findAt = (this.findAt + delta + n) % n;
        this.$nextTick(() => {
          this.$el.querySelectorAll('[data-session-match]')[this.findAt]
            ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      },
      findTime(at) {
        const date = new Date(at);
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      },
      findParts(text) {
        return window.sessionRender?.findParts?.(text, this.findResult.terms)
          || [{ text: String(text || ''), match: false }];
      },
      exchangeUrl(card) {
        if (!Number.isInteger(card) || card < 0) return '';
        const url = new URL('https://mehrlander.github.io/web-tools/pages/session.html');
        const query = new URLSearchParams(location.search);
        const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''));
        // Preserve a standalone payload. Named records use the resolved path,
        // so a branch acquiring another session cannot retarget this exchange.
        // A deck mount must name its own subject, not its outer page.
        const identity = !this.framed && ['gz', 'gh', 'id'].find(k => hash.get(k) || query.get(k));
        const at = new URLSearchParams();
        if (identity === 'gz') at.set(identity, hash.get(identity) || query.get(identity));
        else if (this.path) at.set('gh', this.repo + ':' + this.path);
        else if (identity) at.set(identity, hash.get(identity) || query.get(identity));
        else if (this.shortId && this.repo === STORE) at.set('id', this.shortId);
        else return '';
        at.set('card', String(card));
        if (this.findQuery) at.set('find', this.findQuery);
        const now = hash.get('now') || query.get('now');
        if (now) at.set('now', now);
        const loadedRef = window.__lib || window.gh?.ref;
        const use = query.get('use') || (loadedRef && loadedRef !== 'main' ? loadedRef : '');
        if (use) url.searchParams.set('use', use);
        for (const ref of query.getAll('refs')) url.searchParams.append('refs', ref);
        url.hash = at.toString();
        return url.href;
      },
      async copyExchange(card) {
        const url = this.exchangeUrl(card);
        if (!url) return;
        this.findCopyError = '';
        try {
          await navigator.clipboard.writeText(url);
          this.findCopied = card;
        } catch {
          this.findCopyError = 'The exchange link could not be copied. Try again with clipboard access enabled.';
        }
      },

      // ── The read ──────────────────────────────────────────────────────────
      async load() {
        this.loading = true; this.err = '';
        try {
          // The kit chain first, and ABOVE the record short-circuit. A mount
          // handed its record outright (#gz=, a deck's neighbour, the app's
          // estate view) skips the FETCH, not the renderers: `settle()` reads
          // session-render, and the picker's rows read read-aloud to reduce a
          // reply to a line of prose. Returning before `ready()` gave the one
          // reader who needs #gz= the worst copy of the page: no speaker on the
          // deck, no Listen in the head, and markdown markers down every row.
          await this.ready();
          if (this.record) { this.settle(); return; }
          // A branch names no file, so it resolves before anything guesses one.
          if (this.branch && !this.path) { await this.resolveBranch(); this.settle(); return; }
          let path = this.path || this.guessPath();
          // A GUESS is not a resolution. `pathOf` derives a path from the day
          // and the id and always returns one, so a row with a day the record
          // does not carry yields a path that 404s. Cheap to try (one blob
          // read, and it is right for every row the sessions cache built) and
          // cheap to be wrong about, since the listing below is the real answer
          // and is read once per store however many slides ask.
          if (path) {
            try { this.record = await readRecord(this.repo, path); this.path = path; }
            catch { path = ''; }
          }
          if (!this.record) {
            path = await this.resolvePath();
            if (!path) throw new Error(`No record for ${this.id} in ${this.repo}. An id is the eight hex characters after the date, like 2bf8fcae; the whole stem (2026-08-05-2bf8fcae) works too.`);
            this.record = await readRecord(this.repo, path);
            this.path = path;
          }
          this.settle();
        } catch (e) {
          this.err = 'Could not open ' + (this.id || this.branch || this.path) + ': ' + (e?.message || e);
        } finally { this.loading = false; }
      },

      // The kit chain, pulled on first use. Order matters and runs bottom-up:
      // proof backs chat-render's sandboxed frames, swipe-deck owns the track,
      // chat-render renders a turn, session-render sits on all three, and
      // session-export reads session-render (which is why the deck's Export
      // button appears only when it is already here). A host that has already
      // loaded them pays nothing: the loader dedupes by registry.
      async ready() {
        if (window.sessionRender && window.sessionExport && window.readAloud
            && window.TitleTip && window.ClosingState) return;
        if (!window.gh?.load) return;
        for (const k of ['kits/proof.js', 'kits/swipe-deck.js', 'kits/chat-render.js',
                         'kits/session-render.js', 'kits/session-export.js', 'kits/read-aloud.js',
                         'kits/title-tip.js', 'kits/closing-state.js']) {
          await window.gh.load(k);
        }
      },

      // ── Listening ─────────────────────────────────────────────────────────
      //
      // A DOOR, not a player. This brief used to carry its own transport, which
      // was two UIs for one job and the weaker of the two: reading aloud is
      // reading, the deck is where a session is read, and only the deck knows
      // which card the reader is on. So the button opens the deck and the deck
      // starts speaking; kits/read-aloud.js `deckAction` owns everything after.
      //
      // The card it opens on is the reader's, not the top. From the outline
      // they have already chosen a moment; from the head there is no choice yet
      // and card 0 is the honest answer.
      async listen(at) {
        await this.openDeck(Number.isInteger(at) ? at : 0, { speak: true });
      },


      // A short id is what a reader actually has: the eight hex characters
      // AFTER the date in the filename, which is what search.py --show and the
      // Sessions pane both print. It is not the filename stem, which carries
      // the date too (2026-08-05-b8fae678), and calling it one here for three
      // releases is what sent a hand-built link to the empty-record error on
      // 2026-09-05: the store's own directory listing shows stems, so a stem is
      // the natural thing to paste. The day narrows the search to one directory
      // where the host knows one; without a day, one recursive tree read names
      // every record and the match is on the suffix. Either way the listing is
      // cached per store, so a deck of sessions reads it once.
      guessPath() {
        if (!this.id || !/^\d{4}-\d{2}-\d{2}$/.test(this.day)) return '';
        return window.RepoSessionsCache?.pathOf?.({ id: this.id, day: this.day }) || '';
      },
      // BOTH FORMS RESOLVE, because both are on screen somewhere: the bare
      // short id every surface prints, and the dated stem the store's directory
      // listing shows. Matching only the first made a link built from the
      // listing fail on a record that was there, and the error said `filename
      // stem` while rejecting one.
      async resolvePath() {
        if (!this.id) return '';
        const tree = await listing(this.repo);
        const short = String(this.id).replace(/^\d{4}-\d{2}-\d{2}-/, '');
        return tree.find(p => p.endsWith(`-${short}.json`)) || '';
      },

      // ── Addressing a session by the branch it worked on ───────────────────
      //
      // The one address a phone can produce without knowing anything about this
      // store. The Claude app will copy the branch a session is on and copies
      // nothing else about it, so a branch name is the only handle that crosses
      // from there to here, and `Choose-Claude` in shortcut-tools hands it
      // straight to this page.
      //
      // WHY THIS WALKS RATHER THAN READS AN INDEX. Nothing in the store joins a
      // branch to a record: the branch lives inside each record's `repos`, and
      // the one derived file that lifts it out, state/sessions.json, is 7 MB,
      // which is the wrong thing to hand a phone to answer one question. So the
      // tree listing (one call, cached, names every record and is already read
      // for #id=) orders the candidates and each is opened newest first. The
      // wanted session is the one being looked at while the branch was copied,
      // so it is the first or second read in the case this exists for.
      //
      // The tie is the honest limit. A filename carries the day and the id, so
      // ordering is exact ACROSS days and arbitrary WITHIN one; `started` is
      // the real answer and only a fetched record has it. So the walk does not
      // stop on a match: it finishes that day and keeps the latest start, which
      // costs at most one day of reads and makes "the latest session on this
      // branch" true rather than nearly true.
      async resolveBranch() {
        const want = branchOf(this.branch);
        if (!want) return '';
        const tree = await listing(this.repo);
        const paths = [...tree].sort().reverse();
        const day = (p) => (p.match(/(\d{4}-\d{2}-\d{2})-[0-9a-f]+\.json$/) || [])[1] || '';

        let best = null, bestDay = '', read = 0;
        for (const path of paths) {
          // Past the matching day, nothing left can be later. Also the only
          // exit that is not the cap, which is why the cap is generous.
          if (best && day(path) < bestDay) break;
          if (++read > WALK_CAP) break;
          let rec;
          try { rec = await readRecord(this.repo, path); } catch { continue; }
          if (!sessionBranches(rec).some(r => r.branch === want)) continue;
          // Paths run newest day first, so the first hit fixes the day and only
          // a later `started` inside it can displace the record.
          if (!best) { best = rec; bestDay = day(path); this.path = path; }
          else if ((rec.started || '') > (best.started || '')) { best = rec; this.path = path; }
        }
        if (!best) {
          throw new Error(`No session on ${want} in the ${read} most recent records.`
            + ' A record is published when the session it describes stops, so a live one may not be here yet.');
        }
        this.record = best;
        this.id = best.short || this.id;
        return this.path;
      },

      // ── Now: the branches, their open asks, and what they render ─────────
      // A record names each checkout's branch and stops. What the branch
      // changed, its PR and the PR's open threads are GitHub's to know, so the
      // standalone page asks: one readBrief per branch (compare plus pulls),
      // one commit lookup per viewable for the order. The last closing state
      // comes from the record itself.
      async loadWork() {
        const w = this.work;
        if (w.loaded || w.loading || !this.record) return;
        w.loading = true;
        for (const k of ['kits/closing-state.js', 'kits/guide-render.js', 'kits/branch-brief.js', 'kits/chat-render.js']) {
          if (window.gh?.load) await window.gh.load(k).catch(() => {});
        }
        w.last = this.lastClosing();
        this.loadNow();
        if (!this.framed) this.loadCalls();
        const owner = String(this.repo || STORE).split('/')[0];
        const refs = sessionBranches(this.record);
        if (!refs.length || !window.GH) { w.loading = false; w.loaded = true; return; }
        try {
          const got = await Promise.all(refs.map((r) => this.readBranch(owner + '/' + r.name, r.branch)));
          w.branches = got.map((g) => g.branch);
          w.asks = got.flatMap((g) => g.asks);
          const views = got.flatMap((g) => g.views);
          // Grouped by repo and branch, the group with the newest view first,
          // newest first within each: the strip, its contents list and the
          // full-screen deck then share one order and one n/m.
          const keyOf = (v) => v.slug + '@' + v.branch;
          const newest = new Map();
          for (const v of views) if ((v.at || '') > (newest.get(keyOf(v)) || '')) newest.set(keyOf(v), v.at || '');
          views.sort((a, b) => (newest.get(keyOf(b)) || '').localeCompare(newest.get(keyOf(a)) || '')
                               || keyOf(a).localeCompare(keyOf(b))
                               || (b.at || '').localeCompare(a.at || ''));
          w.views = views.slice(0, 24);
          const errs = got.filter((g) => g.err).map((g) => g.err);
          if (errs.length && !views.length) w.err = errs[0];
          if (this.pane === 'views') this.fillMarkdown();
        } catch (e) {
          w.err = 'Could not read the branches: ' + (e?.message || e);
        } finally { w.loading = false; w.loaded = true; }
      },

      async readBranch(slug, branch) {
        const repoShort = slug.split('/').pop();
        const short = window.AssistantMark.shortBranch(branch);
        const gh = new window.GH({ token: window.TOKEN, repo: slug, ref: branch });
        const b = { slug, branch, repoShort, short, icon: 'ph-git-branch', pr: 0, prState: '', views: 0,
                    url: 'https://mehrlander.github.io/web-tools/pages/branch.html#gh=' + slug + '@' + encodeURIComponent(branch) };
        const out = { branch: b, asks: [], views: [], err: '' };
        try {
          const conf = await gh.get('.web-tools.json').then((r) => JSON.parse(r.text)).catch(() => null);
          if (conf?.icon) b.icon = conf.icon;
          const r = await window.BranchBrief.readBrief(gh, { repo: slug, branch, base: 'main' });
          const cmp = r.compare || {};
          b.ahead = cmp.ahead_by ?? '?'; b.behind = cmp.behind_by ?? '?';
          b.files = (cmp.files || []).length;
          b.updated = (cmp.commits || []).at(-1)?.commit?.committer?.date || '';
          const pr = (r.pulls || [])[0];
          if (pr) {
            b.pr = pr.number;
            b.prTitle = pr.title || '';
            b.prUrl = pr.html_url || window.RepoAddress.github.pull(slug, pr.number);
            b.prState = pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : pr.draft ? 'draft' : 'open';
            b.url += '&pr=' + pr.number;
            if (!pr.merged_at && pr.state !== 'closed') {
              for (const t of this.openThreads(pr.body)) {
                if (!/^(🛵|✴|👁|✍|🪧|⚖|🆚|🟠)/u.test(t.glyph)) continue;
                out.asks.push({ ...t, key: slug + '#' + pr.number + ':' + t.title, pr: pr.number,
                                repoShort, prUrl: pr.html_url || window.RepoAddress.github.pull(slug, pr.number) });
              }
            }
          }
          // One card per distinct content: a byte-identical copy (a vendored
          // doc beside its source) is the same view twice.
          const seenSha = new Set();
          const paths = (r.compare?.files || [])
            .filter((f) => f.status !== 'removed' && /\.(html?|md|markdown)$/i.test(f.filename))
            .filter((f) => !f.sha || (!seenSha.has(f.sha) && seenSha.add(f.sha)))
            .map((f) => f.filename);
          const showing = conf?.showing || null;
          const dated = await Promise.all(paths.slice(0, 24).map(async (path) => {
            const c = await gh.req('commits?sha=' + encodeURIComponent(branch) + '&path=' + encodeURIComponent(path) + '&per_page=1').catch(() => null);
            return { path, at: c?.[0]?.commit?.committer?.date || '' };
          }));
          for (const { path, at } of dated) {
            const md = /\.(md|markdown)$/i.test(path);
            const t = md ? null : (window.GuideRender?.pageTargets?.(slug, branch, [path], showing) || [])[0];
            out.views.push({
              key: slug + '@' + branch + ':' + path, kind: md ? 'md' : 'html', path, at,
              name: path.split('/').pop(), dir: path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '',
              repoShort, short, icon: b.icon, slug, branch, html: '',
              url: t ? t.url : window.RepoAddress.github.blob(slug, branch, path),
              ago: at ? this.ago(at) : '',
            });
          }
          b.views = out.views.length;
        } catch (e) {
          out.err = slug + '@' + branch + ': ' + (e?.message || e);
        }
        return out;
      },

      // The Views tab: its Markdown is read on the first visit, and the strip
      // lands on the card it was left at.
      openViewsPane() {
        this.pane = 'views';
        this.fillMarkdown();
        this.$nextTick(() => { this.settlePane(); this.goView(this.vAt); });
      },
      // Markdown views render in place: the raw file at the branch, through
      // marked once chat-render has fetched it.
      async fillMarkdown(list = this.work.views) {
        // Only what has not been read. Marked by
        // `mdRead`, not by an empty `html`: a view is born with html '', so
        // the test this first shipped with (html undefined) read nothing and
        // every document rendered blank (owner, 2026-10-22).
        const md = list.filter((v) => v.kind === 'md' && !v.mdRead);
        if (!md.length) return;
        for (const v of md) v.mdRead = true;
        await window.chatRender?.ready?.().catch(() => {});
        for (const v of md) {
          try {
            const gh = new window.GH({ token: window.TOKEN, repo: v.slug, ref: v.branch });
            const text = (await gh.get(v.path)).text;
            v.html = window.marked ? window.marked.parse(text) : '';
          } catch { v.html = ''; }
        }
      },

      // The PR guide's Open threads, one entry per numbered line:
      // "1. 🛵 **Title**: text". Everything outside that section is ignored.
      openThreads(body) {
        const src = String(body || '');
        const at = src.search(/^## +Open threads\s*$/m);
        if (at < 0) return [];
        const block = src.slice(at).split('\n').slice(1).join('\n').split(/^## |^---|^\[\/\/\]: # \(\/guide\)/m)[0];
        const out = [];
        for (const m of block.matchAll(/^\s*\d+\.\s*(\S+)\s+\*\*(.+?)\*\*:?\s*(.*)$/gm)) {
          out.push({ glyph: m[1], title: m[2].replace(/:$/, ''), text: m[3] });
        }
        return out;
      },

      // The last closing state any reply carried, through kits/closing-state.js.
      lastClosing() {
        const cs = window.ClosingState;
        const replies = this.record?.replies || [];
        if (!cs) return null;
        for (let i = replies.length - 1; i >= 0; i--) {
          const c = cs.closings(replies[i]?.text || '');
          if (c.length) return { ...c[c.length - 1], at: replies[i]?.at || '' };
        }
        return null;
      },

      // ── What Gemini made of it ─────────────────────────────────────────────
      // Best effort and silent: most of the store has no topics file yet, and a
      // session without one reads exactly as it did before there were any.
      async loadTopics() {
        if (this.topics || !this.path || !window.GH) return;
        this.topicsState = 'reading';
        try {
          if (!window.RepoSessionsCache && window.gh?.load) await window.gh.load('kits/repo-sessions-cache.js');
          const doc = await readTopics(this.repo || STORE, this.path);
          if (!doc || typeof doc !== 'object') { this.topicsState = 'unread'; return; }
          this.topics = doc;
          this.topicsState = 'found';
        } catch (e) { this.topicsState = e?.status === 404 ? 'none' : 'unread'; return; }
        if (this.outlineBuilt) this.remountOutline();
      },

      // ── The action message ─────────────────────────────────────────────────
      async loadNow() {
        if (this.framed || !this.path || !window.GH) return;
        try {
          const g = new window.GH({ token: window.TOKEN, repo: this.repo || STORE, ref: this.nowRef });
          this.now = JSON.parse((await g.get(this.path.replace(/\.json$/, '.now.json'))).text);
          this.nowErr = '';
          this.loadAnswers();
        } catch (e) {
          this.now = null;
          // Silent on main, where most sessions have none; loud when the
          // address asked for a ref, since then the reader expected one.
          this.nowErr = this.nowRef !== 'main' ? 'No action message on ' + this.nowRef + ': ' + (e?.message || e) : '';
        }
      },
      // ── Answers: one JSON line per answer, appended, never edited ──────────
      answersPath() { return this.path.replace(/\.json$/, '.now.answers.jsonl'); },
      async loadAnswers() {
        try {
          const g = new window.GH({ token: window.TOKEN, repo: this.repo || STORE, ref: this.nowRef });
          const t = (await g.get(this.answersPath(), window.GH.FRESH)).text;
          this.answers = t.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
        } catch { this.answers = []; }
      },
      // The latest answer to an ask wins; earlier ones stay in the file.
      answerFor(a) {
        for (let i = this.answers.length - 1; i >= 0; i--) if (this.answers[i].ask === a.id) return this.answers[i];
        return null;
      },
      askPr(a) {
        const l = (a.links || []).find((x) => x.kind === 'pr');
        const m = l && String(l.ref).match(/^([^/]+\/[^#]+)#(\d+)$/);
        return m ? { slug: m[1], n: m[2], label: m[1].split('/').pop() + ' #' + m[2] } : null;
      },
      startAnswer(a, o) {
        if (this.answering?.ask === a.id && this.answering.option === o) { this.answering = null; return; }
        this.answering = { ask: a.id, option: o, note: '', comment: !!this.askPr(a), busy: false, err: '' };
      },
      // ── User calls ─────────────────────────────────────────────────────────
      // The store at the message's ref, and each repo the session touched at
      // main: a user call lives in the user-calls/ folder of the repo it governs.
      async loadCalls() {
        const sid = this.shortId;
        if (!sid || !window.GH || this.callsLoading) return;
        this.callsLoading = true;
        const owner = String(this.repo || STORE).split('/')[0];
        const places = [{ repo: this.repo || STORE, ref: this.nowRef }];
        for (const r of this.record?.repos || []) {
          const slug = owner + '/' + r.name;
          if (r.name && !places.some((p) => p.repo === slug)) places.push({ repo: slug, ref: 'main' });
        }
        const found = [];
        await Promise.all(places.map(async ({ repo, ref }) => {
          const g = new window.GH({ token: window.TOKEN, repo, ref });
          let list = [];
          try { list = await g.req('contents/user-calls?ref=' + encodeURIComponent(ref)); } catch { return; }
          const mine = (Array.isArray(list) ? list : []).filter((f) => new RegExp('^' + sid + '-[a-z0-9-]+\\.json$').test(f.name));
          await Promise.all(mine.map(async (f) => {
            try {
              const c = JSON.parse((await g.get(f.path)).text);
              found.push({ ...c, _repo: repo, _ref: ref, _path: f.path });
              this.loadCallAnswers(found[found.length - 1]);
            } catch { /* one unreadable call is not the list failing */ }
          }));
        }));
        found.sort((a, b) => (a.status === 'closed') - (b.status === 'closed') || (a.created || '').localeCompare(b.created || ''));
        this.calls = found;
        this.callsLoading = false;
        // An address that asked for the Calls tab of a session with none
        // lands on the outline instead of an empty pane.
        if (this.pane === 'calls' && !found.length) { this.pane = 'outline'; this.$nextTick(() => this.mountOutline()); }
        const want = (() => {
          try {
            // `user-call`, and `call` from before the rename (2026-10-04), so
            // a link handed over earlier still opens its slide.
            const h = new URLSearchParams((location.hash || '').replace(/^#/, '')), s = new URLSearchParams(location.search);
            return h.get('user-call') || h.get('call') || s.get('user-call') || s.get('call');
          } catch { return null; }
        })();
        const at = want ? found.findIndex((c) => c.slug === want || c.id === want) : -1;
        // Standalone only: in the app, `call` is the Waiting view's key.
        if (at >= 0 && !this._callOpened && !this.framed) { this._callOpened = true; this.$nextTick(() => this.openCalls(at)); }
      },
      // A call as the Calls tab shows it: its kind, and where it stands.
      callKindIcon(c) { return { documentation: 'ph-pencil-line', merge: 'ph-git-merge' }[c.kind] || 'ph-scales'; },
      callKindLabel(c) { return { documentation: 'Edits', merge: 'Merge' }[c.kind] || 'Decision'; },
      callState(c) { return c.status === 'closed' ? 'Closed' : this.callDone(c) ? 'Answered: ' + this.callDone(c) : 'Open'; },
      callStateTone(c) { return c.status !== 'closed' && !this.callDone(c) ? 'border-0 bg-warning/30 text-warning-content' : 'badge-ghost'; },
      get openCallCount() { return this.calls.filter((c) => c.status !== 'closed' && !this.callDone(c)).length; },
      // The answer buttons a card offers, as Waiting's footer does: Merge for a
      // merge, an older call's options with the recommended one first, and
      // none once it is answered or closed. A call filed as Take or Adjust
      // has the reply box instead (callAdjustable). A documentation call is
      // answered in Dictate, through its form.
      callOpts(c) {
        if (!c || c.status === 'closed' || this.callDone(c) || c.kind === 'documentation') return [];
        if (c.kind === 'merge') return ['Merge'];
        const os = (c.options || []).map((x) => typeof x === 'string' ? x : x?.label).filter(Boolean);
        return os.includes(c.recommend) ? [c.recommend, ...os.filter((x) => x !== c.recommend)] : os;
      },
      callAdjustable(c) {
        return !!c && c.status !== 'closed' && !this.callDone(c) && (c.kind || 'decision') === 'decision' && !(c.options || []).length && !!c.recommend;
      },
      // Size and cautions, in Waiting's words (waiting.js shapeOf). The size is
      // of the work the recommended answer sets off, on the tracker's scale
      // (docs/TRACKER.md), not of the decision.
      CALL_SIZES: { XS: 'folds into another pass', S: 'one session with room to spare', M: 'one full session',
                    L: 'several sessions', XL: 'a project', '?': 'not sizable until it is designed' },
      callChips(c) {
        const out = [], caution = 'border-0 bg-warning/30 text-warning-content';
        if (c?.size) out.push({ key: 'size', icon: 'ph-t-shirt', label: c.size, tone: 'badge-ghost',
          tip: 'Size ' + c.size + ', ' + (this.CALL_SIZES[c.size] || '') + ': the work the recommended answer sets off.' });
        if (c?.confidence === 'lean') out.push({ key: 'lean', icon: 'ph-scales', label: 'Lean', tone: caution,
          tip: 'Another option has a real case' + (c.why ? ': ' + c.why : '.') });
        if (c?.reversible === false) out.push({ key: 'oneway', icon: 'ph-lock-simple', label: 'One-way', tone: caution,
          tip: 'The answer cannot be cheaply undone.' });
        return out;
      },
      // The reply box grows with what is written in it.
      fitCallNote(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; },
      tapCallSend(c) {
        const note = (this.callNotes[c.id] || '').trim();
        this.tapCallAnswer(c, note ? 'Adjust' : 'Take', 'send', note);
      },
      callBtnClass(c, o) {
        if (this.callArmed === c.id + '|' + o) return 'btn-success';
        return o === 'Take' || o === 'Merge' || o === c.recommend ? 'btn-primary' : 'btn-ghost border-base-300';
      },
      tapCallAnswer(c, o, armAs = o, note = '') {
        if (this.callSending[c.id]) return;
        const k = c.id + '|' + armAs;
        if (this.callArmed !== k) {
          this.callArmed = k; clearTimeout(this._callArmT);
          this._callArmT = setTimeout(() => { if (this.callArmed === k) this.callArmed = ''; }, 4000);
          return;
        }
        this.callArmed = ''; clearTimeout(this._callArmT);
        this.sendCallAnswer(c, o, note);
      },
      // One answer line beside the call, commented on its PR first when it
      // names one, in the call form's words.
      async sendCallAnswer(c, o, note = '') {
        this.callSending = { ...this.callSending, [c.id]: o };
        this.callErr = { ...this.callErr, [c.id]: '' };
        try {
          if (!window.TOKEN) throw new Error('no GitHub token in this browser');
          if (!window.UserCallForm && window.gh?.load) await window.gh.load('alpineComponents/user-call-form.js');
          const H = window.UserCallForm;
          if (!H) throw new Error('the call page\'s helpers did not load');
          const adj = o === 'Adjust';
          const entry = { answer: o, ...(adj ? { then: 'go' } : {}), note, at: new Date().toISOString() };
          const pr = H.prOf(c.pr);
          const what = adj ? '**Adjust**, then **go**: make the change and carry on'
            : o === 'Take' && c.recommend ? '**Take**, the recommendation: ' + c.recommend : '**' + o + '**';
          const body = '**User call: ' + c.question + '**\n\nAnswer: ' + what + (note ? '\n\n> ' + note : '')
            + '\n\n_' + (c.id || '') + ', sent from the session\'s Calls tab._';
          await H.postAnswer({ repo: c._repo, ref: c._ref || 'main', path: c._path.replace(/\.json$/, '.answers.jsonl'),
                               entry, pr, comment: pr ? body : '' });
          this.callAnswers = { ...this.callAnswers, [c.id]: [...(this.callAnswers[c.id] || []), entry] };
          this.callNotes = { ...this.callNotes, [c.id]: '' };
        } catch (e) { this.callErr = { ...this.callErr, [c.id]: 'Not sent: ' + (e?.message || e) }; }
        this.callSending = { ...this.callSending, [c.id]: false };
      },
      async loadCallAnswers(c) {
        try {
          const g = new window.GH({ token: window.TOKEN, repo: c._repo, ref: c._ref });
          const t = (await g.get(c._path.replace(/\.json$/, '.answers.jsonl'), window.GH.FRESH)).text;
          this.callAnswers = { ...this.callAnswers,
            [c.id]: t.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) };
        } catch { /* none yet */ }
      },
      // The answer that stands: the call's own close, else the latest line.
      callDone(c) {
        if (c.closed?.answer) return c.closed.answer;
        const a = this.callAnswers[c.id] || [];
        return a.length ? a[a.length - 1].answer : '';
      },
      // The session's calls as a deck over the page, one userCallForm per slide.
      openCalls(start = 0) {
        const list = this.calls;
        if (!window.swipeDeck || !list.length) return;
        // Each form reports its kind and PR pill for the header, and the
        // header shows the slide in view: the deck says what the call is, so
        // the form below it need not.
        const host = this, keys = [], heads = [];
        let h = null, cur = start;
        const paint = (i) => {
          const hd = heads[i];
          if (!h || !hd) return;
          h.setTitle?.(hd.title); h.setIcon?.(hd.icon); h.setTitleMark?.(hd.mark || null);
          h.setActions?.(hd.action ? [hd.action] : []);
        };
        h = window.swipeDeck.open({
          count: list.length, start,
          slideScroll: false,
          innerClass: 'h-full w-full min-w-0',
          icon: 'ph-gavel',
          title: 'Calls',
          subtitle: this.head?.title || this.shortId,
          index: (i) => ({ title: list[i].question, subtitle: host.callDone(list[i]) ? 'Answered ' + host.callDone(list[i]) : 'Open',
                           icon: host.callDone(list[i]) ? 'ph-check-circle' : 'ph-gavel' }),
          render: (i, slide) => {
            const c = list[i];
            const key = '__call' + i + '_' + Date.now().toString(36);
            keys[i] = key;
            window[key] = { call: c, repo: c._repo, ref: c._ref, path: c._path,
                            onHead: (hd) => { heads[i] = hd; if (i === cur) paint(i); },
                            onAnswer: (entry) => { host.callAnswers = { ...host.callAnswers, [c.id]: [...(host.callAnswers[c.id] || []), entry] }; } };
            const el = document.createElement('div');
            el.className = 'h-full';
            el.setAttribute('x-data', 'userCallForm(window.' + key + ')');
            slide.append(el);
            window.Alpine.initTree(el);
          },
          release: (i) => { if (keys[i]) { delete window[keys[i]]; keys[i] = null; } },
          onSlide: (i) => { cur = i; paint(i); },
        });
        paint(cur);
      },

      async sendAnswer(a) {
        const ans = this.answering;
        if (!ans || ans.busy) return;
        ans.busy = true; ans.err = '';
        try {
          if (!window.GH.toBase64 && window.gh?.load) await window.gh.load('gh-store.js');
          const repo = this.repo || STORE, path = this.answersPath();
          const g = new window.GH({ token: window.TOKEN, repo, ref: this.nowRef });
          const by = (await g.req('/user').catch(() => ({})))?.login || '';
          const entry = { ask: a.id, answer: ans.option, note: ans.note.trim(), at: new Date().toISOString(), by };
          // The comment first, so its address rides in the answer that names it.
          const pr = ans.comment ? this.askPr(a) : null;
          if (pr) {
            const body = '**Answer to `' + a.id + '`** (session ' + (this.shortId || '') + '): **' + ans.option + '**'
              + (entry.note ? '\n\n> ' + entry.note : '') + '\n\n' + a.q
              + '\n\n_Sent from the session page._';
            const c = await new window.GH({ token: window.TOKEN, repo: pr.slug })
              .req('issues/' + pr.n + '/comments', { method: 'POST', body: JSON.stringify({ body }) });
            entry.comment = c?.html_url || '';
          }
          // Append, as kits/notes.js does: read fresh, add a line, PUT with the
          // sha, and on a lost race read again.
          for (let tries = 1; ; tries++) {
            let cur = { text: '', sha: null };
            try { const f = await g.get(path, window.GH.FRESH); cur = { text: f.text, sha: f.sha }; }
            catch (e) { if (e?.status !== 404) throw e; }
            const text = (cur.text && !cur.text.endsWith('\n') ? cur.text + '\n' : cur.text) + JSON.stringify(entry) + '\n';
            const put = { message: 'now: answer ' + a.id + ' = ' + ans.option, content: window.GH.toBase64(text), branch: this.nowRef };
            if (cur.sha) put.sha = cur.sha;
            try { await g.req('contents/' + path, { method: 'PUT', body: JSON.stringify(put) }); break; }
            catch (e) { if ((e?.status !== 409 && e?.status !== 422) || tries >= 3) throw e; }
          }
          this.answers = [...this.answers, entry];
          this.answering = null;
        } catch (e) {
          ans.busy = false;
          ans.err = 'Not sent: ' + (e?.message || e);
        }
      },
      nowGlyph(k) { return window.ClosingState?.GLYPH?.[k] || ''; },
      nowLabel(k) { return String(window.ClosingState?.GLOSS?.[k] || k || '').split(':')[0]; },
      nowTone(k) {
        return ({ needs: 'bg-warning/10 border-warning/40', look: 'bg-warning/10 border-warning/40', signoff: 'bg-warning/10 border-warning/40', choice: 'bg-warning/10 border-warning/40', direction: 'bg-warning/10 border-warning/40',
                  attention: 'bg-error/10 border-error/40', ready: 'bg-success/10 border-success/40',
                  merged: 'bg-secondary/10 border-secondary/40' })[k] || 'bg-base-200/60 border-base-300';
      },
      // A decision state in the chat newer than the file: the file may be
      // behind what was last asked.
      get nowStale() {
        const l = this.work.last;
        return !!(this.now && l && ['needs', 'look', 'signoff', 'direction', 'choice', 'attention'].includes(l.key)
                  && l.at && this.now.updated && Date.parse(l.at) > Date.parse(this.now.updated) + 60000);
      },
      // One typed link to what the renderer draws, from user-call-form.js's
      // shared reading; a PR takes its state's colour from this session's own
      // branch read.
      nowLink(l) {
        return window.UserCallForm ? window.UserCallForm.linkOf(l, (p) =>
          this.work.branches.find((x) => x.slug === p.slug && String(x.pr) === p.n)?.prState)
          : { href: String(l?.ref || ''), label: l?.label || l?.ref || '', icon: 'ph-link', tone: 'border-base-300', peek: null, card: 0 };
      },

      // Bold, code and http links only, over escaped text: enough for a
      // closing state or a guide thread, and nothing a record can smuggle.
      inlineMd(s) {
        return window.esc(String(s || ''))
          .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/(^|[^\w])`([^`]+)`/g, '$1<code class="font-mono text-sm">$2</code>');
      },

      ago(iso) { return window.GH?.ago?.(iso) || ''; },

      // Every view full screen, one per slide, in the same order as the strip.
      viewPanels() {
        const el = this.$refs.viewStrip;
        return el ? [...el.querySelectorAll(':scope > [data-slide]')] : [];
      },
      viewScroll() {
        const el = this.$refs.viewStrip;
        if (!el) return;
        const x0 = el.getBoundingClientRect().left;
        let best = 0, near = Infinity;
        this.viewPanels().forEach((k, i) => {
          const d = Math.abs(k.getBoundingClientRect().left - x0);
          if (d < near) { near = d; best = i; }
        });
        // A programmatic go() is in flight: the scroll it started passes
        // the old slide first, and reading that back would flip the name to
        // the old file and then to the new one. Hold until it arrives.
        if (this._aim >= 0) {
          if (best !== this._aim) return;
          this._aim = -1; clearTimeout(this._aimT);
        }
        if (this.vAt !== best) this.vAt = best;
      },
      goView(i) {
        const n = this.work.views.length;
        if (!n) return;
        i = Math.max(0, Math.min(n - 1, i));
        this.vAt = i;
        this._aim = i; clearTimeout(this._aimT);
        this._aimT = setTimeout(() => { this._aim = -1; this.viewScroll(); }, 900);
        const el = this.$refs.viewStrip, k = this.viewPanels()[i];
        if (!el || !k) return;
        const x = k.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
        el.scrollTo({ left: x, behavior: 'smooth' });
        if (Math.abs(el.scrollLeft - x) < 2) { this._aim = -1; clearTimeout(this._aimT); }
      },
      // ── The facts panel-tip ────────────────────────────────────────────────
      // The house panel-tip contract on the strip's glyphs: hover opens it
      // where the pointer is fine, a tap pins it everywhere, and PanelTip.wire
      // closes it on the ✕, Escape and a press outside. Narrower than the
      // branch panel, since what it holds is a list of names and counts.
      async wireFactTip() {
        if (this._factWired) return;
        this._factWired = true;
        await window.gh?.load?.('kits/panel-tip.js').catch(() => {});
        if (!window.PanelTip || !this.$refs.factTip) return;
        window.PanelTip.wire(this.$refs.factTip, { onClose: () => this.closeFactTip(),
                                                   except: ['[data-fact-btn]'], stale: false });
        // Not the composer: a phone's keyboard rising is a resize, and a
        // scroll is the reader looking at what the note is about.
        const gone = () => { if (this.factTip && this.factTip.kind !== 'notes') this.closeFactTip(); };
        window.addEventListener('scroll', gone, { passive: true });
        window.addEventListener('resize', gone);
      },
      showFactTip(kind, el, pinned) {
        const r = el.getBoundingClientRect();
        const w = Math.min(kind === 'notes' ? 420 : 380, innerWidth - 16);
        // CAPPED TO THE ROOM ON SCREEN, not to a share of it: the checkouts
        // panel of a session that pushed twenty branches is taller than any
        // phone, and a 60vh cap opened low on the page still ran past the
        // bottom edge. Below the glyph where it fits, else on the roomier side.
        const below = innerHeight - r.bottom - 14, above = r.top - 14;
        this.factTipClose = window.PanelTip ? window.PanelTip.closeHTML(pinned) : '';
        this.factTip = { kind, pinned, w, x: Math.max(8, Math.min(r.left - 12, innerWidth - w - 8)), y: r.bottom + 6,
                         mh: Math.max(below, above) };
        this.$nextTick(() => {
          const t = this.$refs.factTip;
          if (!t || !this.factTip) return;
          const h = t.offsetHeight;
          if (h > below && above > below) this.factTip.y = Math.max(8, r.top - 6 - h);
        });
      },
      async toggleFactTip(kind, el) {
        clearTimeout(this._factTimer);
        await this.wireFactTip();
        if (this.factTip && this.factTip.kind === kind && this.factTip.pinned) return this.closeFactTip();
        this.showFactTip(kind, el, true);
      },
      hoverFactTip(kind, el) {
        if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        if (this.factTip?.pinned) return;
        clearTimeout(this._factTimer);
        this._factTimer = setTimeout(async () => { await this.wireFactTip(); this.showFactTip(kind, el, false); }, 140);
      },
      leaveFactTip() {
        clearTimeout(this._factTimer);
        if (!this.factTip || this.factTip.pinned) return;
        this._factTimer = setTimeout(() => this.closeFactTip(), 220);
      },
      closeFactTip() {
        clearTimeout(this._factTimer);
        if (this.factTip) this.factTip = null;
      },

      // ── Notes on what is on screen ─────────────────────────────────────────
      // A note is about something with an address, in the notes store's own
      // locators (skills/notes): the view in front of the reader as
      // owner/repo@branch:path, else the session's record as owner/repo:path.
      // The copied JSON carries those, so a session handed it knows what each
      // note is about, and a note could be filed in the store unchanged.
      get recordAbout() {
        return this.path ? (this.repo || STORE) + ':' + this.path : 'session:' + (this.shortId || '');
      },
      get noteTargets() {
        const out = [];
        const v = this.pane === 'views' ? this.work.views[this.vAt] : null;
        if (v) out.push({ key: 'view', label: v.name, sub: v.repoShort + ' · ' + v.short, about: v.slug + '@' + v.branch + ':' + v.path });
        out.push({ key: 'session', label: 'This session', sub: this.shortId || '', about: this.recordAbout });
        return out;
      },
      get noteTarget() {
        const t = this.noteTargets;
        return t.find((x) => x.key === this.noteAbout) || t[0];
      },
      // Per viewer and per session, in this browser only: a convenience that
      // survives a reload, and an empty list wherever storage is refused.
      notesKey() { return 'session-notes:' + (this.shortId || this.id || ''); },
      loadNotes() {
        try {
          const v = JSON.parse(localStorage.getItem(this.notesKey()) || '[]');
          this.notes = Array.isArray(v) ? v : [];
        } catch { this.notes = []; }
      },
      saveNotes() {
        try {
          if (this.notes.length) localStorage.setItem(this.notesKey(), JSON.stringify(this.notes));
          else localStorage.removeItem(this.notesKey());
        } catch { /* storage refused: the notes live as long as the page */ }
      },
      openNotes(el) {
        if (!window.io && window.gh?.load) window.gh.load('kits/io.js').catch(() => {});
        this.noteMsg = ''; this.noteFailed = false;
        this.toggleFactTip('notes', el).then(() => this.$nextTick(() => {
          if (matchMedia('(hover: hover)').matches) this.$refs.noteTa?.focus();
        }));
      },
      addNote() {
        const text = this.noteText.trim();
        if (!text) return;
        const t = this.noteTarget;
        this.notes = [...this.notes, { about: t.about, label: t.label, text, at: new Date().toISOString() }];
        this.noteText = '';
        this.saveNotes();
      },
      removeNote(i) {
        this.notes = this.notes.filter((_, j) => j !== i);
        this.saveNotes();
      },
      notesJson() {
        return JSON.stringify({
          kind: 'session-notes', session: this.shortId || '', record: this.recordAbout,
          ...(this.agentUrl ? { agent_session: this.agentUrl } : {}),
          notes: this.notes.map(({ about, at, text }) => ({ about, at, text })),
        }, null, 2);
      },
      // No await before the write: the tap that asked is still the gesture
      // the clipboard needs, and "Copy and open the session" is a link whose
      // new tab is opening on the same tap.
      copyNotes() {
        const text = this.notesJson();
        const write = window.io?.copy ? window.io.copy(text)
          : navigator.clipboard?.writeText ? navigator.clipboard.writeText(text).then(() => true)
          : Promise.resolve(false);
        return Promise.resolve(write).catch(() => false).then((ok) => {
          this.noteFailed = !ok;
          this.noteMsg = ok ? 'Copied ' + this.plural(this.notes.length, 'note') : 'The clipboard refused; select it below';
          clearTimeout(this._noteMsgT);
          if (ok) this._noteMsgT = setTimeout(() => { this.noteMsg = ''; }, 2500);
          return ok;
        });
      },
      // Two taps, the first of which only asks.
      clearNotes() {
        if (!this.noteClearArmed) {
          this.noteClearArmed = true;
          setTimeout(() => { this.noteClearArmed = false; }, 3000);
          return;
        }
        this.noteClearArmed = false;
        this.notes = [];
        this.saveNotes();
      },

      // ── The scope's marks ──────────────────────────────────────────────────
      // Each repository's declared icon, from the app's estate list when this
      // is mounted inside the app (no read at all), else from the
      // repository's own .web-tools.json, one memoized read per repository.
      // A repository that declares none, or cannot be read, keeps the
      // estate's neutral glyph. `read` false takes the estate's answer and
      // reads nothing, which is all a mount may do before its record lands.
      loadMarks(read = true) {
        const owner = String(this.repo || STORE).split('/')[0];
        for (const n of this.scopeRepos) {
          if (n in this.marks) continue;
          const known = estateMark(owner + '/' + n);
          if (known) { this.marks = { ...this.marks, [n]: known }; continue; }
          if (!read) continue;
          // null while the read is out, and the slot holds its width blank
          // rather than flashing the neutral glyph before the declared one.
          this.marks = { ...this.marks, [n]: null };
          repoMark(owner + '/' + n).then((icon) => { this.marks = { ...this.marks, [n]: icon }; });
        }
      },
      // Beside the card that lists the view where there is room (right, else
      // left), else under the row. Fine pointers only: on touch the row's tap
      // is the way in.
      hoverViewPeek(v, el) {
        if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        window.UserCallForm?.fillPeek?.(v);
        clearTimeout(this._peekTimer);
        this._peekTimer = setTimeout(() => {
          const host = el.closest('[data-peek-host]');
          const p = host?.getBoundingClientRect(), r = el.getBoundingClientRect();
          if (!p) return;
          const w = Math.min(480, innerWidth - 16), h = Math.round(w * 0.66) + 36;
          let x = p.right + 8 + w <= innerWidth - 8 ? p.right + 8 : p.left - 8 - w >= 8 ? p.left - 8 - w : null;
          let y = x == null ? r.bottom + 4 : Math.min(Math.max(8, r.top - 40), innerHeight - h - 8);
          if (x == null) x = Math.max(8, Math.min(r.left, innerWidth - w - 8));
          this.viewPeek = { v, x, y, w, h };
        }, 180);
      },
      leaveViewPeek() {
        clearTimeout(this._peekTimer);
        if (!this.viewPeek) return;
        this._peekTimer = setTimeout(() => this.closeViewPeek(), 220);
      },
      closeViewPeek() {
        clearTimeout(this._peekTimer);
        if (this.viewPeek) this.viewPeek = null;
      },

      // Each branch as a branch-brief slide, over this page. The kits are the
      // ones pages/branch.html loads, fetched on the first tap.
      // The branches as branch-brief slides over this page; the deck itself
      // is user-call-form.js's, shared with a call's PR panel.
      openBranches(start = 0, opts = {}) {
        return window.UserCallForm?.openBranchDeck(this.workOrder, start, opts);
      },
      // A view's file on GitHub, for the GitHub mark beside its name.
      viewGh(v) {
        return v ? window.RepoAddress.github.blob(v.slug, v.branch, v.path) : '#';
      },
      openViews(start = 0, list = this.work.views) {
        const views = list;
        if (!window.swipeDeck || !views.length) return;
        // The strip's own order, which loadWork groups by repo and branch.
        const order = views;
        let h = null;
        h = window.swipeDeck.open({
          count: order.length, start,
          innerClass: 'h-full w-full min-w-0',
          // The contents list by repo and branch, newest first within each:
          // a section heading per repo, each row the file with its folder.
          index: (i) => ({ title: order[i].name, subtitle: (order[i].dir || '/') + (order[i].ago ? ' · ' + order[i].ago : ''),
                           icon: order[i].kind === 'md' ? 'ph-file-text' : 'ph-browser',
                           section: order[i].repoShort + ' · ' + order[i].short, group: order[i].slug + '@' + order[i].branch }),
          icon: order[start].icon,
          title: order[start].name,
          subtitle: order[start].repoShort + ' · ' + order[start].short,
          onSlide: (i) => {
            if (!h) return;
            const v = order[i];
            h.setTitle?.(v.name); h.setSubtitle?.(v.repoShort + ' · ' + v.short); h.setIcon?.(v.icon);
          },
          render: (i, slide) => {
            const v = order[i];
            if (v.kind === 'html') {
              const f = document.createElement('iframe');
              f.src = v.url; f.className = 'w-full h-full border-0 bg-base-100';
              f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
              slide.append(f);
            } else {
              const d = document.createElement('div');
              d.className = 'h-full overflow-y-auto overflow-x-hidden [overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap px-5 py-4 text-base leading-7 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:link [&_code]:font-mono';
              d.innerHTML = v.html || '';
              slide.append(d);
            }
          },
        });
      },

      // Everything that follows a successful read, in one place so the deck
      // host and the page get the same sequence: tell the host what it could
      // not know, warm the neighbours, draw the pane.
      settle() {
        const topicsRead = this.loadTopics();
        this.loadMarks();
        this.fitBox();
        this.loadNotes();
        if (typeof o.onMeta === 'function') {
          try {
            o.onMeta({ title: this.head.title, agent: this.agentUrl, cards: this.cards,
                       path: this.path });
          } catch { /* a host that throws on meta is not this view's problem */ }
        }
        this.$nextTick(async () => {
          this.runFind(false, true);
          if (Number.isInteger(o.start)) this.openDeck(o.start);
          if (this.pane === 'raw') return this.mountRaw();
          await Promise.race([topicsRead, new Promise(r => setTimeout(r, TOPICS_WAIT_MS))]);
          this.mountOutline();
          // A host that opened this at a topic (the Sessions list's topic
          // lines): the outline, at that topic's first stretch, after a frame
          // so the sections have laid out.
          if (!Number.isInteger(o.start) && o.topic) {
            const want = String(o.topic).toLowerCase();
            const t = this.gist.list.find(x => x.topic.toLowerCase() === want);
            if (t) requestAnimationFrame(() => this.goTopic(t));
          }
        });
        if (!this.compact) {
          this.warm();
          // The Calls tab is the framed slide's only way to a session's calls;
          // standalone, loadWork reads them beside the action message.
          if (!this.framed) this.loadWork(); else this.loadCalls();
        }
      },

      // Read the neighbours the host named, into the module cache, after this
      // one has settled. Nothing is rendered and nothing is awaited: the point
      // is only that the next slide's record is already in flight when the
      // reader swipes. Failures are silent, since a warm that fails costs a
      // warm and the real open will report it properly. Same contract, and the
      // same reasoning, as branch-brief's.
      warm() {
        for (const n of (o.warm || []).slice(0, 2)) {
          const p = n?.path || (n?.id && n?.day && window.RepoSessionsCache?.pathOf?.({ id: n.id, day: n.day }));
          if (p) readRecord(this.repo, p).catch(() => {});
        }
      },

      // ── The panes ─────────────────────────────────────────────────────────
      // Both mount imperatively rather than through Alpine: the outline is a
      // framework-free kit that owns its own rows and panels, and re-rendering
      // it through a reactive template would discard their state on any tick.
      mountOutline() {
        const box = this.$refs.outline;
        if (!box || !this.record || !window.sessionExport || this.findQuery) return;
        if (this.outlineBuilt) return;
        try {
          // Released before the new one registers, not after: replaceChildren
          // drops the old tree either way, and its rail would otherwise keep
          // reading a detached list off every scroll for the life of the page.
          this.outlineOff?.();
          // The agenda is copied out of the reactive row: the kit keeps it for
          // the life of the list, and a proxy has no business in there.
          const built = window.sessionExport.index(this.record,
            { onOpen: (i) => this.openDeck(i), flow: !this.boxed,
              agenda: this.gist.agenda.map(x => ({ ...x, state: x.state ? { ...x.state } : null })),
              notes: this.turnNotes() });
          this.outlineOff = built.destroy || null;
          this.outlineJump = built.jumpTo || null;
          box.replaceChildren(built.el);
          this.outlineBuilt = true;
        } catch (e) { this.err = e?.message || String(e); }
      },
      // Rebuilt in place when Gemini's file lands after the outline did, which
      // is the usual order: the record is cached and the topics file is a
      // second read. Both scrollers are kept, the list's own when framed and the
      // page's in flow, so a reader already partway down does not lose the row.
      remountOutline() {
        if (!this.outlineBuilt || this.findQuery) return;
        const box = this.$refs.outline;
        const inner = box?.querySelector('.overflow-y-auto');
        const outer = box?.closest('.overflow-y-auto') || document.scrollingElement;
        const at = [inner?.scrollTop || 0, outer?.scrollTop || 0];
        this.outlineBuilt = false;
        this.mountOutline();
        const nowInner = box?.querySelector('.overflow-y-auto');
        if (nowInner) nowInner.scrollTop = at[0];
        if (outer) outer.scrollTop = at[1];
      },
      // Gemini's summary of each turn, keyed by the instant the turn was sent,
      // which is what an outline row's ask carries. The file numbers the
      // record's own prompts (web-tools-private gemini_followup.py,
      // user_turns), so turn i is prompts[i]. A record before schema 8 still has
      // injected prompts in that list and the two numberings can disagree;
      // there the notes are used only when the counts agree, since a summary on
      // the wrong row is worse than none.
      turnNotes() {
        const turns = this.topics?.turns;
        const r = this.record || {};
        const prompts = r.prompts || [];
        if (!Array.isArray(turns) || !turns.length) return null;
        if ((r.schema || 1) < 8 && !Array.isArray(r.injected) && turns.length !== prompts.length) return null;
        const by = {};
        for (const t of turns) {
          const at = prompts[t?.turn]?.at;
          if (at && typeof t.summary === 'string' && t.summary) by[at] = { summary: t.summary, headline: t.headline || '' };
        }
        return Object.keys(by).length ? by : null;
      },
      // Built on the first visit to the pane rather than at load: the record
      // runs into the hundreds of kilobytes and an interactive tree over it is
      // not a cost to pay for a reader who never opens the tab.
      async mountRaw() {
        if (this.rawBuilt || !this.record) return;
        const box = this.$refs.raw;
        if (!box) return;
        try {
          if (!window.JsonExplorer && window.gh?.load) {
            await window.gh.load('kits/json-explorer.js');
          }
          if (window.JsonExplorer) {
            // The host supplies the height: a deck's flex remainder, or the
            // standalone viewport below its measured sticky chrome. Letting
            // the explorer size itself would lay the entire raw record out
            // into the document instead of scrolling it inside this pane.
            this._rawExplorer = window.JsonExplorer.mount(box, {
              data: this.record,
              name: (this.shortId || 'session') + '.json',
              fill: true,
            });
          } else if (window.chatRender) {
            box.replaceChildren(window.chatRender.block({ lang: 'json', code: this.rawJson },
                                                        { fill: true }));
          }
          this.rawBuilt = true;
        } catch (e) { this.err = e?.message || String(e); }
      },

      // The card deck, optionally opening at a card: tapping an outline row is
      // the join between the two views, and landing on slide 0 after choosing
      // row 12 would throw the choice away.
      //
      // A deck already on screen becomes this one's parent, so a session opened
      // inside a deck of sessions drills rather than stacking, and Back lands
      // on the session rather than on the list. Exactly what branch-brief's
      // openFileDeck does one object over.
      async openDeck(at, options = {}) {
        if (this.deckOpening || !this.record) return;
        this.deckOpening = true;
        try {
          await this.ready();
          if (!window.sessionRender) throw new Error('the session renderer did not load');
          const parent = window.swipeDeck?.top?.() || null;
          const deck = await window.sessionRender.open(this.record, {
            ...(Number.isInteger(at) ? { start: at } : {}),
            ...(this.findQuery ? { find: this.findQuery } : {}),
            ...(parent ? { parent } : {}),
          });
          if (typeof o.onOpen === 'function') {
            try { o.onOpen(deck); } catch { /* host bookkeeping cannot prevent reading */ }
          }
          // ONE gesture, start to speech. Safari refuses to speak until a user
          // gesture has reached the synth, and the tap that opened this deck is
          // the only one there will be; a second tap on the deck's own speaker
          // is exactly the friction the brief's button exists to remove.
          if (options.speak) deck?.speak?.();
        } catch (e) {
          this.err = e?.message || String(e);
        } finally { this.deckOpening = false; }
      },
    };
  });
  };

  // A repository's declared icon (the `icon` of its .web-tools.json), memoized
  // for the page's life: a mark changes when someone edits a manifest, which a
  // reload covers. Only a Phosphor class is taken, since that is what the
  // strip can draw; a project's svg path is a different kind of mark.
  const MARKS = new Map();            // owner/repo -> promise of 'ph-…' or ''
  function estateMark(slug) {
    const hit = (window.__shell?.estateRepos || []).find((e) => e && e.repo === slug)?.icon;
    return typeof hit === 'string' && /^ph-[a-z0-9-]+$/.test(hit) ? hit : '';
  }
  function repoMark(slug) {
    if (!MARKS.has(slug)) {
      MARKS.set(slug, (async () => {
        try {
          const g = new window.GH({ token: window.TOKEN, repo: slug, ref: 'main' });
          const icon = JSON.parse((await g.get('.web-tools.json')).text)?.icon;
          return typeof icon === 'string' && /^ph-[a-z0-9-]+$/.test(icon) ? icon : '';
        } catch { return ''; }
      })());
    }
    return MARKS.get(slug);
  }

  // A RECORD IS NEVER REACTIVE. Nothing writes into one: a record is read,
  // shown and replaced whole, and replacing `record` is what the view reacts
  // to. Reactive, every object a getter or the outline touched inside it was
  // wrapped in a proxy as it was read, which for the largest record in the
  // store (bb88ffa7, 57.5 MB, 2026-10-22) was hundreds of thousands of
  // wrappers on the way to the first card. Alpine's reactivity leaves alone
  // any object carrying __v_skip, the marker Vue's markRaw sets.
  function inert(rec) {
    // A frozen record is left as it is: Alpine skips a non-extensible object
    // already, and defineProperty would throw on one.
    if (rec && typeof rec === 'object' && !rec.__v_skip && Object.isExtensible(rec)) {
      Object.defineProperty(rec, '__v_skip', { value: true });
    }
    return rec;
  }

  // A record's serialized length, for one with no stored size (see rawSize).
  const SIZES = new WeakMap();
  function sizeOf(r) {
    const raw = window.Alpine?.raw?.(r) || r;
    if (!SIZES.has(raw)) SIZES.set(raw, JSON.stringify(raw, null, 2).length);
    return SIZES.get(raw);
  }

  // ── The two module-scope reads ────────────────────────────────────────────
  // Both are plain memos with the same expiry, kept out of the component for
  // the reason stated at the top: the deck reuses one mount per slide, and
  // what these answer is a property of the store rather than of the visit.
  function fresh(entry) { return entry && (Date.now() - entry.at) < TTL_MS; }

  // The PROMISE is memoized, not the settled record, and the difference shows
  // exactly where the deck lives: three slides mount at once and the reader's
  // two neighbours are warmed on top, so several callers ask for the same path
  // within a tick. Caching after the await lets every one of them miss and
  // fetch, which is the shape of bug that looks like nothing until the store is
  // private and every read is a rate-limited call.
  function readRecord(repo, path) {
    const key = JSON.stringify([repo, path]);
    const hit = RECORDS.get(key);
    if (fresh(hit)) return hit.promise;
    const promise = (async () => {
      const g = new window.GH({ token: window.TOKEN, repo, ref: 'main' });
      const f = await g.get(path);
      const rec = JSON.parse(f.text);
      // The blob sha the record was read as, which is what Gemini's companion
      // names as its source (source_blob): the one exact answer to whether
      // the summaries were made from this version. Not enumerable, so Raw and
      // every export still show the record exactly as stored.
      if (rec && typeof rec === 'object' && f.sha) Object.defineProperty(rec, '_blob', { value: f.sha });
      // And its size in bytes, which is what the Raw tab prints: computing it
      // meant serializing the whole record again (see rawSize).
      if (rec && typeof rec === 'object' && f.size) Object.defineProperty(rec, '_size', { value: f.size });
      return inert(rec);
    })();
    RECORDS.set(key, { at: Date.now(), promise });
    // A failed read must not stand as the answer for a minute.
    promise.catch(() => { if (RECORDS.get(key)?.promise === promise) RECORDS.delete(key); });
    return promise;
  }

  function readTopics(repo, path) {
    const key = JSON.stringify([repo, path]);
    const hit = TOPICS.get(key);
    if (fresh(hit)) return hit.promise;
    const promise = (async () => {
      const ref = window.RepoSessionsCache?.TOPICS_REF || 'background';
      const g = new window.GH({ token: window.TOKEN, repo, ref });
      return JSON.parse((await g.get(path.replace(/^sessions\//, 'sessions/topics/'))).text);
    })();
    TOPICS.set(key, { at: Date.now(), promise });
    promise.catch(() => { if (TOPICS.get(key)?.promise === promise) TOPICS.delete(key); });
    return promise;
  }

  async function listing(repo) {
    const hit = LISTINGS.get(repo);
    if (fresh(hit)) return hit.promise;
    const promise = (async () => {
      const g = new window.GH({ token: window.TOKEN, repo, ref: 'main' });
      const tree = await g.req('git/trees/main?recursive=1');
      return (tree.tree || [])
        .filter(n => n.type === 'blob' && /^sessions\/\d{4}\/\d{2}\//.test(n.path))
        .map(n => n.path);
    })();
    LISTINGS.set(repo, { at: Date.now(), promise });
    // A failed read must not be cached as the answer for a minute.
    promise.catch(() => LISTINGS.delete(repo));
    return promise;
  }

  // Registration is defensive rather than a bare `alpine:init` listener: this
  // component can arrive at the end of a gh.load chain, which may finish after
  // Alpine has already started, and a missed event leaves the host rendering
  // "sessionBrief is not defined". Same idiom branch-brief.js uses for the same
  // race.
  if (window.Alpine?.directive) register();
  else document.addEventListener('alpine:init', register);
})();
