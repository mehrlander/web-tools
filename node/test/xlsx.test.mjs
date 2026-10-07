// kits/xlsx.js — OOXML structural inspector. DOMParser comes from jsdom (same
// pattern as compression.test.mjs); fixtures are minimal hand-built XML parts
// so the pure analyze()/views/sheetRows logic is exercised without a real
// .xlsx file or JSZip (readZip's lazy JSZip load is exercised on the browser
// side only — see kits/demos/xlsx.html).

import test from 'node:test';
import assert from 'node:assert/strict';
import jsdomPkg from 'jsdom';
import { loadKit } from './bootstrap.mjs';

const { JSDOM } = jsdomPkg;
globalThis.DOMParser = new JSDOM('').window.DOMParser;

const { xlsxKit } = loadKit('xlsx');

// A minimal two-sheet workbook: sheet1 has a sparse row (gap at column B) and
// a shared-string cell whose value only resolves once sharedStrings.xml is
// walked; sheet2 has a formula, a style ref, and a merged cell.
const CONTENT_TYPES = `<?xml version="1.0"?>
<Types xmlns="ct"><Override PartName="/xl/workbook.xml"/></Types>`;

// Workbook order is DELIBERATELY not part-file order: the first sheet in the
// workbook is Calc, which lives in sheet2.xml. That is what a workbook looks
// like once its tabs have been dragged around, and it is the only arrangement
// under which the index assertions below can fail. sheetId is likewise not the
// file number, since Excel never reuses one after a delete.
//
// The two defined names are each chosen to discriminate: the local one sits on
// workbook index 0 (Calc, part sheet2), which the old file-number comparison
// could not match, and the global one is found only by the sheet's DISPLAY
// name, which the kit did not know before the workbook <sheets> join.
const WORKBOOK = `<?xml version="1.0"?>
<workbook xmlns="wb" xmlns:r="rel">
  <sheets>
    <sheet name="Calc" sheetId="9" r:id="rId1"/>
    <sheet name="Data" sheetId="7" r:id="rId2"/>
  </sheets>
  <definedNames>
    <definedName name="CalcLocal" localSheetId="0">Calc!$A$1</definedName>
    <definedName name="MyRange">Data!$A$1:$A$2</definedName>
  </definedNames>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0"?>
<Relationships xmlns="rel">
  <Relationship Id="rId1" Type=".../worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId2" Type=".../worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

// Sparse row: column A ("r=A1", shared string 0) then column C ("r=C1", inline "42").
const SHEET1 = `<?xml version="1.0"?>
<worksheet xmlns="ws">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="C1"><v>42</v></c>
    </row>
  </sheetData>
</worksheet>`;

const SHEET2 = `<?xml version="1.0"?>
<worksheet xmlns="ws">
  <sheetData>
    <row r="1">
      <c r="A1" s="3"><f>SUM(Data!A1:A2)</f><v>7</v></c>
    </row>
  </sheetData>
  <mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells>
</worksheet>`;

const SHARED_STRINGS = `<?xml version="1.0"?>
<sst xmlns="sst"><si><t>hello</t></si></sst>`;

// cellXfs index is a cell's `s`. Index 3 is the one SHEET2 uses. numFmtId 164
// is custom and declared; 14 and 9 are built in and have no code written
// anywhere in the file, which is the reason the kit has to carry a table.
const STYLES = `<?xml version="1.0"?>
<styleSheet xmlns="s">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/></numFmts>
  <cellXfs count="7">
    <xf numFmtId="0"/>
    <xf numFmtId="14"/>
    <xf numFmtId="164"/>
    <xf numFmtId="0"/>
    <xf numFmtId="9"/>
    <xf numFmtId="22"/>
    <xf numFmtId="49"/>
  </cellXfs>
</styleSheet>`;

// i is a ZERO-based workbook index, so i="0" is Calc, which is part sheet2.xml
// and holds the only formula. Under the old file-number arithmetic this looked
// for "1" and found nothing.
const CALC_CHAIN = `<?xml version="1.0"?>
<calcChain xmlns="cc"><c r="A1" i="0"/></calcChain>`;

function buildParts({ order = 'natural' } = {}) {
  const base = {
    '[Content_Types].xml': CONTENT_TYPES,
    'xl/workbook.xml': WORKBOOK,
    'xl/_rels/workbook.xml.rels': WORKBOOK_RELS,
    'xl/worksheets/sheet1.xml': SHEET1,
    'xl/worksheets/sheet2.xml': SHEET2,
    'xl/sharedStrings.xml': SHARED_STRINGS,
    'xl/styles.xml': STYLES,
    'xl/calcChain.xml': CALC_CHAIN,
  };
  const entries = Object.entries(base);
  // 'reversed' processes both sheets before sharedStrings.xml, the ordering
  // that broke the original prototypes' inline string resolution.
  return order === 'reversed' ? entries.reverse() : entries;
}

test('kit surface', () => {
  for (const k of ['readZip', 'analyze', 'views', 'sheetRows', 'summary', 'colLetter']) {
    assert.ok(xlsxKit[k], `xlsxKit.${k} present`);
  }
  for (const v of ['paths', 'connections', 'unconnected', 'files']) {
    assert.equal(typeof xlsxKit.views[v], 'function', `views.${v} is a function`);
  }
});

test('colLetter: zero-based index to A1-style letters', () => {
  assert.equal(xlsxKit.colLetter(0), 'A');
  assert.equal(xlsxKit.colLetter(2), 'C');
  assert.equal(xlsxKit.colLetter(25), 'Z');
  assert.equal(xlsxKit.colLetter(26), 'AA');
  assert.equal(xlsxKit.colLetter(701), 'ZZ');
});

test('analyze: shared-string values resolve regardless of part order', () => {
  for (const order of ['natural', 'reversed']) {
    const result = xlsxKit.analyze(buildParts({ order }));
    const rows = xlsxKit.sheetRows(result.xl.sheets.sheet1);
    assert.deepEqual(rows, [{ Row: 1, A: 'hello', C: '42' }], `order=${order}`);
  }
});

test('analyze: sparse row keeps the gap instead of compacting columns', () => {
  const result = xlsxKit.analyze(buildParts());
  const [row] = xlsxKit.sheetRows(result.xl.sheets.sheet1);
  assert.deepEqual(Object.keys(row), ['Row', 'A', 'C']); // no 'B'
});

test('analyze: cell/style/formula/merged-cell counts on sheet2', () => {
  const { xl } = xlsxKit.analyze(buildParts());
  const s2 = xl.sheets.sheet2;
  assert.equal(s2.cellCount, 1);
  assert.equal(s2.formulas, 1);
  assert.equal(s2.mergedCells, 1);
  assert.equal(s2.usedStyles.size, 1);
  assert.ok(xl.styles.has('3'));
});

test('analyze: connectedPaths marks every path in a file that had any hit', () => {
  const { el, connectedPaths } = xlsxKit.analyze(buildParts());
  const workbookKeys = Object.keys(el).filter(k => k.startsWith('xl/workbook.xml::'));
  assert.ok(workbookKeys.length > 0);
  assert.ok(workbookKeys.every(k => connectedPaths.has(k)));
});

test('views.paths: File/Path/Count/Connected shape', () => {
  const result = xlsxKit.analyze(buildParts());
  const rows = xlsxKit.views.paths(result);
  const root = rows.find(r => r.File === 'xl/workbook.xml' && r.Path === 'workbook');
  assert.ok(root);
  assert.equal(root.Connected, 'Yes');
  assert.equal(root['Connection Type'], 'workbook');
});

test('views.connections: one row per sheet with resource usage', () => {
  const result = xlsxKit.analyze(buildParts());
  const rows = xlsxKit.views.connections(result);
  assert.equal(rows.length, 2);
  const sheet1 = rows.find(r => r.Sheet === 'sheet1');
  assert.equal(sheet1.Strings, 1);
  assert.equal(sheet1.Cells, 2);
  const sheet2 = rows.find(r => r.Sheet === 'sheet2');
  assert.equal(sheet2.Formulas, 1);
  assert.equal(sheet2['Merged Cells'], 1);
  assert.equal(sheet2['Calc Chain'], 1); // i="0" -> workbook index 0 -> Calc -> sheet2.xml
});

test('sheet identity: display name and workbook order come from workbook.xml', () => {
  const { xl } = xlsxKit.analyze(buildParts());
  // Part sheet1.xml is the SECOND sheet in the workbook, and it is called Data.
  assert.equal(xl.sheets.sheet1.name, 'Data');
  assert.equal(xl.sheets.sheet1.index, 1);
  assert.equal(xl.sheets.sheet1.sheetId, '7');
  assert.equal(xl.sheets.sheet2.name, 'Calc');
  assert.equal(xl.sheets.sheet2.index, 0);
});

test('sheet identity: resolution does not depend on part order', () => {
  const a = xlsxKit.analyze(buildParts({ order: 'natural' })).xl.sheets;
  const b = xlsxKit.analyze(buildParts({ order: 'reversed' })).xl.sheets;
  for (const key of ['sheet1', 'sheet2']) {
    assert.equal(a[key].name, b[key].name, key);
    assert.equal(a[key].index, b[key].index, key);
  }
});

test('sheet identity: a sheet part the workbook never claims gets a null name', () => {
  const parts = [...buildParts(), ['xl/worksheets/sheet9.xml', SHEET1]];
  const { xl } = xlsxKit.analyze(parts);
  assert.equal(xl.sheets.sheet9.name, null);
  assert.equal(xl.sheets.sheet9.index, null);
});

test('sheet identity: no <sheets> element at all falls back to part order', () => {
  const parts = buildParts().filter(([p]) => p !== 'xl/workbook.xml');
  const { xl } = xlsxKit.analyze(parts);
  assert.equal(xl.sheets.sheet1.index, 0);
  assert.equal(xl.sheets.sheet2.index, 1);
  assert.equal(xl.sheets.sheet1.name, null); // fallback names nothing it cannot read
});

test('views.connections: named ranges resolve by workbook index and display name', () => {
  const rows = xlsxKit.views.connections(xlsxKit.analyze(buildParts()));
  const data = rows.find(r => r.Sheet === 'sheet1');
  const calc = rows.find(r => r.Sheet === 'sheet2');
  // Data is found only through its display name, via the global defined name.
  assert.equal(data['Named Ranges'], 1);
  assert.equal(data.Name, 'Data');
  assert.equal(data.Order, 2);
  // Calc is found through localSheetId="0", the zero-based workbook index.
  assert.equal(calc['Named Ranges'], 1);
  assert.equal(calc.Order, 1);
});

test('analyze: an inlineStr cell keeps its text instead of resolving empty', () => {
  const INLINE = `<?xml version="1.0"?>
