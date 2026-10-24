// ── row-menu: a tap on a row, and what you can do with it ───────────────────
//
//   rowMenu.attach(table, opts)   -> detach()      Tabulator table + a gesture
//   rowMenu.grid(el, config, opts) -> Tabulator    a new grid with a header menu
//                                                  on every column and the row menu
//   rowMenu.headerDefaults(opts)  -> columnDefaults  the header menu alone
//   rowMenu.open({ x, y, items, square }) -> close()   the menu alone, for any host
//   rowMenu.tsv(columns, rows)    -> string        the copy format, exported
//
// THE GESTURE THE OTHER TWO KITS DECLINED TO IMPOSE. record-deck's header says
// its way in "belongs to the host", and swipe-deck's `entry` says "a surface is
// free to add a gesture of its own on top (a row tap)". Both left the row tap
// to whoever owned the rows, and every host that wanted it wrote a button
// instead, because a button is easy and a menu is not. So the row tap never
// happened anywhere, and one host's button became the whole affordance.
//
// WHAT IT COSTS, stated where a host will read it before adopting: swipe-deck's
// same note warns that "a gesture nobody is told about is a feature only its
// author can find". This IS that gesture. A host that drops its visible entry
// for this alone is trading a discoverable affordance for a discovered one, and
// should mean it. Two things make the trade defensible rather than merely
// cheaper: tapping a row is what a reader already tries on a phone, and the
// menu is not a deck opener wearing a disguise, since the copies are useful on
// a table that has no deck at all.
//
// WHY A MENU AND NOT A ROW ACTION. A row has more than one thing to say. "Read
// from here" is the deck, "copy this row" is the row as data, "copy these rows"
// is the table as data, and a host can append its own. One tap that guesses
// between them is a tap that is wrong two thirds of the time.
//
// It follows the finger: the menu opens where the row was tapped rather than in
// a corner, clamped into the viewport, because on a phone the distance between
// what you touched and what answers is the whole of whether it feels connected.
//
// NO TABULATOR IMPORT. `attach` assumes three calls of a table: `on`,
// `getColumns` and `getRows`; `open` reads nothing and takes items, so a host
// with a different grid can raise the same menu. `grid` and the header menu
// are Tabulator's alone, and call the global the host already loaded.
(() => {
  // io.js FETCHED AT LOAD TIME, never inside the click. A clipboard write has to
  // run in the user gesture that asked for it, and an await before the write
  // spends the activation Safari counts. Same idiom, and the same reason, as
  // md-doc.js and the other three delegates the clipboard gate names.
  const ghRef = typeof gh !== 'undefined' ? gh : (window.gh || null);
  if (!window.io && ghRef) ghRef.load('kits/io.js').catch(() => {});
  const copyText = async (text) => {
    if (window.io && typeof window.io.copy === 'function') return window.io.copy(text);
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  };

  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k) el.append(k);
    return el;
  };

  // A CELL AS ONE FIELD OF ONE LINE. Tabs and newlines inside a value would
  // otherwise become column and row breaks in the paste, so a single cell
  // holding a paragraph turns into rows of garbage in the sheet it lands in.
  // Collapsed rather than quoted, because TSV has no quoting anyone agrees on.
  const cell = (v) => v == null ? '' : String(v).replace(/[\t\r\n]+/g, ' ');

  // TSV, HEADERS INCLUDED, for one row and for the whole list alike. It is the
  // one format that survives a paste into a spreadsheet, a chat and an editor
  // without a decision at either end. A single row keeps its header line for
  // the same reason: pasted alone, a row of bare values says nothing about
  // which column each one came from.
  const tsv = (columns, rows) => [
    columns.map(c => cell(c.title || c.field)),
    ...rows.map(r => columns.map(c => cell(r[c.field]))),
  ].map(r => r.join('\t')).join('\n');

  // The visible, field-bearing columns, in the order the grid shows them. Same
  // filter record-deck's fromGrid applies, so the copy and the card agree about
  // what the row consists of.
  const columnsOf = (table) => {
    try {
      return table.getColumns()
        .filter(c => c.getField && c.getField() && (!c.isVisible || c.isVisible()))
        .map(c => ({ field: c.getField(), title: (c.getDefinition() || {}).title || c.getField() }));
    } catch { return []; }
  };
  const activeRows = (table) => {
    try { return table.getRows('active').map(r => r.getData()); } catch { return []; }
  };

  // ── the menu ──────────────────────────────────────────────────────────────
  //
  // One at a time, held in a module-level handle rather than a stack: a second
  // menu opening while the first is up is a mis-tap, not a drill-down, and two
  // floating panels at once on a phone is the failure this is meant to avoid.
  let live = null;

  function close() {
    if (!live) return;
    const { el, onDoc, onKey, onMove, mark } = live;
    live = null;
    document.removeEventListener('pointerdown', onDoc, true);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('scroll', onMove, true);
    window.removeEventListener('resize', onMove);
    if (mark) mark.classList.remove('row-menu-on');
    el.remove();
  }

  // Placed after it is in the document, because its size is not known until it
  // has been laid out and the clamp needs the size. Hidden for that one frame
  // so the reader never sees it at the origin first.
  function place(el, x, y) {
    el.style.visibility = 'hidden';
    el.style.left = '0px';
    el.style.top = '0px';
    document.body.append(el);
    const r = el.getBoundingClientRect();
    const w = window.innerWidth, hgt = window.innerHeight;
    el.style.left = Math.round(Math.min(Math.max(8, x), Math.max(8, w - r.width - 8))) + 'px';
    el.style.top = Math.round(Math.min(Math.max(8, y), Math.max(8, hgt - r.height - 8))) + 'px';
    el.style.visibility = '';
  }

  // items: [{ label, icon, run, keep } | { heading }]. `run` may return a string, which
  // replaces the label for a beat before the menu closes: that is how a copy
  // reports, since a clipboard write has no other visible effect and a toast
  // would be a second floating thing to dismiss. `keep` holds the menu open.
  // `square`: Excel's own look, for a host that is drawing a sheet (the
  // formula-bar copy menu): square corners, a hairline frame, tighter rows.
  // The phone hit target stays, since a mis-tap there costs an action.
  function open({ x = 0, y = 0, items = [], mark = null, square = false } = {}) {
    close();
    if (!items.length) return () => {};
    const el = h('div', {
      class: square
        ? 'menu menu-xs fixed z-[70] w-max min-w-36 max-w-[80vw] rounded-none border border-base-content/20 bg-base-100 p-0.5 shadow-md'
        : 'menu menu-sm fixed z-[70] w-max min-w-40 max-w-[80vw] rounded-box border border-base-300 bg-base-100 p-1 shadow-xl',
      role: 'menu',
    });
    for (const it of items) {
      // A HEADING names the section that follows: the column a header menu was
      // opened on, then the whole table. A rule above every heading but the
      // first is what separates the two sections.
      if (it.heading) {
        el.append(h('div', {
          class: 'truncate px-2 pt-1.5 pb-0.5 text-xs font-semibold opacity-60'
               + (el.childElementCount ? ' mt-1 border-t border-base-300' : ''),
          text: it.heading,
        }));
        continue;
      }
      const label = h('span', { class: 'grow truncate', text: it.label });
      const row = h('button', {
        type: 'button', role: 'menuitem',
        // max-sm:min-h-11 is the phone hit target, the same 44px swipe-deck's
        // entry buys with max-sm:h-11: a menu is the one place a mis-tap costs
        // an action rather than nothing.
        class: (square ? 'rounded-none px-2 py-1 text-[13px]' : 'rounded px-2 py-1.5')
             + ' flex w-full items-center gap-2 text-left max-sm:min-h-11 hover:bg-base-200',
      }, it.icon ? h('i', { class: 'ph ' + it.icon + ' shrink-0 text-base opacity-70' }) : null, label);
      row.addEventListener('click', () => {
        let said;
        try { said = it.run && it.run(); } catch (e) { said = 'Failed'; }
        const settle = (t) => {
          if (!t || live?.el !== el) return;
          label.textContent = t;
          // This menu's own close: one opened in the 700ms since, by a
          // second right-click, is not the one that reported.
          if (!it.keep) setTimeout(() => { if (live?.el === el) close(); }, 700);
        };
        if (said && typeof said.then === 'function') said.then(settle, () => settle('Failed'));
        else if (typeof said === 'string') settle(said);
        else if (!it.keep) close();
      });
      el.append(row);
    }

    // Dismissal, four ways, all outside the menu: a tap elsewhere, Escape, any
    // scroll (the menu is fixed and the row under it is not, so a scrolled menu
    // is pointing at the wrong row), and a resize.
    const onDoc = (e) => { if (!el.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    const onMove = () => close();
    place(el, x, y);
    if (mark) mark.classList.add('row-menu-on');
    live = { el, onDoc, onKey, onMove, mark };
    document.addEventListener('pointerdown', onDoc, true);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return close;
  }

  // ── attaching to a Tabulator table ────────────────────────────────────────
  //
  // opts:
  //   deck      options handed to recordDeck.fromGrid ({ title, describe, … }),
  //             or false to leave the item out. The item is omitted anyway when
  //             record-deck is not loaded, so a host that never wants the deck
  //             can simply not load the kit.
  //   copy      false to leave both copy items out. Default on.
  //   items     [{ label, icon, run(ctx) }] appended, ctx = { row, data, table }
  //   skip      (event) => boolean, extra suppression on top of the link rule
  //   noun      what one row is, for the deck item's wording. Default 'record'.
  //   on        'tap' (the default) opens on a click or tap of the row;
  //             'context' opens on a right-click or a long press instead, for
  //             a grid where a tap already means something or nothing should
  //             interrupt it. Both answer with the same menu.
  //
  // THE LINK RULE. A row whose cell holds a link, a button or a field is a row
  // where the tap already meant something, so the menu stays out of the way.
  // Checked on the tap's own target rather than declared per column, since the
  // host that renders a link into a cell is rarely the host wiring this up.
  const INTERACTIVE = 'a,button,input,select,textarea,label,[contenteditable],[data-no-row-menu]';

  // WHERE A MENU OPENS: at the pointer for a mouse, and below the element for
  // a long press. The finger is still down when a hold opens the menu, and a
  // menu drawn under it would take the release as a tap on its first item.
  // A touch is a TouchEvent, or a contextmenu that Android raised from one.
  const touched = (e) => !!e && typeof window.MouseEvent === 'function'
    && (!(e instanceof window.MouseEvent) || e.pointerType === 'touch' || !!e.sourceCapabilities?.firesTouchEvents);
  const at = (e, el) => {
    if (e && !touched(e) && e.clientX != null) return { x: e.clientX, y: e.clientY };
    const r = el ? el.getBoundingClientRect() : { left: 0, bottom: 0 };
    return { x: r.left, y: r.bottom + 4 };
  };
  // AND THE RELEASE IS SWALLOWED. Lifting the finger after a long press can
  // still send a click, which on a header would sort the column the menu was
  // opened on. One click, in the moment after the finger lifts, never more;
  // the outer timer only cleans up after a touch that never ended.
  const swallowRelease = (e) => {
    if (!touched(e)) return;
    let after = null;
    const eat = (ev) => { ev.preventDefault(); ev.stopPropagation(); drop(); };
    const lifted = () => { after = setTimeout(drop, 400); };
    const drop = () => {
      clearTimeout(timer); clearTimeout(after);
      document.removeEventListener('click', eat, true);
      document.removeEventListener('touchend', lifted, true);
      document.removeEventListener('touchcancel', lifted, true);
    };
    const timer = setTimeout(drop, 8000);
    document.addEventListener('click', eat, true);
    document.addEventListener('touchend', lifted, true);
    document.addEventListener('touchcancel', lifted, true);
  };

  // ── the long press, owned here ────────────────────────────────────────────
  //
  // NOT TABULATOR'S. Its rowTapHold and headerTapHold wait a fixed second, and
  // on an iPhone the press never got there (2026-10-24, Marcus's phone): by
  // about half a second Safari has begun selecting the cell's text, and the
  // gesture is Safari's. A Chromium touch emulation opened both menus, which
  // is why the browser this kit was checked in did not show it. So the hold
  // is timed here, shorter than Safari's, and the cells and header titles do
  // not select or call out on a touch screen. Header filter inputs keep both,
  // since an input that cannot select is an input that cannot be typed in.
  //
  // A move past a few pixels is a scroll, not a hold, and cancels it.
  const HOLD_MS = 450, SLOP = 10;
  const NO_SELECT = [
    'pointer-coarse:[&_.tabulator-cell]:select-none',
    'pointer-coarse:[&_.tabulator-col-title]:select-none',
    'pointer-coarse:[&_.tabulator-cell]:[-webkit-touch-callout:none]',
    'pointer-coarse:[&_.tabulator-col-title]:[-webkit-touch-callout:none]',
  ];
  function holdGesture(root, onHold) {
    if (!root || typeof root.addEventListener !== 'function') return () => {};
    root.classList.add(...NO_SELECT);
    let timer = null, x0 = 0, y0 = 0;
    const clear = () => { clearTimeout(timer); timer = null; };
    const start = (e) => {
      clear();
      if (e.touches.length !== 1) return;
      const p = e.touches[0], target = e.target;
      x0 = p.clientX; y0 = p.clientY;
      timer = setTimeout(() => {
        timer = null;
        try { window.getSelection?.()?.removeAllRanges(); } catch { /* none to clear */ }
        onHold(target, e);
      }, HOLD_MS);
    };
    const move = (e) => {
      const p = e.touches[0];
      if (timer && p && Math.hypot(p.clientX - x0, p.clientY - y0) > SLOP) clear();
    };
    root.addEventListener('touchstart', start, { passive: true });
    root.addEventListener('touchmove', move, { passive: true });
    root.addEventListener('touchend', clear);
    root.addEventListener('touchcancel', clear);
    return () => {
      clear();
      root.removeEventListener('touchstart', start);
      root.removeEventListener('touchmove', move);
      root.removeEventListener('touchend', clear);
      root.removeEventListener('touchcancel', clear);
    };
  }

  function rowItems(table, row, opts) {
    const noun = opts.noun || 'record';
    const data = (row && row.getData && row.getData()) || null;
    if (!data) return [];
    const cols = columnsOf(table);
    const items = [];
    if (opts.deck !== false && window.recordDeck && typeof window.recordDeck.fromGrid === 'function') {
      items.push({
        icon: window.swipeDeck?.entry?.icon || 'ph-cards-three',
        label: 'Read from here',
        run: () => { window.recordDeck.fromGrid(table, { ...(opts.deck || {}), startRow: data }); },
      });
    }
    if (opts.copy !== false && cols.length) {
      const rows = activeRows(table);
      items.push({
        icon: 'ph-copy', label: 'Copy this ' + noun,
        run: () => copyText(tsv(cols, [data])).then(ok => ok ? 'Copied' : 'Copy failed'),
      });
      // THE COUNT IS THE LABEL, and it is the count of what is on screen. A
      // filtered grid copies what the filter left, so a label reading "Copy
      // table" over 74 of 322 rows would be describing the file rather than
      // the copy. Same promise swipe-deck's entry makes about its own count.
      if (rows.length > 1) items.push({
        icon: 'ph-table', label: 'Copy ' + rows.length.toLocaleString() + ' rows',
        run: () => copyText(tsv(cols, rows)).then(ok => ok ? 'Copied' : 'Copy failed'),
      });
    }
    for (const it of (opts.items || [])) {
      items.push({ ...it, run: () => it.run && it.run({ row, data, table }) });
    }
    return items;
  }

  function attach(table, opts = {}) {
    if (!table || typeof table.on !== 'function') return () => {};
    const onRow = (e, row) => {
      if (e && e.target && e.target.closest && e.target.closest(INTERACTIVE)) return;
      if (opts.skip && opts.skip(e)) return;
      // A click that ends a drag across text is a selection, not a request.
      if (opts.on !== 'context' && String(window.getSelection?.() || '')) return;
      const items = rowItems(table, row, opts);
      if (!items.length) return;
      if (opts.on === 'context' && e && e.cancelable) e.preventDefault();
      const el = row.getElement && row.getElement();
      swallowRelease(e);
      open({ ...at(e, el), items, mark: el });
    };
    // On a touch screen the hold below is the context gesture; a contextmenu
    // Android raises from the same press is kept from opening a second menu
    // (and its own), not answered.
    const onContext = (e, row) => {
      if (touched(e)) { if (e.cancelable) e.preventDefault(); return; }
      onRow(e, row);
    };
    const events = opts.on === 'context' ? ['rowContext'] : ['rowClick'];
    const handler = opts.on === 'context' ? onContext : onRow;
    for (const ev of events) table.on(ev, handler);
    const unhold = opts.on === 'context' ? holdGesture(table.element, (target, e) => {
      if (target.closest?.('.tabulator-header, ' + INTERACTIVE)) return;
      const rowEl = target.closest?.('.tabulator-row');
      if (!rowEl) return;
      let row = null;
      try { row = table.getRows('visible').find(r => r.getElement() === rowEl); } catch { /* not built */ }
      if (row) onRow(e, row);
    }) : () => {};
    return () => {
      close();
      unhold();
      for (const ev of events) {
        try { table.off(ev, handler); } catch { /* a table already destroyed */ }
      }
    };
  }

  // ── a column header, and what you can do with it ──────────────────────────
  //
  // Opened by a right-click on the header, or a long press on a phone, which
  // Tabulator routes to the same option (headerContextMenu). The function
  // opens this menu and returns no items, so Tabulator's own popup never draws
  // and the two menus a grid can raise look alike.
  //
  // NO HEADER BUTTON. Tabulator's headerMenu draws a glyph in every column
  // header, and on a narrow grid that glyph is a share of every column's
  // width. The trade is discoverability: the menu is found the way a
  // spreadsheet's is, by right-clicking or holding the header.
  //
  // TWO SECTIONS, under headings: what applies to the column the menu was
  // opened on, then what applies to the whole grid. The grid section repeats
  // on every column, which is the point: there is no other place in a grid's
  // chrome to put it without a toolbar, and the toolbar is what this replaced.
  //
  // HEADER FILTERS ARE HIDDEN, NEVER REMOVED. Tabulator builds them with the
  // columns; hiding the row is a display change and a redraw, while removing
  // them would mean redefining every column. `filters` lets a host that keeps
  // the setting above one table (the workbench, across its grids) own it:
  // { on: () => boolean, set: (on, table) => void }. Without it the setting
  // lives on the table.
  const filtersOn = (table, opts) => opts.filters?.on ? !!opts.filters.on(table) : table.__rmFilters !== false;
  function showFilters(table, on) {
    table.element?.querySelectorAll('.tabulator-header-filter').forEach(el => { el.style.display = on ? '' : 'none'; });
    table.__rmFilters = on;
    try { table.redraw(true); } catch { /* not built yet */ }
  }
  const setFilters = (table, opts, on) => opts.filters?.set ? opts.filters.set(on, table) : showFilters(table, on);

  function headerItems(table, column, opts) {
    const def = column.getDefinition() || {};
    const field = column.getField();
    const name = column.getElement()?.querySelector('.tabulator-col-title')?.textContent?.trim() || field || 'Column';
    const cols = table.getColumns().filter(c => c.getField());
    const shown = cols.filter(c => c.isVisible());
    const filterable = cols.some(c => c.getDefinition()?.headerFilter);
    const values = () => activeRows(table);
    const items = [{ heading: name }];

    if (field && def.headerSort !== false && table.options?.headerSort !== false) {
      const dir = (table.getSorters() || []).find(s => s.field === field)?.dir;
      if (dir !== 'asc') items.push({ icon: 'ph-sort-ascending', label: 'Sort ascending', run: () => table.setSort(field, 'asc') });
      if (dir !== 'desc') items.push({ icon: 'ph-sort-descending', label: 'Sort descending', run: () => table.setSort(field, 'desc') });
      if ((table.getSorters() || []).length) items.push({ icon: 'ph-arrows-down-up', label: 'Clear sort', run: () => table.clearSort() });
    }
    if (field && def.headerFilter) {
      const term = table.getHeaderFilterValue(field);
      items.push({
        icon: 'ph-funnel', label: 'Filter this column',
        run: () => {
          if (!filtersOn(table, opts)) setFilters(table, opts, true);
          requestAnimationFrame(() => column.getElement()?.querySelector('.tabulator-header-filter input, .tabulator-header-filter select')?.focus());
        },
      });
      if (term != null && term !== '') items.push({ icon: 'ph-funnel-x', label: 'Clear this filter', run: () => table.setHeaderFilterValue(field, '') });
    }
    if (field && opts.copy !== false) {
      const n = values().length;
      items.push({
        icon: 'ph-copy', label: n === 1 ? 'Copy 1 value' : 'Copy ' + n.toLocaleString() + ' values',
        run: () => copyText(tsv([{ field, title: name }], values())).then(ok => ok ? 'Copied' : 'Copy failed'),
      });
    }
    if (shown.length > 1) items.push({
      icon: 'ph-eye-slash', label: 'Hide column',
      run: () => { (table.__rmHidden ||= new Set()).add(column); column.hide(); },
    });
    const before = items.length;

    items.push({ heading: opts.tableHeading || 'Table' });
    if (filterable) {
      const on = filtersOn(table, opts);
      items.push({ icon: on ? 'ph-funnel-x' : 'ph-funnel', label: on ? 'Hide header filters' : 'Show header filters', run: () => setFilters(table, opts, !on) });
      if ((table.getHeaderFilters() || []).length) items.push({ icon: 'ph-x', label: 'Clear all filters', run: () => table.clearHeaderFilter() });
    }
    // Only the columns this menu hid: a host that hides its own (the explorer's
    // empty columns) keeps its own switch for them, and a count that included
    // them would undo a choice made somewhere else.
    const hid = [...(table.__rmHidden || [])].filter(c => !c.isVisible());
    if (hid.length) items.push({
      icon: 'ph-eye', label: hid.length === 1 ? 'Show the hidden column' : 'Show ' + hid.length + ' hidden columns',
      run: () => { hid.forEach(c => c.show()); table.__rmHidden.clear(); },
    });
    if (opts.copy !== false && shown.length) {
      const n = values().length;
      if (n) items.push({
        icon: 'ph-table', label: n === 1 ? 'Copy 1 row' : 'Copy ' + n.toLocaleString() + ' rows',
        run: () => copyText(tsv(columnsOf(table), values())).then(ok => ok ? 'Copied' : 'Copy failed'),
      });
    }
    for (const it of (opts.tableItems || [])) items.push({ ...it, run: () => it.run && it.run({ table, column }) });
    if (items.length === before + 1) items.pop();
    return items;
  }

  // What a host merges into its Tabulator options' columnDefaults. A column
  // that defines its own headerContextMenu keeps it.
  function headerDefaults(opts = {}) {
    // A touch arrives here twice over, from Tabulator's own second-long hold
    // and from Android's contextmenu; the kit's hold (in grid) answers touch,
    // so both are let through empty, which still stops the browser's menu.
    const menu = (e, column) => {
      if (touched(e)) return [];
      open({ ...at(e, column.getElement()), items: headerItems(column.getTable(), column, opts) });
      return [];
    };
    return { headerContextMenu: menu };
  }

  // ── a whole grid ──────────────────────────────────────────────────────────
  //
  //   rowMenu.grid(el, config, opts) -> Tabulator
  //
  // `new Tabulator(el, config)` with both menus: the header menu on every
  // column (right-click or long press), and the row menu on a right-click or long press (opts.on decides,
  // as for attach). opts carries attach's options and headerItems' own
  // (filters, tableItems, tableHeading); `rows: false` leaves the row menu off.
  function grid(el, config = {}, opts = {}) {
    const table = new window.Tabulator(el, {
      ...config,
      columnDefaults: { ...headerDefaults(opts), ...(config.columnDefaults || {}) },
    });
    if (opts.rows !== false) attach(table, { on: 'context', ...opts });
    holdGesture(table.element, (target, e) => {
      if (target.closest?.('.tabulator-header-filter')) return;
      const colEl = target.closest?.('.tabulator-col');
      if (!colEl) return;
      const column = table.getColumns().find(c => c.getElement() === colEl);
      if (!column) return;
      swallowRelease(e);
      open({ ...at(e, colEl), items: headerItems(table, column, opts) });
    });
    return table;
  }

  window.rowMenu = { attach, open, close, tsv, columnsOf, grid, headerDefaults, showFilters };
})();
