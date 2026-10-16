// The PowerShell outpost view, shown in the Overview tab of a project that
// declares a PowerShell outpost manifest: one workspace's PowerShell material,
// each file with where it is meant to go on the work computer and what has been
// observed about the copy there. The work computer has no Git checkout, so
// every fact about it arrives by hand:
// a pasted or dropped work copy (the comparison flow, lib/kits/
// file-correspondence.js, which stays browser-local), or a confirmed "I placed
// this on the work computer", which lib/kits/powershell-outpost.js appends to the
// workspace's observations.csv. The derivation is the kit's; this file is the
// surface, and its one rule is that no gesture but the confirm writes.
//
// Mounts by the crumb-bar idiom (template injected in init, then initTree),
// reads the open project from the argument the pane passes, and reaches the
// shell for the comparison hand-off.
document.addEventListener('alpine:init', function () {
  Alpine.data('powershellOutpostView', function (project) {
    const K = () => window.PowerShellOutpost;
    const short = sha => String(sha || '').slice(0, 7);
    const when = iso => {
      if (!iso) return '';
      const d = new Date(iso);
      return isNaN(d) ? iso : d.toISOString().slice(0, 10);
    };
    // One icon per file, in the list and the detail header, carrying the
    // state a reader acts on. "local state unknown" reads as Not observed, a
    // dashed circle in no colour: it was "Assumed synced" under a green check
    // until 2026-10-13, which read as fine on fifty files the ledger had never
    // seen, against the outpost doc's own rule that no label claims "synced".
    // An observation confirmation is a filled check. The observations file and
    // the manifest are unchanged; this is how the list shows them. Titles stay
    // at two words, the repo's rule for an icon's label
    // (powershell-outpost-view.test.mjs).
    // The icons are the estate's shared tones (kits/sync-status.js), so a
    // shortcut behind GitHub and a file behind GitHub read the same.
    const I = window.SyncStatus.ICON;
    // The Office applications' marks, for the application pills. Phosphor has
    // no OneNote mark, so OneNote takes a notebook; an application outside
    // Office takes a plain window.
    const APP_ICONS = { Excel: 'ph-microsoft-excel-logo', Outlook: 'ph-microsoft-outlook-logo', OneNote: 'ph-notebook',
      Word: 'ph-microsoft-word-logo', PowerPoint: 'ph-microsoft-powerpoint-logo' };
    const STATUS = {
      unknown: { short: 'Not observed', label: 'Not observed', cls: I.unseen },
      reported: { short: 'Confirmed', label: 'Confirmed installed', cls: I.current },
      verified: { short: 'Verified', label: 'Verified from a supplied copy', cls: I.current },
      changed: { short: 'Update pending', label: 'Update pending', cls: I.behind },
      'pending-changed': { short: 'Update pending', label: 'Update pending', cls: I.behind },
      'pending-new': { short: 'New file', label: 'New file, not yet installed', cls: I.new },
      partial: { short: 'Partly updated', label: 'Selected changes reported installed', cls: I.behind },
      differs: { short: 'Differs', label: 'Local copy differs', cls: I.differs },
      'differs-changed': { short: 'Differs', label: 'Local copy differed, and GitHub changed since', cls: I.differs },
      'repo-only': { short: 'Repository only', label: 'Repository only, not installed', cls: I.none },
    };
    // The status icon and its menu: tap or right-click. `side` anchors the
    // menu so it opens into the pane rather than off its edge. `part` is a
    // data-part for a list row's copy, which declares the menu its actions.
    const statusMenu = (path, side, part = '') => `
      <div class="relative shrink-0" ${part} @click.outside="menuFor === ${path} && (menuFor = '')" @keydown.escape.window="menuFor = ''">
        <button @click.stop="toggleMenu(${path})" class="p-1.5 leading-none rounded-full cursor-pointer transition-opacity hover:opacity-60" data-status
                :title="statusOf(${path}).short" :aria-label="statusOf(${path}).label + ', actions'" :aria-expanded="menuFor === ${path}">
          <i class="text-xl" :class="statusOf(${path}).cls"></i></button>
        <ul x-show="menuFor === ${path}" x-cloak data-status-menu
            class="menu absolute ${side}-0 top-full z-30 mt-1 w-64 rounded-box bg-base-100 border border-base-300 shadow-lg p-1 text-base">
          <li class="menu-title" x-text="statusOf(${path}).label"></li>
          <template x-for="a in actionsFor(${path})" :key="a.key">
            <li><button @click.stop="runAction(${path}, a.key)"><i class="ph text-lg" :class="a.icon"></i><span x-text="a.label"></span></button></li>
          </template>
        </ul>
      </div>`;
    // One changed block, the card the Changes strip shows and the full-screen
    // deck renders in each slide (openChangeDeck, by addScopeToNode with `u`
    // and `deck`). The diff is always open: a change is what the card is for.
    // In the strip the card has a fixed height and its diff scrolls; in the
    // deck the slide scrolls.
    const CHANGE_CARD = `
      <div class="flex flex-col min-h-0" :class="deck ? '' : 'h-full'" data-unit>
        <label class="flex items-start gap-2 px-3 py-2 border-b border-base-200 cursor-pointer shrink-0">
          <input type="checkbox" class="checkbox checkbox-sm mt-0.5" :checked="unitSelected.includes(u.id)"
                 :disabled="!!(u.blocked || !hasSuppliedBaseline || unitBusy)" @change="toggleUnit(u.id, $event.target.checked)" :aria-label="'Select ' + u.name">
          <span class="min-w-0 grow">
            <span class="font-mono font-medium break-all" x-text="changeName(u)"></span>
            <span class="block text-sm text-base-content/60" x-text="changeMeta(u)"></span>
          </span>
        </label>
        <p x-show="u.blocked" class="flex items-start gap-1.5 px-3 pt-2 text-base shrink-0" data-unit-blocked>
          <i class="ph ph-warning-circle text-warning text-lg shrink-0"></i>
          <span>Can't be taken alone: the parser could not find where this change ends. Code, Work copy shows the whole file.</span></p>
        <p x-show="u.requires.length" class="px-3 pt-2 text-base shrink-0" x-text="'Brings along ' + unitNames(u.requires)"></p>
        <!-- A block's unchanged lines stay, for context; the strip opens the
             card scrolled to its first changed line. -->
        <div class="font-mono text-sm leading-6 py-1" :class="deck ? '' : 'grow min-h-0 overflow-y-auto'" data-unit-diff
             x-init="$nextTick(() => { const k = $el.querySelector('[data-changed]'); if (!deck && k && k.offsetTop > $el.clientHeight * 0.6) $el.scrollTop = k.offsetTop - 48; })">
          <template x-for="(r, index) in unitDiff(u)" :key="index">
            <div class="flex" :class="r.type === 'add' ? 'bg-success/10' : r.type === 'del' ? 'bg-error/10' : ''" :data-changed="r.type !== 'eq' ? '' : null">
              <span class="w-6 text-center shrink-0 select-none text-base-content/60" x-text="r.type === 'add' ? '+' : r.type === 'del' ? '−' : ' '"></span>
              <pre class="pr-3 whitespace-pre-wrap [overflow-wrap:anywhere] min-w-0" x-text="r.text || ' '"></pre>
            </div>
          </template>
        </div>
      </div>`;
    const store = () => window.Alpine.store('browser');
    const shell = () => window.__shell;
    const pill = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-base font-medium transition-colors';
    let loadGeneration = 0, textGeneration = 0, copyCount = 0;
    let textCache = null;
    // The source pane is the file component the deck uses
    // (alpineComponents/powershell-file.js), mounted inline once per detail
    // column: fileCtx() is its context and `inline` that context once built.
    // Reads are shared with the deck, keyed by revision and blob.
    // `self` is this component's own scope, captured in init(): fileCtx() runs
    // inside a child x-data expression, where Alpine puts every registered
    // Alpine.data name ahead of this scope, so `this.repo` there is the
    // repo component's factory (alpineComponents/repo.js), not the string.
    let sourceGeneration = 0, unitGeneration = 0, inline = null, draftsLoad = Promise.resolve(), self = null;
    // The change strip's aim and frame, the full-screen deck over it, the
    // component's root (captured in init), and the match index by revision.
    let changeAim = -1, changeAimTimer = 0, changeFrame = 0, changeDeck = null, root = null, matchIndex = null;
    const reads = new Map(), draftRecords = new Map();
    // The resource pane's reads: each file's functions and calls by blob
    // (kits/powershell-language.js), and a line to open once the file a
    // function, control or handler lives in has its editor.
    let resourceGeneration = 0, wantLine = null, following = false, onPop = null;
    // The item the address named when this view last wrote or read it. A
    // popstate whose address names the same item is not this view's (a swipe
    // deck closing pushes and pops an entry at the same address).
    const urlItem = () => { try { return new URLSearchParams(location.search).get('item') || ''; } catch { return ''; } };
    let addressItem = '';
    const factCache = new Map();
    const REACH = [{ key: 'outside', label: 'Called from outside' }, { key: 'inside', label: 'Called only inside' }, { key: 'none', label: 'No caller in code' }];
    const DEPTH = ['', 'pl-4', 'pl-8', 'pl-12', 'pl-16'];

    return {
      description: 'The PowerShell outpost view, shown in the Overview tab of a workspace declaring a PowerShell outpost manifest: PowerShell files grouped by outpost area, narrowed by area and state pills and, where the workspace derives the table, by application pills, each row labelled and each pill with its count; a module or form opened whole by its name, as functions by how far their callers reach or controls with their wired events; their intended destinations, pending adoption and untested limits, what each file loads and is loaded by, and durable observed state. A selected file opens in three tabs: Changes, one swipeable card per changed block, which a supplied work copy turns into a selective update; Your copy, what a pasted or dropped copy holds block by block against GitHub and the version the work computer last held; and Code, the same editor as the file deck, read-only until Edit writes a browser draft. Pasted code is matched to the file it most resembles. A file whose strict dependencies are still pending is placed and recorded with them as one set, and an explicitly confirmed observation lands with any adoption closure in one commit.',

      project,
      repo: '', ref: '', revision: '', observationsPath: '', manifest: null,
      items: [], groups: [], derived: {}, rows: [],
      apps: [],                   // the files each application reaches, when the workspace derives that table
      app: '',                    // '' or the application pill pressed
      area: '',                   // '' or the area pill pressed
      areaOf: {},                 // each file's area, by path, for the pills' counts
      loadEdges: [],              // which file loads which, when the workspace derives that table
      checks: [],                 // copies compared this visit, newest first, one per file; held in memory, never stored
      loading: true, err: '',
      filter: '',                 // '' or a state pill's key, the short label it shows
      selected: '',               // the selected item's repo path
      text: '', textBusy: false,  // the selected file's GitHub text, fetched on demand
      compareError: '',
      compareRetry: null,         // { file, source }: a supplied file that did not decode as UTF-8, awaiting its encoding
      dragging: false,            // a file or text is being dragged over the selected file's column
      textEncoding: '',           // 'windows-1252' when the selected file is not UTF-8
      copyNote: null,             // what the last supplied copy of the selected file is, for the summary card
      drafts: {},                 // path -> true for a file with a browser draft
      draftList: [],              // those drafts, for publication
      publishOpen: false, publishBranch: '', publishMessage: '', publishing: false, published: null, publishError: '',
      lastTransfer: {},           // path -> 'copy' | 'download', the method a later confirm reports
      pending: null,              // { row, line, why } awaiting the confirm
      recordNote: '', recording: false, recordError: '', recorded: null,
      openHistory: true,
      menuFor: '',                // the path whose status menu is open
      source: '', sourceState: '', sourceError: '', // the read-only source pane: '' | loading | editor | plain | error
      sourceView: 'code',         // 'code' | 'changes'
      wantChanges: false,         // the menu asked for Changes before the base loaded
      baseline: null,             // { key, label, text }: what the work computer is known to hold
      baselineBusy: false, baselineNote: '', diffRows: [],
      unitRows: [], unitReview: null, unitSelected: [], unitBusy: false, unitError: '',
      unitPrepared: null, unitConfirmation: null,
      unitFormatting: false,
      detailTab: 'code',          // 'changes' | 'copy' | 'code'; shownTab falls back to Code when the file has no such tab
      tabPicked: false,           // the reader chose a tab for this file, so a late unit review does not move them
      changeAt: 0,                // the change card in view
      deck: false,                // false in the strip; the full-screen deck scopes each card with deck: true
      earlier: null,              // { key, label, text }: the version the work computer was last known to hold, without any supplied copy
      match: null,                // what a pasted piece of code was matched to: { units, files, text }
      matchBusy: false, matchError: '', matchDragging: false,
      matchProgress: { done: 0, total: 0 },
      // A module or form folder seen whole (PowerShellOutpost.resources).
      resource: '',               // '' or the selected resource's key, such as Modules/ExcelService
      resourceIndex: {},          // key -> resource, rebuilt with the corpus
      resReach: null,             // a module's functions by reach, once every PowerShell file is read
      resForms: [],               // a form's XAML and controller pairs, each with its wiring
      resFunctions: {},           // path -> functions defined, for the file rows
      resBusy: false, resError: '', resUnread: 0, resProgress: { done: 0, total: 0 },
      resMore: {},                // which long lists are shown whole

      template: `
        <div class="@container flex flex-col gap-4" data-powershell-outpost>
          <div class="flex items-center gap-x-3">
            <i class="ph ph-desktop text-xl text-base-content/50 shrink-0"></i>
            <!-- The outpost's root heads this view; the breadcrumb above
                 already names the workspace. A size down on a phone, so the
                 root and Reload share one line. -->
            <h2 class="text-base sm:text-lg font-semibold font-mono min-w-0 truncate" x-text="root || 'Outpost'"></h2>
            <button @click="reload()" class="btn btn-ghost btn-sm btn-square ml-auto shrink-0" title="Reload">
              <i class="ph ph-arrows-clockwise text-base"></i></button>
          </div>
          <!-- Three rows of count chips, every choice and its count in view, in
               the Map's compact chip (btn-xs, neutral when pressed). An area
               chip and an application chip toggle; a state chip covers every
               state sharing its short label, as the list's icons do. Each row
               counts what passes the other two, and keeps every chip the
               corpus has, so a tap never moves the row under the finger. Each
               row is labelled, as the Map's test dimensions are, because rows
               of chips that compose otherwise read as rivals. A label names its
               chips and sits below them in size: the budget-drs data explorer's
               strip label (9px, uppercase, /40) under btn-xs text at 11px. The
               labels share a grid column, and leading-6 matches a btn-xs, so a
               label sits level with the first line of its chips. Below lg each row is
               one line that scrolls sideways, as the Map's tab strips do; from
               lg up it wraps, since a hidden scrollbar would hide chips from a
               mouse. The area row needs two areas, since a filter with one
               choice narrows nothing. -->
          <div class="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1" data-filters data-slot="frame:count-chips">
            <template x-if="groups.length > 1">
              <div class="contents">
                <span class="text-[9px] leading-6 uppercase tracking-wider text-base-content/40" aria-hidden="true" data-filter-label>Area</span>
                <div class="flex items-center gap-1 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap"
                     role="group" aria-label="Filter by area" data-area-filter>
                  <template x-for="a in areaPills" :key="a.key">
                    <button @click="area = area === a.key ? '' : a.key" class="btn btn-xs shrink-0 whitespace-nowrap gap-1"
                            :aria-pressed="area === a.key" :disabled="!a.count && area !== a.key"
                            :class="area === a.key ? 'btn-neutral' : 'btn-ghost'">
                      <span x-text="a.label"></span><span class="opacity-60 tabular-nums" x-text="a.count"></span></button>
                  </template>
                </div>
              </div>
            </template>
            <template x-if="apps.length">
              <div class="contents">
                <span class="text-[9px] leading-6 uppercase tracking-wider text-base-content/40" aria-hidden="true" data-filter-label>App</span>
                <div class="flex items-center gap-1 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap"
                     role="group" aria-label="Filter by application" data-app-filter>
                  <template x-for="a in appPills" :key="a.key">
                    <button @click="app = app === a.key ? '' : a.key" class="btn btn-xs shrink-0 whitespace-nowrap gap-1"
                            :aria-pressed="app === a.key" :disabled="!a.count && app !== a.key"
                            :class="app === a.key ? 'btn-neutral' : 'btn-ghost'">
                      <i class="ph text-sm" :class="a.icon"></i><span x-text="a.label"></span><span class="opacity-60 tabular-nums" x-text="a.count"></span></button>
                  </template>
                </div>
              </div>
            </template>
            <span class="text-[9px] leading-6 uppercase tracking-wider text-base-content/40" aria-hidden="true" data-filter-label>State</span>
            <div class="flex items-center gap-1 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap"
                 role="group" aria-label="Filter by state" data-state-filter>
              <button @click="filter = ''" class="btn btn-xs shrink-0 whitespace-nowrap gap-1" :aria-pressed="!filter"
                      :class="!filter ? 'btn-neutral' : 'btn-ghost'">
                <span>All</span><span class="opacity-60 tabular-nums" x-text="stateTotal"></span></button>
              <template x-for="s in states" :key="s.key">
                <button @click="filter = s.key" class="btn btn-xs shrink-0 whitespace-nowrap gap-1" :aria-pressed="filter === s.key"
                        :disabled="!s.count && filter !== s.key"
                        :class="filter === s.key ? 'btn-neutral' : 'btn-ghost'">
                  <i class="text-sm" :class="s.cls"></i><span x-text="s.label"></span><span class="opacity-60 tabular-nums" x-text="s.count"></span></button>
              </template>
            </div>
          </div>
          <!-- Browser drafts from the file deck, published together to a new
               branch through PowerShellWorkspace.publish. Nothing else here
               writes code to GitHub, and publishing records no observation. -->
          <div x-show="draftList.length || published" x-cloak class="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 flex flex-col gap-2" data-publish>
            <div class="flex flex-wrap items-center gap-2 text-base">
              <i class="ph ph-pencil-simple-line text-warning"></i>
              <span x-text="draftList.length + (draftList.length === 1 ? ' browser draft' : ' browser drafts')"></span>
              <template x-for="d in draftList" :key="d.path">
                <button @click="openFileDeck(d.path)" class="link link-hover font-mono text-sm" x-text="d.path.split('/').pop()"></button>
              </template>
              <div class="grow"></div>
              <button x-show="draftList.length" @click="reviewPublish()" class="btn btn-sm" :class="publishOpen ? 'btn-ghost' : 'btn-primary'" x-text="publishOpen ? 'Cancel' : 'Publish…'"></button>
            </div>
            <div x-show="publishOpen" class="flex flex-col gap-2">
              <div class="flex flex-wrap gap-2">
                <label class="text-sm grow flex flex-col gap-1">New branch<input x-model="publishBranch" :disabled="publishing" class="input input-bordered input-sm w-full font-mono" placeholder="wps/my-change" aria-label="New branch"></label>
                <label class="text-sm grow flex flex-col gap-1">Commit message<input x-model="publishMessage" :disabled="publishing" class="input input-bordered input-sm w-full" aria-label="Commit message"></label>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm text-base-content/70 grow">Creates a new branch on GitHub with these drafts. The work computer is unchanged.</span>
                <button @click="publish()" :disabled="publishing || !publishBranch.trim() || !publishMessage.trim()" class="btn btn-primary btn-sm"
                        x-text="publishing ? 'Publishing…' : 'Create branch and commit'"></button>
              </div>
            </div>
            <p x-show="publishError" class="text-sm text-error" x-text="publishError"></p>
            <div x-show="published" class="flex flex-wrap gap-3 text-base">
              <span>Published to</span><a :href="published?.url" target="_blank" rel="noopener" class="link font-mono" x-text="published?.branch"></a>
              <a :href="published?.compareUrl" target="_blank" rel="noopener" class="link">Open a pull request ↗</a>
            </div>
          </div>
          <p x-show="err" class="text-error text-base" x-text="err"></p>
          <div x-show="loading" class="flex justify-center py-16"><span class="loading loading-dots loading-md opacity-30"></span></div>

          <!-- data-pattern and data-part declare a List and detail and name its
               parts (data/ui-units/codebook.md, "Declaring a pattern in
               markup"); nothing at runtime reads them. aria-current marks the
               selected row in a standard attribute beside its class. The local
               areas below the files are not items: nothing picks them. -->
          <div x-show="!loading" class="grid gap-6 @3xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]" data-pattern="list-detail">
            <!-- The corpus: areas, units, files. Hidden on a narrow pane while a file is open. -->
            <div class="flex flex-col gap-5 min-w-0" :class="selected || resource ? 'hidden @3xl:flex' : 'flex'" data-part="list">
              <!-- Code from anywhere (an ISE tab, a chat, an email), pasted
                   with no file chosen: each piece is matched to
                   the file it most resembles (kits/powershell-match.js), and
                   a candidate opens with those pieces as its supplied copy.
                   The zone keeps its own paste, so the page-wide paste still
                   goes to a selected file. -->
              <section class="flex flex-col gap-2" data-match>
                <div data-match-zone tabindex="0" role="button" @click="matchClipboard()" @keydown.enter.prevent="matchClipboard()"
                     @paste.stop.prevent="matchPaste($event)" @dragover.prevent="matchDragging = true" @dragleave.self="matchDragging = false"
                     @drop.stop.prevent="matchDragging = false; matchDrop($event)"
                     class="border border-dashed rounded-md py-2 px-3 cursor-pointer hover:bg-base-200 transition-colors flex items-center gap-2 text-base text-base-content/60"
                     :class="matchDragging ? 'border-primary bg-primary/10' : 'border-base-300'">
                  <i class="ph ph-magnifying-glass text-lg shrink-0"></i>
                  <span class="grow">Paste code to find its file</span>
                  <span x-show="matchBusy" class="loading loading-dots loading-xs"></span>
                  <span x-show="matchBusy && matchProgress.total" class="font-mono text-xs tabular-nums" x-text="matchProgress.done + '/' + matchProgress.total"></span>
                </div>
                <p x-show="matchError" class="text-base text-error" x-text="matchError"></p>
                <div x-show="match" x-cloak class="rounded-lg border border-base-300 flex flex-col" data-match-result>
                  <div class="flex items-center gap-2 px-3 py-1.5 border-b border-base-200 text-sm text-base-content/70">
                    <span class="grow" x-text="matchHead"></span>
                    <button @click="match = null" class="btn btn-ghost btn-xs btn-square" aria-label="Dismiss"><i class="ph ph-x"></i></button>
                  </div>
                  <template x-for="f in (match?.files || []).slice(0, 6)" :key="f.path">
                    <div class="flex flex-col gap-1 px-3 py-2 border-b border-base-200" data-match-file>
                      <div class="flex items-center gap-2 min-w-0">
                        <i class="shrink-0" :class="statusOf(f.path).cls"></i>
                        <a :href="hrefFor(f.path)" @click="go($event, () => select(f.path))" class="link link-hover font-mono text-base truncate min-w-0" x-text="baseName(f.path)"></a>
                        <span class="font-mono text-xs tabular-nums text-base-content/60 shrink-0" x-text="Math.round(f.share * 100) + '%'"></span>
                        <div class="grow"></div>
                        <button @click="compareMatch(f)" class="btn btn-sm shrink-0">Compare</button>
                      </div>
                      <div class="text-sm text-base-content/70 break-words" x-text="matchLine(f)"></div>
                    </div>
                  </template>
                  <div x-show="matchNew.length" class="px-3 py-2 text-sm text-base-content/70 break-words" data-match-new
                       x-text="'Not found in any file: ' + matchNew.map(u => u.name).join(', ')"></div>
                  <p x-show="match && !match.files.length" class="px-3 py-2 text-base">No file holds code like this.</p>
                </div>
              </section>
              <template x-for="g in visibleGroups" :key="g.area">
                <section>
                  <h3 class="flex items-baseline gap-2 text-sm font-mono uppercase tracking-widest text-base-content/50 mb-1.5" data-part="group">
                    <span x-text="g.area"></span>
                    <span class="normal-case tracking-normal text-base-content/40" x-text="destinationOf(g)" data-part="meta"></span>
                  </h3>
                  <div class="flex flex-col gap-2">
                    <template x-for="u in g.units" :key="u.name">
                      <div class="rounded-lg border border-base-300 px-2 py-1.5">
                        <!-- A module or form name opens the folder whole; a
                             folder of scripts or a one-file Html folder stays
                             a label (PowerShellOutpost.resources). -->
                        <template x-if="u.name !== g.area && resourceIndex[g.area + '/' + u.name]">
                          <a :href="hrefFor(resourceIndex[g.area + '/' + u.name]?.path)" @click="go($event, () => selectResource(g.area + '/' + u.name))" data-part="group" data-resource-head
                                  class="flex items-center gap-1.5 w-full rounded px-1 py-0.5 text-base font-medium hover:bg-base-200"
                                  :class="resource === g.area + '/' + u.name && 'bg-primary/10'" :aria-current="resource === g.area + '/' + u.name ? 'true' : 'false'">
                            <span class="truncate" x-text="u.name"></span><i class="ph ph-caret-right text-sm text-base-content/40 ml-auto shrink-0"></i></a>
                        </template>
                        <div x-show="u.name !== g.area && !resourceIndex[g.area + '/' + u.name]" class="text-base font-medium px-1" x-text="u.name" data-part="group"></div>
                        <div class="flex flex-col">
                          <template x-for="it in u.files" :key="it.path">
                            <div class="flex items-center gap-1 rounded hover:bg-base-200 min-w-0" data-row data-part="item"
                                 :class="selected === it.path && 'bg-primary/10'" :aria-current="selected === it.path ? 'true' : 'false'" @contextmenu.prevent="menuFor = it.path">
                              <a :href="hrefFor(it.path)" @click="go($event, () => select(it.path))" class="flex items-center gap-2 px-1 py-1 text-left text-base grow min-w-0">
                                <i class="ph text-base-content/50 shrink-0" :class="iconOf(it)" data-part="meta"></i>
                                <span class="truncate" x-text="it.name" data-part="title"></span>
                                <i x-show="drafts[it.path]" class="ph ph-pencil-simple-line text-warning shrink-0" title="Browser draft" data-draft-mark data-part="meta"></i>
                              </a>
                              ${statusMenu('it.path', 'right', 'data-part="actions"')}
                            </div>
                          </template>
                        </div>
                      </div>
                    </template>
                  </div>
                </section>
              </template>
              <!-- The areas the work computer holds and GitHub does not. The
                   manifest carries each one's name, status and shape; why it
                   carries that status is in the document the header links, so
                   a row here stays one line of facts rather than a card of
                   policy prose repeated from there. -->
              <section x-show="!filter && !app && !area && localAreas.length">
                <h3 class="flex items-baseline gap-2 text-sm font-mono uppercase tracking-widest text-base-content/50 mb-1.5">
                  <span>Local areas</span>
                  <span class="normal-case tracking-normal text-base-content/40">no repository counterpart</span>
                </h3>
                <div class="rounded-lg border border-dashed border-base-300 px-2 py-1">
                  <template x-for="(a, i) in localAreas" :key="a.name">
                    <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-1 py-1"
                         :class="i && 'border-t border-base-200'">
                      <i class="ph ph-folder-dashed text-base-content/40 shrink-0"></i>
                      <span class="font-mono text-base" x-text="a.name"></span>
                      <span class="badge badge-sm badge-ghost shrink-0" x-text="a.status === 'local-only' ? 'local only' : 'unresolved'"></span>
                      <span class="text-base text-base-content/60" x-text="a.shape"></span>
                    </div>
                  </template>
                </div>
              </section>
            </div>

            <!-- The selected file: where it goes, what is known, what to do next. -->
            <div class="min-w-0" :class="selected || resource ? 'block' : 'hidden @3xl:block'" data-part="detail">
              <template x-if="!item && !res">
                <p class="text-base-content/40 italic text-base py-8">Select a file to see its intended location, its observations, and the actions on it, or a module or form by its name to see it whole.</p>
              </template>
              <!-- The whole column takes a dropped work copy for the selected
                   file, so a drop that misses the Source box still lands. -->
              <template x-if="item">
                <div class="flex flex-col gap-4"
                     @dragover="if (item.comparable) { $event.preventDefault(); dragging = true }" @dragleave.self="dragging = false"
                     @drop="dragging = false; if (item.comparable) { $event.preventDefault(); $event.stopPropagation(); compareDrop($event) }">
                  <!-- Name, status and its date, where the file goes. The pending
                       entry's own words follow when there are any; the state and
                       its date are not repeated there. -->
                  <div class="flex items-start gap-2">
                    <button @click="select('')" class="btn btn-ghost btn-sm btn-square @3xl:hidden" title="Back to the list">
                      <i class="ph ph-arrow-left text-base"></i></button>
                    <div class="min-w-0 grow flex flex-col gap-0.5">
                      <div class="flex flex-wrap items-center gap-x-1.5">
                        <h3 class="text-lg font-semibold truncate" x-text="item.name"></h3>
                        ${statusMenu('item.path', 'left')}
                        <span class="text-base text-base-content/70" x-text="statusLine(item)" data-status-line></span>
                      </div>
                      <div class="text-sm font-mono text-base-content/60 break-all" x-text="destinationOfItem(item)" data-destination></div>
                      <div x-show="item.companion" class="text-sm text-base-content/60">with
                        <a :href="hrefFor(item.companion)" @click="go($event, () => select(item.companion))" class="link link-hover font-mono" x-text="item.companion?.split('/').pop()"></a>
                        <i class="ml-0.5 align-middle" :class="item.companion && statusOf(item.companion).cls"></i></div>
                      <div x-show="resourceOfItem(item)" class="text-sm text-base-content/60" data-resource-link>in
                        <a :href="hrefFor(resourceOfItem(item)?.path)" @click="go($event, () => selectResource(resourceOfItem(item)?.key))" class="link link-hover"
                           :data-title-tip-lead="resourceOfItem(item)?.key" :data-title-tip="resourceTip(resourceOfItem(item))" x-text="resourceOfItem(item)?.name"></a></div>
                    </div>
                  </div>

                  <div x-show="item.pendingAdoption?.limit || stateOf(item.path).conflict" class="text-base text-base-content/80 border-l-2 border-warning pl-3" data-adoption>
                    <p x-text="item.pendingAdoption?.limit || ''"></p>
                    <p x-show="stateOf(item.path).conflict" class="mt-1 text-sm text-error" data-adoption-conflict>This file has an observation row and a pending entry, which contradict each other. The workspace check fails while both exist; remove the entry from outpost.json.</p>
                  </div>
                  <!-- Files still pending that this one strictly needs: its
                       script and its confirm carry them (placeable()). -->
                  <div x-show="installWith(item).length" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-base" data-install-with>
                    <span class="text-base-content/70">Install with</span>
                    <template x-for="d in installWith(item)" :key="d.path">
                      <a :href="hrefFor(d.path)" @click="go($event, () => select(d.path))" class="link link-hover font-mono inline-flex items-center gap-1 min-w-0 text-left">
                        <i class="shrink-0" :class="statusOf(d.path).cls"></i><span class="break-all" x-text="d.name"></span></a>
                    </template>
                  </div>

                  <!-- The confirm: the exact row, the file it lands in, one tap. -->
                  <div x-show="pending" x-cloak class="border border-primary/40 rounded-lg p-3 flex flex-col gap-2 bg-primary/10">
                    <div class="text-base font-medium" x-text="pending?.why"></div>
                    <input x-model="recordNote" type="text" class="input input-bordered input-sm w-full" placeholder="note (optional, one line)" @input="renderPending()">
                    <pre class="font-mono text-base whitespace-pre-wrap break-all bg-base-100 rounded p-2" x-text="pending?.line"></pre>
                    <div class="font-mono text-base text-base-content/60 break-all" x-text="'appends to ' + repo + '@' + ref + ':' + observationsPath"></div>
                    <p x-show="item.pendingAdoption || pending?.rows?.length > 1" class="text-sm"
                       x-text="pending?.rows?.length > 1 ? 'Recording these observations also removes these files from the pending adoption list.' : 'Recording this observation also removes this file from the pending adoption list.'"></p>
                    <div class="flex flex-wrap gap-1.5">
                      <button @click="confirmRecord()" :disabled="!!recording" class="btn btn-primary btn-sm" x-text="pending?.confirm"></button>
                      <button @click="pending = null; recordError = ''" class="btn btn-ghost btn-sm">Cancel</button>
                    </div>
                    <p x-show="recordError" class="text-sm text-error" x-text="recordError"></p>
                  </div>
                  <p x-show="recorded" x-cloak class="text-base text-success" x-text="recorded"></p>

                  <div x-show="historyOf(item).length" data-observations>
                    <div class="flex items-center gap-2 text-sm font-medium text-base-content/60">
                      <span>Observations</span>
                      <span class="font-mono text-xs" x-text="historyOf(item).length"></span>
                      <div class="grow"></div>
                      <a :href="observationsUrl" target="_blank" rel="noopener" class="link link-hover text-xs font-mono">observations.csv</a>
                    </div>
                    <div class="flex flex-col">
                      <template x-for="(r, i) in historyOf(item)" :key="r.date + r.local_sha256">
                        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1 text-base" :class="i && 'border-t border-base-200'">
                          <span class="font-mono text-xs tabular-nums" x-text="when(r.date)"></span>
                          <span class="badge badge-sm" :class="r.kind === 'installed' ? 'badge-info' : r.kind === 'verified' ? 'badge-success' : 'badge-warning'" x-text="rowLabel(r)"></span>
                          <span class="font-mono text-base text-base-content/60" x-text="'at ' + short(r.revision) + (r.blob_sha === item.blobSha ? ' (current)' : ' (superseded)')"></span>
                          <span class="text-base text-base-content/60" x-text="r.method"></span>
                          <span x-show="r.note" class="text-base-content/70 w-full" x-text="r.note"></span>
                        </div>
                      </template>
                    </div>
                  </div>

                  <!-- What this file loads and what loads it, read off the
                       workspace's derived table. A target missing from the
                       tree is named, since that is what the code expects. -->
                  <div x-show="loadsOf(item).length || loadedBy(item).length" class="flex flex-col gap-1.5" data-dependencies>
                    <template x-for="side in [{ label: 'Loads', list: loadsOf(item), end: 'to' }, { label: 'Loaded by', list: loadedBy(item), end: 'from' }]" :key="side.label">
                      <div x-show="side.list.length" class="flex items-baseline gap-3 text-base">
                        <span class="text-sm font-medium text-base-content/60 w-20 shrink-0" x-text="side.label"></span>
                        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
                        <template x-for="e in side.list" :key="e[side.end]">
                          <span class="inline-flex flex-wrap items-baseline gap-x-1 min-w-0 max-w-full" data-edge>
                            <template x-if="itemAt(e[side.end])">
                              <a :href="hrefFor(e[side.end])" @click="go($event, () => select(e[side.end]))" class="link link-hover font-mono inline-flex items-center gap-1 min-w-0 text-left">
                                <i class="shrink-0" :class="statusOf(e[side.end]).cls"></i><span class="break-all" x-text="baseName(e[side.end])"></span></a>
                            </template>
                            <template x-if="!itemAt(e[side.end])">
                              <span class="inline-flex items-baseline gap-1">
                                <span class="font-mono text-base-content/60 break-all" x-text="baseName(e[side.end])"></span>
                                <span class="badge badge-sm badge-warning badge-outline">not in repository</span>
                              </span>
                            </template>
                            <span class="text-sm text-base-content/50" x-text="e.how"></span>
                          </span>
                        </template>
                        </div>
                      </div>
                    </template>
                  </div>

                  <!-- The file's working area, three tabs over one column.
                       Changes: one card per changed block between what the
                       work computer is known to hold and GitHub now, swiped
                       one at a time, its diff always open; a supplied copy
                       turns the cards into a selective update. Your copy:
                       what a pasted or dropped copy holds, block by block,
                       against the earlier version and GitHub now. Code: the
                       file component the deck uses (powershell-file.js,
                       mounted inline by fileCtx), read-only until Edit, with
                       its own Work copy line diff. Panels hide by class, not
                       x-if, so the one editor view survives a tab change. -->
                  <div x-show="detailTabs.length > 1" role="tablist" class="tabs tabs-border" data-detail-tabs>
                    <template x-for="t in detailTabs" :key="t.key">
                      <button role="tab" class="tab gap-1.5" :class="shownTab === t.key && 'tab-active'" :aria-selected="shownTab === t.key"
                              :data-tab="t.key" @click="setDetailTab(t.key)">
                        <span x-text="t.label"></span>
                        <span x-show="t.count" class="badge badge-sm tabular-nums" x-text="t.count"></span></button>
                    </template>
                  </div>

                  <section :class="shownTab === 'changes' ? '' : 'hidden'" class="flex flex-col gap-2 min-w-0" data-unit-review>
                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-unit-head>
                      <span class="text-base-content/70 min-w-0" x-text="baseline ? baseline.label + ' → GitHub ' + short(revision) : ''" data-unit-base></span>
                      <span x-show="unitBusy" class="loading loading-dots loading-xs"></span>
                      <div class="grow"></div>
                      <label x-show="unitReview?.units.some(u => u.formatOnly)" class="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" class="checkbox checkbox-xs" x-model="unitFormatting">Whitespace-only changes</label>
                      <div class="flex items-center ml-auto">
                      <div x-show="visibleUnits.length > 1" class="flex items-center" data-unit-pager>
                        <button type="button" class="btn btn-xs btn-ghost btn-square" @click="goChange(changeAt - 1)" :disabled="changeAt <= 0"
                                aria-label="Previous change"><i class="ph ph-caret-left"></i></button>
                        <span class="font-mono text-xs tabular-nums px-1" x-text="(changeAt + 1) + '/' + visibleUnits.length" data-unit-pos></span>
                        <button type="button" class="btn btn-xs btn-ghost btn-square" @click="goChange(changeAt + 1)" :disabled="changeAt >= visibleUnits.length - 1"
                                aria-label="Next change"><i class="ph ph-caret-right"></i></button>
                      </div>
                      <button type="button" x-show="visibleUnits.length" class="btn btn-sm btn-ghost btn-square" @click="openChangeDeck()" data-unit-full
                              aria-label="Swipe through these changes, full screen"><i class="ph ph-arrows-out-simple text-lg"></i></button>
                      </div>
                    </div>
                    <p x-show="unitError" role="alert" class="text-base text-error break-words" x-text="unitError"></p>
                    <button type="button" x-show="visibleUnits.length && !hasSuppliedBaseline" @click="setDetailTab('copy')" data-unit-needs-copy
                            class="self-start inline-flex items-center gap-1.5 text-base link link-hover">
                      <i class="ph ph-clipboard-text"></i><span>Paste your work copy to choose changes</span></button>
                    <p x-show="unitReview && !visibleUnits.length" class="text-base text-base-content/70">No changes.</p>
                    <!-- data-no-swipe: a sideways drag here is the strip's, never the
                         shell's view pager. -->
                    <div x-show="visibleUnits.length" data-change-strip data-no-swipe @scroll.passive="changeScroll()"
                         class="flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-box border border-base-300
                                [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <template x-for="u in visibleUnits" :key="u.id">
                        <div data-slide class="w-full shrink-0 snap-center min-w-0 h-[min(34rem,65vh)] flex flex-col">${CHANGE_CARD}</div>
                      </template>
                    </div>
                    <div x-show="visibleUnits.length" class="flex flex-wrap items-center gap-2" data-unit-foot>
                      <span class="text-base" x-text="selectionLine"></span>
                      <div class="grow"></div>
                      <button @click="prepareUnits()" class="btn btn-sm" :class="canPrepareUnits && 'btn-primary'" :disabled="!!(!canPrepareUnits || unitBusy)">Preview update</button>
                    </div>
                    <p x-show="hasSuppliedBaseline && placeable(item).length > 1" class="flex items-start gap-1.5 text-base" data-unit-waits>
                      <i class="ph ph-warning-circle text-warning text-lg shrink-0"></i>
                      <span>Choosing changes waits until the files under Install with are placed.</span></p>
                    <div x-show="unitPrepared" class="flex flex-col gap-2 min-w-0 rounded-box border border-base-300 p-3" data-unit-preview>
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-base font-medium min-w-0" x-text="unitPrepared ? item.name + ' with ' + unitNames(unitPrepared.ids) : ''"></span>
                        <div class="grow"></div>
                        <button @click="copyPreparedUnits()" class="btn btn-sm">Copy update</button>
                        <button @click="downloadPreparedUnits()" class="btn btn-sm">Download, UTF-8 with BOM</button>
                        <button x-show="manifest?.unitObservations" @click="askUnitsInstalled()" class="btn btn-sm">Record selected changes…</button>
                      </div>
                      <pre class="text-sm font-mono whitespace-pre-wrap [overflow-wrap:anywhere] max-h-80 overflow-auto bg-base-200/50 rounded p-2" x-text="unitPrepared?.text" data-unit-text></pre>
                    </div>
                    <div x-show="unitConfirmation" class="rounded-lg border border-primary/40 bg-primary/10 p-3 flex flex-col gap-2" data-unit-confirm>
                      <p class="text-base">Confirm only after placing these selected changes on the work computer. The file stays partly updated.</p>
                      <p class="text-base font-mono break-all" x-text="unitConfirmation?.units.map(u => u.action + ' ' + u.name).join(', ')"></p>
                      <div class="flex flex-wrap gap-2"><button @click="confirmUnitsInstalled()" :disabled="recording" class="btn btn-primary btn-sm">I placed these selected changes</button>
                        <button @click="unitConfirmation = null" :disabled="recording" class="btn btn-ghost btn-sm">Cancel</button></div>
                    </div>
                  </section>

                  <!-- A copy from the work computer, pasted or dropped. The page-
                       wide paste and a drop on the column arrive here too; a tap
                       reads the clipboard through the app's Paste. What the copy
                       holds comes back as the reading below, not as a jump to a
                       diff. -->
                  <section :class="shownTab === 'copy' ? '' : 'hidden'" class="flex flex-col gap-3 min-w-0" data-copy>
                    <div x-show="item.comparable" data-copy-zone tabindex="0" role="button"
                         @click="compareClipboard()" @keydown.enter.prevent="compareClipboard()"
                         class="border border-dashed rounded-md py-3 px-3 text-center cursor-pointer hover:bg-base-200 transition-colors"
                         :class="dragging ? 'border-primary bg-primary/10' : 'border-base-300'">
                      <div class="text-base-content/60 text-base flex items-center justify-center gap-2 pointer-events-none">
                        <i class="ph text-lg" :class="dragging ? 'ph-file-arrow-down text-primary' : 'ph-clipboard-text'"></i>
                        <span x-text="dragging ? 'Drop to compare' : 'Paste or drop your copy of ' + item.name"></span>
                      </div>
                    </div>
                    <div x-show="compareError" class="flex flex-wrap items-center gap-1.5 text-base" data-compare-error>
                      <span class="text-error" x-text="compareError"></span>
                      <template x-for="enc in (compareRetry ? ['utf-16le', 'utf-16be', 'windows-1252'] : [])" :key="enc">
                        <button @click="retryCompare(enc)" class="btn btn-outline btn-xs" x-text="{ 'utf-16le': 'UTF-16 LE', 'utf-16be': 'UTF-16 BE', 'windows-1252': 'Windows-1252' }[enc]"></button>
                      </template>
                    </div>
                    <div x-show="copyNote && copyNote.path === item.path" x-cloak data-copy-summary class="flex flex-col gap-2 text-base">
                      <div class="flex items-start gap-2">
                        <i class="ph text-xl mt-0.5 shrink-0" :class="copyNote?.icon"></i>
                        <div class="grow min-w-0">
                          <div class="font-medium text-balance" x-text="copyNote?.title" data-copy-title></div>
                          <div x-show="copyNote?.against" class="text-sm text-base-content/60" x-text="copyNote?.against"></div>
                        </div>
                        <button @click="copyNote = null" class="btn btn-ghost btn-sm btn-square" title="Dismiss" aria-label="Dismiss"><i class="ph ph-x"></i></button>
                      </div>
                      <div x-show="copyNote?.rows?.length" role="table" class="rounded-lg border border-base-300" data-copy-rows>
                        <template x-for="(r, i) in copyNote?.rows || []" :key="r.key">
                          <div role="row" class="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-1.5" :class="i && 'border-t border-base-200'" data-copy-row>
                            <i class="text-lg shrink-0" :class="r.icon"></i>
                            <span role="cell" class="font-mono break-all min-w-0" x-text="r.name"></span>
                            <span role="cell" class="ml-auto text-base-content/70" x-text="r.label"></span>
                          </div>
                        </template>
                      </div>
                      <ul x-show="copyNote?.notes?.length" class="flex flex-col gap-1" data-copy-notes>
                        <template x-for="(l, i) in copyNote?.notes || []" :key="i">
                          <li class="flex items-start gap-1.5"><i class="ph ph-info text-base-content/50 text-lg shrink-0"></i><span x-text="l"></span></li>
                        </template>
                      </ul>
                      <div class="flex flex-wrap gap-1.5">
                        <button x-show="visibleUnits.length && hasSuppliedBaseline" @click="setDetailTab('changes')" class="btn btn-sm btn-primary">Choose changes</button>
                        <button x-show="copyNote?.fragment && visibleUnits.length" @click="setDetailTab('changes')" class="btn btn-sm">See the changes</button>
                        <button x-show="!copyNote?.exact && !copyNote?.fragment" @click="showLineChanges()" class="btn btn-sm">Show line changes</button>
                        <button x-show="copyNote && !copyNote.fragment && !isRecorded(latestCheck(item.path) || {})" @click="askCheck(latestCheck(item.path))" class="btn btn-sm"
                                x-text="copyNote?.same ? 'Record the match…' : 'Record the difference…'"></button>
                        <button x-show="copyNote && !copyNote.same && !copyNote.fragment && !textEncoding" @click="copyAsDraft()" class="btn btn-sm">Open as draft</button>
                        <button x-show="copyNote?.foreign" @click="matchCopy(copyNote.text)" class="btn btn-sm">Find its file</button>
                      </div>
                    </div>
                  </section>
                  <p x-show="stateOf(item.path).partial" class="text-base" data-partial-state x-text="partialSummary(item.path)"></p>

                  <div :class="shownTab === 'code' ? '' : 'hidden'" class="flex flex-col gap-1.5" data-source>
                    <div class="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm font-medium text-base-content/60">
                      <span x-show="sourceState === 'loading' || baselineBusy" class="loading loading-dots loading-xs opacity-50 ml-1"></span>
                      <div class="grow"></div>
                      <span x-show="textEncoding" class="badge badge-ghost badge-sm">Windows-1252</span>
                      <div class="flex items-center" data-source-tools>
                        <button x-show="item.comparable" @click="openFileDeck(item.path)" class="btn btn-ghost btn-sm btn-square"
                                title="Open in deck" aria-label="Open in deck"><i class="ph ph-cards text-lg"></i></button>
                        <button @click="copyText()" :disabled="!!textBusy" class="btn btn-ghost btn-sm btn-square"
                                title="Copy" aria-label="Copy GitHub text"><i class="ph ph-copy text-lg"></i></button>
                      </div>
                    </div>
                    <div data-source-body>
                      <p :class="sourceState === 'error' ? '' : 'hidden'" class="text-base text-error" x-text="sourceError"></p>
                      <p x-show="baselineNote" class="text-base text-base-content/60 pb-1" x-text="baselineNote"></p>
                      <div :class="[sourceState === 'error' ? 'hidden' : '', dropRing]" data-source-file
                           class="h-[min(36rem,70vh)] @3xl:h-[36rem] rounded-lg border overflow-hidden">
                        <div class="h-full" x-data="powershellFile(fileCtx())"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <!-- A resource seen whole: a module as the functions other code
                   reaches, a form as its window's controls and the events its
                   controller wires to them. The rows shared by both say how the
                   files come together and what loads the resource; each part
                   appears only when the resource has something for it. Every
                   name opens where it lives: a neighbour, a file, or the Code
                   tab at a line. -->
              <template x-if="!item && res">
                <div class="flex flex-col gap-4" data-resource>
                  <div class="flex items-start gap-2">
                    <button @click="selectResource('')" class="btn btn-ghost btn-sm btn-square @3xl:hidden" title="Back to the list">
                      <i class="ph ph-arrow-left text-base"></i></button>
                    <div class="min-w-0 grow flex flex-col gap-0.5">
                      <div class="flex flex-wrap items-center gap-x-2">
                        <i class="ph text-lg text-base-content/50" :class="resIcon(res)"></i>
                        <h3 class="text-lg font-semibold truncate" x-text="res.name"></h3>
                        <span class="text-base text-base-content/70 text-balance" x-text="resFigure" data-resource-figure></span>
                      </div>
                      <div class="text-sm font-mono text-base-content/60 break-all" x-text="resDestination" data-destination></div>
                    </div>
                  </div>

                  <!-- How the files come together. -->
                  <div class="flex flex-col gap-1.5 text-base" data-resource-files>
                    <template x-for="row in resFileRows" :key="row.label">
                      <div class="flex flex-col gap-0.5 @md:flex-row @md:items-baseline @md:gap-3">
                        <span class="text-sm font-medium text-base-content/60 @md:w-20 shrink-0" x-text="row.label"></span>
                        <div class="flex flex-col gap-1 min-w-0">
                          <template x-for="(line, li) in row.lines" :key="li">
                            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
                              <i x-show="line.under" class="ph ph-arrow-elbow-down-right text-base-content/40 shrink-0 self-center"></i>
                              <template x-for="f in line.files" :key="f.item.path">
                                <span class="inline-flex items-baseline gap-1 min-w-0" data-resource-file>
                                  <a :href="hrefFor(f.item.path)" @click="go($event, () => select(f.item.path))" class="link link-hover font-mono inline-flex items-center gap-1 min-w-0 text-left"
                                     :data-title-tip-lead="f.item.rel" :data-title-tip="fileTip(f.item.path)">
                                    <i class="shrink-0" :class="statusOf(f.item.path).cls"></i><span class="break-all" x-text="f.item.name"></span></a>
                                  <span x-show="f.join" class="text-base-content/50" x-text="f.join"></span>
                                </span>
                              </template>
                              <span x-show="line.note" class="text-sm text-base-content/60" x-text="line.note"></span>
                            </div>
                          </template>
                        </div>
                      </div>
                    </template>
                  </div>

                  <!-- Each distinct untested limit once, with the files it
                       covers, two lines until tapped: the files are the subject
                       here, and each file's own view gives its limit whole. -->
                  <div x-show="resPending.length" class="flex flex-col gap-0.5 @md:flex-row @md:items-baseline @md:gap-3 text-base" data-resource-pending>
                    <span class="text-sm font-medium text-base-content/60 @md:w-20 shrink-0">To install</span>
                    <div class="flex flex-col gap-2 min-w-0 border-l-2 border-warning pl-3">
                      <template x-for="(p, pi) in resPending" :key="p.limit">
                        <button @click="resMore = { ...resMore, ['limit' + pi]: !resMore['limit' + pi] }" class="text-left min-w-0">
                          <span x-show="res.files.length > 1" class="block font-mono text-sm text-base-content/60 break-all" x-text="p.files.map(i => i.name).join(', ')"></span>
                          <span class="text-base-content/80 text-pretty" :class="resMore['limit' + pi] ? 'block' : 'line-clamp-2'" x-text="p.limit || 'Pending adoption'"></span>
                        </button>
                      </template>
                    </div>
                  </div>

                  <!-- What loads this resource and what it loads. -->
                  <div x-show="loadEdges.length" class="flex flex-col gap-1.5" data-resource-neighbours>
                    <template x-for="side in resSides" :key="side.label">
                      <div class="flex flex-col gap-0.5 @md:flex-row @md:items-baseline @md:gap-3 text-base">
                        <span class="text-sm font-medium text-base-content/60 @md:w-20 shrink-0" x-text="side.label"></span>
                        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
                          <template x-for="n in side.shown" :key="n.key">
                            <span class="inline-flex flex-wrap items-baseline gap-x-1 min-w-0 max-w-full" data-neighbour>
                              <a :href="neighbourHref(n)" @click="go($event, () => goNeighbour(n))" class="link link-hover inline-flex items-center gap-1 min-w-0 text-left" :class="!n.resource && 'font-mono'"
                                 :data-title-tip-lead="neighbourLead(n)" :data-title-tip="neighbourTip(n)">
                                <i class="ph text-base-content/50 shrink-0" :class="neighbourIcon(n)"></i><span class="break-all" x-text="n.label"></span></a>
                              <span class="text-sm text-base-content/50" x-text="n.how.join(', ')"></span>
                            </span>
                          </template>
                          <button x-show="side.hidden" @click="resMore = { ...resMore, [side.label]: true }" class="link link-hover text-sm text-base-content/60" x-text="'+' + side.hidden + ' more'"></button>
                          <span x-show="!side.list.length" class="text-base-content/50" x-text="side.empty"></span>
                        </div>
                      </div>
                    </template>
                  </div>

                  <p x-show="resError" class="text-base text-error" x-text="resError"></p>

                  <!-- A module: its functions by how far their callers reach. -->
                  <template x-if="res.area === 'Modules'">
                    <div class="flex flex-col gap-3" data-resource-functions>
                      <div class="flex items-center gap-2 text-sm font-medium text-base-content/60">
                        <span>Functions</span>
                        <span class="font-mono text-xs" x-text="resFunctionCount"></span>
                        <span x-show="resBusy" class="inline-flex items-center gap-1.5 text-xs font-normal">
                          <span class="loading loading-dots loading-xs"></span>
                          <span class="tabular-nums" x-text="'reading callers ' + resProgress.done + '/' + resProgress.total"></span></span>
                        <span x-show="!resBusy && resUnread" class="text-xs font-normal text-warning" x-text="resUnread + (resUnread === 1 ? ' file' : ' files') + ' unread; their calls are not counted'"></span>
                      </div>
                      <template x-for="g in resReachGroups" :key="g.key">
                        <div class="flex flex-col" :data-reach="g.key">
                          <div class="text-xs leading-6 uppercase tracking-wider text-base-content/50" x-text="g.label + ' · ' + g.list.length"></div>
                          <!-- Called from outside: one row each, with its callers,
                               which open the call site. -->
                          <template x-if="g.key === 'outside'">
                            <div class="flex flex-col gap-y-1 @md:grid @md:gap-x-4" :class="resMultiFile ? '@md:grid-cols-[max-content_max-content_minmax(0,1fr)]' : '@md:grid-cols-[max-content_minmax(0,1fr)]'">
                              <template x-for="f in g.list" :key="f.path + f.name">
                                <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-base @md:contents" data-function>
                                  <a :href="hrefFor(f.path)" @click="go($event, () => openAt(f.path, f.line))" class="link link-hover font-mono font-medium text-left break-all"
                                     :data-title-tip-lead="f.file + ', line ' + f.line" :data-title-tip="paramsTip(f)" x-text="f.name"></a>
                                  <template x-if="resMultiFile"><span class="font-mono text-sm text-base-content/50" x-text="stem(f.file)"></span></template>
                                  <span class="inline-flex flex-wrap items-baseline gap-x-3 gap-y-0.5 min-w-0">
                                    <template x-for="o in shownCallers(f)" :key="o.key">
                                      <a :href="hrefFor(o.calls[0].path)" @click="go($event, () => openAt(o.calls[0].path, o.calls[0].line))" class="link link-hover inline-flex items-center gap-1 min-w-0 text-left" :class="!o.resource && 'font-mono'"
                                         :data-title-tip-lead="callLead(o)" :data-title-tip="o.calls[0].text || 'line ' + o.calls[0].line" data-caller>
                                        <i class="ph text-sm text-base-content/50 shrink-0" :class="neighbourIcon(o)"></i><span class="break-all" x-text="o.label"></span></a>
                                    </template>
                                    <button x-show="f.outside.length > shownCallers(f).length" @click="resMore = { ...resMore, [f.path + f.name]: true }" class="link link-hover text-sm text-base-content/60" x-text="'+' + (f.outside.length - shownCallers(f).length)"></button>
                                    <span x-show="f.also.length" class="text-sm text-base-content/60" data-also>also in
                                      <template x-for="a in f.also" :key="a"><a :href="hrefFor(a)" @click="go($event, () => select(a))" class="link link-hover font-mono ml-1" :data-title-tip-lead="itemAt(a)?.rel || a" :data-title-tip="fileTip(a)" x-text="baseName(a)"></a></template></span>
                                  </span>
                                </div>
                              </template>
                            </div>
                          </template>
                          <!-- The rest flow as names, under their file when the
                               module has more than one. -->
                          <template x-if="g.key !== 'outside'">
                            <div class="flex flex-col gap-2">
                              <template x-for="run in byFile(g.list)" :key="run.path">
                                <div class="flex flex-col">
                                  <template x-if="resMultiFile"><span class="font-mono text-sm text-base-content/50" x-text="stem(run.file)"></span></template>
                                  <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-base">
                                    <template x-for="f in run.list" :key="f.name + f.line">
                                      <span class="inline-flex items-baseline gap-1">
                                        <a :href="hrefFor(f.path)" @click="go($event, () => openAt(f.path, f.line))" class="link link-hover font-mono break-all text-left"
                                           :data-title-tip-lead="f.file + ', line ' + f.line" :data-title-tip="paramsTip(f)" x-text="f.name"></a>
                                        <span x-show="f.also.length" class="text-sm text-base-content/60" x-text="'also in ' + f.also.map(baseName).join(', ')"></span>
                                      </span>
                                    </template>
                                  </div>
                                </div>
                              </template>
                            </div>
                          </template>
                        </div>
                      </template>
                    </div>
                  </template>

                  <!-- A form: the window's named controls in nesting order,
                       each with the events its controller wires to it. A
                       control the controller never names is dimmed; with no
                       controller nothing is. -->
                  <template x-if="res.area === 'Forms'">
                    <div class="flex flex-col gap-4">
                      <template x-for="p in resForms" :key="p.xaml.path">
                        <div class="flex flex-col" data-resource-controls>
                          <div class="flex flex-wrap items-center gap-x-2 text-sm font-medium text-base-content/60 mb-1">
                            <span x-text="resForms.length > 1 ? p.name : 'Controls'"></span>
                            <span class="font-mono text-xs" x-text="p.wiring.controls.length"></span>
                            <span x-show="p.controller && p.wiring.controls.some(c => !c.touched)" class="font-normal text-xs" data-dim-key>dimmed: never named in code</span>
                            <span x-show="[...p.wiring.window, ...p.wiring.controls.flatMap(c => c.handlers)].some(h => h.via === 'variable')" class="font-normal text-xs" data-by-name>dashed: matched by variable name</span>
                          </div>
                          <template x-if="p.wiring.window.length">
                            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-0.5 text-base" data-control>
                              <span class="font-mono font-medium">Window</span>
                              <span class="inline-flex flex-wrap items-baseline gap-1 min-w-0">
                                <template x-for="h in p.wiring.window" :key="h.line + h.event">
                                  <a :href="hrefFor(p.controller.path)" @click="go($event, () => openAt(p.controller.path, h.line))" class="badge badge-sm badge-outline font-mono cursor-pointer"
                                     :data-title-tip-lead="p.controller.name + ', line ' + h.line" :data-title-tip="h.text || h.event" data-title-tip-bare :class="h.via === 'variable' && 'border-dashed'" x-text="h.event"></a>
                                </template>
                              </span>
                            </div>
                          </template>
                          <template x-for="c in p.wiring.controls" :key="c.line + c.name">
                            <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-0.5 text-base" :class="depthClass(c.depth)" data-control>
                              <a :href="hrefFor(p.xaml.path)" @click="go($event, () => openAt(p.xaml.path, c.line))" class="link link-hover font-mono text-left break-all"
                                      :data-title-tip-lead="p.xaml.name + ', line ' + c.line" :data-title-tip="controlTip(p, c)"
                                      :class="p.controller && !c.touched ? 'text-base-content/40' : c.handlers.length ? 'font-medium' : ''" x-text="c.name"></a>
                              <span class="text-sm text-base-content/50" x-text="c.type"></span>
                              <span class="inline-flex flex-wrap items-baseline gap-1 min-w-0">
                                <template x-for="h in c.handlers" :key="h.line + h.event">
                                  <a :href="hrefFor(p.controller.path)" @click="go($event, () => openAt(p.controller.path, h.line))" class="badge badge-sm badge-outline font-mono cursor-pointer"
                                     :data-title-tip-lead="p.controller.name + ', line ' + h.line" :data-title-tip="h.text || h.event" data-title-tip-bare :class="h.via === 'variable' && 'border-dashed'" x-text="h.event" data-handler></a>
                                </template>
                                <template x-if="p.controller && !c.handlers.length && c.touched"><span class="text-sm text-base-content/50">in code</span></template>
                              </span>
                            </div>
                          </template>
                          <template x-if="p.wiring.elsewhere.length">
                            <div class="flex flex-col text-base mt-2" data-elsewhere>
                              <span class="text-xs leading-6 uppercase tracking-wider text-base-content/50" x-text="'Not in the XAML · ' + p.wiring.elsewhere.length"></span>
                              <div class="flex flex-col gap-0.5 min-w-0">
                                <template x-for="x in p.wiring.elsewhere" :key="x.name">
                                  <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                    <span class="font-mono" x-text="x.name"></span>
                                    <span class="inline-flex flex-wrap items-baseline gap-1 min-w-0">
                                      <template x-for="h in x.handlers" :key="h.line + h.event">
                                        <a :href="hrefFor(p.controller.path)" @click="go($event, () => openAt(p.controller.path, h.line))" class="badge badge-sm badge-outline font-mono cursor-pointer"
                                     :data-title-tip-lead="p.controller.name + ', line ' + h.line" :data-title-tip="h.text || h.event" data-title-tip-bare x-text="h.event"></a>
                                      </template>
                                    </span>
                                  </div>
                                </template>
                              </div>
                            </div>
                          </template>
                          <template x-if="p.wiring.methods.length">
                            <div class="flex flex-col text-base mt-2" data-methods>
                              <span class="text-xs leading-6 uppercase tracking-wider text-base-content/50" x-text="'Methods · ' + p.wiring.methods.length"></span>
                              <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
                                <template x-for="m in p.wiring.methods" :key="m.line + m.name">
                                  <a :href="hrefFor(p.controller.path)" @click="go($event, () => openAt(p.controller.path, m.line))" class="link link-hover font-mono break-all text-left"
                                         :data-title-tip-lead="p.controller.name + ', line ' + m.line" :data-title-tip="m.text || m.name" x-text="m.name"></a>
                                </template>
                              </div>
                            </div>
                          </template>
                        </div>
                      </template>
                      <div x-show="resBusy && !resForms.length" class="flex justify-center py-6"><span class="loading loading-dots loading-md opacity-30"></span></div>
                    </div>
                  </template>
                </div>
              </template>
            </div>
          </div>
        </div>`,

      init() {
        self = this; root = this.$el;
        addressItem = urlItem();
        onPop = () => { const item = urlItem(); if (item === addressItem) return; addressItem = item; this.follow(item); };
        window.addEventListener('popstate', onPop);
        this.$el.innerHTML = this.template;
        this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
        this.reload();
      },
      destroy() {
        loadGeneration++; textGeneration++; sourceGeneration++; resourceGeneration++;
        if (onPop) window.removeEventListener('popstate', onPop);
        if (shell()) shell().powershellOutpostItem = '';
      },

      get root() { return this.manifest?.root || ''; },
      inApp(path) { return !this.app || !!this.apps.find(a => a.app === this.app)?.paths.has(path); },
      inState(path) { return !this.filter || this.statusOf(path).short === this.filter; },
      inArea(path) { return !this.area || this.areaOf[path] === this.area; },
      // One pill per short label, so two states the list draws alike
      // (a recorded install GitHub has moved past, and a pending update)
      // filter together. A pill exists for every state in the corpus; its
      // count is the files passing the area and application pills.
      get states() {
        const pills = new Map();
        for (const s of K().STATES) {
          const paths = this.items.map(it => it.path).filter(p => this.derived[p]?.state === s);
          if (!paths.length) continue;
          const st = STATUS[s] || STATUS.unknown;
          const pill = pills.get(st.short) || { key: st.short, label: st.short, cls: st.cls, count: 0 };
          pill.count += paths.filter(p => this.inApp(p) && this.inArea(p)).length;
          pills.set(st.short, pill);
        }
        return [...pills.values()];
      },
      get stateTotal() { return this.states.reduce((n, s) => n + s.count, 0); },
      // One pill per application the table names, counting the files that
      // pass the area and state pills.
      get appPills() {
        return this.apps.map(a => ({ key: a.app, label: a.app, icon: APP_ICONS[a.app] || 'ph-app-window',
          count: [...a.paths].filter(p => this.inState(p) && this.inArea(p)).length }));
      },
      // One pill per area, in the manifest's order, counting the files that
      // pass the state and application pills.
      get areaPills() {
        return this.groups.map(g => ({ key: g.area, label: g.area,
          count: g.units.reduce((n, u) => n + u.files.filter(it => this.inState(it.path) && this.inApp(it.path)).length, 0) }));
      },
      get localAreas() { return this.manifest?.localAreas || []; },
      get visibleGroups() {
        if (!this.filter && !this.app && !this.area) return this.groups;
        return this.groups.filter(g => !this.area || g.area === this.area).map(g => ({ ...g, units: g.units
          .map(u => ({ ...u, files: u.files.filter(it => this.inState(it.path) && this.inApp(it.path)) }))
          .filter(u => u.files.length) })).filter(g => g.units.length);
      },
      get hasChanges() { return !!this.baseline && this.diffRows.some(r => r.type !== 'eq'); },

      // ── The resource pane ────────────────────────────────────────────────
      get res() { return this.resourceIndex[this.resource] || null; },
      resourceOfItem(it) { const k = it ? K().resourceKey(it) : ''; return (k && this.resourceIndex[k]) || null; },
      resIcon(r) { return r?.area === 'Forms' ? 'ph-app-window' : 'ph-package'; },
      neighbourIcon(n) { return n.resource ? this.resIcon(n) : n.missing ? 'ph-file-dashed' : 'ph-file-code'; },
      stem(name) { return String(name || '').replace(/\.[^.]+$/, ''); },
      depthClass(depth) { return DEPTH[Math.min(depth || 0, DEPTH.length - 1)]; },
      get resDestination() {
        const r = this.res;
        return !r ? '' : typeof r.installs === 'string' ? this.root + '\\' + r.installs.replace(/\//g, '\\') : r.path;
      },
      get resComposition() { return this.res ? K().composition(this.res, this.loadEdges) : null; },
      get resPending() { return this.res ? K().pendingOf(this.res) : []; },
      get resMultiFile() { return (this.res?.files || []).filter(it => /\.(ps1|psm1)$/i.test(it.name)).length > 1; },
      get resFunctionCount() { return this.resReach ? this.resReach.length : Object.values(this.resFunctions).reduce((n, x) => n + x, 0); },
      // The header's one line of figures: what the resource holds and how
      // much of it waits for the work computer.
      get resFigure() {
        const r = this.res, n = (k, one, many) => k + ' ' + (k === 1 ? one : many);
        if (!r) return '';
        const parts = [n(r.files.length, 'file', 'files')];
        if (r.area === 'Modules' && this.resFunctionCount) parts.push(n(this.resFunctionCount, 'function', 'functions'));
        if (r.area === 'Forms' && this.resForms.length) {
          parts.push(n(this.resForms.reduce((k, p) => k + p.wiring.controls.length, 0), 'control', 'controls'));
          if (this.resForms.some(p => p.controller)) parts.push(n(this.resForms.reduce((k, p) => k + p.wiring.handlers.length, 0), 'handler', 'handlers'));
        }
        const waiting = r.files.filter(it => ['Update pending', 'New file', 'Partly updated'].includes(this.statusOf(it.path).short)).length;
        if (waiting) parts.push(waiting + ' to install');
        return parts.join(' · ');
      },
      // The files in the order they come together: the entry, what it
      // loads, then the rest.
      get resFileOrder() {
        const c = this.resComposition;
        if (!c) return [];
        const first = c.pairs ? c.pairs.flatMap(p => [p.xaml, p.controller]) : [c.entry, ...c.loaded.map(l => l.item)];
        return [...new Set([...first.filter(Boolean), ...this.res.files].map(it => it.path))];
      },
      // How the files come together, as labelled rows: a module's entry with
      // what it dot-sources under it, then code that loads apart or not at
      // all, then the rest; a form's XAML and controller pairs.
      get resFileRows() {
        const r = this.res, c = this.resComposition, f = (item, join = '') => ({ item, join });
        if (!r || !c) return [];
        const rest = c.other.length ? [{ label: 'Other', lines: [{ files: c.other.map(i => f(i)) }] }] : [];
        if (c.pairs) return [{ label: 'Files', lines: c.pairs.map(p => ({ files: p.controller ? [f(p.xaml, '+'), f(p.controller)] : [f(p.xaml)], note: p.controller ? '' : 'no controller' })) }, ...rest];
        if (!c.known || !c.entry) return [{ label: 'Files', lines: [{ files: r.files.map(i => f(i)) }] }];
        const rows = [{ label: 'Files', lines: [{ files: [f(c.entry)] }] }];
        if (c.loaded.length) rows[0].lines.push({ under: true, files: c.loaded.map(l => f(l.item)) });
        if (c.elsewhere.length) rows.push({ label: 'Elsewhere', lines: c.elsewhere.map(e => ({ files: [f(e.item)], note: 'loaded by ' + e.by.map(p => this.baseName(p)).join(', ') })) });
        if (c.unloaded.length) rows.push({ label: 'Not loaded', lines: [{ files: c.unloaded.map(i => f(i)) }] });
        return [...rows, ...rest];
      },
      // Loaded by and Loads, a long side cut to its first eight until asked.
      get resSides() {
        const r = this.res, cap = 8;
        if (!r) return [];
        const n = K().neighbours(r, this.items, this.loadEdges);
        return [{ label: 'Loaded by', list: n.loadedBy, empty: r.area === 'Forms' ? 'no file in the tree names this form' : 'no file in the tree names this module' },
          { label: 'Loads', list: n.loads, empty: '' }]
          .filter(side => side.list.length || side.empty)
          .map(side => {
            const shown = this.resMore[side.label] || side.list.length <= cap + 2 ? side.list : side.list.slice(0, cap);
            return { ...side, shown, hidden: side.list.length - shown.length };
          });
      },
      get resReachGroups() { return REACH.map(g => ({ ...g, list: (this.resReach || []).filter(f => f.reach === g.key) })).filter(g => g.list.length); },
      shownCallers(f) { return this.resMore[f.path + f.name] || f.outside.length <= 5 ? f.outside : f.outside.slice(0, 4); },
      byFile(list) {
        const order = this.resFileOrder, runs = new Map();
        for (const f of list) {
          if (!runs.has(f.path)) runs.set(f.path, { path: f.path, file: f.file, list: [] });
          runs.get(f.path).list.push(f);
        }
        return [...runs.values()].sort((a, b) => order.indexOf(a.path) - order.indexOf(b.path))
          .map(run => ({ ...run, list: run.list.sort((a, b) => a.name.localeCompare(b.name)) }));
      },
      get isPowerShell() { return /\.(ps1|psm1)$/i.test(this.selected); },
      get visibleUnits() { return (this.unitReview?.units || []).filter(u => this.unitFormatting || !u.formatOnly); },
      get hasSuppliedBaseline() {
        const check = this.latestCheck(this.selected), partial = this.stateOf(this.selected).partial;
        return !!this.baseline?.key.startsWith('check:') && this.baseline.text === check?.content && (!partial || check.checkedAt > partial.date);
      },
      get canPrepareUnits() { return !!this.unitReview && this.hasSuppliedBaseline && this.unitSelected.length > 0 && this.item?.installs !== null && this.placeable(this.item).length === 1; },
      get showingChanges() { return this.sourceView === 'changes' && this.hasChanges; },
      // Changes appears for a PowerShell file with something to compare it
      // from; Your copy for any file a copy can be compared with.
      get detailTabs() {
        const it = this.item;
        if (!it) return [];
        const out = [];
        if (this.isPowerShell && (this.baseline || this.unitReview || this.unitBusy))
          out.push({ key: 'changes', label: 'Changes', count: this.visibleUnits.length });
        if (it.comparable) out.push({ key: 'copy', label: 'Your copy', count: 0 });
        out.push({ key: 'code', label: 'Code', count: 0 });
        return out;
      },
      get shownTab() { return this.detailTabs.some(t => t.key === this.detailTab) ? this.detailTab : 'code'; },
      get selectionLine() {
        if (!this.hasSuppliedBaseline) return '';
        const n = this.unitSelected.length;
        return n ? n + ' of ' + this.visibleUnits.length + ' chosen' : 'None chosen';
      },
      get matchHead() {
        const m = this.match;
        if (!m) return '';
        return (m.name ? m.name + ': ' : 'Pasted code: ') + m.units.length + (m.units.length === 1 ? ' block' : ' blocks');
      },
      get matchNew() { return (this.match?.units || []).filter(u => u.verdict === 'new'); },
      get dropRing() { return this.dragging ? 'border-primary ring-2 ring-[var(--color-primary)]' : 'border-base-300'; },
      get item() { return this.items.find(it => it.path === this.selected) || null; },
      get observationsUrl() {
        return window.GithubLinks?.pathUrl ? window.GithubLinks.pathUrl(this.repo, this.observationsPath, this.ref) : '';
      },
      short, when,
      stateOf(path) { return this.derived[path] || { state: 'unknown', label: K().LABELS.unknown, latest: null, history: [] }; },
      // The observations file and the manifest decide the icon. A copy compared on this
      // visit shows in Changes and can be recorded from the menu; until it is,
      // it does not recolour the file (a pasted chunk reads as "differs").
      statusOf(path) { return STATUS[this.stateOf(path).state] || STATUS.unknown; },
      latestCheck(path) { return this.checks.find(c => c.path === path) || null; },
      actionsFor(path) {
        const it = this.items.find(i => i.path === path);
        if (!it) return [];
        const st = this.stateOf(path).state, check = this.latestCheck(path), out = [];
        const n = this.placeable(it).length, many = n > 1;
        if (it.installs !== null) out.push({ key: 'install', label: many ? 'Confirm all ' + n + ' installed…' : 'Confirm installed…', icon: many ? 'ph-checks' : 'ph-check-circle' });
        if (check && !this.isRecorded(check))
          out.push({ key: 'record-check', label: K().matchOf(check) !== 'none' ? 'Record the match…' : 'Record the difference…', icon: 'ph-note-pencil' });
        if (it.comparable && (['changed', 'pending-changed', 'differs', 'differs-changed'].includes(st) || check))
          out.push({ key: 'changes', label: 'Show changes', icon: 'ph-git-diff' });
        if (it.comparable) out.push({ key: 'deck', label: 'Open in deck', icon: 'ph-cards' });
        return out;
      },
      toggleMenu(path) { this.menuFor = this.menuFor === path ? '' : path; },
      async runAction(path, key) {
        this.menuFor = '';
        if (this.selected !== path) this.select(path);
        if (key === 'install') return this.askInstalled();
        if (key === 'record-check') { const c = this.latestCheck(path); if (c) this.askCheck(c); return; }
        if (key === 'changes') {
          if (this.isPowerShell && this.visibleUnits.length) return this.setDetailTab('changes');
          this.setDetailTab('code');
          if (this.hasChanges) this.setSourceView('changes'); else this.wantChanges = true;
          return;
        }
        if (key === 'deck') return this.openFileDeck(path);
      },
      historyOf(it) { return this.stateOf(it.path).history; },
      // ── Dependencies, from the workspace's derived loads table ───────────
      itemAt(path) { return this.items.find(i => i.path === path) || null; },
      loadsOf(it) { return it ? this.loadEdges.filter(e => e.from === it.path) : []; },
      loadedBy(it) { return it ? this.loadEdges.filter(e => e.to === it.path) : []; },
      // What a placement of this file has to carry: itself and every file
      // still pending that it strictly needs (PowerShellOutpost.installSet), less
      // anything with no destination to place it at.
      placeable(it) {
        const set = it ? K().installSet(it.path, this.items, this.loadEdges).filter(x => x.installs !== null) : [];
        return set.length ? set : it ? [it] : [];
      },
      installWith(it) { return this.placeable(it).filter(x => x.path !== it.path); },
      baseName(path) { return String(path).split('/').pop(); },
      checksOf(it) { return this.checks.filter(c => c.path === it.path); },
      isRecorded(c) { return K().isRecorded(c, this.rows); },
      iconOf(it) {
        return { profile: 'ph-user-gear', module: 'ph-package', companion: 'ph-file-code', controller: 'ph-file-code',
          xaml: 'ph-layout', script: 'ph-file-code', resource: 'ph-file' }[it.kind] || 'ph-file';
      },
      destinationOf(g) {
        if (g.installs === undefined) return '';
        return g.installs === null ? 'no outpost destination' : g.installs === '' ? 'outpost root' : g.installs;
      },
      // Where the file goes on the work computer, as a path. A root-level
      // mapping keeps the repository's filename; repository-only material
      // shows its repository path instead.
      destinationOfItem(it) {
        if (it.installs === null) return it.path;
        if (it.installs === '') return this.root + '\\' + it.name;
        return this.root + '\\' + it.installs.replace(/\//g, '\\');
      },
      rowLabel(r) {
        return r.kind === 'installed' ? 'reported installed' : r.kind === 'verified'
          ? (r.match === 'line-endings' ? 'verified, line endings differ' : 'verified from supplied copy') : 'local copy differed';
      },
      // The status and the one date that goes with it: when the pending entry
      // opened, or when the observations file last spoke.
      statusLine(it) {
        const s = this.stateOf(it.path), label = this.statusOf(it.path).label;
        if (it.pendingAdoption?.since) return label + ' · since ' + when(it.pendingAdoption.since);
        if (!s.latest) return label;
        return label + ' · ' + (s.state === 'changed' ? 'installed ' : '') + when(s.latest.date);
      },

      // ── Reads ────────────────────────────────────────────────────────────
      async reload() {
        const s = store();
        const generation = ++loadGeneration;
        const previousRepo = this.repo, previousBlobs = new Map(this.items.map(it => [it.path, it.blobSha]));
        textGeneration++; textCache = null;
        this.resetUnits();
        this.text = ''; this.textBusy = false; this.pending = null;
        this.repo = s.repo; this.ref = s.ref || s.defaultRef || '';
        this.loading = true; this.err = '';
        try {
          if (!s.gh) throw new Error('No repository is open.');
          const gh = Object.create(s.gh);
          gh.repo = this.repo; gh.ref = this.ref;
          const manifestPath = this.project?.powershellOutpost;
          if (!manifestPath) throw new Error('This workspace declares no PowerShell outpost manifest.');
          const fresh = window.GH?.FRESH || { cache: 'no-store' };
          const commits = await gh.req('commits?' + (gh.ref ? 'sha=' + encodeURIComponent(gh.ref) + '&' : '') + 'per_page=1', fresh);
          const revision = commits?.[0]?.sha;
          if (!revision) throw new Error('The selected revision could not be resolved.');
          gh.ref = revision;
          const [mf, tree] = await Promise.all([
            gh.get(manifestPath, fresh),
            gh.req('git/trees/' + revision + '?recursive=1', fresh),
          ]);
          if (tree.truncated) throw new Error('GitHub returned an incomplete tree; the outpost inventory cannot be shown reliably.');
          const manifest = K().manifest(mf.text);
          const observationsPath = manifest.observations || (this.project.path + '/data/observations.csv');
          const [rows, loadsText, usesText, unitText] = await Promise.all([this.readRows(gh, observationsPath),
            this.readOptional(gh, manifest.loads), this.readOptional(gh, manifest.applications), this.readOptional(gh, manifest.unitObservations)]);
          if (generation !== loadGeneration) return;
          this.manifest = manifest; this.revision = revision; this.observationsPath = observationsPath; this.rows = rows;
          this.unitRows = K().unitObservations(unitText);
          this.items = K().inventory({ tree: tree.tree, manifest, projectPath: this.project.path });
          this.lastTransfer = previousRepo === gh.repo ? Object.fromEntries(this.items
            .filter(it => previousBlobs.get(it.path) === it.blobSha && this.lastTransfer[it.path])
            .map(it => [it.path, this.lastTransfer[it.path]])) : {};
          this.groups = K().groups(this.items, manifest);
          this.resourceIndex = Object.fromEntries(K().resources(this.items));
          if (this.resource && !this.resourceIndex[this.resource]) this.resource = '';
          this.areaOf = Object.fromEntries(this.items.map(it => [it.path, it.area]));
          if (this.area && !this.groups.some(g => g.area === this.area)) this.area = '';
          this.loadEdges = K().edges(loadsText, this.project.path);
          this.apps = K().applicationFiles(this.items, K().uses(usesText, this.project.path));
          if (this.app && !this.apps.some(a => a.app === this.app)) this.app = '';
          this.derived = Object.fromEntries(this.items.map(it => [it.path, K().derive(it, rows, this.unitRows)]));
          if (this.selected && !this.items.some(it => it.path === this.selected)) this.select('');
          if (!this.selected && shell()?.powershellOutpostItem && this.items.some(it => it.path === shell().powershellOutpostItem))
            this.selected = shell().powershellOutpostItem;
          if (this.selected) this.loadSource();
          const wanted = shell()?.powershellOutpostItem || '';
          if (!this.selected && !this.resource && wanted.endsWith('/'))
            this.resource = Object.values(this.resourceIndex).find(r => r.path === wanted)?.key || '';
          if (this.resource) this.loadResource();
          addressItem = urlItem();
          this.loadDrafts();
        } catch (e) { if (generation === loadGeneration) this.err = 'Could not read the outpost: ' + (e?.message || e); }
        finally { if (generation === loadGeneration) this.loading = false; }
      },
      // Browser drafts from the file deck, keyed by repo, project and ref.
      loadDrafts() {
        const W = window.PowerShellWorkspace;
        if (!W?.loadDrafts || !this.repo) return Promise.resolve();
        return draftsLoad = (async () => {
          try {
            const rows = (await W.loadDrafts({ repo: this.repo, project: this.project.path, ref: this.ref || 'main' })).filter(d => W.changed(d));
            draftRecords.clear(); for (const d of rows) draftRecords.set(d.path, d);
            this.drafts = Object.fromEntries(rows.map(d => [d.path, true]));
            this.draftList = rows;
          } catch { draftRecords.clear(); this.drafts = {}; this.draftList = []; }
        })();
      },
      reviewPublish() {
        this.publishOpen = !this.publishOpen; this.publishError = '';
        this.publishBranch ||= 'wps/edit-' + new Date().toISOString().slice(0, 10);
        this.publishMessage ||= 'Update PowerShell files via Web Tools';
      },
      // A draft whose file is unchanged on GitHub since it began is carried
      // onto the current revision; one whose file moved is refused, since
      // publishing it would silently drop the newer GitHub change.
      async publish() {
        const W = window.PowerShellWorkspace;
        if (this.publishing || !W?.publish) return;
        this.publishing = true; this.publishError = '';
        try {
          const moved = this.draftList.filter(d => d.baseBlob && this.items.find(it => it.path === d.path)?.blobSha !== d.baseBlob);
          if (moved.length) throw new Error('GitHub changed ' + moved.map(d => d.path.split('/').pop()).join(', ')
            + ' after its draft began. Open it, copy the draft text, discard the draft and reapply the edit.');
          const drafts = this.draftList.map(d => ({ ...d, baseRevision: this.revision }));
          const gh = new window.GH({ token: window.TOKEN, repo: this.repo }); gh.ref = this.ref || 'main';
          this.published = await W.publish({ gh, baseRevision: this.revision, branch: this.publishBranch.trim(), message: this.publishMessage.trim(), drafts });
          this.publishOpen = false;
        } catch (e) {
          this.publishError = e?.commit
            ? 'GitHub did not confirm the branch. Check ' + this.repo + '/tree/' + e.branch + ' before trying another name. The drafts are kept. ' + (e.message || e)
            : 'Not published: ' + (e?.message || e);
        } finally { this.publishing = false; }
      },

      // ── The file deck ────────────────────────────────────────────────────
      // One PowerShell or XAML file per slide (alpineComponents/powershell-
      // file.js), over the files this list is showing, so a swipe moves to the
      // next one here. The list stays the finder; the deck reads and edits.
      async openFileDeck(path) {
        const W = window.PowerShellWorkspace;
        const shown = [...new Map(this.visibleGroups.flatMap(g => g.units.flatMap(u => u.files))
          .filter(it => it.comparable).map(it => [it.path, it])).values()];
        const files = shown.some(it => it.path === path) ? shown : this.items.filter(it => it.comparable);
        const start = files.findIndex(it => it.path === path);
        if (start < 0) return;
        try { if (!window.swipeDeck && window.gh?.load) await window.gh.load('kits/swipe-deck.js'); }
        catch (e) { this.err = 'The file deck could not load: ' + (e?.message || e); return; }
        if (!window.swipeDeck || !W?.readFile) { this.err = 'The file deck could not load.'; return; }
        // The inline pane steps aside while the deck edits the same drafts.
        const card = inline?.cards.get('inline');
        if (card?.editing) card.setEditing(false);
        let drafts = new Map();
        try { drafts = new Map((await W.loadDrafts({ repo: this.repo, project: this.project.path, ref: this.ref || 'main' })).map(d => [d.path, d])); }
        catch { /* the slides still read; persist() reports a store that cannot write */ }
        let handle = null, current = start;
        const ctx = this.fileContext({
          revision: this.revision, drafts,
          get handle() { return handle; },
          active: () => current,
          has: p => files.some(it => it.path === p),
          go: p => { const i = files.findIndex(it => it.path === p); if (i >= 0) handle?.deck.go(i); },
          lockSwipe: on => { if (handle) handle.deck.track.style.overflowX = on ? 'hidden' : ''; },
          publish: () => { handle?.close(); this.openPublish(); },
        });
        handle = window.swipeDeck.open({
          count: files.length, start, slideScroll: false, keep: 1, icon: 'ph-code', innerClass: 'w-full max-w-6xl mx-auto',
          title: files[start].name, subtitle: files[start].area,
          index: i => ({ title: files[i].name, subtitle: files[i].area, group: files[i].area }),
          render: (i, slide) => {
            const el = document.createElement('div');
            el.className = 'h-full min-h-0';
            el.__psFile = { ctx, item: files[i], index: i };
            el.setAttribute('x-data', 'powershellFile()');
            slide.replaceChildren(el);
            window.Alpine.initTree(el);
          },
          release: (i, slide) => { const el = slide.firstElementChild; if (el) window.Alpine.destroyTree(el); },
          onSlide: i => {
            current = i;
            for (const [j, card] of ctx.cards) if (j !== i && card.editing) card.setEditing(false);
            ctx.cards.get(i)?.header();
          },
          onClose: () => {
            for (const c of ctx.cards.values()) if (c.editing) c.setEditing(false);
            this.loadDrafts().then(() => { if (this.item) inline?.cards.get('inline')?.show(this.item, true); });
          },
        });
        this.menuFor = '';
      },
      openPublish() { this.loadDrafts().then(() => { if (this.draftList.length && !this.publishOpen) this.reviewPublish(); }); },
      // What the deck's slides and the inline pane share: the reader, the
      // Theme.xaml keys a XAML file is checked against, and the PowerShell outpost view's
      // own records. `extra` supplies the host's part, getters included.
      fileContext(extra) {
        const themes = new Map(), texts = new Map();
        const themeItem = () => this.items.find(it => /(?:^|\/)Theme\.xaml$/i.test(it.path));
        const themeFor = item => { const t = themeItem(); return t && t.path !== item.path ? t : null; };
        const ctx = {
          repo: this.repo, ref: this.ref || 'main', project: this.project.path, root: this.root, cards: new Map(),
          read: item => this.readItem(item),
          // Theme.xaml's keys: its draft when one exists, else its pinned source.
          theme: item => {
            const t = themeFor(item); if (!t) return Promise.resolve();
            if (!themes.has(t.blobSha)) themes.set(t.blobSha, ctx.read(t).then(f => { texts.set(t.blobSha, f.text); }));
            return themes.get(t.blobSha);
          },
          themeText: item => { const t = themeFor(item); return t ? (ctx.drafts.get(t.path)?.text ?? texts.get(t.blobSha) ?? null) : null; },
        };
        return Object.defineProperties(ctx, Object.getOwnPropertyDescriptors(extra));
      },
      // The inline pane's context, built once per detail column. Revision and
      // selection are read live, since the column outlives both.
      fileCtx() {
        const view = self;
        return inline = view.fileContext({
          get repo() { return view.repo; }, get ref() { return view.ref || 'main'; }, get revision() { return view.revision; },
          drafts: draftRecords,
          ready: () => draftsLoad,
          selected: () => view.item,
          active: () => 'inline',
          has: p => view.items.some(it => it.path === p && it.comparable),
          go: p => view.select(p),
          publish: () => view.openPublish(),
          onDraft: () => { view.loadDrafts(); },
          view: () => view.sourceView,
          onPane: p => { view.sourceView = p === 'work' ? 'changes' : 'code'; },
          shown: state => { view.sourceState = state; view.revealLine(); },
          workCopy: () => view.hasChanges ? { label: view.baseline.label, rows: view.diffRows } : null,
        });
      },
      // UTF-8 when it decodes; otherwise the verified bytes read as
      // Windows-1252, which is what Windows PowerShell 5.1 assumes for a file
      // with no BOM. The file component keeps such a file read-only.
      readItem(item) {
        const W = window.PowerShellWorkspace, repo = this.repo, ref = this.ref || 'main', revision = this.revision;
        const key = [repo, revision, item.path, item.blobSha].join('\n');
        if (!reads.has(key)) {
          if (!W?.readFile) return Promise.reject(new Error('The PowerShell workspace kit did not load.'));
          const gh = new window.GH({ token: window.TOKEN, repo }); gh.ref = ref;
          const args = { gh, path: item.path, revision, blobSha: item.blobSha };
          reads.set(key, W.readFile(args).then(f => ({ ...f, encoding: 'utf-8' }), async e => {
            if (!/not UTF-8/.test(e?.message || '') || !W.readBytes) throw e;
            const f = await W.readBytes(args);
            return { text: new TextDecoder('windows-1252').decode(f.bytes), sha: f.sha, revision: f.revision, encoding: 'windows-1252', bytes: f.bytes };
          }).catch(e => { reads.delete(key); throw e; }));
        }
        return reads.get(key);
      },

      // A derived table the manifest names. Absent or unnamed reads as empty:
      // the PowerShell outpost view works without it and only loses what it adds.
      async readOptional(gh, path) {
        if (!path) return '';
        try { return (await gh.get(path, window.GH?.FRESH)).text; }
        catch (e) { if (e?.status === 404) return ''; throw e; }
      },
      async readRows(gh, observationsPath) {
        let text = '';
        try { text = (await gh.get(observationsPath, window.GH?.FRESH)).text; }
        catch (e) { if (e?.status !== 404) throw e; }
        return K().observations(text);
      },

      // ── Selection ────────────────────────────────────────────────────────
      select(path) {
        this.resource = ''; resourceGeneration++; wantLine = null;
        this.resetUnits();
        textGeneration++; textCache = null;
        this.selected = path; this.compareError = ''; this.compareRetry = null; this.dragging = false;
        this.pending = null; this.recorded = null; this.recordError = ''; this.recordNote = ''; this.text = ''; this.textBusy = false;
        this.source = ''; this.sourceView = 'code'; this.wantChanges = false; this.menuFor = '';
        this.baseline = null; this.earlier = null; this.baselineNote = ''; this.diffRows = [];
        this.detailTab = 'code'; this.tabPicked = false; this.changeAt = 0; this.copyNote = null;
        if (shell()) { shell().powershellOutpostItem = path; if (!following) shell().syncUrl?.(); }
        addressItem = urlItem();
        this.loadSource();
      },
      // A module or form opened whole. Its address is the folder's path, so
      // the shell's &item= names it as it names a file.
      selectResource(key) {
        if (this.selected) this.select('');
        this.resource = this.resourceIndex[key] ? key : ''; this.menuFor = '';
        if (shell()) { shell().powershellOutpostItem = this.res?.path || ''; if (!following) shell().syncUrl?.(); }
        addressItem = urlItem();
        this.loadResource();
      },
      // ── Links ─────────────────────────────────────────────────────────────
      // Every file, module and form name is a link to the address that selects
      // it: this address with `item` replaced, which is what syncUrl writes on
      // a click. A plain click stays in the view; a modified or middle click is
      // the browser's, so a name opens in a new tab or copies like any link.
      hrefFor(item) {
        try {
          const u = new URL(location.href);
          if (item) u.searchParams.set('item', item); else u.searchParams.delete('item');
          return u.pathname + u.search + u.hash;
        } catch { return null; }
      },
      neighbourHref(n) { return n.resource ? this.hrefFor(this.resourceIndex[n.key]?.path) : n.missing ? null : this.hrefFor(n.files[0]); },
      go(e, fn) {
        if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); fn();
      },
      // Back and Forward move the selection: the address is the selection, so
      // the view follows the item it names and pushes nothing new. The shell
      // restores what the address names, but a bare list names no item for it
      // to clear, so the view reads the address itself (onPop, from init).
      follow(item) {
        item = item || '';
        if (this.loading || item === (this.selected || this.res?.path || '')) return;
        following = true;
        try {
          if (!item) this.selected ? this.select('') : this.selectResource('');
          else if (item.endsWith('/')) { const r = Object.values(this.resourceIndex).find(x => x.path === item); if (r) this.selectResource(r.key); }
          else if (this.items.some(it => it.path === item)) this.select(item);
        } finally { following = false; }
      },
      // ── Title-tips: the one fact a click would go and find ────────────────
      fileTip(path) { const it = this.itemAt(path); return it ? this.statusOf(path).label + ' · ' + this.destinationOfItem(it) : 'not in the repository'; },
      resourceTip(r) { return r ? r.files.length + (r.files.length === 1 ? ' file' : ' files') + (typeof r.installs === 'string' ? ' · ' + this.root + '\\' + r.installs.replace(/\//g, '\\') : '') : ''; },
      paramsTip(f) { return f.params?.length ? f.params.join(', ') : 'no parameters'; },
      callLead(o) { const c = o.calls[0]; return this.baseName(c.path) + ', line ' + c.line + (o.calls.length > 1 ? ', and ' + (o.calls.length - 1) + ' more' : ''); },
      neighbourLead(n) { return n.resource ? n.label + (n.area === 'Forms' ? ' form' : ' module') : this.itemAt(n.files[0])?.rel || n.files[0]; },
      neighbourTip(n) {
        const verb = { 'dot-source': 'dot-sources', import: 'imports', form: 'opens', tool: 'adds', call: 'calls into' };
        // A call's evidence names every function called; the first and a count
        // keep the tip to its line.
        const short = ev => { const [at, names] = String(ev || '').split(': '), list = (names || '').split(/\s+/).filter(Boolean);
          return at + (list.length ? ': ' + list[0] + (list.length > 1 ? ' and ' + (list.length - 1) + ' more' : '') : ''); };
        const said = (n.edges || []).slice(0, 3).map(e => this.baseName(e.from) + ' ' + (verb[e.how] || e.how) + ' ' + this.baseName(e.to) + (e.evidence ? ', ' + short(e.evidence) : ''));
        const more = (n.edges || []).length > 3 ? ['and ' + (n.edges.length - 3) + ' more'] : [];
        return [...said, ...more].join('; ') + (n.resource || n.missing ? '' : ' · ' + this.statusOf(n.files[0]).label);
      },
      controlTip(p, c) {
        if (!p.controller) return c.type;
        return c.type + ' · ' + (c.handlers.length ? 'wired: ' + c.handlers.map(h => h.event).join(', ') : c.touched ? 'named in code, no handler' : 'never named in code');
      },
      goNeighbour(n) {
        if (n.resource) return this.selectResource(n.key);
        if (this.itemAt(n.files[0])) this.select(n.files[0]);
      },
      // Open a file at a line once its editor is up (revealLine, from the
      // inline pane's shown()). The Code tab is chosen, so a late unit
      // review does not move the reader off it.
      openAt(path, line) {
        if (!this.itemAt(path)) return;
        this.select(path); this.detailTab = 'code'; this.tabPicked = true;
        wantLine = line ? { path, line } : null;
      },
      revealLine() {
        if (!wantLine || wantLine.path !== this.selected || this.sourceState !== 'editor') return;
        const line = wantLine.line; wantLine = null;
        this.$nextTick(() => {
          const el = root?.querySelector('[data-source-file] [x-data]');
          (el && window.Alpine.$data(el))?.goLine?.(line);
        });
      },
      // A form reads its XAML and controller; a module reads its own files
      // first, for the file rows, then every PowerShell file in the
      // workspace, for who calls each function. Reads are the source pane's
      // verified reads, and the readings are kept by blob.
      async loadResource() {
        const gen = ++resourceGeneration, res = this.res, L = window.PowerShellLanguage;
        this.resReach = null; this.resForms = []; this.resFunctions = {}; this.resError = ''; this.resUnread = 0; this.resMore = {};
        if (!res) { this.resBusy = false; return; }
        if (!L?.formWiring) { this.resError = 'The PowerShell language kit did not load.'; return; }
        this.resBusy = true;
        try {
          if (res.area === 'Forms') {
            const out = [];
            for (const p of K().composition(res, this.loadEdges).pairs) {
              const xaml = (await this.readItem(p.xaml)).text, ctl = p.controller ? (await this.readItem(p.controller)).text : null;
              if (gen !== resourceGeneration) return;
              out.push({ name: p.name, xaml: p.xaml, controller: p.controller,
                wiring: ctl !== null ? L.formWiring(ctl, xaml) : { controls: L.inspect(xaml, p.xaml.path).controls.map(c => ({ ...c, handlers: [], touched: false })), window: [], elsewhere: [], methods: [], handlers: [] } });
            }
            this.resForms = out;
            return;
          }
          const code = it => /\.(ps1|psm1)$/i.test(it.name), mine = {};
          for (const it of res.files.filter(code)) mine[it.path] = (await this.factsOf(it)).functions.length;
          if (gen !== resourceGeneration) return;
          this.resFunctions = mine;
          const files = this.items.filter(code), facts = new Map();
          let next = 0, unread = 0;
          this.resProgress = { done: 0, total: files.length };
          const worker = async () => {
            while (next < files.length && gen === resourceGeneration) {
              const it = files[next++];
              try { facts.set(it.path, await this.factsOf(it)); } catch { unread++; }
              if (gen === resourceGeneration) this.resProgress = { ...this.resProgress, done: this.resProgress.done + 1 };
            }
          };
          await Promise.all(Array.from({ length: 6 }, worker));
          if (gen !== resourceGeneration) return;
          this.resUnread = unread;
          this.resReach = K().reach(res, this.items, facts);
        } catch (e) { if (gen === resourceGeneration) this.resError = 'Could not read this resource: ' + (e?.message || e); }
        finally { if (gen === resourceGeneration) this.resBusy = false; }
      },
      factsOf(it) {
        const L = window.PowerShellLanguage, key = [this.repo, this.revision, it.path, it.blobSha].join('\n');
        if (!factCache.has(key)) factCache.set(key, this.readItem(it).then(f => ({ functions: L.functions(f.text), calls: L.calls(f.text) }))
          .catch(e => { factCache.delete(key); throw e; }));
        return factCache.get(key);
      },
      target() {
        const it = this.item;
        return it ? { repo: this.repo, ref: this.revision || this.ref, path: it.path } : null;
      },

      // ── Compare a work copy, in memory ───────────────────────────────────
      // Four intakes, one flow: the clipboard through the app's Paste, a
      // page-wide paste or drop (the app hands both here: app/index.html
      // openCorrespondence), a chosen file, and a drop on the column. The copy
      // is compared with the GitHub text and becomes the base for Changes. It
      // is not stored: it lasts until the page reloads, and only a confirmed
      // "Record the match" or "Record the difference" makes it durable.
      compareClipboard() {
        this.compareError = ''; this.compareRetry = null;
        if (shell()?.pasteAnywhere) return shell().pasteAnywhere();
        this.compareError = 'The app paste action is unavailable. Choose a file or drop one here.';
      },
      async comparePicked(e) {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) await this.compareFile(file, 'file picker');
      },
      async compareDrop(e) {
        if (!this.item?.comparable) return;
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length === 1) await this.compareFile(files[0], 'drop');
        else if (files.length > 1) this.compareError = 'Drop one copy for the selected file.';
        else {
          const text = e.dataTransfer?.getData('text') || '';
          if (!text || !this.item) return;
          await this.takeCopy(this.target(), text, this.item.name, 'drop');
        }
      },
      async takeCopy(target, text, name = '', source = 'paste', { bomless = false } = {}) {
        if (target?.path && target.path !== this.selected) {
          if (!this.items.some(it => it.path === target.path)) return false;
          this.select(target.path);
        }
        const selection = this.captureSelection(), item = this.item;
        if (!selection || !item?.comparable || typeof text !== 'string' || !text.length) return false;
        this.compareError = ''; this.compareRetry = null;
        try {
          const github = await this.fetchText(selection, { quiet: true });
          const sha256 = await K().digest(text);
          if (!this.sameSelection(selection)) return true;
          const exact = text === github;
          const lineEndingsOnly = !exact && text.replace(/\r\n?/g, '\n') === github.replace(/\r\n?/g, '\n');
          const whitespaceOnly = !exact && !lineEndingsOnly && K().whitespaceOnly(text, github);
          const copy = { id: 'copy-' + (++copyCount), path: item.path, revision: selection.revision, blobSha: item.blobSha,
            incomingSha256: sha256, exact, lineEndingsOnly, whitespaceOnly, source, incomingName: name || item.name,
            checkedAt: new Date().toISOString(), content: text };
          // What the work computer was last known to hold, so the copy reads
          // against it as well as against GitHub.
          if (!this.earlier) {
            const { earlier } = await this.loadEarlier(selection, item, this.stateOf(item.path).history[0] || null);
            if (!this.sameSelection(selection)) return true;
            this.earlier = earlier;
          }
          const note = await this.describeCopy(item, github, text, { exact, lineEndingsOnly, whitespaceOnly, bomless });
          if (!this.sameSelection(selection)) return true;
          // A few blocks pasted from a larger file say which version those
          // blocks are and nothing about the rest: they do not become the
          // base a selective update builds on, nor an observation to record.
          if (!note.fragment) {
            this.checks = [copy, ...this.checks.filter(c => c.path !== item.path)];
            if (this.source) await this.loadBaseline(false);
          }
          this.copyNote = note;
          this.detailTab = 'copy'; this.tabPicked = true;
        } catch (e) { if (this.sameSelection(selection)) { this.compareError = e?.message || String(e); this.detailTab = 'copy'; } }
        return true;
      },
      // What a supplied copy holds, said before any line diff, in the
      // adopter's direction: block by block against GitHub now and, when it
      // is known, the version the work computer last held (this.earlier), by
      // PowerShellUnits.versions, so the names are the Changes cards' own.
      // Without the parser it falls back to PowerShellLanguage's function
      // reading against GitHub alone. Windows PowerShell 5.1 problems the copy
      // brings, and a missing BOM, are notes beside it.
      async describeCopy(item, github, text, { exact, lineEndingsOnly, whitespaceOnly = false, bomless = false }) {
        let signed = '';
        try { signed = window.FileCorrespondence?.declaration?.(text) || ''; } catch {}
        const lead = signed && signed === item.path ? 'Signed copy of ' + item.name + ': ' : 'This copy ';
        const L = window.PowerShellLanguage, st = L?.compareStructure ? L.compareStructure(github, text, item.path) : null;
        const same = exact || lineEndingsOnly || whitespaceOnly;
        let title = exact ? lead + 'matches GitHub exactly.' : lineEndingsOnly ? lead + 'matches GitHub except for line endings.'
          : whitespaceOnly ? lead + 'matches GitHub except for spaces at line ends or blank lines at either end.' : lead + 'differs from GitHub.';
        const notes = [], names = list => list.map(f => f.name || f).join(', ');
        let rows = [], fragment = false, foreign = false, against = '';
        // Not a difference, but Windows PowerShell 5.1 reads a file with no
        // BOM as Windows-1252, which garbles its non-ASCII characters.
        if (bomless) {
          const n = (text.match(/[^\x00-\x7f]/g) || []).length;
          notes.push('Saved without a byte order mark: Windows PowerShell 5.1 will read its ' + n
            + (n === 1 ? ' non-ASCII character' : ' non-ASCII characters') + ' as Windows-1252. Save it from the ISE, or as UTF-8 with BOM.');
        }
        if (!same && st?.kind === 'xaml') {
          if (st.controls.added.length) notes.push('Named controls only in this copy: ' + names(st.controls.added));
          if (st.controls.removed.length) notes.push('Named controls GitHub adds: ' + names(st.controls.removed));
          if (st.resources.added.length) notes.push('Resource keys only in this copy: ' + names(st.resources.added));
          if (st.resources.removed.length) notes.push('Resource keys GitHub adds: ' + names(st.resources.removed));
          if (!notes.length) notes.push('No named control or resource key changed; the difference is in layout or values.');
        }
        if (!same && st?.kind === 'powershell') {
          const M = window.PowerShellMatch;
          if (M) foreign = M.containment(M.grams(M.tokens(text)), M.grams(M.tokens(github))) < M.WEAK;
          let v = null;
          try { if (window.PowerShellUnits?.versions) v = await window.PowerShellUnits.versions({ copy: text, github, earlier: this.earlier?.text ?? null }); }
          catch { v = null; }
          if (v) {
            const known = !!this.earlier;
            fragment = v.fragment;
            const list = fragment ? v.rows.filter(r => r.inCopy) : v.rows;
            if (!fragment && v.outside !== 'same') list.push({ key: 'outside', kind: 'Other', name: 'Lines outside named blocks', status: v.outside });
            rows = this.copyRows(list);
            if (known) against = 'Earlier: ' + this.earlier.label + ' · GitHub ' + short(this.revision);
            const count = (...keys) => list.filter(r => keys.includes(r.status)).length;
            const changes = count('updated', 'behind', 'removed', 'new'), has = count('updated'), own = count('local', 'extra', 'missing', 'differs');
            const blocks = n => n + (n === 1 ? ' block' : ' blocks');
            if (fragment) title = lead + 'holds ' + v.present + ' of the ' + blocks(v.total) + ' in ' + item.name + '. Only those are compared.';
            else if (known && changes) {
              if (!has && !own) title = lead + 'is the earlier version: none of GitHub\'s ' + (changes === 1 ? 'change is' : changes + ' changes are') + ' in it.';
              else title = lead + 'has ' + has + ' of GitHub\'s ' + changes + (changes === 1 ? ' change' : ' changes')
                + (own ? ', and ' + blocks(own) + ' of its own.' : '.');
            } else if (own) title = lead + 'differs from GitHub in ' + blocks(own) + '.';
          } else {
            // No parser: the function reading against GitHub alone.
            rows = this.copyRows([
              ...st.changed.map(f => ({ key: 'f:' + f.name, name: f.name, status: 'differs' })),
              ...st.removed.map(f => ({ key: 'f:' + f.name, name: f.name, status: 'missing' })),
              ...st.added.map(f => ({ key: 'f:' + f.name, name: f.name, status: 'extra' })),
              ...(st.outsideChanged ? [{ key: 'outside', name: 'Lines outside functions', status: 'differs' }] : []),
            ]);
            if (st.unchanged) notes.push(st.unchanged + (st.unchanged === 1 ? ' other function is' : ' other functions are') + ' the same as GitHub.');
          }
          for (const d of st.newProblems.slice(0, 3)) notes.push('New 5.1 problem at line ' + d.line + ': ' + d.message);
        }
        const icon = same ? 'ph-check-circle text-success' : fragment ? 'ph-puzzle-piece text-base-content/60' : 'ph-git-diff text-warning';
        return { path: item.path, title, against, icon, rows, notes, exact, same, text, signed: signed === item.path, fragment, foreign };
      },
      // Each row in the adopter's words, the blocks to act on first. The
      // icons are the shared sync tones where one fits.
      copyRows(list) {
        const I = window.SyncStatus.ICON;
        const ROW = {
          behind: ['Earlier version; GitHub changed it', I.behind], new: ['GitHub adds it', I.new], removed: ['GitHub removed it', I.behind],
          local: ['Edited in this copy', 'ph ph-pencil-simple text-base-content/60'], differs: ['Differs from GitHub', 'ph ph-not-equals text-warning'],
          missing: ['Not in this copy', 'ph ph-minus-circle text-warning'], extra: ['Only in this copy', 'ph ph-plus text-base-content/60'],
          updated: ['Has GitHub\'s change', I.current], same: ['Same as GitHub', I.assumed],
        };
        const order = Object.keys(ROW);
        return list.map(r => ({ key: r.key, name: r.name, status: r.status, label: ROW[r.status][0], icon: ROW[r.status][1] }))
          .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
      },
      // The supplied copy becomes this file's browser draft and opens in the
      // file deck, on the pinned GitHub source as its base. Its line endings
      // and BOM follow the GitHub file, since a clipboard usually carries LF.
      async copyAsDraft() {
        const W = window.PowerShellWorkspace, note = this.copyNote, it = this.item;
        if (!W?.readFile || !note || !it || note.path !== it.path) return;
        if (this.drafts[it.path]) { this.compareError = 'This file already has a browser draft. Open it in the editor, or discard it there first.'; return; }
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.repo }); gh.ref = this.ref || 'main';
          const src = await W.readFile({ gh, path: it.path, revision: this.revision, blobSha: it.blobSha });
          const sep = (src.text.match(/\r\n|\r|\n/) || ['\n'])[0];
          let text = note.text.replace(/^\uFEFF/, '').replace(/\r\n?|\n/g, sep);
          if (src.text.startsWith('\uFEFF')) text = '\uFEFF' + text;
          const record = { repo: this.repo, project: this.project.path, ref: this.ref || 'main', path: it.path, baseRevision: this.revision,
            baseBlob: src.sha, baseText: src.text, text, updatedAt: new Date().toISOString() };
          W.rememberDraft(record);
          await W.saveDraft(record);
          this.copyNote = null;
          await this.loadDrafts();
          await this.openFileDeck(it.path);
        } catch (e) { this.compareError = 'Could not open the copy as a draft: ' + (e?.message || e); }
      },
      // Auto reads a UTF-16 byte-order mark and otherwise UTF-8. A file that
      // fails that is offered the other encodings then, rather than carrying
      // an encoding menu on the pane for the rare file that needs one.
      async compareFile(file, source, encoding = 'auto') {
        if (!this.item) return;
        const selection = this.captureSelection(), target = this.target();
        this.compareError = ''; this.compareRetry = null;
        let text, bomless = false;
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          if (!this.sameSelection(selection)) return;
          text = window.FileCorrespondence.decodeBytes(bytes, encoding);
          // Only a dropped file shows a missing BOM; a paste never carries one.
          const utf16 = (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff);
          bomless = (encoding === 'utf-8' || (encoding === 'auto' && !utf16))
            && !(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) && /[^\x00-\x7f]/.test(text);
        } catch (e) {
          if (!this.sameSelection(selection)) return;
          this.compareError = e?.message || String(e);
          this.compareRetry = { file, source, key: selection.key };
          this.detailTab = 'copy';
          return;
        }
        await this.takeCopy(target, text, file.name, source, { bomless });
      },
      async retryCompare(encoding) {
        const retry = this.compareRetry;
        if (!retry || retry.key !== this.captureSelection()?.key) { this.compareRetry = null; return; }
        await this.compareFile(retry.file, retry.source, encoding);
      },

      // ── Which file a pasted piece of code belongs to ─────────────────────
      // The workspace's PowerShell files are read once per revision into an
      // index (kits/powershell-match.js), through the same verified reads as
      // the source pane, and the paste is scored against it. Nothing is
      // stored and nothing is written.
      async matchCopy(text, { name = '', source = 'paste' } = {}) {
        const M = window.PowerShellMatch;
        this.matchError = '';
        if (!M) { this.matchError = 'The matching kit did not load.'; return true; }
        if (typeof text !== 'string' || !text.trim()) { this.matchError = 'Nothing came off the clipboard.'; return true; }
        if (this.matchBusy) return true;
        this.matchBusy = true; this.match = null;
        try {
          const index = await this.buildMatchIndex();
          this.match = { ...(await M.rank(text, index)), text, name, source };
          // Below @3xl an open file hides the list, where the result is.
          const list = root?.querySelector('[data-part="list"]');
          if (this.selected && list && !list.offsetParent) this.select('');
        } catch (e) { this.matchError = 'Could not match the paste: ' + (e?.message || e); }
        finally { this.matchBusy = false; }
        return true;
      },
      async buildMatchIndex() {
        const M = window.PowerShellMatch, key = this.repo + '@' + this.revision;
        if (matchIndex?.key === key) return matchIndex.index;
        const files = this.items.filter(it => /\.(ps1|psm1)$/i.test(it.path));
        const index = M.index();
        this.matchProgress = { done: 0, total: files.length };
        let next = 0;
        const worker = async () => {
          while (next < files.length) {
            const it = files[next++];
            try { await M.add(index, it.path, (await this.readItem(it)).text); }
            catch { /* an unreadable file is left out of the index */ }
            this.matchProgress = { ...this.matchProgress, done: this.matchProgress.done + 1 };
          }
        };
        await Promise.all(Array.from({ length: 6 }, worker));
        matchIndex = { key, index };
        return index;
      },
      // A candidate's pieces, each with how close it came.
      matchLine(f) {
        return (this.match?.units || []).filter(u => u.match?.path === f.path)
          .map(u => u.name + (u.verdict === 'identical' ? ', same' : u.verdict === 'version' ? ', changed' : ', similar')).join(' · ');
      },
      // Compare a candidate: the whole paste when this file took nearly all
      // of it, else only the pieces that went to it.
      async compareMatch(f) {
        const m = this.match, it = this.items.find(i => i.path === f.path);
        if (!m || !it) return;
        const whole = f.share >= 0.9 && !this.matchNew.length;
        this.select(it.path);
        await this.takeCopy(this.target(), whole ? m.text : f.text, m.name || 'pasted code', m.source || 'paste');
      },
      async matchClipboard() {
        let text = '';
        try {
          if (window.io?.pasteItems) text = (await window.io.pasteItems()).find(x => x.kind === 'text' && x.type === 'text/plain')?.text || '';
          else if (navigator.clipboard?.readText) text = await navigator.clipboard.readText();
        } catch (e) { this.matchError = 'The clipboard could not be read: ' + (e?.message || e); return; }
        await this.matchCopy(text, { source: 'clipboard' });
      },
      matchPaste(e) { return this.matchCopy(e.clipboardData?.getData('text/plain') || '', { source: 'paste' }); },
      async matchDrop(e) {
        const file = e.dataTransfer?.files?.[0];
        if (!file) return this.matchCopy(e.dataTransfer?.getData('text') || '', { source: 'drop' });
        try { return await this.matchCopy(window.FileCorrespondence.decodeBytes(new Uint8Array(await file.arrayBuffer())), { name: file.name, source: 'drop' }); }
        catch (err) { this.matchError = err?.message || String(err); }
      },

      // ── The GitHub text, for manual placement ────────────────────────────
      selectionOf(item) {
        return item ? { repo: this.repo, ref: this.ref, revision: this.revision, path: item.path, name: item.name,
          blobSha: item.blobSha, key: [this.repo, this.ref, this.revision, item.path, item.blobSha].join('\n') } : null;
      },
      captureSelection() { return this.selectionOf(this.item); },
      sameSelection(selection) { return !!selection && selection.key === this.captureSelection()?.key; },
      // quiet: the source pane's read. It neither claims the busy flag the
      // transfer buttons read nor advances the generation that releases it,
      // so a pane load cannot strand a copy's busy state.
      async fetchText(selection = this.captureSelection(), { quiet = false } = {}) {
        if (!selection) throw new Error('Select a file first.');
        if (textCache?.key === selection.key) { this.textEncoding = textCache.encoding || ''; return textCache.text; }
        const generation = quiet ? textGeneration : ++textGeneration;
        if (!quiet) this.textBusy = true;
        try {
          const { text, encoding } = await this.readText(selection);
          if (generation === textGeneration && this.sameSelection(selection)) {
            textCache = { key: selection.key, text, encoding };
            this.text = text; this.textEncoding = encoding;
          }
          return text;
        } finally { if (!quiet && generation === textGeneration) this.textBusy = false; }
      },

      // One captured file's GitHub text, checked against its blob, touching no
      // view state. A replacement mark means the bytes were not UTF-8.
      // Windows PowerShell 5.1 reads a file with no BOM as Windows-1252, and
      // some of the corpus is saved that way, so read it as that.
      async readText(selection) {
        const gh = new window.GH({ token: window.TOKEN, repo: selection.repo, ref: selection.revision || selection.ref });
        const f = await gh.get(selection.path);
        if (selection.blobSha && f.sha !== selection.blobSha) throw new Error('This file changed. Reload the outpost before transferring or recording it.');
        let text = f.text, encoding = '';
        if (text.includes('\uFFFD') && gh.bytes) {
          const raw = (await gh.bytes(selection.path)).bytes;
          try { text = new TextDecoder('utf-8', { fatal: true }).decode(raw); }
          catch { text = new TextDecoder('windows-1252').decode(raw); encoding = 'windows-1252'; }
        }
        return { text, encoding };
      },

      // ── The source pane: read-only, fetched and mounted on selection ─────
      async loadSource() {
        const selection = this.captureSelection(), item = this.item, generation = ++sourceGeneration;
        if (!selection) { this.source = ''; this.sourceState = ''; this.sourceError = ''; return; }
        this.sourceState = 'loading'; this.sourceError = '';
        // The inline file pane reads through the same cache and reports
        // 'editor' or 'plain' back through its context (fileCtx, shown).
        inline?.cards.get('inline')?.show(item);
        let f;
        try { f = await this.readItem(item); }
        catch (e) {
          if (generation === sourceGeneration) { this.sourceState = 'error'; this.sourceError = 'Could not read the source: ' + (e?.message || e); }
          return;
        }
        if (generation !== sourceGeneration || !this.sameSelection(selection)) return;
        this.source = f.text;
        this.textEncoding = f.encoding === 'windows-1252' ? 'windows-1252' : '';
        textCache ||= { key: selection.key, text: f.text, encoding: this.textEncoding };
        this.loadBaseline(true);
      },
      // ── Changes: what the work computer is known to hold, against GitHub now ─
      // Evidence, newest first: a copy supplied in this browser (its text is
      // kept with the check) or the version the observations file last recorded installed
      // or verified (read back from GitHub at that row's revision). A reader's
      // pick of a check overrides the order. Without either, a pending update
      // (transfer "changed") compares from the file's last commit before its
      // since date: the version the repository held before the change that
      // opened the entry, which is what the entry says the work computer has.
      // The label says which base it is. A new file, or a file with nothing
      // behind it, gets a line saying so rather than a guessed base.
      async loadBaseline(openChanges = false) {
        const selection = this.captureSelection(), item = this.item, generation = sourceGeneration;
        if (!selection || !item) return;
        const check = this.latestCheck(item.path);
        const latest = this.stateOf(item.path).history[0] || null;
        const useCheck = check && (!latest || String(check.checkedAt) >= String(latest.date));
        const { earlier, note: earlierNote } = await this.loadEarlier(selection, item, latest);
        if (generation !== sourceGeneration || !this.sameSelection(selection)) return;
        let baseline = useCheck ? { key: 'check:' + check.id, label: 'Supplied copy', text: check.content } : earlier, note = useCheck ? '' : earlierNote;
        if (baseline && !window.textDiff?.lines) note = 'The text comparison tool did not load, so Changes is unavailable.';
        this.earlier = earlier;
        this.baseline = baseline; this.baselineNote = note;
        this.diffRows = baseline ? this.diffOf(baseline.text, this.source) : [];
        if (openChanges || this.wantChanges) this.sourceView = this.hasChanges ? 'changes' : 'code';
        else if (!this.hasChanges) this.sourceView = 'code';
        this.wantChanges = false;
        this.loadUnits();
      },
      // The version the work computer was last known to hold, from the
      // repository alone: the version the observations file last recorded
      // installed or verified (read back at that row's revision), or, for a
      // pending update with no record, the file's last commit before its
      // since date, which is what the entry says the work computer has. A
      // supplied copy is newer evidence and becomes the baseline over this,
      // but the copy is still read against it (describeCopy). Read once per
      // selection.
      async loadEarlier(selection, item, latest) {
        if (this.earlier && this.earlier.selectionKey === selection.key) return { earlier: this.earlier, note: '' };
        const row = latest && (latest.kind === 'installed' || latest.kind === 'verified') ? latest : null;
        const generation = sourceGeneration;
        let earlier = null, note = '';
        if (row && row.blob_sha === item.blobSha) earlier = { key: 'row:' + row.blob_sha, label: this.rowLabel(row) + ' at ' + short(row.revision), text: this.source || await this.fetchText(selection, { quiet: true }) };
        else if (row) {
          this.baselineBusy = true;
          try {
            const gh = new window.GH({ token: window.TOKEN, repo: selection.repo, ref: row.revision });
            const f = await gh.get(item.path);
            if (row.blob_sha && f.sha !== row.blob_sha) throw new Error('the recorded version could not be read back');
            earlier = { key: 'row:' + row.blob_sha, label: this.rowLabel(row) + ' at ' + short(row.revision), text: f.text };
          } catch (e) { note = 'Could not read the recorded version: ' + (e?.message || e); }
          finally { if (generation === sourceGeneration) this.baselineBusy = false; }
        } else if (latest) {
          note = 'The last supplied copy differed, and its text is not kept in this browser. Compare it again to see the difference.';
        } else if (item.pendingAdoption?.transfer === 'changed' && item.pendingAdoption.since) {
          this.baselineBusy = true;
          try {
            const since = item.pendingAdoption.since;
            const gh = new window.GH({ token: window.TOKEN, repo: selection.repo, ref: selection.revision });
            const before = await gh.req('commits?sha=' + encodeURIComponent(selection.revision) + '&path=' + encodeURIComponent(item.path)
              + '&until=' + encodeURIComponent(since + 'T00:00:00Z') + '&per_page=1', window.GH?.FRESH);
            const rev = before?.[0]?.sha;
            if (!rev) note = 'No earlier version of this file is in the repository, so there is nothing to compare.';
            else {
              gh.ref = rev;
              const f = await gh.get(item.path);
              earlier = { key: 'before:' + rev, label: 'Before the pending change (' + short(rev) + ', before ' + since + ')', text: f.text };
            }
          } catch (e) { note = 'Could not read the version before the pending change: ' + (e?.message || e); }
          finally { if (generation === sourceGeneration) this.baselineBusy = false; }
        }
        if (earlier) earlier.selectionKey = selection.key;
        return { earlier, note };
      },
      resetUnits() {
        unitGeneration++; this.unitReview = null; this.unitSelected = []; this.unitPrepared = null;
        this.unitConfirmation = null; this.unitBusy = false; this.unitError = ''; this.unitFormatting = false;
      },
      async loadUnits() {
        this.resetUnits();
        if (!this.isPowerShell || !this.baseline || !window.PowerShellUnits) return;
        const generation = unitGeneration, selection = this.captureSelection(), before = this.baseline.text, after = this.source;
        this.unitBusy = true;
        try {
          const review = await window.PowerShellUnits.compare(before, after, { tolerant: true });
          if (generation === unitGeneration && this.sameSelection(selection)) {
            this.unitReview = review; this.changeAt = 0;
            // A file with changes opens on them, unless the reader already chose a tab.
            if (!this.tabPicked && this.visibleUnits.length) this.detailTab = 'changes';
            this.$nextTick(() => { this.wireChangeKeys(); const el = this.changeStrip(); if (el) el.scrollLeft = 0; });
          }
        } catch (e) { if (generation === unitGeneration) this.unitError = e.message; }
        finally { if (generation === unitGeneration) this.unitBusy = false; }
      },
      unitNames(ids) { return (this.unitReview?.units || []).filter(u => ids.includes(u.id)).map(u => this.changeName(u)).join(', '); },
      // A card compares lines without their trailing spaces, which a paste
      // changes and the outpost reads as a match; the update itself stays exact.
      unitDiff(unit) { return this.diffOf(unit.before, unit.after, { trimEnd: true }); },
      toggleUnit(id, selected) {
        const ids = new Set(this.unitSelected);
        if (selected) ids.add(id); else {
          ids.delete(id);
          // Unchecking a prerequisite also unchecks its callers.
          let changed;
          do { changed = false; for (const u of this.unitReview.units) if (ids.has(u.id) && u.requires.some(dep => !ids.has(dep))) { ids.delete(u.id); changed = true; } } while (changed);
        }
        this.unitSelected = window.PowerShellUnits.expand(this.unitReview, [...ids]);
        this.unitPrepared = null; this.unitConfirmation = null; this.unitError = '';
      },
      async prepareUnits() {
        if (!this.canPrepareUnits) return;
        const generation = unitGeneration, review = this.unitReview, selected = [...this.unitSelected];
        this.unitBusy = true; this.unitError = ''; this.unitPrepared = null; this.unitConfirmation = null;
        try {
          const prepared = await window.PowerShellUnits.prepare(review, selected, { tolerant: true });
          if (generation === unitGeneration && JSON.stringify(selected) === JSON.stringify(this.unitSelected)) this.unitPrepared = prepared;
        } catch (e) { if (generation === unitGeneration) this.unitError = e.message; }
        finally { if (generation === unitGeneration) this.unitBusy = false; }
      },
      async copyPreparedUnits() {
        if (!this.unitPrepared) return;
        try { await navigator.clipboard.writeText(this.unitPrepared.text); }
        catch (e) { this.unitError = 'Copy failed: ' + e.message; }
      },
      downloadPreparedUnits() {
        if (this.unitPrepared) window.io?.save?.('\uFEFF' + this.unitPrepared.text.replace(/^\uFEFF/, ''), this.item.name, 'text/plain');
      },
      async askUnitsInstalled() {
        if (!this.unitPrepared || !this.canPrepareUnits || !this.manifest.unitObservations) return;
        const generation = unitGeneration, prepared = this.unitPrepared, selection = this.captureSelection();
        try {
          const row = await K().unitRecord({ review: this.unitReview, ids: prepared.ids, resultText: prepared.text, selection });
          if (generation === unitGeneration && this.unitPrepared === prepared && this.sameSelection(selection)) this.unitConfirmation = row;
        } catch (e) { if (generation === unitGeneration) this.unitError = e.message; }
      },
      async confirmUnitsInstalled() {
        if (!this.unitConfirmation || this.recording) return;
        const row = JSON.parse(JSON.stringify(this.unitConfirmation)), generation = unitGeneration;
        this.recording = true; this.unitError = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.repo }); gh.ref = this.ref;
          await K().append({ gh, path: this.manifest.unitObservations, manifestPath: this.project.powershellOutpost, unitRecord: row });
          if (generation === unitGeneration) { await this.reload(); this.recorded = 'Selected changes recorded. The whole file is still unverified.'; }
        } catch (e) { if (generation === unitGeneration) this.unitError = 'Recording was not confirmed: ' + e.message + ' Reload before trying again.'; }
        finally { this.recording = false; }
      },
      partialSummary(path) {
        const row = this.stateOf(path).partial;
        return row ? 'Reported installed on ' + when(row.date) + ' from ' + short(row.revision) + ': ' + row.units.map(u => u.name).join(', ')
          + (row.blob_sha !== this.itemAt(path)?.blobSha ? '. GitHub has changed since this report.' : '.')
          + ' Supply the current work copy to review what remains.' : '';
      },
      diffOf(before, after, { trimEnd = false } = {}) {
        const lines = t => t === '' ? [] : t.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map(l => trimEnd ? l.replace(/[ \t]+$/, '') : l);
        const a = lines(before), b = lines(after);
        if (!window.textDiff?.lines) return [];
        return window.textDiff.lines(a, b).map(op => ({ type: op.type, a: op.a === undefined ? '' : op.a + 1,
          b: op.b === undefined ? '' : op.b + 1, text: op.type === 'add' ? b[op.b] : a[op.a] }));
      },
      // The file pane follows sourceView (its Work copy tab is 'changes').
      setSourceView(view) { this.sourceView = view; },
      // ── The tabs and the change strip ────────────────────────────────────
      setDetailTab(key) {
        this.detailTab = key; this.tabPicked = true;
        if (key === 'code') this.$nextTick(() => inline?.cards.get('inline')?.refresh());
        if (key === 'changes') this.$nextTick(() => { this.wireChangeKeys(); this.goChange(this.changeAt, true); });
      },
      showLineChanges() { this.setDetailTab('code'); this.setSourceView('changes'); },
      // A named block is its name. Lines outside every named block (imports,
      // a top-level call) are named by their first line of code, which says
      // more than "Other changes".
      changeName(u) {
        if (u.kind !== 'Other') return u.name;
        const line = String(u.after || u.before).split(/\r?\n/).map(l => l.trim()).find(l => l && !l.startsWith('#'));
        return !line ? u.name : line.length > 56 ? line.slice(0, 55) + '…' : line;
      },
      changeMeta(u) {
        const rows = this.unitDiff(u), add = rows.filter(r => r.type === 'add').length, del = rows.filter(r => r.type === 'del').length;
        return [u.formatOnly ? 'Whitespace only' : { Add: 'Added', Remove: 'Removed', Replace: 'Changed' }[u.action] || u.action,
          u.kind === 'Other' ? 'lines outside named blocks' : u.kind, 'line ' + u.line, (add ? '+' + add : '') + (add && del ? ' ' : '') + (del ? '−' + del : '')]
          .filter(Boolean).join(' · ');
      },
      changeStrip() { return root?.querySelector('[data-change-strip]') || null; },
      changePanels() { return [...(this.changeStrip()?.children || [])].filter(k => k.hasAttribute('data-slide')); },
      // Left and Right step the strip while the pointer or focus is on the
      // Changes panel, by the house rule for strips (swipeDeck.keys).
      wireChangeKeys() {
        const host = root?.querySelector('[data-unit-review]');
        if (host && window.swipeDeck?.keys) window.swipeDeck.keys(host, d => this.goChange(this.changeAt + d), () => this.visibleUnits.length);
      },
      // Move to change i: the counter at once, the strip after it. A go in
      // flight passes the cards between, so the scroll handler ignores them
      // until the strip arrives.
      goChange(i, instant = false) {
        const n = this.visibleUnits.length;
        if (!n) { this.changeAt = 0; return; }
        i = Math.max(0, Math.min(n - 1, i));
        this.changeAt = i;
        const el = this.changeStrip(), k = this.changePanels()[i];
        if (!el || !k || !el.clientWidth) return;
        const x = k.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
        if (Math.abs(el.scrollLeft - x) < 2) return;
        changeAim = i; clearTimeout(changeAimTimer);
        changeAimTimer = setTimeout(() => { changeAim = -1; }, 900);
        el.scrollTo({ left: x, behavior: instant ? 'instant' : 'smooth' });
      },
      changeScroll() {
        if (changeFrame) return;
        changeFrame = requestAnimationFrame(() => {
          changeFrame = 0;
          const el = this.changeStrip();
          if (!el?.clientWidth) return;
          const x0 = el.getBoundingClientRect().left;
          let best = -1, near = Infinity;
          this.changePanels().forEach((k, i) => { const d = Math.abs(k.getBoundingClientRect().left - x0); if (d < near) { near = d; best = i; } });
          if (best < 0) return;
          if (changeAim >= 0) { if (best !== changeAim) return; changeAim = -1; clearTimeout(changeAimTimer); }
          this.changeAt = best;
        });
      },
      // The same cards, full screen: the house deck (swipeDeck.open), one
      // change per slide, back to the strip on the change the swipe left.
      async openChangeDeck() {
        if (!window.swipeDeck && window.gh?.load) await window.gh.load('kits/swipe-deck.js');
        const D = window.swipeDeck, units = this.visibleUnits, item = this.item;
        if (!D || !units.length || changeDeck || !item) return;
        const chrome = i => ({ title: this.changeName(units[i]), subtitle: item.name + ' · ' + this.changeMeta(units[i]) });
        changeDeck = D.open({
          count: units.length, start: this.changeAt, icon: 'ph-git-diff', ...chrome(this.changeAt),
          innerClass: 'w-full max-w-6xl mx-auto min-h-full flex flex-col',
          index: i => chrome(i),
          render: (i, slide) => {
            const el = document.createElement('div');
            el.className = 'grow flex flex-col';
            el.innerHTML = CHANGE_CARD;
            window.Alpine.addScopeToNode(el, { u: units[i], deck: true }, root);
            slide.append(el);
            window.Alpine.initTree(el);
          },
          release: (i, slide) => { const el = slide.firstElementChild; if (el) window.Alpine.destroyTree(el); },
          onClose: () => { changeDeck = null; this.$nextTick(() => this.goChange(this.changeAt, true)); },
        });
        changeDeck.deck.onSlide(i => {
          this.changeAt = i;
          const c = chrome(i);
          changeDeck?.setTitle?.(c.title); changeDeck?.setSubtitle?.(c.subtitle);
        });
      },
      async copyText() {
        const selection = this.captureSelection();
        try {
          const text = await this.fetchText(selection);
          if (!this.sameSelection(selection)) return;
          await navigator.clipboard.writeText(text);
          if (!this.sameSelection(selection)) return;
          this.lastTransfer = { ...this.lastTransfer, [selection.path]: 'copy' };
          window.Alpine.store('toast')?.('copy', 'GitHub text copied. Place it on the work computer, then Mark as installed.', 'alert-info', 6000);
        } catch (e) { if (this.sameSelection(selection)) this.err = 'Copy failed: ' + (e?.message || e); }
      },
      async downloadText() {
        const selection = this.captureSelection();
        try {
          const text = await this.fetchText(selection);
          if (!this.sameSelection(selection)) return;
          window.io?.save?.(text, selection.name, 'text/plain');
          this.lastTransfer = { ...this.lastTransfer, [selection.path]: 'download' };
        } catch (e) { if (this.sameSelection(selection)) this.err = 'Download failed: ' + (e?.message || e); }
      },

      // ── The write, in two taps ───────────────────────────────────────────
      async askInstalled() {
        if (!this.item) return;
        const selection = this.captureSelection();
        this.recordError = ''; this.recorded = null;
        try {
          const parts = [];
          for (const it of this.placeable(this.item)) {
            const sel = it.path === selection.path ? selection : this.selectionOf(it);
            const text = it.path === selection.path ? await this.fetchText(selection) : (await this.readText(sel)).text;
            parts.push({ selection: sel, sha256: await K().digest(text), method: this.lastTransfer[sel.path] || 'reported' });
          }
          if (!this.sameSelection(selection)) return;
          const many = parts.length > 1;
          this.pending = { kind: 'installed', parts, selection,
            why: many
              ? 'Record that you placed these ' + parts.length + ' GitHub revisions on the work computer together. Nothing here has inspected that computer; each row records your report.'
              : 'Record that you placed this GitHub revision on the work computer. Nothing here has inspected that computer; the row records your report.',
            confirm: many ? 'I placed these on the work computer' : 'I placed this on the work computer' };
          this.renderPending();
        } catch (e) { if (this.sameSelection(selection)) this.recordError = e?.message || String(e); }
      },
      askCheck(check) {
        if (check.path !== this.selected) return;
        this.recordError = ''; this.recorded = null;
        this.pending = { kind: 'check', check,
          why: (K().matchOf(check) !== 'none' ? 'Record that a supplied work copy matched' : 'Record that a supplied work copy differed from')
            + ' revision ' + short(check.revision) + '. The row carries the check\'s hashes; it does not claim the file was installed.',
          confirm: 'Record this check' };
        this.renderPending();
      },
      renderPending() {
        if (!this.pending || !this.item) return;
        try {
          const p = this.pending;
          p.rows = p.kind === 'installed'
            ? p.parts.map(x => K().row({ kind: 'installed', path: x.selection.path, revision: x.selection.revision, blobSha: x.selection.blobSha,
                sha256: x.sha256, method: x.method, note: this.recordNote }))
            : [K().fromCheck(p.check, this.recordNote)];
          p.row = p.rows.find(r => r.path === this.selected) || p.rows[0];
          p.line = p.rows.map(r => K().line(r)).join('\n');
          this.pending = { ...p };
        } catch (e) { this.recordError = e?.message || String(e); }
      },
      async confirmRecord() {
        if (!this.pending?.row || this.recording) return;
        const rows = (this.pending.rows || [this.pending.row]).map(r => ({ ...r })), observationsPath = this.observationsPath;
        const row = rows.find(r => r.path === this.selected) || rows[0];
        this.recording = true; this.recordError = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.repo });
          gh.ref = this.ref;
          const res = await K().append({ gh, path: observationsPath, rows, manifestPath: this.project.powershellOutpost });
          const recorded = 'Recorded ' + this.rowLabel(row) + (rows.length > 1 ? ' for ' + rows.length + ' files' : '') + ' in ' + observationsPath.split('/').pop()
            + (res.commit ? ' (' + short(res.commit) + ')' : '') + '.';
          this.pending = null; this.recordNote = '';
          await this.reload();
          this.recorded = recorded;
          window.Alpine.store('toast')?.('check', recorded, 'alert-success', 5000);
        } catch (e) { this.recordError = 'Recording was not confirmed: ' + (e?.message || e) + ' Reload the outpost before trying again.'; }
        finally { this.recording = false; }
      },
    };
  });
});