<worksheet xmlns="ws"><sheetData><row r="1">
  <c r="A1" t="inlineStr"><is><t>plain</t></is></c>
  <c r="B1" t="inlineStr"><is><r><t>rich </t></r><r><t>runs</t></r></is></c>
  <c r="C1"><v>5</v></c>
</row></sheetData></worksheet>`;
  const parts = buildParts().map(([p, x]) => p === 'xl/worksheets/sheet1.xml' ? [p, INLINE] : [p, x]);
  const [row] = xlsxKit.sheetRows(xlsxKit.analyze(parts).xl.sheets.sheet1);
  assert.deepEqual(row, { Row: 1, A: 'plain', B: 'rich runs', C: '5' });
});

test('views.files: Shared Strings and Calc Chain categorize despite mixed-case filenames', () => {
  const result = xlsxKit.analyze(buildParts());
  const rows = xlsxKit.views.files(result);
  const shared = rows.find(r => r.File === 'xl/sharedStrings.xml');
  const calc = rows.find(r => r.File === 'xl/calcChain.xml');
  assert.equal(shared.Category, 'Shared Strings');
  assert.equal(calc.Category, 'Calc Chain');
});

test('views.files: shared-strings row lists the sheets that actually used a string', () => {
  const result = xlsxKit.analyze(buildParts());
  const shared = xlsxKit.views.files(result).find(r => r.File === 'xl/sharedStrings.xml');
  assert.equal(shared['Sheets Touched'], 'sheet1'); // only sheet1 has a t="s" cell
});

test('views.unconnected: an orphan XML part with no recognized structure', () => {
  const parts = [
    ...buildParts(),
    ['xl/media/image1.emf', '<?xml version="1.0"?><blob xmlns="b"><stray/></blob>'],
  ];
  const result = xlsxKit.analyze(parts);
  const rows = xlsxKit.views.unconnected(result);
  assert.ok(rows.some(r => r.File === 'xl/media/image1.emf'));
});

test('summary: total/connected/unconnected add up', () => {
  const result = xlsxKit.analyze(buildParts());
  const s = xlsxKit.summary(result);
  assert.equal(s.total, Object.keys(result.el).length);
  assert.equal(s.connected + s.unconnected, s.total);
  assert.equal(s.connected, result.connectedPaths.size);
});

// ---- Power Query --------------------------------------------------------
//
// Built rather than committed: a real .xlsx with queries is a binary the tree
// does not need, and the interesting part is the header-plus-inner-zip layout,
// which is cheap to construct exactly. JSZip is vendored through bootstrap's
// KIT_IMPORTS, so this exercises the same lazy import the browser takes.

import JSZip from 'jszip';

const M_CODE = 'section Section1;\nshared Budget = let Source = Excel.CurrentWorkbook() in Source;';

// version (uint32 LE) + parts-zip length (uint32 LE) + the zip, base64'd into
// a <DataMashup> element, which is the shape Excel writes.
async function makeMashupXml({ declaredLength = null, trailing = 0 } = {}) {
  const inner = new JSZip();
  inner.file('Formulas/Section1.m', M_CODE);
  inner.file('Config/Package.xml', '<Package/>');
  const zipBytes = await inner.generateAsync({ type: 'uint8array' });
  const out = new Uint8Array(8 + zipBytes.length + trailing);
  const view = new DataView(out.buffer);
  view.setUint32(0, 3, true);
  view.setUint32(4, declaredLength ?? zipBytes.length, true);
  out.set(zipBytes, 8);
  let bin = '';
  for (const b of out) bin += String.fromCharCode(b);
  return `<?xml version="1.0"?><DataMashup xmlns="http://schemas.microsoft.com/DataMashup">${btoa(bin)}</DataMashup>`;
}

test('mashupPayload: reads the header and hands back the inner zip bytes', async () => {
  const xml = await makeMashupXml();
  const p = xlsxKit.mashupPayload(xml);
  assert.equal(p.version, 3);
  assert.equal(p.zip.length, p.declaredLength);
  assert.deepEqual([...p.zip.subarray(0, 2)], [0x50, 0x4b]); // "PK"
});

test('mashupPayload: trailing bytes past the declared length are cut off', async () => {
  const xml = await makeMashupXml({ trailing: 64 });
  const p = xlsxKit.mashupPayload(xml);
  assert.equal(p.zip.length, p.declaredLength); // not declaredLength + 64
});

test('mashupPayload: an impossible declared length falls back to the rest', async () => {
  const xml = await makeMashupXml({ declaredLength: 10 ** 7 });
  const p = xlsxKit.mashupPayload(xml);
  assert.ok(p.zip.length > 0);
  assert.notEqual(p.zip.length, 10 ** 7);
});

test('mashupPayload: no DataMashup element, and junk, both return null', () => {
  assert.equal(xlsxKit.mashupPayload('<root/>'), null);
  assert.equal(xlsxKit.mashupPayload('<DataMashup>!!!not base64!!!</DataMashup>'), null);
  assert.equal(xlsxKit.mashupPayload('<DataMashup>QUJD</DataMashup>'), null); // 3 bytes, no header
});

test('readMashup: recovers the M source from inside the two containers', async () => {
  const got = await xlsxKit.readMashup(await makeMashupXml());
  assert.equal(got.version, 3);
  assert.deepEqual(got.sections.map(s => s.path), ['Formulas/Section1.m']);
  assert.equal(got.sections[0].m, M_CODE);
});

test('readZip: a workbook carrying queries reports them under xl.powerQuery', async () => {
  const wb = new JSZip();
  for (const [path, xml] of buildParts()) wb.file(path, xml);
  wb.file('customXml/item1.xml', await makeMashupXml());
  const bytes = await wb.generateAsync({ type: 'uint8array' });
  const { xl } = await xlsxKit.readZip(bytes);
  assert.equal(xl.powerQuery.part, 'customXml/item1.xml');
  assert.equal(xl.powerQuery.sections[0].m, M_CODE);
  // The rest of the analysis is unaffected by the extra part.
  assert.equal(xl.sheets.sheet1.name, 'Data');
});

test('readZip: a workbook without queries leaves xl.powerQuery undefined', async () => {
  const wb = new JSZip();
  for (const [path, xml] of buildParts()) wb.file(path, xml);
  const { xl } = await xlsxKit.readZip(await wb.generateAsync({ type: 'uint8array' }));
  assert.equal(xl.powerQuery, undefined);
});

// ---- number formats -----------------------------------------------------

test('formatKind: classifies a code by what it makes a value mean', () => {
  const k = xlsxKit.formatKind;
  assert.equal(k('General'), 'general');
  assert.equal(k('@'), 'text');
  assert.equal(k('yyyy-mm-dd'), 'date');
  assert.equal(k('h:mm:ss'), 'time');
  assert.equal(k('m/d/yy h:mm'), 'datetime');
  assert.equal(k('0.00%'), 'percent');
  assert.equal(k('[h]:mm:ss'), 'duration'); // elapsed, not a clock reading
  assert.equal(k('#,##0.00'), 'number');
  assert.equal(k('$#,##0'), 'currency');
  assert.equal(k(null), 'general');
});

test('formatKind: literal text cannot be mistaken for a date token', () => {
  // The d in "day" and the m in "min" are text, not format tokens.
  assert.equal(xlsxKit.formatKind('"day "0'), 'number');
  assert.equal(xlsxKit.formatKind('0" min"'), 'number');
  // A bracketed colour is not evidence of anything either.
  assert.equal(xlsxKit.formatKind('[Red]#,##0'), 'number');
});

test('serialToDate: the 1900 leap-year bug, on both sides of the phantom day', () => {
  const iso = (d) => d.toISOString().slice(0, 10);
  assert.equal(iso(xlsxKit.serialToDate(1)), '1900-01-01');   // before: corrected
  assert.equal(iso(xlsxKit.serialToDate(59)), '1900-02-28');  // last corrected day
  assert.equal(iso(xlsxKit.serialToDate(61)), '1900-03-01');  // after: linear
  assert.equal(iso(xlsxKit.serialToDate(25569)), '1970-01-01'); // the JS epoch
  assert.equal(iso(xlsxKit.serialToDate(45000)), '2023-03-15');
});

test('serialToDate: the 1904 epoch shifts everything by four years and a day', () => {
  assert.equal(xlsxKit.serialToDate(0, true).toISOString().slice(0, 10), '1904-01-01');
  assert.equal(xlsxKit.serialToDate(1, true).toISOString().slice(0, 10), '1904-01-02');
});

test('cellFormat: a cell style resolves through cellXfs to a code and a kind', () => {
  const { xl } = xlsxKit.analyze(buildParts());
  assert.equal(xlsxKit.cellFormat(xl, '2').code, 'yyyy\\-mm\\-dd'); // custom
  assert.equal(xlsxKit.cellFormat(xl, '2').kind, 'date');
  assert.equal(xlsxKit.cellFormat(xl, '1').code, 'mm-dd-yy');       // built in
  assert.equal(xlsxKit.cellFormat(xl, '4').kind, 'percent');
  assert.equal(xlsxKit.cellFormat(xl, '6').kind, 'text');
  assert.equal(xlsxKit.cellFormat(xl, null), null);                 // unstyled
});

test('sheetRows: formats are applied only when the workbook is passed', () => {
  const DATED = `<?xml version="1.0"?>
<worksheet xmlns="ws"><sheetData><row r="1">
  <c r="A1" s="1"><v>45000</v></c>
  <c r="B1" s="4"><v>0.125</v></c>
  <c r="C1" s="5"><v>45000.5</v></c>
  <c r="D1"><v>45000</v></c>
