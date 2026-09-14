// lib/kits/xlsx-write.js — build a new workbook holding a chosen subset of
// another workbook's sheets. The companion to kits/xlsx.js, which reads a
// package and never writes one.
//
// REPRODUCTION, NOT SUBTRACTION. The other way to do this is to edit the
// package in place: delete the parts a dropped sheet owns, then patch
// workbook.xml, [Content_Types].xml and the rels around the hole. That is
// more faithful, because everything not touched survives byte-intact. It was
// deliberately not chosen. This kit loads the source into a writer library,
// drops the sheets, and lets the writer re-emit every part, so what survives
// is what the writer models. Loss is expected; the manifest is where it is
// declared rather than discovered.
//
// WHY ExcelJS AND NOT SheetJS, measured 2026-09-14 rather than assumed.
// Round-tripping three of the OFM budget forms (a macro workbook with 2,795
// formulas, a 218-merge form with an image, and the TECM pivot template)
// through each library and re-reading the output with kits/xlsx.js:
//
//   cells kept      ExcelJS 17144/17148, 1640/1642, 458/502
//                   SheetJS 13872/17148,  327/1642,   52/502
//   cellXfs kept    ExcelJS 49/56, 287/305, 29/34
//                   SheetJS  3/56,   7/305,  1/34
//   conditional formats, data validations
//                   ExcelJS all
//                   SheetJS none
//
// SheetJS's community build does not write cell styles, and it drops the
// empty-but-formatted cells a blank form is largely made of. On the TECM
// template that is 90% of the cells. The size argument that favoured it does
// not survive contact either: its output was 2.0 MB from a 56 KB source,
// because it emits 32,768 column definitions. ExcelJS is ~938 KB over
// jsDelivr against SheetJS's 882 KB, which is the wrong 56 KB to save.
//
// SheetJS still earns a place, as the INDEPENDENT READER in the check suite
// (tools/test/xlsx-write.test.mjs): a defect both the producer and
// kits/xlsx.js share is invisible to a check that only uses those two.
//
// THE GRAFT is what makes the sheet picker's checkbox list real. A writer
// models no VBA, no pivot cache, no customXml and no workbook connections, so
// offering them as options with only a writer behind them would be offering
// inert checkboxes. After the writer emits the base package, the source's own
// bytes for those parts are copied in with JSZip, along with the source's own
// content-type and relationship ENTRIES, copied verbatim rather than
// reconstructed from a hardcoded table of type URIs. A graft that does not
// take is reported and skipped; the workbook still opens.
(() => {
  // Both loaders copy kits/xlsx.js's spelling exactly, and the spelling is
  // load-bearing rather than stylistic: tools/test/bootstrap.mjs rewrites
  // `import('<url>')` to pull the vendored copy, but it first MASKS the
  // sequence `await(await import(` so that kits/compression.js's user-facing
  // template literal survives byte-intact. A kit written that way is never
  // rewritten and every test of it reaches the live CDN, which Node refuses.
  let jszipMod;
  const loadZip = async () => {
    if (typeof JSZip !== 'undefined') return JSZip;
    jszipMod ??= await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm').then(m => m.default);
    return jszipMod;
  };
  // ExcelJS ships one browser bundle in two wrappers and the loader has to
  // accept both. jsDelivr's `/+esm` is that bundle rolled into a module, whose
  // namespace carries the constructor; a plain UMD copy (a page that loaded it
  // through a <script>, or a harness that serves dist/exceljs.min.js for the
  // same URL) exports nothing and assigns `window.ExcelJS` as a side effect.
  // So the resolution is by CAPABILITY rather than by shape: take whichever of
  // the global, the namespace's default, or the namespace itself actually has
  // a Workbook.
  //
  // Worth recording what this replaced. The first browser run failed with
  // `process is not defined`, and the obvious reading was that the CDN bundle
  // needs a process shim; a shim was written and it moved the error rather
  // than removing it. Neither bundle contains a single unguarded `process`
  // reference. What served the page was exceljs's NODE entry, because
  // tools/render/cdn.mjs resolved a /+esm request through package.json main
  // and exceljs declares no module field. The fix belonged there, and the shim
  // would have shipped a fake `process` global to every page that opened a
  // workbook, in order to satisfy a library that never asked for one.
  let writerMod;
  const hasWorkbook = (m) => m && typeof m.Workbook === 'function';
  const loadWriter = async () => {
    if (hasWorkbook(window.ExcelJS)) return window.ExcelJS;
    writerMod ??= await import('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/+esm');
    for (const c of [writerMod.default, writerMod, window.ExcelJS]) if (hasWorkbook(c)) return c;
    throw new Error('xlsx-write: ExcelJS loaded but exposes no Workbook constructor.');
  };

  // ---------------------------------------------------------------- paths

  // OPC part paths are package-absolute with no leading slash. A relationship
  // target is relative to the FOLDER of the part that declares it, which is
  // why '../comments1.xml' out of xl/worksheets/sheet1.xml is xl/comments1.xml
  // and not xl/worksheets/comments1.xml. External targets (http:, mailto:,
  // file:) resolve to null and are not package parts.
  const resolveTarget = (fromPart, target) => {
    const t = String(target || '');
    if (!t || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t)) return null;
    if (t.startsWith('/')) return t.slice(1);
    const out = fromPart.split('/').slice(0, -1);
    for (const seg of t.split('/')) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') out.pop(); else out.push(seg);
    }
    return out.join('/');
  };

  const relsPathFor = (part) => {
    const i = part.lastIndexOf('/');
    return i < 0 ? `_rels/${part}.rels` : `${part.slice(0, i)}/_rels/${part.slice(i + 1)}.rels`;
  };

  const extOf = (p) => (p.split('.').pop() || '').toLowerCase();

  // ------------------------------------------------------ dependency map

  // Every part reachable from `part` by following relationships, transitively.
  // This is the map the task hangs on: a sheet's drawing, its VML comment
  // boxes, its printer settings and its pivot table are reachable from that
  // sheet's rels and from nothing else, so the closure says exactly what
  // travels with it. kits/xlsx.js's `conns` view is coarser and calls
  // drawing1.xml workbook-wide.
  function closure(rels, part, stop = new Set()) {
    const seen = new Set();
    const walk = (p) => {
      if (seen.has(p) || stop.has(p)) return;
      seen.add(p);
      for (const r of rels[p] || []) {
        const t = resolveTarget(p, r.target);
        if (t) walk(t);
      }
    };
    walk(part);
    return seen;
  }

  const sheetPartOf = (key) => `xl/worksheets/${key}.xml`;

  // Which sheets own which parts, and which parts no single sheet owns.
  // A part reachable from two kept sheets belongs to both; a part reachable
  // from a dropped sheet AND a kept one is not a dropped part.
  function ownership(xl) {
    const rels = xl.relationships || {};
    const keys = Object.keys(xl.sheets || {});
    const bySheet = {};
    const owners = new Map();
    for (const k of keys) {
      const parts = closure(rels, sheetPartOf(k));
      parts.delete(sheetPartOf(k));
      bySheet[k] = [...parts];
      for (const p of [...parts, sheetPartOf(k)]) {
        if (!owners.has(p)) owners.set(p, new Set());
        owners.get(p).add(k);
      }
    }
    // Workbook scope: reachable from the package root without going through
    // any worksheet part.
    const sheetParts = new Set(keys.map(sheetPartOf));
    const workbook = closure(rels, 'xl/workbook.xml', sheetParts);
    workbook.delete('xl/workbook.xml');
    return { bySheet, owners, workbook: [...workbook] };
  }

  // --------------------------------------------------------------- plan

  // What keeping `keep` implies, entirely from what kits/xlsx.js read plus the
  // zip's own part list (binary parts like vbaProject.bin are not XML, so the
  // reader never sees them and they arrive here as names).
  //
  // `keep` is a list of sheet DISPLAY names, because that is what the reader
  // ticks. Workbook order, not part-file order, decides the output order:
  // xl.sheets[k].index is the workbook position.
  function plan(read, partNames, keep) {
    const xl = read.xl;
    const keys = Object.keys(xl.sheets)
      .sort((a, b) => (xl.sheets[a].index ?? 0) - (xl.sheets[b].index ?? 0));
    const keepSet = new Set(keep ?? keys.map(k => xl.sheets[k].name));
    const own = ownership(xl);

    const sheets = keys.map((k) => {
      const s = xl.sheets[k];
      return {
        key: k, name: s.name, index: s.index, sheetId: s.sheetId,
        visibility: s.visibility || 'visible',
        cells: s.cellCount || 0, formulas: s.formulas || 0,
        part: sheetPartOf(k), parts: own.bySheet[k] || [],
        kept: keepSet.has(s.name),
      };
    });
    const kept = sheets.filter(s => s.kept);
    const dropped = sheets.filter(s => !s.kept);
    const keptKeys = new Set(kept.map(s => s.key));

    // Parts no kept sheet reaches and the workbook scope does not hold.
    const goes = [...own.owners.entries()]
      .filter(([, o]) => ![...o].some(k => keptKeys.has(k)))
      .map(([p]) => p)
      .filter(p => !own.workbook.includes(p));

    // THE PIVOT TRAP. A pivot's cache is built from a range on some sheet,
    // and that sheet need not be the one the pivot sits on: in the TECM
    // template the pivot is on HeadCountCheck and its cache reads
    // HeadCounts&CostPerCredit. Keeping the pivot's own sheet is therefore not
    // enough to keep the pivot meaningful.
    const pivots = Object.entries(xl.pivotTables || {}).map(([part, p]) => {
      const hostKey = p.sheet;
      const cache = xl.pivotCaches?.[p.cachePart];
      const sourceName = cache?.source?.sheet || null;
      const sourceKept = sourceName == null ? null : keepSet.has(sourceName);
      return {
        part, name: p.name, ref: p.ref, cachePart: p.cachePart,
        host: xl.sheets[hostKey]?.name ?? hostKey, hostKept: keptKeys.has(hostKey),
        source: sourceName, sourceKept,
        recordsPart: cache?.recordsPart || null,
        orphaned: keptKeys.has(hostKey) && sourceKept === false,
      };
    });

    // Defined names whose reference names a dropped sheet. ExcelJS writes
    // every name workbook-global and drops the localSheetId, so the
    // zero-based-index trap cannot fire here; a name pointing at a sheet that
    // is gone is a #REF! either way, so it is reported and left to the writer.
    const definedNames = (xl.definedNames || []).map((d) => {
      const hit = dropped.find(s => {
        const n = s.name;
        return d.reference?.includes(`'${n}'!`) || d.reference?.includes(`${n}!`);
      });
      return { ...d, danglesOn: hit ? hit.name : null };
    });

    return {
      sheets, kept, dropped, keepSet,
      partsLeaving: goes,
      workbookParts: own.workbook,
      pivots, definedNames,
      partNames: partNames.slice(),
      grafts: GRAFTS.map(g => ({ id: g.id, label: g.label, ...g.detect({ xl, partNames, plan: { keepSet, pivots } }) })),
    };
  }

  // -------------------------------------------------------------- grafts

  // Each graft names the parts it carries and how the package should point at
  // them. `parts` are copied byte-for-byte; `linkFrom` is the part whose rels
  // gain an entry; `bodyPatch` is the one case (a pivot cache) where a
  // relationship alone is not the link.
  const GRAFTS = [
    {
      id: 'vba',
      label: 'VBA project',
      detect: ({ partNames }) => {
        const main = partNames.filter(p => /^xl\/vbaProject\.bin$/.test(p));
        if (!main.length) return { available: false, parts: [] };
        const sigs = partNames.filter(p => /^xl\/vbaProjectSignature.*\.bin$/.test(p));
        return {
          available: true,
          parts: [...main, ...sigs, ...partNames.filter(p => p === 'xl/_rels/vbaProject.bin.rels')],
          detail: sigs.length ? `${main.length} project + ${sigs.length} signature part${sigs.length === 1 ? '' : 's'}`
                              : 'unsigned project',
          macroEnabled: true,
        };
      },
      linkFrom: 'xl/workbook.xml',
    },
    {
      id: 'customxml',
      label: 'customXml items',
      detect: ({ partNames, xl }) => {
        const items = partNames.filter(p => /^customXml\/item\d*\.xml$/i.test(p));
        if (!items.length) return { available: false, parts: [] };
        const props = partNames.filter(p => /^customXml\/itemProps\d*\.xml$/i.test(p));
        const relFiles = partNames.filter(p => /^customXml\/_rels\//i.test(p));
        return {
          available: true,
          parts: [...items, ...props, ...relFiles],
          detail: `${items.length} item${items.length === 1 ? '' : 's'}`
                + (props.length ? ` + ${props.length} itemProps` : '')
                + (xl.powerQuery ? `, one carrying Power Query (${xl.powerQuery.sections?.length || 0} M section${xl.powerQuery.sections?.length === 1 ? '' : 's'})` : ''),
        };
      },
      linkFrom: 'xl/workbook.xml',
    },
    {
      id: 'connections',
      label: 'Workbook connections',
      detect: ({ partNames, xl }) => {
        if (!partNames.includes('xl/connections.xml')) return { available: false, parts: [] };
        return {
          available: true,
          parts: ['xl/connections.xml'],
          detail: `${(xl.connections || []).length} connection${(xl.connections || []).length === 1 ? '' : 's'}`,
        };
      },
      linkFrom: 'xl/workbook.xml',
    },
    {
      id: 'pivots',
      label: 'Pivot tables and caches',
      detect: ({ partNames, plan }) => {
        const live = (plan.pivots || []).filter(p => p.hostKept && p.sourceKept !== false);
        const blocked = (plan.pivots || []).filter(p => p.hostKept && p.sourceKept === false);
        if (!plan.pivots?.length) return { available: false, parts: [] };
        const parts = [];
        for (const p of live) {
          parts.push(p.part, p.cachePart);
          if (p.recordsPart) parts.push(p.recordsPart);
          const r = relsPathFor(p.part);
          if (partNames.includes(r)) parts.push(r);
          const cr = relsPathFor(p.cachePart);
          if (partNames.includes(cr)) parts.push(cr);
        }
        return {
          available: live.length > 0,
          parts,
          pivots: live,
          detail: live.length
            ? `${live.length} pivot${live.length === 1 ? '' : 's'} with ${new Set(live.map(p => p.cachePart)).size} cache${new Set(live.map(p => p.cachePart)).size === 1 ? '' : 's'}`
            : null,
          blocked: blocked.map(p => `${p.name}: cache reads ${p.source}, which is not kept`),
        };
      },
      linkFrom: 'xl/workbook.xml',
      sheetScoped: true,
    },
  ];

  // ------------------------------------------------------------- rebuild

  // Splice a child element in before a container's closing tag. Crude on
  // purpose: [Content_Types].xml and every .rels file are machine-written with
  // a fixed shape, and a DOM round trip through XMLSerializer is where
  // namespace prefixes get rewritten. If the closing tag is missing the splice
  // REFUSES rather than appending to a malformed file, which is what turns a
  // failed graft into a skipped one.
  const spliceBefore = (xml, closeTag, insert) => {
    const i = xml.lastIndexOf(closeTag);
    if (i < 0) return null;
    return xml.slice(0, i) + insert + xml.slice(i);
  };

  const relEntries = (xml) => [...String(xml).matchAll(/<Relationship\b[^>]*\/>|<Relationship\b[^>]*>[\s\S]*?<\/Relationship>/g)].map(m => m[0]);
  const attrOf = (el, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(el)?.[1] ?? null;

  const freshRelId = (xml) => {
    let n = 0;
    for (const m of String(xml).matchAll(/\bId="rId(\d+)"/g)) n = Math.max(n, Number(m[1]));
    return `rId${n + 1}`;
  };

  const EMPTY_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

  const MACRO_MAIN = 'application/vnd.ms-excel.sheet.macroEnabled.main+xml';
  const SHEET_MAIN = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';

  async function rebuild(input, keep, opts = {}) {
    const kit = window.xlsxKit;
    if (!kit) throw new Error('xlsx-write: kits/xlsx.js must be loaded first (it is the reader).');

    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
    const ZipLib = await loadZip();
    const srcZip = await ZipLib.loadAsync(bytes);
    const partNames = Object.keys(srcZip.files).filter(p => !srcZip.files[p].dir).sort();

    const read = await kit.readZip(bytes);
    const p = plan(read, partNames, keep);
    if (!p.kept.length) throw new Error('xlsx-write: keep at least one sheet.');

    const want = new Set(opts.grafts ?? p.grafts.filter(g => g.available).map(g => g.id));
    const log = [];
    const note = (stage, ok, msg) => log.push({ stage, ok, msg });

    // --- the writer's base package
    const Writer = await loadWriter();
    const wb = new Writer.Workbook();
    await wb.xlsx.load(bytes.buffer ? bytes.slice().buffer : bytes);
    const before = wb.worksheets.map(w => w.name);
    for (const ws of [...wb.worksheets]) if (!p.keepSet.has(ws.name)) wb.removeWorksheet(ws.id);
    // CALC CHAIN, the free win. calcChain.xml is only a recalculation order
    // cache, and every index in it is a sheet index that moves when a sheet
    // goes. The writer emits no calcChain at all, so instead of repairing the
    // indices we tell Excel to recompute on open, which is what a workbook
    // with no calcChain does anyway and what makes the omission correct rather
    // than merely tolerated.
    wb.calcProperties = { ...(wb.calcProperties || {}), fullCalcOnLoad: true };

    // ACTIVE TAB, which is the index trap that does not fix itself. The writer
    // carries workbookView.activeTab through untouched, so a workbook whose
    // third sheet was selected when it was saved comes back pointing at index
    // 2 with two sheets left, and Excel opens on a tab that is not there.
    //
    // Worth saying how this was nearly missed: on all thirteen OFM budget
    // forms the rebuild's activeTab was absent, which reads as the writer
    // dropping it and the trap being free. It is not. Those workbooks were all
    // saved on their first tab, so activeTab was 0 and therefore omitted. The
    // fixture in tools/test/xlsx-write.test.mjs sets it to the last sheet on
    // purpose, and that is what caught this.
    const lastTab = Math.max(0, wb.worksheets.length - 1);
    for (const v of wb.views || []) {
      if (Number.isFinite(v.activeTab) && v.activeTab > lastTab) v.activeTab = lastTab;
    }
    const baseBuf = await wb.xlsx.writeBuffer();
    note('writer', true, `${p.kept.length} of ${p.sheets.length} sheets written`
      + (before.length !== p.sheets.length ? ` (writer saw ${before.length})` : ''));

    const out = await ZipLib.loadAsync(baseBuf);
    let ct = await out.file('[Content_Types].xml').async('string');
    const srcCt = await srcZip.file('[Content_Types].xml').async('string');

    // Map each source sheet to the part path the WRITER gave it. ExcelJS names
    // a worksheet part after its own internal id, not its position, so
    // sheet1.xml in the source can be sheet4.xml in the output. Anything
    // grafted onto a sheet has to be aimed by this map rather than by the
    // source path.
    const outWbXml = await out.file('xl/workbook.xml').async('string');
    const outWbRels = await out.file('xl/_rels/workbook.xml.rels').async('string');
    const ridToTarget = new Map(relEntries(outWbRels).map(e => [attrOf(e, 'Id'), resolveTarget('xl/workbook.xml', attrOf(e, 'Target'))]));
    const outSheetPart = new Map();
    for (const m of outWbXml.matchAll(/<sheet\b[^>]*\/>/g)) {
      const name = attrOf(m[0], 'name'), rid = attrOf(m[0], 'r:id');
      const t = ridToTarget.get(rid);
      if (name && t) outSheetPart.set(name.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"), t);
    }

    // Content-type entries are copied from the SOURCE package, never built
    // from a table of type URIs here. A Default for an extension is added only
    // when the output has none.
    const ensureContentType = (part) => {
      if (new RegExp(`PartName="/${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(ct)) return true;
      const ov = new RegExp(`<Override[^>]*PartName="/${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*/>`).exec(srcCt);
      if (ov) { const next = spliceBefore(ct, '</Types>', ov[0]); if (!next) return false; ct = next; return true; }
      const ext = extOf(part);
      if (new RegExp(`<Default[^>]*Extension="${ext}"`, 'i').test(ct)) return true;
      const def = new RegExp(`<Default[^>]*Extension="${ext}"[^>]*/>`, 'i').exec(srcCt);
      if (!def) return false;
      const next = spliceBefore(ct, '</Types>', def[0]);
      if (!next) return false;
      ct = next;
      return true;
    };

    // The source's own Relationship element, re-Id'd so it cannot collide with
    // one the writer emitted, and re-targeted relative to the output part that
    // declares it.
    const addRel = async (fromPart, targetPart) => {
      const rp = relsPathFor(fromPart);
      const srcRelsXml = srcZip.file(rp) ? await srcZip.file(rp).async('string') : null;
      if (!srcRelsXml) return { ok: false, why: `no ${rp} in the source` };
      const el = relEntries(srcRelsXml).find(e => resolveTarget(fromPart, attrOf(e, 'Target')) === targetPart);
      if (!el) return { ok: false, why: `${rp} does not point at ${targetPart}` };
      let xml = out.file(rp) ? await out.file(rp).async('string') : EMPTY_RELS;
      if (relEntries(xml).some(e => resolveTarget(fromPart, attrOf(e, 'Target')) === targetPart)) return { ok: true, id: null };
      const id = freshRelId(xml);
      const next = spliceBefore(xml, '</Relationships>', el.replace(/\bId="[^"]*"/, `Id="${id}"`));
      if (!next) return { ok: false, why: `${rp} has no </Relationships>` };
      out.file(rp, next);
      return { ok: true, id };
    };

    let macroEnabled = false;
    const carried = [];

    for (const g of GRAFTS) {
      const found = p.grafts.find(x => x.id === g.id);
      if (!found?.available) continue;
      if (!want.has(g.id)) { note(g.id, false, 'not requested'); continue; }
      try {
        // The pivot graft is the one that needs a body edit, and its link runs
        // through two parts rather than one.
        if (g.id === 'pivots') {
          const done = [];
          for (const piv of found.pivots) {
            const sheetPart = outSheetPart.get(piv.host);
            if (!sheetPart) { note(g.id, false, `${piv.name}: the writer emitted no part for ${piv.host}`); continue; }
            for (const part of [piv.part, piv.cachePart, piv.recordsPart].filter(Boolean)) {
              out.file(part, await srcZip.file(part).async('uint8array'));
              if (!ensureContentType(part)) note(g.id, false, `${part}: no content type in the source`);
            }
            const cr = relsPathFor(piv.cachePart);
            if (srcZip.file(cr)) out.file(cr, await srcZip.file(cr).async('uint8array'));
            const pr = relsPathFor(piv.part);
            if (srcZip.file(pr)) { out.file(pr, await srcZip.file(pr).async('uint8array')); ensureContentType(pr); }

            // The worksheet reaches its pivot table through a relationship
            // only, so aim that one at the writer's part path.
            let sxml = out.file(relsPathFor(sheetPart)) ? await out.file(relsPathFor(sheetPart)).async('string') : EMPTY_RELS;
            const rel = `<Relationship Id="${freshRelId(sxml)}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotTable" Target="${piv.part.replace(/^xl\//, '../')}"/>`;
            const nx = spliceBefore(sxml, '</Relationships>', rel);
            if (!nx) { note(g.id, false, `${piv.name}: ${relsPathFor(sheetPart)} has no </Relationships>`); continue; }
            out.file(relsPathFor(sheetPart), nx);

            // The cache is the exception the comment above promised: workbook.xml
            // names it in its BODY, so the relationship alone is not the link.
            const cacheRel = await addRel('xl/workbook.xml', piv.cachePart);
            if (!cacheRel.ok) { note(g.id, false, `${piv.name}: ${cacheRel.why}`); continue; }
            let wbx = await out.file('xl/workbook.xml').async('string');
            const cacheId = /cacheId="(\d+)"/.exec(await srcZip.file(piv.part).async('string'))?.[1] ?? '0';
            if (!/<pivotCaches>/.test(wbx)) {
              const block = `<pivotCaches><pivotCache cacheId="${cacheId}" r:id="${cacheRel.id}"/></pivotCaches>`;
              const at = wbx.indexOf('<extLst');
              wbx = at >= 0 ? wbx.slice(0, at) + block + wbx.slice(at) : spliceBefore(wbx, '</workbook>', block);
            } else {
              wbx = wbx.replace('</pivotCaches>', `<pivotCache cacheId="${cacheId}" r:id="${cacheRel.id}"/></pivotCaches>`);
            }
            out.file('xl/workbook.xml', wbx);
            done.push(piv.name);
          }
          if (done.length) { carried.push({ id: g.id, label: g.label, detail: `${done.join(', ')}` }); note(g.id, true, `grafted ${done.join(', ')}`); }
          for (const b of found.blocked || []) note(g.id, false, b);
          continue;
        }

        for (const part of found.parts) {
          if (!srcZip.file(part)) { note(g.id, false, `${part} is not in the source`); continue; }
          out.file(part, await srcZip.file(part).async('uint8array'));
          if (!/\/_rels\//.test(part) && !ensureContentType(part)) note(g.id, false, `${part}: no content type in the source`);
        }
        // Link only the parts the source itself links from this part. An
        // itemProps or a signature is reached from its own item's rels, which
        // was copied above, so it needs no entry here.
        const linkRelsPath = relsPathFor(g.linkFrom);
        const linkRels = srcZip.file(linkRelsPath)
          ? relEntries(await srcZip.file(linkRelsPath).async('string'))
              .map(e => resolveTarget(g.linkFrom, attrOf(e, 'Target')))
          : [];
        const roots = found.parts.filter(part => linkRels.includes(part));
        if (!roots.length) note(g.id, false, `${linkRelsPath} points at none of these parts`);
        for (const part of roots) {
          const r = await addRel(g.linkFrom, part);
          if (!r.ok) note(g.id, false, `${part}: ${r.why}`);
        }
        if (found.macroEnabled) macroEnabled = true;
        carried.push({ id: g.id, label: g.label, detail: found.detail });
        note(g.id, true, `${found.parts.length} part${found.parts.length === 1 ? '' : 's'}: ${found.detail || ''}`.trim());
      } catch (e) {
        note(g.id, false, `graft threw: ${e.message}`);
      }
    }

    // A workbook holding vbaProject.bin must declare the macro-enabled main
    // type, or Excel rejects the package rather than merely losing the macros.
    if (macroEnabled) ct = ct.replace(SHEET_MAIN, MACRO_MAIN);
    out.file('[Content_Types].xml', ct);

    const written = await out.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const suffix = macroEnabled ? 'xlsm' : 'xlsx';
    const manifest = await buildManifest({ read, plan: p, bytes, written, carried, log, suffix, opts });
    return { bytes: written, manifest, suffix,
             mime: macroEnabled ? 'application/vnd.ms-excel.sheet.macroEnabled.12'
                                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  // ------------------------------------------------------------ manifest

  // THE HONESTY MECHANISM. Every row is derived from what kits/xlsx.js read,
  // on both sides: `found` from the source and `out` from the OUTPUT, re-read
  // by the same reader. Re-reading is the point. A manifest built from what
  // the writer was asked to do records intent; re-reading records result, so a
  // feature the writer silently dropped shows up as a gap rather than as a
  // claim that held.
  //
  // AND A THIRD COLUMN, because the second one on its own accuses the tool of
  // doing its job. Dropping a sheet is supposed to take that sheet's cells,
  // comments and merges with it, so `out` below `found` is the normal case and
  // flagging it makes every manifest look like a failure. `expect` is the
  // source count restricted to the KEPT sheets, which is what a lossless
  // rebuild would produce, so the only gap worth a warning is out < expect.
  //
  // A workbook-scoped row has no honest restriction to compute: the style
  // tables, the defined names and the connections belong to the package rather
  // than to any sheet, and a font that only the dropped sheet used is pruned
  // legitimately. Those rows declare scope 'workbook', show no expectation and
  // are never flagged. That is a real limit of this manifest and not a
  // rounding of one: genuine style loss hides in exactly those rows, and what
  // finds it is re-reading the output, which is the next check rather than
  // this one.
  const sheetSum = (xl, keys, f) => (keys ?? Object.keys(xl.sheets))
    .filter(k => xl.sheets[k]).reduce((a, k) => a + f(xl.sheets[k], k), 0);

  const FEATURES = [
    { id: 'sheets', label: 'Sheets', by: 'writer', scope: 'sheet',
      count: (xl, keys) => (keys ?? Object.keys(xl.sheets)).length },
    { id: 'cells', label: 'Cells with a value or a style', by: 'writer', scope: 'sheet',
      count: (xl, keys) => sheetSum(xl, keys, s => s.cellCount || 0),
      // The raw count, and the one that reads as alarming for a reason that is
      // not loss. A blank form is full of `<c r="A8" s="15"/>`: an empty cell
      // whose style record is the default in every field, which the writer
      // drops because it is indistinguishable from no cell. classifyCellLoss()
      // below separates those from cells that carried something, so this row
      // is flagged on the second kind only.
      classify: true },
    { id: 'cellsValued', label: '…of those, holding a value or formula', by: 'writer', scope: 'sheet',
      count: (xl, keys) => sheetSum(xl, keys, s =>
        (s.rows || []).reduce((a, r) => a + Object.values(r.cells || {}).filter(v => v !== '' && v != null).length
                                          + Object.keys(r.formulas || {}).filter(k => !(k in (r.cells || {}))).length, 0)) },
    { id: 'formulas', label: 'Formulas', by: 'writer', scope: 'sheet',
      count: (xl, keys) => sheetSum(xl, keys, s => s.formulas || 0) },
    { id: 'merges', label: 'Merged ranges', by: 'writer', scope: 'sheet',
      count: (xl, keys) => sheetSum(xl, keys, s => s.merges?.length || 0) },
    { id: 'cf', label: 'Conditional formats', by: 'writer', scope: 'sheet',
      count: (xl, keys) => sheetSum(xl, keys, s => s.conditionalFormats?.length || 0) },
    { id: 'dv', label: 'Data validations', by: 'writer', scope: 'sheet',
      count: (xl, keys) => sheetSum(xl, keys, s => s.validations?.length || 0) },
    { id: 'links', label: 'Hyperlinks', by: 'writer', scope: 'sheet',
      count: (xl, keys) => sheetSum(xl, keys, s => s.hyperlinks?.length || 0),
      note: 'The lossy one, measured across the OFM forms. The writer models a hyperlink as a property of a cell, so two links anchored on the same top-left cell collapse to one, and a link carrying only a location fragment (an in-workbook anchor) is dropped. Ordinary one-cell links to a URL survive.' },
    { id: 'comments', label: 'Cell comments', by: 'writer', scope: 'sheet',
      count: (xl, keys) => (keys ?? Object.keys(xl.sheets))
        .reduce((a, k) => a + (xl.comments?.[k]?.length || 0), 0) },
    { id: 'images', label: 'Sheet images', by: 'writer', scope: 'sheet',
      count: (xl, keys) => sheetSum(xl, keys, s => s.images?.length || 0) },
    { id: 'cols', label: 'Column width runs', by: 'writer', scope: 'sheet',
      count: (xl, keys) => sheetSum(xl, keys, s => s.cols?.length || 0),
      // Not loss when it falls. A run is a width applied to a column range, and
      // the writer merges adjacent runs of equal width: 2-10, 11-11 and
      // 12-16384 all at 9.14 come back as one run 2-16384. Same widths, fewer
      // records, so the row is reported and never flagged.
      neverShort: true },
    { id: 'freeze', label: 'Frozen panes', by: 'writer', scope: 'sheet',
      count: (xl, keys) => sheetSum(xl, keys, s => s.freeze ? 1 : 0) },
    { id: 'xfs', label: 'Cell format records', by: 'writer', scope: 'workbook',
      count: (xl) => (xl.cellXfs || []).length,
      note: 'A workbook-wide table. It shrinks when a sheet goes because the writer prunes the records nothing uses, so this row measures the table and not the fidelity.' },
    { id: 'fonts', label: 'Fonts', by: 'writer', scope: 'workbook', count: (xl) => (xl.fonts || []).length },
    { id: 'fills', label: 'Fills', by: 'writer', scope: 'workbook', count: (xl) => (xl.fills || []).length },
    { id: 'borders', label: 'Borders', by: 'writer', scope: 'workbook', count: (xl) => (xl.borders || []).length },
    { id: 'numFmts', label: 'Custom number formats', by: 'writer', scope: 'workbook',
      count: (xl) => Object.keys(xl.numFmts || {}).length },
    { id: 'definedNames', label: 'Defined names', by: 'writer', scope: 'workbook',
      count: (xl) => (xl.definedNames || []).length,
      note: 'The writer emits every name workbook-global, so a sheet-local name keeps its reference and loses its scope. A name whose reference points at a dropped sheet is listed below.' },
    { id: 'calcChain', label: 'Calc chain entries', by: 'dropped', scope: 'workbook',
      count: (xl) => (xl.calcChain || []).length,
      note: 'Dropped deliberately. It is a recalculation order cache whose every index moves when a sheet goes, so the workbook sets fullCalcOnLoad instead and Excel rebuilds it.' },
    { id: 'pivots', label: 'Pivot tables', by: 'graft', scope: 'sheet',
      count: (xl, keys) => Object.values(xl.pivotTables || {})
        .filter(p => !keys || keys.includes(p.sheet)).length },
    { id: 'pivotCaches', label: 'Pivot caches', by: 'graft', scope: 'workbook',
      count: (xl) => Object.keys(xl.pivotCaches || {}).length },
    { id: 'connections', label: 'Workbook connections', by: 'graft', scope: 'workbook',
      count: (xl) => (xl.connections || []).length },
    { id: 'powerQuery', label: 'Power Query M sections', by: 'graft', scope: 'workbook',
      count: (xl) => xl.powerQuery?.sections?.length || 0,
      note: 'Rides inside the customXml graft. Nothing here parses or re-emits the DataMashup blob, so a query survives or does not; it is never rewritten.' },
  ];

  // Parts the reader never sees, counted off the zip's own listing. A binary
  // part has no model to restrict, so every row here is workbook-scoped except
  // the two that are named per sheet.
  const BINARY_FEATURES = [
    { id: 'vba', label: 'VBA project', by: 'graft', match: /^xl\/vbaProject\.bin$/ },
    { id: 'vbaSig', label: 'VBA signatures', by: 'graft', match: /^xl\/vbaProjectSignature.*\.bin$/ },
    { id: 'customXml', label: 'customXml items', by: 'graft', match: /^customXml\/item\d*\.xml$/i },
    { id: 'printerSettings', label: 'Printer settings', by: 'dropped', match: /printerSettings\d*\.bin$/, perSheet: true,
      note: 'Per sheet, and nothing carries it: the writer models no page setup binary and no graft claims it. The loss is invisible until someone prints.' },
    { id: 'vml', label: 'VML drawings (comment boxes)', by: 'writer', match: /vmlDrawing\d*\.vml$/, perSheet: true },
  ];

  // WHY THE CELL COUNT NEEDS A CLASSIFIER RATHER THAN A CAVEAT. Rebuilding all
  // thirteen OFM budget forms and diffing each kept sheet cell by cell, the
  // writer lost 292 cells in total and every one of them was an empty cell
  // whose style record is the package default in every field. Not one cell
  // carrying a value, a formula, or a style that renders differently from no
  // style was lost. A note saying "some of this is probably harmless" would
  // have been true and useless; separating the two kinds is a check, so the
  // manifest flags the count only when something other than a stub goes.
  //
  // The limit worth stating: "renders like no style" is judged from the xf
  // record's own fields, so a style that is default in all of them and still
  // means something to Excel would be miscounted as a stub. Nothing in the
  // corpus is such a style, which is evidence and not a proof.
  const isNoOpStyle = (xl, si) => {
    if (si == null || si === '') return true;
    const xf = xl.xfs?.[Number(si)];
    if (!xf) return true;
    return String(xf.numFmtId ?? '0') === '0' && !xf.fontId && !xf.fillId && !xf.borderId
        && !xf.align && !xf.valign && !xf.wrap && !xf.indent;
  };

  // A cell inside a merged range that is NOT its top-left. Excel renders a
  // merge from the top-left cell alone, so text sitting in a slave is in the
  // file and not on the screen. Calling its loss harmless would overstate the
  // case, since a formula can still address the cell; calling it plain data
  // loss would overstate it the other way. It gets its own count.
  // kits/xlsx.js hands a merge back with a ONE-based row and a ZERO-based
  // column, which is worth stating rather than inferring: reading r1 as
  // zero-based makes every lookup miss by a row and the classifier then reports
  // ordinary loss where there is a merge.
  const mergeSlaveOf = (sheet, row1, col0) => (sheet.merges || []).find(m =>
    row1 >= m.r1 && row1 <= m.r2 && col0 >= m.c1 && col0 <= m.c2
    && !(row1 === m.r1 && col0 === m.c1));

  function classifyCellLoss(srcXl, outXl, keptNames) {
    const out = { missing: 0, stubs: 0, valued: 0, styled: 0, mergeSlaves: 0, samples: [] };
    const byName = (xl, n) => Object.values(xl.sheets).find(s => s.name === n);
    const sample = (t) => { if (out.samples.length < 8) out.samples.push(t); };
    for (const name of keptNames) {
      const a = byName(srcXl, name), b = byName(outXl, name);
      if (!a) continue;
      const present = new Set(), value = new Map();
      for (const r of b?.rows || []) {
        for (const c of new Set([...Object.keys(r.cells || {}), ...Object.keys(r.styles || {})])) present.add(`${r.row}:${c}`);
        for (const c of Object.keys(r.cells || {})) value.set(`${r.row}:${c}`, r.cells[c]);
      }
      for (const r of a.rows || []) {
        for (const c of new Set([...Object.keys(r.cells || {}), ...Object.keys(r.styles || {})])) {
          const key = `${r.row}:${c}`;
          const held = (r.cells?.[c] ?? '') !== '' || r.formulas?.[c];
          const gone = !present.has(key);
          // Two ways to lose a cell: the writer omits it, or it survives with
          // its value emptied. The second is what a merge slave does.
          const emptied = !gone && held && (value.get(key) ?? '') === '' && !r.formulas?.[c];
          if (!gone && !emptied) continue;
          out.missing++;
          const ref = `${name}!${window.xlsxKit.colLetter(Number(c))}${r.row}`;
          const slave = held ? mergeSlaveOf(a, r.row, Number(c)) : null;
          if (slave) {
            out.mergeSlaves++;
            sample(`${ref} held ${JSON.stringify(r.cells?.[c]).slice(0, 30)} inside the merge ${window.xlsxKit.colLetter(slave.c1)}${slave.r1}:${window.xlsxKit.colLetter(slave.c2)}${slave.r2}`);
          } else if (held) {
            out.valued++;
            sample(`${ref} held ${JSON.stringify(r.cells?.[c] ?? r.formulas?.[c]).slice(0, 40)}`);
          } else if (isNoOpStyle(srcXl, r.styles?.[c])) out.stubs++;
          else { out.styled++; sample(`${ref} carried format xf${r.styles?.[c]}`); }
        }
      }
    }
    return out;
  }

  async function buildManifest({ read, plan: p, bytes, written, carried, log, suffix }) {
    const kit = window.xlsxKit;
    const ZipLib = await loadZip();
    const srcParts = p.partNames;
    const keptKeys = p.kept.map(s => s.key);
    let after = null, outParts = [], checks = null;
    try {
      after = await kit.readZip(written);
      const z = await ZipLib.loadAsync(written);
      outParts = Object.keys(z.files).filter(q => !z.files[q].dir).sort();
      checks = await verify(written);
    } catch (e) {
      checks = { ok: false, problems: [{ kind: 'reread', message: `the output did not re-read: ${e.message}` }] };
    }

    const cellLoss = after ? classifyCellLoss(read.xl, after.xl, p.kept.map(s => s.name)) : null;

    const rows = [];
    for (const f of FEATURES) {
      const found = f.count(read.xl, null);
      const expect = f.scope === 'sheet' ? f.count(read.xl, keptKeys) : null;
      const out = after ? f.count(after.xl, null) : null;
      if (!found && !out) continue;
      let short = out != null && expect != null && out < expect;
      if (f.neverShort) short = false;
      // The classifier, not the count, decides whether the cell row is short.
      if (f.classify && cellLoss) short = cellLoss.valued + cellLoss.styled > 0;
      // The value row answers to the same classifier, so a merge slave's text
      // does not read as a lost value.
      if (f.id === 'cellsValued' && cellLoss) short = cellLoss.valued > 0;
      rows.push({ id: f.id, label: f.label, by: f.by, scope: f.scope, found, expect, out,
                  short, note: f.note || null });
    }
    // A per-sheet binary part's expectation is the count of matching parts the
    // KEPT sheets reach, which the ownership closure already answered.
    const keptReach = new Set(p.kept.flatMap(s => [s.part, ...s.parts]));
    for (const f of BINARY_FEATURES) {
      const hits = srcParts.filter(q => f.match.test(q));
      const out = outParts.filter(q => f.match.test(q)).length;
      if (!hits.length && !out) continue;
      const expect = f.perSheet ? hits.filter(q => keptReach.has(q)).length : null;
      rows.push({ id: f.id, label: f.label, by: f.by, scope: f.perSheet ? 'sheet' : 'workbook',
                  found: hits.length, expect, out,
                  short: expect != null && out < expect && f.by !== 'dropped', note: f.note || null });
    }

    return {
      source: { bytes: bytes.length, parts: srcParts.length,
                sheets: p.sheets.map(s => ({ name: s.name, visibility: s.visibility, cells: s.cells, kept: s.kept })) },
      output: { bytes: written.length, parts: outParts.length, suffix,
                sheets: after ? Object.values(after.xl.sheets).sort((a, b) => a.index - b.index).map(s => s.name) : null },
      kept: p.kept.map(s => s.name),
      dropped: p.dropped.map(s => ({ name: s.name, cells: s.cells,
        partsLeaving: s.parts.filter(q => p.partsLeaving.includes(q)) })),
      rows, carried, log, cellLoss,
      pivots: p.pivots,
      danglingNames: p.definedNames.filter(d => d.danglesOn),
      partsLeaving: p.partsLeaving,
      checks,
    };
  }

  // A reader's version of the same manifest. Markdown, because it is meant to
  // travel next to the file it describes.
  function manifestText(m) {
    const L = [];
    L.push('# Sheet picker manifest');
    L.push('');
    L.push(`Kept ${m.kept.length} of ${m.source.sheets.length} sheets: ${m.kept.join(', ')}`);
    if (m.dropped.length) L.push(`Dropped: ${m.dropped.map(d => `${d.name} (${d.cells} cells)`).join(', ')}`);
    L.push(`Source ${(m.source.bytes / 1024).toFixed(1)} KB in ${m.source.parts} parts; `
         + `output ${(m.output.bytes / 1024).toFixed(1)} KB in ${m.output.parts} parts (.${m.output.suffix}).`);
    L.push('');
    L.push('`in source` is the whole workbook. `kept sheets` is that count restricted to the sheets');
    L.push('you kept, which is what a lossless rebuild would produce, and it is blank for anything the');
    L.push('package owns rather than a sheet. `in output` is the same reader run over the result.');
    L.push('');
    L.push('| What | Carried by | In source | Kept sheets | In output | |');
    L.push('| --- | --- | --: | --: | --: | --- |');
    for (const r of m.rows) {
      L.push(`| ${r.label} | ${r.by} | ${r.found} | ${r.expect ?? ''} | ${r.out ?? '?'} | ${r.short ? '⚠️ short' : ''} |`);
    }
    if (m.cellLoss?.missing) {
      const c = m.cellLoss;
      L.push('');
      L.push(`**Cells the writer did not re-emit: ${c.missing}.** `
        + [c.stubs ? `${c.stubs} empty with a style that is the package default in every field, so nothing renders differently` : null,
           c.mergeSlaves ? `${c.mergeSlaves} holding text inside a merged range but not at its top-left, which Excel does not display and a formula can still read` : null,
           c.valued ? `${c.valued} that held a value or a formula` : null,
           c.styled ? `${c.styled} that carried a format` : null].filter(Boolean).join('; ') + '.'
        + (c.samples.length ? ' ' + c.samples.join('; ') + '.' : ''));
    }
    const short = m.rows.filter(r => r.short);
    if (short.length) {
      L.push('');
      L.push('**Short of the kept sheets.** ' + short.map(r => `${r.label} ${r.out} of ${r.expect}`).join('; ')
           + '. That gap is the writer losing something the sheets still hold, not the sheets you dropped.');
    }
    const notes = m.rows.filter(r => r.note);
    if (notes.length) {
      L.push('');
      for (const r of notes) L.push(`- **${r.label}.** ${r.note}`);
    }
    if (m.pivots.some(x => x.orphaned)) {
      L.push('');
      L.push('**Orphaned pivots.** ' + m.pivots.filter(x => x.orphaned)
        .map(x => `${x.name} sits on ${x.host}, which is kept, but its cache reads ${x.source}, which is not.`).join(' '));
    }
    if (m.danglingNames.length) {
      L.push('');
      L.push('**Defined names pointing at a dropped sheet.** '
        + m.danglingNames.map(d => `\`${d.name}\` → ${d.reference}`).join('; '));
    }
    L.push('');
    L.push('## Graft log');
    for (const e of m.log) L.push(`- ${e.ok ? '✅' : '⛔'} \`${e.stage}\` ${e.msg}`);
    L.push('');
    L.push('## Package check');
    L.push(m.checks?.ok
      ? '- ✅ every relationship resolves, every rels target is in the zip, every part is typed, every index is in range'
      : ((m.checks?.problems || []).map(pr => `- ⛔ ${pr.kind}: ${pr.message}`).join('\n') || '- ⛔ not run'));
    return L.join('\n');
  }

  // -------------------------------------------------------------- verify

  // CHECK 1 OF 3, the mechanical one. It proves the package is internally
  // consistent. It cannot prove Excel likes it, which is what the gold set is
  // for, and it cannot prove the content is right, which is what re-reading
  // with an independent parser is for.
  async function verify(input) {
    const ZipLib = await loadZip();
    const zip = await ZipLib.loadAsync(input);
    const names = Object.keys(zip.files).filter(p => !zip.files[p].dir);
    const has = new Set(names);
    const problems = [];
    const add = (kind, message) => problems.push({ kind, message });

    const ct = zip.file('[Content_Types].xml');
    if (!ct) add('content-types', '[Content_Types].xml is missing');
    const ctXml = ct ? await ct.async('string') : '';
    const defaults = new Set([...ctXml.matchAll(/<Default[^>]*Extension="([^"]+)"/gi)].map(m => m[1].toLowerCase()));
    const overrides = new Set([...ctXml.matchAll(/<Override[^>]*PartName="\/([^"]+)"/g)].map(m => m[1]));

    // Every part has a content type. The honest limit: an OPC package
    // normally declares `<Default Extension="xml" ContentType="application/xml"/>`,
    // so every .xml part passes this rule whether or not it carries the
    // Override its role requires. The rule catches an untyped binary (a
    // grafted vbaProject.bin whose Default went missing) and does not catch a
    // styles part that lost its Override. The one XML Override Excel refuses
    // the file over is checked separately below.
    for (const p of names) {
      if (p === '[Content_Types].xml') continue;
      if (overrides.has(p) || defaults.has(extOf(p))) continue;
      add('content-type', `${p} has neither an Override nor a Default for .${extOf(p)}`);
    }

    // The workbook's own part must be typed as a spreadsheet main part, and as
    // the MACRO-ENABLED one whenever a VBA project is in the package. Excel
    // rejects the file outright on either, rather than opening it and losing
    // the macros, which is what makes this worth a rule of its own.
    const MAIN = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';
    const MACRO = 'application/vnd.ms-excel.sheet.macroEnabled.main+xml';
    const mainType = new RegExp('<Override[^>]*PartName="/xl/workbook\\.xml"[^>]*ContentType="([^"]+)"').exec(ctXml)?.[1]
      ?? new RegExp('<Override[^>]*ContentType="([^"]+)"[^>]*PartName="/xl/workbook\\.xml"').exec(ctXml)?.[1];
    if (has.has('xl/workbook.xml')) {
      if (!mainType) add('content-type', 'xl/workbook.xml has no Override naming it the workbook part');
      else if (mainType !== MAIN && mainType !== MACRO) add('content-type', `xl/workbook.xml is typed ${mainType}`);
      else if (has.has('xl/vbaProject.bin') && mainType !== MACRO)
        add('content-type', 'the package holds xl/vbaProject.bin but the workbook is not typed macro-enabled');
    }

    // every rels target exists; every r:id in a body resolves
    const reachable = new Set(['[Content_Types].xml']);
    for (const p of names) {
      if (!/\.rels$/.test(p)) continue;
      reachable.add(p);
      const owner = p.replace(/(^|\/)_rels\//, '$1').replace(/\.rels$/, '');
      const xml = await zip.file(p).async('string');
      for (const el of relEntries(xml)) {
        if (attrOf(el, 'TargetMode') === 'External') continue;
        const t = resolveTarget(owner, attrOf(el, 'Target'));
        if (t == null) continue;
        if (!has.has(t)) add('rels-target', `${p} → ${attrOf(el, 'Target')} resolves to ${t}, which is not in the package`);
        else reachable.add(t);
      }
    }
    for (const p of names) {
      if (!/\.(xml|rels)$/.test(p) || /\.rels$/.test(p)) continue;
      const xml = await zip.file(p).async('string');
      const ids = new Set([...xml.matchAll(/\br:(?:id|embed|link|pivotCacheId)="([^"]+)"/g)].map(m => m[1]));
      if (!ids.size) continue;
      const rp = relsPathFor(p);
      const relXml = zip.file(rp) ? await zip.file(rp).async('string') : '';
      const declared = new Set(relEntries(relXml).map(e => attrOf(e, 'Id')));
      for (const id of ids) if (!declared.has(id)) add('r-id', `${p} references ${id}, which ${rp}${relXml ? ' does not declare' : ' does not exist to declare'}`);
    }

    // indices in range
    const wbXml = zip.file('xl/workbook.xml') ? await zip.file('xl/workbook.xml').async('string') : '';
    const sheetCount = [...wbXml.matchAll(/<sheet\b[^>]*\/>/g)].length;
    if (!sheetCount) add('sheets', 'the workbook declares no sheets');
    const activeTab = Number(/activeTab="(\d+)"/.exec(wbXml)?.[1] ?? NaN);
    if (Number.isFinite(activeTab) && activeTab >= sheetCount) add('index', `workbookView activeTab is ${activeTab} with ${sheetCount} sheets`);
    for (const m of wbXml.matchAll(/localSheetId="(\d+)"/g)) {
      if (Number(m[1]) >= sheetCount) add('index', `a definedName has localSheetId ${m[1]} with ${sheetCount} sheets`);
    }
    if (zip.file('xl/calcChain.xml')) {
      const cc = await zip.file('xl/calcChain.xml').async('string');
      for (const m of cc.matchAll(/\bi="(\d+)"/g)) {
        if (Number(m[1]) > sheetCount) { add('index', `calcChain names sheet index ${m[1]} with ${sheetCount} sheets`); break; }
      }
    }

    // orphan parts: reachable from the package root, or nothing points at them
    const unreferenced = names.filter(p => p !== '[Content_Types].xml' && !/\.rels$/.test(p) && !reachable.has(p));
    for (const p of unreferenced) add('orphan', `${p} is in the package but no relationship points at it`);

    return { ok: problems.length === 0, problems, parts: names.length, sheets: sheetCount };
  }

  window.xlsxWriteKit = { plan, rebuild, verify, manifestText, FEATURES, GRAFTS,
                          resolveTarget, relsPathFor, closure, ownership };
})();
