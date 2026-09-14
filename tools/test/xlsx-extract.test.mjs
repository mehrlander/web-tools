// kits/xlsx-extract.js — picking part of a workbook and carrying the answer
// away. DOMParser comes from jsdom, the fixture is hand-built XML parts, and
// both kits run against ONE window object, which is the arrangement the page
// has: xlsx-extract reads window.xlsxKit at call time.
//
// What is worth holding here, in order of what would rot silently:
//
//   1. the survey's count and the extract's rows AGREE, per kind. A picker
//      showing 400 beside an item holding 12 is a lie about the file.
//   2. the two axes cross without nesting: sheets and kinds are independent,
//      and a workbook-scoped kind appears once however many sheets are picked.
//   3. every cut is reported, at both levels: rows past the cap, and the kinds
//      and sheets that were never asked for.
//   4. the envelope is one a data-view reader accepts today, unchanged.

import test from 'node:test';
import assert from 'node:assert/strict';
import jsdomPkg from 'jsdom';
import { loadKit } from './bootstrap.mjs';

const { JSDOM } = jsdomPkg;
globalThis.DOMParser = new JSDOM('').window.DOMParser;

// One window, both kits, in the order a page loads them.
const w = {};
loadKit('xlsx', { window: w });
loadKit('data-payload', { window: w });
loadKit('xlsx-extract', { window: w });
globalThis.window = w;
const { xlsxKit, XlsxExtract, DataPayload } = w;

// ---- the fixture --------------------------------------------------------
//
// Ledger is the FIRST sheet in the workbook and lives in sheet2.xml; Notes is
// second, hidden, and lives in sheet1.xml. The inversion is deliberate: a
// survey that read part order would name these the wrong way round and every
// other assertion would still pass.

const WORKBOOK = `<?xml version="1.0"?>
<workbook xmlns="wb" xmlns:r="rel">
  <sheets>
    <sheet name="Ledger" sheetId="4" r:id="rId1"/>
    <sheet name="Notes" sheetId="9" r:id="rId2" state="hidden"/>
  </sheets>
  <pivotCaches><pivotCache cacheId="7" r:id="rId3"/></pivotCaches>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0"?>
<Relationships xmlns="rel">
  <Relationship Id="rId1" Type=".../worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId2" Type=".../worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId3" Type=".../pivotCacheDefinition" Target="pivotCache/pivotCacheDefinition1.xml"/>
</Relationships>`;

const SHARED = `<?xml version="1.0"?>
<sst xmlns="sst"><si><t>Fund</t></si><si><t>Spend</t></si><si><t>600</t></si><si><t>722</t></si></sst>`;

// cellXfs 1 is bold under a currency code; 2 is plain.
const STYLES = `<?xml version="1.0"?>
<styleSheet xmlns="ss">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
  <fonts count="2"><font/><font><b/><color rgb="FF1F4E79"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/></patternFill></fill></fills>
  <borders count="1"><border/></borders>
  <cellXfs count="3">
    <xf numFmtId="0"/>
    <xf numFmtId="164" fontId="1" fillId="1" applyFill="1"><alignment horizontal="center" wrapText="1"/></xf>
    <xf numFmtId="0"/>
  </cellXfs>
  <dxfs count="1"><dxf><fill><patternFill><bgColor rgb="FFFFC7CE"/></patternFill></fill></dxf></dxfs>
</styleSheet>`;

