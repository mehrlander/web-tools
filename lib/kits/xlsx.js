// lib/kits/xlsx.js — OOXML (.xlsx) structural inspector: unzip, walk every
// XML/rels part, and surface the internal cross-references (shared strings,
// styles, sheet rels, comments, calc chain, defined names) plus reconstructed
// sheet data. Pulled from three dropped prototypes (home repo's chron/dump/,
// "Excel drop dive" being the most complete of the three) into one pure kit:
// no DOM rendering, no jQuery/Tabulator. analyze() takes already-extracted
// XML strings and is synchronous and part-order-independent — cross-file
// resolution (shared-string values, "which sheets does this file touch")
// happens in a finalize pass after every part is walked, which also fixes a
// real bug in the source prototypes: they resolved shared-string cell values
// inline during a concurrent, unordered zip read, so a sheet processed before
// sharedStrings.xml got empty string values. readZip() is the thin
// JSZip-backed convenience wrapper a page actually calls.
(() => {
  let jszipMod;
  const loadZip = async () => {
    if (typeof JSZip !== 'undefined') return JSZip;
    jszipMod ??= await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm').then(m => m.default);
    return jszipMod;
  };

  // Zero-based column index -> A1-style letters (0 -> 'A', 26 -> 'AA').
  const colLetter = (n) => {
    let s = '';
    for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
    return s;
  };

  // 'AA5' -> 26 (zero-based column index); ignores the row digits. -1 if unparsable.
  const colIndexFromRef = (ref) => {
    const m = /^([A-Z]+)/.exec(ref || '');
    if (!m) return -1;
    return [...m[1]].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
  };

  const directChildren = (node, name) => [...node.children].filter(c => c.nodeName === name);
  const directChild = (node, name) => directChildren(node, name)[0];

  const ALL_SHEETS = Symbol('all-sheets'); // placeholder resolved in finalize()

  // parts: [[path, xmlString], ...] or {path: xmlString}. Walk order doesn't
  // matter for correctness — see the module comment above.
  function analyze(parts) {
    const entries = Array.isArray(parts) ? parts : Object.entries(parts);

    const el = {};              // "file::path" -> { count, attr:{name:Set}, text:Set }
    const connectedFiles = new Set();
    const conns = {};            // file -> { sheets:Set|ALL_SHEETS, types:Set }
    const xl = {
      sheets: {},                // sheetN -> { usedStrings:Set, usedStyles:Set, cellCount, formulas, mergedCells, rawRows:Map<row,Map<col,{shared,raw}>> }
      strings: [],
      styles: new Set(),
      comments: {},
      relationships: {},
      definedNames: [],
      calcChain: [],
    };

    const touch = (fn, type, sheets) => {
      connectedFiles.add(fn);
      const c = (conns[fn] ??= { sheets: new Set(), types: new Set() });
      c.types.add(type);
      if (sheets === ALL_SHEETS) c.sheets = ALL_SHEETS;
      else if (c.sheets !== ALL_SHEETS) sheets?.forEach(s => c.sheets.add(s));
    };

    const sheetOf = (fn) => {
      const n = fn.match(/sheet(\d+)\.xml$/)?.[1];
      return n && `sheet${n}`;
    };

    function walkPart(fn, xmlString) {
      let root;
      try {
        const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
        root = doc.documentElement;
        if (!root || doc.getElementsByTagName('parsererror').length) return;
      } catch {
        return;
      }
      (function walk(node, path) {
        const key = `${fn}::${path}`;
        const rec = (el[key] ??= { count: 0, attr: {}, text: new Set() });
        rec.count++;
        for (const name of node.getAttributeNames?.() ?? [])
          (rec.attr[`@${name}`] ??= new Set()).add(node.getAttribute(name));
        if (!node.childElementCount) {
          const s = node.textContent?.trim();
          if (s) rec.text.add(s);
        }
        recordConnections(node, fn, path);
        for (const c of node.children) walk(c, `${path}.${c.nodeName}`);
      })(root, root.nodeName);
    }

    function recordConnections(node, fn, path) {
      if (fn === '[Content_Types].xml') touch(fn, 'content-types', ALL_SHEETS);

      if (fn.includes('.rels')) {
        if (fn.includes('workbook.xml.rels')) touch(fn, 'workbook-rels', ALL_SHEETS);
        else {
          const sn = fn.match(/sheet(\d+)\.xml\.rels/)?.[1];
          if (sn) touch(fn, 'sheet-rels', [`sheet${sn}`]);
          else touch(fn, 'relationships', ALL_SHEETS);
        }
      }

      if (fn.endsWith('workbook.xml')) touch(fn, 'workbook', ALL_SHEETS);

      const sheetName = sheetOf(fn);
      if (sheetName) {
        const sheet = (xl.sheets[sheetName] ??= {
          usedStrings: new Set(), usedStyles: new Set(),
          cellCount: 0, mergedCells: 0, formulas: 0, rawRows: new Map(),
        });
        touch(fn, 'sheet-data', [sheetName]);

        if (node.nodeName === 'row') {
          const rowNum = Number(node.getAttribute('r')) || (sheet.rawRows.size + 1);
          const cols = new Map();
          let nextIdx = 0;
          for (const c of directChildren(node, 'c')) {
            let idx = colIndexFromRef(c.getAttribute('r'));
            if (idx < 0) idx = nextIdx;
            nextIdx = idx + 1;
            const v = directChild(c, 'v');
            cols.set(idx, { shared: c.getAttribute('t') === 's', raw: v?.textContent ?? '' });
          }
          sheet.rawRows.set(rowNum, cols);
        }

        if (node.nodeName === 'c' && path.endsWith('sheetData.row.c')) {
          sheet.cellCount++;
          const s = node.getAttribute('s');
          if (s) { sheet.usedStyles.add(s); xl.styles.add(s); }
          if (node.getAttribute('t') === 's') {
            const i = directChild(node, 'v')?.textContent;
            if (i) sheet.usedStrings.add(Number(i));
          }
          if (directChild(node, 'f')) sheet.formulas++;
        }

        if (node.nodeName === 'mergeCell' && path.endsWith('mergeCells.mergeCell')) sheet.mergedCells++;
      }

      if (fn.includes('sharedStrings.xml')) {
        touch(fn, 'shared-strings'); // sheets resolved in finalize(), once every sheet is known
        if (path.endsWith('.si')) {
          const txt = directChild(node, 't')?.textContent;
          if (txt) xl.strings.push(txt);
        }
      }

      if (fn.includes('styles.xml')) touch(fn, 'styles', ALL_SHEETS);
      if (fn.includes('theme')) touch(fn, 'theme', ALL_SHEETS);

      if (fn.includes('comments')) {
        const n = fn.match(/comments(\d+)/)?.[1];
        touch(fn, 'comments', n ? [`sheet${n}`] : ALL_SHEETS);
        if (node.nodeName === 'comment') {
          const ref = node.getAttribute('ref');
          if (ref) (xl.comments[`sheet${n || '1'}`] ??= []).push(ref);
        }
      }

      if (fn.includes('calcChain.xml')) {
        touch(fn, 'calc-chain', ALL_SHEETS);
        if (node.nodeName === 'c') {
          const r = node.getAttribute('r');
          if (r) xl.calcChain.push({ cell: r, sheetIndex: node.getAttribute('i') || '0' });
        }
      }

      if (fn.includes('app.xml') || fn.includes('core.xml'))
        touch(fn, fn.includes('app.xml') ? 'app-properties' : 'core-properties', ALL_SHEETS);

      if (fn.endsWith('workbook.xml') && path.includes('definedNames.definedName')) {
        const name = node.getAttribute('name');
        if (name) xl.definedNames.push({
          name, sheetId: node.getAttribute('localSheetId') || 'global', reference: node.textContent,
        });
      }

      if (fn.includes('.rels') && node.nodeName === 'Relationship') {
        const target = node.getAttribute('Target'), type = node.getAttribute('Type');
        if (target && type) {
          const owner = fn.replace('/_rels/', '/').replace('.rels', '');
          (xl.relationships[owner] ??= []).push({ target, type: type.split('/').pop() });
        }
      }
    }

    for (const [fn, xmlString] of entries) walkPart(fn, xmlString);

    // ---- finalize: cross-file info that needs every part already walked ----
    const connectedPaths = new Set();
    for (const key of Object.keys(el)) {
      if (connectedFiles.has(key.split('::')[0])) connectedPaths.add(key);
    }

    const allSheetNames = Object.keys(xl.sheets).sort();
    for (const c of Object.values(conns)) {
      if (c.sheets === ALL_SHEETS) c.sheets = new Set(allSheetNames);
    }
    const sharedStringsFile = Object.keys(conns).find(fn => fn.includes('sharedStrings.xml'));
    if (sharedStringsFile) {
      const used = allSheetNames.filter(s => xl.sheets[s].usedStrings.size > 0);
      conns[sharedStringsFile].sheets = new Set(used.length ? used : allSheetNames);
    }

    // Resolve shared-string cell values now that xl.strings is complete, and
    // freeze each sheet's rows in row order.
    for (const sheet of Object.values(xl.sheets)) {
      sheet.rows = [...sheet.rawRows.entries()]
        .sort(([a], [b]) => a - b)
        .map(([row, cols]) => ({
          row,
          cells: Object.fromEntries([...cols.entries()].map(([idx, { shared, raw }]) =>
            [idx, shared ? (xl.strings[Number(raw)] ?? '') : raw])),
        }));
      delete sheet.rawRows;
    }

    return { el, connectedPaths, conns, xl };
  }

  // Reconstruct one sheet's rows (xl.sheets[name] from an analyze() result)
  // into row objects keyed by column letter: { Row, A, B, C, ... }. Sparse
  // rows/columns are honored (gaps left absent), not compacted.
  function sheetRows(sheet) {
    return (sheet.rows || []).map(({ row, cells }) => {
      const obj = { Row: row };
      for (const [idx, v] of Object.entries(cells)) obj[colLetter(Number(idx))] = v;
      return obj;
    });
  }

  // ---- views: pure table builders over an analyze() result -----------------

  function pathsView({ el, connectedPaths }) {
    return Object.entries(el).map(([path, data]) => {
      const [file, xmlPath] = path.split('::');
      const features = [
        ...Object.entries(data.attr).map(([a, vs]) => `${a} (${vs.size})`),
        ...(data.text.size ? [`#text (${data.text.size})`] : []),
      ];
      const connected = connectedPaths.has(path);
      return {
        File: file,
        Path: xmlPath,
        Features: features.join(', '),
        Count: data.count,
        Connected: connected ? 'Yes' : 'No',
        'Connection Type': connected ? file.split('/').pop().replace('.xml', '').replace('.rels', '') : '',
      };
    });
  }

  function connectionsView({ xl }) {
    return Object.keys(xl.sheets).sort().map(name => {
      const s = xl.sheets[name];
      const num = name.replace('sheet', '');
      // localSheetId / calc-chain's sheetIndex are workbook-order indices, which
      // can drift from the sheetN.xml file number after a sheet reorder or
      // rename — a limitation inherited from the source prototypes, none of
      // which cross-reference workbook.xml's <sheets> order.
      const namedRanges = xl.definedNames.filter(d =>
        d.sheetId === num || (d.sheetId === 'global' && d.reference?.includes(`${name}!`))).length;
      const calcChainCells = xl.calcChain.filter(c => c.sheetIndex === String(Number(num) - 1)).length;
      return {
        Sheet: name,
        Cells: s.cellCount,
        Strings: s.usedStrings.size,
        'String Ids': [...s.usedStrings].join(', '),
        Styles: s.usedStyles.size,
        Formulas: s.formulas,
        'Merged Cells': s.mergedCells,
        Comments: xl.comments[name]?.length || 0,
        'Named Ranges': namedRanges,
        'Calc Chain': calcChainCells,
      };
    });
  }

  function unconnectedView({ el, connectedPaths }) {
    const category = (file, path) =>
      path?.match(/(?:^|\.)(extLst|ext)(?:\.|$)/)?.[1] ||
      (file.match(/(?:^|\/)xl\/([^/]+)/)?.[1] || file.split('/')[0] || file).replace(/\.\w+$/, '');
    return Object.entries(el)
      .filter(([p]) => !connectedPaths.has(p))
      .map(([p, v]) => {
        const [file, path] = p.split('::');
        return {
          Category: category(file, path),
          File: file,
          Path: path,
          Count: v.count,
          Attributes: Object.keys(v.attr).length,
          'Has Text': v.text.size ? 'Yes' : 'No',
        };
      })
      .sort((a, b) => a.Category.localeCompare(b.Category) || b.Count - a.Count);
  }

  function filesView({ el, connectedPaths, conns }) {
    const byFile = {};
    for (const [key, data] of Object.entries(el)) {
      const fn = key.split('::')[0];
      const f = (byFile[fn] ??= { pathCount: 0, connected: 0, attrs: new Set(), hasText: false });
      f.pathCount++;
      if (connectedPaths.has(key)) f.connected++;
      for (const a of Object.keys(data.attr)) f.attrs.add(a);
      if (data.text.size) f.hasText = true;
    }
    return Object.entries(byFile).map(([fn, stats]) => {
      const info = conns[fn] || { sheets: new Set(), types: new Set() };
      const sheets = [...info.sheets].sort();
      const lower = fn.toLowerCase(); // case-insensitive: real part names are
                                      // mixed-case (sharedStrings.xml, calcChain.xml)
      const category =
        /sheet\d+\.xml$/.test(fn) ? 'Sheet Data' :
        fn === '[Content_Types].xml' ? 'Content Types' :
        /(app\.xml|core\.xml)/.test(fn) ? 'Properties' :
        ['Theme', 'Styles', 'Shared Strings', 'Workbook', 'Comments', 'Calc Chain']
          .find(k => lower.includes(k.replace(' ', '').toLowerCase())) ||
        (fn.includes('.rels') ? 'Relationships' : 'Other');
      return {
        File: fn,
        Category: category,
        Paths: stats.pathCount,
        Connected: stats.connected,
        'Sheets Touched': sheets.join(', '),
        Sheets: sheets.length,
        'Conn Types': [...info.types].join(', ') || 'None',
        'Attr Count': stats.attrs.size,
        Attrs: [...stats.attrs].filter(a => !a.startsWith('@xmlns')).map(a => a.replace(/^@/, '')).join(', '),
        'Has Text': stats.hasText ? 'Yes' : 'No',
      };
    }).sort((a, b) => a.Category.localeCompare(b.Category) || a.File.localeCompare(b.File));
  }

  function summary({ el, connectedPaths }) {
    const total = Object.keys(el).length, connected = connectedPaths.size;
    return { total, connected, unconnected: total - connected, connectedPct: total ? (connected / total) * 100 : 0 };
  }

  async function readZip(input) {
    const ZipLib = await loadZip();
    const zip = await ZipLib.loadAsync(input);
    const parts = await Promise.all(
      Object.entries(zip.files)
        .filter(([path, f]) => !f.dir && /\.(xml|rels)$/.test(path))
        .map(async ([path, f]) => [path, await f.async('string')])
    );
    return analyze(parts);
  }

  window.xlsxKit = {
    readZip,
    analyze,
    views: { paths: pathsView, connections: connectionsView, unconnected: unconnectedView, files: filesView },
    sheetRows,
    summary,
    colLetter,
  };
})();
