// kits/xlsx.js — the two text readers (scanSheetData, scanSharedStrings) and
// the DOM path they replaced, which `analyze(parts, { dom: true })` still runs;
// and the native unzip against JSZip, which `readZip(bytes, { zip: 'jszip' })`
// still runs.
// The readers exist for speed (a 100,000-row sheet read in 41 s through the
// DOM), so what has to hold is that they change nothing else: every committed
// workbook and a fixture of the awkward cases read the same both ways, row by
// row, counter by counter, and path by path in the inventory.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import jsdomPkg from 'jsdom';
import JSZip from 'jszip';
import { loadKit, repoRoot } from './bootstrap.mjs';

const { JSDOM } = jsdomPkg;
globalThis.DOMParser = new JSDOM('').window.DOMParser;
// gh-api.js's base64 owner, which every page boots before a kit.
const w = { GH: { toBase64: (bytes) => Buffer.from(bytes).toString('base64') } };
loadKit('xlsx', { window: w });
const { xlsxKit } = w;

const partsOf = async (file) => {
  const zip = await JSZip.loadAsync(readFileSync(path.join(repoRoot, file)));
  return Promise.all(Object.entries(zip.files)
    .filter(([p, f]) => !f.dir && /\.(xml|rels)$/.test(p))
    .map(async ([p, f]) => [p, await f.async('string')]));
};

// What a reader of the result sees: each sheet's rows and counters, the
// string table, and the inventory's counts and attribute names.
const view = (r) => ({
  strings: r.xl.strings,
  sheets: Object.fromEntries(Object.entries(r.xl.sheets).map(([k, s]) => [k, {
    rows: s.rows, cellCount: s.cellCount, formulas: s.formulas, sharedFormulas: s.sharedFormulas,
    usedStrings: [...s.usedStrings].sort((a, b) => a - b), usedStyles: [...s.usedStyles].sort(),
    merges: s.merges, cols: s.cols, validations: s.validations, conditionalFormats: s.conditionalFormats,
    hyperlinks: s.hyperlinks, freeze: s.freeze, dimension: s.dimension,
  }])),
  styles: [...r.xl.styles].sort(),
  census: Object.fromEntries(Object.entries(r.el)
    .map(([k, v]) => [k, { count: v.count, attrs: Object.keys(v.attr).sort(), text: [...v.text].sort() }])),
  connected: [...r.connectedPaths].sort(),
});

const same = (parts, label) => {
  const fast = view(xlsxKit.analyze(parts));
  const dom = view(xlsxKit.analyze(parts, { dom: true }));
  for (const k of ['strings', 'sheets', 'styles', 'census', 'connected']) assert.deepEqual(fast[k], dom[k], `${label}: ${k}`);
};

for (const file of ['docs/examples/allotment-ledger.xlsx', 'docs/examples/demonstration-workbooks.xlsx',
  'docs/examples/demonstration-charts.xlsx', 'node/test/fixtures/native-chart-cases.xlsx']) {
  test(`${file} reads the same through the text readers and the DOM`, async () => same(await partsOf(file), file));
}

// The cases a reader by position could get wrong.
const SHEET = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="ws" xmlns:r="rel"><dimension ref="A1:D6"/>
<cols><col min="1" max="1" width="12" customWidth="1"/></cols>
<sheetData>
  <row r="1" spans="1:4" ht="20" customHeight="1"><c r="A1" t="s" s="1"><v>0</v></c><c r="B1" t="inlineStr"><is><r><rPr><b/></rPr><t>Bold</t></r><r><t xml:space="preserve"> &amp; plain</t></r><rPh sb="0" eb="1"><t>ふりがな</t></rPh></is></c></row>
  <row r="2" hidden="1"><c r='A2' s='2'/><c r="B2"><f>IF(A2&gt;0,"a&lt;b",'x')</f><v>a&lt;b</v></c><c r="C2"><f t="shared" ref="C2:C3" si="0">A2*2</f><v>0</v></c></row>
  <row r="3"><c r="C3"><f t="shared" si="0"/><v>0</v></c><c r="D3" t="str"><f>"q&gt;"</f><v>q&gt;</v></c></row>
  <row><c><v>  7  </v></c><c><v>8</v></c></row>
  <row r="6"/>
  <row r="7"><c r="A7" t="b"><v>1</v></c><c r="B7" t="e"><v>#N/A</v></c><c r="C7"><v>&#38;&#x41;</v><extLst><ext uri="x"/></extLst></c></row>
