document.addEventListener('alpine:init', function() {
  Alpine.data('repo', function(opts) {
    opts = opts || {};
    const inline = !!opts.inline;
    const refDropdown = `
              <div class="dropdown-content z-10 p-3 shadow-lg bg-base-200 rounded-box w-80 mt-1 border border-base-300">
                <div class="text-xs font-bold mb-1.5 opacity-70">Switch ref (branch / tag / SHA)</div>
                <div class="flex gap-1.5 mb-2">
                  <input type="text" x-model="refInput" placeholder="branch-name or sha or full URL"
                    class="input input-xs input-bordered flex-1 font-mono text-xs"
                    @keyup.enter="applyRefInput(); $el.closest('details').open = false">
                  <button @click="applyRefInput(); $el.closest('details').open = false" :disabled="!refInput.trim()" class="btn btn-xs btn-primary">Go</button>
                </div>
                <div x-show="defaultRef && ref !== defaultRef" class="mb-2">
                  <button @click="setRef(defaultRef); $el.closest('details').open = false" class="btn btn-xs btn-ghost gap-1 w-full">
                    <i class="ph ph-arrow-counter-clockwise"></i>
                    Back to <span class="font-mono" x-text="defaultRef"></span>
                  </button>
                </div>
                <div class="text-xs font-bold mb-1 opacity-70">Branches</div>
                <div x-show="$store.browser.branchesLoading" class="flex justify-center py-2">
                  <span class="loading loading-dots loading-xs opacity-50"></span>
                </div>
                <div x-show="!$store.browser.branchesLoading" class="max-h-48 overflow-y-auto">
                  <template x-for="b in $store.browser.branches" :key="b.name">
                    <a @click="setRef(b.name); $el.closest('details').open = false" class="flex items-center gap-1 p-1 hover:bg-base-300 rounded cursor-pointer text-xs font-mono"
                      :class="b.name === ref ? 'bg-primary/10 text-primary font-bold' : ''">
                      <i class="ph ph-git-branch text-xs opacity-50"></i>
                      <span class="truncate" x-text="b.name"></span>
                    </a>
                  </template>
                  <div x-show="!$store.browser.branchesLoading && !$store.browser.branches.length" class="text-xs opacity-50 py-1">No branches loaded.</div>
                </div>
              </div>`;
    const repoDropdown = `
              <div class="dropdown-content z-10 py-2 shadow-lg bg-base-200 rounded-box w-80 max-h-[32rem] overflow-y-auto mt-1 border border-base-300">
                <div class="text-[10px] font-bold uppercase tracking-wider opacity-40 px-3 mb-1" x-text="owner"></div>
                <template x-for="r in repos" :key="r.name">
                  <a @click="pick(r)" class="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-base-300 transition-colors"
                    :class="r.name === name ? 'bg-primary/8' : ''">
                    <i class="ph text-sm shrink-0 mt-0.5" :class="r.private ? 'ph-lock-simple opacity-40' : 'ph-globe-simple opacity-25'"></i>
                    <div class="min-w-0 flex-1">
                      <div class="font-mono text-sm truncate" :class="r.name === name ? 'text-primary font-semibold' : ''" x-text="r.name"></div>
                      <div class="flex items-center gap-2 mt-0.5 text-[10px] text-base-content/40 leading-tight">
                        <span x-show="r.language" x-text="r.language"></span>
                        <span x-show="r.stargazers_count" class="flex items-center gap-0.5"><i class="ph ph-star text-[9px]"></i><span x-text="r.stargazers_count"></span></span>
                        <span x-show="r.pushed_at" x-text="gh.ago(r.pushed_at)"></span>
                      </div>
                    </div>
                  </a>
                </template>
                <div x-show="!repos.length" class="text-xs opacity-40 px-3 py-2">No repositories loaded.</div>
              </div>`;
    // The repo's .web-tools.json config, edited from a collapsible section at
    // the bottom of this dialog. Field help for the known top-level fields, and
    // an all-empty template seeded for a repo that has none yet (the empty
    // values are inert, so saving the template as-is is harmless).
    const CFG_KNOWN = [
      { k: 'icon',    d: 'Phosphor class for the header quick-link icon (e.g. "ph-scales")' },
      { k: 'landing', d: "path to the repo's own landing page, rendered live" },
      { k: 'pins',    d: 'folders/files surfaced in the sidebar Pinned block' },
      { k: 'stage',   d: '{ files, targets }: durable staged set + copy destinations' },
    ];
    const CFG_TEMPLATE = { icon: '', landing: '', pins: [], stage: { files: [], targets: [] } };
    const configSection = `
            <details class="mt-3 border-t border-base-200 pt-2" @toggle="if($event.target.open) cfgOpen()">
              <summary class="cursor-pointer text-xs font-semibold text-base-content/70 flex items-center gap-1.5 py-1">
                <i class="ph ph-gear-six"></i>Config
                <span class="text-[10px] font-normal ml-0.5"
                      :class="cfgConnected ? 'text-success' : 'text-base-content/40'"
                      x-text="cfgConnected ? '.web-tools.json' : 'none yet'"></span>
              </summary>
              <div class="pt-2 flex flex-col gap-2">
                <div x-show="cfgLegacy" class="alert alert-warning py-1.5 px-3 text-xs flex items-center gap-2">
                  <i class="ph ph-arrow-clockwise shrink-0"></i>
                  <span>Loaded from legacy <span class="font-mono">.show-repo.json</span>. Saving migrates it to <span class="font-mono">.web-tools.json</span>.</span>
                </div>
                <div x-show="cfgOffMain" class="text-[11px] text-warning flex items-center gap-1.5">
                  <i class="ph ph-git-branch shrink-0"></i>
                  <span>Config is written to the default branch, not <span class="font-mono" x-text="$store.browser.ref"></span>.</span>
                </div>
                <textarea x-model="cfgDraft" spellcheck="false" rows="10"
                  class="textarea textarea-bordered w-full font-mono text-xs leading-snug"
                  :class="cfgErr && 'textarea-error'" placeholder="{ }"></textarea>
                <div class="flex items-center justify-between gap-2 min-h-[1.25rem]">
                  <span x-show="cfgErr" class="text-error text-xs flex items-center gap-1 min-w-0">
                    <i class="ph ph-warning shrink-0"></i><span class="truncate" x-text="cfgErr"></span></span>
                  <span x-show="!cfgErr" class="text-success text-xs flex items-center gap-1">
                    <i class="ph ph-check"></i>Valid JSON</span>
                  <button @click="cfgFormat()" :disabled="!!cfgErr" class="btn btn-ghost btn-xs shrink-0">Format</button>
                </div>
                <div class="rounded-lg bg-base-200/50 border border-base-200 p-2.5">
                  <div class="text-[11px] font-semibold text-base-content/60 mb-1.5 flex items-center gap-1.5">
                    <i class="ph ph-info"></i>Fields
                  </div>
                  <div class="flex flex-col gap-1">
                    <template x-for="f in CFG_KNOWN" :key="f.k">
                      <div class="text-[11px] leading-snug">
                        <span class="font-mono text-primary" x-text="f.k"></span>
                        <span class="text-base-content/40"> — </span>
                        <span class="text-base-content/60" x-text="f.d"></span>
                      </div>
                    </template>
                  </div>
                </div>
                <div class="flex items-center justify-end gap-2">
                  <span x-show="!auth" class="text-[11px] text-base-content/50 mr-auto">Sign in above to save.</span>
                  <button @click="cfgSave()" :disabled="!!cfgErr || cfgSaving || !auth"
                          class="btn btn-primary btn-sm text-xs gap-1.5">
                    <span x-show="cfgSaving" class="loading loading-spinner loading-xs"></span>
                    <span x-text="cfgSaving ? 'Saving…' : 'Save config'"></span>
                  </button>
                </div>
              </div>
            </details>`;
    const dialogHtml = `
        <dialog id="repoModal" class="modal" onclick="if(event.target===this)this.close()">
          <div class="modal-box shadow-none border border-base-300 bg-base-100 p-4 max-w-lg">
            <div class="mb-1 px-1 font-mono text-sm font-bold" x-text="repo"></div>
            <div x-show="repoObj?.description" class="px-1 mb-3 text-xs text-base-content/60 italic" x-text="repoObj?.description"></div>
            <div x-show="repoObj" class="flex flex-wrap gap-1.5 mb-3 px-1">
              <span class="badge badge-sm badge-ghost font-mono" x-text="repoObj?.private ? 'private' : 'public'"></span>
              <span class="badge badge-sm badge-ghost font-mono" x-text="(repoObj?.stargazers_count || 0) + ' stars'"></span>
              <span class="badge badge-sm badge-ghost font-mono" x-text="(repoObj?.forks_count || 0) + ' forks'"></span>
              <span class="badge badge-sm badge-ghost font-mono" x-text="repoObj?.default_branch"></span>
              <span class="badge badge-sm badge-ghost font-mono" x-text="repoObj ? 'pushed ' + gh.ago(repoObj.pushed_at) : ''"></span>
            </div>
            <div class="mb-3 px-1">
              <div x-show="auth" class="flex items-center justify-between gap-2 text-xs">
                <div class="flex items-center gap-2">
                  <i class="ph ph-shield-check text-success"></i>
                  <span>Authenticated as <span class="font-mono" x-text="user"></span></span>
                </div>
                <button @click="clearToken()" class="text-[10px] text-base-content/40 hover:text-error underline">clear</button>
              </div>
              <div x-show="!auth" class="flex flex-col gap-1.5">
                <div class="flex items-center gap-2 text-xs">
                  <i class="ph" :class="tokenExpired ? 'ph-warning text-warning' : 'ph-globe text-base-content/40'"></i>
                  <span x-text="tokenExpired ? 'Token expired, enter a new one' : 'Public access only, paste a token for auth'"></span>
                </div>
                <div class="flex items-center gap-1.5">
                  <input type="password" x-model="tokenInput" placeholder="ghp_..." class="input input-xs input-bordered flex-1 font-mono text-xs" @keyup.enter="saveToken()">
                  <button @click="saveToken()" :disabled="!tokenInput" class="btn btn-xs btn-primary">Save</button>
                </div>
                <a href="https://github.com/settings/tokens/new?scopes=repo&description=web-tools"
                   target="_blank" rel="noopener" class="link link-primary text-xs flex items-center gap-1 w-fit">
                  <i class="ph ph-arrow-square-out"></i>Get a token</a>
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <template x-for="url in repoUrls">
                <div class="flex items-center bg-base-200 rounded-lg overflow-hidden">
                  <a :href="url.u" target="_blank" class="flex-1 flex items-center gap-2.5 px-3 py-2 min-w-0 hover:bg-base-300">
                    <i class="ph shrink-0 text-sm" :class="url.i"></i>
                    <div class="flex flex-col min-w-0">
                      <span class="text-xs font-semibold leading-tight" x-text="url.l"></span>
                      <span class="text-[10px] font-mono opacity-50 truncate leading-tight mt-0.5" x-text="url.u.replace('https://','')"></span>
                    </div>
                  </a>
                  <button class="px-3 py-2 border-l border-base-300 hover:bg-base-300" @click="$clip(url.u)">
                    <i class="ph ph-copy text-sm opacity-40"></i>
                  </button>
                </div>
              </template>
            </div>
            ${configSection}
            <div class="modal-action mt-3"><button onclick="repoModal.close()" class="btn btn-ghost btn-sm text-xs">Done</button></div>
          </div>
        </dialog>`;
    return {
      description: 'Repo picker with branch/tag/SHA switching for the GitHub browser store',

      template: (inline ? `
        <div class="flex items-center gap-1.5 font-mono text-sm">
          <span class="text-base-content/60" x-text="owner||'Select'"></span>
          <span class="text-base-content/30">/</span>
          <details class="dropdown dropdown-bottom" data-auto-close>
            <summary class="font-semibold hover:text-primary cursor-pointer flex items-center gap-0.5">
              <span x-text="name||'Repository...'"></span>
              <i class="ph ph-caret-down text-[10px] opacity-40" style="text-decoration:none"></i>
            </summary>
            ${repoDropdown}
          </details>
          <span class="text-base-content/30" x-show="repo">@</span>
          <details class="dropdown dropdown-bottom" x-show="repo" @toggle="if($event.target.open) $store.browser.ensureBranches()">
            <summary class="cursor-pointer flex items-center gap-0.5"
              :class="offMain ? 'text-warning' : 'text-base-content/50'">
              <i class="ph text-xs" :class="offMain ? 'ph-git-branch' : 'ph-git-commit'" style="text-decoration:none"></i>
              <span x-text="ref||'main'"></span>
              <i class="ph ph-caret-down text-[10px] opacity-40" style="text-decoration:none"></i>
            </summary>
            ${refDropdown}
          </details>
        </div>`
      : `
        <div class="mb-4 border-b border-base-200 pb-3">
          <div class="flex items-center justify-between">
            <div class="flex items-baseline gap-2 text-xl font-bold font-mono flex-wrap">
              <span class="text-base-content/70" x-text="owner||'Select'"></span>
              <span class="text-base-content/30">/</span>
              <details class="dropdown dropdown-bottom" data-auto-close>
                <summary class="hover:text-primary cursor-pointer flex items-center gap-1">
                  <span x-text="name||'Repository...'"></span>
                  <i class="ph ph-caret-down text-xs opacity-50" style="text-decoration:none"></i>
                </summary>
                ${repoDropdown}
              </details>
              <span class="text-base-content/30 text-sm" x-show="repo">@</span>
              <details class="dropdown dropdown-bottom" x-show="repo" @toggle="if($event.target.open) $store.browser.ensureBranches()">
                <summary class="cursor-pointer flex items-center gap-1 text-sm"
                  :class="offMain ? 'text-warning' : 'text-base-content/70'">
                  <i class="ph" :class="offMain ? 'ph-git-branch' : 'ph-git-commit'" style="text-decoration:none"></i>
                  <span x-text="ref||'main'"></span>
                  <i class="ph ph-caret-down text-xs opacity-50" style="text-decoration:none"></i>
                </summary>
                ${refDropdown}
              </details>
            </div>
            <button @click="repoModal.showModal()" class="tooltip tooltip-left flex items-center gap-1 btn btn-ghost btn-sm" :data-tip="auth?'Authenticated: '+user:(tokenExpired?'Token expired':'Public only')">
              <i class="ph text-xl" :class="auth?'ph-shield-check text-success':(tokenExpired?'ph-warning text-warning':'ph-globe text-base-content/50')"></i>
              <span x-show="auth" class="text-xs text-base-content/50 hidden sm:inline" x-text="user"></span>
            </button>
          </div>
          <div x-show="offMain" class="mt-2 alert alert-warning py-1.5 px-3 text-xs flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="ph ph-warning"></i>
              <span>On <span class="font-mono font-bold" x-text="ref"></span>, not <span class="font-mono" x-text="defaultRef"></span>.</span>
            </div>
            <button @click="openCompare()" class="btn btn-xs btn-ghost gap-1">
              <i class="ph ph-git-pull-request"></i>
              Compare to <span class="font-mono" x-text="defaultRef"></span>
            </button>
          </div>
        </div>`) + dialogHtml,

      repos: [],
      owner: '',
      name: '',
      repo: '',
      repoObj: null,
      auth: false,
      user: '',
      tokenInput: '',
      tokenExpired: false,
      ref: '',
      defaultRef: '',
      refInput: '',
      CFG_KNOWN,
      cfgDraft: '{}',
      cfgSaving: false,

      init() {
        this.$root.__repo = this;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
      },

      get gh() {
        return Alpine.store('browser').gh;
      },

      // ── Config editing: the repo's .web-tools.json, folded into this dialog.
      // State comes from the browser store, which the show-repo shell populates
      // (config, configName) and refreshes on the web-tools:config-saved event
      // this dispatches. Reads are safe anywhere; a save needs a token.
      get cfgConnected() { return !!Alpine.store('browser').config; },
      get cfgLegacy() { return Alpine.store('browser').configName === '.show-repo.json'; },
      get cfgOffMain() {
        const s = Alpine.store('browser');
        return !!(s.ref && s.defaultRef && s.ref !== s.defaultRef);
      },
      get cfgErr() {
        let v;
        try { v = JSON.parse(this.cfgDraft); }
        catch (e) { return String(e.message || e).replace(/^JSON\.parse:\s*/, ''); }
        if (v === null || typeof v !== 'object' || Array.isArray(v)) return 'Top-level value must be an object';
        return '';
      },
      // Seed the editor when the section is expanded: the open repo's manifest,
      // or the empty template when it has none.
      cfgOpen() {
        const s = Alpine.store('browser');
        this.cfgDraft = JSON.stringify(s.config || CFG_TEMPLATE, null, 2);
      },
      cfgFormat() {
        if (!this.cfgErr) this.cfgDraft = JSON.stringify(JSON.parse(this.cfgDraft), null, 2);
      },
      async cfgSave() {
        if (this.cfgErr || !this.auth) return;
        const toast = Alpine.store('toast');
        const legacy = this.cfgLegacy;
        this.cfgSaving = true;
        try {
          // save() lives in gh-store.js, which not every host page loads; pull
          // it on demand so this works wherever the repo dialog appears.
          if (typeof this.gh.save !== 'function' && window.gh?.load) await window.gh.load('gh-store.js');
          const obj = JSON.parse(this.cfgDraft);
          await this.gh.save('.web-tools.json', obj, legacy
            ? 'Migrate .show-repo.json to .web-tools.json via show-repo'
            : 'Update .web-tools.json via show-repo');
          if (toast) toast('check-circle', legacy ? 'Migrated to .web-tools.json' : 'Config saved', 'alert-success', 4000);
          // The shell re-reads the manifest and re-probes the pinned row so a
          // changed icon or a fresh connection lands without a reload.
          document.dispatchEvent(new CustomEvent('web-tools:config-saved', { detail: { repo: this.repo } }));
        } catch (e) {
          if (toast) toast('warning', 'Save failed: ' + (e?.message || e), 'alert-error', 6000);
        } finally {
          this.cfgSaving = false;
        }
      },
      get offMain() {
        return !!(this.ref && this.defaultRef && this.ref !== this.defaultRef);
      },
      get repoUrls() {
        const r = this.repo;
        const ref = Alpine.store('browser').ref || 'main';
        return [
          { l: 'GitHub', i: 'ph-github-logo', u: 'https://github.com/' + r + '/tree/' + ref },
          { l: 'jsDelivr CDN', i: 'ph-cloud-arrow-down', u: 'https://cdn.jsdelivr.net/gh/' + r + '@' + ref + '/' },
          { l: 'Flat tree JSON', i: 'ph-tree-structure', u: 'https://data.jsdelivr.com/v1/packages/gh/' + r + '@' + ref + '?structure=flat' }
        ];
      },

      // quiet: identity + repo-list failures stay non-fatal (no modal, no
      // gh-auth prompt takeover), for pages that already picked a repo
      // directly (pickByName) and only want the dropdown populated.
      async setup(gh, opts = {}) {
        const quiet = !!opts.quiet;
        const hasToken = !!gh.headers.Authorization;
        if (hasToken) {
          try {
            this.user = (await gh.req('/user', { quiet })).login;
            this.auth = true;
            this.tokenExpired = false;
          } catch(e) {
            this.auth = false;
            this.tokenExpired = String(e).includes('401');
            this.user = '';
          }
        } else {
          this.auth = false;
          this.tokenExpired = false;
          this.user = '';
        }
        try {
          this.repos = await gh.repos(undefined, { quiet });
        } catch(e) {
          this.repos = [];
          if (quiet) { console.warn('repo list unavailable:', e?.message || e); return; }
          const toast = Alpine.store('toast');
          if (toast) {
            if (e.status === 401) toast('warning', 'Token rejected — paste a new one', 'alert-error', 6000);
            else if (e.status === 403) toast('warning', 'GitHub rate-limited this IP — add a token', 'alert-error', 6000);
            else toast('warning', 'Could not load repos: ' + (e.message || e), 'alert-error', 6000);
          }
          try { document.getElementById('repoModal').showModal(); } catch {}
          return;
        }
        // Don't clobber a repo the page already picked (e.g. from URL state)
        // while this ran in the background.
        if (!this.repo && this.repos[0]) this.pick(this.repos[0]);
      },

      // Pick a repo by name without listing anyone's repos first: the
      // identity-free boot path. /repos/<name> works unauthenticated for
      // public repos; if even that fails, a minimal stub lets browsing
      // proceed and the file tree becomes the real reachability test.
      async pickByName(fullName, opts = {}) {
        let target = null;
        try {
          target = await this.gh.req('/repos/' + fullName, { quiet: true });
        } catch (e) {
          console.warn('repo metadata unavailable, using stub:', e?.message || e);
        }
        if (!target) {
          const [login, name] = fullName.split('/');
          target = { full_name: fullName, name, owner: { login },
                     default_branch: opts.ref || 'main', private: false };
        }
        await this.pick(target, opts);
        return target;
      },

      async saveToken() {
        const t = this.tokenInput.trim();
        if (!t) return;
        try { localStorage.setItem('ghToken', t); } catch {}
        this.gh.token = t;
        this.tokenInput = '';
        await this.setup(this.gh);
      },

      async clearToken() {
        try { localStorage.removeItem('ghToken'); } catch {}
        this.gh.token = '';
        await this.setup(this.gh);
      },

      async pick(r, opts = {}) {
        this.repo = r.full_name;
        this.owner = r.owner.login;
        this.name = r.name;
        this.repoObj = r;
        this.defaultRef = r.default_branch || 'main';
        this.ref = opts.ref || this.defaultRef;
        const gh = Alpine.store('browser').gh;
        gh.repo = r.full_name;
        gh.ref = this.ref;
        Alpine.store('browser').repo = r.full_name;
        Alpine.store('browser').repoObj = r;
        Alpine.store('browser').activeFile = null;
        Alpine.store('browser').ref = this.ref;
        Alpine.store('browser').defaultRef = this.defaultRef;
        Alpine.store('browser').resetBranches();
        // Reset whichever file browser the page mounts: the sidebar navigator
        // (nav-repo) or the main-area explorer (show-repo). Pages with neither
        // just skip it.
        const navEl = document.getElementById('navigator') || document.getElementById('explorer');
        if (navEl) {
          while (!(navEl.__navigator || navEl.__explorer)) await new Promise(r => setTimeout(r, 50));
          (navEl.__navigator || navEl.__explorer).reset();
        }
      },

      setRef(ref) {
        if (!ref || ref === this.ref) return;
        this.ref = ref;
        const gh = Alpine.store('browser').gh;
        if (gh) gh.ref = ref;
        Alpine.store('browser').ref = ref;
        Alpine.store('toast')('git-branch', 'ref: ' + ref, 'alert-info', 2000);
        const store = Alpine.store('browser');
        if (store.save) {
          store.save({ repo: store.repo, ref, path: store.path || '', file: store.activeFile?.path || '' });
        }
      },

      applyRefInput() {
        const v = this.refInput.trim();
        if (!v) return;
        if (v.startsWith('http')) {
          const gh = Alpine.store('browser').gh;
          const parsed = gh && gh.parseUrl ? gh.parseUrl(v) : null;
          if (parsed && parsed.repo === this.repo) {
            this.setRef(parsed.ref || this.defaultRef);
          } else if (parsed) {
            Alpine.store('toast')('warning',
              'URL points to ' + parsed.repo + ', current repo is ' + this.repo, 'alert-warning', 4000);
          }
        } else {
          this.setRef(v);
        }
        this.refInput = '';
      },

      openCompare() {
        const cmpEl = document.getElementById('compare');
        if (cmpEl && cmpEl.__compare) {
          cmpEl.__compare.openWith(this.defaultRef, this.ref);
        }
      }
    };
  });
});
