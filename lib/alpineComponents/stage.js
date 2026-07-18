// The stage: a cross-repo fileset staged for action (view, copy out, send to
// a repo), presented as an estate-context view in show-repo — one stage above
// any repo, beside Repos and Surfaces, since staged items each carry their own
// origin and the set never belonged to the open repo. The link is the
// transport: a #stage= fragment names a set of refs and opens the view
// preloaded with them. Content stays behind the viewer's token; the link
// carries only refs. (A content-carrying #gz= bundle form for token-less
// contexts is a contemplated follow-up, not built here.)
//
// Takes from: upload (drop-zone), a repo (the path-picker grab row here, or
// the + on Files rows while visiting a repo), #stage= links, and manifest
// stage.files seeds. Puts to: clipboard (the concatenated bundle), a repo
// (send), with bundle download as the clipboard's fallback. Preview is inline;
// it does not route through any repo's Files view.
//
// A staged item is one of two kinds. A REF ({repo, ref, path}) points at a
// file that already lives in a repo; the bundle fetches it and the transfer
// copies it. A LOCAL item ({local:true, name, bytes|text}) is a file dropped
// straight into the stage, its bytes held in memory. Both ride the one stage
// array and both flow through the one "Copy to repo" deposit: refs via
// gh.copyTo, local bytes via gh.saveBytes/save. A local item is transient (its
// bytes can't serialize), so it is left out of the #stage= link and the
// .web-tools.json save; the ref items carry those.
//
// Grammar, both directions (StageLink.parse / StageLink.mint):
//
//   #stage=owner/repo[@ref]:path1,path2;owner2/repo2:path3
//
// Groups are ';'-separated, paths ','-separated, @ref optional (absent means
// the source repo's default branch). Paths are URL-encoded per component with
// '/' left readable.