</row></sheetData></worksheet>`;
  const parts = buildParts().map(([p, x]) => p === 'xl/worksheets/sheet1.xml' ? [p, DATED] : [p, x]);
  const { xl } = xlsxKit.analyze(parts);
  assert.deepEqual(xlsxKit.sheetRows(xl.sheets.sheet1), // raw, the old behaviour
    [{ Row: 1, A: '45000', B: '0.125', C: '45000.5', D: '45000' }]);
  // THE FORMAT CODE IS FOLLOWED, not merely classified. Before 2026-09-04 this
  // read `2023-03-15`, `12.5%` and `2023-03-15 12:00:00`: the kind was right
  // and the drawing was ISO, on the argument that an unambiguous date beats an
  // approximation of Excel's. The three below are what Excel actually draws
  // for ids 14, 9 and 22, which is the point of a sheet render.
  assert.deepEqual(xlsxKit.sheetRows(xl.sheets.sheet1, xl),
    [{ Row: 1, A: '03-15-23', B: '13%', C: '3/15/23 12:00', D: '45000' }]);
  // D carries no style, so it stays a number even under formatting. That is
  // the file's answer, not a fallback.
  // B rounds: 0.125 under `0%` is 13%, in the workbook and here. The stored
  // value is not lost, it is what sheetLayout hands back as the cell's `raw`.
});

test('formatValue: a non-numeric value under a date format is left alone', () => {
  const fmt = { kind: 'date', code: 'yyyy-mm-dd' };
  assert.equal(xlsxKit.formatValue('not a number', fmt), 'not a number');
  assert.equal(xlsxKit.formatValue('', fmt), '');
});

test('analyze: malformed XML in one part is skipped, not fatal', () => {
  const parts = [...buildParts(), ['xl/broken.xml', '<not><valid'] ];
  assert.doesNotThrow(() => xlsxKit.analyze(parts));
});

// ---------------------------------------------------------------------------
// Appearance: styles.xml beyond the number format, sheet geometry, and the
// layout that joins them. Added 2026-09-04 with the sheet render.
// ---------------------------------------------------------------------------

// A form, in miniature: a merged banded title across A1:C1, a gray input box,
// a bold label, a theme-coloured fill and a currency column. The theme part
// carries the `a:` prefix a real workbook writes, which is the whole reason
// the kit matches on local names.
const THEME = `<?xml version="1.0"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:themeElements><a:clrScheme name="Office">
    <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
    <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
    <a:dk2><a:srgbClr val="44546A"/></a:dk2>
    <a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
    <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
  </a:clrScheme></a:themeElements>
</a:theme>`;

const FORM_STYLES = `<?xml version="1.0"?>
<styleSheet xmlns="s">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/></numFmts>
  <fonts count="3">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><i/><sz val="9"/><color theme="1"/><name val="Arial"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF44546A"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor theme="0" tint="-0.15"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/></border>
    <border><left style="thin"><color rgb="FF000000"/></left><right style="thin"/><top style="medium"/><bottom/></border>
  </borders>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFill="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" applyFill="1" applyBorder="1"><alignment indent="2"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0"/>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="0" applyFill="0"/>
  </cellXfs>
</styleSheet>`;

// Row 1 is the merged title band and is 40pt tall. Row 2 declares ht without
// customHeight, so the sheet default wins. Row 3 is hidden. Column A is wide,
// column C is hidden, and the sheet is frozen below its title.
const FORM_SHEET = `<?xml version="1.0"?>
<worksheet xmlns="ws">
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="30" customWidth="1"/>
    <col min="3" max="3" width="9" hidden="1"/>
  </cols>
  <sheetViews><sheetView><pane xSplit="1" ySplit="1" state="frozen"/></sheetView></sheetViews>
  <sheetData>
    <row r="1" ht="40" customHeight="1">
      <c r="A1" s="1" t="inlineStr"><is><t>Facility Request</t></is></c>
      <c r="B1" s="1"/><c r="C1" s="1"/>
    </row>
    <row r="2" ht="99">
      <c r="A2" s="2" t="inlineStr"><is><t>Annual cost</t></is></c>
      <c r="B2" s="3"><v>1234.5</v></c>
    </row>
    <row r="3" hidden="1"><c r="A3" t="inlineStr"><is><t>scratch</t></is></c></row>
    <row r="5"><c r="B5" s="4" t="inlineStr"><is><t>note</t></is></c></row>
  </sheetData>
  <mergeCells count="1"><mergeCell ref="A1:C1"/></mergeCells>
</worksheet>`;

const FORM_WORKBOOK = `<?xml version="1.0"?>
<workbook xmlns="wb" xmlns:r="rel">
  <sheets><sheet name="Form" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const FORM_RELS = `<?xml version="1.0"?>
<Relationships xmlns="rel">
  <Relationship Id="rId1" Type=".../worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

// Reversed on purpose: theme1.xml is walked LAST, so any colour resolved
// during the walk rather than in finalize() comes out null.
const formParts = ({ reversed = false } = {}) => {
  const entries = [
    ['xl/theme/theme1.xml', THEME],
    ['xl/workbook.xml', FORM_WORKBOOK],
    ['xl/_rels/workbook.xml.rels', FORM_RELS],
    ['xl/styles.xml', FORM_STYLES],
    ['xl/worksheets/sheet1.xml', FORM_SHEET],
  ];
  return reversed ? entries.reverse() : entries;
};

const formXl = (opts) => xlsxKit.analyze(formParts(opts)).xl;

test('theme colours resolve whatever order the parts are walked in', () => {
  for (const reversed of [false, true]) {
    const xl = formXl({ reversed });
    // clrScheme order is dk1, lt1, dk2, lt2, accent1; Excel's indices swap the
    // first two pairs, so theme 0 is lt1 (white) and theme 1 is dk1 (black).
    assert.equal(xl.theme[0], '#ffffff', `theme 0, reversed=${reversed}`);
    assert.equal(xl.theme[1], '#000000', `theme 1, reversed=${reversed}`);
    assert.equal(xl.theme[2], '#e7e6e6', `theme 2, reversed=${reversed}`);
    assert.equal(xl.theme[3], '#44546a', `theme 3, reversed=${reversed}`);
    // The gray band every OFM form is ruled with: white tinted -0.15.
    assert.equal(xl.fills[3], '#d9d9d9', `tinted fill, reversed=${reversed}`);
  }
});

test('fills: only a solid pattern is a colour, and it reads fgColor', () => {
  const xl = formXl();
  assert.equal(xl.fills[0], null, 'patternType none is no fill');
  assert.equal(xl.fills[1], null, 'gray125 is Excel default furniture, not a choice');
  assert.equal(xl.fills[2], '#44546a', 'solid takes fgColor, not the indexed=64 bgColor');
});

test('cellStyle joins the four records a cell s names', () => {
  const xl = formXl();
  const title = xlsxKit.cellStyle(xl, 1);
  assert.equal(title.bold, true);
  assert.equal(title.size, 14);
  assert.equal(title.color, '#ffffff');
  assert.equal(title.fill, '#44546a');
  assert.equal(title.align, 'center');
  assert.equal(title.valign, 'center');
  assert.equal(title.wrap, true);

  const input = xlsxKit.cellStyle(xl, 2);
  assert.equal(input.fill, '#d9d9d9');
  assert.equal(input.indent, 2);
  assert.equal(input.border.left.style, 'thin');
  assert.equal(input.border.top.style, 'medium');
  assert.equal(input.border.bottom, null, 'an edge with no style is not a border');

  assert.equal(xlsxKit.cellStyle(xl, null), null, 'no style index is no record');
});

test('applyFill="0" means inherit, so the named fill is not painted', () => {
  const xl = formXl();
  // xf 4 names fillId 3 and switches it off. Reading fillId without the switch
  // paints a gray box behind a note that Excel leaves clear.
  assert.equal(xlsxKit.cellStyle(xl, 4).fill, null);
  assert.equal(xlsxKit.cellStyle(xl, 4).italic, true, 'the font still applies');
});

test('sheet geometry: widths, heights, merges, freeze', () => {
  const sheet = formXl().sheets.sheet1;
  assert.deepEqual(sheet.merges, [{ r1: 1, c1: 0, r2: 1, c2: 2 }]);
  assert.deepEqual(sheet.freeze, { x: 1, y: 1 });
  assert.equal(sheet.defaultRowHeight, 18);
  assert.deepEqual(sheet.cols.map(c => [c.min, c.max, c.width, c.hidden]),
    [[1, 1, 30, false], [3, 3, 9, true]]);
  const byRow = Object.fromEntries(sheet.rows.map(r => [r.row, r]));
  assert.equal(byRow[1].height, 40, 'customHeight="1" pins the row');
  assert.equal(byRow[2].height, null, 'ht without customHeight is Excel measuring, not the author');
  assert.equal(byRow[3].hidden, true);
});

test('sheetLayout: merges become spans and cover the cells beneath them', () => {
  const xl = formXl();
  const out = xlsxKit.sheetLayout(xl.sheets.sheet1, xl);
  const row1 = out.rows.find(r => r.row === 1);
  assert.equal(row1.cells.length, 1, 'B1 and C1 are covered by the merge, not emitted');
  assert.equal(row1.cells[0].colSpan, 3);
  assert.equal(row1.cells[0].rowSpan, 1);
  assert.equal(row1.cells[0].text, 'Facility Request');
  assert.equal(row1.height, Math.round(40 * 4 / 3), 'points to pixels');
});

test('sheetLayout: a hidden row is dropped and a missing row still holds its place', () => {
  const xl = formXl();
  const out = xlsxKit.sheetLayout(xl.sheets.sheet1, xl);
  const numbers = out.rows.map(r => r.row);
  assert.deepEqual(numbers, [1, 2, 4, 5],
    'row 3 is hidden; row 4 is absent from the file and still drawn, so the gutter stays true');
  assert.equal(out.rows.find(r => r.row === 2).height, Math.round(18 * 4 / 3),
    'a row without a custom height follows sheetFormatPr');
});

test('sheetLayout: column widths come from the file, and a hidden column is zero', () => {
  const xl = formXl();
  const { cols } = xlsxKit.sheetLayout(xl.sheets.sheet1, xl);
  assert.equal(cols.length, 3);
  assert.equal(cols[0].width, Math.round(30 * 7) + 5);
  assert.equal(cols[1].width, Math.round(8.43 * 7) + 5, 'no <col> means the Excel default');
  assert.equal(cols[2].width, 0, 'hidden');
});

test('sheetLayout: alignment follows the value, and the stored number rides along', () => {
  const xl = formXl();
  const out = xlsxKit.sheetLayout(xl.sheets.sheet1, xl);
  const row2 = out.rows.find(r => r.row === 2);
  const [label, amount] = row2.cells;
  assert.equal(label.numeric, false, 'an inline string is text however it looks');
  assert.equal(amount.numeric, true);
  assert.equal(amount.text, '$1,234.50', 'the custom currency code is applied');
  assert.equal(amount.raw, '1234.5', 'the stored value, because the drawn one is not it');
  assert.equal(label.raw, null, 'nothing to carry where the drawing is the value');
});

test('sheetLayout: an oversized sheet stops at the cap and says where', () => {
  const rows = Array.from({ length: 40 }, (_, i) =>
    `<row r="${i + 1}"><c r="A${i + 1}"><v>${i}</v></c><c r="B${i + 1}"><v>${i}</v></c></row>`).join('');
  const big = `<?xml version="1.0"?><worksheet xmlns="ws"><sheetData>${rows}</sheetData></worksheet>`;
  const parts = formParts().map(([p, x]) => p === 'xl/worksheets/sheet1.xml' ? [p, big] : [p, x]);
  const { xl } = xlsxKit.analyze(parts);
  const out = xlsxKit.sheetLayout(xl.sheets.sheet1, xl, { maxRows: 10 });
  assert.equal(out.rows.length, 10);
  assert.deepEqual(out.truncated, { fromRow: 11, lastRow: 40, reason: 'rows' });

  const byCells = xlsxKit.sheetLayout(xl.sheets.sheet1, xl, { maxCells: 9 });
  assert.equal(byCells.truncated.reason, 'cells');
  assert.ok(byCells.rows.length < 40);

  assert.equal(xlsxKit.sheetLayout(xl.sheets.sheet1, xl).truncated, null,
    'under the default cap nothing is withheld');
});

test('sheetLayout: an empty sheet says so rather than drawing a grid of nothing', () => {
  const blank = `<?xml version="1.0"?><worksheet xmlns="ws"><sheetData/></worksheet>`;
  const parts = formParts().map(([p, x]) => p === 'xl/worksheets/sheet1.xml' ? [p, blank] : [p, x]);
  const { xl } = xlsxKit.analyze(parts);
  const out = xlsxKit.sheetLayout(xl.sheets.sheet1, xl);
  assert.equal(out.empty, true);
  assert.deepEqual(out.rows, []);
});

test('number formats: the codes a budget workbook actually carries', () => {
  const at = (code, value) => xlsxKit.formatValue(String(value), { kind: xlsxKit.formatKind(code, 0), code });
  assert.equal(at('#,##0', 1234.5), '1,235', 'no decimal places means rounded, as Excel draws it');
  assert.equal(at('#,##0.00', 1234.5), '1,234.50');
  assert.equal(at('"$"#,##0.00', 1234.5), '$1,234.50');
  assert.equal(at('0.0%', 0.1256), '12.6%');
  assert.equal(at('0', 42), '42');
  assert.equal(at('0.00', 42), '42.00');
  // An accounting code's negative section supplies its own notation, so the
  // minus is NOT prefixed on top of the parentheses.
  assert.equal(at('#,##0_);(#,##0)', -1234), '(1,234)');
  assert.equal(at('#,##0', -1234), '-1,234', 'with no negative section, a minus');
  assert.equal(at('#,##0;[Red](#,##0)', -1234), '(1,234)');
  // A zero section is its own answer.
  assert.equal(at('#,##0;(#,##0);"-"', 0), '-');
});

test('number formats: literals, padding and fill characters', () => {
  const at = (code, value) => xlsxKit.formatValue(String(value), { kind: xlsxKit.formatKind(code, 0), code });
  assert.equal(at('0" FTE"', 3), '3 FTE');
  assert.equal(at('#,##0\\%', 5), '5%', 'an escaped percent is a literal, not a scale');
  assert.equal(at('0%', 0.05), '5%', 'an unescaped one scales');
  // _( reserves the width of a bracket and *  repeats a fill character. Neither
  // survives into a browser cell, and dropping them is what keeps an
  // accounting code from printing its own punctuation.
  assert.equal(at('_("$"* #,##0.00_)', 12.5), '$12.50');
});

test('date formats: the m that is a minute', () => {
  const at = (code, serial) => xlsxKit.formatValue(String(serial), { kind: xlsxKit.formatKind(code, 0), code });
  assert.equal(at('m/d/yy h:mm', 45000.5), '3/15/23 12:00');
  assert.equal(at('mm-dd-yy', 45000), '03-15-23');
  assert.equal(at('d-mmm-yy', 45000), '15-Mar-23');
  assert.equal(at('mmmm d, yyyy', 45000), 'March 15, 2023');
  assert.equal(at('h:mm:ss', 45000.5), '12:00:00');
  assert.equal(at('mm:ss', 45000.5), '00:00', 'both are time here, since ss follows');
  assert.equal(at('dddd', 45000), 'Wednesday');
  assert.equal(at('yyyy"-"mm', 45000), '2023-03', 'a quoted literal is not a token');
});

test('shared strings: a rich or empty entry still holds its index', () => {
  // Four entries: plain, RICH (runs, no bare <t>), EMPTY, plain. A reader that
  // drops either of the middle two shifts every index after it, and the sheet
  // then draws real text in the wrong cells rather than blanks. Found in the
  // OFM decision package addendum, which has 6 rich entries among 163.
  const SS = `<?xml version="1.0"?>
