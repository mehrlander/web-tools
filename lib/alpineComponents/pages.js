document.addEventListener('alpine:init', function() {
  Alpine.data('pages', function() {
    return {
      description: 'Pages view for the GitHub browser: scans the selected repo/ref for .html pages and shows them as cards (thumbnail when the repo ships one, live iframe preview, rendered/source links), grouped by folder. The web-tools pages/index idea, generalized to whatever repo the browser is pointed at.',

      template: `
        <div>
          <button @click="toggle()" class="flex items-center gap-1 font-semibold py-0.5 hover:text-primary mb-1 cursor-pointer">
            <i class="ph" :class="open?'ph-caret-down':'ph-caret-right'"></i>Pages
            <span x-show="items.length" class="badge badge-ghost badge-sm font-mono" x-text="items.length"></span>
          </button>
          <div x-show="open" x-collapse>
            <div x-show="!repo" class="text-xs text-base-content/50 italic px-1 py-3">Pick a repository first.</div>

            <div x-show="repo && unpublished" class="text-xs text-warning/80 px-1 pb-2 flex items-center gap-1.5">
              <i class="ph ph-warning"></i>
              <span>This repo has no GitHub Pages site; rendered links will 404. Source links still work.</span>
            </div>

            <div x-show="loading" class="flex justify-center py-8">
              <span class="loading loading-dots loading-sm opacity-30"></span>
            </div>
            <div x-show="error" class="text-xs text-error px-1 py-2 font-mono" x-text="error"></div>
            <div x-show="repo && !loading && !error && loaded && !items.length" class="text-xs text-base-content/50 italic px-1 py-3">
              No .html pages found on this ref.
            </div>

            <template x-for="g in groups" :key="g.dir">
              <div class="mb-5">
                <div x-show="g.dir" class="text-xs font-mono uppercase tracking-widest text-base-content/40 mb-2 flex items-center gap-2">
                  <i class="ph ph-folder"></i><span x-text="g.dir + '/'"></span>
                  <span class="badge badge-ghost badge-sm" x-text="g.items.length"></span>
                </div>
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <template x-for="p in g.items" :key="p.path">
                    <div class="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
                      <div class="relative bg-base-200/40 border-b border-base-300 aspect-[16/10] overflow-hidden">
                        <a :href="p.renderUrl" target="_blank" x-show="p.view==='shot'" class="block w-full h-full">
                          <img x-show="p.thumb && !p.thumbMissing" :src="p.thumb" :alt="p.name" loading="lazy"
                               class="w-full h-full object-cover object-top" @error="p.thumbMissing = true">
                          <div x-show="!p.thumb || p.thumbMissing"
                               class="w-full h-full flex items-center justify-center text-base-content/30 text-xs gap-1">
                            <i class="ph ph-file-html text-2xl"></i>
                          </div>
                        </a>
                        <template x-if="p.view==='live'">
                          <iframe :src="p.renderUrl" loading="lazy"
                                  sandbox="allow-scripts allow-same-origin allow-popups"
                                  class="w-full h-full bg-base-100"></iframe>
                        </template>
                        <div class="join absolute top-1 right-1 shadow">
                          <button class="btn btn-xs join-item" :class="p.view==='shot' && 'btn-primary btn-active'"
                                  @click="p.view='shot'" title="Thumbnail"><i class="ph ph-image"></i></button>
                          <button class="btn btn-xs join-item" :class="p.view==='live' && 'btn-primary btn-active'"
                                  @click="p.view='live'" title="Live preview"><i class="ph ph-play"></i></button>
                        </div>
                      </div>
                      <div class="card-body p-2.5 gap-0.5">
                        <div class="flex items-baseline justify-between gap-2">
                          <a :href="p.renderUrl" target="_blank"
                             class="font-semibold text-sm hover:text-primary transition-colors truncate" x-text="p.name"></a>
                          <div class="flex items-center gap-1.5 shrink-0">
                            <button @click="openInViewer(p.path)" title="Open source in the viewer below"
                                    class="text-base-content/30 hover:text-base-content/60 cursor-pointer">
                              <i class="ph ph-arrow-square-down"></i>
                            </button>
                            <a :href="p.codeUrl" target="_blank" title="Source on GitHub"
                               class="text-base-content/30 hover:text-base-content/60">
                              <i class="ph ph-code"></i>
                            </a>
                          </div>
                        </div>
                        <p class="text-xs text-base-content/50 truncate" x-text="p.title || p.path"></p>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </template>

            <div x-show="truncated" class="text-xs text-base-content/40 px-1">
              Tree listing was truncated by the API; some pages may be missing.
            </div>
          </div>
        </div>`,

      open: false,
      loading: false,
      loaded: false,
      error: '',
      truncated: false,
      items: [],

      init() {
        this.$root.__pages = this;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
        // New repo or ref invalidates the scan; refresh in place if open.
        this.$watch(
          () => Alpine.store('browser').repo + '@' + Alpine.store('browser').ref,
          () => { this.loaded = false; this.items = []; if (this.open) this.scan(); }
        );
      },

      get gh() { return Alpine.store('browser').gh; },
      get repo() { return Alpine.store('browser').repo; },
      get ref() { return Alpine.store('browser').ref || 'main'; },
      get unpublished() {
        const r = Alpine.store('browser').repoObj;
        return !!(r && r.has_pages === false);
      },
      get groups() {
        const map = new Map();
        for (const p of this.items) {
          const dir = p.path.includes('/') ? p.path.slice(0, p.path.lastIndexOf('/')) : '';
          if (!map.has(dir)) map.set(dir, []);
          map.get(dir).push(p);
        }
        return [...map.keys()]
          .sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
          .map(dir => ({ dir, items: map.get(dir) }));
      },

      toggle() {
        this.open = !this.open;
        if (this.open && !this.loaded && this.repo) this.scan();
      },

      // The rendered URL. On the default ref it's the GitHub Pages address.
      // Off the default ref, github.io still serves the default branch's
      // HTML, so for allowlisted repos route through toss-render's address
      // mode, which fetches the file at the ref and renders it (toss-render
      // enforces its own owner allowlist). Other owners fall back to
      // ?use=<ref>, which at least swaps the lib code on pages honoring it.
      renderUrl(path) {
        const [owner, name] = this.repo.split('/');
        const base = 'https://' + owner + '.github.io/' + name + '/' + path;
        const defaultRef = Alpine.store('browser').defaultRef;
        if (!defaultRef || this.ref === defaultRef) return base;
        if (owner === 'mehrlander') {
          return 'https://mehrlander.github.io/web-tools/pages/toss-render.html#gh=' +
            this.repo + '@' + this.ref + ':' + path;
        }
        return base + '?use=' + encodeURIComponent(this.ref);
      },

      // web-tools convention: a screenshot per page under pages/thumbs/,
      // mirroring the path. Only attempted for files under pages/; a 404
      // just falls back to the placeholder via the img error handler.
      thumbUrl(path) {
        if (!path.startsWith('pages/') || path.startsWith('pages/thumbs/')) return '';
        const rel = path.slice('pages/'.length).replace(/\.html$/, '.png');
        return 'https://cdn.jsdelivr.net/gh/' + this.repo + '@' + this.ref + '/pages/thumbs/' + rel;
      },

      async scan() {
        if (!this.gh || !this.repo) return;
        this.loading = true;
        this.error = '';
        try {
          const tree = await this.gh.req('git/trees/' + encodeURIComponent(this.ref) + '?recursive=1');
          this.truncated = !!tree.truncated;
          this.items = (tree.tree || [])
            .filter(n => n.type === 'blob' && n.path.endsWith('.html'))
            .map(n => ({
              path: n.path,
              name: n.path.split('/').pop().replace(/\.html$/, ''),
              title: '',
              renderUrl: this.renderUrl(n.path),
              codeUrl: 'https://github.com/' + this.repo + '/blob/' + this.ref + '/' + n.path,
              thumb: this.thumbUrl(n.path),
              thumbMissing: false,
              view: 'shot',
            }));
          this.loaded = true;
        } catch (e) {
          this.error = 'Could not list pages: ' + ((e && e.message) || String(e));
        }
        this.loading = false;
      },

      async openInViewer(path) {
        const navEl = document.getElementById('navigator');
        if (navEl && navEl.__navigator) {
          const folder = path.split('/').slice(0, -1).join('/');
          if (folder) await navEl.__navigator.load(folder, true);
          await navEl.__navigator.sel(path);
        }
      }
    };
  });
});
