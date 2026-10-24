// tabular-explorer.js — Exploratory Data Analysis (EDA) and immersive
// inspection for tabular data (CSV, TSV, JSON rows).
//
// Bridges the gap between a raw grid and a full transformation pipeline:
//   - Data: full virtualized grid (Tabulator) with column search, filter toggling,
//           empty-column suppression, and record-deck cards integration.
//   - Profile: visual EDA column profiling inspired by modern data science tools:
//              * Dataset completeness banner & type summary
//              * Rich column cards with inferred types (Numeric, Categorical, ID, Temporal, Empty)
//              * Fill rate bars (% populated vs % null)
//              * Categorical top-value frequency bars with counts & share
//              * Numeric 5-number summary (Min, 25%, Median, Mean, 75%, Max, Sum) + SVG distribution histograms
//              * Financial & accounting coercion: understands `$`, `,`, and `(23.00)`
//              * Interactive click-to-filter: clicking a category value jumps to Data filtered to that value
//   - Pivot: interactive slice-and-dice matrix:
//            * 1-3 row grouping dimensions, optional column dimension
//            * Aggregates (Sum, Mean, Count, Min, Max) on numeric measures
//            * Proportional horizontal data bars in cells
//            * Subtotals & grand totals, CSV export
//
// Usage:
//   window.TabularExplorer.mount(container, {
//     rows,          // [{}], raw record array
//     columns,       // optional [{ field, title, ... }]
//     name,          // file name for titles & downloads
//     opts,          // optional { filter, onWorkbench, ... }
//   }) -> { destroy, setView, getProfile, ... }
(() => {
  // ---- DOM Helper -----------------------------------------------------------
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else el.setAttribute(k, v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) el.append(k);
    return el;
  };

  // vanilla-bundle.js's window.esc, the one escape: it quotes as well, which
  // the textContent trick this replaced did not.
  const esc = (s) => window.esc(s);

  // The profile and the pivot are computed by kits/table-stats.js
  // (window.TableStats), which the workbench's Profile and Pivot read too.
  // Fetched at load; the viewer, which mounts this, awaits it first.
  const ghRef = typeof gh !== 'undefined' ? gh : (window.gh || null);
  if (!window.TableStats && ghRef?.load) ghRef.load('kits/table-stats.js').catch(() => {});

  const fmtNum = (n, dec = 2) => {
    if (n == null || isNaN(n)) return '';
    const abs = Math.abs(n);
    const str = abs.toLocaleString(undefined, {
      minimumFractionDigits: Number.isInteger(abs) ? 0 : 2,
      maximumFractionDigits: dec,
    });
    return n < 0 ? `(${str})` : str;
  };

  const fmtPct = (p) => `${Math.round(p * 100)}%`;

  // ---- TabularExplorer Component -------------------------------------------
  const TabularExplorer = {
    mount(container, { rows = [], columns = null, name = 'data.csv', opts = {} } = {}) {
      const profile = window.TableStats.profile(rows, { ...opts, columns });
      const columnTitle = field => profile.columns.find(c => c.name === field)?.title ?? field;
      let activeView = 'data'; // 'data' | 'columns' | 'pivot'
      let hideEmptyCols = false;
      let colSearch = '';
      let colSort = 'index'; // 'index' | 'name' | 'missing' | 'cardinality'
      let colTypeFilter = 'all';
      let selectedColName = profile.columns[0]?.name || null;

      // Root shell
      const root = h('div', { class: 'tabular-explorer flex flex-col h-full w-full min-w-0 overflow-hidden bg-base-100 text-base-content' });
      container.replaceChildren(root);

      // Header Bar: Segmented Tabs on the left, Actions on the right
      const header = h('div', { class: 'shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 border-b border-base-300 bg-base-200/60 select-none' });
      const navGroup = h('div', { role: 'tablist', class: 'tabs tabs-box tabs-xs' });
      const actionGroup = h('div', { class: 'flex items-center gap-1' });
      header.append(navGroup, actionGroup);
      root.append(header);

      // Main content view stages
      const stage = h('div', { class: 'flex-1 min-h-0 relative overflow-hidden' });
      root.append(stage);

      const dataStage = h('div', { class: 'absolute inset-0 flex flex-col' });
      const columnsStage = h('div', { class: 'absolute inset-0 flex flex-col overflow-hidden hidden' });
      const pivotStage = h('div', { class: 'absolute inset-0 flex flex-col overflow-hidden hidden' });
      stage.append(dataStage, columnsStage, pivotStage);

      // Segmented Tabs
      const tabData = h('button', {
        role: 'tab',
        type: 'button',
        class: 'tab tab-active gap-1.5 font-medium',
        onClick: () => setView('data'),
      }, h('i', { class: 'ph ph-table text-xs' }),
         h('span', { text: 'Data' }),
         h('span', { class: 'opacity-60 font-mono text-[10px]', text: `(${profile.rowCount.toLocaleString()})` }));

      const tabCols = h('button', {
        role: 'tab',
        type: 'button',
        class: 'tab gap-1.5 font-medium',
        onClick: () => setView('columns'),
      }, h('i', { class: 'ph ph-columns text-xs' }),
         h('span', { text: 'Columns' }),
         h('span', { class: 'opacity-60 font-mono text-[10px]', text: `(${profile.colCount})` }));

      const tabPivot = h('button', {
        role: 'tab',
        type: 'button',
        class: 'tab gap-1.5 font-medium',
        onClick: () => setView('pivot'),
      }, h('i', { class: 'ph ph-square-split-horizontal text-xs' }),
         h('span', { text: 'Pivot' }));

      navGroup.append(tabData, tabCols, tabPivot);

      // View Switcher (aliases 'profile' -> 'columns' for compatibility)
      function setView(view) {
        if (view === 'profile') view = 'columns';
        activeView = view;

        tabData.classList.toggle('tab-active', view === 'data');
        tabCols.classList.toggle('tab-active', view === 'columns');
        tabPivot.classList.toggle('tab-active', view === 'pivot');

        dataStage.classList.toggle('hidden', view !== 'data');
        columnsStage.classList.toggle('hidden', view !== 'columns');
        pivotStage.classList.toggle('hidden', view !== 'pivot');

        renderHeaderActions();
        if (view === 'columns') renderColumnsView();
        else if (view === 'pivot') renderPivotView();
        else if (view === 'data' && tabulatorInstance) {
          requestAnimationFrame(() => tabulatorInstance.redraw(true));
        }
      }

      // ---- DATA VIEW (Tabulator) --------------------------------------------
      const tableTarget = h('div', { class: 'h-full w-full' });
      dataStage.append(tableTarget);

      let tabulatorInstance = null;
      let headerFiltersVisible = true;
      const emptyColNames = profile.columns.filter(c => c.type === 'empty').map(c => c.name);

      if (typeof Tabulator !== 'undefined') {
        try {
          const config = {
            data: rows,
            ...(columns ? {
              columns: columns.map(c => ({
                ...c, title: esc(c.title ?? c.field),
                headerFilter: 'input', headerFilterPlaceholder: 'Filter...',
              })),
              nestedFieldSeparator: false,
            } : {
              autoColumns: true,
              autoColumnsDefinitions: (defs) => defs.map(d => ({
                ...d, headerFilter: 'input', headerFilterPlaceholder: 'Filter...',
              })),
            }),
            ...(opts.filter?.col && opts.filter?.find ? {
              initialHeaderFilter: [{ field: String(opts.filter.col), value: String(opts.filter.find) }],
            } : {}),
            layout: 'fitData',
            height: '100%',
          };
          // The column and row menus (kits/row-menu.js) when a host loaded
          // them: the viewer's table mode does.
          tabulatorInstance = window.rowMenu?.grid
            ? window.rowMenu.grid(tableTarget, config, {
                noun: 'row', deck: { title: name },
                // One switch with two doors: this view's Options menu and
                // the column menu read and write the same setting.
                filters: { on: () => headerFiltersVisible, set: (on) => setHeaderFilters(on) },
              })
            : new Tabulator(tableTarget, config);
          tableTarget.__tabulator = tabulatorInstance;
          tableTarget.tabulator = tabulatorInstance;
        } catch (e) {
          tableTarget.innerHTML = `<div class="p-4 text-error font-mono text-xs">Error building table: ${esc(e.message)}</div>`;
        }
      }

      function toggleEmptyCols() {
        hideEmptyCols = !hideEmptyCols;
        if (tabulatorInstance) {
          for (const colName of emptyColNames) {
            const col = tabulatorInstance.getColumn(colName);
            if (col) {
              if (hideEmptyCols) col.hide();
              else col.show();
            }
          }
          tabulatorInstance.redraw(true);
        }
        renderHeaderActions();
      }

      // Hidden, never removed, as the column menu does it (kits/row-menu.js).
      function setHeaderFilters(on) {
        headerFiltersVisible = on;
        if (tabulatorInstance) {
          if (window.rowMenu?.showFilters) window.rowMenu.showFilters(tabulatorInstance, on);
          else {
            tableTarget.querySelectorAll('.tabulator-header-filter').forEach(el => { el.style.display = on ? '' : 'none'; });
            tabulatorInstance.redraw(true);
          }
        }
        renderHeaderActions();
      }

      function filterByColumnValue(colName, value) {
        if (!tabulatorInstance) return;
        setView('data');
        // The value lands in the header filter, so the row has to be showing:
        // a hidden one would narrow the grid with nothing saying why.
        if (!headerFiltersVisible) setHeaderFilters(true);
        tabulatorInstance.clearFilter(true);
        tabulatorInstance.setHeaderFilterValue(colName, value);
      }

      // ---- HEADER ACTIONS ---------------------------------------------------
      function renderHeaderActions() {
        actionGroup.replaceChildren();

        // 1. Icon-only Card button for browsing records as cards
        const btnRecords = h('button', {
          type: 'button',
          class: 'btn btn-xs btn-ghost btn-square text-base-content/80 hover:text-base-content',
          'data-title-tip': `Browse ${profile.rowCount.toLocaleString()} rows as cards`,
          'aria-label': `Browse ${profile.rowCount.toLocaleString()} rows as cards`,
          onClick: async () => {
            if (window.recordDeck && tabulatorInstance) {
              window.recordDeck.fromGrid(tabulatorInstance, { title: name });
            } else if (window.swipeDeck?.entry) {
              try {
                if (!window.recordDeck) await ViewRegistry?.loadLib?.('kits/record-deck.js');
                window.recordDeck?.fromGrid(tabulatorInstance, { title: name });
              } catch (e) { console.warn(e); }
            }
          },
        }, h('i', { class: 'ph ph-cards-three text-sm' }));
        actionGroup.append(btnRecords);

        // 2. Three-dot dropdown menu for secondary options
        const menuDetails = h('details', { class: 'dropdown dropdown-end', 'data-auto-close': '' });
        const menuSummary = h('summary', {
          class: 'btn btn-xs btn-ghost btn-square text-base-content/80 hover:text-base-content list-none cursor-pointer',
          'data-title-tip': 'Options',
          'aria-label': 'Options',
        }, h('i', { class: 'ph ph-dots-three-vertical text-sm' }));

        const menuList = h('ul', { class: 'dropdown-content z-30 menu p-1.5 shadow-lg bg-base-200 rounded-box w-52 text-xs border border-base-300 mt-1' });

        // Show or hide the header filters. Also in every column header's
        // right-click menu; this is the door a reader can see.
        menuList.append(h('li', {},
          h('a', {
            class: 'flex items-center gap-2',
            onClick: () => {
              menuDetails.removeAttribute('open');
              setHeaderFilters(!headerFiltersVisible);
            },
          },
            h('i', { class: `ph ${headerFiltersVisible ? 'ph-funnel-x' : 'ph-funnel'}` }),
            h('span', { text: headerFiltersVisible ? 'Hide header filters' : 'Show header filters' })
          )
        ));

        // Toggle empty columns (if empty columns exist)
        if (emptyColNames.length > 0) {
          const itemEmpty = h('li', {},
            h('a', {
              class: 'flex items-center justify-between',
              onClick: (e) => {
                menuDetails.removeAttribute('open');
                toggleEmptyCols();
              },
            },
              h('span', { class: 'flex items-center gap-2' },
                h('i', { class: `ph ${hideEmptyCols ? 'ph-eye' : 'ph-eye-slash'}` }),
                h('span', { text: hideEmptyCols ? 'Show empty columns' : 'Hide empty columns' })
              ),
              h('span', { class: 'badge badge-xs font-mono opacity-70', text: String(emptyColNames.length) })
            )
          );
          menuList.append(itemEmpty);
        }

        // Copy what the grid shows, the same item and words as the column
        // menu's Table section (kits/row-menu.js). Its count is read when
        // the menu opens, since the filters move it while the menu is shut.
        if (tabulatorInstance && window.rowMenu?.copyTableItem) {
          const copyLabel = h('span', { text: 'Copy rows' });
          const copyItem = h('li', {},
            h('a', {
              class: 'flex items-center gap-2',
              onClick: async () => {
                const it = window.rowMenu.copyTableItem(tabulatorInstance);
                if (!it) return;
                const said = await it.run();
                copyLabel.textContent = said;
                setTimeout(() => menuDetails.removeAttribute('open'), 700);
              },
            }, h('i', { class: 'ph ph-table' }), copyLabel)
          );
          menuDetails.addEventListener('toggle', () => {
            if (!menuDetails.open) return;
            const it = window.rowMenu.copyTableItem(tabulatorInstance);
            copyItem.classList.toggle('hidden', !it);
            if (it) copyLabel.textContent = it.label;
          });
          menuList.append(copyItem);
        }

        // Download CSV
        const itemDownload = h('li', {},
          h('a', {
            class: 'flex items-center gap-2',
            onClick: (e) => {
              menuDetails.removeAttribute('open');
              const fields = profile.columns.map(c => c.title);
              const values = rows.map(r => profile.columns.map(c => r[c.name] ?? ''));
              const csv = typeof Papa !== 'undefined'
                ? Papa.unparse({ fields, data: values })
                : [fields, ...values].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = name;
              a.click();
              URL.revokeObjectURL(url);
            },
          },
            h('i', { class: 'ph ph-download-simple' }),
            h('span', { text: 'Download CSV' })
          )
        );
        menuList.append(itemDownload);

        // Workbench handoff
        if (opts.onWorkbench) {
          const itemWb = h('li', {},
            h('a', {
              class: 'flex items-center gap-2',
              onClick: (e) => {
                menuDetails.removeAttribute('open');
                opts.onWorkbench(rows, name);
              },
            },
              h('i', { class: 'ph ph-wrench' }),
              h('span', { text: 'Open in Workbench' })
            )
          );
          menuList.append(itemWb);
        }

        menuDetails.append(menuSummary, menuList);
        actionGroup.append(menuDetails);
      }

      // ---- COLUMNS VIEW (Master-Detail Schema Matrix) ------------------------
      function renderColumnsView() {
        columnsStage.replaceChildren();

        // 1. Header: the file's figures on one line, then one row of pills per
        // control. A row never wraps; it scrolls sideways when its pills overflow.
        const topBar = h('div', { class: 'shrink-0 flex flex-col gap-1.5 px-3 py-2 border-b border-base-300 bg-base-100 text-xs' });

        const infoLine = h('div', { class: 'flex items-center gap-3' },
          h('div', { class: 'flex-1 min-w-0 font-mono text-base-content/70 truncate' },
            h('span', { class: 'font-semibold text-base-content', text: `${profile.rowCount.toLocaleString()} rows` }),
            h('span', { class: 'opacity-40 mx-1.5', text: '·' }),
            h('span', { text: `${profile.colCount} columns` }),
            profile.typeCounts.empty ? h('span', { class: 'text-warning/80 ml-1', text: `(${profile.typeCounts.empty} empty)` }) : null,
            h('span', { class: 'opacity-40 mx-1.5', text: '·' }),
            h('span', { text: `${fmtPct(profile.fillRate)} filled` })
          )
        );
        // A name search earns its place only on a wide file
        if (profile.colCount > 20) {
          infoLine.append(h('input', {
            type: 'search',
            placeholder: 'Column name',
            value: colSearch,
            class: 'input input-xs input-bordered w-28 sm:w-40 shrink-0 font-mono text-xs',
            onInput: (e) => { colSearch = e.target.value.toLowerCase(); updateSplitView(); },
          }));
        }
        topBar.append(infoLine);

        function pillRow(label, options, current, pick) {
          const pills = options.map(o => h('button', {
            type: 'button',
            class: 'btn btn-xs rounded-full shrink-0 gap-1 font-mono font-normal text-xs',
            onClick: () => { pick(o.value); paint(o.value); updateSplitView(); },
          },
            h('span', { text: o.text }),
            o.count == null ? null : h('span', { class: 'opacity-60', text: String(o.count) })
          ));
          const paint = (value) => pills.forEach((b, i) => {
            const on = options[i].value === value;
            b.classList.toggle('btn-primary', on);
            b.classList.toggle('btn-ghost', !on);
            b.classList.toggle('bg-base-200', !on);
          });
          paint(current);
          return h('div', { class: 'flex items-center gap-1.5 overflow-x-auto' },
            h('span', { class: 'shrink-0 w-12 text-base-content/50', text: label }),
            ...pills
          );
        }

        // Type: the types this file has, and only when it has more than one
        const TYPES = [['categorical', 'Categorical'], ['text', 'Text'], ['numeric', 'Numeric'], ['temporal', 'Date/Year'], ['empty', 'Empty']]
          .filter(([k]) => profile.typeCounts[k]);
        if (TYPES.length > 1) {
          topBar.append(pillRow('Type',
            [{ value: 'all', text: 'All', count: profile.colCount },
             ...TYPES.map(([k, text]) => ({ value: k, text, count: profile.typeCounts[k] }))],
            colTypeFilter, v => { colTypeFilter = v; }));
        }

        // Order: each pill sorts by the column it names; Filled puts the emptiest first
        topBar.append(pillRow('Order',
          [{ value: 'index', text: 'Original' }, { value: 'name', text: 'Name' },
           { value: 'missing', text: 'Filled' }, { value: 'cardinality', text: 'Distinct' }],
          colSort, v => { colSort = v; }));

        columnsStage.append(topBar);

        // 2. Master-Detail Split Pane Container
        const split = h('div', { class: 'flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden' });
        columnsStage.append(split);

        // Left Pane: Column Schema Table
        //
        // STACKED BELOW md, the list keeps its share. The inspector used to be
        // shrink-0 with the list taking what was left, so a numeric column's
        // inspector (figures and a histogram) took the whole height and the
        // list collapsed to nothing: a tap on a column seemed to leave the view
        // with no way back (Marcus's iPhone, 2026-10-24). The list now holds up
        // to 45% of the height and scrolls; the inspector scrolls in the rest.
        const listPane = h('div', { class: 'max-md:shrink-0 max-md:max-h-[45%] md:flex-1 min-h-0 overflow-y-auto bg-base-100 border-b md:border-b-0 md:border-r border-base-300' });
        // Right Pane: Active Column Inspector
        const detailPane = h('div', { class: 'max-md:flex-1 w-full md:w-80 lg:w-96 md:shrink-0 min-h-0 overflow-y-auto bg-base-200/40 p-3.5' });
        split.append(listPane, detailPane);

        function updateSplitView() {
          listPane.replaceChildren();

          let cols = profile.columns.slice();
          if (colTypeFilter !== 'all') cols = cols.filter(c => c.type === colTypeFilter);
          if (colSearch) cols = cols.filter(c => c.title.toLowerCase().includes(colSearch));

          if (colSort === 'name') cols.sort((a, b) => a.title.localeCompare(b.title));
          else if (colSort === 'missing') cols.sort((a, b) => a.fillRate - b.fillRate || a.index - b.index);
          else if (colSort === 'cardinality') cols.sort((a, b) => b.distinctCount - a.distinctCount || a.index - b.index);
          else cols.sort((a, b) => a.index - b.index);

          if (!cols.some(c => c.name === selectedColName)) {
            selectedColName = cols[0]?.name || null;
          }

          if (!cols.length) {
            listPane.append(h('div', { class: 'p-8 text-center text-xs text-base-content/40 italic' }, 'No columns match this filter.'));
            detailPane.replaceChildren(h('div', { class: 'p-6 text-center text-xs text-base-content/40 italic' }, 'No column selected.'));
            return;
          }

          // Dense Schema Table
          // Fixed layout: Summary takes what the other columns leave, so a long
          // value cannot widen the table past the pane.
          const tbl = h('table', { class: 'table table-xs table-pin-rows table-fixed w-full font-sans' });
          const thead = h('thead', {},
            h('tr', { class: 'bg-base-200 text-xs' },
              h('th', { class: 'hidden sm:table-cell w-8 text-base-content/40 font-mono text-[10px]' }, '#'),
              h('th', { class: 'w-28 sm:w-40' }, 'Column'),
              h('th', { class: 'hidden sm:table-cell w-32' }, 'Type'),
              h('th', { class: 'w-[4.5rem] sm:w-32' }, 'Filled'),
              h('th', { class: 'w-[4.5rem] sm:w-20 text-right' }, 'Distinct'),
              h('th', {}, 'Summary')
            )
          );
          tbl.append(thead);

          const tbody = h('tbody', {});
          for (const col of cols) {
            const isSelected = col.name === selectedColName;

            // Summary cell preview
            let summaryNode;
            if (col.type === 'empty') {
              summaryNode = h('span', { class: 'opacity-40 italic text-xs' }, '100% blank');
            } else if (col.type === 'numeric' && col.numStats) {
              summaryNode = h('span', { class: 'block truncate font-mono text-xs text-base-content/70' },
                `${fmtNum(col.numStats.min)} · Med ${fmtNum(col.numStats.median)} · ${fmtNum(col.numStats.max)} (Sum: ${fmtNum(col.numStats.sum)})`
              );
            } else if (col.topValues.length) {
              // One line of chips: a chip that does not fit wraps to a second line,
              // which the row's height hides, and the inspector lists every value
              // whole. A column of unique values counts 1 for each, so its counts
              // are left off.
              const unique = col.distinctCount === col.filled;
              const chips = col.topValues.slice(0, 3).map(tv =>
                h('span', { class: 'inline-flex min-w-0 max-w-full sm:max-w-[16rem] rounded border border-base-300 bg-base-200 px-1.5 font-mono' },
                  h('span', { class: 'truncate', text: tv.value }),
                  unique ? null : h('span', { class: 'shrink-0 text-base-content/50', text: `: ${tv.count}` })
                )
              );
              summaryNode = h('div', { class: 'flex flex-wrap gap-1 max-h-[1.125rem] overflow-hidden text-xs' }, ...chips);
            } else {
              summaryNode = h('span', { class: 'font-mono text-xs text-base-content/50' }, `${col.filled} values`);
            }

            const tr = h('tr', {
              class: `cursor-pointer transition-colors ${isSelected ? 'bg-primary/15 font-semibold text-primary' : 'hover:bg-base-200/50'}`,
              onClick: () => {
                selectedColName = col.name;
                updateSplitView();
              },
            },
              h('td', { class: 'hidden sm:table-cell font-mono text-[10px] opacity-50', text: String(col.index + 1) }),
              h('td', { class: 'font-mono text-xs font-semibold' },
                // Below sm the Type column is hidden and its icon rides here instead
                h('div', { class: 'flex items-center gap-1 min-w-0' },
                  h('i', { class: `ph ${col.icon} sm:hidden shrink-0 ${col.color}` }),
                  h('span', { class: 'truncate', 'data-title-tip-bare': '1', 'data-title-tip': col.title, text: col.title })
                )
              ),
              h('td', { class: 'hidden sm:table-cell' },
                h('span', { class: `badge badge-xs font-mono text-[10px] uppercase gap-1 ${col.color}` },
                  h('i', { class: `ph ${col.icon} text-[10px]` }),
                  h('span', { text: col.type })
                )
              ),
              h('td', {},
                h('div', { class: 'flex items-center gap-1.5 font-mono text-xs' },
                  h('div', { class: 'hidden sm:flex w-12 h-1.5 bg-base-300 rounded-full overflow-hidden shrink-0' },
                    h('div', { class: `h-full ${col.fillRate === 1 ? 'bg-success' : 'bg-primary'}`, style: `width: ${col.fillRate * 100}%` })
                  ),
                  h('span', { text: fmtPct(col.fillRate) }),
                  col.nulls > 0 ? h('span', { class: 'text-warning/80', text: `(${col.nulls})` }) : null
                )
              ),
              h('td', { class: 'text-right font-mono text-xs text-base-content/70', text: col.distinctCount.toLocaleString() }),
              h('td', { class: 'align-middle' }, summaryNode)
            );
            tbody.append(tr);
          }

          tbl.append(tbody);
          listPane.append(tbl);

          renderInspector(cols.find(c => c.name === selectedColName) || cols[0]);
        }

        // Right Inspector Panel
        function renderInspector(col) {
          detailPane.replaceChildren();
          if (!col) return;

          const panel = h('div', { class: 'flex flex-col gap-3 font-sans' });

          // Header
          const hd = h('div', { class: 'flex items-start justify-between gap-2 pb-2 border-b border-base-300' },
            h('div', { class: 'min-w-0 flex-1' },
              h('div', { class: 'text-[10px] font-mono text-base-content/40', text: `Column #${col.index + 1}` }),
              h('h3', { class: 'font-mono text-sm font-bold truncate text-base-content', 'data-title-tip-bare': '1', 'data-title-tip': col.title, text: col.title })
            ),
            h('span', { class: `badge badge-sm font-mono text-[10px] uppercase gap-1 shrink-0 ${col.color}` },
              h('i', { class: `ph ${col.icon}` }),
              h('span', { text: col.type })
            )
          );
          panel.append(hd);

          // Completeness / Quality summary
          const qBox = h('div', { class: 'p-2 rounded bg-base-100 border border-base-300 text-xs font-mono flex flex-col gap-1' },
            h('div', { class: 'flex justify-between text-[11px] text-base-content/70' },
              h('span', { text: `${col.filled.toLocaleString()} filled (${fmtPct(col.fillRate)})` }),
              h('span', { class: col.nulls > 0 ? 'text-warning' : 'text-success', text: col.nulls > 0 ? `${col.nulls.toLocaleString()} null` : '0 null' })
            ),
            h('div', { class: 'w-full h-1.5 bg-base-300 rounded-full overflow-hidden flex' },
              h('div', { class: `h-full ${col.fillRate === 1 ? 'bg-success' : 'bg-primary'}`, style: `width: ${col.fillRate * 100}%` })
            )
          );
          panel.append(qBox);

          // Numeric Deep Dive
          if (col.type === 'numeric' && col.numStats) {
            const st = col.numStats;

            // 5-number summary matrix
            const numGrid = h('div', { class: 'grid grid-cols-2 gap-1.5 text-xs font-mono p-2 rounded bg-base-100 border border-base-300' },
              h('div', {}, h('span', { class: 'text-base-content/50 block text-[10px]' }, 'Minimum'), h('span', { class: 'font-semibold', text: fmtNum(st.min) })),
              h('div', {}, h('span', { class: 'text-base-content/50 block text-[10px]' }, 'Maximum'), h('span', { class: 'font-semibold', text: fmtNum(st.max) })),
              h('div', {}, h('span', { class: 'text-base-content/50 block text-[10px]' }, 'Median'), h('span', { class: 'font-semibold', text: fmtNum(st.median) })),
              h('div', {}, h('span', { class: 'text-base-content/50 block text-[10px]' }, 'Mean'), h('span', { class: 'font-semibold', text: fmtNum(st.mean) })),
              h('div', {}, h('span', { class: 'text-base-content/50 block text-[10px]' }, 'Total Sum'), h('span', { class: 'font-semibold text-primary', text: fmtNum(st.sum) })),
              h('div', {}, h('span', { class: 'text-base-content/50 block text-[10px]' }, 'Zeros / Negatives'), h('span', { text: `${st.zeros} / ${st.negatives}` }))
            );
            panel.append(numGrid);

            // Distribution Histogram
            const histHeader = h('div', { class: 'text-[11px] font-mono text-base-content/70 mt-1' }, 'Distribution (10 bins):');
            panel.append(histHeader);

            const histWrap = h('div', { class: 'p-2 rounded bg-base-100 border border-base-300' });
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 200 48');
            svg.setAttribute('class', 'w-full h-12 block');

            const binW = 18;
            const gap = 2;
            st.bins.forEach((b, i) => {
              const hVal = Math.max(2, Math.round(b.pct * 40));
              const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              rect.setAttribute('x', String(i * (binW + gap)));
              rect.setAttribute('y', String(44 - hVal));
              rect.setAttribute('width', String(binW));
              rect.setAttribute('height', String(hVal));
              rect.setAttribute('rx', '1');
              rect.setAttribute('fill', 'currentColor');
              rect.setAttribute('class', b.count > 0 ? 'text-primary opacity-70 hover:opacity-100 transition-opacity cursor-pointer' : 'text-base-300 opacity-40');

              const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
              title.textContent = `${fmtNum(b.from)} to ${fmtNum(b.to)}: ${b.count} rows`;
              rect.append(title);
              svg.append(rect);
            });
            histWrap.append(svg);

            const histFoot = h('div', { class: 'flex justify-between text-[10px] font-mono text-base-content/50 mt-1' },
              h('span', { text: fmtNum(st.min) }),
              h('span', { text: fmtNum(st.max) })
            );
            histWrap.append(histFoot);
            panel.append(histWrap);
          }

          // Categorical & Temporal Frequency Table
          if (col.topValues && col.topValues.length && col.type !== 'empty') {
            const freqTitle = h('div', { class: 'flex items-center justify-between text-[11px] font-mono text-base-content/70 mt-1' },
              h('span', { text: `Values (${col.distinctCount.toLocaleString()} distinct):` }),
              h('span', { class: 'text-[10px] opacity-60', text: 'Tap to filter' })
            );
            panel.append(freqTitle);

            const valList = h('div', { class: 'rounded border border-base-300 bg-base-100 max-h-60 overflow-y-auto' });
            for (const tv of col.topValues) {
              const row = h('div', {
                class: 'px-2.5 py-1.5 flex items-start justify-between gap-2 text-xs hover:bg-base-200/60 cursor-pointer transition-colors border-b border-base-200 last:border-b-0',
                'data-title-tip-bare': '1', 'data-title-tip': `Filter Data view by ${col.title} = "${tv.value}"`,
                onClick: () => filterByColumnValue(col.name, tv.value),
              },
                h('span', { class: 'font-mono text-xs min-w-0 break-words line-clamp-2 text-base-content', text: tv.value }),
                h('div', { class: 'flex items-center gap-1.5 shrink-0 font-mono text-[11px] text-base-content/60' },
                  h('span', { text: tv.count.toLocaleString() }),
                  h('span', { class: 'opacity-50 text-[10px]', text: `(${fmtPct(tv.pct)})` }),
                  h('i', { class: 'ph ph-funnel-simple text-xs opacity-50 hover:opacity-100 hover:text-primary' })
                )
              );
              valList.append(row);
            }
            panel.append(valList);
          }

          if (col.type === 'empty') {
            const empMsg = h('div', { class: 'p-4 rounded border border-base-300 bg-base-100 text-xs text-base-content/60 italic text-center' },
              `All ${profile.rowCount.toLocaleString()} rows are empty or blank in this column.`
            );
            panel.append(empMsg);
          }

          detailPane.append(panel);
        }

        updateSplitView();
      }

      // Backward compatibility: alias renderProfileView to renderColumnsView
      const renderProfileView = renderColumnsView;

      // ---- PIVOT VIEW ---------------------------------------------------------
      //
      // TableStats.pivot computes it, the same engine as the workbench's Pivot,
      // so the two agree on what a number is, what a first look groups by and
      // what an unparseable measure does (it is skipped and counted, never a
      // zero). This draws the leaves under their groups, with a column axis
      // when one is chosen, and the grand total last.
      const P = () => window.TableStats.pivot;
      let pScan = null, pDim1 = '', pDim2 = '', pAcross = '', pMeasure = '', pAgg = 'sum';

      function renderPivotView() {
        pivotStage.replaceChildren();
        if (!pScan) {
          pScan = P().scan(rows);
          const d = P().defaults(pScan, rows);
          pDim1 = d.dims[0] || pScan.cols[0] || '';
          pMeasure = d.measure;
          pAgg = d.agg;
        }

        const cfgBar = h('div', { class: 'shrink-0 p-3 border-b border-base-300 bg-base-200/40 flex flex-wrap items-center gap-3 text-xs' });
        const selectOf = (label, currVal, options, onChange) => h('div', { class: 'flex items-center gap-1.5' },
          h('span', { class: 'font-semibold text-base-content/70', text: label }),
          h('select', {
            class: 'select select-xs select-bordered font-mono max-w-[14rem]',
            onChange: (e) => { onChange(e.target.value); renderPivotTable(); },
          }, ...options.map(opt => h('option', { value: opt.k, selected: opt.k === currVal, text: opt.l })))
        );
        const colOpts = profile.columns.filter(c => c.type !== 'empty').map(c => ({ k: c.name, l: c.title }));
        const none = (l) => [{ k: '', l }];
        const numOpts = pScan.cols.filter(c => pScan.isNum[c]).map(c => ({ k: c, l: columnTitle(c) }));
        cfgBar.append(...[
          selectOf('Rows:', pDim1, colOpts, (v) => { pDim1 = v; }),
          selectOf('then:', pDim2, [...none('(none)'), ...colOpts], (v) => { pDim2 = v; }),
          selectOf('Across:', pAcross, [...none('(none)'), ...colOpts], (v) => { pAcross = v; }),
          selectOf('Measure:', pMeasure, [...none('(count rows)'), ...numOpts], (v) => { pMeasure = v; if (!v) pAgg = 'count'; else if (pAgg === 'count') pAgg = 'sum'; renderPivotView(); }),
          pMeasure ? selectOf('Aggregate:', pAgg, [
            { k: 'sum', l: 'Sum' }, { k: 'avg', l: 'Average' }, { k: 'min', l: 'Minimum' }, { k: 'max', l: 'Maximum' },
          ], (v) => { pAgg = v; }) : null,
        ].filter(Boolean));
        const copyLabel = h('span', { text: 'Copy' });
        cfgBar.append(h('button', {
          type: 'button', class: 'btn btn-xs btn-ghost gap-1 ml-auto',
          onClick: async () => {
            const ok = await copyPivot();
            copyLabel.textContent = ok ? 'Copied' : 'Copy failed';
            setTimeout(() => { copyLabel.textContent = 'Copy'; }, 1200);
          },
        }, h('i', { class: 'ph ph-copy' }), copyLabel));
        pivotStage.append(cfgBar);

        const tblWrap = h('div', { class: 'flex-1 min-h-0 overflow-auto p-4' });
        pivotStage.append(tblWrap);

        let lastFlat = [], lastCfg = null;
        const cfgNow = () => {
          const dims = [pDim1, pDim2].filter((d, i, a) => d && a.indexOf(d) === i);
          const agg = pMeasure ? pAgg : 'count';
          return { rows: dims, cols: pAcross && !dims.includes(pAcross) ? [pAcross] : [], measure: pMeasure || null, agg, dec: P().decFor(pScan, pMeasure, agg) };
        };
        async function copyPivot() {
          if (!lastCfg) return false;
          const cols = [...lastCfg.rows.map(d => ({ field: d, title: columnTitle(d) })),
            { field: 'rows', title: 'rows' },
            ...Object.keys(lastFlat[0] || {}).filter(k => k !== 'level' && k !== 'rows' && !lastCfg.rows.includes(k)).map(k => ({ field: k, title: k }))];
          const clean = (v) => v == null ? '' : String(v).replace(/[\t\r\n]+/g, ' ');
          const text = [cols.map(c => clean(c.title)), ...lastFlat.map(r => cols.map(c => clean(r[c.field])))]
            .map(r => r.join('\t')).join('\n');
          try { if (window.io?.copy) return await window.io.copy(text); await navigator.clipboard.writeText(text); return true; }
          catch { return false; }
        }

        function renderPivotTable() {
          tblWrap.replaceChildren();
          const cfg = cfgNow();
          if (!cfg.rows.length) {
            tblWrap.append(h('div', { class: 'p-6 text-center text-xs text-base-content/40 italic' }, 'Choose a column for the rows.'));
            return;
          }
          const res = P().tree(rows, cfg);
          const flat = P().flat(res, cfg);
          lastFlat = flat; lastCfg = cfg;
          const keys = res.colKeys;
          const valueCol = keys.length ? 'total' : P().label(cfg);
          const counting = cfg.agg === 'count';
          const head = counting ? 'Rows' : `${cfg.agg.toUpperCase()} of ${columnTitle(cfg.measure)}`;
          const leaves = flat.filter(r => r.level === cfg.rows.length);
          const total = flat[0];
          const maxAbs = Math.max(1, ...leaves.map(r => Math.abs(r[valueCol] || 0)));

          const table = h('table', { class: 'table table-xs table-pin-rows w-full border border-base-300' });
          table.append(h('thead', {},
            h('tr', { class: 'bg-base-200 text-xs font-semibold' },
              ...cfg.rows.map(d => h('th', { text: columnTitle(d) })),
              // A count's value IS the row count, so the Rows column would say
              // it twice.
              counting ? null : h('th', { class: 'text-right', text: 'Rows' }),
              ...keys.map(k => h('th', { class: 'text-right font-mono', text: k })),
              h('th', { class: 'text-right min-w-[12rem]', text: keys.length ? `${head} (total)` : head })
            )
          ));
          const tbody = h('tbody', {});
          for (const r of leaves) {
            const v = r[valueCol];
            const pct = Math.min(100, Math.round((Math.abs(v) / maxAbs) * 100));
            tbody.append(h('tr', { class: 'hover:bg-base-200/50 transition-colors' },
              ...cfg.rows.map((d, i) => h('td', { class: i ? 'text-base-content/70' : 'font-medium', text: r[d] })),
              counting ? null : h('td', { class: 'text-right font-mono text-base-content/60', text: r.rows.toLocaleString() }),
              ...keys.map(k => h('td', { class: 'text-right font-mono tabular-nums', text: r[k] === '' ? '' : fmtNum(r[k]) })),
              h('td', { class: 'text-right font-mono tabular-nums relative p-0 overflow-hidden' },
                h('div', { class: 'absolute inset-y-0 right-0 bg-primary/15 rounded-l', style: `width: ${pct}%` }),
                h('span', { class: `relative px-3 py-1.5 block font-semibold ${v < 0 ? 'text-warning' : 'text-base-content'}`, text: fmtNum(v) })
              )
            ));
          }
          const note = res.skipped ? `${res.skipped.toLocaleString()} row${res.skipped === 1 ? '' : 's'} skipped: no number in ${columnTitle(cfg.measure)}` : `${leaves.length} groups`;
          table.append(tbody, h('tfoot', {},
            h('tr', { class: 'bg-base-200/80 font-bold border-t-2 border-base-300 text-xs' },
              h('td', { text: 'Grand Total' }),
              ...cfg.rows.slice(1).map((_, i) => h('td', { class: 'font-normal text-base-content/60', text: i === 0 ? note : '' })),
              counting ? null : h('td', { class: 'text-right font-mono', text: total.rows.toLocaleString() }),
              ...keys.map(k => h('td', { class: 'text-right font-mono', text: total[k] === '' ? '' : fmtNum(total[k]) })),
              h('td', { class: 'text-right font-mono text-primary px-3 py-1.5', text: fmtNum(total[valueCol]) })
            )
          ));
          tblWrap.append(table);
          if (cfg.rows.length === 1 && res.skipped) tblWrap.append(h('div', { class: 'pt-2 text-xs text-base-content/60', text: note }));
        }

        renderPivotTable();
      }

      // Initial render
      renderHeaderActions();

      return {
        table: tabulatorInstance,
        profile,
        setView,
        filterByColumnValue,
        toggleEmptyCols,
        destroy: () => {
          if (tabulatorInstance) {
            try { tabulatorInstance.destroy(); } catch (e) {}
            tabulatorInstance = null;
          }
          root.remove();
        },
      };
    },
  };

  window.TabularExplorer = TabularExplorer;
})();