<sst xmlns="sst">
  <si><t>first</t></si>
  <si><r><rPr><b/></rPr><t>Section </t></r><r><t>One</t></r></si>
  <si><t/></si>
  <si><t>last</t></si>
</sst>`;
  const SHEET = `<?xml version="1.0"?>
<worksheet xmlns="ws"><sheetData><row r="1">
  <c r="A1" t="s"><v>0</v></c>
  <c r="B1" t="s"><v>1</v></c>
  <c r="C1" t="s"><v>2</v></c>
  <c r="D1" t="s"><v>3</v></c>
</row></sheetData></worksheet>`;
  const parts = buildParts().map(([p, x]) =>
    p === 'xl/sharedStrings.xml' ? [p, SS] : p === 'xl/worksheets/sheet1.xml' ? [p, SHEET] : [p, x]);
  const { xl } = xlsxKit.analyze(parts);
  assert.equal(xl.strings.length, 4, 'four <si> elements are four entries');
  assert.deepEqual(xlsxKit.sheetRows(xl.sheets.sheet1),
    [{ Row: 1, A: 'first', B: 'Section One', C: '', D: 'last' }]);
});

test('shared strings: a phonetic hint is not part of the value', () => {
  const SS = `<?xml version="1.0"?>
<sst xmlns="sst"><si><t>東京</t><rPh sb="0" eb="2"><t>トウキョウ</t></rPh></si></sst>`;
  const SHEET = `<?xml version="1.0"?>
<worksheet xmlns="ws"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>`;
  const parts = buildParts().map(([p, x]) =>
    p === 'xl/sharedStrings.xml' ? [p, SS] : p === 'xl/worksheets/sheet1.xml' ? [p, SHEET] : [p, x]);
  const { xl } = xlsxKit.analyze(parts);
  assert.deepEqual(xlsxKit.sheetRows(xl.sheets.sheet1), [{ Row: 1, A: '東京' }]);
});

// ---------------------------------------------------------------------------
// The three things a sheet carries beside its cells: pictures anchored over
// the grid, rules that repaint a cell, and the form's own notes on its inputs.
// ---------------------------------------------------------------------------

const CF_DV_STYLES = `<?xml version="1.0"?>
<styleSheet xmlns="s">
  <fonts count="1"><font><sz val="11"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellXfs>
  <dxfs count="2">
    <dxf>
      <font><b/><i val="0"/><color rgb="FFFFFFFF"/></font>
      <fill><patternFill><bgColor rgb="FFFF0000"/></patternFill></fill>
    </dxf>
    <dxf><font><color rgb="FF006100"/></font></dxf>
  </dxfs>
</styleSheet>`;

test('a dxf reads its fill from bgColor, and val="0" turns a font switch off', () => {
  const parts = formParts().map(([p, x]) => p === 'xl/styles.xml' ? [p, CF_DV_STYLES] : [p, x]);
  const { xl } = xlsxKit.analyze(parts);
  const red = xlsxKit.dxfStyle(xl, 0);
  assert.equal(red.fill, '#ff0000', 'a differential fill is bgColor, the opposite of a cell fill');
  assert.equal(red.bold, true);
  assert.equal(red.italic, undefined, '<i val="0"/> is italic OFF, not italic present');
  assert.equal(red.color, '#ffffff');
  // A dxf that sets only a colour must not carry a fill, or it would paint the
  // cell's own background away.
  assert.deepEqual(xlsxKit.dxfStyle(xl, 1), { color: '#006100' });
  assert.equal(xlsxKit.dxfStyle(xl, 9), null, 'an id the workbook does not have');
});

test('cfApplies: the rule types that are decidable from the cell alone', () => {
  const cell = (text, raw) => ({ text, raw: raw ?? text });
  const rule = (o) => ({ type: 'cellIs', operator: '', formulas: [], text: '', ...o });

  assert.equal(xlsxKit.cfApplies(rule({ operator: 'lessThan', formulas: ['0'] }), cell('-4', '-4')), true);
  assert.equal(xlsxKit.cfApplies(rule({ operator: 'lessThan', formulas: ['0'] }), cell('0', '0')), false,
    'zero is not less than zero, which is why the OFM addendum draws no red on a blank form');
  assert.equal(xlsxKit.cfApplies(rule({ operator: 'greaterThanOrEqual', formulas: ['10'] }), cell('10', '10')), true);
  assert.equal(xlsxKit.cfApplies(rule({ operator: 'between', formulas: ['5', '1'] }), cell('3', '3')), true,
    'a reversed pair is still a range');
  assert.equal(xlsxKit.cfApplies(rule({ operator: 'equal', formulas: ['"Yes"'] }), cell('Yes')), true);

  assert.equal(xlsxKit.cfApplies(rule({ type: 'containsBlanks' }), cell('')), true);
  assert.equal(xlsxKit.cfApplies(rule({ type: 'containsText', text: 'fee' }), cell('Docket fee')), true);
  assert.equal(xlsxKit.cfApplies(rule({ type: 'beginsWith', text: 'RCW' }), cell('RCW 2.32.070')), true);
  assert.equal(xlsxKit.cfApplies(rule({ type: 'endsWith', text: 'x' }), cell('RCW 2.32.070')), false);

  // NOT DECIDABLE, and null rather than false: a formula needs an engine, and a
  // rule silently treated as not firing is a rule reported as evaluated.
  assert.equal(xlsxKit.cfApplies(rule({ type: 'expression', formulas: ['$A1=""'] }), cell('x')), null);
  assert.equal(xlsxKit.cfApplies(rule({ type: 'colorScale' }), cell('5')), null);
  assert.equal(xlsxKit.cfApplies(rule({ operator: 'lessThan', formulas: ['$B$2'] }), cell('1', '1')), null,
    'a reference is not a constant this can compare against');
});

const cfSheet = (cf, cells) => `<?xml version="1.0"?>
<worksheet xmlns="ws"><sheetData><row r="1">${cells}</row></sheetData>${cf}</worksheet>`;

test('the highest-priority rule that fires wins, and skipped rules are counted once', () => {
  const cf = `<conditionalFormatting sqref="A1:C1">
      <cfRule type="expression" dxfId="1" priority="1"><formula>$A1&gt;0</formula></cfRule>
      <cfRule type="cellIs" dxfId="0" priority="2" operator="lessThan"><formula>0</formula></cfRule>
    </conditionalFormatting>`;
  const parts = formParts().map(([p, x]) =>
    p === 'xl/styles.xml' ? [p, CF_DV_STYLES]
      : p === 'xl/worksheets/sheet1.xml'
        ? [p, cfSheet(cf, '<c r="A1"><v>-5</v></c><c r="B1"><v>5</v></c><c r="C1"><v>-1</v></c>')]
        : [p, x]);
  const { xl } = xlsxKit.analyze(parts);
  const out = xlsxKit.sheetLayout(xl.sheets.sheet1, xl);
  const [a, b, c] = out.rows[0].cells;
  assert.equal(a.cf, 0, 'the expression above it is undecidable, so the cellIs rule decides');
  assert.equal(b.cf, null, '5 is not less than 0');
  assert.equal(c.cf, 0);
  assert.equal(out.cfSkipped, 1, 'one expression rule over three cells is one gap, not three');
});

test('validation notes: an inline list, a range list, and an input message', () => {
  const dv = `<dataValidations count="3">
      <dataValidation type="list" sqref="A1" ><formula1>"Bill,Budget,None"</formula1></dataValidation>
      <dataValidation type="list" sqref="B1"><formula1>$D$1:$D$3</formula1></dataValidation>
      <dataValidation sqref="C1" promptTitle="Fee Code" prompt="Enter the four digit code._x000a_See the inventory."/>
    </dataValidations>`;
  const sheet = `<?xml version="1.0"?>
