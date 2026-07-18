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
                <!-- The estate (global) context, above the owner's repos. Only
                     on a host that has it (show-repo); guarded by hasEstate(). -->
                <template x-if="hasEstate()">
                  <div>
                    <a @click="showEstate(); $el.closest('details').open = false"
                       class="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-base-300 transition-colors"
                       :class="estate ? 'bg-primary/8 text-primary font-semibold' : ''">
                      <i class="ph ph-circles-four text-sm shrink-0"></i>
                      <span class="text-sm">Repositories</span>
                    </a>
                    <div class="border-t border-base-300 my-1"></div>
                  </div>
                </template>
                <div class="text-[10px] font-bold uppercase tracking-wider opacity-40 px-3 mb-1" x-text="owner"></div>
                <template x-for="r in repos" :key="r.name">
                  <a @click="pickFromHeader(r)" class="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-base-300 transition-colors"
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
    // Fields a repo may self-declare, edited on the dialog's Config tab (form or
    // raw JSON). estate/group/note/order/quickLink/nestUnder are the estate
    // placement (the repo owns how it appears on the estate); icon/landing/pins/
    // stage are the rest of its web-tools config. All inert until set, so saving
    // the template as-is is harmless. Seeded for a repo that has no config yet.
    const CFG_TEMPLATE = { icon: '', estate: false, group: '', note: '', order: 0,
                           quickLink: false, nestUnder: '', landing: '', pins: [],
                           stage: { files: [], targets: [] } };
    const CFG_DOCS_URL = 'https://github.com/mehrlander/web-tools/blob/main/docs/show-repo.md#web-toolsjson-the-repo-manifest';
    // One dialog, two tabs (Info & links / Config), targeting dlg.repo — which
    // may differ from the open repo, so it opens for an estate card's repo
    // without navigating there. Fixed box size (w/h), with a scrolling body, so
    // switching tabs never resizes the dialog. Config edits as a Form or as raw
    // JSON (one underlying object, synced on toggle).
    const dialogHtml = `
        <dialog id="repoModal" class="modal" onclick="if(event.target===this)this.close()">
          <div class="modal-box shadow-none border border-base-300 bg-base-100 p-0
                      w-[32rem] max-w-[calc(100vw-2rem)] h-[34rem] max-h-[calc(100vh-4rem)]
                      flex flex-col overflow-hidden">
            <!-- Header: target repo + tab switch (fixed) -->
            <div class="flex items-center justify-between gap-2 p-4 pb-2 shrink-0">
              <div class="min-w-0">
                <div class="font-mono text-sm font-bold truncate" x-text="dlg.repo"></div>
                <div class="text-[10px] text-base-content/40 font-mono leading-tight" x-text="dlg.ref"></div>
              </div>
              <div class="join shrink-0">
                <button @click="tab='info'" class="btn btn-xs btn-square join-item tooltip tooltip-bottom"
                        :class="tab==='info' ? 'btn-primary btn-active' : 'btn-ghost'" data-tip="Info & links">
                  <i class="ph ph-link-simple text-sm"></i></button>
                <button @click="tab='config'" class="btn btn-xs btn-square join-item tooltip tooltip-bottom"
                        :class="tab==='config' ? 'btn-primary btn-active' : 'btn-ghost'" data-tip="Config">
                  <i class="ph ph-gear-six text-sm"></i></button>
              </div>
            </div>

            <!-- Body: scrolls inside the fixed box, so the box size is constant
                 across tabs -->
            <div class="flex-1 overflow-y-auto min-h-0 px-4 pb-2">

              <div x-show="dlg.loading" class="flex justify-center py-16">
                <span class="loading loading-dots loading-md opacity-30"></span>
              </div>

              <!-- INFO tab -->
              <div x-show="!dlg.loading && tab==='info'" class="flex flex-col">
                <div x-show="dlg.repoObj?.description" class="mb-3 text-xs text-base-content/60 italic" x-text="dlg.repoObj?.description"></div>
                <div x-show="dlg.repoObj" class="flex flex-wrap gap-1.5 mb-3">
                  <span class="badge badge-sm badge-ghost font-mono" x-text="dlg.repoObj?.private ? 'private' : 'public'"></span>
                  <span class="badge badge-sm badge-ghost font-mono" x-text="(dlg.repoObj?.stargazers_count || 0) + ' stars'"></span>
                  <span class="badge badge-sm badge-ghost font-mono" x-text="(dlg.repoObj?.forks_count || 0) + ' forks'"></span>
                  <span class="badge badge-sm badge-ghost font-mono" x-text="dlg.repoObj?.default_branch"></span>
                  <span class="badge badge-sm badge-ghost font-mono" x-text="dlg.repoObj ? 'pushed ' + gh.ago(dlg.repoObj.pushed_at) : ''"></span>
                </div>
                <div class="mb-3">
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
                  <template x-for="url in dlgUrls">
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
              </div>

              <!-- CONFIG tab: form or raw JSON, one object underneath -->
              <div x-show="!dlg.loading && tab==='config'" class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-normal"
                        :class="dlgConnected ? 'text-success' : 'text-base-content/40'"
                        x-text="dlgConnected ? '.web-tools.json' : 'no config yet'"></span>
                  <div class="grow"></div>
                  <div class="join">
                    <button @click="dlgSetMode('form')" class="btn btn-xs join-item"
                            :class="dlg.mode==='form' ? 'btn-primary btn-active' : 'btn-ghost'">Form</button>
                    <button @click="dlgSetMode('json')" class="btn btn-xs join-item"
                            :class="dlg.mode==='json' ? 'btn-primary btn-active' : 'btn-ghost'">JSON</button>
                  </div>
                </div>
                <div x-show="dlgLegacy" class="alert alert-warning py-1.5 px-3 text-xs flex items-center gap-2">
                  <i class="ph ph-arrow-clockwise shrink-0"></i>
                  <span>Loaded from legacy <span class="font-mono">.show-repo.json</span>. Saving migrates it to <span class="font-mono">.web-tools.json</span>.</span>
                </div>
                <div class="text-[11px] text-base-content/40 flex items-center gap-1.5">
                  <i class="ph ph-git-branch shrink-0"></i>
                  <span>Saved to <span class="font-mono" x-text="dlg.ref"></span> (the repo's default branch).</span>
                </div>

                <!-- FORM -->
                <div x-show="dlg.mode==='form'" class="flex flex-col gap-2">
                  <label class="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" class="checkbox checkbox-xs" x-model="dlg.obj.estate">
                    <span class="font-semibold">On the estate</span>
                    <span class="text-base-content/40">(appears on the all-repo dashboard)</span>
                  </label>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="flex flex-col gap-1">
                      <span class="text-[11px] font-semibold text-base-content/60 flex items-center gap-1">
                        <i class="ph text-sm" :class="(dlg.obj.icon||'').trim() || 'ph-bookmark-simple'"></i>Icon</span>
                      <input x-model="dlg.obj.icon" placeholder="ph-bookmark-simple"
                             autocapitalize="off" autocorrect="off" spellcheck="false"
                             class="input input-xs input-bordered font-mono text-xs">
                    </div>
                    <div class="flex flex-col gap-1">
                      <span class="text-[11px] font-semibold text-base-content/60">Group</span>
                      <input x-model="dlg.obj.group" placeholder="core, data, …"
                             autocapitalize="off" autocorrect="off" spellcheck="false"
                             class="input input-xs input-bordered text-xs">
                    </div>
                  </div>
                  <div class="flex flex-col gap-1">
                    <span class="text-[11px] font-semibold text-base-content/60">Note</span>
                    <textarea x-model="dlg.obj.note" rows="2" placeholder="one-line description (overrides GitHub's)"
                              class="textarea textarea-bordered text-xs leading-snug"></textarea>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="flex flex-col gap-1">
                      <span class="text-[11px] font-semibold text-base-content/60">Order</span>
                      <input type="number" x-model.number="dlg.obj.order" placeholder="0"
                             class="input input-xs input-bordered text-xs">
                    </div>
                    <label class="flex items-center gap-2 text-xs cursor-pointer self-end pb-1.5">
                      <input type="checkbox" class="checkbox checkbox-xs" x-model="dlg.obj.quickLink">
                      <span class="font-semibold">Quick-link</span>
                    </label>
                  </div>
                  <div class="flex flex-col gap-1">
                    <span class="text-[11px] font-semibold text-base-content/60">Nest under</span>
                    <input x-model="dlg.obj.nestUnder" placeholder="owner/repo (optional)"
                           autocapitalize="off" autocorrect="off" spellcheck="false"
                           class="input input-xs input-bordered font-mono text-xs">
                  </div>
                  <div class="flex flex-col gap-1">
                    <span class="text-[11px] font-semibold text-base-content/60">Landing</span>
                    <input x-model="dlg.obj.landing" placeholder="pages/landing.html (optional)"
                           autocapitalize="off" autocorrect="off" spellcheck="false"
                           class="input input-xs input-bordered font-mono text-xs">
                  </div>
                  <div class="flex flex-col gap-1">
                    <span class="text-[11px] font-semibold text-base-content/60">Pins (one per line)</span>
                    <textarea x-model="pinsText" rows="2" spellcheck="false"
                              placeholder="pages&#10;docs/CONVENTIONS.md"
                              class="textarea textarea-bordered font-mono text-xs leading-snug"></textarea>
                  </div>
                  <div class="text-[11px] text-base-content/40">Stage and any other fields: edit in JSON.</div>
                </div>

                <!-- RAW JSON -->
                <div x-show="dlg.mode==='json'" class="flex flex-col gap-1">
                  <textarea x-model="dlg.draft" spellcheck="false" rows="14"
                    class="textarea textarea-bordered w-full font-mono text-xs leading-snug"
                    :class="dlgErr && 'textarea-error'" placeholder="{ }"></textarea>
                  <div class="flex items-center justify-between gap-2 min-h-[1.25rem]">
                    <span x-show="dlgErr" class="text-error text-xs flex items-center gap-1 min-w-0">
                      <i class="ph ph-warning shrink-0"></i><span class="truncate" x-text="dlgErr"></span></span>
                    <span x-show="!dlgErr" class="text-success text-xs flex items-center gap-1">
                      <i class="ph ph-check"></i>Valid JSON</span>
                    <button @click="dlgFormat()" :disabled="!!dlgErr" class="btn btn-ghost btn-xs shrink-0">Format</button>
                  </div>
                </div>

                <a href="${CFG_DOCS_URL}" target="_blank" rel="noopener"
                   class="link link-primary text-xs flex items-center gap-1 w-fit">
                  <i class="ph ph-book-open"></i>Config format &amp; fields</a>
              </div>
            </div>

            <!-- Footer (fixed) -->
            <div class="flex items-center gap-2 p-4 pt-2 border-t border-base-300 shrink-0">
              <button x-show="tab==='config' && !auth" @click="tab='info'" class="text-[11px] text-primary underline mr-auto">Sign in to save</button>
              <div class="grow"></div>
              <button onclick="repoModal.close()" class="btn btn-ghost btn-sm text-xs">Done</button>
              <button x-show="tab==='config'" @click="dlgSave()" :disabled="!!dlgErr || dlg.saving || !auth"
                      class="btn btn-primary btn-sm text-xs gap-1.5">
                <span x-show="dlg.saving" class="loading loading-spinner loading-xs"></span>
                <span x-text="dlg.saving ? 'Saving…' : 'Save'"></span>
              </button>
            </div>
          </div>
        </dialog>`;
    return {
      description: 'Repo picker with branch/tag/SHA switching for the GitHub browser store',

      template: (inline ? `
        <div class="flex items-center gap-1.5 font-mono text-sm">
          <span class="text-base-content/60" x-text="owner||'mehrlander'"></span>
          <span class="text-base-content/30">/</span>
          <details class="dropdown dropdown-bottom" data-auto-close>
            <summary class="font-semibold hover:text-primary cursor-pointer flex items-center gap-0.5"
              :class="estate && 'text-primary'">
              <span x-text="estate ? 'Repositories' : (name||'Repository...')"></span>
              <i class="ph ph-caret-down text-[10px] opacity-40" style="text-decoration:none"></i>
            </summary>
            ${repoDropdown}
          </details>
          <span class="text-base-content/30" x-show="repo && !estate">@</span>
          <details class="dropdown dropdown-bottom" x-show="repo && !estate" @toggle="if($event.target.open) $store.browser.ensureBranches()">
            <summary class="cursor-pointer flex items-center gap-0.5"
              :class="offMain ? 'text-warning' : 'text-base-content/50'">
              <i class="ph text-xs" :class="offMain ? 'ph-git-branch' : 'ph-git-commit'" style="text-decoration:none"></i>
              <span x-text="ref||'main'"></span>
              <i class="ph ph-caret-down text-[10px] opacity-40" style="text-decoration:none"></i>
            </summary>
            ${refDropdown}
          </details>
          <!-- GitHub jump beside the repo address (the pattern). -->
          <a x-show="repo && !estate" :href="'https://github.com/'+repo+(offMain ? '/tree/'+ref : '')"
             target="_blank" class="text-base-content/30 hover:text-base-content/60 transition-colors ml-0.5 shrink-0"
             title="Open on GitHub"><i class="ph ph-github-logo text-xs leading-none"></i></a>
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
            <button @click="openDialog()" class="tooltip tooltip-left flex items-center gap-1 btn btn-ghost btn-sm" :data-tip="auth?'Authenticated: '+user:(tokenExpired?'Token expired':'Public only')">
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
      tab: 'info',
      // The dialog targets dlg.repo, which may differ from the open repo (opened
      // from an estate card) so it never navigates. It loads that repo's meta and
      // config into its own state; `obj` is the form's object, `draft` the raw
      // JSON, synced on toggle.
      dlg: { repo: '', ref: 'main', repoObj: null, config: null, configName: null,
             gh: null, mode: 'form', obj: {}, draft: '{}', loading: false, saving: false },

      init() {
        this.$root.__repo = this;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
      },

      get gh() {
        return Alpine.store('browser').gh;
      },

      // ── The estate (all-repo) context, on a host that provides it (show-repo).
      // The header selector doubles as the context switcher: "Repositories" is
      // the estate, the owner's repos below it are the per-repo contexts. In the
      // estate the name reads "Repositories" and the branch selector is hidden,
      // since a branch is a repo-level notion. Other hosts have no shell, so
      // hasEstate() is false and the entry does not render.
      // The estate context is either of its two views (repo grid or surfaces);
      // both read "Repositories" in the header and hide the branch selector.
      get estate() { return !!window.__shell?.isEstate; },
      hasEstate() { return typeof window.__shell?.goEstate === 'function'; },
      showEstate() { window.__shell?.goEstate?.(); },
      // Pick from the header selector: switch the repo, and leave the estate for
      // the repo's landing (the repo-change watch handles a different repo; this
      // covers re-picking the repo already open underneath the estate).
      pickFromHeader(r) {
        this.pick(r);
        if (window.__shell?.isEstate) window.__shell.goLanding();
      },

      // ── The dialog: repo info & links + the .web-tools.json config editor, for
      // dlg.repo (which may be any repo, not just the open one, so opening it
      // from an estate card does NOT navigate). openDialog loads that repo's
      // metadata and config into dlg; the config tab edits as a form or raw JSON.
      async openDialog(repo, opts = {}) {
        const target = repo || this.repo;
        if (!target) return;
        this.tab = opts.tab || 'info';
        this.dlg.repo = target;
        this.dlg.mode = 'form';
        this.dlg.loading = true;
        try { document.getElementById('repoModal')?.showModal(); } catch {}
        // Metadata: reuse the open repo's, else one direct read.
        if (target === this.repo && this.repoObj) {
          this.dlg.repoObj = this.repoObj;
          this.dlg.ref = this.defaultRef || this.repoObj.default_branch || 'main';
        } else {
          this.dlg.repoObj = null; this.dlg.ref = 'main';
          try {
            const r = await this.gh.req('/repos/' + target, { quiet: true });
            this.dlg.repoObj = r; this.dlg.ref = r.default_branch || 'main';
          } catch {}
        }
        await this.dlgLoadConfig(target, this.dlg.ref);
        this.dlg.loading = false;
      },
      async dlgLoadConfig(repo, ref) {
        const g = new window.GH({ token: this.gh?.token || '', repo, ref });
        this.dlg.gh = g;
        let cfg = null, name = null;
        for (const n of ['.web-tools.json', '.show-repo.json']) {
          try {
            const p = JSON.parse((await g.get(n)).text);
            if (p && typeof p === 'object' && !Array.isArray(p)) { cfg = p; name = n; break; }
          } catch {}
        }
        this.dlg.config = cfg; this.dlg.configName = name;
        this.dlg.obj = JSON.parse(JSON.stringify(cfg || CFG_TEMPLATE));
        this.dlg.draft = JSON.stringify(this.dlg.obj, null, 2);
      },
      get dlgConnected() { return !!this.dlg.config; },
      get dlgLegacy() { return this.dlg.configName === '.show-repo.json'; },
      // In form mode the object is always valid; only raw JSON can be malformed.
      get dlgErr() {
        if (this.dlg.mode !== 'json') return '';
        let v;
        try { v = JSON.parse(this.dlg.draft); }
        catch (e) { return String(e.message || e).replace(/^JSON\.parse:\s*/, ''); }
        if (v === null || typeof v !== 'object' || Array.isArray(v)) return 'Top-level value must be an object';
        return '';
      },
      dlgSetMode(m) {
        if (m === this.dlg.mode) return;
        if (m === 'json') this.dlg.draft = JSON.stringify(this.dlgClean(this.dlg.obj), null, 2);
        else {
          try { const v = JSON.parse(this.dlg.draft); if (v && typeof v === 'object' && !Array.isArray(v)) this.dlg.obj = v; } catch {}
        }
        this.dlg.mode = m;
      },
      dlgFormat() { if (!this.dlgErr) this.dlg.draft = JSON.stringify(JSON.parse(this.dlg.draft), null, 2); },
      // Pins as a newline list, so the form covers the common case; stage and any
      // other structured field are edited in JSON.
      get pinsText() { return (this.dlg.obj.pins || []).join('\n'); },
      set pinsText(v) {
        const arr = v.split('\n').map(s => s.trim()).filter(Boolean);
        if (arr.length) this.dlg.obj.pins = arr; else delete this.dlg.obj.pins;
      },
      // Drop empty/default keys so saved configs stay minimal (absent === off).
      dlgClean(o) {
        const c = JSON.parse(JSON.stringify(o || {}));
        for (const k of ['icon', 'group', 'note', 'nestUnder', 'landing']) {
          if (!c[k] || !String(c[k]).trim()) delete c[k]; else c[k] = String(c[k]).trim();
        }
        if (c.estate !== true) delete c.estate;
        if (c.quickLink !== true) delete c.quickLink;
        if (!c.order) delete c.order; else c.order = Number(c.order);
        if (Array.isArray(c.pins) && !c.pins.length) delete c.pins;
        if (c.stage && typeof c.stage === 'object') {
          const noFiles = !Array.isArray(c.stage.files) || !c.stage.files.length;
          const noTargets = !Array.isArray(c.stage.targets) || !c.stage.targets.length;
          if (noFiles && noTargets) delete c.stage;
        }
        return c;
      },
      async dlgSave() {
        if (this.dlgErr || !this.auth) return;
        const toast = Alpine.store('toast');
        const legacy = this.dlgLegacy;
        this.dlg.saving = true;
        try {
          const obj = this.dlg.mode === 'json' ? JSON.parse(this.dlg.draft) : this.dlgClean(this.dlg.obj);
          const g = this.dlg.gh || new window.GH({ token: this.gh?.token || '', repo: this.dlg.repo, ref: this.dlg.ref });
          // save() lives in gh-store.js, which not every host page loads.
          if (typeof g.save !== 'function' && window.gh?.load) await window.gh.load('gh-store.js');
          await g.save('.web-tools.json', obj, legacy
            ? 'Migrate .show-repo.json to .web-tools.json via show-repo'
            : 'Update .web-tools.json via show-repo');
          if (toast) toast('check-circle', legacy ? 'Migrated to .web-tools.json' : 'Config saved', 'alert-success', 4000);
          this.dlg.config = obj; this.dlg.configName = '.web-tools.json';
          // The shell re-reads configs, refreshes the cache, and reloads the
          // estate / quick-link row on this event.
          document.dispatchEvent(new CustomEvent('web-tools:config-saved', { detail: { repo: this.dlg.repo } }));
        } catch (e) {
          if (toast) toast('warning', 'Save failed: ' + (e?.message || e), 'alert-error', 6000);
        } finally {
          this.dlg.saving = false;
        }
      },
      get offMain() {
        return !!(this.ref && this.defaultRef && this.ref !== this.defaultRef);
      },
      get dlgUrls() {
        const r = this.dlg.repo, ref = this.dlg.ref || 'main';
        if (!r) return [];
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