// Ledger: a header row of shared strings under style 1, then two data rows.
// B3 carries a formula WITH text; B4 is its shared follower, which stores none.
// A1:B1 is merged. A conditional rule covers B2:B4.
const SHEET2 = `<?xml version="1.0"?>
<worksheet xmlns="ws">
  <mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells>
  <sheetData>
    <row r="1"><c r="A1" t="s" s="1"><v>0</v></c><c r="B1" t="s" s="1"><v>1</v></c></row>
    <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>17</v></c></row>
    <row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3"><f t="shared" ref="B3:B4" si="0">SUM(B2:B2)</f><v>17</v></c></row>
    <row r="4"><c r="A4" t="s"><v>2</v></c><c r="B4"><f t="shared" si="0"/><v>34</v></c></row>
  </sheetData>
  <conditionalFormatting sqref="B2:B4">
    <cfRule type="cellIs" operator="greaterThan" dxfId="0" priority="1"><formula>20</formula></cfRule>
  </conditionalFormatting>
  <dataValidations count="1">
    <dataValidation type="list" sqref="A2:A4" showInputMessage="1"
                    promptTitle="Fund" prompt="Pick the fund this row charges">
      <formula1>"600,722"</formula1>
    </dataValidation>
  </dataValidations>
</worksheet>`;

const SHEET2_RELS = `<?xml version="1.0"?>
<Relationships xmlns="rel">
  <Relationship Id="rId1" Type=".../pivotTable" Target="../pivotTables/pivotTable1.xml"/>
  <Relationship Id="rId2" Type=".../comments" Target="../comments1.xml"/>
</Relationships>`;

const COMMENTS = `<?xml version="1.0"?>
<comments xmlns="cm">
  <authors><author>Marcus</author></authors>
  <commentList><comment ref="B3" authorId="0"><text><t>check this against the allotment</t></text></comment></commentList>
</comments>`;

// Notes: one inline string and nothing else, so it is a sheet with values and
// zero of everything else, which is the case the survey has to report as zeros
// rather than by omitting the row. Its declared dimension is wider than its
// one cell, which is how the cells reading shows it reports the file's claim
// rather than recomputing it.
const SHEET1 = `<?xml version="1.0"?>
<worksheet xmlns="ws"><dimension ref="A1:C3"/><sheetData>
  <row r="1"><c r="A1" t="inlineStr"><is><t>carried inline</t></is></c></row>
</sheetData></worksheet>`;

const PIVOT_TABLE = `<?xml version="1.0"?>
<pivotTableDefinition xmlns="pt" name="ByFund" cacheId="7">
  <location ref="D1:E4"/>
  <rowFields count="1"><field x="0"/></rowFields>
  <dataFields count="1"><dataField name="Sum of Spend" fld="1"/></dataFields>
</pivotTableDefinition>`;

const PIVOT_CACHE = `<?xml version="1.0"?>
<pivotCacheDefinition xmlns="pc" recordCount="3">
  <cacheSource type="worksheet"><worksheetSource ref="A1:B4" sheet="Ledger"/></cacheSource>
  <cacheFields count="2">
    <cacheField name="Fund"><sharedItems count="2"><s v="600"/><s v="722"/></sharedItems></cacheField>
    <cacheField name="Spend"/>
  </cacheFields>
</pivotCacheDefinition>`;

const PIVOT_CACHE_RELS = `<?xml version="1.0"?>
<Relationships xmlns="rel">
  <Relationship Id="rId1" Type=".../pivotCacheRecords" Target="pivotCacheRecords1.xml"/>
</Relationships>`;

const PIVOT_RECORDS = `<?xml version="1.0"?>
<pivotCacheRecords xmlns="pc" count="3">
  <r><x v="0"/><n v="17"/></r>
  <r><x v="1"/><n v="17"/></r>
  <r><x v="0"/><n v="34"/></r>
</pivotCacheRecords>`;

const CONNECTIONS = `<?xml version="1.0"?>
<connections xmlns="cn">
  <connection id="1" name="OFM page" type="4"><webPr url="https://ofm.wa.gov/budget"/></connection>
</connections>`;

const parts = () => [
  ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="ct"/>'],
  ['xl/workbook.xml', WORKBOOK],
  ['xl/_rels/workbook.xml.rels', WORKBOOK_RELS],
  ['xl/sharedStrings.xml', SHARED],
  ['xl/styles.xml', STYLES],
  ['xl/connections.xml', CONNECTIONS],
  ['xl/comments1.xml', COMMENTS],
  ['xl/worksheets/sheet1.xml', SHEET1],
  ['xl/worksheets/sheet2.xml', SHEET2],
  ['xl/worksheets/_rels/sheet2.xml.rels', SHEET2_RELS],
  ['xl/pivotTables/pivotTable1.xml', PIVOT_TABLE],
  ['xl/pivotCache/pivotCacheDefinition1.xml', PIVOT_CACHE],
  ['xl/pivotCache/_rels/pivotCacheDefinition1.xml.rels', PIVOT_CACHE_RELS],
  ['xl/pivotCache/pivotCacheRecords1.xml', PIVOT_RECORDS],
];