<worksheet xmlns="ws"><sheetData>
  <row r="1"><c r="A1"/><c r="B1"/><c r="C1"/><c r="D1" t="inlineStr"><is><t>Alpha</t></is></c></row>
  <row r="2"><c r="D2" t="inlineStr"><is><t>Beta</t></is></c></row>
  <row r="3"><c r="D3" t="inlineStr"><is><t>Gamma</t></is></c></row>
</sheetData>${dv}</worksheet>`;
  const parts = formParts().map(([p, x]) => p === 'xl/worksheets/sheet1.xml' ? [p, sheet] : [p, x]);
  const { xl } = xlsxKit.analyze(parts);
  const [a, b, c] = xlsxKit.sheetLayout(xl.sheets.sheet1, xl).rows[0].cells;
  assert.deepEqual(a.note.options, ['Bill', 'Budget', 'None']);
  assert.deepEqual(b.note.options, ['Alpha', 'Beta', 'Gamma'], 'a range list is read out of the sheet');
  assert.equal(c.note.options, null);
  assert.equal(c.note.title, 'Fee Code');
  assert.equal(c.note.prompt, 'Enter the four digit code.\nSee the inventory.',
    '_x000a_ is a newline Excel could not write literally, not text');
});

test('a validation that says nothing leaves no note', () => {
  const dv = `<dataValidations><dataValidation type="textLength" operator="lessThan" sqref="A1"><formula1>50</formula1></dataValidation></dataValidations>`;
  const sheet = `<?xml version="1.0"?>
<worksheet xmlns="ws"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>x</t></is></c></row></sheetData>${dv}</worksheet>`;
  const parts = formParts().map(([p, x]) => p === 'xl/worksheets/sheet1.xml' ? [p, sheet] : [p, x]);
  const { xl } = xlsxKit.analyze(parts);
  assert.equal(xlsxKit.sheetLayout(xl.sheets.sheet1, xl).rows[0].cells[0].note, undefined);
});

// A picture anchored from B2 to D4, wrapped the way Excel writes it: the same
// anchor in mc:Choice and again in mc:Fallback.
const DRAWING = `<?xml version="1.0"?>
<xdr:wsDr xmlns:xdr="xdr" xmlns:a="a" xmlns:mc="mc" xmlns:r="rel">
  <mc:AlternateContent>
    <mc:Choice Requires="a14">
      <xdr:twoCellAnchor>
        <xdr:from><xdr:col>1</xdr:col><xdr:colOff>19050</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>9525</xdr:rowOff></xdr:from>
        <xdr:to><xdr:col>3</xdr:col><xdr:colOff>28575</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
        <xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo"/></xdr:nvPicPr>
          <xdr:blipFill><a:blip r:embed="rId1"/></xdr:blipFill></xdr:pic>
      </xdr:twoCellAnchor>
    </mc:Choice>
    <mc:Fallback>
      <xdr:twoCellAnchor>
        <xdr:from><xdr:col>1</xdr:col><xdr:colOff>19050</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>9525</xdr:rowOff></xdr:from>
        <xdr:to><xdr:col>3</xdr:col><xdr:colOff>28575</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
        <xdr:pic><xdr:nvPicPr><xdr:cNvPr id="3" name="Logo fallback"/></xdr:nvPicPr>
          <xdr:blipFill><a:blip r:embed="rId1"/></xdr:blipFill></xdr:pic>
      </xdr:twoCellAnchor>
    </mc:Fallback>
  </mc:AlternateContent>
</xdr:wsDr>`;

const DRAWING_RELS = `<?xml version="1.0"?>
<Relationships xmlns="rel">
  <Relationship Id="rId1" Type=".../image" Target="../media/image1.png"/>
</Relationships>`;

const SHEET_RELS = `<?xml version="1.0"?>
<Relationships xmlns="rel">
  <Relationship Id="rIdD" Type=".../drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`;

// 12 columns of 10 chars and a bare grid, so the arithmetic below is legible.
const PIC_SHEET = `<?xml version="1.0"?>
<worksheet xmlns="ws" xmlns:r="rel">
  <sheetFormatPr defaultRowHeight="15"/>
  <cols><col min="1" max="12" width="10"/></cols>
  <sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>top</t></is></c></row></sheetData>
  <drawing r:id="rIdD"/>
</worksheet>`;

const picParts = (sheetXml = PIC_SHEET) => [
  ...formParts().filter(([p]) => p !== 'xl/worksheets/sheet1.xml'),
  ['xl/worksheets/sheet1.xml', sheetXml],
  ['xl/worksheets/_rels/sheet1.xml.rels', SHEET_RELS],
  ['xl/drawings/drawing1.xml', DRAWING],
  ['xl/drawings/_rels/drawing1.xml.rels', DRAWING_RELS],
];

const withMedia = (xl) => { xl.media['xl/media/image1.png'] = 'data:image/png;base64,AAAA'; return xl; };

test('a picture is read once, from mc:Choice, and joined to its media two hops out', () => {
  const { xl } = xlsxKit.analyze(picParts());
  const sheet = xl.sheets.sheet1;
  assert.equal(sheet.images.length, 1,
    'Excel writes the same anchor in Choice and Fallback; taking both draws the logo twice');
  assert.equal(sheet.images[0].part, 'xl/media/image1.png',
    "a blip's r:embed resolves through the DRAWING's rels, not the sheet's");
  assert.equal(sheet.images[0].name, 'Logo');
});

test('a picture is placed as an offset from a cell, not from the sheet', () => {
  const { xl } = xlsxKit.analyze(picParts());
  withMedia(xl);
  const out = xlsxKit.sheetLayout(xl.sheets.sheet1, xl);
  assert.equal(out.images.length, 1);
  const img = out.images[0];
  assert.equal(img.row, 2, 'the anchor row is zero-based in the file and one-based here');
  assert.equal(img.col, 1);
  assert.equal(img.dx, 2, '19050 EMU is two pixels at 9525 to the pixel');
  assert.equal(img.dy, 1);
  // Columns are 10 chars wide -> 75px; the picture spans B and C, less its own
  // offset, plus the far corner's.
  assert.equal(img.width, 75 * 2 - 2 + 3);
  assert.equal(img.height, 20 * 2 - 1 + 0, 'rows are 15pt -> 20px');
  assert.equal(img.src, 'data:image/png;base64,AAAA');
});

test('a picture below the last row of data still draws', () => {
  // The capital Major Project report keeps its photographs on a tab with one
  // text cell and the pictures below it. Stopping the layout at the last row
  // holding a value dropped every one of them.
  const { xl } = xlsxKit.analyze(picParts());
  withMedia(xl);
  const out = xlsxKit.sheetLayout(xl.sheets.sheet1, xl);
  assert.ok(out.rows.length >= 4, 'the drawn range reaches the anchor, not just the data');
  assert.equal(out.images.length, 1);
});

test('a picture anchored inside a merge moves to the cell that is drawn', () => {
  const merged = PIC_SHEET.replace('</sheetData>',
    '</sheetData><mergeCells count="1"><mergeCell ref="A1:C3"/></mergeCells>');
  const { xl } = xlsxKit.analyze(picParts(merged));
  withMedia(xl);
  const img = xlsxKit.sheetLayout(xl.sheets.sheet1, xl).images[0];
  // B2 is covered by A1:C3 and is never emitted, so the picture rides on A1
  // with the distance to B2 added to its offset.
  assert.equal(img.row, 1);
  assert.equal(img.col, 0);
  assert.equal(img.dx, 2 + 75, 'one column across');
  assert.equal(img.dy, 1 + 20, 'one row down');
});

test('a picture whose media the workbook does not carry is skipped, not drawn broken', () => {
  const { xl } = xlsxKit.analyze(picParts());   // no media attached
  assert.deepEqual(xlsxKit.sheetLayout(xl.sheets.sheet1, xl).images, []);
});

// ---------------------------------------------------------------------------
// Comments: the fourth thing a sheet carries, and the only one a reader wrote
// by hand. Legacy (non-threaded) comments, which is what OFM's templates use.
// ---------------------------------------------------------------------------

// Two authors, and the text run Excel actually writes: the author's name, a
// colon and a newline, then the comment. authorId indexes the <authors> list.
const COMMENTS = `<?xml version="1.0"?>
<comments xmlns="c">
  <authors><author>slm4303</author><author>Shields, Sharon (OFM)</author></authors>
  <commentList>
    <comment ref="B2" authorId="0"><text>
      <r><rPr><b/></rPr><t xml:space="preserve">slm4303:</t></r>
      <r><t xml:space="preserve">
input the hours anticipated</t></r>
    </text></comment>
    <comment ref="C3" authorId="1"><text>
      <r><t>Hint: include sales tax</t></r>
    </text></comment>
  </commentList>
</comments>`;