</sheetData>
<mergeCells count="1"><mergeCell ref="A1:B1"/></mergeCells>
<dataValidations count="1"><dataValidation type="list" sqref="A2"><formula1>"x,y"</formula1></dataValidation></dataValidations>
</worksheet>`;
const STRINGS = `<?xml version="1.0"?><sst xmlns="sst" count="4" uniqueCount="4"><si><t>Fund &amp; Object</t></si><si/><si><r><t>Rich</t></r><r><rPr/><t> text</t></r></si><si><t></t><rPh><t>ph</t></rPh></si></sst>`;
const awkward = () => [
  ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="ct"/>'],
  ['xl/workbook.xml', `<?xml version="1.0"?><workbook xmlns="wb" xmlns:r="rel"><sheets><sheet name="One" sheetId="1" r:id="rId1"/></sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels', `<?xml version="1.0"?><Relationships xmlns="rel"><Relationship Id="rId1" Type=".../worksheet" Target="worksheets/sheet1.xml"/></Relationships>`],
  ['xl/worksheets/sheet1.xml', SHEET],
  ['xl/sharedStrings.xml', STRINGS],
];

test('the awkward cases read the same both ways', () => same(awkward(), 'fixture'));

test('and read as the DOM reads them, value by value', () => {
  const r = xlsxKit.analyze(awkward());
  const s = r.xl.sheets.sheet1;
  const at = (row, col) => s.rows.find(x => x.row === row)?.cells[col];
  assert.deepEqual(r.xl.strings, ['Fund & Object', '', 'Rich text', '']);
  assert.equal(at(1, 0), 'Fund & Object');
  assert.equal(at(1, 1), 'Bold & plain', 'runs joined, the phonetic run left out');
  assert.equal(at(2, 1), 'a<b');
  assert.equal(s.rows.find(x => x.row === 2).formulas[1], 'IF(A2>0,"a<b",\'x\')');
  assert.equal(s.rows.find(x => x.row === 3).formulas[2], true, 'a shared follower stores no text');
  assert.equal(s.sharedFormulas[0], 'A2*2');
  assert.equal(at(4, 0), '  7  ', 'a row and cells with no r follow on, and the value is not trimmed');
  assert.equal(at(7, 2), '&A', 'numeric character references');
  assert.equal(s.rows.find(x => x.row === 2).hidden, true);
  assert.equal(s.rows.find(x => x.row === 1).height, 20);
  assert.deepEqual([s.cellCount, s.formulas], [12, 4]);
});

// The browser's own inflate against JSZip's, on every committed workbook:
// the same parts in, so the same read out, media included.
for (const file of ['docs/examples/allotment-ledger.xlsx', 'docs/examples/demonstration-workbooks.xlsx',
  'docs/examples/demonstration-charts.xlsx', 'node/test/fixtures/native-chart-cases.xlsx']) {
  test(`${file} opens the same natively and through JSZip`, async () => {
    const bytes = new Uint8Array(readFileSync(path.join(repoRoot, file)));
    const native = await xlsxKit.readZip(bytes, { fresh: true });
    const jszip = await xlsxKit.readZip(bytes, { fresh: true, zip: 'jszip' });
    assert.deepEqual(view(native), view(jszip));
    assert.deepEqual(native.xl.media, jszip.xl.media);
  });
}

test('an image comes through the same, deflated or stored', async () => {
  for (const compression of ['DEFLATE', 'STORE']) {
    const zip = new JSZip();
    for (const [p, xml] of awkward()) zip.file(p, xml);
    zip.file('xl/media/image1.png', Uint8Array.from({ length: 5000 }, (_, i) => (i * 37) % 256));
    const bytes = await zip.generateAsync({ type: 'uint8array', compression });
    const native = await xlsxKit.readZip(bytes, { fresh: true });
    const jszip = await xlsxKit.readZip(bytes, { fresh: true, zip: 'jszip' });
    assert.ok(native.xl.media['xl/media/image1.png']?.startsWith('data:image/png;base64,'), compression);
    assert.deepEqual(native.xl.media, jszip.xl.media, compression);
    assert.deepEqual(view(native), view(jszip), compression);
  }
});

// The sliced read (readZip's) and the one-go read (analyze) are the same
// steps, so they return the same thing; the sliced one also says how far it
// has got, rising to the end.
test('a sliced read reports rising progress and returns what analyze returns', async () => {
  const rows = [];
  for (let r = 1; r <= 10000; r++) rows.push(`<row r="${r}"><c r="A${r}" t="s"><v>${r % 3}</v></c><c r="B${r}"><v>${r}</v></c></row>`);
  const zip = new JSZip();
  for (const [p, xml] of awkward()) zip.file(p, p.endsWith('sheet1.xml')
    ? `<?xml version="1.0"?><worksheet xmlns="ws"><sheetData>${rows.join('')}</sheetData></worksheet>` : xml);
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const seen = [];
  const sliced = await xlsxKit.readZip(bytes, { fresh: true, sliceMs: 0, onProgress: (p) => seen.push(p) });
  const parts = await Promise.all(Object.entries((await JSZip.loadAsync(bytes)).files)
    .map(async ([p, f]) => [p, await f.async('string')]));
  assert.deepEqual(view(sliced), view(xlsxKit.analyze(parts)));
  assert.ok(seen.length >= 5, `progress reported ${seen.length} times`);
  assert.ok(seen.every((p, k) => p >= 0 && p <= 1 && (k === 0 || p >= seen[k - 1])), 'and only ever rising');
});
