// alpineComponents/file-browser.js — the Files view of a project or a repo.
//
// A folder's tree beside the file it opens: the tap-through picker
// (path-picker.js) inline and based at the folder, so the crumbs start at the
// project or the repo and cannot climb out of it, and the shared reader
// (viewer.js) for the picked file. The same two parts the Stage and the fab's
// Render tab already use; this file only places them side by side.
//
// Browsing and searching are separate surfaces again. The Search view
// (search-view.js) finds files across repos and records by name, by content,
// in sessions and in chats; this view walks one scope's tree. A wide pane
// shows both columns; a narrow one shows the tree, then the file in its place
// with a way back.
//
//   <div x-data="fileBrowser({ repo, ref, dir, start, file })"></div>
//
// `dir` is the folder the tree is based at ('' for the repo root), and the
// crumbs never climb above it. `start` is a folder under it to open on.
// `file`, a path inside the repo, opens on mount. The host remounts the
// component for a new scope; nothing here follows a scope change.
const registerFileBrowser = function() {
  Alpine.data('fileBrowser', function(opts) {
    const cfg = opts || {};
    return {
      // Prefixed, not bare: an x-data expression resolves a bare name against
      // every registered component first, and `repo` is one (repo.js), so
      // `base: { repo: repo }` handed the picker a function. fab.js hit the same.
      fbRepo: cfg.repo || '', fbRef: cfg.ref || '', fbDir: cfg.dir || '', fbStart: cfg.start || '',
      file: '', busy: false, note: '',
      _gen: 0,

      template: `
        <div class="@container h-full min-h-0" data-file-browser>
          <div class="grid h-full min-h-0 gap-4 @3xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <div class="min-h-0 h-[70vh] @3xl:h-full" :class="file ? 'hidden @3xl:block' : 'block'"
                 @path-pick="open($event.detail.path)">
              <div class="h-full" x-data="pathPicker({ inline: true, trigger: false, base: { repo: fbRepo, ref: fbRef, dir: fbDir }, start: fbStart })"></div>
            </div>
            <div class="min-w-0 min-h-0 flex flex-col" :class="file ? 'flex' : 'hidden @3xl:flex'">
              <button x-show="file" @click="file = ''" class="btn btn-ghost btn-sm gap-1 self-start mb-2 @3xl:hidden">
                <i class="ph ph-arrow-left text-base"></i>Files</button>
              <p x-show="!file" class="text-base-content/40 italic text-base py-8">Pick a file to read it.</p>
              <div x-show="busy" class="flex justify-center py-16"><span class="loading loading-dots loading-md opacity-30"></span></div>
              <p x-show="note" class="text-base text-error py-4" x-text="note"></p>
              <div x-show="file && !busy && !note" class="min-w-0" data-file-viewer
                   x-data="viewer({ bindStore: false, defaultMode: (f) => window.ViewRegistry.READ_MODE(f) })"></div>
            </div>
          </div>
        </div>`,

      init() {
        this.$el.innerHTML = this.template;
        this.$nextTick(() => {
          if (!this.$el.isConnected) return;
          Alpine.initTree(this.$el);
          if (cfg.file) this.open(cfg.file);
        });
      },

      // One contents read, then the viewer's show(), the way the Search view
      // drives its pane. A newer pick wins over a slower older one.
      async open(path) {
        if (!path) return;
        const gen = ++this._gen;
        this.file = path; this.busy = true; this.note = '';
        // Mark it in the tree too: a file opened from the address, not by a
        // tap, would otherwise sit unmarked beside the reader showing it.
        const picker = this.$el.querySelector('[x-data^="pathPicker"]')?.__pathPicker;
        if (picker) picker.picked = path;
        try {
          const gh = new window.GH({ token: window.TOKEN, repo: this.fbRepo });
          gh.ref = this.fbRef || '';
          const res = await gh.get(path);
          if (gen !== this._gen) return;
          this.busy = false;
          await this.$nextTick();
          await this.$el.querySelector('[data-file-viewer]')?.__viewer
            ?.show(path, res.text, { repo: this.fbRepo, ref: this.fbRef || '' });
        } catch (e) {
          if (gen !== this._gen) return;
          this.busy = false;
          this.note = 'Could not load it: ' + (e?.message || e);
        }
      },
    };
  });
};
if (window.Alpine && window.Alpine.data) registerFileBrowser();
else document.addEventListener('alpine:init', registerFileBrowser);