// The comments part rides a relationship with NOTHING in the sheet XML naming
// it: <legacyDrawing> points at the VML that draws Excel's red corner, and the
// comments themselves are reached by walking the sheet's rels.
const COMMENT_RELS = `<?xml version="1.0"?>
<Relationships xmlns="rel">
  <Relationship Id="rIdV" Type=".../vmlDrawing" Target="../drawings/vmlDrawing1.vml"/>
  <Relationship Id="rIdC" Type=".../comments" Target="../comments3.xml"/>
</Relationships>`;

const COMMENT_SHEET = `<?xml version="1.0"?>
<worksheet xmlns="ws" xmlns:r="rel">
  <sheetData>
    <row r="2"><c r="B2"><v>5000</v></c></row>
    <row r="3"><c r="C3" t="inlineStr"><is><t>220</t></is></c></row>
  </sheetData>
  <legacyDrawing r:id="rIdV"/>
</worksheet>`;

const commentParts = (extra = []) => [
  ...formParts().filter(([p]) => p !== 'xl/worksheets/sheet1.xml'),
  ['xl/worksheets/sheet1.xml', COMMENT_SHEET],
  ['xl/worksheets/_rels/sheet1.xml.rels', COMMENT_RELS],
  ['xl/comments3.xml', COMMENTS],
  ...extra,
];

test('a comments part is found by walking the rels, not by matching sheet numbers', () => {
  // comments3.xml on sheet1 is the case that breaks a numbering assumption, and
  // it is what the OneWA template does: the parts are numbered by creation
  // order, not by the sheet they belong to.
  const { xl } = xlsxKit.analyze(commentParts());
  const cs = xl.sheets.sheet1.comments;
  assert.equal(cs.length, 2);
  assert.deepEqual(cs.map(c => c.ref), ['B2', 'C3']);
  assert.equal(cs[0].author, 'slm4303');
  assert.equal(cs[1].author, 'Shields, Sharon (OFM)', 'authorId indexes the authors list');
});

test('the author prefix Excel writes into the text is not repeated in it', () => {
  const { xl } = xlsxKit.analyze(commentParts());
  const [first, second] = xl.sheets.sheet1.comments;
  assert.equal(first.text, 'input the hours anticipated',
    'Excel writes "Name:\\n" as the first run, and the author field already says it');
  assert.equal(second.text, 'Hint: include sales tax',
    'a comment typed without the prefix keeps every word, colon included');
});

test('a comment reaches the cell it sits on, and outranks the form\'s own note', () => {
  const dv = '<dataValidations><dataValidation sqref="B2" promptTitle="Hours" prompt="Enter hours."/></dataValidations>';
  const parts = commentParts().map(([p, x]) =>
    p === 'xl/worksheets/sheet1.xml' ? [p, x.replace('<legacyDrawing', dv + '<legacyDrawing')] : [p, x]);
  const { xl } = xlsxKit.analyze(parts);
  const out = xlsxKit.sheetLayout(xl.sheets.sheet1, xl);
  // A row carries only the cells it has, so B2 is that row's first cell.
  const b2 = out.rows.find(r => r.row === 2).cells.find(c => c.col === 1);
  assert.equal(b2.note.kind, 'comment', 'one marker per cell, and a comment is the strongest');
  assert.equal(b2.note.comment.author, 'slm4303');
  assert.equal(b2.note.title, 'Hours', 'the instruction is still carried, just not the kind');
  assert.equal(b2.note.prompt, 'Enter hours.');
});

test('workbookNotes: one row per comment, one row per validation RULE', () => {
  // A validation covering ninety-seven cells is one thing a reader wants to
  // see, not ninety-seven; a comment is genuinely per-cell.
  const dv = '<dataValidations><dataValidation sqref="D1:D50 F1" promptTitle="Code" prompt="Four digits."/></dataValidations>';
  const parts = commentParts().map(([p, x]) =>
    p === 'xl/worksheets/sheet1.xml' ? [p, x.replace('<legacyDrawing', dv + '<legacyDrawing')] : [p, x]);
  const { xl } = xlsxKit.analyze(parts);
  const notes = xlsxKit.workbookNotes(xl);
  assert.equal(notes.length, 3, 'two comments and one rule');
  assert.deepEqual(notes.map(n => n.kind), ['comment', 'comment', 'instruction']);
  const rule = notes[2];
  assert.equal(rule.cell, 'D1', 'addressed at the first cell of the range, so the cite lands');
  assert.equal(rule.span, 'D1:D50 F1', 'and says the whole reach');
  assert.equal(rule.text, 'Four digits.');
});

test('workbookNotes: sheets come in workbook order and cost nothing to ask for', () => {
  const { xl } = xlsxKit.analyze(commentParts());
  const notes = xlsxKit.workbookNotes(xl);
  assert.deepEqual(notes.map(n => [n.sheet, n.cell]), [['Form', 'B2'], ['Form', 'C3']]);
  // Read off the sheets, not off a layout, so a workbook past the draw cap
  // still reports every note it carries.
  assert.equal(xl.sheets.sheet1.rows.length, 2);
});

test('a workbook with nothing annotated returns an empty list, not a header row', () => {
  assert.deepEqual(xlsxKit.workbookNotes(formXl()), []);
  assert.deepEqual(xlsxKit.workbookNotes(null), []);
});

test('a threaded comment part is not read as a legacy one', () => {
  // Modern Excel writes threadedComments/*.xml AND a legacy comments part that
  // carries the same text with a machine-generated author. Reading both would
  // list every comment twice.
  const threaded = ['xl/threadedComments/threadedComment1.xml',
    `<?xml version="1.0"?><ThreadedComments xmlns="tc"><threadedComment ref="B2" personId="{1}"><text>a reply</text></threadedComment></ThreadedComments>`];
  const { xl } = xlsxKit.analyze(commentParts([threaded]));
  assert.equal(xl.sheets.sheet1.comments.length, 2, 'the threaded part contributed nothing');
});

// ── hyperlinks ───────────────────────────────────────────────────────────────
// One external link through the sheet's rels, one into the workbook by place,
// and one whose r:id resolves to nothing, which must mark no cell.

// `r:` must be bound or the part does not parse and the sheet vanishes.
const SHEET1_LINKED = SHEET1.replace('<worksheet xmlns="ws">', '<worksheet xmlns="ws" xmlns:r="r">').replace('</worksheet>', `
  <hyperlinks>
    <hyperlink ref="A1" r:id="rId7" tooltip="OFM contacts"/>
    <hyperlink ref="C1" location="'Data'!A1"/>
    <hyperlink ref="A2:B2" r:id="rId99"/>
  </hyperlinks>
</worksheet>`);
const SHEET1_RELS = `<?xml version="1.0"?>
<Relationships xmlns="rel">
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://ofm.wa.gov/budget/contacts" TargetMode="External"/>
</Relationships>`;

test('a hyperlink resolves through the sheet rels and lands on the cells it covers', () => {
  const parts = buildParts().map(([k, v]) => [k, k === 'xl/worksheets/sheet1.xml' ? SHEET1_LINKED : v]);
  parts.push(['xl/worksheets/_rels/sheet1.xml.rels', SHEET1_RELS]);
  const { xl } = xlsxKit.analyze(parts);
  const s = xl.sheets.sheet1;
  assert.equal(s.hyperlinks.length, 3);
  assert.equal(s.hyperlinks[0].href, 'https://ofm.wa.gov/budget/contacts');
  assert.equal(s.hyperlinks[0].tooltip, 'OFM contacts');
  assert.equal(s.hyperlinks[1].location, "'Data'!A1");
  assert.equal(s.hyperlinks[2].href, null, 'an r:id the rels do not carry resolves to nothing');
  const layout = xlsxKit.sheetLayout(s, xl);
  const cell = (r, c) => layout.rows.find(x => x.row === r)?.cells.find(x => x.col === c);
  assert.deepEqual(cell(1, 0).link, { href: 'https://ofm.wa.gov/budget/contacts', location: null, tooltip: 'OFM contacts' });
  assert.equal(cell(1, 2).link.location, "'Data'!A1");
  assert.equal(cell(1, 1)?.link, undefined, 'a cell no link covers carries none');
});

// ── what the workbook reaches outside itself ────────────────────────────────
//
// Sheet2.xml is workbook index 0 (Calc) and carries the pivot table; the cache
// behind it is built from Data, which is the OTHER sheet and is hidden. That
// arrangement is deliberate: a join that used part numbers, or that assumed the
// pivot sits on the sheet its data came from, passes on a simpler fixture.

const WORKBOOK_WIRED = `<?xml version="1.0"?>
<workbook xmlns="wb" xmlns:r="rel">
  <sheets>
    <sheet name="Calc" sheetId="9" r:id="rId1"/>
    <sheet name="Data" sheetId="7" r:id="rId2" state="hidden"/>
  </sheets>
  <pivotCaches><pivotCache cacheId="3" r:id="rId8"/></pivotCaches>
</workbook>`;

const WORKBOOK_RELS_WIRED = `<?xml version="1.0"?>
<Relationships xmlns="rel">
  <Relationship Id="rId1" Type=".../worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId2" Type=".../worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId8" Type=".../pivotCacheDefinition" Target="pivotCache/pivotCacheDefinition1.xml"/>
</Relationships>`;

const CONNECTIONS = `<?xml version="1.0"?>
<connections xmlns="cn">
  <connection id="1" name="WebQuery" type="4" description="the OFM budget page">
    <webPr url="https://ofm.wa.gov/budget"/>
  </connection>
  <connection id="2" name="Query - fees" type="5">
    <dbPr connection="Provider=Microsoft.Mashup.OleDb.1;Data Source=$Workbook$" command="SELECT * FROM [fees]"/>
  </connection>
  <connection id="3" name="Import" type="6">
    <textPr sourceFile="//fileserver/budget/fees.csv"/>
  </connection>
</connections>`;

// Region carries shared items AND a fieldGroup of the same element names. The
// group is the trap: folding its items into the shared list would shift every
// <x> index in the records by however many groups the author made, so a record
// naming East would come back West.
const PIVOT_CACHE = `<?xml version="1.0"?>
<pivotCacheDefinition xmlns="pc" xmlns:r="rel" recordCount="4">
  <cacheSource type="worksheet"><worksheetSource ref="A1:B4" sheet="Data"/></cacheSource>
  <cacheFields count="2">
    <cacheField name="Region">
      <sharedItems count="2"><s v="East"/><s v="West"/></sharedItems>
      <fieldGroup><groupItems count="1"><s v="DECOY"/></groupItems></fieldGroup>
    </cacheField>
    <cacheField name="Amount"/>
  </cacheFields>
</pivotCacheDefinition>`;

