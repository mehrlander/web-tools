// The stage: a cross-repo fileset staged for action (view, copy out, send to
// a repo), presented as its own main-area view in show-repo. The link is the
// transport: a #stage= fragment names a set of refs and opens the view
// preloaded with them. Content stays behind the viewer's token; the link
// carries only refs. (A content-carrying #gz= bundle form for token-less
// contexts is a contemplated follow-up, not built here.)
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

    return {
      description: 'The staged fileset as a main-area view: grouped by source repo@ref, with view/remove per file and send/save/mint actions',

      template: `
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <h2 class="text-lg font-bold flex items-center gap-2">
              <i class="ph ph-stack"></i>Stage
              <span class="badge badge-ghost" x-text="items.length"></span>
            </h2>
            <div class="flex items-center gap-1" x-show="items.length">
              <button @click="copyLink()" class="btn btn-xs btn-ghost gap-1"
                      title="Copy a link that reopens this stage">
                <i class="ph" :class="linkCopied ? 'ph-check' : 'ph-link'"></i>Copy link
              </button>
              <button @click="copyText()" :disabled="textBusy" class="btn btn-xs btn-ghost gap-1"
                      title="Copy all staged files as one text block">
                <i class="ph" :class="textCopied ? 'ph-check' : (textBusy ? 'ph-circle-notch animate-spin' : 'ph-copy')"></i>Copy text
              </button>
              <button @click="clearAll()" class="btn btn-xs btn-ghost gap-1 hover:text-error">
                <i class="ph ph-trash"></i>Clear
              </button>
            </div>
          </div>

          <p x-show="!items.length" class="text-sm text-base-content/50">
            Nothing staged. Add files from the Files view (the
            <i class="ph ph-plus-circle"></i> on a row), open a
            <span class="font-mono">#stage=</span> link, or open a repo whose
            <span class="font-mono">.show-repo.json</span> declares
            <span class="font-mono">stage.files</span>.
          </p>

          <template x-for="g in groups" :key="g.key">
            <div class="border border-base-300 rounded-lg bg-base-100 overflow-hidden">
              <div class="px-3 py-1.5 bg-base-200/60 font-mono text-xs flex items-center gap-1.5">
                <i class="ph ph-git-branch opacity-60"></i><span x-text="g.key"></span>
                <span class="opacity-40" x-text="'· ' + g.items.length"></span>
              </div>
              <div class="divide-y divide-base-200">
                <template x-for="it in g.items" :key="itemKey(it)">
                  <div class="group flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-base-200 text-sm">
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

          <div x-show="items.length" class="border border-base-300 rounded-lg bg-base-100 p-3 flex flex-col gap-2">
            <div class="text-xs font-bold opacity-70 flex items-center gap-1.5">
              <i class="ph ph-paper-plane-tilt"></i>Copy to repo
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <input x-model="destSpec" list="stage-transfer-targets" placeholder="owner/repo:dir"
                     class="input input-sm input-bordered font-mono grow min-w-48" :disabled="sending">
              <datalist id="stage-transfer-targets">
                <template x-for="t in targets" :key="t"><option :value="t"></option></template>
              </datalist>
              <button @click="send()" :disabled="sending || !destSpec.trim()"
                      class="btn btn-sm gap-1" :class="sendArmed ? 'btn-error' : 'btn-primary'">
                <i class="ph" :class="sending ? 'ph-circle-notch animate-spin' : 'ph-paper-plane-tilt'"></i>
                <span x-text="sendLabel"></span>
              </button>
            </div>
            <div class="flex items-center justify-between gap-2">
              <button @click="save()" :disabled="savingStage"
                      class="btn btn-ghost btn-xs gap-1 opacity-70 hover:opacity-100"
                      title="Write the staged list to .show-repo.json in the open repo">
                <i class="ph" :class="savingStage ? 'ph-circle-notch animate-spin' : 'ph-push-pin'"></i>Save stage
              </button>
              <span class="text-[10px] font-mono opacity-60 truncate" x-text="sendStatus"></span>
            </div>
          </div>
        </div>`,

      destSpec: '',
      sending: false,
      sendArmed: false,
      sendStatus: '',
      savingStage: false,
      linkCopied: false,
      textCopied: false,
      textBusy: false,

      init() {
        this.$root.__stager = this;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
        // The repo's .show-repo.json manifest (probed by the shell) can carry
        // a durable staged-files list; fold it in whenever a config lands.
        this.$watch(() => Alpine.store('browser').config, cfg => this.seedStage(cfg));
        this.seedStage(Alpine.store('browser').config);
      },

      get items() {
        return Alpine.store('browser').stage || [];
      },
      get groups() {
        const map = new Map();
        for (const it of this.items) {
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

      itemKey(it) {
        return window.StageLink.fmtItem(it);
      },

      // A GH instance pointed at a staged item's origin. ref '' rides through:
      // the API treats an empty ref param as the default branch.
      srcGh(repo, ref) {
        const base = Alpine.store('browser').gh;
        const inst = new base.constructor({ token: base.token, repo });
        inst.ref = ref || '';
        return inst;
      },

      // Manifest seeding: entries are bare paths ("lib/foo.js", this repo at
      // its default branch) or qualified refs ("owner/repo[@ref]:path"). Only
      // an empty stage is seeded: a working set the user built wins.
      seedStage(cfg) {
        const s = Alpine.store('browser');
        if (!this.destSpec && cfg?.stage?.targets?.length) this.destSpec = cfg.stage.targets[0];
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

      // Open a staged file in the shared viewer (the shell flips to the Files
      // view on activeFile). origin rides along so the viewer's external links
      // point at the file's true home, not the open repo.
      async view(it) {
        const s = Alpine.store('browser');
        const toast = Alpine.store('toast');
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
        const url = window.StageLink.mint(this.items, location.origin + location.pathname);
        navigator.clipboard.writeText(url);
        this.linkCopied = true;
        setTimeout(() => { this.linkCopied = false; }, 1500);
        Alpine.store('toast')('link', 'Stage link copied', 'alert-success', 2500);
      },

      async copyText() {
        if (this.textBusy || !this.items.length) return;
        this.textBusy = true;
        try {
          const parts = await Promise.all(this.items.map(async it => {
            try {
              return '// === ' + this.itemKey(it) + ' ===\n' + fmt((await this.srcGh(it.repo, it.ref).get(it.path)).text);
            } catch (e) {
              return '// ERROR ' + this.itemKey(it) + ': ' + (e.message || e);
            }
          }));
          await navigator.clipboard.writeText(parts.join('\n\n'));
          this.textCopied = true;
          setTimeout(() => { this.textCopied = false; }, 1500);
          Alpine.store('toast')('copy', 'Copied ' + this.items.length + ' file' + (this.items.length === 1 ? '' : 's') + ' as text', 'alert-success', 2500);
        } catch (e) {
          Alpine.store('toast')('warning', 'Copy failed: ' + (e.message || e), 'alert-error', 5000);
        }
        this.textBusy = false;
      },

      // "owner/repo", "owner/repo:dir", or "owner/repo@ref:dir".
      parseDest(spec) {
        const m = spec.trim().match(/^([\w.-]+\/[\w.-]+?)(?:@([\w./-]+))?(?::(.*))?$/);
        return m ? { repo: m[1], ref: m[2] || '', dir: (m[3] || '').trim() } : null;
      },

      // Two-tap confirm: first tap arms for 3s, second sends. Cross-repo write
      // with the viewer's token, so the extra gesture stays deliberate. Items
      // are grouped by source repo@ref; each group copies via gh.copyTo
      // (gh-transfer.js, lazy-loaded on first use).
      async send() {
        if (this.sending || !this.items.length) return;
        const toast = Alpine.store('toast');
        const dest = this.parseDest(this.destSpec);
        if (!dest) return toast('warning', 'Destination must be owner/repo, owner/repo:dir, or owner/repo@ref:dir', 'alert-error', 5000);
        const selfCopies = this.items.filter(it =>
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
          if (!gh.copyTo) await window.gh?.load('gh-transfer.js');
          if (!gh.copyTo) throw new Error('gh-transfer.js unavailable');
          const total = this.items.length;
          let done = 0;
          const failures = [];
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

      // Persist the stage as the open repo's stage.files, merging into whatever
      // else .show-repo.json already declares. Same-repo default-branch items
      // save as bare paths (backward compatible); everything else saves
      // qualified ("owner/repo[@ref]:path"). Explicit gesture, one commit;
      // lands on the repo's default branch (the Contents API default).
      async save() {
        if (this.savingStage) return;
        const toast = Alpine.store('toast');
        const s = Alpine.store('browser');
        this.savingStage = true;
        try {
          if (!s.gh.save) await window.gh?.load('gh-store.js');
          if (!s.gh.save) throw new Error('gh-store.js unavailable');
          let cfg = {};
          try { cfg = JSON.parse((await s.gh.get('.show-repo.json')).text); } catch {}
          cfg.stage = {
            ...(cfg.stage || {}),
            files: this.items.map(it =>
              (it.repo === s.repo && !it.ref) ? it.path : this.itemKey(it))
          };
          await s.gh.save('.show-repo.json', cfg, 'Update staged files via show-repo');
          s.config = cfg;
          toast('push-pin', 'Stage saved to .show-repo.json', 'alert-success', 3000);
        } catch (e) {
          toast('warning', 'Save failed: ' + (e.message || e), 'alert-error', 6000);
        }
        this.savingStage = false;
      }
    };
  });
});
