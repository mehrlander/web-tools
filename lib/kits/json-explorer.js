// lib/kits/json-explorer.js — Native, framework-free JSON Explorer & Schema Profiler.
//
// Provides interactive inspection, chunk filtering, schema analysis, and
// tabular projection for JSON data:
//   - Tree: collapsible, searchable, syntax-colored hierarchical browser with
//           breadcrumbs, zoom into chunks, auto-expanding search matches,
//           and per-node JSONPath / value copy affordances.
//   - Schema: structural profiling of keys, collections, field types, and fill rates.
//   - Table: instant tabular view when focused on arrays of records.
//   - Raw: formatted syntax-highlighted code view with copy/download.
//
// No external dependencies; copy delegates to kits/io.js when present.
//
// Usage:
//   window.JsonExplorer.mount(container, {
//     data,        // JS object/array or raw JSON string
//     name,        // optional file/subject name
//     fill,        // boolean: true to fill container height and scroll internally
//     mode,        // 'tree' | 'schema' | 'table' | 'raw' (default 'tree')
//     chunk,       // initial path array to focus, e.g. ['repos']
//   }) -> { destroy, setView, focusChunk, getProfile, ... }
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

  const esc = (s) => {
    const d = document.createElement('div');
    d.textContent = String(s ?? '');
    return d.innerHTML;
  };

  // The clipboard write is kits/io.js's (tools/test/clipboard-one-owner.test.mjs).
  // Fetched at load time so the write runs inside the tap that asked for it;
  // without io.js the modern API alone is the fallback.
  const ghRef = typeof gh !== 'undefined' ? gh : (window.gh || null);
  if (!window.io && ghRef) ghRef.load('kits/io.js').catch(() => {});
  const copyText = async (text) => {
    if (window.io && typeof window.io.copy === 'function') return window.io.copy(text);
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  };

  const fmtBytes = (n) => {
    if (n == null || isNaN(n)) return '';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  };

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
  const JsonExplorer = {
    mount(container, options = {}) {
      let rawData = options.data;
      if (typeof rawData === 'string') {
        try { rawData = JSON.parse(rawData); } catch (e) { /* keep as string if unparseable */ }
      }

      const name = options.name || 'document.json';
      const fill = options.fill !== false;
      const initialMode = options.mode || 'tree';

      let currentView = initialMode;
      let focusedPath = Array.isArray(options.chunk) ? [...options.chunk] : [];
      let searchQuery = '';
      let collapsedKeys = new Set();
      let searchMatches = new Set();
      let searchMatchedPaths = new Set();

      const profile = JsonProfile.analyze(rawData);

      // Root element with DaisyUI theme tokens
      const root = h('div', {
        class: 'json-explorer flex flex-col w-full bg-base-100 rounded-lg border border-base-300 '
          + (fill ? 'h-full min-h-0 grow overflow-hidden' : 'my-2'),
      });

      // Header Toolbar Container (aligned with TabularExplorer)
      const headerBar = h('div', { class: 'flex flex-col shrink-0 border-b border-base-300 bg-base-200/60 select-none' });
      // Main toolbar row
      const toolbar = h('div', { class: 'flex items-center justify-between gap-2 px-3 py-1.5 flex-wrap min-w-0' });
      // Breadcrumbs / navigation row
      const breadcrumbRow = h('div', { class: 'flex items-center gap-1.5 px-3 py-1 bg-base-200/40 text-xs border-t border-base-300/50 min-w-0 overflow-x-auto [scrollbar-width:none]' });

      headerBar.append(toolbar, breadcrumbRow);

      // Content Viewports
      const bodyContainer = h('div', {
        class: 'flex-1 min-h-0 overflow-y-auto overflow-x-auto p-3 text-xs font-mono relative',
      });

      root.append(headerBar, bodyContainer);
      container.replaceChildren(root);

      // ── Helper: Resolve Subtree / Focused Chunk ─────────────────────────
      const getChunkData = (path) => {
        let cur = rawData;
        for (const seg of path) {
          if (cur == null) return undefined;
          cur = cur[seg];
        }
        return cur;
      };

      const pathToString = (path) => path.join(' > ');
      const pathToProp = (path) => {
        if (!path.length) return 'root';
        return path.map((seg, i) => {
          if (typeof seg === 'number' || /^\d+$/.test(seg)) return `[${seg}]`;
          return i === 0 ? seg : `.${seg}`;
        }).join('');
      };

      // Check if current focused chunk is a record array
      const isChunkRecordArray = () => {
        const d = getChunkData(focusedPath);
        return Array.isArray(d) && d.length > 0 && typeof d[0] === 'object' && d[0] !== null;
      };

      // ── Search & Filter Logic ──────────────────────────────────────────
      const updateSearch = (query) => {
        searchQuery = (query || '').trim().toLowerCase();
        searchMatches.clear();
        searchMatchedPaths.clear();

        if (!searchQuery) {
          render();
          return;
        }

        const scan = (val, path) => {
          const pathKey = pathToProp(path);
          let match = false;

          const keyStr = String(path.at(-1) ?? '').toLowerCase();
          if (keyStr.includes(searchQuery)) match = true;

          if (val != null) {
            if (typeof val === 'string' && val.toLowerCase().includes(searchQuery)) match = true;
            else if (typeof val === 'number' && String(val).includes(searchQuery)) match = true;
            else if (typeof val === 'boolean' && String(val) === searchQuery) match = true;
          }

          if (match) {
            searchMatches.add(pathKey);
            // Uncollapse all parents along this path
            for (let i = 0; i <= path.length; i++) {
              searchMatchedPaths.add(pathToProp(path.slice(0, i)));
              collapsedKeys.delete(pathToProp(path.slice(0, i)));
            }
          }

          if (val && typeof val === 'object') {
            if (Array.isArray(val)) {
              for (let i = 0; i < val.length; i++) scan(val[i], [...path, i]);
            } else {
              for (const k in val) scan(val[k], [...path, k]);
            }
          }
        };

        scan(getChunkData(focusedPath), focusedPath);
        render();
      };

      // ── Tree View Renderer ─────────────────────────────────────────────
      const renderTree = () => {
        bodyContainer.replaceChildren();
        const chunkData = getChunkData(focusedPath);

        if (chunkData === undefined) {
          bodyContainer.append(h('div', { class: 'text-error p-4' }, `Path not found: ${pathToProp(focusedPath)}`));
          return;
        }

        const treeWrap = h('div', { class: 'space-y-1 select-text' });

        const renderNode = (key, val, path, depth = 0) => {
          const pathKey = pathToProp(path);
          const isArr = Array.isArray(val);
          const isObj = val && typeof val === 'object' && !isArr;
          const isCollapsible = isArr || isObj;
          const isMatched = searchMatches.has(pathKey);
          const isAncestorMatched = searchMatchedPaths.has(pathKey);

          // Node row
          const row = h('div', {
            class: 'group flex items-start gap-1 py-0.5 px-1.5 rounded hover:bg-base-200/50 transition-colors relative '
              + (isMatched ? 'bg-primary/10 border-l-2 border-primary' : ''),
            'data-path': pathKey,
          });

          // Indentation spacer
          if (depth > 0) {
            row.style.paddingLeft = `${depth * 1.25}rem`;
          }

          // Caret toggle for objects/arrays
          let caret = null;
          if (isCollapsible) {
            const isCollapsed = collapsedKeys.has(pathKey);
            caret = h('button', {
              type: 'button',
              class: 'btn btn-ghost btn-xs btn-square h-5 w-5 min-h-0 text-base-content/60 hover:text-base-content',
              onClick: (e) => {
                e.stopPropagation();
                if (collapsedKeys.has(pathKey)) collapsedKeys.delete(pathKey);
                else collapsedKeys.add(pathKey);
                render();
              },
            }, h('i', { class: `ph ${isCollapsed ? 'ph-caret-right' : 'ph-caret-down'} text-xs` }));
          } else {
            caret = h('span', { class: 'inline-block w-5' });
          }

          // Key label
          const keySpan = key !== null ? h('span', {
            class: 'font-semibold text-base-content/85 select-all mr-1 '
              + (isMatched ? 'text-primary font-bold' : ''),
            text: typeof key === 'number' ? `[${key}]` : key,
          }) : null;

          const colon = key !== null ? h('span', { class: 'opacity-40 mr-1.5' }, ':') : null;

          // Value representation
          const valHost = h('div', { class: 'inline-flex items-center gap-1.5 flex-wrap min-w-0' });

          if (val === null) {
            valHost.append(h('span', { class: 'text-base-content/40 italic' }, 'null'));
          } else if (typeof val === 'boolean') {
            valHost.append(h('span', { class: 'text-warning font-semibold' }, String(val)));
          } else if (typeof val === 'number') {
            valHost.append(h('span', { class: 'text-info font-mono tabular-nums' }, String(val)));
          } else if (typeof val === 'string') {
            const strVal = h('span', { class: 'text-success/90 break-all select-all' }, `"${val}"`);
            valHost.append(strVal);

            // ISO date chip if applicable
            const dateInfo = formatIsoDate(val);
            if (dateInfo) {
              valHost.append(h('span', {
                class: 'badge badge-ghost badge-xs font-sans opacity-70 cursor-help',
                title: dateInfo.full,
              }, dateInfo.rel));
            }

            // Clickable URL if applicable
            if (/^https?:\/\//i.test(val)) {
              valHost.append(h('a', {
                href: val,
                target: '_blank',
                rel: 'noopener',
                class: 'btn btn-ghost btn-xs btn-square h-4 w-4 p-0 text-primary',
                title: 'Open URL',
              }, h('i', { class: 'ph ph-arrow-square-out text-xs' })));
            }
          } else if (isArr) {
            const isCollapsed = collapsedKeys.has(pathKey);
            const count = val.length;
            const badge = h('span', {
              class: 'badge badge-sm badge-ghost font-mono cursor-pointer hover:badge-primary transition-colors',
              onClick: () => {
                if (collapsedKeys.has(pathKey)) collapsedKeys.delete(pathKey);
                else collapsedKeys.add(pathKey);
                render();
              },
            }, `Array[${count}]`);
            valHost.append(badge);

            // Quick shape preview when collapsed
            if (isCollapsed && count > 0 && typeof val[0] === 'object' && val[0] !== null) {
              const keys = Object.keys(val[0]).slice(0, 4).join(', ');
              valHost.append(h('span', { class: 'opacity-40 text-[11px] font-sans' }, `{ ${keys}${Object.keys(val[0]).length > 4 ? ', …' : ''} }`));
            }
          } else if (isObj) {
            const isCollapsed = collapsedKeys.has(pathKey);
            const keys = Object.keys(val);
            const badge = h('span', {
              class: 'badge badge-sm badge-ghost font-mono cursor-pointer hover:badge-primary transition-colors',
              onClick: () => {
                if (collapsedKeys.has(pathKey)) collapsedKeys.delete(pathKey);
                else collapsedKeys.add(pathKey);
                render();
              },
            }, `{ ${keys.length} keys }`);
            valHost.append(badge);

            if (isCollapsed && keys.length > 0) {
              const preview = keys.slice(0, 4).join(', ');
              valHost.append(h('span', { class: 'opacity-40 text-[11px] font-sans' }, `{ ${preview}${keys.length > 4 ? ', …' : ''} }`));
            }
          }

          // Node action buttons (visible on hover)
          const actions = h('div', {
            class: 'opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-auto shrink-0 bg-base-100/90 rounded px-1',
          });

          // Focus chunk button (for objects and arrays)
          if (isCollapsible && path.length > 0) {
            actions.append(h('button', {
              type: 'button',
              class: 'btn btn-ghost btn-xs btn-square h-5 w-5 text-base-content/60 hover:text-primary',
              title: `Focus on chunk: ${pathToProp(path)}`,
              onClick: () => focusChunk(path),
            }, h('i', { class: 'ph ph-crosshair text-xs' })));
          }

          // Copy Path button
          actions.append(h('button', {
            type: 'button',
            class: 'btn btn-ghost btn-xs btn-square h-5 w-5 text-base-content/60 hover:text-base-content',
            title: `Copy path: ${pathToProp(path)}`,
            onClick: async (e) => {
              const btn = e.currentTarget;
              await copyText(pathToProp(path));
              btn.innerHTML = '<i class="ph ph-check text-xs text-success"></i>';
              setTimeout(() => { btn.innerHTML = '<i class="ph ph-brackets-curly text-xs"></i>'; }, 1200);
            },
          }, h('i', { class: 'ph ph-brackets-curly text-xs' })));

          // Copy Value button
          actions.append(h('button', {
            type: 'button',
            class: 'btn btn-ghost btn-xs btn-square h-5 w-5 text-base-content/60 hover:text-base-content',
            title: 'Copy value',
            onClick: async (e) => {
              const btn = e.currentTarget;
              const text = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
              await copyText(text);
              btn.innerHTML = '<i class="ph ph-check text-xs text-success"></i>';
              setTimeout(() => { btn.innerHTML = '<i class="ph ph-copy text-xs"></i>'; }, 1200);
            },
          }, h('i', { class: 'ph ph-copy text-xs' })));

          row.append(caret, keySpan, colon, valHost, actions);
          treeWrap.append(row);

          // If collapsible and not collapsed, recursively render children
          if (isCollapsible && !collapsedKeys.has(pathKey)) {
            if (isArr) {
              for (let i = 0; i < val.length; i++) {
                renderNode(i, val[i], [...path, i], depth + 1);
              }
            } else {
              for (const k in val) {
                renderNode(k, val[k], [...path, k], depth + 1);
              }
            }
          }
        };

        renderNode(null, chunkData, focusedPath, 0);
        bodyContainer.append(treeWrap);
      };

      // ── Schema / Profile View Renderer ─────────────────────────────────
      const renderSchema = () => {
        bodyContainer.replaceChildren();

        const wrap = h('div', { class: 'space-y-4 font-sans text-xs select-text' });

        // Metric summary row
        const metrics = h('div', { class: 'grid grid-cols-2 sm:grid-cols-4 gap-2' },
          h('div', { class: 'p-3 bg-base-200/50 rounded-box border border-base-300' },
            h('div', { class: 'text-base-content/60 text-[11px] uppercase tracking-wider' }, 'Payload Size'),
            h('div', { class: 'font-mono text-base font-bold text-primary mt-1' }, fmtBytes(profile.byteSize))
          ),
          h('div', { class: 'p-3 bg-base-200/50 rounded-box border border-base-300' },
            h('div', { class: 'text-base-content/60 text-[11px] uppercase tracking-wider' }, 'Total Nodes'),
            h('div', { class: 'font-mono text-base font-bold mt-1' }, profile.nodeCount.toLocaleString())
          ),
          h('div', { class: 'p-3 bg-base-200/50 rounded-box border border-base-300' },
            h('div', { class: 'text-base-content/60 text-[11px] uppercase tracking-wider' }, 'Max Depth'),
            h('div', { class: 'font-mono text-base font-bold mt-1' }, String(profile.maxDepth))
          ),
          h('div', { class: 'p-3 bg-base-200/50 rounded-box border border-base-300' },
            h('div', { class: 'text-base-content/60 text-[11px] uppercase tracking-wider' }, 'Collections'),
            h('div', { class: 'font-mono text-base font-bold text-accent mt-1' }, String(profile.collections.length))
          )
        );

        // Top-Level Keys Table
        const topKeysCard = h('div', { class: 'bg-base-100 rounded-box border border-base-300 overflow-hidden' },
          h('div', { class: 'p-2.5 bg-base-200/60 font-semibold flex items-center justify-between border-b border-base-300' },
            h('span', {}, 'Top-Level Properties & Chunks'),
            h('span', { class: 'badge badge-sm badge-ghost' }, `${profile.rootEntries.length} keys`)
          )
        );

        const table = h('table', { class: 'table table-xs w-full' });
        const thead = h('thead', {},
          h('tr', { class: 'bg-base-200/40 text-base-content/60' },
            h('th', {}, 'Key'),
            h('th', {}, 'Type'),
            h('th', {}, 'Items / Size'),
            h('th', {}, 'Action')
          )
        );

        const tbody = h('tbody', {});
        for (const entry of profile.rootEntries) {
          const tr = h('tr', { class: 'hover:bg-base-200/30 transition-colors' },
            h('td', { class: 'font-mono font-semibold' }, entry.key),
            h('td', {}, h('span', { class: `badge badge-xs font-mono ${entry.type === 'array' ? 'badge-primary' : entry.type === 'object' ? 'badge-secondary' : 'badge-ghost'}` }, entry.type)),
            h('td', { class: 'font-mono' }, entry.count != null ? entry.count : '-'),
            h('td', {},
              entry.isCollection ? h('button', {
                type: 'button',
                class: 'btn btn-xs btn-ghost gap-1 text-primary',
                onClick: () => {
                  focusChunk([entry.key]);
                  setView('tree');
                },
              }, h('i', { class: 'ph ph-crosshair' }), 'Focus') : null
            )
          );
          tbody.append(tr);
        }
        table.append(thead, tbody);
        topKeysCard.append(table);

        // Record Array Collections Deep Schema Breakdown
        const recordArrays = profile.collections.filter(c => c.isRecordArray);
        const collectionsWrap = h('div', { class: 'space-y-3' });

        if (recordArrays.length > 0) {
          collectionsWrap.append(h('h3', { class: 'font-bold text-sm text-base-content/80 mt-4' }, 'Collection Schemas'));
          for (const coll of recordArrays) {
            const collCard = h('div', { class: 'rounded-box border border-base-300 overflow-hidden' },
              h('div', { class: 'p-2.5 bg-base-200/50 flex items-center justify-between border-b border-base-300' },
                h('div', { class: 'flex items-center gap-2' },
                  h('span', { class: 'font-mono font-bold' }, coll.key),
                  h('span', { class: 'badge badge-sm badge-ghost' }, `${coll.length} records`),
                  h('span', { class: 'badge badge-sm badge-outline' }, `${coll.columns.length} fields`)
                ),
                h('div', { class: 'flex items-center gap-1.5' },
                  h('button', {
                    type: 'button',
                    class: 'btn btn-xs btn-ghost gap-1 text-primary',
                    onClick: () => {
                      focusChunk([coll.key]);
                      setView('table');
                    },
                  }, h('i', { class: 'ph ph-table' }), 'View as Table'),
                  h('button', {
                    type: 'button',
                    class: 'btn btn-xs btn-ghost gap-1',
                    onClick: () => {
                      focusChunk([coll.key]);
                      setView('tree');
                    },
                  }, h('i', { class: 'ph ph-crosshair' }), 'Focus Tree')
                )
              )
            );

            const cTable = h('table', { class: 'table table-xs w-full' });
            cTable.append(
              h('thead', {},
                h('tr', { class: 'bg-base-200/30 text-base-content/60' },
                  h('th', {}, 'Field'),
                  h('th', {}, 'Inferred Type'),
                  h('th', {}, 'Fill Rate'),
                  h('th', {}, 'Sample Values')
                )
              )
            );

            const cTbody = h('tbody', {});
            for (const col of coll.columns) {
              const pct = Math.round(col.fillRate * 100);
              cTbody.append(
                h('tr', { class: 'hover:bg-base-200/20' },
                  h('td', { class: 'font-mono font-semibold' }, col.name),
                  h('td', { class: 'font-mono text-xs opacity-70' }, col.type),
                  h('td', { class: 'w-36' },
                    h('div', { class: 'flex items-center gap-2' },
                      h('div', { class: 'flex-1 h-1.5 bg-base-300 rounded-full overflow-hidden' },
                        h('div', { class: 'h-full bg-primary', style: `width: ${pct}%` })
                      ),
                      h('span', { class: 'font-mono text-[10px] opacity-60 w-8 text-right' }, `${pct}%`)
                    )
                  ),
                  h('td', { class: 'font-mono text-[11px] opacity-65 truncate max-w-xs' }, col.samples.join(', '))
                )
              );
            }
            cTable.append(cTbody);
            collCard.append(cTable);
            collectionsWrap.append(collCard);
          }
        }

        wrap.append(metrics, topKeysCard, collectionsWrap);
        bodyContainer.append(wrap);
      };

      // ── Table View Renderer ───────────────────────────────────────────
      const renderTable = () => {
        bodyContainer.replaceChildren();
        const data = getChunkData(focusedPath);

        if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== 'object') {
          bodyContainer.append(
            h('div', { class: 'p-6 text-center space-y-2' },
              h('i', { class: 'ph ph-table text-2xl opacity-40' }),
              h('div', { class: 'font-sans text-sm opacity-60' }, 'This chunk is not an array of objects.'),
              h('button', {
                type: 'button',
                class: 'btn btn-xs btn-outline',
                onClick: () => setView('tree'),
              }, 'Return to Tree View')
            )
          );
          return;
        }

        // Determine all columns
        const colSet = new Set();
        for (const r of data) {
          if (r && typeof r === 'object') for (const k in r) colSet.add(k);
        }
        const cols = [...colSet];

        let displayData = data;
        if (searchQuery) {
          displayData = data.filter(row => {
            if (!row || typeof row !== 'object') return false;
            return cols.some(col => String(row[col] ?? '').toLowerCase().includes(searchQuery));
          });
        }

        const tblWrap = h('div', { class: 'overflow-x-auto w-full border border-base-300 rounded-box font-sans text-xs' });
        const tbl = h('table', { class: 'table table-xs table-pin-rows table-pin-cols w-full' });

        const thead = h('thead', {},
          h('tr', { class: 'bg-base-200 text-base-content/80' },
            h('th', { class: 'w-10 text-center font-mono opacity-50' }, '#'),
            ...cols.map(c => h('th', { class: 'font-mono font-bold' }, c))
          )
        );

        const tbody = h('tbody', {});
        if (displayData.length === 0) {
          tbody.append(h('tr', {},
            h('td', { colspan: cols.length + 1, class: 'text-center py-6 opacity-50 font-sans' }, 'No records match the current filter.')
          ));
        } else {
          for (let i = 0; i < displayData.length; i++) {
            const row = displayData[i] || {};
            const tr = h('tr', { class: 'hover:bg-base-200/40 transition-colors' },
              h('td', { class: 'text-center font-mono opacity-40' }, String(i + 1)),
              ...cols.map(c => {
                const val = row[c];
                let display = '';
                let cls = 'font-mono';
                if (val === null) { display = 'null'; cls += ' opacity-40 italic'; }
                else if (typeof val === 'object') { display = JSON.stringify(val); cls += ' opacity-70'; }
                else if (typeof val === 'boolean') { display = String(val); cls += ' text-warning font-semibold'; }
                else if (typeof val === 'number') { display = String(val); cls += ' text-info'; }
                else { display = String(val); cls += ' text-base-content'; }
                return h('td', { class: `${cls} max-w-xs truncate`, title: String(val ?? '') }, display);
              })
            );
            tbody.append(tr);
          }
        }

        tbl.append(thead, tbody);
        tblWrap.append(tbl);
        bodyContainer.append(tblWrap);
      };

      // ── Raw View Renderer ─────────────────────────────────────────────
      const renderRaw = () => {
        bodyContainer.replaceChildren();
        const data = getChunkData(focusedPath);
        const text = JSON.stringify(data, null, 2);

        const rawWrap = h('div', { class: 'flex flex-col h-full space-y-2' });
        const pre = h('pre', {
          class: 'p-3 rounded-box bg-base-200/40 border border-base-300 font-mono text-[11.5px] leading-5 overflow-auto flex-1 select-text',
          text,
        });

        rawWrap.append(pre);
        bodyContainer.append(rawWrap);
      };

      // ── Master Render Function ────────────────────────────────────────
      const render = () => {
        renderToolbar();
        renderBreadcrumbs();
        if (currentView === 'tree') renderTree();
        else if (currentView === 'schema') renderSchema();
        else if (currentView === 'table') renderTable();
        else if (currentView === 'raw') renderRaw();
      };

      // ── Toolbar & Actions Rendering ───────────────────────────────────
      const renderToolbar = () => {
        toolbar.replaceChildren();

        // 1. View Switcher Tabs (aligned with TabularExplorer)
        const tabs = h('div', { role: 'tablist', class: 'tabs tabs-box tabs-xs shrink-0' });

        const mkTab = (v, label, icon) => {
          const active = currentView === v;
          const btn = h('button', {
            role: 'tab',
            type: 'button',
            class: `tab gap-1.5 font-medium ${active ? 'tab-active' : ''}`,
            onClick: () => setView(v),
          }, h('i', { class: `ph ${icon} text-xs` }), h('span', { text: label }));
          return btn;
        };

        tabs.append(mkTab('tree', 'Tree', 'ph-tree-structure'));
        tabs.append(mkTab('schema', 'Schema', 'ph-chart-pie-slice'));
        if (isChunkRecordArray()) {
          tabs.append(mkTab('table', 'Table', 'ph-table'));
        }
        tabs.append(mkTab('raw', 'Raw', 'ph-code'));

        // 2. Chunk Filter / Selector
        const chunkSelect = h('select', {
          class: 'select select-xs select-bordered font-mono text-xs max-w-[12rem]',
          onChange: (e) => {
            const val = e.target.value;
            if (!val) focusChunk([]);
            else focusChunk([val]);
          },
        });

        chunkSelect.append(h('option', { value: '' }, 'Entire Document (All)'));
        for (const entry of profile.rootEntries) {
          if (entry.isCollection) {
            const opt = h('option', {
              value: entry.key,
              text: `${entry.key} (${entry.count})`,
            });
            if (focusedPath[0] === entry.key && focusedPath.length === 1) opt.selected = true;
            chunkSelect.append(opt);
          }
        }

        // 3. Search input (for tree and table view)
        const searchBox = h('div', { class: 'relative flex-1 min-w-[8rem] max-w-xs' },
          h('i', { class: 'ph ph-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 text-xs' }),
          h('input', {
            type: 'search',
            value: searchQuery,
            placeholder: 'Filter keys, values, paths…',
            class: 'input input-xs input-bordered w-full pl-7 pr-12 font-mono text-xs',
            onInput: (e) => updateSearch(e.target.value),
          })
        );

        if (searchQuery) {
          if (searchMatches.size > 0) {
            searchBox.append(h('span', {
              class: 'badge badge-xs badge-primary absolute right-6 top-1/2 -translate-y-1/2 font-mono',
            }, String(searchMatches.size)));
          }
          searchBox.append(h('button', {
            type: 'button',
            class: 'btn btn-ghost btn-xs btn-circle h-4 w-4 min-h-0 absolute right-1.5 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100',
            onClick: () => updateSearch(''),
          }, '✕'));
        }

        // 4. Depth Controls (active in Tree view)
        let depthGroup = null;
        if (currentView === 'tree') {
          depthGroup = h('div', { class: 'flex items-center gap-0.5 shrink-0' },
            h('button', {
              type: 'button',
              class: 'btn btn-ghost btn-xs text-[10px] font-mono px-1.5',
              title: 'Collapse all collections',
              onClick: () => {
                collapsedKeys.clear();
                const walkColl = (val, path) => {
                  if (val && typeof val === 'object') {
                    collapsedKeys.add(pathToProp(path));
                    if (Array.isArray(val)) val.forEach((v, i) => walkColl(v, [...path, i]));
                    else for (const k in val) walkColl(val[k], [...path, k]);
                  }
                };
                walkColl(getChunkData(focusedPath), focusedPath);
                render();
              },
            }, 'Collapse'),
            h('button', {
              type: 'button',
              class: 'btn btn-ghost btn-xs text-[10px] font-mono px-1.5',
              title: 'Expand Depth 1 (show top-level keys)',
              onClick: () => {
                collapsedKeys.clear();
                const data = getChunkData(focusedPath);
                if (data && typeof data === 'object') {
                  for (const k in data) {
                    const sub = data[k];
                    if (sub && typeof sub === 'object') {
                      collapsedKeys.add(pathToProp([...focusedPath, k]));
                    }
                  }
                }
                render();
              },
            }, 'Depth 1'),
            h('button', {
              type: 'button',
              class: 'btn btn-ghost btn-xs text-[10px] font-mono px-1.5',
              title: 'Expand all nodes',
              onClick: () => {
                collapsedKeys.clear();
                render();
              },
            }, 'Expand')
          );
        }

        // 5. Action Buttons (Records Card, Copy & Download)
        const actions = h('div', { class: 'flex items-center gap-1 ml-auto shrink-0' });

        if (isChunkRecordArray()) {
          const chunkData = getChunkData(focusedPath);
          const count = Array.isArray(chunkData) ? chunkData.length : 0;
          const btnCards = h('button', {
            type: 'button',
            class: 'btn btn-xs btn-ghost btn-square text-base-content/80 hover:text-base-content',
            title: `Browse ${count.toLocaleString()} records as cards`,
            'aria-label': `Browse ${count.toLocaleString()} records as cards`,
            onClick: async () => {
              if (window.recordDeck) {
                window.recordDeck.open({ rows: chunkData, title: name + (focusedPath.length ? ` › ${pathToString(focusedPath)}` : '') });
              } else if (window.swipeDeck?.entry || window.gh?.load) {
                try {
                  if (!window.recordDeck && window.gh?.load) await window.gh.load('kits/record-deck.js');
                  window.recordDeck?.open?.({ rows: chunkData, title: name + (focusedPath.length ? ` › ${pathToString(focusedPath)}` : '') });
                } catch (e) { console.warn(e); }
              }
            },
          }, h('i', { class: 'ph ph-cards-three text-sm' }));
          actions.append(btnCards);
        }

        const btnCopy = h('button', {
          type: 'button',
          class: 'btn btn-ghost btn-xs gap-1 font-mono text-[10px] text-base-content/80 hover:text-base-content',
          title: 'Copy current chunk JSON',
          onClick: async (e) => {
            const btn = e.currentTarget;
            const text = JSON.stringify(getChunkData(focusedPath), null, 2);
            await copyText(text);
            btn.innerHTML = '<i class="ph ph-check text-xs text-success"></i> Copied';
            setTimeout(() => { btn.innerHTML = '<i class="ph ph-copy text-xs"></i> Copy'; }, 1300);
          },
        }, h('i', { class: 'ph ph-copy text-xs' }), 'Copy');

        const btnDownload = h('button', {
          type: 'button',
          class: 'btn btn-ghost btn-xs btn-square h-6 w-6 min-h-0 text-base-content/80 hover:text-base-content',
          title: `Download ${name}`,
          onClick: () => {
            const text = JSON.stringify(rawData, null, 2);
            const blob = new Blob([text], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            URL.revokeObjectURL(url);
          },
        }, h('i', { class: 'ph ph-download-simple text-xs' }));

        actions.append(btnCopy, btnDownload);

        toolbar.append(tabs, chunkSelect, searchBox);
        if (depthGroup) toolbar.append(depthGroup);
        toolbar.append(actions);
      };

      // ── Breadcrumbs Rendering ─────────────────────────────────────────
      const renderBreadcrumbs = () => {
        breadcrumbRow.replaceChildren();

        breadcrumbRow.append(h('i', { class: 'ph ph-folder-open opacity-40 text-xs shrink-0' }));

        const rootCrumb = h('button', {
          type: 'button',
          'data-crumb': '',
          class: `hover:text-primary transition-colors font-mono ${focusedPath.length === 0 ? 'font-bold text-primary' : 'opacity-60'}`,
          onClick: () => focusChunk([]),
        }, 'root');
        breadcrumbRow.append(rootCrumb);

        for (let i = 0; i < focusedPath.length; i++) {
          breadcrumbRow.append(h('span', { class: 'opacity-30' }, '/'));
          const subPath = focusedPath.slice(0, i + 1);
          const isLast = i === focusedPath.length - 1;
          const crumb = h('button', {
            type: 'button',
            'data-crumb': '',
            class: `hover:text-primary transition-colors font-mono ${isLast ? 'font-bold text-primary' : 'opacity-60'}`,
            onClick: () => focusChunk(subPath),
          }, String(focusedPath[i]));
          breadcrumbRow.append(crumb);
        }

        if (focusedPath.length > 0) {
          const upBtn = h('button', {
            type: 'button',
            class: 'btn btn-ghost btn-xs h-5 px-1.5 min-h-0 ml-auto gap-1 text-[10px] font-sans opacity-70 hover:opacity-100',
            onClick: () => focusChunk(focusedPath.slice(0, -1)),
          }, h('i', { class: 'ph ph-arrow-bend-up-left' }), 'Up');
          breadcrumbRow.append(upBtn);
        }
      };

      // ── Public Navigation Methods ─────────────────────────────────────
      const setView = (v) => {
        currentView = v;
        render();
      };

      const focusChunk = (path) => {
        focusedPath = Array.isArray(path) ? path : [];
        render();
      };

      // Initial collapsed state: collapse depth 1 collections by default so root is scannable
      if (rawData && typeof rawData === 'object') {
        for (const k in rawData) {
          if (rawData[k] && typeof rawData[k] === 'object') {
            collapsedKeys.add(pathToProp([k]));
          }
        }
      }

      // Initial render
      render();

      return {
        profile,
        setView,
        focusChunk,
        updateSearch,
        destroy: () => {
          root.remove();
        },
      };
    },
  };

  window.JsonProfile = JsonProfile;
  window.JsonExplorer = JsonExplorer;
})();
