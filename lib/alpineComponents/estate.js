document.addEventListener('alpine:init', function() {
  Alpine.data('estate', function() {
    // The all-repo view: the estate. A card per repo from the private registry's
    // `repos` list (fallback: the quickLinks row), enriched with live GitHub
    // metadata (description, visibility, pushed), plus every curated surface in
    // the registry's surfaces/ dir rendered beneath. Public (no token): the
    // public default only, and no surfaces. See docs/show-repo.md "The estate".
    const KIND_ICONS = {
      github_blob: 'ph-file', github_dir: 'ph-folder', repo: 'ph-git-branch',
      url: 'ph-link', note: 'ph-note', story: 'ph-book-open',
    };

    return {
      description: 'All-repo estate view: registry-driven repo cards with live GitHub metadata, plus curated surfaces from the private registry',

      template: `
        <div>
          <div class="flex items-center gap-2 mb-1">
            <h1 class="text-2xl font-bold tracking-tight">Repositories</h1>
            <a href="https://github.com/mehrlander?tab=repositories" target="_blank"
               class="text-base-content/30 hover:text-base-content/70 transition-colors"
               title="All repositories on GitHub">
              <i class="ph ph-github-logo text-lg leading-none"></i>
            </a>
          </div>
          <p class="text-sm text-base-content/50 mb-6">
            <span x-show="authed">The registry's curated estate. A card opens the repo here; the logo opens it on GitHub.</span>
            <span x-show="!authed">Public view. Set a token via the sidebar shield to see the full estate and its surfaces.</span>
          </p>

          <div x-show="loading" class="flex justify-center py-16">
            <span class="loading loading-dots loading-md opacity-30"></span>
          </div>

          <template x-for="g in groups" :key="g.label">
            <section class="mb-8">
              <h2 x-show="g.label" class="text-xs font-mono uppercase tracking-widest text-base-content/40 mb-3"
                  x-text="g.label"></h2>
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <template x-for="e in g.items" :key="e.repo">
                  <div class="card bg-base-100 border border-base-300 shadow-sm hover:border-primary/40 transition-colors">
                    <div class="card-body p-4 gap-1.5">
                      <div class="flex items-center gap-2">
                        <i class="ph text-xl text-primary shrink-0" :class="e.icon"></i>
                        <button @click="openRepo(e.repo)"
                                class="font-mono text-sm font-semibold truncate hover:text-primary transition-colors cursor-pointer text-left"
                                x-text="e.repo.split('/')[1]"></button>
                        <div class="grow"></div>
                        <i x-show="e.meta" class="ph text-sm shrink-0"
                           :class="e.meta?.priv ? 'ph-lock text-base-content/40' : 'ph-globe text-base-content/40'"
                           :title="e.meta?.priv ? 'private' : 'public'"></i>
                        <a :href="'https://github.com/' + e.repo" target="_blank" @click.stop
                           class="text-base-content/30 hover:text-base-content/70 transition-colors shrink-0"
                           title="Open on GitHub"><i class="ph ph-github-logo text-base"></i></a>
                      </div>
                      <p class="text-xs text-base-content/60 min-h-8" x-text="e.note || e.meta?.desc || ''"></p>
                      <div class="flex items-center gap-2 text-[10px] text-base-content/40">
                        <span x-show="e.meta?.ago" class="flex items-center gap-1">
                          <i class="ph ph-clock"></i><span x-text="'pushed ' + e.meta.ago"></span>
                        </span>
                        <span x-show="e.err" class="text-warning flex items-center gap-1">
                          <i class="ph ph-warning"></i>unreachable
                        </span>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </section>
          </template>

          <template x-for="s in surfaces" :key="s.file">
            <section class="mb-8">
              <div class="flex items-baseline gap-2 mb-1">
                <h2 class="text-lg font-semibold" x-text="s.manifest.name || s.file"></h2>
                <span x-show="s.manifest.subtitle" class="text-sm text-base-content/40"
                      x-text="s.manifest.subtitle"></span>
                <div class="grow"></div>
                <span class="badge badge-ghost badge-sm font-mono" x-text="s.manifest.category || 'showcase'"></span>
              </div>
              <p x-show="s.manifest.description" class="text-xs text-base-content/50 mb-3"
                 x-text="s.manifest.description"></p>
              <div class="flex flex-col gap-2">
                <template x-for="it in s.items" :key="it.id || it.title">
                  <div class="border border-base-300 rounded-lg bg-base-100 p-3">
                    <div class="flex items-center gap-2">
                      <i class="ph text-base text-primary shrink-0" :class="kindIcon(it)"></i>
                      <template x-if="openable(it)">
                        <button @click="openItem(it)"
                                class="text-sm font-medium hover:text-primary transition-colors cursor-pointer text-left truncate"
                                x-text="it.title || itemPath(it)"></button>
                      </template>
                      <template x-if="!openable(it) && itemExt(it)">
                        <a :href="itemExt(it)" target="_blank"
                           class="text-sm font-medium hover:text-primary transition-colors truncate"
                           x-text="it.title || itemExt(it)"></a>
                      </template>
                      <template x-if="!openable(it) && !itemExt(it)">
                        <span class="text-sm font-medium truncate" x-text="it.title || '(untitled)'"></span>
                      </template>
                      <span x-show="it.facet" class="badge badge-ghost badge-xs" x-text="it.facet"></span>
                      <div class="grow"></div>
                      <span class="text-[10px] font-mono text-base-content/30 hidden sm:inline" x-text="itemPill(it)"></span>
                      <a x-show="itemGh(it)" :href="itemGh(it)" target="_blank"
                         class="text-base-content/30 hover:text-base-content/70 transition-colors shrink-0"
                         title="Open on GitHub"><i class="ph ph-github-logo"></i></a>
                    </div>
                    <p x-show="it.snippet" class="text-xs text-base-content/50 mt-1" x-text="it.snippet"></p>
                    <p x-show="it.commentary" class="text-xs text-base-content/60 mt-1.5 whitespace-pre-line border-l-2 border-base-300 pl-2"
                       x-text="it.commentary"></p>
                    <p x-show="bodyOf(it)" class="text-xs text-base-content/70 mt-1.5 whitespace-pre-line"
                       x-text="bodyOf(it)"></p>
                  </div>
                </template>
              </div>
            </section>
          </template>
        </div>`,

      loading: true,
      authed: false,
      entries: [],     // [{repo, icon, note, group, meta:{desc,priv,ago,ref}, err}]
      surfaces: [],    // [{file, manifest, items}]

      init(){
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
        this.load();
        // Auth resolves after boot; reload when it lands. Registry edits
        // (config-saved on the registry repo) refresh the view the same way.
        this.$watch(() => window.__shell && window.__shell._authState, (s) => {
          if (s === 'auth') this.load();
        });
        document.addEventListener('web-tools:config-saved', (e) => {
          if (e.detail?.repo === this.registry()) this.load();
        });
      },

      registry(){ return window.__shell?.REGISTRY_REPO || 'mehrlander/web-tools-private'; },
      hasToken(){ return !!window.__shell?.hasToken?.(); },

      async load(){
        this.authed = this.hasToken();
        let list = null;
        if (this.authed){
          try {
            const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: 'main' });
            const cfg = JSON.parse((await reg.get('.web-tools.json')).text);
            const repos = Array.isArray(cfg.repos) ? cfg.repos.filter(e => e && typeof e.repo === 'string') : [];
            if (repos.length) list = repos;
            else if (Array.isArray(cfg.quickLinks)) list = cfg.quickLinks.filter(e => e && typeof e.repo === 'string');
            this.loadSurfaces(reg);   // independent; don't hold the cards for it
          } catch {}
        }
        if (!list) list = window.__shell?.quickLinks?.length
          ? window.__shell.quickLinks
          : [{ repo: 'mehrlander/web-tools', icon: 'ph-toolbox' }];
        this.entries = list.map(e => ({
          repo: e.repo, icon: e.icon || 'ph-bookmark-simple',
          note: e.note || '', group: e.group || '', meta: null, err: false,
        }));
        this.loading = false;

        // Live metadata, one /repos call per card, in parallel and fault-tolerant.
        const gh = new window.GH({ token: this.authed ? window.TOKEN : '' });
        await Promise.all(this.entries.map(async (en) => {
          try {
            const r = await gh.req('/repos/' + en.repo);
            en.meta = {
              desc: r.description || '', priv: !!r.private,
              ago: (r.pushed_at && gh.ago) ? gh.ago(r.pushed_at) : '',
              ref: r.default_branch || 'main',
            };
          } catch { en.err = true; }
        }));
      },

      // Every surfaces/*.surface in the registry, archive excluded, standing
      // first. 404 (no dir yet) is a quiet no-op.
      async loadSurfaces(reg){
        try {
          const files = (await reg.ls('surfaces')).filter(f => f.type === 'file' && f.name.endsWith('.surface'));
          const loaded = await Promise.all(files.map(async (f) => {
            try {
              const s = JSON.parse((await reg.get('surfaces/' + f.name)).text);
              return { file: f.name, manifest: s.manifest || {}, items: Array.isArray(s.items) ? s.items : [] };
            } catch { return null; }
          }));
          const rank = c => ({ default: 0, standing: 1, showcase: 2 }[c] ?? 2);
          this.surfaces = loaded.filter(Boolean)
            .filter(s => (s.manifest.category || 'showcase') !== 'archive')
            .sort((a, b) => rank(a.manifest.category || 'showcase') - rank(b.manifest.category || 'showcase'));
        } catch { this.surfaces = []; }
      },

      get groups(){
        const order = [];
        const by = new Map();
        for (const e of this.entries){
          const label = e.group || '';
          if (!by.has(label)) { by.set(label, []); order.push(label); }
          by.get(label).push(e);
        }
        return order.map(label => ({ label, items: by.get(label) }));
      },

      async openRepo(repo){ await window.__shell?.ensureBrowser(repo); },

      // ── Surface items ──────────────────────────────────────────────────────
      // A github item names its target either as {repo, ref, path} (the stage /
      // task-0008 shape) or as a github.com URL (the surfacer's native shape);
      // both resolve to the same open-in-shell + view-on-github pair.
      kindIcon(it){ return KIND_ICONS[it.kind] || 'ph-shapes'; },
      bodyOf(it){ return (it.kind === 'note' || it.kind === 'story') ? (it.body || '') : ''; },

      itemRef(it){
        if (it.kind !== 'github_blob' && it.kind !== 'github_dir') return null;
        if (it.repo && it.path) return { repo: it.repo, ref: it.ref || '', path: it.path, dir: it.kind === 'github_dir' };
        const m = (it.url || '').match(/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/(blob|tree)\/([^/]+)\/(.+?)(?:[?#].*)?$/);
        if (m) return { repo: m[1], ref: m[3], path: m[4], dir: m[2] === 'tree' };
        return null;
      },
      openable(it){ return !!this.itemRef(it); },
      itemPath(it){ return this.itemRef(it)?.path || ''; },
      itemPill(it){
        const r = this.itemRef(it);
        if (r) return r.repo;
        if (it.url) { try { return new URL(it.url).hostname; } catch {} }
        return '';
      },
      itemGh(it){
        const r = this.itemRef(it);
        if (!r) return '';
        return 'https://github.com/' + r.repo + '/' + (r.dir ? 'tree' : 'blob') + '/' + (r.ref || 'main') + '/' + r.path;
      },
      itemExt(it){ return (it.kind === 'url' || (!this.itemRef(it) && it.url)) ? (it.url || '') : ''; },
      async openItem(it){
        const r = this.itemRef(it);
        if (!r || !window.__shell) return;
        await window.__shell.ensureBrowser(r.repo, r.ref || '');
        if (r.dir) await window.__shell.openFolder(r.path);
        else await window.__shell.openFile(r.path);
      },
    };
  });
});
