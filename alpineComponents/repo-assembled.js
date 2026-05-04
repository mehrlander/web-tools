document.addEventListener('alpine:init', function() {
  Alpine.data('repo', function() {
    return {
      template: `
        <div class="mb-4 border-b border-base-200 pb-3">
          <div class="flex items-center justify-between">
            <div class="flex items-baseline gap-2 text-xl font-bold font-mono flex-wrap">
              <span class="text-base-content/70" x-text="owner||'Select'"></span>
              <span class="text-base-content/30">/</span>
              <details class="dropdown dropdown-bottom">
                <summary class="hover:text-primary hover:underline decoration-2 underline-offset-4 cursor-pointer flex items-center gap-1">
                  <span x-text="name||'Repository...'"></span>
                  <i class="ph ph-caret-down text-xs opacity-50"></i>
                </summary>
                <ul class="dropdown-content z-10 menu p-2 shadow-lg bg-base-200 rounded-box w-64 max-h-96 overflow-y-auto mt-1 border border-base-300">
                  <template x-for="r in repos"><li><a @click="pick(r)" class="font-mono text-xs" x-text="(r.private?'🔒 ':'')+r.name"></a></li></template>
                </ul>
              </details>
              <span class="text-base-content/30 text-sm" x-show="repo">@</span>
              <details class="dropdown dropdown-bottom" x-show="repo" @toggle="if($event.target.open) loadBranches()">
                <summary class="cursor-pointer flex items-center gap-1 text-sm hover:underline decoration-2 underline-offset-4"
                  :class="offMain ? 'text-warning' : 'text-base-content/70'">
                  <i class="ph" :class="offMain ? 'ph-git-branch' : 'ph-git-commit'"></i>
                  <span x-text="ref||'main'"></span>
                  <i class="ph ph-caret-down text-xs opacity-50"></i>
                </summary>
                <div class="dropdown-content z-10 p-3 shadow-lg bg-base-200 rounded-box w-80 mt-1 border border-base-300">
                  <div class="text-xs font-bold mb-1.5 opacity-70">Switch ref (branch / tag / SHA)</div>
                  <div class="flex gap-1.5 mb-2">
                    <input type="text" x-model="refInput" placeholder="branch-name or sha or full URL"
                      class="input input-xs input-bordered flex-1 font-mono text-xs"
                      @keyup.enter="applyRefInput()">
                    <button @click="applyRefInput()" :disabled="!refInput.trim()" class="btn btn-xs btn-primary">Go</button>
                  </div>
                  <div x-show="defaultRef && ref !== defaultRef" class="mb-2">
                    <button @click="setRef(defaultRef)" class="btn btn-xs btn-ghost gap-1 w-full">
                      <i class="ph ph-arrow-counter-clockwise"></i>
                      Back to <span class="font-mono" x-text="defaultRef"></span>
                    </button>
                  </div>
                  <div class="text-xs font-bold mb-1 opacity-70">Branches</div>
                  <div x-show="branchesLoading" class="flex justify-center py-2">
                    <span class="loading loading-dots loading-xs opacity-50"></span>
                  </div>
                  <div x-show="!branchesLoading" class="max-h-48 overflow-y-auto">
                    <template x-for="b in branchList" :key="b.name">
                      <a @click="setRef(b.name)" class="flex items-center gap-1 p-1 hover:bg-base-300 rounded cursor-pointer text-xs font-mono"
                        :class="b.name === ref ? 'bg-primary/10 text-primary font-bold' : ''">
                        <i class="ph ph-git-branch text-xs opacity-50"></i>
                        <span class="truncate" x-text="b.name"></span>
                      </a>
                    </template>
                    <div x-show="!branchesLoading && !branchList.length" class="text-xs opacity-50 py-1">No branches loaded.</div>
                  </div>
                </div>
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
        </div>

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
            <div class="modal-action mt-3"><button onclick="repoModal.close()" class="btn btn-ghost btn-sm text-xs">Done</button></div>
          </div>
        </dialog>`,

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
      branchList: [],
      branchesLoading: false,
      branchesLoaded: false,

      init() {
        this.$root.__repo = this;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
      },

      get gh() {
        return Alpine.store('browser').gh;
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

      async setup(gh) {
        const hasToken = !!gh.headers.Authorization;
        if (hasToken) {
          try {
            this.user = (await gh.req('/user')).login;
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
          this.repos = await gh.repos();
        } catch(e) {
          this.repos = [];
          const toast = Alpine.store('toast');
          if (toast) {
            if (e.status === 401) toast('warning', 'Token rejected — paste a new one', 'alert-error', 6000);
            else if (e.status === 403) toast('warning', 'GitHub rate-limited this IP — add a token', 'alert-error', 6000);
            else toast('warning', 'Could not load repos: ' + (e.message || e), 'alert-error', 6000);
          }
          try { document.getElementById('repoModal').showModal(); } catch {}
          return;
        }
        if (this.repos[0]) this.pick(this.repos[0]);
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
        this.branchList = [];
        this.branchesLoaded = false;
        const gh = Alpine.store('browser').gh;
        gh.repo = r.full_name;
        gh.ref = this.ref;
        Alpine.store('browser').repo = r.full_name;
        Alpine.store('browser').repoObj = r;
        Alpine.store('browser').activeFile = null;
        Alpine.store('browser').ref = this.ref;
        Alpine.store('browser').defaultRef = this.defaultRef;
        const navEl = document.getElementById('navigator');
        while(!navEl.__navigator) await new Promise(r => setTimeout(r, 50));
        navEl.__navigator.reset();
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

      async loadBranches() {
        if (this.branchesLoaded || this.branchesLoading) return;
        this.branchesLoading = true;
        try {
          const list = await this.gh.branches();
          this.branchList = list.map(b => ({ name: b.name, sha: b.commit?.sha }));
          this.branchesLoaded = true;
        } catch (e) {
          Alpine.store('toast')('warning', 'Could not load branches: ' + (e.message || e), 'alert-error', 4000);
        }
        this.branchesLoading = false;
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
