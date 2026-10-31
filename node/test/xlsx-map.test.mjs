// kits/xlsx-map.js — how a workbook's parts connect, and what each sheet holds.
// The fixture is hand-built XML parts, like xlsx-extract.test.mjs, with one of
// each kind of link planted and the look-alikes that must not count beside them.
//
// What would rot silently, in order:
//
//   1. a sheet a formula reads is found however the formula names it: bare,
//      quoted with a space and a slash, through a table's structured reference,
//      through a defined name, in another workbook by its [n], and in a shared
//      formula's followers, which store no text of their own.
//   2. a sheet name inside a string literal is not a reference.
//   3. a pivot is traced to the sheet its cache was built from, a query to the
//      table it loads, and a query to what it reads, but not to a query that
//      only shares a name with one of its own steps.
//   4. a sheet of headings over rows reads as a table and a sheet of labels as
//      a form, with the headings found on the row that holds them; a form's
//      label beside its value is not a two-column table.

import test from 'node:test';
import assert from 'node:assert/strict';
import jsdomPkg from 'jsdom';
import { loadKit } from './bootstrap.mjs';

const { JSDOM } = jsdomPkg;
globalThis.DOMParser = new JSDOM('').window.DOMParser;

const w = {};
loadKit('xlsx', { window: w });
loadKit('xlsx-map', { window: w });
globalThis.window = w;
const { xlsxKit, XlsxMap } = w;

const str = (ref, t) => `<c r="${ref}" t="inlineStr"><is><t>${t}</t></is></c>`;
const num = (ref, v) => `<c r="${ref}"><v>${v}</v></c>`;
const fx = (ref, f, v = 0) => `<c r="${ref}"><f>${f}</f><v>${v}</v></c>`;
const row = (r, cells) => `<row r="${r}">${cells.join('')}</row>`;
const sheet = (rows, tail = '') => `<?xml version="1.0"?><worksheet xmlns="ws"><sheetData>${rows.join('')}</sheetData>${tail}</worksheet>`;
const rels = (list) => `<?xml version="1.0"?><Relationships xmlns="rel">${
  list.map(([id, type, target, mode]) => `<Relationship Id="${id}" Type=".../${type}" Target="${target}"${mode ? ` TargetMode="${mode}"` : ''}/>`).join('')}</Relationships>`;

// Summary is a form that reads everything else. C3 is a shared-formula master
// and C4 its follower; B7 names Ledger only inside a string.
const SUMMARY = sheet([
  row(1, [str('A1', 'Quarterly summary')]),
  row(2, [str('A2', 'Prepared by'), str('B2', 'Budget office')]),
  row(3, [str('A3', 'Total'), fx('B3', 'SUM(Ledger!C2:C4)'),
    `<c r="C3"><f t="shared" ref="C3:C4" si="0">Ledger!C2*2</f><v>0</v></c>`]),
  row(4, [fx('B4', "'Q1 / Plan'!B2*2"), `<c r="C4"><f t="shared" si="0"/><v>0</v></c>`]),
  row(5, [fx('B5', 'SUM(LedgerTbl[Amount])')]),
  row(6, [fx('B6', 'TaxRate*B3')]),
  row(7, [fx('B7', '"Ledger!A1"&amp;"x"')]),
  row(8, [fx('B8', '[1]Rates!A1')]),
], `<dataValidations count="1"><dataValidation type="list" sqref="D3"><formula1>Lookups!$A$1:$A$3</formula1></dataValidation></dataValidations>`);

const LEDGER = sheet([
  row(1, [str('A1', 'Doc'), str('B1', 'Fund'), str('C1', 'Amount')]),
  row(2, [str('A2', 'D-1'), num('B2', 600), num('C2', 10)]),
  row(3, [str('A3', 'D-2'), num('B3', 722), num('C3', 20)]),
  row(4, [str('A4', 'D-3'), num('B4', 600), num('C4', 30)]),
]);

// Plan hides its row 3 and its column C, both inside the used width, and a
// column range past it that must not count.
const PLAN = `<?xml version="1.0"?><worksheet xmlns="ws"><cols><col min="3" max="3" hidden="1"/><col min="5" max="16384" hidden="1"/></cols><sheetData>${
  [row(2, [str('A2', 'Plan'), num('B2', 5), num('C2', 1)]), `<row r="3" hidden="1">${str('A3', 'Old')}</row>`].join('')}</sheetData></worksheet>`;
const LOOKUPS = sheet([
  row(1, [str('A1', 'High')]), row(2, [str('A2', 'Low'), num('B2', 0.07)]), row(3, [str('A3', 'None')]),
]);