const read = () => xlsxKit.analyze(parts());
const NOW = '2026-09-14T00:00:00.000Z';
const take = (pick, opts) => XlsxExtract.extract(read(), pick, { now: NOW, ...opts });
const byName = (env, name) => env.items.find(i => i.name === name);
const rowsOf = (item) => JSON.parse(item.content);

test('kit surface', () => {
  assert.deepEqual(Object.keys(XlsxExtract).sort(),
    ['KIND', 'KINDS', 'SELECTED_KIND', 'catalog', 'extract', 'extractSelected', 'profileRows',
     'receptionTarget', 'receptions', 'survey']);
  assert.equal(XlsxExtract.KIND, 'workbook-extract/1');
  assert.equal(XlsxExtract.SELECTED_KIND, 'workbook-extract/2');
});

test('the kinds are two flat lists, not a tree: nine per sheet and four per workbook', () => {
  const scopes = XlsxExtract.KINDS.reduce((m, k) => ({ ...m, [k.scope]: (m[k.scope] || 0) + 1 }), {});
  assert.deepEqual(scopes, { sheet: 9, workbook: 4 });
  assert.deepEqual(XlsxExtract.KINDS.map(k => k.id), [
    'values', 'cells', 'formulas', 'styles', 'merges', 'comments', 'validations',
    'conditional', 'columns', 'pivots', 'records', 'sources', 'queries',
  ]);
});

test('the survey names sheets in workbook order, not part-file order', () => {
  const s = XlsxExtract.survey(read());
  assert.deepEqual(s.sheets.map(x => x.name), ['Ledger', 'Notes']);
  assert.equal(s.sheets[1].visibility, 'hidden', 'and reports what no value grid can show');
});

test('a kind a sheet has none of reports zero rather than disappearing', () => {
  // The Structure mode keeps an empty tab in its strip for this reason: a cell
  // that vanishes when empty cannot answer "does this sheet carry comments".
  const notes = XlsxExtract.survey(read()).sheets.find(s => s.name === 'Notes');
  assert.equal(notes.counts.values, 1);
  assert.equal(notes.counts.comments, 0);
  assert.equal(notes.counts.merges, 0);
  assert.equal(notes.counts.conditional, 0);
  assert.ok('comments' in notes.counts, 'the key is present, holding zero');
});

test('the workbook-scoped counts are reported once, beside the sheets', () => {
  const s = XlsxExtract.survey(read());
  assert.deepEqual(s.workbook, { pivots: 1, records: 3, sources: 1, queries: 0 });
});

test('the sheet-centered catalogue places related objects without including them', () => {
  const cat = XlsxExtract.catalog(read());
  assert.deepEqual(cat.objects.map(o => [o.kind, o.label, o.sheet, o.count]), [
    ['pivots', 'ByFund', 'Ledger', 1],
    ['records', 'Ledger!A1:B4', 'Ledger', 3],
    ['sources', 'OFM page', null, 1],
  ]);
});

test('v2 selects kinds independently per sheet and never adds related objects implicitly', () => {
  const env = XlsxExtract.extractSelected(read(), {
    sheets: [
      { name: 'Ledger', kinds: ['comments'] },
      { name: 'Notes', kinds: ['values'] },
    ], objects: [],
  }, { now: NOW });
  assert.equal(env.kind, 'workbook-extract/2');
  assert.deepEqual(env.items.map(i => [i.sheet, i.kind]), [
    ['Ledger', 'comments'], ['Notes', 'values'],
  ]);
  assert.deepEqual(env.picked.sheets, [
    { name: 'Ledger', kinds: ['comments'] }, { name: 'Notes', kinds: ['values'] },
  ]);
  assert.ok(env.left.objects.some(id => id.startsWith('records:')));
  assert.ok(env.left.sheetKinds.find(s => s.name === 'Ledger').kinds.includes('values'));
  assert.ok(DataPayload.isEnvelope(env));
});

