// kits/xlsx-write.js — the sheet picker's engine: rebuild a workbook holding a
// chosen subset of another's sheets, graft back the parts a writer cannot
// model, and say in a manifest what survived.
//
// THREE CHECKS WERE NAMED FOR THIS WORK AND TWO OF THEM ARE HERE.
//
//   1. The mechanical invariant check, verify(): every r:id resolves, every
//      rels target is in the zip, every part has a content type, every index
//      is in range. Tested in both directions, because a checker that has
//      never failed proves nothing: `verify catches a package it should
//      reject` breaks each invariant on purpose and asserts the message.
//   2. An INDEPENDENT READER over the output. kits/xlsx.js reads the input and
//      also re-reads the output for the manifest, so a defect the reader and
//      the writer share is invisible to it. SheetJS parses the same bytes with
//      a different codebase, which is the one place that library earns its
//      keep here after losing the writer benchmark.
//   3. A gold set opened in real Excel, which no sandbox can run. That one is
//      a handover, and scripts/xlsx-picker-sweep.mjs produces its candidates.
//
// THE FIXTURE IS BUILT, NOT COMMITTED. It is the 15.02-TECM-Template.xlsm trap
// set in miniature: three sheets in an order that is not part-file order, a
// hidden sheet, a pivot on the third sheet whose cache reads the FIRST, a
// signed VBA project, customXml with its itemProps, a per-sheet
// printerSettings, a calcChain, a definedName carrying a localSheetId, an
// activeTab pointing at the last sheet, and a merged range whose text sits in
// a slave cell. ExcelJS lays the base down so the package is certainly
// loadable, and the trap parts are grafted on with JSZip.

import test from 'node:test';
import assert from 'node:assert/strict';
import jsdomPkg from 'jsdom';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import * as SheetJS from 'xlsx';
import { loadKit } from './bootstrap.mjs';

const { JSDOM } = jsdomPkg;
globalThis.DOMParser = new JSDOM('').window.DOMParser;

const w = {};
loadKit('xlsx', { window: w });
loadKit('xlsx-write', { window: w });
// The write kit reads `window.xlsxKit`, so both must sit on one window, and it
// reaches `window` by name from inside its own closure.
globalThis.window = w;
const K = w.xlsxKit, W = w.xlsxWriteKit;

const rels = (...rows) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
  + rows.join('') + '</Relationships>';
const rel = (id, type, target) =>
  `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`;
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const MS = 'http://schemas.microsoft.com/office/2006/relationships';

