document.addEventListener('alpine:init', function() {
  Alpine.data('portable', function() {
    // The Portable view: the estate-level treatment of the coordination layer
    // itself, in two halves.
    //   The set   — the portable docs, skills, and scripts (the to-go bag),
    //               read from the hub's committed manifest (docs/portable.json,
    //               prose parent docs/PORTABLE.md) and opened in the shell's
    //               own viewer, so the documentation is a first-class object
    //               here rather than a file you happen to browse to.
    //   Adoption  — the spread: every ecosystem repo (the registry's repos
    //               manifest, plus the hub and the registry themselves) probed
    //               live for the environmental hooks that carry the set (the
    //               marketplace subscription and plugins in
    //               .claude/settings.json, a conventions-wired CLAUDE.md, a
    //               .web-tools.json), graded by lib/portable-align.js.
    // The set is public (the hub repo is public); Adoption needs the token
    // (it reads private repos' settings). Probes are live per view open with
    // an in-memory cache and a Refresh; persisting them as a registry crawl
    // cache (state/alignment.json) is a named follow-up, not built.
    const KIND = {
      skill:  { icon: 'ph-lightning',  label: 'In the plugin' },
      doc:    { icon: 'ph-book-open',  label: 'Docs' },
      dir:    { icon: 'ph-folder',     label: 'Docs' },
      script: { icon: 'ph-file-code',  label: 'Scripts' },
    };
    const USE_LABEL = {
      plugin: 'in the plugin', live: 'fetched live', adopt: 'fetch to adopt',
      'on-demand': 'fetch on demand', reference: 'reference',
    };
    const VERDICT = {
      source:    { cls: 'badge-info',    note: 'the source of the set' },
      registry:  { cls: 'badge-info',    note: 'private registry: roster, caches, lists' },
      aligned:   { cls: 'badge-success', note: '' },
      partial:   { cls: 'badge-warning', note: '' },
      optout:    { cls: 'badge-neutral', note: 'deliberately not adopting' },
      unaligned: { cls: 'badge-ghost',   note: '' },
    };

    return {
      description: 'Portable view: the to-go bag read from docs/portable.json (docs, plugin skills, scripts, each openable in the shell viewer), and a live per-repo adoption matrix of the coordination surface (marketplace, plugins, CLAUDE.md wiring, config)',

      template: `
        <div class="max-w-3xl">
          <!-- ── The set ─────────────────────────────────────────────────── -->
          <section class="mb-10">
            <div class="flex items-center gap-2 mb-1">
              <h2 class="text-lg font-semibold">The portable set</h2>
              <a :href="hubUrl('docs/PORTABLE.md')" target="_blank" rel="noopener"
                 class="text-base-content/40 hover:text-primary" title="docs/PORTABLE.md on GitHub">
                <i class="ph ph-github-logo"></i></a>
            </div>
            <p class="text-base text-base-content/60 mb-4">
              What travels from the hub to any repo: the conventions, the plugin skills, the
              reference docs, the scripts. One install brings the bag
              (<code class="text-sm">/plugin install portable@web-tools</code>).
            </p>
            <div x-show="setLoading" class="flex justify-center py-10">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <template x-for="sec in setSections" :key="sec.label">
              <div class="mb-6">
                <h3 class="text-sm font-semibold uppercase tracking-wide text-base-content/40 mb-2" x-text="sec.label"></h3>
                <div class="flex flex-col gap-1">
                  <template x-for="it in sec.items" :key="it.path">
                    <div class="flex items-start gap-2.5 px-2 py-1.5 rounded-lg hover:bg-base-200/60 group">
                      <i class="ph mt-1 text-base-content/40 shrink-0" :class="kindIcon(it)"></i>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                          <button type="button" class="text-base font-medium hover:text-primary text-left"
                                  @click="openItem(it)" x-text="it.title"></button>
                          <code x-show="it.command" class="text-sm text-base-content/50" x-text="it.command"></code>
                          <span class="badge badge-ghost badge-sm" x-text="useLabel(it)"></span>
                        </div>
                        <p class="text-base text-base-content/60" x-text="it.role"></p>
                      </div>
                      <a :href="itemGh(it)" target="_blank" rel="noopener" title="Open on GitHub"
                         class="opacity-0 group-hover:opacity-100 text-base-content/30 hover:text-primary transition-opacity shrink-0 mt-1">
                        <i class="ph ph-github-logo"></i></a>
                    </div>
                  </template>
                </div>
              </div>
            </template>
            <div x-show="setErr" class="text-base text-error font-mono" x-text="setErr"></div>
          </section>

          <!-- ── Adoption ────────────────────────────────────────────────── -->
          <section>
            <div class="flex items-center gap-2 mb-1">
              <h2 class="text-lg font-semibold">Adoption</h2>
              <div class="grow"></div>
              <button x-show="authed" @click="refreshAdoption()" :disabled="adoptLoading"
                      class="flex items-center gap-1.5 text-base text-base-content/60 hover:text-primary px-2 py-1 rounded-lg hover:bg-base-200 transition-colors">
                <i class="ph ph-arrows-clockwise" :class="adoptLoading && 'animate-spin'"></i>
                <span x-text="adoptLoading ? 'Probing…' : 'Refresh'"></span>
              </button>
            </div>
            <p class="text-base text-base-content/60 mb-4">
              How far each repo carries the coordination surface, read live: the plugin-marketplace
              subscription and enabled plugins in <code class="text-sm">.claude/settings.json</code>,
              a conventions-wired <code class="text-sm">CLAUDE.md</code>, and a
              <code class="text-sm">.web-tools.json</code>.
            </p>
            <p x-show="!authed" class="text-base text-base-content/60">
              Set a token (header shield) to probe the repos.
            </p>
            <template x-if="authed">
              <div class="flex flex-col gap-2">
                <div x-show="adoptLoading && !rows.length" class="flex justify-center py-10">
                  <span class="loading loading-dots loading-md opacity-30"></span>
                </div>
                <template x-for="r in rows" :key="r.repo">
                  <div class="px-3 py-2 rounded-lg border border-base-300/60 bg-base-100">
                    <div class="flex items-center gap-2 flex-wrap">
                      <button type="button" class="text-base font-medium hover:text-primary"
                              @click="openRepo(r.repo)" x-text="r.repo"></button>
                      <span class="badge badge-sm" :class="verdictCls(r)" x-text="r.verdict"></span>
                      <span x-show="verdictNote(r)" class="text-sm text-base-content/50" x-text="verdictNote(r)"></span>
                    </div>
                    <div x-show="!r.role && !r.loading" class="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <span class="badge badge-sm" :class="chipCls(r.marketplace)">
                        <i class="ph text-xs" :class="r.marketplace ? 'ph-check' : 'ph-x'"></i>marketplace</span>
                      <template x-for="p in r.plugins" :key="p">
                        <span class="badge badge-sm badge-outline"><i class="ph ph-check text-xs"></i><span x-text="p"></span></span>
                      </template>
                      <span x-show="!r.plugins.length" class="badge badge-sm" :class="chipCls(false)">
                        <i class="ph ph-x text-xs"></i>plugins</span>
                      <span class="badge badge-sm" :class="chipCls(r.conventionsWired)"
                            :title="r.hasClaudeMd && !r.conventionsWired ? 'CLAUDE.md present, conventions not wired in' : ''">
                        <i class="ph text-xs" :class="r.conventionsWired ? 'ph-check' : 'ph-x'"></i>conventions</span>
                      <span class="badge badge-sm" :class="chipCls(r.hasConfig)">
                        <i class="ph text-xs" :class="r.hasConfig ? 'ph-check' : 'ph-x'"></i>config</span>
                      <span x-show="r.hookEvents.length" class="badge badge-sm badge-ghost text-base-content/50"
                            x-text="'hooks: ' + r.hookEvents.join(', ')"></span>
                    </div>
                    <div x-show="r.loading" class="mt-1"><span class="loading loading-dots loading-xs opacity-30"></span></div>
                  </div>
                </template>
                <div x-show="adoptErr" class="text-base text-error font-mono" x-text="adoptErr"></div>
              </div>
            </template>
          </section>
        </div>
      `,

      authed: false,
      manifest: null,
      setLoading: false,
      setErr: '',
      rows: [],
      adoptLoading: false,
      adoptErr: '',
      _probed: false,

      init(){
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
        this.load();
        this.$watch(() => window.__shell && window.__shell._authState, (s) => {
          if (s === 'auth') this.load();
        });
      },

      hub(){ return window.PortableAlign?.HUB || 'mehrlander/web-tools'; },
      registry(){ return window.__shell?.REGISTRY_REPO || 'mehrlander/web-tools-private'; },
      hasToken(){ return !!window.__shell?.hasToken?.(); },
      hubUrl(path){ return 'https://github.com/' + this.hub() + '/blob/main/' + path; },

      load(){
        this.authed = this.hasToken();
        if (!this.manifest) this.loadManifest();
        if (this.authed && !this._probed) this.refreshAdoption();
      },

      // ── The set ──────────────────────────────────────────────────────────
      async loadManifest(){
        this.setLoading = true;
        this.setErr = '';
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.hub(), ref: 'main' });
          this.manifest = JSON.parse((await gh.get('docs/portable.json')).text);
        } catch (e) {
          this.setErr = 'Manifest load failed: ' + (e?.message || e);
        } finally { this.setLoading = false; }
      },
      get setSections(){
        const items = this.manifest?.items || [];
        const secs = [
          { label: 'In the plugin', items: items.filter(i => i.kind === 'skill') },
          { label: 'Docs',          items: items.filter(i => i.kind === 'doc' || i.kind === 'dir') },
          { label: 'Scripts',       items: items.filter(i => i.kind === 'script') },
        ];
        return secs.filter(s => s.items.length);
      },
      kindIcon(it){ return (KIND[it.kind] || KIND.doc).icon; },
      useLabel(it){ return USE_LABEL[it.use] || it.use || ''; },
      itemGh(it){
        return 'https://github.com/' + this.hub() + '/' + (it.kind === 'dir' ? 'tree' : 'blob') + '/main/' + it.path;
      },
      async openItem(it){
        if (!window.__shell) return;
        await window.__shell.ensureBrowser(this.hub(), '');
        if (it.kind === 'dir') await window.__shell.openFolder(it.path);
        else await window.__shell.openFile(it.path);
      },
      async openRepo(repo){ await window.__shell?.openPinned(repo); },

      // ── Adoption ─────────────────────────────────────────────────────────
      // Roster: hub, registry, then the registry manifest's repos in their
      // curated order. Each repo is probed with three parallel reads on its
      // default branch (empty ref falls through on the contents API).
      async roster(){
        const out = [this.hub(), this.registry()];
        try {
          const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: 'main' });
          const cfg = JSON.parse((await reg.get('.web-tools.json')).text);
          for (const r of (cfg.repos || [])) {
            if (r?.repo && !out.includes(r.repo)) out.push(r.repo);
          }
        } catch {}
        return out;
      },
      async probe(repo){
        const gh = new window.GH({ token: window.TOKEN, repo, ref: '' });
        const grab = async (path, parse) => {
          try { const t = (await gh.get(path)).text; return parse ? JSON.parse(t) : t; }
          catch { return null; }
        };
        const [settings, claudeMd, config] = await Promise.all([
          grab('.claude/settings.json', true),
          grab('CLAUDE.md', false),
          grab('.web-tools.json', true),
        ]);
        const role = repo === this.hub() ? 'hub' : repo === this.registry() ? 'registry' : null;
        return window.PortableAlign.assess({ repo, role, settings, claudeMd, config });
      },
      async refreshAdoption(){
        if (!this.hasToken() || !window.PortableAlign) return;
        this.adoptLoading = true;
        this.adoptErr = '';
        this._probed = true;
        try {
          const repos = await this.roster();
          this.rows = repos.map(repo => ({ repo, loading: true, verdict: '…', role: null,
                                           plugins: [], hookEvents: [] }));
          await Promise.all(repos.map(async (repo, i) => {
            try { this.rows[i] = { ...await this.probe(repo), loading: false }; }
            catch (e) { this.rows[i] = { repo, loading: false, verdict: 'error', role: null,
                                         plugins: [], hookEvents: [], err: String(e?.message || e) }; }
          }));
        } catch (e) {
          this.adoptErr = 'Probe failed: ' + (e?.message || e);
        } finally { this.adoptLoading = false; }
      },
      verdictCls(r){ return (VERDICT[r.verdict] || { cls: 'badge-ghost' }).cls; },
      verdictNote(r){ return (VERDICT[r.verdict] || {}).note || ''; },
      chipCls(on){ return on ? 'badge-outline' : 'badge-ghost text-base-content/35'; },
    };
  });
});