test('v2 can include one pivot, cached rows, or a connection without selecting any sheet', () => {
  const cat = XlsxExtract.catalog(read());
  for (const object of cat.objects) {
    const env = XlsxExtract.extractSelected(read(), { objects: [object.id] },
      { now: NOW, maxRows: 2 });
    assert.equal(env.items.length, 1, object.kind);
    assert.equal(env.items[0].object, object.id);
    assert.equal(env.items[0].kind, object.kind);
    assert.equal(env.items[0].sheet, object.sheet);
    assert.deepEqual(env.picked.objects.map(o => o.id), [object.id]);
    if (object.kind === 'records') {
      assert.equal(env.items[0].total, 3);
      assert.equal(env.items[0].rows, 2);
      assert.equal(env.items[0].truncated, true);
    }
  }
});

test('v2 selects individual objects within a kind, including Power Query source', () => {
  const result = read();
  result.xl.connections.push({ ...result.xl.connections[0], id: '2', name: 'Second source' });
  const [pivotPart, pivot] = Object.entries(result.xl.pivotTables)[0];
  result.xl.pivotTables[pivotPart.replace('1.xml', '2.xml')] = { ...pivot, name: 'Second pivot' };
  result.xl.powerQuery = { sections: [
    { path: 'xl/queries/First.m', m: 'let First = 1 in First' },
    { path: 'xl/queries/Second.m', m: 'let Second = 2 in Second' },
  ] };
  const cat = XlsxExtract.catalog(result);
  const choices = cat.objects.filter(o => o.label.startsWith('Second'));
  assert.deepEqual(choices.map(o => o.kind), ['pivots', 'sources', 'queries']);
  const env = XlsxExtract.extractSelected(result, { objects: choices.map(o => o.id) }, { now: NOW });
  assert.deepEqual(env.items.map(i => i.kind), ['pivots', 'sources', 'queries']);
  assert.equal(rowsOf(env.items[0])[0].Pivot, 'Second pivot');
  assert.equal(rowsOf(env.items[1])[0].Name, 'Second source');
  assert.equal(env.items[2].content, 'let Second = 2 in Second');
  assert.equal(env.items.every(i => !i.content.includes('First')), true);
});

// Claim 1: the picker's number and the extract's rows are the same number.
test("every kind's survey count matches the rows it actually produces", () => {
  const survey = XlsxExtract.survey(read());
  const all = XlsxExtract.KINDS.map(k => k.id);
  const env = take({ kinds: all }, { maxRows: null });

  for (const sheet of survey.sheets) {
    for (const [kindId, n] of Object.entries(sheet.counts)) {
      const item = env.items.find(i => i.sheet === sheet.name && i.kind === kindId);
      if (!n) { assert.equal(item, undefined, `${sheet.name}/${kindId}: zero produces no item`); continue; }
      // The cells reading is one object rather than a table of rows, so its
      // count is the sheet's cell list, and it is never cut.
      if (kindId === 'cells') { assert.equal(rowsOf(item).Cells.length, n, `${sheet.name}/cells: survey said ${n}`); continue; }
      assert.equal(item.total, n, `${sheet.name}/${kindId}: survey said ${n}`);
      assert.equal(rowsOf(item).length, n, `${sheet.name}/${kindId}: and the rows agree`);
    }
  }
  for (const [kindId, n] of Object.entries(survey.workbook)) {
    const items = env.items.filter(i => i.sheet === null && i.kind === kindId);
    if (!n) { assert.equal(items.length, 0, `${kindId}: zero produces no item`); continue; }
    assert.equal(items.reduce((a, i) => a + (i.total ?? 0), 0), n, `${kindId}: survey said ${n}`);
  }
});

