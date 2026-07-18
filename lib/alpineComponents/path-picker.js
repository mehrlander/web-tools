// An input-anchored repo/path selector: the input IS the path field, and
// focusing it opens a navigable tree panel right below (repos, then folders,
// then files). No trigger symbol: where mention embeds a path inside prose
// (type @ mid-text), this component is for the case where the path is the
// whole point, so typing filters and taps descend from the first character.
// Anchored to the input rather than a bottom sheet, so it stays inside the
// mobile viewport with visible boundaries.
//
// Options:
//   mode: 'file' (default) — choosing a file emits it and stays open for the
//         next grab; 'dir' — the target is a folder: "Use this folder" and
//         file taps emit the containing folder, and free-typed text is passed
//         through, so hand-written owner/repo@ref:dir specs still work.
//   roots: [{repo, ref?, label?}] or a function returning them, called lazily
//         at first open (roots often resolve after mount: config, quick links).
//   placeholder, value: the input's placeholder and initial text.
//
// Events (bubbling, from $root):
//   path-pick  — file mode: {repo, ref, path}; dir mode: {repo, ref, dir, spec}
//   path-input — every raw text change (dir-mode hosts keep their spec synced)

document.addEventListener('alpine:init', function() {
  Alpine.data('pathPicker', function(opts) {
    const cfg = opts || {};
    return {
      mode: cfg.mode === 'dir' ? 'dir' : 'file',
      placeholder: cfg.placeholder || '',
      text: cfg.value || '',
      open: false,
      query: '',
      active: 0,
      scope: [],
      tree: [],
      loading: false,
      truncated: false,
      _loaded: false,

      template: `
        <div class="relative" @click.outside="open = false">
          <input type="text" x-ref="box" x-model="text"
                 autocomplete="off" autocapitalize="off" spellcheck="false"
                 role="combobox" aria-autocomplete="list" :aria-expanded="open"
                 @focus="show()" @click="show()" @input="onInput()"
                 @keydown.down="navigate($event, 1)" @keydown.up="navigate($event, -1)"
                 @keydown.enter="accept($event)" @keydown.escape="open = false"
                 class="input input-sm input-bordered font-mono w-full"
                 :placeholder="placeholder">

          <section x-cloak x-show="open"
                   class="absolute inset-x-0 top-full z-40 mt-1 flex max-h-[50vh] flex-col overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-xl">
            <!-- Compact crumb row: a repo crumb shows its short name (full
                 name in the tooltip) so deep paths fit a phone width. Actions
                 bind to click, not pointerdown, so a touch that starts a
                 scroll never triggers them. -->
            <header class="flex min-h-8 shrink-0 items-center gap-0.5 border-b border-base-300 px-1">
              <button type="button" class="btn btn-ghost btn-xs btn-square shrink-0" :disabled="!scope.length"
                      aria-label="Go up one level" @click="up()">
                <i class="ph ph-caret-left"></i>
              </button>
              <nav aria-label="Current path"
                   class="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button type="button" class="shrink-0 rounded px-1 py-0.5 text-xs hover:bg-base-200"
                        :class="!scope.length && 'bg-base-200 font-medium'" @click="jump(0)">Repos</button>
                <template x-for="(node, index) in scope" :key="index + ':' + node.name">
                  <span class="contents">
                    <span class="shrink-0 text-base-content/30 text-xs">/</span>
                    <button type="button" class="max-w-[9rem] truncate shrink-0 rounded px-1 py-0.5 font-mono text-xs hover:bg-base-200"
                            :class="index === scope.length - 1 && 'bg-base-200 font-medium'"
                            :title="node.name" @click="jump(index + 1)"
                            x-text="node.kind === 'repo' ? node.name.split('/').pop() : node.name"></button>
                  </span>
                </template>
              </nav>
              <button x-show="mode === 'dir'" type="button" :disabled="!dirSpec()"
                      class="btn btn-primary btn-xs shrink-0 gap-1" @click="pickDir()">
                <i class="ph ph-check"></i>Here
              </button>
              <button type="button" class="btn btn-ghost btn-xs btn-square shrink-0"
                      aria-label="Close" @click="open = false">
                <i class="ph ph-x"></i>
              </button>
            </header>

            <div x-ref="options" role="listbox" class="min-h-0 flex-1 overscroll-contain overflow-y-auto p-1">
              <div x-show="loading" class="grid min-h-20 place-items-center">
                <span class="loading loading-dots loading-sm opacity-30"></span>
              </div>
              <template x-for="(node, index) in (loading ? [] : matches())" :key="index + ':' + node.name">
                <button type="button" role="option" :data-index="index" :aria-selected="active === index"
                        class="flex min-h-10 w-full touch-manipulation items-center gap-2.5 rounded-field px-2.5 py-1.5 text-left transition-colors"
                        :class="active === index ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'"
                        @mouseenter="active = index" @click="choose(node)">
                  <i class="ph shrink-0"
                     :class="node.kind === 'repo' ? 'ph-git-repository text-primary' : node.children ? 'ph-folder text-warning' : 'ph-file text-info'"></i>
                  <span class="min-w-0 flex-1 truncate font-mono text-sm" x-text="node.name"></span>
                  <span x-show="node.children" class="badge badge-ghost badge-xs shrink-0" x-text="node.children?.length"></span>
                  <span x-show="node.children" class="shrink-0 text-base-content/35"><i class="ph ph-caret-right text-xs"></i></span>
                </button>
              </template>
              <div x-show="!loading && !matches().length" class="grid min-h-20 place-items-center px-3 text-center text-sm text-base-content/50">
                <span x-text="query ? ('Nothing here matches “' + query + '”.') : 'Empty.'"></span>
              </div>
            </div>
            <div x-show="truncated" class="shrink-0 border-t border-base-300 px-3 py-1 text-xs text-warning">
              Tree truncated by GitHub; deep paths may be missing.
            </div>
          </section>
        </div>`,

      init() {
        this.$root.__pathPicker = this;
        this.$el.innerHTML = this.template;
        this.$nextTick(() => Alpine.initTree(this.$el));
      },

      get gh() { return Alpine.store('browser').gh; },

      // Roots resolve lazily at first open, so config-derived sets that load
      // after mount are seen. Each root's tree is fetched eagerly (the set is
      // small), letting typed paths resolve without mid-descent fetches.
      async ensureTree() {
        if (this._loaded) return;
        this._loaded = true;
        const roots = (typeof cfg.roots === 'function' ? cfg.roots() : cfg.roots) || [];
        const base = this.gh;
        if (!base || !roots.length) return;
        this.loading = true;
        const nodes = [];
        for (const raw of roots) {
          const r = typeof raw === 'string' ? { repo: raw, ref: '' } : raw;
          const inst = new base.constructor({ token: base.token, repo: r.repo });
          inst.ref = r.ref || '';
          let children = [];
          try {
            const res = await inst.req('git/trees/' + encodeURIComponent(r.ref || 'HEAD') + '?recursive=1');
            if (res.truncated) this.truncated = true;
            children = this.buildTree(res.tree || []);
          } catch (e) { children = []; }
          nodes.push({ name: r.label || (r.repo + (r.ref ? '@' + r.ref : '')), kind: 'repo', repo: r.repo, ref: r.ref || '', children });
        }
        this.tree = nodes;
        this.loading = false;
        this.resolveText();
      },

      buildTree(flat) {
        const root = [];
        const dirs = new Map([['', root]]);
        const ensureDir = key => {
          if (dirs.has(key)) return dirs.get(key);
          const cut = key.lastIndexOf('/');
          const parent = cut === -1 ? '' : key.slice(0, cut);
          const name = cut === -1 ? key : key.slice(cut + 1);
          const siblings = ensureDir(parent);
          let node = siblings.find(n => n.children && n.name === name);
          if (!node) { node = { name, kind: 'folder', children: [] }; siblings.push(node); }
          dirs.set(key, node.children);
          return node.children;
        };
        for (const e of flat) {
          if (!e || !e.path) continue;
          if (e.type === 'tree') { ensureDir(e.path); continue; }
          if (e.type === 'blob') {
            const cut = e.path.lastIndexOf('/');
            const parent = cut === -1 ? '' : e.path.slice(0, cut);
            const name = cut === -1 ? e.path : e.path.slice(cut + 1);
            ensureDir(parent).push({ name, kind: 'file' });
          }
        }
        const sort = nodes => {
          nodes.sort((a, b) =>
            (a.children ? 0 : 1) - (b.children ? 0 : 1) ||
            a.name.localeCompare(b.name));
          nodes.forEach(n => n.children && sort(n.children));
          return nodes;
        };
        return sort(root);
      },

      show() { this.open = true; this.ensureTree(); this.resolveText(); },
      onInput() {
        this.open = true;
        this.ensureTree();
        this.$root.dispatchEvent(new CustomEvent('path-input', { bubbles: true, detail: this.text }));
        this.resolveText();
      },

      // The whole input value is the path: resolve as many leading segments as
      // match container nodes (repo names carry their own '/'), the remainder
      // is the filter query. Same walk as mention's resolve, minus the @.
      resolveText() {
        let nodes = this.tree;
        let rest = this.text;
        const scope = [];
        while (true) {
          const next = nodes
            .filter(node => node.children)
            .sort((a, b) => b.name.length - a.name.length)
            .find(node => rest.startsWith(node.name + '/'));
          if (!next) break;
          scope.push(next);
          rest = rest.slice(next.name.length + 1);
          nodes = next.children;
        }
        const changed = rest !== this.query || this.path(scope) !== this.path();
        this.scope = scope;
        this.query = rest;
        if (changed) { this.active = 0; this.resetScroll(); }
      },

      children() {
        return this.scope.length ? this.scope[this.scope.length - 1].children : this.tree;
      },
      matches() {
        const query = this.query.trim().toLocaleLowerCase();
        return this.children()
          .map((node, order) => {
            const name = node.name.toLocaleLowerCase();
            const score =
              !query ? 0 :
              name === query ? 0 :
              name.startsWith(query) ? 1 :
              name.includes(query) ? 2 : 99;
            return { node, order, score, container: node.children ? 0 : 1 };
          })
          .filter(item => item.score < 99)
          .sort((a, b) => a.score - b.score || a.container - b.container || a.order - b.order)
          .map(item => item.node);
      },
      path(nodes = this.scope) { return nodes.map(node => node.name).join('/'); },

      // The current scope as a destination: null until a repo is entered.
      dirSpec() {
        const head = this.scope[0];
        if (!head || head.kind !== 'repo') return null;
        const dir = this.scope.slice(1).map(n => n.name).join('/');
        return { repo: head.repo, ref: head.ref || '', dir,
                 spec: head.repo + (head.ref ? '@' + head.ref : '') + (dir ? ':' + dir : '') };
      },

      choose(node) {
        if (!node) return;
        if (node.children) {
          this.scope = [...this.scope, node];
          this.query = '';
          this.active = 0;
          this.setText(this.path() + '/');
          this.resetScroll();
          return;
        }
        if (this.mode === 'dir') {
          // A file names its folder: the current scope is the destination.
          this.pickDir();
          return;
        }
        // File mode: emit the pick, stay open in place for the next grab.
        const head = this.scope[0];
        const detail = (head && head.kind === 'repo')
          ? { repo: head.repo, ref: head.ref || '', path: [...this.scope.slice(1), node].map(n => n.name).join('/') }
          : null;
        if (!detail) return;
        this.$root.dispatchEvent(new CustomEvent('path-pick', { bubbles: true, detail }));
        this.setText(this.path() + '/');
        this.query = '';
      },

      pickDir() {
        const d = this.dirSpec();
        if (!d) return;
        this.$root.dispatchEvent(new CustomEvent('path-pick', { bubbles: true, detail: d }));
        this.setText(d.spec);
        this.open = false;
      },

      jump(depth) {
        this.scope = this.scope.slice(0, depth);
        this.query = '';
        this.active = 0;
        const path = this.path();
        this.setText(path + (path ? '/' : ''));
        this.resetScroll();
      },
      up() { this.jump(Math.max(0, this.scope.length - 1)); },

      navigate(event, amount) {
        if (!this.open) return;
        const count = this.matches().length;
        if (!count) return;
        event.preventDefault();
        this.active = (this.active + amount + count) % count;
        this.$nextTick(() => {
          this.$refs.options
            ?.querySelector('[data-index="' + this.active + '"]')
            ?.scrollIntoView({ block: 'nearest' });
        });
      },
      accept(event) {
        if (!this.open) return;
        const node = this.matches()[this.active];
        // Dir mode with nothing to descend into: the typed text stands as the
        // spec (already emitted via path-input); Enter just closes the panel.
        if (!node) { this.open = false; return; }
        event.preventDefault();
        this.choose(node);
      },

      setText(v) {
        this.text = v;
        this.$root.dispatchEvent(new CustomEvent('path-input', { bubbles: true, detail: v }));
      },
      resetScroll() {
        this.$nextTick(() => { if (this.$refs.options) this.$refs.options.scrollTop = 0; });
      }
    };
  });
});