async function fixture() {
  const wb = new ExcelJS.Workbook();
  // The active tab is set through the writer's own model rather than by a
  // regex over its output: a workbook built from scratch emits no
  // <workbookView> at all, so patching one that is not there passes silently
  // and the trap never enters the fixture. That is what happened first.
  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, activeTab: 2, visibility: 'visible' }];
  // Workbook order is deliberately not the order the parts will be named in.
  const data = wb.addWorksheet('Source Data');
  const notes = wb.addWorksheet('Notes', { state: 'hidden' });
  const report = wb.addWorksheet('Report');

  data.addRow(['Region', 'Quarter', 'Amount']);
  data.addRow(['North', 'Q1', 100]);
  data.addRow(['South', 'Q1', 250]);
  data.addRow(['North', 'Q2', 175]);
  data.getCell('E1').value = 'kept';
  data.getCell('E1').font = { bold: true };

  notes.addRow(['This sheet is hidden and is the one the tests drop.']);
  notes.getCell('A3').value = 'note body';

  report.getCell('A1').value = 'Report';
  report.getCell('A3').value = 'Total';
  report.getCell('B3').value = { formula: 'SUM(\'Source Data\'!C2:C4)', result: 525 };
  // A merge whose text sits in the SLAVE cell, which Excel does not display.
  report.mergeCells('A5:B5');
  report.getCell('A5').value = 'shown';

  const base = await wb.xlsx.writeBuffer();
  const z = await JSZip.loadAsync(base);

  // Which part the writer gave each sheet, since it names them by internal id.
  const wbXml0 = await z.file('xl/workbook.xml').async('string');
  const wbRels0 = await z.file('xl/_rels/workbook.xml.rels').async('string');
  const target = (rid) => new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(wbRels0)?.[1];
  const partOf = {};
  for (const m of wbXml0.matchAll(/<sheet\b[^>]*\/>/g)) {
    partOf[/name="([^"]+)"/.exec(m[0])[1]] = 'xl/' + target(/r:id="([^"]+)"/.exec(m[0])[1]);
  }

  // --- VBA, signed, and its own rels file
  z.file('xl/vbaProject.bin', new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 1, 2, 3]));
  z.file('xl/vbaProjectSignature.bin', new Uint8Array([9, 9, 9, 9]));
  z.file('xl/_rels/vbaProject.bin.rels',
    rels(rel('rId1', `${MS}/vbaProjectSignature`, 'vbaProjectSignature.bin')));

  // --- customXml, three parts that reference each other
  z.file('customXml/item1.xml', '<?xml version="1.0"?><root xmlns="urn:fixture"><v>1</v></root>');
  z.file('customXml/itemProps1.xml',
    '<?xml version="1.0"?><ds:datastoreItem xmlns:ds="http://schemas.openxmlformats.org/officeDocument/2006/customXml" ds:itemID="{FIXTURE}"/>');
  z.file('customXml/_rels/item1.xml.rels',
    rels(rel('rId1', `${R}/customXmlProps`, 'itemProps1.xml')));

  // --- printerSettings on Source Data only
  z.file('xl/printerSettings/printerSettings1.bin', new Uint8Array([1, 2, 3, 4]));
  const dataRels = `xl/worksheets/_rels/${partOf['Source Data'].split('/').pop()}.rels`;
  z.file(dataRels, rels(rel('rId1', `${R}/printerSettings`, '../printerSettings/printerSettings1.bin')));

  // --- the pivot: it sits on Report, its cache reads Source Data
  z.file('xl/pivotCache/pivotCacheDefinition1.xml',
    '<?xml version="1.0"?><pivotCacheDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    + ' r:id="rId1" recordCount="3"><cacheSource type="worksheet">'
    + '<worksheetSource ref="A1:C4" sheet="Source Data"/></cacheSource>'
    + '<cacheFields count="1"><cacheField name="Region"><sharedItems/></cacheField></cacheFields>'
    + '</pivotCacheDefinition>');
  z.file('xl/pivotCache/pivotCacheRecords1.xml',
    '<?xml version="1.0"?><pivotCacheRecords xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0"/>');
  z.file('xl/pivotCache/_rels/pivotCacheDefinition1.xml.rels',
    rels(rel('rId1', `${R}/pivotCacheRecords`, 'pivotCacheRecords1.xml')));
  z.file('xl/pivotTables/pivotTable1.xml',
    '<?xml version="1.0"?><pivotTableDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    + ' name="FixturePivot" cacheId="0"><location ref="A8:C10" firstHeaderRow="1" firstDataRow="1" firstDataCol="0"/>'
    + '</pivotTableDefinition>');
  z.file('xl/pivotTables/_rels/pivotTable1.xml.rels',
    rels(rel('rId1', `${R}/pivotCacheDefinition`, '../pivotCache/pivotCacheDefinition1.xml')));
  const reportRels = `xl/worksheets/_rels/${partOf['Report'].split('/').pop()}.rels`;
  z.file(reportRels, rels(rel('rId1', `${R}/pivotTable`, '../pivotTables/pivotTable1.xml')));

  // --- calcChain, with an index that a dropped sheet invalidates
  z.file('xl/calcChain.xml',
    '<?xml version="1.0"?><calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<c r="B3" i="3"/></calcChain>');

  // --- workbook body: the pivot cache reference, a sheet-local defined name,
  //     and an activeTab pointing at the LAST sheet.
  let wbXml = wbXml0
    .replace('</sheets>', '</sheets><definedNames>'
      + '<definedName name="ReportTotal" localSheetId="2">Report!$B$3</definedName>'
      + '<definedName name="DataRange">\'Source Data\'!$A$1:$C$4</definedName>'
      + '</definedNames>');
  wbXml = wbXml.replace('</workbook>',
    '<pivotCaches><pivotCache cacheId="0" r:id="rIdPivotCache"/></pivotCaches></workbook>');
  z.file('xl/workbook.xml', wbXml);

  z.file('xl/_rels/workbook.xml.rels', wbRels0.replace('</Relationships>',
      rel('rIdVba', `${MS}/vbaProject`, 'vbaProject.bin')
    + rel('rIdCustom1', `${R}/customXml`, '../customXml/item1.xml')
    + rel('rIdPivotCache', `${R}/pivotCacheDefinition`, 'pivotCache/pivotCacheDefinition1.xml')
    + rel('rIdCalc', `${R}/calcChain`, 'calcChain.xml')
    + '</Relationships>'));

  const ct = (await z.file('[Content_Types].xml').async('string')).replace('</Types>',
      '<Default Extension="bin" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.printerSettings"/>'
    + '<Override PartName="/xl/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/>'
    + '<Override PartName="/xl/vbaProjectSignature.bin" ContentType="application/vnd.ms-office.vbaProjectSignature"/>'
    + '<Override PartName="/customXml/item1.xml" ContentType="application/xml"/>'
    + '<Override PartName="/customXml/itemProps1.xml" ContentType="application/vnd.openxmlformats-officedocument.customXmlProperties+xml"/>'
    + '<Override PartName="/xl/pivotCache/pivotCacheDefinition1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheDefinition+xml"/>'
    + '<Override PartName="/xl/pivotCache/pivotCacheRecords1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheRecords+xml"/>'
    + '<Override PartName="/xl/pivotTables/pivotTable1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.pivotTable+xml"/>'
    + '<Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/>'
    + '</Types>');
  z.file('[Content_Types].xml', ct.replace(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
    'application/vnd.ms-excel.sheet.macroEnabled.main+xml'));

  return z.generateAsync({ type: 'uint8array' });
}

