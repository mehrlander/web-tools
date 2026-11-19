document.addEventListener('alpine:init', function() {
  Alpine.data('tools', function() {
    // The Tools view: a curated gallery of the utility pages the owner reaches
    // for (the text-diff tool, the transform/compress round-trip, and so on),
    // an estate-level peer of Repos / Surfaces / Stage / Map. It reuses the same
    // card grid the pages catalog uses (thumbnail or live preview, an open link,
    // a source link), but fed from a hand-curated manifest rather than a repo
    // scan.
    //
    // The list is authored, cross-repo by nature (each entry carries its own
    // origin), and lives in the hub's committed docs/tools.csv. The hub is
    // public, so the whole view needs no token: thumbnails come from jsDelivr,
    // the render link is the hosted github.io URL, the source link is the blob.
    // A future private tool would ride a token-gated toss-render #gh= render the
    // same way the pages catalog handles an off-default ref.
    //
    // Manifest entry: { path, icon }. `path` is a bare repo path
    // ("pages/diff-tool.html", the hub at main) or a qualified cross-repo ref
    // ("owner/repo[@ref]:path"), the same grammar as a pages catalog entry and
    // stage.files.
    //
    // The title and the description are NOT in that entry. docs/tools.csv is a
    // CROSSWALK over the page gallery: it asserts only which pages are shown
    // here and what icon each gets, and the page's own identity is joined from
    // pages/pages.csv at load. It used to carry its own copies, and they
    // drifted (measured 2026-08-13: the description differed on all four rows,
    // the title on one, with no consistent direction, so neither copy was the
    // considered one). Two registries asserting one property about one target
    // is the invalid configuration docs/registries.md names, and
    // node/test/properties-registry.test.mjs now gates it, along with a check
    // that every row here still resolves to a page.
    //
    // BELOW THE CURATED GRID, THE ESTATE'S PAGES. Every page any repo's
    // .web-tools.json declares under `pages`, read from the shell's config
    // cache (window.__shell.estateConfigs, already loaded for the sidebar, so
    // no extra fetch), grouped by repo under a one-line row of repo pills with
    // counts. A row opens the page as an app view (?app=owner/repo:path), so a
    // page is reachable inside the app without a header button of its own.
    // Token-gated like the cache: without a token the section stays empty.
    //
    // "Find undeclared" reads one recursive tree per listed repo and lists the
    // .html files no manifest names (the hub's own gallery, pages/pages.csv,
    // counts as declared for the hub). It runs on a tap, not at load: a tree
    // per repo is too much to spend on every visit to the view.
    const HUB = 'mehrlander/web-tools';
    const MANIFEST = 'docs/tools.csv';
    // Paths that hold HTML but are not pages a reader opens.
    const NOT_PAGES = /(^|\/)(node_modules|dist|thumbs|fixtures|test|tests|vendor)\//;

    return {
      description: 'Tools view: a curated gallery of utility pages (docs/tools.csv in the hub), rendered as cards with a thumbnail/live toggle, an open link, and a source link; below it, with a token, every page the estate\'s manifests declare, grouped by repo and opened as app views, with an on-demand scan for undeclared pages.',

      template: `
        <div class="w-full">
          <div class="flex items-center gap-2 mb-4">
            <h2 class="text-lg font-semibold">Tools</h2>
            <span x-show="items.length" class="badge badge-ghost badge-sm font-mono" x-text="items.length"></span>
            <div class="grow"></div>
            <!-- The registry chip, the Map view's mark for "this view renders
                 that registry file". Replaces a Curate button that was pinned to
                 main whatever ref the view was read at, and was the one such link
                 in the estate with no source peek. -->
            <a :href="manifestGh()" :data-peek="manifestPeek()" target="_blank" rel="noopener"
               class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-base-300 bg-base-200/50 font-mono text-sm text-base-content/70 hover:text-primary hover:border-primary/50 hover:bg-base-200 transition-colors"
               :data-title-tip="'The registry this view renders (' + MANIFEST + ')'">
              <i class="ph ph-stack text-base opacity-50"></i><span x-text="MANIFEST"></span><i class="ph ph-github-logo opacity-40"></i>
            </a>
          </div>

          <div x-show="loading" class="flex justify-center py-12">
            <span class="loading loading-dots loading-md opacity-30"></span>
          </div>
          <div x-show="err" class="text-base text-error font-mono" x-text="err"></div>
          <div x-show="!loading && !err && !items.length" class="text-base text-base-content/50 italic py-8">
            No tools curated yet. Add entries to docs/tools.csv.
          </div>

          <!-- data-pattern and data-part declare this a Card grid and name its
               parts (data/ui-units/codebook.md, "Declaring a pattern in
               markup"); nothing at runtime reads them. -->
          <div class="grid gap-3 @xl:grid-cols-2 @3xl:grid-cols-3 @4xl:grid-cols-4" data-pattern="card-grid" data-part="list">
            <template x-for="p in cards" :key="p.path">
              <div class="card bg-base-100 border border-base-300 shadow-sm overflow-hidden" data-part="item">
                <div class="relative bg-base-200/40 border-b border-base-300 aspect-[16/10] overflow-hidden" data-part="body">
                  <a :href="p.renderUrl" target="_blank" x-show="p.view==='shot'" class="block w-full h-full">
                    <img x-show="p.thumb && !p.thumbMissing" :src="p.thumb" :alt="p.title" loading="lazy"
                         class="w-full h-full object-cover object-top" @error="p.thumbMissing = true">
                    <div x-show="!p.thumb || p.thumbMissing"
                         class="w-full h-full flex items-center justify-center text-base-content/30 gap-1">
                      <i class="ph text-3xl" :class="p.icon || 'ph-wrench'"></i>
                    </div>
                  </a>
                  <template x-if="p.view==='live'">
                    <iframe :src="p.renderUrl" loading="lazy"
                            sandbox="allow-scripts allow-same-origin allow-popups"
                            class="w-full h-full bg-base-100"></iframe>
                  </template>
                  <div class="join absolute top-1 right-1 shadow" data-part="actions">
                    <button class="btn btn-xs join-item" :class="p.view==='shot' && 'btn-primary btn-active'"
                            @click="p.view='shot'" data-title-tip="Thumbnail"><i class="ph ph-image"></i></button>
                    <button class="btn btn-xs join-item" :class="p.view==='live' && 'btn-primary btn-active'"
                            @click="p.view='live'" data-title-tip="Live preview"><i class="ph ph-play"></i></button>
                  </div>
                </div>
                <div class="card-body p-2.5 gap-0.5">
                  <div class="flex items-baseline justify-between gap-2">
                    <a :href="p.renderUrl" target="_blank"
                       class="font-semibold text-base hover:text-primary transition-colors truncate inline-flex items-center gap-1.5" data-part="title">
                      <i class="ph shrink-0 text-base-content/50" :class="p.icon || 'ph-wrench'"></i>
                      <span x-text="p.title"></span></a>
                    <a :href="p.codeUrl" target="_blank" data-title-tip="Source on GitHub"
                       class="text-base-content/30 hover:text-base-content/60 shrink-0" data-part="links">
                      <i class="ph ph-code"></i></a>
                  </div>
                  <p class="text-sm text-base-content/50" x-text="p.note || p.path" data-part="summary"></p>
                </div>
              </div>
            </template>
          </div>

          <section x-show="estatePages.length" class="mt-8" data-pattern="grouped-list">
            <div class="flex items-center gap-2 mb-2">
              <h2 class="text-lg font-semibold">Pages across the estate</h2>
              <span class="badge badge-ghost badge-sm font-mono" x-text="estatePages.length"></span>
              <div class="grow"></div>
              <button class="btn btn-xs btn-ghost border border-base-300" @click="scanUndeclared()" :disabled="!!scanning">
                <i class="ph ph-file-dashed"></i>
                <span x-text="scanning ? 'Scanning ' + scanning : (scanned ? undeclaredTotal + ' undeclared' : 'Find undeclared')"></span>
              </button>
            </div>
            <div class="flex items-center gap-1 overflow-x-auto whitespace-nowrap pb-1 mb-3 [scrollbar-width:none]" data-part="filters">
              <span class="text-xs text-base-content/50 mr-1">Repo</span>
              <button class="btn btn-xs rounded-full font-normal" :class="!pageRepo ? 'btn-primary' : 'btn-ghost border-base-300'"
                      @click="pageRepo = ''">All <span class="font-mono opacity-60" x-text="estatePages.length"></span></button>
              <template x-for="g in pageGroups" :key="g.repo">
                <button class="btn btn-xs rounded-full font-normal gap-1" :class="pageRepo === g.repo ? 'btn-primary' : 'btn-ghost border-base-300'"
                        @click="pageRepo = pageRepo === g.repo ? '' : g.repo">
                  <i class="ph" :class="g.icon"></i><span x-text="g.short"></span>
                  <span class="font-mono opacity-60" x-text="g.pages.length"></span>
                </button>
              </template>
            </div>
            <div class="columns-1 gap-x-8 @3xl:columns-2 @6xl:columns-3" data-part="list">
              <template x-for="g in shownGroups" :key="g.repo">
                <div class="break-inside-avoid mb-4" data-part="item">
                  <div class="flex items-center gap-1.5 text-sm font-semibold border-b border-base-300 pb-1 mb-1">
                    <i class="ph text-base-content/60" :class="g.icon"></i>
                    <a :href="'?repo=' + g.repo" class="hover:text-primary" x-text="g.short"></a>
                    <span class="font-mono text-xs text-base-content/50" x-text="g.pages.length"></span>
                  </div>
                  <template x-for="pg in g.pages" :key="pg.key">
                    <a :href="pg.href" class="flex items-baseline gap-2 px-1 py-0.5 rounded hover:bg-base-200 min-w-0">
                      <i class="ph shrink-0 text-base-content/50" :class="pg.icon"></i>
                      <span class="shrink-0" x-text="pg.title"></span>
                      <span class="text-sm text-base-content/50 truncate" x-text="pg.note"></span>
                    </a>
                  </template>
                  <template x-for="u in (undeclared[g.repo] || [])" :key="u">
                    <a :href="'?app=' + g.repo + ':' + u" class="flex items-baseline gap-2 px-1 py-0.5 rounded hover:bg-base-200 min-w-0 text-base-content/50">
                      <i class="ph ph-file-dashed shrink-0"></i>
                      <span class="font-mono text-sm truncate" x-text="u"></span>
                    </a>
                  </template>
                </div>
              </template>
            </div>
          </section>
        </div>`,

      loading: false,
      err: '',
      items: [],
      // href -> { title, note } from the hub's pages catalog, the owner of both.
      pageIdentity: {},
      // The estate section: declared pages, the repo filter, the scan.
      estatePages: [],
      pageRepo: '',
      undeclared: {},
      scanning: '',
      scanned: false,

      init(){
        this.$el.innerHTML = this.template;
        this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
        this.load();
        this.loadEstatePages();
      },

      hub(){ return HUB; },
      MANIFEST,
      // Follows the ref the view was read at, the way map.js's hubUrl does: a
      // ?use= branch that edits the manifest used to open main's copy of it.
      // The selection first, which also covers a renderer's implied version.
      ref(){ try { return window.GH?.refFor?.(HUB) || new URLSearchParams(location.search).get('use') || 'main'; } catch { return 'main'; } },
      manifestGh(){ return window.RepoAddress.github.blob(HUB, this.ref(), MANIFEST); },
      manifestPeek(){ return window.SourcePeek?.addr(HUB, this.ref(), MANIFEST) || null; },

      // Resolve a manifest path into { repo, ref, path }. Bare paths mean the hub;
      // a qualified "owner/repo[@ref]:path" overrides both. A path with no @ref
      // reads where the selection puts its repo, else main.
      resolve(rawPath){
        const a = window.RepoAddress.parse(rawPath);
        const sel = (repo, path) => window.GH?.refFor?.(repo, path) || '';
        if (a) return { repo: a.repo, ref: a.ref || sel(a.repo, a.path) || 'main', path: a.path };
        return { repo: HUB, ref: sel(HUB, rawPath) || this.ref(), path: rawPath };
      },
      renderUrl(rawPath){
        const { repo, ref, path } = this.resolve(rawPath);
        const [owner, name] = repo.split('/');
        const base = 'https://' + owner + '.github.io/' + name + '/' + path;
        if (ref === 'main') return base;
        if (owner === 'mehrlander') {
          return 'https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=' +
            repo + '@' + ref + ':' + path;
        }
        return base + '?use=' + encodeURIComponent(ref);
      },
      thumbUrl(rawPath){
        const { repo, ref, path } = this.resolve(rawPath);
        if (!path.startsWith('pages/') || path.startsWith('pages/thumbs/')) return '';
        const rel = path.slice('pages/'.length).replace(/\.html$/, '.png');
        return 'https://raw.githubusercontent.com/' + repo + '/' + ref + '/pages/thumbs/' + rel;
      },
      codeUrl(rawPath){
        const { repo, ref, path } = this.resolve(rawPath);
        return window.RepoAddress.github.blob(repo, ref, path);
      },
      // The page owns its title and description; a row here inherits both.
      // A cross-repo ref has no row in the hub's catalog, so it falls back to
      // the filename, which is the same fallback a hub page would get if the
      // catalog were unreachable. The gate keeps that from silently covering a
      // hub path whose page is gone.
      identity(rawPath){
        const { repo, path } = this.resolve(rawPath);
        const hit = repo === HUB ? this.pageIdentity[path] : null;
        return {
          title: hit?.title || path.split('/').pop().replace(/\.html$/, ''),
          note: hit?.note || '',
        };
      },
      get cards(){
        return this.items.map(it => ({
          path: it.path,
          ...this.identity(it.path),
          icon: it.icon || 'ph-wrench',
          renderUrl: this.renderUrl(it.path),
          codeUrl: this.codeUrl(it.path),
          thumb: this.thumbUrl(it.path),
          thumbMissing: false,
          view: 'shot',
        }));
      },

      // Every declared page, one row each, from the shell's config cache.
      async loadEstatePages(){
        const shell = window.__shell;
        if (!shell) return;
        try { await shell.appViewsReady; } catch {}
        const configs = shell.estateConfigs || {};
        const hidden = shell.resolveHidden ? shell.resolveHidden(configs[shell.REGISTRY_REPO]) : new Set();
        const marks = Object.fromEntries((shell.estateRepos || []).map(r => [r.repo, r]));
        const rows = [];
        for (const [repo, cfg] of Object.entries(configs)) {
          if (hidden.has(repo) || !Array.isArray(cfg?.pages)) continue;
          for (const pg of cfg.pages) {
            if (!pg?.path) continue;
            const t = window.RepoAddress.parse(pg.path) || { repo, ref: '', path: pg.path };
            const query = typeof pg.query === 'string' && pg.query ? '?' + pg.query.replace(/^\?/, '') : '';
            // A full app brings its own shell, so it opens at its own address.
            const own = 'https://' + t.repo.split('/')[0] + '.github.io/' + t.repo.split('/')[1] + '/' + t.path + query;
            rows.push({
              repo, short: repo.split('/')[1] || repo,
              repoIcon: marks[repo]?.icon || cfg.icon || 'ph-bookmark-simple',
              group: marks[repo]?.group || cfg.group || '',
              order: Number.isFinite(marks[repo]?.order) ? marks[repo].order : (Number.isFinite(cfg.order) ? cfg.order : 0),
              title: pg.title || pg.viewLabel || t.path.split('/').pop().replace(/\.html?$/, ''),
              note: pg.note || '',
              icon: pg.icon || 'ph-browser',
              page: t.repo + ':' + t.path,
              href: pg.fullApp ? own : '?app=' + t.repo + (t.ref ? '@' + t.ref : '') + ':' + t.path,
              key: repo + '|' + pg.path + query,
              pageOrder: Number.isFinite(pg.order) ? pg.order : 0,
            });
          }
        }
        this.estatePages = rows;
      },

      // Repos with declared pages, in the sidebar's order: group, order, name.
      get pageGroups(){
        const by = new Map();
        for (const r of this.estatePages) {
          if (!by.has(r.repo)) by.set(r.repo, { repo: r.repo, short: r.short, icon: r.repoIcon, group: r.group, order: r.order, pages: [] });
          by.get(r.repo).pages.push(r);
        }
        const groups = [...by.values()];
        for (const g of groups) g.pages.sort((a, b) => (a.pageOrder - b.pageOrder) || a.title.localeCompare(b.title));
        return groups.sort((a, b) => a.group.localeCompare(b.group) || (a.order - b.order) || a.repo.localeCompare(b.repo));
      },
      get shownGroups(){
        return this.pageRepo ? this.pageGroups.filter(g => g.repo === this.pageRepo) : this.pageGroups;
      },
      get undeclaredTotal(){
        return Object.values(this.undeclared).reduce((n, list) => n + list.length, 0);
      },

      // One recursive tree per listed repo; an .html file no manifest names is
      // undeclared. A repo whose tree fails or comes back truncated is skipped.
      async scanUndeclared(){
        if (this.scanning) return;
        const declared = new Set(this.estatePages.map(r => r.page));
        for (const href of Object.keys(this.pageIdentity)) declared.add(HUB + ':' + href);
        const found = {};
        for (const g of this.pageGroups) {
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

      async load(){
        this.loading = true;
        this.err = '';
        try {
          // No ref: both catalogs follow the selection for web-tools.
          const gh = new window.GH({ token: window.TOKEN, repo: HUB });
          // Both files, in parallel: the manifest and the identities it joins.
          // A page catalog that fails to load costs the titles, not the view.
          const [manifest, pages] = await Promise.all([
            gh.get('docs/tools.csv'),
            gh.get('pages/pages.csv').catch(() => null),
          ]);
          // Both are CSVs. This one was JSON with an `items` key and the
          // catalog was a bare array of groups until 2026-08-16; reading either
          // with JSON.parse now throws and takes the whole view with it, which
          // is what the catch below was quietly turning into an error banner.
          this.items = window.Csv.rows(manifest.text);
          this.pageIdentity = pages ? Object.fromEntries(
            window.Csv.rows(pages.text).map(
              p => ['pages/' + p.href, { title: p.title, note: p.note }])) : {};
        } catch (e) {
          this.err = 'Could not load the tools list: ' + (e?.message || e);
        } finally { this.loading = false; }
      },
    };
  });
});
