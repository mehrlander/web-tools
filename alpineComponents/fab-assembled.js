document.addEventListener('alpine:init', function() {
  Alpine.data('fab', function() {
    return {
      description: 'Draggable floating button: page source links + on-page component info',

      template: `
        <div :style="'transform:translate(' + x + 'px,' + y + 'px)'"
             @pointerdown="onDown($event)"
             @pointermove="onMove($event)"
             @pointerup="onUp($event)"
             @pointercancel="onUp($event)"
             class="tooltip tooltip-left fixed bottom-6 right-6 group touch-none z-40"
             data-tip="Source / components">
          <div tabindex="0" class="size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center cursor-grab active:cursor-grabbing outline-none transition-all duration-300 hover:bg-primary/20 hover:border-primary/40 focus:bg-primary focus:border-primary focus:shadow-lg focus:shadow-primary/30">
            <i class="ph ph-code text-2xl text-primary/40 group-hover:text-primary/70 group-focus:text-primary-content transition-colors"></i>
          </div>
        </div>

        <dialog id="fabModal" class="modal" onclick="if(event.target===this)this.close()">
          <div class="modal-box shadow-none border border-base-300 bg-base-100 p-4 max-w-lg">
            <template x-if="repo">
              <a :href="'https://github.com/' + repo" target="_blank" class="px-1 font-mono text-sm font-bold link link-hover block" x-text="repo"></a>
            </template>
            <div x-show="!repo" class="px-1 font-mono text-sm font-bold">Source unknown</div>
            <div x-show="path" class="px-1 font-mono text-xs text-base-content/60 truncate mb-3" x-text="path"></div>
            <div x-show="!repo" class="px-1 text-xs text-base-content/60 italic mb-3">
              Could not infer repo from URL. Set <code class="font-mono">data-repo</code> on the FAB element to override.
            </div>

            <div x-show="repo" class="mb-3">
              <div class="text-[10px] uppercase tracking-wider text-base-content/50 font-semibold px-1 mb-1">This page</div>
              <div class="flex gap-1">
                <template x-for="link in pageLinks" :key="link.l">
                  <a :href="link.u" target="_blank" :title="link.l"
                     class="flex-1 flex items-center justify-center gap-1.5 bg-base-200 hover:bg-base-300 rounded-lg py-2 text-xs">
                    <i class="ph text-sm" :class="link.i"></i>
                    <span x-text="link.l"></span>
                  </a>
                </template>
              </div>
            </div>

            <div x-show="repo && components.length > 0">
              <div class="text-[10px] uppercase tracking-wider text-base-content/50 font-semibold px-1 mb-1">
                Components (<span x-text="components.length"></span>)
              </div>
              <div class="flex flex-col gap-1.5">
                <template x-for="c in components" :key="c.name">
                  <div class="bg-base-200 rounded-lg p-2.5">
                    <div class="flex items-baseline justify-between mb-0.5">
                      <span class="font-mono text-sm font-semibold" x-text="c.name"></span>
                      <span class="text-[10px] font-mono text-base-content/50">&times;<span x-text="c.count"></span></span>
                    </div>
                    <div x-show="c.description" class="text-xs text-base-content/70 mb-1.5" x-text="c.description"></div>
                    <div class="flex gap-1">
                      <template x-for="link in linksFor(componentPath(c.name))" :key="link.l">
                        <a :href="link.u" target="_blank" :title="link.l"
                           class="flex-1 flex items-center justify-center bg-base-100 hover:bg-base-300 rounded py-1.5">
                          <i class="ph text-sm" :class="link.i"></i>
                        </a>
                      </template>
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <div x-show="repo && components.length === 0" class="text-xs text-base-content/50 italic px-1">
              No Alpine components detected on this page.
            </div>

            <div class="modal-action mt-3"><button onclick="fabModal.close()" class="btn btn-ghost btn-sm text-xs">Done</button></div>
          </div>
        </dialog>`,

      x: 0, y: 0, sx: 0, sy: 0,
      down: false, dragged: false,

      repo: '',
      path: '',
      ref: 'main',
      showRepoBase: 'https://mehrlander.github.io/web-tools/pages/show-repo/show-repo.html',

      components: [],

      init() {
        this.$el.innerHTML = this.template;
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
        if (!wasDragged) {
          this.detect();
          document.getElementById('fabModal').showModal();
        }
      },

      detect() {
        const counts = {};
        document.querySelectorAll('[x-data]').forEach(el => {
          const attr = el.getAttribute('x-data') || '';
          const m = attr.trim().match(/^([a-zA-Z_$][\w$]*)/);
          if (!m) return;
          const name = m[1];
          if (!counts[name]) counts[name] = { name, count: 0, description: '' };
          counts[name].count++;
          if (!counts[name].description) {
            try {
              const data = Alpine.$data(el);
              if (data && typeof data.description === 'string') counts[name].description = data.description;
            } catch (err) {}
          }
        });
        this.components = Object.values(counts).sort((a, b) => a.name.localeCompare(b.name));
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

      componentPath(name) { return 'alpineComponents/' + name + '-assembled.js'; }
    };
  });
});
