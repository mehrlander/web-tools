// transform-workbench.js — the generic multi-tab `rows => rows` transform
// workbench, extracted from the budget-drs app's Load tab (its third
// generation; pages/table-compress*.html were the first two). One file
// carries the whole tool: the Alpine component (state + behavior), its
// markup (TransformWorkbench.panelHTML()), the worker that runs the
// transforms, and the trimmed output viewer (raw / Tabulator table / JSON
// tree). Hosts:
//
//   - pages/transform.html mounts it standalone (paste/drop intake, a
//     localStorage function cache via { persist: true }).
//   - the budget-drs app (mehrlander/home, app/view/views/transform.js)
//     wraps it with its own loading: a catalogue picker, committed recipe
//     seeding, and intake panes, passed through the opts below.
//
// The host contract, all optional:
//   transformWorkbench({
//     recipes: [{ name, label?, fnSrc, scope? }],  // scope "universal" = the identity default
//     onIngest: (rows) => {},   // fires after every ingest and clear ([] on clear)
//   Every batch is reachable from a fn as $<name>, the way a tab's output is.
//   loadRows(rows, { ref: true, label }) adds a REFERENCE batch, which is also
//   kept out of the input stack and every scope: a lookup table a recipe joins
//   to, not rows to transform.
//   loadBatches([{ name, rows }], { label, combine }) replaces the input with
//   several named batches at once and runs once (a workbook's sheets).
//     onSaveRecipe: (draft) => {}, // when given, "Save as recipe" appears on the pivot
//                               // and on an authored tab; draft = { name, fnSrc,
//                               // columns, effect, input, kind: "pivot" | "tab" }
//     onClear: () => {},        // after Clear all, so a host can reset its own panels
//     persist: true,            // cache tab names + sources in localStorage
//     storageKey: "...",        // localStorage key when persist is on
//     formerKey: "...",         // a key the tabs used to live under; restore moves
//                               // them to storageKey once and deletes it
//   })
//   panelHTML(dataExpr) embeds dataExpr verbatim inside x-data="transformWorkbench(...)",
//   so it must use single quotes only. The mounted component publishes itself as
//   el.__workbench on its root (querySelector(".tf-root").__workbench), the
//   element-back-pointer idiom from docs/loader.md.
//
// Three inspection views over whatever the active tab produced: Data (the rows),
// Profile (per column: type, nulls, distincts), and Pivot (group by up to four
// columns, aggregate one measure). Pivot publishes its result on the component
// as `__workbench.pvOut.res.tree`, a {label, note, value, children} partition,
// which is the shape a host renders however it likes. That handle is the
// integration point: this file computes the grouping, the host owns the drawing.
//
// Dependencies: Alpine + PapaParse as globals (page-loaded; Papa parses
// pastes and builds the on-demand CSV export, and the worker itself is
// dependency-free); ClipboardJS optional (the fn-source copy button is
// inert without it; the result copy uses the async clipboard API);
// Tabulator optional (the table mode needs it, the app shell ships it, the
// standalone page loads it); vanilla-jsoneditor lazy-imported on first
// Tree view.
//
// Large batches are the sizing case: runs materialize rows only (every
// derived form is lazy: CSV and bundle gzips on demand, viewer previews
// capped, rows handed to Table/Tree by reference), and an append does not
// re-run the pipeline.
//
// Two portability invariants, both load-bearing for the budget-drs embed:
// no literal closing-script-tag sequence anywhere in this file (the app's
// render-time fold inlines scripts verbatim; the worker therefore rides as
// a stringified function, never an inline worker script block), and no
// claim on the Alpine component name `app()` (host shells own it). Plain
// script, no import/export at top level, so it loads via <script src>,
// gh.load, and the dist pre-build alike.
(() => {

  // kits/row-menu.js draws the table view's column and row menus. Fetched at
  // load rather than at the first grid, so it has arrived by the time there
  // are rows to show; a shell that loads its scripts directly names it itself.
  const ghRef = typeof gh !== "undefined" ? gh : (window.gh || null);
  if (!window.rowMenu && ghRef?.load) ghRef.load("kits/row-menu.js").catch(() => {});
  // kits/table-stats.js computes the Profile and Pivot views (and the Layout
  // view, which reads the pivot).
  if (!window.TableStats && ghRef?.load) ghRef.load("kits/table-stats.js").catch(() => {});

  // ---- the output viewer: raw text, Tabulator table, JSON tree ----
  const TF_VIEW_REGISTRY = {
    _loaded: new Set(),
    loadAsset(url) {
      if (this._loaded.has(url)) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const isCSS = url.includes(".css");
        const elx = document.createElement(isCSS ? "link" : "script");
        if (isCSS) Object.assign(elx, { rel: "stylesheet", href: url });
        else Object.assign(elx, { src: url, async: true });
        elx.onload = () => { this._loaded.add(url); resolve(); };
        elx.onerror = () => reject(new Error("Load failed: " + url));
        document.head.appendChild(elx);
      });
    },
    // window.esc (vanilla-bundle.js), which quotes as well; new Option() did not.
    esc: (s) => window.esc(s),
    modules: [
      {
        id: "raw", label: "Raw", icon: "ph-text-t",
        test: () => true,
        render: (f) => '<pre class="m-0 p-4 h-full overflow-auto text-xs leading-5 font-mono whitespace-pre-wrap text-base-content">' + TF_VIEW_REGISTRY.esc(f.content) + "</pre>",
      },
      {
        id: "table", label: "Table", icon: "ph-table",
        test: (f) => f.ext === "json" && f.content.trim().startsWith("["),
        // No toolbar: what the header-filter checkbox did is in the menu on
        // every column header (kits/row-menu.js), and the note below shows
        // only when the grid is a window onto more rows than it holds.
        render: () => '<div class="flex flex-col h-full w-full">'
          + '<div id="tf-tab-note" class="hidden px-3 py-1 border-b border-base-300 bg-base-200/50 text-[10px] opacity-60 shrink-0"></div>'
          + '<div id="tf-tab-target" class="flex-1 min-h-0"></div></div>',
        // The grid is a window, not the dataset: Tabulator builds an internal
        // model per row it is handed, so past the cap that model alone can
        // exhaust memory. Copy and download carry all rows regardless.
        _cap: 20000,
        _windowed(ref) {
          const CAP = TF_VIEW_REGISTRY.modules.find(m => m.id === "table")._cap;
          const note = document.getElementById("tf-tab-note");
          if (note) {
            note.textContent = ref.length > CAP
              ? "showing the first " + CAP.toLocaleString() + " of " + ref.length.toLocaleString() + " rows (filters see the shown window; copy and download carry all)"
              : "";
            note.classList.toggle("hidden", ref.length <= CAP);
          }
          return ref.length > CAP ? ref.slice(0, CAP) : ref;
        },
        // ONE GRID PER VIEW OF THE DATA, KEPT. A key names what a grid shows
        // (a tab's Data for one batch, its Profile, the pivot, the input) and
        // each key keeps its own Tabulator under #tf-tab-target, shown when
        // asked for and display:none otherwise. Rebuilding one grid for
        // every switch cost 384 to 575 ms per batch chip on a nine-sheet
        // workbook (2026-10-23, headless): Tabulator's height measurements
        // forced about 20 full-page style recalculations per build. Showing
        // a grid already built forces one.
        //
        // The same key with new rows (a Run over the same tab and batch)
        // swaps the rows in place when the columns match, so filters and
        // scroll survive a re-run as they always did. A key with no grid
        // builds one. Grids are kept by recency within a count and a row
        // budget, the oldest dropped first; a mode switch re-renders the
        // pane, which takes every grid with it.
        _grids: new Map(),      // key -> { el, tbl, ref, cols, w, h, top, left, filters }
        _MAX_GRIDS: 12,
        _MAX_ROWS: 100000,
        // Header filters shown, for every grid: set from any grid's header
        // menu, applied to the grid showing, and caught up by the rest when
        // they are shown or built.
        _filtersOn: true,
        update: (f) => {
          const self = TF_VIEW_REGISTRY.modules.find(m => m.id === "table");
          return self.present(f);
        },
        after: (f) => {
          requestAnimationFrame(() => TF_VIEW_REGISTRY.modules.find(m => m.id === "table").present(f));
        },
        present(f) {
          const self = this;
          const host = document.getElementById("tf-tab-target");
          const root = document.getElementById("tf-workbench");
          if (!host || typeof Tabulator === "undefined") return false;
          const grids = self._grids;
          for (const [k, g] of grids) if (!host.contains(g.el)) { try { g.tbl.destroy(); } catch (e) {} grids.delete(k); }
          let ref = root?.__viewerData;
          if (!Array.isArray(ref)) {
            try { ref = JSON.parse(f.content); } catch (e) { ref = null; }
            if (!Array.isArray(ref)) {
              host.innerHTML = '<div class="p-4 text-error font-mono text-xs">Invalid JSON array for the table view</div>';
              grids.clear();
              return true;
            }
          }
          const data = self._windowed(ref);
          const key = root?.__viewerKey || "scratch";
          const cols = JSON.stringify(Object.keys(data[0] || {}));
          const filters = self._filtersOn;
          self._wire(host);
          let g = grids.get(key);
          // Leaving a grid: its scroll is kept, since display:none drops it.
          for (const x of grids.values()) {
            if (x === g || x.el.classList.contains("hidden")) continue;
            const holder = x.el.querySelector(".tabulator-tableholder");
            if (holder) { x.top = holder.scrollTop; x.left = holder.scrollLeft; }
            x.el.classList.add("hidden");
          }
          const w = host.clientWidth, h = host.clientHeight || 500;
          if (g) {
            grids.delete(key); grids.set(key, g);
            // Still building: its own tableBuilt shows it, being current.
            if (g.el.__built === false && g.ref === ref) return true;
            self._show(g);
            if (g.ref !== ref) {
              if (g.cols === cols) g.tbl.replaceData(data);
              else { try { g.tbl.destroy(); } catch (e) {} g.el.replaceChildren(); g.tbl = self._build(g.el, data, h, filters); Object.assign(g, { w, h, top: 0, left: 0, filters }); }
              g.ref = ref; g.cols = cols;
            }
            if (g.filters !== filters) self._filters(g, filters);
            if (g.h !== h) { g.tbl.setHeight(h); g.h = h; }
            if (g.w !== w) { g.tbl.redraw(); g.w = w; }
            const holder = g.el.querySelector(".tabulator-tableholder");
            if (holder && (g.top || g.left)) { holder.scrollTop = g.top; holder.scrollLeft = g.left; }
            return true;
          }
          const el = document.createElement("div");
          el.className = "h-full";
          host.append(el);
          g = { el, tbl: self._build(el, data, h, filters), ref, cols, w, h, top: 0, left: 0, filters };
          grids.set(key, g);
          let rows = 0;
          for (const x of grids.values()) rows += Math.min(x.ref.length, self._cap);
          for (const [k, x] of grids) {
            if (grids.size <= self._MAX_GRIDS && rows <= self._MAX_ROWS) break;
            if (x === g) continue;
            rows -= Math.min(x.ref.length, self._cap);
            try { x.tbl.destroy(); } catch (e) {}
            x.el.remove();
            grids.delete(k);
          }
          return true;
        },
        // Header filters are always built and hidden when switched off, so
        // the switch never has to rebuild a grid. A grid built while it is
        // off hides them once built: Tabulator makes them after the
        // constructor returns, and a redraw before then throws.
        //
        // BUILT HIDDEN, SHOWN ONCE BUILT. Laid out while visible, a new grid
        // forced about 99 style recalculations as it fitted each column and
        // filled the rows; laid out hidden and drawn once on reveal, about
        // 56 (2026-10-23, a 250-row, 19-column batch). The reveal is skipped
        // when another grid was asked for meanwhile.
        _build(el, data, h, filters) {
          el.classList.add("hidden");
          const self = TF_VIEW_REGISTRY.modules.find(m => m.id === "table");
          const config = {
            data,
            autoColumns: true,
            autoColumnsDefinitions: (defs) => defs.map(d => ({ ...d, headerFilter: "input" })),
            layout: "fitData",
            height: h + "px",
            // The host's own observer below resizes the grid that is showing;
            // Tabulator's would also redraw every hidden one as it collapses.
            autoResize: false,
          };
          // The column and row menus, when kits/row-menu.js has arrived; a
          // grid built before it is a plain grid. The filter switch in the
          // header menu is the module's, not the one table's.
          const tbl = window.rowMenu?.grid
            ? window.rowMenu.grid(el, config, {
                noun: "row",
                filters: {
                  on: () => self._filtersOn,
                  set: (on) => {
                    self._filtersOn = on;
                    const g = [...self._grids.values()].find(x => !x.el.classList.contains("hidden"));
                    if (g) self._filters(g, on);
                  },
                },
              })
            : new Tabulator(el, config);
          el.__built = false;
          el.__fresh = true;
          tbl.on("tableBuilt", () => {
            el.__built = true;
            if (!filters) el.querySelectorAll(".tabulator-header-filter").forEach(elx => { elx.style.display = "none"; });
            const last = [...self._grids.values()].pop();
            if (last && last.el === el) self._show(last);
          });
          return tbl;
        },
        // The one way a grid becomes visible. A grid built hidden gets its
        // first draw here, and only once it is built: a redraw before that
        // throws inside Tabulator.
        _show(g) {
          const el = g.el;
          if (el.__built === false) return;
          el.classList.remove("hidden");
          if (el.__fresh) { el.__fresh = false; g.tbl.redraw(true); }
        },
        _filters(g, on) {
          g.el.querySelectorAll(".tabulator-header-filter").forEach(elx => { elx.style.display = on ? "" : "none"; });
          g.tbl.redraw(true);
          g.filters = on;
        },
        // Once per rendered pane: a resize of the pane resizes the grid showing.
        _wire(host) {
          if (host.__wired) return;
          host.__wired = true;
          const self = this;
          const showing = () => [...self._grids.values()].find(x => !x.el.classList.contains("hidden"));
          if (typeof ResizeObserver !== "undefined") {
            let queued = false;
            new ResizeObserver(() => {
              if (queued) return;
              queued = true;
              requestAnimationFrame(() => {
                queued = false;
                const g = showing();
                if (!g || !host.isConnected) return;
                const w = host.clientWidth, h = host.clientHeight;
                if (!w || !h) return;
                if (g.h !== h) { g.tbl.setHeight(h); g.h = h; }
                if (g.w !== w) { g.tbl.redraw(); g.w = w; }
              });
            }).observe(host);
          }
        },
      },
      {
        // Tree mode mounts vanilla-jsoneditor (lazy-imported) in editable tree mode.
        id: "tree", label: "Tree", icon: "ph-tree-view",
        test: (f) => f.ext === "json",
        render: () => '<div class="tf-jse-mount h-full w-full bg-base-100"></div>',
        after: (f) => {
          requestAnimationFrame(async () => {
            const target = document.querySelector(".tf-jse-mount");
            if (!target) return;
            try {
              TF_VIEW_REGISTRY._jseMod ??= await import("https://cdn.jsdelivr.net/npm/vanilla-jsoneditor/standalone.js");
            } catch (e) {
              target.innerHTML = '<pre class="p-4 text-error font-mono text-xs">Failed to load JSON editor: ' + TF_VIEW_REGISTRY.esc(e?.message || e) + "</pre>";
              return;
            }
            let parsed;
            const ref = document.getElementById("tf-workbench")?.__viewerData;
            if (ref != null) {
              // A CLONE, THOUGH THE PANEL IS READ-ONLY. The clone was here
              // because the editor could write; it stays because read-only is
              // the widget's promise and not this file's, and the rows behind
              // it are the workbench's live output. Cheap insurance against a
              // library change, at a cost this path already paid.
              try { parsed = structuredClone(ref); } catch (e) { parsed = ref; }
            } else {
              try { parsed = JSON.parse(f.content); }
              catch (e) {
                target.innerHTML = '<pre class="p-4 text-error font-mono text-xs">Invalid JSON: ' + TF_VIEW_REGISTRY.esc(e.message) + "</pre>";
                return;
              }
            }
            // READ-ONLY, because nothing reads this panel back. It was mounted
            // editable and there is no onChange and no use of the handle below,
            // so every edit made here was accepted and then discarded on the
            // next mode switch: the widget changed and the rows did not. A
            // panel that takes input it throws away is worse than one that
            // takes none, so until there is a write path it declines the input
            // (2026-09-14). Making the edits land, as a new batch, is the
            // other way to settle this and is a larger piece of work.
            target.__jse = TF_VIEW_REGISTRY._jseMod.createJSONEditor({
              target, props: { content: { json: parsed }, mode: "tree", readOnly: true },
            });
          });
        },
      },
    ],
    getModes(file) { return this.modules.filter(m => m.test(file)); },
    async prepare(id) {
      const mod = this.modules.find(m => m.id === id);
      if (mod?.assets) await Promise.all(mod.assets.map(a => this.loadAsset(a)));
      return mod;
    },
  };

  // ---- the worker body: dependency-ordered execution of the transform tabs.
  // Written as a real function and stringified for the Blob, so its regexes
  // keep their backslashes and the file carries no closing-script-tag sequence.
  // Dependency-free by design: it returns rows only, and every derived form
  // (columnar obj, CSV, JSON text, gzip) is produced lazily on the main side,
  // so a run moves each output across the boundary once instead of four times.
  function tfWorker() {

    self.onmessage = e => {
      // The worker is where the bulk transiently lives: it receives the raw
      // batches once, stacks (and tags) them itself, streams each finished
      // tab back as its own message, and is terminated after the run, so
      // everything it held is reclaimed at once. It clones an input only
      // while another consumer still needs the pristine copy, and pools a
      // named output only while a later task actually references it.
      const { batches, tagCol, tasks, seed, seedAlias } = e.data;
      // A $name is an identifier after $, or any name this run knows: a
      // sheet's batch can be called 4_Service, and $4_Service is valid
      // JavaScript, while "$1" in a replacement string is no reference.
      const known = new Set([...Object.keys(seed || {}), ...tasks.map(t => t.name).filter(Boolean), ...(seedAlias || [])]);
      const refsOf = s => [...new Set([...s.matchAll(/\$(\w+)/g)].map(m => m[1]).filter(n => /^[A-Za-z_]/.test(n) || known.has(n)))];
      const stack = [];
      for (const b of batches) for (const r of b.rows) stack.push(tagCol ? { ...r, [tagCol]: b.name } : r);

      const refCount = {};
      for (const t of tasks) for (const n of refsOf(t.fnSrc)) refCount[n] = (refCount[n] || 0) + 1;
      const alias = new Set(seedAlias || []);       // names whose output IS the stack (skipped identity tabs)
      const pool = {};
      for (const n of Object.keys(seed || {})) if (refCount[n]) pool[n] = seed[n];
      for (const n of alias) if (refCount[n]) pool[n] = stack;
      const stackPooled = [...alias].some(n => refCount[n]);

      let inputReaders = tasks.length;
      let pending = tasks.slice(), moving = true;
      while (pending.length && moving) {
        moving = false;
        pending = pending.filter(t => {
          const deps = refsOf(t.fnSrc);
          if (!deps.every(n => n in pool)) return true;   // deps not ready, wait a pass
          try {
            self.postMessage({ progress: { i: t.i, name: t.name || "fn" } });
            inputReaders--;
            const input = (inputReaders > 0 || stackPooled) ? structuredClone(stack) : stack;
            const args = deps.map(n => {
              const more = --refCount[n] > 0;
              const v = (more || alias.has(n)) ? structuredClone(pool[n]) : pool[n];
              if (!more && !alias.has(n)) delete pool[n];
              return v;
            });
            const fn = new Function("rows", ...deps.map(n => "$" + n), "return (" + t.fnSrc + ")(rows)");
            const rows = fn(input, ...args);
            self.postMessage({ result: { i: t.i, rows, err: null } });
            if (t.name && refCount[t.name]) pool[t.name] = rows;
          } catch (err) { self.postMessage({ result: { i: t.i, err: err.message } }); }
          moving = true;
          return false;   // resolved, drop it
        });
      }
      pending.forEach(t => self.postMessage({ result: { i: t.i, err: "Unresolved $ref: " + refsOf(t.fnSrc).filter(n => !(n in pool)).join(", ") } }));
      self.postMessage({ done: true });
    };
  }
  const TF_WORKER_SRC = "(" + tfWorker.toString() + ")()";
  // Which rows array each batch peek was seeded from, and under what name;
  // outside the component so a hover never writes reactive state.
  const peekSeeded = new WeakMap();
  // After the browser has painted what a click changed: a frame, then a task.
  const afterPaint = (fn) => requestAnimationFrame(() => setTimeout(fn, 0));

  // ---- the components ----
  // Registered at alpine:init, or at once when Alpine has already started:
  // a host that loads this file on demand (the app's Stage, through
  // gh.load) arrives after the event, and a listener alone would leave
  // x-data="transformWorkbench(...)" naming a component nobody defined.
  // The same arrangement as alpineComponents/user-call-form.js.
  const register = () => {
    if (typeof Alpine === "undefined" || !Alpine.data) return;

    // The output viewer, mounted by the workbench markup below. File, content,
    // and data live on the root ELEMENT, outside Alpine's reactivity: viewHtml
    // re-renders only when `mode` or the explicit `rev` counter moves, which is
    // what lets a same-shape data change update the mounted table in place
    // instead of repainting the pane.
    Alpine.data("tfViewer", function (opts) {
      opts = opts || {};
      return {
        template: '<div x-show="viewLoading" class="flex justify-center py-20">'
          + '<span class="loading loading-spinner loading-lg text-primary"></span></div>'
          + '<div x-show="!viewLoading" class="h-full"><div class="h-full" x-html="viewHtml"></div></div>',

        mode: "", viewLoading: false, rev: 0,
        defaultMode: opts.defaultMode || "raw",

        init() {
          this.$root.__viewer = this;
          this.$el.innerHTML = this.template;
          this.$nextTick(() => { if (this.$el.isConnected) Alpine.initTree(this.$el); });
        },
        get file() { return this.$root.__viewerFile || ""; },
        get ext() { return this.file ? this.file.split(".").pop().toLowerCase() : ""; },
        get fileContext() { return { name: this.file, ext: this.ext, content: this.$root.__viewerContent || "" }; },
        get availableModes() { return TF_VIEW_REGISTRY.getModes(this.fileContext); },
        get viewHtml() {
          this.rev;   // the explicit re-render dependency
          if (!this.file) return "";
          const mod = TF_VIEW_REGISTRY.modules.find(m => m.id === this.mode) || TF_VIEW_REGISTRY.modules[0];
          return mod.render(this.fileContext);
        },
        // `data` (optional) is the actual structured value the content string
        // previews: Table and Tree use it directly, so large datasets never
        // round-trip through a full serialization. When the viewer is already
        // showing a table and the new data has the same columns, the module's
        // update hook swaps rows in place: no spinner, no repaint, filters and
        // scroll preserved.
        // `key` names what the rows ARE (a tab's Data for one batch, its
        // Profile, the pivot), so the table mode can keep a grid per key.
        async show(file, content, data, targetMode, key) {
          const root = this.$root;
          root.__viewerFile = file;
          root.__viewerContent = content ?? "";
          root.__viewerData = data ?? null;
          root.__viewerKey = key ?? null;
          const modes = this.availableModes;
          const target = (targetMode && modes.some(m => m.id === targetMode)) ? targetMode
            : (modes.find(m => m.id === this.defaultMode) || modes.find(m => m.id === "raw") || modes[0]).id;
          if (target === "table" && this.mode === "table" && Array.isArray(data)) {
            const mod = TF_VIEW_REGISTRY.modules.find(m => m.id === "table");
            if (mod.update && mod.update(this.fileContext)) return;
          }
          await this.switchMode(target);
        },
        async switchMode(id) {
          this.viewLoading = true;
          const mod = await TF_VIEW_REGISTRY.prepare(id);
          this.mode = id;
          this.rev++;
          this.$nextTick(() => {
            if (mod.after) mod.after(this.fileContext);
            this.viewLoading = false;
          });
        },
      };
    });

    // The workbench itself.
    Alpine.data("transformWorkbench", function (opts) {
      opts = opts || {};
      const storageKey = opts.storageKey || "transform-workbench";
      let scanSeq = 0;   // the latest queued dimension scan (scanSoon)
      const sizeOf = s => (s?.length / 1024).toFixed(1) + "k";
      const colFromRows = r => r.length ? Object.fromEntries(Object.keys(r[0]).map(k => [k, r.map(x => x[k] ?? null)])) : {};
      const rowsFromCol = c => {
        const ks = Object.keys(c), len = ks[0] ? c[ks[0]].length : 0;
        return Array.from({ length: len }, (_, i) => Object.fromEntries(ks.map(k => [k, c[k][i]])));
      };

      return {
        raw: [], active: 0, editing: -1, ran: false,
        bundle: "", bundleSz: "", bundleObj: {},
        // Per-key bundle selection (bndSel[key] true/false); a key not present
        // takes its default: src keys off, everything else on.
        bndSel: {}, srcGz: {},
        // The dimension pane's working state (the Dimensions tab of the lower
        // pane; wizOpen is true while that tab shows).
        wizOpen: false, wizSrc: "", wizCands: [], wizCols: [], wizColN: {}, wizScanned: 0,
        // Custom menu entries live as DEFINITIONS (key set + carried columns);
        // every rescan recomputes their closure and weaves them back into the
        // tree, so a refresh or a scan-window change never drops them.
        wizCustom: [],
        wizCap: "50k", wizSel: "", wizPick: {}, wizFact: true,
        previewOn: "",   // banner label while a dim preview takes over the output side
        previewMode: "report", previewData: null,
        loaded: "",
        // The input side is one or more named batches (datasets). combine on:
        // Run computes each fn against the whole stack (tagCol, when named,
        // adds each batch's name to its rows so dumps stay distinguishable);
        // combine off: Run computes each fn once per batch. Either way every
        // output lives in tab.outs keyed by SCOPE ("__all" for the combined
        // stack, else a batch name), and the inspection scope picker can open
        // any scope of any tab: one not computed by the last Run computes on
        // demand. The Combine switch therefore decides what Run targets and
        // what the bundle exports, never what may be looked at.
        datasets: [], combine: true, tagCol: "", scope: "__all", editingDs: -1, addOpen: false,
        curV: "csv", split: 50, drag: false, hot: false, collapsed: false,
        // Pivot state. pvCols/pvNum/pvN are the scan; pvDims is ORDERED (the
        // click order is the nesting order), pvMeasure names one numeric column,
        // pvAgg picks the aggregate, pvSrc is the cheap identity that says when
        // the rows underneath changed and the scan has to run again.
        pvCols: [], pvIsNum: {}, pvN: {}, pvDec: {}, pvDims: [], pvColDims: [], pvMeasure: "", pvAgg: "sum", pvDrag: "",
        pvSrc: "", pvOut: null,
        // The Layout view's derived state: the model built off pvOut.res and the
        // markup drawn from it. Derived, never edited, so nothing here persists.
        rpHtml: "", rpModel: null,
        // Which reading of the same partition to print. Source is the default
        // because this view draws a REPORT: an analyst's block order carries a
        // convention a magnitude sort destroys, "Other" last being the usual
        // one. The Pivot view beside it keeps reading by size, which is what it
        // is for, so the two panes answer different questions on purpose.
        rpOrder: "source",
        running: false, progress: "", progressBase: "",
        bndSplit: 50, bndDrag: false,
        // The lower pane under the viewer: its tab (overview, dims, bundle)
        // and whether it is open. bndOpen and wizOpen follow it (syncLower).
        lowerTab: "overview", lowerOpen: true,
        // Clear all is armed by its first tap and run by a second.
        clearArm: false,
        wrapF: true, copF: false, copR: false, copB: false, copL: false,
        bndOpen: false,
        profileData: {},
        recipes: [],
        // The two inspection views; the bundle is not one of them (it is the
        // export artifact, operated from its own panel beside copy/download).
        views: [
          { k: "csv", l: "Data" },
          { k: "profile", l: "Profile" },
          { k: "pivot", l: "Pivot" },
          // The same partition Pivot computes, drawn as a printed report. Named
          // Layout rather than Report because this pane already spends the word
          // "report" on the dim-preview's assessment rows, three lines apart in
          // the markup below.
          { k: "layout", l: "Layout" },
        ],
        tabs: [],

        init() {
          if (typeof ClipboardJS !== "undefined" && !window.TransformWorkbench._clip)
            window.TransformWorkbench._clip = new ClipboardJS(".tf-copy-btn");
          this.recipes = (opts.recipes || []).filter(r => r && r.fnSrc);
          this.tabs = [this.identityTab()];
          this.active = 0;
          if (opts.persist) this.restoreTabs();
          this.$root.__workbench = this;
        },

        // ---- the host entry point: rows from a picker, a fetch, anywhere ----
        // meta: { label, seed: [recipe names], collapse, append }. Identity
        // auto-runs. The editor stays open unless a host passes collapse:
        // true; it used to collapse by default, until the workbench opened as
        // four even panes (2026-10-23). append adds the rows as a new batch
        // instead of replacing the loaded data.
        async loadRows(rows, meta) {
          meta = meta || {};
          if (meta.ref) this.addDataset(rows, meta.label, { ref: true });
          else if (meta.append && this.datasets.length) this.addDataset(rows, meta.label);
          else this.ingest(rows, meta.label);
          this.loaded = meta.label || "";
          for (const nm of (meta.seed || [])) {
            if (this.tabs.some(t => t.name === nm)) continue;
            const r = this.recipes.find(x => x.name === nm);
            if (r) this.tabs.push(this.blankTab(r.name, r.fnSrc));
          }
          this.collapsed = meta.collapse === true;
          if (this.raw.length) await this.run();
        },
        // Several named batches at once, replacing what was loaded: a
        // workbook's sheets. One restack and one run, where loadRows per batch
        // would re-run the pipeline once per sheet. batches: [{ name, rows,
        // ref }]; meta: { label, combine, collapse }. combine defaults off,
        // since batches handed over together are usually different tables.
        async loadBatches(batches, meta) {
          meta = meta || {};
          this.datasets = [];
          for (const b of batches || []) {
            const clean = (b.rows || []).filter(r => Object.values(r).some(v => v !== ""));
            this.datasets.push({ name: this.dsUnique(this.dsSafe(b.name)), rows: clean, ref: !!b.ref });
          }
          this.combine = !!meta.combine;
          this.refreshInput();
          this.loaded = meta.label || "";
          this.collapsed = meta.collapse === true;
          if (this.raw.length) await this.run();
        },

        // ---- tabs ----
        blankTab(name = "", fnSrc = "rows => rows") {
          return { name, fnSrc, fnGz: "", err: null, ok: false, rows: [], dirty: false, fixed: false, outs: {} };
        },
        // The universal identity tab: the stable, always-present default. Reads
        // the host's universal-scope recipe; falls back to `rows => rows`.
        // Marked `fixed`, so remove() and clear() keep it.
        identityTab() {
          const id = this.recipes.find(r => r.scope === "universal");
          return Object.assign(this.blankTab(id ? id.name : "identity", id ? id.fnSrc : "rows => rows"), { fixed: true });
        },
        addableRecipes() { return this.recipes.filter(r => r.scope !== "universal" && !this.tabs.some(t => t.name === r.name)); },
        addRecipe(name) {
          if (!name) return;
          const existing = this.tabs.findIndex(t => t.name === name);
          if (existing >= 0) { this.active = existing; return; }
          const r = this.recipes.find(x => x.name === name);
          if (!r) return;
          this.tabs.push(this.blankTab(r.name, r.fnSrc));
          this.active = this.tabs.length - 1;
          this.saveTabs();
          if (this.ran) this.$nextTick(() => this.syncSurfaces());
        },
        add() {
          let n = this.tabs.length + 1;
          while (this.tabs.some(t => t.name === "fn" + n)) n++;
          this.tabs.push(this.blankTab("fn" + n));
          this.active = this.tabs.length - 1;
          this.saveTabs();
        },
        remove(i) {
          if (this.tabs.length < 2 || this.tabs[i].fixed) return;   // the last tab always stays
          this.tabs.splice(i, 1);
          if (i < this.active) this.active--;
          else if (this.active >= this.tabs.length) this.active = this.tabs.length - 1;
          this.saveTabs();
          this.invalidateBundle();
          if (this.ran) this.$nextTick(() => this.syncSurfaces());
        },
        setActive(i) {
          if (this.editing !== -1 || i === this.active) return;
          this.active = i;
          this.scanSoon();
          if (this.ran) this.$nextTick(() => this.syncSurfaces());
        },
        startEdit(i) { this.editing = i; },
        finishEdit() {
          if (this.editing === -1) return;
          this.editing = -1;
          this.saveTabs();
          this.invalidateBundle();
          if (this.ran) this.$nextTick(() => this.syncSurfaces());
        },

        // ---- the dimension pane ----
        // Mechanical star-schema help, a tab of the lower pane under the
        // viewer, beside Overview and Bundle. It describes the ACTIVE fn (rows,
        // columns, which $refs it reads, who reads it), scans that fn's output
        // for functional dependencies (key -> attribute), folds into each
        // candidate every column its key can express (Program Index absorbing
        // Program), and generates ordinary editable dim/fact tabs from a
        // finding or from hand-picked column pills. The scan re-runs on Run
        // and on tab switch, never per keystroke. The generated dim fn
        // re-checks the dependency on every run and reports conflicts, so
        // dirty reference data surfaces instead of silently keeping the first
        // spelling.
        toggleWizard() { this.setLower("dims"); },
        wizSrcTab() { return this.tabs.find(t => (t.name || "identity") === this.wizSrc) || this.tabs[0]; },
        // What the active fn is, in one line: shape plus both directions of
        // its $ref relationships.
        wizInfo() {
          const t = this.tabs[this.active] || {};
          const refs = s => this.refNames(s);
          return {
            name: t.name || "identity",
            reads: refs(t.fnSrc),
            readBy: this.tabs.filter(x => x !== t && t.name && refs(x.fnSrc).includes(t.name)).map(x => x.name),
            rows: (t.rows || []).length,
            cols: t.rows?.length ? Object.keys(t.rows[0]).length : 0,
          };
        },
        cyclePick(c) { this.wizPick[c] = ((this.wizPick[c] || 0) + 1) % 3; this.wizSel = ""; },
        clearPick() { this.wizPick = {}; this.wizSel = ""; },
        // A menu entry's key may be one column or several; its display label.
        kLabel(c) { return (Array.isArray(c.key) ? c.key : [c.key]).join(" + "); },
        candKeys(c) { return Array.isArray(c.key) ? c.key : [c.key]; },
        // Selecting a menu entry paints its columns onto the sidebar pills:
        // key blue, carried columns dark. The pills stay editable from there.
        selectCand(c) {
          const keys = this.candKeys(c);
          this.wizSel = this.kLabel(c);
          const pick = {};
          for (const k of keys) pick[k] = 2;
          for (const col of c.cols.filter(x => !keys.includes(x))) pick[col] = 1;
          this.wizPick = pick;
        },
        wizCapRows() { return this.wizCap === "all" ? Infinity : 50000; },
        // The current pick's key set; with no key designated, all picked
        // columns act as the (compound) key.
        pickKeys() {
          const keys = this.wizCols.filter(c => this.wizPick[c] === 2);
          return keys.length ? keys : this.wizCols.filter(c => this.wizPick[c] === 1);
        },
        // Promote the current pick to a menu entry: store its definition,
        // rescan (which computes what the key set delineates and weaves the
        // entry into the tree), then paint the result back so the sidebar
        // shows what came along. A single key the scan already lists is the
        // same entry, so it is selected rather than duplicated.
        addToMenu() {
          const keys = this.pickKeys();
          if (!keys.length) return;
          const attrs = this.wizCols.filter(c => this.wizPick[c] === 1 && !keys.includes(c));
          const label = keys.join(" + ");
          if (!this.wizCands.some(c => !c.custom && this.kLabel(c) === label)) {
            this.wizCustom = this.wizCustom.filter(d => d.keys.join(" + ") !== label);
            this.wizCustom.push({ keys, attrs });
          }
          this.scanDims();
          const entry = this.wizCands.find(c => this.kLabel(c) === label);
          if (entry) this.selectCand(entry);
        },
        removeCustom(c) {
          const label = this.kLabel(c);
          this.wizCustom = this.wizCustom.filter(d => d.keys.join(" + ") !== label);
          this.scanDims();
        },
        // Columns an entry COULD delineate but does not: lower (or equal)
        // cardinality, not already carried. The convenient add-and-test list.
        wizSuggest(c) {
          return this.wizCols.filter(x => !c.cols.includes(x) && (this.wizColN[x] || 0) > 1 && this.wizColN[x] <= c.nKeys);
        },
        // Preview the pick as a full takeover of the output side, in two
        // views the banner switches between. The REPORT gives, per tested
        // column, the number of keys that split (0 when cleanly delineated)
        // and the worst key with its values. The DIM TABLE is the resulting
        // dimension itself, made key-unique the most straightforward way: a
        // key whose attributes split gets an index suffix per extra combo
        // (K, K·2, ...), each such row flagged in a filterable conflict
        // column and sorted to the top, so the problem rows are the visible
        // instrument rather than a silent first-seen pick. Runs over the
        // FULL rows; no tab is created; any normal sync reclaims the viewer.
        previewPick() {
          const keys = this.pickKeys();
          if (!keys.length) return;
          const picked = this.wizCols.filter(c => this.wizPick[c] === 1 && !keys.includes(c));
          const bound = keys.length === 1 ? (this.wizColN[keys[0]] || Infinity) : Infinity;
          const attrs = picked.length ? picked
            : this.wizCols.filter(c => !keys.includes(c) && (this.wizColN[c] || 0) > 1 && this.wizColN[c] <= bound);
          if (!attrs.length) return;
          const all = Alpine.raw(this.wizSrcTab()?.rows || []);
          const CMB = 12;   // combos kept per key; past this the count says "12+"
          const seen = new Map();   // key -> { keyVals, combos: Map(json -> attr obj), colSets: {col -> Set} }
          for (const r of all) {
            const k = keys.length === 1 ? r[keys[0]] : JSON.stringify(keys.map(c => r[c]));
            let e = seen.get(k);
            if (!e) { e = { keyVals: keys.map(c => r[c]), combos: new Map(), colSets: {} }; seen.set(k, e); }
            const combo = Object.fromEntries(attrs.map(c => [c, r[c]]));
            const cj = JSON.stringify(combo);
            if (!e.combos.has(cj) && e.combos.size < CMB) e.combos.set(cj, combo);
            for (const c of attrs) {
              const s = e.colSets[c] ??= new Set();
              if (s.size <= 5) s.add(r[c]);
            }
          }
          const nKeys = seen.size;
          const report = attrs.map(c => {
            let varying = 0, worstK = null, worstN = 1;
            for (const [k, e] of seen) {
              const n = e.colSets[c].size;
              if (n > 1) { varying++; if (n > worstN) { worstN = n; worstK = k; } }
            }
            return {
              Column: c,
              Distinct: this.wizColN[c] ?? "",
              "Split keys": varying,
              "Of keys": nKeys,
              "Worst key": worstK == null ? "" : String(worstK) + " → " + [...seen.get(worstK).colSets[c]].slice(0, 4).join(" | ") + (worstN > 4 ? " …" : ""),
            };
          }).sort((a, b) => b["Split keys"] - a["Split keys"]);
          const dim = [];
          const entries = [...seen.values()].sort((a, b) => (b.combos.size > 1 ? 1 : 0) - (a.combos.size > 1 ? 1 : 0));
          for (const e of entries) {
            const combos = [...e.combos.values()], n = combos.length;
            combos.forEach((combo, i) => {
              const row = {};
              keys.forEach((c, ki) => row[c] = ki === 0 && i > 0 ? String(e.keyVals[ki]) + "·" + (i + 1) : e.keyVals[ki]);
              Object.assign(row, combo);
              row["⚠"] = n > 1 ? (i + 1) + "/" + (n >= CMB ? CMB + "+" : n) : "";
              dim.push(row);
            });
          }
          const splitKeys = entries.filter(e => e.combos.size > 1).length;
          this.previewData = {
            report, dim,
            label: keys.join(" + ") + " · " + nKeys.toLocaleString() + " keys · " + attrs.length + " column" + (attrs.length > 1 ? "s" : "") + " · " + (splitKeys ? splitKeys.toLocaleString() + " keys split" : "clean"),
          };
          this.sendPreview();
        },
        sendPreview() {
          const p = this.previewData;
          if (!p) return;
          const rows = this.previewMode === "report" ? p.report : p.dim;
          this.sendToViewer(this.previewMode === "report" ? "dim-assess.json" : "dim-preview.json", this.previewJson(rows), "table", rows, "preview");
          this.previewOn = p.label;
        },
        wizRefsLine() {
          const i = this.wizInfo();
          return [
            i.reads.length ? "reads " + i.reads.map(n => "$" + n).join(", ") : "",
            i.readBy.length ? "read by " + i.readBy.join(", ") : "",
          ].filter(Boolean).join(" · ");
        },
        // THE PANES ARE OPEN BY DEFAULT, so their refreshes must not ride the
        // click. The dimension scan reads every row of the active output and
        // ran inside each batch and tab switch before the grid painted; it now
        // runs after the next paint, and a later switch replaces a pending one.
        // Opening the pane, the scan-window select and the rescan button still
        // scan at once.
        scanSoon() {
          if (!this.wizOpen) return;
          const seq = ++scanSeq;
          afterPaint(() => { if (seq === scanSeq && this.wizOpen) this.scanDims(); });
        },
        scanDims() {
          const CAP = this.wizCapRows();   // the header's "check N rows" parameter
          this.wizSrc = (this.tabs[this.active] || this.tabs[0]).name || "identity";
          const all = Alpine.raw(this.wizSrcTab()?.rows || []);
          const rows = all.length > CAP ? all.slice(0, CAP) : all;
          Object.assign(this, { wizScanned: rows.length, wizCands: [], wizCols: [], wizColN: {}, wizSel: "", wizPick: {} });
          if (!rows.length) return;
          const cols = [...new Set(rows.slice(0, 500).flatMap(r => Object.keys(r)))];
          this.wizCols = cols;
          const distinct = {};
          for (const c of cols) { const s = new Set(); for (const r of rows) s.add(r[c]); distinct[c] = s.size; }
          this.wizColN = distinct;
          // Key candidates: not constant, not row-unique. For each, one pass
          // finds every column it determines; a column is dropped from the
          // live set at its first violation, and K -> C requires
          // distinct(C) <= distinct(K), so most pairs exit within a few rows.
          const dets = {};
          for (const key of cols) {
            if (distinct[key] < 2 || distinct[key] >= rows.length) continue;
            const first = new Map(), live = new Set(cols.filter(c => c !== key && distinct[c] > 1 && distinct[c] <= distinct[key]));
            for (const r of rows) {
              if (!live.size) break;
              const f = first.get(r[key]);
              if (!f) { first.set(r[key], r); continue; }
              for (const c of live) if (f[c] !== r[c]) live.delete(c);
            }
            if (live.size) dets[key] = live;
          }
          // Entities: every found single-column candidate plus each stored
          // custom key set (closure recomputed here, so rescans refresh them
          // rather than drop them), woven into one rollup tree by the same
          // delineation relation: a entity absorbs another whose key columns
          // it can all express. The most detailed entity is the parent and
          // each coarser one nests under it; a mutual (1:1) pair keeps the
          // wider or earlier one on top, and the seen set stops the cycle a
          // mutual pair would otherwise recurse into.
          // No early exit here: nKeys must count every key in the window even
          // after the last live column has violated, or a custom entry shows
          // an undercounted cardinality (measured: 67 shown for a 108-distinct
          // key).
          const closure = keys => {
            const first = new Map(), live = new Set(cols.filter(c => !keys.includes(c) && distinct[c] > 1));
            for (const r of rows) {
              const k = keys.length === 1 ? r[keys[0]] : JSON.stringify(keys.map(c => r[c]));
              const f = first.get(k);
              if (!f) { first.set(k, r); continue; }
              for (const c of live) if (f[c] !== r[c]) live.delete(c);
            }
            return { det: live, nKeys: first.size };
          };
          const ents = Object.keys(dets).map(key => ({
            keys: [key], keySet: new Set([key]), det: dets[key], nKeys: distinct[key],
            cols: [key, ...cols.filter(c => dets[key].has(c))], order: cols.indexOf(key), custom: false,
          }));
          for (const d of this.wizCustom) {
            if (!d.keys.every(c => cols.includes(c))) continue;             // built on another tab's columns
            if (d.keys.length === 1 && dets[d.keys[0]]) continue;           // the scan already lists it
            const { det, nKeys } = closure(d.keys);
            ents.push({ keys: d.keys, keySet: new Set(d.keys), det, nKeys,
              cols: [...d.keys, ...cols.filter(c => det.has(c) || d.attrs.includes(c))],
              order: cols.length + this.wizCustom.indexOf(d), custom: true });
          }
          const absorbs = (a, b) => b.keys.every(k => a.keySet.has(k) || a.det.has(k));
          const absorbed = new Set();
          for (const a of ents) for (const b of ents) {
            if (a === b || !absorbs(a, b)) continue;
            if (absorbs(b, a)) {
              if (b.det.size > a.det.size) continue;
              if (b.det.size === a.det.size && b.order < a.order) continue;
            }
            absorbed.add(b);
          }
          const childrenOf = a => {
            const list = ents.filter(b => b !== a && absorbs(a, b));
            return list.filter(b => !list.some(c => c !== b && absorbs(c, b) && !absorbs(b, c)));
          };
          const flatten = (e, depth, out, seen) => {
            if (seen.has(e)) return out;
            seen.add(e);
            out.push({ key: e.keys.length === 1 ? e.keys[0] : e.keys, cols: e.cols, nKeys: e.nKeys, depth, custom: e.custom });
            for (const c of childrenOf(e).sort((x, y) => y.det.size - x.det.size)) flatten(c, depth + 1, out, seen);
            return out;
          };
          const seen = new Set();
          this.wizCands = ents.filter(e => !absorbed.has(e))
            .sort((x, y) => y.det.size - x.det.size)
            .flatMap(e => flatten(e, 0, [], seen));
        },
        dimName(seed) {
          const base = "dim_" + String(seed).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30);
          let n = base, i = 2;
          while (this.tabs.some(t => t.name === n)) n = base + "_" + i++;
          return n;
        },
        // A dim's key may be one column, several (compound), or none (a plain
        // distinct table); stored as an array on the tab's dim meta.
        dimKeysOf(d) { return Array.isArray(d.key) ? d.key : d.key ? [d.key] : []; },
        // Generated code references the source tab by $ref where its name is a
        // valid token; otherwise it falls back to the input stack.
        wizRef() { return /^\w+$/.test(this.wizSrc) ? "$" + this.wizSrc : "rows"; },
        genDimSrc(name, keys, attrs) {
          const q = JSON.stringify;
          const all = [...keys, ...attrs];
          const pick = "{ " + all.map(c => q(c) + ": r[" + q(c) + "]").join(", ") + " }";
          const keyExpr = keys.length === 1 ? "r[" + q(keys[0]) + "]"
            : "JSON.stringify([" + (keys.length ? keys : all).map(c => "r[" + q(c) + "]").join(", ") + "])";
          const checks = keys.length ? attrs.map(c => "seen[" + q(c) + "] !== r[" + q(c) + "]").join(" || ") : "";
          return [
            "rows => {",
            "  const m = new Map();",
            checks ? "  let conflicts = 0;" : null,
            "  for (const r of " + this.wizRef() + ") {",
            "    const k = " + keyExpr + ";",
            checks ? "    const seen = m.get(k);" : null,
            checks ? "    if (!seen) m.set(k, " + pick + ");" : "    if (!m.has(k)) m.set(k, " + pick + ");",
            checks ? "    else if (" + checks + ") conflicts++;" : null,
            "  }",
            checks ? "  if (conflicts) console.warn(" + q(name) + " + \": \" + conflicts + \" rows disagree with their key's first-seen attributes\");" : null,
            "  return [...m.values()];",
            "}",
          ].filter(Boolean).join("\n");
        },
        // The pane stays put and the source tab stays active: added tabs
        // appear in the strip marked dirty, waiting for the next Run.
        addDim(cand) {
          if (!this.wizSrc) this.wizSrc = (this.tabs[this.active] || this.tabs[0]).name || "identity";
          const keys = Array.isArray(cand.key) ? cand.key : cand.key ? [cand.key] : [];
          const attrs = cand.cols.filter(c => !keys.includes(c));
          const name = this.dimName((keys.length ? keys : attrs).join("_"));
          this.tabs.push(Object.assign(this.blankTab(name, this.genDimSrc(name, keys, attrs)),
            { dirty: true, dim: { key: keys, cols: [...keys, ...attrs], src: this.wizSrc } }));
          if (this.wizFact) this.updateFactTab();
          this.saveTabs();
          this.invalidateBundle();
        },
        addManualDim() {
          const keys = this.wizCols.filter(c => this.wizPick[c] === 2);
          const attrs = this.wizCols.filter(c => this.wizPick[c] === 1);
          if (!keys.length && !attrs.length) return;
          this.addDim({ key: keys, cols: [...keys, ...attrs] });
          this.wizPick = {};
        },
        // The fact companion: one generated tab dropping every column a dim
        // expresses, keys kept. Regenerated whole on each addDim; it carries a
        // gen marker so a hand-made tab named fact is never overwritten.
        updateFactTab() {
          const drop = [...new Set(this.tabs.flatMap(t => t.dim ? t.dim.cols.filter(c => !this.dimKeysOf(t.dim).includes(c)) : []))];
          const q = JSON.stringify;
          const src = drop.length
            ? "rows => " + this.wizRef() + ".map(({ " + drop.map((c, i) => q(c) + ": _" + i).join(", ") + ", ...rest }) => rest)"
            : "rows => " + this.wizRef();
          const existing = this.tabs.find(t => t.gen === "fact");
          if (existing) { existing.fnSrc = src; existing.dirty = true; return; }
          let name = "fact", i = 2;
          while (this.tabs.some(t => t.name === name)) name = "fact_" + i++;
          this.tabs.push(Object.assign(this.blankTab(name, src), { dirty: true, gen: "fact" }));
        },

        // ---- the standalone function cache (opts.persist) ----
        // Only names and sources ride localStorage; data never does.
        saveTabs() {
          if (!opts.persist) return;
          try {
            localStorage.setItem(storageKey, JSON.stringify({ tabs: this.tabs.map(t => ({ name: t.name, fnSrc: t.fnSrc, fixed: !!t.fixed, dim: t.dim, gen: t.gen })) }));
          } catch (e) {}
        },
        restoreTabs() {
          try {
            if (opts.formerKey && localStorage.getItem(storageKey) === null) {
              const was = localStorage.getItem(opts.formerKey);
              if (was !== null) localStorage.setItem(storageKey, was);
            }
            if (opts.formerKey) localStorage.removeItem(opts.formerKey);
            const s = JSON.parse(localStorage.getItem(storageKey) || "null");
            if (s?.tabs?.length) {
              this.tabs = s.tabs.map(t => Object.assign(this.blankTab(t.name, t.fnSrc), { fixed: !!t.fixed, dim: t.dim, gen: t.gen }));
              this.active = 0;
            }
          } catch (e) {}
        },

        // ---- compression / source ----
        async zip(s) {
          const cs = new CompressionStream("gzip"), w = cs.writable.getWriter();
          w.write(new TextEncoder().encode(s)); w.close();
          const b = await new Response(cs.readable).blob();
          return new Promise(r => Object.assign(new FileReader(), { onload: e => r(e.target.result.split(",")[1]) }).readAsDataURL(b));
        },
        async unzip(b) {
          const ds = new DecompressionStream("gzip"), w = ds.writable.getWriter();
          w.write(window.GH.decodeBytes(b)); w.close();
          return new Response(ds.readable).text();
        },
        async ensureSrcGz() {
          for (const d of this.datasets) {
            if (!this.selOf(this.srcKeyOf(d.name)) || !d.rows.length || this.srcGz[d.name]) continue;
            this.srcGz[d.name] = await this.zip(JSON.stringify(colFromRows(Alpine.raw(d.rows))));
          }
        },
        // Bundle membership is chosen key by key in the pane's checklist; the
        // defaults (outputs in, source batches out) match the old fixed shape.
        selOf(k) { return this.bndSel[k] ?? !k.startsWith("src"); },
        srcKeyOf(name) {
          const soloAuto = this.datasets.length === 1 && /^d\d*$/.test(this.datasets[0].name);
          return soloAuto ? "src" : "src_" + name;
        },
        async toggleBndKey(k) {
          this.bndSel[k] = !this.selOf(k);
          if (!this.ran) return;
          this.bundle = "";   // recompose; the gzips stay cached
          await this.ensureBundle();
        },

        // ---- paste + drop + load ----
        handlePaste(e) { return this.processText(e.clipboardData.getData("text").trim()); },
        async handleDrop(e) {
          this.hot = false;
          const f = e.dataTransfer.files[0];
          if (f) return this.processText((await f.text()).trim());
        },
        async processText(t) {
          if (!t) return;
          try {
            if (t.startsWith("{")) {
              const o = JSON.parse(t);
              const fnKeys = Object.keys(o).filter(k => (k === "fn" || k.startsWith("fn_")) && typeof o[k] === "string");

              if (fnKeys.length) {
                const meta = o.meta && typeof o.meta === "object" ? o.meta : null;
                const fnNames = fnKeys.map(fk => fk === "fn" ? "" : fk.slice(3));
                const newTabs = (await Promise.all(fnKeys.map(async (fk, fi) => {
                  const name = fnNames[fi];
                  const fnSrc = await this.unzip(o[fk]);
                  const tab = { ...this.blankTab(name, fnSrc), fnGz: o[fk] };
                  const dk = name ? "data_" + name : "data";
                  if (typeof o[dk] === "string") {
                    tab.outs.__all = { rows: rowsFromCol(JSON.parse(await this.unzip(o[dk]))), jGz: o[dk] };
                    return tab;
                  }
                  // Separate-mode outputs: data_<fn>__<batch>. Another fn's
                  // single key can look like this shape, so exact fn names win.
                  const pre = "data_" + (name || "fn") + "__";
                  const dsKeys = Object.keys(o).filter(k => k.startsWith(pre) && typeof o[k] === "string" && !fnNames.includes(k.slice(5)));
                  if (!dsKeys.length) return null;
                  for (const key of dsKeys) {
                    const rows = rowsFromCol(JSON.parse(await this.unzip(o[key])));
                    tab.outs[key.slice(pre.length)] = { rows, jGz: o[key] };
                  }
                  return tab;
                }))).filter(Boolean);

                if (newTabs.length) {
                  this.tabs = newTabs;
                  this.active = 0;
                  // Batches ride src (legacy single) / src_<batch> keys; a
                  // bundle without them rehydrates output-only, as before.
                  this.datasets = []; this.srcGz = {};
                  if (typeof o.src === "string") {
                    this.datasets.push({ name: "d1", rows: rowsFromCol(JSON.parse(await this.unzip(o.src))) });
                    this.srcGz.d1 = o.src;
                  }
                  for (const k of Object.keys(o)) {
                    if (!k.startsWith("src_") || typeof o[k] !== "string") continue;
                    this.datasets.push({ name: k.slice(4), rows: rowsFromCol(JSON.parse(await this.unzip(o[k]))) });
                    this.srcGz[k.slice(4)] = o[k];
                  }
                  this.bndSel = {};
                  for (const k of Object.keys(o)) if (k === "src" || k.startsWith("src_")) this.bndSel[k] = true;
                  if (meta && meta.dims) for (const t of this.tabs) if (meta.dims[t.name]) t.dim = meta.dims[t.name];
                  this.combine = meta ? !!meta.combine : true;
                  this.tagCol = (meta && meta.tagCol) || "";
                  this.raw = this.stacked();
                  this.scope = this.combine ? "__all" : (this.datasets[0]?.name || this.scopeOptions()[0] || "__all");
                  Object.assign(this, { bundle: t, bundleSz: sizeOf(t), bundleObj: o, ran: true, profileData: {} });
                  this.mirrorScope();
                  if (typeof opts.onIngest === "function") try { opts.onIngest(this.raw); } catch (e) {}
                  this.saveTabs();
                  return this.$nextTick(() => this.syncSurfaces());
                }
              }
            }
            const cleanT = t.replace(/\s/g, "");
            if (/^[A-Za-z0-9+/=]+$/.test(cleanT)) return this.load(await this.unzip(cleanT));
          } catch (e) {}
          this.load(t);
        },
        load(t) {
          let d;
          try { d = JSON.parse(t); } catch (e) { d = Papa.parse(t, { header: true, skipEmptyLines: true }).data; }
          if (d && !Array.isArray(d)) d = rowsFromCol(d);
          this.loaded = "";
          // A first paste starts the data and auto-runs. A later one is the
          // next dump of the same shape: it appends as a new batch but does
          // NOT re-run, so dumping five batches costs five appends and one
          // Run, not five full pipelines. The output pane's "Run to see
          // output" state marks the results as stale until then.
          if (this.datasets.length) { this.addDataset(d || []); return; }
          this.ingest(d || []);
          // A first paste is the intake gesture: show it at once, editor open.
          if (this.raw.length) { this.collapsed = false; this.run(); }
        },
        // What a fn's source reads as $name, by the worker's rule: an
        // identifier after $, or any batch or tab name, since a sheet's name
        // may start with a digit and "$1" in a string must not count.
        refNames(src) {
          const known = new Set([...this.datasets.map(d => d.name), ...this.tabs.map(t => t.name).filter(Boolean)]);
          return [...new Set([...String(src || "").matchAll(/\$(\w+)/g)].map(m => m[1])
            .filter(n => /^[A-Za-z_]/.test(n) || known.has(n)))];
        },
        // ---- batches (datasets) ---------------------------------------------
        // A BATCH'S PEEK is the house hover card (kits/source-peek.js) over its
        // rows as CSV, so "which sheet was that" is answered without leaving
        // the chip strip. Seeded on the first hover of each batch rather than
        // at load: a workbook arrives as several batches at once, and building
        // CSV for sheets nobody hovers would be paid on the path that is
        // already the slowest. The whole batch is seeded (to 5,000 rows) so the
        // card's "first 28 of N lines" is true. No card without the kit.
        // The key is the card's heading, so it carries the batch's size.
        peekKey(d) {
          if (!d) return "";
          const rows = Alpine.raw(d.rows);
          const cols = new Set();
          for (const r of rows.slice(0, 200)) for (const k in r) cols.add(k);
          return d.name + " · " + rows.length.toLocaleString() + " rows · " + cols.size + " columns";
        },
        seedPeek(d) {
          const P = window.SourcePeek;
          if (!P || !d || typeof Papa === "undefined") return;
          const rows = Alpine.raw(d.rows);
          const key = this.peekKey(d);
          if (peekSeeded.get(rows) === key) return;
          peekSeeded.set(rows, key);
          P.seed(key, Papa.unparse(rows.length > 5000 ? rows.slice(0, 5000) : rows));
        },
        // A batch name doubles as the tag value and the bundle key, so it stays
        // in [A-Za-z0-9_] and unique.
        dsSafe(n) { return String(n || "").replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, ""); },
        dsUnique(base) {
          let n = base || "d" + (this.datasets.length + 1), i = 2;
          while (this.datasets.some(d => d.name === n)) n = (base || "d") + "_" + i++;
          return n;
        },
        isCombined() { return this.combine; },
        // The combined input as row references only: no tagging and no row
        // copies here, so the page holds one resident copy of the data. The
        // tag column (when named) is applied inside the worker, and in
        // rawFor() for the identity tabs that never visit it (the tag wins
        // over an incoming column of the same name; distinguishing dumps is
        // its whole point).
        stacked() {
          return this.datasets.filter(d => !d.ref).flatMap(d => (typeof Alpine !== "undefined" && Alpine.raw) ? Alpine.raw(d.rows) : d.rows);
        },
        // The batches that are rows to transform; a reference batch is a $ref.
        inputSets() { return this.datasets.filter(d => !d.ref); },
        // Rows leave here bound for a worker postMessage, and a structured
        // clone throws on Alpine's reactive proxies, so unwrap at the source:
        // the raw stored array holds the plain row objects.
        rawFor(d) {
          const rows = (typeof Alpine !== "undefined" && Alpine.raw) ? Alpine.raw(d.rows) : d.rows;
          return this.tagCol ? rows.map(r => ({ ...r, [this.tagCol]: d.name })) : rows;
        },
        // ---- inspection scopes ----------------------------------------------
        // A scope names what Data and Profile speak about for the active tab:
        // "__all" is the combined stack, anything else a single batch. Options
        // come from the datasets, or (for an output-only bundle rehydrated
        // without source) from the keys the outputs themselves carry.
        scopeLabel(k) { return k === "__all" ? "Combined" : k; },
        scopeOptions() {
          if (this.inputSets().length) return ["__all", ...this.inputSets().map(d => d.name)];
          const t = this.tabs.find(x => x.outs && Object.keys(x.outs).length);
          return t ? Object.keys(t.outs) : [];
        },
        scopeActive() {
          const opts = this.scopeOptions();
          return opts.includes(this.scope) ? this.scope : (opts[0] || "__all");
        },
        // Change the inspection scope. A scope the last Run did not target
        // computes on demand (all tabs at once, so tab switching stays
        // instant), then mirrors into the display fields.
        async setScope(k) {
          this.scope = k;
          const idxs = this.tabs.flatMap((t, i) => (t.outs || {})[k] ? [] : [i]);
          if (idxs.length && this.raw.length && !this.running) {
            this.running = true;
            try { await this.computeScope(k, idxs); } finally { this.running = false; this.progress = ""; }
          }
          if (!this.ran && this.tabs.some(t => (t.outs || {})[k])) this.ran = true;
          this.mirrorScope();
          this.scanSoon();   // scope changed the rows under the pane
          this.$nextTick(() => this.syncSurfaces());
        },
        // Mirror the active scope's out onto each tab's display fields.
        mirrorScope() {
          const sk = this.scopeActive();
          for (const t of this.tabs) {
            const o = (t.outs || {})[sk];
            if (o && !o.err) Object.assign(t, { rows: o.rows, ok: true, err: null });
            else Object.assign(t, { rows: [], ok: false, err: (o && o.err) || null });
          }
        },
        // Replace everything with one batch (a first paste, a host loadRows).
        ingest(rows, name) {
          this.datasets = [];
          this.addDataset(rows, name);
        },
        // Append a batch (a later paste, + data, loadRows with append).
        addDataset(rows, name, opts = {}) {
          const clean = (rows || []).filter(r => Object.values(r).some(v => v !== ""));
          this.datasets.push({ name: this.dsUnique(this.dsSafe(name)), rows: clean, ref: !!opts.ref });
          this.addOpen = false;
          this.refreshInput();
        },
        removeDataset(i) {
          this.datasets.splice(i, 1);
          this.refreshInput();
        },
        startDsEdit(i) { this.editingDs = i; },
        finishDsEdit() {
          if (this.editingDs === -1) return;
          const d = this.datasets[this.editingDs];
          const keep = d.name; d.name = "";
          d.name = this.dsUnique(this.dsSafe(keep));
          this.editingDs = -1;
          // The name is a tag value and a bundle key, so outputs are stale.
          this.refreshInput();
          if (this.raw.length) this.run();
        },
        modeChanged() { this.refreshInput(); if (this.raw.length) this.run(); },
        // Any change to the input side: restack, reset every tab to unrun, show
        // the input in the viewer, tell the host.
        refreshInput() {
          this.raw = this.stacked();
          this.scope = this.isCombined() ? "__all" : (this.datasets[0]?.name || "__all");
          this.tabs.forEach(tab => Object.assign(tab, this.blankTab(tab.name, tab.fnSrc), { dirty: true, fixed: tab.fixed }));
          Object.assign(this, { ran: false, srcGz: {}, bundle: "", bundleSz: "", bundleObj: {}, profileData: {} });
          if (typeof opts.onIngest === "function") try { opts.onIngest(this.raw); } catch (e) {}
          const rows = (typeof Alpine !== "undefined" && Alpine.raw) ? Alpine.raw(this.raw) : this.raw;
          this.sendToViewer("raw_input.json", this.previewJson(rows), "table", rows, "input");
        },
        // In separate mode the views show one batch's output per tab; mirror the
        // picked batch's out onto the tab's display fields.

        // ---- run (async worker) ----
        runWorker(payload, onResult, onProgress) {
          return new Promise((resolve) => {
            const workerUrl = URL.createObjectURL(new Blob([TF_WORKER_SRC], { type: "application/javascript" }));
            const worker = new Worker(workerUrl);
            worker.onmessage = (e) => {
              if (e.data && e.data.progress) { if (onProgress) onProgress(e.data.progress); return; }
              if (e.data && e.data.result) return onResult(e.data.result);
              if (e.data && e.data.done) { worker.terminate(); URL.revokeObjectURL(workerUrl); resolve(); }
            };
            worker.postMessage(payload);
          });
        },
        // A literal identity tab never visits the worker: its output IS the
        // input, so it displays by reference (tagged copies only when a tag
        // column asks for them) instead of round-tripping the whole dataset.
        isIdentityFn(s) { return /^rows\s*=>\s*rows;?$/.test(String(s || "").trim()); },
        async run() {
          if (!this.raw.length || this.running) return;
          this.running = true;
          try { await this.runInner(); }
          finally { this.running = false; this.progress = ""; }
        },
        async runInner() {
          const refsOf = s => this.refNames(s);
          // Run targets the mode's scopes: the combined stack, or every batch.
          const targets = this.isCombined() ? ["__all"] : this.datasets.map(d => d.name);
          const needs = (t) => t.dirty || targets.some(sk => !(t.outs || {})[sk]);

          let changed = true;
          while (changed) {
            changed = false;
            for (const t of this.tabs) {
              if (needs(t)) continue;
              if (refsOf(t.fnSrc).some(n => {
                const dep = this.tabs.find(x => x.name === n);
                return dep && needs(dep);
              })) { t.dirty = true; changed = true; }
            }
          }

          const idxs = this.tabs.flatMap((t, i) => needs(t) ? [i] : []);
          if (idxs.length) {
            // A changed fn invalidates every scope it was ever computed for,
            // lazy ones included.
            for (const i of idxs) Object.assign(this.tabs[i], { outs: {}, fnGz: "", err: null });
            let ti = 0;
            for (const sk of targets) {
              this.progressBase = targets.length > 1 ? "batch " + sk + " (" + (++ti) + "/" + targets.length + ")" : "";
              await this.computeScope(sk, idxs);
            }
            for (const i of idxs) this.tabs[i].dirty = false;
            this.progressBase = "";
            // The bundle (fn/data gzips, src capture) is stale now; it
            // rebuilds lazily from its pane, a copy, or a download, and
            // eagerly only while the pane is open watching it.
            this.invalidateBundle();
            if (this.bndOpen) afterPaint(() => this.ensureBundle());
          }
          this.scope = this.isCombined() ? "__all" : (targets[0] || "__all");
          this.mirrorScope();
          this.ran = true;
          this.scanSoon();   // fresh outputs, fresh candidates
          this.$nextTick(() => this.syncSurfaces());
        },
        // Compute one scope's outputs for the given tab indexes: identity tabs
        // resolve by reference (tagged copies only under a tag column), the
        // rest go through a throwaway worker whose input is the scope's
        // batches. Used by Run for its targets and by the scope picker for
        // on-demand scopes.
        async computeScope(sk, idxs) {
          const tasks = [], skipped = [];
          for (const i of idxs) {
            const t = this.tabs[i];
            if (this.isIdentityFn(t.fnSrc)) skipped.push(i);
            else tasks.push({ i, name: t.name, fnSrc: t.fnSrc });
          }
          const inIdx = new Set(idxs);
          const d = sk === "__all" ? null : this.datasets.find(x => x.name === sk);
          for (const i of skipped) {
            const t = this.tabs[i];
            t.outs[sk] = { rows: d ? this.rawFor(d) : (this.tagCol ? this.inputSets().flatMap(x => this.rawFor(x)) : this.raw) };
          }
          if (!tasks.length) return;
          const base = this.progressBase || (sk === "__all" ? "" : "batch " + sk);
          let done = 0;
          this.progress = (base ? base + ": " : "") + "0/" + tasks.length + " fns";
          const seed = {};
          this.tabs.forEach((t, i) => {
            const o = !inIdx.has(i) && t.name && (t.outs || {})[sk];
            if (o && o.rows && o.rows.length) seed[t.name] = Alpine.raw(o.rows);
          });
          // EVERY BATCH IS A $name, offered only to a run whose fns name it.
          // It used to take a per-chip switch, which also kept the batch out of
          // the inputs; now any batch is readable as $name while it is also
          // transformed, and only a host's reference batch (loadRows with ref)
          // stays out of the inputs. Seeded by need, since the seed is cloned
          // to the worker on every run and a workbook can be many sheets.
          const named = new Set(tasks.flatMap(t => this.refNames(t.fnSrc)));
          for (const x of this.datasets) if (named.has(x.name) && !(x.name in seed)) seed[x.name] = Alpine.raw(x.rows);
          const seedAlias = skipped.map(i => this.tabs[i].name).filter(Boolean);
          const batches = (d ? [d] : this.inputSets()).map(x => ({ name: x.name, rows: Alpine.raw(x.rows) }));
          await this.runWorker({ batches, tagCol: this.tagCol, tasks, seed, seedAlias }, (res) => {
            this.tabs[res.i].outs[sk] = res.err ? { err: res.err } : { rows: res.rows };
            this.progress = (base ? base + ": " : "") + (++done) + "/" + tasks.length + " fns";
          }, (p) => { this.progress = (base ? base + ": " : "") + p.name + " (" + (done + 1) + "/" + tasks.length + ")"; });
        },
        invalidateBundle() { Object.assign(this, { bundle: "", bundleSz: "", bundleObj: {} }); },
        // Materialize the export side on demand: per-batch src gzips, each
        // ran tab's fn and data gzips, then the bundle string.
        async ensureBundle() {
          if (this.bundle || !this.ran) return;
          await this.ensureSrcGz();
          // The bundle carries the mode's target scopes only ("__all" combined,
          // else the batches); scopes computed for inspection alone stay out.
          const targets = this.isCombined() ? ["__all"] : this.datasets.map(d => d.name);
          // A target scope the user never Ran (they inspected a batch chip
          // and came straight here) computes now; without this the bundle
          // would emit only meta.
          const missing = targets.map(sk => [sk, this.tabs.flatMap((t, i) => (t.outs || {})[sk] ? [] : [i])])
            .filter(([, idxs]) => idxs.length);
          if (missing.length && this.raw.length && !this.running) {
            this.running = true;
            try { for (const [sk, idxs] of missing) await this.computeScope(sk, idxs); }
            finally { this.running = false; this.progress = ""; }
          }
          // The columnar form exists only here, transiently, one output at a
          // time: stringify, gzip, release.
          for (const t of this.tabs) {
            const outs = t.outs || {};
            if (!targets.some(sk => outs[sk] && outs[sk].rows)) continue;
            if (!t.fnGz) t.fnGz = await this.zip(t.fnSrc);
            for (const sk of targets) {
              const o = outs[sk];
              if (o && o.rows && !o.jGz) o.jGz = await this.zip(JSON.stringify(colFromRows(Alpine.raw(o.rows))));
            }
          }
          this.rebuildBundle();
        },
        // Every key the bundle COULD carry, in emit order. rebuildBundle and
        // the pane's checklist read the same plan, so they cannot disagree.
        // One auto-named batch keeps the legacy bare `src` key (srcKeyOf);
        // anything more writes src_<batch>, so boundaries survive round-trip.
        bundleKeyPlan() {
          const plan = this.datasets.map(d => ({ k: this.srcKeyOf(d.name), ds: d.name }));
          const used = new Set();
          for (const t of this.tabs) {
            const base = t.name.trim();
            let k = base, i = 2;
            while (used.has(k)) k = (base || "fn") + "_" + i++;
            used.add(k);
            plan.push({ k: k ? "fn_" + k : "fn", t, fn: true });
            if (this.isCombined()) plan.push({ k: k ? "data_" + k : "data", t, sk: "__all" });
            else for (const d of this.datasets) plan.push({ k: "data_" + (k || "fn") + "__" + d.name, t, sk: d.name });
          }
          return plan;
        },
        planGz(p) { return p.ds ? this.srcGz[p.ds] : p.fn ? p.t.fnGz : ((p.t.outs || {})[p.sk] || {}).jGz; },
        rebuildBundle() {
          const obj = {};
          for (const p of this.bundleKeyPlan()) {
            const gz = this.planGz(p);
            if (gz && this.selOf(p.k)) obj[p.k] = gz;
          }
          // meta is the one non-gz key: plain JSON, additive, ignored by older
          // parsers, and what makes combine/tagCol/batch names/dims round-trip.
          const dims = {};
          this.tabs.forEach(t => { if (t.dim) dims[t.name.trim() || "fn"] = t.dim; });
          if (this.datasets.length > 1 || this.tagCol || !this.isCombined() || Object.keys(dims).length) {
            obj.meta = { v: 2, combine: this.isCombined(), tagCol: this.tagCol, datasets: this.datasets.map(d => d.name) };
            if (Object.keys(dims).length) obj.meta.dims = dims;
          }
          const b = JSON.stringify(obj, null, 2);
          Object.assign(this, { bundle: b, bundleSz: sizeOf(b), bundleObj: obj });
        },

        // ---- views ----
        // The export payload is produced on demand (a click), never held in
        // state or a DOM attribute, and it follows the format on screen: the
        // Table mode copies and downloads CSV, the Raw and Editor modes JSON,
        // the Bundle view its manifest. Always the active tab's OUTPUT rows;
        // for the identity tab that is, by definition, the (tagged) input.
        async exportPayload(k) {
          if (k === "bundle") {
            await this.ensureBundle();
            return { text: this.bundle, ext: "json", mime: "application/json" };
          }
          const rows = k === "pivot"
            ? (this.pvOut?.rows || [])
            : k === "profile"
            ? (this.profileData?.rows || [])
            : Alpine.raw(this.tabs[this.active]?.rows || []);
          const mode = document.getElementById("tf-workbench")?.__viewer?.mode;
          if (mode === "raw" || mode === "tree")
            return { text: JSON.stringify(rows, null, 2), ext: "json", mime: "application/json" };
          return { text: Papa.unparse(rows), ext: "csv", mime: "text/csv" };
        },
        async writeClip(text) {
          try { await navigator.clipboard.writeText(text); }
          catch (e) { window.copy.legacy(text); }
        },
        async copyResult() {
          await this.writeClip((await this.exportPayload(this.curV)).text);
          this.flash("r");
        },
        async copyBundle() {
          await this.writeClip((await this.exportPayload("bundle")).text);
          this.copB = true; setTimeout(() => this.copB = false, 1000);
        },
        async dlBundle() {
          const p = await this.exportPayload("bundle");
          const u = URL.createObjectURL(new Blob([p.text], { type: p.mime }));
          Object.assign(document.createElement("a"), { href: u, download: "bundle.json" }).click();
          setTimeout(() => URL.revokeObjectURL(u), 100);
        },
        // The bundle panel's checklist: every possible key with its selection
        // state and built size (blank until its gzip exists). meta rides
        // whenever it is produced and is not electable.
        bundleRows() {
          const rows = this.bundleKeyPlan().map(p => {
            const gz = this.planGz(p);
            return { k: p.k, sel: this.selOf(p.k), sz: gz ? sizeOf(gz) : "" };
          });
          if (this.bundleObj.meta) rows.push({ k: "meta", sel: true, fixed: true, sz: "meta" });
          return rows;
        },
        toggleBundlePane() { this.setLower("bundle"); },
        // ---- the lower pane: Overview, Dimensions, Bundle ----
        // One tab shows at a time, and only it works: Dimensions scans while it
        // shows and Bundle builds while it shows, so a large paste is not
        // gzipped into a bundle nobody opened. A tap on the tab showing folds
        // the pane.
        setLower(tab) {
          if (this.lowerOpen && this.lowerTab === tab) this.lowerOpen = false;
          else { this.lowerTab = tab; this.lowerOpen = true; }
          this.syncLower();
        },
        syncLower() {
          const dims = this.lowerOpen && this.lowerTab === "dims", bnd = this.lowerOpen && this.lowerTab === "bundle";
          const was = { dims: this.wizOpen, bnd: this.bndOpen };
          this.wizOpen = dims; this.bndOpen = bnd;
          if (dims && !was.dims) this.scanDims();
          if (bnd && !was.bnd) this.ensureBundle();
        },
        // The Overview tab: what the workbench holds, as two lists. Each input
        // with its size and whether it is a reference a fn reads by $name;
        // each fn with what its last run made in the scope on screen, or why
        // it has nothing, and the $names it reads.
        overview() {
          const sk = this.scopeActive();
          const width = rows => rows && rows.length ? Object.keys(rows[0]).length : 0;
          const inputs = this.datasets.map(d => ({ name: d.name, ref: !!d.ref, rows: (d.rows || []).length, cols: width(d.rows) }));
          const fns = this.tabs.map((t, i) => {
            const o = (t.outs || {})[sk] || {};
            const err = o.err || t.err || "";
            const state = err ? "error" : !o.rows ? "not run" : t.dirty ? "changed, not rerun" : o.rows.length.toLocaleString() + " \u00d7 " + width(o.rows);
            return { i, name: t.name || "\u00b7", err, state, active: i === this.active, reads: this.refNames(t.fnSrc) };
          });
          const inRows = inputs.filter(d => !d.ref).reduce((n, d) => n + d.rows, 0);
          return { inputs, fns, inRows, scope: this.scopeLabel(sk) };
        },
        keepsLine() { return opts.persist ? "Function tabs are kept in this browser; data is not." : "Nothing here is kept in this browser."; },
        // The pane's own preview: the actual bundle JSON, capped as a preview;
        // Copy and Download carry it all.
        bundlePreview() {
          if (!this.ran) return "Run first; the bundle packs each fn's source with its output, gzipped.";
          if (!this.bundle) return "building…";
          const CAP = 4000;
          return this.bundle.length > CAP
            ? this.bundle.slice(0, CAP) + "\n\n… " + (this.bundle.length - CAP).toLocaleString() + " more characters (Copy and Download carry the whole bundle)"
            : this.bundle;
        },

        // Decoupled viewer dispatch (the tfViewer mounted in the markup below).
        // Rows travel by reference (the viewer's Table and Tree modes use them
        // directly); the string payload is only what the Raw mode shows, so it
        // is a capped preview, never a serialization of the whole dataset.
        sendToViewer(filename, payloadStr, targetMode = "table", data = null, key = null) {
          const v = document.getElementById("tf-workbench");
          if (v && v.__viewer) v.__viewer.show(filename, payloadStr, data, targetMode, key);
        },
        // What a Data or Profile grid shows: one tab's output for one batch.
        viewKey(kind) {
          return kind + "::" + (this.tabs[this.active]?.name || this.active) + "::" + this.scopeActive();
        },
        previewJson(rows) {
          const CAP = 500;
          const s = JSON.stringify(rows.slice(0, CAP), null, 2);
          return rows.length > CAP
            ? s + "\n\n… " + (rows.length - CAP).toLocaleString() + " more rows (the Raw preview is capped; Table, copy, and download carry them all)"
            : s;
        },
        switchTo(k) { this.curV = k; this.syncSurfaces(); },
        syncSurfaces() {
          this.previewOn = ""; this.previewData = null;   // any normal sync reclaims the viewer
          // Profile and Pivot compute through kits/table-stats.js. Fetched at
          // load, so it is normally here; if a view is asked for first, the
          // view draws when the kit arrives rather than failing.
          if ((this.curV === "profile" || this.curV === "pivot" || this.curV === "layout") && !window.TableStats) {
            const ghRef = typeof gh !== "undefined" ? gh : (window.gh || null);
            if (ghRef?.load) ghRef.load("kits/table-stats.js").then(() => { if (window.TableStats) this.syncSurfaces(); }).catch(() => {});
            return;
          }
          if (this.curV === "csv") {
            const rows = Alpine.raw(this.tabs[this.active]?.rows || []);
            const name = (this.tabs[this.active]?.name || ("step_" + (this.active + 1))) + ".json";
            this.sendToViewer(name, this.previewJson(rows), "table", rows, this.viewKey("data"));
          } else if (this.curV === "profile") {
            const prows = this.profile(Alpine.raw(this.tabs[this.active]?.rows || []));
            this.profileData = { rows: prows, cols: prows.length };
            this.sendToViewer("profile.json", JSON.stringify(prows, null, 2), "table", prows, this.viewKey("profile"));
          } else if (this.curV === "pivot" || this.curV === "layout") {
            // Rescan only when the rows underneath actually changed; a dimension
            // toggle calls pvDraw() directly and must not re-derive the defaults
            // out from under the reader's choice.
            if (this.pvSrc !== this.pvSig()) this.pvScan();
            this.pvDraw();
          }
        },
        // One row per column of the data, so the Profile is a grid like any
        // other: sortable, filterable, copyable, with the column menu. The
        // figures are TableStats.profile's, the same the viewer's explorer
        // draws: a type read from the values (a CSV's "$1,234.50" is numeric,
        // not a string), how full the column is, its distincts, and either
        // its range or its commonest values.
        profile(rows) {
          if (!rows?.length) return [];
          const p = window.TableStats.profile(rows);
          const n = (v) => v == null ? "" : Number.isInteger(v) ? v : Math.round(v * 100) / 100;
          return p.columns.map(c => ({
            Column: c.title,
            Type: c.type,
            "Filled %": Math.round(c.fillRate * 100),
            Blank: c.nulls,
            Distinct: c.distinctCapped ? c.distinctCount + "+" : c.distinctCount,
            Summary: c.numStats
              ? "min " + n(c.numStats.min) + " · median " + n(c.numStats.median) + " · max " + n(c.numStats.max) + " · sum " + n(c.numStats.sum)
              // A column of unique values counts 1 for each, so its counts say
              // nothing and are left off, as the explorer's Columns view does.
              : c.topValues.map(t => c.distinctCount === c.filled ? t.value : t.value + " (" + t.count + ")").join(", "),
          }));
        },

        // ---- Pivot: group by N columns, aggregate one measure ---------------
        //
        // The two hard halves of a pivot over an arbitrary extract were already
        // in this file, built from opposite ends and never joined. The dimension
        // wizard (wizScan, above) discovers which columns determine which, and
        // profile() types every column and counts its distincts. What was
        // missing was the middle: group, aggregate, nest. That is this, and it
        // is short because neither end had to be invented.
        //
        // What it emits is a {label, note, value, children} tree, the shape the
        // estate's report format already flattens (web-tools docs/CONVERSATION.md
        // calls a link to it 📊). So a consumer can draw the same result as an
        // indented table, a treemap or a till receipt, and this code holds no
        // opinion about any of them. The flat rows below are for THIS pane's
        // viewer and its CSV download, and they are a different shape on
        // purpose: one column per dimension level, which is what a table wants
        // and what an indented single-label column cannot give.
        //
        // Sorting is by the aggregate, descending, at every level.

        // The arithmetic is kits/table-stats.js's (TableStats.pivot), shared
        // with the viewer's explorer since 2026-10-24: the number parser, the
        // scan, the defaults, the tree and the flat rows. What stays here is
        // the pane's state and its drawing.
        pvSig() {
          const t = this.tabs[this.active];
          return this.active + "|" + (t?.name || "") + "|" + (t?.rows?.length || 0);
        },
        pvScan() {
          const rows = Alpine.raw(this.tabs[this.active]?.rows || []);
          const P = window.TableStats.pivot;
          const sc = P.scan(rows);
          const cols = sc.cols;
          Object.assign(this, { pvCols: cols, pvN: sc.distinct, pvIsNum: sc.isNum, pvDec: sc.dec, pvSrc: this.pvSig() });
          this.pvDims = this.pvDims.filter(c => cols.includes(c));
          this.pvColDims = this.pvColDims.filter(c => cols.includes(c));
          if (this.pvMeasure && !sc.isNum[this.pvMeasure]) this.pvMeasure = "";
          const d = P.defaults(sc, rows);
          if (!this.pvDims.length) this.pvDims = d.dims;
          if (!this.pvMeasure) this.pvMeasure = d.measure;
          if (!this.pvMeasure) this.pvAgg = "count";
        },
        // Drag targets. pvDropAt(i) places the dragged chip at index i of the
        // dims (a pool chip is added there, a chosen chip is moved there);
        // pvDropOut removes a chosen chip dropped back on the pool.
        // pvDropCol(i) is the same gesture onto the Columns container: the
        // chip leaves the rows if it was there. Two column dimensions at most,
        // since every key becomes a column.
        pvDropAt(i) {
          const c = this.pvDrag; this.pvDrag = "";
          if (!c) return;
          const dims = this.pvDims.filter(x => x !== c);
          if (dims.length >= 4) return;
          const j = Math.min(Math.max(i, 0), dims.length);
          dims.splice(j, 0, c);
          const cols = this.pvColDims.filter(x => x !== c);
          if (dims.join("\u0001") === this.pvDims.join("\u0001") && cols.length === this.pvColDims.length) return;
          this.pvDims = dims; this.pvColDims = cols;
          this.pvDraw();
        },
        pvDropCol(i) {
          const c = this.pvDrag; this.pvDrag = "";
          if (!c) return;
          const cols = this.pvColDims.filter(x => x !== c);
          if (cols.length >= 2) return;
          const j = Math.min(Math.max(i, 0), cols.length);
          cols.splice(j, 0, c);
          const dims = this.pvDims.filter(x => x !== c);
          if (cols.join("\u0001") === this.pvColDims.join("\u0001") && dims.length === this.pvDims.length) return;
          this.pvDims = dims; this.pvColDims = cols;
          this.pvDraw();
        },
        pvDropOut() {
          const c = this.pvDrag; this.pvDrag = "";
          if (!c || !(this.pvDims.includes(c) || this.pvColDims.includes(c))) return;
          this.pvDims = this.pvDims.filter(x => x !== c);
          this.pvColDims = this.pvColDims.filter(x => x !== c);
          this.pvDraw();
        },
        pvRemoveCol(c) {
          this.pvColDims = this.pvColDims.filter(x => x !== c);
          this.pvDraw();
        },
        // The pivot as a function of the rows: the same partition as pvTree and
        // pvFlat, written out self-contained so it can be a recipe tab, chain
        // through $refs, or be committed as a module with no dependency on
        // this component. pvFnCfg is the short form the strip shows.
        pvFnCfg() {
          const mk = this.pvMeasure, agg = mk ? this.pvAgg : "count";
          const dec = agg === "count" ? 0 : Math.min(6, (this.pvDec[mk] || 0) + (agg === "avg" ? 2 : 0));
          return { rows: [...this.pvDims], cols: [...this.pvColDims], measure: mk || null, agg, dec };
        },
        pvFnLine() {
          const c = this.pvFnCfg();
          return "rows => pivot(rows, " + JSON.stringify({ rows: c.rows, cols: c.cols, measure: c.measure, agg: c.agg }) + ")";
        },
        pvFnSrc() {
          const cfg = JSON.stringify(this.pvFnCfg());
          return [
            "rows => {",
            "  const cfg = " + cfg,
            "  const num = v => { if (typeof v === 'number') return v; if (typeof v !== 'string' || !v.trim()) return NaN;",
            "    const t = v.trim(), neg = /^\\(.*\\)$/.test(t); const n = parseFloat(t.replace(/^\\(|\\)$/g, '').replace(/[$,%\\s]/g, '')); return neg ? -n : n }",
            "  const key = (r, d) => { const x = r[d]; return x == null || x === '' ? '(blank)' : String(x) }",
            "  const round = v => { const f = Math.pow(10, cfg.dec); return Math.round(v * f) / f }",
            "  const mk = () => ({ value: 0, n: 0, kids: new Map(), cells: new Map() })",
            "  const bump = (o, v) => { o.n++; if (cfg.agg === 'min') o.value = o.n === 1 ? v : Math.min(o.value, v)",
            "    else if (cfg.agg === 'max') o.value = o.n === 1 ? v : Math.max(o.value, v); else o.value += v }",
            "  const root = mk(), colKeys = new Set()",
            "  for (const r of rows) {",
            "    const v = cfg.agg === 'count' ? 1 : num(r[cfg.measure])",
            "    if (!Number.isFinite(v)) continue",
            "    const ck = cfg.cols.map(d => key(r, d)).join(' \u00b7 ')",
            "    if (cfg.cols.length) colKeys.add(ck)",
            "    let node = root",
            "    for (const d of [null, ...cfg.rows]) {",
            "      if (d !== null) { const k = key(r, d); node = node.kids.get(k) || node.kids.set(k, Object.assign(mk(), { label: k })).get(k) }",
            "      bump(node, v)",
            "      if (cfg.cols.length) { const c = node.cells.get(ck) || node.cells.set(ck, { value: 0, n: 0 }).get(ck); bump(c, v) }",
            "    }",
            "  }",
            "  const fin = o => round(cfg.agg === 'avg' ? (o.n ? o.value / o.n : 0) : o.value)",
            "  const keys = [...colKeys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))",
            "  const mcol = cfg.agg === 'count' ? 'count' : cfg.agg + '(' + cfg.measure + ')'",
            "  const out = []",
            "  const walk = (node, path) => {",
            "    const row = { level: path.length }",
            "    cfg.rows.forEach((d, i) => { row[d] = i < path.length ? path[i] : '' })",
            "    row.rows = node.n",
            "    for (const k of keys) row[k] = node.cells.has(k) ? fin(node.cells.get(k)) : ''",
            "    row[keys.length ? 'total' : mcol] = fin(node)",
            "    out.push(row)",
            "    for (const kid of [...node.kids.values()].sort((a, b) => fin(b) - fin(a))) walk(kid, [...path, kid.label])",
            "  }",
            "  walk(root, [])",
            "  return out",
            "}",
          ].join("\n");
        },
        // Hand a draft to the host: the pivot as a recipe, or the active tab.
        savePivotRecipe() {
          if (typeof opts.onSaveRecipe !== "function") return;
          const c = this.pvFnCfg();
          const what = (c.agg === "count" ? "count of rows" : c.agg + " of " + c.measure);
          opts.onSaveRecipe({
            kind: "pivot",
            name: "pivot_" + [...c.rows, ...c.cols].map(d => d.replace(/\W+/g, "_").toLowerCase()).join("_"),
            fnSrc: this.pvFnSrc(),
            columns: [...c.rows, ...c.cols, ...(c.measure ? [c.measure] : [])],
            effect: "Groups rows by " + (c.rows.join(", ") || "nothing") + (c.cols.length ? ", spreads " + c.cols.join(" and ") + " across as columns" : "") + ", and takes the " + what + " at every level.",
            input: "Any table with the columns " + [...c.rows, ...c.cols, ...(c.measure ? [c.measure] : [])].join(", ") + ".",
          });
        },
        saveTabRecipe() {
          if (typeof opts.onSaveRecipe !== "function") return;
          const t = this.tabs[this.active]; if (!t) return;
          const cols = t.rows && t.rows.length ? Object.keys(t.rows[0]) : [];
          opts.onSaveRecipe({ kind: "tab", name: t.name || "recipe", fnSrc: t.fnSrc, columns: [], outputColumns: cols, effect: "", input: "" });
        },
        canSaveRecipe() { return typeof opts.onSaveRecipe === "function"; },
        pvToggleDim(c) {
          const i = this.pvDims.indexOf(c);
          if (this.pvColDims.includes(c)) return this.pvRemoveCol(c);
          if (i >= 0) this.pvDims.splice(i, 1);
          else if (this.pvDims.length < 4) this.pvDims.push(c);   // past four, nothing reads
          this.pvDraw();
        },
        pvSetMeasure(c) {
          this.pvMeasure = c;
          if (!c) this.pvAgg = "count";
          else if (this.pvAgg === "count") this.pvAgg = "sum";
          this.pvDraw();
        },
        pvTree(rows) { return window.TableStats.pivot.tree(rows, this.pvFnCfg()); },
        pvFlat(res) { return window.TableStats.pivot.flat(res, this.pvFnCfg()); },
        // ---- Layout: the partition, printed -----------------------------
        //
        // This view adds no configuration of its own. The dimension chips above
        // are the whole control surface, and this is a second reading of what
        // pvTree already built, which is what pvDraw's own note invites: it
        // computes the partition, the host decides how to draw it.
        rpReady() { return typeof window.ReportLayout !== "undefined"; },
        rpSync() {
          if (this.curV !== "layout" || !this.rpReady() || !this.pvOut?.res) { this.rpHtml = ""; this.rpModel = null; return; }
          this.rpModel = window.ReportLayout.fromPartition(this.pvOut.res, {
            levels: [...this.pvDims],
            // Two column dimensions make a band over a period, which is the
            // shape a version-by-year compare wants. One makes a flat header.
            band: this.pvColDims.length === 2,
            measureLabel: this.pvAgg === "count" ? "count" : this.pvAgg + "(" + this.pvMeasure + ")",
            order: this.rpOrder,
          });
          this.rpHtml = window.ReportLayout.render(this.rpModel, {});
        },
        rpTsv() { return this.rpModel ? window.ReportLayout.tsv(this.rpModel) : ""; },
        pvDraw() {
          const rows = Alpine.raw(this.tabs[this.active]?.rows || []);
          if (!rows.length) { this.pvOut = null; this.rpSync(); return this.sendToViewer("pivot.json", "[]", "table", [], "pivot"); }
          const res = this.pvTree(rows);
          const flat = this.pvFlat(res);
          this.pvOut = { rows: flat, res };
          // The pane reads ONE shape in every mode, which is the flat rows, and
          // copy and download follow the viewer's mode exactly as Data and
          // Profile do. Showing the tree in Raw while the table showed rows was
          // the first cut and it was a trap: what you copy would not have been
          // what you were looking at. The tree stays reachable where its actual
          // consumer is, on the component (`__workbench.pvOut.res.tree`), which
          // is the whole integration point: this computes the partition, the
          // host decides whether to draw it as an indented table, a treemap or
          // a till receipt.
          this.sendToViewer("pivot.json", this.previewJson(flat), "table", flat, "pivot");
          this.rpSync();
        },

        // ---- misc ----
        clear() {
          Object.assign(this, { raw: [], datasets: [], scope: "__all", editingDs: -1, addOpen: false, combine: true, tagCol: "", ran: false, bundle: "", bundleSz: "", bundleObj: {}, bndSel: {}, srcGz: {}, wizCands: [], wizCols: [], wizColN: {}, wizScanned: 0, wizCustom: [], wizSel: "", wizPick: {}, previewOn: "", tabs: [this.identityTab()], active: 0, profileData: {}, loaded: "",
            pvCols: [], pvIsNum: {}, pvN: {}, pvDec: {}, pvDims: [], pvColDims: [], pvMeasure: "", pvAgg: "sum", pvSrc: "", pvOut: null, rpHtml: "", rpModel: null, rpOrder: "source" });
          this.clearArm = false;
          this.saveTabs();
          if (typeof opts.onIngest === "function") try { opts.onIngest([]); } catch (e) {}
          if (typeof opts.onClear === "function") try { opts.onClear(); } catch (e) {}
          this.sendToViewer("blank.json", "[]");
        },
        flash(side) {
          const p = side === "f" ? "copF" : side === "l" ? "copL" : "copR";
          this[p] = true; setTimeout(() => this[p] = false, 1000);
        },
        async dl() {
          const p = await this.exportPayload(this.curV);
          const u = URL.createObjectURL(new Blob([p.text], { type: p.mime }));
          Object.assign(document.createElement("a"), { href: u, download: "out." + p.ext }).click();
          setTimeout(() => URL.revokeObjectURL(u), 100);
        },
      };
    });
  };
  if (window.Alpine?.directive) register();
  else document.addEventListener("alpine:init", register);

  // ---- the markup (a string; hosts drop it into the DOM before Alpine walks,
  // or Alpine.initTree it after). dataExpr rides verbatim inside the x-data
  // attribute, so single quotes only.
  function panelHTML(dataExpr) {
    return `
  <style>
    /* Below lg the workbench stacks (editor over viewer) and the split-width
       inline style must not apply; heights are explicit because a mobile
       host may give the panel no height to fill. */
    @media (max-width: 1023.5px) {
      .tf-root .tf-editor-col { width: 100% !important; }
      .tf-root .tf-editor-card { height: auto !important; }
      .tf-root textarea { min-height: 9rem; }
    }
  </style>
  <div class="tf-root flex flex-col lg:h-full min-h-0 gap-2 select-none" x-data="transformWorkbench(${dataExpr || ""})"
       @mousemove.window="if(drag){const r=$el.getBoundingClientRect(); split=Math.min(80,Math.max(20,(($event.clientX-r.left)/r.width)*100))} if(bndDrag){const r=$refs.rightcol.getBoundingClientRect(); bndSplit=Math.min(85,Math.max(20,(($event.clientY-r.top)/r.height)*100))}"
       @mouseup.window="drag=false; bndDrag=false">

    <!-- CONTROLS: how the inputs combine and run, on a row of their own.
         Until 2026-10-23 these shared one wrapping row with the batch chips,
         and a nine-sheet workbook put Run and Clear in the middle of the
         sheet names. No row count here: it was the sum over every batch,
         which describes no one table once batches are kept apart; a
         batch's size is in its chip's peek. -->
    <div class="flex flex-wrap items-center px-1 shrink-0 gap-x-3 gap-y-1.5">
      <button x-show="datasets.length" @click="addOpen = !addOpen"
              class="btn btn-xs btn-ghost h-6 min-h-0 px-1.5 opacity-50 hover:opacity-100" :class="addOpen && 'text-primary opacity-100'"
              title="Paste or drop another batch of the same shape">
        <i class="ph-bold ph-plus"></i> data
      </button>
      <label x-show="datasets.length > 1 || !combine" class="flex items-center gap-1 cursor-pointer text-[10px] opacity-60 hover:opacity-100 select-none whitespace-nowrap"
             title="On: batches append into one input. Off: each fn runs once per batch, one output per batch.">
        <input type="checkbox" class="checkbox checkbox-xs" x-model="combine" @change="modeChanged()">
        <span>Combine</span>
      </label>
      <input x-show="datasets.length > 1 || tagCol" x-model="tagCol" @change="modeChanged()" placeholder="tag col"
             title="Adds this column to every input row, holding the batch's name"
             class="input input-xs input-bordered w-20 font-mono h-6" spellcheck="false">
      <div class="flex gap-2 items-center shrink-0 ml-auto">
        <!-- Live run progress, fed by the worker per function (and per batch
             in separate mode). -->
        <span x-show="running" class="text-[10px] opacity-60 font-mono truncate max-w-[16rem]" x-text="progress"></span>
        <button class="btn btn-xs btn-ghost px-1.5" @click="collapsed = !collapsed"
                :title="collapsed ? 'Show the transform editor' : 'Hide the transform editor'"
                  :aria-label="collapsed ? 'Show the transform editor' : 'Hide the transform editor'">
          <i class="ph-bold" :class="collapsed ? 'ph-sidebar' : 'ph-sidebar-simple'"></i>
        </button>
        <button class="btn btn-xs btn-primary px-3" :disabled="!!(!raw.length || running)" @click="run()">
          <span x-show="!running"><i class="ph-bold ph-play"></i></span>
          <span x-show="running" class="loading loading-spinner loading-xs"></span> Run
        </button>
        <!-- Clear all: every input, reference, fn tab and output, back to an
             empty workbench. Armed by the first tap, run by the second. -->
        <button class="btn btn-xs h-6 min-h-0 px-2 gap-1 normal-case font-medium border transition-none"
                :class="clearArm ? 'btn-error border-error' : 'btn-ghost border-base-300 hover:border-error hover:text-error'"
                :disabled="!(datasets.length || tabs.length > 1 || ran)"
                @click="clearArm ? clear() : (clearArm = true, setTimeout(() => { clearArm = false; }, 4000))"
                data-title-tip-bare data-title-tip-look="plain" data-title-tip="Remove every input, function tab and output">
          <i class="ph-bold ph-broom"></i><span x-text="clearArm ? 'Clear everything?' : 'Clear all'"></span>
        </button>
      </div>
    </div>

    <!-- DATA INPUTS: the batch chips and nothing else, one row that scrolls
         sideways rather than wrapping, so a workbook's sheets read as a list
         of inputs and the functions on the left and the output on the right
         keep their places below it. -->
    <div x-show="datasets.length || scopeOptions().length" class="flex items-center gap-2 px-1 shrink-0 min-w-0">
      <span class="shrink-0 text-[10px] uppercase tracking-wide opacity-50">Data inputs</span>
      <div class="flex flex-nowrap items-center gap-1.5 min-w-0 overflow-x-auto pb-0.5">
          <!-- The batch chips double as the scope selector: click selects what
               Data and Profile speak about (computed on demand if the last Run
               did not target it), double-click renames in place (the name is the
               tag value and the bundle key). The Combined chip leads when there
               is more than one batch. A chip is its name and nothing else: its
               size is in its peek, the house hover card, which heads the
               batch's rows as CSV with its row and column counts. Every batch
               is a $name to the fns without asking (the run seeds it), which is why
               there is no per-chip $ switch. -->
          <button x-show="datasets.length > 1" @click="setScope('__all')"
                  class="btn btn-xs h-6 min-h-0 px-2 normal-case font-mono shrink-0 border transition-none"
                  :class="scopeActive() === '__all' ? 'btn-neutral border-neutral' : 'btn-ghost bg-base-100 hover:bg-base-200 border-base-300'">
            <i class="ph ph-stack opacity-70"></i>Combined
          </button>
          <template x-for="(d, i) in datasets" :key="i">
            <!-- The join wrapper carries the border but no radius of its own, so it
                 takes the btn radius explicitly and overflow-hidden clips both
                 segments to it; the remove segment follows the selection color, so
                 a selected chip is one solid unit rather than a dark half against
                 a white x inside a square outline. -->
            <div class="join border shrink-0 overflow-hidden rounded-[var(--radius-field)]" :class="(datasets.length === 1 || scopeActive() === d.name) ? 'border-neutral' : 'border-base-300'">
              <button class="join-item btn btn-xs h-6 min-h-0 px-2 normal-case border-none font-mono transition-none"
                      :class="(datasets.length === 1 || scopeActive() === d.name) ? 'btn-neutral' : 'btn-ghost bg-base-100 hover:bg-base-200'"
                      :data-peek="peekKey(d)" @mouseenter="seedPeek(d)" @focus="seedPeek(d)"
                      @click="if (!d.ref) setScope(datasets.length === 1 ? '__all' : d.name)"
                      @dblclick.prevent="startDsEdit(i)"
                      :title="d.ref ? 'A reference batch: a fn reads it as $' + d.name + '; double-click to rename' : 'Click to inspect this batch; a fn reads it as $' + d.name + '; double-click to rename'">
                <template x-if="editingDs === i">
                  <input x-model="d.name" x-init="$nextTick(() => { $el.focus(); $el.select(); })"
                         @blur="finishDsEdit()" @keydown.enter.prevent="finishDsEdit()"
                         @keydown.escape.prevent="finishDsEdit()" @click.stop
                         class="w-16 bg-transparent border-none outline-none focus:ring-0 p-0 font-mono text-[11px] text-inherit">
                </template>
                <template x-if="editingDs !== i">
                  <span class="inline-flex items-center gap-1"><i class="ph ph-table opacity-70"></i><span><span x-show="d.ref" class="opacity-60">$</span><span x-text="d.name"></span></span></span>
                </template>
              </button>
              <button x-show="datasets.length > 1" @click.stop="removeDataset(i)"
                      :aria-label="'Remove the ' + d.name + ' dataset'"
                      class="join-item btn btn-xs h-6 min-h-0 px-1 border-none transition-none hover:text-error"
                      :class="(datasets.length === 1 || scopeActive() === d.name) ? 'btn-neutral' : 'btn-ghost bg-base-100 hover:bg-base-200'">
                <i class="ph ph-x text-[10px]"></i>
              </button>
            </div>
          </template>
          <!-- An output-only bundle (rehydrated without source) has no batch
               chips; its scopes come from the outputs themselves. -->
          <template x-for="k in (datasets.length ? [] : scopeOptions())" :key="k">
            <button @click="setScope(k)"
                    class="btn btn-xs h-6 min-h-0 px-2 normal-case font-mono shrink-0 border transition-none"
                    :class="scopeActive() === k ? 'btn-neutral border-neutral' : 'btn-ghost bg-base-100 hover:bg-base-200 border-base-300'">
              <i class="ph ph-table opacity-70"></i><span x-text="scopeLabel(k)"></span></button>
          </template>
      </div>
    </div>

    <!-- The paste/drop target: a drop zone only while empty. Once a table is
         loaded it collapses and the row count moves up beside the controls,
         so it stops taking a full row it does not need. -->
    <div class="card bg-base-100 border border-base-300 shrink-0" x-show="!datasets.length || addOpen">
      <div class="p-1">
        <div class="border border-dashed rounded-md py-3 text-center cursor-pointer hover:bg-base-200 transition-colors"
             :class="hot ? 'border-primary bg-primary/10' : ran && !datasets.length ? 'border-warning/40 bg-warning/10' : 'border-base-300'"
             @paste.prevent="handlePaste($event)"
             @dragenter.prevent="hot = true" @dragover.prevent
             @dragleave.prevent="hot = false" @drop.prevent="handleDrop($event)"
             tabindex="0">
          <div x-show="!ran || datasets.length" class="text-base-content/40 text-xs flex items-center justify-center gap-2 pointer-events-none">
            <i class="ph-bold text-lg" :class="hot ? 'ph-file-arrow-down text-primary' : 'ph-clipboard-text'"></i>
            <span x-text="hot ? 'Drop to load' : (datasets.length ? 'Paste or drop the next batch (same shape; appends as a new dataset)' : 'Paste or drop TSV, CSV, JSON, or a bundle')"></span>
          </div>
          <div x-show="ran && !datasets.length" class="flex items-center justify-center gap-2 text-warning text-xs font-bold pointer-events-none">
            <i class="ph-bold ph-info"></i>
            <span>Bundle rehydrated without source. Paste raw data here to enable Run.</span>
          </div>
        </div>
      </div>
    </div>

    <div class="lg:flex-1 flex flex-col lg:flex-row gap-2 lg:gap-0 min-h-0" :class="(drag || bndDrag) && 'pointer-events-none'">
      <!-- The fn column: the editor, the column's whole height. -->
      <div x-show="!collapsed" class="tf-editor-col flex flex-col min-h-0 gap-2 lg:pr-0" :style="\`width: \${split}%\`" x-ref="leftcol">
      <div class="tf-editor-card card bg-base-100 border border-base-300 flex flex-col overflow-hidden lg:flex-1">
        <div class="p-2 flex flex-col h-full">
          <div class="flex justify-between items-center mb-2 shrink-0 gap-1.5">
            <div class="flex gap-1.5 items-center flex-1 min-w-0 p-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
              <template x-for="(t, i) in tabs" :key="i">
                <div class="join border border-base-300 shrink-0 overflow-hidden rounded-[var(--radius-field)]">
                  <button @click="setActive(i)" @dblclick.prevent="startEdit(i)"
                          class="join-item btn btn-xs h-7 min-h-0 pl-2 pr-3 gap-1 normal-case border-none transition-none"
                          :class="active === i ? 'btn-neutral' : 'btn-ghost bg-base-100'">
                    <i class="ph-bold ph-function opacity-60"></i>
                    <div class="relative inline-flex items-center justify-center min-w-[2.5rem]">
                      <span class="invisible whitespace-pre font-medium" x-text="t.name || ' '"></span>
                      <template x-if="editing === i">
                        <input x-model="t.name" x-init="$nextTick(() => { $el.focus(); $el.select(); })"
                               @blur="finishEdit()" @keydown.enter.prevent="finishEdit()"
                               @keydown.escape.prevent="finishEdit()" @click.stop
                               class="absolute inset-0 w-full h-full bg-transparent border-none outline-none focus:ring-0 text-center text-inherit font-medium p-0">
                      </template>
                      <template x-if="editing !== i">
                        <span class="absolute inset-0 flex items-center justify-center" x-text="t.name || '·'" :class="!t.name && 'opacity-50'"></span>
                      </template>
                    </div>
                    <i x-show="t.err" class="ph-bold ph-warning-circle text-error text-[10px] ml-1"></i>
                    <span x-show="t.dirty && t.ok && !t.err" class="text-warning text-[10px] ml-1 font-bold">*</span>
                  </button>
                  <button x-show="tabs.length > 1" @click.stop="remove(i)"
                          :aria-label="'Close the ' + (t.name || 'transform') + ' tab'"
                          class="join-item btn btn-xs h-7 min-h-0 px-1.5 btn-ghost border-none bg-base-100 hover:text-error border-l border-base-300!">
                    <i class="ph ph-x text-[10px]"></i>
                  </button>
                </div>
              </template>
              <button @click="add()" class="btn btn-xs btn-ghost opacity-40 px-2 shrink-0 hover:opacity-100" title="Add a blank transform tab" aria-label="Add a blank transform tab"><i class="ph-bold ph-plus"></i></button>
              <select x-show="addableRecipes().length" @change="addRecipe($event.target.value); $event.target.value = ''"
                      title="Add a committed recipe from the registry"
                      class="select select-xs select-bordered h-7 min-h-0 shrink-0 max-w-[9rem] text-[11px] opacity-60 hover:opacity-100">
                <option value="">+ recipe</option>
                <template x-for="r in addableRecipes()" :key="r.name">
                  <option :value="r.name" x-text="r.label || r.name"></option>
                </template>
              </select>
            </div>
            <div class="flex gap-1 shrink-0">
              <button class="btn btn-xs h-7 min-h-0 px-1.5 btn-ghost transition-colors" @click="wrapF = !wrapF" :class="wrapF ? 'text-primary' : 'opacity-30'"
                      :aria-label="wrapF ? 'Stop wrapping long lines' : 'Wrap long lines'"><i class="ph-bold ph-arrow-u-down-left"></i></button>
              <button class="btn btn-xs h-7 min-h-0 px-1.5 btn-ghost transition-colors tf-copy-btn" :data-clipboard-text="tabs[active]?.fnSrc || ''" @click="flash('f')" aria-label="Copy the transform source" :class="copF ? 'text-success' : 'opacity-30'"><i class="ph-bold" :class="copF ? 'ph-check':'ph-copy'"></i></button>
              <button x-show="canSaveRecipe() && !tabs[active]?.fixed" class="btn btn-xs h-7 min-h-0 px-1.5 btn-ghost opacity-30 hover:opacity-100" @click="saveTabRecipe()" title="Save this tab as a recipe" aria-label="Save this tab as a recipe"><i class="ph-bold ph-floppy-disk"></i></button>
            </div>
          </div>
          <textarea class="textarea textarea-bordered font-mono text-[11px] w-full flex-1 leading-tight resize-none focus:outline-none p-2 border-base-200"
                    :class="wrapF ? 'whitespace-pre-wrap break-all' : 'whitespace-pre overflow-auto'"
                    x-model="tabs[active].fnSrc" @input="tabs[active].dirty = true"
                    spellcheck="false" :wrap="wrapF ? 'soft' : 'off'"></textarea>
          <div x-show="tabs[active]?.err" class="text-error text-[10px] font-mono mt-1" x-text="tabs[active]?.err"></div>
        </div>
      </div>

      </div>

      <div x-show="!collapsed" class="hidden lg:block w-1.5 hover:bg-primary/20 cursor-col-resize self-stretch transition-colors" @mousedown="drag = true"></div>

      <!-- The output column: the viewer on top, the lower pane below it
           (Overview, Dimensions, Bundle; collapsible, drag-splittable). -->
      <div class="flex-1 flex flex-col min-h-0 gap-2" x-ref="rightcol">
      <div class="card bg-base-100 border border-base-300 flex flex-col overflow-hidden"
           :class="!lowerOpen && 'lg:flex-1'" :style="lowerOpen ? 'height:' + bndSplit + '%' : ''">
        <div class="p-2 flex flex-col h-full">
          <div x-show="!ran" class="flex-1 min-h-[8rem] lg:min-h-0 flex items-center justify-center text-base-content/20 italic text-xs">Run to see output</div>
          <div x-show="ran" class="flex flex-col h-full">
            <div x-show="!previewOn" class="flex flex-wrap items-center gap-y-1.5 mb-2 shrink-0">
              <div class="flex gap-1.5 items-center">
                <template x-for="v in views" :key="v.k">
                  <button class="btn btn-xs h-7 min-h-0 px-3 normal-case border border-base-300 transition-none flex gap-3"
                          :class="curV === v.k ? 'btn-neutral' : 'btn-ghost bg-base-100'" @click="switchTo(v.k)">
                    <span class="font-medium" x-text="v.l"></span>
                  </button>
                </template>
                <!-- The scope readout: which batch (or Combined) the batch
                     chips up top have selected; the chips are the control. -->
                <span x-show="scopeOptions().length > 1" class="text-[10px] opacity-40 font-mono self-center ml-1"
                      x-text="scopeLabel(scopeActive())"></span>
              </div>
              <div class="flex items-center gap-2 ml-auto">
                <!-- The three output modes, icon-only. The labels went on
                     2026-09-14 because this strip shares one row with the
                     Data/Profile/Pivot tabs, the batch readout and the two
                     export buttons, and it was the widest thing on the row
                     that was not naming anything the row did not already
                     imply. Each carries a note in place of the label, which
                     is the house rule for a popup (kits/title-tip.js); the icons
                     are the same three, at the same sizes, so the control is
                     recognisable at a glance by anyone who knew it wide.
                     data-title-tip-bare drops the kit's dotted underline, which a
                     button should not be wearing.
                    
                     A note here NAMES the destination and does not describe
                     it: at two or three words it reads in the time a pointer
                     rests, and nothing in the strip needs a sentence. The
                     middle one says "JSON tree" rather than anything about
                     editing, because vanilla-jsoneditor is mounted editable
                     over a structuredClone and nothing reads the clone back:
                     typing into it changes the widget and not the rows, so a
                     note promising an editor would be promising a write path
                     that does not exist. Renaming it is the honest half of
                     that; whether the panel should be read-only, or should
                     write back, is a separate question. -->
                <div class="join border border-base-300 overflow-hidden rounded-[var(--radius-field)]">
                  <button class="btn btn-xs join-item px-2 bg-base-100 hover:bg-base-200" aria-label="Data grid" data-title-tip-bare data-title-tip-look="plain"
                          data-title-tip="Data grid" @click="document.getElementById('tf-workbench').__viewer.switchMode('table')"><i class="ph ph-table text-sm"></i></button>
                  <button class="btn btn-xs join-item px-2 bg-base-100 hover:bg-base-200" aria-label="JSON tree" data-title-tip-bare data-title-tip-look="plain"
                          data-title-tip="JSON tree" @click="document.getElementById('tf-workbench').__viewer.switchMode('tree')"><i class="ph ph-tree-view text-sm"></i></button>
                  <button class="btn btn-xs join-item px-2 bg-base-100 hover:bg-base-200" aria-label="Raw JSON" data-title-tip-bare data-title-tip-look="plain"
                          data-title-tip="Raw JSON" @click="document.getElementById('tf-workbench').__viewer.switchMode('raw')"><i class="ph ph-text-t text-sm"></i></button>
                </div>
                <div class="flex gap-1">
                  <!-- The export text is produced at click time, never bound
                       into the attribute: with large batches that binding held
                       the whole dataset in the DOM. -->
                  <button class="btn btn-xs h-7 min-h-0 px-1.5 btn-ghost transition-colors" @click="copyResult()" :class="copR ? 'text-success' : 'opacity-30'" aria-label="Copy the result"><i class="ph-bold" :class="copR ? 'ph-check':'ph-copy'"></i></button>
                  <button class="btn btn-xs h-7 min-h-0 px-1.5 btn-ghost opacity-30 hover:opacity-100" @click="dl()" aria-label="Download the result"><i class="ph-bold ph-download"></i></button>
                </div>
              </div>
            </div>
            <!-- The pivot controls, a second header row under the view
                 buttons. Group-by chips carry their nesting position as a
                 number, because the order is the whole of what distinguishes
                 one pivot from another and a set of on/off chips cannot say
                 it. A numeric column is offered as a measure; every column is
                 offered as a dimension, since grouping by a number is a normal
                 thing to want. -->
            <div x-show="(curV === 'pivot' || curV === 'layout') && !previewOn && tabs[active]?.rows?.length" class="flex flex-col gap-1.5 mb-2 shrink-0 text-[11px]">
              <!-- Two containers. "Group by" holds the chosen dimensions in
                   nesting order; the pool holds the rest. A chip drags within
                   the first to reorder, from the pool into it to add, and out
                   of it back to the pool to remove; a tap still toggles, so a
                   phone gets the same reach without dragging. Native HTML
                   drag-and-drop, no dependency. -->
              <div class="flex flex-wrap items-center gap-1 min-h-7 rounded-[var(--radius-field)] border border-dashed px-1 py-0.5"
                   :class="pvDrag && !pvDims.includes(pvDrag) ? 'border-primary/60 bg-primary/10' : 'border-base-300'"
                   data-pv="rows" @dragover.prevent @drop.prevent="pvDropAt(pvDims.length)">
                <span class="opacity-50 mr-1 shrink-0">Group by</span>
                <template x-for="c in pvDims" :key="'pvd-' + c">
                  <button class="btn btn-xs h-6 min-h-0 px-2 font-normal normal-case gap-1 border border-base-300 transition-none btn-primary btn-soft cursor-grab"
                          :class="pvDrag === c && 'opacity-40'"
                          draggable="true" @dragstart="pvDrag = c" @dragend="pvDrag = ''"
                          @dragover.prevent @drop.prevent.stop="pvDropAt(pvDims.indexOf(c))"
                          :title="(pvN[c] > 1000 ? '1000+' : pvN[c]) + ' distinct · drag to reorder, tap to remove'"
                          @click="pvToggleDim(c)">
                    <span class="font-mono opacity-60" x-text="pvDims.indexOf(c) + 1"></span>
                    <span x-text="c"></span>
                  </button>
                </template>
                <span x-show="!pvDims.length" class="opacity-40 italic">drag or tap a column below</span>
              </div>
              <!-- The column axis. A chip here spreads its values across the
                   table as columns (a crosstab), two deep at most; the total
                   column stays last. Drag in from the pool or from Group by;
                   tap or drag out to remove. -->
              <div class="flex flex-wrap items-center gap-1 min-h-7 rounded-[var(--radius-field)] border border-dashed px-1 py-0.5"
                   :class="pvDrag && !pvColDims.includes(pvDrag) ? 'border-primary/60 bg-primary/10' : 'border-base-300'"
                   data-pv="cols" @dragover.prevent @drop.prevent="pvDropCol(pvColDims.length)">
                <span class="opacity-50 mr-1 shrink-0">Columns</span>
                <template x-for="c in pvColDims" :key="'pvc-' + c">
                  <button class="btn btn-xs h-6 min-h-0 px-2 font-normal normal-case gap-1 border border-base-300 transition-none btn-secondary btn-soft cursor-grab"
                          :class="pvDrag === c && 'opacity-40'"
                          draggable="true" @dragstart="pvDrag = c" @dragend="pvDrag = ''"
                          @dragover.prevent @drop.prevent.stop="pvDropCol(pvColDims.indexOf(c))"
                          :title="(pvN[c] > 1000 ? '1000+' : pvN[c]) + ' distinct · drag to reorder, tap to remove'"
                          @click="pvRemoveCol(c)">
                    <span x-text="c"></span>
                  </button>
                </template>
                <span x-show="!pvColDims.length" class="opacity-40 italic">drag a column here to spread it across</span>
              </div>
              <div class="flex flex-wrap items-center gap-1 px-1"
                   :class="pvDrag && (pvDims.includes(pvDrag) || pvColDims.includes(pvDrag)) ? 'rounded-[var(--radius-field)] border border-dashed border-error/50 bg-error/10' : ''"
                   @dragover.prevent @drop.prevent="pvDropOut()">
                <template x-for="c in pvCols.filter(x => !pvDims.includes(x) && !pvColDims.includes(x))" :key="'pvp-' + c">
                  <button class="btn btn-xs h-6 min-h-0 px-2 font-normal normal-case gap-1 border border-base-300 transition-none btn-ghost bg-base-100 cursor-grab"
                          :class="pvDrag === c && 'opacity-40'"
                          draggable="true" @dragstart="pvDrag = c" @dragend="pvDrag = ''"
                          :disabled="pvDims.length >= 4"
                          :title="(pvN[c] > 1000 ? '1000+' : pvN[c]) + ' distinct · drag or tap to group by it'"
                          @click="pvToggleDim(c)">
                    <span x-text="c"></span>
                  </button>
                </template>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="opacity-50 shrink-0">Measure</span>
                <select class="select select-xs h-6 min-h-0 border-base-300 font-normal" x-model="pvMeasure" @change="pvSetMeasure(pvMeasure)">
                  <option value="">count of rows</option>
                  <template x-for="c in pvCols.filter(x => pvIsNum[x])" :key="'pvm-' + c">
                    <option :value="c" x-text="c"></option>
                  </template>
                </select>
                <div x-show="pvMeasure" class="join border border-base-300 overflow-hidden rounded-[var(--radius-field)]">
                  <template x-for="a in ['sum', 'avg', 'min', 'max']" :key="'pva-' + a">
                    <button class="join-item btn btn-xs h-6 min-h-0 px-2 normal-case border-none transition-none font-normal"
                            :class="pvAgg === a ? 'btn-neutral' : 'btn-ghost bg-base-100'"
                            @click="pvAgg = a; pvDraw()" x-text="a"></button>
                  </template>
                </div>
                <!-- Two honesty readouts, both of which stay quiet when there is
                     nothing to say. A non-additive aggregate means a parent is
                     NOT the sum of its children, and a reader looking at an
                     indented column will assume it is unless told. -->
                <span x-show="pvOut && !pvOut.res.partition" class="opacity-50 italic">subtotals are not sums</span>
                <span x-show="pvOut?.res?.skipped" class="opacity-50 italic">
                  <span x-text="pvOut?.res?.skipped?.toLocaleString()"></span> row(s) skipped: the measure would not parse
                </span>
                <button class="btn btn-xs h-6 min-h-0 px-2 btn-ghost font-normal normal-case ml-auto opacity-50 hover:opacity-100"
                        @click="pvDims = []; pvColDims = []; pvMeasure = ''; pvAgg = 'sum'; pvSrc = ''; syncSurfaces()"
                        title="Re-scan the columns and take the defaults again">reset</button>
              </div>
              <!-- The pivot as a function: what the chips above mean, written
                   out. Copy takes the self-contained source (pvFnSrc), which
                   runs as a tab anywhere; Save hands it to the host as a recipe. -->
              <div class="flex items-center gap-1.5 font-mono text-[10px] opacity-70 min-w-0">
                <span class="truncate" x-text="pvFnLine()"></span>
                <button class="btn btn-xs h-5 min-h-0 px-1 btn-ghost tf-copy-btn shrink-0" :data-clipboard-text="pvFnSrc()" @click="flash('f')" title="Copy the pivot as a self-contained rows => rows function" aria-label="Copy the pivot as a function"><i class="ph-bold" :class="copF ? 'ph-check' : 'ph-copy'"></i></button>
                <button x-show="canSaveRecipe()" class="btn btn-xs h-5 min-h-0 px-1.5 btn-ghost shrink-0 font-sans normal-case font-normal" @click="savePivotRecipe()" title="Save this pivot as a recipe"><i class="ph-bold ph-floppy-disk"></i> Save as recipe</button>
              </div>
            </div>
            <!-- While a dim preview holds the output side, its banner IS the
                 header: the normal Data/Profile controls hide, the report and
                 dim-table views switch here, and closing (or any tab, view,
                 or scope change) reclaims the pane. -->
            <div x-show="previewOn" class="flex items-center gap-2 px-2 py-1 mb-2 rounded bg-primary/10 text-[11px] shrink-0">
              <i class="ph-bold ph-eye"></i><span class="font-medium whitespace-nowrap">dim preview:</span>
              <span class="font-mono text-[10px] opacity-70 truncate" x-text="previewOn"></span>
              <div class="join border border-base-300 overflow-hidden rounded-[var(--radius-field)] ml-1 shrink-0">
                <button class="join-item btn btn-xs h-6 min-h-0 px-2.5 normal-case border-none transition-none"
                        :class="previewMode === 'report' ? 'btn-neutral' : 'btn-ghost bg-base-100'"
                        @click="previewMode = 'report'; sendPreview()">report</button>
                <button class="join-item btn btn-xs h-6 min-h-0 px-2.5 normal-case border-none transition-none"
                        :class="previewMode === 'table' ? 'btn-neutral' : 'btn-ghost bg-base-100'"
                        @click="previewMode = 'table'; sendPreview()">dim table</button>
              </div>
              <button class="btn btn-xs btn-ghost h-6 min-h-0 px-1 ml-auto shrink-0" @click="syncSurfaces()" title="Back to the tab's output" aria-label="Back to the tab's output"><i class="ph ph-x"></i></button>
            </div>
            <div class="flex-1 min-h-[22rem] lg:min-h-0 border border-base-200 rounded overflow-hidden bg-base-100 relative">
              <div x-show="curV === 'csv' && !tabs[active]?.rows?.length && !previewOn" class="absolute inset-0 flex items-center justify-center text-base-content/30 italic text-xs z-10 bg-base-100" x-text="tabs[active]?.err ? 'Error in this tab' : 'This tab not yet run'"></div>
              <div x-show="curV === 'profile' && !tabs[active]?.rows?.length && !previewOn" class="absolute inset-0 flex items-center justify-center text-base-content/30 italic text-xs z-10 bg-base-100" x-text="tabs[active]?.err ? 'Error in this tab' : 'This tab not yet run'"></div>
              <div x-show="curV === 'pivot' && !tabs[active]?.rows?.length && !previewOn" class="absolute inset-0 flex items-center justify-center text-base-content/30 italic text-xs z-10 bg-base-100" x-text="tabs[active]?.err ? 'Error in this tab' : 'This tab not yet run'"></div>
              <div x-show="curV === 'layout' && !tabs[active]?.rows?.length && !previewOn" class="absolute inset-0 flex items-center justify-center text-base-content/30 italic text-xs z-10 bg-base-100" x-text="tabs[active]?.err ? 'Error in this tab' : 'This tab not yet run'"></div>
              <div id="tf-workbench" class="absolute inset-0 overflow-auto" x-data="tfViewer({ defaultMode: 'raw' })"></div>
              <!-- Stacked OVER the viewer rather than swapping with it: the three
                   older views keep their element mounted, so nothing here can
                   change how Tabulator measures itself. -->
              <div x-show="curV === 'layout'" class="absolute inset-0 overflow-auto bg-base-100 p-2">
                <div x-show="!rpReady()" class="text-xs text-base-content/60">Needs kits/report-layout.js, which this page does not load.</div>
                <div x-show="rpReady()" class="space-y-2">
                  <div class="flex items-center gap-2 text-[11px]">
                    <button class="btn btn-xs h-5 min-h-0 px-1.5 btn-ghost tf-copy-btn shrink-0 font-sans normal-case font-normal" :data-clipboard-text="rpTsv()" @click="flash('l')" aria-label="Copy the report as tab-separated values"><i class="ph-bold" :class="copL ? 'ph-check' : 'ph-copy'"></i> TSV</button>
                    <div class="join border border-base-300 overflow-hidden rounded-[var(--radius-field)] shrink-0">
                      <button class="join-item btn btn-xs h-5 min-h-0 px-2 normal-case border-none transition-none font-sans font-normal"
                              :class="rpOrder === 'source' ? 'btn-neutral' : 'btn-ghost bg-base-100'"
                              @click="rpOrder = 'source'; rpSync()">as written</button>
                      <button class="join-item btn btn-xs h-5 min-h-0 px-2 normal-case border-none transition-none font-sans font-normal"
                              :class="rpOrder === 'value' ? 'btn-neutral' : 'btn-ghost bg-base-100'"
                              @click="rpOrder = 'value'; rpSync()">by size</button>
                    </div>
                    <span x-show="rpModel && !rpModel.partition" class="text-base-content/60" x-text="'subtotals withheld · ' + pvAgg + ' does not partition'"></span>
                  </div>
                  <div x-html="rpHtml"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div x-show="lowerOpen" class="hidden lg:block h-1.5 -my-1 hover:bg-primary/20 cursor-row-resize transition-colors shrink-0" @mousedown="bndDrag = true"></div>

      <!-- The lower pane: Overview (what the workbench holds), Dimensions (the
           active fn's output read for keys and the dimension tables they
           define) and Bundle (the export), one at a time. Each tab's readout
           and controls sit at the right of the strip. -->
      <div class="card bg-base-100 border border-base-300 flex flex-col overflow-hidden" :class="lowerOpen ? 'flex-1 min-h-0' : 'shrink-0'">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1 shrink-0 min-w-0" :class="lowerOpen && 'border-b border-base-300'">
          <div class="join border border-base-300 overflow-hidden rounded-[var(--radius-field)] shrink-0">
            <template x-for="pt in [{ k: 'overview', l: 'Overview', i: 'ph-list-checks' }, { k: 'dims', l: 'Dimensions', i: 'ph-magic-wand' }, { k: 'bundle', l: 'Bundle', i: 'ph-package' }]" :key="pt.k">
              <button class="join-item btn btn-xs h-6 min-h-0 px-2 gap-1.5 normal-case border-none transition-none font-medium"
                      :class="lowerOpen && lowerTab === pt.k ? 'btn-neutral' : 'btn-ghost bg-base-100'"
                      :aria-pressed="lowerOpen && lowerTab === pt.k" @click="setLower(pt.k)">
                <i class="ph-bold opacity-70" :class="pt.i"></i><span x-text="pt.l"></span>
              </button>
            </template>
          </div>
          <button class="btn btn-xs btn-ghost px-1 opacity-50 hover:opacity-100" @click="lowerOpen = !lowerOpen; syncLower()"
                  :aria-label="lowerOpen ? 'Fold the lower pane' : 'Open the lower pane'"><i class="ph-bold text-[10px]" :class="lowerOpen ? 'ph-caret-down' : 'ph-caret-up'"></i></button>
          <span x-show="lowerTab === 'overview'" class="font-mono text-[10px] opacity-50" x-text="'scope: ' + overview().scope"></span>
          <!-- Dimensions: the live shape of the active tab's output, recomputed
               on render so it cannot go stale the way a scan stamp could; the
               fact-tab switch, the scan window and a rescan. -->
          <span x-show="lowerTab === 'dims' && wizInfo().rows" class="font-mono text-[10px] opacity-50"
                x-text="wizInfo().name + ' · ' + wizInfo().rows.toLocaleString() + ' × ' + wizInfo().cols + ' cols'"></span>
          <div x-show="lowerTab === 'dims' && lowerOpen" class="flex items-center gap-2 ml-auto">
            <label class="flex items-center gap-1.5 cursor-pointer text-[10px] opacity-60 hover:opacity-100 select-none" title="Keep one generated fact tab that drops every column a dim expresses, keys kept">
              <input type="checkbox" class="checkbox checkbox-xs" x-model="wizFact"> <span>maintain fact tab</span>
            </label>
            <select class="select select-xs select-bordered h-6 min-h-0 text-[10px] opacity-70" x-model="wizCap" @change="scanDims()">
              <option value="50k">check 50k rows</option>
              <option value="all">check all rows</option>
            </select>
            <button class="btn btn-xs btn-ghost px-1.5 opacity-50 hover:opacity-100" @click="scanDims()" title="Rescan the active tab's output" aria-label="Rescan the active tab's output"><i class="ph-bold ph-arrows-clockwise"></i></button>
          </div>
          <!-- Bundle: its size, copy and download, whether or not it is open. -->
          <span x-show="lowerTab === 'bundle'" class="font-mono text-[10px] opacity-50" x-text="bundle ? bundleSz : (ran ? 'not built' : '')"></span>
          <div x-show="lowerTab === 'bundle'" class="flex gap-1 ml-auto">
            <button class="btn btn-xs btn-ghost px-1.5" @click="copyBundle()" :class="copB && 'text-success'"
                    aria-label="Copy the bundle" data-title-tip-bare data-title-tip-look="plain" data-title-tip="Copy the bundle">
              <i class="ph-bold" :class="copB ? 'ph-check' : 'ph-copy'"></i>
            </button>
            <button class="btn btn-xs btn-ghost px-1.5" @click="dlBundle()"
                    aria-label="Download the bundle" data-title-tip-bare data-title-tip-look="plain" data-title-tip="Download the bundle"><i class="ph-bold ph-download"></i></button>
          </div>
        </div>
        <!-- Overview: the inputs and the fns, each a row that selects it, with
             the counts in the headers and one line on what outlasts a reload. -->
        <div x-show="lowerOpen && lowerTab === 'overview'" class="flex-1 min-h-0 overflow-y-auto p-2 text-[11px] max-h-[16rem] lg:max-h-none">
          <div class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div class="min-w-0">
              <div class="flex items-baseline gap-2 mb-1">
                <span class="font-medium">Data inputs</span>
                <span class="font-mono text-[10px] opacity-50" x-show="datasets.length" x-text="datasets.length + ' · ' + overview().inRows.toLocaleString() + ' input rows'"></span>
              </div>
              <template x-for="d in overview().inputs" :key="'ovi-' + d.name">
                <button class="flex items-center gap-2 w-full text-left px-1 py-0.5 rounded hover:bg-base-200/60"
                        @click="if (!d.ref) setScope(datasets.length === 1 ? '__all' : d.name)">
                  <i class="ph ph-table opacity-60 shrink-0"></i>
                  <span class="font-mono truncate" x-text="(d.ref ? '$' : '') + d.name"></span>
                  <span class="opacity-50 shrink-0" x-text="d.ref ? 'reference' : 'input'"></span>
                  <span class="ml-auto font-mono opacity-60 shrink-0" x-text="d.rows.toLocaleString() + ' × ' + d.cols"></span>
                </button>
              </template>
              <div x-show="!datasets.length" class="opacity-40 italic px-1">nothing loaded: paste or drop a table</div>
            </div>
            <div class="min-w-0">
              <div class="flex items-baseline gap-2 mb-1">
                <span class="font-medium">Functions</span>
                <span class="font-mono text-[10px] opacity-50" x-text="tabs.length"></span>
              </div>
              <template x-for="f in overview().fns" :key="'ovf-' + f.i">
                <button class="flex items-center gap-2 w-full text-left px-1 py-0.5 rounded hover:bg-base-200/60"
                        :class="f.active && 'bg-base-200/60'" @click="setActive(f.i)">
                  <i class="ph-bold ph-function opacity-60 shrink-0"></i>
                  <span class="font-mono truncate shrink-0 max-w-[45%]" x-text="f.name"></span>
                  <span x-show="f.reads.length" class="font-mono text-[10px] opacity-40 truncate" x-text="'reads $' + f.reads.join(', $')"></span>
                  <span class="ml-auto font-mono shrink-0" :class="f.err ? 'text-error' : 'opacity-60'" x-text="f.state"></span>
                </button>
              </template>
            </div>
          </div>
          <div class="mt-2 pt-1.5 border-t border-base-200 opacity-60 px-1" x-text="keepsLine()"></div>
        </div>
        <div x-show="wizOpen" class="flex-1 min-h-0 flex max-h-[18rem] lg:max-h-none">
          <!-- The column sidebar: the whole table at a glance (name + distinct
               count) and the selection surface in one. Tap once to include a
               column (dark), twice to make it a key (blue); several keys form
               a compound key, none makes a plain distinct table. Selecting a
               candidate paints its columns here. -->
          <div class="w-44 shrink-0 border-r border-base-200 flex flex-col min-h-0">
            <div class="flex-1 overflow-y-auto p-1 flex flex-col gap-0.5">
              <template x-for="c in wizCols" :key="c">
                <button class="btn btn-xs h-5 min-h-0 px-1.5 normal-case font-mono justify-start gap-1 border transition-none w-full flex-nowrap shrink-0"
                        :class="(wizPick[c] || 0) === 2 ? 'btn-primary border-primary' : (wizPick[c] || 0) === 1 ? 'btn-neutral border-neutral' : 'btn-ghost bg-base-100 border-base-300'"
                        @click="cyclePick(c)" title="Tap: include · tap again: key" aria-label="Tap: include · tap again: key">
                  <i x-show="(wizPick[c] || 0) === 2" class="ph-bold ph-key text-[9px] shrink-0"></i>
                  <span class="truncate" x-text="c"></span>
                  <span class="ml-auto opacity-40 text-[9px] shrink-0" x-text="wizColN[c] < wizScanned ? wizColN[c].toLocaleString() : ''"></span>
                </button>
              </template>
            </div>
            <!-- Acting on the pick: pinned below the list, never scrolled
                 away. Preview shows it in the viewer, + dim adds the tab,
                 + menu lists it with its computed closure, clear starts over. -->
            <div x-show="wizCols.length" class="grid grid-cols-2 gap-1 p-1 border-t border-base-200 shrink-0">
              <button class="btn btn-xs btn-outline h-6 min-h-0 normal-case" :disabled="!Object.values(wizPick).some(v => v)" @click="addManualDim()">+ dim</button>
              <button class="btn btn-xs btn-outline h-6 min-h-0 normal-case" :disabled="!Object.values(wizPick).some(v => v)" @click="addToMenu()" title="Compute what this key set delineates and list it in the menu">+ menu</button>
              <button class="btn btn-xs btn-ghost h-6 min-h-0 normal-case gap-1" :disabled="!Object.values(wizPick).some(v => v)" @click="previewPick()" title="Show the table this pick would produce, in the viewer, without adding a tab"><i class="ph-bold ph-eye"></i> preview</button>
              <button class="btn btn-xs btn-ghost h-6 min-h-0 normal-case gap-1" :disabled="!Object.values(wizPick).some(v => v)" @click="clearPick()"><i class="ph-bold ph-x"></i> clear</button>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto p-2 text-[11px]">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-medium opacity-70">Menu</span>
              <span x-show="wizRefsLine()" class="font-mono text-[10px] opacity-50" x-text="wizRefsLine()"></span>
            </div>
            <!-- The rollup tree: a child is a coarser level its parent's key
                 already delineates; a starred row is a promoted pick. Tap a
                 row to paint it onto the sidebar. -->
            <template x-for="c in wizCands" :key="(c.custom ? '*' : '') + kLabel(c)">
              <div class="border-b border-base-200 last:border-0" :style="'margin-left:' + (c.depth * 1.25) + 'rem'">
                <div class="flex items-center gap-2 py-1 pl-1 cursor-pointer hover:bg-base-200/40 rounded"
                     :class="wizSel === kLabel(c) && 'bg-base-200/60'"
                     @click="selectCand(c)">
                  <i x-show="c.depth" class="ph ph-arrow-elbow-down-right opacity-30 text-[10px] shrink-0"></i>
                  <i x-show="c.custom" class="ph-fill ph-star opacity-40 text-[10px] shrink-0"></i>
                  <span class="font-mono font-medium shrink-0" x-text="kLabel(c)"></span>
                  <span class="opacity-40 shrink-0 text-[10px]" x-text="'(' + c.nKeys.toLocaleString() + ')'"></span>
                  <span class="opacity-50 font-mono text-[10px] truncate" x-text="c.cols.filter(x => !candKeys(c).includes(x)).join(', ')"></span>
                  <button class="btn btn-xs btn-outline h-5 min-h-0 px-1.5 shrink-0 normal-case font-mono ml-auto"
                          @click.stop="addDim(c)">+ dim</button>
                  <button x-show="c.custom" class="btn btn-xs btn-ghost h-5 min-h-0 px-1 shrink-0 hover:text-error"
                          @click.stop="removeCustom(c)" title="Remove this entry from the menu" aria-label="Remove this entry from the menu"><i class="ph ph-x text-[10px]"></i></button>
                </div>
                <!-- The selected entry offers what it COULD delineate (lower
                     cardinality, not carried): tap to fold a column into the
                     pick, then preview to see where the multiplicities sit. -->
                <div x-show="wizSel === kLabel(c) && wizSuggest(c).length" class="flex flex-wrap items-center gap-1 pl-6 pb-1 text-[10px]">
                  <span class="opacity-40">could also test:</span>
                  <template x-for="s in wizSuggest(c)" :key="s">
                    <button class="btn btn-xs h-5 min-h-0 px-1.5 normal-case font-mono border transition-none"
                            :class="wizPick[s] ? 'btn-neutral border-neutral' : 'btn-ghost bg-base-100 border-base-300'"
                            @click.stop="wizPick[s] = wizPick[s] ? 0 : 1"
                            :title="'distinct: ' + (wizColN[s] || 0).toLocaleString()">
                      <span x-text="s"></span>
                    </button>
                  </template>
                </div>
              </div>
            </template>
            <div x-show="wizScanned && !wizCands.length" class="opacity-40 italic">no functional dependencies in this tab's output</div>
            <div x-show="!wizScanned" class="opacity-40 italic">no output to scan yet: paste data and Run</div>
          </div>
        </div>
        <div x-show="bndOpen" class="flex-1 min-h-0 flex max-h-[16rem] lg:max-h-none">
          <!-- The checklist: membership is chosen key by key; an unchecked row
               stays listed (grayed) so it is one tap to bring back.

               :disabled TAKES !! for the same reason the FAB's layer strip
               does. bundleRows() stamps a fixed flag on the meta row alone, so
               on every real key row the expression was undefined, which Alpine's
               x-bind turns into '' for any dotted expression, and '' is not a
               value bind() treats as absent: the attribute went on and the
               whole checklist was unclickable. -->
          <div class="w-56 shrink-0 border-r border-base-200 overflow-y-auto">
            <template x-for="r in bundleRows()" :key="r.k">
              <label class="flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] border-b border-base-200 last:border-0 cursor-pointer hover:bg-base-200/50"
                     :class="!r.sel && 'opacity-40'">
                <input type="checkbox" class="checkbox checkbox-xs" :checked="!!r.sel" :disabled="!!r.fixed" @change="toggleBndKey(r.k)">
                <span class="truncate flex-1" x-text="r.k"></span>
                <span class="opacity-50 shrink-0" x-text="r.sz"></span>
              </label>
            </template>
            <div x-show="!bundleRows().length" class="p-2 text-[10px] opacity-40 italic">no entries yet</div>
          </div>
          <pre class="flex-1 overflow-auto p-2 m-0 text-[10px] leading-4 font-mono whitespace-pre-wrap break-all select-text" x-text="bundlePreview()"></pre>
        </div>
      </div>
      </div>
    </div>
  </div>`;
  }

  window.TransformWorkbench = { panelHTML, version: 1, _clip: null };
})();