// Claim 2, both halves.
test('the axes cross: two sheets and two kinds give the cells, not a nesting', () => {
  const env = take({ sheets: ['Ledger', 'Notes'], kinds: ['values', 'comments'] });
  assert.deepEqual(env.items.map(i => [i.sheet, i.kind]), [
    ['Ledger', 'values'], ['Ledger', 'comments'], ['Notes', 'values'],
  ], 'Notes has no comments, so that cell is absent rather than empty');
});

test('a workbook-scoped kind appears once however many sheets are picked', () => {
  const one = take({ sheets: ['Ledger'], kinds: ['pivots'] });
  const both = take({ sheets: ['Ledger', 'Notes'], kinds: ['pivots'] });
  assert.equal(one.items.length, 1);
  assert.equal(both.items.length, 1, 'the sheet axis does not multiply it');
  assert.equal(both.items[0].sheet, null);
});

test('naming no sheet takes every sheet; naming no kind takes nothing', () => {
  assert.deepEqual(take({ kinds: ['values'] }).picked.sheets, ['Ledger', 'Notes']);
  // An empty selection is a real state for a picker to be in, and guessing
  // "all" there hands over a whole workbook nobody asked for.
  const none = take({ sheets: ['Ledger'], kinds: [] });
  assert.equal(none.items.length, 0);
  assert.deepEqual(none.picked.kinds, []);
});

test('kinds come back in the catalogue order whatever order they were asked in', () => {
  const env = take({ sheets: ['Ledger'], kinds: ['merges', 'values'] });
  assert.deepEqual(env.items.map(i => i.kind), ['values', 'merges']);
});

// Claim 3, the selection level.
test('what was left behind is stated, not only what was taken', () => {
  const env = take({ sheets: ['Ledger'], kinds: ['values'] });
  assert.deepEqual(env.picked, { sheets: ['Ledger'], kinds: ['values'] });
  assert.deepEqual(env.left.sheets, ['Notes']);
  assert.equal(env.left.kinds.length, 12);
  assert.ok(env.left.kinds.includes('queries'));
});

// Claim 3, the row level.
test('a row cut past the cap is reported on the item and written into its note', () => {
  const full = take({ sheets: ['Ledger'], kinds: ['values'] }, { maxRows: null });
  assert.equal(rowsOf(full.items[0]).length, 4);
  assert.equal(full.items[0].truncated, false);
  assert.equal(full.items[0].note, '');

  const cut = take({ sheets: ['Ledger'], kinds: ['values'] }, { maxRows: 2 });
  const it = cut.items[0];
  assert.equal(rowsOf(it).length, 2, 'the rows are cut');
  assert.equal(it.rows, 2);
  assert.equal(it.total, 4, 'the total is what the sheet holds, not what was returned');
  assert.equal(it.truncated, true);
  // The same fact in the one field today's data-view reader already shows,
  // derived from the record rather than written beside it.
  assert.equal(it.note, '2 of 4 rows');
});

test('an explicit null row cap keeps all parsed rows', () => {
  const env = XlsxExtract.extractSelected(read(), {
    sheets: [{ name: 'Ledger', kinds: ['values'] }],
  }, { now: NOW, maxRows: null });
  assert.equal(env.items[0].rows, 4);
  assert.equal(env.items[0].truncated, false);
});

test("a pivot cache's own cut rides through rather than being re-reported", () => {
  const env = take({ kinds: ['records'] }, { maxRows: 2 });
  const it = env.items[0];
  assert.equal(it.total, 3, 'the cache holds three records');
  assert.equal(it.rows, 2);
  assert.equal(it.truncated, true);
  assert.match(it.name, /^workbook\.records\.Ledger.A1.B4\.json$/,
    'a cache is named by the range it was built from, since it has no name of its own');
});

