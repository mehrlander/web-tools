// alpineComponents/file-browser.js — the Files view of a project or a repo.
//
// Split top and bottom, the branch detail's shape (branch-brief.js): the
// folder's tree on top, and below it a swiper over the files in the folder on
// screen, one slide per file in the shared reader (viewer.js). The tree is the
// tap-through picker (path-picker.js), inline and based at the scope, so its
// crumbs never climb out of the project or the repo.
//
// ONE POSITION, TWO VIEWS OF IT. A file tapped in the tree scrolls the swiper
// to it; a swipe moves the tree's selection to the file now showing. The
// header's deck door opens the same files in the full house deck, and a swipe
// there moves this position too. Browsing and searching are separate surfaces:
// the Search view (search-view.js) finds; this view walks one scope's tree.
//
//   <div x-data="fileBrowser({ repo, ref, dir, start, file })"></div>
//
// `dir` is the folder the tree is based at ('' for the repo root), and the
// crumbs never climb above it. `start` is a folder under it to open on.
// `file`, a path inside the repo, is selected on mount. The host remounts the
// component for a new scope; nothing here follows a scope change.
//
// The slides are built in plain DOM rather than an x-for, the way the deck's
// render callback builds them: a slide mounts its viewer only when the swiper
// nears it (the one in view and its neighbours, the branch detail's rule), and
// a viewer's own x-data must not shadow this component's names, which is how
// an x-show on the reader once read the viewer's `file` instead of ours.
const registerFileBrowser = function() {
  Alpine.data('fileBrowser', function(opts) {
    const cfg = opts || {};
    // The component's root, captured at init. `this.$el` inside a method is the
    // element whose handler called it: from the tree's @path-pick that is the
    // tree column, which does not contain the swiper.
    let root = null, stripFiles = [], mounted = new Set(), keyHandler = null;
    const short = p => String(p || '').split('/').pop();
    const dirOf = p => { const s = String(p || ''); const j = s.lastIndexOf('/'); return j < 0 ? '' : s.slice(0, j); };
    return {
      // Prefixed, not bare: an x-data expression resolves a bare name against
      // every registered component first, and `repo` is one (repo.js), so
      // `base: { repo: repo }` handed the picker a function. fab.js hit the same.
      fbRepo: cfg.repo || '', fbRef: cfg.ref || '', fbDir: cfg.dir || '', fbStart: cfg.start || '',
      sel: '',                    // the selected file, a repo path; '' until one is picked
      at: -1,                     // its index in the folder's files; -1 when it is not in this folder
      picker: null,               // the inline pathPicker's instance: the folder the swiper reads
      hovered: false,             // the swiper takes the arrow keys while the pointer is in it
      deckOpening: false,
      _deck: null, _deckFiles: null,

      template: `
        <div class="h-full min-h-0 flex flex-col gap-2" data-file-browser>
          <!-- The tree: the top part, scrolling on its own. -->
          <div class="min-h-0" :class="folderFiles.length ? 'basis-2/5 shrink-0' : 'flex-1'" @path-pick="pick($event.detail.path)">
            <div class="h-full" x-data="pathPicker({ inline: true, trigger: false, base: { repo: fbRepo, ref: fbRef, dir: fbDir }, start: fbStart })"></div>
          </div>

          <!-- The swiper: one header row, then the strip. Hidden for a folder
               with no files of its own, which has nothing to read. -->
          <div class="relative flex-1 min-h-0 flex flex-col rounded-box border border-base-300 bg-base-100 overflow-hidden"
               :class="!folderFiles.length && 'hidden'"
               @pointerenter="hovered = true" @pointerleave="hovered = false" @pointerdown="hovered = true">
            <div class="flex items-center gap-1 shrink-0 pl-2 pr-0.5 py-0.5 bg-base-200 border-b border-base-300">
              <div x-show="at >= 0" class="min-w-0 flex items-baseline font-mono text-sm" data-slide-name>
                <span x-show="sel.includes('/')" class="opacity-40 truncate shrink-[9999]" x-text="dirOf(sel) + '/'"></span>
                <span class="min-w-0 truncate" x-text="short(sel)"></span>
              </div>
              <a x-show="at >= 0" :href="ghUrl(sel)" target="_blank" rel="noopener" :aria-label="sel + ' on GitHub'"
                 class="shrink-0 p-1 text-base-content/40 hover:text-primary transition-colors">
                <i class="ph ph-github-logo text-lg leading-none"></i></a>
              <div class="grow"></div>
              <div x-show="at >= 0 && folderFiles.length > 1" class="flex items-center shrink-0">
                <button type="button" class="btn btn-xs btn-ghost btn-square max-sm:hidden" @click="go(at - 1)" :disabled="at <= 0"
                        aria-label="Previous file"><i class="ph ph-caret-left"></i></button>
                <span class="font-mono text-xs opacity-60 tabular-nums px-1" data-pager-label x-text="(at + 1) + '/' + folderFiles.length"></span>
                <button type="button" class="btn btn-xs btn-ghost btn-square max-sm:hidden" @click="go(at + 1)" :disabled="at >= folderFiles.length - 1"
                        aria-label="Next file"><i class="ph ph-caret-right"></i></button>
              </div>
              <!-- The deck door over the same files, full screen. Classes and
                   wording are swipeDeck.entry()'s at the tight size, held by
                   tools/test/deck-entry-parity.test.mjs. -->
              <button x-show="folderFiles.length" data-deck-door @click="openDeck()" :disabled="deckOpening"
                      class="btn btn-square btn-sm btn-ghost text-primary"
                      :title="'Read ' + plural(folderFiles.length, 'file') + ' one at a time'">
                <span x-show="deckOpening" class="loading loading-spinner loading-xs"></span>
                <i x-show="!deckOpening" class="ph ph-cards-three text-lg max-sm:text-xl"></i></button>
            </div>
            <div data-strip @scroll.passive="stripScroll()"
                 class="flex-1 min-h-0 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain
                        [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                 :class="at < 0 && 'invisible'"></div>
          </div>
        </div>`,

      init() {
        root = this.$el;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => {
          if (!this.$el.isConnected) return;
          Alpine.initTree(this.$el);
          this.picker = root.querySelector('[x-data^="pathPicker"]')?.__pathPicker || null;
          if (cfg.file) this.sel = cfg.file;
        });
        // The strip follows the folder on screen; the position follows the
        // selection within it. One watcher each, since every way they move
        // (a tap, a descent, a swipe, the deck) passes through these two.
        this.$watch(() => this.folderFiles.join('\n'), () => this.buildStrip());
        this.$watch('sel', () => this.place(true));
        this.$watch('at', () => {
          if (this.at >= 0 && stripFiles[this.at] && stripFiles[this.at] !== this.sel) this.sel = stripFiles[this.at];
          this.mountNear();
          this.markInTree();
          this.revealInTree();
        });
        keyHandler = (e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          if (!this.hovered || this.at < 0 || !root?.isConnected) return;
          if (e.target && /^(INPUT|TEXTAREA|SELECT)$/i.test(e.target.tagName)) return;
          e.preventDefault();
          this.go(this.at + (e.key === 'ArrowRight' ? 1 : -1));
        };
        window.addEventListener('keydown', keyHandler, true);
      },
      destroy() { if (keyHandler) window.removeEventListener('keydown', keyHandler, true); },

      short, dirOf,
      plural(n, noun) { return n + ' ' + noun + (n === 1 ? '' : 's'); },
      ghUrl(path) { return path ? 'https://github.com/' + this.fbRepo + '/blob/' + (this.fbRef || 'HEAD') + '/' + path : ''; },
      // The files directly in the folder the tree is showing, as repo paths.
      get folderFiles() {
        const p = this.picker;
        if (!p || !p.scope.length || p.scope[0].kind !== 'repo') return [];
        const dir = p.scope.slice(1).map(n => n.name).join('/');
        return p.children().filter(n => !n.children && n.kind === 'file').map(n => (dir ? dir + '/' : '') + n.name);
      },
      pick(path) { if (path) this.sel = path; },

      // ── The strip ────────────────────────────────────────────────────────
      strip() { return root?.querySelector('[data-strip]') || null; },
      slides() { const s = this.strip(); return s ? [...s.children] : []; },
      buildStrip() {
        const s = this.strip();
        if (!s) return;
        stripFiles = this.folderFiles.slice();
        mounted = new Set();
        s.replaceChildren(...stripFiles.map((path, i) => {
          const slide = document.createElement('div');
          slide.className = 'w-full shrink-0 snap-center flex flex-col min-h-0 min-w-0 overflow-hidden';
          slide.dataset.slide = String(i);
          return slide;
        }));
        this.place(true);
      },
      // Put the strip on the selection, or mark it absent from this folder.
      // A folder entered without a selection in it opens on its first file,
      // so the lower half is never an empty box beside a list of files.
      place(jump = false) {
        const i = stripFiles.indexOf(this.sel);
        if (i >= 0) return this.go(i, jump);
        this.at = -1;
        if (stripFiles.length) this.sel = stripFiles[0];
      },
      // Set `at` here as well as on the scroll it starts: a scroll already at
      // its target fires no scroll event. `jump` skips the smooth scroll, for a
      // pick from the tree, where animating past twenty slides is noise.
      go(i, jump = false) {
        const n = stripFiles.length;
        if (!n) return;
        i = Math.max(0, Math.min(n - 1, i));
        this.at = i;
        const s = this.strip(), k = this.slides()[i];
        if (!s || !k) return;
        this.$nextTick(() => {
          const x = k.getBoundingClientRect().left - s.getBoundingClientRect().left + s.scrollLeft;
          if (s.scrollTo) s.scrollTo({ left: x, behavior: jump ? 'instant' : 'smooth' }); else s.scrollLeft = x;
        });
      },
      // The slide nearest the strip's left edge, the branch detail's reading.
      stripScroll() {
        const s = this.strip();
        if (!s || this.at < 0) return;
        const x0 = s.getBoundingClientRect().left;
        let best = 0, near = Infinity;
        this.slides().forEach((k, i) => {
          const d = Math.abs(k.getBoundingClientRect().left - x0);
          if (d < near) { near = d; best = i; }
        });
        if (this.at !== best) this.at = best;
      },
      mountNear() {
        if (this.at < 0) return;
        const slides = this.slides();
        for (let i = Math.max(0, this.at - 1); i <= Math.min(slides.length - 1, this.at + 1); i++) {
          if (!mounted.has(i)) { mounted.add(i); this.mountSlide(stripFiles[i], slides[i]); }
        }
      },
      // The picker lights two rows the same way: `picked`, the file shown, and
      // `active`, its keyboard and hover cursor. A tap leaves `active` on the
      // tapped row, so a swipe that moved only `picked` left two rows lit.
      // Both follow the position.
      markInTree() {
        const p = this.picker;
        if (!p) return;
        p.picked = this.at >= 0 ? this.sel : '';
        const i = this.at >= 0 ? p.matches().findIndex(n => p.pathOf(n) === this.sel) : -1;
        if (i >= 0) p.active = i;
      },
      // The tree's row for the selection, kept in view as the swiper moves.
      revealInTree() {
        if (this.at < 0) return;
        const name = short(this.sel);
        this.$nextTick(() => {
          const row = [...(root?.querySelectorAll('[role=option]') || [])].find(r => r.getAttribute('title') === name);
          row?.scrollIntoView?.({ block: 'nearest' });
        });
      },
      // One slide: the shared viewer and one contents read, the deck's render.
      mountSlide(path, slide) {
        if (!path || !slide) return;
        const el = document.createElement('div');
        el.className = 'flex flex-col h-full w-full min-w-0 overflow-hidden';
        el.setAttribute('x-data', 'viewer({ bindStore: false, fill: true, identify: false, '
          + 'defaultMode: (f) => window.ViewRegistry.READ_MODE(f) })');
        el.dataset.fileViewer = path;
        slide.append(el);
        window.Alpine.initTree(el);
        const repo = this.fbRepo, ref = this.fbRef || '';
        (async () => {
          try {
            const gh = new window.GH({ token: window.TOKEN, repo });
            gh.ref = ref;
            const res = await gh.get(path);
            if (el.isConnected) await el.__viewer?.show(path, res.text, { repo, ref });
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

      // ── The full deck over the same files ───────────────────────────────
      // Opens on the selection when it is in this folder, else the first file,
      // and a swipe there moves this view's position.
      async openDeck() {
        if (this.deckOpening || this._deck) return;
        const files = this.folderFiles;
        if (!files.length) return;
        const at = Math.max(0, files.indexOf(this.sel));
        this.deckOpening = true;
        try {
          if (!window.swipeDeck && window.gh?.load) await window.gh.load('kits/swipe-deck.js');
          if (!window.swipeDeck) throw new Error('the swipe deck kit did not load');
          this._deckFiles = files;
          const parent = window.swipeDeck.top?.() || null;
          const opts = {
            count: files.length, start: at, ...this._deckChrome(at),
            index: (i) => ({ title: short(files[i]), subtitle: '', icon: 'ph-file' }),
            render: (i, slide) => this.mountSlide(files[i], slide),
            release: (i, slide) => { slide.replaceChildren(); },
            slideScroll: false, innerClass: 'h-full w-full min-w-0', immersive: true,
            // The kit reports slides while it is still being built and repeats
            // the current one on each render; only a built deck moves us.
            onSlide: (i) => {
              const h = this._deck, path = files[i];
              if (!h || !path) return;
              const c = this._deckChrome(i);
              h.setTitle(c.title); h.setSubtitle(c.subtitle); h.setIcon(c.icon); h.setLink(c.link);
              if (path !== this.sel) this.sel = path;
            },
            onClose: () => { this._deck = null; this._deckFiles = null; },
          };
          this._deck = parent ? window.swipeDeck.drill(parent, opts) : window.swipeDeck.open(opts);
          if (files[at] !== this.sel) this.sel = files[at];
        } catch (e) {
          window.Alpine.store('toast')?.('warning', 'Could not open the deck: ' + (e?.message || e), 'alert-error', 5000);
        } finally { this.deckOpening = false; }
      },
      _deckChrome(i) {
        const path = this._deckFiles?.[i] || '';
        return {
          title: short(path),
          subtitle: [this.fbRepo.split('/').pop() + (this.fbRef ? '@' + this.fbRef : ''), dirOf(path)].filter(Boolean).join(' · '),
          icon: 'ph-file',
          link: path ? { href: this.ghUrl(path), icon: 'ph-github-logo', title: 'Open ' + path + ' on GitHub' } : null,
        };
      },
    };
  });
};
if (window.Alpine && window.Alpine.data) registerFileBrowser();
else document.addEventListener('alpine:init', registerFileBrowser);
