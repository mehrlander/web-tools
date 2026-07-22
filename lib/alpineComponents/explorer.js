document.addEventListener('alpine:init', function() {
  Alpine.data('explorer', function() {
    const fmt = t => t.replace(/ {4}/g, '  ');
    const kb = n => n >= 1024 ? (n / 1024).toFixed(n >= 10240 ? 0 : 1) + ' KB' : n + ' B';

    return {
      description: 'Main-area repo file browser: breadcrumb + folder listing; selects files into the shared viewer, stages files for transfer',

      template: `
        <div>
          <div class="flex items-center gap-1 font-mono text-lg flex-wrap min-h-8">
            <button @click="load('')" class="flex items-center gap-1.5 hover:text-primary cursor-pointer"
                    :class="!path && 'font-semibold'">
              <i class="ph ph-folder-notch-open text-warning"></i><span x-text="repoShort"></span>
            </button>
            <template x-for="c in crumbs" :key="c.path">
              <div class="flex items-center gap-1">
                <span class="opacity-40">/</span>
                <button @click="load(c.path)" class="hover:text-primary cursor-pointer"
                        :class="c.path===path && 'font-semibold'" x-text="c.name"></button>
              </div>
            </template>
            <div class="grow"></div>
            <a :href="ghFolderUrl" target="_blank" class="opacity-30 hover:opacity-70 transition-opacity"
               title="Open this folder on GitHub"><i class="ph ph-github-logo"></i></a>
          </div>

          <div class="border border-base-300 rounded-lg bg-base-100 overflow-hidden mt-2">
            <div x-show="loading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <div x-show="!loading" class="max-h-[60vh] overflow-y-auto p-1">
              <div x-show="path" @click="load(parentPath)"
                   class="px-2 py-1.5 rounded hover:bg-base-200 cursor-pointer font-mono text-lg opacity-50">..</div>
              <template x-for="f in tree" :key="f.path">
                <div @click="f.type==='dir' ? load(f.path) : sel(f.path)"
                     class="group flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-base-200 cursor-pointer text-lg"
                     :class="activeFile===f.path && 'bg-primary/10 text-primary font-semibold'">
                  <div class="flex items-center gap-2 min-w-0">
                    <i class="ph shrink-0" :class="f.type==='dir' ? 'ph-folder text-warning' : 'ph-file text-info'"></i>
                    <span class="truncate font-mono" x-text="f.name"></span>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span x-show="f.type!=='dir'" class="text-base font-mono text-base-content/40 hidden sm:inline"
                          x-text="f.size ? fmtSize(f.size) : ''"></span>
                    <button x-show="f.type!=='dir'" @click.stop="stageToggle(f.path)"
                            class="btn btn-ghost w-6 h-6 p-0"
                            :class="isStaged(f.path) ? 'text-success opacity-100' : 'opacity-30 group-hover:opacity-70 hover:!opacity-100 hover:text-success'"
                            :title="isStaged(f.path) ? 'Remove from stage' : 'Add to stage'">
                      <i class="ph text-lg" :class="isStaged(f.path) ? 'ph-check-circle' : 'ph-plus-circle'"></i>
                    </button>
                  </div>
                </div>
              </template>
              <div x-show="!tree.length" class="px-2 py-4 text-lg opacity-40 font-mono">empty</div>
            </div>
          </div>
        </div>`,

      path: '',
      tree: [],
      loading: false,
      // True once any directory listing has completed (ok or not): the
      // "listing has had its first paint" signal show-repo's Recent panel
      // defers behind, so its fetches never contend with the listing's.
      loadedOnce: false,

      init() {
        this.$root.__explorer = this;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
        this.$watch(
          () => Alpine.store('browser').ref,
          () => { if (this.gh && Alpine.store('browser').repo) this.reloadForRef(); }
        );
      },

      get gh() {
        return Alpine.store('browser').gh;
      },
      get activeFile() {
        return Alpine.store('browser').activeFile?.path;
      },
      get parentPath() {
        return this.path.split('/').slice(0, -1).join('/');
      },
      get crumbs() {
        const segs = this.path ? this.path.split('/') : [];
        return segs.map((name, i) => ({ name, path: segs.slice(0, i + 1).join('/') }));
      },
      get repoShort() {
        return (Alpine.store('browser').repo || '').split('/').pop() || 'repo';
      },
      // The current folder on GitHub: the breadcrumb's jump-over to the same
      // place in the GitHub presentation.
      get ghFolderUrl() {
        const s = Alpine.store('browser');
        const ref = s.ref || s.defaultRef || 'main';
        return 'https://github.com/' + s.repo + '/tree/' + ref + (this.path ? '/' + this.path : '');
      },

      fmtSize: kb,

      async load(p, silent) {
        this.path = p;
        Alpine.store('browser').path = p;
        this.loading = true;
        try { this.tree = await this.gh.ls(p); } catch { this.tree = []; }
        this.loading = false;
        this.loadedOnce = true;
        if (!silent) this.persist();
      },

      async reset() {
        this.path = '';
        this.tree = [];
        await this.load('', true);
      },

      async reloadForRef() {
        this.gh.ref = Alpine.store('browser').ref;
        const currentPath = this.path;
        const active = Alpine.store('browser').activeFile?.path;
        await this.load(currentPath, true);
        if (active) await this.sel(active, true);
      },

      async sel(p, silent) {
        try {
          const res = await this.gh.get(p);
          Alpine.store('browser').activeFile = { path: p, content: fmt(res.text) };
        } catch(e) {
          Alpine.store('browser').activeFile = { path: p, content: '// Error: ' + e.message };
        }
        if (!silent) this.persist();
      },

      persist() {
        const store = Alpine.store('browser');
        if (!store.save) return;
        store.save({
          repo: store.repo,
          ref: store.ref || '',
          path: this.path,
          file: store.activeFile?.path || ''
        });
      },

      // ── Staging: "+" on a file row adds it to the shared cross-repo stage ──
      // Items carry their origin ({ repo, ref, path }, ref '' = the source's
      // default branch), so the stage survives repo switches and mixes sources.
      normRef() {
        const s = Alpine.store('browser');
        return s.ref && s.ref !== s.defaultRef ? s.ref : '';
      },
      isStaged(p) {
        const s = Alpine.store('browser');
        const ref = this.normRef();
        return (s.stage || []).some(it => it.path === p && it.repo === s.repo && (it.ref || '') === ref);
      },
      stageToggle(p) {
        const s = Alpine.store('browser');
        const ref = this.normRef();
        if (this.isStaged(p)) {
          s.stage = s.stage.filter(it => !(it.path === p && it.repo === s.repo && (it.ref || '') === ref));
        } else {
          s.stage.push({ repo: s.repo, ref, path: p });
          Alpine.store('toast')('plus-circle', 'Staged ' + p.split('/').pop(), 'alert-success', 2000);
        }
      }
    };
  });
});
