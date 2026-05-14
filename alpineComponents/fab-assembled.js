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
            <template x-if="repo">
              <a :href="'https://github.com/' + repo" target="_blank" class="mb-1 px-1 font-mono text-sm font-bold link link-hover block" x-text="repo"></a>
            </template>
            <div x-show="!repo" class="mb-1 px-1 font-mono text-sm font-bold">Source unknown</div>
            <div x-show="path" class="mb-3 px-1 font-mono text-xs text-base-content/60 truncate" x-text="path"></div>
            <div x-show="!repo" class="mb-3 px-1 text-xs text-base-content/60 italic">
              Could not infer repo from URL. Set <code class="font-mono">data-repo</code> on the FAB element to override.
            </div>

            <div x-show="repo" x-data="linksList()"></div>

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
        const vars = { repo: this.repo, ref: this.ref, path: this.path, showRepoBase: this.showRepoBase };
        const kit = this.path ? LinkKit.FILE_LINKS : LinkKit.REPO_LINKS;
        return LinkKit.fill(kit, vars);
      }
    };
  });
});