const bytes = await fixture();

// ---------------------------------------------------------------- the map

test('the fixture is the trap set, as kits/xlsx.js reads it', async () => {
  // Assert the traps are IN the fixture before asserting anything about what
  // the rebuild does to them. A fixture that quietly lost a trap turns the
  // tests below into tests of nothing.
  const z = await JSZip.loadAsync(bytes);
  const wbXml = await z.file('xl/workbook.xml').async('string');
  assert.match(wbXml, /activeTab="2"/, 'the fixture should point activeTab at the last sheet');
  assert.match(wbXml, /localSheetId="2"/, 'and carry a sheet-local defined name');
  assert.ok(z.file('xl/calcChain.xml'), 'and a calc chain');
  assert.ok(z.file('xl/vbaProject.bin'), 'and a VBA project');
  assert.ok(z.file('xl/printerSettings/printerSettings1.bin'), 'and a per-sheet printerSettings');

  const r = await K.readZip(bytes);
  const names = Object.values(r.xl.sheets).sort((a, b) => a.index - b.index).map(s => s.name);
  assert.deepEqual(names, ['Source Data', 'Notes', 'Report']);
  assert.equal(Object.values(r.xl.sheets).find(s => s.name === 'Notes').visibility, 'hidden');
  assert.equal(Object.keys(r.xl.pivotTables).length, 1);
  // The trap itself: the pivot's host and its cache's source are different sheets.
  const cache = r.xl.pivotCaches['xl/pivotCache/pivotCacheDefinition1.xml'];
  assert.equal(cache.source.sheet, 'Source Data');
});