const parts = () => [
  ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="ct"/>'],
  ['xl/workbook.xml', `<?xml version="1.0"?><workbook xmlns="wb" xmlns:r="rel"><sheets>
    <sheet name="Summary" sheetId="1" r:id="rId1"/><sheet name="Ledger" sheetId="2" r:id="rId2"/>
    <sheet name="Q1 / Plan" sheetId="3" r:id="rId3"/><sheet name="Lookups" sheetId="4" r:id="rId4"/></sheets>
    <definedNames><definedName name="TaxRate">Lookups!$B$2</definedName></definedNames>
    <pivotCaches><pivotCache cacheId="7" r:id="rId5"/></pivotCaches>
    <externalReferences><externalReference r:id="rId9"/></externalReferences></workbook>`],
  ['xl/_rels/workbook.xml.rels', rels([
    ['rId1', 'worksheet', 'worksheets/sheet1.xml'], ['rId2', 'worksheet', 'worksheets/sheet2.xml'],
    ['rId3', 'worksheet', 'worksheets/sheet3.xml'], ['rId4', 'worksheet', 'worksheets/sheet4.xml'],
    ['rId5', 'pivotCacheDefinition', 'pivotCache/pivotCacheDefinition1.xml'],
    ['rId9', 'externalLink', 'externalLinks/externalLink1.xml'],
  ])],
  ['xl/worksheets/sheet1.xml', SUMMARY],
  ['xl/worksheets/sheet2.xml', LEDGER],
  ['xl/worksheets/sheet3.xml', PLAN],
  ['xl/worksheets/sheet4.xml', LOOKUPS],
  ['xl/worksheets/_rels/sheet1.xml.rels', rels([['rId1', 'pivotTable', '../pivotTables/pivotTable1.xml']])],
  ['xl/worksheets/_rels/sheet2.xml.rels', rels([['rId1', 'table', '../tables/table1.xml']])],
  ['xl/tables/table1.xml', `<?xml version="1.0"?><table xmlns="tb" id="1" name="LedgerTbl" displayName="LedgerTbl" ref="A1:C4"/>`],
  ['xl/tables/_rels/table1.xml.rels', rels([['rId1', 'queryTable', '../queryTables/queryTable1.xml']])],
  ['xl/queryTables/queryTable1.xml', `<?xml version="1.0"?><queryTable xmlns="qt" name="Feed" connectionId="2"/>`],
  ['xl/connections.xml', `<?xml version="1.0"?><connections xmlns="cn">
    <connection id="1" name="OFM page" type="4"><webPr url="https://ofm.wa.gov/budget"/></connection>
    <connection id="2" name="Query - Feed" type="5"><dbPr connection="Provider=Microsoft.Mashup.OleDb.1;Location=Feed"/></connection>
    <connection id="3" name="Nightly download" type="5"><dbPr connection="Provider=Microsoft.Mashup.OleDb.1;Data Source=$Workbook$;Location=Base" command="Base"/></connection>
  </connections>`],
  ['xl/externalLinks/externalLink1.xml', `<?xml version="1.0"?><externalLink xmlns="el"/>`],
  ['xl/externalLinks/_rels/externalLink1.xml.rels', rels([['rId1', 'externalLinkPath', 'file:///C:/Budget/Rates%202027.xlsx', 'External']])],
  ['xl/pivotTables/pivotTable1.xml', `<?xml version="1.0"?><pivotTableDefinition xmlns="pt" name="ByFund" cacheId="7"><location ref="F1:G4"/></pivotTableDefinition>`],
  ['xl/pivotCache/pivotCacheDefinition1.xml', `<?xml version="1.0"?><pivotCacheDefinition xmlns="pc" recordCount="3">
    <cacheSource type="worksheet"><worksheetSource ref="A1:C4" sheet="Ledger"/></cacheSource>
    <cacheFields count="3"><cacheField name="Doc"/><cacheField name="Fund"/><cacheField name="Amount"/></cacheFields></pivotCacheDefinition>`],
];

// The M a workbook's queries run lives in a binary blob kits/xlsx.js opens;
// set beside the parsed result here, which is where that reader puts it.
const read = () => {
  const r = xlsxKit.analyze(parts());
  r.xl.powerQuery = { sections: [{ path: 'Formulas/Section1.m', m: [
    'section Section1;',
    '',
    '[ Description = "Seed download from example.gov" ]',
    'shared Base = let Source = Csv.Document(Web.Contents("https://example.gov/feed.csv")) in Source;',
    '',
    '[ Description = "Filtered feed (mentions Base in description)" ]',
    'shared Feed = let Source = Base, #"Kept" = Table.SelectRows(Source, each [Note] <> "shared Fake = 1") in #"Kept";',
    '',
    '[ Description = "Reads LedgerTbl and filters [Base] column without referencing Base query" ]',
    'shared Local = let T = Excel.CurrentWorkbook(){[Name="LedgerTbl"]}[Content], K = Table.SelectRows(T, each [Base] <> "Base") in K;',
    '',
    'shared Source = let A = 1 in A;',
  ].join('\n') }] };
  return r;
};

const find = (links, kind, from, to) => links.filter(l => l.kind === kind && l.from.name === from && (l.to.name === to));