const PIVOT_CACHE_RELS = `<?xml version="1.0"?>
<Relationships xmlns="rel">
  <Relationship Id="rId1" Type=".../pivotCacheRecords" Target="pivotCacheRecords1.xml"/>
</Relationships>`;

// Four records: a resolved index, a second one, a missing value, and an index
// past the end of the shared list.
const PIVOT_RECORDS = `<?xml version="1.0"?>
<pivotCacheRecords xmlns="pc" count="4">
  <r><x v="0"/><n v="10"/></r>
  <r><x v="1"/><n v="20"/></r>
  <r><x v="0"/><m/></r>
  <r><x v="5"/><n v="30"/></r>
</pivotCacheRecords>`;

const PIVOT_TABLE = `<?xml version="1.0"?>
<pivotTableDefinition xmlns="pt" name="ByRegion" cacheId="3">
  <location ref="A3:B6" firstHeaderRow="1"/>
  <rowFields count="1"><field x="0"/></rowFields>
  <dataFields count="1"><dataField name="Sum of Amount" fld="1"/></dataFields>
</pivotTableDefinition>`;

const SHEET2_PIVOT_RELS = `<?xml version="1.0"?>
<Relationships xmlns="rel">
  <Relationship Id="rId1" Type=".../pivotTable" Target="../pivotTables/pivotTable1.xml"/>
</Relationships>`;

function buildWired() {
  return [
    ['[Content_Types].xml', CONTENT_TYPES],
    ['xl/workbook.xml', WORKBOOK_WIRED],
    ['xl/_rels/workbook.xml.rels', WORKBOOK_RELS_WIRED],
    ['xl/worksheets/sheet1.xml', SHEET1],
    ['xl/worksheets/sheet2.xml', SHEET2],
    ['xl/worksheets/_rels/sheet2.xml.rels', SHEET2_PIVOT_RELS],
    ['xl/sharedStrings.xml', SHARED_STRINGS],
    ['xl/styles.xml', STYLES],
    ['xl/connections.xml', CONNECTIONS],
    ['xl/pivotCache/pivotCacheDefinition1.xml', PIVOT_CACHE],
    ['xl/pivotCache/_rels/pivotCacheDefinition1.xml.rels', PIVOT_CACHE_RELS],
    ['xl/pivotCache/pivotCacheRecords1.xml', PIVOT_RECORDS],
    ['xl/pivotTables/pivotTable1.xml', PIVOT_TABLE],
  ];
}

test('sheet visibility comes from workbook.xml and keeps veryHidden distinct', () => {
  const { xl } = xlsxKit.analyze(buildWired());
  assert.equal(xl.sheets.sheet1.visibility, 'hidden', 'Data is the hidden one');
  assert.equal(xl.sheets.sheet2.visibility, 'visible', 'an omitted state means visible');
  const veryHidden = buildWired().map(([k, v]) =>
    [k, k === 'xl/workbook.xml' ? v.replace('state="hidden"', 'state="veryHidden"') : v]);
  assert.equal(xlsxKit.analyze(veryHidden).xl.sheets.sheet1.visibility, 'veryHidden',
    'veryHidden is not folded into hidden: only one of the two can be unhidden from the menu');
});

test('a sheet the workbook never claims has a null visibility rather than a guessed one', () => {
  const { xl } = xlsxKit.analyze(buildParts().concat([['xl/worksheets/sheet9.xml', SHEET1]]));
  assert.equal(xl.sheets.sheet9.visibility, null);
});

test('views.sources: one row per external connection, classified by code', () => {
  const result = xlsxKit.analyze(buildWired());
  const rows = xlsxKit.views.sources(result);
  assert.equal(rows.length, 3);
  const web = rows.find(r => r.Name === 'WebQuery');
  assert.equal(web.Kind, 'Web');
  assert.equal(web.Detail, 'https://ofm.wa.gov/budget');
  assert.equal(web.Description, 'the OFM budget page');
  const text = rows.find(r => r.Name === 'Import');
  assert.equal(text.Kind, 'Text');
  assert.equal(text.Detail, '//fileserver/budget/fees.csv');
  const pq = rows.find(r => r.Name === 'Query - fees');
  assert.equal(pq.Kind, 'OLE DB', 'a Power Query connection is an OLE DB connection');
  assert.equal(pq['Power Query'], 'yes', 'and the Mashup provider is what says so');
  assert.equal(pq.Detail, 'SELECT * FROM [fees]');
  assert.equal(web['Power Query'], '');
});

test('a pivot table joins to its sheet through the sheet rels and to its cache through cacheId', () => {
  const result = xlsxKit.analyze(buildWired());
  const { xl } = result;
  const part = 'xl/pivotTables/pivotTable1.xml';
  assert.equal(xl.pivotTables[part].sheet, 'sheet2', 'the pivot is drawn on Calc');
  assert.equal(xl.pivotTables[part].cachePart, 'xl/pivotCache/pivotCacheDefinition1.xml');
  assert.deepEqual(xl.sheets.sheet2.pivotTables, [part]);
  assert.deepEqual(xl.sheets.sheet1.pivotTables, [], 'the sheet the DATA came from carries no pivot');

  const [row] = xlsxKit.views.pivots(result);
  assert.equal(row.Pivot, 'ByRegion');
  assert.equal(row.Sheet, 'Calc', 'named as a reader would, not as sheet2');
  assert.equal(row.Range, 'A3:B6');
  assert.equal(row.Rows, 1);
  assert.equal(row.Measures, 'Sum of Amount');
  assert.equal(row.Source, 'Data!A1:B4');
  assert.equal(row.Records, 4);
  assert.equal(row['Cache Fields'], 2);
});

test('a pivot part is connected to its own sheet, not to every sheet', () => {
  const { conns } = xlsxKit.analyze(buildWired());
  assert.deepEqual([...conns['xl/pivotTables/pivotTable1.xml'].sheets], ['sheet2']);
  assert.ok(conns['xl/connections.xml'].sheets.has('sheet1'),
    'a connection is workbook-wide and stays so');
});

// ── hidden rows and columns, and column profiling ───────────────────────────

// A <col> range may legally run to 16384, so the count has to be read against
// the columns the sheet actually writes to. Cells reach C; the hidden range
// opens at B.
const SHEET_HIDDEN = `<?xml version="1.0"?>
<worksheet xmlns="ws">
  <cols><col min="2" max="16384" hidden="1"/></cols>
  <sheetData>
    <row r="1"><c r="A1"><v>1</v></c><c r="B1"><v>2</v></c><c r="C1"><v>3</v></c></row>
    <row r="2" hidden="1"><c r="A2"><v>4</v></c></row>
  </sheetData>
</worksheet>`;

test('hidden rows and columns are counted against the sheet\'s used width', () => {
  const parts = buildParts().map(([k, v]) => [k, k === 'xl/worksheets/sheet1.xml' ? SHEET_HIDDEN : v]);
  const result = xlsxKit.analyze(parts);
  const row = xlsxKit.views.connections(result).find(r => r.Sheet === 'sheet1');
  assert.equal(row['Hidden Rows'], 1);
  assert.equal(row['Hidden Cols'], 2,
    'B and C, not the 16383 columns the range nominally covers');
});

const SHEET_TABLE = `<?xml version="1.0"?>
<worksheet xmlns="ws">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>Region</t></is></c>
      <c r="B1" t="inlineStr"><is><t>Amount</t></is></c>
      <c r="C1" t="inlineStr"><is><t>Rate</t></is></c>
      <c r="D1" t="inlineStr"><is><t>Note</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><is><t>East</t></is></c><c r="B2"><v>10</v></c>
      <c r="C2"><v>1</v></c><c r="D2" t="inlineStr"><is><t>a</t></is></c>
    </row>
    <row r="3">
      <c r="A3" t="inlineStr"><is><t>West</t></is></c><c r="B3"><v>20</v></c>
      <c r="C3"><v>2</v></c><c r="D3" t="inlineStr"><is><t>b</t></is></c>
    </row>
    <row r="4">
      <c r="A4" t="inlineStr"><is><t>East</t></is></c><c r="B4"><v>30</v></c>
      <c r="C4"><v>3</v></c><c r="D4"><v>1</v></c>
    </row>
    <row r="5">
      <c r="A5" t="inlineStr"><is><t>Total</t></is></c><c r="B5"><f>SUM(B2:B4)</f><v>60</v></c>
      <c r="C5" t="inlineStr"><is><t>n/a</t></is></c><c r="D5"><v>2</v></c>
    </row>
  </sheetData>
</worksheet>`;

function profileOf() {
  const parts = buildParts().map(([k, v]) => [k, k === 'xl/worksheets/sheet1.xml' ? SHEET_TABLE : v]);
  const { xl } = xlsxKit.analyze(parts);
  const cols = xlsxKit.profileColumns(xl.sheets.sheet1, xl);
  return Object.fromEntries(cols.map(c => [c.letter, c]));
}

test('profileColumns: header, fill, and distinct values per column', () => {
  const p = profileOf();
  assert.deepEqual(Object.keys(p), ['A', 'B', 'C', 'D']);
  assert.equal(p.A.header, 'Region');
  assert.equal(p.A.rows, 4, 'the header row is not one of the rows profiled');
  assert.equal(p.A.filled, 4);
  assert.equal(p.A.blank, 0);
  assert.equal(p.A.distinct, 3);
  assert.deepEqual(p.A.top[0], { value: 'East', count: 2 }, 'most common first');
});

test('profileColumns: kind is the majority, so one label does not retype a number column', () => {
  const p = profileOf();
  assert.equal(p.B.kind, 'number');
  assert.equal(p.B.min, 10);
  assert.equal(p.B.max, 60);
  assert.equal(p.C.kind, 'number', 'three numbers and one "n/a" is still a number column');
  assert.equal(p.C.kinds.text, 1, 'and the text cell is reported rather than hidden');
  assert.equal(p.D.kind, 'mixed', 'two and two is no majority, and mixed says so');
});

test('profileColumns: a computed cell is counted apart from an entered one', () => {
  const p = profileOf();
  assert.equal(p.B.computed, 1, 'the Total row is a formula');
  assert.equal(p.A.computed, 0);
});

