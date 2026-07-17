document.addEventListener('alpine:init', function() {
  Alpine.data('estate', function() {
    // The all-repo estate, a context above any repo with two views of its own,
    // switched from the sidebar (the shell owns the view state):
    //   Repos     — a card per repo from the private registry's `repos` list
    //               (fallback: the quickLinks row), enriched with live GitHub
    //               metadata, laid out as a full-width grid grouped by the
    //               registry group (like the pages index), with optional card
    //               nesting (`estate.nest`: a companion repo shares its parent's
    //               card; tap the visibility glyph to flip faces).
    //   Surfaces  — the registry's curated surfaces/*.surface files, tabbed, each
    //               editable in place through a JSON dialog (the same shape as the
    //               repo config editor). Archive category excluded.
    // One component renders both; `tab` reads the shell view. Public (no token):
    // the public default card only, and no surfaces. See docs/show-repo.md
    // "The estate".
    const KIND_ICONS = {
      github_blob: 'ph-file', github_dir: 'ph-folder', repo: 'ph-git-branch',
      url: 'ph-link', note: 'ph-note', story: 'ph-book-open',
    };
    // Seed for a brand-new surface. Inert until filled, so saving as-is is safe.
    const SURFACE_TEMPLATE = {
      manifest: { name: '', description: '', category: 'showcase' },
      items: [],
    };

    return {
      description: 'All-repo estate: a full-width grouped grid of registry repo cards (Repos view) and the private registry\'s tabbed, editable surfaces (Surfaces view)',

      template: `
        <div>
          <!-- ── Repos view ─────────────────────────────────────────────── -->
          <div x-show="tab==='repos'">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <h1 class="text-2xl font-bold tracking-tight">Repositories</h1>
              <a href="https://github.com/mehrlander?tab=repositories" target="_blank"
                 class="text-base-content/30 hover:text-base-content/70 transition-colors"
                 title="All repositories on GitHub">
                <i class="ph ph-github-logo text-lg leading-none"></i>
              </a>
              <div class="grow"></div>
              <!-- Add-repo trigger, up by the header. The form expands below. -->
              <button x-show="authed && !loading && !addOpen" @click="addOpen=true; loadCandidates()"
                      class="btn btn-sm btn-ghost gap-1.5 text-base-content/60 hover:text-primary border border-dashed border-base-300">
                <i class="ph ph-plus-circle text-base"></i> Add Repo
              </button>
            </div>
            <p class="text-sm text-base-content/60 mb-6">
              <span x-show="authed">The registry's curated estate. A card opens the repo here; the logo opens it on GitHub.</span>
              <span x-show="!authed">Public view. Set a token via the sidebar shield to see the full estate and its surfaces.</span>
            </p>

            <!-- Add a repo to the estate (authed). Writes the registry's repos
                 list in web-tools-private/.web-tools.json via the token. -->
            <div x-show="addOpen" class="card bg-base-100 border border-base-300 shadow-sm max-w-md mb-6">
              <div class="card-body p-4 gap-2">
                <div class="text-sm font-semibold flex items-center gap-1.5">
                  <i class="ph ph-plus-circle text-primary"></i>Add a repository to the estate
                </div>
                <input list="estate-repo-candidates" x-model="addName" placeholder="owner/repo"
                       autocapitalize="off" autocorrect="off" spellcheck="false"
                       @keyup.enter="addRepo()"
                       class="input input-sm input-bordered font-mono text-xs">
                <datalist id="estate-repo-candidates">
                  <template x-for="c in candidates" :key="c"><option :value="c"></option></template>
                </datalist>
                <div class="flex gap-1.5">
                  <!-- group is a combobox: type a new one or pick an existing
                       group (the datalist lists the estate's current groups, so
                       the group names are visible before you commit to one). -->
                  <input list="estate-group-options" x-model="addGroup" placeholder="group (optional)"
                         autocapitalize="off" autocorrect="off" spellcheck="false"
                         class="input input-sm input-bordered text-xs flex-1">
                  <datalist id="estate-group-options">
                    <template x-for="g in groupOptions" :key="g"><option :value="g"></option></template>
                  </datalist>
                  <input x-model="addNote" placeholder="note (optional)"
                         class="input input-sm input-bordered text-xs flex-[2]">
                </div>
                <div class="text-[11px] text-base-content/40">
                  Writes the registry (web-tools-private). Icon and pins live on the repo's own config; edit those with the gear on its card.
                </div>
                <div class="flex items-center justify-end gap-2">
                  <button @click="addOpen=false" class="btn btn-ghost btn-xs">Cancel</button>
                  <button @click="addRepo()" :disabled="!addName.trim() || adding"
                          class="btn btn-primary btn-xs gap-1">
                    <span x-show="adding" class="loading loading-spinner loading-xs"></span>
                    <span x-text="adding ? 'Adding…' : 'Add'"></span>
                  </button>
                </div>
              </div>
            </div>

            <div x-show="loading" class="flex justify-center py-16">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>

            <!-- The grid: a section per group (header + count), each a full-width
                 three-wide grid of cards, like the pages index. Group order
                 follows the registry's estate.rows spec, then first appearance;
                 nested entries render inside their parent, not as their own card. -->
            <template x-for="sec in groupSections" :key="sec.group">
              <section class="mb-8">
                <h2 x-show="sec.group" class="text-xs font-mono uppercase tracking-widest text-base-content/40 mb-3 flex items-center gap-2">
                  <i class="ph ph-folder"></i><span x-text="sec.group"></span>
                  <span class="badge badge-ghost badge-sm" x-text="sec.items.length"></span>
                </h2>
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <!-- One card, possibly two faces: face(e) is the entry being
                       shown — the entry itself, or its nested companion
                       (estate.nest) when the visibility toggle has flipped the
                       card. Every field below reads face(e), so the title, icon,
                       note, gear, github link, pins, and jumps all switch
                       together. -->
                  <template x-for="e in sec.items" :key="e.repo">
                    <div class="card bg-base-100 border border-base-300 shadow-sm hover:border-primary/40 transition-colors w-full">
                      <div class="card-body p-4 gap-1.5">
                        <div class="flex items-center gap-1.5">
                          <i class="ph text-xl text-primary shrink-0" :class="face(e).icon"></i>
                          <button @click="openRepo(face(e).repo)"
                                  class="font-mono text-sm font-semibold truncate hover:text-primary transition-colors cursor-pointer text-left"
                                  x-text="face(e).repo.split('/')[1]"></button>
                          <div class="grow"></div>
                          <!-- Status + actions, one icon size (leading-none) so
                               they sit on one line. Gear edits the shown repo's
                               own .web-tools.json (authed); logo opens it on
                               GitHub. With a nested companion the visibility
                               glyph is a TOGGLE. -->
                          <button x-show="e.child" @click="e.showChild = !e.showChild"
                                  class="text-base-content/40 hover:text-primary transition-colors shrink-0 cursor-pointer"
                                  :title="e.showChild ? 'back to ' + e.repo.split('/')[1] : 'show ' + e.child?.repo.split('/')[1]">
                            <i class="ph text-sm leading-none" :class="face(e).meta?.priv ? 'ph-lock' : 'ph-globe'"></i>
                          </button>
                          <span x-show="!e.child && e.meta" class="shrink-0 text-base-content/40"
                                :title="e.meta?.priv ? 'private' : 'public'">
                            <i class="ph text-sm leading-none"
                               :class="e.meta?.priv ? 'ph-lock' : 'ph-globe'"></i></span>
                          <button x-show="authed" @click="openRepoConfig(face(e))"
                                  class="text-base-content/30 hover:text-primary transition-colors shrink-0"
                                  title="Edit this repo's web-tools config">
                            <i class="ph ph-gear-six text-sm leading-none"></i></button>
                          <a :href="'https://github.com/' + face(e).repo" target="_blank" @click.stop
                             class="text-base-content/30 hover:text-base-content/70 transition-colors shrink-0"
                             title="Open on GitHub"><i class="ph ph-github-logo text-sm leading-none"></i></a>
                        </div>
                        <p class="text-xs text-base-content/70 min-h-8" x-text="face(e).note || face(e).meta?.desc || ''"></p>

                        <!-- Direct-to-goal jumps: the shown repo's own pinned
                             folders / files, then the universal Files and Atlas
                             jumps. -->
                        <div x-show="(face(e).pins && face(e).pins.length) || face(e).meta"
                             class="flex flex-wrap items-center gap-1 mt-0.5">
                          <template x-for="p in (face(e).pins || [])" :key="p">
                            <button @click="openRepoAt(face(e), p)"
                                    class="badge badge-sm badge-ghost gap-1 font-mono cursor-pointer
                                           hover:bg-primary/10 hover:text-primary transition-colors"
                                    :title="p">
                              <i class="ph text-[10px]" :class="pinIsFile(p) ? 'ph-file' : 'ph-folder'"></i>
                              <span x-text="pinLabel(p)"></span>
                            </button>
                          </template>
                          <div class="grow"></div>
                          <button x-show="face(e).hasLanding" @click="openRepo(face(e).repo)"
                                  class="btn btn-ghost btn-xs btn-square opacity-40 hover:opacity-100"
                                  title="Landing"><i class="ph ph-planet"></i></button>
                          <button @click="openRepoView(face(e), 'files')"
                                  class="btn btn-ghost btn-xs btn-square opacity-40 hover:opacity-100"
                                  title="Browse files"><i class="ph ph-folders"></i></button>
                          <button @click="openRepoView(face(e), 'atlas')"
                                  class="btn btn-ghost btn-xs btn-square opacity-40 hover:opacity-100"
                                  title="Atlas"><i class="ph ph-map-trifold"></i></button>
                        </div>

                        <div class="flex items-center gap-2 text-[10px] text-base-content/50">
                          <span x-show="face(e).meta?.ago" class="flex items-center gap-1">
                            <i class="ph ph-clock"></i><span x-text="'pushed ' + (face(e).meta?.ago || '')"></span>
                          </span>
                          <span x-show="face(e).err" class="text-warning flex items-center gap-1">
                            <i class="ph ph-warning"></i>unreachable
                          </span>
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
              </section>
            </template>
          </div>

          <!-- ── Surfaces view ──────────────────────────────────────────── -->
          <div x-show="tab==='surfaces'" class="max-w-3xl">
            <div class="flex items-center gap-2 mb-4 flex-wrap">
              <h1 class="text-2xl font-bold tracking-tight">Surfaces</h1>
              <div class="grow"></div>
              <button x-show="authed" @click="newSurface()"
                      class="btn btn-sm btn-ghost gap-1.5 text-base-content/60 hover:text-primary border border-dashed border-base-300">
                <i class="ph ph-plus-circle text-base"></i> New
              </button>
            </div>

            <p x-show="!authed" class="text-sm text-base-content/60">
              Public view. Surfaces live in the private registry; set a token via the sidebar shield to see and edit them.
            </p>
            <div x-show="authed && surfLoading" class="flex justify-center py-16">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <p x-show="authed && !surfLoading && !surfaces.length" class="text-sm text-base-content/50">
              No surfaces yet. “New” starts one; it is written to <span class="font-mono">web-tools-private/surfaces</span>.
            </p>

            <div x-show="surfaces.length">
              <!-- Tabs across the surfaces (one surface: no tab bar). -->
              <div x-show="surfaces.length > 1" role="tablist"
                   class="tabs tabs-boxed bg-base-200/60 mb-4 w-fit">
                <template x-for="(s, i) in surfaces" :key="s.file">
                  <a role="tab" class="tab gap-1.5" :class="i===surfActive && 'tab-active'"
                     @click="surfActive=i" x-text="s.manifest.name || s.file"></a>
                </template>
              </div>

              <template x-for="(s, i) in surfaces" :key="s.file">
                <div x-show="i===surfActive">
                  <div class="flex items-baseline gap-2 mb-1">
                    <h2 class="text-lg font-semibold" x-text="s.manifest.name || s.file"></h2>
                    <span class="text-[10px] font-mono text-base-content/30" x-text="s.file"></span>
                    <div class="grow"></div>
                    <!-- Gear opens the surface's source in a JSON editor dialog,
                         the same shape as the repo config editor. The surface
                         file is what drives this section, so this is its edit
                         affordance. -->
                    <button x-show="authed" @click="editSurface(s)"
                            class="self-center text-base-content/30 hover:text-primary transition-colors shrink-0"
                            title="Edit this surface file">
                      <i class="ph ph-gear-six text-base leading-none"></i></button>
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
                    <p x-show="!s.items.length" class="text-xs text-base-content/40 italic">No items on this surface yet.</p>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- ── Surface editor dialog: a JSON editor over one surface file,
               mirroring the repo config dialog. New surfaces get an editable
               filename; existing ones show it read-only. Writes the registry. -->
          <dialog x-ref="surfDlg" class="modal" onclick="if(event.target===this)this.close()">
            <div class="modal-box shadow-none border border-base-300 bg-base-100 p-4 max-w-lg overflow-x-hidden">
              <div class="flex items-center gap-1.5 text-sm font-semibold mb-3">
                <i class="ph ph-cards text-primary"></i>
                <span x-text="surfIsNew ? 'New surface' : 'Edit surface'"></span>
              </div>
              <div class="flex items-center gap-1.5 mb-2">
                <span class="text-xs text-base-content/50 font-mono">surfaces/</span>
                <template x-if="surfIsNew">
                  <input x-model="surfName" placeholder="name.surface"
                         autocapitalize="off" autocorrect="off" spellcheck="false"
                         class="input input-xs input-bordered font-mono text-xs flex-1">
                </template>
                <template x-if="!surfIsNew">
                  <span class="font-mono text-xs" x-text="surfName"></span>
                </template>
              </div>
              <textarea x-model="surfDraft" spellcheck="false" rows="14"
                class="textarea textarea-bordered w-full font-mono text-xs leading-snug"
                :class="surfErr && 'textarea-error'" placeholder="{ }"></textarea>
              <div class="flex items-center justify-between gap-2 min-h-[1.25rem] mt-1">
                <span x-show="surfErr" class="text-error text-xs flex items-center gap-1 min-w-0">
                  <i class="ph ph-warning shrink-0"></i><span class="truncate" x-text="surfErr"></span></span>
                <span x-show="!surfErr" class="text-success text-xs flex items-center gap-1">
                  <i class="ph ph-check"></i>Valid JSON</span>
                <button @click="surfFormat()" :disabled="!!surfErr" class="btn btn-ghost btn-xs shrink-0">Format</button>
              </div>
              <div class="flex items-center justify-end gap-2 mt-3">
                <button @click="$refs.surfDlg.close()" class="btn btn-ghost btn-sm text-xs">Cancel</button>
                <button @click="surfSave()" :disabled="!!surfErr || surfSaving || !authed || (surfIsNew && !surfName.trim())"
                        class="btn btn-primary btn-sm text-xs gap-1.5">
                  <span x-show="surfSaving" class="loading loading-spinner loading-xs"></span>
                  <span x-text="surfSaving ? 'Saving…' : 'Save surface'"></span>
                </button>
              </div>
            </div>
          </dialog>
        </div>`,

      loading: true,
      authed: false,
      entries: [],     // [{repo, icon, note, group, meta:{desc,priv,ago,ref}, err, pins, hasLanding, child}]
      estateCfg: null, // the registry's optional `estate` field: { rows, nest }
      surfaces: [],    // [{file, manifest, items, raw}]
      surfLoading: false,
      surfActive: 0,

      // Surface editor dialog state (mirrors the repo config editor).
      surfIsNew: false,
      surfName: '',
      surfDraft: '{}',
      surfSaving: false,

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

      // Which estate view is showing, from the shell (Repos | Surfaces).
      get tab(){ return window.__shell?.view === 'surfaces' ? 'surfaces' : 'repos'; },

      registry(){ return window.__shell?.REGISTRY_REPO || 'mehrlander/web-tools-private'; },
      hasToken(){ return !!window.__shell?.hasToken?.(); },

      async load(){
        this.authed = this.hasToken();
        let list = null;
        this.estateCfg = null;
        if (this.authed){
          try {
            const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: 'main' });
            const cfg = JSON.parse((await reg.get('.web-tools.json')).text);
            const repos = Array.isArray(cfg.repos) ? cfg.repos.filter(e => e && typeof e.repo === 'string') : [];
            if (repos.length) list = repos;
            else if (Array.isArray(cfg.quickLinks)) list = cfg.quickLinks.filter(e => e && typeof e.repo === 'string');
            if (cfg.estate && typeof cfg.estate === 'object') this.estateCfg = cfg.estate;
            this.loadSurfaces(reg);   // independent; don't hold the cards for it
          } catch {}
        } else {
          this.surfaces = [];
        }
        if (!list) list = window.__shell?.quickLinks?.length
          ? window.__shell.quickLinks
          : [{ repo: 'mehrlander/web-tools', icon: 'ph-toolbox' }];
        this.entries = list.map(e => ({
          repo: e.repo, icon: e.icon || 'ph-bookmark-simple',
          note: e.note || '', group: e.group || '',
          meta: null, err: false, pins: [], hasLanding: false,
          child: null, showChild: false,
        }));
        // Nesting: a child repo rides inside its parent's card as a compact
        // strip instead of holding a card of its own. Data-driven from the
        // registry (estate.nest: { child: parent }); the default nests the
        // registry repo under the shell's home repo.
        const nest = this.estateCfg?.nest
          || { [this.registry()]: window.__shell?.DEFAULT_REPO || 'mehrlander/web-tools' };
        for (const [childRepo, parentRepo] of Object.entries(nest)){
          const child = this.entries.find(e => e.repo === childRepo);
          const parent = this.entries.find(e => e.repo === parentRepo);
          if (child && parent && child !== parent && !parent.child){ parent.child = child; child.nested = true; }
        }
        this.loading = false;

        // Per card, in parallel and fault-tolerant: live metadata (one /repos
        // call) and the repo's own .web-tools.json (pins + whether it declares a
        // custom landing). A missing/private config is a quiet no-op.
        const gh = new window.GH({ token: this.authed ? window.TOKEN : '' });
        await Promise.all(this.entries.map(async (en) => {
          let ref = 'main';
          try {
            const r = await gh.req('/repos/' + en.repo);
            ref = r.default_branch || 'main';
            en.meta = {
              desc: r.description || '', priv: !!r.private,
              ago: (r.pushed_at && gh.ago) ? gh.ago(r.pushed_at) : '', ref,
            };
          } catch { en.err = true; }
          const rgh = new window.GH({ token: this.authed ? window.TOKEN : '', repo: en.repo, ref });
          for (const name of ['.web-tools.json', '.show-repo.json']){
            try {
              const cfg = JSON.parse((await rgh.get(name)).text);
              if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)){
                en.pins = Array.isArray(cfg.pins) ? cfg.pins.slice(0, 6) : [];
                en.hasLanding = !!cfg.landing;
                break;
              }
            } catch {}
          }
        }));
      },

      // The entry a card is currently showing: itself, or its nested companion
      // once the visibility toggle flipped it (e.showChild).
      face(e){ return e.showChild && e.child ? e.child : e; },

      // ── Repos grid layout ────────────────────────────────────────────────
      // A section per group. Order: the registry's estate.rows spec (flattened,
      // '*' and unknowns dropped), then any remaining groups by first
      // appearance, so the curator's lead groups stay first. Nested entries
      // render inside their parent, so they are excluded here.
      get groupSections(){
        const visible = this.entries.filter(e => !e.nested);
        const order = [];
        const by = new Map();
        for (const e of visible){
          const g = e.group || '';
          if (!by.has(g)){ by.set(g, []); order.push(g); }
          by.get(g).push(e);
        }
        const spec = Array.isArray(this.estateCfg?.rows)
          ? this.estateCfg.rows.flat().filter(g => g && g !== '*')
          : ['core', 'archives'];
        const ordered = [...new Set([...spec.filter(g => by.has(g)), ...order])];
        return ordered.map(g => ({ group: g, items: by.get(g) })).filter(s => s.items && s.items.length);
      },

      // ── Card jumps: open a repo straight at a goal ─────────────────────────
      pinIsFile(p){ return /\.[^./]+$/.test((p || '').split('/').pop() || ''); },
      pinLabel(p){ const s = (p || '').replace(/\/+$/, ''); return s.split('/').pop() || s; },
      async openRepoAt(en, path){
        if (!window.__shell) return;
        await window.__shell.ensureBrowser(en.repo, en.meta?.ref || '');
        if (this.pinIsFile(path)) await window.__shell.openFile(path);
        else await window.__shell.openFolder(path.replace(/\/+$/, ''));
      },
      async openRepoView(en, view){
        if (!window.__shell) return;
        await window.__shell.ensureBrowser(en.repo, en.meta?.ref || '');
        if (view === 'atlas') window.__shell.goAtlas();
        else if (view === 'files') window.__shell.goFiles();
      },
      // Edit this repo's own .web-tools.json via the existing config editor (the
      // shield dialog's gear tab, bound to the open repo), seeding an empty
      // template when the repo has none. Switches the shell to that repo first.
      async openRepoConfig(en){
        if (!window.__shell) return;
        await window.__shell.ensureBrowser(en.repo, en.meta?.ref || '');
        if (window.__shell.loadConfig) await window.__shell.loadConfig();
        const rc = document.getElementById('repo')?.__repo;
        if (rc){ rc.tab = 'config'; rc.cfgOpen(); }
        document.getElementById('repoModal')?.showModal();
      },

      // ── Add a repo to the estate ───────────────────────────────────────────
      addOpen: false,
      adding: false,
      addName: '',
      addGroup: '',
      addNote: '',
      candidates: [],
      loadCandidates(){
        const rc = document.getElementById('repo')?.__repo;
        const have = new Set(this.entries.map(e => e.repo));
        this.candidates = (rc?.repos || []).map(r => r.full_name).filter(n => !have.has(n)).sort();
      },
      // The estate's current group names, for the Add form's group combobox.
      get groupOptions(){
        return [...new Set(this.entries.map(e => e.group).filter(Boolean))].sort();
      },
      async addRepo(){
        const full = this.addName.trim();
        if (!full || !this.hasToken()) return;
        if (!/^[^/\s]+\/[^/\s]+$/.test(full)){
          Alpine.store('toast')?.('warning', 'Enter owner/repo', 'alert-warning', 4000); return;
        }
        this.adding = true;
        try {
          const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: 'main' });
          let cfg = {};
          try { cfg = JSON.parse((await reg.get('.web-tools.json')).text); } catch {}
          if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) cfg = {};
          if (!Array.isArray(cfg.repos)) cfg.repos = [];
          if (cfg.repos.some(r => r && r.repo === full)){
            Alpine.store('toast')?.('info', full + ' is already on the estate', 'alert-info', 3000);
            this.adding = false; this.addOpen = false; this.addName = ''; return;
          }
          const entry = { repo: full, icon: 'ph-bookmark-simple' };
          if (this.addGroup.trim()) entry.group = this.addGroup.trim();
          if (this.addNote.trim()) entry.note = this.addNote.trim();
          cfg.repos.push(entry);
          if (typeof reg.save !== 'function' && window.gh?.load) await window.gh.load('gh-store.js');
          await reg.save('.web-tools.json', cfg, 'Add ' + full + ' to the estate via show-repo');
          Alpine.store('toast')?.('check-circle', 'Added ' + full, 'alert-success', 3000);
          this.addOpen = false; this.addName = ''; this.addGroup = ''; this.addNote = '';
          document.dispatchEvent(new CustomEvent('web-tools:config-saved', { detail: { repo: this.registry() } }));
          await this.load();
        } catch(e){
          Alpine.store('toast')?.('warning', 'Add failed: ' + (e?.message || e), 'alert-error', 6000);
        } finally { this.adding = false; }
      },

      // ── Surfaces ───────────────────────────────────────────────────────────
      // Every surfaces/*.surface in the registry, archive excluded, standing
      // first. 404 (no dir yet) is a quiet no-op. `raw` keeps the whole parsed
      // file so the editor round-trips fields the view doesn't render.
      async loadSurfaces(reg){
        this.surfLoading = true;
        try {
          const files = (await reg.ls('surfaces')).filter(f => f.type === 'file' && f.name.endsWith('.surface'));
          const loaded = await Promise.all(files.map(async (f) => {
            try {
              const raw = JSON.parse((await reg.get('surfaces/' + f.name)).text);
              return { file: f.name, manifest: raw.manifest || {}, items: Array.isArray(raw.items) ? raw.items : [], raw };
            } catch { return null; }
          }));
          const rank = c => ({ default: 0, standing: 1, showcase: 2 }[c] ?? 2);
          this.surfaces = loaded.filter(Boolean)
            .filter(s => (s.manifest.category || 'showcase') !== 'archive')
            .sort((a, b) => rank(a.manifest.category || 'showcase') - rank(b.manifest.category || 'showcase'));
          if (this.surfActive >= this.surfaces.length) this.surfActive = 0;
        } catch { this.surfaces = []; }
        finally { this.surfLoading = false; }
      },
      async reloadSurfaces(){
        if (!this.hasToken()) return;
        const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: 'main' });
        await this.loadSurfaces(reg);
      },

      // Open the JSON editor over a surface file. `raw` is the source of truth,
      // so an edit round-trips every field, not just the rendered ones.
      editSurface(s){
        if (!s) return;
        this.surfIsNew = false;
        this.surfName = s.file;
        this.surfDraft = JSON.stringify(s.raw || { manifest: s.manifest, items: s.items }, null, 2);
        this.$refs.surfDlg?.showModal();
      },
      newSurface(){
        this.surfIsNew = true;
        this.surfName = '';
        this.surfDraft = JSON.stringify(SURFACE_TEMPLATE, null, 2);
        this.$refs.surfDlg?.showModal();
      },
      get surfErr(){
        let v;
        try { v = JSON.parse(this.surfDraft); }
        catch (e) { return String(e.message || e).replace(/^JSON\.parse:\s*/, ''); }
        if (v === null || typeof v !== 'object' || Array.isArray(v)) return 'Top-level value must be an object';
        return '';
      },
      surfFormat(){
        if (!this.surfErr) this.surfDraft = JSON.stringify(JSON.parse(this.surfDraft), null, 2);
      },
      async surfSave(){
        if (this.surfErr || !this.hasToken()) return;
        let file = this.surfName.trim();
        if (this.surfIsNew){
          if (!file) return;
          if (!file.endsWith('.surface')) file += '.surface';
          if (/[\/\s]/.test(file.replace(/\.surface$/, ''))){
            Alpine.store('toast')?.('warning', 'Surface name can\'t contain slashes or spaces', 'alert-warning', 4000); return;
          }
        }
        const toast = Alpine.store('toast');
        this.surfSaving = true;
        try {
          const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: 'main' });
          if (typeof reg.save !== 'function' && window.gh?.load) await window.gh.load('gh-store.js');
          const obj = JSON.parse(this.surfDraft);
          await reg.save('surfaces/' + file, obj,
            (this.surfIsNew ? 'Add surface ' : 'Edit surface ') + file + ' via show-repo');
          if (toast) toast('check-circle', (this.surfIsNew ? 'Created ' : 'Saved ') + file, 'alert-success', 4000);
          this.$refs.surfDlg?.close();
          await this.reloadSurfaces();
          const idx = this.surfaces.findIndex(s => s.file === file);
          if (idx >= 0) this.surfActive = idx;
        } catch(e){
          if (toast) toast('warning', 'Save failed: ' + (e?.message || e), 'alert-error', 6000);
        } finally { this.surfSaving = false; }
      },

      async openRepo(repo){ await window.__shell?.ensureBrowser(repo); },

      // ── Surface items ──────────────────────────────────────────────────────
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
