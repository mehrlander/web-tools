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
//   lent      false for a framed host that lends nothing (the standalone
//             page's takeover), so the view reads its Now section, views and
//             calls itself; defaults to `framed`
//   compact   show the discussion search and its excerpts, without the overview
//   fixedFind keep a compact reader tied to the host's submitted query
//   matchNote plain text for a compact search with no matching captured prose
//   pages     render chips for what this session's branches changed, lent by a
//             host that can join a record to the crawl (see the Look row)
//   facts     what the host already knows, so the head is right before the
//             read lands (see `factsRecord`)
//   warm      neighbours worth reading ahead: [{ id, day, path }]
//   onMeta    called with what only a finished read knows
//   pane      a tab: 'calls' | 'overview' | 'turns' | 'views' | 'files' |
//             'record'. Older names still land where their content went:
//             'outline' on Turns, 'log' and 'raw' on Record's tree, 'schema' on
//             its schema, 'cost' on the Overview with the cost panel open
//             (PANE_ALIAS)
//   chrome    a deck slide's setChrome (swipe-deck render's third argument):
//             the facts line and find then sit in the deck's header, and the
//             view draws no head of its own (see buildHead)
//   fileHref  (checkoutPath, record) => url, for the Files pane; see fileHref
//   start     open the card deck on this card, once loaded
//   turn      open the Turns tab on turn n (1-based), without the deck
//   file      with turn: open that card on its file-th changed file (1-based)
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
  // `background` branch the Lenovo daemon writes): the session's title,
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

  // THE TABS, in the row's order, and where an older address's tab went.
  // `log` and `schema` were two tabs over one explorer until 2026-11-17, and
  // `cost` a tab of its own; links to all three are out there (the Usage and
  // Compactions views write pane=cost).
  const PANES = ['calls', 'overview', 'turns', 'views', 'files', 'record'];

  // ONE CALL'S CARD in the Calls tab's strip: what it asks, what is
  // recommended, and the answer, given where it is read. Alpine markup bound
  // to the call `c`, drawn by the kit into a card and started inside this
  // view's tree, so its expressions reach the view's methods (mountCalls).
  // A documentation call's card is the call form instead (callForm).
  // The size and the cautions ride the name's line, on the right, so the card
  // spends no line of its own on them. (No backticks in this markup: it is a
  // JS template literal.)
  const CALL_CARD = `
  <div data-session-call :data-id="c.id" class="flex flex-col gap-1.5" :class="c.status === 'closed' && 'opacity-60'">
    <!-- The size and the cautions ride the name's line, on the
         right, so the card spends no line of its own on them. -->
    <div class="flex items-center gap-1.5 text-sm text-base-content/60" data-session-call-head>
      <i class="ph text-base" :class="callKindIcon(c)"></i>
      <span class="min-w-0 truncate" x-text="callKindLabel(c)"></span>
      <span class="grow"></span>
      <template x-for="t in callChips(c)" :key="t.key">
        <span class="badge badge-sm shrink-0 gap-1" :class="t.tone" :data-title-tip="t.tip" :data-chip="t.key">
          <i class="ph" :class="t.icon"></i><span x-text="t.label"></span></span>
      </template>
      <span class="badge badge-sm shrink-0" :class="callStateTone(c)" x-text="callState(c)"></span>
    </div>
    <!-- No here: Safari's pretty wrap evens the rag of
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
              :disabled="!!callSending[c.id]" @click="tapCallSend(c)" data-session-call-send
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
  `;
  // WHERE A CALL CAME FROM, the line over every card in the Calls tab (owner,
  // 2026-11-21: "If anything sits above the edits, it should say where the
  // call came from, tied to something the owner recognizes"): the turn the
  // call was filed in, by Gemini's headline for it, which opens that exchange
  // in Turns (callOrigin). The topic is the list's heading over the card's
  // row, which opens the topic's panel (topicPanel), so the line does not
  // name it again (html-style rule 17). One line on every card with a turn,
  // so the call under it starts at one height; on a phone the day gives way.
  const CALL_ORIGIN = `
  <button type="button" x-show="callOrigin(c).turn >= 0" @click="goTurn(callOrigin(c).turn)" data-call-origin data-call-turn-link
          class="group flex shrink-0 min-w-0 items-baseline gap-2 border-b border-base-200 px-3.5 py-1.5 text-left">
    <span class="shrink-0 font-mono text-xs text-base-content/50 group-hover:text-primary" x-text="'turn ' + (callOrigin(c).turn + 1)"></span>
    <span class="min-w-0 grow truncate text-sm text-base-content/80 group-hover:text-primary" x-text="promptHeadline(callOrigin(c).turn)"></span>
    <span class="shrink-0 font-mono text-xs text-base-content/50 max-sm:hidden" x-text="callDay(c)"></span>
  </button>
  `;
  // The instants of a list of turns, worked out once per list: every topic
  // line on the Overview places every call (callTurn).
  const TURN_TIMES = new WeakMap();
  const turnTimes = (list) => {
    let t = TURN_TIMES.get(list);
    if (!t) TURN_TIMES.set(list, (t = list.map((p) => Date.parse(p?.at || ''))));
    return t;
  };
  // A value inside a double-quoted attribute selector.
  const attrQuote = (s) => String(s).replace(/["\\]/g, '\\$&');
  // Outline folded into Turns with step 4 of the rebuild (2026-11-17).
  const PANE_ALIAS = { log: 'record', raw: 'record', schema: 'record', cost: 'overview', outline: 'turns' };

  // A record's cards (session-render's grouping, one exchange each) and its
  // outline rows, worked out once per record: both walk every turn, and the
  // Turns tab reads them on every redraw of its list. Keyed by the record
  // itself, which is never reactive (inert).
  const CARDS = new WeakMap();
  // A key for each file card's options on window, as kits/file-deck.js keys
  // its own: a patch in an x-data attribute would break the expression.
  let FILE_SEQ = 0;
  function cardsOf(rec) {
    const sr = window.sessionRender;
    if (!rec || !sr) return { cards: [], rows: [] };
    let hit = CARDS.get(rec);
    if (!hit) {
      const cards = sr.groups(sr.turns(rec));
      // The prompt each exchange answers, found by its ask's instant.
      const prompts = Array.isArray(rec.prompts) ? rec.prompts : [];
      const byAt = new Map();
      prompts.forEach((p, i) => { if (p && p.at && !byAt.has(p.at)) byAt.set(p.at, i); });
      const askAt = cards.map((c) => (c.find((t) => t.role === 'user') || {}).at || '');
      hit = { cards, rows: sr.outline ? sr.outline(rec) : [], askAt,
              promptOf: askAt.map((at) => (at && byAt.has(at) ? byAt.get(at) : -1)) };
      CARDS.set(rec, hit);
    }
    return hit;
  }
  const paneOf = (p) => PANE_ALIAS[p] || (PANES.includes(p) ? p : '');

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
      // Whether the host lends the session's work instead of this view reading
      // it, as the app's Sessions deck does (the crawl's `pages`, no Now section
      // or Views tab). Framed implies lent unless the host says `lent: false`,
      // which the standalone page's takeover does: it draws the identity and
      // lends nothing, so the view reads the work itself.
      lent: o.lent ?? !!o.framed,
      // The shell's height when standalone: the viewport less whatever the
      // host draws above it (the page's address bar), measured at mount.
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
      // Each scope repository's mark, a RepoMark spec by short name (see
      // loadMarks): null while its manifest is out, '' where it declares none.
      marks: {},
      // The facts panel-tip: the breakdown behind a strip glyph.
      factTip: null, factTipClose: '', _factTimer: null, _factWired: false,

      record: inert(o.record) || null,
      loading: false,
      err: '',
      // ONE TAB ROW (owner, 2026-11-17; two regions, each with its own row,
      // from 2026-11-09). The tab the reader or the address asked for, or ''
      // to let the row choose (see `pane`).
      asked: o.compact ? '' : (Number.isInteger(o.turn) ? 'turns' : paneOf(o.pane)),
      // The file a turn's card opens on (`file`, 1-based), for `turn`'s card.
      _turnFile: Number.isInteger(o.turn) && o.file >= 1 ? { k: o.turn - 1, j: o.file } : null,
      // Whether a deck host lends its header (o.chrome): the head then lives
      // there and the template draws none.
      hosted: typeof o.chrome === 'function',
      // The cost reading (kits/session-usage.js), made once the record is in,
      // and the prompt a touch reader has picked on its chart. `costAsked`
      // is an address's pane=cost, which opens the cost panel once.
      usage: null, costPick: -1, costAsked: o.pane === 'cost',
      // The Record tab's switch: 'tree' or 'schema'. The Schema view's
      // arrows open a list in the tree or as a table, and the switch follows.
      recView: o.pane === 'schema' ? 'schema' : 'tree',
      // The copy button's tick, for a moment after a copy lands.
      copied: false,
      rawBuilt: false,
      outlineBuilt: false,
      deckOpening: false,
      findText: String(o.find || ''),
      findOpen: !!String(o.find || '').trim(),
      findQuery: '',
      findResult: { terms: [], hits: [], total: 0, occurrenceTotal: 0, matchedTerms: [], allTerms: false },
      findAt: 0,
      findCopied: -1,
      findCopyError: '',
      // The Now section's data: fetched by loadWork, standalone only.
      work: { loading: false, loaded: false, branches: [], views: [], asks: [], last: null, err: '' },
      lastOpen: false,
      // The Views tab's selection, an index into work.views, which the list
      // and its strip of cards keep in step (mountViews).
      vAt: 0,
      // The action message (sessions/tools/now.py in the record store), read
      // from `nowRef`, main unless the address names another ref.
      // The component reads `now` off the address itself as well as taking it
      // from the host, because a `?use=` preview swaps this bundle and not the
      // host page: a host on main never learned to pass it along.
      now: null, nowErr: '', nowOpen: false, answers: [], answering: null,
      calls: [], callAnswers: {}, callsLoading: false,
      // The calls that no longer waited when their answers were read, by id:
      // the list puts them after a topic's waiting calls (callOrder). An
      // answer sent from this page pales its row and leaves it in place, so
      // the strip's next card is still the next one.
      callSettled: {},
      // The Calls tab's selection, a call's id, which the list and its strip
      // of cards keep in step (mountCalls); '' lets the first waiting call lead.
      cSel: '',
      // The Overview's topic a topic panel's link opened, lit for a moment so
      // the eye lands on it (goOverviewTopic).
      topicLit: '', _topicLitT: 0, _callGroupAt: '',
      // The Turns tab's selection, a card's index as a string.
      tSel: '',
      // The Files tab's selection, a record path, and how far the branches'
      // changes have been read: '' not asked, 'reading', 'read'.
      fSel: '', diffsState: '',
      callSending: {}, callErr: {}, callArmed: '', _callArmT: 0, callNotes: {},
      nowRef: o.nowRef || (() => {
        try {
          const h = new URLSearchParams((location.hash || '').replace(/^#/, ''));
          return h.get('now') || new URLSearchParams(location.search).get('now') || 'main';
        } catch { return 'main'; }
      })(),
      viewPeek: null, _peekTimer: null,
      // EVERY FIELD THIS VIEW WRITES IS DECLARED HERE, private ones included.
      // Mounted inside another component's scope (the app's shell), Alpine
      // writes a property the component never declared to the OUTERMOST
      // scope, so every slide of a deck shares it: in the Sessions deck the
      // second slide read the first's _chromeKey and never handed its facts
      // to the header (found 2026-11-17). A test with no parent scope cannot
      // see it, which is why the list is kept by hand.
      _head: null, _headFx: null, _chromeKey: '', _findT: 0, _findKey: null,
      _recSwitching: false, _rawExplorer: null, _viewSwiper: null, _viewKeys: '',
      _callSwiper: null, _callKeys: '', _turnSwiper: null, _turnKeys: '', _notes: null,
      _fileSwiper: null, _fileKeys: '', _diffs: null, _diffsLoading: null,
      _costKey: '', _costHost: null, _costObs: null, _costW: 0,
      _callOpened: false, _boxWired: false,

      template: `
        <!-- FULL WIDTH, NO CAP. This carried mx-auto and max-w-2xl, so a desktop
             browser drew a phone's column down the middle of the screen with
             the rest empty. The house style names that pattern outright (rule
             3), and the estate's own branch list already made the same call
             once nothing stood beside it to claim the space. A row here is a
             wide thing for the same reason a branch row is: an ask, an answer,
             a clock, a turn count and a tool tally all read across. -->
        <!-- BOXED: the shell is the viewport's height and each region's pane
             scrolls inside itself, as a framed slide's does, so the head stays
             in view while the turns scroll. Standalone, the head scrolls
             inside a cap of 45dvh where it runs taller, so a short screen
             still leaves the regions a share. The document never scrolls, so
             a phone's address bar stays expanded. -->
        <!-- aria-busy while the record or Gemini's file is being read, which a
             look link waits on (lib/kits/look.js) before it says its target is
             not on the page. The data-at names below are its anchors. -->
        <div class="w-full flex flex-col gap-2.5 px-4 pt-3 min-h-0 pb-0"
             :class="framed ? 'h-full' : 'overflow-hidden'"
             :aria-busy="loading || topicsState === 'reading' ? 'true' : 'false'"
             :style="framed ? null : { height: boxHeight }">

          <div x-show="err" class="alert alert-warning shrink-0" x-text="err"></div>

          <!-- THE HEAD: the session's title over a line of its facts (the
               date, tool calls, subagents, the checkouts and Gemini's count
               of turns summarized), with find beside them. A deck host lends
               its header (o.chrome, swipe-deck's setChrome) and the facts line and find move into it, so the
               full-screen header carries them and nothing under it repeats
               them (owner, 2026-11-17); that header's title is the host's.
               Without one the head is drawn here, its title only where no
               host names the session. Both ways it is the same plain DOM,
               built once by buildHead and kept current by paintHead, since a
               deck moves it in and out as the reader swipes.

               A FACT THAT DOES NOT FIT DROPS OUT WHOLE: the line is one row
               high and wraps, so a fact past the edge falls to a second row
               that is never shown, rather than being cut mid-word. -->
          <template x-if="!compact && !hosted">
          <div class="shrink-0 flex items-center gap-1 min-w-0" data-session-head>
            <!-- THE WAY OUT, to the app's Sessions view. Standalone only, since
                 a framed slide is already inside the app; target _top, so it
                 leaves a toss as well. -->
            <a x-show="!framed" href="https://mehrlander.github.io/web-tools/app/?view=sessions" target="_top" data-at="sessions"
               class="btn btn-ghost btn-sm btn-square -ml-2 shrink-0 self-center"
               data-title-tip="Sessions in Web Tools" aria-label="Sessions in Web Tools">
              <i class="ph ph-caret-left text-lg"></i></a>
            <div x-ref="headBox" class="min-w-0 grow"></div>
            <span x-ref="actBox" class="contents"></span>
            <!-- The estate's standard way to link a session: the logomark in
                 brand colour, no label, as the Sessions rows and the deck
                 header draw it, from kits/claude-mark.js, which gh-boot
                 carries as standing equipment (node/test/claude-mark.test.mjs).
                 Standalone only: a deck's header carries the session link. -->
            <a x-show="agentUrl && !framed" :href="agentUrl" target="_blank"
               data-title-tip="Open this session in Claude Code"
               class="btn btn-sm btn-square btn-ghost"
               x-html="window.claudeMark.svg({ cls: 'w-4 h-4 max-sm:w-5 max-sm:h-5 shrink-0' })"></a>
          </div>
          </template>

          <template x-if="!compact">
          <!-- The facts panel-tip: the breakdown behind a fact in the head, or
               behind the cost figure on the Overview, on the branch
               panel-tip's machinery (kits/panel-tip.js owns the way out).
               Every number in it is already in the record or in Gemini's
               file, so it is complete in its first frame. It stays in this
               tree when the facts sit in a deck's header, and opens under the
               fact it belongs to. -->
          <div x-ref="factTip" x-show="factTip" role="dialog" data-fact-tip
               :aria-label="factTip?.kind === 'topic' ? (topicPanel?.topic || 'Topic') : ({ gemini: 'Gemini summaries', scope: 'Checkouts', time: 'When it ran', cost: 'Cost' })[factTip?.kind] || 'Tool calls'"
               @mouseenter="clearTimeout(_factTimer)" @mouseleave="leaveFactTip()" @click="topicPanelGo($event)"
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
                        <span class="contents" x-html="markHtml(g.name, { cls: 'text-lg', color: 'text-base-content/60' })"></span>
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
            <!-- Gemini's reading: turns summarized, where it stands against
                 the record, and the provenance lines the Turns tab closes on.
                 The turns themselves are the Turns tab's. -->
            <template x-if="factTip && factTip.kind === 'gemini' && gemini">
              <div class="flex flex-col" :class="factTipClose && 'pr-7'" data-gemini-panel>
                <div class="flex items-baseline gap-2 px-3 pt-2.5 pb-2 border-b border-base-200">
                  <span class="self-center text-base-content/50" x-html="geminiGlyph()"></span>
                  <span class="font-mono font-semibold tabular-nums" x-text="gemini.head.count"></span>
                  <span class="text-sm text-base-content/70" x-text="gemini.head.unit"></span>
                  <span class="grow"></span>
                  <span class="shrink-0 text-sm" :class="gemini.tone" x-text="gemini.word"></span>
                </div>
                <p class="px-3 pt-2 text-sm" x-text="gemini.tip"></p>
                <div x-show="geminiDetail.lines.length"
                     class="flex flex-col px-3 pt-1.5 pb-2.5 font-mono text-xs leading-5 text-base-content/55">
                  <template x-for="l in geminiDetail.lines" :key="l"><span x-text="l"></span></template>
                </div>
              </div>
            </template>
            <!-- WHAT IT COST, behind the Overview's cost figure (owner,
                 2026-11-17, where a tab of its own held it): the main
                 conversation's figure at API list prices against the
                 harness's own total, and what each prompt cost as bars behind
                 the context line (kits/usage-chart.js, combined). A bar opens
                 its turn, as the Overview's chart does. -->
            <template x-if="factTip && factTip.kind === 'cost' && usage">
              <div class="flex flex-col" :class="factTipClose && 'pr-7'" data-cost-panel>
                <div data-cost-total class="flex items-baseline gap-2 px-3 pt-2.5 pb-2 border-b border-base-200"
                     data-title-tip="At API list prices: what the same tokens would cost on the API, not what a subscription is billed">
                  <i class="ph ph-coins text-base self-center text-base-content/50"></i>
                  <span class="font-mono font-semibold tabular-nums" x-text="money(usage.totals.modelled)"></span>
                  <span class="text-sm text-base-content/70">main conversation</span>
                </div>
                <div class="flex flex-col py-1 text-sm">
                  <div x-show="usage.totals.harness != null" class="flex items-baseline gap-2 px-3 py-1" data-cost-harness
                       data-title-tip="The harness's own running total. It also counts the subagents' model calls, and it can trail the record, so it sometimes reads lower">
                    <span class="min-w-0 flex-1 text-base-content/85">harness total</span>
                    <span class="shrink-0 font-mono tabular-nums text-base-content/55" x-text="money(usage.totals.harness)"></span>
                  </div>
                  <div x-show="usage.totals.reloads" class="flex items-baseline gap-2 px-3 py-1"
                       data-title-tip="A step after more than an hour idle writes the whole context to the cache again">
                    <span class="min-w-0 flex-1 text-base-content/85" x-text="plural(usage.totals.reloads, 'idle re-load')"></span>
                    <span class="shrink-0 font-mono tabular-nums text-base-content/55" x-text="money(usage.totals.reload)"></span>
                  </div>
                  <div x-show="usage.totals.unpriced.length" class="px-3 py-1 text-warning"
                       x-text="'no price for ' + usage.totals.unpriced.join(', ')"></div>
                </div>
                <div data-cost-panel-chart class="px-3 pb-2.5 min-w-0 text-base-content" x-html="costPanelSvg()"
                     @click="costTap($event)" @pointerover="costHover($event)"></div>
              </div>
            </template>
            <!-- A TOPIC, from its heading in the Calls tab's list (owner,
                 2026-11-21), told as the Sessions view's topic card tells it
                 (estate.js openSessionTopicCard): its status and what decided
                 it, a correction included; its kind, area and the turns it
                 spans in the agenda; Gemini's headline for a few of those
                 turns, each opening its exchange in Turns, the first row its
                 first turn; and the way to its line on the Overview
                 (topicPanel). -->
            <template x-if="factTip && factTip.kind === 'topic' && topicPanel">
              <div class="flex flex-col" data-topic-panel>
                <!-- Only the head makes room for the close, so the rules
                     below run to the panel's edge. -->
                <div class="flex items-baseline gap-2 px-3 pt-2.5 pb-2 border-b border-base-200" :class="factTipClose && 'pr-9'">
                  <span class="w-4 shrink-0 text-center" :class="!topicPanel.t.state && 'text-base-content/30'" x-text="topicPanel.glyph"></span>
                  <span class="min-w-0 grow font-semibold leading-snug" :class="topicPanel.dropped && 'line-through text-base-content/50'"
                        x-text="topicPanel.topic"></span>
                </div>
                <div x-show="topicPanel.status" class="flex flex-col gap-0.5 px-3 pt-2 text-sm" data-topic-status>
                  <span class="flex items-baseline gap-1.5">
                    <i x-show="topicPanel.mark" class="ph shrink-0" :class="[topicPanel.mark?.icon, topicPanel.owner && 'text-primary']"></i>
                    <span x-text="topicPanel.status"></span></span>
                  <span x-show="topicPanel.basis" class="line-clamp-2 text-xs text-base-content/55" x-text="topicPanel.basis" data-topic-basis></span>
                </div>
                <p class="px-3 pt-1.5 text-xs text-base-content/55" x-text="topicPanel.meta" data-topic-meta></p>
                <!-- One line a turn, as the Sessions card draws them, a
                     return to the topic after other work opening with a rule;
                     past six, the first three and the last three. A tap is
                     the panel's to act on (topicPanelGo). -->
                <ol class="flex flex-col py-1.5" data-topic-turns>
                  <template x-for="r in topicPanel.rows" :key="r.key">
                    <li :class="r.gap && 'mt-1 border-t border-base-200 pt-1'">
                      <template x-if="r.more">
                        <span class="flex py-0.5 pl-11 font-mono text-xs text-base-content/45" x-text="'⋯ ' + r.more + ' more'"></span>
                      </template>
                      <template x-if="!r.more">
                        <button type="button" :data-topic-turn="r.i"
                                class="flex w-full items-baseline gap-2 px-3 py-0.5 text-left text-sm hover:bg-base-200/70 hover:text-primary">
                          <span class="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-base-content/45" x-text="r.n"></span>
                          <span class="min-w-0 flex-1 truncate" x-text="r.text"></span></button>
                      </template>
                    </li>
                  </template>
                </ol>
                <div class="flex items-center justify-end border-t border-base-200 px-1.5 py-1">
                  <button type="button" class="btn btn-ghost btn-xs gap-1 font-normal" data-topic-overview>
                    <i class="ph ph-list-bullets"></i>Overview</button>
                </div>
              </div>
            </template>
          </div>
          </template>

          <!-- ── THE BODY: one tab row over one pane ───────────────────────
               Calls, Overview, Turns, Views, Files and Record in one
               row (owner, 2026-11-17), so one thing is selected at a time and
               the pane under it takes the whole height. Calls shows only for a
               session that filed some, and the row opens on it while one waits
               on the owner; Views and Files show once there are some. Turns
               took the Outline in (step 4 of the rebuild). The tabs carry no counts (peeve P43) but Calls,
               whose count is tinted while one waits. (No backticks in this
               markup: it is a JS template literal.) -->
          <div data-session-body class="flex flex-col gap-2 min-h-0 grow">
          <div class="flex flex-wrap items-center gap-x-1 gap-y-2 shrink-0 min-w-0">
            <template x-if="!compact">
            <div role="tablist" data-at="tabs" class="tabs tabs-box tabs-xs flex-nowrap bg-base-200 p-0.5 min-w-0 max-w-full
                                       overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <a role="tab" class="tab gap-1 flex-nowrap whitespace-nowrap" x-show="calls.length" data-at="calls" data-session-calls-tab
                 :class="pane === 'calls' && 'tab-active'" @click="show('calls')">
                Calls<span class="font-mono tabular-nums rounded px-1" :class="openCallCount ? 'bg-warning/30 text-warning-content' : 'opacity-50'"
                           x-text="calls.length"></span></a>
              <a role="tab" class="tab flex-nowrap whitespace-nowrap" data-at="overview"
                 :class="pane === 'overview' && 'tab-active'" @click="show('overview')">Overview</a>
              <a role="tab" class="tab flex-nowrap whitespace-nowrap" data-at="turns"
                 :class="pane === 'turns' && 'tab-active'" @click="show('turns')">Turns</a>
              <a role="tab" class="tab flex-nowrap whitespace-nowrap" x-show="work.views.length" data-at="views" data-session-views-tab
                 :class="pane === 'views' && 'tab-active'" @click="show('views')">Views</a>
              <a role="tab" class="tab flex-nowrap whitespace-nowrap" x-show="fileRows.length" data-at="files"
                 :class="pane === 'files' && 'tab-active'" @click="show('files')">Files</a>
              <a role="tab" class="tab flex-nowrap whitespace-nowrap" data-at="record"
                 :class="pane === 'record' && 'tab-active'" @click="show('record')">Record</a>
            </div>
            </template>
            <template x-if="!compact">
            <div class="ml-auto flex shrink-0 items-center">
              <!-- THE CLASSES AND THE WORDING ARE swipeDeck.entry()'s, held to it
                   by node/test/deck-entry-parity.test.mjs rather than by a call:
                   the kit loads on demand and is not on the page when this
                   template first renders, so a host that waited for it would show
                   no button at all on the first paint. Same copy, same gate, as
                   branch-brief's file-deck button. At the tab row's right end,
                   where it sat before the row became one, so a deck's header
                   holds only the magnifier and the session link, as the design
                   sketch draws it, and the facts line keeps the room. -->
              <button @click="openDeck()" :disabled="deckOpening || !record" data-at="cards"
                      class="btn btn-square btn-sm btn-ghost text-primary"
                      :data-title-tip="cards ? 'Read ' + plural(cards, 'card') + ' one at a time'
                                    : 'Read cards one at a time'">
                <span x-show="deckOpening || (loading && !record)" class="loading loading-spinner loading-xs"></span>
                <i x-show="!deckOpening && !(loading && !record)"
                   class="ph ph-cards-three text-lg max-sm:text-xl"></i></button>
            </div>
            </template>
            <template x-if="compact">
              <div class="flex w-full items-center gap-2 min-w-0">
                <span class="text-sm font-semibold">Discussion</span>
                <button type="button" @click="openMatchedSession()" :disabled="!!(!record || deckOpening)"
                        class="btn btn-sm btn-ghost ml-auto">
                  <span x-show="deckOpening" class="loading loading-spinner loading-xs"></span>
                  Open session<i class="ph ph-arrow-up-right" aria-hidden="true"></i>
                </button>
              </div>
            </template>
            <template x-if="compact && !fixedFind">
            <form @submit.prevent="submitFind()"
                  class="w-full min-w-0 flex items-center gap-1" role="search" aria-label="Find in conversation">
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

          <!-- ── OVERVIEW: the session at a glance ─────────────────────────
               The first tab, so the tabs sit right under the header and the
               room a head above them took goes to the regions (owner,
               2026-11-09). In reading order: where the work stands (the Now
               section); Gemini's summary and topics from the session's topics
               file (web-tools-private sessions/topics/ on background, see
               readTopics), or the host's row until it is read; what it cost;
               and the pages it changed when a host lends them. data-at-open
               names the tab a look link taps to reach an anchor in here. -->
          <template x-if="!compact">
          <div x-show="pane === 'overview'" x-cloak data-session-overview data-at-open="overview"
               class="min-h-0 grow overflow-y-auto overscroll-contain pb-3 flex flex-col gap-3">
          <!-- Who ran it, for a record from the Lenovo's recorder rather than
               a Claude Code session; it rode the tab row until 2026-11-17. -->
          <div x-show="record?.assistant || record?.venue === 'lenovo'" class="shrink-0 flex flex-wrap items-center gap-x-2 text-sm text-base-content/60">
            <span x-show="record?.assistant" x-text="(record?.assistant || '') + ' · Lenovo · ' + (record?.capture?.state || 'coverage unknown')"></span>
            <a x-show="record?.venue === 'lenovo'" href="https://mehrlander.github.io/web-tools/app/?view=local" class="link">Local work observations</a>
          </div>
          <!-- ── NOW: where the session's work stands ─────────────────────
               Not on a lent slide (the app's Sessions deck), which keeps the
               lent Look row below.
               What the session left for the owner: the action message where
               the session wrote one, else its last closing state, and the open
               asks from each branch's PR guide. The branches and what they
               changed are read here too (one compare and PR list per branch),
               and drawn elsewhere: the checkouts panel on the strip and the
               Views tab. User calls are the Calls tab's alone; they were
               listed here as well until the owner asked why (2026-10-22). -->
          <section x-show="!lent && (work.loading || work.last || now || work.err || work.asks.length)"
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
                              :data-title-tip="o === a.recommend ? 'Recommended' : null">
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
          <!-- ── WHAT IT WAS: Gemini's summary, then its topics ─────────────
               The summary leads (owner, 2026-11-17): what the session did,
               then the parts it did it in. The provenance note rides a mark
               at the summary's start, since title-tip underlines whatever
               carries it. -->
          <p x-show="gist.summary" class="text-base leading-snug text-base-content/80">
            <span class="mr-1 inline-block align-[-1px] text-base-content/45" x-html="geminiGlyph()"
                  data-title-tip="Written by Gemini from the session record; not part of the record."></span>
            <span x-text="gist.summary"></span>
          </p>
          <!-- One line a topic, in the order the session reached it; a tap
               selects the topic's first turn in Turns, which draws the same
               topic as a heading over its turns. The mark is how the topic's
               last stretch ENDED (the closing state said inside it), so an
               unfinished one reads as unfinished before anything is opened; a
               dot where it ended on nothing. Minor asides are left to Turns'
               headings. At the line's end, the calls filed in the topic, which
               open the Calls tab at the topic's first (topicCalls); a call
               card's origin line comes back here and lights the line. -->
          <ol x-show="gist.list.length" x-ref="topics" class="flex flex-col">
            <template x-for="t in gist.list" :key="t.topic">
              <li class="-mx-1 flex items-baseline gap-1 rounded pr-1 transition-colors duration-500"
                  :class="topicLit === t.topic.toLowerCase() && 'bg-primary/10'" :data-topic="t.topic.toLowerCase()">
                <button type="button" @click="goTopic(t)" :disabled="t.first < 0"
                        :data-title-tip="topicTip(t)"
                        class="flex min-w-0 grow items-baseline gap-2 rounded px-1 py-0.5 text-left
                               enabled:hover:bg-base-200/70 enabled:cursor-pointer">
                  <span class="w-4 shrink-0 text-center text-sm"
                        :class="!t.state && 'text-base-content/30'"
                        x-text="t.state ? t.state.glyph : '\u00b7'"></span>
                  <span class="min-w-0 grow flex flex-col">
                    <span class="text-base leading-snug" :class="t.status?.status === 'dropped' && 'line-through text-base-content/50'"
                          x-text="t.topic"></span>
                    <!-- An open topic (format 7): the mark for who moves
                         next (RepoSessionsCache.statusMark) and what it
                         waits on, at the name's size. -->
                    <span x-show="topicMark(t)" x-cloak class="flex items-baseline gap-1.5 text-base leading-snug text-base-content/60">
                      <i class="ph shrink-0 self-center" :class="[topicMark(t)?.icon, t.status?.waits_on === 'owner' && 'text-primary']"
                         :data-title-tip="topicMark(t)?.tip"></i>
                      <span x-text="t.status?.waiting || topicMark(t)?.tip"></span></span>
                  </span>
                  <!-- On a phone the calls pill takes the meta's place. -->
                  <span class="shrink-0 font-mono text-xs text-base-content/45" :class="calls.length && 'max-sm:hidden'" x-text="topicMeta(t)"></span>
                </button>
                <!-- A slot on every line once the session has calls, so the
                     lines' ends stay in one column. A gavel counts the calls
                     that wait on the owner; a check, the topic's calls when
                     none does. -->
                <button type="button" x-show="calls.length" x-cloak @click="goTopicCalls(t)" :disabled="!topicCalls(t).n" data-topic-calls
                        class="badge badge-sm min-w-12 shrink-0 justify-start gap-1 font-mono tabular-nums"
                        :class="[!topicCalls(t).n && 'invisible', topicCalls(t).open ? 'border-transparent bg-warning/30 text-warning-content' : 'badge-ghost']"
                        :data-title-tip="topicCalls(t).tip" :aria-label="topicCalls(t).tip">
                  <i class="ph" :class="topicCalls(t).open ? 'ph-gavel' : 'ph-check'"></i><span x-text="topicCalls(t).open || topicCalls(t).n"></span></button>
              </li>
            </template>
          </ol>
          <!-- ── WHAT IT COST: one line and a short chart ──────────────────
               Measured records only (schema 16 on), since the figures come
               from each model step's own usage (kits/session-usage.js): the
               main conversation's cost at API list prices, the owner's
               prompts, the context's peak and the compactions, then the
               context after each prompt (kits/usage-chart.js, context panel
               only). The cost figure opens the panel with cost per prompt and
               the harness's own total (owner, 2026-11-17: the Cost tab went
               for this). A bar opens its turn. -->
          <section x-show="measured" data-session-cost data-at-open="overview" class="shrink-0 flex flex-col gap-1">
            <template x-if="usage">
            <div class="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-[13px] text-base-content/70 tabular-nums" data-cost-line>
              <button type="button" data-fact-btn data-at="cost"
                      @click="toggleFactTip('cost', $el)" @mouseenter="hoverFactTip('cost', $el)" @mouseleave="leaveFactTip()"
                      class="-my-0.5 inline-flex items-center gap-1 rounded px-0.5 transition-colors hover:text-primary"
                      :aria-label="money(usage.totals.modelled) + ' main conversation: cost per prompt'">
                <i class="ph ph-coins text-base leading-none opacity-70"></i><span x-text="money(usage.totals.modelled)"></span></button>
              <span x-text="plural(usage.prompts.length, 'prompt')"></span>
              <span x-text="'context peak ' + tok(costPeak)"></span>
              <span x-show="usage.compactions.length" x-text="plural(usage.compactions.length, 'compaction')"></span>
            </div>
            </template>
            <div data-cost-chart class="w-full min-w-0 text-base-content"
                 @click="costTap($event)" @keydown.enter="costTap($event)"
                 @pointerover="costHover($event)" @pointerleave="costMark(-1)" @focusin="costHover($event)"></div>
          </section>
          <!-- ── Look: what this session was building ─────────────────────
               The pages this session's branches changed, each opening at the
               BRANCH so it shows where the work got to rather than the commit
               some crawl happened to see. branch-brief carries the same row for
               one branch, in the same place and with the same chip; this is its
               fold across the branches one session left behind.

               GROUPED BY BRANCH, each group led by its repository's mark and the
               branch's short name, so a chip says which branch it renders, as
               each branch tile under a session card in the Activity view does.

               LENT, NEVER COMPUTED: in the app the estate lends the crawl's
               pages (estate.js sessionPages), and the app's slide has no Views
               tab to hold them. A standalone pages/session.html is lent nothing
               and draws no row, since its own branch reads fill the Views tab,
               whose contents list groups the same pages by branch.

               ONE LINE THAT SCROLLS, for the reason branch-brief's own Look row
               gives: a wrap spends a whole band on the chip that did not fit,
               and the partial chip at the edge is the affordance. -->
          <div x-show="pageChips.length" data-at="look"
               class="shrink-0 flex items-center gap-1.5 flex-nowrap min-w-0
                      overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span class="text-sm shrink-0 select-none leading-none opacity-80"
                  data-title-tip="Pages this session changed, rendered via toss">🥏</span>
            <template x-for="g in pageGroups" :key="g.key">
              <span class="contents" data-look-branch>
                <span class="shrink-0 inline-flex items-center gap-1 pl-1 font-mono text-xs text-base-content/50 select-none"
                      :data-title-tip="g.repo + ' · ' + g.ref">
                  <span class="contents" x-html="markHtml(g.repoShort)"></span>
                  <i x-show="!marks[g.repoShort]" class="ph ph-git-branch text-sm leading-none"></i>
                  <span x-text="g.short"></span></span>
                <template x-for="t in g.chips" :key="t.addr">
                  <a :href="t.url" target="_blank" rel="noopener" :data-title-tip="t.title"
                     class="shrink-0 rounded-full px-2.5 py-0.5 text-sm font-mono
                            bg-base-200/70 hover:bg-base-200 transition-colors"
                     x-text="t.label"></a>
                </template>
              </span>
            </template>
          </div>
          </div>
          </template>


          <!-- ── TURNS: the exchanges, listed under their topics ───────────
               A list over a strip of cards on a phone and beside it in a wide
               pane (house style rule 11, kits/linked-swiper.js), one row and
               one card per exchange (session-render's grouping). A row is
               Gemini's headline for the turn where its file has one, else the
               exchange's own title, grouped under Gemini's topics, each marked
               with how its last stretch ended. A card is Gemini's summary over
               the exchange as session-render draws it: the ask, the work folded
               to a line, and the reply. The door in the card's head opens the
               full deck at that card. Search filters the list to the matching
               exchanges and moves the card to the first (owner, 2026-11-17:
               the Outline folded in here). -->
          <template x-if="!compact">
          <div x-show="pane === 'turns'" x-cloak data-session-turns class="flex flex-col pb-3 min-h-0 grow">
            <p x-show="findQuery && !findResult.hits.length" class="py-2 text-base text-base-content/65" role="status">No matching turns</p>
            <div x-ref="turnRoot" x-show="!findQuery || findResult.hits.length" class="min-h-0 grow">
              <div x-ref="turnList" role="listbox" aria-label="Turns" data-turn-list></div>
              <div x-ref="turnCard" data-turn-strip></div>
            </div>
          </div>
          </template>

          <!-- The outline and the passages a search matched: the compact
               reader's alone since Turns took the outline in (2026-11-17). -->
          <template x-if="compact">
          <div x-ref="outline" x-show="pane === 'outline' && !findQuery" class="flex flex-col min-h-0 grow"></div>
          </template>
          <template x-if="compact">
          <div x-show="pane === 'outline' && findQuery" x-cloak data-session-find
               class="min-w-0 pb-3 min-h-0 grow overflow-y-auto overscroll-contain">
            <div class="flex items-center gap-2 py-2 text-sm text-base-content/65" role="status" aria-live="polite">
              <span x-text="findResult.hits.length ? plural(findResult.occurrenceTotal, 'occurrence') + ' · ' + plural(findResult.total, 'passage') + ' · ' + plural(findResult.hits.length, 'exchange') : compact ? matchNote || 'No matching discussion' : 'No matching captured exchanges'"></span>
              <span x-show="findResult.hits.length" class="ml-auto shrink-0 whitespace-nowrap font-mono tabular-nums"
                    x-text="findResult.hits.length ? (findAt + 1) + ' / ' + findResult.hits.length : ''"></span>
            </div>
            <template x-if="!compact && !findResult.hits.length">
              <p class="text-base text-base-content/65 py-2">The search may have matched session details or recorded notifications.</p>
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
                            class="block w-full text-left text-base leading-7 [overflow-wrap:anywhere]"
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
          </template>

          <!-- ── RECORD: the stored record, as a tree or as its schema ──────
               What the Log and Schema tabs showed, as one tab with a switch
               over one explorer (kits/json-explorer.js), mounted on the
               first visit (owner, 2026-11-17). Tree is the record's tree
               with its inspector; Schema is the whole record's profile, whose
               arrows open a list as a table or in the tree, and the switch
               follows them. Copy is what the explorer shows, as JSON. -->
          <template x-if="!compact">
          <div x-show="pane === 'record'" x-cloak data-session-record data-at-open="record" class="flex flex-col gap-2 min-h-0 grow pb-3">
            <div class="shrink-0 flex items-center gap-2">
              <div role="tablist" class="join" data-at="record-view" aria-label="Show the record as">
                <button type="button" role="tab" class="btn btn-xs join-item" data-record-view="tree"
                        :class="recView === 'tree' && 'btn-active'" :aria-selected="recView === 'tree' ? 'true' : 'false'"
                        @click="setRecView('tree')">Tree</button>
                <button type="button" role="tab" class="btn btn-xs join-item" data-record-view="schema"
                        :class="recView === 'schema' && 'btn-active'" :aria-selected="recView === 'schema' ? 'true' : 'false'"
                        @click="setRecView('schema')">Schema</button>
              </div>
              <span class="grow"></span>
              <button type="button" @click="copyRecord()" data-at="copy"
                      class="btn btn-sm btn-square btn-ghost" :disabled="!rawBuilt"
                      data-title-tip="Copy as JSON" aria-label="Copy as JSON">
                <i class="ph text-lg max-sm:text-xl" :class="copied ? 'ph-check text-success' : 'ph-copy'"></i></button>
            </div>
            <div x-ref="raw" class="flex flex-col min-h-0 grow"></div>
          </div>
          </template>

          <!-- ── FILES: what the session opened ─────────────────────────────
               A list over a strip of cards on a phone and beside it in a wide
               pane (house style rule 11, kits/linked-swiper.js; owner,
               2026-11-17), grouped by checkout and branch and ordered by the
               sessions cache's own weight (fileWeight), so an edit leads a read.
               A file its branch changed shows that change as the branch page's
               card draws it (fileReview, the diff with added and removed lines
               tinted), and the door in the card's head opens that branch's
               changed files full screen at it (kits/file-deck.js). A file only
               read, or changed and not in the branch's change, or kept in a
               scratchpad, says so. The changes are read on the first visit
               (loadDiffs). -->
          <template x-if="!compact">
          <div x-show="pane === 'files'" x-cloak data-session-files class="flex flex-col pb-3 min-h-0 grow">
            <div x-show="!fileRows.length" class="text-sm opacity-60 py-3" x-text="filesNote"></div>
            <div x-ref="fileRoot" x-show="fileRows.length > 0" class="min-h-0 grow">
              <div x-ref="fileList" role="listbox" aria-label="Files this session opened" data-file-list></div>
              <div x-ref="fileCard" data-file-strip></div>
            </div>
          </div>
          </template>

          <!-- ── THE VIEWS TAB: the list over the pages ─────────────────────
               Every page or Markdown file the session's branches changed,
               grouped by repository and branch, newest first within each, as
               a list over a strip of cards on a phone and beside it in a wide
               pane (house style rule 11, kits/linked-swiper.js; owner,
               2026-11-17: the list left the dropdown). A row names the file by
               its last two path segments, so two files of one name stay
               apart. A pick shows its card, a swipe picks its row, and the
               door in the card's head opens every view full screen at that
               one (openViews). The rows are HTML drawn by viewRows, since the
               kit marks and steps them; a card is drawn only while it is in
               view or beside it, so the frames and the Markdown reads wait for
               the tab. -->
          <template x-if="!compact">
          <div x-show="pane === 'views' && work.views.length" x-cloak data-session-views class="flex flex-col pb-3 min-h-0 grow">
            <div x-ref="viewRoot" class="min-h-0 grow">
              <div x-ref="viewList" role="listbox" aria-label="Pages and documents this session changed" data-view-list></div>
              <div x-ref="viewCard" data-views></div>
            </div>
          </div>
          </template>

          <!-- ── CALLS: the decisions this session put to the owner ───────
               (owner, 2026-10-19: "it would be helpful to see it with the
               session like that as opposed to in this independent
               placement"). A list over a strip of cards on a phone and beside
               it in a wide pane (house style rule 11, kits/linked-swiper.js;
               owner, 2026-11-17), the calls grouped by topic (callOrder). A
               card is where the call came from (CALL_ORIGIN), then the call
               as filed and as it stands, answered in place as the Waiting
               view's is (CALL_CARD), or for a documentation call its form,
               the document with its edits (callForm); the door in its head
               opens the deck of call forms at it. -->
          <template x-if="!compact">
          <div x-show="pane === 'calls'" x-cloak data-session-calls class="flex flex-col pb-3 min-h-0 grow">
            <div x-show="callsLoading && !calls.length" class="flex py-3"><span class="loading loading-dots loading-sm opacity-40"></span></div>
            <div x-ref="callRoot" class="min-h-0 grow">
              <!-- A topic's heading opens its panel (topicPanel); the list
                   scrolling from under it closes it. -->
              <div x-ref="callList" role="listbox" aria-label="Calls this session filed" data-call-list
                   @click="callHeadTap($event)" @mouseover="callHeadOver($event)" @mouseout="callHeadOut($event)"
                   @scroll.passive="factTip?.kind === 'topic' && closeFactTip()"></div>
              <div x-ref="callCard" data-call-strip></div>
            </div>
          </div>
          </template>
          </div>
          </template>
          </div>
        </div>
      `,

      init() {
        this.$el.innerHTML = this.template;
        this.$nextTick(() => {
          if (!this.$el.isConnected) return;
          Alpine.initTree(this.$el);
          this.fitBox();
          if (!this.compact) this.wireHead();
        });
        if (!this.compact) {
          this._findKey = (e) => this.findKey(e);
          window.addEventListener('keydown', this._findKey);
        }
        // The estate's copy only: nothing may be read ahead of the record,
        // since a deck mounts three slides and each one's own blob comes first.
        this.loadMarks(false);
        this.load();
      },
      destroy() {
        for (const fx of this._headFx || []) window.Alpine?.release?.(fx);
        this._headFx = null;
        clearTimeout(this._findT);
        if (this._findKey) { window.removeEventListener('keydown', this._findKey); this._findKey = null; }
        this._viewSwiper?.destroy(); this._viewSwiper = null;
        this._callSwiper?.destroy(); this._callSwiper = null;
        this._turnSwiper?.destroy(); this._turnSwiper = null;
        this._fileSwiper?.destroy(); this._fileSwiper = null;
        // The outline's rail listens for scroll on the window, because that is
        // the only listener that catches both this component's layouts; it is
        // the one thing index() builds that does not die with the tree, so it
        // is released here. On the estate's swiper this runs per slide left.
        this.outlineOff?.(); this.outlineOff = null;
        this._rawExplorer?.destroy?.(); this._rawExplorer = null;
        this._costObs?.disconnect();
        this._costObs = this._costHost = null;
      },
      outlineOff: null,

      // ── The head, as plain DOM ────────────────────────────────────────────
      // Built once: the title, the facts line, the find field and the
      // magnifier. Two effects keep it current, each over what it reads. A deck moves these elements in and out of
      // its header as the reader swipes, which Alpine markup would not
      // survive (branch-brief's hostChrome makes the same trade).
      wireHead() {
        const p = this.buildHead(), A = window.Alpine;
        if (!A?.effect) return;
        this._headFx = [
          A.effect(() => this.paintFacts()),
          A.effect(() => this.paintHead()),
        ];
      },
      buildHead() {
        if (this._head) return this._head;
        const mk = (tag, cls, attrs = {}) => {
          const e = document.createElement(tag);
          if (cls) e.className = cls;
          for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
          return e;
        };
        // In a deck's header the facts take the subtitle's size, so the
        // header keeps its height; drawn here they keep the strip's.
        const size = this.hosted ? 'h-4 text-xs leading-4' : 'h-5 text-[13px] leading-5';
        const title = mk('div', 'truncate text-base font-medium leading-snug', { 'data-session-title': '' });
        const facts = mk('div', 'flex flex-wrap items-center gap-x-2.5 overflow-hidden min-w-0 font-mono text-base-content/70 ' + size,
                         { 'data-session-facts': '' });
        const find = mk('form', 'flex items-center min-w-0', { role: 'search', 'aria-label': 'Find in conversation' });
        const label = mk('label', 'input input-sm flex items-center gap-2 min-w-0 w-full');
        // Text, not search: a search input draws a clear ✕ of its own beside
        // the magnifier's.
        const input = mk('input', 'min-w-0 grow', { type: 'text', enterkeyhint: 'search', placeholder: 'Find in conversation',
                                                     'aria-label': 'Find in conversation', autocomplete: 'off', 'data-conversation-find': '' });
        const count = mk('span', 'shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-base-content/50',
                         { 'data-find-count': '', 'aria-live': 'polite' });
        label.append(mk('i', 'ph ph-magnifying-glass shrink-0 text-base-content/50', { 'aria-hidden': 'true' }), input, count);
        find.append(label);
        find.addEventListener('submit', (e) => e.preventDefault());
        input.addEventListener('input', () => {
          this.findText = input.value;
          clearTimeout(this._findT);
          this._findT = setTimeout(() => this.runFind(), 200);
        });
        // Escape closes the search and not the deck around it, which reads
        // the same key; Enter steps to the next match, Shift+Enter back; the
        // arrows move the caret rather than the deck.
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.clearFind(); return; }
          if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(this._findT);
            this.findText = input.value;
            if (e.shiftKey) this.stepFind(-1); else this.submitFind();
            return;
          }
          if (/^Arrow/.test(e.key)) e.stopPropagation();
        });
        const shape = this.hosted ? 'btn-circle' : 'btn-square';
        const findBtn = mk('button', 'btn btn-ghost btn-sm shrink-0 ' + shape, { type: 'button', 'data-at': 'find' });
        const findIcon = mk('i', '');
        findBtn.append(findIcon);
        findBtn.addEventListener('click', () => this.toggleFind());
        this._head = inert({ title, facts, find, input, count, findBtn, findIcon });
        return this._head;
      },
      // The facts line: the date, the tool calls, the subagents, the
      // checkouts and Gemini's count of turns summarized. Every fact is a
      // control that opens its panel-tip, as on the Sessions row. The short id
      // and the ref this page's code runs from left it on 2026-11-17 (owner):
      // the reader already knows which session is open, and the ref describes
      // the page, not the session.
      paintFacts() {
        const p = this._head;
        if (!p) return;
        p.title.textContent = this.head.title || '';
        const mk = (tag, cls, attrs = {}) => {
          const e = document.createElement(tag);
          if (cls) e.className = cls;
          for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
          return e;
        };
        const span = (text, cls = '') => { const e = mk('span', cls); e.textContent = text; return e; };
        const glyph = (cls) => mk('i', 'ph ' + cls + ' text-[1.2em] leading-none opacity-70', { 'aria-hidden': 'true' });
        const text = (k, v, tip) => {
          const e = span(v, 'whitespace-nowrap');
          e.setAttribute('data-fact', k);
          e.setAttribute('data-title-tip', tip);
          return e;
        };
        const ctl = (k, panel, label, kids, cls = '') => {
          const b = mk('button', 'inline-flex items-center gap-1 whitespace-nowrap rounded tabular-nums transition-colors hover:text-primary ' + cls,
                       { type: 'button', 'data-fact-btn': '', 'data-fact': k, 'aria-label': label });
          b.append(...kids);
          b.addEventListener('click', () => this.toggleFactTip(panel, b));
          b.addEventListener('mouseenter', () => this.hoverFactTip(panel, b));
          b.addEventListener('mouseleave', () => this.leaveFactTip());
          return b;
        };
        const items = [];
        for (const f of this.strip) {
          if (f.k === 'repos') {
            const pill = ctl('repos', 'scope', 'Checked out: ' + this.scopeNames, [],
                             'rounded-full bg-base-200/70 px-1.5 text-base-content/60');
            pill.setAttribute('data-scope-pill', '');
            const marked = this.scopeMarked;
            const marks = mk('span', 'inline-flex items-center gap-1 leading-none');
            marks.innerHTML = marked.map((n) => this.markHtml(n)).join('') || '<i class="ph ph-folders leading-none"></i>';
            pill.append(marks);
            const rest = this.scopeRepos.length - marked.length;
            if (rest > 0) pill.append(span((marked.length ? '+' : '') + rest, 'tabular-nums'));
            items.push(pill);
          } else if (f.panel) {
            items.push(ctl(f.k, f.panel, f.v + ' ' + f.t, [...(f.icon ? [glyph(f.icon)] : []), span(String(f.v))], f.tone));
          } else items.push(text(f.k, String(f.v), f.t));
        }
        const g = this.gemini;
        if (g) {
          const mark = mk('span', 'inline-flex leading-none opacity-70');
          mark.innerHTML = this.geminiGlyph();
          const count = g.state === 'reading' ? '' : g.state === 'unread' ? '?' : g.head.count;
          items.push(ctl('gemini', 'gemini', 'Gemini: ' + g.tip,
                         [mark, ...(count ? [span(count)] : []), ...(g.icon ? [glyph(g.icon)] : [])], g.tone));
        }
        p.facts.replaceChildren(...items);
      },
      // The find field and where the parts stand: the field in place of the
      // title while a search is open, the magnifier as the way to close it.
      paintHead() {
        const p = this._head;
        if (!p) return;
        const finding = this.findShown;
        const tip = finding ? 'Close the search' : 'Find in conversation';
        p.findBtn.setAttribute('aria-pressed', finding ? 'true' : 'false');
        p.findBtn.setAttribute('aria-label', tip);
        p.findBtn.setAttribute('data-title-tip', tip);
        p.findBtn.disabled = !this.record;
        p.findIcon.className = 'ph ' + (finding ? 'ph-x' : 'ph-magnifying-glass') + (this.hosted ? ' text-base' : ' text-lg max-sm:text-xl');
        p.count.textContent = this.findQuery ? this.plural(this.findResult.hits.length, 'turn') : '';
        if (document.activeElement !== p.input && p.input.value !== this.findText) p.input.value = this.findText;
        p.input.disabled = !this.record;
        if (this.hosted) {
          // Handed to the deck only when what stands changes: a repaint
          // moves the elements, and the field must keep its caret.
          const key = finding ? 'find' : 'facts';
          if (this._chromeKey === key) return;
          this._chromeKey = key;
          o.chrome({ sub: p.facts, head: finding ? p.find : null, actions: [p.findBtn] });
          return;
        }
        const box = this.$refs.headBox, act = this.$refs.actBox;
        const want = finding ? [p.find] : [...(this.framed ? [] : [p.title]), p.facts];
        if (box && (box.children.length !== want.length || want.some((e, i) => box.children[i] !== e))) box.replaceChildren(...want);
        if (act && act.firstChild !== p.findBtn) act.replaceChildren(p.findBtn);
      },
      outlineJump: null,

      // A standalone shell ends at the viewport's foot: its height is the
      // viewport less its own top in the document, which is the host's
      // address bar on pages/session.html. MEASURED AGAIN ONCE THE RECORD IS
      // IN (settle calls this), and on the next frame: at mount the host's
      // loading spinner still stands above the shell, and the first build
      // measured 157px for a 49px bar, leaving a band empty at the foot.
      fitBox() {
        if (this.framed) return;
        const set = () => {
          const top = Math.max(0, Math.round(this.$el.getBoundingClientRect().top + window.scrollY));
          this.boxHeight = 'calc(100dvh - ' + top + 'px)';
        };
        set();
        requestAnimationFrame(set);
        if (!this._boxWired) { this._boxWired = true; window.addEventListener('resize', set); }
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
        const status = Array.isArray(t?.topic_status) ? t.topic_status : f.topicStatus;
        const listed = (window.RepoSessionsCache?.topicList?.(agenda, status) || []).filter(t => !t.minor);
        const list = listed.length ? listed
          : topics.map(topic => ({ topic, kind: null, first: -1, spans: [], turns: 0, state: null, status: null }));
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
      topicMark(t) {
        return window.RepoSessionsCache?.statusMark?.(t?.status) || null;
      },
      topicTip(t) {
        const kind = { new: 'New work', improve: 'Improving something that existed',
                       fix: 'A fix', explore: 'A question or investigation' }[t.kind];
        const spans = t.spans.map(([a, b]) => a === b ? 'turn ' + (a + 1) : 'turns ' + (a + 1) + '\u2013' + (b + 1));
        const status = t.status && ({ done: 'Done', open: 'Open', dropped: 'Dropped' }[t.status.status]
          + (t.status.evidence ? ' (' + t.status.evidence.replace(/\*\*/g, '') + ')' : ''));
        return [t.area, kind, spans.join(', '), t.state && 'Ended on: ' + t.state.line, status].filter(Boolean).join('. ');
      },
      // ── The tab row ────────────────────────────────────────────────────────
      // Turns is Gemini's summary of each turn, there once its topics file
      // carries them.
      get hasTurns() { return this.geminiDetail.rows.length > 0; },
      // Cost is drawn when the record kept each model step's usage, which is
      // schema 16 on (sessions/README.md, `responses`).
      get measured() {
        const r = this.record?.responses;
        return Array.isArray(r) && r.length > 0;
      },
      // The tabs there are, in the row's order.
      get tabs() {
        if (this.compact) return [];
        return PANES.filter((t) => (t !== 'calls' || this.calls.length)
          && (t !== 'views' || this.work.views.length) && (t !== 'files' || this.fileRows.length));
      },
      // The tab on screen: the one asked for, once it exists, else Calls while
      // a call waits on the owner, else the Overview. A tab asked for before
      // its content arrives (Calls, Views, Turns are all read after the
      // record) shows the row's own choice until it does. Setting it shows
      // that tab, which is how `pane=` and the deck's links land.
      get pane() {
        if (this.compact) return 'outline';
        const a = this.asked;
        if (a && this.tabs.includes(a)) return a;
        return this.openCallCount ? 'calls' : 'overview';
      },
      set pane(v) { this.show(v); },
      show(tab) {
        const asView = tab === 'schema' || tab === 'log' || tab === 'raw';
        if (tab === 'schema') this.recView = 'schema';
        else if (asView) this.recView = 'tree';
        if (tab === 'cost') this.costAsked = true;
        tab = paneOf(tab);
        if (!tab) return;
        this.asked = tab;
        if (tab === 'overview') this.$nextTick(() => this.mountCost());
        if (tab === 'record') { const apply = asView; this.$nextTick(() => this.openRecord(apply)); }
        if (tab === 'views') this.$nextTick(() => this.mountViews());
        if (tab === 'calls') this.$nextTick(() => this.mountCalls());
        if (tab === 'turns') this.$nextTick(() => this.mountTurns());
        if (tab === 'files') this.$nextTick(() => this.mountFiles());
      },
      // ── The cost, on the Overview ─────────────────────────────────────────
      // kits/session-usage.js does the arithmetic and kits/usage-chart.js
      // draws it; this sizes, redraws and answers the pointer. Dollar
      // figures are API list-price equivalents, which the cost panel's head
      // says in its title-tip.
      money(v) {
        if (!Number.isFinite(v)) return '';
        return v >= 100 ? '$' + Math.round(v).toLocaleString('en-US') : '$' + v.toFixed(2);
      },
      // Tokens as the chart's axis writes them: 612k, 1.2M.
      tok(n) {
        if (!Number.isFinite(n)) return '';
        return n >= 1e6 ? (Math.round(n / 1e5) / 10) + 'M' : Math.round(n / 1000) + 'k';
      },
      // The most context any prompt held, a compaction's high point included.
      get costPeak() {
        const u = this.usage;
        if (!u) return 0;
        return Math.max(0, ...u.prompts.map((r) => r.context || 0), ...u.compactions.map((c) => c.before || 0));
      },
      async mountCost() {
        if (!this.record || !this.measured) return;
        if (!window.SessionUsage) await window.gh?.load?.('kits/session-usage.js').catch(() => {});
        if (!window.UsageChart) await window.gh?.load?.('kits/usage-chart.js').catch(() => {});
        if (!window.SessionUsage || !window.UsageChart) return;
        // Read again only when the record moved: a live session's is rewritten
        // on every Stop, and everything else is read once.
        const key = (this.record.ended || '') + ':' + this.record.responses.length;
        if (!this.usage || this._costKey !== key) {
          this.usage = window.SessionUsage.read(this.record);
          this._costKey = key;
        }
        await this.$nextTick();
        const host = this.$root.querySelector('[data-cost-chart]');
        if (!host) return;
        if (this._costHost !== host) {
          this._costObs?.disconnect();
          this._costHost = host;
          // The host's width, which is 0 while the Overview is hidden.
          this._costObs = window.ResizeObserver ? new ResizeObserver(() => this.costDraw()) : null;
          this._costObs?.observe(host);
        }
        this.costDraw();
        // An address's pane=cost: the cost panel, once, at the figure.
        if (this.costAsked && this.pane === 'overview') {
          this.costAsked = false;
          const btn = this.$root.querySelector('[data-at="cost"]');
          if (btn) this.toggleFactTip('cost', btn);
        }
      },
      // SHORT ON PURPOSE: the context panel alone, at a fixed height, so it
      // reads as a sparkline under the cost line rather than as a chart the
      // Overview is about. Cost per prompt is the panel's.
      costDraw() {
        const host = this._costHost, u = this.usage;
        if (!host || !u) return;
        const w = Math.floor(host.clientWidth);
        if (!w) return;
        if (w === this._costW && host.firstChild) return;
        this._costW = w;
        host.innerHTML = this.costSvg(u, w);
        this.costMark(this.costPick);
      },
      // The chart is kits/usage-chart.js's, the Compactions card's too.
      costSvg(u, W, ph = 48) {
        return window.UsageChart.svg(u, W, { ph, costPh: 0 });
      },
      // The cost panel's chart: cost per prompt as bars behind the context
      // line, one panel, at the panel's own width.
      costPanelSvg() {
        const u = this.usage, t = this.factTip;
        if (!u || !t || !window.UsageChart) return '';
        const w = Math.max(160, Math.floor(t.w - 24 - (this.factTipClose ? 28 : 0)));
        return window.UsageChart.svg(u, w, { ph: 96, combined: true });
      },
      // Mark prompt k (or none) in both panels: the band and the dot.
      costMark(k) { window.UsageChart?.mark(this._costHost, this.usage, k); },
      costHover(e) {
        const el = e.target instanceof Element ? e.target.closest('[data-k]') : null;
        if (el) this.costMark(+el.getAttribute('data-k'));
      },
      // A click goes to that turn, as a row of the Turns tab does. On a screen
      // that cannot hover the first tap picks the prompt, which opens its
      // title-tip and marks it, and a second tap on it goes.
      costTap(e) {
        const el = e.target instanceof Element ? e.target.closest('[data-k]') : null;
        if (!el) return;
        const k = +el.getAttribute('data-k');
        const r = this.usage?.prompts[k];
        if (!r) return;
        const hover = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
        if (e.type === 'click' && !hover && this.costPick !== k) {
          this.costPick = k;
          this.costMark(k);
          return;
        }
        this.costPick = -1;
        window.TitleTip?.close?.();
        this.goTurn(r.prompt);
      },
      // A prompt (record.prompts[i]), as the cost chart names one, or a topic,
      // as the Overview lists them: the Turns tab, at its exchange.
      goTurn(i) { this.selectTurn(this.cardOfPrompt(i)); },
      goTopic(t) {
        const st = t && t.first >= 0 ? this.gist.agenda[t.first] : null;
        if (st) this.selectTurn(this.cardOfPrompt(st.start));
      },
      selectTurn(k) {
        if (!(k >= 0)) return;
        this.tSel = String(k);
        if (this.pane !== 'turns') this.show('turns');
        else this.$nextTick(() => this._turnSwiper?.show(this.tSel));
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
      // `failures` is never a fact of its own: it rides the wrench, in its
      // panel and its label, as on the Sessions row.
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
          ['calls', r.calls_total, '', r.failures ? `tool calls, ${r.failures} failed` : 'tool calls', 'ph-wrench', 'tools'],
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
        // A stretch starts at the first turn and after any break of more than
        // two hours, and is headed by when it began. Only where the record's
        // prompts line up with Gemini's turns, since the times are theirs.
        const at = (i) => g.aligned ? Date.parse(prompts[i]?.at) : NaN;
        const stretch = (i) => {
          const t0 = at(i);
          if (Number.isNaN(t0) || (i > 0 && !(t0 - at(i - 1) > 2 * 3600e3))) return '';
          const d = new Date(t0);
          return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · '
            + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        };
        const rows = !g.perTurn ? [] : Array.from({ length: Math.max(g.asked, g.covered) }, (_, i) => {
          const x = byTurn.get(i) || null;
          const mark = i >= g.covered ? 'after' : x && x.summary ? 'done' : 'skipped';
          return { n: i + 1, mark, head: stretch(i),
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
          return { name, branches,
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
      // The same chips by branch, in the order they arrive. Each target names
      // its repo and ref (kits/guide-render.js pageTargets), so the grouping
      // needs nothing the chip does not already carry.
      get pageGroups() {
        const groups = new Map();
        for (const t of this.pageChips) {
          const key = (t.repo || '') + '@' + (t.ref || '');
          if (!groups.has(key)) {
            const repoShort = String(t.repo || '').split('/').pop();
            groups.set(key, { key, repo: t.repo || '', ref: t.ref || '', repoShort,
                              short: window.AssistantMark?.shortBranch?.(t.ref || '') || t.ref || '', chips: [] });
          }
          groups.get(key).chips.push(t);
        }
        return [...groups.values()];
      },

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
        return n ? window.Traffic.fmtBytes(n, '') : '';
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
        // A search filters the Turns tab, so a search, from the field or from
        // an address's find=, brings the row there and leaves it there when
        // the search is cleared. The compact reader keeps its list of passages.
        if (query && !this.compact) this.asked = 'turns';
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
        if (!this.compact && this.pane === 'turns') this.$nextTick(() => this.mountTurns());
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
        this.findOpen = false;
        this.runFind();
        if (this.compact) this.$nextTick(() => this.mountOutline());
      },
      get findShown() { return this.findOpen || !!this.findText || !!this.findQuery; },
      // The magnifier opens the field in place of the title, and turns into
      // the way to close it, which clears any search it holds; Escape closes
      // it too. The matches are the Outline tab's (see runFind).
      toggleFind() {
        if (this.findShown) return this.clearFind();
        this.openFind();
      },
      openFind() {
        if (this.compact || !this.record) return;
        this.findOpen = true;
        if (this.pane !== 'turns') this.show('turns');
        this.$nextTick(() => requestAnimationFrame(() => {
          const i = this._head?.input;
          if (i && i.isConnected) { i.focus(); i.select(); }
        }));
      },
      // CTRL+F AND CMD+F OPEN IT FROM ANYWHERE on the page, in place of the
      // browser's own find, which cannot reach a turn's full text: the outline
      // draws each ask and reply cut short. Only the view in front answers: a
      // deck slide while its facts are in the header on top, an inline view
      // while no deck covers it. Anything else leaves the keys to the browser.
      findKey(e) {
        if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || String(e.key).toLowerCase() !== 'f') return;
        if (this.compact || !this.record || !this._head) return;
        const top = window.swipeDeck?.top?.() || null;
        const facts = this._head.facts;
        const front = this.hosted ? facts.isConnected && (!top || !!top.el?.contains(facts))
          : this.$el.isConnected && !top;
        if (!front) return;
        e.preventDefault();
        this.openFind();
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
        if (!this.lent) this.loadCalls();
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
          if (this.pane === 'views') this.$nextTick(() => this.mountViews());
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
          this.keepDiffs(slug, branch, cmp);
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
              // A thread waiting on the owner (the guide's 🟡) or an ask in a
              // closing state's glyph; a 🟢 step is the session's own to take.
              for (const t of this.openThreads(pr.body)) {
                if (!/^(🟡|🛵|✴|👁|✍|🪧|⚖|🆚|🟠)/u.test(t.glyph)) continue;
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
      openViewsPane() { this.show('views'); },
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
          // A card drawn before its file arrived holds a placeholder; fill it.
          for (const el of this.$refs.viewCard?.querySelectorAll('[data-md]') || []) {
            if (el.getAttribute('data-md') === v.key) el.innerHTML = v.html || '';
          }
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
          // The Calls tab groups by topic, so its rows wait on these too.
          if (this.pane === 'calls') this.$nextTick(() => this.mountCalls());
        } catch (e) { this.topicsState = e?.status === 404 ? 'none' : 'unread'; return; }
        if (this.outlineBuilt) this.remountOutline();
        if (this.pane === 'turns') this.$nextTick(() => this.mountTurns());
      },

      // ── The action message ─────────────────────────────────────────────────
      async loadNow() {
        if (this.lent || !this.path || !window.GH) return;
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
        const found = [], answering = [];
        await Promise.all(places.map(async ({ repo, ref }) => {
          const g = new window.GH({ token: window.TOKEN, repo, ref });
          let list = [];
          try { list = await g.req('contents/user-calls?ref=' + encodeURIComponent(ref)); } catch { return; }
          const mine = (Array.isArray(list) ? list : []).filter((f) => new RegExp('^' + sid + '-[a-z0-9-]+\\.json$').test(f.name));
          await Promise.all(mine.map(async (f) => {
            try {
              const c = JSON.parse((await g.get(f.path)).text);
              found.push({ ...c, _repo: repo, _ref: ref, _path: f.path });
              answering.push(this.loadCallAnswers(found[found.length - 1]));
            } catch { /* one unreadable call is not the list failing */ }
          }));
        }));
        found.sort((a, b) => (a.status === 'closed') - (b.status === 'closed') || (a.created || '').localeCompare(b.created || ''));
        this.calls = found;
        this.callsLoading = false;
        if (this.pane === 'calls') this.$nextTick(() => this.mountCalls());
        // The Turns list marks each turn's open calls (turnFlair).
        if (this.pane === 'turns') this.$nextTick(() => this.mountTurns());
        // Each call's state is its answers', which arrive after it; the calls
        // they settle go after a topic's waiting ones from then on.
        Promise.all(answering).then(() => {
          this.callSettled = Object.fromEntries(found.filter((c) => !this.callWaits(c)).map((c) => [c.id, true]));
          this.relistCalls();
        });
        // An address that asked for the Calls tab of a session with none
        // leaves the row to choose instead of an empty pane.
        if (this.asked === 'calls' && !found.length) this.asked = '';
        const want = (() => {
          try {
            // `user-call`, and `call` from before the rename (2026-10-04), so
            // a link handed over earlier still opens its slide.
            const h = new URLSearchParams((location.hash || '').replace(/^#/, '')), s = new URLSearchParams(location.search);
            return h.get('user-call') || h.get('call') || s.get('user-call') || s.get('call');
          } catch { return null; }
        })();
        let at = want ? found.findIndex((c) => c.slug === want || c.id === want) : -1;
        // Not on a lent slide: in the app, `call` is the Waiting view's key.
        // The answers first, so the deck knows which calls are still open.
        if (at >= 0 && !this._callOpened && !this.lent) {
          this._callOpened = true;
          await Promise.all(answering);
          // A link may name a call that no longer waits: the caption's ✍️
          // picks its call from the session's own copy of the store, which
          // an answer sent from this page reaches only after the session
          // pulls. The deck then opens at the first call of the same group
          // that still waits, and with none waiting the Calls tab shows
          // where each call stands.
          const doc = found[at].kind === 'documentation';
          if (!this.callWaits(found[at])) at = found.findIndex((c) => (c.kind === 'documentation') === doc && this.callWaits(c));
          if (at < 0) this.asked = 'calls';
          else { this.cSel = found[at].id; this._callSwiper?.show(this.cSel); this.$nextTick(() => this.openCalls(at)); }
        }
      },
      // A call as the Calls tab shows it: its kind, and where it stands.
      callKindIcon(c) { return { documentation: 'ph-pencil-line', merge: 'ph-git-merge' }[c.kind] || 'ph-scales'; },
      callKindLabel(c) { return { documentation: 'Edits', merge: 'Merge', pick: 'Choice' }[c.kind] || 'Approval'; },
      callState(c) { return c.status === 'closed' ? 'Closed' : this.callDone(c) ? 'Answered: ' + this.callDone(c) : 'Open'; },
      callStateTone(c) { return this.callWaits(c) ? 'border-0 bg-warning/30 text-warning-content' : 'badge-ghost'; },
      get openCallCount() { return this.calls.filter((c) => this.callWaits(c)).length; },
      // The answer buttons a card offers, as Waiting's footer does: Merge for a
      // merge, an older call's options with the recommended one first, and
      // none once it is answered or closed. A call filed as Take or Adjust
      // has the reply box instead (callAdjustable). A documentation call is
      // answered from its edits, in the form below.
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
          this.relistCalls();
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
      // ── The Turns tab: a list over a strip of cards ──────────────────────
      // One row and one card per exchange. The prompt an exchange answers is
      // found by its ask's instant, which is what Gemini's notes and the
      // agenda key on too.
      get turnInfo() { return cardsOf(this.record); },
      cardOfPrompt(i) {
        const at = this.record?.prompts?.[i]?.at;
        return at ? this.turnInfo.askAt.indexOf(at) : -1;
      },
      // Gemini's headline and summary for an exchange, from its topics file.
      turnNote(k) {
        const notes = this._notes || (this._notes = this.turnNotes() || {});
        const n = notes[this.turnInfo.askAt[k]];
        return (Array.isArray(n) ? n.find(Boolean) : n) || null;
      },
      // The agenda stretch an exchange falls in: the last one starting at or
      // before its prompt.
      turnStretch(k, ag = this.gist.agenda) {
        const p = this.turnInfo.promptOf[k];
        let at = -1;
        for (let j = 0; j < ag.length; j++) if (p >= 0 && ag[j].start <= p) at = j;
        return at;
      },
      get turnIds() {
        const n = this.turnInfo.cards.length;
        if (this.findQuery) return this.findResult.hits.map((h) => String(h.card));
        return Array.from({ length: n }, (_, k) => String(k));
      },
      turnTitle(k) {
        const note = this.turnNote(k), row = this.turnInfo.rows[k] || {};
        return note?.headline || note?.summary || row.title || 'Exchange ' + (k + 1);
      },
      async mountTurns() {
        const root = this.$refs.turnRoot, list = this.$refs.turnList, card = this.$refs.turnCard;
        if (!root || !list || !card || !this.record) return;
        await this.ready();
        if (!window.linkedSwiper && window.gh?.load) await window.gh.load('kits/linked-swiper.js').catch(() => {});
        if (!window.linkedSwiper || !window.sessionRender) return;
        // The turn view's kits, before the first card is drawn (turnBody).
        if (!window.TurnView && window.gh?.load) {
          for (const kit of ['kits/turn-views.js', 'kits/guide-render.js', 'kits/turn-view.js']) await window.gh.load(kit).catch(() => {});
        }
        const ids = this.turnIds;
        if (!ids.length) return;
        // A search moves the card to its first match.
        if (this.findQuery && !ids.includes(this.tSel)) this.tSel = ids[0];
        const keys = ids.join(',') + '|' + this.findQuery + '|' + this.topicsState + '|' + (this.calls?.length || 0);
        if (this._turnSwiper && keys === this._turnKeys) return;
        this._turnKeys = keys;
        this._notes = null;
        list.innerHTML = this.turnRows(ids);
        if (this._turnSwiper) { this._turnSwiper.mount(); return; }
        this._turnSwiper = window.linkedSwiper.attach({
          root, list, card, key: 'turn', noun: 'turn',
          ids: () => this.turnIds,
          sel: () => this.turnIds.includes(this.tSel) ? this.tSel : this.turnIds[0],
          head: ({ i, n, tight }) => this.turnHead(i, n, tight),
          body: (id, el) => { this.turnBody(+id, el); },
          // Each card fills its slide and scrolls inside itself, so a row
          // pinned at its bottom stays put (turnBody).
          innerClass: 'h-full w-full', slidePad: 'p-0',
          onPick: (id) => { this.tSel = id; },
          deck: () => this.openDeck(+(this.turnIds.includes(this.tSel) ? this.tSel : this.turnIds[0])),
        });
        // The first mark runs before the list's height cap is drawn, so a turn
        // picked from another tab (a topic, a call's turn, a cost bar) was
        // left below the list's fold; marked again once the cap is drawn
        // (html-style rule 14).
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const id = this.turnIds.includes(this.tSel) ? this.tSel : this.turnIds[0];
          if (id != null) this._turnSwiper?.show(id);
        }));
      },
      // The card's head, the strip's standard one (linkedSwiper.head) with
      // the turn's facts: when it was asked, the context it opened on and
      // what it added, the title, the closing state's glyph, n of total,
      // the deck door, and Full, the turn page.
      turnHead(i, n, tight) {
        const ids = this.turnIds, k = +ids[i], esc = window.esc;
        if (!(k >= 0) || !window.linkedSwiper) return '';
        const tv = window.TurnViews?.of(this.record, k + 1);
        const card = this.turnInfo.cards[k] || [];
        const at = (card.find((t) => t.role === 'user') || card[0] || {}).ts || '';
        const kt = (x) => (x >= 1000 ? Math.round(x / 1000) + 'k' : String(x));
        const u = tv?.usage;
        const use = u ? kt(u.start) + (u.end !== u.start ? (u.end > u.start ? '+' : '\u2212') + kt(Math.abs(u.end - u.start)) : '') : '';
        const closing = tv?.closing;
        const full = this.path && tv ? 'https://mehrlander.github.io/web-tools/pages/turn.html#id=' + this.shortId + '&turn=' + (k + 1) : '';
        return window.linkedSwiper.head({ when: tight ? '' : at.slice(0, 5), code: use, title: this.turnTitle(k), pill: closing?.glyph || '' }, i, n, 'turn', { deck: !tight, tight })
          + (full ? '<a href="' + esc(full) + '" class="btn btn-xs btn-ghost btn-square cursor-pointer hover:text-primary" data-turn-full'
            + ' aria-label="This turn full screen" data-title-tip="This turn full screen"><i class="ph ph-arrows-out text-base"></i></a>' : '');
      },
      turnRows(ids) {
        const esc = window.esc;
        const gist = this.gist, agenda = gist.agenda;
        const states = new Map(gist.list.map((t) => [t.topic.toLowerCase(), t.state]));
        let group = -2, out = '';
        const calls = this.openCallsByTurn();
        for (const id of ids) {
          const k = +id, st = this.turnStretch(k, agenda);
          if (st !== group) {
            group = st;
            const s = agenda[st];
            if (s) {
              const mark = (s.state || states.get(s.topic.toLowerCase()))?.glyph || '\u00b7';
              // Opaque, as the Calls list's headings are: a translucent one
              // let the rows scrolling under it show through its words.
              out += '<div class="sticky top-0 z-10 flex items-baseline gap-1.5 border-b border-base-200 bg-base-200 px-3 py-1 text-xs font-medium text-base-content/60">'
                + '<span class="w-4 shrink-0 text-center">' + esc(mark) + '</span><span class="truncate">' + esc(s.topic) + '</span></div>';
            }
          }
          const row = this.turnInfo.rows[k] || {};
          out += '<div data-turn="' + k + '" role="option" tabindex="-1" class="flex cursor-pointer items-baseline gap-2 border-b border-base-200 px-3 py-1.5 last:border-0 hover:bg-base-200/60 aria-selected:bg-primary/10">'
            + '<span class="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-base-content/40">' + esc(row.exchange || k + 1) + '</span>'
            + '<span class="min-w-0 flex-1 line-clamp-2 text-sm">' + esc(this.turnTitle(k)) + '</span>'
            + this.turnFlair(k, calls.get(k) || 0) + '</div>';
        }
        return out;
      },
      // What a turn holds, as marks at the row's end: the pages and documents
      // it changed, the user calls it filed that are still open, a compaction,
      // and messages between sessions. Nothing for a turn that holds none.
      // What a turn holds, as marks: the pages and documents it changed, the
      // user calls it filed that are still open, a compaction, and messages
      // between sessions. The Turns list draws them at a row's end
      // (turnFlair), and the deck on its index rows and beside its title.
      turnMarks(k, open = this.openCallsByTurn().get(k) || 0) {
        const tv = window.TurnViews?.of(this.record, k + 1);
        if (!tv) return [];
        const pages = tv.files.length;
        return [
          pages ? { icon: tv.files.some((f) => f.kind === 'page') ? 'ph-browser' : 'ph-file-text', n: pages, tone: 'text-primary',
                    tip: pages + (pages === 1 ? ' page or document' : ' pages and documents') } : null,
          open ? { icon: 'ph-tray', n: open, tone: 'text-warning', tip: open + (open === 1 ? ' open user call' : ' open user calls') } : null,
          tv.compactions ? { icon: 'ph-arrows-in-line-vertical', n: tv.compactions, tone: 'text-warning', tip: 'Context compacted' } : null,
          tv.peers || tv.spawn ? { icon: 'ph-arrows-left-right', n: (tv.peers || 0) + (tv.spawn ? 1 : 0), tone: 'text-secondary', tip: 'Messages between sessions' } : null,
        ].filter(Boolean);
      },
      // Open user calls by the card they came from.
      openCallsByTurn() {
        const calls = new Map();
        for (const c of this.calls || []) {
          if (c?.status && c.status !== 'open') continue;
          const k = this.cardOfPrompt(this.callTurn(c));
          if (k >= 0) calls.set(k, (calls.get(k) || 0) + 1);
        }
        return calls;
      },
      turnFlair(k, open) {
        const esc = window.esc;
        const out = this.turnMarks(k, open).map((m) => '<span class="flex shrink-0 items-center gap-0.5 ' + m.tone + '" aria-label="' + esc(m.tip)
          + '" data-title-tip="' + esc(m.tip) + '"><i class="ph ' + m.icon + ' text-sm"></i>'
          + (m.n > 1 ? '<span class="font-mono text-xs tabular-nums">' + m.n + '</span>' : '') + '</span>');
        return out.length ? '<span class="flex shrink-0 items-center gap-1.5 self-center">' + out.join('') + '</span>' : '';
      },
      // Gemini's summary over the exchange as session-render draws it. Drawn
      // with the search, so a matching passage is marked and unfolded.
      turnBody(k, el) {
        const card = this.turnInfo.cards[k];
        if (!card) return;
        const note = this.turnNote(k);
        // The discussion: Gemini's summary over the exchange as
        // session-render draws it, with the search marked and unfolded.
        const discussion = (target, footer) => {
          const box = document.createElement('div');
          box.className = 'flex flex-col gap-3';
          if (note?.summary) {
            const p = document.createElement('p');
            p.className = 'flex items-start gap-1.5 text-base leading-snug text-base-content/75';
            p.setAttribute('data-turn-summary', '');
            const mark = document.createElement('span');
            mark.className = 'mt-1 shrink-0 text-base-content/45';
            mark.innerHTML = this.geminiGlyph();
            const t = document.createElement('span');
            t.textContent = note.summary;
            p.append(mark, t);
            box.append(p);
          }
          const host = document.createElement('div');
          host.className = 'flex flex-col gap-3';
          box.append(host);
          target.replaceChildren(box);
          // Lumped: the ask and the final reply open, the churn between
          // them one fold per stretch, compactions and messages between
          // sessions drawn as rows of their own (session-render lumpCard).
          const tv = window.TurnViews?.of(this.record, k + 1);
          const inbound = tv ? window.TurnViews.peers(this.record).filter((p) => p.at >= tv.from && (!tv.to || p.at < tv.to)) : [];
          const list = inbound.length ? [...card, ...inbound].sort((x, y) => String(x.at).localeCompare(String(y.at))) : card;
          window.sessionRender.card?.(list, host, { lump: true, spawn: tv?.spawn || null, ...(footer ? { footer } : {}),
                                                    ...(this.findQuery ? { find: this.findQuery } : {}) })?.catch?.(() => {});
        };
        // A turn that changed pages or documents is one bounded view: a row
        // pinned at the card's bottom chooses the discussion or a file
        // (kits/turn-view.js, the view pages/turn.html draws full). One that
        // changed none is the discussion alone, as it always was.
        const n = k + 1;
        if (this.path && window.TurnView?.files(this.record, n)) {
          const want = this._turnFile && this._turnFile.k === k ? this._turnFile.j : 0;
          window.TurnView.card(el, { record: this.record, path: this.path, n, store: this.repo || STORE,
                                     start: want, discussion, onPick: () => { this._turnFile = null; } });
          return;
        }
        // No files: the discussion, with the reply's close pinned below it.
        const shell = document.createElement('div');
        shell.className = 'flex h-full min-h-0 flex-col';
        const scroll = document.createElement('div');
        scroll.className = 'min-h-0 flex-auto overflow-y-auto px-3.5 py-3';
        const close = document.createElement('div');
        close.setAttribute('data-at', 'turn-close');
        close.className = 'flex flex-none flex-col gap-0.5 border-t border-base-300 bg-base-100 py-1.5 pl-3.5 pr-16 empty:hidden';
        shell.append(scroll, close);
        el.replaceChildren(shell);
        discussion(scroll, close);
      },

      // ── The Files tab: a list over a strip of cards ──────────────────────
      // A record names a file by its checkout ("web-tools/lib/x.js"); the
      // checkout's branch and its change against main are what say whether
      // the session's work on the file landed there. Each changed file is
      // kept by checkout and path, with what the branch page's card needs.
      keepDiffs(slug, branch, cmp) {
        const d = this._diffs || (this._diffs = new Map());
        const name = slug.split('/').pop();
        const base = cmp.merge_base_commit?.sha || 'main';
        for (const f of cmp.files || []) {
          d.set(name + '/' + f.filename, { slug, branch, base, path: f.filename, previousPath: f.previous_filename || '',
            status: f.status, additions: f.additions, deletions: f.deletions, patch: f.patch || '' });
        }
      },
      // The changes of each branch the session worked, read once, on the
      // first visit to Files; a standalone page has read most already, with
      // the Views tab's reads.
      loadDiffs() {
        if (this._diffsLoading) return this._diffsLoading;
        this.diffsState = 'reading';
        this._diffsLoading = (async () => {
          if (!window.BranchBrief && window.gh?.load) await window.gh.load('kits/branch-brief.js').catch(() => {});
          const owner = String(this.repo || STORE).split('/')[0];
          const read = new Set((this.work.branches || []).map((b) => b.slug + '@' + b.branch));
          if (window.BranchBrief && window.GH) {
            await Promise.all(sessionBranches(this.record).map(async (r) => {
              const slug = owner + '/' + r.name;
              if (read.has(slug + '@' + r.branch)) return;
              try {
                const gh = new window.GH({ token: window.TOKEN, repo: slug, ref: r.branch });
                const got = await window.BranchBrief.readBrief(gh, { repo: slug, branch: r.branch, base: 'main' });
                this.keepDiffs(slug, r.branch, got.compare || {});
              } catch { /* a branch that cannot be read leaves its files unchanged here */ }
            }));
          }
          this.diffsState = 'read';
        })();
        return this._diffsLoading;
      },
      // A file as the Files tab draws it: its checkout, its path there, what
      // the session did to it, and its branch's change where there is one.
      fileInfo(path) {
        const slash = path.indexOf('/'), checkout = slash > 0 ? path.slice(0, slash) : '';
        const rel = slash > 0 ? path.slice(slash + 1) : path;
        const kinds = (this.record?.files || {})[path] || {};
        const wrote = ['edit', 'write', 'notebookedit'].some((k) => +kinds[k] > 0 || +kinds[k[0].toUpperCase() + k.slice(1)] > 0)
          || Object.entries(kinds).some(([k, n]) => /edit|write/i.test(k) && +n > 0);
        const scratch = /(^|\/)scratchpad\//.test(path);
        return { path, checkout, rel, wrote, scratch, diff: this._diffs?.get(path) || null };
      },
      get fileOrder() { return this.branchGroups.flatMap((g) => g.files.map((f) => f.path)); },
      async mountFiles() {
        const root = this.$refs.fileRoot, list = this.$refs.fileList, card = this.$refs.fileCard;
        if (!root || !list || !card || !this.fileRows.length) return;
        // The branch page's file card and what it reads with, as the branch
        // deck loads them (user-call-form.js BRANCH_KITS); the pre-build
        // carries them, so this is a lookup on the page and in the app.
        for (const k of ['kits/linked-swiper.js', 'kits/review-target.js', 'kits/guide-render.js', 'kits/cm6-merge.js',
                         'alpineComponents/file-review.js']) {
          if (window.gh?.load) await window.gh.load(k).catch(() => {});
        }
        if (!window.linkedSwiper) return;
        if (!this.diffsState) this.loadDiffs().then(() => this.mountFiles());
        const ids = this.fileOrder;
        const keys = ids.join('\n') + '|' + this.diffsState;
        if (this._fileSwiper && keys === this._fileKeys) return;
        this._fileKeys = keys;
        list.innerHTML = this.fileListRows();
        if (this._fileSwiper) { this._fileSwiper.mount(); return; }
        this._fileSwiper = window.linkedSwiper.attach({
          root, list, card, key: 'file', noun: 'file',
          ids: () => this.fileOrder,
          sel: () => this.fileOrder.includes(this.fSel) ? this.fSel : this.fileOrder[0],
          head: ({ i, n, tight }) => {
            const f = this.fileInfo(this.fileOrder[i] || '');
            return window.linkedSwiper.head({ code: f.checkout, title: f.rel }, i, n, 'file', { deck: !!f.diff, tight });
          },
          body: (id, el) => this.fileBody(id, el),
          release: (i, el) => { for (const w of el.querySelectorAll('[x-data]')) window.Alpine?.destroyTree?.(w); },
          onPick: (id) => { this.fSel = id; },
          deck: () => this.openFileDeck(this.fileOrder.includes(this.fSel) ? this.fSel : this.fileOrder[0]),
        });
      },
      fileListRows() {
        const esc = window.esc;
        let out = '';
        for (const g of this.branchGroups) {
          out += '<div class="sticky top-0 z-10 truncate border-b border-base-200 bg-base-200 px-3 py-1 text-xs font-medium text-base-content/60">'
            + esc(g.repo + (g.branch ? ' \u00b7 ' + (window.AssistantMark?.shortBranch?.(g.branch) || g.branch) : '')) + '</div>';
          for (const row of g.files) {
            const f = this.fileInfo(row.path), d = f.diff;
            // The change leads: a file its branch changed is marked changed,
            // whatever tool the session reached it with.
            const icon = f.scratch ? 'ph-archive text-base-content/40' : d ? 'ph-pencil-simple text-primary'
              : f.wrote ? 'ph-pencil-simple text-base-content/40' : 'ph-eye text-base-content/40';
            const cut = f.rel.lastIndexOf('/');
            out += '<div data-file="' + esc(row.path) + '" role="option" tabindex="-1" class="flex cursor-pointer items-center gap-2 border-b border-base-200 px-3 py-1.5 last:border-0 hover:bg-base-200/60 aria-selected:bg-primary/10">'
              + '<i class="ph ' + icon + ' shrink-0 text-base"></i>'
              + '<span class="flex min-w-0 flex-1 overflow-hidden font-mono text-sm">'
              + (cut >= 0 ? '<span class="min-w-0 truncate text-base-content/45">' + esc(f.rel.slice(0, cut + 1)) + '</span>' : '')
              + '<span class="max-w-full shrink-0 truncate">' + esc(f.rel.slice(cut + 1)) + '</span></span>'
              + (!d ? '' : Number.isFinite(d.additions)
                ? '<span class="shrink-0 font-mono text-xs tabular-nums"><span class="text-success">+' + d.additions + '</span> <span class="text-error">\u2212' + (d.deletions || 0) + '</span></span>'
                : '<span class="shrink-0 font-mono text-xs text-base-content/50">' + esc(d.status || 'changed') + '</span>')
              + '</div>';
          }
        }
        return out;
      },
      // A changed file: the branch page's card, on its diff. Anything else:
      // what the session did to it, and why there is no change to show.
      fileBody(path, el) {
        const f = this.fileInfo(path), d = f.diff;
        if (d) {
          const key = '__sessionFile_' + (FILE_SEQ++);
          window[key] = { repo: d.slug, ref: d.branch, base: d.base, baseName: 'main', path: d.path, prevPath: d.previousPath,
                          status: d.status, additions: d.additions, deletions: d.deletions, patch: d.patch, open: true, bare: true };
          const w = document.createElement('div');
          w.setAttribute('x-data', 'fileReview(window.' + key + ')');
          w.setAttribute('data-file-review', '');
          el.replaceChildren(w);
          window.Alpine.initTree(w);
          return;
        }
        const kinds = Object.entries((this.record?.files || {})[path] || {}).filter(([, n]) => +n > 0)
          .map(([k, n]) => this.plural(+n, k.toLowerCase())).join(', ');
        const why = f.scratch ? 'Kept in a scratchpad, which no branch holds.'
          : this.diffsState !== 'read' ? 'Reading its branch\'s change.'
          : f.wrote ? 'Changed by the session and not in its branch\'s change against main.'
          : 'Read, not changed.';
        const href = this.fileHref(path);
        const esc = window.esc;
        el.innerHTML = '<div class="flex flex-col gap-2 py-2" data-file-note>'
          + '<p class="flex items-center gap-2 text-base text-base-content/70"><i class="ph ' + (f.scratch ? 'ph-archive' : f.wrote ? 'ph-pencil-simple' : 'ph-eye') + ' text-lg text-base-content/45"></i>'
          + esc(why) + '</p>'
          + (kinds ? '<p class="font-mono text-sm text-base-content/55">' + esc(kinds) + '</p>' : '')
          + (href ? '<a class="link text-sm" target="_blank" rel="noopener" href="' + esc(href) + '">The file on GitHub</a>' : '')
          + '</div>';
      },
      // Full screen: the changed files of the selected file's branch, as the
      // branch page reads them (kits/file-deck.js), at that file.
      async openFileDeck(path) {
        const d = this.fileInfo(path || '').diff;
        if (!d) return;
        if (!window.fileDeck && window.gh?.load) await window.gh.load('kits/file-deck.js').catch(() => {});
        if (!window.fileDeck) return;
        const files = [...(this._diffs || new Map()).values()].filter((x) => x.slug === d.slug && x.branch === d.branch);
        window.fileDeck.open({ repo: d.slug, ref: d.branch, base: d.base, baseName: 'main', files,
                               start: Math.max(0, files.indexOf(d)), title: d.slug.split('/').pop() + ' \u00b7 ' + d.branch,
                               parent: window.swipeDeck?.top?.() || undefined });
      },

      // ── The Calls tab: a list over a strip of cards ──────────────────────
      // GROUPED BY TOPIC (owner, 2026-11-21: the owner cycles through sessions
      // and often does not remember what one was about, and the topics are at
      // a level the owner can grasp): the topics in the order the session
      // reached them, then the calls whose topic is not known yet. Within a
      // topic, the calls that wait on the owner before the settled ones
      // (callSettled), documentation calls first, then the order the calls
      // were read in, so the list and the strip agree on one order. A session
      // Gemini has not read keeps the two kinds apart instead.
      get callOrder() {
        const agenda = this.gist.agenda, doc = (c) => (c.kind === 'documentation' ? 0 : 1);
        const done = (c) => (c.status === 'closed' || !!this.callSettled[c.id] ? 1 : 0);
        const placed = this.callsPlaced, rank = new Map();
        for (const s of placed ? agenda : []) { const k = s.topic.toLowerCase(); if (!rank.has(k)) rank.set(k, rank.size); }
        const at = (c) => (placed ? rank.get(this.callOrigin(c, agenda).key) ?? rank.size : doc(c));
        return this.calls.map((c, i) => ({ c, i, t: at(c) }))
          .sort((a, b) => a.t - b.t || done(a.c) - done(b.c) || doc(a.c) - doc(b.c) || a.i - b.i)
          .map((x) => x.c);
      },
      // ── WHERE A CALL CAME FROM: its turn, and that turn's topic ───────────
      // Derived, never authored. The turn is the last prompt sent at or
      // before the call's `created`, and Gemini's agenda names the topic of
      // every turn it read, numbered as the record's prompts are from schema
      // 8 (gemini.aligned); an older record goes by the topics file's own
      // turn instants. A call filed after the record's end may belong to a
      // turn the record has not caught, so it has no turn yet; one in a turn
      // the agenda has not reached has no topic yet. A worker's call counts
      // in the turn it was filed in, which is the turn that launched it
      // unless the worker ran past the owner's next prompt.
      get callClock() {
        const r = this.record, prompts = Array.isArray(r?.prompts) ? r.prompts : [];
        if (prompts.length && ((r.schema || 1) >= 8 || Array.isArray(r.injected)))
          return { times: turnTimes(prompts), end: Date.parse(r.ended || '') };
        const turns = this.topics?.turns;
        return Array.isArray(turns) && turns.length && turns.every((x) => x?.at)
          ? { times: turnTimes(turns), end: Date.parse(this.topics.source_ended || '') } : null;
      },
      // Whether the calls can be placed at all: an agenda, and turn instants
      // in its numbering. Without both the list keeps the two kinds apart.
      get callsPlaced() { return this.gist.agenda.length > 0 && !!this.callClock; },
      callTurn(c) {
        const t = Date.parse(c?.created || ''), k = this.callClock;
        if (!Number.isFinite(t) || !k) return -1;
        let i = -1;
        k.times.forEach((x, j) => { if (x <= t) i = j; });
        return i === k.times.length - 1 && t > k.end ? -1 : i;
      },
      callOrigin(c, agenda = this.gist.agenda) {
        const turn = this.callTurn(c);
        const s = turn >= 0 ? agenda.find((x) => x.start <= turn && turn <= x.end) : null;
        return { turn, topic: s?.topic || '', key: (s?.topic || '').toLowerCase() };
      },
      callDay(c) {
        const d = new Date(c?.created || '');
        return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      },
      // A topic's mark, as the Overview draws it: how its last stretch ended.
      topicGlyph(key) {
        const t = this.gist.list.find((x) => x.topic.toLowerCase() === key);
        return t?.state?.glyph || '·';
      },
      // The Overview, at a topic's line, lit for a moment (rule 16).
      goOverviewTopic(k) {
        if (!k) return;
        this.show('overview');
        this.topicLit = k;
        clearTimeout(this._topicLitT);
        this._topicLitT = setTimeout(() => { if (this.topicLit === k) this.topicLit = ''; }, 2600);
        this.$nextTick(() => this.$refs.topics?.querySelector('[data-topic="' + attrQuote(k) + '"]')?.scrollIntoView({ block: 'nearest' }));
      },
      // Gemini's headline for a prompt (record.prompts[i]), as Turns titles
      // the exchange that answers it.
      promptHeadline(i) {
        const k = i >= 0 ? this.cardOfPrompt(i) : -1;
        if (k >= 0) return this.turnTitle(k);
        const x = (this.topics?.turns || []).find((u) => u?.turn === i);
        return x?.headline || x?.summary || '';
      },
      // ── A TOPIC'S PANEL, from its heading in the Calls tab's list ─────────
      // The panel-tip the session page's facts use (factTip), opened by a tap
      // on the heading, and where the pointer can hover, by hovering it; in a
      // wide pane it opens beside the list, over the cards, so the rows under
      // the heading stay in view.
      callHead(ev) { return ev.target?.closest?.('[data-call-topic]') || null; },
      callHeadTap(ev) {
        const h = this.callHead(ev);
        if (h) this.toggleFactTip('topic', h, { topic: h.dataset.callTopic, beside: this.$refs.callList });
      },
      callHeadOver(ev) {
        const h = this.callHead(ev);
        if (h && !h.contains(ev.relatedTarget)) this.hoverFactTip('topic', h, { topic: h.dataset.callTopic, beside: this.$refs.callList });
      },
      callHeadOut(ev) {
        const h = this.callHead(ev);
        if (h && !h.contains(ev.relatedTarget)) this.leaveFactTip();
      },
      // A tap in the topic panel, acted on from the panel's own element,
      // which stays in the page: closing the panel removes the button that
      // was tapped, and a magic read off a detached element ($root, $refs)
      // finds nothing, so the tab it opens would mount against nothing.
      topicPanelGo(ev) {
        const b = ev.target?.closest?.('[data-topic-turn], [data-topic-overview]');
        if (!b || this.factTip?.kind !== 'topic') return;
        const k = this.factTip.topic;
        this.closeFactTip();
        if (b.hasAttribute('data-topic-overview')) this.goOverviewTopic(k);
        else this.goTurn(+b.dataset.topicTurn);
      },
      // What decided a topic's status (RepoSessionsCache.topicStatuses): a
      // correction says who made it and when, the model is Gemini's reading,
      // and the record's own rows give their evidence, a closing line or the
      // pull requests, as the record wrote it.
      statusBasis(st) {
        if (!st) return '';
        if (st.basis === 'model') return "Gemini's reading";
        if (st.basis !== 'correction') return String(st.evidence || '').replace(/\*\*/g, '').trim();
        const m = /^(\S+)(?:\s+at\s+(\S+))?/.exec(st.evidence || ''), by = m?.[1] || '';
        const who = by === 'owner' ? 'you' : by === 'tend' ? 'a tend pass'
          : by === 'claude:' + this.shortId ? 'this session' : by.startsWith('claude:') ? 'session ' + by.slice(7) : by;
        const d = new Date(m?.[2] || '');
        return 'Corrected by ' + (who || 'a correction') + (isNaN(d) ? '' : ', ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      },
      // The panel's content for the topic factTip names: the topic as the
      // Overview lists it (gist.list), its status in the words the Sessions
      // view uses, and a row per turn it spans, the first three and the last
      // three past six, each with Gemini's headline.
      get topicPanel() {
        const k = this.factTip?.kind === 'topic' ? this.factTip.topic : '';
        const t = k ? this.gist.list.find((x) => x.topic.toLowerCase() === k) : null;
        if (!t) return null;
        const st = t.status;
        const status = !st ? '' : st.status === 'done' ? 'Done' : st.status === 'dropped' ? 'Dropped'
          : window.RepoSessionsCache?.statusNote?.(st) || 'Open';
        const turns = t.spans.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, j) => a + j));
        const pick = turns.length <= 6 ? turns : [...turns.slice(0, 3), null, ...turns.slice(-3)];
        let prev = null;
        const rows = pick.map((i) => {
          if (i === null) { prev = null; return { key: 'more', more: turns.length - 6 }; }
          const r = { key: i, i, n: i + 1, text: this.promptHeadline(i) || 'Turn ' + (i + 1), gap: prev !== null && i !== prev + 1 };
          prev = i;
          return r;
        });
        const kind = { new: 'New work', improve: 'Improvement', fix: 'A fix', explore: 'Investigation' }[t.kind];
        const spans = t.spans.map(([a, b]) => (a === b ? String(a + 1) : (a + 1) + '\u2013' + (b + 1))).join(', ');
        return {
          t, key: k, topic: t.topic, glyph: t.state?.glyph || '\u00b7', dropped: st?.status === 'dropped',
          status, mark: this.topicMark(t), owner: st?.waits_on === 'owner', basis: status ? this.statusBasis(st) : '',
          meta: [kind, t.area, this.plural(t.turns, 'turn') + (spans ? ': ' + spans : '')].filter(Boolean).join(' \u00b7 '),
          rows,
        };
      },
      // A topic's calls, for its line on the Overview: how many, how many
      // still wait on the owner, and the one the Calls tab opens at.
      topicCalls(t) {
        const k = t.topic.toLowerCase(), agenda = this.gist.agenda;
        const mine = this.callOrder.filter((c) => this.callOrigin(c, agenda).key === k);
        const open = mine.filter((c) => this.callWaits(c)).length;
        const tip = !mine.length ? '' : open
          ? this.plural(open, 'call') + ' waiting on you, of ' + mine.length + ' filed in this topic'
          : this.plural(mine.length, 'call') + ' filed in this topic, none waiting';
        return { n: mine.length, open, first: mine.find((c) => this.callWaits(c)) || mine[0] || null, tip };
      },
      // The Calls tab at a topic: its first waiting call selected, and its
      // heading at the top of the list.
      goTopicCalls(t) {
        const c = this.topicCalls(t).first;
        if (!c) return;
        this.cSel = c.id;
        this._callGroupAt = t.topic.toLowerCase();
        if (this.pane === 'calls') { this._callSwiper?.show(c.id); this.relistCalls(); }
        else this.show('calls');
      },
      // After the rows are drawn: the heading goTopicCalls asked for, at the
      // list's top, the rows under it in view (rule 14).
      // Measured from the group's first row, since a heading the list has
      // scrolled past is stuck at the top and reads as already there.
      scrollCallGroup() {
        const k = this._callGroupAt, list = this.$refs.callList;
        if (!k || !list) return;
        this._callGroupAt = '';
        const h = list.querySelector('[data-call-group="' + attrQuote(k) + '"]'), row = h?.nextElementSibling;
        if (row) list.scrollTop += row.getBoundingClientRect().top - list.getBoundingClientRect().top - h.offsetHeight;
      },
      callById(id) { return this.calls.find((c) => c.id === id) || null; },
      // What a card's head names: the call's own name, else for a document its
      // last two path segments, else its question. The kind is the icon's to
      // say (snag swipe-deck-generic-header), on the card's first line.
      callTitle(c) {
        if (!c) return '';
        const file = c.kind === 'documentation' && String(c.file || '').split(':').pop();
        return c.name || (file ? file.split('/').slice(-2).join('/') : '') || c.question || this.callKindLabel(c);
      },
      callIndex(id) { return this.calls.findIndex((c) => c.id === id); },
      // Attached on the first visit, and remounted only when the set of calls
      // changes; a call's state moving redraws its row (relistCalls), and its
      // card follows by itself, being Alpine markup.
      async mountCalls() {
        const root = this.$refs.callRoot, list = this.$refs.callList, card = this.$refs.callCard;
        if (!root || !list || !card || !this.calls.length) return;
        if (!window.linkedSwiper && window.gh?.load) await window.gh.load('kits/linked-swiper.js').catch(() => {});
        if (!window.linkedSwiper) return;
        if (this.calls.some((c) => c.kind === 'documentation') && !window.UserCallForm && window.gh?.load)
          await window.gh.load('alpineComponents/user-call-form.js').catch(() => {});
        const keys = this.callOrder.map((c) => c.id).join('\n');
        if (this._callSwiper && keys === this._callKeys) return this.relistCalls();
        this._callKeys = keys;
        list.innerHTML = this.callRows();
        if (this._callSwiper) { this._callSwiper.mount(); this.markCallGroup(); this.scrollCallGroup(); return; }
        // A card owns its scrolling (slideScroll false): the call form holds
        // its document in a pane of its own, under a head that stays.
        this._callSwiper = window.linkedSwiper.attach({
          // The list is wider than the kit's 340px, since a row is a path.
          root, list, card, key: 'call', noun: 'call', listMax: 'max-h-[30vh]', wide: 'grid-cols-[minmax(0,400px)_minmax(0,1fr)]',
          slideScroll: false, innerClass: 'h-full w-full min-w-0',
          ids: () => this.callOrder.map((c) => c.id),
          sel: () => this.cSel || (this.callOrder.find((c) => this.callWaits(c)) || this.callOrder[0])?.id,
          name: (id) => ({ title: this.callTitle(this.callById(id)) }),
          // The origin line, then the call: its form for a documentation
          // call, else the card as filed (CALL_CARD).
          body: (id, el) => {
            const c = this.callById(id);
            const w = document.createElement('div'), inner = document.createElement('div');
            w.className = 'flex h-full min-h-0 flex-col';
            w.setAttribute('x-data', '{ c: callById(' + JSON.stringify(id) + ') }');
            w.innerHTML = CALL_ORIGIN;
            if (c?.kind === 'documentation') this.callForm(c, inner);
            else {
              inner.className = 'min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3.5 py-3';
              inner.innerHTML = CALL_CARD;
            }
            w.append(inner);
            el.replaceChildren(w);
            window.Alpine.initTree(w);
          },
          release: (i, el) => {
            for (const w of el.children) {
              for (const f of w.querySelectorAll('[data-call-form]')) delete window[f.dataset.callForm];
              window.Alpine?.destroyTree?.(w);
            }
          },
          onPick: (id) => { this.cSel = id; this.markCallGroup(); },
          deck: () => this.openCalls(this.callIndex(this._callSel())),
        });
        this.markCallGroup();
        this.scrollCallGroup();
      },
      // A DOCUMENTATION CALL'S CARD IS ITS FORM (owner, 2026-11-21: "The lower
      // container should show the diff doc in its container"): the document
      // with each edit drawn inline, decided, noted and recorded there, as on
      // the call's own page. Hosted, as in the deck, so the form leaves the
      // call's name to the card's head and does not repeat its question.
      callForm(c, w) {
        const key = '__callCard_' + (FILE_SEQ++);
        window[key] = { call: c, repo: c._repo, ref: c._ref, path: c._path, onHead: () => {}, listed: true,
                        onAnswer: (entry) => {
                          this.callAnswers = { ...this.callAnswers, [c.id]: [...(this.callAnswers[c.id] || []), entry] };
                          this.relistCalls();
                        } };
        // The origin line above it stands in for the card's top padding.
        // The card's foot is the window's bottom-right corner, where the fab
        // floats, so Record stands clear of it. On a phone the card gives the
        // form's list of edits to the document: the document's own controls
        // step through the edits, and the deck behind the door lists them.
        // The seam's display is important, since dock-split's unlayered
        // stylesheet outranks a utility (snag an-unlayered-rule-beats-every-layer).
        w.className = 'min-h-0 flex-1 [&_[data-call-card]]:pt-0 [&_[data-doc-send]]:mr-14 max-sm:[&_[data-doc-list]]:hidden max-sm:[&_[data-doc-seam]]:hidden!';
        w.dataset.callForm = key;
        w.setAttribute('x-data', 'userCallForm(window.' + key + ')');
      },
      _callSel() { return this.cSel || (this.callOrder.find((c) => this.callWaits(c)) || this.callOrder[0])?.id || ''; },
      // A row is the call's question, or for a documentation call its
      // document and a pill counting its edits (owner, 2026-11-21: "The top
      // list should not have the redundant boilerplate language"): the repo,
      // then the path as the Files tab writes one, its folder giving way
      // first. A call that waits is the row at full strength; one answered or
      // closed is drawn pale, with a check at the row's end (owner,
      // 2026-11-21: elegant, not a big pill), in a slot every row keeps so
      // the pills stay in one column (html-style rules 9 and 15).
      // A heading for each topic, with the mark the Overview gives it, which
      // opens the topic's panel (topicPanel); or, for a session Gemini has
      // not read, a heading for each kind.
      callRows() {
        const esc = window.esc, agenda = this.gist.agenda;
        let group = null, out = '';
        for (const c of this.callOrder) {
          const doc = c.kind === 'documentation', waits = this.callWaits(c);
          const o = this.callsPlaced ? this.callOrigin(c, agenda) : null;
          const g = !o ? (doc ? 'documentation' : 'other') : o.key;
          if (g !== group) {
            group = g;
            const name = !o ? (doc ? 'Documentation' : 'Other calls') : o.topic || "After Gemini's reading";
            const head = 'sticky top-0 z-10 flex w-full items-baseline gap-2 border-b border-base-200 bg-base-200 px-3 py-1 text-left text-sm [&[aria-current]]:text-primary';
            out += o?.topic
              ? '<button type="button" class="' + head + ' font-medium text-base-content/80 hover:bg-base-300" data-call-group="' + esc(g) + '"'
                + ' data-call-topic="' + esc(g) + '" aria-haspopup="dialog">'
                + '<span class="w-4 shrink-0 text-center">' + esc(this.topicGlyph(o.key)) + '</span>'
                + '<span class="min-w-0 truncate">' + esc(name) + '</span>'
                + '<i class="ph ph-info ml-auto shrink-0 self-center font-normal text-base-content/45"></i></button>'
              : '<div class="' + head + ' text-base-content/55" data-call-group="' + esc(g) + '">'
                + '<span class="min-w-0 truncate">' + esc(name) + '</span></div>';
          }
          const f = doc ? window.RepoAddress?.parse?.(String(c.file || '')) : null;
          const n = (c.edits || []).length, count = c.new ? 'New' : n === 1 ? '1 edit' : n + ' edits';
          const pale = waits ? '' : ' opacity-50', top = f?.path ? '' : ' mt-0.5';
          let label, pill = '';
          if (f?.path) {
            const cut = f.path.lastIndexOf('/');
            label = '<span class="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden' + pale + '">'
              + '<span class="shrink-0 font-mono text-xs text-base-content/60">' + esc(f.repo.split('/').pop()) + '</span>'
              + '<span class="flex min-w-0 overflow-hidden font-mono text-sm">'
              + (cut >= 0 ? '<span class="min-w-0 truncate text-base-content/45">' + esc(f.path.slice(0, cut + 1)) + '</span>' : '')
              + '<span class="max-w-full shrink-0 truncate">' + esc(f.path.slice(cut + 1)) + '</span></span></span>';
            pill = c.new || n ? '<span class="badge badge-sm shrink-0 font-mono tabular-nums ' + (c.new ? 'badge-success' : 'badge-ghost') + pale + '"'
                + ' data-call-count data-title-tip="' + esc(count) + '" aria-label="' + esc(count) + '">' + (c.new ? 'New' : n) + '</span>' : '';
          } else {
            label = '<span class="min-w-0 flex-1 line-clamp-2 text-sm' + pale + '">' + esc(c.question || c.name || '') + '</span>';
          }
          out += '<div data-call="' + esc(c.id) + '" role="option" tabindex="-1" class="flex cursor-pointer ' + (f?.path ? 'items-center' : 'items-start') + ' gap-2 border-b border-base-200 px-3 py-1.5 last:border-0 hover:bg-base-200/60 aria-selected:bg-primary/10">'
            + '<i class="ph ' + this.callKindIcon(c) + top + pale + ' shrink-0 text-base text-base-content/50"></i>'
            + label + pill
            + (waits ? '<span class="w-4 shrink-0"></span>'
              : '<span class="flex w-4 shrink-0 justify-center' + top + '" role="img" aria-label="' + esc(this.callState(c)) + '" data-call-state'
                + ' data-title-tip="' + esc(this.callState(c)) + '">'
                + '<i class="ph ph-check text-base text-base-content/60"></i></span>')
            + '</div>';
        }
        return out;
      },
      // The rows drawn again, as a call's state changes; when the order moved
      // (the answers read, or the topics), the strip is rebuilt with them.
      relistCalls() {
        const list = this.$refs.callList;
        if (!this._callSwiper || !list) return;
        if (this.callOrder.map((c) => c.id).join('\n') !== this._callKeys) return this.mountCalls();
        list.innerHTML = this.callRows();
        window.linkedSwiper.mark(list, 'call', this._callSel());
        this.markCallGroup();
        this.scrollCallGroup();
      },
      // The selected call's heading is marked with its row (rule 16).
      markCallGroup() {
        const list = this.$refs.callList, row = list?.querySelector('[data-call="' + attrQuote(this._callSel()) + '"]');
        let h = row?.previousElementSibling;
        while (h && !h.hasAttribute('data-call-group')) h = h.previousElementSibling;
        for (const x of list?.querySelectorAll('[data-call-group]') || []) x.toggleAttribute('aria-current', x === h);
      },
      // Whether a call still waits on the owner: not closed, and not answered.
      callWaits(c) { return c.status !== 'closed' && !this.callDone(c); },
      // The session's calls as a deck over the page, one userCallForm per slide.
      openCalls(start = 0) {
        // DOCUMENTATION CALLS ARE NOT MIXED WITH THE OTHER KINDS (owner,
        // 2026-11-07): a deck opened on one holds the session's documentation
        // calls, a document per slide, and a deck opened on any other kind
        // holds the rest. A call already answered or closed waits on no one,
        // so it is left out unless it is the one opened: on 2026-11-09 a deck
        // of nine slides held four closed calls.
        const all = this.calls, doc = all[start]?.kind === 'documentation';
        const list = all.filter((c) => (c.kind === 'documentation') === doc && (c === all[start] || this.callWaits(c)));
        start = Math.max(0, list.indexOf(all[start]));
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

      // ── The Views tab: a list over a strip of cards ──────────────────────
      // kits/linked-swiper.js lays the two out, keeps them in step, steps the
      // list with Up and Down and the strip with Left and Right, and draws a
      // card only in view or beside it. Attached on the first visit, and
      // remounted only when the views change, since a remount reloads every
      // frame it holds.
      async mountViews() {
        const root = this.$refs.viewRoot, list = this.$refs.viewList, card = this.$refs.viewCard;
        const views = this.work.views;
        if (!root || !list || !card || !views.length) return;
        if (!window.linkedSwiper && window.gh?.load) await window.gh.load('kits/linked-swiper.js').catch(() => {});
        if (!window.linkedSwiper) return;
        const keys = views.map((v) => v.key).join('\n');
        if (this._viewSwiper && keys === this._viewKeys) return;
        this._viewKeys = keys;
        this.vAt = Math.min(this.vAt, views.length - 1);
        list.innerHTML = this.viewRows();
        if (this._viewSwiper) this._viewSwiper.mount();
        else this._viewSwiper = window.linkedSwiper.attach({
          root, list, card, key: 'view', noun: 'view',
          ids: () => this.work.views.map((v) => v.key),
          sel: () => this.work.views[this.vAt]?.key,
          head: ({ i, n, tight }) => this.viewHead(i, n, tight),
          body: (id, el) => this.viewBody(id, el),
          // A page's frame fills the card; a document scrolls in it.
          innerClass: 'h-full w-full', slidePad: 'p-0',
          onPick: (id) => {
            const i = this.work.views.findIndex((v) => v.key === id);
            if (i >= 0) this.vAt = i;
          },
          deck: () => this.openViews(this.vAt),
        });
        this.fillMarkdown();
      },
      // The last two segments of a path: a name alone reads the same for two
      // README.md files in different folders.
      viewTail(path) { return String(path || '').split('/').slice(-2).join('/'); },
      viewRows() {
        const esc = window.esc;
        let group = '', out = '';
        for (const v of this.work.views) {
          const g = v.slug + '@' + v.branch;
          if (g !== group) {
            group = g;
            out += '<div class="sticky top-0 z-10 truncate border-b border-base-200 bg-base-200 px-3 py-1 text-xs font-medium text-base-content/60">'
              + esc(v.repoShort + ' \u00b7 ' + v.short) + '</div>';
          }
          const tail = this.viewTail(v.path), cut = tail.lastIndexOf('/');
          out += '<div data-view="' + esc(v.key) + '" role="option" tabindex="-1" class="flex cursor-pointer items-center gap-2 border-b border-base-200 px-3 py-1.5 last:border-0 hover:bg-base-200/60 aria-selected:bg-primary/10">'
            + '<i class="ph ' + (v.kind === 'md' ? 'ph-file-md' : 'ph-file-html') + ' shrink-0 text-base text-base-content/50"></i>'
            + '<span class="min-w-0 flex-1 truncate text-sm">'
            + (cut >= 0 ? '<span class="text-base-content/50">' + esc(tail.slice(0, cut + 1)) + '</span>' : '')
            + esc(tail.slice(cut + 1)) + '</span>'
            + (v.ago ? '<span class="shrink-0 font-mono text-xs text-base-content/45">' + esc(v.ago) + '</span>' : '')
            + '</div>';
        }
        return out;
      },
      // The card's head: the kit's (the file, its pager, the door to the full
      // screen), then the file on GitHub and, for a page, the page on its own.
      viewHead(i, n, tight) {
        const v = this.work.views[i], esc = window.esc;
        if (!v || !window.linkedSwiper) return '';
        const link = (href, icon, tip) => '<a href="' + esc(href) + '" target="_blank" rel="noopener" class="btn btn-xs btn-ghost btn-square"'
          + ' data-title-tip="' + esc(tip) + '" aria-label="' + esc(tip) + '"><i class="ph ' + icon + ' text-base"></i></a>';
        return window.linkedSwiper.head({ code: v.repoShort, title: this.viewTail(v.path) }, i, n, 'view', { deck: true, tight })
          + link(this.viewGh(v), 'ph-github-logo', 'On GitHub')
          + (v.kind === 'html' ? link(v.url, 'ph-arrow-square-out', 'Open the page in a new tab') : '');
      },
      viewBody(id, el) {
        const v = this.work.views.find((x) => x.key === id);
        if (!v) return '';
        if (v.kind === 'html') {
          const f = document.createElement('iframe');
          f.src = v.url;
          f.className = 'block h-full w-full border-0 bg-base-100';
          f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
          f.setAttribute('aria-label', v.path);
          el.replaceChildren(f);
          return;
        }
        const d = document.createElement('div');
        d.className = 'h-full overflow-y-auto overflow-x-hidden [overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap px-4 py-3 text-base leading-7 [&_h1]:text-xl [&_h1]:font-semibold'
          + ' [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h3]:font-semibold [&_p]:my-2'
          + ' [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:link [&_code]:font-mono [&_code]:text-sm [&_table]:text-sm';
        d.setAttribute('data-md', v.key);
        d.innerHTML = v.html || '<span class="loading loading-dots loading-sm opacity-40"></span>';
        el.replaceChildren(d);
      },
      // Where the full-screen deck was left, the list and the strip go.
      goView(i) {
        const v = this.work.views[i];
        if (!v) return;
        this.vAt = i;
        this._viewSwiper?.show(v.key);
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
                                                   except: ['[data-fact-btn]', '[data-call-topic]'], stale: false });
        const gone = () => { if (this.factTip) this.closeFactTip(); };
        window.addEventListener('scroll', gone, { passive: true });
        window.addEventListener('resize', gone);
      },
      // `o.topic` names a topic for the topic panel, and `o.beside` an element
      // to open beside rather than under, where the window leaves room on
      // its right (the Calls tab's list in a wide pane).
      showFactTip(kind, el, pinned, o = {}) {
        const r = el.getBoundingClientRect();
        // The summaries are one line each, so their panel takes the width.
        const w = Math.min(kind === 'gemini' ? 560 : kind === 'topic' ? 520 : 380, innerWidth - 16);
        const side = o.beside?.getBoundingClientRect();
        this.factTipClose = window.PanelTip ? window.PanelTip.closeHTML(pinned) : '';
        if (side && side.width < innerWidth * 0.6 && side.right + 8 + w <= innerWidth - 8) {
          const y = Math.max(8, r.top - 4);
          this.factTip = { kind, pinned, w, x: side.right + 8, y, mh: innerHeight - y - 14, topic: o.topic || '' };
          this.$nextTick(() => {
            const t = this.$refs.factTip, h = t?.offsetHeight || 0;
            if (this.factTip && y + h > innerHeight - 8) Object.assign(this.factTip, { y: Math.max(8, innerHeight - 8 - h), mh: innerHeight - 22 });
          });
          return;
        }
        // CAPPED TO THE ROOM ON SCREEN, not to a share of it: the checkouts
        // panel of a session that pushed twenty branches is taller than any
        // phone, and a 60vh cap opened low on the page still ran past the
        // bottom edge. Below the glyph where it fits, else on the roomier side.
        const below = innerHeight - r.bottom - 14, above = r.top - 14;
        this.factTip = { kind, pinned, w, x: Math.max(8, Math.min(r.left - 12, innerWidth - w - 8)), y: r.bottom + 6,
                         mh: Math.max(below, above), topic: o.topic || '' };
        this.$nextTick(() => {
          const t = this.$refs.factTip;
          if (!t || !this.factTip) return;
          const h = t.offsetHeight;
          if (h > below && above > below) this.factTip.y = Math.max(8, r.top - 6 - h);
        });
      },
      async toggleFactTip(kind, el, o = {}) {
        clearTimeout(this._factTimer);
        await this.wireFactTip();
        const f = this.factTip;
        if (f && f.kind === kind && f.pinned && f.topic === (o.topic || '')) return this.closeFactTip();
        this.showFactTip(kind, el, true, o);
      },
      hoverFactTip(kind, el, o = {}) {
        if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        if (this.factTip?.pinned) return;
        clearTimeout(this._factTimer);
        this._factTimer = setTimeout(async () => { await this.wireFactTip(); this.showFactTip(kind, el, false, o); }, 140);
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

      // ── What the FAB says this view is about ───────────────────────────────
      // docs/APP.md's `about`, read live by fab.js (pageAbout) for its About
      // tab and its notes. The subject is this session's record and the
      // selection is the view on screen in the Views tab, both as notes-store
      // locators (skills/notes): owner/repo:path and owner/repo@branch:path.
      get recordAbout() {
        return this.path ? (this.repo || STORE) + ':' + this.path : 'session:' + (this.shortId || '');
      },
      // The session's name: the host's label (the Sessions pane supplies the
      // sidebar export's title), else the title in Gemini's topics file, else
      // the opening ask the head shows, else the id.
      get sessionName() {
        return this.facts?.title || this.topics?.title || this.head.title || 'Session ' + this.shortId;
      },
      get about() {
        if (!this.shortId) return null;
        const v = this.pane === 'views' ? this.work.views[this.vAt] : null;
        return {
          title: this.sessionName,
          sources: this.path ? [{ path: this.path, repo: this.repo || STORE, ref: 'main', role: 'record',
            href: this.recordUrl, open: () => this.show('record') }] : [],
          subject: { about: this.recordAbout, label: this.sessionName },
          selection: v ? { about: v.slug + '@' + v.branch + ':' + v.path, label: v.name + ' · ' + v.repoShort } : null,
        };
      },

      // ── The scope's marks ──────────────────────────────────────────────────
      // Each repository's mark, from the app's estate list when this is
      // mounted inside the app (no manifest read), else from the repository's
      // own .web-tools.json, one memoized read per repository (RepoMark.of).
      // A repository with no glyph declared and no drawn mark is counted on
      // the pill and draws the neutral glyph in the panel. `read` false takes
      // the estate's answer and reads no manifest, which is all a mount may do
      // before its record lands. The mark's SVG, the manifest's own or the
      // hub's drawn one, is read in either case: the list names no file.
      loadMarks(read = true) {
        const owner = String(this.repo || STORE).split('/')[0];
        const M = window.RepoMark;
        if (!M) return;
        const put = (n, v) => { this.marks = { ...this.marks, [n]: v }; };
        for (const n of this.scopeRepos) {
          if (n in this.marks) continue;
          const known = estateMark(owner + '/' + n);
          if (known) {
            put(n, known);
            if (known.mark) M.load(known).then((s) => put(n, s));
            continue;
          }
          if (!read) continue;
          // null while the read is out, and the slot holds its width blank
          // rather than flashing the neutral glyph before the declared one.
          put(n, null);
          M.of(owner + '/' + n).then((s) => put(n, s || ''));
        }
      },
      // A scope repository's mark as markup. One that declares none draws the
      // neutral glyph, which only the checkouts panel reaches: the pill counts
      // those instead (scopeMarked).
      markHtml(n, o) { return window.RepoMark?.html(this.marks[n] || null, o) || ''; },
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
        const order = views, host = this;
        let h = null;
        h = window.swipeDeck.open({
          count: order.length, start,
          innerClass: 'h-full w-full min-w-0',
          // The contents list by repo and branch, newest first within each:
          // a section heading per repo, each row the file with its folder.
          index: (i) => ({ title: host.viewTail(order[i].path), subtitle: order[i].ago || '',
                           icon: order[i].kind === 'md' ? 'ph-file-text' : 'ph-browser',
                           section: order[i].repoShort + ' · ' + order[i].short, group: order[i].slug + '@' + order[i].branch }),
          icon: order[start].icon,
          title: this.viewTail(order[start].path),
          subtitle: order[start].repoShort + ' · ' + order[start].short,
          onSlide: (i) => {
            if (!h) return;
            const v = order[i];
            h.setTitle?.(host.viewTail(v.path)); h.setSubtitle?.(v.repoShort + ' · ' + v.short); h.setIcon?.(v.icon);
            // Closing returns to the list at the view last read (rule 11).
            if (list === host.work.views) host.goView(i);
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
        if (typeof o.onMeta === 'function') {
          try {
            o.onMeta({ title: this.head.title, agent: this.agentUrl, cards: this.cards,
                       path: this.path });
          } catch { /* a host that throws on meta is not this view's problem */ }
        }
        this.$nextTick(async () => {
          this.runFind(false, true);
          if (Number.isInteger(o.start)) { this.tSel = String(o.start); this.openDeck(o.start); }
          // A turn named by number (turn.html's ✕ and Session link): its
          // card in the Turns tab, selected and not opened full screen.
          else if (Number.isInteger(o.turn) && o.turn >= 1) this.tSel = String(o.turn - 1);
          if (this.measured) this.mountCost();
          if (this.pane === 'record') return this.openRecord();
          await Promise.race([topicsRead, new Promise(r => setTimeout(r, TOPICS_WAIT_MS))]);
          this.mountOutline();
          if (this.pane === 'turns') this.mountTurns();
          if (this.pane === 'files') this.mountFiles();
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
          // The Calls tab is a lent slide's only way to a session's calls;
          // otherwise loadWork reads them beside the action message.
          if (!this.lent) this.loadWork(); else this.loadCalls();
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
        // The compact reader's alone since Turns took the outline in.
        if (!this.compact) return;
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
            { onOpen: (i) => this.openDeck(i),
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
      // second read. The list's scroll is kept, so a reader already partway
      // down does not lose the row.
      remountOutline() {
        if (!this.outlineBuilt || this.findQuery) return;
        const box = this.$refs.outline;
        const at = box?.querySelector('.overflow-y-auto')?.scrollTop || 0;
        this.outlineBuilt = false;
        this.mountOutline();
        const now = box?.querySelector('.overflow-y-auto');
        if (now) now.scrollTop = at;
      },
      // Gemini's summary of each turn, keyed by the instant the turn was sent,
      // which is what an outline row's ask carries. A file written since
      // 2026-10-29 states that instant on every turn (`at`), and that is used
      // as it stands. An older file only numbers the user's own prompts
      // (web-tools-private gemini_followup.py, user_turns), so turn i is
      // prompts[i] from schema 8. A record before schema 8 still has injected
      // prompts in that list and the two numberings can disagree; there an
      // unstamped file's notes are used only when the counts agree, since a
      // summary on the wrong row is worse than none.
      turnNotes() {
        const turns = this.topics?.turns;
        const r = this.record || {};
        const prompts = r.prompts || [];
        if (!Array.isArray(turns) || !turns.length) return null;
        const stamped = turns.every((t) => typeof t?.at === 'string' && t.at);
        if (!stamped && (r.schema || 1) < 8 && !Array.isArray(r.injected) && turns.length !== prompts.length) return null;
        const by = {};
        for (const t of turns) {
          const at = stamped ? t.at : prompts[t?.turn]?.at;
          if (!at) continue;
          (by[at] ||= []).push(typeof t.summary === 'string' && t.summary
            ? { summary: t.summary, headline: t.headline || '' } : null);
        }
        // A message and the image sent with it are two turns at one instant,
        // and two rows in the outline. Their notes stay a list, in turn order,
        // which the outline takes in row order; a lone turn's is the note
        // itself. Keyed by instant alone, the later turn's note overwrote the
        // earlier and showed on both rows (29 pairs among the 406 sessions
        // backfilled 2026-10-29).
        for (const at of Object.keys(by)) {
          if (!by[at].some(Boolean)) delete by[at];
          else if (by[at].length === 1) by[at] = by[at][0];
        }
        return Object.keys(by).length ? by : null;
      },
      async copyRecord() {
        if (!this._rawExplorer?.copy) return;
        if (!(await this._rawExplorer.copy())) return;
        this.copied = true;
        setTimeout(() => { this.copied = false; }, 1200);
      },
      // The Record tab: one explorer, mounted on the first visit, in the view
      // the switch holds. `apply` re-applies the switch to an explorer already
      // up, for an address that named a view (pane=log, pane=schema).
      async openRecord(apply = false) {
        const fresh = !this.rawBuilt;
        await this.mountRaw();
        if (apply && !fresh) this.setRecView(this.recView);
      },
      setRecView(v) {
        this.recView = v === 'schema' ? 'schema' : 'tree';
        const x = this._rawExplorer;
        if (!x) return;
        // The explorer reports the change back through onView; the switch
        // already says it.
        this._recSwitching = true;
        try { x.setView(this.recView); } finally { this._recSwitching = false; }
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
            // The host supplies the height: the pane's share of the shell,
            // framed or standalone. Letting
            // the explorer size itself would lay the entire raw record out
            // into the document instead of scrolling it inside this pane.
            // Tree, Schema and Table, switched by the Record tab's own Tree
            // and Schema switch, with no toolbar row: no view buttons, filter
            // or download, and copy rides the switch's row (owner,
            // 2026-11-09). Its JSON view is not offered.
            this._rawExplorer = window.JsonExplorer.mount(box, {
              data: this.record,
              name: (this.shortId || 'session') + '.json',
              fill: true,
              views: ['tree', 'schema', 'table'], tabs: false, filter: false, toolbar: false,
              mode: this.recView,
              // A filled tree folds its Schema view into the inspector under
              // it (#1331); the switch here reaches the whole record's.
              schemaPanel: false,
              // The Schema view's arrows open a list in the tree or as a
              // table, and the switch follows; Table sits under Tree.
              onView: (v) => {
                if (!this._recSwitching) this.recView = v === 'schema' ? 'schema' : 'tree';
              },
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
      async openDeck(at) {
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
            // What each turn holds, on the index and beside the title.
            ...(window.TurnViews ? { marks: (i) => { const calls = this.openCallsByTurn(); return this.turnMarks(i, calls.get(i) || 0); } } : {}),
          });
          if (typeof o.onOpen === 'function') {
            try { o.onOpen(deck); } catch { /* host bookkeeping cannot prevent reading */ }
          }
        } catch (e) {
          this.err = e?.message || String(e);
        } finally { this.deckOpening = false; }
      },
    };
  });
  };

  // A repository's mark as the app's estate list declares it (its manifest's
  // icon, mark, tone and weight, read from the config cache), or null where
  // this is not mounted in the app or the list does not name the repository.
  // The manifest read beside it is RepoMark.of, memoized for the page's life:
  // a mark changes when someone edits a manifest, which a reload covers.
  function estateMark(slug) {
    const hit = (window.__shell?.estateRepos || []).find((e) => e && e.repo === slug);
    const s = hit && window.RepoMark?.spec(hit, slug);
    return s && s.declared ? s : null;
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

  // The record reading, lent to a page that shows part of a session without
  // mounting the whole brief (pages/turn.html). The same memoized read and the
  // same listing, so a reader moving between the two pages reads each once.
  // `pathOf` takes either form of id resolvePath takes, and a day when known.
  // A Claude session id (session_01…) to the record's { id, day }, through
  // the sessions index (state/sessions.json, the RepoSessionsCache's rows,
  // each with `agent`, the session's claude.ai URL). Read once per page.
  let AGENTS = null;
  const agentIndex = (repo) => AGENTS || (AGENTS = (async () => {
    const g = new window.GH({ token: window.TOKEN, repo, ref: 'main' });
    const doc = JSON.parse((await g.get('state/sessions.json')).text);
    const map = new Map();
    for (const r of doc?.rows || []) {
      const m = /(session_[A-Za-z0-9]+)/.exec(String(r?.agent || ''));
      if (m && r.id) map.set(m[1], { id: r.id, day: r.day || '' });
    }
    return map;
  })().catch(() => { AGENTS = null; return new Map(); }));

  window.SessionRecords = {
    STORE,
    read: readRecord,
    branches: sessionBranches,
    // The record's short id for a Claude session id, or '' when the index
    // has no row for it.
    async shortOf(sessionId, repo = STORE) {
      const m = /(session_[A-Za-z0-9]+)/.exec(String(sessionId || ''));
      if (!m) return '';
      return (await agentIndex(repo)).get(m[1])?.id || '';
    },
    // A stem (2026-11-27-98ef6a5c) carries its day, and a known day saves
    // the store listing: one blob read in place of a whole-tree read.
    async pathOf(id, repo = STORE, day = '') {
      const stem = String(id || '').match(/^(\d{4}-\d{2}-\d{2})-/);
      if (stem && !day) day = stem[1];
      const short = String(id || '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
      if (!/^[0-9a-f]{4,}$/i.test(short)) return '';
      const guess = /^\d{4}-\d{2}-\d{2}$/.test(day)
        ? 'sessions/' + day.slice(0, 4) + '/' + day.slice(5, 7) + '/' + day + '-' + short + '.json' : '';
      if (guess) { try { await readRecord(repo, guess); return guess; } catch { /* the listing answers */ } }
      return (await listing(repo)).find((p) => p.endsWith(`-${short}.json`)) || '';
    },
  };

  // Registration is defensive rather than a bare `alpine:init` listener: this
  // component can arrive at the end of a gh.load chain, which may finish after
  // Alpine has already started, and a missed event leaves the host rendering
  // "sessionBrief is not defined". Same idiom branch-brief.js uses for the same
  // race.
  if (window.Alpine?.directive) register();
  else document.addEventListener('alpine:init', register);
})();
