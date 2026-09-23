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
    const BADGE = {
      unknown: 'badge-ghost', reported: 'badge-info', verified: 'badge-success', changed: 'badge-warning',
      differs: 'badge-warning', 'differs-changed': 'badge-warning', 'repo-only': 'badge-neutral badge-outline',
      'pending-new': 'badge-info badge-outline', 'pending-changed': 'badge-warning badge-outline',
    };
    const store = () => window.Alpine.store('browser');
    const shell = () => window.__shell;
    const pill = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-base font-medium transition-colors';
    let loadGeneration = 0, textGeneration = 0, checkGeneration = 0;
    let textCache = null;
    // The source pane's read-only editor: one CodeMirror view per mounted
    // detail column, created on the first selection and reused through the
    // kit's open() for every later one, destroyed when the selection clears.
    let rootEl = null, sourceGeneration = 0, editorReady = null, editorHost = null, shownKey = '';
    const dropEditor = () => {
      const ready = editorReady;
      editorReady = null; editorHost = null; shownKey = '';
      ready?.then(e => e?.destroy(), () => {});
    };

    return {
      description: 'The Overview of a workspace declaring an installation manifest: PowerShell files grouped by installation area, their intended destinations, pending adoption and untested limits, durable observed state, and local-only areas. Opens a selected file in the code workspace, compares a supplied work copy, copies or downloads the captured GitHub revision, shows its source read-only beside the state, and records an explicitly confirmed observation with any adoption closure in one commit.',

      project,
      repo: '', ref: '', revision: '', ledgerPath: '', manifest: null,
      items: [], groups: [], derived: {}, rows: [], checks: [],
      loading: true, err: '',
      filter: '',                 // '' or a state key
      selected: '',               // the selected item's repo path
      text: '', textBusy: false,  // the selected file's GitHub text, fetched on demand
      compareError: '',
      compareRetry: null,         // { file, source }: a supplied file that did not decode as UTF-8, awaiting its encoding
      dragging: false,            // a file or text is being dragged over the selected file's column
      lastTransfer: {},           // path -> 'copy' | 'download', the method a later confirm reports
      pending: null,              // { row, line, why } awaiting the confirm
      recordNote: '', recording: false, recordError: '', recorded: null,
      openHistory: true,
      source: '', sourceState: '', sourceError: '', // the read-only source pane: '' | loading | editor | plain | error
      sourceOpen: false,          // below @3xl the pane is collapsed until Show code
      sourceView: 'code',         // 'code' | 'changes'
      baseline: null,             // { key, label, text }: what the work computer is known to hold
      baselinePick: '',           // a check id the reader chose to compare, over the newest evidence
      baselineBusy: false, baselineNote: '', diffRows: [],

      template: `
        <div class="@container flex flex-col gap-4" data-installation>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <i class="ph ph-desktop text-xl text-base-content/50"></i>
            <!-- The work machine heads this view. "Installation" was the pill's
                 label, and the pill became a workspace's Overview on
                 2026-09-14; the breadcrumb above already names the workspace. -->
            <h2 class="text-lg font-semibold font-mono" x-text="root || 'Installation'"></h2>
            <a x-show="docUrl" :href="docUrl" target="_blank" rel="noopener"
               class="link link-hover text-base">the installation map</a>
            <div class="grow"></div>
            <span x-show="!loading" class="font-mono text-xs text-base-content/50" x-text="headline"></span>
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
                            <!-- flex-wrap with a floor on the name: a narrow pane
                                 drops the badge to a second line rather than
                                 eating the filename. -->
                            <button @click="select(it.path)"
                                    class="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 py-1 rounded text-left text-base hover:bg-base-200 min-w-0"
                                    :class="selected === it.path && 'bg-primary/10'">
                              <i class="ph text-base-content/50 shrink-0" :class="iconOf(it)"></i>
                              <span class="truncate grow min-w-40 basis-0" x-text="it.name"></span>
                              <span class="badge badge-sm whitespace-nowrap shrink-0" :class="badgeOf(it.path)" x-text="stateOf(it.path).label"></span>
                              <span class="font-mono text-xs text-base-content/40 tabular-nums w-20 text-right hidden @md:inline" x-text="when(stateOf(it.path).latest?.date)"></span>
                            </button>
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
                  <div class="flex items-start gap-2">
                    <button @click="select('')" class="btn btn-ghost btn-sm btn-square @3xl:hidden" title="Back to the list">
                      <i class="ph ph-arrow-left text-base"></i></button>
                    <div class="min-w-0 grow">
                      <div class="flex flex-wrap items-center gap-2">
                        <h3 class="text-lg font-semibold truncate" x-text="item.name"></h3>
                        <span class="badge" :class="badgeOf(item.path)" x-text="stateOf(item.path).label"></span>
                      </div>
                      <div class="font-mono text-base text-base-content/60 break-all" x-text="item.path + ' · ' + short(item.blobSha)"></div>
                    </div>
                  </div>
                  <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-base">
                    <dt class="text-base-content/50">installs to</dt>
                    <dd class="font-mono break-all" x-text="destinationOfItem(item)"></dd>
                    <template x-if="item.companion">
                      <dt class="text-base-content/50">companion</dt></template>
                    <template x-if="item.companion">
                      <dd><button @click="select(item.companion)" class="link link-hover font-mono" x-text="item.companion.split('/').pop()"></button>
                        <span class="badge badge-sm ml-1" :class="badgeOf(item.companion)" x-text="stateOf(item.companion).label"></span></dd></template>
                    <dt class="text-base-content/50">GitHub now</dt>
                    <dd class="font-mono" x-text="short(revision) + ' on ' + ref"></dd>
                    <dt class="text-base-content/50">last observed</dt>
                    <dd x-text="observedLine(item)"></dd>
                  </dl>

                  <div x-show="item.pendingAdoption" class="rounded-lg border border-warning/40 p-3 text-base" data-adoption>
                    <div class="font-medium" x-text="item.pendingAdoption?.transfer === 'new' ? 'New repository file awaiting adoption' : 'Repository update awaiting adoption'"></div>
                    <div class="text-sm text-base-content/60" x-text="item.pendingAdoption?.since ? 'Pending since ' + when(item.pendingAdoption.since) : ''"></div>
                    <p class="mt-1" x-text="item.pendingAdoption?.limit || ''"></p>
                    <p x-show="stateOf(item.path).conflict" class="mt-2 text-sm text-error" data-adoption-conflict>This file has an observation row and a pending entry, which contradict each other. The workspace check fails while both exist; remove the entry from installation.json.</p>
                  </div>

                  <!-- The placement flow. What acts on the text itself (copy,
                       download, compare, the changes) sits on the Source header. -->
                  <div class="flex flex-wrap gap-1.5">
                    <button @click="openCodeWorkspace()" class="btn btn-primary btn-sm gap-1">
                      <i class="ph ph-code text-base"></i>Open code workspace</button>
                    <button x-show="item.installs !== null" @click="askInstalled()" class="btn btn-sm gap-1"
                            :class="lastTransfer[item.path] ? 'btn-primary' : 'btn-outline'">
                      <i class="ph ph-check-circle text-base"></i>Mark as installed</button>
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

                  <div>
                    <div class="flex items-center gap-2 text-sm font-medium text-base-content/60">
                      <span>Observations</span>
                      <span class="font-mono text-xs" x-text="historyOf(item).length"></span>
                      <div class="grow"></div>
                      <a :href="ledgerUrl" target="_blank" rel="noopener" class="link link-hover text-xs font-mono">observations.csv</a>
                    </div>
                    <p x-show="!historyOf(item).length" class="text-base text-base-content/50 py-1" x-text="item.pendingAdoption ? 'Nothing recorded for this file. Adoption is still pending.' : 'Nothing recorded for this file. Local state unknown.'"></p>
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

                  <div x-show="checksOf(item).length">
                    <div class="flex items-center gap-2 text-sm font-medium text-base-content/60">
                      <span>Checks in this browser</span>
                      <span class="font-mono text-xs" x-text="checksOf(item).length"></span>
                    </div>
                    <div class="flex flex-col">
                      <template x-for="(c, i) in checksOf(item)" :key="c.id">
                        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1 text-base" :class="i && 'border-t border-base-200'">
                          <span class="font-mono text-xs tabular-nums" x-text="when(c.checkedAt)"></span>
                          <span :class="c.exact ? 'text-success' : c.lineEndingsOnly ? 'text-success' : 'text-warning'"
                                x-text="c.exact ? 'matched revision' : c.lineEndingsOnly ? 'matched, line endings differ' : 'differed from revision'"></span>
                          <span class="font-mono text-base text-base-content/60" x-text="short(c.revision) + ' · ' + c.source"></span>
                          <div class="grow"></div>
                          <button x-show="!isRecorded(c)" @click="askCheck(c)" class="btn btn-outline btn-xs">Record</button>
                          <span x-show="isRecorded(c)" class="text-base text-base-content/60">recorded</span>
                          <button x-show="c.content" @click="showCheck(c)" class="btn btn-ghost btn-xs"
                                  :class="baseline?.key === 'check:' + c.id && sourceView === 'changes' && 'btn-active'">Changes</button>
                        </div>
                      </template>
                    </div>
                  </div>

                  <!-- The source at the captured revision, read-only: the Code
                       workspace is where it is edited. Its header carries what
                       acts on the text: copy and download for placing it, and
                       the two ways to compare a work copy against it (the
                       clipboard, through the app's Paste, and a chosen file; a
                       drop anywhere on the column is the third). Below @3xl the
                       detail column is its own screen, so the code stays
                       collapsed and Mark as installed stays above the fold. A
                       <pre> stands in when the editor kit cannot load.

                       Changes compares what the work computer is known to hold
                       with GitHub now: the newest of a copy supplied in this
                       browser and the version the ledger last recorded. It is
                       the default view whenever the two differ, since that is
                       the update a placement would make. -->
                  <div class="flex flex-col gap-1.5" data-source>
                    <div class="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm font-medium text-base-content/60">
                      <span>Source</span>
                      <span x-show="sourceState === 'loading' || baselineBusy" class="loading loading-dots loading-xs opacity-50 ml-1"></span>
                      <div x-show="hasChanges" class="join ml-2" data-source-views>
                        <button @click="setSourceView('code')" class="btn btn-xs join-item" :class="sourceView === 'code' && 'btn-active'">Code</button>
                        <button @click="setSourceView('changes')" class="btn btn-xs join-item" :class="sourceView === 'changes' && 'btn-active'">Changes</button>
                      </div>
                      <div class="grow"></div>
                      <div class="flex items-center" data-source-tools>
                        <button @click="copyText()" :disabled="!!textBusy" class="btn btn-ghost btn-sm btn-square"
                                title="Copy" aria-label="Copy GitHub text"><i class="ph ph-copy text-lg"></i></button>
                        <button @click="downloadText()" :disabled="!!textBusy" class="btn btn-ghost btn-sm btn-square"
                                title="Download" aria-label="Download GitHub text"><i class="ph ph-download-simple text-lg"></i></button>
                        <template x-if="item.comparable">
                          <div class="flex items-center">
                            <button @click="compareClipboard()" class="btn btn-ghost btn-sm btn-square"
                                    title="Compare clipboard" aria-label="Compare the clipboard with this file"><i class="ph ph-clipboard-text text-lg"></i></button>
                            <label class="btn btn-ghost btn-sm btn-square" title="Compare file" aria-label="Compare a file with this file">
                              <i class="ph ph-file-arrow-up text-lg"></i>
                              <input type="file" accept=".ps1,.psm1,.psd1,.ps1xml,.xaml,.txt" class="hidden" @change="comparePicked($event)"></label>
                          </div>
                        </template>
                      </div>
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
                      <!-- Class bindings, not x-show: x-show defers a hide to the
                           next frame, so a plain, loading, plain flip inside one
                           frame left the <pre> hidden. -->
                      <p :class="sourceState === 'error' ? '' : 'hidden'" class="text-sm text-error" x-text="sourceError"></p>
                      <p x-show="baselineNote" class="text-sm text-base-content/60 pb-1" x-text="baselineNote"></p>
                      <div :class="[showingChanges ? '' : 'hidden', dropRing]" data-source-diff role="table"
                           class="max-h-96 @3xl:max-h-[32rem] overflow-auto rounded-lg border font-mono text-sm leading-6"
                           :aria-label="(baseline?.label || '') + ' compared with GitHub now'">
                        <div class="sticky top-0 z-10 bg-base-200 text-xs text-base-content/70 py-1.5 px-3 flex flex-wrap gap-x-4 font-sans">
                          <span x-text="'− ' + (baseline?.label || '')"></span><span x-text="'+ GitHub now at ' + short(revision)"></span></div>
                        <template x-for="(r, i) in diffRows" :key="i">
                          <div class="flex min-w-max" role="row" :class="r.type === 'add' ? 'bg-success/10' : r.type === 'del' ? 'bg-error/10' : ''">
                            <span class="w-10 text-right shrink-0 text-base-content/60 text-xs px-1 pt-0.5" role="rowheader" x-text="r.type === 'del' ? r.a : r.b"></span>
                            <span class="w-6 text-center shrink-0" role="cell" :aria-label="r.type === 'add' ? 'Added' : r.type === 'del' ? 'Removed' : 'Unchanged'" x-text="r.type === 'add' ? '+' : r.type === 'del' ? '−' : ' '"></span>
                            <pre class="pr-4" role="cell" x-text="r.text || ' '"></pre></div>
                        </template>
                      </div>
                      <div :class="[(sourceState === 'loading' || sourceState === 'editor') && !showingChanges ? '' : 'hidden', dropRing]" data-source-editor
                           class="h-96 @3xl:h-[32rem] rounded-lg border overflow-hidden text-sm"></div>
                      <pre :class="[sourceState === 'plain' && !showingChanges ? '' : 'hidden', dropRing]" data-source-plain
                           class="max-h-96 @3xl:max-h-[32rem] overflow-auto rounded-lg border p-2 font-mono text-sm" x-text="source"></pre>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>`,

      init() {
        rootEl = this.$el;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
        this._onCheck = async e => {
          await this.loadChecks();
          const fresh = e?.detail;
          if (fresh && fresh.path === this.selected) this.baselinePick = '';
          if (this.selected && this.source) this.loadBaseline(fresh?.path === this.selected);
        };
        window.addEventListener('correspondence-check', this._onCheck);
        this.reload();
      },
      destroy() {
        loadGeneration++; textGeneration++; checkGeneration++; sourceGeneration++;
        dropEditor();
        window.removeEventListener('correspondence-check', this._onCheck);
        if (shell()) shell().installationItem = '';
      },

      get root() { return this.manifest?.root || ''; },
      get states() {
        const counts = K().summary(Object.values(this.derived));
        return K().STATES.filter(s => counts[s]).map(s => ({ key: s, label: K().LABELS[s], count: counts[s] }));
      },
      get headline() {
        const counts = K().summary(Object.values(this.derived));
        const parts = [this.items.length + ' files'];
        for (const s of K().STATES) if (counts[s]) parts.push(counts[s] + ' ' + K().LABELS[s]);
        return short(this.revision) + ' · ' + parts.join(' · ');
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
      // The explanation the manifest deliberately does not carry. Linked
      // rather than summarized here, so the mappings and statuses on this
      // pane and the reasoning behind them stay one statement each.
      get docUrl() {
        const doc = this.manifest?.doc;
        return doc && window.GithubLinks?.pathUrl ? window.GithubLinks.pathUrl(this.repo, doc, this.ref) : '';
      },
      short, when,
      stateOf(path) { return this.derived[path] || { state: 'unknown', label: K().LABELS.unknown, latest: null, history: [] }; },
      badgeOf(path) { return BADGE[this.stateOf(path).state] || 'badge-ghost'; },
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
      destinationOfItem(it) {
        if (it.installs === null) return 'no installation destination (repository only)';
        if (it.installs === '') return this.root + '\\ (filename unverified)';
        return this.root + '\\' + it.installs.replace(/\//g, '\\');
      },
      rowLabel(r) {
        return r.kind === 'installed' ? 'reported installed' : r.kind === 'verified'
          ? (r.match === 'line-endings' ? 'verified, line endings differ' : 'verified from supplied copy') : 'local copy differed';
      },
      observedLine(it) {
        const s = this.stateOf(it.path);
        if (!s.latest) return 'never';
        // Name what moved. "which is what GitHub holds now" read as a claim
        // about the revision, when the comparison is between the file's blob
        // then and its blob now, and the revision has usually moved either way.
        return when(s.latest.date) + ' · ' + this.rowLabel(s.latest) + ' at ' + short(s.latest.revision)
          + (s.latest.blob_sha === it.blobSha ? ', and this file has not changed since'
                                              : ', and this file has changed on GitHub since');
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
          await this.loadChecks();
          if (generation !== loadGeneration) return;
          if (!this.selected && shell()?.installationItem && this.items.some(it => it.path === shell().installationItem))
            this.selected = shell().installationItem;
          if (this.selected) this.loadSource();
        } catch (e) { if (generation === loadGeneration) this.err = 'Could not read the installation: ' + (e?.message || e); }
        finally { if (generation === loadGeneration) this.loading = false; }
      },
      async readRows(gh, ledgerPath) {
        let text = '';
        try { text = (await gh.get(ledgerPath, window.GH?.FRESH)).text; }
        catch (e) { if (e?.status !== 404) throw e; }
        return K().observations(text);
      },
      async loadChecks() {
        const generation = ++checkGeneration, repo = this.repo;
        let checks = [];
        try { checks = window.FileCorrespondence?.checksUnder ? await window.FileCorrespondence.checksUnder(repo, this.project.path + '/') : []; }
        catch {}
        if (generation === checkGeneration && repo === this.repo) this.checks = checks;
      },

      // ── Selection ────────────────────────────────────────────────────────
      select(path) {
        textGeneration++; textCache = null;
        this.selected = path; this.compareError = ''; this.compareRetry = null; this.dragging = false;
        this.pending = null; this.recorded = null; this.recordError = ''; this.recordNote = ''; this.text = ''; this.textBusy = false;
        this.source = ''; this.sourceOpen = false; this.sourceView = 'code';
        this.baseline = null; this.baselinePick = ''; this.baselineNote = ''; this.diffRows = [];
        if (shell()) { shell().installationItem = path; shell().syncUrl?.(); }
        this.loadSource();
      },
      target() {
        const it = this.item;
        return it ? { repo: this.repo, ref: this.revision || this.ref, path: it.path } : null;
      },
      openCodeWorkspace() { if (this.item) shell()?.goProject?.(this.project.path, 'code', this.selected); },

      // ── Compare a work copy (browser-local check, then the Stage diff) ───
      // Three intakes, one flow: the clipboard through the app's Paste (which
      // routes to this selection by itself), a chosen file, and a drop on the
      // column. A page-wide paste or drop reaches the same shell flow.
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
          const selection = this.captureSelection();
          this.compareError = ''; this.compareRetry = null;
          try { await shell().openCorrespondence(this.target(), text, this.item.name, 'drop'); }
          catch (err) { if (this.sameSelection(selection)) this.compareError = err?.message || String(err); }
          await this.loadChecks();
        }
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
        try { await shell().openCorrespondence(target, text, file.name, source); }
        catch (e) { if (this.sameSelection(selection)) this.compareError = e?.message || String(e); }
        await this.loadChecks();
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
        if (textCache?.key === selection.key) return textCache.text;
        const generation = quiet ? textGeneration : ++textGeneration;
        if (!quiet) this.textBusy = true;
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: selection.repo, ref: selection.revision || selection.ref });
          const f = await gh.get(selection.path);
          if (selection.blobSha && f.sha !== selection.blobSha) throw new Error('This file changed. Reload the installation before transferring or recording it.');
          if (generation === textGeneration && this.sameSelection(selection)) {
            textCache = { key: selection.key, text: f.text };
            this.text = f.text;
          }
          return f.text;
        } finally { if (!quiet && generation === textGeneration) this.textBusy = false; }
      },

      // ── The source pane: read-only, fetched and mounted on selection ─────
      async loadSource() {
        const selection = this.captureSelection(), generation = ++sourceGeneration;
        if (!selection) { dropEditor(); this.source = ''; this.sourceState = ''; this.sourceError = ''; return; }
        this.sourceState = 'loading'; this.sourceError = '';
        let text;
        try { text = await this.fetchText(selection, { quiet: true }); }
        catch (e) {
          if (generation === sourceGeneration) { this.sourceState = 'error'; this.sourceError = 'Could not read the source: ' + (e?.message || e); }
          return;
        }
        if (generation !== sourceGeneration || !this.sameSelection(selection)) return;
        this.source = text;
        this.loadBaseline(true);
        await this.$nextTick();
        const host = rootEl?.querySelector('[data-source-editor]');
        if (generation !== sourceGeneration) return;
        if (!host || !window.PowerShellEditor?.create) { this.sourceState = 'plain'; return; }
        try {
          if (editorHost !== host) {
            dropEditor();
            editorHost = host; shownKey = selection.key;
            editorReady = window.PowerShellEditor.create(host, { value: text, path: selection.path, readOnly: true });
          }
          const ready = editorReady, editor = await ready;
          if (generation !== sourceGeneration || ready !== editorReady) return;
          if (!editor) { this.sourceState = 'plain'; return; }
          if (shownKey !== selection.key) { editor.open(selection.key, text, selection.path); shownKey = selection.key; }
          this.sourceState = 'editor';
        } catch {
          if (generation === sourceGeneration) { dropEditor(); this.sourceState = 'plain'; }
        }
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
        const checks = this.checksOf(item).filter(c => typeof c.content === 'string');
        const check = checks.find(c => c.id === this.baselinePick) || (!this.baselinePick && checks[0]) || null;
        const latest = this.stateOf(item.path).history[0] || null;
        const row = latest && (latest.kind === 'installed' || latest.kind === 'verified') ? latest : null;
        const useCheck = check && (this.baselinePick === check.id || !latest || String(check.checkedAt) >= String(latest.date));
        let baseline = null, note = '';
        if (useCheck) baseline = { key: 'check:' + check.id, label: 'Copy supplied ' + when(check.checkedAt), text: check.content };
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
        } else if (item.pendingAdoption?.transfer === 'new') {
          note = 'New file: the work computer has no copy yet.';
        } else if (item.comparable && item.installs !== null) {
          note = 'Nothing records what the work computer holds. Compare its copy to see the difference.';
        }
        if (generation !== sourceGeneration || !this.sameSelection(selection)) return;
        if (baseline && !window.textDiff?.lines) note = 'The text comparison tool did not load, so Changes is unavailable.';
        this.baseline = baseline; this.baselineNote = note;
        this.diffRows = baseline ? this.diffOf(baseline.text, this.source) : [];
        if (openChanges) this.sourceView = this.hasChanges ? 'changes' : 'code';
        else if (!this.hasChanges) this.sourceView = 'code';
      },
      diffOf(before, after) {
        const lines = t => t === '' ? [] : t.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
        const a = lines(before), b = lines(after);
        if (!window.textDiff?.lines) return [];
        return window.textDiff.lines(a, b).map(op => ({ type: op.type, a: op.a === undefined ? '' : op.a + 1,
          b: op.b === undefined ? '' : op.b + 1, text: op.type === 'add' ? b[op.b] : a[op.a] }));
      },
      showCheck(check) {
        if (check.path !== this.selected) return;
        this.baselinePick = check.id; this.sourceOpen = true;
        this.loadBaseline(true);
      },
      setSourceView(view) {
        this.sourceView = view;
        if (view === 'code') this.$nextTick(() => editorReady?.then(e => e?.refresh(), () => {}));
      },
      toggleSource() {
        this.sourceOpen = !this.sourceOpen;
        if (this.sourceOpen) this.$nextTick(() => editorReady?.then(e => e?.refresh(), () => {}));
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
