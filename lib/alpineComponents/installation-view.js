// The Overview of a project that declares an installation manifest, and the
// Installation pill of the project view until 2026-09-14: one workspace's
// PowerShell material, each file with where it is meant to go under the work
// installation and what has been observed about the copy there. The subject
// is a machine with no Git checkout, so every fact about it arrives by hand:
// a pasted or dropped work copy (the comparison flow, lib/kits/
// file-correspondence.js, which stays browser-local), or a confirmed "I placed
// this on the work computer", which lib/kits/installation.js appends to the
// workspace's observations.csv. The derivation is the kit's; this file is the
// surface, and its one rule is that no gesture but the confirm writes.
//
// Mounts by the crumb-bar idiom (template injected in init, then initTree),
// reads the open project from the argument the pane passes, and reaches the
// shell for the comparison hand-off and the Code workspace.
document.addEventListener('alpine:init', function () {
  Alpine.data('installationView', function (project) {
    const K = () => window.Installation;
    const short = sha => String(sha || '').slice(0, 7);
    const when = iso => {
      if (!iso) return '';
      const d = new Date(iso);
      return isNaN(d) ? iso : d.toISOString().slice(0, 10);
    };
    // One icon per file, in the list and the detail header, carrying the
    // state a reader acts on. "local state unknown" reads as assumed in sync
    // (an outline check) and a ledger confirmation as a filled one, so the two
    // stay apart by one weight. The ledger and the manifest are unchanged;
    // this is how the list shows them. Titles stay at two words, the repo's
    // rule for an icon's label (installation-view.test.mjs).
    // States in which the work computer's copy is known or declared to be
    // behind GitHub: the only ones where an install script has a job to do.
    const BEHIND = new Set(['pending-new', 'pending-changed', 'changed', 'differs', 'differs-changed']);
    // The icons are the estate's shared tones (kits/sync-status.js), so a
    // shortcut behind GitHub and a file behind GitHub read the same.
    const I = window.SyncStatus.ICON;
    const STATUS = {
      unknown: { short: 'Assumed synced', label: 'Assumed in sync', cls: I.assumed },
      reported: { short: 'Confirmed', label: 'Confirmed installed', cls: I.current },
      verified: { short: 'Verified', label: 'Verified from a supplied copy', cls: I.current },
      changed: { short: 'Update pending', label: 'Update pending', cls: I.behind },
      'pending-changed': { short: 'Update pending', label: 'Update pending', cls: I.behind },
      'pending-new': { short: 'New file', label: 'New file, not yet installed', cls: I.new },
      differs: { short: 'Differs', label: 'Local copy differs', cls: I.differs },
      'differs-changed': { short: 'Differs', label: 'Local copy differed, and GitHub changed since', cls: I.differs },
      'repo-only': { short: 'Repository only', label: 'Repository only, not installed', cls: I.none },
    };
    // The status icon and its menu: tap or right-click. `side` anchors the
    // menu so it opens into the pane rather than off its edge.
    const statusMenu = (path, side) => `
      <div class="relative shrink-0" @click.outside="menuFor === ${path} && (menuFor = '')" @keydown.escape.window="menuFor = ''">
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
    let sourceGeneration = 0, inline = null, draftsLoad = Promise.resolve(), self = null;
    const reads = new Map(), draftRecords = new Map();

    return {
      description: 'The Overview of a workspace declaring an installation manifest: PowerShell files grouped by installation area, their intended destinations, pending adoption and untested limits, durable observed state, and local-only areas. Shows the source of a selected file beside its state in the same editor as the file deck, read-only until Edit writes a browser draft; compares a supplied work copy; copies the captured GitHub revision or a script that places its exact bytes; and records an explicitly confirmed observation with any adoption closure in one commit.',

      project,
      repo: '', ref: '', revision: '', ledgerPath: '', manifest: null,
      items: [], groups: [], derived: {}, rows: [],
      checks: [],                 // copies compared this visit, newest first, one per file; held in memory, never stored
      loading: true, err: '',
      filter: '',                 // '' or a state key
      selected: '',               // the selected item's repo path
      text: '', textBusy: false,  // the selected file's GitHub text, fetched on demand
      compareError: '',
      compareRetry: null,         // { file, source }: a supplied file that did not decode as UTF-8, awaiting its encoding
      dragging: false,            // a file or text is being dragged over the selected file's column
      scriptBusy: false,          // an install script is being built from the exact source bytes
      textEncoding: '',           // 'windows-1252' when the selected file is not UTF-8
      copyNote: null,             // what the last supplied copy of the selected file is, for the summary card
      drafts: {},                 // path -> true for a file with a browser draft
      draftList: [],              // those drafts, for publication
      publishOpen: false, publishBranch: '', publishMessage: '', publishing: false, published: null, publishError: '',
      lastTransfer: {},           // path -> 'copy' | 'download' | 'script', the method a later confirm reports
      pending: null,              // { row, line, why } awaiting the confirm
      recordNote: '', recording: false, recordError: '', recorded: null,
      openHistory: true,
      menuFor: '',                // the path whose status menu is open
      source: '', sourceState: '', sourceError: '', // the read-only source pane: '' | loading | editor | plain | error
      sourceOpen: false,          // below @3xl the pane is collapsed until Show code
      sourceView: 'code',         // 'code' | 'changes'
      wantChanges: false,         // the menu asked for Changes before the base loaded
      baseline: null,             // { key, label, text }: what the work computer is known to hold
      baselineBusy: false, baselineNote: '', diffRows: [],

      template: `
        <div class="@container flex flex-col gap-4" data-installation>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <i class="ph ph-desktop text-xl text-base-content/50"></i>
            <!-- The work machine heads this view. "Installation" was the pill's
                 label, and the pill became a workspace's Overview on
                 2026-09-14; the breadcrumb above already names the workspace. -->
            <h2 class="text-lg font-semibold font-mono" x-text="root || 'Installation'"></h2>
            <div class="grow"></div>
            <div class="flex items-center gap-1">
              <select x-model="filter" class="select select-bordered select-sm" aria-label="Filter by state">
                <option value="">every state</option>
                <template x-for="s in states" :key="s.key">
                  <option :value="s.key" x-text="s.label + ' · ' + s.count"></option>
                </template>
              </select>
              <button @click="reload()" class="btn btn-ghost btn-sm btn-square" title="Reload">
                <i class="ph ph-arrows-clockwise text-base"></i></button>
            </div>
          </div>
          <!-- Browser drafts from the file deck, published together to a new
               branch through PowerShellWorkspace.publish. Nothing else here
               writes code to GitHub, and publishing records no installation. -->
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

          <div x-show="!loading" class="grid gap-6 @3xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
            <!-- The corpus: areas, units, files. Hidden on a narrow pane while a file is open. -->
            <div class="flex flex-col gap-5 min-w-0" :class="selected ? 'hidden @3xl:flex' : 'flex'">
              <template x-for="g in visibleGroups" :key="g.area">
                <section>
                  <h3 class="flex items-baseline gap-2 text-sm font-mono uppercase tracking-widest text-base-content/50 mb-1.5">
                    <span x-text="g.area"></span>
                    <span class="normal-case tracking-normal text-base-content/40" x-text="destinationOf(g)"></span>
                  </h3>
                  <div class="flex flex-col gap-2">
                    <template x-for="u in g.units" :key="u.name">
                      <div class="rounded-lg border border-base-300 px-2 py-1.5">
                        <div x-show="u.name !== g.area" class="text-base font-medium px-1" x-text="u.name"></div>
                        <div class="flex flex-col">
                          <template x-for="it in u.files" :key="it.path">
                            <div class="flex items-center gap-1 rounded hover:bg-base-200 min-w-0" data-row
                                 :class="selected === it.path && 'bg-primary/10'" @contextmenu.prevent="menuFor = it.path">
                              <button @click="select(it.path)" class="flex items-center gap-2 px-1 py-1 text-left text-base grow min-w-0">
                                <i class="ph text-base-content/50 shrink-0" :class="iconOf(it)"></i>
                                <span class="truncate" x-text="it.name"></span>
                                <i x-show="drafts[it.path]" class="ph ph-pencil-simple-line text-warning shrink-0" title="Browser draft" data-draft-mark></i>
                              </button>
                              ${statusMenu('it.path', 'right')}
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
              <section x-show="!filter && localAreas.length">
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
            <div class="min-w-0" :class="selected ? 'block' : 'hidden @3xl:block'">
              <template x-if="!item">
                <p class="text-base-content/40 italic text-base py-8">Select a file to see its intended location, its observations, and the actions on it.</p>
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
                      <div x-show="item.companion" class="text-sm text-base-content/60">with
                        <button @click="select(item.companion)" class="link link-hover font-mono" x-text="item.companion?.split('/').pop()"></button>
                        <i class="ml-0.5 align-middle" :class="item.companion && statusOf(item.companion).cls"></i></div>
                    </div>
                  </div>

                  <div x-show="item.pendingAdoption?.limit || stateOf(item.path).conflict" class="text-base text-base-content/80 border-l-2 border-warning pl-3" data-adoption>
                    <p x-text="item.pendingAdoption?.limit || ''"></p>
                    <p x-show="stateOf(item.path).conflict" class="mt-1 text-sm text-error" data-adoption-conflict>This file has an observation row and a pending entry, which contradict each other. The workspace check fails while both exist; remove the entry from installation.json.</p>
                  </div>

                  <!-- The confirm: the exact row, the file it lands in, one tap. -->
                  <div x-show="pending" x-cloak class="border border-primary/40 rounded-lg p-3 flex flex-col gap-2 bg-primary/10">
                    <div class="text-base font-medium" x-text="pending?.why"></div>
                    <input x-model="recordNote" type="text" class="input input-bordered input-sm w-full" placeholder="note (optional, one line)" @input="renderPending()">
                    <pre class="font-mono text-base whitespace-pre-wrap break-all bg-base-100 rounded p-2" x-text="pending?.line"></pre>
                    <div class="font-mono text-base text-base-content/60 break-all" x-text="'appends to ' + repo + '@' + ref + ':' + ledgerPath"></div>
                    <p x-show="item.pendingAdoption" class="text-sm">Recording this observation also removes this file from the pending adoption list.</p>
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
                      <a :href="ledgerUrl" target="_blank" rel="noopener" class="link link-hover text-xs font-mono">observations.csv</a>
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

                  <!-- The source at the captured revision in the file component
                       the deck uses (powershell-file.js, mounted inline by
                       fileCtx): read-only until Edit, which writes a browser
                       draft. The header carries Open in deck and Copy. Below
                       @3xl the detail column is its own screen, so the code
                       stays collapsed and the status menu above the fold.

                       Work copy compares what the work computer is known to
                       hold with GitHub now: the newest of a copy supplied in
                       this browser and the version the ledger last recorded.
                       It is the default tab whenever the two differ, since
                       that is the update a placement would make. -->
                  <!-- A copy from the work computer, pasted or dropped. The page-
                       wide paste and a drop on the column arrive here too; a tap
                       reads the clipboard through the app's Paste. What the copy
                       is comes back as the card below, not as a jump to a diff. -->
                  <div x-show="item.comparable" data-copy-zone tabindex="0" role="button"
                       @click="compareClipboard()" @keydown.enter.prevent="compareClipboard()"
                       class="border border-dashed rounded-md py-3 px-3 text-center cursor-pointer hover:bg-base-200 transition-colors"
                       :class="dragging ? 'border-primary bg-primary/10' : 'border-base-300'">
                    <div class="text-base-content/50 text-sm flex items-center justify-center gap-2 pointer-events-none">
                      <i class="ph text-lg" :class="dragging ? 'ph-file-arrow-down text-primary' : 'ph-clipboard-text'"></i>
                      <span x-text="dragging ? 'Drop to compare' : 'Paste or drop a copy of ' + item.name + ' to compare'"></span>
                    </div>
                  </div>
                  <div x-show="copyNote && copyNote.path === item.path" x-cloak data-copy-summary
                       class="rounded-md border p-3 flex flex-col gap-2 text-base"
                       :class="copyNote?.same ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5'">
                    <div class="flex items-start gap-2">
                      <i class="ph text-lg mt-0.5" :class="copyNote?.same ? 'ph-check-circle text-success' : 'ph-git-diff text-warning'"></i>
                      <div class="grow min-w-0">
                        <div class="font-medium" x-text="copyNote?.title"></div>
                        <ul class="text-sm text-base-content/80 mt-1 flex flex-col gap-0.5">
                          <template x-for="(l, i) in copyNote?.lines || []" :key="i"><li x-text="l"></li></template>
                        </ul>
                      </div>
                      <button @click="copyNote = null" class="btn btn-ghost btn-xs btn-square" title="Dismiss" aria-label="Dismiss"><i class="ph ph-x"></i></button>
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                      <button x-show="!copyNote?.exact" @click="sourceOpen = true; setSourceView('changes')" class="btn btn-sm">Show line changes</button>
                      <button x-show="copyNote && !isRecorded(latestCheck(item.path) || {})" @click="askCheck(latestCheck(item.path))" class="btn btn-sm"
                              x-text="copyNote?.same ? 'Record the match…' : 'Record the difference…'"></button>
                      <button x-show="copyNote && !copyNote.same && !textEncoding" @click="copyAsDraft()" class="btn btn-sm">Open as draft</button>
                    </div>
                  </div>
                  <div class="flex flex-col gap-1.5" data-source>
                    <div class="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm font-medium text-base-content/60">
                      <span class="font-mono font-normal break-all min-w-0" x-text="destinationOfItem(item)" data-destination></span>
                      <span x-show="sourceState === 'loading' || baselineBusy" class="loading loading-dots loading-xs opacity-50 ml-1"></span>
                      <div class="grow"></div>
                      <div class="flex items-center" data-source-tools>
                        <button x-show="item.comparable" @click="openFileDeck(item.path)" class="btn btn-ghost btn-sm btn-square"
                                title="Open in deck" aria-label="Open in deck"><i class="ph ph-cards text-lg"></i></button>
                        <button @click="copyText()" :disabled="!!textBusy" class="btn btn-ghost btn-sm btn-square"
                                title="Copy" aria-label="Copy GitHub text"><i class="ph ph-copy text-lg"></i></button>
                      </div>
                      <span x-show="textEncoding" class="badge badge-ghost badge-sm" title="Not UTF-8: Windows PowerShell 5.1 reads a file with no BOM this way">Windows-1252</span>
                      <button @click="toggleSource()" class="btn btn-ghost btn-xs gap-1 @3xl:hidden" data-source-toggle>
                        <i class="ph text-base" :class="sourceOpen ? 'ph-caret-up' : 'ph-caret-down'"></i>
                        <span x-text="sourceOpen ? 'Hide code' : 'Show code'"></span></button>
                    </div>
                    <div x-show="compareError" class="flex flex-wrap items-center gap-1.5 text-sm" data-compare-error>
                      <span class="text-error" x-text="compareError"></span>
                      <template x-for="enc in (compareRetry ? ['utf-16le', 'utf-16be', 'windows-1252'] : [])" :key="enc">
                        <button @click="retryCompare(enc)" class="btn btn-outline btn-xs" x-text="{ 'utf-16le': 'UTF-16 LE', 'utf-16be': 'UTF-16 BE', 'windows-1252': 'Windows-1252' }[enc]"></button>
                      </template>
                    </div>
                    <div :class="sourceOpen ? 'block' : 'hidden @3xl:block'" data-source-body>
                      <p :class="sourceState === 'error' ? '' : 'hidden'" class="text-sm text-error" x-text="sourceError"></p>
                      <p x-show="baselineNote" class="text-sm text-base-content/60 pb-1" x-text="baselineNote"></p>
                      <div :class="[sourceState === 'error' ? 'hidden' : '', dropRing]" data-source-file
                           class="h-96 @3xl:h-[32rem] rounded-lg border overflow-hidden">
                        <div class="h-full" x-data="powershellFile(fileCtx())"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>`,

      init() {
        self = this;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
        this.reload();
      },
      destroy() {
        loadGeneration++; textGeneration++; sourceGeneration++;
        if (shell()) shell().installationItem = '';
      },

      get root() { return this.manifest?.root || ''; },
      get states() {
        const counts = K().summary(Object.values(this.derived));
        return K().STATES.filter(s => counts[s]).map(s => ({ key: s, label: (STATUS[s] || STATUS.unknown).label, count: counts[s] }));
      },
      get localAreas() { return this.manifest?.localAreas || []; },
      get visibleGroups() {
        if (!this.filter) return this.groups;
        return this.groups.map(g => ({ ...g, units: g.units
          .map(u => ({ ...u, files: u.files.filter(it => this.stateOf(it.path).state === this.filter) }))
          .filter(u => u.files.length) })).filter(g => g.units.length);
      },
      get hasChanges() { return !!this.baseline && this.diffRows.some(r => r.type !== 'eq'); },
      get showingChanges() { return this.sourceView === 'changes' && this.hasChanges; },
      get dropRing() { return this.dragging ? 'border-primary ring-2 ring-[var(--color-primary)]' : 'border-base-300'; },
      get item() { return this.items.find(it => it.path === this.selected) || null; },
      get ledgerUrl() {
        return window.GithubLinks?.pathUrl ? window.GithubLinks.pathUrl(this.repo, this.ledgerPath, this.ref) : '';
      },
      short, when,
      stateOf(path) { return this.derived[path] || { state: 'unknown', label: K().LABELS.unknown, latest: null, history: [] }; },
      // The ledger and the manifest decide the icon. A copy compared on this
      // visit shows in Changes and can be recorded from the menu; until it is,
      // it does not recolour the file (a pasted chunk reads as "differs").
      statusOf(path) { return STATUS[this.stateOf(path).state] || STATUS.unknown; },
      latestCheck(path) { return this.checks.find(c => c.path === path) || null; },
      actionsFor(path) {
        const it = this.items.find(i => i.path === path);
        if (!it) return [];
        const st = this.stateOf(path).state, check = this.latestCheck(path), out = [];
        if (it.installs !== null) out.push({ key: 'install', label: 'Confirm installed…', icon: 'ph-check-circle' });
        if (it.installs !== null && BEHIND.has(st)) out.push({ key: 'script', label: 'Copy install script', icon: 'ph-terminal-window' });
        if (check && !this.isRecorded(check))
          out.push({ key: 'record-check', label: check.exact || check.lineEndingsOnly ? 'Record the match…' : 'Record the difference…', icon: 'ph-note-pencil' });
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
        if (key === 'changes') { this.sourceOpen = true; if (this.hasChanges) this.setSourceView('changes'); else this.wantChanges = true; return; }
        if (key === 'deck') return this.openFileDeck(path);
        if (key === 'script') return this.copyTransferScript();
      },
      historyOf(it) { return this.stateOf(it.path).history; },
      checksOf(it) { return this.checks.filter(c => c.path === it.path); },
      isRecorded(c) { return K().isRecorded(c, this.rows); },
      iconOf(it) {
        return { profile: 'ph-user-gear', module: 'ph-package', companion: 'ph-file-code', controller: 'ph-file-code',
          xaml: 'ph-layout', script: 'ph-file-code', resource: 'ph-file' }[it.kind] || 'ph-file';
      },
      destinationOf(g) {
        return g.installs === null ? 'no installation destination' : g.installs === '' ? 'installation root' : g.installs;
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
      // opened, or when the ledger last spoke.
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
        this.text = ''; this.textBusy = false; this.pending = null;
        this.repo = s.repo; this.ref = s.ref || s.defaultRef || '';
        this.loading = true; this.err = '';
        try {
          if (!s.gh) throw new Error('No repository is open.');
          const gh = Object.create(s.gh);
          gh.repo = this.repo; gh.ref = this.ref;
          const manifestPath = this.project?.installation;
          if (!manifestPath) throw new Error('This workspace declares no installation manifest.');
          const fresh = window.GH?.FRESH || { cache: 'no-store' };
          const commits = await gh.req('commits?' + (gh.ref ? 'sha=' + encodeURIComponent(gh.ref) + '&' : '') + 'per_page=1', fresh);
          const revision = commits?.[0]?.sha;
          if (!revision) throw new Error('The selected revision could not be resolved.');
          gh.ref = revision;
          const [mf, tree] = await Promise.all([
            gh.get(manifestPath, fresh),
            gh.req('git/trees/' + revision + '?recursive=1', fresh),
          ]);
          if (tree.truncated) throw new Error('GitHub returned an incomplete tree; the installation inventory cannot be shown reliably.');
          const manifest = K().manifest(mf.text);
          const ledgerPath = manifest.observations || (this.project.path + '/data/observations.csv');
          const rows = await this.readRows(gh, ledgerPath);
          if (generation !== loadGeneration) return;
          this.manifest = manifest; this.revision = revision; this.ledgerPath = ledgerPath; this.rows = rows;
          this.items = K().inventory({ tree: tree.tree, manifest, projectPath: this.project.path });
          this.lastTransfer = previousRepo === gh.repo ? Object.fromEntries(this.items
            .filter(it => previousBlobs.get(it.path) === it.blobSha && this.lastTransfer[it.path])
            .map(it => [it.path, this.lastTransfer[it.path]])) : {};
          this.groups = K().groups(this.items, manifest);
          this.derived = Object.fromEntries(this.items.map(it => [it.path, K().derive(it, rows)]));
          if (this.selected && !this.items.some(it => it.path === this.selected)) this.select('');
          if (!this.selected && shell()?.installationItem && this.items.some(it => it.path === shell().installationItem))
            this.selected = shell().installationItem;
          if (this.selected) this.loadSource();
          this.loadDrafts();
        } catch (e) { if (generation === loadGeneration) this.err = 'Could not read the installation: ' + (e?.message || e); }
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
        const shown = this.visibleGroups.flatMap(g => g.units.flatMap(u => u.files)).filter(it => it.comparable);
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
      // Theme.xaml keys a XAML file is checked against, and the Overview's
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
          transferred: p => { this.lastTransfer = { ...this.lastTransfer, [p]: 'script' }; },
          behind: p => BEHIND.has(this.stateOf(p).state),
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
          shown: state => { view.sourceState = state; },
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

      async readRows(gh, ledgerPath) {
        let text = '';
        try { text = (await gh.get(ledgerPath, window.GH?.FRESH)).text; }
        catch (e) { if (e?.status !== 404) throw e; }
        return K().observations(text);
      },

      // ── Selection ────────────────────────────────────────────────────────
      select(path) {
        textGeneration++; textCache = null;
        this.selected = path; this.compareError = ''; this.compareRetry = null; this.dragging = false;
        this.pending = null; this.recorded = null; this.recordError = ''; this.recordNote = ''; this.text = ''; this.textBusy = false;
        this.source = ''; this.sourceOpen = false; this.sourceView = 'code'; this.wantChanges = false; this.menuFor = '';
        this.baseline = null; this.baselineNote = ''; this.diffRows = [];
        if (shell()) { shell().installationItem = path; shell().syncUrl?.(); }
        this.loadSource();
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
      async takeCopy(target, text, name = '', source = 'paste') {
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
          const copy = { id: 'copy-' + (++copyCount), path: item.path, revision: selection.revision, blobSha: item.blobSha,
            incomingSha256: sha256, exact, lineEndingsOnly, source, incomingName: name || item.name,
            checkedAt: new Date().toISOString(), content: text };
          this.checks = [copy, ...this.checks.filter(c => c.path !== item.path)];
          if (this.source) await this.loadBaseline(false);
          this.copyNote = this.describeCopy(item, github, text, { exact, lineEndingsOnly });
        } catch (e) { if (this.sameSelection(selection)) this.compareError = e?.message || String(e); }
        return true;
      },
      // What a supplied copy is, said before any line diff: whether it is
      // signed for this file, whether it matches, and if not, what it changes
      // by function (PowerShellLanguage.compareStructure) and which Windows
      // PowerShell 5.1 problems it brings. The line diff stays one tap away.
      describeCopy(item, github, text, { exact, lineEndingsOnly }) {
        let signed = '';
        try { signed = window.FileCorrespondence?.declaration?.(text) || ''; } catch {}
        const lead = signed && signed === item.path ? 'Signed copy of ' + item.name + ': ' : 'This copy ';
        const L = window.PowerShellLanguage, st = L?.compareStructure ? L.compareStructure(github, text, item.path) : null;
        const same = exact || lineEndingsOnly || !!st?.same;
        const title = exact ? lead + 'matches GitHub exactly.' : lineEndingsOnly ? lead + 'matches GitHub except for line endings.'
          : st?.same ? lead + 'matches GitHub except for spaces at line ends.' : lead + 'differs from GitHub.';
        const lines = [], names = list => list.map(f => f.name || f).join(', ');
        if (!same && st?.kind === 'powershell') {
          if (st.changed.length) lines.push('Changed: ' + st.changed.map(f => f.name + [f.params.added.length ? 'adds ' + f.params.added.join(' ') : '',
            f.params.removed.length ? 'drops ' + f.params.removed.join(' ') : ''].filter(Boolean).map(t => ' (' + t + ')').join('')).join(', '));
          if (st.added.length) lines.push('Added: ' + names(st.added));
          if (st.removed.length) lines.push('Removed: ' + names(st.removed));
          if (st.outsideChanged) lines.push('The script outside its functions changed.');
          if (st.unchanged) lines.push(st.unchanged + (st.unchanged === 1 ? ' other function is' : ' other functions are') + ' unchanged.');
          for (const d of st.newProblems.slice(0, 3)) lines.push('New 5.1 problem at line ' + d.line + ': ' + d.message);
        }
        if (!same && st?.kind === 'xaml') {
          if (st.controls.added.length) lines.push('Named controls added: ' + names(st.controls.added));
          if (st.controls.removed.length) lines.push('Named controls removed: ' + names(st.controls.removed));
          if (st.resources.added.length) lines.push('Resource keys added: ' + names(st.resources.added));
          if (st.resources.removed.length) lines.push('Resource keys removed: ' + names(st.resources.removed));
          if (!lines.length) lines.push('No named control or resource key changed; the difference is in layout or values.');
        }
        return { path: item.path, title, lines, exact, same, text, signed: signed === item.path };
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
        let text;
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          if (!this.sameSelection(selection)) return;
          text = window.FileCorrespondence.decodeBytes(bytes, encoding);
        } catch (e) {
          if (!this.sameSelection(selection)) return;
          this.compareError = e?.message || String(e);
          this.compareRetry = { file, source, key: selection.key };
          return;
        }
        await this.takeCopy(target, text, file.name, source);
      },
      async retryCompare(encoding) {
        const retry = this.compareRetry;
        if (!retry || retry.key !== this.captureSelection()?.key) { this.compareRetry = null; return; }
        await this.compareFile(retry.file, retry.source, encoding);
      },

      // ── The GitHub text, for manual placement ────────────────────────────
      captureSelection() {
        const item = this.item;
        return item ? { repo: this.repo, ref: this.ref, revision: this.revision, path: item.path, name: item.name,
          blobSha: item.blobSha, key: [this.repo, this.ref, this.revision, item.path, item.blobSha].join('\n') } : null;
      },
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
          const gh = new window.GH({ token: window.TOKEN, repo: selection.repo, ref: selection.revision || selection.ref });
          const f = await gh.get(selection.path);
          if (selection.blobSha && f.sha !== selection.blobSha) throw new Error('This file changed. Reload the installation before transferring or recording it.');
          // A replacement mark means the bytes were not UTF-8. Windows
          // PowerShell 5.1 reads a file with no BOM as Windows-1252, and some
          // of the corpus is saved that way, so read it as that.
          let text = f.text, encoding = '';
          if (text.includes('\uFFFD') && gh.bytes) {
            const raw = (await gh.bytes(selection.path)).bytes;
            try { text = new TextDecoder('utf-8', { fatal: true }).decode(raw); }
            catch { text = new TextDecoder('windows-1252').decode(raw); encoding = 'windows-1252'; }
          }
          if (generation === textGeneration && this.sameSelection(selection)) {
            textCache = { key: selection.key, text, encoding };
            this.text = text; this.textEncoding = encoding;
          }
          return text;
        } finally { if (!quiet && generation === textGeneration) this.textBusy = false; }
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
      // kept with the check) or the version the ledger last recorded installed
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
        const row = latest && (latest.kind === 'installed' || latest.kind === 'verified') ? latest : null;
        const useCheck = check && (!latest || String(check.checkedAt) >= String(latest.date));
        let baseline = null, note = '';
        if (useCheck) baseline = { key: 'check:' + check.id, label: 'Supplied copy', text: check.content };
        else if (row && row.blob_sha === item.blobSha) baseline = { key: 'row:' + row.blob_sha, label: this.rowLabel(row) + ' at ' + short(row.revision), text: this.source };
        else if (row) {
          this.baselineBusy = true;
          try {
            const gh = new window.GH({ token: window.TOKEN, repo: selection.repo, ref: row.revision });
            const f = await gh.get(item.path);
            if (row.blob_sha && f.sha !== row.blob_sha) throw new Error('the recorded version could not be read back');
            baseline = { key: 'row:' + row.blob_sha, label: this.rowLabel(row) + ' at ' + short(row.revision), text: f.text };
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
              baseline = { key: 'before:' + rev, label: 'Before the pending change (' + short(rev) + ', before ' + since + ')', text: f.text };
            }
          } catch (e) { note = 'Could not read the version before the pending change: ' + (e?.message || e); }
          finally { if (generation === sourceGeneration) this.baselineBusy = false; }
        }
        if (generation !== sourceGeneration || !this.sameSelection(selection)) return;
        if (baseline && !window.textDiff?.lines) note = 'The text comparison tool did not load, so Changes is unavailable.';
        this.baseline = baseline; this.baselineNote = note;
        this.diffRows = baseline ? this.diffOf(baseline.text, this.source) : [];
        if (openChanges || this.wantChanges) this.sourceView = this.hasChanges ? 'changes' : 'code';
        else if (!this.hasChanges) this.sourceView = 'code';
        this.wantChanges = false;
      },
      diffOf(before, after) {
        const lines = t => t === '' ? [] : t.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
        const a = lines(before), b = lines(after);
        if (!window.textDiff?.lines) return [];
        return window.textDiff.lines(a, b).map(op => ({ type: op.type, a: op.a === undefined ? '' : op.a + 1,
          b: op.b === undefined ? '' : op.b + 1, text: op.type === 'add' ? b[op.b] : a[op.a] }));
      },
      // The file pane follows sourceView (its Work copy tab is 'changes').
      setSourceView(view) { this.sourceView = view; },
      toggleSource() {
        this.sourceOpen = !this.sourceOpen;
        if (this.sourceOpen) this.$nextTick(() => inline?.cards.get('inline')?.refresh());
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

      // A Windows PowerShell 5.1 script that writes this revision's exact bytes
      // at the manifest destination. The bytes come through the workspace's
      // pinned blob read, which verifies them against the Git blob before the
      // script is built and does not decode them, so a Windows-1252 file moves
      // byte for byte; copying the script claims nothing and writes no row.
      async copyTransferScript() {
        const selection = this.captureSelection(), item = this.item;
        if (!selection) return;
        this.scriptBusy = true;
        try {
          const W = window.PowerShellWorkspace;
          if (!W?.readBytes) throw new Error('The PowerShell workspace kit is required to read the exact source bytes.');
          const gh = new window.GH({ token: window.TOKEN, repo: selection.repo, ref: selection.ref });
          const source = await W.readBytes({ gh, path: selection.path, revision: selection.revision, blobSha: selection.blobSha });
          if (!this.sameSelection(selection)) return;
          const script = K().transferScript({ path: selection.path, name: selection.name, installs: item.installs, root: this.root,
            revision: selection.revision, blobSha: source.sha, bytes: source.bytes });
          await navigator.clipboard.writeText(script);
          if (!this.sameSelection(selection)) return;
          this.lastTransfer = { ...this.lastTransfer, [selection.path]: 'script' };
          window.Alpine.store('toast')?.('copy', 'Install script copied. Run it in Windows PowerShell on the work computer to write this file there, then Confirm installed.', 'alert-info', 6000);
        } catch (e) { if (this.sameSelection(selection)) this.err = 'Install script failed: ' + (e?.message || e); }
        finally { this.scriptBusy = false; }
      },

      // ── The write, in two taps ───────────────────────────────────────────
      async askInstalled() {
        if (!this.item) return;
        const selection = this.captureSelection();
        this.recordError = ''; this.recorded = null;
        try {
          const text = await this.fetchText(selection);
          const sha256 = await K().digest(text);
          if (!this.sameSelection(selection)) return;
          const method = this.lastTransfer[selection.path] || 'reported';
          this.pending = { kind: 'installed', method, sha256, selection,
            why: 'Record that you placed this GitHub revision on the work computer. Nothing here has inspected that computer; the row records your report.',
            confirm: 'I placed this on the work computer' };
          this.renderPending();
        } catch (e) { if (this.sameSelection(selection)) this.recordError = e?.message || String(e); }
      },
      askCheck(check) {
        if (check.path !== this.selected) return;
        this.recordError = ''; this.recorded = null;
        this.pending = { kind: 'check', check,
          why: (check.exact || check.lineEndingsOnly ? 'Record that a supplied work copy matched' : 'Record that a supplied work copy differed from')
            + ' revision ' + short(check.revision) + '. The row carries the check\'s hashes; it does not claim the file was installed.',
          confirm: 'Record this check' };
        this.renderPending();
      },
      renderPending() {
        if (!this.pending || !this.item) return;
        try {
          const p = this.pending;
          p.row = p.kind === 'installed'
            ? K().row({ kind: 'installed', path: p.selection.path, revision: p.selection.revision, blobSha: p.selection.blobSha,
                sha256: p.sha256, method: p.method, note: this.recordNote })
            : K().fromCheck(p.check, this.recordNote);
          p.line = K().line(p.row);
          this.pending = { ...p };
        } catch (e) { this.recordError = e?.message || String(e); }
      },
      async confirmRecord() {
        if (!this.pending?.row || this.recording) return;
        const row = { ...this.pending.row }, ledgerPath = this.ledgerPath;
        this.recording = true; this.recordError = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.repo });
          gh.ref = this.ref;
          const res = await K().append({ gh, path: ledgerPath, row, manifestPath: this.project.installation });
          const recorded = 'Recorded ' + this.rowLabel(row) + ' in ' + ledgerPath.split('/').pop()
            + (res.commit ? ' (' + short(res.commit) + ')' : '') + '.';
          this.pending = null; this.recordNote = '';
          await this.reload();
          this.recorded = recorded;
          window.Alpine.store('toast')?.('check', recorded, 'alert-success', 5000);
        } catch (e) { this.recordError = 'Recording was not confirmed: ' + (e?.message || e) + ' Reload the installation before trying again.'; }
        finally { this.recording = false; }
      },
    };
  });
});
