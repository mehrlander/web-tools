// The stage: a cross-repo fileset staged for action (view, copy out, send to
// a repo), presented as its own main-area view in show-repo. The link is the
// transport: a #stage= fragment names a set of refs and opens the view
// preloaded with them. Content stays behind the viewer's token; the link
// carries only refs. (A content-carrying #gz= bundle form for token-less
// contexts is a contemplated follow-up, not built here.)
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
    const dirOf = p => { const i = p.lastIndexOf('/'); return i === -1 ? '' : p.slice(0, i); };
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
                      title="Copy a link that reopens this stage (ref items only)">
                <i class="ph" :class="linkCopied ? 'ph-check' : 'ph-link'"></i>Copy link
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

          <p x-show="!items.length" class="text-sm text-base-content/50">
            Nothing staged yet. Drop a file above, add repo files from the Files
            view (the <i class="ph ph-plus-circle"></i> on a row), open a
            <span class="font-mono">#stage=</span> link, or open a repo whose
            <span class="font-mono">.web-tools.json</span> declares
            <span class="font-mono">stage.files</span>.
          </p>

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

          <!-- Concatenated bundle: the staged files spliced into one block,
               the same shape the transfer copies, for copy-out or download.
               Local binaries can't be shown as text, so they appear as a note. -->
          <div x-show="items.length" class="border border-base-300 rounded-lg bg-base-100 p-3 flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold opacity-70 flex items-center gap-1.5">
                <i class="ph ph-brackets-curly"></i>Concatenated
                <span class="opacity-60 font-normal font-mono" x-text="bundleStat"></span>
              </span>
              <div class="flex items-center gap-0.5">
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
            <div x-show="bundleBusy" class="flex justify-center py-6">
              <span class="loading loading-dots loading-sm opacity-30"></span>
            </div>
            <div x-show="!bundleBusy && bundleText"
                 class="overflow-auto font-mono text-[11px] leading-snug border border-base-300 rounded p-2 bg-base-200/40 max-h-[40vh] whitespace-pre"
                 x-text="bundleText"></div>
          </div>

          <div x-show="items.length" class="border border-base-300 rounded-lg bg-base-100 p-3 flex flex-col gap-2">
            <div class="text-xs font-bold opacity-70 flex items-center gap-1.5">
              <i class="ph ph-paper-plane-tilt"></i>Copy to repo
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <input x-model="destSpec" list="stage-transfer-targets" placeholder="owner/repo:dir (empty dir = root)"
                     class="input input-sm input-bordered font-mono grow min-w-48" :disabled="sending">
              <datalist id="stage-transfer-targets">
                <template x-for="t in targets" :key="t"><option :value="t"></option></template>
              </datalist>
              <button @click="destBrowsing = !destBrowsing" class="btn btn-sm btn-ghost gap-1"
                      :class="destBrowsing && 'text-primary'" title="Browse a repo tree to set the destination">
                <i class="ph ph-folder-open"></i>Browse
              </button>
              <button @click="send()" :disabled="sending || !destSpec.trim()"
                      class="btn btn-sm gap-1" :class="sendArmed ? 'btn-error' : 'btn-primary'">
                <i class="ph" :class="sending ? 'ph-circle-notch animate-spin' : 'ph-paper-plane-tilt'"></i>
                <span x-text="sendLabel"></span>
              </button>
            </div>

            <!-- The destination designator: a bare mention picker opened one
                 level up, at a choice of repo (the open repo plus configured
                 targets). Pick @repo, then a file inside the target folder; its
                 folder becomes the destination, the field stays editable after.
                 Mounted only while browsing (x-if), so the tree fetch is on
                 demand. -->
            <template x-if="destBrowsing">
              <div @mention-select="onDestPicked($event.detail)">
                <div x-data="mention({ bare: true, roots: destRoots(), placeholder: 'Type @ to pick a repo, then a file in the destination folder' })"></div>
              </div>
            </template>
            <div class="flex items-center justify-between gap-2">
              <button @click="save()" :disabled="savingStage"
                      class="btn btn-ghost btn-xs gap-1 opacity-70 hover:opacity-100"
                      title="Write the staged ref list to .web-tools.json in the open repo (local files excluded)">
                <i class="ph" :class="savingStage ? 'ph-circle-notch animate-spin' : 'ph-push-pin'"></i>Save stage
              </button>
              <span class="text-[10px] font-mono opacity-60 truncate" x-text="sendStatus"></span>
            </div>
          </div>
        </div>`,

      destSpec: '',
      destBrowsing: false,
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

      // Open a staged item in the shared viewer (the shell flips to the Files
      // view on activeFile). A ref loads from its origin; a local text item
      // shows its held text; a local binary can't be previewed, so say so.
      async view(it) {
        const s = Alpine.store('browser');
        const toast = Alpine.store('toast');
        if (it.local) {
          if (it.isText) {
            s.activeFile = { path: it.name, content: fmt(it.text || ''), origin: null };
          } else {
            toast('file-dashed', it.name + ' is binary (' + this.fmtSize(it.size) + '); staged for copy, not preview', 'alert-info', 4000);
          }
          return;
        }
        try {
          const sameRepo = it.repo === s.repo &&
            (it.ref || '') === (s.ref && s.ref !== s.defaultRef ? s.ref : '');
          const res = sameRepo ? await s.gh.get(it.path) : await this.srcGh(it.repo, it.ref).get(it.path);
          s.activeFile = { path: it.path, content: fmt(res.text), origin: { repo: it.repo, ref: it.ref || '' } };
        } catch (e) {
          toast('warning', 'Could not load ' + it.path + ': ' + (e.message || e), 'alert-error', 5000);
        }
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

      // The repos the destination picker offers as its top level: the open repo
      // first (copy within or out of it), then the configured transfer targets,
      // deduped by repo@ref. Empty when there is no open repo and no target.
      destRoots() {
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
        for (const t of this.targets) {
          const d = this.parseDest(t);
          if (d) add(d.repo, d.ref);
        }
        return roots;
      },

      // The picker chose a fully-qualified file {repo, ref, path}. Its folder is
      // the destination directory (files land in it under their basenames);
      // write the destSpec and close the picker. The field stays editable, so a
      // picked destination is a starting point.
      onDestPicked(sel) {
        const dir = dirOf(sel.path);
        this.destSpec = sel.repo + (sel.ref ? '@' + sel.ref : '') + (dir ? ':' + dir : '');
        this.destBrowsing = false;
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

      // Persist the staged REFS as the open repo's stage.files, merging into
      // whatever else .web-tools.json declares. Local files can't serialize, so
      // they are dropped from the saved list. Same-repo default-branch items
      // save as bare paths (backward compatible); everything else qualified.
      // Explicit gesture, one commit; lands on the repo's default branch.
      async save() {
        if (this.savingStage) return;
        const toast = Alpine.store('toast');
        const s = Alpine.store('browser');
        this.savingStage = true;
        try {
          if (!s.gh.save) await window.gh?.load('gh-store.js');
          if (!s.gh.save) throw new Error('gh-store.js unavailable');
          let cfg = {};
          // SUNSET(2026-08-15): the '.show-repo.json' entry is the legacy-name
          // read fallback; drop it once consumer repos are migrated.
          for (const name of ['.web-tools.json', '.show-repo.json']) {
            try { cfg = JSON.parse((await s.gh.get(name)).text); break; } catch {}
          }
          cfg.stage = {
            ...(cfg.stage || {}),
            files: this.refItems.map(it =>
              (it.repo === s.repo && !it.ref) ? it.path : this.itemKey(it))
          };
          await s.gh.save('.web-tools.json', cfg, 'Update staged files via show-repo');
          s.config = cfg;
          const note = this.localItems.length ? ' (local files not saved)' : '';
          toast('push-pin', 'Stage saved to .web-tools.json' + note, 'alert-success', 3000);
        } catch (e) {
          toast('warning', 'Save failed: ' + (e.message || e), 'alert-error', 6000);
        }
        this.savingStage = false;
      }
    };
  });
});
