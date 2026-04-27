document.addEventListener('alpine:init', function() {
  Alpine.data('navigator', function() {
    const esc = s => new Option(String(s ?? '')).innerHTML;
    const fmt = t => t.replace(/ {4}/g, '  ');
    const stat = t => t.split('\n').length + ' lines · ' + (new Blob([t]).size / 1024).toFixed(1) + ' KB';

    return {
      template: `
        <div>
          <button @click="open=!open" class="flex items-center gap-1 font-semibold py-0.5 hover:text-primary mb-1 cursor-pointer">
            <i class="ph" :class="open?'ph-caret-down':'ph-caret-right'"></i>Files
          </button>
          <div x-show="open" x-collapse>
            <div class="text-xs font-mono text-base-content/50 px-1 pb-1 truncate flex items-center gap-1">
              <i class="ph ph-folder-open"></i><span x-text="'/'+path"></span>
            </div>
            <div class="overflow-y-auto text-sm bg-base-100 rounded-lg p-1 h-[33vh] border border-base-300">
              <div x-show="loading" class="flex justify-center py-8">
                <span class="loading loading-dots loading-sm opacity-30"></span>
              </div>
              <div x-show="!loading">
                <div x-show="path" @click="load(parentPath)" class="p-1 hover:bg-base-200 rounded cursor-pointer opacity-50 font-mono">..</div>
                <template x-for="f in tree" :key="f.path">
                  <div @click="f.type==='dir' ? load(f.path) : sel(f.path)"
                    class="group flex items-center justify-between p-1 hover:bg-base-200 rounded cursor-pointer"
                    :class="{'bg-primary/10 text-primary font-bold': activeFile === f.path}">
                    <div class="flex items-center gap-1 min-w-0">
                      <i class="ph" :class="f.type==='dir' ? 'ph-folder text-warning' : 'ph-file text-info'"></i>
                      <span class="truncate" x-text="f.name"></span>
                    </div>
                    <button x-show="f.type!=='dir'" @click.stop="pullAdd(f.path)"
                      class="btn btn-ghost btn-xs w-6 h-6 p-0 opacity-30 hover:opacity-100 hover:text-success">
                      <i class="ph ph-plus-circle text-lg"></i>
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <div x-show="pulled.length" class="flex flex-col gap-2 p-2 bg-base-200 rounded-lg">
          <div class="flex flex-wrap gap-1.5">
            <template x-for="p in pulled" :key="p">
              <div class="badge badge-outline gap-1 pr-0.5">
                <span class="truncate max-w-[140px] font-mono text-[10px]" x-text="p"></span>
                <button @click="pullRm(p)" class="btn btn-ghost btn-xs w-4 h-4 p-0 rounded-full hover:text-error"><i class="ph ph-x"></i></button>
              </div>
            </template>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold opacity-70" x-text="'Combined (' + pullStat + ')'"></span>
            <button @click="$clip(pullText)" class="btn btn-xs btn-square btn-ghost"><i class="ph ph-copy text-lg"></i></button>
          </div>
          <div class="overflow-auto font-mono text-xs border border-base-300 rounded p-2 bg-base-100 h-[25vh] opacity-80" x-text="pullText"></div>
        </div>`,

      path: '',
      tree: [],
      loading: false,
      pulled: [],
      pullText: '',
      flatFiles: [],
      open: true,

      init() {
        this.$root.__navigator = this;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
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
      get pullStat() {
        return this.pullText ? stat(this.pullText).split('·')[1] : '';
      },

      async load(p, silent) {
        this.path = p;
        Alpine.store('browser').path = p;
        this.loading = true;
        try { this.tree = await this.gh.ls(p); } catch {}
        this.loading = false;
        if (!silent) {
          const label = p ? p.split('/').pop() + '/' : '/';
          this.persist('folder-open', label);
        }
      },

      async reset() {
        this.path = '';
        this.tree = [];
        this.pulled = [];
        this.pullText = '';
        await this.load('', true);
        const repo = Alpine.store('browser').repo;
        const label = repo.split('/').pop();
        this.persist('database', label);
      },

      async sel(p, silent) {
        try {
          const res = await this.gh.get(p);
          Alpine.store('browser').activeFile = { path: p, content: fmt(res.text) };
        } catch(e) {
          Alpine.store('browser').activeFile = { path: p, content: '// Error: ' + e.message };
        }
        if (!silent) {
          this.persist('file', p.split('/').pop());
        }
      },

      persist(icon, label) {
        const store = Alpine.store('browser');
        const state = {
          repo: store.repo,
          path: this.path,
          file: store.activeFile?.path || ''
        };
        if (store.save) store.save(state);
        Alpine.store('toast')(icon, label, 'alert-info', 2000);
      },

      async fetchFlatTree() {
        try {
          const repo = Alpine.store('browser').repo;
          const j = await fetch('https://data.jsdelivr.com/v1/packages/gh/' + repo + '@main?structure=flat').then(r => r.json());
          this.flatFiles = (j.files || []).map(f => f.name.replace(/^\//, ''));
        } catch {}
      },

      async pullAdd(p) {
        if (!this.pulled.includes(p)) { this.pulled.push(p); await this.refreshPull(); }
      },
      async pullRm(p) {
        this.pulled = this.pulled.filter(x => x !== p);
        await this.refreshPull();
      },
      async refreshPull() {
        this.pullText = (await Promise.all(this.pulled.map(async p => {
          try { return '// === ' + p + ' ===\n' + fmt((await this.gh.get(p)).text); } catch { return '// ERROR: ' + p; }
        }))).join('\n\n');
      }
    };
  });
});