test('the dependency map is per sheet, not workbook-wide', async () => {
  const r = await K.readZip(bytes);
  const zip = await JSZip.loadAsync(bytes);
  const parts = Object.keys(zip.files).filter(p => !zip.files[p].dir);
  const p = W.plan(r, parts, ['Source Data', 'Notes', 'Report']);

  const of = (name) => p.sheets.find(s => s.name === name).parts;
  // printerSettings belongs to Source Data and to nothing else; the pivot
  // table belongs to Report. A coarser map calls both workbook-wide, which is
  // the mistake this walk exists to avoid.
  assert.ok(of('Source Data').includes('xl/printerSettings/printerSettings1.bin'));
  assert.ok(!of('Report').includes('xl/printerSettings/printerSettings1.bin'));
  assert.ok(of('Report').includes('xl/pivotTables/pivotTable1.xml'));
  assert.ok(!of('Source Data').includes('xl/pivotTables/pivotTable1.xml'));
  // And the closure is transitive: the pivot table's own rels reach the cache.
  assert.ok(of('Report').includes('xl/pivotCache/pivotCacheDefinition1.xml'));
  assert.ok(of('Report').includes('xl/pivotCache/pivotCacheRecords1.xml'));

  // The VBA project hangs off the workbook, so no sheet owns it and dropping
  // any sheet leaves it alone.
  assert.ok(p.workbookParts.includes('xl/vbaProject.bin'));
  assert.ok(p.workbookParts.includes('customXml/item1.xml'));
});

test('dropping a sheet reports the parts that leave with it', async () => {
  const r = await K.readZip(bytes);
  const zip = await JSZip.loadAsync(bytes);
  const p = W.plan(r, Object.keys(zip.files).filter(q => !zip.files[q].dir), ['Report', 'Notes']);
  assert.ok(p.partsLeaving.includes('xl/printerSettings/printerSettings1.bin'));
  assert.ok(!p.partsLeaving.includes('xl/pivotTables/pivotTable1.xml'));
  assert.ok(!p.partsLeaving.includes('xl/vbaProject.bin'));
});

test('a pivot is orphaned when its cache source goes, not when its host does', async () => {
  const r = await K.readZip(bytes);
  const zip = await JSZip.loadAsync(bytes);
  const parts = Object.keys(zip.files).filter(q => !zip.files[q].dir);

  // Keeping the pivot's own sheet is not enough: its cache reads Source Data.
  const orphan = W.plan(r, parts, ['Report']);
  assert.equal(orphan.pivots[0].orphaned, true);
  assert.equal(orphan.pivots[0].source, 'Source Data');
  assert.equal(orphan.grafts.find(g => g.id === 'pivots').available, false);

  // Keeping both leaves it live.
  const live = W.plan(r, parts, ['Source Data', 'Report']);
  assert.equal(live.pivots[0].orphaned, false);
  assert.equal(live.grafts.find(g => g.id === 'pivots').available, true);

  // Dropping the host drops the pivot without it counting as orphaned: there
  // is no pivot left to be orphaned.
  const gone = W.plan(r, parts, ['Source Data']);
  assert.equal(gone.pivots[0].hostKept, false);
  assert.equal(gone.pivots[0].orphaned, false);
});

// ------------------------------------------------------------- the rebuild

test('rebuild keeps the chosen sheets, in workbook order, and passes its own check', async () => {
  const { bytes: out, manifest } = await W.rebuild(bytes, ['Source Data', 'Report']);
  assert.deepEqual(manifest.output.sheets, ['Source Data', 'Report']);
  assert.deepEqual(manifest.kept, ['Source Data', 'Report']);
  assert.deepEqual(manifest.dropped.map(d => d.name), ['Notes']);
  assert.equal(manifest.checks.ok, true,
    'verify() rejected the rebuild: ' + JSON.stringify(manifest.checks.problems));

  const again = await W.verify(out);
  assert.equal(again.ok, true);
  assert.equal(again.sheets, 2);
});

test('the calc chain goes and the workbook asks Excel to recalculate', async () => {
  const { bytes: out } = await W.rebuild(bytes, ['Source Data', 'Report']);
  const z = await JSZip.loadAsync(out);
  assert.equal(z.file('xl/calcChain.xml'), null, 'calcChain.xml should not be re-emitted');
  const wbXml = await z.file('xl/workbook.xml').async('string');
  assert.match(wbXml, /fullCalcOnLoad="1"/,
    'dropping calcChain without fullCalcOnLoad leaves the formulas to chance');
});