test('kit surface', () => {
  assert.deepEqual(Object.keys(XlsxMap).sort(), ['gist', 'links', 'phrase', 'queries', 'refs', 'words']);
});

test('a formula reaches a sheet however it names it, and a string literal reaches nothing', () => {
  const r = read();
  assert.deepEqual(
    XlsxMap.refs(`SUM('Q1 / Plan'!A1, Ledger!B2) & "Lookups!A1"`, r, 'Summary').map(x => x.sheet),
    ['Q1 / Plan', 'Ledger']);
  assert.deepEqual(XlsxMap.refs('Summary!A1+1', r, 'Summary'), [], 'a reference to its own sheet is no link');
});

test('every route from Ledger to Summary counts once per cell, followers included', () => {
  const links = XlsxMap.links(read());
  const [l] = find(links, 'formula', 'Ledger', 'Summary');
  assert.ok(l, JSON.stringify(links.map(XlsxMap.phrase)));
  assert.equal(l.count, 4, 'B3, C3, its follower C4, and B5 through the table');
  assert.deepEqual(l.cells, ['B3', 'C3', 'C4', 'B5']);
  assert.ok(l.via.includes('table LedgerTbl'));
  assert.ok(!l.cells.includes('B7'), 'the sheet named inside a string is not read');
});

test('a quoted name, a defined name and another workbook each read as their own link', () => {
  const links = XlsxMap.links(read());
  assert.equal(find(links, 'formula', 'Q1 / Plan', 'Summary')[0]?.count, 1);
  const named = find(links, 'formula', 'Lookups', 'Summary')[0];
  assert.deepEqual([named?.count, named?.via], [1, ['name TaxRate']]);
  const ext = links.find(l => l.kind === 'formula' && l.from.type === 'external');
  assert.deepEqual([ext?.from.name, ext?.count], ['Rates 2027.xlsx', 1]);
  assert.equal(find(links, 'validation', 'Lookups', 'Summary').length, 1, 'the dropdown list');
});

test('a pivot to its source sheet, a query to its table, a query to what it reads', () => {
  const links = XlsxMap.links(read());
  const piv = links.find(l => l.kind === 'pivot');
  assert.equal(XlsxMap.phrase(piv), 'Ledger is the source of pivot ByFund on Summary');
  assert.deepEqual([piv.count, piv.detail], [3, 'Ledger!A1:C4']);
  const load = links.find(l => l.kind === 'load');
  assert.equal(XlsxMap.phrase(load), 'query Feed loads table LedgerTbl on Ledger');
  const sources = links.filter(l => l.kind === 'source').map(XlsxMap.phrase).sort();
  assert.deepEqual(sources, [
    'external https://example.gov/feed.csv feeds query Base',
    'external https://ofm.wa.gov/budget feeds connection OFM page',
    'query Base feeds connection Nightly download',
    'query Base feeds query Feed',
    'table LedgerTbl on Ledger feeds query Local',
  ], 'and no link from the query named Source, which is only a step of Base and Feed');
});

test('one M file holds every query, each by its name', () => {
  const qs = XlsxMap.queries(read());
  assert.deepEqual(qs.map(q => q.name), ['Base', 'Feed', 'Local', 'Source'],
    'and "shared Fake" inside a string opens no query');
  assert.equal(qs[0].m, 'let Source = Csv.Document(Web.Contents("https://example.gov/feed.csv")) in Source',
    'trailing semicolon and following [ Description = ... ] attribute are stripped cleanly');
  assert.match(qs[1].m, /^let Source = Base/);
});

test('a sheet of headings over rows is a table; a sheet of labels is a form', () => {
  const g = Object.fromEntries(XlsxMap.gist(read()).map(s => [s.name, s]));
  assert.deepEqual(Object.keys(g), ['Summary', 'Ledger', 'Q1 / Plan', 'Lookups'], 'workbook order');
  assert.deepEqual([g.Ledger.shape, g.Ledger.headerRow, g.Ledger.rows, g.Ledger.cols, g.Ledger.records],
    ['table', 1, 4, 3, 3]);
  assert.deepEqual(g.Ledger.header.map(h => h.label), ['Doc', 'Fund', 'Amount']);
  assert.deepEqual(g.Ledger.tables, ['LedgerTbl']);
  assert.equal(g.Summary.shape, 'form');
  assert.deepEqual([g.Summary.headerRow, g.Summary.header], [null, []], 'Prepared by | Budget office is a label and its value');
  assert.deepEqual(g.Summary.labels.slice(0, 4), ['Quarterly summary', 'Prepared by', 'Budget office', 'Total']);
  assert.deepEqual(g.Summary.pivots, ['ByFund']);
  assert.equal(g.Summary.validations, 1);
  assert.deepEqual(g.Lookups.named, ['TaxRate']);
  assert.deepEqual([g['Q1 / Plan'].hiddenRows, g['Q1 / Plan'].hiddenCols], [[3], ['C']], 'hidden rows by number, columns by letter, within the used width');
});