// Claim 4.
test('the envelope reads as a data-view envelope today, unchanged', () => {
  const env = take({ sheets: ['Ledger'], kinds: ['values', 'comments'] });
  assert.ok(DataPayload.isEnvelope(env),
    'the discriminator is structural, so a superset kind is admitted with no change to data-payload.js');
  const got = DataPayload.read(JSON.stringify(env));
  assert.equal(got.kind, 'envelope');
  assert.deepEqual(got.items.map(i => i.name), env.items.map(i => i.name));
  assert.equal(got.items[0].view, 'table');
});

test('item names are unique, because a name is how a link addresses one', () => {
  const env = take({ kinds: XlsxExtract.KINDS.map(k => k.id) });
  const names = env.items.map(i => i.name);
  assert.equal(new Set(names).size, names.length);
  // And the address round-trips through the vocabulary that owns it.
  const items = DataPayload.read(JSON.stringify(env)).items;
  for (let i = 0; i < items.length; i++) {
    assert.equal(DataPayload.resolveItem(items, DataPayload.addressItem(items, i)), i);
  }
});

test('a sheet name that is not a filename still becomes one, without colliding', () => {
  assert.equal(XlsxExtract.extract(read(), { sheets: ['Ledger'], kinds: ['values'] }, { now: NOW })
    .items[0].name, 'Ledger.values.json');
});

// ---- what each kind actually says ---------------------------------------

test('values read through the number format, and keep the sheet row number', () => {
  const rows = rowsOf(take({ sheets: ['Ledger'], kinds: ['values'] }).items[0]);
  assert.deepEqual(rows[0], { Row: 1, A: 'Fund', B: 'Spend' });
  assert.equal(rows[1].A, '600', 'a shared string resolved');
});

test('a formula arrives as its stored text, and a shared follower says so instead', () => {
  const it = byName(take({ sheets: ['Ledger'], kinds: ['formulas'] }), 'Ledger.formulas.json');
  const rows = rowsOf(it);
  assert.deepEqual(rows.map(r => r.Cell), ['B3', 'B4']);
  assert.equal(rows[0].Formula, 'SUM(B2:B2)', 'as the file writes it: no leading =');
  assert.equal(rows[0].Value, '17', 'the result beside the formula');
  assert.equal(rows[1].Formula, '', 'a shared follower stores no text of its own');
  assert.equal(it.note, '1 of 2 are shared-formula followers, which store no text of their own',
    'and the count is stated rather than left to be noticed');
});

test('styles flatten to what the cell draws, one row per styled cell', () => {
  const rows = rowsOf(take({ sheets: ['Ledger'], kinds: ['styles'] }).items[0]);
  assert.deepEqual(rows.map(r => r.Cell), ['A1', 'B1']);
  assert.equal(rows[0].Bold, 'yes');
  assert.equal(rows[0].Fill, '#d9e1f2');
  assert.equal(rows[0].Color, '#1f4e79');
  assert.equal(rows[0].Align, 'center');
  assert.equal(rows[0].Wrap, 'yes');
  assert.equal(rows[0].Format, '#,##0.00');
});

test('a merge carries its span and the value the anchor draws', () => {
  const rows = rowsOf(take({ sheets: ['Ledger'], kinds: ['merges'] }).items[0]);
  assert.deepEqual(rows, [{ Range: 'A1:B1', Anchor: 'A1', Rows: 1, Columns: 2, Value: 'Fund' }]);
});

test('a comment reaches the cell it sits on, with who left it', () => {
  const rows = rowsOf(take({ sheets: ['Ledger'], kinds: ['comments'] }).items[0]);
  assert.deepEqual(rows, [{ Cell: 'B3', Author: 'Marcus', Text: 'check this against the allotment' }]);
});

test("a validation is one row per RULE, with its range and the options it names", () => {
  const rows = rowsOf(take({ sheets: ['Ledger'], kinds: ['validations'] }).items[0]);
  assert.equal(rows.length, 1, 'one row per rule, not per cell of its range');
  assert.equal(rows[0].Cell, 'A2');
  assert.equal(rows[0].Span, 'A2:A4');
  assert.equal(rows[0].Kind, 'list');
  assert.equal(rows[0].Title, 'Fund');
  assert.equal(rows[0].Options, '600 | 722');
});