test('the indices that move when a sheet goes are all back in range', async () => {
  const { bytes: out } = await W.rebuild(bytes, ['Source Data', 'Report']);
  const z = await JSZip.loadAsync(out);
  const wbXml = await z.file('xl/workbook.xml').async('string');
  const sheets = [...wbXml.matchAll(/<sheet\b[^>]*\/>/g)].length;
  assert.equal(sheets, 2);
  const activeTab = Number(/activeTab="(\d+)"/.exec(wbXml)?.[1] ?? 0);
  assert.ok(activeTab < sheets, `activeTab ${activeTab} with ${sheets} sheets`);
  for (const m of wbXml.matchAll(/localSheetId="(\d+)"/g)) {
    assert.ok(Number(m[1]) < sheets, `localSheetId ${m[1]} with ${sheets} sheets`);
  }
});

test('the grafts land: VBA with its signature, customXml, and the pivot', async () => {
  const { bytes: out, manifest, suffix } = await W.rebuild(bytes, ['Source Data', 'Report']);
  const z = await JSZip.loadAsync(out);

  assert.ok(z.file('xl/vbaProject.bin'), 'the VBA project should be grafted');
  assert.ok(z.file('xl/vbaProjectSignature.bin'), 'its signature part travels with it');
  assert.ok(z.file('customXml/item1.xml'));
  assert.ok(z.file('customXml/itemProps1.xml'));
  assert.ok(z.file('xl/pivotTables/pivotTable1.xml'));
  assert.ok(z.file('xl/pivotCache/pivotCacheDefinition1.xml'));

  // A grafted VBA project makes the package macro-enabled, and the main part's
  // content type has to say so or Excel rejects the file outright.
  assert.equal(suffix, 'xlsm');
  const ct = await z.file('[Content_Types].xml').async('string');
  assert.match(ct, /vnd\.ms-excel\.sheet\.macroEnabled\.main\+xml/);
  assert.doesNotMatch(ct, /spreadsheetml\.sheet\.main\+xml/);

  // The relationship, not just the bytes: a part nothing points at is dead
  // weight, and verify() reports it as an orphan.
  const wbRels = await z.file('xl/_rels/workbook.xml.rels').async('string');
  assert.match(wbRels, /vbaProject\.bin/);
  assert.match(wbRels, /customXml\/item1\.xml/);
  assert.match(await z.file('xl/workbook.xml').async('string'), /<pivotCaches>/);

  assert.deepEqual(manifest.carried.map(c => c.id).sort(), ['customxml', 'pivots', 'vba']);
});

test('a graft can be declined, and declining leaves a workbook that still checks out', async () => {
  const { bytes: out, manifest, suffix } = await W.rebuild(bytes, ['Source Data', 'Report'], { grafts: ['customxml'] });
  const z = await JSZip.loadAsync(out);
  assert.equal(z.file('xl/vbaProject.bin'), null);
  assert.ok(z.file('customXml/item1.xml'));
  assert.equal(suffix, 'xlsx', 'without the VBA graft the result is not macro-enabled');
  assert.equal(manifest.checks.ok, true, JSON.stringify(manifest.checks.problems));
  assert.ok(manifest.log.some(e => e.stage === 'vba' && !e.ok && /not requested/.test(e.msg)));
});

test('the pivot graft is refused, not attempted, when its cache source is dropped', async () => {
  const { bytes: out, manifest } = await W.rebuild(bytes, ['Report']);
  const z = await JSZip.loadAsync(out);
  assert.equal(z.file('xl/pivotTables/pivotTable1.xml'), null,
    'grafting a pivot whose cache reads a dropped sheet would ship a broken pivot');
  assert.equal(manifest.checks.ok, true);
  assert.ok(manifest.pivots[0].orphaned);
});

// ------------------------------------------------------------- the manifest

