// kits/xlsx-people.js — where a workbook may name people. The fixture is
// hand-built XML parts, like xlsx-extract.test.mjs, and the first-name list is
// a small Set handed in, since the real one is a fetch.
//
// What would rot silently, in order:
//
//   1. the names that ARE there are found: a person column, a form label's
//      value, an address, a comment author, the file's creator.
//   2. the phrases that only look like names are not: a program named
//      "Member Services", "Budget Office", "Grace Period", "June Total".
//   3. carried() follows the pick, reading by reading, so the roster never
//      reports a name an extract would not hold, and always one it would.

import test from 'node:test';
import assert from 'node:assert/strict';
import jsdomPkg from 'jsdom';
import { loadKit } from './bootstrap.mjs';

const { JSDOM } = jsdomPkg;
globalThis.DOMParser = new JSDOM('').window.DOMParser;

const w = {};
loadKit('xlsx', { window: w });
loadKit('xlsx-people', { window: w });
globalThis.window = w;
const { xlsxKit, XlsxPeople } = w;

const FIRST = new Set(['Dana', 'Maria', 'David', 'Grace', 'Peter', 'Rachel', 'Thomas', 'June']);

const str = (ref, t) => `<c r="${ref}" t="inlineStr"><is><t>${t}</t></is></c>`;
const num = (ref, v) => `<c r="${ref}"><v>${v}</v></c>`;
const row = (r, cells) => `<row r="${r}">${cells.join('')}</row>`;
const sheet = (rows) => `<?xml version="1.0"?><worksheet xmlns="ws"><sheetData>${rows.join('')}</sheetData></worksheet>`;

// Cover is a form; Staff a table; Totals carries the near-misses.
const COVER = sheet([
  row(1, [str('A1', 'FY27 Staffing Request')]),
  row(3, [str('A3', 'Prepared by'), str('C3', 'Dana Whitfield')]),
  row(4, [str('A4', 'Reviewed by:'), str('C4', 'Budget Office')]),
  row(5, [str('A5', 'Program'), str('C5', 'Member Services')]),
  row(6, [str('A6', 'Contact email'), str('C6', 'dana.whitfield@example.gov')]),
]);
const STAFF = sheet([
  row(1, [str('A1', 'Position'), str('B1', 'Employee'), str('C1', 'Program'), str('D1', 'Supervisor')]),
  row(2, [str('A2', 'Analyst 3'), str('B2', 'Lopez, Maria'), str('C2', 'Member Services'), str('D2', 'Rachel Kim')]),
  row(3, [str('A3', 'Analyst 2'), str('B3', 'Chen, David'), str('C3', 'Information Services'), str('D3', 'Rachel Kim')]),
  row(4, [str('A4', 'Manager'), str('B4', 'Okafor, Grace'), str('C4', 'Employer Services'), str('D4', 'Thomas Reed')]),
  row(5, [str('A5', 'Analyst 4'), str('B5', 'Novak, Peter'), str('C5', 'Administration'), str('D5', 'Thomas Reed')]),
]);
const TOTALS = sheet([
  row(1, [str('A1', 'Program'), str('B1', 'June Total')]),
  row(2, [str('A2', 'Member Services'), num('B2', 120000)]),
  row(3, [str('A3', 'Grace Period'), num('B3', 0)]),
  row(4, [str('A4', 'June Total'), num('B4', 120000)]),
]);

