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
      picker: null,               // the inline pathPicker's instance, for the folder the deck reads
      deckOpening: false,
      _gen: 0, _deck: null, _deckFiles: null,

      template: `
        <div class="@container h-full min-h-0 flex flex-col gap-1" data-file-browser>
          <!-- One bar over both columns: the way back to the tree on a narrow
               pane, and the deck door over the folder on screen (its files one
               per slide in the house swipe deck, as the Search view reads its
               hits). The door's classes and wording are swipeDeck.entry()'s,
               held by tools/test/deck-entry-parity.test.mjs. -->
          <div x-show="file || folderFiles.length" class="flex items-center shrink-0 min-h-8">
            <button x-show="file" @click="file = ''" class="btn btn-ghost btn-sm gap-1 @3xl:hidden">
              <i class="ph ph-arrow-left text-base"></i>Files</button>
            <div class="grow"></div>
            <button x-show="folderFiles.length" @click="openDeck()" :disabled="deckOpening"
                    class="btn btn-square btn-sm max-sm:h-11 max-sm:w-11 btn-ghost text-primary"
                    :title="'Read ' + plural(folderFiles.length, 'file') + ' one at a time'">
              <span x-show="deckOpening" class="loading loading-spinner loading-xs"></span>
              <i x-show="!deckOpening" class="ph ph-cards-three text-lg max-sm:text-xl"></i></button>
          </div>
          <div class="grid grow min-h-0 gap-4 @3xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <div class="min-h-0 h-[70vh] @3xl:h-full" :class="file ? 'hidden @3xl:block' : 'block'"
                 @path-pick="open($event.detail.path)">
              <div class="h-full" x-data="pathPicker({ inline: true, trigger: false, base: { repo: fbRepo, ref: fbRef, dir: fbDir }, start: fbStart })"></div>
            </div>
            <div class="min-w-0 min-h-0 flex flex-col" :class="file ? 'flex' : 'hidden @3xl:flex'">
              <p x-show="!file" class="text-base-content/40 italic text-base py-8">Pick a file to read it.</p>
              <div x-show="busy" class="flex justify-center py-16"><span class="loading loading-dots loading-md opacity-30"></span></div>
              <p x-show="note" class="text-base text-error py-4" x-text="note"></p>
              <!-- x-show on a wrapper, not on the viewer's own element: there
                   it would read the VIEWER's own \`file\`, which is how a tapped
                   file loaded and stayed hidden. -->
              <div x-show="file && !busy && !note" class="min-w-0">
                <div class="min-w-0" data-file-viewer
                     x-data="viewer({ bindStore: false, defaultMode: (f) => window.ViewRegistry.READ_MODE(f) })"></div>
              </div>
            </div>
          </div>
        </div>`,

      init() {
        this.$el.innerHTML = this.template;
        this.$nextTick(() => {
          if (!this.$el.isConnected) return;
          Alpine.initTree(this.$el);
          this.picker = this.$el.querySelector('[x-data^="pathPicker"]')?.__pathPicker || null;
          if (cfg.file) this.open(cfg.file);
        });
      },

      plural(n, noun) { return n + ' ' + noun + (n === 1 ? '' : 's'); },
      // The files directly in the folder the tree is showing, as repo paths.
      get folderFiles() {
        const p = this.picker;
        if (!p || !p.scope.length || p.scope[0].kind !== 'repo') return [];
        const dir = p.scope.slice(1).map(n => n.name).join('/');
        return p.children().filter(n => !n.children && n.kind === 'file').map(n => (dir ? dir + '/' : '') + n.name);
      },

      // ── The deck: the folder's files, one per slide ──────────────────────
      // Opens on the file beside the tree when it is in this folder, else the
      // first. A slide is the shared viewer with one contents read, the Search
      // view's _deckRender; swiping keeps the pane on the same file.
      async openDeck() {
        if (this.deckOpening || this._deck) return;
        const files = this.folderFiles;
        if (!files.length) return;
        const at = Math.max(0, files.indexOf(this.file));
        this.deckOpening = true;
        try {
          if (!window.swipeDeck && window.gh?.load) await window.gh.load('kits/swipe-deck.js');
          if (!window.swipeDeck) throw new Error('the swipe deck kit did not load');
          this._deckFiles = files;
          const parent = window.swipeDeck.top?.() || null;
          const opts = {
            count: files.length, start: at, ...this._deckChrome(at),
            index: (i) => { const c = this._deckChrome(i); return { title: c.title, subtitle: '', icon: 'ph-file' }; },
            render: (i, slide) => this._deckRender(i, slide),
            release: (i, slide) => { slide.replaceChildren(); },
            slideScroll: false, innerClass: 'h-full w-full min-w-0', immersive: true,
            // The kit reports slides while it is still being built (slide 0
            // before the start is applied) and repeats the current one on each
            // render, so the pane follows only a built deck, and only to a new
            // file: each follow is a contents read.
            onSlide: (i) => {
              const h = this._deck, path = this._deckFiles?.[i];
              if (!h || !path) return;
              const c = this._deckChrome(i);
              h.setTitle(c.title); h.setSubtitle(c.subtitle); h.setIcon(c.icon); h.setLink(c.link);
              if (path !== this.file) this.open(path);
            },
            onClose: () => { this._deck = null; this._deckFiles = null; },
          };
          this._deck = parent ? window.swipeDeck.drill(parent, opts) : window.swipeDeck.open(opts);
          if (files[at] !== this.file) this.open(files[at]);
        } catch (e) {
          this.note = 'Could not open the deck: ' + (e?.message || e);
        } finally { this.deckOpening = false; }
      },
      _deckChrome(i) {
        const path = this._deckFiles?.[i] || '';
        const j = path.lastIndexOf('/');
        return {
          title: j < 0 ? path : path.slice(j + 1),
          subtitle: [this.fbRepo.split('/').pop() + (this.fbRef ? '@' + this.fbRef : ''), j < 0 ? '' : path.slice(0, j)].filter(Boolean).join(' · '),
          icon: 'ph-file',
          link: path ? { href: 'https://github.com/' + this.fbRepo + '/blob/' + (this.fbRef || 'HEAD') + '/' + path,
            icon: 'ph-github-logo', title: 'Open ' + path + ' on GitHub' } : null,
        };
      },
      _deckRender(i, slide) {
        const path = this._deckFiles?.[i];
        if (!path) return;
        const el = document.createElement('div');
        el.className = 'flex flex-col h-full w-full min-w-0 overflow-hidden p-3';
        el.setAttribute('x-data', 'viewer({ bindStore: false, fill: true, identify: false, '
          + 'defaultMode: (f) => window.ViewRegistry.READ_MODE(f) })');
        slide.append(el);
        window.Alpine.initTree(el);
        (async () => {
          try {
            const gh = new window.GH({ token: window.TOKEN, repo: this.fbRepo });
            gh.ref = this.fbRef || '';
            const res = await gh.get(path);
            if (el.isConnected) await el.__viewer?.show(path, res.text, { repo: this.fbRepo, ref: this.fbRef || '' });
          } catch (e) {
            if (!el.isConnected) return;
            el.remove();
            const note = document.createElement('p');
            note.className = 'text-base text-base-content/60 text-center py-16';
            note.textContent = 'Could not load it: ' + (e?.message || e);
            slide.append(note);
          }
        })();
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
