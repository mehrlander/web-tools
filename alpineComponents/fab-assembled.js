document.addEventListener('alpine:init', function() {
  Alpine.data('fab', function() {
    return {
      template: `
        <button @click="fabModal.showModal()"
          class="fixed bottom-4 right-4 btn btn-circle btn-primary shadow-lg z-40 tooltip tooltip-left"
          data-tip="View source / options">
          <i class="ph ph-code text-xl"></i>
        </button>

        <dialog id="fabModal" class="modal" onclick="if(event.target===this)this.close()">
          <div class="modal-box shadow-none border border-base-300 bg-base-100 p-4 max-w-lg">
            <div class="mb-1 px-1 font-mono text-sm font-bold" x-text="repo || 'Source unknown'"></div>
            <div x-show="path" class="mb-3 px-1 font-mono text-xs text-base-content/60 truncate" x-text="path"></div>
            <div x-show="!repo" class="mb-3 px-1 text-xs text-base-content/60 italic">
              Could not infer repo from URL. Set <code class="font-mono">data-repo</code> on the FAB element to override.
            </div>

            <div x-show="repo" class="flex flex-col gap-1.5">
              <template x-for="link in links" :key="link.l">
                <div class="flex items-center bg-base-200 rounded-lg overflow-hidden">
                  <a :href="link.u" target="_blank" class="flex-1 flex items-center gap-2.5 px-3 py-2 min-w-0 hover:bg-base-300">
                    <i class="ph shrink-0 text-sm" :class="link.i"></i>
                    <div class="flex flex-col min-w-0">
                      <span class="text-xs font-semibold leading-tight" x-text="link.l"></span>
                      <span class="text-[10px] font-mono opacity-50 truncate leading-tight mt-0.5" x-text="link.u.replace('https://','')"></span>
                    </div>
                  </a>
                  <button class="px-3 py-2 border-l border-base-300 hover:bg-base-300"
                    @click="navigator.clipboard.writeText(link.u).then(()=>Alpine.store('toast')?.('check','Copied','alert-success',1500))">
                    <i class="ph ph-copy text-sm opacity-40"></i>
                  </button>
                </div>
              </template>
            </div>

            <div class="modal-action mt-3"><button onclick="fabModal.close()" class="btn btn-ghost btn-sm text-xs">Done</button></div>
          </div>
        </dialog>`,

      repo: '',
      path: '',
      ref: 'main',
      showRepoBase: 'https://mehrlander.github.io/web-tools/pages/show-repo/show-repo.html',

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

      get links() {
        if (!this.repo) return [];
        const r = this.repo, ref = this.ref, p = this.path;
        const params = new URLSearchParams({ repo: r, ref });
        if (p) params.set('file', p);
        return [
          { l: 'View source on GitHub', i: 'ph-github-logo',
            u: 'https://github.com/' + r + '/blob/' + ref + (p ? '/' + p : '') },
          { l: 'Open in repo browser', i: 'ph-tree-structure',
            u: this.showRepoBase + '?' + params.toString() },
          { l: 'Edit in github.dev', i: 'ph-pencil-simple',
            u: 'https://github.dev/' + r + '/blob/' + ref + (p ? '/' + p : '') },
          { l: 'Raw on jsDelivr', i: 'ph-cloud-arrow-down',
            u: 'https://cdn.jsdelivr.net/gh/' + r + '@' + ref + (p ? '/' + p : '/') }
        ];
      }
    };
  });
});