test('a conditional rule arrives as written, and says it was not evaluated', () => {
  const it = take({ sheets: ['Ledger'], kinds: ['conditional'] }).items[0];
  const rows = rowsOf(it);
  assert.deepEqual(rows[0], {
    Range: 'B2:B4', Type: 'cellIs', Operator: 'greaterThan', Priority: 1,
    'Stop if true': '', Text: '', Formulas: '20', Format: 'fill #ffc7ce',
  });
  assert.match(it.note, /not evaluated here/);
});

test('column profiles come through one rendering, the one the Columns tab reads', () => {
  const env = take({ sheets: ['Ledger'], kinds: ['columns'] }, { headerRow: 1 });
  const rows = rowsOf(env.items[0]);
  assert.deepEqual(rows.map(r => r.Column), ['A', 'B']);
  assert.equal(rows[0].Header, 'Fund');
  assert.equal(rows[1].Header, 'Spend');
  assert.equal(rows[1].Computed, 2, 'B3 and B4 are formulas');
  // One function, so a column cannot read `Role` in the extract and `role` in
  // the tab that draws the same table.
  const { xl } = read();
  const ledger = Object.values(xl.sheets).find(s => s.name === 'Ledger');
  assert.deepEqual(XlsxExtract.profileRows(ledger, xl, 1), rows);
});

test('a header row of 0 profiles every row and names no header', () => {
  const rows = rowsOf(take({ sheets: ['Ledger'], kinds: ['columns'], headerRow: 0 }).items[0]);
  assert.equal(rows[0].Header, '');
  assert.equal(rows[0].Filled, 4, 'the header row is data now');
});

test('Power Query is absent here, and absent is a zero rather than an empty file', () => {
  assert.equal(XlsxExtract.survey(read()).workbook.queries, 0);
  assert.equal(take({ kinds: ['queries'] }).items.length, 0);
});

test('provenance rides on the envelope: where it came from and when', () => {
  const source = { repo: 'mehrlander/home', ref: 'abc1234', path: 'x/ledger.xlsx', name: 'ledger.xlsx', bytes: 58122 };
  const env = take({ sheets: ['Ledger'], kinds: ['values'] }, { source });
  assert.deepEqual(env.source, source);
  assert.equal(env.taken, NOW);
  assert.equal(env.title, 'ledger.xlsx: values', 'named by the workbook and what was taken');
});

test('with no source the extract still says so, rather than inventing one', () => {
  const env = take({ sheets: ['Ledger'], kinds: ['values'] });
  assert.equal(env.source, null);
  assert.equal(env.title, 'workbook: values');
});

// ---- the cells reading, and receptions ----------------------------------

test('the cells reading is the serialized-workbook shape: address, formula, cached value, per sheet', () => {
  const it = byName(take({ sheets: ['Ledger'], kinds: ['cells'] }), 'Ledger.cells.json');
  assert.equal(it.view, 'code', 'one object, not a table');
  const sheet = rowsOf(it);
  assert.equal(sheet.SheetName, 'Ledger');
  assert.deepEqual(sheet.MergedCells, ['A1:B1']);
  assert.equal(sheet.Dimension, 'A1:B4', 'computed from the cells when the file declares none');
  const at = Object.fromEntries(sheet.Cells.map(c => [c.Address, c]));
  assert.deepEqual(at.A2, { Address: 'A2', Formula: '', Value: '600' }, 'a shared string resolved, raw, no formula');
  assert.deepEqual(at.B3, { Address: 'B3', Formula: '=SUM(B2:B2)', Value: '17' }, 'the master, with the = the exporter writes');
  assert.deepEqual(at.B4, { Address: 'B4', Formula: '=[fill 0] SUM(B2:B2)', Value: '34' },
    "a follower carries its master's text under the fill marker, as Get-WsDetail writes it");
  assert.equal(it.note, "1 filled formula carry the master's text under a [fill N] marker".replace('formula carry', 'formula carry'));
  const notes = rowsOf(byName(take({ sheets: ['Notes'], kinds: ['cells'] }), 'Notes.cells.json'));
  assert.equal(notes.Dimension, 'A1:C3', "the file's own declaration wins over the computed extent");
  assert.deepEqual(notes.Cells, [{ Address: 'A1', Formula: '', Value: 'carried inline' }]);
});

