document.addEventListener('alpine:init', function() {
  Alpine.data('estate', function() {
    // The all-repo estate, a context above any repo with two views of its own,
    // switched from the sidebar (the shell owns the view state):
    //   Repos     — a card per repo that opts in. Membership and every
    //               descriptive field live in each repo's OWN .web-tools.json
    //               (estate:true, group, note, icon, order); the
    //               estate discovers members by enumerating the account's repos
    //               and reading their configs, served through the registry's
    //               config cache (state/configs.json) with a live-scan fallback.
    //               The registry holds no per-repo config. Cards lay out as a
    //               full-width grid grouped by group (like the pages index).
    //   Surfaces  — the registry's curated surfaces/*.surface files, tabbed, each
    //               editable in place through a JSON dialog. These are estate
    //               content, not repo self-description, so they stay in the
    //               registry. Archive category excluded.
    // One component renders both; `tab` reads the shell view. Public (no token):
    // the public default card only, and no surfaces. See docs/show-repo.md
    // "The estate".
    const KIND_ICONS = {
      github_blob: 'ph-file', github_dir: 'ph-folder', repo: 'ph-git-branch',
      url: 'ph-link', note: 'ph-note', story: 'ph-book-open', embed: 'ph-app-window',
    };
    // Seed for a brand-new surface. Inert until filled, so saving as-is is safe.
    const SURFACE_TEMPLATE = {
      manifest: { name: '', description: '', category: 'showcase' },
      items: [],
    };

    return {
      description: 'All-repo estate: a full-width grouped grid of opted-in repo cards (membership + fields in each repo\'s own config) and the private registry\'s tabbed, editable surfaces',

      template: `
        <div>
          <!-- ── Repos view ─────────────────────────────────────────────── -->
          <div x-show="tab==='repos'">
            <!-- No page title, prose, or top add bar: the header nav marks the
                 active view, and adding a repo is per-category (the + on each
                 group header, which prefills that group and lets you retype it
                 for a new category). So the grid starts at the top. -->

            <!-- Signed-out actions: a token, or the rate-safe public browser.
                 The two buttons name themselves and the subtitle above states
                 the signed-out state, so no explanatory prose. -->
            <div x-show="!authed" class="flex flex-wrap items-center gap-2 mb-6">
              <button @click="document.getElementById('repo')?.__repo?.openDialog()"
                      class="btn btn-primary btn-sm gap-1"><i class="ph ph-key"></i>Add a token</button>
              <button @click="window.__shell?.goPublicBrowse()"
                      class="btn btn-ghost btn-sm gap-1 border border-base-300"><i class="ph ph-cloud-arrow-down"></i>Public browse</button>
              <a href="https://github.com/settings/tokens/new?scopes=repo&description=web-tools" target="_blank"
                 rel="noopener" class="text-sm text-base-content/40 hover:text-primary underline flex items-center gap-1">
                <i class="ph ph-arrow-square-out"></i>Get a token</a>
            </div>

            <!-- Add a repo to the estate (authed): sets estate:true in the
                 chosen repo's OWN .web-tools.json, so membership lives with the
                 repo, not in a registry list. -->
            <div x-show="addOpen" class="card bg-base-100 border border-base-300 shadow-sm max-w-md mb-6">
              <div class="card-body p-4 gap-2">
                <div class="text-base font-semibold flex items-center gap-1.5">
                  <i class="ph ph-plus-circle text-primary"></i>
                  <span x-text="addGroup ? ('Add a repository to ' + addGroup) : 'Add a repository'"></span>
                </div>
                <input list="estate-repo-candidates" x-model="addName" placeholder="owner/repo"
                       autocapitalize="off" autocorrect="off" spellcheck="false"
                       @keyup.enter="addRepo()"
                       class="input input-sm input-bordered font-mono text-sm">
                <datalist id="estate-repo-candidates">
                  <template x-for="c in candidates" :key="c"><option :value="c"></option></template>
                </datalist>
                <div class="flex gap-1.5">
                  <!-- group is a combobox: type a new one or pick an existing
                       group (the datalist lists the estate's current groups, so
                       the group names are visible before you commit to one). -->
                  <input list="estate-group-options" x-model="addGroup" placeholder="group (optional)"
                         autocapitalize="off" autocorrect="off" spellcheck="false"
                         class="input input-sm input-bordered text-sm flex-1">
                  <datalist id="estate-group-options">
                    <template x-for="g in groupOptions" :key="g"><option :value="g"></option></template>
                  </datalist>
                  <input x-model="addNote" placeholder="note (optional)"
                         class="input input-sm input-bordered text-sm flex-[2]">
                </div>
                <div class="flex items-center justify-end gap-2">
                  <button @click="addOpen=false" class="btn btn-ghost btn-sm">Cancel</button>
                  <button @click="addRepo()" :disabled="!addName.trim() || adding"
                          class="btn btn-primary btn-sm gap-1">
                    <span x-show="adding" class="loading loading-spinner loading-sm"></span>
                    <span x-text="adding ? 'Adding…' : 'Add'"></span>
                  </button>
                </div>
              </div>
            </div>

            <div x-show="loading" class="flex justify-center py-16">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>

            <!-- The grid: a section per group (header + count), each a full-width
                 three-wide grid of cards, like the pages index. Group order and
                 within-group order come from each repo's own order weight; a
                 -private companion renders inside its parent's card. -->
            <template x-for="sec in groupSections" :key="sec.group">
              <section class="mb-8">
                <h2 x-show="sec.group" class="text-sm font-mono uppercase tracking-widest text-base-content/40 mb-3 flex items-center gap-2">
                  <i class="ph ph-folder"></i><span x-text="sec.group"></span>
                  <span class="badge badge-ghost badge-sm" x-text="sec.items.length"></span>
                  <!-- Per-category add: prefills this group, so adding a repo here
                       is one fewer field. The group stays editable in the form. -->
                  <button x-show="authed" @click="openAdd(sec.group)"
                          class="text-base-content/30 hover:text-primary transition-colors"
                          :title="'Add a repo to ' + sec.group">
                    <i class="ph ph-plus text-base leading-none"></i></button>
                </h2>
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <!-- One card, possibly two faces: face(e) is the entry being
                       shown — the entry itself, or its nested -private companion
                       when the visibility toggle has flipped the card. Every
                       field below reads face(e). -->
                  <template x-for="e in sec.items" :key="e.repo">
                    <div class="card bg-base-100 border border-base-300 shadow-sm hover:border-primary/40 transition-colors w-full">
                      <div class="card-body p-4 gap-1.5">
                        <div class="flex items-center gap-1.5">
                          <i class="ph text-xl text-primary shrink-0" :class="face(e).icon"></i>
                          <button @click="openRepo(face(e).repo)"
                                  class="font-mono text-base font-semibold truncate hover:text-primary transition-colors cursor-pointer text-left"
                                  x-text="face(e).repo.split('/')[1]"></button>
                          <div class="grow"></div>
                          <!-- Status + actions. Gear edits the shown repo's
                               placement (its own config); logo opens it on
                               GitHub. With a nested companion the visibility
                               glyph is a TOGGLE. -->
                          <button x-show="e.child" @click="e.showChild = !e.showChild"
                                  class="text-base-content/40 hover:text-primary transition-colors shrink-0 cursor-pointer"
                                  :title="e.showChild ? 'back to ' + e.repo.split('/')[1] : 'show ' + e.child?.repo.split('/')[1]">
                            <i class="ph text-base leading-none" :class="face(e).meta?.priv ? 'ph-lock' : 'ph-globe'"></i>
                          </button>
                          <span x-show="!e.child && e.meta" class="shrink-0 text-base-content/40"
                                :title="e.meta?.priv ? 'private' : 'public'">
                            <i class="ph text-base leading-none"
                               :class="e.meta?.priv ? 'ph-lock' : 'ph-globe'"></i></span>
                          <button x-show="authed" @click="editEntry(face(e))"
                                  class="text-base-content/30 hover:text-primary transition-colors shrink-0"
                                  title="Placement: icon, group, note (and repo config)">
                            <i class="ph ph-gear-six text-base leading-none"></i></button>
                          <!-- Public browse this repo (no token, via jsDelivr). The
                               dialog's old CDN/flat-tree links retired here: this
                               is where a file listing actually belongs. -->
                          <button @click.stop="window.__shell?.goPublicBrowse(face(e).repo)"
                                  class="text-base-content/30 hover:text-primary transition-colors shrink-0"
                                  title="Public browse (no token, via jsDelivr)">
                            <i class="ph ph-cloud-arrow-down text-base leading-none"></i></button>
                          <a :href="'https://github.com/' + face(e).repo" target="_blank" @click.stop
                             class="text-base-content/30 hover:text-base-content/70 transition-colors shrink-0"
                             title="Open on GitHub"><i class="ph ph-github-logo text-base leading-none"></i></a>
                        </div>
                        <p class="text-sm text-base-content/70 min-h-8" x-text="face(e).note || face(e).meta?.desc || ''"></p>

                        <!-- The repo's own pinned folders / files. The title
                             opens the repo; Files/Atlas are one sidebar tap
                             away, so the card carries only the repo's pins. -->
                        <div x-show="face(e).pins && face(e).pins.length"
                             class="flex flex-wrap items-center gap-1 mt-0.5">
                          <template x-for="p in (face(e).pins || [])" :key="p">
                            <button @click="openRepoAt(face(e), p)"
                                    class="badge badge-sm badge-ghost gap-1 font-mono cursor-pointer
                                           hover:bg-primary/10 hover:text-primary transition-colors"
                                    :title="p">
                              <i class="ph text-sm" :class="pinIsFile(p) ? 'ph-file' : 'ph-folder'"></i>
                              <span x-text="pinLabel(p)"></span>
                            </button>
                          </template>
                        </div>

                        <div class="flex items-center gap-2 text-sm text-base-content/50">
                          <span x-show="face(e).meta?.ago" class="flex items-center gap-1">
                            <i class="ph ph-clock"></i><span x-text="'pushed ' + (face(e).meta?.ago || '')"></span>
                          </span>
                          <span x-show="face(e).err" class="text-warning flex items-center gap-1">
                            <i class="ph ph-warning"></i>unreachable
                          </span>
                        </div>

                        <!-- Branch rollup from the activity cache: a one-tap route
                             into the repo's branch review, plus stranded / open-PR
                             counts. Absent until the crawl has covered the repo. -->
                        <template x-if="cardActivity(face(e).repo)">
                          <div class="flex flex-wrap items-center gap-1 mt-0.5">
                            <button @click="openRepoBranches(face(e).repo)"
                                    class="badge badge-sm badge-ghost gap-1 font-mono cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                                    :title="'Branch review (' + (cardActivity(face(e).repo).counts?.branches || 0) + ' branches)'">
                              <i class="ph ph-git-branch text-sm"></i><span x-text="cardActivity(face(e).repo).counts?.branches || 0"></span>
                            </button>
                            <span x-show="cardActivity(face(e).repo).counts?.stranded"
                                  class="badge badge-sm badge-ghost gap-1 text-warning"
                                  :title="cardActivity(face(e).repo).counts.stranded + ' stranded branches'">
                              <i class="ph ph-warning-circle text-sm"></i><span x-text="cardActivity(face(e).repo).counts.stranded"></span>
                            </span>
                            <span x-show="cardActivity(face(e).repo).counts?.openPRs"
                                  class="badge badge-sm badge-ghost gap-1 text-primary"
                                  :title="cardActivity(face(e).repo).counts.openPRs + ' open pull requests'">
                              <i class="ph ph-git-pull-request text-sm"></i><span x-text="cardActivity(face(e).repo).counts.openPRs"></span>
                            </span>
                          </div>
                        </template>
                      </div>
                    </div>
                  </template>
                </div>
              </section>
            </template>

            <p x-show="authed && !loading && !groupSections.length" class="text-base text-base-content/50">
              No repos opt in yet.
            </p>
          </div>

          <!-- ── Surfaces view ──────────────────────────────────────────── -->
          <div x-show="tab==='surfaces'">
            <div class="flex items-center gap-2 mb-4" x-show="authed">
              <div class="grow"></div>
              <button @click="newSurface()"
                      class="btn btn-sm btn-ghost gap-1.5 text-base-content/60 hover:text-primary border border-dashed border-base-300">
                <i class="ph ph-plus-circle text-base"></i> New
              </button>
            </div>

            <p x-show="!authed" class="text-base text-base-content/60">
              Set a token (header shield) to see surfaces.
            </p>
            <div x-show="authed && surfLoading" class="flex justify-center py-16">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>
            <p x-show="authed && !surfLoading && !surfaces.length" class="text-base text-base-content/50">
              No surfaces yet.
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
                    <span class="text-sm font-mono text-base-content/30" x-text="s.file"></span>
                    <div class="grow"></div>
                    <button x-show="authed" @click="editSurface(s)"
                            class="self-center text-base-content/30 hover:text-primary transition-colors shrink-0"
                            title="Edit this surface file">
                      <i class="ph ph-gear-six text-base leading-none"></i></button>
                    <span class="badge badge-ghost badge-sm font-mono" x-text="s.manifest.category || 'showcase'"></span>
                  </div>
                  <p x-show="s.manifest.description" class="text-sm text-base-content/50 mb-3"
                     x-text="s.manifest.description"></p>
                  <div class="flex flex-col gap-2">
                    <template x-for="it in s.items" :key="it.id || it.title">
                      <div class="border border-base-300 rounded-lg bg-base-100 p-3">
                        <div class="flex items-center gap-2">
                          <i class="ph text-base text-primary shrink-0" :class="kindIcon(it)"></i>
                          <template x-if="openable(it)">
                            <button @click="openItem(it)"
                                    class="text-base font-medium hover:text-primary transition-colors cursor-pointer text-left truncate"
                                    x-text="it.title || itemPath(it)"></button>
                          </template>
                          <template x-if="!openable(it) && itemExt(it)">
                            <a :href="itemExt(it)" target="_blank"
                               class="text-base font-medium hover:text-primary transition-colors truncate"
                               x-text="it.title || itemExt(it)"></a>
                          </template>
                          <template x-if="!openable(it) && !itemExt(it)">
                            <span class="text-base font-medium truncate" x-text="it.title || '(untitled)'"></span>
                          </template>
                          <span x-show="it.facet" class="badge badge-ghost badge-sm" x-text="it.facet"></span>
                          <div class="grow"></div>
                          <span class="text-sm font-mono text-base-content/30 hidden sm:inline" x-text="itemPill(it)"></span>
                          <a x-show="itemGh(it)" :href="itemGh(it)" target="_blank"
                             class="text-base-content/30 hover:text-base-content/70 transition-colors shrink-0"
                             title="Open on GitHub"><i class="ph ph-github-logo"></i></a>
                        </div>
                        <p x-show="it.snippet" class="text-sm text-base-content/50 mt-1" x-text="it.snippet"></p>
                        <p x-show="it.commentary" class="text-sm text-base-content/60 mt-1.5 whitespace-pre-line border-l-2 border-base-300 pl-2"
                           x-text="it.commentary"></p>
                        <p x-show="bodyOf(it)" class="text-sm text-base-content/70 mt-1.5 whitespace-pre-line"
                           x-text="bodyOf(it)"></p>

                        <!-- Live embed (kind:embed): a renderer page rendered in
                             place via toss-render's page-sugar (#<page>=<addr>),
                             the same nested-token same-origin chain the app-view
                             and custom-landing embeds use. Collapsed by default;
                             the iframe mounts only on expand, one item at a time,
                             so the list stays scannable and several envelopes
                             don't all fetch at once. The title above opens the
                             same render full screen (itemExt). -->
                        <template x-if="isEmbed(it) && embedUrl(it)">
                          <div class="mt-2">
                            <button @click="toggleEmbed(s, it)"
                                    class="btn btn-xs btn-ghost gap-1.5 border border-base-300 text-base-content/60 hover:text-primary">
                              <i class="ph" :class="isEmbedOpen(s, it) ? 'ph-caret-up' : 'ph-caret-down'"></i>
                              <span x-text="isEmbedOpen(s, it) ? 'Collapse' : 'Expand embed'"></span>
                            </button>
                            <template x-if="isEmbedOpen(s, it)">
                              <iframe :src="embedUrl(it)" loading="lazy"
                                      class="w-full h-[70vh] mt-2 rounded-lg border border-base-300 bg-base-100"
                                      sandbox="allow-scripts allow-same-origin allow-popups allow-downloads"></iframe>
                            </template>
                          </div>
                        </template>
                      </div>
                    </template>
                    <p x-show="!s.items.length" class="text-sm text-base-content/40 italic">No items on this surface yet.</p>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- ── Activity view ─────────────────────────────────────────────
               A cross-repo read off the activity cache: a recent-commit stream
               and a per-repo rollup (branch counts, stranded, open PRs), each
               deep-linking into that repo's branch review. No per-visit fanout;
               Refresh re-crawls the estate through the shell. -->
          <div x-show="tab==='activity'">
            <div class="flex items-center gap-2 mb-3" x-show="authed">
              <!-- Mobile container toggle: pick one panel at a time so each is a
                   single, clean scroll. Desktop shows both columns, no toggle. -->
              <div class="flex items-center gap-0.5 rounded-lg bg-base-200/60 p-0.5 lg:hidden" x-show="activityRepos.length">
                <button @click="actSub='repos'" class="px-2.5 py-1 rounded-md text-sm font-medium transition-colors"
                        :class="actSub==='repos' ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60'">Repos</button>
                <button @click="actSub='commits'" class="px-2.5 py-1 rounded-md text-sm font-medium transition-colors"
                        :class="actSub==='commits' ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60'">Commits</button>
              </div>
              <span x-show="activityGeneratedAt" class="hidden sm:inline text-sm text-base-content/55" x-text="'as of ' + agoOf(activityGeneratedAt)"></span>
              <div class="grow"></div>
              <button @click="refreshActivity()" :disabled="activityBusy"
                      class="flex items-center gap-1.5 text-sm text-base-content/60 hover:text-primary px-2 py-1 rounded-lg hover:bg-base-200 transition-colors">
                <i class="ph ph-arrows-clockwise" :class="activityBusy && 'animate-spin'"></i>
                <span x-text="activityBusy ? 'Crawling…' : 'Refresh'"></span>
              </button>
            </div>
            <p x-show="!authed" class="text-base text-base-content/60">
              Activity lives in the private registry. Add a token with the shield in the header to see it.
            </p>

            <div x-show="authed && activityLoading" class="flex justify-center py-16">
              <span class="loading loading-dots loading-md opacity-30"></span>
            </div>

            <div x-show="authed && !activityLoading && !activityRepos.length"
                 class="rounded-xl bg-base-200/40 p-4 text-base text-base-content/60 max-w-lg">
              No activity cached yet. It builds on the throttled crawl (~12h), or now via Refresh.
            </div>

            <div x-show="authed && activityRepos.length" class="grid gap-4 lg:grid-cols-3 items-start">
              <!-- Per-repo rollups: a DENSE list (one row per repo, not a card
                   grid), so it reads as a data table rather than a second repo
                   dashboard. Name + inline count glyphs + pushed-ago on one line,
                   a one-line open-PR peek under it. Soft panel, no borders; the
                   name and branch glyph deep-link the branch review. Mobile shows
                   this or the commits panel per the toggle; desktop shows both. -->
              <div class="lg:col-span-2 min-w-0" :class="actSub!=='repos' && 'hidden lg:block'">
                <div class="rounded-xl bg-base-200/40 p-1 flex flex-col">
                  <template x-for="r in activityRepos" :key="r.repo">
                    <div class="rounded-lg px-2 py-1.5 hover:bg-base-100 transition-colors min-w-0">
                      <div class="flex items-center gap-2 min-w-0">
                        <button @click="openRepoBranches(r.repo)"
                                class="font-mono text-sm font-semibold truncate hover:text-primary transition-colors text-left min-w-0 flex-1"
                                x-text="repoShort(r.repo)"></button>
                        <div class="flex items-center gap-2 text-sm font-mono shrink-0">
                          <button @click="openRepoBranches(r.repo)" class="flex items-center gap-0.5 text-base-content/60 hover:text-primary transition-colors" title="Branches (open the branch review)">
                            <i class="ph ph-git-branch text-sm"></i><span x-text="r.counts?.branches || 0"></span></button>
                          <span x-show="r.counts?.active" class="flex items-center gap-0.5 text-success" title="Active in the last 14 days">
                            <i class="ph ph-pulse text-sm"></i><span x-text="r.counts.active"></span></span>
                          <span x-show="r.counts?.stranded" class="flex items-center gap-0.5 text-warning" title="Stranded branches">
                            <i class="ph ph-warning-circle text-sm"></i><span x-text="r.counts.stranded"></span></span>
                          <span x-show="r.counts?.openPRs" class="flex items-center gap-0.5 text-primary" title="Open pull requests">
                            <i class="ph ph-git-pull-request text-sm"></i><span x-text="r.counts.openPRs"></span></span>
                        </div>
                        <span x-show="r.pushedAt" class="text-sm text-base-content/55 shrink-0 w-9 text-right tabular-nums"
                              :title="'pushed ' + agoOf(r.pushedAt)" x-text="agoShort(r.pushedAt)"></span>
                      </div>
                      <!-- Open-PR peek: the newest, one line, with a +N tail. -->
                      <div x-show="r.openPRs && r.openPRs.length" class="flex items-center gap-1 mt-0.5 pl-0.5 text-sm min-w-0">
                        <i class="ph ph-git-pull-request text-sm text-primary/70 shrink-0"></i>
                        <a :href="'https://github.com/'+r.repo+'/pull/'+(r.openPRs?.[0]?.number)" target="_blank"
                           class="text-base-content/65 hover:text-primary truncate min-w-0" x-text="r.openPRs?.[0]?.title"></a>
                        <span x-show="r.openPRs.length > 1" class="text-base-content/50 shrink-0" x-text="'+' + (r.openPRs.length - 1)"></span>
                      </div>
                    </div>
                  </template>
                </div>
              </div>

              <!-- Recent commits: a dense, height-capped feed. Message + ago on
                   one line, the repo tag tiny beneath; soft fill, no borders. -->
              <div class="lg:col-span-1 min-w-0" :class="actSub!=='commits' && 'hidden lg:block'">
                <div class="hidden lg:block text-sm font-mono uppercase tracking-widest text-base-content/55 mb-2 px-1">Recent commits</div>
                <div class="rounded-xl bg-base-200/40 p-1 max-h-[70vh] lg:max-h-[34rem] overflow-y-auto flex flex-col">
                  <template x-for="c in activityStream.slice(0, 25)" :key="c.repo + c.sha">
                    <a :href="commitUrl(c.repo, c.sha)" target="_blank"
                       class="block rounded-lg px-2 py-1 hover:bg-base-100 transition-colors min-w-0">
                      <div class="flex items-baseline gap-1.5 min-w-0">
                        <span class="text-sm truncate flex-1" :title="c.msg" x-text="c.msg"></span>
                        <span class="text-sm text-base-content/55 shrink-0 tabular-nums" x-text="agoShort(c.date)"></span>
                      </div>
                      <span class="text-sm font-mono text-base-content/60 truncate block" x-text="repoShort(c.repo)"></span>
                    </a>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Surface editor dialog: a JSON editor over one surface file,
               mirroring the repo config dialog. New surfaces get an editable
               filename; existing ones show it read-only. Writes the registry. -->
          <dialog x-ref="surfDlg" class="modal" onclick="if(event.target===this)this.close()">
            <div class="modal-box shadow-none border border-base-300 bg-base-100 p-4 max-w-lg overflow-x-hidden">
              <div class="flex items-center gap-1.5 text-base font-semibold mb-3">
                <i class="ph ph-cards text-primary"></i>
                <span x-text="surfIsNew ? 'New surface' : 'Edit surface'"></span>
              </div>
              <div class="flex items-center gap-1.5 mb-2">
                <span class="text-sm text-base-content/50 font-mono">surfaces/</span>
                <template x-if="surfIsNew">
                  <input x-model="surfName" placeholder="name.surface"
                         autocapitalize="off" autocorrect="off" spellcheck="false"
                         class="input input-sm input-bordered font-mono text-sm flex-1">
                </template>
                <template x-if="!surfIsNew">
                  <span class="font-mono text-sm" x-text="surfName"></span>
                </template>
              </div>
              <textarea x-model="surfDraft" spellcheck="false" rows="14"
                class="textarea textarea-bordered w-full font-mono text-sm leading-snug"
                :class="surfErr && 'textarea-error'" placeholder="{ }"></textarea>
              <div class="flex items-center justify-between gap-2 min-h-[1.25rem] mt-1">
                <span x-show="surfErr" class="text-error text-sm flex items-center gap-1 min-w-0">
                  <i class="ph ph-warning shrink-0"></i><span class="truncate" x-text="surfErr"></span></span>
                <span x-show="!surfErr" class="text-success text-sm flex items-center gap-1">
                  <i class="ph ph-check"></i>Valid JSON</span>
                <button @click="surfFormat()" :disabled="!!surfErr" class="btn btn-ghost btn-sm shrink-0">Format</button>
              </div>
              <div class="flex items-center justify-end gap-2 mt-3">
                <button @click="$refs.surfDlg.close()" class="btn btn-ghost btn-sm text-sm">Cancel</button>
                <button @click="surfSave()" :disabled="!!surfErr || surfSaving || !authed || (surfIsNew && !surfName.trim())"
                        class="btn btn-primary btn-sm text-sm gap-1.5">
                  <span x-show="surfSaving" class="loading loading-spinner loading-sm"></span>
                  <span x-text="surfSaving ? 'Saving…' : 'Save surface'"></span>
                </button>
              </div>
            </div>
          </dialog>
        </div>`,

      loading: true,
      authed: false,
      entries: [],     // [{repo, icon, note, group, order, meta, err, pins, hasLanding, child}]
      surfaces: [],    // [{file, manifest, items, raw}]
      surfLoading: false,
      surfActive: 0,
      // Per-item embed expand state, keyed `${file}/${id}`. Kept off the item
      // objects so the surface editor round-trips the file clean (kind:embed).
      embedOpen: {},

      // Activity: read from the private registry's derived cache
      // (state/activity.json, lib/repo-activity-cache.js), the same read that
      // gives the Repos cards their freshness rollups and the Activity view its
      // cross-repo strip. One file read, no per-repo fanout.
      activity: {},           // { "owner/repo": <cache entry> }
      activityStream: [],     // flat newest-first cross-repo recent commits
      activityGeneratedAt: '',
      activityLoading: false,
      actSub: 'repos',        // which Activity container the mobile toggle shows: 'repos' | 'commits'

      // Surface editor dialog state (mirrors the repo config editor).
      surfIsNew: false,
      surfName: '',
      surfDraft: '{}',
      surfSaving: false,

      init(){
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
        this.load();
        // Auth resolves after boot; reload when it lands. Any config save (a
        // repo's own config, or the registry) can change membership or a card,
        // so reload broadly.
        this.$watch(() => window.__shell && window.__shell._authState, (s) => {
          if (s === 'auth') this.load();
        });
        document.addEventListener('web-tools:config-saved', () => this.load());
        // The shell's refresh button force-rebuilds the config cache, then fires
        // this once the crawl has committed, so the reload reads fresh cards.
        document.addEventListener('web-tools:configs-refreshed', () => this.load());
        // The activity crawl commits state/activity.json and fires this; re-read
        // just the activity cache (the cards themselves haven't changed).
        document.addEventListener('web-tools:activity-refreshed', () => this.reloadActivity());
      },

      // Which estate view is showing, from the shell (Repos | Surfaces | Activity).
      get tab(){
        const v = window.__shell?.view;
        return v === 'surfaces' ? 'surfaces' : v === 'activity' ? 'activity' : 'repos';
      },

      registry(){ return window.__shell?.REGISTRY_REPO || 'mehrlander/web-tools-private'; },
      defaultRepo(){ return window.__shell?.DEFAULT_REPO || 'mehrlander/web-tools'; },
      hasToken(){ return !!window.__shell?.hasToken?.(); },

      // ── Membership: read each repo's own config, filter estate:true ──────────
      // The estate reads the registry's config cache (state/configs.json, a
      // periodic crawl of every account repo's .web-tools.json) for membership
      // and fields, and falls back to a live account scan when the cache holds
      // no members yet (cold start). The registry stores no per-repo config.
      async readConfigCache(reg){
        try {
          const path = window.RepoConfigCache?.CACHE_PATH || 'state/configs.json';
          const cache = JSON.parse((await reg.get(path)).text);
          const out = {};
          for (const [name, e] of Object.entries(cache.repos || {})) out[name] = e?.config || null;
          return out;
        } catch { return {}; }
      },
      async liveScanConfigs(){
        const gh = new window.GH({ token: window.TOKEN });
        let acct = [];
        try { acct = await gh.repos(); } catch { acct = []; }
        const out = {};
        await Promise.all(acct.map(async (r) => {
          const g = new window.GH({ token: window.TOKEN, repo: r.full_name, ref: r.default_branch || 'main' });
          for (const n of ['.web-tools.json', '.show-repo.json']){
            try {
              const c = JSON.parse((await g.get(n)).text);
              if (c && typeof c === 'object' && !Array.isArray(c)){ out[r.full_name] = c; break; }
            } catch {}
          }
        }));
        return out;
      },

      async load(){
        this.authed = this.hasToken();
        if (!this.authed){
          // Public: the shell's public default card only, no surfaces, no
          // activity (the cache lives in the private registry).
          this.surfaces = [];
          this.activity = {}; this.activityStream = []; this.activityGeneratedAt = '';
          const def = this.defaultRepo();
          this.entries = [{ repo: def, icon: 'ph-toolbox', note: '', group: '', order: 0,
                            meta: null, err: false, pins: [], hasLanding: false, child: null, showChild: false }];
          this.enrichMeta();
          this.loading = false;
          return;
        }

        const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: 'main' });
        this.loadSurfaces(reg);   // independent; don't hold the cards for it
        this.loadActivity(reg);   // independent; the cards render without it

        let confMap = await this.readConfigCache(reg);
        let members = Object.keys(confMap).filter(n => confMap[n]?.estate === true);
        if (!members.length){
          // Cache cold or pre-migration: scan live, and force a cache rebuild so
          // later loads are cache-served.
          confMap = await this.liveScanConfigs();
          members = Object.keys(confMap).filter(n => confMap[n]?.estate === true);
          window.__shell?.refreshConfigCache?.(true);
        }

        this.entries = members.map(name => {
          const cfg = confMap[name] || {};
          return {
            repo: name,
            icon: cfg.icon || 'ph-bookmark-simple',
            note: cfg.note || '',
            group: cfg.group || '',
            order: Number.isFinite(cfg.order) ? cfg.order : 0,
            pins: Array.isArray(cfg.pins) ? cfg.pins.slice(0, 6) : [],
            hasLanding: !!cfg.landing,
            meta: null, err: false, child: null, showChild: false,
          };
        });
        this.applyNesting();
        this.loading = false;
        this.enrichMeta();
      },

      // Nesting by convention: owner/foo-private rides inside owner/foo's card
      // when both are on the estate, so the private companion doesn't hold a
      // card of its own. No config field; purely the naming pairing.
      applyNesting(){
        for (const child of this.entries){
          const m = child.repo.match(/^(.*)-private$/);
          if (!m) continue;
          const parent = this.entries.find(e => e.repo === m[1]);
          if (parent && parent !== child && !parent.child){ parent.child = child; child.nested = true; }
        }
      },

      // Live GitHub metadata (description, visibility, pushed-ago) for the shown
      // cards, from one account-repos list call, matched by name. A member the
      // list doesn't cover (e.g. beyond per_page, or not owned) simply shows
      // without meta.
      async enrichMeta(){
        const gh = new window.GH({ token: this.authed ? window.TOKEN : '' });
        let acct = [];
        try { acct = await gh.repos(); } catch {}
        const byName = new Map(acct.map(r => [r.full_name, r]));
        for (const en of this.entries){
          const r = byName.get(en.repo);
          if (r){
            en.meta = {
              desc: r.description || '', priv: !!r.private,
              ago: (r.pushed_at && gh.ago) ? gh.ago(r.pushed_at) : '', ref: r.default_branch || 'main',
            };
          } else if (!en.meta){
            // Not in the list: one direct metadata read so the card still fills.
            try {
              const rr = await gh.req('/repos/' + en.repo);
              en.meta = { desc: rr.description || '', priv: !!rr.private,
                          ago: (rr.pushed_at && gh.ago) ? gh.ago(rr.pushed_at) : '', ref: rr.default_branch || 'main' };
            } catch { en.err = true; }
          }
        }
      },

      // The entry a card is currently showing: itself, or its nested companion
      // once the visibility toggle flipped it (e.showChild).
      face(e){ return e.showChild && e.child ? e.child : e; },

      // ── Activity ───────────────────────────────────────────────────────────
      // Read the private registry's activity cache (state/activity.json) once.
      // Feeds both the Repos cards' freshness rollups and the Activity view's
      // cross-repo strip; no per-repo API fanout happens here.
      async loadActivity(reg){
        this.activityLoading = true;
        try {
          const A = window.RepoActivityCache;
          const path = A?.CACHE_PATH || 'state/activity.json';
          const cache = JSON.parse((await reg.get(path)).text);
          this.activity = cache.repos || {};
          this.activityGeneratedAt = cache.generatedAt || '';
          this.activityStream = A ? A.recentStream(cache, 30) : [];
        } catch { this.activity = {}; this.activityStream = []; this.activityGeneratedAt = ''; }
        finally { this.activityLoading = false; }
      },
      async reloadActivity(){
        if (!this.hasToken()) return;
        const reg = new window.GH({ token: window.TOKEN, repo: this.registry(), ref: 'main' });
        await this.loadActivity(reg);
      },
      // Force the crawl (the Activity view's Refresh button). The shell owns the
      // crawl + throttle and fires web-tools:activity-refreshed when it commits.
      refreshActivity(){ window.__shell?.refreshActivity?.(); },
      get activityBusy(){ return !!window.__shell?.activityRefreshing; },

      // Members that have a cached activity entry, freshest push first.
      get activityRepos(){
        return Object.entries(this.activity)
          .map(([repo, e]) => ({ repo, ...e }))
          .sort((a, b) => (b.pushedAt || '').localeCompare(a.pushedAt || ''));
      },
      // A card's cached activity, or null (public, uncrawled, or pre-cache).
      cardActivity(repo){ return this.activity[repo] || null; },

      repoShort(repo){ return (repo || '').split('/')[1] || repo; },
      commitUrl(repo, sha){ return 'https://github.com/' + repo + '/commit/' + sha; },
      // Relative time from an ISO date, reusing GH.ago (one throwaway instance).
      agoOf(iso){ try { return iso ? (this.__ago ||= new window.GH({})).ago(iso) : ''; } catch { return ''; } },
      // Compact form for the dense tables: drop " ago", collapse "just now".
      agoShort(iso){ return this.agoOf(iso).replace(' ago', '').replace('just now', 'now'); },
      // Open a repo straight into its per-repo branch-review view.
      async openRepoBranches(repo){
        if (!window.__shell) return;
        await window.__shell.ensureBrowser(repo, this.activity[repo]?.defaultBranch || '');
        window.__shell.goBranches();
      },

      // ── Repos grid layout ────────────────────────────────────────────────
      // A section per group. Group order and within-group order both come from
      // each repo's own `order` (group weight = its lowest member's order), so
      // arrangement, like everything else, is a repo property. Nested entries
      // render inside their parent, so they are excluded here.
      get groupSections(){
        const visible = this.entries.filter(e => !e.nested);
        const by = new Map();
        for (const e of visible){
          const g = e.group || '';
          if (!by.has(g)) by.set(g, []);
          by.get(g).push(e);
        }
        for (const arr of by.values()) arr.sort((a, b) => (a.order - b.order) || a.repo.localeCompare(b.repo));
        const groups = [...by.keys()].sort((ga, gb) => {
          const minA = Math.min(...by.get(ga).map(e => e.order));
          const minB = Math.min(...by.get(gb).map(e => e.order));
          return (minA - minB) || ga.localeCompare(gb);
        });
        return groups.map(g => ({ group: g, items: by.get(g) }));
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
      // ── Add a repo to the estate: set estate:true in ITS OWN config ─────────
      // Membership is a repo property, so adding writes the target repo's
      // .web-tools.json (needs write access to that repo). Candidates come from
      // the header repo picker's already-loaded account list, minus current
      // members.
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
      // Open the add form, optionally with a group preset (the per-category +).
      // The group stays editable, so a new category is still one keystroke away.
      openAdd(group){ this.addGroup = group || ''; this.addOpen = true; this.loadCandidates(); },
      // The estate's current group names, for the group comboboxes.
      get groupOptions(){
        return [...new Set(this.entries.map(e => e.group).filter(Boolean))].sort();
      },
      // Resolve a repo's default branch from the header picker's list, else a
      // direct metadata read, else 'main'.
      async repoRef(full){
        const rc = document.getElementById('repo')?.__repo;
        const known = (rc?.repos || []).find(r => r.full_name === full);
        if (known?.default_branch) return known.default_branch;
        try { return (await new window.GH({ token: window.TOKEN }).req('/repos/' + full)).default_branch || 'main'; }
        catch { return 'main'; }
      },
      async addRepo(){
        const full = this.addName.trim();
        if (!full || !this.hasToken()) return;
        if (!/^[^/\s]+\/[^/\s]+$/.test(full)){
          Alpine.store('toast')?.('warning', 'Enter owner/repo', 'alert-warning', 4000); return;
        }
        if (this.entries.some(e => e.repo === full)){
          Alpine.store('toast')?.('info', full + ' is already on the estate', 'alert-info', 3000);
          this.addOpen = false; this.addName = ''; return;
        }
        this.adding = true;
        try {
          const ref = await this.repoRef(full);
          const g = new window.GH({ token: window.TOKEN, repo: full, ref });
          let cfg = {};
          try { cfg = JSON.parse((await g.get('.web-tools.json')).text); } catch {}
          if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) cfg = {};
          cfg.estate = true;
          if (this.addGroup.trim()) cfg.group = this.addGroup.trim();
          if (this.addNote.trim()) cfg.note = this.addNote.trim();
          if (typeof g.save !== 'function' && window.gh?.load) await window.gh.load('gh-store.js');
          await g.save('.web-tools.json', cfg, 'Join the web-tools estate (estate: true) via show-repo');
          Alpine.store('toast')?.('check-circle', 'Added ' + full, 'alert-success', 3000);
          this.addOpen = false; this.addName = ''; this.addGroup = ''; this.addNote = '';
          window.__shell?.refreshConfigCache?.(true);   // so it appears without waiting for the throttle
          document.dispatchEvent(new CustomEvent('web-tools:config-saved', { detail: { repo: full } }));
        } catch(e){
          Alpine.store('toast')?.('warning', 'Add failed: ' + (e?.message || e), 'alert-error', 6000);
        } finally { this.adding = false; }
      },

      // The card gear opens the shared repo dialog (info + links / config) on
      // this card's repo, on its Config tab, WITHOUT navigating the shell to it.
      // One dialog for every repo, on the dashboard and on a repo page alike.
      editEntry(en){
        const rc = document.getElementById('repo')?.__repo;
        if (rc && en) rc.openDialog(en.repo, { tab: 'settings' });
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

      // Route through openPinned so the landing flip is explicit: ensureBrowser
      // alone leaves the view untouched when the card's repo is already open
      // (always true for the default repo tapped from the estate).
      async openRepo(repo){ await window.__shell?.openPinned(repo); },

      // ── Surface items ──────────────────────────────────────────────────────
      kindIcon(it){ return KIND_ICONS[it.kind] || 'ph-shapes'; },
      bodyOf(it){ return (it.kind === 'note' || it.kind === 'story') ? (it.body || '') : ''; },

      // A kind:embed item renders a renderer page live through toss-render's
      // page-sugar (#<page>=<addr>): the item names the renderer (page, the
      // sugar key, default chat-results) and the envelope's location ({repo,
      // ref, path}); estate composes the one address and toss-render stays the
      // schema-blind router. A chat/trawl results envelope is the first use;
      // any other PAGE_SUGAR renderer embeds by naming its page, no code here.
      isEmbed(it){ return it.kind === 'embed'; },
      embedPage(it){ return it.page || 'chat-results'; },
      embedUrl(it){
        if (!it.repo || !it.path) return '';
        const ref = it.ref ? '@' + it.ref : '';
        return '../toss-render.html#' + this.embedPage(it) + '=' + it.repo + ref + ':' + it.path;
      },
      embedKey(s, it){ return s.file + '/' + (it.id || it.title || ''); },
      isEmbedOpen(s, it){ return !!this.embedOpen[this.embedKey(s, it)]; },
      toggleEmbed(s, it){ const k = this.embedKey(s, it); this.embedOpen[k] = !this.embedOpen[k]; },

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
        if (this.isEmbed(it)) return it.repo || '';
        if (it.url) { try { return new URL(it.url).hostname; } catch {} }
        return '';
      },
      itemGh(it){
        const r = this.itemRef(it);
        if (r) return 'https://github.com/' + r.repo + '/' + (r.dir ? 'tree' : 'blob') + '/' + (r.ref || 'main') + '/' + r.path;
        // An embed's github link points at the envelope blob it renders.
        if (this.isEmbed(it) && it.repo && it.path)
          return 'https://github.com/' + it.repo + '/blob/' + (it.ref || 'main') + '/' + it.path;
        return '';
      },
      // An embed's title opens the same render full screen (the toss-render
      // page-sugar URL); a url item opens its external link, as before.
      itemExt(it){
        if (this.isEmbed(it)) return this.embedUrl(it);
        return (it.kind === 'url' || (!this.itemRef(it) && it.url)) ? (it.url || '') : '';
      },
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
