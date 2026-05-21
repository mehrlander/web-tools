document.addEventListener('alpine:init', function() {
  Alpine.data('fab', function() {
    return {
      description: 'Draggable floating button: opens a right-side drawer listing every Alpine component instance on the page; tapping one outlines it in place',

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
              <div class="flex items-center gap-2 min-w-0">
                <i class="ph ph-puzzle-piece text-lg text-primary shrink-0"></i>
                <div class="font-mono text-sm font-bold truncate">Components</div>
                <span x-show="totalInstances" class="text-[10px] font-mono text-base-content/50 shrink-0">
                  <span x-text="groups.length"></span> &middot; <span x-text="totalInstances"></span> inst
                </span>
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
          </div>
        </div>`,

      x: 0, y: 0, sx: 0, sy: 0,
      down: false, dragged: false,

      open: false,
      groups: [],
      highlighted: null,

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
        el.classList.add('__fab-highlight');
        this.highlighted = id;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },

      clearHighlight() {
        if (!this.highlighted) return;
        const el = this._elById.get(this.highlighted);
        if (el) el.classList.remove('__fab-highlight');
        this.highlighted = null;
      },

      _ensureHighlightStyle() {
        if (document.getElementById('__fab-highlight-style')) return;
        const style = document.createElement('style');
        style.id = '__fab-highlight-style';
        style.textContent =
          '.__fab-highlight {' +
          '  outline: 3px dashed var(--color-primary, #f59e0b) !important;' +
          '  outline-offset: 4px !important;' +
          '  animation: __fab-pulse 1.4s ease-in-out infinite;' +
          '  scroll-margin: 6rem;' +
          '}' +
          '@keyframes __fab-pulse {' +
          '  0%, 100% { outline-offset: 4px; }' +
          '  50% { outline-offset: 8px; }' +
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

      componentPath(name) { return 'alpineComponents/' + name + '-assembled.js'; }
    };
  });
});