test('a reception matches by sheet set, takes every sheet not omitted, and states what it left', () => {
  const cat = XlsxExtract.catalog(read());
  const declared = [
    { id: 'other', match: { sheets: ['Projection'] }, dest: 'x', repo: 'mehrlander/home' },
    { id: 'ledger', label: 'Ledger drop', match: { sheets: ['Ledger'] }, omit: ['Notes'],
      dest: 'data/source/{date}-ledger', file: '{stem}-{date}.json', repo: 'mehrlander/home' },
  ];
  const got = XlsxExtract.receptions(cat, declared);
  assert.equal(got.length, 1, 'only the reception whose sheets are all present');
  assert.equal(got[0].reception.id, 'ledger');
  assert.deepEqual(got[0].pick, { sheets: [{ name: 'Ledger', kinds: ['cells'] }], objects: [] },
    'readings default to cells, and the omitted sheet is not in the pick');
  assert.deepEqual(got[0].omitted, ['Notes']);
  assert.equal(got[0].cap, null, 'a landed extract is a file, so no row cut by default');
  assert.deepEqual(XlsxExtract.receptionTarget(declared[1], { name: 'Cash projection.xlsx' }, '2026-09-14T12:00:00Z'),
    { dest: 'data/source/2026-09-14-ledger', file: 'Cash-projection-2026-09-14.json' });
  assert.deepEqual(XlsxExtract.receptionTarget({ dest: 'd' }, null, '2026-09-14T12:00:00Z'),
    { dest: 'd', file: 'workbook.extract.json' }, 'a file name is never missing');
  // The pick it hands over is one extractSelected accepts as it is, and the
  // envelope states the declared omission as what was left.
  const env = XlsxExtract.extractSelected(read(), got[0].pick, { catalog: cat, maxRows: got[0].cap, now: NOW });
  assert.deepEqual(env.items.map(i => i.name), ['Ledger.cells.json']);
  assert.deepEqual(env.left.sheets, ['Notes']);
});

test('a reception with no sheet set applies to every workbook, and `hidden` leaves the hidden sheets behind', () => {
  const cat = XlsxExtract.catalog(read());
  // Notes is the hidden sheet of the fixture; nothing names it here.
  const general = { id: 'any', omit: ['hidden'], dest: 'data/source/{date}-{slug}', file: '{slug}-{date}.json' };
  const got = XlsxExtract.receptions(cat, [general]);
  assert.equal(got.length, 1, 'no match.sheets means any workbook');
  assert.deepEqual(got[0].pick.sheets.map(s => s.name), ['Ledger']);
  assert.deepEqual(got[0].omitted, ['Notes'], 'left behind because it is hidden, not because it was named');
  // A name and the token union: either signal keeps a sheet back.
  const both = XlsxExtract.receptions(cat, [{ id: 'b', omit: ['Ledger', 'hidden'] }])[0];
  assert.deepEqual(both.pick.sheets, [], 'Ledger by name, Notes by visibility');
  assert.deepEqual(both.omitted, ['Ledger', 'Notes']);
  // Order decides between a specific and a general declaration.
  const ordered = XlsxExtract.receptions(cat, [{ id: 's', match: { sheets: ['Ledger'] } }, general]);
  assert.deepEqual(ordered.map(g => g.reception.id), ['s', 'any'], 'both apply; the first listed is the one taken');
  assert.deepEqual(XlsxExtract.receptionTarget(general, { name: 'Cash Projection.xlsx' }, '2026-09-14T12:00:00Z'),
    { dest: 'data/source/2026-09-14-cash-projection', file: 'cash-projection-2026-09-14.json' }, '{slug} is the stem lowercased');
});
