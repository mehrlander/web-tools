document.addEventListener('alpine:init', function() {
  Alpine.data('fab', function() {
    return {
      description: 'Draggable floating button: opens a right-side drawer listing every Alpine component instance on the page (tapping one outlines it in place), with a collapsible console log and a render box that hosts any repo page at any ref in an overlay iframe',

      template: `
        <div :style="'transform:translate(' + x + 'px,' + y + 'px)'"
             @pointerdown="onDown($event)"
             @pointermove="onMove($event)"
             @pointerup="onUp($event)"
             @pointercancel="onUp($event)"
             class="tooltip tooltip-left fixed bottom-6 right-6 group touch-none z-40"
             data-tip="Components on this page">
          <div tabindex="0" class="size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center cursor-grab active:cursor-grabbing outline-none transition-all duration-300 hover:bg-primary/20 hover:border-primary/40 focus:bg-primary focus:border-primary focus:shadow-lg focus:shadow-primary/30"
               :class="open ? 'bg-primary/30 border-primary/50' : ''">
            <i class="ph ph-puzzle-piece text-2xl text-primary/40 group-hover:text-primary/70 group-focus:text-primary-content transition-colors"
               :class="open ? 'text-primary' : ''"></i>
          </div>
        </div>

        <div class="fixed inset-y-0 right-0 z-50 transition-transform duration-300 ease-out pointer-events-none"
             :class="open ? 'translate-x-0' : 'translate-x-full'"
             style="width: 22rem; max-width: 92vw;">
          <div class="h-full bg-base-100 border-l border-base-300 shadow-2xl flex flex-col pointer-events-auto">
            <header class="px-3 py-2 border-b border-base-300 flex items-center justify-between gap-2 shrink-0">
              <div class="flex items-center gap-1.5 px-1 text-xs font-semibold">
                <i class="ph ph-puzzle-piece text-sm text-primary"></i>
                <span>Components</span>
                <span x-show="totalInstances" class="font-mono text-[10px] opacity-60" x-text="totalInstances"></span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button @click="detect()" class="btn btn-ghost btn-xs btn-square" title="Rescan page" aria-label="Rescan">
                  <i class="ph ph-arrows-clockwise"></i>
                </button>
                <button @click="close()" class="btn btn-ghost btn-xs btn-square" title="Close" aria-label="Close">
                  <i class="ph ph-x"></i>
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
                <div x-show="repo" class="flex gap-1 mt-1.5">
                  <template x-for="link in pageLinks" :key="link.l">
                    <a :href="link.u" target="_blank" :title="link.l"
                       class="flex-1 flex items-center justify-center gap-1.5 bg-base-200 hover:bg-base-300 rounded-lg py-1.5 text-xs">
                      <i class="ph text-sm" :class="link.i"></i>
                    </a>
                  </template>
                </div>
              </div>

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

            <div class="shrink-0 border-t border-base-300 flex flex-col">
              <div @click="toggleFrameControls()" role="button" tabindex="0"
                   class="flex items-center justify-between gap-2 px-3 py-1.5 cursor-pointer select-none hover:bg-base-200/60 transition-colors">
                <div class="flex items-center gap-1.5 text-xs font-semibold text-base-content/70">
                  <i class="ph ph-monitor-play text-sm"></i>
                  <span>Render page</span>
                </div>
                <i class="ph text-base-content/40" :class="frameControls ? 'ph-caret-down' : 'ph-caret-up'"></i>
              </div>
              <div x-show="frameControls" class="p-2 flex flex-col gap-1.5 border-t border-base-300/60">
                <input x-model="framePath" @keydown.enter="openFrame()" placeholder="pages/foo.html"
                       class="input input-xs input-bordered font-mono text-[11px] w-full">
                <div class="flex gap-1.5">
                  <input x-model="frameRef" @keydown.enter="openFrame()" placeholder="main" title="branch / tag / sha"
                         class="input input-xs input-bordered font-mono text-[11px] flex-1">
                  <button @click="openFrame()" class="btn btn-xs btn-primary gap-1"><i class="ph ph-play"></i>Open</button>
                </div>
                <div x-show="frameError" class="text-[10px] text-error font-mono break-all" x-text="frameError"></div>
                <div class="text-[10px] text-base-content/40 leading-snug">Renders the target into an overlay box on top of this page.</div>
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
                  <button x-show="consoleOpen && consoleLogs.length" @click.stop="consoleLogs = []" class="btn btn-ghost btn-xs btn-square" title="Clear console" aria-label="Clear console">
                    <i class="ph ph-trash"></i>
                  </button>
                  <i class="ph text-base-content/40" :class="consoleOpen ? 'ph-caret-down' : 'ph-caret-up'"></i>
                </div>
              </div>
              <div x-show="consoleOpen" class="overflow-y-auto p-1 flex flex-col gap-0.5 border-t border-base-300/60"
                   id="__fab-console-panel" style="max-height: 40vh;">
                <div x-show="consoleLogs.length === 0" class="text-xs text-base-content/50 italic px-3 py-6 text-center">No console output captured.</div>
                <template x-for="(entry, idx) in consoleLogs" :key="idx">
                  <div class="flex gap-1.5 items-baseline px-1.5 py-0.5 rounded border-l-2 font-mono text-[11px]"
                       :class="entry.level === 'error' ? 'border-error bg-error/10 text-error' :
                               entry.level === 'warn'  ? 'border-warning bg-warning/10 text-warning' :
                                                         'border-base-300 bg-base-100'">
                    <span class="text-base-content/30 shrink-0 text-[10px]" x-text="fmtTime(entry.time)"></span>
                    <span class="shrink-0 w-8 text-[10px] uppercase opacity-60" x-text="entry.level"></span>
                    <span class="break-all whitespace-pre-wrap" x-text="entry.msg"></span>
                  </div>
                </template>
              </div>
            </div>

          </div>
        </div>

        <div x-show="frameOpen" style="display:none" class="fixed inset-0 z-[60] flex flex-col bg-base-300/40 backdrop-blur-sm">
          <div class="shrink-0 bg-base-100 border-b border-base-300 px-3 py-1.5 flex items-center gap-2">
            <i class="ph ph-monitor-play text-primary shrink-0"></i>
            <span class="font-mono text-xs font-semibold truncate" x-text="frameLabel"></span>
            <span x-show="frameLoading" class="loading loading-spinner loading-xs text-primary"></span>
            <div class="ml-auto flex items-center gap-1 shrink-0">
              <a :href="frameOpenUrl" target="_blank" class="btn btn-ghost btn-xs btn-square" title="Open render.html in a tab" aria-label="Open in tab">
                <i class="ph ph-arrow-square-out"></i>
              </a>
              <button @click="closeFrame()" class="btn btn-ghost btn-xs btn-square" title="Close" aria-label="Close">
                <i class="ph ph-x"></i>
              </button>
            </div>
          </div>
          <iframe x-ref="frame" class="flex-1 w-full border-0 bg-base-100"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"></iframe>
        </div>`,

      x: 0, y: 0, sx: 0, sy: 0,
      down: false, dragged: false,

      open: false,
      consoleOpen: false,
      groups: [],
      consoleLogs: [],
      highlighted: null,

      frameOpen: false,
      frameControls: false,
      framePath: '', frameRef: 'main', frameRepo: '',
      frameLoading: false, frameError: '',

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
        this.frameRepo = this.repo || 'mehrlander/web-tools';
        this.frameRef = this.ref || 'main';
        this.framePath = this.path || '';
        this.consoleLogs = window.__consoleLogs ? [...window.__consoleLogs] : [];
        this._consoleListener = e => {
          this.consoleLogs.push(e.detail);
          if (this.open && this.consoleOpen) this.scrollConsole();
        };
        window.addEventListener('consolelog', this._consoleListener);
      },

      destroy() {
        if (this._consoleListener) window.removeEventListener('consolelog', this._consoleListener);
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

      componentPath(name) { return 'alpineComponents/' + name + '.js'; },

      fmtTime(ts) { return new Date(ts).toTimeString().slice(0, 8); },

      toggleConsole() {
        this.consoleOpen = !this.consoleOpen;
        if (this.consoleOpen) this.scrollConsole();
      },

      toggleFrameControls() { this.frameControls = !this.frameControls; },

      get frameLabel() { return this.framePath + ' @ ' + (this.frameRef || 'main'); },

      get frameOpenUrl() {
        const repo = this.frameRepo || 'mehrlander/web-tools';
        const owner = repo.split('/')[0], name = repo.split('/')[1];
        const p = new URLSearchParams({ page: this.framePath, ref: this.frameRef || 'main' });
        if (repo !== 'mehrlander/web-tools') p.set('repo', repo);
        return 'https://' + owner + '.github.io/' + name + '/pages/render.html?' + p.toString();
      },

      async openFrame() {
        if (!this.framePath) { this.frameError = 'Enter a page path'; return; }
        if (!window.GH) { this.frameError = 'window.GH not available on this page'; return; }
        this.frameError = '';
        this.frameOpen = true;
        this.frameLoading = true;
        let token = '';
        try { token = localStorage.getItem('ghToken') || ''; } catch (e) {}
        try {
          const gh = new window.GH({ repo: this.frameRepo || 'mehrlander/web-tools', ref: this.frameRef || 'main', token });
          const { text } = await gh.get(this.framePath);
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

      frameHtml(text) {
        const repo = this.frameRepo || 'mehrlander/web-tools';
        const ref = this.frameRef || 'main';
        const path = this.framePath;
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
