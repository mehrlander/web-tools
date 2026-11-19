document.addEventListener('alpine:init', function() {
  Alpine.data('tools', function() {
    // The Tools view: every page the estate declares, as a list beside a live
    // preview of the selected one, so a page can be seen without leaving the
    // app.
    //
    // THE LIST. Each page any repo's .web-tools.json declares under `pages`,
    // read from the shell's config cache (window.__shell.estateConfigs, already
    // loaded for the sidebar, so no extra fetch), grouped by repo in the
    // sidebar's order, under a one-line row of repo pills with counts. Hidden
    // repos stay out. The cache is token-gated, so without a token the list
    // holds only the hub's utilities below.
    //
    // THE HUB'S UTILITIES. docs/tools.csv names a handful of hub pages (the
    // text-diff tool, the transform round-trip, and so on) and the icon each
    // gets. It is a CROSSWALK over the page gallery: the page's title and
    // description are joined from pages/pages.csv at load, never copied
    // (node/test/properties-registry.test.mjs gates that, and that every row
    // still resolves to a page). Those rows join the hub's group in the list;
    // they used to fill a card gallery of their own.
    //
    // THE PREVIEW. The selected page renders in a frame at the address the
    // shell would give it as an app view (shell.appViewAddress), so a private
    // page renders through toss-render with the reader's token. A full app,
    // which brings its own shell, previews at its own address. Up and Down in
    // the list move the selection.
    //
    // "Find undeclared" reads one recursive tree per listed repo and lists the
    // .html files no manifest names (the hub's gallery, pages/pages.csv, counts
    // as declared for the hub), so they can be declared or retired. It runs on
    // a tap, not at load: a tree per repo is too much for every visit.
    const HUB = 'mehrlander/web-tools';
    const MANIFEST = 'docs/tools.csv';
    // Paths that hold HTML but are not pages a reader opens.
    const NOT_PAGES = /(^|\/)(node_modules|dist|thumbs|fixtures|test|tests|vendor)\//;

    return {
      description: 'Tools view: every page the estate\'s manifests declare, plus the hub utilities named in docs/tools.csv, grouped by repo in a list beside a live preview of the selected page; an on-demand scan lists undeclared pages.',

      template: `
        <div class="h-full min-h-0 flex flex-col gap-2" data-pattern="list-detail">
          <div class="flex items-center gap-2">
            <span class="badge badge-ghost badge-sm font-mono tabular-nums" x-text="declaredCount"></span>
            <input type="search" x-model="q" placeholder="Pages by title, note or repo"
                   class="input input-sm input-bordered grow max-w-xs">
            <div class="grow"></div>
            <button class="btn btn-xs btn-ghost border border-base-300 font-normal" @click="scanUndeclared()" :disabled="!!scanning">
              <i class="ph ph-file-dashed"></i>
              <span x-text="scanning ? 'Scanning ' + scanning : (scanned ? undeclaredTotal + ' undeclared' : 'Find undeclared')"></span>
            </button>
          </div>
          <div class="flex items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none]" data-part="filters">
            <span class="text-xs text-base-content/50 mr-1">Repo</span>
            <button class="btn btn-xs rounded-full font-normal" :class="!pageRepo ? 'btn-primary' : 'btn-ghost border-base-300'"
                    @click="pageRepo = ''">All <span class="font-mono opacity-60" x-text="declaredCount"></span></button>
            <template x-for="g in groups" :key="g.repo">
              <button class="btn btn-xs rounded-full font-normal gap-1" :class="pageRepo === g.repo ? 'btn-primary' : 'btn-ghost border-base-300'"
                      @click="pageRepo = pageRepo === g.repo ? '' : g.repo">
                <i class="ph" :class="g.icon"></i><span x-text="g.short"></span>
                <span class="font-mono opacity-60" x-text="g.declared"></span>
              </button>
            </template>
          </div>

          <div x-show="loading" class="flex justify-center py-12"><span class="loading loading-dots loading-md opacity-30"></span></div>
          <div x-show="err" class="text-base text-error font-mono" x-text="err"></div>

          <div x-show="!loading" class="flex-1 min-h-0 grid gap-3 grid-rows-[minmax(0,2fr)_minmax(0,3fr)] @3xl:grid-rows-1 @3xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <div class="min-h-0 overflow-y-auto border border-base-300 rounded-box outline-none" tabindex="0"
                 @keydown.down.prevent="step(1)" @keydown.up.prevent="step(-1)" data-part="list">
              <template x-for="g in shownGroups" :key="g.repo">
                <div>
                  <div class="sticky top-0 z-10 bg-base-200 flex items-center gap-1.5 px-2 py-1 text-sm font-semibold">
                    <i class="ph text-base-content/60" :class="g.icon"></i><span x-text="g.short"></span>
                    <span class="font-mono text-xs text-base-content/50" x-text="g.rows.length"></span>
                  </div>
                  <template x-for="r in g.rows" :key="r.key">
                    <button type="button" class="w-full flex items-center gap-2 px-2 py-0.5 text-left min-w-0"
                            :class="sel === r.key ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'"
                            :data-key="r.key" @click="select(r.key)" data-part="item">
                      <i class="ph shrink-0" :class="r.undeclared ? 'ph-file-dashed text-base-content/40' : r.icon + ' text-base-content/50'"></i>
                      <span class="truncate" :class="r.undeclared && 'font-mono text-sm text-base-content/60'" x-text="r.title"></span>
                    </button>
                  </template>
                </div>
              </template>
              <div x-show="!shownGroups.length" class="p-3 text-base-content/50">No page matches.</div>
            </div>

            <div class="min-h-0 flex flex-col border border-base-300 rounded-box overflow-hidden" data-part="detail">
              <template x-if="current">
                <div class="flex flex-col h-full min-h-0">
                  <div class="px-3 py-2 border-b border-base-300 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span class="font-semibold inline-flex items-center gap-1.5">
                      <i class="ph text-base-content/60" :class="current.undeclared ? 'ph-file-dashed' : current.icon"></i>
                      <span x-text="current.title"></span>
                    </span>
                    <a :href="current.sourceUrl" target="_blank" rel="noopener"
                       class="font-mono text-xs text-base-content/50 hover:text-primary truncate"
                       x-text="current.repo + ':' + current.path"></a>
                    <div class="grow"></div>
                    <a :href="current.appHref" class="btn btn-xs btn-primary font-normal"><i class="ph ph-app-window"></i>Open in app</a>
                    <a :href="current.ownUrl" target="_blank" rel="noopener" class="btn btn-xs btn-ghost border-base-300 font-normal"><i class="ph ph-arrow-square-out"></i>Own address</a>
                    <p x-show="current.note" class="hidden @3xl:block basis-full text-sm text-base-content/70" x-text="current.note"></p>
                  </div>
                  <iframe :src="current.previewUrl" loading="lazy" class="flex-1 min-h-0 w-full bg-base-100 border-0"
                          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe>
                </div>
              </template>
            </div>
          </div>
        </div>`,

      loading: false,
      err: '',
      q: '',
      pageRepo: '',
      sel: '',
      // Declared pages and hub utilities, one row per page.
      rows: [],
      // repo -> paths no manifest names, filled by scanUndeclared.
      undeclared: {},
      scanning: '',
      scanned: false,
      // href -> { title, note } from the hub's pages catalog, the owner of both.
      pageIdentity: {},

      init(){
        this.$el.innerHTML = this.template;
        this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
        this.load();
      },

      MANIFEST,
      // A page as the shell would frame it: the same address an app view gets.
      previewUrl(repo, ref, path, query){
        const shell = window.__shell;
        try {
          if (shell?.appViewAddress) {
            return shell.appViewAddress({ repo, ref, path, query }, { hub: shell.DEFAULT_REPO || HUB, refs: window.__refs || {} });
          }
        } catch {}
        return '../pages/toss-render.html#gh=' + repo + (ref ? '@' + ref : '') + ':' + path + (query ? '?' + query : '');
      },
      row(repo, cfg, mark, t, pg){
        const query = typeof pg.query === 'string' ? pg.query.replace(/^\?/, '') : '';
        const [owner, name] = t.repo.split('/');
        const own = 'https://' + owner + '.github.io/' + name + '/' + t.path + (query ? '?' + query : '');
        return {
          repo, short: repo.split('/')[1] || repo,
          repoIcon: mark?.icon || cfg?.icon || 'ph-bookmark-simple',
          group: mark?.group || cfg?.group || '',
          order: Number.isFinite(mark?.order) ? mark.order : (Number.isFinite(cfg?.order) ? cfg.order : 0),
          title: pg.title || pg.viewLabel || t.path.split('/').pop().replace(/\.html?$/, ''),
          note: pg.note || '',
          icon: pg.icon || 'ph-browser',
          path: t.path,
          page: t.repo + ':' + t.path,
          appHref: pg.fullApp ? own : '?app=' + t.repo + (t.ref ? '@' + t.ref : '') + ':' + t.path,
          ownUrl: own,
          previewUrl: pg.fullApp ? own : this.previewUrl(t.repo, t.ref, t.path, query),
          sourceUrl: window.RepoAddress.github.blob(t.repo, t.ref || 'main', t.path),
          key: repo + '|' + t.path + (query ? '?' + query : ''),
          pageOrder: Number.isFinite(pg.order) ? pg.order : 0,
          undeclared: !!pg.undeclared,
        };
      },

      async load(){
        this.loading = true;
        this.err = '';
        const shell = window.__shell;
        try {
          // The hub's utilities and the identities they join, in parallel. A
          // page catalog that fails to load costs the titles, not the view.
          const gh = new window.GH({ token: window.TOKEN, repo: HUB });
          const [manifest, pages] = await Promise.all([
            gh.get(MANIFEST),
            gh.get('pages/pages.csv').catch(() => null),
          ]);
          this.pageIdentity = pages ? Object.fromEntries(
            window.Csv.rows(pages.text).map(p => ['pages/' + p.href, { title: p.title, note: p.note }])) : {};
          if (shell) { try { await shell.appViewsReady; } catch {} }
          const configs = shell?.estateConfigs || {};
          const hidden = shell?.resolveHidden ? shell.resolveHidden(configs[shell.REGISTRY_REPO]) : new Set();
          const marks = Object.fromEntries((shell?.estateRepos || []).map(r => [r.repo, r]));
          // A row is a page AND its query: budget-drs declares one app page
          // under many routes, and each route is its own row.
          const rows = [], seen = new Set();
          const add = r => { if (!seen.has(r.key)) { seen.add(r.key); rows.push(r); } };
          for (const [repo, cfg] of Object.entries(configs)) {
            if (hidden.has(repo) || !Array.isArray(cfg?.pages)) continue;
            for (const pg of cfg.pages) {
              if (!pg?.path) continue;
              const t = window.RepoAddress.parse(pg.path) || { repo, ref: '', path: pg.path };
              add(this.row(repo, cfg, marks[repo], t, pg));
            }
          }
          for (const it of window.Csv.rows(manifest.text)) {
            const t = window.RepoAddress.parse(it.path) || { repo: HUB, ref: '', path: it.path };
            // A utility a manifest already declares keeps that row.
            if (rows.some(r => r.page === t.repo + ':' + t.path)) continue;
            const id = t.repo === HUB ? this.pageIdentity[t.path] : null;
            add(this.row(t.repo, configs[t.repo], marks[t.repo], t,
              { title: id?.title, note: id?.note, icon: it.icon || 'ph-wrench', order: 100 }));
          }
          this.rows = rows;
          if (!this.sel && this.flat.length) this.sel = this.flat[0].key;
        } catch (e) {
          this.err = 'Could not load the page list: ' + (e?.message || e);
        } finally { this.loading = false; }
      },

      get declaredCount(){ return this.rows.length; },
      // Repos with pages, in the sidebar's order: group, order, name.
      get groups(){
        const by = new Map();
        const all = [...this.rows];
        for (const [repo, paths] of Object.entries(this.undeclared)) {
          const base = this.rows.find(r => r.repo === repo);
          for (const path of paths) {
            all.push(this.row(repo, null, base ? { icon: base.repoIcon, group: base.group, order: base.order } : null,
              { repo, ref: '', path }, { title: path, undeclared: true, order: 1000 }));
          }
        }
        for (const r of all) {
          if (!by.has(r.repo)) by.set(r.repo, { repo: r.repo, short: r.short, icon: r.repoIcon, group: r.group, order: r.order, rows: [], declared: 0 });
          const g = by.get(r.repo);
          g.rows.push(r);
          if (!r.undeclared) g.declared++;
        }
        const groups = [...by.values()];
        for (const g of groups) g.rows.sort((a, b) => (a.undeclared - b.undeclared) || (a.pageOrder - b.pageOrder) || a.title.localeCompare(b.title));
        return groups.sort((a, b) => a.group.localeCompare(b.group) || (a.order - b.order) || a.repo.localeCompare(b.repo));
      },
      get shownGroups(){
        const q = this.q.trim().toLowerCase();
        return this.groups
          .filter(g => !this.pageRepo || g.repo === this.pageRepo)
          .map(g => ({ ...g, rows: q ? g.rows.filter(r => (r.title + ' ' + r.note + ' ' + r.repo + ' ' + r.path).toLowerCase().includes(q)) : g.rows }))
          .filter(g => g.rows.length);
      },
      get flat(){ return this.shownGroups.flatMap(g => g.rows); },
      get current(){ return this.flat.find(r => r.key === this.sel) || this.flat[0] || null; },
      get undeclaredTotal(){ return Object.values(this.undeclared).reduce((n, l) => n + l.length, 0); },

      select(key){ this.sel = key; },
      // Up and Down move the selection through the visible rows and keep the
      // selected row in view.
      step(d){
        const list = this.flat;
        if (!list.length) return;
        const i = Math.max(0, list.findIndex(r => r.key === (this.current?.key)));
        this.sel = list[Math.min(list.length - 1, Math.max(0, i + d))].key;
        this.$nextTick(() => [...this.$el.querySelectorAll('[data-key]')]
          .find(e => e.dataset.key === this.sel)?.scrollIntoView?.({ block: 'nearest' }));
      },

      // One recursive tree per listed repo; an .html file no manifest names is
      // undeclared. A repo whose tree fails or comes back truncated is skipped.
      async scanUndeclared(){
        if (this.scanning) return;
        const declared = new Set(this.rows.map(r => r.page));
        for (const href of Object.keys(this.pageIdentity)) declared.add(HUB + ':' + href);
        const found = {};
        for (const g of this.groups) {
          this.scanning = g.short;
          try {
            const gh = new window.GH({ token: window.TOKEN, repo: g.repo });
            const res = await gh.req('git/trees/HEAD?recursive=1');
            if (res.truncated) continue;
            const list = (res.tree || [])
              .filter(e => e.type === 'blob' && /\.html?$/i.test(e.path) && !NOT_PAGES.test(e.path))
              .map(e => e.path)
              .filter(path => !declared.has(g.repo + ':' + path))
              .sort();
            if (list.length) found[g.repo] = list;
          } catch {}
        }
        this.undeclared = found;
        this.scanning = '';
        this.scanned = true;
      },
    };
  });
});