const parts = () => [
  ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="ct"/>'],
  ['xl/workbook.xml', `<?xml version="1.0"?><workbook xmlns="wb" xmlns:r="rel"><sheets>
    <sheet name="Cover" sheetId="1" r:id="rId1"/><sheet name="Staff" sheetId="2" r:id="rId2"/>
    <sheet name="Totals" sheetId="3" r:id="rId3"/></sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels', `<?xml version="1.0"?><Relationships xmlns="rel">
    <Relationship Id="rId1" Type=".../worksheet" Target="worksheets/sheet1.xml"/>
    <Relationship Id="rId2" Type=".../worksheet" Target="worksheets/sheet2.xml"/>
    <Relationship Id="rId3" Type=".../worksheet" Target="worksheets/sheet3.xml"/></Relationships>`],
  ['xl/worksheets/sheet1.xml', COVER],
  ['xl/worksheets/sheet2.xml', STAFF],
  ['xl/worksheets/sheet3.xml', TOTALS],
  // openpyxl's path for a comments part, not Excel's comments1.xml.
  ['xl/worksheets/_rels/sheet2.xml.rels', `<?xml version="1.0"?><Relationships xmlns="rel">
    <Relationship Id="rId1" Type=".../comments" Target="../comments/comment1.xml"/></Relationships>`],
  ['xl/comments/comment1.xml', `<?xml version="1.0"?><comments xmlns="cm"><authors><author>Jordan Ellis</author></authors>
    <commentList><comment ref="B3" authorId="0"><text><t>Confirm start date</t></text></comment></commentList></comments>`],
  ['docProps/core.xml', `<?xml version="1.0"?><cp:coreProperties xmlns:cp="cp" xmlns:dc="dc">
    <dc:creator>Pat Morgan</dc:creator><cp:lastModifiedBy>Pat Morgan</cp:lastModifiedBy></cp:coreProperties>`],
];

const found = () => XlsxPeople.scan(xlsxKit.analyze(parts()), { firstNames: FIRST });
const ids = (f) => f.findings.map(x => x.id).sort();

test('kit surface', () => {
  assert.deepEqual(Object.keys(XlsxPeople).sort(), ['carried', 'loadFirstNames', 'nameKind', 'rows', 'scan', 'where']);
});

test('every planted name is found, in the place it sits', () => {
  assert.deepEqual(ids(found()), [
    'author:Staff',
    'cell:Cover:C3',
    'cell:Cover:C6',
    'column:Staff:B',
    'column:Staff:D',
    'property:creator',
    'property:last modified by',
  ]);
});

test('a column is judged as a whole, with its heading and its evidence', () => {
  const emp = found().findings.find(f => f.id === 'column:Staff:B');
  assert.equal(emp.header, 'Employee');
  assert.deepEqual(emp.evidence, ['dictionary', 'header']);
  assert.equal(emp.count, 4);
  assert.equal(emp.filled, 4);
  assert.deepEqual(emp.samples, ['Lopez, Maria', 'Chen, David', 'Okafor, Grace']);
});

test('a form names a person beside its label; a lone address is a cell, not its column', () => {
  const f = found().findings;
  assert.equal(f.find(x => x.id === 'cell:Cover:C3').label, 'Prepared by');
  assert.deepEqual(f.find(x => x.id === 'cell:Cover:C6').evidence, ['label', 'email']);
  assert.equal(f.some(x => x.id === 'column:Cover:C'), false);
});

test('phrases that only look like names are not reported', () => {
  for (const s of ['Member Services', 'Budget Office', 'Grace Period', 'June Total', 'Analyst 3', 'FY27 Staffing Request'])
    assert.equal(XlsxPeople.nameKind(s, FIRST), null, s);
  assert.equal(found().findings.some(x => x.sheet === 'Totals'), false);
});

test('nameKind reads the usual shapes, all capitals, and an address', () => {
  assert.equal(XlsxPeople.nameKind('Lopez, Maria', FIRST), 'dictionary');
  assert.equal(XlsxPeople.nameKind('LOPEZ, MARIA', FIRST), 'dictionary');
  assert.equal(XlsxPeople.nameKind('Maria J. Lopez', FIRST), 'dictionary');
  assert.equal(XlsxPeople.nameKind("Siobhan O'Brien-McKay", FIRST), 'shape', 'off the list, still a name shape');
  assert.equal(XlsxPeople.nameKind('a.b@example.org', FIRST), 'email');
});

test('without a first-name list, a headed column still reads, and the scan says it ran without one', () => {
  const f = XlsxPeople.scan(xlsxKit.analyze(parts()), {});
  assert.equal(f.dictionary, false);
  const emp = f.findings.find(x => x.id === 'column:Staff:B');
  assert.deepEqual(emp?.evidence, ['header']);
});

test('carried() follows the pick: values carry a column, styles do not, comments carry their authors', () => {
  const f = found();
  const pick = (sheets) => ({ sheets: new Map(Object.entries(sheets).map(([k, v]) => [k, new Set(v)])), objects: new Set() });
  assert.deepEqual(XlsxPeople.carried(f, pick({ Staff: ['values'] })).map(x => x.id).sort(),
    ['column:Staff:B', 'column:Staff:D']);
  assert.deepEqual(XlsxPeople.carried(f, pick({ Staff: ['styles'] })), []);
  assert.deepEqual(XlsxPeople.carried(f, pick({ Staff: ['comments'] })).map(x => x.id), ['author:Staff']);
  assert.deepEqual(XlsxPeople.carried(f, pick({ Totals: ['values', 'cells'] })), []);
});

test('the file properties are reported and never carried by an extract', () => {
  const f = found();
  const all = { sheets: new Map(['Cover', 'Staff', 'Totals'].map(n => [n, new Set(['values', 'cells', 'comments'])])), objects: new Set() };
  assert.equal(XlsxPeople.carried(f, all).some(x => x.kind === 'property'), false);
  assert.deepEqual(f.findings.find(x => x.id === 'property:creator').samples, ['Pat Morgan']);
});

test('rows() puts each finding where a reader would look for it', () => {
  const rows = XlsxPeople.rows(found());
  assert.deepEqual(rows.find(r => r.Where === 'Staff!B'),
    { Where: 'Staff!B', Field: 'Employee', Evidence: 'dictionary, header', Count: '4 of 4',
      Examples: 'Lopez, Maria; Chen, David; Okafor, Grace' });
  assert.equal(rows.find(r => r.Field === 'creator').Where, 'file');
});