test('profileColumns: headerRow null profiles every row and names no header', () => {
  const parts = buildParts().map(([k, v]) => [k, k === 'xl/worksheets/sheet1.xml' ? SHEET_TABLE : v]);
  const { xl } = xlsxKit.analyze(parts);
  const [a] = xlsxKit.profileColumns(xl.sheets.sheet1, xl, { headerRow: null });
  assert.equal(a.header, '');
  assert.equal(a.rows, 5);
  assert.equal(a.distinct, 4, 'the heading is now one of the values');
});

// One column per role in Get-ColumnRole's ladder, in its order. E carries a
// heading and no values, which is the case a scan driven by the body rows
// alone would not see at all.
const t = (v) => `t="inlineStr"><is><t>${v}</t></is>`;
const SHEET_ROLES = `<?xml version="1.0"?>
<worksheet xmlns="ws">
  <sheetData>
    <row r="1">
      <c r="A1" ${t('Region')}</c><c r="B1" ${t('Amount')}</c><c r="C1" ${t('Fund')}</c>
      <c r="D1" ${t('Id')}</c><c r="E1" ${t('Spare')}</c>
    </row>
    <row r="2"><c r="A2" ${t('East')}</c><c r="B2"><v>10</v></c><c r="C2"><v>1</v></c><c r="D2" ${t('a1')}</c></row>
    <row r="3"><c r="A3" ${t('West')}</c><c r="B3"><v>20</v></c><c r="C3"><v>1</v></c><c r="D3" ${t('a2')}</c></row>
    <row r="4"><c r="A4" ${t('East')}</c><c r="B4"><v>10</v></c><c r="C4"><v>1</v></c><c r="D4" ${t('a3')}</c></row>
    <row r="5"><c r="A5" ${t('North')}</c><c r="B5"><v>30</v></c><c r="C5"><v>1</v></c><c r="D5" ${t('a4')}</c></row>
  </sheetData>
</worksheet>`;

function rolesOf(opts) {
  const parts = buildParts().map(([k, v]) => [k, k === 'xl/worksheets/sheet1.xml' ? SHEET_ROLES : v]);
  const { xl } = xlsxKit.analyze(parts);
  return Object.fromEntries(
    xlsxKit.profileColumns(xl.sheets.sheet1, xl, opts).map(c => [c.letter, c.role]));
}

test('profileColumns: role uses Get-ColumnRole\'s ladder, so both routes name a column alike', () => {
  const r = rolesOf();
  assert.equal(r.A, 'Categorical', 'repeated labels, fewer distinct than the threshold');
  assert.equal(r.B, 'Measure', 'numbers, and not one per row');
  assert.equal(r.C, 'Constant', 'one value the whole way down');
  assert.equal(r.D, 'Key', 'distinct in every row, and no row blank');
  assert.equal(r.E, 'Empty', 'a heading with nothing under it is still a column');
});

test('profileColumns: the ladder is ordered, so a fully distinct number column is a Key first', () => {
  // Get-ColumnRole tests Key before Measure, and matching that ordering is the
  // point of sharing the vocabulary at all: the same sheet must not be read as
  // a measure here and a key there.
  const r = rolesOf({ categorical: 2 });
  assert.equal(r.A, 'Plain', 'below the threshold the categorical branch no longer applies');
  assert.equal(r.D, 'Key', 'and the key branch is unaffected by that threshold');
});

// ── the rows behind a pivot ─────────────────────────────────────────────────

const CACHE_PART = 'xl/pivotCache/pivotCacheDefinition1.xml';

test('pivot records resolve their shared-item indices into values', () => {
  const { xl } = xlsxKit.analyze(buildWired());
  const got = xlsxKit.pivotRecords(xl, CACHE_PART);
  assert.deepEqual(got.fields, ['Region', 'Amount']);
  assert.deepEqual(got.rows, [
    { Region: 'East', Amount: 10 },
    { Region: 'West', Amount: 20 },
    // A missing cell is null, not '': a text field can hold an empty string and
    // a blank is not the same fact.
    { Region: 'East', Amount: null },
    // An index the shared list does not reach resolves to null rather than to
    // some neighbouring field's value.
    { Region: null, Amount: 30 },
  ]);
});

test('a fieldGroup of the same element names does not shift the shared-item indices', () => {
  const { xl } = xlsxKit.analyze(buildWired());
  assert.deepEqual(xl.pivotCaches[CACHE_PART].sharedItems, [['East', 'West'], []],
    'DECOY is a group item and belongs to neither list');
});

test('the records part is found through the cache definition\'s own rels', () => {
  const { xl } = xlsxKit.analyze(buildWired());
  assert.equal(xl.pivotCaches[CACHE_PART].recordsPart, 'xl/pivotCache/pivotCacheRecords1.xml');
});

test('records resolve whichever part order the zip is walked in', () => {
  const forward = xlsxKit.pivotRecords(xlsxKit.analyze(buildWired()).xl, CACHE_PART);
  const back = xlsxKit.pivotRecords(xlsxKit.analyze(buildWired().reverse()).xl, CACHE_PART);
  assert.deepEqual(back.rows, forward.rows,
    'the records part may be walked before the definition that explains it');
});

test('what the part held and what the definition claims are both reported', () => {
  const { xl } = xlsxKit.analyze(buildWired());
  const got = xlsxKit.pivotRecords(xl, CACHE_PART);
  assert.equal(got.total, 4, 'the records actually in the part');
  assert.equal(got.declared, 4, 'and the count the definition states');
  assert.equal(got.truncated, false);

  const capped = xlsxKit.pivotRecords(xl, CACHE_PART, { limit: 2 });
  assert.equal(capped.rows.length, 2);
  assert.equal(capped.total, 4, 'the total is what the file holds, not what was returned');
  assert.equal(capped.truncated, true, 'and a cut says so');
});

test('a cache with no records part reads as null rather than as an empty table', () => {
  // A workbook saved to refresh on open has a definition and nothing behind it,
  // which is a different answer from "the pivot has no rows".
  const parts = buildWired().filter(([k]) => !k.includes('pivotCacheRecords') && !k.includes('_rels/pivotCacheDefinition'));
  const { xl } = xlsxKit.analyze(parts);
  assert.equal(xl.pivotCaches[CACHE_PART].recordsPart, null);
  assert.equal(xlsxKit.pivotRecords(xl, CACHE_PART), null);
  assert.equal(xlsxKit.pivotRecords(xl, 'xl/pivotCache/nothing.xml'), null,
    'and a part that is not a cache at all is the same answer');
});

// ---------------------------------------------------------------------------
// Charts: OpenXML <c:chartSpace> parsing and drawing anchors
// ---------------------------------------------------------------------------

const CHART1_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <c:chart>
    <c:title><c:tx><c:rich><a:p><a:r><a:t>Quarterly Revenue</a:t></a:r></a:p></c:rich></c:tx></c:title>
    <c:plotArea>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="clustered"/>
        <c:ser>
          <c:idx val="0"/>
          <c:tx><c:v>2026</c:v></c:tx>
          <c:cat>
            <c:strRef><c:strCache>
              <c:pt idx="0"><c:v>Q1</c:v></c:pt>
              <c:pt idx="1"><c:v>Q2</c:v></c:pt>
            </c:strCache></c:strRef>
          </c:cat>
          <c:val>
            <c:numRef><c:numCache>
              <c:formatCode>"$"#,##0</c:formatCode>
              <c:pt idx="0"><c:v>1250</c:v></c:pt>
              <c:pt idx="1"><c:v>1450</c:v></c:pt>
            </c:numCache></c:numRef>
          </c:val>
        </c:ser>
      </c:barChart>
    </c:plotArea>
    <c:legend><c:legendPos val="r"/></c:legend>
  </c:chart>
</c:chartSpace>`;

const CHART_DRAWING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>4</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>8</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>10</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame>
      <xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Revenue Chart"/></xdr:nvGraphicFramePr>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart r:id="rIdC1"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;

const CHART_DRAWING_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdC1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
</Relationships>`;

test('parseChartXml: parses title, series names, categories, and cached values', () => {
  const chart = xlsxKit.parseChartXml(CHART1_XML);
  assert.equal(chart.title, 'Quarterly Revenue');
  assert.equal(chart.chartType, 'barChart');
  assert.equal(chart.subType, 'column');
  assert.equal(chart.grouping, 'clustered');
  assert.equal(chart.legend?.pos, 'r');
  assert.equal(chart.series.length, 1);
  assert.equal(chart.series[0].name, '2026');
  assert.deepEqual(chart.series[0].categories, ['Q1', 'Q2']);
  assert.deepEqual(chart.series[0].values, [1250, 1450]);
  assert.equal(chart.series[0].formatCode, '"$"#,##0');
});

test('a chart is parsed from xl/charts/ and placed in sheetLayout drawings', () => {
  const parts = [
    ['[Content_Types].xml', CONTENT_TYPES],
    ['xl/workbook.xml', `<workbook xmlns="wb"><sheets><sheet name="Rev" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<Relationships xmlns="rel"><Relationship Id="rId1" Type=".../worksheet" Target="worksheets/sheet1.xml"/></Relationships>`],
    ['xl/worksheets/sheet1.xml', `<worksheet xmlns="ws" xmlns:r="rel"><sheetData><row r="1"><c r="A1"><v>100</v></c></row></sheetData><drawing r:id="rIdD1"/></worksheet>`],
    ['xl/worksheets/_rels/sheet1.xml.rels', `<Relationships xmlns="rel"><Relationship Id="rIdD1" Type=".../drawing" Target="../drawings/drawing1.xml"/></Relationships>`],
    ['xl/drawings/drawing1.xml', CHART_DRAWING],
    ['xl/drawings/_rels/drawing1.xml.rels', CHART_DRAWING_RELS],
    ['xl/charts/chart1.xml', CHART1_XML],
  ];

  const { xl } = xlsxKit.analyze(parts);
  assert.ok(xl.charts['xl/charts/chart1.xml'], 'chart XML part was analyzed');
  const sheet = xl.sheets.sheet1;
  assert.equal(sheet.drawings.length, 1);
  assert.equal(sheet.drawings[0].kind, 'chart');
  assert.equal(sheet.drawings[0].chart.title, 'Quarterly Revenue');

  const layout = xlsxKit.sheetLayout(sheet, xl);
  assert.equal(layout.drawings.length, 1);
  const d = layout.drawings[0];
  assert.equal(d.kind, 'chart');
  assert.equal(d.row, 3, 'from.row is 2 (0-based) -> row 3 (1-based)');
  assert.equal(d.col, 4, 'from.col is 4 (column E)');
  assert.ok(d.width > 0);
  assert.ok(d.height > 0);
  assert.equal(d.chart.title, 'Quarterly Revenue');
});
