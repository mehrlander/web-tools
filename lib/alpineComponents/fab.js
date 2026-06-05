document.addEventListener('alpine:init', function() {
  Alpine.data('fab', function() {
    return {
      description: 'Draggable floating button: opens a right-side drawer with tabs for Alpine components on the page (tap to outline in place), scripts pulled in via gh.load() (with per-entry status), and a Render tab that re-loads the current page at any branch/tag/sha in an overlay iframe, plus a collapsible console (rich debugConsole panel with expandable JSON-tree / table views, falling back to a plain log list). The header carries a version readout: the booted ref, tip sha, and the latest PR merge included, plus any commits sitting on top of it (direct pushes or an unmerged branch)',

      template: `
        <div :style="'transform:translate(' + x + 'px,' + y + 'px)'"
             @pointerdown="onDown($event)"
             @pointermove="onMove($event)"
             @pointerup="onUp($event)"
             @pointercancel="onUp($event)"
             class="fixed bottom-6 right-6 group touch-none z-[55]">
          <div tabindex="0" role="button" aria-label="Web-tools panel" class="size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center cursor-grab active:cursor-grabbing outline-none transition-all duration-300 hover:bg-primary/20 hover:border-primary/40 focus:bg-primary focus:border-primary focus:shadow-lg focus:shadow-primary/30"
               :class="open ? 'bg-primary/30 border-primary/50' : ''">
            <i class="ph ph-sidebar-simple text-2xl text-primary/40 group-hover:text-primary/70 group-focus:text-primary-content transition-colors"
               :class="open ? 'text-primary' : ''"></i>
          </div>
        </div>

        <div class="fixed inset-y-0 right-0 z-50 transition-transform duration-300 ease-out pointer-events-none"
             :class="open ? 'translate-x-0' : 'translate-x-full'"
             style="width: 22rem; max-width: 92vw;">
          <div class="h-full bg-base-100 border-l border-base-300 shadow-2xl flex flex-col pointer-events-auto">
            <header class="px-2 py-1.5 border-b border-base-300 flex items-center justify-between gap-2 shrink-0">
              <div class="flex items-center gap-0.5">
                <button @click="activeTab = 'components'"
                        class="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold transition-colors"
                        :class="activeTab === 'components' ? 'bg-primary/10 text-primary' : 'text-base-content/60 hover:bg-base-200'">
                  <i class="ph ph-puzzle-piece text-sm"></i>
                  <span>Components</span>
                  <span x-show="totalInstances" class="font-mono text-[10px] opacity-60" x-text="totalInstances"></span>
                </button>
                <button @click="activeTab = 'scripts'"
                        class="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold transition-colors"
                        :class="activeTab === 'scripts' ? 'bg-primary/10 text-primary' : 'text-base-content/60 hover:bg-base-200'">
                  <i class="ph ph-code text-sm"></i>
                  <span>Scripts</span>
                  <span x-show="loadedScripts.length" class="font-mono text-[10px] opacity-60" x-text="loadedScripts.length"></span>
                </button>
                <button @click="activeTab = 'render'; loadFrameBranches()"
                        class="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold transition-colors"
                        :class="activeTab === 'render' ? 'bg-primary/10 text-primary' : 'text-base-content/60 hover:bg-base-200'">
                  <i class="ph ph-monitor-play text-sm"></i>
                  <span>Render</span>
                </button>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button x-show="activeTab === 'components'" @click="detect()" class="btn btn-ghost btn-xs btn-square" title="Rescan page" aria-label="Rescan">
                  <i class="ph ph-arrows-clockwise"></i>
                </button>
              </div>
            </header>

            <div class="flex-1 overflow-y-auto">
              <div class="p-2 border-b border-base-300/60">
                <template x-if="repo">
                  <a :href="'https://github.com/' + repo" target="_blank" class="px-1 font-mono text-xs font-bold link link-hover block" x-text="repo"></a>
                </template>
                <div x-show="!repo" class="px-1 font-mono text-xs font-bold">Source unknown</div>
                <div x-show="path" class="px-1 font-mono text-[10px] text-base-content/60 truncate" x-text="path"></div>

                <div x-show="ver || verLoading || verError" class="px-1 mt-1.5 pt-1.5 border-t border-base-300/40">
                  <div class="flex items-center gap-1.5 text-[10px] font-mono">
                    <i class="ph ph-git-commit opacity-50 shrink-0"></i>
                    <span x-show="verLoading" class="opacity-50">checking version…</span>
                    <template x-if="ver && !verLoading">
                      <span class="flex flex-wrap items-center gap-x-1.5 min-w-0">
                        <span class="opacity-50" x-text="ver.ref"></span>
                        <a :href="ver.tipUrl" target="_blank" class="link link-hover font-semibold" x-text="'@' + ver.sha"></a>
                        <template x-if="ver.pr">
                          <a :href="ver.prUrl" target="_blank" class="link link-hover text-primary" x-text="'merge #' + ver.pr"></a>
                        </template>
                        <span x-show="!ver.pr" class="opacity-40">no recent merge</span>
                        <span x-show="ver.since > 0" class="opacity-60" title="commits on top of the latest merge (direct pushes or an unmerged branch)" x-text="'+' + ver.since"></span>
                        <span x-show="ver.ago" class="opacity-40" x-text="ver.ago"></span>
                      </span>
                    </template>
                    <button @click="loadVersion(true)" class="ml-auto opacity-40 hover:opacity-80 shrink-0" title="Refresh version" aria-label="Refresh version">
                      <i class="ph ph-arrows-clockwise"></i>
                    </button>
                  </div>
                  <div x-show="ver && ver.prTitle && !verLoading" class="text-[10px] opacity-50 truncate mt-0.5 pl-4" x-text="ver && ver.prTitle"></div>
                  <div x-show="verError" class="text-[10px] text-error/70 break-all mt-0.5 pl-4" x-text="verError"></div>
                </div>

                <div x-show="repo" class="flex gap-1 mt-1.5">
                  <template x-for="link in pageLinks" :key="link.l">
                    <a :href="link.u" target="_blank" :title="link.l"
                       class="flex-1 flex items-center justify-center gap-1.5 bg-base-200 hover:bg-base-300 rounded-lg py-1.5 text-xs">
                      <i class="ph text-sm" :class="link.i"></i>
                    </a>
                  </template>
                </div>
              </div>

              <div x-show="activeTab === 'components'">
                <div x-show="groups.length > 0" class="p-2 space-y-2">
                  <div class="flex items-center justify-between px-1">
                    <div class="text-[10px] uppercase tracking-wider text-base-content/50 font-semibold">Instances</div>
                    <button @click="clearHighlight()" x-show="highlighted" class="text-[10px] font-normal link link-hover">clear</button>
                  </div>
                  <template x-for="g in groups" :key="g.name">
                    <div class="bg-base-200/40 rounded-lg overflow-hidden border border-base-300/60">
                      <div class="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-base-200/80">
                        <div class="flex items-baseline gap-1.5 min-w-0">
                          <span class="font-mono text-sm font-semibold truncate" x-text="g.name"></span>
                          <span class="text-[10px] font-mono text-base-content/50 shrink-0">&times;<span x-text="g.instances.length"></span></span>
                        </div>
                        <div class="flex gap-0.5 shrink-0">
                          <template x-for="link in linksFor(componentPath(g.name))" :key="link.l">
                            <a :href="link.u" target="_blank" :title="link.l"
                               class="size-6 flex items-center justify-center bg-base-100 hover:bg-base-300 rounded">
                              <i class="ph text-xs" :class="link.i"></i>
                            </a>
                          </template>
                        </div>
                      </div>
                      <div x-show="g.description" class="text-[11px] text-base-content/70 px-2.5 py-1 border-t border-base-300/40" x-text="g.description"></div>
                      <div class="flex flex-col">
                        <template x-for="(inst, idx) in g.instances" :key="inst.id">
                          <button @click="highlight(inst.id)"
                                  class="text-left px-2.5 py-1.5 text-xs flex items-center gap-2 border-t border-base-300/40 transition-colors"
                                  :class="highlighted === inst.id ? 'bg-primary/15 text-primary' : 'hover:bg-base-300/40'">
                            <i class="ph shrink-0" :class="highlighted === inst.id ? 'ph-crosshair-simple text-sm' : 'ph-crosshair text-sm opacity-50'"></i>
                            <span class="font-mono opacity-60 shrink-0" x-text="'#' + (idx + 1)"></span>
                            <span class="truncate" x-text="inst.label"></span>
                          </button>
                        </template>
                      </div>
                    </div>
                  </template>
                </div>

                <div x-show="groups.length === 0" class="text-xs text-base-content/50 italic px-3 py-6 text-center">
                  No Alpine components detected on this page.
                </div>
              </div>

              <div x-show="activeTab === 'scripts'">
                <div x-show="loadedScripts.length === 0" class="text-xs text-base-content/50 italic px-3 py-6 text-center">
                  No scripts tracked. gh-boot.js installs the registry; older cached gh-api.js won't populate it.
                </div>
                <div x-show="loadedScripts.length > 0" class="p-2 space-y-1">
                  <template x-for="(s, idx) in loadedScripts" :key="idx">
                    <div class="rounded bg-base-200/40 border border-base-300/60 overflow-hidden">
                      <div class="flex items-center gap-2 px-2 py-1.5">
                        <i class="ph shrink-0 text-sm"
                           :class="s.status === 'ok' ? 'ph-check-circle text-success' :
                                   s.status === 'error' ? 'ph-x-circle text-error' :
                                   'ph-circle-notch animate-spin text-warning'"></i>
                        <a :href="scriptUrl(s.path)" target="_blank"
                           class="flex-1 font-mono text-[11px] truncate link link-hover" x-text="s.path"></a>
                        <span x-show="s.auto" class="text-[10px] text-base-content/50 shrink-0">auto</span>
                        <span x-show="s.by && s.by.size > 0" class="text-[10px] text-base-content/60 shrink-0">
                          <span class="opacity-50">by:</span> <span x-text="Array.from(s.by || []).join(', ')"></span>
                        </span>
                        <span class="font-mono text-[10px] text-base-content/40 shrink-0" x-text="fmtElapsed(s)"></span>
                      </div>
                      <div x-show="s.error" class="px-2 pb-1.5 font-mono text-[10px] text-error break-all" x-text="s.error"></div>
                    </div>
                  </template>
                </div>
              </div>

              <div x-show="activeTab === 'render'">
                <div x-show="!path" class="text-xs text-base-content/50 italic px-3 py-6 text-center">
                  No page path detected on this URL.
                </div>
                <template x-if="path">
                  <div class="p-2 flex flex-col gap-2">
                    <div>
                      <div class="text-[10px] uppercase tracking-wider opacity-50 font-semibold mb-0.5">Page</div>
                      <div class="font-mono text-[11px] truncate" x-text="path"></div>
                    </div>
                    <div>
                      <div class="text-[10px] uppercase tracking-wider opacity-50 font-semibold mb-0.5">Ref</div>
                      <div class="flex gap-1">
                        <input x-model="frameRefInput" placeholder="branch / tag / sha"
                               @keyup.enter="applyFrameRef()"
                               class="input input-xs input-bordered flex-1 font-mono text-[11px]">
                        <button @click="applyFrameRef()" :disabled="!frameRefInput.trim()" class="btn btn-xs btn-primary">Set</button>
                      </div>
                      <div class="text-[10px] text-base-content/50 mt-1">
                        Selected: <span class="font-mono text-base-content/80" x-text="frameRef || 'main'"></span>
                      </div>
                    </div>
                    <button @click="openFrame()" class="btn btn-sm btn-primary gap-1 w-full"><i class="ph ph-play"></i>Render</button>
                    <div x-show="frameError" class="text-[10px] text-error font-mono break-all" x-text="frameError"></div>

                    <div class="border-t border-base-300/60 pt-2">
                      <div class="text-[10px] uppercase tracking-wider opacity-50 font-semibold mb-1">Export</div>
                      <label class="flex items-center gap-1.5 text-[11px] mb-1 cursor-pointer">
                        <input type="checkbox" x-model="exportOffline" class="checkbox checkbox-xs" />
                        <span>Fully offline (inline code)</span>
                      </label>
                      <button @click="exportPage()" :disabled="exportBusy" class="btn btn-sm gap-1 w-full">
                        <span x-show="!exportBusy" class="flex items-center gap-1">
                          <i class="ph ph-file-archive"></i><span x-text="exportOffline ? 'Export offline page' : 'Export page + data'"></span>
                          <span x-show="reads.length" class="opacity-60" x-text="'(' + reads.length + ')'"></span>
                        </span>
                        <span x-show="exportBusy" class="loading loading-spinner loading-xs"></span>
                      </button>
                      <div x-show="exportMsg" class="text-[10px] text-success font-mono break-all mt-1" x-text="exportMsg"></div>
                      <div x-show="exportError" class="text-[10px] text-error font-mono break-all mt-1" x-text="exportError"></div>
                      <div x-show="!exportOffline" class="text-[10px] text-base-content/40 leading-snug mt-1">Page source + the data it <code>read()</code>s, zipped so unzip-and-open resolves local. Code still loads from the CDN — local data, not offline.</div>
                      <div x-show="exportOffline" class="text-[10px] text-base-content/40 leading-snug mt-1">Page + data + its whole <code>gh.load</code> chain inlined, so unzip-and-open works with no network. Third-party libs (Tailwind/Alpine) still come from the CDN.</div>
                    </div>

                    <div class="border-t border-base-300/60 pt-2">
                      <div class="flex items-center justify-between mb-1">
                        <div class="text-[10px] uppercase tracking-wider opacity-50 font-semibold">Branches</div>
                        <button @click="loadFrameBranches(true)" class="text-[10px] link link-hover"
                                :class="frameBranchesLoading ? 'opacity-50 pointer-events-none' : ''">refresh</button>
                      </div>
                      <div x-show="frameBranchesLoading" class="flex justify-center py-3">
                        <span class="loading loading-dots loading-sm opacity-50"></span>
                      </div>
                      <div x-show="!frameBranchesLoading" class="flex flex-col gap-0.5 overflow-y-auto" style="max-height: 50vh;">
                        <template x-for="b in frameBranches" :key="b.name">
                          <button @click="pickFrameRef(b.name)"
                                  class="flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] font-mono text-left transition-colors"
                                  :class="b.name === frameRef ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-base-300/50'">
                            <i class="ph ph-git-branch text-xs opacity-50 shrink-0"></i>
                            <span class="truncate" x-text="b.name"></span>
                            <span x-show="b.ago" class="ml-auto shrink-0 opacity-40 text-[10px]"
                                  x-text="b.ago" :title="b.date"></span>
                            <i x-show="b.name === frameRef" class="ph ph-check text-xs shrink-0"
                               :class="b.ago ? '' : 'ml-auto'"></i>
                          </button>
                        </template>
                        <div x-show="!frameBranches.length" class="text-[10px] opacity-50 py-1 px-1">No branches loaded.</div>
                      </div>
                    </div>
                    <div class="text-[10px] text-base-content/40 leading-snug">Re-renders this page at the selected ref in an overlay box.</div>
                  </div>
                </template>
              </div>
            </div>

            <div class="shrink-0 border-t border-base-300 flex flex-col">
              <div @click="toggleConsole()" role="button" tabindex="0"
                   class="flex items-center justify-between gap-2 px-3 py-1.5 cursor-pointer select-none hover:bg-base-200/60 transition-colors">
                <div class="flex items-center gap-1.5 text-xs font-semibold text-base-content/70">
                  <i class="ph ph-terminal text-sm"></i>
                  <span>Console</span>
                  <span x-show="errorCount" x-text="errorCount"
                        class="inline-flex items-center justify-center text-[9px] font-bold leading-none rounded-full bg-error text-error-content px-1 min-w-[14px]"></span>
                  <span x-show="consoleLogs.length" class="font-mono text-[10px] opacity-50" x-text="consoleLogs.length"></span>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button x-show="consoleOpen && consoleLogs.length" @click.stop="clearConsole()" class="btn btn-ghost btn-xs btn-square" title="Clear console" aria-label="Clear console">
                    <i class="ph ph-trash"></i>
                  </button>
                  <i class="ph text-base-content/40" :class="consoleOpen ? 'ph-caret-down' : 'ph-caret-up'"></i>
                </div>
              </div>
              <div x-show="consoleOpen" class="border-t border-base-300/60 flex flex-col" style="max-height: 40vh;">
                <div x-show="consolePanelReady" class="flex-1 min-h-0 flex flex-col">
                  <div x-ref="consoleHost" class="flex-1 min-h-0 flex flex-col"></div>
                </div>
                <div x-show="!consolePanelReady" id="__fab-console-panel" class="overflow-y-auto p-1 flex flex-col gap-0.5" style="max-height: 40vh;">
                  <div x-show="consoleLogs.length === 0" class="text-xs text-base-content/50 italic px-3 py-6 text-center">No console output captured.</div>
                  <template x-for="(entry, idx) in consoleLogs" :key="idx">
                    <div class="flex gap-1.5 items-baseline px-1.5 py-0.5 rounded border-l-2 font-mono text-[11px] text-base-content"
                         :class="entry.level === 'error' ? 'border-error bg-error/10' :
                                 entry.level === 'warn'  ? 'border-warning bg-warning/10' :
                                                           'border-base-300 bg-base-100'">
                      <span class="text-base-content/30 shrink-0 text-[10px]" x-text="fmtTime(entry.time)"></span>
                      <span class="shrink-0 w-8 text-[10px] uppercase font-bold"
                            :class="entry.level === 'error' ? 'text-error' : entry.level === 'warn' ? 'text-warning' : 'text-base-content/40'"
                            x-text="entry.level"></span>
                      <span class="break-all whitespace-pre-wrap" x-text="entry.msg"></span>
                    </div>
                  </template>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div x-show="frameOpen" style="display:none" class="fixed inset-0 z-[60] flex flex-col bg-base-300/40 backdrop-blur-sm">
          <div class="shrink-0 bg-base-100 border-b border-base-300 px-3 py-1.5 flex items-center gap-2">
            <i class="ph ph-monitor-play text-primary shrink-0"></i>
            <span class="font-mono text-xs font-semibold truncate" x-text="frameLabel"></span>
            <span x-show="frameLoading" class="loading loading-spinner loading-xs text-primary"></span>
            <button @click="closeFrame()" class="ml-auto btn btn-ghost btn-xs btn-square shrink-0" title="Close" aria-label="Close">
              <i class="ph ph-x"></i>
            </button>
          </div>
          <iframe x-ref="frame" class="flex-1 w-full border-0 bg-base-100"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"></iframe>
        </div>`,

      x: 0, y: 0, sx: 0, sy: 0,
      down: false, dragged: false,

      open: false,
      consoleOpen: false,
      consolePanelReady: false,
      activeTab: 'components',
      groups: [],
      consoleLogs: [],
      loadedScripts: [],
      highlighted: null,

      ver: null, verLoading: false, verError: '', verLoaded: false,

      frameOpen: false,
      frameRef: 'main', frameRefInput: '',
      frameBranches: [], frameBranchesLoading: false, frameBranchesLoaded: false,
      frameLoading: false, frameError: '',

      reads: [],
      exportBusy: false, exportMsg: '', exportError: '', exportOffline: false,

      repo: '',
      path: '',
      ref: 'main',
      showRepoBase: 'https://mehrlander.github.io/web-tools/pages/show-repo/show-repo.html',

      init() {
        this.$el.innerHTML = this.template;
        this._elById = new Map();
        this._instanceCounter = 0;
        this._ensureHighlightStyle();
        this.$nextTick(() => Alpine.initTree(this.$el));
        this.infer();
        this.frameRef = this.ref || 'main';
        // Console counts (header badges) + fallback list. Prefer the
        // retention kit (kits/console.js); fall back to gh-api's raw
        // __consoleLogs + 'consolelog' event. The rich panel, mounted
        // below, is the primary renderer once it's available.
        if (window.consoleKit) {
          this._offConsole = console.subscribe(e => {
            if (e.clear) { this.consoleLogs = []; return; }
            this.consoleLogs.push({ level: e.level, msg: e.msg, time: e.time });
            if (this.open && this.consoleOpen && !this.consolePanelReady) this.scrollConsole();
          });
        } else {
          this.consoleLogs = window.__consoleLogs ? [...window.__consoleLogs] : [];
          this._consoleListener = e => {
            this.consoleLogs.push(e.detail);
            if (this.open && this.consoleOpen && !this.consolePanelReady) this.scrollConsole();
          };
          window.addEventListener('consolelog', this._consoleListener);
        }
        this._mountConsolePanel();

        this.loadedScripts = window.__loadedScripts ? window.__loadedScripts.map(s => ({ ...s })) : [];
        this._scriptsListener = () => {
          this.loadedScripts = window.__loadedScripts ? window.__loadedScripts.map(s => ({ ...s })) : [];
        };
        window.addEventListener('loadedscripts', this._scriptsListener);

        // read() registry (gh-boot wraps read() to populate window.__reads) —
        // drives the Bundle affordance's "page + N data files" count.
        this.reads = window.__reads ? [...window.__reads] : [];
        this._readsListener = () => { this.reads = window.__reads ? [...window.__reads] : []; };
        window.addEventListener('reads', this._readsListener);
      },

      destroy() {
        if (this._offConsole) this._offConsole();
        if (this._consoleListener) window.removeEventListener('consolelog', this._consoleListener);
        if (this._scriptsListener) window.removeEventListener('loadedscripts', this._scriptsListener);
        if (this._readsListener) window.removeEventListener('reads', this._readsListener);
      },

      infer() {
        const ds = this.$root.dataset || {};
        if (ds.showRepoBase) this.showRepoBase = ds.showRepoBase;
        if (ds.ref) this.ref = ds.ref;

        if (ds.repo) {
          this.repo = ds.repo;
          this.path = ds.path || '';
          return;
        }

        const m = location.hostname.match(/^([^.]+)\.github\.io$/);
        if (!m) return;
        const owner = m[1];
        const segs = location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
        if (!segs.length) {
          this.repo = owner + '/' + owner + '.github.io';
          this.path = '';
        } else {
          this.repo = owner + '/' + segs[0];
          this.path = segs.slice(1).join('/');
        }
      },

      onDown(e) {
        this.down = true;
        this.dragged = false;
        this.sx = e.clientX - this.x;
        this.sy = e.clientY - this.y;
        e.currentTarget.setPointerCapture(e.pointerId);
      },

      onMove(e) {
        if (!this.down) return;
        const nx = e.clientX - this.sx;
        const ny = e.clientY - this.sy;
        if (!this.dragged && Math.hypot(nx - this.x, ny - this.y) > 4) this.dragged = true;
        const size = 56, edge = 24;
        const w = window.innerWidth, h = window.innerHeight;
        this.x = Math.min(edge, Math.max(-(w - size - edge), nx));
        this.y = Math.min(edge, Math.max(-(h - size - edge), ny));
      },

      onUp(e) {
        const wasDragged = this.dragged;
        this.down = false;
        this.dragged = false;
        if (!wasDragged) this.toggle();
      },

      toggle() {
        if (this.open) { this.close(); return; }
        this.detect();
        this.open = true;
        this.loadVersion();
      },

      close() {
        this.open = false;
        this.clearHighlight();
      },

      detect() {
        this.clearHighlight();
        this._elById = new Map();
        this._instanceCounter = 0;

        const groups = {};
        document.querySelectorAll('[x-data]').forEach(el => {
          if (this.$root.contains(el)) return;

          const attr = el.getAttribute('x-data') || '';
          const m = attr.trim().match(/^([a-zA-Z_$][\w$]*)/);
          if (!m) return;
          const name = m[1];

          if (!groups[name]) groups[name] = { name, description: '', instances: [] };

          const id = '__fab_' + (this._instanceCounter++);
          const label = this._labelFor(el);
          groups[name].instances.push({ id, name, label });
          this._elById.set(id, el);

          if (!groups[name].description) {
            try {
              const data = Alpine.$data(el);
              if (data && typeof data.description === 'string') groups[name].description = data.description;
            } catch (err) {}
          }
        });

        this.groups = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
      },

      _labelFor(el) {
        if (el.id) return '#' + el.id;
        const marker = el.getAttribute('data-marker');
        if (marker) return '[' + marker + ']';
        const tag = el.tagName.toLowerCase();
        const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean)[0];
        return cls ? tag + '.' + cls : tag;
      },

      highlight(id) {
        if (this.highlighted === id) { this.clearHighlight(); return; }
        this.clearHighlight();
        const el = this._elById.get(id);
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const tagged = [];
        if (rect.width > 0 && rect.height > 0) {
          el.classList.add('__fab-highlight');
          tagged.push({ el, cls: '__fab-highlight' });
        } else {
          const kids = Array.from(el.children);
          if (kids.length === 1) {
            kids[0].classList.add('__fab-highlight');
            tagged.push({ el: kids[0], cls: '__fab-highlight' });
          } else {
            kids.forEach(k => {
              k.classList.add('__fab-highlight-multi');
              tagged.push({ el: k, cls: '__fab-highlight-multi' });
            });
          }
        }

        this.highlighted = id;
        this._highlightEls = tagged;
        if (tagged.length) tagged[0].el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },

      clearHighlight() {
        if (!this.highlighted) return;
        if (this._highlightEls) {
          this._highlightEls.forEach(({ el, cls }) => el.classList.remove(cls));
          this._highlightEls = null;
        }
        this.highlighted = null;
      },

      _ensureHighlightStyle() {
        if (document.getElementById('__fab-highlight-style')) return;
        const style = document.createElement('style');
        style.id = '__fab-highlight-style';
        style.textContent =
          '.__fab-highlight {' +
          '  outline: 3px dashed var(--color-primary, #f59e0b) !important;' +
          '  background-color: color-mix(in srgb, var(--color-primary, #f59e0b) 18%, transparent) !important;' +
          '  box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--color-primary, #f59e0b) 65%, transparent) !important;' +
          '}' +
          '.__fab-highlight-multi {' +
          '  outline: 3px dashed var(--color-warning, #f59e0b) !important;' +
          '  background-color: color-mix(in srgb, var(--color-warning, #f59e0b) 18%, transparent) !important;' +
          '  box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--color-warning, #f59e0b) 65%, transparent) !important;' +
          '}';
        document.head.appendChild(style);
      },

      linksFor(filePath) {
        if (!this.repo) return [];
        const r = this.repo, ref = this.ref, p = filePath;
        const params = new URLSearchParams({ repo: r, ref });
        if (p) params.set('file', p);
        return [
          { l: 'Source', i: 'ph-github-logo',
            u: 'https://github.com/' + r + '/blob/' + ref + (p ? '/' + p : '') },
          { l: 'show-repo', i: 'ph-tree-structure',
            u: this.showRepoBase + '?' + params.toString() },
          { l: 'github.dev', i: 'ph-pencil-simple',
            u: 'https://github.dev/' + r + '/blob/' + ref + (p ? '/' + p : '') },
          { l: 'jsDelivr', i: 'ph-cloud-arrow-down',
            u: 'https://cdn.jsdelivr.net/gh/' + r + '@' + ref + (p ? '/' + p : '/') }
        ];
      },

      get pageLinks() { return this.linksFor(this.path); },
      get totalInstances() { return this.groups.reduce((s, g) => s + g.instances.length, 0); },
      get errorCount() { return this.consoleLogs.filter(e => e.level === 'error').length; },

      // loadBase-prefixed so linksFor() points at the real file under lib/.
      // (pageLinks passes the page's own root-relative path, left unprefixed.)
      componentPath(name) {
        const base = (window.gh && window.gh.loadBase) || '';
        return base + 'alpineComponents/' + name + '.js';
      },

      scriptUrl(path) {
        if (!path || /^https?:/.test(path)) return path || '#';
        if (!this.repo) return '#';
        // Registry paths are the loadBase-relative names gh.load() was called
        // with (e.g. 'kits/console.js'); prepend loadBase so the blob link
        // points at the real file under lib/.
        const base = (window.gh && window.gh.loadBase) || '';
        return 'https://github.com/' + this.repo + '/blob/' + this.ref + '/' + base + path;
      },

      fmtElapsed(s) {
        if (s.status === 'pending') return '…';
        if (typeof s.endT === 'number' && typeof s.t === 'number') return (s.endT - s.t) + 'ms';
        return '';
      },

      fmtTime(ts) { return new Date(ts).toTimeString().slice(0, 8); },

      toggleConsole() {
        this.consoleOpen = !this.consoleOpen;
        if (this.consoleOpen) this.scrollConsole();
      },

      // Load + mount the rich debugConsole panel into the footer. Self-loads
      // the kit and component via gh.load so pages that only pull fab.js
      // still get the upgrade; on failure we keep the inline fallback list.
      // gh.load executes its file synchronously, but the fetch underneath it
      // can hang (a stuck connection leaves the load promise unsettled). A bare
      // `await gh.load(...)` here would then dangle forever and the rich panel
      // would never mount — yet we'd never fall back either. So race each
      // self-load against a timeout and retry once: a fresh gh.load issues a
      // new fetch, which often clears a transient stall; a hard stall bails to
      // the inline fallback list instead of hanging. `isReady` short-circuits
      // once the file has registered, so a merely-slow load isn't retried.
      async _selfLoad(path, isReady, { tries = 2, timeoutMs = 8000 } = {}) {
        for (let i = 0; i < tries && !isReady(); i++) {
          try {
            // Pass `by` explicitly — an Alpine method can't reach the scoped
            // `gh` handed to fab.js at load time, so stamp the attribution here
            // (the load wrapper honors opts.by ahead of any other signal).
            await Promise.race([
              window.gh.load(path, { by: 'alpineComponents/fab.js' }),
              new Promise((_, rej) => setTimeout(() => rej(new Error('self-load timeout')), timeoutMs))
            ]);
          } catch (e) {}
        }
        return isReady();
      },

      async _mountConsolePanel() {
        if (this.consolePanelReady) return;
        try {
          if (window.gh) {
            if (!window.consoleKit) await this._selfLoad('kits/console.js', () => !!window.consoleKit);
            if (!window.__debugConsoleRegistered) await this._selfLoad('alpineComponents/console.js', () => !!window.__debugConsoleRegistered);
          }
          if (!window.__debugConsoleRegistered || !window.Alpine) return;
          await this.$nextTick();
          const host = this.$refs.consoleHost;
          if (!host || host.getAttribute('x-data')) return;
          host.setAttribute('x-data', 'debugConsole');
          window.Alpine.initTree(host);
          this.consolePanelReady = true;
        } catch (e) {}
      },

      clearConsole() {
        if (window.consoleKit) console.clear();
        else this.consoleLogs = [];
      },

      _ago(dateStr) {
        const s = (Date.now() - new Date(dateStr)) / 1000;
        const u = { y: 31536000, mo: 2592000, d: 86400, h: 3600, m: 60 };
        for (const [k, v] of Object.entries(u)) if (s >= v) return Math.floor(s / v) + k + ' ago';
        return 'just now';
      },

      // "What am I looking at?" Reads recent commits for the booted ref and
      // tells the story up to that tip: the latest PR merge that precedes it
      // (the version), plus any commits sitting on top of that merge. On main
      // those extra commits are direct pushes; on a branch they're its own
      // unmerged commits. The PR number comes from the merge commit subject
      // (Merge pull request #N) and its title from the body, so nothing needs
      // hand-stamping. Lazy: fires on first drawer open, refreshable.
      async loadVersion(force) {
        if (force) this.verLoaded = false;
        if (this.verLoaded || this.verLoading) return;
        if (!window.GH) { this.verError = 'window.GH not available on this page'; return; }
        this.verError = '';
        this.verLoading = true;
        const repo = this.repo || 'mehrlander/web-tools';
        // Prefer the ref gh-api.js actually booted from (set on a ?use= page),
        // since that's the code running; fall back to the page's own ref.
        const ref = window.__bundleRef || this.ref || 'main';
        let token = '';
        try { token = localStorage.getItem('ghToken') || ''; } catch (e) {}
        try {
          const gh = new window.GH({ repo, ref, token });
          const list = await gh.req('commits?sha=' + encodeURIComponent(ref) + '&per_page=30');
          const tip = list[0];
          let mergeIdx = -1, pr = null;
          for (let i = 0; i < list.length; i++) {
            const m = list[i].commit.message.split('\n')[0].match(/^Merge pull request #(\d+)/);
            if (m) { mergeIdx = i; pr = m[1]; break; }
          }
          const merge = mergeIdx >= 0 ? list[mergeIdx] : null;
          let prTitle = '';
          if (merge) {
            const lines = merge.commit.message.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length > 1) prTitle = lines[lines.length - 1].slice(0, 80);
          }
          const dated = merge || tip;
          this.ver = {
            ref,
            sha: tip ? tip.sha.slice(0, 7) : '',
            tipUrl: tip ? tip.html_url : '',
            pr,
            prTitle,
            prUrl: pr ? 'https://github.com/' + repo + '/pull/' + pr : '',
            since: mergeIdx >= 0 ? mergeIdx : list.length,
            ago: dated ? this._ago(dated.commit.committer.date) : ''
          };
          this.verLoaded = true;
        } catch (e) {
          this.verError = 'Version: ' + ((e && e.message) || String(e));
        }
        this.verLoading = false;
      },

      get frameLabel() { return this.path + ' @ ' + (this.frameRef || 'main'); },

      async loadFrameBranches(force) {
        if (force) this.frameBranchesLoaded = false;
        if (this.frameBranchesLoaded || this.frameBranchesLoading) return;
        if (!window.GH) { this.frameError = 'window.GH not available on this page'; return; }
        this.frameError = '';
        this.frameBranchesLoading = true;
        let token = '';
        try { token = localStorage.getItem('ghToken') || ''; } catch (e) {}
        try {
          const tmp = new window.GH({ repo: this.repo || 'mehrlander/web-tools', token });
          if (typeof tmp.branches !== 'function') {
            this.frameError = 'gh-fetch.js not loaded (branches() unavailable)';
          } else {
            // GraphQL gives tip-commit dates, server-sorted newest-first. If it
            // fails (e.g. no token), fall back to REST: names only, no dates.
            let list;
            if (typeof tmp.branchesDated === 'function') {
              try {
                list = await tmp.branchesDated();
              } catch (e) {
                list = (await tmp.branches()).map(b => ({ name: b.name, date: '', ago: '' }));
              }
            } else {
              list = (await tmp.branches()).map(b => ({ name: b.name, date: '', ago: '' }));
            }
            this.frameBranches = list;
            this.frameBranchesLoaded = true;
          }
        } catch (e) {
          this.frameError = 'Branches: ' + ((e && e.message) || String(e));
        }
        this.frameBranchesLoading = false;
      },

      pickFrameRef(name) { this.frameRef = name; },

      applyFrameRef() {
        const v = (this.frameRefInput || '').trim();
        if (!v) return;
        this.frameRef = v;
        this.frameRefInput = '';
      },

      async openFrame() {
        if (!this.path) { this.frameError = 'No page path detected on this page'; return; }
        if (!window.GH) { this.frameError = 'window.GH not available on this page'; return; }
        this.frameError = '';
        this.frameOpen = true;
        this.frameLoading = true;
        let token = '';
        try { token = localStorage.getItem('ghToken') || ''; } catch (e) {}
        try {
          const gh = new window.GH({ repo: this.repo || 'mehrlander/web-tools', ref: this.frameRef || 'main', token });
          const { text } = await gh.get(this.path);
          this.$nextTick(() => { if (this.$refs.frame) this.$refs.frame.srcdoc = this.frameHtml(text); });
        } catch (e) {
          this.frameError = (e && e.message) || String(e);
          this.$nextTick(() => {
            if (this.$refs.frame) this.$refs.frame.srcdoc =
              '<pre style="padding:2rem;font:13px ui-monospace,monospace;color:#dc2626">' +
              this.frameLabel + '\n\n' + this.frameError + '</pre>';
          });
        } finally {
          this.frameLoading = false;
        }
      },

      closeFrame() {
        this.frameOpen = false;
        if (this.$refs.frame) this.$refs.frame.srcdoc = '';
      },

      // Export this page + the data it read()s as one zip, via the export kit
      // (self-loaded on first use, like the console panel). Default is local-DATA
      // (code still loads from the CDN); the "Fully offline" toggle also bakes the
      // gh.load chain in (kits/build.js) so the zip opens with no network.
      async exportPage() {
        this.exportError = ''; this.exportMsg = ''; this.exportBusy = true;
        try {
          if (!window.exporter) await this._selfLoad('kits/export.js', () => !!window.exporter);
          if (!window.exporter) throw new Error('export kit unavailable (kits/export.js failed to load)');
          const r = await window.exporter.page({ path: this.path, offline: this.exportOffline });
          this.exportMsg = 'Saved ' + r.filename +
            (r.offline ? ' (+' + r.codeFiles + ' code' + (r.reads.length ? ', +' + r.reads.length + ' data)' : ')')
                       : (r.reads.length ? ' (+' + r.reads.length + ' data)' : ' (no data read yet)'));
        } catch (e) {
          this.exportError = (e && e.message) || String(e);
        } finally {
          this.exportBusy = false;
        }
      },

      frameHtml(text) {
        const repo = this.repo || 'mehrlander/web-tools';
        const ref = this.frameRef || 'main';
        const path = this.path;
        const owner = repo.split('/')[0], name = repo.split('/')[1];
        const dir = path.indexOf('/') >= 0 ? path.slice(0, path.lastIndexOf('/') + 1) : '';
        const base = 'https://' + owner + '.github.io/' + name + '/' + dir;
        const r = JSON.stringify(ref);
        const prelude =
          '<base href="' + base + '">' +
          '<script>window.__ref=' + r + ';(function(){var R=' + r + ',g=URLSearchParams.prototype.get;' +
          'URLSearchParams.prototype.get=function(k){var v=g.call(this,k);' +
          'return (k===\'use\'&&(v==null||v===\'\'))?R:v;};})();<\/script>';
        if (/<head[^>]*>/i.test(text)) return text.replace(/<head[^>]*>/i, function(m) { return m + prelude; });
        if (/<html[^>]*>/i.test(text)) return text.replace(/<html[^>]*>/i, function(m) { return m + '<head>' + prelude + '</head>'; });
        return '<head>' + prelude + '</head>' + text;
      },

      scrollConsole() {
        this.$nextTick(() => {
          const p = document.getElementById('__fab-console-panel');
          if (p) p.scrollTop = p.scrollHeight;
        });
      }
    };
  });
});