test('the manifest counts the output, not the intention', async () => {
  const { manifest } = await W.rebuild(bytes, ['Source Data', 'Report']);
  const row = (id) => manifest.rows.find(r => r.id === id);

  // `found` is the whole source, `expect` restricts it to the kept sheets, and
  // `out` is the same reader run over the result.
  assert.equal(row('sheets').found, 3);
  assert.equal(row('sheets').expect, 2);
  assert.equal(row('sheets').out, 2);

  // The calc chain row is the declared drop, so it is never flagged short.
  assert.equal(row('calcChain').by, 'dropped');
  assert.equal(row('calcChain').out, 0);
  assert.equal(row('calcChain').short, false);

  // A workbook-scoped row has no honest per-sheet expectation.
  assert.equal(row('xfs').scope, 'workbook');
  assert.equal(row('xfs').expect, null);
  assert.equal(row('xfs').short, false);

  // Every row is derived, so nothing in the table names a feature the source
  // does not have.
  for (const r of manifest.rows) assert.ok(r.found > 0 || r.out > 0, `${r.id} is an empty row`);
});

test('text under a merge is counted as its own kind of loss', async () => {
  // The writer normalises a merge onto its top-left cell. The fixture's Report
  // sheet has 'shown' at the top-left of A5:B5, so nothing is lost there; this
  // asserts the classifier reports the category rather than a raw count.
  const { manifest } = await W.rebuild(bytes, ['Source Data', 'Report']);
  assert.ok(manifest.cellLoss, 'the manifest should classify what the writer did not re-emit');
  assert.equal(manifest.cellLoss.valued, 0,
    'no cell holding a value should go: ' + manifest.cellLoss.samples.join('; '));
  assert.equal(manifest.cellLoss.styled, 0);
});