window.StageLink = (() => {
  const ITEM_RE = /^([\w.-]+\/[\w.-]+?)(?:@([^:]+))?:(.+)$/;

  // "owner/repo[@ref]:path" -> { repo, ref, path } | null (no match: a bare
  // path, or garbage). Used for manifest stage.files entries and link groups.
  const parseItem = (s) => {
    const m = String(s || '').trim().match(ITEM_RE);
    return m ? { repo: m[1], ref: m[2] || '', path: m[3] } : null;
  };

  const fmtItem = (it) => it.repo + (it.ref ? '@' + it.ref : '') + ':' + it.path;

  // Accepts a full location.hash (leading '#' and all) or a bare spec.
  const parse = (hash) => {
    const m = String(hash || '').match(/#?stage=(.+)$/);
    if (!m) return [];
    const items = [];
    for (const group of m[1].split(';')) {
      const gm = group.trim().match(ITEM_RE);
      if (!gm) continue;
      for (const p of gm[3].split(',')) {
        let path;
        try { path = decodeURIComponent(p.trim()); } catch { continue; }
        if (path) items.push({ repo: gm[1], ref: gm[2] || '', path });
      }
    }
    return items;
  };

  const mint = (items, base) => {
    const groups = new Map();
    for (const it of items) {
      const k = it.repo + (it.ref ? '@' + it.ref : '');
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(encodeURIComponent(it.path).replace(/%2F/gi, '/'));
    }
    const spec = [...groups.entries()].map(([k, ps]) => k + ':' + ps.join(',')).join(';');
    return (base || '') + '#stage=' + spec;
  };

  return { parse, mint, parseItem, fmtItem };
})();

document.addEventListener('alpine:init', function() {
  Alpine.data('stager', function() {
    const fmt = t => t.replace(/ {4}/g, '  ');
    const joinDir = (dir, name) => dir ? dir.replace(/\/+$/, '') + '/' + name : name;
    // Monotonic id source for local items. A closure, not a component field:
    // onDropped runs in the drop-zone's child scope, where `this` is not the
    // stager, so a `this`-based counter would land on the wrong object.
    let seq = 0;

    return {
      description: 'The staged fileset as a main-area view: dropped local files and cross-repo refs in one stage, with view/remove per item and one send/save/mint deposit',

      template: `
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <h2 class="text-lg font-bold flex items-center gap-2">
              <i class="ph ph-stack"></i>Stage
              <span class="badge badge-ghost" x-text="items.length"></span>
            </h2>
            <div class="flex items-center gap-1" x-show="items.length">
              <button @click="copyLink()" class="btn btn-xs btn-ghost gap-1"
                      title="Copy the persistent stage link: a #stage= URL that reopens these refs anywhere (local files excluded)">
                <i class="ph" :class="linkCopied ? 'ph-check' : 'ph-link'"></i>Persistent link
              </button>
              <button @click="clearAll()" class="btn btn-xs btn-ghost gap-1 hover:text-error">
                <i class="ph ph-trash"></i>Clear
              </button>
            </div>
          </div>

          <!-- Drop in a local file: it becomes a staged item (its bytes held in
               memory) beside any refs, and rides the same Copy to repo below. -->
          <div x-data="dropZone({ idle: 'Drop in to stage a local file', hint: 'or click to browse, or paste', pasteText: true })"
               @drop-file="onDropped($event.detail)"></div>

          <!-- Grab from a repo: the tap-through path picker, staging each
               chosen file. The picker stays open in place, so grabbing several
               files is one descent. -->
          <div @path-pick="grab($event.detail)">
            <div x-data="pathPicker({ mode: 'file', roots: () => pickerRoots(), placeholder: 'Grab from a repo' })"></div>
          </div>

          <!-- The finder: Recent (latest committed files across the estate's
               repos, filterable by repo pill) and Search (filename-contains
               over the same repos' full trees) as sibling tabs, one tap to
               stage either way. Row anatomy is deliberate: the basename
               leads, the repo and folder sit beneath it in the muted line, so
               "where is this from" reads without decoding a long path. -->
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-0.5">
                <button @click="finderTab = 'recent'; recentOpen = true"
                        class="btn btn-xs gap-1" :class="finderTab === 'recent' ? 'btn-active btn-ghost' : 'btn-ghost opacity-60'">
                  Recent<span x-show="recent.length" class="badge badge-ghost badge-xs" x-text="recent.length"></span>
                </button>
                <button @click="finderTab = 'search'; recentOpen = true; ensureTrees()"
                        class="btn btn-xs gap-1" :class="finderTab === 'search' ? 'btn-active btn-ghost' : 'btn-ghost opacity-60'">
                  Search
                </button>
              </div>
              <div class="flex items-center gap-0.5">
                <button x-show="finderTab === 'recent'" @click="loadRecent(true)" class="btn btn-ghost btn-xs btn-square" title="Refresh">
                  <i class="ph" :class="recentLoading ? 'ph-circle-notch animate-spin' : 'ph-arrows-clockwise'"></i>
                </button>
                <button @click="recentOpen = !recentOpen" class="btn btn-ghost btn-xs btn-square" title="Collapse">
                  <i class="ph ph-caret-down transition-transform" :class="!recentOpen && '-rotate-90'"></i>
                </button>
              </div>
            </div>

            <!-- Repo pills: one per repo present in Recent; tap to exclude,
                 tap again to re-include (multi-select, all on by default). -->
            <div x-show="recentOpen && finderTab === 'recent' && repoPills().length > 1" class="flex flex-wrap gap-1">
              <template x-for="pl in repoPills()" :key="pl.repo">
                <button @click="togglePill(pl.repo)"
                        class="badge badge-sm cursor-pointer gap-1 transition-opacity"
                        :class="excluded[pl.repo] ? 'badge-ghost opacity-40' : 'badge-primary badge-outline'">
                  <span x-text="pl.repo.split('/').pop()"></span>
                  <span class="opacity-60" x-text="pl.n"></span>
                </button>
              </template>
            </div>

            <!-- Search box: 16px font on purpose, so iOS does not zoom the
                 one input this view genuinely needs. -->
            <label x-show="recentOpen && finderTab === 'search'" class="input input-sm input-bordered flex items-center gap-2">
              <i class="ph ph-magnifying-glass opacity-50"></i>
              <input x-model="searchQ" type="text" placeholder="File name contains…"
                     autocomplete="off" autocapitalize="off" spellcheck="false"
                     class="grow font-mono text-base sm:text-sm">
            </label>

            <div x-show="recentOpen && finderTab === 'recent' && recentLoading && !recent.length" class="flex justify-center py-4">
              <span class="loading loading-dots loading-sm opacity-30"></span>
            </div>
            <div x-show="recentOpen && finderTab === 'search' && treesLoading" class="flex justify-center py-4">
              <span class="loading loading-dots loading-sm opacity-30"></span>
            </div>

            <!-- Constrained and self-scrolling, so a deep history (or a broad
                 search) scrolls inside its own box instead of stretching the
                 page. -->
            <div x-show="recentOpen" class="flex flex-col max-h-72 overflow-y-auto overscroll-contain rounded-lg">
              <template x-for="it in finderRows()" :key="'r:' + it.repo + ':' + it.path">
                <button @click="toggleRecent(it)"
                        class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-base-200 text-left transition-colors">
                  <i class="ph text-lg shrink-0"
                     :class="recentStaged(it) ? 'ph-check-circle text-success' : 'ph-plus-circle text-primary/70'"></i>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-baseline justify-between gap-2">
                      <span class="truncate font-mono text-sm" x-text="baseName(it.path)"></span>
                      <span x-show="it.date" class="shrink-0 text-[10px] opacity-50" x-text="ago(it.date)"></span>
                    </div>
                    <div class="truncate font-mono text-[11px] opacity-50" :title="it.repo + ':' + it.path"
                         x-text="whereFrom(it)"></div>
                  </div>
                </button>
              </template>
              <div x-show="finderTab === 'search' && searchQ.trim().length >= 2 && !treesLoading && !finderRows().length"
                   class="py-4 text-center text-sm text-base-content/50">No matching files.</div>
            </div>
          </div>

          <template x-for="g in groups" :key="g.key">
            <div class="border border-base-300 rounded-lg bg-base-100 overflow-hidden">
              <div class="px-3 py-1.5 bg-base-200/60 font-mono text-xs flex items-center gap-1.5">
                <i class="ph ph-git-branch opacity-60"></i><span x-text="g.key"></span>
                <span class="opacity-40" x-text="'· ' + g.items.length"></span>
              </div>
              <div class="p-1">
                <template x-for="it in g.items" :key="itemKey(it)">
                  <div class="group flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-base-200 text-sm">
                    <button @click="view(it)" class="flex items-center gap-2 min-w-0 cursor-pointer hover:text-primary text-left">
                      <i class="ph ph-file text-info shrink-0"></i>
                      <span class="truncate font-mono" x-text="it.path"></span>
                    </button>
                    <button @click="rm(it)"
                            class="btn btn-ghost btn-xs w-6 h-6 p-0 opacity-30 hover:opacity-100 hover:text-error">
                      <i class="ph ph-x"></i>
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </template>

          <!-- Local (dropped) files: held in memory, no source repo. -->
          <div x-show="localItems.length" class="border border-base-300 rounded-lg bg-base-100 overflow-hidden">
            <div class="px-3 py-1.5 bg-base-200/60 font-mono text-xs flex items-center gap-1.5">
              <i class="ph ph-upload-simple opacity-60"></i><span>local (dropped)</span>
              <span class="opacity-40" x-text="'· ' + localItems.length"></span>
            </div>
            <div class="p-1">
              <template x-for="it in localItems" :key="itemKey(it)">
                <div class="group flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-base-200 text-sm">
                  <button @click="view(it)" class="flex items-center gap-2 min-w-0 cursor-pointer hover:text-primary text-left">
                    <i class="ph ph-file-dashed text-warning shrink-0"></i>
                    <span class="truncate font-mono" x-text="it.name"></span>
                    <span class="opacity-50 shrink-0 text-xs" x-text="fmtSize(it.size)"></span>
                  </button>
                  <button @click="rm(it)"
                          class="btn btn-ghost btn-xs w-6 h-6 p-0 opacity-30 hover:opacity-100 hover:text-error">
                    <i class="ph ph-x"></i>
                  </button>
                </div>
              </template>
            </div>
          </div>

          <!-- Inline preview: a staged item viewed in place. The stage is an
               estate-context view, so previewing never routes through a repo's
               Files view; the origin link is the jump-over to GitHub. -->
          <div x-show="preview" class="border border-base-300 rounded-lg bg-base-100 overflow-hidden">
            <div class="px-3 py-1.5 bg-base-200/60 flex items-center gap-2 text-xs font-mono">
              <i class="ph ph-eye opacity-60"></i>
              <span class="truncate" x-text="preview?.name"></span>
              <a x-show="preview?.href" :href="preview?.href" target="_blank"
                 class="opacity-50 hover:opacity-100 hover:text-primary shrink-0" title="Open on GitHub">
                <i class="ph ph-github-logo"></i>
              </a>
              <span class="grow"></span>
              <button @click="preview = null" class="btn btn-ghost btn-xs btn-square opacity-60 hover:opacity-100">
                <i class="ph ph-x"></i>
              </button>
            </div>
            <div class="overflow-auto font-mono text-[11px] leading-snug p-2 max-h-[40vh] whitespace-pre"
                 x-text="preview?.text"></div>
          </div>

          <!-- The output box, two lenses on what's staged: Concatenated (the
               files spliced into one block, the same shape the transfer
               copies, for copy-out or download) and Compare (a line diff of
               two staged files — or one staged file against another ref, the
               version difference). -->
          <div x-show="items.length" class="border border-base-300 rounded-lg bg-base-100 p-3 flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-0.5">
                <button @click="outTab = 'bundle'"
                        class="btn btn-xs gap-1" :class="outTab === 'bundle' ? 'btn-active btn-ghost' : 'btn-ghost opacity-60'">
                  <i class="ph ph-brackets-curly"></i>Concatenated
                </button>
                <button @click="outTab = 'diff'"
                        class="btn btn-xs gap-1" :class="outTab === 'diff' ? 'btn-active btn-ghost' : 'btn-ghost opacity-60'">
                  <i class="ph ph-git-diff"></i>Compare
                </button>
                <span class="opacity-60 font-mono text-xs ml-1"
                      x-text="outTab === 'bundle' ? bundleStat : diffStat"></span>
              </div>
              <div class="flex items-center gap-0.5" x-show="outTab === 'bundle'">
                <button @click="rebuild()" :disabled="bundleBusy" class="btn btn-xs btn-square btn-ghost" title="Refresh">
                  <i class="ph" :class="bundleBusy ? 'ph-circle-notch animate-spin' : 'ph-arrows-clockwise'"></i>
                </button>
                <button @click="copyBundle()" class="btn btn-xs btn-ghost gap-1" title="Copy the concatenated block">
                  <i class="ph" :class="bundleCopied ? 'ph-check' : 'ph-copy'"></i>Copy
                </button>
                <button @click="download()" class="btn btn-xs btn-ghost gap-1" title="Download the concatenated block">
                  <i class="ph ph-download-simple"></i>Download
                </button>
              </div>
            </div>

            <template x-if="outTab === 'bundle'">
              <div class="flex flex-col gap-2">
                <div x-show="bundleBusy" class="flex justify-center py-6">
                  <span class="loading loading-dots loading-sm opacity-30"></span>
                </div>
                <div x-show="!bundleBusy && bundleText"
                     class="overflow-auto font-mono text-[11px] leading-snug border border-base-300 rounded p-2 bg-base-200/40 max-h-[40vh] whitespace-pre"
                     x-text="bundleText"></div>
              </div>
            </template>

            <template x-if="outTab === 'diff'">
              <div class="flex flex-col gap-2">
                <!-- A and B are staged items; the ref field beside a ref item
                     overrides where that side reads from (leave blank for
                     as-staged), so picking the same file twice with one ref
                     changed is the version diff. -->
                <div class="flex flex-col sm:flex-row gap-1.5">
                  <div class="flex items-center gap-1 flex-1 min-w-0">
                    <span class="text-[10px] font-bold opacity-50 w-3 shrink-0">A</span>
                    <select x-model.number="diffA" class="select select-xs select-bordered font-mono flex-1 min-w-0">
                      <template x-for="(it, i) in items" :key="'a' + itemKey(it)">
                        <option :value="i" x-text="bundleHeader(it).replace('// === ', '')"></option>
                      </template>
                    </select>
                    <input x-show="!items[diffA]?.local" x-model="diffARef" placeholder="as staged"
                           class="input input-xs input-bordered font-mono w-20 shrink-0" title="Read A at this ref instead">
                  </div>
                  <div class="flex items-center gap-1 flex-1 min-w-0">
                    <span class="text-[10px] font-bold opacity-50 w-3 shrink-0">B</span>
                    <select x-model.number="diffB" class="select select-xs select-bordered font-mono flex-1 min-w-0">
                      <template x-for="(it, i) in items" :key="'b' + itemKey(it)">
                        <option :value="i" x-text="bundleHeader(it).replace('// === ', '')"></option>
                      </template>
                    </select>
                    <input x-show="!items[diffB]?.local" x-model="diffBRef" placeholder="as staged"
                           class="input input-xs input-bordered font-mono w-20 shrink-0" title="Read B at this ref instead">
                  </div>
                  <button @click="runDiff()" :disabled="diffBusy" class="btn btn-xs btn-primary gap-1 shrink-0">
                    <i class="ph" :class="diffBusy ? 'ph-circle-notch animate-spin' : 'ph-git-diff'"></i>Diff
                  </button>
                </div>
                <div x-show="diffRows"
                     class="overflow-auto font-mono text-[11px] leading-snug border border-base-300 rounded bg-base-200/40 max-h-[40vh] whitespace-pre">
                  <template x-for="(r, i) in (diffRows || [])" :key="i">
                    <div class="px-2"
                         :class="r.t === 'add' ? 'bg-success/15 text-success-content' : r.t === 'del' ? 'bg-error/15 text-error-content' : 'opacity-70'"
                         x-text="(r.t === 'add' ? '+ ' : r.t === 'del' ? '- ' : '  ') + r.line"></div>
                  </template>
                </div>
              </div>
            </template>
          </div>

          <div x-show="items.length" class="border border-base-300 rounded-lg bg-base-100 p-3 flex flex-col gap-2">
            <div class="text-xs font-bold opacity-70 flex items-center gap-1.5">
              <i class="ph ph-paper-plane-tilt"></i>Copy to repo
            </div>
            <!-- The destination designator: the tap-through picker in dir
                 mode. Its committed spec drives the send; there is no text
                 field (no keyboard, no iOS focus zoom). -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <div class="grow min-w-48" @path-pick="destSpec = $event.detail.spec">
                <div x-data="pathPicker({ mode: 'dir', roots: () => pickerRoots(), placeholder: 'Destination: pick a repo folder' })"></div>
              </div>
              <button @click="send()" :disabled="sending || !destSpec.trim()"
                      class="btn btn-sm gap-1" :class="sendArmed ? 'btn-error' : 'btn-primary'">
                <i class="ph" :class="sending ? 'ph-circle-notch animate-spin' : 'ph-paper-plane-tilt'"></i>
                <span x-text="sendLabel"></span>
              </button>
            </div>

            <!-- Save stage: persisting the ref list is explicit about WHERE it
                 lands — a stage is nobody's property, so saving one means
                 naming the manifest that holds it. Defaults to the registry
                 repo, the natural home for a general (non-repo-specific)
                 staging. -->
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-1.5">
                <input x-model="saveTarget" placeholder="owner/repo"
                       class="input input-xs input-bordered font-mono w-52" :disabled="savingStage">
                <button @click="save()" :disabled="savingStage || !saveTarget.trim()"
                        class="btn btn-ghost btn-xs gap-1 opacity-70 hover:opacity-100"
                        title="Write the staged ref list to that repo's .web-tools.json (local files excluded)">
                  <i class="ph" :class="savingStage ? 'ph-circle-notch animate-spin' : 'ph-push-pin'"></i>Save stage
                </button>
              </div>
              <span class="text-[10px] font-mono opacity-60 truncate" x-text="sendStatus"></span>
            </div>
          </div>
        </div>`,

      destSpec: '',
      preview: null,       // { name, text, href } — the inline viewer's content
      saveTarget: '',
      recent: [],          // [{repo, ref, path, date}] merged across root repos
      recentOpen: true,    // header toggles; the list scrolls inside its box
      recentLoading: false,
      _recentLoaded: false,
      finderTab: 'recent', // 'recent' | 'search'
      excluded: {},        // repo -> true, the pills' multi-select exclusions
      searchQ: '',
      treesLoading: false,
      _treePaths: null,    // {repo: [path…]} — one recursive tree per root repo
      outTab: 'bundle',    // 'bundle' | 'diff' — the output box's two lenses
      diffA: 0, diffB: 0,  // staged-item indexes for the compare
      diffARef: '', diffBRef: '',   // optional ref overrides (version diff)
      diffRows: null,      // [{t:'ctx'|'add'|'del', line}] | null
      diffStat: '',
      diffBusy: false,
      sending: false,
      sendArmed: false,
      sendStatus: '',
      savingStage: false,
      linkCopied: false,
      // The concatenated block and its content cache (keyed by itemKey, so a
      // remove/re-add never refetches). Rebuilt whenever the stage changes.
      bundleText: '',
      bundleBusy: false,
      bundleCopied: false,
      _cache: {},

      init() {
        this.$root.__stager = this;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
        // A general staging saves to the registry by default; the field stays
        // editable for a repo-specific one.
        this.saveTarget = window.__shell?.REGISTRY_REPO || '';
        // The Recent sweep costs a handful of API calls per root repo, so it
        // waits for the stage to actually be shown (the stager mounts hidden
        // behind x-show at page load), then caches until refreshed.
        const whenShown = () => { if (window.__shell?.view === 'stage') this.loadRecent(); };
        this.$watch(() => window.__shell?.view, whenShown);
        whenShown();
        // The repo's .web-tools.json manifest (probed by the shell) can carry
        // a durable staged-files list; fold it in whenever a config lands.
        this.$watch(() => Alpine.store('browser').config, cfg => this.seedStage(cfg));
        this.seedStage(Alpine.store('browser').config);
        // Keep the concatenated block in step with the stage. Newly-added
        // items fetch once (cache); removed items just drop out of the join.
        this.$watch(() => this.items.map(it => this.itemKey(it)).join('|'), () => this.ensureBundle());
        this.ensureBundle();
      },

      get items() {
        return Alpine.store('browser').stage || [];
      },
      // Ref items (repo/ref/path) vs local (dropped) items, split for the two
      // renderers and the two deposit paths.
      get refItems() { return this.items.filter(it => !it.local); },
      get localItems() { return this.items.filter(it => it.local); },
      get groups() {
        const map = new Map();
        for (const it of this.refItems) {
          const key = it.repo + (it.ref ? '@' + it.ref : '');
          if (!map.has(key)) map.set(key, { key, repo: it.repo, ref: it.ref || '', items: [] });
          map.get(key).items.push(it);
        }
        return [...map.values()];
      },
      get targets() {
        return Alpine.store('browser').config?.stage?.targets || [];
      },
      get sendLabel() {
        return this.sending ? 'Sending…' : this.sendArmed ? 'Sure?' : 'Copy';
      },
      get bundleStat() {
        if (!this.bundleText) return '';
        const kb = (new Blob([this.bundleText]).size / 1024).toFixed(1);
        return this.items.length + ' file' + (this.items.length === 1 ? '' : 's') + ' · ' + kb + ' KB';
      },

      fmtSize(n) {
        if (n < 1024) return n + ' B';
        if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1048576).toFixed(1) + ' MB';
      },

      itemKey(it) {
        return it.local ? 'local:' + it.id : window.StageLink.fmtItem(it);
      },
      // The label a bundle block carries; local items have no ref to name.
      bundleHeader(it) {
        return it.local ? '(local) ' + it.name : this.itemKey(it);
      },

      // A file (or pasted text) arrived from the drop-zone. A file becomes a
      // local stage item holding its bytes. Pasted text that reads entirely as
      // stage refs (one per line) stages those refs instead; anything else is
      // held as a local text item.
      onDropped(d) {
        const s = Alpine.store('browser');
        if (d.file || d.name) {
          s.stage = [...this.items, {
            local: true, id: ++seq, name: d.name, path: d.name,
            size: d.size, type: d.type, isText: false, bytes: d.bytes, buf: d.buf,
          }];
          return;
        }
        if (d.text != null) {
          const lines = String(d.text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const refs = lines.map(l => window.StageLink.parseItem(l)).filter(Boolean);
          if (lines.length && refs.length === lines.length) {
            const seen = new Set(this.items.map(it => this.itemKey(it)));
            const fresh = refs.filter(r => !seen.has(window.StageLink.fmtItem(r)));
            if (fresh.length) s.stage = [...this.items, ...fresh];
            return;
          }
          s.stage = [...this.items, {
            local: true, id: ++seq, name: 'pasted.txt', path: 'pasted.txt',
            size: d.size, type: 'text/plain', isText: true, text: d.text,
          }];
        }
      },

      // A GH instance pointed at a repo. ref '' rides through: the API treats an
      // empty ref param as the default branch. Used for both source reads and
      // destination writes (save/saveBytes ignore ref, landing on default).
      srcGh(repo, ref) {
        const base = Alpine.store('browser').gh;
        const inst = new base.constructor({ token: base.token, repo });
        inst.ref = ref || '';
        return inst;
      },

      // Manifest seeding: entries are bare paths ("lib/foo.js", this repo at
      // its default branch) or qualified refs ("owner/repo[@ref]:path"). Only
      // an empty stage is seeded: a working set the user built wins. The
      // destination field is left empty on purpose (empty dir = root); targets
      // stay as datalist suggestions.
      seedStage(cfg) {
        const s = Alpine.store('browser');
        const files = cfg?.stage?.files;
        if (!Array.isArray(files) || !files.length || this.items.length) return;
        s.stage = files
          .map(f => window.StageLink.parseItem(f) || (typeof f === 'string' && f.trim() ? { repo: s.repo, ref: '', path: f.trim() } : null))
          .filter(Boolean);
      },

      rm(it) {
        const s = Alpine.store('browser');
        const key = this.itemKey(it);
        s.stage = s.stage.filter(x => this.itemKey(x) !== key);
      },
      clearAll() {
        Alpine.store('browser').stage = [];
      },

      // Preview a staged item inline. The stage is estate-context, so this
      // never routes through a repo's Files view: a ref loads from its origin
      // (with a GitHub jump-over in the header); a local text item shows its
      // held text; a local binary can't be previewed, so say so.
      async view(it) {
        const toast = Alpine.store('toast');
        if (it.local) {
          if (it.isText) {
            this.preview = { name: it.name, text: fmt(it.text || ''), href: '' };
          } else {
            toast('file-dashed', it.name + ' is binary (' + this.fmtSize(it.size) + '); staged for copy, not preview', 'alert-info', 4000);
          }
          return;
        }
        try {
          const res = await this.srcGh(it.repo, it.ref).get(it.path);
          this.preview = {
            name: this.itemKey(it), text: fmt(res.text),
            href: 'https://github.com/' + it.repo + '/blob/' + (it.ref || 'HEAD') + '/' + it.path,
          };
        } catch (e) {
          toast('warning', 'Could not load ' + it.path + ': ' + (e.message || e), 'alert-error', 5000);
        }
      },

      // Recent committed files across the estate's root repos, so the latest
      // thing is one tap from staged. One recentFiles() sweep per repo (a
      // commits list plus a batch of commit details, the PR #214 machinery),
      // run in parallel; a repo that fails just contributes nothing.
      async loadRecent(force) {
        if (this.recentLoading || (this._recentLoaded && !force)) return;
        this._recentLoaded = true;
        this.recentLoading = true;
        const repos = [...new Set(this.pickerRoots().map(r => r.repo))].slice(0, 4);
        const lists = await Promise.all(repos.map(async repo => {
          try {
            const files = await this.srcGh(repo, 'HEAD').recentFiles(12);
            return files.map(f => ({ repo, ref: '', path: f.path, date: f.date }));
          } catch { return []; }
        }));
        this.recent = lists.flat()
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          .slice(0, 48);
        this.recentLoading = false;
      },
      recentStaged(it) {
        const key = window.StageLink.fmtItem({ repo: it.repo, ref: '', path: it.path });
        return this.items.some(x => this.itemKey(x) === key);
      },
      // Tap to stage, tap again to unstage: the row is the whole affordance.
      toggleRecent(it) {
        if (this.recentStaged(it)) this.rm({ repo: it.repo, ref: '', path: it.path });
        else this.grab({ repo: it.repo, ref: '', path: it.path });
      },
      baseName(p) { return (p || '').split('/').pop(); },
      // "web-tools · lib/alpineComponents": repo short name, then the folder.
      whereFrom(it) {
        const repo = (it.repo || '').split('/').pop();
        const dir = it.path.includes('/') ? it.path.slice(0, it.path.lastIndexOf('/')) : '';
        return repo + (dir ? ' · ' + dir : '');
      },
      ago(d) {
        if (!d) return '';
        const gh = Alpine.store('browser').gh;
        if (gh?.ago) return gh.ago(d);
        const s = (Date.now() - new Date(d).getTime()) / 1000;
        if (!isFinite(s)) return '';
        for (const [v, u] of [[86400 * 365, 'y'], [86400 * 30, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm']]) {
          if (s >= v) return Math.floor(s / v) + u + ' ago';
        }
        return 'now';
      },

      // Pills: the repos present in Recent, with counts; tapping one toggles
      // its exclusion (multi-select, everything included by default).
      repoPills() {
        const counts = new Map();
        for (const it of this.recent) counts.set(it.repo, (counts.get(it.repo) || 0) + 1);
        return [...counts.entries()].map(([repo, n]) => ({ repo, n }));
      },
      togglePill(repo) {
        this.excluded = { ...this.excluded, [repo]: !this.excluded[repo] };
      },

      // Search: filename-contains over the root repos' full trees. One
      // recursive-tree call per repo, fetched when the Search tab is first
      // opened and cached; matching is then pure local string work per
      // keystroke, no API calls.
      async ensureTrees() {
        if (this._treePaths || this.treesLoading) return;
        this.treesLoading = true;
        const repos = [...new Set(this.pickerRoots().map(r => r.repo))].slice(0, 4);
        const out = {};
        await Promise.all(repos.map(async repo => {
          try {
            const res = await this.srcGh(repo, 'HEAD').req('git/trees/HEAD?recursive=1');
            out[repo] = (res.tree || []).filter(e => e.type === 'blob').map(e => e.path);
          } catch { out[repo] = []; }
        }));
        this._treePaths = out;
        this.treesLoading = false;
      },
      // The finder's rows: Recent filtered by the pills, or search hits.
      finderRows() {
        if (this.finderTab === 'recent') return this.recent.filter(it => !this.excluded[it.repo]);
        const q = this.searchQ.trim().toLowerCase();
        if (q.length < 2 || !this._treePaths) return [];
        const hits = [];
        for (const [repo, paths] of Object.entries(this._treePaths)) {
          for (const path of paths) {
            if (path.toLowerCase().includes(q)) {
              hits.push({ repo, ref: '', path });
              if (hits.length >= 50) return hits;
            }
          }
        }
        return hits;
      },

      // A file chosen in the grab picker joins the stage (deduped by key).
      grab(d) {
        if (!d || !d.repo || !d.path) return;
        const it = { repo: d.repo, ref: d.ref || '', path: d.path };
        const key = window.StageLink.fmtItem(it);
        if (this.items.some(x => this.itemKey(x) === key)) {
          return Alpine.store('toast')('stack', d.path + ' is already staged', 'alert-info', 2000);
        }
        Alpine.store('browser').stage = [...this.items, it];
        Alpine.store('toast')('plus-circle', 'Staged ' + d.path, 'alert-success', 2000);
      },

      // The repo set both pickers open at: the open repo (if any), the estate's
      // quick links, then configured transfer targets, deduped. Estate-level on
      // purpose: the stage belongs to no repo, so its reach is the estate.
      pickerRoots() {
        const s = Alpine.store('browser');
        const seen = new Set();
        const roots = [];
        const add = (repo, ref) => {
          if (!repo) return;
          const key = repo + '@' + (ref || '');
          if (seen.has(key)) return;
          seen.add(key);
          roots.push({ repo, ref: ref || '' });
        };
        add(s.repo, '');
        for (const q of (window.__shell?.quickLinks || [])) add(q.repo, '');
        for (const t of this.targets) {
          const d = this.parseDest(t);
          if (d) add(d.repo, d.ref);
        }
        return roots;
      },

      copyLink() {
        const refs = this.refItems;
        if (!refs.length) {
          return Alpine.store('toast')('warning', 'Nothing to link: local files can\'t ride a #stage= link, use Copy to repo', 'alert-error', 5000);
        }
        const url = window.StageLink.mint(refs, location.origin + location.pathname);
        navigator.clipboard.writeText(url);
        this.linkCopied = true;
        setTimeout(() => { this.linkCopied = false; }, 1500);
        const note = this.localItems.length ? ' (local files excluded)' : '';
        Alpine.store('toast')('link', 'Stage link copied' + note, 'alert-success', 2500);
      },

      // The staged files spliced into one block, each under a `// === key ===`
      // header. Refs fetch (cached per item, so only new refs hit the network);
      // local text is inlined; a local binary shows a note, not bytes.
      async ensureBundle(force) {
        if (!this.items.length) { this.bundleText = ''; return; }
        this.bundleBusy = true;
        const parts = await Promise.all(this.items.map(async it => {
          const k = this.itemKey(it);
          let content;
          if (it.local) {
            content = it.isText ? (it.text || '') : '// (binary — ' + this.fmtSize(it.size) + ', staged for copy)';
          } else {
            if (force || this._cache[k] == null) {
              try { this._cache[k] = fmt((await this.srcGh(it.repo, it.ref).get(it.path)).text); }
              catch (e) { this._cache[k] = '// ERROR: ' + (e.message || e); }
            }
            content = this._cache[k];
          }
          return '// === ' + this.bundleHeader(it) + ' ===\n' + content;
        }));
        this.bundleText = parts.join('\n\n');
        this.bundleBusy = false;
      },
      async rebuild() {
        this._cache = {};
        await this.ensureBundle(true);
      },
      async copyBundle() {
        if (!this.items.length) return;
        if (this.bundleBusy || !this.bundleText) await this.ensureBundle();
        try {
          await navigator.clipboard.writeText(this.bundleText);
          this.bundleCopied = true;
          setTimeout(() => { this.bundleCopied = false; }, 1500);
          Alpine.store('toast')('copy', 'Copied ' + this.items.length + ' file' + (this.items.length === 1 ? '' : 's') + ' as text', 'alert-success', 2500);
        } catch (e) {
          Alpine.store('toast')('warning', 'Copy failed: ' + (e.message || e), 'alert-error', 5000);
        }
      },
      async download() {
        if (!this.items.length) return;
        if (this.bundleBusy || !this.bundleText) await this.ensureBundle();
        const blob = new Blob([this.bundleText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'stage-bundle.txt';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        Alpine.store('toast')('download-simple', 'Downloaded stage-bundle.txt', 'alert-success', 2500);
      },

      // "owner/repo", "owner/repo:dir", or "owner/repo@ref:dir". No dir = root.
      parseDest(spec) {
        const m = spec.trim().match(/^([\w.-]+\/[\w.-]+?)(?:@([\w./-]+))?(?::(.*))?$/);
        return m ? { repo: m[1], ref: m[2] || '', dir: (m[3] || '').trim() } : null;
      },

      // A plain line diff: common prefix/suffix trimmed, LCS over the middle.
      // Returns [{t:'ctx'|'add'|'del', line}], or null when the middle is too
      // large to DP over (the caller reports rather than freezing the page).
      diffLines(aText, bText) {
        const a = String(aText).split('\n'), b = String(bText).split('\n');
        let pre = 0;
        while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
        let suf = 0;
        while (suf < a.length - pre && suf < b.length - pre &&
               a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
        const am = a.slice(pre, a.length - suf), bm = b.slice(pre, b.length - suf);
        const n = am.length, m = bm.length;
        if (n * m > 4000000) return null;
        const w = m + 1;
        const dp = new Uint32Array((n + 1) * w);
        for (let i = n - 1; i >= 0; i--) {
          for (let j = m - 1; j >= 0; j--) {
            dp[i * w + j] = am[i] === bm[j]
              ? dp[(i + 1) * w + j + 1] + 1
              : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
          }
        }
        const rows = [];
        for (let k = 0; k < pre; k++) rows.push({ t: 'ctx', line: a[k] });
        let i = 0, j = 0;
        while (i < n && j < m) {
          if (am[i] === bm[j]) { rows.push({ t: 'ctx', line: am[i] }); i++; j++; }
          else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) rows.push({ t: 'del', line: am[i++] });
          else rows.push({ t: 'add', line: bm[j++] });
        }
        while (i < n) rows.push({ t: 'del', line: am[i++] });
        while (j < m) rows.push({ t: 'add', line: bm[j++] });
        for (let k = a.length - suf; k < a.length; k++) rows.push({ t: 'ctx', line: a[k] });
        return rows;
      },
      // One side of the compare: a local text item reads its held text; a ref
      // reads from its origin, or from the override ref when one is given
      // (that override is what makes same-file-twice a version diff).
      async diffSide(it, refOverride) {
        if (!it) throw new Error('nothing selected');
        if (it.local) {
          if (!it.isText) throw new Error(it.name + ' is binary');
          return it.text || '';
        }
        const ref = (refOverride || '').trim() || it.ref;
        return fmt((await this.srcGh(it.repo, ref).get(it.path)).text);
      },
      async runDiff() {
        if (this.diffBusy) return;
        const toast = Alpine.store('toast');
        this.diffBusy = true;
        try {
          const [a, b] = await Promise.all([
            this.diffSide(this.items[this.diffA], this.diffARef),
            this.diffSide(this.items[this.diffB], this.diffBRef),
          ]);
          const rows = this.diffLines(a, b);
          if (!rows) throw new Error('files too large to diff');
          this.diffRows = rows;
          const add = rows.filter(r => r.t === 'add').length;
          const del = rows.filter(r => r.t === 'del').length;
          this.diffStat = (add || del) ? ('+' + add + ' \u2212' + del) : 'identical';
        } catch (e) {
          this.diffRows = null;
          this.diffStat = '';
          toast('warning', 'Diff failed: ' + (e.message || e), 'alert-error', 5000);
        }
        this.diffBusy = false;
      },

      // Two-tap confirm: first tap arms for 3s, second deposits. Cross-repo
      // write with the viewer's token, so the extra gesture stays deliberate.
      // Refs copy grouped by source repo@ref via gh.copyTo; local files write
      // their held bytes via gh.saveBytes/save. Both land in dest.dir (root when
      // empty) under their basenames, on the destination's default branch.
      async send() {
        if (this.sending || !this.items.length) return;
        const toast = Alpine.store('toast');
        const dest = this.parseDest(this.destSpec);
        if (!dest) return toast('warning', 'Destination must be owner/repo, owner/repo:dir, or owner/repo@ref:dir', 'alert-error', 5000);
        // A ref copying onto itself (same repo/ref, no dir) is a no-op guard;
        // local files have no source, so they never trip it.
        const selfCopies = this.refItems.filter(it =>
          it.repo === dest.repo && !dest.dir && (dest.ref || '') === (it.ref || ''));
        if (selfCopies.length) {
          return toast('warning', selfCopies.length + ' staged file' + (selfCopies.length === 1 ? '' : 's') + ' would copy onto themselves — add a :dir or @ref', 'alert-error', 5000);
        }
        if (!this.sendArmed) {
          this.sendArmed = true;
          setTimeout(() => { this.sendArmed = false; }, 3000);
          return;
        }
        this.sendArmed = false;
        this.sending = true;
        this.sendStatus = '';
        try {
          const gh = Alpine.store('browser').gh;
          if (this.groups.length && !gh.copyTo) await window.gh?.load('gh-transfer.js');
          if (this.groups.length && !gh.copyTo) throw new Error('gh-transfer.js unavailable');
          if (this.localItems.length && !gh.saveBytes) await window.gh?.load('gh-store.js');
          if (this.localItems.length && !gh.saveBytes) throw new Error('gh-store.js unavailable');
          const total = this.items.length;
          let done = 0;
          const failures = [];
          // Refs: one grouped copyTo per source repo@ref.
          for (const g of this.groups) {
            const src = this.srcGh(g.repo, g.ref);
            const res = await src.copyTo(dest, g.items.map(i => i.path), {
              onProgress: (d) => {
                this.sendStatus = 'copying ' + Math.min(done + d + 1, total) + '/' + total + '…';
              }
            });
            done += g.items.length;
            failures.push(...res.filter(r => r.status === 'error'));
          }
          // Local files: write held bytes/text into dest.dir.
          if (this.localItems.length) {
            const destGh = this.srcGh(dest.repo, dest.ref);
            for (const it of this.localItems) {
              const path = joinDir(dest.dir, it.name);
              const msg = 'Add ' + path + ' via show-repo';
              try {
                if (it.isText) await destGh.save(path, it.text, msg);
                else await destGh.saveBytes(path, it.bytes, msg);
                done++;
                this.sendStatus = 'copying ' + Math.min(done, total) + '/' + total + '…';
              } catch (e) {
                failures.push({ path, status: 'error', error: e });
              }
            }
          }
          const ok = total - failures.length;
          this.sendStatus = ok + '/' + total + ' copied to ' + dest.repo + (dest.dir ? ':' + dest.dir : '');
          if (failures.length) {
            console.warn('copy failures:', failures);
            toast('warning', failures.length + ' file' + (failures.length === 1 ? '' : 's') + ' failed — see console', 'alert-error', 6000);
          } else {
            toast('paper-plane-tilt', 'Copied ' + ok + ' file' + (ok === 1 ? '' : 's') + ' to ' + dest.repo, 'alert-success', 4000);
          }
        } catch (e) {
          this.sendStatus = '';
          toast('warning', 'Copy failed: ' + (e.message || e), 'alert-error', 6000);
        }
        this.sending = false;
      },

      // Persist the staged REFS as stage.files in the NAMED repo's manifest,
      // merging into whatever else its .web-tools.json declares. The stage is
      // estate-level, so saving one means saying where: the registry by
      // default (a general staging, no repo's property), or any repo the field
      // names. Local files can't serialize, so they are dropped from the saved
      // list. Items already in the target repo at its default branch save as
      // bare paths (backward compatible); everything else fully qualified.
      // Explicit gesture, one commit; lands on the target's default branch.
      async save() {
        if (this.savingStage) return;
        const toast = Alpine.store('toast');
        const s = Alpine.store('browser');
        const target = (this.saveTarget || '').trim();
        if (!/^[\w.-]+\/[\w.-]+$/.test(target)) {
          return toast('warning', 'Save target must be owner/repo', 'alert-error', 4000);
        }
        this.savingStage = true;
        try {
          if (!s.gh.save) await window.gh?.load('gh-store.js');
          if (!s.gh.save) throw new Error('gh-store.js unavailable');
          const dst = this.srcGh(target, '');
          let cfg = {};
          // SUNSET(2026-08-15): the '.show-repo.json' entry is the legacy-name
          // read fallback; drop it once consumer repos are migrated.
          for (const name of ['.web-tools.json', '.show-repo.json']) {
            try { cfg = JSON.parse((await dst.get(name)).text); break; } catch {}
          }
          cfg.stage = {
            ...(cfg.stage || {}),
            files: this.refItems.map(it =>
              (it.repo === target && !it.ref) ? it.path : this.itemKey(it))
          };
          await dst.save('.web-tools.json', cfg, 'Update staged files via show-repo');
          if (target === s.repo) s.config = cfg;
          const note = this.localItems.length ? ' (local files not saved)' : '';
          toast('push-pin', 'Stage saved to ' + target + note, 'alert-success', 3000);
        } catch (e) {
          toast('warning', 'Save failed: ' + (e.message || e), 'alert-error', 6000);
        }
        this.savingStage = false;
      }
    };
  });
});
