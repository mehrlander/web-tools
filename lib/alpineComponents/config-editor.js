document.addEventListener('alpine:init', function () {
  // Config editor for a repo's .web-tools.json manifest. Self-injecting dialog,
  // same pattern as repo.js: init() stamps the template into $el and re-inits
  // the tree, and stashes the instance on $root.__configEditor so the shell can
  // open() it for the currently-selected repo. Reads/writes go through the
  // shared browser store's gh (bound to the open repo); a save always writes
  // the new name (.web-tools.json), so editing a repo still on the legacy
  // .show-repo.json migrates it in place, no delete needed.
  Alpine.data('configEditor', function () {
    const KNOWN = [
      { k: 'icon',    d: 'Phosphor class for the header quick-link icon (e.g. "ph-scales")' },
      { k: 'landing', d: "path to the repo's own landing page, rendered live" },
      { k: 'pins',    d: 'folders/files surfaced in the sidebar Pinned block' },
      { k: 'stage',   d: '{ files, targets }: durable staged set + copy destinations' },
    ];
    const dialogHtml = `
      <dialog id="configModal" class="modal" onclick="if(event.target===this)this.close()">
        <div class="modal-box shadow-none border border-base-300 bg-base-100 p-4 max-w-xl">
          <div class="flex items-center gap-2 mb-1">
            <i class="ph ph-gear-six text-lg"></i>
            <span class="font-mono text-sm font-bold" x-text="repo"></span>
            <span class="badge badge-sm badge-ghost font-mono">.web-tools.json</span>
          </div>
          <div class="text-xs mb-3 flex items-center gap-1.5"
               :class="connected ? 'text-success' : 'text-base-content/50'">
            <i class="ph" :class="connected ? 'ph-plugs-connected' : 'ph-plugs'"></i>
            <span x-text="connected ? 'Connected — repo has a web-tools config' : 'Not yet connected — saving creates the config'"></span>
          </div>
          <div x-show="legacy" class="alert alert-warning py-1.5 px-3 text-xs mb-3 flex items-center gap-2">
            <i class="ph ph-arrow-clockwise shrink-0"></i>
            <span>Loaded from legacy <span class="font-mono">.show-repo.json</span>. Saving migrates it to <span class="font-mono">.web-tools.json</span>.</span>
          </div>
          <div x-show="offMain" class="text-[11px] text-warning mb-2 flex items-center gap-1.5">
            <i class="ph ph-git-branch shrink-0"></i>
            <span>Config is written to the default branch, not <span class="font-mono" x-text="ref"></span>.</span>
          </div>
          <textarea x-model="draft" spellcheck="false" rows="12"
            class="textarea textarea-bordered w-full font-mono text-xs leading-snug"
            :class="err && 'textarea-error'" placeholder="{ }"></textarea>
          <div class="flex items-center justify-between gap-2 mt-1 min-h-[1.25rem]">
            <span x-show="err" class="text-error text-xs flex items-center gap-1 min-w-0">
              <i class="ph ph-warning shrink-0"></i><span class="truncate" x-text="err"></span></span>
            <span x-show="!err" class="text-success text-xs flex items-center gap-1">
              <i class="ph ph-check"></i>Valid JSON</span>
            <button @click="format()" :disabled="!!err" class="btn btn-ghost btn-xs shrink-0">Format</button>
          </div>
          <details class="mt-2">
            <summary class="text-xs text-base-content/50 cursor-pointer">Known fields</summary>
            <div class="mt-1.5 flex flex-col gap-1">
              <template x-for="f in KNOWN" :key="f.k">
                <div class="text-[11px] leading-snug">
                  <span class="font-mono text-primary" x-text="f.k"></span>
                  <span class="text-base-content/40"> — </span>
                  <span class="text-base-content/60" x-text="f.d"></span>
                </div>
              </template>
            </div>
          </details>
          <div class="modal-action mt-3 gap-2">
            <button onclick="configModal.close()" class="btn btn-ghost btn-sm text-xs">Cancel</button>
            <button @click="save()" :disabled="!!err || saving" class="btn btn-primary btn-sm text-xs gap-1.5">
              <span x-show="saving" class="loading loading-spinner loading-xs"></span>
              <span x-text="saving ? 'Saving…' : 'Save'"></span>
            </button>
          </div>
        </div>
      </dialog>`;
    return {
      template: dialogHtml,
      KNOWN,
      repo: '',
      draft: '{}',
      connected: false,
      legacy: false,
      offMain: false,
      ref: '',
      saving: false,

      init() {
        this.$root.__configEditor = this;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
      },

      // JSON validity, recomputed live from the draft. Empty string = valid;
      // anything else is the message shown under the textarea.
      get err() {
        let v;
        try { v = JSON.parse(this.draft); }
        catch (e) { return String(e.message || e).replace(/^JSON\.parse:\s*/, ''); }
        if (v === null || typeof v !== 'object' || Array.isArray(v)) return 'Top-level value must be an object';
        return '';
      },

      // Populate from the currently-open repo's loaded config and show the modal.
      open() {
        const s = Alpine.store('browser');
        this.repo = s.repo || '';
        this.ref = s.ref || '';
        this.connected = !!s.config;
        this.legacy = s.configName === '.show-repo.json';
        this.offMain = !!(s.ref && s.defaultRef && s.ref !== s.defaultRef);
        this.draft = JSON.stringify(s.config || {}, null, 2);
        this.saving = false;
        try { document.getElementById('configModal').showModal(); } catch {}
      },

      format() {
        if (this.err) return;
        this.draft = JSON.stringify(JSON.parse(this.draft), null, 2);
      },

      async save() {
        if (this.err) return;
        const s = Alpine.store('browser');
        const toast = Alpine.store('toast');
        if (!s.gh) return;
        this.saving = true;
        try {
          const obj = JSON.parse(this.draft);
          const msg = this.legacy
            ? 'Migrate .show-repo.json to .web-tools.json via show-repo'
            : 'Update .web-tools.json via show-repo';
          await s.gh.save('.web-tools.json', obj, msg);
          if (toast) toast('check-circle', this.legacy ? 'Migrated to .web-tools.json' : 'Config saved', 'alert-success', 4000);
          // The shell re-reads the manifest and re-probes the pinned row so a
          // changed icon or a fresh connection lands without a reload.
          document.dispatchEvent(new CustomEvent('web-tools:config-saved', { detail: { repo: this.repo } }));
          try { document.getElementById('configModal').close(); } catch {}
        } catch (e) {
          if (toast) toast('warning', 'Save failed: ' + (e?.message || e), 'alert-error', 6000);
        } finally {
          this.saving = false;
        }
      }
    };
  });
});