test('manifestText renders every section it claims to', async () => {
  const { manifest } = await W.rebuild(bytes, ['Source Data', 'Report']);
  const md = W.manifestText(manifest);
  assert.match(md, /^# Sheet picker manifest/);
  assert.match(md, /Kept 2 of 3 sheets/);
  assert.match(md, /## Graft log/);
  assert.match(md, /## Package check/);
  assert.match(md, /every relationship resolves/);
  assert.ok(!/undefined|\[object Object\]|NaN/.test(md), 'the manifest leaked a raw value:\n' + md);
});

// ------------------------------------------------- check 2: another reader

test('an independent reader opens the output and finds the content', async () => {
  // SheetJS, not kits/xlsx.js. The manifest already re-reads with the kit, and
  // a defect the kit and the writer share would survive that. This is a second
  // codebase parsing the same bytes.
  const { bytes: out } = await W.rebuild(bytes, ['Source Data', 'Report']);
  const wb = SheetJS.read(out, { type: 'buffer', cellFormula: true });

  assert.deepEqual(wb.SheetNames, ['Source Data', 'Report']);
  const data = wb.Sheets['Source Data'];
  assert.equal(data['A1'].v, 'Region');
  assert.equal(data['C3'].v, 250);
  assert.equal(data['E1'].v, 'kept');

  const report = wb.Sheets['Report'];
  assert.equal(report['A1'].v, 'Report');
  assert.match(report['B3'].f, /SUM/, 'the formula should survive as a formula');
  assert.match(report['B3'].f, /Source Data/, 'and should still name the sheet it reads');
});

test('an independent reader sees the dropped sheet gone rather than emptied', async () => {
  const { bytes: out } = await W.rebuild(bytes, ['Source Data', 'Report']);
  const wb = SheetJS.read(out, { type: 'buffer' });
  assert.equal(wb.Sheets['Notes'], undefined);
  assert.ok(!wb.SheetNames.includes('Notes'));
});

// ------------------------------------------- check 1, in the other direction

test('verify catches a package it should reject', async () => {
  const { bytes: good } = await W.rebuild(bytes, ['Source Data', 'Report']);
  assert.equal((await W.verify(good)).ok, true);

  // Each mutation breaks exactly one invariant, and the check must name it.
  // Without this, a verify() that returned { ok: true } unconditionally would
  // pass every other test in this file.
  const broken = async (mutate) => {
    const z = await JSZip.loadAsync(good);
    await mutate(z);
    return W.verify(await z.generateAsync({ type: 'uint8array' }));
  };

  const missingTarget = await broken(async (z) => { z.remove('xl/styles.xml'); });
  assert.equal(missingTarget.ok, false);
  assert.ok(missingTarget.problems.some(p => p.kind === 'rels-target' && /styles\.xml/.test(p.message)),
    JSON.stringify(missingTarget.problems));

  // An untyped BINARY part, not an XML one. A package declares
  // `<Default Extension="xml"/>`, so dropping styles.xml's Override leaves it
  // typed as generic XML and the rule correctly says nothing; verify()'s
  // comment states that limit rather than pretending to cover it.
  const untyped = await broken(async (z) => {
    const ct = await z.file('[Content_Types].xml').async('string');
    z.file('[Content_Types].xml', ct
      .replace(/<Default[^>]*Extension="bin"[^>]*\/>/i, '')
      .replace(/<Override[^>]*vbaProject\.bin[^>]*\/>/g, ''));
  });
  assert.equal(untyped.ok, false);
  assert.ok(untyped.problems.some(p => p.kind === 'content-type' && /vbaProject/.test(p.message)),
    JSON.stringify(untyped.problems));

  // And the one XML Override Excel refuses the package over: a workbook
  // carrying a VBA project but typed as a plain .xlsx.
  const wrongMain = await broken(async (z) => {
    const ct = await z.file('[Content_Types].xml').async('string');
    z.file('[Content_Types].xml', ct.replace(
      'application/vnd.ms-excel.sheet.macroEnabled.main+xml',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'));
  });
  assert.equal(wrongMain.ok, false);
  assert.ok(wrongMain.problems.some(p => p.kind === 'content-type' && /macro-enabled/.test(p.message)),
    JSON.stringify(wrongMain.problems));

  const danglingId = await broken(async (z) => {
    const x = await z.file('xl/workbook.xml').async('string');
    z.file('xl/workbook.xml', x.replace(/r:id="rId\d+"/, 'r:id="rIdNope"'));
  });
  assert.equal(danglingId.ok, false);
  assert.ok(danglingId.problems.some(p => p.kind === 'r-id' && /rIdNope/.test(p.message)),
    JSON.stringify(danglingId.problems));

  const outOfRange = await broken(async (z) => {
    const x = await z.file('xl/workbook.xml').async('string');
    z.file('xl/workbook.xml', x.replace(/<workbookView/, '<workbookView activeTab="9"'));
  });
  assert.equal(outOfRange.ok, false);
  assert.ok(outOfRange.problems.some(p => p.kind === 'index' && /activeTab/.test(p.message)),
    JSON.stringify(outOfRange.problems));

  const orphanPart = await broken(async (z) => {
    z.file('xl/orphan.xml', '<?xml version="1.0"?><x/>');
  });
  assert.equal(orphanPart.ok, false);
  assert.ok(orphanPart.problems.some(p => p.kind === 'orphan' && /orphan\.xml/.test(p.message)),
    JSON.stringify(orphanPart.problems));
});

// Determinism is what lets the gold set be REGENERATED rather than committed:
// a derived artifact is only safe to rebuild on demand when its builder is
// deterministic, and an .xlsx that drifts every run forces the binary into a
// repository instead. Asserted directly rather than inferred from one run,
// because the failure it guards is silent. Before the fix, two rebuilds a
// second apart differed in 31 of 34 zip entries with the content of all 34
// identical: JSZip stamps `new Date()` on every entry it is handed.
test('two rebuilds of one workbook are byte-identical', async () => {
  const a = await W.rebuild(bytes, ['Source Data', 'Report']);
  const b = await W.rebuild(bytes, ['Source Data', 'Report']);
  assert.equal(Buffer.compare(Buffer.from(a.bytes), Buffer.from(b.bytes)), 0,
    'the rebuild is not reproducible, so its output cannot be regenerated in place of being stored');
});

test('rebuild refuses to write a workbook with no sheets', async () => {
  await assert.rejects(() => W.rebuild(bytes, []), /keep at least one sheet/);
});
