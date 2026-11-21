// lib/kits/json-explorer.js — Native, framework-free JSON Explorer & Schema Profiler.
//
// Four views of one JSON value, over one toolbar (views, filter, copy,
// download) and a crumb trail once the tree is opened into a field:
//   - Tree: a property sheet, key and value per row, collections closed until
//           tapped, each with its item count and a size column; a filter that
//           leaves out what does not match; an arrow into any collection.
//   - Schema: the top-level fields with type, items and size, and the field
//             types and fill rates of every array of records.
//   - Table: the opened field as rows and columns, when it is an array of records.
//   - JSON: the opened field, pretty-printed.
//
// No external dependencies; copy delegates to kits/io.js when present.
//
// Usage:
//   window.JsonExplorer.mount(container, {
//     data,        // JS object/array or raw JSON string
//     name,        // optional file/subject name
//     fill,        // boolean: true to fill container height and scroll internally
//     mode,        // 'tree' | 'schema' | 'table' | 'raw' (default 'tree'); 'raw' is the JSON view
//     chunk,       // initial path array to focus, e.g. ['repos']
//     views,       // the views offered, a subset of the four keys (default all)
//     tabs,        // false hides the view buttons, for a host that switches with setView
//     filter,      // false hides the filter box
//     toolbar,     // false drops the toolbar row: copy and download go (a host calls
//                  //   copy()), and collapse and the record cards ride the crumb row
//     onView,      // (view) => void, called on every change of view, the explorer's own
//                  //   included (the Schema view's arrows open the tree and the table)
//     schemaPanel, // false keeps Schema a view of its own beside a filled tree, for a
//                  //   host whose own switch reaches it (the session page's Record tab)
//   }) -> { destroy, setView, focusChunk, updateSearch, copy, profile }
(function () {
  // ── DOM Helpers ──────────────────────────────────────────────────────────
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'class') el.className = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else el.setAttribute(k, v);
    }
    for (const k of kids.flat(Infinity)) {
      if (k != null && k !== false) el.append(k);
    }
    return el;
  };

  // vanilla-bundle.js's window.esc, the one escape: it quotes as well, which
  // the textContent trick this replaced did not.
  const esc = (s) => window.esc(s);

  // The clipboard write is kits/io.js's (node/test/clipboard-one-owner.test.mjs).
  // Fetched at load time so the write runs inside the tap that asked for it;
  // without io.js the modern API alone is the fallback.
  const ghRef = typeof gh !== 'undefined' ? gh : (window.gh || null);
  if (!window.io && ghRef) ghRef.load('kits/io.js').catch(() => {});
  const copyText = async (text) => {
    if (window.io && typeof window.io.copy === 'function') return window.io.copy(text);
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  };

  const fmtBytes = (n) => window.Traffic.fmtBytes(n, '');

  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

  const formatIsoDate = (str) => {
    if (!ISO_DATE_RE.test(str)) return null;
    const ms = Date.parse(str);
    if (isNaN(ms)) return null;
    const d = new Date(ms);
    const now = Date.now();
    const diff = now - ms;
    let rel = '';
    if (diff >= 0) {
      const s = Math.floor(diff / 1000);
      if (s < 60) rel = 'just now';
      else if (s < 3600) rel = `${Math.floor(s / 60)}m ago`;
      else if (s < 86400) rel = `${Math.floor(s / 3600)}h ago`;
      else rel = `${Math.floor(s / 86400)}d ago`;
    } else {
      const s = Math.floor(-diff / 1000);
      if (s < 60) rel = 'in a few seconds';
      else if (s < 3600) rel = `in ${Math.floor(s / 60)}m`;
      else rel = `in ${Math.floor(s / 3600)}h`;
    }
    const isoUtc = d.toISOString().replace('.000Z', 'Z').replace('T', ' ');
    return { rel, full: isoUtc };
  };

  // ── JsonProfile: Schema & Structure Analyzer ─────────────────────────────
  const JsonProfile = {
    analyze(data) {
      let nodeCount = 0;
      let maxDepth = 0;
      const typeCounts = { object: 0, array: 0, string: 0, number: 0, boolean: 0, null: 0 };

      const walk = (val, depth = 0) => {
        nodeCount++;
        if (depth > maxDepth) maxDepth = depth;
        if (val === null) {
          typeCounts.null++;
        } else if (Array.isArray(val)) {
          typeCounts.array++;
          for (let i = 0; i < val.length; i++) walk(val[i], depth + 1);
        } else if (typeof val === 'object') {
          typeCounts.object++;
          for (const k in val) walk(val[k], depth + 1);
        } else if (typeof val === 'string') {
          typeCounts.string++;
        } else if (typeof val === 'number') {
          typeCounts.number++;
        } else if (typeof val === 'boolean') {
          typeCounts.boolean++;
        }
      };

      walk(data, 0);

      const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      const byteSize = new Blob([jsonStr]).size;

      // Top-level properties / collections breakdown
      const rootEntries = [];
      const collections = [];

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const [k, v] of Object.entries(data)) {
          const isArr = Array.isArray(v);
          const isObj = v && typeof v === 'object' && !isArr;
          const count = isArr ? v.length : isObj ? Object.keys(v).length : null;
          const type = isArr ? 'array' : isObj ? 'object' : v === null ? 'null' : typeof v;
          const entry = { key: k, type, count, isCollection: isArr || isObj, value: v };
          rootEntries.push(entry);

          if (isArr && v.length > 0 && typeof v[0] === 'object' && v[0] !== null) {
            // Infer table schema for record arrays
            const colMap = new Map();
            for (const item of v) {
              if (!item || typeof item !== 'object') continue;
              for (const [colName, colVal] of Object.entries(item)) {
                if (!colMap.has(colName)) {
                  colMap.set(colName, { name: colName, types: new Set(), nonNull: 0, samples: [] });
                }
                const c = colMap.get(colName);
                if (colVal != null && colVal !== '') {
                  c.nonNull++;
                  c.types.add(Array.isArray(colVal) ? 'array' : typeof colVal);
                  if (c.samples.length < 3 && !c.samples.includes(String(colVal))) {
                    c.samples.push(String(colVal));
                  }
                }
              }
            }
            const columns = [...colMap.values()].map(c => ({
              name: c.name,
              type: [...c.types].join(' | ') || 'null',
              fillRate: v.length ? c.nonNull / v.length : 0,
              samples: c.samples,
            }));
            collections.push({ key: k, length: v.length, columns, isRecordArray: true });
          } else if (isArr || isObj) {
            collections.push({ key: k, length: count, columns: [], isRecordArray: false });
          }
        }
      }

      return {
        byteSize,
        nodeCount,
        maxDepth,
        typeCounts,
        rootEntries,
        collections,
      };
    },
  };

  // ── JsonExplorer Component ───────────────────────────────────────────────
  //
  // A PROPERTY SHEET, not a syntax-coloured dump. Reworked 2026-10-22 on the
  // owner's report from the session form's Raw tab: "it's all cluttered, and
  // there's too much going on, and it raises the question of what we're really
  // trying to show here." What a reader opens a record's raw form to learn is
  // which fields it has, how much of the whole each one is, and what one of
  // them holds. So a row is a key and its value, a collection says how many
  // items it has, and its size sits in a right-hand column the eye can run
  // down, which is the comparison a 5.7 MB record invites (where did the bytes
  // go). Colour marks the filter's matches and, softened, the keys, which the
  // owner asked for on 2026-11-16 (house style rule 9: one role, not a palette).
  //
  // What went, and why each was clutter rather than capability:
  //   - the syntax palette (green strings, blue numbers, amber booleans): it
  //     coloured every value by type, which the value's own text already says;
  //   - the chunk select, a second copy of the tree's own drill-in;
  //   - Collapse / Depth 1 / Expand: "Expand" laid every node of a 5.7 MB record
  //     into the page at once, and the other two were the default view and its
  //     collapse; one icon now returns to the top level, shown when there is
  //     something to collapse;
  //   - the per-row copy-path and copy-value buttons, revealed on hover, which a
  //     touch screen has none of. Copy acts on whatever the tree is opened to,
  //     and since 2026-11-16 a tap selects a row, which stays marked, and a
  //     panel under the tree shows its path, what it is, and its value or, for
  //     a list or an object, its schema, each with a copy icon, which a phone
  //     reaches too; with nothing selected the panel shows the opened field;
  //   - the root row, which drew "nullnull" because Element.append writes a
  //     null argument as the text "null", and said nothing the crumbs do not;
  //   - the rebuilt toolbar: every keystroke in the filter re-rendered the
  //     toolbar and replaced the input, so a second character never landed.
  //     The chrome is built once and updated in place.
  const JsonExplorer = {
    mount(container, options = {}) {
      let rawData = options.data;
      if (typeof rawData === 'string') {
        try { rawData = JSON.parse(rawData); } catch (e) { /* keep as string if unparseable */ }
      }

      const name = options.name || 'document.json';
      const fill = options.fill !== false;
      // DOCKED: a tree that fills its host keeps a panel under it (see the
      // inspector below), and the schema moves from the tabs into that panel.
      const docked = fill;

      const offered = Array.isArray(options.views) && options.views.length
        ? options.views : ['tree', 'schema', 'table', 'raw'];
      const schemaInPanel = docked && offered.includes('tree') && options.schemaPanel !== false;
      let currentView = offered.includes(options.mode) ? options.mode : offered[0];
      if (schemaInPanel && currentView === 'schema') currentView = 'tree';
      let focusedPath = Array.isArray(options.chunk) ? [...options.chunk] : [];
      let searchQuery = '';
      let searchTimer = 0;
      // Closed unless opened: the top level of whatever the tree is opened to
      // is always drawn, and everything below it waits for a tap.
      const openKeys = new Set();
      // How many children an open collection draws. A record's `calls` runs to
      // hundreds of entries and `attachments` to more, so a long one draws a
      // page at a time behind a "show more" row.
      const shownCount = new Map();
      const searchMatches = new Set();
      const searchAncestors = new Set();
      const PAGE = 200;
      const ROW_CAP = 2000;

      // Profiled on first use: the Schema view is the only reader, and a walk
      // of a multi-megabyte record is not a cost to pay on opening the tree.
      let profile = null;
      const getProfile = () => profile || (profile = JsonProfile.analyze(rawData));

      // Bytes as UTF-8, of the compact serialisation, memoised per collection.
      const enc = typeof TextEncoder === 'function' ? new TextEncoder() : null;
      const sizes = new WeakMap();
      const bytesOf = (v) => {
        const memo = v !== null && typeof v === 'object';
        if (memo && sizes.has(v)) return sizes.get(v);
        const s = JSON.stringify(v) ?? '';
        const n = enc ? enc.encode(s).length : s.length;
        if (memo) sizes.set(v, n);
        return n;
      };
      const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

      // ── Helpers: paths and the focused chunk ───────────────────────────
      const getChunkData = (path) => {
        let cur = rawData;
        for (const seg of path) {
          if (cur == null) return undefined;
          cur = cur[seg];
        }
        return cur;
      };
      const pathToProp = (path) => {
        if (!path.length) return 'root';
        return path.map((seg, i) => {
          if (typeof seg === 'number' || /^\d+$/.test(seg)) return `[${seg}]`;
          return i === 0 ? seg : `.${seg}`;
        }).join('');
      };
      const isColl = (v) => v !== null && typeof v === 'object';
      const entriesOf = (v) => (Array.isArray(v) ? v.map((x, i) => [i, x]) : Object.entries(v));
      const countOf = (v) => (Array.isArray(v) ? v.length : Object.keys(v).length);
      const isChunkRecordArray = () => {
        const d = getChunkData(focusedPath);
        return Array.isArray(d) && d.length > 0 && isColl(d[0]);
      };
      const describe = (v) => {
        if (!isColl(v)) return '';
        const n = countOf(v);
        if (!n) return Array.isArray(v) ? 'no items' : 'no fields';
        return plural(n, Array.isArray(v) ? 'item' : 'field');
      };

      // ── The frame: toolbar, crumbs, body ───────────────────────────────
      const root = h('div', {
        class: 'json-explorer @container flex w-full min-w-0 flex-col bg-base-100 '
          + (fill ? 'h-full min-h-0 grow overflow-hidden' : 'my-2'),
      });

      const iconBtn = (icon, tip, onClick) => h('button', {
        type: 'button',
        class: 'btn btn-ghost btn-sm btn-square text-base-content/60 hover:text-base-content',
        'data-title-tip': tip, 'aria-label': tip, onClick,
      }, h('i', { class: `ph ${icon} text-base` }));

      // The views, as plain text buttons rather than a second boxed tab strip:
      // this sits directly under the session form's own tabs, and two boxed
      // strips stacked read as one control with two rows.
      const VIEWS = [['tree', 'Tree'], ['schema', 'Schema'], ['table', 'Table'], ['raw', 'JSON']]
        .filter(([v]) => offered.includes(v) && !(schemaInPanel && v === 'schema'));
      const viewBtn = {};
      const views = h('div', { role: 'tablist',
        class: 'order-1 shrink-0 items-center gap-0.5 ' + (options.tabs === false ? 'hidden' : 'flex') });
      for (const [v, label] of VIEWS) {
        viewBtn[v] = h('button', {
          type: 'button', role: 'tab', 'data-view': v,
          class: 'btn btn-ghost btn-sm px-2.5 font-normal',
          onClick: () => setView(v),
        }, label);
        views.append(viewBtn[v]);
      }

      const searchInput = h('input', {
        type: 'search', placeholder: 'Filter', 'aria-label': 'Filter keys and values',
        autocomplete: 'off', spellcheck: 'false',
        class: 'input input-sm w-full pl-8 pr-16 font-mono text-sm',
        onInput: (e) => {
          clearTimeout(searchTimer);
          const q = e.target.value;
          searchTimer = setTimeout(() => updateSearch(q), 160);
        },
      });
      const searchCount = h('span', {
        'data-match-count': '',
        class: 'pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 font-mono text-xs tabular-nums text-base-content/50',
      });
      // Its own row on a phone, inline from `sm` up: four views and four icons
      // leave a filter box a few characters wide at 390px.
      const searchBox = h('label', { class: 'relative order-3 min-w-0 basis-full sm:order-2 sm:basis-auto sm:flex-1' },
        searchInput, searchCount,
        // After the input, or the input's own background paints over it.
        h('i', { class: 'ph ph-magnifying-glass pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-base-content/40' }));

      const collapseBtn = iconBtn('ph-arrows-in-line-vertical', 'Collapse to the top level', () => {
        openKeys.clear();
        shownCount.clear();
        render();
      });
      const cardsBtn = iconBtn('ph-cards-three', 'Browse the records as cards', async () => {
        const rows = getChunkData(focusedPath);
        const title = name + (focusedPath.length ? ` › ${focusedPath.join(' › ')}` : '');
        try {
          if (!window.recordDeck && window.gh?.load) await window.gh.load('kits/record-deck.js');
          window.recordDeck?.open?.({ rows, title });
        } catch (e) { console.warn(e); }
      });
      const flash = (btn, icon) => {
        const i = btn.querySelector('i');
        i.className = 'ph ph-check text-base text-success';
        setTimeout(() => { i.className = `ph ${icon} text-base`; }, 1200);
      };
      const copyBtn = iconBtn('ph-copy', 'Copy as JSON', async () => {
        await copyText(JSON.stringify(getChunkData(focusedPath), null, 2));
        flash(copyBtn, 'ph-copy');
      });
      const downloadBtn = iconBtn('ph-download-simple', `Download ${name}`, () => {
        const blob = new Blob([JSON.stringify(rawData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      });
      const tools = h('div', { class: 'order-2 ml-auto flex shrink-0 items-center sm:order-3 sm:ml-0' },
        collapseBtn, cardsBtn, copyBtn, downloadBtn);

      const bare = options.toolbar === false;
      const toolbar = h('div', {
        class: (bare ? 'hidden ' : 'flex ')
          + 'shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-base-300 px-1 py-1.5 min-w-0',
      }, views, searchBox, tools);
      // Drawn only once the tree is opened into a field: at the top level the
      // session form's own header already names the record.
      const crumbs = h('div', {
        'data-crumbs': '',
        class: 'hidden shrink-0 items-center gap-1 border-b border-base-200 px-1 py-1 min-w-0 font-mono text-xs',
      });
      const body = h('div', { class: 'min-h-0 flex-1 overflow-auto' });
      // THE INSPECTOR: the selected row in full, under the tree. Its path, what
      // it is, and its value, each copied by the icon beside it. Built once and
      // updated in place; hidden with no selection.
      const copyIcon = (tip, get) => {
        const b = h('button', {
          type: 'button',
          class: 'btn btn-ghost btn-xs btn-square shrink-0 text-base-content/55 hover:text-base-content',
          'data-title-tip': tip, 'aria-label': tip,
          onClick: async () => {
            const text = get();
            if (text == null) return;
            const ok = await copyText(text);
            const i = b.querySelector('i');
            i.className = ok ? 'ph ph-check text-sm text-success' : 'ph ph-x text-sm text-error';
            setTimeout(() => { i.className = 'ph ph-copy text-sm'; }, 1200);
          },
        }, h('i', { class: 'ph ph-copy text-sm' }));
        return b;
      };
      // A docked tree keeps the panel up under it, beside a divider the reader
      // can drag (kits/dock-split.js); with nothing selected the panel shows the
      // opened field. An inline tree shows the panel only for a selection, at
      // one height. A list or an object reads as its Value (indented JSON) or
      // its Schema, by a switch the panel remembers; a plain value has one view.
      let panelMode = 'schema';
      try { const m = localStorage.getItem('json-explorer:panel-view'); if (m === 'value' || m === 'schema') panelMode = m; } catch {}
      if (options.mode === 'schema') panelMode = 'schema';
      const modeBtn = {};
      const modeSwitch = h('div', { role: 'tablist', class: 'hidden shrink-0 items-center gap-0.5' });
      for (const [m, label] of [['value', 'Value'], ['schema', 'Schema']]) {
        modeBtn[m] = h('button', {
          type: 'button', role: 'tab', 'data-panel-view': m,
          class: 'btn btn-ghost btn-xs px-2 font-normal',
          onClick: () => {
            panelMode = m;
            try { localStorage.setItem('json-explorer:panel-view', m); } catch {}
            syncFooter();
          },
        }, label);
        modeSwitch.append(modeBtn[m]);
      }
      // A word before the path says what it is: `file` at the top, `path` below
      // it, whose title-tip walks the path a step at a time.
      const inLabel = h('span', { class: 'shrink-0 text-xs text-base-content/50' });
      const inPath = h('span', { class: 'min-w-0 truncate font-mono text-xs text-base-content/80 select-text' });
      const copyPath = copyIcon('Copy the path', () => panelTarget() ? copyPathOf(panelTarget().path) : null);
      const clearBtn = h('button', {
        type: 'button',
        class: 'btn btn-ghost btn-xs btn-square shrink-0 text-base-content/50 hover:text-base-content',
        'data-title-tip': 'Clear the selection', 'aria-label': 'Clear the selection',
        onClick: () => select(null),
      }, h('i', { class: 'ph ph-x text-sm' }));
      // What the value is and how big, on its own line under the box, so the
      // header keeps to the path and its controls.
      const inWhat = h('div', { 'data-what': '', class: 'shrink-0 truncate px-1 text-xs tabular-nums text-base-content/50' });
      // The value's copy floats in the box's top-right corner, outside the
      // scrolling part, so it stays put while the value scrolls under it.
      const copyValue = copyIcon('Copy the value', () => panelTarget() ? valueText(panelTarget().val) : null);
      copyValue.classList.add('absolute', 'right-1', 'top-1', 'z-10', 'bg-base-100/85', 'backdrop-blur-sm');
      const panelBody = h('div', { class: 'h-full min-h-0 overflow-auto select-text' });
      const panelBox = h('div', { class: 'relative min-h-0 flex-1' }, panelBody, copyValue);
      const footer = h('div', {
        'data-selection': '',
        // One height whatever it shows (house style rule 15): the body takes
        // the room left and scrolls, so the tree above never moves.
        class: 'hidden shrink-0 flex-col gap-1 border-t border-base-300 bg-base-100 px-3 pt-1.5 pb-2 min-w-0' + (docked ? '' : ' h-56'),
      },
        h('div', { class: 'flex min-w-0 items-center gap-1' }, inLabel, inPath, copyPath, h('span', { class: 'ml-auto' }), modeSwitch, clearBtn),
        panelBox, inWhat);
      const handle = h('div', { class: 'hidden h-1.5 shrink-0 self-stretch' });
      let splitPct = 40;
      try { const n = Number(localStorage.getItem('json-explorer:panel')); if (n >= 15 && n <= 85) splitPct = n; } catch {}
      const applySplit = () => { if (docked) footer.style.height = splitPct + '%'; };
      applySplit();
      let split = null;
      const attachSplit = () => {
        if (split || !docked || !window.dockSplit) return;
        split = window.dockSplit.attach(handle, {
          axis: 'row', from: 'end', label: 'Resize the tree and the panel',
          bounds: () => frame.getBoundingClientRect(),
          value: () => splitPct, min: 15, max: 85,
          onChange: (pct) => { splitPct = pct; applySplit(); },
          onCommit: (pct) => { splitPct = pct; applySplit(); try { localStorage.setItem('json-explorer:panel', String(pct)); } catch {} },
        });
        syncFooter();
      };
      if (docked) {
        if (window.dockSplit) queueMicrotask(attachSplit);
        else if (ghRef) ghRef.load('kits/dock-split.js').then(attachSplit).catch(() => {});
      }
      const frame = h('div', { class: 'flex min-h-0 min-w-0 flex-1 flex-col' }, body, handle, footer);

      root.append(toolbar, crumbs, frame);
      container.replaceChildren(root);

      // ── Search ─────────────────────────────────────────────────────────
      // A filter, not a highlighter: rows that neither match nor lead to a
      // match are left out, and the ancestors of a match open to show it.
      const updateSearch = (query) => {
        searchQuery = (query || '').trim().toLowerCase();
        searchMatches.clear();
        searchAncestors.clear();
        if (searchQuery) {
          const base = focusedPath.length;
          const scan = (val, path) => {
            const key = path.length > base ? String(path[path.length - 1]) : '';
            let hit = key.toLowerCase().includes(searchQuery);
            if (!hit && !isColl(val) && val !== null) hit = String(val).toLowerCase().includes(searchQuery);
            if (hit && path.length > base) {
              searchMatches.add(pathToProp(path));
              for (let i = base; i < path.length; i++) searchAncestors.add(pathToProp(path.slice(0, i)));
            }
            if (isColl(val)) for (const [k, v] of entriesOf(val)) scan(v, [...path, k]);
          };
          scan(getChunkData(focusedPath), focusedPath);
        }
        if (searchInput.value.trim().toLowerCase() !== searchQuery) searchInput.value = query || '';
        render();
      };
      const isOpen = (path) => {
        const pk = pathToProp(path);
        return openKeys.has(pk) || (!!searchQuery && searchAncestors.has(pk));
      };

      // ── Tree ───────────────────────────────────────────────────────────
      const INDENT = 1.125;   // rem per level
      const stringOf = (s) => {
        if (s === '') return h('span', { class: 'min-w-0 flex-1 text-base-content/35' }, 'empty');
        if (/^https?:\/\/\S+$/i.test(s)) {
          return h('a', {
            href: s, target: '_blank', rel: 'noopener',
            class: 'min-w-0 flex-1 [overflow-wrap:anywhere] underline decoration-dotted underline-offset-2 hover:decoration-solid',
            onClick: (e) => e.stopPropagation(),
          }, s);
        }
        const date = formatIsoDate(s);
        if (date) {
          return h('span', { class: 'min-w-0 flex-1' }, s,
            h('span', { class: 'ml-2 font-sans text-xs text-base-content/45' }, date.rel));
        }
        // A long string shows three lines and opens on a tap; the ellipsis the
        // clamp draws is the mark that there is more.
        const long = s.length > 140 || s.includes('\n');
        const el = h('span', {
          class: 'min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]' + (long ? ' line-clamp-3' : ''),
        }, s);
        if (long) el.dataset.clamp = '';
        return el;
      };
      // What names a record in a list of them. A row of `calls` reading "11
      // fields" four hundred times says nothing; "Bash · git status" says which
      // call it is. One field that names the kind of thing and one that says
      // which, from the record's own keys, and the count where it has neither.
      const NAMES = ['name', 'title', 'label', 'kind', 'type', 'role', 'tool'];
      const DETAILS = ['path', 'arg', 'cmd', 'text', 'head', 'line', 'message', 'summary', 'id', 'at'];
      const peekOf = (obj) => {
        if (Array.isArray(obj)) return '';
        const pick = (keys) => {
          for (const k of keys) {
            const v = obj[k];
            if ((typeof v === 'string' && v.trim()) || typeof v === 'number') return String(v).replace(/\s+/g, ' ').trim();
          }
          return '';
        };
        return [pick(NAMES), pick(DETAILS)].filter(Boolean).join(' · ');
      };
      const valueOf = (val, inList) => {
        if (val === null) return h('span', { class: 'min-w-0 flex-1 text-base-content/35' }, 'null');
        if (typeof val === 'string') return stringOf(val);
        const peek = inList && isColl(val) ? peekOf(val) : '';
        if (peek) return h('span', { class: 'min-w-0 flex-1 [overflow-wrap:anywhere] text-base-content/80' }, peek);
        // Set as a label, not as a value: in the key's own grey and face it read
        // as a second key ("repos 3 items").
        if (isColl(val)) return h('span', { class: 'min-w-0 flex-1 font-sans text-xs leading-5 text-base-content/45' }, describe(val));
        return h('span', { class: 'min-w-0 flex-1 tabular-nums' }, String(val));
      };

      // A path a reader can paste into code: identifiers dotted, anything else
      // bracketed and quoted, indexes bracketed (freshness[0]["gloss-2"]).
      const copyPathOf = (path) => path.map((seg, i) => {
        if (typeof seg === 'number' || /^\d+$/.test(seg)) return `[${seg}]`;
        if (/^[A-Za-z_$][\w$]*$/.test(seg)) return i === 0 ? seg : `.${seg}`;
        return `[${JSON.stringify(String(seg))}]`;
      }).join('');
      // THE SELECTION: the row last tapped, marked until another is tapped or
      // it is cleared, and shown in full in the inspector under the tree. A
      // click that ends a text selection, or lands on a link, is not a tap on
      // the row.
      let selected = null;          // { path, pk, val }
      const SEL = ['bg-primary/15', 'hover:bg-primary/15', 'shadow-[inset_2px_0_0_var(--color-primary)]'];
      const valueText = (v) => typeof v === 'string' ? v : JSON.stringify(v, null, isColl(v) ? 2 : 0);
      const markRow = (el, on) => {
        if (!el) return;
        for (const c of SEL) el.classList.toggle(c, on);
        el.toggleAttribute('data-selected', on);
      };
      const rowOf = (pk) => pk == null ? null : [...body.querySelectorAll('[data-path]')].find(r => r.getAttribute('data-path') === pk) || null;
      // What a value is, in a word or two, and how big where that says something.
      const whatOf = (v) => {
        if (v === null) return 'null';
        if (isColl(v)) {
          const size = bytesOf(v);
          return [Array.isArray(v) ? 'list' : 'object', describe(v), size >= 1024 ? fmtBytes(size) : ''].filter(Boolean).join(' · ');
        }
        if (typeof v === 'string') return v === '' ? 'text · empty' : `text · ${plural(v.length, 'character')}`;
        return typeof v === 'boolean' ? 'true or false' : typeof v;
      };
      // The path a step at a time, each with what it lands on. A title-tip runs
      // to six lines with its lead, so a deeper path keeps its first two steps
      // and its last two, with a count of the steps between.
      const pathSteps = (path) => {
        const lines = path.map((seg, i) => {
          const step = typeof seg === 'number' || /^\d+$/.test(seg) ? `[${seg}]` : String(seg);
          return `${step} · ${whatOf(getChunkData(path.slice(0, i + 1)))}`;
        });
        return lines.length <= 5 ? lines : [...lines.slice(0, 2), `⋯ ${plural(lines.length - 4, 'step')}`, ...lines.slice(-2)];
      };
      const valueView = (v) => {
        if (typeof v === 'string' && /^https?:\/\/\S+$/i.test(v)) {
          return h('a', { href: v, target: '_blank', rel: 'noopener', class: 'link block px-2.5 py-1.5 text-sm [overflow-wrap:anywhere]' }, v);
        }
        const date = typeof v === 'string' ? formatIsoDate(v) : null;
        return h('div', { class: 'whitespace-pre-wrap px-2.5 py-1.5 [overflow-wrap:anywhere] text-sm leading-6' + (typeof v === 'string' ? '' : ' tabular-nums') },
          v === null ? 'null' : String(v),
          date ? h('span', { class: 'ml-2 text-xs text-base-content/45' }, date.rel) : null);
      };
      // What the panel is about: the selection, or with none, the opened field.
      const panelTarget = () => selected
        || (docked ? { path: focusedPath, pk: null, val: getChunkData(focusedPath) } : null);
      let shown = null, shownMode = null;   // what the panel last drew, so a redraw of the tree does not redraw it
      // A list or an object as indented JSON, cut at JSON_CAP characters with a
      // label saying so, since a multi-megabyte file would stall the pane.
      const JSON_CAP = 200000;
      const jsonView = (v) => {
        const text = JSON.stringify(v, null, 2);
        const cut = text.length > JSON_CAP;
        return h('div', {},
          h('pre', { class: 'whitespace-pre-wrap px-2.5 py-1.5 [overflow-wrap:anywhere] font-mono text-xs leading-5' }, cut ? text.slice(0, JSON_CAP) : text),
          cut ? h('div', { class: 'px-2.5 pb-1.5 text-xs text-base-content/50' }, `The first ${fmtBytes(JSON_CAP)} of ${fmtBytes(text.length)}`) : null);
      };
      const syncFooter = () => {
        const t = currentView === 'tree' ? panelTarget() : null;
        const on = !!t && t.val !== undefined;
        footer.classList.toggle('hidden', !on);
        footer.classList.toggle('flex', on);
        handle.classList.toggle('hidden', !(on && split));
        if (!on) { shown = null; return; }
        inPath.textContent = copyPathOf(t.path) || name;
        inLabel.textContent = t.path.length ? 'path' : 'file';
        if (t.path.length) {
          inLabel.setAttribute('data-title-tip-lead', `${plural(t.path.length, 'step')} from the top of ${name}`);
          inLabel.setAttribute('data-title-tip', pathSteps(t.path).join('\n'));
        } else {
          inLabel.removeAttribute('data-title-tip-lead');
          inLabel.removeAttribute('data-title-tip');
        }
        copyPath.classList.toggle('hidden', !t.path.length);
        clearBtn.classList.toggle('hidden', !selected);
        inWhat.textContent = whatOf(t.val);
        const coll = isColl(t.val);
        const mode = coll ? panelMode : 'value';
        show(modeSwitch, coll);
        for (const [m, b] of Object.entries(modeBtn)) {
          const on = m === mode;
          b.classList.toggle('bg-base-200', on);
          b.classList.toggle('text-base-content', on);
          b.classList.toggle('text-base-content/55', !on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        }
        if (shown === t.val && shownMode === mode && coll) return;
        shown = t.val; shownMode = mode;
        const schema = coll && mode === 'schema';
        panelBox.className = 'relative min-h-0 flex-1' + (schema ? '' : ' overflow-hidden rounded-box border border-base-300 bg-base-200/40');
        copyValue.classList.toggle('hidden', schema);
        panelBody.replaceChildren(schema ? schemaView(t.val, t.path) : coll ? jsonView(t.val) : valueView(t.val));
        panelBody.scrollTop = 0;
      };
      const select = (sel) => {
        if (selected) markRow(rowOf(selected.pk), false);
        selected = sel && (!selected || selected.pk !== sel.pk) ? sel : null;
        if (selected) markRow(rowOf(selected.pk), true);
        syncFooter();
      };
      const tapIsRead = (e, rowEl) => {
        if (e.target.closest('a,button')) return true;
        const sel = window.getSelection && window.getSelection();
        return !!(sel && !sel.isCollapsed && rowEl.contains(sel.anchorNode));
      };

      let budget = 0;
      // Values start in one column per object, as wide as its longest key up
      // to KEY_CAP characters (and never past a third of the pane); a longer
      // key pushes only its own value over. Keys are monospace, so ch is exact.
      const KEY_CAP = 20;
      const keyWidth = (keys) => Math.min(KEY_CAP, Math.max(0, ...keys.map(k => String(k).length)));
      const row = (key, val, path, depth, kw = 0) => {
        const pk = pathToProp(path);
        const coll = isColl(val);
        const n = coll ? countOf(val) : 0;
        const open = coll && n > 0 && isOpen(path);
        const size = coll || typeof val === 'string' ? bytesOf(val) : 0;
        const el = h('div', {
          'data-path': pk,
          class: 'flex min-w-0 items-start gap-2 py-0.5 pr-1 '
            + (searchMatches.has(pk) ? 'bg-primary/10 ' : '')
            + (n ? 'group cursor-pointer hover:bg-primary/8 hover:shadow-[inset_2px_0_0_var(--color-primary)] focus-visible:bg-primary/8 focus-visible:shadow-[inset_2px_0_0_var(--color-primary)] focus-visible:outline-none ' : ''),
          style: `padding-left:${0.5 + depth * INDENT}rem`,
        },
          n ? h('i', { class: 'ph ph-caret-right mt-1 shrink-0 text-xs text-base-content/45 transition group-hover:text-primary group-focus-visible:text-primary' + (open ? ' rotate-90' : '') })
            : h('span', { class: 'w-3 shrink-0' }),
          key === null ? null : h('span', {
            class: 'shrink-0 font-mono text-xs leading-5 text-primary/75 transition-colors group-hover:text-primary group-focus-visible:text-primary' + (typeof key === 'number' ? ' text-right' : ''),
            style: kw ? `min-width:min(${kw}ch, 33%)` : null,
          }, String(key)),
          valueOf(val, typeof key === 'number'));
        // The column to compare down, at the row's right edge. Below a kilobyte
        // it is noise, and a number or a boolean has no size worth stating. A
        // row with neither a size nor an arrow reserves nothing, so a short
        // value is not squeezed by an empty column on a phone; a row with a
        // size and no arrow keeps the arrow's slot, so the sizes line up.
        if (size >= 1024 || n) {
          el.append(h('span', { class: 'w-16 shrink-0 text-right font-sans text-xs leading-5 tabular-nums text-base-content/45' },
            size >= 1024 ? fmtBytes(size) : ''));
        }
        // The way into a collection, on every device: the hover-revealed
        // controls this replaced were unreachable on a phone.
        if (n || size >= 1024) el.append(n ? h('button', {
          type: 'button',
          class: 'btn btn-ghost btn-xs btn-square -my-0.5 shrink-0 text-base-content/35 hover:text-base-content',
          'data-title-tip': `Open ${key === null ? 'this' : key} on its own`,
          'aria-label': `Open ${key === null ? 'this' : key} on its own`,
          onClick: (e) => { e.stopPropagation(); focusChunk(path); },
        }, h('i', { class: 'ph ph-arrow-right text-sm' })) : h('span', { class: 'w-6 shrink-0' }));
        if (selected && selected.pk === pk) queueMicrotask(() => markRow(el, true));
        if (!n) {
          el.classList.add('cursor-pointer', 'hover:bg-primary/8');
          el.addEventListener('click', (e) => { if (!tapIsRead(e, el)) select({ path, pk, val }); });
        }
        if (n) {
          el.setAttribute('role', 'button');
          el.setAttribute('tabindex', '0');
          el.setAttribute('aria-expanded', open ? 'true' : 'false');
          const toggle = () => {
            if (openKeys.has(pk)) openKeys.delete(pk); else openKeys.add(pk);
            selected = { path, pk, val };
            render();
          };
          el.addEventListener('click', (e) => { if (!tapIsRead(e, el)) toggle(); });
          el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
          });
        }
        return el;
      };
      const quiet = (text, depth = 0) => h('div', {
        class: 'py-1 font-sans text-sm text-base-content/50',
        style: `padding-left:${0.5 + depth * INDENT + 1.25}rem`,
      }, text);
      const addChildren = (into, val, path, depth) => {
        const all = entriesOf(val);
        const pk = pathToProp(path);
        const limit = searchQuery ? all.length : (shownCount.get(pk) || PAGE);
        const kw = keyWidth(all.slice(0, limit).map(([k]) => k));
        for (const [k, v] of all.slice(0, limit)) {
          if (budget >= ROW_CAP) return;
          const p = [...path, k];
          const ck = pathToProp(p);
          if (searchQuery && !searchMatches.has(ck) && !searchAncestors.has(ck)) continue;
          budget++;
          into.append(row(k, v, p, depth, kw));
          if (isColl(v) && countOf(v) && isOpen(p)) addChildren(into, v, p, depth + 1);
        }
        if (all.length > limit) {
          into.append(h('button', {
            type: 'button',
            class: 'btn btn-ghost btn-xs my-0.5 font-sans font-normal text-base-content/60',
            style: `margin-left:${0.5 + depth * INDENT + 1.25}rem`,
            onClick: () => { shownCount.set(pk, limit + PAGE); render(); },
          }, `Show ${Math.min(PAGE, all.length - limit)} more of ${all.length.toLocaleString()}`));
        }
      };
      const renderTree = () => {
        const data = getChunkData(focusedPath);
        if (data === undefined) { body.append(quiet(`Nothing at ${pathToProp(focusedPath)}`)); return; }
        const list = h('div', { class: 'min-w-0 py-1 text-sm leading-5 select-text' });
        budget = 0;
        if (isColl(data)) addChildren(list, data, focusedPath, 0);
        else list.append(row(null, data, focusedPath, 0));
        if (!list.childNodes.length) list.append(quiet(searchQuery ? 'No matches' : describe(data)));
        if (budget >= ROW_CAP) list.append(quiet(`The first ${ROW_CAP.toLocaleString()} rows`));
        body.append(list);
      };

      // ── Schema ─────────────────────────────────────────────────────────
      const label = (text) => h('div', { class: 'px-1 text-xs font-medium text-base-content/55' }, text);
      // The schema of any value at `path`: its fields, and the columns of every
      // list of records among them. The profile reads objects, so a list is
      // read under its own name, as the one field of a wrapper.
      const profiles = new WeakMap();
      const schemaView = (val, path) => {
        const wrapped = Array.isArray(val);
        const wrapKey = path.length ? String(path[path.length - 1]) : name;
        let p = val === rawData && !wrapped ? getProfile() : profiles.get(val);
        if (!p) { p = JsonProfile.analyze(wrapped ? { [wrapKey]: val } : val); profiles.set(val, p); }
        const at = (key) => wrapped ? path : [...path, key];
        const wrap = h('div', { class: 'flex flex-col gap-4 px-2 py-2 font-sans text-sm select-text' });

        // A wrapped list's one field would repeat the panel's own line, so a
        // list shows its records' columns, or as JSON when it holds no records.
        if (wrapped && !p.collections.some(c => c.isRecordArray)) {
          wrap.append(h('pre', { class: 'whitespace-pre-wrap [overflow-wrap:anywhere] font-mono text-xs leading-5' }, JSON.stringify(val, null, 2)));
        }
        if (p.rootEntries.length && !wrapped) {
          const tbody = h('tbody', {});
          for (const e of p.rootEntries) {
            tbody.append(h('tr', {
              class: e.isCollection ? 'cursor-pointer hover:bg-base-200/60' : '',
              onClick: e.isCollection ? () => { focusChunk(at(e.key)); setView('tree'); } : null,
            },
              h('td', { class: 'font-mono' }, e.key),
              h('td', { class: 'font-mono text-base-content/60' }, e.type),
              h('td', { class: 'text-right tabular-nums text-base-content/70' }, e.count != null ? e.count.toLocaleString() : ''),
              h('td', { class: 'text-right tabular-nums text-base-content/70' }, fmtBytes(bytesOf(e.value)))));
          }
          // The whole document's figures are the table's foot, under the
          // columns they total, rather than a line of totals above it
          // (skills/html-style rule 1): its size under the fields' sizes, its
          // node count under their item counts, its depth under their types.
          const n = p.collections.length;
          wrap.append(h('div', { class: 'flex flex-col gap-1' },
            label('Fields'),
            h('table', { class: 'table table-sm' },
              h('thead', {}, h('tr', { class: 'text-base-content/55' },
                h('th', {}, 'Field'), h('th', {}, 'Type'),
                h('th', { class: 'text-right' }, 'Items'), h('th', { class: 'text-right' }, 'Size'))),
              tbody,
              h('tfoot', { 'data-schema-total': '' }, h('tr', { class: 'font-normal text-base-content/55' },
                h('td', { title: `${n} ${n === 1 ? 'collection' : 'collections'} at any depth` }, 'All'),
                h('td', { class: 'font-mono' }, `depth ${p.maxDepth}`),
                h('td', { class: 'text-right tabular-nums' }, `${p.nodeCount.toLocaleString()} nodes`),
                h('td', { class: 'text-right tabular-nums' }, fmtBytes(p.byteSize)))))));
        }

        const recordArrays = p.collections.filter(c => c.isRecordArray);
        for (const coll of recordArrays) {
          const cbody = h('tbody', {});
          for (const col of coll.columns) {
            const pct = Math.round(col.fillRate * 100);
            cbody.append(h('tr', {},
              h('td', { class: 'font-mono' }, col.name),
              h('td', { class: 'font-mono text-base-content/60' }, col.type),
              h('td', { class: 'w-32' },
                h('div', { class: 'flex items-center gap-2' },
                  h('div', { class: 'h-1.5 flex-1 overflow-hidden rounded-full bg-base-300' },
                    h('div', { class: 'h-full bg-base-content/40', style: `width:${pct}%` })),
                  h('span', { class: 'w-9 text-right text-xs tabular-nums text-base-content/60' }, `${pct}%`))),
              h('td', { class: 'max-w-xs truncate font-mono text-base-content/60' }, col.samples.join(', '))));
          }
          wrap.append(h('div', { class: 'flex flex-col gap-1' },
            h('div', { class: 'flex items-center gap-2 px-1' },
              h('span', { class: 'font-mono text-sm font-medium' }, coll.key),
              h('span', { class: 'text-xs text-base-content/55' },
                `${plural(coll.length, 'record')} · ${plural(coll.columns.length, 'field')}`),
              h('span', { class: 'grow' }),
              iconBtn('ph-table', `Open ${coll.key} as a table`, () => { focusChunk(at(coll.key)); setView('table'); }),
              iconBtn('ph-tree-structure', `Open ${coll.key} in the tree`, () => { focusChunk(at(coll.key)); setView('tree'); })),
            h('table', { class: 'table table-sm' },
              h('thead', {}, h('tr', { class: 'text-base-content/55' },
                h('th', {}, 'Field'), h('th', {}, 'Type'), h('th', {}, 'Filled'), h('th', {}, 'Samples'))),
              cbody)));
        }
        return wrap;
      };
      const renderSchema = () => { body.append(schemaView(rawData, [])); };

      // ── Table ──────────────────────────────────────────────────────────
      const renderTable = () => {
        const data = getChunkData(focusedPath);
        if (!Array.isArray(data) || !data.length || !isColl(data[0])) {
          body.append(quiet('Not a list of records'));
          return;
        }
        const colSet = new Set();
        for (const r of data) if (isColl(r)) for (const k in r) colSet.add(k);
        const cols = [...colSet];
        const shown = searchQuery
          ? data.filter(r => isColl(r) && cols.some(c => String(r[c] ?? '').toLowerCase().includes(searchQuery)))
          : data;
        const tbody = h('tbody', {});
        if (!shown.length) {
          tbody.append(h('tr', {}, h('td', { colspan: cols.length + 1, class: 'py-6 text-center text-base-content/50' }, 'No matches')));
        }
        shown.forEach((r, i) => {
          tbody.append(h('tr', { class: 'hover:bg-base-200/40' },
            h('td', { class: 'text-right tabular-nums text-base-content/40' }, String(i + 1)),
            ...cols.map(c => {
              const v = (r || {})[c];
              const text = v === undefined ? '' : isColl(v) ? JSON.stringify(v) : String(v);
              return h('td', {
                class: 'max-w-xs truncate font-mono ' + (v === null || isColl(v) ? 'text-base-content/50' : ''),
                'data-title-tip': text,
              }, text);
            })));
        });
        body.append(h('div', { class: 'min-w-0 px-1 py-1 font-sans text-sm' },
          h('table', { class: 'table table-sm table-pin-rows table-pin-cols' },
            h('thead', {}, h('tr', { class: 'bg-base-100 text-base-content/55' },
              h('th', { class: 'w-10' }, '#'),
              ...cols.map(c => h('th', { class: 'font-mono font-medium' }, c)))),
            tbody)));
      };

      // ── JSON ───────────────────────────────────────────────────────────
      const renderRaw = () => {
        body.append(h('pre', {
          class: 'px-3 py-2 font-mono text-xs leading-5 select-text',
          text: JSON.stringify(getChunkData(focusedPath), null, 2),
        }));
      };

      // ── Chrome, updated in place ───────────────────────────────────────
      const show = (el, on, display = 'flex') => { el.classList.toggle('hidden', !on); el.classList.toggle(display, on); };
      const syncChrome = () => {
        const records = isChunkRecordArray();
        if (currentView === 'table' && !records && offered.includes('tree')) currentView = 'tree';
        for (const [v] of VIEWS) {
          const b = viewBtn[v];
          const on = v === currentView;
          b.classList.toggle('hidden', v === 'table' && !records);
          b.classList.toggle('bg-base-200', on);
          b.classList.toggle('text-base-content', on);
          b.classList.toggle('text-base-content/55', !on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        }
        const tabsShown = Object.values(viewBtn).filter(b => !b.classList.contains('hidden')).length;
        const tabbed = options.tabs !== false && tabsShown > 1;
        show(views, tabbed);
        // With no tabs on the row, the filter shares it with the icons on a
        // phone too, rather than leaving the icons a row of their own.
        for (const c of ['order-3', 'basis-full']) searchBox.classList.toggle(c, tabbed);
        for (const c of ['order-2', 'flex-1']) searchBox.classList.toggle(c, !tabbed);
        const filters = options.filter !== false && (currentView === 'tree' || currentView === 'table');
        searchBox.classList.toggle('hidden', !filters);
        searchCount.textContent = searchQuery && currentView === 'tree' ? searchMatches.size.toLocaleString() : '';
        collapseBtn.classList.toggle('hidden', !(currentView === 'tree' && openKeys.size));
        cardsBtn.classList.toggle('hidden', !records);
        if (records) {
          const n = getChunkData(focusedPath).length;
          cardsBtn.setAttribute('data-title-tip', `Browse ${plural(n, 'record')} as cards`);
          cardsBtn.setAttribute('aria-label', `Browse ${plural(n, 'record')} as cards`);
        }
        const what = focusedPath.length ? String(focusedPath[focusedPath.length - 1]) : name;
        copyBtn.setAttribute('data-title-tip', `Copy ${what} as JSON`);
        copyBtn.setAttribute('aria-label', `Copy ${what} as JSON`);

        crumbs.replaceChildren();
        show(crumbs, focusedPath.length > 0);
        if (!focusedPath.length) return;
        crumbs.append(h('button', {
          type: 'button',
          class: 'btn btn-ghost btn-xs btn-square shrink-0 text-base-content/60',
          'data-title-tip': 'Up one level', 'aria-label': 'Up one level',
          onClick: () => focusChunk(focusedPath.slice(0, -1)),
        }, h('i', { class: 'ph ph-arrow-left text-sm' })));
        const trail = h('div', { class: 'flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none]' });
        const crumb = (text, path, last) => h('button', {
          type: 'button', 'data-crumb': '',
          class: last ? 'text-base-content' : 'text-base-content/55 hover:text-base-content',
          onClick: () => focusChunk(path),
        }, text);
        trail.append(crumb(name, [], false));
        focusedPath.forEach((seg, i) => {
          trail.append(h('span', { class: 'text-base-content/30' }, '›'),
            crumb(String(seg), focusedPath.slice(0, i + 1), i === focusedPath.length - 1));
        });
        const here = getChunkData(focusedPath);
        const size = here === undefined ? 0 : bytesOf(here);
        crumbs.append(trail, h('span', { class: 'ml-auto shrink-0 pl-2 font-sans text-base-content/50' },
          [describe(here), size >= 1024 ? fmtBytes(size) : ''].filter(Boolean).join(' · ')));
        // With no toolbar row, the two controls that depend on where the tree
        // is opened ride here, where that place is named.
        if (bare) crumbs.append(collapseBtn, cardsBtn);
      };

      const render = () => {
        syncChrome();
        syncFooter();
        body.replaceChildren();
        if (currentView === 'tree') renderTree();
        else if (currentView === 'schema') renderSchema();
        else if (currentView === 'table') renderTable();
        else if (currentView === 'raw') renderRaw();
      };

      // ── Public navigation ──────────────────────────────────────────────
      const setView = (v) => {
        if (!offered.includes(v)) return;
        if (schemaInPanel && v === 'schema') { panelMode = 'schema'; v = 'tree'; }
        currentView = v;
        render();
        body.scrollTop = 0;
        if (typeof options.onView === 'function') options.onView(currentView);
      };
      const focusChunk = (path) => {
        focusedPath = Array.isArray(path) ? path : [];
        if (selected && !focusedPath.every((seg, i) => selected.path[i] === seg)) selected = null;
        openKeys.clear();
        shownCount.clear();
        // The filter is relative to the opened field, so it is run again there.
        if (searchQuery) updateSearch(searchQuery); else render();
        body.scrollTop = 0;
      };

      render();

      return {
        get profile() { return getProfile(); },
        setView,
        focusChunk,
        updateSearch,
        // The opened field as JSON, onto the clipboard: the toolbar's copy,
        // for a host that drew its own button.
        copy: () => copyText(JSON.stringify(getChunkData(focusedPath), null, 2)),
        destroy: () => {
          clearTimeout(searchTimer);
          root.remove();
        },
      };
    },
  };

  window.JsonProfile = JsonProfile;
  window.JsonExplorer = JsonExplorer;
})();
